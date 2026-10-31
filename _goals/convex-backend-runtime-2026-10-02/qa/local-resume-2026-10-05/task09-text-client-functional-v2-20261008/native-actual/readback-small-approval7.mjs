import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,qa,waitUntil} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const ready=JSON.parse(await readFile(join(qa,'controls7-small-approval-ready.json')));
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>c.token('cortex-owner')});
const state=()=>c.admin.query('ingestionQualification:state',scope);
try{
 const handle=await client.attach(ready.handle.runId);
 const observation=await waitUntil('new actual UI approved continuation',()=>client.observe(handle),row=>['complete','failed','unknown','cancelled'].includes(row.state),{timeoutMs:120000});
 assert.equal(observation.state,'complete');const before=await state(),run=before.runtimeRuns.find(row=>row.runId===handle.runId),execution=before.runtimeAgentExecutions.find(row=>row.runId===handle.runId);
 const tools=observation.parts.filter(row=>row.part.type==='tool'),text=observation.parts.filter(row=>row.part.type==='text').map(row=>row.part.text).join('');
 assert.ok(tools.some(row=>row.part.phase==='approved'));assert.ok(tools.some(row=>row.part.phase==='succeeded'));assert.match(text,/LANTERN_7ae8d289/);
 assert.equal(execution.finalMessageIds.length,1);assert.ok(execution.ingestionReceiptId);
 const operations=before.runtimeModelOperations.filter(row=>row.runAccountId===run.runAccountId),ids=operations.map(row=>row._id);
 const attempts=before.runtimeModelAttempts.filter(row=>ids.includes(row.operationDocumentId));assert.ok(attempts.every(row=>row.slotReleased));
 const modelAttempts=attempts.filter(row=>operations.find(op=>op._id===row.operationDocumentId)?.operationKey==='agent.respond');
 assert.equal(modelAttempts.length,2);const requests=modelAttempts.map(row=>({attemptId:row._id,...JSON.parse(JSON.parse(row.inputProofCanonical).requestCanonical)}));
 assert.ok(requests.every(row=>row.inputTokens<=32768));
 const account=before.runtimeBudgetAccounts.find(row=>row._id===run.runAccountId);assert.equal(account.activeConcurrency,0);assert.equal(account.uncertainUnits,attempts.reduce((sum,row)=>sum+row.reservationUnits,0));
 const replay=await c.owner.mutation('runtimeAgent:reconcile',{...scope,runId:handle.runId});assert.equal(replay.receiptId,execution.ingestionReceiptId);
 const after=await state(),replayedOperations=after.runtimeModelOperations.filter(row=>row.runAccountId===run.runAccountId);
 assert.deepEqual(replayedOperations.map(row=>row._id).sort(),ids.sort());assert.deepEqual(after.runtimeModelAttempts.filter(row=>ids.includes(row.operationDocumentId)).map(row=>row._id).sort(),attempts.map(row=>row._id).sort());
 const result={status:'PASS_ACTUAL_UI_SMALL_APPROVAL_CONTINUATION',handle,observation,text,tools,requests,attempts,account,replay,
  distinctToolCallIds:[...new Set(tools.map(row=>row.part.toolCallId))],oneFinalMessage:execution.finalMessageIds,oneIngestionIdentity:execution.ingestionReceiptId,
  continuationModelCalls:2,reconcileAdditionalPaidAttempts:0,fullUnknownCostLiabilityRetained:true,sourceScope:'installed-task09-source-manifest4.json',
  originalD:'Preserved bounded denial; not readmitted',backgroundIngestion:'Separate job budget may advance independently; replay count is compared on the exact run account'};
 await c.publish('controls7-small-approval-readback',result);console.log(JSON.stringify({status:result.status,runId:handle.runId,text,modelInputBounds:requests.map(row=>row.inputTokens),paidAttempts:attempts.length,uncertainUnits:account.uncertainUnits,reconcileAdditionalPaidAttempts:0}));
}catch(error){await c.publish('controls7-small-approval-readback-failure',{status:'FAIL',error:c.publicError(error)});throw error;}
finally{const errors=[];try{await client.close();}catch(error){errors.push(c.publicError(error));}try{await c.close();}catch(error){errors.push(c.publicError(error));}await c.publish('controls7-small-approval-readback-cleanup',{allOwnedClientsCloseAttempted:true,errors});}
