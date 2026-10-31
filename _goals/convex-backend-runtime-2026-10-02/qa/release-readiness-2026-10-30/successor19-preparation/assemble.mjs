/** Pure unapproved successor preparation. No bootstrap, deployment, selector or remote operations. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contracts, ENGINE, CANDIDATE } from '../qualification-renewal/renewal.mjs';
import { evaluateV1 } from '../qualification-renewal/renewal.mjs';
import { evaluateLedger as evaluateV1Ledger } from '../v1-renewal-only/v1-renewal.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const IMAGE_MODEL = 'openai/gpt-image-2.5-flare';
export const IMAGE_BOUND = 'image25-flare-1024-low-png-v1';
export const RETIRED_MODEL = 'openai/gpt-image-1';
export const IMAGE_CONTRACT = Object.freeze({ version: 1, options: { kind: 'image', n: 1, size: '1024x1024', quality: 'low', outputFormat: 'png' },
  inputProtocol: 'none', maximumInputAssetBytes: 0, maximumResultBytes: 20000000, callbacks: false, terminalIdentity: 'requested-only', usage: 'optional' });
const DAY = 86400000;
const HEX = /^[a-f0-9]{64}$/;
export const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const clone = value => structuredClone(value);
const scope = { tenantId: 'offline-assembly', memorySpaceId: 'offline-assembly', principalId: 'offline', principalVersion: 1,
  membershipId: 'offline', membershipVersion: 1, grantId: 'offline', grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
const groupModes = { plain: ['plain'], title: ['title'], small: ['small'], large: ['large'],
  v2: ['toolsGenerate', 'toolsStream'], jsonExtract: ['jsonExtract'], v1: ['v1'], image: ['image'] };
export const EVIDENCE_REVIEW_SHA256 = 'ffcbc7b6ba21712668ff9c9a724edc8b98c48f88b1789c6df580b2a2146332d2';

export async function evidenceReview() {
  const binding = await json(path.join(HERE, 'evidence-review-binding.json'));
  assert.equal(sha(binding), EVIDENCE_REVIEW_SHA256, 'Independent evidence binding changed');
  assert.equal(binding.verdict, 'PASS'); assert.equal(binding.breakingFindings, 0);
  assert.equal(binding.scope, 'actual-release-model-observations-seven-plus-v1-plus-flare');
  for (const [name, digest] of Object.entries(binding.sourceFiles)) assert.equal(sha(await fs.readFile(path.join(HERE, '..', name))), digest);
  for (const session of binding.sessions) {
    const publicRaw = await fs.readFile(path.join(HERE, '..', session.publicReceipt));
    assert.equal(sha(publicRaw), session.publicReceiptSha256);
    const summary = JSON.parse(publicRaw); assert.equal(summary.sessionId, session.sessionId);
    const rows = [];
    for (const name of [...session.receiptSetFiles].sort()) {
      const raw = await fs.readFile(path.join(summary.privateEvidenceDirectory, name)); rows.push({ bytes: raw.length, name, sha256: sha(raw) });
    }
    assert.equal(sha(rows), session.receiptSetSha256, 'Independently reviewed actual receipt set changed');
  }
  return binding;
}

export function historicalRoots() {
  const { old, media } = contracts();
  return [old.TEXT_GATEWAY_POLICY_MANIFEST_V3, old.AGENT_GATEWAY_POLICY_MANIFEST_V5, old.DEFAULT_GATEWAY_POLICY_MANIFEST,
    ...[14, 15, 16, 17, 18].map(version => media['OBSERVED_GATEWAY_POLICY_MANIFEST_V' + version])].map(clone);
}

export async function baseline() {
  const inputs = await json(path.join(HERE, '../qualification-renewal/source-inputs.json')), roots = historicalRoots();
  const { verifyProcedure } = await import(pathToFileURL(path.join(ENGINE, 'qualification.mjs')));
  assert.equal((await verifyProcedure()).digest, inputs.procedureApprovalSha256, 'Reviewed procedure bytes changed');
  for (const row of inputs.finiteSources) {
    let raw = await fs.readFile(path.join(CANDIDATE, row.candidatePath));
    if (row.candidatePath === 'convex-dev/runtimeModelPolicyBootstrap.ts' && sha(raw) !== row.sha256) {
      const addition = 'import { RELEASE_GATEWAY_POLICY_MANIFEST_V19 } from "./runtimeGatewayReleaseQualifications";\n';
      let source = raw.toString();
      assert.equal(source.split(addition).length, 2, 'Only the exact new V19 import is permitted');
      assert.equal(source.split(', RELEASE_GATEWAY_POLICY_MANIFEST_V19])').length, 2, 'Only one appended V19 registry entry is permitted');
      source = source.replace(addition, '').replace(', RELEASE_GATEWAY_POLICY_MANIFEST_V19])', '])');
      raw = Buffer.from(source);
    }
    assert.equal(sha(raw), row.sha256, 'Material source changed outside exact reviewed V19 registration: ' + row.candidatePath);
  }
  for (const row of inputs.native) assert.equal(sha(await fs.readFile(path.join(CANDIDATE, row.candidatePath))), row.sha256, 'Actual native input changed: ' + row.role);
  assert.deepEqual(roots.map(root => ({ manifestId: root.manifestId, revision: root.revision, sha256: sha(root) })), inputs.historicalRoots);
  const template = await json(path.join(ENGINE, 'templates/qualification-envelopes.json'));
  const groups = {};
  for (const [id, index] of [['plain', 0], ['title', 1], ['small', 2], ['large', 3], ['v2', 4], ['jsonExtract', 6], ['image', 5]]) {
    groups[id] = { qualification: clone(template.qualifications[index]), proof: clone(template.dispatchEvidence[index]) };
  }
  groups.v1 = { qualification: clone(inputs.supplemental.qualification), proof: clone(inputs.supplemental.dispatchEvidence) };
  groups.image.qualification.modelId = IMAGE_MODEL; groups.image.qualification.boundRevision = IMAGE_BOUND;
  groups.image.proof.modelId = IMAGE_MODEL; groups.image.proof.boundRevision = IMAGE_BOUND;
  groups.image.proof.mediaContract = clone(IMAGE_CONTRACT);
  return { inputs, roots, groups };
}

function groupFor(q, p) {
  if (q.modelId === RETIRED_MODEL) return null;
  const envelope = p.inputBound.featureEnvelope;
  if (envelope === 'memory-extract-json-object-v1') return null;
  if (envelope === 'agent-tools-chat-v1') return 'v1';
  if (envelope === 'agent-tools-chat-v2') return 'v2';
  if (envelope === 'memory-extract-json-schema-v1') return 'jsonExtract';
  if (q.nativeInterface === 'embedding') return q.modelId.endsWith('-large') ? 'large' : 'small';
  if (envelope === 'plain-chat-v1') return q.modelId === 'openai/gpt-4o' ? 'title' : 'plain';
  throw Error('No finite same-wire evidence mapping: ' + q.boundRevision);
}

export function descriptorInventory(base) {
  const required = base.inputs.baselineQualifications.map(q => {
    const p = base.inputs.baselineDispatchEvidence.find(row => row.receiptId === q.receiptId);
    return { modelId: q.modelId, boundRevision: q.boundRevision, group: groupFor(q, p),
      disposition: q.modelId === RETIRED_MODEL ? 'EXPIRED_RETIRED_MODEL_HISTORY_ONLY' : 'REQUIRED_CURRENT_V16_ALIAS',
      qualification: clone(q), proof: clone(p) };
  });
  assert.equal(required.filter(row => row.group).length, 9);
  const all = new Map();
  for (const root of base.roots) for (const q of root.qualifications) {
    const p = root.dispatchEvidence.find(row => row.receiptId === q.receiptId), key = [q.modelId, q.nativeInterface, q.boundRevision].join('|');
    if (!all.has(key)) all.set(key, { modelId: q.modelId, boundRevision: q.boundRevision, envelope: p.inputBound.featureEnvelope,
      disposition: required.some(row => row.modelId === q.modelId && row.boundRevision === q.boundRevision) ? 'CURRENT_V16_DESCRIPTOR'
        : q.modelId === RETIRED_MODEL ? 'EXPIRED_RETIRED_MODEL_HISTORY_ONLY'
          : p.inputBound.featureEnvelope === 'memory-extract-json-object-v1' ? 'EXPIRED_NO_SAME_WIRE_OBSERVATION' : 'HISTORICAL_EXTRA_NOT_A_NEW_MANDATORY_GATE' });
  }
  return { required, historicalDescriptors: [...all.values()] };
}

function qualificationShape(q) {
  const result = clone(q); delete result.receiptId; delete result.priceRevision; delete result.costBound.provenance; return result;
}
function proofShape(p) {
  const result = clone(p);
  for (const key of ['receiptId', 'priceRevision', 'evidenceHash', 'checkedAt', 'expiresAt']) delete result[key];
  for (const key of ['proofHash', 'documentHash', 'nativeTransformHash']) delete result.inputBound[key];
  delete result.resultBound.proofHash; return result;
}

/** Derive observation dates only from actual terminal times; never extend a historical proof date. */
export function sealGroup(id, qualification, proof, evidence) {
  const entries = evidence.entries, checkedAt = Math.min(...entries.map(entry => entry.checkedAt));
  const evidenceHash = sha(entries), receiptId = 'SUCCESSOR19-' + id + '-' + evidenceHash.slice(0, 20);
  const q = clone(qualification), p = clone(proof);
  q.receiptId = receiptId;
  q.costBound.provenance = `Observed group=${id}; evidence=${evidenceHash}; UNKNOWN retained; unapproved successor preparation.`;
  Object.assign(p, { receiptId, evidenceHash, checkedAt, expiresAt: Math.min(checkedAt + 7 * DAY, evidence.targetExpiresAt) });
  p.inputBound.proofHash = evidenceHash; p.resultBound.proofHash = evidenceHash;
  return { id, qualification: q, proof: p, evidence: { ...clone(evidence), inputAttestation: {
    documentHash: proof.inputBound.documentHash, nativeTransformHash: proof.inputBound.nativeTransformHash,
  } } };
}

