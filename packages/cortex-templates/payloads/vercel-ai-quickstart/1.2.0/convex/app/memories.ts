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
      .query("memories")
      .filter((q) =>
        q.and(
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("userId"), args.userId),
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
        .query("memories")
        .filter((q) =>
          q.and(
            q.eq(q.field("memorySpaceId"), args.memorySpaceId),
            q.eq(q.field("tenantId"), args.tenantId),
            q.eq(q.field("userId"), args.userId),
          ),
        )
        .collect()
    ).length;
  },
});
export const getByUser = query({
  args: { ...scope, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    return ctx.db
      .query("memories")
      .filter((q) =>
        q.and(
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("userId"), args.userId),
        ),
      )
      .order("desc")
      .take(Math.max(1, Math.min(args.limit || 20, 100)));
  },
});
export const search = query({
  args: { ...scope, query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwnerScope(ctx, args);
    const rows = await ctx.db
      .query("memories")
      .filter((q) =>
        q.and(
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("userId"), args.userId),
        ),
      )
      .collect();
    return rows
      .filter((row) =>
        row.content.toLowerCase().includes(args.query.toLowerCase()),
      )
      .slice(0, Math.max(1, Math.min(args.limit || 5, 100)));
  },
});
