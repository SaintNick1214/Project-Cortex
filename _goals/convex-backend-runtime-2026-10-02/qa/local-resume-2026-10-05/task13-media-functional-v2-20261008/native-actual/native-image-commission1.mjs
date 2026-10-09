/** One distinct fixed image request through the real durable job and guarded native handler. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha,denied,waitUntil} from './common.mjs';
const c=await openOwnedContext(),groups=[];
const scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const snapshot=()=>c.admin.query('task13Native:snapshot',scope);
function conserved(old,current){
 for(const before of old.accounts){const after=current.accounts.find(row=>row.accountId===before.accountId);assert.ok(after);
  for(const key of ['kind','windowId','windowStart','windowEnd','reservedUnits','uncertainUnits','settledUnits','activeConcurrency'])assert.deepEqual(after[key],before[key]);
  assert.deepEqual(after.root,before.root);
 }
 assert.equal(current.attempts.length,old.attempts.length);
 for(const before of old.attempts){const after=current.attempts.find(row=>row.attemptId===before.attemptId);assert.ok(after);
  for(const key of ['state','hash','reservationUnits','slotReleased','resultWithheld','checkpointAt','dispatchIdentity','terminalEvidenceHash'])assert.deepEqual(after[key],before[key]);}
}
try{
 await c.verifyTarget('native-image-commission1-target-verified');
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json'))),manifest=JSON.parse(await readFile(join(q,'image-commission-only-manifest1.json')));
 const deployed=JSON.parse(await readFile(join(q,'deploy-current3.json'))),candidate=JSON.parse(await readFile(join(q,'installed-current2-source-manifest.json')));assert.equal(deployed.code,0);assert.equal(deployed.timedOut,false);
 assert.equal(manifest.classification,'fixture-synthetic');assert.equal(manifest.revision,12);
 const prior=JSON.parse(await readFile(join(q,'../../task12-asset-functional-v2-20261008/native-actual/cleanup12-outcomes.json'))),oldMoney=[];
 for(const row of prior.money){const value=await c.admin.query('mediaProbe:ledger',{tenantId:row.tenantId});oldMoney.push({tenantId:row.tenantId,ledger:value});}
 await c.publish('native-image-commission1-prior-money',oldMoney);
 const before=await snapshot();await c.publish('native-image-commission1-before',before);assert.equal(before.jobs.length,0);assert.equal(before.attempts.length,0);
 for(const[name,client]of [['noJWT',c.http()],['foreign',c.http(setup.foreign.subject)]]){
  const error=await denied(()=>client.mutation('task13ImageCommission:submitCommission',{}));groups.push({name:name+'-fixed-commissioning-denied',status:'PASS',error:c.publicError(error)});
 }
 const unauthorized=await snapshot();assert.equal(unauthorized.jobs.length,0);assert.equal(unauthorized.attempts.length,0);
 const activation=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:manifest.revision});
 await c.publish('image-provisional-activation1',{scope:'PRIVATE_FIXED_OPERATOR_COMMISSIONING_NOT_PRODUCTION_QUALIFICATION',manifestId:manifest.manifestId,revision:manifest.revision,result:activation,modelCalls:0});
 const dto=await c.http(setup.owner.subject).mutation('task13ImageCommission:submitCommission',{});
 await c.publish('native-image-commission1-submitted',dto);assert.equal(dto.kind,'image');assert.equal(dto.state,'pending');
 let final;
 try{final=await waitUntil('Single image job terminal',async()=>{const value=await c.http(setup.owner.subject).mutation('runtimeMediaJobs:get',{...scope,jobId:dto.jobId});return value;},value=>['ready','failed','submission_unknown','cancelled','expired'].includes(value.state),{timeoutMs:90000,pollMs:1000});}
 catch(error){final=await c.http(setup.owner.subject).mutation('runtimeMediaJobs:get',{...scope,jobId:dto.jobId});await c.publish('native-image-commission1-wait-limit',{error:c.publicError(error),state:final.state,noResubmission:true});}
 const after=await snapshot(),probes=await c.admin.query('task13ImageCommission:read',{});
 await c.publish('native-image-commission1-after',{job:final,snapshot:after,probes});
 assert.equal(after.jobs.length,1);assert.equal(probes.length,1);const probe=probes[0],job=after.jobs[0];
 assert.equal(job.jobId,dto.jobId);assert.equal(probe.jobId,dto.jobId);
 if(probe.issuedCount===1){assert.equal(after.attempts.length,1);const attempt=after.attempts[0];
  assert.ok(probe.createdAt<=probe.issuedAt);assert.equal(attempt.attemptId,probe.attemptId);assert.equal(attempt.dispatchIdentity,probe.dispatchIdentity);assert.equal(attempt.reservationUnits,2000000);assert.ok(attempt.checkpointAt<=probe.issuedAt);
  assert.equal(job.snapshot.modelId,'openai/gpt-image-1');assert.equal(job.snapshot.nativeInterface,'image');
  groups.push({name:'durable-job-artifact-reservation-before-one-native-request',status:'PASS',jobId:job.jobId,artifactId:job.artifactId,attemptId:attempt.attemptId,issuedCount:1,checkpointAt:attempt.checkpointAt,issuedAt:probe.issuedAt});
 }
 let output;
 if(final.state==='ready'){
  assert.equal(probe.issuedCount,1);assert.equal(probe.observation.nativeHttpStatus,200);assert.ok(probe.observation.encodedResponseBytes<=28000000);
  const client=await c.runtimeClient(setup.owner.subject),asset=final.asset;
  assert.equal(asset.mimeType,'image/png');assert.ok(asset.sizeBytes>0&&asset.sizeBytes<=20000000);assert.equal(asset.lineage.kind,'generated');assert.equal(asset.lineage.modelId,'openai/gpt-image-1');
  const reference={assetId:asset.assetId,version:asset.assetVersion},blob=await client.fetchAsset(reference),bytes=Buffer.from(await blob.arrayBuffer());
  assert.equal(blob.type,'image/png');assert.equal(bytes.length,asset.sizeBytes);assert.equal(sha(bytes),asset.contentHash);assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.equal(width,1024);assert.equal(height,1024);
  const file=join(c.pointer.privateDataDirectory,'qualified-image1.png');await writeFile(file,bytes,{flag:'wx',mode:0o600});
  const artifact=await client.getArtifact(final.artifactId);assert.equal(artifact.streamingState,'final');assert.equal(artifact.file.versionId,asset.versionId);assert.equal(artifact.file.contentHash,asset.contentHash);
  const attempt=after.attempts[0];assert.equal(attempt.state,'uncertain');assert.equal(attempt.slotReleased,true);assert.equal(attempt.resultWithheld,false);assert.equal(attempt.resultAttachmentState,'attached');
  for(const account of after.accounts)assert.equal(account.reservedUnits+account.uncertainUnits+account.settledUnits,2000000);
  const selected=await client.getEmbeddingProfile(),readiness=await client.memoryReadiness();assert.equal(selected.profile.dimensions,1536);assert.equal(readiness.profile.profileId,selected.profile.profileId);
  const listed=await client.listMediaJobs({limit:10}),read=await client.getMediaJob(final.jobId);assert.equal(listed.jobs.filter(row=>row.jobId===final.jobId).length,1);assert.equal(read.asset.versionId,asset.versionId);
  output={asset,width,height,privateOutputFile:file,encodedResponseBytes:probe.observation.encodedResponseBytes,requestedModelId:'openai/gpt-image-1',observedWireModel:probe.observation.rawModelId??null,servingIdentityUnqualified:true,aggregateCostUnavailable:true};
  await c.publish('native-image-commission1-output',output);
  groups.push({name:'actual-native-image-owned-catalog-private-http-and-installed-client-roundtrips',status:'PASS',assetVersionId:asset.versionId,contentHash:asset.contentHash,sizeBytes:asset.sizeBytes,width,height,fullUnknownLiabilityUnits:2000000,releasedFinishedSlot:true,optional14MetadataOnly:true});
  await c.closeClient(client);
 }
 // Same key is a durable job lookup. Reconciliation never readmits submission_unknown.
 const repeat=await c.http(setup.owner.subject).mutation('task13ImageCommission:submitCommission',{});assert.equal(repeat.jobId,dto.jobId);
 const reconcile=await c.http(setup.owner.subject).mutation('runtimeMediaJobs:reconcile',{...scope,jobId:dto.jobId});assert.equal(reconcile.jobId,dto.jobId);
 const replaySnapshot=await snapshot(),replayProbes=await c.admin.query('task13ImageCommission:read',{});
 assert.equal(replaySnapshot.jobs.length,after.jobs.length);assert.equal(replaySnapshot.attempts.length,after.attempts.length);assert.equal(replayProbes[0].issuedCount,probe.issuedCount);
 for(const account of after.accounts){const current=replaySnapshot.accounts.find(row=>row.accountId===account.accountId);assert.ok(current);for(const key of ['root','windowId','uncertainUnits','reservedUnits','settledUnits','activeConcurrency'])assert.deepEqual(current[key],account[key]);}
 await c.publish('native-image-commission1-replay',{repeat,reconcile,snapshot:replaySnapshot,probes:replayProbes,newProviderRequests:0});
 groups.push({name:'same-key-and-reconcile-no-added-submission-or-liability-reset',status:'PASS',issuedCount:probe.issuedCount,attemptCount:after.attempts.length});
 for(const old of oldMoney)conserved(old.ledger,await c.admin.query('mediaProbe:ledger',{tenantId:old.tenantId}));
 groups.push({name:'prior-4.5m-and-two-unknown-slots-conserved',status:'PASS',retainedUnits:4500000,heldSlots:2});
 const status=final.state==='ready'?'ACTUAL_IMAGE_COMMISSION_PASS_PENDING_COMPILED_QUALIFICATION':probe.issuedCount===1?'ACTUAL_IMAGE_REQUEST_UNQUALIFIED_TERMINAL_OR_CAPABILITY':'IMAGE_NOT_DISPATCHED';
 await c.publish('native-image-commission1-outcomes',{status,groups,job:final,output:output??null,candidateManifestSha256:candidate.packed.sdk.manifestSha256,issuedRequests:probe.issuedCount,confirmedSuccessfulImage:final.state==='ready',shippedImageQualification:false,fixtureSyntheticTrust:true,asyncVideoQualification:false,AgentMediatedMediaAcceptance:false,unknownCostLiabilityRetained:true,noBlindPaidRetry:true,allOwnedRuntimeClientsClosedOnExit:true});
 console.log(JSON.stringify({status,groups:groups.length,issuedRequests:probe.issuedCount,jobState:final.state}));
}catch(error){await c.publish('native-image-commission1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:c.publicError(error),noBlindPaidRepeat:true,shippedImageQualification:false});throw error;}finally{await c.close();}
