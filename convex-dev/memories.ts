import { graphMutation } from "./lib/graphSync";
import {validateDomainSelection} from "./lib/domainPaging";
import { requireNoLinkedFacts } from "./lib/domainPaging";
import { memoryVectorScopeKey } from "./lib/memoryVectorScope";
import { lifecycleControl, WRITER_MANIFEST_HASH } from "./lib/referenceLifecycle";
import { paginationOptsValidator } from "convex/server";
import { domainGraphIdentity, scopedMemory, memoryFilterFields, matchesMemory, domainFingerprint, checkFingerprint, domainBudget, domainPageOptions, domainInteger } from "./lib/domainPaging";
import { captureInsertedRow, reconcileRow, markDeletedRow } from "./lib/referenceLifecycle";
import { validateDomainScope } from "./lib/domainScope";
/**
 * Cortex SDK - Vector Memory API (Layer 2)
 *
 * Searchable agent-private memories with embeddings
 * References Layer 1 stores for full context
 */

import { ConvexError, convexToJson, v } from "convex/values";
import { action, internalQuery, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, type Id } from "./_generated/dataModel";
import { uniqueReference } from "./lib/referenceLifecycle";
const partialGuards={expectedPhysicalId:v.optional(v.id("memories")),expectedSourceRevision:v.optional(v.number()),expectedReferenceGeneration:v.optional(v.string())};
async function partialReceipt(ctx:MutationCtx,row:Doc<"memories">) {
  const target=await ctx.db.query("cortexReferenceTargets").withIndex("by_document",q=>q.eq("table","memories").eq("documentId",String(row._id))).take(2).then(uniqueReference);
  if(!target||!Number.isSafeInteger(target.sourceRevision)||target.sourceRevision!<1||target.state!=="live"||target.documentId!==row._id||
    !target.scopeKnown||target.tenantId!==row.tenantId||target.memorySpaceId!==row.memorySpaceId)throw new ConvexError("GRAPH_PARTIAL_SOURCE_UNRESOLVED");
  return {memoryId:row.memoryId,_id:row._id,sourceRevision:target.sourceRevision!,referenceGeneration:target.generation,ownershipRevision:target.ownershipRevision!};
}
async function selectedPartial(ctx:MutationCtx,args:{tenantId?:string;memorySpaceId:string;memoryId:string;expectedPhysicalId?:Id<"memories">;expectedSourceRevision?:number;expectedReferenceGeneration?:string}) {
  const row=args.expectedPhysicalId?await ctx.db.get(args.expectedPhysicalId):await scopedMemory(ctx,args);
  if(!row||row.memoryId!==args.memoryId||row.memorySpaceId!==args.memorySpaceId||row.tenantId!==args.tenantId||row.isPartial!==true)
    throw new ConvexError("GRAPH_PARTIAL_SELECTION_CHANGED");
  const receipt=await partialReceipt(ctx,row);
  if(args.expectedSourceRevision!==undefined&&(!Number.isSafeInteger(args.expectedSourceRevision)||receipt.sourceRevision!==args.expectedSourceRevision)||
    args.expectedReferenceGeneration!==undefined&&receipt.referenceGeneration!==args.expectedReferenceGeneration)
    throw new ConvexError("GRAPH_PARTIAL_SELECTION_CHANGED");
  return row;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Store a new vector memory
 */
export const store = graphMutation({
  args: {
    memorySpaceId: v.string(), // Updated
    participantId: v.optional(v.string()), // NEW: Hive Mode
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    content: v.string(),
    contentType: v.union(
      v.literal("raw"),
      v.literal("summarized"),
      v.literal("fact"),
    ), // Added fact
    embedding: v.optional(v.array(v.float64())),
    sourceType: v.union(
      v.literal("conversation"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("a2a"),
      v.literal("fact-extraction"), // NEW: For fact-extracted memories
    ),
    sourceUserId: v.optional(v.string()),
    sourceUserName: v.optional(v.string()),
    userId: v.optional(v.string()), // For user-owned memories
    agentId: v.optional(v.string()), // For agent-owned memories
    messageRole: v.optional(
      v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    ), // NEW: For semantic search weighting
    // Enrichment fields (for bullet-proof retrieval)
    enrichedContent: v.optional(v.string()), // Concatenated searchable content for embedding
    factCategory: v.optional(v.string()), // Category for filtering (e.g., "addressing_preference")
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
    factsRef: v.optional(
      v.object({
        factId: v.string(),
        version: v.optional(v.number()),
      }),
    ), // NEW: Reference to Layer 3 fact
    importance: v.number(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const memoryId = `mem-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await captureInsertedRow(ctx, "memories", {
      memoryId,
      memorySpaceId: args.memorySpaceId, // Updated
      participantId: args.participantId, // NEW
      tenantId: args.tenantId, // Store tenantId
      content: args.content,
      contentType: args.contentType,
      embedding: args.embedding,
      sourceType: args.sourceType,
      sourceUserId: args.sourceUserId,
      sourceUserName: args.sourceUserName,
      sourceTimestamp: now,
      messageRole: args.messageRole, // NEW
      // Enrichment fields
      enrichedContent: args.enrichedContent,
      factCategory: args.factCategory,
      userId: args.userId,
      agentId: args.agentId, // NEW: Agent-owned memories support
      conversationRef: args.conversationRef,
      immutableRef: args.immutableRef,
      mutableRef: args.mutableRef,
      factsRef: args.factsRef, // NEW
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
 * Store a partial memory (for streaming)
 * Creates a memory marked as in-progress
 */
export const storePartialMemory = graphMutation({
  args: {
    tenantId:v.optional(v.string()),
    memorySpaceId: v.string(),
    participantId: v.optional(v.string()),
    conversationId: v.string(),
    userId: v.string(),
    content: v.string(),
    isPartial: v.boolean(),
    metadata: v.any(),
    importance: v.number(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const memoryId = `mem-partial-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await captureInsertedRow(ctx, "memories", {
      memoryId,
      memorySpaceId: args.memorySpaceId,
      tenantId:args.tenantId,
      participantId: args.participantId,
      content: args.content,
      contentType: "raw" as const,
      sourceType: "conversation" as const,
      sourceTimestamp: now,
      userId: args.userId,
      conversationRef: {
        conversationId: args.conversationId,
        messageIds: [],
      },
      importance: args.importance,
      tags: args.tags,
      version: 1,
      previousVersions: [],
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      // Store partial flag and metadata in a way Convex can handle
      isPartial: args.isPartial,
      partialMetadata: args.metadata,
    });

    const row=await ctx.db.get(_id);if(!row)throw new ConvexError("GRAPH_PARTIAL_SOURCE_UNRESOLVED");
    return partialReceipt(ctx,row);
  },
});

/**
 * Update a partial memory (for streaming)
 * Updates content and metadata during streaming
 */
export const updatePartialMemory = graphMutation({
  args: {
    ...partialGuards,
    tenantId:v.optional(v.string()),
    memorySpaceId:v.string(),
    memoryId: v.string(),
    content: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const memory=await selectedPartial(ctx,args);

    await reconcileRow(ctx, memory._id, {
      content: args.content,
      updatedAt: Date.now(),
      partialMetadata: args.metadata,
    });

    const row=await ctx.db.get(memory._id);if(!row)throw new ConvexError("GRAPH_PARTIAL_SOURCE_UNRESOLVED");
    return {success:true,...await partialReceipt(ctx,row)};
  },
});

/**
 * Finalize a partial memory (for streaming)
 * Marks memory as complete and removes partial flag
 */
export const finalizePartialMemory = graphMutation({
  args: {
    ...partialGuards,
    tenantId:v.optional(v.string()),
    memorySpaceId:v.string(),
    memoryId: v.string(),
    content: v.string(),
    embedding: v.optional(v.array(v.float64())),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const memory=await selectedPartial(ctx,args);

    // Remove streaming-related tags
    const finalTags = memory.tags.filter(
      (tag) => tag !== "streaming" && tag !== "partial",
    );

    await reconcileRow(ctx, memory._id, {
      content: args.content,
      embedding: args.embedding,
      updatedAt: Date.now(),
      isPartial: false,
      tags: finalTags,
      partialMetadata: args.metadata,
    });

    const row=await ctx.db.get(memory._id);if(!row)throw new ConvexError("GRAPH_PARTIAL_SOURCE_UNRESOLVED");
    return {success:true,...await partialReceipt(ctx,row)};
  },
});

/**
 * Delete a memory
 */
export const deleteMemory = graphMutation({
  args: {
    ...partialGuards,
    expectedPartial:v.optional(v.boolean()),
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(), // Updated
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await scopedMemory(ctx, args);

    if (!memory) {
      throw new ConvexError("MEMORY_NOT_FOUND");
    }

    // Verify memorySpace owns this memory
    if (memory.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
    }

    if(args.expectedPhysicalId!==undefined&&memory._id!==args.expectedPhysicalId)throw new ConvexError("GRAPH_PARTIAL_SELECTION_CHANGED");
    if(args.expectedPartial===true)await selectedPartial(ctx,args);
    else if(args.expectedSourceRevision!==undefined||args.expectedReferenceGeneration!==undefined) {
      const captured=await partialReceipt(ctx,memory);
      if(captured.sourceRevision!==args.expectedSourceRevision||captured.referenceGeneration!==args.expectedReferenceGeneration)throw new ConvexError("GRAPH_PARTIAL_SELECTION_CHANGED");
    }

    await markDeletedRow(ctx, memory._id);

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
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await scopedMemory(ctx, args);

    if (!memory) {
      return null;
    }

    // Verify memorySpace owns this memory
    if (memory.memorySpaceId !== args.memorySpaceId) {
      return null; // Permission denied (silent)
    }

    return memory;
  },
});

/**
 * Internal query to fetch memories by their IDs (used by search action)
 */
export const fetchMemoriesByIds = internalQuery({
  args: {...memoryFilterFields, ids: v.array(v.id("memories"))},
  handler: async (ctx, args): Promise<Doc<"memories">[]> => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    if (args.ids.length > 256) throw new ConvexError("DOMAIN_READ_BUDGET_EXCEEDED");
    const results: Doc<"memories">[] = [];
    for (const id of args.ids) { const doc = await ctx.db.get(id); if (doc && matchesMemory(doc, args)) results.push(doc); }
    await domainBudget(ctx, results); return results;
  },
});

/**
 * Internal query for keyword search (used by search action)
 */
export const keywordSearchMemories = internalQuery({
  args: {...memoryFilterFields, query: v.string(), limit: v.number()},
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args); domainInteger(args.limit, 20);
    const rows = await ctx.db.query("memories").withSearchIndex("by_content", q => q.search("content", args.query).eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).take(257);
    const result = rows.filter(row => matchesMemory(row, args)).slice(0, args.limit);
    await domainBudget(ctx, result); return result;
  },
});

