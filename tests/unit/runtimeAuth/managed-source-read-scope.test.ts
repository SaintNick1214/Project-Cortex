/** Actual source-currentness predicates on controlled native storage ports; no cloud-speed claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { makeFunctionReference } from "convex/server";
import type { Doc, Id } from "../../../convex-dev/_generated/dataModel";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { fixture } from "../runtimeMetadataAuth/fixture";
import { managedSourceIsCurrent } from "../../../convex-dev/runtimeDataAuth";
import { createV8AuthorityReadScope, createAuthorityReadScope, freshManagedSourceReads, withManagedSourceReads,
  readManagedSourceRows, readManagedConversationRows, readManagedTranscriptBridgeRows, readManagedSourceRunRows,
  recheckAuthority, withNativeSnapshotReads, withManagedSourceValidationReads, createMemorySourceReadScope, MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES, MANAGED_SOURCE_READ_SCOPE_MAX_BYTES } from "../../../convex-dev/runtimeAuth";

beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(1000); });
afterEach(() => { jest.restoreAllMocks(); });
function setup() {
  const f = fixture({ space: "space-a" });
  // This controlled DB materializes an empty table on first read; native Convex
  // does not mutate storage for that lookup. Establish it before state controls.
  f.db.table("runtimeAuthTombstones");
  const conversation = f.db.seed("runtimeConversations", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "conversation-a",
    ownerPrincipalId: f.principal._id, epoch: 1, participants: [f.principal._id], visibility: "private", manualWriteLocked: true });
  const makeSource = (id: string, parents: Doc<"runtimeMemorySources">[] = []) => {
    const role = parents.length ? "assistant" : "user", contentHash = id.padEnd(64, "a").slice(0, 64);
    const witnesses = parents.map(row => ({ sourceId: row.lineage.sourceId, sourceEventId: row.lineage.sourceEventId,
      sourceRevision: row.lineage.sourceRevision, contentHash: row.contentHash, permissions: ["canViewMemories" as const] }));
    f.db.seed("runtimeRuns", { tenantId: "tenant-a", memorySpaceId: "space-a", runId: "run-" + id, conversationEpoch: 1 });
    f.db.seed("runtimeTranscriptMessages", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "conversation-a", nativeMessageId: "native-" + id,
      ownerPrincipalId: f.principal._id, sourceId: id, sourceEventId: "event-" + id, revision: 1, role, approved: true, sourceContentHash: contentHash,
      runId: "run-" + id, contextSourceWitnesses: witnesses });
    return f.db.seed("runtimeMemorySources", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id,
      lineage: { sourceId: id, sourceEventId: "event-" + id, sourceRevision: 1, role, trust: role === "user" ? "user_assertion" : "assistant_claim" },
      content: "Controlled source " + id, contentHash, createdAt: 1000, contextSourceWitnesses: witnesses,
      transcriptOrigin: { conversationId: "conversation-a", conversationEpoch: 1, nativeMessageId: "native-" + id } }) as unknown as Doc<"runtimeMemorySources">;
  };
  const a = makeSource("a"), b = makeSource("b"), left = makeSource("left", [a]), right = makeSource("right", [a, b]);
  const first = makeSource("first", [left, right]), second = makeSource("second", [right, a]);
  return { ...f, conversation, makeSource, a, b, left, right, first, second };
}
type Fixture = ReturnType<typeof setup>;
function observe(f: Fixture) {
  const physical: { table: string; index: string; limit: number; rows: number; identity: string }[] = [];
  const query = f.db.query.bind(f.db);
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const builder = query(table), withIndex = builder.withIndex, take = builder.take, selectors: [string, unknown][] = []; let index = "";
    builder.withIndex = (name, callback) => { index = name; return withIndex(name, q => {
      const tracked: { eq(key: string, value: unknown): typeof tracked } = { eq: (key, value) => { selectors.push([key, value]); q.eq(key, value); return tracked; } };
      return callback(tracked);
    }); };
    builder.take = async limit => { const rows = await take(limit); physical.push({ table, index, limit, rows: rows.length, identity: JSON.stringify([table, index, selectors, limit]) }); return rows; };
    return builder;
  });
  return physical;
}
const graphTables = new Set(["runtimeMemorySources", "runtimeConversations", "runtimeTranscriptMessages", "runtimeRuns"]);
const read = (ctx: MutationCtx, f: Fixture, source: Doc<"runtimeMemorySources">, permission: "canViewMemories" | "canViewFacts" = "canViewMemories") =>
  managedSourceIsCurrent(ctx, f.reference, source, "read", permission);
async function outcome(work: () => Promise<unknown>) {
  try { return { result: await work() }; } catch (error) { return { error: error instanceof Error ? error.message : error, data: error && typeof error === "object" && "data" in error ? error.data : undefined }; }
}

describe("closed invocation-local managed-source raw rows", () => {
  it("requires explicit opt-in, preserves four exact bounded lookups and detached values", async () => {
    const f = setup(), physical = observe(f);
    const calls = (ctx: MutationCtx) => Promise.all([
      readManagedSourceRows(ctx, "tenant-a", "space-a", "a"), readManagedConversationRows(ctx, "tenant-a", "space-a", "conversation-a"),
      readManagedTranscriptBridgeRows(ctx, "tenant-a", "space-a", "native-a"), readManagedSourceRunRows(ctx, "tenant-a", "space-a", "run-a"),
    ]);
    const plain = createV8AuthorityReadScope(f.ctx); await calls(plain); await calls(plain); expect(physical).toHaveLength(8);
    physical.length = 0; const scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    const first = await calls(scoped), second = await calls(scoped); expect(physical).toHaveLength(4); expect(first).toEqual(second); expect(first[0]).not.toBe(second[0]);
    first[0][0]!.content = "detached"; expect((await calls(scoped))[0][0]!.content).toBe("Controlled source a");
    expect(physical.map(row => [row.table, row.index, row.limit])).toEqual([["runtimeMemorySources", "by_scope_source", 2], ["runtimeConversations", "by_scoped_id", 2], ["runtimeTranscriptMessages", "by_native", 2], ["runtimeRuns", "by_scoped_id", 2]]);
    expect(createV8AuthorityReadScope(scoped, { managedSources: true })).toBe(scoped);
    physical.length = 0; await calls(createAuthorityReadScope(f.ctx)); await calls(createAuthorityReadScope(f.ctx)); expect(physical).toHaveLength(8);
  });
  it("shares only graph rows with the same-owner source view, leaving original authority reads uncached", async () => {
    const f = setup(), parent = createV8AuthorityReadScope(f.ctx, { managedSources: true }), view = withManagedSourceReads(f.ctx, parent);
    const get = jest.spyOn(f.db, "get"), requirement = { capability: "read" as const, tenantId: "tenant-a", memorySpaceId: "space-a" };
    await recheckAuthority(view, f.reference, requirement); const first = get.mock.calls.length; await recheckAuthority(view, f.reference, requirement); expect(get.mock.calls.length).toBe(2 * first);
    expect(withManagedSourceReads({ ...f.ctx }, parent)).not.toBe(view);
    expect(withManagedSourceReads(f.ctx, createV8AuthorityReadScope(f.ctx))).toBe(f.ctx);
    f.grant.revokedAt = 1000; await expect(recheckAuthority(view, f.reference, requirement)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
  it("actual shared/distinct ancestor traversals preserve results and non-graph order with fewer physical rows", async () => {
    const f = setup(), physical = observe(f), check = async (ctx: MutationCtx) => [await read(ctx, f, f.first), await read(ctx, f, f.second), await read(ctx, f, f.first, "canViewFacts")];
    const before = structuredClone(f.db.rows), original = await check(f.ctx), baseline = [...physical]; physical.length = 0;
    const scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true }), optimized = await check(withManagedSourceReads(f.ctx, scoped));
    expect(optimized).toEqual(original); expect(optimized).toEqual([true, true, true]); expect(f.db.rows).toEqual(before); expect(f.db.writes).toBe(0);
    expect(physical.filter(row => !graphTables.has(row.table))).toEqual(baseline.filter(row => !graphTables.has(row.table)));
    const originalGraph = baseline.filter(row => graphTables.has(row.table)), scopedGraph = physical.filter(row => graphTables.has(row.table));
    expect(scopedGraph.length).toBeLessThan(originalGraph.length); expect(scopedGraph.reduce((sum, r) => sum + r.rows, 0)).toBeLessThan(originalGraph.reduce((sum, r) => sum + r.rows, 0));
    expect(new Set(scopedGraph.map(row => row.identity)).size).toBe(scopedGraph.length);
    expect(new Set(scopedGraph.map(row => row.identity))).toEqual(new Set(originalGraph.map(row => row.identity)));
    console.info(JSON.stringify({ type: "controlled-managed-source-graph-reads", originalGraphQueries: originalGraph.length, scopedGraphQueries: scopedGraph.length,
      originalGraphDocuments: originalGraph.reduce((sum, r) => sum + r.rows, 0), scopedGraphDocuments: scopedGraph.reduce((sum, r) => sum + r.rows, 0), nativeProof: false }));
  });
  it.each(["content-edit", "revision", "owner", "conversation-delete", "bridge-delete", "run-delete", "duplicate-conversation", "duplicate-bridge", "duplicate-run", "duplicate-source", "grant-revoke", "source-tombstone"])("fresh source fence preserves original %s outcome", async fault => {
    const f = setup(), scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true }), view = withManagedSourceReads(f.ctx, scoped); expect(await read(view, f, f.first)).toBe(true);
    if (fault === "content-edit") f.a.contentHash = "changed";
    if (fault === "revision") f.a.lineage.sourceRevision = 2;
    if (fault === "owner") f.a.ownerPrincipalId = "foreign";
    if (fault === "conversation-delete") f.conversation.tombstonedAt = 1000;
    if (fault === "bridge-delete") f.db.table("runtimeTranscriptMessages")[0]!.tombstonedAt = 1000;
    if (fault === "run-delete") f.db.table("runtimeRuns")[0]!.tombstonedAt = 1000;
    if (fault.startsWith("duplicate-")) { const table = { "duplicate-conversation": "runtimeConversations", "duplicate-bridge": "runtimeTranscriptMessages", "duplicate-run": "runtimeRuns", "duplicate-source": "runtimeMemorySources" }[fault]; if (table) f.db.seed(table, { ...f.db.table(table)[0], _id: table + ":duplicate" }); }
    if (fault === "grant-revoke") f.grant.revokedAt = 1000;
    if (fault === "source-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "a", deletedAt: 1000 });
    freshManagedSourceReads(view); const optimized = await outcome(() => read(view, f, f.first)), original = await outcome(() => read(f.ctx, f, f.first));
    expect(optimized).toEqual(original); expect(optimized).not.toEqual({ result: true });
  });
  it("cached raw conversation still reruns real-clock retention and grant expiry predicates", async () => {
    const f = setup(); f.conversation.retentionUntil = 1010; f.grant.expiresAt = 1010;
    const parent = createV8AuthorityReadScope(f.ctx, { managedSources: true }), view = withManagedSourceReads(f.ctx, parent); expect(await read(view, f, f.first)).toBe(true);
    jest.spyOn(Date, "now").mockReturnValue(1010); expect(await outcome(() => read(view, f, f.first))).toEqual(await outcome(() => read(f.ctx, f, f.first))); expect(await read(view, f, f.first)).toBe(false);
  });
  it.each(["insert", "patch", "replace"] as const)("%s invalidates run rows before/after including original V8 state-retention writes", async method => {
    const f = setup(), scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true }); await readManagedSourceRunRows(scoped, "tenant-a", "space-a", "run-a");
    const row = f.db.table("runtimeRuns")[0]!, id = row._id as Id<"runtimeRuns">;
    // These two ports exercise writer epochs on the controlled partial rows,
    // rather than claiming native schema validation of the fixture itself.
    const rawWriter = scoped.db as unknown as Pick<typeof f.db, "insert" | "replace">;
    if (method === "insert") await rawWriter.insert("runtimeRuns", { ...row, runId: "run-a" });
    if (method === "patch") await scoped.db.patch("runtimeRuns", id, { tombstonedAt: 1000 });
    if (method === "replace") await rawWriter.replace("runtimeRuns", id, { ...row, tombstonedAt: 1000 });
    const rows = await readManagedSourceRunRows(scoped, "tenant-a", "space-a", "run-a"); expect(method === "insert" ? rows.length : rows[0]?.tombstonedAt).toBe(method === "insert" ? 2 : 1000);
  });
  it("finite entry/byte bounds fall through without new refusal or retained oversized bodies", async () => {
    const f = setup(), physical = observe(f), scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    for (let i = 0; i < MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES; i++) await readManagedSourceRows(scoped, "tenant-a", "space-a", "missing-" + i);
    const before = physical.length; await readManagedSourceRows(scoped, "tenant-a", "space-a", "overflow"); await readManagedSourceRows(scoped, "tenant-a", "space-a", "overflow"); expect(physical.length - before).toBe(2);
    const oversized = createV8AuthorityReadScope(f.ctx, { managedSources: true }); f.a.content = "x".repeat(MANAGED_SOURCE_READ_SCOPE_MAX_BYTES);
    const previous = physical.length; await readManagedSourceRows(oversized, "tenant-a", "space-a", "a"); await readManagedSourceRows(oversized, "tenant-a", "space-a", "a"); expect(physical.length - previous).toBe(2);
  });
});

describe("exact V8 writer graph retention", () => {
  const retainedTables = ["runtimeAgentExecutions", "runtimeAgentOperations", "runtimeRunOutbox",
    "runtimeBudgetAccounts", "runtimeModelOperations", "runtimeModelAttempts"] as const;
  const families = (ctx: MutationCtx) => Promise.all([
    readManagedSourceRows(ctx, "tenant-a", "space-a", "a"),
    readManagedConversationRows(ctx, "tenant-a", "space-a", "conversation-a"),
    readManagedTranscriptBridgeRows(ctx, "tenant-a", "space-a", "native-a"),
    readManagedSourceRunRows(ctx, "tenant-a", "space-a", "run-a"),
  ]);
  it.each(retainedTables)("%s updates retain unchanged raw graph and rerun actual source predicates", async table => {
    const f = setup(), physical = observe(f), row = f.db.seed(table, { state: "ready" });
    const parent = createV8AuthorityReadScope(f.ctx, { managedSources: true }), view = withNativeSnapshotReads(f.ctx, parent);
    const expected = await families(view); expect(await read(view, f, f.first)).toBe(true);
    const before = physical.filter(row => graphTables.has(row.table)).length;
    await (view.db as unknown as typeof f.db).patch(table, row._id, { state: "running" });
    expect(await families(view)).toEqual(expected); expect(await read(view, f, f.first)).toBe(true);
    expect(physical.filter(row => graphTables.has(row.table))).toHaveLength(before);
    expect(await (view.db as unknown as typeof f.db).get(table, row._id)).toMatchObject({ state: "running" });
    // Re-evaluate the clock predicate over retained raw conversation rows.
    freshManagedSourceReads(view); f.conversation.retentionUntil = 1010;
    expect(await read(view, f, f.first)).toBe(true); jest.spyOn(Date, "now").mockReturnValue(1010);
    expect(await read(view, f, f.first)).toBe(false);
  });
  it("run updates evict the whole run family and retain independent source/conversation/bridge rows", async () => {
    const f = setup(), physical = observe(f), view = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    const expected = await families(view);
    await readManagedSourceRunRows(view, "tenant-a", "space-a", "run-b");
    await readManagedSourceRunRows(view, "tenant-a", "space-a", "missing"); physical.length = 0;
    const a = f.db.table("runtimeRuns")[0]!;
    await view.db.patch("runtimeRuns", a._id as Id<"runtimeRuns">, { tombstonedAt: 1000 });
    const current = await families(view);
    expect(current.slice(0, 3)).toEqual(expected.slice(0, 3)); expect(current[3][0]).toMatchObject({ tombstonedAt: 1000 });
    expect(await readManagedSourceRunRows(view, "tenant-a", "space-a", "run-b")).toHaveLength(1);
    expect(await readManagedSourceRunRows(view, "tenant-a", "space-a", "missing")).toEqual([]);
    expect(physical.map(row => row.table)).toEqual(["runtimeRuns", "runtimeRuns", "runtimeRuns"]);
    expect(await read(view, f, f.first)).toBe(false);
  });
  it("retained graph rows do not cache a running memory_remember operation's eligibility", async () => {
    const f = setup(), physical = observe(f), operation = f.db.seed("runtimeAgentOperations", {
      tenantId: "tenant-a", memorySpaceId: "space-a", operationId: "remember-a", toolName: "memory_remember", state: "started",
    });
    const source = f.db.seed("runtimeMemorySources", { ...f.first, _id: "runtimeMemorySources:tool",
      lineage: { sourceId: "tool", sourceEventId: "event-tool", sourceRevision: 1, role: "tool", trust: "verified_tool_evidence", operationId: "remember-a" },
      transcriptOrigin: undefined,
    }) as unknown as Doc<"runtimeMemorySources">;
    const view = withNativeSnapshotReads(f.ctx, createV8AuthorityReadScope(f.ctx, { managedSources: true }));
    expect(await read(view, f, source)).toBe(false);
    expect(await managedSourceIsCurrent(view, f.reference, source, "write")).toBe(true);
    const before = physical.filter(row => graphTables.has(row.table)).length;
    await view.db.patch("runtimeAgentOperations", operation._id as Id<"runtimeAgentOperations">, { state: "complete" });
    expect(await read(view, f, source)).toBe(true);
    expect(physical.filter(row => graphTables.has(row.table))).toHaveLength(before);
    expect(physical.filter(row => row.table === "runtimeAgentOperations")).toHaveLength(3);
  });
  it("explicit freshness and non-V8 scopes still clear every raw graph family", async () => {
    const f = setup(), physical = observe(f), view = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    await families(view); freshManagedSourceReads(view); await families(view); expect(physical).toHaveLength(8);
    const normal = createMemorySourceReadScope(f.ctx), row = f.db.seed("runtimeAgentOperations", { state: "ready" });
    await families(normal); physical.length = 0;
    await (normal.db as unknown as typeof f.db).patch("runtimeAgentOperations", row._id, { state: "running" });
    await families(normal); expect(physical.map(row => row.table)).toEqual([...graphTables]);
  });
  it.each(["source", "bridge", "grant"] as const)("retained control rows do not mask a later %s edit/revocation", async kind => {
    const f = setup(), view = withNativeSnapshotReads(f.ctx, createV8AuthorityReadScope(f.ctx, { managedSources: true }));
    expect(await read(view, f, f.first)).toBe(true);
    const state = f.db.seed("runtimeAgentExecutions", { state: "ready" }), db = view.db as unknown as typeof f.db;
    await db.patch("runtimeAgentExecutions", state._id, { state: "running" }); expect(await read(view, f, f.first)).toBe(true);
    if (kind === "source") await db.patch("runtimeMemorySources", f.a._id, { contentHash: "edited" });
    if (kind === "bridge") await db.patch("runtimeTranscriptMessages", f.db.table("runtimeTranscriptMessages")[0]!._id, { tombstonedAt: 1000 });
    if (kind === "grant") await db.patch("runtimeAuthGrants", f.grant._id, { revokedAt: 1000 });
    const actual = await outcome(() => read(view, f, f.first));
    expect(actual).toEqual(await outcome(() => read(f.ctx, f, f.first))); expect(actual).not.toEqual({ result: true });
  });
  it("a rejected exact writer clears all graph rows and preserves the original error", async () => {
    const f = setup(), physical = observe(f), row = f.db.seed("runtimeAgentOperations", { state: "ready" });
    const failure = Error("EXACT_STATE_WRITER_FAILED"), view = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    await families(view); physical.length = 0;
    jest.spyOn(f.db, "patch").mockRejectedValueOnce(failure);
    await expect((view.db as unknown as typeof f.db).patch("runtimeAgentOperations", row._id, { state: "running" })).rejects.toBe(failure);
    await families(view); expect(physical.map(row => row.table)).toEqual([...graphTables]);
  });
  it.each(["unknown-table", "missing-normalizer"] as const)("%s clears every graph family rather than assuming a safe writer", async kind => {
    const f = setup(), physical = observe(f), row = f.db.seed("runtimeAgentOperations", { state: "ready" });
    const view = createV8AuthorityReadScope(f.ctx, { managedSources: true }); await families(view); physical.length = 0;
    const db = view.db as unknown as typeof f.db;
    if (kind === "unknown-table") await db.insert("facts", { factId: "unrelated" });
    else {
      Object.defineProperty(f.db, "normalizeId", { configurable: true, value: undefined });
      await db.patch("runtimeAgentOperations", row._id, { state: "running" });
    }
    await families(view); expect(physical.map(row => row.table)).toEqual([...graphTables]);
  });
  it("retained writers suppress hits in flight without replacing the retained pre-write rows", async () => {
    const f = setup(), physical = observe(f), row = f.db.seed("runtimeAgentOperations", { state: "ready" });
    const view = createV8AuthorityReadScope(f.ctx, { managedSources: true }); await families(view);
    let releaseWriter!: () => void, enteredWriter!: () => void;
    const entered = new Promise<void>(resolve => { enteredWriter = resolve; }), gate = new Promise<void>(resolve => { releaseWriter = resolve; });
    const patch = f.db.patch.bind(f.db);
    jest.spyOn(f.db, "patch").mockImplementation(async (...args) => { enteredWriter(); await gate; await patch(...args); });
    const writing = (view.db as unknown as typeof f.db).patch("runtimeAgentOperations", row._id, { state: "running" }); await entered;
    const before = physical.length; expect(await families(view)).toHaveLength(4); expect(physical.length - before).toBe(4);
    releaseWriter(); await writing; const completed = physical.length; await families(view); expect(physical).toHaveLength(completed);
  });
  it("a late raw graph read cannot repopulate after a retained writer epoch", async () => {
    const f = setup(), row = f.db.seed("runtimeAgentOperations", { state: "ready" });
    const view = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    let releaseRead!: () => void, enteredRead!: () => void, first = true;
    const readEntered = new Promise<void>(resolve => { enteredRead = resolve; }), readGate = new Promise<void>(resolve => { releaseRead = resolve; });
    const query = f.db.query.bind(f.db);
    const reads = jest.spyOn(f.db, "query").mockImplementation(table => { const builder = query(table), take = builder.take;
      builder.take = async cap => { const rows = await take(cap); if (first) { first = false; enteredRead(); await readGate; } return rows; }; return builder; });
    const reading = readManagedSourceRows(view, "tenant-a", "space-a", "a"); await readEntered;
    await (view.db as unknown as typeof f.db).patch("runtimeAgentOperations", row._id, { state: "complete" });
    releaseRead(); await reading;
    await readManagedSourceRows(view, "tenant-a", "space-a", "a"); expect(reads).toHaveBeenCalledTimes(2);
  });
  it("fluent writers clear all graph rows instead of inferring a retained table", async () => {
    const f = setup(), physical = observe(f), parent = { ...f.ctx, db: f.db } as unknown as MutationCtx;
    const table = f.db.table.bind(f.db), fluent = { patch: async function(this: unknown) { expect(this).toBe(fluent); } };
    const view = createV8AuthorityReadScope(parent, { managedSources: true }); await families(view); physical.length = 0;
    Object.defineProperty(f.db, "table", { configurable: true, value: () => fluent });
    await (view.db as unknown as { table(name: string): typeof fluent }).table("runtimeAgentOperations").patch();
    Object.defineProperty(f.db, "table", { configurable: true, value: table });
    await families(view); expect(physical.map(row => row.table)).toEqual([...graphTables]);
  });
});

describe("managed-source writer epochs and native isolation", () => {
  it("errors are never cached and exact raw exception identity survives", async () => {
    const f = setup(), query = f.db.query.bind(f.db), failure = new Error("CONTROLLED_GRAPH_READ"); let fail = true, reads = 0;
    jest.spyOn(f.db, "query").mockImplementation(table => { const b = query(table); if (table === "runtimeConversations") { const take = b.take;
      b.take = async limit => { reads++; if (fail) { fail = false; throw failure; } return take(limit); }; } return b; });
    const scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    await expect(readManagedConversationRows(scoped, "tenant-a", "space-a", "conversation-a")).rejects.toBe(failure);
    expect(await readManagedConversationRows(scoped, "tenant-a", "space-a", "conversation-a")).toHaveLength(1); expect(reads).toBe(2);
  });
  it.each([false, true])("child mutation invalidates graph on success/failure=%s with the original receiver", async failing => {
    const f = setup(), failure = new Error("CONTROLLED_CHILD_WRITE"), ctx = { ...f.ctx, marker: "native-owner", runMutation: async function(this: { marker: string }) {
      expect(this.marker).toBe("native-owner"); f.a.contentHash = "child-edit"; if (failing) throw failure; return null;
    } };
    const scoped = createV8AuthorityReadScope(ctx, { managedSources: true }), view = withManagedSourceReads(ctx, scoped);
    expect((await readManagedSourceRows(view, "tenant-a", "space-a", "a"))[0]?.contentHash).toBe(f.a.contentHash);
    const writing = view.runMutation(); if (failing) await expect(writing).rejects.toBe(failure); else await writing;
    expect((await readManagedSourceRows(view, "tenant-a", "space-a", "a"))[0]?.contentHash).toBe("child-edit");
    const freshChild = { ...ctx }; expect(withManagedSourceReads(freshChild, scoped)).toBe(freshChild);
  });
  it.each([false, true])("in-flight state writer suppresses reuse and clears late results after failure=%s", async failing => {
    const f = setup(), patch = f.db.patch.bind(f.db), failure = new Error("CONTROLLED_LATE_WRITE"); let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    jest.spyOn(f.db, "patch").mockImplementation(async (table, id, value) => { entered(); await gate; await patch(table, id, value); if (failing) throw failure; });
    const scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true }), row = f.db.table("runtimeRuns")[0]!;
    await readManagedSourceRunRows(scoped, "tenant-a", "space-a", "run-a");
    const writing = scoped.db.patch("runtimeRuns", row._id as Id<"runtimeRuns">, { tombstonedAt: 1000 }); void writing.catch(() => {}); await started;
    expect((await readManagedSourceRunRows(scoped, "tenant-a", "space-a", "run-a"))[0]?.tombstonedAt).toBeUndefined();
    release(); if (failing) await expect(writing).rejects.toBe(failure); else await writing;
    expect((await readManagedSourceRunRows(scoped, "tenant-a", "space-a", "run-a"))[0]?.tombstonedAt).toBe(1000);
    expect(await read(scoped, f, f.first)).toBe(false);
  });
  it("late pre-write raw reads cannot repopulate a completed writer epoch", async () => {
    const f = setup(), query = f.db.query.bind(f.db); let entered!: () => void, release!: () => void, first = true;
    const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    jest.spyOn(f.db, "query").mockImplementation(table => { const b = query(table); if (table === "runtimeRuns") { const take = b.take;
      b.take = async limit => { const rows = await take(limit); if (first) { first = false; entered(); await gate; } return rows; }; } return b; });
    const scoped = createV8AuthorityReadScope(f.ctx, { managedSources: true }), row = f.db.table("runtimeRuns")[0]!;
    const reading = readManagedSourceRunRows(scoped, "tenant-a", "space-a", "run-a"); await started;
    await scoped.db.patch("runtimeRuns", row._id as Id<"runtimeRuns">, { tombstonedAt: 1000 }); release(); await reading;
    expect((await readManagedSourceRunRows(scoped, "tenant-a", "space-a", "run-a"))[0]?.tombstonedAt).toBe(1000);
  });
  it("fresh invocations and explicit reset re-read rows rather than transfer parent state across RPC", async () => {
    const f = setup(), parent = createV8AuthorityReadScope(f.ctx, { managedSources: true }); await readManagedSourceRows(parent, "tenant-a", "space-a", "a");
    f.a.contentHash = "new-native-snapshot";
    expect((await readManagedSourceRows(createV8AuthorityReadScope({ ...f.ctx }, { managedSources: true }), "tenant-a", "space-a", "a"))[0]?.contentHash).toBe("new-native-snapshot");
    freshManagedSourceReads(parent); expect((await readManagedSourceRows(parent, "tenant-a", "space-a", "a"))[0]?.contentHash).toBe("new-native-snapshot");
  });
  it("a graph-only view deletion invalidates shared parent rows and retains native writer receiver", async () => {
    const f = setup();
    const db = Object.assign(f.db, { delete: async function(this: typeof f.db, table: string, id: string) {
      expect(this).toBe(f.db); const rows = this.table(table), index = rows.findIndex(row => row._id === id);
      if (index < 0) throw new Error("Missing controlled row"); rows.splice(index, 1); this.writes++;
    } });
    const parent = createV8AuthorityReadScope(f.ctx, { managedSources: true }), view = withManagedSourceReads(f.ctx, parent);
    expect(await readManagedSourceRunRows(parent, "tenant-a", "space-a", "run-a")).toHaveLength(1);
    await view.db.delete("runtimeRuns", db.table("runtimeRuns")[0]!._id as Id<"runtimeRuns">);
    expect(await readManagedSourceRunRows(parent, "tenant-a", "space-a", "run-a")).toEqual([]);
    expect(await read(view, f, f.first)).toBe(false);
  });
});

// K27 compares with the accepted K26 graph-only view above, not an older raw path.
describe("fresh traversal-local authority rows", () => {
  it.each([true, false])("same exact raw identity set with shared ancestry=%s and fresh outer source fences", async shared => {
    const f = setup();
    const { withManagedSourceValidationReads } = await import("../../../convex-dev/runtimeAuth");
    const end = shared ? f.first : f.makeSource("distinct", [f.makeSource("distinct-leaf")]);
    const queries = observe(f), get = f.db.get.bind(f.db), gets: string[] = [];
    jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { gets.push(JSON.stringify([table, id])); return get(table, id); });
    const baseline = withManagedSourceReads(f.ctx, createV8AuthorityReadScope(f.ctx, { managedSources: true }));
    const original = [await read(baseline, f, f.first), await read(baseline, f, end)];
    const originalGets = [...gets], originalQueries = [...queries]; gets.length = 0; queries.length = 0;
    const view = withManagedSourceValidationReads(f.ctx, createV8AuthorityReadScope(f.ctx, { managedSources: true }));
    expect([await read(view, f, f.first), await read(view, f, end)]).toEqual(original);
    expect(new Set(gets)).toEqual(new Set(originalGets));
    expect(new Set(queries.map(row => row.identity))).toEqual(new Set(originalQueries.map(row => row.identity)));
    expect(gets.length).toBeLessThan(originalGets.length / 2);
    expect(queries.filter(row => !row.table.startsWith("runtimeAuth"))).toEqual(originalQueries.filter(row => !row.table.startsWith("runtimeAuth")));
    const optimizedGets = gets.length, optimizedQueries = queries.length;
    // A later logical traversal is a fresh authority fence even without a writer.
    f.grant.revokedAt = 1000; await expect(read(view, f, end)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(0);
    console.info(JSON.stringify({ type: "k27-traversal-raw-reads", shared, baselineGets: originalGets.length, optimizedGets,
      baselineQueries: originalQueries.length, optimizedQueries, nativeLatency: "UNAVAILABLE" }));
  });
  it("graph-only/unbranded and wrong-owner contexts do not acquire a traversal reader", async () => {
    const f = setup(), auth = await import("../../../convex-dev/runtimeAuth"), parent = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    expect(auth.withManagedSourceValidationReads({ ...f.ctx }, parent).db).toBe(f.ctx.db);
    const view = withManagedSourceReads(f.ctx, parent); expect(auth.freshManagedSourceValidation(view)).toBe(view);
    expect(auth.freshManagedSourceValidation(f.ctx)).toBe(f.ctx);
    const current = auth.withManagedSourceValidationReads(f.ctx, parent);
    expect(auth.freshManagedSourceValidation(current)).not.toBe(current);
  });
  it.each(["success", "error", "pending"])("a %s sibling writer invalidates/suppresses every live traversal reader", async mode => {
    const f = setup(), auth = await import("../../../convex-dev/runtimeAuth");
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const patch = f.db.patch.bind(f.db);
    jest.spyOn(f.db, "patch").mockImplementation(async (...args) => {
      await patch(...args); if (mode === "pending") await wait; if (mode === "error") throw Error("WRITER_FAILED");
    });
    const parent = createV8AuthorityReadScope(f.ctx, { managedSources: true }), traversal = auth.freshManagedSourceValidation(auth.withManagedSourceValidationReads(f.ctx, parent));
    const requirement = { capability: "read" as const, tenantId: "tenant-a", memorySpaceId: "space-a" };
    await recheckAuthority(traversal, f.reference, requirement);
    const issued = parent.db.patch("runtimeAuthGrants", f.grant._id as Id<"runtimeAuthGrants">, { revokedAt: 1000 });
    const settled = issued.catch(error => { if (mode !== "error") throw error; expect(error).toEqual(Error("WRITER_FAILED")); });
    try { await expect(recheckAuthority(traversal, f.reference, requirement)).rejects.toThrow("FORBIDDEN"); }
    finally { release(); await settled; }
    await expect(recheckAuthority(traversal, f.reference, requirement)).rejects.toThrow("FORBIDDEN");
  });
});

// K29 retains raw authority across synchronous original traversals in one native
// snapshot. The accepted K28 graph/traversal view above remains the control.
describe("explicit native snapshot validator views", () => {
  it.each([true, false])("actual full source predicates retain exact identities with shared ancestry=%s", async shared => {
    const f = setup(), end = shared ? f.second : f.makeSource("other", [f.makeSource("other-leaf")]);
    const physical = observe(f), get = f.db.get.bind(f.db), gets: string[] = [];
    jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { gets.push(JSON.stringify([table, id])); return get(table, id); });
    const validate = async (ctx: MutationCtx) => [await read(ctx, f, f.first), await read(ctx, f, end), await read(ctx, f, f.first, "canViewFacts")];
    const control = withManagedSourceValidationReads(f.ctx, createV8AuthorityReadScope(f.ctx, { managedSources: true }));
    const original = await validate(control), originalGets = gets.splice(0), originalQueries = physical.splice(0);
    const before = structuredClone(f.db.rows), parent = createV8AuthorityReadScope(f.ctx, { managedSources: true });
    const current = await validate(withNativeSnapshotReads(f.ctx, parent));
    expect(current).toEqual(original); expect(current).toEqual([true, true, true]); expect(f.db.rows).toEqual(before); expect(f.db.writes).toBe(0);
    expect(new Set(gets)).toEqual(new Set(originalGets)); expect(new Set(physical.map(r => r.identity))).toEqual(new Set(originalQueries.map(r => r.identity)));
    expect(physical.filter(r => !r.table.startsWith("runtimeAuth"))).toEqual(originalQueries.filter(r => !r.table.startsWith("runtimeAuth")));
    expect(gets.length).toBeLessThan(originalGets.length); expect(physical.length).toBeLessThan(originalQueries.length);
    console.info(JSON.stringify({ type: "k29-native-snapshot-source-reads", shared, originalGets: originalGets.length, currentGets: gets.length,
      originalQueries: originalQueries.length, currentQueries: physical.length, uniqueGetIdentities: new Set(gets).size,
      uniqueQueryIdentities: new Set(physical.map(r => r.identity)).size, nativeLatency: "NOT_RUN" }));
  });
  it("wrong-owner, serialized, unscoped and already-scoped contexts retain their original fallback", async () => {
    const f = setup(), parent = createMemorySourceReadScope(f.ctx), other = { ...f.ctx };
    expect(withNativeSnapshotReads(f.ctx, f.ctx)).toBe(f.ctx);
    expect(withNativeSnapshotReads(other, parent)).toBe(other);
    expect(withNativeSnapshotReads(parent, parent)).toBe(parent);
    expect(withNativeSnapshotReads(f.ctx, JSON.parse(JSON.stringify(parent)) as MutationCtx)).toBe(f.ctx);
    const view = withNativeSnapshotReads(f.ctx, parent);
    expect(view).not.toBe(f.ctx); expect(Object.getOwnPropertySymbols(view).length).toBeGreaterThan(0);
    expect(Object.getOwnPropertySymbols(view).every(symbol => !Object.getOwnPropertyDescriptor(view, symbol)?.enumerable)).toBe(true);
    expect(await read(view, f, f.first)).toBe(true);
    f.grant.revokedAt = 1000;
    await expect(read(withNativeSnapshotReads(other, parent), f, f.first)).rejects.toThrow("FORBIDDEN");
    await expect(read(f.ctx, f, f.first)).rejects.toThrow("FORBIDDEN");
  });
  it.each(["grant-revoke", "source-edit", "source-delete", "conversation-delete", "bridge-delete", "run-delete", "duplicate-source", "source-tombstone"])("an original %s writer clears shared raw rows and preserves refusal", async fault => {
    const f = setup(), parent = createV8AuthorityReadScope(f.ctx, { managedSources: true }), view = withNativeSnapshotReads(f.ctx, parent);
    expect(await read(view, f, f.first)).toBe(true);
    const writer = view.db as unknown as Pick<typeof f.db, "patch" | "insert">;
    if (fault === "grant-revoke") await writer.patch("runtimeAuthGrants", f.grant._id, { revokedAt: 1000 });
    if (fault === "source-edit") await writer.patch("runtimeMemorySources", f.a._id, { contentHash: "changed" });
    if (fault === "source-delete") await writer.patch("runtimeMemorySources", f.a._id, { tombstonedAt: 1000 });
    if (fault === "conversation-delete") await writer.patch("runtimeConversations", f.conversation._id, { tombstonedAt: 1000 });
    if (fault === "bridge-delete") await writer.patch("runtimeTranscriptMessages", f.db.table("runtimeTranscriptMessages")[0]!._id, { tombstonedAt: 1000 });
    if (fault === "run-delete") await writer.patch("runtimeRuns", f.db.table("runtimeRuns")[0]!._id, { tombstonedAt: 1000 });
    if (fault === "duplicate-source") await writer.insert("runtimeMemorySources", { ...f.a, _id: "runtimeMemorySources:duplicate" });
    if (fault === "source-tombstone") await writer.insert("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "a", deletedAt: 1000 });
    expect(await outcome(() => read(view, f, f.first))).toEqual(await outcome(() => read(f.ctx, f, f.first)));
    expect(await outcome(() => read(view, f, f.first))).not.toEqual({ result: true });
  });
  it.each(["grant", "retention"])("raw retention never caches the original clock-dependent %s predicate", async kind => {
    const f = setup(); if (kind === "grant") f.grant.expiresAt = 1010; else f.conversation.retentionUntil = 1010;
    const view = withNativeSnapshotReads(f.ctx, createMemorySourceReadScope(f.ctx)); expect(await read(view, f, f.first)).toBe(true);
    jest.spyOn(Date, "now").mockReturnValue(1010);
    expect(await outcome(() => read(view, f, f.first))).toEqual(await outcome(() => read(f.ctx, f, f.first)));
    expect(await outcome(() => read(view, f, f.first))).not.toEqual({ result: true });
  });
  it.each([false, true])("pending unknown child writers suppress raw reuse and preserve rollback/error=%s", async fail => {
    const f = setup(), error = Error("CHILD_ROLLBACK"), get = jest.spyOn(f.db, "get"); let entered!: () => void, release!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    const native = { ...f.ctx, runMutation: async () => { entered(); await gate; if (fail) throw error; return null; } } as unknown as MutationCtx;
    const parent = createMemorySourceReadScope(native), view = withNativeSnapshotReads(native, parent);
    expect(await read(view, f, f.first)).toBe(true); const before = get.mock.calls.length;
    const writing = view.runMutation(makeFunctionReference<"mutation">("controlled:write"), {}); void writing.catch(() => {}); await enteredPromise;
    expect(await read(view, f, f.first)).toBe(true); expect(await read(view, f, f.first)).toBe(true);
    expect(get.mock.calls.length).toBeGreaterThan(before + 6);
    release(); if (fail) await expect(writing).rejects.toBe(error); else await writing;
    const after = get.mock.calls.length; expect(await read(view, f, f.first)).toBe(true); expect(get.mock.calls.length).toBeGreaterThan(after);
  });
});
