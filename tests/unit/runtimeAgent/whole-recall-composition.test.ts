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
let nativeSnapshotReads = true;
const originalAuth = await import("../../../convex-dev/runtimeAuth");
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...originalAuth,
  readTenantPolicyRows:async(ctx:Parameters<typeof originalAuth.readTenantPolicyRows>[0],tenantId:string)=>nativeSnapshotReads
    ?originalAuth.readTenantPolicyRows(ctx,tenantId):ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active",q=>q.eq("scope","tenant").eq("tenantId",tenantId).eq("active",true)).take(65),
  readExecutableDefinitionRows:async(ctx:Parameters<typeof originalAuth.readExecutableDefinitionRows>[0],tenantId:string,memorySpaceId:string,agentId:string,version:number)=>nativeSnapshotReads
    ?originalAuth.readExecutableDefinitionRows(ctx,tenantId,memorySpaceId,agentId,version):ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_version",q=>q.eq("tenantId",tenantId).eq("memorySpaceId",memorySpaceId).eq("agentId",agentId).eq("version",version)).take(2),
  // Only bridgeFor changed in K29. DataAuth's old managed graph reads remain
  // active in the a773 control, preserving its original traversal behavior.
  readManagedTranscriptBridgeRows:async(ctx:Parameters<typeof originalAuth.readManagedTranscriptBridgeRows>[0],tenantId:string,memorySpaceId:string,nativeMessageId:string)=>!nativeSnapshotReads&&(new Error().stack??"").includes("bridgeFor")
    ?ctx.db.query("runtimeTranscriptMessages").withIndex("by_native",q=>q.eq("tenantId",tenantId).eq("memorySpaceId",memorySpaceId).eq("nativeMessageId",nativeMessageId)).take(2)
    :originalAuth.readManagedTranscriptBridgeRows(ctx,tenantId,memorySpaceId,nativeMessageId),
  withNativeSnapshotReads: <Ctx extends Parameters<typeof originalAuth.withNativeSnapshotReads>[0]>(nativeCtx: Ctx, parent: Ctx): Ctx => nativeSnapshotReads
    ? originalAuth.withNativeSnapshotReads(nativeCtx, parent) : originalAuth.withManagedSourceValidationReads(nativeCtx, parent),
}));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { runs, clock, definitions, clone } = await import("../runtimeTranscript/fixture");
const agent = await import("../../../convex-dev/runtimeAgent");
const whole = await import("../../../convex-dev/runtimeAgentRecall");
const queryEmbedding = await import("../../../convex-dev/runtimeAgentQueryEmbedding");
const { createV8AuthorityReadScope } = await import("../../../convex-dev/runtimeAuth");
const memory = await import("../../../convex-dev/runtimeMemory");
const { ConvexMemoryRepository, createActionMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const {replaceFactEntityLinks}=await import("../../../convex-dev/runtimeMemoryTraversal");
const { explicitSourceLineage, vectorRecallItems, completeRecallDelivery } = await import("../../../convex-dev/runtimeMemoryServices");
beforeEach(() => { installIngestionMockRoot(); nativeSnapshotReads = true; });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(v8 = false,effortAware=false,effort:"normal"|"fast"|"max"="normal",independentSeeds=0,seedWork?:number,directLookup:boolean|"fruit"=false,repeatedQuestions=0,linkedConflict=false,observedProjections:boolean|"contradiction"|"canonical-mismatch"|"singleton"=false,observedQuery?:string,requestedMaxEntries?:number) {
  const f = await ingestionFixture(), scope = memoryScope(f.reference), writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db);
  const observedContent=observedProjections==="canonical-mismatch"?"My favorite fruit is pear.":"My favorite fruit is apricot.";
  const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, "whole-source"), directLookup==="fruit"?observedProjections?observedContent:"My favorite fruit is apricot. Please acknowledge it in one brief sentence.":"My favorite season is autumn", { now: () => clock });
  await writer.putSource(prepared.source);await ingestion.enqueueSourceEvent(f.ctx, f.reference, prepared.source);
  const source = { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1 };
  const identity = { ...source, stage: "facts" as const, semanticPolicyVersion: "policy-v1" };
  const fact: DerivedFact = { _id: "", factId: "whole-fact", tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
    ownerPrincipalId: scope.principalId, lineage: prepared.source.lineage, extractionPolicyVersion: "policy-v1", fact: directLookup==="fruit"?"User\'s favorite fruit is apricot.":directLookup?"User favorite season is autumn":"User prefers autumn",...(directLookup?{subject:observedProjections==="singleton"?"User":"user",predicate:directLookup==="fruit"?"is_favorite_fruit":"favorite season",object:directLookup==="fruit"?"apricot":"autumn"}:{}),
    factType: "preference", confidence: 91, sourceType: "manual", tags: [], version: 1, createdAt: clock, updatedAt: clock };
  const initialFacts=observedProjections==="contradiction"||observedProjections==="canonical-mismatch"?["apricot",observedProjections==="contradiction"?"pear":"apricot"].map((value,index)=>({...fact,factId:`unstructured-agent-${index}`,fact:`My favorite fruit is ${value}.`,subject:undefined,predicate:undefined,object:undefined}))
  :[fact,...(observedProjections?[
    {...fact,factId:"whole-likes",fact:observedProjections==="singleton"?"User likes apricot.":"User likes fruit.",subject:"User",predicate:"likes",object:observedProjections==="singleton"?"apricot":"fruit"},
    ...(observedProjections==="singleton"?[]:[{...fact,factId:"whole-general",fact:"User stated a specific preference for a type of fruit.",subject:"User",predicate:"has_a_preference_for",object:"apricot"}]),
  ]:[])];
  await writer.commitDerived({ source, identity, chunks: prepared.chunks, vectors: [{ ...source, vectorId: "whole-vector", chunkId: prepared.chunks[0]!.chunkId,
    tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, profile, embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0), processingReceiptId: await processingIdentityKey(identity) }],
    facts: initialFacts, expectedFactVersions: Object.fromEntries(initialFacts.map(value=>[value.factId,0])) });
  if(observedProjections){
    // Correct only this controlled native search port's '?' tokenization to
    // reproduce the actual hosted three-candidate result; repository guards,
    // indexed entity links and canonical source reads remain the real code.
    const nativeQuery=f.db.query.bind(f.db);jest.spyOn(f.db,"query").mockImplementation(table=>{
      const builder=nativeQuery(table);if(table!=="facts")return builder;const nativeSearch=builder.withSearchIndex.bind(builder);
      builder.withSearchIndex=(index,callback)=>nativeSearch(index,q=>{
        if(q===null||typeof q!=="object")throw Error("Expected native search port");
        return callback(new Proxy(q,{get(target,key){const method:unknown=Reflect.get(target,key,target);return key==="search"&&typeof method==="function"
          ?(field:string,text:string)=>Reflect.apply(method,target,[field,text.replace(/\?$/u,"")]):method;}}));
      });return builder;
    });
  }
  Object.assign(f.db.table("runtimeIngestionEvents")[0], { factsState: "complete", vectorsState: "complete", vectorProfilesComplete: [profile.profileId] });
  for(let i=0;i<independentSeeds;i++){
    const current=await prepareSourceContent(scope,explicitSourceLineage(scope,`direct-seed-${i}`),`Independent direct source ${i}`,{now:()=>clock});await writer.putSource(current.source);await ingestion.enqueueSourceEvent(f.ctx,f.reference,current.source);
    const lineage=current.source.lineage,identity={...lineage,stage:"facts" as const,semanticPolicyVersion:"independent-v1"};
    const fact:DerivedFact={_id:"",factId:`independent-${i}`,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,ownerPrincipalId:scope.principalId,lineage,extractionPolicyVersion:"independent-v1",fact:`Hello world independent match ${i}`,factType:"knowledge",confidence:90,sourceType:"manual",tags:[],version:1,createdAt:clock,updatedAt:clock};
    await writer.commitDerived({source:lineage,identity,facts:[fact],expectedFactVersions:{[fact.factId]:0}});
  }
  if(linkedConflict)for(let i=0;i<14;i++){
    const current=await prepareSourceContent(scope,explicitSourceLineage(scope,`unrelated-candidate-${i}`),`This is independent knowledge ${i}`,{now:()=>clock});await writer.putSource(current.source);await ingestion.enqueueSourceEvent(f.ctx,f.reference,current.source);
    const lineage=current.source.lineage,identity={...lineage,stage:"facts" as const,semanticPolicyVersion:"candidate-v1"},candidate:DerivedFact={...fact,_id:"",factId:`unrelated-candidate-${i}`,lineage,fact:current.source.content,subject:`Other${i}`,predicate:"is",object:`knowledge${i}`};
    await writer.commitDerived({source:lineage,identity,facts:[candidate],expectedFactVersions:{[candidate.factId]:0}});
  }
  for(let i=0;i<repeatedQuestions;i++){
    const current=await prepareSourceContent(scope,explicitSourceLineage(scope,`prior-question-${i}`),"What is my favorite fruit?",{now:()=>clock});await writer.putSource(current.source);await ingestion.enqueueSourceEvent(f.ctx,f.reference,current.source);
    const lineage=current.source.lineage,identity={...lineage,stage:"facts" as const,semanticPolicyVersion:"question-v1"};
    const projection:DerivedFact={...fact,_id:"",factId:`question-projection-${i}`,lineage,fact:"User has a favorite fruit.",subject:"User",predicate:"has",object:"favorite fruit"};
    await writer.commitDerived({source:lineage,identity,chunks:current.chunks,vectors:[{...lineage,vectorId:`question-vector-${i}`,chunkId:current.chunks[0]!.chunkId,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,profile,embedding:Array.from({length:1536},(_,j)=>j===0?1:0),processingReceiptId:await processingIdentityKey(identity)}],...(i===0?{facts:[projection],expectedFactVersions:{[projection.factId]:0}}:{})});
  }
  if(linkedConflict){
    const current=await prepareSourceContent(scope,explicitSourceLineage(scope,"linked-plum"),"My favorite fruit is plum.",{now:()=>clock});await writer.putSource(current.source);await ingestion.enqueueSourceEvent(f.ctx,f.reference,current.source);
    const lineage=current.source.lineage,identity={...lineage,stage:"facts" as const,semanticPolicyVersion:"conflict-v1"},candidate:DerivedFact={...fact,_id:"",factId:"linked-plum",lineage,fact:"User's favorite fruit is plum.",object:"plum"};
    await writer.commitDerived({source:lineage,identity,facts:[candidate],expectedFactVersions:{[candidate.factId]:0}});
  }
  for(const event of f.db.table("runtimeIngestionEvents"))Object.assign(event,{factsState:"complete",vectorsState:"complete",vectorProfilesComplete:[profile.profileId]});
  const startupMutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name = "";try { name = getFunctionName(ref); } catch { return startupMutation(ref, args); }
    if (name === "runs:claimNext" || name === "runs:claimNextV8") return await f.transaction(() => invoke(name.endsWith("V8") ? runs.claimNextV8 : runs.claimNext, f.ctx, args));
    return startupMutation(ref, args);
  }) as MutationCtx["runMutation"];
  const published = v8 ? await f.call<{agentId:string;version:number}>(definitions.publishVersion, { memorySpaceId:"space-a",clientMutationId:"v8-recall-read-scope",expectedPreviousVersion:0,
    definitionInput:{...f.definitionInput,context:{...f.definitionInput.context,handlerId:"cortex.transcript.relevant",registryHash:effortAware?await definitions.executableRegistryHashV4():await definitions.executableRegistryHashV3(),handlerVersion:effortAware?2:1,
      inputSelection:effortAware?{version:2,...(seedWork===undefined?{}:{effort:{version:1,maxWork:seedWork}})}:{version:1,recentMessages:4,relevantMemories:4,relevantFacts:4,pendingEntries:4,maxMessages:16}}} }) : undefined;
  const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: { ...f.request(), ...(directLookup?{parts:[{type:"text" as const,text:observedQuery??(directLookup==="fruit"?"What is my favorite fruit?":"What is my favorite season?")}]}:{}), ...(published ? {agentId:published.agentId,agentVersion:published.version,...(effortAware?{memory:{effort,...(requestedMaxEntries===undefined?{}:{maxEntries:requestedMaxEntries})}}:{})}: {}) } });await f.call(agent.start, { runId: run.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0];
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };await f.call(agent.startContext, attempt);
  const current = await agent.executionContext(f.ctx, attempt);
  const input = { text: current.messages.filter(m => m.role === "user").slice(-1).map(m => typeof m.content === "string" ? m.content : m.content.filter(p => p.type === "text").map(p => p.text).join("\n")).join("\n"),
    requestId: `context:${await semanticHash(canonicalModelJson([run.runId, 1]))}`, limit: (await import("../../../src/domain/memory-effort")).memoryEffortCandidateLimit(current.snapshot.version===8?current.snapshot.inputSelection.effort:undefined),...(effortAware?{memory:{effort}}:{}) };
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
  const hits = f.db.table("runtimeMemoryVectors").map(row => ({ id: row._id as Id<"runtimeMemoryVectors">, score: String(row.vectorId).startsWith("question-vector-")?1.000000238418579:0.9 }));
  const action = { ...f.ctx, vectorSearch: async () => hits.map(hit => ({ _id: hit.id, _score: hit.score })) } as unknown as ActionCtx;
  return { ...f, get grant() { return f.grant; }, args, attempt, profile, input, selection, hits, action, calls, physicalQueries, beforeDeliveryQueries: () => beforeDeliveryQueries, current };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function plan(f: Fixture) { return await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReads, f.args); }
