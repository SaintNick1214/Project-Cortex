/**
 * Cortex SDK - Fact History API
 *
 * Audit trail for belief revision operations.
 * Records CREATE, UPDATE, SUPERSEDE, and DELETE actions on facts.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Log a fact change event
 */
export const logEvent = mutation({
  args: {
    factId: v.string(),
    memorySpaceId: v.string(),
    action: v.union(
      v.literal("CREATE"),
      v.literal("UPDATE"),
      v.literal("SUPERSEDE"),
      v.literal("DELETE"),
    ),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    supersededBy: v.optional(v.string()),
    supersedes: v.optional(v.string()),
    reason: v.optional(v.string()),
    confidence: v.optional(v.number()),
    pipeline: v.optional(
      v.object({
        slotMatching: v.optional(v.boolean()),
        semanticMatching: v.optional(v.boolean()),
        llmResolution: v.optional(v.boolean()),
      }),
    ),
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const eventId = `fh-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await ctx.db.insert("factHistory", {
      eventId,
      factId: args.factId,
      memorySpaceId: args.memorySpaceId,
      action: args.action,
      oldValue: args.oldValue,
      newValue: args.newValue,
      supersededBy: args.supersededBy,
      supersedes: args.supersedes,
      reason: args.reason,
      confidence: args.confidence,
      pipeline: args.pipeline,
      userId: args.userId,
      participantId: args.participantId,
      conversationId: args.conversationId,
      timestamp: now,
    });

    return { eventId, _id };
  },
});

/**
 * Delete history events for a fact (GDPR cascade)
 */
export const deleteByFactId = mutation({
  args: {
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("factHistory")
      .withIndex("by_factId", (q) => q.eq("factId", args.factId))
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deleted: events.length };
  },
});

/**
 * Delete history events for a user (GDPR cascade)
 */
export const deleteByUserId = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("factHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deleted: events.length };
  },
});

/**
 * Delete history events by memory space
 */
export const deleteByMemorySpace = mutation({
  args: {
    memorySpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("factHistory")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deleted: events.length };
  },
});

/**
 * Purge old history events (retention policy)
 */
export const purgeOldEvents = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    olderThan: v.number(), // Timestamp - delete events before this
    limit: v.optional(v.number()), // Max events to delete per call
  },
  handler: async (ctx, args) => {
    // Filter by memory space if provided
    const events = args.memorySpaceId
      ? await ctx.db
          .query("factHistory")
          .withIndex("by_memorySpace_timestamp", (q) =>
            q.eq("memorySpaceId", args.memorySpaceId!).lt("timestamp", args.olderThan),
          )
          .collect()
      : await ctx.db
          .query("factHistory")
          .withIndex("by_timestamp", (q) => q.lt("timestamp", args.olderThan))
          .collect();

    const limit = args.limit ?? 1000;
    const toDelete = events.slice(0, limit);

    for (const event of toDelete) {
      await ctx.db.delete(event._id);
    }

    return {
      deleted: toDelete.length,
      remaining: events.length - toDelete.length,
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get history for a specific fact
 */
export const getHistory = query({
  args: {
    factId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const historyQuery = ctx.db
      .query("factHistory")
      .withIndex("by_factId", (q) => q.eq("factId", args.factId))
      .order("desc"); // Most recent first

    const events = await historyQuery.collect();

    // Apply limit if provided
    const limit = args.limit ?? 100;
    return events.slice(0, limit);
  },
});

/**
 * Get history event by ID
 */
export const getEvent = query({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("factHistory")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    return event;
  },
});

/**
 * Get changes in a time range
 */
export const getChangesByTimeRange = query({
  args: {
    memorySpaceId: v.string(),
    after: v.optional(v.number()),
    before: v.optional(v.number()),
    action: v.optional(
      v.union(
        v.literal("CREATE"),
        v.literal("UPDATE"),
        v.literal("SUPERSEDE"),
        v.literal("DELETE"),
      ),
    ),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let events = await ctx.db
      .query("factHistory")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .order("desc")
      .collect();

    // Apply time filters
    if (args.after !== undefined) {
      events = events.filter((e) => e.timestamp >= args.after!);
    }
    if (args.before !== undefined) {
      events = events.filter((e) => e.timestamp <= args.before!);
    }

    // Filter by action type
    if (args.action !== undefined) {
      events = events.filter((e) => e.action === args.action);
    }

    // Apply pagination
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 100;
    events = events.slice(offset, offset + limit);

    return events;
  },
});

/**
 * Count changes by action type
 */
export const countByAction = query({
  args: {
    memorySpaceId: v.string(),
    after: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let events = await ctx.db
      .query("factHistory")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .collect();

    // Apply time filters
    if (args.after !== undefined) {
      events = events.filter((e) => e.timestamp >= args.after!);
    }
    if (args.before !== undefined) {
      events = events.filter((e) => e.timestamp <= args.before!);
    }

    // Count by action
    const counts = {
      CREATE: 0,
      UPDATE: 0,
      SUPERSEDE: 0,
      DELETE: 0,
      total: events.length,
    };

    for (const event of events) {
      counts[event.action]++;
    }

    return counts;
  },
});

/**
 * Get supersession chain for a fact
 * Returns the chain of facts that led to the current state
 */
export const getSupersessionChain = query({
  args: {
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const chain: any[] = [];
    let currentFactId: string | undefined = args.factId;

    // Go backward through supersedes relationships
    while (currentFactId) {
      const event = await ctx.db
        .query("factHistory")
        .withIndex("by_factId", (q) => q.eq("factId", currentFactId!))
        .filter((q) => q.eq(q.field("action"), "SUPERSEDE"))
        .first();

      if (event && event.supersedes) {
        chain.unshift({
          factId: event.supersedes,
          supersededBy: currentFactId,
          timestamp: event.timestamp,
          reason: event.reason,
        });
        currentFactId = event.supersedes;
      } else {
        break;
      }
    }

    // Add the current fact
    chain.push({
      factId: args.factId,
      supersededBy: null,
      timestamp: Date.now(),
      reason: "Current version",
    });

    return chain;
  },
});

/**
 * Get recent activity summary
 */
export const getActivitySummary = query({
  args: {
    memorySpaceId: v.string(),
    hours: v.optional(v.number()), // Default 24 hours
  },
  handler: async (ctx, args) => {
    const hours = args.hours ?? 24;
    const since = Date.now() - hours * 60 * 60 * 1000;

    const events = await ctx.db
      .query("factHistory")
      .withIndex("by_memorySpace_timestamp", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId).gte("timestamp", since),
      )
      .collect();

    // Count by action
    const actionCounts = {
      CREATE: 0,
      UPDATE: 0,
      SUPERSEDE: 0,
      DELETE: 0,
    };

    // Track unique facts modified
    const factsModified = new Set<string>();

    // Track participants
    const participants = new Set<string>();

    for (const event of events) {
      actionCounts[event.action]++;
      factsModified.add(event.factId);
      if (event.participantId) {
        participants.add(event.participantId);
      }
      if (event.userId) {
        participants.add(event.userId);
      }
    }

    return {
      timeRange: {
        hours,
        since: new Date(since).toISOString(),
        until: new Date().toISOString(),
      },
      totalEvents: events.length,
      actionCounts,
      uniqueFactsModified: factsModified.size,
      activeParticipants: participants.size,
    };
  },
});
