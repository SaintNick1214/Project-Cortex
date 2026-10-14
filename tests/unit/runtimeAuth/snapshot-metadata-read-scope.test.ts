/** Exact raw metadata in one native snapshot; actual validators remain the oracle. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { makeFunctionReference } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { createAuthorityReadScope, createV8AuthorityReadScope, createMemorySourceReadScope, withNativeSnapshotReads,
  readExecutableDefinitionRows, readTenantPolicyRows, freshPolicyMetadataReads,
  EXECUTABLE_METADATA_READ_SCOPE_MAX_ENTRIES, EXECUTABLE_METADATA_READ_SCOPE_MAX_BYTES } from "../../../convex-dev/runtimeAuth";
import { transcriptFixture, installIngestionMockRoot, definitions, ledger, clock } from "../runtimeTranscript/fixture";
beforeEach(installIngestionMockRoot); afterEach(() => { jest.restoreAllMocks(); });
type Fixture = Awaited<ReturnType<typeof transcriptFixture>>;
const read = async (ctx: Fixture["ctx"], f: Fixture) => ({
  definitions: await readExecutableDefinitionRows(ctx, "tenant-a", "space-a", f.published.agentId, f.published.version),
  policies: await readTenantPolicyRows(ctx, "tenant-a"),
});
const current = async (ctx: Fixture["ctx"], f: Fixture) => ({
  definition: await definitions.readCurrentExecutableDefinition(ctx, f.reference,
    { agentId: f.published.agentId, version: f.published.version }, { capability: "run" }),
  profile: await ledger.readCurrentEmbeddingProfile(ctx, f.reference, "embedding.query"),
});
async function error(work: () => Promise<unknown>) { try { await work(); return null; } catch (e) {
  return e && typeof e === "object" && "data" in e ? e.data : e;
} }

it("keeps default and legacy metadata opts uncached; exact explicit queries retain detached raw rows", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), query = f.db.query.bind(f.db);
  const seen: { table: string; index?: string; fields: [string, unknown][]; cap?: number }[] = [];
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const b = query(table), record = { table, fields: [] as [string, unknown][], index: undefined as string | undefined, cap: undefined as number | undefined }; seen.push(record);
    const withIndex = b.withIndex, take = b.take;
    b.withIndex = (name, select) => withIndex(name, raw => {
      record.index = name; const original = raw as { eq(key: string, value: unknown): unknown };
      const selected = { eq: (key: string, value: unknown) => { record.fields.push([key, value]); original.eq(key, value); return selected; } }; return select(selected);
    }); b.take = async cap => { record.cap = cap; return await take(cap); }; return b;
  });
  for (const ctx of [f.ctx, createAuthorityReadScope(f.ctx, { policyMetadata: true })]) { await read(ctx, f); await read(ctx, f); }
  expect(seen).toHaveLength(8);
  const parent = createMemorySourceReadScope(f.ctx), view = withNativeSnapshotReads(f.ctx, parent), first = await read(view, f);
  expect(await read(view, f)).toEqual(first); expect(seen).toHaveLength(10);
  first.definitions[0].definitionCanonical = "mutated caller value"; first.policies.push({} as never);
  expect(await read(view, f)).not.toEqual(first); expect(seen).toHaveLength(10);
  expect(seen[8]).toEqual({ table: "runtimeAgentDefinitions", index: "by_scoped_version", fields: [["tenantId", "tenant-a"], ["memorySpaceId", "space-a"], ["agentId", f.published.agentId], ["version", f.published.version]], cap: 2 });
  expect(seen[9]).toEqual({ table: "runtimeModelPolicies", index: "by_scope_active", fields: [["scope", "tenant"], ["tenantId", "tenant-a"], ["active", true]], cap: 65 });
  await read(withNativeSnapshotReads({ ...f.ctx }, parent), f); expect(seen).toHaveLength(12);
  freshPolicyMetadataReads(view); await read(view, f); expect(seen).toHaveLength(14);
});

it("actual definition and profile validators retain outcomes while repeated exact definition/tenant queries collapse", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), query = jest.spyOn(f.db, "query");
  const old = createAuthorityReadScope(f.ctx, { policyMetadata: true });
  const expected = [await current(old, f), await current(old, f), await current(old, f)];
  const before = query.mock.calls.map(([table]) => table); query.mockClear();
  const ctx = withNativeSnapshotReads(f.ctx, createMemorySourceReadScope(f.ctx));
  expect([await current(ctx, f), await current(ctx, f), await current(ctx, f)]).toEqual(expected);
  const after = query.mock.calls.map(([table]) => table);
  expect(new Set(after)).toEqual(new Set(before));
  expect(after.filter(t => t === "runtimeAgentDefinitions")).toHaveLength(1);
  expect(before.filter(t => t === "runtimeAgentDefinitions").length).toBeGreaterThan(1);
  expect(after.filter(t => t === "runtimeModelPolicies").length).toBeLessThan(before.filter(t => t === "runtimeModelPolicies").length);
  console.info(JSON.stringify({ type: "k29-executable-metadata-validators", beforeQueries: before.length, afterQueries: after.length,
    definitionQueries: [before.filter(t => t === "runtimeAgentDefinitions").length, after.filter(t => t === "runtimeAgentDefinitions").length],
    policyQueries: [before.filter(t => t === "runtimeModelPolicies").length, after.filter(t => t === "runtimeModelPolicies").length], nativeLatency: "NOT_RUN" }));
});

it.each(["revoked", "hash", "malformed", "duplicate-definition", "tenant-revoked", "tenant-overflow"] as const)("fresh %s metadata keeps actual original validator refusal", async fault => {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), ctx = withNativeSnapshotReads(f.ctx, createMemorySourceReadScope(f.ctx));
  await current(ctx, f); const row = f.db.table("runtimeAgentDefinitions")[0], root = f.db.table("runtimeModelPolicies")[0];
  const db = ctx.db as unknown as Pick<typeof f.db, "patch" | "insert">;
  if (fault === "revoked") await db.patch("runtimeAgentDefinitions", row._id, { revokedAt: clock });
  if (fault === "hash") await db.patch("runtimeAgentDefinitions", row._id, { definitionHash: "0".repeat(64) });
  if (fault === "malformed") await db.patch("runtimeAgentDefinitions", row._id, { definitionCanonical: "{}" });
  if (fault === "duplicate-definition") { const { _id, _creationTime, ...body } = row; await db.insert("runtimeAgentDefinitions", body); }
  if (fault === "tenant-revoked" || fault === "tenant-overflow") {
    const { _id, _creationTime, ...body } = root;
    for (let i = 0; i < (fault === "tenant-overflow" ? 65 : 1); i++) await db.insert("runtimeModelPolicies", { ...body, scope: "tenant", tenantId: "tenant-a", ...(fault === "tenant-revoked" ? { revokedAt: clock } : {}) });
  }
  const actual = await error(() => current(ctx, f)); expect(actual).not.toBeNull(); expect(actual).toEqual(await error(() => current(f.ctx, f)));
});

it.each([false, true])("unknown component writer invalidates both families before/after and suppresses in-flight reuse, error=%s", async fail => {
  const f = await transcriptFixture({ maxContextTokens: 16384 }); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), failure = Error("CONTROLLED_COMPONENT_FAILURE");
  const native = { ...f.ctx, runMutation: async () => { await gate; if (fail) throw failure; return null; } } as unknown as MutationCtx;
  const ctx = withNativeSnapshotReads(native, createMemorySourceReadScope(native)), query = jest.spyOn(f.db, "query");
  await read(ctx, f); await read(ctx, f); expect(query).toHaveBeenCalledTimes(2);
  const writing = ctx.runMutation(makeFunctionReference<"mutation">("controlled:metadata-write"), {}); void writing.catch(() => {});
  await read(ctx, f); await read(ctx, f); expect(query).toHaveBeenCalledTimes(6);
  release(); if (fail) await expect(writing).rejects.toBe(failure); else await writing;
  await read(ctx, f); await read(ctx, f); expect(query).toHaveBeenCalledTimes(8);
});

it("known state writes retain only these untouched rows; finance, policy, definition and fluent writes invalidate", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), ctx = createV8AuthorityReadScope(f.ctx), query = jest.spyOn(f.db, "query");
  const db = ctx.db as unknown as Pick<typeof f.db, "insert" | "patch">;
  await read(ctx, f); await db.insert("runtimeAgentExecutions", { state: "ready" }); await read(ctx, f); expect(query).toHaveBeenCalledTimes(2);
  await db.insert("runtimeBudgetAccounts", { version: 1 }); await read(ctx, f); expect(query).toHaveBeenCalledTimes(4);
  const definition = f.db.table("runtimeAgentDefinitions")[0]; await db.patch("runtimeAgentDefinitions", definition._id, { revokedAt: clock });
  await read(ctx, f); expect(query).toHaveBeenCalledTimes(6);
  const policy = f.db.table("runtimeModelPolicies")[0]; await db.patch("runtimeModelPolicies", policy._id, { active: false });
  await read(ctx, f); expect(query).toHaveBeenCalledTimes(8);
  const originalTable = f.db.table, fluent = { patch: async function(this: unknown) { expect(this).toBe(fluent); } };
  Object.defineProperty(f.db, "table", { value: () => fluent, configurable: true });
  await (ctx.db as unknown as { table(name: string): typeof fluent }).table("runtimeAgentDefinitions").patch();
  Object.defineProperty(f.db, "table", { value: originalTable, configurable: true });
  await read(ctx, f); expect(query).toHaveBeenCalledTimes(10);
});

it("entry and byte bounds fall through without truncation; absent results remain exact", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), ctx = createMemorySourceReadScope(f.ctx), query = jest.spyOn(f.db, "query");
  for (let i = 0; i < EXECUTABLE_METADATA_READ_SCOPE_MAX_ENTRIES; i++) await readTenantPolicyRows(ctx, `absent:${i}`);
  await readTenantPolicyRows(ctx, "overflow"); await readTenantPolicyRows(ctx, "overflow"); await readTenantPolicyRows(ctx, "absent:0");
  expect(query).toHaveBeenCalledTimes(EXECUTABLE_METADATA_READ_SCOPE_MAX_ENTRIES + 2);
  freshPolicyMetadataReads(ctx); query.mockClear();
  const row = f.db.table("runtimeAgentDefinitions")[0]; row.definitionCanonical = "x".repeat(EXECUTABLE_METADATA_READ_SCOPE_MAX_BYTES);
  const first = await read(ctx, f), next = await read(ctx, f); expect(next).toEqual(first);
  expect(first.definitions[0].definitionCanonical).toHaveLength(EXECUTABLE_METADATA_READ_SCOPE_MAX_BYTES); expect(query).toHaveBeenCalledTimes(3);
});

it("a late pre-write definition read cannot populate a newer epoch, and failed reads are never retained", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), ctx = createMemorySourceReadScope(f.ctx), query = f.db.query.bind(f.db);
  let entered!: () => void, release!: () => void, first = true;
  const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  const spy = jest.spyOn(f.db, "query").mockImplementation(table => {
    const b = query(table), take = b.take; b.take = async cap => { const value = await take(cap); if (first) { first = false; entered(); await gate; } return value; }; return b;
  });
  const pending = readExecutableDefinitionRows(ctx, "tenant-a", "space-a", f.published.agentId, f.published.version); await started;
  await ctx.db.patch("runtimeAgentDefinitions", f.db.table("runtimeAgentDefinitions")[0]._id as Id<"runtimeAgentDefinitions">, { revokedAt: clock });
  release(); expect((await pending)[0].revokedAt).toBeUndefined();
  expect((await readExecutableDefinitionRows(ctx, "tenant-a", "space-a", f.published.agentId, f.published.version))[0].revokedAt).toBe(clock);
  expect(spy).toHaveBeenCalledTimes(2);
  freshPolicyMetadataReads(ctx); const failure = Error("CONTROLLED_READ_FAILURE"); spy.mockImplementationOnce(() => { throw failure; });
  await expect(readTenantPolicyRows(ctx, "tenant-a")).rejects.toBe(failure); await expect(readTenantPolicyRows(ctx, "tenant-a")).resolves.toEqual([]);
  expect(spy).toHaveBeenCalledTimes(4);
});
