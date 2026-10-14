/** Original native handlers with transactional DB/component peers; no service or speed claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName, getFunctionAddress } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { EmbeddingProfile } from "../../../src/domain/profile";
import { DEFAULT_EMBEDDING_PROFILE as profile, semanticHash } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { ContextSourceWitness } from "../../../src/domain/context-witness";
import type { DerivedFact } from "../../../src/domain/contracts";
import { mergeContextWitness } from "../../../src/domain/context-witness";
import { assertNativeArgs } from "./native-arguments";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:whole-recall"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { runs, clock, definitions, clone } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const whole = await import("../../../convex-dev/runtimeAgentRecall");
const queryEmbedding = await import("../../../convex-dev/runtimeAgentQueryEmbedding");
const { createV8AuthorityReadScope } = await import("../../../convex-dev/runtimeAuth");
const memory = await import("../../../convex-dev/runtimeMemory");
const { ConvexMemoryRepository, createActionMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const { explicitSourceLineage, vectorRecallItems, completeRecallDelivery } = await import("../../../convex-dev/runtimeMemoryServices");
beforeEach(installIngestionMockRoot);
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(v8 = false) {
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
    if (name === "runs:claimNext" || name === "runs:claimNextV8") return await f.transaction(() => invoke(name.endsWith("V8") ? runs.claimNextV8 : runs.claimNext, f.ctx, args));
    return startupMutation(ref, args);
  }) as MutationCtx["runMutation"];
  const published = v8 ? await f.call<{agentId:string;version:number}>(definitions.publishVersion, { memorySpaceId:"space-a",clientMutationId:"v8-recall-read-scope",expectedPreviousVersion:0,
    definitionInput:{...f.definitionInput,context:{...f.definitionInput.context,handlerId:"cortex.transcript.relevant",registryHash:await definitions.executableRegistryHashV3(),
      inputSelection:{version:1,recentMessages:4,relevantMemories:4,relevantFacts:4,pendingEntries:4,maxMessages:16}}} }) : undefined;
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request(), ...(published ? {agentId:published.agentId,agentVersion:published.version}: {}) } });await f.call(agent.start, { runId: run.runId });
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
    calls.push(found.name);if (found.name === "runtimeMemory:finalDelivery" || found.name === "runtimeAgentRecall:finalDeliveryV8") beforeDeliveryQueries = [...physicalQueries];
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


it("V8 private read/delivery lane equals the original handlers and removes the nested profile handoff", async () => {
  const f = await fixture(true), selected: unknown[] = [], writes = f.db.writes;
  const result = await whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>clock},f.input,profile,
    {profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},{...f.selection,onSelected:value=>selected.push(value)});
  expect(f.calls).toEqual(["runtimeAgentRecall:prepareReadsV8","runtimeAgentRecall:readMatchesV8","runtimeAgentRecall:finalDeliveryV8"]);
  expect(f.physicalQueries.filter(name=>name==="runtimeModelPolicy:embeddingProfile")).toHaveLength(0);
  expect(f.db.writes).toBe(writes);f.calls.length=0;f.physicalQueries.length=0;
  const originalSelected:unknown[]=[];
  const original=await whole.finishAgentRecall(f.action,f.attempt,{now:()=>clock},f.input,profile,
    {profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},{...f.selection,onSelected:value=>originalSelected.push(value)});
  expect(result).toEqual(original);expect(selected).toEqual(originalSelected);expect(f.db.writes).toBe(writes);
  expect(f.physicalQueries.filter(name=>name==="runtimeModelPolicy:embeddingProfile")).toHaveLength(1);
  expect(whole.finalDeliveryV8.isInternal).toBe(true);expect(whole.finalDeliveryV8.isMutation).toBe(true);
});
it.each(["principal","lease","profile","cutoff","boundary","limit","request"])("V8 %s refusal still exercises the actual registered guard",async fault=>{
  const f=await fixture(true),args={...f.args,input:{...f.input},selection:{...f.selection},profile:{...profile} as EmbeddingProfile};
  if(fault==="principal")args.reference={...args.reference,principalId:"foreign"};if(fault==="lease")args.leaseVersion++;
  if(fault==="profile")args.profile={...args.profile,modelId:"wrong-model"};if(fault==="cutoff")args.selection.cutoff++;
  if(fault==="boundary")args.selection.boundary={...args.selection.boundary,queueSequence:999};
  if(fault==="limit")args.input.limit=101;if(fault==="request")args.input.requestId="wrong-request";
  const writes=f.db.writes;
  await expect(f.call(whole.prepareReadsV8,args)).rejects.toThrow();expect(f.db.writes).toBe(writes);
});
it("V8 endpoints reject a historical snapshot rather than applying the new mode to its journal",async()=>{
  const f=await fixture();await expect(f.call(whole.prepareReadsV8,f.args)).rejects.toThrow("INVALID_STATE");
  await expect(f.call(whole.readMatchesV8,{...f.args,hits:f.hits,factPlan:(await plan(f)).factPlan})).rejects.toThrow("INVALID_STATE");
});
it.each(["fact","source","profile","revocation","budget","tombstone","expiry"])("V8 final %s fence returns the same original failure with zero writes",async fault=>{
  const f=await fixture(true),read=await matched(f),bindings=read.bindings;
  if(fault==="fact")f.db.table("facts")[0].fact="changed";
  if(fault==="source")f.db.table("runtimeMemorySources")[0].contentHash="a".repeat(64);
  if(fault==="profile")bindings.vectors[0]!.profile={...profile,modelId:"wrong-model"};
  if(fault==="revocation")f.grant.revokedAt=clock;
  if(fault==="budget")f.db.table("runtimeBudgetAccounts").find(value=>value.kind==="run")!.cancelled=true;
  if(fault==="tombstone")f.db.seed("runtimeAuthTombstones",{tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,resourceType:"source",resourceId:f.db.table("runtimeMemorySources")[0].lineage && (f.db.table("runtimeMemorySources")[0].lineage as {sourceId:string}).sourceId,deletedAt:clock});
  if(fault==="expiry")f.db.table("facts")[0].validUntil=clock;
  const error=async(registration:unknown)=>{try{await f.call(registration,{reference:f.reference,bindings});throw Error("Expected refusal");}catch(value){if(!(value instanceof Error)||value.message==="Expected refusal")throw value;return{name:value.name,message:value.message,data:"data" in value?value.data:undefined};}};
  const writes=f.db.writes;expect(await error(whole.finalDeliveryV8)).toEqual(await error(memory.finalDelivery));expect(f.db.writes).toBe(writes);
});
it("V8 delivery still uses raw final authority after consumed resource and hash awaits",async()=>{
  const f=await fixture(true),read=await matched(f),get=f.db.get.bind(f.db);let grantReads=0;
  jest.spyOn(f.db,"get").mockImplementation(async(table,id)=>{if(table==="runtimeAuthGrants" && ++grantReads===2)f.grant.revokedAt=clock;return get(table,id);});
  const writes=f.db.writes;await expect(f.call(whole.finalDeliveryV8,{reference:f.reference,bindings:read.bindings})).rejects.toThrow("FORBIDDEN");
  expect(grantReads).toBe(2);expect(f.db.writes).toBe(writes);
});

function wholeState(f: Fixture) {
  return clone({ rows: new Map([...f.db.rows].filter(([, rows]) => rows.length)), writes: f.db.writes,
    native: f.native, effects: f.effects, scheduled: f.scheduled });
}
async function failureValue(call: () => Promise<unknown>) {
  try { await call(); throw Error("EXPECTED_REFUSAL"); }
  catch (value) {
    if (!(value instanceof Error) || value.message === "EXPECTED_REFUSAL") throw value;
    return { name: value.name, message: value.message, data: "data" in value ? value.data : undefined };
  }
}
it("V8 context/preflight parent equals both original registered read handlers with zero effects", async () => {
  const f = await fixture(true), before = wholeState(f);
  const inputs = await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>["inputs"]>(agent.contextInputsV8, f.attempt);
  expect(inputs.kind).toBe("ready"); if (inputs.kind !== "ready") throw Error("Expected indexed fixture");
  expect(inputs.availability.empty).toBe(false);
  const proposal = await f.call<Awaited<ReturnType<typeof queryEmbedding.prepareAgentQueryEmbeddingHandler>>>(queryEmbedding.prepareV8, { ...f.attempt, input: f.input });
  const combined = await f.call(agent.contextInputsAndEmbeddingV8, f.attempt);
  expect(combined).toEqual({ inputs, proposal }); expect(wholeState(f)).toEqual(before);
  expect(agent.contextInputsAndEmbeddingV8.isInternal).toBe(true); expect(agent.contextInputsAndEmbeddingV8.isQuery).toBe(true);
  expect(() => assertNativeArgs(agent.contextInputsAndEmbeddingV8, { ...f.attempt, input: f.input })).toThrow("Unknown native field");
});
it.each(["principal", "lease", "revoked", "expired", "profile", "budget", "pending-first", "historical"])("context parent %s preserves original refusal precedence and complete state", async fault => {
  const f = await fixture(fault !== "historical");
  const args = { ...f.attempt };
  if (fault === "principal") args.reference = { ...args.reference, principalId: "foreign" };
  if (fault === "lease") args.leaseVersion++;
  if (fault === "revoked") f.grant.revokedAt = clock;
  if (fault === "expired") f.grant.expiresAt = clock;
  if (fault === "profile") {
    const rows = f.db.table("runtimeModelQualifications").filter(row => String(row.canonical).includes(profile.modelId));
    expect(rows.length).toBeGreaterThan(0); rows.forEach(row => { row.active = false; });
  }
  if (fault === "budget") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.cancelled = true;
  if (fault === "pending-first") {
    // A genuine authority refusal at pending read must precede any embedding profile call.
    f.grant.capabilities = [];
  }
  const before = wholeState(f);
  const original = () => (async () => {
    const inputs = await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>["inputs"]>(agent.contextInputsV8, args);
    if (inputs.kind === "pending_overflow" || inputs.availability.empty) return { inputs };
    return { inputs, proposal: await f.call(queryEmbedding.prepareV8, { ...args, input: f.input }) };
  })();
  expect(await failureValue(() => f.call(agent.contextInputsAndEmbeddingV8, args))).toEqual(await failureValue(original));
  expect(wholeState(f)).toEqual(before);
});
it("private assembler consumes the native preflight proposal without a second preparation handoff", async () => {
  const f = await fixture(true), supplied: unknown[] = []; f.calls.length = 0;
  const result = await agent.prepareContextV8Handler(f.action, f.attempt, async (_repository, input, selection, proposal) => {
    expect(input).toEqual(f.input); expect(selection).toBeDefined(); expect(proposal?.binding.operationKey).toBe("embedding.query");
    supplied.push(proposal); return { items: [], context: "", profileId: profile.profileId };
  }, true);
  expect(result?.state).toBe("started"); expect(supplied).toHaveLength(1);
  expect(f.calls.filter(name => name === "runtimeAgent:contextInputsAndEmbeddingV8")).toHaveLength(1);
  expect(f.calls).not.toContain("runtimeAgent:contextInputsV8");
  expect(f.calls).toContain("runtimeAgent:saveAndPrepareContextV8");
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("an unsupported/custom context callback retains its original three arguments and ports", async () => {
  const f = await fixture(true); f.calls.length = 0;
  const callback: NonNullable<Parameters<typeof agent.prepareContextV8Handler>[2]> = async function (_repository, input, selection) {
    expect(arguments).toHaveLength(3); expect(input).toEqual(f.input); expect(selection).toBeUndefined();
    return { items: [], context: "", profileId: profile.profileId };
  };
  expect(await agent.prepareContextV8Handler(f.action, f.attempt, callback)).toBeNull();
  expect(f.calls).toContain("runtimeAgent:contextInputsV8"); expect(f.calls).not.toContain("runtimeAgent:contextInputsAndEmbeddingV8");
  expect(f.calls).toContain("runtimeAgent:saveContextV8"); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("new read/delivery parent returns exact original match and delivery data with zero application writes", async () => {
  const f = await fixture(true), prepared = await plan(f), args = { ...f.args, hits: f.hits, factPlan: prepared.factPlan }, before = wholeState(f);
  const read = await f.call<Awaited<ReturnType<typeof whole.readMatchesHandler>>>(whole.readMatchesV8, args);
  const delivery = await f.call(whole.finalDeliveryV8, { reference: f.reference, bindings: read.bindings });
  expect(await f.call(whole.readMatchesAndDeliveryV8, args)).toEqual({ read, delivery }); expect(wholeState(f)).toEqual(before);
  expect(whole.readMatchesAndDeliveryV8.isInternal).toBe(true); expect(whole.readMatchesAndDeliveryV8.isMutation).toBe(true);
});
it.each(["principal", "lease", "profile", "cutoff", "boundary", "request", "oversize", "revocation", "source", "tombstone", "facts", "fact-refusal"])("read/delivery %s returns the same original first refusal without partial effects", async fault => {
  const f = await fixture(true), prepared = await plan(f), args = { ...f.args, hits: [...f.hits], input: { ...f.input }, selection: { ...f.selection }, factPlan: prepared.factPlan };
  if (fault === "principal") args.reference = { ...args.reference, principalId: "foreign" };
  if (fault === "lease") args.leaseVersion++;
  if (fault === "profile") args.profile = { ...profile, modelId: "foreign-model" };
  if (fault === "cutoff") args.selection.cutoff++;
  if (fault === "boundary") args.selection.boundary = { ...args.selection.boundary, queueSequence: 999 };
  if (fault === "request") args.input.requestId = "wrong-request";
  if (fault === "oversize") args.hits = Array.from({ length: 101 }, () => f.hits[0]!);
  if (fault === "revocation") f.grant.revokedAt = clock;
  if (fault === "source") f.db.table("runtimeMemorySources")[0].contentHash = "a".repeat(64);
  if (fault === "tombstone") f.db.table("runtimeMemorySources")[0].tombstonedAt = clock;
  if (fault === "facts" && args.factPlan.kind === "ready") args.factPlan.facts[0]!.fact = "changed fact payload";
  if (fault === "fact-refusal") { args.factPlan = { kind: "refused", refusalCanonical: canonicalModelJson({ kind: "error", message: "FACT_LAST" }) }; f.db.table("runtimeMemorySources")[0].tombstonedAt = clock; }
  const before = wholeState(f), original = async () => {
    const read = await f.call<Awaited<ReturnType<typeof whole.readMatchesHandler>>>(whole.readMatchesV8, args);
    return await f.call(whole.finalDeliveryV8, { reference: f.reference, bindings: read.bindings });
  };
  expect(await failureValue(async () => {
    const combined = await f.call<Awaited<ReturnType<typeof whole.readMatchesAndDeliveryV8Handler>>>(whole.readMatchesAndDeliveryV8, args);
    if (combined.refusal !== undefined) queryEmbedding.throwRefusal(combined.refusal);
    return combined.delivery;
  })).toEqual(await failureValue(original));
  expect(wholeState(f)).toEqual(before);
});
it("private synchronous selection removes one outer handoff while arbitrary callbacks retain the original fresh delivery route", async () => {
  const f = await fixture(true), selected: unknown[] = [], before = wholeState(f);
  const input = { profile, vectors: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)] };
  const actual = await whole.finishAgentRecallV8(f.action, f.attempt, { now: () => clock }, f.input, profile, input,
    whole.withPrivateInlineAgentSelection({ ...f.selection, onSelected: value => { selected.push(value); } }));
  expect(f.calls).toEqual(["runtimeAgentRecall:prepareReadsV8", "runtimeAgentRecall:readMatchesAndDeliveryV8"]);
  f.calls.length = 0; const originalSelected: unknown[] = [];
  const original = await whole.finishAgentRecallV8(f.action, f.attempt, { now: () => clock }, f.input, profile, input,
    { ...f.selection, onSelected: value => { originalSelected.push(value); } });
  expect(f.calls).toEqual(["runtimeAgentRecall:prepareReadsV8", "runtimeAgentRecall:readMatchesV8", "runtimeAgentRecall:finalDeliveryV8"]);
  expect(actual).toEqual(original); expect(selected).toEqual(originalSelected); expect(wholeState(f)).toEqual(before);
});
it("unbranded callback revocation is still checked after callback and callback failure precedes final delivery", async () => {
  const f = await fixture(true), input = { profile, vectors: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)] };
  await expect(whole.finishAgentRecallV8(f.action, f.attempt, { now: () => clock }, f.input, profile, input,
    { ...f.selection, onSelected: () => { f.grant.revokedAt = clock; } })).rejects.toThrow("FORBIDDEN");
  expect(f.calls).not.toContain("runtimeAgentRecall:readMatchesAndDeliveryV8");
  f.grant.revokedAt = undefined; f.calls.length = 0;
  const error = Error("CALLBACK_FIRST");
  await expect(whole.finishAgentRecallV8(f.action, f.attempt, { now: () => clock }, f.input, profile, input,
    { ...f.selection, onSelected: () => { throw error; } })).rejects.toBe(error);
  expect(f.calls).not.toContain("runtimeAgentRecall:finalDeliveryV8");
});
it("private parent preserves foreign error identity and real Action deadline refusal after returned delivery", async () => {
  const f = await fixture(true), prepared = await plan(f), args = { ...f.args, hits: f.hits, factPlan: prepared.factPlan };
  const error = Error("UNRECOGNIZED_DELIVERY_ERROR"), delivery = jest.spyOn(ConvexMemoryRepository.prototype, "checkDelivery").mockRejectedValue(error);
  await expect(f.call(whole.readMatchesAndDeliveryV8, args)).rejects.toBe(error);
  await expect(f.call(whole.finalDeliveryV8, { reference: f.reference, bindings: { sources: [], facts: [], vectors: [] } })).rejects.toBe(error);
  delivery.mockRestore(); f.grant.expiresAt = clock + 1;
  const before = f.db.writes;
  await expect(whole.finishAgentRecallV8(f.action, f.attempt, { now: () => clock + 2 }, f.input, profile,
    { profile, vectors: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)] },
    whole.withPrivateInlineAgentSelection({ ...f.selection, onSelected: () => {} }))).rejects.toThrow("FORBIDDEN");
  expect(f.db.writes).toBe(before);
});

it("recognized final refusal waits for synchronous selection and original ranking failure precedence", async () => {
  const f = await fixture(true), selected = jest.fn(), input = { profile, vectors: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)] };
  const { ConvexError } = await import("convex/values");
  const data = { version: 1, code: "STALE_SOURCE", message: "Original final consumed source refusal", retryable: false, outcome: "not_dispatched" };
  const refusalError = new ConvexError(data);
  jest.spyOn(ConvexMemoryRepository.prototype, "checkDelivery").mockRejectedValue(refusalError);
  const selection = whole.withPrivateInlineAgentSelection({ ...f.selection, onSelected: selected });
  expect(await failureValue(() => whole.finishAgentRecallV8(f.action, f.attempt, { now: () => clock }, f.input, profile, input, selection)))
    .toEqual({ name: refusalError.name, message: refusalError.message, data });
  expect(selected).toHaveBeenCalledTimes(1);
  const rankError = Error("RANK_FIRST");
  await expect(whole.finishAgentRecallV8(f.action, f.attempt, { now: () => { throw rankError; } }, f.input, profile, input, selection)).rejects.toBe(rankError);
  expect(selected).toHaveBeenCalledTimes(2);
});
it("shared native parent keeps the final raw revocation fence and fresh save rechecks after return", async () => {
  const f = await fixture(true), args = { ...f.args, hits: f.hits, factPlan: (await plan(f)).factPlan };
  const check = ConvexMemoryRepository.prototype.checkDelivery, get = f.db.get.bind(f.db);
  let finalPhase = false, finalRawGrantReads = 0;
  const deliverySpy = jest.spyOn(ConvexMemoryRepository.prototype, "checkDelivery").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, ...values) {
    finalPhase = true; return await check.apply(this, values);
  });
  const getSpy = jest.spyOn(f.db, "get").mockImplementation(async (table, id) => {
    if (finalPhase && table === "runtimeAuthGrants") { finalRawGrantReads++; f.grant.revokedAt = clock; }
    return await get(table, id);
  });
  const refused = await f.call<Awaited<ReturnType<typeof whole.readMatchesAndDeliveryV8Handler>>>(whole.readMatchesAndDeliveryV8, args);
  expect(refused.refusal).toMatchObject({ kind: "convex", data: { code: "FORBIDDEN" } }); expect(finalRawGrantReads).toBe(1);
  deliverySpy.mockRestore(); getSpy.mockRestore(); delete f.grant.revokedAt;
  const result = await f.call<Awaited<ReturnType<typeof whole.readMatchesAndDeliveryV8Handler>>>(whole.readMatchesAndDeliveryV8, args);
  expect(result.delivery).toBeDefined(); f.grant.revokedAt = clock;
  const execution = clone(f.db.table("runtimeAgentExecutions")[0]), writes = f.db.writes;
  await expect(f.call(agent.saveContextV8, { ...f.attempt, context: "", entries: [], witnesses: result.read.witnesses, completeness: "complete" })).rejects.toThrow("FORBIDDEN");
  expect(f.db.table("runtimeAgentExecutions")[0]).toEqual(execution); expect(f.db.writes).toBe(writes);
});

it("same-snapshot parents reuse raw control rows only; mutable read order and all state remain equal",async()=>{
 const f=await fixture(true),get=f.db.get.bind(f.db),query=f.db.query.bind(f.db),seen:{table:string;id:string}[]=[],queries:string[]=[];
 jest.spyOn(f.db,"get").mockImplementation(async(table,id)=>{seen.push({table,id});return await get(table,id);});
 jest.spyOn(f.db,"query").mockImplementation(table=>{queries.push(table);return query(table);});
 const before=wholeState(f);
 const inputs=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>["inputs"]>(agent.contextInputsV8,f.attempt);
 const proposal=await f.call(queryEmbedding.prepareV8,{...f.attempt,input:f.input});const originalInitial=[...seen],originalInitialQueries=[...queries];seen.length=0;queries.length=0;
 expect(await f.call(agent.contextInputsAndEmbeddingV8,f.attempt)).toEqual({inputs,proposal});const parentInitial=[...seen],parentInitialQueries=[...queries];seen.length=0;queries.length=0;
 const args={...f.args,hits:f.hits,factPlan:(await plan(f)).factPlan};seen.length=0;queries.length=0;
 const read=await f.call<Awaited<ReturnType<typeof whole.readMatchesHandler>>>(whole.readMatchesV8,args);
 const delivery=await f.call(whole.finalDeliveryV8,{reference:f.reference,bindings:read.bindings});const originalTail=[...seen],originalTailQueries=[...queries];seen.length=0;queries.length=0;
 expect(await f.call(whole.readMatchesAndDeliveryV8,args)).toEqual({read,delivery});const parentTail=[...seen],parentTailQueries=[...queries];
 const mutable=(reads:typeof seen)=>reads.filter(row=>!row.table.startsWith("runtimeAuth") && !["runtimeModelPolicies","runtimeModelQualifications"].includes(row.table));
 expect(mutable(parentInitial)).toEqual(mutable(originalInitial));expect(mutable(parentTail)).toEqual(mutable(originalTail));
 const mutableQueries=(reads:string[])=>reads.filter(table=>!table.startsWith("runtimeAuth") && !["runtimeModelPolicies","runtimeModelQualifications"].includes(table));
 expect(mutableQueries(parentInitialQueries)).toEqual(mutableQueries(originalInitialQueries));expect(mutableQueries(parentTailQueries)).toEqual(mutableQueries(originalTailQueries));
 expect(parentInitial.length).toBeLessThan(originalInitial.length);expect(parentTail.length).toBeLessThan(originalTail.length);expect(wholeState(f)).toEqual(before);
 console.info(JSON.stringify({type:"k25-private-read-parent-counts",kind:"controlled-original-handlers",initial:{oldGets:originalInitial.length,newGets:parentInitial.length,oldQueries:originalInitialQueries.length,newQueries:parentInitialQueries.length},tail:{oldGets:originalTail.length,newGets:parentTail.length,oldQueries:originalTailQueries.length,newQueries:parentTailQueries.length},mutableReadSequencesEqual:true,applicationWrites:0,cloudLatency:"UNAVAILABLE"}));
});


/** Real source validators traverse a diamond or disjoint ancestry on every call.
 * Only physical named raw reads may collapse; no traversal verdict is retained. */
