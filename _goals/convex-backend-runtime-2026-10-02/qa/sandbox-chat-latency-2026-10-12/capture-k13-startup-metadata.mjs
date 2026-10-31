/** Read existing K13 commissioning receipts; retain public checks/hashes only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadSession, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
const session = await loadSession(PROOFS_ROOT, '90c168d7-c872-4e13-872a-808673687f18');
assert.equal(session.phase, 'READY');
assert.equal(session.target.name, process.argv[2]);
assert.equal(session.target.id, Number(process.argv[3]));
const files = [];
async function receipt(name) {
  const bytes = await fs.readFile(path.join(session.receiptDir, name));
  files.push({name, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')});
  return JSON.parse(bytes);
}
assert.equal(session.target.name,'reminiscent-gazelle-386');assert.equal(session.target.id,6149177);
assert.equal(session.target.teamId,325340);assert.equal(session.target.projectId,3200658);assert.equal(session.target.reference,'dev/cortex-sandbox-'+session.id);
assert.equal(session.target.expiresAt,1792531499517);assert.ok(session.target.expiresAt>Date.now());
assert.equal(session.container.imageId,'sha256:4155c4f494de20db78117d27898455c11f961acc9b3a8d93fb7d1798ef367bb5');
const host=await receipt('host-prepared.json');assert.equal(host.sourceCommit,'eb8c4c03a2457b79d3b7129a7e7af8da3ecd67bd');
const manifestBytes=await fs.readFile('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-immediate-start-2026-10-13/image/archives/manifest.json');
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
const destination=path.join(path.dirname(fileURLToPath(import.meta.url)), 'k13-native-qualification-metadata.json');
await fs.writeFile(destination,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt:destination, methods:methods.length, dispatches:batch.dispatches, unknownLiabilityUnits:batch.fullUnknownLiabilityUnits}));
