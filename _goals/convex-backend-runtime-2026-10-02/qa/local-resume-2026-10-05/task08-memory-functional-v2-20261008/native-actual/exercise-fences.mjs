import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied,waitUntil} from './common.mjs';
const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},records=[],outcomes=[];
const candidate=JSON.parse(await readFile(join(q,process.argv[2]??'installed-task08-source-manifest2.json')));
async function call(label,kind,name,args,client=c.admin){const started=Date.now();try{const result=await client[kind](name,args);records.push({label,kind,function:name,args,result,elapsedMs:Date.now()-started});await c.publish('fences-calls',{operation,candidate:candidate.manifestSha256,records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error),elapsedMs:Date.now()-started});await c.publish('fences-calls',{operation,candidate:candidate.manifestSha256,records});throw error;}}
async function check(name,fn){try{outcomes.push({name,status:'PASS',evidence:await fn()});}catch(error){outcomes.push({name,status:'FAIL',error:c.publicError(error)});throw error;}finally{await c.publish('fences-outcomes',{operation,candidate:candidate.manifestSha256,outcomes});}}
const state=()=>c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,...scope});
const lease=value=>({reference:value.reference,eventId:value.eventId,stage:value.stage,attempt:value.attempt,leaseVersion:value.leaseVersion});
const controlCode=e=>e.data?.code??e.message;
async function seed(reference,label,text,role){return (await call(label+'-seed','mutation','ingestionQualification:seedSources',{reference,prefix:operation+'-'+label,texts:[text],...(role?{role}:{})}))[0];}
async function provision(subject,access='space'){return await call(subject+'-grant','mutation','runtimeAuth:provision',{issuer:c.auth.issuer,subject,actorKind:'user',tenantId:c.tenantId,...scope,capabilities:['read','write','run','admin','tool'],resourceAccess:access});}
try{
 await c.verifyTarget('fences-target-verified');const reference=await c.owner.query('ingestionQualification:reference',scope);
 const deleted=await seed(reference,'delete-running','The delayed source must not be recreated after deletion.');
 const active=await call('delete-claim','mutation','runtimeIngestion:claim',{reference,eventId:deleted.eventId,stage:'extract'});assert.ok(active);
 const beforeDelete=await state(),source=beforeDelete.runtimeIngestionEvents.find(e=>e.eventId===deleted.eventId).lineage.sourceId;
 await call('delete-current-source','mutation','runtimeAuth:tombstoneResource',{tenantId:c.tenantId,...scope,resourceType:'source',resourceId:source});
 const late=await denied(()=>call('delete-late-extract','mutation','runtimeIngestion:persistStage',{...lease(active),payloadCanonical:'[]'}));
 await check('source deletion during the native running stage denies late completion and cannot recreate facts',async()=>{
  const after=await state();assert.ok(['FORBIDDEN','STALE_SOURCE'].includes(controlCode(late)));assert.equal(after.runtimeIngestionEvents.find(e=>e.eventId===deleted.eventId).eligibility,'tombstoned');
  assert.equal(after.facts.filter(f=>f.lineage?.sourceId===source).length,0);assert.equal(after.runtimeMemoryVectors.filter(v=>v.sourceId===source).length,0);assert.equal(after.runtimeModelAttempts.length,beforeDelete.runtimeModelAttempts.length);
  return {eventId:deleted.eventId,denial:c.publicError(late),noNewModelAttempt:true,noResurrection:true};});
 const unknown=await seed(reference,'unknown','The interrupted unknown extraction may not be retried blindly.'),unknownLease=await call('unknown-claim','mutation','runtimeIngestion:claim',{reference,eventId:unknown.eventId,stage:'extract'});
 await call('unknown-interruption','mutation','runtimeIngestion:failStage',{...lease(unknownLease),uncertain:true,failureCode:'CONTROLLED_INTERRUPTED_STAGE'});
 const beforeUnknown=await state(),unsafe=await denied(()=>call('unknown-retry-denied','mutation','runtimeIngestion:retry',{...scope,eventId:unknown.eventId,stage:'extract'},c.owner)),unproven=await denied(()=>call('unknown-unproven-reconcile-denied','mutation','runtimeIngestion:reconcile',{...scope,eventId:unknown.eventId,stage:'extract'},c.owner));
 assert.equal(controlCode(unsafe),'RETRY_NOT_SAFE');assert.equal(controlCode(unproven),'RECONCILIATION_NOT_SAFE');assert.equal((await state()).runtimeModelAttempts.length,beforeUnknown.runtimeModelAttempts.length);
 const retryable=await seed(reference,'bounded-retry','A safe pre-dispatch failure remains observable and bounded.');
 for(let attempt=1;attempt<=3;attempt++){
  await call('safe-fail-'+attempt,'mutation','runtimeIngestion:failUnclaimed',{reference,eventId:retryable.eventId,stage:'extract'});
  const status=await call('safe-state-'+attempt,'query','runtimeIngestion:status',{...scope,eventId:retryable.eventId},c.owner);assert.equal(status.stages.find(s=>s.stage==='extract').attempt,attempt);
  if(attempt<3)await call('safe-retry-'+attempt,'mutation','ingestionQualification:retryHeld',{...scope,eventId:retryable.eventId,stage:'extract'},c.owner);
 }
 const exhausted=await denied(()=>call('dead-letter-retry-denied','mutation','runtimeIngestion:retry',{...scope,eventId:retryable.eventId,stage:'extract'},c.owner));assert.equal(controlCode(exhausted),'RETRY_NOT_SAFE');
 await check('unknown failure is not replayed; safe pre-dispatch retries stop at the native dead-letter bound',async()=>{
  const s=await state();assert.equal(s.runtimeIngestionStages.find(x=>x.eventId===unknown.eventId&&x.stage==='extract').state,'unknown');assert.equal(s.runtimeIngestionStages.find(x=>x.eventId===retryable.eventId&&x.stage==='extract').state,'dead_letter');
  return {unknown:c.publicError(unsafe),noProof:c.publicError(unproven),attempts:3,finalState:'dead_letter',retryOnlySchedulerIntentHeld:true};});
 const assistant=await seed(reference,'assistant','I speculate that the user is a pilot.','assistant');
 assert.equal(await call('assistant-extract-skipped','mutation','runtimeIngestion:claim',{reference,eventId:assistant.eventId,stage:'extract'}),null);
 const assistantState=await c.owner.query('runtimeIngestion:status',{...scope,eventId:assistant.eventId});assert.equal(assistantState.stages.find(s=>s.stage==='facts').state,'skipped');
 assert.equal((await state()).facts.filter(f=>f.lineage?.sourceId===operation+'-assistant:0').length,0);
 await check('assistant claims never enter authoritative extraction or belief stages',async()=>({eventId:assistant.eventId,stages:assistantState.stages,noAuthoritativeFacts:true}));

 const prior=JSON.parse(await readFile(join(q,'delayed-calls.json'))),definition=prior.records.find(row=>row.label==='pending-definition').result;
 const partialRun=await call('partial-submit','mutation','ingestionQualification:submitHeld',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,clientRequestId:operation+'-partial',parts:[{type:'text',text:'A bounded cancelled partial-output fixture; do not start inference.'}]}},c.owner);
 const partialClaim=await call('partial-native-claim','mutation','runs:claimNext',{reference,conversationId:partialRun.conversationId});
 const partialArgs={reference,runId:partialRun.runId,attemptNumber:partialClaim.attemptNumber,leaseVersion:partialClaim.leaseVersion},partial=await call('partial-native-save','mutation','ingestionQualification:savePartial',partialArgs);
 assert.equal(partial[0].status,'pending');await call('partial-cancel','mutation','runtimeAgent:cancel',{...scope,runId:partialRun.runId},c.owner);
 const afterCancel=await state(),latePartial=await denied(()=>call('cancelled-partial-complete-denied','mutation','runs:complete',{...partialArgs,outputMessageIds:partial.map(row=>row.id)}));
 await check('cancelled native partial output is neither a registered source nor an authoritative assertion',async()=>{
  const after=await state();assert.equal(controlCode(latePartial),'INVALID_STATE');assert.equal(after.runtimeIngestionEvents.filter(e=>e.runId===partialRun.runId&&e.lineage.role==='assistant').length,0);
  assert.equal(after.runtimeTranscriptMessages.filter(row=>partial.some(p=>p.id===row.nativeMessageId)).length,0);assert.equal(after.runtimeModelAttempts.length,afterCancel.runtimeModelAttempts.length);
  return {nativePendingMessage:partial[0],lateCompletionDenied:c.publicError(latePartial),noAssistantSource:true,noModelDispatch:true};});

 // Use separate real subjects so revoking the original owner's grant does not reset or replace the main financial scope.
 const ownerSubject='task08-edit-owner-'+operation,editorSubject='task08-editor-'+operation,ownSubject='task08-own-only-'+operation;
 const ownerRef=await provision(ownerSubject),editorRef=await provision(editorSubject),ownRef=await provision(ownSubject,'own');
 const owner=c.http(ownerSubject),editor=c.http(editorSubject),ownOnly=c.http(ownSubject);
 const conversation=await call('shared-create','mutation','runtimeTranscript:create',{...scope,clientRequestId:operation+'-shared'},owner),selector={...scope,conversationId:conversation.conversationId};
 const unlocked=await call('shared-unlock','mutation','runtimeTranscript:setPolicy',{...selector,expectedRevision:conversation.historyRevision,manualWriteLocked:false},owner);
 const pin=(await call('shared-owned-input','mutation','ingestionQualification:appendHeld',{...selector,expectedRevision:unlocked.historyRevision,role:'user',parts:[{type:'text',text:'The shared source owner prefers amber tea.'}]},owner))[0];
 const initial=await state(),oldEvent=initial.runtimeIngestionEvents.find(e=>e.nativeMessageId===pin.nativeMessageId&&e.lineage.sourceRevision===1);
 const oldLease=await call('edit-old-claim','mutation','runtimeIngestion:claim',{reference:ownerRef,eventId:oldEvent.eventId,stage:'extract'});
 let current=await owner.query('runtimeTranscript:get',selector);
 await call('owner-edit-while-running','mutation','ingestionQualification:editHeld',{...selector,expectedRevision:current.historyRevision,messageId:pin.nativeMessageId,expectedMessageRevision:1,parts:[{type:'text',text:'The shared source owner now prefers green tea.'}]},owner);
 const obsolete=await denied(()=>call('edit-obsolete-result','mutation','runtimeIngestion:persistStage',{...lease(oldLease),payloadCanonical:'[]'}));assert.ok(['STALE_SOURCE','FORBIDDEN'].includes(controlCode(obsolete)));
 const permissions={canView:true,canViewFacts:true,canViewMemories:true,canContinue:true,canFork:false,canExport:false};
 for(const target of [editorRef,ownRef])await call('share-'+target.principalId,'mutation','conversationShares:create',{...selector,grantedBy:ownerRef.principalId,grantType:'user',grantedTo:target.principalId,permissions},owner);
 current=await owner.query('runtimeTranscript:get',selector);const deniedBefore=await state();
 const ownDenied=await denied(()=>call('own-only-editor-denied','mutation','ingestionQualification:editHeld',{...selector,expectedRevision:current.historyRevision,messageId:pin.nativeMessageId,expectedMessageRevision:2,parts:[{type:'text',text:'Foreign own-only attempted change'}]},ownOnly));assert.equal(controlCode(ownDenied),'FORBIDDEN');assert.deepEqual((await state()).runtimeMemorySources,deniedBefore.runtimeMemorySources);
 await call('original-owner-grant-revoked','mutation','runtimeAuth:revokeGrant',{grantId:ownerRef.grantId});
 await call('current-shared-editor-update','mutation','ingestionQualification:editHeld',{...selector,expectedRevision:current.historyRevision,messageId:pin.nativeMessageId,expectedMessageRevision:2,parts:[{type:'text',text:'The shared source owner now prefers jasmine tea.'}]},editor);
 const edited=await state(),newEvent=edited.runtimeIngestionEvents.find(e=>e.nativeMessageId===pin.nativeMessageId&&e.lineage.sourceRevision===3);assert.ok(newEvent);
 assert.equal(newEvent.ownerPrincipalId,ownerRef.principalId);assert.equal(newEvent.authorityReference.principalId,editorRef.principalId);
 await waitUntil('editor held current source',()=>c.admin.query('ingestionQualification:held',{reference:editorRef,eventId:newEvent.eventId,stage:'extract'}),Boolean,{timeoutMs:10000});
 await call('shared-editor-real-extract','action','ingestionQualification:release',{reference:editorRef,eventId:newEvent.eventId,stage:'extract'});
 await waitUntil('shared editor indexing',()=>editor.query('runtimeIngestion:status',{...scope,eventId:newEvent.eventId}),v=>v.stages.every(s=>['complete','skipped'].includes(s.state)),{timeoutMs:120000,pollMs:400});
 await check('authorized shared editor indexes under current grant while preserving original source owner',async()=>{
  const s=await state(),job=s.runtimeIngestionJobs.find(j=>j.eventId===newEvent.eventId),ops=s.runtimeModelOperations.filter(op=>op.runAccountId===job.runAccountId);
  assert.ok(ops.length);assert.ok(ops.every(op=>op.principalId===editorRef.principalId));assert.ok(s.runtimeMemoryVectors.some(v=>v.sourceId===newEvent.lineage.sourceId&&v.sourceRevision===3&&v.ownerPrincipalId===ownerRef.principalId));
  return {owner:ownerRef.principalId,billingActor:editorRef.principalId,currentRevision:3,oldOwnerRevoked:true,ownOnlyDenied:c.publicError(ownDenied),oldRevisionDenied:c.publicError(obsolete)};});
 current=await editor.query('runtimeTranscript:get',selector);await call('shared-remove','mutation','runtimeTranscript:removeMessage',{...selector,expectedRevision:current.historyRevision,messageId:pin.nativeMessageId,expectedMessageRevision:3},editor);
 const lateAfterRemove=await denied(()=>call('deleted-current-stage-denied','mutation','runtimeIngestion:claim',{reference:editorRef,eventId:newEvent.eventId,stage:'vectors'}));
 const visible=await call('post-delete-visible-facts','query','runtimeMemory:readFacts',{reference:editorRef,capability:'read',query:{limit:100}});
 assert.equal(visible.filter(f=>f.lineage.sourceId===newEvent.lineage.sourceId).length,0);
 await call('editor-grant-revoked','mutation','runtimeAuth:revokeGrant',{grantId:editorRef.grantId});
 const beforeRevoked=await state(),revoked=await denied(()=>call('revoked-worker-denied','mutation','runtimeIngestion:claim',{reference:editorRef,eventId:newEvent.eventId,stage:'extract'}));assert.equal(controlCode(revoked),'FORBIDDEN');assert.equal((await state()).runtimeModelAttempts.length,beforeRevoked.runtimeModelAttempts.length);
 await check('current deletion excludes derived facts and revoked grant blocks any late claim before dispatch',async()=>({lateAfterRemove:c.publicError(lateAfterRemove),revoked:c.publicError(revoked),visibleFactsFromDeletedSource:0,modelAttemptsUnchanged:true}));
 await c.publish('fences-final-native-state',await state());await c.publish('fences-final',{status:'PASS',operation,outcomes,nativeMutationFailuresInjected:true,noUncontrolledRetry:true,actualSharedEditorInference:true});
}finally{await c.close();await c.publish('fences-cleanup',{ownedClientsClosed:true,noReactiveClients:true});}