async function matched(f: Fixture, prepared?: Awaited<ReturnType<typeof whole.prepareReadsHandler>>) {
  const proposed = prepared ?? await plan(f);
  return await f.call<Awaited<ReturnType<typeof whole.readMatchesHandler>>>(whole.readMatches, { ...f.args, hits: f.hits, factPlan: proposed.factPlan });
}
it("actual V8 Action uses shared indexed traversal for effort-aware recall and keeps its source witnesses",async()=>{
 const f=await fixture(true,true),selected:unknown[]=[];
 const result=await whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>clock},f.input,profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},{...f.selection,onSelected:value=>selected.push(value)},clock);
 expect(result.memoryEffort).toMatchObject({requestedEffort:"normal",maxDepth:4,maxEntries:8,selected:2});expect(result.items.find(item=>item.id==="whole-fact")?.retrieval?.depth).toBe(2);
 expect(selected).toMatchObject([{witnesses:[expect.objectContaining({sourceId:expect.any(String)})]}]);expect(f.calls).toContain("runtimeAgentRecall:readMatchesV8");
});
it("V2 traversal cannot replace a stale prepared fact binding with a new version while delivering its old text",async()=>{
 const f=await fixture(true,true);const args={...f.args,hits:f.hits,factPlan:(await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReadsV8,f.args)).factPlan};
 // Seed a fact explicitly in the prepared read plan, isolating the cross-RPC race.
 const row=f.db.table("facts")[0]!,reader=new ConvexMemoryRepository(f.ctx,f.reference,"read"),prior=(await reader.listFacts({limit:1}))[0]!;
 const {captureRecallFact}=await import("../../../convex-dev/runtimeMemoryRepository");const bindings={sources:[],facts:[],vectors:[]};await captureRecallFact(bindings,prior,await reader.getSource(prior.lineage.sourceId));
 args.factPlan={kind:"ready",facts:[prior],bindings};await f.db.patch("facts",row._id,{fact:"changed current value",version:2});
 await expect(f.call(whole.readMatchesV8,args)).rejects.toThrow("STALE_SOURCE");
});
it("Fast Agent retrieval starts after prior embedding latency and retains real linked context",async()=>{
 const f=await fixture(true,true,"fast"),afterEmbedding=clock+1000;
 const result=await whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>afterEmbedding},f.input,profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},{...f.selection,onSelected:()=>{}},afterEmbedding);
 expect(result.items.some(item=>item.id==="whole-fact"&&item.retrieval?.depth===2)).toBe(true);expect(result.memoryEffort!.stopReasons).not.toContain("deadline");expect(result.memoryEffort!.requestedEffort).toBe("fast");
});
it("actual Max Agent composition selects all12 independent direct matches beyond the old10 seed ceiling",async()=>{
 const f=await fixture(true,true,"max",12);expect(f.input.limit).toBeGreaterThan(12);
 const result=await whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>clock},f.input,profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},{...f.selection,onSelected:()=>{}},clock);
 const independent=result.items.filter(item=>item.id.startsWith("independent-"));expect(independent).toHaveLength(12);expect(independent.every(item=>item.retrieval?.depth===1)).toBe(true);expect(independent.map(item=>item.id)).toContain("independent-11");expect(result.memoryEffort!.maxEntries).toBeNull();
});
it("Max Agent reports a clamped direct-seed work bound instead of claiming complete discovery",async()=>{
 const f=await fixture(true,true,"max",13,96);expect(f.input.limit).toBe(12);
 f.db.table("facts").find(row=>row.factId==="independent-0")!.tombstonedAt=clock;
 const result=await whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>clock},f.input,profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},{...f.selection,onSelected:()=>{}},clock);
 expect(result.items.filter(item=>item.id.startsWith("independent-")).length).toBe(11);expect(result.items.some(item=>item.id==="independent-11")).toBe(true);expect(result.items.some(item=>item.id==="independent-12")).toBe(false);expect(result.memoryEffort!.stopReasons).toContain("work");expect(result.memoryEffort!.unavailableStages).toContain("direct-fact-candidate-work-bound");
});
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
 const f=await fixture(true),get=f.db.get.bind(f.db),query=f.db.query.bind(f.db),seen:{table:string;id:string}[]=[],queries:{table:string;index?:string;keys:unknown[];limit?:number}[]=[];
 jest.spyOn(f.db,"get").mockImplementation(async(table,id)=>{seen.push({table,id});return await get(table,id);});
 jest.spyOn(f.db,"query").mockImplementation(table=>{const record:typeof queries[number]={table,keys:[]};queries.push(record);const builder=query(table),withIndex=builder.withIndex.bind(builder),take=builder.take.bind(builder);
  builder.withIndex=(index,callback)=>{record.index=index;return withIndex(index,q=>{if(q===null||typeof q!=="object")throw Error("Expected original index query object");const traced=new Proxy(q,{get(target,key){const value:unknown=Reflect.get(target,key,target);if(typeof value!=="function")return value;return(...args:unknown[])=>{record.keys.push([String(key),...args]);const result:unknown=Reflect.apply(value,target,args);return result===target?traced:result;};}});return callback(traced);});};
  builder.take=async limit=>{record.limit=limit;return await take(limit);};return builder;});
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
 // Only this exact bounded raw run index joins the existing retainable rows.
 // All other run indexes, mutable reads and every source/authority guard remain.
 const rawRun=(row:typeof queries[number])=>row.table==="runtimeRuns"&&row.index==="by_scoped_id";
 const mutableQueries=(reads:typeof queries)=>reads.filter(row=>!row.table.startsWith("runtimeAuth") && !["runtimeModelPolicies","runtimeModelQualifications","runtimeAgentDefinitions"].includes(row.table) && !(row.table==="runtimeTranscriptMessages"&&row.index==="by_native")&&!rawRun(row));
 expect(mutableQueries(parentInitialQueries)).toEqual(mutableQueries(originalInitialQueries));expect(mutableQueries(parentTailQueries)).toEqual(mutableQueries(originalTailQueries));
 const identities=(reads:typeof queries)=>[...new Set(reads.filter(rawRun).map(row=>JSON.stringify(row)))].sort();
 expect(identities(parentInitialQueries)).toEqual(identities(originalInitialQueries));expect(identities(parentTailQueries)).toEqual(identities(originalTailQueries));
 expect(parentInitialQueries.filter(rawRun).length).toBeLessThan(originalInitialQueries.filter(rawRun).length);
 expect(parentTailQueries.filter(rawRun).length).toBeLessThanOrEqual(originalTailQueries.filter(rawRun).length);
 expect([...parentInitialQueries,...parentTailQueries].filter(rawRun).every(row=>row.limit===2)).toBe(true);
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
  const namedFamily = () => /readManaged(?:SourceRows|SourceUniqueRow|ConversationRows|TranscriptBridgeRows|SourceRunRows)/.test(new Error().stack ?? "");
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
const rootUniqueReads = (reads: GraphRead[]) => reads.filter(row => row.family && row.table === "runtimeMemorySources" && row.terminal === "unique");
const originalMutableReads = (reads: GraphRead[]) => reads.filter(row => !row.family && !row.table.startsWith("runtimeAuth")
  && !["runtimeModelPolicies", "runtimeModelQualifications", "runtimeAgentDefinitions"].includes(row.table)).map(graphReadIdentity);
