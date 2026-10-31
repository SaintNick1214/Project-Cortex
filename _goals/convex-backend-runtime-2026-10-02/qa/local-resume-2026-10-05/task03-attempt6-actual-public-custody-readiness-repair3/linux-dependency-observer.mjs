/** Attempt6 current observer. Original dependency physical contracts reused by reference; no historical runtime PASS is adopted. */
import assert from 'node:assert/strict';
import {constants,lstatSync,realpathSync,openSync,readSync,fstatSync,closeSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {sourcePreflight} from '../../task03-local-native-attempt6-2026-10-06/scripts/guard.mjs';
import {childToolchain} from '../../task03-local-native-attempt6-2026-10-06/scripts/child-toolchain.mjs';
const R='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const Q=join(R,'_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06');
const P=join(R,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05');
const fields=['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'];
const id=s=>Object.fromEntries(fields.map(k=>[k,String(s[k])]));
const sha=value=>createHash('sha256').update(value).digest('hex');
const pins=[]; let stdoutBytes=0;
function emit(value){
 const raw=Buffer.from(JSON.stringify(value));assert.ok(raw.length<=4*1024*1024);
 const line=Buffer.from(JSON.stringify({encoding:'gzip+base64',decodedBytes:raw.length,decodedSha256:sha(raw),body:gzipSync(raw,{level:9,mtime:0}).toString('base64')})+'\n');
 stdoutBytes+=line.length;assert.ok(stdoutBytes<=262144);process.stdout.write(line);
}
function capture(path,kind){
 // Capture and hold each actual descriptor before its first identity/content qualification.
 const before=lstatSync(path,{bigint:true});
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 const pin={path,kind,fd,closeAttempted:false};pins.push(pin); // immediate ownership before maturity/fstat/assertion
 assert.ok(BigInt(Date.now())*1000000n>=before.mtimeNs+60000000000n&&BigInt(Date.now())*1000000n>=before.ctimeNs+60000000000n,'immature_before_first_capture');
 pin.identityDecimal=id(before);assert.deepEqual(id(fstatSync(fd,{bigint:true})),pin.identityDecimal);return pin;
}
function qualify(pin,collect=false){
 const {fd,path,identityDecimal:baseline}=pin;
 assert.equal(realpathSync(path),path);assert.equal(lstatSync(path,{bigint:true}).isFile(),true);
 assert.equal(baseline.nlink,'1');assert.equal(baseline.uid,'501');assert.equal(baseline.gid,'20');
 assert.deepEqual(id(fstatSync(fd,{bigint:true})),baseline);
 const hash=createHash('sha256'),buf=Buffer.alloc(65536),chunks=[];let size=0,count,position=0;
 while((count=readSync(fd,buf,0,buf.length,position))!==0){
  position+=count;size+=count;assert.ok(BigInt(size)<=BigInt(baseline.size));hash.update(buf.subarray(0,count));
  if(collect){assert.ok(size<=4*1024*1024);chunks.push(Buffer.from(buf.subarray(0,count)));}
 }
 assert.equal(String(size),baseline.size);assert.deepEqual(id(fstatSync(fd,{bigint:true})),baseline);assert.deepEqual(id(lstatSync(path,{bigint:true})),baseline);
 return {path,sha256:hash.digest('hex'),bytes:size,identityDecimal:baseline,fullEOF:true,allNinePreOpenPostFinal:true,...(collect?{body:Buffer.concat(chunks)}:{})};
}
function sameOriginal(actual,original){assert.equal(actual.sha256,original.sha256);assert.equal(actual.bytes,original.bytes);assert.deepEqual(actual.identityDecimal,original.identityDecimal);}
let primaryError=null;const closeErrors=[];
function closeOwnedInputs(){
 for(const pin of pins){
  if(pin.closeAttempted)continue;
  pin.closeAttempted=true;
  try{closeSync(pin.fd);}catch(error){closeErrors.push(error);}
 }
}
try{
assert.equal(process.version,'v24.15.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.getuid(),501);assert.equal(process.getgid(),20);
assert.equal(process.env.HOME,'/tmp');assert.equal(Number(lstatSync('/tmp').mode)&0o777,0o700);assert.equal(Object.keys(process.env).some(k=>k.startsWith('CONVEX')),false);assert.equal(process.env.NODE_OPTIONS,undefined);
assert.equal(readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),'2147483648');assert.equal(readFileSync('/sys/fs/cgroup/memory.swap.max','utf8').trim(),'0');
function controlledJson(path,expected){const pin=capture(path,'original-dependency-contract-reference');const row=qualify(pin,true);assert.equal(row.sha256,expected);return JSON.parse(row.body);}
const prior=controlledJson('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-attempt5-repair3-actual-public-custody-readiness-review/operational-r3/actual-dependency-readiness.json','1cc1ec4b64cbc740b593866b9c6e9df29fdcb22f7e216b8378a74fd1cdcfc00c');
const provenance=controlledJson('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/linux-runner/task03-dependencies/linux-deps-verification-r2.json','5f7fc38fe8e62784db0ab9be562ceb8b994255a408ffadce563863cefdf2053d');
assert.equal(prior.rootMetadata.length,4);assert.equal(provenance.rootMetadata.length,4);
assert.deepEqual(prior.rootMetadata.map(r=>r.path),provenance.rootMetadata.map(r=>r.path));
const projection=controlledJson(join(Q,'attempt2/compiler-projection.json'),'dbb4d148f2fbb685d951a5e366969601acb68cdaecb114ebfb8b13d901fba2ac');assert.equal(projection.version,'6.0.3');assert.equal(projection.count,114);assert.equal(projection.files.length,114);
const roots=prior.rootMetadata.map(row=>({row,source:capture(join(R,row.path),'current-source-root-manifest'),volume:capture(join('/deps',row.path),'retained-original-root-manifest')}));
const exactPackages={'@convex-dev/agent':'0.7.3','@convex-dev/ai-sdk-provider':'0.2.1','@convex-dev/workflow':'0.4.8','@convex-dev/workpool':'0.4.13',ai:'7.0.127','neo4j-driver':'6.2.0',zod:'4.6.5',convex:'1.46.0',typescript:'6.0.3',ws:'8.21.0','https-proxy-agent':'7.0.6',esbuild:'0.27.0'};
const originalPackages=new Map(prior.versions.map(row=>[row.package,row]));assert.equal(originalPackages.size,5);
const packages=Object.entries(exactPackages).map(([name,version])=>({row:{package:name,version},original:originalPackages.get(name),pin:capture(join(R,'node_modules',name,'package.json'),'current-package-manifest')}));
const compiler=projection.files.map(row=>{
 assert.ok(row.source.startsWith('node_modules/typescript/')&&row.copy.startsWith('managed-fixture/fixture/node_modules/typescript/')&&!row.source.split('/').includes('..')&&!row.copy.split('/').includes('..'));
 return {row,root:capture(join(R,row.source),'current-root-compiler'),projected:capture(join(Q,row.copy),'current-projected-compiler')};
});
// This complete all9 baseline is emitted before any captured file's first qualification.
const captured=pins.map(({fd,closeAttempted,...pin})=>pin);
emit({scope:'PROSPECTIVE_CURRENT_BIND_SESSION_ALL9_CAPTURE_BEFORE_FIRST_QUALIFICATION',sourceRoots:4,compilerProjectionMembers:114,heldDescriptors:captured.length,files:captured,historicalSourcePinsAdopted:false});
 const rootMetadata=[],historicalSourceIdentityDifferences=[];
 for(const {row,source,volume} of roots){
  const currentSource=qualify(source),currentVolume=qualify(volume);sameOriginal(currentVolume,row.volume);
  assert.equal(currentSource.sha256,row.source.sha256);assert.equal(currentSource.bytes,row.source.bytes);
  for(const field of fields.filter(k=>!['dev','ino'].includes(k)))assert.equal(currentSource.identityDecimal[field],row.source.identityDecimal[field]);
  const changed=fields.filter(k=>currentSource.identityDecimal[k]!==row.source.identityDecimal[k]);
  if(changed.length)historicalSourceIdentityDifferences.push({path:row.path,fields:changed,original:row.source.identityDecimal,current:currentSource.identityDecimal});
  assert.equal(currentSource.sha256,provenance.rootMetadata.find(r=>r.path===row.path).sha256);
  rootMetadata.push({path:row.path,source:currentSource,volume:currentVolume});
 }
 const versions=[];
 for(const {row,original,pin} of packages){const actual=qualify(pin,true);if(original)sameOriginal(actual,original.metadata);const pkg=JSON.parse(actual.body);delete actual.body;assert.equal(pkg.version,row.version);versions.push({package:row.package,version:pkg.version,metadata:actual,retainedOriginalNineCompared:!!original});}
 const compilerRows=[];
 for(const {row,root,projected} of compiler){
  const a=qualify(root),b=qualify(projected);assert.equal(a.sha256,row.sha256);assert.equal(b.sha256,row.sha256);assert.equal(a.bytes,row.bytes);assert.equal(b.bytes,row.bytes);
  compilerRows.push({source:row.source,copy:row.copy,root:a,projected:b});
 }
 const {source,copies,frozen}=sourcePreflight();assert.equal(source.files.length,161);assert.equal(copies.files.length,138);assert.equal(frozen.files.length,1907);assert.equal(frozen.actualExternalRequests,0);assert.equal(frozen.actualDeployments,0);
 const toolchain=childToolchain();assert.equal(toolchain.nodeVersion,'v24.15.0');assert.equal(toolchain.npmVersion,'12.2.0');assert.equal(toolchain.compilerVersion,'Version 6.0.3');assert.equal(toolchain.projectedCompilerVersion,'Version 6.0.3');
 const require=createRequire(import.meta.url),esbuild=require(resolve(R,'node_modules/esbuild'));
 const transform=esbuild.transformSync('const answer: number = 42;',{loader:'ts'}).code.trim();assert.equal(transform,prior.nativeEsbuildTransform);assert.equal(transform,provenance.esbuildTransform);
 const finalHeld=[];
 for(const pin of pins){const current=qualify(pin);assert.deepEqual(current.identityDecimal,pin.identityDecimal);finalHeld.push({path:pin.path,kind:pin.kind,...current});}
 emit({scope:'ACTUAL_ATTEMPT6_PROSPECTIVE_CURRENT_PUBLIC_DEPENDENCY_READINESS_ONLY',status:'PASS',node:process.version,npm:toolchain.npmVersion,platform:process.platform,arch:process.arch,uid:process.getuid(),gid:process.getgid(),rootMetadata,versions,fixtureExactPackagePins:9,ancillaryExactPackagePins:3,compilerProjectionMembers:114,compilerRows,sourcePreflightCounts:[161,138,1907],compilerVersion:toolchain.compilerVersion,projectedCompilerVersion:toolchain.projectedCompilerVersion,nativeEsbuildTransform:transform,currentSourceAll9BeforeFirstQualificationThroughHeldFinal:'PASS',retainedOriginalVolumePackageAll9:'PASS',historicalSourceIdentity:'UNKNOWN_NOT_ADOPTED',historicalSourceIdentityDifferences,finalHeld,historicalFailedBodyEqualityPreserved:true,externalRequests:0,serviceDeployments:0,packageInstalls:0,volumeWrites:0,privateScratchReads:0,nativeFoundationAccepted:false});
}catch(error){primaryError=error;}finally{closeOwnedInputs();}
if(primaryError!==null||closeErrors.length)throw new AggregateError([...(primaryError!==null?[primaryError]:[]),...closeErrors],'dependency observer sticky primary and owned-close failure chain');
