/** One additional governed image submission. Default invocation is offline. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, generateKeyPairSync, createSign } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CANDIDATE = path.resolve(HERE, '../../../../..');
export const ENGINE = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env';
export const PRIVATE_ROOT = '/Users/SaintNick/.codex/tmp/cortex-image-diagnostic-20261031';
export const ORIGINAL = '/Users/SaintNick/.codex/tmp/cortex-release-qualification-20261031/.sandbox-env-runs/5f2ac3f2-b2a6-4918-8379-f2487e6fb6f8';
const NODE = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';
const FROZEN = path.join(HERE, '../qualification-renewal');
const requireCandidate = createRequire(path.join(CANDIDATE, 'package.json'));
const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const engine = async name => import(pathToFileURL(path.join(ENGINE, name + '.mjs')));
const fileRow = async file => { const raw = await fs.readFile(file); return { path: file, bytes: raw.length, sha256: sha(raw) }; };
export function validateNativeLock(distribution, lock) {
  assert.equal(distribution.dependencies.convex, '^1.46.0');
  for (const [name, version] of Object.entries(distribution.dependencies)) {
    if (name === 'convex') assert.equal(lock.packages[''].dependencies.convex, '1.46.0');
    else assert.equal(lock.packages[''].dependencies[name], version, 'Pinned native lock differs from distribution dependency: ' + name);
  }
  return { convexRequested: '^1.46.0', convexLocked: '1.46.0', exactOtherDependencies: Object.keys(distribution.dependencies).length - 1 };
}
/** Same bounded file-plus-parent synchronization used by the maintained V1-only coordinator. */
export async function durable(file, io = fs) {
  const handle = await io.open(file, 'r'); try { await handle.sync(); } finally { await handle.close(); }
  const parent = await io.open(path.dirname(file), 'r'); try { await parent.sync(); } finally { await parent.close(); }
}

