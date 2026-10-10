import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { changedCiPaths, selectCi, aggregateCi, aggregateParentCi, ciSummary, ciJobs, offlineUnitFiles } from '../scripts/ci-contract.mjs';
import { aggregateManaged, managedJobs } from '../scripts/ci-managed.mjs';
const { load } = yaml;

const repository = 'owner/cortex';
const pr = (overrides = {}) => ({ eventName: 'pull_request', repository, actor: 'maintainer', ref: 'refs/pull/42/merge', files: ['src/index.ts'], event: { action: 'synchronize', sender: { type: 'User' }, pull_request: { draft: false, head: { repo: { full_name: repository } }, user: { type: 'User', login: 'contributor' } } }, ...overrides });
const outcomes = selection => Object.fromEntries(ciJobs.map(job => [job, { result: selection.selected.includes(job) ? 'success' : 'skipped' }]));

for (const action of ['opened', 'ready_for_review', 'synchronize', 'reopened']) test(`trusted ${action} candidate retains full backend/consumer qualification`, () => {
  const input = pr(); input.event.action = action;
  const selected = selectCi(input);
  assert.equal(selected.trusted, true);
  assert.equal(selected.mode, 'ready');
  assert.deepEqual(new Set(selected.selected), new Set(ciJobs));
  assert.equal(selected.demos.length, 3);
  assert.deepEqual(selected.deferred, []);
  assert.deepEqual(selected.unavailable, []);
  assert.equal(aggregateCi(selected, outcomes(selected)).passed, true);
});

test('drafts defer every affected service while root and consumer offline checks execute', () => {
  const input = pr(); input.event.pull_request.draft = true;
  const selected = selectCi(input);
  assert.equal(selected.mode, 'draft-fast');
  assert.deepEqual(selected.selected, ['detect-changes', 'code-quality', 'public-contracts', 'offline-packages', 'template-catalog']);
  assert.ok(selected.deferred.includes('test-typescript'));
  assert.ok(selected.deferred.includes('native-proof-contracts'));
  assert.equal(selected.unavailable.length, 0);
  const result = aggregateCi(selected, outcomes(selected));
  assert.equal(result.passed, true);
  assert.ok(!result.executed.includes('test-typescript'));
  assert.match(ciSummary(result), /Deferred draft coverage.*not completed proof/);
});

for (const trust of ['fork', 'dependabot', 'bot-author', 'bot-sender', 'missing-actor']) test(`${trust} receives stable secret-free checks and unavailable service coverage`, () => {
  const input = pr();
  if (trust === 'fork') input.event.pull_request.head.repo.full_name = 'fork/cortex';
  if (trust === 'dependabot') input.actor = 'dependabot[bot]';
  if (trust === 'bot-author') input.event.pull_request.user = { type: 'Bot', login: 'dependabot[bot]' };
  if (trust === 'bot-sender') input.event.sender.type = 'Bot';
  if (trust === 'missing-actor') delete input.actor;
  const selected = selectCi(input);
  assert.equal(selected.trusted, false);
  assert.equal(selected.mode, 'untrusted-fast');
  assert.ok(selected.selected.includes('code-quality'));
  assert.ok(selected.selected.includes('public-contracts'));
  assert.ok(selected.selected.includes('offline-packages'));
  assert.ok(selected.unavailable.includes('setup-and-purge'));
  assert.ok(selected.unavailable.includes('test-typescript'));
  assert.equal(selected.deferred.length, 0);
  const result = aggregateCi(selected, outcomes(selected));
  assert.equal(result.passed, true);
  assert.ok(!result.executed.includes('native-proof-contracts'));
});

