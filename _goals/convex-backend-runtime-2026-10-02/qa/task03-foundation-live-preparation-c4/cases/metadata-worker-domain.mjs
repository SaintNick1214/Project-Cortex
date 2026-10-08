/** Author-only current-service cases. Import/prepare does not dispatch or sign. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { authDenial } from '../scripts/native-engine.mjs';
export const manifest = JSON.parse(readFileSync(new URL('./metadata-worker-domain.json', import.meta.url)));
export const registeredPaths = manifest.registeredPaths;
const sha = text => createHash('sha256').update(text).digest('hex');
const envelope = error => {
  let data=error?.data;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch{return undefined;}}
  return data;
};
async function rejects(fn, expected = 'FORBIDDEN') {
  let result,error;try{result=await fn();}catch(caught){error=caught;}
  if(['FORBIDDEN','UNAUTHENTICATED'].includes(expected)){authDenial(result,error);return;}
  assert.equal(result,undefined);assert.ok(error,`Expected exact ${expected} envelope`);
  const messages={UNSUPPORTED_OPERATION:'Resource lifecycle is not supported by this maintenance adapter',CAPABILITY_UNAVAILABLE:'Memory capability unavailable.'};
  assert.ok(Object.hasOwn(messages,expected),'No source-backed exact expected envelope registered');
  assert.deepEqual(envelope(error),{version:1,code:expected,message:messages[expected],retryable:false,outcome:'not_dispatched'});
}
const scope = ctx => ({ tenantId: ctx.scopes.tenantId, memorySpaceId: ctx.scopes.memorySpaceId });
const named = (ctx, suffix) => `${ctx.run}:mwd:${suffix}`;
const track = (ctx, table, id) => { assert.equal(typeof id, 'string'); if (!ctx.refs.some(ref => ref.table === table && ref.id === id)) ctx.refs.push({table,id}); return id; };
async function rows(ctx, values) { return ctx.seed(values.map(([table, value]) => ({table,value}))); }
async function unchanged(ctx, fn) {
  const before=await ctx.snapshot();await fn();assert.deepEqual(await ctx.snapshot(),before);
  // Full dynamically discovered ledger detects newly created rows as well as changed known IDs.
}
async function record(ctx, table, id) { return (await ctx.snapshot([{table,id}]))[0].row; }
function owner(ctx, identity = 'reader') { return { ...scope(ctx), ownerPrincipalId: ctx.principals[identity] }; }
async function metadataRows(ctx, tag, identity = 'reader', ownerless = false) {
  const now = Date.now()-1000; const fields = owner(ctx, identity); if (ownerless) delete fields.ownerPrincipalId;
  const id = named(ctx, tag); const userId = ctx.users[identity];
  const specs = [
    ['immutable',{...fields,type:named(ctx,`type-${tag}`),id,data:{marker:id},version:2,previousVersions:[{version:1,data:{marker:`old-${id}`},timestamp:now-1}],createdAt:now-1,updatedAt:now}],
    ['mutable',{...fields,namespace:named(ctx,`ns-${tag}`),key:id,value:10,createdAt:now,updatedAt:now}],
    ['sessions',{...fields,sessionId:id,userId,authorityReference:ctx.references[identity],status:'active',startedAt:now,lastActiveAt:now,messageCount:0,memoryCount:0}],
  ]; const refs = await rows(ctx,specs); return {specs,refs,immutable:{...scope(ctx),type:specs[0][1].type,id},mutable:{...scope(ctx),namespace:specs[1][1].namespace,key:id},sessions:{...scope(ctx),sessionId:id}};
}
// Deletion APIs generate retained control rows. Require ownership-safe discovery BEFORE mutation.
function requireCapture(ctx) {
  if (typeof ctx.captureOwnedEffects !== 'function') throw Object.assign(new Error('BLOCKED_OWNED_GENERATED_ID_CAPTURE: bounded exact-ID tombstone/log/receipt capture required'),{code:'BLOCKED_OWNED_GENERATED_ID_CAPTURE'});
}
async function captured(ctx, fn) { requireCapture(ctx); const result = await fn(); await ctx.captureOwnedEffects(); return result; }
function suite(id, paths, run, requires = []) { return {id,paths,effects:'tracked',requires,expected:'asserted current service outcome; NOT_RUN until executor observes result',run}; }

async function metadataPositive(ctx) {
  const m = await metadataRows(ctx,'positive'); const call = (path,args) => ctx.call('reader',path,args);
  const im = await call('immutable:get',m.immutable); assert.equal(im.data.marker,m.immutable.id);
  assert.equal((await call('immutable:getVersion',{...m.immutable,version:1})).data.marker,`old-${m.immutable.id}`);
  assert.equal((await call('immutable:getHistory',m.immutable)).length,2);
  assert.equal((await call('immutable:getAtTimestamp',{...m.immutable,timestamp:im.updatedAt})).version,2);
  const list = await call('immutable:list',{...scope(ctx),type:m.immutable.type}); assert.equal(list.total,1); assert.equal(list.entries[0]._id,m.refs[0].id);
  assert.equal(await call('immutable:count',{...scope(ctx),type:m.immutable.type}),1);
  assert.equal((await call('immutable:search',{...scope(ctx),type:m.immutable.type,query:m.immutable.id}))[0].entry._id,m.refs[0].id);
  const updated = await call('immutable:store',{...m.immutable,data:{marker:'revision3'}}); assert.equal(updated.version,3); assert.equal(updated._id,m.refs[0].id);
  assert.deepEqual(await call('immutable:purgeVersions',{...m.immutable,keepLatest:1}),{versionsPurged:2,versionsRemaining:1});
  assert.equal((await call('immutable:getHistory',m.immutable)).length,1);
  assert.equal((await call('mutable:get',m.mutable)).value,10); assert.equal(await call('mutable:exists',m.mutable),true);
  assert.equal((await call('mutable:set',{...m.mutable,value:11})).value,11);
  assert.equal((await call('mutable:update',{...m.mutable,operation:'increment',operand:2})).value,13);
  assert.equal((await call('mutable:list',{...scope(ctx),namespace:m.mutable.namespace}))[0]._id,m.refs[1].id);
  assert.equal(await call('mutable:count',{...scope(ctx),namespace:m.mutable.namespace}),1);
  const tx = await call('mutable:transaction',{...scope(ctx),operations:[{op:'increment',namespace:m.mutable.namespace,key:m.mutable.key,amount:2}]}); assert.equal(tx.success,true); assert.equal(tx.operationsExecuted,1); assert.equal((await call('mutable:get',m.mutable)).value,15);
  const dry = await call('mutable:purgeNamespace',{...scope(ctx),namespace:m.mutable.namespace,dryRun:true}); assert.equal(dry.deleted,1); assert.equal((await record(ctx,'mutable',m.refs[1].id)).tombstonedAt,undefined);
  const session = await call('sessions:get',m.sessions); assert.equal(session.messageCount,0); assert.equal('authorityReference' in session,false);
  await call('sessions:touch',m.sessions); assert.ok((await record(ctx,'sessions',m.refs[2].id)).lastActiveAt >= session.lastActiveAt);
  assert.ok((await call('sessions:list',scope(ctx))).some(item=>item._id===m.refs[2].id)); assert.ok(await call('sessions:count',scope(ctx))>=1);
  await call('sessions:end',m.sessions); assert.equal((await call('sessions:get',m.sessions)).status,'ended');
  const sid=named(ctx,'created-session'); const created=await call('sessions:create',{...scope(ctx),sessionId:sid,userId:ctx.users.reader,startedAt:Date.now(),metadata:{marker:sid}});track(ctx,'sessions',created._id);
  assert.equal(created.sessionId,sid); assert.equal('authorityReference' in created,false);
  const all=await call('sessions:endAll',{...scope(ctx),userId:ctx.users.reader}); assert.ok(all.ended>=1);assert.equal((await call('sessions:get',{...scope(ctx),sessionId:sid})).status,'ended');
  const now=Date.now()-1000;const [profileRef]=await rows(ctx,[['immutable',{...owner(ctx),type:'user',id:ctx.users.reader,data:{marker:'profile',admin:true},version:1,previousVersions:[],createdAt:now,updatedAt:now}]]);
  const userArgs={...scope(ctx),userId:ctx.users.reader};assert.equal((await call('users:get',userArgs)).data.marker,'profile');
  assert.equal(await call('users:exists',userArgs),true);assert.equal((await call('users:getVersion',{...userArgs,version:1})).version,1);assert.equal((await call('users:getHistory',userArgs)).length,1);assert.equal((await call('users:getAtTimestamp',{...userArgs,timestamp:now})).version,1);assert.ok((await call('users:list',scope(ctx))).some(row=>row.id===ctx.users.reader));assert.ok(await call('users:count',scope(ctx))>=1);
  // Metadata claiming admin creates no trusted grant and admin-only grant creates no data privilege.
  await unchanged(ctx,()=>rejects(()=>ctx.call('admin','immutable:get',m.immutable)));
  assert.equal((await record(ctx,'immutable',profileRef.id)).ownerPrincipalId,ctx.principals.reader);
  await ctx.cleanup([profileRef]); // Canonical user key is reused by the independent deletion suite.
}

async function metadataPrivate(ctx) {
  for(const [tag,identity,ownerless] of [['other-owner','writer',false],['ownerless','reader',true]]) {
    const m=await metadataRows(ctx,tag,identity,ownerless);
    for(const [path,args] of [['immutable:get',m.immutable],['immutable:getHistory',m.immutable],['immutable:store',{...m.immutable,data:{marker:'attacker'}}],['immutable:purge',m.immutable],['mutable:get',m.mutable],['mutable:set',{...m.mutable,value:99}],['mutable:update',{...m.mutable,operation:'increment',operand:1}],['mutable:deleteKey',m.mutable],['sessions:get',m.sessions],['sessions:touch',m.sessions],['sessions:end',m.sessions]]) await unchanged(ctx,()=>rejects(()=>ctx.call('reader',path,args)));
    assert.equal(await ctx.call('reader','immutable:count',{...scope(ctx),type:m.immutable.type}),0);
    assert.equal(await ctx.call('reader','mutable:count',{...scope(ctx),namespace:m.mutable.namespace}),0);
    assert.ok(!(await ctx.call('reader','sessions:list',scope(ctx))).some(row=>row._id===m.refs[2].id));
  }
  for (const ownerless of [false,true]) {
    const now=Date.now(); const fields=owner(ctx,'writer'); if(ownerless)delete fields.ownerPrincipalId;
    const [profile]=await rows(ctx,[['immutable',{...fields,type:'user',id:ctx.users.reader,data:{marker:named(ctx,'private-profile')},version:1,previousVersions:[],createdAt:now,updatedAt:now}]]);
    for(const path of ['users:get','users:getHistory','users:exists','users:deleteUserProfile']) await unchanged(ctx,()=>rejects(()=>ctx.call('reader',path,{...scope(ctx),userId:ctx.users.reader})));
    await ctx.cleanup([profile]);
  }
  const tombstoned=await metadataRows(ctx,'retained-source-controls');
  await rows(ctx,[['runtimeAuthTombstones',{...scope(ctx),resourceType:'source',resourceId:`immutable:${JSON.stringify([tombstoned.immutable.type,tombstoned.immutable.id])}`,deletedAt:Date.now()}],['runtimeAuthTombstones',{...scope(ctx),resourceType:'source',resourceId:`mutable:${JSON.stringify([tombstoned.mutable.namespace,tombstoned.mutable.key])}`,deletedAt:Date.now()}],['runtimeAuthTombstones',{...scope(ctx),resourceType:'source',resourceId:`session:${JSON.stringify([tombstoned.sessions.sessionId])}`,deletedAt:Date.now()}]]);
  for(const [path,args] of [['immutable:get',tombstoned.immutable],['immutable:store',{...tombstoned.immutable,data:{marker:'resurrection'}}],['mutable:get',tombstoned.mutable],['mutable:set',{...tombstoned.mutable,value:1}],['sessions:get',tombstoned.sessions],['sessions:touch',tombstoned.sessions]]) await unchanged(ctx,()=>rejects(()=>ctx.call('reader',path,args)));
  const m=await metadataRows(ctx,'foreign-query-control');
  await unchanged(ctx,()=>rejects(()=>ctx.call('foreign','immutable:get',m.immutable)));
  // Legitimate writer-only owner gets a receipt; absence of READ must not hydrate stored value.
  const args={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.writerMemorySpaceId,namespace:named(ctx,'write-only'),key:named(ctx,'write-only-key'),value:{secret:named(ctx,'private-value')}};
  const receipt=await ctx.call('writer','mutable:set',args);track(ctx,'mutable',receipt.createdId);assert.equal(receipt.updated,true);assert.equal('value' in receipt,false);assert.equal('data' in receipt,false);
  await unchanged(ctx,()=>rejects(()=>ctx.call('writer','mutable:get',{tenantId:args.tenantId,memorySpaceId:args.memorySpaceId,namespace:args.namespace,key:args.key})));
}

async function metadataDeletion(ctx) {
  requireCapture(ctx); // Avoid partial mutation when safe cleanup is unavailable.
  const m=await metadataRows(ctx,'deletion');
  for(const [path,args,table,index] of [['immutable:purge',m.immutable,'immutable',0],['mutable:deleteKey',m.mutable,'mutable',1]]) {
    const result=await captured(ctx,()=>ctx.call('reader',path,args));assert.equal(result.deleted,true);assert.ok((await record(ctx,table,m.refs[index].id)).tombstonedAt);
  }
  await unchanged(ctx,()=>rejects(()=>ctx.call('reader','immutable:store',{...m.immutable,data:{marker:'resurrection'}})));
  await unchanged(ctx,()=>rejects(()=>ctx.call('reader','mutable:set',{...m.mutable,value:1})));
  for(const [tag,path] of [['bulk-im','immutable:purgeMany'],['bulk-mu','mutable:purgeMany'],['namespace','mutable:purgeNamespace']]) {
    const own=await metadataRows(ctx,tag);const args=path.startsWith('immutable')?{...scope(ctx),type:own.immutable.type}:{...scope(ctx),namespace:own.mutable.namespace};
    assert.equal((await captured(ctx,()=>ctx.call('reader',path,args))).deleted,1);
  }
  const now=Date.now();const [ref]=await rows(ctx,[['immutable',{...owner(ctx),type:'user',id:ctx.users.reader,data:{marker:'delete-profile'},version:1,previousVersions:[],createdAt:now,updatedAt:now}]]);
  assert.equal((await captured(ctx,()=>ctx.call('reader','users:deleteUserProfile',{...scope(ctx),userId:ctx.users.reader}))).deleted,true);assert.ok((await record(ctx,'immutable',ref.id)).tombstonedAt);
}

async function internalActor(ctx, tag, capabilities=['read','write','tool']) {
  const now=Date.now();const [p]=await rows(ctx,[['runtimeAuthPrincipals',{issuer:ctx.issuer,subject:named(ctx,`${tag}-subject`),actorKind:'service',metadataUserId:named(ctx,`${tag}-user`),version:1,createdAt:now}]]);
  const [m]=await rows(ctx,[['runtimeAuthMemberships',{principalId:p.id,tenantId:ctx.scopes.tenantId,version:1,createdAt:now}]]);
  const [g]=await rows(ctx,[['runtimeAuthGrants',{principalId:p.id,membershipId:m.id,...scope(ctx),tenantEpoch:ctx.references.reader.tenantEpoch,memorySpaceEpoch:ctx.references.reader.memorySpaceEpoch,capabilities,resourceAccess:'own',version:1,createdAt:now}]]);
  return {reference:{principalId:p.id,principalVersion:1,membershipId:m.id,membershipVersion:1,grantId:g.id,grantVersion:1,...scope(ctx),tenantEpoch:ctx.references.reader.tenantEpoch,memorySpaceEpoch:ctx.references.reader.memorySpaceEpoch},userId:named(ctx,`${tag}-user`),refs:[p,m,g]};
}
async function background(ctx) {
  const a=await internalActor(ctx,'session-worker');const now=Date.now()-5000;const sessionId=named(ctx,'background');const [ref]=await rows(ctx,[['sessions',{...scope(ctx),ownerPrincipalId:a.reference.principalId,userId:a.userId,authorityReference:a.reference,sessionId,status:'active',startedAt:now,lastActiveAt:now,messageCount:0,memoryCount:0}]]);
  for(const [path,field] of [['sessions:incrementMessageCount','messageCount'],['sessions:incrementMemoryCount','memoryCount']]) {await ctx.operator(path,{reference:a.reference,sessionId});assert.equal((await record(ctx,'sessions',ref.id))[field],1);}
  await unchanged(ctx,()=>rejects(()=>ctx.operator('sessions:incrementMessageCount',{reference:ctx.references.reader,sessionId})));
  await ctx.operator('runtimeAuth:revokeGrant',{grantId:a.reference.grantId});
  for(const path of ['sessions:incrementMessageCount','sessions:incrementMemoryCount']) await unchanged(ctx,()=>rejects(()=>ctx.operator(path,{reference:a.reference,sessionId})));
  await unchanged(ctx,()=>rejects(()=>ctx.operator('sessions:expireIdle',{reference:a.reference,idleTimeout:0})));
  const b=await internalActor(ctx,'expire-worker');const [ref2]=await rows(ctx,[['sessions',{...scope(ctx),ownerPrincipalId:b.reference.principalId,userId:b.userId,authorityReference:b.reference,sessionId:named(ctx,'expire'),status:'active',startedAt:now,lastActiveAt:now,messageCount:0,memoryCount:0}]]);
  assert.equal((await ctx.operator('sessions:expireIdle',{reference:b.reference,idleTimeout:1})).expired,1);assert.equal((await record(ctx,'sessions',ref2.id)).status,'ended');
  await ctx.operator('runtimeAuth:deletePrincipal',{principalId:b.reference.principalId});await unchanged(ctx,()=>rejects(()=>ctx.operator('sessions:incrementMemoryCount',{reference:b.reference,sessionId:named(ctx,'expire')})));
}

async function governance(ctx) {
  const scoped={organizationId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId};
  const args={tenantId:ctx.scopes.tenantId,scope:scoped};
  const template=await ctx.call('reader','governance:getTemplate',{...args,template:'GDPR'});assert.equal(template.organizationId,ctx.scopes.tenantId);assert.equal(template.memorySpaceId,ctx.scopes.memorySpaceId);
  const result=await ctx.call('reader','governance:setPolicy',{tenantId:ctx.scopes.tenantId,policy:template});track(ctx,'governancePolicies',result.policyId);assert.equal(result.success,true);
  assert.deepEqual(await ctx.call('reader','governance:getPolicy',args),template);
  for(const identity of ['foreign']) await unchanged(ctx,()=>rejects(()=>ctx.call(identity,'governance:getPolicy',args)));
  const simulation=await ctx.call('reader','governance:simulate',{tenantId:ctx.scopes.tenantId,options:scoped});assert.equal(simulation.status,'RETENTION_EXECUTION_NOT_IMPLEMENTED');assert.equal(simulation.simulation,true);assert.equal(simulation.estimated,false);
  const override=await ctx.call('reader','governance:setAgentOverride',{...scope(ctx),overrides:{}});track(ctx,'governancePolicies',override.policyId);assert.equal((await record(ctx,'governancePolicies',result.policyId)).isActive,false);
  requireCapture(ctx);const enforced=await captured(ctx,()=>ctx.operator('governance:enforce',{policyId:override.policyId}));assert.equal(enforced.simulation,true);assert.equal(enforced.recordsPurged,0);assert.equal(enforced.status,'RETENTION_EXECUTION_NOT_IMPLEMENTED');
  const report=await ctx.call('reader','governance:getComplianceReport',{tenantId:ctx.scopes.tenantId,options:{...scoped,period:{start:0,end:Date.now()+1000}}});assert.equal(report.simulations,1);assert.equal(report.recordsPurged,0);
  const stats=await ctx.call('reader','governance:getEnforcementStats',{tenantId:ctx.scopes.tenantId,options:{...scoped,period:'7d'}});assert.equal(stats.simulations,1);assert.equal(stats.simulation,true);
  await unchanged(ctx,()=>rejects(()=>ctx.operator('governance:enforce',{policyId:override.policyId,options:{scope:{organizationId:ctx.scopes.foreignTenantId}}})));
  // Admin-only authenticated principal may configure its own policy, never read private data.
  await unchanged(ctx,()=>rejects(()=>ctx.call('admin','runtimeMemory:recall',{...scope(ctx),text:'private context',requestId:named(ctx,'admin-recall')})));
  await unchanged(ctx,()=>rejects(()=>ctx.operator('governance:enforce',{policyId:result.policyId})));
  const cleanupResult=await ctx.operator('admin:deleteRecord',{table:'governancePolicies',id:override.policyId});assert.equal(cleanupResult,true);assert.equal(await record(ctx,'governancePolicies',override.policyId),null);
}
async function sourceFact(ctx, tag, principalId) {
  const content=`Owned source ${named(ctx,tag)}`;const lineage={sourceId:named(ctx,`${tag}-source`),sourceEventId:named(ctx,`${tag}-event`),sourceRevision:1,role:'user',trust:'user_assertion'};const now=Date.now()-1000;
  const source={...scope(ctx),ownerPrincipalId:principalId,lineage,content,contentHash:sha(content),createdAt:now};
  const fact={...scope(ctx),ownerPrincipalId:principalId,factId:named(ctx,`${tag}-fact`),lineage,extractionPolicyVersion:'source-attributed-facts-v1',fact:content,factType:'knowledge',confidence:90,sourceType:'manual',tags:[],version:1,createdAt:now,updatedAt:now};
  const refs=await rows(ctx,[['runtimeMemorySources',source],['facts',fact]]);return {source,fact,refs};
}
async function graph(ctx) {
  const actor=await internalActor(ctx,'graph');const a=actor.reference;const corpus=await sourceFact(ctx,'graph',a.principalId);const {sourceId,sourceEventId,sourceRevision}=corpus.source.lineage;
  const enqueue={authority:a,table:'facts',entityId:corpus.fact.factId,operation:'insert',source:{sourceId,sourceEventId,sourceRevision},expectedVersion:1,priority:'high'};
  const id=await ctx.operator('graphSync:queueForSync',enqueue);track(ctx,'graphSyncQueue',id);assert.equal(await ctx.operator('graphSync:queueForSync',enqueue),id);
  assert.equal((await ctx.operator('graphSync:getUnsyncedItems',{authority:a,limit:10}))[0]._id,id);assert.equal((await ctx.operator('graphSync:getHighPriorityItems',{authority:a,limit:10}))[0]._id,id);
  await ctx.operator('graphSync:markFailed',{authority:a,id,error:'provider private diagnostic must be replaced'});assert.equal((await record(ctx,'graphSyncQueue',id)).lastError,'GRAPH_SYNC_FAILED');assert.equal((await ctx.operator('graphSync:getFailedItems',{authority:a,limit:10}))[0]._id,id);
  assert.equal((await ctx.operator('graphSync:getSyncStats',{authority:a})).failed,1);
  await unchanged(ctx,()=>rejects(()=>ctx.operator('graphSync:markSynced',{authority:ctx.references.foreign,id})));
  await unchanged(ctx,()=>rejects(()=>ctx.operator('graphSync:queueForSync',{...enqueue,operation:'delete'}),'UNSUPPORTED_OPERATION'));
  await ctx.operator('graphSync:markSynced',{authority:a,id});assert.equal((await record(ctx,'graphSyncQueue',id)).synced,true);
  // This is DB metadata only. No adapter delivers anything to an external graph.
  assert.equal((await ctx.operator('graphSync:clearSyncedItems',{authority:a,olderThanMs:0})).deleted,1);assert.equal(await record(ctx,'graphSyncQueue',id),null);
  const second=await ctx.operator('graphSync:queueForSync',enqueue);track(ctx,'graphSyncQueue',second);await ctx.operator('graphSync:deleteSyncItem',{authority:a,id:second});assert.equal(await record(ctx,'graphSyncQueue',second),null);
  const third=await ctx.operator('graphSync:queueForSync',enqueue);track(ctx,'graphSyncQueue',third);
  // Delete the owned source between real calls. The retained queue cannot cause effects or recreate it.
  await ctx.cleanup([corpus.refs[0]]);
  for(const path of ['graphSync:markSynced','graphSync:deleteSyncItem']) await unchanged(ctx,()=>rejects(()=>ctx.operator(path,{authority:a,id:third})));
  await unchanged(ctx,()=>rejects(()=>ctx.operator('graphSync:queueForSync',enqueue)));
  assert.equal(await record(ctx,'runtimeMemorySources',corpus.refs[0].id),null);
  await ctx.operator('runtimeAuth:revokeGrant',{grantId:a.grantId});await unchanged(ctx,()=>rejects(()=>ctx.operator('graphSync:getSyncStats',{authority:a})));
  assert.equal(await ctx.operator('admin:deleteRecord',{table:'graphSyncQueue',id:third}),true);
}
const profile={profileId:'cortex-text-small-1536-v1',modelId:'openai/text-embedding-3-small',dimensions:1536,normalization:'text-nfc-lf-v1',chunking:'codepoint-1600-overlap-200-v1',indexName:'by_default_embedding_v1'};
async function domain(ctx) {
  requireCapture(ctx);const actor=await internalActor(ctx,'domain');const reference=actor.reference;const args={reference,capability:'write'};
  const corpus=await sourceFact(ctx,'domain',reference.principalId);const lineage=corpus.source.lineage;const src={sourceId:lineage.sourceId,sourceEventId:lineage.sourceEventId,sourceRevision:lineage.sourceRevision};
  const auth=await ctx.operator('runtimeMemory:checkAuthority',args);assert.equal(auth.principalId,reference.principalId);
  assert.equal((await ctx.operator('runtimeMemory:readSource',{...args,sourceId:src.sourceId})).content,corpus.source.content);
  const replay=await ctx.operator('runtimeMemory:writeSource',{...args,source:corpus.source});assert.equal(replay.created,false);assert.deepEqual(replay.source,corpus.source);
  const admittedSource={...corpus.source,lineage:{...corpus.source.lineage,sourceId:named(ctx,'new-source'),sourceEventId:named(ctx,'new-source-event')}};
  const admitted=await captured(ctx,()=>ctx.operator('runtimeMemory:writeSource',{...args,source:admittedSource}));assert.equal(admitted.created,true);assert.deepEqual(admitted.source,admittedSource);assert.equal((await ctx.operator('runtimeMemory:readSource',{...args,sourceId:admittedSource.lineage.sourceId})).content,admittedSource.content);
  const input={source:src,identity:{...src,stage:'facts',semanticPolicyVersion:'source-attributed-facts-v1'}};
  const receipt=await captured(ctx,()=>ctx.operator('runtimeMemory:writeDerived',{...args,input}));assert.equal(receipt.created,true);
  assert.equal((await ctx.operator('runtimeMemory:writeDerived',{...args,input})).created,false);
  const facts=await ctx.operator('runtimeMemory:readFacts',{reference,capability:'read',query:{limit:10}});assert.ok(facts.some(fact=>fact.factId===corpus.fact.factId));
  // A current schema-valid synthetic managed-vector row qualifies hydration, never vector search/model inference.
  const chunkId=sha(JSON.stringify([reference.tenantId,reference.memorySpaceId,src.sourceId,src.sourceEventId,1,profile.profileId,0,corpus.source.content]));
  const chunk={...scope(ctx),...src,chunkId,profileId:profile.profileId,ordinal:0,start:0,end:Array.from(corpus.source.content).length,text:corpus.source.content,textHash:sha(corpus.source.content)};
  const vector={...scope(ctx),...src,vectorId:named(ctx,'domain-vector'),chunkId,profile,embedding:Array(1536).fill(0),processingReceiptId:receipt.receiptId,profileId:profile.profileId,ownerPrincipalId:reference.principalId,scopeProfileKey:JSON.stringify([reference.tenantId,reference.memorySpaceId,profile.profileId]),scopeProfileOwnerKey:JSON.stringify([reference.tenantId,reference.memorySpaceId,profile.profileId,reference.principalId])};vector.embedding[0]=1;
  const vectorRefs=await rows(ctx,[['runtimeMemoryChunks',chunk],['runtimeMemoryVectors',vector]]);const hits=[{id:vectorRefs[1].id,score:0.9}];
  const hydrated=await ctx.operator('runtimeMemory:readVectorMatches',{reference,capability:'read',hits});assert.equal(hydrated.length,1);assert.equal(hydrated[0].source.content,corpus.source.content);
  assert.deepEqual(await ctx.operator('runtimeMemory:readVectorMatches',{reference:ctx.references.reader,capability:'read',hits}),[]);
  await unchanged(ctx,()=>rejects(()=>ctx.operator('runtimeMemory:readSource',{reference:ctx.references.reader,capability:'read',sourceId:src.sourceId})));
  await unchanged(ctx,()=>rejects(()=>ctx.operator('runtimeMemory:writeSource',{reference:ctx.references.reader,capability:'write',source:corpus.source})));
  // Resource tombstone between calls independently blocks private hydration and recreation.
  await rows(ctx,[['runtimeAuthTombstones',{...scope(ctx),resourceType:'source',resourceId:src.sourceId,deletedAt:Date.now()}]]);
  await unchanged(ctx,()=>rejects(()=>ctx.operator('runtimeMemory:readSource',{...args,sourceId:src.sourceId})));
  assert.deepEqual(await ctx.operator('runtimeMemory:readFacts',{reference,capability:'read',query:{limit:10}}),[]);
  assert.deepEqual(await ctx.operator('runtimeMemory:readVectorMatches',{reference,capability:'read',hits}),[]);
  await unchanged(ctx,()=>rejects(()=>ctx.operator('runtimeMemory:writeDerived',{...args,input})));
  await unchanged(ctx,()=>rejects(()=>ctx.operator('runtimeMemory:writeSource',{...args,source:corpus.source})));
  await ctx.operator('runtimeAuth:revokeGrant',{grantId:reference.grantId});
  for(const [path,extra] of [['runtimeMemory:checkAuthority',{}],['runtimeMemory:readSource',{sourceId:src.sourceId}],['runtimeMemory:writeSource',{source:corpus.source}],['runtimeMemory:writeDerived',{input}],['runtimeMemory:readFacts',{query:{limit:10}}],['runtimeMemory:readVectorMatches',{hits}]]) await unchanged(ctx,()=>rejects(()=>ctx.operator(path,{...args,...extra})));
}
export function foregroundClosureRows(ctx,variant,requestId,content){
  const sourceId=`explicit:${JSON.stringify([ctx.scopes.tenantId,ctx.scopes.memorySpaceId,ctx.principals.reader,requestId])}`;
  const source={...owner(ctx),lineage:{sourceId,sourceEventId:sourceId,sourceRevision:1,role:'user',trust:'user_assertion'},content,contentHash:sha(content),createdAt:Date.now()};
  if(variant==='foreign'){source.tenantId=ctx.scopes.foreignTenantId;source.memorySpaceId=ctx.scopes.foreignMemorySpaceId;source.ownerPrincipalId=ctx.principals.foreign;}
  if(variant==='foreign-owner')source.ownerPrincipalId=ctx.principals.foreign;
  // runtimeMemorySources requires v.string owner; empty owner is the schema-valid ownerless control.
  if(variant==='ownerless')source.ownerPrincipalId='';
  const fact={tenantId:source.tenantId,memorySpaceId:source.memorySpaceId,ownerPrincipalId:source.ownerPrincipalId,factId:named(ctx,`closure-${variant}-fact`),lineage:source.lineage,extractionPolicyVersion:'source-attributed-facts-v1',fact:content,factType:'knowledge',confidence:90,sourceType:'manual',tags:[],version:1,createdAt:Date.now(),updatedAt:Date.now()};
  return [source,fact];
}
async function unconfiguredPolicy(ctx) {
  requireCapture(ctx);let closureCases=0;const closurePaths=new Set();
  // Closure controls deliberately vary source presence/ownership without using a replay prerequisite.
  for(const variant of ['owned','foreign','foreign-owner','ownerless','missing']) {
    const requestId=named(ctx,`closure-${variant}`);const content='Memory closure must not process this request';
    if(variant!=='missing') {
      const [source,fact]=foregroundClosureRows(ctx,variant,requestId,content);
      const seeded=await rows(ctx,[['runtimeMemorySources',source],['facts',fact]]);assert.deepEqual((await record(ctx,'runtimeMemorySources',seeded[0].id)).lineage,source.lineage);assert.equal((await record(ctx,'facts',seeded[1].id)).fact,content);
    }
    for(const path of ['runtimeMemory:remember','runtimeMemory:recall']){await unchanged(ctx,()=>rejects(()=>ctx.call('reader',path,{...scope(ctx),text:content,requestId}),'CAPABILITY_UNAVAILABLE'));closureCases++;closurePaths.add(path);}
  }
  for(const [identity,path] of [['admin','runtimeMemory:remember'],['writer','runtimeMemory:recall'],['foreign','runtimeMemory:remember']]) await unchanged(ctx,()=>rejects(()=>ctx.call(identity,path,{...scope(ctx),text:'Denied scope',requestId:named(ctx,`${identity}-denied`)})));
  return {domainClosureCases:closureCases,domainClosurePaths:[...closurePaths]};
}

export async function prepare(ctx) {
  assert.match(ctx.run,/^foundation-[a-f0-9]{32}$/);
  // Execution runner supplies typed bounded discovery; older contracts remain explicitly blocked.
  if (typeof ctx.discoverOwnedEffects === 'function') ctx.captureOwnedEffects=()=>ctx.discoverOwnedEffects();
  const paths=module=>registeredPaths.filter(path=>path.startsWith(`${module}:`));
  return {family:manifest.family,registeredPaths,cases:[
    suite('mwd-metadata-positive',['immutable:get','immutable:getVersion','immutable:getHistory','immutable:getAtTimestamp','immutable:list','immutable:count','immutable:search','immutable:store','immutable:purgeVersions','mutable:get','mutable:exists','mutable:set','mutable:update','mutable:list','mutable:count','mutable:transaction','mutable:purgeNamespace','sessions:get','sessions:touch','sessions:list','sessions:count','sessions:end','sessions:create','sessions:endAll','users:get','users:exists','users:getVersion','users:getHistory','users:getAtTimestamp','users:list','users:count'],metadataPositive),
    suite('mwd-metadata-private',['immutable:get','immutable:store','mutable:get','mutable:set','mutable:update','sessions:get','sessions:touch','sessions:end','users:get','users:getHistory','users:exists','users:deleteUserProfile'],metadataPrivate),
    suite('mwd-metadata-delete-no-recreate',['immutable:purge','immutable:purgeMany','mutable:deleteKey','mutable:purgeMany','mutable:purgeNamespace','users:deleteUserProfile'],metadataDeletion,['discoverOwnedEffects']),
    suite('mwd-session-background',['sessions:incrementMessageCount','sessions:incrementMemoryCount','sessions:expireIdle'],background),
    suite('mwd-governance-admin',[...paths('governance').filter(path=>!path.includes(':purgeAll')),'admin:deleteRecord'],governance,['discoverOwnedEffects']),
    suite('mwd-graph-stored-reference',paths('graphSync').filter(path=>!path.endsWith(':purgeAll')),graph),
    suite('mwd-domain-owned-current-reference',paths('runtimeMemory').filter(path=>!['runtimeMemory:remember','runtimeMemory:recall'].includes(path)),domain,['discoverOwnedEffects']),
    suite('mwd-domain-policy-intermediate',['runtimeMemory:remember','runtimeMemory:recall'],unconfiguredPolicy),
  ],internalPaths:manifest.internalPaths,limitations:manifest.limitations};
}

/** Schema-only collector: never executes descriptors or resembles live evidence. */
export async function collectOfflineFixtureRows(ctx) {
  await metadataRows(ctx,'schema'); await metadataRows(ctx,'schema-ownerless','reader',true);
  const actor=await internalActor(ctx,'schema-actor'); await sourceFact(ctx,'schema-source',actor.reference.principalId);
  for(const variant of ['owned','foreign','foreign-owner','ownerless']){const [source,fact]=foregroundClosureRows(ctx,variant,named(ctx,'schema-closure-'+variant),'private schema closure corpus');await rows(ctx,[['runtimeMemorySources',source],['facts',fact]]);}
}
