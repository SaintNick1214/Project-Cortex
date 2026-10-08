import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied,waitUntil} from './common.mjs';
const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},records=[],outcomes=[];
const candidate=JSON.parse(await readFile(join(q,process.argv[2]??'installed-task08-source-manifest2.json')));
async function call(label,kind,name,args,client=c.admin){const started=Date.now();try{const result=await client[kind](name,args);records.push({label,kind,function:name,args,result,elapsedMs:Date.now()-started});await c.publish('ordering-calls',{operation,candidate:candidate.manifestSha256,records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error),elapsedMs:Date.now()-started});await c.publish('ordering-calls',{operation,candidate:candidate.manifestSha256,records});throw error;}}
async function check(name,fn){try{outcomes.push({name,status:'PASS',evidence:await fn()});}catch(error){outcomes.push({name,status:'FAIL',error:c.publicError(error)});throw error;}finally{await c.publish('ordering-outcomes',{operation,candidate:candidate.manifestSha256,outcomes});}}
const state=()=>c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,...scope});
const lease=plan=>({reference:plan.reference,eventId:plan.eventId,stage:plan.stage,attempt:plan.attempt,leaseVersion:plan.leaseVersion});
async function seeded(reference,label,text){const result=await call(label+'-seed','mutation','ingestionQualification:seedSources',{reference,prefix:operation+'-'+label,texts:[text]});await waitUntil(label+' durable hold',()=>c.admin.query('ingestionQualification:held',{reference,eventId:result[0].eventId,stage:'extract'}),Boolean,{timeoutMs:10000});return result[0];}
async function extractedPlan(reference,event,label){await call(label+'-actual-extract','action','ingestionQualification:releaseExtractHeld',{reference,eventId:event.eventId,stage:'extract'});
 const status=await c.owner.query('runtimeIngestion:status',{...scope,eventId:event.eventId});assert.equal(status.stages.find(s=>s.stage==='extract').state,'complete');assert.equal(status.stages.find(s=>s.stage==='facts').state,'pending');
 return await call(label+'-native-plan','mutation','ingestionQualification:preparePlan',{reference,eventId:event.eventId});}
