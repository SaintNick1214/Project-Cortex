/** Real registered handlers; controlled native DB/component peers, never cloud latency. */
import {afterEach,beforeEach,expect,it,jest} from "@jest/globals";
import {getFunctionName} from "convex/server";
import type {MutationCtx} from "../../../convex-dev/_generated/server";
import type {GatewayAdmissionCheckpoint,GatewayResolution} from "../../../convex-dev/runtimeGateway";
import {canonicalModelJson} from "../../../src/domain/model-policy";
import {contextSourceKey} from "../../../src/domain/memory-context";
import {assertNativeArgs} from "./native-arguments";
let enabled=true,snapshotReads=true,isolateNewControls=false;
let conversationReuse=true;
let atSnapshot:((nativeCtx:MutationCtx,parent:MutationCtx)=>void)|undefined;
const auth=await import("../../../convex-dev/runtimeAuth");
jest.unstable_mockModule("../../../convex-dev/runtimeAuth",()=>({...auth,
  // Only named historical mechanism comparisons isolate the new canonical
  // terminal reuse; current registered on/off behavior has a separate oracle.
  readV8ConversationRows:(...args:Parameters<typeof auth.readV8ConversationRows>)=>auth.readV8ConversationRows(conversationReuse?args[0]:{...args[0]},args[1],args[2],args[3]),
  // Isolate the older authority/metadata/transcript retention comparison.
  // The new control/hash family has its own registered full-output/read oracle.
  readV8AgentExecutionRows:(...args:Parameters<typeof auth.readV8AgentExecutionRows>)=>auth.readV8AgentExecutionRows(isolateNewControls?{...args[0]}:args[0],args[1],args[2],args[3],args[4]),
  readV8AgentToolRows:(...args:Parameters<typeof auth.readV8AgentToolRows>)=>auth.readV8AgentToolRows(isolateNewControls?{...args[0]}:args[0],args[1],args[2],args[3],args[4]),
  hashV8CanonicalBytes:(ctx:Parameters<typeof auth.hashV8CanonicalBytes>[0],bytes:string)=>auth.hashV8CanonicalBytes(isolateNewControls?undefined:ctx,bytes),
  readTenantPolicyRows:async(ctx:Parameters<typeof auth.readTenantPolicyRows>[0],tenantId:string)=>snapshotReads
    ?auth.readTenantPolicyRows(ctx,tenantId):ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active",q=>q.eq("scope","tenant").eq("tenantId",tenantId).eq("active",true)).take(65),
  readExecutableDefinitionRows:async(ctx:Parameters<typeof auth.readExecutableDefinitionRows>[0],tenantId:string,memorySpaceId:string,agentId:string,version:number)=>snapshotReads
    ?auth.readExecutableDefinitionRows(ctx,tenantId,memorySpaceId,agentId,version):ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_version",q=>q.eq("tenantId",tenantId).eq("memorySpaceId",memorySpaceId).eq("agentId",agentId).eq("version",version)).take(2),
  // Only bridgeFor changed in K29. DataAuth's old managed graph reads remain
  // active in the a773 control, preserving its original traversal behavior.
  readManagedTranscriptBridgeRows:async(ctx:Parameters<typeof auth.readManagedTranscriptBridgeRows>[0],tenantId:string,memorySpaceId:string,nativeMessageId:string)=>!snapshotReads&&(new Error().stack??"").includes("bridgeFor")
    ?ctx.db.query("runtimeTranscriptMessages").withIndex("by_native",q=>q.eq("tenantId",tenantId).eq("memorySpaceId",memorySpaceId).eq("nativeMessageId",nativeMessageId)).take(2)
    :auth.readManagedTranscriptBridgeRows(ctx,tenantId,memorySpaceId,nativeMessageId),
  createV8AuthorityReadScope:<Ctx extends Parameters<typeof auth.createAuthorityReadScope>[0]>(ctx:Ctx,options?:{managedSources:true})=>enabled?auth.createV8AuthorityReadScope(ctx,options):auth.createAuthorityReadScope(ctx,{nativeTranscript:true,policyMetadata:true}),
  withNativeSnapshotReads:<Ctx extends Parameters<typeof auth.withNativeSnapshotReads>[0]>(nativeCtx:Ctx,parent:Ctx):Ctx=>{
    // This hook is used only by the real registered mutation fixture below.
    atSnapshot?.(nativeCtx as unknown as MutationCtx,parent as unknown as MutationCtx);return snapshotReads?auth.withNativeSnapshotReads(nativeCtx,parent):nativeCtx;
  }}));
