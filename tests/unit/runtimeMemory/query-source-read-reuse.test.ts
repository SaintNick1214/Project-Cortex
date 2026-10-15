/** Registered native recall/candidate bodies; controlled DB/component ports, no model or hosted timing claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { DerivedFact } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE as profile } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { assertNativeArgs } from "../runtimeAgent/native-arguments";
const auth = await import("../../../convex-dev/runtimeAuth");
let reuse = true, finalFences = 0;
let atFinalFence: (() => void) | undefined;
const guards: unknown[] = [];
const guardBranches = new Map<string, unknown[]>();
function orderedBranchGuards() { return [...guardBranches].sort(([a], [b]) => a.localeCompare(b)); }
// Disable only the two newly routed terminal reads. getSource and every older
// scoped-reader mechanism remain active in both halves of the comparison.
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...auth,
  readManagedSourceUniqueRow: async (...args: Parameters<typeof auth.readManagedSourceUniqueRow>) => {
    const caller = new Error().stack?.split("\n").find(line => line.includes("ConvexMemoryRepository.")) ?? "";
    const candidate = /ConvexMemoryRepository\.(visibleSource|hydrateVectorCandidates)\b/.test(caller);
    return !reuse && candidate ? await args[0].db.query("runtimeMemorySources").withIndex("by_scope_source", q =>
      q.eq("tenantId", args[1]).eq("memorySpaceId", args[2]).eq("lineage.sourceId", args[3])).unique()
      : await auth.readManagedSourceUniqueRow(...args);
  },
  recheckAuthority: async (...args: Parameters<typeof auth.recheckAuthority>) => {
    const guard = ["authority", args[1], args[2]];
    // Existing parallel branches can interleave differently when a raw read
    // completes sooner. Keep each originating callsite's predicate order.
    const branch = new Error().stack?.split("\n").find(line => line.includes("/convex-dev/")
      && !line.includes("/runtimeAuth.ts:") && !line.includes("ConvexMemoryRepository.authority "))?.trim() ?? "direct";
    const ordered = guardBranches.get(branch) ?? []; ordered.push(guard); guardBranches.set(branch, ordered);
    guards.push(guard); return auth.recheckAuthority(...args);
  },
  freshManagedSourceReads: <Ctx>(ctx: Ctx): Ctx => { finalFences++; atFinalFence?.(); return auth.freshManagedSourceReads(ctx); },
}));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:query-source"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { runs, definitions, clone, clock } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const recall = await import("../../../convex-dev/runtimeAgentRecall");
const { ConvexMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const { explicitSourceLineage } = await import("../../../convex-dev/runtimeMemoryServices");
beforeEach(() => { installIngestionMockRoot(); reuse = true; finalFences = 0; atFinalFence = undefined; guards.length = 0; guardBranches.clear();
  jest.spyOn(performance, "now").mockReturnValue(0); });
afterEach(() => { jest.restoreAllMocks(); });

async function fixture() {
  const f = await ingestionFixture(), writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db), scope = memoryScope(f.reference);
  for (let index = 0; index < 2; index++) {
    const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, `query-source-${index}`), `Fruit apricot preference ${index}`, { now: () => clock });
    await writer.putSource(prepared.source); await ingestion.enqueueSourceEvent(f.ctx, f.reference, prepared.source);
    const source = { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1 };
    const identity = { ...source, stage: "facts" as const, semanticPolicyVersion: "query-source-v1" };
    const fact: DerivedFact = { _id: "", factId: `query-fact-${index}`, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
      ownerPrincipalId: scope.principalId, lineage: prepared.source.lineage, extractionPolicyVersion: "query-source-v1", fact: `Fruit apricot preference ${index}`,
      factType: "preference", confidence: 90, sourceType: "manual", tags: [], version: 1, createdAt: clock, updatedAt: clock };
    await writer.commitDerived({ source, identity, chunks: prepared.chunks, facts: [fact], expectedFactVersions: { [fact.factId]: 0 },
      vectors: [{ ...source, vectorId: `query-vector-${index}`, chunkId: prepared.chunks[0]!.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
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
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "query-source-v8", expectedPreviousVersion: 0,
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
    b.take = async n => { reads.push(["take", table, index, keys, n]); return take(n); };
    b.collect = async () => { reads.push(["collect", table, index, keys]); return collect(); }; return b;
  });
  const isRoot = (row: unknown[]) => row[0] === "unique" && row[1] === "runtimeMemorySources";
  return { reads, roots: () => reads.filter(isRoot), others: () => reads.filter(row => !isRoot(row)), clear: () => { reads.length = 0; guards.length = 0; guardBranches.clear(); finalFences = 0; f.calls.length = 0; } };
}
async function outcome(work: () => Promise<unknown>) {
  try { return { result: await work() }; }
  catch (error) { return { error: error instanceof Error ? { name: error.name, message: error.message, data: "data" in error ? error.data : undefined } : error }; }
}

it("registered prepare/read/delivery/save/candidate retains exact output/body/state/guards and non-source reads with fewer physical source unique reads", async () => {
  const f = await fixture(), seen = observe(f), before = f.state(); seen.clear(); reuse = false;
  const original = await f.perform(), after = f.state(), originalGuards = clone(guards), originalOthers = clone(seen.others()), roots = clone(seen.roots()), calls = [...f.calls];
  expect(finalFences).toBe(1); f.restore(before); seen.clear(); reuse = true;
  const actual = await f.perform();
  expect(actual).toEqual(original); expect(f.state()).toEqual(after); expect(guards).toEqual(originalGuards); expect(seen.others()).toEqual(originalOthers); expect(f.calls).toEqual(calls);
  expect(actual).toMatchObject({ state: "started" }); if (actual?.state !== "started" || original?.state !== "started") throw Error("Native candidate required");
  expect(actual.op.nativeRequestCanonical).toBe(original.op.nativeRequestCanonical); expect(finalFences).toBe(1);
  expect(f.calls).toContain("runtimeAgentRecall:prepareReadsV8"); expect(f.calls).toContain("runtimeAgentRecall:readMatchesAndDeliveryV8"); expect(f.calls).toContain("runtimeAgent:saveAndPrepareContextV8");
  expect(seen.roots().length).toBeLessThan(roots.length); expect(new Set(seen.roots().map(row => JSON.stringify(row)))).toEqual(new Set(roots.map(row => JSON.stringify(row))));
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  console.info(JSON.stringify({ type: "query-source-unique-reuse", baselineRootReads: roots.length, reusedRootReads: seen.roots().length,
    exactOutputBodyStateGuardsAndOtherReads: true, finalColdFences: finalFences, modelCalls: 0, hostedLatency: "NOT_RUN" }));
});
it.each(["grant", "lease", "source-tombstone", "source-owner", "source-revision", "source-duplicate", "fact-tombstone"] as const)("registered composition preserves %s refusal/selection and effects in both modes", async fault => {
  const f = await fixture(), base = f.state(), results: unknown[] = [], predicates: unknown[][] = [], branches: unknown[] = [];
  for (const enabled of [false, true]) {
    f.restore(base); reuse = enabled;
    const source = f.db.table("runtimeMemorySources")[0]!;
    if (fault === "grant") f.grant.revokedAt = clock;
    if (fault === "lease") f.attempt.leaseVersion++;
    if (fault === "source-tombstone") source.tombstonedAt = clock;
    if (fault === "source-owner") source.ownerPrincipalId = "foreign";
    if (fault === "source-revision") (source.lineage as { sourceRevision: number }).sourceRevision++;
    if (fault === "source-duplicate") f.db.seed("runtimeMemorySources", { ...source, _id: "runtimeMemorySources:duplicate" });
    if (fault === "fact-tombstone") f.db.table("facts")[0]!.tombstonedAt = clock;
    guards.length = 0; guardBranches.clear(); const result = await outcome(f.perform);
    if (["grant", "lease", "source-duplicate"].includes(fault)) expect(result).toHaveProperty("error");
    results.push({ result, state: f.state() }); predicates.push(clone(guards)); branches.push(clone(orderedBranchGuards()));
    expect(f.db.table("runtimeModelAttempts")).toEqual([]); if (fault === "lease") f.attempt.leaseVersion--;
  }
  expect(results[1]).toEqual(results[0]);
  expect(branches[1]).toEqual(branches[0]);
  expect(predicates[1]!.map(value => JSON.stringify(value)).sort()).toEqual(predicates[0]!.map(value => JSON.stringify(value)).sort());
  if (!["source-tombstone", "source-owner", "source-revision"].includes(fault)) expect(predicates[1]).toEqual(predicates[0]);
});
it.each(["memory", "fact"] as const)("a warmed shared source still applies its distinct %s-only permission at every registered branch", async allowed => {
  const f = await fixture(), source = f.db.table("runtimeMemorySources")[0]!, lineage = source.lineage as DerivedFact["lineage"];
  f.grant.resourceAccess = "space"; source.ownerPrincipalId = "other-owner";
  source.transcriptOrigin = { conversationId: "shared-query-source", conversationEpoch: 1, nativeMessageId: "shared-query-message" };
  f.db.table("runtimeMemoryVectors")[0]!.ownerPrincipalId = "other-owner"; f.db.table("facts")[0]!.ownerPrincipalId = "other-owner";
  f.db.seed("runtimeConversations", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "shared-query-source", ownerPrincipalId: "other-owner", epoch: 1, participants: [], visibility: "private" });
  f.db.seed("runtimeTranscriptMessages", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "shared-query-source", ownerPrincipalId: "other-owner",
    nativeMessageId: "shared-query-message", sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, revision: lineage.sourceRevision,
    role: "user", approved: true, sourceContentHash: source.contentHash });
  f.db.seed("runtimeConversationShares", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "shared-query-source", state: "active",
    grantType: "user", grantedTo: f.reference.principalId, viewCount: 0, expiresAt: clock + 100,
    permissions: { canView: true, canViewMemories: allowed === "memory", canViewFacts: allowed === "fact" } });
  const base = f.state(), results: unknown[] = [];
  for (const enabled of [false, true]) {
    f.restore(base); reuse = enabled; guards.length = 0;
    const result = await f.perform(); if (result?.state !== "started") throw Error("Native candidate required");
    const entries = result.current.execution.modelInputEntries!.filter(entry => entry.text.includes("Fruit apricot preference 0"));
    expect(entries.some(entry => entry.kind === allowed)).toBe(true); expect(entries.some(entry => entry.kind !== allowed)).toBe(false);
    results.push({ result, state: f.state(), guards: clone(guards) });
  }
  expect(results[1]).toEqual(results[0]);
});
it.each(["source", "grant"] as const)("original cold final-delivery %s fence catches a late simulated invalidation after reused reads", async fault => {
  const f = await fixture(), base = f.state(), results: unknown[] = [];
  for (const enabled of [false, true]) {
    f.restore(base); reuse = enabled; let reached = 0;
    atFinalFence = () => { reached++; if (fault === "source") f.db.table("runtimeMemorySources")[0]!.tombstonedAt = clock; else f.grant.revokedAt = clock; };
    const result = await outcome(f.perform); expect(reached).toBe(1); expect(result).toHaveProperty("error");
    results.push({ result, state: f.state() }); expect(f.db.table("runtimeModelAttempts")).toEqual([]); atFinalFence = undefined;
  }
  expect(results[1]).toEqual(results[0]);
});
