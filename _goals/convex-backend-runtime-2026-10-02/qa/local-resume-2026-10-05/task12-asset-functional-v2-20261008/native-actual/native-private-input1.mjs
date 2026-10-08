/** Materialization limits are independent of application delivery and paid qualification. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {privateFramePng} from './private-frame.mjs';
import {openOwnedContext,q,sha,denied} from './common.mjs';
const context=await openOwnedContext(),groups=[];let client;
try{
 await context.verifyTarget('native-private-input1-target-verified');const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json'))),scope=setup.owner.scope;
 client=await context.runtimeClient(setup.owner.subject);await client.session();
 const frame=privateFramePng(),asset=await client.uploadAsset(frame,{mimeType:'image/png',filename:'private-first-frame.png',requestId:'fixed-private-first-frame-'+context.pointer.operation});assert.equal(asset.sizeBytes,1496);assert.equal(asset.contentHash,sha(frame));
 const args={reference:setup.owner.reference,assetId:asset.assetId,version:asset.assetVersion,protocol:'image-inline-v1'},input=await context.admin.action('runtimeAssets:readProviderInput',args);assert.equal(input.metadata.versionId,asset.versionId);assert.equal(input.metadata.contentHash,asset.contentHash);assert.equal(input.envelope.image,'data:image/png;base64,'+frame.toString('base64'));assert.ok(input.protocolBytes<8192);assert.ok(!JSON.stringify(input.envelope).includes('http'));
 const ownPeer=await denied(()=>context.admin.action('runtimeAssets:readProviderInput',{...args,reference:setup.reader.reference}));assert.match(JSON.stringify(context.publicError(ownPeer)),/FORBIDDEN/);
 const foreign=await denied(()=>context.admin.action('runtimeAssets:readProviderInput',{...args,reference:setup.foreign.reference}));assert.match(JSON.stringify(context.publicError(foreign)),/FORBIDDEN|ASSET_NOT_READY/);
 const wrongProtocol=await denied(()=>context.admin.action('runtimeAssets:readProviderInput',{...args,protocol:'video-inline-v1'}));assert.match(JSON.stringify(context.publicError(wrongProtocol)),/PROVIDER_INPUT_UNSUPPORTED/);
 groups.push({name:'exact-private-PNG-frame-bytes-and-current-scope-materialization',status:'PASS',asset,protocol:'image-inline-v1',protocolBytes:input.protocolBytes,privateEnvelopeSha256:sha(JSON.stringify(input.envelope)),dataUriContainsNoUrl:true,ownPeer:context.publicError(ownPeer),foreign:context.publicError(foreign),wrongProtocol:context.publicError(wrongProtocol),modelCalls:0});
 // A valid ancillary PNG text chunk makes a delivery-eligible image larger than
 // the encoded provider envelope limit. It is rejected before any provider call.
 const text=Buffer.concat([Buffer.from('QA boundary\0'),Buffer.alloc(13000000,65)]),type=Buffer.from('tEXt');let crc=0xffffffff;for(const byte of Buffer.concat([type,text])){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const chunk=Buffer.alloc(12+text.length);chunk.writeUInt32BE(text.length);type.copy(chunk,4);text.copy(chunk,8);chunk.writeUInt32BE(crc,8+text.length);
 const largeFrame=Buffer.concat([frame.subarray(0,frame.length-12),chunk,frame.subarray(frame.length-12)]);assert.ok(largeFrame.length<20000000);assert.ok(4*Math.ceil(largeFrame.length/3)>16*1024*1024);
 const oversized=await client.uploadAsset(largeFrame,{mimeType:'image/png',filename:'protocol-boundary.png',requestId:'private-protocol-over-cap-'+context.pointer.operation,timeoutMs:120000});assert.equal(oversized.sizeBytes,largeFrame.length);
 const tooLarge=await denied(()=>context.admin.action('runtimeAssets:readProviderInput',{reference:setup.owner.reference,assetId:oversized.assetId,version:oversized.assetVersion,protocol:'image-inline-v1'}));assert.match(JSON.stringify(context.publicError(tooLarge)),/PROVIDER_INPUT_TOO_LARGE/);
 groups.push({name:'delivery-eligible-image-denied-by-separate-encoded-provider-cap',status:'PASS',asset:oversized,decodedBytes:largeFrame.length,base64Bytes:4*Math.ceil(largeFrame.length/3),providerCap:16*1024*1024,applicationCap:20000000,denial:context.publicError(tooLarge),providerCalls:0,noLargeMediaFallback:true});
 await context.publish('native-private-input1-outcomes',{status:'ACTUAL_PRIVATE_MATERIALIZATION_PASS_NOT_PROVIDER_DISPATCH_QUALIFICATION',groups,projectId:context.state.projectId,frameAsset:asset,oversizedProtocolAsset:oversized,modelCalls:0,paidCommissionPending:true});console.log(JSON.stringify({status:'PRIVATE_MATERIALIZATION_PASS',groups:groups.length,modelCalls:0}));
}catch(error){await context.publish('native-private-input1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:context.publicError(error),modelCalls:0,noBlindRepeat:true});throw error;}finally{await context.close();}