it.each([true, false])("V8 real shared=%s ancestry keeps exact values, mutable read order, raw final fence and reduces graph reads", async shared => {
  const f = await ancestryFixture(shared), args = { ...f.args, hits: f.hits, factPlan: (await plan(f)).factPlan }, before = wholeState(f);
  const observed = instrumentGraphReads(f), originalScope = createV8AuthorityReadScope(f.ctx);
  const read = await whole.readMatchesHandler(f.ctx, args, 8, originalScope);
  const delivery = await whole.finalDeliveryV8Handler(f.ctx, { reference: f.reference, bindings: read.bindings }, originalScope);
  const original = clone(observed.reads); observed.clear();
  expect(await f.call(whole.readMatchesAndDeliveryV8, args)).toEqual({ read, delivery });
  const optimized = clone(observed.reads), originalGraph = original.filter(row => row.family), optimizedGraph = optimized.filter(row => row.family);
  expect(originalGraph.length).toBeGreaterThan(20); expect(optimizedGraph.length).toBeLessThan(originalGraph.length / 2);
  expect(rootUniqueReads(optimized).length).toBeLessThan(rootUniqueReads(original).length);
  expect(new Set(rootUniqueReads(optimized).map(row => JSON.stringify(graphReadIdentity(row))))).toEqual(new Set(rootUniqueReads(original).map(row => JSON.stringify(graphReadIdentity(row)))));
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

it.each([true, false])("atomic save/candidate shared=%s ancestry reduces raw reads while keeping exact writes and state", async shared => {
  const f = await ancestryFixture(shared), save = { ...f.attempt, context: "", entries: [], witnesses: [f.topWitness], completeness: "complete" as const };
  const before = { ...wholeState(f), sequence: f.db.sequence }, observed = instrumentGraphReads(f), callsBefore = f.calls.length;
  const restore = () => { f.db.rows = clone(before.rows); f.db.writes = before.writes; f.db.sequence = before.sequence;
    Object.assign(f.native, clone(before.native)); Object.assign(f.effects, before.effects); f.scheduled.splice(0, f.scheduled.length, ...clone(before.scheduled)); };
  // Compare graph-disabled and graph-enabled raw row scopes in the same
  // atomic native body. The former child/savepoint boundary is no longer used.
  const original = await f.transaction(() => agent.saveAndPrepareContextV8Handler(createV8AuthorityReadScope(f.ctx), save));
  const originalAfter = wholeState(f), originalReads = clone(observed.reads); restore(); observed.clear();
  const actual = await f.call(agent.saveAndPrepareContextV8, save), actualReads = clone(observed.reads);
  expect(actual).toEqual(original); expect(wholeState(f)).toEqual(originalAfter);
  expect(originalMutableReads(actualReads)).toEqual(originalMutableReads(originalReads));
  const originalGraph = originalReads.filter(row => row.family), actualGraph = actualReads.filter(row => row.family);
  expect(actualGraph.length).toBeLessThan(originalGraph.length / 2);
  expect(rootUniqueReads(actualReads).length).toBeLessThan(rootUniqueReads(originalReads).length);
  expect(new Set(rootUniqueReads(actualReads).map(row => JSON.stringify(graphReadIdentity(row))))).toEqual(new Set(rootUniqueReads(originalReads).map(row => JSON.stringify(graphReadIdentity(row)))));
  expect(actual).toMatchObject({ kind: "prepared", prepared: { state: "started" } });
  expect(f.calls.slice(callsBefore)).not.toContain("runtimeAgent:prepareResolvedModelCandidateV8");
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  console.info(JSON.stringify({ type: "k26-controlled-save-candidate-reads", shared, original: {
    total: originalReads.length, graphQueries: originalGraph.length }, optimized: { total: actualReads.length, graphQueries: actualGraph.length },
    exactStateAndMutableReadSequenceEqual: true, atomicSaveAndPrepare: true, billableAttempts: 0, nativeLatency: "UNAVAILABLE" }));
});

/** K26's exact activation set: retain every scope descriptor except the new
 * traversal factory. The unchanged graph-only helper remains its real control. */
function k26GraphScope(ctx: MutationCtx) {
  const scope = createV8AuthorityReadScope(ctx, { managedSources: true });
  const copy = Object.create(Object.getPrototypeOf(scope)) as MutationCtx;
  let removed = 0;
  for (const key of Reflect.ownKeys(scope)) {
    if (typeof key === "symbol" && key.description === "cortex.native-managed-source-validation-scope") { removed++; continue; }
    Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(scope, key)!);
  }
  expect(removed).toBe(1); return copy;
}
const uniqueRawReads = (reads: GraphRead[]) => [...new Set(reads.map(row => JSON.stringify(graphReadIdentity(row))))].sort();
it.each([true, false])("K27 incremental K26 read/delivery comparison shared=%s retains all outcomes and raw identities", async shared => {
  // This historical comparison keeps the K27 graph-only source view on both sides.
  nativeSnapshotReads = false;
  const f = await ancestryFixture(shared), args = { ...f.args, hits: f.hits, factPlan: (await plan(f)).factPlan }, before = wholeState(f);
  const observed = instrumentGraphReads(f), scope = k26GraphScope(f.ctx);
  const read = await whole.readMatchesHandler(f.ctx, args, 8, scope);
  const delivery = await whole.finalDeliveryV8Handler(f.ctx, { reference: f.reference, bindings: read.bindings }, scope);
  const baseline = clone(observed.reads); observed.clear();
  expect(await f.call(whole.readMatchesAndDeliveryV8, args)).toEqual({ read, delivery });
  const optimized = clone(observed.reads);
  expect(originalMutableReads(optimized)).toEqual(originalMutableReads(baseline));
  expect(uniqueRawReads(optimized)).toEqual(uniqueRawReads(baseline));
  expect(optimized.length).toBeLessThan(baseline.length * 0.75);
  // The independent raw final authority fence remains present in both paths.
  expect(optimized.filter(row => row.phase === "final" && row.table === "runtimeAuthGrants").length).toBeGreaterThan(0);
  expect(wholeState(f)).toEqual(before);
  console.info(JSON.stringify({ type: "k27-incremental-k26-tail", shared, baseline: { total: baseline.length, documents: baseline.reduce((n,r)=>n+r.documents,0) },
    optimized: { total: optimized.length, documents: optimized.reduce((n,r)=>n+r.documents,0) }, uniqueRawIdentitySetEqual: true, applicationWrites: 0, nativeLatency: "UNAVAILABLE" }));
});
it.each([true, false])("K27 incremental K26 atomic save/candidate comparison shared=%s preserves state and complete native readset", async shared => {
  const f = await ancestryFixture(shared), save = { ...f.attempt, context: "", entries: [], witnesses: [f.topWitness], completeness: "complete" as const };
  const before = { ...wholeState(f), sequence: f.db.sequence }, observed = instrumentGraphReads(f), callsBefore = f.calls.length;
  const restore = () => { f.db.rows = clone(before.rows); f.db.writes = before.writes; f.db.sequence = before.sequence;
    Object.assign(f.native, clone(before.native)); Object.assign(f.effects, before.effects); f.scheduled.splice(0, f.scheduled.length, ...clone(before.scheduled)); };
  const original = await f.transaction(() => agent.saveAndPrepareContextV8Handler(k26GraphScope(f.ctx), save));
  const after = wholeState(f), baseline = clone(observed.reads); restore(); observed.clear();
  expect(await f.call(agent.saveAndPrepareContextV8, save)).toEqual(original);
  const optimized = clone(observed.reads);
  expect(wholeState(f)).toEqual(after); expect(originalMutableReads(optimized)).toEqual(originalMutableReads(baseline));
  expect(uniqueRawReads(optimized)).toEqual(uniqueRawReads(baseline));
  // These two graph-enabled scopes retain the same raw families inside the
  // atomic native body; their complete readsets must still agree.
  expect(optimized.length).toBe(baseline.length);
  expect(f.calls.slice(callsBefore)).not.toContain("runtimeAgent:prepareResolvedModelCandidateV8");
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  console.info(JSON.stringify({ type: "k27-incremental-k26-save-child", shared, baseline: { total: baseline.length, documents: baseline.reduce((n,r)=>n+r.documents,0) },
    optimized: { total: optimized.length, documents: optimized.reduce((n,r)=>n+r.documents,0) }, uniqueRawIdentitySetEqual: true, atomicSaveAndPrepare: true, billableAttempts: 0, nativeLatency: "UNAVAILABLE" }));
});


it.each([true, false])("K29 same-snapshot private parents shared=%s match a773 values/readset/state with fewer physical reads", async shared => {
  const f = await ancestryFixture(shared), observed = instrumentGraphReads(f), before = wholeState(f);
  nativeSnapshotReads = false;
  const originalPlan = await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReadsV8, f.args);
  const baselinePlan = clone(observed.reads); observed.clear();
  const args = { ...f.args, hits: f.hits, factPlan: originalPlan.factPlan };
  const original = await f.call(whole.readMatchesAndDeliveryV8, args), baselineTail = clone(observed.reads); observed.clear();
  nativeSnapshotReads = true;
  expect(await f.call(whole.prepareReadsV8, f.args)).toEqual(originalPlan);
  const actualPlan = clone(observed.reads); observed.clear();
  expect(await f.call(whole.readMatchesAndDeliveryV8, args)).toEqual(original);
  const actualTail = clone(observed.reads);
  for (const [baseline, actual] of [[baselinePlan, actualPlan], [baselineTail, actualTail]]) {
    expect(originalMutableReads(actual)).toEqual(originalMutableReads(baseline));
    // Metadata may be reused across the two logical stages of this ONE native
    // snapshot; the transaction's exact raw read identity set stays unchanged.
    const nativeReadSet = (values: GraphRead[]) => [...new Set(values.map(row => {
      const { phase: _phase, ...identity } = graphReadIdentity(row); return JSON.stringify(identity);
    }))].sort();
    expect(nativeReadSet(actual)).toEqual(nativeReadSet(baseline));
    expect(actual.length).toBeLessThan(baseline.length);
  }
  expect(actualTail.filter(row => row.phase === "final" && row.table === "runtimeAuthGrants").length).toBeGreaterThan(0);
  expect(wholeState(f)).toEqual(before);
  const counts = (reads: GraphRead[]) => ({ calls: reads.length, documents: reads.reduce((n, row) => n + row.documents, 0),
    authority: reads.filter(row => row.table.startsWith("runtimeAuth")).length });
  console.info(JSON.stringify({ type: "k29-current-a773-private-parent-reads", shared,
    plan: { baseline: counts(baselinePlan), actual: counts(actualPlan) }, tail: { baseline: counts(baselineTail), actual: counts(actualTail) },
    exactResultStateAndMutableReadOrder: true, applicationWrites: 0, nativeLatency: "NOT_RUN" }));
});
it.each(["ancestor-hash", "ancestor-tombstone", "ancestor-duplicate", "revoked", "expiry", "principal", "profile", "fact-binding"])(
  "K29 private snapshot view retains a773 %s refusal and zero partial effects", async fault => {
    const f = await ancestryFixture(true), proposed = await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReadsV8, f.args);
    const args = { ...f.args, hits: f.hits, factPlan: clone(proposed.factPlan) };
    const leaf = f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === f.leaves[0]!.lineage.sourceId)!;
    if (fault === "ancestor-hash") leaf.contentHash = "f".repeat(64);
    if (fault === "ancestor-tombstone") leaf.tombstonedAt = clock;
    if (fault === "ancestor-duplicate") f.db.seed("runtimeMemorySources", { ...leaf, _id: "runtimeMemorySources:k29-duplicate" });
    if (fault === "revoked") f.grant.revokedAt = clock;
    if (fault === "expiry") f.grant.expiresAt = clock;
    if (fault === "principal") args.reference = { ...args.reference, principalId: "foreign" };
    if (fault === "profile") args.profile = { ...profile, modelId: "foreign" };
    if (fault === "fact-binding") { if (args.factPlan.kind !== "ready") throw Error("Expected ready plan"); args.factPlan.facts[0]!.fact = "forged payload"; }
    const before = wholeState(f); nativeSnapshotReads = false;
    const expected = await failureValue(() => f.call(whole.readMatchesAndDeliveryV8, args));
    nativeSnapshotReads = true;
    expect(await failureValue(() => f.call(whole.readMatchesAndDeliveryV8, args))).toEqual(expected);
    expect(wholeState(f)).toEqual(before);
  });