test('documentation, security and release helpers avoid unrelated managed/demo/native work', () => {
  for (const files of [['README.md', 'packages/cortex-cli/README.md', '_research/report.md'], ['.github/workflows/security.yml', '.github/codeql/codeql-config.yml', 'scripts/security-contract.mjs', 'tests/security-pipeline.test.mjs'], ['.github/workflows/auto-merge.yml'], ['.github/workflows/publish.yml', 'scripts/release-contract.mjs', 'tests/release-pipeline.test.mjs']]) {
    const selected = selectCi(pr({ files }));
    assert.equal(selected.sourcePipeline, false);
    assert.deepEqual(selected.selected, ['detect-changes', 'code-quality', 'public-contracts']);
    assert.deepEqual(selected.demos, []);
    assert.equal(aggregateCi(selected, outcomes(selected)).passed, true);
  }
});

for (const file of ['convex-dev/schema.ts', 'convex-dev/_generated/api.d.ts', 'convex.json', 'src/index.ts', 'package-lock.json', 'package.json', 'tsconfig.json', 'jest.config.mjs', '.github/workflows/pr-checks.yml', '.github/workflows/managed-ci.yml', '.github/actions/setup/action.yml', 'scripts/prepare-ci-backend.mjs', 'scripts/ci-contract.mjs', 'scripts/ci-managed.mjs', 'scripts/ci-candidate-artifacts.mjs', 'scripts/ci/prepare-fixtures.mjs', 'tests/ci-managed.test.mjs', 'tests/ci-candidate-artifacts.test.mjs']) test(`${file} conservatively covers every consumer`, () => {
  const selected = selectCi(pr({ files: [file] }));
  assert.deepEqual(new Set(selected.selected), new Set(ciJobs));
  assert.equal(selected.demos.length, 3);
});

test('provider changes cover both provider consumers without unrelated SDK/native suites', () => {
  const selected = selectCi(pr({ files: ['packages/vercel-ai-provider/react/index.ts'] }));
  assert.equal(selected.provider, true);
  assert.equal(selected.cli, false);
  assert.deepEqual(selected.demos, ['packages/cortex-cli/templates/chat-sdk-quickstart', 'packages/vercel-ai-provider/quickstart']);
  assert.ok(selected.selected.includes('test-vercel-ai-provider'));
  assert.ok(!selected.selected.includes('test-typescript'));
  assert.ok(!selected.selected.includes('native-proof-contracts'));
});

test('CLI/template/catalog changes preserve composer, candidate and catalog closure', () => {
  for (const file of ['packages/cortex-cli/src/commands/init.ts', 'packages/cortex-cli/templates/basic/src/index.ts']) {
    const selected = selectCi(pr({ files: [file] }));
    assert.equal(selected.cli, true);
    assert.ok(selected.selected.includes('test-cli'));
    assert.ok(selected.selected.includes('template-catalog'));
    assert.equal(selected.demos.length, 3);
    assert.ok(!selected.selected.includes('test-typescript'));
  }
  const catalog = selectCi(pr({ files: ['packages/cortex-templates/catalog.json'] }));
  assert.equal(catalog.catalog, true);
  assert.equal(catalog.demos.length, 3);
  assert.ok(!catalog.selected.includes('setup-and-purge'));
  const demo = selectCi(pr({ files: ['packages/vercel-ai-provider/quickstart/app/page.tsx'] }));
  assert.deepEqual(demo.demos, ['packages/vercel-ai-provider/quickstart']);
  assert.ok(!demo.selected.includes('test-vercel-ai-provider'));
});

test('main always qualifies full coverage, including docs-only and bot main pushes', () => {
  for (const actor of ['maintainer', 'dependabot[bot]']) {
    const selected = selectCi({ eventName: 'push', event: { sender: { type: actor.endsWith('[bot]') ? 'Bot' : 'User' } }, repository, actor, ref: 'refs/heads/main', files: ['README.md'] });
    assert.equal(selected.forceFull, true);
    assert.deepEqual(new Set(selected.selected), new Set(ciJobs));
  }
});

test('manual full validation is explicit; bot dispatch cannot obtain managed secrets', () => {
  const input = { eventName: 'workflow_dispatch', repository, actor: 'maintainer', ref: 'refs/heads/dev', files: [] };
  assert.deepEqual(selectCi(input).selected, ['detect-changes', 'code-quality', 'public-contracts']);
  assert.deepEqual(new Set(selectCi({ ...input, fullCi: true }).selected), new Set(ciJobs));
  const botSelection = selectCi({ ...input, fullCi: true, actor: 'renovate[bot]' });
  assert.ok(!botSelection.selected.includes('setup-and-purge'));
  assert.ok(botSelection.unavailable.includes('test-typescript'));
});

