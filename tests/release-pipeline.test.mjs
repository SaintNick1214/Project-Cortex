import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { createReleasePlan, registryResult, publishReleasePlan, releasePackages, validateReleasePlan, deliveryReady, codeqlApp } from '../scripts/release-contract.mjs';
import { deliveryEvent, readDeliverySnapshot, reconcileReadiness, readinessSummary } from '../scripts/release-readiness.mjs';
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
  const runs = ['PR Checks', 'Security Scans'].map((name, index) => ({ id: index + 1, name, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success' }));
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
      return { data: { workflow_runs: page === 1 ? Array.from({ length: 100 }, (_, id) => ({ ...data.runs[0], id, name: 'Unrelated' })) : data.runs }, hasNext: page === 1 };
    }
    if (url.pathname.endsWith('/statuses')) return { data: page === 1 ? Array.from({ length: 100 }, (_, id) => ({ id, context: `unrelated-${id}`, state: 'success' })) : data.statuses, hasNext: page === 1 };
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
  let failedSnyk = false, apiFailure = false;
  const token = 'local-fixture-token-only', responseSecret = 'must-not-print-response-body';
  const server = createServer((request, response) => {
    requests.push(request.url);
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    response.setHeader('content-type', 'application/json');
    if (apiFailure) { response.writeHead(503); response.end(JSON.stringify({ error: responseSecret })); return; }
    const path = new URL(request.url, 'http://localhost').pathname;
    const body = path.endsWith('/git/ref/heads/main') ? { object: { sha } } : path.endsWith('/actions/runs') ? { workflow_runs: data.runs } : path.endsWith('/check-runs') ? { check_runs: data.checks } : failedSnyk ? [{ ...data.statuses[0], state: 'failure' }] : data.statuses;
    response.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); rmSync(fixture, { recursive: true, force: true }); });
  const event = resolve(fixture, 'event.json'), output = resolve(fixture, 'output.txt'), summary = resolve(fixture, 'summary.md');
  writeFileSync(event, JSON.stringify({ inputs: { source_sha: sha, mode: 'dry-plan' } }));
  const command = new URL('../scripts/release-readiness.mjs', import.meta.url).pathname;
  const run = async () => {
    writeFileSync(output, ''); writeFileSync(summary, '');
    const options = { cwd: fixture, encoding: 'utf8', env: { ...process.env, GH_TOKEN: token, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: event, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: repository, SOURCE_SHA: sha, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, REQUIRE_READY: 'true' } };
    try { return { status: 0, ...await promisify(execFile)(process.execPath, [command, '--once'], options) }; }
    catch (error) { return { status: error.code, stdout: error.stdout, stderr: error.stderr }; }
  };
  const ready = await run();
  assert.equal(ready.status, 0, ready.stderr);
  assert.match(readFileSync(output, 'utf8'), /ready=true\nchecks_run=10\nsource_sha=a{40}\nmode=dry-plan/);
  assert.match(readFileSync(summary, 'utf8'), /CodeQL: \*\*success\*\*/);
  assert.ok(requests.some(path => path.includes('check_name=CodeQL&filter=all')));
  failedSnyk = true;
  const blocked = await run();
  assert.equal(blocked.status, 1);
  assert.match(readFileSync(output, 'utf8'), /ready=false/);
  assert.match(readFileSync(summary, 'utf8'), /security\/snyk \(basic\): \*\*failed\*\*/);
  apiFailure = true;
  const failed = await run();
  assert.equal(failed.status, 1);
  assert.match(readFileSync(summary, 'utf8'), /read failed \(503\)/);
  writeFileSync(event, JSON.stringify({ inputs: { source_sha: sha, mode: 'recover\nready=true' } }));
  const invalid = await run();
  assert.equal(invalid.status, 1);
  assert.match(readFileSync(output, 'utf8'), /ready=false/);
  assert.ok(!readFileSync(output, 'utf8').includes('ready=true'));
  for (const result of [ready, blocked, failed]) {
    assert.ok(!`${result.stdout}${result.stderr}`.includes(token));
    assert.ok(!`${result.stdout}${result.stderr}`.includes(responseSecret));
  }
});
