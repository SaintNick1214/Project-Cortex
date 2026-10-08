import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,qa,sha} from './common.mjs';
import {openOwnedContext as openHostContext} from '../../task08-memory-functional-v2-20261008/native-actual/common.mjs';
const c=await openOwnedContext(),h=await openHostContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
try{
 await c.verifyTarget('final09-target-verified');
 const candidate=JSON.parse(await readFile(join(qa,'installed-task09-source-manifest5.json'))),stock=JSON.parse(await readFile(join(qa,'../../task08-memory-functional-v2-20261008/native-actual/stock-host-live.json')));
 const hostRows=await h.hostOwner.query('host:authenticated',{});assert.deepEqual(hostRows,stock.rows);
 const node=await h.hostOwner.action('hostNode:health',{});assert.equal(node.subject,'host-owner');assert.equal(node.runtime,'node');
 const response=await fetch(c.handoff.url.replace('.convex.cloud','.convex.site')+'/host-health',{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);assert.equal(await response.text(),'host-route-preserved');
 for(const pin of candidate.preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256);
 for(const pin of candidate.files)assert.equal(sha(await readFile(join(c.host,c.functionsDirectory,pin.path))),pin.sha256);
 const state=await c.admin.query('ingestionQualification:state',scope);await c.publish('final09-native-state',state);
 assert.ok(state.runtimeModelAttempts.every(row=>row.slotReleased===true));assert.ok(state.runtimeBudgetAccounts.every(row=>row.activeConcurrency===0&&row.reservedUnits===0));
 const byOperationKey=Object.fromEntries([...new Set(state.runtimeModelOperations.map(row=>row.operationKey))].sort().map(key=>[key,state.runtimeModelOperations.filter(row=>row.operationKey===key).length]));
 const accounts=state.runtimeBudgetAccounts.map(row=>({id:row._id,kind:row.kind,limitUnits:row.limitUnits,activeConcurrency:row.activeConcurrency,reservedUnits:row.reservedUnits,settledUnits:row.settledUnits,uncertainUnits:row.uncertainUnits,cancelled:row.cancelled,overrun:row.overrun}));
 const attempts=state.runtimeModelAttempts.map(row=>({id:row._id,operationDocumentId:row.operationDocumentId,state:row.state,slotReleased:row.slotReleased,reservationUnits:row.reservationUnits,actualModel:row.actualModel,resultWithheld:row.resultWithheld,resultAttachmentState:row.resultAttachmentState}));
 const byRun=state.runtimeRuns.map(run=>({runId:run.runId,responseStatus:run.responseStatus,failureCode:run.failureCode,attemptNumber:run.attemptNumber,
  operations:state.runtimeModelOperations.filter(op=>op.runAccountId===run.runAccountId).map(op=>({id:op._id,operationKey:op.operationKey,state:op.state,operationId:op.operationId}))}));
 const result={status:'PASS_FINAL_HOST_LEDGER_READBACK',projectId:c.handoff.projectId,deploymentName:c.handoff.deploymentName,candidateManifest:candidate.manifestSha256,
  hostRows,node,httpStatus:response.status,preservedHostFiles:candidate.preserved,all80InstalledFileHashesMatched:true,operationCount:state.runtimeModelOperations.length,
  paidAttemptCount:attempts.length,byOperationKey,byRun,attempts,accounts,allSlotsReleased:true,noOutstandingReservations:true,
  terminalCost:'unavailable; full per-call liability retained, no refund inferred',noNewModelCallsForReadback:true};
 await c.publish('final09-host-ledger-readback',result);console.log(JSON.stringify({status:result.status,operationCount:result.operationCount,paidAttemptCount:result.paidAttemptCount,byOperationKey,allSlotsReleased:true,preservedHostRows:hostRows.length}));
}catch(error){await c.publish('final09-host-ledger-failure',{status:'FAIL',error:c.publicError(error)});throw error;}
finally{await c.close();await h.close();await c.publish('final09-host-ledger-clients',{allOwnedClientsClosed:true,noReactiveClients:true});}