/**
 * Search memories (semantic with vector, keyword with text, or hybrid)
 *
 * Note: Vector search requires using ctx.vectorSearch() which is only
 * available in actions, so this is implemented as an action.
 */
/** Fresh empty is searchable; nonempty legacy coverage must migrate before vector search. */
export const vectorReadiness = internalQuery({
  args: {},
  handler: async ctx => {
    const state = await lifecycleControl(ctx);
    if (state?.status === "ready" && state.writerManifestHash === WRITER_MANIFEST_HASH) return true;
    if (!state && !(await ctx.db.query("memories").first())) return true;
    throw new ConvexError("MEMORY_VECTOR_SCOPE_NOT_READY: Run cortex schema migrate on this deployment");
  },
});
export const search = action({
  args: {
    ...memoryFilterFields,
    query: v.string(),
    embedding: v.optional(v.array(v.float64())),
    offset: v.optional(v.number()),
    minScore: v.optional(v.number()),
    queryCategory: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    const limit = domainInteger(args.limit, 20);
    const offset = domainInteger(args.offset, 0);
    const {query: _query, embedding: _embedding, offset: _offset, limit: _limit, minScore: _minScore, queryCategory: _queryCategory, ...filters} = args;
    void [_query, _embedding, _offset, _limit, _minScore, _queryCategory];
    if (limit === 0) return [];
    if (args.embedding && args.embedding.length) await ctx.runQuery(internal.memories.vectorReadiness, {});
    let results: any[] = [];

    if (args.embedding && args.embedding.length > 0) {
      // Semantic search with vector similarity using ctx.vectorSearch()
      // This is the correct Convex API for vector search (only available in actions)
      const vectorResults = await ctx.vectorSearch("memories", "by_embedding", {
        vector: args.embedding,
        limit: 256, // Explicit native candidate bound; all declared postfilters precede the returned window.
        filter: (q) => q.eq("vectorScopeKey", memoryVectorScopeKey(args.tenantId, args.memorySpaceId)),
      });

      // Fetch full documents using internal query
      const ids = vectorResults.map((r) => r._id);
      const docs = [];
      for (let start = 0; start < ids.length; start += 128) {
        docs.push(...await ctx.runQuery(internal.memories.fetchMemoriesByIds, {
          ids: ids.slice(start, start + 128), ...filters,
        }));
      }

      // Merge scores with documents (preserve order from vector search)
      const scoreMap = new Map(
        vectorResults.map((r) => [r._id.toString(), r._score]),
      );
      results = docs.map((doc) => ({
        ...doc,
        _score: scoreMap.get(doc._id.toString()) ?? 0,
      }));

      // Sort by score (should already be sorted, but ensure consistency)
      results.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
    } else {
      // Keyword search using internal query
      results = await ctx.runQuery(internal.memories.keywordSearchMemories, {
        ...filters,
        query: args.query,
        limit: Math.min(256, offset + limit),
      });
    }

    // Apply filters
    if (args.userId) {
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

    // Apply role-based and category-based weighting for semantic search
    if (args.embedding && args.embedding.length > 0) {
      results = results.map((m: any) => {
        let score = m._score ?? 0;

        // Role-based weighting
        if (m.messageRole === "user") {
          score *= 1.25;
        } else if (m.messageRole === "agent") {
          const content = (m.content || "").toLowerCase();
          const isAcknowledgment =
            content.length < 60 &&
            (content.includes("got it") ||
              content.includes("i've noted") ||
              content.includes("i'll remember") ||
              content.includes("noted") ||
              content.includes("understood") ||
              content.includes("i'll set") ||
              content.includes("i'll call"));
          if (isAcknowledgment) {
            score *= 0.5;
          }
        }

        // Category-based boosting
        if (args.queryCategory && m.factCategory === args.queryCategory) {
          score *= 1.3;
        }

        // Enriched content boost
        if (m.enrichedContent) {
          score *= 1.1;
        }

        return { ...m, _score: score };
      });

      // Re-sort after applying weights
      results.sort((a: any, b: any) => (b._score ?? 0) - (a._score ?? 0));
    }

    // Filter by minimum score
    if (args.minScore !== undefined) {
      results = results.filter((m: any) => {
        if (m._score !== undefined) {
          return m._score >= args.minScore!;
        }
        return true;
      });
    }

    const selected = results.slice(offset, offset + limit);
    if (new TextEncoder().encode(JSON.stringify(convexToJson(selected))).byteLength > 8 * 1024 * 1024) throw new ConvexError("DOMAIN_RESULT_BUDGET_EXCEEDED");
    return selected;
  },
});

/**
 * List memories with filters
 */
export const list = query({
  args: {...memoryFilterFields, limit: v.optional(v.number())},
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId);
    const limit = domainInteger(args.limit, 100);
    const scan = await ctx.db.query("memories").withIndex("by_tenant_space", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).order("desc").take(257);
    const result = scan.filter(row => matchesMemory(row, args)).slice(0, limit);
    await domainBudget(ctx, result); return result;
  },
});

