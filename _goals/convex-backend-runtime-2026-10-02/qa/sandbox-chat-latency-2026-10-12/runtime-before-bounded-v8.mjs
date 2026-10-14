import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { generateKeyPairSync, createSign, createHash } from 'node:crypto';
import { verifyCloud, getDeployKey, privateWrite } from './cloud.mjs';
import { SOURCE_COMMIT as commit, CANDIDATE_PACKAGES, BACKEND_MANIFEST_SHA256 as manifestHash, BACKEND_FILE_COUNT, assertPinnedCandidate } from './docker.mjs';
import { modes, qualificationGroups, sha, json, verifyProcedure, evaluateOutcome, evaluateFinancialStep, evaluateBatch, currentPrices,
  costProvenance, loadModelPolicy, validatePolicyManifest, qualificationFailureDiagnostic } from './qualification.mjs';

const base = dirname(fileURLToPath(import.meta.url));
const archiveHash = CANDIDATE_PACKAGES.sdk.sha256;
const registry = 'Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, AGENT_GATEWAY_POLICY_MANIFEST_V5, DEFAULT_GATEWAY_POLICY_MANIFEST, OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15, OBSERVED_GATEWAY_POLICY_MANIFEST_V16, OBSERVED_GATEWAY_POLICY_MANIFEST_V17, OBSERVED_GATEWAY_POLICY_MANIFEST_V18])';
const trusted = 'manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest)';
const caps = ['read', 'write', 'run', 'admin', 'tool', 'storage:read', 'storage:write'];
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';

async function command(session, ctx, name, args, options = {}) {
  const result = await ctx.command(name, ctx.node, args, { cwd: session.backendDir, signal: ctx.signal, ...options });
  return typeof result === 'string' ? { code: 0, stdout: result, stderr: '' } : result;
}
async function deploy(session, ctx, name, key) {
  await verifyCloud(session, ctx);
  return command(session, ctx, name, [join(session.backendDir, 'node_modules/convex/bin/main.js'), 'dev', '--once',
    '--typecheck', 'enable', '--codegen', 'enable', '--tail-logs', 'disable'], {
    env: { CONVEX_DEPLOY_KEY: key, CONVEX_DEPLOYMENT: 'dev:' + session.target.name }, timeoutMs: 180000,
  });
}
function serviceClient(session, ctx) {
  const requireHost = createRequire(join(session.backendDir, 'package.json'));
  const { ConvexHttpClient } = requireHost('convex/browser');
  return new ConvexHttpClient(session.target.deploymentUrl, { logger: false, fetch: async (url, options) => {
    ctx.signal?.throwIfAborted(); await verifyCloud(session, ctx);
    const signals = [AbortSignal.timeout(90000), ...(ctx.signal ? [ctx.signal] : []), ...(options?.signal ? [options.signal] : [])];
    return (ctx.fetch ?? fetch)(url, { ...options, redirect: 'error', signal: AbortSignal.any(signals) });
  } });
}
function admin(session, ctx, key) {
  const client = serviceClient(session, ctx); client.setAdminAuth(key); return client;
}
async function jwt(session, ctx, role) {
  const identity = (await json(join(session.issuerDir, 'identities.json')))[role]; assert.ok(identity);
  const privateKey = await readFile(join(session.issuerDir, 'jwt-private.pem'), 'utf8');
  const now = Math.floor(Date.now() / 1000), expires = Math.min(now + 3600, Math.floor(identity.expiresAt / 1000));
  assert.ok(expires > now, 'The disposable grant expired');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = encode({ alg: 'RS256', typ: 'JWT', kid: 'sandbox-' + session.id }) + '.' +
    encode({ iss: identity.issuer, sub: identity.subject, aud: 'cortex-sandbox-' + session.id, iat: now, exp: expires });
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  const token = unsigned + '.' + signer.sign(privateKey).toString('base64url'); ctx.registerSecret(token); return token;
}
async function publicClient(session, ctx, role) {
  const client = serviceClient(session, ctx);
  if (role) client.setAuth(await jwt(session, ctx, role)); return client;
}
async function deny(work, code) {
  try { await work(); } catch (error) { if (code) assert.equal(error.data?.code, code); return true; }
  throw Error('Required authorization refusal did not occur');
}
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'Reviewed bootstrap shape changed; refuse source substitution');
  return source.replace(before, after);
}
async function nativePins(session) {
  const sources = ['@convex-dev/ai-sdk-provider/src/index.ts',
    '@ai-sdk/openai-compatible/src/chat/openai-compatible-chat-language-model.ts',
    '@ai-sdk/openai-compatible/src/chat/convert-to-openai-compatible-chat-messages.ts',
    '@ai-sdk/provider-utils/src/post-to-api.ts',
    '@ai-sdk/openai-compatible/src/embedding/openai-compatible-embedding-model.ts',
    '@ai-sdk/openai-compatible/src/image/openai-compatible-image-model.ts'];
  const sourcePins = [];
  for (const path of sources) { const raw = await readFile(join(session.backendDir, 'node_modules', path)); sourcePins.push({ path, sha256: sha(raw), bytes: raw.length }); }
  for (const sourcePath of ['convex/runtimeGateway.ts', 'convex/runtimeMemoryGateway.ts', 'convex/_cortex/shared/domain/model_policy.ts']) {
    const raw = await readFile(join(session.backendDir, sourcePath));
    sourcePins.push({ path: 'host/' + sourcePath, sha256: sha(raw), bytes: raw.length });
  }
  const packagePins = [];
  for (const name of ['convex', '@convex-dev/agent', '@convex-dev/ai-sdk-provider', '@ai-sdk/openai-compatible', '@ai-sdk/provider', 'ai']) {
    const raw = await readFile(join(session.backendDir, 'node_modules', name, 'package.json'));
    packagePins.push({ name, version: JSON.parse(raw).version, packageSha256: sha(raw) });
  }
  const required = { convex: '1.46.0', '@convex-dev/agent': '0.7.3', '@convex-dev/ai-sdk-provider': '0.2.1', ai: '7.0.127' };
  for (const [name, version] of Object.entries(required)) assert.equal(packagePins.find(row => row.name === name).version, version, 'Pinned native dependency changed');
  return { sourcePins, packagePins };
}

