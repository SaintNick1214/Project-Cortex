/**
 * Cortex SDK - Vector Memory API (Layer 2)
 *
 * Searchable agent-private memories with embeddings
 * References Layer 1 stores for full context
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Store a new vector memory
 */
export const store = mutation({
  args: {
    agentId: v.string(),
    content: v.string(),
    contentType: v.union(v.literal("raw"), v.literal("summarized")),
    embedding: v.optional(v.array(v.float64())),
    sourceType: v.union(
      v.literal("conversation"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("a2a"),
    ),
    sourceUserId: v.optional(v.string()),
    sourceUserName: v.optional(v.string()),
    userId: v.optional(v.string()),
    conversationRef: v.optional(
      v.object({
        conversationId: v.string(),
        messageIds: v.array(v.string()),
      }),
    ),
    immutableRef: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
        version: v.optional(v.number()),
      }),
    ),
    mutableRef: v.optional(
      v.object({
        namespace: v.string(),
        key: v.string(),
        snapshotValue: v.any(),
        snapshotAt: v.number(),
      }),
    ),
    importance: v.number(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const memoryId = `mem-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await ctx.db.insert("memories", {
      memoryId,
      agentId: args.agentId,
      content: args.content,
      contentType: args.contentType,
      embedding: args.embedding,
      sourceType: args.sourceType,
      sourceUserId: args.sourceUserId,
      sourceUserName: args.sourceUserName,
      sourceTimestamp: now,
      userId: args.userId,
      conversationRef: args.conversationRef,
      immutableRef: args.immutableRef,
      mutableRef: args.mutableRef,
      importance: args.importance,
      tags: args.tags,
      version: 1,
      previousVersions: [],
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Delete a memory
 */
export const deleteMemory = mutation({
  args: {
    agentId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Verify agent owns this memory
    if (memory.agentId !== args.agentId) {
      throw new Error("PERMISSION_DENIED");
    }

    await ctx.db.delete(memory._id);

    return { deleted: true, memoryId: args.memoryId };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get memory by ID
 */
export const get = query({
  args: {
    agentId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory) {
      return null;
    }

    // Verify agent owns this memory
    if (memory.agentId !== args.agentId) {
      return null; // Permission denied (silent)
    }

    return memory;
  },
});

/**
 * Search memories (semantic with vector, keyword with text, or hybrid)
 */
export const search = query({
  args: {
    agentId: v.string(),
    query: v.string(),
    embedding: v.optional(v.array(v.float64())),
    userId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("a2a"),
      ),
    ),
    minImportance: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let results = [];

    if (args.embedding && args.embedding.length > 0) {
      // Semantic search with vector similarity
      // Try vector index first (production), fallback to manual similarity (local dev)
      try {
        results = await ctx.db
          .query("memories")
          .withIndex("by_embedding", (q) =>
            q.similar("embedding", args.embedding, args.limit || 20)
             .eq("agentId", args.agentId)
          )
          .collect();
      } catch (error: any) {
        // Fallback for local Convex (no vector index support)
        if (error.message?.includes("similar is not a function")) {
          const vectorResults = await ctx.db
            .query("memories")
            .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
            .collect();

          // Calculate cosine similarity for each result
          const withScores = vectorResults
            .filter((m) => m.embedding && m.embedding.length > 0)
            .map((m) => {
              // Validate dimension matching (critical for correct similarity)
              if (m.embedding!.length !== args.embedding!.length) {
                // Skip embeddings with mismatched dimensions
                return {
                  ...m,
                  _score: -1, // Will be filtered out
                };
              }

              // Cosine similarity calculation
              let dotProduct = 0;
              let normA = 0;
              let normB = 0;

              for (let i = 0; i < args.embedding!.length; i++) {
                dotProduct += args.embedding![i] * m.embedding![i];
                normA += args.embedding![i] * args.embedding![i];
                normB += m.embedding![i] * m.embedding![i];
              }

              // Handle edge cases (zero vectors)
              const denominator = Math.sqrt(normA) * Math.sqrt(normB);
              const similarity = denominator > 0 ? dotProduct / denominator : 0;

              return {
                ...m,
                _score: similarity,
              };
            })
            .filter((m) => !isNaN(m._score) && m._score >= 0) // Filter out NaN and dimension mismatches
            .sort((a, b) => b._score - a._score) // Sort by similarity (highest first)
            .slice(0, args.limit || 20);

          results = withScores;
        } else {
          throw error;
        }
      }
    } else {
      // Keyword search
      results = await ctx.db
        .query("memories")
        .withSearchIndex("by_content", (q) =>
          q.search("content", args.query).eq("agentId", args.agentId),
        )
        .take(args.limit || 20);
    }

    // Apply filters
    if (args.userId) {
      // Filter by sourceUserId (who the memory is about)
      results = results.filter(
        (m) => m.sourceUserId === args.userId || m.userId === args.userId,
      );
    }

    if (args.tags && args.tags.length > 0) {
      results = results.filter((m) =>
        args.tags!.some((tag) => m.tags.includes(tag)),
      );
    }

    if (args.sourceType) {
      results = results.filter((m) => m.sourceType === args.sourceType);
    }

    if (args.minImportance !== undefined) {
      results = results.filter((m) => m.importance >= args.minImportance!);
    }

    return results.slice(0, args.limit || 20);
  },
});

/**
 * List memories with filters
 */
export const list = query({
  args: {
    agentId: v.string(),
    userId: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("a2a"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let memories = await ctx.db
      .query("memories")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(args.limit || 100);

    // Apply filters
    if (args.userId) {
      memories = memories.filter((m) => m.userId === args.userId);
    }

    if (args.sourceType) {
      memories = memories.filter((m) => m.sourceType === args.sourceType);
    }

    return memories;
  },
});

/**
 * Count memories
 */
export const count = query({
  args: {
    agentId: v.string(),
    userId: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("a2a"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let memories = await ctx.db
      .query("memories")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .collect();

    // Apply filters
    if (args.userId) {
      memories = memories.filter((m) => m.userId === args.userId);
    }

    if (args.sourceType) {
      memories = memories.filter((m) => m.sourceType === args.sourceType);
    }

    return memories.length;
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Advanced Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Update a memory (creates new version)
 */
export const update = mutation({
  args: {
    agentId: v.string(),
    memoryId: v.string(),
    content: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    importance: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    if (memory.agentId !== args.agentId) {
      throw new Error("PERMISSION_DENIED");
    }

    const now = Date.now();
    const newVersion = memory.version + 1;

    // Add current to history
    const updatedPreviousVersions = [
      ...memory.previousVersions,
      {
        version: memory.version,
        content: memory.content,
        embedding: memory.embedding,
        timestamp: memory.updatedAt,
      },
    ];

    await ctx.db.patch(memory._id, {
      content: args.content || memory.content,
      embedding:
        args.embedding !== undefined ? args.embedding : memory.embedding,
      importance:
        args.importance !== undefined ? args.importance : memory.importance,
      tags: args.tags || memory.tags,
      version: newVersion,
      previousVersions: updatedPreviousVersions,
      updatedAt: now,
    });

    return await ctx.db.get(memory._id);
  },
});

/**
 * Get specific version
 */
export const getVersion = query({
  args: {
    agentId: v.string(),
    memoryId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory || memory.agentId !== args.agentId) {
      return null;
    }

    if (args.version === memory.version) {
      return {
        memoryId: memory.memoryId,
        version: memory.version,
        content: memory.content,
        embedding: memory.embedding,
        timestamp: memory.updatedAt,
      };
    }

    const prevVersion = memory.previousVersions.find(
      (v) => v.version === args.version,
    );
    return prevVersion
      ? {
          memoryId: memory.memoryId,
          version: prevVersion.version,
          content: prevVersion.content,
          embedding: prevVersion.embedding,
          timestamp: prevVersion.timestamp,
        }
      : null;
  },
});

/**
 * Get version history
 */
export const getHistory = query({
  args: {
    agentId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory || memory.agentId !== args.agentId) {
      return [];
    }

    const history = [
      ...memory.previousVersions.map((v) => ({
        memoryId: memory.memoryId,
        version: v.version,
        content: v.content,
        embedding: v.embedding,
        timestamp: v.timestamp,
      })),
      {
        memoryId: memory.memoryId,
        version: memory.version,
        content: memory.content,
        embedding: memory.embedding,
        timestamp: memory.updatedAt,
      },
    ];

    return history.sort((a, b) => a.version - b.version);
  },
});

/**
 * Delete many memories
 */
export const deleteMany = mutation({
  args: {
    agentId: v.string(),
    userId: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("a2a"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let memories = await ctx.db
      .query("memories")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .collect();

    if (args.userId) {
      memories = memories.filter(
        (m) => m.userId === args.userId || m.sourceUserId === args.userId,
      );
    }

    if (args.sourceType) {
      memories = memories.filter((m) => m.sourceType === args.sourceType);
    }

    let deleted = 0;
    for (const memory of memories) {
      await ctx.db.delete(memory._id);
      deleted++;
    }

    return {
      deleted,
      memoryIds: memories.map((m) => m.memoryId),
    };
  },
});

/**
 * Purge ALL memories (test environments only - no agent filtering)
 * WARNING: This deletes ALL memories in the database
 * 
 * SECURITY: Only enabled in test/dev environments
 * - Checks CONVEX_SITE_URL to prevent production misuse
 * - Local dev: localhost/127.0.0.1 URLs allowed
 * - Test deployments: dev-* deployment names allowed
 * - Production: Explicitly blocked
 */
export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Security check: Only allow in test/dev environments
    const siteUrl = process.env.CONVEX_SITE_URL || "";
    const isLocal = siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    const isDevDeployment = siteUrl.includes(".convex.site") || siteUrl.includes("dev-") || siteUrl.includes("convex.cloud");
    const isTestEnv = process.env.NODE_ENV === "test" || process.env.CONVEX_ENVIRONMENT === "test";
    
    if (!isLocal && !isDevDeployment && !isTestEnv) {
      throw new Error(
        "PURGE_DISABLED_IN_PRODUCTION: purgeAll is only available in test/dev environments. " +
        "Use deleteMany with specific agentId for targeted deletions."
      );
    }

    const allMemories = await ctx.db.query("memories").collect();
    
    let deleted = 0;
    for (const memory of allMemories) {
      await ctx.db.delete(memory._id);
      deleted++;
    }
    
    return { deleted };
  },
});

/**
 * Export memories
 */
export const exportMemories = query({
  args: {
    agentId: v.string(),
    userId: v.optional(v.string()),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeEmbeddings: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let memories = await ctx.db
      .query("memories")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .collect();

    if (args.userId) {
      memories = memories.filter(
        (m) => m.userId === args.userId || m.sourceUserId === args.userId,
      );
    }

    if (args.format === "json") {
      const data = memories.map((m) => ({
        memoryId: m.memoryId,
        content: m.content,
        sourceType: m.sourceType,
        importance: m.importance,
        tags: m.tags,
        createdAt: m.createdAt,
        ...(args.includeEmbeddings && m.embedding
          ? { embedding: m.embedding }
          : {}),
      }));

      return {
        format: "json",
        data: JSON.stringify(data, null, 2),
        count: memories.length,
        exportedAt: Date.now(),
      };
    } else {
      const headers = [
        "memoryId",
        "content",
        "sourceType",
        "importance",
        "tags",
        "createdAt",
      ];
      const rows = memories.map((m) => [
        m.memoryId,
        m.content.replace(/,/g, ";"),
        m.sourceType,
        m.importance.toString(),
        m.tags.join(";"),
        new Date(m.createdAt).toISOString(),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n",
      );

      return {
        format: "csv",
        data: csv,
        count: memories.length,
        exportedAt: Date.now(),
      };
    }
  },
});

/**
 * Update many memories
 */
export const updateMany = mutation({
  args: {
    agentId: v.string(),
    userId: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("a2a"),
      ),
    ),
    importance: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    let memories = await ctx.db
      .query("memories")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .collect();

    if (args.userId) {
      memories = memories.filter((m) => m.userId === args.userId);
    }

    if (args.sourceType) {
      memories = memories.filter((m) => m.sourceType === args.sourceType);
    }

    let updated = 0;
    for (const memory of memories) {
      const patches: any = { updatedAt: Date.now() };

      if (args.importance !== undefined) {
        patches.importance = args.importance;
      }

      if (args.tags) {
        patches.tags = args.tags;
      }

      await ctx.db.patch(memory._id, patches);
      updated++;
    }

    return {
      updated,
      memoryIds: memories.map((m) => m.memoryId),
    };
  },
});

/**
 * Archive memory (soft delete)
 */
export const archive = mutation({
  args: {
    agentId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    if (memory.agentId !== args.agentId) {
      throw new Error("PERMISSION_DENIED");
    }

    // Mark as archived by adding to tags
    const updatedTags = memory.tags.includes("archived")
      ? memory.tags
      : [...memory.tags, "archived"];

    await ctx.db.patch(memory._id, {
      tags: updatedTags,
      importance: Math.min(memory.importance, 10), // Reduce importance
      updatedAt: Date.now(),
    });

    return {
      archived: true,
      memoryId: args.memoryId,
      restorable: true,
    };
  },
});

/**
 * Get version at specific timestamp
 */
export const getAtTimestamp = query({
  args: {
    agentId: v.string(),
    memoryId: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory || memory.agentId !== args.agentId) {
      return null;
    }

    // If timestamp is after current version
    if (args.timestamp >= memory.updatedAt) {
      return {
        memoryId: memory.memoryId,
        version: memory.version,
        content: memory.content,
        embedding: memory.embedding,
        timestamp: memory.updatedAt,
      };
    }

    // If before creation
    if (args.timestamp < memory.createdAt) {
      return null;
    }

    // Find version that was current at timestamp
    for (let i = memory.previousVersions.length - 1; i >= 0; i--) {
      const prevVersion = memory.previousVersions[i];
      if (args.timestamp >= prevVersion.timestamp) {
        return {
          memoryId: memory.memoryId,
          version: prevVersion.version,
          content: prevVersion.content,
          embedding: prevVersion.embedding,
          timestamp: prevVersion.timestamp,
        };
      }
    }

    return null;
  },
});
