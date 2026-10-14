/** Exact raw metadata queries only; controlled native DB ports, no authorization/decision cache. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { createAuthorityReadScope, freshPolicyMetadataReads, readDeploymentPolicyRows, readQualificationRows, POLICY_METADATA_READ_SCOPE_MAX_ENTRIES, createMemorySourceReadScope, withManagedSourceValidationReads, withNativeSnapshotReads } from "../../../convex-dev/runtimeAuth";
import { transcriptFixture, installMockRoot, clock } from "../runtimeTranscript/fixture";
beforeEach(() => { installMockRoot(); }); afterEach(() => { jest.restoreAllMocks(); });
it("unscoped/default factory stays uncached; opted queries retain exact original index/arguments/caps and detached rows", async () => {
  const f = await transcriptFixture(), query = f.db.query.bind(f.db), seen: { table: string; index?: string; fields: [string, unknown][]; cap?: number }[] = [];
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const b = query(table), record = { table, fields: [] as [string, unknown][], index: undefined as string | undefined, cap: undefined as number | undefined }; seen.push(record);
    const index = b.withIndex, take = b.take;
    b.withIndex = (name, select) => index(name, raw => { record.index = name; const q = raw as { eq(key: string, value: unknown): unknown }; const selected = { eq: (key: string, value: unknown) => { record.fields.push([key, value]); q.eq(key, value); return selected; } }; return select(selected); });
    b.take = async cap => { record.cap = cap; return await take(cap); }; return b;
  });
  for (const ctx of [f.ctx, createAuthorityReadScope(f.ctx)]) { await readDeploymentPolicyRows(ctx); await readDeploymentPolicyRows(ctx); }
  expect(seen).toHaveLength(4);
  const scoped = createAuthorityReadScope(f.ctx, { policyMetadata: true });
  const first = await readDeploymentPolicyRows(scoped), second = await readDeploymentPolicyRows(scoped);
  expect(first).toEqual(second); expect(first).not.toBe(second); first[0].active = false;
  expect((await readDeploymentPolicyRows(scoped))[0].active).toBe(true); expect(seen).toHaveLength(5);
  await readQualificationRows(scoped, "receipt-a", 1); await readQualificationRows(scoped, "receipt-a", 1);
  await readQualificationRows(scoped, "receipt-a", 2); await readQualificationRows(scoped, "receipt-b", 1);
  expect(seen[4]).toEqual({ table: "runtimeModelPolicies", index: "by_scope_active", fields: [["scope", "deployment"], ["tenantId", undefined], ["active", true]], cap: 65 });
  expect(seen.slice(5)).toEqual([1, 2, 1].map((revision, index) => ({ table: "runtimeModelQualifications", index: "by_receipt", fields: [["receiptId", index === 2 ? "receipt-b" : "receipt-a"], ["version", revision]], cap: 2 })));
  const nested = createAuthorityReadScope(scoped); await readDeploymentPolicyRows(nested); await readDeploymentPolicyRows(nested); expect(seen).toHaveLength(10);
});
it("explicit fresh fence retains the same context but reads changed raw policy/qualification rows", async () => {
  const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx, { policyMetadata: true }), query = jest.spyOn(f.db, "query");
  const rows = await readDeploymentPolicyRows(scoped), qualification = f.db.table("runtimeModelQualifications")[0];
  await readQualificationRows(scoped, qualification.receiptId as string, qualification.version as number);
  f.db.table("runtimeModelPolicies")[0].active = false; qualification.revokedAt = clock;
  expect(await readDeploymentPolicyRows(scoped)).toEqual(rows); expect(freshPolicyMetadataReads(scoped)).toBe(scoped);
  expect((await readDeploymentPolicyRows(scoped)).length).toBe(rows.length - 1);
  expect((await readQualificationRows(scoped, qualification.receiptId as string, qualification.version as number))[0].revokedAt).toBe(clock);
  expect(query).toHaveBeenCalledTimes(4);
});
it.each(["insert", "patch", "replace", "delete"] as const)("%s writer invalidates both exact metadata families", async method => {
  const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx, { policyMetadata: true }), query = jest.spyOn(f.db, "query"), id = f.principal._id as Id<"runtimeAuthPrincipals">;
  await readDeploymentPolicyRows(scoped); await readQualificationRows(scoped, "missing", 1);
  if (method === "insert") await scoped.db.insert("runtimeAuthPrincipals", { issuer: "other", subject: "other", actorKind: "user", version: 1, createdAt: clock });
  if (method === "patch") await scoped.db.patch("runtimeAuthPrincipals", id, { metadataUserId: "changed" });
  if (method === "replace") await scoped.db.replace("runtimeAuthPrincipals", id, { issuer: "changed", subject: "changed", actorKind: "user", version: 1, createdAt: clock });
  if (method === "delete") await scoped.db.delete("runtimeAuthPrincipals", id);
  await readDeploymentPolicyRows(scoped); await readQualificationRows(scoped, "missing", 1); expect(query).toHaveBeenCalledTimes(4);
});
it.each([false, true])("child mutation invalidates metadata before/after and propagates failure=%s", async fail => {
  const f = await transcriptFixture(), failure = Error("COMPONENT_FAILURE"); let calls = 0;
  const ctx = { ...f.ctx, runMutation: async () => { calls++; await readDeploymentPolicyRows(scoped); if (fail) throw failure; return null; } };
  const scoped = createAuthorityReadScope(ctx, { policyMetadata: true }), query = jest.spyOn(f.db, "query"); await readDeploymentPolicyRows(scoped);
  const result = scoped.runMutation(); if (fail) await expect(result).rejects.toBe(failure); else await result;
  await readDeploymentPolicyRows(scoped); expect(query).toHaveBeenCalledTimes(3); expect(calls).toBe(1);
});
it("pending writer suppresses hits/population; failed reads preserve error and are not cached", async () => {
  const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx, { policyMetadata: true }), query = f.db.query.bind(f.db); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), failure = Error("WRITER_FAILURE");
  jest.spyOn(f.db, "patch").mockImplementation(async () => { await gate; throw failure; });
  const readSpy = jest.spyOn(f.db, "query").mockImplementation(query); await readDeploymentPolicyRows(scoped);
  const writer = scoped.db.patch("runtimeAuthPrincipals", f.principal._id as Id<"runtimeAuthPrincipals">, {}); void writer.catch(() => {});
  await readDeploymentPolicyRows(scoped); await readDeploymentPolicyRows(scoped); expect(readSpy).toHaveBeenCalledTimes(3);
  release(); await expect(writer).rejects.toBe(failure); await readDeploymentPolicyRows(scoped); expect(readSpy).toHaveBeenCalledTimes(4);
  const readFailure = Error("READ_FAILURE"); freshPolicyMetadataReads(scoped); readSpy.mockImplementationOnce(() => { throw readFailure; });
  await expect(readDeploymentPolicyRows(scoped)).rejects.toBe(readFailure); await readDeploymentPolicyRows(scoped); expect(readSpy).toHaveBeenCalledTimes(6);
});
it.each(["fresh", "writer"] as const)("late pre-%s reads cannot repopulate a newer metadata epoch", async boundary => {
  const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx, { policyMetadata: true }), query = f.db.query.bind(f.db); let entered!: () => void, release!: () => void, first = true;
  const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  jest.spyOn(f.db, "query").mockImplementation(table => { const b = query(table), take = b.take; b.take = async n => { const result = await take(n); if (first) { first = false; entered(); await gate; } return result; }; return b; });
  const pending = readDeploymentPolicyRows(scoped); await started;
  if (boundary === "fresh") { f.db.table("runtimeModelPolicies")[0].active = false; freshPolicyMetadataReads(scoped); }
  else await scoped.db.patch("runtimeModelPolicies", f.db.table("runtimeModelPolicies")[0]._id as Id<"runtimeModelPolicies">, { active: false });
  release(); const stale = await pending; expect((await readDeploymentPolicyRows(scoped)).length).toBe(stale.length - 1);
});
it("finite capacity falls through to original raw lookup and cannot share a child's native context", async () => {
  const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx, { policyMetadata: true }), query = jest.spyOn(f.db, "query");
  for (let i = 0; i < POLICY_METADATA_READ_SCOPE_MAX_ENTRIES; i++) await readQualificationRows(scoped, `receipt:${i}`, 1);
  await readQualificationRows(scoped, "overflow", 1); await readQualificationRows(scoped, "overflow", 1);
  await readQualificationRows(scoped, "receipt:0", 1); expect(query).toHaveBeenCalledTimes(POLICY_METADATA_READ_SCOPE_MAX_ENTRIES + 2);
  const child = createAuthorityReadScope(f.ctx); await readQualificationRows(child, "receipt:0", 1); await readQualificationRows(child, "receipt:0", 1);
  expect(query).toHaveBeenCalledTimes(POLICY_METADATA_READ_SCOPE_MAX_ENTRIES + 4);
});

it("original embedding-profile validation repeats every predicate with fewer raw queries in the explicit snapshot view", async () => {
  const { installIngestionMockRoot, ledger } = await import("../runtimeTranscript/fixture"); installIngestionMockRoot();
  const f = await transcriptFixture({ maxContextTokens: 16384 }), spy = jest.spyOn(f.db, "query"), get = jest.spyOn(f.db, "get");
  const oldView = withManagedSourceValidationReads(f.ctx, createMemorySourceReadScope(f.ctx));
  const expected = [await ledger.readCurrentEmbeddingProfile(oldView, f.reference, "embedding.query"), await ledger.readCurrentEmbeddingProfile(oldView, f.reference, "embedding.query")];
  const oldQueries = spy.mock.calls.map(([table]) => table), oldGets = get.mock.calls.map(args => JSON.stringify(args)); spy.mockClear(); get.mockClear();
  const view = withNativeSnapshotReads(f.ctx, createMemorySourceReadScope(f.ctx));
  expect([await ledger.readCurrentEmbeddingProfile(view, f.reference, "embedding.query"), await ledger.readCurrentEmbeddingProfile(view, f.reference, "embedding.query")]).toEqual(expected);
  const queries = spy.mock.calls.map(([table]) => table), gets = get.mock.calls.map(args => JSON.stringify(args));
  expect(new Set(queries)).toEqual(new Set(oldQueries)); expect(new Set(gets)).toEqual(new Set(oldGets));
  expect(queries.length).toBeLessThan(oldQueries.length); expect(gets.length).toBeLessThan(oldGets.length);
  console.info(JSON.stringify({ type: "k29-profile-snapshot-reads", originalQueries: oldQueries.length, currentQueries: queries.length, originalGets: oldGets.length, currentGets: gets.length, nativeLatency: "NOT_RUN" }));
});
it.each(["root-inactive", "qualification-revoked", "qualification-canonical", "duplicate-root", "clock-expired"])("fresh profile %s keeps original denial with snapshot readers", async fault => {
  const { installIngestionMockRoot, ledger } = await import("../runtimeTranscript/fixture"); installIngestionMockRoot();
  const f = await transcriptFixture({ maxContextTokens: 16384 }), parent = createMemorySourceReadScope(f.ctx), view = withNativeSnapshotReads(f.ctx, parent);
  await ledger.readCurrentEmbeddingProfile(view, f.reference, "embedding.query");
  const policy = f.db.table("runtimeModelPolicies").find(row => row.scope === "deployment")!, qualification = f.db.table("runtimeModelQualifications")[0]!;
  if (fault === "root-inactive") await view.db.patch("runtimeModelPolicies", policy._id as Id<"runtimeModelPolicies">, { active: false });
  if (fault === "qualification-revoked") await view.db.patch("runtimeModelQualifications", qualification._id as Id<"runtimeModelQualifications">, { revokedAt: clock });
  if (fault === "qualification-canonical") await view.db.patch("runtimeModelQualifications", qualification._id as Id<"runtimeModelQualifications">, { canonical: "changed" });
  if (fault === "duplicate-root") {
    const { _id, _creationTime, ...body } = policy;
    const writer = view.db as unknown as Pick<typeof f.db, "insert">; await writer.insert("runtimeModelPolicies", body);
  }
  if (fault === "clock-expired") jest.mocked(Date.now).mockReturnValue(clock + 600_000);
  const error = async (ctx: typeof f.ctx) => { try { await ledger.readCurrentEmbeddingProfile(ctx, f.reference, "embedding.query"); return null; } catch (value) { return value && typeof value === "object" && "data" in value ? value.data : value; } };
  expect(await error(view)).toEqual(await error(f.ctx)); expect(await error(view)).not.toBeNull();
});