/**
 * Count memories
 */
export const count = query({
  args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(), // Updated
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("a2a"),
        v.literal("fact-extraction"), // NEW
      ),
    ),
  },
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId);
    let memories = await ctx.db
      .query("memories")
      .withIndex("by_tenant_space", (q) =>
        q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId),
      ) // Updated
      .collect();

    if (args.participantId !== undefined) memories = memories.filter(m => m.participantId === args.participantId);

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
export const update = graphMutation({
  args: {
    memorySpaceId: v.string(),
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
      throw new ConvexError("MEMORY_NOT_FOUND");
    }

    if (memory.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
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

    await reconcileRow(ctx, memory._id, {
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
    memorySpaceId: v.string(),
    memoryId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory || memory.memorySpaceId !== args.memorySpaceId) {
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
    memorySpaceId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory || memory.memorySpaceId !== args.memorySpaceId) {
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
export const deleteMany = graphMutation({
  args: {...memoryFilterFields},
  handler: async () => { throw new ConvexError("DOMAIN_PREFLIGHT_REQUIRED: use SDK physical selection preflight"); },
});

/**
 * Delete multiple memories by their IDs (batch delete for cascade operations)
 * Much faster than calling deleteMemory multiple times
 * Uses index lookups instead of full table scan to avoid memory issues with large tables
 */
export const deleteByIds = graphMutation({
  args: {
    memoryIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const deletedIds: string[] = [];

    // Look up each memory by index to avoid full table scan
    // This is O(n) index lookups vs O(entire table) memory usage
    for (const memoryId of args.memoryIds) {
      const memory = await ctx.db
        .query("memories")
        .withIndex("by_memoryId", (q) => q.eq("memoryId", memoryId))
        .first();

      if (memory) {
        await markDeletedRow(ctx, memory._id);
        deletedIds.push(memoryId);
      }
    }

    return {
      deleted: deletedIds.length,
      memoryIds: deletedIds,
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
export const purgeAll = graphMutation({
  args: {},
  handler: async (ctx) => {
    // Security check: Only allow in test/dev environments
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
        "PURGE_DISABLED_IN_PRODUCTION: purgeAll is only available in test/dev environments. " +
          "Use deleteMany with specific memorySpaceId for targeted deletions.",
      );
    }

    const allMemories = await ctx.db.query("memories").collect();

    let deleted = 0;

    for (const memory of allMemories) {
      await markDeletedRow(ctx, memory._id);
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
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(), // Updated
    userId: v.optional(v.string()),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeEmbeddings: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let memories = await ctx.db
      .query("memories")
      .withIndex("by_tenant_space", (q) =>
        q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId),
      )
      .take(257);

    if (args.userId) {
      memories = memories.filter(
        (m) => m.userId === args.userId || m.sourceUserId === args.userId,
      );
    }

    await domainBudget(ctx, memories);
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
    }
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
      m.content,
      m.sourceType,
      m.importance.toString(),
      m.tags.join(";"),
      new Date(m.createdAt).toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");

    return {
      format: "csv",
      data: csv,
      count: memories.length,
      exportedAt: Date.now(),
    };
  },
});

/**
 * Update many memories
 */
export const updateMany = graphMutation({
  args: {
    memorySpaceId: v.string(), // Updated
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
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
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

      await reconcileRow(ctx, memory._id, patches);
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
export const archive = graphMutation({
  args: {
    expectedPhysicalId: v.optional(v.id("memories")),
    expectedFingerprint: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await scopedMemory(ctx, args);

    if (!memory) {
      throw new ConvexError("MEMORY_NOT_FOUND");
    }

    if (memory.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
    }

    if (args.expectedPhysicalId !== undefined && memory._id !== args.expectedPhysicalId) throw new ConvexError("DOMAIN_SELECTION_CHANGED");
    if (args.expectedFingerprint !== undefined) checkFingerprint(memory, args.expectedFingerprint);
    // Mark as archived by adding to tags
    const updatedTags = memory.tags.includes("archived")
      ? memory.tags
      : [...memory.tags, "archived"];

    await reconcileRow(ctx, memory._id, {
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
 * Restore memory from archive
 */
export const restoreFromArchive = graphMutation({
  args: {
    expectedPhysicalId: v.optional(v.id("memories")),
    expectedFingerprint: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(),
    memoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await scopedMemory(ctx, args);

    if (!memory) {
      throw new ConvexError("MEMORY_NOT_FOUND");
    }

    if (memory.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
    }

    if (args.expectedPhysicalId !== undefined && memory._id !== args.expectedPhysicalId) throw new ConvexError("DOMAIN_SELECTION_CHANGED");
    if (args.expectedFingerprint !== undefined) checkFingerprint(memory, args.expectedFingerprint);
    // Check if memory is archived
    if (!memory.tags.includes("archived")) {
      throw new ConvexError("MEMORY_NOT_ARCHIVED");
    }

    // Remove archived tag
    const updatedTags = memory.tags.filter((tag) => tag !== "archived");

    // Restore importance to a reasonable default if it was reduced
    const restoredImportance = memory.importance < 50 ? 50 : memory.importance;

    await reconcileRow(ctx, memory._id, {
      tags: updatedTags,
      importance: restoredImportance,
      updatedAt: Date.now(),
    });

    return {
      restored: true,
      memoryId: args.memoryId,
      memory: await ctx.db.get(memory._id),
    };
  },
});

/**
 * Get version at specific timestamp
 */
export const getAtTimestamp = query({
  args: {
    memorySpaceId: v.string(),
    memoryId: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db
      .query("memories")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", args.memoryId))
      .first();

    if (!memory || memory.memorySpaceId !== args.memorySpaceId) {
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

/** Native cursor/range service for ordinary public domain management. */
export const domainPage = query({
  args: {...memoryFilterFields, paginationOpts: paginationOptsValidator},
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    const scan = await ctx.db.query("memories").withIndex("by_tenant_space", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).order("desc").paginate(domainPageOptions(args.paginationOpts));
    const page = scan.pageStatus === "SplitRequired" ? [] : scan.page.filter(row => matchesMemory(row, args));
    const result = {...scan, page, fingerprints: Object.fromEntries(page.map(row => [row._id, domainFingerprint(row)]))};
    await domainBudget(ctx, result); return result;
  },
});
/** One frozen physical primary record per transaction; no durable receipt is claimed. */
export const eraseSelected = graphMutation({
  args: {tenantId: v.optional(v.string()), memorySpaceId: v.string(), physicalId: v.id("memories"), expectedFingerprint: v.string(), requireNoLinkedFacts: v.optional(v.boolean())},
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    const row = await ctx.db.get(args.physicalId);
    if (!row) return {deleted: false, alreadyAbsent: true, memoryId: "", physicalId: args.physicalId};
    if (row.tenantId !== args.tenantId || row.memorySpaceId !== args.memorySpaceId) throw new ConvexError("DOMAIN_SELECTION_CHANGED");
    checkFingerprint(row, args.expectedFingerprint);
    if (args.requireNoLinkedFacts) await requireNoLinkedFacts(ctx, row);
    const graphIdentity = await domainGraphIdentity(ctx, "memories", row); await markDeletedRow(ctx, row._id);
    return {deleted: true, memoryId: row.memoryId, physicalId: row._id, graphIdentity};
  },
});
