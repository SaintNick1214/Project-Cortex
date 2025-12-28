/**
 * Convex queries for user profile data
 *
 * These queries enable the LayerFlowDiagram to show user context
 * during memory orchestration.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get user profile by ID
 *
 * Returns user information stored in the Cortex system.
 */
export const get = query({
  args: {
    userId: v.string(),
    memorySpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Query users table (from Cortex SDK schema)
    const user = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
        ),
      )
      .first();

    return user;
  },
});

/**
 * Get users in a memory space
 */
export const list = query({
  args: {
    memorySpaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("memorySpaceId"), args.memorySpaceId))
      .take(limit);

    return users;
  },
});

/**
 * Get user stats (memory count, fact count, etc.)
 */
export const stats = query({
  args: {
    userId: v.string(),
    memorySpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Count memories
    const memories = await ctx.db
      .query("memories")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
        ),
      )
      .collect();

    // Count facts
    const facts = await ctx.db
      .query("facts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("memorySpaceId"), args.memorySpaceId),
        ),
      )
      .collect();

    // Count conversations
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
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
