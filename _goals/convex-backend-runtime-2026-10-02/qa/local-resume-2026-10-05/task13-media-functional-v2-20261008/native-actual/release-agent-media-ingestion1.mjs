/** One explicit held-stage release through the real governed worker; no Agent/media request. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,q,waitUntil} from './common.mjs';
const c=await openOwnedContext(),config=JSON.parse(await readFile(join(q,'agent-media-public-fixture2.json'))),scope={tenantId:config.tenantId,memorySpaceId:config.memorySpaceId};let client;
try{
 await c.verifyTarget('agent-media-release-ingestion1-target-verified');
 const before=await c.admin.query('task13Native:snapshot',scope),held=await c.admin.query('task13AgentDelay:snapshot',{}),live=JSON.parse(await readFile(join(q,'agent-media-observe1-readback.json')));
 assert.equal(live.run.responseStatus,'complete');assert.equal(live.run.memoryStatus,'pending');assert.equal(held.length,1);assert.equal(held[0].state,'held');assert.ok(Date.now()<held[0].deadlineAt);
 await c.publish('agent-media-release-ingestion1-before',{observedAt:Date.now(),held,before,responseCompleteBeforeRelease:true,memoryPendingBeforeRelease:true});
 const releaseAt=Date.now();await c.admin.action('task13AgentDelay:release',{reference:held[0].reference,eventId:held[0].eventId,stage:'extract'});
 const sdk=await import(pathToFileURL(join(c.host,'task13-runtime-entry.mjs')));client=new sdk.CortexRuntimeClient({deploymentUrl:c.state.url,assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),scope,fetchToken:async()=>c.token(config.subject)});
 const handle=await client.attach(live.runId),run=await waitUntil('real released ingestion reaches terminal phase',()=>client.get(handle),value=>['complete','failed'].includes(value.memoryStatus),{timeoutMs:90000,pollMs:500});
 const status=await c.http(config.subject).mutation('runtimeIngestion:status',{...scope,eventId:held[0].eventId}),readiness=await client.memoryReadiness(),after=await c.admin.query('task13Native:snapshot',scope),finalHeld=await c.admin.query('task13AgentDelay:snapshot',{});
 await client.close();client=undefined;
 await c.publish('agent-media-release-ingestion1-readback',{status:run.memoryStatus==='complete'?'ACTUAL_REAL_INGESTION_RELEASE_COMPLETE':'ACTUAL_REAL_INGESTION_FAILED',
  releaseAt,completedAt:Date.now(),heldBefore:held,heldAfter:finalHeld,run,statusResponse:status,readiness,before,after,
  actualAddedOperations:after.operations.filter(row=>!before.operations.some(old=>old.operationId===row.operationId)),actualAddedAttempts:after.attempts.filter(row=>!before.attempts.some(old=>old.attemptId===row.attemptId)),
  noAgentResubmit:true,noMediaResubmit:true,realWorker:'processStageHandler',ownedSDKClientClosed:true});
 assert.equal(run.memoryStatus,'complete');assert.equal(run.responseStatus,'complete');assert.equal(after.jobs.length,1);assert.equal(after.jobs[0].jobId,before.jobs[0].jobId);assert.equal(after.jobs[0].assetVersionId,before.jobs[0].assetVersionId);
 assert.equal(finalHeld[0].state,'released');assert.equal(finalHeld[0].releaseIssuedAt>=releaseAt,true);
 console.log(JSON.stringify({status:'ACTUAL_REAL_INGESTION_RELEASE_COMPLETE',runId:run.runId,memoryStatus:run.memoryStatus,newIngestionAttempts:after.attempts.length-before.attempts.length,newMediaRequests:0,readiness:readiness.stages}));
}catch(error){await c.publish('agent-media-release-ingestion1-outcomes',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),noAgentOrMediaRetry:true});throw error;}
finally{if(client)await client.close();await c.close();}
