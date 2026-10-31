/** Restore only the five real published host modules, then import the actual entrypoint offline. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {Q,R,KIT,CHECKS} from './memory-effort-canonical-package-builder.mjs';
assert.equal(process.version,'v24.15.0');assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_BUILD_GO,'1');
const [commit]=process.argv.slice(2);assert.equal(process.argv.slice(2).length,1);assert.match(commit??'',/^[a-f0-9]{40}$/);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),commit);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const artifact=JSON.parse(fs.readFileSync(path.join(CHECKS,'artifact-receipt.json')));assert.equal(artifact.sourceCommit,commit);
const row=artifact.packages.find(row=>row.role==='cli'),archive=path.join(KIT,'image/archives',row.filename);
assert.equal(row.sha256,'847367abe21d000cd34b3bb59f1d7aadaacfbd8fdc3b36baf85baba822345f8b');assert.equal(sha(fs.readFileSync(archive)),row.sha256);
const prior=JSON.parse(fs.readFileSync(path.join(Q,'memory-effort-singleton-package-checks/host-cli-import.json')));assert.equal(prior.archiveSha256,row.sha256);assert.equal(prior.files.length,5);
const files=[];for(const expected of prior.files){
 assert(/^package\/dist\/utils\/(init\/)?[a-z-]+\.js$/.test(expected.archiveMember));
 const relative=expected.archiveMember.slice('package/'.length),destination=path.join(KIT,'staging',commit,'packages/cortex-cli',relative);
 const bytes=execFileSync('tar',['-xOf',archive,expected.archiveMember],{maxBuffer:2*1024*1024});assert.equal(sha(bytes),expected.sha256);
 assert(!fs.existsSync(destination),'Host CLI module unexpectedly exists: '+destination);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});
 files.push({file:destination,archiveMember:expected.archiveMember,sha256:sha(bytes),bytes:bytes.length});
}
const entry=path.join(KIT,'staging',commit,'packages/cortex-cli/dist/utils/init/backend-setup.js');
let fetchCalls=0;globalThis.fetch=()=>{fetchCalls++;throw Error('Offline host import forbids fetch');};
const module=await import(pathToFileURL(entry));assert.equal(typeof module.setupBackend,'function');assert.equal(fetchCalls,0);
const receipt={status:'EXACT_PUBLISHED_HOST_CLI_CLOSURE_IMPORTED_OFFLINE',sourceCommit:commit,archive,archiveSha256:row.sha256,files,dynamicImport:{entry,node:process.version,exports:Object.keys(module).sort(),setupBackend:typeof module.setupBackend,fetchCalls,functionsInvoked:0},builds:0,packs:0,serviceCalls:0,inferenceCalls:0,globalLauncherEdits:0};
fs.writeFileSync(path.join(CHECKS,'host-cli-import.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
