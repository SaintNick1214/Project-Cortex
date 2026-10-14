import { checkArtifactContextWitnesses } from "./runtimeArtifactContext";
import { artifactContextWitness } from "./runtimeArtifactContextSchema";
import type { ArtifactContextWitness } from "../src/domain/artifact-context";
import { checkMediaJob } from "./runtimeMediaFence";
/** Durable backend turns. Workflow journals steps; Agent alone owns canonical messages. */
import { Agent, saveMessages, abortStream } from "@convex-dev/agent";
import type { MessageDoc } from "@convex-dev/agent";
import { WorkflowManager } from "@convex-dev/workflow";
import type { WorkflowId } from "@convex-dev/workflow";
import { createFunctionHandle, makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { isStepCount } from "ai";
import type { ModelMessage } from "ai";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { CutoffV1 } from "../src/domain/transcript";
import type { ContextSourcePermission, ContextSourceWitness } from "../src/domain/context-witness";
import { mergeContextWitness } from "../src/domain/context-witness";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { comparePosition, utf8Bytes } from "../src/domain/transcript";
import { contextSourceKey, evaluateMemoryBarrier } from "../src/domain/memory-context";
import { mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { agentAttempt, sourceWitness } from "./runtimeAgentSchema";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { currentRun, currentControlRun, activeAttempt, publicRun } from "./runs";
import { agentComponent, canonicalMessageHash, checkConversation, conversationById, hydratePrivateCutoff, privateModelMessage, registerMessages, singleTranscript, transcriptDenied, checkNativeMediaReferences } from "./runtimeTranscript";
import { dataAuthorityReference, requireDataAuthority, managedConversationAccess } from "./runtimeDataAuth";
import { deliveryExpiresAt } from "./runtimeDelivery";
import { recheckAuthority, createAuthorityReadScope, freshNativeTranscriptReads, freshPolicyMetadataReads } from "./runtimeAuth";
import { createBackendGatewayComposition } from "./runtimeGatewayBackend";
import type { GatewayAdmissionCheckpoint, GatewayLedgerPort } from "./runtimeGateway";
import { admitHandler, checkpointHandler, resolveHandler, MODEL_LEDGER_STORAGE_LIMITS } from "./runtimeModelPolicy";
import { createAgentGatewayCancellationBridge, createGovernedGatewayModel, assertGatewayReservedRequest, GatewayDispatchError } from "./runtimeGateway";
import { createActionMemoryRepository } from "./runtimeMemoryRepository";
import { ConvexMemoryRepository, memoryScope } from "./runtimeMemoryRepository";
import { sourceContent, commitDerivedInput } from "./runtimeMemorySchema";
import { contextSourcePermission } from "./runtimeContextWitnessSchema";
import { registerCompletedToolSource } from "./runtimeIngestion";
import { contextBoundary, readIndexedContextAvailability, readIndexedSourceAtCutoff, readPendingContext, readStageProgress, refreshScopeWatermarks } from "./runtimeMemoryContext";
import type { ContextBoundary } from "./runtimeMemoryContext";
import { traceRuntimePhase } from "./runtimeLatencyTrace";
import { createGatewayMemoryModel } from "./runtimeMemoryGateway";
import { recallMemory } from "./runtimeMemoryServices";
import { executeServerTool, NATIVE_TOOL_NAMES, semanticToolName, serverTools, serverToolSourceLineage, validateToolInput } from "./runtimeAgentTools";
import { projectNativeOutputParts } from "./runtimeOutputProjection";
import type { RuntimePublicOutputPart } from "./runtimeOutputProjection";

type Attempt = { reference: RuntimeAuthorityReference; runId: string; attemptNumber: number; leaseVersion: number };
type ToolCall = { toolCallId: string; toolName: string; inputCanonical: string };
type StepResult = { savedMessageIds: string[]; calls: ToolCall[]; final: boolean };
type WorkflowCompletion = { workflowId: string; context: Attempt; result: { kind: "success"; returnValue: null } | { kind: "failed"; error: string } | { kind: "canceled" } };
type Witness = ContextSourceWitness;
type ContextSourceArgs = { reference: RuntimeAuthorityReference; sourceId: string;
  expected: { sourceEventId: string; sourceRevision: number; contentHash?: string }; excludedSourceKeys: string[]; cutoff: number; boundary: ContextBoundary };
type ContextSourceBatchArgs = Omit<ContextSourceArgs, "sourceId" | "expected"> & {
  items: Pick<ContextSourceArgs, "sourceId" | "expected">[]; permission: ContextSourcePermission;
  witnesses: Witness[]; priorWitnesses: Witness[];
};
function attemptArgs(args: Attempt): Attempt { return { reference: args.reference, runId: args.runId, attemptNumber: args.attemptNumber, leaseVersion: args.leaseVersion }; }
export type AgentPublicPart = RuntimePublicOutputPart | { type: "status"; state: Doc<"runtimeAgentExecutions">["state"] }
  | { type: "artifact"; artifactId: string; kind: "memory-receipt" } | { type: "media-job"; version: 1; jobId: string; artifactId: string; kind: "image" | "video" };
function ref<Type extends "mutation" | "query" | "action", Args extends Record<string, unknown>, Result>(type: Type, name: string) {
  void type;
  return makeFunctionReference<Type, Args, Result>(name) as unknown as FunctionReference<Type, "internal", Args, Result>;
}
const workflowComponent = (components as unknown as { workflow: ConstructorParameters<typeof WorkflowManager>[0] }).workflow;
const workflow = new WorkflowManager(workflowComponent, { workpoolOptions: { maxParallelism: 4 } });
const freshWorkflow = ref<"mutation", { args: Attempt }, string>("mutation", "runtimeAgent:executeTurnV5");
const freshWorkflowComplete = ref<"mutation", WorkflowCompletion, null>("mutation", "runtimeAgent:onInitialWorkflowComplete");
const refs = {
  claim: ref<"mutation", { reference: RuntimeAuthorityReference; conversationId: string; leaseMs: number }, { runId: string; attemptNumber: number; leaseVersion: number } | { runId: string; failureCode: string } | null>("mutation", "runs:claimNext"),
  hydrate: ref<"query", Attempt, Awaited<ReturnType<typeof executionContext>>>("query", "runtimeAgent:hydrateExecution"),
  resolveModelOperation: ref<"query", Attempt & { runBudgetId: string }, Awaited<ReturnType<typeof resolveModelOperationHandler>>>("query", "runtimeAgent:resolveModelOperation"),
  admitModelOperation: ref<"mutation", Attempt & { operationId: string; ordinal: number; requestCanonical: string; snapshotCanonical: string }, Awaited<ReturnType<typeof admitModelOperationHandler>>>("mutation", "runtimeAgent:admitModelOperation"),
  prepareModelOperation: ref<"mutation", Attempt & { ordinal: number }, Awaited<ReturnType<typeof prepareModelOperationHandler>>>("mutation", "runtimeAgent:prepareModelOperation"),
  prepareTurnModel: ref<"mutation", Attempt, Awaited<ReturnType<typeof prepareTurnModelHandler>>>("mutation", "runtimeAgent:prepareTurnModel"),
  prepareResolvedModelOperation: ref<"mutation", Attempt & { ordinal: number }, Awaited<ReturnType<typeof prepareResolvedModelOperationHandler>>>("mutation", "runtimeAgent:prepareResolvedModelOperation"),
  admitPreparedModelOperation: ref<"mutation", Attempt & { operationId: string; ordinal: number; requestCanonical: string; snapshotCanonical: string; bindingCanonical: string }, GatewayAdmissionCheckpoint>("mutation", "runtimeAgent:admitPreparedModelOperation"),
  turn: ref<"action", Attempt & { ordinal: number }, StepResult>("action", "runtimeAgent:turnStepV5"),
  contextInputs: ref<"query", Attempt, Awaited<ReturnType<typeof contextInputsHandler>>>("query", "runtimeAgent:contextInputs"),
  contextSource: ref<"query", ContextSourceArgs, Awaited<ReturnType<typeof contextSourceHandler>>>("query", "runtimeAgent:contextSource"),
  contextSourceBatch: ref<"query", ContextSourceBatchArgs, Awaited<ReturnType<typeof contextSourceBatchHandler>>>("query", "runtimeAgent:contextSourceBatch"),
  prepareContext: ref<"action", Attempt, null>("action", "runtimeAgent:prepareContext"),
  context: ref<"mutation", Attempt & { context: string; witnesses: Witness[]; completeness: "complete" | "incomplete"; failureCode?: string; emptyIndexedProfileId?: string }, null>("mutation", "runtimeAgent:saveContext"),
  begin: ref<"mutation", Attempt & { kind: "model" | "tool"; ordinal: number; requestCanonical: string; toolCallId?: string; toolName?: string },
    { operationId: string; semanticId: string; state: string; resultCanonical: string | null; nativeMessageIds: string[] }>("mutation", "runtimeAgent:beginOperation"),
  finish: ref<"mutation", Attempt & { operationId: string; resultCanonical: string; nativeMessageIds: string[] }, null>("mutation", "runtimeAgent:finishOperation"),
  output: ref<"mutation", Attempt & { parts: unknown[] }, null>("mutation", "runtimeAgent:recordOutput"),
  model: ref<"action", Attempt & { ordinal: number }, StepResult>("action", "runtimeAgent:modelStep"),
  tool: ref<"action", Attempt & { ordinal: number; call: ToolCall }, null>("action", "runtimeAgent:toolStep"),
  waiting: ref<"mutation", Attempt & { operationId: string }, null>("mutation", "runtimeAgent:waitForApproval"),
  finalize: ref<"mutation", Attempt & { finalMessageIds: string[] }, { receiptId: string }>("mutation", "runtimeAgent:finalize"),
  end: ref<"mutation", Attempt & { cancelled: boolean }, null>("mutation", "runtimeAgent:endInterrupted"),
};
function attemptName(args: Attempt, ordinal: number): string { return `cortex:${args.runId}:${args.attemptNumber}:${ordinal}`; }
async function execution(ctx: Pick<QueryCtx, "db">, args: Attempt) {
  const row = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("runId", args.runId).eq("attemptNumber", args.attemptNumber)).take(2));
  if (!row || row.leaseVersion !== args.leaseVersion || canonicalModelJson(row.reference) !== canonicalModelJson(args.reference)) transcriptDenied();
  return row;
}
async function operation(ctx: Pick<QueryCtx, "db">, args: Attempt, operationId: string) {
  const row = singleTranscript(await ctx.db.query("runtimeAgentOperations").withIndex("by_operation", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("operationId", operationId)).take(2));
  if (!row || row.runId !== args.runId || row.attemptNumber !== args.attemptNumber) transcriptDenied();
  return row;
}
type ExecutionMediaPart = Extract<AgentPublicPart, { type: "media-job" }>;
async function executionMediaReferences(ctx: Pick<QueryCtx, "db">, owned: Doc<"runtimeAgentExecutions">): Promise<ExecutionMediaPart[]> {
  if (owned.mediaJobReferences !== undefined) return owned.mediaJobReferences;
  // Compatibility for executions written before the durable witness field.
  // The existing output contract bounds an attempt to 10,000 records; new
  // executions use the small metadata witness and never scan stream text.
  const rows = await ctx.db.query("runtimeAgentOutput").withIndex("by_sequence", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId).eq("attemptNumber", owned.attemptNumber)).take(10_001);
  if (rows.length > 10_000) transcriptDenied("OUTPUT_LIMIT_EXCEEDED");
  const references = new Map<string, ExecutionMediaPart>();
  for (const row of rows) {
    const part = JSON.parse(row.partCanonical) as AgentPublicPart;
    if (part.type === "media-job") references.set(canonicalModelJson(part), part);
  }
  if (references.size > 32) transcriptDenied("OUTPUT_LIMIT_EXCEEDED");
  return [...references.values()];
}
async function writeParts(ctx: MutationCtx, owned: Doc<"runtimeAgentExecutions">, parts: AgentPublicPart[], final = false) {
  let sequence = owned.nextOutputSequence;
  const media = new Map((await executionMediaReferences(ctx, owned)).map(part => [canonicalModelJson(part), part]));
  for (const part of parts) {
    if (part.type === "media-job") { media.set(canonicalModelJson(part), part); if (media.size > 32) transcriptDenied("OUTPUT_LIMIT_EXCEEDED"); }
    const partCanonical = canonicalModelJson(part); if (utf8Bytes(partCanonical) > 16_384 || ++sequence > 10_000) transcriptDenied("OUTPUT_LIMIT_EXCEEDED");
    await ctx.db.insert("runtimeAgentOutput", { tenantId: owned.tenantId, memorySpaceId: owned.memorySpaceId, runId: owned.runId,
      attemptNumber: owned.attemptNumber, sequence, partCanonical, final, createdAt: Date.now() });
  }
  await ctx.db.patch("runtimeAgentExecutions", owned._id, { nextOutputSequence: sequence, mediaJobReferences: [...media.values()] });
}
async function checkWitnesses(ctx: Pick<QueryCtx, "db" | "runQuery">, args: Attempt, witnesses: Witness[]) {
  await checkContextSourceWitnesses(ctx, args.reference, witnesses);
}
async function executionContext(ctx: Pick<QueryCtx, "db" | "runQuery">, args: Attempt, reconcile = false) {
  const current = reconcile ? await currentRun(ctx, args.reference, args.runId, "run") : await activeAttempt(ctx, args);
  const { row, conversation, definition } = current; const owned = await execution(ctx, args);
  if (row.attemptNumber !== args.attemptNumber || row.cancellationRequestedAt !== undefined || row.responseStatus === "cancelled"
    || (!reconcile && ["failed", "cancelled", "unknown"].includes(owned.state)) || !row.snapshotCanonical) transcriptDenied("INVALID_STATE");
  const snapshot = JSON.parse(row.snapshotCanonical) as CutoffV1;
  const messages = await hydratePrivateCutoff(ctx, conversation, row, snapshot);
  await checkWitnesses(ctx, args, owned.sourceWitnesses);
  await checkArtifactContextWitnesses(ctx, args.reference, owned.artifactContextWitnesses ?? []);
  const currentMessages: ModelMessage[] = [];
  for (let i = 0; i < owned.savedMessageIds.length; i += 100) {
    const saved = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: owned.savedMessageIds.slice(i, i + 100) });
    if (saved.length !== owned.savedMessageIds.slice(i, i + 100).length) transcriptDenied("STALE_TRANSCRIPT");
    for (let index = 0; index < saved.length; index++) {
      const message = saved[index]; const pin = owned.savedMessagePins?.find(item => item.id === owned.savedMessageIds[i + index]);
      if (!message || message.status !== "success" || message.threadId !== conversation.threadId
        || message._id !== owned.savedMessageIds[i + index] || !pin || pin.order !== message.order || pin.stepOrder !== message.stepOrder || pin.canonicalContentHash !== await canonicalMessageHash(message)
        || message.order !== snapshot.anchor.order || comparePosition(message, snapshot.anchor) <= 0) transcriptDenied("STALE_TRANSCRIPT");
      await checkNativeMediaReferences(ctx, args.reference, message);
      currentMessages.push(privateModelMessage(message));
    }
  }
  return { run: row, threadId: conversation.threadId, snapshot, definition: definition.definition, execution: owned,
    messages: [...messages, ...currentMessages] };
}
export const hydrateExecution = internalQuery({ args: agentAttempt, handler: async (ctx, args) => await executionContext(ctx, args) });
/** Agent hydration precedes the unchanged policy body in one fresh native read snapshot. */
async function resolveModelOperationHandler(ctx: QueryCtx, args: Attempt & { runBudgetId: string }) {
  const current = await executionContext(ctx, attemptArgs(args));
  if (args.runBudgetId !== current.run.runBudgetId) transcriptDenied("POLICY_DENIED");
  return await resolveHandler(ctx, { reference: args.reference, operationKey: "agent.respond", runBudgetId: current.run.runBudgetId });
}
export const resolveModelOperation = internalQuery({ args: { ...agentAttempt, runBudgetId: v.string() }, handler: (ctx, args) => resolveModelOperationHandler(createAuthorityReadScope(ctx), args) });
async function contextInputsHandler(ctx: Pick<QueryCtx, "db" | "runQuery">, args: Attempt) {
  const current = await executionContext(ctx, args);
  if (current.execution.contextState !== "started") transcriptDenied("INVALID_STATE");
  const scope = { tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId! };
  const cutoff = current.snapshot.ingestionCutoff.sequence;
  const boundary = { conversationId: current.snapshot.conversationId, runId: args.runId, queueSequence: current.snapshot.queueSequence,
    anchor: { order: current.snapshot.anchor.order, stepOrder: current.snapshot.anchor.stepOrder } };
  const represented = current.snapshot.messages.map(pin => contextSourceKey(scope, { ...pin, sourceId: pin.sourceEventId }));
  const pending = await readPendingContext(ctx, { reference: args.reference, cutoff, alreadyRepresented: represented,
    maxBytes: Math.min(16_384, current.definition.context.maxContextTokens), boundary, runBudgetId: current.run.runBudgetId });
  const inputs = { current, scope, boundary, represented, pending };
  const barrier = current.definition.context.barrier ?? { deadlineMs: 30_000, onFailure: "fail" as const };
  // Keep the action's durable failContext mutation before any availability/profile error.
  if (pending.completeness === "incomplete" && barrier.onFailure === "fail") return { ...inputs, kind: "pending_overflow" as const };
  traceRuntimePhase(args.runId, args.attemptNumber, "context.indexed-probe.begin");
  const availability = await readIndexedContextAvailability(ctx, { reference: args.reference, cutoff,
    excludedSourceKeys: [...new Set([...represented, ...pending.sourceKeys])], boundary, runBudgetId: current.run.runBudgetId });
  traceRuntimePhase(args.runId, args.attemptNumber, "context.indexed-probe.end");
  return { ...inputs, kind: "ready" as const, availability };
}
export const contextInputs = internalQuery({ args: agentAttempt, handler: (ctx, args) => contextInputsHandler(createAuthorityReadScope(ctx), args) });
export const checkToolAuthority = internalQuery({ args: { reference: runtimeAuthorityReference, toolName: v.string() }, handler: async (ctx, args) => {
  if (!Object.prototype.hasOwnProperty.call(NATIVE_TOOL_NAMES, args.toolName)) transcriptDenied("TOOL_DENIED");
  await recheckAuthority(ctx, args.reference, { capability: "tool", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  await recheckAuthority(ctx, args.reference, { capability: args.toolName === "memory.remember" || args.toolName.startsWith("media.") ? "write" : "read", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  return null;
} });
const selector = { runId: v.string(), memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()) };
/** Start is atomic with one claim and Workflow insertion. The public request cannot choose models/tools/context. */
export async function startHandler(ctx: MutationCtx, args: { runId: string; memorySpaceId?: string; tenantId?: string; streaming?: boolean }) {
  const actor = await requireDataAuthority(ctx, args, "run"); const reference = dataAuthorityReference(actor);
  const current = await currentRun(ctx, reference, args.runId, "run");
  if (canonicalModelJson(reference) !== canonicalModelJson(current.row.authorityReference)) transcriptDenied();
  if (current.row.executionRequested && current.row.streamingRequested !== (args.streaming ?? true)) transcriptDenied("IDEMPOTENCY_CONFLICT");
  await ctx.db.patch("runtimeRuns", current.row._id, { executionRequested: true, streamingRequested: args.streaming ?? true });
  return await startExecution(ctx, reference, current.row, args.streaming ?? true);
}
export const start = mutation({ args: { ...selector, streaming: v.optional(v.boolean()) }, handler: startHandler });
async function startExecution(ctx: MutationCtx, reference: RuntimeAuthorityReference, row: Doc<"runtimeRuns">, streaming: boolean) {
  const old = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("runId", row.runId).eq("attemptNumber", row.attemptNumber)).take(2));
  if (old) return { runId: row.runId, attemptNumber: old.attemptNumber, state: old.state };
  traceRuntimePhase(row.runId, row.attemptNumber, "claim.begin");
  const claimed = await ctx.runMutation(refs.claim, { reference, conversationId: row.conversationId, leaseMs: 300_000 });
  traceRuntimePhase(row.runId, claimed && "attemptNumber" in claimed ? claimed.attemptNumber : row.attemptNumber, "claim.end");
  if (!claimed) return { runId: row.runId, attemptNumber: row.attemptNumber, state: "queued" as const };
  // claimNext checks the indexed head. A future request must never start another run under its identity.
  if (claimed.runId !== row.runId) transcriptDenied("QUEUE_NOT_READY");
  // claimNext durably retires an undispatchable oversized prefix. Do not throw
  // from this parent and roll that supported terminal disposition back.
  if ("failureCode" in claimed) return { runId: row.runId, attemptNumber: row.attemptNumber, state: "failed" as const, failureCode: claimed.failureCode };
  if (!claimed.attemptNumber) transcriptDenied("QUEUE_NOT_READY");
  const attempt = { reference, runId: row.runId, attemptNumber: claimed.attemptNumber, leaseVersion: claimed.leaseVersion };
  const now = Date.now();
  const id = await ctx.db.insert("runtimeAgentExecutions", { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId!, ...attempt,
    state: "ready", streaming, nextOutputSequence: 0, nextModelStep: 0, toolCount: 0,
    sourceWitnesses: [], mediaJobReferences: [], savedMessageIds: [], savedMessagePins: [], createdAt: now, updatedAt: now });
  const workflowId = await workflow.start(ctx, freshWorkflow, attempt,
    { startAsync: false, onComplete: freshWorkflowComplete, context: attempt });
  const started = await ctx.db.get("runtimeAgentExecutions", id);
  if (!started || started.workflowId !== undefined && started.workflowId !== workflowId) transcriptDenied();
  await ctx.db.patch("runtimeAgentExecutions", id, { workflowId });
  return { runId: row.runId, attemptNumber: claimed.attemptNumber, state: started.state };
}
export const dispatchReady = internalMutation({ args: { reference: runtimeAuthorityReference, runId: v.string() }, handler: async (ctx, args) => {
  const current = await currentRun(ctx, args.reference, args.runId, "run");
  if (!current.row.executionRequested || current.row.responseStatus !== "queued") return null;
  await startExecution(ctx, args.reference, current.row, current.row.streamingRequested ?? true); return null;
} });
export const executeTurn = workflow.define({ args: agentAttempt, returns: v.null(), handler: async (step, args) => {
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.begin");
  await step.runMutation(ref<"mutation", Attempt, null>("mutation", "runtimeAgent:startContext"), args, { inline: true });
  for (;;) {
    const decision = await step.runMutation(ref<"mutation", Attempt, ReturnType<typeof evaluateMemoryBarrier>>("mutation", "runtimeAgent:contextBarrier"), args, { inline: true });
    if (decision.state === "failed") {
      await step.runMutation(ref<"mutation", Attempt & { failureCode: string }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: decision.failureCode! });
      throw new Error(decision.failureCode);
    }
    if (decision.state !== "waiting") break;
    await step.sleep(Math.min(1000, decision.remainingMs), { name: "memory stage barrier" });
  }
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.end");
  traceRuntimePhase(args.runId, args.attemptNumber, "context.begin");
  await step.runAction(refs.prepareContext, args, { retry: false, name: "authorized Cortex context" });
  traceRuntimePhase(args.runId, args.attemptNumber, "context.end");
  for (let ordinal = 0; ordinal < 33; ordinal++) {
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.begin`);
    const result = await step.runAction(refs.model, { ...args, ordinal }, { retry: false, name: `model ${ordinal}` });
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.end`);
    if (result.final) {
      await step.runMutation(refs.finalize, { ...args, finalMessageIds: result.savedMessageIds });
      // Canonical answer/ingestion commits before optional work. The content
      // Workflow retains the original parent/account and runs independently.
      try {
        traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.begin");
        await step.runMutation(ref<"mutation", { reference: RuntimeAuthorityReference; runId: string }, string | null>("mutation", "runtimeContentJobs:enqueueParentTitle"), { reference: args.reference, runId: args.runId });
      } catch { /* Title currentness or policy failure never fabricates a title. */ }
      finally { traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.end"); }
      return null; }
    if (!result.calls.length || result.calls.length > 32) throw new Error("INVALID_MODEL_OUTPUT");
    for (const call of result.calls) {
      const prepared = await step.runMutation(refs.begin, { ...args, kind: "tool", ordinal,
        requestCanonical: call.inputCanonical, toolCallId: call.toolCallId, toolName: call.toolName });
      if (prepared.state === "waiting_approval") {
        await step.runMutation(refs.waiting, { ...args, operationId: prepared.operationId });
        await step.awaitEvent({ name: prepared.operationId, validator: v.literal("approved") });
      }
      await step.runAction(refs.tool, { ...args, ordinal, call }, { retry: false, name: `server tool ${call.toolName}` });
    }
  }
  throw new Error("TOOL_STEP_LIMIT");
} });
/** Fresh executions use the additive layout; executeTurn retains every historical journal step. */
export const executeTurnV2 = workflow.define({ args: agentAttempt, returns: v.null(), handler: async (step, args) => {
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.begin");
  await step.runMutation(ref<"mutation", Attempt, null>("mutation", "runtimeAgent:startContext"), args, { inline: true });
  for (;;) {
    const decision = await step.runMutation(ref<"mutation", Attempt, ReturnType<typeof evaluateMemoryBarrier>>("mutation", "runtimeAgent:contextBarrier"), args, { inline: true });
    if (decision.state === "failed") {
      await step.runMutation(ref<"mutation", Attempt & { failureCode: string }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: decision.failureCode! });
      throw new Error(decision.failureCode);
    }
    if (decision.state !== "waiting") break;
    await step.sleep(Math.min(1000, decision.remainingMs), { name: "memory stage barrier" });
  }
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.end");
  traceRuntimePhase(args.runId, args.attemptNumber, "context.begin");
  const preparedContext = await step.runMutation(ref<"mutation", Attempt, EmptyContextResult>("mutation", "runtimeAgent:prepareEmptyContext"), args, { inline: true });
  if (preparedContext.state === "FAILED") {
    // Keep failure disposition in its original separate durable transaction.
    await step.runMutation(ref<"mutation", Attempt & { failureCode: "CONTEXT_OVERFLOW" }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: preparedContext.failureCode });
    transcriptDenied(preparedContext.failureCode);
  }
  if (preparedContext.state === "NEEDS_ACTION") await step.runAction(refs.prepareContext, args, { retry: false, name: "authorized Cortex context" });
  traceRuntimePhase(args.runId, args.attemptNumber, "context.end");
  for (let ordinal = 0; ordinal < 33; ordinal++) {
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.begin`);
    const result = await step.runAction(refs.model, { ...args, ordinal }, { retry: false, name: `model ${ordinal}` });
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.end`);
    if (result.final) {
      await step.runMutation(refs.finalize, { ...args, finalMessageIds: result.savedMessageIds });
      // Canonical answer/ingestion commits before optional work. The content
      // Workflow retains the original parent/account and runs independently.
      try {
        traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.begin");
        await step.runMutation(ref<"mutation", { reference: RuntimeAuthorityReference; runId: string }, string | null>("mutation", "runtimeContentJobs:enqueueParentTitle"), { reference: args.reference, runId: args.runId });
      } catch { /* Title currentness or policy failure never fabricates a title. */ }
      finally { traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.end"); }
      return null; }
    if (!result.calls.length || result.calls.length > 32) throw new Error("INVALID_MODEL_OUTPUT");
    for (const call of result.calls) {
      const prepared = await step.runMutation(refs.begin, { ...args, kind: "tool", ordinal,
        requestCanonical: call.inputCanonical, toolCallId: call.toolCallId, toolName: call.toolName });
      if (prepared.state === "waiting_approval") {
        await step.runMutation(refs.waiting, { ...args, operationId: prepared.operationId });
        await step.awaitEvent({ name: prepared.operationId, validator: v.literal("approved") });
      }
      await step.runAction(refs.tool, { ...args, ordinal, call }, { retry: false, name: `server tool ${call.toolName}` });
    }
  }
  throw new Error("TOOL_STEP_LIMIT");
} });
/** Fresh context preparation commits separately from the Workflow journal transaction. */
export const executeTurnV3 = workflow.define({ args: agentAttempt, returns: v.null(), handler: async (step, args) => {
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.begin");
  await step.runMutation(ref<"mutation", Attempt, null>("mutation", "runtimeAgent:startContext"), args, { inline: true });
  for (;;) {
    const decision = await step.runMutation(ref<"mutation", Attempt, ReturnType<typeof evaluateMemoryBarrier>>("mutation", "runtimeAgent:contextBarrier"), args, { inline: true });
    if (decision.state === "failed") {
      await step.runMutation(ref<"mutation", Attempt & { failureCode: string }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: decision.failureCode! });
      throw new Error(decision.failureCode);
    }
    if (decision.state !== "waiting") break;
    await step.sleep(Math.min(1000, decision.remainingMs), { name: "memory stage barrier" });
  }
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.end");
  traceRuntimePhase(args.runId, args.attemptNumber, "context.begin");
  const preparedContext = await step.runMutation(ref<"mutation", Attempt, EmptyContextResult>("mutation", "runtimeAgent:prepareEmptyContext"), args, { inline: false });
  if (preparedContext.state === "FAILED") {
    // Keep failure disposition in its original separate durable transaction.
    await step.runMutation(ref<"mutation", Attempt & { failureCode: "CONTEXT_OVERFLOW" }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: preparedContext.failureCode });
    transcriptDenied(preparedContext.failureCode);
  }
  if (preparedContext.state === "NEEDS_ACTION") await step.runAction(refs.prepareContext, args, { retry: false, name: "authorized Cortex context" });
  traceRuntimePhase(args.runId, args.attemptNumber, "context.end");
  for (let ordinal = 0; ordinal < 33; ordinal++) {
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.begin`);
    const result = await step.runAction(refs.model, { ...args, ordinal }, { retry: false, name: `model ${ordinal}` });
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.end`);
    if (result.final) {
      await step.runMutation(refs.finalize, { ...args, finalMessageIds: result.savedMessageIds });
      // Canonical answer/ingestion commits before optional work. The content
      // Workflow retains the original parent/account and runs independently.
      try {
        traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.begin");
        await step.runMutation(ref<"mutation", { reference: RuntimeAuthorityReference; runId: string }, string | null>("mutation", "runtimeContentJobs:enqueueParentTitle"), { reference: args.reference, runId: args.runId });
      } catch { /* Title currentness or policy failure never fabricates a title. */ }
      finally { traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.end"); }
      return null; }
    if (!result.calls.length || result.calls.length > 32) throw new Error("INVALID_MODEL_OUTPUT");
    for (const call of result.calls) {
      const prepared = await step.runMutation(refs.begin, { ...args, kind: "tool", ordinal,
        requestCanonical: call.inputCanonical, toolCallId: call.toolCallId, toolName: call.toolName });
      if (prepared.state === "waiting_approval") {
        await step.runMutation(refs.waiting, { ...args, operationId: prepared.operationId });
        await step.awaitEvent({ name: prepared.operationId, validator: v.literal("approved") });
      }
      await step.runAction(refs.tool, { ...args, ordinal, call }, { retry: false, name: `server tool ${call.toolName}` });
    }
  }
  throw new Error("TOOL_STEP_LIMIT");
} });
/** Fresh executions bypass the failed empty trial only on a bounded populated hint. */
export const executeTurnV4 = workflow.define({ args: agentAttempt, returns: v.null(), handler: async (step, args) => {
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.begin");
  await step.runMutation(ref<"mutation", Attempt, null>("mutation", "runtimeAgent:startContext"), args, { inline: true });
  for (;;) {
    const decision = await step.runMutation(ref<"mutation", Attempt, ReturnType<typeof evaluateMemoryBarrier>>("mutation", "runtimeAgent:contextBarrier"), args, { inline: true });
    if (decision.state === "failed") {
      await step.runMutation(ref<"mutation", Attempt & { failureCode: string }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: decision.failureCode! });
      throw new Error(decision.failureCode);
    }
    if (decision.state !== "waiting") break;
    await step.sleep(Math.min(1000, decision.remainingMs), { name: "memory stage barrier" });
  }
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.end");
  traceRuntimePhase(args.runId, args.attemptNumber, "context.begin");
  const preparedContext = await step.runMutation(ref<"mutation", Attempt, EmptyContextResult>("mutation", "runtimeAgent:prepareRoutedContext"), args, { inline: false });
  if (preparedContext.state === "FAILED") {
    // Keep failure disposition in its original separate durable transaction.
    await step.runMutation(ref<"mutation", Attempt & { failureCode: "CONTEXT_OVERFLOW" }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: preparedContext.failureCode });
    transcriptDenied(preparedContext.failureCode);
  }
  if (preparedContext.state === "NEEDS_ACTION") await step.runAction(refs.prepareContext, args, { retry: false, name: "authorized Cortex context" });
  traceRuntimePhase(args.runId, args.attemptNumber, "context.end");
  for (let ordinal = 0; ordinal < 33; ordinal++) {
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.begin`);
    const result = await step.runAction(refs.model, { ...args, ordinal }, { retry: false, name: `model ${ordinal}` });
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.end`);
    if (result.final) {
      await step.runMutation(refs.finalize, { ...args, finalMessageIds: result.savedMessageIds });
      // Canonical answer/ingestion commits before optional work. The content
      // Workflow retains the original parent/account and runs independently.
      try {
        traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.begin");
        await step.runMutation(ref<"mutation", { reference: RuntimeAuthorityReference; runId: string }, string | null>("mutation", "runtimeContentJobs:enqueueParentTitle"), { reference: args.reference, runId: args.runId });
      } catch { /* Title currentness or policy failure never fabricates a title. */ }
      finally { traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.end"); }
      return null; }
    if (!result.calls.length || result.calls.length > 32) throw new Error("INVALID_MODEL_OUTPUT");
    for (const call of result.calls) {
      const prepared = await step.runMutation(refs.begin, { ...args, kind: "tool", ordinal,
        requestCanonical: call.inputCanonical, toolCallId: call.toolCallId, toolName: call.toolName });
      if (prepared.state === "waiting_approval") {
        await step.runMutation(refs.waiting, { ...args, operationId: prepared.operationId });
        await step.awaitEvent({ name: prepared.operationId, validator: v.literal("approved") });
      }
      await step.runAction(refs.tool, { ...args, ordinal, call }, { retry: false, name: `server tool ${call.toolName}` });
    }
  }
  throw new Error("TOOL_STEP_LIMIT");
} });
/** Fresh ordinary turns use one durable, retry-disabled Action after explicit stage barriers.
 * Tools/approval waits remain Workflow-owned; V1–V4 journals retain their layouts. */
