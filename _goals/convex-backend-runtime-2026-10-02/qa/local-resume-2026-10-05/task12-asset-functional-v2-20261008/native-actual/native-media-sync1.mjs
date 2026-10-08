/** One distinct sync qualification. Old async identity and all liabilities are immutable. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,q,sha,authorityReference,denied} from './common.mjs';
import {privateFramePng} from './private-frame.mjs';
const c=await openOwnedContext({requestTimeoutMs:190000}),groups=[];let client;
try {
 await c.verifyTarget('native-media-sync1-target-verified');
 const deployment=JSON.parse(await readFile(join(q,'deploy-sync1.json')));assert.equal(deployment.code,0);assert.equal(deployment.timedOut,false);
 const old=await c.admin.query('mediaProbe:ledger',{tenantId:c.tenantId});assert.equal(old.attempts.length,1);assert.equal(old.attempts[0].state,'uncertain');assert.equal(old.accounts.find(x=>x.kind==='tenant').uncertainUnits,2000000);
 await c.publish('native-media-sync1-old-async-before',old);
 const scope={tenantId:c.tenantId+'-sync',memorySpaceId:c.memorySpaceId+'-sync'},subject=c.fixture.ownerSubject+'-sync';
 const provision=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject,actorKind:'user',...scope,resourceAccess:'own',capabilities:['read','write','run','admin','storage:read','storage:write'],expiresAt:Date.now()+7200000});
 const reference=authorityReference(provision),owner=c.http(subject);
 await owner.mutation('memorySpaces:register',{...scope,name:'Distinct Task12 sync qualification',type:'project'});
 const sdk=await import(pathToFileURL(join(c.host,'task12-runtime-entry.mjs')));client=new sdk.CortexRuntimeClient({deploymentUrl:c.state.url,assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),fetchToken:async()=>c.token(subject),scope});await client.session();
 const frame=await client.uploadAsset(privateFramePng(),{mimeType:'image/png',filename:'distinct-sync-private-frame.png',requestId:'distinct-sync-frame-'+c.pointer.operation});
 const setup={scope,subject,reference,frame};await c.publish('native-media-sync1-setup',setup);
 const manifest=JSON.parse(await readFile(join(q,'sync-commission-manifest1.json')));await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:manifest.revision});
 const args={reference,assetId:frame.assetId,version:frame.assetVersion,key:'distinct-sync-private-frame-'+c.pointer.operation};
 for(const [name,http]of [['noJWT',c.http()],['ordinaryBearer',owner]]){const error=await denied(()=>http.action('mediaSyncProbe:start',args));groups.push({name:name+'-sync-admin-internal-denied',status:'PASS',error:c.publicError(error)});}
 const before=await c.admin.query('mediaProbe:ledger',{tenantId:scope.tenantId});assert.equal(before.attempts.length,0);
 await c.publish('native-media-sync1-before',before);
 const result=await c.admin.action('mediaSyncProbe:start',args);await c.publish('native-media-sync1-call',result);
 const after=await c.admin.query('mediaProbe:ledger',{tenantId:scope.tenantId});await c.publish('native-media-sync1-after',after);
 if(result.nativeStartRequests===1){assert.equal(after.attempts.length,1);assert.equal(after.attempts[0].reservationUnits,2000000);assert.ok(after.attempts[0].checkpointAt);assert.equal(after.attempts[0].measuredInputTokens,result.bodyBytes);assert.equal(after.probes[0].issuedCount,1);assert.equal(after.accounts.find(x=>x.kind==='tenant').uncertainUnits,2000000);}
 if(result.status==='ACTUAL_SYNC_VIDEO_MATERIALIZED'){
  assert.equal(result.confirmedModelCalls,1);assert.equal(result.asset.mediaKind,'video');assert.equal(result.asset.mimeType,'video/mp4');assert.ok(result.videoBytes<=20000000);assert.equal(result.asset.contentHash,result.videoHash);assert.deepEqual(result.asset.lineage.sourceVersionIds,[frame.versionId]);
  const ref={assetId:result.asset.assetId,version:result.asset.assetVersion};const blob=await client.fetchAsset(ref,{timeoutMs:120000});assert.equal(blob.type,'video/mp4');assert.equal(blob.size,result.videoBytes);assert.equal(sha(Buffer.from(await blob.arrayBuffer())),result.videoHash);
  const again=await client.fetchAsset(ref);assert.equal(sha(Buffer.from(await again.arrayBuffer())),result.videoHash);
  const peerSubject=subject+'-viewer',peer=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:peerSubject,actorKind:'user',...scope,resourceAccess:'space',capabilities:['read','storage:read'],expiresAt:Date.now()+7200000});
  const beforeRevoke=await c.http(peerSubject).mutation('runtimeAssets:get',{...scope,...ref});assert.equal(beforeRevoke.versionId,result.asset.versionId);await c.admin.mutation('runtimeAuth:revokeGrant',{grantId:peer.grantId});
  const response=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/cortex/assets/download?'+new URLSearchParams({...scope,assetId:ref.assetId,version:String(ref.version)}),{headers:{Authorization:'Bearer '+c.token(peerSubject)},signal:AbortSignal.timeout(15000)});assert.equal(response.status,403);
  groups.push({name:'genuine-sync-private-input-video-product-store-and-authorized-hash-MIME-delivery',status:'PASS',asset:result.asset,videoBytes:result.videoBytes,videoHash:result.videoHash,servingModelUnobserved:true,costUnavailable:true,ledgerByteReplay:false,peerRevokeStatus:response.status});
  const repeated=await c.admin.action('mediaSyncProbe:start',args);assert.equal(repeated.status,'NO_NEW_DISPATCH');assert.equal(repeated.nativeStartRequests,0);await c.publish('native-media-sync1-repeat',{result:repeated,newNativeRequests:0});
 } else groups.push({name:'sync-native-capability-or-terminal-unresolved',status:'UNQUALIFIED',result});
 const oldAfter=await c.admin.query('mediaProbe:ledger',{tenantId:c.tenantId});assert.equal(oldAfter.attempts.length,old.attempts.length);assert.equal(oldAfter.probes[0].issuedCount,1);for(const row of old.accounts){const current=oldAfter.accounts.find(x=>x.accountId===row.accountId);assert.equal(current.uncertainUnits,row.uncertainUnits);assert.equal(current.activeConcurrency,row.activeConcurrency);assert.equal(current.root.hash,row.root.hash);assert.equal(current.windowId,row.windowId);}
 await c.publish('native-media-sync1-old-async-after',oldAfter);
 const final=await c.admin.query('mediaProbe:ledger',{tenantId:scope.tenantId});assert.equal(final.attempts.length,after.attempts.length);await c.publish('native-media-sync1-final',final);
 const status=result.status==='ACTUAL_SYNC_VIDEO_MATERIALIZED'?'ACTUAL_R6_SYNC_PRIVATE_PROVIDER_MATERIALIZATION_PASS':'R6_SYNC_CAPABILITY_OR_TERMINAL_UNRESOLVED';
 await c.publish('native-media-sync1-outcomes',{status,groups,result,setup,projectId:c.state.projectId,oldAsyncLiabilityUnits:2000000,priorTask10LiabilityUnits:500000,shippedVideoQualification:false,Task13AsyncAvailability:false,terminalServingModelUnobserved:true,aggregateCostUnavailable:true,noPaidRetry:true});console.log(JSON.stringify({status,newNativeRequests:result.nativeStartRequests,confirmedModelCalls:result.confirmedModelCalls,videoBytes:result.videoBytes??null}));
}catch(error){await c.publish('native-media-sync1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:c.publicError(error),noBlindRetry:true});throw error;}finally{if(client)await client.close();await c.close();}
