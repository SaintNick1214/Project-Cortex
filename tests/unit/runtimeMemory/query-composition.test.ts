/** Original policy/Gateway/DB handlers; only external provider and native DB ports controlled. */
import {afterEach,beforeEach,it,expect,jest} from '@jest/globals';
import {getFunctionName} from 'convex/server';
import {ConvexError} from 'convex/values';
import type {Id} from '../../../convex-dev/_generated/dataModel';
import type {EmbeddingModelV4} from '@ai-sdk/provider';
import type {DerivedFact} from '../../../src/domain/contracts';
import type {MutationCtx,ActionCtx} from '../../../convex-dev/_generated/server';
import {canonicalModelJson} from '../../../src/domain/model-policy';
import {DEFAULT_EMBEDDING_PROFILE as profile} from '../../../src/domain/profile';
let calls=0,embeddingAdvanceMs=0;
const native=jest.fn<(id:string)=>EmbeddingModelV4>(id=>({specificationVersion:'v4',modelId:id,provider:'convexGateway.embedding',maxEmbeddingsPerCall:1,supportsParallelCalls:false,
  doEmbed:async()=>{calls++;if(embeddingAdvanceMs)jest.spyOn(Date,"now").mockReturnValue(clock+embeddingAdvanceMs);return {embeddings:[Array.from({length:1536},(_,i)=>i===0?1:0)],warnings:[],response:{body:{id:'controlled-public-query',model:'text-embedding-3-small',data:[{index:0,object:'embedding'}],usage:{prompt_tokens:1}}}};}}));
