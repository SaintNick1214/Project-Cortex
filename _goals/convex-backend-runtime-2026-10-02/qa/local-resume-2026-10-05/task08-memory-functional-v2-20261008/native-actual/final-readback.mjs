import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('final-target-verified');
 const candidate=JSON.parse(await readFile(join(q,process.argv[2]??'installed-task08-source-manifest3.json'))),stock=JSON.parse(await readFile(join(q,'stock-host-live.json')));
 const rows=await c.hostOwner.query('host:authenticated',{});assert.deepEqual(rows,stock.rows);
 const node=await c.hostOwner.action('hostNode:health',{});assert.equal(node.subject,'host-owner');assert.equal(node.runtime,'node');
 const response=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/host-health',{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);assert.equal(await response.text(),'host-route-preserved');
 const files=[];for(const pin of candidate.preserved){const bytes=await readFile(join(c.host,pin.path));assert.equal(sha(bytes),pin.sha256,'Unrelated host changed '+pin.path);files.push(pin);}
 const state=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});
 await c.publish('final-native-state',state);
 const attempts=state.runtimeModelAttempts.map(row=>({id:row._id,operationDocumentId:row.operationDocumentId,state:row.state,reservationUnits:row.reservationUnits,slotReleased:row.slotReleased,actualModel:row.actualModel,resultAttachmentState:row.resultAttachmentState,resultWithheld:row.resultWithheld}));
 const accounts=state.runtimeBudgetAccounts.map(row=>({id:row._id,kind:row.kind,limitUnits:row.limitUnits,activeConcurrency:row.activeConcurrency,reservedUnits:row.reservedUnits,settledUnits:row.settledUnits,uncertainUnits:row.uncertainUnits,overrun:row.overrun,cancelled:row.cancelled}));
 assert.ok(attempts.every(row=>row.slotReleased===true),'Actual model concurrency must be released before retirement');
 assert.ok(accounts.every(row=>row.activeConcurrency===0&&row.reservedUnits===0),'Outstanding reservations remain');
 await c.publish('final-host-and-ledger-readback',{status:'PASS',projectId:c.state.projectId,candidate:candidate.manifestSha256,hostRows:rows,node,httpStatus:response.status,files,attempts,accounts,noNewModelCallsForReadback:true,allSlotsReleased:true,fullUnknownLiabilityRetained:true});
}finally{await c.close();await c.publish('final-client-cleanup',{ownedReactiveClientsClosed:true});}
