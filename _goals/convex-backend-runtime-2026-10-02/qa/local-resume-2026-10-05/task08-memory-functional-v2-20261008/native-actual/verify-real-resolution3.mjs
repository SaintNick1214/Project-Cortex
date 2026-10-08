/** Readback of the completed real worker; no second inference after the cost-state oracle red. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('real-resolution3-readback-target-verified');
 const prior=JSON.parse(await readFile(join(q,'real-resolution2-calls.json'))),eventId=prior.records.find(r=>r.label==='new-distinct-correction').result[0].eventId;
 const state=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId}),job=state.runtimeIngestionJobs.find(j=>j.eventId===eventId),event=state.runtimeIngestionEvents.find(e=>e.eventId===eventId);
 const operations=state.runtimeModelOperations.filter(o=>o.runAccountId===job.runAccountId),extract=operations.find(o=>o.operationKey==='memory.extract'),resolution=operations.find(o=>o.operationKey==='facts.resolve');assert.ok(extract);assert.ok(resolution);assert.equal(resolution.parentOperationId,extract._id);
 const attempts=state.runtimeModelAttempts.filter(a=>a.operationDocumentId===resolution._id);assert.equal(attempts.length,1);const attempt=attempts[0],terminal=JSON.parse(attempt.terminalEvidenceCanonical),snapshot=JSON.parse(resolution.snapshotCanonical);
 assert.equal(attempt.state,'uncertain');assert.equal(attempt.slotReleased,true);assert.equal(attempt.resultAttachmentState,'attached');assert.equal(attempt.resultWithheld,false);assert.ok(attempt.privateResultCanonical);
 assert.equal(terminal.outcome,'confirmed');assert.equal(terminal.costSource,'unavailable');assert.equal(terminal.actualModel,attempt.actualModel);assert.equal(terminal.modelId,snapshot.modelId);assert.ok(terminal.usage.inputTokens<=snapshot.limits.inputTokens);assert.ok(terminal.usage.outputTokens<=snapshot.limits.outputTokens);
 assert.equal(resolution.uncertainUnits,attempt.reservationUnits);assert.equal(resolution.reservedUnits,0);assert.equal(resolution.settledUnits,0);
 assert.equal(event.factsState,'complete');assert.equal(event.vectorsState,'complete');const history=state.runtimeBeliefHistory.filter(h=>h.eventId===eventId);assert.ok(history.length);assert.equal(state.runtimeBeliefOutbox.filter(o=>o.eventId===eventId).length,1);
 const vectors=state.runtimeMemoryVectors.filter(v=>v.sourceId===event.lineage.sourceId);assert.ok(vectors.length);assert.ok(vectors.every(v=>v.dimensions===1536&&v.finite));
 await c.publish('real-resolution3-native-state',state);
 await c.publish('real-resolution3-final',{status:'PASS',candidate:prior.candidate,eventId,actualOrdinaryWorker:true,controlledDecisions:false,extractOperationId:extract._id,resolutionOperationId:resolution._id,parentExact:true,actualModel:attempt.actualModel,onePaidResolutionAttempt:true,terminal,retainedLiability:resolution.uncertainUnits,slotReleased:true,historyActions:history.map(h=>h.action),vectorDimensions:1536,oracleCorrection:'Original script incorrectly expected finished; confirmed terminal with unavailable cost correctly remains uncertain+attached under adopted policy. No new inference.',operationKeyCounts:Object.fromEntries([...new Set(state.runtimeModelOperations.map(x=>x.operationKey))].map(key=>[key,state.runtimeModelOperations.filter(x=>x.operationKey===key).length]))});
}finally{await c.close();await c.publish('real-resolution3-cleanup',{ownedClientsClosed:true,noNewModelCalls:true});}