function validateGroup(group, expected, now, allowSynthetic) {
  assert.ok(group, 'MISSING_GENUINE_IMAGE_OR_OTHER_GROUP');
  assert.ok(group.evidence.kind === 'actual-local-receipts' || allowSynthetic && group.evidence.kind === 'synthetic-fixture', 'Synthetic evidence is not an actual observation');
  assert.equal(group.evidence.outcomesValidated, true); assert.equal(group.evidence.cleanupStatus, 'ABSENT');
  assert.deepEqual(qualificationShape(group.qualification), qualificationShape(expected.qualification), 'Qualification model/interface/limits/bound changed');
  assert.deepEqual(proofShape(group.proof), proofShape(expected.proof), 'Native feature/model/proof contract changed');
  const { qualification: q, proof: p, evidence: e } = group;
  assert.deepEqual(e.entries.map(entry => entry.mode), groupModes[group.id], 'Missing native method in proof group');
  for (const entry of e.entries) {
    assert.match(entry.sha256, HEX); assert.ok(Number.isSafeInteger(entry.checkedAt) && Number.isSafeInteger(entry.completedAt));
    assert.ok(entry.checkedAt <= entry.completedAt && entry.completedAt <= now, 'Invented/future actual observation time');
  }
  const checkedAt = Math.min(...e.entries.map(entry => entry.checkedAt));
  assert.equal(p.checkedAt, checkedAt); assert.equal(p.expiresAt, Math.min(checkedAt + 7 * DAY, e.targetExpiresAt));
  assert.ok(p.expiresAt > now, 'Actual evidence expired');
  assert.equal(p.evidenceHash, sha(e.entries)); assert.equal(p.inputBound.proofHash, p.evidenceHash); assert.equal(p.resultBound.proofHash, p.evidenceHash);
  assert.match(p.inputBound.documentHash, HEX); assert.match(p.inputBound.nativeTransformHash, HEX);
  assert.deepEqual({ documentHash: p.inputBound.documentHash, nativeTransformHash: p.inputBound.nativeTransformHash }, e.inputAttestation,
    'Observed input/native attestation changed');
  assert.equal(q.receiptId, p.receiptId); assert.equal(q.priceRevision, p.priceRevision);
  if (group.id === 'image') {
    assert.equal(q.modelId, IMAGE_MODEL); assert.equal(p.modelId, IMAGE_MODEL); assert.equal(p.boundRevision, IMAGE_BOUND);
    assert.deepEqual(p.mediaContract, IMAGE_CONTRACT); assert.equal(e.image.privateDeliveryVerified, true);
    assert.equal(e.image.evidenceRenewsRetiredModel, false); assert.match(e.image.sha256, HEX);
    assert.ok(Number.isSafeInteger(e.image.bytes) && e.image.bytes > 0 && e.image.bytes <= 20000000);
  }
}

