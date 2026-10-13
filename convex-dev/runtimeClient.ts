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

type Selectors = { tenantId?: string; memorySpaceId?: string };

/** One parent transaction retains the original admission, queue, approval and start guards.
 * No caller-selected model/context/tool options, independent dispatch or retry lane. */
export async function submitAndStartHandler(ctx: MutationCtx, args: Selectors & { request: unknown; streaming?: boolean }) {
  const selectors = { ...(args.tenantId === undefined ? {} : { tenantId: args.tenantId }),
    ...(args.memorySpaceId === undefined ? {} : { memorySpaceId: args.memorySpaceId }) };
  const submitted = await submitHandler(ctx, { ...selectors, request: args.request });
  const start = await startHandler(ctx, { ...selectors, runId: submitted.runId, streaming: args.streaming ?? true });
  // Preserve the old SDK start's read permission and immutable-handle check without
  // another client round trip. A mismatch rolls back admission and Workflow insertion.
  const run = await getHandler(ctx, { ...selectors, runId: submitted.runId });
  if (start.runId !== submitted.runId || start.attemptNumber !== run.attemptNumber
    || run.runId !== submitted.runId || run.conversationId !== submitted.conversationId
    || run.agentId !== submitted.agentId || run.agentVersion !== submitted.agentVersion
    || run.definitionHash !== submitted.definitionHash
    || run.scope.tenantId !== submitted.scope.tenantId || run.scope.memorySpaceId !== submitted.scope.memorySpaceId) transcriptDenied("TRANSCRIPT_CONFLICT");
  return { version: 1 as const, run, start };
}
export const submitAndStart = mutation({
  args: { request: v.any(), streaming: v.optional(v.boolean()), tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) },
  handler: submitAndStartHandler,
});

export const session = mutation({
  args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireDataAuthority(ctx, args, "read");
    const expiresAt = await deliveryExpiresAt(ctx, dataAuthorityReference(actor));
    return { version: 1 as const, tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId,
      principalId: actor.principalId, userId: actor.userId,
      ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
  },
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