async function ancestryFixture(shared: boolean) {
  const f = await fixture(true);
  const witness = (source: Awaited<ReturnType<typeof f.source>>): ContextSourceWitness => ({
    sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId,
    sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash,
    permissions: ["canViewMemories", "canViewFacts"],
  });
  const leaves = [];
  for (let index = 0; index < (shared ? 1 : 3); index++) {
    leaves.push(await f.source(`Bounded graph leaf ${index}`, `graph-leaf-${index}`));
  }
  const roots: ContextSourceWitness[] = [];
  for (let index = 0; index < 3; index++) {
    const branch = await f.source(`Bounded graph branch ${index}`, `graph-branch-${index}`);
    const row = f.db.table("runtimeMemorySources").find(value => value._id && (value.lineage as { sourceId: string }).sourceId === branch.lineage.sourceId)!;
    row.contextSourceWitnesses = [witness(leaves[shared ? 0 : index]!)]; roots.push(witness(branch));
  }
  const sourceId = f.db.table("runtimeMemoryVectors")[0]!.sourceId;
  const top = f.db.table("runtimeMemorySources").find(value => (value.lineage as { sourceId: string }).sourceId === sourceId)!;
  top.contextSourceWitnesses = roots;
  const topLineage = top.lineage as ContextSourceWitness;
  const topWitness: ContextSourceWitness = { sourceId: topLineage.sourceId, sourceEventId: topLineage.sourceEventId, sourceRevision: topLineage.sourceRevision,
    contentHash: top.contentHash as string, permissions: ["canViewMemories", "canViewFacts"] };
  f.db.table("runtimeAgentExecutions")[0]!.sourceWitnesses = [topWitness];
  return { ...f, get grant() { return f.grant; }, top, roots, leaves, topWitness };
}
type GraphRead = { method: string; table: string; id?: string; index?: string; keys?: unknown[]; terminal?: string; family: boolean; phase: string; documents: number };
function instrumentGraphReads(f: Fixture) {
  const query = f.db.query.bind(f.db), get = f.db.get.bind(f.db), reads: GraphRead[] = [];
  let phase = "read";
  const namedFamily = () => /readManaged(?:SourceRows|ConversationRows|TranscriptBridgeRows|SourceRunRows)/.test(new Error().stack ?? "");
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => {
    const row = await get(table, id); reads.push({ method: "get", table, id, family: false, phase, documents: row ? 1 : 0 }); return row;
  });
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const record: GraphRead = { method: "query", table, family: namedFamily(), phase, keys: [], documents: 0 };
    reads.push(record); const builder = query(table), withIndex = builder.withIndex.bind(builder), take = builder.take.bind(builder), unique = builder.unique.bind(builder);
    builder.withIndex = (index, callback) => { record.index = index; return withIndex(index, q => {
      if (!q || typeof q !== "object") throw Error("Expected native query builder");
      const traced: object = new Proxy(q, { get(target, key) {
        const fn: unknown = Reflect.get(target, key, target); if (typeof fn !== "function") return fn;
        return (...args: unknown[]) => { record.keys!.push([String(key), ...args]); const value: unknown = Reflect.apply(fn, target, args); return value === target ? traced : value; };
      } }); return callback(traced);
    }); };
    builder.take = async n => { record.terminal = `take:${n}`; const rows = await take(n); record.documents = rows.length; return rows; };
    builder.unique = async () => { record.terminal = "unique"; const row = await unique(); record.documents = row ? 1 : 0; return row; };
    return builder;
  });
  const check = ConvexMemoryRepository.prototype.checkDelivery;
  jest.spyOn(ConvexMemoryRepository.prototype, "checkDelivery").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, ...args) {
    phase = "final"; return await check.apply(this, args);
  });
  return { reads, clear: () => { reads.length = 0; phase = "read"; } };
}
const graphReadIdentity = ({ method, table, id, index, keys, terminal, phase }: GraphRead) => ({ method, table, id, index, keys, terminal, phase });
const originalMutableReads = (reads: GraphRead[]) => reads.filter(row => !row.family && !row.table.startsWith("runtimeAuth")
  && !["runtimeModelPolicies", "runtimeModelQualifications"].includes(row.table)).map(graphReadIdentity);