async function prepare(session, ctx, approval) {
  assertPinnedCandidate();
  assert.equal(process.versions.node, '24.15.0', 'Use the declared Node24.15.0 toolchain');
  const archive = join(ctx.kit, 'artifacts', commit, 'cortexmemory-sdk-0.39.0.tgz');
  assert.equal(sha(await readFile(archive)), archiveHash);
  const backend = join(ctx.kit, 'staging', commit, 'dist/backend/v1');
  const manifestRaw = await readFile(join(backend, 'manifest.json')); assert.equal(sha(manifestRaw), manifestHash);
  const distribution = JSON.parse(manifestRaw); assert.equal(distribution.files.length, BACKEND_FILE_COUNT);
  for (const file of distribution.files) assert.equal(sha(await readFile(join(backend, file.path))), file.sha256, 'Reviewed backend output changed: ' + file.path);
  try { await access(join(session.backendDir, 'package.json')); throw Error('Runtime setup refuses a prior partial or completed host; cleanup the session and start a new one'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(session.backendDir, { recursive: true, mode: 0o700 }); await mkdir(session.issuerDir, { recursive: true, mode: 0o700 });
  const requirePrepared = createRequire(join(ctx.dependenciesDir, '..', 'package.json'));
  const lock = await json(join(base, 'templates/native-package-lock.json'));
  lock.packages[''].dependencies['@cortexmemory/sdk'] = 'file:' + archive;
  lock.packages['node_modules/@cortexmemory/sdk'].resolved = 'file:' + archive;
  lock.packages['node_modules/@cortexmemory/sdk'].integrity = 'sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64');
  for (const [name, version] of Object.entries(distribution.dependencies)) {
    if (name === 'convex') assert.equal(lock.packages[''].dependencies[name], '1.46.0');
    else assert.equal(lock.packages[''].dependencies[name], version, 'Reviewed native lock dependency mismatch');
  }
  assert.equal(lock.packages[''].devDependencies.typescript, requirePrepared('typescript/package.json').version);
  await privateWrite(join(session.backendDir, 'package.json'), { ...lock.packages[''], private: true, type: 'module',
    packageManager: 'npm@12.2.0' }, { exclusive: true });
  await privateWrite(join(session.backendDir, 'package-lock.json'), lock, { exclusive: true });
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  await privateWrite(join(session.issuerDir, 'jwt-private.pem'), pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { exclusive: true });
  const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'sandbox-' + session.id, alg: 'RS256', use: 'sig' };
  const provider = { type: 'customJwt', issuer: 'https://cortex-sandbox-' + session.id + '.invalid', applicationID: 'cortex-sandbox-' + session.id,
    algorithm: 'RS256', jwks: 'data:application/json;base64,' + Buffer.from(JSON.stringify({ keys: [jwk] })).toString('base64') };
  const identity = (role, tenantId, memorySpaceId, capabilities = caps) => ({ issuer: provider.issuer, subject: 'sandbox-' + session.id + '-' + role,
    metadataUserId: 'sandbox-' + session.id + '-' + role, actorKind: 'user', tenantId, memorySpaceId, capabilities,
    resourceAccess: 'space', expiresAt: Math.min(Date.now() + 6 * 3600000, session.target.expiresAt) });
  const identities = { commission: identity('commission', 'commission-' + session.id, 'qualification'),
    owner: identity('owner', 'sandbox-' + session.id, 'manual-workspace'),
    reader: identity('reader', 'sandbox-' + session.id, 'manual-workspace', ['read', 'storage:read']),
    outsider: identity('outsider', 'sandbox-other-' + session.id, 'other-workspace') };
  await privateWrite(join(session.issuerDir, 'identities.json'), identities, { exclusive: true });
  // Pinned toolchain embeds node and npm as adjacent package directories.
  const chosenNpm = ctx.npmCli ?? join(dirname(dirname(dirname(ctx.node))), 'npm/bin/npm-cli.js');
  assert.equal((await json(join(dirname(dirname(chosenNpm)), 'package.json'))).version, '12.2.0');
  await command(session, ctx, 'host-native-install', [chosenNpm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { timeoutMs: 300000 });
  const { setupBackend } = await import(pathToFileURL(join(ctx.kit, 'staging', commit, 'packages/cortex-cli/dist/utils/init/backend-setup.js')));
  const installation = await setupBackend({ projectPath: session.backendDir, sdkPath: join(session.backendDir, 'node_modules/@cortexmemory/sdk'), jwtProvider: provider });
  assert.equal(installation.conflicts.length, 0); await ctx.receipt('host-additive-install', installation);
  assert.equal(sha(await readFile(join(session.backendDir, 'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))), manifestHash);
  const pins = await nativePins(session);
  const prices = await currentPrices(ctx); await ctx.receipt('current-primary-pricing', prices);
  const functions = join(session.backendDir, 'convex');
  const manifest = await json(join(base, 'templates/qualification-envelopes.json'));
  const operation = 'sandbox-commission-' + session.id, now = Date.now();
  const proofHash = sha({ classification: 'PROVISIONAL_FIXED_OPERATOR_ONLY', operation, approvalDigest: approval.digest,
    backendManifest: manifestHash, prices: sha(prices), actualEvidencePending: true });
  Object.assign(manifest, { manifestId: operation, revision: 1, classification: 'fixture-synthetic', artifactRevision: manifestHash,
    evidenceHash: proofHash, acceptanceHash: sha('UNACCEPTED_FIXED_COMMISSIONING:' + proofHash) });
  const priceRevision = 'sandbox-current-prices-' + session.id;
  for (const policy of manifest.policies) { policy.policyId = session.id + '-' + policy.policyId; policy.rules.pins.priceRevision = priceRevision; }
  for (const [index, qualification] of manifest.qualifications.entries()) {
    const proof = manifest.dispatchEvidence[index], receiptId = 'PROVISIONAL-' + session.id + '-' + index;
    qualification.receiptId = receiptId; qualification.priceRevision = priceRevision;
    qualification.costBound.provenance = costProvenance('prospective', sha(prices), approval.digest, qualification.costBound.maximumCostUnits);
    Object.assign(proof, { receiptId, evidenceHash: proofHash, priceRevision, checkedAt: now - 1,
      expiresAt: Math.min(now + 6 * 3600000, session.target.expiresAt) });
    proof.inputBound.proofHash = proofHash;
    proof.inputBound.documentHash = proof.inputBound.featureEnvelope === 'memory-extract-json-object-v1'
      ? sha({ rule: 'memory-json-object-chat-utf8-v1', revision: 1,
          assumption: 'Complete closed serialized body UTF8 plus conservative cookbook framing; actual complete native usage fenced before nonstreaming delivery.',
          sources: ['https://developers.openai.com/cookbook/examples/how_to_count_tokens_with_tiktoken', 'https://developers.openai.com/api/docs/guides/structured-outputs', 'https://docs.convex.dev/ai-gateway/api'],
          procedureReviewSha256: approval.reviewSha256 }) : sha(prices);
    proof.inputBound.nativeTransformHash = pins.sourcePins.find(row => index === 5 ? row.path.includes('/image/') : row.path.includes('ai-sdk-provider')).sha256;
    proof.resultBound.proofHash = proofHash;
  }
  const domain = await loadModelPolicy(join(functions, '_cortex/shared/domain'), join(session.backendDir, 'node_modules'),
    join(session.backendDir, '.sandbox-policy-preflight'));
  await ctx.receipt('provisional-policy-real-domain-preflight', validatePolicyManifest(manifest, domain));
  await ctx.receipt('provisional-manifest', manifest);
  await writeFile(join(functions, 'manualCommissionManifest.ts'), 'import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\n// Prospective fixed operator commissioning only; no actual acceptance.\nexport const MANUAL_COMMISSION_MANIFEST = ' + JSON.stringify(manifest) + ' as const satisfies DeploymentPolicyManifest;\n');
  const original = await readFile(join(functions, 'runtimeModelPolicyBootstrap.ts'), 'utf8');
  await privateWrite(join(session.issuerDir, 'bootstrap-shipped.ts'), original, { exclusive: true });
  const provisionalBootstrap = 'import { MANUAL_COMMISSION_MANIFEST } from "./manualCommissionManifest";\n' + replaceOnce(replaceOnce(original,
    registry, registry.replace('])', ', MANUAL_COMMISSION_MANIFEST])')), trusted,
    '(manifest === MANUAL_COMMISSION_MANIFEST || manifest.classification === "reviewed-actual") && manifests.some((entry) => entry === manifest)');
  await writeFile(join(functions, 'runtimeModelPolicyBootstrap.ts'), provisionalBootstrap);
  await ctx.receipt('host-prepared', { sourceCommit: commit, archiveSha256: archiveHash, backendManifestSha256: manifestHash,
    verifiedBackendFiles: BACKEND_FILE_COUNT, pins, pricesSha256: sha(prices), operation, procedureApprovalDigest: approval.digest,
    perRunHumanReview: false, prospectiveOnly: true, paidCalls: 0 });
  return { functions, manifest, identities, pins, domain };
}

async function bootstrap(session, ctx, prepared, key) {
  const { functions, manifest, identities } = prepared;
  await deploy(session, ctx, 'initial-host-deploy', key);
  const operator = admin(session, ctx, key);
  await verifyCloud(session, ctx);
  const authority = await operator.mutation('runtimeAuth:provision', identities.commission);
  assert.equal(authority.tenantId, identities.commission.tenantId); assert.equal(authority.userId, identities.commission.metadataUserId);
  const keys = ['principalId', 'principalVersion', 'membershipId', 'membershipVersion', 'grantId', 'grantVersion', 'tenantId', 'tenantEpoch', 'memorySpaceId', 'memorySpaceEpoch'];
  const reference = Object.fromEntries(keys.map(name => [name, authority[name]]));
  await privateWrite(join(session.issuerDir, 'commission-reference.json'), reference, { exclusive: true });
  await verifyCloud(session, ctx);
  const installed = await operator.mutation('runtimeModelPolicy:installDeploymentPolicy', { manifestId: manifest.manifestId, expectedRevision: 1 });
  assert.equal(installed.manifestId, manifest.manifestId);
  await ctx.receipt('commission-installed', { ...installed, prospectiveOnly: true, fixtureSynthetic: true, reviewedActual: false });
  const scopeSource = 'import type { RuntimeAuthorityReference } from "./_cortex/shared/auth/verified";\nexport const MANUAL_REFERENCE = ' + JSON.stringify(reference) +
    ' as const satisfies RuntimeAuthorityReference;\nexport const MANUAL_OPERATION = ' + JSON.stringify(manifest.manifestId) + ';\n';
  await writeFile(join(functions, 'manualQualificationScope.ts'), scopeSource);
  const probe = await readFile(join(base, 'templates/manualQualificationProbe.ts'), 'utf8');
  // Exact approved template digest is verified by verifyProcedure; AST prevents public probe registration.
  const ts = createRequire(join(session.backendDir, 'package.json'))('typescript');
  const ast = ts.createSourceFile('manualQualificationProbe.ts', probe, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const registrations = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations])
    .filter(row => row.initializer && ts.isCallExpression(row.initializer) && ts.isIdentifier(row.initializer.expression));
  assert.equal(registrations.length, 4);
  for (const name of ['prepare', 'snapshot', 'catalog', 'observe']) {
    const row = registrations.find(value => value.name.getText(ast) === name);
    assert.ok(row && ['internalAction', 'internalMutation', 'internalQuery'].includes(row.initializer.expression.text));
  }
  await writeFile(join(functions, 'manualQualificationProbe.ts'), probe);
  await deploy(session, ctx, 'probe-host-deploy', key);
  await verifyCloud(session, ctx);
  const catalog = await operator.action('manualQualificationProbe:catalog', {});
  assert.equal(catalog.status, 200);
  for (const model of ['openai/gpt-4o-mini', 'openai/gpt-4o', 'openai/text-embedding-3-small', 'openai/text-embedding-3-large', 'openai/gpt-image-1']) {
    assert.ok(catalog.models.some(row => row.id === model), 'Required model unavailable: ' + model);
  }
  await ctx.receipt('native-catalog', catalog);
  await operator.mutation('manualQualificationProbe:prepare', {});
  const commission = await publicClient(session, ctx, 'commission');
  const sessionResult = await commission.mutation('runtimeClient:session', { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId });
  await ctx.receipt('commission-verified-session', { session: sessionResult, paidCalls: 0 });
  for (const [method, name] of [['action', 'catalog'], ['action', 'observe'], ['query', 'snapshot'], ['mutation', 'prepare']]) {
    const guest = await publicClient(session, ctx);
    await deny(() => guest[method]('manualQualificationProbe:' + name, name === 'observe' ? { mode: 'plain' } : {}));
  }
  await deny(() => operator.action('manualQualificationProbe:observe', { mode: 'arbitrary-model' }));
  const before = await operator.query('manualQualificationProbe:snapshot', {});
  assert.equal(before.attempts.length, 0); assert.equal(before.jobs.length, 0);
  await ctx.receipt('paid-batch-baseline', before);
  return { operator, before, probeSha256: sha(probe) };
}

async function observeImage(session, ctx, prepared) {
  const identity = prepared.identities.commission, scope = { tenantId: identity.tenantId, memorySpaceId: identity.memorySpaceId };
  const client = await publicClient(session, ctx, 'commission');
  const request = { ...scope, requestId: 'sandbox-qualification-' + session.id + ':image', kind: 'image',
    prompt: 'A small blue square centered on a plain white background. No text.' };
  const checkedAt = Date.now(), submitted = await client.mutation('runtimeMediaJobs:submit', request);
  await ctx.receipt('image-submitted', submitted);
  const deadline = Date.now() + 90000; let job;
  for (;;) {
    ctx.signal?.throwIfAborted();
    job = await client.mutation('runtimeMediaJobs:get', { ...scope, jobId: submitted.jobId });
    if (['ready', 'failed', 'submission_unknown', 'cancelled', 'expired'].includes(job.state)) break;
    assert.ok(Date.now() < deadline, 'Qualification image wait timed out; never resubmit');
    await new Promise(accept => setTimeout(accept, 500));
  }
  await ctx.receipt('image-terminal-job', job); assert.equal(job.state, 'ready', 'Native image unavailable; no automatic repeat');
  const runtime = await import(pathToFileURL(join(session.backendDir, 'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
  const sdk = new runtime.CortexRuntimeClient({ deploymentUrl: session.target.deploymentUrl,
    assetHttpUrl: session.target.deploymentUrl.replace('.cloud', '.site'), scope, fetchToken: () => jwt(session, ctx, 'commission') });
  try {
    const asset = job.asset; assert.equal(asset.mimeType, 'image/png'); assert.ok(asset.sizeBytes > 0 && asset.sizeBytes <= 20000000);
    const blob = await sdk.fetchAsset({ assetId: asset.assetId, version: asset.assetVersion });
    const bytes = Buffer.from(await blob.arrayBuffer()); assert.equal(bytes.length, asset.sizeBytes); assert.equal(sha(bytes), asset.contentHash);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 1024); assert.equal(bytes.readUInt32BE(20), 1024);
    // Nonsecret actual image evidence is retained with receipts; no private signer/credential may be copied here.
    await privateWrite(join(session.receiptDir, 'qualified-image.png'), bytes, { exclusive: true });
    const replay = await client.mutation('runtimeMediaJobs:submit', request);
    const reconciled = await client.mutation('runtimeMediaJobs:reconcile', { ...scope, jobId: submitted.jobId });
    assert.equal(replay.jobId, submitted.jobId); assert.equal(reconciled.jobId, submitted.jobId);
    await ctx.receipt('image-replay', { jobId: replay.jobId, noNewSubmission: true });
    return { checkedAt, completedAt: Date.now(), job, asset, imageSha256: sha(bytes), imageBytes: bytes.length, width: 1024, height: 1024,
      requestedModelId: 'openai/gpt-image-1', terminalIdentity: 'requested-only', aggregateCostUnavailable: true, authenticatedPrivateDelivery: true };
  } finally { await sdk.close(); }
}

async function paidBatch(session, ctx, prepared, boot, approval) {
  const outcomes = {}, snapshots = [boot.before], operator = boot.operator;
  for (const mode of modes) {
    ctx.signal?.throwIfAborted();
    assert.equal((await verifyProcedure()).digest, approval.digest, 'Procedure approval changed before paid dispatch');
    await verifyCloud(session, ctx);
    assert.equal(sha(await readFile(join(prepared.functions, 'manualQualificationProbe.ts'))), boot.probeSha256);
    // Exclusive durable receipt prevents invocation recovery from silently repeating an uncertain billable call.
    await privateWrite(join(session.receiptDir, 'issued-' + mode + '.json'), { mode, issuedAt: Date.now(), target: session.target,
      procedureApprovalDigest: approval.digest, maximumNewRequests: 1, ceilingUnits: mode === 'image' ? 2000000 : 100000,
      noAutomaticRetry: true, perRunHumanReview: false }, { exclusive: true });
    try {
      const outcome = mode === 'image' ? await observeImage(session, ctx, prepared)
        : await operator.action('manualQualificationProbe:observe', { mode });
      await ctx.receipt('raw-' + mode, outcome); evaluateOutcome(mode, outcome);
      const after = await operator.query('manualQualificationProbe:snapshot', {});
      await ctx.receipt('after-' + mode, after); evaluateFinancialStep(snapshots.at(-1), after, mode);
      if (mode !== 'image') {
        const replay = await operator.action('manualQualificationProbe:observe', { mode });
        assert.equal(replay.result?.replay, true); assert.equal(replay.terminalReceipts.length, 0);
        const replayState = await operator.query('manualQualificationProbe:snapshot', {});
        assert.deepEqual(replayState.attempts, after.attempts); assert.deepEqual(replayState.accounts, after.accounts);
        await ctx.receipt('replay-' + mode, { result: replay, noNewAttempt: true });
      }
      outcomes[mode] = outcome; snapshots.push(after);
      await ctx.receipt('outcome-' + mode, { status: 'ACTUAL_METHOD_AUTOMATIC_EVALUATION_PASS', mode, newAttempts: 1,
        ceilingRetainedAsUnknownUnits: mode === 'image' ? 2000000 : 100000, procedureApprovalDigest: approval.digest,
        perRunHumanReview: false, observedActual: true, finalManifestInstalled: false });
      ctx.log('Qualified ' + mode + ' (' + snapshots.at(-1).attempts.length + '/8 bounded calls).');
    } catch (error) {
      let ledger;
      try { ledger = await operator.query('manualQualificationProbe:snapshot', {}); } catch { ledger = { readUnavailable: true }; }
      await ctx.receipt('failure-' + mode, { status: 'FAIL_OR_UNKNOWN_NO_RETRY', mode, billableIdentityMayHaveDispatched: true,
        ledger, diagnostic: qualificationFailureDiagnostic(error), automaticRetryForbidden: true });
      throw Error('Fresh qualification failed or is unknown for ' + mode + '; the original receipt is retained, and the call will not be retried');
    }
  }
  const evaluation = evaluateBatch(outcomes, snapshots);
  await ctx.receipt('qualification-batch-evaluation', { ...evaluation, procedureApprovalDigest: approval.digest,
    immutableProcedureReviewedBeforeRun: true, freshActualOutcomes: true, oldQualificationDatesReused: false });
  return { outcomes, snapshots, evaluation };
}

async function candidate(session, ctx, prepared, batch, approval) {
  const entries = [];
  for (const mode of modes) {
    const raw = await readFile(join(session.receiptDir, 'raw-' + mode + '.json'));
    entries.push({ mode, path: 'raw-' + mode + '.json', sha256: sha(raw), bytes: raw.length });
  }
  const selected = structuredClone(prepared.manifest);
  Object.assign(selected, { manifestId: 'sandbox-gateway-' + session.id, revision: 2, classification: 'reviewed-actual',
    evidenceHash: sha({ entries, pins: prepared.pins, target: session.target, procedureApprovalDigest: approval.digest }),
    acceptanceHash: approval.digest, artifactRevision: sha(await readFile(join(prepared.functions, 'runtimeGateway.ts'))) });
  for (const row of selected.policies) { row.policyId += '-final'; row.version = 2; }
  const query = selected.policies.find(row => row.operationKey === 'embedding.query');
  query.rules.modelId = 'openai/text-embedding-3-small'; query.rules.pins.boundRevision = 'manual-small-8192-1536';
  assert.equal(selected.qualifications.length, qualificationGroups.length);
  assert.equal(selected.dispatchEvidence.length, qualificationGroups.length);
  assert.deepEqual(qualificationGroups.flatMap(group => group.modes).toSorted(), [...modes].toSorted());
  for (const group of qualificationGroups) {
    const index = group.index, qualification = selected.qualifications[index], proof = selected.dispatchEvidence[index];
    assert.equal(proof.inputBound.featureEnvelope, group.envelope, 'Fixed method-to-proof envelope mismatch');
    const raws = group.modes.map(mode => batch.outcomes[mode]);
    assert.ok(raws.every(Boolean), 'Actual method evidence missing');
    for (const raw of raws) if (proof.nativeInterface !== 'image') {
      assert.equal(raw.terminalReceipts[0].receipt.modelId, proof.modelId);
      assert.equal(raw.terminalReceipts[0].receipt.nativeInterface, proof.nativeInterface);
    }
    const groupEntries = group.modes.map(mode => entries.find(row => row.mode === mode));
    assert.ok(groupEntries.every(Boolean));
    const evidenceHash = sha(groupEntries);
    const checkedAt = Math.min(...raws.map(value => value.terminalReceipts?.[0]?.capturedAt ?? value.completedAt));
    assert.ok(Number.isSafeInteger(checkedAt) && checkedAt <= Date.now());
    const receiptId = 'ACTUAL-' + session.id + '-' + index;
    qualification.receiptId = receiptId;
    qualification.costBound.provenance = costProvenance('actual', evidenceHash, approval.digest, qualification.costBound.maximumCostUnits);
    Object.assign(proof, { receiptId, evidenceHash, checkedAt, expiresAt: Math.min(checkedAt + 7 * 86400000, session.target.expiresAt) });
    assert.ok(Date.now() < proof.expiresAt);
    proof.inputBound.proofHash = evidenceHash; proof.resultBound.proofHash = evidenceHash;
    proof.inputBound.nativeTransformHash = sha(prepared.pins.sourcePins.filter(row => proof.nativeInterface === 'image' ? /image|ai-sdk-provider/.test(row.path)
      : proof.nativeInterface === 'embedding' ? /embedding|ai-sdk-provider/.test(row.path)
        : /chat|ai-sdk-provider|post-to-api|runtimeGateway|runtimeMemoryGateway|model_policy/.test(row.path)));
  }
  await ctx.receipt('final-policy-real-domain-preflight', validatePolicyManifest(selected, prepared.domain));
  await ctx.receipt('candidate-final-manifest', selected);
  await ctx.receipt('actual-qualification-evidence', { status: 'FRESH_ACTUAL_AUTOMATIC_PROCEDURE_EVALUATION_PASS', target: session.target,
    entries, pins: prepared.pins, procedureApprovalDigest: approval.digest, procedureReviewSha256: approval.reviewSha256,
    perRunHumanReview: false, ...batch.evaluation, noVideoQualification: true,
    candidateManifestSha256: sha(selected), qualificationExpiresAt: Math.min(...selected.dispatchEvidence.map(row => row.expiresAt)) });
  return selected;
}

async function dataTable(session, ctx, key, table) {
  const result = await command(session, ctx, 'read-' + table.replace('_', '-') + '-' + Date.now(),
    [join(session.backendDir, 'node_modules/convex/bin/main.js'), 'data', table, '--limit', '100', '--format', 'json'], {
      env: { CONVEX_DEPLOY_KEY: key, CONVEX_DEPLOYMENT: 'dev:' + session.target.name } });
  if (!result.stdout.trim()) {
    assert.ok(result.stderr.includes('There are no documents in this table.'), 'Empty native table output without verified empty-table notice'); return [];
  }
  return JSON.parse(result.stdout);
}

async function promote(session, ctx, prepared, boot, batch, selected, key, approval) {
  const operator = boot.operator, before = batch.snapshots.at(-1);
  await verifyCloud(session, ctx);
  await operator.mutation('runtimeAuth:deleteScope', { tenantId: prepared.identities.commission.tenantId });
  const commission = await publicClient(session, ctx, 'commission');
  await deny(() => commission.mutation('runtimeClient:session', { tenantId: prepared.identities.commission.tenantId, memorySpaceId: 'qualification' }), 'FORBIDDEN');
  const after = await operator.query('manualQualificationProbe:snapshot', {});
  assert.deepEqual(after.attempts, before.attempts); assert.deepEqual(after.accounts, before.accounts);
  assert.deepEqual(after.operations, before.operations);
  await ctx.receipt('commission-retirement', { scopeTombstoned: true, publicSessionDenied: true,
    immutableFinancialRowsAndFullLiabilityPreserved: true, ledger: after, fullUnknownLiabilityUnits: 2700000 });
  const original = await readFile(join(session.issuerDir, 'bootstrap-shipped.ts'), 'utf8');
  const finalSource = 'import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\n// Fresh actual outcomes accepted by an immutable independently reviewed automatic procedure; no per-run human review.\nexport const MANUAL_GATEWAY_QUALIFICATION = ' + JSON.stringify(selected) + ' as const satisfies DeploymentPolicyManifest;\n';
  await writeFile(join(prepared.functions, 'manualGatewayQualification.ts'), finalSource);
  const finalBootstrap = 'import { MANUAL_GATEWAY_QUALIFICATION } from "./manualGatewayQualification";\n' + replaceOnce(original,
    registry, registry.replace('])', ', MANUAL_GATEWAY_QUALIFICATION])'));
  assert.ok(!finalBootstrap.includes('MANUAL_COMMISSION_MANIFEST'));
  await writeFile(join(prepared.functions, 'runtimeModelPolicyBootstrap.ts'), finalBootstrap);
  for (const name of ['manualQualificationProbe.ts', 'manualQualificationScope.ts', 'manualCommissionManifest.ts']) await rm(join(prepared.functions, name));
  await deploy(session, ctx, 'final-qualification-deploy', key);
  await verifyCloud(session, ctx);
  const installed = await operator.mutation('runtimeModelPolicy:installDeploymentPolicy', { manifestId: selected.manifestId, expectedRevision: 2 });
  assert.equal(installed.manifestId, selected.manifestId);
  await ctx.receipt('final-qualification-installed', { ...installed, sourceSha256: sha(finalSource), bootstrapSha256: sha(finalBootstrap),
    procedureApprovalDigest: approval.digest, perRunHumanReview: false, fixtureTrustExceptionRemoved: true, temporaryProbeFilesRemoved: true });
  const deadline = Date.now() + 30000; let storage, versions;
  for (;;) {
    storage = await dataTable(session, ctx, key, '_storage'); versions = await dataTable(session, ctx, key, 'runtimeAssetVersions');
    if (!storage.length && versions.length > 0 && versions.every(row => row.state === 'deleted')) break;
    assert.ok(Date.now() < deadline, 'Commissioning physical storage cleanup did not complete');
    await new Promise(accept => setTimeout(accept, 500));
  }
  await ctx.receipt('commission-storage-cleanup', { actualPhysicalStorageDeleted: true, storageObjectsRemaining: 0,
    assetVersionRows: versions.map(row => ({ versionId: row.versionId, state: row.state, deletedAt: row.deletedAt })),
    actualImageEvidenceRetained: 'qualified-image.png' });
  for (const [method, name] of [['action', 'observe'], ['action', 'catalog'], ['query', 'snapshot'], ['mutation', 'prepare']]) {
    await deny(() => operator[method]('manualQualificationProbe:' + name, name === 'observe' ? { mode: 'plain' } : {}));
  }
  const attempts = await dataTable(session, ctx, key, 'runtimeModelAttempts');
  assert.equal(attempts.length, 8); assert.ok(attempts.every(row => row.state === 'uncertain' && row.slotReleased === true && !row.resultWithheld));
  assert.equal(attempts.reduce((total, row) => total + row.reservationUnits, 0), 2700000);
  await ctx.receipt('post-removal-financial-rows', { attempts, exactEightAttemptsRetained: true, unknownLiabilityUnits: 2700000 });
}

async function manualAccess(session, ctx, prepared, selected, key, approval) {
  await verifyCloud(session, ctx);
  const operator = admin(session, ctx, key), authorities = {}, identities = prepared.identities;
  for (const role of ['owner', 'reader', 'outsider']) {
    identities[role].expiresAt = session.target.expiresAt;
    authorities[role] = await operator.mutation('runtimeAuth:provision', identities[role]);
    assert.equal(authorities[role].tenantId, identities[role].tenantId); assert.equal(authorities[role].memorySpaceId, identities[role].memorySpaceId);
  }
  await privateWrite(join(session.issuerDir, 'identities.json'), identities);
  await privateWrite(join(session.issuerDir, 'manual-authorities.json'), authorities, { exclusive: true });
  const owner = await publicClient(session, ctx, 'owner'), scope = { tenantId: identities.owner.tenantId, memorySpaceId: identities.owner.memorySpaceId };
  const catalog = { version: 2, tools: { 'memory.remember': 1, 'memory.recall': 1, 'media.image.generate': 1, 'media.video.generate': 1, 'artifact.read': 1 }, contexts: { 'cortex.transcript': 1 } };
  const registryHash = sha(canonical(catalog));
  const definition = { instructions: { text: 'You are a Cortex sandbox testing assistant. Answer briefly. Use memory tools only when the user explicitly requests recall or remember. All tool effects require explicit approval. Video generation is unavailable; explain that when requested. Do not generate images unless explicitly requested.', promptVersion: 'sandbox-assistant-v1' },
    tools: Object.keys(catalog.tools).map(toolId => ({ toolId, toolVersion: 1, registryHash, requiredCapability: 'tool', approval: 'explicit' })),
    context: { handlerId: 'cortex.transcript', handlerVersion: 1, registryHash, memoryMode: 'indexed-plus-pending', requiredStages: [], maxContextTokens: 4096 },
    policies: [{ policyId: 'sandbox-agent-per-function-v1', version: 1, operationKey: 'agent.respond', rules: {} }] };
  const published = await owner.mutation('agentDefinitions:publishVersion', { memorySpaceId: scope.memorySpaceId,
    clientMutationId: 'sandbox-agent-publish-' + session.id, expectedPreviousVersion: 0, definitionInput: definition });
  const conversation = await owner.mutation('runtimeTranscript:create', { memorySpaceId: scope.memorySpaceId,
    clientRequestId: 'sandbox-approval-' + session.id, requireApproval: true, participants: [authorities.reader.principalId] });
  const runtime = await import(pathToFileURL(join(session.backendDir, 'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
  const sdk = new runtime.CortexRuntimeClient({ deploymentUrl: session.target.deploymentUrl,
    assetHttpUrl: session.target.deploymentUrl.replace('.cloud', '.site'), scope, fetchToken: () => jwt(session, ctx, 'owner') });
  let profile, readiness;
  try {
    await sdk.session(); profile = await sdk.getEmbeddingProfile(); readiness = await sdk.memoryReadiness();
    assert.equal(profile.profile.dimensions, 1536); assert.equal(profile.profile.profileId, 'cortex-text-small-1536-v1');
    assert.equal(readiness.profile.profileId, profile.profile.profileId);
  } finally { await sdk.close(); }
  const reader = await publicClient(session, ctx, 'reader'), outsider = await publicClient(session, ctx, 'outsider');
  await deny(() => reader.mutation('runtimeTranscript:create', { memorySpaceId: scope.memorySpaceId, clientRequestId: 'denied-reader-' + session.id }), 'FORBIDDEN');
  await deny(() => outsider.mutation('runtimeTranscript:get', { ...scope, conversationId: conversation.conversationId }), 'FORBIDDEN');
  const current = await owner.mutation('agentDefinitions:get', { ...scope, agentId: published.agentId, version: published.version });
  assert.equal(current.definitionHash, published.definitionHash);
  const saved = await owner.mutation('runtimeTranscript:get', { ...scope, conversationId: conversation.conversationId }); assert.equal(saved.requireApproval, true);
  const metadata = { version: 1, sessionId: session.id, teamId: session.target.teamId, projectId: session.target.projectId,
    deploymentName: session.target.name, deploymentUrl: session.target.deploymentUrl, httpUrl: session.target.deploymentUrl.replace('.cloud', '.site'),
    ...scope, agentId: published.agentId, agentVersion: published.version, definitionHash: published.definitionHash,
    approvalConversationId: conversation.conversationId, conversationInputApprovalRequired: true, toolApproval: 'explicit',
    manifestId: selected.manifestId, manifestRevision: 2, qualificationExpiresAt: Math.min(...selected.dispatchEvidence.map(row => row.expiresAt)),
    deploymentExpiresAt: session.target.expiresAt, profile, readiness, installationSpecificFreshQualification: true,
    asyncVideoDeferred: true, procedureApprovalDigest: approval.digest, perRunHumanReview: false };
  session.publicRuntime = metadata; await ctx.persist();
  await privateWrite(join(session.runDir, 'public-runtime.json'), metadata, { exclusive: true });
  await privateWrite(join(session.backendDir, 'manual-runtime.json'), metadata, { exclusive: true });
  await refreshTokens(session, ctx);
  await ctx.receipt('runtime-ready', { status: 'QUALIFIED_DISPOSABLE_RUNTIME_READY', metadata,
    ownerSessionAndManagedDefaultProfilePass: true, definitionAndApprovedConversationReadBack: true,
    readerWriteDenied: true, outsiderScopeDenied: true, publicProbeRemoved: true, commissioningRetired: true,
    originalFinancialLiabilityRetained: true, newManualPaidChatCalls: 0 });
  return metadata;
}

export async function provisionRuntime(session, ctx) {
  const approval = await verifyProcedure();
  await verifyCloud(session, ctx); const key = await getDeployKey(session, ctx);
  const prepared = await prepare(session, ctx, approval);
  const boot = await bootstrap(session, ctx, prepared, key);
  const batch = await paidBatch(session, ctx, prepared, boot, approval);
  const selected = await candidate(session, ctx, prepared, batch, approval);
  await promote(session, ctx, prepared, boot, batch, selected, key, approval);
  return manualAccess(session, ctx, prepared, selected, key, approval);
}

export async function refreshTokens(session, ctx) {
  await verifyCloud(session, ctx);
  assert.ok(session.publicRuntime && session.publicRuntime.deploymentName === session.target.name, 'Tokens require the qualified owned runtime');
  for (const role of ['owner', 'reader', 'outsider']) await privateWrite(join(session.secretsDir, role + '.jwt'), await jwt(session, ctx, role));
  await ctx.receipt('tokens-refreshed-' + Date.now(), { scopesUnchanged: true, expiresWithinSeconds: 3600,
    hostSignerOnly: true, roles: ['owner', 'reader', 'outsider'], privateTokensOmitted: true });
  return { status: 'REFRESHED', expiresWithinSeconds: 3600 };
}
