/** One temporary release-window CI pair. No remote work without an explicit action and non-author review. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as runner from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import * as cloud from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
import { verifyDisposableCiTargets } from '../../../../../scripts/ci/verify-disposable-targets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECKOUT = path.resolve(HERE, '../../../../..');
const PROOFS = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
export const PRIVATE_ROOT = '/Users/SaintNick/.codex/tmp/cortex-release-ci-targets-20261031';
export const REPO = 'SaintNick1214/Project-Cortex';
const AUTHOR = '/root/release_ci_target_recovery';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const OLD = ['steady-snake-253', 'usable-sheep-908'];
const ALLOWLIST = 'CORTEX_CI_DISPOSABLE_DEPLOYMENTS';
const ROLES = ['sdk', 'cli'];
const ACTIVE = ['queued', 'in_progress', 'waiting', 'requested', 'pending'];
const RUNBOOK = 'node ' + fileURLToPath(import.meta.url);
const help = `Default: dry-run (local reads only).\nFuture actions require Node24.15.0/npm12.2.0 and a non-author review:\n  recover.mjs create --execute --review FILE\n  recover.mjs publish PAIR_UUID --execute --review FILE\n  recover.mjs cleanup PAIR_UUID --execute --review FILE\nPrivate state: ${PRIVATE_ROOT}\nNo workflow dispatch, deployment, inference, auth or model selector changes.\n`;

export function parseArgs(args) {
  if (!args.length || (args.length === 1 && ['dry-run', '--dry-run', '--help'].includes(args[0]))) return { action: 'dry-run' };
  const [action, ...rest] = args;
  assert.ok(['create', 'publish', 'cleanup'].includes(action), 'Unknown action');
  const id = action === 'create' ? undefined : rest.shift();
  if (id !== undefined) assert.match(id, UUID, 'Exact pair UUID required');
  assert.equal(rest.length, 3, 'Explicit --execute --review FILE required');
  assert.equal(rest[0], '--execute'); assert.equal(rest[1], '--review');
  assert.ok(rest[2] && !rest[2].startsWith('-'), 'Review file required');
  return { action, id, review: path.resolve(rest[2]) };
}

export async function sourceDigest() {
  const files = [fileURLToPath(import.meta.url), path.join(HERE, 'recovery.test.mjs'), path.join(HERE, 'README.md'),
    ...['runner.mjs', 'cloud.mjs', 'cloud-config.json'].map(name => path.join(PROOFS, 'sandbox-env', name)),
    path.join(CHECKOUT, 'scripts/ci/verify-disposable-targets.mjs'), path.join(CHECKOUT, '.github/workflows/managed-ci.yml'),
    path.join(CHECKOUT, '.github/workflows/pr-checks.yml')];
  const digest = createHash('sha256');
  for (const file of files) { digest.update(file + '\0'); digest.update(await fs.readFile(file)); digest.update('\0'); }
  return digest.digest('hex');
}

async function checkReview(file) {
  const stat = await fs.lstat(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid(), 'Owned regular review file required');
  const review = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(review.verdict, 'PASS'); assert.equal(review.breakingFindings, 0);
  assert.ok(typeof review.reviewer === 'string' && review.reviewer.startsWith('/root/') && review.reviewer !== AUTHOR, 'Non-author review required');
  assert.equal(review.sourceDigest, await sourceDigest(), 'Review is stale for current helper or reused guards');
}

async function directory(dir, create = false) {
  if (create) await fs.mkdir(dir, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const stat = await fs.lstat(dir);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700, 'Owned nonsymlink0700 private directory required');
}

async function syncFile(file) {
  const handle = await fs.open(file, 'r'); try { await handle.sync(); } finally { await handle.close(); }
  const parent = await fs.open(path.dirname(file), 'r'); try { await parent.sync(); } finally { await parent.close(); }
}

async function save(root, pair) {
  const file = path.join(root, pair.id + '.json');
  await runner.privateWrite(file, JSON.stringify(pair, null, 2) + '\n'); await syncFile(file);
}

async function load(root, id) {
  assert.match(id, UUID); await directory(root);
  const file = path.join(root, id + '.json'), stat = await fs.lstat(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600, 'Private pair journal required');
  const pair = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(pair.version, 1); assert.equal(pair.id, id); assert.equal(pair.repository, REPO);
  assert.equal(pair.ownerUid, process.getuid()); assert.equal(pair.privateRoot, root);
  assert.match(pair.sessions.sdk, UUID); assert.match(pair.sessions.cli, UUID); assert.notEqual(pair.sessions.sdk, pair.sessions.cli);
  return pair;
}

async function contexts(root, pair, deps) {
  const sessions = {}, contexts = {};
  for (const role of ROLES) {
    sessions[role] = await deps.runner.loadSession(root, pair.sessions[role]);
    const ctx = await deps.runner.createContext(sessions[role], { logger: () => {} });
    const persist = ctx.persist;
    ctx.persist = async () => {
      await persist(); await syncFile(path.join(sessions[role].runDir, 'session.json'));
      const intent = sessions[role].cloudIntent;
      if (intent) pair.cleanupPlan[role] = { reference: intent.reference, expiresAt: intent.expiresAt,
        keyName: 'cortex-sandbox-' + sessions[role].id, target: sessions[role].target, status: intent.status };
      await save(root, pair);
    };
    contexts[role] = ctx;
  }
  return { sessions, contexts };
}

function json(output) { return JSON.parse(output.stdout); }
async function gh(ctx, label, args, input) {
  return ctx.command('github-' + label, 'gh', args, { ...(input === undefined ? {} : { input }), timeoutMs: 120000 });
}

/** Fail closed on any noncompleted run in either workflow that can own the shared lifecycle. */
export async function githubSnapshot(ctx, expectedId) {
  const repo = json(await gh(ctx, 'repo', ['api', 'repos/' + REPO]));
  assert.equal(repo.full_name, REPO); assert.equal(repo.owner?.login, 'SaintNick1214'); assert.equal(repo.name, 'Project-Cortex');
  assert.equal(repo.private, false); assert.equal(repo.archived, false); assert.ok(Number.isSafeInteger(repo.id) && repo.id > 0);
  if (expectedId) assert.equal(repo.id, expectedId, 'Repository identity drift');
  for (const status of ACTIVE) {
    const pages = json(await gh(ctx, 'idle-' + status.replaceAll('_', '-'), ['api', '--paginate', '--slurp',
      `repos/${REPO}/actions/runs?status=${status}&per_page=100`]));
    assert.ok(Array.isArray(pages) && pages.length > 0, 'Missing run inventory');
    for (const page of pages) {
      assert.ok(Array.isArray(page.workflow_runs), 'Invalid run inventory');
      for (const run of page.workflow_runs) {
        assert.equal(run.repository?.id, repo.id, 'Run repository identity mismatch');
        assert.ok(typeof run.path === 'string', 'Run workflow identity missing');
        assert.ok(!/^\.github\/workflows\/(?:pr-checks|managed-ci)\.yml(?:@|$)/.test(run.path) || run.status === 'completed',
          'Shared managed lifecycle is active or pending; wait before selector mutation or deletion');
      }
    }
  }
  const variable = json(await gh(ctx, 'selectors', ['api', `repos/${REPO}/actions/variables/${ALLOWLIST}`]));
  assert.equal(variable.name, ALLOWLIST);
  const selected = JSON.parse(variable.value);
  assert.ok(Array.isArray(selected) && selected.length >= 2 && selected.length <= 16 && selected.every(name => typeof name === 'string'), 'Invalid current selector allowlist');
  return { repositoryId: repo.id, selected, observedAt: new Date().toISOString() };
}

