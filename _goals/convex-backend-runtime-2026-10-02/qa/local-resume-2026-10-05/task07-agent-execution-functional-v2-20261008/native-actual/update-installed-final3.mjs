/** Explicit owned fixture update from the genuine observed registry and repaired source. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try {
 await c.verifyTarget('installed-final3-update-target-verified');
 const packed=JSON.parse(await readFile(join(q,'packed-sdk-final3.json'),'utf8'));
 const oldRaw=await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'));
 assert.equal(sha(oldRaw),'5bc378351f65b8b1e7a11a54296a840f344a526be815a8d7d582725cfafe5e04');
 const old=JSON.parse(oldRaw),nextRaw=await readFile(join(packed.unpackedBackend,'manifest.json')),next=JSON.parse(nextRaw);
 assert.equal(sha(nextRaw),packed.manifestSha256);assert.equal(old.files.length,69);assert.equal(next.files.length,69);
 assert.deepEqual(old.files.map(x=>x.path).sort(),next.files.map(x=>x.path).sort());assert.deepEqual(next.components,['agent','workflow']);
 const initial=JSON.parse(await readFile(join(q,'deployment-source-manifest.json'),'utf8'));
 const functions=join(c.host,c.functionsDirectory),before=[];
 for(const file of old.files){const bytes=await readFile(join(functions,file.path));
   const expected=file.path==='runtimeModelPolicyBootstrap.ts'?initial.files.find(x=>x.path===file.path).sha256:file.sha256;
   assert.equal(sha(bytes),expected,'Unexpected changed owned preimage '+file.path);before.push({path:file.path,bytes:bytes.length,sha256:sha(bytes)});}
 for(const name of ['gatewayQualification.ts','agentQualification.ts'])assert.equal(sha(await readFile(join(functions,name))),sha(await readFile(join(q,name))));
 for(const pin of initial.preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256);
 const config=await readFile(join(functions,'convex.config.ts'));assert.ok(config.toString().includes('app.use(_cortex_component_workflow, { name: "workflow" })'));
 const fixture=await readFile(join(functions,'qualificationManifest.ts'));
 const expectedFixture='import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";\n// Operator-only provisional contract: no actual/independent PASS is asserted.\nexport const fixtureManifest = '+JSON.stringify(JSON.parse(await readFile(join(q,'qualification-only-manifest.json'))))+' as const satisfies DeploymentPolicyManifest;\n';
 assert.equal(sha(fixture),sha(expectedFixture));
 try{await readFile(join(functions,'agentFenceQualification.ts'));throw new Error('FIXTURE_COLLISION');}catch(e){if(e.code!=='ENOENT')throw e;}
 const incoming=[];for(const file of next.files){const bytes=await readFile(join(packed.unpackedBackend,file.path));assert.equal(sha(bytes),file.sha256);incoming.push({file,bytes});}
 const bootstrap=incoming.find(x=>x.file.path==='runtimeModelPolicyBootstrap.ts').bytes.toString();
 assert.ok(!bootstrap.includes('fixtureManifest'));assert.ok(bootstrap.includes('TEXT_GATEWAY_POLICY_MANIFEST_V3, DEFAULT_GATEWAY_POLICY_MANIFEST'));
 await c.publish('installed-final3-owned-preimage',{target:c.state.projectId,oldManifestSha256:sha(oldRaw),newManifestSha256:sha(nextRaw),before,
   preserved:initial.preserved,rootConfigSha256:sha(config),qualificationFixtureSha256:sha(fixture),fixtureOnlyExplicitPatch:true,
   ordinaryInstallerStillRejectsChangedOwnedFiles:true});
 for(const {file,bytes} of incoming)await writeFile(join(functions,file.path),bytes);
 await unlink(join(functions,'qualificationManifest.ts'));
 await writeFile(join(functions,'agentFenceQualification.ts'),await readFile(join(q,'agentFenceQualification.ts')));
 for(const pin of initial.preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256);
 assert.equal(sha(await readFile(join(functions,'convex.config.ts'))),sha(config));
 const deployed=[];for(const file of next.files){const bytes=await readFile(join(functions,file.path));assert.equal(sha(bytes),file.sha256);deployed.push({path:file.path,sha256:sha(bytes),bytes:bytes.length});}
 for(const name of ['convex.config.ts','agentQualification.ts','gatewayQualification.ts','agentFenceQualification.ts']){const bytes=await readFile(join(functions,name));deployed.push({path:name,sha256:sha(bytes),bytes:bytes.length,fixtureOnly:true});}
 await c.publish('installed-final3-source-manifest',{target:c.state.projectId,manifestSha256:sha(nextRaw),packed,files:deployed,preserved:initial.preserved,
    rootConfigSha256:sha(config),qualificationTrustExceptionRemoved:true,exactShippedRegistry:true,syntheticRootDefault:false,finalFunctionalAcceptancePending:true});
}finally{await c.close();}
