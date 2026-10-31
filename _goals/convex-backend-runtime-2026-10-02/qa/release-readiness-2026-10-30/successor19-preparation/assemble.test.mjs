/** Synthetic complete bundles prove assembly contracts, never image availability or production acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { baseline, descriptorInventory, sealGroup, assemble, verifyCandidate, availableActualGroups, actualImageFiles, evaluateActualImage, main,
  releaseCandidate, IMAGE_MODEL, IMAGE_BOUND, RETIRED_MODEL, sha } from './assemble.mjs';
import { CANDIDATE } from '../qualification-renewal/renewal.mjs';

const modes = { plain: ['plain'], title: ['title'], small: ['small'], large: ['large'],
  v2: ['toolsGenerate', 'toolsStream'], jsonExtract: ['jsonExtract'], v1: ['v1'], image: ['image'] };
async function fixture() {
  const base = await baseline(), now = Date.now(), groups = {};
  for (const [id, definition] of Object.entries(base.groups)) {
    const q = structuredClone(definition.qualification), p = structuredClone(definition.proof);
    q.priceRevision = p.priceRevision = 'SYNTHETIC-NOT-A-CURRENT-PRICE-' + id;
    p.inputBound.documentHash = sha('synthetic-price-and-input-' + id); p.inputBound.nativeTransformHash = sha(base.inputs.native);
    groups[id] = sealGroup(id, q, p, { kind: 'synthetic-fixture', outcomesValidated: true, cleanupStatus: 'ABSENT',
      targetExpiresAt: now + 6 * 86400000,
      entries: modes[id].map((mode, index) => ({ mode, sha256: sha('SYNTHETIC-NOT-A-NATIVE-RECEIPT-' + mode), checkedAt: now - 1000 + index, completedAt: now - 500 + index })),
      ...(id === 'image' ? { image: { bytes: 1500, sha256: sha('SYNTHETIC-NOT-AN-ACTUAL-IMAGE'), privateDeliveryVerified: true, evidenceRenewsRetiredModel: false } } : {}) });
  }
  return { base, groups, now };
}

test('actual current receipts validate nine methods; missing-image input still cannot produce a successor', async () => {
  const base = await baseline(), actual = await availableActualGroups(base, { includeImage: false }), result = await main();
  assert.deepEqual(actual.missing, ['image']); assert.equal(Object.keys(actual.groups).length, 7);
  assert.equal(actual.groups.v1.evidence.kind, 'actual-local-receipts');
  assert.throws(() => assemble(base, actual.groups), /MISSING_GENUINE_IMAGE/);
  assert.equal(result.status, 'ACTUAL_NINE_METHODS_VALIDATED_PENDING_COHERENT_REVIEW'); assert.equal(result.actualPassingMethods, 9);
  assert.equal(result.reviewedActualManifestCreated, false); assert.equal(result.candidateManifestCreated, false); assert.equal(result.serviceCalls, 0);
});

test('actual image bytes/ledger/cleanup validate; retired-model substitution, byte mutation or financial release changes fail', async () => {
  const original = await actualImageFiles(), checked = evaluateActualImage(original);
  assert.equal(checked.image.bytes, 700695); assert.equal(checked.image.width, 1024); assert.equal(checked.image.height, 1024);
  assert.equal(checked.image.identity, 'requested-only'); assert.equal(checked.image.settledUsdClaim, false);
  for (const mutate of [input => { input.bytes[100] ^= 1; }, input => { input.summary.modelId = RETIRED_MODEL; },
    input => { input.ledger.attempts[0].slotReleased = false; }, input => { input.ledger.accounts[0].uncertainUnits = 0; },
    input => { input.cleanup.status = 'CLEANUP_FAILED'; }, input => { input.job.asset.lineage.modelId = RETIRED_MODEL; }]) {
    const input = structuredClone(original); input.bytes = Buffer.from(input.bytes); mutate(input);
    assert.throws(() => evaluateActualImage(input));
  }
});

test('compiled release data exactly matches the independently bound actual observations and finite assembler output', async () => {
  const expected = await releaseCandidate(), requireCandidate = createRequire(path.join(CANDIDATE, 'package.json'));
  const source = await fs.readFile(path.join(CANDIDATE, 'convex-dev/runtimeGatewayReleaseQualifications.ts'), 'utf8');
  const ts = requireCandidate('typescript');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', code)(module.exports, module);
  assert.deepEqual(module.exports.RELEASE_GATEWAY_POLICY_MANIFEST_V19, expected.manifest);
  assert.deepEqual(module.exports.RELEASE_GATEWAY_POLICY_V19_OBSERVATIONS, expected.observations);
  assert.equal(expected.observations.finalCoherentCodeReviewRepresentedByAcceptanceHash, false);
  assert.equal(expected.observations.v1.generationSeparatelyObserved, false);
  assert.equal(expected.deployed, false); assert.equal(expected.ciSelectorsChanged, false);
});

test('synthetic complete fixture resolves all12 defaults and9 supported aliases with original caps and all8 roots', async () => {
  const { base, groups, now } = await fixture();
  assert.throws(() => assemble(base, groups, { now }), /Synthetic evidence/);
  const candidate = assemble(base, groups, { now, allowSynthetic: true });
  const checked = verifyCandidate(candidate, base, { now, allowSynthetic: true });
  assert.equal(candidate.status, 'PROSPECTIVE_UNAPPROVED_ONLY'); assert.equal(candidate.syntheticInputs, true);
  assert.equal(candidate.manifest.classification, 'fixture-synthetic'); assert.equal(checked.actualRuntimeCertified, false);
  assert.equal(checked.defaults.length, 12); assert.equal(candidate.historicalRoots.length, 8);
  assert.deepEqual(candidate.historicalRoots, base.roots);
  for (const row of checked.defaults) assert.equal(row.runBudgetUnits, ['agent.respond', 'media.image.generate'].includes(row.operationKey) ? 3000000 : 2000000);
  const image = checked.defaults.find(row => row.operationKey === 'media.image.generate');
  assert.equal(image.modelId, IMAGE_MODEL); assert.equal(image.boundRevision, IMAGE_BOUND);
  const strict = checked.defaults.find(row => row.operationKey === 'memory.extract');
  assert.equal(strict.boundRevision, 'memory-json-schema-8192-512-v1');
  for (const bound of ['agent-tools-32768-512-v1', 'agent-tools-v2-32768-256-shared3m-v1']) {
    const q = candidate.manifest.qualifications.find(q => q.boundRevision === bound); assert.ok(q);
    assert.equal(q.limits.runBudgetUnits, bound.includes('v2') ? 3000000 : 2000000);
    const p = candidate.manifest.dispatchEvidence.find(p => p.receiptId === q.receiptId);
    assert.equal(JSON.parse(p.toolContract.toolsCanonical).length, bound.includes('v2') ? 5 : 2);
  }
  assert.ok(!candidate.manifest.qualifications.some(q => q.modelId === RETIRED_MODEL));
  const inventory = descriptorInventory(base);
  assert.equal(inventory.required.filter(row => row.group).length, 9);
  assert.ok(inventory.historicalDescriptors.some(row => row.envelope === 'memory-extract-json-object-v1' && row.disposition === 'EXPIRED_NO_SAME_WIRE_OBSERVATION'));
});

test('missing image, cross-model image proof, changed media contract and future/expired/extended evidence fail closed', async () => {
  const f = await fixture();
  for (const alter of [groups => { delete groups.image; }, groups => { groups.image.qualification.modelId = RETIRED_MODEL; },
    groups => { groups.image.proof.modelId = RETIRED_MODEL; }, groups => { groups.image.proof.boundRevision = 'media-image-1024-low-png-shared3m-v1'; },
    groups => { groups.image.proof.mediaContract.maximumResultBytes = 20000001; }, groups => { groups.image.evidence.image.privateDeliveryVerified = false; },
    groups => { groups.v1.proof.expiresAt++; }, groups => { groups.plain.proof.inputBound.proofHash = 'f'.repeat(64); },
    groups => { groups.plain.proof.inputBound.nativeTransformHash = 'f'.repeat(64); },
    groups => { groups.jsonExtract.proof.inputBound.documentHash = 'f'.repeat(64); },
    groups => { groups.v1.evidence.entries[0].checkedAt = f.now + 1; }, groups => { groups.v1.evidence.targetExpiresAt = f.now - 1; groups.v1.proof.expiresAt = f.now - 1; },
    groups => { groups.v2.evidence.entries.pop(); }]) {
    const groups = structuredClone(f.groups); alter(groups);
    assert.throws(() => assemble(f.base, groups, { now: f.now, allowSynthetic: true }));
  }
});

test('cap lifts, dropped V1/remoteV2 aliases, history edits, stale proof binding and policy model changes are rejected', async () => {
  const { base, groups, now } = await fixture(), original = assemble(base, groups, { now, allowSynthetic: true });
  for (const alter of [candidate => { candidate.manifest.qualifications.find(q => q.boundRevision === 'agent-tools-32768-512-v1').limits.runBudgetUnits = 3000000; },
    candidate => { candidate.manifest.qualifications = candidate.manifest.qualifications.filter(q => q.boundRevision !== 'agent-tools-v2-32768-256-shared3m-v1'); },
    candidate => { candidate.manifest.qualifications = candidate.manifest.qualifications.filter(q => q.boundRevision !== 'agent-tools-32768-512-v1'); },
    candidate => { candidate.manifest.policies.find(p => p.operationKey === 'conversation.title').rules.limits.runBudgetUnits = 3000000; },
    candidate => { candidate.manifest.policies.find(p => p.operationKey === 'media.image.generate').rules.modelId = RETIRED_MODEL; },
    candidate => { candidate.manifest.dispatchEvidence[0].expiresAt++; }, candidate => { candidate.historicalRoots[0].revision = 19; },
    candidate => { candidate.manifest.classification = 'reviewed-actual'; }]) {
    const candidate = structuredClone(original); alter(candidate);
    assert.throws(() => verifyCandidate(candidate, base, { now, allowSynthetic: true }));
  }
});
