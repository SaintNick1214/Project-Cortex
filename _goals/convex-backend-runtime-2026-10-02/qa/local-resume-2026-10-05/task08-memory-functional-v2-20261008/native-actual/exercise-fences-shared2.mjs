import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied,waitUntil} from './common.mjs';
const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},records=[],outcomes=[];
const candidate=JSON.parse(await readFile(join(q,process.argv[2]??'installed-task08-source-manifest2.json')));
async function call(label,kind,name,args,client=c.admin){const started=Date.now();try{const result=await client[kind](name,args);records.push({label,kind,function:name,args,result,elapsedMs:Date.now()-started});await c.publish('fences-shared2-calls',{operation,candidate:candidate.manifestSha256,records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error),elapsedMs:Date.now()-started});await c.publish('fences-shared2-calls',{operation,candidate:candidate.manifestSha256,records});throw error;}}
async function check(name,fn){try{outcomes.push({name,status:'PASS',evidence:await fn()});}catch(error){outcomes.push({name,status:'FAIL',error:c.publicError(error)});throw error;}finally{await c.publish('fences-shared2-outcomes',{operation,candidate:candidate.manifestSha256,outcomes});}}
const state=()=>c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,...scope});
const lease=value=>({reference:value.reference,eventId:value.eventId,stage:value.stage,attempt:value.attempt,leaseVersion:value.leaseVersion});
const controlCode=e=>e.data?.code??e.message;
async function seed(reference,label,text,role){return (await call(label+'-seed','mutation','ingestionQualification:seedSources',{reference,prefix:operation+'-'+label,texts:[text],...(role?{role}:{})}))[0];}
async function provision(subject,access='space'){const full=await call(subject+'-grant','mutation','runtimeAuth:provision',{issuer:c.auth.issuer,subject,actorKind:'user',tenantId:c.tenantId,...scope,capabilities:['read','write','run','admin','tool'],resourceAccess:access});return Object.fromEntries(['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'].map(key=>[key,full[key]]));}
try{
 await c.verifyTarget("fences-shared2-shared2-target-verified");
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
 const beforeEdit=await state(),priorVectors=beforeEdit.runtimeMemoryVectors.filter(v=>v.sourceId===newEvent.lineage.sourceId&&v.sourceRevision===3);
 current=await editor.query('runtimeTranscript:get',selector);
 await call('indexed-source-edit','mutation','ingestionQualification:editHeld',{...selector,expectedRevision:current.historyRevision,messageId:pin.nativeMessageId,expectedMessageRevision:3,parts:[{type:'text',text:'The shared source owner now prefers lotus tea.'}]},editor);
 const editState=await state(),repairEvent=editState.runtimeIngestionEvents.find(e=>e.nativeMessageId===pin.nativeMessageId&&e.lineage.sourceRevision===4);assert.ok(repairEvent);
 const staleFacts=await call('edited-source-visible-facts','query','runtimeMemory:readFacts',{reference:editorRef,capability:'read',query:{limit:100}});
 assert.equal(staleFacts.filter(f=>f.lineage.sourceId===newEvent.lineage.sourceId).length,0);
 const staleVectors=await call('edited-source-visible-vectors','query','runtimeMemory:readVectorMatches',{reference:editorRef,capability:'read',hits:priorVectors.map(v=>({id:v._id,score:1}))});assert.equal(staleVectors.length,0);
 const pendingRepair=await editor.query('runtimeIngestion:status',{...scope,eventId:repairEvent.eventId});assert.equal(pendingRepair.stages.find(s=>s.stage==='extract').state,'pending');
 await call('edited-source-repair-extract','action','ingestionQualification:release',{reference:editorRef,eventId:repairEvent.eventId,stage:'extract'});
 await waitUntil('edited source repair indexing',()=>editor.query('runtimeIngestion:status',{...scope,eventId:repairEvent.eventId}),v=>v.stages.every(s=>['complete','skipped'].includes(s.state)),{timeoutMs:120000,pollMs:400});
 await check('tracked indexed-source edit excludes old facts and vectors until the current revision repairs',async()=>{
  const s=await state();assert.ok(s.runtimeMemoryVectors.some(v=>v.sourceId===repairEvent.lineage.sourceId&&v.sourceRevision===4&&v.dimensions===1536));
  return {oldRevision:3,currentRevision:4,oldFactsHidden:true,oldVectorsHidden:true,currentRepairComplete:true};});
 current=await editor.query('runtimeTranscript:get',selector);await call('shared-remove','mutation','runtimeTranscript:removeMessage',{...selector,expectedRevision:current.historyRevision,messageId:pin.nativeMessageId,expectedMessageRevision:4},editor);
 const lateAfterRemove=await denied(()=>call('deleted-current-stage-denied','mutation','runtimeIngestion:claim',{reference:editorRef,eventId:repairEvent.eventId,stage:'vectors'}));
 const visible=await call('post-delete-visible-facts','query','runtimeMemory:readFacts',{reference:editorRef,capability:'read',query:{limit:100}});
 assert.equal(visible.filter(f=>f.lineage.sourceId===newEvent.lineage.sourceId).length,0);
 await call('editor-grant-revoked','mutation','runtimeAuth:revokeGrant',{grantId:editorRef.grantId});
 const beforeRevoked=await state(),revoked=await denied(()=>call('revoked-worker-denied','mutation','runtimeIngestion:claim',{reference:editorRef,eventId:repairEvent.eventId,stage:'extract'}));assert.equal(controlCode(revoked),'FORBIDDEN');assert.equal((await state()).runtimeModelAttempts.length,beforeRevoked.runtimeModelAttempts.length);
 await check('current deletion excludes derived facts and revoked grant blocks any late claim before dispatch',async()=>({lateAfterRemove:c.publicError(lateAfterRemove),revoked:c.publicError(revoked),visibleFactsFromDeletedSource:0,modelAttemptsUnchanged:true}));
 await c.publish('fences-shared2-final-native-state',await state());await c.publish('fences-shared2-final',{status:'PASS',operation,outcomes,nativeMutationFailuresInjected:true,noUncontrolledRetry:true,actualSharedEditorInference:true});
}finally{await c.close();await c.publish('fences-shared2-cleanup',{ownedClientsClosed:true,noReactiveClients:true});}
