/** Memory-space registry metadata. Participants never create principals or grants. */
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { RegistryAccess, selectors, spaceAt, spacesIn, resource, integer, distinct, record, mergeValue, json, receipt, tombstone, nextVersion, conflict, insertionShape, inserted, nativeJson, deny, operation, effect } from "./runtimeRegistryAuth";
import { statisticsUnavailable } from "./runtimeRegistryStats";
const spaceType = v.union(v.literal("personal"), v.literal("team"), v.literal("project"), v.literal("custom"));
const status = v.union(v.literal("active"), v.literal("archived"));
const participant = v.object({ id: v.string(), type: v.string(), joinedAt: v.number() });
type Participant = typeof participant.type;
function participants(values: Participant[]) { distinct(values.map((value) => value.id)); for (const value of values) if (!value.type.trim() || !Number.isFinite(value.joinedAt) || value.joinedAt < 0) deny("INVALID_INPUT"); }
async function edit(ctx: MutationCtx, args: { tenantId?: string; memorySpaceId: string }, update: (row: Doc<"memorySpaces">) => Partial<Doc<"memorySpaces">>) {
  const access = await RegistryAccess.open(ctx, "write", args); const row = (await spaceAt(access, args.memorySpaceId))!;
  await access.admit(resource("memorySpaces", row), "admin"); const readable = await access.optionalRead(resource("memorySpaces", row));
  const patch = { ...update(row), updatedAt: Date.now() }; json(patch);
  if (patch.participants) participants(patch.participants);
  await access.fence(); await effect(ctx, async () => await ctx.db.patch("memorySpaces", row._id, patch)); access.expect(`memorySpaces:${row._id}`, { ...row, ...patch }); await access.fence();
  return readable ? { ...row, ...patch } : receipt("memorySpaces", args.memorySpaceId);
}
export const register = mutation({ args: { ...selectors, memorySpaceId: v.string(), name: v.optional(v.string()), type: spaceType, participants: v.optional(v.array(participant)), metadata: v.optional(v.any()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const a = access.authority;
  const candidate = { memorySpaceId: args.memorySpaceId, tenantId: a.tenantId, ownerPrincipalId: a.principalId };
  await access.admit(resource("memorySpaces", candidate), "admin"); await conflict(access, "memorySpaces", args.memorySpaceId); const readable = await access.optionalRead(resource("memorySpaces", candidate));
  if (await spaceAt(access, args.memorySpaceId, "write", false)) throw new ConvexError("MEMORYSPACE_ALREADY_EXISTS");
  participants(args.participants ?? []); json(args.metadata); const now = Date.now();
  const value = { ...candidate, name: args.name, type: args.type, participants: args.participants ?? [], metadata: args.metadata === undefined ? {} : args.metadata, status: "active" as const, createdAt: now, updatedAt: now };
  insertionShape("memorySpaces", value); await access.fence(); const id = await effect(ctx, async () => await ctx.db.insert("memorySpaces", value));
  access.expect(`conflict:memorySpaces:${args.memorySpaceId}`, true); await inserted(access, "memorySpaces", id, value); await access.fence();
  const created = readable ? await spaceAt(access, args.memorySpaceId, "read") : null; await access.fence();
  return readable ? created : receipt("memorySpaces", args.memorySpaceId);
}) });
export const update = mutation({ args: { ...selectors, memorySpaceId: v.string(), name: v.optional(v.string()), metadata: v.optional(v.any()), status: v.optional(status) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, () => ({
  ...(args.name === undefined ? {} : { name: args.name }), ...(args.metadata === undefined ? {} : { metadata: args.metadata }), ...(args.status === undefined ? {} : { status: args.status }),
})))) });
export const addParticipant = mutation({ args: { ...selectors, memorySpaceId: v.string(), participant }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => {
  if (row.participants.some((value) => value.id === args.participant.id)) deny("INVALID_INPUT"); return { participants: [...row.participants, args.participant] };
}))) });
export const removeParticipant = mutation({ args: { ...selectors, memorySpaceId: v.string(), participantId: v.string() }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => ({ participants: row.participants.filter((value) => value.id !== args.participantId) })))) });
export const archive = mutation({ args: { ...selectors, memorySpaceId: v.string(), reason: v.optional(v.string()), metadata: v.optional(v.any()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => {
  const metadata = mergeValue(row.metadata, args.metadata);
  return { status: "archived", metadata: record(metadata) ? { ...metadata, archivedAt: Date.now(), ...(args.reason === undefined ? {} : { archiveReason: args.reason }) } : metadata };
}))) });
export const reactivate = mutation({ args: { ...selectors, memorySpaceId: v.string() }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, () => ({ status: "active" })))) });
export const updateParticipants = mutation({ args: { ...selectors, memorySpaceId: v.string(), add: v.optional(v.array(participant)), remove: v.optional(v.array(v.string())) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => {
  participants(args.add ?? []); distinct(args.remove ?? []);
  if (args.add?.some((value) => args.remove?.includes(value.id))) deny("INVALID_INPUT");
  const retained = row.participants.filter((value) => !args.remove?.includes(value.id));
  if (args.add?.some((value) => retained.some((previous) => previous.id === value.id))) deny("INVALID_INPUT");
  return { participants: [...retained, ...(args.add ?? [])] };
}))) });
export const deleteSpace = mutation({ args: { ...selectors, memorySpaceId: v.string(), cascade: v.boolean(), reason: v.string(), confirmId: v.optional(v.string()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const row = (await spaceAt(access, args.memorySpaceId))!;
  await access.admit(resource("memorySpaces", row), "admin");
  if (!args.reason.trim() || args.confirmId !== undefined && args.confirmId !== args.memorySpaceId || !args.cascade) deny("INVALID_INPUT");
  const scope = await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", (q) => q.eq("tenantId", access.authority.tenantId).eq("memorySpaceId", args.memorySpaceId)).unique();
  if (!scope || scope.deletedAt !== undefined) deny(); const epoch = nextVersion(scope.epoch); const now = Date.now();
  await access.fence();
  // This mutation intentionally invalidates its own scope. All controls and canonical metadata are retained.
  await tombstone(ctx, resource("memorySpaces", row), now);
  await effect(ctx, async () => await ctx.db.patch("runtimeAuthScopes", scope._id, { epoch, deletedAt: now }));
  await effect(ctx, async () => await ctx.db.patch("memorySpaces", row._id, { tombstonedAt: now, status: "archived", updatedAt: now }));
  access.expect(`memorySpaces:${row._id}`, { ...row, tombstonedAt: now, status: "archived", updatedAt: now });
  access.retainTombstone(resource("memorySpaces", row), now);
  await access.fenceRetiredSpace({ memorySpaceId: args.memorySpaceId, epoch, deletedAt: now });
  return { memorySpaceId: args.memorySpaceId, deleted: true as const, deletedAt: now, reason: args.reason,
    cascade: { status: "pending" as const, conversationsDeleted: 0, memoriesDeleted: 0, factsDeleted: 0, totalBytes: 0 },
    pendingTasks: ["08", "12", "15"] };
}) });
export const get = query({ args: { ...selectors, memorySpaceId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const row = await spaceAt(access, args.memorySpaceId, "read", false); await access.fence(); return row;
}) });
const filters = { ...selectors, type: v.optional(spaceType), status: v.optional(status) };
function filterRows(rows: Doc<"memorySpaces">[], args: { type?: Doc<"memorySpaces">["type"]; status?: Doc<"memorySpaces">["status"]; participant?: string }) {
  return rows.filter((row) => (args.type === undefined || row.type === args.type) && (args.status === undefined || row.status === args.status)
    && (args.participant === undefined || row.participants.some((value) => value.id === args.participant)));
}
export const list = query({ args: { ...filters, participant: v.optional(v.string()), limit: v.optional(v.number()), offset: v.optional(v.number()), sortBy: v.optional(v.union(v.literal("createdAt"), v.literal("updatedAt"), v.literal("name"))), sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const limit = integer(args.limit ?? 100, 1); const offset = integer(args.offset ?? 0);
  const rows = filterRows(await spacesIn(access), args); const sort = args.sortBy ?? "createdAt";
  rows.sort((a, b) => { const left = a[sort] ?? ""; const right = b[sort] ?? ""; return (left < right ? -1 : left > right ? 1 : 0) * (args.sortOrder === "asc" ? 1 : -1); });
  await access.fence(); return { spaces: rows.slice(offset, offset + limit), total: rows.length, hasMore: offset + limit < rows.length, offset };
}) });
export const count = query({ args: filters, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const rows = filterRows(await spacesIn(access), args); await access.fence(); return rows.length;
}) });
export const findByParticipant = query({ args: { ...selectors, participantId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const rows = filterRows(await spacesIn(access), { participant: args.participantId }); await access.fence(); return rows;
}) });
export const search = query({ args: { ...filters, query: v.string(), limit: v.optional(v.number()) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const limit = integer(args.limit ?? 50, 1); const search = args.query.toLowerCase();
  const rows = filterRows(await spacesIn(access), args).filter((row) => [row.memorySpaceId, row.name ?? "", row.metadata === undefined ? "" : JSON.stringify(nativeJson(row.metadata))].some((value) => value.toLowerCase().includes(search)));
  await access.fence(); return rows.slice(0, limit);
}) });
/** Operator-only metadata retirement; source/authority cleanup is not performed here. */
export const purgeAll = internalMutation({ args: {}, handler: async (ctx) => operation(ctx, "mutation", async () => {
  const rows = await ctx.db.query("memorySpaces").collect(); const scopes = await ctx.db.query("runtimeAuthScopes").collect();
  const selected = scopes.filter((scope) => scope.memorySpaceId !== undefined && rows.some((row) => row.tenantId === scope.tenantId && row.memorySpaceId === scope.memorySpaceId));
  for (const scope of selected) if (scope.deletedAt === undefined) nextVersion(scope.epoch);
  for (const row of rows) if (row.tenantId && row.ownerPrincipalId) await tombstone(ctx, resource("memorySpaces", row));
  for (const scope of selected) if (scope.deletedAt === undefined) await effect(ctx, async () => await ctx.db.patch("runtimeAuthScopes", scope._id, { epoch: scope.epoch + 1, deletedAt: Date.now() }));
  for (const row of rows) await effect(ctx, async () => await ctx.db.patch("memorySpaces", row._id, { tombstonedAt: row.tombstonedAt ?? Date.now(), status: "archived", updatedAt: Date.now() }));
  return { deleted: rows.length, cascade: "pending" as const };
}) });

/** Functional cross-data statistics remain pending the qualified canonical source bridge. */
export const getStats = query({
  args: {
    ...selectors,
    memorySpaceId: v.string(),
    timeWindow: v.optional(v.union(v.literal("24h"), v.literal("7d"), v.literal("30d"), v.literal("90d"), v.literal("all"))),
    includeParticipants: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => operation(ctx, "query", async () => {
    const access = await RegistryAccess.open(ctx, "read", args);
    await spaceAt(access, args.memorySpaceId, "read");
    return await statisticsUnavailable(access);
  }),
});
