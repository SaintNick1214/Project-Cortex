/** Unpaid readback of the completed B; preserves native3's failed nickname oracle. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,qa,waitUntil} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const original=JSON.parse(await readFile(join(qa,'native3-calls.json'))),call=original.records.find(row=>row.label==='new-logical-held-tool-turn');
const setup=JSON.parse(await readFile(join(qa,'owned-prerequisites1.json')));
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
const clients=[],stops=[],updates=[],errors=[];const make=()=>{const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>c.token('cortex-owner')});clients.push(client);return client;};
const first=make(),second=make(),state=()=>c.admin.query('ingestionQualification:state',scope);
try{
 const before=await state(),handle=await first.attach(call.result.runId),other=await second.attach(handle.runId);
 const observed=await first.observe(handle,{finalOnly:true});assert.equal(observed.state,'complete');
 const text=observed.parts.filter(row=>row.part.type==='text').map(row=>row.part.text).join(''),codeword='LANTERN_'+original.operation.slice(0,8);assert.match(text,new RegExp(codeword));
 const run=before.runtimeRuns.find(row=>row.runId===handle.runId),execution=before.runtimeAgentExecutions.find(row=>row.runId===handle.runId);
 const event=before.runtimeIngestionEvents.find(row=>row.runId===handle.runId&&row.lineage.role==='user'),extract=before.runtimeIngestionStages.find(row=>row.eventId===event.eventId&&row.stage==='extract');
 assert.equal(run.memoryStatus,'pending');assert.equal(extract.state,'pending');assert.equal(extract.attempt,0);
 const full=await first.observe(handle),tools=full.parts.filter(row=>row.part.type==='tool'&&row.part.phase==='succeeded');
 assert.equal(tools.length,2);assert.equal(new Set(tools.map(row=>row.part.toolCallId)).size,2);assert.ok(tools.every(row=>row.part.name==='memory_recall'));assert.equal(execution.toolCount,2);
 assert.ok(execution.ingestionReceiptId);assert.equal(execution.finalMessageIds.length,1);
 for(const [label,client,h] of [['first',first,handle],['second',second,other]])stops.push(client.watchObservation(h,value=>updates.push({observer:label,...value}),error=>errors.push(c.publicError(error))));
 await waitUntil('completed B two observer delivery',async()=>updates,rows=>['first','second'].every(label=>rows.some(row=>row.observer===label&&row.state==='complete')),{timeoutMs:15000});
 stops[0]();const cursor=updates.find(row=>row.observer==='first').cursor;
 const cursorResume=await first.observe(handle,{cursor:{attemptNumber:run.attemptNumber,sequence:cursor}}),reconstructed=await first.observe(handle,{finalOnly:true});
 assert.deepEqual(reconstructed.parts,observed.parts);assert.deepEqual((await second.observe(other,{finalOnly:true})).parts,observed.parts);assert.equal(cursorResume.state,'complete');assert.equal(errors.length,0);
 const replay=await c.owner.mutation('ingestionQualification:submitHeld',call.args);assert.equal(replay.runId,handle.runId);
 const reconciled=await c.owner.mutation('runtimeAgent:reconcile',{...scope,runId:handle.runId});assert.equal(reconciled.receiptId,execution.ingestionReceiptId);
 const after=await state();for(const table of ['runtimeModelAttempts','runtimeTranscriptMessages','runtimeIngestionEvents'])assert.equal(after[table].length,before[table].length,table);
 const snapshot=JSON.parse(run.snapshotCanonical),old=before.runtimeRuns.find(row=>row.queueSequence===1&&row.conversationId===handle.conversationId);
 assert.equal(old.failureCode,'INTERRUPTED_REQUIRES_RECONCILIATION');assert.equal(snapshot.messages.some(row=>old.inputMessageIds.includes(row.nativeMessageId)),false);
 const result={status:'PASS_SCOPED_COMPLETED_TURN_READBACK',operation:original.operation,handle,text,run,eventId:event.eventId,extract,successfulToolCalls:tools,
  actualDistinctToolInvocations:2,requestedOnceButModelRequestedTwo:true,oneFinalTranscript:execution.finalMessageIds,oneIngestionIdentity:execution.ingestionReceiptId,
  cursorResume,observerUpdates:updates,replay,reconciled,countsUnchanged:Object.fromEntries(['runtimeModelAttempts','runtimeTranscriptMessages','runtimeIngestionEvents'].map(table=>[table,after[table].length])),
  noAddedPaidDispatch:true,oldNative3NicknameFailurePreserved:true,oldFailedTurnExcludedByCompletedHistoryPredicate:true,pendingTailForNextTurn:event.lineage,
  operationKeyCounts:Object.fromEntries([...new Set(after.runtimeModelOperations.map(row=>row.operationKey))].map(key=>[key,after.runtimeModelOperations.filter(row=>row.operationKey===key).length]))};
 await c.publish('native3-completed-scope-readback',result);
 await c.publish('browser-fixture2',{status:'READY_ACTUAL_BROWSER',operation:original.operation,scope,definitions:setup.definitions,initialHandle:handle,initialEventId:event.eventId,
  codeword,nicknameFromFailedTurnExcluded:true,privateTokenPath:join(c.handoff.privateDirectory,'task09-owner-refresh-jwt.txt'),actualDistinctToolInvocations:2,
  pendingTailMessageId:run.inputMessageIds[0],pendingTailText:call.args.request.parts[0].text,initialStateCounts:result.countsUnchanged,credentialValuesPrinted:false});
 console.log(JSON.stringify({status:result.status,runId:handle.runId,memoryStatus:run.memoryStatus,toolInvocations:2,replayAdditionalPaidDispatch:0,oneIngestionIdentity:execution.ingestionReceiptId}));
}finally{for(const stop of stops)stop();const closeErrors=[];for(const client of clients)try{await client.close();}catch(error){closeErrors.push(c.publicError(error));}try{await c.close();}catch(error){closeErrors.push(c.publicError(error));}
 await c.publish('native3-readback-client-cleanup',{allOwnedClientsCloseAttempted:true,errors:closeErrors});if(closeErrors.length)throw new AggregateError(closeErrors,'Owned Task09 close failed');}
