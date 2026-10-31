/** Explicit disposable-owned source update; ordinary installer never overwrites changed files. */
import assert from 'node:assert/strict';
import {readFile,writeFile,access,mkdir} from 'node:fs/promises';
import {join,dirname,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('install-commission1-target-verified');
 const baseline=JSON.parse(await readFile(join(q,'baseline-packages.json'))),packed=JSON.parse(await readFile(join(q,'packed-sdk-current1.json')));
 const functions=join(c.host,c.functionsDirectory),oldRaw=await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'));
 assert.equal(sha(oldRaw),baseline.sdk.manifestSha256);assert.equal(sha(await readFile(packed.file)),packed.sha256);
 const old=JSON.parse(oldRaw),incomingRaw=await readFile(join(packed.unpackedBackend,'manifest.json'));assert.equal(sha(incomingRaw),packed.manifestSha256);const incoming=JSON.parse(incomingRaw);
 const preserved=[],preimages=[];
 for(const file of old.files){assert.equal(sha(await readFile(join(functions,file.path))),file.sha256,'Owned source changed '+file.path);assert.ok(incoming.files.some(row=>row.path===file.path),'Removed owned path needs explicit handling '+file.path);}
 for(const path of ['convex.json','custom/backend/host.ts','custom/backend/hostNode.ts','custom/backend/http.ts','custom/backend/auth.config.ts','custom/backend/convex.config.ts','custom/backend/schema.ts']){
  const bytes=await readFile(join(c.host,path));preserved.push({path,bytes:bytes.length,sha256:sha(bytes)});}
 for(const file of incoming.files){assert.ok(!isAbsolute(file.path)&&!file.path.split('/').includes('..'));assert.equal(sha(await readFile(join(packed.unpackedBackend,file.path))),file.sha256);
  const prior=old.files.find(row=>row.path===file.path);if(!prior){let present=true;try{await access(join(functions,file.path));}catch(error){if(error.code==='ENOENT')present=false;else throw error;}assert.equal(present,false,'Unrelated path collision '+file.path);}
  else if(prior.sha256!==file.sha256){const bytes=await readFile(join(functions,file.path));preimages.push({path:file.path,bytes:bytes.length,sha256:sha(bytes),source:bytes.toString()});}}
 const manifest=JSON.parse(await readFile(join(q,'commission-only-manifest1.json')));assert.equal(manifest.classification,'fixture-synthetic');assert.equal(manifest.manifestId,'task10-operator-qualification-'+c.state.operation);
 const bootstrap=await readFile(join(packed.unpackedBackend,'runtimeModelPolicyBootstrap.ts'),'utf8');
 const registry='Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, DEFAULT_GATEWAY_POLICY_MANIFEST])',trusted='manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest)';
 assert.equal(bootstrap.split(registry).length,2);assert.equal(bootstrap.split(trusted).length,2);
 const privateBootstrap='import { fixtureManifest } from "./profileQualificationManifest";\n'+bootstrap.replace(registry,'Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, DEFAULT_GATEWAY_POLICY_MANIFEST, fixtureManifest])')
  .replace(trusted,'(manifest.classification === "reviewed-actual" || manifest === fixtureManifest) && manifests.some((entry) => entry === manifest)');
 await c.publish('install-commission1-preimage',{oldManifestSha256:sha(oldRaw),incomingManifestSha256:sha(incomingRaw),preserved,preimages,
  fixtureOnlyExplicitUpdate:true,productInstallerConflictBehaviorUnchanged:true});
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
 const args=['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js','install',packed.file,'--ignore-scripts','--no-audit','--no-fund'];
 const start=Date.now(),child=spawn(process.execPath,args,{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000),hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,'install-commission1.stdout.log'),c.redact(stdout));await writeFile(join(q,'install-commission1.stderr.log'),c.redact(stderr));
 await c.publish('install-commission1',{...exit,pid:child.pid,timedOut,childClosed:closed,deadlineMs:120000,elapsedMs:Date.now()-start,args,cwd:c.host});assert.equal(timedOut,false);assert.equal(exit.code,0,c.redact(stderr));
 assert.equal(sha(await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))),packed.manifestSha256);
 const files=[];
 for(const file of incoming.files){await mkdir(dirname(join(functions,file.path)),{recursive:true});const prior=old.files.find(row=>row.path===file.path);if(!prior||prior.sha256!==file.sha256)await writeFile(join(functions,file.path),await readFile(join(packed.unpackedBackend,file.path)));}
 await writeFile(join(functions,'runtimeModelPolicyBootstrap.ts'),privateBootstrap);
 await writeFile(join(functions,'profileQualificationManifest.ts'),'import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\n// Provisional fixed operator commissioning only; no actual/independent PASS is invented.\nexport const fixtureManifest = '+JSON.stringify(manifest)+' as const satisfies DeploymentPolicyManifest;\n');
 await writeFile(join(functions,'profileQualification.ts'),await readFile(join(q,'profileQualification.ts')));
 await writeFile(join(functions,'profileNative.ts'),await readFile(join(q,'profileNative.ts')));
 for(const pin of preserved)assert.equal(sha(await readFile(join(c.host,pin.path))),pin.sha256,'Unrelated host changed '+pin.path);
 for(const file of incoming.files){const bytes=await readFile(join(functions,file.path));files.push({path:file.path,bytes:bytes.length,sha256:sha(bytes),shippedSha256:file.sha256,fixtureTrustChange:file.path==='runtimeModelPolicyBootstrap.ts'});}
 for(const path of ['profileQualificationManifest.ts','profileQualification.ts','profileNative.ts']){const bytes=await readFile(join(functions,path));files.push({path,bytes:bytes.length,sha256:sha(bytes),fixtureOnly:true});}
 await c.publish('commission-fixture-source-manifest1',{projectId:c.state.projectId,manifestSha256:packed.manifestSha256,packed,files,preserved,
  changedPaths:incoming.files.filter(row=>!old.files.some(prior=>prior.path===row.path&&prior.sha256===row.sha256)).map(row=>row.path),
  qualificationTrust:'private exact-object fixture-synthetic operator exception',shippedRegistryChanged:false,fixtureOnlyUpdate:true});
}finally{await c.close();}
