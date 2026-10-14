import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const source = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const qa = path.dirname(new URL(import.meta.url).pathname), baseQa = path.dirname(qa);
const kit = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-turn-consolidation-2026-10-13';
const commit = '2c8689fac3aca2acf1fb1f46d8b10a87388e95cd';
const priorCommit = '8917f3250fc50aa7f30f5cd727aaf279709a2ef2';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => digest(fs.readFileSync(file));
const read = file => JSON.parse(fs.readFileSync(file));
const artifact = read(path.join(qa, 'artifact-receipt.json')), preflight = read(path.join(qa, 'build-preflight.json'));
assert.equal(artifact.sourceCommit, commit); assert.equal(artifact.node, '24.15.0'); assert.equal(artifact.npm, '12.2.0');
assert.equal(artifact.buildInputs, preflight.selectedTrackedInputs); assert.equal(artifact.backend.files, 157);
const stage = path.join(kit, 'staging', commit), artifacts = path.join(kit, 'artifacts', commit);
assert.equal(sha(path.join(artifacts, 'manifest.json')), sha(path.join(kit, 'image/archives/manifest.json')));
const inputs = read(path.join(artifacts, 'build-inputs.json')); assert.equal(inputs.length, preflight.selectedTrackedInputs);
assert.equal(digest(JSON.stringify(inputs)), artifact.inputManifestSha256);
for (const input of inputs) {
  assert.equal(sha(path.join(source, input.path)), input.sha256, `Current input changed: ${input.path}`);
  assert.equal(sha(path.join(stage, input.path)), input.sha256, `Staged input changed: ${input.path}`);
}
const manifest = read(path.join(stage, 'dist/backend/v1/manifest.json'));
assert.equal(sha(path.join(stage, 'dist/backend/v1/manifest.json')), artifact.backend.manifestSha256);
for (const file of manifest.files) {
  assert.equal(sha(path.join(source, file.sourcePath)), file.sourceSha256);
  assert.equal(sha(path.join(stage, file.sourcePath)), file.sourceSha256);
  assert.equal(sha(path.join(stage, 'dist/backend/v1', file.path)), file.sha256);
}
const baseline = read(path.join(qa, 'controls-prepared.json'));
const oldManifest = read(path.join(baseline.oldKit, 'staging', priorCommit, 'dist/backend/v1/manifest.json'));
assert.deepEqual(manifest.files.map(file => file.path).sort(), oldManifest.files.map(file => file.path).sort());
const oldFiles = new Map(oldManifest.files.map(file => [file.path, file]));
const changes = manifest.files.filter(file => file.sourceSha256 !== oldFiles.get(file.path).sourceSha256).map(file => ({ sourcePath: file.sourcePath, sourceSha256: file.sourceSha256, outputPath: file.path, outputSha256: file.sha256 })).sort((a,b) => a.sourcePath.localeCompare(b.sourcePath));
assert.deepEqual(changes.map(file => file.sourcePath), ['convex-dev/runtimeAgent.ts']);
const expected = {'convex-dev/runtimeAgent.ts':'2e556248236cd2cd70a162d5479f505530e44bd07931c1af0a5b99f2e2d9161f'};
for (const change of changes) assert.equal(change.sourceSha256, expected[change.sourcePath]);
const controls = baseline.controls.map(file => {
  assert.equal(sha(path.join(kit, file.path)), file.newSha256); assert.equal(sha(path.join(baseline.oldKit, file.path)), file.oldSha256);
  return { path: file.path, oldSha256: file.oldSha256, newSha256: file.newSha256, change: file.change };
});
for (const file of preflight.priorArchives) assert.equal(sha(file.path), file.sha256);
const archives = artifact.packages.map(file => {
  const archive = path.join(kit, 'image/archives', file.filename);
  assert.equal(sha(archive), file.sha256); assert.equal(sha(path.join(artifacts, file.filename)), file.sha256);
  return { role: file.role, path: archive, sha256: file.sha256, matchesReceipt: true };
});
const versions = {};
for (const relative of ['packages/cortex-templates/payloads/basic/1.4.1/package.json', 'packages/cortex-templates/payloads/vercel-ai-quickstart/1.4.1/package.json']) {
  const version = read(path.join(stage, relative)).version; assert.equal(version, '1.4.1'); versions[relative] = version;
}
const identity = read(path.join(kit, 'identity.json')), image = read(path.join(qa, 'docker-image-identity.json'));
assert.deepEqual(image.kitIdentity, identity); assert.equal(image.labels['dev.cortex.manual-sandbox.source'], commit); assert.equal(image.labels['dev.cortex.manual-sandbox.path'], kit);
assert.equal(image.os, 'linux'); assert.equal(image.architecture, 'arm64'); assert.equal(image.user, 'sandbox');
assert.equal(fs.statSync(path.join(kit, 'identity.json')).mode & 0o777, 0o600);
const scratch = fs.readdirSync(qa).filter(name => name.startsWith('packed-contract-') || name.startsWith('dependent-contract-') || name.startsWith('catalog-contract-')); assert.deepEqual(scratch, []);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {cwd:source,encoding:'utf8'}).trim(), commit);
assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'src', 'convex-dev', 'tests', 'packages', '.github', 'package.json', 'package-lock.json', 'README.md', 'LICENSE.md', 'tsconfig.json', 'scripts/backend/build-distribution.mjs'], {cwd:source,encoding:'utf8'}).trim(), '');
const closure = { observedAt: new Date().toISOString(), sourceCommit: commit, baselineSourceCommit: priorCommit, sourceInputCount: inputs.length,
  allCurrentAndStagedInputHashesMatch: true, backendFileCount: manifest.files.length, allBackendSourceAndOutputHashesMatch: true, actualPackedChangedBackendExportsPreserved: true,
  unchangedBackendPathClosure: true, actualChangedBackendSources: changes, oldFourControlsAndFourArchivesUnchanged: true,
  newControlsUnchanged: true, headUnchanged: true, scratchConsumersRemaining: scratch, app141Versions: versions };
