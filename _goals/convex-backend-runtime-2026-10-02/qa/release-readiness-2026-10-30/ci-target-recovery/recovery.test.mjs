import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as runner from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import * as cloud from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
import { recover, parseArgs, REPO, sourceDigest, main } from './recover.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-ci-recovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const credential = path.join(root, 'fake-login.json');
  await fs.writeFile(credential, JSON.stringify({ accessToken: 'offline-account-credential' }), { mode: 0o600 });
  const rows = [], calls = [], commands = [];
  let selectors = ['steady-snake-253', 'usable-sheep-908'], active = false, failedSecret = null, wrongCreate = false, ambiguous = false;
  const pair = async () => {
    const files = (await fs.readdir(root)).filter(name => /^[a-f0-9-]{36}\.json$/.test(name));
    assert.equal(files.length, 1); return JSON.parse(await fs.readFile(path.join(root, files[0]), 'utf8'));
  };
  const command = async (label, executable, args, options = {}) => {
    commands.push({ label, executable, args, input: options.input });
    if (label === 'pinned-npm') return { stdout: '12.2.0\n' };
    assert.equal(executable, 'gh');
    const response = value => ({ stdout: JSON.stringify(value) });
    if (args[0] === 'secret') {
      assert.equal(args[1], 'set'); assert.equal(args[3], '--repo'); assert.equal(args[4], REPO);
      assert.ok(typeof options.input === 'string'); assert.ok(!args.some(arg => arg.startsWith('dev:') || arg === '--body'));
      const journal = await pair(); assert.equal(journal.publication[args[2]], 'issued');
      if (args[2] === failedSecret) throw Error('Simulated uncertain secret update');
      return response({});
    }
    const route = args.find(arg => arg.startsWith('repos/'));
    if (route === 'repos/' + REPO) return response({ id: 123456, name: 'Project-Cortex', full_name: REPO,
      owner: { login: 'SaintNick1214' }, private: false, archived: false });
    if (route.includes('/actions/runs?')) return response([{ workflow_runs: active ? [{ id: 98, repository: { id: 123456 },
      path: '.github/workflows/pr-checks.yml', status: 'in_progress' }] : [] }]);
    if (route.endsWith('/actions/variables/CORTEX_CI_DISPOSABLE_DEPLOYMENTS')) {
      if (args.includes('PATCH')) { selectors = JSON.parse(JSON.parse(options.input).value); return response({}); }
      return response({ name: 'CORTEX_CI_DISPOSABLE_DEPLOYMENTS', value: JSON.stringify(selectors) });
    }
    throw Error('Unexpected fake gh operation');
  };
  const fetch = async (url, options) => {
    const route = url.replace('https://api.convex.dev/v1', ''), body = options.body && JSON.parse(options.body);
    calls.push({ route, method: options.method, body });
    const response = value => new Response(JSON.stringify(value), { status: 200 });
    if (route === '/projects/3200658') return response({ id: 3200658, teamId: 325340, slug: 'cortex-sandboxes' });
    if (route === '/projects/3200658/list_deployments') return response(rows);
    if (route === '/teams/325340/list_deployment_regions') return response({ items: [{ name: 'aws-us-east-1', available: true }] });
    if (route === '/projects/3200658/create_deployment') {
      const journal = await pair();
      assert.ok(journal.cleanupCommand.includes(journal.id));
      assert.equal(new Set(Object.values(journal.cleanupPlan).map(value => value.reference)).size, 2);
      const role = Object.keys(journal.cleanupPlan).find(key => journal.cleanupPlan[key].reference === body.reference);
      assert.equal(journal.cleanupPlan[role].status, 'issued'); assert.equal(journal.cleanupPlan[role].expiresAt, body.expiresAt);
      assert.ok(body.expiresAt > Date.now() && body.expiresAt - Date.now() <= 7 * 86400000);
      if (ambiguous) throw Error('Simulated unknown creation without acknowledgement');
      const name = `fixture-otter-${901 + rows.length}`;
      const row = { id: 9001 + rows.length, name, kind: 'cloud', projectId: 3200658, reference: body.reference,
        deploymentType: 'dev', isDefault: wrongCreate && rows.length === 1, expiresAt: body.expiresAt, deploymentUrl: `https://${name}.convex.cloud` };
      rows.push(row); return response(row);
    }
    if (route.endsWith('/create_deploy_key')) {
      assert.equal(rows.length, 2);
      const journal = await pair(); assert.equal(journal.targets.length, 2);
      const name = route.split('/')[2]; return response({ deployKey: `dev:${name}|offline-${name}-scoped-secret` });
    }
    if (route.endsWith('/delete')) {
      const name = route.split('/')[2]; assert.ok(!selectors.includes(name));
      const index = rows.findIndex(row => row.name === name); assert.ok(index >= 0); assert.equal(rows[index].isDefault, false);
      rows.splice(index, 1); return new Response('', { status: 200 });
    }
    throw Error('Unexpected fake Convex operation');
  };
  const deps = { cloud, runner: { ...runner, createContext: async (session, options) => {
    const ctx = await runner.createContext(session, options);
    return Object.assign(ctx, { convexConfigPath: credential, command, fetch });
  } } };
  const run = action => recover(action, { root, deps, reviewChecked: true });
  return { root, rows, calls, commands, pair, run, setActive: value => { active = value; },
    setSelectors: value => { selectors = value; }, failSecret: value => { failedSecret = value; },
    wrongCreate: () => { wrongCreate = true; }, ambiguous: () => { ambiguous = true; } };
}