test('release flags preserve existing exact-source package-path channels', () => {
  assert.deepEqual(selectCi(pr({ files: ['packages/cortex-cli/templates/basic/package.json'] })).delivery, { sdk: false, provider: false, cli: false, templates: true });
  assert.deepEqual(selectCi(pr({ files: ['src/index.ts', 'packages/vercel-ai-provider/react/index.ts', 'packages/cortex-cli/src/index.ts'] })).delivery, { sdk: true, provider: true, cli: true, templates: false });
});

test('invalid events, incomplete trust metadata and invalid relative paths fail closed', () => {
  for (const input of [pr({ eventName: 'pull_request_target' }), pr({ repository: '' }), pr({ files: undefined }), pr({ files: ['../elsewhere'] }), pr({ event: {} }), pr({ fullCi: 'true' }), { ...pr(), eventName: 'push', ref: 'refs/heads/dev' }]) assert.throws(() => selectCi(input));
});

const moves = [
  { name: 'SDK source to documentation', from: 'src/contract.ts', to: 'contract.md', full: true, delivery: { sdk: true, provider: false, cli: false, templates: false } },
  { name: 'test source to documentation', from: 'tests/contract.test.ts', to: 'contract.md', full: true, delivery: { sdk: false, provider: false, cli: false, templates: false } },
  { name: 'CLI source to provider', from: 'packages/cortex-cli/src/contract.ts', to: 'packages/vercel-ai-provider/src/contract.ts', full: false, delivery: { sdk: false, provider: true, cli: true, templates: false } },
  { name: 'provider source to template catalog', from: 'packages/vercel-ai-provider/src/contract.ts', to: 'packages/cortex-templates/contract.ts', full: false, delivery: { sdk: false, provider: true, cli: false, templates: true } },
];
for (const move of moves) test(`actual workflow extraction retains both endpoints: ${move.name}`, () => {
  const directory = mkdtempSync(join(tmpdir(), 'cortex-ci-git-move-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=CI Fixture', '-c', 'user.email=ci-fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: directory, encoding: 'utf8' });
  try {
    git('init', '--quiet'); git('config', 'diff.renames', 'true');
    mkdirSync(dirname(join(directory, move.from)), { recursive: true });
    writeFileSync(join(directory, move.from), 'export const fixture = "unchanged move";\n');
    git('add', '--all'); git('commit', '--quiet', '-m', 'fixture before');
    const baseSha = git('rev-parse', 'HEAD').trim();
    mkdirSync(dirname(join(directory, move.to)), { recursive: true });
    renameSync(join(directory, move.from), join(directory, move.to));
    git('add', '--all'); git('commit', '--quiet', '-m', 'fixture moved');
    const headSha = git('rev-parse', 'HEAD').trim();
    // Prove this fixture exercises Git's otherwise lossy R100 name-only result.
    assert.match(git('diff', '--name-status', baseSha, headSha), /^R100\s/);
    assert.deepEqual(git('diff', '--name-only', '-z', baseSha, headSha).split('\0').filter(Boolean), [move.to]);
    const files = changedCiPaths(baseSha, headSha, directory);
    assert.deepEqual(new Set(files), new Set([move.from, move.to]));
    const selection = selectCi(pr({ files }));
    assert.deepEqual(selection.delivery, move.delivery);
    if (move.full) assert.deepEqual(new Set(selection.selected), new Set(ciJobs));
    else {
      assert.ok(selection.selected.includes('test-vercel-ai-provider'));
      assert.ok(selection.selected.includes('template-catalog'));
      assert.ok(selection.selected.includes('demo-contracts'));
      if (move.delivery.cli) assert.ok(selection.selected.includes('test-cli'));
    }
    // Execute the same no-argument extraction entrypoint used by pr-checks.yml.
    const eventPath = join(directory, 'event.json'), outputPath = join(directory, 'output');
    writeFileSync(eventPath, JSON.stringify(pr().event));
    const env = { ...process.env, BASE_SHA: baseSha, HEAD_SHA: headSha, GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: repository, GITHUB_ACTOR: 'maintainer', GITHUB_REF: 'refs/pull/42/merge', GITHUB_OUTPUT: outputPath };
    const run = spawnSync(process.execPath, [resolve('scripts/ci-contract.mjs'), 'select'], { cwd: directory, env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const selectedLine = readFileSync(outputPath, 'utf8').split('\n').find(line => line.startsWith('selection='));
    assert.deepEqual(JSON.parse(selectedLine.slice('selection='.length)).selected, selection.selected);
    const push = spawnSync(process.execPath, [resolve('scripts/ci-contract.mjs'), 'select'], { cwd: directory, env: { ...env, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: headSha }, encoding: 'utf8' });
    assert.equal(push.status, 0, push.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'delivery-paths.json'), 'utf8')), { sha: headSha, ...move.delivery });
    assert.deepEqual(changedCiPaths('0'.repeat(40), headSha, directory), [move.to]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('change extraction rejects absent or non-commit inputs before invoking Git', () => {
  for (const [base, head] of [[undefined, undefined], ['main', 'a'.repeat(40)], ['a'.repeat(40), '--help'], ['a'.repeat(40), '0'.repeat(40)]]) assert.throws(() => changedCiPaths(base, head), /Exact base and nonzero head commits required/);
  assert.throws(() => changedCiPaths('a'.repeat(40), 'b'.repeat(40), '/missing/cortex-ci-fixture'));
});

test('failed, cancelled, skipped, missing or incomplete selected jobs cannot pass', () => {
  const selected = selectCi(pr());
  for (const job of ciJobs) for (const result of ['failure', 'cancelled', 'skipped', undefined, 'in_progress']) {
    const needs = outcomes(selected); needs[job] = { result };
    const actual = aggregateCi(selected, needs);
    assert.equal(actual.passed, false, `${job}: ${result}`);
    assert.ok(actual.reasons.some(reason => reason.startsWith(`${job}:`)));
  }
  const needs = outcomes(selected); delete needs['test-typescript'];
  assert.equal(aggregateCi(selected, needs).passed, false);
});

test('backend preparation failure preserves observed independent offline results and fails service proof', () => {
  const selected = selectCi(pr());
  const needs = outcomes(selected);
  needs['setup-and-purge'].result = 'failure';
  for (const job of ['test-typescript', 'test-vercel-ai-provider', 'test-cli']) needs[job].result = 'skipped';
  const result = aggregateCi(selected, needs);
  assert.equal(result.passed, false);
  assert.ok(result.executed.includes('code-quality'));
  assert.ok(result.executed.includes('public-contracts'));
  assert.ok(result.executed.includes('offline-packages'));
  assert.equal(result.reasons.length, 4);
  assert.match(ciSummary(result), /test-typescript: required success, received skipped/);
});

test('intentional skips are bounded; unknown/missing/unexpected jobs are not silently accepted', () => {
  const selected = selectCi(pr({ files: ['README.md'] }));
  for (const result of ['cancelled', 'failure', 'success', undefined]) {
    const needs = outcomes(selected); needs['test-typescript'] = { result };
    assert.equal(aggregateCi(selected, needs).passed, false);
  }
  const needs = outcomes(selected); needs['new-required-suite'] = { result: 'skipped' };
  assert.match(aggregateCi(selected, needs).reasons.join('\n'), /unclassified job/);
  assert.throws(() => aggregateCi({ ...selected, selected: ['public-contracts'] }, needs), /Invalid required/);
  assert.throws(() => aggregateCi({ ...selected, selected: [...selected.selected, 'unknown'] }, needs), /Invalid required/);
  assert.throws(() => aggregateCi(null, null), /complete job outcomes/);
});

test('offline allowlist exists and excludes live Gateway/lifecycle tests', () => {
  assert.equal(offlineUnitFiles.length, 13);
  assert.equal(new Set(offlineUnitFiles).size, offlineUnitFiles.length);
  for (const file of offlineUnitFiles) assert.ok(readFileSync(resolve(file), 'utf8').length > 0);
  assert.ok(!offlineUnitFiles.includes('tests/unit/runtime/gateway-terminal-composition.test.ts'));
  assert.ok(!offlineUnitFiles.includes('tests/unit/lifecycle.test.ts'));
});

test('CLI selection and final aggregate execute the coverage policy, including a failed exit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cortex-ci-contract-'));
  try {
    const input = pr();
    const eventPath = join(directory, 'event.json'), filesPath = join(directory, 'paths'), outputPath = join(directory, 'output'), summaryPath = join(directory, 'summary');
    writeFileSync(eventPath, JSON.stringify(input.event)); writeFileSync(filesPath, 'README.md\0');
    const env = { ...process.env, GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: input.eventName, GITHUB_REPOSITORY: repository, GITHUB_ACTOR: input.actor, GITHUB_REF: input.ref, GITHUB_OUTPUT: outputPath };
    const selected = spawnSync(process.execPath, ['scripts/ci-contract.mjs', 'select', filesPath], { env, encoding: 'utf8' });
    assert.equal(selected.status, 0, selected.stderr);
    const outputs = Object.fromEntries(readFileSync(outputPath, 'utf8').trim().split('\n').map(line => { const equal = line.indexOf('='); return [line.slice(0, equal), line.slice(equal + 1)]; }));
    const selection = JSON.parse(outputs.selection);
    assert.equal(outputs.managed, 'false');
    const needs = outcomes(selection);
    const aggregate = () => spawnSync(process.execPath, ['scripts/ci-contract.mjs', 'aggregate'], { env: { ...env, GITHUB_STEP_SUMMARY: summaryPath, CI_SELECTION: outputs.selection, CI_NEEDS: JSON.stringify(needs) }, encoding: 'utf8' });
    assert.equal(aggregate().status, 0);
    assert.match(readFileSync(summaryPath, 'utf8'), /PASS for selected coverage/);
    needs['code-quality'].result = 'cancelled';
    assert.equal(aggregate().status, 1);
    assert.match(readFileSync(summaryPath, 'utf8'), /code-quality: required success, received cancelled/);
    const invalid = spawnSync(process.execPath, ['scripts/ci-contract.mjs', 'unknown'], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    // The main delivery artifact retains its exact source SHA and path flags.
    const sha = 'a'.repeat(40);
    writeFileSync(eventPath, JSON.stringify({ sender: { type: 'User' } }));
    writeFileSync(filesPath, 'src/index.ts\0');
    const push = spawnSync(process.execPath, [resolve('scripts/ci-contract.mjs'), 'select', filesPath], { cwd: directory, env: { ...env, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha }, encoding: 'utf8' });
    assert.equal(push.status, 0, push.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'delivery-paths.json'), 'utf8')), { sha, sdk: true, provider: false, cli: false, templates: false });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

const candidateSha = 'a'.repeat(40);
const parentOutcomes = selection => {
  const needs = outcomes(selection);
  const leaves = Object.fromEntries(managedJobs.map(job => [job, needs[job]]));
  for (const job of managedJobs) delete needs[job];
  needs['managed-tests'] = { result: selection.selected.includes('setup-and-purge') ? 'success' : 'skipped', outputs: {} };
  if (needs['managed-tests'].result === 'success') needs['managed-tests'].outputs.receipt = JSON.stringify(aggregateManaged(selection, leaves, candidateSha));
  return needs;
};

test('parent combines actual complete managed leaves with independent offline and candidate outcomes', () => {
  for (const files of [['src/index.ts'], ['packages/vercel-ai-provider/react/index.ts'], ['packages/cortex-cli/src/index.ts'], ['packages/cortex-templates/catalog.json'], ['README.md']]) {
    const selection = selectCi(pr({ files }));
    const result = aggregateParentCi(selection, parentOutcomes(selection), candidateSha);
    assert.equal(result.passed, true, result.reasons.join('\n'));
    assert.deepEqual(new Set(result.executed), new Set(selection.selected));
  }
});

test('parent requires caller success and exact successful inner receipt, with every leaf present', () => {
  const selection = selectCi(pr());
  for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
    const needs = parentOutcomes(selection); needs['managed-tests'].result = result;
    assert.equal(aggregateParentCi(selection, needs, candidateSha).passed, false);
  }
  for (const mutate of [receipt => { receipt.sha = 'b'.repeat(40); }, receipt => { receipt.kind = 'queue-only'; }, receipt => { receipt.schema = 2; }, receipt => { receipt.passed = false; }, receipt => { receipt.selected.pop(); }, receipt => { receipt.reasons.push('incomplete'); }, receipt => { receipt.outcomes.extra = { result: 'success' }; }]) {
    const needs = parentOutcomes(selection), receipt = JSON.parse(needs['managed-tests'].outputs.receipt);
    mutate(receipt); needs['managed-tests'].outputs.receipt = JSON.stringify(receipt);
    assert.equal(aggregateParentCi(selection, needs, candidateSha).passed, false);
  }
  for (const job of managedJobs) for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
    const needs = parentOutcomes(selection), receipt = JSON.parse(needs['managed-tests'].outputs.receipt);
    receipt.outcomes[job] = { result }; needs['managed-tests'].outputs.receipt = JSON.stringify(receipt);
    assert.equal(aggregateParentCi(selection, needs, candidateSha).passed, false, `${job}: ${result}`);
  }
  for (const receipt of ['', '{', undefined]) {
    const needs = parentOutcomes(selection); needs['managed-tests'].outputs.receipt = receipt;
    assert.equal(aggregateParentCi(selection, needs, candidateSha).passed, false);
  }
  const missing = parentOutcomes(selection); delete missing['managed-tests'];
  assert.equal(aggregateParentCi(selection, missing, candidateSha).passed, false);
});

test('parent intentional skips, unclassified jobs and leaf spoofing are bounded', () => {
  const selection = selectCi(pr({ files: ['README.md'] }));
  for (const result of ['success', 'failure', 'cancelled', undefined]) {
    const needs = parentOutcomes(selection); needs['managed-tests'].result = result;
    assert.equal(aggregateParentCi(selection, needs, candidateSha).passed, false);
  }
  const unexpected = parentOutcomes(selection); unexpected['managed-tests'].outputs.receipt = '{}';
  assert.equal(aggregateParentCi(selection, unexpected, candidateSha).passed, false);
  const unknown = parentOutcomes(selection); unknown['extra-job'] = { result: 'success' };
  assert.equal(aggregateParentCi(selection, unknown, candidateSha).passed, false);
  const spoofed = parentOutcomes(selection); spoofed['test-typescript'] = { result: 'success' };
  assert.equal(aggregateParentCi(selection, spoofed, candidateSha).passed, false);
  assert.throws(() => aggregateParentCi(selection, {}, 'main'));
  assert.throws(() => aggregateParentCi(null, null, candidateSha));
});

test('candidate artifacts are required whenever selected demos consume their packages', () => {
  const selection = selectCi(pr({ files: ['packages/vercel-ai-provider/quickstart/app/page.tsx'] }));
  assert.ok(selection.selected.includes('candidate-artifacts'));
  for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
    const needs = parentOutcomes(selection); needs['candidate-artifacts'] = { result };
    assert.equal(aggregateParentCi(selection, needs, candidateSha).passed, false);
  }
});

