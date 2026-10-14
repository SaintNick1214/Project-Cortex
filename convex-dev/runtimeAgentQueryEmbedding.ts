import { boundedRefusal, throwRefusal } from "./runtimeMemoryRefusal";
import type { Refusal } from "./runtimeMemoryRefusal";
export { boundedRefusal, throwRefusal } from "./runtimeMemoryRefusal";
export type { Refusal } from "./runtimeMemoryRefusal";
/** Private V6 query preparation. Proposals never grant authority to later dispatch or delivery. */
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { DomainClock } from "../src/domain/clock";
import type { MemoryModel, MemoryRepository } from "../src/domain/contracts";
import { normalizeSourceText, semanticHash } from "../src/domain/profile";
import { canonicalModelJson } from "../src/domain/model-policy";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { createAuthorityReadScope, createV8AuthorityReadScope } from "./runtimeAuth";
import { executionContext } from "./runtimeAgent";
import { withV8GatewayTerminalPorts } from "./runtimeGatewayBackend";
import { ConvexMemoryRepository, memoryError } from "./runtimeMemoryRepository";
import { admitHandler, readCurrentEmbeddingProfile, resolveHandler, MODEL_LEDGER_STORAGE_LIMITS } from "./runtimeModelPolicy";
import { assertGatewayReservedRequest, GatewayDispatchError } from "./runtimeGateway";
import type { GatewayAdmissionCheckpoint, GatewayBinding, GatewayCheckpoint, GatewayResolution } from "./runtimeGateway";
import { createGatewayMemoryModel } from "./runtimeMemoryGateway";
import { finishAgentRecall, finishAgentRecallV8 } from "./runtimeAgentRecall";
import type { AgentRecallSelection } from "./runtimeAgentRecall";
import { assertMemoryRequestId, finishRecallFromEmbedding } from "./runtimeMemoryServices";

export type AgentQueryEmbeddingAttempt = { reference: RuntimeAuthorityReference; runId: string; attemptNumber: number; leaseVersion: number };
type Input = { text: string; requestId: string; limit: number };
type EmbeddingRequest = Parameters<MemoryModel["embed"]>[0];
const attemptArgs = { reference: runtimeAuthorityReference, runId: v.string(), attemptNumber: v.number(), leaseVersion: v.number() };
const inputArgs = v.object({ text: v.string(), requestId: v.string(), limit: v.number() });
type NativeArgs = AgentQueryEmbeddingAttempt & { input: Input };

function checkedInput(input: Input): string {
  assertMemoryRequestId(input.requestId);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) memoryError("INVALID_INPUT", "Limit must be between 1 and 100");
  return normalizeSourceText(input.text);
}
export async function currentQuery(ctx: Pick<QueryCtx, "db" | "runQuery">, args: NativeArgs) {
  const text = checkedInput(args.input), current = await executionContext(ctx, args);
  const userText = current.messages.filter(message => message.role === "user").slice(-1).map(message => typeof message.content === "string" ? message.content
    : message.content.filter(part => part.type === "text").map(part => part.text).join("\n")).join("\n");
  const requestId = `context:${await semanticHash(canonicalModelJson([args.runId, args.attemptNumber]))}`;
  if (text !== normalizeSourceText(userText) || args.input.requestId !== requestId || args.input.limit !== 10) memoryError("POLICY_DENIED", "Agent query embedding input changed");
  return { current, text };
}
async function queryBinding(ctx: QueryCtx | MutationCtx, args: NativeArgs, text: string, runBudgetId: string) {
  const profile = await readCurrentEmbeddingProfile(ctx, args.reference, "embedding.query", runBudgetId);
  const operationId = `embedding.query:${JSON.stringify([args.reference.tenantId, args.reference.memorySpaceId,
    args.reference.principalId, args.input.requestId, profile.profileId])}`;
  const request: EmbeddingRequest = { purpose: "embedding.query", operationId, policyVersion: profile.profileId,
    attempt: 1, profile, texts: [text] };
  const semanticId = await semanticHash(canonicalModelJson([request.purpose, request.operationId, request.policyVersion]));
  const binding: GatewayBinding = { reference: args.reference, operationKey: "embedding.query", runBudgetId, semanticId, ordinal: 0 };
  return { profile, request, binding };
}
function gatewayResolution(value: Awaited<ReturnType<typeof resolveHandler>>): GatewayResolution {
  if (value.storageLimits.embeddingValuesPerCall !== 1) throw new GatewayDispatchError("CAPABILITY_UNAVAILABLE");
  return { ...value, storageLimits: { ...value.storageLimits, embeddingValuesPerCall: 1 } };
}

