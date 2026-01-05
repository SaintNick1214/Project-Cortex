/**
 * Cortex Convex Functions - Agents Registry API
 *
 * Backend functions for optional agent metadata registration.
 * Agents work without registration - this is just for discovery and analytics.
 */

import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Query Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get agent registration by ID
 */
export const get = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    return agent;
  },
});

/**
 * List agents with optional filters
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived"),
      ),
    ),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.status) {
      query = ctx.db
        .query("agents")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc");
    } else {
      query = ctx.db.query("agents").withIndex("by_registered").order("desc");
    }

    if (args.offset) {
      // Skip first N results
      const allResults = await query.collect();
      const sliced = allResults.slice(
        args.offset,
        args.offset + (args.limit || 100),
      );
      return sliced;
    }

    if (args.limit) {
      return await query.take(args.limit);
    }

    return await query.take(100); // Default limit
  },
});

/**
 * Count agents
 */
export const count = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let agents;

    if (args.status) {
      agents = await ctx.db
        .query("agents")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      agents = await ctx.db.query("agents").collect();
    }

    return agents.length;
  },
});

/**
 * Check if agent exists
 */
export const exists = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    return agent !== null;
  },
});

/**
 * Compute agent statistics
 *
 * Note: Uses sampling with limits to avoid hitting Convex's read limits.
 * For exact counts on large datasets, use dedicated count functions with indexes.
 */
export const computeStats = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Use limits to avoid hitting Convex's 16MB read limit
    // These are approximate counts for large datasets
    const SAMPLE_LIMIT = 1000;

    // Count memories where participantId = agentId (with limit)
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_participantId", (q) => q.eq("participantId", args.agentId))
      .take(SAMPLE_LIMIT);

    // Count conversations where memorySpaceId = agentId (with limit)
    // Note: This is a simplified query - full participant matching would need a different approach
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_memorySpace", (q) => q.eq("memorySpaceId", args.agentId))
      .take(SAMPLE_LIMIT);

    // Count facts where participantId = agentId (with limit)
    const facts = await ctx.db
      .query("facts")
      .withIndex("by_participantId", (q) => q.eq("participantId", args.agentId))
      .take(SAMPLE_LIMIT);

    // Find unique memory spaces from sampled memories
    const memorySpaces = new Set(memories.map((m) => m.memorySpaceId));

    // Find last active time from sampled data
    const allTimestamps = [
      ...memories.map((m) => m.updatedAt),
      ...conversations.map((c) => c.updatedAt),
      ...facts.map((f) => f.updatedAt),
    ].filter((t): t is number => t !== undefined);

    const lastActive =
      allTimestamps.length > 0 ? Math.max(...allTimestamps) : undefined;

    // Indicate if results are approximate (hit limit)
    const isApproximate =
      memories.length >= SAMPLE_LIMIT ||
      conversations.length >= SAMPLE_LIMIT ||
      facts.length >= SAMPLE_LIMIT;

    return {
      totalMemories: memories.length,
      totalConversations: conversations.length,
      totalFacts: facts.length,
      memorySpacesActive: memorySpaces.size,
      lastActive,
      isApproximate,
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutation Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Register an agent
 */
export const register = mutation({
  args: {
    agentId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check if agent already registered
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    if (existing) {
      throw new ConvexError("AGENT_ALREADY_REGISTERED");
    }

    const now = Date.now();

    const agentId = await ctx.db.insert("agents", {
      agentId: args.agentId,
      name: args.name,
      description: args.description,
      metadata: args.metadata || {},
      config: args.config || {},
      status: "active",
      registeredAt: now,
      updatedAt: now,
    });

    const agent = await ctx.db.get(agentId);
    return agent;
  },
});

/**
 * Update agent registration
 */
export const update = mutation({
  args: {
    agentId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    config: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      throw new ConvexError("AGENT_NOT_REGISTERED");
    }

    // Build update object
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.config !== undefined) updates.config = args.config;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(agent._id, updates);

    const updated = await ctx.db.get(agent._id);
    return updated;
  },
});

