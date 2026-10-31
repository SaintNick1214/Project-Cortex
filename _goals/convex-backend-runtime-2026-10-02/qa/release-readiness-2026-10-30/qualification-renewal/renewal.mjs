/** Prospective operator-only renewal. Default execution is strictly offline. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CANDIDATE = path.resolve(HERE, '../../../../..');
export const ENGINE = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env';
export const KIT = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-memory-effort-native-recall-2026-10-15';
export const OLD_COMMIT = 'd4ba7faacf8af17c1c43d2d6c37bab47f45ba32f';
export const PRIVATE_RUN_ROOT = '/Users/SaintNick/.codex/tmp/cortex-release-qualification-20261031';
export const STAGING = path.join(KIT, 'staging', OLD_COMMIT);
export const PROCEDURE_SHA = 'b9dae67dc95cb6e86bd7ad7ee00e8a948438250ee1383aab845c7a800092698c';
const MANIFEST_SHA = '327e297e95948f127f51fa0d79fb6afb7a0281cf99066264a2ec75e3e57f737c';
const V1_BOUND = 'agent-tools-32768-512-v1';
const V1_REGISTRY = 'cortex-memory-tools-v1';
const requireCandidate = createRequire(path.join(CANDIDATE, 'package.json'));
const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const engine = async name => import(pathToFileURL(path.join(ENGINE, name + '.mjs')));
const finiteSources = [
  'convex-dev/runtimeGateway.ts', 'convex-dev/runtimeGatewayBackend.ts', 'convex-dev/runtimeModelPolicy.ts',
  'convex-dev/runtimeModelPolicyBootstrap.ts', 'convex-dev/runtimeGatewayQualifications.ts',
  'convex-dev/runtimeGatewayMediaQualifications.ts', 'convex-dev/runtimeMemoryGateway.ts', 'convex-dev/runtimeMediaGateway.ts',
  'src/domain/model-policy.ts', 'src/domain/agent-tools.ts', 'src/domain/agent-language.ts', 'src/domain/profile.ts',
  'src/domain/extraction.ts', 'src/domain/conflicts.ts', 'src/domain/media-schemas.ts', 'src/domain/assets.ts',
  'src/common/crypto.ts', 'convex-dev/runtimeContentGateway.ts',
];

/** Read trusted local declarations in memory; no copied tree, emitted files, or service imports. */
export function contracts() {
  const ts = requireCandidate('typescript');
  const allowed = new Set([
    'convex-dev/runtimeGatewayQualifications.ts', 'convex-dev/runtimeGatewayMediaQualifications.ts',
    'src/domain/model-policy.ts', 'src/domain/profile.ts', 'src/domain/assets.ts',
    'src/domain/media-schemas.ts', 'src/domain/extraction.ts', 'src/domain/agent-tools.ts',
  ].map(file => path.join(CANDIDATE, file)));
  const cache = new Map();
  function load(file) {
    assert.ok(allowed.has(file), 'Unexpected runtime import during offline contract inspection: ' + file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: file,
    }).outputText;
    const localRequire = name => {
      if (!name.startsWith('.')) { assert.ok(['zod', 'fast-sha256'].includes(name)); return requireCandidate(name); }
      const target = path.resolve(path.dirname(file), name.replace(/\.js$/, '') + '.ts');
      return load(target);
    };
    // Only the enumerated, byte-verified repository declarations execute here.
    new Function('require', 'exports', 'module', code)(localRequire, module.exports, module);
    return module.exports;
  }
  const old = load(path.join(CANDIDATE, 'convex-dev/runtimeGatewayQualifications.ts'));
  const media = load(path.join(CANDIDATE, 'convex-dev/runtimeGatewayMediaQualifications.ts'));
  return { old, media, domain: load(path.join(CANDIDATE, 'src/domain/model-policy.ts')),
    tools: load(path.join(CANDIDATE, 'src/domain/agent-tools.ts')) };
}

