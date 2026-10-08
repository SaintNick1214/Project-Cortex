/** Atomic admission and durable serialized work. Task07 alone dispatches models. */
import { saveMessages } from "@convex-dev/agent";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { CutoffV1 } from "../src/domain/transcript";
import { bindTextSubmission, comparePosition } from "../src/domain/transcript";
import { canonicalModelJson } from "../src/domain/model-policy";
import { dataAuthorityReference, requireDataAuthority } from "./runtimeDataAuth";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { bindTrustedBudget } from "./runtimeModelPolicy";
import { readCurrentExecutableDefinition } from "./agentDefinitions";
import { agentComponent, approveRegisteredMessage, bridgeFor, captureCutoff, checkConversation, conversationById, createManagedConversation, executionRevision,
  hydrateCutoff, registerMessages, requireConversation, singleTranscript, transcriptDenied } from "./runtimeTranscript";
import { recheckAuthority } from "./runtimeAuth";
import { stageStatus } from "./runtimeTranscriptSchema";

function internalMutationRef<Args extends Record<string, unknown>, Result>(name: string) {
  return makeFunctionReference<"mutation", Args, Result>(name) as unknown as FunctionReference<"mutation", "internal", Args, Result>;
}
const recoverRef = internalMutationRef<{ reference: RuntimeAuthorityReference; conversationId: string }, { readyRunId: string | null }>("runs:recoverQueue");
const recoverOwnedRef = internalMutationRef<{ reference: RuntimeAuthorityReference; conversationId: string }, { readyRunId: string | null }>("runs:recoverOwnedQueue");
const cancelBudgetRef = internalMutationRef<{ reference: RuntimeAuthorityReference; runBudgetId: string }, unknown>("runtimeModelPolicy:cancelBudget");
const cancelAgentBudgetRef = internalMutationRef<{ reference: RuntimeAuthorityReference; runId: string }, unknown>("runtimeModelPolicy:cancelAgentBudget");
async function runById(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, runId: string) {
  return singleTranscript(await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("runId", runId)).take(2));
}
/** Metadata access and safe retirement only; it grants no executable definition,
 * model admission, continuation or output attachment. */
