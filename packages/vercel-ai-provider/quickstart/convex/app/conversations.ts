import { internalQuery as query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwnerScope } from "./scope";
const scope = {
  userId: v.string(),
  tenantId: v.string(),
  memorySpaceId: v.string(),
};
export const getRecent = query({
  args: { ...scope, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    return ctx.db
      .query("conversations")
      .filter((q) =>
        q.and(
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("participants.userId"), args.userId),
        ),
      )
      .order("desc")
      .take(Math.max(1, Math.min(args.limit || 20, 100)));
  },
});
export const count = query({
  args: scope,
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    return (
      await ctx.db
        .query("conversations")
        .filter((q) =>
          q.and(
            q.eq(q.field("memorySpaceId"), args.memorySpaceId),
            q.eq(q.field("tenantId"), args.tenantId),
            q.eq(q.field("participants.userId"), args.userId),
          ),
        )
        .collect()
    ).length;
  },
});
export const get = query({
  args: { ...scope, conversationId: v.string() },
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    const row = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .unique();
    return row &&
      row.participants.userId === args.userId &&
      row.tenantId === args.tenantId &&
      row.memorySpaceId === args.memorySpaceId
      ? row
      : null;
  },
});