it.each([true, false])("V8 real shared=%s ancestry keeps exact values, mutable read order, raw final fence and reduces graph reads", async shared => {
  const f = await ancestryFixture(shared), args = { ...f.args, hits: f.hits, factPlan: (await plan(f)).factPlan }, before = wholeState(f);
  const observed = instrumentGraphReads(f), originalScope = createV8AuthorityReadScope(f.ctx);
  const read = await whole.readMatchesHandler(f.ctx, args, 8, originalScope);
  const delivery = await whole.finalDeliveryV8Handler(f.ctx, { reference: f.reference, bindings: read.bindings }, originalScope);
  const original = clone(observed.reads); observed.clear();
  expect(await f.call(whole.readMatchesAndDeliveryV8, args)).toEqual({ read, delivery });
  const optimized = clone(observed.reads), originalGraph = original.filter(row => row.family), optimizedGraph = optimized.filter(row => row.family);
  expect(originalGraph.length).toBeGreaterThan(20); expect(optimizedGraph.length).toBeLessThan(originalGraph.length / 2);
  expect(originalMutableReads(optimized)).toEqual(originalMutableReads(original));
  for (const phase of ["read", "final"]) {
    const first = new Map(originalGraph.filter(row => row.phase === phase).map(row => [JSON.stringify(graphReadIdentity(row)), graphReadIdentity(row)]));
    expect(optimizedGraph.filter(row => row.phase === phase).map(graphReadIdentity)).toEqual([...first.values()]);
  }
  expect(optimized.filter(row => row.phase === "final" && row.table === "runtimeAuthGrants").length).toBeGreaterThan(0);
  expect(wholeState(f)).toEqual(before);
  console.info(JSON.stringify({ type: "k26-controlled-source-parent-reads", shared, original: { queries: original.length,
    graphQueries: originalGraph.length, graphDocuments: originalGraph.reduce((n, row) => n + row.documents, 0) }, optimized: {
    queries: optimized.length, graphQueries: optimizedGraph.length, graphDocuments: optimizedGraph.reduce((n, row) => n + row.documents, 0) },
    mutableReadSequenceEqual: true, applicationWrites: 0, nativeLatency: "UNAVAILABLE" }));
});
it.each(["ancestor-hash", "ancestor-tombstone", "ancestor-duplicate", "revoked", "expiry"])("new graph parent preserves original %s refusal and complete state", async fault => {
  const f = await ancestryFixture(true), args = { ...f.args, hits: f.hits, factPlan: (await plan(f)).factPlan };
  const leaf = f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === f.leaves[0]!.lineage.sourceId)!;
  if (fault === "ancestor-hash") leaf.contentHash = "a".repeat(64);
  if (fault === "ancestor-tombstone") leaf.tombstonedAt = clock;
  if (fault === "ancestor-duplicate") f.db.seed("runtimeMemorySources", { ...leaf, _id: "duplicate-graph-leaf" });
  if (fault === "revoked") f.grant.revokedAt = clock;
  if (fault === "expiry") f.grant.expiresAt = clock;
  const before = wholeState(f), originalScope = createV8AuthorityReadScope(f.ctx);
  const original = () => whole.readMatchesHandler(f.ctx, args, 8, originalScope);
  expect(await failureValue(() => f.call(whole.readMatchesAndDeliveryV8, args))).toEqual(await failureValue(original)); expect(wholeState(f)).toEqual(before);
});
it.each(["edit", "revoke"])("final resource boundary freshly sees a late %s after graph retention and cannot commit context", async fault => {
  const f = await ancestryFixture(true), args = { ...f.args, hits: f.hits, factPlan: (await plan(f)).factPlan };
  const leaf = f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === f.leaves[0]!.lineage.sourceId)!;
  const read = whole.readMatchesHandler;
  // A controlled late read boundary, not a native concurrent transaction claim.
  const delivery = ConvexMemoryRepository.prototype.checkDelivery;
  jest.spyOn(ConvexMemoryRepository.prototype, "checkDelivery").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, ...values) {
    if (fault === "edit") leaf.contentHash = "a".repeat(64); else f.grant.revokedAt = clock;
    return await delivery.apply(this, values);
  });
  const saved = clone(f.db.table("runtimeAgentExecutions")[0]), writes = f.db.writes;
  const combined = await f.call<Awaited<ReturnType<typeof whole.readMatchesAndDeliveryV8Handler>>>(whole.readMatchesAndDeliveryV8, args);
  expect(combined.refusal).toBeDefined(); expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeAgentExecutions")[0]).toEqual(saved);
  const scope = createV8AuthorityReadScope(f.ctx); await expect(read(f.ctx, args, 8, scope)).rejects.toThrow("FORBIDDEN");
});

