/** Scoped legacy queue closure. Durable projection/leases/graph delivery are Task11. */
import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { sourceReference } from "./runtimeMemorySchema";
import { boundedInteger, canonicalFact, canonicalJob, factPayload, workerAuthority, workerDeny, deleteMaintenanceRecord } from "./runtimeWorkerAuth";

const workerArgs = { authority: runtimeAuthorityReference };
const itemArgs = { ...workerArgs, id: v.id("graphSyncQueue") };
async function selectedItems(ctx: QueryCtx, authority: RuntimeAuthorityReference, options: { synced?: boolean; priority?: string; failed?: boolean; before?: number; limit?: number } = {}) {
  await workerAuthority(ctx, authority, "tool");
  const current = await workerAuthority(ctx, authority, "read");
  const query = ctx.db.query("graphSyncQueue").withIndex("by_runtime_worker_state", (q) => {
    const scoped = q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId).eq("authority.grantId", authority.grantId);
    if (options.synced === undefined) return scoped;
    const state = scoped.eq("synced", options.synced);
    return options.priority === undefined ? state : state.eq("priority", options.priority);
  }).filter((q) => q.and(q.eq(q.field("authority.principalId"), authority.principalId),
    ...(current.resourceAccess === "own" ? [q.eq(q.field("ownerPrincipalId"), current.principalId)] : []),
    ...(options.failed ? [q.gt(q.field("failedAttempts"), 0)] : []),
    ...(options.before === undefined ? [] : [q.lt(q.field("syncedAt"), options.before)])));
  const items = options.limit === undefined ? await query.collect() : await query.order("desc").take(boundedInteger(options.limit));
  for (const item of items) await canonicalJob(ctx, authority, item);
  return items; // canonicalJob ends with independent READ/SOURCE checks and fresh canonical reloads.
}
async function selectedItem(ctx: QueryCtx, authority: RuntimeAuthorityReference, id: typeof itemArgs.id.type) {
  await workerAuthority(ctx, authority, "tool");
  const current = await workerAuthority(ctx, authority, "read");
  const item = await ctx.db.query("graphSyncQueue").withIndex("by_runtime_worker_state", (q) =>
    q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId).eq("authority.grantId", authority.grantId))
    .filter((q) => q.and(q.eq(q.field("_id"), id), q.eq(q.field("authority.principalId"), authority.principalId),
      ...(current.resourceAccess === "own" ? [q.eq(q.field("ownerPrincipalId"), current.principalId)] : []))).unique();
  if (!item) workerDeny();
  await canonicalJob(ctx, authority, item);
  return item;
}

