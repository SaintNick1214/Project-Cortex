/** Bounded read-only CI readiness. No settings writes, deploy, JWT issuance or inference. */
import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { createHash, createPrivateKey } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const execute = promisify(execFile), root = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q = dirname(new URL(import.meta.url).pathname), old = join(q, '../task16-ci-runtime-functional-v2-20261009/native-actual');
const sha = data => createHash('sha256').update(data).digest('hex');
const publish = (name, value) => writeFile(join(q, name + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const pin = async path => { const bytes = await readFile(join(root, path)); return { path, bytes: bytes.length, sha256: sha(bytes) }; };
const safeEnv = { PATH: dirname(process.execPath) + ':' + process.env.PATH, HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR, LANG: 'en_US.UTF-8', CI: 'true', CORTEX_TEST_ENV_MODE: 'explicit',
  CONVEX_URL: 'https://unit.invalid', CONVEX_URL_CLI: 'https://unit.invalid', NODE_OPTIONS: '--max-old-space-size=6144' };
async function readCommand(name, binary, args, cwd = root) {
  const startedAt = Date.now();
  const result = await execute(binary, args, { cwd, env: safeEnv, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  await writeFile(join(q, name + '.stdout.log'), result.stdout, { flag: 'wx' });
  await writeFile(join(q, name + '.stderr.log'), result.stderr, { flag: 'wx' });
  await publish(name + '-command', { binary, args, cwd, exitCode: 0, elapsedMs: Date.now() - startedAt,
    deadlineMs: 30000, testsExecuted: false, modelCalls: 0, credentialsPassed: false });
  return result.stdout;
}

try {
  const pointer = await json(join(old, 'fixture-pointer1.json'));
  const state = await json(join(pointer.privateDirectory, 'state.json'));
  const accessToken = (await json(join(homedir(), '.convex/config.json'))).accessToken;
  assert.equal(typeof accessToken, 'string');
  const get = async path => {
    const result = await fetch('https://api.convex.dev' + path, { headers: { Authorization: 'Bearer ' + accessToken,
      'Convex-Client': 'npm-cli-1.46.0' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    return { status: result.status, value: await result.json() };
  };
  const teams = await get('/api/teams'); assert.equal(teams.status, 200);
  const teamRows = Array.isArray(teams.value) ? teams.value : teams.value.teams;
  const team = teamRows.find(row => row.id === 325340); assert.ok(team?.slug);
  const targets = [];
  for (const [kind, projectId, deploymentName] of [['sdk', 3176493, 'steady-snake-253'], ['cli', 3176494, 'usable-sheep-908']]) {
    const expected = state.targets.find(row => row.kind === kind); assert.equal(expected.projectId, projectId);
    assert.equal(expected.deploymentName, deploymentName);
    const results = await Promise.all([get('/v1/projects/' + projectId), get('/v1/deployments/' + deploymentName),
      get('/v1/projects/' + projectId + '/list_deployments'), get('/v1/teams/' + team.slug + '/projects/' + expected.projectSlug)]);
    const [project, deployment, list, scopedProject] = results;
    for (const result of results) assert.equal(result.status, 200);
    assert.equal(project.value.id, projectId); assert.equal(project.value.slug, expected.projectSlug);
    assert.equal(scopedProject.value.id, projectId);
    assert.equal(deployment.value.projectId, projectId); assert.equal(deployment.value.deploymentType, 'dev');
    assert.equal(deployment.value.kind, 'cloud'); assert.equal(deployment.value.deploymentUrl, expected.url);
    assert.equal(list.value.length, 1); assert.equal(list.value[0].name, deploymentName);
    const credentialPath = join(pointer.privateDirectory, kind + '-credentials.json');
    const credentials = await json(credentialPath); assert.ok(credentials.deployKey.startsWith('dev:' + deploymentName + '|'));
    assert.equal(credentials.projectId, projectId); assert.equal(credentials.url, expected.url);
    const mode = (await stat(credentialPath)).mode & 0o777; assert.equal(mode, 0o600);
    targets.push({ kind, projectId, projectSlug: expected.projectSlug, deploymentName, url: expected.url,
      teamId: team.id, teamSlug: team.slug, teamScopedProjectStatus: scopedProject.status,
      projectStatus: project.status, deploymentStatus: deployment.status, listStatus: list.status,
      soleCloudDev: true, production: false, credentialMode: '0600', devKeyPrefixExact: true,
      credentialValueReadForPrefixOnly: true, checkedAtUtc: new Date().toISOString() });
  }
  await publish('targets-readonly1', { status: 'CURRENT_TWO_DISTINCT_OWNED_SOLE_CLOUD_DEV_TARGETS', targets,
    managementMutations: 0, main3174742Touched: false, otherGraphsTouched: false, secretValuesPrinted: false });

  const secrets = JSON.parse(await readCommand('github-secret-names1', 'gh', ['secret', 'list', '--repo', 'SaintNick1214/Project-Cortex', '--json', 'name']));
  const variables = JSON.parse(await readCommand('github-variable-names1', 'gh', ['variable', 'list', '--repo', 'SaintNick1214/Project-Cortex', '--json', 'name']));
  const requiredSecrets = ['CORTEX_CI_CONVEX_URL', 'CORTEX_CI_CONVEX_DEPLOY_KEY', 'CORTEX_CI_CONVEX_URL_CLI',
    'CORTEX_CI_CONVEX_DEPLOY_KEY_CLI', 'CORTEX_CI_AUTH_PRIVATE_KEY'];
  const requiredVariables = ['CORTEX_CI_DISPOSABLE_DEPLOYMENTS', 'CORTEX_CI_AUTH_ISSUER', 'CORTEX_CI_AUTH_AUDIENCE',
    'CORTEX_CI_MODEL_MANIFEST_ID', 'CORTEX_CI_MODEL_MANIFEST_REVISION'];
  const privateKeyPath = join(pointer.privateDirectory, 'ci-jwt-private.pem');
  const key = createPrivateKey(await readFile(privateKeyPath));
  assert.equal(key.asymmetricKeyType, 'rsa'); assert.ok(key.asymmetricKeyDetails.modulusLength >= 2048);
  assert.equal((await stat(privateKeyPath)).mode & 0o777, 0o600);
  assert.equal((await stat(pointer.privateDirectory)).mode & 0o777, 0o700);
  await publish('settings-names-readonly1', { repository: 'SaintNick1214/Project-Cortex',
    checkedAtUtc: new Date().toISOString(), secretNames: secrets.map(row => row.name), variableNames: variables.map(row => row.name),
    missingSecrets: requiredSecrets.filter(name => !secrets.some(row => row.name === name)),
    missingVariables: requiredVariables.filter(name => !variables.some(row => row.name === name)),
    localPreparedAuthentication: { privateDirectory: pointer.privateDirectory, privateKeyPath, directoryMode: '0700',
      keyMode: '0600', algorithm: 'RS256', modulusLength: key.asymmetricKeyDetails.modulusLength,
      issuer: 'https://cortex-ci-runtime.example/', audience: 'cortex-ci-runtime', jwtIssued: false },
    githubSettingsWrites: 0, dispatches: 0, secretValuesRequested: false });

  const manifests = await import(pathToFileURL(join(root, 'convex-dev/runtimeGatewayQualifications.ts')));
  const current = manifests.DEFAULT_GATEWAY_POLICY_MANIFEST;
  const accepted = await json(join(q, '../task10-embedding-functional-v2-20261008/native-actual/shipped-default-manifest9.json'));
  assert.deepEqual(current, accepted); assert.equal(current.revision, 9); assert.equal(current.classification, 'reviewed-actual');
  const acceptedV3 = await json(join(q, '../task04-confirmed-unknown-cost-v2-20261008/installed-manifest-candidate.json'));
  assert.deepEqual(manifests.TEXT_GATEWAY_POLICY_MANIFEST_V3, acceptedV3);
  assert.deepEqual(current.dispatchEvidence.slice(0, 4), manifests.AGENT_GATEWAY_POLICY_MANIFEST_V5.dispatchEvidence);
  assert.deepEqual(current.qualifications.slice(0, 4), manifests.AGENT_GATEWAY_POLICY_MANIFEST_V5.qualifications);
  const realRecords = [
    ['99154716ae1c4a9e69c299c9c60cdc7437ff129d2c11095767e5eb14f2076976', '../task07-agent-execution-functional-v2-20261008/native-actual/qualification-actual-record1.json'],
    ['0346ead2ce3cdb056b53c1423d36f45a84c32c0307e34f0e50b3be877086a784', '../task10-embedding-functional-v2-20261008/native-actual/large-actual-qualification-record1.json'] ];
  const recordPins = [];
  for (const [expectedHash, path] of realRecords) { const bytes = await readFile(join(q, path)); assert.equal(sha(bytes), expectedHash); recordPins.push({ path: relative(root, join(q, path)), sha256: expectedHash, bytes: bytes.length }); }
  const manifestFile = await readFile(join(root, 'dist/backend/v1/manifest.json'));
  const distribution = JSON.parse(manifestFile), qualificationFile = distribution.files.find(row => row.sourcePath === 'convex-dev/runtimeGatewayQualifications.ts');
  const bootstrapFile = distribution.files.find(row => row.sourcePath === 'convex-dev/runtimeModelPolicyBootstrap.ts');
  assert.equal((await pin('convex-dev/runtimeGatewayQualifications.ts')).sha256, qualificationFile.sourceSha256);
  assert.equal((await pin('convex-dev/runtimeModelPolicyBootstrap.ts')).sha256, bootstrapFile.sourceSha256);
  const now = Date.now(), expiry = Math.min(...current.dispatchEvidence.map(row => row.expiresAt));
  assert.ok(now < expiry); assert.equal(new Date(expiry).toISOString(), '2026-10-09T08:50:12.383Z');
  await publish('compiled-proof-readonly1', { checkedAtUtc: new Date(now).toISOString(), manifestId: current.manifestId,
    revision: current.revision, classification: current.classification, exactAcceptedTask10ManifestEqual: true,
    exactAcceptedTask04V3Equal: true, preservedOldFourQualificationAndDispatchObjects: true,
    registeredManifests: [manifests.TEXT_GATEWAY_POLICY_MANIFEST_V3, manifests.AGENT_GATEWAY_POLICY_MANIFEST_V5, current].map(row => ({ manifestId: row.manifestId, revision: row.revision })),
    compiledBootstrapImportsActualRegistry: true, sourcePins: await Promise.all(['convex-dev/runtimeGatewayQualifications.ts','convex-dev/runtimeModelPolicyBootstrap.ts'].map(pin)),
    builtDistributionManifest: { sha256: sha(manifestFile), files: distribution.files.length, tables: distribution.tables.length },
    earliestExpiryUtc: new Date(expiry).toISOString(), remainingMsAtInspection: expiry - now,
    currentAtInspectionOnly: true, proofTimestampsChanged: false, paidRequalificationCalls: 0, acceptedNativeRecordPins: recordPins,
    dispatchEvidence: current.dispatchEvidence.map(row => ({ receiptId: row.receiptId, nativeInterface: row.nativeInterface,
      modelId: row.modelId, evidenceHash: row.evidenceHash, priceRevision: row.priceRevision, boundRevision: row.boundRevision,
      featureEnvelope: row.inputBound.featureEnvelope, checkedAt: row.checkedAt, expiresAt: row.expiresAt, terminalCost: row.terminalCost })) });

  const workflowText = await readFile(join(root, '.github/workflows/pr-checks.yml'), 'utf8'), workflow = yaml.load(workflowText);
  const selectedJobs = Object.fromEntries(['setup-and-purge', 'test-typescript', 'test-vercel-ai-provider', 'test-cli', 'cleanup-runtime-fixtures'].map(name => {
    const job = workflow.jobs[name];
    return [name, { timeoutMinutes: job['timeout-minutes'] ?? null, strategy: job.strategy ?? null,
      if: job.if, needs: job.needs, environmentKeys: Object.keys(job.env ?? {}),
      relevantSteps: job.steps.filter(row => /tests|fixtures|cleanup|Deploy|disposable|policy|auth/.test(row.name ?? '')).map(row => ({ name: row.name, if: row.if ?? null, run: row.run ?? null, environmentKeys: Object.keys(row.env ?? {}) })) }];
  }));
  const discovered = {};
  for (const [kind, cwd, args] of [
    ['sdk', root, ['--config','jest.config.mjs']],
    ['provider', join(root,'packages/vercel-ai-provider'), ['--config','jest.config.js']],
    ['cli', join(root,'packages/cortex-cli'), ['--config','jest.config.js']] ]) {
    const output = await readCommand(kind + '-test-discovery1', process.execPath,
      ['--experimental-vm-modules',join(root,'node_modules/jest/bin/jest.js'),...args,'--listTests','--runInBand','--json'], cwd);
    const paths = JSON.parse(output).map(path => relative(root, path));
    discovered[kind] = { totalFiles: paths.length, files: paths,
      runtimeFixtureConsumerFiles: paths.filter(path => path === 'tests/integration/runtime-ci.test.ts'),
      unitFiles: paths.filter(path => path.includes('/unit/') || path.includes('/__tests__/')),
      legacyServiceFiles: paths.filter(path => !path.includes('/unit/') && !path.includes('/__tests__/') && path !== 'tests/integration/runtime-ci.test.ts') };
  }
  await publish('workflow-selection-readonly1', { selectedJobs, discovered, testsExecuted: 0, modelCalls: 0,
    packageScripts: Object.fromEntries(await Promise.all(['package.json','packages/cortex-cli/package.json','packages/vercel-ai-provider/package.json'].map(async path => [path,(await json(join(root,path))).scripts]))),
    sourcePins: await Promise.all(['.github/workflows/pr-checks.yml','scripts/ci/runtime-fixtures.mjs','scripts/ci/verify-disposable-targets.mjs',
      'scripts/cleanup-test-data.ts','tests/integration/runtime-ci.test.ts','tests/helpers/runtime-fixtures.ts','tests/env.ts','tests/setup.ts',
      'packages/cortex-cli/tests/setup.ts','packages/cortex-cli/tests/env.ts','packages/vercel-ai-provider/tests/helpers/setup.ts',
      'jest.config.mjs','packages/cortex-cli/jest.config.js','packages/vercel-ai-provider/jest.config.js'].map(pin)) });
  console.log(JSON.stringify({ status: 'READONLY_CI_DISCOVERY_CLOSED_NOT_ACTIVATED', targetChecks: 2,
    testDiscoveryFiles: Object.fromEntries(Object.entries(discovered).map(([kind,value]) => [kind,value.totalFiles])),
    proofsCurrentAtInspection: true, githubWrites: 0, dispatches: 0, deployments: 0, modelCalls: 0 }));
} catch (error) {
  await publish('inspection-failure1', { status: 'READONLY_INSPECTION_FAILED', name: error?.name,
    staticCode: 'SEE_FIXED_SOURCE_AND_COMPLETED_SAFE_RECEIPTS', noSettingsWrites: true, noDispatches: true,
    noDeployments: true, noInference: true });
  console.error('READONLY_CI_INSPECTION_FAILED_SEE_OWNED_RECEIPT'); process.exitCode = 1;
}
