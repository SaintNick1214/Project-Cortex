import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const qa = '_goals/convex-backend-runtime-2026-10-02/qa/task03-artifact-schema-index-repair';
const constants = {
  "preHashes": {
    "convex-dev/schema.ts": "4329334be57feac9085f793e2b78492b2ba04ec1a4319df09f00c06434f7ff5c",
    "convex-dev/runtimeArtifactAuth.ts": "72559c3fdd3282c92018c30ec1cd7d41fa958bb5e268475f6350d4dd4c75df88",
    "convex-dev/artifacts.ts": "15959b6cbc5126425c40a16d7a473cf0c353211b78b677e51660720abe7a9c14"
  },
  "postHashes": {
    "convex-dev/schema.ts": "07df1b0be4647848a3e9fbd1eb9d27d81ad78194f77d3c447c7ee4f2de419b1d",
    "convex-dev/runtimeArtifactAuth.ts": "aa75122698632dfb836b10a12251de7c580f58aa8c16d866913f07fc657962c8",
    "convex-dev/artifacts.ts": "3252eb473cd80c9fe222a21322cb55e321704635dfd17596c319183fb9bcc2a3"
  },
  "inputHashes": {
    "_goals/convex-backend-runtime-2026-10-02/qa/task03-foundation-catalog-repair/compose.mjs": "1bc00b070ed693a0030ae4431e9aefb40e6a4af8113bb76f7d50f9d179eb2b89",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/original/accepted22.json": "4bc7c823ef4eae9b1acf5ee65351fb335ff1c5e53a78ed51f58d6b872a11a07d",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/candidate/source-hashes.json": "48796c2b36177b8a3e3891d47f0efdd1fcbffa32a6a93872acee098817cbcb3e",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/original/source-hashes.json": "b8ea1708053a5ff8575b59c54fb5840b96a6b216e608a202049c6f3cfd5c68ce",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2b2-stats/frozen-uniform-closure.json": "fe7f2f7b3feee0117ba9d2cfd67b90b99f32a7f38860f52febdc7ca2961a177f",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/original/artifacts.ts": "15ebec7f79d4917d1db4a075598c3e6c5a6690dafd584552c3afe62d38ed8c81",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2f-asset-foundation/candidate/convex-dev/artifacts.ts.text": "15959b6cbc5126425c40a16d7a473cf0c353211b78b677e51660720abe7a9c14",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2c1/inventory.mjs": "b5676a8ae591793a026d6af172b84695bbee9b602cca9e82c5830733d9ed816a",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2c1/frozen-catalog.json": "b2c81b2c56faaa324deb84291a1c21089bf1383a5bd04c121875247dd59a715c",
    "_goals/convex-backend-runtime-2026-10-02/qa/task03b2c1/excluded-baseline.ts.text": "d3729a1445586fb1e4859e5421c488edc31078e6d7067379c5afd0e6c04523ea"
  },
  "probeHash": "8f8867259a399e6a443679ec782a34ae800af3c319d8aaa59bbff5595e0ce18f",
  "preNativeHash": "8407b2d13b08ffb3d7fe4e13d61342da279350dfc17497ae78ddef5daa0ad52a"
};
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const archived = (name) => read(`${qa}/archive/${name}`);
const sources = Object.fromEntries(Object.keys(constants.postHashes).map((name) => [name, read(name)]));
function verify(current) {
  for (const [name, expectedHash] of Object.entries(constants.postHashes)) {
    const before = archived(name);
    assert.equal(hash(before), constants.preHashes[name], `Exact archived source ${name}`);
    const needle = name === 'convex-dev/schema.ts'
      ? '    .index("by_runtime_scope", ["tenantId", "memorySpaceId"])\n'
      : '.withIndex("by_runtime_scope",';
    assert.equal(before.split(needle).length - 1, 1, `Exactly one authorized edit ${name}`);
    const expected = name === 'convex-dev/schema.ts' ? before.replace(needle, '')
      : before.replace(needle, '.withIndex("by_tenant_space",');
    assert.equal(hash(current[name]), expectedHash, `Exact current source hash ${name}`);
    assert.equal(current[name], expected, `Whole-byte sole authorized edit ${name}`);
  }
}
verify(sources);
const tamperControls = [];
for (const [name, target, needle, replacement] of [
  ['changed tenant scope', 'convex-dev/runtimeArtifactAuth.ts', 'q.eq("tenantId", authority.tenantId)', 'q.eq("tenantId", "foreign")'],
  ['extra index', 'convex-dev/schema.ts', '.index("by_runtime_key",', '.index("unauthorized", ["tenantId"]).index("by_runtime_key",'],
  ['changed candidate index', 'convex-dev/runtimeArtifactAuth.ts', '.withIndex("by_tenant_space",', '.withIndex("by_runtime_scope",'],
  ['changed purge space bound', 'convex-dev/artifacts.ts', '.eq("memorySpaceId", args.memorySpaceId!)', '.eq("memorySpaceId", "foreign")'],
  ['changed other declaration', 'convex-dev/artifacts.ts', 'export const purgeAll', '/* unrelated tamper */ export const purgeAll'],
]) {
  assert.ok(sources[target].includes(needle), `Tamper control reaches ${name}`);
  assert.throws(() => verify({ ...sources, [target]: sources[target].replace(needle, replacement) }));
  tamperControls.push(name);
}
for (const [name, expected] of Object.entries(constants.inputHashes)) {
  assert.equal(hash(read(name)), expected, `Original immutable input ${name}`);
  assert.equal(hash(archived(name)), expected, `Archived original input ${name}`);
}
const probe = '_goals/convex-backend-runtime-2026-10-02/qa/task03-artifact-schema-index-repair/native-probe.mts';
assert.equal(hash(read(probe)), constants.probeHash, 'Native probe integrity');
const beforeNativeText = read(`${qa}/pre-edit-native.json`);
assert.equal(hash(beforeNativeText), constants.preNativeHash, 'Pre-edit native proof integrity');
assert.ok(process.argv[2], 'Explicit owned scratch destination');
const destination = path.resolve(process.argv[2]);
fs.mkdirSync(destination, { recursive: true });
const witnessFile = path.join(destination, 'exact-current-repair-native.json');
execFileSync(process.execPath, ['--import', 'tsx', probe, witnessFile], { cwd: root, encoding: 'utf8' });
const currentNative = JSON.parse(fs.readFileSync(witnessFile, 'utf8'));
const expectedNative = JSON.parse(beforeNativeText);
for (const table of expectedNative.definitions) {
  if (table.table === 'artifacts') {
    table.indexes = table.indexes.filter((index) => index.indexDescriptor !== 'by_runtime_scope');
    table.exported.indexes = table.exported.indexes.filter((index) => index.indexDescriptor !== 'by_runtime_scope');
  }
}
assert.equal(currentNative.tableCount, 26);
assert.deepEqual(currentNative.duplicates, []);
assert.deepEqual(currentNative.definitions, expectedNative.definitions, 'All native validators and indexes exact except authorized removal');
assert.deepEqual(currentNative.registrations, expectedNative.registrations, 'Every native registered artifact contract preserved');
assert.deepEqual(currentNative.definitions.find((table) => table.table === 'artifacts').indexes
  .filter((index) => JSON.stringify(index.fields) === JSON.stringify(['tenantId', 'memorySpaceId'])),
[{ indexDescriptor: 'by_tenant_space', fields: ['tenantId', 'memorySpaceId'] }]);
const replica = fs.mkdtempSync(path.join(destination, 'exact-before-replica-'));
let composition;
try {
  for (const name of Object.keys(constants.inputHashes)) {
    const target = path.join(replica, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, archived(name));
  }
  for (const name of ['agents', 'memorySpaces', 'runtimeRegistryStats']) {
    const target = path.join(replica, `convex-dev/${name}.ts`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, `convex-dev/${name}.ts`), target);
  }
  // The exact whole-byte before/after proof above selects the archived accepted
  // source. No current declaration is normalized or permitted to drift.
  fs.writeFileSync(path.join(replica, 'convex-dev/artifacts.ts'), archived('convex-dev/artifacts.ts'));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(replica, 'node_modules'), 'dir');
  composition = JSON.parse(execFileSync(process.execPath,
    [path.join(replica, '_goals/convex-backend-runtime-2026-10-02/qa/task03-foundation-catalog-repair/compose.mjs'), destination],
    { cwd: replica, encoding: 'utf8' }));
} finally { fs.rmSync(replica, { recursive: true, force: true }); }
assert.equal(composition.negativeControls, 4);
composition.exactCurrentRepair = { preHashes: constants.preHashes, postHashes: constants.postHashes,
  tables: currentNative.tableCount, indexes: currentNative.indexCount, duplicateSequences: 0,
  wholeByteAuthorizedEdits: 3, currentTamperControls: tamperControls, nativeWitness: witnessFile };
fs.writeFileSync(path.join(destination, 'composition.json'), JSON.stringify(composition, null, 2) + '\n');
console.log(JSON.stringify(composition));
