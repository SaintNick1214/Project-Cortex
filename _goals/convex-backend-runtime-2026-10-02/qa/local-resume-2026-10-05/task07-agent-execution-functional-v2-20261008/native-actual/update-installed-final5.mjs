import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();try {
 await c.verifyTarget('installed-final5-update-target-verified');
 const packed=JSON.parse(await readFile(join(q,'packed-sdk-final5.json'),'utf8'));
 const oldRaw=await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'));assert.equal(sha(oldRaw),'f140946caf4f160b428eee506851b2c5587f18da37b8a8a6564da130432c5ea3');
 const old=JSON.parse(oldRaw),nextRaw=await readFile(join(packed.unpackedBackend,'manifest.json')),next=JSON.parse(nextRaw);
 assert.equal(sha(nextRaw),packed.manifestSha256);assert.equal(next.files.length,69);assert.deepEqual(next.files.map(x=>x.path),old.files.map(x=>x.path));
 const changed=next.files.filter(row=>row.sha256!==old.files.find(x=>x.path===row.path).sha256);assert.deepEqual(changed.map(row=>row.path).sort(),['runs.ts','runtimeModelPolicy.ts']);
 const functions=join(c.host,c.functionsDirectory),prior=JSON.parse(await readFile(join(q,'installed-final4-source-manifest.json'),'utf8')),preimages=[];
 for(const file of old.files){const bytes=await readFile(join(functions,file.path));assert.equal(sha(bytes),file.sha256,'Unexpected owned preimage '+file.path);
  if(changed.some(x=>x.path===file.path))preimages.push({path:file.path,sha256:sha(bytes),bytes:bytes.length,source:bytes.toString()});}
 for(const pin of prior.preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256);
 assert.equal(sha(await readFile(join(functions,'convex.config.ts'))),prior.rootConfigSha256);
 for(const name of ['gatewayQualification.ts','agentQualification.ts'])assert.equal(sha(await readFile(join(functions,name))),sha(await readFile(join(q,name))));
 assert.equal(sha(await readFile(join(functions,'agentFenceQualification.ts'))),sha(await readFile(join(q,'agentFenceQualification.ts.preimage2'))));
 await c.publish('installed-final5-owned-preimage',{target:c.state.projectId,oldManifestSha256:sha(oldRaw),incomingManifestSha256:sha(nextRaw),preimages,
   changedPaths:changed.map(x=>x.path),preserved:prior.preserved,rootConfigSha256:prior.rootConfigSha256,fixtureOnlyAuthorizedUpdate:true});
 for(const file of changed){const bytes=await readFile(join(packed.unpackedBackend,file.path));assert.equal(sha(bytes),file.sha256);await writeFile(join(functions,file.path),bytes);}
 await writeFile(join(functions,'agentFenceQualification.ts'),await readFile(join(q,'agentFenceQualification.ts')));
 const files=[];for(const file of next.files){const bytes=await readFile(join(functions,file.path));assert.equal(sha(bytes),file.sha256);files.push({path:file.path,bytes:bytes.length,sha256:sha(bytes)});}
 for(const name of ['convex.config.ts','agentQualification.ts','gatewayQualification.ts','agentFenceQualification.ts']){const bytes=await readFile(join(functions,name));files.push({path:name,bytes:bytes.length,sha256:sha(bytes),fixtureOnly:true});}
 for(const pin of prior.preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256);
 assert.equal(sha(await readFile(join(functions,'convex.config.ts'))),prior.rootConfigSha256);
 await c.publish('installed-final5-source-manifest',{target:c.state.projectId,manifestSha256:sha(nextRaw),packed,files,preserved:prior.preserved,rootConfigSha256:prior.rootConfigSha256,
   inheritedOrdinaryLive:'installed-live-outcomes.json',newTargetedRepair:'safe current-grant budget cancellation after real grant renewal; expiry and definition controls retained',
   changedPaths:changed.map(x=>x.path),qualificationTrustExceptionRemoved:true,exactShippedRegistry:true,syntheticRootDefault:false});
}finally{await c.close();}