try{
 await c.verifyTarget('ordering-target-verified');const reference=await c.owner.query('ingestionQualification:reference',scope);
 const old=await seeded(reference,'older','Task08 order tester has favorite drink tea.'),newer=await seeded(reference,'newer','Task08 order tester has favorite drink coffee. This corrects the earlier favorite drink tea.');
 const oldPlan=await extractedPlan(reference,old,'older'),newPlan=await extractedPlan(reference,newer,'newer');
 const oldBody=JSON.parse(oldPlan.planCanonical),newBody=JSON.parse(newPlan.planCanonical);assert.ok(oldBody.entries.length);assert.ok(newBody.entries.length);
 assert.ok(oldBody.entries.some(a=>newBody.entries.some(b=>b.slotKey===a.slotKey)),'Actual extraction must expose a shared correction slot; do not infer an ordering proof from unrelated slots');
 const winner=await call('newer-commit-first','mutation','ingestionQualification:commitPlan',newPlan),afterWinner=await state();
 const stale=await denied(()=>call('older-stale-cas','mutation','ingestionQualification:commitPlan',oldPlan));assert.equal(stale.data?.code,'FACT_VERSION_CONFLICT');
 const refreshed=await call('older-current-read-set-same-lease','mutation','ingestionQualification:replanOwned',lease(oldPlan));
 const reversed=await denied(()=>call('older-order-fence','mutation','ingestionQualification:commitPlan',refreshed));assert.equal(reversed.data?.code,'BELIEF_ORDER_CONFLICT');
 await check('newer correction wins; stale CAS and recomputed older completion cannot restore it',async()=>{
  const after=await state();assert.deepEqual(after.runtimeBeliefHistory,afterWinner.runtimeBeliefHistory);assert.deepEqual(after.runtimeBeliefOutbox,afterWinner.runtimeBeliefOutbox);assert.deepEqual(after.facts,afterWinner.facts);
  assert.ok(after.runtimeBeliefHeads.some(h=>h.eventId===newer.eventId));return {newerReceipt:winner.receiptId,olderSequence:old.sequence,newerSequence:newer.sequence,stale:c.publicError(stale),reversed:c.publicError(reversed)};});
 await call('duplicate-facts-worker','action','runtimeIngestion:processStage',{reference,eventId:newer.eventId,stage:'facts'});const afterDuplicate=await state();assert.deepEqual(afterDuplicate.runtimeBeliefHistory,afterWinner.runtimeBeliefHistory);assert.equal(afterDuplicate.runtimeModelAttempts.length,afterWinner.runtimeModelAttempts.length);
 const casEvent=await seeded(reference,'cas','Task08 order tester has favorite drink cocoa. This corrects the earlier favorite drink coffee.'),casPlan=await extractedPlan(reference,casEvent,'cas');
 const casBody=JSON.parse(casPlan.planCanonical),target=casBody.entries.find(x=>x.targetFactId);assert.ok(target,'Meaningful CAS requires an existing correction target');
 await call('concurrent-native-writer','mutation','ingestionQualification:bumpFact',{reference,factId:target.targetFactId,expectedVersion:casBody.expectedVersions[target.targetFactId]});
 const beforeCas=await state(),conflict=await denied(()=>call('cas-stale-commit','mutation','ingestionQualification:commitPlan',casPlan));assert.equal(conflict.data?.code,'FACT_VERSION_CONFLICT');
 await call('cas-positive-draft-interrupted','mutation','runtimeIngestion:failStage',{...lease(casPlan),uncertain:true,failureCode:'CONTROLLED_SAVE_GAP'});
 const replan=await call('cas-saved-draft-reconcile','mutation','runtimeIngestion:reconcile',{...scope,eventId:casEvent.eventId,stage:'facts'},c.owner);
 await check('concurrent native change is atomic and saved stale draft requests replan without dispatch',async()=>{
  assert.equal(replan.reconciled,false);assert.equal(replan.failureCode,'REPLAN_REQUIRED');const after=await state();assert.deepEqual(after.runtimeBeliefHistory,beforeCas.runtimeBeliefHistory);assert.deepEqual(after.runtimeBeliefOutbox,beforeCas.runtimeBeliefOutbox);assert.equal(after.runtimeModelAttempts.length,beforeCas.runtimeModelAttempts.length);
  return {conflict:c.publicError(conflict),replan,paidAttemptsUnchanged:true};});
 const recovery=await seeded(reference,'recovery','The Task08 recovery fixture launch code is MARIGOLD.'),recoveryPlan=await extractedPlan(reference,recovery,'recovery');
 await call('confirmed-draft-gap','mutation','runtimeIngestion:failStage',{...lease(recoveryPlan),uncertain:true,failureCode:'CONTROLLED_CONFIRMED_PLAN_SAVE_GAP'});
 const beforeRecovery=await state(),first=await call('positive-draft-reconcile','mutation','runtimeIngestion:reconcile',{...scope,eventId:recovery.eventId,stage:'facts'},c.owner),again=await call('positive-draft-repeat','mutation','runtimeIngestion:reconcile',{...scope,eventId:recovery.eventId,stage:'facts'},c.owner);
 await check('confirmed durable facts draft reconciles exactly once without repeated extraction or resolution',async()=>{
  assert.equal(first.reconciled,true);assert.equal(first.receiptId,again.receiptId);const after=await state();assert.equal(after.runtimeBeliefOutbox.filter(x=>x.eventId===recovery.eventId).length,1);assert.equal(after.runtimeBeliefHistory.filter(x=>x.eventId===recovery.eventId).length,JSON.parse(recoveryPlan.planCanonical).entries.length);
  const ids=new Set(beforeRecovery.runtimeModelOperations.filter(x=>x.runAccountId===beforeRecovery.runtimeIngestionJobs.find(j=>j.eventId===recovery.eventId).runAccountId&&x.operationKey!=='embedding.memory').map(x=>x._id));
  assert.equal(after.runtimeModelAttempts.filter(x=>ids.has(x.operationDocumentId)).length,beforeRecovery.runtimeModelAttempts.filter(x=>ids.has(x.operationDocumentId)).length);
  return {receiptId:first.receiptId,oneHistoryAndOutbox:true,noRepeatedExtractOrResolve:true,vectorFollowupMayDispatchOnce:true};});
 await c.publish('ordering-final-native-state',await state());await c.publish('ordering-final',{status:'PASS',operation,outcomes,actualExtraction:true,conflictDecisions:'fixture-controlled native plan data; no provider conflict-resolution qualification claim',nativeConcurrentWriterInjected:true});
}finally{await c.close();await c.publish('ordering-cleanup',{ownedClientsClosed:true,noReactiveClients:true});}