jest.unstable_mockModule("@convex-dev/workflow",()=>({WorkflowManager:class{
  define(value:{handler:unknown}){return{_handler:value.handler};}async start(){return"workflow:v8-comparison";}
}}));
const {ingestionFixture,installIngestionMockRoot,invoke}=await import("../runtimeIngestion/fixture");
const {definitions,runs,ledger,clone,clock}=await import("../runtimeTranscript/fixture");
const agent=await import("../../../convex-dev/runtimeAgent");
const context=await import("../../../convex-dev/runtimeMemoryContext");
beforeEach(()=>{installIngestionMockRoot();enabled=true;snapshotReads=true;isolateNewControls=false;conversationReuse=true;atSnapshot=undefined;});afterEach(()=>{conversationReuse=true;jest.restoreAllMocks();});
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
 const query=f.db.query.bind(f.db),get=f.db.get.bind(f.db),reads:{method:string;table:string;id?:string;index?:string;keys?:unknown[];limit?:number;documents:number}[]=[];
 jest.spyOn(f.db,"get").mockImplementation(async(table,id)=>{const row=await get(table,id);reads.push({method:"get",table,id,documents:row?1:0});return row;});
 jest.spyOn(f.db,"query").mockImplementation(table=>{
   const record={method:"query",table,index:undefined as string|undefined,keys:[] as unknown[],limit:undefined as number|undefined,documents:0};reads.push(record);const builder=query(table),withIndex=builder.withIndex.bind(builder),take=builder.take.bind(builder),unique=builder.unique.bind(builder);
   builder.withIndex=(index,callback)=>{record.index=index;return withIndex(index,q=>{if(q===null||typeof q!=="object")throw Error("Expected original index query object");const traced=new Proxy(q,{get(target,key){const value:unknown=Reflect.get(target,key,target);if(typeof value!=="function")return value;return(...args:unknown[])=>{record.keys.push([String(key),...args]);const result:unknown=Reflect.apply(value,target,args);return result===target?traced:result;};}});return callback(traced);});};
   builder.take=async n=>{record.limit=n;const rows=await take(n);record.documents=rows.length;return rows;};builder.unique=async()=>{const row=await unique();record.documents=row?1:0;return row;};return builder;
 });
 const retained=(table:string)=>table.startsWith("runtimeAuth")||table==="runtimeModelPolicies"||table==="runtimeModelQualifications"||table==="runtimeAgentDefinitions";
 // The control run now uses the existing exact raw graph reader. Only this
 // bounded index may be reused; other run indexes and financial rows stay fresh.
 const rawRun=(value:typeof reads[number])=>value.method==="query"&&value.table==="runtimeRuns"&&value.index==="by_scoped_id";
 return{reads,clear:()=>{reads.length=0;},counts:()=>({total:reads.length,authority:reads.filter(value=>value.table.startsWith("runtimeAuth")).length,controlRuns:reads.filter(rawRun).length}),
   runIdentities:()=>[...new Set(reads.filter(rawRun).map(({documents:_documents,...value})=>JSON.stringify(value)))].sort(),
   stateReads:()=>clone(reads.filter(value=>!retained(value.table)&&!rawRun(value)&&!(value.table==="runtimeTranscriptMessages"&&value.index==="by_native")))};
}
it("actual V8 preparation retains exact output/state and non-control reads while reducing raw lookups",async()=>{
 conversationReuse=false; // Preserve this historical authority/metadata comparison.
 isolateNewControls=true;
 const f=await fixture(),before=f.state(),observed=instrument(f);enabled=false;
 const original=await f.call(agent.prepareDirectTurnV8,f.attempt),after=f.state(),control=observed.counts(),nonControl=observed.stateReads(),runIdentities=observed.runIdentities();
 f.restore(before);observed.clear();enabled=true;
 const optimized=await f.call(agent.prepareDirectTurnV8,f.attempt);
 expect(optimized).toEqual(original);expect(f.state()).toEqual(after);expect(observed.stateReads()).toEqual(nonControl);
 expect(observed.runIdentities()).toEqual(runIdentities);expect(observed.counts().controlRuns).toBeLessThan(control.controlRuns);
 expect(observed.counts().authority).toBeLessThan(control.authority);expect(observed.counts().total).toBeLessThan(control.total);
 console.info(JSON.stringify({type:"controlled-v8-preparation-read-count",original:control,optimized:observed.counts(),nativeProof:false}));
});
it("three opt-in preparation spans preserve exact native output, state and read order while exposing only scalar timing",async()=>{
 const initial=process.env.CORTEX_RUNTIME_LATENCY_TRACE;
 try{
  delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;const f=await fixture(),before=f.state(),observed=instrument(f),output=jest.spyOn(console,"log").mockImplementation(()=>{});
  const original=await f.call(agent.prepareDirectTurnV8,f.attempt),after=f.state(),reads=clone(observed.reads);expect(output).not.toHaveBeenCalled();
  f.restore(before);observed.clear();process.env.CORTEX_RUNTIME_LATENCY_TRACE="1";
  expect(await f.call(agent.prepareDirectTurnV8,f.attempt)).toEqual(original);expect(f.state()).toEqual(after);expect(observed.reads).toEqual(reads);
  const stages=output.mock.calls.map(([row])=>JSON.parse(row as string) as {phase:string;durationMs?:number});
  for(const stage of ["context-lifecycle","context-route","model-candidate"]){
   expect(stages.filter(row=>row.phase===`prepareDirect.${stage}.begin`)).toHaveLength(1);
   const end=stages.filter(row=>row.phase===`prepareDirect.${stage}.end`);expect(end).toHaveLength(1);expect(end[0]!.durationMs).toBeGreaterThanOrEqual(0);
   expect(Object.keys(end[0]!).sort()).toEqual(["at","attemptNumber","durationMs","phase","runId"]);
  }
 }finally{if(initial===undefined)delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;else process.env.CORTEX_RUNTIME_LATENCY_TRACE=initial;}
});
it("profile availability composes the original helper without changing its repeated current checks",async()=>{
 isolateNewControls=true;
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
 if(typeof prepared.op.nativeRequestCanonical!=="string")throw Error("Expected exact prepared native body");
 return{...f.attempt,operationId:prepared.op.operationId,ordinal:0,requestCanonical:prepared.op.nativeRequestCanonical,snapshotCanonical:canonicalModelJson(resolution.snapshot),
   bindingCanonical:canonicalModelJson({reference:f.reference,operationKey:"agent.respond",runBudgetId:prepared.current.run.runBudgetId,semanticId:prepared.op.semanticId,ordinal:0})};
}
it("financial retention preserves the exact real permit/accounts/attempt and every fresh mutable-row read",async()=>{
 conversationReuse=false; // Preserve this historical financial-row comparison.
 isolateNewControls=true;
 const f=await fixture(),args=await admission(f),before=f.state(),observed=instrument(f);enabled=false;
 const original=await f.call<GatewayAdmissionCheckpoint>(agent.admitPreparedModelOperationV8,args),after=f.state(),control=observed.counts(),nonControl=observed.stateReads(),runIdentities=observed.runIdentities();
 f.restore(before);observed.clear();enabled=true;const actual=await f.call<GatewayAdmissionCheckpoint>(agent.admitPreparedModelOperationV8,args);
 expect(actual).toEqual(original);expect(f.state()).toEqual(after);expect(observed.stateReads()).toEqual(nonControl);
 expect(observed.runIdentities()).toEqual(runIdentities);expect(observed.counts().controlRuns).toBeLessThan(control.controlRuns);
 expect(actual).toMatchObject({admission:{status:"reserved"},permit:{dispatchPermit:true}});
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);expect(observed.counts().authority).toBeLessThan(control.authority);
 console.info(JSON.stringify({type:"controlled-v8-financial-read-count",original:control,optimized:observed.counts(),nativeProof:false}));
});
it.each(["budget","revocation","lease","binding","body"])("current %s still rejects V8 admission with original error/state",async fault=>{
 const f=await fixture(),args=await admission(f);
 if(fault==="budget")f.db.table("runtimeBudgetAccounts").find(value=>value.kind==="run")!.cancelled=true;
 if(fault==="revocation")f.grant.revokedAt=1_000_000;if(fault==="lease")args.leaseVersion++;
 if(fault==="binding")args.bindingCanonical="{}";if(fault==="body"){const body=JSON.parse(args.requestCanonical);body.outputTokens--;args.requestCanonical=canonicalModelJson(body);}
 const before=f.state(),failure=async()=>{try{await f.call(agent.admitPreparedModelOperationV8,args);throw Error("Expected refusal");}catch(error){if(!(error instanceof Error)||error.message==="Expected refusal")throw error;return{name:error.name,message:error.message,data:"data" in error?error.data:undefined};}};
 enabled=false;const original=await failure();expect(f.state()).toEqual(before);enabled=true;
 expect(await failure()).toEqual(original);expect(f.state()).toEqual(before);
});


