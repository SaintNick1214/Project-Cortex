/** Read existing K12 commissioning receipts; retain public checks/hashes only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadSession, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
const session = await loadSession(PROOFS_ROOT, '706fb0d2-187d-4855-9ace-376958ab5613');
assert.equal(session.phase, 'READY');
assert.equal(session.target.name, process.argv[2]);
assert.equal(session.target.id, Number(process.argv[3]));
const files = [];
async function receipt(name) {
  const bytes = await fs.readFile(path.join(session.receiptDir, name));
  files.push({name, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')});
  return JSON.parse(bytes);
}
assert.equal(session.target.name,'nautical-ant-358');assert.equal(session.target.id,6148154);
assert.equal(session.target.teamId,325340);assert.equal(session.target.projectId,3200658);assert.equal(session.target.reference,'dev/cortex-sandbox-'+session.id);
assert.equal(session.target.expiresAt,1792528529992);assert.ok(session.target.expiresAt>Date.now());
assert.equal(session.container.imageId,'sha256:7a933ed4cb36c1951f9e338e4fda3f4c804eaed4f873e447e2749f2f64e82ef1');
const host=await receipt('host-prepared.json');assert.equal(host.sourceCommit,'2a08b37c23dc4066634d2735da219cb5d09900df');
const manifestBytes=await fs.readFile('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-authority-routing-2026-10-13/image/archives/manifest.json');
const manifestHash=createHash('sha256').update(manifestBytes).digest('hex');assert.equal(JSON.parse(manifestBytes).sourceCommit,host.sourceCommit);
const batch = await receipt('qualification-batch-evaluation.json');
assert.equal(batch.actualSuccessfulMethods, 8);
assert.equal(batch.dispatches, 8);
assert.equal(batch.fullUnknownLiabilityUnits, 2700000);
assert.equal(batch.activeConcurrency, 0);
const methods = [];
for (const mode of ['jsonExtract','plain','title','small','large','toolsGenerate','toolsStream','image']) {
  const outcome = await receipt('outcome-' + mode + '.json');
  assert.equal(outcome.status, 'ACTUAL_METHOD_AUTOMATIC_EVALUATION_PASS');
  assert.equal(outcome.mode, mode);
  await receipt('issued-' + mode + '.json');
  await receipt('raw-' + mode + '.json');
  methods.push({mode, status:outcome.status, newAttempts:outcome.newAttempts,
    ceilingRetainedAsUnknownUnits:outcome.ceilingRetainedAsUnknownUnits});
}
const retirement = await receipt('commission-retirement.json');
const ready = await receipt('runtime-ready.json');
const evidence = await receipt('actual-qualification-evidence.json');
const summary = {observedAt:new Date().toISOString(), sessionId:session.id,
  target:{name:session.target.name,id:session.target.id,reference:session.target.reference},
  sourceCommit:host.sourceCommit, imageId:session.container.imageId, archiveManifestSha256:manifestHash, batch, methods,
  qualificationExpiresAt:evidence.qualificationExpiresAt,
  commissioning:{scopeTombstoned:retirement.scopeTombstoned,
    publicSessionDenied:retirement.publicSessionDenied,
    originalFinancialRowsPreserved:retirement.immutableFinancialRowsAndFullLiabilityPreserved,
    managedDefaultProfile:ready.ownerSessionAndManagedDefaultProfilePass,
    readerWriteDenied:ready.readerWriteDenied, outsiderScopeDenied:ready.outsiderScopeDenied,
    publicProbeRemoved:ready.publicProbeRemoved}, files,
  boundary:'Local projection of existing actual receipts. Full UNKNOWN ceilings are not known charges; source acceptance is separate from SLO acceptance. Original receipts remain in place.'};
const destination=path.join(path.dirname(fileURLToPath(import.meta.url)), 'k12-native-qualification-metadata.json');
await fs.writeFile(destination,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt:destination, methods:methods.length, dispatches:batch.dispatches, unknownLiabilityUnits:batch.fullUnknownLiabilityUnits}));