async function nativeInputs() {
  const rows = [], oldRequire = createRequire(path.join(STAGING, 'package.json'));
  const add = async (role, current, previous, hostRelative) => {
    const raw = await fs.readFile(current), old = await fs.readFile(previous);
    assert.equal(sha(raw), sha(old), 'Native bytes differ: ' + role);
    rows.push({ role, candidatePath: path.relative(CANDIDATE, current),
      kitPath: path.relative(STAGING, previous), installedHostPath: 'node_modules/' + hostRelative,
      bytes: raw.length, sha256: sha(raw) });
  };
  for (const [name, files] of [
    ['@convex-dev/ai-sdk-provider', ['package.json', 'src/index.ts', 'dist/esm/index.js', 'dist/commonjs/index.js']],
    ['@ai-sdk/openai-compatible', ['package.json', 'dist/index.js', 'src/chat/openai-compatible-chat-language-model.ts',
      'src/chat/convert-to-openai-compatible-chat-messages.ts', 'src/embedding/openai-compatible-embedding-model.ts', 'src/image/openai-compatible-image-model.ts']],
    ['ai', ['package.json', 'dist/index.js', 'dist/internal/index.js']],
  ]) {
    const current = path.dirname(requireCandidate.resolve(name + '/package.json'));
    const previous = path.dirname(oldRequire.resolve(name + '/package.json'));
    for (const file of files) await add(name + '/' + file, path.join(current, file), path.join(previous, file), name + '/' + file);
  }
  for (const consumer of ['@ai-sdk/openai-compatible', 'ai']) {
    const cr = createRequire(requireCandidate.resolve(consumer + '/package.json'));
    const pr = createRequire(oldRequire.resolve(consumer + '/package.json'));
    const current = path.dirname(cr.resolve('@ai-sdk/provider-utils/package.json'));
    const previous = path.dirname(pr.resolve('@ai-sdk/provider-utils/package.json'));
    for (const file of ['package.json', 'dist/index.js', 'src/post-to-api.ts']) {
      await add(consumer + ' actual provider-utils/' + file, path.join(current, file), path.join(previous, file),
        consumer + '/node_modules/@ai-sdk/provider-utils/' + file);
    }
  }
  return rows;
}

/** Material request inputs, exact approved engine, and scoped byte equivalence. No network. */
export async function inspectInputs() {
  const { verifyProcedure } = await engine('qualification');
  const approval = await verifyProcedure(); assert.equal(approval.digest, PROCEDURE_SHA);
  const raw = await fs.readFile(path.join(STAGING, 'dist/backend/v1/manifest.json'));
  assert.equal(sha(raw), MANIFEST_SHA);
  const manifest = JSON.parse(raw), mismatches = [], sources = [];
  assert.equal(manifest.files.length, 174);
  for (const row of manifest.files) {
    assert.equal(sha(await fs.readFile(path.join(STAGING, 'dist/backend/v1', row.path))), row.sha256);
    const current = await fs.readFile(path.join(CANDIDATE, row.sourcePath));
    if (sha(current) !== row.sourceSha256) mismatches.push({ path: row.sourcePath, oldSha256: row.sourceSha256, currentSha256: sha(current) });
    if (finiteSources.includes(row.sourcePath)) {
      assert.equal(sha(current), row.sourceSha256, 'Material qualification source changed: ' + row.sourcePath);
      sources.push({ candidatePath: row.sourcePath, sha256: sha(current), bytes: current.length,
        backendPath: row.path, backendSha256: row.sha256 });
    }
  }
  assert.equal(sources.length, finiteSources.length);
  assert.deepEqual(mismatches.map(row => row.path), ['src/common/userExportSupport.ts']);
  const config = await json(path.join(ENGINE, 'cloud-config.json'));
  assert.deepEqual(config, { teamId: 325340, projectId: 3200658, projectSlug: 'cortex-sandboxes', requestedRegion: 'aws-us-east-1' });
  const lock = await json(path.join(ENGINE, 'templates/native-package-lock.json'));
  const rootHelper = lock.packages['node_modules/@ai-sdk/provider-utils'].version;
  assert.equal(rootHelper, '5.0.59');
  const { old, media, domain, tools } = contracts();
  const baseline = media.OBSERVED_GATEWAY_POLICY_MANIFEST_V16;
  const v1 = old.AGENT_GATEWAY_POLICY_MANIFEST_V5.qualifications.find(row => row.boundRevision === V1_BOUND);
  const proof = old.AGENT_GATEWAY_POLICY_MANIFEST_V5.dispatchEvidence.find(row => row.boundRevision === V1_BOUND);
  assert.equal(v1.costBound.maximumCostUnits, 100000); assert.equal(v1.limits.runBudgetUnits, 2000000);
  assert.equal(proof.toolContract.registryVersion, V1_REGISTRY);
  assert.equal(proof.toolContract.toolsCanonical, domain.canonicalModelJson(tools.AGENT_NATIVE_TOOLS));
  const native = await nativeInputs();
  const sourceInputs = { version: 1, procedureApprovalSha256: approval.digest, kitSourceCommit: OLD_COMMIT,
    backendManifestSha256: MANIFEST_SHA, outputFilesVerified: manifest.files.length,
    currentSourcesMatching: manifest.files.length - mismatches.length, mismatches, finiteSources: sources, native,
    caveat: 'Source equivalence for these request paths only; the SDK archive and all dependency pins are not identical.',
    unusedRootHelperDiscrepancy: { oldNativeLock: rootHelper,
      candidateRoot: requireCandidate('@ai-sdk/provider-utils/package.json').version,
      actualConsumerHelpers: ['openai-compatible:5.0.12', 'ai:5.0.53'],
      treatment: 'Pin the actual consumer-resolved compiled/helper bytes; do not use the unused root source pin as equivalence evidence.' },
    historicalRoots: [old.TEXT_GATEWAY_POLICY_MANIFEST_V3, old.AGENT_GATEWAY_POLICY_MANIFEST_V5, old.DEFAULT_GATEWAY_POLICY_MANIFEST,
      media.OBSERVED_GATEWAY_POLICY_MANIFEST_V14, media.OBSERVED_GATEWAY_POLICY_MANIFEST_V15, baseline,
      media.OBSERVED_GATEWAY_POLICY_MANIFEST_V17, media.OBSERVED_GATEWAY_POLICY_MANIFEST_V18]
      .map(row => ({ manifestId: row.manifestId, revision: row.revision, sha256: sha(row) })),
    baselinePolicies: baseline.policies, baselineQualifications: baseline.qualifications,
    baselineDispatchEvidence: baseline.dispatchEvidence,
    supplemental: { boundRevision: V1_BOUND, registryVersion: V1_REGISTRY, qualification: v1, dispatchEvidence: proof,
      maximumPaidRequests: 1, maximumUnknownLiabilityUnits: v1.costBound.maximumCostUnits, automaticPaidRetries: 0 },
    totalMaximumPaidRequests: approval.maximumPaidRequests + 1,
    totalMaximumUnknownLiabilityUnits: approval.maximumUnknownLiabilityUnits + v1.costBound.maximumCostUnits,
  };
  assert.equal(sourceInputs.totalMaximumUnknownLiabilityUnits, 2800000);
  return sourceInputs;
}

