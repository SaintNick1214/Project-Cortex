import { checkArtifactContextWitnesses } from "./runtimeArtifactContext";
/** Called inside the native ledger transaction, so an edit/revocation/cancel cannot
 * land between an action-side check and admission or visible output. */
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { CutoffV1 } from "../src/domain/transcript";
import { canonicalModelJson } from "../src/domain/model-policy";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { activeAttempt } from "./runs";
import { agentComponent, canonicalMessageHash, checkNativeMediaReferences, hydratePrivateCutoff, singleTranscript, transcriptDenied } from "./runtimeTranscript";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
import { recheckAuthority } from "./runtimeAuth";
import { NATIVE_TOOL_NAMES_V2 as NATIVE_TOOL_NAMES } from "../src/domain/agent-tools";

export async function guardAgentRunBudget(ctx: Pick<QueryCtx, "db" | "runQuery">,
  reference: RuntimeAuthorityReference, runAccountId: Id<"runtimeBudgetAccounts">): Promise<void> {
  const run = singleTranscript(await ctx.db.query("runtimeRuns").withIndex("by_run_account", q => q.eq("runAccountId", runAccountId)).take(2));
  // Standalone memory/model budgets retain their original policy contract.
  if (!run?.executionRequested) return;
  if (canonicalModelJson(run.authorityReference) !== canonicalModelJson(reference)) transcriptDenied("POLICY_DENIED");
  const owned = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", run.tenantId)
    .eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId).eq("attemptNumber", run.attemptNumber)).take(2));
  if (!owned || !["ready", "running"].includes(owned.state) || !run.snapshotCanonical) transcriptDenied("INVALID_STATE");
  const args = { reference, runId: run.runId, attemptNumber: run.attemptNumber, leaseVersion: owned.leaseVersion };
  const current = await activeAttempt(ctx, args);
  await hydratePrivateCutoff(ctx, current.conversation, current.row, JSON.parse(run.snapshotCanonical) as CutoffV1);
  if (owned.savedMessageIds.length > 1000) transcriptDenied("CONTEXT_LIMIT_EXCEEDED");
  for (let index = 0; index < owned.savedMessageIds.length; index += 100) {
    const ids = owned.savedMessageIds.slice(index, index + 100);
    const messages = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: ids });
    if (messages.length !== ids.length) transcriptDenied("STALE_TRANSCRIPT");
    for (let i = 0; i < ids.length; i++) {
      const message = messages[i]; const pin = owned.savedMessagePins?.find(item => item.id === ids[i]);
      if (!message || message._id !== ids[i] || message.threadId !== current.conversation.threadId || message.status !== "success"
        || !pin || pin.order !== message.order || pin.stepOrder !== message.stepOrder || pin.canonicalContentHash !== await canonicalMessageHash(message)) transcriptDenied("STALE_TRANSCRIPT");
      await checkNativeMediaReferences(ctx, reference, message);
    }
  }
  await checkContextSourceWitnesses(ctx, reference, owned.sourceWitnesses);
  await checkArtifactContextWitnesses(ctx, reference, owned.artifactContextWitnesses ?? []);
  const tools = await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", run.tenantId)
    .eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId).eq("attemptNumber", run.attemptNumber).eq("kind", "tool")).take(33);
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