function defaultPolicies(base, groups) {
  const { domain } = contracts(), policies = clone(base.inputs.baselinePolicies);
  for (const policy of policies) { policy.policyId = policy.policyId.replace(/v16$/, 'v19'); policy.version = 19; }
  const hard = policies.find(row => !row.operationKey);
  hard.rules.allowedModels = hard.rules.allowedModels.map(model => model === RETIRED_MODEL ? IMAGE_MODEL : model);
  Object.assign(hard.rules.pins, { boundRevision: groups.plain.qualification.boundRevision, priceRevision: groups.plain.qualification.priceRevision });
  for (const operationKey of domain.MODEL_OPERATION_KEYS.filter(key => key !== 'media.video.generate')) {
    const id = operationKey === 'agent.respond' ? 'v2' : operationKey === 'memory.extract' ? 'jsonExtract'
      : operationKey === 'conversation.title' ? 'title' : operationKey.startsWith('embedding.') ? 'small'
        : operationKey === 'media.image.generate' ? 'image' : 'plain';
    const { qualification: q, proof: p } = groups[id];
    let policy = policies.find(row => row.operationKey === operationKey);
    if (!policy) { policy = { policyId: 'cortex-' + operationKey.replaceAll('.', '-') + '-v19', version: 19, scope: 'deployment', operationKey, rules: {} }; policies.push(policy); }
    Object.assign(policy.rules, { modelId: q.modelId, nativeInterface: q.nativeInterface });
    policy.rules.pins = { ...policy.rules.pins, priceRevision: q.priceRevision, boundRevision: q.boundRevision, toolRegistryVersion: p.toolContract?.registryVersion ?? 'none-v1' };
    policy.rules.limits = { ...policy.rules.limits, runBudgetUnits: id === 'v2' || id === 'image' ? 3000000 : 2000000 };
    if (id === 'jsonExtract') { policy.rules.pins.promptVersion = domain.MEMORY_JSON_SCHEMA_CONTRACT.promptVersion; policy.rules.allowedTools = []; }
  }
  return policies;
}

