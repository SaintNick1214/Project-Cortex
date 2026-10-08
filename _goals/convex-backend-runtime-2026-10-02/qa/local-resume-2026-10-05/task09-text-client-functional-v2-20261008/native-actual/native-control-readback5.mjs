import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,qa,waitUntil} from './common.mjs';
const mode=process.argv[2];assert.ok(['approval','cancel'].includes(mode));
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const ready=JSON.parse(await readFile(join(qa,'controls4-'+mode+'-ready.json')));
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>c.token('cortex-owner')});
try{
 const handle=await client.attach(ready.handle.runId);assert.deepEqual(handle,ready.handle);
 const observation=await waitUntil('actual UI '+mode+' terminal',()=>client.observe(handle),value=>['complete','failed','unknown','cancelled'].includes(value.state),{timeoutMs:120000});
 const state=await c.admin.query('ingestionQualification:state',scope),run=state.runtimeRuns.find(row=>row.runId===handle.runId),execution=state.runtimeAgentExecutions.find(row=>row.runId===handle.runId);
 let evidence;
 if(mode==='approval'){
  assert.equal(observation.state,'complete');assert.equal(ready.waiting.state,'waiting_approval');assert.ok(ready.waiting.approvals.length);
  assert.equal(ready.waiting.parts.some(row=>row.part.type==='tool'&&row.part.phase==='succeeded'),false);
  const tools=observation.parts.filter(row=>row.part.type==='tool'),text=observation.parts.filter(row=>row.part.type==='text').map(row=>row.part.text).join('');
  assert.ok(tools.some(row=>row.part.phase==='approved'));assert.ok(tools.some(row=>row.part.phase==='succeeded'));assert.match(text,/LANTERN_7ae8d289/);
  assert.equal(run.responseStatus,'complete');assert.equal(execution.finalMessageIds.length,1);assert.ok(execution.ingestionReceiptId);
  const before=state.runtimeModelAttempts.map(row=>row._id).sort();const replay=await c.owner.mutation('runtimeAgent:reconcile',{...scope,runId:handle.runId});assert.equal(replay.receiptId,execution.ingestionReceiptId);
  const after=await c.admin.query('ingestionQualification:state',scope);assert.deepEqual(after.runtimeModelAttempts.map(row=>row._id).sort(),before);
  evidence={text,tools,execution,replay,oneFinalTranscript:execution.finalMessageIds,oneIngestionIdentity:execution.ingestionReceiptId,reconcileAdditionalPaidAttempts:0};
 }else{
  assert.equal(observation.state,'cancelled');assert.equal(run.responseStatus,'cancelled');assert.equal(run.outputMessageIds.length,0);assert.equal(run.attemptNumber,0);
  const operations=state.runtimeModelOperations.filter(row=>row.runAccountId===run.runAccountId);assert.equal(operations.length,0);
  const account=state.runtimeBudgetAccounts.find(row=>row._id===run.runAccountId);assert.ok(account);assert.equal(account.cancelled,true);assert.equal(account.activeConcurrency,0);assert.equal(account.reservedUnits,0);
  assert.equal(ready.executionNotStarted,true);evidence={cancelled:true,attemptNumber:0,outputMessages:0,paidOperations:0,scopeBoundBudgetRetired:true,budgetAccount:account};
 }
 const result={status:'PASS_ACTUAL_UI_'+mode.toUpperCase(),handle,observation,run,evidence,sourceScope:'installed-task09-source-manifest4.json',nativeCalls:'read/observe plus completed approval reconcile only; no model dispatch from this script'};
 await c.publish('controls5-'+mode+'-readback',result);console.log(JSON.stringify({status:result.status,runId:handle.runId,state:observation.state}));
}catch(error){await c.publish('controls5-'+mode+'-failure',{status:'FAIL',error:c.publicError(error)});throw error;}
finally{const errors=[];try{await client.close();}catch(error){errors.push(c.publicError(error));}try{await c.close();}catch(error){errors.push(c.publicError(error));}
 await c.publish('controls5-'+mode+'-client-cleanup',{allOwnedClientsCloseAttempted:true,errors});if(errors.length)throw new AggregateError(errors,'Owned Task09 clients close failed');}