it.each(["edit", "revoke"])("K29 independent native save still sees %s after a successful read snapshot", async fault => {
  const f = await ancestryFixture(true), proposed = await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReadsV8, f.args);
  const read = await f.call<Awaited<ReturnType<typeof whole.readMatchesAndDeliveryV8Handler>>>(whole.readMatchesAndDeliveryV8,
    { ...f.args, hits: f.hits, factPlan: proposed.factPlan });
  if (!("read" in read)) throw Error("Expected current read plan");
  if (fault === "edit") f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === f.leaves[0]!.lineage.sourceId)!.contentHash = "e".repeat(64);
  else f.grant.revokedAt = clock;
  const before = wholeState(f);
  await expect(f.call(agent.saveContextV8, { ...f.attempt, context: "", entries: [], witnesses: read.read.witnesses, completeness: "complete" })).rejects.toThrow();
  expect(wholeState(f)).toEqual(before);
});

function directAdmissionArgs(f:Fixture,candidate:Extract<Awaited<ReturnType<typeof agent.prepareResolvedModelCandidateV8Handler>>,{state:"started"}>){
 return {...f.attempt,ordinal:0,operationId:candidate.op.operationId,requestCanonical:candidate.op.nativeRequestCanonical!,snapshotCanonical:canonicalModelJson(candidate.governedResolution.snapshot),bindingCanonical:canonicalModelJson({reference:f.reference,operationKey:"agent.respond",runBudgetId:candidate.current.run.runBudgetId,semanticId:candidate.op.semanticId,ordinal:0})};
}
it("direct V8 native parent uses actual indexed facts and depth2 source without preparing or billing an embedding",async()=>{
 const f=await fixture(true,true,"fast",0,undefined,true),before=wholeState(f);
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.direct).toBeDefined();expect(parent.proposal).toBeUndefined();expect(wholeState(f)).toEqual(before);
 expect(parent.direct!.read.effortResult!.memoryEffort).toMatchObject({retrievalRoute:"direct-facts-v1",requestedEffort:"fast",maxDepth:2});
 expect(parent.direct!.read.effortResult!.items).toEqual(expect.arrayContaining([expect.objectContaining({id:"whole-fact",content:"User favorite season is autumn",retrieval:expect.objectContaining({depth:1})}),expect.objectContaining({type:"memory",retrieval:expect.objectContaining({depth:2})})]));
 let semanticCalls=0;
 const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async()=>{semanticCalls++;throw Error("Direct sufficient evidence must not embed");},true);
 expect(semanticCalls).toBe(0);expect(candidate?.state).toBe("started");if(candidate?.state!=="started")throw Error("Expected real prepared dispatch candidate");
 expect(candidate.current.execution.contextCanonical).toContain("autumn");expect(candidate.current.execution.sourceWitnesses.length).toBeGreaterThan(0);
 expect(JSON.parse(candidate.current.run.memoryEffortTraceCanonical!)).toMatchObject({retrievalRoute:"direct-facts-v1"});expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 expect(await f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).toMatchObject({admission:{status:"reserved"},permit:{dispatchPermit:true}});expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
