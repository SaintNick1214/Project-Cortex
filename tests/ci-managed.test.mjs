import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { aggregateManaged, assertCurrentCandidate, assertManagedTrust, managedJobs, requiredManagedJobs } from '../scripts/ci-managed.mjs';

const sha = 'a'.repeat(40), repository = 'owner/cortex';
const selection = { trusted: true, mode: 'ready', selected: [...managedJobs] };
const outcomes = selected => Object.fromEntries(managedJobs.map(job => [job, { result: selected.includes(job) ? 'success' : 'skipped' }]));
const pr = () => ({ eventName: 'pull_request', repository, actor: 'maintainer', ref: 'refs/pull/42/merge', sha, event: { number: 42, sender: { type: 'User' }, pull_request: { number: 42, draft: false, head: { sha, repo: { full_name: repository } }, user: { type: 'User', login: 'contributor' } } } });
const currentPr = () => ({ ...pr().event.pull_request, state: 'open' });

test('full and provider-only lifecycle receipts retain exact selected and observed leaves', () => {
  for (const selected of [managedJobs, ['setup-and-purge', 'test-vercel-ai-provider', 'cleanup-runtime-fixtures'], ['setup-and-purge', 'test-cli', 'cleanup-runtime-fixtures']]) {
    const receipt = aggregateManaged({ ...selection, selected }, outcomes(selected), sha);
    assert.equal(receipt.passed, true);
    assert.equal(receipt.kind, 'managed-functional');
    assert.equal(receipt.sha, sha);
    assert.deepEqual(receipt.selected, selected);
    assert.deepEqual(receipt.outcomes, outcomes(selected));
    assert.deepEqual(receipt.reasons, []);
  }
});

test('every selected leaf fails closed on failure, cancellation, missing and unexpected skip', () => {
  for (const job of managedJobs) for (const result of ['failure', 'cancelled', 'skipped', undefined, 'in_progress']) {
    const needs = outcomes(managedJobs); needs[job] = { result };
    const receipt = aggregateManaged(selection, needs, sha);
    assert.equal(receipt.passed, false, `${job}: ${result}`);
    assert.match(receipt.reasons.join('\n'), new RegExp(job));
  }
});

test('unselected leaves must be observed skipped and unknown jobs are rejected', () => {
  const selected = ['setup-and-purge', 'test-cli', 'cleanup-runtime-fixtures'];
  for (const result of ['success', 'failure', 'cancelled', undefined]) {
    const needs = outcomes(selected); needs['test-typescript'] = { result };
    assert.equal(aggregateManaged({ ...selection, selected }, needs, sha).passed, false);
  }
  const needs = outcomes(managedJobs); needs['unclassified-suite'] = { result: 'success' };
  assert.match(aggregateManaged(selection, needs, sha).reasons.join('\n'), /unclassified/);
});

test('malformed, deferred, untrusted and preparation-only selections cannot yield a receipt', () => {
  for (const input of [null, {}, { ...selection, trusted: false }, { ...selection, mode: 'draft-fast' }, { ...selection, selected: ['test-cli'] }, { ...selection, selected: ['setup-and-purge'] }, { ...selection, selected: ['setup-and-purge', 'test-cli'] }, { ...selection, selected: ['setup-and-purge', 'cleanup-runtime-fixtures'] }, { ...selection, selected: [...managedJobs, 'test-cli'] }]) assert.throws(() => requiredManagedJobs(input));
  assert.throws(() => aggregateManaged(selection, null, sha));
  assert.throws(() => aggregateManaged(selection, outcomes(managedJobs), 'main'));
});

test('live ready PR lookup verifies the same exact candidate through a read-only endpoint', async () => {
  const paths = [];
  const receipt = await assertCurrentCandidate(pr(), async path => { paths.push(path); return currentPr(); });
  assert.deepEqual(paths, ['/repos/owner/cortex/pulls/42']);
  assert.deepEqual(receipt, { kind: 'current-candidate', sha, event: 'pull_request' });
});