/**
 * Update multiple agents by IDs
 *
 * Note: Filtering is handled in the SDK layer - this mutation receives
 * specific agent IDs to update.
 */
export const updateMany = mutation({
  args: {
    agentIds: v.array(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (!args.agentIds || args.agentIds.length === 0) {
      return { updated: 0, agentIds: [] };
    }

    // Build update object (only include provided fields)
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.config !== undefined) updates.config = args.config;

    const updatedAgentIds: string[] = [];

    for (const agentId of args.agentIds) {
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
        .first();

      if (agent) {
        await ctx.db.patch(agent._id, updates);
        updatedAgentIds.push(agentId);
      }
    }

    return {
      updated: updatedAgentIds.length,
      agentIds: updatedAgentIds,
    };
  },
});

/**
 * Unregister agent (just removes registration, cascade handled in SDK)
 */
export const unregister = mutation({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      throw new ConvexError("AGENT_NOT_REGISTERED");
    }

    await ctx.db.delete(agent._id);

    return { deleted: true, agentId: args.agentId };
  },
});

/**
 * Unregister multiple agents matching filters
 *
 * Note: This only removes registrations. Cascade deletion of agent data
 * is handled in the SDK layer for each agent.
 */
export const unregisterMany = mutation({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived"),
      ),
    ),
    agentIds: v.optional(v.array(v.string())), // Specific agent IDs
  },
  handler: async (ctx, args) => {
    let agents;

    if (args.agentIds && args.agentIds.length > 0) {
      // Delete specific agents
      agents = await Promise.all(
        args.agentIds.map((agentId) =>
          ctx.db
            .query("agents")
            .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
            .first(),
        ),
      );
      agents = agents.filter((a) => a !== null);
    } else if (args.status) {
      // Delete by status filter
      agents = await ctx.db
        .query("agents")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      throw new Error(
        "INVALID_FILTERS: Must provide agentIds or status filter",
      );
    }

    const deletedAgentIds: string[] = [];

    for (const agent of agents) {
      try {
        await ctx.db.delete(agent._id);
        deletedAgentIds.push(agent.agentId);
      } catch (error) {
        console.error(`Failed to unregister agent ${agent.agentId}:`, error);
        // Continue with other agents
      }
    }

    return {
      deleted: deletedAgentIds.length,
      agentIds: deletedAgentIds,
    };
  },
});

/**
 * Note: Cascade deletion by participantId is orchestrated in the SDK layer.
 *
 * The SDK will:
 * 1. Query all memory spaces
 * 2. For each space, find records where participantId = agentId
 * 3. Delete conversations, memories, facts, graph nodes
 * 4. Delete agent registration (last)
 * 5. Verify completeness and rollback on failure
 *
 * This approach provides better control and error handling than a single
 * complex backend mutation.
 */

/**
 * Purge all agents (TEST/DEV ONLY)
 *
 * WARNING: This permanently deletes ALL agent registrations!
 * Only available in test/dev environments.
 */
export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Safety check: Only allow in test/dev environments
    const siteUrl = process.env.CONVEX_SITE_URL || "";
    const isLocal =
      siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    const isDevDeployment =
      siteUrl.includes(".convex.site") ||
      siteUrl.includes("dev-") ||
      siteUrl.includes("convex.cloud");
    const isTestEnv =
      process.env.NODE_ENV === "test" ||
      process.env.CONVEX_ENVIRONMENT === "test";

    if (!isLocal && !isDevDeployment && !isTestEnv) {
      throw new Error(
        "PURGE_DISABLED_IN_PRODUCTION: purgeAll is only available in test/dev environments.",
      );
    }

    const allAgents = await ctx.db.query("agents").collect();

    for (const agent of allAgents) {
      await ctx.db.delete(agent._id);
    }

    return { deleted: allAgents.length };
  },
});
