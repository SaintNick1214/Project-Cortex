import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, linkSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { createReleasePlan, registryResult, publishReleasePlan, releasePackages, validateReleasePlan, deliveryReady, codeqlApp } from '../scripts/release-contract.mjs';
import { deliveryEvent, readDeliverySnapshot, reconcileReadiness, readinessSummary, writeReadinessReceipt, readinessPayload } from '../scripts/release-readiness.mjs';
import { canonical, isUtcTimestamp, isSarifUri, isSarifDateTime, validateSarifSemantics, resultSubset, nativeZip, nativeCoverage, mergeBinding, workflowScope, jobLogProof, compareNativeProof, validateNativeRole, collectSourceProof, githubReader, proofPages, sourcePolicy, proofLimits, trustedSnyk, digest, deliveryProducerProof, selectMergeAssociation, proofJson, validateSarifSchema, sarifSchemaIdentity, serverExportProfile } from '../scripts/release-source-proof.mjs';
const sha = 'a'.repeat(40), prior = 'b'.repeat(40);
const versions = { sdk: '0.38.0', provider: '0.38.0', cli: '0.38.0', templates: '1.1.0' };
const makePlan = (overrides = {}) => createReleasePlan({
  paths: { sha }, sourceSha: sha,
  readManifest: folder => { const pkg = releasePackages.find(pkg => pkg.folder === folder); return { name: pkg.name, version: versions[pkg.key] }; },
  registry: name => { const pkg = releasePackages.find(pkg => pkg.name === name); return { version: versions[pkg.key], gitHead: prior }; },
  diffPaths: () => '', ...overrides,
});
test('template-only delivery keeps SDK/provider/CLI unchanged', () => {
  const plan = makePlan({ paths: { sha, templates: true } });
  assert.deepEqual(plan.packages.filter(pkg => pkg.changed).map(pkg => [pkg.key, pkg.version]), [['templates', '1.1.1']]);
});
test('SDK delivery updates its dependent packages but not the catalog channel', () => {
  const plan = makePlan({ paths: { sha, sdk: true } });
  assert.deepEqual(plan.packages.filter(pkg => pkg.changed).map(pkg => pkg.key), ['sdk', 'provider', 'cli']);
});
test('first catalog publication accepts only a structured npm 404', () => {
  const failure = new Error('npm failed');
  assert.equal(registryResult(JSON.stringify({ error: { code: 'E404' } }), failure), undefined);
  for (const code of ['E401', 'E403', 'ETIMEDOUT']) assert.throws(() => registryResult(JSON.stringify({ error: { code } }), failure), failure);
  assert.throws(() => registryResult('proxy unavailable', failure), failure);
  const plan = makePlan({ registry: name => name === '@cortexmemory/templates' ? undefined : { version: '0.38.0', gitHead: prior } });
  assert.deepEqual(plan.packages.filter(pkg => pkg.changed).map(pkg => [pkg.key, pkg.version]), [['templates', '1.1.0']]);
});
test('invalid registry metadata or mismatched source cannot authorize publication', () => {
  assert.throws(() => registryResult('{}'), /semver/);
  assert.throws(() => registryResult('[]'), /metadata/);
  assert.throws(() => makePlan({ paths: { sha: prior } }), /match/);
  assert.throws(() => makePlan({ sourceSha: 'main' }), /commit/);
  const plan = makePlan();
  plan.packages.reverse();
  assert.throws(() => validateReleasePlan(plan, sha), /order/);
});
test('changes superseded by an earlier main delivery are included using registry gitHead', () => {
  const seen = [];
  const plan = makePlan({ diffPaths: (from, to, paths) => { seen.push([from, to, paths]); return paths.includes('packages/cortex-templates/') ? 'catalog.json' : ''; } });
  assert.equal(seen.length, 4);
  assert.ok(seen.every(([from, to]) => from === prior && to === sha));
  assert.deepEqual(plan.packages.filter(pkg => pkg.changed).map(pkg => pkg.key), ['templates']);
});
test('partial retry does not republish already accepted SDK but finishes dependents', async () => {
  const plan = makePlan({ paths: { sha, sdk: true }, registry: name => ({ version: '0.38.0', gitHead: name === '@cortexmemory/sdk' ? sha : prior }) });
  const published = [], released = [];
  await publishReleasePlan({ plan, sourceSha: sha, publish: pkg => published.push(pkg.key), visibleVersion: pkg => pkg.version, wait: async () => {}, tagAndRelease: pkg => released.push(pkg.key) });
  assert.deepEqual(published, ['provider', 'cli']);
  assert.deepEqual(released, ['sdk', 'provider', 'cli']);
});
test('catalog becomes visible before the CLI depending on it is published', async () => {
  const plan = makePlan({ paths: { sha, sdk: true, provider: true, templates: true, cli: true } });
  const events = []; let clock = 0, attempts = 0;
  await publishReleasePlan({ plan, sourceSha: sha, publish: pkg => events.push(`publish:${pkg.key}`), visibleVersion: pkg => { events.push(`visible:${pkg.key}`); if (pkg.key === 'templates' && attempts++ === 0) throw new Error('registry processing'); return pkg.version; }, now: () => clock, wait: async ms => { clock += ms; }, tagAndRelease: pkg => events.push(`release:${pkg.key}`) });
  assert.deepEqual(events.filter(value => value.startsWith('publish:')), ['publish:sdk', 'publish:provider', 'publish:templates', 'publish:cli']);
  assert.ok(events.indexOf('release:templates') < events.indexOf('publish:cli'));
  assert.equal(attempts, 2);
});
test('visibility timeout stops downstream publication and release tags', async () => {
  const plan = makePlan({ paths: { sha, sdk: true, templates: true, cli: true } });
  const published = [], tags = []; let clock = 0;
  await assert.rejects(publishReleasePlan({ plan, sourceSha: sha, publish: pkg => published.push(pkg.key), visibleVersion: () => 'wrong-version', now: () => clock, wait: async ms => { clock += ms; }, tagAndRelease: pkg => tags.push(pkg.key), visibilityTimeoutMs: 15_000 }), /not visible/);
  assert.deepEqual(published, ['sdk']); assert.deepEqual(tags, []);
});
test('a failed npm publish is not retried as if it succeeded', async () => {
  const plan = makePlan({ paths: { sha, templates: true } }); let visibility = 0;
  await assert.rejects(publishReleasePlan({ plan, sourceSha: sha, publish: () => { throw new Error('publish denied'); }, visibleVersion: () => { visibility++; return '1.1.1'; }, wait: async () => {}, tagAndRelease: () => {} }), /publish denied/);
  assert.equal(visibility, 0);
});

test('delivery gate requires exact-head latest workflows and separate CodeQL success', () => {
  const runs = ['PR Checks', 'Security Scans'].map((name, index) => ({ id: index + 1, run_attempt: 1, name, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success' }));
  const checks = [{ id: 3, name: 'CodeQL', head_sha: sha, app: codeqlApp, status: 'completed', conclusion: 'success' }];
  const statuses = [{ id: 4, context: 'security/snyk (owner)', state: 'success' }];
  const eligible = deliveryReady({ runs, checks, statuses, sourceSha: sha });
  assert.equal(eligible.ready, true);
  assert.equal(eligible.checksRun, 1);
  assert.deepEqual(eligible.reasons, []);
  assert.equal(deliveryReady({ runs, checks: [], statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks: [{ ...checks[0], conclusion: 'failure' }], statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [{ ...statuses[0], state: 'failure' }], sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [], sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [{ ...statuses[0], state: 'pending' }], sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [{ ...statuses[0], id: 5, state: 'success' }, { ...statuses[0], state: 'pending' }], sourceSha: sha }).ready, true);
  assert.equal(deliveryReady({ runs: [...runs, { ...runs[0], id: 4, conclusion: 'failure' }], checks, statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks: [{ ...checks[0], head_sha: prior }], statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs: runs.map(run => ({ ...run, event: 'pull_request' })), checks, statuses, sourceSha: sha }).ready, false);
});

const repository = 'owner/cortex';
const observations = () => ({
  mainSha: sha,
  runs: ['PR Checks', 'Security Scans'].map((name, index) => ({ id: index + 10, run_attempt: 1, name, head_sha: sha, head_branch: 'main', head_repository: { full_name: repository }, event: 'push', status: 'completed', conclusion: 'success' })),
  checks: [{ id: 12, name: 'CodeQL', head_sha: sha, app: codeqlApp, status: 'completed', conclusion: 'success' }],
  statuses: [{ id: 13, context: 'security/snyk (basic)', state: 'success', created_at: '2026-10-09T00:00:00Z' }],
});
const completion = () => ({ workflow_run: { name: 'Security Scans', head_sha: sha, head_branch: 'main', head_repository: { full_name: repository }, event: 'push', conclusion: 'success' } });
const input = (overrides = {}) => ({ eventName: 'workflow_run', event: completion(), ref: 'refs/heads/main', repository, sourceSha: sha, getSnapshot: async () => observations(), wait: async () => {}, ...overrides });

test('newest failed/pending workflow attempts and CodeQL results defeat older success', () => {
  const data = observations();
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', 'neutral', null]) {
    const newer = { ...data.runs[0], run_attempt: 2, conclusion };
    const result = deliveryReady({ ...data, runs: [data.runs[0], newer, data.runs[1]], sourceSha: sha, repository });
    assert.equal(result.ready, false);
    assert.equal(result.retryable, false);
    assert.match(result.reasons[0], /PR Checks: failed/);
    assert.equal(deliveryReady({ ...data, checks: [...data.checks, { ...data.checks[0], id: 20, conclusion }], sourceSha: sha, repository }).ready, false);
  }
  const result = deliveryReady({ ...data, runs: [...data.runs, { ...data.runs[0], id: 30, status: 'in_progress', conclusion: null }], sourceSha: sha, repository });
  assert.equal(result.ready, false);
  assert.equal(result.retryable, true);
});

test('wrong source, branch, repository and uploaded-check app cannot authorize delivery', () => {
  const data = observations();
  for (const changes of [{ head_sha: prior }, { app: { id: 15368, slug: 'github-actions' } }, { app: { id: codeqlApp.id, slug: 'other-app' } }, { app: undefined }]) {
    const result = deliveryReady({ ...data, checks: [{ ...data.checks[0], ...changes }], sourceSha: sha, repository });
    assert.equal(result.ready, false);
    assert.match(result.reasons.join('\n'), /CodeQL: missing/);
  }
  for (const changes of [{ head_branch: 'dev' }, { event: 'schedule' }, { head_sha: prior }, { head_repository: { full_name: 'fork/cortex' } }]) {
    assert.equal(deliveryReady({ ...data, runs: data.runs.map(run => ({ ...run, ...changes })), sourceSha: sha, repository }).ready, false);
  }
  // A newer impersonating check cannot replace a result from the expected app.
  assert.equal(deliveryReady({ ...data, checks: [...data.checks, { ...data.checks[0], id: 999, app: { id: 1, slug: 'other' }, conclusion: 'failure' }], sourceSha: sha, repository }).ready, true);
  assert.throws(() => deliveryReady({ ...data, checks: null, sourceSha: sha }), /observations/);
});

test('all Snyk contexts require their newest result, independent of response order', () => {
  const data = observations();
  for (const state of ['failure', 'error', 'pending']) {
    const result = deliveryReady({ ...data, statuses: [{ ...data.statuses[0], id: 50, state }, ...data.statuses], sourceSha: sha, repository });
    assert.equal(result.ready, false);
    assert.equal(result.retryable, state === 'pending');
    assert.match(result.reasons.join('\n'), /security\/snyk \(basic\)/);
  }
  assert.equal(deliveryReady({ ...data, statuses: [...data.statuses, { id: 1, context: 'security/snyk (sdk)', state: 'failure' }], sourceSha: sha, repository }).ready, false);
  assert.equal(deliveryReady({ ...data, statuses: [{ id: 99, context: 'unrelated', state: 'success' }], sourceSha: sha, repository }).ready, false);
});

test('filtered CodeQL retrieval survives 652 unrelated checks and paginates runs/statuses', async () => {
  const data = observations(), urls = [];
  const unrelated = Array.from({ length: 652 }, (_, id) => ({ ...data.checks[0], id: id + 100, name: 'Auto-Merge' }));
  const request = async path => {
    const url = new URL(path, 'https://github.example');
    urls.push(url);
    if (url.pathname.endsWith('/git/ref/heads/main')) return { data: { object: { sha } }, hasNext: false };
    const page = Number(url.searchParams.get('page'));
    assert.equal(url.searchParams.get('per_page'), '100');
    if (url.pathname.endsWith('/check-runs')) {
      const checks = url.searchParams.get('check_name') === 'CodeQL' ? data.checks : unrelated;
      assert.equal(url.searchParams.get('filter'), 'all');
      return { data: { check_runs: checks.slice((page - 1) * 100, page * 100) }, hasNext: checks.length > page * 100 };
    }
    if (url.pathname.endsWith('/actions/runs')) {
      assert.equal(url.searchParams.get('head_sha'), sha);
      assert.equal(url.searchParams.get('branch'), 'main');
      assert.equal(url.searchParams.get('event'), 'push');
      return { data: { workflow_runs: page === 1 ? Array.from({ length: 100 }, (_, id) => ({ ...data.runs[0], id: id + 1000, name: 'Unrelated' })) : data.runs }, hasNext: page === 1 };
    }
    if (url.pathname.endsWith('/statuses')) return { data: page === 1 ? Array.from({ length: 100 }, (_, id) => ({ id: id + 1000, context: `unrelated-${id}`, state: 'success' })) : data.statuses, hasNext: page === 1 };
    throw new Error(`Unexpected endpoint ${url.pathname}`);
  };
  const snapshot = await readDeliverySnapshot({ request, sourceSha: sha, repository });
  assert.equal(deliveryReady({ ...snapshot, sourceSha: sha, repository }).ready, true);
  assert.equal(snapshot.checks.length, 1);
  assert.equal(snapshot.runs.length, 102);
  assert.equal(snapshot.statuses.length, 101);
  assert.equal(urls.filter(url => url.searchParams.get('page') === '2').length, 2);
});

test('check pagination cannot hide a newer failed uploaded CodeQL result', async () => {
  const data = observations();
  const request = async path => {
    const url = new URL(path, 'https://github.example');
    if (url.pathname.endsWith('/git/ref/heads/main')) return { data: { object: { sha } } };
    if (url.pathname.endsWith('/actions/runs')) return { data: { workflow_runs: data.runs } };
    if (url.pathname.endsWith('/statuses')) return { data: data.statuses };
    const first = url.searchParams.get('page') === '1';
    return { data: { check_runs: first ? Array.from({ length: 100 }, (_, id) => ({ ...data.checks[0], id: id + 1 })) : [{ ...data.checks[0], id: 200, conclusion: 'failure' }] }, hasNext: first };
  };
  const snapshot = await readDeliverySnapshot({ request, sourceSha: sha, repository });
  const result = deliveryReady({ ...snapshot, sourceSha: sha, repository });
  assert.equal(result.ready, false);
  assert.match(result.reasons.join('\n'), /CodeQL: failed/);
});

test('API failures, malformed/truncated data and a moving main fail closed', async () => {
  await assert.rejects(readDeliverySnapshot({ sourceSha: sha, repository, request: async () => { throw new Error('API unavailable'); } }), /API unavailable/);
  await assert.rejects(readDeliverySnapshot({ sourceSha: sha, repository: 'invalid', request: async () => {} }), /owner\/name/);
  const route = (result, hasNext = false) => async path => path.includes('/git/ref/') ? { data: { object: { sha } } } : { data: result, hasNext };
  await assert.rejects(readDeliverySnapshot({ sourceSha: sha, repository, request: route({}) }), /Malformed/);
  await assert.rejects(readDeliverySnapshot({ sourceSha: sha, repository, request: async path => path.includes('/git/ref/') ? { data: { object: { sha } } } : { data: path.includes('/statuses?') ? [] : { workflow_runs: [], check_runs: [] }, hasNext: true } }), /pagination exceeded/);
  let reads = 0;
  const snapshot = await readDeliverySnapshot({ sourceSha: sha, repository, request: async () => { reads++; return { data: { object: { sha: prior } } }; } });
  assert.deepEqual(snapshot, { mainSha: prior });
  assert.equal(reads, 1);
});

test('event replays explain dev integration, scheduled scans and failed upstream workflows', async () => {
  for (const [changes, reason] of [[{ head_branch: 'dev' }, /dev integration/], [{ event: 'schedule' }, /scheduled scans/], [{ conclusion: 'failure' }, /repair that prerequisite/], [{ head_repository: { full_name: 'fork/cortex' } }, /repository/]]) {
    const event = completion();
    Object.assign(event.workflow_run, changes);
    const result = await reconcileReadiness(input({ event, getSnapshot: async () => { assert.fail('Ineligible event must not fetch prerequisites'); } }));
    assert.equal(result.ready, false);
    assert.equal(result.outcome, 'ineligible');
    assert.match(result.reasons.join('\n'), reason);
    assert.equal(result.attempts, 0);
  }
  assert.equal(deliveryEvent({ eventName: 'status', event: { sha, context: 'unrelated', state: 'success' }, repository }).eligible, false);
  assert.equal(deliveryEvent({ eventName: 'push', event: { sha }, repository }).eligible, false);
});

test('late CodeQL after either final wake-up reconciles without another event', async () => {
  for (const trigger of [input(), input({ eventName: 'status', event: { sha, context: 'security/snyk (basic)', state: 'success' } })]) {
    let reads = 0;
    const waits = [];
    const result = await reconcileReadiness({ ...trigger, getSnapshot: async () => { const data = observations(); if (reads++ === 0) data.checks = []; return data; }, wait: async ms => waits.push(ms) });
    assert.equal(result.ready, true);
    assert.equal(result.outcome, 'ready');
    assert.equal(result.attempts, 2);
    assert.deepEqual(waits, [10_000]);
    assert.match(readinessSummary(result), /Qualified PR Checks run: 10/);
  }
});

test('pending prerequisites expire after bounded reads; failure never polls past a finding', async () => {
  let reads = 0, waits = 0;
  const pending = await reconcileReadiness(input({ getSnapshot: async () => { reads++; return { ...observations(), checks: [{ ...observations().checks[0], status: 'in_progress', conclusion: null }] }; }, wait: async () => { waits++; } }));
  assert.equal(pending.ready, false);
  assert.equal(pending.outcome, 'waiting');
  assert.equal(reads, 7);
  assert.equal(waits, 6);
  assert.match(readinessSummary(pending), /Bounded reconciliation expired/);
  const failed = await reconcileReadiness(input({ getSnapshot: async () => ({ ...observations(), statuses: [{ ...observations().statuses[0], state: 'failure' }] }), wait: async () => { assert.fail('Failed finding cannot be polled away'); } }));
  assert.equal(failed.outcome, 'blocked');
  assert.equal(failed.attempts, 1);
  assert.match(readinessSummary(failed), /cannot waive CodeQL or Snyk/);
  await assert.rejects(reconcileReadiness(input({ maxAttempts: 8 })), /bounded/);
});

test('manual dry-plan and recovery require exact current main and all the same gates', async () => {
  for (const mode of ['dry-plan', 'recover']) {
    const trigger = input({ eventName: 'workflow_dispatch', event: { inputs: { source_sha: sha, mode } } });
    assert.equal((await reconcileReadiness(trigger)).ready, true);
    const superseded = await reconcileReadiness({ ...trigger, getSnapshot: async () => ({ mainSha: prior }) });
    assert.equal(superseded.ready, false);
    assert.equal(superseded.outcome, 'superseded');
    const failed = await reconcileReadiness({ ...trigger, getSnapshot: async () => ({ ...observations(), statuses: [{ ...observations().statuses[0], state: 'failure' }] }) });
    assert.equal(failed.ready, false);
    assert.equal(failed.outcome, 'blocked');
    assert.equal((await reconcileReadiness({ ...trigger, ref: 'refs/heads/dev' })).outcome, 'ineligible');
    assert.equal((await reconcileReadiness({ ...trigger, event: { inputs: { source_sha: 'main', mode } } })).outcome, 'ineligible');
    assert.equal((await reconcileReadiness({ ...trigger, sourceSha: prior })).outcome, 'blocked');
  }
  assert.equal(deliveryEvent({ eventName: 'workflow_dispatch', event: { inputs: { source_sha: sha, mode: 'waive' } }, ref: 'refs/heads/main', repository }).eligible, false);
});

test('superseding main and newer tests invalidate a previously selected artifact', async () => {
  let calls = 0;
  const moved = await reconcileReadiness(input({ getSnapshot: async () => calls++ === 0 ? { ...observations(), checks: [] } : { mainSha: prior } }));
  assert.equal(moved.ready, false);
  assert.equal(moved.outcome, 'superseded');
  const artifact = await reconcileReadiness(input({ expectedChecksRun: '9' }));
  assert.equal(artifact.ready, false);
  assert.match(artifact.reasons.join('\n'), /immutable artifact/);
});

test('dry-plan writes a reviewable plan without modifying manifests or publishing', t => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'cortex-release-dry-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const bin = resolve(fixture, 'bin');
  mkdirSync(bin);
  const originals = new Map();
  for (const pkg of releasePackages) {
    mkdirSync(resolve(fixture, pkg.folder), { recursive: true });
    const manifest = JSON.stringify({ name: pkg.name, version: versions[pkg.key], dependencies: { '@cortexmemory/sdk': '^0.38.0' } });
    originals.set(pkg.folder, manifest);
    writeFileSync(resolve(fixture, pkg.folder, 'package.json'), manifest);
  }
  writeFileSync(resolve(bin, 'npm'), `#!${process.execPath}\nconst pkg = ${JSON.stringify(releasePackages)}.find(pkg=>pkg.name===process.argv[3]); if(process.argv[2]!=='view'||!pkg) throw new Error('Publication forbidden in dry test'); console.log(JSON.stringify({version:${JSON.stringify(versions)}[pkg.key],gitHead:'${prior}'}));\n`, { mode: 0o755 });
  writeFileSync(resolve(bin, 'git'), `#!${process.execPath}\nif(process.argv[2]!=='diff')throw new Error('Mutation forbidden in dry test');\n`, { mode: 0o755 });
  const command = resolve(new URL('../scripts/plan-release.mjs', import.meta.url).pathname);
  const summary = resolve(fixture, 'summary.md');
  const run = flags => spawnSync(process.execPath, [command, ...flags], { cwd: fixture, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SOURCE_SHA: sha, GITHUB_STEP_SUMMARY: summary } });
  writeFileSync(resolve(fixture, 'delivery-paths.json'), JSON.stringify({ sha, cli: true }));
  const planned = run(['--dry-run']);
  assert.equal(planned.status, 0, planned.stderr);
  assert.deepEqual(JSON.parse(readFileSync(resolve(fixture, 'release-plan.json'))).packages.filter(pkg => pkg.changed).map(pkg => [pkg.key, pkg.version]), [['cli', '0.38.1']]);
  for (const [folder, content] of originals) assert.equal(readFileSync(resolve(fixture, folder, 'package.json'), 'utf8'), content);
  assert.match(readFileSync(summary, 'utf8'), /dry-plan \(no manifest changes or publication\)/);
  writeFileSync(resolve(fixture, 'delivery-paths.json'), JSON.stringify({ sha }));
  assert.equal(run(['--dry-run']).status, 0);
  assert.match(readFileSync(summary, 'utf8'), /nothing to publish/);
  writeFileSync(resolve(fixture, 'delivery-paths.json'), JSON.stringify({ sha: prior }));
  assert.notEqual(run(['--dry-run']).status, 0);
  assert.notEqual(run(['--waive-security']).status, 0);
});

test('publication outcomes retain accepted partial work and await effects before dependents', async () => {
  const plan = makePlan({ paths: { sha, sdk: true } }), events = [];
  await assert.rejects(publishReleasePlan({ plan, sourceSha: sha, publish: async pkg => { events.push(`publish:${pkg.key}`); if (pkg.key === 'provider') throw new Error('publish denied'); }, visibleVersion: async pkg => pkg.version, wait: async () => {}, tagAndRelease: async pkg => events.push(`tag:${pkg.key}`), onOutcome: (pkg, state) => events.push(`${state}:${pkg.key}`) }), /publish denied/);
  assert.deepEqual(events, ['publish:sdk', 'published:sdk', 'visible:sdk', 'tag:sdk', 'released:sdk', 'publish:provider']);
  const none = [];
  await publishReleasePlan({ plan: makePlan(), sourceSha: sha, publish: () => none.push('publish'), visibleVersion: () => none.push('visible'), wait: async () => {}, tagAndRelease: () => none.push('tag'), onOutcome: () => none.push('outcome') });
  assert.deepEqual(none, []);
});

test('readiness command produces gate outputs and redacted failure summaries over HTTP', async t => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'cortex-readiness-http-'));
  const data = observations(), requests = [];
  let failedSnyk = false, apiFailure = false, mainSha = sha;
  const token = 'local-fixture-token-only', responseSecret = 'must-not-print-response-body';
  const server = createServer((request, response) => {
    requests.push(request.url);
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    response.setHeader('content-type', 'application/json');
    if (apiFailure) { response.writeHead(503); response.end(JSON.stringify({ error: responseSecret })); return; }
    const path = new URL(request.url, 'http://localhost').pathname;
    const body = path.endsWith('/git/ref/heads/main') ? { object: { sha: mainSha } } : path.endsWith('/actions/runs') ? { workflow_runs: data.runs } : path.endsWith('/check-runs') ? { check_runs: data.checks } : failedSnyk ? [{ ...data.statuses[0], state: 'failure' }] : data.statuses;
    response.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); rmSync(fixture, { recursive: true, force: true }); });
  const event = resolve(fixture, 'event.json'), output = resolve(fixture, 'output.txt'), summary = resolve(fixture, 'summary.md');
  writeFileSync(event, JSON.stringify({ inputs: { source_sha: sha, mode: 'dry-plan' } }));
  const command = new URL('../scripts/release-readiness.mjs', import.meta.url).pathname;
  let receiptNumber = 0;
  const run = async (extraEnv = {}) => {
    const receipt = resolve(fixture, `receipt-${receiptNumber++}.json`);
    writeFileSync(output, ''); writeFileSync(summary, '');
    const options = { cwd: fixture, encoding: 'utf8', env: { ...process.env, GH_TOKEN: token, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: event, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: repository, SOURCE_SHA: sha, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, REQUIRE_READY: 'true', READINESS_RECEIPT_PATH: receipt, ...(extraEnv.EXPECTED_READINESS_RECEIPT ? { EXPECTED_READINESS_RECEIPT_SHA256: digest(readFileSync(extraEnv.EXPECTED_READINESS_RECEIPT)) } : {}), ...extraEnv } };
    try { return { status: 0, receipt, ...await promisify(execFile)(process.execPath, [command, '--once'], options) }; }
    catch (error) { return { status: error.code, receipt, stdout: error.stdout, stderr: error.stderr }; }
  };
  const ready = await run();
  assert.equal(ready.status, 0, ready.stderr);
  assert.match(readFileSync(output, 'utf8'), /ready=true\nchecks_run=10\nsource_sha=a{40}\nmode=dry-plan/);
  assert.match(readFileSync(summary, 'utf8'), /CodeQL: \*\*success\*\*/);
  assert.ok(requests.some(path => path.includes('check_name=CodeQL&filter=all')));
  const retained = proofJson(readFileSync(ready.receipt, 'utf8'));
  assert.equal(retained.payload.ready, true); assert.equal(retained.payloadSha256, digest(canonical(retained.payload)));
  assert.match(readFileSync(output, 'utf8'), new RegExp(`receipt_sha256=${digest(readFileSync(ready.receipt))}`));
  const matched = await run({ EXPECTED_READINESS_RECEIPT: ready.receipt });
  assert.equal(matched.status, 0, matched.stderr); assert.equal(proofJson(readFileSync(matched.receipt, 'utf8')).fence.matched, true);
  const newest = { ...data.runs[0], id: 1000, created_at: '2026-11-02T12:00:00Z' };
  data.runs.push(newest);
  const changedRun = await run({ EXPECTED_READINESS_RECEIPT: ready.receipt });
  assert.equal(changedRun.status, 1); assert.match(readFileSync(output, 'utf8'), /ready=false/);
  assert.equal(proofJson(readFileSync(changedRun.receipt, 'utf8')).fence.matched, false);
  data.runs.pop();
  data.checks.push({ ...data.checks[0], id: 2000 });
  const changedVendor = await run({ EXPECTED_READINESS_RECEIPT: ready.receipt });
  assert.equal(changedVendor.status, 1); assert.equal(proofJson(readFileSync(changedVendor.receipt, 'utf8')).fence.matched, false);
  assert.equal(proofJson(readFileSync(changedVendor.receipt, 'utf8')).payload.ready, true);
  data.checks.pop();
  mainSha = prior;
  const changedMain = await run({ EXPECTED_READINESS_RECEIPT: ready.receipt });
  assert.equal(changedMain.status, 1); assert.equal(proofJson(readFileSync(changedMain.receipt, 'utf8')).payload.outcome, 'superseded');
  mainSha = sha;
  failedSnyk = true;
  const blocked = await run({ EXPECTED_READINESS_RECEIPT: ready.receipt });
  assert.equal(blocked.status, 1);
  assert.match(readFileSync(output, 'utf8'), /ready=false/);
  assert.match(readFileSync(summary, 'utf8'), /security\/snyk \(basic\): \*\*failed\*\*/);
  apiFailure = true;
  const failed = await run({ REQUIRE_READY: 'false' });
  assert.equal(failed.status, 1);
  assert.match(readFileSync(summary, 'utf8'), /read failed \(503\)/);
  writeFileSync(event, JSON.stringify({ inputs: { source_sha: sha, mode: 'recover\nready=true' } }));
  const invalid = await run();
  assert.equal(invalid.status, 1);
  assert.match(readFileSync(output, 'utf8'), /ready=false/);
  assert.ok(!readFileSync(output, 'utf8').includes('ready=true'));
  assert.equal(proofJson(readFileSync(failed.receipt, 'utf8')).payload.outcome, 'error');
  const previousRequests = requests.length;
  const noPath = await run({ READINESS_RECEIPT_PATH: '' });
  assert.equal(noPath.status, 1); assert.equal(requests.length, previousRequests); assert.match(readFileSync(output, 'utf8'), /ready=false/);
  const collision = await run({ READINESS_RECEIPT_PATH: ready.receipt });
  assert.equal(collision.status, 1); assert.match(readFileSync(output, 'utf8'), /ready=false/);
  assert.equal(readFileSync(ready.receipt, 'utf8'), canonical(retained) + '\n');
  for (const result of [ready, blocked, failed, matched, changedRun, changedVendor, changedMain, noPath, collision]) {
    assert.ok(!`${result.stdout}${result.stderr}`.includes(token));
    assert.ok(!`${result.stdout}${result.stderr}`.includes(responseSecret));
  }
});

// Compact native fixtures model the observed upload-artifact/CodeQL protocol.
// They exercise the actual collector and parsers, never a supplied ready flag.
const headSha = 'c'.repeat(40), treeSha = 'd'.repeat(40);
const publicRepo = () => ({ id: sourcePolicy.repositoryId, full_name: sourcePolicy.repository, private: false, fork: false, default_branch: 'main' });
const headStatus = (overrides = {}) => ({ id: overrides.url === `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` ? 701 : 500, context: sourcePolicy.snykContext, state: 'success', created_at: '2026-11-02T07:49:54Z', creator: { id: sourcePolicy.snykUser, type: 'User' }, url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${headSha}`, target_url: 'https://app.snyk.io/org/nicholasgeil/pr-checks/7500a827-b68f-4821-bfa3-2018ff3a05c9', ...overrides });
const headCheck = (overrides = {}) => ({ id: overrides.head_sha === sha ? 700 : 501, name: 'CodeQL', head_sha: headSha, app: codeqlApp, status: 'completed', conclusion: 'success', completed_at: '2026-11-02T07:53:43Z', ...overrides });
function makeZip(report) {
  const member = Buffer.from(typeof report === 'string' ? report : canonical(report)), compressed = deflateRawSync(member), name = Buffer.from('javascript.sarif');
  let crc = 0xffffffff;
  for (const byte of member) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(member.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(member.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return Buffer.concat([local, name, compressed, central, name, end]);
}
const finding = () => ({ ruleId: 'js/issue', rule: { id: 'js/issue', index: 0, toolComponent: { index: 0 } }, message: { text: 'inherited finding' }, level: 'warning', locations: [{ physicalLocation: { artifactLocation: { uri: 'src/a.ts', uriBaseId: '%SRCROOT%', index: 0 }, region: { startLine: 1 } } }], properties: { complete: true, typed: 1, ordered: ['first', 'second'], extra: null } });
const serverFinding = () => { const result = finding(); delete result.locations[0].physicalLocation.artifactLocation.uriBaseId; return result; };
function nativeRole(sourceSha, number) {
  const paths = ['src/a.ts', 'scripts/b.mjs', '.github/workflows/security.yml'];
  const artifactLocation = index => ({ uri: paths[index], uriBaseId: '%SRCROOT%', index });
  const expectedIds = ['typescript', 'javascript', 'actions'].map(language => `cli/expected-extracted-files/${language}`);
  const report = { version: '2.1.0', runs: [{ tool: { driver: { name: 'CodeQL', semanticVersion: sourcePolicy.engine, notifications: [...expectedIds, 'codeql-action/overlay-disabled'].map(id => ({ id })) }, extensions: [{ name: 'codeql/javascript-queries', semanticVersion: '2.4.8+source', rules: [{ id: 'js/issue' }, { id: 'js/summary/lines-of-code' }, { id: 'js/summary/lines-of-user-code' }], notifications: [{ id: 'js/diagnostics/successfully-extracted-files' }] }] }, results: [finding()], automationDetails: { id: `${sourcePolicy.category}/` }, artifacts: paths.map((_, index) => ({ location: artifactLocation(index) })), invocations: [{ executionSuccessful: true, toolExecutionNotifications: [
    ...paths.map((_, index) => ({ level: 'none', descriptor: { id: expectedIds[index], index }, locations: [{ physicalLocation: { artifactLocation: artifactLocation(index) } }] })),
    ...paths.map((_, index) => ({ level: 'none', descriptor: { id: 'js/diagnostics/successfully-extracted-files', index: 0, toolComponent: { index: 0 } }, locations: [{ physicalLocation: { artifactLocation: artifactLocation(index) } }] })),
    { level: 'none', descriptor: { id: 'codeql-action/overlay-disabled', index: 3 }, properties: { attributes: { reason: 'non-default-queries' } } },
  ] }], properties: { jobRunUuid: `${String(number).padStart(8, '0')}-0000-4000-8000-000000000000`, codeqlConfigSummary: { disableDefaultQueries: false, queries: [{ type: 'builtinSuite', uses: 'security-extended' }] }, metricResults: [1, 2].map(index => ({ ruleId: index === 1 ? 'js/summary/lines-of-code' : 'js/summary/lines-of-user-code', rule: { id: index === 1 ? 'js/summary/lines-of-code' : 'js/summary/lines-of-user-code', index, toolComponent: { index: 0 } }, value: 10 })) } }] };
  const run = { id: number, run_attempt: 1, name: 'Security Scans', path: '.github/workflows/security.yml', created_at: '2026-11-02T09:59:00Z', run_started_at: '2026-11-02T09:59:00Z', updated_at: '2026-11-02T10:05:20Z', head_sha: sourceSha, head_branch: 'main', event: number === 20 ? 'schedule' : 'push', status: 'completed', conclusion: 'success', repository: publicRepo(), head_repository: publicRepo() };
  const steps = [['Checkout repository', '10:00:00', '10:00:20'], ['Initialize CodeQL', '10:00:20', '10:00:40'], ['Run ./.github/actions/cortex-setup', '10:00:40', '10:00:45'], ['Install dependencies', '10:00:45', '10:01:00'], ['Autobuild', '10:01:00', '10:01:10'], ['Perform CodeQL Analysis', '10:01:10', '10:05:00'], ['Validate CodeQL results', '10:05:00', '10:05:01'], ['Preserve CodeQL results', '10:05:01', '10:05:02']].map(([name, start, end], index) => ({ name, number: index + 1, status: 'completed', conclusion: 'success', started_at: `2026-11-02T${start}Z`, completed_at: `2026-11-02T${end}Z` }));
  const job = { id: number + 100, run_id: number, run_attempt: 1, workflow_name: 'Security Scans', created_at: '2026-11-02T10:00:00Z', started_at: '2026-11-02T10:00:00Z', completed_at: '2026-11-02T10:05:10Z', head_sha: sourceSha, head_branch: 'main', name: 'CodeQL Analysis (javascript-typescript)', status: 'completed', conclusion: 'success', steps };
  const artifact = { id: number + 200, name: 'codeql-results-javascript-typescript', expired: false, created_at: '2026-11-02T10:05:02Z', updated_at: '2026-11-02T10:05:02Z', workflow_run: { id: number, repository_id: sourcePolicy.repositoryId, head_repository_id: sourcePolicy.repositoryId, head_sha: sourceSha, head_branch: 'main' } };
  const analysis = { id: number + 300, commit_sha: sourceSha, ref: 'refs/heads/main', analysis_key: sourcePolicy.analysisKey, category: sourcePolicy.category, environment: sourcePolicy.environment, tool: { name: 'CodeQL', version: sourcePolicy.engine }, error: '', warning: '', created_at: '2026-11-02T10:03:00Z', sarif_id: `${String(number).padStart(8, '0')}-0000-4000-8000-000000000001`, results_count: 1, rules_count: 3 };
  const server = structuredClone(report); delete server.runs[0].invocations;
  // SARIF notifications require a message in addition to their descriptor.
  for (const notification of report.runs[0].invocations[0].toolExecutionNotifications) notification.message = { text: notification.descriptor.id };
  // Match GitHub Code Scanning's normalized server representation: relative
  // URI/index references, without the native-only producing-machine base ID.
  for (const artifact of server.runs[0].artifacts) delete artifact.location.uriBaseId;
  for (const result of server.runs[0].results) for (const location of result.locations) delete location.physicalLocation.artifactLocation.uriBaseId;
  server.runs[0].versionControlProvenance = [{ branch: 'refs/heads/main', repositoryUri: `https://github.com/${sourcePolicy.repository}`, revisionId: sourceSha }]; server.runs[0].results[0].properties.serverEnrichment = { alert: 42 };
  const role = { sourceSha, run, job, artifact, analysis, processing: { processing_status: 'complete', errors: null }, report, server, workflow: 'name: Security Scans\non: [push, schedule]\npermissions:\n  contents: read\njobs:\n  codeql-analysis:\n    steps: native\n  dependency-scan:\n    steps: unrelated\n', config: 'name: security\nqueries: []\n', setup: 'name: setup\n' };
  // Pure parser fixtures model the exact response body for their current server
  // object. Production roles retain the original HTTP bytes in a plain field.
  Object.defineProperty(role, 'serverBytes', { get() { return Buffer.from(canonical(this.server)); } });
  return sealRole(role);
}
function sealRole(role) {
  role.zip = makeZip(role.report); role.artifact.digest = `sha256:${digest(role.zip)}`; role.artifact.size_in_bytes = role.zip.length;
  role.analysis.results_count = role.report.runs[0].results.length;
  const stamp = (at, text) => `2026-11-02T${at}Z ${text}`;
  role.log = [
    ...['actions/checkout@v6', 'github/codeql-action@v4', 'actions/upload-artifact@v4', 'actions/setup-node@v6'].map(name => stamp('10:00:00.001', `Download action repository '${name}' (SHA:${'e'.repeat(40)})`)),
    stamp('10:00:10.001', role.sourceSha), stamp('10:00:20.100', `Job run UUID is ${role.report.runs[0].properties.jobRunUuid}.`),
    ...['Writing augmented user configuration file to /tmp/user-config.yaml', 'name: CodeQL Config', 'disable-default-queries: false', 'queries:', '  - uses: security-extended', 'paths-ignore:', '  - tests/**'].map(line => stamp('10:00:21.100', line)),
    stamp('10:00:22.100', '[command]codeql database init --source-root=/home/runner/work/Project-Cortex/Project-Cortex --calculate-language-specific-baseline --sublanguage-file-coverage --extractor-include-aliases'),
    stamp('10:04:00.100', 'CodeQL scanned 1 out of 1 TypeScript files, 1 out of 1 JavaScript files and 1 out of 1 GitHub Actions files in this invocation.'),
    stamp('10:04:00.200', 'Post-processing sarif files: ["/home/runner/work/Project-Cortex/Project-Cortex/codeql-results/javascript.sarif"]'), stamp('10:04:59.100', 'Analysis upload status is complete.'),
    stamp('10:05:02.100', `SHA256 digest of uploaded artifact zip is ${role.artifact.digest.slice(7)}`), stamp('10:05:02.200', `Artifact ${role.artifact.name}.zip successfully finalized. Artifact ID ${role.artifact.id}`), stamp('10:05:02.300', `Artifact ${role.artifact.name} has been successfully uploaded! Final size is ${role.artifact.size_in_bytes} bytes. Artifact ID is ${role.artifact.id}`),
  ].join('\n');
  return role;
}
function proofFixture() {
  const current = nativeRole(sha, 20), baseline = nativeRole(prior, 19), repo = publicRepo();
  const pr = { id: 5142, number: 142, merged: true, state: 'closed', merged_at: '2026-11-02T08:00:00Z', merge_commit_sha: sha, base: { ref: 'main', sha: prior, repo }, head: { ref: 'fix/source', sha: headSha, repo } };
  const commit = { sha, tree: { sha: treeSha }, parents: [{ sha: prior }, { sha: headSha }] }, head = { sha: headSha, tree: { sha: treeSha } };
  const comparison = { status: 'ahead', base_commit: { sha: prior }, merge_base_commit: { sha: prior }, total_commits: 1, commits: [{ sha }], files: [] };
  const ownRuns = ['PR Checks', 'Security Scans'].map((name, index) => ({ ...current.run, id: 10 + index, name, path: index ? '.github/workflows/security.yml' : '.github/workflows/pr-checks.yml', created_at: '2026-11-02T09:00:00Z', run_started_at: '2026-11-02T09:00:00Z', updated_at: '2026-11-02T09:03:00Z', event: 'push', head_repository: repo }));
  const deliveryArtifact = { id: 999, name: 'delivery-paths', expired: false, digest: `sha256:${'f'.repeat(64)}`, size_in_bytes: 237, created_at: '2026-11-02T09:01:00Z', updated_at: '2026-11-02T09:01:00Z', workflow_run: { ...current.artifact.workflow_run, id: 10 } };
  const deliveryJob = { id: 110, name: 'Detect File Changes', workflow_name: 'PR Checks', run_id: 10, run_attempt: 1, head_sha: sha, head_branch: 'main', status: 'completed', conclusion: 'success', created_at: '2026-11-02T09:00:00Z', started_at: '2026-11-02T09:00:00Z', completed_at: '2026-11-02T09:02:00Z', steps: [['Run actions/checkout@v6', '09:00:00', '09:00:40'], ['Run ./.github/actions/cortex-setup', '09:00:40', '09:00:50'], ['Enforce complete committed main release contents', '09:00:50', '09:00:55'], ['Select dependency and trust coverage', '09:00:55', '09:01:00'], ['Run actions/upload-artifact@v4', '09:01:00', '09:01:00']].map(([name, start, end], index) => ({ name, number: index + 1, status: 'completed', conclusion: 'success', started_at: `2026-11-02T${start}Z`, completed_at: `2026-11-02T${end}Z` })) };
  const deliveryLog = [`2026-11-02T09:00:30Z ${sha}`, ...[`SHA256 digest of uploaded artifact zip is ${'f'.repeat(64)}`, 'Artifact delivery-paths.zip successfully finalized. Artifact ID 999', 'Artifact delivery-paths has been successfully uploaded! Final size is 237 bytes. Artifact ID is 999', `Artifact download URL: https://github.com/${sourcePolicy.repository}/actions/runs/10/artifacts/999`].map(text => `2026-11-02T09:01:00.123Z ${text}`)].join('\n');
  const fixture = { current, baseline, repo, pr, commit, head, comparison, headChecks: [headCheck()], headStatuses: [headStatus()], ownRuns, checks: [], statuses: [], deliveryArtifact, deliveryJob, deliveryLog, requests: [] };
  fixture.request = async (path, options = {}) => {
    fixture.requests.push({ path, ...options });
    const url = new URL(path, 'https://api.github.com/'), base = `/repos/${sourcePolicy.repository}`;
    let data;
    if (url.pathname === base) data = fixture.repo;
    else if (url.pathname === `${base}/git/ref/heads/main`) data = { ref: 'refs/heads/main', object: { type: 'commit', sha } };
    else if (url.pathname === `${base}/commits/${sha}/pulls`) data = [fixture.pr];
    else if (url.pathname === `${base}/pulls/142`) data = fixture.pr;
    else if (url.pathname === `${base}/git/commits/${sha}`) data = fixture.commit;
    else if (url.pathname === `${base}/git/commits/${headSha}`) data = fixture.head;
    else if (url.pathname === `${base}/commits/${headSha}/check-runs`) data = { check_runs: fixture.headChecks };
    else if (url.pathname === `${base}/commits/${headSha}/statuses`) data = fixture.headStatuses;
    else if (url.pathname === `${base}/commits/${sha}/check-runs`) data = { check_runs: fixture.checks };
    else if (url.pathname === `${base}/commits/${sha}/statuses`) data = fixture.statuses;
    else if (url.pathname === `${base}/actions/runs`) data = { workflow_runs: fixture.ownRuns };
    else if (url.pathname === `${base}/actions/runs/10/artifacts`) data = { artifacts: [fixture.deliveryArtifact] };
    else if (/\/actions\/runs\/10\/attempts\/\d+\/jobs$/.test(url.pathname)) data = { jobs: [fixture.deliveryJob] };
    else if (url.pathname === `${base}/actions/jobs/110`) data = fixture.deliveryJob;
    else if (url.pathname === `${base}/actions/jobs/110/logs`) data = fixture.deliveryLog;
    else if (url.pathname === `${base}/code-scanning/analyses`) data = [fixture.current.analysis, fixture.baseline.analysis];
    else if (url.pathname === `${base}/compare/${prior}...${sha}`) data = fixture.comparison;
    else {
      const role = [fixture.current, fixture.baseline].find(role => url.searchParams.get('head_sha') === role.sourceSha || url.pathname.includes(`/runs/${role.run.id}`) || url.pathname.includes(`/jobs/${role.job.id}`) || url.pathname.includes(`/artifacts/${role.artifact.id}`) || url.pathname.endsWith(`/analyses/${role.analysis.id}`) || url.pathname.endsWith(`/sarifs/${role.analysis.sarif_id}`) || url.searchParams.get('ref') === role.sourceSha);
      assert.ok(role, `Unexpected proof route ${path}`);
      if (url.pathname.endsWith('/actions/workflows/security.yml/runs')) data = { workflow_runs: [role.run] };
      else if (url.pathname.endsWith(`/actions/runs/${role.run.id}`)) data = role.run;
      else if (url.pathname.endsWith('/jobs')) data = { jobs: [role.job] };
      else if (url.pathname.endsWith('/artifacts')) data = { artifacts: [role.artifact] };
      else if (url.pathname.endsWith('/zip')) data = role.zip;
      else if (url.pathname.endsWith('/logs')) data = role.log;
      else if (url.pathname.endsWith(`/analyses/${role.analysis.id}`)) data = options.format === 'sarif' ? role.server : role.analysis;
      else if (url.pathname.includes('/sarifs/')) data = role.processing;
      else if (url.pathname.includes('/contents/')) {
        const path = url.pathname.split('/contents/')[1], text = path.endsWith('security.yml') ? role.workflow : path.endsWith('codeql-config.yml') ? role.config : role.setup, bytes = Buffer.from(text);
        data = { type: 'file', path, encoding: 'base64', content: bytes.toString('base64'), size: bytes.length, sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') };
      } else assert.fail(`Unexpected native route ${path}`);
    }
    const raw = options.format === 'sarif' ? Buffer.from(canonical(data)) : undefined;
    return { data: Buffer.isBuffer(data) ? Buffer.from(data) : structuredClone(data), hasNext: false, ...(raw ? { raw, bodySha256: digest(raw), bodyBytes: raw.length } : {}) };
  };
  return fixture;
}
const fixtureProof = fixture => collectSourceProof({ request: fixture.request, repository: sourcePolicy.repository, sourceSha: sha });
const fixtureSnapshot = fixture => readDeliverySnapshot({ request: fixture.request, repository: sourcePolicy.repository, sourceSha: sha });

test('complete-object outer multisets preserve every type, field, nested array and duplicate', () => {
  const value = finding(), reordered = { ...value, properties: { extra: null, ordered: ['first', 'second'], typed: 1, complete: true } };
  assert.equal(resultSubset([reordered], [value]), true);
  assert.equal(resultSubset([], [value]), true);
  assert.equal(resultSubset([value], [value, value]), true);
  assert.equal(resultSubset([value, value], [value]), false);
  for (const change of [result => result.properties.typed = '1', result => result.properties.ordered.reverse(), result => result.properties.extra = false, result => delete result.properties.complete, result => result.locations[0].physicalLocation.region.startLine = 2, result => result.properties.newField = true]) {
    const modified = structuredClone(value); change(modified); assert.equal(resultSubset([modified], [value]), false);
  }
  assert.notEqual(canonical({ number: -0 }), canonical({ number: 0 }));
  assert.equal(resultSubset([{ number: -0 }], [{ number: 0 }]), false);
  for (const invalid of [Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, undefined]) assert.throws(() => canonical({ invalid }), /unsupported/);
  assert.throws(() => resultSubset(null, []), /complete result arrays/);
});

test('native archive validates digest-independent envelope, member, CRC and bounded expansion', () => {
  const role = nativeRole(sha, 20), member = nativeZip(role.zip);
  assert.deepEqual(member.report, role.report); assert.match(member.memberSha256, /^[a-f0-9]{64}$/);
  for (const mutate of [zip => zip.writeUInt16LE(2, zip.length - 22 + 10), zip => zip.writeUInt16LE(1, 6), zip => zip.writeUInt32LE(0, 14), zip => zip.writeUInt16LE(99, 8), zip => zip.write('..', 30)]) {
    const bad = Buffer.from(role.zip); mutate(bad); assert.throws(() => nativeZip(bad), /Source proof/);
  }
  assert.throws(() => nativeZip(role.zip.subarray(0, -1)), /Source proof/);
  const oversized = { ...role.report, padding: 'x'.repeat(proofLimits.native) };
  assert.throws(() => nativeZip(makeZip(oversized)), /expansion/);
});

test('raw exact-tree source proof preserves missing M labels and genuine H vendor provenance', async () => {
  const fixture = proofFixture(), snapshot = await fixtureSnapshot(fixture);
  const ready = deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository });
  assert.equal(ready.ready, true); assert.equal(ready.checksRun, 10);
  assert.equal(ready.qualification.label, 'qualified-source-equivalence');
  assert.equal(ready.prerequisites.find(item => item.name === 'CodeQL').state, 'missing');
  assert.equal(ready.prerequisites.find(item => item.name === sourcePolicy.snykContext).state, 'missing');
  assert.equal(ready.qualification.snyk[0].authority, 'User63267399');
  assert.equal(ready.qualification.findings.nativeRun, 20); // schedule, distinct from required push run 11
  assert.equal(snapshot.deliveryArtifact.id, 999);
  const summary = readinessSummary({ ...ready, sourceSha: sha, attempts: 1, mode: 'recover', outcome: 'ready' });
  assert.match(summary, /M vendor records shown as missing stay missing/); assert.match(summary, /2026-11-02T07:49:54Z/); assert.match(summary, /databases are not equivalent/);
  assert.ok(!fixture.requests.some(({ path }) => /rules|administration/.test(path)));
});

test('original direct-M route remains preferred and does not request fallback proof', async () => {
  const fixture = proofFixture(); fixture.checks = [headCheck({ head_sha: sha })]; fixture.statuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` })];
  const snapshot = await fixtureSnapshot(fixture), result = deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository });
  assert.equal(result.ready, true); assert.equal(result.qualification, undefined);
  assert.ok(!fixture.requests.some(({ path }) => /code-scanning|\/pulls/.test(path)));
});

test('missing M tool/context can qualify while genuine successful M evidence remains direct', async () => {
  for (const kind of ['CodeQL', 'Snyk', 'one-context']) {
    const fixture = proofFixture();
    if (kind === 'Snyk' || kind === 'one-context') fixture.checks = [headCheck({ head_sha: sha })];
    if (kind === 'CodeQL' || kind === 'one-context') fixture.statuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` })];
    if (kind === 'one-context') { fixture.checks = []; fixture.headStatuses.push(headStatus({ id: 502, context: 'security/snyk (sdk)' })); }
    const snapshot = await fixtureSnapshot(fixture), result = deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository });
    assert.equal(result.ready, true); assert.equal(result.qualification.label, 'qualified-source-equivalence');
    if (kind === 'CodeQL') assert.equal(result.prerequisites.find(item => item.name === sourcePolicy.snykContext).state, 'success');
    if (kind === 'Snyk') assert.equal(result.prerequisites.find(item => item.name === 'CodeQL').state, 'success');
    if (kind === 'one-context') assert.equal(result.prerequisites.find(item => item.name === 'security/snyk (sdk)').state, 'missing');
  }
});

test('every genuine M non-success vetoes inheritance before any fallback collection', async () => {
  for (const [kind, state] of [...['failure', 'cancelled', 'skipped', 'neutral', 'timed_out', 'unknown', null].map(state => ['check', state]), ...['failure', 'error', 'pending', 'unknown'].map(state => ['status', state]), ['pending-check', null]]) {
    const fixture = proofFixture();
    if (kind === 'status') fixture.statuses = [headStatus({ state, url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` })];
    else fixture.checks = [{ ...headCheck({ head_sha: sha, conclusion: state }), status: kind === 'pending-check' ? 'in_progress' : 'completed' }];
    let snapshot; try { snapshot = await fixtureSnapshot(fixture); } catch (error) { assert.match(error.message, /Source proof/); }
    const result = deliveryReady({ ...(snapshot ?? { runs: fixture.ownRuns, checks: fixture.checks, statuses: fixture.statuses }), sourceSha: sha, repository: sourcePolicy.repository });
    assert.equal(result.ready, false, `${kind}:${state}`); assert.equal(result.qualification, undefined);
    assert.ok(!fixture.requests.some(({ path }) => /code-scanning|\/pulls/.test(path)));
  }
});

test('all latest H tool/context verdicts require exact head, expected App and User/vendor URL', async () => {
  const cases = [
    fixture => fixture.headChecks.push(headCheck({ id: 999, conclusion: 'failure' })),
    fixture => fixture.headChecks.push(headCheck({ id: 999, status: 'in_progress', conclusion: null })),
    ...['neutral', 'skipped', 'cancelled', 'unknown'].map(conclusion => fixture => fixture.headChecks = [headCheck({ conclusion })]),
    fixture => fixture.headChecks = [headCheck({ head_sha: prior })], fixture => fixture.headChecks = [headCheck({ app: { id: 1, slug: codeqlApp.slug } })], fixture => fixture.headChecks = [headCheck({ app: { id: codeqlApp.id, slug: 'fake' } })],
    ...['pending', 'failure', 'error', 'unknown'].map(state => fixture => fixture.headStatuses.push(headStatus({ id: 999, state }))),
    fixture => fixture.headStatuses = [headStatus({ creator: { id: 1, type: 'User' } })], fixture => fixture.headStatuses = [headStatus({ creator: { id: sourcePolicy.snykUser, type: 'Bot' } })],
    fixture => fixture.headStatuses = [headStatus({ context: 'security/snyk (other)' })], fixture => fixture.headStatuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${prior}` })],
    fixture => fixture.headStatuses = [headStatus({ target_url: 'https://evil.example/org/x/pr-checks/abc' })], fixture => fixture.headStatuses.push(headStatus({ id: 999, context: 'security/snyk (extra)', state: 'pending' })),
    fixture => fixture.headStatuses = [headStatus({ target_url: 'https://app.snyk.io/org/other/pr-checks/abc' })], fixture => { const status = headStatus({ state: 'pending' }); delete status.id; fixture.headStatuses.push(status); }, fixture => { const check = headCheck({ conclusion: 'failure' }); delete check.id; fixture.headChecks.push(check); },
    fixture => fixture.headChecks = [headCheck({ id: 0 })], fixture => fixture.headChecks = [headCheck({ completed_at: '1' })], fixture => fixture.headChecks = [headCheck({ completed_at: 'unknown' })], fixture => fixture.headStatuses = [headStatus({ created_at: '1' })],
  ];
  for (const change of cases) {
    const fixture = proofFixture(); change(fixture);
    let snapshot; try { snapshot = await fixtureSnapshot(fixture); } catch (error) { assert.match(error.message, /Source proof/); continue; }
    assert.equal(deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }).ready, false);
  }
  assert.equal(trustedSnyk(headStatus(), headSha), true); assert.equal(trustedSnyk(headStatus({ target_url: 'http://app.snyk.io/org/x/pr-checks/abc' }), headSha), false);
});

test('authenticated merged PR requires public nonfork main, exact head/tree and exactly ordered parents', async () => {
  for (const change of [
    f => f.pr.merged = false, f => f.pr.merge_commit_sha = prior, f => f.pr.base.ref = 'dev', f => f.pr.base.repo = { ...f.repo, id: 1 }, f => f.pr.head.repo = { ...f.repo, fork: true }, f => f.pr.head.repo = { ...f.repo, private: true }, f => f.repo.default_branch = 'dev', f => f.repo.private = true,
    f => f.head.tree.sha = prior, f => f.head.sha = prior, f => f.commit.parents.reverse(), f => f.commit.parents.push({ sha: treeSha }), f => f.commit.parents = [f.commit.parents[0]],
  ]) { const fixture = proofFixture(); change(fixture); await assert.rejects(fixtureProof(fixture), /Source proof/); }
  const f = proofFixture(); assert.equal(mergeBinding({ repository: f.repo, pr: f.pr, commit: f.commit, head: f.head }).baselineSha, prior);
  const original = f.request; f.request = async (path, options) => path.includes(`/commits/${sha}/pulls`) ? { data: [f.pr, { ...f.pr, id: 5143, number: 143 }] } : original(path, options);
  await assert.rejects(fixtureProof(f), /unique merged PR/);
});

test('genuine complete native and server removals including zero are allowed independently', () => {
  for (const count of [0, 1]) {
    const f = proofFixture(), second = finding(); second.message.text = 'second inherited result';
    f.baseline.report.runs[0].results.push(second); f.baseline.server.runs[0].results.push({ ...serverFinding(), message: second.message, properties: { server: true } }); sealRole(f.baseline);
    f.current.report.runs[0].results = f.current.report.runs[0].results.slice(0, count); f.current.server.runs[0].results = f.current.server.runs[0].results.slice(0, count); sealRole(f.current);
    const result = compareNativeProof(f.current, f.baseline, f.comparison);
    assert.equal(result.nativeResults, count); assert.equal(result.baselineNativeResults, 2);
  }
});

test('complete native and server comparisons refuse modifications, extra duplicates and cross-representation substitutions', () => {
  const mutations = [
    f => f.current.report.runs[0].results[0].properties.typed = '1', f => f.current.report.runs[0].results[0].properties.ordered.reverse(), f => delete f.current.report.runs[0].results[0].properties.extra,
    f => f.current.report.runs[0].results.push(finding()), f => f.current.server.runs[0].results[0].properties.serverEnrichment.alert = 99, f => f.current.server.runs[0].results[0] = serverFinding(),
    f => f.current.server.runs[0].results.push(structuredClone(f.current.server.runs[0].results[0])),
  ];
  for (const mutation of mutations) { const f = proofFixture(); mutation(f); sealRole(f.current); assert.throws(() => compareNativeProof(f.current, f.baseline, f.comparison), /finding|count/); }
});

test('native and server source/config/catalog/coverage/processing uncertainty fails closed', () => {
  const changes = [
    f => f.current.run.head_sha = prior, f => f.current.run.event = 'pull_request', f => f.current.run.conclusion = 'failure', f => f.current.job.run_attempt = 2, f => f.current.job.steps.find(step => step.name === 'Validate CodeQL results').conclusion = 'skipped',
    f => f.current.artifact.workflow_run.head_repository_id = 1, f => f.current.artifact.expired = true,
    f => f.current.analysis.error = 'failed', f => f.current.analysis.warning = 'coverage uncertain', f => f.current.analysis.commit_sha = prior, f => f.current.analysis.ref = 'refs/pull/142/merge', f => f.current.analysis.category = '/other', f => f.current.analysis.environment = '{}', f => f.current.analysis.analysis_key = 'other', f => f.current.analysis.tool.version = 'unknown', f => f.current.analysis.created_at = '2026-11-02T11:00:00Z', f => f.current.analysis.rules_count++,
    f => f.current.processing.processing_status = 'pending', f => f.current.processing.errors = ['failed'], f => f.current.server.runs[0].versionControlProvenance[0].revisionId = prior,
    f => f.current.report.runs[0].tool.extensions[0].rules[0].description = 'changed full rule', f => f.current.report.runs[0].properties.codeqlConfigSummary.disableDefaultQueries = true, f => f.current.report.runs[0].properties.codeqlConfigSummary.queries = [],
    f => f.current.report.runs[0].invocations[0].executionSuccessful = false, f => f.current.report.runs[0].invocations[0].toolExecutionNotifications.splice(3, 1), f => f.current.report.runs[0].invocations[0].toolExecutionNotifications[0].descriptor.index = 99,
    f => f.current.report.runs[0].invocations[0].toolExecutionNotifications[0].locations[0].physicalLocation.artifactLocation.uri = '../escape', f => f.current.report.runs[0].artifacts[0].location.uriBaseId = '%OTHER%', f => f.current.report.runs[0].invocations[0].toolExecutionNotifications[0].level = 'warning', f => f.current.report.runs[0].invocations[0].toolExecutionNotifications[0].descriptor.id = 'unknown', f => f.current.report.runs[0].properties.metricResults = [],
    f => f.current.workflow = f.current.workflow.replace('contents: read', 'contents: write'), f => f.current.config += 'paths-ignore: [src/**]', f => f.current.setup += 'changed', f => f.comparison.total_commits = 2,
  ];
  for (const change of changes) { const f = proofFixture(); change(f); sealRole(f.current); assert.throws(() => compareNativeProof(f.current, f.baseline, f.comparison), /Source proof/); }
  const f = proofFixture(); f.current.zip[50] ^= 1; assert.throws(() => validateNativeRole(f.current, sha), /digest/);
  assert.throws(() => workflowScope('jobs: {}'), /layout/);
  const c = proofFixture().current; assert.equal(nativeCoverage(c.report, c.log).expected.typescript.length, 1);
  const encoded = nativeRole(sha, 20); encoded.report.runs[0].artifacts[0].location.uri = 'src/%5Broute%5D.ts';
  for (const notification of encoded.report.runs[0].invocations[0].toolExecutionNotifications) if (notification.locations?.[0].physicalLocation.artifactLocation.index === 0) notification.locations[0].physicalLocation.artifactLocation.uri = 'src/%5Broute%5D.ts';
  assert.deepEqual(nativeCoverage(encoded.report, encoded.log).expected.typescript, ['src/[route].ts']);
  for (const [from, to] of [[sha, prior], [c.report.runs[0].properties.jobRunUuid, 'wrong-uuid'], ['1 out of 1 TypeScript', '0 out of 1 TypeScript'], ['disable-default-queries: false', 'disable-default-queries: true'], ['SHA256 digest of uploaded artifact zip', 'missing digest'], ['Post-processing sarif files', 'missing member'], ['Analysis upload status is complete.', 'Analysis upload status is pending.']]) {
    const altered = c.log.replaceAll(from, to);
    assert.throws(() => { nativeCoverage(c.report, altered); jobLogProof(altered, { sourceSha: sha, job: c.job, artifact: c.artifact, native: c.report.runs[0] }); }, /Source proof/);
  }
});

test('per-file inventory changes require immutable added/removed source paths', () => {
  const f = proofFixture(), run = f.current.report.runs[0];
  const location = { uri: 'src/added.ts', uriBaseId: '%SRCROOT%', index: 3 }; run.artifacts.push({ location });
  run.invocations[0].toolExecutionNotifications.push({ level: 'none', message: { text: 'expected added TypeScript file' }, descriptor: { id: 'cli/expected-extracted-files/typescript', index: 0 }, locations: [{ physicalLocation: { artifactLocation: location } }] }, { level: 'none', message: { text: 'extracted added TypeScript file' }, descriptor: { id: 'js/diagnostics/successfully-extracted-files', index: 0, toolComponent: { index: 0 } }, locations: [{ physicalLocation: { artifactLocation: location } }] });
  sealRole(f.current); f.current.log = f.current.log.replace('1 out of 1 TypeScript', '2 out of 2 TypeScript');
  assert.throws(() => compareNativeProof(f.current, f.baseline, f.comparison), /unexplained added coverage/);
  f.comparison.files = [{ filename: 'src/added.ts', status: 'added' }];
  assert.equal(compareNativeProof(f.current, f.baseline, f.comparison).nativeResults, 1);
});

test('immutable cache avoids repeated bytes but rechecks every latest authority and processing fence', async () => {
  const f = proofFixture(), cache = new Map(), collect = () => collectSourceProof({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha, cache });
  await collect(); const downloads = f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length;
  assert.equal(downloads, 4); await collect(); assert.equal(f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, downloads);
  f.current.processing.processing_status = 'pending'; await assert.rejects(collect(), /processing/);
});

test('newest native pending/failure, artifact/run supersession and main movement refuse readiness', async () => {
  for (const mutate of [f => f.current.run.status = 'in_progress', f => f.current.run.conclusion = 'failure', f => f.current.job.conclusion = 'failure', f => f.current.analysis.error = 'newer failed']) { const f = proofFixture(); mutate(f); await assert.rejects(fixtureProof(f), /Source proof/); }
  for (const kind of ['head', 'artifact', 'run', 'analysis']) {
    const f = proofFixture(), original = f.request; let reads = 0;
    f.request = async (path, options) => {
      if (kind === 'head' && path.includes(`/commits/${headSha}/check-runs`) && ++reads === 2) f.headChecks.push(headCheck({ id: 999, conclusion: 'failure' }));
      if (kind === 'artifact' && path.includes('/runs/20/artifacts') && ++reads === 2) f.current.artifact.digest = `sha256:${'1'.repeat(64)}`;
      if (kind === 'run' && path.includes('/actions/workflows/security.yml/runs?') && path.includes(`head_sha=${sha}`) && ++reads === 2) f.current.run.run_attempt = 2;
      if (kind === 'analysis' && path.includes('/code-scanning/analyses?') && ++reads === 2) f.current.analysis.id++;
      return original(path, options);
    };
    await assert.rejects(fixtureProof(f), /superseded|association|Source proof/);
  }
  const f = proofFixture(), original = f.request; let fences = 0;
  f.request = async (path, options) => path.includes('/git/ref/heads/main') && ++fences === 2 ? { data: { ref: 'refs/heads/main', object: { type: 'commit', sha: prior } } } : original(path, options);
  const result = await reconcileReadiness(input({ repository: sourcePolicy.repository, event: { workflow_run: { ...completion().workflow_run, head_repository: publicRepo() } }, getSnapshot: () => fixtureSnapshot(f) }));
  assert.equal(result.outcome, 'superseded'); assert.equal(result.ready, false);
  const rerun = proofFixture(), route = rerun.request; let reads = 0;
  rerun.request = async (path, options) => { if (path.includes('/actions/runs?') && ++reads === 2) rerun.ownRuns[0].run_attempt = 2; return route(path, options); };
  await assert.rejects(fixtureSnapshot(rerun), /workflow attempt superseded/);
});

test('final publication validates selected delivery artifact ID, digest and run attempt', async () => {
  for (const mismatch of [{ expectedChecksAttempt: '2' }, { expectedArtifactId: '998' }, { expectedArtifactDigest: `sha256:${'0'.repeat(64)}` }]) {
    const f = proofFixture(), result = await reconcileReadiness(input({ repository: sourcePolicy.repository, event: { workflow_run: { ...completion().workflow_run, head_repository: publicRepo() } }, getSnapshot: () => fixtureSnapshot(f), ...mismatch }));
    assert.equal(result.ready, false); assert.match(result.reasons.join('\n'), /artifact\/attempt changed/);
  }
});

test('ordinary PR/native API 403, missing data and truncated source pages refuse proof', async () => {
  for (const endpoint of ['/pulls/142', '/code-scanning/analyses?', '/sarifs/', '/zip', '/logs', '/contents/']) {
    const f = proofFixture(), original = f.request;
    f.request = async (path, options) => { if (path.includes(endpoint)) throw new Error('GitHub readiness read failed (403)'); return original(path, options); };
    await assert.rejects(fixtureProof(f), /403/);
  }
  const f = proofFixture(), original = f.request;
  f.request = async (path, options) => path.includes('/compare/') ? { ...(await original(path, options)), hasNext: true } : original(path, options);
  await assert.rejects(fixtureProof(f), /truncated source comparison/);
  await assert.rejects(proofPages(async () => ({ data: { check_runs: [], total_count: 1 } }), 'repo/checks', 'check_runs'), /truncated/);
  await assert.rejects(proofPages(async () => ({ data: {} }), 'repo/checks'), /Malformed/);
});

test('bounded HTTP reader refuses response limits, malformed JSON, unknown redirects and timeout', async () => {
  const response = (body, headers = {}) => new Response(body, { headers });
  const read = (fetchImpl, now) => githubReader({ token: 'fixture-secret', fetchImpl, now });
  const get = read(async (_url, options) => { assert.equal(options.headers['accept-encoding'], 'identity'); return response('{"ok":true}'); });
  assert.deepEqual((await get('repos/owner/project')).data, { ok: true });
  await assert.rejects(get('https://evil.example'), /relative/);
  await assert.rejects(read(async () => response('x'.repeat(5)))('repo', { maxBytes: 4 }), /size/);
  await assert.rejects(read(async () => response('{}', { 'content-length': '3' }))('repo'), /truncated/);
  await assert.rejects(read(async () => response('{}', { 'content-encoding': 'gzip', 'content-length': '22' }))('repo'), /encoded HTTP/);
  await assert.rejects(read(async () => response('{}', { link: '<https://api.github.com/page2>; rel=next' }))('repo'), /pagination link/);
  await assert.rejects(read(async () => response('malformed'))('repo'), /JSON/);
  await assert.rejects(read(async () => new Response('', { status: 403 }))('repo'), /403/);
  await assert.rejects(read(async () => new Response('', { status: 302, headers: { location: 'https://evil.example/object' } }))('repo', { format: 'bytes' }), /untrusted/);
  let clock = 0; const expired = read(async () => response('{}'), () => clock); clock = proofLimits.deadlineMs + 1;
  await assert.rejects(expired('repo'), /deadline/);
  let reads = 0;
  const aborted = read(async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })), () => reads++ === 0 ? 0 : proofLimits.deadlineMs - 1);
  await assert.rejects(aborted('repo'), /abort/i);
});

test('both publisher effective permission maps retain ordinary proof read scopes without Admin grants', () => {
  const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
  const global = workflow.slice(workflow.indexOf('\npermissions:'), workflow.indexOf('\nconcurrency:'));
  const release = workflow.slice(workflow.indexOf('\n  release:'));
  for (const scope of [global, release.slice(0, release.indexOf('\n    steps:'))]) for (const permission of ['actions', 'checks', 'statuses', 'pull-requests', 'security-events']) assert.match(scope, new RegExp(`\\n +${permission}: read`));
  assert.ok(!/administration:|rules\/|rule-suites|bypass/.test(global));
  assert.match(workflow, /artifact-ids: \$\{\{ needs\.gate\.outputs\.artifact-id \}\}/);
  assert.match(workflow, /EXPECTED_ARTIFACT_DIGEST/); assert.match(workflow, /timeout-minutes: 5/);
});

test('delivery artifact proves actual producer attempt/source and timestamped upload identity', async () => {
  const f = proofFixture(), proof = deliveryProducerProof({ run: f.ownRuns[0], job: f.deliveryJob, artifact: f.deliveryArtifact, log: f.deliveryLog, sourceSha: sha });
  assert.equal(proof.producerJob, 110); assert.equal(proof.attempt, 1); assert.equal(proof.logSha256, digest(f.deliveryLog));
  assert.equal(deliveryProducerProof({ run: f.ownRuns[0], job: f.deliveryJob, artifact: f.deliveryArtifact, log: '\uFEFF' + f.deliveryLog + '\n!/_goals/\n!/work/', sourceSha: sha }).producerJob, 110);
  for (const change of [
    f => { f.ownRuns[0].run_attempt = 2; f.ownRuns[0].run_started_at = '2026-11-02T11:00:00Z'; }, // independent probe 1
    f => f.deliveryJob.run_attempt = 2, f => f.deliveryJob.head_sha = prior, f => f.deliveryArtifact.created_at = '2026-11-02T08:59:59Z',
    f => f.deliveryArtifact.updated_at = '2026-11-02T10:00:00Z', f => f.deliveryJob.steps.at(-1).conclusion = 'skipped',
    f => f.deliveryLog = f.deliveryLog.replace('Final size is 237 bytes', 'Final size is 236 bytes'), f => f.deliveryLog = f.deliveryLog.replace('Artifact ID 999', 'Artifact ID 998'),
    f => f.deliveryLog = f.deliveryLog.replace('f'.repeat(64), '0'.repeat(64)), f => f.deliveryLog = f.deliveryLog.replaceAll(sha, prior),
  ]) { const f = proofFixture(); change(f); await assert.rejects(fixtureSnapshot(f), /Source proof/); }
  const actualSecond = proofFixture(); actualSecond.ownRuns[0].run_attempt = 2; actualSecond.deliveryJob.run_attempt = 2;
  assert.equal((await fixtureSnapshot(actualSecond)).deliveryArtifact.attempt, 2);
  const superseded = proofFixture(), original = superseded.request; let reads = 0;
  superseded.request = async (path, options) => { if (path.endsWith('/actions/jobs/110') && ++reads === 2) superseded.deliveryJob.run_attempt = 2; return original(path, options); };
  await assert.rejects(fixtureSnapshot(superseded), /producing job changed between list\/detail/);
});

test('known CodeQL App malformed head/slug cannot become absence or resurrect older M/H passes', async () => {
  for (const role of ['M', 'H']) for (const field of ['slug', 'head_sha']) {
    const f = proofFixture(), malformed = headCheck({ id: 999, head_sha: role === 'M' ? sha : headSha, conclusion: 'failure' });
    if (field === 'slug') malformed.app = { id: codeqlApp.id }; else delete malformed.head_sha;
    if (role === 'H') f.headChecks.push(malformed);
    else { f.checks = [headCheck({ id: 502, head_sha: sha }), malformed]; f.statuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` })]; }
    let snapshot; try { snapshot = await fixtureSnapshot(f); } catch (error) { assert.match(error.message, /Source proof/); }
    const result = deliveryReady({ ...(snapshot ?? { runs: f.ownRuns, checks: f.checks, statuses: f.statuses, sourceProof: { binding: { sourceSha: sha, headSha }, headChecks: f.headChecks, headStatuses: f.headStatuses, nativeRuns: [f.current.run, f.baseline.run] } }), sourceSha: sha, repository: sourcePolicy.repository });
    assert.equal(result.ready, false, `${role} missing ${field}`); assert.equal(result.qualification, undefined);
    if (role === 'M') assert.equal(result.prerequisites.find(item => item.name === 'CodeQL').state, 'unknown');
  }
  const f = proofFixture(); f.headChecks.push(headCheck({ id: 999, app: { id: 1, slug: 'other-app' }, conclusion: 'failure' }));
  const snapshot = await fixtureSnapshot(f); assert.equal(deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }).ready, true, 'conclusively unrelated App does not veto expected App');
  for (const role of ['M', 'H']) {
    const f = proofFixture(), malformed = headStatus({ id: 999, state: 'failure' }); delete malformed.context;
    if (role === 'M') f.statuses = [headStatus(), malformed]; else f.headStatuses.push(malformed);
    await deniesPublic(f, new Map(), `${role} malformed status`);
  }
});

test('native and own-main potentially authoritative malformed records deny before exact-field filters', async () => {
  for (const field of ['environment', 'commit_sha', 'category', 'analysis_key']) {
    const f = proofFixture(), original = f.request, latest = { ...f.current.analysis, id: 999, error: 'newer failed' }; delete latest[field];
    f.request = async (path, options) => path.includes('/code-scanning/analyses?') ? { data: [latest, f.current.analysis, f.baseline.analysis], hasNext: false } : original(path, options);
    await assert.rejects(fixtureSnapshot(f), /potentially authoritative|analysis response/);
  }
  for (const native of [true, false]) for (const field of ['head_sha', 'head_branch', 'event', 'name']) {
    const f = proofFixture(), original = f.request, latest = { ...(native ? f.current.run : f.ownRuns[0]), id: 999, conclusion: 'failure' }; delete latest[field];
    f.request = async (path, options) => native && path.includes('/actions/workflows/security.yml/runs?') && path.includes(`head_sha=${sha}`) ? { data: { workflow_runs: [latest, f.current.run] }, hasNext: false } : !native && path.includes('/actions/runs?') ? { data: { workflow_runs: [latest, ...f.ownRuns] }, hasNext: false } : original(path, options);
    if (native) await assert.rejects(fixtureSnapshot(f), /potentially authoritative/);
    else { await assert.rejects(fixtureSnapshot(f), /potentially authoritative/); assert.ok(!f.requests.some(({ path }) => /code-scanning|\/pulls/.test(path))); }
  }
  for (const endpoint of ['/runs/20', '/runs/20/attempts/1/jobs', '/runs/20/artifacts']) {
    const f = proofFixture(), original = f.request; let reads = 0;
    f.request = async (path, options) => { const response = await original(path, options); if (new URL(path, 'https://api.github.com').pathname.endsWith(endpoint) && ++reads === 2) {
      if (endpoint.endsWith('/jobs')) delete response.data.jobs[0].head_sha;
      else if (endpoint.endsWith('/artifacts')) delete response.data.artifacts[0].name;
      else delete response.data.repository;
    } return response; };
    await assert.rejects(fixtureSnapshot(f), /Source proof/);
  }
});

test('PR association completeness binds list/request/detail identities and preserves nullable unmerged schemas', async () => {
  const f = proofFixture();
  assert.equal(selectMergeAssociation([f.pr], sha).number, 142);
  for (const state of ['open', 'closed']) {
    const unmerged = { id: 5143, number: 143, state, merged_at: null, merge_commit_sha: null, head: { repo: null }, base: null };
    assert.equal(selectMergeAssociation([unmerged, f.pr], sha).number, 142);
  }
  for (const field of ['merge_commit_sha', 'base', 'number']) {
    const f = proofFixture(), original = f.request, extra = structuredClone(f.pr); extra.number = 143; extra.id = 5143; delete extra[field];
    f.request = async (path, options) => path.includes(`/commits/${sha}/pulls?`) ? { data: [f.pr, extra] } : original(path, options);
    await assert.rejects(fixtureSnapshot(f), /PR association|PR merge/);
  }
  for (const when of ['initial', 'final']) {
    const f = proofFixture(), original = f.request; let reads = 0;
    f.request = async (path, options) => { const response = await original(path, options); if (path.endsWith('/pulls/142') && ++reads === (when === 'initial' ? 1 : 2)) response.data.number = 143; return response; };
    await assert.rejects(fixtureSnapshot(f), /list\/request\/detail identity contradiction/);
  }
  const nullable = proofFixture(), original = nullable.request;
  nullable.request = async (path, options) => { const response = await original(path, options); if (path.includes(`/commits/${sha}/pulls?`)) delete response.data[0].merged; return response; };
  const snapshot = await fixtureSnapshot(nullable); assert.equal(deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }).ready, true);
});

test('all broader authority probes refuse contradictions while genuine unrelated controls remain ready', async () => {
  const cases = [['valid-control', () => {}, true]];
  for (const field of ['merge_commit_sha', 'base', 'number']) cases.push([`PR association missing ${field}`, f => { const original = f.request, extra = structuredClone(f.pr); extra.number = 143; extra.id = 5143; delete extra[field]; f.request = async (path, options) => path.includes(`/commits/${sha}/pulls?`) ? { data: [f.pr, extra] } : original(path, options); }, false]);
  cases.push(['known unrelated PR merge', f => { const original = f.request, extra = { ...f.pr, id: 5143, number: 143, merge_commit_sha: prior }; f.request = async (path, options) => path.includes(`/commits/${sha}/pulls?`) ? { data: [f.pr, extra] } : original(path, options); }, true]);
  cases.push(['PR request/detail number', f => { const original = f.request; f.request = async (path, options) => { const response = await original(path, options); if (path.endsWith('/pulls/142')) response.data.number = 143; return response; }; }, false]);
  for (const selector of ['category', 'analysis_key', 'environment', 'commit_sha', 'ref']) cases.push([`newer native ${selector}`, f => { const original = f.request, extra = { ...f.current.analysis, id: 999, error: 'newer failed' }; extra[selector] = selector === 'commit_sha' ? prior : selector === 'ref' ? 'refs/heads/dev' : selector === 'analysis_key' ? 'dynamic/github-code-scanning/codeql:analyze' : selector === 'category' ? '/language:unknown' : 'other'; f.request = async (path, options) => path.includes('/code-scanning/analyses?') ? { data: [extra, f.current.analysis, f.baseline.analysis] } : original(path, options); }, selector === 'analysis_key']);
  for (const [name, index] of [['PR', 0], ['Security', 1]]) for (const field of ['name', 'path', 'head_sha', 'repository', 'run_attempt', 'run_started_at']) cases.push([`fresh final ${name} ${field}`, f => { const original = f.request; let reads = 0; f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/actions/runs?') && ++reads === 2) { const run = response.data.workflow_runs[index]; if (field === 'repository') delete run.repository; else if (field === 'run_attempt') run.run_attempt = 2; else if (field === 'run_started_at') run.run_started_at = '2026-11-02T11:00:00Z'; else run[field] = field === 'head_sha' ? prior : 'different'; } return response; }; }, false]);
  for (const role of ['M', 'H']) cases.push([`known CodeQL App ${role} name missing`, f => { const extra = { ...f.headChecks[0], head_sha: role === 'M' ? sha : headSha, id: 999, conclusion: 'failure' }; delete extra.name; if (role === 'M') f.checks.push(extra); else f.headChecks.push(extra); }, false]);
  for (const key of ['dynamic/github-code-scanning/codeql:analyze', sourcePolicy.analysisKey]) cases.push([`unrelated Python ${key}`, f => { const original = f.request, extra = { ...f.current.analysis, id: 999, error: 'other analysis', analysis_key: key, category: '/language:python', environment: '{"language":"python"}' }; f.request = async (path, options) => path.includes('/code-scanning/analyses?') ? { data: [extra, f.current.analysis, f.baseline.analysis] } : original(path, options); }, true]);
  cases.push(['PR association unknown at final fence', f => { const original = f.request; let reads = 0; f.request = async (path, options) => { const response = await original(path, options); if (path.includes(`/commits/${sha}/pulls?`) && ++reads === 2) { const extra = structuredClone(f.pr); extra.number = 143; extra.id = 5143; delete extra.merge_commit_sha; response.data.push(extra); } return response; }; }, false]);
  cases.push(['new native category contradiction at final fence', f => { const original = f.request; let reads = 0; f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/code-scanning/analyses?') && ++reads === 2) response.data.unshift({ ...f.current.analysis, id: 999, error: 'newer failed', category: '/language:unknown' }); return response; }; }, false]);
  for (const [name, change, expected] of cases) {
    const f = proofFixture(); change(f); let snapshot;
    try { snapshot = await fixtureSnapshot(f); } catch (error) { if (expected) throw error; assert.match(error.message, /Source proof|superseded|authority|binding|workflow/, name); continue; }
    const result = deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository });
    assert.equal(result.ready, expected, name); if (!expected) assert.equal(result.qualification, undefined, name);
  }
  const f = proofFixture(), cache = new Map(), read = () => readDeliverySnapshot({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha, cache });
  const stable = await read(); assert.equal(deliveryReady({ ...stable, sourceSha: sha, repository: sourcePolicy.repository }).ready, true);
  const downloads = f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, original = f.request;
  f.request = async (path, options) => path.includes('/code-scanning/analyses?') ? { data: [{ ...f.current.analysis, id: 999, error: 'newer failed', category: '/language:unknown' }, f.current.analysis, f.baseline.analysis] } : original(path, options);
  await assert.rejects(read(), /selected source\/job\/category\/environment\/upload context/);
  assert.equal(f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, downloads, 'verified cached bytes cannot rescue changed authority');
});

test('source coverage rejects control code points without a regex rule waiver', () => {
  const f = proofFixture(), run = f.current.report.runs[0];
  run.artifacts[0].location.uri = 'src/\u0001bad.ts';
  for (const note of run.invocations[0].toolExecutionNotifications) if (note.locations?.[0].physicalLocation.artifactLocation.index === 0) note.locations[0].physicalLocation.artifactLocation.uri = 'src/\u0001bad.ts';
  assert.throws(() => nativeCoverage(f.current.report, f.current.log), /unsafe native source path/);
});

test('public main fences require exact ref and commit type on both initial and final reads', async () => {
  for (const when of [1, 2]) for (const field of ['ref', 'type']) for (const value of [undefined, 'different']) {
    const f = proofFixture(), original = f.request; let reads = 0;
    f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/git/ref/heads/main') && ++reads === when) {
      const target = field === 'ref' ? response.data : response.data.object, key = field === 'ref' ? 'ref' : 'type';
      if (value === undefined) delete target[key]; else target[key] = value;
    } return response; };
    await assert.rejects(fixtureSnapshot(f), /Public current-main ref\/commit-type authority/);
  }
  const stable = proofFixture(), snapshot = await fixtureSnapshot(stable);
  assert.equal(deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }).ready, true);
});

test('required workflow authority uses known path or name before unrelatedness on initial/final/native lists', async () => {
  const denied = async f => {
    try { const snapshot = await fixtureSnapshot(f); const result = deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }); assert.equal(result.ready, false); assert.equal(result.qualification, undefined); }
    catch (error) { assert.match(error.message, /Source proof|superseded|authority/); }
  };
  for (const index of [0, 1]) for (const final of [false, true]) {
    const f = proofFixture(), contradiction = { ...f.ownRuns[index], id: 999, name: 'Other Workflow', conclusion: 'failure' };
    if (!final) f.ownRuns.push(contradiction);
    else { const original = f.request; let reads = 0; f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/actions/runs?') && ++reads === 2) response.data.workflow_runs.push(contradiction); return response; }; }
    await denied(f);
  }
  for (const final of [false, true]) {
    const f = proofFixture(), original = f.request; let reads = 0;
    f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/actions/workflows/security.yml/runs?') && path.includes(`head_sha=${sha}`) && ++reads === (final ? 2 : 1)) response.data.workflow_runs.push({ ...f.current.run, id: 999, name: 'Other Workflow', conclusion: 'failure' }); return response; };
    await denied(f);
  }
  const unrelated = proofFixture(); unrelated.ownRuns.push({ ...unrelated.ownRuns[0], id: 999, name: 'Other Workflow', path: '.github/workflows/other.yml', conclusion: 'failure' });
  const snapshot = await fixtureSnapshot(unrelated); assert.equal(deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }).ready, true);
});

test('native actual workflow/job/step/artifact chronology and timestamped evidence reject prior bytes relabelled to another attempt', async () => {
  const mutations = [];
  for (const field of ['created_at', 'run_started_at', 'updated_at']) mutations.push(f => { delete f.current.run[field]; });
  for (const field of ['workflow_name', 'created_at', 'started_at', 'completed_at']) mutations.push(f => { delete f.current.job[field]; });
  for (const field of ['created_at', 'updated_at']) mutations.push(f => { delete f.current.artifact[field]; });
  for (const name of ['Perform CodeQL Analysis', 'Preserve CodeQL results']) for (const field of ['started_at', 'completed_at']) mutations.push(f => { delete f.current.job.steps.find(step => step.name === name)[field]; });
  mutations.push(
    f => f.current.job.workflow_name = 'Other Workflow',
    f => f.current.job.created_at = '2026-11-02T12:00:00Z',
    f => { f.current.run.run_attempt = 2; f.current.job.id += 1000000; f.current.job.run_attempt = 2; f.current.run.run_started_at = '2026-11-02T12:00:00Z'; f.current.job.started_at = '2026-11-02T12:00:00Z'; f.current.job.completed_at = '2026-11-02T12:10:00Z'; },
    f => { f.current.job.started_at = '2026-11-02T12:00:00Z'; f.current.job.completed_at = '2026-11-02T12:10:00Z'; },
    f => { f.current.artifact.created_at = '2026-11-02T12:30:00Z'; f.current.artifact.updated_at = '2026-11-02T12:30:00Z'; },
    f => f.current.artifact.updated_at = '2026-11-02T10:00:00Z',
    f => f.current.job.steps.find(step => step.name === 'Perform CodeQL Analysis').completed_at = '2026-11-02T12:00:00Z',
    f => f.current.job.steps.find(step => step.name === 'Preserve CodeQL results').started_at = '2026-11-02T10:05:09Z',
    f => f.current.job.steps.at(-1).number = f.current.job.steps.at(-2).number,
    f => f.current.log = f.current.log.replace(/10:00:20\.100/g, '10:00:10.100'),
    f => f.current.log = f.current.log.replace(/10:04:00\.100/g, '10:00:23.000'),
    f => f.current.log = f.current.log.replace(/10:05:02\.(\d+)/g, '10:04:59.$1'),
    f => f.current.log = f.current.log.replace(/10:05:02\.(\d+)/g, '10:05:03.$1'),
    f => f.current.log = f.current.log.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /gm, ''),
    f => { // Coherent new metadata still cannot authenticate unchanged old log/ZIP/server bytes.
      for (const field of ['created_at', 'run_started_at', 'updated_at']) f.current.run[field] = f.current.run[field].replace('T09:', 'T11:').replace('T10:', 'T12:');
      for (const field of ['created_at', 'started_at', 'completed_at']) f.current.job[field] = f.current.job[field].replace('T10:', 'T12:');
      for (const step of f.current.job.steps) for (const field of ['started_at', 'completed_at']) step[field] = step[field].replace('T10:', 'T12:');
      for (const field of ['created_at', 'updated_at']) f.current.artifact[field] = f.current.artifact[field].replace('T10:', 'T12:');
      f.current.run.run_attempt = 2; f.current.job.run_attempt = 2;
    },
  );
  for (const mutate of mutations) {
    const f = proofFixture(); mutate(f); const before = digest(f.current.zip);
    assert.throws(() => validateNativeRole(f.current, sha), /Source proof/);
    assert.equal(digest(f.current.zip), before, 'custody refusals preserve complete native artifact bytes');
    await assert.rejects(fixtureSnapshot(f), /Source proof/);
  }
  const stable = proofFixture(); assert.equal(validateNativeRole(stable.current, sha).logged.end, Date.parse('2026-11-02T10:05:01Z'), 'whole-second end represents its full second, not a longer request allowance');
});

test('fresh final and verified-cache native custody fences include full semantic job/workflow identity', async () => {
  for (const mutate of [job => job.workflow_name = 'Other Workflow', job => job.started_at = '2027-11-02T00:00:00Z', job => job.completed_at = '2027-11-02T00:00:00Z', job => job.completed_at = '2026-11-02T10:05:11Z', job => job.steps.at(-1).completed_at = '2026-11-02T12:00:00Z']) {
    const f = proofFixture(), original = f.request; let reads = 0;
    f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/runs/20/attempts/1/jobs') && ++reads === 2) mutate(response.data.jobs[0]); return response; };
    await assert.rejects(fixtureSnapshot(f), /Source proof/);
  }
  for (const mutate of [f => f.current.job.completed_at = '2026-11-02T10:05:11Z', f => f.current.run.updated_at = '2026-11-02T10:05:21Z', f => f.current.job.workflow_name = 'Other Workflow', f => f.current.artifact.created_at = '2026-11-02T12:30:00Z']) {
    const f = proofFixture(), cache = new Map(), read = () => readDeliverySnapshot({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha, cache });
    const stable = await read(); assert.equal(deliveryReady({ ...stable, sourceSha: sha, repository: sourcePolicy.repository }).ready, true);
    const downloads = f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length; mutate(f);
    await assert.rejects(read(), /Source proof/);
    assert.equal(f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, downloads, 'changed custody cannot rebrand cached immutable bytes');
  }
});

test('known or partial CodeQL App authority cannot hide behind a contradictory name in any route or read phase', async () => {
  const hints = [
    check => check.name = 'Other Check',
    check => { check.name = 'Other Check'; check.app = { id: 1, slug: codeqlApp.slug }; },
    check => { check.name = 'Other Check'; check.app = { id: codeqlApp.id, slug: 'other-app' }; },
    check => { check.name = 'Other Check'; check.app = { id: codeqlApp.id }; },
    check => { check.name = 'Other Check'; check.app = { slug: codeqlApp.slug }; },
    check => { check.name = 'Other Check'; check.app = { slug: 'other-app' }; },
    check => { check.name = 'Other Check'; check.app = { id: String(codeqlApp.id), slug: codeqlApp.slug }; },
    check => { check.name = 'Other Check'; delete check.app; },
    check => { delete check.name; },
  ];
  const ready = async (f, cache) => { const snapshot = await readDeliverySnapshot({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha, cache }); return deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }); };
  for (const role of ['M', 'H']) for (const phase of ['initial', 'final', 'cache']) for (const hint of hints) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await ready(f, cache)).ready, true);
    const extra = headCheck({ id: 999, head_sha: role === 'M' ? sha : headSha, conclusion: 'failure' }); hint(extra);
    if (phase === 'final') { const original = f.request; let reads = 0; f.request = async (path, options) => { const response = await original(path, options); if (path.includes(`/commits/${extra.head_sha}/check-runs?`) && ++reads === 2) response.data.check_runs.push(extra); return response; }; }
    else f[role === 'M' ? 'checks' : 'headChecks'].push(extra);
    let result; try { result = await ready(f, cache); } catch (error) { assert.match(error.message, /Source proof|superseded|authority/); continue; }
    assert.equal(result.ready, false, `${role}/${phase}`); assert.equal(result.qualification, undefined);
    if (role === 'M') assert.equal(result.prerequisites.find(item => item.name === 'CodeQL').state, 'unknown');
  }
  for (const phase of ['initial', 'final', 'cache']) {
    const f = proofFixture(), cache = new Map(); f.checks = [headCheck({ head_sha: sha })]; f.statuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` })];
    if (phase === 'cache') { const direct = await ready(f, cache); assert.equal(direct.ready, true); assert.equal(direct.qualification, undefined); }
    const extra = { ...f.checks[0], id: 999, name: 'Other Check', conclusion: 'failure' };
    if (phase === 'final') { const original = f.request; let reads = 0; f.request = async (path, options) => { const response = await original(path, options); if (path.includes(`/commits/${sha}/check-runs?`) && ++reads === 2) response.data.check_runs.push(extra); return response; }; } else f.checks.push(extra);
    let result; try { result = await ready(f, cache); } catch (error) { assert.match(error.message, /Source proof|superseded|authority/); continue; }
    assert.equal(result.ready, false); assert.equal(result.qualification, undefined);
  }
  for (const app of [{ id: 1, slug: 'different-app' }, { id: 15368, slug: 'github-actions' }]) {
    const f = proofFixture(); f.headChecks.push(headCheck({ id: 999, app, conclusion: 'failure' }));
    assert.equal((await ready(f, new Map())).ready, true, 'a conclusively different App remains unrelated');
  }
});

test('native CodeQL-scoped identity precedes unrelated source/key/language classification across M/B and initial/final/cache', async () => {
  const ready = async (f, cache) => { const snapshot = await readDeliverySnapshot({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha, cache }); return deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository }); };
  for (const role of ['current', 'baseline']) for (const selector of ['category', 'environment']) for (const phase of ['initial', 'final', 'cache']) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await ready(f, cache)).ready, true);
    const downloads = f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, original = f.request;
    const extra = { ...f[role].analysis, id: 999, tool: { name: 'OtherTool', version: sourcePolicy.engine }, error: 'newer failed', [selector]: selector === 'category' ? '/language:unknown' : 'other' }; let reads = 0;
    f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/code-scanning/analyses?') && (phase !== 'final' || ++reads === 2)) response.data.unshift(extra); return response; };
    await assert.rejects(ready(f, cache), /contradictory potentially authoritative native analysis identity/);
    if (phase === 'cache') assert.equal(f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, downloads, 'current contradictory authority cannot reuse verified old bytes');
  }
  // Real histories include dynamic JS, static/dynamic Python, and an explicit
  // nullable engine version on an unrelated historical upload.
  for (const context of [
    { analysis_key: 'dynamic/github-code-scanning/codeql:analyze' },
    { category: '/language:python', environment: '{"language":"python"}' },
    { analysis_key: 'dynamic/github-code-scanning/codeql:analyze', category: '/language:python', environment: '{"language":"python"}' },
    { analysis_key: '/language:ruby', category: '/language:ruby', environment: '{}', tool: { name: 'CodeQL', version: null } },
  ]) {
    const f = proofFixture(), original = f.request, extra = { ...f.current.analysis, id: 999, error: 'unrelated analysis', ...context };
    f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/code-scanning/analyses?')) response.data.unshift(extra); return response; };
    assert.equal((await ready(f, new Map())).ready, true);
  }
  for (const mutate of [row => row.tool = { name: 'OtherTool', version: sourcePolicy.engine }, row => delete row.tool.name, row => delete row.tool.version]) {
    const f = proofFixture(), original = f.request, extra = { ...f.current.analysis, id: 999, analysis_key: 'dynamic/github-code-scanning/codeql:analyze', tool: { name: 'CodeQL', version: sourcePolicy.engine } }; mutate(extra);
    f.request = async (path, options) => { const response = await original(path, options); if (path.includes('/code-scanning/analyses?')) response.data.unshift(extra); return response; };
    await assert.rejects(ready(f, new Map()), /contradictory potentially authoritative native analysis identity/);
  }
});


// These exercise the complete public collector, both mutable-read fences and
// reuse of already proven immutable bytes. Refusal can be an explicit gate
// result or a bounded authority/protocol error, never a supplied success flag.
async function publicOutcome(f, cache = new Map()) {
  const snapshot = await readDeliverySnapshot({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha, cache });
  return deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository });
}
async function deniesPublic(f, cache, label) {
  let result;
  try { result = await publicOutcome(f, cache); }
  catch (error) { assert.match(error.message, /Source proof|superseded|authority/, label); return; }
  assert.equal(result.ready, false, label); assert.equal(result.qualification, undefined, label);
}
function interceptPhase(f, match, mutate, phase) {
  const original = f.request; let reads = 0;
  f.request = async (path, options) => { const response = await original(path, options); if (match(path) && (phase !== 'final' || ++reads === 2)) mutate(response); return response; };
}
function directVendors(f) {
  f.checks = [headCheck({ head_sha: sha })];
  f.statuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` })];
}

test('other App exclusion requires complete scoped REST authority on direct and qualified initial/final/cache reads', async () => {
  const malformed = [
    row => delete row.id, row => row.id = '999', row => delete row.name, row => row.name = 123,
    row => delete row.head_sha, row => row.head_sha = prior, row => delete row.status, row => row.status = 'unknown', row => row.conclusion = null,
    row => delete row.app.slug, row => row.app.slug = null, row => row.app.slug = '', row => row.app.slug = 57789,
    row => delete row.app.id, row => row.app.id = null, row => row.app.id = '15368', row => row.app = null,
  ];
  for (const role of ['M', 'H', 'direct-M']) for (const phase of ['initial', 'final', 'cache']) for (const change of malformed) {
    const f = proofFixture(), cache = new Map(); if (role === 'direct-M') directVendors(f);
    if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const source = role === 'H' ? headSha : sha, extra = headCheck({ id: 999, head_sha: source, app: { id: 15368, slug: 'github-actions' }, conclusion: 'failure' }); change(extra);
    interceptPhase(f, path => path.includes(`/commits/${source}/check-runs?`), response => response.data.check_runs.push(extra), phase);
    await deniesPublic(f, cache, `${role}/${phase}`);
  }
  for (const role of ['H', 'direct-M']) {
    const f = proofFixture(); if (role === 'direct-M') directVendors(f);
    f[role === 'H' ? 'headChecks' : 'checks'].push(headCheck({ id: 999, head_sha: role === 'H' ? headSha : sha, app: { id: 15368, slug: 'github-actions' }, conclusion: 'failure' }));
    const result = await publicOutcome(f); assert.equal(result.ready, true); if (role === 'direct-M') assert.equal(result.qualification, undefined);
  }
});

test('duplicate check/status/workflow authority cannot select the first green or hide across selectors in either order', async () => {
  for (const kind of ['M-check', 'H-check', 'M-status', 'H-status', 'PR', 'Security']) for (const phase of ['initial', 'final', 'cache']) for (const variant of ['identical', 'failure', 'pending', 'other-selector']) for (const reverse of [false, true]) {
    const f = proofFixture(), cache = new Map(); if (kind.startsWith('M-')) directVendors(f);
    if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const check = kind.endsWith('check'), status = kind.endsWith('status'), source = kind.startsWith('H-') ? headSha : sha;
    const match = path => check ? path.includes(`/commits/${source}/check-runs?`) : status ? path.includes(`/commits/${source}/statuses?`) : path.includes('/actions/runs?');
    interceptPhase(f, match, response => {
      const rows = check ? response.data.check_runs : status ? response.data : response.data.workflow_runs;
      const original = rows[check || status ? 0 : kind === 'PR' ? 0 : 1], extra = structuredClone(original);
      if (variant === 'failure') { if (status) extra.state = 'failure'; else extra.conclusion = 'failure'; }
      if (variant === 'pending') { if (status) extra.state = 'pending'; else { extra.status = 'in_progress'; extra.conclusion = null; } }
      if (variant === 'other-selector') { if (check) extra.app = { id: 15368, slug: 'github-actions' }; else if (status) extra.context = 'unrelated'; else { extra.name = 'Other Workflow'; extra.path = '.github/workflows/other.yml'; } }
      if (reverse) rows.unshift(extra); else rows.push(extra);
    }, phase);
    await deniesPublic(f, cache, `${kind}/${phase}/${variant}/${reverse}`);
  }
  // Pure gate evaluation has the same whole-history rule as API collection.
  const f = proofFixture(); directVendors(f);
  for (const field of ['runs', 'checks', 'statuses']) {
    const input = { runs: f.ownRuns, checks: f.checks, statuses: f.statuses, sourceSha: sha, repository: sourcePolicy.repository };
    input[field] = [...input[field], structuredClone(input[field][0])];
    assert.equal(deliveryReady(input).ready, false);
  }
  const control = observations(); control.runs.push({ ...control.runs[0], run_attempt: 2 });
  assert.equal(deliveryReady({ ...control, sourceSha: sha, repository }).ready, true, 'distinct actual workflow attempts remain distinct identities');
});

test('native and delivery whole histories reject repeated IDs before key/name/source filtering and immutable cache reuse', async () => {
  for (const kind of ['analysis', 'native-artifact', 'native-job', 'delivery-artifact', 'delivery-job']) for (const role of kind.startsWith('delivery') ? ['current'] : ['current', 'baseline']) for (const phase of ['initial', 'final', 'cache']) for (const variant of ['identical', 'conflicting', 'other-selector']) for (const reverse of [false, true]) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const delivery = kind.startsWith('delivery'), artifact = kind.endsWith('artifact'), selected = kind === 'analysis' ? f[role].analysis : delivery ? f[artifact ? 'deliveryArtifact' : 'deliveryJob'] : f[role][artifact ? 'artifact' : 'job'];
    const run = delivery ? 10 : f[role].run.id;
    interceptPhase(f, path => kind === 'analysis' ? path.includes('/code-scanning/analyses?') : path.includes(`/actions/runs/${run}/`) && path.includes(artifact ? '/artifacts?' : '/jobs?'), response => {
      const rows = kind === 'analysis' ? response.data : response.data[artifact ? 'artifacts' : 'jobs'], extra = structuredClone(selected);
      if (variant === 'conflicting') { if (kind === 'analysis') extra.error = 'failed'; else if (artifact) extra.expired = true; else extra.conclusion = 'failure'; }
      if (variant === 'other-selector') { if (kind === 'analysis') { extra.analysis_key = 'dynamic/github-code-scanning/codeql:analyze'; extra.commit_sha = headSha; } else extra.name = 'Other producer'; }
      if (reverse) rows.unshift(extra); else rows.push(extra);
    }, phase);
    await deniesPublic(f, cache, `${kind}/${role}/${phase}/${variant}/${reverse}`);
  }
});

test('pagination completeness requires unique authority occurrences as well as matching totals', async () => {
  for (const duplicate of [false, true]) {
    const f = proofFixture(); directVendors(f); const original = f.request;
    f.request = async (path, options) => {
      if (path.includes(`/commits/${sha}/check-runs?`)) {
        const page = Number(new URL(path, 'https://api.github.com').searchParams.get('page'));
        return { data: { total_count: 2, check_runs: [headCheck({ id: page === 1 || duplicate ? 501 : 502, head_sha: sha })] }, hasNext: page === 1 };
      }
      return original(path, options);
    };
    if (duplicate) await deniesPublic(f, new Map(), 'same check ID repeated across pages');
    else assert.equal((await publicOutcome(f)).ready, true, 'two unique complete checks across two pages');
  }
});

test('delivery custody uses complete workflow/job/ordered phases and exact timestamp precision initially/finally/from cache', async () => {
  const changes = [
    f => f.deliveryJob.steps.at(-1).completed_at = '2026-11-02T09:01:00.100Z',
    f => { f.deliveryArtifact.created_at = '2026-11-02T09:01:00.900Z'; f.deliveryArtifact.updated_at = '2026-11-02T09:01:00.100Z'; },
    f => f.ownRuns[0].updated_at = '2026-11-02T09:00:00Z',
    f => delete f.ownRuns[0].created_at, f => delete f.ownRuns[0].updated_at, f => delete f.deliveryJob.created_at,
    f => f.deliveryJob.created_at = '2026-11-02T09:02:01Z', f => f.deliveryJob.steps.reverse(),
    f => f.deliveryJob.steps[1].conclusion = 'skipped', f => f.deliveryJob.steps[1].number = 1,
    f => f.deliveryJob.steps[0].completed_at = '2026-11-02T09:00:20Z',
    f => f.deliveryArtifact.updated_at = '2026-11-02T09:01:00.050Z',
  ];
  for (const phase of ['initial', 'final', 'cache']) for (const change of changes) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    if (phase === 'final') { const original = f.request; let reads = 0; f.request = async (path, options) => { if (path.includes('/actions/runs?') && ++reads === 2) change(f); return original(path, options); }; }
    else change(f);
    await deniesPublic(f, cache, phase);
  }
  const f = proofFixture(); f.deliveryJob.steps.at(-1).completed_at = '2026-11-02T09:01:00.123Z'; f.deliveryArtifact.created_at = '2026-11-02T09:01:00.123Z'; f.deliveryArtifact.updated_at = '2026-11-02T09:01:00.123Z';
  assert.equal((await publicOutcome(f)).ready, true, 'fractional exact millisecond matches actual log evidence');
});


test('proven immutable custody IDs stay consistent across separately collected roles and cache coordinate changes', async () => {
  for (const kind of ['job', 'artifact']) {
    const f = proofFixture(), cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true);
    const downloads = f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, original = f.request;
    if (kind === 'job') {
      // The collection and detail are individually coherent, but this globally
      // immutable job ID has already proved a different native workflow/source.
      f.deliveryJob.id = f.current.job.id;
      f.request = async (path, options) => path.endsWith(`/actions/jobs/${f.current.job.id}`) ? { data: structuredClone(f.deliveryJob), hasNext: false } : original(path, options);
    } else {
      f.deliveryArtifact.id = f.current.artifact.id;
      f.deliveryLog = f.deliveryLog.replaceAll('999', String(f.deliveryArtifact.id));
    }
    await assert.rejects(publicOutcome(f, cache), /immutable producer authority identity conflicts|observation authority identity\/context contradiction/);
    assert.equal(f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, downloads, 'a changed cache coordinate cannot relabel an already proven authority ID');
  }
  const f = proofFixture(), cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true);
  assert.equal((await publicOutcome(f, cache)).ready, true, 'exact repeated authenticated reads are coherent');
});


test('one snapshot binds M/H verdict IDs and run cores across own/native views and pure gate inputs', async () => {
  for (const kind of ['check', 'status', 'own-native', 'across-attempts']) for (const phase of ['initial', 'final', 'cache']) for (const reverse of [false, true]) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    if (kind === 'check') f.checks = [headCheck({ head_sha: sha })];
    if (kind === 'status') f.statuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` })];
    interceptPhase(f, path => kind === 'check' ? path.includes(`/commits/${sha}/check-runs?`) : kind === 'status' ? path.includes(`/commits/${sha}/statuses?`) : path.includes('/actions/runs?'), response => {
      if (kind === 'check') response.data.check_runs[0].id = f.headChecks[0].id;
      else if (kind === 'status') response.data[0].id = f.headStatuses[0].id;
      else if (kind === 'own-native') response.data.workflow_runs.find(run => run.name === 'Security Scans').id = f.current.run.id;
      else { const security = response.data.workflow_runs.find(run => run.name === 'Security Scans'); security.id = 10; security.run_attempt = 2; }
      if (reverse && response.data.workflow_runs) response.data.workflow_runs.reverse();
    }, phase);
    await deniesPublic(f, cache, `${kind}/${phase}/${reverse}`);
  }
  const f = proofFixture(), snapshot = await fixtureSnapshot(f);
  for (const kind of ['check', 'status', 'workflow']) {
    const input = structuredClone(snapshot);
    if (kind === 'check') input.checks = [{ ...input.sourceProof.headChecks[0], head_sha: sha }];
    if (kind === 'status') input.statuses = [{ ...input.sourceProof.headStatuses[0], url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}` }];
    if (kind === 'workflow') { input.runs[1].id = input.runs[0].id; input.runs[1].run_attempt = 2; }
    const result = deliveryReady({ ...input, sourceSha: sha, repository: sourcePolicy.repository }); assert.equal(result.ready, false); assert.equal(result.qualification, undefined);
  }
  const sameView = proofFixture(); sameView.current.run.event = 'push'; sameView.ownRuns[1] = structuredClone(sameView.current.run);
  assert.equal((await publicOutcome(sameView)).ready, true, 'the exact same true push workflow can supply coherent own/native views');
});

test('every scoped native/delivery job and artifact row registers context and identity before exclusions', async () => {
  for (const kind of ['native-job', 'native-artifact', 'delivery-job', 'delivery-artifact']) for (const role of kind.startsWith('native') ? ['current', 'baseline'] : ['current']) for (const phase of ['initial', 'final', 'cache']) for (const variant of ['coherent', 'wrong-scope', 'cross-identity']) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const native = kind.startsWith('native'), artifact = kind.endsWith('artifact'), run = native ? f[role].run : f.ownRuns[0];
    const selected = native ? f[role][artifact ? 'artifact' : 'job'] : f[artifact ? 'deliveryArtifact' : 'deliveryJob'];
    const other = native ? f[artifact ? 'deliveryArtifact' : 'deliveryJob'] : f.current[artifact ? 'artifact' : 'job'];
    const extra = structuredClone(variant === 'wrong-scope' ? other : selected); extra.name = 'Other unrelated producer';
    extra.id = variant === 'coherent' ? extra.id + 9000 : other.id;
    interceptPhase(f, path => path.includes(`/actions/runs/${run.id}/`) && path.includes(artifact ? '/artifacts?' : '/jobs?'), response => response.data[artifact ? 'artifacts' : 'jobs'].push(extra), phase);
    if (variant === 'coherent') assert.equal((await publicOutcome(f, cache)).ready, true, `${kind}/${role}/${phase}`);
    else await deniesPublic(f, cache, `${kind}/${role}/${phase}/${variant}`);
  }
});

test('PR association identity and explicit merge coherence precede all unrelatedness filters on both orders and fences', async () => {
  for (const kind of ['unmerged', 'other-merge', 'other-base', 'same-ID-other-number', 'same-number-other-ID']) for (const phase of ['initial', 'final', 'cache']) for (const reverse of [false, true]) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    interceptPhase(f, path => path.includes(`/commits/${sha}/pulls?`), response => {
      delete response.data[0].merged; const extra = structuredClone(response.data[0]);
      if (kind === 'unmerged') extra.merged_at = null;
      if (kind === 'other-merge') extra.merge_commit_sha = prior;
      if (kind === 'other-base') extra.base.ref = 'dev';
      if (kind === 'same-ID-other-number') { extra.number = 143; extra.merge_commit_sha = prior; }
      if (kind === 'same-number-other-ID') { extra.id = 5143; extra.merge_commit_sha = prior; }
      if (reverse) response.data.unshift(extra); else response.data.push(extra);
    }, phase);
    await deniesPublic(f, cache, `${kind}/${phase}/${reverse}`);
  }
  for (const selector of ['other-merge', 'other-base']) for (const contradiction of ['false-with-time', 'true-with-null', 'open-with-time', 'invalid-calendar']) for (const phase of ['initial', 'final', 'cache']) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const extra = structuredClone(f.pr); extra.id = 5143; extra.number = 143;
    if (selector === 'other-merge') extra.merge_commit_sha = prior; else extra.base.ref = 'dev';
    if (contradiction === 'false-with-time') extra.merged = false;
    if (contradiction === 'true-with-null') extra.merged_at = null;
    if (contradiction === 'open-with-time') { delete extra.merged; extra.state = 'open'; }
    if (contradiction === 'invalid-calendar') extra.merged_at = '2026-02-31T08:00:00Z';
    interceptPhase(f, path => path.includes(`/commits/${sha}/pulls?`), response => response.data.push(extra), phase);
    await deniesPublic(f, cache, `${selector}/${contradiction}/${phase}`);
  }
  for (const kind of ['other-merge', 'other-base', 'nullable']) {
    const f = proofFixture(), extra = { ...structuredClone(f.pr), id: 5143, number: 143 };
    if (kind === 'other-merge') extra.merge_commit_sha = prior;
    if (kind === 'other-base') extra.base.ref = 'dev';
    if (kind === 'nullable') { delete extra.merged; extra.state = 'open'; extra.merged_at = null; extra.merge_commit_sha = null; extra.base = null; extra.head = { repo: null }; }
    interceptPhase(f, path => path.includes(`/commits/${sha}/pulls?`), response => { delete response.data[0].merged; response.data.push(extra); }, 'initial');
    assert.equal((await publicOutcome(f)).ready, true, kind);
  }
});

test('semantic list/detail views tolerate profile differences while separate snapshots permit real progress and later attempts', async () => {
  const f = proofFixture(), original = f.request;
  f.request = async (path, options) => { const response = await original(path, options); if (path.endsWith('/pulls/142')) { response.data.title = 'detail only'; response.data.base.repo.stargazers_count = 999; } if (path.endsWith('/actions/jobs/110')) response.data.labels = ['different response-only profile']; return response; };
  assert.equal((await publicOutcome(f)).ready, true);
  const pending = proofFixture(), cache = new Map(); pending.ownRuns[0].status = 'in_progress'; pending.ownRuns[0].conclusion = null;
  const first = await publicOutcome(pending, cache); assert.equal(first.ready, false); assert.equal(first.retryable, true);
  pending.ownRuns[0].status = 'completed'; pending.ownRuns[0].conclusion = 'success'; assert.equal((await publicOutcome(pending, cache)).ready, true);
  pending.ownRuns[0].run_attempt = 2; pending.ownRuns[0].run_started_at = '2026-11-02T11:00:00Z'; pending.ownRuns[0].updated_at = '2026-11-02T11:03:00Z';
  pending.deliveryJob.id = 1110; pending.deliveryJob.run_attempt = 2;
  for (const key of ['created_at', 'started_at', 'completed_at']) pending.deliveryJob[key] = pending.deliveryJob[key].replace('T09:', 'T11:');
  for (const step of pending.deliveryJob.steps) for (const key of ['started_at', 'completed_at']) step[key] = step[key].replace('T09:', 'T11:');
  pending.deliveryArtifact.id = 1999; for (const key of ['created_at', 'updated_at']) pending.deliveryArtifact[key] = pending.deliveryArtifact[key].replace('T09:', 'T11:');
  pending.deliveryLog = pending.deliveryLog.replaceAll('T09:', 'T11:').replaceAll('999', '1999');
  const old = pending.request; pending.request = async (path, options) => path.endsWith('/actions/jobs/1110') ? { data: structuredClone(pending.deliveryJob), hasNext: false } : path.endsWith('/actions/jobs/1110/logs') ? { data: pending.deliveryLog, hasNext: false } : old(path, options);
  const later = await publicOutcome(pending, cache); assert.equal(later.ready, true); assert.equal(later.checksRun, 10, 'same workflow core at a genuine later producing attempt');
});


test('standalone native comparisons and pure proof transport retain cross-role identities and exact source scopes', async () => {
  const f = proofFixture(), b = f.baseline; b.run.id = f.current.run.id; b.run.run_attempt = 2; b.job.run_id = b.run.id; b.job.run_attempt = 2; b.artifact.workflow_run.id = b.run.id;
  assert.throws(() => compareNativeProof(f.current, b, f.comparison), /observation authority identity\/context contradiction/);
  const stable = proofFixture(), snapshot = await fixtureSnapshot(stable);
  for (const change of [value => value.sourceProof.nativeRuns[1] = structuredClone(value.sourceProof.nativeRuns[0]), value => value.sourceProof.nativeRuns[0].id = 999, value => delete value.sourceProof.nativeRuns]) {
    const input = structuredClone(snapshot); change(input); const result = deliveryReady({ ...input, sourceSha: sha, repository: sourcePolicy.repository }); assert.equal(result.ready, false); assert.equal(result.qualification, undefined); assert.equal(result.prerequisites.find(item => item.name === 'CodeQL').state, 'missing', 'a refused proof does not relabel a genuinely absent M record');
  }
  for (const conflict of [false, true]) {
    const f = proofFixture(), original = f.request;
    f.request = async (path, options) => {
      if (path.includes(`/commits/${sha}/pulls?`)) {
        const page = Number(new URL(path, 'https://api.github.com').searchParams.get('page')), pr = structuredClone(f.pr); delete pr.merged;
        if (page === 2) { if (!conflict) { pr.id = 5143; pr.number = 143; } pr.merge_commit_sha = prior; }
        return { data: [pr], hasNext: page === 1 };
      }
      return original(path, options);
    };
    if (conflict) await deniesPublic(f, new Map(), 'same PR ID/number hidden on a later page'); else assert.equal((await publicOutcome(f)).ready, true, 'distinct coherent unrelated PR on another page');
  }
});


test('known scoped REST URIs cannot contradict authority IDs, source or collection context', async () => {
  for (const kind of ['check', 'workflow', 'job', 'artifact', 'analysis', 'PR']) for (const phase of ['initial', 'final', 'cache']) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const match = path => kind === 'check' ? path.includes(`/commits/${headSha}/check-runs?`) : kind === 'workflow' ? path.includes('/actions/runs?') : kind === 'job' ? path.includes('/actions/runs/20/') && path.includes('/jobs?') : kind === 'artifact' ? path.includes('/actions/runs/20/artifacts?') : kind === 'analysis' ? path.includes('/code-scanning/analyses?') : path.includes(`/commits/${sha}/pulls?`);
    interceptPhase(f, match, response => { const row = kind === 'check' ? response.data.check_runs[0] : kind === 'workflow' ? response.data.workflow_runs[0] : kind === 'job' ? response.data.jobs[0] : kind === 'artifact' ? response.data.artifacts[0] : response.data[0]; row.url = 'https://api.github.com/repos/other/repository/wrong/999'; }, phase);
    await deniesPublic(f, cache, `${kind}/${phase}`);
  }
});


test('one strict UTC validator preserves valid completion calendars and refuses rollovers before initial/final/cache qualification', async () => {
  const valid = ['2026-11-02T07:53:43Z', '2024-02-29T07:53:43Z', '2000-02-29T07:53:43.1234567Z'];
  for (const completed of valid) { assert.equal(isUtcTimestamp(completed), true); const f = proofFixture(); f.headChecks[0].completed_at = completed; assert.equal((await publicOutcome(f)).ready, true); }
  const invalid = ['2026-02-29T07:53:43Z', '2026-02-31T07:53:43Z', '2026-04-31T07:53:43Z', '2026-13-02T07:53:43Z', '2026-11-02T24:00:00Z', '1900-02-29T07:53:43Z', undefined, null, 42];
  for (const value of invalid) { assert.equal(isUtcTimestamp(value), false); for (const phase of ['initial', 'final', 'cache']) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    interceptPhase(f, path => path.includes(`/commits/${headSha}/check-runs?`), response => response.data.check_runs[0].completed_at = value, phase);
    await deniesPublic(f, cache, `${String(value)}/${phase}`);
  } }
  const pending = proofFixture(); pending.checks = [headCheck({ head_sha: sha, status: 'queued', conclusion: null, started_at: null, completed_at: null })];
  const result = await publicOutcome(pending); assert.equal(result.ready, false); assert.equal(result.prerequisites.find(item => item.name === 'CodeQL').state, 'pending');
  const direct = proofFixture(); directVendors(direct); assert.equal((await publicOutcome(direct)).qualification, undefined);
  for (const change of [f => f.headChecks[0].started_at = '2026-02-31T07:53:41Z', f => f.headChecks[0].started_at = '2026-11-02T07:54:00Z', f => f.headStatuses[0].updated_at = '2026-04-31T07:49:54Z', f => f.headStatuses[0].updated_at = '2026-11-02T07:49:53Z']) { const f = proofFixture(); change(f); await deniesPublic(f, new Map(), 'supplied related vendor timestamps stay coherent'); }
});

test('fresh complete native M/B invocations reject both diagnostic channels and explicit process/configuration uncertainty', async () => {
  const changes = [
    inv => inv.toolConfigurationNotifications = [{ level: 'error', message: { text: 'Configuration failed' } }],
    inv => inv.toolConfigurationNotifications = [{ level: 'warning', message: { text: 'Configuration incomplete' } }],
    inv => inv.toolConfigurationNotifications = [{ level: 'none', message: { text: 'Unknown configuration diagnostic' } }],
    inv => inv.toolConfigurationNotifications = { level: 'error' }, inv => inv.toolConfigurationNotifications = null,
    inv => inv.exitCode = 2, inv => inv.exitCode = '0', inv => inv.exitCode = null, inv => inv.exitCode = 0.5,
    inv => inv.processStartFailureMessage = 'Could not start CodeQL', inv => inv.processStartFailureMessage = null, inv => inv.processStartFailureMessage = '',
    inv => inv.exitSignalName = 'SIGTERM', inv => inv.exitSignalNumber = 15, inv => inv.exitSignalNumber = 0,
    inv => inv.ruleConfigurationOverrides = [{ descriptor: { id: 'js/issue' }, configuration: { enabled: false } }],
    inv => inv.ruleConfigurationOverrides = [{ descriptor: { id: 'js/issue' }, configuration: { enabled: true } }],
    inv => inv.notificationConfigurationOverrides = [{ configuration: { enabled: false } }], inv => inv.notificationConfigurationOverrides = {},
    inv => inv.exitCodeDescription = 42,
    inv => { inv.startTimeUtc = '2026-11-02T10:04:00Z'; inv.endTimeUtc = '2026-11-02T10:03:00Z'; },
    inv => inv.startTimeUtc = '2026-02-31T10:01:11Z', inv => inv.endTimeUtc = null,
    inv => inv.startTimeUtc = '2026-11-02T09:59:59Z', inv => inv.endTimeUtc = '2026-11-02T10:06:00Z',
    inv => inv.executionSuccessful = false, inv => inv.toolExecutionNotifications[0].level = 'warning',
    inv => inv.toolExecutionNotifications = null, inv => inv.toolExecutionNotifications.push(null),
  ];
  for (const role of ['current', 'baseline']) for (const change of changes) {
    const f = proofFixture(); change(f[role].report.runs[0].invocations[0]); sealRole(f[role]);
    await assert.rejects(fixtureSnapshot(f), /native invocation|native execution|native notification|native process|native query|unknown\/error\/invalid native notification|complete successful native invocation/);
  }
});

test('supported optional invocation facts and complete zero/removal proofs remain positive without result normalization', async () => {
  for (const role of ['current', 'baseline']) for (const mode of ['absent', 'empty', 'interval', 'start-only', 'end-only']) {
    const f = proofFixture(), invocation = f[role].report.runs[0].invocations[0];
    if (mode === 'empty') Object.assign(invocation, { toolConfigurationNotifications: [], ruleConfigurationOverrides: [], notificationConfigurationOverrides: [], exitCode: 0, exitCodeDescription: '' });
    if (mode === 'interval' || mode === 'start-only') invocation.startTimeUtc = '2026-11-02T10:01:11.1234567Z';
    if (mode === 'interval' || mode === 'end-only') invocation.endTimeUtc = '2026-11-02T10:04:50Z';
    sealRole(f[role]); assert.equal((await publicOutcome(f)).ready, true, `${role}/${mode}`);
  }
  for (const baselineZero of [false, true]) {
    const f = proofFixture();
    for (const role of baselineZero ? ['current', 'baseline'] : ['current']) {
      f[role].report.runs[0].results = []; f[role].server.runs[0].results = [];
      Object.assign(f[role].report.runs[0].invocations[0], { toolConfigurationNotifications: [], ruleConfigurationOverrides: [], notificationConfigurationOverrides: [], exitCode: 0 }); sealRole(f[role]);
    }
    const result = await publicOutcome(f); assert.equal(result.ready, true); assert.equal(result.qualification.findings.nativeResults, 0); assert.equal(result.qualification.findings.serverResults, 0);
    f.current.report.runs[0].invocations[0].toolConfigurationNotifications = [{ level: 'error', message: { text: 'Required configuration missing' } }]; sealRole(f.current);
    await assert.rejects(fixtureSnapshot(f), /native invocation configuration/);
  }
});

test('invocation mutations at final/cache fences are refused independently of fresh parser acceptance', async () => {
  for (const role of ['current', 'baseline']) for (const phase of ['final', 'cache']) {
    const f = proofFixture(), cache = new Map();
    if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const downloads = f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length;
    const mutate = () => { f[role].report.runs[0].invocations[0].exitCode = 2; sealRole(f[role]); };
    if (phase === 'final') { const original = f.request; let reads = 0; f.request = async (path, options) => { if (path.includes(`/actions/runs/${f[role].run.id}/artifacts?`) && ++reads === 2) mutate(); return original(path, options); }; }
    else mutate();
    await assert.rejects(publicOutcome(f, cache), /authority|custody|superseded/);
    if (phase === 'cache') assert.equal(f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, downloads, 'changed cached immutable artifact refuses before a fresh parser run');
  }
});


const producingRoot = 'file:///home/runner/work/Project-Cortex/Project-Cortex/';
const exactNativeVcs = role => [{ repositoryUri: `https://github.com/${sourcePolicy.repository}`, revisionId: role.sourceSha }];
test('optional native source metadata preserves absence, redaction, same-source aliases and supported relative bases', async () => {
  const controls = [
    () => {},
    r => { r.versionControlProvenance = []; r.originalUriBaseIds = {}; },
    r => r.originalUriBaseIds = { '%SRCROOT%': {} },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: '' }, '%PRIVATE%': {} },
    (r, role) => r.versionControlProvenance = exactNativeVcs(role),
    r => r.versionControlProvenance = [{ repositoryUri: `https://github.com/${sourcePolicy.repository}.git/`, branch: 'refs/heads/another-branch' }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], revisionId: role.sourceSha.toUpperCase(), branch: '', revisionTag: 'another-alias', asOfTimeUtc: '2024-02-29T00:00:00Z' }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], mappedTo: { uri: producingRoot.slice(0, -1) } }],
    (r, role) => { r.originalUriBaseIds = { '%SRCROOT%': { uri: producingRoot } }; r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], mappedTo: { uri: '', uriBaseId: '%SRCROOT%' } }]; },
    r => r.originalUriBaseIds = { '%PARENT%': { uri: 'file:///home/runner/work/Project-Cortex/' }, '%SRCROOT%': { uri: 'Project-Cortex/', uriBaseId: '%PARENT%' } },
    r => r.originalUriBaseIds = { '%STAGING%': { uri: 'file:///home/runner/work/Project-Cortex/staging/' }, '%SRCROOT%': { uri: '../Project-Cortex/', uriBaseId: '%STAGING%' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: 'file://localhost/home/runner/work/Project-Cortex/Project%2dCortex/' } },
    r => r.originalUriBaseIds = { '%CHECKOUT%': { uri: producingRoot }, '%SRCROOT%': { uri: '', uriBaseId: '%CHECKOUT%' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': {}, '%TOOLS%': { uri: 'file:///opt/codeql/' } },
  ];
  for (const role of ['current', 'baseline']) for (const change of controls) {
    const f = proofFixture(), findings = canonical(f[role].report.runs[0].results); change(f[role].report.runs[0], f[role]); sealRole(f[role]);
    assert.equal((await publicOutcome(f)).ready, true); assert.equal(canonical(f[role].report.runs[0].results), findings, 'source metadata validation does not rewrite complete finding objects');
  }
  const f = proofFixture(); for (const role of ['current', 'baseline']) { const run = f[role].report.runs[0]; run.originalUriBaseIds = { '%OTHER%': { uri: producingRoot } }; run.results[0].locations[0].physicalLocation.artifactLocation.uriBaseId = '%OTHER%'; sealRole(f[role]); }
  assert.equal((await publicOutcome(f)).ready, true, 'a used supported relative base resolves against the same checkout, without changing multiset object equality');
});

test('fresh native M/B source metadata rejects malformed, conflicting and ambiguous source claims before complete proof', async () => {
  const changes = [
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], revisionId: 'f'.repeat(40) }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], repositoryUri: 'https://github.com/other/repository' }],
    ...[null, {}, 42, 'unknown'].map(value => r => r.versionControlProvenance = value),
    r => r.versionControlProvenance = [null], r => r.versionControlProvenance = [{}],
    (r, role) => r.versionControlProvenance = [exactNativeVcs(role)[0], exactNativeVcs(role)[0]],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], revisionId: 42 }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], branch: null }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], asOfTimeUtc: '2026-02-31T00:00:00Z' }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], mappedTo: { uri: 'file:///tmp/other-source/' } }],
    ...[null, [], 42, 'unknown'].map(value => r => r.originalUriBaseIds = value),
    r => r.originalUriBaseIds = { '%SRCROOT%': null },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: 'file:///tmp/other-source/' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: producingRoot.slice(0, -1) } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: null } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: 'Project-Cortex/' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: '', uriBaseId: '%MISSING%' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: '', uriBaseId: '%CYCLE%' }, '%CYCLE%': { uri: '', uriBaseId: '%SRCROOT%' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: 'Project-Cortex/', uriBaseId: '%PRIVATE%' }, '%PRIVATE%': {} },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: '%GG', uriBaseId: '%PARENT%' }, '%PARENT%': { uri: producingRoot } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: producingRoot.replace('Project-Cortex/', 'Project%2fCortex/') } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: 'file://other-machine/home/runner/work/Project-Cortex/Project-Cortex/' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: 'https://example.com/source/' } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: producingRoot, index: 0 } },
    r => r.originalUriBaseIds = { '%SRCROOT%': { uri: producingRoot, unknownSource: 'elsewhere' } },
    r => { r.originalUriBaseIds = { '%FOREIGN%': { uri: 'file:///tmp/source/' } }; const location = r.results[0].locations[0].physicalLocation.artifactLocation; delete location.index; location.uriBaseId = '%FOREIGN%'; },
    r => { r.originalUriBaseIds = { '%FOREIGN%': { uri: 'file:///tmp/source/' } }; r.artifacts[0].location.uriBaseId = '%FOREIGN%'; },
  ];
  for (const role of ['current', 'baseline']) for (const change of changes) { const f = proofFixture(); change(f[role].report.runs[0], f[role]); sealRole(f[role]); await assert.rejects(fixtureSnapshot(f), /Source proof:.*native/); }
});

test('complete zero/removal native source proofs stay positive and conflicting source metadata still refuses', async () => {
  for (const baselineZero of [false, true]) {
    const f = proofFixture();
    for (const role of baselineZero ? ['current', 'baseline'] : ['current']) { const run = f[role].report.runs[0]; run.results = []; f[role].server.runs[0].results = []; run.versionControlProvenance = exactNativeVcs(f[role]); run.originalUriBaseIds = { '%SRCROOT%': {} }; sealRole(f[role]); }
    const result = await publicOutcome(f); assert.equal(result.ready, true); assert.equal(result.qualification.findings.nativeResults, 0); assert.equal(result.qualification.findings.serverResults, 0);
    f.current.report.runs[0].versionControlProvenance[0].revisionId = 'f'.repeat(40); sealRole(f.current); await assert.rejects(fixtureSnapshot(f), /native revision contradicts/);
  }
});

test('native source metadata changes at final/cache fences refuse independently of fresh source parser checks', async () => {
  for (const role of ['current', 'baseline']) for (const phase of ['final', 'cache']) {
    const f = proofFixture(), cache = new Map(); if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    const downloads = f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length;
    const mutate = () => { f[role].report.runs[0].originalUriBaseIds = { '%SRCROOT%': { uri: 'file:///tmp/another-source/' } }; sealRole(f[role]); };
    if (phase === 'final') { const original = f.request; let reads = 0; f.request = async (path, options) => { if (path.includes(`/actions/runs/${f[role].run.id}/artifacts?`) && ++reads === 2) mutate(); return original(path, options); }; } else mutate();
    await assert.rejects(publicOutcome(f, cache), /authority|custody|superseded/);
    if (phase === 'cache') assert.equal(f.requests.filter(({ path }) => /\/zip$|\/logs$/.test(path)).length, downloads, 'changed cached bytes refuse at custody, not a new parser execution');
  }
});


test('server references preserve normalized direct/index-only/no-inventory and coherent declared base representations', async () => {
  for (const mode of ['unaltered', 'no-index-no-map', 'no-index-empty-map', 'index-only', 'minus-one-no-map', 'empty-bases', 'redacted-base', 'different-machine-base', 'relative-base', 'same-base-alias', 'URI-alias', 'encoded-URI']) {
    const f = proofFixture();
    for (const role of ['current', 'baseline']) {
      const run = f[role].server.runs[0], location = run.results[0].locations[0].physicalLocation.artifactLocation;
      if (mode.startsWith('no-index')) delete location.index;
      if (mode === 'no-index-no-map') delete run.artifacts;
      if (mode === 'no-index-empty-map') run.artifacts = [];
      if (mode === 'index-only') delete location.uri;
      if (mode === 'minus-one-no-map') { location.index = -1; delete run.artifacts; }
      if (mode === 'empty-bases') run.originalUriBaseIds = {};
      if (['redacted-base', 'different-machine-base', 'relative-base', 'same-base-alias'].includes(mode)) {
        run.originalUriBaseIds = mode === 'redacted-base' ? { '%SERVER%': {} } : mode === 'relative-base' ? { '%PARENT%': { uri: 'file:///normalized/server/' }, '%SERVER%': { uri: 'repository/', uriBaseId: '%PARENT%' } } : { '%SERVER%': { uri: 'file:///a/server-only/normalized-root/' } };
        for (const artifact of run.artifacts) artifact.location.uriBaseId = '%SERVER%'; location.uriBaseId = '%SERVER%';
        if (mode === 'same-base-alias') { run.originalUriBaseIds['%ALIAS%'] = { uri: 'file:///a/server-only/normalized-root/' }; location.uriBaseId = '%ALIAS%'; }
      }
      if (mode === 'URI-alias') location.uri = 'src/../src/a.ts';
      if (mode === 'encoded-URI') location.uri = 'src/%61.ts';
    }
    const before = canonical(f.current.server.runs[0].results), result = await publicOutcome(f);
    assert.equal(result.ready, true, mode); assert.equal(canonical(f.current.server.runs[0].results), before, 'reference validation never rewrites complete result objects');
  }
});

test('fresh M/B server source context refuses incomplete maps, typed reference defects and contradictory identities', async () => {
  const changes = [
    r => delete r.artifacts, r => r.artifacts = [], r => r.artifacts = null, r => r.artifacts = {},
    r => r.artifacts[0] = null, r => delete r.artifacts[0].location, r => r.artifacts[0].location = null,
    r => r.artifacts[0].location.uri = 42, r => r.artifacts[0].location.uri = 'src/different-source.ts',
    r => r.artifacts[0].location.index = 1, r => r.artifacts[0].location.index = '0',
    r => { r.artifacts[0].location = { index: 1 }; r.artifacts[1].location = { index: 0 }; },
    r => { r.artifacts[0].parentIndex = 1; r.artifacts[1].parentIndex = 0; },
    ...[null, [], 42].map(value => r => r.originalUriBaseIds = value),
    r => r.artifacts[0].location.uriBaseId = '%MISSING%',
    r => { r.artifacts[0].location.uriBaseId = '%A%'; r.originalUriBaseIds = { '%A%': { uri: '', uriBaseId: '%B%' }, '%B%': { uri: '', uriBaseId: '%A%' } }; },
    r => { r.artifacts[0].location.uriBaseId = '%A%'; r.originalUriBaseIds = { '%A%': { uri: 42 } }; },
    r => { r.artifacts[0].location.uriBaseId = '%A%'; r.originalUriBaseIds = { '%A%': { uri: 'file:///normalized/server/' } }; },
    r => { r.artifacts[0].location.uriBaseId = '%A%'; r.results[0].locations[0].physicalLocation.artifactLocation.uriBaseId = '%B%'; r.originalUriBaseIds = { '%A%': {}, '%B%': {} }; },
  ];
  for (const role of ['current', 'baseline']) for (const change of changes) { const f = proofFixture(); change(f[role].server.runs[0]); await assert.rejects(fixtureSnapshot(f), /server.*source|server.*artifact|server.*URI|indexed server/); }
  for (const [field, value] of [['index', -2], ['index', 999999], ['index', '0'], ['index', 0.5], ['index', null], ['uri', 42], ['uri', null], ['uriBaseId', 42], ['uriBaseId', '%MISSING%']]) {
    const f = proofFixture(); for (const role of ['current', 'baseline']) f[role].server.runs[0].results[0].locations[0].physicalLocation.artifactLocation[field] = value;
    assert.equal(canonical(f.current.server.runs[0].results), canonical(f.baseline.server.runs[0].results), 'malformed paired references cannot be hidden by multiset equality');
    await assert.rejects(fixtureSnapshot(f), /server.*source|server.*artifact|server.*URI/);
  }
});

test('server related/flow/frame/fix source references use the same validation while property bags stay opaque', async () => {
  const makeRelated = () => ({ physicalLocation: { artifactLocation: { uri: 'src/a.ts', index: 0 } } });
  const addReferences = run => { const result = run.results[0]; result.relatedLocations = [makeRelated()]; result.codeFlows = [{ threadFlows: [{ locations: [{ location: makeRelated() }] }] }]; result.stacks = [{ frames: [{ location: makeRelated() }] }]; result.fixes = [{ description: { text: 'change' }, artifactChanges: [{ artifactLocation: { index: 0 }, replacements: [{ deletedRegion: { startLine: 1 }, insertedContent: { text: '' } }] }] }]; result.properties.artifactLocation = { uri: 42, index: 'opaque user data' }; };
  const valid = proofFixture(); for (const role of ['current', 'baseline']) addReferences(valid[role].server.runs[0]); assert.equal((await publicOutcome(valid)).ready, true);
  for (const kind of ['related', 'flow', 'frame', 'fix']) {
    const f = proofFixture(); for (const role of ['current', 'baseline']) {
      const run = f[role].server.runs[0]; addReferences(run); const result = run.results[0];
      const location = kind === 'related' ? result.relatedLocations[0].physicalLocation.artifactLocation : kind === 'flow' ? result.codeFlows[0].threadFlows[0].locations[0].location.physicalLocation.artifactLocation : kind === 'frame' ? result.stacks[0].frames[0].location.physicalLocation.artifactLocation : result.fixes[0].artifactChanges[0].artifactLocation;
      location.index = 999999;
    }
    await assert.rejects(fixtureSnapshot(f), /server source artifact index/);
  }
});

test('server complete zero/removal and observed cached/final source objects retain independent source validation', async () => {
  for (const baselineZero of [false, true]) {
    const f = proofFixture(); for (const role of baselineZero ? ['current', 'baseline'] : ['current']) { f[role].report.runs[0].results = []; f[role].server.runs[0].results = []; delete f[role].server.runs[0].artifacts; sealRole(f[role]); }
    const result = await publicOutcome(f); assert.equal(result.ready, true); assert.equal(result.qualification.findings.nativeResults, 0); assert.equal(result.qualification.findings.serverResults, 0);
    f.current.server.runs[0].originalUriBaseIds = null; await assert.rejects(fixtureSnapshot(f), /malformed server source URI base map/);
  }
  for (const role of ['current', 'baseline']) for (const phase of ['cache', 'final']) {
    const f = proofFixture(), cache = new Map();
    const corruptObserved = () => { for (const value of cache.values()) if (value?.sourceSha === f[role].sourceSha && value.server) delete value.server.runs[0].artifacts; };
    if (phase === 'cache') { assert.equal((await publicOutcome(f, cache)).ready, true); corruptObserved(); }
    else { const original = f.request; let reads = 0; f.request = async (path, options) => { if (path.includes(`/actions/runs/${f[role].run.id}/artifacts?`) && ++reads === 2) corruptObserved(); return original(path, options); }; }
    // The pinned raw-body/object custody record can now reject this observed
    // cache corruption before rerunning the source-reference parser.
    await assert.rejects(publicOutcome(f, cache), /server source artifact index|immutable producer authority identity conflicts|server source raw-body\/object identity mismatch/);
  }
});

function processedFixture() {
  const fixture = proofFixture();
  for (const role of [fixture.current, fixture.baseline]) {
    const native = role.report.runs[0], result = native.results[0];
    result.partialFingerprints = { primaryLocationLineHash: 'stable-primary:1', nativeOnlyColumnFingerprint: '1' };
    result.locations[0].physicalLocation.region = { startLine: 1, startColumn: 1, endColumn: 3 };
    const related = line => ({ physicalLocation: { artifactLocation: { uri: 'scripts/b.mjs', uriBaseId: '%SRCROOT%', index: 1 }, region: { startLine: line, startColumn: 1, endColumn: 4 } } });
    result.relatedLocations = [{ ...related(2), id: 1, message: { text: 'source fact' } }, related(3)];
    const server = role.server.runs[0]; server.conversion = { tool: { driver: { name: 'GitHub Code Scanning' } } };
    server.results = [structuredClone(result)];
    delete server.results[0].partialFingerprints.nativeOnlyColumnFingerprint;
    for (const location of [...server.results[0].locations, ...server.results[0].relatedLocations]) {
      delete location.physicalLocation.artifactLocation.uriBaseId;
      location.physicalLocation.region.endLine = location.physicalLocation.region.startLine;
    }
    for (const location of server.results[0].relatedLocations) location.physicalLocation.artifactLocation.index = 0;
    server.results[0].relatedLocations[1].message = {};
    sealRole(role);
  }
  return fixture;
}

test('preinstall JSON parser preserves exact values and refuses duplicate decoded keys and precision loss', () => {
  for (const json of ['{"a":1,"a":2}', '{"a":1,"\\u0061":1}', '{"properties":{"x":1,"x":1}}', '{"n":9007199254740993}', '{"n":1.00000000000000001}', '{"n":0.10000000000000001}', '{"n":1e-999}', '{"n":1e999}', '{"n":1e1000000}', '{"x":"bad\nstring"}', '{"x":truefalse}', '['.repeat(129) + '0' + ']'.repeat(129)]) assert.throws(() => proofJson(json), /Source proof|JSON/);
  const value = proofJson('{"n":-0,"fraction":0.1,"sameNumber":1.00e1,"ordered":[1,"1",null,true],"__proto__":{"safe":true}}');
  assert.ok(Object.is(value.n, -0)); assert.equal(value.fraction, 0.1); assert.equal(value.sameNumber, 10);
  assert.deepEqual(value.ordered, [1, '1', null, true]); assert.equal(Object.hasOwn(value, '__proto__'), true); assert.equal({}.safe, undefined);
  assert.notEqual(canonical(value), canonical({ ...value, n: 0 }));
});

test('HTTP and native-member boundaries reject duplicate/precision JSON before authority or schema selection', async () => {
  for (const body of ['{"id":1,"id":2}', '{"id":1,"\\u0069d":1}', '{"value":1.00000000000000001}', '{"value":1e-999}']) {
    const request = githubReader({ token: 'fixture-only', fetchImpl: async () => new Response(body, { status: 200, headers: { 'content-length': String(Buffer.byteLength(body)) } }) });
    await assert.rejects(request('repos/example/project/commits/current'), /duplicate JSON|precision loss|underflow/);
    assert.throws(() => nativeZip(makeZip(body)), /duplicate JSON|precision loss|underflow/);
  }
});

test('frozen full official schema enforces every used constraint family without default insertion', () => {
  assert.equal(sarifSchemaIdentity.originalSha256, 'ad6db49878699b091f3eeb765b6e29e92a34bad4da88664d000c923b549c3a25');
  assert.equal(sarifSchemaIdentity.embeddedCanonicalSha256, 'a3e9206f3b254983aef5cc42621e583c1e023898c86383f63f6207e5f538c655');
  const valid = nativeRole(sha, 20).report, before = canonical(valid); validateSarifSchema(valid); assert.equal(canonical(valid), before);
  const changes = [
    report => delete report.version, report => report.version = '2.2.0', report => report.runs[0].results[0].fixes = [{ description: { text: 'change' }, artifactChanges: [] }], report => report.runs[0].results = {},
    report => report.runs[0].results[0].message = {}, report => report.runs[0].results[0].level = 'unknown',
    report => report.runs[0].results[0].rank = 101, report => report.runs[0].results[0].rank = -2,
    report => report.runs[0].results[0].guid = 'not-a-guid', report => report.runs[0].tool.driver.informationUri = 'bad uri',
    report => report.runs[0].artifacts[0].location.uri = 'bad%xy', report => report.runs[0].invocations[0].startTimeUtc = '2026-02-30T00:00:00Z',
    report => report.runs[0].results[0].graphTraversals = [{ runGraphIndex: 0, resultGraphIndex: 0 }],
    report => report.runs[0].tool.extensions[0].rules.push(structuredClone(report.runs[0].tool.extensions[0].rules[0])),
    report => Object.defineProperty(report, '__proto__', { value: {}, enumerable: true }), report => report.constructor = 'unknown root property',
  ];
  for (const change of changes) { const report = structuredClone(valid); change(report); assert.throws(() => validateSarifSchema(report), /SARIF2.1 schema invalid/); }
  const duplicateResults = structuredClone(valid); duplicateResults.runs[0].results.push(structuredClone(duplicateResults.runs[0].results[0])); validateSarifSchema(duplicateResults);
});

test('approved processed export keeps original objects and honest anomaly/source/class/multiplicity receipts', async () => {
  const f = processedFixture(), before = canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]);
  for (const role of [f.current, f.baseline]) assert.throws(() => validateNativeRole(role, role.sourceSha, { processedExport: false }), /schema invalid|server source/);
  const result = await publicOutcome(f);
  assert.equal(result.ready, true); assert.equal(result.qualification.label, serverExportProfile.label);
  assert.equal(result.prerequisites.find(item => item.name === 'CodeQL').state, 'missing');
  for (const [name, role] of [['current', f.current], ['baseline', f.baseline]]) {
    const receipt = result.qualification.findings.serverExports[name];
    assert.equal(receipt.serverFormat, serverExportProfile.format); assert.equal(receipt.sarifStandardConformance, false);
    assert.equal(receipt.anomalies.filter(item => item.kind === 'NONCONFORMING_RELATED_INDEX_ZERO').length, 2);
    assert.equal(receipt.anomalies.filter(item => item.kind === 'NONCONFORMING_EMPTY_RELATED_MESSAGE').length, 1);
    assert.equal(receipt.sourceSha, role.sourceSha); assert.equal(receipt.serverBodySha256, digest(role.serverBytes));
    assert.equal(receipt.workflow.id, role.run.id); assert.equal(receipt.job.id, role.job.id); assert.equal(receipt.artifact.id, role.artifact.id);
    assert.deepEqual(receipt.classes[0].nativeOccurrences, [0]); assert.equal(receipt.classes[0].serverOccurrences, 1);
    assert.equal(receipt.classes[0].related.length, 2); assert.deepEqual(receipt.classes[0].related[1].serverOriginal.message, {});
  }
  assert.deepEqual(result.qualification.findings.fences.main, { ref: 'refs/heads/main', objectType: 'commit', before: sha, after: sha });
  assert.equal(canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]), before);
  assert.match(readinessSummary({ ...result, outcome: 'ready' }), /not SARIF-standard-valid/);
});

test('full processed source gate refuses both-role malformed references/messages/identity and prototype limitations', async () => {
  const changes = [
    r => r.server.runs[0].results[0].relatedLocations[0].physicalLocation.artifactLocation.index = 1.5,
    ...[null, true, '0', -2, 999999, -0].map(index => r => r.server.runs[0].results[0].relatedLocations[0].physicalLocation.artifactLocation.index = index),
    r => r.server.runs[0].results[0].relatedLocations[0].physicalLocation.artifactLocation.index = 2,
    r => delete r.server.runs[0].results[0].relatedLocations[0].physicalLocation.artifactLocation.uri,
    r => r.server.runs[0].results[0].relatedLocations[0].physicalLocation.artifactLocation.uri = 'src/a.ts',
    r => r.server.runs[0].results[0].relatedLocations[0].physicalLocation.artifactLocation.uriBaseId = '%MISSING%',
    r => r.server.runs[0].results[0].relatedLocations[0].physicalLocation.region.startLine = 7,
    r => r.server.runs[0].results[0].relatedLocations[0].message = {},
    r => r.server.runs[0].results[0].relatedLocations[0].message.text = 'changed',
    r => r.server.runs[0].results[0].relatedLocations[0].id = 2,
    r => r.server.runs[0].results[0].relatedLocations.reverse(),
    r => r.server.runs[0].results[0].relatedLocations.pop(),
    r => r.server.runs[0].results[0].relatedLocations.push(structuredClone(r.server.runs[0].results[0].relatedLocations[0])),
    r => r.server.runs[0].results[0].relatedLocations[0].logicalLocations = [],
    r => r.server.runs[0].results[0].locations[0].message = {},
    r => r.server.runs[0].results[0].partialFingerprints.extra = 'unmatched',
    r => r.server.runs[0].results[0].partialFingerprints = {},
    r => r.server.runs[0].tool.extensions[0].semanticVersion = 'other',
    r => r.server.runs[0].results[0].ruleId = 'other',
    r => r.server.runs[0].conversion.tool.driver.name = 'Other',
    r => r.report.runs[0].versionControlProvenance = [{ repositoryUri: `https://github.com/${sourcePolicy.repository}`, revisionId: 'f'.repeat(40) }],
    r => r.report.runs[0].results[0].locations[0].message = {},
    r => r.report.runs[0].invocations[0].toolExecutionNotifications = r.report.runs[0].invocations[0].toolExecutionNotifications.filter(n => n.descriptor.id !== 'js/diagnostics/successfully-extracted-files' || n.locations[0].physicalLocation.artifactLocation.uri !== 'scripts/b.mjs'),
  ];
  for (const role of ['current', 'baseline']) for (const change of changes) {
    const f = processedFixture(); change(f[role]); sealRole(f[role]); await assert.rejects(publicOutcome(f), /Source proof/);
  }
});

test('processed correspondence groups identical occurrences without choosing among distinct full objects', async () => {
  for (const kind of ['identical', 'native-ambiguous', 'server-ambiguous', 'extra-server']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      if (kind !== 'extra-server') role.report.runs[0].results.push(structuredClone(role.report.runs[0].results[0]));
      role.server.runs[0].results.push(structuredClone(role.server.runs[0].results[0]));
      if (kind === 'native-ambiguous') role.report.runs[0].results[1].properties.newNativeFact = true;
      if (kind === 'server-ambiguous') role.server.runs[0].results[1].properties.newServerFact = true;
      sealRole(role);
    }
    if (kind === 'identical') { const result = await publicOutcome(f); assert.equal(result.ready, true); assert.equal(result.qualification.findings.serverExports.current.classes[0].serverOccurrences, 2); }
    else await assert.rejects(publicOutcome(f), /ambiguous|multiplicity|count/);
  }
});

test('processed zero/removal and true all-indexes-removed representations retain every other positive proof', async () => {
  const stripIndexes = value => { if (Array.isArray(value)) for (const item of value) stripIndexes(item); else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { if (key === 'properties') continue; if (key === 'artifactLocation') delete item.index; else stripIndexes(item); } };
  for (const kind of ['no-index-map-absent', 'index-only-primary', 'remove-all-M', 'both-zero', 'valid-strict-corrected']) {
    const f = processedFixture();
    if (kind === 'no-index-map-absent') for (const role of [f.current, f.baseline]) { stripIndexes(role.server.runs[0].results); delete role.server.runs[0].artifacts; }
    if (kind === 'index-only-primary') for (const role of [f.current, f.baseline]) for (const location of role.server.runs[0].results[0].locations) delete location.physicalLocation.artifactLocation.uri;
    if (kind === 'remove-all-M' || kind === 'both-zero') for (const role of kind === 'both-zero' ? [f.current, f.baseline] : [f.current]) { role.report.runs[0].results = []; role.server.runs[0].results = []; delete role.server.runs[0].artifacts; sealRole(role); }
    if (kind === 'valid-strict-corrected') for (const role of [f.current, f.baseline]) for (const location of role.server.runs[0].results[0].relatedLocations) { location.physicalLocation.artifactLocation.index = 1; if (Object.keys(location.message ?? {}).length === 0) delete location.message; }
    const before = canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]);
    const result = await publicOutcome(f); assert.equal(result.ready, true);
    if (kind === 'both-zero' || kind === 'valid-strict-corrected') assert.equal(result.qualification.label, 'qualified-source-equivalence');
    assert.equal(canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]), before);
  }
});

test('original complete server/native objects still veto every profile-bound modification or excess duplicate', async () => {
  const mutations = [
    r => r.server.runs[0].results[0].properties.typed = '1',
    r => r.server.runs[0].results[0].properties.ordered.reverse(),
    r => r.server.runs[0].results[0].properties.typed = -0,
    r => r.server.runs[0].results[0].properties.extra = false,
    r => r.report.runs[0].results[0].properties.newCompleteField = true,
  ];
  for (const change of mutations) { const f = processedFixture(); change(f.current); sealRole(f.current); await assert.rejects(publicOutcome(f), /finding/); }
});

test('initial/final/cache retain original processed body custody and latest source selection', async () => {
  for (const role of ['current', 'baseline']) for (const phase of ['cache', 'final']) {
    const f = processedFixture(), cache = new Map();
    const corrupt = () => { for (const value of cache.values()) if (value?.sourceSha === f[role].sourceSha && value.server) { value.server.runs[0].results[0].relatedLocations[0].message.text = 'changed'; value.serverBytes = Buffer.from(canonical(value.server)); } };
    if (phase === 'cache') { assert.equal((await publicOutcome(f, cache)).ready, true); corrupt(); }
    else { const original = f.request; let reads = 0; f.request = async (path, options) => { if (path.includes(`/actions/runs/${f[role].run.id}/artifacts?`) && ++reads === 2) corrupt(); return original(path, options); }; }
    await assert.rejects(publicOutcome(f, cache), /immutable producer|processed export|server source/);
  }
});

test('all supplied rule/component selectors must resolve coherently before whole-object or profile matching', async () => {
  const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
  const changes = [
    run => run.results[0].rule.toolComponent.name = 'OtherComponent',
    run => run.results[0].rule.guid = a,
    run => { run.tool.extensions[0].guid = a; run.results[0].rule.toolComponent.guid = b; },
    run => { run.tool.extensions[0].rules[0].guid = a; run.results[0].rule.guid = b; },
    run => run.results[0].ruleIndex = 0,
    run => run.results[0].rule.toolComponent.index = 999,
    run => run.results[0].rule.toolComponent.guid = a,
    run => { delete run.results[0].rule.id; delete run.results[0].rule.index; },
    run => { run.tool.driver.rules = [structuredClone(run.tool.extensions[0].rules[0])]; delete run.results[0].rule; },
  ];
  for (const side of ['report', 'server']) for (const change of changes) {
    const f = processedFixture();
    // Mutate both roles equally so an unrelated M/B object difference cannot
    // hide failure to validate the explicit local reference identity.
    for (const role of [f.current, f.baseline]) { change(role[side].runs[0]); sealRole(role); }
    await assert.rejects(publicOutcome(f), /Source proof/);
  }
  for (const field of ['notification', 'metric']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      const run = role.report.runs[0], ref = field === 'notification' ? run.invocations[0].toolExecutionNotifications[0].descriptor : run.properties.metricResults[0].rule;
      ref.toolComponent = { ...(ref.toolComponent ?? { index: -1 }), name: 'OtherComponent' }; sealRole(role);
    }
    await assert.rejects(publicOutcome(f), /Source proof/);
  }
  for (const field of ['engine', 'component', 'result']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      if (field === 'engine') { role.report.runs[0].tool.driver.guid = a; role.server.runs[0].tool.driver.guid = b; }
      if (field === 'component') { role.report.runs[0].tool.extensions[0].guid = a; role.server.runs[0].tool.extensions[0].guid = b; }
      if (field === 'result') { role.report.runs[0].results[0].guid = a; role.server.runs[0].results[0].guid = b; }
      sealRole(role);
    }
    await assert.rejects(publicOutcome(f), /correspondence/);
  }
});

test('matching driver/extensions index-name-GUID and legacy/result-reference forms preserve valid identity controls', async () => {
  const componentGuid = '00000000-0000-4000-8000-000000000001', ruleGuid = '00000000-0000-4000-8000-000000000002';
  for (const kind of ['matching-all-selectors', 'name-guid-without-index', 'index-without-reference-id', 'ruleId-only-unique', 'driver-and-legacy-coherent']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      for (const run of [role.report.runs[0], role.server.runs[0]]) {
        const component = run.tool.extensions[0], result = run.results[0];
        if (kind === 'matching-all-selectors' || kind === 'name-guid-without-index') {
          component.guid = componentGuid; component.rules[0].guid = ruleGuid;
          result.rule = { id: result.ruleId, guid: ruleGuid, index: 0, toolComponent: { index: 0, name: component.name, guid: componentGuid } };
          if (kind === 'name-guid-without-index') { delete result.rule.index; delete result.rule.toolComponent.index; }
        }
        if (kind === 'index-without-reference-id') delete result.rule.id;
        if (kind === 'ruleId-only-unique') delete result.rule;
        if (kind === 'driver-and-legacy-coherent') {
          run.tool.driver.rules = [structuredClone(component.rules[0])]; run.tool.driver.guid = componentGuid; run.tool.driver.rules[0].guid = ruleGuid;
          result.ruleIndex = 0; result.rule = { id: result.ruleId, index: 0, guid: ruleGuid, toolComponent: { name: run.tool.driver.name, guid: componentGuid } };
        }
      }
      sealRole(role);
    }
    assert.equal((await publicOutcome(f)).ready, true, kind);
  }
});

test('complete receipt tables keep large shared metadata and every ordered duplicate occurrence bounded', async () => {
  for (const separateGuids of [false, true]) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      for (const run of [role.report.runs[0], role.server.runs[0]]) {
        run.tool.extensions[0].rules[0].help = { text: 'h'.repeat(100_000) };
        run.results = Array.from({ length: 30 }, (_, index) => ({ ...structuredClone(run.results[0]), ...(separateGuids ? { guid: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` } : {}) }));
      }
      sealRole(role);
    }
    const result = await publicOutcome(f); assert.equal(result.ready, true);
    for (const exported of Object.values(result.qualification.findings.serverExports)) {
      assert.equal(exported.bindings.length, 30); assert.equal(exported.ruleIdentities.length, 1);
      assert.equal(exported.componentIdentities.length, 1); assert.equal(exported.engineIdentities.length, 1);
      assert.equal(exported.classes.reduce((sum, item) => sum + item.nativeOccurrences.length, 0), 30);
      assert.equal(exported.classes.reduce((sum, item) => sum + item.serverOccurrenceIndices.length, 0), 30);
      assert.ok(Buffer.byteLength(canonical(exported)) <= proofLimits.metadata);
      for (const binding of exported.bindings) assert.equal(exported.classes.find(item => item.nativeFullObjectSha256 === binding.nativeCandidateClass).serverOccurrenceIndices.includes(binding.serverOccurrence), true);
    }
    assert.equal(result.qualification.findings.nativeResults, 30); assert.equal(result.qualification.findings.serverResults, 30);
  }
});

test('complete readiness receipt writes preserve types, negative zero, multiplicities and all proof fields', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'cortex-receipt-'));
  try {
    const path = resolve(directory, 'receipt.json'), result = { ready: true, checksRun: 10, qualification: { findings: { values: [-0, 0, '0', null, false], duplicates: [{ a: 1 }, { a: 1 }], nested: [[2, 1]], propertyBag: { constructor: 'retained' } } }, prerequisites: [{ name: 'missing', id: undefined }] };
    const receipt = writeReadinessReceipt(result, { path });
    const bytes = readFileSync(path), parsed = proofJson(bytes.toString());
    assert.equal(digest(bytes), receipt.sha256); assert.equal(bytes.length, receipt.bytes);
    assert.equal(receipt.payloadSha256, digest(readinessPayload(result)));
    assert.equal(Object.is(parsed.payload.qualification.findings.values[0], -0), true);
    assert.deepEqual(parsed.payload.qualification.findings.duplicates, [{ a: 1 }, { a: 1 }]);
    assert.deepEqual(parsed.payload.qualification.findings.nested, [[2, 1]]);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(writeReadinessReceipt(result, { path: resolve(directory, 'matched.json'), expectedReceiptPath: path, expectedReceiptSha256: digest(readFileSync(path)) }).fence.matched, true);
    for (const mutate of [
      r => r.qualification.findings.values[0] = 0,
      r => r.qualification.findings.duplicates.pop(),
      r => r.qualification.findings.nested[0].reverse(),
      r => r.qualification.findings.propertyBag.newValue = true,
      r => r.checksRun = 11,
    ]) {
      const changed = structuredClone(result); mutate(changed);
      const actual = writeReadinessReceipt(changed, { path: resolve(directory, `changed-${Math.random()}.json`), expectedReceiptPath: path, expectedReceiptSha256: digest(readFileSync(path)) });
      assert.equal(actual.fence.matched, false);
    }
    assert.throws(() => writeReadinessReceipt(result, { path: resolve(directory, 'wrong-sha.json'), expectedReceiptPath: path, expectedReceiptSha256: '0'.repeat(64) }), /digest/);
    assert.throws(() => writeReadinessReceipt(result, { path: resolve(directory, 'missing-sha.json'), expectedReceiptPath: path }), /digest/);
    assert.throws(() => writeReadinessReceipt(result, { path }), /EEXIST/);
    assert.equal(readFileSync(path).equals(bytes), true);
    assert.throws(() => readinessPayload({ qualification: { findings: { lost: undefined } } }), /non-JSON/);
    assert.throws(() => readinessPayload({ qualification: { findings: new Map([['lost', true]]) } }), /Unsupported/);
    assert.throws(() => readinessPayload({ qualification: { findings: Array(2) } }), /Unsupported/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('receipt paths refuse aliases, symlinks, hardlinks, existing targets and oversize output', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'cortex-receipt-path-'));
  try {
    const result = { ready: true }, path = resolve(directory, 'original.json');
    writeReadinessReceipt(result, { path });
    symlinkSync(path, resolve(directory, 'alias.json')); linkSync(path, resolve(directory, 'hardlink.json'));
    mkdirSync(resolve(directory, 'real')); symlinkSync(resolve(directory, 'real'), resolve(directory, 'alias-dir'));
    for (const destination of ['relative.json', `${directory}/../unsafe.json`, resolve(directory, 'alias.json'), resolve(directory, 'alias-dir/receipt.json'), resolve(directory, 'hardlink.json')]) assert.throws(() => writeReadinessReceipt(result, { path: destination }));
    for (const source of [path, resolve(directory, 'alias.json'), resolve(directory, 'hardlink.json')]) assert.throws(() => writeReadinessReceipt(result, { path: resolve(directory, 'new.json'), expectedReceiptPath: source, expectedReceiptSha256: digest(readFileSync(source)) }));
    assert.throws(() => writeReadinessReceipt({ ready: true, qualification: { findings: { oversized: 'a'.repeat(proofLimits.log) } } }, { path: resolve(directory, 'oversized.json') }), /bound/);
    assert.equal(existsSync(resolve(directory, 'oversized.json')), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('receipt file-descriptor custody refuses a real directory swap and an incomplete write', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'cortex-receipt-race-'));
  try {
    for (const mode of ['swap', 'partial', 'sync-failure', 'readback-change']) {
      const root = resolve(directory, mode); mkdirSync(root); mkdirSync(resolve(root, 'destination')); mkdirSync(resolve(root, 'outside'));
      const writer = new URL('../scripts/release-readiness.mjs', import.meta.url).href;
      const code = `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
        const root=${JSON.stringify(root)},mode=${JSON.stringify(mode)};let changed=false;
        const open=fs.openSync,write=fs.writeFileSync,sync=fs.fsyncSync,read=fs.readFileSync;
        fs.openSync=(path,...args)=>{if(mode==='swap'&&!changed&&String(path).includes('/.readiness-')){changed=true;fs.renameSync(root+'/destination',root+'/held');fs.symlinkSync(root+'/outside',root+'/destination');}return open(path,...args);};
        fs.writeFileSync=(fd,bytes,...args)=>{if(mode==='partial'&&typeof fd==='number')return write(fd,bytes.subarray(0,5),...args);return write(fd,bytes,...args);};
        fs.fsyncSync=fd=>{if(mode==='sync-failure')throw new Error('injected actual fsync failure');return sync(fd);};
        fs.readFileSync=(fd,...args)=>{const bytes=read(fd,...args);return mode==='readback-change'&&typeof fd==='number'?Buffer.from('changed'):bytes;};
        syncBuiltinESMExports();const {writeReadinessReceipt}=await import(${JSON.stringify(writer)});
        let denied=false;try{writeReadinessReceipt({ready:true},{path:root+'/destination/receipt.json'});}catch{denied=true;}if(!denied)process.exit(7);if(fs.existsSync(root+'/outside/receipt.json'))process.exit(8);`;
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
      assert.equal(run.status, 0, `${mode}: ${run.stderr}`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('workflow retains gate and final proof and binds a complete fresh veto before publication', () => {
  const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
  assert.match(workflow, /ready: \$\{\{ steps\.receipt\.outcome == 'success' && steps\.check\.outputs\.ready == 'true'/);
  for (const stage of ['gate', 'final', 'prepublish']) {
    assert.match(workflow, new RegExp(`name: publishing-readiness-${stage}-\\$\\{\\{ github.run_id \\}\\}-\\$\\{\\{ github.run_attempt \\}\\}`));
    assert.match(workflow, new RegExp(`path: \\$\\{\\{ runner.temp \\}\\}/publishing-readiness-${stage}\\.json\\n +if-no-files-found: error`));
  }
  const release = workflow.slice(workflow.indexOf('      - name: Qualify complete final readiness'));
  assert.ok(release.indexOf('Retain complete final readiness') < release.indexOf('node scripts/publish-release.mjs'));
  assert.match(release, /node scripts\/release-readiness\.mjs --once\n +node scripts\/publish-release\.mjs/);
  assert.match(release, /EXPECTED_READINESS_RECEIPT: \$\{\{ runner.temp \}\}\/publishing-readiness-final.json/);
  assert.match(release, /if: always\(\) && steps\.publish\.outcome != 'skipped'/);
  assert.match(release, /EXPECTED_READINESS_RECEIPT_SHA256: \$\{\{ steps\.final-readiness\.outputs\.receipt_sha256 \}\}/);
  assert.equal((workflow.match(/uses: actions\/upload-artifact@v4/g) ?? []).length, 3);
});


test('complete publication receipt fences retain same-ID workflow attempts and every validated semantic authority fact', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'cortex-authority-fence-'));
  try {
    const f = processedFixture();
    const collect = () => reconcileReadiness({ eventName: 'workflow_dispatch', event: { inputs: { source_sha: sha, mode: 'recover' } }, ref: 'refs/heads/main', repository: sourcePolicy.repository, sourceSha: sha, getSnapshot: () => readDeliverySnapshot({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha }), wait: async () => {}, maxAttempts: 1 });
    const before = await collect(); assert.equal(before.ready, true);
    assert.ok(before.authorityObservations.records.some(item => item.identity.includes('workflow-attempt:')));
    const first = writeReadinessReceipt(before, { path: resolve(directory, 'before.json') });
    const unchanged = await collect(); assert.equal(readinessPayload(unchanged), readinessPayload(before));
    assert.equal(writeReadinessReceipt(unchanged, { path: resolve(directory, 'unchanged.json'), expectedReceiptPath: first.path, expectedReceiptSha256: first.sha256 }).fence.matched, true);
    f.ownRuns[1].run_attempt++;
    const after = await collect(); assert.equal(after.ready, true); assert.equal(after.securityRun, before.securityRun);
    assert.notEqual(canonical(after.authorityObservations), canonical(before.authorityObservations));
    assert.equal(writeReadinessReceipt(after, { path: resolve(directory, 'new-attempt.json'), expectedReceiptPath: first.path, expectedReceiptSha256: first.sha256 }).fence.matched, false);
    f.ownRuns[1].run_attempt--;
    f.headChecks[0].started_at = '2026-11-02T07:50:00Z';
    const newTimestamp = await collect(); assert.equal(newTimestamp.ready, true);
    assert.equal(writeReadinessReceipt(newTimestamp, { path: resolve(directory, 'new-authority-time.json'), expectedReceiptPath: first.path, expectedReceiptSha256: first.sha256 }).fence.matched, false);
    delete f.headChecks[0].started_at;
    assert.equal(readinessPayload(await collect()), readinessPayload(before));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

function strictSourceFixture() {
  const f = processedFixture();
  for (const role of [f.current, f.baseline]) for (const result of role.server.runs[0].results) for (const location of result.relatedLocations ?? []) {
    const ref = location.physicalLocation.artifactLocation;
    ref.index = role.server.runs[0].artifacts.findIndex(artifact => artifact.location.uri === ref.uri);
    if (Object.hasOwn(location, 'message') && Object.keys(location.message).length === 0) delete location.message;
  }
  return f;
}

test('all typed native references and inventory parents refuse unused malformed claims in both roles', async () => {
  const changes = [
    r => r.artifacts[0].parentIndex = 99999,
    r => r.artifacts[0].parentIndex = 0,
    r => { r.artifacts[0].parentIndex = 1; r.artifacts[1].parentIndex = 0; },
    r => r.artifacts[0].location.index = -1,
    r => r.artifacts.push({ roles: ['directory'], location: { uri: producingRoot, index: -1 } }),
    r => r.invocations[0].workingDirectory = { index: 99999 },
    r => r.invocations[0].workingDirectory = { uri: 'source', uriBaseId: '%UNKNOWN%' },
    ...['executableLocation', 'stdin', 'stdout', 'stderr', 'stdoutStderr'].map(key => r => r.invocations[0][key] = { index: 99999 }),
    r => r.invocations[0].responseFiles = [{ index: 99999 }],
    r => r.graphs = [{ nodes: [{ id: 'unused', children: [{ id: 'child', location: { physicalLocation: { artifactLocation: { index: 99999 } } } }] }], edges: [] }],
    r => r.tool.driver.locations = [{ uri: 'file:///opt/codeql/codeql', index: 99999 }],
    r => r.logicalLocations = [{ name: 'a', parentIndex: 1 }, { name: 'b', parentIndex: 0 }],
    r => r.threadFlowLocations = [{ index: 99999 }],
    r => r.addresses = [{ parentIndex: 0 }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], mappedTo: {} }],
    (r, role) => r.versionControlProvenance = [{ ...exactNativeVcs(role)[0], mappedTo: { index: -1 } }],
  ];
  for (const name of ['current', 'baseline']) for (const change of changes) {
    const f = processedFixture(); change(f[name].report.runs[0], f[name]); sealRole(f[name]);
    await assert.rejects(publicOutcome(f), /native|source .*index|source .*cache slot|cyclic source/);
  }
});

test('typed metadata directories executables streams privacy and nested containers preserve complete source coverage', async () => {
  for (const kind of ['directory', 'executable', 'stream', 'private-stream', 'tool', 'nested', 'cached-source-location', 'opaque']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      const run = role.report.runs[0], slot = run.artifacts.length;
      if (kind === 'directory') { run.artifacts.push({ roles: ['directory'], location: { uri: producingRoot.slice(0, -1), index: slot } }); run.invocations[0].workingDirectory = { index: slot }; }
      if (kind === 'executable') run.invocations[0].executableLocation = { uri: 'file:///opt/codeql/codeql' };
      if (kind === 'stream') run.invocations[0].stdout = { uri: 'file:///tmp/codeql-output.log' };
      if (kind === 'private-stream') { run.originalUriBaseIds = { '%PRIVATE%': {} }; run.invocations[0].stdout = { uri: 'output.log', uriBaseId: '%PRIVATE%' }; }
      if (kind === 'tool') run.tool.driver.locations = [{ uri: 'file:///opt/codeql/codeql' }];
      if (kind === 'nested') run.artifacts.push({ roles: ['attachment'], location: { uri: 'file:///tmp/diagnostics.zip', index: slot } }, { roles: ['attachment'], parentIndex: slot, location: { uri: '/member.bin', index: slot + 1 } }, { roles: ['attachment'], parentIndex: slot + 1, offset: 2, length: 1 });
      if (kind === 'cached-source-location') {
        run.threadFlowLocations = [{ location: structuredClone(run.results[0].locations[0]) }];
        run.results[0].codeFlows = [{ threadFlows: [{ locations: [{ index: 0, kinds: [] }] }] }];
      }
      if (kind === 'opaque') run.properties.unrelated = { artifactLocation: { index: 99999 }, region: { startLine: 2, endLine: 1 }, parentIndex: 99999 };
      sealRole(role);
    }
    assert.equal((await publicOutcome(f)).ready, true, kind);
  }
});

const placeRegion = (run, kind, region) => {
  const result = run.results[0], location = structuredClone(result.locations[0]); location.physicalLocation.region = region;
  if (kind === 'primary') result.locations[0].physicalLocation.region = region;
  if (kind === 'related') result.relatedLocations[0].physicalLocation.region = region;
  if (kind === 'flow') result.codeFlows = [{ threadFlows: [{ locations: [{ location }] }] }];
  if (kind === 'stack') result.stacks = [{ message: { text: 'stack' }, frames: [{ location }] }];
  if (kind === 'graph') run.graphs = [{ nodes: [{ id: 'node', location }], edges: [] }];
  if (kind === 'context') result.locations[0].physicalLocation.contextRegion = region;
  if (kind === 'annotation') result.locations[0].annotations = [region];
  if (kind === 'attachment') result.attachments = [{ artifactLocation: structuredClone(location.physicalLocation.artifactLocation), regions: [region] }];
  if (kind === 'fix') result.fixes = [{ description: { text: 'fix' }, artifactChanges: [{ artifactLocation: structuredClone(location.physicalLocation.artifactLocation), replacements: [{ deletedRegion: region, insertedContent: { text: '' } }] }] }];
};

test('native and server typed spans are unconditional on normal-v3 and processed routes', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const representation of ['report', 'server']) for (const name of ['current', 'baseline']) for (const kind of ['primary', 'related', 'flow', 'stack', 'graph', 'context', 'annotation', 'attachment', 'fix']) {
    const f = fixture(); placeRegion(f[name][representation].runs[0], kind, { startLine: 2, startColumn: 9, endLine: 1, endColumn: 2 });
    if (representation === 'report') sealRole(f[name]);
    await assert.rejects(publicOutcome(f), /source region|typed region|context region|source .*region/, `${representation}/${name}/${kind}`);
  }
});

test('region defaults multiline columns zero offsets and complete-zero source validation preserve valid outcomes', async () => {
  for (const region of [{ startLine: 1 }, { startLine: 1, startColumn: 9, endLine: 2, endColumn: 1 }, { startLine: 1, startColumn: 2, endColumn: 2 }, { charOffset: 0, charLength: 0 }, { byteOffset: 0, byteLength: 0 }]) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) { for (const run of [role.report.runs[0], role.server.runs[0]]) placeRegion(run, 'related', structuredClone(region)); sealRole(role); }
    assert.equal((await publicOutcome(f)).ready, true, canonical(region));
  }
  for (const name of ['current', 'baseline']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) { role.report.runs[0].results = []; role.server.runs[0].results = []; sealRole(role); }
    f[name].report.runs[0].graphs = [{ nodes: [{ id: 'unused', location: { physicalLocation: { artifactLocation: structuredClone(f[name].report.runs[0].artifacts[0].location), region: { startLine: 2, endLine: 1 } } } }], edges: [] }]; sealRole(f[name]);
    await assert.rejects(publicOutcome(f), /source region/);
  }
});

function regionReport(region, text = 'abc\r\ndef\r\n', extras = {}) {
  return { version: '2.1.0', runs: [{ tool: { driver: { name: 'schema-semantic-test' } }, columnKind: 'utf16CodeUnits', artifacts: [{ location: { uri: 'source.txt' }, contents: { text, binary: Buffer.from(text).toString('base64') }, encoding: 'utf-8', ...extras }], results: [{ ruleId: 'r', message: { text: 'm' }, locations: [{ physicalLocation: { artifactLocation: { index: 0 }, region } }] }] }] };
}
const regionCheck = report => validateSarifSemantics(report, validateSarifSchema(report));
test('complete artifact evidence supports range consistency and EOF without using snippets or invented sizes', () => {
  for (const region of [{ startLine: 1 }, { startLine: 1, endLine: 2, endColumn: 1 }, { startLine: 2, startColumn: 6, endColumn: 6 }, { charOffset: 10, charLength: 0 }, { byteOffset: 10, byteLength: 0 }, { startLine: 1, startColumn: 2, endColumn: 3, charOffset: 1, charLength: 1, byteOffset: 1, byteLength: 1 }]) assert.doesNotThrow(() => regionCheck(regionReport(region)), canonical(region));
  for (const region of [{ startLine: 2, startColumn: 3, endColumn: 2 }, { endLine: 2 }, { charLength: 1 }, { byteLength: 1 }, { charOffset: 11 }, { byteOffset: 11 }, { startLine: 3 }, { startLine: 1, startColumn: 1, endColumn: 2, charOffset: 1, charLength: 1 }, { byteOffset: Number.MAX_SAFE_INTEGER, byteLength: 1 }]) assert.throws(() => regionCheck(regionReport(region)), /region|offset|range/);
  const snippet = regionReport({ startLine: 10000, snippet: { text: 'x' } }); delete snippet.runs[0].artifacts[0].contents; delete snippet.runs[0].artifacts[0].length;
  assert.doesNotThrow(() => regionCheck(snippet), 'a short snippet is not whole artifact size evidence');
  const noEncoding = regionReport({ charOffset: 0, charLength: 1, byteOffset: 0, byteLength: 1 }); delete noEncoding.runs[0].artifacts[0].encoding;
  assert.throws(() => regionCheck(noEncoding), /encoding evidence/);
  assert.throws(() => regionCheck(regionReport({ startLine: 1, startColumn: 1, endColumn: 2, charOffset: 0, charLength: 1 }, '\u{1F600}x')), /ambiguous/);
  const point = regionReport({ startLine: 1, startColumn: 2, endColumn: 3 }, '\u{1F600}x'); point.runs[0].columnKind = 'unicodeCodePoints'; assert.doesNotThrow(() => regionCheck(point));
});

test('RFC3986 formats use component grammar rather than WHATWG URL acceptance', () => {
  for (const value of ['https://example.com/%5B', 'urn:example:test', 'http://[2001:db8::1]/a', 'http://[v1.invalid]/', 'http://exa_mple.com:999999/', 'scheme:', 'https://', 'data:text/plain,a%FF', 'https://u:p@example.com/a?x=%5B#part']) assert.equal(isSarifUri(value, true), true, value);
  for (const value of ['https://example.com/[', 'https://example.com/]', 'https://example.com/a[b]', 'http://example.com:bad/', 'http://example.com/%', 'http://[::1%25zone]/', 'http://a@b@host/', '1bad:foo', 'http://example.com/a b', 'http://example.com/é']) assert.equal(isSarifUri(value, true), false, value);
  for (const value of ['', '../a', './a%5Bb', '/root', '//[::1]:80/path', '?q=a/b?c', '#fragment', 'a/b:c']) assert.equal(isSarifUri(value), true, value);
  for (const value of ['1bad:foo', 'a[b]', '//host:bad/a', '#a#b', 'a%2', '//[bad]/']) assert.equal(isSarifUri(value), false, value);
});

test('RFC3339 calendar uses factual IERS insertion dates and offsets without an ordinary future-date expiry', () => {
  for (const value of ['2024-02-29T00:00:00Z', '2000-02-29T23:59:59.123456789Z', '1990-12-31T23:59:60Z', '1990-12-31T15:59:60-08:00', '2005-12-31T23:59:60.5Z', '2017-01-01T00:59:60+01:00', '2016-12-31T23:59:60Z', '2999-12-31T23:59:59Z', '2026-01-01t00:00:00z']) assert.equal(isSarifDateTime(value), true, value);
  for (const value of ['2023-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01', '2026-01-01T12:00Z', '2015-12-31T23:59:60Z', '2026-12-31T23:59:60Z', '2999-12-31T23:59:60Z', '2016-12-31T22:59:60Z', '2016-12-31T23:59:60+01:00', '2026-01-01T00:00:00+24:00']) assert.equal(isSarifDateTime(value), false, value);
  const f = processedFixture(); f.current.report.runs[0].invocations[0].startTimeUtc = '2999-12-31T23:59:60Z';
  assert.throws(() => validateSarifSchema(f.current.report), /known factual leap-second/);
  for (const value of ['2000-02-29', '2026-01-01T12:00Z', '2026-01-01T24:00:00Z']) { const r = regionReport({ charOffset: 0 }); r.runs[0].tool.driver.releaseDateUtc = value; assert.doesNotThrow(() => regionCheck(r)); }
  const release = regionReport({ charOffset: 0 }); release.runs[0].tool.driver.releaseDateUtc = '2023-02-29'; assert.throws(() => regionCheck(release), /UTC calendar/);
});

test('invalid URI formats cannot qualify either full representation while escaped controls and opaque data stay supported', async () => {
  for (const representation of ['report', 'server']) for (const name of ['current', 'baseline']) {
    const f = processedFixture(); f[name][representation].runs[0].tool.driver.informationUri = 'https://example.com/[';
    if (representation === 'report') sealRole(f[name]);
    await assert.rejects(publicOutcome(f), /schema.*format/);
  }
  const f = processedFixture(); for (const role of [f.current, f.baseline]) { for (const run of [role.report.runs[0], role.server.runs[0]]) { run.tool.driver.informationUri = 'https://example.com/%5B'; run.properties.custom = { uri: 'https://example.com/[', startTimeUtc: 'not-a-timestamp' }; } sealRole(role); }
  assert.equal((await publicOutcome(f)).ready, true);
});

test('observed cache corruption refuses by immutable bytes while fresh malformed references refuse semantically', async () => {
  const f = processedFixture(), cache = new Map(), collect = () => readDeliverySnapshot({ request: f.request, repository: sourcePolicy.repository, sourceSha: sha, cache }); await collect();
  const entry = [...cache.values()].find(value => value?.report?.runs?.[0]?.properties?.jobRunUuid === f.current.report.runs[0].properties.jobRunUuid);
  assert.ok(entry); entry.report.runs[0].invocations[0].workingDirectory = { index: 99999 };
  await assert.rejects(collect(), /complete artifact member|immutable|identity|proven/);
  const bad = processedFixture(); bad.current.report.runs[0].invocations[0].workingDirectory = { index: 99999 }; sealRole(bad.current);
  await assert.rejects(publicOutcome(bad), /native artifact index.*range/);
});

test('actual installed receipt inode mode and owned link phases cannot be replaced by identical bytes', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'cortex-receipt-custody-'));
  try {
    for (const mode of ['same-bytes-0600', 'same-bytes-0644', 'chmod', 'extra-hardlink', 'foreign-temporary', 'stage-mode']) {
      const root = resolve(directory, mode); mkdirSync(root);
      const writer = new URL('../scripts/release-readiness.mjs', import.meta.url).href;
      const code = `import fs from 'node:fs';import{syncBuiltinESMExports}from'node:module';const root=${JSON.stringify(root)},mode=${JSON.stringify(mode)},link=fs.linkSync;let foreign,sourceForeign;
      fs.linkSync=(from,to)=>{if(mode==='foreign-temporary'){const b=fs.readFileSync(from);fs.unlinkSync(from);fs.writeFileSync(from,b,{mode:0o600});sourceForeign={path:fs.realpathSync(from),ino:fs.statSync(from).ino};}link(from,to);if(mode.startsWith('same-bytes')){const b=fs.readFileSync(to);fs.unlinkSync(to);fs.writeFileSync(to,b,{mode:mode.endsWith('0644')?0o644:0o600});foreign={ino:fs.statSync(to).ino,bytes:b.toString(),mode:fs.statSync(to).mode&0o777};}if(mode==='chmod'){fs.chmodSync(to,0o644);foreign={ino:fs.statSync(to).ino,bytes:fs.readFileSync(to,'utf8'),mode:0o644};}if(mode==='extra-hardlink')link(to,root+'/foreign-link');if(mode==='stage-mode')fs.fchmodSync(Number(String(from).match(/fd\\/(\\d+)/)[1]),0o755);};syncBuiltinESMExports();const{writeReadinessReceipt}=await import(${JSON.stringify(writer)});const before=fs.readdirSync('/proc/self/fd').length;let denied=false;try{writeReadinessReceipt({ready:true},{path:root+'/receipt.json'});}catch{denied=true;}if(!denied)process.exit(7);if(fs.readdirSync('/proc/self/fd').length!==before)process.exit(8);if(foreign){const actual=fs.statSync(root+'/receipt.json');if(actual.ino!==foreign.ino||(actual.mode&0o777)!==foreign.mode||fs.readFileSync(root+'/receipt.json','utf8')!==foreign.bytes)process.exit(9);}if(sourceForeign&&(!fs.existsSync(sourceForeign.path)||fs.statSync(sourceForeign.path).ino!==sourceForeign.ino))process.exit(10);`;
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
      assert.equal(run.status, 0, `${mode}: ${run.stderr}`);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

const nestedGraph = () => ({ nodes: [{ id: 'a', children: [{ id: 'b' }] }, { id: 'c' }], edges: [{ id: 'ab', sourceNodeId: 'a', targetNodeId: 'b' }, { id: 'ba', sourceNodeId: 'b', targetNodeId: 'a' }, { id: 'aa', sourceNodeId: 'a', targetNodeId: 'a' }] });
function pairedRepresentation(f, representation, change) {
  for (const role of [f.current, f.baseline]) { change(role[representation].runs[0], role); if (representation === 'report') sealRole(role); }
}
test('typed graph ownership resolves nested IDs and connected selected edges without banning valid cycles', async () => {
  const invalid = [
    r => r.results[0].graphTraversals = [{ runGraphIndex: 999999 }],
    r => r.results[0].graphTraversals = [{ resultGraphIndex: 999999 }],
    r => r.results[0].graphTraversals = [{}],
    r => r.results[0].graphTraversals = [{ runGraphIndex: 0, resultGraphIndex: 0 }],
    r => r.graphs[0].nodes[1].children = [{ id: 'b' }],
    r => r.graphs[0].edges[0].sourceNodeId = 'absent',
    r => r.graphs[0].edges.push({ id: 'ab', sourceNodeId: 'c', targetNodeId: 'a' }),
    r => { r.graphs.push({ nodes: [{ id: 'other' }], edges: [{ id: 'foreign', sourceNodeId: 'other', targetNodeId: 'other' }] }); r.results[0].graphTraversals = [{ runGraphIndex: 0, edgeTraversals: [{ edgeId: 'foreign' }] }]; },
    r => r.results[0].graphTraversals = [{ runGraphIndex: 0, edgeTraversals: [{ edgeId: 'ab' }, { edgeId: 'aa' }] }],
  ];
  for (const make of [proofFixture, processedFixture]) for (const representation of ['report', 'server']) {
    const valid = make(); pairedRepresentation(valid, representation, r => { r.graphs = [nestedGraph()]; r.results[0].graphs = [nestedGraph()]; r.results[0].graphTraversals = [{ runGraphIndex: 0, edgeTraversals: [{ edgeId: 'ab' }, { edgeId: 'ba' }, { edgeId: 'aa' }] }, { resultGraphIndex: 0 }]; });
    assert.equal((await publicOutcome(valid)).ready, true, representation);
    for (const change of invalid) {
      const f = make(); pairedRepresentation(f, representation, r => { r.graphs = [nestedGraph()]; r.results[0].graphs = [nestedGraph()]; change(r); });
      await assert.rejects(publicOutcome(f), /graph|traversal|node identity/);
    }
  }
});

test('typed provenance and both web cache families validate unavailable tables slots and every simultaneous fact', async () => {
  for (const representation of ['report', 'server']) {
    for (const kind of ['webRequest', 'webResponse']) {
      const table = kind === 'webRequest' ? 'webRequests' : 'webResponses';
      const setup = r => { r[table] = [{ protocol: 'intentionally-invalid-HTTP', body: { text: 'opaque body' }, ...(kind === 'webResponse' ? { noResponseReceived: false } : { method: 'GET' }) }]; r.threadFlowLocations = [{ [kind]: { index: 0 } }]; };
      const valid = processedFixture(); pairedRepresentation(valid, representation, setup); assert.equal((await publicOutcome(valid)).ready, true);
      for (const change of [r => r.threadFlowLocations[0][kind].index = 99999, r => r.threadFlowLocations[0][kind].index = -1, r => r[table][0].index = 1, r => r.threadFlowLocations[0][kind].protocol = 'conflicting', r => r.threadFlowLocations[0][kind].body = { text: 'other' }, r => delete r[table]]) {
        const f = processedFixture(); pairedRepresentation(f, representation, r => { setup(r); change(r); }); await assert.rejects(publicOutcome(f), /cache|index|override/);
      }
    }
    const bad = processedFixture(); pairedRepresentation(bad, representation, r => r.results[0].provenance = { invocationIndex: 999999 }); await assert.rejects(publicOutcome(bad), /invocation index/);
    const valid = processedFixture(); pairedRepresentation(valid, representation, r => { if (representation === 'server') r.invocations = [{ executionSuccessful: true }]; r.results[0].provenance = { invocationIndex: 0 }; }); assert.equal((await publicOutcome(valid)).ready, true);
    const absent = processedFixture(); pairedRepresentation(absent, representation, r => r.results[0].provenance = {}); assert.equal((await publicOutcome(absent)).ready, true, 'omission retains documented default without raw insertion');
  }
});

test('typed cached addresses location targets and thread IDs retain their actual owning identities', () => {
  const make = () => regionReport({ byteOffset: 0, byteLength: 1 });
  const valid = make(), run = valid.runs[0]; run.addresses = [{ absoluteAddress: 100, length: -10 }, { parentIndex: 0, offsetFromParent: 2, absoluteAddress: 102, relativeAddress: 2, length: -1 }]; run.results[0].locations[0].physicalLocation.address = { index: 1 };
  assert.doesNotThrow(() => regionCheck(valid));
  for (const change of [r => r.addresses[1].absoluteAddress = 103, r => r.addresses[1].relativeAddress = 3, r => delete r.addresses[1].offsetFromParent, r => r.results[0].locations[0].physicalLocation.address.length = 2]) { const f = structuredClone(valid); change(f.runs[0]); assert.throws(() => regionCheck(f), /address|override/); }
  const related = make(); related.runs[0].results[0].locations[0].id = 1; related.runs[0].results[0].relatedLocations = [{ id: 2, physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 0 } }, relationships: [{ target: 1 }] }]; assert.doesNotThrow(() => regionCheck(related));
  const missing = structuredClone(related); missing.runs[0].results[0].relatedLocations[0].relationships[0].target = 999; assert.throws(() => regionCheck(missing), /target/);
  const conflicting = structuredClone(related); conflicting.runs[0].results[0].relatedLocations[0].id = 1; assert.throws(() => regionCheck(conflicting), /location ID/);
  const threads = make(); threads.runs[0].results[0].codeFlows = [{ threadFlows: [{ id: 'a', locations: [{}] }, { id: 'b', locations: [{}] }] }]; assert.doesNotThrow(() => regionCheck(threads)); threads.runs[0].results[0].codeFlows[0].threadFlows[1].id = 'a'; assert.throws(() => regionCheck(threads), /thread flow identity/);
});

test('every typed physical context is a proper superset and supplied address byte lengths agree by absolute value', async () => {
  const choices = [
    [false, { contextRegion: { charOffset: 0, charLength: 10 } }],
    [false, { region: { charOffset: 2, charLength: 1 }, contextRegion: { charOffset: 2, charLength: 1 } }],
    [true, { region: { charOffset: 2, charLength: 1 }, contextRegion: { charOffset: 0, charLength: 10 } }],
    [false, { address: { absoluteAddress: 0, length: 2 }, region: { byteOffset: 0, byteLength: 1 } }],
    [true, { address: { absoluteAddress: 0, length: 1 }, region: { byteOffset: 0, byteLength: 1 } }],
    [true, { address: { absoluteAddress: 0, length: -1 }, region: { byteOffset: 0, byteLength: 1 } }],
  ];
  for (const make of [proofFixture, processedFixture]) for (const representation of ['report', 'server']) for (const name of ['current', 'baseline']) for (const [ready, physical] of choices) {
    const f = make(), role = f[name], r = role[representation].runs[0]; r.graphs = [{ nodes: [{ id: 'unused', location: { physicalLocation: { artifactLocation: structuredClone(r.artifacts[0].location), ...structuredClone(physical) } } }], edges: [] }]; if (representation === 'report') sealRole(role);
    if (ready) assert.equal((await publicOutcome(f)).ready, true); else await assert.rejects(publicOutcome(f), /context|byte length/);
  }
  for (const [region, context] of [[{ startLine: 2 }, { startLine: 1, endLine: 3 }], [{ charOffset: 1 }, { charOffset: 0, charLength: 2 }], [{ byteOffset: 1 }, { byteOffset: 0, byteLength: 2 }]]) { const r = regionReport(region, 'abc\ndef\nghi\n'); r.runs[0].results[0].locations[0].physicalLocation.contextRegion = context; assert.doesNotThrow(() => regionCheck(r)); }
  const equal = regionReport({ startLine: 1 }); equal.runs[0].results[0].locations[0].physicalLocation.contextRegion = { startLine: 1, startColumn: 1 }; assert.throws(() => regionCheck(equal), /proper/);
});

function addContentAlias(run, representation, indexed, region, uri = 'src/content-evidence.txt') {
  const slot = run.artifacts.length, location = { uri, ...(representation === 'report' ? { uriBaseId: '%SRCROOT%' } : {}) };
  run.artifacts.push({ location: { ...location, index: slot }, contents: { text: 'x' }, length: 1, encoding: 'utf-8' });
  run.graphs = [{ nodes: [{ id: 'unused', location: { physicalLocation: { artifactLocation: { ...location, ...(indexed ? { index: slot } : {}) }, region } } }], edges: [] }];
  return slot;
}
test('URI base and index aliases consume all known complete artifact evidence in both roles and routes', async () => {
  for (const make of [proofFixture, processedFixture]) for (const representation of ['report', 'server']) for (const name of ['current', 'baseline']) for (const indexed of [false, true]) for (const valid of [false, true]) {
    const f = make(), role = f[name]; addContentAlias(role[representation].runs[0], representation, indexed, { charOffset: valid ? 0 : 2, charLength: 1 }); if (representation === 'report') sealRole(role);
    if (valid) assert.equal((await publicOutcome(f)).ready, true); else await assert.rejects(publicOutcome(f), /exceeds complete artifact/);
  }
  for (const representation of ['report', 'server']) for (const uri of ['src/./content-evidence.txt', 'src/%63ontent-evidence.txt']) {
    const f = processedFixture(); pairedRepresentation(f, representation, r => { addContentAlias(r, representation, false, { charOffset: 1, charLength: 0 }); r.graphs[0].nodes[0].location.physicalLocation.artifactLocation.uri = uri; }); assert.equal((await publicOutcome(f)).ready, true, uri);
  }
});

test('all inventory views of one identity reconcile content without first-green selection or invented sizes', () => {
  const valid = regionReport({ charOffset: 0, charLength: 1 }, 'x'); valid.runs[0].results[0].locations[0].physicalLocation.artifactLocation = { uri: 'source.txt' };
  valid.runs[0].artifacts.push({ location: { uri: './source.txt', index: 1 }, length: 1, properties: { opaque: { index: 999999 } } }); assert.doesNotThrow(() => regionCheck(valid));
  for (const change of [a => a.length = 2, a => a.contents = { text: 'y' }, a => a.contents = { binary: Buffer.from('y').toString('base64') }, a => a.encoding = 'utf-16']) for (const reverse of [false, true]) { const r = structuredClone(valid); change(r.runs[0].artifacts[1]); if (reverse) { r.runs[0].artifacts.reverse(); delete r.runs[0].artifacts[0].location.index; } assert.throws(() => regionCheck(r), /contradictory|contradiction/); }
  const inconsistent = regionReport({ charOffset: 0 }, 'x', { length: 2 }); delete inconsistent.runs[0].artifacts[0].contents.binary; assert.throws(() => regionCheck(inconsistent), /text\/byte length contradiction/);
  const unavailable = regionReport({ charOffset: 9999 }); delete unavailable.runs[0].artifacts; unavailable.runs[0].results[0].locations[0].physicalLocation.artifactLocation = { uri: 'unavailable.txt' }; assert.doesNotThrow(() => regionCheck(unavailable));
  const length = regionReport({ byteOffset: 2 }, 'x', { length: 1 }); delete length.runs[0].artifacts[0].contents; length.runs[0].results[0].locations[0].physicalLocation.artifactLocation = { uri: 'source.txt' }; assert.throws(() => regionCheck(length), /exceeds complete artifact length/);
});

test('exact processed related index-zero profile uses native-bound explicit source content rather than artifact zero', async () => {
  const prepare = f => { for (const role of [f.current, f.baseline]) { for (const r of [role.report.runs[0], role.server.runs[0]]) { r.artifacts[0].contents = { text: 'abc\n' }; r.artifacts[1].contents = { text: 'abc\nabc\nabc\n' }; } sealRole(role); } };
  const valid = processedFixture(); prepare(valid); assert.equal((await publicOutcome(valid)).ready, true, 'artifact0 has only one line; related URI has its own valid three-line content');
  for (const representation of ['report', 'server']) for (const name of ['current', 'baseline']) { const f = processedFixture(); prepare(f); f[name][representation].runs[0].artifacts[1].contents.text = 'x'; if (representation === 'report') sealRole(f[name]); await assert.rejects(publicOutcome(f), /exceeds complete artifact/); }
  const wrongIndex = processedFixture(); prepare(wrongIndex); for (const role of [wrongIndex.current, wrongIndex.baseline]) role.server.runs[0].results[0].relatedLocations[0].physicalLocation.artifactLocation.index = 2; await assert.rejects(publicOutcome(wrongIndex), /contradicts indexed/);
});

test('unused typed relations still deny complete-zero proof and actual warm cache corruption retains its custody layer', async () => {
  for (const representation of ['report', 'server']) for (const name of ['current', 'baseline']) {
    const zero = processedFixture(); for (const role of [zero.current, zero.baseline]) { role.report.runs[0].results = []; role.server.runs[0].results = []; sealRole(role); }
    assert.equal((await publicOutcome(zero)).ready, true);
    zero[name][representation].runs[0].webRequests = [{ method: 'GET' }]; zero[name][representation].runs[0].threadFlowLocations = [{ webRequest: { index: 99999 } }]; if (representation === 'report') sealRole(zero[name]); await assert.rejects(publicOutcome(zero), /index out of range/);
    const f = processedFixture(), cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true);
    const entry = [...cache.entries()].find(([key]) => key.startsWith(`native:${sourcePolicy.repository}:${f[name].sourceSha}:`)); assert.ok(entry, 'a complete successful observation created the actual role cache key');
    entry[1][representation].runs[0].graphs = [{ nodes: [{ id: 'a' }], edges: [{ id: 'e', sourceNodeId: 'absent', targetNodeId: 'a' }] }];
    await assert.rejects(publicOutcome(f, cache), /immutable|complete artifact member|source raw-body\/object identity/, 'this is stored-byte/object custody refusal, not fresh semantic-parser credit');
  }
});

test('repeated cached source views retain full opaque metadata while validation work stays bounded and conflicts still deny', () => {
  const report = regionReport({ charOffset: 0 });
  report.runs[0].threadFlowLocations = [{ location: { id: 1, physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 0 } }, properties: { opaque: 'x'.repeat(1024 * 1024), custom: { graphTraversal: { runGraphIndex: 99999 } } } } }];
  report.runs[0].results[0].codeFlows = [{ threadFlows: [{ locations: Array.from({ length: 2048 }, () => ({ index: 0 })) }] }];
  const before = canonical(report), measured = regionCheck(report);
  assert.equal(canonical(report), before); assert.ok(measured.locationIdentityCanonicalBytes < measured.ceiling); assert.ok(measured.work < measured.ceiling);
  const conflict = structuredClone(report); conflict.runs[0].results[0].codeFlows[0].threadFlows[0].locations[1024].location = { id: 1, physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 1 } } };
  assert.throws(() => regionCheck(conflict), /cache override/);
  const ambiguous = structuredClone(report); ambiguous.runs[0].results[0].relatedLocations = [{ id: 1, physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 1 } } }]; assert.throws(() => regionCheck(ambiguous), /conflicting result location ID/);
  const mutation = structuredClone(report), schema = validateSarifSchema(mutation);
  Object.defineProperty(mutation.runs[0].artifacts[0].contents, 'text', { enumerable: true, get() { mutation.runs[0].threadFlowLocations[0].location.id = 2; return 'abc\r\ndef\r\n'; } });
  assert.throws(() => validateSarifSemantics(mutation, schema), /mutated after validation identity/);
  const excessive = regionReport({ charOffset: 0 }), payload = 'x'.repeat(2 * 1024 * 1024);
  // Pure semantic-layer guard: the full raw transport would reject this larger
  // representation even earlier. No production ceiling is changed for the test.
  excessive.runs[0].results[0].relatedLocations = Array.from({ length: 24 }, (_, id) => ({ id, physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 0 } }, properties: { opaque: payload } }));
  assert.throws(() => regionCheck(excessive), /typed source relation work bound exceeded/);
});


test('distinct inline location declarations cannot share IDs while exact cached views retain their one referent', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const representation of ['report', 'server']) {
    for (const duplicate of [false, true]) {
      const f = fixture();
      for (const role of [f.current, f.baseline]) {
        const run = role[representation].runs[0], first = structuredClone(run.results[0].locations[0]); first.id = 912345;
        run.results[0].stacks = [{ frames: [{ module: 'first', location: first }, { module: 'second', location: { ...structuredClone(first), id: duplicate ? 912345 : 912346 } }] }];
        if (representation === 'report') sealRole(role);
      }
      if (duplicate) await assert.rejects(publicOutcome(f), /location ID declaration/);
      else { const cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true); assert.equal((await publicOutcome(f, cache)).ready, true); }
    }
  }
  const report = regionReport({ charOffset: 0 }), location = { id: 77, physicalLocation: { artifactLocation: { index: 0 } } };
  report.runs[0].results[0].stacks = [{ frames: [{ location }, { location }] }];
  assert.throws(() => regionCheck(report), /location ID declaration/, 'one JS value at two inline serialized positions is two declarations');
  delete report.runs[0].results[0].stacks;
  report.runs[0].threadFlowLocations = [{ location }]; report.runs[0].results[0].codeFlows = [{ threadFlows: [{ locations: [{ index: 0 }, { index: 0, location: structuredClone(location) }] }] }];
  assert.doesNotThrow(() => regionCheck(report), 'validated explicit equal cache views share the cached-field origin');
  report.runs[0].threadFlowLocations.push({ ...structuredClone(report.runs[0].threadFlowLocations[0]), module: 'different-container' }); report.runs[0].results[0].codeFlows[0].threadFlows[0].locations.push({ index: 1 });
  assert.throws(() => regionCheck(report), /location ID declaration/, 'distinct equal cached slots cannot share one result-local ID');
});

test('standard taxonomy catalogs and custom driver extension taxa use their actual typed owners and defaults', async () => {
  for (const representation of ['report', 'server']) for (const kind of ['custom-driver', 'custom-extension', 'standard', 'external', 'standard-rules', 'standard-notifications', 'missing-custom', 'wrong-component', 'negative-component']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      const run = role[representation].runs[0], reference = { id: 'T', index: 0 };
      if (kind === 'custom-driver' || kind === 'missing-custom' || kind === 'negative-component') { run.tool.driver.taxa = [{ id: 'T' }]; if (kind === 'missing-custom') reference.id = 'NO'; if (kind === 'negative-component') reference.toolComponent = { index: -1, name: run.tool.driver.name }; }
      if (kind === 'custom-extension' || kind === 'wrong-component') { run.tool.extensions[0].taxa = [{ id: 'T' }]; reference.toolComponent = { index: 0, name: kind === 'wrong-component' ? 'Other' : run.tool.extensions[0].name }; }
      if (kind.startsWith('standard')) {
        run.taxonomies = [{ name: 'Standard', taxa: [{ id: 'T' }] }]; reference.toolComponent = { index: 0, name: 'Standard' };
        if (kind === 'standard-rules') run.taxonomies[0].rules = [];
        if (kind === 'standard-notifications') run.taxonomies[0].notifications = [];
      }
      if (kind === 'external') { delete reference.index; reference.toolComponent = { name: 'ExternalTaxonomy', guid: '00000000-0000-4000-8000-000000000008' }; }
      run.threadFlowLocations = [{ taxa: [reference] }]; if (representation === 'report') sealRole(role);
    }
    if (['standard-rules', 'standard-notifications', 'missing-custom', 'wrong-component', 'negative-component'].includes(kind)) await assert.rejects(publicOutcome(f), /taxonomy|descriptor|component reference/);
    else assert.equal((await publicOutcome(f)).ready, true, `${representation}/${kind}`);
  }
});

test('typed messages resolve exact canonical source destinations without blacklisting ordinary numeric-looking URI references', () => {
  for (const markdown of [false, true]) for (const destination of ['0', '1', '00', '+1', './-1', '1?query', '%31', '%2531', 'https://example.com/source', 'sarif:/runs/0/results/0']) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = destination === '0' ? 0 : 1;
    const text = `[source](${destination})`; report.runs[0].results[0].message = { text, ...(markdown ? { markdown: text } : {}) };
    const before = canonical(report); assert.doesNotThrow(() => regionCheck(report), `${markdown}/${destination}`); assert.equal(canonical(report), before);
  }
  for (const destination of ['2', '999999', '-1', 'sarif:/runs/0/results/99', 'sarif://other/runs/0/results/0']) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].message.text = `[source](${destination})`;
    assert.throws(() => regionCheck(report), /message.*(?:link|pointer|URI)/, destination);
  }
});

test('actual message placeholders use bounds once and preserve literal program braces and arguments', () => {
  for (const [text, args] of [['{0}', ['value']], ['{{999999}}', []], ['{\n code: 1\n}', []], ['argument {0}', ['{999999}']], ['[source]({0})', ['1']]]) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = 1; report.runs[0].results[0].message = { text, arguments: args }; assert.doesNotThrow(() => regionCheck(report), text);
  }
  for (const text of ['{1}', '{00}', '{01}', '{9999999999999999999999999999}', '[source]({0})']) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].message = { text, arguments: text === '[source]({0})' ? ['999999'] : ['x'] }; assert.throws(() => regionCheck(report), /message.*(?:placeholder|source link)/, text);
  }
});

test('GFM active inline reference and entity destinations resolve sources while code escaped and unused forms stay literal', () => {
  const valid = ['[source](1)', '[source](<1> "title")', '[source](1 \'title\')', '[source][REF]\n\n[ref]: 1', '[REF][]\n\n[ref]: 1', '[REF]\n\n[ref]: 1', '[source][Straße]\n\n[STRASSE]: 1', '[source](&#49;)', '[source](&#x31;)', '\\[literal](999999)', '`[literal](999999)`', '```\n[literal](999999)\n```', '    [literal](999999)', '[unbound]', '[ref]: 999999\n\nordinary', '[source][ref]\n\n[ref]: 1\n[ref]: 999999', '[source][foo\\!]\n\n[foo!]: 999999', '![image](00)', '[![image](image.png)](1)', '![foo [bar](1)](image.png)', '![outer ![inner [source](1)](inner.png)](outer.png)', '![alt `[literal](999999)`](image.png)', '[outer [inner](https://example.com/)](999999)', '[Foo\n  bar]: 1\n\n[source][Foo bar]' ];
  const invalid = ['[source](999999)', '[source](<999999> "title")', '[source][REF]\n\n[ref]: 999999', '[REF][]\n\n[ref]: 999999', '[REF]\n\n[ref]: 999999', '[source](&#57;&#57;&#57;&#57;&#57;&#57;)', '[source][ref]\n\n[ref]: 999999\n[ref]: 1', '> [source](999999)', '![foo [bar](999999)](image.png)', '![outer ![inner [source](999999)](inner.png)](outer.png)', '- [source](999999)', '\\![source]\n\n[source]: 999999' ];
  for (const [expected, messages] of [[true, valid], [false, invalid]]) for (const markdown of messages) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = 1; report.runs[0].results[0].message = { text: 'plain fallback', markdown };
    if (expected) assert.doesNotThrow(() => regionCheck(report), markdown); else assert.throws(() => regionCheck(report), /message.*source link/, markdown);
  }
});

test('both complete native and server roles refuse missing typed source or argument references before comparisons', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const kind of ['link', 'argument']) {
    const f = fixture();
    for (const role of [f.current, f.baseline]) { for (const run of [role.report.runs[0], role.server.runs[0]]) run.results[0].message = kind === 'link' ? { text: 'missing [source](999999)' } : { text: 'missing {999999}', arguments: ['x'] }; sealRole(role); }
    await assert.rejects(publicOutcome(f), /typed message.*(?:source link|placeholder)/, `${fixture.name}/${kind}`);
  }
  const f = processedFixture(); for (const role of [f.current, f.baseline]) { for (const run of [role.report.runs[0], role.server.runs[0]]) run.results[0].message = { text: 'source [here](1) {0}', arguments: ['literal {999999}'] }; sealRole(role); }
  const cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true); assert.equal((await publicOutcome(f, cache)).ready, true);
});

test('used catalog templates and cached messages resolve each actual argument and result owner without prototype fallback', async () => {
  for (const bad of [false, true]) {
    const f = processedFixture(); for (const role of [f.current, f.baseline]) { for (const run of [role.report.runs[0], role.server.runs[0]]) { run.tool.extensions[0].globalMessageStrings = { used: { text: 'source [here]({0})', markdown: 'source **[here]({0})**' } }; run.results[0].locations[0].message = { id: 'used', arguments: [bad ? '999999' : '1'] }; } sealRole(role); }
    if (bad) await assert.rejects(publicOutcome(f), /typed message source link/); else assert.equal((await publicOutcome(f)).ready, true);
  }
  const report = regionReport({ charOffset: 0 }); report.runs[0].threadFlowLocations = [{ location: { id: 7, message: { text: '[self](7)' } } }]; report.runs[0].results[0].codeFlows = [{ threadFlows: [{ locations: [{ index: 0 }, { index: 0 }] }] }];
  assert.doesNotThrow(() => regionCheck(report));
  report.runs[0].results.push({ ruleId: 'other', message: { text: '[foreign](7)' } }); assert.throws(() => regionCheck(report), /source link target absent/);
  const inherited = regionReport({ charOffset: 0 }); inherited.runs[0].tool.driver.rules = [{ id: 'r' }]; inherited.runs[0].results[0].message = { id: '__proto__' }; assert.throws(() => regionCheck(inherited), /rule|catalog|descriptor/);
});


test('direct metadata text uses documented lookup precedence and only actual used templates require arguments', () => {
  const report = regionReport({ charOffset: 0 }); report.runs[0].artifacts[0].description = { text: 'direct metadata', id: 'unprovided' };
  assert.doesNotThrow(() => regionCheck(report), 'direct text does not require an unused unknown metadata template');
  report.runs[0].artifacts[0].description = { id: 'unprovided' }; assert.throws(() => regionCheck(report), /message catalog identity/);
  report.runs[0].tool.driver.globalMessageStrings = { unprovided: { text: 'argument {0}' } };
  assert.throws(() => regionCheck(report), /placeholder argument/);
  report.runs[0].artifacts[0].description.arguments = ['literal {999999}']; assert.doesNotThrow(() => regionCheck(report));
});


test('typed taxonomy relationships can identify real rule and notification owners without requiring those owners to define taxa', async () => {
  for (const kind of ['index-guid', 'guid-only', 'index-name', 'index-only', 'notification-guid', 'ambiguous-index-only', 'wrong-id', 'wrong-index', 'wrong-guid']) {
    const f = processedFixture();
    for (const role of [f.current, f.baseline]) {
      for (const run of [role.report.runs[0], role.server.runs[0]]) {
        const component = run.tool.extensions[0], descriptorIndex = kind === 'index-only' ? component.notifications.length : 0, descriptor = kind === 'notification-guid' ? component.notifications[0] : component.rules[descriptorIndex]; component.guid = '11111111-1111-4111-8111-111111111111'; descriptor.guid = '22222222-2222-4222-8222-222222222222';
        const target = { id: descriptor.id, index: descriptorIndex, guid: descriptor.guid, toolComponent: { index: 0, name: component.name, guid: component.guid } };
        if (kind === 'guid-only') { delete target.index; delete target.toolComponent.index; }
        if (kind === 'index-name') { delete target.guid; delete target.toolComponent.guid; }
        if (kind === 'index-only' || kind === 'ambiguous-index-only') { delete target.id; delete target.guid; delete target.toolComponent.name; delete target.toolComponent.guid; }
        if (kind === 'wrong-id') target.id = 'not-the-selected-rule';
        if (kind === 'wrong-index') target.index = 99;
        if (kind === 'wrong-guid') target.guid = '33333333-3333-4333-8333-333333333333';
        run.tool.driver.taxa = [{ id: 'CUSTOM', relationships: [{ target, kinds: ['superset'] }] }];
      }
      sealRole(role);
    }
    if (kind.startsWith('wrong') || kind === 'ambiguous-index-only') await assert.rejects(publicOutcome(f), /taxonomy descriptor/); else assert.equal((await publicOutcome(f)).ready, true, kind);
  }
});

test('reference scanner charges repeated failed terminator searches without reducing literal or source occurrence evidence', () => {
  const small = regionReport({ charOffset: 0 }); small.runs[0].results[0].message = { text: 'fallback', markdown: 'prefix ' + Array.from({ length: 512 }, (_, index) => '`'.repeat(512 - index) + ' x ').join('') };
  // Pure scanner-work diagnostic, not a claim that raw HTML is valid SARIF or
  // that this fixture establishes native custody or rendering conformance.
  const measured = regionCheck(small); assert.ok(measured.work > 4_000_000 && measured.work < measured.ceiling);
  const large = regionReport({ charOffset: 0 }); large.runs[0].results[0].message = { text: 'fallback', markdown: 'prefix ' + Array.from({ length: 1024 }, (_, index) => '`'.repeat(1024 - index) + ' x ').join('') };
  assert.throws(() => regionCheck(large), /typed source relation work bound exceeded/);
  const ordinary = regionReport({ charOffset: 0 }); ordinary.runs[0].results[0].message = { text: 'fallback', markdown: '<!-- closed --> '.repeat(512) + 'ordinary text' };
  assert.doesNotThrow(() => regionCheck(ordinary), 'successful short terminator searches stay linear and bounded');
});

const repair04MessageOwners = ['artifact-description','artifact-location-description','attachment-description','code-flow-message','edge-label','edge-traversal-message','fix-description','graph-description','graph-traversal-description','location-message','location-relationship-description','node-label','notification-message','rectangle-message','region-message','descriptor-relationship-description','result-message','automation-description','stack-message','thread-flow-message','run-graph-description','run-node-label','run-edge-label','cached-location-message','unused-cached-location-message','cached-two-results'];
function repair04MessageOwnerCase(kind,message){
 const location=()=>({physicalLocation:{artifactLocation:{index:0},region:{charOffset:0}}});
 const graph=()=>({nodes:[{id:'a'},{id:'b'}],edges:[{id:'edge',sourceNodeId:'a',targetNodeId:'b'}]});
 const run={tool:{driver:{name:'typed-owner-schema-fixture',rules:[{id:'r'}]}},artifacts:[{location:{uri:'source.txt'},contents:{text:'abc'},encoding:'utf-8'}],results:[{ruleId:'r',message:{text:'fallback'},locations:[{...location(),id:1}]}]},result=run.results[0];
 const flow=()=>({threadFlows:[{locations:[{location:location()}]}]});
 const attachment=()=>({artifactLocation:{index:0}});
 const unowned=['artifact-description','artifact-location-description','notification-message','descriptor-relationship-description','automation-description','run-graph-description','run-node-label','run-edge-label','unused-cached-location-message'];
 if(kind==='artifact-description')run.artifacts[0].description=message;
 if(kind==='artifact-location-description')run.artifacts[0].location.description=message;
 if(kind==='attachment-description')result.attachments=[{...attachment(),description:message}];
 if(kind==='code-flow-message')result.codeFlows=[{...flow(),message}];
 if(['edge-label','graph-description','node-label'].includes(kind)){result.graphs=[graph()];if(kind==='edge-label')result.graphs[0].edges[0].label=message;if(kind==='graph-description')result.graphs[0].description=message;if(kind==='node-label')result.graphs[0].nodes[0].label=message;}
 if(['run-edge-label','run-graph-description','run-node-label'].includes(kind)){run.graphs=[graph()];if(kind==='run-edge-label')run.graphs[0].edges[0].label=message;if(kind==='run-graph-description')run.graphs[0].description=message;if(kind==='run-node-label')run.graphs[0].nodes[0].label=message;}
 if(kind==='edge-traversal-message'||kind==='graph-traversal-description'){result.graphs=[graph()];result.graphTraversals=[{resultGraphIndex:0,edgeTraversals:[{edgeId:'edge'}]}];if(kind==='edge-traversal-message')result.graphTraversals[0].edgeTraversals[0].message=message;else result.graphTraversals[0].description=message;}
 if(kind==='fix-description')result.fixes=[{description:message,artifactChanges:[{artifactLocation:{index:0},replacements:[{deletedRegion:{charOffset:0,charLength:0},insertedContent:{text:''}}]}]}];
 if(kind==='location-message')result.locations[0].message=message;
 if(kind==='location-relationship-description')result.locations[0].relationships=[{target:1,description:message}];
 if(kind==='notification-message')run.invocations=[{executionSuccessful:true,toolExecutionNotifications:[{level:'note',message}]}];
 if(kind==='rectangle-message')result.attachments=[{...attachment(),rectangles:[{top:0,left:0,bottom:1,right:1,message}]}];
 if(kind==='region-message')result.locations[0].physicalLocation.region.message=message;
 if(kind==='descriptor-relationship-description')run.tool.driver.rules[0].relationships=[{target:{id:'external-unmaterialized'},description:message}];
 if(kind==='result-message')result.message=message;
 if(kind==='automation-description')run.automationDetails={id:'typed-owner/',description:message};
 if(kind==='stack-message')result.stacks=[{message,frames:[{location:location()}]}];
 if(kind==='thread-flow-message'){result.codeFlows=[flow()];result.codeFlows[0].threadFlows[0].message=message;}
 if(['cached-location-message','unused-cached-location-message','cached-two-results'].includes(kind)){
  run.threadFlowLocations=[{location:{...location(),id:2,message}}];
  if(kind!=='unused-cached-location-message')result.codeFlows=[{threadFlows:[{locations:[{index:0},{index:0}]}]}];
  if(kind==='cached-two-results')run.results.push({ruleId:'r',message:{text:'other'},locations:[{...location(),id:3}],codeFlows:[{threadFlows:[{locations:[{index:0}]}]}]});
 }
 return{report:{version:'2.1.0',runs:[run]},sourceTargetExpected:!unowned.includes(kind)&&kind!=='cached-two-results'};
}


test('every schema typed message owner validates actual references in its exact result and cache context', () => {
  for (const owner of repair04MessageOwners) for (const variant of ['URI', 'source', 'bad-source', 'argument', 'bad-argument']) {
    const message = variant === 'URI' ? { text: '[ordinary](00)' } : variant === 'source' ? { text: '[source](1)' } : variant === 'bad-source' ? { text: '[missing](999999)' } : variant === 'argument' ? { text: '{0}', arguments: ['literal {999999}'] } : { text: '{999999}', arguments: ['x'] };
    const { report, sourceTargetExpected } = repair04MessageOwnerCase(owner, message), before = canonical(report), expected = variant === 'URI' || variant === 'argument' || variant === 'source' && sourceTargetExpected;
    if (expected) assert.doesNotThrow(() => regionCheck(report), `${owner}/${variant}`); else assert.throws(() => regionCheck(report), /typed message.*(?:source link|placeholder)/, `${owner}/${variant}`);
    assert.equal(canonical(report), before, 'reference validation must preserve every original field/value');
  }
});

test('unused templates debugger values and opaque message-shaped bags do not become recursive message instances', () => {
  const report = regionReport({ charOffset: 0 }), literal = '{999999} [program text](999999)';
  report.runs[0].tool.driver.globalMessageStrings = { unused: { text: literal } };
  report.runs[0].tool.driver.rules = [{ id: 'r', messageStrings: { unused: { text: literal } }, help: { text: literal } }];
  report.runs[0].artifacts[0].contents.rendered = { text: literal };
  report.runs[0].threadFlowLocations = [{ state: { expression: { text: literal } } }];
  report.runs[0].results[0].codeFlows = [{ threadFlows: [{ initialState: { expression: { text: literal } }, immutableState: { expression: { text: literal } }, locations: [{ index: 0 }] }] }];
  report.runs[0].properties = { custom: { message: { text: literal } } };
  const before = canonical(report); assert.doesNotThrow(() => regionCheck(report)); assert.equal(canonical(report), before);
});


test('parsed image-description links retain normal source checks in both full routes independently of rendered HTML', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const kind of ['valid-inner', 'missing-inner', 'ordinary-image', 'literal-code']) {
    const f = fixture();
    for (const role of [f.current, f.baseline]) {
      for (const run of [role.report.runs[0], role.server.runs[0]]) {
        if (kind === 'valid-inner') run.results[0].locations[0].id = 912345;
        const markdown = kind === 'valid-inner' ? '![image [source](912345)](image.png)' : kind === 'missing-inner' ? '![image [source](999999)](image.png)' : kind === 'ordinary-image' ? '![image](999999)' : '![image `[literal](999999)`](image.png)';
        run.results[0].message = { text: 'plain fallback', markdown };
      }
      sealRole(role);
    }
    if (kind === 'missing-inner') await assert.rejects(publicOutcome(f), /typed message source link target absent/);
    else { const cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true); assert.equal((await publicOutcome(f, cache)).ready, true); }
  }
});

test('descendant catalog lookup carries the actual result or notification producer across both full routes', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const kind of ['result-owner-bad', 'result-foreign-bad', 'cache-owner-bad', 'cache-foreign-bad', 'notification-owner-bad', 'notification-foreign-bad', 'driver-default', 'direct-rule', 'direct-notification', 'translation-good', 'translation-bad']) {
    const f = fixture(), label = 'repair04/descendant';
    for (const role of [f.current, f.baseline]) {
      const native = role.report.runs[0], server = role.server.runs[0];
      if (kind.startsWith('notification') || kind === 'direct-notification' || kind === 'driver-default') {
        const note = structuredClone(native.invocations[0].toolExecutionNotifications.find(value => value.descriptor.id === (kind === 'driver-default' ? 'cli/expected-extracted-files/typescript' : 'js/diagnostics/successfully-extracted-files')));
        delete note.locations[0].physicalLocation.artifactLocation.uriBaseId;
        server.invocations = [{ executionSuccessful: true, toolExecutionNotifications: [note] }];
      }
      for (const run of [native, server]) {
        const owner = run.tool.extensions[0], rule = owner.rules[0], message = { id: label, arguments: ['value'] };
        owner.globalMessageStrings = { [label]: { text: kind.endsWith('owner-bad') || kind === 'driver-default' || kind.startsWith('direct-') ? '{999999}' : '{0}' } };
        run.tool.driver.globalMessageStrings = { [label]: { text: kind.endsWith('foreign-bad') ? '{999999}' : '{0}' } };
        rule.messageStrings = { [label]: { text: kind === 'direct-rule' ? '{0}' : '{999999}' } };
        if (kind.startsWith('result') || kind.startsWith('translation')) run.results[0].locations[0].message = message;
        if (kind.startsWith('cache')) { run.threadFlowLocations = [{ location: { message } }]; run.results[0].codeFlows = [{ threadFlows: [{ locations: [{ index: 0 }, { index: 0 }] }] }]; }
        if (kind === 'direct-rule') run.results[0].message = { text: 'direct fallback', ...message };
        if (kind.startsWith('notification') || kind === 'direct-notification' || kind === 'driver-default') {
          const note = run.invocations[0].toolExecutionNotifications.find(value => value.descriptor.id === (kind === 'driver-default' ? 'cli/expected-extracted-files/typescript' : 'js/diagnostics/successfully-extracted-files'));
          note.associatedRule = structuredClone(run.results[0].rule);
          if (kind === 'direct-notification') { owner.notifications[0].messageStrings = { [label]: { text: '{0}' } }; note.message = message; }
          else note.locations[0].message = message;
        }
        if (kind.startsWith('translation')) {
          const translation = structuredClone(owner);
          delete translation.minimumRequiredLocalizedDataSemanticVersion;
          translation.language = 'fr-FR';
          translation.associatedComponent = { index: 0, name: owner.name };
          translation.translationMetadata = { name: 'test translation' };
          translation.localizedDataSemanticVersion = owner.minimumRequiredLocalizedDataSemanticVersion ?? owner.semanticVersion;
          translation.globalMessageStrings[label] = { text: kind === 'translation-bad' ? '{999999}' : '{0}' };
          run.translations = [translation];
        }
      }
      sealRole(role);
    }
    if (kind.endsWith('owner-bad') || kind === 'translation-bad') await assert.rejects(publicOutcome(f), /typed message placeholder argument/);
    else { const cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true, kind); assert.equal((await publicOutcome(f, cache)).ready, true, `${kind}/warm`); }
  }
});

test('lexical conversion and per-result cached message owners do not borrow foreign catalog entries', () => {
  const report = regionReport({ charOffset: 0 }), run = report.runs[0], label = 'owner';
  run.tool.driver.rules = [{ id: 'r' }]; run.tool.driver.globalMessageStrings = { [label]: { text: '{0}' } };
  run.tool.extensions = [{ name: 'other', rules: [{ id: 'other' }], globalMessageStrings: { [label]: { text: '{999999}' } } }];
  run.threadFlowLocations = [{ location: { message: { id: label, arguments: ['value'] } } }];
  run.results[0].codeFlows = [{ threadFlows: [{ locations: [{ index: 0 }] }] }];
  assert.doesNotThrow(() => regionCheck(report));
  run.results.push({ ruleId: 'other', message: { text: 'other' }, codeFlows: [{ threadFlows: [{ locations: [{ index: 0 }] }] }] });
  assert.throws(() => regionCheck(report), /typed message placeholder argument/, 'same cached message resolves each actual producer');
  run.results.pop(); delete run.threadFlowLocations; delete run.results[0].codeFlows;
  run.tool.extensions[0].rules[0].relationships = [{ target: { id: 'external' }, description: { id: label, arguments: ['value'] } }];
  assert.throws(() => regionCheck(report), /typed message placeholder argument/, 'lexical component owns descriptor descendants');
  delete run.tool.extensions[0].rules[0].relationships;
  run.tool.driver.globalMessageStrings[label].text = '{999999}';
  run.conversion = { tool: { driver: { name: 'conversion', globalMessageStrings: { [label]: { text: '{0}' } } } }, invocation: { executionSuccessful: true }, analysisToolLogFiles: [{ uri: 'conversion.log', description: { id: label, arguments: ['value'] } }] };
  run.translations = [{ name: 'analysis translation', language: 'fr', associatedComponent: { name: run.tool.driver.name }, translationMetadata: { name: 'analysis only' }, globalMessageStrings: { [label]: { text: '{999999}' } } }];
  assert.doesNotThrow(() => regionCheck(report), 'conversion does not borrow same-slot analysis translations');
  run.results[0].locations[0].message = { text: 'optional direct metadata', id: 'unused' }; delete run.tool.driver.rules;
  assert.doesNotThrow(() => regionCheck(report), 'unmaterialized optional direct text does not invent a catalog owner');
});

const repair05GrammarCases = {
  "inline": [
    {
      "name": "invalid-open",
      "markdown": "prefix <span [source](999999)>",
      "ready": false
    },
    {
      "name": "invalid-close",
      "markdown": "prefix </span [source](999999)>",
      "ready": false
    },
    {
      "name": "invalid-email",
      "markdown": "prefix <[source](999999)@example.com>",
      "ready": false
    },
    {
      "name": "image-invalid-html",
      "markdown": "![alt <span [source](999999)>](image.png)",
      "ready": false
    },
    {
      "name": "unquoted-valid",
      "markdown": "prefix <span attr= [source](999999)>",
      "ready": true
    },
    {
      "name": "quoted-valid",
      "markdown": "prefix <span title=\"[source](999999)\">",
      "ready": true
    },
    {
      "name": "single-quoted-valid",
      "markdown": "prefix <span title='[source](999999)'>",
      "ready": true
    },
    {
      "name": "boolean-attribute",
      "markdown": "prefix <span title data-x=[source](999999)>",
      "ready": true
    },
    {
      "name": "multiline-tag",
      "markdown": "prefix <span\n title=[source](999999)>",
      "ready": true
    },
    {
      "name": "VT-whitespace",
      "markdown": "prefix <span\u000btitle=[source](999999)>",
      "ready": true
    },
    {
      "name": "FF-whitespace",
      "markdown": "prefix <span\ftitle=[source](999999)>",
      "ready": true
    },
    {
      "name": "NBSP-not-whitespace",
      "markdown": "prefix <span\u00a0title=[source](999999)>",
      "ready": false
    },
    {
      "name": "bad-attr-name",
      "markdown": "prefix <span [x]=[source](999999)>",
      "ready": false
    },
    {
      "name": "bad-tag-name",
      "markdown": "prefix <span_name [source](999999)>",
      "ready": false
    },
    {
      "name": "no-tag-name",
      "markdown": "prefix <1span [source](999999)>",
      "ready": false
    },
    {
      "name": "closing-attribute",
      "markdown": "prefix </span title=\"x\" [source](999999)>",
      "ready": false
    },
    {
      "name": "missing-attribute-space",
      "markdown": "prefix <span a='x'b=[source](999999)>",
      "ready": false
    },
    {
      "name": "empty-unquoted",
      "markdown": "prefix <span a= > [source](999999)",
      "ready": false
    },
    {
      "name": "unclosed-quoted",
      "markdown": "prefix <span a='[source](999999)>",
      "ready": false
    },
    {
      "name": "backslash-not-quote-escape",
      "markdown": "prefix <span a=\"x\\\"[source](999999)>",
      "ready": false
    },
    {
      "name": "comment-valid",
      "markdown": "prefix <!-- [source](999999) -->",
      "ready": true
    },
    {
      "name": "comment-invalid-body",
      "markdown": "prefix <!--a--b [source](999999) -->",
      "ready": false
    },
    {
      "name": "comment-invalid-prefix",
      "markdown": "prefix <!--> [source](999999) -->",
      "ready": false
    },
    {
      "name": "comment-unclosed",
      "markdown": "prefix <!-- [source](999999)",
      "ready": false
    },
    {
      "name": "PI-valid",
      "markdown": "prefix <? [source](999999) ?>",
      "ready": true
    },
    {
      "name": "PI-unclosed",
      "markdown": "prefix <? [source](999999)",
      "ready": false
    },
    {
      "name": "declaration-valid",
      "markdown": "prefix <!DOCTYPE [source](999999)>",
      "ready": true
    },
    {
      "name": "declaration-needs-space",
      "markdown": "prefix <!X[source](999999)>",
      "ready": false
    },
    {
      "name": "declaration-uppercase",
      "markdown": "prefix <!x [source](999999)>",
      "ready": false
    },
    {
      "name": "CDATA-valid",
      "markdown": "prefix <![CDATA[ [source](999999) ]]>",
      "ready": true
    },
    {
      "name": "CDATA-unclosed",
      "markdown": "prefix <![CDATA[ [source](999999)",
      "ready": false
    },
    {
      "name": "CDATA-case",
      "markdown": "prefix <![cdata[ [source](999999) ]]>",
      "ready": false
    },
    {
      "name": "URI-valid",
      "markdown": "prefix <ab:[source](999999)>",
      "ready": true
    },
    {
      "name": "URI-short-scheme",
      "markdown": "prefix <a:[source](999999)>",
      "ready": false
    },
    {
      "name": "URI-max-scheme",
      "markdown": "prefix <aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:[source](999999)>",
      "ready": true
    },
    {
      "name": "URI-long-scheme",
      "markdown": "prefix <aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:[source](999999)>",
      "ready": false
    },
    {
      "name": "URI-space",
      "markdown": "prefix <http: [source](999999)>",
      "ready": false
    },
    {
      "name": "URI-control",
      "markdown": "prefix <ab:\u007f[source](999999)>",
      "ready": false
    },
    {
      "name": "URI-NUL-derived-replacement",
      "markdown": "prefix <ab:\u0000[source](999999)>",
      "ready": true
    },
    {
      "name": "escaped-angle",
      "markdown": "prefix \\<span [source](999999)>",
      "ready": false
    },
    {
      "name": "entity-angle",
      "markdown": "prefix &lt;span [source](999999)>",
      "ready": false
    },
    {
      "name": "entity-brackets",
      "markdown": "prefix &lbrack;source&rbrack;(999999)",
      "ready": true
    },
    {
      "name": "code-span",
      "markdown": "prefix `<span [source](999999)>`",
      "ready": true
    },
    {
      "name": "code-span-unclosed",
      "markdown": "prefix `<span [source](999999)>",
      "ready": false
    },
    {
      "name": "valid-email",
      "markdown": "prefix <a.b+c-d@example-domain.com>",
      "ready": true
    },
    {
      "name": "email-after-active",
      "markdown": "prefix <a@example.com> [source](999999)",
      "ready": false
    },
    {
      "name": "image-destination",
      "markdown": "![image](999999)",
      "ready": true
    },
    {
      "name": "image-valid-inline-HTML",
      "markdown": "![alt <span title=\"[source](999999)\">](image.png)",
      "ready": true
    }
  ],
  "blocks": [
    {
      "name": "type1-script",
      "markdown": "<script>\n[source](999999)\n</script>",
      "ready": true
    },
    {
      "name": "type1-style-unclosed",
      "markdown": "<STYLE\n\n[source](999999)",
      "ready": true
    },
    {
      "name": "type1-other-closing",
      "markdown": "<pre>\n[source](999999)\n</style>\n[source](999999)",
      "ready": false
    },
    {
      "name": "type1-close-trailing-line",
      "markdown": "<script>\n</script>[source](999999)",
      "ready": true
    },
    {
      "name": "type1-close-next-line",
      "markdown": "<script>\n</script>\n[source](999999)",
      "ready": false
    },
    {
      "name": "type1-inexact-close",
      "markdown": "<script>\n</script >\n[source](999999)",
      "ready": true
    },
    {
      "name": "type2-comment",
      "markdown": "<!--\n[source](999999)\n-->",
      "ready": true
    },
    {
      "name": "type2-unclosed",
      "markdown": "<!--\n\n[source](999999)",
      "ready": true
    },
    {
      "name": "type2-body-inline-invalid",
      "markdown": "<!--> [source](999999)",
      "ready": true
    },
    {
      "name": "type2-next-line",
      "markdown": "<!-- -->\n[source](999999)",
      "ready": false
    },
    {
      "name": "type3-PI",
      "markdown": "<?\n[source](999999)\n?>",
      "ready": true
    },
    {
      "name": "type3-unclosed",
      "markdown": "<?\n\n[source](999999)",
      "ready": true
    },
    {
      "name": "type3-next-line",
      "markdown": "<? ?>\n[source](999999)",
      "ready": false
    },
    {
      "name": "type4-declaration",
      "markdown": "<!X[source](999999)>",
      "ready": true
    },
    {
      "name": "type4-unclosed",
      "markdown": "<!X\n[source](999999)",
      "ready": true
    },
    {
      "name": "type4-next-line",
      "markdown": "<!DOCTYPE html>\n[source](999999)",
      "ready": false
    },
    {
      "name": "type5-CDATA",
      "markdown": "<![CDATA[\n[source](999999)\n]]>",
      "ready": true
    },
    {
      "name": "type5-unclosed",
      "markdown": "<![CDATA[\n\n[source](999999)",
      "ready": true
    },
    {
      "name": "type5-next-line",
      "markdown": "<![CDATA[]]>\n[source](999999)",
      "ready": false
    },
    {
      "name": "type6-div",
      "markdown": "<div>\n[source](999999)\n</div>",
      "ready": true
    },
    {
      "name": "type6-partial",
      "markdown": "<div broken [source](999999)\n[source](999999)",
      "ready": true
    },
    {
      "name": "type6-blank-end",
      "markdown": "<div>\n\n[source](999999)",
      "ready": false
    },
    {
      "name": "type6-VT-not-blank",
      "markdown": "<div>\n\u000b\n[source](999999)",
      "ready": true
    },
    {
      "name": "type6-tab-blank",
      "markdown": "<div>\n\t\n[source](999999)",
      "ready": false
    },
    {
      "name": "type6-inner-start-no-reset",
      "markdown": "<div>\n<script>\n\n[source](999999)",
      "ready": false
    },
    {
      "name": "type7-custom",
      "markdown": "<custom>\n[source](999999)",
      "ready": true
    },
    {
      "name": "type7-close-alone",
      "markdown": "</custom>\n[source](999999)",
      "ready": true
    },
    {
      "name": "type7-blank-end",
      "markdown": "<custom>\n\n[source](999999)",
      "ready": false
    },
    {
      "name": "type7-no-interrupt",
      "markdown": "prefix\n<custom>\n[source](999999)",
      "ready": false
    },
    {
      "name": "type6-interrupt",
      "markdown": "prefix\n<div>\n[source](999999)",
      "ready": true
    },
    {
      "name": "type7-not-alone",
      "markdown": "<custom> [source](999999)",
      "ready": false
    },
    {
      "name": "textarea-pinned-type7",
      "markdown": "<textarea>\n\n[source](999999)",
      "ready": false
    },
    {
      "name": "indent3",
      "markdown": "   <div>\n[source](999999)",
      "ready": true
    },
    {
      "name": "indent4-code",
      "markdown": "    <div>\n    [source](999999)",
      "ready": true
    },
    {
      "name": "indent4-paragraph",
      "markdown": "prefix\n    <div>\n    [source](999999)",
      "ready": false
    },
    {
      "name": "quote-owned",
      "markdown": "> <div>\n> [source](999999)",
      "ready": true
    },
    {
      "name": "quote-exit",
      "markdown": "> <script>\n[source](999999)",
      "ready": false
    },
    {
      "name": "quote-blank-exit",
      "markdown": "> <div>\n\n[source](999999)",
      "ready": false
    },
    {
      "name": "nested-quote-exit",
      "markdown": "> > <script>\n> [source](999999)",
      "ready": false
    },
    {
      "name": "quote-paragraph-lazy",
      "markdown": "> prefix\n<custom>\n[source](999999)",
      "ready": false
    },
    {
      "name": "item-owned",
      "markdown": "- <div>\n  [source](999999)",
      "ready": true
    },
    {
      "name": "item-exit",
      "markdown": "- <script>\n[source](999999)",
      "ready": false
    },
    {
      "name": "item-sibling",
      "markdown": "- <script>\n  [source](999999)\n- [source](999999)",
      "ready": false
    },
    {
      "name": "nested-item-exit",
      "markdown": "- > <script>\n  [source](999999)",
      "ready": false
    },
    {
      "name": "fence-literal",
      "markdown": "```\n<div>\n[source](999999)\n```",
      "ready": true
    },
    {
      "name": "HTML-contains-fence",
      "markdown": "<div>\n```\n[source](999999)",
      "ready": true
    },
    {
      "name": "definition-in-HTML",
      "markdown": "<div>\n[x]: 999999\n\n[source][x]",
      "ready": true
    },
    {
      "name": "definition-outside-HTML",
      "markdown": "<div>\n\n[x]: 999999\n[source][x]",
      "ready": false
    },
    {
      "name": "ATX-next-type7",
      "markdown": "# heading\n<custom>\n[source](999999)",
      "ready": true
    },
    {
      "name": "setext-next-type7",
      "markdown": "heading\n===\n<custom>\n[source](999999)",
      "ready": true
    },
    {
      "name": "HTML-does-not-suppress-placeholder",
      "markdown": "<script>\n{999999}\n</script>",
      "ready": false
    }
  ]
};

test('pinned inline HTML and autolink grammar hides only complete real tokens without losing source links', () => {
  for (const entry of repair05GrammarCases.inline) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = 1; report.runs[0].results[0].message = { text: 'plain fallback', markdown: entry.markdown }; const before = canonical(report);
    if (entry.ready) assert.doesNotThrow(() => regionCheck(report), entry.name); else assert.throws(() => regionCheck(report), /typed message.*(?:source link|placeholder)/, entry.name);
    assert.equal(canonical(report), before);
  }
});

test('all seven raw HTML blocks retain exact owned paragraph container terminator and EOF semantics', () => {
  for (const entry of repair05GrammarCases.blocks) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = 1; report.runs[0].results[0].message = { text: 'plain fallback', markdown: entry.markdown }; const before = canonical(report);
    if (entry.ready) assert.doesNotThrow(() => regionCheck(report), entry.name); else assert.throws(() => regionCheck(report), /typed message.*(?:source link|placeholder)/, entry.name);
    assert.equal(canonical(report), before);
  }
});

test('literal HTML and invalid angle source activity apply independently to every full role route and complete-zero report', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const role of ['current', 'baseline']) for (const representation of ['report', 'server']) for (const zero of [false, true]) for (const html of ['<script>\n[source](999999)\n</script>', '<!--\n[source](999999)\n-->', '<?\n[source](999999)\n?>', '<!DOCTYPE [source](999999)>', '<![CDATA[\n[source](999999)\n]]>', '<div>\n[source](999999)', '<custom>\n[source](999999)']) for (const bad of [false, true]) {
    const f = fixture();
    if (zero) for (const value of [f.current, f.baseline]) { value.report.runs[0].results = []; value.server.runs[0].results = []; }
    f[role][representation].runs[0].graphs = [{ description: { text: 'fallback', markdown: bad ? html + '\n\n[source](999999)' : html } }];
    for (const value of [f.current, f.baseline]) sealRole(value);
    if (bad) await assert.rejects(publicOutcome(f), /typed message source link/); else assert.equal((await publicOutcome(f)).ready, true);
  }
});

test('a genuinely warmed valid block proof refuses observed cached server changes at its immutable custody fence', async () => {
  const f = processedFixture(), cache = new Map();
  for (const role of [f.current, f.baseline]) { role.server.runs[0].graphs = [{ description: { text: 'fallback', markdown: '<div>\n[source](999999)' } }]; sealRole(role); }
  assert.equal((await publicOutcome(f, cache)).ready, true); assert.equal([...cache.keys()].filter(key => key.startsWith('native:')).length, 2);
  for (const value of cache.values()) if (value?.sourceSha === f.current.sourceSha && value.server) value.server.runs[0].graphs[0].description.markdown = 'prefix <span [source](999999)>';
  await assert.rejects(publicOutcome(f, cache), /immutable producer authority identity conflicts across source\/attempt\/selection reads/);
});

function repair05LocaleFixture(f, kind) {
  const label = 'repair05/locale';
  for (const role of [f.current, f.baseline]) {
    for (const run of [role.report.runs[0], role.server.runs[0]]) {
      const owner = run.tool.extensions[0], rule = owner.rules[0];
      owner.shortDescription = { text: 'owner description' }; rule.shortDescription = { text: 'rule description' };
      owner.globalMessageStrings = { [label]: { text: '{999999}' } }; rule.messageStrings = { [label]: { text: '{999999}' } };
      run.results[0].message = { text: 'direct string wins', id: label };
      if (kind === 'missing-direct-key') delete rule.messageStrings[label];
      if (kind === 'bad-selector') run.results[0].rule.toolComponent.name = 'contradictory';
      if (kind === 'bad-direct-text') run.results[0].message.text = '{999999}';
      if (kind === 'bad-direct-markdown') run.results[0].message.markdown = '[source](999999)';
      if (kind === 'generic-unused') { delete run.results[0].message.id; run.artifacts[0].description = { text: 'direct generic metadata', id: label }; run.tool.driver.globalMessageStrings = { [label]: { text: '{999999}' } }; }
      if (!kind.startsWith('translation-')) continue;
      const translation = structuredClone(owner); delete translation.minimumRequiredLocalizedDataSemanticVersion;
      translation.language = 'fr-FR'; translation.associatedComponent = { index: 0, name: owner.name }; translation.translationMetadata = { name: 'complete test translation' };
      translation.localizedDataSemanticVersion = owner.minimumRequiredLocalizedDataSemanticVersion ?? owner.semanticVersion;
      translation.rules[0].messageStrings[label] = { text: 'actual translated message' };
      if (kind === 'translation-bad-used') translation.rules[0].messageStrings[label].text = '{999999}';
      if (kind === 'translation-default-version') delete translation.localizedDataSemanticVersion;
      if (kind === 'translation-unknown-unused') { delete translation.localizedDataSemanticVersion; delete translation.semanticVersion; translation.rules[0].messageStrings[label].text = '{999999}'; }
      if (kind === 'translation-incompatible-unused' || kind === 'translation-incompatible-incomplete') { translation.localizedDataSemanticVersion = '99.0.0'; translation.rules[0].messageStrings[label].text = '{999999}'; }
      if (kind === 'translation-same-language-unused') { translation.language = 'en-US'; translation.rules[0].messageStrings[label].text = '{999999}'; }
      if (kind === 'translation-missing-field' || kind === 'translation-incompatible-incomplete') delete translation.shortDescription;
      if (kind === 'translation-missing-key') delete translation.rules[0].messageStrings[label];
      if (kind === 'translation-forbidden-minimum') translation.minimumRequiredLocalizedDataSemanticVersion = owner.semanticVersion;
      if (kind === 'translation-extra-unused') translation.globalMessageStrings.extra = { text: '{999999}' };
      run.translations = [translation];
      if (kind === 'translation-second-bad') { const other = structuredClone(translation); other.name += ' alternate'; other.rules[0].messageStrings[label].text = '{999999}'; run.translations.push(other); }
    }
    sealRole(role);
  }
  return f;
}

test('direct string precedence descriptor key coverage and complete applicable localization remain independent', async () => {
  const denied = new Set(['missing-direct-key', 'bad-selector', 'bad-direct-text', 'bad-direct-markdown', 'translation-bad-used', 'translation-missing-field', 'translation-missing-key', 'translation-incompatible-incomplete', 'translation-forbidden-minimum', 'translation-second-bad']);
  const cases = ['direct-unused', 'generic-unused', ...denied, 'translation-good', 'translation-default-version', 'translation-unknown-unused', 'translation-incompatible-unused', 'translation-same-language-unused', 'translation-extra-unused'];
  for (const fixture of [processedFixture, strictSourceFixture]) for (const kind of cases) {
    const f = repair05LocaleFixture(fixture(), kind);
    if (denied.has(kind)) await assert.rejects(publicOutcome(f), /descriptor key|component|identity|placeholder|source link|translation|translated/);
    else { const cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true, kind); assert.equal((await publicOutcome(f, cache)).ready, true, kind + '/warm'); }
  }
});

test('missing optional localization versions do not invent usable foreign display or erase supplied completeness', () => {
  const report = regionReport({ charOffset: 0 }), run = report.runs[0], label = 'local';
  run.tool.driver.rules = [{ id: 'r', messageStrings: { [label]: { text: '{999999}' } } }]; run.results[0].message = { text: 'base direct text', id: label };
  const translation = structuredClone(run.tool.driver); translation.language = 'fr-FR'; translation.associatedComponent = { name: run.tool.driver.name }; translation.translationMetadata = { name: 'unversioned complete metadata' }; run.translations = [translation];
  const before = canonical(report); assert.doesNotThrow(() => regionCheck(report)); assert.equal(canonical(report), before);
  delete translation.rules[0].messageStrings[label]; assert.throws(() => regionCheck(report), /translation/);
});

test('column-zero unclosed comments remain literal while actual failed inline and code searches retain the96M bound', () => {
  for (const count of [1024, 10240]) { const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].message = { text: 'fallback', markdown: '<!--'.repeat(count) }; assert.doesNotThrow(() => regionCheck(report)); }
  const failed = regionReport({ charOffset: 0 }); failed.runs[0].results[0].message = { text: 'fallback', markdown: 'prefix ' + '<!--'.repeat(10240) }; assert.throws(() => regionCheck(failed), /typed source relation work bound/);
  const exact = regionReport({ charOffset: 0 }); exact.runs[0].results[0].message = { text: 'fallback', markdown: 'prefix ``[source](999999)`` and `[source](999999)`' }; assert.doesNotThrow(() => regionCheck(exact));
});


const repair06TableCases = [
  {
    "name": "valid-marker-0",
    "markdown": "a | b\n-|-\nx | y | [source](999999)",
    "ready": true,
    "basis": "Pinned marker/cell count; actual excess ignored"
  },
  {
    "name": "valid-marker-1",
    "markdown": "a | b\n--- | ---\nx | y | [source](999999)",
    "ready": true,
    "basis": "Pinned marker/cell count; actual excess ignored"
  },
  {
    "name": "valid-marker-2",
    "markdown": "a | b\n| - | - |\nx | y | [source](999999)",
    "ready": true,
    "basis": "Pinned marker/cell count; actual excess ignored"
  },
  {
    "name": "valid-marker-3",
    "markdown": "a | b\n:-:|:-\nx | y | [source](999999)",
    "ready": true,
    "basis": "Pinned marker/cell count; actual excess ignored"
  },
  {
    "name": "scanner-padding-32",
    "markdown": "a | b\n-: | :- \nx | y | [source](999999)",
    "ready": true,
    "basis": "Exact SP TAB VT FF marker/pipe-end class"
  },
  {
    "name": "interior-not-padding-32",
    "markdown": "a | b\n- -| -\nx | y | [source](999999)",
    "ready": false,
    "basis": "Padding cannot split hyphens"
  },
  {
    "name": "scanner-padding-9",
    "markdown": "a | b\n-:\t|\t:-\t\nx | y | [source](999999)",
    "ready": true,
    "basis": "Exact SP TAB VT FF marker/pipe-end class"
  },
  {
    "name": "interior-not-padding-9",
    "markdown": "a | b\n-\t-| -\nx | y | [source](999999)",
    "ready": false,
    "basis": "Padding cannot split hyphens"
  },
  {
    "name": "scanner-padding-11",
    "markdown": "a | b\n-:\u000b|\u000b:-\u000b\nx | y | [source](999999)",
    "ready": true,
    "basis": "Exact SP TAB VT FF marker/pipe-end class"
  },
  {
    "name": "interior-not-padding-11",
    "markdown": "a | b\n-\u000b-| -\nx | y | [source](999999)",
    "ready": false,
    "basis": "Padding cannot split hyphens"
  },
  {
    "name": "scanner-padding-12",
    "markdown": "a | b\n-:\f|\f:-\f\nx | y | [source](999999)",
    "ready": true,
    "basis": "Exact SP TAB VT FF marker/pipe-end class"
  },
  {
    "name": "interior-not-padding-12",
    "markdown": "a | b\n-\f-| -\nx | y | [source](999999)",
    "ready": false,
    "basis": "Padding cannot split hyphens"
  },
  {
    "name": "unicode-marker-edge-160",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-160",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-160",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-5760",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-5760",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-5760",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8192",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8192",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8192",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8193",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8193",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8193",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8194",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8194",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8194",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8195",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8195",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8195",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8196",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8196",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8196",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8197",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8197",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8197",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8198",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8198",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8198",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8199",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8199",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8199",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8200",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8200",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8200",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8201",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8201",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8201",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8202",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8202",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8202",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8232",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8232",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8232",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8233",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8233",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8233",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8239",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8239",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8239",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8287",
    "markdown": "a | b\n- |-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8287",
    "markdown": " | a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8287",
    "markdown": "| a | b | \n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-12288",
    "markdown": "a | b\n-　|-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-12288",
    "markdown": "　| a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-12288",
    "markdown": "| a | b |　\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-65279",
    "markdown": "a | b\n-﻿|-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-65279",
    "markdown": "﻿| a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-65279",
    "markdown": "| a | b |﻿\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-133",
    "markdown": "a | b\n-|-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-133",
    "markdown": "| a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-133",
    "markdown": "| a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "unicode-marker-edge-8203",
    "markdown": "a | b\n-​|-\nx | y | [source](999999)",
    "ready": false,
    "basis": "Non-marker character retained"
  },
  {
    "name": "unicode-header-leading-8203",
    "markdown": "​| a | b |\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic leading pipe/cell deletion"
  },
  {
    "name": "unicode-header-trailing-8203",
    "markdown": "| a | b |​\n| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "No synthetic trailing pipe/cell deletion"
  },
  {
    "name": "wrong-before-outer-pipe-11",
    "markdown": "a | b\n\u000b| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "Scanner padding cannot be moved before outer initial pipe"
  },
  {
    "name": "not-blank-row-11",
    "markdown": "a|b\n-|-\n\u000b\nx|y|[source](999999)",
    "ready": true,
    "basis": "VT FF-only row is not structural blank"
  },
  {
    "name": "wrong-before-outer-pipe-12",
    "markdown": "a | b\n\f| - | - |\nx | y | [source](999999)",
    "ready": false,
    "basis": "Scanner padding cannot be moved before outer initial pipe"
  },
  {
    "name": "not-blank-row-12",
    "markdown": "a|b\n-|-\n\f\nx|y|[source](999999)",
    "ready": true,
    "basis": "VT FF-only row is not structural blank"
  },
  {
    "name": "present-target-malformed",
    "markdown": "a | b\n- |-\nx | y | [source](1)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "no-link-malformed",
    "markdown": "a | b\n- |-\nx | y | ordinary Unicode text",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "used-cell",
    "markdown": "a|b\n-|-\nx|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "used-header",
    "markdown": "[source](999999)|b\n-|-\nx|y",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "missing-cell",
    "markdown": "a|b\n-|-\n[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "header-mismatch",
    "markdown": "a|b\n|-|\nx|y|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "empty-header",
    "markdown": "|\n|-|\nx|y|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "empty-cell-header",
    "markdown": "| |\n|-|\nx|[source](999999)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "no-data",
    "markdown": "a|b\n-|-\n",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "single-no-pipe",
    "markdown": "head\n:-\nvalue|[source](999999)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "single-outer-pipe",
    "markdown": "head\n|-|\nvalue|[source](999999)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "setext-first",
    "markdown": "head\n-\nvalue|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "thematic-first",
    "markdown": "a|b\n- - -\nx|y|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "bare-code-pipe",
    "markdown": "a|b\n-|-\nx`prefix|[source](999999)`",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "escaped-code-pipe",
    "markdown": "head\n|-|\n`prefix\\|[source](999999)`",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "code-in-used-cell",
    "markdown": "a|b\n-|-\nx|`[source](999999)`|[source](999999)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "image-inner-used",
    "markdown": "a|b\n-|-\nx|![alt [source](999999)](image.png)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "blank-ends",
    "markdown": "a|b\n-|-\nx|y\n\nx|y|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "quote-literal",
    "markdown": "> a|b\n> -|-\n> x|y|[source](999999)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "quote-end",
    "markdown": "> a|b\n> -|-\n> x|y\nx|y|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "list-literal",
    "markdown": "- a|b\n  -|-\n  x|y|[source](999999)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "list-sibling",
    "markdown": "- a|b\n  -|-\n  x|y\n- [source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "indent-not-extension",
    "markdown": "a|b\n    -|-\nx|y|[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "code-fence",
    "markdown": "```\na|b\n-|-\nx|y|[source](999999)\n```",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "html-literal",
    "markdown": "<div>\na|b\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "ATX-ends",
    "markdown": "a|b\n-|-\nx|y\n# [source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "reference-used",
    "markdown": "[r]: 999999\n\na|b\n-|-\nx|[r]",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "reference-overflow",
    "markdown": "[r]: 999999\n\na|b\n-|-\nx|y|[r]",
    "ready": true,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "entity-no-split",
    "markdown": "head\n|-|\nx&#124;[source](999999)",
    "ready": false,
    "basis": "Pinned table/inline/block stage boundary"
  },
  {
    "name": "terminal-parity-0",
    "markdown": "a|b|\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Single shared terminal separator classification"
  },
  {
    "name": "terminal-parity-1",
    "markdown": "a|b\\|\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Single shared terminal separator classification"
  },
  {
    "name": "middle-parity-1",
    "markdown": "a\\|b\n-|-\nx|y|[source](999999)",
    "ready": false,
    "basis": "Escaped punctuation pair consumes backslashes before pipe"
  },
  {
    "name": "terminal-parity-2",
    "markdown": "a|b\\\\|\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Single shared terminal separator classification"
  },
  {
    "name": "middle-parity-2",
    "markdown": "a\\\\|b\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Escaped punctuation pair consumes backslashes before pipe"
  },
  {
    "name": "terminal-parity-3",
    "markdown": "a|b\\\\\\|\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Single shared terminal separator classification"
  },
  {
    "name": "middle-parity-3",
    "markdown": "a\\\\\\|b\n-|-\nx|y|[source](999999)",
    "ready": false,
    "basis": "Escaped punctuation pair consumes backslashes before pipe"
  },
  {
    "name": "terminal-parity-4",
    "markdown": "a|b\\\\\\\\|\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Single shared terminal separator classification"
  },
  {
    "name": "middle-parity-4",
    "markdown": "a\\\\\\\\|b\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Escaped punctuation pair consumes backslashes before pipe"
  },
  {
    "name": "terminal-parity-5",
    "markdown": "a|b\\\\\\\\\\|\n-|-\nx|y|[source](999999)",
    "ready": true,
    "basis": "Single shared terminal separator classification"
  },
  {
    "name": "middle-parity-5",
    "markdown": "a\\\\\\\\\\|b\n-|-\nx|y|[source](999999)",
    "ready": false,
    "basis": "Escaped punctuation pair consumes backslashes before pipe"
  },
  {
    "name": "line-ending-\"\\r\"",
    "markdown": "a | b\r-|-\rx | y | [source](999999)",
    "ready": true,
    "basis": "Actual GFM line ending"
  },
  {
    "name": "line-ending-\"\\r\\n\"",
    "markdown": "a | b\r\n-|-\r\nx | y | [source](999999)",
    "ready": true,
    "basis": "Actual GFM line ending"
  }
];

test('table marker row and cell stages preserve exact pinned classes pipes and active paragraph fallbacks', () => {
  for (const entry of repair06TableCases) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = 1;
    report.runs[0].results[0].message = { text: 'plain fallback', markdown: entry.markdown };
    const before = canonical(report);
    if (entry.ready) assert.doesNotThrow(() => regionCheck(report), entry.name);
    else assert.throws(() => regionCheck(report), /typed message source link/, entry.name);
    assert.equal(canonical(report), before, entry.name + '/original');
  }
});

test('full native server roles and complete zero retain table semantics before either source route', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const roleName of ['current', 'baseline']) for (const representation of ['report', 'server']) for (const zero of [false, true]) for (const padding of ['\u00a0', ' ', '\v', '\f']) {
    const f = fixture();
    if (zero) for (const role of [f.current, f.baseline]) for (const rep of ['report', 'server']) role[rep].runs[0].results = [];
    f[roleName][representation].runs[0].graphs = [{ description: { text: 'plain fallback', markdown: 'a|b\n---' + padding + '|---\nx|y|[source](999999)' } }];
    for (const role of [f.current, f.baseline]) sealRole(role);
    const before = [f.current, f.baseline].map(role => [canonical(role.report), canonical(role.server)]);
    if (padding === '\u00a0') await assert.rejects(publicOutcome(f), /typed message source link/);
    else assert.equal((await publicOutcome(f)).ready, true);
    assert.deepEqual([f.current, f.baseline].map(role => [canonical(role.report), canonical(role.server)]), before);
  }
});

test('actually used templates and once substituted arguments do not hide nonmarker Unicode as table padding', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const padding of ['\u00a0', '\f', '\v', '\t']) {
    const f = fixture();
    for (const role of [f.current, f.baseline]) {
      for (const run of [role.report.runs[0], role.server.runs[0]]) {
        run.tool.extensions[0].globalMessageStrings = { table: { text: 'plain fallback', markdown: 'a|b\n---{0}|---\nx|y|[source](999999)' } };
        run.results[0].locations[0].message = { id: 'table', arguments: [padding] };
      }
      sealRole(role);
    }
    if (padding === '\u00a0') await assert.rejects(publicOutcome(f), /typed message source link/);
    else assert.equal((await publicOutcome(f)).ready, true);
  }
});

test('valid table cache repeats remain valid and observed changes refuse at actual immutable custody', async () => {
  const f = processedFixture();
  for (const role of [f.current, f.baseline]) {
    for (const run of [role.report.runs[0], role.server.runs[0]]) run.graphs = [{ description: { text: 'plain fallback', markdown: 'a|b\n-\f|-\nx|y|[source](999999)' } }];
    sealRole(role);
  }
  const cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true);
  assert.equal([...cache.keys()].filter(key => key.startsWith('native:')).length, 2);
  assert.equal((await publicOutcome(f, cache)).ready, true);
  const current = [...cache.values()].find(value => value?.sourceSha === f.current.sourceSha && value?.server);
  assert.ok(current); current.server.runs[0].graphs[0].description.markdown = 'a|b\n-\u00a0|-\nx|y|[source](999999)';
  await assert.rejects(publicOutcome(f, cache), /immutable|source raw-body\/object identity|complete artifact member/);
});

test('table overflow semantics never suppress plain message obligations and argument syntax is substituted once', () => {
  const report = regionReport({ charOffset: 0 });
  report.runs[0].results[0].message = { text: 'a|b\n-|-\nx|y|[source](999999)' };
  assert.throws(() => regionCheck(report), /typed message source link/);
  report.runs[0].results[0].message = { text: 'plain fallback', markdown: 'a|b\n---{0}|---\nx|y|[source](999999)', arguments: ['\u00a0'] };
  assert.throws(() => regionCheck(report), /typed message source link/);
  report.runs[0].results[0].message.arguments = ['\f'];
  assert.doesNotThrow(() => regionCheck(report));
});

test('table scans charge ignored and failed regions under the original finite work ceiling', () => {
  const report = regionReport({ charOffset: 0 });
  report.runs[0].results[0].message = { text: 'plain fallback', markdown: 'a|b\n-|-\nx' + ' '.repeat(3000) + '|y|[source](999999)' };
  assert.doesNotThrow(() => regionCheck(report));
  report.runs[0].results[0].message.markdown = 'a|b\n-|-\nx' + ' '.repeat(6000000) + '|y|[source](999999)';
  assert.throws(() => regionCheck(report), /work bound exceeded/);
});

// Repair07: exact owned table/code lifecycle and current direct-child finalization.
const repair07LifecycleCases = [
  {
    "name": "L01_reference_only_one_blank",
    "markdown": "- [r]: /ordinary\n\n    [source](999999)",
    "ready": false
  },
  {
    "name": "L02_reference_only_two_blanks",
    "markdown": "- [r]: /ordinary\n\n\n    [source](999999)",
    "ready": true
  },
  {
    "name": "L03_content_paragraph_two_blanks",
    "markdown": "- content\n\n\n    [source](999999)",
    "ready": false
  },
  {
    "name": "L04_reference_prefix_plus_content",
    "markdown": "- [r]: /ordinary\n  content\n\n\n    [source](999999)",
    "ready": false
  },
  {
    "name": "L05_never_child_empty_item",
    "markdown": "-\n\n    [source](999999)",
    "ready": true
  },
  {
    "name": "L06_prior_persistent_heading",
    "markdown": "- # prior\n\n  [r]: /ordinary\n\n\n    [source](999999)",
    "ready": false
  },
  {
    "name": "L07_quote_two_blanks",
    "markdown": "> - [r]: /ordinary\n>\n>\n>     [source](999999)",
    "ready": true
  },
  {
    "name": "L08_quote_one_blank",
    "markdown": "> - [r]: /ordinary\n>\n>     [source](999999)",
    "ready": false
  },
  {
    "name": "L09_item_persistent_quote",
    "markdown": "- > [r]: /ordinary\n  >\n\n    [source](999999)",
    "ready": false
  },
  {
    "name": "L10_outer_persistent_list",
    "markdown": "- - [r]: /ordinary\n\n\n    [source](999999)",
    "ready": false
  },
  {
    "name": "L11_partial_tab_one_blank",
    "markdown": "- [r]: /ordinary\n\n\t[source](999999)",
    "ready": false
  },
  {
    "name": "L12_partial_tab_two_blanks",
    "markdown": "- [r]: /ordinary\n\n\n\t[source](999999)",
    "ready": true
  },
  {
    "name": "L13_quote_partial_tab_two_blanks",
    "markdown": "> - [r]: /ordinary\n>\n>\n>\t  [source](999999)",
    "ready": true
  },
  {
    "name": "L14_quote_partial_tab_one_blank",
    "markdown": "> - [r]: /ordinary\n>\n>\t  [source](999999)",
    "ready": false
  },
  {
    "name": "L15_table_header_conversion",
    "markdown": "- [r]: /ordinary\n  ---|\n\n\n    [source](999999)",
    "ready": false
  },
  {
    "name": "L16_without_table_conversion",
    "markdown": "- [r]: /ordinary\n\n\n    [source](999999)",
    "ready": true
  },
  {
    "name": "L17_deleted_reference_still_registered",
    "markdown": "- [r]: 999999\n\n    [r]",
    "ready": false
  },
  {
    "name": "L18_deleted_reference_later_literal",
    "markdown": "- [r]: 999999\n\n\n    [r]",
    "ready": true
  }
];
const repair07CodeCases = [
  {
    "name": "four-space-end",
    "markdown": "a|b\n---|---\n    code\nx|y|[source](999999)",
    "ready": false
  },
  {
    "name": "tab-end",
    "markdown": "a|b\n---|---\n\tcode\nx|y|[source](999999)",
    "ready": false
  },
  {
    "name": "five-space-end",
    "markdown": "a|b\n---|---\n     code\nx|y|[source](999999)",
    "ready": false
  },
  {
    "name": "space-tab-end",
    "markdown": "a|b\n---|---\n \tcode\nx|y|[source](999999)",
    "ready": false
  },
  {
    "name": "literal-code",
    "markdown": "a|b\n---|---\n    [source](999999)",
    "ready": true
  },
  {
    "name": "three-space-table",
    "markdown": "a|b\n---|---\n   x|y|[source](999999)",
    "ready": true
  },
  {
    "name": "dedented-resolved",
    "markdown": "a|b\n---|---\n    code\nx|y|[source](0)",
    "ready": true
  },
  {
    "name": "paragraph-hanging-indent",
    "markdown": "text\n    [source](999999)",
    "ready": false
  },
  {
    "name": "quote-code-dedent",
    "markdown": "> a|b\n> ---|---\n>     code\n> x|y|[source](999999)",
    "ready": false
  },
  {
    "name": "item-table-code",
    "markdown": "- a|b\n  ---|---\n      [source](999999)",
    "ready": true
  },
  {
    "name": "item-tab-two-relative",
    "markdown": "- a|b\n  ---|---\n\tx|y|[source](999999)",
    "ready": true
  },
  {
    "name": "item-tab-four-relative",
    "markdown": "- a|b\n  ---|---\n\t  [source](999999)",
    "ready": true
  },
  {
    "name": "item-tab-four-then-dedent",
    "markdown": "- a|b\n  ---|---\n\t  code\n  x|y|[source](999999)",
    "ready": false
  },
  {
    "name": "quote-partial-tab-code",
    "markdown": "> a|b\n> ---|---\n>\t  [source](999999)",
    "ready": true
  },
  {
    "name": "quote-partial-tab-table",
    "markdown": "> a|b\n> ---|---\n>\tx|y|[source](999999)",
    "ready": true
  },
  {
    "name": "code-separated-chunks",
    "markdown": "a|b\n---|---\n    one\n\n    [source](999999)",
    "ready": true
  },
  {
    "name": "new-header-after-code",
    "markdown": "a|b\n---|---\n    code\nc|d\n---|---\nx|y|[source](999999)",
    "ready": true
  },
  {
    "name": "no-stale-table",
    "markdown": "a|b\n---|---\n    code\nx|y|[source](999999)\n---|---",
    "ready": false
  }
];

test('established tables yield to actual relative code and dedented paragraphs without rewriting findings', () => {
  for (const entry of repair07CodeCases) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = 0;
    report.runs[0].results[0].message = { text: 'plain fallback', markdown: entry.markdown };
    const before = canonical(report);
    if (entry.ready) assert.doesNotThrow(() => regionCheck(report), entry.name);
    else assert.throws(() => regionCheck(report), /typed message source link/, entry.name);
    assert.equal(canonical(report), before, entry.name + '/original');
  }
});

test('current direct children distinguish provisional reference paragraphs persistent containers and repeated blanks', () => {
  for (const entry of repair07LifecycleCases) {
    const report = regionReport({ charOffset: 0 }); report.runs[0].results[0].locations[0].id = 0;
    report.runs[0].results[0].message = { text: 'plain fallback', markdown: entry.markdown };
    const before = canonical(report);
    if (entry.ready) assert.doesNotThrow(() => regionCheck(report), entry.name);
    else assert.throws(() => regionCheck(report), /typed message source link/, entry.name);
    assert.equal(canonical(report), before, entry.name + '/original');
    report.runs[0].results[0].message.markdown = entry.markdown.replaceAll('999999', '0');
    assert.doesNotThrow(() => regionCheck(report), entry.name + '/own-target');
  }
});

test('table and setext conversion retain actual nonparagraph kind before reference registration', () => {
  for (const marker of ['---', '===', '---|']) {
    const report = regionReport({ charOffset: 0 });
    report.runs[0].results[0].message = { text: 'plain fallback', markdown: '[r]: 999999\n' + marker + '\n\n[r]' };
    assert.doesNotThrow(() => regionCheck(report), marker + '/converted-not-global-definition');
    report.runs[0].results[0].message.markdown = '[source](999999)\n' + marker;
    assert.throws(() => regionCheck(report), /typed message source link/, marker + '/converted-active-inline');
  }
  const report = regionReport({ charOffset: 0 });
  report.runs[0].results[0].message = { text: 'plain fallback', markdown: '[r]: 999999\n\n[r]' };
  assert.throws(() => regionCheck(report), /typed message source link/, 'ordinary paragraph definition remains global');
});

test('both native server roles routes and complete zero validate code boundaries before source equivalence', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const roleName of ['current', 'baseline']) for (const representation of ['report', 'server']) for (const zero of [false, true]) for (const literal of [false, true]) {
    const f = fixture();
    if (zero) for (const role of [f.current, f.baseline]) for (const rep of ['report', 'server']) role[rep].runs[0].results = [];
    f[roleName][representation].runs[0].graphs = [{ description: { text: 'plain fallback', markdown: 'a|b\n---|---\n    ' + (literal ? '[source](999999)' : 'code\nx|y|[source](999999)') } }];
    for (const role of [f.current, f.baseline]) sealRole(role);
    const before = [f.current, f.baseline].map(role => [canonical(role.report), canonical(role.server)]);
    if (literal) assert.equal((await publicOutcome(f)).ready, true);
    else await assert.rejects(publicOutcome(f), /typed message source link/);
    assert.deepEqual([f.current, f.baseline].map(role => [canonical(role.report), canonical(role.server)]), before);
  }
});

test('actually used descendant template indentation arguments cross the real relative code boundary', async () => {
  for (const fixture of [processedFixture, strictSourceFixture]) for (const columns of [3, 4]) {
    const f = fixture();
    for (const role of [f.current, f.baseline]) {
      for (const run of [role.report.runs[0], role.server.runs[0]]) {
        run.tool.extensions[0].globalMessageStrings = { code: { text: 'plain fallback', markdown: 'a|b\n---|---\n{0}code\nx|y|[source](999999)' } };
        run.results[0].locations[0].message = { id: 'code', arguments: [' '.repeat(columns)] };
      }
      sealRole(role);
    }
    if (columns === 3) assert.equal((await publicOutcome(f)).ready, true);
    else await assert.rejects(publicOutcome(f), /typed message source link/);
  }
});

test('valid code cache repeats stay valid and observed changed cached source refuses at immutable custody', async () => {
  const f = processedFixture();
  for (const role of [f.current, f.baseline]) {
    for (const run of [role.report.runs[0], role.server.runs[0]]) run.graphs = [{ description: { text: 'plain fallback', markdown: 'a|b\n---|---\n    [source](999999)' } }];
    sealRole(role);
  }
  const cache = new Map(); assert.equal((await publicOutcome(f, cache)).ready, true);
  assert.equal([...cache.keys()].filter(key => key.startsWith('native:')).length, 2);
  assert.equal((await publicOutcome(f, cache)).ready, true);
  const current = [...cache.values()].find(value => value?.sourceSha === f.current.sourceSha && value?.server);
  assert.ok(current); current.server.runs[0].graphs[0].description.markdown = 'a|b\n---|---\n    code\nx|y|[source](999999)';
  await assert.rejects(publicOutcome(f, cache), /immutable|source raw-body\/object identity|complete artifact member/);
});

test('ignored literal code repeated blanks and owner scans remain within the original work ceiling', () => {
  const report = regionReport({ charOffset: 0 });
  report.runs[0].results[0].message = { text: 'plain fallback', markdown: 'a|b\n---|---\n    ' + 'x'.repeat(3000) + '[source](999999)' };
  assert.doesNotThrow(() => regionCheck(report));
  report.runs[0].results[0].message.markdown = 'a|b\n---|---\n    ' + 'x'.repeat(6000000) + '[source](999999)';
  assert.throws(() => regionCheck(report), /work bound exceeded/);
});

test('HTTP comparison transport dispatches only the canonical approved collector path without coercion', async () => {
  const path = `repos/${sourcePolicy.repository}/compare/${prior}...${sha}?per_page=100`, comparison = proofFixture().comparison;
  const body = Buffer.from(canonical(comparison)), dispatches = [];
  const request = githubReader({ token: 'fixture-only', fetchImpl: async (url, options) => {
    dispatches.push(url.href);
    assert.equal(url.href, `https://api.github.com/${path}`);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.authorization, 'Bearer fixture-only');
    assert.equal(options.headers.accept, 'application/vnd.github+json');
    assert.equal(options.headers['accept-encoding'], 'identity');
    assert.equal(options.headers['X-GitHub-Api-Version'], '2022-11-28');
    return new Response(body, { headers: { 'content-type': 'application/json', 'content-length': String(body.length), 'content-encoding': 'identity' } });
  } });
  const response = await request(path);
  assert.deepEqual(response.data, comparison); assert.equal(response.hasNext, false);
  assert.equal(response.bodySha256, digest(body)); assert.equal(response.bodyBytes, body.length);
  assert.deepEqual(dispatches, [`https://api.github.com/${path}`]);
  let coercions = 0;
  for (const invalid of [
    `/${path}`, `//api.github.com/${path}`, `https://api.github.com/${path}`, `https://evil.example/${path}`,
    path.replace(sourcePolicy.repository, 'other/Project-Cortex'), path.replace(sourcePolicy.repository, 'SaintNick1214/other'),
    path.replace(sourcePolicy.repository, sourcePolicy.repository.toLowerCase()),
    path.replace(prior, prior.toUpperCase()), path.replace(sha, sha.toUpperCase()),
    path.replace(prior, prior.slice(1)), path.replace(sha, sha + 'a'), path.replace(prior, 'main'),
    path.replace('...', '..'), path.replace('...', '....'), path.replace(prior, '%62' + prior.slice(1)),
    path.replace('/compare/', '/contents/../compare/'), path.replace('/compare/', '/compare/../'),
    `repos/${sourcePolicy.repository}/contents/../package.json`,
    path.replace('?per_page=100', ''), path.replace('per_page=100', 'per_page=99'),
    path.replace('per_page=100', 'per_page=0100'), path + '&page=1', path + '&other=1',
    path + '#fragment', path + '/', path + '\n', path + '\r\n', path + ' ', '\t' + path,
    null, undefined, 42, Object(path), { toString() { coercions++; return path; } },
  ]) await assert.rejects(request(invalid), /relative GitHub GET required/);
  assert.equal(coercions, 0); assert.equal(dispatches.length, 1, 'every noncanonical path refuses before fetch');
});

test('approved comparison transport retains HTTP body pagination redirect and deadline guards', async () => {
  const path = `repos/${sourcePolicy.repository}/compare/${prior}...${sha}?per_page=100`;
  for (const [body, init, maxBytes, error] of [
    ['{}', { status: 403 }, proofLimits.metadata, /read failed \(403\)/],
    ['{}', { status: 302, headers: { location: 'https://github.com/object' } }, proofLimits.metadata, /unexpected API redirect/],
    ['{"duplicate":1,"duplicate":2}', {}, proofLimits.metadata, /duplicate JSON/],
    ['{}', { headers: { 'content-length': '3' } }, proofLimits.metadata, /truncated response body/],
    ['{}', { headers: { 'content-length': '2' } }, 1, /response size exceeds bound/],
    ['{}', { headers: { 'content-encoding': 'gzip' } }, proofLimits.metadata, /unsupported encoded HTTP body/],
    ['{}', { headers: { link: '<https://api.github.com/page2>; rel=next' } }, proofLimits.metadata, /malformed pagination link/],
  ]) {
    let dispatches = 0;
    const request = githubReader({ token: 'fixture-only', fetchImpl: async () => { dispatches++; return new Response(body, init); } });
    await assert.rejects(request(path, { maxBytes }), error); assert.equal(dispatches, 1);
  }
  let clock = 0, dispatches = 0;
  const request = githubReader({ token: 'fixture-only', now: () => clock, fetchImpl: async () => { dispatches++; return new Response('{}'); } });
  clock = proofLimits.deadlineMs;
  await assert.rejects(request(path), /collection deadline expired/); assert.equal(dispatches, 0);
});

// The original complete fixture supplies bytes to fetch; the real HTTP reader
// remains the request passed to the collector, including all format/body guards.
function transportFixtureReader(fixture, { comparisonHasNext = false } = {}) {
  const dispatches = [];
  const request = githubReader({ token: 'fixture-only', fetchImpl: async (url, options) => {
    const path = url.pathname.slice(1) + url.search;
    assert.equal(url.origin, 'https://api.github.com'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.authorization, 'Bearer fixture-only'); assert.equal(options.headers['accept-encoding'], 'identity');
    assert.equal(options.headers['X-GitHub-Api-Version'], '2022-11-28'); assert.equal(options.signal.aborted, false);
    const format = options.headers.accept === 'application/sarif+json' ? 'sarif' : url.pathname.endsWith('/zip') ? 'bytes' : url.pathname.endsWith('/logs') ? 'text' : 'json';
    assert.equal(options.headers.accept, format === 'sarif' ? 'application/sarif+json' : 'application/vnd.github+json');
    const response = await fixture.request(path, { format });
    const body = format === 'sarif' ? response.raw : format === 'bytes' ? response.data : Buffer.from(format === 'text' ? response.data : canonical(response.data));
    assert.ok(Buffer.isBuffer(body));
    const hasNext = response.hasNext || comparisonHasNext && url.pathname.includes('/compare/');
    const headers = { 'content-length': String(body.length), 'content-encoding': 'identity', 'content-type': format === 'sarif' ? 'application/sarif+json' : format === 'bytes' ? 'application/zip' : format === 'text' ? 'text/plain; charset=utf-8' : 'application/json' };
    if (hasNext) { const next = new URL(url); next.searchParams.set('page', String(Number(next.searchParams.get('page') ?? 1) + 1)); headers.link = `<${next.href}>; rel="next"`; }
    else if (url.searchParams.has('page')) headers.link = `<${url.href}>; rel="last"`;
    dispatches.push({ path, format, bodySha256: digest(body), bodyBytes: body.length, hasNext });
    return new Response(body, { status: 200, headers });
  } });
  return { request, dispatches };
}

test('real HTTP reader and delivery snapshot compose with complete original processed and strict objects', async () => {
  for (const factory of [processedFixture, strictSourceFixture]) {
    const f = factory(), cache = new Map(), transport = transportFixtureReader(f);
    const before = canonical([f.comparison, f.current.report, f.current.server, f.baseline.report, f.baseline.server]);
    const snapshot = await readDeliverySnapshot({ request: transport.request, repository: sourcePolicy.repository, sourceSha: sha, cache });
    const result = deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository });
    assert.equal(result.ready, true); assert.deepEqual(result.reasons, []); assert.equal(result.checksRun, 10);
    assert.equal(result.qualification.label, factory === processedFixture ? serverExportProfile.label : 'qualified-source-equivalence');
    assert.equal(result.prerequisites.find(item => item.name === 'CodeQL').state, 'missing');
    assert.equal(result.prerequisites.find(item => item.name === sourcePolicy.snykContext).state, 'missing');
    assert.deepEqual(transport.dispatches.filter(item => item.path.includes('/compare/')).map(item => item.path), [`repos/${sourcePolicy.repository}/compare/${prior}...${sha}?per_page=100`]);
    assert.deepEqual(snapshot.sourceProof.headChecks, f.headChecks); assert.deepEqual(snapshot.sourceProof.headStatuses, f.headStatuses);
    assert.deepEqual(snapshot.runs, f.ownRuns); assert.equal(snapshot.deliveryArtifact.id, f.deliveryArtifact.id);
    for (const [name, role] of [['current', f.current], ['baseline', f.baseline]]) {
      const cached = [...cache.values()].find(value => value?.sourceSha === role.sourceSha && value.report && value.server);
      assert.ok(cached); assert.deepEqual(cached.report, role.report); assert.deepEqual(cached.server, role.server);
      assert.deepEqual(cached.zip, role.zip); assert.deepEqual(cached.serverBytes, role.serverBytes);
      const exported = result.qualification.findings.serverExports[name];
      assert.equal(exported.serverBodySha256, digest(role.serverBytes)); assert.equal(exported.serverObjectSha256, digest(canonical(role.server)));
      assert.equal(exported.nativeZipSha256, digest(role.zip));
      assert.equal(exported.sarifStandardConformance, factory === strictSourceFixture);
      assert.ok(transport.dispatches.some(item => item.path.endsWith(`/artifacts/${role.artifact.id}/zip`) && item.format === 'bytes' && item.bodySha256 === digest(role.zip)));
      assert.ok(transport.dispatches.some(item => item.path.endsWith(`/analyses/${role.analysis.id}`) && item.format === 'sarif' && item.bodySha256 === digest(role.serverBytes)));
      assert.ok(transport.dispatches.some(item => item.path.endsWith(`/jobs/${role.job.id}/logs`) && item.format === 'text' && item.bodySha256 === digest(role.log)));
      if (factory === processedFixture) assert.deepEqual(exported.classes[0].related[1].serverOriginal.message, {});
    }
    assert.equal(transport.dispatches.length, f.requests.length);
    assert.equal(canonical([f.comparison, f.current.report, f.current.server, f.baseline.report, f.baseline.server]), before);
  }
});

test('composed HTTP comparison refuses incomplete pages and preserves explicit main failure vetoes with cached proof', async () => {
  const incomplete = processedFixture(), truncated = transportFixtureReader(incomplete, { comparisonHasNext: true });
  await assert.rejects(readDeliverySnapshot({ request: truncated.request, repository: sourcePolicy.repository, sourceSha: sha }), /truncated source comparison/);
  assert.equal(truncated.dispatches.filter(item => item.path.includes('/compare/') && item.hasNext).length, 1);
  for (const veto of ['check', 'status', 'workflow']) {
    const f = processedFixture(), cache = new Map(), transport = transportFixtureReader(f);
    const collect = () => readDeliverySnapshot({ request: transport.request, repository: sourcePolicy.repository, sourceSha: sha, cache });
    assert.equal(deliveryReady({ ...await collect(), sourceSha: sha, repository: sourcePolicy.repository }).ready, true);
    assert.equal([...cache.keys()].filter(key => key.startsWith('native:')).length, 2);
    if (veto === 'check') f.checks = [headCheck({ head_sha: sha, conclusion: 'failure' })];
    if (veto === 'status') f.statuses = [headStatus({ url: `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sha}`, state: 'failure' })];
    if (veto === 'workflow') f.ownRuns[1].conclusion = 'failure';
    transport.dispatches.length = 0;
    const snapshot = await collect(), result = deliveryReady({ ...snapshot, sourceSha: sha, repository: sourcePolicy.repository });
    assert.equal(result.ready, false); assert.equal(result.qualification, undefined); assert.equal(snapshot.sourceProof, undefined);
    const name = veto === 'check' ? 'CodeQL' : veto === 'status' ? sourcePolicy.snykContext : 'Security Scans';
    assert.equal(result.prerequisites.find(item => item.name === name).state, 'failed');
    assert.ok(!transport.dispatches.some(item => /\/compare\/|\/code-scanning\//.test(item.path)), 'cached proof cannot override a genuine main failure');
  }
});

// Exercise real receipt FDs and filesystem mutations in an isolated child.
function actualReceiptFdProbe(root, mode) {
  const writer = new URL('../scripts/release-readiness.mjs', import.meta.url).href;
  const code = `import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{syncBuiltinESMExports}from'node:module';
    const root=${JSON.stringify(root)},mode=${JSON.stringify(mode)};
    const native={open:fs.openSync,close:fs.closeSync,read:fs.readFileSync,lstat:fs.lstatSync,utimes:fs.utimesSync,unlink:fs.unlinkSync,symlink:fs.symlinkSync,write:fs.writeFileSync,realpath:fs.realpathSync};
    const live=new Map(),opens=[],metadata=[];let tracking=false,changed=false,foreign;
    const adversary=action=>{const previous=tracking;tracking=false;try{return action();}finally{tracking=previous;}};
    const destination=root+'/receipt.json',outside=root+'/outside.json';
    native.write(outside,'outside remains unchanged',{mode:0o600});
    fs.openSync=(path,flags,...args)=>{const fd=native.open(path,flags,...args);if(tracking){const event={path:String(path),flags,reads:0};live.set(fd,event);opens.push(event);}return fd;};
    fs.closeSync=fd=>{const result=native.close(fd);if(tracking)live.delete(fd);return result;};
    fs.readFileSync=(file,...args)=>{if(tracking&&typeof file!=='number'&&/\\/(?:receipt\\.tmp|receipt\\.json)$/.test(String(file)))throw new Error('receipt content must use its original opened FD');const bytes=native.read(file,...args);if(tracking&&typeof file==='number'&&live.has(file))live.get(file).reads++;return bytes;};
    fs.lstatSync=(path,...args)=>{
      const name=String(path);
      if(tracking&&/\\/(?:receipt\\.tmp|receipt\\.json)$/.test(name)){
        assert.match(name,/^\\/proc\\/self\\/fd\\/\\d+\\/(?:receipt\\.tmp|receipt\\.json)$/);metadata.push(name);
        if(!changed&&mode==='latest-time'&&name.endsWith('/receipt.json')){
          changed=true;adversary(()=>{native.utimes(path,new Date(0),new Date(0));foreign={path:destination,stat:native.lstat(path),bytes:native.read(path)};});
        }
        if(!changed&&mode==='latest-symlink'&&name.endsWith('/receipt.json')){
          changed=true;adversary(()=>{native.unlink(path);native.symlink(outside,path);foreign={path:destination,stat:native.lstat(path),target:outside};});
        }
        if(!changed&&mode==='temp-foreign'&&name.endsWith('/receipt.tmp')){
          changed=true;adversary(()=>{const physical=native.realpath(path);native.unlink(path);native.write(path,'foreign temporary bytes',{mode:0o600});foreign={path:physical,stat:native.lstat(path),bytes:native.read(path)};});
        }
      }
      return native.lstat(path,...args);
    };
    syncBuiltinESMExports();const{writeReadinessReceipt}=await import(${JSON.stringify(writer)});
    const before=fs.readdirSync('/proc/self/fd').length;tracking=true;let receipt,error;
    try{receipt=writeReadinessReceipt({ready:true,qualification:{findings:{ordered:[1,'1',null,false]}}},{path:destination});}catch(caught){error=caught;}tracking=false;
    assert.equal(live.size,0,'all opened content/directory descriptors close');assert.equal(fs.readdirSync('/proc/self/fd').length,before);
    const temporary=opens.filter(event=>event.path.endsWith('/receipt.tmp')),installed=opens.filter(event=>event.path.endsWith('/receipt.json'));
    assert.equal(temporary.length,1,'only the exclusive temporary creation opens that leaf');
    assert.equal(temporary[0].flags&fs.constants.O_EXCL,fs.constants.O_EXCL);assert.equal(temporary[0].flags&fs.constants.O_NOFOLLOW,fs.constants.O_NOFOLLOW);
    for(const event of installed){assert.equal(event.reads,1,'one content read uses each original installed FD');assert.equal(event.flags&fs.constants.O_NOFOLLOW,fs.constants.O_NOFOLLOW);}
    if(mode==='success'){
      assert.equal(error,undefined);assert.equal(installed.length,2);assert.equal(metadata.filter(name=>name.endsWith('/receipt.json')).length,2);assert.equal(metadata.filter(name=>name.endsWith('/receipt.tmp')).length,1);
      const bytes=native.read(destination);assert.equal(receipt.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(receipt.bytes,bytes.length);assert.deepEqual(JSON.parse(bytes).payload.qualification.findings.ordered,[1,'1',null,false]);
      assert.deepEqual(fs.readdirSync(root).sort(),['outside.json','receipt.json']);
    }else{
      assert.equal(changed,true,'the actual metadata boundary was reached');assert.match(error?.message??'',/receipt inode\\/mode\\/link\\/content changed while reading|temporary receipt alias was substituted/);
      const actual=native.lstat(foreign.path);for(const field of ['dev','ino','uid','gid','mode','nlink','size','mtimeMs','ctimeMs'])assert.equal(actual[field],foreign.stat[field],field+' preserves foreign metadata');
      if(foreign.target){assert.equal(actual.isSymbolicLink(),true);assert.equal(fs.readlinkSync(foreign.path),foreign.target);}else assert.deepEqual(native.read(foreign.path),foreign.bytes);
      assert.ok(fs.readdirSync(root).some(name=>name.startsWith('.readiness-')),'uncertain staging names are preserved on failure');
    }
    assert.equal(native.read(outside,'utf8'),'outside remains unchanged');
    console.log(JSON.stringify({mode,temporaryOpens:temporary.length,installedOpens:installed.length,installedFdReads:installed.reduce((sum,event)=>sum+event.reads,0),denied:!!error,liveFds:live.size,foreignPreserved:!!foreign}));`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
}

test('actual receipt custody opens each content leaf once and checks identity using anchored metadata', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'cortex-receipt-fd-once-'));
  try {
    const run = actualReceiptFdProbe(directory, 'success');
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), { mode: 'success', temporaryOpens: 1, installedOpens: 2, installedFdReads: 2, denied: false, liveFds: 0, foreignPreserved: false });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('actual metadata fences refuse changed installed state and preserve foreign leaves with all FDs closed', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'cortex-receipt-fd-metadata-'));
  try {
    for (const mode of ['latest-time', 'latest-symlink', 'temp-foreign']) {
      const root = resolve(directory, mode); mkdirSync(root);
      const run = actualReceiptFdProbe(root, mode);
      assert.equal(run.status, 0, `${mode}: ${run.stderr}`);
      assert.deepEqual(JSON.parse(run.stdout), { mode, temporaryOpens: 1, installedOpens: 1, installedFdReads: 1, denied: true, liveFds: 0, foreignPreserved: true });
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

// SYNTHETIC successor-profile fixtures only. These exercise parser outcomes;
// they are not actual CodeQL observations and never edit retained raw evidence.
const syntheticCleanupId = 'codeql-action/toolcache-bundle-cleanup';
function syntheticEngineRole(role, engine = '2.27.4', cleanup = false) {
  for (const report of [role.report, role.server]) {
    const driver = report.runs[0].tool.driver;
    driver.semanticVersion = engine;
    if (engine === '2.27.4' || cleanup) driver.notifications.push({ id: syntheticCleanupId });
  }
  role.analysis.tool.version = engine;
  if (cleanup) role.report.runs[0].invocations[0].toolExecutionNotifications.push({
    message: { text: '' }, level: 'none', timeUtc: '2026-11-02T10:00:30.123Z',
    descriptor: { id: syntheticCleanupId, index: 4 },
    properties: { attributes: { deletedVersions: ['2.27.3'], failed: false }, visibility: { statusPage: false, telemetry: true } },
  });
  return sealRole(role);
}
function syntheticEngineFixture(engine = '2.27.4', cleanup = false) {
  const fixture = proofFixture();
  for (const role of [fixture.current, fixture.baseline]) syntheticEngineRole(role, engine, cleanup);
  return fixture;
}
const syntheticCleanupNote = role => role.report.runs[0].invocations[0].toolExecutionNotifications.find(note => note.descriptor.id === syntheticCleanupId);

test('SYNTHETIC supported engine list is explicit and frozen while the legacy fixture engine stays pinned', () => {
  assert.equal(sourcePolicy.engine, '2.27.3');
  assert.deepEqual(sourcePolicy.engines, ['2.27.3', '2.27.4']);
  assert.equal(Object.isFrozen(sourcePolicy), true); assert.equal(Object.isFrozen(sourcePolicy.engines), true);
  assert.throws(() => sourcePolicy.engines.push('2.27.5'), TypeError);
  assert.throws(() => sourcePolicy.engines[0] = '2.27.5', TypeError);
  assert.throws(() => sourcePolicy.engines = ['2.27.5'], TypeError);
  assert.equal(nativeRole(sha, 20).report.runs[0].tool.driver.semanticVersion, '2.27.3');
});

test('SYNTHETIC legacy and successor pairs retain complete coverage and original findings with optional cleanup', async () => {
  for (const [engine, cleanup] of [['2.27.3', false], ['2.27.4', false], ['2.27.4', true]]) {
    const f = syntheticEngineFixture(engine, cleanup);
    const originals = canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]);
    const bytes = [f.current, f.baseline].map(role => [digest(role.zip), digest(role.serverBytes)]);
    for (const role of [f.current, f.baseline]) {
      const proof = validateNativeRole(role, role.sourceSha);
      assert.equal(proof.run.tool.driver.semanticVersion, engine); assert.equal(proof.serverRun.tool.driver.semanticVersion, engine);
      assert.deepEqual(proof.expected, { typescript: ['src/a.ts'], javascript: ['scripts/b.mjs'], actions: ['.github/workflows/security.yml'] });
      assert.deepEqual(proof.extracted, ['.github/workflows/security.yml', 'scripts/b.mjs', 'src/a.ts']);
      assert.equal(proof.run.results.length, 1); assert.equal(proof.serverRun.results.length, 1);
    }
    const result = await publicOutcome(f);
    assert.equal(result.ready, true); assert.equal(result.qualification.findings.nativeResults, 1); assert.equal(result.qualification.findings.serverResults, 1);
    assert.equal(canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]), originals);
    assert.deepEqual([f.current, f.baseline].map(role => [digest(role.zip), digest(role.serverBytes)]), bytes);
    if (cleanup) assert.deepEqual(syntheticCleanupNote(f.current).properties.attributes.deletedVersions, ['2.27.3']);
  }
});

test('SYNTHETIC unlisted future and malformed engine versions cannot qualify either source role', async () => {
  for (const engine of ['2.27.2', '2.27.5', '2.28.0', '3.0.0', '2.27.4.0', 'v2.27.4', '2.27.4\n', '', null, 2.274]) {
    const f = syntheticEngineFixture(engine);
    for (const role of [f.current, f.baseline]) assert.throws(() => validateNativeRole(role, role.sourceSha), /Source proof/);
    await assert.rejects(publicOutcome(f), /Source proof/);
  }
});

test('SYNTHETIC native server and analysis engines must agree per role in either supported direction', async () => {
  for (const engine of ['2.27.3', '2.27.4']) for (const role of ['current', 'baseline']) for (const field of ['native', 'server', 'analysis']) {
    const f = syntheticEngineFixture(engine), other = engine === '2.27.3' ? '2.27.4' : '2.27.3', target = f[role];
    if (field === 'analysis') target.analysis.tool.version = other;
    else (field === 'native' ? target.report : target.server).runs[0].tool.driver.semanticVersion = other;
    sealRole(target);
    assert.throws(() => validateNativeRole(target, target.sourceSha), /analysis metadata invalid|CodeQL engine mismatch/, `${engine}/${role}/${field}`);
    await assert.rejects(publicOutcome(f), /analysis metadata invalid|CodeQL engine mismatch/);
  }
  for (const engine of ['2.27.3', '2.27.4']) {
    const f = syntheticEngineFixture(engine), other = engine === '2.27.3' ? '2.27.4' : '2.27.3';
    for (const report of [f.current.report, f.current.server]) report.runs[0].tool.driver.semanticVersion = other;
    f.current.analysis.tool.version = other; sealRole(f.current);
    assert.equal(validateNativeRole(f.current, sha).run.tool.driver.semanticVersion, other);
    assert.equal(validateNativeRole(f.baseline, prior).run.tool.driver.semanticVersion, engine);
    assert.throws(() => compareNativeProof(f.current, f.baseline, f.comparison), /complete native\/server tool\/catalog changed/);
    await assert.rejects(publicOutcome(f), /complete native\/server tool\/catalog changed/);
  }
});

test('SYNTHETIC cleanup accepts bounded numeric strings and exact UTC job boundaries without changing raw data', () => {
  const versions = [...Array.from({ length: 7 }, (_, index) => `2.26.${index}`), `${'1'.repeat(28)}.0.0`];
  assert.equal(versions.length, 8); assert.equal(versions.at(-1).length, 32);
  for (const at of ['2026-11-02T10:00:00Z', '2026-11-02T10:05:10.999Z']) {
    const f = syntheticEngineFixture('2.27.4', true), role = f.current, note = syntheticCleanupNote(role);
    note.properties.attributes.deletedVersions = [...versions]; note.timeUtc = at; sealRole(role);
    const before = canonical(role.report), zip = digest(role.zip);
    const proof = validateNativeRole(role, sha);
    assert.equal(proof.extracted.length, 3); assert.deepEqual(syntheticCleanupNote(role).properties.attributes.deletedVersions, versions);
    assert.equal(canonical(role.report), before); assert.equal(digest(role.zip), zip);
  }
  const role = syntheticEngineFixture('2.27.4', true).current;
  assert.equal(nativeCoverage(role.report, role.log).extracted.length, 3, 'pure parser has no supplied producer window; full role validation always supplies one');
});

test('SYNTHETIC cleanup refuses every missing or extra structural key and malformed or failed advisory fact', () => {
  const changes = [
    ...['message', 'level', 'timeUtc', 'descriptor', 'properties'].map(key => [`missing ${key}`, note => delete note[key]]),
    ...['locations', 'exception', 'associatedRule', 'unknown'].map(key => [`extra ${key}`, note => note[key] = {}]),
    ...[null, [], ''].map(value => ['message type', note => note.message = value]),
    ['message missing text', note => note.message = {}], ['nonempty message', note => note.message.text = 'cleanup failed'],
    ['message extra key', note => note.message.markdown = ''],
    ...['error', 'warning', 'note', '', null, 0].map(value => [`level ${value}`, note => note.level = value]),
    ...['2026-02-30T10:00:30Z', '2026-11-02T10:00:30+00:00', '2026-11-02T10:00:30z', '2026-11-02T10:00:30Z\n', '2026-11-02T09:59:59.999Z', '2026-11-02T10:05:11Z', '', null, 0].map(value => [`time ${value}`, note => note.timeUtc = value]),
    ...[null, [], ''].map(value => ['properties type', note => note.properties = value]),
    ...['attributes', 'visibility'].map(key => [`missing properties.${key}`, note => delete note.properties[key]]),
    ['extra properties key', note => note.properties.unknown = false],
    ...[null, [], false].map(value => ['attributes type', note => note.properties.attributes = value]),
    ...['deletedVersions', 'failed'].map(key => [`missing attributes.${key}`, note => delete note.properties.attributes[key]]),
    ['extra attributes key', note => note.properties.attributes.unknown = false],
    ...[true, null, 'false', 0].map(value => [`failed ${value}`, note => note.properties.attributes.failed = value]),
    ...[null, [], false].map(value => ['visibility type', note => note.properties.visibility = value]),
    ...['statusPage', 'telemetry'].map(key => [`missing visibility.${key}`, note => delete note.properties.visibility[key]]),
    ['extra visibility key', note => note.properties.visibility.unknown = false],
    ...[true, null, 'false', 0].map(value => [`statusPage ${value}`, note => note.properties.visibility.statusPage = value]),
    ...[false, null, 'true', 1].map(value => [`telemetry ${value}`, note => note.properties.visibility.telemetry = value]),
  ];
  for (const role of ['current', 'baseline']) for (const [label, change] of changes) {
    const f = syntheticEngineFixture('2.27.4', true), target = f[role]; change(syntheticCleanupNote(target)); sealRole(target);
    const original = canonical(target.report);
    assert.throws(() => validateNativeRole(target, target.sourceSha), /Source proof/, `${role}/${label}`);
    assert.equal(canonical(target.report), original, 'malformed original advisory remains unchanged');
  }
});

test('SYNTHETIC cleanup version inventories enforce count length ASCII grammar types and uniqueness', () => {
  const lists = [null, {}, '2.27.3', [], [null], [2.273], [true], [''], ['2.27.3', '2.27.3'],
    Array.from({ length: 9 }, (_, index) => `2.26.${index}`), [`${'1'.repeat(29)}.0.0`],
    ...['02.27.3', '2.027.3', '2.27.03', '2.27', '2.27.3.0', '-2.27.3', '2.27.-3', '+2.27.3', 'v2.27.3', '2.27.3-beta', '2.27.3+build', ' 2.27.3', '2.27.3 ', '2.27.3\n', '2.27.3\r', '2.27.3\u0000', '２.27.3', '2.27.٣', '2e0.27.3'].map(version => [version])];
  for (const role of ['current', 'baseline']) for (const versions of lists) {
    const f = syntheticEngineFixture('2.27.4', true), target = f[role]; syntheticCleanupNote(target).properties.attributes.deletedVersions = versions; sealRole(target);
    assert.throws(() => validateNativeRole(target, target.sourceSha), /toolcache cleanup version inventory/);
  }
});

test('SYNTHETIC cleanup cannot use another engine unbound descriptor duplicate or unknown notification', async () => {
  const changes = [
    ['legacy engine', (note, run, role) => { run.tool.driver.semanticVersion = '2.27.3'; role.server.runs[0].tool.driver.semanticVersion = '2.27.3'; role.analysis.tool.version = '2.27.3'; }],
    ['future engine', (note, run, role) => { run.tool.driver.semanticVersion = '2.27.5'; role.server.runs[0].tool.driver.semanticVersion = '2.27.5'; role.analysis.tool.version = '2.27.5'; }],
    ['duplicate cleanup', (note, run) => run.invocations[0].toolExecutionNotifications.push(structuredClone(note))],
    ['missing descriptor id', note => delete note.descriptor.id], ['missing descriptor index', note => delete note.descriptor.index],
    ['extra descriptor key', note => note.descriptor.properties = {}], ['extra descriptor guid', note => note.descriptor.guid = '00000000-0000-4000-8000-000000000002'],
    ...[null, [], ''].map(value => ['descriptor type', note => note.descriptor = value]),
    ...[-1, 0, 99999, '4', 4.5, null].map(value => [`descriptor index ${value}`, note => note.descriptor.index = value]),
    ['driver catalog absent', (note, run) => run.tool.driver.notifications.pop()],
    ['driver catalog contradiction', (note, run) => run.tool.driver.notifications[note.descriptor.index].id = 'codeql-action/unknown'],
    ['duplicate driver catalog identity', (note, run) => run.tool.driver.notifications.push({ id: syntheticCleanupId })],
    ['extension owned cleanup', (note, run) => { run.tool.extensions[0].notifications.push({ id: syntheticCleanupId }); note.descriptor = { id: syntheticCleanupId, index: 1, toolComponent: { index: 0 } }; }],
    ['explicit driver selector', note => note.descriptor.toolComponent = { name: 'CodeQL' }],
    ['unknown notification', (note, run) => { note.descriptor.id = 'codeql-action/unknown'; run.tool.driver.notifications[note.descriptor.index].id = note.descriptor.id; }],
  ];
  for (const role of ['current', 'baseline']) for (const [label, change] of changes) {
    const f = syntheticEngineFixture('2.27.4', true), target = f[role]; change(syntheticCleanupNote(target), target.report.runs[0], target); sealRole(target);
    assert.throws(() => validateNativeRole(target, target.sourceSha), /Source proof/, `${role}/${label}`);
    await assert.rejects(publicOutcome(f), /Source proof/, `${role}/${label}`);
  }
});

function syntheticSecondTypeScript(role) {
  const run = role.report.runs[0], notes = run.invocations[0].toolExecutionNotifications, index = run.artifacts.length;
  const location = { uri: 'src/second.ts', uriBaseId: '%SRCROOT%', index };
  run.artifacts.push({ location: structuredClone(location) });
  for (const kind of ['cli/expected-extracted-files/typescript', 'js/diagnostics/successfully-extracted-files']) {
    const note = structuredClone(notes.find(value => value.descriptor.id === kind));
    note.locations[0].physicalLocation.artifactLocation = structuredClone(location); notes.push(note);
  }
  sealRole(role); role.log = role.log.replace('1 out of 1 TypeScript files', '2 out of 2 TypeScript files');
}

test('SYNTHETIC valid cleanup never substitutes for positive complete expected extracted metrics or native success proof', async () => {
  const changes = [
    ...['typescript', 'javascript', 'actions'].map(language => [`missing expected ${language}`, run => run.invocations[0].toolExecutionNotifications = run.invocations[0].toolExecutionNotifications.filter(note => note.descriptor.id !== `cli/expected-extracted-files/${language}`)]),
    ['missing extracted', run => run.invocations[0].toolExecutionNotifications = run.invocations[0].toolExecutionNotifications.filter(note => note.descriptor.id !== 'js/diagnostics/successfully-extracted-files')],
    ['incomplete extracted', run => run.invocations[0].toolExecutionNotifications = run.invocations[0].toolExecutionNotifications.filter(note => note.descriptor.id !== 'js/diagnostics/successfully-extracted-files' || note.locations[0].physicalLocation.artifactLocation.uri !== 'src/a.ts')],
    ['missing overlay', run => run.invocations[0].toolExecutionNotifications = run.invocations[0].toolExecutionNotifications.filter(note => note.descriptor.id !== 'codeql-action/overlay-disabled')],
    ['failed invocation', run => run.invocations[0].executionSuccessful = false], ['missing native success', run => delete run.invocations[0].executionSuccessful],
    ['nonzero exit', run => run.invocations[0].exitCode = 2], ['configuration error', run => run.invocations[0].toolConfigurationNotifications = [{ level: 'error', message: { text: 'failed' } }]],
    ['missing metrics', run => delete run.properties.metricResults], ['incomplete metrics', run => run.properties.metricResults.pop()],
  ];
  for (const role of ['current', 'baseline']) for (const [label, change] of changes) {
    const f = syntheticEngineFixture('2.27.4', true), target = f[role]; change(target.report.runs[0]); sealRole(target);
    assert.throws(() => validateNativeRole(target, target.sourceSha), /Source proof/, `${role}/${label}`);
    await assert.rejects(publicOutcome(f), /Source proof/, `${role}/${label}`);
  }
  for (const kind of ['expected', 'extracted', 'both']) {
    const f = syntheticEngineFixture('2.27.4', true);
    for (const role of [f.current, f.baseline]) syntheticSecondTypeScript(role);
    assert.equal((await publicOutcome(f)).ready, true, 'positive two-file synthetic inventory control');
    const run = f.current.report.runs[0];
    run.invocations[0].toolExecutionNotifications = run.invocations[0].toolExecutionNotifications.filter(note => {
      const second = note.locations?.[0].physicalLocation.artifactLocation.uri === 'src/second.ts';
      return !second || kind === 'expected' && note.descriptor.id === 'js/diagnostics/successfully-extracted-files' || kind === 'extracted' && note.descriptor.id === 'cli/expected-extracted-files/typescript';
    });
    sealRole(f.current);
    if (kind === 'extracted') f.current.log = f.current.log.replace('1 out of 1 TypeScript files', '2 out of 2 TypeScript files');
    assert.throws(() => compareNativeProof(f.current, f.baseline, f.comparison), /unextracted expected path|unexplained lost coverage/);
    await assert.rejects(publicOutcome(f), /unextracted expected path|unexplained lost coverage/);
  }
});

test('SYNTHETIC successor complete-original findings catalog config and mutable custody fences remain mandatory', async () => {
  for (const change of [
    f => f.current.report.runs[0].results[0].properties.typed = '1',
    f => f.current.server.runs[0].results[0].properties.typed = '1',
    f => f.current.report.runs[0].results.push(structuredClone(f.current.report.runs[0].results[0])),
    f => f.current.report.runs[0].tool.extensions[0].semanticVersion = 'changed',
    f => f.current.server.runs[0].tool.extensions[0].semanticVersion = 'changed',
    f => f.current.config += 'changed: true\n',
    f => f.current.log = f.current.log.replace('1 out of 1 TypeScript files', '0 out of 1 TypeScript files'),
  ]) {
    const f = syntheticEngineFixture('2.27.4', true); change(f);
    // Seal only the synthetic artifact, preserving the intentionally changed log.
    const log = f.current.log; sealRole(f.current);
    if (log.includes('0 out of 1 TypeScript files')) f.current.log = log;
    await assert.rejects(publicOutcome(f), /Source proof/);
  }
  for (const role of ['current', 'baseline']) for (const phase of ['final', 'cache']) {
    const f = syntheticEngineFixture('2.27.4', true), cache = new Map();
    if (phase === 'cache') assert.equal((await publicOutcome(f, cache)).ready, true);
    interceptPhase(f, path => path.includes('/code-scanning/analyses?'), response => response.data.find(row => row.id === f[role].analysis.id).tool.version = '2.27.3', phase);
    await deniesPublic(f, cache, `${role}/${phase} engine metadata`);
  }
});

// SYNTHETIC causal upload controls only; these do not relabel actual observations.
// Rewrite only the three upload lines of an existing sealed engine fixture.
function syntheticUploadLog(role, times, order = [0, 1, 2]) {
  const lines = role.log.split('\n'), upload = lines.splice(-3);
  role.log = [...lines, ...order.map(index => upload[index].replace(/^[^ ]+ /, `2026-11-02T${times[index]}Z `))].join('\n');
}

test('SYNTHETIC both supported engines qualify complete roles when only the digest predates API creation', async () => {
  for (const engine of ['2.27.3', '2.27.4']) {
    const f = syntheticEngineFixture(engine), originals = canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]);
    const bytes = [f.current, f.baseline].map(role => [digest(role.zip), digest(role.serverBytes)]);
    for (const role of [f.current, f.baseline]) {
      syntheticUploadLog(role, ['10:05:01.900', '10:05:02.200', '10:05:02.300']);
      assert.ok(Date.parse('2026-11-02T10:05:01.900Z') < Date.parse(role.artifact.created_at));
      const proof = validateNativeRole(role, role.sourceSha);
      assert.equal(proof.run.tool.driver.semanticVersion, engine); assert.equal(proof.serverRun.tool.driver.semanticVersion, engine);
      assert.deepEqual(proof.expected, { typescript: ['src/a.ts'], javascript: ['scripts/b.mjs'], actions: ['.github/workflows/security.yml'] });
      assert.deepEqual(proof.extracted, ['.github/workflows/security.yml', 'scripts/b.mjs', 'src/a.ts']);
      assert.equal(proof.run.results.length, 1); assert.equal(proof.serverRun.results.length, 1);
    }
    const result = await publicOutcome(f);
    assert.equal(result.ready, true); assert.equal(result.qualification.findings.nativeResults, 1); assert.equal(result.qualification.findings.serverResults, 1);
    assert.equal(canonical([f.current.report, f.current.server, f.baseline.report, f.baseline.server]), originals);
    assert.deepEqual([f.current, f.baseline].map(role => [digest(role.zip), digest(role.serverBytes)]), bytes);
  }
});

test('SYNTHETIC ordered equal-time upload markers qualify within the unchanged whole update second', async () => {
  for (const engine of ['2.27.3', '2.27.4']) for (const at of ['10:05:02.200', '10:05:02.999']) {
    const f = syntheticEngineFixture(engine);
    for (const role of [f.current, f.baseline]) {
      syntheticUploadLog(role, [at, at, at]);
      const proof = validateNativeRole(role, role.sourceSha);
      assert.equal(proof.run.tool.driver.semanticVersion, engine); assert.equal(proof.extracted.length, 3);
      assert.equal(proof.run.results.length, 1); assert.equal(proof.serverRun.results.length, 1);
    }
    const result = await publicOutcome(f);
    assert.equal(result.ready, true); assert.equal(result.qualification.findings.nativeResults, 1); assert.equal(result.qualification.findings.serverResults, 1);
  }
});

test('SYNTHETIC every noncausal upload permutation refuses even with identical timestamps', async () => {
  const orders = [[1, 0, 2], [0, 2, 1], [2, 1, 0], [1, 2, 0], [2, 0, 1]];
  for (const engine of ['2.27.3', '2.27.4']) for (const name of ['current', 'baseline']) for (const order of orders) {
    const f = syntheticEngineFixture(engine), role = f[name], before = digest(role.zip), label = `${engine}/${name}/${order.join(',')}`;
    syntheticUploadLog(role, ['10:05:02.200', '10:05:02.200', '10:05:02.200'], order);
    assert.throws(() => validateNativeRole(role, role.sourceSha), /upload markers contradict causal order/, label);
    await assert.rejects(publicOutcome(f), /upload markers contradict causal order/, label);
    assert.equal(digest(role.zip), before);
  }
});

test('SYNTHETIC each missing or duplicated upload marker refuses for either complete source role', async () => {
  const orders = [[1, 2], [0, 2], [0, 1], [0, 0, 1, 2], [0, 1, 1, 2], [0, 1, 2, 2]];
  for (const engine of ['2.27.3', '2.27.4']) for (const name of ['current', 'baseline']) for (const order of orders) {
    const f = syntheticEngineFixture(engine), role = f[name], before = digest(role.zip), label = `${engine}/${name}/${order.join(',')}`;
    syntheticUploadLog(role, ['10:05:02.200', '10:05:02.200', '10:05:02.200'], order);
    assert.throws(() => validateNativeRole(role, role.sourceSha), /Source proof/, label);
    await assert.rejects(publicOutcome(f), /Source proof/, label);
    assert.equal(digest(role.zip), before);
  }
});

test('SYNTHETIC digest phase artifact-end and both final-marker bounds retain original chronology refusals', async () => {
  const changes = [
    ['digest before upload step', ['10:05:00.999', '10:05:02.200', '10:05:02.300']],
    ['digest at artifact endExclusive', ['10:05:03.000', '10:05:03.000', '10:05:03.000'], '10:05:04'],
    ['finalized before artifact creation', ['10:05:01.800', '10:05:01.900', '10:05:02.300']],
    ['completed before artifact creation', ['10:05:01.700', '10:05:01.800', '10:05:01.900']],
    ['finalized at artifact endExclusive', ['10:05:01.900', '10:05:03.000', '10:05:03.000'], '10:05:04'],
    ['completed at artifact endExclusive', ['10:05:01.900', '10:05:02.200', '10:05:03.000'], '10:05:04'],
    ['finalized outside upload step', ['10:05:01.900', '10:05:03.000', '10:05:03.000']],
    ['completed outside upload step', ['10:05:01.900', '10:05:02.200', '10:05:03.000']],
    ['backwards upload timestamp', ['10:05:02.100', '10:05:02.300', '10:05:02.200']],
  ];
  for (const engine of ['2.27.3', '2.27.4']) for (const name of ['current', 'baseline']) for (const [label, times, phaseEnd] of changes) {
    const f = syntheticEngineFixture(engine), role = f[name], before = digest(role.zip);
    if (phaseEnd) role.job.steps.find(step => step.name === 'Preserve CodeQL results').completed_at = `2026-11-02T${phaseEnd}Z`;
    syntheticUploadLog(role, times);
    assert.throws(() => validateNativeRole(role, role.sourceSha), /Source proof/, `${engine}/${name}/${label}`);
    await assert.rejects(publicOutcome(f), /Source proof/, `${engine}/${name}/${label}`);
    assert.equal(digest(role.zip), before);
  }
});

test('SYNTHETIC causal pre-creation digest never relaxes exact upload digest name ID or size', async () => {
  const changes = [
    ['digest', role => role.log.replace(`zip is ${role.artifact.digest.slice(7)}`, `zip is ${'0'.repeat(64)}`)],
    ['finalized ID', role => role.log.replace(`.zip successfully finalized. Artifact ID ${role.artifact.id}`, `.zip successfully finalized. Artifact ID ${role.artifact.id + 1}`)],
    ['finalized name', role => role.log.replace(`Artifact ${role.artifact.name}.zip successfully finalized`, `Artifact ${role.artifact.name}-other.zip successfully finalized`)],
    ['completed size', role => role.log.replace(`Final size is ${role.artifact.size_in_bytes} bytes`, `Final size is ${role.artifact.size_in_bytes + 1} bytes`)],
    ['completed ID', role => role.log.replace(`Artifact ID is ${role.artifact.id}`, `Artifact ID is ${role.artifact.id + 1}`)],
    ['completed name', role => role.log.replace(`Artifact ${role.artifact.name} has been`, `Artifact ${role.artifact.name}-other has been`)],
  ];
  for (const engine of ['2.27.3', '2.27.4']) for (const name of ['current', 'baseline']) for (const [label, change] of changes) {
    const f = syntheticEngineFixture(engine), role = f[name], before = digest(role.zip);
    syntheticUploadLog(role, ['10:05:01.900', '10:05:02.200', '10:05:02.300']); role.log = change(role);
    assert.throws(() => validateNativeRole(role, role.sourceSha), /Source proof/, `${engine}/${name}/${label}`);
    await assert.rejects(publicOutcome(f), /Source proof/, `${engine}/${name}/${label}`);
    assert.equal(digest(role.zip), before);
  }
});


test('npm 12 singleton metadata preserves registry identity and package planning', () => {
  const metadata = { version: '0.37.0', gitHead: prior };
  const observed = registryResult(JSON.stringify([metadata]));
  assert.deepEqual(observed, metadata);
  assert.deepEqual(registryResult(JSON.stringify(metadata)), observed);
  const comparisons = [];
  const plan = makePlan({
    paths: { sha },
    registry: () => observed,
    diffPaths: (from, to, paths) => { comparisons.push([from, to]); return paths.includes('src/') ? 'src/index.ts' : ''; },
  });
  assert.deepEqual(plan.packages.filter(pkg => pkg.changed).map(pkg => pkg.key), ['sdk', 'provider', 'cli']);
  assert.equal(comparisons.length, 4);
  assert.ok(comparisons.every(([from, to]) => from === prior && to === sha));
});

test('registry metadata arrays refuse ambiguous or invalid responses and retain error gates', () => {
  const metadata = { version: '0.37.0', gitHead: prior };
  for (const value of [[], [metadata, metadata], [null], ['0.37.0'], [[metadata]], [{}]]) {
    assert.throws(() => registryResult(JSON.stringify(value)), /metadata|semver/);
  }
  const failure = new Error('registry request failed');
  assert.equal(registryResult(JSON.stringify({ error: { code: 'E404' } }), failure), undefined);
  for (const code of ['E401', 'E403', 'ETIMEDOUT']) {
    assert.throws(() => registryResult(JSON.stringify({ error: { code } }), failure), failure);
  }
  assert.throws(() => registryResult('not JSON', failure), failure);
});