export async function currentControlRun(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, runId: string, capability: "read" | "write" | "run") {
  const row = await runById(ctx, reference, runId);
  if (!row || row.tombstonedAt !== undefined) transcriptDenied();
  await recheckAuthority(ctx, reference, { capability, resource: { resourceType: "run", resourceId: row.runId,
    tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, ownerPrincipalId: row.ownerPrincipalId } });
  const conversation = await conversationById(ctx, reference, row.conversationId); if (!conversation) transcriptDenied();
  await checkConversation(ctx, reference, conversation, capability);
  if (row.conversationEpoch !== conversation.epoch) transcriptDenied("STALE_TRANSCRIPT");
  return { row, conversation };
}
export async function currentRun(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, runId: string, capability: "read" | "write" | "run") {
  const { row, conversation } = await currentControlRun(ctx, reference, runId, capability);
  const definition = await readCurrentExecutableDefinition(ctx, row.authorityReference,
    { agentId: row.agentId, version: row.agentVersion }, { capability: "run", operationKey: "agent.respond" });
  if (definition.definitionHash !== row.definitionHash) transcriptDenied("POLICY_DENIED");
  return { row, conversation, definition };
}
export function publicRun(row: Doc<"runtimeRuns">) {
  return { version: 1 as const, runId: row.runId, conversationId: row.conversationId, agentId: row.agentId, agentVersion: row.agentVersion,
    queueSequence: row.queueSequence, responseStatus: row.responseStatus, memoryStatus: row.memoryStatus, graphStatus: row.graphStatus,
    attemptNumber: row.attemptNumber, cancellationRequested: row.cancellationRequestedAt !== undefined,
    inputMessageIds: row.inputMessageIds, outputMessageIds: row.outputMessageIds, failureCode: row.failureCode ?? null,
    contextCompleteness: row.contextCompleteness ?? null, contextFailureCode: row.contextFailureCode ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt };
}
/** Exported pure handler for meaningful native rollback fixtures, not a public fault-injection flag. */
export async function submitHandler(ctx: MutationCtx, args: { request: unknown }) {
  const actor = await requireDataAuthority(ctx, {}, "run");
  // A run grant does not silently become write authority for persistent input.
  const reference = dataAuthorityReference(actor);
  await recheckAuthority(ctx, reference, { capability: "write", tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId });
  let binding: Awaited<ReturnType<typeof bindTextSubmission>>;
  try { binding = await bindTextSubmission(args.request, actor); } catch { return transcriptDenied("INVALID_INPUT"); }
  const definition = await readCurrentExecutableDefinition(ctx, reference, binding.normalized.agentSelector, { capability: "run", operationKey: "agent.respond" });
  const replay = singleTranscript(await ctx.db.query("runtimeRuns").withIndex("by_request", q => q.eq("tenantId", actor.tenantId)
    .eq("memorySpaceId", actor.memorySpaceId).eq("ownerPrincipalId", actor.principalId).eq("requestIdentityHash", binding.identityHash)).take(2));
  if (replay) {
    if (replay.requestIdentityCanonical !== binding.identityCanonical || replay.requestCanonical !== binding.requestCanonical
      || canonicalModelJson(replay.authorityReference) !== canonicalModelJson(reference)) transcriptDenied("IDEMPOTENCY_CONFLICT");
    await currentRun(ctx, reference, replay.runId, "run");
    if (replay.definitionHash !== definition.definitionHash) transcriptDenied("POLICY_DENIED");
    return publicRun(replay);
  }
  let conversation;
  if (binding.normalized.conversationSelector.kind === "existing") {
    const id = binding.normalized.conversationSelector.conversationId;
    conversation = await conversationById(ctx, reference, id); if (!conversation) transcriptDenied();
    await checkConversation(ctx, reference, conversation, "run"); await checkConversation(ctx, reference, conversation, "write");
  } else {
    // Defaults are resolved solely by the backend; publicv1 cannot add hidden creation options.
    conversation = await createManagedConversation(ctx, actor, binding.identityCanonical, binding.requestCanonical);
  }
  const budget = await bindTrustedBudget(ctx, { reference, operationKey: "agent.respond", requestId: binding.ledgerRequestId,
    requestCanonical: binding.requestCanonical, agentId: definition.agent.agentId, agentVersion: definition.agent.version });
  const runId = `run:${binding.identityHash}`; const sequence = conversation.nextQueueSequence + 1;
  if (!Number.isSafeInteger(sequence)) transcriptDenied("TRANSCRIPT_CONFLICT");
  const saved = await saveMessages(ctx, agentComponent, { threadId: conversation.threadId, userId: actor.principalId,
    order: "next", messages: [{ role: "user", content: binding.normalized.userInput.parts }], failPendingSteps: false });
  await registerMessages(ctx, conversation, reference, saved.messages, { runId, queueSequence: sequence, approved: !conversation.requireApproval, invalidateExecution: false });
  const now = Date.now();
  const id = await ctx.db.insert("runtimeRuns", { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, ownerPrincipalId: actor.principalId,
    runId, conversationId: conversation.conversationId, conversationEpoch: conversation.epoch,
    requestIdentityCanonical: binding.identityCanonical, requestIdentityHash: binding.identityHash, requestCanonical: binding.requestCanonical,
    agentId: definition.agent.agentId, agentVersion: definition.agent.version, definitionHash: definition.definitionHash, authorityReference: reference,
    inputMessageIds: saved.messages.map(message => message._id), queueSequence: sequence, historyRevision: conversation.historyRevision + 1,
    runBudgetId: budget.runBudgetId, runAccountId: budget.runAccountId,
    responseStatus: conversation.requireApproval ? "waiting_approval" : "queued",
    memoryStatus: "pending", graphStatus: definition.definition.context.requiredStages.includes("graph") ? "pending" : "not_requested",
    attemptNumber: 0, outputMessageIds: [], createdAt: now, updatedAt: now });
  await ctx.db.patch("runtimeConversations", conversation._id, { nextQueueSequence: sequence });
  await ctx.db.insert("runtimeRunOutbox", { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, conversationId: conversation.conversationId,
    runId, sequence, state: "pending", leaseVersion: 0, createdAt: now, updatedAt: now });
  // Scheduler insertion is part of this same parent transaction. A failed parent leaves no work or transcript.
  await ctx.scheduler.runAfter(0, recoverRef, { reference, conversationId: conversation.conversationId });
  await recheckAuthority(ctx, reference, { capability: "run", tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId });
  return publicRun((await ctx.db.get("runtimeRuns", id))!);
}
export const submit = mutation({ args: { request: v.any() }, handler: submitHandler });
const runSelector = { runId: v.string(), memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()) };
export const get = query({ args: runSelector, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); return publicRun((await currentControlRun(ctx, dataAuthorityReference(actor), args.runId, "read")).row);
} });
export const list = query({ args: { conversationId: v.string(), memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()),
  afterSequence: v.optional(v.number()), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const { reference } = await requireConversation(ctx, args, args.conversationId, "read");
  const limit = args.limit ?? 100; if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(args.afterSequence ?? 0)) transcriptDenied("INVALID_INPUT");
  const rows = await ctx.db.query("runtimeRuns").withIndex("by_conversation_queue", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("conversationId", args.conversationId).gt("queueSequence", args.afterSequence ?? 0)).take(limit);
  const result = [];
  for (const row of rows) { if (row.tombstonedAt !== undefined) continue; await currentControlRun(ctx, reference, row.runId, "read"); result.push(publicRun(row)); }
  return result;
} });
export const cancel = mutation({ args: runSelector, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); const reference = dataAuthorityReference(actor);
  const { row } = await currentControlRun(ctx, reference, args.runId, "write");
  if (row.responseStatus === "complete" || row.responseStatus === "failed" || row.responseStatus === "cancelled") return publicRun(row);
  const now = Date.now(); await ctx.runMutation(cancelAgentBudgetRef, { reference, runId: row.runId });
  await retireWork(ctx, row, "cancelled", "CANCELLED", now);
  await ctx.scheduler.runAfter(0, recoverOwnedRef, { reference, conversationId: row.conversationId });
  return publicRun((await ctx.db.get("runtimeRuns", row._id))!);
} });
export const approve = mutation({ args: { ...runSelector, expectedDefinitionHash: v.string() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "admin"); const reference = dataAuthorityReference(actor);
  const { row, conversation } = await currentRun(ctx, reference, args.runId, "write"); await checkConversation(ctx, reference, conversation, "admin");
  if (row.definitionHash !== args.expectedDefinitionHash) transcriptDenied("POLICY_DENIED");
  if (row.responseStatus === "waiting_approval" && row.attemptNumber > 0) transcriptDenied("USE_TOOL_APPROVAL");
  if (row.responseStatus !== "waiting_approval") { if (row.approvedAt !== undefined) return publicRun(row); transcriptDenied("INVALID_STATE"); }
  for (const id of row.inputMessageIds) {
    const bridge = await bridgeFor(ctx, conversation, id); if (!bridge || bridge.runId !== row.runId || bridge.tombstonedAt !== undefined) transcriptDenied("STALE_TRANSCRIPT");
    // Waiting inputs cannot belong to an already claimed prefix. Their own approval/revision pins
    // remain mandatory at claim/hydration without invalidating an unrelated earlier active run.
    await approveRegisteredMessage(ctx, conversation, bridge, reference, { invalidateExecution: false });
  }
  await ctx.db.patch("runtimeRuns", row._id, { responseStatus: "queued", approvedAt: Date.now(), approvalActor: reference, updatedAt: Date.now() });
  await ctx.scheduler.runAfter(0, recoverRef, { reference: row.authorityReference, conversationId: row.conversationId }); return publicRun((await ctx.db.get("runtimeRuns", row._id))!);
} });
async function outboxFor(ctx: Pick<QueryCtx, "db">, row: Doc<"runtimeRuns">) {
  const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", row.tenantId)
    .eq("memorySpaceId", row.memorySpaceId).eq("runId", row.runId)).take(2));
  if (!outbox) transcriptDenied("INVALID_STATE"); return outbox;
}
async function retireWork(ctx: MutationCtx, row: Doc<"runtimeRuns">, status: "cancelled" | "failed", failureCode: string, now: number) {
  await ctx.db.patch("runtimeRuns", row._id, { responseStatus: status, failureCode,
    ...(status === "cancelled" ? { cancellationRequestedAt: now, cancelledAt: now } : {}), updatedAt: now });
  const outbox = await outboxFor(ctx, row);
  await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "complete", updatedAt: now });
  if (row.attemptNumber) {
    const attempt = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", row.tenantId)
      .eq("memorySpaceId", row.memorySpaceId).eq("runId", row.runId).eq("attemptNumber", row.attemptNumber)).take(2));
    if (attempt?.status === "running") await ctx.db.patch("runtimeRunAttempts", attempt._id, { status, failureCode, endedAt: now });
  }
}
/** Constant-sized index probes exclude retained terminal history. Reconciliation is bounded per mutation. */
async function queueHead(ctx: Pick<QueryCtx, "db">, conversation: Doc<"runtimeConversations">) {
  const candidates = await Promise.all((["queued", "running", "waiting_approval"] as const).map(async status =>
    (await ctx.db.query("runtimeRuns").withIndex("by_conversation_status", q => q.eq("tenantId", conversation.tenantId)
      .eq("memorySpaceId", conversation.memorySpaceId).eq("conversationId", conversation.conversationId)
      .eq("responseStatus", status)).take(1))[0]));
  return candidates.filter((row): row is Doc<"runtimeRuns"> => row !== undefined).sort((a, b) => a.queueSequence - b.queueSequence)[0];
}
/** Recovery never retries potentially paid work. Accepted/pending work remains durably claimable. */
export const recoverQueue = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string() }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) transcriptDenied();
  await checkConversation(ctx, args.reference, conversation, "run");
  return await recoverCurrentQueue(ctx, args, conversation, recoverRef);
} });
/** Owned expiry cleanup may outlive its caller grant. Each pending row's own
 * authority is still checked before it can be dispatched; this never retries
 * the retired attempt or authorizes inference under the expired reference. */
