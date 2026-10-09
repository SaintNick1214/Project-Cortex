import { markDeletedRow } from "../lib/referenceLifecycle";
/**
 * Admin Operations
 *
 * Low-level administrative functions for database management.
 * These bypass application scope checks for cleanup/maintenance operations.
 *
 * Internal registration prevents ordinary clients from invoking these functions.
 * Deployment administrators can intentionally invoke them with native Convex tools.
 */

import { operatorMutation as internalMutation, operatorQuery as internalQuery } from "../lib/operatorBoundary";
import { boundedInteger, workerDeny } from "../runtimeWorkerAuth";
import { v } from "convex/values";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generic List All Functions (for db clear)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * List all records from any table
 */
export const listTable = internalQuery({
  args: {
    table: v.union(
      v.literal("agents"),
      v.literal("artifacts"),
      v.literal("contexts"),
      v.literal("conversations"),
      v.literal("factHistory"),
      v.literal("facts"),
      v.literal("governanceEnforcement"),
      v.literal("governancePolicies"),
      v.literal("graphSyncQueue"),
      v.literal("immutable"),
      v.literal("memories"),
      v.literal("memorySpaces"),
      v.literal("mutable"),
      v.literal("sessions"),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = boundedInteger(args.limit ?? 1000);

    // Query the specified table dynamically
    // The table name is validated by the union type in args
    // Note: We can't use .order() on dynamic queries without an indexed context.
    // Using .take() without ordering returns records in insertion order.
    const records = await ctx.db.query(args.table).take(limit);

    return records;
  },
});

/**
 * Delete a record by its Convex _id
 */
export const deleteRecord = internalMutation({
  args: {
    table: v.union(
      v.literal("agents"),
      v.literal("artifacts"),
      v.literal("contexts"),
      v.literal("conversations"),
      v.literal("factHistory"),
      v.literal("facts"),
      v.literal("governanceEnforcement"),
      v.literal("governancePolicies"),
      v.literal("graphSyncQueue"),
      v.literal("immutable"),
      v.literal("memories"),
      v.literal("memorySpaces"),
      v.literal("mutable"),
      v.literal("sessions"),
    ),
    // Accept any valid Convex ID - table routing is handled by the ID itself
    id: v.union(
      v.id("agents"),
      v.id("artifacts"),
      v.id("contexts"),
      v.id("conversations"),
      v.id("factHistory"),
      v.id("facts"),
      v.id("governanceEnforcement"),
      v.id("governancePolicies"),
      v.id("graphSyncQueue"),
      v.id("immutable"),
      v.id("memories"),
      v.id("memorySpaces"),
      v.id("mutable"),
      v.id("sessions"),
    ),
  },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId(args.table, args.id);
    if (!id) workerDeny("INVALID_INPUT");
    await markDeletedRow(ctx, id, {raw: true, table: args.table});
    return { deleted: true };
  },
});

/**
 * Bulk delete all records from a table (up to limit)
 * Returns count of deleted records
 */
export const clearTable = internalMutation({
  args: {
    table: v.union(
      v.literal("agents"),
      v.literal("artifacts"),
      v.literal("contexts"),
      v.literal("conversations"),
      v.literal("factHistory"),
      v.literal("facts"),
      v.literal("governanceEnforcement"),
      v.literal("governancePolicies"),
      v.literal("graphSyncQueue"),
      v.literal("immutable"),
      v.literal("memories"),
      v.literal("memorySpaces"),
      v.literal("mutable"),
      v.literal("sessions"),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = boundedInteger(args.limit ?? 1000);

    // Query the specified table dynamically
    // The table name is validated by the union type in args
    // Note: We can't use .order() on dynamic queries without an indexed context.
    // Using .take() without ordering returns records in insertion order.
    const records = await ctx.db.query(args.table).take(limit);

    let deleted = 0;
    for (const record of records) {
      await markDeletedRow(ctx, record._id, {raw: true, table: args.table});
      deleted++;
    }

    return {
      deleted,
      hasMore: records.length === limit,
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Table Statistics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Count records in a table
 */
export const countTable = internalQuery({
  args: {
    table: v.union(
      v.literal("agents"),
      v.literal("artifacts"),
      v.literal("contexts"),
      v.literal("conversations"),
      v.literal("factHistory"),
      v.literal("facts"),
      v.literal("governanceEnforcement"),
      v.literal("governancePolicies"),
      v.literal("graphSyncQueue"),
      v.literal("immutable"),
      v.literal("memories"),
      v.literal("memorySpaces"),
      v.literal("mutable"),
      v.literal("sessions"),
    ),
  },
  handler: async (ctx, args) => {
    // Count by fetching all (limited to reasonable amount for performance)
    // Query the specified table dynamically
    const records = await ctx.db.query(args.table).take(10001);

    return { count: Math.min(records.length, 10000), truncated: records.length > 10000 };
  },
});

/**
 * Get counts for all tables at once
 */
export const getAllCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "agents",
      "artifacts",
      "contexts",
      "conversations",
      "factHistory",
      "facts",
      "governanceEnforcement",
      "governancePolicies",
      "graphSyncQueue",
      "immutable",
      "memories",
      "memorySpaces",
      "mutable",
      "sessions",
    ] as const;

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const records = await ctx.db.query(table).take(10001);
      counts[table] = records.length;
    }

    return counts;
  },
});
