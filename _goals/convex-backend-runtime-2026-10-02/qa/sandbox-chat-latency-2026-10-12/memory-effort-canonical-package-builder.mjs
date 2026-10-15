/** Read-only plan until Root supplies the accepted commit, source hashes and fresh SDK output snapshot. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const Q=path.dirname(fileURLToPath(import.meta.url)),R=path.resolve(Q,'../../../..');
export const P='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
export const PRIOR_COMMIT='3875d3238705a90cb191abbf824d3fa3517e42e5';
export const NAME='manual-sandbox-memory-effort-canonical-2026-10-15';
export const KIT=path.join(P,NAME),CHECKS=path.join(Q,'memory-effort-canonical-package-checks');
export const BACKEND_FILES=174,BACKEND_TABLES=79;
export const REGISTRY_HASH='5152bd0c3f8e35907c2d57c0a3467e2450e8db0dfb5174c552024c954554a515';
export const FIXTURE_HASH='b7c71cc4f635645b54c3c30117cbf132f1a48304f271b66f12ed6c86339a9075';
const oldName='manual-sandbox-memory-effort-singleton-2026-10-15',oldKit=path.join(P,oldName),oldChecks=path.join(Q,'memory-effort-singleton-package-checks');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>{assert(fs.lstatSync(file).isFile(),file);return fs.readFileSync(file,'utf8');};
const git=(...args)=>execFileSync('git',args,{cwd:R,encoding:'utf8',maxBuffer:20*1024*1024});
const remap=(text,commit)=>text.replaceAll(oldName,NAME).replaceAll('memory-effort-singleton-package','memory-effort-canonical-package').replaceAll(PRIOR_COMMIT,commit).replaceAll('cortex-sandbox-memory-effort-singleton:20261015','cortex-sandbox-memory-effort-canonical:20261015');

export function hashRows(value){
 const candidate=value.files??value.ownedSourceHashes??value.sourceHashes??value.hashes??value;
 const rows=Array.isArray(candidate)?candidate:Object.entries(candidate).filter(([,hash])=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)).map(([file,sha256])=>({file,sha256}));
 return rows.filter(row=>!row.repository||row.repository==='R').map(row=>{
  const file=row.relative??row.path??row.file;assert.equal(typeof file,'string');
  const relative=path.isAbsolute(file)?path.relative(R,file):file;
  assert(!path.isAbsolute(relative)&&!relative.split(path.sep).includes('..'),file);
  assert.match(row.sha256??'',/^[a-f0-9]{64}$/);
  return {repository:'R',file:path.join(R,relative),relative,sha256:row.sha256};
 }).sort((a,b)=>a.relative.localeCompare(b.relative));
}
export function frozenSourcePins(commit='SOURCE_COMMIT_PENDING',frozenFile){
 if(!frozenFile){assert.equal(commit,'SOURCE_COMMIT_PENDING');return {files:[],pending:true};}
 const metadata=path.resolve(frozenFile),files=hashRows(JSON.parse(read(metadata)));assert(files.length>0,'Frozen source hash rows required');
 assert.equal(new Set(files.map(row=>row.relative)).size,files.length,'Duplicate frozen source files');
 for(const row of files){assert.equal(sha(fs.readFileSync(row.file)),row.sha256,'Frozen current source changed: '+row.relative);if(commit!=='SOURCE_COMMIT_PENDING')assert.equal(sha(git('show',commit+':'+row.relative)),row.sha256,'Accepted commit lacks frozen repair: '+row.relative);}
 return {files,metadata:[{file:metadata,sha256:sha(fs.readFileSync(metadata))}],productFiles:files.filter(row=>!row.relative.startsWith('tests/')).length,testFiles:files.filter(row=>row.relative.startsWith('tests/')).length,pending:false};
}
export function validateSourceReview(review,frozenFiles){
 assert.equal(review.verdict,'PASS');
 const breaking=review.unresolvedBreakingFindings??review.breakingFindings;
 assert(breaking===0||Array.isArray(breaking)&&breaking.length===0,'Source review must have zero unresolved breaking findings');
 const reviewed=hashRows(review.sourceHashesFinal??review.sourceHashes??review.hashesChecked??review);
 assert.equal(new Set(reviewed.map(row=>row.relative)).size,reviewed.length,'Duplicate reviewed source files');
 // Consume the independent review's accepted schema without requiring a reviewer rewrite.
 for(const field of ['sourceHashesBefore','sourceHashesAfterIndependentChecks'])if(review[field])assert.deepEqual(hashRows(review[field]),reviewed,'Review source hashes changed: '+field);
 if(review.allFrozenHashesMatch!==undefined)assert.equal(review.allFrozenHashesMatch,true);
 for(const expected of frozenFiles)assert(reviewed.some(row=>row.relative===expected.relative&&row.sha256===expected.sha256),'Review must cover frozen repair: '+expected.relative);
 return reviewed;
}
export function buildPlan(commit='SOURCE_COMMIT_PENDING',sdkSnapshot,frozenFile){
 assert(commit==='SOURCE_COMMIT_PENDING'||/^[a-f0-9]{40}$/.test(commit));
 const frozenRepair=frozenSourcePins(commit,frozenFile),at=relative=>commit==='SOURCE_COMMIT_PENDING'?read(path.join(R,relative)):git('show',commit+':'+relative);
 for(const [file,version]of [['package.json','0.39.0'],['packages/cortex-cli/package.json','0.39.0'],['packages/vercel-ai-provider/package.json','0.39.0'],['packages/cortex-templates/package.json','1.4.0']])assert.equal(JSON.parse(at(file)).version,version,file);
 const catalog=JSON.parse(at('packages/cortex-templates/catalog.json'));assert.equal(catalog.version,'1.4.0');assert.equal(catalog.templates.length,18);
 const strictPins=JSON.parse(read(path.join(Q,'memory-effort-strict-launcher-owned-hashes.json')));for(const row of strictPins.files)assert.equal(sha(fs.readFileSync(row.file)),row.sha256,row.file);
 const approvalFile=path.join(P,'sandbox-env/procedure-approval.json'),approval=JSON.parse(read(approvalFile));
 assert.equal(approval.candidateSourceCommit,PRIOR_COMMIT);assert.equal(approval.maximumPaidRequests,8);assert.equal(approval.maximumUnknownLiabilityUnits,2700000);assert.equal(approval.perRunHumanReview,false);
 assert.equal(approval.reviewSha256,'c52630af433922a856dfe0847f5e0324edf795f4db16b914002ca72678762b4b');assert.equal(sha(fs.readFileSync(approval.reviewPath)),approval.reviewSha256);
 const reuse=JSON.parse(execFileSync('python3',[path.join(Q,'memory-effort-canonical-package-reuse.py'),commit,...(sdkSnapshot?[sdkSnapshot]:[])],{cwd:R,encoding:'utf8',maxBuffer:12*1024*1024}));
 const planned=[],add=(root,name,origin,transform=text=>text)=>{const original=read(origin),text=transform(remap(original,commit));planned.push({root,name,origin,originSha256:sha(original),sha256:sha(text),text});};
 add('kit','prepare.mjs',path.join(Q,'memory-effort-canonical-package-prepare.candidate.mjs'));
 for(const name of ['image/Dockerfile','image/install-candidates.mjs','image/entrypoint.mjs'])add('kit',name,path.join(oldKit,name));
 for(const name of ['run-consumers.mjs','verify-actual-packed-public-contracts.mjs','verify-packed-dependent-contracts.mjs','verify-packed-backend-export-closure.mjs','verify-packed-template-catalog.mjs'])add('checks',name,path.join(oldChecks,name));
 add('checks','build-image.mjs',path.join(oldChecks,'build-image.mjs'));
 const fixture=path.join(oldKit,'fixtures/memoryEffortQualification.ts');assert.equal(sha(read(fixture)),FIXTURE_HASH);add('kit','fixtures/memoryEffortQualification.ts',fixture);
 const selected=['src','convex-dev','package.json','package-lock.json','README.md','LICENSE.md','tsconfig.json','scripts/backend/build-distribution.mjs','packages/cortex-cli/package.json','packages/vercel-ai-provider/package.json','packages/cortex-templates/package.json'];
 const inventory=commit==='SOURCE_COMMIT_PENDING'?null:execFileSync('git',['ls-tree','-r','-z',commit,'--',...selected],{cwd:R,maxBuffer:20*1024*1024});
 return {status:commit==='SOURCE_COMMIT_PENDING'?'PREPARATION_ONLY_SOURCE_REVIEW_PENDING':'REVIEWED_SOURCE_PLAN',acceptedSourceCommit:commit,sourceSelectionDigest:inventory?sha(inventory):null,frozenRepair,kit:KIT,checks:CHECKS,
  archiveReuse:reuse.packages.map(({sourceClosure,generatedClosure,...row})=>row),rootFreshSdkBuild:reuse.sdk,
  backend:{files:BACKEND_FILES,tables:BACKEND_TABLES,components:['agent','workflow'],prospective:!reuse.sdk.eligibleNow},
  runtimeCapabilities:{inputSelectionVersion:2,memoryEffortPolicyVersion:1},registryHash:REGISTRY_HASH,fixtureSha256:FIXTURE_HASH,maximumPaidRequests:8,maximumUnknownLiabilityUnits:2700000,strictStartupPins:strictPins.files,
  strictProcedure:{approvalFile,approvalSha256:sha(fs.readFileSync(approvalFile)),reviewPath:approval.reviewPath,reviewSha256:approval.reviewSha256,maximumPaidRequests:8,maximumUnknownLiabilityUnits:2700000},
  hostCliClosure:{archiveSha256:'847367abe21d000cd34b3bb59f1d7aadaacfbd8fdc3b36baf85baba822345f8b',publishedModules:5,offlineDynamicImportRequired:true},planned};
}
export function validateSyntax(plan){for(const row of plan.planned.filter(row=>row.name.endsWith('.mjs')))execFileSync(process.execPath,['--check','--input-type=module'],{input:row.text,stdio:['pipe','pipe','pipe']});}
export const summary=plan=>({...plan,planned:plan.planned.map(({text,...row})=>row),builds:0,packs:0,images:0,serviceCalls:0,inferenceCalls:0,launcherChanged:false});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.version,'v24.15.0');const [mode,commit='SOURCE_COMMIT_PENDING',sdkSnapshot,frozenFile]=process.argv.slice(2);assert(['--plan','--write-controls'].includes(mode));
 if(mode==='--write-controls'){assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_BUILD_GO,'1','Root packaging GO required');assert.match(commit,/^[a-f0-9]{40}$/);}
 const plan=buildPlan(commit,sdkSnapshot,frozenFile);validateSyntax(plan);
 if(mode==='--write-controls'){
  assert.equal(git('rev-parse','HEAD').trim(),commit);assert(plan.rootFreshSdkBuild.eligibleNow,'Root fresh SDK snapshot required');assert(plan.archiveReuse.length===3&&plan.archiveReuse.every(row=>row.eligibleNow),'All unchanged archives must pass source and actual published-file closure proof');assert(!plan.frozenRepair.pending);
  assert(!fs.existsSync(KIT));assert(!fs.existsSync(CHECKS));fs.mkdirSync(KIT);fs.mkdirSync(CHECKS);
  for(const name of ['staging','artifacts','cache','image/archives','fixtures'])fs.mkdirSync(path.join(KIT,name),{recursive:true});
  fs.writeFileSync(path.join(KIT,'identity.json'),JSON.stringify({version:1,id:randomUUID(),ownerUid:process.getuid(),ownerGid:process.getgid()},null,2)+'\n',{flag:'wx',mode:0o600});
  for(const row of plan.planned){const destination=path.join(row.root==='kit'?KIT:CHECKS,row.name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,row.text,{flag:'wx'});}
  fs.writeFileSync(path.join(CHECKS,'preparation.json'),JSON.stringify(summary(plan),null,2)+'\n',{flag:'wx'});
 }
 console.log(JSON.stringify(summary(plan),null,2));
}
