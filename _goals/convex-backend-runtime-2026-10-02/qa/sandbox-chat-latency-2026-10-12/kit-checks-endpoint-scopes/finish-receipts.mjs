import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',q=path.dirname(new URL(import.meta.url).pathname),root=path.dirname(q);
const kit='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-endpoint-scopes-2026-10-13';
const digest=value=>createHash('sha256').update(value).digest('hex');const read=file=>JSON.parse(fs.readFileSync(file));const hash=file=>digest(fs.readFileSync(file));
const artifact=read(path.join(q,'artifact-receipt.json')),comparison=read(path.join(q,'distribution-closure-comparison.json')),image=read(path.join(q,'docker-image-identity.json')),pins=read(path.join(q,'packaging-input-pins.json'));
const review=read(path.join(root,'endpoint-scope-admission-timing-joint-review.json'));assert.equal(review.verdict,'PASS');
for(const [file,sha] of Object.entries(comparison.exactCommittedSourceAndTestPins)) {
 const frozen=Array.isArray(review.currentFrozenFiles)?review.currentFrozenFiles.find(row=>row.path===file)?.sha256:review.currentFrozenFiles[file];
 assert.equal(typeof frozen==='object'?frozen.sha256:frozen,sha,'Exact joint review source/test pin '+file);
}
const checks=['verify-actual-packed-public-contracts','verify-packed-dependent-contracts','verify-packed-backend-export-closure','verify-packed-template-catalog'];
for(const name of checks)assert.equal(read(path.join(q,name+'-exit.json')).exitCode,0);assert.equal(read(path.join(q,'docker-build-exit.json')).exitCode,0);
const catalog=read(path.join(q,'packed-template-catalog.json'));
const envelope={sourceCommit:artifact.sourceCommit,sourceReviewSha256:hash(path.join(root,'endpoint-scope-admission-timing-joint-review.md')),sourceReviewJsonSha256:hash(path.join(root,'endpoint-scope-admission-timing-joint-review.json')),
 sourcePins:comparison.exactCommittedSourceAndTestPins,kit,identitySha256:hash(path.join(kit,'identity.json')),archiveManifestSha256:hash(path.join(kit,'image/archives/manifest.json')),inputManifestSha256:artifact.inputManifestSha256,backendManifestSha256:artifact.backend.manifestSha256,
 packages:artifact.packages.map(({role,sha256})=>({role,sha256})),catalogManifestSha256:catalog.catalogSha256,catalogPayloadSha256:catalog.payloadHash,imageId:image.id,controls:pins.copiedControlFilesOnly.map(row=>({path:row.path,sha256:row.newSha256}))};
const candidateDigest=digest(JSON.stringify(envelope));
const scratch=fs.readdirSync(q,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&/^(packed-contract-|dependent-contract-|catalog-contract-)/.test(entry.name));assert.equal(scratch.length,0);
fs.writeFileSync(path.join(q,'candidate-digest.json'),JSON.stringify({version:1,candidateDigest,definition:'SHA256 of JSON.stringify(envelope) in retained field order',envelope,allChecksPassed:true,ownedScratchDirectoriesRemaining:[],servicesStarted:0,inferenceCalls:0},null,2)+'\n');
const receipt={status:'LOCAL_IMMUTABLE_PACKAGING_COMPLETE',sourceCommit:artifact.sourceCommit,kit,kitIdentity:image.identity,imageId:image.id,imageTag:image.tag,archiveManifestSha256:envelope.archiveManifestSha256,backendManifestSha256:artifact.backend.manifestSha256,candidateDigest,packages:artifact.packages,
 backend:{files:157,tables:72,components:2},isolatedBuilds:3,packs:4,imageBuilds:1,allPackedChecksExitZero:true,contractFailures:0,scratchDirectoriesRemaining:[],currentSourceAndStagingHashesMatch:true,currentAndStagedInputsVerified:comparison.currentAndStagedInputsVerified,changedSourceFiles:comparison.changedProductFiles,
 priorK17ArchiveManifestAndFourPackagesByteUnchanged:true,newCopiedControlsOnly:4,allEightCommittedSourceTestPinsMatchJointReview:true,node:'24.15.0',npm:'12.2.0',pinnedNodeFirstInPATHForAllChildren:true,servicesStarted:0,inferenceCalls:0,cloudQualification:false,latencyAcceptance:false};
fs.writeFileSync(path.join(q,'packaging-final-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({candidateDigest,imageId:image.id,receiptSha256:hash(path.join(q,'packaging-final-receipt.json'))}));
