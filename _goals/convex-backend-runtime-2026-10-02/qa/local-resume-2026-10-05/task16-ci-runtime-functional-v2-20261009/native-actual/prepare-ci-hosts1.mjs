/** Real additive installation into two explicitly owned fresh CI consumers. No inference/GitHub writes. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openCi,q,root,sha} from './ci-common1.mjs';
const c=await openCi(),groups=[];
try{
 const n15=join(root,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task15-integration-functional-v2-20261008/native-actual'),packed=JSON.parse(await readFile(join(n15,'content-packages1.json'))),cli=JSON.parse(await readFile(join(n15,'cli-packed-current1.json')));
 assert.equal(sha(await readFile(packed.sdk.file)),packed.sdk.sha256);assert.equal(sha(await readFile(cli.file)),cli.sha256);
 const manifest=JSON.parse(await readFile(join(packed.sdk.unpackedBackend,'manifest.json')));assert.equal(manifest.files.length,107);
 const fixtures=await import(pathToFileURL(join(root,'scripts/ci/runtime-fixtures.mjs'))),guards=await import(pathToFileURL(join(root,'scripts/ci/verify-disposable-targets.mjs')));
 assert.equal(guards.verifyDisposableCiTargets(c.env).length,2);for(const kind of ['sdk','cli'])fixtures.fixturePlan(c.env,kind);fixtures.publicJwks(c.env);
 const hosts=[];
 for(const kind of ['sdk','cli']){
  await c.verify(kind,kind+'-prepare-host-target-verified1');const host=join(c.pointer.privateDirectory,kind+'-host');await mkdir(host,{mode:0o700});await mkdir(join(host,'convex-dev'),{mode:0o700});
  const pkg={name:'owned-task16-ci-'+kind,private:true,type:'module',hostSentinel:'independent-owned-ci-host',dependencies:{'@cortexmemory/sdk':'file:'+packed.sdk.file,'@cortexmemory/cli':'file:'+cli.file,...manifest.dependencies,convex:'1.46.0'},devDependencies:{typescript:'~6.0.3','@types/node':'^26.6.4'}};
  const sentinel={ 'package.json':JSON.stringify(pkg,null,2)+'\n','convex.json':JSON.stringify({functions:'convex-dev/'},null,2)+'\n','host-unrelated.txt':'owned-ci-unrelated-host-file\n','convex-dev/tsconfig.json':JSON.stringify({compilerOptions:{allowJs:true,strict:true,moduleResolution:'Bundler',jsx:'react-jsx',skipLibCheck:true,allowSyntheticDefaultImports:true,target:'ESNext',lib:['ES2021','dom'],module:'ESNext',isolatedModules:true,noEmit:true,types:['node']},include:['./**/*'],exclude:['_generated']},null,2)+'\n','convex-dev/hostMetadata.ts':'import {query} from "./_generated/server";\nexport const sentinel=query({args:{},handler:async()=>({host:"owned-ci-'+kind+'",inference:false})});\n'};
  for(const[path,body]of Object.entries(sentinel))await writeFile(join(host,path),body,{flag:'wx'});
  await c.command(kind+'-host-install1',['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js','install','--ignore-scripts','--workspaces=false','--no-audit','--no-fund'],host,{},120000);
  const installer=await import(pathToFileURL(join(host,'node_modules/@cortexmemory/cli/dist/utils/init/additive-backend.js'))),sdkPath=join(host,'node_modules/@cortexmemory/sdk'),plan=await installer.planAdditiveBackendInstallation(host,sdkPath);assert.equal(plan.conflicts.length,0,JSON.stringify(plan.conflicts));const applied=await installer.applyAdditiveBackendInstallation(plan),retry=await installer.planAdditiveBackendInstallation(host,sdkPath);assert.equal(retry.conflicts.length,0);assert.equal(retry.changes.length,0);
  for(const[path,body]of Object.entries(sentinel))assert.equal(sha(await readFile(join(host,path))),sha(body),'Unrelated host mutation: '+path);
  const auth=fixtures.writeCiAuthConfig(c.env,host);assert.equal(auth.status,'CI_PUBLIC_AUTH_CONFIG_WRITTEN');assert.throws(()=>fixtures.writeCiAuthConfig(c.env,host),/CI_FIXTURE_HOST_AUTH_EXISTS/);
  const pins=[];for(const row of manifest.files){const bytes=await readFile(join(host,'convex-dev',row.path));assert.equal(sha(bytes),row.sha256);pins.push({path:row.path,bytes:bytes.length,sha256:sha(bytes)});}
  hosts.push({kind,path:host,functionsDirectory:'convex-dev/',installed:pins,unrelated:Object.fromEntries(Object.entries(sentinel).map(([path,body])=>[path,{bytes:Buffer.byteLength(body),sha256:sha(body)}])),authPublicSha256:sha(await readFile(auth.path)),sdk:packed.sdk,cli:{file:cli.file,sha256:cli.sha256},applied,retryWrites:0});
  await c.publish(kind+'-installed-host1',hosts.at(-1));groups.push({name:kind+' exact packed additive install/auth refusal/retry/unrelated preservation',status:'PASS',modelCalls:0});
 }
 await writeFile(join(c.pointer.privateDirectory,'hosts.json'),JSON.stringify(hosts,null,2)+'\n',{mode:0o600,flag:'wx'});await c.publish('prepare-hosts1-outcomes',{status:'TWO_CURRENT_INSTALLED_CI_HOSTS_READY',groups,hostCount:hosts.length,currentBackendManifest:packed.sdk.manifestSha256,manifestFiles:107,compiledPolicyRevision:9,proofExpiryUtc:'2026-10-09T08:50:12.383Z',noGitHubWrites:true,noDeploymentYet:true,modelCalls:0});
 console.log(JSON.stringify({status:'TWO_CURRENT_INSTALLED_CI_HOSTS_READY',hostCount:hosts.length,modelCalls:0}));
}catch(error){await c.publish('prepare-hosts1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:{name:error.name,message:c.redact(error.message)},noBlindRetry:true,noGitHubWrites:true,modelCalls:0});throw Error('TASK16_PREPARE_HOSTS_FAILED_SEE_PUBLIC_RECEIPT');}
