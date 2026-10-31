/** Root's one authorized offline package/consumer/image run. Produces pins; does not integrate or launch. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {Q,R,P,KIT,CHECKS,PRIOR_COMMIT,FIXTURE_HASH,REGISTRY_HASH,BACKEND_FILES,BACKEND_TABLES,frozenSourcePins,validateSourceReview} from './memory-effort-canonical-package-builder.mjs';
assert.equal(process.version,'v24.15.0');assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_BUILD_GO,'1');
const [sourceFlag,commit,reviewFlag,reviewArgument,frozenFlag,frozenFile,snapshotFlag,sdkSnapshot]=process.argv.slice(2);
assert.equal(process.argv.slice(2).length,8);assert.equal(sourceFlag,'--source');assert.match(commit??'',/^[a-f0-9]{40}$/);assert.equal(reviewFlag,'--review');assert.equal(frozenFlag,'--frozen');assert.equal(snapshotFlag,'--sdk-snapshot');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),commit);assert(!fs.existsSync(KIT));assert(!fs.existsSync(CHECKS));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),hash=file=>sha(fs.readFileSync(file)),readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const frozenRepair=frozenSourcePins(commit,frozenFile),reviewPath=path.resolve(reviewArgument),review=readJson(reviewPath);
assert(reviewPath.startsWith(Q+path.sep));const reviewSha256=hash(reviewPath);
validateSourceReview(review,frozenRepair.files);
const launcherNames=['docker.mjs','runner.mjs','runtime.mjs','local.test.mjs','procedure-approval.json'];
const launcherHashes=()=>Object.fromEntries(launcherNames.map(name=>[name,hash(path.join(P,'sandbox-env',name))]));
const originalLauncher=launcherHashes(),approval=readJson(path.join(P,'sandbox-env/procedure-approval.json'));
assert.equal(approval.candidateSourceCommit,PRIOR_COMMIT);assert.equal(approval.maximumPaidRequests,8);assert.equal(approval.maximumUnknownLiabilityUnits,2700000);assert.equal(approval.perRunHumanReview,false);
const node=process.execPath,env={...process.env,PATH:'/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin:'+process.env.PATH,npm_config_userconfig:'/dev/null'};
// Fail before copying/packing if the required one image build cannot start.
const daemonVersion=execFileSync('docker',['info','--format','{{.ServerVersion}}'],{encoding:'utf8',env}).trim();assert.match(daemonVersion,/^\d+\.\d+\.\d+/);
const rows=[],runReceipt=path.join(Q,'memory-effort-canonical-package-run-exits.json');
async function run(name,args,executable=node){
 const log=path.join(Q,'memory-effort-canonical-package-'+name+'.log'),fd=fs.openSync(log,'wx'),start=performance.now();let result;
 try{result=await new Promise((resolve,reject)=>{const child=spawn(executable,args,{cwd:R,env,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',(exitCode,signal)=>resolve({exitCode,signal}));});}finally{fs.closeSync(fd);}
 const row={name,command:[executable,...args],cwd:R,node:process.versions.node,...result,elapsedMs:performance.now()-start,log,logSha256:hash(log),naturalExit:result.signal===null};rows.push(row);
 fs.writeFileSync(runReceipt,JSON.stringify({sourceCommit:commit,rows,serviceCalls:0,inferenceCalls:0,launcherChanged:false},null,2)+'\n');
 console.log(JSON.stringify({name,exitCode:result.exitCode,signal:result.signal,elapsedMs:row.elapsedMs}));assert.equal(result.exitCode,0,'Stop and preserve '+log);assert.equal(result.signal,null);
}
try{
 await run('write-controls',[path.join(Q,'memory-effort-canonical-package-builder.mjs'),'--write-controls',commit,sdkSnapshot,frozenFile]);
 await run('sdk-pack-and-reuse',[path.join(KIT,'prepare.mjs')]);
 const artifact=readJson(path.join(CHECKS,'artifact-receipt.json')),preparation=readJson(path.join(CHECKS,'preparation.json'));
 assert.equal(artifact.sourceCommit,commit);assert.deepEqual(artifact.counts,{builds:0,packs:1,reusedArchives:3});assert.equal(artifact.node,'24.15.0');assert.equal(artifact.npm,'12.2.0');
 const manifest=readJson(path.join(KIT,'staging',commit,'dist/backend/v1/manifest.json'));assert.equal(manifest.files.length,BACKEND_FILES);assert.equal(manifest.tables.length,BACKEND_TABLES);assert.deepEqual(manifest.components,['agent','workflow']);
 assert.equal(hash(path.join(KIT,'fixtures/memoryEffortQualification.ts')),FIXTURE_HASH);
 await run('host-cli-import',[path.join(Q,'memory-effort-canonical-package-host-cli.mjs'),commit]);
 const hostCliImport=readJson(path.join(CHECKS,'host-cli-import.json'));assert.equal(hostCliImport.files.length,5);assert.equal(hostCliImport.dynamicImport.fetchCalls,0);
 await run('packed-consumers',[path.join(CHECKS,'run-consumers.mjs'),'v1']);
 const closure=readJson(path.join(CHECKS,'packed-backend-export-closure.json'));assert.equal(closure.sourceCommit,commit);assert.equal(closure.directReadsRegisteredInternal,true);
 const consumerReceipts=['verify-actual-packed-public-contracts','verify-packed-dependent-contracts','verify-packed-backend-export-closure','verify-packed-template-catalog'].map(name=>{const receipt=path.join(CHECKS,name+'-exit-v1.json'),log=path.join(CHECKS,name+'-v1.log'),row=readJson(receipt);assert.equal(row.exitCode,0);assert.equal(row.signal,null);return{name,version:'v1',receipt,sha256:hash(receipt),log,logSha256:hash(log)};});
 await run('docker-image',[path.join(CHECKS,'build-image.mjs')]);
 const image=readJson(path.join(CHECKS,'docker-image-identity.json')),manifestFile=path.join(KIT,'image/archives/manifest.json');
 assert.equal(image.labels['dev.cortex.manual-sandbox.source'],commit);assert.equal(image.labels['dev.cortex.manual-sandbox.path'],KIT);assert.equal(image.liveRunStarted,false);
 await run('image-files',[path.join(Q,'memory-effort-canonical-package-image-contents.py'),image.imageId,manifestFile],'python3');
 const imageFiles=readJson(path.join(Q,'memory-effort-canonical-package-image-files.log'));assert.equal(imageFiles.status,'ACTUAL_IMAGE_FILES_VERIFIED');assert.equal(imageFiles.archiveManifestSha256,hash(manifestFile));
 fs.writeFileSync(path.join(CHECKS,'docker-image-actual-files.json'),JSON.stringify(imageFiles,null,2)+'\n',{flag:'wx'});
 assert.deepEqual(frozenSourcePins(commit,frozenFile),frozenRepair,'Combined frozen manifest changed during packaging');assert.equal(hash(reviewPath),reviewSha256,'Independent review changed during packaging');assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),commit);assert.deepEqual(launcherHashes(),originalLauncher);for(const row of preparation.strictStartupPins)assert.equal(hash(row.file),row.sha256);
 const counts={rootSdkBuilds:1,isolatedBuilds:0,packs:1,reusedArchives:3,packedConsumers:4,consumerReruns:0,imageBuilds:1,imageBuildCommandAttempts:1,serviceCalls:0,inferenceCalls:0,runtimeContainersCreated:0,runtimeContainersStarted:0};
 const receipt={status:'PACKAGING_PASS_ROOT_INTEGRATION_PENDING',sourceCommit:commit,priorCommit:PRIOR_COMMIT,sourceReview:{path:reviewPath,sha256:hash(reviewPath),verdict:'PASS',sourceHashes:frozenRepair.files.length},frozenRepair,kit:KIT,checks:CHECKS,packages:artifact.packages,backend:{...artifact.backend,tables:manifest.tables.length,components:manifest.components,directReadsInternal:true},image,imageFiles,hostCliImport,consumerReceipts,counts,rows,launcherBefore:originalLauncher,launcherAfter:launcherHashes(),launcherChanged:false,sourceSelectionDigest:preparation.sourceSelectionDigest,artifactManifestSha256:hash(manifestFile),backendManifestSha256:artifact.backend.manifestSha256,runtimeCapabilities:preparation.runtimeCapabilities,registryExpectedSourcePin:REGISTRY_HASH,registryObservedNative:false,fixtureSha256:FIXTURE_HASH,strictStartupPins:preparation.strictStartupPins,strictProcedure:preparation.strictProcedure,maximumPaidRequests:8,maximumUnknownLiabilityUnits:2700000,integration:'PENDING_ROOT',nativeQualification:'NOT_RUN'};
 const current={sourceCommit:PRIOR_COMMIT,kit:path.join(P,'manual-sandbox-memory-effort-singleton-2026-10-15'),imageId:approval.sourceAcceptance.imageId,artifactManifestSha256:approval.sourceAcceptance.artifactReceiptSha256,launcherHashes:originalLauncher,procedureReviewSha256:approval.reviewSha256};
 const proposal={status:'ROOT_OWNS_STRAIGHTFORWARD_PIN_INTEGRATION',current,next:{sourceCommit:commit,kit:KIT,imageId:image.imageId,imageTag:image.tag,artifactManifest:manifestFile,artifactManifestSha256:hash(manifestFile),backendManifestSha256:artifact.backend.manifestSha256,sourceSelectionDigest:preparation.sourceSelectionDigest,packages:artifact.packages.map(({role,filename,sha256})=>({role,filename,sha256})),sourceReview:{path:reviewPath,sha256:hash(reviewPath)},hostCliImport:path.join(CHECKS,'host-cli-import.json')},retained:{runtimeSha256:originalLauncher['runtime.mjs'],strictProcedureReviewSha256:approval.reviewSha256,maximumPaidRequests:8,maximumUnknownLiabilityUnits:2700000},packagerReceipt:path.join(CHECKS,'packaging-final-receipt.json'),consumerReceipts,imageActualFiles:path.join(CHECKS,'docker-image-actual-files.json'),counts,launcherChanged:false};
 for(const [file,value]of [[path.join(Q,'memory-effort-canonical-package-integration-proposal.json'),proposal],[path.join(CHECKS,'packaging-final-receipt.json'),receipt],[path.join(Q,'memory-effort-canonical-package-report.json'),receipt]])fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:receipt.status,sourceCommit:commit,imageId:image.imageId,artifactManifestSha256:receipt.artifactManifestSha256,backendManifestSha256:receipt.backendManifestSha256,counts,launcherChanged:false}));
}catch(error){
 const failure={status:'PACKAGING_FAILED_STOPPED',sourceCommit:commit,errorName:error?.name??'Error',errorMessage:String(error?.message??error),rows,launcherChanged:JSON.stringify(launcherHashes())!==JSON.stringify(originalLauncher),serviceCalls:0,inferenceCalls:0};
 fs.writeFileSync(path.join(Q,'memory-effort-canonical-package-failure.json'),JSON.stringify(failure,null,2)+'\n',{flag:'wx'});console.error(JSON.stringify({status:failure.status,error:failure.errorMessage}));process.exitCode=1;
}