function aliasFrom(row, fresh) {
  const q = clone(row.qualification), p = clone(fresh.proof);
  q.receiptId = 'SUCCESSOR19-ALIAS-' + sha([q.modelId, q.nativeInterface, q.boundRevision]).slice(0, 20);
  q.priceRevision = fresh.qualification.priceRevision; q.costBound.provenance = fresh.qualification.costBound.provenance;
  Object.assign(p, { receiptId: q.receiptId, boundRevision: q.boundRevision, priceRevision: q.priceRevision });
  return { qualification: q, proof: p, sourceGroup: row.group };
}

/** Always fixture-synthetic/unapproved. A later reviewed product batch must wire a genuine candidate. */
export function assemble(base, groups, { now = Date.now(), allowSynthetic = false } = {}) {
  assert.ok(groups.image, 'MISSING_GENUINE_IMAGE: no successor candidate can be assembled');
  for (const id of Object.keys(groupModes)) { assert.equal(groups[id]?.id, id); validateGroup(groups[id], base.groups[id], now, allowSynthetic); }
  const inventory = descriptorInventory(base), pairs = Object.values(groups).map(group => ({ qualification: clone(group.qualification), proof: clone(group.proof), sourceGroup: group.id }));
  const aliasBindings = [];
  for (const row of inventory.required.filter(row => row.group)) {
    const existing = pairs.find(pair => pair.qualification.modelId === row.modelId && pair.qualification.boundRevision === row.boundRevision);
    if (existing) assert.deepEqual(existing.qualification.limits, row.qualification.limits);
    else pairs.push(aliasFrom(row, groups[row.group]));
    aliasBindings.push({ modelId: row.modelId, boundRevision: row.boundRevision, sourceGroup: row.group, preservedLimits: clone(row.qualification.limits) });
  }
  const evidenceHash = sha(Object.values(groups).map(group => ({ id: group.id, evidenceHash: group.proof.evidenceHash })));
  const manifest = { manifestId: 'cortex-gateway-policy-v19-prospective', revision: 19, classification: 'fixture-synthetic',
    artifactRevision: base.inputs.backendManifestSha256, evidenceHash, acceptanceHash: sha('UNAPPROVED_SUCCESSOR19:' + evidenceHash),
    budgetWindowMs: 86400000, policies: defaultPolicies(base, groups), qualifications: pairs.map(pair => pair.qualification), dispatchEvidence: pairs.map(pair => pair.proof) };
  const candidate = { status: 'PROSPECTIVE_UNAPPROVED_ONLY', syntheticInputs: Object.values(groups).some(group => group.evidence.kind !== 'actual-local-receipts'),
    manifest, groups: clone(groups), historicalRoots: clone(base.roots), aliasBindings,
    historicalDescriptors: inventory.historicalDescriptors,
    retiredModel: { modelId: RETIRED_MODEL, historyUnchanged: true, renewed: false, replacementModelId: IMAGE_MODEL, replacementBoundRevision: IMAGE_BOUND },
    materialEquivalence: { finiteSources: clone(base.inputs.finiteSources), native: clone(base.inputs.native) } };
  verifyCandidate(candidate, base, { now, allowSynthetic }); return candidate;
}

