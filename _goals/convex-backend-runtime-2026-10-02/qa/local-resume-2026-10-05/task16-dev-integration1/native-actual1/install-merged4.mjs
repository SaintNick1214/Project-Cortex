/** Exact final archive installation; preserves custom host and historic QA root lookup. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {openNativeContext,q,qa,sha} from './common.mjs';
const c=await openNativeContext();
async function command(label,args){
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));
 env.PATH=dirname(process.execPath)+':'+env.PATH;
 const child=spawn(process.execPath,args,{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});
 let out='',err='',closed=false,timedOut=false;
 child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);
 const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGTERM');}catch{}},120000);
 const hard=setTimeout(()=>{if(!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}
 finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,label+'.log'),c.redact(out+err),{flag:'wx'});
 await c.publish(label,{...exit,pid:child.pid,closed,timedOut,modelCalls:0});
 assert.equal(timedOut,false);assert.equal(exit.code,0,c.redact(err).slice(-3000));
}
try {
 await c.verifyTarget('install-merged4-target');
 const archive=JSON.parse(await readFile(join(qa,'task16-dev-integration1/root1/package-archive4.json')));
 assert.equal(archive.sha256,'d7a3d8becf329e9a96ad71666aea7281c1ae74a763435071388483f51ae6d46f');
 assert.equal(sha(await readFile(archive.archive)),archive.sha256);
 const prior=JSON.parse(await readFile(join(q,'installed-merged1-source-manifest.json')));
 const bridge=JSON.parse(await readFile(join(q,'installed-bridge3.json')));
 const types1=JSON.parse(await readFile(join(q,'host-types-repair1.json')));
 const types2=JSON.parse(await readFile(join(q,'host-types-repair2.json')));
 const overrides=new Map([
  ['runtimeGateway.ts',bridge.postimage.sha256],
  ...types1.postimages.map(row=>[row.path,row.sha256]),
  [types2.path,types2.postimage.sha256],
 ]);
 const functions=join(c.host,c.functionsDirectory),sdkPath=join(c.host,'node_modules/@cortexmemory/sdk');
 const oldRaw=await readFile(join(sdkPath,'dist/backend/v1/manifest.json')),old=JSON.parse(oldRaw);
 assert.equal(sha(oldRaw),prior.manifestSha256);
 const expected=path=>overrides.get(path)??prior.QAOverlay.find(row=>row.path===path)?.sha256??prior.files.find(row=>row.path===path)?.sha256;
 const preimages=[];
 for(const row of old.files){const bytes=await readFile(join(functions,row.path));assert.equal(sha(bytes),expected(row.path),'Owned preimage '+row.path);preimages.push({path:row.path,bytes:bytes.length,sha256:sha(bytes),source:bytes.toString()});}
 for(const row of prior.QAOverlay.filter(row=>row.path!=='runtimeModelPolicyBootstrap.ts')) assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);
 for(const row of prior.preserved) assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256,'Custom host preimage '+row.path);
 await c.publish('merged4-managed-preimages',{oldManifestSha256:sha(oldRaw),archive,preimages,preserved:prior.preserved,QAOverlay:prior.QAOverlay,typedAndBridgeOverrides:[...overrides]});
 await command('merged4-package-install',['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js','install',archive.archive,'--ignore-scripts','--no-audit','--no-fund']);
 const raw=await readFile(join(sdkPath,'dist/backend/v1/manifest.json')),incoming=JSON.parse(raw);
 assert.equal(incoming.files.length,156);assert.equal(incoming.tables.length,72);assert.equal(incoming.dependencies['fast-sha256'],'1.3.0');
 assert.ok(incoming.files.some(row=>row.path==='runtimeGatewayMediaQualifications.ts'));
 for(const row of incoming.files) assert.equal(sha(await readFile(join(sdkPath,'dist/backend/v1',row.path))),row.sha256,'Packed bytes '+row.path);
 for(const row of old.files) assert.ok(incoming.files.some(next=>next.path===row.path),'Removed managed source '+row.path);
 for(const row of incoming.files.filter(row=>!old.files.some(previous=>previous.path===row.path))){
  let exists=true;try{await access(join(functions,row.path));}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}
  assert.equal(exists,false,'Foreign collision '+row.path);
 }
 const installer=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/cli/dist/utils/init/additive-backend.js')));
 const initial=await installer.planAdditiveBackendInstallation(c.host,sdkPath);
 assert.ok(initial.conflicts.length);
 await assert.rejects(()=>installer.applyAdditiveBackendInstallation(initial),installer.BackendMergeRequiredError);
 const changed=old.files.filter(row=>incoming.files.find(next=>next.path===row.path).sha256!==row.sha256 && row.path!=='runtimeModelPolicyBootstrap.ts');
 for(const row of changed){assert.equal(sha(await readFile(join(functions,row.path))),expected(row.path));await unlink(join(functions,row.path));}
 const plan=await installer.planAdditiveBackendInstallation(c.host,sdkPath);
 for(const conflict of plan.conflicts) assert.ok(prior.QAOverlay.some(row=>join(c.functionsDirectory,row.path)===conflict.path),'Unknown collision '+conflict.path);
 await installer.applyAdditiveBackendInstallation({...plan,conflicts:[]});
 const oldBootstrap=preimages.find(row=>row.path==='runtimeModelPolicyBootstrap.ts').source;
 const imports=oldBootstrap.split('\n').filter(line=>/^import \{(agentMediaFixtureManifest|fixtureManifest|syncFixtureManifest|imageFixtureManifest)\}/.test(line));
 assert.equal(imports.length,4);
 let bootstrap=await readFile(join(sdkPath,'dist/backend/v1/runtimeModelPolicyBootstrap.ts'),'utf8');
 const canonicalList='OBSERVED_GATEWAY_POLICY_MANIFEST_V14]);';
 assert.ok(bootstrap.includes(canonicalList));
 bootstrap=imports.join('\n')+'\n'+bootstrap.replace(canonicalList,'OBSERVED_GATEWAY_POLICY_MANIFEST_V14, fixtureManifest, syncFixtureManifest, imageFixtureManifest, agentMediaFixtureManifest]);');
 bootstrap=bootstrap.replace('manifest.classification === "reviewed-actual" && manifests.some','(manifest.classification === "reviewed-actual" || manifest === fixtureManifest || manifest === syncFixtureManifest || manifest === imageFixtureManifest || manifest === agentMediaFixtureManifest) && manifests.some');
 assert.match(bootstrap,/OBSERVED_GATEWAY_POLICY_MANIFEST_V14, fixtureManifest/);
 await writeFile(join(functions,'runtimeModelPolicyBootstrap.ts'),bootstrap);
 const files=[];
 for(const row of incoming.files){const bytes=await readFile(join(functions,row.path));assert.equal(sha(bytes),row.path==='runtimeModelPolicyBootstrap.ts'?sha(bootstrap):row.sha256);files.push({path:row.path,sha256:sha(bytes),bytes:bytes.length});}
 for(const row of prior.QAOverlay.filter(row=>row.path!=='runtimeModelPolicyBootstrap.ts')) assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);
 for(const row of prior.preserved) assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256);
 const idempotent=await installer.planAdditiveBackendInstallation(c.host,sdkPath);
 assert.equal(idempotent.filesToWrite.length,0);
 for(const conflict of idempotent.conflicts) assert.ok(prior.QAOverlay.some(row=>join(c.functionsDirectory,row.path)===conflict.path));
 await c.publish('installed-merged4-source-manifest',{archive,manifestSha256:sha(raw),files,tables:incoming.tables,components:incoming.components,httpRoutes:incoming.httpRoutes,QAOverlay:[...prior.QAOverlay.filter(row=>row.path!=='runtimeModelPolicyBootstrap.ts'),{path:'runtimeModelPolicyBootstrap.ts',sha256:sha(bootstrap)}],preserved:prior.preserved,changedManagedPaths:changed.map(row=>row.path),addedManagedPaths:incoming.files.filter(row=>!old.files.some(previous=>previous.path===row.path)).map(row=>row.path),historicRootsRetained:true,hostSourceSchemaAuthHTTPPreserved:true,formerTypeAndBridgeOverlaysNowCanonical:true,idempotentManagedWrites:0,modelCalls:0});
 console.log(JSON.stringify({status:'FINAL156_MANAGED_SOURCE_INSTALLED',files:files.length,tables:incoming.tables.length,manifestSha256:sha(raw),newModelCalls:0}));
} catch(error){await c.publish('install-merged4-failure',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),modelCalls:0});throw Error('FINAL_INSTALL_FAILED_SEE_RECEIPT');}
finally {await c.close();}
