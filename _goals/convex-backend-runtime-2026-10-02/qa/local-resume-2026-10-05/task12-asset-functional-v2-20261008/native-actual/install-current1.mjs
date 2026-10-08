/** Authorized exact-owned disposable update; normal installer conflict/refusal is preserved. */
import assert from 'node:assert/strict';
import {readFile,writeFile,access,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {q,root,sha,openOwnedContext} from './common.mjs';
const context=await openOwnedContext();
try{
 await context.verifyTarget('install-current1-target-verified');
 const packed=JSON.parse(await readFile(join(q,'packages-current1.json'))),functions=join(context.host,context.functionsDirectory),sdkPath=join(context.host,'node_modules/@cortexmemory/sdk');
 for(const item of [packed.sdk,packed.cli])assert.equal(sha(await readFile(item.file)),item.sha256);
 const oldRaw=await readFile(join(sdkPath,'dist/backend/v1/manifest.json')),old=JSON.parse(oldRaw),incomingRaw=await readFile(join(packed.sdk.unpackedBackend,'manifest.json')),incoming=JSON.parse(incomingRaw);assert.equal(sha(incomingRaw),packed.sdk.manifestSha256);
 const priorReceipt=JSON.parse(await readFile(join(root,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task11-graph-functional-v2-20261008/native-actual/installed-current3-source-manifest.json')));assert.equal(sha(oldRaw),priorReceipt.packed.manifestSha256);
 const preserved=[];for(const row of priorReceipt.preserved){const bytes=await readFile(join(context.host,row.path));assert.equal(sha(bytes),row.sha256,'Host baseline changed: '+row.path);preserved.push({...row,bytes:bytes.length});}
 const preimages=[];for(const row of old.files){const bytes=await readFile(join(functions,row.path));assert.equal(sha(bytes),row.sha256,'Owned preimage changed: '+row.path);const next=incoming.files.find(item=>item.path===row.path);assert.ok(next,'Removed owned source requires explicit handling: '+row.path);if(next.sha256!==row.sha256)preimages.push({path:row.path,sha256:sha(bytes),bytes:bytes.length,source:bytes.toString()});}
 for(const row of incoming.files)if(!old.files.some(item=>item.path===row.path)){let present=true;try{await access(join(functions,row.path));}catch(error){if(error.code==='ENOENT')present=false;else throw error;}assert.equal(present,false,'Foreign file collision: '+row.path);}
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
 const args=['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js','install',packed.sdk.file,packed.cli.file,'--ignore-scripts','--no-audit','--no-fund'];
 const began=Date.now(),child=spawn(process.execPath,args,{cwd:context.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
 const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000),hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,'install-packages-current1.stdout.log'),context.redact(stdout),{flag:'wx'});await writeFile(join(q,'install-packages-current1.stderr.log'),context.redact(stderr),{flag:'wx'});await context.publish('install-packages-current1',{pid:child.pid,...exit,closed,timedOut,elapsedMs:Date.now()-began,deadlineMs:120000,args});assert.equal(timedOut,false);assert.equal(exit.code,0,context.redact(stderr));
 const installer=await import(pathToFileURL(join(context.host,'node_modules/@cortexmemory/cli/dist/utils/init/additive-backend.js')));
 const first=await installer.planAdditiveBackendInstallation(context.host,sdkPath);assert.ok(first.conflicts.length,'Normal installer must retain differing-owned-file conflicts');
 await assert.rejects(()=>installer.applyAdditiveBackendInstallation(first),installer.BackendMergeRequiredError);
 // Conflict plan/application must not alter any owned/host preimage.
 for(const row of old.files)assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);
 for(const row of preserved)assert.equal(sha(await readFile(join(context.host,row.path))),row.sha256);
 await context.publish('install-current1-owned-preimages',{oldManifestSha256:sha(oldRaw),incomingManifestSha256:sha(incomingRaw),preimages,preserved,normalConflictPaths:first.conflicts.map(row=>row.path),normalInstallerOverwrites:false,fixtureOnlyExplicitAuthorization:true});
 for(const row of preimages){assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);await unlink(join(functions,row.path));}
 const plan=await installer.planAdditiveBackendInstallation(context.host,sdkPath);assert.equal(plan.conflicts.length,0,JSON.stringify(plan.conflicts.map(row=>({path:row.path,reason:row.reason}))));
 const applied=await installer.applyAdditiveBackendInstallation(plan);const retry=await installer.planAdditiveBackendInstallation(context.host,sdkPath);assert.equal(retry.conflicts.length,0);assert.equal(retry.changes.length,0);const retried=await installer.applyAdditiveBackendInstallation(retry);assert.equal(retried.installed.length,0);
 const httpBefore=preserved.find(row=>row.path==='custom/backend/http.ts'),http=await readFile(join(functions,'http.ts'),'utf8'),backup=await readFile(join(functions,'http.ts.cortex-v1-before-'+httpBefore.sha256+'.txt'));assert.equal(sha(backup),httpBefore.sha256);assert.ok(http.includes('registerCortexHttpRoutesV1'));assert.ok(http.includes('/host-health'));
 for(const row of preserved)if(row.path!=='custom/backend/http.ts')assert.equal(sha(await readFile(join(context.host,row.path))),row.sha256);
 const qaFiles=[['task12Native.fixture.ts','task12Native.ts'],['mediaMetadata.fixture.ts','mediaMetadata.ts']];for(const[from,to]of qaFiles){let exists=true;try{await access(join(functions,to));}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}assert.equal(exists,false,'QA fixture name already exists');await writeFile(join(functions,to),await readFile(join(q,from)),{flag:'wx'});}
 await writeFile(join(context.host,'task12-runtime-entry.mjs'),'export * from "@cortexmemory/sdk/runtime";\nexport const runtimeEntry = import.meta.resolve("@cortexmemory/sdk/runtime");\n',{flag:'wx'});
 const files=[];for(const row of incoming.files){const bytes=await readFile(join(functions,row.path));assert.equal(sha(bytes),row.sha256);files.push({path:row.path,bytes:bytes.length,sha256:sha(bytes)});}
 await context.publish('installed-current1-source-manifest',{projectId:context.state.projectId,packed,files,preserved,httpBeforeSha256:httpBefore.sha256,httpAfterSha256:sha(http),httpOriginalBackupSha256:sha(backup),applied,retryWrites:0,hostUnrelatedPreserved:true,fixtureOnlyOwnedRemovalPaths:preimages.map(row=>row.path),productInstallerConflictsPreserved:true,QAOnlyFixtures:qaFiles.map(([,to])=>to),modelCalls:0,enabledDeploymentPending:true});
 console.log(JSON.stringify({status:'INSTALLED',sourceFiles:files.length,retryWrites:0,modelCalls:0}));
}finally{await context.close();}
