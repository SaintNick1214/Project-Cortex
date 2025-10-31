/**
 * Cortex SDK - Facts Store API (Layer 3)
 *
 * LLM-extracted, memorySpace-scoped, versioned facts
 * Structured knowledge with relationships
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Store a new fact
 */
export const store = mutation({
  args: {
    memorySpaceId: v.string(),
    participantId: v.optional(v.string()), // Hive Mode: who extracted this fact
    fact: v.string(), // The fact statement
    factType: v.union(
      v.literal("preference"),
      v.literal("identity"),
      v.literal("knowledge"),
      v.literal("relationship"),
      v.literal("event"),
      v.literal("custom"),
    ),
    subject: v.optional(v.string()), // Primary entity (e.g., "user-123")
    predicate: v.optional(v.string()), // Relationship (e.g., "prefers", "works_at")
    object: v.optional(v.string()), // Secondary entity (e.g., "dark mode")
    confidence: v.number(), // 0-100: extraction confidence
    sourceType: v.union(
      v.literal("conversation"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("manual"),
      v.literal("a2a"),
    ),
    sourceRef: v.optional(
      v.object({
        conversationId: v.optional(v.string()),
        messageIds: v.optional(v.array(v.string())),
        memoryId: v.optional(v.string()),
      }),
    ),
    metadata: v.optional(v.any()),
    tags: v.array(v.string()),
    validFrom: v.optional(v.number()), // Temporal validity
    validUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const factId = `fact-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await ctx.db.insert("facts", {
      factId,
      memorySpaceId: args.memorySpaceId,
      participantId: args.participantId,
      fact: args.fact,
      factType: args.factType,
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      confidence: args.confidence,
      sourceType: args.sourceType,
      sourceRef: args.sourceRef,
      metadata: args.metadata,
      tags: args.tags,
      validFrom: args.validFrom || now,
      validUntil: args.validUntil,
      version: 1,
      supersededBy: undefined,
      supersedes: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Update a fact (creates new version, marks old as superseded)
 */
export const update = mutation({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
    fact: v.optional(v.string()),
    confidence: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    validUntil: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("facts")
      .withIndex("by_factId", (q) => q.eq("factId", args.factId))
      .first();

    if (!existing) {
      throw new Error("FACT_NOT_FOUND");
    }

    // Verify memorySpace owns this fact
    if (existing.memorySpaceId !== args.memorySpaceId) {
      throw new Error("PERMISSION_DENIED");
    }

    const now = Date.now();
    const newFactId = `fact-${now}-${Math.random().toString(36).substring(2, 11)}`;

    // Create new version (manually copy fields to avoid _id/_creationTime)
    const _id = await ctx.db.insert("facts", {
      factId: newFactId,
      memorySpaceId: existing.memorySpaceId,
      participantId: existing.participantId,
      fact: args.fact || existing.fact,
      factType: existing.factType,
      subject: existing.subject,
      predicate: existing.predicate,
      object: existing.object,
      confidence:
        args.confidence !== undefined ? args.confidence : existing.confidence,
      sourceType: existing.sourceType,
      sourceRef: existing.sourceRef,
      metadata: args.metadata || existing.metadata,
      tags: args.tags || existing.tags,
      validFrom: existing.validFrom,
      validUntil:
        args.validUntil !== undefined ? args.validUntil : existing.validUntil,
      version: existing.version + 1,
      supersedes: existing.factId, // Link to previous
      supersededBy: undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Mark old as superseded
    await ctx.db.patch(existing._id, {
      supersededBy: newFactId,
      validUntil: now,
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Delete a fact (soft delete - mark as invalidated)
 */
export const deleteFact = mutation({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const fact = await ctx.db
      .query("facts")
      .withIndex("by_factId", (q) => q.eq("factId", args.factId))
      .first();

    if (!fact) {
      throw new Error("FACT_NOT_FOUND");
    }

    // Verify memorySpace owns this fact
    if (fact.memorySpaceId !== args.memorySpaceId) {
      throw new Error("PERMISSION_DENIED");
    }

    await ctx.db.patch(fact._id, {
      validUntil: Date.now(),
      updatedAt: Date.now(),
    });

    return { deleted: true, factId: args.factId };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get fact by ID
 */
export const get = query({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const fact = await ctx.db
      .query("facts")
      .withIndex("by_factId", (q) => q.eq("factId", args.factId))
      .first();

    if (!fact) {
      return null;
    }

    // Verify memorySpace owns this fact
    if (fact.memorySpaceId !== args.memorySpaceId) {
      return null; // Permission denied (silent)
    }

    return fact;
  },
});

/**
 * List facts with filters
 */
export const list = query({
  args: {
    memorySpaceId: v.string(),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("custom"),
      ),
    ),
    subject: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    includeSuperseded: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .order("desc")
      .take(args.limit || 100);

    // Filter out superseded by default
    if (!args.includeSuperseded) {
      facts = facts.filter((f) => f.supersededBy === undefined);
    }

    // Apply filters
    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }

    if (args.subject) {
      facts = facts.filter((f) => f.subject === args.subject);
    }

    if (args.tags && args.tags.length > 0) {
      facts = facts.filter((f) =>
        args.tags!.some((tag) => f.tags.includes(tag)),
      );
    }

    return facts;
  },
});

/**
 * Count facts
 */
export const count = query({
  args: {
    memorySpaceId: v.string(),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("custom"),
      ),
    ),
    includeSuperseded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .collect();

    // Filter out superseded by default
    if (!args.includeSuperseded) {
      facts = facts.filter((f) => f.supersededBy === undefined);
    }

    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }

    return facts.length;
  },
});

/**
 * Search facts by content
 */
export const search = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("custom"),
      ),
    ),
    minConfidence: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Keyword search on fact content
    const results = await ctx.db
      .query("facts")
      .withSearchIndex("by_content", (q) =>
        q.search("fact", args.query).eq("memorySpaceId", args.memorySpaceId),
      )
      .take(args.limit || 20);

    // Filter superseded
    let filtered = results.filter((f) => f.supersededBy === undefined);

    // Apply filters
    if (args.factType) {
      filtered = filtered.filter((f) => f.factType === args.factType);
    }

    if (args.minConfidence !== undefined) {
      filtered = filtered.filter((f) => f.confidence >= args.minConfidence!);
    }

    if (args.tags && args.tags.length > 0) {
      filtered = filtered.filter((f) =>
        args.tags!.some((tag) => f.tags.includes(tag)),
      );
    }

    return filtered;
  },
});

/**
 * Get fact version history
 */
export const getHistory = query({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const fact = await ctx.db
      .query("facts")
      .withIndex("by_factId", (q) => q.eq("factId", args.factId))
      .first();

    if (!fact || fact.memorySpaceId !== args.memorySpaceId) {
      return [];
    }

    // Build version chain - start from given fact and go both directions
    const history: any[] = [];

    // First, go backward to find oldest version
    let oldest = fact;
    while (oldest.supersedes) {
      const previous = await ctx.db
        .query("facts")
        .withIndex("by_factId", (q) => q.eq("factId", oldest.supersedes!))
        .first();

      if (previous) {
        oldest = previous;
      } else {
        break;
      }
    }

    // Now go forward from oldest to build complete chain
    history.push(oldest);
    let current = oldest;

    while (current.supersededBy) {
      const next = await ctx.db
        .query("facts")
        .withIndex("by_factId", (q) => q.eq("factId", current.supersededBy!))
        .first();

      if (next) {
        history.push(next);
        current = next;
      } else {
        break;
      }
    }

    return history; // Already in chronological order
  },
});

/**
 * Query facts by subject (entity-centric)
 */
export const queryBySubject = query({
  args: {
    memorySpaceId: v.string(),
    subject: v.string(),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("custom"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_memorySpace_subject", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId).eq("subject", args.subject),
      )
      .collect();

    // Filter superseded
    facts = facts.filter((f) => f.supersededBy === undefined);

    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }

    return facts;
  },
});

/**
 * Query facts by relationship (graph traversal)
 */
export const queryByRelationship = query({
  args: {
    memorySpaceId: v.string(),
    subject: v.string(),
    predicate: v.string(),
  },
  handler: async (ctx, args) => {
    const facts = await ctx.db
      .query("facts")
      .withIndex("by_memorySpace_subject", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId).eq("subject", args.subject),
      )
      .collect();

    return facts.filter(
      (f) => f.predicate === args.predicate && f.supersededBy === undefined,
    );
  },
});

/**
 * Export facts
 */
export const exportFacts = query({
  args: {
    memorySpaceId: v.string(),
    format: v.union(v.literal("json"), v.literal("jsonld"), v.literal("csv")),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("custom"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .collect();

    // Filter superseded
    facts = facts.filter((f) => f.supersededBy === undefined);

    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }

    const exportedAt = Date.now();

    if (args.format === "json") {
      return {
        format: "json",
        data: JSON.stringify(facts, null, 2),
        count: facts.length,
        exportedAt,
      };
    }

    if (args.format === "jsonld") {
      // JSON-LD format for semantic web
      const jsonld = {
        "@context": "https://schema.org/",
        "@graph": facts.map((f) => ({
          "@type": "Fact",
          "@id": f.factId,
          subject: f.subject,
          predicate: f.predicate,
          object: f.object,
          factStatement: f.fact,
          confidence: f.confidence,
          factType: f.factType,
          dateCreated: new Date(f.createdAt).toISOString(),
          validFrom: f.validFrom
            ? new Date(f.validFrom).toISOString()
            : undefined,
          validThrough: f.validUntil
            ? new Date(f.validUntil).toISOString()
            : undefined,
        })),
      };

      return {
        format: "jsonld",
        data: JSON.stringify(jsonld, null, 2),
        count: facts.length,
        exportedAt,
      };
    }

    // CSV format
    const headers = [
      "factId",
      "fact",
      "factType",
      "subject",
      "predicate",
      "object",
      "confidence",
      "sourceType",
      "tags",
      "createdAt",
    ];
    const rows = facts.map((f) => [
      f.factId,
      `"${f.fact.replace(/"/g, '""')}"`, // Escape quotes
      f.factType,
      f.subject || "",
      f.predicate || "",
      f.object || "",
      f.confidence.toString(),
      f.sourceType,
      f.tags.join(";"),
      new Date(f.createdAt).toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return {
      format: "csv",
      data: csv,
      count: facts.length,
      exportedAt,
    };
  },
});