test('default dry-run reads source without invoking recover or creating private state; live actions require explicit flags', async () => {
  assert.deepEqual(parseArgs([]), { action: 'dry-run' });
  assert.throws(() => parseArgs(['create']), /Explicit/);
  assert.throws(() => parseArgs(['cleanup', '../other']), /Exact/);
  await assert.rejects(() => recover({ action: 'create' }), /Non-author/);
  assert.match(await sourceDigest(), /^[a-f0-9]{64}$/);
  const write = process.stdout.write; let output = '';
  process.stdout.write = text => { output += text; return true; };
  try { await main([]); } finally { process.stdout.write = write; }
  assert.match(output, /Dry run performs no writes or remote calls/);
});

test('two durable exact targets and private keys publish only four stdin secrets then allowlist; retain with finite cleanup', async t => {
  const f = await fixture(t), created = await f.run({ action: 'create' });
  assert.equal(created.phase, 'READY_TO_PUBLISH');
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deployment')).length, 2);
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deploy_key')).length, 2);
  const journal = await f.pair();
  assert.notEqual(journal.sessions.sdk, journal.sessions.cli);
  for (const id of Object.values(journal.sessions)) {
    const session = await runner.loadSession(f.root, id);
    assert.equal((await fs.stat(session.deploymentKeyPath)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(session.runDir)).mode & 0o777, 0o700);
  }
  const result = await f.run({ action: 'publish', id: created.pairId });
  assert.equal(result.phase, 'RETAINED'); assert.equal(f.rows.length, 2);
  const secrets = f.commands.filter(command => command.args[0] === 'secret');
  assert.deepEqual(secrets.map(command => command.args[2]).sort(), ['CORTEX_CI_CONVEX_DEPLOY_KEY', 'CORTEX_CI_CONVEX_DEPLOY_KEY_CLI', 'CORTEX_CI_CONVEX_URL', 'CORTEX_CI_CONVEX_URL_CLI'].sort());
  const writes = f.commands.filter(command => command.args[0] === 'secret' || command.args.includes('PATCH'));
  assert.equal(writes.at(-1).label, 'github-allowlist'); assert.equal(writes.length, 5);
  const retained = await f.pair(); assert.equal(retained.futureCleanup.serverExpiresAt.length, 2);
  assert.equal(retained.futureCleanup.fixtureCleanupSeparate, true);
  await assert.rejects(() => f.run({ action: 'cleanup', id: created.pairId }), /selected/);
  assert.equal(f.rows.length, 2);
  f.setSelectors(['replacement-one-123', 'replacement-two-456']);
  assert.equal((await f.run({ action: 'cleanup', id: created.pairId })).phase, 'CLEANED');
  assert.equal(f.rows.length, 0);
  assert.equal(f.calls.filter(call => call.route.endsWith('/delete')).length, 2);
  for (const id of Object.values(journal.sessions)) {
    const session = await runner.loadSession(f.root, id);
    await assert.rejects(() => fs.stat(session.deploymentKeyPath), { code: 'ENOENT' });
  }
});