export function verifyCandidate(candidate, base, { now = Date.now(), allowSynthetic = false } = {}) {
  assert.equal(candidate.manifest.classification, 'fixture-synthetic', 'This preparation never creates an approved root');
  assert.equal(candidate.manifest.revision, 19);
  assert.deepEqual(candidate.historicalRoots, base.roots, 'Historical compiled roots changed');
  assert.deepEqual(candidate.materialEquivalence, { finiteSources: base.inputs.finiteSources, native: base.inputs.native });
  for (const id of Object.keys(groupModes)) validateGroup(candidate.groups[id], base.groups[id], now, allowSynthetic);
  const expectedPairs = Object.values(candidate.groups).map(group => ({ qualification: group.qualification, proof: group.proof }));
  for (const row of descriptorInventory(base).required.filter(row => row.group)) {
    if (!expectedPairs.some(pair => pair.qualification.modelId === row.modelId && pair.qualification.boundRevision === row.boundRevision)) expectedPairs.push(aliasFrom(row, candidate.groups[row.group]));
  }
  assert.deepEqual(candidate.manifest.qualifications, expectedPairs.map(pair => pair.qualification), 'Dropped alias, lifted cap or modified qualification');
  assert.deepEqual(candidate.manifest.dispatchEvidence, expectedPairs.map(pair => pair.proof), 'Changed proof/model/expiry/alias binding');
  assert.deepEqual(candidate.manifest.policies, defaultPolicies(base, candidate.groups), 'Default model/pin/cap changed');
  assert.ok(!candidate.manifest.qualifications.some(q => q.modelId === RETIRED_MODEL));
  assert.ok(!candidate.manifest.dispatchEvidence.some(p => p.modelId === RETIRED_MODEL));
  const { domain } = contracts(), defaults = [];
  for (const operationKey of domain.MODEL_OPERATION_KEYS.filter(key => key !== 'media.video.generate')) {
    const resolved = domain.resolveModelPolicy({ context: { scope, operationKey, runBudgetId: 'offline-prospective', authorizedOverrides: [] },
      policies: candidate.manifest.policies.filter(row => !row.operationKey || row.operationKey === operationKey), qualifications: candidate.manifest.qualifications });
    assert.equal(resolved.limits.runBudgetUnits, operationKey === 'agent.respond' || operationKey === 'media.image.generate' ? 3000000 : 2000000);
    defaults.push({ operationKey, modelId: resolved.modelId, boundRevision: resolved.pins.boundRevision, runBudgetUnits: resolved.limits.runBudgetUnits });
  }
  assert.equal(defaults.length, 12);
  for (const row of descriptorInventory(base).required.filter(row => row.group)) {
    const q = candidate.manifest.qualifications.find(q => q.modelId === row.modelId && q.boundRevision === row.boundRevision);
    const p = candidate.manifest.dispatchEvidence.find(p => p.receiptId === q.receiptId);
    const hard = clone(candidate.manifest.policies.find(policy => !policy.operationKey));
    Object.assign(hard.rules, { modelId: q.modelId, nativeInterface: q.nativeInterface, allowedModels: [q.modelId],
      capabilities: clone(q.capabilities), allowedTools: p.toolContract ? JSON.parse(p.toolContract.toolsCanonical).map(tool => tool.name) : [],
      allowedOptions: clone(q.allowedOptions), fallbackModels: [], limits: clone(q.limits) });
    Object.assign(hard.rules.pins, { boundRevision: q.boundRevision, priceRevision: q.priceRevision, toolRegistryVersion: p.toolContract?.registryVersion ?? 'none-v1' });
    const resolved = domain.resolveModelPolicy({ context: { scope, operationKey: q.nativeInterface === 'embedding' ? 'embedding.query' : q.capabilities.includes('tools') ? 'agent.respond' : 'artifact.text',
      runBudgetId: 'offline-alias', authorizedOverrides: [] }, policies: [hard], qualifications: [q] });
    assert.deepEqual(resolved.limits, row.qualification.limits);
  }
  return { status: 'PURE_RESOLVER_PROSPECTIVE_ONLY', defaults, supportedV16Aliases: 9, unchangedHistoricalRoots: 8, actualRuntimeCertified: false };
}