export async function verifyInputs() {
  const expected = await json(path.join(HERE, 'source-inputs.json'));
  const actual = await inspectInputs();
  assert.deepEqual(actual, expected, 'Reviewed source inputs drifted; stop before resource creation or paid calls');
  return actual;
}

/** Finite descriptor mapping only. Fake receipt IDs exercise the pure resolver, never attest observations. */
export async function prospectiveDescriptorCoverage(inputs) {
  const template = await json(path.join(ENGINE, 'templates/qualification-envelopes.json'));
  const { domain } = contracts(), rows = [];
  const scope = { tenantId: 'offline', memorySpaceId: 'offline', principalId: 'offline', principalVersion: 1,
    membershipId: 'offline', membershipVersion: 1, grantId: 'offline', grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
  for (const original of inputs.baselineQualifications) {
    const oldProof = inputs.baselineDispatchEvidence.find(row => row.receiptId === original.receiptId);
    const wantedEnvelope = original.nativeInterface === 'embedding' && original.modelId.endsWith('-small')
      ? 'default-embedding-v1' : oldProof.inputBound.featureEnvelope;
    const index = template.qualifications.findIndex((row, at) => row.modelId === original.modelId
      && row.nativeInterface === original.nativeInterface && template.dispatchEvidence[at].inputBound.featureEnvelope === wantedEnvelope);
    const fresh = wantedEnvelope === 'agent-tools-chat-v1' ? inputs.supplemental.qualification : template.qualifications[index];
    const freshProof = wantedEnvelope === 'agent-tools-chat-v1' ? inputs.supplemental.dispatchEvidence : template.dispatchEvidence[index];
    assert.ok(fresh && freshProof, 'Missing prospective fresh group for reachable old descriptor: ' + original.boundRevision);
    assert.deepEqual(fresh.allowedOptions, original.allowedOptions); assert.deepEqual(fresh.capabilities, original.capabilities);
    for (const key of ['inputTokens', 'contextTokens', 'outputTokens', 'toolSteps', 'timeoutMs']) {
      assert.ok(fresh.limits[key] >= original.limits[key], 'Fresh descriptor shrinks supported ' + key + ': ' + original.boundRevision);
    }
    assert.equal(fresh.costBound.maximumCostUnits, original.costBound.maximumCostUnits);
    for (const key of ['toolContract', 'mediaContract', 'embeddingProfile', 'terminalModelId', 'supportsStream']) {
      assert.deepEqual(freshProof[key], oldProof[key], 'Prospective native feature mapping differs: ' + key);
    }
    assert.ok(freshProof.resultBound.maximumOutputTokens >= oldProof.resultBound.maximumOutputTokens);
    assert.ok(freshProof.resultBound.maximumPrivateResultBytes >= oldProof.resultBound.maximumPrivateResultBytes);
    const alias = { ...structuredClone(original), receiptId: 'OFFLINE-NOT-A-PROOF-' + rows.length,
      priceRevision: 'offline-not-current-prices' };
    const policy = structuredClone(inputs.baselinePolicies.find(row => !row.operationKey));
    Object.assign(policy.rules, { modelId: original.modelId, nativeInterface: original.nativeInterface,
      allowedModels: [original.modelId], interfaces: [original.nativeInterface], capabilities: [...original.capabilities],
      allowedTools: oldProof.toolContract ? JSON.parse(oldProof.toolContract.toolsCanonical).map(row => row.name) : [],
      allowedOptions: [...original.allowedOptions], fallbackModels: [], limits: { ...original.limits } });
    Object.assign(policy.rules.pins, { boundRevision: original.boundRevision, priceRevision: original.priceRevision,
      toolRegistryVersion: oldProof.toolContract?.registryVersion ?? 'none-v1' });
    const operationKey = original.nativeInterface === 'embedding' ? 'embedding.query' : original.nativeInterface === 'image'
      ? 'media.image.generate' : original.capabilities.includes('tools') ? 'agent.respond' : 'artifact.text';
    const resolve = (qualification, policies) => domain.resolveModelPolicy({ context: { scope, operationKey,
      runBudgetId: 'offline-not-service-proof', authorizedOverrides: [] }, policies, qualifications: [qualification] });
    const oldSnapshot = resolve(original, [policy]);
    const aliasPolicy = structuredClone(policy); aliasPolicy.rules.pins.priceRevision = alias.priceRevision;
    const mappedSnapshot = resolve(alias, [aliasPolicy]);
    // Price and receipt identity intentionally renew; all supported selector/limit values stay exact.
    assert.deepEqual({ ...mappedSnapshot, qualificationReceiptId: oldSnapshot.qualificationReceiptId,
      pins: { ...mappedSnapshot.pins, priceRevision: oldSnapshot.pins.priceRevision } }, oldSnapshot);
    rows.push({ modelId: original.modelId, nativeInterface: original.nativeInterface,
      preservedBoundAlias: original.boundRevision, prospectiveFreshGroup: fresh.boundRevision, operationKey,
      oldEnvelope: oldProof.inputBound.featureEnvelope, freshEnvelope: wantedEnvelope,
      preservedLimits: original.limits, preservedOptions: original.allowedOptions,
      pureResolverEquivalent: true, actualRenewalObserved: false });
  }
  return { status: 'PROSPECTIVE_DESCRIPTOR_MAPPING_ONLY', descriptorRows: rows,
    noQualifiedJsonObjectDescriptorInV16: !inputs.baselineDispatchEvidence.some(row => row.inputBound.featureEnvelope === 'memory-extract-json-object-v1'),
    strictJsonIsAdditionalFreshGroup: true, freshProofGroupsAfterV1: 8, maximumNewPaidRequests: 9,
    note: 'Aliases must bind real fresh evidence with original limits, old roots retained. No dates or receipts are renewed by this comparison.' };
}

export function prospectiveV1(inputs, session, reference, prices, reviewSha256) {
  assert.match(reviewSha256, /^[a-f0-9]{64}$/);
  const qualification = structuredClone(inputs.supplemental.qualification);
  const proof = structuredClone(inputs.supplemental.dispatchEvidence);
  const quote = prices.models.find(row => row.modelId === qualification.modelId);
  assert.ok(quote && Number.isSafeInteger(prices.observedAt) && Date.now() - prices.observedAt <= 3600000 && prices.observedAt <= Date.now());
  assert.ok(Number.isFinite(quote.prompt) && quote.prompt >= 0 && Number.isFinite(quote.completion) && quote.completion >= 0);
  const fullUnits = (qualification.limits.inputTokens * quote.prompt + qualification.limits.outputTokens * quote.completion) * 1000000;
  assert.ok(fullUnits <= qualification.costBound.maximumCostUnits, 'Current price exceeds unchanged V1 UNKNOWN ceiling');
  const now = Date.now(), receiptId = 'PROSPECTIVE-V1-' + session.id, priceRevision = 'renewal-v1-prices-' + session.id;
  const evidenceHash = sha({ prospectiveOnly: true, sessionId: session.id, reviewSha256, priceSha256: sha(prices),
    probeSha256: inputs.supplementalProbeSha256, materialSources: inputs.finiteSources, native: inputs.native });
  Object.assign(qualification, { receiptId, priceRevision });
  qualification.costBound.provenance = `Prospective V1 only; review=${reviewSha256}; full UNKNOWN100000; retries0; actual pending.`;
  Object.assign(proof, { receiptId, evidenceHash, priceRevision, checkedAt: now, expiresAt: Math.min(now + 3600000, session.target.expiresAt) });
  proof.inputBound.proofHash = evidenceHash; proof.inputBound.documentHash = sha(prices);
  proof.inputBound.nativeTransformHash = sha(inputs.native); proof.resultBound.proofHash = evidenceHash;
  const base = structuredClone(contracts().old.AGENT_GATEWAY_POLICY_MANIFEST_V5.policies[0]);
  base.policyId = 'renewal-v1-only-' + session.id; base.version = 3;
  Object.assign(base.rules, { modelId: qualification.modelId, nativeInterface: 'chat', allowedModels: [qualification.modelId],
    interfaces: ['chat'], capabilities: ['text', 'tools'], allowedTools: ['memory_recall', 'memory_remember'], fallbackModels: [] });
  base.rules.limits = structuredClone(qualification.limits);
  base.rules.pins.priceRevision = priceRevision; base.rules.pins.boundRevision = V1_BOUND; base.rules.pins.toolRegistryVersion = V1_REGISTRY;
  assert.equal(base.rules.limits.runBudgetUnits, 2000000);
  return { manifestId: 'renewal-v1-' + session.id, revision: 3, artifactRevision: inputs.backendManifestSha256,
    evidenceHash, acceptanceHash: reviewSha256, classification: 'fixture-synthetic', budgetWindowMs: 86400000,
    policies: [base], qualifications: [qualification], dispatchEvidence: [proof], reference };
}

export function evaluateV1(raw) {
  assert.equal(raw.error, null); assert.equal(raw.completionError, null); assert.equal(raw.replay, false);
  assert.equal(raw.modelId, 'openai/gpt-4o-mini'); assert.equal(raw.registryVersion, V1_REGISTRY);
  assert.equal(raw.boundRevision, V1_BOUND); assert.equal(raw.readerDone, true); assert.equal(raw.readerLockReleased, true);
  assert.ok(Number.isSafeInteger(raw.checkedAt) && raw.checkedAt <= raw.completedAt && raw.completedAt <= Date.now());
  assert.equal(raw.terminalReceipts.length, 1);
  const terminal = raw.terminalReceipts[0];
  assert.ok(terminal.capturedAt >= raw.checkedAt && terminal.capturedAt <= raw.completedAt);
  assert.equal(terminal.receipt.modelId, raw.modelId); assert.equal(terminal.receipt.actualModel, raw.modelId);
  assert.equal(terminal.receipt.nativeInterface, 'chat'); assert.equal(terminal.receipt.outcome, 'confirmed');
  assert.equal(terminal.receipt.proof, 'provider-terminal-v1'); assert.equal(terminal.receipt.costSource, 'unavailable');
  const admitted = raw.admissions; assert.equal(admitted.length, 1); assert.equal(admitted[0].status, 'reserved');
  assert.equal(admitted[0].registryVersion, V1_REGISTRY); assert.equal(admitted[0].boundRevision, V1_BOUND);
  assert.equal(admitted[0].reservationUnits, 100000); assert.equal(admitted[0].outputTokens, 512);
  assert.ok(admitted[0].inputTokens > 0 && admitted[0].inputTokens <= 32768); assert.match(admitted[0].requestHash, /^[a-f0-9]{64}$/);
  const { domain, tools } = contracts();
  assert.equal(admitted[0].toolsCanonical, domain.canonicalModelJson(tools.AGENT_NATIVE_TOOLS.map(tool => ({
    name: tool.name, definition: { description: tool.description, inputSchema: tool.inputSchema },
  }))));
  for (const [key, cap] of [['inputTokens', admitted[0].inputTokens], ['outputTokens', 512]]) {
    assert.ok(Number.isSafeInteger(terminal.receipt.usage[key]) && terminal.receipt.usage[key] >= 0 && terminal.receipt.usage[key] <= cap);
  }
  const calls = raw.parts.filter(row => row.type === 'tool-call'); assert.equal(calls.length, 1);
  assert.equal(calls[0].toolName, 'memory_recall');
  const args = typeof calls[0].input === 'string' ? JSON.parse(calls[0].input) : calls[0].input;
  assert.deepEqual(args, { text: 'jasmine tea', limit: 1 });
  assert.equal(raw.parts.filter(row => row.type === 'finish').length, 1);
}

export function evaluateV1Ledger(before, after) {
  assert.equal(before.attempts.length, 8); assert.equal(after.attempts.length, 9);
  assert.equal(before.operations.length, 8); assert.equal(after.operations.length, 9);
  const added = after.attempts.filter(row => !before.attempts.some(prior => prior._id === row._id)); assert.equal(added.length, 1);
  const attempt = added[0];
  assert.equal(attempt.state, 'uncertain'); assert.equal(attempt.reservationUnits, 100000); assert.equal(attempt.ordinal, 0);
  assert.equal(attempt.slotReleased, true); assert.ok(!attempt.resultWithheld); assert.match(attempt.dispatchIdentity, /^[a-f0-9]{64}$/);
  assert.equal(after.attempts.reduce((sum, row) => sum + row.reservationUnits, 0), 2800000);
  for (const key of ['attempts', 'operations', 'accounts']) for (const prior of before[key]) {
    assert.deepEqual(after[key].find(row => row._id === prior._id), prior, 'Original eight-call ' + key + ' changed');
  }
  assert.equal(new Set(after.attempts.map(row => row.dispatchIdentity)).size, 9);
  assert.equal(new Set(after.attempts.map(row => row.operationDocumentId)).size, 9);
  const accounts = after.accounts.filter(row => !before.accounts.some(prior => prior._id === row._id));
  assert.equal(accounts.length, 2);
  assert.ok(accounts.every(row => row.activeConcurrency === 0 && row.reservedUnits === 0 && row.settledUnits === 0 && row.uncertainUnits === 100000));
  assert.equal(accounts.find(row => row.kind === 'run').limitUnits, 2000000);
  assert.equal(accounts.find(row => row.kind === 'tenant').limitUnits, 10000000);
  return { actualSupplementalDispatches: 1, actualTotalDispatches: 9, totalUnknownLiabilityUnits: 2800000,
    originalEightRowsUnchanged: true, activeConcurrency: 0, aggregateUsdComplete: false };
}

const replaceOnce = (source, before, after) => {
  assert.equal(source.split(before).length, 2, 'Compiled disposable bootstrap shape drifted'); return source.replace(before, after);
};

async function supplemental(session, ctx, inputs, reviewSha256) {
  const cloud = await engine('cloud'); await cloud.verifyCloud(session, ctx);
  const key = await cloud.getDeployKey(session, ctx);
  const requireHost = createRequire(path.join(session.backendDir, 'package.json'));
  for (const row of inputs.native) assert.equal(sha(await fs.readFile(path.join(session.backendDir, row.installedHostPath))), row.sha256,
    'Installed actual native input differs: ' + row.role);
  const { ConvexHttpClient } = requireHost('convex/browser');
  const client = new ConvexHttpClient(session.target.deploymentUrl, { logger: false, fetch: async (url, options) => {
    ctx.signal?.throwIfAborted(); await cloud.verifyCloud(session, ctx);
    return ctx.fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([
      AbortSignal.timeout(90000), ...(ctx.signal ? [ctx.signal] : []), ...(options?.signal ? [options.signal] : []),
    ]) });
  } });
  client.setAdminAuth(key);
  const reference = (await json(path.join(session.issuerDir, 'manual-authorities.json'))).owner;
  assert.equal(reference.tenantId, 'sandbox-' + session.id); assert.equal(reference.memorySpaceId, 'manual-workspace');
  const prices = await json(path.join(session.receiptDir, 'current-primary-pricing.json'));
  const augmented = { ...inputs, supplementalProbeSha256: sha(await fs.readFile(path.join(HERE, 'supplemental-v1-probe.ts'))) };
  const { reference: ignoredReference, ...manifest } = prospectiveV1(augmented, session, reference, prices, reviewSha256);
  assert.deepEqual(ignoredReference, reference);
  const functions = path.join(session.backendDir, 'convex');
  const original = await fs.readFile(path.join(functions, 'runtimeModelPolicyBootstrap.ts'), 'utf8');
  const originalHash = sha(original);
  const declaration = 'import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";\n'
    + 'export const SUPPLEMENTAL_V1_MANIFEST = ' + JSON.stringify(manifest) + ' as const satisfies DeploymentPolicyManifest;\n';
  const bootstrap = 'import { SUPPLEMENTAL_V1_MANIFEST } from "./renewalV1Manifest";\n' + replaceOnce(replaceOnce(original,
    ', MANUAL_GATEWAY_QUALIFICATION])', ', MANUAL_GATEWAY_QUALIFICATION, SUPPLEMENTAL_V1_MANIFEST])'),
    'manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest)',
    '(manifest === SUPPLEMENTAL_V1_MANIFEST || manifest.classification === "reviewed-actual") && manifests.some((entry) => entry === manifest)');
  const probe = await fs.readFile(path.join(HERE, 'supplemental-v1-probe.ts'));
  const scope = 'export const V1_REFERENCE = ' + JSON.stringify(reference) + ' as const;\n'
    + 'export const V1_OPERATION = ' + JSON.stringify(manifest.manifestId) + ';\n';
  const { privateWrite } = cloud;
  await privateWrite(path.join(session.receiptDir, 'v1-bootstrap-original.ts'), original, { exclusive: true });
  for (const [name, value] of [['renewalV1Manifest.ts', declaration], ['renewalV1Scope.ts', scope], ['renewalV1Probe.ts', probe]]) {
    await privateWrite(path.join(functions, name), value, { exclusive: true });
  }
  await privateWrite(path.join(functions, 'runtimeModelPolicyBootstrap.ts'), bootstrap);
  const deploy = name => ctx.command(name, ctx.node, [path.join(session.backendDir, 'node_modules/convex/bin/main.js'),
    'dev', '--once', '--typecheck', 'enable', '--codegen', 'enable', '--tail-logs', 'disable'], {
    cwd: session.backendDir, env: { CONVEX_DEPLOY_KEY: key, CONVEX_DEPLOYMENT: 'dev:' + session.target.name }, timeoutMs: 180000,
  });
  await cloud.verifyCloud(session, ctx); await deploy('v1-internal-commission-deploy');
  const installed = await client.mutation('runtimeModelPolicy:installDeploymentPolicy', { manifestId: manifest.manifestId, expectedRevision: 3 });
  assert.equal(installed.manifestId, manifest.manifestId); assert.equal(installed.revision, 3);
  await ctx.receipt('v1-prospective-install', { manifest, installed, originalBootstrapSha256: originalHash,
    fixtureOnlyInExactOwnedDisposableHost: true, actualEvidencePending: true, freshReviewSha256: reviewSha256 });
  const before = await client.query('renewalV1Probe:snapshot', {}); await ctx.receipt('v1-before', before);
  assert.equal(before.attempts.length, 8);
  assert.equal(before.attempts.reduce((sum, row) => sum + row.reservationUnits, 0), 2700000);
  await verifyInputs(); ctx.signal?.throwIfAborted(); await cloud.verifyCloud(session, ctx);
  assert.equal(sha(await fs.readFile(path.join(functions, 'renewalV1Probe.ts'))), sha(probe));
  await privateWrite(path.join(session.receiptDir, 'issued-supplemental-v1.json'), {
    issuedAt: Date.now(), target: session.target, maximumPaidRequests: 1, maximumUnknownLiabilityUnits: 100000,
    automaticPaidRetries: 0, reviewSha256, probeSha256: sha(probe), prospectiveManifestSha256: sha(manifest),
  }, { exclusive: true });
  try {
    const raw = await client.action('renewalV1Probe:observe', {});
    await ctx.receipt('v1-raw', raw); evaluateV1(raw);
    const after = await client.query('renewalV1Probe:snapshot', {}); await ctx.receipt('v1-after', after);
    const financial = evaluateV1Ledger(before, after);
    await ctx.receipt('v1-outcome', { status: 'ACTUAL_V1_STREAM_OUTCOME_OBSERVED', financial,
      checkedAt: raw.terminalReceipts[0].capturedAt, completedAt: raw.completedAt,
      freshReviewSha256: reviewSha256, prospectiveManifest19: true, productionAcceptance: false,
      streamingObserved: true, generationNotSeparatelyObserved: true, noToolEffectExecuted: true });
    return { financial, manifest, checkedAt: raw.terminalReceipts[0].capturedAt };
  } catch (error) {
    let ledger; try { ledger = await client.query('renewalV1Probe:snapshot', {}); } catch { ledger = { readUnavailable: true }; }
    const { qualificationFailureDiagnostic } = await engine('qualification');
    await ctx.receipt('v1-failure', { status: 'FAIL_OR_UNKNOWN_NO_RETRY', ledger, diagnostic: qualificationFailureDiagnostic(error),
      fullUnknownLiabilityUnitsRetained: 100000, billableIdentityMayHaveDispatched: true, automaticPaidRetries: 0 });
    // eslint-disable-next-line preserve-caught-error -- Remote error text stays out of the operator exception; safe diagnostic metadata is retained above.
    throw Error('Supplemental V1 failed or is UNKNOWN; no automatic paid retry. Receipts retained.');
  }
}

