/** Fresh private bootstrap and a payload-free reactive invalidation signal. */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { dataAuthorityReference, requireDataAuthority } from "./runtimeDataAuth";
import { deliveryExpiresAt } from "./runtimeDelivery";
import { observeHandler } from "./runtimeAgent";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";

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
