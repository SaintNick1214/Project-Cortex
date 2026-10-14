/** Fresh private bootstrap and a payload-free reactive invalidation signal. */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { dataAuthorityReference, requireDataAuthority } from "./runtimeDataAuth";
import { deliveryExpiresAt } from "./runtimeDelivery";
import { observeHandler, startHandler } from "./runtimeAgent";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { getHandler, submitHandler } from "./runs";
import { transcriptDenied } from "./runtimeTranscript";
import { createAuthorityReadScope } from "./runtimeAuth";
import { traceRuntimeMutationSpan } from "./runtimeLatencyTrace";

type Selectors = { tenantId?: string; memorySpaceId?: string };

/** One parent transaction retains the original admission, queue, approval and start guards.
 * No caller-selected model/context/tool options, independent dispatch or retry lane. */
export async function submitAndStartHandler(ctx: MutationCtx, args: Selectors & { request: unknown; streaming?: boolean }) {
  const selectors = { ...(args.tenantId === undefined ? {} : { tenantId: args.tenantId }),
    ...(args.memorySpaceId === undefined ? {} : { memorySpaceId: args.memorySpaceId }) };
  const submitted = await traceRuntimeMutationSpan("submit-and-start", 0, "admission.submit",
    () => submitHandler(ctx, { ...selectors, request: args.request }));
  const start = await traceRuntimeMutationSpan(submitted.runId, submitted.attemptNumber, "admission.start",
    () => startHandler(ctx, { ...selectors, runId: submitted.runId, streaming: args.streaming ?? true }));
  // Preserve the old SDK start's read permission and immutable-handle check without
  // another client round trip. A mismatch rolls back admission and Workflow insertion.
  const run = await traceRuntimeMutationSpan(submitted.runId, start.attemptNumber, "admission.get",
    () => getHandler(ctx, { ...selectors, runId: submitted.runId }));
  if (start.runId !== submitted.runId || start.attemptNumber !== run.attemptNumber
    || run.runId !== submitted.runId || run.conversationId !== submitted.conversationId
    || run.agentId !== submitted.agentId || run.agentVersion !== submitted.agentVersion
    || run.definitionHash !== submitted.definitionHash
    || run.scope.tenantId !== submitted.scope.tenantId || run.scope.memorySpaceId !== submitted.scope.memorySpaceId) transcriptDenied("TRANSCRIPT_CONFLICT");
  return { version: 1 as const, run, start };
}
export const submitAndStart = mutation({
  args: { request: v.any(), streaming: v.optional(v.boolean()), tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) },
  handler: (ctx, args) => submitAndStartHandler(createAuthorityReadScope(ctx), args),
});

export async function sessionHandler(ctx: MutationCtx, args: Selectors) {
  const actor = await requireDataAuthority(ctx, args, "read");
  const expiresAt = await deliveryExpiresAt(ctx, dataAuthorityReference(actor));
  return { version: 1 as const, tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId,
    principalId: actor.principalId, userId: actor.userId,
    ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
}
export const session = mutation({
  args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) },
  handler: sessionHandler,
});

/** Preserve the original SDK pre-session predicate in the admission transaction.
 * The client still performs its independent post-I/O session and actor fence.
 * The existing three-field submitAndStart contract remains available unchanged. */
export async function submitAndStartEnvelopeHandler(ctx: MutationCtx, args: Selectors & { request: unknown; streaming?: boolean }) {
  const selectors = { ...(args.tenantId === undefined ? {} : { tenantId: args.tenantId }),
    ...(args.memorySpaceId === undefined ? {} : { memorySpaceId: args.memorySpaceId }) };
  const current = await sessionHandler(ctx, selectors);
  const admission = await submitAndStartHandler(ctx, { request: args.request, streaming: args.streaming,
    tenantId: current.tenantId, memorySpaceId: current.memorySpaceId });
  if (admission.run.scope.tenantId !== current.tenantId || admission.run.scope.memorySpaceId !== current.memorySpaceId) transcriptDenied("SESSION_CHANGED");
  return { version: 1 as const, session: current, admission };
}
export const submitAndStartEnvelope = mutation({
  args: { request: v.any(), streaming: v.optional(v.boolean()), tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) },
  handler: (ctx, args) => submitAndStartEnvelopeHandler(createAuthorityReadScope(ctx), args),
});

type ObservationHandle = { version: 1; tenantId: string; memorySpaceId: string; principalId: string;
  runId: string; conversationId: string; agentId: string; agentVersion: number; definitionHash: string };
/** Compose the original pre-session and private observation in one transaction.
 * The SDK retains a separate fresh post-session after this response crosses I/O. */
export async function observeEnvelopeHandler(ctx: MutationCtx, args: Selectors & { handle: ObservationHandle;
  afterSequence?: number; limit?: number; finalOnly?: boolean }) {
  // Preserve omitted-selector ambiguity. The supplied handle cannot choose a scope
  // in place of the original client configuration or establish current authority.
  const selectors = { ...(args.tenantId === undefined ? {} : { tenantId: args.tenantId }),
    ...(args.memorySpaceId === undefined ? {} : { memorySpaceId: args.memorySpaceId }) };
  const current = await sessionHandler(ctx, selectors), expected = args.handle;
  if (expected.version !== 1 || expected.tenantId !== current.tenantId || expected.memorySpaceId !== current.memorySpaceId
    || expected.principalId !== current.principalId) transcriptDenied("SESSION_CHANGED");
  const value = await observeHandler(ctx, { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId, runId: expected.runId,
    ...(args.afterSequence === undefined ? {} : { afterSequence: args.afterSequence }),
    ...(args.limit === undefined ? {} : { limit: args.limit }), ...(args.finalOnly === undefined ? {} : { finalOnly: args.finalOnly }) });
  const row = value.run;
  if (row.scope.tenantId !== expected.tenantId || row.scope.memorySpaceId !== expected.memorySpaceId
    || row.runId !== expected.runId || row.conversationId !== expected.conversationId || row.agentId !== expected.agentId
    || row.agentVersion !== expected.agentVersion || row.definitionHash !== expected.definitionHash) transcriptDenied("RUN_IDENTITY_CHANGED");
  return { version: 1 as const, session: current, observation: value };
}
export const observeEnvelope = mutation({
  args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()),
    handle: v.object({ version: v.literal(1), tenantId: v.string(), memorySpaceId: v.string(), principalId: v.string(),
      runId: v.string(), conversationId: v.string(), agentId: v.string(), agentVersion: v.number(), definitionHash: v.string() }),
    afterSequence: v.optional(v.number()), limit: v.optional(v.number()), finalOnly: v.optional(v.boolean()) },
  handler: observeEnvelopeHandler,
});

/** Reads the same fenced dependencies as observe, but never delivers its private payload from a cached query. */
export const signal = query({
  args: { runId: v.string(), tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const value = await observeHandler(ctx, { ...args, limit: 1, finalOnly: false });
    const execution = await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", value.run.scope.tenantId)
      .eq("memorySpaceId", value.run.scope.memorySpaceId).eq("runId", value.run.runId).eq("attemptNumber", value.run.attemptNumber)).unique();
    const marker = await semanticHash(canonicalModelJson({ attempt: value.run.attemptNumber,
      updatedAt: value.run.updatedAt, state: value.state, cursor: value.cursor,
      outputRevision: execution?.nextOutputSequence ?? 0, executionRevision: execution?.updatedAt ?? 0 }));
    return { version: 1 as const, marker,
      ...(value.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: value.deliveryExpiresAt }) };
  },
});
