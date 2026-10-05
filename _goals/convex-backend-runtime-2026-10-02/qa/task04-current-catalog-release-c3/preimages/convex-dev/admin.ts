/** Internal deployment-operator maintenance. Tenant admin claims never authorize this module. */
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { assertMaintenanceTable, assertDeletionSupported, boundedInteger, deleteMaintenanceRecord, maintenanceTable } from "./runtimeWorkerAuth";

export const listTable = internalQuery({
  args: { table: maintenanceTable, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertMaintenanceTable(args.table);
    return await ctx.db.query(args.table).take(boundedInteger(args.limit ?? 1000));
  },
});
export const deleteRecord = internalMutation({
  args: { table: maintenanceTable, id: v.string() },
  handler: async (ctx, args) => ({ deleted: await deleteMaintenanceRecord(ctx, args.table, args.id) }),
});
export const clearTable = internalMutation({
  args: { table: maintenanceTable, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertDeletionSupported(args.table);
    const limit = boundedInteger(args.limit ?? 1000);
    const records = await ctx.db.query(args.table).take(limit);
    for (const record of records) await deleteMaintenanceRecord(ctx, args.table, record._id);
    return { deleted: records.length, hasMore: records.length === limit };
  },
});
export const countTable = internalQuery({
  args: { table: maintenanceTable },
  handler: async (ctx, args) => {
    assertMaintenanceTable(args.table);
    const records = await ctx.db.query(args.table).take(10001);
    return { count: Math.min(records.length, 10000), truncated: records.length > 10000 };
  },
});
export const getAllCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tables = ["agents", "artifacts", "contexts", "conversations", "factHistory", "facts", "governanceEnforcement",
      "governancePolicies", "graphSyncQueue", "immutable", "memories", "memorySpaces", "mutable", "sessions"] as const;
    const counts: Record<string, { count: number; truncated: boolean }> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).take(10001);
      counts[table] = { count: Math.min(rows.length, 10000), truncated: rows.length > 10000 };
    }
    return counts;
  },
});