/** Every original preflight predicate executes here, in original memory order. */
export async function prepareAgentQueryEmbeddingHandler(ctx: QueryCtx, args: NativeArgs, expectedVersion?: 8) {
  const { current, text } = await currentQuery(ctx, args);
  if (expectedVersion === 8 && current.snapshot.version !== 8) memoryError("INVALID_STATE", "V8 recall required");
  const repository = new ConvexMemoryRepository(ctx, args.reference, "read", undefined, { now: () => Date.now() },
    (key, runBudgetId) => readCurrentEmbeddingProfile(ctx, args.reference, key, runBudgetId));
  await repository.recheckAuthority();
  await repository.assertReadAuthority();
  // Original resolveProfile checks authority independently before profile selection.
  await repository.recheckAuthority();
  const selected = await queryBinding(ctx, args, text, current.run.runBudgetId);
  await repository.assertProfileReady(selected.profile, selected.binding.runBudgetId);
  // Original memory-model preparation checks authority again before its two resolutions.
  await repository.recheckAuthority();
  const initial = gatewayResolution(await resolveHandler(ctx, selected.binding));
  const governed = gatewayResolution(await resolveHandler(ctx, selected.binding));
  return { ...selected, resolutions: [initial, governed] as const };
}
export const prepare = internalQuery({ args: { ...attemptArgs, input: inputArgs }, handler: (ctx, args) =>
  prepareAgentQueryEmbeddingHandler(createAuthorityReadScope(ctx, { nativeTranscript: true, policyMetadata: true }), args) });

type AdmitArgs = NativeArgs & { bindingCanonical: string; requestCanonical: string; snapshotCanonical: string };
type AdmissionResult = { result: GatewayAdmissionCheckpoint } | { refusal: Refusal };
const checkpointRef = makeFunctionReference("runtimeModelPolicy:checkpoint") as unknown as FunctionReference<"mutation", "internal",
  { reference: RuntimeAuthorityReference; attemptId: Parameters<typeof assertGatewayReservedRequest>[0]["attemptId"]; requestCanonical: string }, GatewayCheckpoint>;

/** Reservation commits even if validation/checkpoint refuses. Child checkpoint writes roll back separately. */
export async function admitAgentQueryEmbeddingHandler(ctx: MutationCtx, args: AdmitArgs, expectedVersion?: 8): Promise<AdmissionResult> {
  const { current, text } = await currentQuery(ctx, args);
  if (expectedVersion === 8 && current.snapshot.version !== 8) memoryError("INVALID_STATE", "V8 recall required");
  const selected = await queryBinding(ctx, args, text, current.run.runBudgetId);
  if (args.bindingCanonical !== canonicalModelJson(selected.binding)) memoryError("POLICY_DENIED", "Agent query embedding binding changed");
  let request: Record<string, unknown>;
  try { request = JSON.parse(args.requestCanonical) as Record<string, unknown>; }
  catch { return memoryError("INVALID_INPUT", "Invalid query embedding request"); }
  if (!request || request.semanticId !== selected.binding.semanticId || canonicalModelJson(request.texts) !== canonicalModelJson(selected.request.texts)
    || canonicalModelJson(request.profile) !== canonicalModelJson(selected.profile)
    || canonicalModelJson(request.batch) !== canonicalModelJson({ ordinal: 0, start: 0, end: 1 })) memoryError("POLICY_DENIED", "Agent query embedding request changed");
  const admission = await admitHandler(ctx, { ...selected.binding, requestCanonical: args.requestCanonical });
  if (admission.status !== "reserved") return { result: { admission } };
  try {
    assertGatewayReservedRequest(admission, args.requestCanonical, args.snapshotCanonical, MODEL_LEDGER_STORAGE_LIMITS.canonicalBytes);
    // A native child mutation supplies the original partial rollback/savepoint boundary.
    const permit = await ctx.runMutation(checkpointRef, { reference: args.reference, attemptId: admission.attemptId, requestCanonical: admission.requestCanonical });
    return { result: { admission, permit } };
  } catch (error) { return { refusal: boundedRefusal(error) }; }
}
export const admit = internalMutation({ args: { ...attemptArgs, input: inputArgs, bindingCanonical: v.string(), requestCanonical: v.string(), snapshotCanonical: v.string() },
  handler: (ctx, args) => admitAgentQueryEmbeddingHandler(createAuthorityReadScope(ctx, { nativeTranscript: true, policyMetadata: true }), args) });

