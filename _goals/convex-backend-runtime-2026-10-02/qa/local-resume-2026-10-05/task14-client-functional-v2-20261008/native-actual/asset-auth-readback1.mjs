/** Existing UI upload plus native auth negatives, separate from the SDK auth handshake. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q13,sha,denied} from './common.mjs';
const c=await openOwnedContext(),groups=[],scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};let client;
async function bounded(work){let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('NATIVE14_NONPAID_RPC_DEADLINE')),15000);})]);}finally{clearTimeout(timer);}}
function code(error){return {name:error?.name??'Error',code:error?.data?.code??error?.code??null,outcome:error?.data?.outcome??error?.outcome??null};}
try{
 await c.verifyTarget('native14-asset-auth-readback1-target-verified');
 const before=await bounded(c.admin.query('task13Native:snapshot',scope));
 const page=await bounded(c.admin.query('_system/cli/tableData',{table:'runtimeAssetVersions',order:'desc',paginationOpts:{cursor:null,numItems:100}}));assert.equal(page.isDone,true);
 const rows=page.page.filter(row=>row.tenantId===c.tenantId&&row.memorySpaceId===c.memorySpaceId&&row.filename==='owned-runtime-ui.txt');assert.equal(rows.length,1);const uploaded=rows[0];assert.equal(uploaded.ownerPrincipalId,c.ui.reference.principalId);assert.equal(uploaded.sizeBytes,54);assert.equal(uploaded.assetVersion,1);assert.equal(uploaded.state,'ready');
 client=await c.runtimeClient(c.ui.subject);const metadata=await bounded(client.getAsset({assetId:uploaded.assetId,version:1})),blob=await bounded(client.fetchAsset({assetId:uploaded.assetId,version:1})),bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.length,54);assert.equal(sha(bytes),uploaded.contentHash);assert.equal(metadata.contentHash,uploaded.contentHash);assert.equal(metadata.filename,'owned-runtime-ui.txt');
 groups.push({name:'root-ui-upload-existing-version-private-native-byte-readback',status:'PASS',assetId:metadata.assetId,versionId:metadata.versionId,assetVersion:metadata.assetVersion,filename:metadata.filename,mimeType:metadata.mimeType,sizeBytes:54,contentHash:metadata.contentHash,modelCalls:0});
 const noJwt=await denied(()=>bounded(c.http().query('runtimeClient:session',scope)));assert.equal(noJwt.data?.code,'UNAUTHENTICATED');
 const tokens=JSON.parse(await readFile(join(q13,'ui14-token-fixtures2.json'))),expired=(await readFile(tokens.expired,'utf8')).trim(),expiredHttp=c.http();expiredHttp.setAuth(expired);const expiredRpc=await denied(()=>bounded(expiredHttp.query('runtimeClient:session',scope)));assert.notEqual(expiredRpc.message,'NATIVE14_NONPAID_RPC_DEADLINE');
 groups.push({name:'direct-current-native-rpc-no-jwt-and-signed-expired-jwt-denied',status:'PASS',noJwt:code(noJwt),expiredJwt:code(expiredRpc),separateFromSdkHandshake:true,modelCalls:0});
 const url=new URL(c.state.url.replace('.convex.cloud','.convex.site')+'/cortex/assets/download');for(const [key,value]of Object.entries({...scope,assetId:metadata.assetId,version:'1'}))url.searchParams.set(key,value);
 const httpDenials=[];
 for(const [label,token]of [['no-jwt',null],['signed-expired-jwt',expired]]){const response=await fetch(url,{headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(15000),redirect:'error'}),body=await response.text();assert.ok(response.status>=400);assert.notEqual(response.headers.get('content-type'),metadata.mimeType);let value;try{value=JSON.parse(body);}catch{value=null;}httpDenials.push({label,status:response.status,errorCode:value?.code??null,responseBytes:Buffer.byteLength(body),protectedAssetBytesDelivered:0});}
 groups.push({name:'native-private-http-withholds-owned-bytes-for-no-jwt-and-expired-jwt',status:'PASS',denials:httpDenials,modelCalls:0});
 const after=await bounded(c.admin.query('task13Native:snapshot',scope));assert.deepEqual(after.attempts.map(row=>row.attemptId).sort(),before.attempts.map(row=>row.attemptId).sort());assert.deepEqual(after.operations.map(row=>row.operationId).sort(),before.operations.map(row=>row.operationId).sort());
 await c.closeClient(client);client=undefined;
 await c.publish('asset-auth-readback1',{status:'ACTUAL_INSTALLED_NONPAID_ASSET_AND_AUTH_PASS',observedAt:new Date().toISOString(),groups,metadata,existingNativeVersion:{versionId:uploaded.versionId,ownerPrincipalId:uploaded.ownerPrincipalId,state:uploaded.state,physicalStorageIdRetainedPrivately:true},attemptCountBefore:before.attempts.length,attemptCountAfter:after.attempts.length,operationCountBefore:before.operations.length,operationCountAfter:after.operations.length,candidateManifestSha256:JSON.parse(await readFile(join(q13,'installed-current3-source-manifest.json'))).packed.sdk.manifestSha256,noNewProviderRequests:true,ownedClientClosed:true,downloadedBrowserFileNotClaimed:true});
 await c.publish('asset-auth-readback1-outcomes',{status:'ACTUAL_INSTALLED_NONPAID_ASSET_AND_AUTH_PASS',groups,newProviderRequests:0,ownedClientClosed:true});console.log(JSON.stringify({status:'ACTUAL_INSTALLED_NONPAID_ASSET_AND_AUTH_PASS',groups:groups.length,newProviderRequests:0}));
}catch(error){await c.publish('asset-auth-readback1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:c.publicError(error),noPaidRetry:true});throw error;}finally{if(client)await c.closeClient(client);await c.close();}