async function pinnedReceipt(summary, name) {
  const expected = summary.retainedPrivateReceiptHashes.find(row => row.file === name); assert.ok(expected, 'Missing public raw receipt binding');
  const raw = await fs.readFile(path.join(summary.privateEvidenceDirectory, name));
  assert.equal(sha(raw), expected.sha256); assert.equal(raw.length, expected.bytes);
  return { raw: name.endsWith('.png') ? raw : JSON.parse(raw), sha256: sha(raw) };
}

export function evaluateActualImage({ summary, success, job, before, ledger, issued, manifest, cleanup, bytes }) {
  assert.equal(summary.status, 'ACTUAL_REPLACEMENT_IMAGE_READY_PENDING_INDEPENDENT_REVIEW');
  for (const row of [summary, success, issued]) {
    assert.equal(row.modelId, IMAGE_MODEL); assert.equal(row.boundRevision, IMAGE_BOUND); assert.equal(row.evidenceRenewsRetiredModel, false);
  }
  assert.equal(success.privateDeliveryVerified, true); assert.equal(summary.privateDeliveryVerified, true);
  assert.equal(job.state, 'ready'); assert.equal(job.costStatus, 'incurred_unknown');
  assert.equal(job.asset.lineage.modelId, IMAGE_MODEL); assert.equal(job.asset.mimeType, 'image/png');
  assert.ok(bytes.length > 0 && bytes.length <= 20000000);
  for (const row of [summary, success]) { assert.equal(row.bytes, bytes.length); assert.equal(row.sha256, sha(bytes)); }
  assert.equal(job.asset.sizeBytes, bytes.length); assert.equal(job.asset.contentHash, sha(bytes));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 1024); assert.equal(bytes.readUInt32BE(20), 1024);
  assert.equal(cleanup.status, 'ABSENT'); assert.equal(cleanup.sessionId, summary.sessionId); assert.equal(cleanup.credentialsRemoved, true);
  assert.deepEqual(summary.cleanup, cleanup); assert.deepEqual(issued.target, summary.target);
  assert.equal(summary.target.teamId, 325340); assert.equal(summary.target.projectId, 3200658);
  assert.equal(summary.target.deploymentType, 'dev'); assert.equal(summary.target.isDefault, false);
  assert.equal(summary.target.reference, 'dev/cortex-sandbox-' + summary.sessionId); assert.equal(summary.target.serverExpiryVerified, true);
  assert.equal(issued.maximumNewSubmissions, 1); assert.equal(issued.maximumNewUnknownLiabilityUnits, 2000000);
  assert.equal(issued.noAutomaticPaidRetry, true);
  for (const key of ['accounts', 'attempts', 'operations', 'jobs']) assert.equal(before[key].length, 0);
  assert.equal(ledger.attempts.length, 1); assert.equal(ledger.operations.length, 1); assert.equal(ledger.jobs.length, 1); assert.equal(ledger.accounts.length, 2);
  // The active setup context registered this fixed prompt for redaction; final cleanup used a fresh context.
  // Bind the sole permitted difference to the issued prompt hash, preserving every financial/proof field.
  const prompt = ledger.jobs[0].prompt; assert.equal(sha(prompt), issued.promptSha256);
  assert.deepEqual(success.ledger, JSON.parse(JSON.stringify(ledger).split(prompt).join('[REDACTED]')));
  const attempt = ledger.attempts[0], snapshot = JSON.parse(ledger.operations[0].snapshotCanonical), proof = JSON.parse(ledger.jobs[0].proofCanonical);
  assert.equal(attempt.state, 'uncertain'); assert.equal(attempt.reservationUnits, 2000000); assert.equal(attempt.ordinal, 0);
  assert.equal(attempt.slotReleased, true); assert.equal(attempt.resultWithheld, false); assert.match(attempt.dispatchIdentity, HEX);
  assert.equal(attempt.operationDocumentId, ledger.operations[0]._id); assert.equal(ledger.jobs[0].attemptId, attempt._id);
  assert.equal(snapshot.modelId, IMAGE_MODEL); assert.equal(snapshot.pins.boundRevision, IMAGE_BOUND);
  assert.equal(snapshot.limits.runBudgetUnits, 3000000); assert.equal(snapshot.costBound.maximumCostUnits, 2000000);
  assert.equal(proof.modelId, IMAGE_MODEL); assert.equal(proof.boundRevision, IMAGE_BOUND); assert.deepEqual(proof.mediaContract, IMAGE_CONTRACT);
  const qualification = manifest.qualifications.find(q => q.modelId === IMAGE_MODEL);
  assert.ok(qualification); assert.deepEqual(snapshot.limits, qualification.limits);
  assert.deepEqual(proof, manifest.dispatchEvidence.find(p => p.receiptId === qualification.receiptId));
  for (const kind of ['run', 'tenant']) {
    const rows = ledger.accounts.filter(row => row.kind === kind); assert.equal(rows.length, 1);
    assert.equal(rows[0].limitUnits, kind === 'run' ? 3000000 : 10000000);
    assert.equal(rows[0].activeConcurrency, 0); assert.equal(rows[0].reservedUnits, 0); assert.equal(rows[0].settledUnits, 0); assert.equal(rows[0].uncertainUnits, 2000000);
  }
  assert.equal(summary.checkedAt, job.createdAt); assert.equal(summary.completedAt, job.updatedAt); assert.equal(summary.observedAt, success.observedAt);
  assert.ok(issued.issuedAt <= job.createdAt && job.createdAt <= job.updatedAt && job.updatedAt <= success.observedAt);
  return { qualification, proof, checkedAt: job.updatedAt, completedAt: success.observedAt,
    image: { bytes: bytes.length, sha256: sha(bytes), privateDeliveryVerified: true, evidenceRenewsRetiredModel: false,
      mimeType: 'image/png', width: 1024, height: 1024, identity: 'requested-only', settledUsdClaim: false } };
}

