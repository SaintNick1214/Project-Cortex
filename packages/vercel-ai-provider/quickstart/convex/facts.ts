/**
 * Convex queries for real-time fact updates
 *
 * These queries enable the LayerFlowDiagram to show live updates
 * as facts are extracted from conversations.
 */

import { query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Get recent facts for a memory space
 *
 * Used by the demo to watch for new facts being extracted.
 */
export const getRecent = query({
  args: {
    memorySpaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    // Query facts table (from Cortex SDK schema)
    const facts = await ctx.db
      .query('facts')
      .filter((q) => q.eq(q.field('memorySpaceId'), args.memorySpaceId))
      .order('desc')
      .take(limit);

    return facts;
  },
});

/**
 * Get facts for a specific user
 */
export const getByUser = query({
  args: {
    memorySpaceId: v.string(),
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const facts = await ctx.db
      .query('facts')
      .filter((q) =>
        q.and(
          q.eq(q.field('memorySpaceId'), args.memorySpaceId),
          q.eq(q.field('userId'), args.userId)
        )
      )
      .order('desc')
      .take(limit);

    return facts;
  },
});

/**
 * Get facts by type
 */
export const getByType = query({
  args: {
    memorySpaceId: v.string(),
    factType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const facts = await ctx.db
      .query('facts')
      .filter((q) =>
        q.and(
          q.eq(q.field('memorySpaceId'), args.memorySpaceId),
          q.eq(q.field('factType'), args.factType)
        )
      )
      .order('desc')
      .take(limit);

    return facts;
  },
});

/**
 * Get fact count for a memory space
 */
export const count = query({
  args: {
    memorySpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const facts = await ctx.db
      .query('facts')
      .filter((q) => q.eq(q.field('memorySpaceId'), args.memorySpaceId))
      .collect();

    return facts.length;
  },
});

/**
 * Get fact type summary for a user
 */
export const typeSummary = query({
  args: {
    memorySpaceId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let factsQuery = ctx.db
      .query('facts')
      .filter((q) => q.eq(q.field('memorySpaceId'), args.memorySpaceId));

    const facts = await factsQuery.collect();

    // Group by type
    const summary: Record<string, number> = {};
    for (const fact of facts) {
      if (args.userId && fact.userId !== args.userId) continue;
      const type = fact.factType || 'unknown';
      summary[type] = (summary[type] || 0) + 1;
    }

    return summary;
  },
});
