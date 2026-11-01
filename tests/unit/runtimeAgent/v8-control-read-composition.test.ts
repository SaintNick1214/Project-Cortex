import { semanticHashDigest } from "../semantic-hash-probe";
/** Actual registered preparations with raw reuse disabled/enabled; no service or speed claim. */
import {afterEach,beforeEach,expect,it,jest} from '@jest/globals';
import {getFunctionName,makeFunctionReference} from 'convex/server';
import type {MutationCtx} from '../../../convex-dev/_generated/server';
import type {ContextSourceWitness} from '../../../src/domain/context-witness';
import {assertNativeArgs} from './native-arguments';
let reuse=true,activeSaveView=false;const predicates:unknown[]=[],saveViews=new WeakSet<object>();
let afterHash:((ctx:Parameters<typeof auth.hashV8CanonicalBytes>[0],bytes:string)=>Promise<void>)|undefined;
const auth=await import('../../../convex-dev/runtimeAuth');
jest.unstable_mockModule('../../../convex-dev/runtimeAuth',()=>({...auth,
 withNativeSnapshotReads:<Ctx extends Parameters<typeof auth.withNativeSnapshotReads>[0]>(ctx:Ctx,parent:Ctx)=>{const view=auth.withNativeSnapshotReads(ctx,parent);saveViews.add(view);return view;},
 hashV8CanonicalBytes:async(ctx:Parameters<typeof auth.hashV8CanonicalBytes>[0],bytes:string)=>{predicates.push(['sha256',bytes]);const result=await auth.hashV8CanonicalBytes(reuse?ctx:undefined,bytes);await afterHash?.(ctx,bytes);return result;},
 readV8AgentExecutionRows:async(...args:Parameters<typeof auth.readV8AgentExecutionRows>)=>{predicates.push(['execution',...args.slice(1)]);const previous=activeSaveView;activeSaveView=saveViews.has(args[0]);try{return await auth.readV8AgentExecutionRows(reuse?args[0]:{...args[0]},args[1],args[2],args[3],args[4]);}finally{activeSaveView=previous;}},
 readV8AgentToolRows:async(...args:Parameters<typeof auth.readV8AgentToolRows>)=>{predicates.push(['tool-list',...args.slice(1)]);const previous=activeSaveView;activeSaveView=saveViews.has(args[0]);try{return await auth.readV8AgentToolRows(reuse?args[0]:{...args[0]},args[1],args[2],args[3],args[4]);}finally{activeSaveView=previous;}},
 recheckAuthority:async(...args:Parameters<typeof auth.recheckAuthority>)=>{predicates.push(['authority',args[1],args[2]]);return auth.recheckAuthority(...args);}
}));
jest.unstable_mockModule('@convex-dev/workflow',()=>({WorkflowManager:class{define(input:{handler:unknown}){return{_handler:input.handler};}async start(){return'workflow:control-comparison';}}}));
const {ingestionFixture,installIngestionMockRoot,invoke}=await import('../runtimeIngestion/fixture');
const {definitions,runs,transcript,clone,clock}=await import('../runtimeTranscript/fixture');
const agent=await import('../../../convex-dev/runtimeAgent');
const {ConvexMemoryRepository}=await import('../../../convex-dev/runtimeMemoryRepository');
beforeEach(()=>{installIngestionMockRoot();reuse=true;activeSaveView=false;afterHash=undefined;predicates.length=0;});afterEach(()=>{jest.restoreAllMocks();});
async function directFixture(historyPairs=0,effort="normal"){
 const f=await ingestionFixture(),oldMutation=f.ctx.runMutation.bind(f.ctx),oldQuery=f.ctx.runQuery.bind(f.ctx),calls:string[]=[];
 const resolve=(name:string)=>name.startsWith("runtimeAgent:")?agent[name.split(":")[1] as keyof typeof agent]:name.startsWith("runs:")?runs[name.split(":")[1] as keyof typeof runs]:undefined;
 f.ctx.runMutation=(async(ref,args)=>{let name="";try{name=getFunctionName(ref);}catch{return oldMutation(ref,args);}const target=resolve(name);if(target){calls.push(name);assertNativeArgs(target,args);return f.call(target,args);}return oldMutation(ref,args);}) as MutationCtx["runMutation"];
 f.ctx.runQuery=(async(ref,args)=>{let name="";try{name=getFunctionName(ref);}catch{return oldQuery(ref,args);}const target=resolve(name);if(target){calls.push(name);assertNativeArgs(target,args);return invoke(target,f.ctx,args);}return oldQuery(ref,args);}) as MutationCtx["runQuery"];
 let conversationId;
 if(historyPairs){const conversation=await f.call<{conversationId:string}>(transcript.create,{memorySpaceId:"space-a",clientRequestId:"profile-history"});conversationId=conversation.conversationId;const row=f.db.table("runtimeConversations")[0];row.manualWriteLocked=false;
 for(let i=0;i<historyPairs;i++)for(const role of ["user","assistant"]){await f.call(transcript.append,{conversationId,expectedRevision:row.historyRevision,role,parts:[{type:"text",text:(role==="user"?"Remember the reservation and our travel details. ":"The reservation is confirmed with the requested travel details. ").repeat(20)}]});}row.manualWriteLocked=true;}
 const published=await f.call<{agentId:string;version:number}>(definitions.publishVersion,{memorySpaceId:"space-a",clientMutationId:"read-retention-v8",expectedPreviousVersion:0,
   definitionInput:{...f.definitionInput,context:{...f.definitionInput.context,handlerId:"cortex.transcript.relevant",registryHash:await definitions.executableRegistryHashV4(),handlerVersion:2,
     inputSelection:{version:2}}}});
 const run=await f.call<ReturnType<typeof runs.publicRun>>(runs.submit,{request:{...f.request("profile-current",conversationId),agentId:published.agentId,agentVersion:published.version,memory:{effort}}});
 await f.call(agent.start,{runId:run.runId});const owned=f.db.table("runtimeAgentExecutions")[0]!;
 const attempt={reference:f.reference,runId:run.runId,attemptNumber:1,leaseVersion:owned.leaseVersion as number};
 const state=()=>clone({rows:f.db.rows,writes:f.db.writes,sequence:f.db.sequence,native:f.native,effects:f.effects,scheduled:f.scheduled});
 const restore=(value:ReturnType<typeof state>)=>{f.db.rows=clone(value.rows);f.db.writes=value.writes;f.db.sequence=value.sequence;Object.assign(f.native,clone(value.native));Object.assign(f.effects,value.effects);f.scheduled.splice(0,f.scheduled.length,...clone(value.scheduled));};
 return {...f,get grant(){return f.grant;},attempt,run,calls,state,restore};
}
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

