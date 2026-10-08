/** Deployment-key administration of legacy rows. Public runtime APIs remain separate. */
import { graphMutation } from "../lib/graphSync";
import { reconcileRow, captureInsertedRow, markDeletedRow } from "../lib/referenceLifecycle";
/**
 * Cortex SDK - Immutable Store API (Layer 1b)
 *
 * ACID-compliant versioned immutable storage for shared data
 * Types: kb-article, policy, audit-log, feedback, user, etc.
 */

import { ConvexError, v } from "convex/values";
import { operatorQuery as query } from "../lib/operatorBoundary";
import { scopedImmutable, validateDomainScope } from "../lib/domainScope";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Store immutable data (create v1 or increment version if exists)
 */
export const store = graphMutation({
  args: {
    type: v.string(),
    id: v.string(),
    data: v.any(),
    userId: v.optional(v.string()),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if entry already exists - use tenant-aware lookup when tenantId provided
    const existing = await scopedImmutable(ctx, args.tenantId, args.type, args.id);

    if (existing) {
      // Update: Create new version
      const newVersion = existing.version + 1;

      // Add current version to previousVersions
      const updatedPreviousVersions = [
        ...existing.previousVersions,
        {
          version: existing.version,
          data: existing.data,
          timestamp: existing.updatedAt,
          metadata: existing.metadata,
        },
      ];

      // Update with new version
      await reconcileRow(ctx, existing._id, {
        data: args.data,
        version: newVersion,
        previousVersions: updatedPreviousVersions,
        metadata: args.metadata || existing.metadata,
        updatedAt: now,
        // Propagate tenantId if provided (allows existing records to be tenant-isolated)
        ...(args.tenantId && { tenantId: args.tenantId }),
      });

      return await ctx.db.get(existing._id);
    }
    // Create: Version 1
    const _id = await captureInsertedRow(ctx, "immutable", {
      type: args.type,
      id: args.id,
      data: args.data,
      userId: args.userId,
      tenantId: args.tenantId, // Store tenantId
      version: 1,
      previousVersions: [],
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Delete (purge) an immutable entry and all its versions
 */
export const purge = graphMutation({
  args: {
    type: v.string(),
    id: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy filter
  },
  handler: async (ctx, args) => {
    const entry = await scopedImmutable(ctx, args.tenantId, args.type, args.id);

    if (!entry) {
      throw new ConvexError("IMMUTABLE_ENTRY_NOT_FOUND");
    }

    const versionsDeleted = entry.version; // Current + previous

    await markDeletedRow(ctx, entry._id);

    return {
      deleted: true,
      type: args.type,
      id: args.id,
      versionsDeleted,
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get current version of an immutable entry
 */
export const get = query({
  args: {
    type: v.string(),
    id: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy filter
  },
  handler: async (ctx, args) => {
    const entry = await scopedImmutable(ctx, args.tenantId, args.type, args.id);

    return entry || null;
  },
});

/**
 * Get a specific version of an immutable entry
 */
export const getVersion = query({
  args: {
    type: v.string(),
    id: v.string(),
    version: v.number(),
    tenantId: v.optional(v.string()), // Multi-tenancy filter
  },
  handler: async (ctx, args) => {
    let entry;
    if (args.tenantId) {
      entry = await ctx.db
        .query("immutable")
        .withIndex("by_tenant_type_id", (q) =>
          q
            .eq("tenantId", args.tenantId!)
            .eq("type", args.type)
            .eq("id", args.id),
        )
        .first();
    } else {
      // Global lookup for non-tenant records only
      // SECURITY: Must verify the matched record has no tenantId to prevent cross-tenant reads
      const candidate = await ctx.db
        .query("immutable")
        .withIndex("by_type_id", (q) =>
          q.eq("type", args.type).eq("id", args.id),
        )
        .first();
      // Only match if the record is truly global (no tenantId)
      entry = candidate && !candidate.tenantId ? candidate : null;
    }

    if (!entry) {
      return null;
    }

    // Check if requesting current version
    if (args.version === entry.version) {
      return {
        type: entry.type,
        id: entry.id,
        version: entry.version,
        data: entry.data,
        userId: entry.userId,
        metadata: entry.metadata,
        timestamp: entry.updatedAt,
        createdAt: entry.createdAt,
      };
    }

    // Look in previousVersions
    const previousVersion = entry.previousVersions.find(
      (v) => v.version === args.version,
    );

    if (!previousVersion) {
      return null;
    }

    return {
      type: entry.type,
      id: entry.id,
      version: previousVersion.version,
      data: previousVersion.data,
      userId: entry.userId,
      metadata: previousVersion.metadata,
      timestamp: previousVersion.timestamp,
      createdAt: entry.createdAt,
    };
  },
});

/**
 * Get all versions of an immutable entry
 */
export const getHistory = query({
  args: {
    tenantId: v.optional(v.string()),
    type: v.string(),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await scopedImmutable(ctx, args.tenantId, args.type, args.id);

    if (!entry) {
      return [];
    }

    // Build complete history (previous + current)
    const history = [
      ...entry.previousVersions.map((v) => ({
        type: entry.type,
        id: entry.id,
        version: v.version,
        data: v.data,
        userId: entry.userId,
        metadata: v.metadata,
        timestamp: v.timestamp,
        createdAt: entry.createdAt,
      })),
      // Add current version
      {
        type: entry.type,
        id: entry.id,
        version: entry.version,
        data: entry.data,
        userId: entry.userId,
        metadata: entry.metadata,
        timestamp: entry.updatedAt,
        createdAt: entry.createdAt,
      },
    ];

    // Sort by version (ascending)
    return history.sort((a, b) => a.version - b.version);
  },
});

/**
 * List immutable entries with filters, sorting, and pagination
 */
export const list = query({
  args: {
    type: v.optional(v.string()),
    userId: v.optional(v.string()),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId);
    let entries = await ctx.db.query("immutable").withIndex("by_tenantId", q => q.eq("tenantId", args.tenantId)).collect();
    if (args.type) entries = entries.filter(e => e.type === args.type);
    if (args.userId) entries = entries.filter(e => e.userId === args.userId);

    // Apply date filters
    if (args.createdAfter !== undefined) {
      entries = entries.filter((e) => e.createdAt > args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      entries = entries.filter((e) => e.createdAt < args.createdBefore!);
    }
    if (args.updatedAfter !== undefined) {
      entries = entries.filter((e) => e.updatedAt > args.updatedAfter!);
    }
    if (args.updatedBefore !== undefined) {
      entries = entries.filter((e) => e.updatedAt < args.updatedBefore!);
    }

    // Sort entries
    const sortBy = args.sortBy || "createdAt";
    const sortOrder = args.sortOrder || "desc";
    const sortMultiplier = sortOrder === "desc" ? -1 : 1;

    entries.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "updatedAt") {
        comparison = a.updatedAt - b.updatedAt;
      } else {
        // Default to createdAt
        comparison = a.createdAt - b.createdAt;
      }
      return comparison * sortMultiplier;
    });

    // Calculate total before pagination
    const total = entries.length;

    // Apply offset
    const offset = args.offset || 0;
    entries = entries.slice(offset);

    // Apply limit
    const limit = args.limit || 50;
    entries = entries.slice(0, limit);

    // Return with pagination metadata
    return {
      entries,
      total,
      limit,
      offset,
      hasMore: offset + entries.length < total,
    };
  },
});

/**
 * Search immutable entries by text query
 */
export const search = query({
  args: {
    query: v.string(),
    type: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all entries (we'll add search index later for better performance)
    let allEntries = await ctx.db.query("immutable").collect();

    // Apply type filter
    if (args.type) {
      allEntries = allEntries.filter((e) => e.type === args.type);
    }

    // Apply userId filter
    if (args.userId) {
      allEntries = allEntries.filter((e) => e.userId === args.userId);
    }

    const searchQuery = args.query.toLowerCase();
    const results: Array<{
      entry: unknown;
      score: number;
      highlights: string[];
    }> = [];

    for (const entry of allEntries) {
      // Search in data (convert to string for searching)
      const dataString = JSON.stringify(entry.data).toLowerCase();

      if (dataString.includes(searchQuery)) {
        // Calculate score (simple: 1.0 if matches)
        const score = 1.0;

        // Extract highlights
        const highlights: string[] = [];

        // Try to find readable highlights from data
        if (typeof entry.data === "object" && entry.data !== null) {
          for (const [_key, value] of Object.entries(entry.data)) {
            if (
              typeof value === "string" &&
              value.toLowerCase().includes(searchQuery)
            ) {
              const index = value.toLowerCase().indexOf(searchQuery);
              const start = Math.max(0, index - 30);
              const end = Math.min(
                value.length,
                index + searchQuery.length + 30,
              );

              highlights.push(value.substring(start, end));
            }
          }
        }

        results.push({
          entry,
          score,
          highlights: highlights.slice(0, 3),
        });
      }
    }

    // Sort by score (all 1.0 for now, but ready for relevance scoring)
    results.sort((a, b) => b.score - a.score);

    // Limit results
    return results.slice(0, args.limit || 10);
  },
});

/**
 * Count immutable entries with filters
 */
export const count = query({
  args: {
    tenantId: v.optional(v.string()),
    type: v.optional(v.string()),
    userId: v.optional(v.string()),
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    for (const cutoff of [args.createdAfter, args.createdBefore, args.updatedAfter, args.updatedBefore]) {
      if (cutoff !== undefined && (!Number.isFinite(cutoff) || cutoff < 0)) throw new ConvexError("INVALID_TIMESTAMP");
    }
    if ((args.createdAfter !== undefined && args.createdBefore !== undefined && args.createdAfter >= args.createdBefore) ||
        (args.updatedAfter !== undefined && args.updatedBefore !== undefined && args.updatedAfter >= args.updatedBefore)) throw new ConvexError("INVALID_DATE_RANGE");
    validateDomainScope(args.tenantId);
    let entries = await ctx.db.query("immutable").withIndex("by_tenantId", q => q.eq("tenantId", args.tenantId)).collect();
    if (args.type) entries = entries.filter(e => e.type === args.type);
    if (args.userId) entries = entries.filter(e => e.userId === args.userId);

    // Apply date filters
    if (args.createdAfter !== undefined) {
      entries = entries.filter((e) => e.createdAt > args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      entries = entries.filter((e) => e.createdAt < args.createdBefore!);
    }
    if (args.updatedAfter !== undefined) {
      entries = entries.filter((e) => e.updatedAt > args.updatedAfter!);
    }
    if (args.updatedBefore !== undefined) {
      entries = entries.filter((e) => e.updatedAt < args.updatedBefore!);
    }

    return entries.length;
  },
});

/**
 * Get version that was current at specific timestamp
 */
export const getAtTimestamp = query({
  args: {
    type: v.string(),
    id: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("immutable")
      .withIndex("by_type_id", (q) => q.eq("type", args.type).eq("id", args.id))
      .first();

    if (!entry) {
      return null;
    }

    // If timestamp is after current version, return current
    if (args.timestamp >= entry.updatedAt) {
      return {
        type: entry.type,
        id: entry.id,
        version: entry.version,
        data: entry.data,
        userId: entry.userId,
        metadata: entry.metadata,
        timestamp: entry.updatedAt,
        createdAt: entry.createdAt,
      };
    }

    // Check if before creation
    if (args.timestamp < entry.createdAt) {
      return null; // Didn't exist yet
    }

    // Find the version that was current at that timestamp
    // Iterate backwards through previousVersions
    for (let i = entry.previousVersions.length - 1; i >= 0; i--) {
      const prevVersion = entry.previousVersions[i];

      if (args.timestamp >= prevVersion.timestamp) {
        return {
          type: entry.type,
          id: entry.id,
          version: prevVersion.version,
          data: prevVersion.data,
          userId: entry.userId,
          metadata: prevVersion.metadata,
          timestamp: prevVersion.timestamp,
          createdAt: entry.createdAt,
        };
      }
    }

    // If we get here, it was during v1 (before any updates)
    if (entry.previousVersions.length > 0) {
      const firstVersion = entry.previousVersions[0];

      return {
        type: entry.type,
        id: entry.id,
        version: firstVersion.version,
        data: firstVersion.data,
        userId: entry.userId,
        metadata: firstVersion.metadata,
        timestamp: firstVersion.timestamp,
        createdAt: entry.createdAt,
      };
    }

    return null;
  },
});

/**
 * Bulk delete immutable entries
 */
export const purgeMany = graphMutation({
  args: {
    type: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let entries = await ctx.db.query("immutable").collect();

    // Apply filters
    if (args.type) {
      entries = entries.filter((e) => e.type === args.type);
    }

    if (args.userId) {
      entries = entries.filter((e) => e.userId === args.userId);
    }

    let deleted = 0;
    let totalVersionsDeleted = 0;

    for (const entry of entries) {
      totalVersionsDeleted += entry.version; // Current + previous
      await markDeletedRow(ctx, entry._id);
      deleted++;
    }

    return {
      deleted,
      totalVersionsDeleted,
      entries: entries.map((e) => ({ type: e.type, id: e.id })),
    };
  },
});

/**
 * Delete old versions while keeping recent ones
 */
export const purgeVersions = graphMutation({
  args: {
    type: v.string(),
    id: v.string(),
    keepLatest: v.number(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("immutable")
      .withIndex("by_type_id", (q) => q.eq("type", args.type).eq("id", args.id))
      .first();

    if (!entry) {
      throw new ConvexError("IMMUTABLE_ENTRY_NOT_FOUND");
    }

    const totalVersions = entry.previousVersions.length + 1; // Previous + current

    if (totalVersions <= args.keepLatest) {
      // Nothing to purge
      return {
        versionsPurged: 0,
        versionsRemaining: totalVersions,
      };
    }

    // Calculate how many to remove
    const toRemove = totalVersions - args.keepLatest;

    // Remove oldest versions (keep latest N)
    const updatedPreviousVersions = entry.previousVersions.slice(toRemove);

    await reconcileRow(ctx, entry._id, {
      previousVersions: updatedPreviousVersions,
    });

    return {
      versionsPurged: toRemove,
      versionsRemaining: args.keepLatest,
    };
  },
});

/**
 * Purge all immutable entries (TEST/DEV ONLY)
 *
 * WARNING: This permanently deletes ALL immutable entries!
 * Only available in test/dev environments.
 */
export const purgeAll = graphMutation({
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

    const allEntries = await ctx.db.query("immutable").collect();

    for (const entry of allEntries) {
      await markDeletedRow(ctx, entry._id);
    }

    return { deleted: allEntries.length };
  },
});