fs.writeFileSync(path.join(qa, 'distribution-closure-comparison.json'), JSON.stringify(closure, null, 2) + '\n');
const checks = [
  {name:'committed source/controls/toolchain preflight',exitCode:0,receipt:'build-preflight.json'},
  {name:'three isolated package builds and four packs (prepack disabled)',exitCode:0,receipt:'prepare-v1.log',receipts:['build-sdk.log','build-cli.log','build-provider.log','pack-sdk.json','pack-cli.json','pack-provider.json','pack-catalog.json']},
  {name:'actual SDK root/runtime/graph ESM+CJS/dts/backend/browser contracts',exitCode:0,receipt:'packed-public-contracts-v1.log'},
  {name:'actual provider core/react/remote ESM+CJS/dts/browser + CLI Commander15 help/version',exitCode:0,receipt:'packed-dependent-contracts-v1.log'},
  {name:'Linux arm64 immutable image build and installed candidate version/hash verification',exitCode:0,receipt:'docker-build-exit.json'},
  {name:'actual fresh packed eight backend export roots / V1-V5 and all new native parents/turn action / authority factory',exitCode:0,receipt:'packed-backend-export-closure.json'},
  {name:'actual packed catalog full1.4.1 payload/QA dev pins/two UI owners',exitCode:0,receipt:'packed-template-catalog.json'},
  {name:'exact image inspection',exitCode:0,receipt:'docker-image-identity.json'},
  {name:'final input/backend/path closure/one distribution-source change/controls/old archives/HEAD/scratch consistency',exitCode:0,receipt:'distribution-closure-comparison.json'},
];
for (const name of ['prepare-exit.json','packed-public-contracts-exit.json','packed-dependent-contracts-exit.json','image-check-exit.json','packed-backend-export-closure-exit.json','packed-template-catalog-exit.json']) assert.equal(read(path.join(qa,name)).exitCode, 0);
assert.equal(read(path.join(qa,'packed-backend-export-closure.json')).rawAuthorityFactoryExportPresent, true);
assert.equal(read(path.join(qa,'packed-backend-export-closure.json')).actualV5ParentAndTurnExportsPresent, true);
assert.equal(read(path.join(qa,'packed-template-catalog.json')).allSelectedPayloadBytesMatchCatalog, true);
assert.equal(read(path.join(qa,'docker-build-exit.json')).exitCode, 0);
const logs = fs.readdirSync(qa).filter(name => name.endsWith('.log') || name.endsWith('.json') || name.endsWith('.mjs')).map(name => {
  const file = path.join(qa, name); return {path:name,bytes:fs.statSync(file).size,sha256:sha(file)};
});
const receipt = { version:1,status:'LOCAL_IMMUTABLE_PACKAGING_COMPLETE',packagingMilestonePercent:100,createdAt:new Date().toISOString(),
  sourceRoot:source,sourceCommit:commit,sourceReviewPath:'v5-structural-source-review.md',sourceReviewSha256:preflight.sourceReviewSha256,
  kit,kitIdentity:identity,imageId:image.imageId,imageTag:image.tag,imagePlatform:'linux/arm64',imageUser:image.user,imageSizeBytes:image.size,
  node:artifact.node,npm:artifact.npm,inputCount:inputs.length,inputManifestSha256:artifact.inputManifestSha256,backend:artifact.backend,
  actualChangedBackendSourcePaths:changes.map(file=>file.sourcePath),packages:artifact.packages,archives,app141Versions:versions,controls,checks,logs,actualPackedTemplateCatalog:read(path.join(qa,'packed-template-catalog.json')),
  preservedFailures:[],buildFailures:0,packFailures:0,contractFailures:0,headUnchangedAfterChecks:true,copiedArchivesOrStagingFromOldKit:0,
  ownedFreshArtifactCopiesToImage:4,createdIdentityCount:1,scratchConsumerDirectoriesRemaining:scratch,runtimeContainersStarted:0,
  liveQualification:false,paidCalls:0,serviceCalls:0,servicesCreated:0,sourceOrLauncherWrites:false,pinsOrProcedureWrites:false,gitOrGitHubWrites:false,
  cleanup:'Both owned packed-consumer scratch directories removed in finally and absence verified. New kit/image/staging/artifacts/cache intentionally retained; no runtime container or cloud target created.',
  coverageLimits:['Browser VM checks use blocked network ports and absent Node globals; no actual UI/service qualification.', 'No hosted latency/OCC/SLO success. Earlier service and authentication expected-code failures remain unchanged.', 'Scoped retained previous controls/four archive hashes verified; no historical custody/source-recovery assertion.'] };
