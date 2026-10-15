/** Original registered handlers and actual Gateway middleware; controlled DB/component/provider peers only. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { EmbeddingModelV4 } from "@ai-sdk/provider";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import { DEFAULT_EMBEDDING_PROFILE as profile, LARGE_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { MemoryEffortTrace } from "../../../src/domain/memory-effort";
import { assertNativeArgs } from "./native-arguments";

let nativeCalls = 0;
let embeddingFault: (() => Promise<void>) | undefined;
const embeddingFactory = jest.fn<(id: string) => EmbeddingModelV4>(id => ({ specificationVersion: "v4", modelId: id,
  provider: "convexGateway.embedding", maxEmbeddingsPerCall: 1, supportsParallelCalls: false,
  doEmbed: async () => { nativeCalls++; await embeddingFault?.(); return { embeddings: [Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)], warnings: [],
    response: { body: { id: "controlled-query", model: "text-embedding-3-small", data: [{ index: 0, object: "embedding" }], usage: { prompt_tokens: 1 } } } }; },
}));
jest.unstable_mockModule("@convex-dev/ai-sdk-provider", () => ({ convexGateway: Object.assign(() => { throw Error("UNEXPECTED_CHAT"); }, { embeddingModel: embeddingFactory }) }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:query-embedding"; }
  async sendEvent() {}
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { ledger, runs, clone, clock, definitions } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const query = await import("../../../convex-dev/runtimeAgentQueryEmbedding");
const memory = await import("../../../convex-dev/runtimeMemory");
const wholeRecall = await import("../../../convex-dev/runtimeAgentRecall");
const toolRecall = await import("../../../convex-dev/runtimeMemoryQuery");
const agentTools = await import("../../../convex-dev/runtimeAgentTools");
const { ConvexMemoryRepository, createActionMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
const { readCurrentEmbeddingProfile, resolveHandler } = await import("../../../convex-dev/runtimeModelPolicy");
const { createGatewayMemoryModel } = await import("../../../convex-dev/runtimeMemoryGateway");
const { recallMemory } = await import("../../../convex-dev/runtimeMemoryServices");
beforeEach(() => { nativeCalls = 0; embeddingFault = undefined; installIngestionMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(v8 = false, lowCapConflict = false, withTool = false) {
  const f = await ingestionFixture(), oldQuery = f.ctx.runQuery.bind(f.ctx), oldMutation = f.ctx.runMutation.bind(f.ctx);
  const calls: string[] = [];
  let nativeFault: ((name: string) => Promise<void>) | undefined;
  const names = { runtimeAgent: agent, runtimeAgentQueryEmbedding: query, runtimeAgentRecall: wholeRecall, runtimeMemoryQuery: toolRecall, runtimeModelPolicy: ledger, runtimeMemory: memory, runs };
  function registration(ref: Parameters<typeof getFunctionName>[0]) {
    let name = ""; try { name = getFunctionName(ref); } catch { return undefined; }
    const [module, method] = name.split(":");
    if (!(module in names)) return undefined;
    const values = names[module as keyof typeof names] as Record<string, unknown>;
    return values[method] ? { name, value: values[method] } : undefined;
  }
  f.ctx.runQuery = (async (ref, args) => { const found = registration(ref); if (!found) return oldQuery(ref, args);
    calls.push(found.name); assertNativeArgs(found.value, args); await nativeFault?.(found.name); return invoke(found.value, f.ctx, args);
  }) as MutationCtx["runQuery"];
  let checkpointFault: (() => Promise<void>) | undefined;
  f.ctx.runMutation = (async (ref, args) => { const found = registration(ref); if (!found) return oldMutation(ref, args);
    calls.push(found.name); assertNativeArgs(found.value, args);
    await nativeFault?.(found.name);
    // Native nested mutation partial rollback is an explicit fixture transaction,
    // not an injected result that pretends the original handler ran.
    return f.transaction(async () => { if (["runtimeModelPolicy:checkpoint", "runtimeModelPolicy:checkpointRecall"].includes(found.name) && checkpointFault) await checkpointFault();
      return invoke(found.value, f.ctx, args); });
  }) as MutationCtx["runMutation"];
  if(lowCapConflict){
    const writer=new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db);
    for(const [id,text,object] of [["literal","User favorite season is autumn","autumn"],["conflict","User prefers spring","spring"]]){
      const source=await f.source(text!,`low-cap-${id}`),lineage=source.lineage;
      await ingestion.enqueueSourceEvent(f.ctx,f.reference,source);
      const fact={_id:"",factId:`low-cap-${id}`,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,ownerPrincipalId:f.reference.principalId,lineage,extractionPolicyVersion:"low-cap-v1",fact:text!,subject:"user",predicate:"favorite season",object:object!,factType:"preference" as const,confidence:1,sourceType:"manual" as const,tags:[],version:1,createdAt:clock,updatedAt:clock};
      await writer.commitDerived({source:lineage,identity:{...lineage,stage:"facts",semanticPolicyVersion:"low-cap-v1"},facts:[fact],expectedFactVersions:{[fact.factId]:0}});
    }
    for(const event of f.db.table("runtimeIngestionEvents"))Object.assign(event,{factsState:"complete",vectorsState:"complete",vectorProfilesComplete:[profile.profileId]});
  }
  if(withTool)f.grant.capabilities=[...f.grant.capabilities as string[],"tool"];
  const published=v8?await f.call<{agentId:string;version:number}>(definitions.publishVersion,{memorySpaceId:"space-a",clientMutationId:"v8-query-reader",expectedPreviousVersion:0,
    definitionInput:{...f.definitionInput,...(withTool?{tools:[{toolId:"memory.recall",toolVersion:1,registryHash:await definitions.executableRegistryHashV3(),requiredCapability:"tool",approval:"explicit"}],policies:[{policyId:"tool-recall",version:1,rules:{limits:{toolSteps:4}}}]}:{}),context:{...f.definitionInput.context,handlerId:"cortex.transcript.relevant",registryHash:lowCapConflict?await definitions.executableRegistryHashV4():await definitions.executableRegistryHashV3(),handlerVersion:lowCapConflict?2:1,
      inputSelection:lowCapConflict?{version:2}:{version:1,recentMessages:4,relevantMemories:4,relevantFacts:4,pendingEntries:4,maxMessages:16}}}}):undefined;
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: {...f.request(),...(lowCapConflict?{parts:[{type:"text" as const,text:"What is my favorite season?"}],memory:{effort:"fast" as const,maxEntries:1}}:{}),...(published?{agentId:published.agentId,agentVersion:published.version}:{})} });
  await f.call(agent.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0], attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
  await f.call(agent.startContext, attempt);
  const current = await agent.executionContext(f.ctx, attempt);
  const text = current.messages.filter(m => m.role === "user").slice(-1).map(m => typeof m.content === "string" ? m.content : m.content.filter(p => p.type === "text").map(p => p.text).join("\n")).join("\n");
  const input = { text, requestId: `context:${await semanticHash(canonicalModelJson([run.runId, 1]))}`, limit: lowCapConflict?(await import("../../../src/domain/memory-effort")).memoryEffortCandidateLimit(current.snapshot.version===8?current.snapshot.inputSelection.effort:undefined):10,...(lowCapConflict?{memory:{effort:"fast" as const}}:{}) };
  const repository = createActionMemoryRepository({ ...f.ctx, vectorSearch: async () => [] } as unknown as ActionCtx, f.reference, "read");
  const action = { ...f.ctx, vectorSearch: async () => [] } as unknown as ActionCtx;
  const state = () => clone({ rows: new Map([...f.db.rows].filter(([, rows]) => rows.length)), writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled });
  return { ...f, get grant() { return f.grant; }, attempt, input, repository, action, runBudgetId: current.run.runBudgetId, calls, state,
    checkpointFault: (value: typeof checkpointFault) => { checkpointFault = value; }, nativeFault: (value: typeof nativeFault) => { nativeFault = value; } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function preparation(f: Fixture, v8 = false) { return f.call<Awaited<ReturnType<typeof query.prepareAgentQueryEmbeddingHandler>>>(v8 ? query.prepareV8 : query.prepare, { ...f.attempt, input: f.input }); }
async function admitArgs(f: Fixture, v8 = false) {
  const p = await preparation(f, v8), pins = p.resolutions[0].snapshot.pins;
  const request = { semanticId: p.binding.semanticId, childCallId: "native-placeholder", texts: p.request.texts, inputTokens: Buffer.byteLength(f.input.text), outputTokens: 0,
    toolSteps: 0, timeoutMs: p.resolutions[0].snapshot.limits.timeoutMs, reservationUnits: p.resolutions[0].snapshot.costBound.maximumCostUnits, promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion,
    extractionVersion: pins.extractionVersion, toolRegistryVersion: pins.toolRegistryVersion, profile: p.profile,
    batch: { ordinal: 0, start: 0, end: 1 }, tools: [], options: { maxRetries: 0 } };
  return { ...f.attempt, input: f.input, bindingCanonical: canonicalModelJson(p.binding), requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(p.resolutions[0].snapshot) };
}
it("one registered preflight produces exact original profile/request/two-resolution data without writes or inference", async () => {
  expect(query.prepare.isInternal).toBe(true); expect(query.prepare.isQuery).toBe(true);
  expect(query.admit.isInternal).toBe(true); expect(query.admit.isMutation).toBe(true);
  const f = await fixture(), before = f.state(), actual = await preparation(f), r = new ConvexMemoryRepository(f.ctx, f.reference, "read");
  await r.recheckAuthority(); await r.assertReadAuthority(); await r.recheckAuthority();
  const selected = await readCurrentEmbeddingProfile(f.ctx, f.reference, "embedding.query", f.runBudgetId);
  await r.assertProfileReady(selected, f.runBudgetId); await r.recheckAuthority();
  expect(actual.profile).toEqual(selected); expect(actual.resolutions).toEqual([await resolveHandler(f.ctx, actual.binding), await resolveHandler(f.ctx, actual.binding)]);
  expect(actual.request).toEqual({ purpose: "embedding.query", operationId: `embedding.query:${JSON.stringify([f.reference.tenantId, f.reference.memorySpaceId, f.reference.principalId, f.input.requestId, profile.profileId])}`,
    policyVersion: profile.profileId, attempt: 1, profile, texts: [f.input.text] });
  expect(f.state()).toEqual(before); expect(nativeCalls).toBe(0);
});
it.each(["input", "requestId", "limit", "principal", "lease", "revocation", "expiry"])("preflight %s refuses before any model/account writes", async fault => {
  const f = await fixture(), args = { ...f.attempt, input: { ...f.input } };
  if (fault === "input") args.input.text += " changed";
  if (fault === "requestId") args.input.requestId = "another-context";
  if (fault === "limit") args.input.limit = 101;
  if (fault === "principal") args.reference = { ...args.reference, principalId: "foreign" };
  if (fault === "lease") args.leaseVersion++;
  if (fault === "revocation") f.grant.revokedAt = clock;
  if (fault === "expiry") f.grant.expiresAt = clock;
  const before = f.state(); await expect(f.call(query.prepare, args)).rejects.toThrow(); expect(f.state()).toEqual(before); expect(nativeCalls).toBe(0);
});
it("actual Gateway query plus fresh native parent makes one paid-peer call and retains UNKNOWN capture independently", async () => {
  const f = await fixture(); f.calls.length = 0;
  const value = await query.recallAgentMemory(f.action, f.attempt, f.repository, { now: () => clock }, f.input);
  expect(value).toMatchObject({ profileId: profile.profileId, items: [] }); expect(nativeCalls).toBe(1);
  expect(f.calls.filter(n => n === "runtimeAgentQueryEmbedding:prepare")).toHaveLength(1);
  expect(f.calls.filter(n => n === "runtimeAgentQueryEmbedding:admit")).toHaveLength(1);
  expect(f.calls.filter(n => n === "runtimeModelPolicy:checkpoint")).toHaveLength(1);
  expect(f.calls.filter(n => n === "runtimeModelPolicy:resolve")).toEqual([]);
  // Native preflight executes the original profile/readiness helper locally; fresh vector search and delivery retain two independent RPCs.
  expect(f.calls.filter(n => n === "runtimeModelPolicy:embeddingProfile")).toHaveLength(2);
  expect(f.calls.indexOf("runtimeModelPolicy:captureTerminalEvidence")).toBeLessThan(f.calls.indexOf("runtimeModelPolicy:attachTerminalResult"));
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "uncertain", slotReleased: true, resultAttachmentState: "attached" }]);
  expect(f.effects.saves).toBe(1);
});
it.each(["known", "unknown", "partial_write"])("checkpoint %s refusal commits reservation and rolls back only the failing native child", async fault => {
  const f = await fixture(), args = await admitArgs(f), initialRows = f.db.table("runtimeMemorySources").length;
  f.checkpointFault(async () => {
    if (fault === "partial_write") await f.source("Valid source created inside failing checkpoint child", "rolled-back-source");
    if (fault === "known") throw new ConvexError({ version: 1, code: "FORBIDDEN", message: "Known checkpoint refusal", retryable: false, outcome: "uncertain" });
    throw new Error("INJECTED_CHECKPOINT_FAILURE");
  });
  const result = await f.call<Awaited<ReturnType<typeof query.admitAgentQueryEmbeddingHandler>>>(query.admit, args);
  expect(result).toHaveProperty("refusal"); expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "reserved", slotReleased: false }]);
  expect(f.db.table("runtimeMemorySources")).toHaveLength(initialRows);
  expect(f.db.table("runtimeBudgetAccounts").filter(a => (a.activeConcurrency as number) > 0)).toHaveLength(2);
  expect(nativeCalls).toBe(0);
});
it("lost successful parent reply cannot issue another permit or native peer call", async () => {
  const f = await fixture(), args = await admitArgs(f), first = await f.call<Awaited<ReturnType<typeof query.admitAgentQueryEmbeddingHandler>>>(query.admit, args);
  expect(first).toMatchObject({ result: { admission: { status: "reserved" }, permit: { dispatchPermit: true } } });
  expect(await f.call(query.admit, args)).toMatchObject({ result: { admission: { status: "uncertain", replayAllowed: false } } });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")[0].state).toBe("dispatch_pending"); expect(nativeCalls).toBe(0);
});
it.each(["binding", "text", "profile", "revoked", "cancelled"])("fresh admission %s rejects a changed proposal without an inference or reservation", async fault => {
  const f = await fixture(), args = await admitArgs(f);
  if (fault === "binding") args.bindingCanonical = canonicalModelJson({ ...JSON.parse(args.bindingCanonical), ordinal: 1 });
  if (fault === "text" || fault === "profile") { const req = JSON.parse(args.requestCanonical); if (fault === "text") req.texts = ["other text"]; else req.profile = { ...req.profile, dimensions: 3072 }; args.requestCanonical = canonicalModelJson(req); }
  if (fault === "revoked") f.grant.revokedAt = clock;
  if (fault === "cancelled") f.db.table("runtimeBudgetAccounts").find(a => a.runBudgetId === f.runBudgetId)!.cancelled = true;
  const before = f.state(); await expect(f.call(query.admit, args)).rejects.toThrow(); expect(f.state()).toEqual(before); expect(nativeCalls).toBe(0);
});
it("generic public-style recall still runs its original guard/profile ports and produces the same tail result", async () => {
  const f = await fixture(), model = createGatewayMemoryModel(f.action, f.repository, { runBudgetId: f.runBudgetId });
  f.calls.length = 0; const value = await recallMemory({ repository: f.repository, model, clock: { now: () => clock } }, f.input);
  expect(value).toMatchObject({ profileId: profile.profileId, items: [] }); expect(nativeCalls).toBe(1);
  expect(f.calls.filter(n => n === "runtimeModelPolicy:embeddingProfile")).toHaveLength(4);
  expect(f.calls.filter(n => n === "runtimeModelPolicy:resolve")).toHaveLength(2);
  expect(f.calls.some(n => n.startsWith("runtimeAgentQueryEmbedding:"))).toBe(false);
});

it("original checkpoint denial after reservation is returned while its grant mutation rolls back", async () => {
  const f = await fixture(), args = await admitArgs(f), grant = clone(f.grant);
  f.checkpointFault(async () => { await f.ctx.db.patch("runtimeAuthGrants", f.grant._id as never, { revokedAt: clock }); });
  const result = await f.call(query.admit, args);
  expect(result).toMatchObject({ refusal: { kind: "convex", data: { code: "FORBIDDEN" } } });
  expect(f.grant).toEqual(grant); expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "reserved", slotReleased: false }]);
  expect(nativeCalls).toBe(0); expect(f.calls.filter(n => n === "runtimeModelPolicy:checkpoint")).toHaveLength(1);
});
it.each(["snapshot", "opaque", "hostile-data"])("%s refusal cannot erase the committed reservation or reach inference", async fault => {
  const f = await fixture(), args = await admitArgs(f);
  if (fault === "snapshot") args.snapshotCanonical = canonicalModelJson({ ...JSON.parse(args.snapshotCanonical), modelId: "other-model" });
  else f.checkpointFault(async () => {
    if (fault === "opaque") throw Symbol("unknown");
    const error = new ConvexError({ code: "FORBIDDEN" });
    Object.defineProperty(error, "data", { get() { throw Error("DO_NOT_INVOKE_ERROR_GETTER"); } });
    Object.defineProperty(error, "message", { get() { throw Error("DO_NOT_INVOKE_MESSAGE_GETTER"); } });
    throw error;
  });
  expect(await f.call(query.admit, args)).toHaveProperty("refusal");
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "reserved", slotReleased: false }]);
  expect(f.db.table("runtimeBudgetAccounts").filter(a => (a.activeConcurrency as number) > 0)).toHaveLength(2); expect(nativeCalls).toBe(0);
});
it("Action rethrows original bounded checkpoint refusal without refund, retry or private attachment", async () => {
  const f = await fixture(); f.checkpointFault(async () => { await f.ctx.db.patch("runtimeAuthGrants", f.grant._id as never, { revokedAt: clock }); });
  await expect(query.recallAgentMemory(f.action, f.attempt, f.repository, { now: () => clock }, f.input)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{ state: "reserved", slotReleased: false }]);
  expect(f.calls.filter(n => n === "runtimeAgentQueryEmbedding:admit")).toHaveLength(1);
  expect(f.calls.some(n => n === "runtimeModelPolicy:captureTerminalEvidence" || n === "runtimeModelPolicy:attachTerminalResult")).toBe(false); expect(nativeCalls).toBe(0);
});
it("confirmed UNKNOWN output replays through a fresh preflight and admission without another native call or liability", async () => {
  const f = await fixture(), first = await query.recallAgentMemory(f.action, f.attempt, f.repository, { now: () => clock }, f.input);
  const attempts = clone(f.db.table("runtimeModelAttempts")), accounts = clone(f.db.table("runtimeBudgetAccounts")); f.calls.length = 0;
  expect(await query.recallAgentMemory(f.action, f.attempt, f.repository, { now: () => clock }, f.input)).toEqual(first);
  expect(f.db.table("runtimeModelAttempts")).toEqual(attempts); expect(f.db.table("runtimeBudgetAccounts")).toEqual(accounts); expect(nativeCalls).toBe(1);
  expect(f.calls.filter(n => n === "runtimeAgentQueryEmbedding:prepare")).toHaveLength(2); // initial proposals plus original fresh replay resolution
  expect(f.calls.filter(n => n === "runtimeAgentQueryEmbedding:admit")).toHaveLength(1);
  expect(f.calls.some(n => n === "runtimeModelPolicy:checkpoint" || n === "runtimeModelPolicy:captureTerminalEvidence" || n === "runtimeModelPolicy:attachTerminalResult")).toBe(false);
});
it.each(["qualification", "policy", "budget", "account-reference", "parent", "source", "semantic", "batch"])("fresh admission retains current %s refusal before reservation", async fault => {
  const f = await fixture(), args = await admitArgs(f);
  if (fault === "qualification") f.db.table("runtimeModelQualifications").forEach(row => { row.revokedAt = clock; });
  if (fault === "policy") f.db.table("runtimeModelPolicies")[0].canonical = "{}";
  if (fault === "budget") f.db.table("runtimeBudgetAccounts").forEach(row => { row.uncertainUnits = 10_000_000; });
  if (fault === "account-reference") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.reference = { ...f.reference, grantVersion: 2 };
  if (fault === "parent" || fault === "source") args.bindingCanonical = canonicalModelJson({ ...JSON.parse(args.bindingCanonical), [fault === "parent" ? "parentOperationId" : "source"]: fault === "parent" ? "runtimeModelOperations:foreign" : { sourceId: "other", sourceEventId: "other", sourceRevision: 1, contentHash: "a".repeat(64) } });
  if (fault === "semantic" || fault === "batch") { const request = JSON.parse(args.requestCanonical); if (fault === "semantic") request.semanticId = "another-operation"; else request.batch = { ordinal: 1, start: 1, end: 2 }; args.requestCanonical = canonicalModelJson(request); }
  const before = f.state(); await expect(f.call(query.admit, args)).rejects.toThrow(); expect(f.state()).toEqual(before); expect(nativeCalls).toBe(0);
});
it("readiness refuses a current authorized incompatible generation before query inference", async () => {
  const f = await fixture(), source = await f.source("User likes apples", "incompatible-source");
  f.db.seed("runtimeMemoryVectorGenerations", { ...source.lineage, tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, ownerPrincipalId: source.ownerPrincipalId,
    contentHash: source.contentHash, profile: LARGE_EMBEDDING_PROFILE, processingReceiptId: "incompatible", generation: 1, createdAt: clock });
  const before = f.state(); await expect(preparation(f)).rejects.toMatchObject({ data: { code: "PROFILE_NOT_READY" } }); expect(f.state()).toEqual(before); expect(nativeCalls).toBe(0);
});
it("preflight retains Agent-before-profile failure precedence", async () => {
  const f = await fixture(); f.grant.revokedAt = clock; f.db.table("runtimeModelPolicies")[0].canonical = "{}";
  await expect(preparation(f)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); expect(nativeCalls).toBe(0);
});

it("compound admission is transactionally identical to the original admission then checkpoint handlers", async () => {
  const original = await fixture(), composed = await fixture(), left = await admitArgs(original), right = await admitArgs(composed);
  const admission = await original.call<Awaited<ReturnType<typeof ledger.admitHandler>>>(ledger.admit, { ...JSON.parse(left.bindingCanonical), requestCanonical: left.requestCanonical });
  if (admission.status !== "reserved") throw Error("EXPECTED_ORIGINAL_RESERVATION");
  const permit = await original.call(ledger.checkpoint, { reference: original.reference, attemptId: admission.attemptId, requestCanonical: admission.requestCanonical });
  expect(await composed.call(query.admit, right)).toEqual({ result: { admission, permit } });
  expect(composed.state()).toEqual(original.state()); expect(nativeCalls).toBe(0);
});


it("new V8 embedding lane matches original preflight and conservative ledger outcomes",async()=>{
  const f=await fixture(true),before=f.state();expect(await preparation(f,true)).toEqual(await preparation(f));expect(f.state()).toEqual(before);
  expect(query.prepareV8.isInternal).toBe(true);expect(query.admitV8.isInternal).toBe(true);
  const args=await admitArgs(f,true),first=await f.call(query.admitV8,args);
  expect(first).toMatchObject({result:{admission:{status:"reserved"},permit:{dispatchPermit:true}}});
  expect(await f.call(query.admitV8,args)).toMatchObject({result:{admission:{status:"uncertain",replayAllowed:false}}});
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({state:"dispatch_pending",slotReleased:false});expect(nativeCalls).toBe(0);
});
it("fresh V8 query admission reaches the new lane with one controlled peer call and independent capture/attachment",async()=>{
  const f=await fixture(true);f.calls.length=0;const result=await query.recallAgentMemoryV8(f.action,f.attempt,f.repository,{now:()=>clock},f.input);
  expect(result).toMatchObject({profileId:profile.profileId,items:[]});expect(nativeCalls).toBe(1);
  expect(f.calls.filter(name=>name==="runtimeAgentQueryEmbedding:prepareV8")).toHaveLength(1);expect(f.calls.filter(name=>name==="runtimeAgentQueryEmbedding:admitV8")).toHaveLength(1);
  expect(f.calls.filter(name=>name==="runtimeAgentQueryEmbedding:prepare"||name==="runtimeAgentQueryEmbedding:admit")).toEqual([]);
  expect(f.calls.filter(name=>name==="runtimeModelPolicy:captureTerminalEvidenceV8")).toHaveLength(1);
  expect(f.calls.filter(name=>name==="runtimeModelPolicy:attachTerminalResultV8")).toHaveLength(1);
  expect(f.calls.indexOf("runtimeModelPolicy:captureTerminalEvidenceV8")).toBeLessThan(f.calls.indexOf("runtimeModelPolicy:attachTerminalResultV8"));
  expect(f.calls.filter(name=>name==="runtimeModelPolicy:captureTerminalEvidence"||name==="runtimeModelPolicy:attachTerminalResult")).toEqual([]);
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{state:"uncertain",slotReleased:true,resultAttachmentState:"attached"}]);
});
it.each(["revocation","partial-write","opaque"])("V8 checkpoint %s preserves committed reservation and rolls back only its child",async fault=>{
  const f=await fixture(true),args=await admitArgs(f,true),grant=clone(f.grant),sources=f.db.table("runtimeMemorySources").length;
  f.checkpointFault(async()=>{if(fault==="revocation"){await f.ctx.db.patch("runtimeAuthGrants",f.grant._id as never,{revokedAt:clock});return;}
    if(fault==="partial-write")await f.source("Private checkpoint-only source","rollback-v8");throw fault==="opaque"?Symbol("opaque"):Error("PARTIAL_CHECKPOINT");});
  const result=await f.call(query.admitV8,args);expect(result).toHaveProperty("refusal");expect(f.grant).toEqual(grant);expect(f.db.table("runtimeMemorySources")).toHaveLength(sources);
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{state:"reserved",slotReleased:false}]);expect(f.db.table("runtimeBudgetAccounts").filter(row=>(row.activeConcurrency as number)>0)).toHaveLength(2);expect(nativeCalls).toBe(0);
});
it("V8 preflight/admission refuse historical snapshots without model or reservation effects",async()=>{
  const f=await fixture(),before=f.state();await expect(f.call(query.prepareV8,{...f.attempt,input:f.input})).rejects.toThrow("INVALID_STATE");
  const args=await admitArgs(f);await expect(f.call(query.admitV8,args)).rejects.toThrow("INVALID_STATE");expect(f.state()).toEqual(before);expect(nativeCalls).toBe(0);
});

it("V8 supplied native preflight data avoids the preparation RPC but fresh dispatch remains governed", async () => {
  const f=await fixture(true),proposal=await preparation(f,true);f.calls.length=0;
  const result=await query.recallAgentMemoryV8(f.action,f.attempt,f.repository,{now:()=>clock},f.input,undefined,proposal);
  expect(result).toMatchObject({profileId:profile.profileId,items:[]});expect(nativeCalls).toBe(1);
  expect(f.calls).not.toContain("runtimeAgentQueryEmbedding:prepareV8");expect(f.calls.filter(name=>name==="runtimeAgentQueryEmbedding:admitV8")).toHaveLength(1);
  expect(f.calls.indexOf("runtimeModelPolicy:captureTerminalEvidenceV8")).toBeLessThan(f.calls.indexOf("runtimeModelPolicy:attachTerminalResultV8"));
  expect(f.db.table("runtimeModelAttempts")).toMatchObject([{state:"uncertain",slotReleased:true,resultAttachmentState:"attached"}]);
});
it.each(["revoked","cancelled","forged-profile","forged-binding"])("native proposal %s is rechecked before a paid peer call",async fault=>{
 const f=await fixture(true),proposal=await preparation(f,true);
 if(fault==="revoked")f.grant.revokedAt=clock;
 if(fault==="cancelled")f.db.table("runtimeBudgetAccounts").find(row=>row.runBudgetId===f.runBudgetId)!.cancelled=true;
 if(fault==="forged-profile")proposal.request={...proposal.request,profile:{...profile,modelId:"foreign-embedding"}};
 if(fault==="forged-binding")proposal.binding={...proposal.binding,ordinal:1};
 const before=f.state();await expect(query.recallAgentMemoryV8(f.action,f.attempt,f.repository,{now:()=>clock},f.input,undefined,proposal)).rejects.toThrow();
 expect(f.state()).toEqual(before);expect(nativeCalls).toBe(0);
});

it('K28 scoped recall checkpoint runs the same original guard/accounting body with fewer native control reads',async()=>{
  const outcomes:{state:unknown;result:unknown;financial:string[];reads:number;component:string[]}[]=[];
  for(const scoped of [false,true]) {
    const f=await fixture(true),args=await admitArgs(f,true),queryPort=f.ctx.runQuery.bind(f.ctx),mutationPort=f.ctx.runMutation.bind(f.ctx),get=f.db.get.bind(f.db),dbQuery=f.db.query.bind(f.db);
    const financial:string[]=[],component:string[]=[];let reads=0;
    jest.spyOn(f.db,'query').mockImplementation(table=>{reads++;if(['runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts'].includes(table))financial.push(`query:${table}`);return dbQuery(table);});
    jest.spyOn(f.db,'get').mockImplementation(async(table,id)=>{reads++;if(['runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts'].includes(table))financial.push(`get:${table}:${String(id)}`);return await get(table,id);});
    f.ctx.runQuery=(async(ref,value)=>{let name='component';try{name=getFunctionName(ref);}catch{/* actual installed component address is retained as a distinct class */}component.push(name);return await queryPort(ref,value);}) as MutationCtx['runQuery'];
    if(!scoped)f.ctx.runMutation=(async(ref,value)=>getFunctionName(ref)==='runtimeModelPolicy:checkpointRecall'
      ?await f.call(ledger.checkpoint,value):await mutationPort(ref,value)) as MutationCtx['runMutation'];
    const result=await f.call(query.admitV8,args);
    outcomes.push({state:f.state(),result,financial,reads,component});jest.restoreAllMocks();installIngestionMockRoot();
  }
  expect(outcomes[1]!.result).toEqual(outcomes[0]!.result);expect(outcomes[1]!.state).toEqual(outcomes[0]!.state);
  expect(outcomes[1]!.financial).toEqual(outcomes[0]!.financial);expect(outcomes[1]!.reads).toBeLessThan(outcomes[0]!.reads);
  expect(outcomes[1]!.component.length).toBeLessThan(outcomes[0]!.component.length);
  console.info(JSON.stringify({type:'k28-controlled-query-checkpoint',oldReads:outcomes[0]!.reads,newReads:outcomes[1]!.reads,
    oldComponentQueries:outcomes[0]!.component.length,newComponentQueries:outcomes[1]!.component.length,financialReadSequenceEqual:true,nativeLatency:'UNAVAILABLE'}));
});

