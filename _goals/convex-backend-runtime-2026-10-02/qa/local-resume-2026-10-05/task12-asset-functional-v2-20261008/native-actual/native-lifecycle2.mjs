/** Resume the existing native Agent owner after the preserved default-lock fixture error. No repeats of the four completed groups. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied,waitUntil} from './common.mjs';
const context=await openOwnedContext(),groups=[];
try{
 await context.verifyTarget('native-lifecycle2-target-verified');
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json'))),prior=JSON.parse(await readFile(join(q,'native-lifecycle1-outcomes.json'))),scope=setup.owner.scope,owner=context.http(setup.owner.subject);
 assert.equal(prior.status,'FAIL_OR_UNKNOWN');assert.equal(prior.error.data.code,'TRANSCRIPT_LOCKED');assert.equal(prior.groups.length,4);
 const before=await context.admin.query('task12Native:snapshot',scope);
 const version=before.versions.find(row=>row.lineage.kind==='upload'&&row.lineage.requestId==='agent-file-'+context.pointer.operation);
 assert.ok(version?.physicalStorage);assert.deepEqual(version.edges.filter(edge=>edge.active).map(edge=>edge.kind),['agent']);
 const edge=version.edges.find(edge=>edge.active&&edge.kind==='agent'),conversationId=edge.conversationId;
 const conversation=await owner.query('runtimeTranscript:get',{...scope,conversationId});assert.equal(conversation.manualWriteLocked,true);
 const transcript=await owner.query('runtimeTranscript:messages',{...scope,conversationId});assert.equal(transcript.page.length,1);assert.equal(transcript.page[0].assets[0].versionId,version.versionId);assert.equal(transcript.page[0].assets[0].contentHash,version.contentHash);
 await context.publish('native-lifecycle2-before',{version,conversation,publicNativeMessage:transcript.page[0],priorFailure:'native-lifecycle1-outcomes.json',priorCompletedGroups:4,newModelCalls:0});
 const unlocked=await owner.mutation('runtimeTranscript:setPolicy',{...scope,conversationId,expectedRevision:conversation.historyRevision,manualWriteLocked:false});
 const deletion=await owner.mutation('conversations:deleteConversation',{...scope,conversationId});
 const removed=await waitUntil('same Agent final owner deletion',()=>context.admin.query('task12Native:snapshot',scope),value=>value.versions.find(row=>row.versionId===version.versionId)?.physicalStorage===null,{timeoutMs:30000});
 assert.equal(removed.versions.find(row=>row.versionId===version.versionId).state,'deleted');
 groups.push({name:'real-Agent-file-owner-retains-bytes-until-authorized-unlocked-conversation-deletion',status:'PASS',conversationId,nativeMessageId:edge.ownerId,assetVersionId:version.versionId,publicAssetHash:version.contentHash,finalStorage:null,unlocked,deletion,fixtureCorrection:'The default manual lock must be explicitly unlocked by its current admin before deletion.',preservedLockedDenial:true,textBytes:0,modelCalls:0});
 const held=await context.admin.action('task12Native:prepareHeldUpload',{reference:setup.owner.reference,requestId:'held-tombstone-'+context.pointer.operation});const job=await context.admin.query('task12Native:heldJob',{jobId:held.jobId});
 await context.admin.mutation('runtimeAssets:stageStorage',{jobId:held.jobId,storageId:held.storageId});
 await context.admin.mutation('runtimeAuth:tombstoneResource',{...scope,resourceType:'storage',resourceId:job.assetId});
 const late=await denied(()=>context.admin.mutation('runtimeAssets:finalize',{jobId:held.jobId}));assert.match(JSON.stringify(context.publicError(late)),/FORBIDDEN|ASSET_UPLOAD_EXPIRED/);
 await context.admin.mutation('task12Native:expireHeld',{jobId:held.jobId});await context.admin.mutation('runtimeAssets:cleanupJob',{jobId:held.jobId});
 const cleaned=await context.admin.query('task12Native:snapshot',scope);const closedJob=cleaned.jobs.find(row=>row.jobId===held.jobId);assert.equal(closedJob.state,'failed');assert.equal(closedJob.physicalStorage,null);assert.equal(cleaned.versions.some(row=>row.versionId===job.versionId),false);
 groups.push({name:'delayed-native-ready-commit-denies-deletion-tombstone-and-cleans-storage',status:'PASS',jobId:held.jobId,late:context.publicError(late),readyVersionCount:0,physicalStorage:null});
 const orphan=await context.admin.action('task12Native:prepareHeldUpload',{reference:setup.owner.reference,requestId:'held-orphan-'+context.pointer.operation});
 const orphanJob=await context.admin.query('task12Native:heldJob',{jobId:orphan.jobId});assert.equal(orphanJob.storageId,undefined);
 await context.admin.mutation('task12Native:expireHeld',{jobId:orphan.jobId});await context.admin.mutation('runtimeAssets:cleanupJob',{jobId:orphan.jobId});
 // This second stage tries to attach the original native stored ID. It must find no bytes.
 const missing=await context.admin.mutation('task12Native:storageMetadata',{storageId:orphan.storageId});assert.equal(missing,null);
 groups.push({name:'crash-between-store-and-stage-owned-marker-orphan-cleanup',status:'PASS',jobId:orphan.jobId,storedIdKnownOnlyToInternalQA:true,physicalStorage:null});
 const cancellableRequest='held-cancel-'+context.pointer.operation;
 const cancellable=await context.admin.action('task12Native:prepareHeldUpload',{reference:setup.owner.reference,requestId:cancellableRequest});
 await context.admin.mutation('runtimeAssets:stageStorage',{jobId:cancellable.jobId,storageId:cancellable.storageId});
 const cancellation=await owner.mutation('runtimeAssets:cancel',{...scope,requestId:cancellableRequest});assert.equal(cancellation.cancelled,true);
 const cancelledFinalize=await denied(()=>context.admin.mutation('runtimeAssets:finalize',{jobId:cancellable.jobId}));assert.match(JSON.stringify(context.publicError(cancelledFinalize)),/ASSET_UPLOAD_EXPIRED/);
 const cancelled=await waitUntil('cancelled storage cleanup',()=>context.admin.query('task12Native:snapshot',scope),value=>{const job=value.jobs.find(row=>row.jobId===cancellable.jobId);return job?.state==='cancelled'&&job.physicalStorage===null;},{timeoutMs:30000});assert.equal(cancelled.versions.some(row=>row.storageId===cancellable.storageId),false);
 groups.push({name:'cancelled-native-staged-job-never-ready-and-removes-bytes',status:'PASS',jobId:cancellable.jobId,cancellation,denial:context.publicError(cancelledFinalize),physicalStorage:null});
 await context.publish('native-lifecycle2-outcomes',{status:'ACTUAL_PASS',groups,previousCompletedGroupsFile:'native-lifecycle1-outcomes.json',previousCompletedGroups:4,modelCalls:0,projectId:context.state.projectId,QAByteGeneratedIsNotProviderEvidence:true});console.log(JSON.stringify({status:'ACTUAL_PASS',newGroups:groups.length,priorGroups:4,modelCalls:0}));
}catch(error){await context.publish('native-lifecycle2-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:context.publicError(error),modelCalls:0,noBlindRepeat:true});throw error;}finally{await context.close();}