function assertTarget(target, session) {
  assert.ok(target); assert.equal(target.teamId, 325340); assert.equal(target.projectId, 3200658);
  assert.equal(target.kind, 'cloud'); assert.equal(target.deploymentType, 'dev'); assert.equal(target.isDefault, false);
  assert.equal(target.reference, 'dev/cortex-sandbox-' + session.id); assert.equal(target.serverExpiryVerified, true);
  assert.equal(target.expiresAt, session.cloudIntent.expiresAt);
  assert.ok(target.expiresAt > Date.now() && target.expiresAt - session.cloudIntent.createdAt <= 7 * 86400000);
  assert.equal(target.deploymentUrl, `https://${target.name}.convex.cloud`);
}

async function verifyPair(pair, sessions, contexts, deps) {
  const targets = [];
  for (const role of ROLES) {
    const target = await deps.cloud.verifyCloud(sessions[role], contexts[role]); assertTarget(target, sessions[role]); targets.push(target);
  }
  assert.notEqual(targets[0].id, targets[1].id); assert.notEqual(targets[0].name, targets[1].name);
  assert.notEqual(targets[0].reference, targets[1].reference);
  pair.targets = targets;
  return targets;
}

async function cleanup(root, pair, sessions, contexts, deps) {
  const snapshot = await githubSnapshot(contexts.sdk, pair.repositoryId);
  pair.repositoryId = snapshot.repositoryId;
  for (const role of ROLES) {
    const session = sessions[role];
    // Reconcile through the maintained API before checking selectors; no unverified deletion is possible.
    if (session.cloudIntent) {
      const previous = session.target?.name;
      assert.ok(!previous || !snapshot.selected.includes(previous), 'Refuse to delete a selected CI target');
      // deleteCloud reconciles an unknown creation; intercept its final delete intent before any DELETE POST.
      const receipt = contexts[role].receipt;
      contexts[role].receipt = async (name, data) => {
        if (name === 'cloud-delete-intent') {
          const fresh = await githubSnapshot(contexts.sdk, pair.repositoryId);
          assert.ok(!fresh.selected.includes(data.target.name), 'Refuse to delete an active CI selector');
          assert.equal(pair.phase === 'PUBLISH_UNCERTAIN' || pair.phase === 'PUBLISHING', false, 'Resolve uncertain publication before deleting targets');
        }
        await receipt(name, data);
      };
      try { await deps.cloud.deleteCloud(session, contexts[role]); }
      finally { contexts[role].receipt = receipt; }
      await fs.rm(session.deploymentKeyPath, { force: true });
    }
  }
  pair.phase = 'CLEANED'; pair.cleanedAt = new Date().toISOString(); await save(root, pair);
}