/** Extract the exact old fixed private input; it never enters public code/receipts. */
export async function fixedInput() {
  const ts = requireCandidate('typescript'), source = await fs.readFile(path.join(ENGINE, 'runtime.mjs'), 'utf8');
  const ast = ts.createSourceFile('runtime.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const fn = ast.statements.find(row => ts.isFunctionDeclaration(row) && row.name?.text === 'observeImage');
  assert.ok(fn?.body);
  const declaration = fn.body.statements.filter(ts.isVariableStatement).flatMap(row => [...row.declarationList.declarations])
    .find(row => row.name.getText(ast) === 'request');
  assert.ok(declaration?.initializer && ts.isObjectLiteralExpression(declaration.initializer));
  const item = declaration.initializer.properties.find(row => ts.isPropertyAssignment(row) && row.name.getText(ast) === 'prompt');
  assert.ok(item && ts.isStringLiteral(item.initializer));
  const prompt = item.initializer.text;
  assert.ok(Buffer.byteLength(prompt) > 0 && Buffer.byteLength(prompt) <= 1024);
  return { prompt, promptSha256: sha(prompt), wireSha256: sha({ model: 'openai/gpt-image-1', prompt, n: 1, size: '1024x1024', quality: 'low', output_format: 'png' }) };
}

export async function inspectInputs() {
  const review = await json(path.join(FROZEN, 'independent-review.json'));
  assert.equal(review.verdict, 'APPROVED');
  const frozen = [];
  for (const name of ['renewal.mjs', 'source-inputs.json', 'supplemental-v1-probe.ts']) {
    const row = await fileRow(path.join(FROZEN, name)); assert.equal(row.sha256, review.files[name]); frozen.push(row);
  }
  const previous = await import(pathToFileURL(path.join(FROZEN, 'renewal.mjs')));
  const equivalent = await previous.verifyInputs();
  const originalFiles = [];
  for (const name of ['issued-image', 'image-terminal-job', 'failure-image', 'cleanup-final', 'host-prepared', 'native-catalog',
    ...['jsonExtract', 'plain', 'title', 'small', 'large', 'toolsGenerate', 'toolsStream'].flatMap(mode => ['raw-' + mode, 'outcome-' + mode])]) {
    originalFiles.push(await fileRow(path.join(ORIGINAL, 'receipts', name + '.json')));
  }
  const failure = await json(path.join(ORIGINAL, 'receipts/failure-image.json'));
  assert.equal(failure.status, 'FAIL_OR_UNKNOWN_NO_RETRY'); assert.equal(failure.ledger.attempts.length, 8);
  assert.equal(failure.ledger.attempts.reduce((sum, row) => sum + row.reservationUnits, 0), 2700000);
  assert.equal((await json(path.join(ORIGINAL, 'receipts/cleanup-final.json'))).status, 'ABSENT');
  const input = await fixedInput();
  const sdkArchive = await fileRow(path.join(previous.KIT, 'artifacts', previous.OLD_COMMIT, 'cortexmemory-sdk-0.39.0.tgz'));
  assert.equal(sdkArchive.sha256, (await engine('docker')).CANDIDATE_PACKAGES.sdk.sha256);
  const nativeContract = validateNativeLock(await json(path.join(previous.STAGING, 'dist/backend/v1/manifest.json')),
    await json(path.join(ENGINE, 'templates/native-package-lock.json')));
  const v1Receipt = path.join(HERE, '../v1-renewal-only/live-attempt-2026-10-31.json'), v1 = await json(v1Receipt);
  assert.equal(v1.exitCode, 0); assert.equal(v1.status, 'ACTUAL_V1_STREAM_OBSERVED_PENDING_INDEPENDENT_REVIEW');
  assert.equal(v1.financial.actualV1Dispatches, 1); assert.equal(v1.financial.retainedV1UnknownUnits, 100000);
  assert.equal(v1.cleanup.status, 'ABSENT');
  return { version: 1, frozen, originalFiles, originalSessionId: path.basename(ORIGINAL),
    sourceEquivalenceSha256: sha(equivalent), materialSources: equivalent.finiteSources.length, nativeFiles: equivalent.native.length,
    backendManifestSha256: equivalent.backendManifestSha256, kitSourceCommit: previous.OLD_COMMIT,
    sdkArchive, nativeContract,
    installer: await fileRow(path.join(previous.STAGING, 'packages/cortex-cli/dist/utils/init/backend-setup.js')),
    nativeLock: await fileRow(path.join(ENGINE, 'templates/native-package-lock.json')),
    officialLogSource: await fileRow(path.join(CANDIDATE, 'node_modules/convex/src/cli/lib/logs.ts')),
    promptSha256: input.promptSha256, wireSha256: input.wireSha256,
    modelId: 'openai/gpt-image-1', maximumNewImageSubmissions: 1, maximumNewUnknownLiabilityUnits: 2000000,
    originalAttempts: 8, originalPossibleLiabilityUnits: 2700000,
    existingV1: { receipt: await fileRow(v1Receipt), attempts: 1, retainedUnknownUnits: 100000, cleanup: 'ABSENT' },
    priorAttempts: 9, priorPossibleLiabilityUnits: 2800000, cumulativeAttemptsAfterThis: 10,
    cumulativePossibleLiabilityAfterThis: 4800000, automaticPaidRetries: 0 };
}
export async function verifyInputs() {
  const actual = await inspectInputs(); assert.deepEqual(actual, await json(path.join(HERE, 'inputs.json')), 'Pinned image preparation inputs drifted');
  return actual;
}
const replaceOnce = (text, before, after) => { assert.equal(text.split(before).length, 2, 'Disposable host shape drifted'); return text.replace(before, after); };
export function diagnosticJobSource(source) {
  return 'import {instrumentedSubmission} from "./imageDiagnosticProbe";\n' + replaceOnce(replaceOnce(source,
    'import { processSubmissionHandler, processPollHandler, processDownloadHandler } from "./runtimeMediaGateway";',
    'import { processPollHandler, processDownloadHandler } from "./runtimeMediaGateway";'),
    'handler: processSubmissionHandler });', 'handler: instrumentedSubmission });');
}

async function imagePrice(ctx) {
  const response = await ctx.fetch('https://openrouter.ai/api/v1/model/openai/gpt-image-1', { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, 'Current image price unavailable');
  const raw = await boundedText(response, 65536), parsed = JSON.parse(raw), value = parsed.data ?? parsed;
  assert.equal(value.id, 'openai/gpt-image-1');
  const prompt = Number(value.pricing?.prompt), output = Number(value.pricing?.image_output);
  assert.ok(Number.isFinite(prompt) && prompt >= 0 && Number.isFinite(output) && output >= 0);
  const maximumPublishedUnits = (8192 * prompt + 16384 * output) * 1000000;
  assert.ok(maximumPublishedUnits <= 2000000, 'Image price exceeds unchanged ceiling');
  return { observedAt: Date.now(), responseSha256: sha(raw), maximumPublishedUnits, fullUnknownCeilingUnits: 2000000 };
}

export async function commissioningManifest(session, inputs, price, reviewSha256) {
  assert.match(reviewSha256, /^[a-f0-9]{64}$/);
  assert.ok(price.observedAt <= Date.now() && Date.now() - price.observedAt < 3600000 && price.maximumPublishedUnits <= 2000000);
  const template = await json(path.join(ENGINE, 'templates/qualification-envelopes.json'));
  const policies = [template.policies.find(row => !row.operationKey), template.policies.find(row => row.operationKey === 'media.image.generate')].map(row => structuredClone(row));
  // The production installer resolves agent.respond for every qualification, even image.
  // A noncalled synthetic text lane satisfies that validator; no chat observer is installed or invoked.
  const qualifications = [template.qualifications[0], template.qualifications[5]].map(row => structuredClone(row));
  const dispatchEvidence = [template.dispatchEvidence[0], template.dispatchEvidence[5]].map(row => structuredClone(row));
  const id = 'image-diagnostic-' + session.id, priceRevision = id + '-price', now = Date.now();
  const evidenceHash = sha({ prospectiveOnly: true, id, inputs: sha(inputs), price, reviewSha256 });
  policies[0].rules.allowedTools = []; policies[0].rules.fallbackModels = [];
  for (const policy of policies) { policy.policyId = id + '-' + policy.policyId; policy.version = 1; policy.rules.pins.priceRevision = priceRevision; }
  for (const [index, qualification] of qualifications.entries()) {
    const proof = dispatchEvidence[index], receiptId = 'PROSPECTIVE-' + id + '-' + index;
    Object.assign(qualification, { receiptId, priceRevision });
    qualification.costBound.provenance = index === 1
      ? `Prospective image only; review=${reviewSha256}; UNKNOWN2000000; retries0; actual pending.`
      : 'Fixture bootstrap validator only; no text dispatch permitted by this procedure; not actual evidence.';
    Object.assign(proof, { receiptId, evidenceHash, priceRevision, checkedAt: now, expiresAt: Math.min(now + 3600000, session.target.expiresAt) });
    Object.assign(proof.inputBound, { proofHash: evidenceHash, nativeTransformHash: inputs.sourceEquivalenceSha256, documentHash: sha(price) });
    proof.resultBound.proofHash = evidenceHash;
  }
  assert.equal(qualifications[1].costBound.maximumCostUnits, 2000000);
  return { manifestId: id, revision: 1, classification: 'fixture-synthetic', artifactRevision: inputs.backendManifestSha256,
    evidenceHash, acceptanceHash: reviewSha256, budgetWindowMs: 86400000, policies, qualifications, dispatchEvidence };
}

function serviceClient(session, ctx, key) {
  const requireHost = createRequire(path.join(session.backendDir, 'package.json'));
  const { ConvexHttpClient } = requireHost('convex/browser');
  const client = new ConvexHttpClient(session.target.deploymentUrl, { logger: false, fetch: async (url, options) => {
    ctx.signal?.throwIfAborted(); await (await engine('cloud')).verifyCloud(session, ctx);
    return ctx.fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(90000),
      ...(ctx.signal ? [ctx.signal] : []), ...(options?.signal ? [options.signal] : [])]) });
  } });
  if (key) client.setAdminAuth(key); return client;
}
function signJwt(session, ctx, identity, privateKey) {
  const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = encode({ alg: 'RS256', typ: 'JWT', kid: 'image-' + session.id }) + '.' + encode({
    iss: identity.issuer, sub: identity.subject, aud: 'image-' + session.id, iat: now, exp: Math.min(now + 3600, Math.floor(identity.expiresAt / 1000)) });
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  const token = unsigned + '.' + signer.sign(privateKey).toString('base64url'); ctx.registerSecret(token); return token;
}