it("actual Agent cap1 indexed conflict keeps the single governed semantic fallback and original ceiling",async()=>{
  const f=await fixture(true,true);
  const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,(repository,input,selection,proposal)=>query.recallAgentMemoryV8(f.action,f.attempt,repository,{now:()=>clock},input,selection,proposal),true);
  expect(candidate).not.toBeNull();expect(nativeCalls).toBe(1);
  const current=await agent.executionContext(f.ctx,f.attempt);
  expect(current.snapshot.version).toBe(8);if(current.snapshot.version!==8)throw Error("Expected V8");
  const trace=JSON.parse(current.run.memoryEffortTraceCanonical!) as MemoryEffortTrace;
  expect(trace).toMatchObject({retrievalRoute:"semantic-v1",maxEntries:1});expect(trace.selected).toBeLessThanOrEqual(1);
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({slotReleased:true,resultAttachmentState:"attached"});
  expect(f.calls.filter(name=>name==="runtimeAgentQueryEmbedding:admitV8")).toHaveLength(1);
  expect(f.calls.indexOf("runtimeModelPolicy:captureTerminalEvidenceV8")).toBeLessThan(f.calls.indexOf("runtimeModelPolicy:attachTerminalResultV8"));
});

/** Parent-bound tool recall: real Agent/approval/ledger handlers, controlled provider only. */
async function approvedRecallFixture() {
  const f=await fixture(true,false,true);
  await f.call(agent.saveContext,{...f.attempt,context:"",witnesses:[],completeness:"complete"});
  const model=await f.call<{operationId:string;semanticId:string}>(agent.beginOperation,{...f.attempt,kind:"model",ordinal:0,requestCanonical:"{}"});
  await f.call(agent.startOperation,{...f.attempt,operationId:model.operationId});
  const resolved=await f.call<Awaited<ReturnType<typeof resolveHandler>>>(ledger.resolve,{reference:f.reference,operationKey:"agent.respond",runBudgetId:f.runBudgetId});
  const pins=resolved.snapshot.pins,request={semanticId:model.semanticId,childCallId:"controlled-parent",texts:["Hello world!"],messages:[{role:"user" as const,parts:[{type:"text" as const,text:"Hello world!"}]}],
    inputTokens:1,outputTokens:20,toolSteps:0,timeoutMs:1000,reservationUnits:resolved.snapshot.costBound.maximumCostUnits,...pins,tools:[],options:{maxRetries:0 as const}};
  const {priceRevision:_price,boundRevision:_bound,...nativeRequest}=request;
  nativeRequest.inputTokens=ledger.deriveQualifiedInputBound(resolved.dispatchEvidence,nativeRequest);
  const parent=await f.call<{operationId:import("../../../convex-dev/_generated/dataModel").Id<"runtimeModelOperations">}>(ledger.admit,{reference:f.reference,operationKey:"agent.respond",runBudgetId:f.runBudgetId,semanticId:model.semanticId,ordinal:0,requestCanonical:canonicalModelJson(nativeRequest)});
  await f.call(agent.bindNativeOperation,{...f.attempt,operationId:model.operationId,nativeOperationId:parent.operationId});
  const original=f.native.messages.get((f.db.table("runtimeRuns")[0].inputMessageIds as string[])[0])!;
  const message={...original,_id:"native:recall-call",stepOrder:1,message:{role:"assistant",content:"controlled tool request"}};f.native.messages.set(message._id,message);
  await f.call(agent.finishOperation,{...f.attempt,operationId:model.operationId,resultCanonical:"{}",nativeMessageIds:[message._id]});
  const text="preferred drink",limit=2;
  const tool=await f.call<{operationId:string}>(agent.beginOperation,{...f.attempt,kind:"tool",ordinal:0,toolCallId:"recall-call",toolName:"memory_recall",requestCanonical:canonicalModelJson({text,limit})});
  // The real direct continuation owns a Workflow before deferred approval.
  // Its controlled Workflow peer is not executed by this native ledger test.
  await f.db.patch("runtimeAgentExecutions",f.db.table("runtimeAgentExecutions")[0]._id,{workflowId:"workflow:query-embedding"});
  await f.call(agent.waitForApproval,{...f.attempt,operationId:tool.operationId});
  await f.call(agent.approveTool,{runId:f.attempt.runId,operationId:tool.operationId,expectedRequestHash:await semanticHash(canonicalModelJson({text,limit}))});
  await f.call(agent.startOperation,{...f.attempt,operationId:tool.operationId});
  const source=await f.source("User prefers green tea","tool-recall-source");
  const writer=new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db);
  await writer.commitDerived({source:source.lineage,identity:{...source.lineage,stage:"facts",semanticPolicyVersion:"controlled-tool"},facts:[{_id:"",factId:"native-tool-fact",fact:"User prefers green tea",subject:"user",predicate:"prefers",object:"green tea",factType:"preference",confidence:90,tags:[],entities:[],relations:[],sourceType:"manual",lineage:source.lineage,extractionPolicyVersion:"controlled-tool",version:1,createdAt:clock,updatedAt:clock,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,ownerPrincipalId:f.reference.principalId}],expectedFactVersions:{"native-tool-fact":0}});
  const args={reference:f.reference,runBudgetId:f.runBudgetId,input:{text,limit,requestId:tool.operationId},tool:{runId:f.attempt.runId,attemptNumber:f.attempt.attemptNumber,leaseVersion:f.attempt.leaseVersion,operationId:tool.operationId,parentOperationId:parent.operationId}};
  const check=jest.fn(async()=>{await f.call(agent.checkActiveTool,{...f.attempt,operationId:tool.operationId});});
  const binding={reference:f.reference,runBudgetId:f.runBudgetId,operationId:tool.operationId,parentOperationId:parent.operationId,nativeRecall:async(input:{text:string;limit:number})=>await toolRecall.recallToolMemory(f.action,{...args,input:{...input,requestId:tool.operationId}},check),checkCurrent:check,
    writeSource:jest.fn(async()=>{throw Error("UNEXPECTED_WRITE");}),commitDerived:jest.fn(async()=>{throw Error("UNEXPECTED_WRITE");})};
  f.calls.length=0;return {...f,args,binding,source,tool};
}
it("approved native tool composition retains exact result/witnesses and primary account, then replays without another embedding",async()=>{
  const f=await approvedRecallFixture();
  const result=await agentTools.executeServerTool(f.action,f.binding,"memory.recall",{text:f.args.input.text,limit:2});
  expect(result.result).toMatchObject({context:expect.stringContaining("green tea"),profileId:profile.profileId});
  expect(result.witnesses).toEqual([{sourceId:f.source.lineage.sourceId,sourceEventId:f.source.lineage.sourceEventId,sourceRevision:1,contentHash:f.source.contentHash,permissions:["canViewFacts"]}]);
  expect(nativeCalls).toBe(1);expect(f.binding.checkCurrent).toHaveBeenCalled();expect(f.binding.writeSource).not.toHaveBeenCalled();expect(f.binding.commitDerived).not.toHaveBeenCalled();
  expect(f.calls).toContain("runtimeMemoryQuery:prepareToolRecall");expect(f.calls).toContain("runtimeMemoryQuery:admitToolRecall");expect(f.calls).toContain("runtimeModelPolicy:checkpointRecall");
  expect(f.calls).not.toContain("runtimeModelPolicy:embeddingProfile");expect(f.calls).not.toContain("runtimeMemory:readSource");
  expect(f.calls.indexOf("runtimeModelPolicy:captureTerminalEvidence")).toBeLessThan(f.calls.indexOf("runtimeModelPolicy:attachTerminalResult"));
  const child=f.db.table("runtimeModelOperations").find(row=>row.operationKey==="embedding.query")!;
  expect(child).toMatchObject({parentOperationId:f.args.tool.parentOperationId,runAccountId:f.db.table("runtimeRuns")[0].runAccountId});
  const attempts=f.db.table("runtimeModelAttempts").filter(row=>row.operationDocumentId===child._id);expect(attempts).toHaveLength(1);expect(attempts[0]).toMatchObject({state:"uncertain",slotReleased:true,resultAttachmentState:"attached"});
  expect(await agentTools.executeServerTool(f.action,f.binding,"memory.recall",{text:f.args.input.text,limit:2})).toEqual(result);expect(nativeCalls).toBe(1);expect(f.db.table("runtimeModelAttempts").filter(row=>row.operationDocumentId===child._id)).toHaveLength(1);
  const {nativeRecall:_native,...legacy}=f.binding;
  expect(await agentTools.executeServerTool(f.action,legacy,"memory.recall",{text:f.args.input.text,limit:2})).toEqual(result);
  expect(nativeCalls).toBe(1);expect(f.db.table("runtimeModelAttempts").filter(row=>row.operationDocumentId===child._id)).toHaveLength(1);
});
it.each(["input","budget","parent","lease","approval","cancel","revocation"])("parent-bound native tool preparation rejects changed %s without dispatch or ledger effects",async fault=>{
  const f=await approvedRecallFixture(),args=structuredClone(f.args);
  if(fault==="input")args.input.text+=" changed";
  if(fault==="budget")args.runBudgetId="wrong-budget";
  if(fault==="parent")args.tool.parentOperationId="runtimeModelOperations:foreign" as never;
  if(fault==="lease")args.tool.leaseVersion++;
  if(fault==="approval")delete f.db.table("runtimeAgentOperations").find(row=>row.operationId===f.tool.operationId)!.approvalActor;
  if(fault==="cancel")f.db.table("runtimeRuns")[0].cancellationRequestedAt=clock;
  if(fault==="revocation")f.grant.revokedAt=clock;
  const before=f.state();await expect(f.call(toolRecall.prepareToolRecall,args)).rejects.toThrow();
  expect(f.state()).toEqual(before);expect(nativeCalls).toBe(0);
});
it.each(["known","partial-write"])("tool checkpoint %s refusal retains reservation, rolls back child writes and dispatches nothing",async fault=>{
  const f=await approvedRecallFixture();
  f.checkpointFault(async()=>{if(fault==="partial-write")await f.db.patch("runtimeAuthGrants",f.grant._id,{revokedAt:clock});throw new ConvexError({code:"FORBIDDEN"});});
  await expect(toolRecall.recallToolMemory(f.action,f.args,f.binding.checkCurrent)).rejects.toThrow("FORBIDDEN");
  const child=f.db.table("runtimeModelOperations").find(row=>row.operationKey==="embedding.query")!;
  expect(child).toBeDefined();expect(f.db.table("runtimeModelAttempts").find(row=>row.operationDocumentId===child._id)).toMatchObject({state:"reserved",slotReleased:false});
  expect(f.db.table("runtimeAuthGrants")[0].revokedAt).toBeUndefined();expect(nativeCalls).toBe(0);
  expect(f.calls).not.toContain("runtimeModelPolicy:captureTerminalEvidence");expect(f.calls).not.toContain("runtimeMemoryQuery:readToolMatches");
});
it("revocation after one tool embedding retains UNKNOWN accounting but withholds attachment and all context",async()=>{
  const f=await approvedRecallFixture();embeddingFault=async()=>{f.grant.revokedAt=clock;};
  await expect(toolRecall.recallToolMemory(f.action,f.args,f.binding.checkCurrent)).rejects.toThrow();
  const child=f.db.table("runtimeModelOperations").find(row=>row.operationKey==="embedding.query")!;
  expect(f.db.table("runtimeModelAttempts").find(row=>row.operationDocumentId===child._id)).toMatchObject({state:"uncertain",slotReleased:true,resultWithheld:true,resultAttachmentState:"closed"});
  expect(nativeCalls).toBe(1);expect(f.calls).not.toContain("runtimeMemoryQuery:readToolMatches");
  expect(f.db.table("runtimeBudgetAccounts").find(row=>row.runBudgetId===f.runBudgetId)!.uncertainUnits).toBeGreaterThan(0);
});
it.each(["cancel","source-revision","source-tombstone","expiry"])("fresh tool final delivery refuses %s after validated native reads",async fault=>{
  const f=await approvedRecallFixture();let reached=false;
  f.nativeFault(async name=>{if(name!=="runtimeMemoryQuery:deliverToolRecall")return;reached=true;
    if(fault==="cancel")f.db.table("runtimeRuns")[0].cancellationRequestedAt=clock;
    if(fault==="source-revision")f.db.table("runtimeMemorySources").find(row=>(row.lineage as {sourceId:string}).sourceId===f.source.lineage.sourceId)!.lineage={...f.source.lineage,sourceRevision:2};
    if(fault==="source-tombstone")f.db.table("runtimeMemorySources").find(row=>(row.lineage as {sourceId:string}).sourceId===f.source.lineage.sourceId)!.tombstonedAt=clock;
    if(fault==="expiry")f.grant.expiresAt=clock;
  });
  await expect(toolRecall.recallToolMemory(f.action,f.args,f.binding.checkCurrent)).rejects.toThrow();
  expect(reached).toBe(true);expect(nativeCalls).toBe(1);expect(f.binding.writeSource).not.toHaveBeenCalled();expect(f.binding.commitDerived).not.toHaveBeenCalled();
  const child=f.db.table("runtimeModelOperations").find(row=>row.operationKey==="embedding.query")!;
  expect(f.db.table("runtimeModelAttempts").filter(row=>row.operationDocumentId===child._id)).toHaveLength(1);
  expect(f.db.table("runtimeModelAttempts").find(row=>row.operationDocumentId===child._id)).toMatchObject({state:"uncertain",slotReleased:true,resultAttachmentState:"attached"});
});