export async function actualImageFiles() {
  const summary = await json(path.join(HERE, '../image-renewal-diagnostic/live-replacement-2026-10-31.json'));
  const files = {};
  for (const [key, name] of Object.entries({ success: 'image-actual-success.json', job: 'image-terminal-job.json', before: 'image-before.json',
    ledger: 'image-final-ledger.json', issued: 'issued-image-only.json', manifest: 'image-prospective-manifest.json', cleanup: 'cleanup-final.json', bytes: 'actual-image.png' })) {
    files[key] = (await pinnedReceipt(summary, name)).raw;
  }
  return { summary, ...files };
}

/** Read-only finite actual inputs. No image input is inferred from retirement/catalog/source evidence. */
export async function availableActualGroups(base, { includeImage = true } = {}) {
  const original = await json(path.join(HERE, '../qualification-renewal/live-attempt-2026-10-31.json'));
  const v1 = await json(path.join(HERE, '../v1-renewal-only/live-attempt-2026-10-31.json'));
  assert.equal(original.actualPassingModes.length, 7); assert.equal(original.cleanup.status, 'ABSENT');
  assert.equal(v1.cleanup.status, 'ABSENT'); assert.equal(v1.status, 'ACTUAL_V1_STREAM_OBSERVED_PENDING_INDEPENDENT_REVIEW');
  const provisional = await json(path.join(original.privateEvidenceDirectory, 'provisional-manifest.json'));
  const { evaluateOutcome } = await import(pathToFileURL(path.join(ENGINE, 'qualification.mjs')));
  const extraction = contracts().domain.canonicalModelJson(contracts().domain.MEMORY_JSON_SCHEMA_CONTRACT.responseFormat), groups = {};
  for (const id of ['plain', 'title', 'small', 'large', 'v2', 'jsonExtract']) {
    const entries = [];
    for (const mode of groupModes[id]) {
      const receipt = await pinnedReceipt(original, 'raw-' + mode + '.json'); evaluateOutcome(mode, receipt.raw, extraction);
      entries.push({ mode, sha256: receipt.sha256, checkedAt: receipt.raw.terminalReceipts[0].capturedAt, completedAt: receipt.raw.completedAt });
    }
    const expected = base.groups[id], index = provisional.qualifications.findIndex(q => q.boundRevision === expected.qualification.boundRevision);
    assert.ok(index >= 0);
    groups[id] = sealGroup(id, provisional.qualifications[index], provisional.dispatchEvidence[index], {
      kind: 'actual-local-receipts', outcomesValidated: true, cleanupStatus: 'ABSENT', entries, targetExpiresAt: original.target.expiresAt });
  }
  const stream = await pinnedReceipt(v1, 'v1-only-raw.json'); evaluateV1(stream.raw);
  const v1Before = await pinnedReceipt(v1, 'v1-only-before.json'), v1After = await pinnedReceipt(v1, 'v1-only-after.json');
  assert.deepEqual(evaluateV1Ledger(v1Before.raw, v1After.raw), v1.financial);
  const installed = await pinnedReceipt(v1, 'v1-only-prospective-install.json');
  groups.v1 = sealGroup('v1', installed.raw.manifest.qualifications[0], installed.raw.manifest.dispatchEvidence[0], {
    kind: 'actual-local-receipts', outcomesValidated: true, cleanupStatus: 'ABSENT', targetExpiresAt: v1.target.expiresAt,
    entries: [{ mode: 'v1', sha256: stream.sha256, checkedAt: stream.raw.terminalReceipts[0].capturedAt, completedAt: stream.raw.completedAt }] });
  if (includeImage) {
    const files = await actualImageFiles(), evaluated = evaluateActualImage(files);
    groups.image = sealGroup('image', evaluated.qualification, evaluated.proof, {
      kind: 'actual-local-receipts', outcomesValidated: true, cleanupStatus: 'ABSENT', targetExpiresAt: files.summary.target.expiresAt,
      entries: [{ mode: 'image', sha256: sha(files.success), checkedAt: evaluated.checkedAt, completedAt: evaluated.completedAt }], image: evaluated.image });
  }
  for (const [id, group] of Object.entries(groups)) validateGroup(group, base.groups[id], Date.now(), false);
  return { groups, missing: includeImage ? [] : ['image'], imageModel: IMAGE_MODEL, imageBound: IMAGE_BOUND };
}