it.each([true, false])("save/candidate shared=%s ancestry reduces reads inside each fresh child while keeping exact writes and state", async shared => {
  const f = await ancestryFixture(shared), save = { ...f.attempt, context: "", entries: [], witnesses: [f.topWitness], completeness: "complete" as const };
  const before = { ...wholeState(f), sequence: f.db.sequence }, observed = instrumentGraphReads(f), nativeMutation = f.ctx.runMutation;
  const restore = () => { f.db.rows = clone(before.rows); f.db.writes = before.writes; f.db.sequence = before.sequence;
    Object.assign(f.native, clone(before.native)); Object.assign(f.effects, before.effects); f.scheduled.splice(0, f.scheduled.length, ...clone(before.scheduled)); };
  // K25's exact child helper/body under its original graph-disabled V8 scope.
  f.ctx.runMutation = (async (reference, args) => {
    if (getFunctionName(reference) === "runtimeAgent:prepareResolvedModelCandidateV8") {
      return f.transaction(() => agent.prepareResolvedModelCandidateV8Handler(createV8AuthorityReadScope(f.ctx), args as Parameters<typeof agent.prepareResolvedModelCandidateV8Handler>[1]));
    }
    return nativeMutation.call(f.ctx, reference, args);
  }) as MutationCtx["runMutation"];
  const original = await f.transaction(() => agent.saveAndPrepareContextV8Handler(createV8AuthorityReadScope(f.ctx), save));
  const originalAfter = wholeState(f), originalReads = clone(observed.reads); restore(); observed.clear(); f.ctx.runMutation = nativeMutation;
  const actual = await f.call(agent.saveAndPrepareContextV8, save), actualReads = clone(observed.reads);
  expect(actual).toEqual(original); expect(wholeState(f)).toEqual(originalAfter);
  expect(originalMutableReads(actualReads)).toEqual(originalMutableReads(originalReads));
  const originalGraph = originalReads.filter(row => row.family), actualGraph = actualReads.filter(row => row.family);
  expect(actualGraph.length).toBeLessThan(originalGraph.length / 2);
  expect(actual).toMatchObject({ kind: "prepared", prepared: { state: "started" } });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  console.info(JSON.stringify({ type: "k26-controlled-save-candidate-reads", shared, original: {
    total: originalReads.length, graphQueries: originalGraph.length }, optimized: { total: actualReads.length, graphQueries: actualGraph.length },
    exactStateAndMutableReadSequenceEqual: true, independentChild: true, billableAttempts: 0, nativeLatency: "UNAVAILABLE" }));
});
