/** Root pin integration after actual source/package/image checks; no services. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const Q=path.dirname(fileURLToPath(import.meta.url)),R=path.resolve(Q,'../../../..');
const P='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs',base=path.join(P,'sandbox-env');
const SOURCE=process.argv[2],PRIOR='3875d3238705a90cb191abbf824d3fa3517e42e5';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
assert.equal(process.version,'v24.15.0');assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_INTEGRATION_GO,'1');
assert.match(SOURCE??'',/^[a-f0-9]{40}$/);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),SOURCE);
const proposal=await json(path.join(Q,'memory-effort-canonical-package-integration-proposal.json'));
const next=proposal.next,current=proposal.current,pack=await json(proposal.packagerReceipt);
assert.equal(current.sourceCommit,PRIOR);assert.equal(next.sourceCommit,SOURCE);
assert.equal(next.kit,path.join(P,'manual-sandbox-memory-effort-canonical-2026-10-15'));
assert.equal(pack.status,'PACKAGING_PASS_ROOT_INTEGRATION_PENDING');assert.equal(pack.sourceCommit,SOURCE);
for(const [key,value]of Object.entries({rootSdkBuilds:1,isolatedBuilds:0,packs:1,reusedArchives:3,packedConsumers:4,consumerReruns:0,imageBuilds:1,imageBuildCommandAttempts:1,serviceCalls:0,inferenceCalls:0,runtimeContainersCreated:0,runtimeContainersStarted:0}))assert.equal(pack.counts[key],value,key);
const reviewPath=next.sourceReview.path,reviewBytes=await fs.readFile(reviewPath),review=JSON.parse(reviewBytes);
assert.equal(sha(reviewBytes),next.sourceReview.sha256);assert.equal(review.verdict,'PASS');
const breaking=review.unresolvedBreakingFindings??review.breakingFindings;assert(breaking===0||Array.isArray(breaking)&&breaking.length===0);
const frozen=await json(path.join(Q,'memory-effort-canonical-coherent-source-hashes.json'));assert.deepEqual(review.sourceHashesFinal,frozen.sourceHashes);
for(const [file,digest]of Object.entries(review.sourceHashesFinal))assert.equal(sha(execFileSync('git',['show',SOURCE+':'+file],{cwd:R,maxBuffer:1024*1024})),digest,file);
const manifestBytes=await fs.readFile(next.artifactManifest),manifest=JSON.parse(manifestBytes),KIT=next.kit;
assert.equal(sha(manifestBytes),next.artifactManifestSha256);assert.equal(manifest.sourceCommit,SOURCE);
assert.equal(manifest.backend.files,174);assert.equal(manifest.backend.allSourceOutputHashesMatch,true);
assert.equal(manifest.backend.manifestSha256,next.backendManifestSha256);assert.equal(pack.backend.tables,79);assert.deepEqual(pack.backend.components,['agent','workflow']);
const image=pack.image,actualFiles=await json(proposal.imageActualFiles);
assert.equal(image.imageId,next.imageId);assert.equal(actualFiles.status,'ACTUAL_IMAGE_FILES_VERIFIED');
assert.equal(actualFiles.imageId,image.imageId);assert.equal(actualFiles.archiveManifestSha256,sha(manifestBytes));assert.equal(actualFiles.npmVersion,'12.2.0');
assert.equal(image.labels['dev.cortex.manual-sandbox.source'],SOURCE);assert.equal(image.labels['dev.cortex.manual-sandbox.path'],KIT);
assert.equal(image.os,'linux');assert.equal(image.architecture,'arm64');assert.equal(image.user,'sandbox');
for(const entry of manifest.packages)assert.equal(sha(await fs.readFile(path.join(KIT,'image/archives',entry.filename))),entry.sha256);
for(const row of proposal.consumerReceipts)assert.equal((await json(row.receipt)).exitCode,0,row.name);
const host=await json(next.hostCliImport);assert.equal(host.files.length,5);assert.equal(host.dynamicImport.fetchCalls,0);
const originals={};for(const name of ['docker.mjs','runner.mjs','runtime.mjs','local.test.mjs','procedure-approval.json']){
  originals[name]=await fs.readFile(path.join(base,name),'utf8');assert.equal(sha(originals[name]),current.launcherHashes[name],name);
}
assert.equal(sha(originals['runtime.mjs']),proposal.retained.runtimeSha256);
function once(text,before,after){assert.equal(text.split(before).length,2,before);return text.replace(before,after);}
let docker=originals['docker.mjs'];assert(docker.includes("export const SOURCE_COMMIT = '"+PRIOR+"'"));
const priorImage=/export const IMAGE_ID = '([^']+)'/.exec(docker)[1];assert.equal(priorImage,current.imageId);
for(const [name,value]of Object.entries({IMAGE_ID:image.imageId,SOURCE_COMMIT:SOURCE,BACKEND_MANIFEST_SHA256:next.backendManifestSha256})){
  const re=new RegExp("export const "+name+" = '[^']+'");assert(re.test(docker));docker=docker.replace(re,"export const "+name+" = '"+value+"'");
}
docker=once(docker,'export const LABEL =',`export const PRIOR_MEMORY_EFFORT_SINGLETON_IMAGE_ID = '${priorImage}';\nexport const LABEL =`);
docker=once(docker,'PRIOR_MEMORY_EFFORT_LITERAL_IMAGE_ID].includes(imageId)','PRIOR_MEMORY_EFFORT_LITERAL_IMAGE_ID, PRIOR_MEMORY_EFFORT_SINGLETON_IMAGE_ID].includes(imageId)');
for(const entry of manifest.packages){
  const re=new RegExp('^  '+entry.role+': \\{[^\\n]+\\},$','m');assert(re.test(docker));
  docker=docker.replace(re,`  ${entry.role}: { name: '${entry.name}', version: '${entry.version}', filename: '${entry.filename}', sha256: '${entry.sha256}' },`);
}
const runner=once(originals['runner.mjs'],"const KIT_NAME = 'manual-sandbox-memory-effort-singleton-2026-10-15';","const KIT_NAME = 'manual-sandbox-memory-effort-canonical-2026-10-15';");
let local=once(originals['local.test.mjs'],'PRIOR_MEMORY_EFFORT_LITERAL_IMAGE_ID, SOURCE_COMMIT','PRIOR_MEMORY_EFFORT_LITERAL_IMAGE_ID, PRIOR_MEMORY_EFFORT_SINGLETON_IMAGE_ID, SOURCE_COMMIT');
local=once(local,'PRIOR_MEMORY_EFFORT_LITERAL_IMAGE_ID])','PRIOR_MEMORY_EFFORT_LITERAL_IMAGE_ID, PRIOR_MEMORY_EFFORT_SINGLETON_IMAGE_ID])');
local=once(local,'manual-sandbox-memory-effort-singleton-2026-10-15','manual-sandbox-memory-effort-canonical-2026-10-15');
const replacements={'docker.mjs':docker,'runner.mjs':runner,'local.test.mjs':local};
for(const text of Object.values(replacements))execFileSync(process.execPath,['--check','--input-type=module'],{input:text,stdio:['pipe','pipe','pipe']});
const approval=JSON.parse(originals['procedure-approval.json']);
assert.equal(approval.candidateSourceCommit,PRIOR);assert.equal(approval.maximumPaidRequests,8);assert.equal(approval.maximumUnknownLiabilityUnits,2700000);assert.equal(approval.perRunHumanReview,false);
const retainedProcedureReview={path:approval.reviewPath,sha256:approval.reviewSha256};
assert.equal(sha(await fs.readFile(retainedProcedureReview.path)),retainedProcedureReview.sha256);
for(const row of approval.files)assert.equal(sha(await fs.readFile(path.resolve(base,row.path))),row.sha256,row.path);
for(const [name,text]of Object.entries(originals))await fs.writeFile(path.join(Q,'memory-effort-canonical-'+name+'-before-pin'),text,{flag:'wx'});
for(const [name,text]of Object.entries(replacements))await fs.writeFile(path.join(base,name),text);
approval.procedureHistory.push({approvalSha256:sha(originals['procedure-approval.json']),reviewSha256:approval.reviewSha256,sourceCommit:PRIOR,methods:8,unknownLiabilityUnits:2700000});
approval.candidateSourceCommit=SOURCE;
for(const row of approval.files)row.sha256=sha(await fs.readFile(path.resolve(base,row.path)));
approval.sourceAcceptance={kind:'REVIEWED_SOURCE_PIN_INTEGRATION_UNCHANGED_STRICT_PROCEDURE',sourceCommit:SOURCE,kit:KIT,imageId:image.imageId,artifactReceiptSha256:sha(manifestBytes),sourceReviewPath:reviewPath,sourceReviewSha256:sha(reviewBytes),sourceReviewScope:'Fifteen frozen coherent core source/test files; original strict eight-call procedure review retained',retainedProcedureReview,runtimeByteIdentical:true};
await fs.writeFile(path.join(base,'procedure-approval.json'),JSON.stringify(approval,null,2)+'\n');
const {verifyProcedure}=await import(path.join(base,'qualification.mjs')),procedure=await verifyProcedure();
const {verifyArtifacts}=await import(path.join(base,'docker.mjs')),artifacts=await verifyArtifacts(KIT);
const receipt={status:'CANONICAL_PACKAGING_AND_LAUNCHER_INTEGRATION_COMPLETE',sourceCommit:SOURCE,kit:KIT,imageId:image.imageId,manifestSha256:sha(manifestBytes),backend:pack.backend,sourceSelectionDigest:pack.sourceSelectionDigest,procedureDigest:procedure.digest,sourceReviewPath:reviewPath,sourceReviewSha256:sha(reviewBytes),retainedProcedureReview,artifacts,consumers:proposal.consumerReceipts,hostCliImport:next.hostCliImport,priorImageCleanupRetained:priorImage,runtimeByteIdentical:true,packagingCounts:pack.counts,maximumPaidRequests:8,maximumUnknownLiabilityUnits:2700000,perRunHumanReview:false,services:0,inferenceCalls:0,nativeQualified:false,files:Object.keys(originals).map(name=>({name,beforeSha256:sha(originals[name]),afterSha256:sha(name==='procedure-approval.json'?JSON.stringify(approval,null,2)+'\n':replacements[name]??originals[name])})),at:new Date().toISOString()};
const destination=path.join(Q,'memory-effort-canonical-package-checks/launcher-integration-final-receipt.json');
await fs.writeFile(destination,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,sourceCommit:SOURCE,imageId:image.imageId,procedureDigest:procedure.digest,services:0}));