test('active lifecycle blocks publication before any selector write and blocks owned deletion', async t => {
  const f = await fixture(t), created = await f.run({ action: 'create' }); f.setActive(true);
  await assert.rejects(() => f.run({ action: 'publish', id: created.pairId }), /Publication uncertain/);
  assert.equal(f.commands.filter(command => command.args[0] === 'secret' || command.args.includes('PATCH')).length, 0);
  await assert.rejects(() => f.run({ action: 'cleanup', id: created.pairId }), /active or pending/);
  assert.equal(f.rows.length, 2); assert.equal(f.calls.filter(call => call.route.endsWith('/delete')).length, 0);
});

test('partial secret update retains exact pair; explicit same-pair recovery completes without new targets or keys', async t => {
  const f = await fixture(t), created = await f.run({ action: 'create' });
  f.failSecret('CORTEX_CI_CONVEX_URL');
  await assert.rejects(() => f.run({ action: 'publish', id: created.pairId }), /Publication uncertain/);
  assert.equal((await f.pair()).phase, 'PUBLISH_UNCERTAIN'); assert.equal(f.rows.length, 2);
  await assert.rejects(() => f.run({ action: 'cleanup', id: created.pairId }), /Resolve uncertain/);
  assert.equal(f.calls.filter(call => call.route.endsWith('/delete')).length, 0);
  f.failSecret(null);
  assert.equal((await f.run({ action: 'publish', id: created.pairId })).phase, 'RETAINED');
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deployment')).length, 2);
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deploy_key')).length, 2);
});

test('persisted PUBLISHING after process death resumes the same intended secret values and still refuses cleanup', async t => {
  const f = await fixture(t), created = await f.run({ action: 'create' });
  const journal = await f.pair(), sdk = await runner.loadSession(f.root, journal.sessions.sdk);
  const key = await fs.readFile(sdk.deploymentKeyPath, 'utf8');
  // The first write was confirmed; the process died after persisting the second write's intent.
  // No catch block ran, so the durable phase never advanced to PUBLISH_UNCERTAIN.
  journal.phase = 'PUBLISHING';
  journal.publication.CORTEX_CI_CONVEX_DEPLOY_KEY = 'confirmed';
  journal.publication.CORTEX_CI_CONVEX_URL = 'issued';
  await runner.privateWrite(path.join(f.root, journal.id + '.json'), JSON.stringify(journal));
  await assert.rejects(() => f.run({ action: 'cleanup', id: created.pairId }), /Resolve uncertain/);
  assert.equal(f.calls.filter(call => call.route.endsWith('/delete')).length, 0);
  assert.equal((await f.pair()).phase, 'PUBLISHING');
  const result = await f.run({ action: 'publish', id: created.pairId });
  assert.equal(result.phase, 'RETAINED'); assert.equal(result.pairId, journal.id);
  const resumed = f.commands.filter(command => command.args[0] === 'secret');
  assert.equal(resumed.length, 4);
  assert.equal(resumed.find(command => command.args[2] === 'CORTEX_CI_CONVEX_DEPLOY_KEY').input, key);
  assert.equal(resumed.find(command => command.args[2] === 'CORTEX_CI_CONVEX_URL').input, sdk.target.deploymentUrl);
  assert.equal(f.commands.filter(command => command.args.includes('PATCH')).length, 1);
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deployment')).length, 2);
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deploy_key')).length, 2);
  assert.equal(f.rows.length, 2);
  await assert.rejects(() => f.run({ action: 'cleanup', id: created.pairId }), /selected/);
});

test('server identity drift blocks all keys and unsafe deletion; only verified owned sibling is cleaned', async t => {
  const f = await fixture(t); f.wrongCreate();
  await assert.rejects(() => f.run({ action: 'create' }), /Creation failed/);
  assert.equal((await f.pair()).phase, 'CLEANUP_REQUIRED');
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deploy_key')).length, 0);
  assert.equal(f.calls.filter(call => call.route.endsWith('/delete')).length, 1);
  assert.equal(f.rows.length, 1); assert.equal(f.rows[0].isDefault, true);
});

test('ambiguous create preserves cleanup intent without another create POST or false absence', async t => {
  const f = await fixture(t); f.ambiguous();
  await assert.rejects(() => f.run({ action: 'create' }), /Creation failed/);
  const journal = await f.pair(); assert.equal(journal.phase, 'CLEANUP_REQUIRED');
  assert.equal(journal.cleanupPlan.sdk.status, 'unknown'); assert.ok(journal.cleanupPlan.sdk.expiresAt > Date.now());
  assert.equal(f.calls.filter(call => call.route.endsWith('/create_deployment')).length, 1);
  assert.equal(f.calls.filter(call => call.route.endsWith('/delete')).length, 0);
});
