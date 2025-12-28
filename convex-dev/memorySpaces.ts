/**
 * Cortex SDK - Memory Spaces Registry
 *
 * Hive/Collaboration Mode management
 * Memory space metadata and analytics
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Register a new memory space
 */
export const register = mutation({
  args: {
    memorySpaceId: v.string(),
    name: v.optional(v.string()),
    type: v.union(
      v.literal("personal"),
      v.literal("team"),
      v.literal("project"),
      v.literal("custom"),
    ),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    participants: v.optional(
      v.array(
        v.object({
          id: v.string(),
          type: v.string(), // "user", "agent", "tool", etc.
          joinedAt: v.number(),
        }),
      ),
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check if already exists - tenant-aware lookup if tenantId provided
    let existing;
    if (args.tenantId) {
      // For multi-tenant: check within tenant's namespace only using composite index
      existing = await ctx.db
        .query("memorySpaces")
        .withIndex("by_tenant_memorySpaceId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("memorySpaceId", args.memorySpaceId),
        )
        .first();
    } else {
      // For non-tenant: check globally (backwards compatibility)
      // SECURITY: Must verify the matched record has no tenantId to prevent cross-tenant conflicts
      const candidate = await ctx.db
        .query("memorySpaces")
        .withIndex("by_memorySpaceId", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .first();
      // Only match if the record is truly global (no tenantId)
      existing = candidate && !candidate.tenantId ? candidate : null;
    }

    if (existing) {
      // Throw error for explicit duplicate registration attempts
      // Use getOrCreate() for UPSERT behavior if race-safety is needed
      throw new ConvexError("MEMORYSPACE_ALREADY_EXISTS");
    }

    const now = Date.now();

    const _id = await ctx.db.insert("memorySpaces", {
      memorySpaceId: args.memorySpaceId,
      name: args.name,
      type: args.type,
      tenantId: args.tenantId, // Store tenantId for multi-tenancy
      participants: args.participants || [],
      metadata: args.metadata || {},
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Update memory space metadata
 */
export const update = mutation({
  args: {
    memorySpaceId: v.string(),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query("memorySpaces")
      .withIndex("by_memorySpaceId", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .first();

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    await ctx.db.patch(space._id, {
      name: args.name !== undefined ? args.name : space.name,
      metadata: args.metadata !== undefined ? args.metadata : space.metadata,
      status: args.status !== undefined ? args.status : space.status,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(space._id);
  },
});

/**
 * Add participant to memory space
 */
export const addParticipant = mutation({
  args: {
    memorySpaceId: v.string(),
    participant: v.object({
      id: v.string(),
      type: v.string(),
      joinedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query("memorySpaces")
      .withIndex("by_memorySpaceId", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .first();

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    // Check if already exists
    if (space.participants.some((p) => p.id === args.participant.id)) {
      throw new ConvexError("PARTICIPANT_ALREADY_EXISTS");
    }

    await ctx.db.patch(space._id, {
      participants: [...space.participants, args.participant],
      updatedAt: Date.now(),
    });

    return await ctx.db.get(space._id);
  },
});

/**
 * Remove participant from memory space
 */
export const removeParticipant = mutation({
  args: {
    memorySpaceId: v.string(),
    participantId: v.string(),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query("memorySpaces")
      .withIndex("by_memorySpaceId", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .first();

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    const updatedParticipants = space.participants.filter(
      (p) => p.id !== args.participantId,
    );

    await ctx.db.patch(space._id, {
      participants: updatedParticipants,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(space._id);
  },
});

/**
 * Archive memory space (marks as inactive but preserves data)
 */
export const archive = mutation({
  args: {
    memorySpaceId: v.string(),
    reason: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query("memorySpaces")
      .withIndex("by_memorySpaceId", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .first();

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    await ctx.db.patch(space._id, {
      status: "archived",
      updatedAt: Date.now(),
      metadata: {
        ...space.metadata,
        ...(args.metadata || {}),
        archivedAt: Date.now(),
        archiveReason: args.reason,
      },
    });

    return await ctx.db.get(space._id);
  },
});

/**
 * Reactivate archived memory space
 */
export const reactivate = mutation({
  args: {
    memorySpaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query("memorySpaces")
      .withIndex("by_memorySpaceId", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .first();

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    await ctx.db.patch(space._id, {
      status: "active",
      updatedAt: Date.now(),
    });

    return await ctx.db.get(space._id);
  },
});

/**
 * Delete memory space (also cascades to all data)
 */
export const deleteSpace = mutation({
  args: {
    memorySpaceId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy filter
    cascade: v.boolean(), // Must be true to proceed
    reason: v.string(), // Required: Why deleting (audit trail)
    confirmId: v.optional(v.string()), // Optional: Safety check
  },
  handler: async (ctx, args) => {
    // Safety check: confirmId must match memorySpaceId if provided
    if (args.confirmId !== undefined && args.confirmId !== args.memorySpaceId) {
      throw new ConvexError("CONFIRM_ID_MISMATCH");
    }

    // Tenant-aware lookup using composite index
    let space;
    if (args.tenantId) {
      space = await ctx.db
        .query("memorySpaces")
        .withIndex("by_tenant_memorySpaceId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("memorySpaceId", args.memorySpaceId),
        )
        .first();
    } else {
      // For non-tenant: only delete if record has no tenantId
      const candidate = await ctx.db
        .query("memorySpaces")
        .withIndex("by_memorySpaceId", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .first();
      space = candidate && !candidate.tenantId ? candidate : null;
    }

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    let conversationsDeleted = 0;
    let memoriesDeleted = 0;
    let factsDeleted = 0;

    if (args.cascade) {
      // Delete all conversations
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();

      for (const conv of conversations) {
        await ctx.db.delete(conv._id);
      }
      conversationsDeleted = conversations.length;

      // Delete all memories
      const memories = await ctx.db
        .query("memories")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();

      for (const mem of memories) {
        await ctx.db.delete(mem._id);
      }
      memoriesDeleted = memories.length;

      // Delete all facts
      const facts = await ctx.db
        .query("facts")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();

      for (const fact of facts) {
        await ctx.db.delete(fact._id);
      }
      factsDeleted = facts.length;
    }

    // Delete space itself
    await ctx.db.delete(space._id);

    return {
      memorySpaceId: args.memorySpaceId,
      deleted: true as const,
      cascade: {
        conversationsDeleted,
        memoriesDeleted,
        factsDeleted,
        totalBytes: 0, // TODO: Implement size calculation
      },
      reason: args.reason,
      deletedAt: Date.now(),
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get memory space by ID
 */
export const get = query({
  args: {
    memorySpaceId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy filter
  },
  handler: async (ctx, args) => {
    let space;
    if (args.tenantId) {
      // For multi-tenant: find space within tenant's namespace using composite index
      space = await ctx.db
        .query("memorySpaces")
        .withIndex("by_tenant_memorySpaceId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("memorySpaceId", args.memorySpaceId),
        )
        .first();
    } else {
      // For non-tenant: find globally but only return if record has no tenantId
      const candidate = await ctx.db
        .query("memorySpaces")
        .withIndex("by_memorySpaceId", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .first();
      // Only match if the record is truly global (no tenantId)
      space = candidate && !candidate.tenantId ? candidate : null;
    }

    return space || null;
  },
});

/**
 * List memory spaces with pagination and sorting
 */
export const list = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("personal"),
        v.literal("team"),
        v.literal("project"),
        v.literal("custom"),
      ),
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    participant: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("createdAt"),
        v.literal("updatedAt"),
        v.literal("name"),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
  },
  handler: async (ctx, args) => {
    let spaces = await ctx.db.query("memorySpaces").collect();

    // Tenant isolation filter (apply first for efficiency)
    if (args.tenantId) {
      spaces = spaces.filter((s) => s.tenantId === args.tenantId);
    }

    // Apply filters
    if (args.type) {
      spaces = spaces.filter((s) => s.type === args.type);
    }

    if (args.status) {
      spaces = spaces.filter((s) => s.status === args.status);
    }

    if (args.participant) {
      spaces = spaces.filter((s) =>
        s.participants.some((p) => p.id === args.participant),
      );
    }

    // Get total before pagination
    const total = spaces.length;

    // Sort
    const sortBy = args.sortBy || "createdAt";
    const sortOrder = args.sortOrder || "desc";

    spaces.sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      if (sortBy === "name") {
        aVal = a.name || "";
        bVal = b.name || "";
      } else {
        aVal = a[sortBy];
        bVal = b[sortBy];
      }

      if (aVal === undefined) aVal = sortBy === "name" ? "" : 0;
      if (bVal === undefined) bVal = sortBy === "name" ? "" : 0;

      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 100;
    const paginatedSpaces = spaces.slice(offset, offset + limit);

    return {
      spaces: paginatedSpaces,
      total,
      hasMore: offset + limit < total,
      offset,
    };
  },
});

/**
 * Count memory spaces
 */
export const count = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("personal"),
        v.literal("team"),
        v.literal("project"),
        v.literal("custom"),
      ),
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    let spaces = await ctx.db.query("memorySpaces").collect();

    if (args.type) {
      spaces = spaces.filter((s) => s.type === args.type);
    }

    if (args.status) {
      spaces = spaces.filter((s) => s.status === args.status);
    }

    return spaces.length;
  },
});

/**
 * Get memory space statistics with optional time window and participant breakdown
 */
export const getStats = query({
  args: {
    memorySpaceId: v.string(),
    timeWindow: v.optional(
      v.union(
        v.literal("24h"),
        v.literal("7d"),
        v.literal("30d"),
        v.literal("90d"),
        v.literal("all"),
      ),
    ),
    includeParticipants: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query("memorySpaces")
      .withIndex("by_memorySpaceId", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .first();

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    // Calculate time window cutoff
    const now = Date.now();
    let windowCutoff = 0;
    if (args.timeWindow && args.timeWindow !== "all") {
      const windowMs: Record<string, number> = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
      };
      windowCutoff = now - windowMs[args.timeWindow];
    }

    // Get all conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .collect();

    // Get all memories
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .collect();

    // Get all facts (active only)
    const facts = await ctx.db
      .query("facts")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .collect()
      .then((f) => f.filter((fact) => fact.supersededBy === undefined));

    // Total counts
    const totalConversations = conversations.length;
    const totalMemories = memories.length;
    const totalFacts = facts.length;
    const totalMessages = conversations.reduce(
      (sum, conv) => sum + conv.messageCount,
      0,
    );

    // Time window counts
    const memoriesThisWindow =
      windowCutoff > 0
        ? memories.filter((m) => m.createdAt >= windowCutoff).length
        : totalMemories;
    const conversationsThisWindow =
      windowCutoff > 0
        ? conversations.filter((c) => c.createdAt >= windowCutoff).length
        : totalConversations;

    // Calculate importance breakdown
    const importanceBreakdown = {
      critical: memories.filter((m) => m.importance >= 90).length,
      high: memories.filter((m) => m.importance >= 70 && m.importance < 90)
        .length,
      medium: memories.filter((m) => m.importance >= 40 && m.importance < 70)
        .length,
      low: memories.filter((m) => m.importance >= 10 && m.importance < 40)
        .length,
      trivial: memories.filter((m) => m.importance < 10).length,
    };

    // Aggregate tags
    const tagCounts: Record<string, number> = {};
    for (const memory of memories) {
      for (const tag of memory.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    // Participant activity breakdown (if requested)
    let participants:
      | Array<{
          participantId: string;
          memoriesStored: number;
          conversationsStored: number;
          factsExtracted: number;
          firstActive: number;
          lastActive: number;
          avgImportance: number;
          topTags: string[];
        }>
      | undefined;

    if (args.includeParticipants) {
      const participantMap = new Map<
        string,
        {
          memoriesStored: number;
          conversationsStored: number;
          factsExtracted: number;
          firstActive: number;
          lastActive: number;
          importanceSum: number;
          tags: Record<string, number>;
        }
      >();

      // Aggregate by participantId from memories
      for (const memory of memories) {
        const pid = memory.participantId || "unknown";
        const existing = participantMap.get(pid) || {
          memoriesStored: 0,
          conversationsStored: 0,
          factsExtracted: 0,
          firstActive: memory.createdAt,
          lastActive: memory.createdAt,
          importanceSum: 0,
          tags: {},
        };

        existing.memoriesStored++;
        existing.importanceSum += memory.importance || 0;
        existing.firstActive = Math.min(existing.firstActive, memory.createdAt);
        existing.lastActive = Math.max(
          existing.lastActive,
          memory.updatedAt || memory.createdAt,
        );

        for (const tag of memory.tags || []) {
          existing.tags[tag] = (existing.tags[tag] || 0) + 1;
        }

        participantMap.set(pid, existing);
      }

      // Count conversations by participant
      for (const conv of conversations) {
        const pid = conv.participantId || "unknown";
        const existing = participantMap.get(pid);
        if (existing) {
          existing.conversationsStored++;
        }
      }

      // Count facts by participant
      for (const fact of facts) {
        const pid = fact.participantId || "unknown";
        const existing = participantMap.get(pid);
        if (existing) {
          existing.factsExtracted++;
        }
      }

      participants = Array.from(participantMap.entries()).map(
        ([participantId, data]) => ({
          participantId,
          memoriesStored: data.memoriesStored,
          conversationsStored: data.conversationsStored,
          factsExtracted: data.factsExtracted,
          firstActive: data.firstActive,
          lastActive: data.lastActive,
          avgImportance:
            data.memoriesStored > 0
              ? Math.round(data.importanceSum / data.memoriesStored)
              : 0,
          topTags: Object.entries(data.tags)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => tag),
        }),
      );
    }

    return {
      memorySpaceId: args.memorySpaceId,
      totalMemories,
      totalConversations,
      totalFacts,
      totalMessages,
      memoriesThisWindow,
      conversationsThisWindow,
      storage: {
        conversationsBytes: 0, // TODO: Implement size calculation
        memoriesBytes: 0,
        factsBytes: 0,
        totalBytes: 0,
      },
      topTags,
      importanceBreakdown,
      participants,
    };
  },
});

/**
 * Find memory spaces by participant
 */
export const findByParticipant = query({
  args: {
    participantId: v.string(),
  },
  handler: async (ctx, args) => {
    const allSpaces = await ctx.db.query("memorySpaces").collect();

    return allSpaces.filter((space) =>
      space.participants.some((p) => p.id === args.participantId),
    );
  },
});

/**
 * Search memory spaces by name or metadata
 */
export const search = query({
  args: {
    query: v.string(),
    type: v.optional(
      v.union(
        v.literal("personal"),
        v.literal("team"),
        v.literal("project"),
        v.literal("custom"),
      ),
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let spaces = await ctx.db.query("memorySpaces").collect();

    // Apply type and status filters
    if (args.type) {
      spaces = spaces.filter((s) => s.type === args.type);
    }
    if (args.status) {
      spaces = spaces.filter((s) => s.status === args.status);
    }

    // Text search across name and metadata
    const queryLower = args.query.toLowerCase();
    spaces = spaces.filter((space) => {
      // Search in name
      if (space.name && space.name.toLowerCase().includes(queryLower)) {
        return true;
      }

      // Search in memorySpaceId
      if (space.memorySpaceId.toLowerCase().includes(queryLower)) {
        return true;
      }

      // Search in metadata (stringify and search)
      if (space.metadata) {
        const metadataStr = JSON.stringify(space.metadata).toLowerCase();
        if (metadataStr.includes(queryLower)) {
          return true;
        }
      }

      return false;
    });

    // Limit results
    return spaces.slice(0, args.limit || 50);
  },
});

/**
 * Update participants (combined add/remove)
 */
export const updateParticipants = mutation({
  args: {
    memorySpaceId: v.string(),
    add: v.optional(
      v.array(
        v.object({
          id: v.string(),
          type: v.string(),
          joinedAt: v.number(),
        }),
      ),
    ),
    remove: v.optional(v.array(v.string())), // Participant IDs to remove
  },
  handler: async (ctx, args) => {
    const space = await ctx.db
      .query("memorySpaces")
      .withIndex("by_memorySpaceId", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .first();

    if (!space) {
      throw new ConvexError("MEMORYSPACE_NOT_FOUND");
    }

    let updatedParticipants = [...space.participants];

    // Remove participants
    if (args.remove && args.remove.length > 0) {
      updatedParticipants = updatedParticipants.filter(
        (p) => !args.remove!.includes(p.id),
      );
    }

    // Add new participants
    if (args.add && args.add.length > 0) {
      for (const newParticipant of args.add) {
        // Don't add duplicates
        if (!updatedParticipants.some((p) => p.id === newParticipant.id)) {
          updatedParticipants.push(newParticipant);
        }
      }
    }

    await ctx.db.patch(space._id, {
      participants: updatedParticipants,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(space._id);
  },
});

/**
 * Purge all memory spaces (TEST/DEV ONLY)
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

    const allSpaces = await ctx.db.query("memorySpaces").collect();

    for (const space of allSpaces) {
      await ctx.db.delete(space._id);
    }

    return { deleted: allSpaces.length };
  },
});