it("K29 exact-owner direct empty parent reruns save predicates with identical outcome/state and fewer raw rereads",async()=>{
 conversationReuse=false; // Preserve this historical snapshot-view comparison.
 isolateNewControls=true;
 const f=await fixture(),before=f.state(),observed=instrument(f),queryPort=f.ctx.runQuery.bind(f.ctx),components:string[]=[];
 f.ctx.runQuery=(async(ref,args)=>{let name='component';try{name=getFunctionName(ref);}catch{/* controlled official component identity */}components.push(name);return queryPort(ref,args);}) as MutationCtx['runQuery'];
 snapshotReads=false;const expected=await f.call(agent.prepareDirectTurnV8,f.attempt),after=f.state(),baseline=clone(observed.reads),baselineComponents=[...components];
 f.restore(before);observed.clear();components.length=0;snapshotReads=true;
 expect(await f.call(agent.prepareDirectTurnV8,f.attempt)).toEqual(expected);const actual=clone(observed.reads);
 expect(f.state()).toEqual(after);
 const mutable=(values:typeof baseline)=>values.filter(row=>!row.table.startsWith('runtimeAuth')&&!['runtimeModelPolicies','runtimeModelQualifications','runtimeAgentDefinitions'].includes(row.table)&&!(row.table==='runtimeTranscriptMessages'&&row.index==='by_native'));
 expect(mutable(actual)).toEqual(mutable(baseline));
 const identities=(values:typeof baseline)=>[...new Set(values.map(({documents:_documents,...row})=>JSON.stringify(row)))].sort();
 expect(identities(actual)).toEqual(identities(baseline));expect([...new Set(components)]).toEqual([...new Set(baselineComponents)]);
 expect(actual.length).toBeLessThan(baseline.length);expect(components.length).toBeLessThan(baselineComponents.length);
 expect(f.db.table('runtimeModelAttempts')).toHaveLength(0);
 const summary=(values:typeof baseline)=>{const groups=new Map<string,{signature:string;calls:number;documents:number}>();
  for(const row of values){const signature=`${row.method}:${row.table}:${row.index??''}`,group=groups.get(signature)??{signature,calls:0,documents:0};
   group.calls++;group.documents+=row.documents;groups.set(signature,group);}
  return [...groups.values()].sort((a,b)=>b.calls-a.calls);};
 console.info(JSON.stringify({type:'k29-current-a773-direct-empty-parent',baseline:{dbReads:baseline.length,documents:baseline.reduce((n,row)=>n+row.documents,0),componentQueries:baselineComponents.length,tableQueries:summary(baseline)},actual:{dbReads:actual.length,documents:actual.reduce((n,row)=>n+row.documents,0),componentQueries:components.length,tableQueries:summary(actual)},
  exactResultStateAndMutableReadOrder:true,nativeLatency:'NOT_RUN'}));
});
it.each(['definition-write','policy-write','qualification-write','authority-write','component-write','unknown-write','expiry'])(
 "K29 direct empty save fence retains original %s denial/rollback",async fault=>{
 const f=await fixture(),before=f.state(),nativeMutation=f.ctx.runMutation.bind(f.ctx);let reached=0,pending:Promise<unknown>|undefined;
 // This controlled component writer completes a policy revocation. It is a
 // real wrapped runMutation boundary, not an external change inside a query.
 f.ctx.runMutation=(async(ref,args)=>{if(getFunctionName(ref)==='k29:controlledComponentWrite'){
   f.db.table('runtimeModelPolicies')[0]!.revokedAt=clock;return null;
  }return nativeMutation(ref,args);}) as MutationCtx['runMutation'];
 const {makeFunctionReference}=await import('convex/server');
 atSnapshot=(_native,parent)=>{reached++;
  if(fault==='expiry'){jest.spyOn(Date,'now').mockReturnValue(clock+700_000);return;}
  if(fault==='definition-write')pending=parent.db.patch('runtimeAgentDefinitions',f.db.table('runtimeAgentDefinitions').find(row=>row.agentId===f.run.agentId&&row.version===f.run.agentVersion)!._id as never,{revokedAt:clock});
  if(fault==='policy-write')pending=parent.db.patch('runtimeModelPolicies',f.db.table('runtimeModelPolicies')[0]!._id as never,{revokedAt:clock});
  if(fault==='qualification-write')pending=parent.db.patch('runtimeModelQualifications',f.db.table('runtimeModelQualifications')[0]!._id as never,{revokedAt:clock});
  if(fault==='authority-write')pending=parent.db.patch('runtimeAuthGrants',f.grant._id as never,{revokedAt:clock});
  if(fault==='component-write')pending=parent.runMutation(makeFunctionReference<'mutation'>('k29:controlledComponentWrite'),{});
  // An unrelated/unknown table writer must still clear ALL retained families.
  if(fault==='unknown-write'){
   pending=parent.db.patch('runtimeConversations',f.db.table('runtimeConversations')[0]!._id as never,{tombstonedAt:clock});
  }
 };
 const failure=async()=>{try{await f.call(agent.prepareDirectTurnV8,f.attempt);throw Error('EXPECTED_REFUSAL');}
  catch(error){if(!(error instanceof Error)||error.message==='EXPECTED_REFUSAL')throw error;return{name:error.name,message:error.message,data:'data' in error?error.data:undefined};}
  finally{await pending;}};
 snapshotReads=false;const expected=await failure();expect(reached).toBe(1);expect(f.state()).toEqual(before);
 jest.spyOn(Date,'now').mockReturnValue(clock);reached=0;snapshotReads=true;
 expect(await failure()).toEqual(expected);expect(reached).toBe(1);expect(f.state()).toEqual(before);
});
