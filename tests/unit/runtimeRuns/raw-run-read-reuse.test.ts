/** Actual control-run predicates with counted native raw queries; no cloud latency claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { makeFunctionReference } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { createV8AuthorityReadScope, MANAGED_SOURCE_READ_SCOPE_MAX_BYTES } from "../../../convex-dev/runtimeAuth";
const { installMockRoot, transcriptFixture, runs, clone, clock } = await import("../runtimeTranscript/fixture");

beforeEach(() => installMockRoot());
afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await transcriptFixture(), run = await f.run();
  const query = f.db.query.bind(f.db), reads: { index: string; limit: number; documents: number; bytes: number }[] = [];
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const builder = query(table);
    if (table !== "runtimeRuns") return builder;
    let index = "";
    const withIndex = builder.withIndex, take = builder.take;
    builder.withIndex = (name, callback) => { index = name; return withIndex(name, callback); };
    builder.take = async limit => {
      const result = await take(limit);
      reads.push({ index, limit, documents: result.length, bytes: Buffer.byteLength(JSON.stringify(result)) });
      return result;
    };
    return builder;
  });
  const scope = () => createV8AuthorityReadScope(f.ctx, { managedSources: true });
  const read = (ctx: MutationCtx, runId = run.runId) => runs.currentControlRun(ctx, f.reference, runId, "read");
  return { ...f, run, scope, read, reads };
}

it("reuses only the exact bounded run lookup while preserving current predicates and detached rows", async () => {
  const f = await fixture(), before = clone(f.db.rows);
  const expected = [await f.read(f.ctx), await f.read(f.ctx)], original = f.reads.splice(0);
  const scoped = f.scope(), actual = [await f.read(scoped), await f.read(scoped)], retained = f.reads.splice(0);
  expect(actual).toEqual(expected); expect(f.db.rows).toEqual(before);
  expect(original.map(row => [row.index, row.limit])).toEqual([["by_scoped_id", 2], ["by_scoped_id", 2]]);
  expect(retained.map(row => [row.index, row.limit])).toEqual([["by_scoped_id", 2]]);
  expect(retained[0]!.documents).toBe(1); expect(retained[0]!.bytes).toBeGreaterThan(0);
  expect(retained.reduce((sum, row) => sum + row.bytes, 0)).toBe(original.reduce((sum, row) => sum + row.bytes, 0) / 2);
  actual[0]!.row.responseStatus = "cancelled";
  expect((await f.read(scoped)).row.responseStatus).toBe(expected[0]!.row.responseStatus);
  expect(f.reads).toEqual([]);
  console.info(JSON.stringify({ type: "controlled-control-run-raw-reads", originalQueries: original.length,
    scopedQueries: retained.length, originalDocuments: original.reduce((sum, row) => sum + row.documents, 0),
    scopedDocuments: retained.reduce((sum, row) => sum + row.documents, 0),
    originalBytes: original.reduce((sum, row) => sum + row.bytes, 0), scopedBytes: retained.reduce((sum, row) => sum + row.bytes, 0), nativeLatencyProof: false }));
});

it.each(["missing", "duplicate", "foreign-scope", "owner", "tombstone", "conversation-epoch"])("%s retains original lookup/refusal order", async fault => {
  const f = await fixture(), row = f.db.table("runtimeRuns")[0]!;
  if (fault === "missing") f.db.rows.set("runtimeRuns", []);
  if (fault === "duplicate") f.db.seed("runtimeRuns", { ...row, _id: "runtimeRuns:duplicate" });
  if (fault === "foreign-scope") row.memorySpaceId = "other-space";
  if (fault === "owner") row.ownerPrincipalId = "foreign-principal";
  if (fault === "tombstone") row.tombstonedAt = clock;
  if (fault === "conversation-epoch") row.conversationEpoch = 2;
  const outcome = async (ctx: MutationCtx) => {
    try { return { result: await f.read(ctx) }; }
    catch (error) { return { error: error instanceof Error ? error.message : error }; }
  };
  const original = await outcome(f.ctx), scoped = f.scope();
  expect(original).toHaveProperty("error"); expect(await outcome(scoped)).toEqual(original);
  expect(await outcome(scoped)).toEqual(original);
  expect(f.reads.every(read => read.index === "by_scoped_id" && read.limit === 2)).toBe(true);
});

it.each(["patch", "replace", "delete"] as const)("%s run writes invalidate the row before the next actual control guard", async method => {
  const f = await fixture(), scoped = f.scope(), first = await f.read(scoped);
  const { _id, _creationTime: _created, ...value } = first.row;
  if (method === "patch") await scoped.db.patch("runtimeRuns", _id, { tombstonedAt: clock });
  if (method === "replace") await scoped.db.replace("runtimeRuns", _id, { ...value, conversationEpoch: value.conversationEpoch + 1 });
  if (method === "delete") await scoped.db.delete("runtimeRuns", _id);
  await expect(f.read(scoped)).rejects.toThrow(method === "replace" ? "STALE_TRANSCRIPT" : "FORBIDDEN");
  expect(f.reads).toHaveLength(2);
});

it("insert invalidates a cached absence and duplicate detection still takes two rows", async () => {
  const f = await fixture(), scoped = f.scope(), { _id: _original, _creationTime: _created, ...value } = (await f.read(scoped)).row;
  await expect(f.read(scoped, "new-run")).rejects.toThrow("FORBIDDEN");
  await scoped.db.insert("runtimeRuns", { ...value, runId: "new-run" });
  expect((await f.read(scoped, "new-run")).row.runId).toBe("new-run");
  await scoped.db.insert("runtimeRuns", { ...value, runId: "new-run" });
  await expect(f.read(scoped, "new-run")).rejects.toThrow("TRANSCRIPT_CONFLICT");
  expect(f.reads.map(row => row.documents)).toEqual([1, 0, 1, 2]);
});

it.each(["revocation", "grant-expiry", "run-tombstone", "conversation-delete"])("a new invocation observes %s after an earlier successful read", async fault => {
  const f = await fixture(); await f.read(f.scope());
  if (fault === "revocation") await f.db.patch("runtimeAuthGrants", f.grant._id, { revokedAt: clock });
  if (fault === "grant-expiry") await f.db.patch("runtimeAuthGrants", f.grant._id, { expiresAt: clock });
  if (fault === "run-tombstone") await f.db.patch("runtimeRuns", f.db.table("runtimeRuns")[0]!._id, { tombstonedAt: clock });
  if (fault === "conversation-delete") await f.db.patch("runtimeConversations", f.db.table("runtimeConversations")[0]!._id, { tombstonedAt: clock });
  await expect(f.read(f.scope())).rejects.toThrow("FORBIDDEN"); expect(f.reads).toHaveLength(2);
});

it("security writes inside the invocation invalidate authority along with run rows", async () => {
  const f = await fixture(), scoped = f.scope(); await f.read(scoped);
  await scoped.db.patch("runtimeAuthGrants", f.grant._id as Id<"runtimeAuthGrants">, { revokedAt: clock });
  await expect(f.read(scoped)).rejects.toThrow("FORBIDDEN"); expect(f.reads).toHaveLength(2);
});

it("retained raw rows do not cache a grant-expiry permission decision", async () => {
  const f = await fixture(); f.grant.expiresAt = clock + 1;
  const scoped = f.scope(); await f.read(scoped);
  jest.spyOn(Date, "now").mockReturnValue(clock + 1);
  await expect(f.read(scoped)).rejects.toThrow("FORBIDDEN"); expect(f.reads).toHaveLength(1);
});

it("same run labels in another tenant or space cannot alias the scoped raw lookup", async () => {
  const f = await fixture(), original = f.db.table("runtimeRuns")[0]!;
  f.db.seed("runtimeRuns", { ...original, _id: "runtimeRuns:other-space", memorySpaceId: "other-space" });
  f.db.seed("runtimeRuns", { ...original, _id: "runtimeRuns:other-tenant", tenantId: "other-tenant" });
  const scoped = f.scope(); expect((await f.read(scoped)).row._id).toBe(original._id);
  await expect(runs.currentControlRun(scoped, { ...f.reference, memorySpaceId: "other-space" }, f.run.runId, "read")).rejects.toThrow("FORBIDDEN");
  await expect(runs.currentControlRun(scoped, { ...f.reference, tenantId: "other-tenant" }, f.run.runId, "read")).rejects.toThrow("FORBIDDEN");
  expect((await f.read(scoped)).row._id).toBe(original._id);
  expect(f.reads.map(row => row.documents)).toEqual([1, 1, 1]);
});

it.each([false, true])("an unknown child writer invalidates on success/failure=%s with original exception identity", async failing => {
  const f = await fixture(), failure = Error("CONTROLLED_CHILD_FAILURE");
  const ctx = { ...f.ctx, runMutation: async function () {
    await f.db.patch("runtimeRuns", f.db.table("runtimeRuns")[0]!._id, { tombstonedAt: clock });
    if (failing) throw failure;
    return null;
  } } as MutationCtx;
  const scoped = createV8AuthorityReadScope(ctx, { managedSources: true }); await f.read(scoped);
  const writing = scoped.runMutation(makeFunctionReference<"mutation">("controlled:child"));
  if (failing) await expect(writing).rejects.toBe(failure); else await writing;
  await expect(f.read(scoped)).rejects.toThrow("FORBIDDEN"); expect(f.reads).toHaveLength(2);
});

it("a failed run writer clears its earlier row and preserves the original error", async () => {
  const f = await fixture(), failure = Error("CONTROLLED_RUN_WRITE_FAILURE"), patch = f.db.patch.bind(f.db);
  f.db.patch = async (table: string, id: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    if (typeof id === "string") await patch(table, id, value!); else await patch(table, id);
    throw failure;
  };
  const scoped = f.scope(), first = await f.read(scoped);
  await expect(scoped.db.patch("runtimeRuns", first.row._id, { tombstonedAt: clock })).rejects.toBe(failure);
  await expect(f.read(scoped)).rejects.toThrow("FORBIDDEN"); expect(f.reads).toHaveLength(2);
});

it("does not cache a failed raw query or reuse a previous invocation's rows", async () => {
  const f = await fixture(), query = jest.mocked(f.db.query).getMockImplementation()!, failure = Error("CONTROLLED_RUN_READ_FAILURE"); let fail = true;
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const builder = query(table), take = builder.take;
    if (table === "runtimeRuns") builder.take = async limit => { if (fail) { fail = false; throw failure; } return take(limit); };
    return builder;
  });
  const scoped = f.scope(); await expect(f.read(scoped)).rejects.toBe(failure);
  expect((await f.read(scoped)).row.runId).toBe(f.run.runId);
  expect((await f.read(f.scope())).row.runId).toBe(f.run.runId); expect(f.reads).toHaveLength(2);
});

it("oversized rows remain uncached under the existing shared byte bound", async () => {
  const f = await fixture(); f.db.table("runtimeRuns")[0]!.requestCanonical = "x".repeat(MANAGED_SOURCE_READ_SCOPE_MAX_BYTES);
  const scoped = f.scope(); await f.read(scoped); await f.read(scoped); expect(f.reads).toHaveLength(2);
});
