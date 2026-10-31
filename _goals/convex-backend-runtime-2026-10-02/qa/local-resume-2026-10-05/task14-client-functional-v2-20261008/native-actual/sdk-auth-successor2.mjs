/** Unpaid changed-source verification. Do not run before coherent successor install. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,q13,denied} from './common.mjs';

const packages=JSON.parse(await readFile(join(q13,'packages-current4.json')));
const installed=JSON.parse(await readFile(join(q13,'installed-current4-source-manifest.json')));
assert.equal(installed.packed.sdk.manifestSha256,packages.sdk.manifestSha256);
assert.notEqual(packages.sdk.manifestSha256,'b61d9bb5e99d8e9f025be9d811e7a27baed4b0b9978fef5db1f161446273d90f');
const c=await openOwnedContext(),groups=[],clients=[],ports=[],rpcKinds=[];
const runId='run:2eba9c812325eb3d8449c43730fb4f843c7fd6e716d75183b9ea63a8f8780903';
async function bounded(work){let timer;try{return await Promise.race([work,new Promise((_,reject)=>{
 timer=setTimeout(()=>reject(Error('NATIVE14_ORIGINAL_15000MS_LOCAL_DEADLINE')),15000);
})]);}finally{clearTimeout(timer);}}
const stableMoney=value=>value.accounts.map(row=>Object.fromEntries(['accountId','kind','root','windowId','windowStart','windowEnd','reservedUnits','uncertainUnits','settledUnits','activeConcurrency']
 .filter(key=>row[key]!==undefined).map(key=>[key,row[key]]))).sort((a,b)=>a.accountId.localeCompare(b.accountId));
try{
 await c.verifyTarget('native14-sdk-auth-successor2-target-verified');
 const before=await bounded(c.admin.query('task13Native:snapshot',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId}));
 const tokens=JSON.parse(await readFile(join(q13,'ui14-token-fixtures2.json')));
 const sdk=await import(pathToFileURL(join(c.host,'task13-runtime-entry.mjs')));
 const {ConvexClient}=await import(pathToFileURL(join(c.host,'node_modules/convex/dist/esm/browser/index.js')));
 const {getFunctionName}=await import(pathToFileURL(join(c.host,'node_modules/convex/dist/esm/server/index.js')));
 let token=c.token(c.ui.subject);
 const official=new ConvexClient(c.state.url,{logger:false});ports.push(official);
 const adapter={setAuth:official.setAuth.bind(official),close:official.close.bind(official),
  query:(ref,args)=>{rpcKinds.push({kind:'query',name:getFunctionName(ref)});return official.query(ref,args);},
  mutation:(ref,args)=>{rpcKinds.push({kind:'mutation',name:getFunctionName(ref)});return official.mutation(ref,args);},
  action:(ref,args)=>{rpcKinds.push({kind:'action',name:getFunctionName(ref)});return official.action(ref,args);},
  onUpdate:(ref,args,callback,onError)=>{rpcKinds.push({kind:'onUpdate-query',name:getFunctionName(ref)});return official.onUpdate(ref,args,callback,onError);}};
 const client=new sdk.CortexRuntimeClient({deploymentUrl:c.state.url,assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),
  scope:{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId},client:adapter,fetchToken:async()=>token});clients.push(client);
 const first=await bounded(client.session());assert.equal(first.principalId,c.ui.reference.principalId);
 const handle=await bounded(client.attach(runId));const initial=await bounded(client.observe(handle,{limit:100}));
 assert.equal(initial.state,'complete');assert.equal(initial.run.responseStatus,'complete');
 token=c.token(c.ui.subject);await bounded(client.refreshAuth());
 const replacement=await bounded(client.session());assert.equal(replacement.principalId,first.principalId);
 const job=await bounded(client.getMediaJob(c.ui.savedJobId)),artifact=await bounded(client.getArtifact(c.ui.savedArtifactId));
 assert.equal(job.asset.versionId,artifact.file.versionId);
 groups.push({name:'changed-source-same-principal-refresh-keeps-existing-run-and-owned-image-reference',status:'PASS',runId,versionId:job.asset.versionId,providerCalls:0});
 let unsubscribe=()=>{};
 const watched=await bounded(new Promise((resolve,reject)=>{
  unsubscribe=client.watchObservation(handle,resolve,reject,{finalOnly:true});
 }));unsubscribe();
 assert.equal(watched.state,'complete');assert.equal(watched.run.runId,runId);
 assert.ok(rpcKinds.some(row=>row.kind==='onUpdate-query'&&row.name==='runtimeClient:signal'));
 for(const name of ['runtimeClient:session','runs:get','runtimeAgent:observe','artifacts:get']){
  assert.ok(rpcKinds.some(row=>row.kind==='mutation'&&row.name===name));
  assert.equal(rpcKinds.some(row=>row.kind==='query'&&row.name===name),false);
 }
 groups.push({name:'official-opaque-query-invalidation-and-fresh-mutation-protected-delivery',status:'PASS',runId,
  sensitiveRpcKinds:rpcKinds.filter(row=>row.kind!=='onUpdate-query'),opaqueQuery:'runtimeClient:signal',watchUnsubscribed:true,modelCalls:0});
 token=(await readFile(tokens.expired,'utf8')).trim();const started=performance.now();
 const rejected=await denied(()=>bounded(client.refreshAuth()));const elapsedMs=performance.now()-started;
 assert.ok(['AUTHENTICATION_TIMEOUT','UNAUTHENTICATED'].includes(rejected.code), 'Must reject with truthful SDK auth result before original local deadline');
 assert.ok(elapsedMs<15000);const withheld=await denied(()=>bounded(client.getMediaJob(c.ui.savedJobId)));
 assert.ok(['AUTHENTICATION_TIMEOUT','UNAUTHENTICATED'].includes(withheld.code));
 groups.push({name:'original-fifteen-second-bound-expired-refresh-settles-and-withholds-protected-read',status:'PASS',
  code:rejected.code,outcome:rejected.outcome,elapsedMs,localDeadlineMs:15000,
  serverJwtVerdictClaimed:rejected.code==='UNAUTHENTICATED',withheldCode:withheld.code,newModelCalls:0});
 await client.close();clients.splice(clients.indexOf(client),1);await official.close();ports.splice(ports.indexOf(official),1);
 const after=await bounded(c.admin.query('task13Native:snapshot',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId}));
 assert.deepEqual(after.attempts.map(row=>row.attemptId).sort(),before.attempts.map(row=>row.attemptId).sort());
 assert.deepEqual(after.operations.map(row=>row.operationId).sort(),before.operations.map(row=>row.operationId).sort());
 assert.deepEqual(stableMoney(after),stableMoney(before));
 groups.push({name:'same-installed-run-auth-watcher-controls-add-no-paid-operation-or-financial-reset',status:'PASS',attempts:after.attempts.length,operations:after.operations.length,financialCountersUnchanged:true,newPaidCalls:0});
 await c.publish('sdk-auth-successor2-outcomes',{status:'ACTUAL_CHANGED_SOURCE_UNPAID_AUTH_CONTROLS_PASS',groups,
  candidateManifestSha256:packages.sdk.manifestSha256,installedSourceManifest:join(q13,'installed-current4-source-manifest.json'),
  originalExpiredRed:'sdk-controls1-outcomes.json',originalLocalDeadlineMs:15000,noPaidRetry:true,clientsClosed:true,officialPortsClosed:true,newPaidCalls:0});
 console.log(JSON.stringify({status:'ACTUAL_CHANGED_SOURCE_UNPAID_AUTH_CONTROLS_PASS',groups:groups.length,newPaidCalls:0}));
}catch(error){await c.publish('sdk-auth-successor2-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:c.publicError(error),newPaidCalls:0,noPaidRetry:true});throw error;}
finally{for(const client of clients)await client.close();for(const port of ports)await port.close();await c.close();}
