/** Original guards on controlled native ports; native OCC/latency qualification is separate. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { createAuthorityReadScope, createV8AuthorityReadScope, createAuthorityReader, recheckAuthority,
  resolveAuthorityReference, readDeploymentPolicyRows, readQualificationRows, readNativeTranscriptMessages,
  freshNativeTranscriptReads, freshPolicyMetadataReads } from "../../../convex-dev/runtimeAuth";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; } async start() { return "workflow:v8-reads"; }
} }));
const { transcriptFixture, installMockRoot, clock, transcript } = await import("../runtimeTranscript/fixture");
beforeEach(installMockRoot); afterEach(() => { jest.restoreAllMocks(); });
const requirement = { capability: "read" as const, tenantId: "tenant-a", memorySpaceId: "space-a" };
type Fixture = Awaited<ReturnType<typeof transcriptFixture>>;
const stateTables = ["runtimeAgentExecutions", "runtimeAgentOperations", "runtimeRunOutbox", "runtimeRuns"] as const;
const financialTables = ["runtimeBudgetAccounts", "runtimeModelOperations", "runtimeModelAttempts"] as const;
async function tracked(f: Fixture) {
  const get = jest.spyOn(f.db, "get"), query = jest.spyOn(f.db, "query"), native = jest.spyOn(f.ctx, "runQuery");
  const ctx = createV8AuthorityReadScope(f.ctx), reader = createAuthorityReader(ctx);
  const reads = async () => {
    await reader.getGrant(f.reference.grantId);
    await readDeploymentPolicyRows(ctx);
    await readQualificationRows(ctx, "missing-receipt", 1);
    await readNativeTranscriptMessages(ctx, transcript.agentComponent.messages.getMessagesByIds, []);
  };
  await reads();
  return { ctx, reader, reads, get, query, native };
}
async function write(f: Fixture, ctx: ReturnType<typeof createV8AuthorityReadScope<Fixture["ctx"]>>, table: string, method: string) {
  const row = f.db.seed(table, { version: 1 });
  // Native explicit table/ID form. The fixture normalizer implements the same
  // table-membership result contract; actual native syscalls are not mocked as outcomes.
  const db = ctx.db as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  if (method === "insert") await db.insert(table, { version: 2 });
  else if (method === "delete") await db.delete(table, row._id);
  else await db[method](table, row._id, { version: 2 });
}

it.each(stateTables.flatMap(table => ["insert", "patch", "replace", "delete"].map(method => [table, method] as const)))(
  "retains only untouched raw families across native %s %s", async (table, method) => {
    const f = await transcriptFixture(), t = await tracked(f);
    const before = [t.get.mock.calls.length, t.query.mock.calls.length, t.native.mock.calls.length];
    await write(f, t.ctx, table, method); await t.reads();
    expect([t.get.mock.calls.length, t.query.mock.calls.length, t.native.mock.calls.length]).toEqual(before);
    expect(await recheckAuthority(t.ctx, f.reference, requirement)).toMatchObject({ grantId: f.reference.grantId });
  });
it.each(financialTables.flatMap(table => ["insert", "patch", "replace", "delete"].map(method => [table, method] as const)))(
  "%s %s retains authority alone and freshly loads policy/messages/accounts", async (table, method) => {
    const f = await transcriptFixture(), t = await tracked(f), before = [t.get.mock.calls.length, t.query.mock.calls.length, t.native.mock.calls.length];
    await write(f, t.ctx, table, method); await t.reads();
    expect(t.get.mock.calls.length).toBe(before[0]); expect(t.query.mock.calls.length).toBe(before[1] + 2);
    expect(t.native.mock.calls.length).toBe(before[2] + 1);
    const account = f.db.seed("runtimeBudgetAccounts", { version: 10, activeConcurrency: 1 });
    const db = t.ctx.db as unknown as typeof f.db;
    expect(await db.get("runtimeBudgetAccounts", account._id)).toMatchObject({ version: 10, activeConcurrency: 1 });
    await db.patch("runtimeBudgetAccounts", account._id, { version: 11, activeConcurrency: 2 });
    expect(await db.get("runtimeBudgetAccounts", account._id)).toMatchObject({ version: 11, activeConcurrency: 2 });
  });
it("default mode remains fully invalidating for known state writes; nested V8 scopes stay invocation-local", async () => {
  const f = await transcriptFixture(), get = jest.spyOn(f.db, "get"), normal = createAuthorityReadScope(f.ctx);
  const reader = createAuthorityReader(normal); await reader.getGrant(f.reference.grantId);
  const row = f.db.seed("runtimeAgentExecutions", { state: "ready" });
  await (normal.db as unknown as typeof f.db).patch("runtimeAgentExecutions", row._id, { state: "running" });
  await reader.getGrant(f.reference.grantId); expect(get).toHaveBeenCalledTimes(2);
  expect(createAuthorityReadScope(normal)).not.toBe(normal);
  const v8 = createV8AuthorityReadScope(f.ctx);
  expect(createAuthorityReadScope(v8, { policyMetadata: true })).toBe(v8); expect(createV8AuthorityReadScope(v8)).toBe(v8);
  expect(createV8AuthorityReadScope(f.ctx)).not.toBe(v8); expect(Object.getOwnPropertySymbols(f.ctx)).toHaveLength(0);
});
it.each(["unknown-table", "security", "opaque-id", "cross-table-id", "normalizer-missing", "normalizer-throws"])(
  "%s writer fully invalidates rather than guessing table identity", async kind => {
    const f = await transcriptFixture(), t = await tracked(f), before = t.get.mock.calls.length;
    const normalize = f.db.normalizeId;
    const row = f.db.seed("runtimeAgentExecutions", { state: "ready" });
    const db = t.ctx.db as unknown as typeof f.db;
    if (kind === "normalizer-missing") Object.defineProperty(f.db, "normalizeId", { value: undefined, configurable: true });
    if (kind === "normalizer-throws") jest.spyOn(f.db, "normalizeId").mockImplementation(() => { throw Error("NORMALIZE_REFUSED"); });
    if (kind === "unknown-table") await db.insert("runtimeMemorySources", { unknown: true });
    else if (kind === "security") await db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: clock });
    else if (kind === "opaque-id") await db.patch(row._id, { state: "running" });
    else if (kind === "cross-table-id") await expect(db.patch("runtimeAgentExecutions", f.reference.grantId, {})).rejects.toThrow("Missing row");
    else await db.patch("runtimeAgentExecutions", row._id, { state: "running" });
    // Original raw-ID getters require the same native normalizer. Restore only
    // its fixture availability after exercising the writer fallback.
    if (kind === "normalizer-missing") Object.defineProperty(f.db, "normalizeId", { value: normalize, configurable: true });
    if (kind === "normalizer-throws") jest.spyOn(f.db, "normalizeId").mockImplementation((table, id) => normalize.call(f.db, table, id));
    await t.reader.getGrant(f.reference.grantId); expect(t.get.mock.calls.length).toBeGreaterThan(before);
    if (kind === "security") await expect(recheckAuthority(t.ctx, f.reference, requirement)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
it("all component writers clear every family even after a rejected child", async () => {
  const f = await transcriptFixture(), original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async () => { f.grant.revokedAt = clock; throw Error("CHILD_ROLLBACK"); }) as typeof f.ctx.runMutation;
  const t = await tracked(f); await expect(t.ctx.runMutation({} as never, {} as never)).rejects.toThrow("CHILD_ROLLBACK");
  await expect(recheckAuthority(t.ctx, f.reference, requirement)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  f.ctx.runMutation = original;
});
it("fluent table writes use full invalidation and preserve the native receiver", async () => {
  const f = await transcriptFixture(), t = await tracked(f), before = t.get.mock.calls.length;
  const grant = f.grant;
  const writer = { patch: async function (this: unknown) { expect(this).toBe(writer); grant.revokedAt = clock; } };
  Object.defineProperty(f.db, "table", { value: () => writer, configurable: true });
  await (t.ctx.db as unknown as { table(name: string): typeof writer }).table("runtimeRuns").patch();
  // Restore the fixture's read surface before exercising the original guard.
  delete (f.db as unknown as { table?: unknown }).table;
  await t.reader.getGrant(f.reference.grantId); expect(t.get.mock.calls.length).toBeGreaterThan(before);
  await expect(recheckAuthority(t.ctx, f.reference, requirement)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});
it("state rows remain uncached; returned raw grants are cloned and predicates/expiry rerun", async () => {
  const f = await transcriptFixture(); f.grant.expiresAt = clock + 10;
  const t = await tracked(f), row = f.db.seed("runtimeAgentExecutions", { state: "ready" });
  const first = await t.reader.getGrant(f.reference.grantId); first!.capabilities.length = 0;
  expect((await t.reader.getGrant(f.reference.grantId))!.capabilities).toContain("read");
  const db = t.ctx.db as unknown as typeof f.db;
  await db.patch("runtimeAgentExecutions", row._id, { state: "running" });
  expect(await db.get("runtimeAgentExecutions", row._id)).toMatchObject({ state: "running" });
  await expect(recheckAuthority(t.ctx, f.reference, { ...requirement, capability: "storage:write" })).rejects.toThrow("FORBIDDEN");
  await expect(resolveAuthorityReference(t.reader, f.reference, requirement, clock + 10)).rejects.toThrow("FORBIDDEN");
});
it("in-flight failed state writes suppress hits without discarding valid prior rows", async () => {
  const f = await transcriptFixture(), row = f.db.seed("runtimeAgentExecutions", {});
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  jest.spyOn(f.db, "patch").mockImplementation(async () => { entered(); await gate; throw Error("STATE_WRITE_FAILED"); });
  const t = await tracked(f), before = t.get.mock.calls.length;
  const pending = (t.ctx.db as unknown as typeof f.db).patch("runtimeAgentExecutions", row._id, {}); void pending.catch(() => {}); await started;
  await t.reader.getGrant(f.reference.grantId); expect(t.get.mock.calls.length).toBe(before + 1);
  release(); await expect(pending).rejects.toThrow("STATE_WRITE_FAILED");
  await t.reader.getGrant(f.reference.grantId); expect(t.get.mock.calls.length).toBe(before + 1);
});
it("a late raw read cannot populate after a retained write epoch", async () => {
  const f = await transcriptFixture(), row = f.db.seed("runtimeAgentExecutions", {}), original = f.db.get.bind(f.db);
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  let once = true;
  const get = jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { const result = await original(table, id);
    if (once && table === "runtimeAuthGrants") { once = false; entered(); await gate; } return result; });
  const ctx = createV8AuthorityReadScope(f.ctx), reader = createAuthorityReader(ctx), pending = reader.getGrant(f.reference.grantId); await started;
  await (ctx.db as unknown as typeof f.db).patch("runtimeAgentExecutions", row._id, {}); release(); await pending;
  await reader.getGrant(f.reference.grantId); expect(get).toHaveBeenCalledTimes(2);
});
it("explicit policy/message save fences and fresh invocation revocation remain observable", async () => {
  const f = await transcriptFixture(), t = await tracked(f), before = [t.query.mock.calls.length, t.native.mock.calls.length];
  freshPolicyMetadataReads(t.ctx); freshNativeTranscriptReads(t.ctx); await t.reads();
  expect(t.query.mock.calls.length).toBe(before[0] + 2); expect(t.native.mock.calls.length).toBe(before[1] + 1);
  f.grant.revokedAt = clock;
  await expect(recheckAuthority(createV8AuthorityReadScope(f.ctx), f.reference, requirement)).rejects.toThrow("FORBIDDEN");
});
it("query exceptions and absent tombstones are not retained across unknown security writes", async () => {
  const f = await transcriptFixture(), get = f.db.get.bind(f.db), failure = Error("RAW_READ_FAILED");
  const spy = jest.spyOn(f.db, "get").mockRejectedValueOnce(failure).mockImplementation(get);
  const ctx = createV8AuthorityReadScope(f.ctx), reader = createAuthorityReader(ctx);
  await expect(reader.getGrant(f.reference.grantId)).rejects.toBe(failure); await reader.getGrant(f.reference.grantId); expect(spy).toHaveBeenCalledTimes(2);
  const key = { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source" as const, resourceId: "missing" };
  expect(await reader.hasTombstone(key)).toBe(false);
  await (ctx.db as unknown as typeof f.db).insert("runtimeAuthTombstones", { ...key, deletedAt: clock });
  expect(await reader.hasTombstone(key)).toBe(true);
});
it("the native normalizer receives exact table/ID and invalid IDs preserve original writer failure", async () => {
  const f = await transcriptFixture(), normalize = jest.spyOn(f.db, "normalizeId"), ctx = createV8AuthorityReadScope(f.ctx);
  const row = f.db.seed("runtimeBudgetAccounts", { version: 1 });
  await (ctx.db as unknown as typeof f.db).patch("runtimeBudgetAccounts", row._id, { version: 2 });
  expect(normalize).toHaveBeenLastCalledWith("runtimeBudgetAccounts", row._id);
  await expect((ctx.db as unknown as typeof f.db).patch("runtimeBudgetAccounts", f.reference.grantId, {})).rejects.toThrow("Missing row");
});
