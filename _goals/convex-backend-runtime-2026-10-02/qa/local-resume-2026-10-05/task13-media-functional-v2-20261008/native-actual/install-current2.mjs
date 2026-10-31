/** Concrete cycle repair only. Prior failed install and QA preimages remain immutable. */
import assert from 'node:assert/strict';
import {readFile,writeFile,access,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('install-current2-target-verified');
 const prior=JSON.parse(await readFile(join(q,'installed-current1-source-manifest.json'))),packed=JSON.parse(await readFile(join(q,'packages-current2.json'))),validation=JSON.parse(await readFile(join(q,'image-prepared-input-validation2.json')));
 assert.equal(validation.status,'PASS');assert.equal(validation.manifestSha256,sha(await readFile(join(q,'image-commission-only-manifest1.json'))));
 const functions=join(c.host,c.functionsDirectory),sdkPath=join(c.host,'node_modules/@cortexmemory/sdk'),oldRaw=await readFile(join(sdkPath,'dist/backend/v1/manifest.json')),old=JSON.parse(oldRaw),incomingRaw=await readFile(join(packed.sdk.unpackedBackend,'manifest.json')),incoming=JSON.parse(incomingRaw);
 assert.equal(sha(oldRaw),prior.packed.sdk.manifestSha256);assert.equal(sha(incomingRaw),packed.sdk.manifestSha256);assert.equal(packed.cli.sha256,prior.packed.cli.sha256);
 for(const item of [packed.sdk,packed.cli])assert.equal(sha(await readFile(item.file)),item.sha256);
 const expected=row=>prior.QAOverlay.find(pin=>pin.path===row.path)?.sha256??row.sha256;
 const preserved=[];for(const row of prior.preserved){const overlay=prior.QAOverlay.find(pin=>join(c.functionsDirectory,pin.path)===row.path),hash=overlay?.sha256??(row.path==='custom/backend/http.ts'?prior.httpAfterSha256:row.sha256);assert.equal(sha(await readFile(join(c.host,row.path))),hash);preserved.push({...row,sha256:hash});}
 for(const row of prior.QAOverlay)assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);
 const preimages=[];
 for(const row of old.files){const bytes=await readFile(join(functions,row.path));assert.equal(sha(bytes),expected(row),'Exact owned preimage changed: '+row.path);const next=incoming.files.find(value=>value.path===row.path);assert.ok(next,'Unexpected removed source: '+row.path);if(next.sha256!==sha(bytes))preimages.push({path:row.path,sha256:sha(bytes),bytes:bytes.length,source:bytes.toString()});}
 for(const row of incoming.files.filter(value=>!old.files.some(prior=>prior.path===value.path))){let exists=true;try{await access(join(functions,row.path));}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}assert.equal(exists,false,'Foreign source collision: '+row.path);}
 const bootstrapPin=old.files.find(row=>row.path==='runtimeModelPolicyBootstrap.ts'),nextBootstrap=incoming.files.find(row=>row.path==='runtimeModelPolicyBootstrap.ts');assert.equal(nextBootstrap.sha256,bootstrapPin.sha256,'Cycle-only successor must not silently change compiled trust');
 const retainedBootstrap=await readFile(join(functions,'runtimeModelPolicyBootstrap.ts'));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
 const args=['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js','install',packed.sdk.file,'--ignore-scripts','--no-audit','--no-fund'];
 const start=Date.now(),child=spawn(process.execPath,args,{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
 const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000),hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,'install-packages-current2.stdout.log'),c.redact(stdout),{flag:'wx'});await writeFile(join(q,'install-packages-current2.stderr.log'),c.redact(stderr),{flag:'wx'});await c.publish('install-packages-current2',{pid:child.pid,...exit,closed,timedOut,elapsedMs:Date.now()-start,deadlineMs:120000,CLIReusedExactly:true});assert.equal(timedOut,false);assert.equal(exit.code,0,c.redact(stderr));
 const installer=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/cli/dist/utils/init/additive-backend.js'))),conflict=await installer.planAdditiveBackendInstallation(c.host,sdkPath);
 assert.ok(conflict.conflicts.length);await assert.rejects(()=>installer.applyAdditiveBackendInstallation(conflict),installer.BackendMergeRequiredError);
 for(const row of old.files)assert.equal(sha(await readFile(join(functions,row.path))),expected(row));for(const row of preserved)assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256);
 await c.publish('install-current2-owned-preimages',{oldManifestSha256:sha(oldRaw),incomingManifestSha256:sha(incomingRaw),preimages,preserved,normalConflictPaths:conflict.conflicts.map(row=>row.path),normalInstallerOverwrites:false,onlyExplicitOwnedFixtureUpdate:true});
 for(const row of preimages){assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);await unlink(join(functions,row.path));}
 const plan=await installer.planAdditiveBackendInstallation(c.host,sdkPath);assert.equal(plan.conflicts.length,0,JSON.stringify(plan.conflicts));const applied=await installer.applyAdditiveBackendInstallation(plan),retry=await installer.planAdditiveBackendInstallation(c.host,sdkPath);assert.equal(retry.conflicts.length,0);assert.equal(retry.changes.length,0);const retried=await installer.applyAdditiveBackendInstallation(retry);assert.equal(retried.installed.length,0);
 const files=[];for(const row of incoming.files){const bytes=await readFile(join(functions,row.path));assert.equal(sha(bytes),row.sha256);files.push({path:row.path,bytes:bytes.length,sha256:sha(bytes)});}
 await writeFile(join(functions,'runtimeModelPolicyBootstrap.ts'),retainedBootstrap);for(const row of prior.QAOverlay)assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);for(const row of preserved)assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256);
 await c.publish('installed-current2-source-manifest',{projectId:c.state.projectId,packed,files,preserved,QAOverlay:prior.QAOverlay,QAOnlyFixtures:prior.QAOnlyFixtures,httpAfterSha256:prior.httpAfterSha256,httpOriginalBackupSha256:prior.httpOriginalBackupSha256,applied,retryWrites:0,hostUnrelatedPreserved:true,fixtureOnlyOwnedRemovalPaths:preimages.map(row=>row.path),productInstallerConflictsPreserved:true,oldRoot10And11LookupPreserved:true,privateFixedRoot12Unchanged:true,prior4_5mAndHeld2NotMutated:true,modelCalls:0,enabledDeploymentPending:true});
 console.log(JSON.stringify({status:'CYCLE_SUCCESSOR_INSTALLED',sourceFiles:files.length,retryWrites:0,modelCalls:0}));
}finally{await c.close();}