jest.unstable_mockModule('@convex-dev/ai-sdk-provider',()=>({convexGateway:Object.assign(()=>{throw Error('No chat');},{embeddingModel:native})}));
let nativeSnapshotReads=true;
const originalAuth=await import('../../../convex-dev/runtimeAuth');
jest.unstable_mockModule('../../../convex-dev/runtimeAuth',()=>({...originalAuth,
  readTenantPolicyRows:async(ctx:Parameters<typeof originalAuth.readTenantPolicyRows>[0],tenantId:string)=>nativeSnapshotReads
    ?originalAuth.readTenantPolicyRows(ctx,tenantId):ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active",q=>q.eq("scope","tenant").eq("tenantId",tenantId).eq("active",true)).take(65),
  readExecutableDefinitionRows:async(ctx:Parameters<typeof originalAuth.readExecutableDefinitionRows>[0],tenantId:string,memorySpaceId:string,agentId:string,version:number)=>nativeSnapshotReads
    ?originalAuth.readExecutableDefinitionRows(ctx,tenantId,memorySpaceId,agentId,version):ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_version",q=>q.eq("tenantId",tenantId).eq("memorySpaceId",memorySpaceId).eq("agentId",agentId).eq("version",version)).take(2),
  // Only bridgeFor changed in K29. DataAuth's old managed graph reads remain
  // active in the a773 control, preserving its original traversal behavior.
  readManagedTranscriptBridgeRows:async(ctx:Parameters<typeof originalAuth.readManagedTranscriptBridgeRows>[0],tenantId:string,memorySpaceId:string,nativeMessageId:string)=>!nativeSnapshotReads&&(new Error().stack??"").includes("bridgeFor")
    ?ctx.db.query("runtimeTranscriptMessages").withIndex("by_native",q=>q.eq("tenantId",tenantId).eq("memorySpaceId",memorySpaceId).eq("nativeMessageId",nativeMessageId)).take(2)
    :originalAuth.readManagedTranscriptBridgeRows(ctx,tenantId,memorySpaceId,nativeMessageId),
  withNativeSnapshotReads:<Ctx extends Parameters<typeof originalAuth.withNativeSnapshotReads>[0]>(nativeCtx:Ctx,parent:Ctx):Ctx=>nativeSnapshotReads
    ?originalAuth.withNativeSnapshotReads(nativeCtx,parent):originalAuth.withManagedSourceValidationReads(nativeCtx,parent),
}));
const {ingestionFixture,installIngestionMockRoot,invoke}=await import('../runtimeIngestion/fixture');
const {ledger,clone,clock}=await import('../runtimeTranscript/fixture');
const query=await import('../../../convex-dev/runtimeMemoryQuery');
const memory=await import('../../../convex-dev/runtimeMemory');
const auth=await import('../../../convex-dev/runtimeAuth');
const {ConvexMemoryRepository,createActionMemoryRepository}=await import('../../../convex-dev/runtimeMemoryRepository');
const {replaceFactEntityLinks}=await import('../../../convex-dev/runtimeMemoryTraversal');
const {readCurrentEmbeddingProfile,resolveHandler}=await import('../../../convex-dev/runtimeModelPolicy');
const {createGatewayMemoryModel}=await import('../../../convex-dev/runtimeMemoryGateway');
const {recallMemory}=await import('../../../convex-dev/runtimeMemoryServices');
type CompleteRecallDelivery = typeof import('../../../convex-dev/runtimeMemoryServices').completeRecallDelivery;
beforeEach(()=>{calls=0;embeddingAdvanceMs=0;nativeSnapshotReads=true;installIngestionMockRoot();});afterEach(()=>{jest.restoreAllMocks();});
async function fixture(effortAware=false,effort:"fast"|"normal"|"high"|"max"="normal",queryText="coral preference",maxEntries=10) {
  const f=await ingestionFixture(),oldQuery=f.ctx.runQuery.bind(f.ctx),oldMutation=f.ctx.runMutation.bind(f.ctx),rpc:string[]=[];
  const names={runtimeMemory:memory,runtimeMemoryQuery:query,runtimeModelPolicy:ledger,runtimeAuth:auth};
  const registration=(ref:Parameters<typeof getFunctionName>[0])=>{let name:string;try{name=getFunctionName(ref);}catch{return;}
    const [module,method]=name.split(':');if(!(module in names))return;const values=names[module as keyof typeof names] as Record<string,unknown>;if(values[method!])return {name,value:values[method!]};};
  f.ctx.runQuery=(async(ref,args)=>{const found=registration(ref);if(!found)return oldQuery(ref,args);rpc.push(found.name);return invoke(found.value,f.ctx,args);}) as MutationCtx['runQuery'];
  let fault:(()=>Promise<void>)|undefined;
  f.ctx.runMutation=(async(ref,args)=>{const found=registration(ref);if(!found)return oldMutation(ref,args);rpc.push(found.name);
    return f.transaction(async()=>{if(['runtimeModelPolicy:checkpoint','runtimeModelPolicy:checkpointRecall'].includes(found.name)&&fault)await fault();return invoke(found.value,f.ctx,args);});}) as MutationCtx['runMutation'];
  const input={text:queryText,requestId:'public-query',limit:10,...(effortAware?{memory:{effort,maxEntries}}:{})};
  const budget=await f.call<{runBudgetId:string}>(ledger.ensureBudget,{reference:f.reference,operationKey:'embedding.query',requestId:input.requestId,requestCanonical:canonicalModelJson({...{purpose:'recall',text:input.text,limit:input.limit},...(effortAware?{memory:input.memory,memoryEffortPolicyVersion:1}:{})})});
  const args={reference:f.reference,runBudgetId:budget.runBudgetId,input},action={...f.ctx,vectorSearch:async()=>[]} as unknown as ActionCtx,
    repository=createActionMemoryRepository(action,f.reference,'read');
  const state=()=>clone({rows:new Map([...f.db.rows].filter(([,rs])=>rs.length)),writes:f.db.writes,effects:f.effects,native:f.native,scheduled:f.scheduled});
  return {...f,get grant(){return f.grant;},rpc,input,args,action,repository,state,checkpointFault:(v:typeof fault)=>{fault=v;}};
}
async function prepared(f:Awaited<ReturnType<typeof fixture>>) {
  const p=await f.call<Awaited<ReturnType<typeof query.preparePublicRecallHandler>>>(query.prepare,f.args);if(p.kind!=='prepared')throw Error('Unexpected refusal');return p;
}
it('combined query reruns original read/profile/readiness/two-resolution predicates and proposes identical inputs without effects',async()=>{
  const f=await fixture(),before=f.state(),p=await prepared(f);
  const r=new ConvexMemoryRepository(f.ctx,f.reference,'read');
  const firstProfile=await readCurrentEmbeddingProfile(f.ctx,f.reference,'embedding.query',f.args.runBudgetId);await r.assertProfileReady(firstProfile,f.args.runBudgetId);
  await r.recheckAuthority();await r.assertReadAuthority();await r.recheckAuthority();
  const currentProfile=await readCurrentEmbeddingProfile(f.ctx,f.reference,'embedding.query',f.args.runBudgetId);await r.assertProfileReady(currentProfile,f.args.runBudgetId);await r.recheckAuthority();
  expect(p.profile).toEqual(currentProfile);expect(p.resolutions).toEqual([await resolveHandler(f.ctx,p.binding),await resolveHandler(f.ctx,p.binding)]);
  expect(p.request.texts).toEqual([f.input.text]);expect(f.state()).toEqual(before);expect(calls).toBe(0);
});
it('actual public Action resolves Normal and keeps one native preparation and one admit/checkpoint parent',async()=>{
  const f=await fixture(true);f.rpc.length=0;
  const actual=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
  expect(actual).toMatchObject({items:[],context:'',profileId:profile.profileId});expect(calls).toBe(1);
  expect(f.rpc.filter(n=>n==='runtimeMemoryQuery:prepare')).toHaveLength(1);expect(f.rpc.filter(n=>n==='runtimeMemoryQuery:admit')).toHaveLength(1);
  expect(f.rpc.filter(n=>n==='runtimeModelPolicy:checkpointRecall')).toHaveLength(1);expect(f.rpc.filter(n=>n==='runtimeModelPolicy:resolve')).toEqual([]);
  expect(f.rpc.indexOf('runtimeModelPolicy:captureTerminalEvidence')).toBeLessThan(f.rpc.indexOf('runtimeModelPolicy:attachTerminalResult'));
  expect(f.db.table('runtimeModelAttempts')).toMatchObject([{state:'uncertain',slotReleased:true,resultAttachmentState:'attached'}]);
  const before=calls,referenceModel=createGatewayMemoryModel(f.action,f.repository,{runBudgetId:f.args.runBudgetId});
  // Existing attached operation replays without another controlled provider call.
  const expected=await recallMemory({repository:f.repository,model:referenceModel,clock:{now:()=>clock}},f.input);
  expect(actual).toEqual({...expected,memoryEffort:actual.memoryEffort});expect(actual.memoryEffort).toMatchObject({requestedEffort:"normal",maxDepth:4,maxEntries:8});expect(calls).toBe(before);
});
it.each(['revoked','expired','wrong_owner','wrong_budget','changed_text','changed_limit','duplicate_grant'])('fresh native preparation rejects %s before dispatch or ledger writes',async fault=>{
  const f=await fixture(),args={...f.args,input:{...f.input}};
  if(fault==='revoked')f.grant.revokedAt=clock;if(fault==='expired')f.grant.expiresAt=clock;
  if(fault==='wrong_owner')args.reference={...f.reference,principalId:'foreign'};if(fault==='wrong_budget')args.runBudgetId='foreign';
  if(fault==='changed_text')args.input.text+=' changed';if(fault==='changed_limit')args.input.limit=1;
  if(fault==='duplicate_grant')f.db.seed('runtimeAuthGrants',{...f.grant,_id:'runtimeAuthGrants:duplicate'});
  const before=f.state();try{const result=await f.call<Awaited<ReturnType<typeof query.preparePublicRecallHandler>>>(query.prepare,args);expect(result.kind).toBe('refused');}catch(error){expect(error).toBeInstanceOf(ConvexError);}
  expect(f.state()).toEqual(before);expect(calls).toBe(0);
});
function admissionArgs(f:Awaited<ReturnType<typeof fixture>>,p:Awaited<ReturnType<typeof prepared>>) {
  const pins=p.resolutions[0].snapshot.pins,requestCanonical=canonicalModelJson({semanticId:p.binding.semanticId,childCallId:'native-placeholder',texts:[f.input.text],profile:p.profile,batch:{ordinal:0,start:0,end:1},
    inputTokens:Buffer.byteLength(f.input.text),outputTokens:0,toolSteps:0,timeoutMs:p.resolutions[0].snapshot.limits.timeoutMs,reservationUnits:p.resolutions[0].snapshot.costBound.maximumCostUnits,
    promptVersion:pins.promptVersion,schemaVersion:pins.schemaVersion,extractionVersion:pins.extractionVersion,toolRegistryVersion:pins.toolRegistryVersion,tools:[],options:{maxRetries:0}});
  return {...f.args,bindingCanonical:canonicalModelJson(p.binding),requestCanonical,snapshotCanonical:canonicalModelJson(p.resolutions[0].snapshot)};
}
it.each(['known','partial_child'])('fresh checkpoint %s refusal retains reservation and rolls back only the failed child',async kind=>{
  const f=await fixture(),p=await prepared(f),args=admissionArgs(f,p);
  f.checkpointFault(async()=>{if(kind==='partial_child')await f.ctx.db.insert('runtimeMemoryCaptureConversations',{tenantId:'tenant-a',memorySpaceId:'space-a',ownerPrincipalId:f.reference.principalId,conversationId:'rolled-back',conversationEpoch:1,ingressKind:'remember-exchange-v1',captureAppendLocked:false});
    throw new ConvexError({version:1,code:'FORBIDDEN',message:'Checkpoint denied',retryable:false,outcome:'uncertain'});});
  const result=await f.call<Awaited<ReturnType<typeof query.admitPublicRecallHandler>>>(query.admit,args);
  expect(result).toHaveProperty('refusal');expect(f.db.table('runtimeModelAttempts')).toMatchObject([{state:'reserved',slotReleased:false}]);
  expect(f.db.table('runtimeMemoryCaptureConversations')).toHaveLength(0);expect(calls).toBe(0);
});

