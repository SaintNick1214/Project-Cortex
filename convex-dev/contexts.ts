/** Scoped context graphs. Descriptive access and participant labels never provision authority. */
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { RegistryAccess, selectors, type Selectors, type RegistryCtx, contextAt, contextsIn, spaceAt, resource, integer, distinct, json, mergeValue, receipt, nextVersion, tombstone, conversationAt, conflict, insertionShape, inserted, nativeJson, snapshot, deny, operation, effect } from "./runtimeRegistryAuth";
const status = v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled"), v.literal("blocked"));
const filters = { ...selectors, userId: v.optional(v.string()), status: v.optional(status) };
type Context = Doc<"contexts">;
type Filter = Selectors & { userId?: string; status?: Context["status"]; parentId?: string; rootId?: string; depth?: number; completedBefore?: number };
function matching(rows: Context[], args: Filter) {
  return rows.filter((row) => (args.userId === undefined || row.userId === args.userId) && (args.status === undefined || row.status === args.status)
    && (args.parentId === undefined || row.parentId === args.parentId) && (args.rootId === undefined || row.rootId === args.rootId)
    && (args.depth === undefined || row.depth === args.depth) && (args.completedBefore === undefined || row.completedAt !== undefined && row.completedAt < args.completedBefore));
}
/** Preflight the whole referenced graph, with a bounded visited set and exact bidirectional topology. */
async function graph(access: RegistryAccess, current: Context) {
  const root = (await contextAt(access, current.rootId!, true))!;
  if (root.parentId !== undefined || root.rootId !== root.contextId || root.depth !== 0) deny();
  const nodes = new Map<string, Context>(); const queue: { row: Context; parent?: Context }[] = [{ row: root }];
  while (queue.length) {
    const { row, parent } = queue.shift()!;
    if (nodes.has(row.contextId) || nodes.size >= 100 || row.rootId !== root.contextId
      || row.parentId !== parent?.contextId || row.depth !== (parent ? parent.depth + 1 : 0)) deny();
    nodes.set(row.contextId, row);
    if (row.conversationRef) await conversationAt(access, row.conversationRef, row.memorySpaceId);
    for (const grant of row.grantedAccess ?? []) await spaceAt(access, grant.memorySpaceId, access.capability);
    for (const childId of row.childIds) queue.push({ row: (await contextAt(access, childId, true))!, parent: row });
  }
  if (!nodes.has(current.contextId) || snapshot(nodes.get(current.contextId)) !== snapshot(current)) deny();
  return nodes;
}
function descendants(nodes: Map<string, Context>, current: Context): Context[] {
  const result: Context[] = []; const queue = [...current.childIds];
  while (queue.length) { const row = nodes.get(queue.shift()!)!; result.push(row); queue.push(...row.childIds); }
  return result;
}
function chain(nodes: Map<string, Context>, current: Context) {
  const ancestors: Context[] = []; let parent = current.parentId ? nodes.get(current.parentId)! : null;
  while (parent) { ancestors.unshift(parent); parent = parent.parentId ? nodes.get(parent.parentId)! : null; }
  const directParent = current.parentId ? nodes.get(current.parentId)! : null;
  const children = current.childIds.map((id) => nodes.get(id)!);
  const siblings = directParent ? directParent.childIds.filter((id) => id !== current.contextId).map((id) => nodes.get(id)!) : [];
  return { current, root: nodes.get(current.rootId!)!, parent: directParent, children, siblings, ancestors,
    descendants: descendants(nodes, current), depth: current.depth, totalNodes: nodes.size };
}
async function selected(access: RegistryAccess, args: Filter) {
  if (args.depth !== undefined) integer(args.depth, 0, 100);
  if (args.completedBefore !== undefined && (!Number.isFinite(args.completedBefore) || args.completedBefore < 0)) deny("INVALID_INPUT");
  const rows = matching(await contextsIn(access), args); distinct(rows.map((row) => row.contextId));
  // A filter referencing a canonical context is an edge, not a caller-owned resource assertion.
  if (args.parentId) await graph(access, (await contextAt(access, args.parentId, true))!);
  if (args.rootId) { const root = (await contextAt(access, args.rootId, true))!; if (root.parentId !== undefined) deny(); await graph(access, root); }
  for (const row of rows) await graph(access, row);
  return rows;
}
function revision(row: Context, principalId: string, patch: Partial<Context>): Partial<Context> {
  const version = nextVersion(row.version); if (row.previousVersions.length >= 1000) deny("INVALID_INPUT");
  return { ...patch, version, lastUpdatedBy: principalId, updatedAt: Date.now(), previousVersions: [...row.previousVersions,
    { version: row.version, status: row.status, data: row.data, timestamp: row.updatedAt, updatedBy: row.lastUpdatedBy }] };
}
async function apply(ctx: MutationCtx, access: RegistryAccess, plans: { row: Context; patch: Partial<Context> }[]) {
  distinct(plans.map((plan) => plan.row.contextId));
  await access.fence();
  for (const { row, patch } of plans) { await effect(ctx, async () => await ctx.db.patch("contexts", row._id, patch)); access.expect(`contexts:${row._id}`, { ...row, ...patch }); }
  await access.fence();
}
async function edit(ctx: MutationCtx, args: Selectors & { contextId: string }, update: (row: Context) => Partial<Context>, targetSpace?: string) {
  const access = await RegistryAccess.open(ctx, "write", args); const row = (await contextAt(access, args.contextId))!;
  const readable = await access.optionalRead(resource("contexts", row)); await graph(access, row);
  if (targetSpace) await spaceAt(access, targetSpace, "write");
  const patch = revision(row, access.authority.principalId, update(row));
  await apply(ctx, access, [{ row, patch }]); return readable ? { ...row, ...patch } : receipt("contexts", row.contextId);
}
export const create = mutation({ args: { ...selectors, memorySpaceId: v.string(), purpose: v.string(), description: v.optional(v.string()), userId: v.optional(v.string()), parentId: v.optional(v.string()), conversationRef: v.optional(v.object({ conversationId: v.string(), messageIds: v.optional(v.array(v.string())) })), data: v.optional(v.any()), status: v.optional(status) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const a = access.authority; await spaceAt(access, args.memorySpaceId, "write");
  if (args.userId !== undefined && args.userId !== a.userId) deny();
  const contextId = `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`; const candidate = { contextId, tenantId: a.tenantId, memorySpaceId: args.memorySpaceId, ownerPrincipalId: a.principalId };
  await access.admit(resource("contexts", candidate)); await conflict(access, "contexts", contextId); const readable = await access.optionalRead(resource("contexts", candidate));
  if (await contextAt(access, contextId, false, false)) deny();
  const parent = args.parentId ? (await contextAt(access, args.parentId, true))! : null;
  if (parent && (await graph(access, parent)).size >= 100) deny("INVALID_INPUT");
  if (args.conversationRef) await conversationAt(access, args.conversationRef, args.memorySpaceId);
  const now = Date.now(); const depth = parent ? integer(parent.depth + 1, 0, 100) : 0;
  const value = { ...candidate, purpose: args.purpose, description: args.description, userId: a.userId,
    parentId: parent?.contextId, rootId: parent?.rootId ?? contextId, depth, childIds: [], status: args.status ?? "active",
    conversationRef: args.conversationRef, participants: [args.memorySpaceId], grantedAccess: [], data: args.data === undefined ? {} : args.data, metadata: {}, lastUpdatedBy: a.principalId, version: 1, previousVersions: [], createdAt: now, updatedAt: now };
  const parentPatch = parent ? revision(parent, a.principalId, { childIds: [...parent.childIds, contextId] }) : null;
  insertionShape("contexts", value); await access.fence(); const id = await effect(ctx, async () => await ctx.db.insert("contexts", value)); access.expect(`conflict:contexts:${contextId}`, true);
  await inserted(access, "contexts", id, value);
  if (parent && parentPatch) { await effect(ctx, async () => await ctx.db.patch("contexts", parent._id, parentPatch)); access.expect(`contexts:${parent._id}`, { ...parent, ...parentPatch }); }
  const created = readable ? await contextAt(access, contextId) : null; await access.fence(); return readable ? created : receipt("contexts", contextId);
}) });
export const update = mutation({ args: { ...selectors, contextId: v.string(), status: v.optional(status), description: v.optional(v.string()), data: v.optional(v.any()), completedAt: v.optional(v.number()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => {
  if (args.completedAt !== undefined && (!Number.isFinite(args.completedAt) || args.completedAt < row.createdAt || args.completedAt > Date.now())) deny("INVALID_INPUT");
  return { ...(args.status === undefined ? {} : { status: args.status }), ...(args.description === undefined ? {} : { description: args.description }),
    ...(args.data === undefined ? {} : { data: mergeValue(row.data, args.data) }), ...(args.completedAt === undefined && args.status !== "completed" ? {} : { completedAt: args.completedAt ?? Date.now() }) };
}))) });
export const addParticipant = mutation({ args: { ...selectors, contextId: v.string(), participantId: v.string() }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => {
  if (!args.participantId.trim()) deny("INVALID_INPUT"); return { participants: row.participants.includes(args.participantId) ? row.participants : [...row.participants, args.participantId] };
}))) });
export const removeParticipant = mutation({ args: { ...selectors, contextId: v.string(), participantId: v.string() }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => ({ participants: row.participants.filter((value) => value !== args.participantId) })))) });
export const grantAccess = mutation({ args: { ...selectors, contextId: v.string(), targetMemorySpaceId: v.string(), scope: v.string() }, handler: async (ctx, args) => operation(ctx, "mutation", async () => (await edit(ctx, args, (row) => {
  if (!args.scope.trim()) deny("INVALID_INPUT"); return { grantedAccess: [...(row.grantedAccess ?? []).filter((grant) => grant.memorySpaceId !== args.targetMemorySpaceId), { memorySpaceId: args.targetMemorySpaceId, scope: args.scope, grantedAt: Date.now() }] };
}, args.targetMemorySpaceId))) });
async function deletion(ctx: MutationCtx, access: RegistryAccess, roots: Context[], cascade: boolean, orphan: boolean, discloseDeleted = false) {
  if (cascade && orphan) deny("INVALID_INPUT");
  const nodes = new Map<string, Context>(); const deleting = new Set<string>(); const patches = new Map<string, Partial<Context>>();
  for (const root of roots) {
    const tree = await graph(access, root); for (const [id, row] of tree) nodes.set(id, row);
    if (root.childIds.length && !cascade && !orphan) deny("INVALID_INPUT");
    deleting.add(root.contextId); if (cascade) for (const row of descendants(tree, root)) deleting.add(row.contextId);
  }
  const orphanedChildren: string[] = [];
  if (orphan) for (const root of roots) {
    if (root.parentId && deleting.has(root.parentId)) deny("INVALID_INPUT");
    for (const childId of root.childIds) {
      const child = nodes.get(childId)!; orphanedChildren.push(childId);
      const newRootId = root.parentId ? root.rootId! : child.contextId; const newDepth = root.parentId ? root.depth : 0;
      patches.set(childId, { parentId: root.parentId, rootId: newRootId, depth: newDepth });
      for (const row of descendants(nodes, child)) patches.set(row.contextId, { rootId: newRootId, depth: row.depth - child.depth + newDepth });
    }
  }
  for (const row of nodes.values()) {
    if (deleting.has(row.contextId)) continue;
    const kept = row.childIds.filter((id) => !deleting.has(id));
    const adopted = orphan ? roots.filter((root) => root.parentId === row.contextId).flatMap((root) => root.childIds) : [];
    if (kept.length !== row.childIds.length || adopted.length) patches.set(row.contextId, { ...patches.get(row.contextId), childIds: [...kept, ...adopted] });
  }
  const plans = [...patches].filter(([id]) => !deleting.has(id)).map(([id, patch]) => ({ row: nodes.get(id)!, patch: revision(nodes.get(id)!, access.authority.principalId, patch) }));
  for (const plan of plans) if (plan.patch.childIds) distinct(plan.patch.childIds);
  const retirements = [...deleting].map((id) => ({ row: nodes.get(id)!, patch: revision(nodes.get(id)!, access.authority.principalId, { tombstonedAt: Date.now() }) }));
  const disclosed = discloseDeleted ? [...deleting] : orphanedChildren;
  const readable = await access.readAll(disclosed.map((id) => resource("contexts", nodes.get(id)!)));
  await access.fence();
  for (const { row, patch } of plans) { await effect(ctx, async () => await ctx.db.patch("contexts", row._id, patch)); access.expect(`contexts:${row._id}`, { ...row, ...patch }); }
  for (const { row, patch } of retirements) {
    await tombstone(ctx, resource("contexts", row), patch.tombstonedAt!); await effect(ctx, async () => await ctx.db.patch("contexts", row._id, patch));
    access.expect(`contexts:${row._id}`, { ...row, ...patch }); access.retire(resource("contexts", row), patch.tombstonedAt!);
  }
  // Retired row snapshots, exact resource tombstones, all scopes/grants and surviving graph witnesses remain checked.
  await access.fence(); return { deleting, orphanedChildren, readable };
}
export const deleteContext = mutation({ args: { ...selectors, contextId: v.string(), cascadeChildren: v.optional(v.boolean()), orphanChildren: v.optional(v.boolean()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const row = (await contextAt(access, args.contextId))!;
  const result = await deletion(ctx, access, [row], args.cascadeChildren ?? false, args.orphanChildren ?? false);
  return { deleted: true, contextId: args.contextId, descendantsDeleted: result.deleting.size - 1, ...(result.readable && result.orphanedChildren.length ? { orphanedChildren: result.orphanedChildren } : {}) };
}) });
export const updateMany = mutation({ args: { ...filters, parentId: v.optional(v.string()), rootId: v.optional(v.string()), updates: v.object({ status: v.optional(status), data: v.optional(v.any()) }) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const rows = await selected(access, args);
  const data = args.updates.data; json(data);
  const plans = rows.map((row) => ({ row, patch: revision(row, access.authority.principalId, {
    ...(args.updates.status === undefined ? {} : { status: args.updates.status }), ...(data === undefined ? {} : { data: mergeValue(row.data, data) }),
  }) }));
  const readable = await access.readAll(rows.map((row) => resource("contexts", row)));
  await apply(ctx, access, plans); return { updated: rows.length, ...(readable ? { contextIds: rows.map((row) => row.contextId) } : {}) };
}) });
export const deleteMany = mutation({ args: { ...filters, completedBefore: v.optional(v.number()), cascadeChildren: v.optional(v.boolean()) }, handler: async (ctx, args) => operation(ctx, "mutation", async () => {
  const access = await RegistryAccess.open(ctx, "write", args); const rows = await selected(access, args);
  const result = await deletion(ctx, access, rows, args.cascadeChildren ?? false, false, true); return { deleted: result.deleting.size, ...(result.readable ? { contextIds: [...result.deleting] } : {}) };
}) });
export const get = query({ args: { ...selectors, contextId: v.string(), includeChain: v.optional(v.boolean()), includeConversation: v.optional(v.boolean()) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const row = await contextAt(access, args.contextId, false, false);
  if (!row) { await access.fence(); return null; } const nodes = await graph(access, row);
  const conversation = args.includeConversation && row.conversationRef ? await conversationAt(access, row.conversationRef, row.memorySpaceId) : undefined;
  await access.fence(); return args.includeChain ? { ...chain(nodes, row), ...(conversation ? { conversation, triggerMessages: conversation.messageAnchors } : {}) }
    : { ...row, ...(conversation ? { conversation, triggerMessages: conversation.messageAnchors } : {}) };
}) });
export const list = query({ args: { ...filters, parentId: v.optional(v.string()), rootId: v.optional(v.string()), depth: v.optional(v.number()), limit: v.optional(v.number()) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const limit = integer(args.limit ?? 100, 1); const rows = await selected(access, args); await access.fence(); return rows.slice(0, limit);
}) });
export const search = query({ args: { ...filters, limit: v.optional(v.number()) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const limit = integer(args.limit ?? 100, 1); const rows = await selected(access, args); await access.fence(); return rows.slice(0, limit);
}) });
export const count = query({ args: filters, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const rows = await selected(access, args); await access.fence(); return rows.length;
}) });
export const getChain = query({ args: { ...selectors, contextId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const row = (await contextAt(access, args.contextId))!; const nodes = await graph(access, row); await access.fence(); return chain(nodes, row);
}) });
export const getRoot = query({ args: { ...selectors, contextId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const row = (await contextAt(access, args.contextId))!; const nodes = await graph(access, row); await access.fence(); return nodes.get(row.rootId!)!;
}) });
export const getChildren = query({ args: { ...selectors, contextId: v.string(), status: v.optional(status), recursive: v.optional(v.boolean()) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const row = (await contextAt(access, args.contextId))!; const nodes = await graph(access, row);
  const children = args.recursive ? descendants(nodes, row) : row.childIds.map((id) => nodes.get(id)!); await access.fence(); return children.filter((child) => args.status === undefined || child.status === args.status);
}) });
export const getByConversation = query({ args: { ...selectors, conversationId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); if (!access.authority.memorySpaceId) deny();
  await conversationAt(access, { conversationId: args.conversationId }, access.authority.memorySpaceId);
  const rows = (await selected(access, args)).filter((row) => row.conversationRef?.conversationId === args.conversationId); await access.fence(); return rows;
}) });
export const findOrphaned = query({ args: selectors, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); await selected(access, args); await access.fence();
  // Missing/malformed links deny rather than deliver a partially authorized orphan graph.
  return [];
}) });
function history(row: Context) { return [...row.previousVersions, { version: row.version, status: row.status, data: row.data, timestamp: row.updatedAt, updatedBy: row.lastUpdatedBy }]; }
async function historical(ctx: RegistryCtx, args: Selectors & { contextId: string }) {
  const access = await RegistryAccess.open(ctx, "read", args); const row = (await contextAt(access, args.contextId))!; await graph(access, row); await access.fence(); return history(row);
}
export const getVersion = query({ args: { ...selectors, contextId: v.string(), version: v.number() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  integer(args.version, 1, Number.MAX_SAFE_INTEGER); const versions = await historical(ctx, args); return versions.find((value) => value.version === args.version) ?? null;
}) });
export const getHistory = query({ args: { ...selectors, contextId: v.string() }, handler: async (ctx, args) => operation(ctx, "query", async () => (await historical(ctx, args))) });
export const getAtTimestamp = query({ args: { ...selectors, contextId: v.string(), timestamp: v.number() }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  if (!Number.isFinite(args.timestamp) || args.timestamp < 0) deny("INVALID_INPUT");
  const versions = await historical(ctx, args); return versions.reverse().find((value) => value.timestamp <= args.timestamp) ?? null;
}) });
export const exportContexts = query({ args: { ...filters, format: v.union(v.literal("json"), v.literal("csv")), includeChain: v.optional(v.boolean()), includeVersionHistory: v.optional(v.boolean()) }, handler: async (ctx, args) => operation(ctx, "query", async () => {
  const access = await RegistryAccess.open(ctx, "read", args); const rows = await selected(access, args); const exported: unknown[] = [];
  for (const row of rows) exported.push({ contextId: row.contextId, memorySpaceId: row.memorySpaceId, purpose: row.purpose, status: row.status,
    depth: row.depth, parentId: row.parentId, rootId: row.rootId, userId: row.userId, data: row.data, createdAt: row.createdAt, updatedAt: row.updatedAt,
    ...(args.includeVersionHistory ? { version: row.version, previousVersions: row.previousVersions } : {}), ...(args.includeChain ? { chain: chain(await graph(access, row), row) } : {}) });
  const csv = (value: string | number | undefined) => JSON.stringify(String(value ?? ""));
  const data = args.format === "json" ? JSON.stringify(nativeJson(exported), null, 2) : ["contextId,memorySpaceId,purpose,status,depth,parentId,userId,createdAt,updatedAt",
    ...rows.map((row) => [row.contextId, row.memorySpaceId, row.purpose, row.status, row.depth, row.parentId, row.userId, row.createdAt, row.updatedAt].map(csv).join(","))].join("\n");
  await access.fence(); return { format: args.format, data, count: rows.length, exportedAt: Date.now() };
}) });
/** Trusted operator retirement preserves canonical metadata and tombstone controls. */
export const purgeAll = internalMutation({ args: {}, handler: async (ctx) => operation(ctx, "mutation", async () => {
  const rows = await ctx.db.query("contexts").collect();
  for (const row of rows) if (row.tenantId && row.ownerPrincipalId) await tombstone(ctx, resource("contexts", row));
  for (const row of rows) await effect(ctx, async () => await ctx.db.patch("contexts", row._id, { tombstonedAt: row.tombstonedAt ?? Date.now(), updatedAt: Date.now() })); return { deleted: rows.length };
}) });
