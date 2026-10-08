/** Actual 20,000,000-byte HTTP boundary, plus separate generated-byte cap. No model dispatch. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha,denied} from './common.mjs';
const context=await openOwnedContext(),groups=[];let client;
try{
 await context.verifyTarget('native-boundary1-target-verified');const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json'))),scope=setup.owner.scope;
 client=await context.runtimeClient(setup.owner.subject);await client.session();
 const bytes=new Uint8Array(20000000);for(let at=0;at<bytes.length;at+=4096)bytes[at]=(at/4096)%251;
 const asset=await client.uploadAsset(bytes,{mimeType:'application/octet-stream',requestId:'exact-cap-'+context.pointer.operation,timeoutMs:120000});
 assert.equal(asset.sizeBytes,20000000);assert.equal(asset.contentHash,sha(bytes));
 const delivered=await client.fetchAsset({assetId:asset.assetId,version:asset.assetVersion},{timeoutMs:120000});assert.equal(delivered.size,20000000);assert.equal(sha(Buffer.from(await delivered.arrayBuffer())),asset.contentHash);
 groups.push({name:'actual-exact-application-cap-upload-and-download',status:'PASS',asset,receivedBytes:delivered.size,hashMatched:true});
 const before=await context.admin.query('task12Native:snapshot',scope);
 const localError=await denied(()=>client.uploadAsset(new Uint8Array(20000001),{mimeType:'application/octet-stream',requestId:'sdk-over-cap-'+context.pointer.operation}));assert.match(String(localError.code??localError.message),/ASSET_TOO_LARGE/);
 const url=new URL('/cortex/assets/upload',context.state.url.replace('.convex.cloud','.convex.site'));for(const[k,v]of Object.entries({...scope,requestId:'raw-stream-over-cap-'+context.pointer.operation}))url.searchParams.set(k,v);
 // No Content-Length: the application must count actual streamed bytes.
 let remaining=20000001;const stream=new ReadableStream({pull(controller){if(remaining===0){controller.close();return;}const count=Math.min(65536,remaining);remaining-=count;controller.enqueue(new Uint8Array(count));}});
 const response=await fetch(url,{method:'POST',body:stream,duplex:'half',headers:{Authorization:'Bearer '+context.token(setup.owner.subject),'Content-Type':'application/octet-stream'},redirect:'error',signal:AbortSignal.timeout(120000)});
 assert.equal(response.status,413);const rawDenial=await response.json();assert.equal(rawDenial.code,'ASSET_TOO_LARGE');
 const generated=await denied(()=>context.admin.action('task12Native:oversizedGenerated',{reference:setup.owner.reference,requestId:'generated-over-cap-'+context.pointer.operation}));assert.match(JSON.stringify(context.publicError(generated)),/ASSET_TOO_LARGE/);
 const after=await context.admin.query('task12Native:snapshot',scope);assert.equal(after.jobs.length,before.jobs.length);assert.equal(after.versions.length,before.versions.length);assert.equal(after.heads.length,before.heads.length);
 groups.push({name:'SDK-streamed-HTTP-and-generated-byte-over-cap-denied-before-ready',status:'PASS',rawHttpStatus:response.status,rawDenial,localError:context.publicError(localError),generated:context.publicError(generated),unchangedCatalogCounts:true,generatedIsQABytesNotProviderQualification:true});
 await context.publish('native-boundary1-outcomes',{status:'ACTUAL_PASS',groups,projectId:context.state.projectId,modelCalls:0,exactCapBytes:20000000,asset});console.log(JSON.stringify({status:'ACTUAL_PASS',groups:groups.length,modelCalls:0}));
}catch(error){await context.publish('native-boundary1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:context.publicError(error),modelCalls:0,noBlindRepeat:true});throw error;}finally{await context.close();}
