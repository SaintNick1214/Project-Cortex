import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,waitUntil,denied} from './common.mjs';

const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},ownedRuns=[],records=[],outcomes=[];
const candidate=JSON.parse(await readFile(join(q,process.argv[2]??'installed-task08-source-manifest2.json')));
assert.equal(candidate.projectId,c.state.projectId);
async function call(label,kind,name,args,client=c.owner){const start=Date.now();try{const result=await client[kind](name,args);records.push({label,kind,function:name,args,result,elapsedMs:Date.now()-start});await c.publish('delayed-calls',{operation,candidate:candidate.manifestSha256,records});return result;}
 catch(error){records.push({label,kind,function:name,args,error:c.publicError(error),elapsedMs:Date.now()-start});await c.publish('delayed-calls',{operation,candidate:candidate.manifestSha256,records});throw error;}}
async function check(name,fn){try{outcomes.push({name,status:'PASS',evidence:await fn()});}catch(error){outcomes.push({name,status:'FAIL',error:c.publicError(error)});throw error;}finally{await c.publish('delayed-outcomes',{operation,projectId:c.state.projectId,candidate:candidate.manifestSha256,outcomes});}}
const state=()=>c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,...scope});
async function define(label,instructions,context={},client=c.owner){const registryHash=await c.admin.query('ingestionQualification:registryHash',{});
 return await call(label,'mutation','agentDefinitions:publishVersion',{...scope,clientMutationId:operation+'-'+label,expectedPreviousVersion:0,definitionInput:{
  instructions:{text:instructions,promptVersion:'task08-native-functional-v1'},tools:[],
  context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash,memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:4096,...context},
  policies:[{policyId:'task08-native-bounded-'+label,version:1,operationKey:'agent.respond',rules:{limits:{outputTokens:128,toolSteps:0}}}]}},client);}
async function submit(label,definition,text,conversationId,client=c.owner){const result=await call(label,'mutation','ingestionQualification:submitHeld',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,clientRequestId:operation+'-'+label,...(conversationId?{conversationId}:{}),parts:[{type:'text',text}]}},client);ownedRuns.push({runId:result.runId,client});return result;}
async function finish(label,run){await call(label+'-start','mutation','runtimeAgent:start',{...scope,runId:run.runId,streaming:true});
 const finished=await waitUntil(label+' final',()=>c.owner.query('runtimeAgent:observe',{...scope,runId:run.runId,finalOnly:true}),v=>['complete','failed','unknown','cancelled'].includes(v.state),{timeoutMs:120000,pollMs:400});assert.equal(finished.state,'complete',JSON.stringify(finished));await c.publish(label+'-final',finished);return finished;}