it.each(['grant','qualification','policy','cancelled_budget'])('fresh admission revalidates %s after the tentative preparation',async fault=>{
  const f=await fixture(),p=await prepared(f),args=admissionArgs(f,p);
  if(fault==='grant')f.grant.revokedAt=clock;
  if(fault==='qualification')f.db.table('runtimeModelQualifications')[0].revokedAt=clock;
  if(fault==='policy')f.db.table('runtimeModelPolicies')[0].revokedAt=clock;
  if(fault==='cancelled_budget')f.db.table('runtimeBudgetAccounts').find(r=>r.kind==='run')!.cancelled=true;
  const before=f.state();await expect(f.call(query.admit,args)).rejects.toBeInstanceOf(ConvexError);expect(f.state()).toEqual(before);expect(calls).toBe(0);
});
it('actual public Action preserves committed reservation after bounded checkpoint refusal and dispatches no provider',async()=>{
  const f=await fixture(true);f.checkpointFault(async()=>{throw new ConvexError({version:1,code:'FORBIDDEN',retryable:false,outcome:'uncertain'});});
  await expect(invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId})).rejects.toMatchObject({data:{code:'MEMORY_OPERATION_FAILED',outcome:'uncertain'}});
  expect(f.db.table('runtimeModelAttempts')).toMatchObject([{state:'reserved',slotReleased:false}]);expect(calls).toBe(0);
});

