import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,qa,waitUntil} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
try{
 const prior=JSON.parse(await readFile(join(qa,'controls4-strict-overflow-calls.json'))).records;
 const strict=prior.find(row=>row.label==='strict-failed-hole-held-submit').result;
 const overflow=prior.find(row=>row.label==='overflow-held-submit').result;
 const observe=runId=>c.owner.query('runtimeAgent:observe',{...scope,runId});
 const strictFinal=await waitUntil('existing strict terminal readback',()=>observe(strict.runId),row=>['failed','cancelled','complete','unknown'].includes(row.state),{timeoutMs:15000});
 const overflowFinal=await waitUntil('existing overflow terminal readback',()=>observe(overflow.runId),row=>['failed','cancelled','complete','unknown'].includes(row.state),{timeoutMs:15000});
 assert.equal(strictFinal.state,'failed');assert.match(strictFinal.run.failureCode??strictFinal.run.contextFailureCode??'',/BARRIER|MEMORY|INGESTION/);
 assert.equal(overflowFinal.state,'failed');assert.equal(overflowFinal.run.failureCode,'CONTEXT_LIMIT_EXCEEDED');
 const state=await c.admin.query('ingestionQualification:state',scope);
 const runs=state.runtimeRuns.filter(row=>[strict.runId,overflow.runId].includes(row.runId));assert.equal(runs.length,2);
 const paid=state.runtimeModelOperations.filter(row=>runs.some(run=>run.runAccountId===row.runAccountId));assert.equal(paid.length,0);
 const injected=prior.find(row=>row.label==='mark-earlier-held-extraction-failed').args;
 const event=state.runtimeIngestionEvents.find(row=>row.eventId===injected.eventId),stage=state.runtimeIngestionStages.find(row=>row.eventId===injected.eventId&&row.stage==='extract');
 assert.equal(stage.state,'failed');const later=state.runtimeIngestionEvents.find(row=>row.sequence>event.sequence&&state.runtimeIngestionStages.some(stage=>stage.eventId===row.eventId&&stage.stage==='facts'&&['complete','skipped'].includes(stage.state)));assert.ok(later);
 const result={status:'PASS_EXISTING_UNPAID_BARRIER_OVERFLOW',priorFailure:'controls4-strict-overflow-failure.json: overflow asynchronous state sampled as not_started; no restart or new submission',
  injectedEarlierFailure:{eventId:event.eventId,sequence:event.sequence,stage},laterCompletedEvent:{eventId:later.eventId,sequence:later.sequence},
  strictHandle:strict,strictFinal,overflowHandle:overflow,overflowFinal,paidOperationsForBoth:paid.length,
  sourceScope:'installed-task09-source-manifest5.json',noModelInvocation:true,noRunRestart:true,noNewSubmission:true};
 await c.publish('controls8-existing-barrier-readback',result);
 console.log(JSON.stringify({status:result.status,strictRunId:strict.runId,strictFailureCode:strictFinal.run.failureCode,overflowRunId:overflow.runId,overflowFailureCode:overflowFinal.run.failureCode,paidOperations:paid.length}));
}catch(error){await c.publish('controls8-existing-barrier-failure',{status:'FAIL',error:c.publicError(error)});throw error;}
finally{const errors=[];try{await c.close();}catch(error){errors.push(c.publicError(error));}await c.publish('controls8-existing-barrier-cleanup',{allOwnedClientsCloseAttempted:true,errors});}
