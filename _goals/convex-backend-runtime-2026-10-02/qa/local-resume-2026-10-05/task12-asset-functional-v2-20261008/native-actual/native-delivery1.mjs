/** Installed ./runtime helpers, native private HTTP, bounded upload replay. No inference. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha,denied} from './common.mjs';
const context=await openOwnedContext(),groups=[];let client;
const pass=(name,evidence)=>groups.push({name,status:'PASS',...evidence});
try{
 await context.verifyTarget('native-delivery1-target-verified');
 const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json'))),scope=setup.owner.scope;
 client=await context.runtimeClient(setup.owner.subject);const session=await client.session();assert.equal(session.tenantId,scope.tenantId);assert.equal(session.memorySpaceId,scope.memorySpaceId);
 // A valid tiny PNG. Its binary payload is never logged or written into transcript rows.
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
 const requestId='private-png-'+context.pointer.operation;
 const asset=await client.uploadAsset(bytes,{mimeType:'image/png',filename:'owned.png',requestId});
 assert.equal(asset.contentHash,sha(bytes));assert.equal(asset.sizeBytes,bytes.length);assert.equal(asset.mimeType,'image/png');assert.equal(asset.mediaKind,'image');assert.deepEqual(asset.lineage,{kind:'upload',requestId});
 assert.deepEqual(Object.keys(asset).sort(),['version','assetId','versionId','assetVersion','contentHash','sizeBytes','mimeType','mediaKind','filename','lineage'].sort());
 const reference={assetId:asset.assetId,version:asset.assetVersion};
 const blob=await client.fetchAsset(reference);assert.equal(blob.size,bytes.length);assert.equal(blob.type,'image/png');assert.equal(sha(Buffer.from(await blob.arrayBuffer())),asset.contentHash);
 const preview=await client.createAssetUrl(reference);assert.ok(preview.url.startsWith('blob:'));assert.equal(preview.sizeBytes,bytes.length);const rendered=await fetch(preview.url);assert.equal(sha(Buffer.from(await rendered.arrayBuffer())),asset.contentHash);preview.revoke();await denied(()=>fetch(preview.url));
 pass('installed-helper-private-PNG-delivery-and-local-preview',{asset,receivedBytes:blob.size,blobPreviewManuallyRevoked:true,noPublicStorageIdOrBearerUrl:true});
 const before=await context.admin.query('task12Native:snapshot',scope);
 const replay=await client.uploadAsset(bytes,{mimeType:'image/png',filename:'owned.png',requestId});assert.deepEqual(replay,asset);
 const after=await context.admin.query('task12Native:snapshot',scope);
 assert.equal(after.jobs.length,before.jobs.length);assert.equal(after.versions.length,before.versions.length);assert.equal(after.heads.length,before.heads.length);
 const conflict=await denied(()=>client.uploadAsset(new Uint8Array([1,2,3]),{mimeType:'image/png',filename:'owned.png',requestId}));assert.match(String(conflict.code??conflict.message),/ASSET_IDEMPOTENCY_CONFLICT/);
 pass('same-request-ready-replay-and-changed-input-conflict',{sameAssetVersion:true,jobCounts:[before.jobs.length,after.jobs.length],versionCounts:[before.versions.length,after.versions.length],conflict:context.publicError(conflict)});
 const url=new URL('/cortex/assets/download',context.state.url.replace('.convex.cloud','.convex.site'));for(const[k,v]of Object.entries({...scope,assetId:asset.assetId,version:String(asset.assetVersion)}))url.searchParams.set(k,v);
 const unauth=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(60000)});assert.equal(unauth.status,401);const noJwt=await unauth.json();assert.equal(noJwt.code,'UNAUTHENTICATED');
 const reader=await fetch(url,{headers:{Authorization:'Bearer '+context.token(setup.reader.subject)},redirect:'error',signal:AbortSignal.timeout(60000)});assert.equal(reader.status,403);const readerDenied=await reader.json();assert.equal(readerDenied.code,'FORBIDDEN');
 const foreign=await fetch(url,{headers:{Authorization:'Bearer '+context.token(setup.foreign.subject)},redirect:'error',signal:AbortSignal.timeout(60000)});assert.ok([401,403].includes(foreign.status));const foreignDenied=await foreign.json();assert.ok(['UNAUTHENTICATED','FORBIDDEN'].includes(foreignDenied.code));
 pass('no-JWT-own-only-peer-and-foreign-byte-denials',{noJwt,ownOnlyPeer:readerDenied,foreign:foreignDenied,deniedBodiesContainNoAssetBytes:true});
 // The read-write operator can access space-owned resources under its current scoped grant.
 const operator=context.http(setup.operator.subject);const operatorMetadata=await operator.mutation('runtimeAssets:get',{...scope,...reference});assert.equal(operatorMetadata.versionId,asset.versionId);
 await context.admin.mutation('runtimeAuth:revokeGrant',{grantId:setup.operator.reference.grantId});
 const revoked=await fetch(url,{headers:{Authorization:'Bearer '+context.token(setup.operator.subject)},redirect:'error',signal:AbortSignal.timeout(60000)});assert.equal(revoked.status,403);const revokedDenied=await revoked.json();assert.equal(revokedDenied.code,'FORBIDDEN');
 pass('current-grant-revocation-byte-denial',{authorizedBefore:true,revoked:revokedDenied});
 await context.publish('native-delivery1-outcomes',{status:'ACTUAL_PASS',groups,projectId:context.state.projectId,modelCalls:0,asset,sourceScope:'coherent-installed-task12-candidate',installedRuntimeEntry:true});
 console.log(JSON.stringify({status:'ACTUAL_PASS',groups:groups.length,modelCalls:0}));
}catch(error){await context.publish('native-delivery1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:context.publicError(error),modelCalls:0,noBlindRepeat:true});throw error;}finally{await context.close();}
