/** Record the ONE real Root SDK build after acceptance/GO; never invokes a build. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Q,R,BACKEND_FILES,BACKEND_TABLES,frozenSourcePins} from './memory-effort-canonical-package-builder.mjs';
assert.equal(process.version,'v24.15.0');
assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_BUILD_GO,'1');
const [commit,receiptFile,logFile,frozenFile]=process.argv.slice(2);assert.equal(process.argv.slice(2).length,4);assert.match(commit??'',/^[a-f0-9]{40}$/);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:R,maxBuffer:20*1024*1024});
assert.equal(git('rev-parse','HEAD').toString().trim(),commit);
const frozenRepair=frozenSourcePins(commit,frozenFile);
const receiptBytes=fs.readFileSync(receiptFile),receipt=JSON.parse(receiptBytes),log=fs.readFileSync(logFile);
assert.equal(receipt.cwd,R);assert.equal(receipt.code??receipt.exitCode,0);assert.equal(receipt.signal??null,null);assert.equal(receipt.naturalExit,true);
assert.equal(receipt.sourceStable,true);assert.equal(path.resolve(receipt.log),path.resolve(logFile));
assert.deepEqual(receipt.sourceHashes,Object.fromEntries(frozenRepair.files.map(row=>[row.relative,row.sha256])),'Root build must cover the frozen repair inputs');
const argv=receipt.argv??receipt.command;assert(Array.isArray(argv));assert.deepEqual(argv.slice(-2),['run','build']);
assert(['v24.15.0','24.15.0'].includes(receipt.node));assert.equal(receipt.npm,'12.2.0');if(receipt.logSha256)assert.equal(digest(log),receipt.logSha256);
const selected=['src','convex-dev','package.json','package-lock.json','README.md','LICENSE.md','tsconfig.json','scripts/backend/build-distribution.mjs'];
const tree=git('ls-tree','-r','-z',commit,'--',...selected).toString().split('\0').filter(Boolean).map(line=>{const [header,file]=line.split('\t'),[mode,type,blob]=header.split(' ');assert.equal(type,'blob');assert(['100644','100755'].includes(mode));return{file,blob};});
const raw=execFileSync('git',['cat-file','--batch'],{cwd:R,input:tree.map(row=>row.blob).join('\n')+'\n',maxBuffer:30*1024*1024});let offset=0;
const inputs=tree.map(row=>{const end=raw.indexOf(10,offset),header=raw.subarray(offset,end).toString().split(' ');assert.deepEqual(header.slice(0,2),[row.blob,'blob']);const size=Number(header[2]);offset=end+1;const bytes=raw.subarray(offset,offset+size);offset+=size;assert.equal(raw[offset++],10);assert.equal(digest(fs.readFileSync(path.join(R,row.file))),digest(bytes),row.file);return{path:row.file,sha256:digest(bytes)};});assert.equal(offset,raw.length);
const outputs=fs.readdirSync(path.join(R,'dist'),{recursive:true,withFileTypes:true}).filter(row=>row.isFile()).map(row=>path.relative(R,path.join(row.parentPath,row.name))).sort().map(file=>{assert(!fs.lstatSync(path.join(R,file)).isSymbolicLink());return{path:file,sha256:digest(fs.readFileSync(path.join(R,file)))};});assert(outputs.length>0);
const manifestBytes=fs.readFileSync(path.join(R,'dist/backend/v1/manifest.json')),manifest=JSON.parse(manifestBytes);assert.equal(manifest.files.length,BACKEND_FILES);assert.equal(manifest.tables.length,BACKEND_TABLES);assert.deepEqual(manifest.components,['agent','workflow']);
for(const row of manifest.files){assert.equal(digest(fs.readFileSync(path.join(R,row.sourcePath))),row.sourceSha256);assert.equal(digest(fs.readFileSync(path.join(R,'dist/backend/v1',row.path))),row.sha256);}
const snapshot={version:1,status:'ACTUAL_ROOT_BUILD_SNAPSHOT',sourceCommit:commit,frozenRepair,rootBuildReceipt:path.resolve(receiptFile),rootBuildReceiptSha256:digest(receiptBytes),rootBuildLog:path.resolve(logFile),rootBuildLogSha256:digest(log),node:'24.15.0',npm:'12.2.0',selected,inputs,outputs,inputClosureSha256:digest(JSON.stringify(inputs)),outputClosureSha256:digest(JSON.stringify(outputs)),backendManifestSha256:digest(manifestBytes),rootSdkBuilds:1,isolatedBuilds:0};
const destination=path.join(Q,'memory-effort-canonical-package-root-sdk-snapshot.json');fs.writeFileSync(destination,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({destination,sourceCommit:commit,inputs:inputs.length,outputs:outputs.length,backendManifestSha256:snapshot.backendManifestSha256,buildsExecuted:0}));
