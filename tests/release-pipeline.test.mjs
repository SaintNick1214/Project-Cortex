import test from 'node:test';
import assert from 'node:assert/strict';
import { createReleasePlan, registryResult, publishReleasePlan, releasePackages, validateReleasePlan, deliveryReady } from '../scripts/release-contract.mjs';
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
  const runs = ['PR Checks', 'Security Scans'].map((name, index) => ({ id: index + 1, name, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success' }));
  const checks = [{ id: 3, name: 'CodeQL', head_sha: sha, status: 'completed', conclusion: 'success' }];
  const statuses = [{ context: 'security/snyk (owner)', state: 'success' }];
  assert.deepEqual(deliveryReady({ runs, checks, statuses, sourceSha: sha }), { ready: true, checksRun: 1 });
  assert.equal(deliveryReady({ runs, checks: [], statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks: [{ ...checks[0], conclusion: 'failure' }], statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [{ ...statuses[0], state: 'failure' }], sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [], sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [{ ...statuses[0], state: 'pending' }], sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks, statuses: [{ ...statuses[0], state: 'success' }, { ...statuses[0], state: 'pending' }], sourceSha: sha }).ready, true);
  assert.equal(deliveryReady({ runs: [...runs, { ...runs[0], id: 4, conclusion: 'failure' }], checks, statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs, checks: [{ ...checks[0], head_sha: prior }], statuses, sourceSha: sha }).ready, false);
  assert.equal(deliveryReady({ runs: runs.map(run => ({ ...run, event: 'pull_request' })), checks, statuses, sourceSha: sha }).ready, false);
});