const prepareRef = makeFunctionReference("runtimeAgentQueryEmbedding:prepare") as unknown as FunctionReference<"query", "internal", NativeArgs, Awaited<ReturnType<typeof prepareAgentQueryEmbeddingHandler>>>;
const admitRef = makeFunctionReference("runtimeAgentQueryEmbedding:admit") as unknown as FunctionReference<"mutation", "internal", AdmitArgs, AdmissionResult>;
/** V6 only. No no-op authorization callbacks, public recall changes, inference retries or memory writer. */
export async function recallAgentMemory(ctx: ActionCtx, attempt: AgentQueryEmbeddingAttempt, repository: MemoryRepository, clock: DomainClock, input: Input, selection?: AgentRecallSelection) {
  const proposal = await ctx.runQuery(prepareRef, { ...attempt, input });
  const model = createGatewayMemoryModel(ctx, repository, { runBudgetId: proposal.binding.runBudgetId,
    queryEmbedding: { binding: proposal.binding, requestCanonical: canonicalModelJson(proposal.request), resolutions: proposal.resolutions,
      refresh: async () => (await ctx.runQuery(prepareRef, { ...attempt, input })).resolutions[1],
      admitAndCheckpoint: async request => {
        const result = await ctx.runMutation(admitRef, { ...attempt, input, requestCanonical: request.requestCanonical,
          snapshotCanonical: request.snapshotCanonical, bindingCanonical: canonicalModelJson({ reference: request.reference,
            operationKey: request.operationKey, runBudgetId: request.runBudgetId, semanticId: request.semanticId, ordinal: request.ordinal,
            ...(request.source !== undefined ? { source: request.source } : {}), ...(request.parentOperationId !== undefined ? { parentOperationId: request.parentOperationId } : {}) }) });
        if ("refusal" in result) return throwRefusal(result.refusal);
        return result.result;
      },
    } });
  const result = await model.embed(proposal.request);
  if (selection) return await finishAgentRecall(ctx, attempt, clock, input, proposal.profile, result, selection);
  return await finishRecallFromEmbedding({ repository, clock }, { text: normalizeSourceText(input.text), limit: input.limit },
    { profile: proposal.profile, runBudgetId: proposal.binding.runBudgetId }, result);
}

/** Explicit V8 registrations; legacy/private and public recall keep their original lanes. */
export const prepareV8 = internalQuery({ args: { ...attemptArgs, input: inputArgs },
  handler: (ctx, args) => prepareAgentQueryEmbeddingHandler(createV8AuthorityReadScope(ctx), args, 8) });
export const admitV8 = internalMutation({ args: { ...attemptArgs, input: inputArgs, bindingCanonical: v.string(), requestCanonical: v.string(), snapshotCanonical: v.string() },
  handler: (ctx, args) => admitAgentQueryEmbeddingHandler(createV8AuthorityReadScope(ctx), args, 8) });
const prepareV8Ref = makeFunctionReference("runtimeAgentQueryEmbedding:prepareV8") as unknown as typeof prepareRef;
const admitV8Ref = makeFunctionReference("runtimeAgentQueryEmbedding:admitV8") as unknown as typeof admitRef;

export async function recallAgentMemoryV8(ctx: ActionCtx, attempt: AgentQueryEmbeddingAttempt, repository: MemoryRepository, clock: DomainClock, input: Input, selection?: AgentRecallSelection) {
  const proposal = await ctx.runQuery(prepareV8Ref, { ...attempt, input });
  const model = createGatewayMemoryModel(withV8GatewayTerminalPorts(ctx), repository, { runBudgetId: proposal.binding.runBudgetId,
    queryEmbedding: { binding: proposal.binding, requestCanonical: canonicalModelJson(proposal.request), resolutions: proposal.resolutions,
      refresh: async () => (await ctx.runQuery(prepareV8Ref, { ...attempt, input })).resolutions[1],
      admitAndCheckpoint: async request => {
        const result = await ctx.runMutation(admitV8Ref, { ...attempt, input, requestCanonical: request.requestCanonical,
          snapshotCanonical: request.snapshotCanonical, bindingCanonical: canonicalModelJson({ reference: request.reference,
            operationKey: request.operationKey, runBudgetId: request.runBudgetId, semanticId: request.semanticId, ordinal: request.ordinal,
            ...(request.source !== undefined ? { source: request.source } : {}), ...(request.parentOperationId !== undefined ? { parentOperationId: request.parentOperationId } : {}) }) });
        if ("refusal" in result) return throwRefusal(result.refusal);
        return result.result;
      },
    } });
  const result = await model.embed(proposal.request);
  if (selection) return await finishAgentRecallV8(ctx, attempt, clock, input, proposal.profile, result, selection);
  return await finishRecallFromEmbedding({ repository, clock }, { text: normalizeSourceText(input.text), limit: input.limit },
    { profile: proposal.profile, runBudgetId: proposal.binding.runBudgetId }, result);
}
