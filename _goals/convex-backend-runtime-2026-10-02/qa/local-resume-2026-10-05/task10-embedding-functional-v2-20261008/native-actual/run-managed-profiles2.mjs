/** Native profile flow. Each paid phase is new once; unknown outcomes stop, never re-dispatch. */
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied,authorityReference} from './common.mjs';
const stage=process.argv[2],c=await openOwnedContext(),started=Date.now();
const read=name=>readFile(join(q,name+'.json'),'utf8').then(JSON.parse);
const receipt='managed-'+stage+'1';
async function newPhase(){let exists=true;try{await access(join(q,receipt+'.json'));}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}assert.equal(exists,false,'Closed phase already exists; no repeated effects');}
try{
 await c.verifyTarget(receipt+'-target-verified');await newPhase();
 const policies=await read('managed-policy-candidates1'),tenantId=c.tenantId+'-managed',memorySpaceId=tenantId+'-space',scope={tenantId,memorySpaceId};
 if(stage==='setup'){
  assert.equal((await read('large-commission-outcomes2')).status,'ACTUAL_NATIVE_PASS');
  const priorSetup=await c.admin.query("profileNative:cleanupState",{});await c.publish("managed-setup2-prior-denied-setup",priorSetup);assert.equal(priorSetup.sources.filter(row=>row.tenantId===tenantId).length,0);assert.equal(priorSetup.conversations.filter(row=>row.tenantId===tenantId).length,0);for(const row of priorSetup.grants.filter(row=>row.tenantId===tenantId&&row.memorySpaceId===null&&row.revokedAt===null))await c.admin.mutation("runtimeAuth:revokeGrant",{grantId:row._id});
  const ownerAuthority=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'cortex-owner',actorKind:'user',...scope,
   capabilities:['read','write','run','admin','tool','storage:read','storage:write'],resourceAccess:'space',expiresAt:Date.now()+7200000});
  const tenantAdminAuthority=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'task10-tenant-operator',actorKind:'user',tenantId,capabilities:['admin'],resourceAccess:'tenant',expiresAt:Date.now()+7200000});
  const reference=authorityReference(ownerAuthority),tenantAdmin=authorityReference(tenantAdminAuthority);
  await c.owner.mutation('memorySpaces:register',{...scope,name:'Task10 managed two-profile space',type:'project'});
  const selected=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',policies.small);
  const conversation=await c.owner.mutation('runtimeTranscript:create',{memorySpaceId,clientRequestId:'task10-source'});
  const selector={...scope,conversationId:conversation.conversationId},before=await c.owner.query('runtimeTranscript:get',selector);
  await c.owner.mutation('runtimeTranscript:setPolicy',{...selector,expectedRevision:before.historyRevision,manualWriteLocked:false});
  const unlocked=await c.owner.query('runtimeTranscript:get',selector);
  const text='The observatory project codeword is MARIGOLD_3072. The research team meets beside the cedar telescope.';
  const pins=await c.owner.mutation('profileNative:appendHeld',{...selector,expectedRevision:unlocked.historyRevision,text});
  assert.equal(pins.length,1);const sourceId=pins[0].sourceEventId;
  const metadata=await c.admin.query('profileNative:inspect',{reference});
  assert.equal(metadata.sources.length,1);assert.equal(metadata.sources[0].lineage.sourceId,sourceId);assert.equal(metadata.sources[0].content,text);
  assert.equal(metadata.vectors.length,0);assert.ok(metadata.stages.every(row=>row.attempt===0));
  const ledger=await c.admin.query('profileNative:inspectLedger',{reference});assert.equal(ledger.attempts.length,0);
  await c.publish(receipt,{status:'PASS',reference,tenantAdmin,scope,selector,selected,sourceId,pin:pins[0],text,metadata,ledger});
 }else{
  const setup=await read('managed-setup2'),{reference,tenantAdmin,selector,sourceId}=setup;
  const inspect=()=>c.admin.query('profileNative:inspect',{reference}),ledger=()=>c.admin.query('profileNative:inspectLedger',{reference});
  const before=await inspect(),moneyBefore=await ledger();
  await c.publish(receipt+'-before',{metadata:before,ledger:moneyBefore});
  if(stage==='small'||stage==='large'){
   const dimensions=stage==='small'?1536:3072,expected=stage==='small'?'cortex-text-small-1536-v1':'cortex-text-large-3072-v1';
   const profile=await c.owner.query('runtimeMemory:defaultProfile',scope);assert.equal(profile.profile.dimensions,dimensions);
   const derived=await c.admin.action('profileNative:derive',{reference,sourceId,requestId:'task10-derive-'+stage});
   await c.publish(receipt+'-derive',derived);assert.equal(derived.profile.profileId,expected);assert.equal(derived.created,true);
   const queryArgs={...scope,text:'observatory project codeword cedar telescope',requestId:'task10-query-'+stage,limit:5};
   const query=await c.owner.action('runtimeMemory:recall',queryArgs);await c.publish(receipt+'-query',query);
   assert.equal(query.profileId,expected);assert.ok(query.items.some(item=>item.type==='memory'&&item.content.includes('MARIGOLD_3072')));
   const after=await inspect(),moneyAfter=await ledger();await c.publish(receipt+'-after',{metadata:after,ledger:moneyAfter});
   assert.equal(moneyAfter.attempts.length,moneyBefore.attempts.length+2);
   const tenantAccount=moneyAfter.accounts.find(row=>row.kind==='tenant');assert.ok(tenantAccount);
   assert.equal(tenantAccount.uncertainUnits,stage==='small'?200000:400000);assert.equal(tenantAccount.reservedUnits,0);assert.equal(tenantAccount.activeConcurrency,0);
   assert.deepEqual(after.sources,before.sources);assert.equal(after.chunks.length,1);
   assert.ok(after.vectors.find(row=>row.profile.profileId===expected&&row.dimensions===dimensions&&row.sourceId===sourceId&&row.finite));
   if(stage==='large'){
    const small=await read('managed-small2');assert.deepEqual(after.chunks,small.after.chunks);
    assert.deepEqual(after.vectors.find(row=>row.profile.dimensions===1536),small.after.vectors[0]);assert.equal(after.generations.length,2);
    const originalTenant=small.ledger.accounts.find(row=>row.kind==='tenant');assert.equal(tenantAccount._id,originalTenant._id);
    assert.deepEqual(tenantAccount.root,originalTenant.root);assert.equal(tenantAccount.windowId,originalTenant.windowId);
   }
   const operation=moneyAfter.operations.find(row=>row.operationKey==='embedding.query'&&!moneyBefore.operations.some(old=>old._id===row._id));assert.ok(operation);
   const attempt=moneyAfter.attempts.find(row=>row.operationDocumentId===operation._id);assert.ok(attempt);assert.equal(attempt.resultWithheld,false);assert.equal(attempt.slotReleased,true);
   assert.equal(attempt.state,'uncertain');assert.equal(attempt.reservationUnits,100000);assert.equal(attempt.settledCostUnits,null);
   assert.equal(operation.snapshot.semanticProfile.dimensions,dimensions);assert.ok(attempt.measuredInputTokens<=operation.snapshot.limits.inputTokens);
   const deriveReplay=await c.admin.action('profileNative:derive',{reference,sourceId,requestId:'task10-derive-'+stage});assert.equal(deriveReplay.created,false);
   const queryReplay=await c.owner.action('runtimeMemory:recall',queryArgs);assert.deepEqual(queryReplay,query);
   assert.deepEqual(await ledger(),moneyAfter);assert.deepEqual(await inspect(),after);
   const invalid=[];for(const variant of ['model','index','dimensions'])invalid.push({variant,error:c.publicError(await denied(()=>c.admin.mutation('profileNative:repeatCommit',{reference,receiptId:derived.receiptId,invalid:variant})))});
   assert.deepEqual(await inspect(),after);assert.deepEqual(await ledger(),moneyAfter);
   await c.publish(receipt,{status:'ACTUAL_MANAGED_PASS',scope,selectedPolicy:stage==='small'?policies.small:policies.largeSelector,profile,derived,query,queryAttemptId:attempt._id,after,ledger:moneyAfter,
    invalidRegisteredNativeCommitGuards:invalid,invalidGuardsNotClaimedAsManagedDifferentModelSearch:true,replayNoAddedPaidAttempt:true,modelCallsThisPhase:2});
  }else if(stage==='switch'){
   const selected=[];for(const operationKey of ['embedding.memory','embedding.query']){
    const policy={policyId:'task10-managed-selector-'+operationKey+'-'+c.state.operation,version:1,scope:'tenant',tenantId,operationKey,
     rules:{modelId:policies.largeSelector.modelId,nativeInterface:policies.largeSelector.nativeInterface,pins:{priceRevision:policies.largeSelector.priceRevision,boundRevision:policies.largeSelector.boundRevision}}};
    selected.push(await c.admin.mutation('runtimeModelPolicy:provisionTenantPolicy',{reference:tenantAdmin,policyCanonical:JSON.stringify(policy),overrideRequested:true}));
   }
   const profile=await c.owner.query('runtimeMemory:defaultProfile',scope);assert.equal(profile.profile.dimensions,3072);
   const error=await denied(()=>c.owner.action('runtimeMemory:recall',{...scope,text:'observatory codeword',requestId:'task10-large-cold-profile',limit:5}));
   const explicit=c.publicError(error);assert.ok(JSON.stringify(explicit).includes('PROFILE_NOT_READY'),'Cold profile must have explicit readiness');
   const small=await read('managed-small2'),oldCommit=c.publicError(await denied(()=>c.admin.mutation('profileNative:repeatCommit',{reference,receiptId:small.derived.receiptId}))),oldQuery=c.publicError(await denied(()=>c.admin.action('profileNative:searchFromQuery',{reference,attemptId:small.queryAttemptId})));
   const status=await c.owner.query('runtimeMemoryContext:status',scope),after=await inspect(),moneyAfter=await ledger();
   assert.deepEqual(after.sources,before.sources);assert.deepEqual(after.vectors,before.vectors);assert.deepEqual(moneyAfter,moneyBefore);
   assert.equal(status.stages.vectors.indexedThrough,0);assert.equal(status.stages.vectors.hole.state,'pending');
   await c.publish(receipt,{status:'PASS',selected,profile,coldPublicReadiness:explicit,oldCommit,oldQuery,contextStatus:status,after,ledger:moneyAfter,addedPaidAttempts:0,oldBudgetNotRefreshed:true});
  }else if(stage==='edit'||stage==='delete'){
   const large=await read('managed-large2'),conversation=await c.owner.query('runtimeTranscript:get',selector);
   const args={...selector,expectedRevision:conversation.historyRevision,messageId:setup.pin.nativeMessageId,expectedMessageRevision:stage==='edit'?1:2};
   const change=stage==='edit'?await c.owner.mutation('profileNative:editHeld',{...args,text:'The observatory codeword changed to IVORY_CURRENT.'}):await c.owner.mutation('runtimeTranscript:removeMessage',args);
   const oldCommit=c.publicError(await denied(()=>c.admin.mutation('profileNative:repeatCommit',{reference,receiptId:large.derived.receiptId})));
   const matches=await c.admin.action('profileNative:searchFromQuery',{reference,attemptId:large.queryAttemptId});assert.deepEqual(matches,[]);
   const after=await inspect(),moneyAfter=await ledger();assert.equal(moneyAfter.attempts.length,moneyBefore.attempts.length);
   assert.deepEqual(after.vectors,before.vectors);assert.deepEqual(after.chunks,before.chunks);
   await c.publish(receipt,{status:'PASS',change,oldCommit,obsoleteManagedSearchResults:matches,after,ledger:moneyAfter,addedPaidAttempts:0,newExtractionHeld:stage==='edit'});
  }else if(stage==='revoke'){
   const large=await read('managed-large2');await c.admin.mutation('runtimeAuth:revokeGrant',{grantId:reference.grantId});
   const failures=[];for(const call of [()=>c.admin.action('profileNative:searchFromQuery',{reference,attemptId:large.queryAttemptId}),()=>c.admin.mutation('profileNative:repeatCommit',{reference,receiptId:large.derived.receiptId}),()=>c.owner.query('runtimeMemory:defaultProfile',scope)])failures.push(c.publicError(await denied(call)));
   const after=await ledger();assert.deepEqual(after,moneyBefore);await c.publish(receipt,{status:'PASS',failures,ledger:after,addedPaidAttempts:0});
  }else throw Error('Unknown managed stage');
 }
}catch(error){await c.publish(receipt+'-failure',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),elapsedMs:Date.now()-started,noBlindPaidRetry:true});throw error;}
finally{await c.close();await c.publish(receipt+'-cleanup',{ownedClientsClosed:true,elapsedMs:Date.now()-started});}