const projectedAgentFixture=(queryText?:string,seedWork?:number,unstructured?:"contradiction"|"canonical-mismatch")=>fixture(true,true,"fast",0,seedWork,"fruit",0,false,unstructured??true,queryText);
const singletonAgentFixture=(maxEntries?:number)=>fixture(true,true,"fast",0,undefined,"fruit",0,false,"singleton",undefined,maxEntries);
async function canonicalAgentFixture(){
 const f=await singletonAgentFixture(),row=f.db.table("facts").find(value=>value.factId==="whole-likes")!;
 Object.assign(row,{fact:"User prefers apricot as their favorite fruit.",predicate:"prefers"});return f;
}
it("Agent native parent proves both actual explicit favorite-property projections without preparing or invoking semantic embedding",async()=>{
 const f=await canonicalAgentFixture(),candidates=await new ConvexMemoryRepository(f.ctx,f.reference,"read").searchFactCandidates(f.input.text,f.input.limit);
 expect(candidates.facts.map(fact=>fact.factId).sort()).toEqual(["whole-fact","whole-likes"]);expect(candidates.candidateWorkBound).toBe(false);
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.proposal).toBeUndefined();expect(parent.direct!.read.bindings.facts.map(fact=>fact.factId).sort()).toEqual(["whole-fact","whole-likes"]);
 expect(parent.direct!.read.effortResult!.memoryEffort).toMatchObject({retrievalRoute:"direct-facts-v1",entriesByKind:{fact:2,memory:1}});
 let semanticCalls=0;const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async()=>{semanticCalls++;throw Error("Canonical projection proof must not embed");},true);
 expect(semanticCalls).toBe(0);if(candidate?.state!=="started")throw Error("Expected prepared main request");
 expect(candidate.current.execution.contextCanonical).toContain("User prefers apricot as their favorite fruit.");expect(candidate.current.execution.sourceWitnesses).toHaveLength(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).resolves.toMatchObject({permit:{dispatchPermit:true}});expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