/**
 * Consolidate duplicate facts
 */
export const consolidate = mutation({
  args: {
    memorySpaceId: v.string(),
    factIds: v.array(v.string()), // Facts to merge
    keepFactId: v.string(), // Fact to keep
  },
  handler: async (ctx, args) => {
    if (!args.factIds.includes(args.keepFactId)) {
      throw new Error("KEEP_FACT_NOT_IN_LIST");
    }

    const now = Date.now();

    // Mark all others as superseded by the kept fact
    for (const factId of args.factIds) {
      if (factId === args.keepFactId) continue;

      const fact = await ctx.db
        .query("facts")
        .withIndex("by_factId", (q) => q.eq("factId", factId))
        .first();

      if (fact && fact.memorySpaceId === args.memorySpaceId) {
        await ctx.db.patch(fact._id, {
          supersededBy: args.keepFactId,
          validUntil: now,
        });
      }
    }

    // Update confidence of kept fact (average of all)
    const kept = await ctx.db
      .query("facts")
      .withIndex("by_factId", (q) => q.eq("factId", args.keepFactId))
      .first();

    if (kept && kept.memorySpaceId === args.memorySpaceId) {
      const allFacts = await Promise.all(
        args.factIds.map((id) =>
          ctx.db
            .query("facts")
            .withIndex("by_factId", (q) => q.eq("factId", id))
            .first(),
        ),
      );

      const validFacts = allFacts.filter((f) => f !== null) as any[];
      const avgConfidence =
        validFacts.reduce((sum, f) => sum + f.confidence, 0) /
        validFacts.length;

      await ctx.db.patch(kept._id, {
        confidence: Math.round(avgConfidence),
        updatedAt: now,
      });
    }

    return {
      consolidated: true,
      keptFactId: args.keepFactId,
      mergedCount: args.factIds.length - 1,
    };
  },
});

/**
 * Purge all facts (TEST/DEV ONLY)
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

    const allFacts = await ctx.db.query("facts").collect();

    for (const fact of allFacts) {
      await ctx.db.delete(fact._id);
    }

    return { deleted: allFacts.length };
  },
});
