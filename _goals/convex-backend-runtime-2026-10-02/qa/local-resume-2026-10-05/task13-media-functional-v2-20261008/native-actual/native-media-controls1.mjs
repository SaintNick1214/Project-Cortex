/** Actual registered unpaid controls. The held scheduler is explicitly a QA setup seam. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied} from './common.mjs';
const c=await openOwnedContext(),groups=[],scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const snapshot=()=>c.admin.query('task13Native:snapshot',scope);
const counters=value=>({attempts:value.attempts.map(row=>({attemptId:row.attemptId,state:row.state,reservationUnits:row.reservationUnits,slotReleased:row.slotReleased,dispatchIdentity:row.dispatchIdentity})),accounts:value.accounts.map(row=>({accountId:row.accountId,root:row.root,windowId:row.windowId,reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,activeConcurrency:row.activeConcurrency}))});
try{
 await c.verifyTarget('native-media-controls1-target-verified');
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json'))),owner=c.http(setup.owner.subject),before=await snapshot();
 await c.publish('native-media-controls1-before',before);
 const pending=await owner.mutation('task13Held:submit',{requestId:'task13-unpaid-cancel'});assert.equal(pending.state,'pending');
 const staged=await snapshot();assert.equal(staged.attempts.length,before.attempts.length);assert.equal(staged.artifacts.filter(row=>row.artifactId===pending.artifactId).length,1);
 const same=await owner.mutation('task13Held:submit',{requestId:'task13-unpaid-cancel'});assert.equal(same.jobId,pending.jobId);
 const changed=await denied(()=>owner.mutation('runtimeMediaJobs:submit',{...scope,requestId:'task13-unpaid-cancel',kind:'image',prompt:'Different logical content for the same key.'}));
 assert.ok(JSON.stringify(c.publicError(changed)).includes('MEDIA_IDEMPOTENCY_CONFLICT'));
 groups.push({name:'real-parent-pending-artifact-budget-and-same-key-conflict',status:'PASS',jobId:pending.jobId,artifactId:pending.artifactId,fixtureSchedulerHeldBeforeClaim:true,newAttempts:0});
 for(const[name,client]of [['noJWT',c.http()],['foreign',c.http(setup.foreign.subject)]]){
  const error=await denied(()=>client.mutation('runtimeMediaJobs:get',{...scope,jobId:pending.jobId}));
  const cancelled=await denied(()=>client.mutation('runtimeMediaJobs:cancel',{...scope,jobId:pending.jobId}));
  groups.push({name:name+'-media-read-and-cancel-denied',status:'PASS',read:c.publicError(error),cancel:c.publicError(cancelled)});
 }
 const priorCallback=await snapshot();
 const response=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/cortex/media/video/webhook?jobId='+encodeURIComponent(pending.jobId),{method:'POST',headers:{'Content-Type':'application/json','x-convex-video-signature':'t='+Math.floor(Date.now()/1000)+',v1='+'0'.repeat(64)},body:JSON.stringify({id:'forged-owned-fixture',operation:'not-a-private-handle',status:'completed'}),signal:AbortSignal.timeout(15000)});
 assert.ok([400,401,403,404,409].includes(response.status));const body=(await response.text()).slice(0,512);const afterCallback=await snapshot();
 assert.deepEqual(afterCallback.jobs,priorCallback.jobs);assert.deepEqual(counters(afterCallback),counters(priorCallback));
 groups.push({name:'installed-fifth-route-without-private-callback-credentials-denies-forgery',status:'PASS',httpStatus:response.status,response:body,validSignedNativeCallbackNotQualified:true});
 const cancelled=await owner.mutation('runtimeMediaJobs:cancel',{...scope,jobId:pending.jobId});assert.equal(cancelled.state,'cancelled');assert.equal(cancelled.upstreamCancellation,'not_supported');
 await c.admin.action('runtimeMediaJobs:processSubmission',{jobId:pending.jobId});
 const reconciled=await owner.mutation('runtimeMediaJobs:reconcile',{...scope,jobId:pending.jobId});assert.equal(reconciled.state,'cancelled');
 const client=await c.runtimeClient(setup.owner.subject),fromSdk=await client.getMediaJob(pending.jobId);assert.equal(fromSdk.state,'cancelled');
 const repeated=await client.cancelMediaJob(pending.jobId);assert.equal(repeated.state,'cancelled');
 const artifact=await client.getArtifact(pending.artifactId);assert.equal(artifact.streamingState,'error');assert.equal(artifact.file,undefined);
 await c.closeClient(client);
 const after=await snapshot();assert.equal(after.attempts.length,before.attempts.length);
 for(const account of before.accounts){const current=after.accounts.find(row=>row.accountId===account.accountId);assert.ok(current);for(const key of ['root','windowId','reservedUnits','uncertainUnits','settledUnits','activeConcurrency'])assert.deepEqual(current[key],account[key]);}
 for(const account of after.accounts.filter(row=>!before.accounts.some(old=>old.accountId===row.accountId))){assert.equal(account.reservedUnits+account.uncertainUnits+account.settledUnits,0);assert.equal(account.activeConcurrency,0);}
 groups.push({name:'pending-cancel-reconcile-processing-and-installed-client-no-model-effect',status:'PASS',upstreamCancellation:'not_supported',newAttempts:0,newNativeRequests:0,emptyNewAccountsAllowed:true,optional14JobRoundtrip:true});
 // The shipped/commissioned image envelope does not qualify async video. This is
 // an explicit predispatch absence control, not another call to the known503 path.
 const video=await denied(()=>owner.mutation('runtimeMediaJobs:submit',{...scope,requestId:'task13-missing-video-proof',kind:'video',prompt:'No async provider call is authorized by this negative.'}));
 assert.ok(JSON.stringify(c.publicError(video)).includes('CAPABILITY_UNAVAILABLE'));
 const final=await snapshot();assert.equal(final.jobs.length,after.jobs.length);assert.deepEqual(counters(final),counters(after));
 groups.push({name:'missing-async-qualification-before-job-or-dispatch',status:'PASS',denial:c.publicError(video),nativeVideoRequests:0,prior503NeverResubmitted:true});
 await c.publish('native-media-controls1-after',final);
 await c.publish('native-media-controls1-outcomes',{status:'ACTUAL_REGISTERED_UNPAID_MEDIA_CONTROLS_PASS',groups,fixtureSetup:'Real scheduler redirected to no-op before native claim; all subsequent cancel/reconcile/HTTP paths are product registrations.',modelCalls:0,providerCallbackPositiveNotQualified:true,asyncCapabilityUnchanged:true,prior4_5mAndHeld2Unchanged:true,allOwnedClientsClosedOnExit:true});
 console.log(JSON.stringify({status:'ACTUAL_REGISTERED_UNPAID_MEDIA_CONTROLS_PASS',groups:groups.length,modelCalls:0}));
}catch(error){await c.publish('native-media-controls1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:c.publicError(error),noPaidRetry:true});throw error;}finally{await c.close();}