export const recoverOwnedQueue = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string() }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) return { readyRunId: null };
  return await recoverCurrentQueue(ctx, args, conversation, recoverOwnedRef);
} });
async function recoverCurrentQueue(ctx: MutationCtx, args: { reference: RuntimeAuthorityReference; conversationId: string }, conversation: Doc<"runtimeConversations">,
  continuation: typeof recoverRef): Promise<{ readyRunId: string | null }> {
  for (let reconciled = 0; reconciled < 20; reconciled++) {
    const row = await queueHead(ctx, conversation); if (!row) return { readyRunId: null };
    try { await currentRun(ctx, row.authorityReference, row.runId, "run"); }
    catch (error) {
      if (!(error instanceof ConvexError) || !["FORBIDDEN", "POLICY_DENIED", "CAPABILITY_UNAVAILABLE"].includes(error.data.code as string)) throw error;
      await retireWork(ctx, row, "cancelled", "AUTHORITY_CHANGED", Date.now()); continue;
    }
    if (row.responseStatus === "running" || row.responseStatus === "waiting_approval" && row.attemptNumber > 0) {
      const outbox = await outboxFor(ctx, row);
      if (outbox.leaseExpiresAt !== undefined && Date.now() >= outbox.leaseExpiresAt) {
        if (row.responseStatus === "waiting_approval") {
          await ctx.runMutation(internalMutationRef<{ reference: RuntimeAuthorityReference; runId: string; attemptNumber: number; leaseVersion: number; leaseExpiresAt: number }, null>("runtimeAgent:expireApproval"),
            { reference: row.authorityReference, runId: row.runId, attemptNumber: row.attemptNumber, leaseVersion: outbox.leaseVersion, leaseExpiresAt: outbox.leaseExpiresAt });
          continue;
        }
        await ctx.runMutation(cancelBudgetRef, { reference: row.authorityReference, runBudgetId: row.runBudgetId });
        await retireWork(ctx, row, "failed", "LEASE_EXPIRED_REQUIRES_RECONCILIATION", Date.now());
        continue; // No paid retry or release of ambiguous model liability.
      }
    }
    if (row.responseStatus !== "queued") return { readyRunId: null };
    const outbox = await outboxFor(ctx, row);
    if (outbox.state === "pending") await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "ready", updatedAt: Date.now() });
    if (row.executionRequested) await ctx.scheduler.runAfter(0, internalMutationRef<{ reference: RuntimeAuthorityReference; runId: string }, unknown>("runtimeAgent:dispatchReady"),
      { reference: row.authorityReference, runId: row.runId });
    return { readyRunId: row.runId };
  }
  await ctx.scheduler.runAfter(0, continuation, args);
  return { readyRunId: null };
}
export const claimNext = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string(), leaseMs: v.optional(v.number()) }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) transcriptDenied();
  await checkConversation(ctx, args.reference, conversation, "run");
  const row = await queueHead(ctx, conversation);
  if (!row || row.responseStatus !== "queued") return null;
  if (canonicalModelJson(args.reference) !== canonicalModelJson(row.authorityReference)) transcriptDenied();
  const { definition } = await currentRun(ctx, args.reference, row.runId, "run");
  const snapshot = await captureCutoff(ctx, conversation, row, definition.definition.context.requiredStages, definition.definition.context.maxContextTokens);
  if (snapshot.completeness !== "complete") {
    await ctx.runMutation(cancelBudgetRef, { reference: row.authorityReference, runBudgetId: row.runBudgetId });
    await retireWork(ctx, row, "failed", "CONTEXT_LIMIT_EXCEEDED", Date.now());
    await ctx.scheduler.runAfter(0, recoverRef, { reference: row.authorityReference, conversationId: row.conversationId });
    return { runId: row.runId, failureCode: "CONTEXT_LIMIT_EXCEEDED" as const };
  }
  const leaseMs = args.leaseMs ?? 60_000; if (!Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300_000) transcriptDenied("INVALID_INPUT");
  const outbox = await outboxFor(ctx, row); if (outbox.state !== "pending" && outbox.state !== "ready") transcriptDenied("INVALID_STATE");
  const attempt = row.attemptNumber + 1; const leaseVersion = outbox.leaseVersion + 1; const now = Date.now();
  await ctx.db.patch("runtimeRuns", row._id, { responseStatus: "running", attemptNumber: attempt, snapshotCanonical: canonicalModelJson(snapshot), historyRevision: executionRevision(conversation), updatedAt: now });
  await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "claimed", leaseVersion, leaseExpiresAt: now + leaseMs, updatedAt: now });
  await ctx.db.insert("runtimeRunAttempts", { tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, runId: row.runId,
    attemptNumber: attempt, leaseVersion, historyRevision: executionRevision(conversation), status: "running", startedAt: now });
  return { runId: row.runId, attemptNumber: attempt, leaseVersion, runBudgetId: row.runBudgetId, snapshot };
} });
const attemptArgs = { reference: runtimeAuthorityReference, runId: v.string(), attemptNumber: v.number(), leaseVersion: v.number() };
export async function activeAttempt(ctx: Pick<QueryCtx, "db">, args: { reference: RuntimeAuthorityReference; runId: string; attemptNumber: number; leaseVersion: number }) {
  const current = await currentRun(ctx, args.reference, args.runId, "run"); const row = current.row;
  if (row.responseStatus !== "running" || row.cancellationRequestedAt !== undefined || row.attemptNumber !== args.attemptNumber
    || canonicalModelJson(row.authorityReference) !== canonicalModelJson(args.reference)) transcriptDenied("INVALID_STATE");
  const outbox = await outboxFor(ctx, row);
  if (outbox.state !== "claimed" || outbox.leaseVersion !== args.leaseVersion || outbox.leaseExpiresAt === undefined || Date.now() >= outbox.leaseExpiresAt) transcriptDenied("LEASE_EXPIRED");
  const attempt = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", row.tenantId)
    .eq("memorySpaceId", row.memorySpaceId).eq("runId", row.runId).eq("attemptNumber", args.attemptNumber)).take(2));
  if (!attempt || attempt.status !== "running" || attempt.leaseVersion !== args.leaseVersion) transcriptDenied("INVALID_STATE");
  return { ...current, outbox, attempt };
}
export const hydrate = internalQuery({ args: attemptArgs, handler: async (ctx, args) => {
  const { row, conversation } = await activeAttempt(ctx, args); if (!row.snapshotCanonical) transcriptDenied("STALE_TRANSCRIPT");
  const snapshot = JSON.parse(row.snapshotCanonical) as CutoffV1;
  return { messages: await hydrateCutoff(ctx, conversation, row, snapshot), runBudgetId: row.runBudgetId, inputMessageIds: row.inputMessageIds };
} });
export const complete = internalMutation({ args: { ...attemptArgs, outputMessageIds: v.array(v.string()) }, handler: async (ctx, args) => {
  const { row, conversation, outbox, attempt } = await activeAttempt(ctx, args);
  if (!row.snapshotCanonical) transcriptDenied("STALE_TRANSCRIPT"); const snapshot = JSON.parse(row.snapshotCanonical) as CutoffV1;
  await hydrateCutoff(ctx, conversation, row, snapshot);
  if (!args.outputMessageIds.length || args.outputMessageIds.length > 1000 || new Set(args.outputMessageIds).size !== args.outputMessageIds.length) transcriptDenied("INVALID_INPUT");
  const outputs = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: args.outputMessageIds });
  const messages = outputs.map(message => {
    if (!message || message.threadId !== conversation.threadId || message.status !== "success" || message.message?.role !== "assistant"
      || message.order !== snapshot.anchor.order || comparePosition(message, snapshot.anchor) <= 0) transcriptDenied("STALE_TRANSCRIPT");
    return message;
  });
  await registerMessages(ctx, conversation, row.authorityReference, messages, { runId: row.runId, attemptNumber: row.attemptNumber });
  const now = Date.now(); await ctx.db.patch("runtimeRuns", row._id, { responseStatus: "complete", outputMessageIds: args.outputMessageIds, updatedAt: now });
  await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "complete", updatedAt: now });
  await ctx.db.patch("runtimeRunAttempts", attempt._id, { status: "complete", endedAt: now });
  await ctx.scheduler.runAfter(0, recoverRef, { reference: row.authorityReference, conversationId: row.conversationId }); return publicRun((await ctx.db.get("runtimeRuns", row._id))!);
} });
export const fail = internalMutation({ args: { ...attemptArgs, failureCode: v.union(v.literal("MODEL_FAILED"), v.literal("CANCELLED"), v.literal("CONTEXT_STALE")) }, handler: async (ctx, args) => {
  const { row, outbox, attempt } = await activeAttempt(ctx, args); const now = Date.now();
  await ctx.db.patch("runtimeRuns", row._id, { responseStatus: "failed", failureCode: args.failureCode, updatedAt: now });
  await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "complete", updatedAt: now });
  await ctx.db.patch("runtimeRunAttempts", attempt._id, { status: "failed", failureCode: args.failureCode, endedAt: now });
  await ctx.scheduler.runAfter(0, recoverRef, { reference: row.authorityReference, conversationId: row.conversationId }); return { recorded: true as const };
} });
export const attempts = query({ args: runSelector, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const { row } = await currentControlRun(ctx, dataAuthorityReference(actor), args.runId, "read");
  return (await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", row.tenantId).eq("memorySpaceId", row.memorySpaceId).eq("runId", row.runId)).collect())
    .map(attempt => ({ attemptNumber: attempt.attemptNumber, status: attempt.status, startedAt: attempt.startedAt, endedAt: attempt.endedAt ?? null, failureCode: attempt.failureCode ?? null }));
} });
export const setStages = internalMutation({ args: { reference: runtimeAuthorityReference, runId: v.string(), memoryStatus: stageStatus, graphStatus: stageStatus }, handler: async (ctx, args) => {
  const { row } = await currentRun(ctx, args.reference, args.runId, "run");
  if (row.responseStatus !== "complete" || row.cancellationRequestedAt !== undefined || row.memoryStatus === "complete" && args.memoryStatus !== "complete"
    || row.graphStatus === "complete" && args.graphStatus !== "complete") transcriptDenied("INVALID_STATE");
  await ctx.db.patch("runtimeRuns", row._id, { memoryStatus: args.memoryStatus, graphStatus: args.graphStatus, updatedAt: Date.now() }); return { updated: true as const };
} });
export const exportRecord = get;
export const remove = mutation({ args: runSelector, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); const reference = dataAuthorityReference(actor);
  const { row, conversation } = await currentControlRun(ctx, reference, args.runId, "write");
  if (conversation.manualWriteLocked) transcriptDenied("TRANSCRIPT_LOCKED");
  await ctx.runMutation(cancelAgentBudgetRef, { reference, runId: row.runId });
  const now = Date.now(); await retireWork(ctx, row, "cancelled", "RUN_DELETED", now);
  await ctx.db.patch("runtimeRuns", row._id, { tombstonedAt: now });
  await ctx.scheduler.runAfter(0, recoverOwnedRef, { reference, conversationId: row.conversationId });
  return { deleted: true as const };
} });
