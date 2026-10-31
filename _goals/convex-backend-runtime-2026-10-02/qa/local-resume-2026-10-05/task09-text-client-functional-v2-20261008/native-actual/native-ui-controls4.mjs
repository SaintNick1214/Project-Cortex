import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,qa,waitUntil} from './common.mjs';
const mode=process.argv[2];assert.ok(['prepare-approval','prepare-cancel','strict-overflow'].includes(mode));
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const setup=JSON.parse(await readFile(join(qa,'owned-prerequisites1.json'))),operation=c.pointer.operation,records=[];
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>c.token('cortex-owner')});
const state=()=>c.admin.query('ingestionQualification:state',scope);
async function call(label,kind,name,args,http=c.owner){try{const result=await http[kind](name,args);records.push({label,kind,function:name,args,result});await c.publish('controls4-'+mode+'-calls',{records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error)});await c.publish('controls4-'+mode+'-calls',{records});throw error;}}
async function submit(definition,suffix,text){const request={version:1,agentId:definition.agentId,agentVersion:1,clientRequestId:'task09-'+suffix+'-'+operation,parts:[{type:'text',text}]};
 const result=await call(suffix+'-held-submit','mutation','ingestionQualification:submitHeld',{request});return await client.attach(result.runId);}
try{
 await c.verifyTarget('controls4-'+mode+'-target-verified');
 if(mode==='prepare-approval'){
  const before=await state();const handle=await submit(setup.definitions.approval,'approval','Please retrieve my project codeword with memory_recall after I explicitly approve the tool.');
  await client.start(handle,{streaming:true});
  const waiting=await waitUntil('explicit native tool approval',()=>client.observe(handle),value=>value.state==='waiting_approval'||['failed','unknown','cancelled','complete'].includes(value.state),{timeoutMs:120000});
  assert.equal(waiting.state,'waiting_approval',JSON.stringify(waiting));assert.ok(waiting.approvals.length);
  const current=await state();await c.publish('controls4-approval-ready',{status:'WAITING_ACTUAL_UI_APPROVAL',handle,waiting,beforeAttemptCount:before.runtimeModelAttempts.length,
   currentAttemptCount:current.runtimeModelAttempts.length,toolResultNotYetVisible:true,deadline:'original active lease; UI must approve within five minutes',originalUnknownNotRetried:true});
  console.log(JSON.stringify({status:'WAITING_ACTUAL_UI_APPROVAL',handle,approvals:waiting.approvals}));
 }else if(mode==='prepare-cancel'){
  const before=await state(),handle=await submit(setup.definitions.tool,'cancel','This queued input is for cancellation before execution; do not start it.');
  const queued=await client.get(handle),after=await state();assert.equal(queued.responseStatus,'queued');assert.equal(after.runtimeModelAttempts.length,before.runtimeModelAttempts.length);
  await c.publish('controls4-cancel-ready',{status:'QUEUED_FOR_ACTUAL_UI_CANCEL',handle,queued,beforeAttemptCount:before.runtimeModelAttempts.length,afterAttemptCount:after.runtimeModelAttempts.length,executionNotStarted:true});
  console.log(JSON.stringify({status:'QUEUED_FOR_ACTUAL_UI_CANCEL',handle}));
 }else{
  const before=await state(),old=JSON.parse(await readFile(join(qa,'native2-calls.json'))).records.find(row=>row.label==='held-initial-tool-turn').result;
  const event=before.runtimeIngestionEvents.find(row=>row.runId===old.runId&&row.lineage.role==='user');assert.ok(event);
  const source=before.runtimeIngestionStages.find(row=>row.eventId===event.eventId&&row.stage==='extract');assert.equal(source.state,'pending');assert.equal(source.attempt,0);
  const later=before.runtimeIngestionEvents.filter(row=>row.sequence>event.sequence).find(row=>before.runtimeIngestionStages.some(stage=>stage.eventId===row.eventId&&stage.stage==='facts'&&['complete','skipped'].includes(stage.state)));
  assert.ok(later,'Need an actual later completed/skipped facts stage for the contiguous-hole assertion');
  const reference=await call('current-reference','query','ingestionQualification:reference',{memorySpaceId:c.memorySpaceId});
  await call('mark-earlier-held-extraction-failed','mutation','runtimeIngestion:failUnclaimed',{reference,eventId:event.eventId,stage:'extract'},c.admin);
  const strict=await submit(setup.definitions.strict,'strict-failed-hole','Require facts readiness across all earlier accepted inputs; the earlier failed stage must not be skipped.');
  await client.start(strict,{streaming:true});const strictFinal=await waitUntil('strict failed earlier-stage barrier',()=>client.observe(strict),value=>['complete','failed','unknown','cancelled'].includes(value.state),{timeoutMs:15000});
  assert.equal(strictFinal.state,'failed');assert.match(strictFinal.run.failureCode??strictFinal.run.contextFailureCode??'',/BARRIER|MEMORY|INGESTION/);
  const postStrict=await state();assert.equal(postStrict.runtimeModelAttempts.length,before.runtimeModelAttempts.length,'Strict barrier must deny before paid effects');
  const overflow=await submit(setup.definitions.history,'overflow','Large context without model execution: '+('context-bound '.repeat(500)));
  await client.start(overflow,{streaming:true});const overflowFinal=await client.observe(overflow);
  assert.equal(overflowFinal.state,'failed');assert.equal(overflowFinal.run.failureCode,'CONTEXT_LIMIT_EXCEEDED');
  const after=await state();assert.equal(after.runtimeModelAttempts.length,before.runtimeModelAttempts.length,'Context overflow must deny before paid effects');
  await c.publish('controls4-strict-overflow',{status:'PASS',earlierFailedEventId:event.eventId,earlierSequence:event.sequence,laterCompletedEventId:later.eventId,laterSequence:later.sequence,
   strictHandle:strict,strictFinal,overflowHandle:overflow,overflowFinal,attemptCounts:{before:before.runtimeModelAttempts.length,after:after.runtimeModelAttempts.length},noAddedPaidDispatch:true});
  console.log(JSON.stringify({status:'PASS',strictRunId:strict.runId,overflowRunId:overflow.runId,additionalPaidDispatch:0}));
 }
}catch(error){await c.publish('controls4-'+mode+'-failure',{status:'FAIL',error:c.publicError(error),records});throw error;}
finally{const errors=[];try{await client.close();}catch(error){errors.push(c.publicError(error));}try{await c.close();}catch(error){errors.push(c.publicError(error));}
 await c.publish('controls4-'+mode+'-client-cleanup',{allOwnedClientsCloseAttempted:true,errors});if(errors.length)throw new AggregateError(errors,'Owned Task09 clients close failed');}