export const executeTurnV5 = workflow.define({ args: agentAttempt, returns: v.null(), handler: async (step, args) => {
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.begin");
  await step.runMutation(ref<"mutation", Attempt, null>("mutation", "runtimeAgent:startContext"), args, { inline: true });
  for (;;) {
    const decision = await step.runMutation(ref<"mutation", Attempt, ReturnType<typeof evaluateMemoryBarrier>>("mutation", "runtimeAgent:contextBarrier"), args, { inline: true });
    if (decision.state === "failed") {
      await step.runMutation(ref<"mutation", Attempt & { failureCode: string }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: decision.failureCode! });
      throw new Error(decision.failureCode);
    }
    if (decision.state !== "waiting") break;
    await step.sleep(Math.min(1000, decision.remainingMs), { name: "memory stage barrier" });
  }
  traceRuntimePhase(args.runId, args.attemptNumber, "barrier.end");
  for (let ordinal = 0; ordinal < 33; ordinal++) {
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.begin`);
    const result = await step.runAction(refs.turn, { ...args, ordinal }, { retry: false, name: `context and model turn ${ordinal}` });
    traceRuntimePhase(args.runId, args.attemptNumber, `model.${ordinal}.end`);
    if (result.final) return null;
    if (!result.calls.length || result.calls.length > 32) throw new Error("INVALID_MODEL_OUTPUT");
    for (const call of result.calls) {
      const prepared = await step.runMutation(refs.begin, { ...args, kind: "tool", ordinal,
        requestCanonical: call.inputCanonical, toolCallId: call.toolCallId, toolName: call.toolName });
      if (prepared.state === "waiting_approval") {
        await step.runMutation(refs.waiting, { ...args, operationId: prepared.operationId });
        await step.awaitEvent({ name: prepared.operationId, validator: v.literal("approved") });
      }
      await step.runAction(refs.tool, { ...args, ordinal, call }, { retry: false, name: `server tool ${call.toolName}` });
    }
  }
  throw new Error("TOOL_STEP_LIMIT");
} });
async function saveContextHandler(ctx: MutationCtx, args: Attempt & { context: string; witnesses: Witness[]; completeness: "complete" | "incomplete"; failureCode?: string; emptyIndexedProfileId?: string }) {
  const current = await executionContext(ctx, args); if (current.execution.contextCanonical !== undefined) transcriptDenied("INVALID_STATE");
  if (utf8Bytes(args.context) > Math.min(16_384, current.definition.context.maxContextTokens) || args.witnesses.length > 32) transcriptDenied("CONTEXT_LIMIT_EXCEEDED");
  await checkWitnesses(ctx, args, args.witnesses);
  if (args.emptyIndexedProfileId !== undefined) {
    const scope = { tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId! };
    const availability = await readIndexedContextAvailability(ctx, { reference: args.reference, cutoff: current.snapshot.ingestionCutoff.sequence,
      excludedSourceKeys: [...current.snapshot.messages.map(pin => contextSourceKey(scope, { ...pin, sourceId: pin.sourceEventId })), ...args.witnesses.map(witness => contextSourceKey(scope, witness))],
      boundary: { conversationId: current.snapshot.conversationId, runId: args.runId, queueSequence: current.snapshot.queueSequence, anchor: current.snapshot.anchor }, runBudgetId: current.run.runBudgetId });
    if (!availability.empty || availability.profileId !== args.emptyIndexedProfileId) transcriptDenied("STALE_CONTEXT");
  }
  if (args.completeness === "complete" && args.failureCode !== undefined || args.completeness === "incomplete" && !args.failureCode) transcriptDenied("INVALID_INPUT");
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { contextCanonical: args.context, contextState: "complete", sourceWitnesses: args.witnesses,
    contextCompleteness: args.completeness, contextFailureCode: args.failureCode, state: "running", updatedAt: Date.now() });
  await ctx.db.patch("runtimeRuns", current.run._id, { contextCompleteness: args.completeness, contextFailureCode: args.failureCode, updatedAt: Date.now() }); return null;
}
export const saveContext = internalMutation({ args: { ...agentAttempt, context: v.string(), witnesses: v.array(sourceWitness),
  completeness: v.union(v.literal("complete"), v.literal("incomplete")), failureCode: v.optional(v.string()), emptyIndexedProfileId: v.optional(v.string()) }, handler: saveContextHandler });
export const startContext = internalMutation({ args: agentAttempt, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args);
  if (current.execution.contextState !== undefined) transcriptDenied("INTERRUPTED_REQUIRES_RECONCILIATION");
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { contextState: "started", barrierStartedAt: Date.now() }); return null;
} });
export const contextBarrier = internalMutation({ args: agentAttempt, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args);
  if (current.execution.contextState !== "started" || current.execution.barrierStartedAt === undefined) transcriptDenied("INVALID_STATE");
  if (current.definition.context.memoryMode !== "strict") return { state: "ready" as const, remainingMs: 0 };
  await refreshScopeWatermarks(ctx, args.reference);
  const cutoff = current.snapshot.ingestionCutoff.sequence;
  const progress = await readStageProgress(ctx, args.reference, cutoff, current.run.runBudgetId, current.snapshot.ingestionCutoff.graphSequence);
  const barrier = current.definition.context.barrier ?? { deadlineMs: 30_000, onFailure: "fail" as const };
  const decision = evaluateMemoryBarrier({ cutoff, requiredStages: current.snapshot.ingestionCutoff.requiredStages,
    stageCutoffs: progress.graph ? { graph: progress.graph.cutoff } : {},
    progress, startedAt: current.execution.barrierStartedAt, deadlineMs: barrier.deadlineMs, now: Date.now(), onFailure: barrier.onFailure });
  if (decision.state === "incomplete") {
    await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { contextCompleteness: "incomplete", contextFailureCode: decision.failureCode });
    await ctx.db.patch("runtimeRuns", current.run._id, { contextCompleteness: "incomplete", contextFailureCode: decision.failureCode });
  }
  return decision;
} });
export const failContext = internalMutation({ args: { ...agentAttempt, failureCode: v.union(v.literal("CAPABILITY_UNAVAILABLE"),
  v.literal("MEMORY_STAGE_FAILED"), v.literal("MEMORY_BARRIER_TIMEOUT"), v.literal("CONTEXT_OVERFLOW")) }, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args);
  if (current.execution.contextState !== "started") transcriptDenied("INVALID_STATE");
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { contextState: "failed", contextCompleteness: "incomplete", contextFailureCode: args.failureCode, updatedAt: Date.now() });
  await ctx.db.patch("runtimeRuns", current.run._id, { contextCompleteness: "incomplete", contextFailureCode: args.failureCode, updatedAt: Date.now() }); return null;
} });
/** One read snapshot retains both original source reads and their current fences. */
async function contextSourceHandler(ctx: QueryCtx, args: ContextSourceArgs) {
  const source = await new ConvexMemoryRepository(ctx, args.reference, "read").getSource(args.sourceId); if (!source) transcriptDenied("STALE_CONTEXT");
  if (source.lineage.sourceEventId !== args.expected.sourceEventId || source.lineage.sourceRevision !== args.expected.sourceRevision
    || args.expected.contentHash !== undefined && source.contentHash !== args.expected.contentHash) transcriptDenied("STALE_CONTEXT");
  const key = contextSourceKey(memoryScope(args.reference), source.lineage); if (new Set(args.excludedSourceKeys).has(key)) return null;
  const eligible = await readIndexedSourceAtCutoff(ctx, { reference: args.reference, sourceId: args.sourceId, sourceRevision: source.lineage.sourceRevision, cutoff: args.cutoff, boundary: args.boundary });
  return eligible ? source : null;
}
export const contextSource = internalQuery({ args: { reference: runtimeAuthorityReference, sourceId: v.string(),
  expected: v.object({ sourceEventId: v.string(), sourceRevision: v.number(), contentHash: v.optional(v.string()) }),
  excludedSourceKeys: v.array(v.string()), cutoff: v.number(), boundary: contextBoundary }, handler: contextSourceHandler });

/** One branch, original ordered guards and immediate witness merge. Retained
 * witnesses are conflict bookkeeping only; they cannot authorize a source. */
async function contextSourceBatchHandler(ctx: QueryCtx, args: ContextSourceBatchArgs) {
  if (args.items.length > 100 || args.witnesses.length > 200 || args.priorWitnesses.length > 100) transcriptDenied("INVALID_INPUT");
  const witnesses = new Map(args.witnesses.map(witness => [witness.sourceId, witness]));
  const priorWitnesses = new Map(args.priorWitnesses.map(witness => [witness.sourceId, witness]));
  const provenance = new Map<string, import("../src/domain/contracts").SourceLineage>();
  const scope = memoryScope(args.reference), selectedIndexes: number[] = [];
  for (const [index, item] of args.items.entries()) {
    const source = await contextSourceHandler(ctx, { reference: args.reference, ...item,
      excludedSourceKeys: args.excludedSourceKeys, cutoff: args.cutoff, boundary: args.boundary });
    if (!source) continue;
    const key = contextSourceKey(scope, source.lineage);
    const witness = mergeContextWitness(witnesses.get(item.sourceId) ?? priorWitnesses.get(item.sourceId), { sourceId: item.sourceId, sourceEventId: source.lineage.sourceEventId,
      sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash, permissions: [args.permission] });
    if (!witness) transcriptDenied("STALE_CONTEXT");
    witnesses.set(item.sourceId, witness); provenance.set(key, source.lineage); selectedIndexes.push(index);
  }
  return { selectedIndexes, witnesses: [...witnesses.values()], provenance: [...provenance.entries()] };
}
export const contextSourceBatch = internalQuery({ args: { reference: runtimeAuthorityReference,
  items: v.array(v.object({ sourceId: v.string(), expected: v.object({ sourceEventId: v.string(), sourceRevision: v.number(), contentHash: v.optional(v.string()) }) })),
  permission: contextSourcePermission, witnesses: v.array(sourceWitness), priorWitnesses: v.array(sourceWitness),
  excludedSourceKeys: v.array(v.string()), cutoff: v.number(), boundary: contextBoundary }, handler: contextSourceBatchHandler });

export async function prepareContextHandler(ctx: ActionCtx, args: Attempt): Promise<null> {
  const inputs = await ctx.runQuery(refs.contextInputs, args);
  const { current, boundary, represented, pending } = inputs;
  const cutoff = current.snapshot.ingestionCutoff.sequence;
  let completeness: "complete" | "incomplete" = current.execution.contextCompleteness ?? "complete"; let failureCode = current.execution.contextFailureCode;
  async function fail(code: "CAPABILITY_UNAVAILABLE" | "MEMORY_STAGE_FAILED" | "MEMORY_BARRIER_TIMEOUT" | "CONTEXT_OVERFLOW"): Promise<never> {
    await ctx.runMutation(ref<"mutation", Attempt & { failureCode: typeof code }, null>("mutation", "runtimeAgent:failContext"), { ...args, failureCode: code });
    return transcriptDenied(code);
  }
  if (inputs.kind === "pending_overflow") return await fail("CONTEXT_OVERFLOW");
  if (pending.completeness === "incomplete") {
    completeness = "incomplete"; failureCode = "CONTEXT_OVERFLOW";
  }
  const repository = createActionMemoryRepository(ctx, args.reference, "read"); const witnesses = new Map<string, Witness>();
  const excluded = new Set([...represented, ...pending.sourceKeys]);
  const provenance = new Map<string, import("../src/domain/contracts").SourceLineage>();
  type RecallContext = { witnesses: typeof witnesses; provenance: typeof provenance };
  type RecallReads = Pick<typeof repository, "listFacts" | "searchVectors">;
  const retained = { witnesses, provenance };
  async function selectSources(state: RecallContext, items: ContextSourceBatchArgs["items"], permission: ContextSourcePermission, priorWitnesses?: typeof witnesses) {
    if (!items.length) return [];
    const selected = await ctx.runQuery(refs.contextSourceBatch, { reference: args.reference, items, permission,
      witnesses: [...state.witnesses.values()], priorWitnesses: [...(priorWitnesses?.values() ?? [])],
      excludedSourceKeys: [...excluded], cutoff, boundary });
    for (const witness of selected.witnesses) state.witnesses.set(witness.sourceId, witness);
    for (const [key, lineage] of selected.provenance) state.provenance.set(key, lineage);
    return selected.selectedIndexes;
  }
  async function selectFacts(reads: RecallReads, state: RecallContext, query: Parameters<typeof repository.listFacts>[0], vectorSettled?: Promise<void>, priorWitnesses?: typeof witnesses) {
    const facts = await reads.listFacts(query);
    // Native reads overlap; keep the original vector-first source guard RPCs.
    await vectorSettled;
    const selected = await selectSources(state, facts.map(fact => ({ sourceId: fact.lineage.sourceId,
      expected: { sourceEventId: fact.lineage.sourceEventId, sourceRevision: fact.lineage.sourceRevision } })), "canViewFacts", priorWitnesses);
    return selected.map(index => facts[index]!);
  }
  async function selectVectors(reads: RecallReads, state: RecallContext, query: Parameters<typeof repository.searchVectors>) {
    const matches = await reads.searchVectors(...query);
    const selected = await selectSources(state, matches.map(match => ({ sourceId: match.source.lineage.sourceId,
      expected: { sourceEventId: match.source.lineage.sourceEventId, sourceRevision: match.source.lineage.sourceRevision, contentHash: match.source.contentHash } })), "canViewMemories");
    return selected.map(index => matches[index]!);
  }
  const scoped = { ...repository,
    listFacts: async (query: Parameters<typeof repository.listFacts>[0]) => await selectFacts(repository, retained, query),
    searchVectors: async (...query: Parameters<typeof repository.searchVectors>) => await selectVectors(repository, retained, query),
    stageRecallReads: () => {
      const reads = repository.stageRecallReads();
      const vectorContext: RecallContext = { witnesses: new Map(), provenance: new Map() };
      const factContext: RecallContext = { witnesses: new Map(), provenance: new Map() };
      let releaseVector!: () => void;
      const vectorSettled = new Promise<void>(resolve => { releaseVector = resolve; });
      return {
        searchVectors: async (...query: Parameters<typeof repository.searchVectors>) => {
          try { return await selectVectors(reads, vectorContext, query); }
          finally { releaseVector(); }
        },
        listFacts: async (query: Parameters<typeof repository.listFacts>[0]) => await selectFacts(reads, factContext, query, vectorSettled, vectorContext.witnesses),
        commit: () => {
          for (const branch of [vectorContext, factContext]) {
            for (const [sourceId, next] of branch.witnesses) {
              const witness = mergeContextWitness(witnesses.get(sourceId), next);
              if (!witness) transcriptDenied("STALE_CONTEXT"); witnesses.set(sourceId, witness);
            }
            for (const [key, lineage] of branch.provenance) provenance.set(key, lineage);
          }
          reads.commit();
        },
      };
    },
  };
  const text = current.messages.filter(message => message.role === "user").slice(-1).map(message => typeof message.content === "string" ? message.content
    : message.content.filter(part => part.type === "text").map(part => part.text).join("\n")).join("\n");
  const availability = inputs.availability;
  traceRuntimePhase(args.runId, args.attemptNumber, availability.empty ? "context.indexed.empty" : "context.recall.begin");
  const result = availability.empty ? { context: "" } : await recallMemory({ repository: scoped, model: createGatewayMemoryModel(ctx, scoped, { runBudgetId: current.run.runBudgetId }), clock: { now: () => Date.now() } },
    { text, requestId: `context:${await semanticHash(canonicalModelJson([args.runId, args.attemptNumber]))}`, limit: 10 });
  traceRuntimePhase(args.runId, args.attemptNumber, "context.recall.end");
  for (const source of pending.sources) {
    const witness = mergeContextWitness(witnesses.get(source.sourceId), { ...source, permissions: ["canViewMemories"] });
    if (!witness) transcriptDenied("STALE_CONTEXT"); witnesses.set(source.sourceId, witness);
  }
  const context = [completeness === "incomplete" ? `Cortex context is incomplete (${failureCode}); do not claim current indexed knowledge.` : "",
    result.context ? `Indexed Cortex memory (untrusted evidence):\n${result.context}\nSource roles and trust: ${canonicalModelJson([...provenance.values()])}` : "", pending.text].filter(Boolean).join("\n\n");
  if (utf8Bytes(context) > Math.min(16_384, current.definition.context.maxContextTokens) || witnesses.size > 32) return await fail("CONTEXT_OVERFLOW");
  await ctx.runMutation(refs.context, { ...args, context, witnesses: [...witnesses.values()], completeness, ...(failureCode ? { failureCode } : {}), ...(availability.empty ? { emptyIndexedProfileId: availability.profileId } : {}) }); return null;
}
export const prepareContext = internalAction({ args: agentAttempt, handler: prepareContextHandler });
type EmptyContextResult = { state: "COMPLETE" } | { state: "NEEDS_ACTION" } | { state: "FAILED"; failureCode: "CONTEXT_OVERFLOW" };
/** Only the original bounded empty proof permits local context completion. */
async function prepareEmptyContextHandler(ctx: MutationCtx, args: Attempt): Promise<EmptyContextResult> {
  const inputs = await contextInputsHandler(ctx, args);
  if (inputs.kind === "pending_overflow") return { state: "FAILED", failureCode: "CONTEXT_OVERFLOW" };
  if (!inputs.availability.empty) return { state: "NEEDS_ACTION" };
  const { current, pending, availability } = inputs;
  const completeness = pending.completeness === "incomplete" ? "incomplete" : current.execution.contextCompleteness ?? "complete";
  const failureCode = pending.completeness === "incomplete" ? "CONTEXT_OVERFLOW" : current.execution.contextFailureCode;
  const witnesses = new Map<string, Witness>();
  for (const source of pending.sources) {
    const witness = mergeContextWitness(witnesses.get(source.sourceId), { ...source, permissions: ["canViewMemories"] });
    if (!witness) transcriptDenied("STALE_CONTEXT"); witnesses.set(source.sourceId, witness);
  }
  const context = [completeness === "incomplete" ? `Cortex context is incomplete (${failureCode}); do not claim current indexed knowledge.` : "", pending.text].filter(Boolean).join("\n\n");
  if (utf8Bytes(context) > Math.min(16_384, current.definition.context.maxContextTokens) || witnesses.size > 32) return { state: "FAILED", failureCode: "CONTEXT_OVERFLOW" };
  // Repeat the complete original save fence in this transaction, including its
  // source/witness checks and fresh empty/profile re-probe. No external I/O.
  await saveContextHandler(freshNativeTranscriptReads(freshPolicyMetadataReads(ctx)), { ...args, context, witnesses: [...witnesses.values()], completeness,
    ...(failureCode ? { failureCode } : {}), emptyIndexedProfileId: availability.profileId });
  return { state: "COMPLETE" };
}
export const prepareEmptyContext = internalMutation({ args: agentAttempt, handler: (ctx, args) => prepareEmptyContextHandler(createAuthorityReadScope(ctx), args) });
/** Metadata can request the original Action, never certify an empty context. */
async function prepareRoutedContextHandler(ctx: MutationCtx, args: Attempt): Promise<EmptyContextResult> {
  ctx = createAuthorityReadScope(ctx, { policyMetadata: true });
  const current = await executionContext(ctx, args);
  if (current.execution.contextState !== "started") transcriptDenied("INVALID_STATE");
  const repository = new ConvexMemoryRepository(ctx, args.reference, "read"), authority = await repository.authority();
  const scope = { tenantId: authority.tenantId, memorySpaceId: args.reference.memorySpaceId! };
  const represented = new Set(current.snapshot.messages.map(pin => contextSourceKey(scope, { ...pin, sourceId: pin.sourceEventId })));
  const selected = authority.resourceAccess === "own"
    ? ctx.db.query("runtimeIngestionEvents").withIndex("by_owner_sequence", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId)
      .eq("ownerPrincipalId", authority.principalId).lte("sequence", current.snapshot.ingestionCutoff.sequence))
    : ctx.db.query("runtimeIngestionEvents").withIndex("by_scope_sequence", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId)
      .lte("sequence", current.snapshot.ingestionCutoff.sequence));
  const events = await selected.take(1025);
  // Pending, boundary-ineligible or resource-denied candidates may be false
  // positives. Only the original Action determines current eligible context.
  if (events.length > 1024 || events.some(event => event.eligibility === "eligible" && !represented.has(contextSourceKey(scope, event.lineage)))) {
    return { state: "NEEDS_ACTION" };
  }
  return await prepareEmptyContextHandler(ctx, args);
}
export const prepareRoutedContext = internalMutation({ args: agentAttempt, handler: prepareRoutedContextHandler });

async function beginOperationHandler(ctx: MutationCtx, args: Attempt & { kind: "model" | "tool"; ordinal: number; requestCanonical: string; toolCallId?: string; toolName?: string }) {
  const current = await executionContext(ctx, args);
  if (!Number.isSafeInteger(args.ordinal) || args.ordinal < 0 || args.ordinal > 32 || utf8Bytes(args.requestCanonical) > 180_000) transcriptDenied("INVALID_INPUT");
  const canonical = canonicalModelJson(JSON.parse(args.requestCanonical)); if (canonical !== args.requestCanonical) transcriptDenied("INVALID_INPUT");
  const semanticId = await semanticHash(canonicalModelJson([args.runId, args.attemptNumber, args.kind, args.ordinal, args.toolCallId ?? null]));
  const operationId = `agent-op:${semanticId}`;
  const prior = singleTranscript(await ctx.db.query("runtimeAgentOperations").withIndex("by_operation", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("operationId", operationId)).take(2));
  if (prior) {
    if (prior.requestCanonical !== canonical || prior.toolName !== args.toolName || prior.toolCallId !== args.toolCallId) transcriptDenied("IDEMPOTENCY_CONFLICT");
    if (prior.state === "started" || prior.state === "unknown") transcriptDenied("INTERRUPTED_REQUIRES_RECONCILIATION");
    return { operationId, semanticId, state: prior.state, resultCanonical: prior.resultCanonical ?? null, nativeMessageIds: prior.nativeMessageIds };
  }
  let state: "prepared" | "waiting_approval" = "prepared";
  if (args.kind === "tool") {
    if (!args.toolName || !args.toolCallId) transcriptDenied("TOOL_DENIED");
    const name = semanticToolName(args.toolName); validateToolInput(name, JSON.parse(canonical));
    const definition = current.definition.tools.find(tool => tool.toolId === name); if (!definition) transcriptDenied("TOOL_DENIED");
    await recheckAuthority(ctx, args.reference, { capability: "tool", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
    const limit = Math.min(...current.definition.policies.map(policy => policy.rules.limits?.toolSteps ?? 32), 32);
    if (current.execution.toolCount >= limit) transcriptDenied("TOOL_STEP_LIMIT");
    if (definition.approval === "explicit") state = "waiting_approval";
    await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { toolCount: current.execution.toolCount + 1 });
  }
  await ctx.db.insert("runtimeAgentOperations", { tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId!, runId: args.runId,
    attemptNumber: args.attemptNumber, operationId, semanticId, kind: args.kind, ordinal: args.ordinal, requestCanonical: canonical, state,
    ...(args.toolName ? { toolName: args.toolName } : {}), ...(args.toolCallId ? { toolCallId: args.toolCallId } : {}), nativeMessageIds: [], createdAt: Date.now() });
  if (args.kind === "tool") await writeParts(ctx, current.execution, [{ type: "tool", toolCallId: args.toolCallId!, name: args.toolName!, phase: "requested" }]);
  return { operationId, semanticId, state, resultCanonical: null, nativeMessageIds: [] as string[] };
}
export const beginOperation = internalMutation({ args: { ...agentAttempt, kind: v.union(v.literal("model"), v.literal("tool")), ordinal: v.number(), requestCanonical: v.string(), toolCallId: v.optional(v.string()), toolName: v.optional(v.string()) }, handler: beginOperationHandler });
/** Reconcile an already completed model step before its own saved output extends
 * the hydrated history. Current authority, cutoff, sources and saved-message pins
 * are checked again; this does not readmit a started or unknown operation. */
async function completedModelStepHandler(ctx: Pick<QueryCtx, "db" | "runQuery">, args: Attempt & { ordinal: number }) {
  const current = await executionContext(ctx, args);
  if (!Number.isSafeInteger(args.ordinal) || args.ordinal < 0 || args.ordinal > 32) transcriptDenied("INVALID_INPUT");
  const semanticId = await semanticHash(canonicalModelJson([args.runId, args.attemptNumber, "model", args.ordinal, null]));
  const owned = singleTranscript(await ctx.db.query("runtimeAgentOperations").withIndex("by_operation", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("operationId", `agent-op:${semanticId}`)).take(2));
  if (!owned || owned.state !== "complete") return null;
  if (owned.kind !== "model" || owned.runId !== args.runId || owned.attemptNumber !== args.attemptNumber || owned.ordinal !== args.ordinal
    || !owned.resultCanonical || owned.nativeMessageIds.some(id => !current.execution.savedMessageIds.includes(id))) transcriptDenied("INVALID_STATE");
  return owned.resultCanonical;
}
export const completedModelStep = internalQuery({ args: { ...agentAttempt, ordinal: v.number() }, handler: completedModelStepHandler });
async function startOperationHandler(ctx: MutationCtx, args: Attempt & { operationId: string }) {
  const current = await executionContext(ctx, args); const owned = await operation(ctx, args, args.operationId);
  if (owned.state !== "prepared" && owned.state !== "approved") transcriptDenied("INTERRUPTED_REQUIRES_RECONCILIATION");
  if (owned.kind === "tool") await currentToolPermission(ctx, args, current, owned);
  await ctx.db.patch("runtimeAgentOperations", owned._id, { state: "started", startedAt: Date.now() });
  const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("runId", args.runId)).take(2));
  if (!outbox || outbox.leaseVersion !== args.leaseVersion) transcriptDenied();
  await ctx.db.patch("runtimeRunOutbox", outbox._id, { leaseExpiresAt: Date.now() + 300_000 });
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { state: "running", updatedAt: Date.now() });
  if (owned.kind === "tool") await writeParts(ctx, current.execution, [{ type: "tool", toolCallId: owned.toolCallId!, name: owned.toolName!, phase: "running" }]);
  return null;
}
export const startOperation = internalMutation({ args: { ...agentAttempt, operationId: v.string() }, handler: startOperationHandler });
/** One native transaction retains the original preparation checks and derives every model input server-side. */
async function prepareModelOperationHandler(ctx: MutationCtx, args: Attempt & { ordinal: number }) {
  const attempt = attemptArgs(args);
  const current = await executionContext(ctx, attempt);
  const completed = await completedModelStepHandler(ctx, { ...attempt, ordinal: args.ordinal });
  if (completed !== null) return { state: "completed" as const, resultCanonical: completed };
  const requestCanonical = canonicalModelJson({ messages: current.messages, context: current.execution.contextCanonical ?? "", instructions: current.definition.instructions });
  const op = await beginOperationHandler(ctx, { ...attempt, ordinal: args.ordinal, kind: "model", requestCanonical });
  if (op.state === "complete" && op.resultCanonical) return { state: "completed" as const, resultCanonical: op.resultCanonical };
  await startOperationHandler(ctx, { ...attempt, operationId: op.operationId });
  return { state: "started" as const, current, op };
}
export const prepareModelOperation = internalMutation({ args: { ...agentAttempt, ordinal: v.number() }, handler: (ctx, args) => prepareModelOperationHandler(createAuthorityReadScope(ctx), args) });
/** These resolutions propose pinned model inputs only. Fresh admission/checkpoint
 * still execute every original current policy/authority/source/budget predicate. */
async function prepareResolvedModelOperationHandler(ctx: MutationCtx, args: Attempt & { ordinal: number }) {
  const prepared = await prepareModelOperationHandler(ctx, args);
  if (prepared.state === "completed") return prepared;
  const resolutionArgs = { ...attemptArgs(args), runBudgetId: prepared.current.run.runBudgetId };
  const initialResolution = await resolveModelOperationHandler(ctx, resolutionArgs);
  const governedResolution = await resolveModelOperationHandler(ctx, resolutionArgs);
  return { ...prepared, initialResolution, governedResolution };
}
export const prepareResolvedModelOperation = internalMutation({ args: { ...agentAttempt, ordinal: v.number() },
  handler: (ctx, args) => prepareResolvedModelOperationHandler(createAuthorityReadScope(ctx, { nativeTranscript: true, policyMetadata: true }), args) });
async function prepareTurnModelHandler(ctx: MutationCtx, args: Attempt) {
  const context = await prepareRoutedContextHandler(ctx, args);
  if (context.state === "FAILED") return { state: "failed_context" as const, failureCode: context.failureCode };
  if (context.state === "NEEDS_ACTION") return { state: "needs_context" as const };
  return await prepareResolvedModelOperationHandler(createAuthorityReadScope(ctx), { ...args, ordinal: 0 });
}
export const prepareTurnModel = internalMutation({ args: agentAttempt, handler: (ctx, args) => prepareTurnModelHandler(createAuthorityReadScope(ctx, { nativeTranscript: true, policyMetadata: true }), args) });

export const finishOperation = internalMutation({ args: { ...agentAttempt, operationId: v.string(), resultCanonical: v.string(), nativeMessageIds: v.array(v.string()) }, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args); const owned = await operation(ctx, args, args.operationId);
  if (owned.state !== "started" || utf8Bytes(args.resultCanonical) > 180_000 || canonicalModelJson(JSON.parse(args.resultCanonical)) !== args.resultCanonical) transcriptDenied("INVALID_STATE");
  if (!args.nativeMessageIds.length || args.nativeMessageIds.length > 1000 || new Set(args.nativeMessageIds).size !== args.nativeMessageIds.length) transcriptDenied("INVALID_INPUT");
  const messages = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: args.nativeMessageIds });
  if (messages.length !== args.nativeMessageIds.length || messages.some((message, index) => !message || message._id !== args.nativeMessageIds[index] || message.threadId !== current.threadId || message.order !== current.snapshot.anchor.order
    || message.status !== "success" || comparePosition(message, current.snapshot.anchor) <= 0)) transcriptDenied("STALE_TRANSCRIPT");
  await ctx.db.patch("runtimeAgentOperations", owned._id, { state: "complete", resultCanonical: args.resultCanonical, nativeMessageIds: args.nativeMessageIds, endedAt: Date.now() });
  const ids = [...new Set([...current.execution.savedMessageIds, ...args.nativeMessageIds])];
  if (ids.length > 1000) transcriptDenied("CONTEXT_LIMIT_EXCEEDED");
  const pins = new Map((current.execution.savedMessagePins ?? []).map(pin => [pin.id, pin]));
  for (const message of messages) if (message) {
    const pin = { id: message._id, order: message.order, stepOrder: message.stepOrder, canonicalContentHash: await canonicalMessageHash(message) };
    const prior = pins.get(message._id); if (prior && prior.canonicalContentHash !== pin.canonicalContentHash) transcriptDenied("STALE_TRANSCRIPT");
    pins.set(pin.id, pin);
  }
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { savedMessageIds: ids, savedMessagePins: [...pins.values()], nextModelStep: owned.kind === "model" ? owned.ordinal + 1 : current.execution.nextModelStep, updatedAt: Date.now() });
  if (owned.kind === "tool") {
    if (owned.toolName === "memory_remember") await registerCompletedToolSource(ctx, args.reference, owned.operationId);
    const value = JSON.parse(args.resultCanonical) as { receiptId?: unknown; version?: unknown; jobId?: unknown; artifactId?: unknown; kind?: unknown };
    await writeParts(ctx, current.execution, [{ type: "tool", toolCallId: owned.toolCallId!, name: owned.toolName!, phase: "succeeded" },
      ...(owned.toolName === "memory_remember" && typeof value.receiptId === "string" ? [{ type: "artifact" as const, artifactId: value.receiptId, kind: "memory-receipt" as const }] : []),
      ...(["media_image_generate", "media_video_generate"].includes(owned.toolName ?? "") && value.version === 1 && typeof value.jobId === "string" && typeof value.artifactId === "string" && (value.kind === "image" || value.kind === "video")
        ? [{ type: "media-job" as const, version: 1 as const, jobId: value.jobId, artifactId: value.artifactId, kind: value.kind as "image" | "video" }] : [])]);
  }
  return null;
} });
async function bindNativeOperationHandler(ctx: MutationCtx, args: Attempt & { operationId: string; nativeOperationId: import("./_generated/dataModel").Id<"runtimeModelOperations"> }) {
  const current = await executionContext(ctx, args); const op = await operation(ctx, args, args.operationId);
  const native = await ctx.db.get("runtimeModelOperations", args.nativeOperationId);
  if (!native || op.kind !== "model" || op.state !== "started" || native.runAccountId !== current.run.runAccountId
    || native.tenantId !== args.reference.tenantId || canonicalModelJson(native.reference) !== canonicalModelJson(args.reference)
    || native.semanticId !== op.semanticId
    || op.nativeModelOperationId && op.nativeModelOperationId !== native._id) transcriptDenied("POLICY_DENIED");
  const attempts = await ctx.db.query("runtimeModelAttempts").withIndex("by_operation", q => q.eq("operationDocumentId", native._id)).take(2);
  if (attempts.length !== 1 || attempts[0].ordinal !== op.ordinal || attempts[0].attemptNumber !== 1) transcriptDenied("POLICY_DENIED");
  await ctx.db.patch("runtimeAgentOperations", op._id, { nativeModelOperationId: native._id }); return null;
}
export const bindNativeOperation = internalMutation({ args: { ...agentAttempt, operationId: v.string(), nativeOperationId: v.id("runtimeModelOperations") }, handler: bindNativeOperationHandler });
/** Agent-only native parent: no inference or charge settlement, and no caller-selected request lane. */
async function admitModelOperationHandler(ctx: MutationCtx, args: Attempt & { operationId: string; ordinal: number; requestCanonical: string; snapshotCanonical: string }): Promise<GatewayAdmissionCheckpoint> {
  const attempt = attemptArgs(args);
  const current = await executionContext(ctx, attempt);
  const op = await operation(ctx, attempt, args.operationId);
  const semanticId = await semanticHash(canonicalModelJson([args.runId, args.attemptNumber, "model", args.ordinal, null]));
  const modelBinding = canonicalModelJson({ messages: current.messages, context: current.execution.contextCanonical ?? "", instructions: current.definition.instructions });
  if (!Number.isSafeInteger(args.ordinal) || args.ordinal < 0 || args.ordinal > 32 || op.kind !== "model" || op.state !== "started"
    || op.ordinal !== args.ordinal || op.semanticId !== semanticId || op.operationId !== `agent-op:${semanticId}`
    || op.requestCanonical !== modelBinding) transcriptDenied("POLICY_DENIED");
  const admission = await admitHandler(ctx, { reference: args.reference, operationKey: "agent.respond", runBudgetId: current.run.runBudgetId,
    semanticId: op.semanticId, ordinal: op.ordinal, requestCanonical: args.requestCanonical });
  await bindNativeOperationHandler(ctx, { ...attempt, operationId: op.operationId, nativeOperationId: admission.operationId });
  if (admission.status !== "reserved") return { admission };
  assertGatewayReservedRequest(admission, args.requestCanonical, args.snapshotCanonical, MODEL_LEDGER_STORAGE_LIMITS.canonicalBytes);
  // Retain the original fresh post-binding action hydration before checkpoint in the native transaction.
  await executionContext(ctx, attempt);
  const permit = await checkpointHandler(ctx, { reference: args.reference, attemptId: admission.attemptId, requestCanonical: admission.requestCanonical });
  return { admission, permit };
}
export const admitModelOperation = internalMutation({ args: { ...agentAttempt, operationId: v.string(), ordinal: v.number(), requestCanonical: v.string(), snapshotCanonical: v.string() }, handler: (ctx, args) => admitModelOperationHandler(createAuthorityReadScope(ctx), args) });
/** Original outer hydration and request-binding checks precede the unchanged
 * atomic admit/bind/checkpoint parent. Caller input cannot select another lane. */
async function admitPreparedModelOperationHandler(ctx: MutationCtx, args: Attempt & {
  operationId: string; ordinal: number; requestCanonical: string; snapshotCanonical: string; bindingCanonical: string;
}): Promise<GatewayAdmissionCheckpoint> {
  const current = await executionContext(ctx, attemptArgs(args));
  const semanticId = await semanticHash(canonicalModelJson([args.runId, args.attemptNumber, "model", args.ordinal, null]));
  if (args.bindingCanonical !== canonicalModelJson({ reference: args.reference, operationKey: "agent.respond", runBudgetId: current.run.runBudgetId,
    semanticId, ordinal: args.ordinal })) transcriptDenied("POLICY_DENIED");
  return await admitModelOperationHandler(ctx, args);
}
export const admitPreparedModelOperation = internalMutation({ args: { ...agentAttempt, operationId: v.string(), ordinal: v.number(),
  requestCanonical: v.string(), snapshotCanonical: v.string(), bindingCanonical: v.string() },
  handler: (ctx, args) => admitPreparedModelOperationHandler(createAuthorityReadScope(ctx, { nativeTranscript: true, policyMetadata: true }), args) });

export const recordOutput = internalMutation({ args: { ...agentAttempt, parts: v.array(v.any()) }, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args); if (args.parts.length > 64) transcriptDenied("INVALID_INPUT");
  const tools = await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", args.reference.tenantId).eq("memorySpaceId", args.reference.memorySpaceId!)
    .eq("runId", args.runId).eq("attemptNumber", args.attemptNumber).eq("kind", "tool")).take(33);
  if (tools.length > 32) transcriptDenied("TOOL_STEP_LIMIT");
  const knownToolCalls = Object.fromEntries(tools.filter(tool => tool.toolCallId && tool.toolName).map(tool => [tool.toolCallId!, tool.toolName!]));
  const parts = projectNativeOutputParts(args.parts, current.definition.tools.map(tool => NATIVE_TOOL_NAMES[tool.toolId as keyof typeof NATIVE_TOOL_NAMES]), knownToolCalls);
  await writeParts(ctx, current.execution, parts); return null;
} });
export async function modelStepHandler(ctx: ActionCtx, args: Attempt & { ordinal: number }): Promise<StepResult> {
  const attempt = attemptArgs(args);
  const prepared = await ctx.runMutation(refs.prepareModelOperation, { ...attempt, ordinal: args.ordinal });
  return await executePreparedModelStep(ctx, args, prepared);
}
async function executePreparedModelStep(ctx: ActionCtx, args: Attempt & { ordinal: number }, prepared: Awaited<ReturnType<typeof prepareModelOperationHandler>>,
  proposal?: { initialResolution: Awaited<ReturnType<typeof resolveModelOperationHandler>>; governedResolution: Awaited<ReturnType<typeof resolveModelOperationHandler>> }): Promise<StepResult> {
  const attempt = attemptArgs(args);
  if (prepared.state === "completed") return JSON.parse(prepared.resultCanonical) as StepResult;
  const { current, op } = prepared;
  const guard = async () => { await ctx.runQuery(refs.hydrate, attempt); };
  const base = createBackendGatewayComposition(ctx, async request => {
    if (!proposal) await guard();
    if (!proposal && (canonicalModelJson(request.reference) !== canonicalModelJson(args.reference) || request.operationKey !== "agent.respond"
      || request.runBudgetId !== current.run.runBudgetId || request.semanticId !== op.semanticId || request.ordinal !== args.ordinal
      || request.source !== undefined || request.parentOperationId !== undefined)) transcriptDenied("POLICY_DENIED");
    if (proposal) return await ctx.runMutation(refs.admitPreparedModelOperation, { ...attempt, operationId: op.operationId, ordinal: args.ordinal,
      requestCanonical: request.requestCanonical, snapshotCanonical: request.snapshotCanonical,
      bindingCanonical: canonicalModelJson({ reference: request.reference, operationKey: request.operationKey, runBudgetId: request.runBudgetId,
        semanticId: request.semanticId, ordinal: request.ordinal, ...(request.source !== undefined ? { source: request.source } : {}),
        ...(request.parentOperationId !== undefined ? { parentOperationId: request.parentOperationId } : {}) }) });
    return await ctx.runMutation(refs.admitModelOperation, { ...attempt, operationId: op.operationId, ordinal: args.ordinal,
      requestCanonical: request.requestCanonical, snapshotCanonical: request.snapshotCanonical });
  });
  const proposals = proposal ? [proposal.initialResolution, proposal.governedResolution] : [];
  const resolve: GatewayLedgerPort["resolve"] = async request => {
    // Two original native checks were executed sequentially in preparation.
    // Consume their model proposals only here; replay resolves freshly again.
    const result = proposals.shift() ?? await ctx.runQuery(refs.resolveModelOperation, { ...attempt, runBudgetId: request.runBudgetId });
    if (canonicalModelJson(request.reference) !== canonicalModelJson(args.reference) || request.operationKey !== "agent.respond"
      || request.runBudgetId !== current.run.runBudgetId || request.source !== undefined || request.parentOperationId !== undefined) transcriptDenied("POLICY_DENIED");
    if (result.storageLimits.embeddingValuesPerCall !== 1) throw new GatewayDispatchError("CAPABILITY_UNAVAILABLE");
    return { ...result, storageLimits: { ...result.storageLimits, embeddingValuesPerCall: 1 } };
  };
  const resolution = await resolve({ reference: args.reference, operationKey: "agent.respond", runBudgetId: current.run.runBudgetId });
  const governed = await createGovernedGatewayModel({ ...base, ledger: { ...base.ledger,
    resolve,
    // The native mutation repeats the complete current Agent fence atomically.
    markVisible: async request => await base.ledger.markVisible(request),
    attachTerminalResult: async request => { await guard(); return await base.ledger.attachTerminalResult(request); },
  } }, { reference: args.reference, operationKey: "agent.respond", runBudgetId: current.run.runBudgetId,
    semanticId: op.semanticId, ordinal: args.ordinal });
  let cancellationBridge: ReturnType<typeof createAgentGatewayCancellationBridge> | undefined;
  let chunkQueue = Promise.resolve();
  try {
    if (governed.model.specificationVersion !== "v4" || !("doGenerate" in governed.model) || !("doStream" in governed.model)) transcriptDenied("CAPABILITY_UNAVAILABLE");
    cancellationBridge = createAgentGatewayCancellationBridge(governed.model, governed.lifecycle);
    const agent = new Agent(agentComponent, { name: attemptName(args, args.ordinal), languageModel: cancellationBridge.model,
    tools: serverTools(current.definition.tools.map(tool => tool.toolId as keyof typeof NATIVE_TOOL_NAMES)),
    contextOptions: { recentMessages: 0 }, storageOptions: { saveMessages: "promptAndOutput" },
    contextHandler: async () => {
      const fresh = await ctx.runQuery(refs.hydrate, attempt);
      return [...fresh.messages, ...(fresh.execution.contextCanonical ? [{ role: "system" as const, content: `Authorized Cortex context (untrusted evidence):\n${fresh.execution.contextCanonical}` }] : [])];
    } });
  let pending: unknown[] = []; let lastFlush = Date.now(); let firstTextPublished = false;
  const allowedTools = current.definition.tools.map(tool => NATIVE_TOOL_NAMES[tool.toolId as keyof typeof NATIVE_TOOL_NAMES]);
  const knownToolCalls: Record<string, string> = Object.create(null) as Record<string, string>;
  async function flush() {
    if (!pending.length) return;
    // SDK finish-step parts contain Date/provider objects that Convex cannot
    // serialize. Construct safe primitives before the RPC, then let the native
    // mutation repeat the current-authority and public projection checks.
    const projected = projectNativeOutputParts(pending, allowedTools, knownToolCalls); pending = [];
    const parts = projected.map(part => {
      if (part.type !== "tool") return part; // Text/error DTOs are projection-idempotent.
      knownToolCalls[part.toolCallId] = part.name;
      // Preserve model-origin phases through the mutation's native projector.
      // Approved/running phases can only be written by server tool receipts.
      const type = part.phase === "requested" ? "tool-call" : part.phase === "succeeded" ? "tool-result" : part.phase === "failed" ? "tool-output-error" : undefined;
      if (!type) transcriptDenied("INVALID_MODEL_OUTPUT");
      return { type, toolCallId: part.toolCallId, toolName: part.name };
    });
    if (parts.length) {
      await ctx.runMutation(refs.output, { ...attempt, parts });
      if (projected.some(part => (part.type === "text" || part.type === "text-delta") && part.text.length > 0)) firstTextPublished = true;
    }
    lastFlush = Date.now();
  }
  const onChunk = ({ chunk }: { chunk: unknown }) => {
    // Serialize publication even if callbacks overlap; a failed write stops the
    // queue and cleanup joins it before releasing the governed lifecycle.
    chunkQueue = chunkQueue.then(async () => {
      pending.push(chunk);
      const firstText = !firstTextPublished && projectNativeOutputParts([chunk], allowedTools, knownToolCalls)
        .some(part => (part.type === "text" || part.type === "text-delta") && part.text.length > 0);
      if (firstText || pending.length >= 32 || Date.now() - lastFlush >= 250) await flush();
    });
    return chunkQueue;
  };
    const identity = { threadId: current.threadId, userId: args.reference.principalId };
    const parameters = { promptMessageId: current.run.inputMessageIds[current.run.inputMessageIds.length - 1], instructions: current.definition.instructions.text,
        maxOutputTokens: Math.min(resolution.snapshot.limits.outputTokens, resolution.dispatchEvidence.resultBound.maximumOutputTokens),
        maxRetries: 0, stopWhen: isStepCount(1) };
    const result = current.execution.streaming
      ? await agent.streamText(ctx, identity, { ...parameters,
        onChunk },
        { saveStreamDeltas: { throttleMs: 250, returnImmediately: false, sendSources: false,
          // Agent's default word smoothing can hold a whitespace-free fragment
          // until text-end, which follows governed terminal persistence.
          chunking: (buffer: string) => buffer.length ? buffer : null } })
      : await agent.generateText(ctx, identity, parameters);
    const calls = (await result.toolCalls).map(call => ({ toolCallId: call.toolCallId, toolName: call.toolName, inputCanonical: canonicalModelJson(call.input) }));
    if (!current.execution.streaming) {
      const text = await result.text;
      if (text) pending.push({type: "text", text});
      for (const call of calls) pending.push({type: "tool-call", toolCallId: call.toolCallId, toolName: call.toolName});
    }
    await chunkQueue; await flush();
    const savedMessageIds = (result.savedMessages ?? []).map(message => message._id);
    const value: StepResult = { savedMessageIds, calls, final: calls.length === 0 };
    if (value.final && !(await result.text).trim()) throw new Error("INVALID_MODEL_OUTPUT");
    await ctx.runMutation(refs.finish, { ...attempt, operationId: op.operationId, resultCanonical: canonicalModelJson(value), nativeMessageIds: savedMessageIds }); return value;
  } finally { try { await chunkQueue; } finally { try { await governed.lifecycle.complete(); } finally { cancellationBridge?.dispose(); } } }
}
export const modelStep = internalAction({ args: { ...agentAttempt, ordinal: v.number() }, handler: modelStepHandler });
/** No Action retry: partial/unknown effects remain owned by the original native
 * operation ledger and explicit reconciliation, never replayed automatically. */
export async function turnStepV5Handler(ctx: ActionCtx, args: Attempt & { ordinal: number }): Promise<StepResult> {
  const attempt = attemptArgs(args);
  traceRuntimePhase(args.runId, args.attemptNumber, "turn.prepare.begin");
  let prepared = args.ordinal === 0
    ? await ctx.runMutation(refs.prepareTurnModel, attempt)
    : await ctx.runMutation(refs.prepareResolvedModelOperation, { ...attempt, ordinal: args.ordinal });
  if (prepared.state === "failed_context") {
    await ctx.runMutation(ref<"mutation", Attempt & { failureCode: "CONTEXT_OVERFLOW" }, null>("mutation", "runtimeAgent:failContext"), { ...attempt, failureCode: prepared.failureCode });
    transcriptDenied(prepared.failureCode);
  }
  if (prepared.state === "needs_context") {
    await prepareContextHandler(ctx, attempt);
    prepared = await ctx.runMutation(refs.prepareResolvedModelOperation, { ...attempt, ordinal: args.ordinal });
  }
  traceRuntimePhase(args.runId, args.attemptNumber, "turn.prepare.end");
  traceRuntimePhase(args.runId, args.attemptNumber, "turn.model.begin");
  const result = await executePreparedModelStep(ctx, args, prepared, prepared.state === "started" ? prepared : undefined);
  traceRuntimePhase(args.runId, args.attemptNumber, "turn.model.end");
  if (result.final) {
    await ctx.runMutation(refs.finalize, { ...attempt, finalMessageIds: result.savedMessageIds });
    try {
      traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.begin");
      await ctx.runMutation(ref<"mutation", { reference: RuntimeAuthorityReference; runId: string }, string | null>("mutation", "runtimeContentJobs:enqueueParentTitle"), { reference: args.reference, runId: args.runId });
    } catch { /* Optional title failure cannot roll back the canonical answer. */ }
    finally { traceRuntimePhase(args.runId, args.attemptNumber, "title.enqueue.end"); }
  }
  return result;
}
export const turnStepV5 = internalAction({ args: { ...agentAttempt, ordinal: v.number() }, handler: turnStepV5Handler });

export async function toolStepHandler(ctx: ActionCtx, args: Attempt & { ordinal: number; call: ToolCall }): Promise<null> {
  const attempt = attemptArgs(args);
  const current = await ctx.runQuery(refs.hydrate, attempt); const op = await ctx.runMutation(refs.begin, { ...attempt, ordinal: args.ordinal, kind: "tool", toolName: args.call.toolName,
    toolCallId: args.call.toolCallId, requestCanonical: args.call.inputCanonical });
  if (op.state === "complete") return null;
  await ctx.runMutation(ref<"mutation", Attempt & { operationId: string }, null>("mutation", "runtimeAgent:startOperation"), { ...attempt, operationId: op.operationId });
  const parent = await ctx.runQuery(ref<"query", Attempt & { ordinal: number }, import("./_generated/dataModel").Id<"runtimeModelOperations">>("query", "runtimeAgent:toolParent"), { ...attempt, ordinal: args.ordinal });
  const observed = await executeServerTool(ctx, { reference: args.reference, runBudgetId: current.run.runBudgetId, operationId: op.operationId,
    parentOperationId: parent, runAccountId: current.run.runAccountId, conversationId: current.run.conversationId, witnesses: current.execution.sourceWitnesses,
    checkCurrent: async () => { await ctx.runQuery(ref<"query", Attempt & { operationId: string }, null>("query", "runtimeAgent:checkActiveTool"), { ...attempt, operationId: op.operationId }); },
    writeSource: async source => await ctx.runMutation(ref<"mutation", Attempt & { operationId: string; source: import("../src/domain/contracts").SourceContent }, Awaited<ReturnType<import("../src/domain/contracts").MemoryRepository["putSource"]>>>("mutation", "runtimeAgent:writeToolSource"), { ...attempt, operationId: op.operationId, source }),
    commitDerived: async input => await ctx.runMutation(ref<"mutation", Attempt & { operationId: string; input: Parameters<import("../src/domain/contracts").MemoryRepository["commitDerived"]>[0] }, Awaited<ReturnType<import("../src/domain/contracts").MemoryRepository["commitDerived"]>>>("mutation", "runtimeAgent:writeToolDerived"), { ...attempt, operationId: op.operationId, input }),
  },
    semanticToolName(args.call.toolName), JSON.parse(args.call.inputCanonical));
  await ctx.runMutation(ref<"mutation", Attempt & { operationId: string; witnesses: Witness[]; artifactWitnesses?: ArtifactContextWitness[] }, null>("mutation", "runtimeAgent:rememberToolSources"),
    { ...attempt, operationId: op.operationId, witnesses: observed.witnesses, ...("artifactWitnesses" in observed ? { artifactWitnesses: observed.artifactWitnesses } : {}) });
  const result = observed.result;
  const saved = await saveMessages(ctx, agentComponent, { threadId: current.threadId, userId: args.reference.principalId, order: current.snapshot.anchor.order,
    agentName: attemptName(args, args.ordinal), messages: [{ role: "tool", content: [{ type: "tool-result", toolCallId: args.call.toolCallId,
      toolName: args.call.toolName, output: { type: "json", value: result } }] }], failPendingSteps: false });
  await ctx.runMutation(refs.finish, { ...attempt, operationId: op.operationId, resultCanonical: canonicalModelJson(result), nativeMessageIds: saved.messages.map(message => message._id) }); return null;
}
export const toolStep = internalAction({ args: { ...agentAttempt, ordinal: v.number(), call: v.object({ toolCallId: v.string(), toolName: v.string(), inputCanonical: v.string() }) }, handler: toolStepHandler });
async function currentToolPermission(ctx: Pick<QueryCtx, "db">, args: Attempt, current: Awaited<ReturnType<typeof executionContext>>, op: Doc<"runtimeAgentOperations">) {
  const definition = current.definition.tools.find(tool => tool.toolId === semanticToolName(op.toolName ?? ""));
  if (!definition) transcriptDenied("TOOL_DENIED");
  await recheckAuthority(ctx, args.reference, { capability: "tool", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  await recheckAuthority(ctx, args.reference, { capability: definition.toolId === "memory.remember" || definition.toolId.startsWith("media.") ? "write" : "read", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  if (definition.approval === "explicit") {
    if (!op.approvalActor) transcriptDenied("APPROVAL_REQUIRED");
    await recheckAuthority(ctx, op.approvalActor, { capability: "admin", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  }
}
export const checkActiveTool = internalQuery({ args: { ...agentAttempt, operationId: v.string() }, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args); const op = await operation(ctx, args, args.operationId);
  if (op.kind !== "tool" || op.state !== "started") transcriptDenied("TOOL_DENIED");
  await currentToolPermission(ctx, args, current, op); return null;
} });
async function toolWriteFence(ctx: MutationCtx, args: Attempt & { operationId: string }, sourceId: string) {
  const current = await executionContext(ctx, args); const op = await operation(ctx, args, args.operationId);
  if (op.kind !== "tool" || op.state !== "started" || op.toolName !== "memory_remember"
    || serverToolSourceLineage(memoryScope(args.reference), op.operationId).sourceId !== sourceId) transcriptDenied("TOOL_DENIED");
  await currentToolPermission(ctx, args, current, op);
  return current;
}
/** The attempt/source fence and effect commit share the same native mutation, closing the query→write cancellation race. */
export const writeToolSource = internalMutation({ args: { ...agentAttempt, operationId: v.string(), source: sourceContent }, handler: async (ctx, args) => {
  const current = await toolWriteFence(ctx, args, args.source.lineage.sourceId);
  const op = await operation(ctx, args, args.operationId); const requested = validateToolInput("memory.remember", JSON.parse(op.requestCanonical));
  const expected = serverToolSourceLineage(memoryScope(args.reference), op.operationId);
  if (canonicalModelJson(args.source.lineage) !== canonicalModelJson(expected) || args.source.content !== requested.text.normalize("NFC").replace(/\r\n?/g, "\n").trim()) transcriptDenied("TOOL_DENIED");
  return await new ConvexMemoryRepository(ctx, args.reference, "write", ctx.db).putSource({ ...args.source,
    contextSourceWitnesses: current.execution.sourceWitnesses, ...(current.execution.artifactContextWitnesses?.length ? { artifactContextWitnesses: current.execution.artifactContextWitnesses } : {}) });
} });
export const writeToolDerived = internalMutation({ args: { ...agentAttempt, operationId: v.string(), input: commitDerivedInput }, handler: async (ctx, args) => {
  await toolWriteFence(ctx, args, args.input.source.sourceId);
  return await new ConvexMemoryRepository(ctx, args.reference, "write", ctx.db).commitDerived(args.input);
} });
export const rememberToolSources = internalMutation({ args: { ...agentAttempt, operationId: v.string(), witnesses: v.array(sourceWitness), artifactWitnesses: v.optional(v.array(artifactContextWitness)) }, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args); const op = await operation(ctx, args, args.operationId);
  if (op.kind !== "tool" || op.state !== "started") transcriptDenied("INVALID_STATE");
  const merged = new Map(current.execution.sourceWitnesses.map(source => [source.sourceId, source]));
  for (const witness of args.witnesses) {
    const combined = mergeContextWitness(merged.get(witness.sourceId), witness); if (!combined) transcriptDenied("STALE_CONTEXT");
    merged.set(witness.sourceId, combined);
  }
  if (merged.size > 32) transcriptDenied("CONTEXT_LIMIT_EXCEEDED");
  const sourceWitnesses = [...merged.values()]; await checkWitnesses(ctx, args, sourceWitnesses);
  const artifacts = new Map((current.execution.artifactContextWitnesses ?? []).map(witness => [witness.artifactId, witness]));
  for (const witness of args.artifactWitnesses ?? []) {
    const prior = artifacts.get(witness.artifactId);
    if (prior && canonicalModelJson(prior) !== canonicalModelJson(witness)) transcriptDenied("STALE_CONTEXT");
    artifacts.set(witness.artifactId, witness);
  }
  const artifactContextWitnesses = [...artifacts.values()]; await checkArtifactContextWitnesses(ctx, args.reference, artifactContextWitnesses);
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { sourceWitnesses, artifactContextWitnesses, updatedAt: Date.now() }); return null;
} });
export const toolParent = internalQuery({ args: { ...agentAttempt, ordinal: v.number() }, handler: async (ctx, args) => {
  await executionContext(ctx, args);
  const model = singleTranscript(await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("runId", args.runId).eq("attemptNumber", args.attemptNumber).eq("kind", "model").eq("ordinal", args.ordinal)).take(2));
  if (!model || model.state !== "complete" || !model.nativeModelOperationId) transcriptDenied("INVALID_STATE");
  return model.nativeModelOperationId;
} });
export const waitForApproval = internalMutation({ args: { ...agentAttempt, operationId: v.string() }, handler: async (ctx, args) => {
  const current = await executionContext(ctx, args); const op = await operation(ctx, args, args.operationId); if (op.state !== "waiting_approval") transcriptDenied("INVALID_STATE");
  const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("runId", args.runId)).take(2));
  if (!outbox || outbox.state !== "claimed" || outbox.leaseVersion !== args.leaseVersion || outbox.leaseExpiresAt === undefined || Date.now() >= outbox.leaseExpiresAt) transcriptDenied("LEASE_EXPIRED");
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { state: "waiting_approval", updatedAt: Date.now() });
  await ctx.db.patch("runtimeRuns", current.run._id, { responseStatus: "waiting_approval", updatedAt: Date.now() });
  await ctx.scheduler.runAfter(outbox.leaseExpiresAt - Date.now(), ref<"mutation", Attempt & { leaseExpiresAt: number }, null>("mutation", "runtimeAgent:expireApproval"),
    { ...attemptArgs(args), leaseExpiresAt: outbox.leaseExpiresAt });
  await writeParts(ctx, current.execution, [{ type: "status", state: "waiting_approval" }]); return null;
} });
/** The scheduled callback owns only this admitted wait, never authority to renew or retry it. */
export const expireApproval = internalMutation({ args: { ...agentAttempt, leaseExpiresAt: v.number() }, handler: async (ctx, args) => {
  const owned = await execution(ctx, args);
  if (owned.state !== "waiting_approval") return null;
  const row = singleTranscript(await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", owned.tenantId)
    .eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId)).take(2));
  const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", owned.tenantId)
    .eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId)).take(2));
  if (!row || row.attemptNumber !== args.attemptNumber || row.responseStatus !== "waiting_approval" || !outbox || outbox.state !== "claimed"
    || outbox.leaseVersion !== args.leaseVersion || outbox.leaseExpiresAt !== args.leaseExpiresAt) return null;
  const now = Date.now();
  if (now < args.leaseExpiresAt) {
    await ctx.scheduler.runAfter(args.leaseExpiresAt - now, ref<"mutation", Attempt & { leaseExpiresAt: number }, null>("mutation", "runtimeAgent:expireApproval"), args);
    return null;
  }
  try { await ctx.runMutation(ref<"mutation", { reference: RuntimeAuthorityReference; runBudgetId: string }, unknown>("mutation", "runtimeModelPolicy:cancelBudget"),
    { reference: owned.reference, runBudgetId: row.runBudgetId }); }
  catch (error) {
    // Revocation already prevents new admissions. It must not prevent the owned
    // timer from retiring the wait; terminal evidence can still settle liability.
    if (!(error instanceof ConvexError) || !["FORBIDDEN", "POLICY_DENIED", "CAPABILITY_UNAVAILABLE"].includes(error.data.code as string)) throw error;
  }
  await ctx.db.patch("runtimeRuns", row._id, { responseStatus: "cancelled", failureCode: "APPROVAL_EXPIRED", cancellationRequestedAt: now, cancelledAt: now, updatedAt: now });
  await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "complete", updatedAt: now });
  const attempt = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", owned.tenantId)
    .eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId).eq("attemptNumber", args.attemptNumber)).take(2));
  if (attempt?.leaseVersion === args.leaseVersion && attempt.status === "running") await ctx.db.patch("runtimeRunAttempts", attempt._id,
    { status: "cancelled", failureCode: "APPROVAL_EXPIRED", endedAt: now });
  await ctx.db.patch("runtimeAgentExecutions", owned._id, { state: "cancelled", failureCode: "APPROVAL_EXPIRED", updatedAt: now });
  await writeParts(ctx, owned, [{ type: "status", state: "cancelled" }]);
  if (owned.workflowId) { try { await workflow.cancel(ctx, owned.workflowId as WorkflowId); } catch { /* The retired run and budget remain fenced if Workflow already finished. */ } }
  await ctx.scheduler.runAfter(0, ref<"mutation", { reference: RuntimeAuthorityReference; conversationId: string }, unknown>("mutation", "runs:recoverOwnedQueue"),
    { reference: owned.reference, conversationId: row.conversationId });
  return null;
} });
export const approveTool = mutation({ args: { ...selector, operationId: v.string(), expectedRequestHash: v.string() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "admin"); const reference = dataAuthorityReference(actor);
  const current = await currentRun(ctx, reference, args.runId, "run"); await checkConversation(ctx, reference, current.conversation, "admin");
  const owned = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("runId", args.runId).eq("attemptNumber", current.row.attemptNumber)).take(2));
  if (!owned || owned.state !== "waiting_approval" || !owned.workflowId || current.row.responseStatus !== "waiting_approval" || current.row.cancellationRequestedAt !== undefined) transcriptDenied("INVALID_STATE");
  const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId)).take(2));
  if (!outbox || outbox.state !== "claimed" || outbox.leaseVersion !== owned.leaseVersion || outbox.leaseExpiresAt === undefined || Date.now() >= outbox.leaseExpiresAt) transcriptDenied("LEASE_EXPIRED");
  const admitted = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", owned.tenantId)
    .eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId).eq("attemptNumber", owned.attemptNumber)).take(2));
  if (!admitted || admitted.status !== "running" || admitted.leaseVersion !== owned.leaseVersion) transcriptDenied("INVALID_STATE");
  const attempt = { reference: owned.reference, runId: owned.runId, attemptNumber: owned.attemptNumber, leaseVersion: owned.leaseVersion };
  const op = await operation(ctx, attempt, args.operationId);
  if (op.state !== "waiting_approval" || await semanticHash(op.requestCanonical) !== args.expectedRequestHash) transcriptDenied("POLICY_DENIED");
  if (!current.row.snapshotCanonical) transcriptDenied("STALE_TRANSCRIPT");
  await hydratePrivateCutoff(ctx, current.conversation, current.row, JSON.parse(current.row.snapshotCanonical) as CutoffV1);
  await checkWitnesses(ctx, attempt, owned.sourceWitnesses);
  await checkArtifactContextWitnesses(ctx, owned.reference, owned.artifactContextWitnesses ?? []);
  await recheckAuthority(ctx, owned.reference, { capability: "tool", tenantId: owned.tenantId, memorySpaceId: owned.memorySpaceId });
  await ctx.db.patch("runtimeAgentOperations", op._id, { state: "approved", approvalActor: reference });
  await ctx.db.patch("runtimeRuns", current.row._id, { responseStatus: "running", updatedAt: Date.now() });
  await ctx.db.patch("runtimeRunOutbox", outbox._id, { leaseExpiresAt: Date.now() + 300_000 });
  await ctx.db.patch("runtimeAgentExecutions", owned._id, { state: "running", updatedAt: Date.now() });
  await writeParts(ctx, owned, [{ type: "tool", toolCallId: op.toolCallId!, name: op.toolName!, phase: "approved" }, { type: "status", state: "running" }]);
  await workflow.sendEvent(ctx, { workflowId: owned.workflowId as WorkflowId, name: op.operationId, value: "approved" }); return { approved: true as const };
} });
export async function finalizeExecution(ctx: MutationCtx, args: Attempt & { finalMessageIds: string[] }, reconcile = false) {
  traceRuntimePhase(args.runId, args.attemptNumber, "finalize.begin");
  const prior = singleTranscript(await ctx.db.query("runtimeAgentIngestion").withIndex("by_run", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("runId", args.runId)).take(2));
  const identityCanonical = canonicalModelJson([args.runId, args.attemptNumber, args.finalMessageIds]);
  if (prior) { await currentRun(ctx, args.reference, args.runId, "run"); if (prior.identityCanonical !== identityCanonical) transcriptDenied("IDEMPOTENCY_CONFLICT"); return { receiptId: prior.receiptId }; }
  const current = await executionContext(ctx, args, reconcile);
  if (!args.finalMessageIds.length || new Set(args.finalMessageIds).size !== args.finalMessageIds.length || args.finalMessageIds.some(id => !current.execution.savedMessageIds.includes(id))) transcriptDenied("STALE_TRANSCRIPT");
  const saved = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: current.execution.savedMessageIds });
  const messages: MessageDoc[] = [];
  for (const message of saved) { if (!message || message.status !== "success") transcriptDenied("STALE_TRANSCRIPT"); messages.push(message); }
  const final = messages.filter(message => args.finalMessageIds.includes(message._id));
  if (final.length !== args.finalMessageIds.length || final.some(message => message.message?.role !== "assistant" || typeof message.message.content !== "string"
    && message.message.content.some(part => part.type !== "text" && part.type !== "reasoning"))) transcriptDenied("INVALID_MODEL_OUTPUT");
  const text = final.map(message => typeof message.message!.content === "string" ? message.message!.content
    : message.message!.content.filter(part => part.type === "text").map(part => part.text).join("")).join("\n");
  if (!text.trim() || utf8Bytes(text) > 180_000) transcriptDenied("INVALID_MODEL_OUTPUT");
  // All canonical assistant calls/tool results and final text register once in this parent mutation.
  const conversation = await conversationById(ctx, args.reference, current.run.conversationId); if (!conversation) transcriptDenied();
  const pins = await registerMessages(ctx, conversation, args.reference,
    messages, { runId: args.runId, attemptNumber: args.attemptNumber, trustedToolMessages: true, contextSourceWitnesses: current.execution.sourceWitnesses, artifactContextWitnesses: current.execution.artifactContextWitnesses });
  const receiptId = `agent-ingestion:${await semanticHash(identityCanonical)}`;
  await ctx.db.insert("runtimeAgentIngestion", { tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId!, runId: args.runId,
    attemptNumber: args.attemptNumber, receiptId, identityCanonical, outputMessageIds: args.finalMessageIds,
    sourceEvents: pins.map(pin => ({ sourceEventId: pin.sourceEventId, sourceRevision: pin.sourceRevision })), state: "pending", createdAt: Date.now() });
  await ctx.db.patch("runtimeRuns", current.run._id, { responseStatus: "complete", outputMessageIds: args.finalMessageIds, updatedAt: Date.now() });
  const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", args.reference.tenantId).eq("memorySpaceId", args.reference.memorySpaceId!).eq("runId", args.runId)).take(2));
  if (!outbox) transcriptDenied(); await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "complete", updatedAt: Date.now() });
  const attempt = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", args.reference.tenantId).eq("memorySpaceId", args.reference.memorySpaceId!).eq("runId", args.runId).eq("attemptNumber", args.attemptNumber)).take(2));
  if (!attempt) transcriptDenied(); await ctx.db.patch("runtimeRunAttempts", attempt._id, { status: "complete", endedAt: Date.now() });
  await ctx.db.patch("runtimeAgentExecutions", current.execution._id, { state: "complete", finalMessageIds: args.finalMessageIds, ingestionReceiptId: receiptId, updatedAt: Date.now() });
  // This complete text is an allowlisted projection of the canonical Agent output.
  // It also survives a saved-message gap with no previously published deltas.
  const finalParts: AgentPublicPart[] = []; let chunk = "";
  for (const character of text) { if (utf8Bytes(chunk + character) > 15_000) { finalParts.push({ type: "text", text: chunk }); chunk = ""; } chunk += character; }
  if (chunk) finalParts.push({ type: "text", text: chunk });
  await writeParts(ctx, current.execution, [...finalParts, { type: "status", state: "complete" }], true);
  await ctx.scheduler.runAfter(0, ref<"mutation", { reference: RuntimeAuthorityReference; conversationId: string }, unknown>("mutation", "runs:recoverQueue"),
    { reference: args.reference, conversationId: current.run.conversationId });
  traceRuntimePhase(args.runId, args.attemptNumber, "finalize.end"); return { receiptId };
}
export const finalize = internalMutation({ args: { ...agentAttempt, finalMessageIds: v.array(v.string()) }, handler: async (ctx, args) => await finalizeExecution(ctx, args) });
/** Reconcile a component-save/Core-commit gap by the server-owned Agent generation label.
 * It never starts a model/tool call. Pending/error/tool-call-only outputs remain unknown. */
export const reconcile = mutation({ args: selector, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "run"); const current = await currentRun(ctx, dataAuthorityReference(actor), args.runId, "run");
  const owned = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", current.row.tenantId).eq("memorySpaceId", current.row.memorySpaceId).eq("runId", args.runId).eq("attemptNumber", current.row.attemptNumber)).take(2));
  if (!owned) transcriptDenied("INVALID_STATE");
  const attempt = { reference: owned.reference, runId: owned.runId, attemptNumber: owned.attemptNumber, leaseVersion: owned.leaseVersion };
  if (owned.state === "complete" && owned.ingestionReceiptId) return { receiptId: owned.ingestionReceiptId };
  const fenced = await executionContext(ctx, attempt, true);
  const operations = await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId).eq("attemptNumber", owned.attemptNumber).eq("kind", "model")).take(34);
  const last = operations.sort((a, b) => b.ordinal - a.ordinal)[0];
  if (!last || !["started", "unknown", "complete"].includes(last.state)) transcriptDenied("RECONCILIATION_INCOMPLETE");
  let cursor: string | null = null; const recovered: MessageDoc[] = []; let scanned = 0;
  do {
    const page: { page: MessageDoc[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(agentComponent.messages.listMessagesByThreadId,
      { threadId: fenced.threadId, order: "desc", statuses: ["success"], upToAndIncludingMessageId: fenced.snapshot.anchor.nativeMessageId, paginationOpts: { cursor, numItems: 100 } });
    // The native query bounds order <= anchor (including every same-order step).
    // Stop once descending pages reach older history; unrelated retained failures
    // and older successful turns cannot exhaust current-generation recovery.
    const currentOrder = page.page.filter(message => message.order === fenced.snapshot.anchor.order);
    scanned += currentOrder.length; if (scanned > 1000) transcriptDenied("RECONCILIATION_INCOMPLETE");
    for (const message of page.page) if (message.agentName === attemptName(attempt, last.ordinal) && message.order === fenced.snapshot.anchor.order
      && comparePosition(message, fenced.snapshot.anchor) > 0 && message.message?.role === "assistant") recovered.push(message);
    if (page.isDone || page.page.some(message => message.order < fenced.snapshot.anchor.order)) break; if (!page.continueCursor || page.continueCursor === cursor) transcriptDenied("RECONCILIATION_INCOMPLETE"); cursor = page.continueCursor;
  } while (true);
  if (!recovered.length || recovered.some(message => message.status !== "success" || !message.message || typeof message.message.content !== "string"
    && message.message.content.some(part => part.type !== "text" && part.type !== "reasoning"))) transcriptDenied("RECONCILIATION_INCOMPLETE");
  const ids = recovered.map(message => message._id);
  await ctx.db.patch("runtimeAgentOperations", last._id, { state: "complete", nativeMessageIds: ids, endedAt: Date.now() });
  const pins = new Map((owned.savedMessagePins ?? []).map(pin => [pin.id, pin]));
  for (const message of recovered) pins.set(message._id, { id: message._id, order: message.order, stepOrder: message.stepOrder, canonicalContentHash: await canonicalMessageHash(message) });
  await ctx.db.patch("runtimeAgentExecutions", owned._id, { savedMessageIds: [...new Set([...owned.savedMessageIds, ...ids])], savedMessagePins: [...pins.values()], state: "finalizing", updatedAt: Date.now() });
  return await finalizeExecution(ctx, attemptWithFinal(attempt, ids), true);
} });
function attemptWithFinal(args: Attempt, ids: string[]) { return { ...args, finalMessageIds: ids }; }
export const endInterrupted = internalMutation({ args: { ...agentAttempt, cancelled: v.boolean() }, handler: async (ctx, args) => {
  const owned = await execution(ctx, args); if (owned.state === "complete" || owned.state === "cancelled" || !args.cancelled && ["failed", "unknown"].includes(owned.state)) return null;
  const row = singleTranscript(await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId)).take(2));
  const operations = await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId).eq("attemptNumber", owned.attemptNumber)).take(100);
  const uncertain = owned.contextState === "started" || operations.some(op => op.state === "started" || op.state === "unknown");
  for (const op of operations) if (op.state === "started") await ctx.db.patch("runtimeAgentOperations", op._id, { state: "unknown", endedAt: Date.now() });
  const cancelled = args.cancelled || row?.cancellationRequestedAt !== undefined || row?.responseStatus === "cancelled";
  const state = cancelled ? "cancelled" : uncertain ? "unknown" : "failed";
  const failureCode = uncertain ? "INTERRUPTED_REQUIRES_RECONCILIATION" : cancelled ? "CANCELLED" : owned.contextFailureCode ?? "EXECUTION_FAILED";
  await ctx.db.patch("runtimeAgentExecutions", owned._id, { state, failureCode, updatedAt: Date.now() });
  await writeParts(ctx, owned, [{ type: "status", state }, ...(cancelled ? [] : [{ type: "error" as const, code: "RUNTIME_OUTPUT_FAILED" as const }])]);
  if (row && row.attemptNumber === args.attemptNumber && row.responseStatus !== "complete") {
    await ctx.db.patch("runtimeRuns", row._id, { responseStatus: cancelled ? "cancelled" : "failed", failureCode, updatedAt: Date.now() });
    const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId)).take(2));
    if (outbox) await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "complete", updatedAt: Date.now() });
    const attempt = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", owned.runId).eq("attemptNumber", owned.attemptNumber)).take(2));
    if (attempt) await ctx.db.patch("runtimeRunAttempts", attempt._id, { status: cancelled ? "cancelled" : "failed", failureCode, endedAt: Date.now() });
    await ctx.scheduler.runAfter(0, ref<"mutation", { reference: RuntimeAuthorityReference; conversationId: string }, unknown>("mutation", "runs:recoverQueue"),
      { reference: owned.reference, conversationId: row.conversationId });
  }
  return null;
} });
export const onWorkflowComplete = internalMutation({ args: { workflowId: v.string(), context: v.any(), result: v.any() }, handler: async (ctx, args) => {
  const context = args.context as Attempt; const owned = await execution(ctx, context); if (owned.workflowId !== args.workflowId) transcriptDenied();
  if (owned.state !== "complete") await ctx.runMutation(refs.end, { ...context, cancelled: (args.result as { kind?: string }).kind === "canceled" }); return null;
} });
/** Immediate start can fail before start returns its ID. Only the actual completed
 * fresh Workflow document may attach that ID; the original strict callback then runs. */
export const onInitialWorkflowComplete = internalMutation({ args: { workflowId: v.string(), context: v.object(agentAttempt),
  result: v.union(v.object({ kind: v.literal("success"), returnValue: v.null() }), v.object({ kind: v.literal("failed"), error: v.string() }), v.object({ kind: v.literal("canceled") })) }, handler: async (ctx, args) => {
  const owned = await execution(ctx, args.context);
  if (owned.workflowId === undefined) {
    const { workflow: completed, inProgress } = await ctx.runQuery(workflowComponent.workflow.getStatus, { workflowId: args.workflowId });
    if (owned.state !== "ready" || completed._id !== args.workflowId || completed.generationNumber !== 0 || inProgress.length
      || completed.workflowHandle !== await createFunctionHandle(freshWorkflow) || completed.onComplete?.fnHandle !== await createFunctionHandle(freshWorkflowComplete)
      || canonicalModelJson(completed.args) !== canonicalModelJson(args.context) || canonicalModelJson(completed.onComplete?.context) !== canonicalModelJson(args.context)
      || canonicalModelJson(completed.runResult) !== canonicalModelJson(args.result)) transcriptDenied();
    await ctx.db.patch("runtimeAgentExecutions", owned._id, { workflowId: args.workflowId });
  }
  return await ctx.runMutation(ref<"mutation", WorkflowCompletion, null>("mutation", "runtimeAgent:onWorkflowComplete"), args);
} });
export async function observeHandler(ctx: QueryCtx, args: { runId: string; tenantId?: string; memorySpaceId?: string; afterSequence?: number; limit?: number; finalOnly?: boolean }) {
  const actor = await requireDataAuthority(ctx, args, "read"); const current = await currentControlRun(ctx, dataAuthorityReference(actor), args.runId, "read");
  const reference = dataAuthorityReference(actor), deadlines: number[] = [];
  await managedConversationAccess(ctx, reference, current.conversation, "read", undefined, deadlines);
  const after = args.afterSequence ?? 0, limit = args.limit ?? 100;
  if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) transcriptDenied("INVALID_INPUT");
  const owned = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", current.row.tenantId).eq("memorySpaceId", current.row.memorySpaceId).eq("runId", args.runId).eq("attemptNumber", current.row.attemptNumber)).take(2));
  if (owned) {
    await checkContextSourceWitnesses(ctx, reference, owned.sourceWitnesses, deadlines);
    await checkArtifactContextWitnesses(ctx, reference, owned.artifactContextWitnesses ?? [], deadlines);
    for (const part of await executionMediaReferences(ctx, owned)) {
      const job = await ctx.db.query("runtimeMediaJobs").withIndex("by_job", q => q.eq("jobId", part.jobId)).unique();
      if (!job || job.artifactId !== part.artifactId || job.kind !== part.kind) transcriptDenied("STALE_CONTEXT");
      await checkMediaJob(ctx, job, reference, false, deadlines);
    }
  }
  const finalOnly = !owned?.streaming || args.finalOnly;
  const rows = !owned || finalOnly && owned.state !== "complete" ? [] : finalOnly
    ? await ctx.db.query("runtimeAgentOutput").withIndex("by_delivery", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", args.runId).eq("attemptNumber", owned.attemptNumber).eq("final", true).gt("sequence", after)).take(limit)
    : await ctx.db.query("runtimeAgentOutput").withIndex("by_sequence", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", args.runId).eq("attemptNumber", owned.attemptNumber).gt("sequence", after)).take(limit);
  const approvals = !owned || owned.state !== "waiting_approval" ? [] : await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", owned.tenantId).eq("memorySpaceId", owned.memorySpaceId).eq("runId", args.runId).eq("attemptNumber", owned.attemptNumber).eq("kind", "tool")).take(32);
  // A bounded claim or pre-execution cancellation can retire the Core run
  // without creating an Agent execution. Observers still need its terminal
  // disposition; only a nonterminal, unowned run is not_started.
  const status = current.row.responseStatus;
  const state = owned?.state ?? (status === "complete" || status === "failed" || status === "cancelled" ? status : "not_started");
  const parts = [];
  for (const row of rows) {
    const part = JSON.parse(row.partCanonical) as AgentPublicPart;
    if (part.type === "media-job") {
      const job = await ctx.db.query("runtimeMediaJobs").withIndex("by_job", q => q.eq("jobId", part.jobId)).unique();
      if (!job || job.artifactId !== part.artifactId || job.kind !== part.kind) transcriptDenied("STALE_CONTEXT");
      await checkMediaJob(ctx, job, dataAuthorityReference(actor));
    }
    parts.push({ sequence: row.sequence, part });
  }
  const visibleApprovals = await Promise.all(approvals.filter(op => op.state === "waiting_approval").map(async op => ({ operationId: op.operationId, toolName: op.toolName, requestHash: await semanticHash(op.requestCanonical) })));
  const expiresAt = await deliveryExpiresAt(ctx, reference, deadlines);
  return { run: publicRun(current.row), state, parts,
    cursor: rows[rows.length - 1]?.sequence ?? after, approvals: visibleApprovals,
    ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
}
export const observe = mutation({ args: { ...selector, afterSequence: v.optional(v.number()), limit: v.optional(v.number()), finalOnly: v.optional(v.boolean()) }, handler: observeHandler });
export const cancel = mutation({ args: selector, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); const current = await currentControlRun(ctx, dataAuthorityReference(actor), args.runId, "write");
  await ctx.runMutation(ref<"mutation", typeof args, unknown>("mutation", "runs:cancel"), args);
  const owned = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", current.row.tenantId).eq("memorySpaceId", current.row.memorySpaceId).eq("runId", args.runId).eq("attemptNumber", current.row.attemptNumber)).take(2));
  if (owned && owned.state !== "complete") {
    if (current.row.snapshotCanonical) {
      const snapshot = JSON.parse(current.row.snapshotCanonical) as CutoffV1;
      // Budget cancellation is durable even if the component has already retired its stream.
      try { await abortStream(ctx, agentComponent, { threadId: current.conversation.threadId, order: snapshot.anchor.order, reason: "CANCELLED" }); } catch { /* Late native work remains fenced by the cancelled run budget. */ }
    }
    if (owned.workflowId) { try { await workflow.cancel(ctx, owned.workflowId as WorkflowId); } catch { /* A finished Workflow still has its run/budget fenced. */ } }
    await ctx.runMutation(refs.end, { reference: owned.reference, runId: owned.runId, attemptNumber: owned.attemptNumber, leaseVersion: owned.leaseVersion, cancelled: true });
  }
  return { cancelled: true as const };
} });