it("Agent canonical projection proof remains unavailable to an omitted historical pin",async()=>{
 const f=await canonicalAgentFixture(),run=f.db.table("runtimeRuns")[0]!,effort=JSON.parse(run.memoryEffortCanonical as string),snapshot=JSON.parse(run.snapshotCanonical as string);
 delete effort.literalSourceProofVersion;delete snapshot.inputSelection.effort.literalSourceProofVersion;run.memoryEffortCanonical=canonicalModelJson(effort);run.snapshotCanonical=canonicalModelJson(snapshot);
 const getSource=jest.spyOn(ConvexMemoryRepository.prototype,"getSource");
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.direct).toBeUndefined();expect(parent.proposal?.binding.operationKey).toBe("embedding.query");expect(getSource).not.toHaveBeenCalled();expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("Agent one-hit parent uses a canonical proof before real adjacency finds the compatible value projection",async()=>{
 const f=await singletonAgentFixture(),repository=new ConvexMemoryRepository(f.ctx,f.reference,"read");
 const initial=await repository.searchFactCandidates(f.input.text,f.input.limit);expect(initial.facts.map(fact=>fact.factId)).toEqual(["whole-fact"]);expect(initial.candidateWorkBound).toBe(false);
 const before=wholeState(f),parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.proposal).toBeUndefined();expect(parent.direct).toBeDefined();expect(wholeState(f)).toEqual(before);
 expect(parent.direct!.read.bindings.facts.map(fact=>fact.factId).sort()).toEqual(["whole-fact","whole-likes"]);
 expect(parent.direct!.read.effortResult!.items.find(item=>item.id==="whole-likes")?.retrieval).toMatchObject({depth:2,path:["fact:whole-fact","fact:whole-likes"]});
 expect(parent.direct!.read.effortResult!.memoryEffort).toMatchObject({retrievalRoute:"direct-facts-v1",maxDepth:2,maxEntries:4,entriesByKind:{fact:2,memory:1}});
 let semanticCalls=0;const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async()=>{semanticCalls++;throw Error("Canonical singleton source must not embed");},true);
 expect(semanticCalls).toBe(0);if(candidate?.state!=="started")throw Error("Expected real prepared candidate");
 expect(candidate.current.execution.contextCanonical).toContain("User likes apricot.");expect(candidate.current.execution.sourceWitnesses).toHaveLength(1);
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).resolves.toMatchObject({permit:{dispatchPermit:true}});
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
it.each(["legacy-pin","wrong-value","unknown","negation","history","missing-object","different-source","entries","work"])("Agent one-hit adjacency %s retains the original governed embedding proposal",async fault=>{
 const f=await singletonAgentFixture(fault==="entries"?1:undefined),row=f.db.table("facts").find(value=>value.factId==="whole-likes")!;
 if(fault==="legacy-pin"||fault==="work"){
  const run=f.db.table("runtimeRuns")[0]!,effort=JSON.parse(run.memoryEffortCanonical as string),snapshot=JSON.parse(run.snapshotCanonical as string);
  if(fault==="legacy-pin"){delete effort.literalSourceProofVersion;delete snapshot.inputSelection.effort.literalSourceProofVersion;}
  if(fault==="work"){effort.maxWork=5;snapshot.inputSelection.effort.maxWork=5;}
  run.memoryEffortCanonical=canonicalModelJson(effort);run.snapshotCanonical=canonicalModelJson(snapshot);
 }
 if(fault==="wrong-value")Object.assign(row,{fact:"User likes pear.",object:"pear"});if(fault==="unknown")row.fact="User enjoys apricot.";
 if(fault==="negation")row.fact="User does not like apricot.";if(fault==="history")row.supersedes="older";if(fault==="missing-object")delete row.object;
 if(fault==="different-source"){
  const source=await prepareSourceContent(memoryScope(f.reference),explicitSourceLineage(memoryScope(f.reference),"other-one-hit"),"User likes apricot.",{now:()=>clock});
  await new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db).putSource(source.source);row.lineage=source.source.lineage;
 }
 await replaceFactEntityLinks(f.ctx.db,row as unknown as DerivedFact);
 const initial=await new ConvexMemoryRepository(f.ctx,f.reference,"read").searchFactCandidates(f.input.text,f.input.limit);expect(initial.facts.map(fact=>fact.factId)).toEqual(["whole-fact"]);
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.direct).toBeUndefined();expect(parent.proposal?.binding.operationKey).toBe("embedding.query");expect(parent.proposal?.request.texts).toEqual(["What is my favorite fruit?"]);
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["expire-fact","edit-source","delete-source"])("Agent one-hit source proof retains its final %s fence",async fault=>{
 const f=await singletonAgentFixture(),original=ConvexMemoryRepository.prototype.checkDelivery;
 const delivery=jest.spyOn(ConvexMemoryRepository.prototype,"checkDelivery").mockImplementation(async function(this:InstanceType<typeof ConvexMemoryRepository>,bindings,authority){
  expect(bindings.facts.map(fact=>fact.factId).sort()).toEqual(["whole-fact","whole-likes"]);
  if(fault==="expire-fact")f.db.table("facts").find(value=>value.factId==="whole-likes")!.validUntil=clock;
  if(fault==="edit-source")f.db.table("runtimeMemorySources")[0]!.contentHash="f".repeat(64);
  if(fault==="delete-source")f.db.table("runtimeMemorySources")[0]!.tombstonedAt=clock;return original.call(this,bindings,authority);
 });
 await expect(f.call(agent.contextInputsAndEmbeddingV8,f.attempt)).rejects.toThrow();expect(delivery).toHaveBeenCalledTimes(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("Agent one-hit source proof rechecks revoked authority before main admission",async()=>{
 const f=await singletonAgentFixture(),candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async()=>{throw Error("Canonical singleton source must not embed");},true);
 if(candidate?.state!=="started")throw Error("Expected direct prepared candidate");f.grant.revokedAt=clock;
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).rejects.toMatchObject({data:{code:"FORBIDDEN"}});expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("Agent native composition proves all three observed projections and the exact canonical source without an embedding proposal or call",async()=>{
 const f=await projectedAgentFixture(),before=wholeState(f),parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.proposal).toBeUndefined();expect(parent.direct).toBeDefined();expect(wholeState(f)).toEqual(before);
 expect(parent.direct!.read.bindings.facts.map(fact=>fact.factId).sort()).toEqual(["whole-fact","whole-general","whole-likes"]);
 expect(parent.direct!.read.effortResult!.items).toHaveLength(4);expect(parent.direct!.read.effortResult!.memoryEffort).toMatchObject({retrievalRoute:"direct-facts-v1",maxDepth:2,maxEntries:4,entriesByKind:{fact:3,memory:1}});
 let semanticCalls=0;const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async()=>{semanticCalls++;throw Error("Proven source must not embed");},true);
 expect(semanticCalls).toBe(0);if(candidate?.state!=="started")throw Error("Expected real prepared dispatch candidate");
 expect(candidate.current.execution.contextCanonical).toContain("apricot");expect(candidate.current.execution.sourceWitnesses).toHaveLength(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).resolves.toMatchObject({permit:{dispatchPermit:true}});
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
it.each(["contradiction","canonical-mismatch"] as const)("LSR-1 Agent unstructured %s refuses direct source proof and invokes the original governed semantic fallback once",async scenario=>{
 const f=await projectedAgentFixture(undefined,undefined,scenario),getSource=jest.spyOn(ConvexMemoryRepository.prototype,"getSource");
 expect(await whole.readDirectAgentRecallV8Handler(f.ctx,f.args)).toBeUndefined();expect(getSource).not.toHaveBeenCalled();getSource.mockRestore();
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.direct).toBeUndefined();expect(parent.proposal?.binding.operationKey).toBe("embedding.query");expect(parent.proposal?.request.texts).toEqual(["What is my favorite fruit?"]);
 let semanticCalls=0;
 const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async(_repository,input,selection,proposal)=>{
  semanticCalls++;expect(proposal?.binding.operationKey).toBe("embedding.query");expect(proposal?.resolutions).toHaveLength(2);
  const result=await whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>clock},input,profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},selection!,clock);
  expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");expect(result.items.filter(item=>item.type==="fact").map(item=>item.content).sort()).toEqual(["apricot",scenario==="contradiction"?"pear":"apricot"].map(value=>`My favorite fruit is ${value}.`).sort());
  return result;
 },true);
 expect(semanticCalls).toBe(1);if(candidate?.state!=="started")throw Error("Expected prepared semantic main request");
 expect(JSON.parse(candidate.current.run.memoryEffortTraceCanonical!)).toMatchObject({retrievalRoute:"semantic-v1"});expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).resolves.toMatchObject({permit:{dispatchPermit:true}});expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
