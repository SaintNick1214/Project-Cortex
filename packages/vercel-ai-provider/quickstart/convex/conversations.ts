/**
 * Convex queries for real-time conversation updates
 *
 * These queries enable the LayerFlowDiagram to show live updates
 * as data flows through the Cortex memory system.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get recent conversations for a memory space
 *
 * Used by the demo to watch for new conversations being created.
 */
export const getRecent = query({
  args: {
    memorySpaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Query conversations table (from Cortex SDK schema)
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("memorySpaceId"), args.memorySpaceId))
      .order("desc")
      .take(limit);

    return conversations;
  },
});

/**
 * Get a specific conversation by ID
 */
export const get = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("conversationId"), args.conversationId))
      .first();

    return conversation;
  },
});

/**
 * Get conversation count for a memory space
 */
export const count = query({
  args: {
    memorySpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("memorySpaceId"), args.memorySpaceId))
      .collect();

    return conversations.length;
  },
});