function observe(f:Awaited<ReturnType<typeof directFixture>>|Awaited<ReturnType<typeof registeredFixture>>){
 predicates.length=0;let phase='entry';const reads:{table:string;index?:string;method:string;keys:unknown[];phase:string;limit?:number;id?:string;saveView?:boolean}[]=[],builders:unknown[]=[];
 const query=f.db.query.bind(f.db),get=f.db.get.bind(f.db);
 jest.spyOn(console,'log').mockImplementation((value:unknown)=>{try{const event=JSON.parse(String(value)) as {phase?:string};if(event.phase?.startsWith('prepareDirect.'))phase=event.phase;}catch{/* trace scalars only */}});
 jest.spyOn(f.db,'get').mockImplementation(async(table,id)=>{reads.push({table,method:'get',keys:[],phase,id});return get(table,id);});
 jest.spyOn(f.db,'query').mockImplementation(table=>{builders.push(['query',table]);const b=query(table),withIndex=b.withIndex.bind(b),take=b.take.bind(b),unique=b.unique.bind(b),collect=b.collect.bind(b);let index:string|undefined;const keys:unknown[]=[];
 b.withIndex=(name,callback)=>{index=name;builders.push(['index',name]);return withIndex(name,q=>{if(q===null||typeof q!=='object')throw Error('Expected native query');const proxy=new Proxy(q,{get(target,key){const value:unknown=Reflect.get(target,key,target);if(typeof value!=='function')return value;return(...args:unknown[])=>{keys.push([String(key),...args]);builders.push([String(key),...args]);const result:unknown=Reflect.apply(value,target,args);return result===target?proxy:result;};}});return callback(proxy);});};
 b.take=async n=>{reads.push({table,index,method:'take',limit:n,keys,phase,saveView:activeSaveView});return take(n);};b.unique=async()=>{reads.push({table,index,method:'unique',keys,phase});return unique();};b.collect=async()=>{reads.push({table,index,method:'collect',keys,phase});return collect();};return b;});
 const source=ConvexMemoryRepository.prototype.getSource;jest.spyOn(ConvexMemoryRepository.prototype,'getSource').mockImplementation(async function(this:InstanceType<typeof ConvexMemoryRepository>,...args:Parameters<typeof source>){predicates.push(['source',...args]);return source.apply(this,args);});
 const candidate=(r:typeof reads[number])=>r.method==='take'&&r.index==='by_attempt'&&(r.table==='runtimeAgentExecutions'&&r.limit===2||r.table==='runtimeAgentOperations'&&r.limit===33&&JSON.stringify(r.keys).includes('tool'));
 return{reads,builders,candidate,clear(){reads.length=0;builders.length=0;predicates.length=0;phase='entry';}};
}
it.each([{pairs:0,effort:'normal'},{pairs:1,effort:'fast'},{pairs:2,effort:'normal'}])('registered empty/recent $pairs/$effort retains exact model body/state/predicate/query-builder order',async shape=>{
 const initial=process.env.CORTEX_RUNTIME_LATENCY_TRACE;process.env.CORTEX_RUNTIME_LATENCY_TRACE='1';try{
 const f=await directFixture(shape.pairs,shape.effort),seen=observe(f),before=f.state(),digest=semanticHashDigest.digest.bind(semanticHashDigest),crypto=jest.spyOn(semanticHashDigest,'digest').mockImplementation(digest);reuse=false;
 const expected=await f.call(agent.prepareDirectTurnV8,f.attempt),after=f.state(),old=clone(seen.reads),builders=clone(seen.builders),logical=clone(predicates),oldDigests=crypto.mock.calls.length;f.restore(before);seen.clear();crypto.mockClear();reuse=true;
 const actual=await f.call(agent.prepareDirectTurnV8,f.attempt);expect(actual).toEqual(expected);expect(f.state()).toEqual(after);expect(predicates).toEqual(logical);expect(seen.builders).toEqual(builders);
 expect(crypto.mock.calls.length).toBeLessThan(oldDigests);
 expect(seen.reads.filter(r=>!seen.candidate(r))).toEqual(old.filter(r=>!seen.candidate(r)));
 // The inline empty-save view is identified by the source native view factory,
 // rather than treating missing V8 brand alone as proof of a fresh DB path.
 const oldViews=old.filter(r=>seen.candidate(r)&&r.saveView),newViews=seen.reads.filter(r=>seen.candidate(r)&&r.saveView);
 expect(oldViews).toHaveLength(5);expect(newViews).toEqual(oldViews);
 const execution=(rows:typeof old)=>rows.filter(r=>r.table==='runtimeAgentExecutions'&&r.index==='by_attempt'&&r.limit===2).length;
 expect(execution(old)).toBe(25);expect(execution(seen.reads)).toBeLessThan(execution(old));
 const operations=(rows:typeof old)=>rows.filter(r=>r.table==='runtimeAgentOperations'&&r.index==='by_operation');expect(operations(seen.reads)).toEqual(operations(old));expect(operations(old)).toHaveLength(4);
 console.info(JSON.stringify({type:'controlled-v8-agent-control-reads',shape,oldExecution:execution(old),newExecution:execution(seen.reads),oldCandidate:old.filter(seen.candidate).length,newCandidate:seen.reads.filter(seen.candidate).length,oldDigests,newDigests:crypto.mock.calls.length,saveViewReads:newViews.length,exactOutputStatePredicatesBuilders:true,hostedLatency:'NOT_RUN'}));
 }finally{if(initial===undefined)delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;else process.env.CORTEX_RUNTIME_LATENCY_TRACE=initial;}
});
it('registered selected-source/history-owner candidate preserves raw source and all noncandidate reads',async()=>{
 const f=await registeredFixture(),seen=observe(f),before=f.state();reuse=false;const expected=await f.call(agent.saveAndPrepareContextV8,f.save),after=f.state(),old=clone(seen.reads),logical=clone(predicates),builders=clone(seen.builders);
 f.restore(before);seen.clear();reuse=true;expect(await f.call(agent.saveAndPrepareContextV8,f.save)).toEqual(expected);expect(f.state()).toEqual(after);expect(predicates).toEqual(logical);expect(seen.builders).toEqual(builders);
 expect(seen.reads.filter(r=>!seen.candidate(r))).toEqual(old.filter(r=>!seen.candidate(r)));expect(seen.reads.filter(seen.candidate).length).toBeLessThan(old.filter(seen.candidate).length);
 expect(f.db.table('runtimeModelAttempts')).toHaveLength(0);
});
it.each(['grant','source','lease','account','history-owner'])('registered current %s refusal retains first error/rollback with reuse on/off',async fault=>{
 const f=await registeredFixture(),seen=observe(f);if(fault==='grant')f.grant.revokedAt=clock;if(fault==='source')f.db.table('runtimeMemorySources').find(r=>(r.lineage as {sourceId:string}).sourceId===f.witness.sourceId)!.contentHash='0'.repeat(64);
 if(fault==='lease')f.save.leaseVersion++;if(fault==='account'){const run=f.db.table('runtimeRuns').find(r=>r.runId===f.save.runId)!;f.db.table('runtimeBudgetAccounts').find(r=>r._id===run.runAccountId)!.tenantId='foreign';}
 if(fault==='history-owner')f.db.table('runtimeAgentExecutions').find(r=>r.runId==='history-owner')!.state='unknown';
 const before=f.state(),failure=async()=>{try{await f.call(agent.saveAndPrepareContextV8,f.save);throw Error('EXPECTED_REFUSAL');}catch(error){if(!(error instanceof Error)||error.message==='EXPECTED_REFUSAL')throw error;return{name:error.name,message:error.message,data:'data'in error?error.data:undefined};}};
 reuse=false;const expected=await failure(),logical=clone(predicates);expect(f.state()).toEqual(before);seen.clear();reuse=true;expect(await failure()).toEqual(expected);expect(predicates).toEqual(logical);expect(f.state()).toEqual(before);expect(f.db.table('runtimeModelAttempts')).toHaveLength(0);
});
it.each(['message-bytes','bridge-revision'])('a real wrapped native writer changing %s invalidates retained hashes and rejects with original rollback',async fault=>{
 const f=await registeredFixture(),seen=observe(f),native=f.ctx.runMutation.bind(f.ctx);let triggered=0;
 f.ctx.runMutation=(async(ref,args)=>{if(getFunctionName(ref)!=='control:changeHistory')return native(ref,args);
  const bridge=f.db.table('runtimeTranscriptMessages').find(row=>row.runId==='history-owner')!;
  if(fault==='message-bytes')f.native.messages.get(bridge.nativeMessageId as string)!.message={role:'user',content:'Changed current private bytes'};
  else await f.db.patch('runtimeTranscriptMessages',bridge._id,{revision:Number(bridge.revision)+1});return null;
 }) as MutationCtx['runMutation'];
 afterHash=async(ctx,bytes)=>{if(!ctx||!bytes.includes('Remember our reservation')||++triggered!==2)return;
  await (ctx as MutationCtx).runMutation(makeFunctionReference<'mutation'>('control:changeHistory'),{});
 };
 const before=f.state(),failure=async()=>{try{await f.call(agent.saveAndPrepareContextV8,f.save);throw Error('EXPECTED_REFUSAL');}catch(error){if(!(error instanceof Error)||error.message==='EXPECTED_REFUSAL')throw error;return{name:error.name,message:error.message,data:'data'in error?error.data:undefined};}};
 reuse=false;const expected=await failure(),logical=clone(predicates);expect(triggered).toBeGreaterThanOrEqual(2);expect(f.state()).toEqual(before);
 seen.clear();triggered=0;reuse=true;expect(await failure()).toEqual(expected);expect(predicates).toEqual(logical);expect(f.state()).toEqual(before);expect(f.db.table('runtimeModelAttempts')).toHaveLength(0);
});
