/** Real registered handlers; controlled native DB/component peers, never cloud latency. */
import {afterEach,beforeEach,expect,it,jest} from "@jest/globals";
import {getFunctionName} from "convex/server";
import type {MutationCtx} from "../../../convex-dev/_generated/server";
import type {ModelCallRequest} from "../../../src/domain/model-policy";
import type {GatewayAdmissionCheckpoint,GatewayResolution} from "../../../convex-dev/runtimeGateway";
import {canonicalModelJson} from "../../../src/domain/model-policy";
import {contextSourceKey} from "../../../src/domain/memory-context";
import {assertNativeArgs} from "./native-arguments";
let enabled=true;
const auth=await import("../../../convex-dev/runtimeAuth");
jest.unstable_mockModule("../../../convex-dev/runtimeAuth",()=>({...auth,
  createV8AuthorityReadScope:<Ctx extends Parameters<typeof auth.createAuthorityReadScope>[0]>(ctx:Ctx)=>enabled?auth.createV8AuthorityReadScope(ctx):auth.createAuthorityReadScope(ctx,{nativeTranscript:true,policyMetadata:true})}));
jest.unstable_mockModule("@convex-dev/workflow",()=>({WorkflowManager:class{
  define(value:{handler:unknown}){return{_handler:value.handler};}async start(){return"workflow:v8-comparison";}
}}));
const {ingestionFixture,installIngestionMockRoot,invoke}=await import("../runtimeIngestion/fixture");
const {definitions,runs,ledger,clone}=await import("../runtimeTranscript/fixture");
const agent=await import("../../../convex-dev/runtimeAgent");
const context=await import("../../../convex-dev/runtimeMemoryContext");
beforeEach(()=>{installIngestionMockRoot();enabled=true;});afterEach(()=>{jest.restoreAllMocks();});
async function fixture(){
 const f=await ingestionFixture(),oldMutation=f.ctx.runMutation.bind(f.ctx),oldQuery=f.ctx.runQuery.bind(f.ctx),calls:string[]=[];
 const resolve=(name:string)=>name.startsWith("runtimeAgent:")?agent[name.split(":")[1] as keyof typeof agent]:name.startsWith("runs:")?runs[name.split(":")[1] as keyof typeof runs]:undefined;
 f.ctx.runMutation=(async(ref,args)=>{let name="";try{name=getFunctionName(ref);}catch{return oldMutation(ref,args);}const target=resolve(name);if(target){calls.push(name);assertNativeArgs(target,args);return f.call(target,args);}return oldMutation(ref,args);}) as MutationCtx["runMutation"];
 f.ctx.runQuery=(async(ref,args)=>{let name="";try{name=getFunctionName(ref);}catch{return oldQuery(ref,args);}const target=resolve(name);if(target){calls.push(name);assertNativeArgs(target,args);return invoke(target,f.ctx,args);}return oldQuery(ref,args);}) as MutationCtx["runQuery"];
 const published=await f.call<{agentId:string;version:number}>(definitions.publishVersion,{memorySpaceId:"space-a",clientMutationId:"read-retention-v8",expectedPreviousVersion:0,
   definitionInput:{...f.definitionInput,context:{...f.definitionInput.context,handlerId:"cortex.transcript.relevant",registryHash:await definitions.executableRegistryHashV3(),
     inputSelection:{version:1,recentMessages:4,relevantMemories:4,relevantFacts:4,pendingEntries:4,maxMessages:16}}}});
 const run=await f.call<ReturnType<typeof runs.publicRun>>(runs.submit,{request:{...f.request(),agentId:published.agentId,agentVersion:published.version}});
 await f.call(agent.start,{runId:run.runId});const owned=f.db.table("runtimeAgentExecutions")[0]!;
 const attempt={reference:f.reference,runId:run.runId,attemptNumber:1,leaseVersion:owned.leaseVersion as number};
 const state=()=>clone({rows:f.db.rows,writes:f.db.writes,sequence:f.db.sequence,native:f.native,effects:f.effects,scheduled:f.scheduled});
 const restore=(value:ReturnType<typeof state>)=>{f.db.rows=clone(value.rows);f.db.writes=value.writes;f.db.sequence=value.sequence;Object.assign(f.native,clone(value.native));Object.assign(f.effects,value.effects);f.scheduled.splice(0,f.scheduled.length,...clone(value.scheduled));};
 return {...f,get grant(){return f.grant;},attempt,run,calls,state,restore};
}
function instrument(f:Awaited<ReturnType<typeof fixture>>){
 const query=f.db.query.bind(f.db),get=f.db.get.bind(f.db),reads:{method:string;table:string;id?:string;index?:string;keys?:unknown[]}[]=[];
 jest.spyOn(f.db,"get").mockImplementation(async(table,id)=>{reads.push({method:"get",table,id});return get(table,id);});
 jest.spyOn(f.db,"query").mockImplementation(table=>{
   const record={method:"query",table,index:undefined as string|undefined,keys:[] as unknown[]};reads.push(record);const builder=query(table),withIndex=builder.withIndex.bind(builder);
   builder.withIndex=(index,callback)=>{record.index=index;return withIndex(index,q=>{if(q===null||typeof q!=="object")throw Error("Expected original index query object");const traced=new Proxy(q,{get(target,key){const value:unknown=Reflect.get(target,key,target);if(typeof value!=="function")return value;return(...args:unknown[])=>{record.keys.push([String(key),...args]);const result:unknown=Reflect.apply(value,target,args);return result===target?traced:result;};}});return callback(traced);});};return builder;
 });
 const retained=(table:string)=>table.startsWith("runtimeAuth")||table==="runtimeModelPolicies"||table==="runtimeModelQualifications";
 return{reads,clear:()=>{reads.length=0;},counts:()=>({total:reads.length,authority:reads.filter(value=>value.table.startsWith("runtimeAuth")).length}),
   stateReads:()=>clone(reads.filter(value=>!retained(value.table)))};
}
it("actual V8 preparation retains exact output/state and non-control reads while reducing raw lookups",async()=>{
 const f=await fixture(),before=f.state(),observed=instrument(f);enabled=false;
 const original=await f.call(agent.prepareDirectTurnV8,f.attempt),after=f.state(),control=observed.counts(),nonControl=observed.stateReads();
 f.restore(before);observed.clear();enabled=true;
 const optimized=await f.call(agent.prepareDirectTurnV8,f.attempt);
 expect(optimized).toEqual(original);expect(f.state()).toEqual(after);expect(observed.stateReads()).toEqual(nonControl);
 expect(observed.counts().authority).toBeLessThan(control.authority);expect(observed.counts().total).toBeLessThan(control.total);
 console.info(JSON.stringify({type:"controlled-v8-preparation-read-count",original:control,optimized:observed.counts(),nativeProof:false}));
});
it("profile availability composes the original helper without changing its repeated current checks",async()=>{
 const f=await fixture();await f.call(agent.startContext,f.attempt);const current=await agent.executionContext(f.ctx,f.attempt);
 const args={reference:f.reference,cutoff:current.snapshot.ingestionCutoff.sequence,excludedSourceKeys:current.snapshot.messages.map(pin=>contextSourceKey({tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!},{...pin,sourceId:pin.sourceEventId})),
   runBudgetId:current.run.runBudgetId,boundary:{conversationId:current.snapshot.conversationId,runId:f.attempt.runId,queueSequence:current.snapshot.queueSequence,anchor:current.snapshot.anchor}};
 const reads=instrument(f),writes=f.db.writes;const original=await context.readIndexedContextAvailability(f.ctx,args),before=f.state(),nonControl=reads.stateReads();reads.clear();
 const scoped=auth.createV8AuthorityReadScope(f.ctx);
 const optimized=await context.readIndexedContextAvailability(scoped,args,(key,id)=>ledger.readCurrentEmbeddingProfile(scoped,f.reference,key,id));
 expect(optimized).toEqual(original);expect(f.state()).toEqual(before);expect(f.db.writes).toBe(writes);expect(reads.stateReads()).toEqual(nonControl);
});
async function admission(f:Awaited<ReturnType<typeof fixture>>){
 const prepared=await f.call<Awaited<ReturnType<typeof agent.prepareResolvedModelCandidateV8Handler>>>(agent.prepareDirectTurnV8,f.attempt);
 if(prepared.state!=="started")throw Error("Expected original started model candidate");
 const resolution=prepared.governedResolution as GatewayResolution;
 const request:ModelCallRequest={semanticId:prepared.op.semanticId,childCallId:"same-bounded-native-child",texts:["Hello world!"],messages:[{role:"user",parts:[{type:"text",text:"Hello world!"}]}],
   inputTokens:1,outputTokens:20,toolSteps:0,timeoutMs:1000,reservationUnits:resolution.snapshot.costBound.maximumCostUnits,
   promptVersion:resolution.snapshot.pins.promptVersion,schemaVersion:resolution.snapshot.pins.schemaVersion,extractionVersion:resolution.snapshot.pins.extractionVersion,
   toolRegistryVersion:resolution.snapshot.pins.toolRegistryVersion,tools:[],options:{maxRetries:0}};
 request.inputTokens=ledger.deriveQualifiedInputBound(resolution.dispatchEvidence,request);
 return{...f.attempt,operationId:prepared.op.operationId,ordinal:0,requestCanonical:canonicalModelJson(request),snapshotCanonical:canonicalModelJson(resolution.snapshot),
   bindingCanonical:canonicalModelJson({reference:f.reference,operationKey:"agent.respond",runBudgetId:prepared.current.run.runBudgetId,semanticId:prepared.op.semanticId,ordinal:0})};
}
it("financial retention preserves the exact real permit/accounts/attempt and every fresh mutable-row read",async()=>{
 const f=await fixture(),args=await admission(f),before=f.state(),observed=instrument(f);enabled=false;
 const original=await f.call<GatewayAdmissionCheckpoint>(agent.admitPreparedModelOperationV8,args),after=f.state(),control=observed.counts(),nonControl=observed.stateReads();
 f.restore(before);observed.clear();enabled=true;const actual=await f.call<GatewayAdmissionCheckpoint>(agent.admitPreparedModelOperationV8,args);
 expect(actual).toEqual(original);expect(f.state()).toEqual(after);expect(observed.stateReads()).toEqual(nonControl);
 expect(actual).toMatchObject({admission:{status:"reserved"},permit:{dispatchPermit:true}});
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);expect(observed.counts().authority).toBeLessThan(control.authority);
 console.info(JSON.stringify({type:"controlled-v8-financial-read-count",original:control,optimized:observed.counts(),nativeProof:false}));
});
it.each(["budget","revocation","lease","binding"])("current %s still rejects V8 admission with original error/state",async fault=>{
 const f=await fixture(),args=await admission(f);
 if(fault==="budget")f.db.table("runtimeBudgetAccounts").find(value=>value.kind==="run")!.cancelled=true;
 if(fault==="revocation")f.grant.revokedAt=1_000_000;if(fault==="lease")args.leaseVersion++;
 if(fault==="binding")args.bindingCanonical="{}";
 const before=f.state(),failure=async()=>{try{await f.call(agent.admitPreparedModelOperationV8,args);throw Error("Expected refusal");}catch(error){if(!(error instanceof Error)||error.message==="Expected refusal")throw error;return{name:error.name,message:error.message,data:"data" in error?error.data:undefined};}};
 enabled=false;const original=await failure();expect(f.state()).toEqual(before);enabled=true;
 expect(await failure()).toEqual(original);expect(f.state()).toEqual(before);
});