fs.writeFileSync(path.join(qa, 'packaging-final-receipt.json'), JSON.stringify(receipt,null,2)+'\n');
const report = `# V5 ordinary-turn immutable packaging

Packaging milestone: 100% complete. Repository SaintNick1214/Project-Cortex; visibility unverified. Independent accepted source ${commit}; review SHA-256 ${preflight.sourceReviewSha256}. Fresh kit ${kit}.

Three isolated SDK/CLI/provider builds and four fresh packs passed with Node ${artifact.node}/npm ${artifact.npm}; npm pack used --ignore-scripts with no duplicate prepack builds. Versions: SDK/CLI/provider0.39.0, catalog1.3.1 and Basic/Vercel1.4.1. All ${inputs.length} selected inputs matched committed Git blobs before the build and current/staged hashes afterwards. All ${manifest.files.length} backend source/output hashes and unchanged path closure passed. Actual changed distribution source since ${priorCommit}: ${changes.map(file=>file.sourcePath).join(', ')}; its exact frozen reviewed hash matches.

Actual archive ESM/CJS/declarations/browserVM checks passed for SDK root/runtime/graph and provider core/react/remote, with network blocked and Node globals absent in browser checks. Actual packed CLI version/help passed using its declared Commander15 installation. Eight backend export roots match committed exports, including executeTurnV5, prepareTurnModel, prepareResolvedModelOperation, admitPreparedModelOperation, turnStepV5/handler, historical V1–V4/callbacks and retained authority/policy helpers. Catalog verifies all74 selected Vercel payload records, aggregate hash, QA development pins and two observer owners. Host dependency fixture selection is disclosed; this is not a fresh scaffold dependency install or actual browser/service qualification. Docker build performed normal dependency installation for all four actual archives and verified installed versions/hash manifest.

Fresh UUID ${identity.id}, owner UID/GID ${identity.ownerUid}/${identity.ownerGid}. Image ${image.imageId}, tag ${image.tag}, Linux arm64 User sandbox; source/UUID/path labels, entrypoint and workdir matched. Backend manifest SHA-256 ${artifact.backend.manifestSha256}; input manifest SHA-256 ${artifact.inputManifestSha256}.

Archive digests:

${artifact.packages.map(file=>`- ${file.role}: ${file.sha256} (${file.bytes} bytes, ${file.files} files)`).join('\n')}

No preparation, build, pack, package-contract or image failures occurred in this generation. Previous failures remain in their original receipts and are not copied or relabeled. Prior kit controls/four archives remained hash-identical. Only four controls and selected small check helpers were reused; no previous archive, staging, evidence or dependency tree was copied. One fresh UUID generated with0600 identity. All owned extracted consumer scratch directories are absent; new kit/image/build artifacts are intentionally retained.

No runtime container/ports, hosted service, deployment, qualification or inference was started; no credentials were read. No source, launcher/pins/procedure, Git/GitHub, website or Union Arena writes occurred. This routine packaging result does not change the source verdict or qualify native latency/OCC/provider behavior. All K14 subsecond failures remain unchanged. Root owns launcher integration, fresh disposable target/eight bounded qualifications and actual UI/CLI measurement.

Receipts: kit-checks-turn-consolidation/packaging-final-receipt.json and raw build/pack/contract/image logs.
`;
fs.writeFileSync(path.join(baseQa,'turn-consolidation-packaging-report.md'),report);
fs.writeFileSync(path.join(baseQa,'turn-consolidation-packaging-report.json'),JSON.stringify({status:receipt.status,packagingMilestonePercent:100,sourceCommit:commit,kit,kitIdentity:identity,imageId:image.imageId,backend:artifact.backend,inputManifestSha256:artifact.inputManifestSha256,packages:artifact.packages,actualChangedBackendSources:changes,sourceReviewSha256:preflight.sourceReviewSha256,finiteFailures:receipt.preservedFailures,liveQualification:false,serviceCalls:0,paidCalls:0,remainingBlockers:[],nextGate:'Root-owned launcher integration and fresh disposable target/eight bounded qualifications and actual UI/CLI latency measurement'},null,2)+'\n');
console.log(JSON.stringify({sourceCommit:commit,imageId:image.imageId,kitIdentity:identity,backendManifestSha256:artifact.backend.manifestSha256,inputManifestSha256:artifact.inputManifestSha256,
  packages:artifact.packages,actualChangedBackendSourcePaths:receipt.actualChangedBackendSourcePaths,
  reportSha256:sha(path.join(baseQa,'turn-consolidation-packaging-report.md')),finalReceiptSha256:sha(path.join(qa,'packaging-final-receipt.json')),inputCount:inputs.length,backendFiles:manifest.files.length,allChecksPassed:true}));
