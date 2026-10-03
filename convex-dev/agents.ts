/** Optional agent registry. Labels and config never provision verified authority. */
import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { RegistryAccess, selectors, agentAt, agentsIn, canonical, resource, integer, distinct, json, receipt, tombstone, conflict, insertionShape, inserted, snapshot, deny, operation, effect } from "./runtimeRegistryAuth";
import { statisticsUnavailable } from "./runtimeRegistryStats";
const status = v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"));
async function all(access: RegistryAccess) {
  const rows = await agentsIn(access); distinct(rows.map((row) => row.agentId));
  for (const row of rows) { canonical("agents", row); const current = await agentAt(access, row.agentId); if (snapshot(current) !== snapshot(row)) deny(); await access.admit(resource("agents", row), "admin"); }
  return rows;
}
export const get = query({ args: { ...selectors, agentId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const row = await agentAt(access, args.agentId, false);
  if (row) await access.admit(resource("agents", row), "admin"); await access.fence(); return row;
}) });
export const exists = query({ args: { ...selectors, agentId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const row = await agentAt(access, args.agentId, false);
  if (row) await access.admit(resource("agents", row), "admin"); await access.fence(); return row !== null;
}) });
export const list = query({ args: { ...selectors, status: v.optional(status), limit: v.optional(v.number()), offset: v.optional(v.number()) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const limit = integer(args.limit ?? 100, 1); const offset = integer(args.offset ?? 0);
  const rows = (await all(access)).filter((row) => args.status === undefined || row.status === args.status).sort((a, b) => b.registeredAt - a.registeredAt);
  await access.fence(); return rows.slice(offset, offset + limit);
}) });
export const count = query({ args: { ...selectors, status: v.optional(status) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const rows = (await all(access)).filter((row) => args.status === undefined || row.status === args.status);
  await access.fence(); return rows.length;
}) });
export const register = mutation({ args: { ...selectors, agentId: v.string(), name: v.string(), description: v.optional(v.string()), metadata: v.optional(v.any()), config: v.optional(v.any()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const a = access.authority;
  const candidate = { agentId: args.agentId, tenantId: a.tenantId, memorySpaceId: a.memorySpaceId, ownerPrincipalId: a.principalId };
  await access.admit(resource("agents", candidate), "admin"); await conflict(access, "agents", args.agentId); const readable = await access.optionalRead(resource("agents", candidate));
  if (await agentAt(access, args.agentId, false)) throw new ConvexError("AGENT_ALREADY_REGISTERED");
  json(args.metadata); json(args.config); const now = Date.now();
  const value = { ...candidate, name: args.name, description: args.description, metadata: args.metadata === undefined ? {} : args.metadata, config: args.config === undefined ? {} : args.config, status: "active" as const, registeredAt: now, updatedAt: now };
  insertionShape("agents", value); await access.fence(); const id = await effect(ctx, async () => await ctx.db.insert("agents", value));
  access.expect(`conflict:agents:${args.agentId}`, true); await inserted(access, "agents", id, value); await access.fence();
  const created = readable ? await agentAt(access, args.agentId) : null; await access.fence();
  return readable ? created : receipt("agents", args.agentId);
}) });
function changes(args: { name?: string; description?: string; metadata?: unknown; config?: unknown; status?: Doc<"agents">["status"] }): Partial<Doc<"agents">> {
  json(args.metadata); json(args.config);
  return { updatedAt: Date.now(), ...(args.name === undefined ? {} : { name: args.name }), ...(args.description === undefined ? {} : { description: args.description }),
    ...(args.metadata === undefined ? {} : { metadata: args.metadata }), ...(args.config === undefined ? {} : { config: args.config }), ...(args.status === undefined ? {} : { status: args.status }) };
}
export const update = mutation({ args: { ...selectors, agentId: v.string(), name: v.optional(v.string()), description: v.optional(v.string()), metadata: v.optional(v.any()), config: v.optional(v.any()), status: v.optional(status) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const row = (await agentAt(access, args.agentId))!;
  await access.admit(resource("agents", row), "admin"); const readable = await access.optionalRead(resource("agents", row)); const patch = changes(args);
  await access.fence(); await effect(ctx, async () => await ctx.db.patch("agents", row._id, patch)); access.expect(`agents:${row._id}`, { ...row, ...patch }); await access.fence();
  return readable ? { ...row, ...patch } : receipt("agents", args.agentId);
}) });
export const updateMany = mutation({ args: { ...selectors, agentIds: v.array(v.string()), name: v.optional(v.string()), description: v.optional(v.string()), metadata: v.optional(v.any()), config: v.optional(v.any()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); distinct(args.agentIds); const rows: Doc<"agents">[] = []; const patch = changes(args);
  for (const id of args.agentIds) { const row = (await agentAt(access, id))!; await access.admit(resource("agents", row), "admin"); rows.push(row); }
  await access.fence();
  for (const row of rows) { await effect(ctx, async () => await ctx.db.patch("agents", row._id, patch)); access.expect(`agents:${row._id}`, { ...row, ...patch }); }
  await access.fence(); return { updated: rows.length, agentIds: rows.map((row) => row.agentId) };
}) });
export const unregister = mutation({ args: { ...selectors, agentId: v.string() }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const row = (await agentAt(access, args.agentId))!;
  await access.admit(resource("agents", row), "admin"); await access.fence();
  const now = Date.now(); const patch = { tombstonedAt: now, updatedAt: now };
  await tombstone(ctx, resource("agents", row), now); await effect(ctx, async () => await ctx.db.patch("agents", row._id, patch));
  access.expect(`agents:${row._id}`, { ...row, ...patch }); access.retire(resource("agents", row), now);
  await access.fence(); return { deleted: true, agentId: args.agentId };
}) });
export const unregisterMany = mutation({ args: { ...selectors, status: v.optional(status), agentIds: v.optional(v.array(v.string())) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args);
  if (args.agentIds) distinct(args.agentIds); if (!args.agentIds && !args.status) deny("INVALID_INPUT");
  const rows: Doc<"agents">[] = args.agentIds ? [] : (await all(access)).filter((row) => row.status === args.status);
  if (args.agentIds) for (const id of args.agentIds) rows.push((await agentAt(access, id))!);
  for (const row of rows) await access.admit(resource("agents", row), "admin");
  const readable = args.agentIds !== undefined || await access.readAll(rows.map((row) => resource("agents", row))); await access.fence();
  for (const row of rows) {
    const now = Date.now(); const patch = { tombstonedAt: now, updatedAt: now };
    await tombstone(ctx, resource("agents", row), now); await effect(ctx, async () => await ctx.db.patch("agents", row._id, patch));
    access.expect(`agents:${row._id}`, { ...row, ...patch }); access.retire(resource("agents", row), now);
  }
  await access.fence(); return { deleted: rows.length, ...(readable ? { agentIds: rows.map((row) => row.agentId) } : {}) };
}) });
/** Trusted operator cleanup preserves canonical fences and every auth/control table. */
export const purgeAll = internalMutation({ args: {}, handler: async (ctx) => operation(ctx, "mutation", async () => {
  const rows = await ctx.db.query("agents").collect();
  for (const row of rows) if (row.tenantId && row.ownerPrincipalId) await tombstone(ctx, resource("agents", row));
  for (const row of rows) await effect(ctx, async () => await ctx.db.patch("agents", row._id, { tombstonedAt: row.tombstonedAt ?? Date.now(), updatedAt: Date.now() }));
  return { deleted: rows.length };
}) });

/** Functional cross-data statistics remain pending the qualified canonical source bridge. */
export const computeStats = query({
  args: { ...selectors, agentId: v.string() },
  handler: async (ctx, args) => operation(ctx, "query", async () => {
    const access = await RegistryAccess.open(ctx, "read", args);
    const agent = (await agentAt(access, args.agentId))!;
    await access.admit(resource("agents", agent), "admin");
    return await statisticsUnavailable(access);
  }),
});
