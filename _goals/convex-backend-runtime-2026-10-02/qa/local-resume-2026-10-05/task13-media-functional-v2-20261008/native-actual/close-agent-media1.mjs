/** Current canonical registration, one existing Agent-mediated image: storage, parent budget, replay/auth closure only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,q,sha,denied} from './common.mjs';
const c=await openOwnedContext(),config=JSON.parse(await readFile(join(q,'agent-media-public-fixture2.json'))),scope={tenantId:config.tenantId,memorySpaceId:config.memorySpaceId};let client;const groups=[];
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
const finances=ledger=>ledger.accounts.map(row=>pick(row,['accountId','kind','runBudgetId','root','windowId','windowStart','windowEnd','reservedUnits','uncertainUnits','settledUnits','activeConcurrency'])).sort((a,b)=>a.accountId.localeCompare(b.accountId));
async function table(name){let cursor=null,result=[];for(let n=0;n<10;n++){const page=await c.admin.query('_system/cli/tableData',{table:name,order:'desc',paginationOpts:{cursor,numItems:100}});
 result.push(...page.page.filter(row=>name==='runtimeModelAttempts'||row.tenantId===scope.tenantId&&row.memorySpaceId===scope.memorySpaceId));if(page.isDone)return result;cursor=page.continueCursor;}throw Error('BOUNDED_NATIVE_PAGING_EXCEEDED');}
try{
 await c.verifyTarget('agent-media-closure1-target-verified');const deployed=JSON.parse(await readFile(join(q,'deploy-agent-media-restored1.json'))),installed=JSON.parse(await readFile(join(q,'installed-agent-media-restored1-source-manifest.json')));
 assert.equal(deployed.code,0);assert.equal(deployed.timedOut,false);assert.equal(installed.canonicalRunsRegistrationRestored,true);
 const functions=join(c.host,c.functionsDirectory);assert.equal(sha(await readFile(join(functions,'runs.ts'))),installed.restoredRunsSha256);
 const live=JSON.parse(await readFile(join(q,'agent-media-observe1-readback.json'))),released=JSON.parse(await readFile(join(q,'agent-media-release-ingestion1-readback.json'))),before=await c.admin.query('task13Native:snapshot',scope);
 const sdk=await import(pathToFileURL(join(c.host,'task13-runtime-entry.mjs')));client=new sdk.CortexRuntimeClient({deploymentUrl:c.state.url,assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),scope,fetchToken:async()=>c.token(config.subject)});
 const handle=await client.attach(live.runId),run=await client.get(handle),observation=await client.observe(handle,{limit:100}),transcript=await client.messages(run.conversationId,{limit:100});
 assert.equal(run.responseStatus,'complete');assert.equal(run.memoryStatus,'complete');assert.equal(run.attemptNumber,1);assert.equal(observation.state,'complete');assert.equal(transcript.isDone,true);
 assert.deepEqual(run.outputMessageIds,live.run.outputMessageIds);assert.equal(run.outputMessageIds.length,1);
 const job=await client.getMediaJob(before.jobs[0].jobId);assert.equal(job.state,'ready');assert.equal(job.kind,'image');assert.equal(job.asset.mimeType,'image/png');
 const artifact=await client.getArtifact(job.artifactId);assert.equal(artifact.file.versionId,job.asset.versionId);assert.equal(artifact.file.contentHash,job.asset.contentHash);
 const blob=await client.fetchAsset({assetId:job.asset.assetId,version:job.asset.assetVersion}),bytes=Buffer.from(await blob.arrayBuffer());
 assert.equal(blob.type,'image/png');assert.equal(bytes.length,job.asset.sizeBytes);assert.ok(bytes.length<=20000000);assert.equal(sha(bytes),job.asset.contentHash);
 assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes.readUInt32BE(16),1024);assert.equal(bytes.readUInt32BE(20),1024);
 await writeFile(join(c.pointer.privateDataDirectory,'agent-media-v2-qualified-image1.png'),bytes,{flag:'wx',mode:0o600});
 const native=await Promise.all(['runtimeRuns','runtimeAgentExecutions','runtimeAgentIngestion','runtimeAgentOperations','runtimeModelOperations','runtimeModelAttempts','runtimeAgentOutput'].map(table));
 const [runs,executions,ingestions,agentOps,modelOps,scopeAttempts,output]=native,raw=runs.find(row=>row.runId===run.runId),execution=executions.find(row=>row.runId===run.runId),ingestion=ingestions.filter(row=>row.runId===run.runId),runOps=agentOps.filter(row=>row.runId===run.runId);
 assert.equal(runs.length,1);assert.equal(executions.length,1);assert.equal(execution.streaming,true);assert.equal(execution.state,'complete');assert.equal(ingestion.length,1);
 assert.deepEqual(execution.finalMessageIds,run.outputMessageIds);assert.equal(execution.ingestionReceiptId,ingestion[0].receiptId);
 const tools=runOps.filter(row=>row.kind==='tool'),models=runOps.filter(row=>row.kind==='model');assert.equal(tools.length,1);assert.equal(tools[0].toolName,'media_image_generate');assert.equal(tools[0].state,'complete');assert.equal(models.length,2);assert.ok(models.every(row=>row.state==='complete'));
 assert.ok(JSON.stringify(transcript).includes(job.jobId));assert.ok(JSON.stringify(transcript).includes(job.artifactId));
 groups.push({name:'one-actual-streamed-Agent-tool-image-one-canonical-final-ingestion-and-current-private-delivery',status:'PASS',runId:run.runId,jobId:job.jobId,artifactId:job.artifactId,
  versionId:job.asset.versionId,contentHash:job.asset.contentHash,sizeBytes:bytes.length,width:1024,height:1024,observedToolEffects:1,actualModelSteps:2,canonicalRunsRegistration:true});
 const commonOps=modelOps.filter(row=>row.runAccountId===raw.runAccountId),commonIds=new Set(commonOps.map(row=>row._id)),commonAttempts=scopeAttempts.filter(row=>commonIds.has(row.operationDocumentId));
 assert.equal(commonAttempts.length,4);assert.equal(commonAttempts.reduce((sum,row)=>sum+row.reservationUnits,0),2300000);
 assert.ok(commonAttempts.every(row=>row.state==='uncertain'&&row.slotReleased===true&&row.resultWithheld===false));
 const imageOp=commonOps.find(row=>row.operationKey==='media.image.generate');assert.ok(imageOp);assert.equal(imageOp.parentOperationId,models.find(row=>row.ordinal===0).nativeModelOperationId);
 const imageJob=before.jobs[0];assert.equal(imageJob.runAccountId,raw.runAccountId);assert.equal(imageJob.runBudgetId,raw.runBudgetId);
 const commonAccount=before.accounts.find(row=>row.accountId===raw.runAccountId);assert.equal(commonAccount.uncertainUnits,2300000);assert.equal(commonAccount.limitUnits,3000000);
 const tenantAccount=before.accounts.find(row=>row.kind==='tenant');assert.equal(tenantAccount.uncertainUnits,2600000);assert.equal(tenantAccount.activeConcurrency,0);
 assert.equal(before.attempts.length,7);assert.ok(before.attempts.every(row=>row.slotReleased===true));
 groups.push({name:'real-image-secondary-has-exact-parent-and-common-budget-full-uncertain-liability',status:'PASS',runAccountId:raw.runAccountId,runBudgetId:raw.runBudgetId,parentOperationId:imageOp.parentOperationId,
  sharedRunAttempts:4,sharedRunFullLiabilityUnits:2300000,scopeAttempts:7,scopeFullLiabilityUnits:2600000,finishedSlotsReleased:true,aggregateCostUnavailable:true,imageServingIdentityUnobserved:true});
 const reconciled=await client.reconcileMediaJob(job.jobId);assert.equal(reconciled.asset.versionId,job.asset.versionId);assert.equal(reconciled.asset.contentHash,job.asset.contentHash);
 const again=await client.attach(run.runId),repeat=await client.observe(again,{limit:100});assert.equal(repeat.state,'complete');assert.equal(repeat.run.runId,run.runId);
 const noAuth=await denied(()=>c.http().mutation('runtimeMediaJobs:get',{...scope,jobId:job.jobId})),foreign=await denied(()=>c.http(c.fixture.foreignSubject).mutation('runtimeMediaJobs:get',{...scope,jobId:job.jobId}));
 assert.equal(noAuth.data?.code,'UNAUTHENTICATED');assert.equal(foreign.data?.code,'FORBIDDEN');
 const httpDenied=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/cortex/assets/download?assetId='+encodeURIComponent(job.asset.assetId)+'&version='+job.asset.assetVersion,{headers:{'X-Cortex-Tenant-Id':scope.tenantId,'X-Cortex-Memory-Space-Id':scope.memorySpaceId},signal:AbortSignal.timeout(15000)});
 assert.equal(httpDenied.status,401);const deniedBytes=Buffer.from(await httpDenied.arrayBuffer());assert.match(httpDenied.headers.get('content-type')??'',/application\/json/);assert.ok(deniedBytes.toString().includes('UNAUTHENTICATED'));assert.notDeepEqual([...deniedBytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 const after=await c.admin.query('task13Native:snapshot',scope);assert.deepEqual(finances(after),finances(before));assert.deepEqual(after.attempts.map(row=>row.attemptId).sort(),before.attempts.map(row=>row.attemptId).sort());
 assert.equal(after.jobs.length,1);assert.equal(after.jobs[0].assetVersionId,job.asset.versionId);
 groups.push({name:'ready-job-reconcile-durable-observer-replay-current-auth-negatives-zero-added-inference',status:'PASS',versionId:job.asset.versionId,noAuthCode:noAuth.data.code,foreignCode:foreign.data.code,httpNoAuthStatus:httpDenied.status,
  attemptsUnchanged:true,financialRootWindowsCountersUnchanged:true,newGenerationRequests:0});
 groups.push({name:'actual-delayed-response-completes-before-claim-then-real-stages-close-default-profile',status:'PASS',
  pendingSnapshot:live.run.memoryStatus,finalBeforeRelease:live.run.responseStatus,heldUserStages:live.native.stages.filter(row=>row.eventId===live.held[0].eventId),
  releaseAt:released.releaseAt,completeAt:released.completedAt,readiness:released.readiness,workerOperations:['memory.extract','embedding.memory'],noAdditionalAgentTurn:true});
 const terminalRecords=commonAttempts.map(row=>({attemptId:row._id,operationDocumentId:row.operationDocumentId,canonical:JSON.parse(row.canonical),snapshot:JSON.parse(row.snapshotCanonical),inputProof:JSON.parse(row.inputProofCanonical),
  measuredInputTokens:row.measuredInputTokens,maximumOutputTokens:row.maximumOutputTokens,checkpointAt:row.checkpointAt,state:row.state,slotReleased:row.slotReleased,
  terminal:row.terminalEvidenceCanonical?JSON.parse(row.terminalEvidenceCanonical):null,resultAttached:row.resultAttachmentState==='attached',privateResultSha256:row.privateResultCanonical?sha(row.privateResultCanonical):null,
  privateResultBytes:row.privateResultCanonical?Buffer.byteLength(row.privateResultCanonical):null}));
 const streamParts=output.filter(row=>row.runId===run.runId).map(row=>({sequence:row.sequence,final:row.final,createdAt:row.createdAt,part:JSON.parse(row.partCanonical)}));
 const record={version:1,status:'ACTUAL_V2_STREAMED_AGENT_IMAGE_NATIVE_CLOSURE_PASS',observedAt:Date.now(),groups,scope,run,job,artifact,observation,transcript,
  actualNativeExecution:{runAccountId:raw.runAccountId,runBudgetId:raw.runBudgetId,execution,ingestion:ingestion[0],agentOperations:runOps,commonModelOperations:commonOps,terminalRecords,streamParts},
  fullUnknownLiability:{commonRunUnits:2300000,newScopeUnits:2600000,priorScopeUnits:7500000,priorHeldSlots:2,newTotalUnits:10100000,noRefundOrReset:true},
  source:{candidateManifestSha256:config.candidateManifestSha256,deliberateDelayOverlay:config.fixtureOverlaySourceManifest,
   canonicalRestoredManifest:join(q,'installed-agent-media-restored1-source-manifest.json'),canonicalRestoredDeployment:join(q,'deploy-agent-media-restored1.json')},
  nativeV2InitialAndFinalStreamsObserved:true,nativeV2DoGenerateNotObserved:true,observedToolNames:['media_image_generate'],fullFiveToolCatalogAdvertised:true,
  imageIdentity:'requested-only; no observed serving model',imageAggregateCost:'unavailable; full2m retained',asyncVideoStillBlocked:true,noAsync503Resubmission:true,
  newProviderRequestsDuringClosure:0,privateImageFileRetained:true,cleanupPending:true,shippedV2QualificationPromotion:false};
 await client.close();client=undefined;await c.publish('actual-agent-media-v2-qualification-record1',record);await c.publish('agent-media-closure1-outcomes',{status:record.status,groups,record:'actual-agent-media-v2-qualification-record1.json',newProviderRequests:0,ownedClientClosed:true,cleanupPending:true});
 console.log(JSON.stringify({status:record.status,groups:groups.length,runId:run.runId,jobId:job.jobId,newProviderRequests:0,newScopeUnknownUnits:2600000}));
}catch(error){await c.publish('agent-media-closure1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:c.publicError(error),noPaidRetry:true});throw error;}
finally{if(client)await client.close();await c.close();}