for (const reason of ['moved', 'draft', 'closed', 'fork', 'bot', 'missing-sha', 'unavailable']) test(`${reason} candidate is refused before preparation`, async () => {
  const current = currentPr();
  if (reason === 'moved') current.head.sha = 'b'.repeat(40);
  if (reason === 'draft') current.draft = true;
  if (reason === 'closed') current.state = 'closed';
  if (reason === 'fork') current.head.repo.full_name = 'fork/cortex';
  if (reason === 'bot') current.user.type = 'Bot';
  if (reason === 'missing-sha') delete current.head.sha;
  await assert.rejects(assertCurrentCandidate(pr(), async () => { if (reason === 'unavailable') throw new Error('lookup unavailable'); return current; }));
});

test('main pushes and manual branches compare their current Git ref commit', async () => {
  for (const [eventName, actor, ref, expected] of [['push', 'dependabot[bot]', 'refs/heads/main', '/repos/owner/cortex/git/ref/heads/main'], ['workflow_dispatch', 'maintainer', 'refs/heads/codex/queue', '/repos/owner/cortex/git/ref/heads/codex/queue']]) {
    const input = { eventName, actor, ref, repository, sha, event: {} };
    const paths = [];
    assert.equal((await assertCurrentCandidate(input, async path => { paths.push(path); return { object: { type: 'commit', sha } }; })).sha, sha);
    assert.deepEqual(paths, [expected]);
    await assert.rejects(assertCurrentCandidate(input, async () => ({ object: { type: 'commit', sha: 'b'.repeat(40) } })), /Stale candidate/);
    await assert.rejects(assertCurrentCandidate(input, async () => ({ object: { type: 'tag', sha } })), /commit/);
  }
});

test('invalid trust, candidate and ref metadata never performs a lookup', async () => {
  for (const mutate of [input => { input.actor = 'renovate[bot]'; }, input => { input.event.sender.type = 'Bot'; }, input => { input.event.pull_request.draft = true; }, input => { input.event.pull_request.head.repo.full_name = 'fork/cortex'; }, input => { input.event.pull_request.user.type = 'Bot'; }, input => { input.event.pull_request.number = 0; }, input => { input.sha = 'main'; }, input => { input.repository = '../other'; }]) {
    const input = pr(); mutate(input);
    let calls = 0;
    await assert.rejects(assertCurrentCandidate(input, async () => { calls++; return currentPr(); }));
    assert.equal(calls, 0);
  }
  for (const ref of ['refs/tags/v1', 'refs/heads/../main', 'refs/heads/branch?query', 'refs/heads/']) await assert.rejects(assertCurrentCandidate({ eventName: 'workflow_dispatch', actor: 'maintainer', repository, event: {}, ref, sha }, async () => { throw new Error('unexpected lookup'); }));
  assert.throws(() => assertManagedTrust({ eventName: 'push', repository, ref: 'refs/heads/dev' }));
});

test('managed aggregate executable writes an observed receipt and returns failure for missing leaves', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cortex-managed-contract-'));
  try {
    const output = join(directory, 'output'), summary = join(directory, 'summary');
    const env = { ...process.env, CI_SELECTION: JSON.stringify(selection), CI_NEEDS: JSON.stringify(outcomes(managedJobs)), CI_CANDIDATE_SHA: sha, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary };
    const run = spawnSync(process.execPath, ['scripts/ci-managed.mjs', 'aggregate'], { env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(readFileSync(output, 'utf8').trim().slice('receipt='.length)).passed, true);
    assert.match(readFileSync(summary, 'utf8'), /Result: PASS/);
    const failed = spawnSync(process.execPath, ['scripts/ci-managed.mjs', 'aggregate'], { env: { ...env, CI_NEEDS: '{}' }, encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.match(readFileSync(summary, 'utf8'), /test-typescript: required success, received missing/);
    assert.equal(spawnSync(process.execPath, ['scripts/ci-managed.mjs', 'unknown'], { encoding: 'utf8' }).status, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
