import { internalQuery as query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwnerScope } from "./scope";
const scope = {
  userId: v.string(),
  tenantId: v.string(),
  memorySpaceId: v.string(),
};
export const get = query({
  args: scope,
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    const row = await ctx.db
      .query("appAccounts")
      .withIndex("by_account", (q) => q.eq("accountId", args.userId))
      .unique();
    return row
      ? { id: row.accountId, name: row.displayName || row.username }
      : null;
  },
});
export const list = query({
  args: { ...scope, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    const row = await ctx.db
      .query("appAccounts")
      .withIndex("by_account", (q) => q.eq("accountId", args.userId))
      .unique();
    return row
      ? [{ id: row.accountId, name: row.displayName || row.username }]
      : [];
  },
});
export const stats = query({
  args: scope,
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    const memories = await ctx.db
      .query("memories")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
        ),
      )
      .collect();
    const facts = await ctx.db
      .query("facts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
        ),
      )
      .collect();
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.and(
          q.eq(q.field("participants.userId"), args.userId),
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
        ),
      )
      .collect();
    return {
      memoryCount: memories.length,
      factCount: facts.length,
      conversationCount: conversations.length,
    };
  },
});
