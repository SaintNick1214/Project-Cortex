/** One standalone V1 stream. Default is offline; the successful seven-call batch is never invoked. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyInputs, prospectiveV1, evaluateV1, ENGINE, KIT, STAGING, OLD_COMMIT } from '../qualification-renewal/renewal.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PRIVATE_ROOT = '/Users/SaintNick/.codex/tmp/cortex-release-v1-renewal-20261031';
const FROZEN = path.join(HERE, '../qualification-renewal');
const MODE = 'v1-renewal-only';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const BOUND = 'agent-tools-32768-512-v1';
const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const engine = name => import(pathToFileURL(path.join(ENGINE, name + '.mjs')));
const replaceOnce = (source, before, after) => {
  assert.equal(source.split(before).length, 2, 'Owned compiled bootstrap shape changed'); return source.replace(before, after);
};
const recoveryCommand = session => `${process.execPath} ${fileURLToPath(import.meta.url)} cleanup ${session.id}`;

async function cleanupContext(runner, session, logger) {
  const ctx = await runner.createContext(session, { cleanup: true, logger });
  const receipt = ctx.receipt;
  ctx.receipt = (name, data) => receipt(name, name === 'cleanup-recovery' ? { ...data, recoveryCommand: recoveryCommand(session) } : data);
  return ctx;
}

async function durable(file) {
  const handle = await fs.open(file, 'r'); try { await handle.sync(); } finally { await handle.close(); }
  const parent = await fs.open(path.dirname(file), 'r'); try { await parent.sync(); } finally { await parent.close(); }
}
async function privateRoot(root) {
  await fs.mkdir(root, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const stat = await fs.lstat(root);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700);
}
async function once(file, value) {
  const { privateWrite } = await engine('cloud');
  await privateWrite(file, value, { exclusive: true }); await durable(file);
}

export function pinnedHostDependencies(distribution, lock) {
  const pins = {};
  for (const [name, version] of Object.entries(distribution.dependencies)) {
    // The reviewed SDK manifest advertises ^1.46.0; the maintained host deliberately pins Convex exactly.
    const required = name === 'convex' ? '1.46.0' : version;
    assert.equal(lock.packages[''].dependencies[name], required, 'Reviewed native lock dependency mismatch: ' + name);
    pins[name] = required;
  }
  return pins;
}

export async function inspect() {
  const inputs = await verifyInputs();
  const prior = await json(path.join(FROZEN, 'live-attempt-2026-10-31.json'));
  assert.equal(prior.status, 'INCOMPLETE_IMAGE_UNKNOWN_V1_NOT_ATTEMPTED');
  assert.equal(prior.actualPassingModes.length, 7); assert.equal(prior.cleanup.status, 'ABSENT');
  assert.equal(prior.financialSnapshot.possibleLiabilityUnits, 2700000);
  const config = await json(path.join(ENGINE, 'cloud-config.json'));
  assert.deepEqual(config, { teamId: 325340, projectId: 3200658, projectSlug: 'cortex-sandboxes', requestedRegion: 'aws-us-east-1' });
  assert.equal(inputs.supplemental.qualification.costBound.maximumCostUnits, 100000);
  assert.equal(inputs.supplemental.qualification.limits.runBudgetUnits, 2000000);
  assert.equal(inputs.supplemental.dispatchEvidence.boundRevision, BOUND);
  pinnedHostDependencies(await json(path.join(STAGING, 'dist/backend/v1/manifest.json')),
    await json(path.join(ENGINE, 'templates/native-package-lock.json')));
  return inputs;
}

export async function reviewedFiles() {
  const files = {};
  for (const file of ['v1-renewal.mjs', 'v1-renewal.test.mjs', 'catalog.ts', 'plan.md',
    '../qualification-renewal/renewal.mjs', '../qualification-renewal/source-inputs.json',
    '../qualification-renewal/supplemental-v1-probe.ts', '../qualification-renewal/live-attempt-2026-10-31.json']) {
    files[file] = sha(await fs.readFile(path.join(HERE, file)));
  }
  return files;
}

export function evaluateLedger(before, after) {
  for (const key of ['attempts', 'operations', 'accounts']) assert.equal(before[key].length, 0, 'V1 host must start with empty financial tables');
  assert.equal(after.attempts.length, 1); assert.equal(after.operations.length, 1); assert.equal(after.accounts.length, 2);
  const attempt = after.attempts[0];
  assert.equal(attempt.state, 'uncertain'); assert.equal(attempt.reservationUnits, 100000); assert.equal(attempt.ordinal, 0);
  assert.equal(attempt.slotReleased, true); assert.ok(!attempt.resultWithheld); assert.match(attempt.dispatchIdentity, /^[a-f0-9]{64}$/);
  assert.equal(after.operations[0]._id, attempt.operationDocumentId);
  for (const kind of ['run', 'tenant']) {
    const accounts = after.accounts.filter(row => row.kind === kind); assert.equal(accounts.length, 1);
    const account = accounts[0]; assert.equal(account.limitUnits, kind === 'run' ? 2000000 : 10000000);
    assert.equal(account.activeConcurrency, 0); assert.equal(account.reservedUnits, 0); assert.equal(account.settledUnits, 0);
    assert.equal(account.uncertainUnits, 100000);
  }
  return { actualV1Dispatches: 1, retainedV1UnknownUnits: 100000, separateRunLimitUnits: 2000000,
    activeConcurrency: 0, aggregateUsdComplete: false, originalEightLiabilityUnchanged: 2700000,
    cumulativeCeilingIncludingSeparateImageDiagnostic: 4800000, cumulativeMaximumCallsIncludingDiagnostic: 10 };
}

async function currentV1Prices(ctx) {
  ctx.signal?.throwIfAborted();
  const sourceUrl = 'https://openrouter.ai/api/v1/model/openai/gpt-4o-mini';
  const response = await ctx.fetch(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, 'Current V1 primary price unavailable');
  const raw = await response.text(), parsed = JSON.parse(raw), record = parsed.data ?? parsed;
  assert.equal(record.id, 'openai/gpt-4o-mini');
  const prompt = Number(record.pricing?.prompt), completion = Number(record.pricing?.completion);
  assert.ok(Number.isFinite(prompt) && prompt >= 0 && Number.isFinite(completion) && completion >= 0);
  assert.ok((32768 * prompt + 512 * completion) * 1000000 <= 100000, 'Current V1 full envelope exceeds unchanged100k ceiling');
  const prices = { observedAt: Date.now(), provenance: 'Current primary price; not aggregate cost settlement or native serving proof',
    models: [{ modelId: record.id, prompt, completion, sourceUrl, responseSha256: sha(raw) }] };
  await ctx.receipt('v1-current-primary-pricing', prices); return prices;
}

async function installHost(session, ctx, inputs) {
  const { privateWrite } = await engine('cloud');
  const { CANDIDATE_PACKAGES } = await engine('docker');
  const archive = path.join(KIT, 'artifacts', OLD_COMMIT, CANDIDATE_PACKAGES.sdk.filename);
  const archiveBytes = await fs.readFile(archive); assert.equal(sha(archiveBytes), CANDIDATE_PACKAGES.sdk.sha256);
  await fs.access(path.join(session.backendDir, 'package.json')).then(() => { throw Error('Never reuse a partial private host'); }, error => { if (error.code !== 'ENOENT') throw error; });
  const lock = await json(path.join(ENGINE, 'templates/native-package-lock.json'));
  lock.packages[''].dependencies['@cortexmemory/sdk'] = 'file:' + archive;
  lock.packages['node_modules/@cortexmemory/sdk'].resolved = 'file:' + archive;
  lock.packages['node_modules/@cortexmemory/sdk'].integrity = 'sha512-' + createHash('sha512').update(archiveBytes).digest('base64');
  const distribution = await json(path.join(STAGING, 'dist/backend/v1/manifest.json'));
  pinnedHostDependencies(distribution, lock);
  assert.equal((await json(path.join(path.dirname(path.dirname(ctx.npmCli)), 'package.json'))).version, '12.2.0');
  await privateWrite(path.join(session.backendDir, 'package.json'), { ...lock.packages[''], private: true, type: 'module', packageManager: 'npm@12.2.0' }, { exclusive: true });
  await privateWrite(path.join(session.backendDir, 'package-lock.json'), lock, { exclusive: true });
  const keypair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  await privateWrite(path.join(session.issuerDir, 'jwt-private.pem'), keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { exclusive: true });
  const jwk = { ...keypair.publicKey.export({ format: 'jwk' }), kid: 'sandbox-' + session.id, alg: 'RS256', use: 'sig' };
  const provider = { type: 'customJwt', issuer: 'https://cortex-sandbox-' + session.id + '.invalid', applicationID: 'cortex-sandbox-' + session.id,
    algorithm: 'RS256', jwks: 'data:application/json;base64,' + Buffer.from(JSON.stringify({ keys: [jwk] })).toString('base64') };
  await ctx.command('v1-host-native-install', ctx.node, [ctx.npmCli, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: session.backendDir, timeoutMs: 300000 });
  const { setupBackend } = await import(pathToFileURL(path.join(STAGING, 'packages/cortex-cli/dist/utils/init/backend-setup.js')));
  const installation = await setupBackend({ projectPath: session.backendDir, sdkPath: path.join(session.backendDir, 'node_modules/@cortexmemory/sdk'), jwtProvider: provider });
  assert.equal(installation.conflicts.length, 0); await ctx.receipt('v1-host-additive-install', installation);
  assert.equal(sha(await fs.readFile(path.join(session.backendDir, 'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))), inputs.backendManifestSha256);
  for (const row of inputs.native) assert.equal(sha(await fs.readFile(path.join(session.backendDir, row.installedHostPath))), row.sha256, 'Installed actual native bytes changed: ' + row.role);
  for (const row of inputs.finiteSources) assert.equal(sha(await fs.readFile(path.join(session.backendDir, 'convex', row.backendPath))), row.backendSha256, 'Installed material source changed: ' + row.backendPath);
  const identity = { issuer: provider.issuer, subject: 'v1-only-' + session.id, metadataUserId: 'v1-only-' + session.id,
    actorKind: 'user', tenantId: 'sandbox-' + session.id, memorySpaceId: 'manual-workspace', capabilities: ['read', 'run', 'tool'],
    resourceAccess: 'space', expiresAt: Math.min(Date.now() + 3600000, session.target.expiresAt) };
  await privateWrite(path.join(session.issuerDir, 'identity.json'), identity, { exclusive: true });
  await ctx.receipt('v1-host-installed', { backendManifestSha256: inputs.backendManifestSha256,
    matchedMaterialSources: inputs.finiteSources.length, matchedNativeFiles: inputs.native.length, paidCalls: 0, eightCallProbeInstalled: false });
  return identity;
}

async function commission(session, ctx, inputs, reviewSha256) {
  const cloud = await engine('cloud'); await cloud.verifyCloud(session, ctx);
  const key = await cloud.getDeployKey(session, ctx);
  const identity = await installHost(session, ctx, inputs), functions = path.join(session.backendDir, 'convex');
  const original = await fs.readFile(path.join(functions, 'runtimeModelPolicyBootstrap.ts'), 'utf8');
  await once(path.join(session.receiptDir, 'v1-original-bootstrap.ts'), original);
  const catalog = await fs.readFile(path.join(HERE, 'catalog.ts'));
  await cloud.privateWrite(path.join(functions, 'v1OnlyCatalog.ts'), catalog, { exclusive: true });
  const deploy = async name => {
    await cloud.verifyCloud(session, ctx);
    await ctx.command(name, ctx.node, [path.join(session.backendDir, 'node_modules/convex/bin/main.js'),
      'dev', '--once', '--typecheck', 'enable', '--codegen', 'enable', '--tail-logs', 'disable'], {
      cwd: session.backendDir, env: { CONVEX_DEPLOY_KEY: key, CONVEX_DEPLOYMENT: 'dev:' + session.target.name }, timeoutMs: 180000,
    });
  };
  await deploy('v1-initial-host-deploy');
  const requireHost = createRequire(path.join(session.backendDir, 'package.json'));
  const { ConvexHttpClient } = requireHost('convex/browser');
  const client = new ConvexHttpClient(session.target.deploymentUrl, { logger: false, fetch: async (url, options) => {
    ctx.signal?.throwIfAborted(); await cloud.verifyCloud(session, ctx);
    return ctx.fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([
      AbortSignal.timeout(90000), ...(ctx.signal ? [ctx.signal] : []), ...(options?.signal ? [options.signal] : []),
    ]) });
  } });
  client.setAdminAuth(key);
  const availability = await client.action('v1OnlyCatalog:check', {});
  assert.equal(availability.status, 200); assert.equal(availability.models.length, 1);
  assert.equal(availability.models[0].id, 'openai/gpt-4o-mini'); await ctx.receipt('v1-native-catalog', availability);
  const authority = await client.mutation('runtimeAuth:provision', identity);
  assert.equal(authority.tenantId, identity.tenantId); assert.equal(authority.memorySpaceId, identity.memorySpaceId);
  const reference = Object.fromEntries(['principalId', 'principalVersion', 'membershipId', 'membershipVersion', 'grantId', 'grantVersion',
    'tenantId', 'tenantEpoch', 'memorySpaceId', 'memorySpaceEpoch'].map(name => [name, authority[name]]));
  const probe = await fs.readFile(path.join(FROZEN, 'supplemental-v1-probe.ts'));
  const prices = await currentV1Prices(ctx);
  const { reference: intended, ...manifest } = prospectiveV1({ ...inputs, supplementalProbeSha256: sha(probe) }, session, reference, prices, reviewSha256);
  assert.deepEqual(intended, reference);
  const bootstrap = 'import { SUPPLEMENTAL_V1_MANIFEST } from "./renewalV1Manifest";\n' + replaceOnce(replaceOnce(original,
    'OBSERVED_GATEWAY_POLICY_MANIFEST_V18])', 'OBSERVED_GATEWAY_POLICY_MANIFEST_V18, SUPPLEMENTAL_V1_MANIFEST])'),
    'manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest)',
    '(manifest === SUPPLEMENTAL_V1_MANIFEST || manifest.classification === "reviewed-actual") && manifests.some((entry) => entry === manifest)');
  for (const [name, value] of [
    ['renewalV1Manifest.ts', 'import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";\nexport const SUPPLEMENTAL_V1_MANIFEST = ' + JSON.stringify(manifest) + ' as const satisfies DeploymentPolicyManifest;\n'],
    ['renewalV1Scope.ts', 'export const V1_REFERENCE = ' + JSON.stringify(reference) + ' as const;\nexport const V1_OPERATION = ' + JSON.stringify(manifest.manifestId) + ';\n'],
    ['renewalV1Probe.ts', probe],
  ]) await cloud.privateWrite(path.join(functions, name), value, { exclusive: true });
  await cloud.privateWrite(path.join(functions, 'runtimeModelPolicyBootstrap.ts'), bootstrap);
  await deploy('v1-commissioning-deploy');
  const installed = await client.mutation('runtimeModelPolicy:installDeploymentPolicy', { manifestId: manifest.manifestId, expectedRevision: 3 });
  assert.equal(installed.manifestId, manifest.manifestId); assert.equal(installed.revision, 3);
  await ctx.receipt('v1-only-prospective-install', { installed, manifest, originalBootstrapSha256: sha(original),
    exactProbeSha256: sha(probe), actualEvidencePending: true, onlyPrivateCompiledObjectTrustAdded: true });
  return { client, manifest, probeSha256: sha(probe) };
}

export async function observeOne(session, ctx, prepared, reviewSha256, sessionRoot) {
  const cloud = await engine('cloud');
  const before = await prepared.client.query('renewalV1Probe:snapshot', {}); await ctx.receipt('v1-only-before', before);
  for (const key of ['attempts', 'operations', 'accounts']) assert.equal(before[key].length, 0, 'Refuse a nonempty V1 financial baseline');
  await inspect(); ctx.signal?.throwIfAborted(); await cloud.verifyCloud(session, ctx);
  assert.equal(sha(await fs.readFile(path.join(session.backendDir, 'convex/renewalV1Probe.ts'))), prepared.probeSha256);
  const intent = { issuedAt: Date.now(), sessionId: session.id, target: session.target, maximumPaidRequests: 1,
    maximumUnknownLiabilityUnits: 100000, runBudgetUnits: 2000000, automaticPaidRetries: 0, ordinal: 0,
    semanticId: prepared.manifest.manifestId + ':fixed-stream', boundRevision: BOUND,
    exactToolContract: prepared.manifest.dispatchEvidence[0].toolContract, outputTokens: 512,
    reviewSha256, probeSha256: prepared.probeSha256, manifestSha256: sha(prepared.manifest) };
  await once(path.join(session.receiptDir, 'issued-v1-only.json'), intent);
  // This independent global marker also survives SIGKILL and prevents a fresh execution becoming a paid retry.
  await once(path.join(sessionRoot, 'issued-v1-only.json'), intent);
  try {
    const raw = await prepared.client.action('renewalV1Probe:observe', {});
    await ctx.receipt('v1-only-raw', raw); evaluateV1(raw);
    const after = await prepared.client.query('renewalV1Probe:snapshot', {}); await ctx.receipt('v1-only-after', after);
    const financial = evaluateLedger(before, after);
    const outcome = { status: 'ACTUAL_V1_STREAM_OBSERVED_PENDING_INDEPENDENT_REVIEW', financial,
      checkedAt: raw.terminalReceipts[0].capturedAt, completedAt: raw.completedAt, rawSha256: sha(raw),
      target: session.target, probeSha256: prepared.probeSha256, reviewSha256,
      toolsExecuted: false, generationSeparatelyObserved: false, revision19Created: false, ciSelectorsChanged: false };
    await ctx.receipt('v1-only-outcome', outcome); return outcome;
  } catch (error) {
    const { qualificationFailureDiagnostic } = await engine('qualification');
    let ledger; try { ledger = await prepared.client.query('renewalV1Probe:snapshot', {}); } catch { ledger = { readUnavailable: true }; }
    await ctx.receipt('v1-only-failure', { status: 'FAILED_OR_UNKNOWN_NO_RETRY', ledger,
      diagnostic: qualificationFailureDiagnostic(error), retainedPotentialLiabilityUnits: 100000, automaticPaidRetries: 0 });
    throw Error('V1 failed or is UNKNOWN; retain100k liability and never rerun paid setup');
  }
}

export async function runV1({ signal, reviewSha256, services, logger = () => {}, sessionRoot = PRIVATE_ROOT } = {}) {
  assert.match(reviewSha256 ?? '', /^[a-f0-9]{64}$/, 'Independent current review required');
  assert.equal(process.versions.node, '24.15.0');
  const inputs = await inspect(), runner = await engine('runner');
  assert.ok(services || sessionRoot === PRIVATE_ROOT, 'CLI cannot redirect private sessions');
  const svc = services ?? { ...(await engine('cloud')), commission, observeOne };
  await privateRoot(sessionRoot);
  await fs.access(path.join(sessionRoot, 'execution-intent.json')).then(() => { throw Error('Existing V1 execution intent: recover cleanup only; no new paid run'); }, error => { if (error.code !== 'ENOENT') throw error; });
  const session = await runner.newSession(sessionRoot, MODE), ctx = await runner.createContext(session, { signal, logger });
  const persist = ctx.persist;
  ctx.persist = async () => { await persist(); await durable(path.join(session.runDir, 'session.json')); };
  let outcome, failure;
  try {
    await once(path.join(sessionRoot, 'execution-intent.json'), { sessionId: session.id, maximumPaidRequests: 1,
      maximumUnknownLiabilityUnits: 100000, reviewSha256, cleanupCommand: recoveryCommand(session) });
    logger('V1-only session: ' + session.id + '; exact cleanup: ' + recoveryCommand(session));
    await runner.sessionActionLock(session, async () => {
      signal?.throwIfAborted(); session.phase = 'CREATING_V1_TARGET'; await ctx.persist();
      await svc.createCloud(session, ctx); await svc.verifyCloud(session, ctx);
      session.phase = 'COMMISSIONING_V1_ONLY'; await ctx.persist();
      const prepared = await svc.commission(session, ctx, inputs, reviewSha256);
      session.phase = 'OBSERVING_ONE_V1'; await ctx.persist();
      outcome = await svc.observeOne(session, ctx, prepared, reviewSha256, sessionRoot);
    });
  } catch (error) {
    failure = error;
    const { qualificationFailureDiagnostic } = await engine('qualification');
    await ctx.receipt('v1-only-lifecycle-failure', { status: 'FAILED_OR_UNKNOWN', automaticPaidRetries: 0,
      diagnostic: qualificationFailureDiagnostic(error), cleanupCommand: recoveryCommand(session) }).catch(() => {});
  }
  finally {
    try { await ctx.stopChildren(); } catch (error) { failure ??= error; }
    const cleanupCtx = await cleanupContext(runner, session, logger);
    try {
      await runner.sessionActionLock(session, () => runner.cleanupSession(session, cleanupCtx, {
        removeDocker: async owned => { assert.equal(owned.container, null, 'V1-only cannot own Docker'); }, deleteCloud: svc.deleteCloud,
      }));
    } catch (error) { failure = failure ? new AggregateError([failure, error], 'V1 failed and exact cleanup remains required') : error; }
  }
  if (failure) {
    const error = Error('V1-only failed or is UNKNOWN; inspect private receipts and cleanup. Session: ' + session.id);
    error.sessionId = session.id; error.cause = failure; throw error;
  }
  return { sessionId: session.id, phase: session.phase, outcome, originalSevenRepeated: false, revision19Created: false };
}

async function reviewed(file) {
  const stat = await fs.lstat(file); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid());
  const raw = await fs.readFile(file), review = JSON.parse(raw);
  assert.equal(review.verdict, 'APPROVED'); assert.equal(review.scope, 'standalone-v1-one-stream-renewal');
  assert.ok(typeof review.reviewer === 'string' && review.reviewer.startsWith('/root/') && review.reviewer !== '/root/release_ci_target_recovery');
  assert.equal(review.maximumPaidRequests, 1); assert.equal(review.maximumUnknownLiabilityUnits, 100000);
  assert.equal(review.runBudgetUnits, 2000000); assert.deepEqual(review.files, await reviewedFiles()); return sha(raw);
}

export async function main(args = process.argv.slice(2)) {
  if (!args.length || args.length === 1 && args[0] === '--dry-run') {
    const inputs = await inspect();
    return { status: 'OFFLINE_PREPARATION_ONLY', networkCalls: 0, resourceCreations: 0, modelCalls: 0,
      maximumPaidRequests: 1, maximumUnknownLiabilityUnits: 100000, separateRunBudgetUnits: 2000000,
      cumulativePotentialIncludingImageDiagnostic: 4800000, cumulativeMaximumCalls: 10,
      materialSourcesMatched: inputs.finiteSources.length, installedNativeIdentityInputs: inputs.native.length,
      files: await reviewedFiles(), executionRequiresNonAuthorReview: true, revision19Created: false };
  }
  if (args.length === 2 && args[0] === 'cleanup') {
    assert.match(args[1], UUID); const runner = await engine('runner'), cloud = await engine('cloud');
    const session = await runner.loadSession(PRIVATE_ROOT, args[1]); assert.equal(session.mode, MODE);
    assert.equal(session.launcherHost, os.hostname());
    if (session.launcherPid && session.launcherPid !== process.pid) {
      try { process.kill(session.launcherPid, 0); throw Error('Original V1 launcher is active'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    const ctx = await cleanupContext(runner, session);
    await runner.sessionActionLock(session, () => runner.cleanupSession(session, ctx, {
      removeDocker: async owned => { assert.equal(owned.container, null); }, deleteCloud: cloud.deleteCloud,
    }));
    return { sessionId: session.id, phase: session.phase, paidCalls: 0 };
  }
  if (args.length === 2 && args[0] === '--execute') {
    const reviewSha256 = await reviewed(path.resolve(args[1])), controller = new AbortController();
    const abort = () => controller.abort(Error('Operator canceled V1 renewal'));
    process.on('SIGINT', abort); process.on('SIGTERM', abort);
    try { return await runV1({ signal: controller.signal, reviewSha256, logger: console.log }); }
    finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); }
  }
  throw Error('Usage: v1-renewal.mjs [--dry-run | --execute INDEPENDENT_REVIEW_JSON | cleanup EXACT_SESSION_UUID]');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error?.sessionId ? 'V1-only stopped; retain private receipts. Session: ' + error.sessionId : 'V1-only stopped before a verified outcome; no automatic retry.');
    process.exitCode = 1;
  });
}