async function prepareHost(session, ctx, inputs, reviewSha256) {
  const cloud = await engine('cloud'), previous = await import(pathToFileURL(path.join(FROZEN, 'renewal.mjs')));
  const key = await cloud.getDeployKey(session, ctx), input = await fixedInput(); ctx.registerSecret(input.prompt);
  const lock = await json(inputs.nativeLock.path), archive = inputs.sdkArchive.path;
  const distribution = await json(path.join(previous.STAGING, 'dist/backend/v1/manifest.json'));
  validateNativeLock(distribution, lock);
  const preparedRequire = createRequire(path.join(ctx.dependenciesDir, '..', 'package.json'));
  assert.equal(lock.packages[''].devDependencies.typescript, preparedRequire('typescript/package.json').version);
  lock.packages[''].dependencies['@cortexmemory/sdk'] = 'file:' + archive;
  lock.packages['node_modules/@cortexmemory/sdk'].resolved = 'file:' + archive;
  lock.packages['node_modules/@cortexmemory/sdk'].integrity = 'sha512-' + createHash('sha512').update(await fs.readFile(archive)).digest('base64');
  await cloud.privateWrite(path.join(session.backendDir, 'package.json'), { ...lock.packages[''], private: true, type: 'module', packageManager: 'npm@12.2.0' }, { exclusive: true });
  await cloud.privateWrite(path.join(session.backendDir, 'package-lock.json'), lock, { exclusive: true });
  assert.equal((await json(path.join(path.dirname(path.dirname(ctx.npmCli)), 'package.json'))).version, '12.2.0');
  await ctx.command('image-host-native-install', ctx.node, [ctx.npmCli, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: session.backendDir, timeoutMs: 300000 });
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 }), privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  ctx.registerSecret(privateKey); await cloud.privateWrite(path.join(session.issuerDir, 'jwt-private.pem'), privateKey, { exclusive: true });
  const provider = { type: 'customJwt', issuer: 'https://image-' + session.id + '.invalid', applicationID: 'image-' + session.id,
    algorithm: 'RS256', jwks: 'data:application/json;base64,' + Buffer.from(JSON.stringify({ keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid: 'image-' + session.id, alg: 'RS256', use: 'sig' }] })).toString('base64') };
  const { setupBackend } = await import(pathToFileURL(inputs.installer.path));
  const installed = await setupBackend({ projectPath: session.backendDir, sdkPath: path.join(session.backendDir, 'node_modules/@cortexmemory/sdk'), jwtProvider: provider });
  assert.equal(installed.conflicts.length, 0); await ctx.receipt('image-host-install', installed);
  assert.equal(sha(await fs.readFile(path.join(session.backendDir, 'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))), inputs.backendManifestSha256);
  const equivalent = await previous.verifyInputs();
  for (const row of equivalent.native) assert.equal(sha(await fs.readFile(path.join(session.backendDir, row.installedHostPath))), row.sha256, 'Actual installed native bytes differ');
  const functions = path.join(session.backendDir, 'convex');
  for (const row of equivalent.finiteSources) assert.equal(sha(await fs.readFile(path.join(functions, row.backendPath))), row.backendSha256, 'Installed material source differs');
  const price = await imagePrice(ctx); await ctx.receipt('image-current-price', price);
  const manifest = await commissioningManifest(session, inputs, price, reviewSha256);
  const { loadModelPolicy } = await engine('qualification');
  const domain = await loadModelPolicy(path.join(functions, '_cortex/shared/domain'), path.join(session.backendDir, 'node_modules'), path.join(session.backendDir, '.image-policy-preflight'));
  // Validate exactly the installer's actual agent.respond loop and the sole image lane.
  const scope = { tenantId: 'offline', memorySpaceId: 'offline', principalId: 'offline', principalVersion: 1, membershipId: 'offline', membershipVersion: 1, grantId: 'offline', grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
  for (const operationKey of ['agent.respond', 'media.image.generate']) domain.resolveModelPolicy({ context: { scope, operationKey, runBudgetId: 'bootstrap', authorizedOverrides: [] },
    policies: manifest.policies.filter(row => !row.operationKey || row.operationKey === operationKey), qualifications: manifest.qualifications });
  await ctx.receipt('image-prospective-manifest', manifest);
  const bootstrapPath = path.join(functions, 'runtimeModelPolicyBootstrap.ts'), bootstrap = await fs.readFile(bootstrapPath, 'utf8');
  const registryEnd = 'OBSERVED_GATEWAY_POLICY_MANIFEST_V18])';
  const amended = 'import { IMAGE_COMMISSION } from "./imageDiagnosticManifest";\n' + replaceOnce(replaceOnce(bootstrap,
    registryEnd, 'OBSERVED_GATEWAY_POLICY_MANIFEST_V18, IMAGE_COMMISSION])'),
    'manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest)',
    '(manifest === IMAGE_COMMISSION || manifest.classification === "reviewed-actual") && manifests.some((entry) => entry === manifest)');
  await cloud.privateWrite(path.join(session.receiptDir, 'image-original-bootstrap.ts'), bootstrap, { exclusive: true });
  await cloud.privateWrite(bootstrapPath, amended);
  await cloud.privateWrite(path.join(functions, 'imageDiagnosticManifest.ts'), 'import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\nexport const IMAGE_COMMISSION=' + JSON.stringify(manifest) + ' as const satisfies DeploymentPolicyManifest;\n', { exclusive: true });
  const deploy = name => ctx.command(name, ctx.node, [path.join(session.backendDir, 'node_modules/convex/bin/main.js'), 'dev', '--once', '--typecheck', 'enable', '--codegen', 'enable', '--tail-logs', 'disable'], {
    cwd: session.backendDir, timeoutMs: 180000, env: { CONVEX_DEPLOY_KEY: key, CONVEX_DEPLOYMENT: 'dev:' + session.target.name } });
  await cloud.verifyCloud(session, ctx); await deploy('image-initial-host-deploy');
  const admin = serviceClient(session, ctx, key);
  const identity = { issuer: provider.issuer, subject: 'image-' + session.id, metadataUserId: 'image-' + session.id, actorKind: 'user',
    tenantId: 'image-' + session.id, memorySpaceId: 'image-only', capabilities: ['read', 'write', 'run', 'admin', 'storage:read', 'storage:write'], resourceAccess: 'space', expiresAt: Math.min(Date.now() + 3600000, session.target.expiresAt) };
  const authority = await admin.mutation('runtimeAuth:provision', identity);
  assert.equal(authority.tenantId, identity.tenantId); assert.equal(authority.memorySpaceId, identity.memorySpaceId);
  await admin.mutation('runtimeModelPolicy:installDeploymentPolicy', { manifestId: manifest.manifestId, expectedRevision: 1 });
  const marker = 'CORTEX_IMAGE_DIAGNOSTIC_' + session.id + ':';
  await cloud.privateWrite(path.join(functions, 'imageDiagnosticScope.ts'), 'export const IMAGE_INPUT=' + JSON.stringify({ prompt: input.prompt }) + ';\nexport const IMAGE_MARKER=' + JSON.stringify(marker) + ';\n', { exclusive: true });
  await cloud.privateWrite(path.join(functions, 'imageDiagnosticMetadata.ts'), await fs.readFile(path.join(HERE, 'diagnostic.ts')), { exclusive: true });
  await cloud.privateWrite(path.join(functions, 'imageDiagnosticProbe.ts'), await fs.readFile(path.join(HERE, 'image-probe.ts')), { exclusive: true });
  const jobPath = path.join(functions, 'runtimeMediaJobs.ts'), jobSource = await fs.readFile(jobPath, 'utf8');
  assert.equal(sha(jobSource), sha(await fs.readFile(path.join(previous.STAGING, 'dist/backend/v1/runtimeMediaJobs.ts'))));
  await cloud.privateWrite(jobPath, diagnosticJobSource(jobSource));
  await cloud.verifyCloud(session, ctx); await deploy('image-diagnostic-fixture-deploy');
  const catalog = await admin.action('imageDiagnosticProbe:catalog', {}); await ctx.receipt('image-native-catalog', catalog);
  assert.equal(catalog.status, 200); assert.equal(catalog.imageModelPresent, true);
  const before = await admin.query('imageDiagnosticProbe:snapshot', {}); assert.equal(before.attempts.length, 0); assert.equal(before.jobs.length, 0);
  await ctx.receipt('image-before', before);
  const fetchToken = () => signJwt(session, ctx, identity, privateKey);
  const client = serviceClient(session, ctx); client.setAuth(fetchToken());
  const scopeArgs = { tenantId: identity.tenantId, memorySpaceId: identity.memorySpaceId };
  await client.mutation('runtimeClient:session', scopeArgs);
  return { key, marker, client, admin, scope: scopeArgs, prompt: input.prompt, fetchToken, price, functions };
}

export function publicDiagnostic(value) {
  const diagnostic = value?.diagnostic;
  const allowedCodes = new Set(['insufficient_funds', 'insufficient_credits', 'insufficient_balance', 'insufficient_quota', 'credit_limit_reached',
    'payment_required', 'model_not_found', 'model_unavailable', 'content_policy_violation', 'invalid_request_error', 'invalid_parameter',
    'unsupported_parameter', 'rate_limit_exceeded', 'unauthorized', 'forbidden', 'internal_error', 'service_unavailable', 'timeout',
    'api_error', 'authentication_error']);
  const safeCode = typeof diagnostic?.providerCode === 'string' && allowedCodes.has(diagnostic.providerCode.toLowerCase()) ? diagnostic.providerCode : null;
  return { phase: ['native-image-returned', 'native-image-threw', 'diagnostic-capture-unavailable'].includes(value?.phase) ? value.phase : 'unknown',
    statusCode: Number.isInteger(diagnostic?.statusCode) && diagnostic.statusCode >= 100 && diagnostic.statusCode <= 599 ? diagnostic.statusCode : null,
    providerCode: safeCode, diagnosticSha256: sha(value),
    messageSha256: /^[a-f0-9]{64}$/.test(diagnostic?.messageSha256) ? diagnostic.messageSha256 : null,
    responseBodySha256: /^[a-f0-9]{64}$/.test(diagnostic?.responseBodySha256) ? diagnostic.responseBodySha256 : null };
}

async function boundedText(response, limit = 2097152) {
  assert.ok(response.body); const reader = response.body.getReader(), chunks = []; let bytes = 0;
  try { for (;;) { const row = await reader.read(); if (row.done) break; bytes += row.value.length; assert.ok(bytes <= limit, 'Private log response exceeds bound'); chunks.push(row.value); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
export function extractDiagnostics(entries, marker, jobId) {
  assert.ok(Array.isArray(entries)); const found = [];
  for (const entry of entries.slice(-512)) for (const row of entry.logLines ?? []) {
    const values = typeof row === 'string' ? [row] : Array.isArray(row.messages) ? row.messages : [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      let text = value.replace(/^\[[A-Z]+\]\s+/, '');
      if (!text.includes(marker)) continue;
      assert.ok(text.length <= 16384, 'Diagnostic log exceeds fixed bound');
      if (text.startsWith('"')) { const decoded = JSON.parse(text); assert.equal(typeof decoded, 'string'); text = decoded; }
      const at = text.indexOf(marker); if (at < 0) continue;
      const record = JSON.parse(text.slice(at + marker.length));
      assert.equal(record.jobId, jobId); found.push(record.value); assert.ok(found.length <= 4);
    }
  }
  return found;
}
async function collectPrivateEvidence(session, ctx, prepared) {
  await (await engine('cloud')).verifyCloud(session, ctx);
  const client = serviceClient(session, ctx, prepared.key);
  try {
    const ledger = await client.query('imageDiagnosticProbe:snapshot', {});
    await ctx.receipt('image-final-ledger', ledger);
    if (!session.imageJobId && ledger.jobs.length === 1) { session.imageJobId = ledger.jobs[0].jobId; await ctx.persist(); }
  }
  catch { await ctx.receipt('image-final-ledger-unavailable', { status: 'UNKNOWN', fullNewCeilingRetained: 2000000 }); }
  const response = await ctx.fetch(session.target.deploymentUrl + '/api/stream_function_logs?cursor=0', {
    headers: { Authorization: 'Convex ' + prepared.key }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200); const parsed = JSON.parse(await boundedText(response));
  const found = extractDiagnostics(parsed.entries, prepared.marker, session.imageJobId);
  await ctx.receipt('image-private-diagnostics', { status: found.length ? 'CAPTURED' : 'UNAVAILABLE', records: found });
  return found.map(publicDiagnostic);
}

export async function oneImage(session, ctx, prepared, inputs, cloudOverride, sync = durable) {
  const cloud = cloudOverride ?? await engine('cloud');
  await verifyInputs(); ctx.signal?.throwIfAborted(); await cloud.verifyCloud(session, ctx);
  assert.ok(Date.now() - prepared.price.observedAt < 3600000);
  const intent = { issuedAt: Date.now(), target: session.target, maximumNewSubmissions: 1, maximumNewUnknownLiabilityUnits: 2000000,
    originalPossibleLiabilityUnits: 2700000, existingV1UnknownUnits: 100000, cumulativePossibleLiabilityUnits: 4800000,
    promptSha256: inputs.promptSha256, wireSha256: inputs.wireSha256, noAutomaticPaidRetry: true };
  const issuedFile = path.join(session.receiptDir, 'issued-image-only.json');
  await cloud.privateWrite(issuedFile, intent, { exclusive: true }); await sync(issuedFile);
  session.imageIssued = true; await ctx.persist();
  const submitted = await prepared.client.mutation('runtimeMediaJobs:submit', { ...prepared.scope,
    requestId: 'image-diagnostic-' + session.id, kind: 'image', prompt: prepared.prompt });
  session.imageJobId = submitted.jobId; await ctx.persist(); await ctx.receipt('image-submitted', submitted);
  const deadline = Date.now() + 90000; let job;
  for (;;) {
    ctx.signal?.throwIfAborted();
    job = await prepared.client.mutation('runtimeMediaJobs:get', { ...prepared.scope, jobId: submitted.jobId });
    if (['ready', 'failed', 'submission_unknown', 'cancelled', 'expired'].includes(job.state)) break;
    assert.ok(Date.now() < deadline, 'Image observation deadline; do not resubmit'); await new Promise(resolve => setTimeout(resolve, 500));
  }
  await ctx.receipt('image-terminal-job', job);
  if (job.state !== 'ready') return { status: 'IMAGE_FAIL_OR_UNKNOWN', state: job.state, failureCode: job.failureCode ?? null, actualSuccess: false };
  const runtime = await import(pathToFileURL(path.join(session.backendDir, 'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
  const sdk = new runtime.CortexRuntimeClient({ deploymentUrl: session.target.deploymentUrl,
    assetHttpUrl: session.target.deploymentUrl.replace('.cloud', '.site'), scope: prepared.scope, fetchToken: prepared.fetchToken });
  try {
    const blob = await sdk.fetchAsset({ assetId: job.asset.assetId, version: job.asset.assetVersion }), bytes = Buffer.from(await blob.arrayBuffer());
    assert.ok(bytes.length > 0 && bytes.length <= 20000000); assert.equal(bytes.length, job.asset.sizeBytes); assert.equal(sha(bytes), job.asset.contentHash);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]); assert.equal(bytes.readUInt32BE(16), 1024); assert.equal(bytes.readUInt32BE(20), 1024);
    await (await engine('cloud')).privateWrite(path.join(session.receiptDir, 'actual-image.png'), bytes, { exclusive: true });
    const ledger = await prepared.admin.query('imageDiagnosticProbe:snapshot', {}); assert.equal(ledger.attempts.length, 1);
    const attempt = ledger.attempts[0]; assert.equal(attempt.reservationUnits, 2000000); assert.equal(attempt.state, 'uncertain'); assert.equal(attempt.slotReleased, true);
    assert.ok(ledger.accounts.every(row => row.activeConcurrency === 0 && row.reservedUnits === 0 && row.uncertainUnits === 2000000));
    await ctx.receipt('image-actual-success', { observedAt: Date.now(), bytes: bytes.length, sha256: sha(bytes), privateDeliveryVerified: true, ledger, actualAcceptedByIndependentReview: false });
    return { status: 'IMAGE_READY_PENDING_REVIEW', state: job.state, failureCode: null, actualSuccess: true, imageSha256: sha(bytes) };
  } finally { await sdk.close(); }
}

export async function runImageDiagnostic({ reviewSha256, signal, services, sessionRoot = PRIVATE_ROOT } = {}) {
  assert.match(reviewSha256 ?? '', /^[a-f0-9]{64}$/); const inputs = await verifyInputs();
  const runner = await engine('runner'), cloud = await engine('cloud');
  const svc = services ?? { ...cloud, prepareHost, oneImage, collectPrivateEvidence };
  assert.ok(services || sessionRoot === PRIVATE_ROOT);
  await fs.mkdir(sessionRoot, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const stat = await fs.lstat(sessionRoot); assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700);
  await durable(sessionRoot);
  // The reviewed additional-call allowance is consumed once across all sessions, including a lost reply or interrupted setup.
  // Never delete this guard during cleanup. A new attempt requires a newly reviewed procedure receipt.
  const guardPath = path.join(sessionRoot, 'image-review-' + reviewSha256 + '.json');
  await fs.writeFile(guardPath, JSON.stringify({ status: 'PREPARING_OR_UNKNOWN', reviewSha256,
    createdAt: Date.now(), maximumNewSubmissions: 1, maximumNewUnknownLiabilityUnits: 2000000 }), { flag: 'wx', mode: 0o600 });
  await durable(guardPath);
  const session = await runner.newSession(sessionRoot, 'image-renewal-diagnostic'), ctx = await runner.createContext(session, { signal, logger: () => {} });
  const persist = ctx.persist;
  ctx.persist = async () => { await persist(); await durable(path.join(session.runDir, 'session.json')); };
  await ctx.persist(); await durable(session.runDir); await durable(path.dirname(session.runDir));
  await runner.privateWrite(guardPath, JSON.stringify({ status: 'PREPARING_OR_UNKNOWN', reviewSha256, sessionId: session.id,
    maximumNewSubmissions: 1, maximumNewUnknownLiabilityUnits: 2000000 }));
  await durable(guardPath);
  let prepared, result = { status: 'IMAGE_FAIL_OR_UNKNOWN', actualSuccess: false }, failure = false, diagnostics = [], cleanupFailed = false;
  try {
    await runner.sessionActionLock(session, async () => {
      signal?.throwIfAborted(); await svc.createCloud(session, ctx); await svc.verifyCloud(session, ctx);
      prepared = await svc.prepareHost(session, ctx, inputs, reviewSha256);
      result = await svc.oneImage(session, ctx, prepared, inputs); failure = !result.actualSuccess;
    });
  } catch { failure = true; await ctx.receipt('image-interrupted-or-unknown', { status: 'UNKNOWN', imageIssued: session.imageIssued === true,
    fullNewCeilingRetained: session.imageIssued ? 2000000 : 0, originalPossibleLiabilityRetained: 2700000, automaticPaidRetries: 0 }).catch(() => {}); }
  finally {
    try { await ctx.stopChildren(); } catch { failure = true; }
    const cleanupCtx = await runner.createContext(session, { cleanup: true, logger: () => {} });
    if (prepared && session.imageIssued) {
      try { diagnostics = await svc.collectPrivateEvidence(session, cleanupCtx, prepared); }
      catch { await cleanupCtx.receipt('image-diagnostics-unavailable', { status: 'UNAVAILABLE', noCauseInferred: true }).catch(() => {}); }
    }
    try { await runner.sessionActionLock(session, () => runner.cleanupSession(session, cleanupCtx, {
      removeDocker: async current => { assert.equal(current.container, null); }, deleteCloud: svc.deleteCloud,
    })); } catch { cleanupFailed = true; failure = true; await exactRecovery(session, cleanupCtx); }
    await cleanupCtx.receipt('image-safe-summary', { ...result, diagnostics, cleanup: session.phase, failure,
      originalAttempts: 8, originalPossibleLiabilityUnits: 2700000, maximumNewSubmissions: 1, maximumNewUnknownLiabilityUnits: 2000000,
      existingV1Attempts: 1, existingV1UnknownUnits: 100000, priorAttempts: 9, priorPossibleLiabilityUnits: 2800000,
      cumulativeMaximumPossibleLiabilityUnits: 4800000, manifest19Activated: false }).catch(() => {});
    await runner.privateWrite(guardPath, JSON.stringify({ status: 'CONSUMED_NO_REEXECUTION', reviewSha256, sessionId: session.id,
      imageIssued: session.imageIssued === true, cleanup: session.phase, maximumNewSubmissions: 1,
      maximumNewUnknownLiabilityUnits: 2000000 })).then(() => durable(guardPath)).catch(() => {});
  }
  return { ...result, sessionId: session.id, diagnostics, cleanup: session.phase, cleanupFailed, failure, manifest19Activated: false };
}

async function exactRecovery(session, ctx) {
  let previous = {};
  try { previous = await json(path.join(session.receiptDir, 'cleanup-recovery.json')); } catch { /* Correct command still survives. */ }
  await ctx.receipt('cleanup-recovery', { ...previous, status: 'FAILED', sessionId: session.id,
    recoveryCommand: `${NODE} ${path.join(HERE, 'image-diagnostic.mjs')} cleanup ${session.id}`, noModelDispatchInRecovery: true });
}

async function approval(file) {
  const raw = await fs.readFile(file), value = JSON.parse(raw);
  assert.equal(value.verdict, 'APPROVED'); assert.equal(value.scope, 'one-additional-governed-image-diagnostic');
  assert.equal(value.maximumNewImageSubmissions, 1); assert.equal(value.maximumNewUnknownLiabilityUnits, 2000000);
  assert.equal(value.originalPossibleLiabilityUnits, 2700000); assert.equal(value.existingV1UnknownUnits, 100000);
  assert.equal(value.cumulativeMaximumPossibleLiabilityUnits, 4800000);
  for (const name of ['image-diagnostic.mjs', 'image-probe.ts', 'diagnostic.ts', 'inputs.json']) assert.equal(value.files[name], sha(await fs.readFile(path.join(HERE, name))));
  return sha(raw);
}
async function main(args) {
  if (!args.length || args.length === 1 && args[0] === '--dry-run') { const inputs = await verifyInputs(); return { status: 'OFFLINE_ONLY', networkCalls: 0, modelCalls: 0,
    resourceCreations: 0, materialSources: inputs.materialSources, nativeFiles: inputs.nativeFiles,
    maximumNewImageSubmissions: 1, maximumNewUnknownLiabilityUnits: 2000000, priorAttempts: 9,
    priorPossibleLiabilityUnits: 2800000, cumulativeMaximumPossibleLiabilityUnits: 4800000 }; }
  if (args.length === 2 && args[0] === '--execute') {
    assert.equal(process.versions.node, '24.15.0'); const reviewSha256 = await approval(path.resolve(args[1]));
    const controller = new AbortController(), stop = () => controller.abort(Error('Image diagnostic canceled'));
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    try { const result = await runImageDiagnostic({ reviewSha256, signal: controller.signal }); if (result.failure) process.exitCode = 1; return result; }
    finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
  }
  if (args.length === 2 && args[0] === 'cleanup') {
    const runner = await engine('runner'), cloud = await engine('cloud'), session = await runner.loadSession(PRIVATE_ROOT, args[1]);
    assert.equal(session.mode, 'image-renewal-diagnostic'); const ctx = await runner.createContext(session, { cleanup: true, logger: () => {} });
    try { await runner.sessionActionLock(session, () => runner.cleanupSession(session, ctx, { removeDocker: async current => { assert.equal(current.container, null); }, deleteCloud: cloud.deleteCloud })); }
    catch (error) { await exactRecovery(session, ctx); throw error; }
    return { sessionId: session.id, cleanup: session.phase };
  }
  throw Error('Invalid image diagnostic arguments');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(value => console.log(JSON.stringify(value, null, 2)), () => { console.error('Image diagnostic refused or cleanup needs exact-session recovery; inspect private receipt.'); process.exitCode = 1; });
}
