/** Current verified runtime contract. Historical pre-authority catalog and coverage
 * mapping: _DEPRECATED/tests/legacy-registry/README.md. Public endpoints stay public. */
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createNamedTestRunContext } from "./helpers/isolation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

describe("Users: public scoped profile lifecycle", () => {
  const run = createNamedTestRunContext("canonical-users");
  let f: Awaited<ReturnType<typeof createRuntimeFixture>>;
  beforeEach(async () => { const id = crypto.randomUUID(); f = await createRuntimeFixture(run.runId + id, run.memorySpaceId(id), run.userId(id)); });
  afterEach(async () => { await f?.close(); });
  it("creates, merges nested data, gets and reconstructs retained versions", async () => {
    const first = await f.cortex.users.getOrCreate(f.userId, { displayName: "Alice", preferences: { theme: "dark" } });
    expect(first).toMatchObject({ id: f.userId, tenantId: f.tenantId, version: 1 });
    expect(await f.cortex.users.exists(f.userId)).toBe(true);
    const merged = await f.cortex.users.merge(f.userId, { preferences: { language: "en" } });
    expect(merged.data).toMatchObject({ preferences: { theme: "dark", language: "en" } });
    expect(await f.cortex.users.get(f.userId)).toEqual(merged);
    expect(await f.cortex.users.getVersion(f.userId, 1)).toMatchObject({ version: 1, data: first.data });
    expect((await f.cortex.users.getHistory(f.userId)).map(v => v.version)).toEqual([1, 2]);
    expect(await f.cortex.users.getAtTimestamp(f.userId, new Date(first.updatedAt))).toMatchObject({ version: 1 });
    expect(await f.cortex.users.getVersion(f.userId, 99)).toBeNull();
    expect(await f.cortex.users.getOrCreate(f.userId, { displayName: "Ignored" })).toEqual(merged);
  });
  it("lists, searches, counts and exports only profiles admitted by the current scope", async () => {
    await f.cortex.users.update(f.userId, { displayName: "Alice", email: "alice@example.test", metadata: { team: "a" } });
    await f.cortex.users.update(f.userId + "-b", { displayName: "Bob" });
    const list = await f.cortex.users.list({ limit: 1 });
    expect(list).toMatchObject({ total: 2, hasMore: true }); expect(list.users).toHaveLength(1);
    expect(await f.cortex.users.count()).toBe(2);
    expect((await f.cortex.users.search({ displayName: "ali" })).map(u => u.id)).toEqual([f.userId]);
    const json = await f.cortex.users.export({ format: "json", includeVersionHistory: true });
    expect(JSON.parse(json)).toHaveLength(2);
    expect(await f.cortex.users.export({ format: "csv" })).toContain(f.userId);
    await expect(f.cortex.users.list({ tenantId: f.tenantId + "-foreign" })).rejects.toThrow();
  });
  it("bulk updates explicit IDs and filters; dry runs preserve all stored versions", async () => {
    await f.cortex.users.update(f.userId, { displayName: "Alice" });
    const before = await f.ownedRows("immutable");
    expect(await f.cortex.users.updateMany([f.userId], { data: { verified: true } }, { dryRun: true })).toEqual({ updated: 0, userIds: [f.userId] });
    expect(await f.ownedRows("immutable")).toEqual(before);
    expect(await f.cortex.users.updateMany([f.userId], { data: { verified: true } })).toEqual({ updated: 1, userIds: [f.userId] });
    expect(await f.cortex.users.updateMany({ displayName: "Alice" }, { data: { bulk: true } })).toEqual({ updated: 1, userIds: [f.userId] });
    expect((await f.cortex.users.get(f.userId))?.data).toMatchObject({ verified: true, bulk: true });
  });
  it("profile deletion and bulk deletion retain honest supported-scope receipts", async () => {
    await f.cortex.users.update(f.userId, { displayName: "Delete" });
    await f.cortex.users.update(f.userId + "-b", { displayName: "Delete" });
    const before = await f.ownedRows("immutable");
    expect((await f.cortex.users.delete(f.userId, { dryRun: true })).totalDeleted).toBe(0);
    expect(await f.ownedRows("immutable")).toEqual(before);
    expect(await f.cortex.users.delete(f.userId)).toMatchObject({ totalDeleted: 1, deletedLayers: ["user-profile"], verification: { complete: false, issues: ["USER_PROFILE_VERIFICATION_UNAVAILABLE"] } });
    await expect(f.cortex.users.get(f.userId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(await f.cortex.users.deleteMany([f.userId + "-b"])).toMatchObject({ deleted: 1, complete: false, unstarted: [] });
    expect(await f.cortex.users.count()).toBe(0);
    expect((await f.ownedRows("immutable")).every(row => Boolean((row as { tombstonedAt?: number }).tombstonedAt))).toBe(true);
  });
  it("refuses public unauthenticated and foreign scoped reads/writes without changing data", async () => {
    await f.cortex.users.update(f.userId, { displayName: "Retain" }); const before = await f.ownedRows("immutable");
    const foreign = await createRuntimeFixture(f.tenantId + "-other", f.memorySpaceId + "-other", f.userId + "-other");
    try {
      expect(await foreign.cortex.users.get(f.userId)).toBeNull();
      await expect(f.cortex.getClient().mutation(makeFunctionReference<"mutation">("immutable:store"), { type: "user", id: f.userId, data: { changed: true }, tenantId: foreign.tenantId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      const ordinary = new ConvexHttpClient(process.env.CONVEX_URL!, { logger: false });
      await expect(ordinary.query(makeFunctionReference<"query">("users:get"), { userId: f.userId })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
      expect(await f.ownedRows("immutable")).toEqual(before);
    } finally { await foreign.close(); }
  });
  it("native committed tombstone preserves foreign profile and reports unavailable verification", async () => {
    await f.cortex.users.update(f.userId, { displayName: "Retire" });
    const other = await createRuntimeFixture(f.tenantId + "-foreign", f.memorySpaceId + "-foreign", f.userId + "-foreign");
    try {
      const foreign = await other.cortex.users.update(other.userId, { displayName: "Retain" });
      const result = await f.cortex.users.delete(f.userId);
      expect(result).toMatchObject({ totalDeleted: 1, deletedLayers: ["user-profile"], verification: { complete: false, scope: "user-profile", issues: ["USER_PROFILE_VERIFICATION_UNAVAILABLE"] } });
      const rows = await f.ownedRows("immutable");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: "user", id: f.userId, tombstonedAt: expect.any(Number) });
      expect(await other.cortex.users.get(other.userId)).toEqual(foreign);
    } finally { await other.close(); }
  });
  it("requires explicit administrator transport for cascade erasure", async () => {
    await f.cortex.users.update(f.userId, { displayName: "Retain" }); const before = await f.ownedRows("immutable");
    await expect(f.cortex.users.delete(f.userId, { cascade: true })).rejects.toThrow();
    expect(await f.ownedRows("immutable")).toEqual(before);
  });
});
