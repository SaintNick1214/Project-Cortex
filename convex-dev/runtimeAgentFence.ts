import { checkArtifactContextWitnesses } from "./runtimeArtifactContext";
/** Called inside the native ledger transaction, so an edit/revocation/cancel cannot
 * land between an action-side check and admission or visible output. */
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { CutoffV1 } from "../src/domain/transcript";
import { canonicalModelJson } from "../src/domain/model-policy";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { comparePosition } from "../src/domain/transcript";
import { activeAttempt, currentRun } from "./runs";
import { agentComponent, canonicalMessageHash, checkNativeMediaReferences, executionRevision, hydratePrivateCutoff, singleTranscript, transcriptDenied } from "./runtimeTranscript";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
import { recheckAuthority, readV8AgentExecutionRows, readV8AgentToolRows } from "./runtimeAuth";
import { NATIVE_TOOL_NAMES_V2 as NATIVE_TOOL_NAMES } from "../src/domain/agent-tools";

/** Internal automatic-title witness, never accepted from a public/model request. */
export type CompletedAgentTitle = { runId: string; sourceMessageId: string; attemptNumber: number; leaseVersion: number; parentOperationId: Id<"runtimeModelOperations"> };
export async function guardAgentRunBudget(ctx: Pick<QueryCtx, "db" | "runQuery">,
  reference: RuntimeAuthorityReference, runAccountId: Id<"runtimeBudgetAccounts">, title?: CompletedAgentTitle): Promise<void> {
  const run = singleTranscript(await ctx.db.query("runtimeRuns").withIndex("by_run_account", q => q.eq("runAccountId", runAccountId)).take(2));
  // Standalone memory/model budgets retain their original policy contract.
  if (!run?.executionRequested) return;
  if (canonicalModelJson(run.authorityReference) !== canonicalModelJson(reference)) transcriptDenied("POLICY_DENIED");
  const owned = singleTranscript(await readV8AgentExecutionRows(ctx, run.tenantId, run.memorySpaceId, run.runId, run.attemptNumber));
  if (!owned || !run.snapshotCanonical || canonicalModelJson(owned.reference) !== canonicalModelJson(reference)) transcriptDenied("INVALID_STATE");
  const args = { reference, runId: run.runId, attemptNumber: run.attemptNumber, leaseVersion: owned.leaseVersion };
  const snapshot = JSON.parse(run.snapshotCanonical) as CutoffV1;
  let current;
  if (owned.state === "complete" && title) {
    current = await currentRun(ctx, reference, run.runId, "run");
    if (run.responseStatus !== "complete" || run.cancellationRequestedAt !== undefined || title.runId !== run.runId || title.sourceMessageId !== run.inputMessageIds[0] || title.attemptNumber !== run.attemptNumber
      || title.leaseVersion !== owned.leaseVersion || executionRevision(current.conversation) !== snapshot.historyRevision + 1
      || !owned.finalMessageIds?.length || canonicalModelJson(owned.finalMessageIds) !== canonicalModelJson(run.outputMessageIds)) transcriptDenied("INVALID_STATE");
    const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", run.tenantId).eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId)).take(2));
    const attempt = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", run.tenantId).eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId).eq("attemptNumber", run.attemptNumber)).take(2));
    if (!outbox || outbox.state !== "complete" || outbox.leaseVersion !== title.leaseVersion || !outbox.leaseExpiresAt || outbox.leaseExpiresAt <= Date.now()
      || !attempt || attempt.status !== "complete" || attempt.leaseVersion !== title.leaseVersion) transcriptDenied("LEASE_EXPIRED");
    const receipt = singleTranscript(await ctx.db.query("runtimeAgentIngestion").withIndex("by_run", q => q.eq("tenantId", run.tenantId).eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId)).take(2));
    if (!receipt || receipt.receiptId !== owned.ingestionReceiptId || receipt.attemptNumber !== run.attemptNumber
      || receipt.identityCanonical !== canonicalModelJson([run.runId, run.attemptNumber, owned.finalMessageIds])) transcriptDenied("INVALID_STATE");
    const models = await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", run.tenantId).eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId).eq("attemptNumber", run.attemptNumber).eq("kind", "model")).take(34);
    const final = models.sort((a, b) => b.ordinal - a.ordinal)[0];
    const parent = await ctx.db.get("runtimeModelOperations", title.parentOperationId);
    if (models.length > 33 || !final || final.state !== "complete" || final.nativeModelOperationId !== title.parentOperationId
      || canonicalModelJson(final.nativeMessageIds) !== canonicalModelJson(owned.finalMessageIds)
      || !parent || parent.operationKey !== "agent.respond" || parent.runAccountId !== runAccountId || parent.cancelled || parent.overrun
      || canonicalModelJson(parent.reference) !== canonicalModelJson(reference)) transcriptDenied("POLICY_DENIED");
    // Final registration advances this revision exactly once. The original
    // cutoff bytes/pins stay immutable; only that proven completion is allowed.
    await hydratePrivateCutoff(ctx, current.conversation, current.row, { ...snapshot, historyRevision: snapshot.historyRevision + 1 });
  } else {
    if (!["ready", "running"].includes(owned.state)) transcriptDenied("INVALID_STATE");
    current = await activeAttempt(ctx, args);
    await hydratePrivateCutoff(ctx, current.conversation, current.row, snapshot);
  }
  if (owned.savedMessageIds.length > 1000) transcriptDenied("CONTEXT_LIMIT_EXCEEDED");
  for (let index = 0; index < owned.savedMessageIds.length; index += 100) {
    const ids = owned.savedMessageIds.slice(index, index + 100);
    const messages = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: ids });
    if (messages.length !== ids.length) transcriptDenied("STALE_TRANSCRIPT");
    for (let i = 0; i < ids.length; i++) {
      const message = messages[i]; const pin = owned.savedMessagePins?.find(item => item.id === ids[i]);
      if (!message || message._id !== ids[i] || message.threadId !== current.conversation.threadId || message.status !== "success"
        || !pin || pin.order !== message.order || pin.stepOrder !== message.stepOrder || pin.canonicalContentHash !== await canonicalMessageHash(message, ctx)
        || message.order !== snapshot.anchor.order || comparePosition(message, snapshot.anchor) <= 0) transcriptDenied("STALE_TRANSCRIPT");
      await checkNativeMediaReferences(ctx, reference, message);
    }
  }
  await checkContextSourceWitnesses(ctx, reference, owned.sourceWitnesses);
  await checkArtifactContextWitnesses(ctx, reference, owned.artifactContextWitnesses ?? []);
  const tools = await readV8AgentToolRows(ctx, run.tenantId, run.memorySpaceId, run.runId, run.attemptNumber);
  if (tools.length > 32) transcriptDenied("TOOL_STEP_LIMIT");
  for (const tool of tools.filter(row => row.state === "started")) {
    const definition = current.definition.definition.tools.find(item => NATIVE_TOOL_NAMES[item.toolId as keyof typeof NATIVE_TOOL_NAMES] === tool.toolName);
    if (!definition) transcriptDenied("TOOL_DENIED");
    await recheckAuthority(ctx, reference, { capability: "tool", tenantId: run.tenantId, memorySpaceId: run.memorySpaceId });
    await recheckAuthority(ctx, reference, { capability: definition.toolId === "memory.remember" || definition.toolId.startsWith("media.") ? "write" : "read", tenantId: run.tenantId, memorySpaceId: run.memorySpaceId });
    if (definition.approval === "explicit") {
      if (!tool.approvalActor) transcriptDenied("APPROVAL_REQUIRED");
      await recheckAuthority(ctx, tool.approvalActor, { capability: "admin", tenantId: run.tenantId, memorySpaceId: run.memorySpaceId });
    }
  }
}