export const queueForSync = internalMutation({
  args: { ...workerArgs, table: v.string(), entityId: v.string(), operation: v.union(v.literal("insert"), v.literal("update"), v.literal("delete")),
    source: v.object(sourceReference), expectedVersion: v.number(), priority: v.optional(v.union(v.literal("high"), v.literal("normal"), v.literal("low"))) },
  handler: async (ctx, args) => {
    await workerAuthority(ctx, args.authority, "tool");
    // Fresh facts alone have reviewed02B canonical ownership/provenance at this subdivision's base.
    if (args.table !== "facts" || args.operation === "delete") workerDeny("UNSUPPORTED_OPERATION");
    boundedInteger(args.expectedVersion, Number.MAX_SAFE_INTEGER);
    boundedInteger(args.source.sourceRevision, Number.MAX_SAFE_INTEGER);
    const fact = await canonicalFact(ctx, args.authority, args.entityId, { version: args.expectedVersion, ...args.source });
    const current = await workerAuthority(ctx, args.authority, "read");
    const existing = await ctx.db.query("graphSyncQueue").withIndex("by_runtime_worker_entity", (q) =>
      q.eq("tenantId", args.authority.tenantId).eq("memorySpaceId", args.authority.memorySpaceId).eq("authority.grantId", args.authority.grantId)
        .eq("table", "facts").eq("entityId", fact.factId))
      .filter((q) => q.and(q.eq(q.field("authority.principalId"), current.principalId),
        ...(current.resourceAccess === "own" ? [q.eq(q.field("ownerPrincipalId"), current.principalId)] : []))).unique();
    if (existing) {
      await canonicalJob(ctx, args.authority, existing);
      if (existing.operation !== args.operation || existing.priority !== (args.priority ?? "normal")) workerDeny("INVALID_INPUT");
      return existing._id; // Never mutate a job's reference/source, or revive a completed/deleted source.
    }
    const committedFact = await canonicalFact(ctx, args.authority, fact.factId, { documentId: fact._id, version: args.expectedVersion, ...args.source });
    return await ctx.db.insert("graphSyncQueue", { table: "facts", entityId: fact.factId, operation: args.operation,
      tenantId: committedFact.tenantId!, memorySpaceId: committedFact.memorySpaceId, ownerPrincipalId: committedFact.ownerPrincipalId!, authority: args.authority,
      entityDocumentId: committedFact._id, entityVersion: committedFact.version, ...args.source, entity: factPayload(committedFact), synced: false, failedAttempts: 0,
      priority: args.priority ?? "normal", createdAt: Date.now() });
  },
});
export const markSynced = internalMutation({
  args: itemArgs,
  handler: async (ctx, args) => {
    const item = await selectedItem(ctx, args.authority, args.id);
    await canonicalJob(ctx, args.authority, item);
    await ctx.db.patch("graphSyncQueue", item._id, { synced: true, syncedAt: Date.now(), lastError: undefined });
  },
});
export const markFailed = internalMutation({
  args: { ...itemArgs, error: v.string() },
  handler: async (ctx, args) => {
    const item = await selectedItem(ctx, args.authority, args.id);
    if (item.synced || !args.error.trim() || args.error.length > 1024) workerDeny("INVALID_INPUT");
    await canonicalJob(ctx, args.authority, item);
    // Failure is never called a successful projection, including exhausted retries.
    await ctx.db.patch("graphSyncQueue", item._id, { failedAttempts: (item.failedAttempts ?? 0) + 1, lastError: "GRAPH_SYNC_FAILED" });
  },
});
export const deleteSyncItem = internalMutation({
  args: itemArgs,
  handler: async (ctx, args) => {
    const item = await selectedItem(ctx, args.authority, args.id);
    await canonicalJob(ctx, args.authority, item);
    await ctx.db.delete("graphSyncQueue", item._id);
  },
});
export const getUnsyncedItems = internalQuery({
  args: { ...workerArgs, limit: v.number() },
  handler: async (ctx, args) => await selectedItems(ctx, args.authority, { synced: false, limit: args.limit }),
});
export const getHighPriorityItems = internalQuery({
  args: { ...workerArgs, limit: v.number() },
  handler: async (ctx, args) => await selectedItems(ctx, args.authority, { synced: false, priority: "high", limit: args.limit }),
});
export const getFailedItems = internalQuery({
  args: { ...workerArgs, limit: v.number() },
  handler: async (ctx, args) => await selectedItems(ctx, args.authority, { failed: true, limit: args.limit }),
});
export const getSyncStats = internalQuery({
  args: workerArgs,
  handler: async (ctx, args) => {
    const all = await selectedItems(ctx, args.authority);
    const unsynced = all.filter((item) => !item.synced);
    const synced = all.filter((item) => item.synced);
    const timed = synced.filter((item) => item.syncedAt !== undefined);
    return { total: all.length, unsynced: unsynced.length, synced: synced.length,
      failed: all.filter((item) => (item.failedAttempts ?? 0) > 0).length,
      avgSyncTimeMs: timed.length ? Math.round(timed.reduce((sum, item) => sum + item.syncedAt! - item.createdAt, 0) / timed.length) : 0,
      syncLagMs: unsynced.length ? Date.now() - Math.min(...unsynced.map((item) => item.createdAt)) : 0,
      byTable: all.reduce<Record<string, number>>((counts, item) => { counts[item.table] = (counts[item.table] ?? 0) + 1; return counts; }, {}) };
  },
});
export const clearSyncedItems = internalMutation({
  args: { ...workerArgs, olderThanMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const age = boundedInteger(args.olderThanMs ?? 86400000, Number.MAX_SAFE_INTEGER, 0);
    const selected = await selectedItems(ctx, args.authority, { synced: true, before: Date.now() - age });
    for (const item of selected) await canonicalJob(ctx, args.authority, item);
    for (const item of selected) {
      await canonicalJob(ctx, args.authority, item);
      await ctx.db.delete("graphSyncQueue", item._id);
    }
    return { deleted: selected.length };
  },
});
/** Trusted deployment operator only; no target grant prerequisite and no source/byte deletion. */
export const purgeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("graphSyncQueue").collect();
    for (const item of items) await deleteMaintenanceRecord(ctx, "graphSyncQueue", item._id);
    return { deleted: items.length };
  },
});
