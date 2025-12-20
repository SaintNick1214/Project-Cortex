/**
 * Convex queries for real-time memory updates
 *
 * These queries enable the LayerFlowDiagram to show live updates
 * as vector memories are created in the Cortex system.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get recent memories for a memory space
 *
 * Used by the demo to watch for new memories being created.
 */
export const getRecent = query({
  args: {
    memorySpaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Query memories table (from Cortex SDK schema)
    const memories = await ctx.db
      .query("memories")
      .filter((q) => q.eq(q.field("memorySpaceId"), args.memorySpaceId))
      .order("desc")
      .take(limit);

    return memories;
  },
});

/**
 * Get memories for a specific user
 */
export const getByUser = query({
  args: {
    memorySpaceId: v.string(),
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const memories = await ctx.db
      .query("memories")
      .filter((q) =>
        q.and(
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
          q.eq(q.field("userId"), args.userId),
        ),
      )
      .order("desc")
      .take(limit);

    return memories;
  },
});

/**
 * Get memory count for a memory space
 */
export const count = query({
  args: {
    memorySpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("memories")
      .filter((q) => q.eq(q.field("memorySpaceId"), args.memorySpaceId))
      .collect();

    return memories.length;
  },
});

/**
 * Search memories by content (simple text search for demo)
 */
export const search = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const queryLower = args.query.toLowerCase();

    // Simple text search (in production, use vector search)
    const allMemories = await ctx.db
      .query("memories")
      .filter((q) => q.eq(q.field("memorySpaceId"), args.memorySpaceId))
      .collect();

    const matching = allMemories
      .filter((m) => m.content?.toLowerCase().includes(queryLower))
      .slice(0, limit);

    return matching;
  },
});
