/** Actual retained dependencies only: reads, versions and one offline native transform. */
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,realpathSync,openSync,readSync,fstatSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const R='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const require=createRequire(import.meta.url);
const fields=['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'];
const id=s=>Object.fromEntries(fields.map(k=>[k,String(s[k])]));
function held(path){
 const before=lstatSync(path,{bigint:true}); assert.equal(before.isFile(),true); assert.equal(before.nlink,1n);
 assert.equal(realpathSync(path),path); const pin=id(before),fd=openSync(path,'r');
 try {assert.deepEqual(id(fstatSync(fd,{bigint:true})),pin);const chunks=[];let size=0;const buf=Buffer.alloc(65536);let count;
 while((count=readSync(fd,buf,0,buf.length,null))!==0){size+=count;assert.ok(size<=4*1024*1024);chunks.push(Buffer.from(buf.subarray(0,count)));}
 assert.equal(size,Number(before.size));assert.deepEqual(id(fstatSync(fd,{bigint:true})),pin);assert.deepEqual(id(lstatSync(path,{bigint:true})),pin);
 const body=Buffer.concat(chunks);return {path,sha256:createHash('sha256').update(body).digest('hex'),bytes:size,identityDecimal:pin,fullEOF:true,allNinePreOpenPostFinal:true,body};
 }finally{closeSync(fd);}
}
assert.equal(process.version,'v24.15.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.getuid(),501);assert.equal(process.getgid(),20);
assert.equal(process.env.HOME,'/tmp');assert.equal(Number(lstatSync('/tmp').mode)&0o777,0o700);
assert.equal(Object.keys(process.env).some(k=>k.startsWith('CONVEX')),false);
const provenancePath=join(R,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/linux-runner/task03-dependencies/linux-deps-verification-r2.json');
const provenance=JSON.parse(readFileSync(provenancePath,'utf8'));
const rootMetadata=[];
for(const row of provenance.rootMetadata){
 const source=held(join(R,row.path)),volume=held(join('/deps',row.path));
 assert.equal(source.sha256,row.sha256);assert.equal(volume.sha256,row.sha256);assert.equal(source.bytes,volume.bytes);
 delete source.body;delete volume.body;rootMetadata.push({path:row.path,source,volume});
}
const versions=[];
for(const row of provenance.versions){const packagePath=join(R,'node_modules',row.package,'package.json');const meta=held(packagePath),body=JSON.parse(meta.body);delete meta.body;assert.equal(body.version,row.version);versions.push({package:row.package,version:body.version,metadata:meta});}
const env={PATH:process.env.PATH,HOME:'/tmp',LANG:'C.UTF-8',NO_COLOR:'1',CI:'1',TMPDIR:'/tmp'};
const result=spawnSync(process.execPath,['/usr/local/lib/node_modules/npm/bin/npm-cli.js','--version'],{env,encoding:'utf8',timeout:3000,maxBuffer:16384});
assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0);assert.equal(result.stdout.trim(),'12.2.0');
const esbuild=require(resolve(R,'node_modules/esbuild'));
const transformed=esbuild.transformSync('const answer: number = 42;',{loader:'ts'}).code;
assert.equal(transformed.trim(),provenance.esbuildTransform);
console.log(JSON.stringify({scope:'ACTUAL_PRIOR_PROVISIONED_LINUX_DEPENDENCY_READINESS_ONLY',status:'PASS',node:process.version,npm:result.stdout.trim(),platform:process.platform,arch:process.arch,uid:process.getuid(),gid:process.getgid(),rootMetadata,versions,nativeEsbuildTransform:transformed.trim(),externalRequests:0,serviceDeployments:0,packageInstalls:0,volumeWrites:0,nativeFoundationAccepted:false}));