/** Stage the exact actual-data root for the pending coherent code review; this performs no deployment or selector update. */
export async function releaseCandidate() {
  const review = await evidenceReview(), base = await baseline(), actual = await availableActualGroups(base);
  const candidate = assemble(base, actual.groups); assert.equal(candidate.syntheticInputs, false);
  const manifest = clone(candidate.manifest);
  Object.assign(manifest, { manifestId: 'cortex-gateway-agent-defaults-2026-10-08', classification: 'reviewed-actual', acceptanceHash: EVIDENCE_REVIEW_SHA256,
    artifactRevision: sha({ observedBackendManifest: base.inputs.backendManifestSha256, evidenceHash: manifest.evidenceHash,
      scope: 'finite-material-equivalence-plus-new-release-registry-data' }) });
  const observations = { evidenceReviewSha256: EVIDENCE_REVIEW_SHA256, evidenceReviewScope: review.scope,
    finalCoherentCodeReviewRepresentedByAcceptanceHash: false,
    sourceEquivalenceScope: '18 material sources and19 native files; exact append-only V19 registry is a newly reviewed trust addition, not whole artifact identity',
    observedBackendManifestSha256: base.inputs.backendManifestSha256,
    historicalRoots: base.inputs.historicalRoots,
    groups: Object.values(actual.groups).map(group => ({ id: group.id, checkedAt: group.proof.checkedAt, expiresAt: group.proof.expiresAt,
      evidenceHash: group.proof.evidenceHash, entries: group.evidence.entries })),
    v1: { streamObserved: true, generationSeparatelyObserved: false, toolEffectsExecuted: false },
    image: { modelId: IMAGE_MODEL, boundRevision: IMAGE_BOUND, ...actual.groups.image.evidence.image },
    originalImageUpstreamOutcome: 'UNKNOWN', actualUsdSettlementClaim: false, possibleLiabilityUnits: 4800000, issuedAttempts: 10 };
  return { manifest, observations, resolver: verifyCandidate(candidate, base), codeReview: 'PENDING', deployed: false, ciSelectorsChanged: false };
}

export async function main() {
  const base = await baseline(), actual = await availableActualGroups(base), inventory = descriptorInventory(base);
  return { status: 'ACTUAL_NINE_METHODS_VALIDATED_PENDING_COHERENT_REVIEW', actualPassingMethods: 9, availableActualGroups: Object.keys(actual.groups),
    missingGroups: actual.missing, requiredSupportedV16Aliases: inventory.required.filter(row => row.group).length,
    historicalRootsUnchanged: base.roots.map(root => ({ revision: root.revision, sha256: sha(root) })),
    prospectiveImageModel: IMAGE_MODEL, prospectiveImageBound: IMAGE_BOUND, retiredModelRenewed: false,
    materialSourcesMatched: base.inputs.finiteSources.length, nativeFilesMatched: base.inputs.native.length,
    reviewedActualManifestCreated: false, candidateManifestCreated: false, serviceCalls: 0, productEdits: 0 };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
