/** Actual registered private V8 pipeline with controlled DB/component ports; no hosted/model claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { DerivedFact } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE as profile } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { assertNativeArgs } from "../runtimeAgent/native-arguments";
const auth = await import("../../../convex-dev/runtimeAuth");
let reuse = true, finalFences = 0;
let atFinalFence: (() => void) | undefined;
const guards: unknown[] = [];
const branches = new Map<string, unknown[]>();
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...auth,
  // Only this new terminal route is disabled. All existing raw readers stay on.
  readV8ConversationRows: async (...args: Parameters<typeof auth.readV8ConversationRows>) => reuse ? auth.readV8ConversationRows(...args)
    : await args[0].db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", args[1]).eq("memorySpaceId", args[2]).eq("conversationId", args[3])).take(2),
  recheckAuthority: async (...args: Parameters<typeof auth.recheckAuthority>) => {
    const guard = [args[1], args[2]], branch = new Error().stack?.split("\n").find(line => line.includes("/convex-dev/") && !line.includes("/runtimeAuth.ts:") && !line.includes("ConvexMemoryRepository.authority "))?.trim() ?? "direct";
    guards.push(guard); const ordered = branches.get(branch) ?? []; ordered.push(guard); branches.set(branch, ordered);
    return auth.recheckAuthority(...args);
  },
  freshManagedSourceReads: <Ctx>(ctx: Ctx): Ctx => { finalFences++; atFinalFence?.(); return auth.freshManagedSourceReads(ctx); },
}));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:conversation-read"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { runs, definitions, transcript, clone, clock } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const recall = await import("../../../convex-dev/runtimeAgentRecall");
const { ConvexMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const { explicitSourceLineage } = await import("../../../convex-dev/runtimeMemoryServices");
const { fixture: metadataFixture } = await import("../runtimeMetadataAuth/fixture");
beforeEach(() => { installIngestionMockRoot(); reuse = true; finalFences = 0; atFinalFence = undefined; guards.length = 0; branches.clear(); jest.spyOn(performance, "now").mockReturnValue(0); });
afterEach(() => { jest.restoreAllMocks(); });

async function fixture(indexed = true) {
  const f = await ingestionFixture(), writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db), scope = memoryScope(f.reference);
  for (let index = 0; index < (indexed ? 2 : 0); index++) {
    const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, `conversation-read-${index}`), `Fruit apricot preference ${index}`, { now: () => clock });
    await writer.putSource(prepared.source); await ingestion.enqueueSourceEvent(f.ctx, f.reference, prepared.source);
    const source = { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1 };
    const identity = { ...source, stage: "facts" as const, semanticPolicyVersion: "conversation-read-v1" };
    const fact: DerivedFact = { _id: "", factId: `conversation-fact-${index}`, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
      ownerPrincipalId: scope.principalId, lineage: prepared.source.lineage, extractionPolicyVersion: "conversation-read-v1", fact: `Fruit apricot preference ${index}`,
      factType: "preference", confidence: 90, sourceType: "manual", tags: [], version: 1, createdAt: clock, updatedAt: clock };
    await writer.commitDerived({ source, identity, chunks: prepared.chunks, facts: [fact], expectedFactVersions: { [fact.factId]: 0 },
      vectors: [{ ...source, vectorId: `conversation-vector-${index}`, chunkId: prepared.chunks[0]!.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
        profile, embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0), processingReceiptId: await processingIdentityKey(identity) }] });
  }
  for (const event of f.db.table("runtimeIngestionEvents")) Object.assign(event, { factsState: "complete", vectorsState: "complete", vectorProfilesComplete: [profile.profileId] });
  const oldQuery = f.ctx.runQuery.bind(f.ctx), oldMutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  const modules = { runtimeAgent: agent, runtimeAgentRecall: recall, runs };
  const lookup = (ref: Parameters<typeof getFunctionName>[0]) => {
    let name: string; try { name = getFunctionName(ref); } catch { return; }
    const [module, method] = name.split(":"); if (!(module in modules)) return;
    const value = (modules[module as keyof typeof modules] as Record<string, unknown>)[method!]; return value ? { name, value } : undefined;
  };
  f.ctx.runQuery = (async (ref, args) => { const found = lookup(ref); if (!found) return oldQuery(ref, args);
    calls.push(found.name); assertNativeArgs(found.value, args); return invoke(found.value, f.ctx, args); }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => { const found = lookup(ref); if (!found) return oldMutation(ref, args);
    calls.push(found.name); assertNativeArgs(found.value, args); return f.call(found.value, args); }) as MutationCtx["runMutation"];
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "conversation-read-v8", expectedPreviousVersion: 0,
    definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, handlerId: "cortex.transcript.relevant", handlerVersion: 2,
      registryHash: await definitions.executableRegistryHashV4(), inputSelection: { version: 2 } } } });
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request(), agentId: published.agentId, agentVersion: published.version,
    parts: [{ type: "text", text: "Fruit apricot preference" }], memory: { effort: "normal" } } });
  await f.call(agent.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions").find(row => row.runId === run.runId)!;
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
  await f.call(agent.startContext, attempt);
  const hits = f.db.table("runtimeMemoryVectors").map(row => ({ _id: row._id as Id<"runtimeMemoryVectors">, _score: 0.9 }));
  const action = { ...f.ctx, vectorSearch: async () => hits } as unknown as ActionCtx;
  const state = () => clone({ rows: f.db.rows, writes: f.db.writes, sequence: f.db.sequence, native: f.native, effects: f.effects, scheduled: f.scheduled });
  const restore = (value: ReturnType<typeof state>) => { f.db.rows = clone(value.rows); f.db.writes = value.writes; f.db.sequence = value.sequence;
    Object.assign(f.native, clone(value.native)); Object.assign(f.effects, value.effects); f.scheduled.splice(0, f.scheduled.length, ...clone(value.scheduled)); };
  const perform = () => agent.prepareContextV8Handler(action, attempt, async (_repository, input, selection) => {
    if (!selection) throw Error("Private native selection required");
    return recall.finishAgentRecallV8(action, attempt, { now: () => clock }, input, profile,
      { profile, vectors: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)] }, selection, clock);
  }, true);
  return { ...f, get grant() { return f.grant; }, state, restore, perform, calls, attempt, action };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function observe(f: Fixture) {
  const query = f.db.query.bind(f.db), get = f.db.get.bind(f.db), reads: unknown[][] = [];
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { reads.push(["get", table, id]); return get(table, id); });
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const b = query(table), keys: unknown[] = []; let index = "";
    for (const method of ["withIndex", "withSearchIndex"] as const) {
      const original = b[method].bind(b);
      b[method] = (name, callback) => { index = name; return original(name, q => {
        if (q === null || typeof q !== "object") throw Error("Original index builder required");
        const traced: object = new Proxy(q, { get(target, key) { const value: unknown = Reflect.get(target, key, target);
          if (typeof value !== "function") return value;
          return (...args: unknown[]) => { keys.push([String(key), ...args]); const result: unknown = Reflect.apply(value, target, args); return result === target ? traced : result; };
        } }); return callback(traced);
      }); };
    }
    const unique = b.unique.bind(b), take = b.take.bind(b), collect = b.collect.bind(b);
    b.unique = async () => { reads.push(["unique", table, index, keys]); return unique(); };
    b.take = async n => { reads.push(["take", table, index, keys, n, f.calls.at(-1)]); return take(n); };
    b.collect = async () => { reads.push(["collect", table, index, keys]); return collect(); }; return b;
  });
  const isRoot = (row: unknown[]) => row[0] === "take" && row[1] === "runtimeConversations" && row[2] === "by_scoped_id";
  return { reads, roots: () => reads.filter(isRoot), others: () => reads.filter(row => !isRoot(row)), clear: () => { reads.length = 0; guards.length = 0; branches.clear(); finalFences = 0; f.calls.length = 0; } };
}
async function outcome(work: () => Promise<unknown>) {
  try { return { result: await work() }; }
  catch (error) { return { error: error instanceof Error ? { name: error.name, message: error.message, data: "data" in error ? error.data : undefined } : error }; }
}

it.each([false, true])("registered pipeline indexed=%s retains output/body/state/effects/ordered guards and every noncanonical read", async indexed => {
  const f = await fixture(indexed), seen = observe(f), base = f.state(); seen.clear(); reuse = false;
  const original = await f.perform(), after = f.state(), predicates = clone(guards), otherReads = clone(seen.others()), reads = clone(seen.roots()), calls = [...f.calls];
  const fences = finalFences; f.restore(base); seen.clear(); reuse = true;
  const actual = await f.perform();
  expect(actual).toEqual(original); expect(f.state()).toEqual(after); expect(guards).toEqual(predicates);
  expect(seen.others()).toEqual(otherReads); expect(f.calls).toEqual(calls); expect(finalFences).toBe(fences);
  expect(actual).toMatchObject({ state: "started" }); if (actual?.state !== "started" || original?.state !== "started") throw Error("Native candidate required");
  expect(actual.op.nativeRequestCanonical).toBe(original.op.nativeRequestCanonical);
  expect(seen.roots().length).toBeLessThan(reads.length); expect(new Set(seen.roots().map(row => JSON.stringify(row)))).toEqual(new Set(reads.map(row => JSON.stringify(row))));
  expect([reads.length, seen.roots().length, finalFences]).toEqual(indexed ? [30, 5, 1] : [20, 2, 0]);
  if (indexed) expect(seen.roots().filter(row => row[5] === "runtimeAgentRecall:readMatchesAndDeliveryV8")).toHaveLength(2);
  expect(seen.roots().every(row => row[4] === 2)).toBe(true);
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  console.info(JSON.stringify({ type: "private-canonical-conversation", indexed, originalCanonicalTakes: reads.length, reusedCanonicalTakes: seen.roots().length,
    noncanonicalReads: otherReads.length, originalByStage: Object.fromEntries(calls.map(call => [call, reads.filter(row => row[5] === call).length])), reusedByStage: Object.fromEntries(calls.map(call => [call, seen.roots().filter(row => row[5] === call).length])), finalColdFences: fences, exactOutputBodyStateEffectsOrderedGuards: true, inferenceCalls: 0, hostedLatency: "NOT_RUN" }));
});
it.each(["grant", "lease", "cancel", "conversation-epoch", "conversation-tombstone", "conversation-duplicate", "source-revision", "account"] as const)("registered %s negative retains exact outcome, state and branch-ordered predicates", async fault => {
  const f = await fixture(), base = f.state(), results: unknown[] = [], ordered: unknown[] = [], counts: string[][] = [];
  for (const enabled of [false, true]) {
    f.restore(base); reuse = enabled; const conversation = f.db.table("runtimeConversations")[0]!;
    if (fault === "grant") f.grant.revokedAt = clock;
    if (fault === "lease") f.attempt.leaseVersion++;
    if (fault === "cancel") f.db.table("runtimeRuns")[0]!.cancellationRequestedAt = clock;
    if (fault === "conversation-epoch") conversation.epoch = 2;
    if (fault === "conversation-tombstone") conversation.tombstonedAt = clock;
    if (fault === "conversation-duplicate") f.db.seed("runtimeConversations", { ...conversation, _id: "runtimeConversations:duplicate" });
    if (fault === "source-revision") (f.db.table("runtimeMemorySources")[0]!.lineage as { sourceRevision: number }).sourceRevision++;
    guards.length = 0; branches.clear(); const result = await outcome(async () => {
      const prepared = await f.perform();
      if (fault !== "account") return prepared;
      if (prepared?.state !== "started") throw Error("Native candidate required before financial admission");
      const account = f.db.table("runtimeBudgetAccounts").find(row => row._id === prepared.current.run.runAccountId);
      expect(account).toBeDefined(); account!.reservedUnits = account!.limitUnits;
      return await f.call(agent.admitPreparedModelOperationV8, { ...f.attempt, operationId: prepared.op.operationId, ordinal: 0,
        requestCanonical: prepared.op.nativeRequestCanonical!, snapshotCanonical: canonicalModelJson(prepared.governedResolution.snapshot),
        bindingCanonical: canonicalModelJson({ reference: f.reference, operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId, semanticId: prepared.op.semanticId, ordinal: 0 }) });
    });
    if (!["source-revision", "account"].includes(fault)) expect(result).toHaveProperty("error");
    if (fault === "account") expect(result).toHaveProperty("error.data.code", "BUDGET_EXCEEDED");
    results.push({ result, state: f.state() }); ordered.push(clone([...branches].sort(([a], [b]) => a.localeCompare(b))));
    counts.push(guards.map(value => JSON.stringify(value)).sort()); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    if (fault === "lease") f.attempt.leaseVersion--;
  }
  expect(results[1]).toEqual(results[0]); expect(ordered[1]).toEqual(ordered[0]); expect(counts[1]).toEqual(counts[0]);
});
it.each(["conversation", "source", "grant"] as const)("the original cold final-delivery %s fence is still effective", async fault => {
  const f = await fixture(), base = f.state(), results: unknown[] = [];
  for (const enabled of [false, true]) {
    f.restore(base); reuse = enabled; let reached = 0;
    atFinalFence = () => { reached++; if (fault === "conversation") f.db.table("runtimeConversations")[0]!.tombstonedAt = clock;
      else if (fault === "source") f.db.table("runtimeMemorySources")[0]!.tombstonedAt = clock; else f.grant.revokedAt = clock; };
    const result = await outcome(f.perform); expect(reached).toBe(1); expect(result).toHaveProperty("error");
    results.push({ result, state: f.state() }); expect(f.db.table("runtimeModelAttempts")).toEqual([]); atFinalFence = undefined;
  }
  expect(results[1]).toEqual(results[0]);
});

function rawFixture() {
  const f = metadataFixture({ space: "space-a" });
  const row = f.db.seed("runtimeConversations", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "conversation-a", legacyConversationId: "alias-a",
    ownerPrincipalId: f.reference.principalId, participants: [f.reference.principalId], epoch: 1, visibility: "private", retentionUntil: clock + 10 });
  const query = f.db.query.bind(f.db), takes: { index: string; n: number }[] = [], constraints: unknown[][] = [];
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const b = query(table), original = b.withIndex; let index = "";
    b.withIndex = (name, callback) => { index = name; return original(name, q => callback({ eq(key, value) { constraints.push([table, name, key, value]); q.eq(key, value); return this; } })); };
    const take = b.take; b.take = async n => { if (table === "runtimeConversations") takes.push({ index, n }); return take(n); }; return b;
  });
  const scoped = () => auth.createV8AuthorityReadScope(f.ctx, { managedSources: true });
  const read = (ctx: Pick<MutationCtx, "db">, id = "conversation-a") => transcript.conversationById(ctx, f.reference, id);
  return { ...f, row, takes, constraints, scoped, read };
}
describe("closed private owner and original canonical/alias operations", () => {
  it("executes original index predicates on every call, detaches rows and shares only the existing bounded raw family", async () => {
    const f = rawFixture(), ctx = f.scoped();
    const first = (await f.read(ctx))!; first.participants.push("poison");
    expect((await f.read(ctx))!.participants).toEqual([f.reference.principalId]);
    expect(f.takes).toEqual([{ index: "by_scoped_id", n: 2 }]);
    expect(f.constraints).toEqual([...Array.from({ length: 2 }, () => [
      ["runtimeConversations", "by_scoped_id", "tenantId", "tenant-a"], ["runtimeConversations", "by_scoped_id", "memorySpaceId", "space-a"],
      ["runtimeConversations", "by_scoped_id", "conversationId", "conversation-a"],
    ])].flat());
    expect(await auth.readManagedConversationRows(ctx, "tenant-a", "space-a", "conversation-a")).toHaveLength(1); expect(f.takes).toHaveLength(1);
  });
  it("public/v7/default/spread/prototype/wrong-owner and the real empty-save snapshot view retain physical canonical reads", async () => {
    const f = rawFixture(), owner = f.scoped();
    const contexts = [f.ctx, auth.createAuthorityReadScope(f.ctx), auth.createMemorySourceReadScope(f.ctx), auth.createV8AuthorityReadScope(f.ctx),
      { ...owner }, Object.create(owner) as MutationCtx, { ...owner, db: f.ctx.db }, auth.withNativeSnapshotReads(f.ctx, owner)];
    for (const ctx of contexts) { const count = f.takes.length; await f.read(ctx); await f.read(ctx); expect(f.takes.length - count).toBe(2); }
    const count = f.takes.length; await f.read(owner); await f.read(owner); expect(f.takes.length - count).toBe(1);
  });
  it("alias fallback remains a physical take(2) on every lookup and canonical presence retains first refusal", async () => {
    const f = rawFixture(), ctx = f.scoped(); expect((await f.read(ctx, "alias-a"))!._id).toBe(f.row._id); await f.read(ctx, "alias-a");
    expect(f.takes).toEqual([{ index: "by_scoped_id", n: 2 }, { index: "by_scoped_alias", n: 2 }, { index: "by_scoped_alias", n: 2 }]);
    f.row.legacyConversationId = "conversation-a"; f.db.seed("runtimeConversations", { ...f.row, _id: "runtimeConversations:duplicate" });
    const fresh = f.scoped(); await expect(f.read(fresh)).rejects.toMatchObject({ data: { code: "TRANSCRIPT_CONFLICT" } });
    expect(f.takes.at(-1)).toEqual({ index: "by_scoped_id", n: 2 });
    await expect(f.read(fresh, "conversation-a")).rejects.toMatchObject({ data: { code: "TRANSCRIPT_CONFLICT" } });
  });
  it("duplicate alias and original query errors remain failures, errors are never retained", async () => {
    const f = rawFixture(); f.db.seed("runtimeConversations", { ...f.row, conversationId: "other", _id: "runtimeConversations:other" });
    await expect(f.read(f.scoped(), "alias-a")).rejects.toMatchObject({ data: { code: "TRANSCRIPT_CONFLICT" } });
    const query = jest.mocked(f.db.query).getMockImplementation()!, failure = Error("ORIGINAL_TAKE_ERROR"); let first = true;
    jest.spyOn(f.db, "query").mockImplementation(table => { const b = query(table), take = b.take; b.take = async n => { if (first) { first = false; throw failure; } return take(n); }; return b; });
    const ctx = f.scoped(); await expect(f.read(ctx)).rejects.toBe(failure); expect((await f.read(ctx))!._id).toBe(f.row._id);
  });
  it("tenant and space keys remain isolated, absent rows are invalidated by insert and reset/new owners are cold", async () => {
    const f = rawFixture(), ctx = f.scoped();
    expect(await auth.readV8ConversationRows(ctx, "tenant-b", "space-a", "conversation-a")).toEqual([]);
    expect(await auth.readV8ConversationRows(ctx, "tenant-a", "space-b", "conversation-a")).toEqual([]);
    expect(await f.read(ctx, "new")).toBeUndefined(); await ctx.db.insert("runtimeConversations", { ...f.row, conversationId: "new" } as never);
    expect((await f.read(ctx, "new"))!.conversationId).toBe("new");
    await f.read(ctx); f.row.epoch = 2; expect((await f.read(ctx))!.epoch).toBe(1);
    expect((await f.read(f.scoped()))!.epoch).toBe(2); auth.freshManagedSourceReads(ctx); expect((await f.read(ctx))!.epoch).toBe(2);
  });
  it.each(["retention", "grant"] as const)("a warm row still executes current %s predicates", async kind => {
    const f = rawFixture(); if (kind === "grant") f.grant.expiresAt = clock + 10;
    const ctx = f.scoped(); await transcript.checkConversation(ctx, f.reference, (await f.read(ctx))!, "read");
    jest.spyOn(Date, "now").mockReturnValue(clock + 10);
    await expect(transcript.checkConversation(ctx, f.reference, (await f.read(ctx))!, "read")).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});

describe("existing family bounds and writer fences on the new route", () => {
  it.each(["insert", "patch", "replace", "delete"] as const)("original %s conversation writer invalidates the canonical result", async method => {
    const f = rawFixture(); const _db = Object.assign(f.db, { delete: async (table: string, id: string) => { f.db.rows.set(table, f.db.table(table).filter(row => row._id !== id)); } });
    const ctx = f.scoped(); await f.read(ctx); const count = f.takes.length;
    if (method === "insert") await ctx.db.insert("runtimeConversations", { ...f.row, _id: "runtimeConversations:second" } as never);
    if (method === "patch") await ctx.db.patch("runtimeConversations", f.row._id as Id<"runtimeConversations">, { epoch: 2 });
    if (method === "replace") await ctx.db.replace("runtimeConversations", f.row._id as Id<"runtimeConversations">, { ...f.row, epoch: 2 } as never);
    if (method === "delete") await (ctx.db as unknown as typeof _db).delete("runtimeConversations", f.row._id);
    if (method === "insert") await expect(f.read(ctx)).rejects.toMatchObject({ data: { code: "TRANSCRIPT_CONFLICT" } });
    else expect((await f.read(ctx))?.epoch).toBe(method === "delete" ? undefined : 2);
    expect(f.takes.slice(count)).toEqual(method === "delete" ? [{ index: "by_scoped_id", n: 2 }, { index: "by_scoped_alias", n: 2 }] : [{ index: "by_scoped_id", n: 2 }]);
  });
  it.each([false, true])("pending unknown component writer suppresses reuse, then clears rows on failure=%s", async fail => {
    const f = rawFixture(), failure = Error("COMPONENT_WRITE_FAILED"); let entered!: () => void, release!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; }), wait = new Promise<void>(resolve => { release = resolve; });
    const native = { ...f.ctx, runMutation: async () => { entered(); await wait; f.row.epoch = 2; if (fail) throw failure; return null; } } as unknown as MutationCtx;
    const ctx = auth.createV8AuthorityReadScope(native, { managedSources: true }); await f.read(ctx);
    const writing = ctx.runMutation(makeFunctionReference<"mutation">("controlled:write"), {}); void writing.catch(() => {}); await enteredPromise;
    const before = f.takes.length; await f.read(ctx); await f.read(ctx); expect(f.takes.length - before).toBe(2);
    release(); if (fail) await expect(writing).rejects.toBe(failure); else await writing;
    expect((await f.read(ctx))!.epoch).toBe(2); expect(f.takes.length - before).toBe(3);
  });
  it("a late pre-write canonical take cannot populate across a retained control writer epoch", async () => {
    const f = rawFixture(), query = jest.mocked(f.db.query).getMockImplementation()!, state = f.db.seed("runtimeAgentOperations", { state: "ready" });
    let entered!: () => void, release!: () => void, first = true;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; }), wait = new Promise<void>(resolve => { release = resolve; });
    jest.spyOn(f.db, "query").mockImplementation(table => { const b = query(table), take = b.take;
      b.take = async n => { const rows = await take(n); if (first) { first = false; entered(); await wait; } return rows; }; return b; });
    const ctx = f.scoped(), reading = f.read(ctx); await enteredPromise;
    await ctx.db.patch("runtimeAgentOperations", state._id as Id<"runtimeAgentOperations">, { state: "complete" }); release(); await reading;
    await f.read(ctx); expect(f.takes).toHaveLength(2); await f.read(ctx); expect(f.takes).toHaveLength(2);
  });
  it("unknown fluent writer and failed retained writer clear the existing family", async () => {
    const f = rawFixture(), ctx = f.scoped(); await f.read(ctx);
    const table = f.db.table.bind(f.db), fluent = { patch: async () => {} };
    Object.defineProperty(f.db, "table", { configurable: true, value: () => fluent });
    await (ctx.db as unknown as { table(name: string): typeof fluent }).table("runtimeAgentOperations").patch();
    Object.defineProperty(f.db, "table", { configurable: true, value: table }); await f.read(ctx); expect(f.takes).toHaveLength(2);
    await expect(ctx.db.patch("runtimeAgentOperations", "runtimeAgentOperations:absent" as Id<"runtimeAgentOperations">, { state: "complete" })).rejects.toThrow("Missing row");
    await f.read(ctx); expect(f.takes).toHaveLength(3);
  });
  it("shares the existing entry cap with other raw families and does not retain oversize rows", async () => {
    const f = rawFixture(), ctx = f.scoped();
    for (let n = 0; n < auth.MANAGED_SOURCE_READ_SCOPE_MAX_ENTRIES; n++) await auth.readManagedSourceRows(ctx, "tenant-a", "space-a", String(n));
    await f.read(ctx); await f.read(ctx); expect(f.takes).toHaveLength(2);
    const fresh = f.scoped(); f.row.participants = ["x".repeat(auth.MANAGED_SOURCE_READ_SCOPE_MAX_BYTES)];
    const before = f.takes.length; await f.read(fresh); await f.read(fresh); expect(f.takes.length - before).toBe(2);
  });
});