it.each(["legacy-pin","conflict","unknown","different-source","history","work"])("Agent projected %s retains the original governed embedding proposal",async fault=>{
 const f=await projectedAgentFixture(),row=f.db.table("facts").find(value=>value.factId==="whole-likes")!;
 if(fault==="legacy-pin"||fault==="work"){
  const run=f.db.table("runtimeRuns")[0]!,effort=JSON.parse(run.memoryEffortCanonical as string),snapshot=JSON.parse(run.snapshotCanonical as string);
  if(fault==="legacy-pin"){delete effort.literalSourceProofVersion;delete snapshot.inputSelection.effort.literalSourceProofVersion;}
  else{effort.maxWork=16;snapshot.inputSelection.effort.maxWork=16;}
  run.memoryEffortCanonical=canonicalModelJson(effort);run.snapshotCanonical=canonicalModelJson(snapshot);
 }
 if(fault==="conflict")Object.assign(row,{fact:"User's favorite fruit is pear.",predicate:"is_favorite_fruit",object:"pear"});
 if(fault==="unknown")row.fact="User enjoys fruit.";if(fault==="history")row.supersedes="older-fact";
 if(fault==="different-source"){
  const source=await prepareSourceContent(memoryScope(f.reference),explicitSourceLineage(memoryScope(f.reference),"different-source"),"User likes fruit.",{now:()=>clock});
  await new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db).putSource(source.source);row.lineage=source.source.lineage;
 }
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.direct).toBeUndefined();expect(parent.proposal?.request).toMatchObject({purpose:"embedding.query",texts:["What is my favorite fruit?"]});expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["expire-fact","edit-source"])("Agent projected proof retains its final %s delivery fence before model preparation",async fault=>{
 const f=await projectedAgentFixture(),original=ConvexMemoryRepository.prototype.checkDelivery;
 const delivery=jest.spyOn(ConvexMemoryRepository.prototype,"checkDelivery").mockImplementation(async function(this:InstanceType<typeof ConvexMemoryRepository>,bindings,authority){
  expect(bindings.facts.map(fact=>fact.factId).sort()).toEqual(["whole-fact","whole-general","whole-likes"]);
  if(fault==="expire-fact")f.db.table("facts").find(value=>value.factId==="whole-general")!.validUntil=clock;
  if(fault==="edit-source")f.db.table("runtimeMemorySources")[0]!.contentHash="f".repeat(64);return original.call(this,bindings,authority);
 });
 await expect(f.call(agent.contextInputsAndEmbeddingV8,f.attempt)).rejects.toThrow();expect(delivery).toHaveBeenCalledTimes(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("Agent projected proof refuses authority revoked across the actual preparation-to-admission boundary",async()=>{
 const f=await projectedAgentFixture(),candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async()=>{throw Error("Proven source must not embed");},true);
 if(candidate?.state!=="started")throw Error("Expected direct prepared model candidate");f.grant.revokedAt=clock;
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).rejects.toMatchObject({data:{code:"FORBIDDEN"}});
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["broad","work-bound","mixed-source","unknown"])("Agent prospective %s miss performs zero extra canonical-source get calls",async fault=>{
 const f=await projectedAgentFixture(fault==="broad"?"Tell me about fruit.":undefined,fault==="work-bound"?24:undefined),row=f.db.table("facts").find(value=>value.factId==="whole-likes")!;
 if(fault==="unknown")row.fact="User enjoys fruit.";
 if(fault==="mixed-source"){
  const source=await prepareSourceContent(memoryScope(f.reference),explicitSourceLineage(memoryScope(f.reference),"other-source"),"User likes fruit.",{now:()=>clock});
  await new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db).putSource(source.source);row.lineage=source.source.lineage;
 }
 const getSource=jest.spyOn(ConvexMemoryRepository.prototype,"getSource");
 expect(await whole.readDirectAgentRecallV8Handler(f.ctx,f.args)).toBeUndefined();expect(getSource).not.toHaveBeenCalled();expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["revoke","edit"])("direct evidence still refuses %s before dispatch preparation and exposes no stale context",async fault=>{
 const f=await fixture(true,true,"normal",0,undefined,true);
 const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async()=>{throw Error("Unexpected semantic call");},true);if(candidate?.state!=="started")throw Error("Expected real direct prepared candidate");
 if(fault==="revoke")f.grant.revokedAt=clock;else f.db.table("runtimeMemorySources")[0]!.contentHash="changed";
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).rejects.toMatchObject({data:{code:fault==="revoke"?"FORBIDDEN":"STALE_CONTEXT"}});expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("ambiguous direct facts retain the original semantic proposal and real entry/work ceilings",async()=>{
 const f=await fixture(true,true,"fast",0,undefined,true),row=f.db.table("facts")[0]!;
 row.supersedes="older-fact";
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,f.attempt);
 expect(parent.direct).toBeUndefined();expect(parent.proposal?.request.purpose).toBe("embedding.query");expect(parent.proposal?.request.texts).toEqual(["What is my favorite season?"]);
 expect(parent.inputs.current.snapshot.version===8&&parent.inputs.current.snapshot.inputSelection.effort?.maxEntries).toBe(4);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});

it.each([true,false])("Fast cross-conversation exact property ranking pin=%s retains eligible answer evidence with four repeated-question vectors",async ranking=>{
 const f=await fixture(true,true,"fast",0,undefined,"fruit",4);
 if(!ranking){const run=f.db.table("runtimeRuns")[0]!,effort=JSON.parse(run.memoryEffortCanonical as string),snapshot=JSON.parse(run.snapshotCanonical as string);delete effort.evidenceRankingVersion;delete snapshot.inputSelection.effort.evidenceRankingVersion;run.memoryEffortCanonical=canonicalModelJson(effort);run.snapshotCanonical=canonicalModelJson(snapshot);}
 const originalPlan=await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReadsV8,f.args);
 expect(originalPlan.factPlan.kind).toBe("ready");if(originalPlan.factPlan.kind!=="ready")throw Error("Expected actual indexed fact plan");expect(originalPlan.factPlan.facts.some(fact=>fact.factId==="whole-fact")).toBe(true);
 let semanticCalls=0;
 const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async(_repository,input,selection)=>{semanticCalls++;return whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>clock},input,profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},selection!,clock);},true);
 expect(semanticCalls).toBe(1);expect(candidate?.state).toBe("started");if(candidate?.state!=="started")throw Error("Expected real prepared dispatch context");
 const selected=candidate.current.execution.modelInputEntries??[],dispatch=JSON.parse(candidate.op.nativeRequestCanonical!);
 expect(selected).toHaveLength(4);expect(selected.some(entry=>/apricot/.test(entry.text))).toBe(ranking);expect(JSON.stringify(dispatch.messages).includes("apricot")).toBe(ranking);
 expect(selected.filter(entry=>entry.literalPropertyPriority).map(entry=>entry.kind)).toEqual(ranking?["fact"]:[]);
 const trace=JSON.parse(candidate.current.run.memoryEffortTraceCanonical!);expect(trace).toMatchObject({retrievalRoute:"semantic-v1",maxEntries:4,maxDepth:2});expect(trace.entriesByKind.fact).toBe(ranking?1:0);expect(trace.stopReasons).toContain("entries");
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); // No main dispatch; semantic embedding is the single controlled peer above.
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).resolves.toMatchObject({permit:{dispatchPermit:true}});
});

