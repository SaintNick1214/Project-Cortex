/** New logical turn after the terminal-persistence repair; never retries the interrupted turn. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,qa,waitUntil} from './common.mjs';

const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const setup=JSON.parse(await readFile(join(qa,'owned-prerequisites1.json')));
const original=JSON.parse(await readFile(join(qa,'native2-calls.json')));
const operation=original.operation,first=original.records.find(x=>x.label==='held-initial-tool-turn').result;
const installed=JSON.parse(await readFile(join(qa,'installed-task09-source-manifest4.json')));
const deploy=JSON.parse(await readFile(join(qa,'deploy-current2.json')));
assert.equal(deploy.code,0);assert.equal(deploy.timedOut,false);
assert.deepEqual(installed.changedPaths,['runtimeGateway.ts']);
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
const clients=[],stops=[],records=[],outcomes=[],observerErrors=[],observations=[];
let currentToken=c.token('cortex-owner');
const make=()=>{const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>currentToken});clients.push(client);return client;};
const client=make(),other=make();
const state=()=>c.admin.query('ingestionQualification:state',scope);
async function call(label,kind,name,args){const began=Date.now();try{const result=await c.owner[kind](name,args);records.push({label,kind,function:name,args,result,elapsedMs:Date.now()-began});await c.publish('native3-calls',{operation,records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error),elapsedMs:Date.now()-began});await c.publish('native3-calls',{operation,records});throw error;}}
async function check(name,fn){try{outcomes.push({name,status:'PASS',evidence:await fn()});}catch(error){outcomes.push({name,status:'FAIL',error:c.publicError(error)});throw error;}finally{await c.publish('native3-outcomes',{operation,outcomes});}}
const began=performance.now();let handle;
try{
 await c.verifyTarget('native3-target-verified');
 const before=await state(),oldRun=before.runtimeRuns.find(row=>row.runId===first.runId);
 assert.equal(oldRun.responseStatus,'failed');assert.equal(oldRun.failureCode,'INTERRUPTED_REQUIRES_RECONCILIATION');
 const heldOriginal=before.runtimeIngestionEvents.find(row=>row.runId===first.runId&&row.lineage.role==='user');
 assert.ok(heldOriginal);const oldExtract=before.runtimeIngestionStages.find(row=>row.eventId===heldOriginal.eventId&&row.stage==='extract');
 assert.equal(oldExtract.state,'pending');assert.equal(oldExtract.attempt,0);
 const request={version:1,agentId:setup.definitions.tool.agentId,agentVersion:1,conversationId:first.conversationId,
  clientRequestId:'task09-tail-b-'+operation,parts:[{type:'text',text:'Use memory_recall once for my project codeword. What nickname did I give in my previous user message? Reply with my nickname and the retrieved codeword.'}]};
 const submitted=await call('new-logical-held-tool-turn','mutation','ingestionQualification:submitHeld',{request});
 assert.notEqual(submitted.runId,first.runId);assert.equal(submitted.conversationId,first.conversationId);
 handle=await client.attach(submitted.runId);const otherHandle=await other.attach(handle.runId);assert.deepEqual(otherHandle,handle);
 let firstCursor=null,disconnected=false;
 const stop=client.watchObservation(handle,value=>{observations.push({observer:'first',state:value.state,cursor:value.cursor,parts:value.parts});
  if(!disconnected&&value.parts.length){firstCursor={attemptNumber:value.run.attemptNumber,sequence:value.cursor};disconnected=true;queueMicrotask(()=>stop());}},error=>observerErrors.push(c.publicError(error)));stops.push(stop);
 stops.push(other.watchObservation(otherHandle,value=>observations.push({observer:'second',state:value.state,cursor:value.cursor,parts:value.parts}),error=>observerErrors.push(c.publicError(error))));
 await client.start(handle,{streaming:true});
 console.log(JSON.stringify({status:'STARTED_NEW_LOGICAL_TURN',runId:handle.runId,conversationId:handle.conversationId,originalNeverRestarted:true,pid:process.pid}));
 const final=await waitUntil('Task09 repaired native tool final',()=>client.observe(handle,{finalOnly:true}),value=>['complete','failed','unknown','cancelled'].includes(value.state),{timeoutMs:120000,pollMs:300});
 await c.publish('native3-final-observation',final);assert.equal(final.state,'complete',JSON.stringify(final));
 const after=await state(),event=after.runtimeIngestionEvents.find(row=>row.runId===handle.runId&&row.lineage.role==='user');assert.ok(event);
 const codeword='LANTERN_'+operation.slice(0,8),nickname='Willow_'+operation.slice(0,8);
 await check('real backend recall completes while both eligible user events remain unprocessed',async()=>{
  const text=final.parts.filter(row=>row.part.type==='text').map(row=>row.part.text).join('');assert.match(text,new RegExp(codeword));assert.match(text,new RegExp(nickname));
  const run=after.runtimeRuns.find(row=>row.runId===handle.runId),extract=after.runtimeIngestionStages.find(row=>row.eventId===event.eventId&&row.stage==='extract');
  assert.equal(run.responseStatus,'complete');assert.equal(run.memoryStatus,'pending');assert.equal(extract.state,'pending');assert.equal(extract.attempt,0);
  const stillOriginal=after.runtimeIngestionStages.find(row=>row.eventId===heldOriginal.eventId&&row.stage==='extract');assert.equal(stillOriginal.state,'pending');assert.equal(stillOriginal.attempt,0);
  const full=await client.observe(handle),tools=full.parts.filter(row=>row.part.type==='tool');assert.ok(tools.some(row=>row.part.name==='memory_recall'&&row.part.phase==='succeeded'));
  const execution=after.runtimeAgentExecutions.find(row=>row.runId===handle.runId);assert.equal(execution.toolCount,1);
  assert.equal(after.runtimeRuns.find(row=>row.runId===first.runId).failureCode,'INTERRUPTED_REQUIRES_RECONCILIATION');
  return {handle,text,run,eventId:event.eventId,originalEventId:heldOriginal.eventId,extract,toolParts:tools,execution,oldFailedRunNotReadmitted:true};
 });
 await check('two authenticated observers and cursor reconnect reconstruct one final without effects',async()=>{
  assert.ok(disconnected&&firstCursor);const reconnected=await client.observe(handle,{cursor:firstCursor}),secondFinal=await other.observe(otherHandle,{finalOnly:true});
  assert.deepEqual(secondFinal.parts,final.parts);assert.equal(reconnected.state,'complete');assert.equal(observerErrors.length,0);
  const seen=new Set();for(const observation of observations.filter(row=>row.observer==='second'))for(const part of observation.parts){assert.equal(seen.has(part.sequence),false);seen.add(part.sequence);}
  assert.ok(seen.size);return {firstCursor,reconnected,secondFinal,observerUpdates:observations,duplicateSequences:false,observerErrors};
 });
 await check('same-request replay and repeat reconcile have no additional tool or ingestion effects',async()=>{
  const baseline=await state();const replay=await call('same-submit-replay','mutation','ingestionQualification:submitHeld',{request});assert.equal(replay.runId,handle.runId);
  const reconcile=await call('repeat-reconcile','mutation','runtimeAgent:reconcile',{...scope,runId:handle.runId});assert.equal(reconcile.reconciled,true);
  const current=await state();for(const table of ['runtimeModelAttempts','runtimeTranscriptMessages','runtimeIngestionEvents'])assert.equal(current[table].length,baseline[table].length,table);
  assert.deepEqual((await client.observe(handle,{finalOnly:true})).parts,final.parts);
  return {replay,reconcile,counts:Object.fromEntries(['runtimeModelAttempts','runtimeTranscriptMessages','runtimeIngestionEvents'].map(table=>[table,current[table].length])),noAdditionalPaidDispatch:true};
 });
 const finalState=await state();
 await c.publish('browser-fixture2',{status:'READY_ACTUAL_BROWSER',operation,scope,definitions:setup.definitions,initialHandle:handle,initialEventId:event.eventId,originalUnknownRunId:first.runId,
  originalEventId:heldOriginal.eventId,codeword,nickname,privateTokenPath:join(c.handoff.privateDirectory,'task09-owner-refresh-jwt.txt'),sourceManifest:installed.manifestSha256,
  initialStateCounts:{modelAttempts:finalState.runtimeModelAttempts.length,sourceEvents:finalState.runtimeIngestionEvents.length,transcriptMessages:finalState.runtimeTranscriptMessages.length},credentialValuesPrinted:false});
 await c.publish('native3-state',finalState);
 await c.publish('native3-final',{status:'PASS',operation,candidate:installed.manifestSha256,outcomes,elapsedMs:performance.now()-began,waitDeadlineMs:120000,originalUnknownPreserved:true});
 console.log(JSON.stringify({status:'PASS',groups:outcomes.length,runId:handle.runId,conversationId:handle.conversationId,eventId:event.eventId,memoryStatus:'pending',elapsedMs:performance.now()-began}));
}catch(error){await c.publish('native3-failure',{status:'FAIL',error:c.publicError(error),outcomes,records,handle,elapsedMs:performance.now()-began,paidRetry:false});throw error;}
finally{for(const stop of stops)stop();const errors=[];for(const client of clients)try{await client.close();}catch(error){errors.push(c.publicError(error));}try{await c.close();}catch(error){errors.push(c.publicError(error));}
 await c.publish('native3-client-cleanup',{allOwnedClientsCloseAttempted:true,errors});if(errors.length)throw new AggregateError(errors,'Task09 clients failed close');}
