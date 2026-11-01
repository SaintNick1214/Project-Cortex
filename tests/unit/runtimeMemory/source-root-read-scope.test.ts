/** Original registered handlers and source predicates on controlled native ports. No hosted timing claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { ContextSourceWitness } from "../../../src/domain/context-witness";
import { fixture as metadataFixture } from "../runtimeMetadataAuth/fixture";
import { assertNativeArgs } from "../runtimeAgent/native-arguments";
const auth = await import("../../../convex-dev/runtimeAuth");
let rootReuse = true;
let afterRootRead: ((ctx: Parameters<typeof auth.readManagedSourceUniqueRow>[0], sourceId: string) => Promise<void>) | undefined;
const predicates: unknown[] = [];
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...auth,
  readManagedSourceUniqueRow: async (...args: Parameters<typeof auth.readManagedSourceUniqueRow>) => {
    const row = rootReuse ? await auth.readManagedSourceUniqueRow(...args)
      : await args[0].db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", args[1]).eq("memorySpaceId", args[2]).eq("lineage.sourceId", args[3])).unique();
    await afterRootRead?.(args[0], args[3]); return row;
  },
  recheckAuthority: async (...args: Parameters<typeof auth.recheckAuthority>) => {
    predicates.push(["authority", args[1], args[2]]); return auth.recheckAuthority(...args);
  },
}));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:source-root"; }
} }));
const { ingestionFixture, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { definitions, runs, transcript, clone, clock } = await import("../runtimeTranscript/fixture");
const { ConvexMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
const agent = await import("../../../convex-dev/runtimeAgent");
beforeEach(() => { installIngestionMockRoot(); rootReuse = true; afterRootRead = undefined; predicates.length = 0; });
afterEach(() => { jest.restoreAllMocks(); });
const raw = (ctx: Pick<MutationCtx, "db">, id = "source", tenant = "tenant-a", space = "space-a") => auth.readManagedSourceUniqueRow(ctx, tenant, space, id);
function sourceFixture(shared = false) {
  const f = metadataFixture({ space: "space-a", access: shared ? "space" : "own" });
  const owner = shared ? "owner:other" : f.principal._id;
  const conversation = f.db.seed("runtimeConversations", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "conversation",
    ownerPrincipalId: owner, epoch: 1, participants: [], visibility: "private" });
  const run = f.db.seed("runtimeRuns", { tenantId: "tenant-a", memorySpaceId: "space-a", runId: "run", conversationEpoch: 1 });
  const bridge = f.db.seed("runtimeTranscriptMessages", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "conversation",
    nativeMessageId: "native", ownerPrincipalId: owner, sourceId: "source", sourceEventId: "event", revision: 1, role: "user", approved: true, sourceContentHash: "a".repeat(64), runId: "run" });
  const source = f.db.seed("runtimeMemorySources", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: owner,
    lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" },
    content: "Original source", contentHash: "a".repeat(64), createdAt: clock,
    transcriptOrigin: { conversationId: "conversation", conversationEpoch: 1, nativeMessageId: "native" } });
  const share = f.db.seed("runtimeConversationShares", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "conversation", state: "active",
    grantType: "user", grantedTo: f.principal._id, viewCount: 0, expiresAt: clock + 100,
    permissions: { canView: true, canViewMemories: true, canViewFacts: false } });
  const db = Object.assign(f.db, { delete: async (table: string, id: string) => {
    const rows = f.db.table(table), index = rows.findIndex(row => row._id === id); if (index < 0) throw Error("Missing row"); rows.splice(index, 1); f.db.writes++;
  } });
  const scope = auth.createV8AuthorityReadScope(f.ctx, { managedSources: true });
  return { ...f, db, source, bridge, conversation, run, share, scope,
    repository: new ConvexMemoryRepository(scope, f.reference, "read") };
}
function observeUnique(db: ReturnType<typeof sourceFixture>["db"]) {
  const query = db.query.bind(db), reads: { table: string; index?: string; keys: unknown[]; method: string }[] = [];
  jest.spyOn(db, "query").mockImplementation(table => {
    const b = query(table), withIndex = b.withIndex, unique = b.unique, take = b.take;
    const record = { table, keys: [] as unknown[], method: "" } as typeof reads[number];
    b.withIndex = (index, callback) => { record.index = index; return withIndex(index, q => callback({ eq: (key, value) => {
      record.keys.push([key, value]); q.eq(key, value); return q;
    } })); };
    b.unique = async () => { record.method = "unique"; reads.push(record); return unique(); };
    b.take = async n => { record.method = `take:${n}`; reads.push(record); return take(n); }; return b;
  });
  return { reads, roots: () => reads.filter(row => row.table === "runtimeMemorySources" && row.method === "unique") };
}
async function failure(work: () => Promise<unknown>) {
  try { return { result: await work() }; } catch (error) {
    return { error: error instanceof Error ? { name: error.name, message: error.message, data: "data" in error ? error.data : undefined } : error };
  }
}

describe("private original-unique root read", () => {
  it("default, public, ingestion and wrong-owner contexts retain original reads; exact-owner views share only V8 raw rows", async () => {
    const f = sourceFixture(), seen = observeUnique(f.db);
    for (const ctx of [f.ctx, auth.createAuthorityReadScope(f.ctx), auth.createMemorySourceReadScope(f.ctx), auth.createV8AuthorityReadScope(f.ctx),
      auth.withNativeSnapshotReads({ ...f.ctx }, f.scope), { ...f.scope }]) {
      const start = seen.roots().length; await raw(ctx); await raw(ctx); expect(seen.roots().length - start).toBe(2);
    }
    const start = seen.roots().length;
    const views = [f.scope, auth.withManagedSourceReads(f.ctx, f.scope), auth.withManagedSourceValidationReads(f.ctx, f.scope), auth.withNativeSnapshotReads(f.ctx, f.scope)];
    for (const ctx of views) expect(await raw(ctx)).toMatchObject({ content: "Original source" });
    expect(seen.roots().length - start).toBe(1);
    expect(Object.getOwnPropertySymbols(f.scope).every(key => !Object.getOwnPropertyDescriptor(f.scope, key)?.enumerable)).toBe(true);
    expect(JSON.stringify(f.scope)).not.toContain("source.unique");
  });
  it("keys tenant/space/source exactly and detaches first and retained raw returns", async () => {
    const f = sourceFixture(), seen = observeUnique(f.db);
    f.db.seed("runtimeMemorySources", { ...f.source, _id: "runtimeMemorySources:tenant", tenantId: "tenant-b", content: "Other tenant" });
    f.db.seed("runtimeMemorySources", { ...f.source, _id: "runtimeMemorySources:space", memorySpaceId: "space-b", content: "Other space" });
    const first = await raw(f.scope); first!.content = "poison"; first!.lineage.sourceRevision = 2;
    expect(await raw(f.scope)).toMatchObject({ content: "Original source", lineage: { sourceRevision: 1 } });
    expect((await raw(f.scope, "source", "tenant-b"))?.content).toBe("Other tenant");
    expect((await raw(f.scope, "source", "tenant-a", "space-b"))?.content).toBe("Other space");
    expect(await raw(f.scope, "missing")).toBeNull(); expect(await raw(f.scope, "missing")).toBeNull(); expect(seen.roots()).toHaveLength(4);
  });
  it("take(2) and unique never share a cardinality result, and original duplicate/query exceptions are uncached", async () => {
    const f = sourceFixture(); f.db.seed("runtimeMemorySources", { ...f.source, _id: "runtimeMemorySources:duplicate" });
    expect(await auth.readManagedSourceRows(f.scope, "tenant-a", "space-a", "source")).toHaveLength(2);
    const original = await failure(() => raw(f.ctx)); expect(await failure(() => raw(f.scope))).toEqual(original);
    f.db.table("runtimeMemorySources").pop(); expect(await raw(f.scope)).toMatchObject({ content: "Original source" });
    const query = f.db.query.bind(f.db), error = Error("ORIGINAL_UNIQUE_FAILURE"); let fails = true, count = 0;
    jest.spyOn(f.db, "query").mockImplementation(table => { const b = query(table), unique = b.unique;
      b.unique = async () => { count++; if (fails) throw error; return unique(); }; return b; });
    auth.freshManagedSourceReads(f.scope); await expect(raw(f.scope)).rejects.toBe(error); await expect(raw(f.scope)).rejects.toBe(error);
    fails = false; expect(await raw(f.scope)).toMatchObject({ content: "Original source" }); expect(count).toBe(3);
  });
  it("shares the existing entry and byte ceiling across root and ancestry operations", async () => {
    const f = sourceFixture(), seen = observeUnique(f.db);
    for (let i = 0; i < auth.MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES - 1; i++) await auth.readManagedSourceRows(f.scope, "tenant-a", "space-a", `missing:${i}`);
    await raw(f.scope, "last"); await raw(f.scope, "last"); expect(seen.roots()).toHaveLength(1);
    await raw(f.scope, "overflow"); await raw(f.scope, "overflow"); expect(seen.roots()).toHaveLength(3);
    f.source.content = "x".repeat(auth.MANAGED_SOURCE_READ_SCOPE_MAX_BYTES); auth.freshManagedSourceReads(f.scope);
    await raw(f.scope); await raw(f.scope); expect(seen.roots()).toHaveLength(5);
  });
  it("cached absence is invalidated by insert and fresh native owners/post-I/O fences reread", async () => {
    const f = sourceFixture(), seen = observeUnique(f.db); expect(await raw(f.scope, "new")).toBeNull();
    await (f.scope.db as unknown as typeof f.db).insert("runtimeMemorySources", { ...f.source, _id: "runtimeMemorySources:new", lineage: { ...f.source.lineage as object, sourceId: "new" } });
    expect(await raw(f.scope, "new")).toMatchObject({ lineage: { sourceId: "new" } });
    await raw(f.scope); f.source.content = "New snapshot";
    expect((await raw(auth.createV8AuthorityReadScope({ ...f.ctx }, { managedSources: true })))?.content).toBe("New snapshot");
    await Promise.resolve(); auth.freshManagedSourceReads(f.scope);
    expect((await raw(f.scope))?.content).toBe("New snapshot"); expect(seen.roots()).toHaveLength(5);
  });
  it.each(["patch", "replace", "delete"] as const)("original source %s invalidates raw root and preserves native result", async method => {
    const f = sourceFixture(); await raw(f.scope); const db = f.scope.db as unknown as typeof f.db;
    if (method === "delete") await db.delete("runtimeMemorySources", f.source._id);
    else await db[method]("runtimeMemorySources", f.source._id, method === "replace" ? { ...f.source, content: "Changed" } : { content: "Changed" });
    expect(await raw(f.scope)).toEqual(await raw(f.ctx)); expect((await raw(f.scope))?.content).toBe(method === "delete" ? undefined : "Changed");
  });
  it.each(["source", "bridge", "conversation", "run", "grant", "share"])("original %s writer still changes the actual getter outcome after a warm root", async kind => {
    const f = sourceFixture(kind === "share"); expect(await f.repository.getSource("source", "canViewMemories")).toMatchObject({ content: "Original source" });
    const pair = kind === "source" ? ["runtimeMemorySources", f.source] : kind === "bridge" ? ["runtimeTranscriptMessages", f.bridge]
      : kind === "conversation" ? ["runtimeConversations", f.conversation] : kind === "run" ? ["runtimeRuns", f.run]
        : kind === "grant" ? ["runtimeAuthGrants", f.grant] : ["runtimeConversationShares", f.share];
    await (f.scope.db as unknown as typeof f.db).patch(pair[0] as string, (pair[1] as { _id: string })._id,
      kind === "grant" || kind === "share" ? { revokedAt: clock } : { tombstonedAt: clock });
    const outcome = await failure(() => f.repository.getSource("source", "canViewMemories"));
    expect(outcome).toEqual(await failure(() => new ConvexMemoryRepository(f.ctx, f.reference, "read").getSource("source", "canViewMemories")));
    expect(outcome).toHaveProperty("error");
  });
  it.each([undefined, "canViewMemories"] as const)("%s warm permission cannot authorize facts, in either order or after expiry", async permission => {
    const f = sourceFixture(true), seen = observeUnique(f.db), deadlines: number[] = [];
    await expect(f.repository.getSource("source", "canViewFacts")).rejects.toThrow("FORBIDDEN");
    expect(await f.repository.getSource("source", permission, deadlines)).toMatchObject({ content: "Original source" });
    await expect(f.repository.getSource("source", "canViewFacts")).rejects.toThrow("FORBIDDEN");
    expect(deadlines).toContain(clock + 100); expect(seen.roots()).toHaveLength(1);
    jest.spyOn(Date, "now").mockReturnValue(clock + 100);
    await expect(f.repository.getSource("source", permission)).rejects.toThrow("FORBIDDEN");
    await expect(f.repository.getSource("source", "canViewFacts")).rejects.toThrow("FORBIDDEN"); expect(seen.roots()).toHaveLength(1);
  });
  it.each(["grant", "retention"])("a retained root reruns the current-clock %s expiry predicate", async kind => {
    const f = sourceFixture(); if (kind === "grant") f.grant.expiresAt = clock + 100; else f.conversation.retentionUntil = clock + 100;
    expect(await f.repository.getSource("source", "canViewMemories")).toMatchObject({ content: "Original source" });
    jest.spyOn(Date, "now").mockReturnValue(clock + 100);
    const outcome = await failure(() => f.repository.getSource("source", "canViewMemories")); expect(outcome).toHaveProperty("error");
    expect(outcome).toEqual(await failure(() => new ConvexMemoryRepository(f.ctx, f.reference, "read").getSource("source", "canViewMemories")));
  });
  it.each(["unknown", "fluent", "component"])("pending and failed %s writers suppress root reuse and clear late values", async route => {
    const f = sourceFixture(), seen = observeUnique(f.db), error = Error("ORIGINAL_WRITER_FAILURE");
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const write = async () => { entered(); await gate; f.source.content = "After writer"; throw error; };
    const native = { ...f.ctx, runMutation: write } as unknown as MutationCtx;
    const scope = auth.createV8AuthorityReadScope(native, { managedSources: true });
    if (route === "unknown") jest.spyOn(f.db, "patch").mockImplementation(write);
    if (route === "fluent") Object.defineProperty(f.db, "table", { configurable: true, value: (() => {
      const table = f.db.table.bind(f.db); return (name: string) => name === "fluent" ? { patch: write } : table(name);
    })() });
    await raw(scope);
    const pending = route === "component" ? scope.runMutation(makeFunctionReference<"mutation">("controlled:write"), {})
      : route === "unknown" ? scope.db.patch("runtimeConversations", f.conversation._id as Id<"runtimeConversations">, { tombstonedAt: clock })
        : (scope.db as unknown as { table(name: string): { patch(): Promise<unknown> } }).table("fluent").patch();
    void pending.catch(() => {}); await started;
    await raw(scope); await raw(scope); expect(seen.roots()).toHaveLength(3);
    release(); await expect(pending).rejects.toBe(error);
    expect((await raw(scope))?.content).toBe("After writer"); await raw(scope); expect(seen.roots()).toHaveLength(4);
  });
  it("a late original unique result cannot populate across a retained state-writer epoch", async () => {
    const f = sourceFixture(), query = f.db.query.bind(f.db), row = f.db.seed("runtimeAgentExecutions", { state: "ready" });
    let release!: () => void, entered!: () => void, count = 0;
    const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    jest.spyOn(f.db, "query").mockImplementation(table => { const b = query(table), unique = b.unique;
      if (table === "runtimeMemorySources") b.unique = async () => { const value = await unique(); count++; if (count === 1) { entered(); await gate; } return value; }; return b; });
    const reading = raw(f.scope); await started;
    await (f.scope.db as unknown as typeof f.db).patch("runtimeAgentExecutions", row._id, { state: "complete" }); release(); await reading;
    await raw(f.scope); await raw(f.scope); expect(count).toBe(2);
  });
});

async function registeredFixture() {
  const f = await ingestionFixture(), oldMutation = f.ctx.runMutation.bind(f.ctx), oldQuery = f.ctx.runQuery.bind(f.ctx);
  const resolve = (name: string) => name.startsWith("runtimeAgent:") ? agent[name.split(":")[1] as keyof typeof agent]
    : name.startsWith("runs:") ? runs[name.split(":")[1] as keyof typeof runs] : undefined;
  const calls: string[] = [];
  f.ctx.runMutation = (async (ref, args) => { let name = ""; try { name = getFunctionName(ref); } catch { return oldMutation(ref, args); }
    const target = resolve(name); if (target) { calls.push(name); assertNativeArgs(target, args); return f.call(target, args); } return oldMutation(ref, args);
  }) as MutationCtx["runMutation"];
  f.ctx.runQuery = (async (ref, args) => { let name = ""; try { name = getFunctionName(ref); } catch { return oldQuery(ref, args); }
    const target = resolve(name); if (target) { calls.push(name); assertNativeArgs(target, args); return invoke(target, f.ctx, args); } return oldQuery(ref, args);
  }) as MutationCtx["runQuery"];
  const source = await f.source("The saved reservation is confirmed", "source-root-registered");
  const witness: ContextSourceWitness = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId,
    sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash, permissions: ["canViewMemories", "canViewFacts"] };
  const conversation = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "source-root-history" });
  const row = f.db.table("runtimeConversations")[0]!; row.manualWriteLocked = false;
  for (const role of ["user", "assistant"] as const) await f.call(transcript.append, { conversationId: conversation.conversationId,
    expectedRevision: row.historyRevision, role, parts: [{ type: "text", text: role === "user" ? "Remember our reservation" : "The reservation is confirmed" }] });
  row.manualWriteLocked = true;
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "source-root-v8", expectedPreviousVersion: 0,
    definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, handlerId: "cortex.transcript.relevant", registryHash: await definitions.executableRegistryHashV3(),
      inputSelection: { version: 1, recentMessages: 4, relevantMemories: 4, relevantFacts: 4, pendingEntries: 4, maxMessages: 16 } } } });
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request("source-root-current", conversation.conversationId), agentId: published.agentId, agentVersion: published.version } });
  await f.call(agent.start, { runId: run.runId });
  const execution = f.db.table("runtimeAgentExecutions").find(value => value.runId === run.runId)!;
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: execution.leaseVersion as number };
  await f.call(agent.startContext, attempt);
  const current = await agent.executionContext(f.ctx, attempt);
  const historyPin = current.snapshot.messages.find(pin => !run.inputMessageIds.includes(pin.nativeMessageId))!;
  const bridge = f.db.table("runtimeTranscriptMessages").find(value => value.nativeMessageId === historyPin.nativeMessageId)!;
  Object.assign(bridge, { contextSourceWitnesses: [witness], runId: "history-owner", attemptNumber: 1 });
  f.db.seed("runtimeAgentExecutions", { tenantId: "tenant-a", memorySpaceId: "space-a", runId: "history-owner", attemptNumber: 1, state: "complete",
    sourceWitnesses: [witness], savedMessagePins: [{ id: historyPin.nativeMessageId, order: historyPin.order, stepOrder: historyPin.stepOrder, canonicalContentHash: historyPin.canonicalContentHash }] });
  execution.sourceWitnesses = [witness];
  const entry = { key: "memory:reservation", kind: "memory", text: source.content, relevance: 1 };
  const save = { ...attempt, context: entry.text, entries: [entry], witnesses: [witness], completeness: "complete" as const };
  const state = () => clone({ rows: f.db.rows, writes: f.db.writes, sequence: f.db.sequence, native: f.native, effects: f.effects, scheduled: f.scheduled });
  const restore = (value: ReturnType<typeof state>) => { f.db.rows = clone(value.rows); f.db.writes = value.writes; f.db.sequence = value.sequence;
    Object.assign(f.native, clone(value.native)); Object.assign(f.effects, value.effects); f.scheduled.splice(0, f.scheduled.length, ...clone(value.scheduled)); };
  return { ...f, get grant() { return f.grant; }, save, state, restore, calls, witness };
}
function registeredReads(f: Awaited<ReturnType<typeof registeredFixture>>) {
  const query = f.db.query.bind(f.db), get = f.db.get.bind(f.db), reads: unknown[][] = [], roots: unknown[][] = [];
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { reads.push(["get", table, id]); return get(table, id); });
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const b = query(table), withIndex = b.withIndex, unique = b.unique, take = b.take, collect = b.collect;
    const keys: unknown[] = []; let index = "";
    b.withIndex = (name, callback) => { index = name; return withIndex(name, q => {
      if (q === null || typeof q !== "object") throw Error("Original index required");
      const traced = new Proxy(q, { get(target, key) { const value: unknown = Reflect.get(target, key, target);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => { keys.push([String(key), ...args]); const value: unknown = Reflect.apply(Reflect.get(target, key) as (...args: unknown[]) => unknown, target, args); return value === target ? traced : value; };
      } }); return callback(traced);
    }); };
    b.unique = async () => { const record = ["unique", table, index, keys]; reads.push(record); if (table === "runtimeMemorySources") roots.push(record); return unique(); };
    b.take = async n => { reads.push(["take", table, index, keys, n]); return take(n); };
    b.collect = async () => { reads.push(["collect", table, index, keys]); return collect(); }; return b;
  });
  return { reads, roots, clear: () => { reads.length = 0; roots.length = 0; predicates.length = 0; },
    nonRoot: () => clone(reads.filter(row => !(row[0] === "unique" && row[1] === "runtimeMemorySources"))) };
}
it("registered saveAndPrepareContextV8 preserves full result/model body/state and ordered predicates with fewer root unique reads", async () => {
  const f = await registeredFixture(), before = f.state(), observed = registeredReads(f);
  const originalGetter = ConvexMemoryRepository.prototype.getSource;
  jest.spyOn(ConvexMemoryRepository.prototype, "getSource").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, ...args) {
    predicates.push(["getSource", args[0], args[1]]); return originalGetter.apply(this, args);
  });
  observed.clear(); rootReuse = false;
  const original = await f.call<Awaited<ReturnType<typeof agent.saveAndPrepareContextV8Handler>>>(agent.saveAndPrepareContextV8, f.save);
  const after = f.state(), originalPredicates = clone(predicates), originalNonRoot = observed.nonRoot(), originalRoots = clone(observed.roots);
  f.restore(before); observed.clear(); rootReuse = true;
  const actual = await f.call<Awaited<ReturnType<typeof agent.saveAndPrepareContextV8Handler>>>(agent.saveAndPrepareContextV8, f.save);
  expect(actual).toEqual(original); expect(f.state()).toEqual(after); expect(predicates).toEqual(originalPredicates); expect(observed.nonRoot()).toEqual(originalNonRoot);
  expect(actual).toMatchObject({ kind: "prepared", prepared: { state: "started" } });
  expect(actual.prepared.state).toBe("started"); if (actual.prepared.state !== "started") throw Error("Actual started candidate required");
  expect(actual.prepared.op.nativeRequestCanonical).toBe(original.prepared.state === "started" ? original.prepared.op.nativeRequestCanonical : undefined);
  expect(observed.roots.length).toBeLessThan(originalRoots.length);
  expect(new Set(observed.roots.map(row => JSON.stringify(row)))).toEqual(new Set(originalRoots.map(row => JSON.stringify(row))));
  expect(predicates).toContainEqual(["getSource", f.witness.sourceId, "canViewFacts"]); expect(predicates).toContainEqual(["getSource", f.witness.sourceId, "canViewMemories"]);
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(f.calls).not.toContain("runtimeAgent:prepareResolvedModelCandidateV8");
  console.info(JSON.stringify({ type: "source-root-registered-save-candidate", baselineRootUniqueReads: originalRoots.length, retainedRootUniqueReads: observed.roots.length,
    exactOutputModelStatePredicatesAndMutableReads: true, paidAttempts: 0, hostedLatency: "NOT_RUN" }));
});
it.each(["source", "grant", "lease", "pin", "duplicate"])("registered save/candidate preserves first %s refusal, full rollback and zero dispatch/attachment", async fault => {
  const f = await registeredFixture();
  if (fault === "source") f.db.table("runtimeMemorySources").find(row => (row.lineage as ContextSourceWitness).sourceId === f.witness.sourceId)!.tombstonedAt = clock;
  if (fault === "grant") f.grant.revokedAt = clock;
  if (fault === "lease") f.save.leaseVersion++;
  if (fault === "pin") f.native.messages.values().next().value!.message = { role: "user", content: "Changed" };
  if (fault === "duplicate") { const source = f.db.table("runtimeMemorySources").find(row => (row.lineage as ContextSourceWitness).sourceId === f.witness.sourceId)!;
    f.db.seed("runtimeMemorySources", { ...source, _id: "runtimeMemorySources:duplicate" }); }
  const before = f.state(), observed = registeredReads(f); observed.clear(); rootReuse = false;
  const original = await failure(() => f.call(agent.saveAndPrepareContextV8, f.save));
  expect(original).toHaveProperty("error"); expect(f.state()).toEqual(before); const order = clone(predicates);
  f.restore(before); observed.clear(); rootReuse = true;
  expect(await failure(() => f.call(agent.saveAndPrepareContextV8, f.save))).toEqual(original); expect(predicates).toEqual(order); expect(f.state()).toEqual(before);
  expect(f.db.table("runtimeAgentOperations")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  expect(f.calls.every(name => !/dispatch|attach|capture/iu.test(name))).toBe(true);
});
it.each(["source", "grant", "run", "bridge", "component"])("registered warmed root plus original %s writer preserves first refusal and atomic rollback", async fault => {
  const f = await registeredFixture(), nativeMutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => getFunctionName(ref) === "sourceRoot:controlledChild"
    ? f.db.patch("runtimeMemorySources", f.db.table("runtimeMemorySources").find(row => (row.lineage as ContextSourceWitness).sourceId === f.witness.sourceId)!._id, { tombstonedAt: clock })
    : nativeMutation(ref, args)) as MutationCtx["runMutation"];
  const before = f.state(), observed = registeredReads(f); let reads = 0, edits = 0;
  afterRootRead = async (ctx, sourceId) => {
    if (sourceId !== f.witness.sourceId || ++reads !== 3) return;
    edits++;
    if (fault === "component") { await (ctx as MutationCtx).runMutation(makeFunctionReference<"mutation">("sourceRoot:controlledChild"), {}); return; }
    const table = fault === "source" ? "runtimeMemorySources" : fault === "grant" ? "runtimeAuthGrants" : fault === "run" ? "runtimeRuns" : "runtimeTranscriptMessages";
    const row = f.db.table(table).find(value => fault === "source" ? (value.lineage as ContextSourceWitness).sourceId === f.witness.sourceId
      : fault === "run" ? value.runId === f.save.runId : true)!;
    await (ctx.db as unknown as typeof f.db).patch(table, row._id, fault === "grant" ? { revokedAt: clock } : { tombstonedAt: clock });
  };
  rootReuse = false; observed.clear();
  const original = await failure(() => f.call(agent.saveAndPrepareContextV8, f.save));
  expect(original).toHaveProperty("error"); expect(f.state()).toEqual(before); expect(edits).toBe(1);
  const order = clone(predicates); f.restore(before); observed.clear(); rootReuse = true; reads = 0; edits = 0;
  expect(await failure(() => f.call(agent.saveAndPrepareContextV8, f.save))).toEqual(original);
  expect(predicates).toEqual(order); expect(f.state()).toEqual(before); expect(edits).toBe(1);
  expect(f.db.table("runtimeAgentOperations")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  expect(f.calls.every(name => !/dispatch|attach|capture/iu.test(name))).toBe(true);
});