test('parent executable applies reusable receipt policy and cannot certify queue-only receipt', () => {
  const selection = selectCi(pr());
  const needs = parentOutcomes(selection);
  const env = { ...process.env, CI_SELECTION: JSON.stringify(selection), CI_NEEDS: JSON.stringify(needs), CI_PARENT: 'true', CI_CANDIDATE_SHA: candidateSha };
  const run = spawnSync(process.execPath, ['scripts/ci-contract.mjs', 'aggregate'], { env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  needs['managed-tests'].outputs.receipt = JSON.stringify({ kind: 'queue-only', sha: candidateSha, passed: true });
  const probe = spawnSync(process.execPath, ['scripts/ci-contract.mjs', 'aggregate'], { env: { ...env, CI_NEEDS: JSON.stringify(needs) }, encoding: 'utf8' });
  assert.equal(probe.status, 1);
  assert.match(probe.stdout, /invalid required receipt/);
});

test('one called workflow owns preparation through every selected managed leaf and aggregate', () => {
  const parent = load(readFileSync('.github/workflows/pr-checks.yml', 'utf8'));
  const child = load(readFileSync('.github/workflows/managed-ci.yml', 'utf8'));
  assert.equal(parent.concurrency, undefined);
  assert.deepEqual(child.concurrency, { group: 'cortex-shared-ci-backends', 'cancel-in-progress': false, queue: 'max' });
  assert.equal(parent.jobs['managed-tests'].uses, './.github/workflows/managed-ci.yml');
  assert.deepEqual(child.jobs['managed-outcomes'].needs, managedJobs);
  assert.match(child.jobs['managed-outcomes'].if, /always\(\)/);
  for (const job of managedJobs) { assert.ok(child.jobs[job]); assert.equal(child.jobs[job].concurrency, undefined); assert.equal(parent.jobs[job], undefined); }
  assert.equal(child.jobs['test-typescript'].strategy['max-parallel'], 1);
  assert.equal(child.jobs['test-typescript'].strategy['fail-fast'], false);
  assert.deepEqual(child.jobs['test-typescript'].strategy.matrix.shard, [1, 2, 3, 4, 5]);
  assert.deepEqual(child.jobs['test-vercel-ai-provider'].needs, ['setup-and-purge', 'test-typescript']);
  const prep = child.jobs['setup-and-purge'].steps;
  const freshness = prep.findIndex(step => step.run === 'node scripts/ci-managed.mjs freshness');
  assert.ok(freshness >= 0 && freshness < prep.findIndex(step => /convex deploy/.test(step.run ?? '')));
  for (const job of ['code-quality', 'public-contracts', 'offline-packages', 'demo-contracts', 'graph-contracts', 'native-proof-contracts']) assert.ok(![].concat(parent.jobs[job].needs ?? []).includes('managed-tests'));
  assert.ok(parent.jobs['all-checks-passed'].needs.includes('managed-tests'));
  assert.ok(parent.jobs['all-checks-passed'].needs.includes('candidate-artifacts'));
  assert.equal(parent.jobs['all-checks-passed'].steps.at(-1).env.CI_PARENT, 'true');
});

test('queue probes pass no secrets and can never produce a passing functional aggregate', () => {
  const parent = load(readFileSync('.github/workflows/pr-checks.yml', 'utf8'));
  const child = load(readFileSync('.github/workflows/managed-ci.yml', 'utf8'));
  const probe = parent.jobs['managed-queue-probe'];
  assert.equal(probe.secrets, undefined);
  assert.equal(probe.with.queue_probe, true);
  assert.match(probe.if, /workflow_dispatch/);
  for (const job of ['detect-changes', 'code-quality', 'public-contracts', 'all-checks-passed']) assert.match(parent.jobs[job].if, /inputs.queue_probe != true/);
  for (const job of [...managedJobs, 'managed-outcomes']) assert.match(child.jobs[job].if, /inputs.queue_probe != true/);
  assert.ok(child.jobs['queue-probe'].steps.every(step => !step.uses && !step.env && !/deploy|purge|node|npm/.test(step.run)));
  assert.match(child.jobs['queue-probe'].steps[0].run, /sleep 25/);
  assert.match(child.jobs['queue-probe'].steps[0].run, /no functional, service or delivery proof/);
});

test('demo artifacts build once and preserve ordinary installs, closure validation and source sparsity', () => {
  const parent = load(readFileSync('.github/workflows/pr-checks.yml', 'utf8'));
  const child = load(readFileSync('.github/workflows/managed-ci.yml', 'utf8'));
  const setup = load(readFileSync('.github/actions/cortex-setup/action.yml', 'utf8'));
  assert.equal(setup.runs.steps[0].with['node-version'], '24.21.0');
  assert.equal(setup.runs.steps[0].with['cache-dependency-path'], 'package-lock.json');
  assert.equal(setup.runs.steps[1].run, 'npm install --global npm@12.2.0');
  const demos = parent.jobs['demo-contracts'].steps;
  assert.deepEqual(parent.jobs['demo-contracts'].needs, ['detect-changes', 'candidate-artifacts']);
  assert.ok(demos.some(step => step.run === 'npm ci'));
  assert.ok(!demos.some(step => /npm run build --workspace|npm pack/.test(step.run ?? '')));
  const verify = demos.findIndex(step => /ci-candidate-artifacts.mjs verify/.test(step.run ?? ''));
  assert.ok(verify >= 0 && verify < demos.findIndex(step => /install-ci-demo.mjs/.test(step.run ?? '')));
  assert.equal(parent.jobs['candidate-artifacts'].steps.filter(step => /npm run build/.test(step.run ?? '')).length, 1);
  for (const workflow of [parent, child]) for (const job of Object.values(workflow.jobs)) {
    const checkout = job.steps?.find(step => step.uses === 'actions/checkout@v6');
    if (checkout) {
      assert.match(checkout.with['sparse-checkout'], /!\/_goals\//);
      assert.match(checkout.with['sparse-checkout'], /!\/work\//);
      assert.equal(checkout.with['sparse-checkout-cone-mode'], false);
      assert.equal(checkout.with['persist-credentials'], false);
      assert.ok(job.steps.findIndex(step => step.uses === './.github/actions/cortex-setup') > job.steps.indexOf(checkout));
    }
  }
  assert.equal(parent.jobs['detect-changes'].steps[0].with['fetch-depth'], 0);
  const security = load(readFileSync('.github/workflows/security.yml', 'utf8'));
  const historyCheckouts = Object.values(security.jobs).flatMap(job => job.steps ?? []).filter(step => step.uses?.startsWith('actions/checkout@'));
  assert.ok(historyCheckouts.some(step => step.with?.['fetch-depth'] === 0 && !step.with?.['sparse-checkout']));
});

test('actual provider preflight shell refuses every missing prerequisite before selected paid coverage', () => {
  const child = load(readFileSync('.github/workflows/managed-ci.yml', 'utf8'));
  const steps = child.jobs['test-vercel-ai-provider'].steps;
  const preflightIndex = steps.findIndex(step => step.name === 'Require actual managed provider and paid coverage prerequisites');
  const paidIndex = steps.findIndex(step => /npm run test:e2e/.test(step.run ?? ''));
  assert.ok(preflightIndex >= 0 && paidIndex > preflightIndex);
  const preflight = steps[preflightIndex];
  const required = ['CONVEX_URL', 'CONVEX_DEPLOY_KEY', 'OPENAI_API_KEY'];
  for (const name of required) assert.equal(preflight.env[name], '${{ secrets.' + name + ' }}');
  const present = Object.fromEntries(required.map(name => [name, 'synthetic-present-placeholder']));
  const execute = values => spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', preflight.run], { env: { PATH: process.env.PATH, ...values }, encoding: 'utf8' });
  const valid = execute(present);
  assert.equal(valid.status, 0, valid.stderr);
  for (const name of required) for (const kind of ['absent', 'empty']) {
    const values = { ...present };
    if (kind === 'absent') delete values[name]; else values[name] = '';
    const invalid = execute(values);
    assert.notEqual(invalid.status, 0, `${name} ${kind} must fail before provider tests`);
    assert.equal(invalid.signal, null);
    assert.ok(!invalid.stdout.includes('synthetic-present-placeholder'));
  }
});
