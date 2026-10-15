/** Exact accepted artifact/definition pins. Does not start any service or qualification. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const Q=path.dirname(fileURLToPath(import.meta.url)),P='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const base=path.join(P,'sandbox-env'),kit=path.join(P,'manual-sandbox-memory-effort-2026-10-14'),checks=path.join(Q,'memory-effort-kit-checks');
const commit='d075d2c3f6aaa3da87ed54e3c3c62db8fbaedabe';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const manifestBytes=await fs.readFile(path.join(kit,'image/archives/manifest.json')),manifest=JSON.parse(manifestBytes);
const image=await json(path.join(checks,'docker-image-identity.json'));
assert.equal(manifest.sourceCommit,commit);assert.equal(manifest.backend.files,173);assert(manifest.backend.allSourceOutputHashesMatch);
assert.equal(image.labels['dev.cortex.manual-sandbox.source'],commit);assert.equal(image.labels['dev.cortex.manual-sandbox.path'],kit);assert.equal(image.os,'linux');assert.equal(image.architecture,'arm64');assert.equal(image.user,'sandbox');
const consumers=[];
for(const name of ['verify-actual-packed-public-contracts','verify-packed-dependent-contracts','verify-packed-backend-export-closure','verify-packed-template-catalog']){const row=await json(path.join(checks,name+'-exit-v2.json'));assert.equal(row.exitCode,0);consumers.push({name,...row});}
for(const row of manifest.packages)assert.equal(digest(await fs.readFile(path.join(kit,'image/archives',row.filename))),row.sha256);
const reviewPath=path.join(Q,'memory-effort-joint-source-review.md'),reviewBytes=await fs.readFile(reviewPath),review=await json(path.join(Q,'memory-effort-joint-source-review.json'));
assert.equal(review.verdict,'PASS');assert.deepEqual(review.unresolvedConcreteBreakingFindings,[]);
const approvalBytes=await fs.readFile(path.join(base,'procedure-approval.json')),approval=JSON.parse(approvalBytes);
assert.equal(approval.maximumPaidRequests,8);assert.equal(approval.maximumUnknownLiabilityUnits,2700000);assert.equal(approval.perRunHumanReview,false);
const originals={};for(const name of ['docker.mjs','runner.mjs','runtime.mjs','local.test.mjs','procedure-approval.json'])originals[name]=await fs.readFile(path.join(base,name),'utf8');
function once(text,before,after){assert.equal(text.split(before).length,2,before);return text.replace(before,after);}
let docker=originals['docker.mjs'],runner=originals['runner.mjs'],local=originals['local.test.mjs'];
const oldImage=/export const IMAGE_ID = '([^']+)'/.exec(docker)[1];assert.equal(oldImage,'sha256:8d1afbb653dbcfa5c1592b79831502be3ac7f7e5ee51ee6ceaa7a96703e22fbd');
for(const [name,value]of Object.entries({IMAGE_ID:image.imageId,SOURCE_COMMIT:commit,BACKEND_MANIFEST_SHA256:manifest.backend.manifestSha256})){const expression=new RegExp("export const "+name+" = '[^']+'");assert(expression.test(docker));docker=docker.replace(expression,"export const "+name+" = '"+value+"'");}
docker=once(docker,'export const BACKEND_FILE_COUNT = 170;','export const BACKEND_FILE_COUNT = 173;');
docker=once(docker,'BACKEND_FILE_COUNT !== 170','BACKEND_FILE_COUNT !== 173');
docker=once(docker,"export const LABEL =",`export const PRIOR_NATIVE_SNAPSHOT_IMAGE_ID = '${oldImage}';\nexport const LABEL =`);
docker=once(docker,'PRIOR_DELIVERY_PLAN_IMAGE_ID].includes(imageId)','PRIOR_DELIVERY_PLAN_IMAGE_ID, PRIOR_NATIVE_SNAPSHOT_IMAGE_ID].includes(imageId)');
for(const row of manifest.packages){const expression=new RegExp('^  '+row.role+': \\{[^\\n]+\\},$','m');assert(expression.test(docker));docker=docker.replace(expression,`  ${row.role}: { name: '${row.name}', version: '${row.version}', filename: '${row.filename}', sha256: '${row.sha256}' },`);}
docker=docker.replaceAll('cortexmemory-templates-1.3.3.tgz','cortexmemory-templates-1.4.0.tgz').replaceAll("'1.3.3'","'1.4.0'").replaceAll("'1.4.2'","'1.5.0'");
runner=once(runner,"const KIT_NAME = 'manual-sandbox-native-snapshot-2026-10-14';","const KIT_NAME = 'manual-sandbox-memory-effort-2026-10-14';");assert(runner.includes('HOME: os.homedir()'));
local=once(local,'PRIOR_DELIVERY_PLAN_IMAGE_ID, SOURCE_COMMIT','PRIOR_DELIVERY_PLAN_IMAGE_ID, PRIOR_NATIVE_SNAPSHOT_IMAGE_ID, SOURCE_COMMIT');
local=once(local,'PRIOR_DELIVERY_PLAN_IMAGE_ID])','PRIOR_DELIVERY_PLAN_IMAGE_ID, PRIOR_NATIVE_SNAPSHOT_IMAGE_ID])');
local=once(local,'manual-sandbox-native-snapshot-2026-10-14','manual-sandbox-memory-effort-2026-10-14');
local=local.replaceAll('cortexmemory-templates-1.3.3.tgz','cortexmemory-templates-1.4.0.tgz').replaceAll("'1.3.3'","'1.4.0'").replaceAll("'1.4.2'","'1.5.0'");
const runtime=await fs.readFile(path.join(Q,'memory-effort-kit-runtime.candidate.mjs'),'utf8');
assert(runtime.includes("handlerVersion: 2")&&runtime.includes('inputSelection: { version: 2 }')&&runtime.includes('fixtures/memoryEffortQualification.ts'));
// All source/receipt applicability is checked before the first shared launcher write.
for(const [name,text]of Object.entries(originals))await fs.writeFile(path.join(Q,'memory-effort-kit-'+name+'-before-pin'),text,{flag:'wx'});
for(const [name,text]of Object.entries({'docker.mjs':docker,'runner.mjs':runner,'runtime.mjs':runtime,'local.test.mjs':local}))await fs.writeFile(path.join(base,name),text);
approval.procedureHistory.push({approvalSha256:digest(approvalBytes),reviewSha256:approval.reviewSha256,sourceCommit:approval.candidateSourceCommit,methods:8,unknownLiabilityUnits:2700000});
approval.reviewPath=reviewPath;approval.reviewSha256=digest(reviewBytes);approval.candidateSourceCommit=commit;
for(const row of approval.files)row.sha256=digest(await fs.readFile(path.resolve(base,row.path)));
approval.sourceAcceptance={kind:'NORMAL_REVIEWED_SOURCE_PIN_INTEGRATION',sourceCommit:commit,kit,imageId:image.imageId,artifactReceiptSha256:digest(manifestBytes),reviewHashes:{...(approval.sourceAcceptance?.reviewHashes??{}),'memory-effort-joint-source-review.md':digest(reviewBytes)}};
await fs.writeFile(path.join(base,'procedure-approval.json'),JSON.stringify(approval,null,2)+'\n');
const {verifyProcedure}=await import(path.join(base,'qualification.mjs')),procedure=await verifyProcedure();
const {verifyArtifacts}=await import(path.join(base,'docker.mjs')),artifacts=await verifyArtifacts(kit);
const files=[];for(const name of Object.keys(originals))files.push({path:path.join(base,name),beforeSha256:digest(originals[name]),afterSha256:digest(await fs.readFile(path.join(base,name)))});
const receipt={status:'PACKAGING_COMPLETE',sourceCommit:commit,kit,counts:{isolatedBuilds:3,packs:4,imageBuilds:1},consumers,manifestSha256:digest(manifestBytes),backend:manifest.backend,image,artifacts,procedureDigest:procedure.digest,files,maximumPaidRequests:8,maximumUnknownLiabilityUnits:2700000,perRunHumanReview:false,priorImageExactCleanupRetained:oldImage,sourceOnlyReview:true,serviceCalls:0,inferenceCalls:0,nativeQualified:false,chatFullTypesAndBuild:'PENDING genuine native codegen; no Chat dev--once'};
await fs.writeFile(path.join(checks,'packaging-final-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,image:image.imageId,sourceCommit:commit,procedureDigest:procedure.digest,services:0}));
