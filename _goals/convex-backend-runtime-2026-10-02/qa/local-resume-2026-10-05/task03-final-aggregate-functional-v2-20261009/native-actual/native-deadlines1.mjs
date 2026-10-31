import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openNativeContext,q,scope,authorityReference,sha,denied} from './common.mjs';
import {privateFramePng} from '../../task12-asset-functional-v2-20261008/native-actual/private-frame.mjs';
const c=await openNativeContext({signal:AbortSignal.timeout(150000),requestTimeoutMs:15000}),groups=[],clients=[];
const initial=Date.now(),record=async group=>{groups.push(group);await c.publish('native-deadlines1-progress'+groups.length,{groups,modelCalls:0});};
const failure=error=>c.publicError(error);
const caps=['read','write','run','admin','storage:read','storage:write'];
async function provision(name,{resourceAccess='own',expiresAt=Date.now()+7200000,capabilities=caps,otherScope=scope}={}) {
 const subject='task03-aggregate-'+name+'-20261009',value=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject,actorKind:'user',...otherScope,resourceAccess,capabilities,expiresAt});
 return {subject,reference:authorityReference(value),expiresAt};
}
async function request(actor,path,{query={},body,method='GET'}={}) {
 const url=new URL(c.state.url.replace('.convex.cloud','.convex.site')+path);for(const[key,value]of Object.entries({...scope,...query}))url.searchParams.set(key,String(value));
 const response=await fetch(url,{method,headers:{Authorization:'Bearer '+c.token(actor.subject),...(body?{'Content-Type':'image/png'}:{})},...(body?{body}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
 const bytes=Buffer.from(await response.arrayBuffer()),trace=JSON.parse(response.headers.get('X-Cortex-QA-Trace')??'[]');return {status:response.status,mime:response.headers.get('Content-Type'),bytes,trace};
}
const traceCross=result=>{const crossing=result.trace.filter(row=>row.delayed);assert.equal(crossing.length,1);const row=crossing[0];assert.ok(row.rpcReturnedAt<row.returnedDeliveryExpiresAt);assert.ok(row.releasedAt>=row.returnedDeliveryExpiresAt);return row;};
try {
 await c.verifyTarget('native-deadlines1-target-verified');
 const before=await c.admin.query('task03Deadline:snapshot',{});await c.publish('native-deadlines1-financial-before',before);
 const owner=await provision('owner'),viewer=await provision('viewer',{resourceAccess:'space',capabilities:['read','storage:read']}),foreign=await provision('foreign',{otherScope:{tenantId:scope.tenantId+'-foreign',memorySpaceId:scope.memorySpaceId+'-foreign'}});
 const operator=await provision('operator',{resourceAccess:'space'}),ownerHttp=c.http(owner.subject),viewerHttp=c.http(viewer.subject),foreignHttp=c.http(foreign.subject),noJwt=c.http();
 await c.publish('native-deadlines1-setup',{scope,owner,viewer,foreign,operator,projectId:c.state.projectId,credentialsPublished:false,fixtureProjectionIsNotModelEvidence:true});
 const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
 const {ConvexClient}=await import(pathToFileURL(join(c.host,'node_modules/convex/dist/esm/browser/index.js')));
 const {getFunctionName}=await import(pathToFileURL(join(c.host,'node_modules/convex/dist/esm/server/index.js')));
 const runtime=new CortexRuntimeClient({deploymentUrl:c.state.url,assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),fetchToken:async()=>c.token(owner.subject),scope});clients.push(runtime);
 const session=await runtime.session();assert.equal(session.principalId,owner.reference.principalId);
 const noIdentity=await denied(()=>noJwt.mutation('runtimeClient:session',scope)),wrongScope=await denied(()=>foreignHttp.mutation('runtimeClient:session',scope));assert.match(JSON.stringify(failure(noIdentity)),/UNAUTHENTICATED/);assert.match(JSON.stringify(failure(wrongScope)),/FORBIDDEN/);
 const internal=await denied(()=>ownerHttp.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'not-authorized',actorKind:'user',...scope,resourceAccess:'own',capabilities:['read']}));assert.match(JSON.stringify(failure(internal)),/not found|not registered|internal|Could not find/i);
 const profile=await runtime.getEmbeddingProfile();assert.equal(profile.profile.dimensions,1536);
 await record({name:'fresh-scoped-identity-and-private-operator-boundary',status:'PASS',session,noIdentity:failure(noIdentity),wrongScope:failure(wrongScope),ordinaryInternalProvision:failure(internal),profile,modelCalls:0});
 const frame=privateFramePng(),asset=await runtime.uploadAsset(frame,{mimeType:'image/png',filename:'aggregate03-private.png',requestId:'aggregate03-frame'});assert.equal(asset.contentHash,sha(frame));
 const healthy=await request(owner,'/cortex/assets/download',{query:{assetId:asset.assetId,version:asset.assetVersion}});assert.equal(healthy.status,200);assert.equal(sha(healthy.bytes),asset.contentHash);
 const providerPositive=await c.admin.action('task03Deadline:privateInput',{reference:owner.reference,assetId:asset.assetId,version:asset.assetVersion,delay:false});assert.equal(providerPositive.outcome,'returned');assert.equal(providerPositive.metadata.versionId,asset.versionId);
 await record({name:'current-native-private-storage-http-and-provider-materialization',status:'PASS',asset,http:{status:healthy.status,bytes:healthy.bytes.length,sha256:sha(healthy.bytes)},privateInput:providerPositive,actualProviderDispatches:0});
 const downloadActor=await provision('http-expiry',{resourceAccess:'space',capabilities:['read','storage:read'],expiresAt:Date.now()+5000});
 const lateHttp=await request(downloadActor,'/qa/task03/assets/download',{query:{assetId:asset.assetId,version:asset.assetVersion,delay:1}});assert.equal(lateHttp.status,403);assert.deepEqual(JSON.parse(lateHttp.bytes),{version:1,code:'FORBIDDEN'});const httpCross=traceCross(lateHttp);
 await record({name:'actual-http-action-withholds-bytes-after-final-rpc-grant-cutoff',status:'PASS',QAOnlyRoute:true,productHandlerForwarded:true,response:JSON.parse(lateHttp.bytes),statusCode:lateHttp.status,trace:lateHttp.trace,crossing:httpCross,bytesDisclosed:0,modelCalls:0});
 const providerActor=await provision('private-expiry',{resourceAccess:'space',capabilities:['read','storage:read'],expiresAt:Date.now()+5000});
 const lateProvider=await c.admin.action('task03Deadline:privateInput',{reference:providerActor.reference,assetId:asset.assetId,version:asset.assetVersion,delay:true});assert.equal(lateProvider.outcome,'withheld');assert.equal(lateProvider.code,'FORBIDDEN');traceCross(lateProvider);
 await record({name:'private-provider-input-withheld-after-final-real-rpc-cutoff',status:'PASS',result:lateProvider,actualProviderDispatches:0,fakeClock:false});
 const uploadActor=await provision('upload-expiry',{expiresAt:Date.now()+5000});
 const lateUpload=await request(uploadActor,'/qa/task03/assets/upload',{method:'POST',body:frame,query:{requestId:'aggregate03-late-upload',filename:'late-upload.png',delay:1}});assert.equal(lateUpload.status,403);assert.deepEqual(JSON.parse(lateUpload.bytes),{version:1,code:'FORBIDDEN'});traceCross(lateUpload);
 const uploads=await c.admin.query('task12Native:snapshot',scope),upload=uploads.jobs.find(row=>row.requestId==='aggregate03-late-upload');assert.equal(upload.state,'ready');assert.ok(uploads.versions.find(row=>row.versionId===upload.versionId)?.physicalStorage);
 await record({name:'actual-http-upload-suppresses-ready-dto-after-confirmed-storage-commit',status:'PASS',QAOnlyRoute:true,trace:lateUpload.trace,response:JSON.parse(lateUpload.bytes),jobId:upload.jobId,state:upload.state,physicalBytesRetained:true,metadataDisclosed:false,modelCalls:0});
 const generatedActor=await provision('generated-expiry',{expiresAt:Date.now()+5000});
 const lateGenerated=await c.admin.action('task03Deadline:generated',{reference:generatedActor.reference,requestId:'aggregate03-late-generated',delay:true});assert.equal(lateGenerated.outcome,'withheld');assert.equal(lateGenerated.code,'FORBIDDEN');traceCross(lateGenerated);
 const stored=await c.admin.query('task12Native:snapshot',scope),generated=stored.jobs.find(row=>row.requestId==='aggregate03-late-generated');assert.equal(generated.state,'ready');assert.ok(stored.versions.find(row=>row.versionId===generated.versionId)?.physicalStorage);
 await record({name:'qa-generated-byte-ready-delivery-fenced-after-stored-checkpoint',status:'PASS',generatedByQA:true,providerOutputClaim:false,result:lateGenerated,jobId:generated.jobId,physicalBytesRetained:true,modelCalls:0});
 const conversation=await ownerHttp.mutation('runtimeTranscript:create',{memorySpaceId:scope.memorySpaceId,clientRequestId:'aggregate03-file-anchor'});
 const bound=await c.admin.mutation('task12Native:bindAgentFile',{reference:owner.reference,conversationId:conversation.conversationId,versionId:asset.versionId});assert.equal(bound.textBytes,0);assert.equal(bound.pins.length,1);
 const nativeMessageId=bound.pins[0].nativeMessageId;
 const artifact=await ownerHttp.mutation('artifacts:create',{...scope,artifactId:'aggregate03-anchored',title:'Unpaid canonical anchor',content:'QA setup metadata; no LLM claim',conversationRef:{conversationId:conversation.conversationId,messageId:nativeMessageId}});
 await ownerHttp.mutation('artifacts:attachAsset',{...scope,artifactId:artifact.artifactId,assetId:asset.assetId,version:asset.assetVersion});
 const seeded=await c.admin.mutation('task03Deadline:seedObservation',{reference:owner.reference,conversationId:conversation.conversationId,artifactId:artifact.artifactId,requestId:'aggregate03-unpaid-observation'});
 const permissions={canView:true,canExport:true,canViewFacts:false,canViewMemories:false,canContinue:false,canFork:false};
 const share=await ownerHttp.mutation('conversationShares:create',{...scope,conversationId:conversation.conversationId,grantedBy:owner.reference.principalId,grantType:'user',grantedTo:viewer.reference.principalId,permissions,expiresAt:Date.now()+60000});
 const run=await viewerHttp.mutation('runs:get',{...scope,runId:seeded.runId});
 const viewerSession=await viewerHttp.mutation('runtimeClient:session',scope),handle={version:1,runId:seeded.runId,conversationId:seeded.conversationId,agentId:run.agentId,agentVersion:run.agentVersion,definitionHash:run.definitionHash,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,principalId:viewerSession.principalId,userId:viewerSession.userId};
 const positiveClient=new CortexRuntimeClient({deploymentUrl:c.state.url,fetchToken:async()=>c.token(viewer.subject),scope});clients.push(positiveClient);const positiveObservation=await positiveClient.observe(handle);assert.equal(positiveObservation.parts.length,1);assert.equal(positiveObservation.parts[0].part.text,'UNPAID_TASK03_PROJECTION_SENTINEL');
 const exhausted=await viewerHttp.mutation('runtimeAgent:observe',{...scope,runId:seeded.runId,afterSequence:1});assert.deepEqual(exhausted.parts,[]);
 await positiveClient.close();clients.splice(clients.indexOf(positiveClient),1);await ownerHttp.mutation('conversationShares:revoke',{...scope,shareId:share.shareId});
 const revokedFull=await denied(()=>viewerHttp.mutation('runtimeAgent:observe',{...scope,runId:seeded.runId})),revokedEmpty=await denied(()=>viewerHttp.mutation('runtimeAgent:observe',{...scope,runId:seeded.runId,afterSequence:1}));assert.match(JSON.stringify(failure(revokedFull)),/FORBIDDEN/);assert.match(JSON.stringify(failure(revokedEmpty)),/FORBIDDEN/);
 await record({name:'canonical-artifact-anchor-and-full-exhausted-observer-share-revocation',status:'PASS',QAOnlyProjectionNotModelOutput:true,runId:seeded.runId,nativeMessageId,artifactWitness:seeded.artifactWitness,positiveParts:positiveObservation.parts,exhaustedCursor:exhausted.cursor,fullDenial:failure(revokedFull),exhaustedDenial:failure(revokedEmpty),modelCalls:0});
 const shortShare=await ownerHttp.mutation('conversationShares:create',{...scope,conversationId:conversation.conversationId,grantedBy:owner.reference.principalId,grantType:'user',grantedTo:viewer.reference.principalId,permissions,expiresAt:Date.now()+6500});
 const port=new ConvexClient(c.state.url,{logger:false}),rpcTrace=[];let observedDeadline;
 const borrowed={setAuth:port.setAuth.bind(port),query:port.query.bind(port),action:port.action.bind(port),onUpdate:port.onUpdate.bind(port),close:port.close.bind(port),mutation:async(ref,args)=>{
   const name=getFunctionName(ref),began=Date.now();const value=await port.mutation(ref,args);const returnedAt=Date.now();let delayed=false;
   if(name==='runtimeAgent:observe')observedDeadline=value.deliveryExpiresAt;
   else if(name==='runtimeClient:session'&&observedDeadline!==undefined){assert.ok(observedDeadline-returnedAt<8000);assert.ok(returnedAt<observedDeadline);await new Promise(done=>setTimeout(done,Math.max(0,observedDeadline-Date.now()+60)));delayed=true;}
   rpcTrace.push({name,began,returnedAt,releasedAt:Date.now(),delayed,observedDeadline:observedDeadline??null});return value;
 }};
 const slowClient=new CortexRuntimeClient({deploymentUrl:c.state.url,fetchToken:async()=>c.token(viewer.subject),scope,client:borrowed,requestTimeoutMs:12000});clients.push(slowClient);
 const lateSdk=await denied(()=>slowClient.observe(handle));assert.equal(lateSdk.code,'AUTHORITY_EXPIRED');assert.equal(rpcTrace.filter(row=>row.name==='runtimeAgent:observe').length,1);assert.equal(rpcTrace.filter(row=>row.name==='runtimeClient:session').length,2);assert.equal(rpcTrace.filter(row=>row.delayed).length,1);
 const permanentActor=await viewerHttp.mutation('runtimeClient:session',scope);assert.equal(permanentActor.principalId,viewer.reference.principalId);
 await slowClient.close();clients.splice(clients.indexOf(slowClient),1);await port.close();
 await record({name:'installed-sdk-one-shot-observe-withholds-after-final-session-consumed-share-expiry',status:'PASS',callerPortDecorator:true,serverHTTPClaim:false,realOfficialRPCs:true,fakeClock:false,shortShareId:shortShare.shareId,shortShareExpiresAt:shortShare.expiresAt,viewerActorStillCurrent:permanentActor,denial:failure(lateSdk),rpcTrace,protectedPartsReturnedToCaller:false,modelCalls:0});
 const currentConversation=await ownerHttp.mutation('runtimeTranscript:get',{...scope,conversationId:conversation.conversationId});
 await ownerHttp.mutation('runtimeTranscript:setPolicy',{...scope,conversationId:conversation.conversationId,expectedRevision:currentConversation.historyRevision,manualWriteLocked:false});
 const afterPolicy=await ownerHttp.mutation('runtimeTranscript:get',{...scope,conversationId:conversation.conversationId});
 await ownerHttp.mutation('runtimeTranscript:removeMessage',{...scope,conversationId:conversation.conversationId,expectedRevision:afterPolicy.historyRevision,messageId:nativeMessageId,expectedMessageRevision:1});
 const deletedAnchor=await denied(()=>c.admin.mutation('task03Deadline:artifactContext',{reference:owner.reference,artifactId:artifact.artifactId})),exhaustedAnchor=await denied(()=>ownerHttp.mutation('runtimeAgent:observe',{...scope,runId:seeded.runId,afterSequence:1}));assert.match(JSON.stringify(failure(deletedAnchor)),/FORBIDDEN|STALE_CONTEXT/);assert.match(JSON.stringify(failure(exhaustedAnchor)),/FORBIDDEN|STALE_CONTEXT/);
 await record({name:'registered-native-message-deletion-invalidates-artifact-context-and-exhausted-observer',status:'PASS',nativeMessageId,deletedAnchor:failure(deletedAnchor),exhaustedDenial:failure(exhaustedAnchor),modelCalls:0});
 const after=await c.admin.query('task03Deadline:snapshot',{});await c.publish('native-deadlines1-financial-after',after);assert.deepEqual(after.attempts,before.attempts);assert.deepEqual(after.accounts.filter(row=>row.tenantId!==scope.tenantId),before.accounts);
 for(const row of after.accounts.filter(row=>row.tenantId===scope.tenantId)){assert.equal(row.reservedUnits,0);assert.equal(row.settledUnits,0);assert.equal(row.uncertainUnits,0);assert.equal(row.activeConcurrency,0);}
 await c.publish('native-deadlines1-outcomes',{status:'ACTUAL_UNPAID_DEADLINE_ANCHOR_OBSERVER_PASS',projectId:c.state.projectId,scope,groups,elapsedMs:Date.now()-initial,modelCalls:0,newModelAttempts:0,allPriorFinancialRootsWindowsCountersPreserved:true,newAccountsHaveZeroLiability:true,QAOnlyProjectionAndHTTPDelayRoutes:true,currentProductPack:'packages5.json',cleanupPending:true});console.log(JSON.stringify({status:'ACTUAL_UNPAID_PASS',groups:groups.length,modelCalls:0}));
}catch(error){await c.publish('native-deadlines1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:failure(error),modelCalls:0,noPaidRetry:true,scope,cleanupPending:true});throw error;}
finally{for(const client of clients)await client.close();await c.close();}