async function populatedPublicFixture(withVectors=false,effortAware=false,effort:"fast"|"normal"="normal") {
  const f=await fixture(effortAware,effort);
  const {prepareSourceContent,processingIdentityKey}=await import('../../../src/domain/sources');
  const {memoryScope}=await import('../../../convex-dev/runtimeMemoryRepository');
  const scope=memoryScope(f.reference),writer=new ConvexMemoryRepository(f.ctx,f.reference,'write',f.ctx.db);
  for(let i=0;i<3;i++) {
    const text=`Independent preference ${i}`,source=await f.source(text,`public-bound-source-${i}`);
    const prepared=await prepareSourceContent(scope,source.lineage,text,{now:()=>clock});
    const identity={sourceId:source.lineage.sourceId,sourceEventId:source.lineage.sourceEventId,sourceRevision:1,stage:'facts' as const,semanticPolicyVersion:'controlled-public-v1'};
    const fact={_id:'',factId:`public-bound-fact-${i}`,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,ownerPrincipalId:scope.principalId,
      lineage:source.lineage,extractionPolicyVersion:'controlled-public-v1',fact:text,factType:'preference' as const,confidence:90,sourceType:'manual' as const,tags:[],version:1,createdAt:clock,updatedAt:clock};
    await writer.commitDerived({source:identity,identity,chunks:prepared.chunks,facts:[fact],expectedFactVersions:{[fact.factId]:0},
      ...(withVectors?{vectors:[{...identity,vectorId:`public-vector-${i}`,chunkId:prepared.chunks[0]!.chunkId,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,
        profile,embedding:Array.from({length:1536},(_,j)=>j===0?1:0),processingReceiptId:await processingIdentityKey(identity)}]}:{})});
  }
  if(withVectors)f.action.vectorSearch=(async()=>f.db.table('runtimeMemoryVectors').map(row=>({_id:row._id as Id<'runtimeMemoryVectors'>,_score:0.9}))) as ActionCtx['vectorSearch'];
  return f;
}
it('actual populated public API shares bounded evidence traversal and retains independent governed delivery',async()=>{
  const f=await populatedPublicFixture(false,true);f.rpc.length=0;
  const actual=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
  const optimized=[...f.rpc];expect(actual).toHaveProperty('items');expect((actual as {items:unknown[]}).items).toHaveLength(6);expect(calls).toBe(1);
  expect(optimized.filter(name=>name==='runtimeMemory:readFacts')).toHaveLength(0);
  expect(optimized.filter(name=>name==='runtimeMemoryQuery:prepareReads')).toHaveLength(1);
  expect(optimized.filter(name=>name==='runtimeMemoryQuery:readMatches')).toHaveLength(1);
  expect(optimized.filter(name=>name==='runtimeMemoryQuery:finalRecallDelivery')).toHaveLength(1);
  expect(optimized.filter(name=>name==='runtimeMemory:readSource')).toHaveLength(0);f.rpc.length=0;
  const expected=await recallMemory({repository:f.repository,model:createGatewayMemoryModel(f.action,f.repository,{runBudgetId:f.args.runBudgetId}),clock:{now:()=>clock}},f.input);
  expect(actual.items.filter(item=>item.type==="fact").map(({id,content,fact})=>({id,content,fact}))).toEqual(expected.items.map(({id,content,fact})=>({id,content,fact})));expect(actual.memoryEffort).toMatchObject({requestedEffort:"normal",maxDepth:4,selected:6});expect(calls).toBe(1); // Attached operation replays without another provider dispatch.
  expect(f.rpc.filter(name=>name==='runtimeMemory:readSource')).toHaveLength(3);
  expect(f.db.table('runtimeModelAttempts')).toHaveLength(1);
  console.info(JSON.stringify({type:'k27-public-fact-rpc-count',facts:3,baselineFactAndSourceRPCs:4,optimizedFactAndSourceRPCs:1,providerCalls:1,retries:0,nativeLatency:'UNAVAILABLE'}));
});
it("Fast public recall retains eligible context when governed embedding took longer than its separate retrieval-stage allowance",async()=>{
 const f=await populatedPublicFixture(false,true,"fast");embeddingAdvanceMs=1000;
 const actual=await invoke(memory.recall,f.action as never,{...f.input,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(actual.items.length).toBeGreaterThan(0);expect(actual.memoryEffort).toMatchObject({requestedEffort:"fast",maxDepth:2});expect(actual.memoryEffort!.stopReasons).not.toContain("deadline");expect(calls).toBe(1);
});
it.each(['revocation','source-revision','source-tombstone'])('bound fact read preserves the original late %s denial and no partial output',async fault=>{
  const results:unknown[]=[];
  for(const bound of [false,true]) {
    const f=await populatedPublicFixture(),list=ConvexMemoryRepository.prototype.listFacts;
    let fired=0;
    const spy=jest.spyOn(ConvexMemoryRepository.prototype,'listFacts').mockImplementation(async function(this:InstanceType<typeof ConvexMemoryRepository>,...args){
      const facts=await list.apply(this,args);
      if(++fired===1) {
        if(fault==='revocation')f.grant.revokedAt=clock;
        if(fault==='source-revision')(f.db.table('runtimeMemorySources')[0].lineage as {sourceRevision:number}).sourceRevision++;
        if(fault==='source-tombstone')f.db.table('runtimeMemorySources')[0].tombstonedAt=clock;
      }
      return facts;
    });
    const writes=f.db.writes;
    try {
      const repository=createActionMemoryRepository(f.action,f.reference,'read',bound?{boundRecallFacts:true}:undefined);
      await repository.listFacts({limit:10});throw Error('EXPECTED_REFUSAL');
    } catch(error){if(!(error instanceof ConvexError))throw error;results.push(error.data);}
    finally{spy.mockRestore();}
    expect(fired).toBe(1);expect(f.db.writes).toBe(writes);expect(calls).toBe(0);
  }
  expect(results[1]).toEqual(results[0]);expect(results[1]).toHaveProperty('code',fault==='source-revision'?'STALE_SOURCE':'FORBIDDEN');
});

it('K28 public native read parents are internal and preserve the Action ranking/final-delivery boundary',async()=>{
  for(const registration of [query.prepareReads,query.readMatches,query.finalRecallDelivery]) {
    expect(registration.isInternal).toBe(true);expect(Reflect.get(registration,'isPublic')).not.toBe(true);
  }
  const f=await populatedPublicFixture(true),{finishRecallFromEmbedding}=await import('../../../convex-dev/runtimeMemoryServices');
  const result={profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]};
  f.rpc.length=0;
  const expected=await finishRecallFromEmbedding({repository:createActionMemoryRepository(f.action,f.reference,'read',{boundRecallFacts:true}),clock:{now:()=>clock}},f.input,{profile,runBudgetId:f.args.runBudgetId},result);
  const oldCalls=[...f.rpc],before=f.state();f.rpc.length=0;
  const actual=await query.finishPublicRecall(f.action,{...f.args,profile},result,{now:()=>clock});
  expect(actual).toEqual(expected);expect(f.state()).toEqual(before);expect(calls).toBe(0);
  expect(f.rpc).toEqual(['runtimeMemoryQuery:prepareReads','runtimeMemoryQuery:readMatches','runtimeMemoryQuery:finalRecallDelivery']);
  expect(oldCalls.filter(name=>name.startsWith('runtimeMemory:'))).toHaveLength(6);
  expect(oldCalls.filter(name=>name==='runtimeModelPolicy:embeddingProfile')).toHaveLength(3);
  console.info(JSON.stringify({type:'k28-controlled-public-read-handoffs',oldCalls,newCalls:f.rpc,items:actual.items.length,nativeLatency:'UNAVAILABLE'}));
});
it.each(['source-hash','source-tombstone','fact-version','grant','profile'])('K28 fresh independent public delivery retains late %s refusal',async fault=>{
  const outcomes:unknown[]=[];
  for(const composed of [false,true]) {
    const f=await populatedPublicFixture(true),oldMutation=f.action.runMutation.bind(f.action);
    f.action.runMutation=(async(ref,args)=>{
      const name=getFunctionName(ref);
      if(name==='runtimeMemory:finalDelivery'||name==='runtimeMemoryQuery:finalRecallDelivery') {
        if(fault==='source-hash')f.db.table('runtimeMemorySources')[0].contentHash='f'.repeat(64);
        if(fault==='source-tombstone')f.db.table('runtimeMemorySources')[0].tombstonedAt=clock;
        if(fault==='fact-version')f.db.table('facts')[0].version=2;
        if(fault==='grant')f.grant.revokedAt=clock;
        if(fault==='profile')f.db.table('runtimeModelPolicies')[0].active=false;
      }
      return await oldMutation(ref,args);
    }) as ActionCtx['runMutation'];
    const result={profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]},writes=f.db.writes;
    try {
      if(composed)await query.finishPublicRecall(f.action,{...f.args,profile},result,{now:()=>clock});
      else {const {finishRecallFromEmbedding}=await import('../../../convex-dev/runtimeMemoryServices');await finishRecallFromEmbedding({repository:createActionMemoryRepository(f.action,f.reference,'read',{boundRecallFacts:true}),clock:{now:()=>clock}},f.input,{profile,runBudgetId:f.args.runBudgetId},result);}
      throw Error('EXPECTED_REFUSAL');
    }catch(error){if(!(error instanceof ConvexError))throw error;outcomes.push(error.data);}
    expect(f.db.writes).toBe(writes);expect(calls).toBe(0);
  }
  expect(outcomes[1]).toEqual(outcomes[0]);
});
it.each(['revocation','expiry','foreign','limit','hits'])('K28 new public read handlers reject %s without effects',async fault=>{
  const f=await populatedPublicFixture(true),args={...f.args,profile,input:{...f.input},hits:[] as {id:never;score:number}[]};
  if(fault==='revocation')f.grant.revokedAt=clock;if(fault==='expiry')f.grant.expiresAt=clock;
  if(fault==='foreign')args.reference={...args.reference,principalId:'foreign'};
  if(fault==='limit')args.input.limit=101;if(fault==='hits')args.hits=Array.from({length:101},()=>({id:'runtimeMemoryVectors:missing' as never,score:1}));
  const before=f.state();await expect(f.call(query.readMatches,args)).rejects.toBeInstanceOf(ConvexError);
  expect(f.state()).toEqual(before);expect(calls).toBe(0);
});
it('K28 unknown ranking failure precedes final native delivery and never changes its error identity',async()=>{
  const f=await populatedPublicFixture(true),failure=Symbol('ranking-clock'),result={profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]};f.rpc.length=0;
  await expect(query.finishPublicRecall(f.action,{...f.args,profile},result,{now:()=>{throw failure;}})).rejects.toBe(failure);
  expect(f.rpc).not.toContain('runtimeMemoryQuery:finalRecallDelivery');expect(calls).toBe(0);
});
it('K28 native final delivery retains Action elapsed-expiry refusal',async()=>{
  const f=await populatedPublicFixture(true);f.grant.expiresAt=clock+1;const result={profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]};
  await expect(query.finishPublicRecall(f.action,{...f.args,profile},result,{now:()=>clock+2})).rejects.toMatchObject({data:{code:'FORBIDDEN'}});
  expect(f.rpc.filter(name=>name==='runtimeMemoryQuery:finalRecallDelivery')).toHaveLength(1);expect(calls).toBe(0);
});
it('K28 composed native staged branches join both peers and preserve the exact opaque vector-first failure',async()=>{
  const f=await populatedPublicFixture(true),failure=Symbol('vector-first'),factFailure=Symbol('fact-second'),writes=f.db.writes;let factsRead=0;
  let finishVector!:()=>void;const factEntered=new Promise<void>(resolve=>{finishVector=resolve;});
  jest.spyOn(ConvexMemoryRepository.prototype,'hydrateVectors').mockImplementation(async()=>{await factEntered;throw failure;});
  jest.spyOn(ConvexMemoryRepository.prototype,'listFacts').mockImplementation(async()=>{factsRead++;finishVector();throw factFailure;});
  await expect(f.call(query.readMatches,{...f.args,profile,hits:[]})).rejects.toBe(failure);
  expect(factsRead).toBe(1);expect(f.db.writes).toBe(writes);expect(calls).toBe(0);
});