/** Dependency injection is used only by local fixtures; CLI always selects the maintained real APIs. */
export async function recover(action, { root = PRIVATE_ROOT, deps = { runner, cloud }, reviewChecked = false } = {}) {
  assert.ok(reviewChecked, 'Non-author source review must be checked before any mutation');
  assert.equal(process.version, 'v24.15.0', 'Pinned Node24.15.0 required');
  const config = JSON.parse(await fs.readFile(path.join(PROOFS, 'sandbox-env/cloud-config.json'), 'utf8'));
  assert.equal(config.teamId, 325340); assert.equal(config.projectId, 3200658); assert.equal(config.projectSlug, 'cortex-sandboxes');
  let pair;
  if (action.action === 'create') {
    await directory(root, true);
    const sdk = await deps.runner.newSession(root, 'ci-release-window'), cli = await deps.runner.newSession(root, 'ci-release-window');
    pair = { version: 1, id: randomUUID(), ownerUid: process.getuid(), privateRoot: root, repository: REPO,
      createdAt: new Date().toISOString(), phase: 'PLANNED', sessions: { sdk: sdk.id, cli: cli.id },
      cleanupPlan: Object.fromEntries([sdk, cli].map((session, i) => [ROLES[i], { reference: 'dev/cortex-sandbox-' + session.id,
        keyName: 'cortex-sandbox-' + session.id, expiresAt: null, status: 'not-issued' }])),
      retention: 'Only after successful selector publication; finite server expiry, exact owned cleanup after detachment',
      publication: {}, cleanupCommand: `${RUNBOOK} cleanup PAIR --execute --review FILE`, recoveryCommand: null };
    pair.cleanupCommand = `${RUNBOOK} cleanup ${pair.id} --execute --review FILE`;
    pair.recoveryCommand = `${RUNBOOK} publish ${pair.id} --execute --review FILE`;
    await save(root, pair);
  } else pair = await load(root, action.id);
  const lockingSession = await deps.runner.loadSession(root, pair.sessions.sdk);
  return deps.runner.sessionActionLock(lockingSession, async () => {
    // Reload after acquiring the shared pair lock so concurrent invocations cannot use stale phase/selector state.
    const current = await load(root, pair.id); Object.assign(pair, current);
    const { sessions, contexts: ctx } = await contexts(root, pair, deps);
    const npm = await ctx.sdk.command('pinned-npm', process.execPath, [ctx.sdk.npmCli, '--version']); assert.equal(npm.stdout.trim(), '12.2.0');
    if (action.action === 'cleanup') { await cleanup(root, pair, sessions, ctx, deps); return { pairId: pair.id, phase: pair.phase }; }
    if (action.action === 'create') {
      try {
        const snapshot = await githubSnapshot(ctx.sdk); pair.repositoryId = snapshot.repositoryId; await save(root, pair);
        assert.deepEqual([...snapshot.selected].sort(), [...OLD].sort(), 'Recovery baseline selectors changed');
        pair.phase = 'CREATING'; await save(root, pair);
        for (const role of ROLES) await deps.cloud.createCloud(sessions[role], ctx[role]);
        await verifyPair(pair, sessions, ctx, deps); await save(root, pair);
        for (const role of ROLES) {
          pair.keyIntent = { role, name: 'cortex-sandbox-' + sessions[role].id, status: 'issued' }; await save(root, pair);
          await deps.cloud.getDeployKey(sessions[role], ctx[role]);
        }
        pair.phase = 'READY_TO_PUBLISH'; pair.keyIntent = null; await save(root, pair);
      } catch {
        pair.phase = 'CREATE_FAILED'; await save(root, pair);
        try { await cleanup(root, pair, sessions, ctx, deps); }
        catch { pair.phase = 'CLEANUP_REQUIRED'; await save(root, pair); }
        throw Error(`Creation failed; no retry. Private pair ${pair.id} records exact cleanup state (${pair.phase}).`);
      }
    } else {
      assert.ok(['READY_TO_PUBLISH', 'PUBLISHING', 'PUBLISH_UNCERTAIN', 'RETAINED'].includes(pair.phase), 'Pair is not eligible for publication recovery');
      const targets = await verifyPair(pair, sessions, ctx, deps);
      const values = {};
      for (const [i, role] of ROLES.entries()) {
        const stat = await fs.lstat(sessions[role].deploymentKeyPath);
        assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600, 'Private0600 scoped key required');
        const key = await fs.readFile(sessions[role].deploymentKeyPath, 'utf8'), suffix = i ? '_CLI' : '';
        ctx.sdk.registerSecret(key);
        values[`CORTEX_CI_CONVEX_DEPLOY_KEY${suffix}`] = key; values[`CORTEX_CI_CONVEX_URL${suffix}`] = targets[i].deploymentUrl;
      }
      verifyDisposableCiTargets({ CORTEX_CI_DISPOSABLE_DEPLOYMENTS: JSON.stringify(targets.map(t => t.name)),
        CONVEX_DEPLOY_KEY: values.CORTEX_CI_CONVEX_DEPLOY_KEY, CONVEX_DEPLOY_KEY_CLI: values.CORTEX_CI_CONVEX_DEPLOY_KEY_CLI,
        CONVEX_URL: values.CORTEX_CI_CONVEX_URL, CONVEX_URL_CLI: values.CORTEX_CI_CONVEX_URL_CLI });
      try {
        for (const [name, value] of Object.entries(values)) {
          const snapshot = await githubSnapshot(ctx.sdk, pair.repositoryId);
          assert.ok([OLD, targets.map(t => t.name)].some(names => JSON.stringify([...names].sort()) === JSON.stringify([...snapshot.selected].sort())), 'Unexpected selector change during recovery');
          pair.phase = 'PUBLISHING'; pair.publication[name] = 'issued'; await save(root, pair);
          await gh(ctx.sdk, 'secret-' + name.replaceAll('_', '-'), ['secret', 'set', name, '--repo', REPO], value);
          pair.publication[name] = 'confirmed'; await save(root, pair);
        }
        const beforeAllowlist = await githubSnapshot(ctx.sdk, pair.repositoryId);
        assert.ok([OLD, targets.map(t => t.name)].some(names => JSON.stringify([...names].sort()) === JSON.stringify([...beforeAllowlist.selected].sort())), 'Unexpected selector change before allowlist publication');
        pair.publication[ALLOWLIST] = 'issued'; await save(root, pair);
        await gh(ctx.sdk, 'allowlist', ['api', '--method', 'PATCH', `repos/${REPO}/actions/variables/${ALLOWLIST}`, '--input', '-'],
          JSON.stringify({ name: ALLOWLIST, value: JSON.stringify(targets.map(t => t.name)) }));
        const after = await githubSnapshot(ctx.sdk, pair.repositoryId);
        assert.deepEqual(after.selected, targets.map(t => t.name));
        pair.publication[ALLOWLIST] = 'confirmed'; pair.phase = 'RETAINED';
        pair.expiresAt = Math.min(...targets.map(t => t.expiresAt));
        pair.futureCleanup = { serverExpiresAt: targets.map(t => ({ name: t.name, expiresAt: t.expiresAt })),
          command: pair.cleanupCommand, condition: 'After approved replacement detaches both selectors and shared CI is idle; never delete selected targets',
          fixtureCleanupSeparate: true, fullCiRerunBlockedUntilGenuineModelRenewal: true };
        await save(root, pair);
      } catch {
        pair.phase = 'PUBLISH_UNCERTAIN'; await save(root, pair);
        throw Error(`Publication uncertain; retain pair ${pair.id}. Explicit publish recovery must finish before cleanup. No workflow was dispatched.`);
      }
    }
    return { pairId: pair.id, phase: pair.phase, targets: pair.targets?.map(({ name, expiresAt }) => ({ name, expiresAt })),
      privateState: path.join(root, pair.id + '.json'), fullCiRerunBlockedUntilGenuineModelRenewal: true };
  });
}

export async function main(args = process.argv.slice(2)) {
  const action = parseArgs(args);
  if (action.action === 'dry-run') {
    process.stdout.write(help + `Source digest for independent review: ${await sourceDigest()}\nDry run performs no writes or remote calls. Full CI remains blocked on genuine model renewal.\n`);
    return;
  }
  await checkReview(action.review);
  process.stdout.write(JSON.stringify(await recover(action, { reviewChecked: true }), null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write('Recovery stopped. Inspect the owned private pair journal/receipts; no automatic mutation retry.\n'); process.exitCode = 1; });
}
