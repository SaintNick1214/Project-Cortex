import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const Q=path.dirname(new URL(import.meta.url).pathname);
const R='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const K='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-bounded-repair-2026-10-14';
const source='3e55e7b9b45093f547699619c572fdbe09c1efde';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=file=>fs.readFileSync(file), json=file=>JSON.parse(bytes(file));
const artifact=json(path.join(Q,'artifact-receipt.json'));
assert.equal(artifact.sourceCommit,source);assert.equal(artifact.node,'24.15.0');assert.equal(artifact.npm,'12.2.0');
const stage=path.join(K,'staging',source),manifest=json(path.join(stage,'dist/backend/v1/manifest.json'));
assert.equal(manifest.files.length,169);assert.equal(manifest.tables.length,77);assert.deepEqual(manifest.components,['agent','workflow']);
for(const file of manifest.files){assert.equal(digest(bytes(path.join(R,file.sourcePath))),file.sourceSha256);assert.equal(digest(bytes(path.join(stage,file.sourcePath))),file.sourceSha256);assert.equal(digest(bytes(path.join(stage,'dist/backend/v1',file.path))),file.sha256);}
const inputs=json(path.join(K,'artifacts',source,'build-inputs.json'));
const paths=['src','convex-dev','package.json','package-lock.json','README.md','LICENSE.md','tsconfig.json','scripts/backend/build-distribution.mjs','packages/cortex-cli/src','packages/cortex-cli/scripts','packages/cortex-cli/package.json','packages/cortex-cli/README.md','packages/cortex-cli/tsconfig.json','packages/vercel-ai-provider/src','packages/vercel-ai-provider/react','packages/vercel-ai-provider/package.json','packages/vercel-ai-provider/README.md','packages/vercel-ai-provider/LICENSE.md','packages/vercel-ai-provider/tsconfig.json','packages/cortex-templates/package.json','packages/cortex-templates/catalog.json','packages/cortex-templates/payloads','packages/cortex-templates/README.md'];
const tree=new Map(execFileSync('git',['ls-tree','-r','-z',source,'--',...paths],{cwd:R,maxBuffer:20*1024*1024}).toString().split('\0').filter(Boolean).map(line=>{const [entry,file]=line.split('\t');return [file,entry.split(' ')[2]];}));
for(const input of inputs){const content=bytes(path.join(stage,input.path));assert.equal(digest(content),input.sha256);assert.equal(createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex'),tree.get(input.path),`Committed input mismatch: ${input.path}`);}
assert.equal(digest(JSON.stringify(inputs)),artifact.inputManifestSha256);
const image=json(path.join(Q,'docker-image-identity.json')), identity=json(path.join(K,'identity.json'));
assert.equal(image.os,'linux');assert.equal(image.architecture,'arm64');assert.equal(image.user,'sandbox');
assert.equal(image.labels['dev.cortex.manual-sandbox'],identity.id);assert.equal(image.labels['dev.cortex.manual-sandbox.path'],K);assert.equal(image.labels['dev.cortex.manual-sandbox.source'],source);
assert.equal(image.imageId,bytes(path.join(Q,'docker-image-id.txt')).toString().trim());
assert.equal(identity.ownerUid,process.getuid());assert.equal(identity.ownerGid,process.getgid());
assert.equal(fs.statSync(path.join(K,'identity.json')).mode&0o777,0o600);
fs.writeFileSync(path.join(K,'image-id.txt'),image.imageId+'\n',{flag:'wx',mode:0o600});
const archiveManifest=path.join(K,'image/archives/manifest.json');
assert.deepEqual(json(archiveManifest),artifact);
for(const item of artifact.packages)assert.equal(digest(bytes(path.join(K,'image/archives',item.filename))),item.sha256);
const checks=['verify-actual-packed-public-contracts','verify-packed-dependent-contracts','verify-packed-backend-export-closure'].map(name=>({name,...json(path.join(Q,name+'-exit-v1.json')),logSha256:digest(bytes(path.join(Q,name+'-v1.log')))}));
for(const check of checks)assert.equal(check.exitCode,0);
assert.equal(Number(bytes(path.join(Q,'verify-packed-template-catalog-v2.exit'))),0);
checks.push({name:'verify-packed-template-catalog',version:'v2',exitCode:0,logSha256:digest(bytes(path.join(Q,'verify-packed-template-catalog-v2.log')))});
const leftoverScratch=fs.readdirSync(Q).filter(name=>/^(packed-contract-|dependent-contract-|catalog-contract-)/.test(name));assert.deepEqual(leftoverScratch,[]);
const catalog=json(path.join(Q,'packed-template-catalog.json'));assert.equal(catalog.historicalImmutableTuplesPreserved,13);assert.equal(catalog.k21ImmutableDescriptorsByteExact,14);assert.equal(catalog.selectedPayloadFiles,74);
const candidate={sourceCommit:source,backendManifestSha256:artifact.backend.manifestSha256,artifactManifestSha256:digest(bytes(archiveManifest)),packages:artifact.packages,imageId:image.imageId};
const helpers=['prepare.mjs','image/Dockerfile','image/install-candidates.mjs','image/entrypoint.mjs'].map(file=>({path:path.join(K,file),sha256:digest(bytes(path.join(K,file)))}));
const qaHelpers=['run-consumers.mjs','build-image.mjs','verify-actual-packed-public-contracts.mjs','verify-packed-dependent-contracts.mjs','verify-packed-backend-export-closure.mjs','verify-packed-template-catalog.mjs'].map(file=>({path:path.join(Q,file),sha256:digest(bytes(path.join(Q,file)))}));
const receipt={version:1,status:'LOCAL_PACKAGING_COMPLETE',sourceCommit:source,kit:K,id:image.imageId,identity,readyImage:image,
  backend:{...artifact.backend,tables:manifest.tables.length,components:manifest.components,all169SourceOutputHashesReverified:true},
  packages:artifact.packages,artifactManifestSha256:candidate.artifactManifestSha256,candidateCompositeSha256:digest(JSON.stringify(candidate)),
  committedBuildInputs:{count:inputs.length,inputManifestSha256:artifact.inputManifestSha256,allStagedInputHashesMatchCommittedGitBlobs:true},
  checks,counts:{isolatedBuilds:3,tarballPacks:4,consumerGroups:4,dockerBuilds:1,runtimeContainersStarted:0,serviceCalls:0,inferenceCalls:0},
  catalog:{version:'1.3.2',basic:'1.4.1',vercel:'1.4.2',historicalDescriptors:13,currentDescriptorsByteExactToK21:14,selectedVercelFiles:74},
  ownedConsumerScratchRemoved:true,leftoverScratch,controls:helpers,qaHelpers,
  preservedFailure:{path:path.join(Q,'verify-packed-template-catalog-v1.log'),logSha256:digest(bytes(path.join(Q,'verify-packed-template-catalog-v1.log'))),exitCode:json(path.join(Q,'verify-packed-template-catalog-exit-v1.json')).exitCode,
    classification:'QA count assertion: K21 has14 current descriptors, consisting of13 historical plus Vercel1.4.2. Byte equality had already passed. Only failed catalog helper rerun; builds/packs/passing consumers unchanged.'},
  noNativeQualificationOrLatencyClaim:true};
fs.writeFileSync(path.join(Q,'packaging-final-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,imageId:image.imageId,artifactManifestSha256:receipt.artifactManifestSha256,backendManifestSha256:artifact.backend.manifestSha256,
  candidateCompositeSha256:receipt.candidateCompositeSha256,receiptSha256:digest(bytes(path.join(Q,'packaging-final-receipt.json'))),committedInputs:inputs.length,files:169,tables:77,components:2,scratchRemoved:true}));