/** Cleanup is in a new uncanceled context after all setup work has settled. */
export async function runRenewal({ signal, reviewSha256, services, logger = () => {}, sessionRoot = PRIVATE_RUN_ROOT } = {}) {
  assert.match(reviewSha256 ?? '', /^[a-f0-9]{64}$/, 'Independent prospective review digest required before execution');
  const inputs = await verifyInputs();
  const runner = await engine('runner');
  const svc = services ?? { ...(await engine('cloud')), ...(await engine('runtime')), supplemental };
  // Only injected offline test services may redirect sessions; the CLI has no such option.
  assert.ok(services || sessionRoot === PRIVATE_RUN_ROOT);
  await fs.mkdir(sessionRoot, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const privateRoot = await fs.lstat(sessionRoot);
  assert.ok(privateRoot.isDirectory() && !privateRoot.isSymbolicLink() && privateRoot.uid === process.getuid() && (privateRoot.mode & 0o777) === 0o700);
  const session = await runner.newSession(sessionRoot, 'qualification-renewal');
  const ctx = await runner.createContext(session, { signal, logger });
  let outcome, failure;
  try {
    await runner.sessionActionLock(session, async () => {
      signal?.throwIfAborted();
      session.phase = 'CREATING'; await ctx.persist();
      await svc.createCloud(session, ctx); await svc.verifyCloud(session, ctx);
      session.phase = 'QUALIFYING_EIGHT'; await ctx.persist();
      await svc.provisionRuntime(session, ctx);
      session.phase = 'QUALIFYING_V1'; await ctx.persist();
      outcome = await svc.supplemental(session, ctx, inputs, reviewSha256);
      await ctx.receipt('renewal-outcome', { status: 'ACTUAL_OBSERVATIONS_PENDING_INDEPENDENT_MANIFEST_REVIEW',
        totalMaximumPaidRequests: 9, totalMaximumUnknownLiabilityUnits: 2800000, outcome,
        historicalRootsPreserved: true, rootSourceChanged: false, manifest19Activated: false });
    });
  } catch (error) {
    failure = error;
    const { qualificationFailureDiagnostic } = await engine('qualification');
    await ctx.receipt('renewal-failure', { status: 'FAILED_OR_UNKNOWN', diagnostic: qualificationFailureDiagnostic(error),
      automaticPaidRetries: 0, retainOriginalAndUnknownReceipts: true }).catch(() => {});
  } finally {
    // Stop any original-context child before exact-session deletion. Cleanup has no setup abort signal.
    try { await ctx.stopChildren(); } catch (error) { failure ??= error; }
    const cleanupCtx = await runner.createContext(session, { cleanup: true, logger });
    try {
      await runner.sessionActionLock(session, () => runner.cleanupSession(session, cleanupCtx, {
        removeDocker: async current => { assert.equal(current.container, null, 'Qualification-only session cannot own a container'); },
        deleteCloud: svc.deleteCloud,
      }));
    } catch (error) { failure = failure ? new AggregateError([failure, error], 'Qualification failed and exact cleanup requires recovery') : error; }
  }
  if (failure) {
    const error = Error('Renewal failed or is UNKNOWN; inspect private retained receipts and exact-session cleanup state. Session: ' + session.id);
    error.cause = failure; error.sessionId = session.id; throw error;
  }
  return { sessionId: session.id, phase: session.phase, outcome, manifest19Activated: false };
}

async function reviewedApproval(file) {
  const raw = await fs.readFile(file), approval = JSON.parse(raw);
  assert.equal(approval.verdict, 'APPROVED'); assert.equal(approval.scope, 'prospective-release-qualification-eight-plus-one');
  assert.equal(approval.maximumPaidRequests, 9); assert.equal(approval.maximumUnknownLiabilityUnits, 2800000);
  assert.equal(approval.existingProcedureSha256, PROCEDURE_SHA);
  for (const name of ['renewal.mjs', 'supplemental-v1-probe.ts', 'source-inputs.json']) {
    assert.equal(approval.files?.[name], sha(await fs.readFile(path.join(HERE, name))), 'Review does not cover current ' + name);
  }
  return sha(raw);
}

async function main(args) {
  if (!args.length || args.length === 1 && args[0] === '--dry-run') {
    const inputs = await verifyInputs();
    const coverage = await prospectiveDescriptorCoverage(inputs);
    return { status: 'OFFLINE_PREPARATION_ONLY', networkCalls: 0, resourceCreations: 0, modelCalls: 0,
      finiteSourcesMatched: inputs.finiteSources.length, nativeFilesMatched: inputs.native.length,
      oldDescriptorMappingsChecked: coverage.descriptorRows.length,
      maximumPaidRequests: inputs.totalMaximumPaidRequests, maximumUnknownLiabilityUnits: inputs.totalMaximumUnknownLiabilityUnits,
      currentManifestOrDatesChanged: false, executionRequiresIndependentReview: true };
  }
  if (args.length === 2 && args[0] === 'cleanup') {
    const runner = await engine('runner'), cloud = await engine('cloud');
    const session = await runner.loadSession(PRIVATE_RUN_ROOT, args[1]);
    assert.equal(session.mode, 'qualification-renewal');
    const ctx = await runner.createContext(session, { cleanup: true });
    await runner.sessionActionLock(session, () => runner.cleanupSession(session, ctx, {
      removeDocker: async current => { assert.equal(current.container, null); }, deleteCloud: cloud.deleteCloud,
    }));
    return { sessionId: session.id, phase: session.phase };
  }
  if (args.length === 2 && args[0] === '--execute') {
    assert.equal(process.versions.node, '24.15.0');
    const reviewSha256 = await reviewedApproval(path.resolve(args[1]));
    const controller = new AbortController();
    const abort = () => controller.abort(Error('Operator canceled renewal'));
    process.on('SIGINT', abort); process.on('SIGTERM', abort);
    try { return await runRenewal({ signal: controller.signal, reviewSha256, logger: console.log }); }
    finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); }
  }
  throw Error('Usage: node renewal.mjs [--dry-run | --execute INDEPENDENT_REVIEW_JSON | cleanup EXACT_SESSION_UUID]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2)), error => {
    // Remote error bodies and credentials never enter the public error path.
    console.error(error.sessionId ? error.message : 'Renewal refused: local precondition or review failed.'); process.exitCode = 1;
  });
}