const eventFor=(s,run)=>s.runtimeIngestionEvents.find(e=>e.runId===run.runId&&e.lineage.role==='user');
try{
 await c.verifyTarget('delayed-target-verified');
 const reference=await call('reference','query','ingestionQualification:reference',scope);
 const privateOtherSubject='task08-private-other-'+operation,other=c.http(privateOtherSubject);
 const otherReference=await call('other-private-owner','mutation','runtimeAuth:provision',{issuer:c.auth.issuer,subject:privateOtherSubject,actorKind:'user',tenantId:c.tenantId,...scope,capabilities:['read','write','run','admin','tool'],resourceAccess:'space'},c.admin);
 const otherDef=await define('other-private-definition','Do not execute; this fixture remains queued.',{},other);
 const otherRun=await submit('other-private-input',otherDef,'PRIVATE_OTHER_OWNER_DO_NOT_INCLUDE_'+operation,undefined,other);
 const codeword='KUMQUAT_'+operation.slice(0,8),definition=await define('pending-definition','If the user states a codeword, acknowledge CORTEX_MEMORY_PENDING_OK. If asked for the codeword, answer only the exact codeword from approved conversation history. Do not invoke tools.');
 const a=await submit('turn-a',definition,'My codeword is '+codeword+'. Acknowledge it.');
 const aFinished=await finish('turn-a',a),beforeB=await state(),aEvent=eventFor(beforeB,a);assert.ok(aEvent);
 await check('response is final while its real source extraction is deliberately held',async()=>{
  const stages=beforeB.runtimeIngestionStages.filter(s=>s.eventId===aEvent.eventId);assert.equal(stages.find(s=>s.stage==='extract').state,'pending');assert.equal(stages.find(s=>s.stage==='extract').attempt,0);
  assert.equal(aFinished.run.responseStatus,'complete');assert.equal(aFinished.run.memoryStatus,'pending');return {runId:a.runId,eventId:aEvent.eventId,sequence:aEvent.sequence,extractAttempt:0,responseFinal:true,indexingPending:true};});
 const b=await submit('turn-b',definition,'What is my codeword?',a.conversationId),bFinished=await finish('turn-b',b);
 await check('next same-thread response reads unprocessed approved history',async()=>{const text=bFinished.parts.filter(x=>x.part.type==='text').map(x=>x.part.text).join('');assert.match(text,new RegExp(codeword));const s=await state();assert.equal(s.runtimeIngestionStages.find(x=>x.eventId===aEvent.eventId&&x.stage==='extract').state,'pending');return {runId:b.runId,answer:text,priorExtractStillPending:true};});
 const current=await state(),cutoff=Math.max(...current.runtimeIngestionEvents.map(e=>e.sequence));
 const pending=await call('cross-thread-pending','query','runtimeMemoryContext:pendingContext',{reference,cutoff,alreadyRepresented:[],maxBytes:8192},c.admin);
 await check('cross-thread context includes current authorized pending sources and excludes another private owner',async()=>{
  assert.equal(pending.completeness,'complete');assert.match(pending.text,new RegExp(codeword));assert.ok(!pending.text.includes('PRIVATE_OTHER_OWNER_DO_NOT_INCLUDE'));assert.ok(!pending.sources.some(x=>x.sourceId===eventFor(current,otherRun).lineage.sourceId));return {sources:pending.sources,otherOwner:otherReference.principalId,privateResourceExcluded:true};});
 const overflow=await call('byte-overflow','query','runtimeMemoryContext:pendingContext',{reference,cutoff,alreadyRepresented:[],maxBytes:1},c.admin);
 assert.equal(overflow.completeness,'incomplete');assert.equal(overflow.reason,'CONTEXT_OVERFLOW');assert.equal(overflow.text,'');assert.deepEqual(overflow.sources,[]);
 const status=await call('hole-status','query','runtimeMemoryContext:status',scope);
 await check('stage watermark never jumps a held earlier event despite later assistant completion',async()=>{
  assert.equal(status.stages.facts.complete,false);assert.equal(status.stages.facts.indexedThrough,0);assert.equal(status.stages.facts.hole.sequence,1);
  const s=await state();assert.ok(s.runtimeIngestionEvents.some(e=>e.sequence>aEvent.sequence&&e.lineage.role==='assistant'&&e.factsState==='skipped'));
  return {facts:status.stages.facts,vectors:status.stages.vectors,laterTrustedSkippedReceipt:true,byteOverflow:overflow};});
 const strict=await define('strict-definition','This strict run must wait for indexed facts. If allowed, say STRICT_UNEXPECTED.',{memoryMode:'strict',requiredStages:['facts'],barrier:{deadlineMs:1200,onFailure:'fail'}});
 const strictRun=await submit('strict-input',strict,'Do not answer before required memory is ready.');
 await call('strict-start','mutation','runtimeAgent:start',{...scope,runId:strictRun.runId});
 const strictFinal=await waitUntil('strict bounded memory barrier',()=>c.owner.query('runtimeAgent:observe',{...scope,runId:strictRun.runId}),v=>['failed','unknown'].includes(v.state),{timeoutMs:15000,pollMs:250});
 await check('strict persisted deadline fails before model dispatch across the pending hole',async()=>{
  const s=await state(),row=s.runtimeRuns.find(x=>x.runId===strictRun.runId),execution=s.runtimeAgentExecutions.find(x=>x.runId===strictRun.runId);
  assert.equal(row.failureCode,'MEMORY_BARRIER_TIMEOUT');assert.ok(execution.barrierStartedAt);assert.equal(s.runtimeModelOperations.filter(op=>op.runAccountId===row.runAccountId).length,0);
  return {response:strictFinal.state,failureCode:row.failureCode,barrierStartedAt:execution.barrierStartedAt,noModelDispatch:true};});
 const releasedAt=Date.now();await call('release-turn-a-extraction','action','ingestionQualification:release',{reference,eventId:aEvent.eventId,stage:'extract'},c.admin);
 const indexed=await waitUntil('actual governed source stages',()=>c.owner.query('runtimeIngestion:status',{...scope,eventId:aEvent.eventId}),v=>v.stages.every(x=>['complete','skipped'].includes(x.state)),{timeoutMs:120000,pollMs:400});
 const green=await state();await c.publish('delayed-indexed-native-state',green);
 await check('released actual job produces pinned facts/chunks/default1536 vectors under a separate budget',async()=>{
  const vectors=green.runtimeMemoryVectors.filter(x=>x.sourceId===aEvent.lineage.sourceId&&x.sourceRevision===aEvent.lineage.sourceRevision);assert.ok(vectors.length);
  for(const vector of vectors){assert.equal(vector.dimensions,1536);assert.equal(vector.profile.dimensions,1536);assert.equal(vector.finite,true);assert.equal(vector.sourceEventId,aEvent.lineage.sourceEventId);assert.ok(green.runtimeMemoryChunks.some(x=>x.chunkId===vector.chunkId&&x.textHash));}
  const run=green.runtimeRuns.find(x=>x.runId===a.runId),job=green.runtimeIngestionJobs.find(x=>x.eventId===aEvent.eventId);assert.ok(job);assert.notEqual(job.runBudgetId,run.runBudgetId);
  const ops=green.runtimeModelOperations.filter(op=>op.runAccountId===job.runAccountId);assert.ok(ops.some(op=>op.operationKey==='memory.extract'));assert.ok(ops.some(op=>op.operationKey==='embedding.memory'&&op.parentOperationId));
  return {eventId:aEvent.eventId,indexed,elapsedFromReleaseMs:Date.now()-releasedAt,vectors:vectors.length,dimensions:1536,separateIngestionBudget:true};});
 const beforeReplay=await state();await call('duplicate-worker','action','runtimeIngestion:processStage',{reference,eventId:aEvent.eventId,stage:'extract'},c.admin);
 const duplicate=await call('duplicate-complete-reconcile','mutation','runtimeIngestion:reconcile',{...scope,eventId:aEvent.eventId,stage:'vectors'}),afterReplay=await state();
 assert.equal(afterReplay.runtimeModelAttempts.length,beforeReplay.runtimeModelAttempts.length);assert.equal(afterReplay.runtimeBeliefHistory.length,beforeReplay.runtimeBeliefHistory.length);assert.equal(afterReplay.runtimeMemoryReceipts.length,beforeReplay.runtimeMemoryReceipts.length);
 const recalled=await call('default-profile-recall','action','runtimeMemory:recall',{...scope,requestId:'task08-query-'+operation,text:'my codeword '+codeword,limit:5});
 await check('completed native replay is deduplicated and query uses matching managed profile',async()=>{
  assert.equal(duplicate.reconciled,true);const text=JSON.stringify(recalled);assert.match(text,new RegExp(codeword));assert.ok(text.includes(aEvent.lineage.sourceId));return {replayReceipt:duplicate.receiptId,attemptsUnchanged:true,queryResult:recalled};});
 const tail=await call('oversized-tail-seed','mutation','ingestionQualification:seedSources',{reference,prefix:'task08-tail-'+operation,texts:Array.from({length:33},(_,i)=>'Authorized pending tail source '+i+' for the bounded native overflow check.')},c.admin);
 const tailState=await state(),tailCutoff=Math.max(...tailState.runtimeIngestionEvents.map(e=>e.sequence)),tailOverflow=await call('oversized-source-tail','query','runtimeMemoryContext:pendingContext',{reference,cutoff:tailCutoff,alreadyRepresented:[],maxBytes:16384},c.admin);
 await check('an oversized authorized tail is explicitly incomplete and never silently fresh',async()=>{
  assert.equal(tail.length,33);assert.equal(tailOverflow.completeness,'incomplete');assert.equal(tailOverflow.reason,'CONTEXT_OVERFLOW');assert.equal(tailOverflow.text,'');assert.deepEqual(tailOverflow.sources,[]);assert.ok(tailOverflow.withheldCount>32);return {created:33,tailOverflow,noExtractionDispatchedForOverflowFixture:true};});
 for(const client of [c.anonymous,c.foreign])await denied(()=>client.query('runtimeIngestion:status',{...scope,eventId:aEvent.eventId}));
 await c.publish('delayed-final',{status:'PASS',operation,candidate:candidate.manifestSha256,outcomes,actualGovernedInference:true,unknownCostRetained:true,remainingHeldEvents:green.task08HeldStages.map(x=>x.eventId)});
}finally{
 const errors=[];for(const owned of ownedRuns){try{const row=await owned.client.query('runs:get',{...scope,runId:owned.runId});if(!['complete','failed','cancelled'].includes(row.responseStatus))await owned.client.mutation('runtimeAgent:cancel',{...scope,runId:owned.runId});}catch(error){errors.push(c.publicError(error));}}
 try{await c.close();}catch(error){errors.push(c.publicError(error));}await c.publish('delayed-cleanup',{ownedRuns:ownedRuns.map(x=>x.runId),ownedClientsClosed:true,errors});if(errors.length)throw new AggregateError(errors,'Task08 owned cleanup failed');
}
