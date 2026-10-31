#!/usr/bin/env node
/** Preparation only. An explicit accepted commit plus the existing independent
 * source PASS is required. This never builds, packs, invokes Docker or services. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const R = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const Q = path.join(R, '_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12');
const P = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const oldName = 'manual-sandbox-prompt-trust-2026-10-14', newName = 'manual-sandbox-delivery-plan-2026-10-14';
const oldKit = path.join(P, oldName), kit = path.join(P, newName);
const oldQa = path.join(Q, 'kit-checks-prompt-trust'), qa = path.join(Q, 'kit-checks-delivery-plan');
const oldCommit = '6ce044425b7e52270cdf89cde0ea3a8fbb42f91a';
const pinnedBin = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin';
const expected = {
  "oldFiles": {
    "prepare.mjs": "2c6bcf290444a902719e6ef44183be245bf9edf0f25a369f6f8ccf3eadaf0f56",
    "image/Dockerfile": "7d27b7bb862e1b4790f7e6f870f88b257e11cefa7317c7ec1e026f09d0d54fb4",
    "image/install-candidates.mjs": "11dd609b6c36e7a870f805be5756b8d41c58b9c5a3414db92e85514ca423da49",
    "image/entrypoint.mjs": "45174896556ddb6635b67c576178d38f5b801bf9e823d9ad7d8606ff32a13a84",
    "image/archives/cortexmemory-sdk-0.39.0.tgz": "e937b1b0860b03e47876bcf573cfb5e69d833895629de30c39e2ff8b4afca028",
    "image/archives/cortexmemory-cli-0.39.0.tgz": "2fef802c7662cf4e32df3d146505a02cee3614a966655a71ae3ee9627a9d72e5",
    "image/archives/cortexmemory-vercel-ai-provider-0.39.0.tgz": "8580c09b900454a505e408512d367c3b048eb2ede68bb43797019a0225d74f53",
    "image/archives/cortexmemory-templates-1.3.3.tgz": "dc5fb8c7066797bbd8a6a1caf2f2b542c5595a8bc797f47efd21691dc5ba59be",
    "artifacts/6ce044425b7e52270cdf89cde0ea3a8fbb42f91a/cortexmemory-sdk-0.39.0.tgz": "e937b1b0860b03e47876bcf573cfb5e69d833895629de30c39e2ff8b4afca028",
    "artifacts/6ce044425b7e52270cdf89cde0ea3a8fbb42f91a/cortexmemory-cli-0.39.0.tgz": "2fef802c7662cf4e32df3d146505a02cee3614a966655a71ae3ee9627a9d72e5",
    "artifacts/6ce044425b7e52270cdf89cde0ea3a8fbb42f91a/cortexmemory-vercel-ai-provider-0.39.0.tgz": "8580c09b900454a505e408512d367c3b048eb2ede68bb43797019a0225d74f53",
    "artifacts/6ce044425b7e52270cdf89cde0ea3a8fbb42f91a/cortexmemory-templates-1.3.3.tgz": "dc5fb8c7066797bbd8a6a1caf2f2b542c5595a8bc797f47efd21691dc5ba59be",
    "image/archives/manifest.json": "fdbd5504691241461e00993b7d4939cd8c975d8c46e16a38e5f153942cde3e71",
    "artifacts/6ce044425b7e52270cdf89cde0ea3a8fbb42f91a/manifest.json": "fdbd5504691241461e00993b7d4939cd8c975d8c46e16a38e5f153942cde3e71",
    "artifacts/6ce044425b7e52270cdf89cde0ea3a8fbb42f91a/build-inputs.json": "e840baf6ceb9acc6516409632dbf22dc1047f67aaa2c53377a967ca8f1acf2ec"
  },
  "oldHelpers": {
    "verify-actual-packed-public-contracts.mjs": "9d1a8c543c94260f9b327d6e521c4fa2d6010e246390bc4342a62507fd0274b9",
    "verify-packed-dependent-contracts.mjs": "b5ee996764ff0838e2a3b8fe59f3a5fb3a7b2a1659764bd3c21b0c0ce508b933",
    "verify-packed-backend-export-closure.mjs": "080fb3be7eaa1037b6cda10d0e37b36cbda2a9eabc2d210c440f4758226a5de8",
    "verify-packed-template-catalog.mjs": "e4e06186b696ae156271350dd5550624ae8e2122164c0d7bc71c43f80f933c90",
    "run-consumers.mjs": "ba59ba83f012ea42b85842cc51752d2836f6dddd40d0bf9f59e1cb9c385c44b4",
    "build-image.mjs": "40b5feaef9a7baf8bdc29d21850414738c35734d810b65cb33c555b1b7b927c5"
  }
};
const controls = ['prepare.mjs', 'image/Dockerfile', 'image/install-candidates.mjs', 'image/entrypoint.mjs'];
const helpers = ['verify-actual-packed-public-contracts', 'verify-packed-dependent-contracts', 'verify-packed-backend-export-closure', 'verify-packed-template-catalog', 'run-consumers', 'build-image'];
const newEndpoints = {
  'runtimeAgent:attachModelResultV8': 'internalMutation',
  'runtimeModelPolicy:checkpointRecall': 'internalMutation',
  'runtimeMemoryQuery:prepareReads': 'internalQuery',
  'runtimeMemoryQuery:readMatches': 'internalQuery',
  'runtimeMemoryQuery:finalRecallDelivery': 'internalMutation',
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => { assert(fs.lstatSync(file).isFile(), `Expected regular file: ${file}`); return fs.readFileSync(file); };
const json = file => JSON.parse(read(file));
const commit = process.argv[2];
assert.equal(process.argv.length, 3, 'Usage: pinned-node k28-prepare-fresh-kit.mjs ROOT_ACCEPTED_40_HEX_COMMIT');
assert.match(commit, /^[a-f0-9]{40}$/, 'Root accepted commit is required, never a pending literal');
assert.equal(process.versions.node, '24.15.0');
const env = { ...process.env, PATH: `${pinnedBin}:${process.env.PATH ?? ''}`, npm_config_userconfig: '/dev/null' };
assert.equal(execFileSync('npm', ['--version'], { env, encoding: 'utf8' }).trim(), '12.2.0');
const git = args => execFileSync('git', args, { cwd: R, env, maxBuffer: 20 * 1024 * 1024 });
assert.equal(git(['rev-parse', 'HEAD']).toString().trim(), commit, 'HEAD must be exactly the accepted committed source');
const reviewPath = path.join(Q, 'k28-independent-review.json'), review = json(reviewPath);
assert.equal(review.verdict, 'PASS', 'Existing independent source review must PASS');
assert.equal(review.sourceOnly, true); assert.deepEqual(review.breakingFindings, []);
assert.equal(review.verifiedInputs.hashesMatchBeforeAndAtFinalization, true);
assert.equal(review.verifiedInputs.packet, 'k28-review-packet-v1.json');
const packetPath = path.join(Q, review.verifiedInputs.packet), packet = json(packetPath);
assert.equal(digest(read(packetPath)), review.verifiedInputs.packetSha256, 'Review must bind the actual packet');
assert.deepEqual(review.verifiedInputs.hashes.core, packet.hashes.core);
assert(Object.keys(packet.hashes.core).length > 0);
function verifySource() {
  assert.equal(git(['rev-parse', 'HEAD']).toString().trim(), commit);
  for (const [relative, hash] of Object.entries(packet.hashes.core)) {
    assert(!path.isAbsolute(relative) && !relative.split('/').includes('..'));
    assert.equal(digest(read(path.join(R, relative))), hash, `Reviewed working source changed: ${relative}`);
    assert.equal(digest(git(['show', `${commit}:${relative}`])), hash, `Commit does not contain reviewed bytes: ${relative}`);
  }
}
verifySource();
function verifyOldInputs() {
  for (const [relative, hash] of Object.entries(expected.oldFiles)) assert.equal(digest(read(path.join(oldKit, relative))), hash, `Historical input changed: ${relative}`);
  for (const [relative, hash] of Object.entries(expected.oldHelpers)) assert.equal(digest(read(path.join(oldQa, relative))), hash, `Original consumer changed: ${relative}`);
}
verifyOldInputs();
assert(!fs.existsSync(kit), 'Fresh kit path must be absent; preserve any partial attempt');
assert(!fs.existsSync(qa), 'Fresh QA path must be absent; preserve any partial attempt');
const transformations = [];
function replaceExact(text, before, after, name) {
  const count = text.split(before).length - 1;
  assert.equal(count, 1, `${name}: expected exactly one original transformation anchor`);
  transformations.push({ name, occurrences: count });
  return text.replace(before, after);
}
function common(text, name) {
  // Only these generation/path/source literals change. Historical baselines and
  // all consumer/source-hash/AST assertions remain in the adapted code.
  for (const [before, after] of [[oldName, newName], ['kit-checks-prompt-trust', 'kit-checks-delivery-plan'], [oldCommit, commit], ['cortex-sandbox-prompt-trust:20261014', 'cortex-sandbox-delivery-plan:20261014']]) {
    const count = text.split(before).length - 1;
    if (count) { transformations.push({ name, literal: before, occurrences: count }); text = text.replaceAll(before, after); }
  }
  assert(!text.includes(oldName) && !text.includes('kit-checks-prompt-trust') && !text.includes('SOURCE_COMMIT_UNREADY'));
  return text;
}
const planned = [];
for (const relative of controls) planned.push({ root: kit, relative, bytes: Buffer.from(common(read(path.join(oldKit, relative)).toString(), relative)) });
for (const helper of helpers) {
  const relative = helper + '.mjs'; let text = common(read(path.join(oldQa, relative)).toString(), relative);
  if (helper === 'verify-packed-backend-export-closure') {
    text = replaceExact(text,
      "'convex-dev/runtimeModelPolicy.ts':[['captureTerminalEvidenceV8','internalMutation'],['attachTerminalResultV8','internalMutation']],",
      "'convex-dev/runtimeModelPolicy.ts':[['checkpointRecall','internalMutation'],['captureTerminalEvidenceV8','internalMutation'],['attachTerminalResultV8','internalMutation']],", 'checkpointRecall registered order');
    text = replaceExact(text, "'convex-dev/runtimeAgent.ts':[['admitPreparedModelOperationV8','internalMutation'],", "'convex-dev/runtimeAgent.ts':[['admitPreparedModelOperationV8','internalMutation'],['attachModelResultV8','internalMutation'],", 'attachModelResultV8 registered order');
    text = replaceExact(text,
      "'convex-dev/runtimeMemoryQuery.ts':[['prepare','internalQuery'],['admit','internalMutation']],",
      "'convex-dev/runtimeMemoryQuery.ts':[['prepare','internalQuery'],['admit','internalMutation'],['prepareReads','internalQuery'],['readMatches','internalQuery'],['finalRecallDelivery','internalMutation']],", 'public recall private registered order');
    text = replaceExact(text,
      "if(sourcePath==='convex-dev/runtimeClient.ts') for(const phase of ['admission.submit','admission.start','admission.get'])assert(packed.toString().includes(phase));",
      "if(sourcePath==='convex-dev/runtimeClient.ts') { for(const phase of ['admission.submit','admission.start','admission.get'])assert(packed.toString().includes(phase)); for(const name of ['observeSignalHandler','observeWithMetadataHandler','observationMarker','acknowledgeSignal'])assert(packed.toString().includes(name),name); }", 'packed original delivery plus opt-in revision seam');
    text = replaceExact(text, "registeredEndpointAdditions:'Original bounded-repair additions, private V8 terminal scopes, foreground expiry and two ordered private V8 read parents; every53421 historical endpoint/export preserved'", "registeredEndpointAdditions:'Original bounded-repair additions, private V8 terminal scopes, foreground expiry, ordered private V8 read parents, atomic V8 model attachment, recall checkpoint and three public recall parents; every53421 historical endpoint/export preserved'", 'endpoint receipt description');
    assert.equal((text.match(/const paths=\[/g) ?? []).length, 1);
    const pathsLine = text.match(/^const paths=(\[[^\n]+\]);$/m); assert(pathsLine);
    assert.equal((pathsLine[1].match(/'[^']+'/g) ?? []).length, 32, 'Keep all 32 purposeful roots');
    assert(text.includes("'53421e78165fb12a16a11faa19db9372fa8ddfd4:'") && text.includes('assert.deepEqual(packedDeclarations.endpoints,current.endpoints)'));
  }
  if (helper === 'verify-actual-packed-public-contracts') text = replaceExact(text,
    "assert.ok(text.includes('probeAuthenticationDenial') && text.includes('AUTH_PROBE_ORIGIN_CHANGED'), 'Fresh authentication refusal probe bundled in both runtime formats');",
    "assert.ok(text.includes('probeAuthenticationDenial') && text.includes('AUTH_PROBE_ORIGIN_CHANGED'), 'Fresh authentication refusal probe bundled in both runtime formats');\n    assert.ok(text.includes('acknowledgeSignal'), 'Explicit watcher acknowledgement opt-in bundled in both runtime formats');", 'SDK runtime formats watcher opt-in');
  if (helper === 'verify-packed-template-catalog') {
    // Use the corrected published-manifest canonical transform; never regenerate a catalog.
    assert(text.includes("canonical.dependencies['@cortexmemory/sdk']='^0.39.0'") && text.includes("stableJson(canonical)+'\\n'"));
    assert(text.includes('catalog.templates.length,15') && text.includes('retained.templates.length,14'));
  }
  planned.push({ root: qa, relative, bytes: Buffer.from(text) });
}
assert.equal(planned.length, 10);
// Syntax only, before any kit/QA directories are created. No module code runs.
for (const item of planned.filter(item => item.relative.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', '--input-type=module'], { input: item.bytes, env, stdio: ['pipe', 'pipe', 'pipe'] });
verifySource(); verifyOldInputs();
fs.mkdirSync(kit); fs.mkdirSync(qa);
for (const relative of ['staging', 'artifacts', 'cache', 'image', 'image/archives']) fs.mkdirSync(path.join(kit, relative));
const identity = { version: 1, id: randomUUID(), ownerUid: process.getuid(), ownerGid: process.getgid() };
fs.writeFileSync(path.join(kit, 'identity.json'), JSON.stringify(identity, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
for (const item of planned) fs.writeFileSync(path.join(item.root, item.relative), item.bytes, { flag: 'wx', mode: 0o644 });
verifyOldInputs(); verifySource();
const receipt = { status: 'FRESH_CONTROLS_PREPARED_ONLY', acceptedSourceCommit: commit, kit, qa, identity,
  review: { path: reviewPath, sha256: digest(read(reviewPath)), packetSha256: review.verifiedInputs.packetSha256 },
  toolchain: { node: process.versions.node, npm: '12.2.0', pinnedBin },
  unchangedHistoricalInputs: expected.oldFiles, unchangedConsumerSources: expected.oldHelpers,
  created: planned.map(item => ({ path: path.join(item.root, item.relative), sha256: digest(read(path.join(item.root, item.relative))) })),
  transformations, expectedBackend: { files: 170, tables: 78, components: 2, purposefulRoots: 32, newEndpoints },
  versions: { sdk: '0.39.0', cli: '0.39.0', provider: '0.39.0', catalog: '1.3.3', basic: '1.4.2', vercel: '1.4.2', catalogDescriptors: 15, historicalDescriptors: 14 },
  futureRecipe: { isolatedBuilds: 3, actualPacks: 4, consumerGroups: 4, imageBuilds: 1, platform: 'linux/arm64', user: 'sandbox', tag: 'cortex-sandbox-delivery-plan:20261014', blindRetries: 0 },
  buildsExecuted: 0, packsExecuted: 0, imagesBuilt: 0, serviceCalls: 0, inferenceCalls: 0,
  sourceSpeedOrNativeAcceptance: false };
fs.writeFileSync(path.join(qa, 'preparation-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, acceptedSourceCommit: commit, kit, qa, identity,
  historicalInputsPreserved: Object.keys(expected.oldFiles).length, controls: 4, consumerHelpers: 6, buildsExecuted: 0,
  receipt: path.join(qa, 'preparation-receipt.json') }));