type PublicRead={method:string;table:string;id?:string;index?:string;keys:unknown[];terminal?:string;documents:number;managed:boolean};
function publicReadLog(f:Awaited<ReturnType<typeof fixture>>){
 const get=f.db.get.bind(f.db),queryPort=f.db.query.bind(f.db),reads:PublicRead[]=[];
 jest.spyOn(f.db,'get').mockImplementation(async(table,id)=>{const row=await get(table,id);reads.push({method:'get',table,id,keys:[],documents:row?1:0,managed:false});return row;});
 jest.spyOn(f.db,'query').mockImplementation(table=>{
  const record:PublicRead={method:'query',table,keys:[],documents:0,managed:/readManaged(?:SourceRows|ConversationRows|TranscriptBridgeRows|SourceRunRows)/.test(new Error().stack??'')};
  reads.push(record);const builder=queryPort(table),indexPort=builder.withIndex.bind(builder),take=builder.take.bind(builder),unique=builder.unique.bind(builder);
  builder.withIndex=(index,callback)=>{record.index=index;return indexPort(index,q=>{
   if(q===null||typeof q!=='object')throw Error('Expected original index builder');
   const traced:object=new Proxy(q,{get(target,key){const value:unknown=Reflect.get(target,key,target);if(typeof value!=='function')return value;
    return(...args:unknown[])=>{record.keys.push([String(key),...args]);const result:unknown=Reflect.apply(value,target,args);return result===target?traced:result;};}});return callback(traced);
  });};
  builder.take=async n=>{record.terminal=`take:${n}`;const rows=await take(n);record.documents=rows.length;return rows;};
  builder.unique=async()=>{record.terminal='unique';const row=await unique();record.documents=row?1:0;return row;};return builder;
 });
 return{reads,clear:()=>{reads.length=0;}};
}
const publicReadIdentity=({method,table,id,index,keys,terminal}:PublicRead)=>({method,table,id,index,keys,terminal});
const publicMutableReads=(reads:PublicRead[])=>reads.filter(row=>!row.managed&&!row.table.startsWith('runtimeAuth')&&!['runtimeModelPolicies','runtimeModelQualifications','runtimeAgentDefinitions'].includes(row.table)).map(publicReadIdentity);
it('K29 actual public read pipeline matches a773 result/readset/state while sharing exact-owner raw rows',async()=>{
 const f=await populatedPublicFixture(true),observed=publicReadLog(f),result={profile,vectors:[Array.from({length:1536},(_,i)=>i===0?1:0)]};
 const before=f.state();nativeSnapshotReads=false;f.rpc.length=0;
 const expected=await query.finishPublicRecall(f.action,{...f.args,profile},result,{now:()=>clock});
 const baseline=clone(observed.reads),oldCalls=[...f.rpc];observed.clear();nativeSnapshotReads=true;f.rpc.length=0;
 const actual=await query.finishPublicRecall(f.action,{...f.args,profile},result,{now:()=>clock}),reads=clone(observed.reads);
 expect(actual).toEqual(expected);expect(actual.items).toHaveLength(6);expect(f.state()).toEqual(before);expect(calls).toBe(0);expect(f.rpc).toEqual(oldCalls);
 expect(publicMutableReads(reads)).toEqual(publicMutableReads(baseline));
 const identities=(values:PublicRead[])=>[...new Set(values.map(row=>JSON.stringify(publicReadIdentity(row))))].sort();
 expect(identities(reads)).toEqual(identities(baseline));expect(reads.length).toBeLessThan(baseline.length);
 expect(f.rpc).toEqual(['runtimeMemoryQuery:prepareReads','runtimeMemoryQuery:readMatches','runtimeMemoryQuery:finalRecallDelivery']);
 const count=(values:PublicRead[])=>({calls:values.length,documents:values.reduce((n,row)=>n+row.documents,0),authority:values.filter(row=>row.table.startsWith('runtimeAuth')).length});
 console.info(JSON.stringify({type:'k29-current-a773-public-read-pipeline',baseline:count(baseline),actual:count(reads),exactResultStateAndMutableReadOrder:true,providerCalls:0,nativeLatency:'NOT_RUN'}));
});
it.each(['revision','tombstone','revoked','expired','profile','foreign'])(
 'K29 actual public snapshot view preserves a773 %s result/refusal and no effects',async fault=>{
 const f=await populatedPublicFixture(true),hits=f.db.table('runtimeMemoryVectors').map(row=>({id:row._id as Id<'runtimeMemoryVectors'>,score:0.9}));
 if(fault==='revision')(f.db.table('runtimeMemorySources')[0].lineage as {sourceRevision:number}).sourceRevision++;
 if(fault==='tombstone')f.db.table('runtimeMemorySources')[0].tombstonedAt=clock;
 if(fault==='revoked')f.grant.revokedAt=clock;if(fault==='expired')f.grant.expiresAt=clock;
 const args={...f.args,reference:fault==='foreign'?{...f.reference,principalId:'foreign'}:f.reference,profile:fault==='profile'?{...profile,modelId:'wrong-model'}:profile,hits};
 const before=f.state(),outcome=async()=>{try{return{kind:'returned' as const,value:await f.call<Awaited<ReturnType<typeof query.readRecallMatchesHandler>>>(query.readMatches,args)};}
  catch(error){if(!(error instanceof Error))throw error;return{kind:'refused' as const,name:error.name,message:error.message,data:error instanceof ConvexError?error.data:undefined};}};
 nativeSnapshotReads=false;const expected=await outcome();nativeSnapshotReads=true;const actual=await outcome();expect(actual).toEqual(expected);
 if(fault==='revision'||fault==='tombstone'){expect(actual.kind).toBe('returned');if(actual.kind!=='returned')throw Error('Expected original stale-neighbor exclusion');
  expect(actual.value.vectorItems).toHaveLength(2);expect(actual.value.facts).toHaveLength(2);}
 else expect(actual.kind).toBe('refused');
 expect(f.state()).toEqual(before);expect(calls).toBe(0);
});

