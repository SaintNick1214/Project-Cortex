/** Offline candidate materialization, usable only after Root's accepted commit/BUILD GO. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {packDescriptor,validateArchive} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-canonical-package-pack-descriptor.mjs';
const execute=promisify(execFile),kit=path.dirname(fileURLToPath(import.meta.url));
const source='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const qa=path.join(source,'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-canonical-package-checks');
const q=path.dirname(qa),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(process.version,'v24.15.0');assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_BUILD_GO,'1');
const plan=JSON.parse(await fs.readFile(path.join(qa,'preparation.json'))),commit=plan.acceptedSourceCommit;
assert.match(commit,/^[a-f0-9]{40}$/);assert.equal((await execute('git',['rev-parse','HEAD'],{cwd:source})).stdout.trim(),commit);
assert.equal((await execute('npm',['--version'])).stdout.trim(),'12.2.0');
const env={...process.env,PATH:'/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin:'+process.env.PATH,npm_config_cache:path.join(kit,'cache'),npm_config_userconfig:'/dev/null'};
const reuse=JSON.parse((await execute('python3',[path.join(q,'memory-effort-canonical-package-reuse.py'),commit,plan.rootFreshSdkBuild.snapshot],{cwd:source,maxBuffer:12*1024*1024})).stdout);
assert(reuse.sdk.eligibleNow,'Root fresh SDK source/output closure changed; stop without build or pack');
assert.equal(reuse.packages.length,3);assert(reuse.packages.every(row=>row.eligibleNow),'Reuse failed: stop before copying/building/packing any dependent package');
await fs.writeFile(path.join(qa,'archive-reuse-accepted-source.json'),JSON.stringify(reuse,null,2)+'\n',{flag:'wx'});
const stage=path.join(kit,'staging',commit),artifacts=path.join(kit,'artifacts',commit);
await fs.mkdir(stage,{recursive:false});await fs.mkdir(artifacts,{recursive:false});
const selected=['src','convex-dev','package.json','package-lock.json','README.md','LICENSE.md','tsconfig.json','scripts/backend/build-distribution.mjs'];
const prefixes={cli:'packages/cortex-cli',provider:'packages/vercel-ai-provider',catalog:'packages/cortex-templates'};
for(const row of reuse.packages){
 const prefix=prefixes[row.role];selected.push(prefix+'/package.json');
 // Only three workspace manifests accompany the changed SDK source closure.
}
const tracked=(await execute('git',['ls-tree','-r','--name-only','-z',commit,'--',...selected],{cwd:source,maxBuffer:20*1024*1024})).stdout.split('\0').filter(Boolean),inputs=[];
for(const relative of tracked){
 assert(!relative.split('/').some(part=>['node_modules','.git','_goals'].includes(part)));
 const bytes=(await execute('git',['show',commit+':'+relative],{cwd:source,encoding:'buffer',maxBuffer:20*1024*1024})).stdout;
 assert.equal(digest(await fs.readFile(path.join(source,relative))),digest(bytes),'Current source changed since accepted commit: '+relative);
 const target=path.join(stage,relative);await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,bytes,{flag:'wx',mode:(await fs.stat(path.join(source,relative))).mode&0o777});inputs.push({path:relative,sha256:digest(bytes)});
}
// Host-only dependency links never enter a packed archive or image context.
for(const relative of ['.','packages/cortex-cli']){
 const original=path.join(source,relative,'node_modules'),target=path.join(stage,relative,'node_modules');
 if(await fs.access(original).then(()=>true,()=>false)){await fs.mkdir(path.dirname(target),{recursive:true});await fs.symlink(original,target);}
}
const commands=[];
async function command(label,args,cwd){
 const started=performance.now();let result;
 try{result=await execute('npm',args,{cwd,env,maxBuffer:20*1024*1024});}
 catch(error){await fs.writeFile(path.join(qa,label+'.log'),String(error.stdout??'')+String(error.stderr??''),{flag:'wx'});await fs.writeFile(path.join(qa,label+'-exit.json'),JSON.stringify({label,command:['npm',...args],cwd,exitCode:error.code??null,signal:error.signal??null,killed:error.killed??false,elapsedMs:performance.now()-started,naturalExit:error.signal===null},null,2)+'\n',{flag:'wx'});throw Error(label+' failed; preserve its original log and exit without retry');}
 await fs.writeFile(path.join(qa,label+'.log'),result.stdout+result.stderr,{flag:'wx'});
 const receipt={label,command:['npm',...args],cwd,exitCode:0,signal:null,naturalExit:true,elapsedMs:performance.now()-started};commands.push(receipt);await fs.writeFile(path.join(qa,label+'-exit.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return result;
}
// Root's fresh accepted-source build already produced the entire SDK. Copy only
// its individually hash-checked dist outputs, keeping the original build receipt.
const rootSdkSnapshotBytes=await fs.readFile(reuse.sdk.snapshot);assert.equal(digest(rootSdkSnapshotBytes),reuse.sdk.snapshotSha256);
const rootSdkSnapshot=JSON.parse(rootSdkSnapshotBytes);
for(const row of rootSdkSnapshot.outputs){
 const original=path.join(source,row.path),target=path.join(stage,row.path);
 assert(!row.path.startsWith('/')&&!row.path.split('/').includes('..')&&row.path.startsWith('dist/'));
 assert.equal(digest(await fs.readFile(original)),row.sha256);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(original,target);
 assert.equal(digest(await fs.readFile(target)),row.sha256);
}
const manifestBytes=await fs.readFile(path.join(stage,'dist/backend/v1/manifest.json')),manifest=JSON.parse(manifestBytes);
assert.equal(manifest.sdkVersion,'0.39.0');assert.equal(manifest.files.length,174);assert.equal(manifest.tables.length,79);assert.deepEqual(manifest.components,['agent','workflow']);
for(const row of manifest.files){
 assert.equal(digest(await fs.readFile(path.join(source,row.sourcePath))),row.sourceSha256);
 assert.equal(digest(await fs.readFile(path.join(stage,row.sourcePath))),row.sourceSha256);
 assert.equal(digest(await fs.readFile(path.join(stage,'dist/backend/v1',row.path))),row.sha256);
}
// Dependent builds may resolve the host's SDK declarations through workspace links.
// Require those declarations to equal the fresh candidate before using that path.
for(const file of ['dist/index.d.ts','dist/client-runtime/index.d.ts'])assert.equal(digest(await fs.readFile(path.join(source,file))),digest(await fs.readFile(path.join(stage,file))),'Host SDK declarations must match the fresh accepted candidate');
// Root's single fresh SDK build is recorded separately. No CLI/provider/catalog build.
const specs=[['sdk','.','@cortexmemory/sdk','0.39.0'],['cli',prefixes.cli,'@cortexmemory/cli','0.39.0'],['provider',prefixes.provider,'@cortexmemory/vercel-ai-provider','0.39.0'],['catalog',prefixes.catalog,'@cortexmemory/templates','1.4.0']],packed=[];
for(const [role,relative,name,version]of specs){
 const proof=reuse.packages.find(row=>row.role===role);
 if(proof?.eligibleNow){
  assert.equal(digest(await fs.readFile(proof.archive)),proof.sha256);
  const {sourceClosure,generatedClosure,...reused}=proof;
  await fs.copyFile(proof.archive,path.join(artifacts,proof.filename));
  packed.push({...reused,role,name,version,provenance:'GENUINE_REUSED_ARCHIVE',originSourceCommit:proof.originSourceCommit,currentAcceptedSourceCommit:commit,reuseProof:'archive-reuse-accepted-source.json'});
  continue;
 }
 assert.equal(role,'sdk','Only SDK may be newly packed');
 const result=await command('pack-'+role,['pack','--ignore-scripts','--json','--pack-destination',artifacts],path.join(stage,relative));
 const row=packDescriptor(result.stdout,name,version);
 const archiveValidation=validateArchive(row,path.join(artifacts,row.filename),path.join(stage,relative));
 for(const file of row.files)assert(!file.path.startsWith('/')&&!file.path.split('/').some(part=>['..','node_modules','.git','_goals'].includes(part))&&(!/(^|\/)\.env(?:\.[^/]+)?$/.test(file.path)||file.path.endsWith('.example')));
 const bytes=await fs.readFile(path.join(artifacts,row.filename));packed.push({role,name,version,filename:row.filename,sha256:digest(bytes),bytes:bytes.length,files:row.files.length,archiveValidation,provenance:'FRESHLY_PACKED_ACCEPTED_SOURCE',originSourceCommit:commit,...(role==='sdk'?{freshBuildOwner:'ROOT',rootFreshBuild:reuse.sdk}:{})});
 await fs.writeFile(path.join(qa,'pack-'+role+'.json'),JSON.stringify(row,null,2)+'\n',{flag:'wx'});
}
const receipt={version:1,sourceRoot:source,sourceCommit:commit,node:process.versions.node,npm:'12.2.0',buildInputs:inputs.length,inputManifestSha256:digest(JSON.stringify(inputs)),
 backend:{distributionId:manifest.distributionId,files:manifest.files.length,allSourceOutputHashesMatch:true,manifestSha256:digest(manifestBytes)},packages:packed,
 counts:{builds:commands.filter(row=>row.label.startsWith('build-')).length,packs:commands.filter(row=>row.label.startsWith('pack-')).length,reusedArchives:packed.filter(row=>row.provenance==='GENUINE_REUSED_ARCHIVE').length},commands,
 rootFreshSdkBuild:reuse.sdk,reuseSourceCommit:commit,liveQualification:false,paidCalls:0,catalogAssemble:0,wholeArchiveTreeCopies:0};
assert.equal(receipt.counts.builds,0);assert.equal(receipt.counts.packs,1);assert.equal(receipt.counts.reusedArchives,3);
await fs.writeFile(path.join(artifacts,'manifest.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
await fs.writeFile(path.join(artifacts,'build-inputs.json'),JSON.stringify(inputs,null,2)+'\n',{flag:'wx'});
await fs.writeFile(path.join(qa,'artifact-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
for(const row of packed)await fs.copyFile(path.join(artifacts,row.filename),path.join(kit,'image/archives',row.filename));
await fs.copyFile(path.join(artifacts,'manifest.json'),path.join(kit,'image/archives/manifest.json'));
console.log(JSON.stringify({status:'LOCAL_ARCHIVES_PREPARED',...receipt},null,2));
