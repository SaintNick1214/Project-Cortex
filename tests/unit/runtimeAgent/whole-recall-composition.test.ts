/** Original native handlers with transactional DB/component peers; no service or speed claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName, getFunctionAddress } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { EmbeddingProfile } from "../../../src/domain/profile";
import { DEFAULT_EMBEDDING_PROFILE as profile, semanticHash } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { DerivedFact } from "../../../src/domain/contracts";
import { mergeContextWitness } from "../../../src/domain/context-witness";
import { assertNativeArgs } from "./native-arguments";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:whole-recall"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { runs, clock } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const whole = await import("../../../convex-dev/runtimeAgentRecall");
const memory = await import("../../../convex-dev/runtimeMemory");
const { ConvexMemoryRepository, createActionMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const { explicitSourceLineage, vectorRecallItems, completeRecallDelivery } = await import("../../../convex-dev/runtimeMemoryServices");
beforeEach(installIngestionMockRoot);
afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await ingestionFixture(), scope = memoryScope(f.reference), writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db);
  const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, "whole-source"), "My favorite season is autumn", { now: () => clock });
  await writer.putSource(prepared.source);await ingestion.enqueueSourceEvent(f.ctx, f.reference, prepared.source);
  const source = { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1 };
  const identity = { ...source, stage: "facts" as const, semanticPolicyVersion: "policy-v1" };
  const fact: DerivedFact = { _id: "", factId: "whole-fact", tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
    ownerPrincipalId: scope.principalId, lineage: prepared.source.lineage, extractionPolicyVersion: "policy-v1", fact: "User prefers autumn",
    factType: "preference", confidence: 91, sourceType: "manual", tags: [], version: 1, createdAt: clock, updatedAt: clock };
  await writer.commitDerived({ source, identity, chunks: prepared.chunks, vectors: [{ ...source, vectorId: "whole-vector", chunkId: prepared.chunks[0]!.chunkId,
    tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, profile, embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0), processingReceiptId: await processingIdentityKey(identity) }],
    facts: [fact], expectedFactVersions: { "whole-fact": 0 } });
  Object.assign(f.db.table("runtimeIngestionEvents")[0], { factsState: "complete", vectorsState: "complete", vectorProfilesComplete: [profile.profileId] });
  const startupMutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name = "";try { name = getFunctionName(ref); } catch { return startupMutation(ref, args); }
    if (name === "runs:claimNext") return await f.transaction(() => invoke(runs.claimNext, f.ctx, args));
    return startupMutation(ref, args);
  }) as MutationCtx["runMutation"];
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() });await f.call(agent.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0];
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };await f.call(agent.startContext, attempt);
  const current = await agent.executionContext(f.ctx, attempt);
  const input = { text: current.messages.filter(m => m.role === "user").slice(-1).map(m => typeof m.content === "string" ? m.content : m.content.filter(p => p.type === "text").map(p => p.text).join("\n")).join("\n"),
    requestId: `context:${await semanticHash(canonicalModelJson([run.runId, 1]))}`, limit: 10 };
  const selection = { cutoff: current.snapshot.ingestionCutoff.sequence, boundary: { conversationId: current.snapshot.conversationId, runId: run.runId,
    queueSequence: current.snapshot.queueSequence, anchor: { order: current.snapshot.anchor.order, stepOrder: current.snapshot.anchor.stepOrder } }, excludedSourceKeys: [] };
  const args = { ...attempt, input, profile, selection }, calls: string[] = [], physicalQueries: string[] = [];
  let beforeDeliveryQueries: string[] = [];
  const oldQuery = f.ctx.runQuery.bind(f.ctx), oldMutation = f.ctx.runMutation.bind(f.ctx);
  const modules = { runtimeAgentRecall: whole, runtimeMemory: memory, runtimeAgent: agent };
  function lookup(ref: Parameters<typeof getFunctionName>[0]) {
    let name: string;try { name = getFunctionName(ref); } catch { return undefined; }
    const [module, method] = name.split(":");if (!(module in modules)) return undefined;
    const value = (modules[module as keyof typeof modules] as Record<string, unknown>)[method];return value ? { name, value } : undefined;
  }
  f.ctx.runQuery = (async (ref, value) => {
    try { const address = getFunctionAddress(ref);physicalQueries.push("name" in address ? address.name : "reference" in address ? address.reference : "functionHandle"); }
    catch { physicalQueries.push("unrecognized-component-reference"); }
    const found = lookup(ref); if (!found) return oldQuery(ref, value);
    calls.push(found.name);assertNativeArgs(found.value, value);return invoke(found.value, f.ctx, value); }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, value) => { const found = lookup(ref);if (!found) return oldMutation(ref, value);
    calls.push(found.name);if (found.name === "runtimeMemory:finalDelivery") beforeDeliveryQueries = [...physicalQueries];
    assertNativeArgs(found.value, value);return f.transaction(() => invoke(found.value, f.ctx, value)); }) as MutationCtx["runMutation"];
  const hits = f.db.table("runtimeMemoryVectors").map(row => ({ id: row._id as Id<"runtimeMemoryVectors">, score: 0.9 }));
  const action = { ...f.ctx, vectorSearch: async () => hits.map(hit => ({ _id: hit.id, _score: hit.score })) } as unknown as ActionCtx;
  return { ...f, get grant() { return f.grant; }, args, attempt, profile, input, selection, hits, action, calls, physicalQueries, beforeDeliveryQueries: () => beforeDeliveryQueries, current };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function plan(f: Fixture) { return await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReads, f.args); }
async function matched(f: Fixture, prepared?: Awaited<ReturnType<typeof whole.prepareReadsHandler>>) {
  const proposed = prepared ?? await plan(f);
  return await f.call<Awaited<ReturnType<typeof whole.readMatchesHandler>>>(whole.readMatches, { ...f.args, hits: f.hits, factPlan: proposed.factPlan });
}
it("registered plan/matches reproduce original ordered selection, bindings and current delivery", async () => {
  const f = await fixture(), repository = createActionMemoryRepository(f.action, f.reference, "read"), reads = repository.stageRecallReads();
  const [vectors, facts] = await Promise.all([reads.searchVectors({ text: f.input.text, profile, embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0), embeddingRunBudgetId: f.current.run.runBudgetId }, 10), reads.listFacts({ limit: 10 })]);
  const v = await agent.contextSourceBatchHandler(f.ctx, { reference: f.reference, ...f.selection, permission: "canViewMemories", witnesses: [], priorWitnesses: [],
    items: vectors.map(m => ({ sourceId: m.source.lineage.sourceId, expected: { sourceEventId: m.source.lineage.sourceEventId, sourceRevision: m.source.lineage.sourceRevision, contentHash: m.source.contentHash } })) });
  const a = await agent.contextSourceBatchHandler(f.ctx, { reference: f.reference, ...f.selection, permission: "canViewFacts", witnesses: [], priorWitnesses: v.witnesses,
    items: facts.map(fact => ({ sourceId: fact.lineage.sourceId, expected: { sourceEventId: fact.lineage.sourceEventId, sourceRevision: fact.lineage.sourceRevision } })) });
  reads.commit();const original = await repository.finalDelivery!();
  const actual = await matched(f), witness = mergeContextWitness(v.witnesses[0], a.witnesses[0]);
  expect(actual.vectorItems).toEqual(vectorRecallItems(vectors));expect(actual.facts).toEqual(facts);expect(actual.witnesses).toEqual([witness]);
  expect(await new ConvexMemoryRepository(f.ctx, f.reference, "read").checkDelivery(actual.bindings)).toEqual(original);
  expect(whole.prepareReads.isInternal).toBe(true);expect(whole.readMatches.isQuery).toBe(true);
});
it("real private Action performs two outer read calls, original ANN and fresh finalDelivery without inference", async () => {
  const f = await fixture(), writes = f.db.writes, chosen: unknown[] = [];
  const result = await whole.finishAgentRecall(f.action, f.attempt, { now: () => clock }, f.input, profile,
    { profile, vectors: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)] }, { ...f.selection, onSelected: value => chosen.push(value) });
  expect(result.items).toHaveLength(2);expect(chosen).toHaveLength(1);expect(f.db.writes).toBe(writes);
  expect(f.calls).toEqual(["runtimeAgentRecall:prepareReads", "runtimeAgentRecall:readMatches", "runtimeMemory:finalDelivery"]);
  expect(f.beforeDeliveryQueries().filter(name => name === "runtimeModelPolicy:embeddingProfile")).toEqual([]);
  expect(f.physicalQueries.filter(name => name === "runtimeModelPolicy:embeddingProfile")).toHaveLength(1);
  expect(f.physicalQueries.filter(name => name === "runtimeAgentRecall:prepareReads")).toHaveLength(1);
  expect(f.physicalQueries.filter(name => name === "runtimeAgentRecall:readMatches")).toHaveLength(1);
  console.info(JSON.stringify({ type: "whole-recall-physical-query-count", kind: "controlled-handler",
    outerCalls: f.calls, physicalQueries: Object.fromEntries([...new Set(f.physicalQueries)].map(name => [name, f.physicalQueries.filter(value => value === name).length])),
    embeddingProfileBeforeDelivery: f.beforeDeliveryQueries().filter(name => name === "runtimeModelPolicy:embeddingProfile").length }));
});
it.each(["principal", "lease", "profile", "cutoff", "boundary", "limit", "request"])("native %s mismatch refuses without writes or a second lane", async fault => {
  const f = await fixture(), args = { ...f.args, input: { ...f.input }, selection: { ...f.selection }, profile: { ...profile } as EmbeddingProfile };
  if (fault === "principal") args.reference = { ...args.reference, principalId: "foreign" };
  if (fault === "lease") args.leaseVersion++;
  if (fault === "profile") args.profile = { ...args.profile, modelId: "wrong-model" };
  if (fault === "cutoff") args.selection.cutoff++;
  if (fault === "boundary") args.selection.boundary = { ...args.selection.boundary, queueSequence: 999 };
  if (fault === "limit") args.input.limit = 101;
  if (fault === "request") args.input.requestId = "wrong-request";
  const writes = f.db.writes;await expect(f.call(whole.prepareReads, args)).rejects.toThrow();expect(f.db.writes).toBe(writes);
});
it("revocation between plan and matches is freshly refused", async () => {
  const f = await fixture(), prepared = await plan(f);f.grant.revokedAt = clock;
  await expect(matched(f, prepared)).rejects.toThrow();
});
it("changed consumed fact payload is refused by the original fresh delivery predicate", async () => {
  const f = await fixture(), read = await matched(f);f.db.table("facts")[0].fact = "changed after read";
  await expect(new ConvexMemoryRepository(f.ctx, f.reference, "read").checkDelivery(read.bindings)).rejects.toThrow("STALE_SOURCE");
});
it("withheld fact refusal waits for original vector source failure", async () => {
  const f = await fixture(), prepared = await plan(f);prepared.factPlan = { kind: "refused", refusalCanonical: canonicalModelJson({ kind: "error", message: "FACT_LAST" }) };
  const source = f.db.table("runtimeMemorySources")[0], hydrate = ConvexMemoryRepository.prototype.hydrateVectors;
  jest.spyOn(ConvexMemoryRepository.prototype, "hydrateVectors").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, ...args) {
    const values = await hydrate.apply(this, args);source.contentHash = "a".repeat(64);return values;
  });
  await expect(matched(f, prepared)).rejects.toThrow("STALE_CONTEXT");
});
it("duplicate/unknown candidates use original canonical hydration/drop semantics", async () => {
  const f = await fixture();const read = await f.call<Awaited<ReturnType<typeof whole.readMatchesHandler>>>(whole.readMatches,
    { ...f.args, hits: [f.hits[0], f.hits[0], { id: "runtimeMemoryVectors:missing", score: 1 }], factPlan: (await plan(f)).factPlan });
  expect(read.vectorItems).toHaveLength(2);expect(read.bindings.vectors).toHaveLength(2);expect(read.witnesses).toHaveLength(1);
});
it("deadline passing while final delivery returns still refuses on the actual Action clock", async () => {
  const _f = await fixture(), returned = jest.fn(async () => ({ version: 1 as const, deliveryExpiresAt: clock + 1 }));
  await expect(completeRecallDelivery({ clock: { now: () => clock + 2 }, finalDelivery: returned }, { limit: 10 }, profile.profileId, [], []))
    .rejects.toThrow("FORBIDDEN");expect(returned).toHaveBeenCalledTimes(1);
});

it.each(["payload", "source-binding", "extra-hit"])("changed native read proposal %s is refused without partial context", async fault => {
  const f = await fixture(), prepared = await plan(f), before = f.db.writes;
  if (prepared.factPlan.kind !== "ready") throw Error("Expected real ready fixture");
  if (fault === "payload") prepared.factPlan.facts[0]!.fact = "forged private fact";
  if (fault === "source-binding") prepared.factPlan.bindings.sources = [];
  if (fault === "extra-hit") f.hits = Array.from({ length: 101 }, () => f.hits[0]!);
  await expect(matched(f, prepared)).rejects.toThrow("INVALID_INPUT");expect(f.db.writes).toBe(before);
});
it("late source tombstone is fenced before any private context commit", async () => {
  const f = await fixture(), prepared = await plan(f);f.db.table("runtimeMemorySources")[0].tombstonedAt = clock;
  const writes = f.db.writes;await expect(matched(f, prepared)).rejects.toThrow();expect(f.db.writes).toBe(writes);
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
});
it("expired consumed fact is still rejected by fresh finalDelivery", async () => {
  const f = await fixture();f.db.table("facts")[0].validUntil = clock + 10;const read = await matched(f);
  jest.spyOn(Date, "now").mockReturnValue(clock + 11);
  await expect(new ConvexMemoryRepository(f.ctx, f.reference, "read").checkDelivery(read.bindings)).rejects.toThrow("STALE_SOURCE");
});
it("save success survives actual candidate child writes followed by refusal; child partial state rolls back", async () => {
  const f = await fixture(), base = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    const name = getFunctionName(ref);
    if (name !== "runtimeAgent:prepareResolvedModelCandidate") return base(ref, args);
    return await f.transaction(async () => {
      await invoke(agent.prepareResolvedModelCandidate, f.ctx, args);
      await f.ctx.db.patch("runtimeAgentExecutions", f.db.table("runtimeAgentExecutions")[0]._id as never, { nextModelStep: 99 });
      throw Error("CHILD_AFTER_WRITES");
    });
  }) as MutationCtx["runMutation"];
  const result = await f.call<Awaited<ReturnType<typeof agent.saveAndPrepareContextHandler>>>(agent.saveAndPrepareContext,
    { ...f.attempt, context: "bounded context", witnesses: [], completeness: "complete" });
  expect(result.kind).toBe("refused");if (result.kind !== "refused") throw Error("Expected refusal");
  expect(result.refusal).toEqual({ kind: "error", message: "CHILD_AFTER_WRITES" });
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextCanonical: "bounded context", contextState: "complete", nextModelStep: 0 });
  expect(f.db.table("runtimeAgentOperations")).toHaveLength(0);
});
it("save failure never invokes candidate child and rolls back all its own state", async () => {
  const f = await fixture(), writes = f.db.writes;
  await expect(f.call(agent.saveAndPrepareContext, { ...f.attempt, context: "x".repeat(16385), witnesses: [], completeness: "complete" }))
    .rejects.toThrow("CONTEXT_LIMIT_EXCEEDED");
  expect(f.calls).not.toContain("runtimeAgent:prepareResolvedModelCandidate");expect(f.db.writes).toBe(writes);
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
});
it("unknown hostile child errors cannot undo the original saved context or invoke diagnostic getters", async () => {
  const f = await fixture(), base = f.ctx.runMutation.bind(f.ctx), diagnostic = jest.fn(() => { throw Error("GETTER_CALLED"); });
  f.ctx.runMutation = (async (ref, args) => {
    if (getFunctionName(ref) !== "runtimeAgent:prepareResolvedModelCandidate") return base(ref, args);
    const error = Object.defineProperty({}, "message", { get: diagnostic });throw error;
  }) as MutationCtx["runMutation"];
  const result = await f.call<Awaited<ReturnType<typeof agent.saveAndPrepareContextHandler>>>(agent.saveAndPrepareContext,
    { ...f.attempt, context: "retained context", witnesses: [], completeness: "complete" });
  expect(result).toEqual({ kind: "refused", refusal: { kind: "unknown" } });expect(diagnostic).not.toHaveBeenCalled();
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBe("retained context");
});