async function directPublicFixture(text="What is my favorite season?",count=1,corrected=false,maxEntries=10){
 const f=await fixture(true,"fast",text,maxEntries),writer=new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db);
 for(let i=0;i<count;i++){
  const source=await f.source(`My favorite season is ${i?"spring":"autumn"}`,`direct-public-${i}`),lineage=source.lineage;
  const fact={_id:"",factId:`direct-public-fact-${i}`,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,ownerPrincipalId:f.reference.principalId,lineage,extractionPolicyVersion:"direct-test-v1",fact:`User favorite season is ${i?"spring":"autumn"}`,subject:"user",predicate:"favorite season",object:i?"spring":"autumn",factType:"preference" as const,confidence:1,sourceType:"manual" as const,tags:[],version:1,createdAt:clock,updatedAt:clock,...(corrected?{supersedes:"older-version"}:{})};
  await writer.commitDerived({source:lineage,identity:{...lineage,stage:"facts",semanticPolicyVersion:"direct-test-v1"},facts:[fact],expectedFactVersions:{[fact.factId]:0}});
 }
 return f;
}
it("actual public recall delivers literal direct evidence and supporting depth2 source with no paid attempt",async()=>{
 const f=await directPublicFixture(),before=f.db.table("runtimeModelAttempts").length;
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({id:"direct-public-fact-0",content:"User favorite season is autumn",retrieval:expect.objectContaining({depth:1})}),expect.objectContaining({type:"memory",retrieval:expect.objectContaining({depth:2})})]));
 expect(result.memoryEffort).toMatchObject({retrievalRoute:"direct-facts-v1",maxEntries:4,maxDepth:2});expect(calls).toBe(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(before);expect(f.rpc).not.toContain("runtimeMemoryQuery:admit");
});
async function projectedPublicFixture(maxEntries=4,sourceContent="My favorite fruit is apricot.",queryText="What is my favorite fruit?",unstructured?:"contradiction"|"canonical-mismatch",singleSearchHit=false){
 const f=await fixture(true,"fast",queryText,maxEntries),writer=new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db),source=await f.source(sourceContent,"projected-public"),lineage=source.lineage;
 const base={_id:"",tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,ownerPrincipalId:f.reference.principalId,lineage,extractionPolicyVersion:"observed-projection-v1",subject:"User",factType:"preference" as const,confidence:91,sourceType:"manual" as const,tags:[],version:1,createdAt:clock,updatedAt:clock};
 const facts=unstructured?["apricot",unstructured==="contradiction"?"pear":"apricot"].map((value,index)=>({...base,factId:`unstructured-public-${index}`,fact:`My favorite fruit is ${value}.`,subject:undefined}))
 :[{...base,factId:"projected-exact",fact:"User's favorite fruit is apricot.",predicate:"is_favorite_fruit",object:"apricot"},
  {...base,factId:"projected-likes",fact:singleSearchHit?"User likes apricot.":"User likes fruit.",predicate:"likes",object:singleSearchHit?"apricot":"fruit"},
  ...(singleSearchHit?[]:[{...base,factId:"projected-general",fact:"User stated a specific preference for a type of fruit.",predicate:"has_a_preference_for",object:"apricot"}])];
 await writer.commitDerived({source:lineage,identity:{...lineage,stage:"facts",semanticPolicyVersion:base.extractionPolicyVersion},facts,expectedFactVersions:Object.fromEntries(facts.map(fact=>[fact.factId,0]))});
 // This DB fixture's substring search treats the terminal '?' as part of a
 // token. The actual hosted index returned all three fruit projections. Keep
 // repository/currentness/source code real; correct only this native port's
 // terminal-punctuation tokenization for the observed fixture.
 const nativeQuery=f.db.query.bind(f.db);jest.spyOn(f.db,"query").mockImplementation(table=>{
  const builder=nativeQuery(table);if(table!=="facts")return builder;const nativeSearch=builder.withSearchIndex.bind(builder);
  builder.withSearchIndex=(index,callback)=>nativeSearch(index,q=>{
   if(q===null||typeof q!=="object")throw Error("Expected native search port");
   return callback(new Proxy(q,{get(target,key){const method:unknown=Reflect.get(target,key,target);return key==="search"&&typeof method==="function"
    ?(field:string,text:string)=>Reflect.apply(method,target,[field,text.replace(/\?$/u,"")]):method;}}));
  });return builder;
 });return f;
}
it("public recall proves one search hit before real indexed adjacency discovers its compatible value projection",async()=>{
 const f=await projectedPublicFixture(4,undefined,undefined,undefined,true),repository=new ConvexMemoryRepository(f.ctx,f.reference,"read");
 const initial=await repository.searchFactCandidates(f.input.text,f.input.limit);expect(initial.facts.map(fact=>fact.factId)).toEqual(["projected-exact"]);expect(initial.candidateWorkBound).toBe(false);
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.items.filter(item=>item.type==="fact").map(item=>item.id).sort()).toEqual(["projected-exact","projected-likes"]);
 expect(result.items.find(item=>item.id==="projected-likes")?.retrieval).toMatchObject({depth:2,path:["fact:projected-exact","fact:projected-likes"]});
 expect(result.items.find(item=>item.type==="memory")?.content).toBe("My favorite fruit is apricot.");
 expect(result.memoryEffort).toMatchObject({retrievalRoute:"direct-facts-v1",maxDepth:2,maxEntries:4,entriesByKind:{fact:2,memory:1}});
 expect(calls).toBe(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);expect(f.rpc).not.toContain("runtimeMemoryQuery:admit");
});
it.each(["wrong-value","negation","unknown","history","missing-object","different-source","entries"])("public one-hit adjacency %s preserves governed fallback before dropping discovered evidence",async fault=>{
 const f=await projectedPublicFixture(fault==="entries"?1:4,undefined,undefined,undefined,true),row=f.db.table("facts").find(value=>value.factId==="projected-likes")!;
 if(fault==="wrong-value")Object.assign(row,{fact:"User likes pear.",object:"pear"});if(fault==="negation")row.fact="User does not like apricot.";
 if(fault==="unknown")row.fact="User enjoys apricot.";if(fault==="history")row.supersedes="older";if(fault==="missing-object")delete row.object;
 if(fault==="different-source"){const source=await f.source("User likes apricot.","other-one-hit-source");row.lineage=source.lineage;}
 await replaceFactEntityLinks(f.ctx.db,row as unknown as DerivedFact);
 const initial=await new ConvexMemoryRepository(f.ctx,f.reference,"read").searchFactCandidates(f.input.text,f.input.limit);expect(initial.facts.map(fact=>fact.factId)).toEqual(["projected-exact"]);
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");expect(calls).toBe(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
 if(fault==="entries"){expect(result.items).toHaveLength(1);expect(result.memoryEffort?.stopReasons).toContain("entries");}
 expect(f.rpc.indexOf("runtimeModelPolicy:captureTerminalEvidence")).toBeLessThan(f.rpc.indexOf("runtimeModelPolicy:attachTerminalResult"));
});
it.each(["revoke","expire-fact","edit-source","delete-source"])("public one-hit source proof retains the fresh final %s fence",async fault=>{
 const f=await projectedPublicFixture(4,undefined,undefined,undefined,true),original=ConvexMemoryRepository.prototype.checkDelivery;
 const delivery=jest.spyOn(ConvexMemoryRepository.prototype,"checkDelivery").mockImplementation(async function(this:InstanceType<typeof ConvexMemoryRepository>,bindings,authority){
  expect(bindings.facts.map(fact=>fact.factId).sort()).toEqual(["projected-exact","projected-likes"]);expect(bindings.sources.length).toBeGreaterThan(0);
  if(fault==="revoke")f.grant.revokedAt=clock;if(fault==="expire-fact")f.db.table("facts").find(value=>value.factId==="projected-likes")!.validUntil=clock;
  if(fault==="edit-source")f.db.table("runtimeMemorySources")[0]!.contentHash="f".repeat(64);
  if(fault==="delete-source")f.db.table("runtimeMemorySources")[0]!.tombstonedAt=clock;return original.call(this,bindings,authority);
 });
 await expect(invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId})).rejects.toThrow();
 expect(delivery).toHaveBeenCalledTimes(1);expect(calls).toBe(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("public recall proves the observed three current projections against their actual one-assertion source without query embedding",async()=>{
 const f=await projectedPublicFixture(),candidates=await new ConvexMemoryRepository(f.ctx,f.reference,"read").searchFactCandidates(f.input.text,f.input.limit);
 expect(candidates.facts).toHaveLength(3);expect(candidates.candidateWorkBound).toBe(false);
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.items.filter(item=>item.type==="fact").map(item=>item.id).sort()).toEqual(["projected-exact","projected-general","projected-likes"]);
 expect(result.items.find(item=>item.type==="memory")?.content).toBe("My favorite fruit is apricot.");expect(result.items).toHaveLength(4);
 expect(result.memoryEffort).toMatchObject({retrievalRoute:"direct-facts-v1",maxDepth:2,maxEntries:4,entriesByKind:{fact:3,memory:1}});
 expect(calls).toBe(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);expect(f.rpc).not.toContain("runtimeMemoryQuery:admit");
});
it.each(["contradiction","canonical-mismatch"] as const)("LSR-1 public unstructured %s refuses direct source proof and uses one original governed semantic call",async scenario=>{
 const f=await projectedPublicFixture(4,`My favorite fruit is ${scenario==="canonical-mismatch"?"pear":"apricot"}.`,undefined,scenario);
 const candidates=await new ConvexMemoryRepository(f.ctx,f.reference,"read").searchFactCandidates(f.input.text,f.input.limit);
 expect(candidates.facts).toHaveLength(2);expect(candidates.candidateWorkBound).toBe(false);
 expect(candidates.facts.every(fact=>fact.subject===undefined&&fact.predicate===undefined&&fact.object===undefined)).toBe(true);
 const getSource=jest.spyOn(ConvexMemoryRepository.prototype,"getSource");
 expect(await query.readDirectPublicRecallHandler(f.ctx,f.args)).toBeNull();expect(getSource).not.toHaveBeenCalled();getSource.mockRestore();
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");expect(result.items.filter(item=>item.type==="fact").map(item=>item.content).sort()).toEqual(candidates.facts.map(fact=>fact.fact).sort());
 expect(calls).toBe(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({slotReleased:true,resultAttachmentState:"attached"});
 expect(f.rpc.indexOf("runtimeModelPolicy:captureTerminalEvidence")).toBeLessThan(f.rpc.indexOf("runtimeModelPolicy:attachTerminalResult"));
});
it.each(["broad","work-bound","mixed-source","unknown"])("public prospective %s miss performs zero extra canonical-source get calls",async fault=>{
 const f=await projectedPublicFixture(4,undefined,fault==="broad"?"Tell me about fruit.":undefined),row=f.db.table("facts").find(value=>value.factId==="projected-likes")!;
 if(fault==="work-bound")for(let i=3;i<10;i++)f.db.seed("facts",{...row,_id:`literal-bound-${i}`,factId:`literal-bound-${i}`});
 if(fault==="mixed-source"){const source=await f.source("User likes fruit.","other-projection");row.lineage=source.lineage;}
 if(fault==="unknown")row.fact="User enjoys fruit.";
 const getSource=jest.spyOn(ConvexMemoryRepository.prototype,"getSource");
 expect(await query.readDirectPublicRecallHandler(f.ctx,f.args)).toBeNull();expect(getSource).not.toHaveBeenCalled();expect(calls).toBe(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["conflict","unknown","different-source","history","future","time-bound","source-compound","entries"])("public projected %s retains original governed semantic fallback",async fault=>{
 const f=await projectedPublicFixture(fault==="entries"?1:4,fault==="source-compound"?"My favorite fruit is apricot. Please acknowledge.":undefined),row=f.db.table("facts").find(value=>value.factId==="projected-likes")!;
 if(fault==="conflict")Object.assign(row,{fact:"User's favorite fruit is pear.",object:"pear",predicate:"is_favorite_fruit"});
 if(fault==="unknown")row.fact="User enjoys fruit.";if(fault==="history")row.supersedes="old";
 if(fault==="future")row.validFrom=clock+1;if(fault==="time-bound")row.validUntil=clock+1000;
 if(fault==="different-source"){const source=await f.source("User likes fruit.","unrelated-projection");row.lineage=source.lineage;}
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");expect(calls).toBe(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
it.each(["revoke","expire-fact","edit-source"])("public projected proof retains the fresh final %s fence and never pays for a refused direct result",async fault=>{
 const f=await projectedPublicFixture(),original=ConvexMemoryRepository.prototype.checkDelivery;
 const delivery=jest.spyOn(ConvexMemoryRepository.prototype,"checkDelivery").mockImplementation(async function(this:InstanceType<typeof ConvexMemoryRepository>,bindings,authority){
  expect(bindings.facts.map(fact=>fact.factId).sort()).toEqual(["projected-exact","projected-general","projected-likes"]);
  if(fault==="revoke")f.grant.revokedAt=clock;
  if(fault==="expire-fact")f.db.table("facts").find(value=>value.factId==="projected-general")!.validUntil=clock;
  if(fault==="edit-source")f.db.table("runtimeMemorySources")[0]!.contentHash="f".repeat(64);
  return original.call(this,bindings,authority);
 });
 await expect(invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId})).rejects.toThrow();
 expect(delivery).toHaveBeenCalledTimes(1);expect(calls).toBe(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["paraphrase","miss","generic","conflict","corrected"])("%s retains exactly one original governed semantic call and separate terminal commits",async scenario=>{
 const text=scenario==="paraphrase"?"Which season do I prefer?":scenario==="miss"?"What is my home address?":scenario==="generic"?"What is my favorite thing?":"What is my favorite season?";
 const f=await directPublicFixture(text,scenario==="conflict"?2:1,scenario==="corrected");
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");expect(calls).toBe(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
 expect(f.rpc.indexOf("runtimeModelPolicy:captureTerminalEvidence")).toBeLessThan(f.rpc.indexOf("runtimeModelPolicy:attachTerminalResult"));
 expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({slotReleased:true,resultAttachmentState:"attached"});
});
it("direct public discovery propagates revoked authority instead of falling back to a paid call",async()=>{
 const f=await directPublicFixture(),proposal=await prepared(f);f.grant.revokedAt=clock;
 await expect(query.recallPublicMemory(f.action,f.reference,f.repository,f.args.runBudgetId,f.input,proposal)).rejects.toThrow("FORBIDDEN");expect(calls).toBe(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});

it("a full raw fact page with stale candidates cannot skip the governed fallback",async()=>{
 const f=await directPublicFixture(),base=f.db.table("facts")[0]!;
 for(let i=1;i<f.input.limit;i++)f.db.seed("facts",{...base,_id:`stale-direct-${i}`,factId:`stale-direct-${i}`,tombstonedAt:clock});
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(calls).toBe(1);expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");expect(result.memoryEffort?.stopReasons).toContain("work");expect(result.memoryEffort?.unavailableStages).toContain("direct-fact-candidate-work-bound");
});
it("facts-only direct lookup skips unauthorized optional supporting text",async()=>{
 const f=await directPublicFixture(),getSource=ConvexMemoryRepository.prototype.getSource;
 jest.spyOn(ConvexMemoryRepository.prototype,"getSource").mockImplementation(async function(this:InstanceType<typeof ConvexMemoryRepository>,sourceId,permission,deadlines){if(permission!=="canViewFacts")throw new ConvexError({version:1,code:"FORBIDDEN",retryable:false,outcome:"not_dispatched"});return getSource.call(this,sourceId,permission,deadlines);});
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.items).toHaveLength(1);expect(result.items[0]!.type).toBe("fact");expect(result.memoryEffort?.retrievalRoute).toBe("direct-facts-v1");expect(calls).toBe(0);
});

it.each([1,4])("a conflicting current assertion discovered through an indexed entity edge forces semantic fallback at cap%i",async maxEntries=>{
 const f=await directPublicFixture(undefined,1,false,maxEntries),writer=new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db),source=await f.source("User prefers spring","edge-conflict"),lineage=source.lineage;
 const fact={_id:"",factId:"edge-conflict-fact",tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,ownerPrincipalId:f.reference.principalId,lineage,extractionPolicyVersion:"direct-test-v1",fact:"User prefers spring",subject:"user",predicate:"favorite season",object:"spring",factType:"preference" as const,confidence:99,sourceType:"manual" as const,tags:[],version:1,createdAt:clock,updatedAt:clock};
 await writer.commitDerived({source:lineage,identity:{...lineage,stage:"facts",semanticPolicyVersion:"direct-test-v1"},facts:[fact],expectedFactVersions:{[fact.factId]:0}});
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(calls).toBe(1);expect(result.memoryEffort?.retrievalRoute).toBe("semantic-v1");
 expect(result.memoryEffort?.maxEntries).toBe(maxEntries);expect(result.items.length).toBeLessThanOrEqual(maxEntries);
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({slotReleased:true,resultAttachmentState:"attached"});
 expect(f.rpc.indexOf("runtimeModelPolicy:captureTerminalEvidence")).toBeLessThan(f.rpc.indexOf("runtimeModelPolicy:attachTerminalResult"));
});

it('actual public Fast semantic recall prioritizes all conflicting exact-property facts over repeated-question vectors without changing caps or paid call count',async()=>{
 const f=await directPublicFixture('What is my favorite season?',2),writer=new ConvexMemoryRepository(f.ctx,f.reference,'write',f.ctx.db);
 const {prepareSourceContent,processingIdentityKey}=await import('../../../src/domain/sources'),{memoryScope}=await import('../../../convex-dev/runtimeMemoryRepository');
 for(let i=0;i<4;i++){
  const source=await f.source('What is my favorite season?',`repeated-question-${i}`),prepared=await prepareSourceContent(memoryScope(f.reference),source.lineage,source.content,{now:()=>clock}),identity={...source.lineage,stage:'vectors' as const,semanticPolicyVersion:profile.profileId};
  await writer.commitDerived({source:source.lineage,identity,chunks:prepared.chunks,vectors:[{...source.lineage,vectorId:`question-${i}`,chunkId:prepared.chunks[0]!.chunkId,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,profile,embedding:Array.from({length:1536},(_,j)=>j===0?1:0),processingReceiptId:await processingIdentityKey(identity)}]});
 }
 f.action.vectorSearch=(async()=>f.db.table('runtimeMemoryVectors').map(row=>({_id:row._id as Id<'runtimeMemoryVectors'>,_score:1.000000238418579}))) as ActionCtx['vectorSearch'];
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.items.filter(item=>item.type==='fact').map(item=>item.id).sort()).toEqual(['direct-public-fact-0','direct-public-fact-1']);
 expect(result.items).toHaveLength(4);expect(result.memoryEffort).toMatchObject({retrievalRoute:'semantic-v1',maxEntries:4,maxDepth:2});expect(result.memoryEffort!.stopReasons).toContain('entries');expect(calls).toBe(1);
 expect(f.db.table('runtimeModelAttempts')).toMatchObject([{attemptNumber:1,slotReleased:true,resultAttachmentState:'attached'}]);
});
it('actual public Fast retains an indexed depth2 literal conflict beyond a bounded native fact page',async()=>{
 const f=await directPublicFixture('What is my favorite season?',1),writer=new ConvexMemoryRepository(f.ctx,f.reference,'write',f.ctx.db);
 const {prepareSourceContent,processingIdentityKey}=await import('../../../src/domain/sources'),{memoryScope}=await import('../../../convex-dev/runtimeMemoryRepository');
 for(let i=0;i<9;i++){
  const source=await f.source(`This is independent knowledge ${i}`,`filler-${i}`),lineage=source.lineage,fact={_id:'',factId:`filler-${i}`,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,ownerPrincipalId:f.reference.principalId,lineage,extractionPolicyVersion:'test-v1',fact:source.content,subject:`Other${i}`,predicate:'is',object:`knowledge${i}`,factType:'knowledge' as const,confidence:99,sourceType:'manual' as const,tags:[],version:1,createdAt:clock,updatedAt:clock};
  await writer.commitDerived({source:lineage,identity:{...lineage,stage:'facts',semanticPolicyVersion:'test-v1'},facts:[fact],expectedFactVersions:{[fact.factId]:0}});
 }
 const conflictSource=await f.source('My favorite season is spring.','linked-spring'),lineage=conflictSource.lineage,conflict={_id:'',factId:'linked-spring',tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,ownerPrincipalId:f.reference.principalId,lineage,extractionPolicyVersion:'test-v1',fact:'User favorite season is spring',subject:'user',predicate:'favorite season',object:'spring',factType:'preference' as const,confidence:99,sourceType:'manual' as const,tags:[],version:1,createdAt:clock,updatedAt:clock};
 await writer.commitDerived({source:lineage,identity:{...lineage,stage:'facts',semanticPolicyVersion:'test-v1'},facts:[conflict],expectedFactVersions:{[conflict.factId]:0}});
 const initial=await new ConvexMemoryRepository(f.ctx,f.reference,'read').searchFactCandidates(f.input.text,f.input.limit);expect(initial.candidateWorkBound).toBe(true);expect(initial.facts.some(fact=>fact.factId==='linked-spring')).toBe(false);
 for(let i=0;i<4;i++){
  const source=await f.source('What is my favorite season?',`question-frontier-${i}`),prepared=await prepareSourceContent(memoryScope(f.reference),source.lineage,source.content,{now:()=>clock}),identity={...source.lineage,stage:'vectors' as const,semanticPolicyVersion:profile.profileId};
  await writer.commitDerived({source:source.lineage,identity,chunks:prepared.chunks,vectors:[{...source.lineage,vectorId:`question-frontier-${i}`,chunkId:prepared.chunks[0]!.chunkId,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!,profile,embedding:Array.from({length:1536},(_,j)=>j===0?1:0),processingReceiptId:await processingIdentityKey(identity)}]});
 }
 f.action.vectorSearch=(async()=>f.db.table('runtimeMemoryVectors').map(row=>({_id:row._id as Id<'runtimeMemoryVectors'>,_score:1.000000238418579}))) as ActionCtx['vectorSearch'];
 const result=await invoke(memory.recall,f.action as never,{...f.input,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId}) as Awaited<ReturnType<CompleteRecallDelivery>>;
 expect(result.items).toHaveLength(4);expect(result.items.filter(item=>item.type==='fact').map(item=>item.id).sort()).toEqual(['direct-public-fact-0','linked-spring']);expect(result.items.find(item=>item.id==='linked-spring')?.retrieval).toMatchObject({depth:2,path:['fact:direct-public-fact-0','fact:linked-spring']});
 expect(result.memoryEffort).toMatchObject({maxEntries:4,maxDepth:2,retrievalRoute:'semantic-v1'});expect(result.memoryEffort!.stopReasons).toContain('work');expect(result.memoryEffort!.stopReasons).toContain('entries');expect(calls).toBe(1);expect(f.db.table('runtimeModelAttempts')).toHaveLength(1);
});
