import assert from 'node:assert/strict';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {openOwnedContext,qa,waitUntil,denied,sha} from './common.mjs';
const c=await openOwnedContext(),setup=JSON.parse(await readFile(join(qa,'owned-prerequisites1.json'))),operation=randomUUID();
const records=[],outcomes=[],owned=[];
const installed=JSON.parse(await readFile(join(qa,'installed-task09-source-manifest3.json')));
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
const scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
let currentToken=c.token('cortex-owner');
const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>currentToken});owned.push(client);
async function call(label,kind,name,args,http=c.owner){const began=Date.now();try{const result=await http[kind](name,args);records.push({label,kind,function:name,args,result,elapsedMs:Date.now()-began});await c.publish('native1-calls',{operation,records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error),elapsedMs:Date.now()-began});await c.publish('native1-calls',{operation,records});throw error;}}
async function check(name,fn){try{outcomes.push({name,status:'PASS',evidence:await fn()});}catch(error){outcomes.push({name,status:'FAIL',error:c.publicError(error)});throw error;}finally{await c.publish('native1-outcomes',{operation,outcomes});}}
const state=()=>c.admin.query('ingestionQualification:state',scope);
try{
 await c.verifyTarget('native1-target-verified');
 await check('installed SDK session and managed profile are native and scoped',async()=>{
  const session=await client.session(),profile=await client.getDefaultProfile(),definition=await client.getDefinition(setup.definitions.tool.agentId,1);
  assert.equal(session.tenantId,c.tenantId);assert.equal(session.memorySpaceId,c.memorySpaceId);assert.equal(session.principalId,setup.owner.principalId);
  assert.equal(profile.profile.dimensions,1536);assert.equal(profile.profile.modelId,'openai/text-embedding-3-small');assert.equal(definition.definitionHash,setup.definitions.tool.definitionHash);
  return {session,profile,definition,SDKBytes:sha(await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')))};
 });
 const reference=await call('current-reference','query','ingestionQualification:reference',{memorySpaceId:c.memorySpaceId});
 const codeword='LANTERN_'+operation.slice(0,8),nickname='Willow_'+operation.slice(0,8);
 const remembered=await call('governed-owned-memory-seed','action','runtimeMemory:remember',{...scope,requestId:'task09-seed-'+operation,text:'My project codeword is '+codeword+'. It is the exact codeword that I use for this project.'});
 assert.equal(remembered.success,true,JSON.stringify(remembered));
 const request={version:1,agentId:setup.definitions.tool.agentId,agentVersion:1,clientRequestId:'task09-tail-a-'+operation,parts:[{type:'text',text:'My nickname is '+nickname+'. Please acknowledge this nickname and use memory_recall to report my project codeword.'}]};
 const submitted=await call('held-initial-tool-turn','mutation','ingestionQualification:submitHeld',{request});
 const handle=await client.attach(submitted.runId);await client.start(handle,{streaming:true});
 const final=await waitUntil('Task09 initial tool final',()=>client.observe(handle,{finalOnly:true}),v=>['complete','failed','unknown','cancelled'].includes(v.state),{timeoutMs:120000,pollMs:300});
 await c.publish('native1-initial-final',final);
 assert.equal(final.state,'complete',JSON.stringify(final));
 const initialState=await state(),event=initialState.runtimeIngestionEvents.find(e=>e.runId===handle.runId&&e.lineage.role==='user');assert.ok(event);
 await check('actual scoped backend tool final remains separate from held indexing',async()=>{
  const run=initialState.runtimeRuns.find(x=>x.runId===handle.runId),extract=initialState.runtimeIngestionStages.find(x=>x.eventId===event.eventId&&x.stage==='extract');
  const text=final.parts.filter(x=>x.part.type==='text').map(x=>x.part.text).join('');assert.match(text,new RegExp(codeword));assert.match(text,new RegExp(nickname));
  assert.equal(run.responseStatus,'complete');assert.equal(run.memoryStatus,'pending');assert.equal(extract.state,'pending');assert.equal(extract.attempt,0);
  const execution=initialState.runtimeAgentExecutions.find(x=>x.runId===handle.runId);assert.ok(execution.operations.some(x=>x.kind==='tool'&&x.toolName==='memory_recall'&&x.state==='complete'));
  assert.equal(initialState.runtimeMemoryReceipts.filter(x=>x.lineage?.runId===handle.runId).length,0);
  return {handle,eventId:event.eventId,codeword,nickname,text,run,toolOperations:execution.operations.filter(x=>x.kind==='tool'),extract,responseFinal:true,indexingPending:true};
 });
 await check('same-scope JWT refresh retains pinned native handle and final output',async()=>{
  const before=await client.get(handle);currentToken=c.token('cortex-owner');await client.refreshAuth();
  const session=await client.session(),after=await client.get(handle),observation=await client.observe(handle,{finalOnly:true});
  assert.equal(session.principalId,handle.principalId);assert.equal(after.runId,before.runId);assert.deepEqual(observation.parts,final.parts);
  return {session,runId:after.runId,definitionHash:after.definitionHash,terminalState:observation.state};
 });
 await check('native no-JWT and foreign identity observation deny',async()=>{
  const errors=[];for(const http of [c.anonymous,c.foreign]){const error=await denied(()=>http.query('runtimeAgent:observe',{memorySpaceId:c.memorySpaceId,runId:handle.runId}));errors.push(c.publicError(error));assert.match(JSON.stringify(c.publicError(error)),/UNAUTHENTICATED|FORBIDDEN/);}
  return {errors};
 });
 const beforeDedupe=await state();
 const replay=await call('same-submit-replay','mutation','ingestionQualification:submitHeld',{request});assert.equal(replay.runId,handle.runId);
 const finalAgain=await client.observe(handle,{finalOnly:true}),afterDedupe=await state();assert.deepEqual(finalAgain.parts,final.parts);
 assert.equal(afterDedupe.runtimeModelAttempts.length,beforeDedupe.runtimeModelAttempts.length);assert.equal(afterDedupe.runtimeTranscriptMessages.length,beforeDedupe.runtimeTranscriptMessages.length);assert.equal(afterDedupe.runtimeIngestionEvents.length,beforeDedupe.runtimeIngestionEvents.length);
 const browserTokenFile=join(c.handoff.privateDirectory,'task09-owner-jwt.txt');await writeFile(browserTokenFile,c.token('cortex-owner'),{mode:0o600});await chmod(browserTokenFile,0o600);
 await c.publish('browser-fixture1',{operation,scope,definitions:setup.definitions,initialHandle:handle,initialEventId:event.eventId,codeword,nickname,reference,remembered,privateTokenPath:browserTokenFile,credentialValuesPrinted:false,initialStateCounts:{modelAttempts:afterDedupe.runtimeModelAttempts.length,sourceEvents:afterDedupe.runtimeIngestionEvents.length,transcriptMessages:afterDedupe.runtimeTranscriptMessages.length},status:'READY_ACTUAL_BROWSER'});
 await c.publish('native1-state',afterDedupe);await c.publish('native1-final',{status:'PASS',operation,candidate:installed.manifestSha256,outcomes,replay:{runId:replay.runId,modelAttemptsUnchanged:true,transcriptUnchanged:true,ingestionUnchanged:true},actualGovernedInference:true,fullUnknownLiabilityRetained:true});
 console.log(JSON.stringify({status:'PASS',outcomes:outcomes.length,runId:handle.runId,conversationId:handle.conversationId,eventId:event.eventId,codeword,nickname}));
}catch(error){await c.publish('native1-failure',{status:'FAIL',error:c.publicError(error),outcomes,records});throw error;}
finally{const errors=[];for(const item of owned){try{await item.close();}catch(error){errors.push(c.publicError(error));}}try{await c.close();}catch(error){errors.push(c.publicError(error));}await c.publish('native1-client-cleanup',{allOwnedClientsClosed:true,errors});if(errors.length)throw new AggregateError(errors,'Task09 clients failed close');}