it("actual Fast Agent retains the current literal conflict discovered at depth2 beyond a bounded direct fact page",async()=>{
 const f=await fixture(true,true,"fast",0,undefined,"fruit",4,true),plan=await f.call<Awaited<ReturnType<typeof whole.prepareReadsHandler>>>(whole.prepareReadsV8,f.args);
 if(plan.factPlan.kind!=="ready")throw Error("Expected ready native fact page");
 expect(plan.factPlan.candidateWorkBound).toBe(true);expect(plan.factPlan.facts.some(fact=>fact.factId==="whole-fact")).toBe(true);expect(plan.factPlan.facts.some(fact=>fact.factId==="linked-plum")).toBe(false);
 let semanticCalls=0;
 const candidate=await agent.prepareContextV8Handler(f.action,f.attempt,async(_repository,input,selection)=>{semanticCalls++;const result=await whole.finishAgentRecallV8(f.action,f.attempt,{now:()=>clock},input,profile,{profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},selection!,clock);expect(result.items.find(item=>item.id==="linked-plum")?.retrieval).toMatchObject({depth:2,path:["fact:whole-fact","fact:linked-plum"]});return result;},true);
 expect(semanticCalls).toBe(1);if(candidate?.state!=="started")throw Error("Expected real prepared main request");
 const entries=candidate.current.execution.modelInputEntries??[],request=JSON.parse(candidate.op.nativeRequestCanonical!);
 expect(entries).toHaveLength(4);expect(entries.filter(entry=>entry.kind==="fact").map(entry=>entry.key).sort()).toEqual(["fact:linked-plum","fact:whole-fact"]);
 expect(JSON.stringify(request.messages)).toContain("apricot");expect(JSON.stringify(request.messages)).toContain("plum");
 expect(JSON.parse(candidate.current.run.memoryEffortTraceCanonical!)).toMatchObject({maxEntries:4,maxDepth:2,entriesByKind:{fact:2},retrievalRoute:"semantic-v1"});
 await expect(f.call(agent.admitPreparedModelOperationV8,directAdmissionArgs(f,candidate))).resolves.toMatchObject({permit:{dispatchPermit:true}});
});
