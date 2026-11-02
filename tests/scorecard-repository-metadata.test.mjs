import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { boundedProcess, nativeArguments, pin, prepareBundle, readNativeDirectory, repository, validateContext, validateNative, validateSnapshot, verifyBundle } from '../scripts/scorecard-repository-metadata.mjs';
import { securityPolicy, securitySummary } from '../scripts/security-contract.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.from(JSON.stringify(value));
const context = { eventName: 'pull_request', repository, eventRepository: repository, repositoryId: 42, public: true, ref: 'refs/pull/42/merge', sha: 'a'.repeat(40), runId: '13', attempt: '1', number: 42, baseRepository: repository, baseRepositoryId: 42, basePrivate: false };
const manual = { ...context, eventName: 'workflow_dispatch', ref: 'refs/heads/main' };
const cli = { ...pin, executable: '/synthetic/official-scorecard', policyFile: '/synthetic/policy.yml', binarySha256: 'b'.repeat(64) };
function report(categories, findings = false) {
  return { version: '2.1.0', runs: categories.map(category => {
    const name = category === 'branch-protection' ? 'Branch-Protection' : category === 'local' ? 'Dangerous-Workflow' : 'Code-Review';
    const id = name.replaceAll('-', '') + 'ID';
    return { automationDetails: { id: `supply-chain/${category}/${pin.engine}-synthetic-time` }, tool: { driver: { name: 'Scorecard', informationUri: 'https://github.com/ossf/scorecard', semanticVersion: 'v5.3.0', rules: [{ name, id }] } }, results: findings ? [{ ruleId: id, message: { text: 'Synthetic native-shaped finding; retained without a score threshold' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'synthetic-only.ts' } } }] }] : [] };
  }) };
}
const base = event => bytes(report(event === 'pull_request' ? ['local', 'online-scm'] : ['branch-protection', 'local', 'online-scm'], true));
const snapshot = (phase, ctx = context) => ({ phase, observedAt: '2026-11-02T00:00:00Z', checkoutSha: ctx.sha, checkoutAfter: ctx.sha, repository: { id: ctx.repositoryId, full_name: repository, private: false, default_branch: 'main' }, reference: { ref: 'refs/heads/main', object: { type: 'commit', sha: 'c'.repeat(40) } } });
function harness({ ctx = context, changeAt, mutateSnapshot, mutateRecord, mutateNative, wrongPin } = {}) {
  const calls = [], states = [], storage = new Map();
  const ops = {
    checkout: () => ctx.sha,
    writeBase: (name, value) => storage.set(name, Buffer.from(value)),
    persist: receipt => states.push(structuredClone(receipt)),
    acquire: () => { calls.push('acquire'); return { ...cli, ...(wrongPin ?? {}) }; },
    pinned: value => assert.equal(value.binarySha256, cli.binarySha256),
    observe: phase => { calls.push(`observe:${phase}`); const value = snapshot(phase, ctx); if (phase === changeAt) value.reference.object.sha = 'd'.repeat(40); if (mutateSnapshot) mutateSnapshot(value, phase); return value; },
    scan: value => {
      calls.push('scan'); const stdout = bytes(mutateNative ? mutateNative(report(['branch-protection'])) : report(['branch-protection']));
      storage.set('repository-settings.sarif', Buffer.from(stdout));
      const receipt = { executable: value.executable, args: nativeArguments(value.policyFile), bounds: { timeoutMs: 240_000, maxBytes: 8 * 1024 * 1024 }, code: 0, signal: null, error: null, stdoutBytes: stdout.length, stderrBytes: 0, stdoutSha256: hash(stdout), stderrSha256: hash(Buffer.from('')), binarySha256: value.binarySha256, archiveSha256: pin.archiveSha256, policySha256: pin.policySha256, engine: pin.engine, version: pin.version };
      if (mutateRecord) mutateRecord(receipt);
      return { receipt, stdout, stderr: Buffer.from('') };
    },
  };
  return { ops, calls, states, storage, files: () => [...storage].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, bytes: value })) };
}
const prepare = (h, ctx = context, outcome = 'success') => prepareBundle({ context: ctx, localOutcome: outcome, baseBytes: base(ctx.eventName) }, h.ops);

test('reviewed official executable and policy pins stay exact', () => {
  assert.equal(pin.archiveSha256, '98351e001a2bae1d12ec6fbca7da42168bdda2eecbb4fa6951ebffb5ced3a0be');
  assert.equal(pin.policySha256, '6e75dcc0df989d333492c0e1f6e484fc5b4d26ab768333ddcd0e3788539689b0');
  assert.equal(pin.engine, 'c22063e786c11f9dd714d777a687ff7c4599b600');
  assert.equal(pin.version, '5.3.0');
});

test('PR preserves complete local bytes and one genuine settings invocation with separate source roles', () => {
  const h = harness(), local = base('pull_request'), receipt = prepareBundle({ context, localOutcome: 'success', baseBytes: local }, h.ops);
  assert.deepEqual(h.calls, ['acquire', 'observe:before', 'scan', 'observe:after']);
  assert.equal(receipt.invocations.length, 1); assert.deepEqual(receipt.invocations[0].args, [`--repo=github.com/${repository}`, '--commit=HEAD', '--checks=Branch-Protection', '--format=sarif', '--show-details', `--policy=${cli.policyFile}`]);
  assert.deepEqual(h.storage.get('local-code.sarif'), local);
  assert.equal(receipt.metadata.emptyFindingsAmbiguity, true); assert.match(receipt.metadata.interpretation, /satisfied or inconclusive/);
  assert.notEqual(receipt.context.sha, receipt.observations[0].reference.object.sha);
  const unchanged = h.files().map(file => Buffer.from(file.bytes));
  const verified = verifyBundle({ context, receipt, files: h.files() }, h.ops);
  assert.equal(verified.status, 'validated'); assert.equal(h.calls.at(-1), 'observe:before-upload');
  assert.equal(h.calls.filter(call => call === 'scan').length, 1);
  assert.deepEqual(h.files().map(file => file.bytes), unchanged);
  assert.throws(() => verifyBundle({ context, receipt, files: h.files() }, h.ops), /Incomplete/);
});
test('manual keeps its existing three-category report and performs zero metadata acquisition, observation or scan', () => {
  const h = harness({ ctx: manual }), receipt = prepare(h, manual);
  assert.deepEqual(h.calls, []); assert.equal(receipt.invocations.length, 0); assert.equal(receipt.observations.length, 0);
  assert.deepEqual([...h.storage.keys()], ['remote-manual.sarif']);
  assert.equal(verifyBundle({ context: manual, receipt, files: h.files() }, h.ops).status, 'validated');
  assert.deepEqual(h.calls, []);
});
test('failed existing native analysis cannot be rescued by valid files or a successful hypothetical settings scan', () => {
  for (const outcome of ['failure', 'cancelled', 'skipped', undefined]) {
    const h = harness(); assert.throws(() => prepareBundle({ context, localOutcome: outcome, baseBytes: base('pull_request') }, h.ops), /cannot be rescued/); assert.deepEqual(h.calls, []); assert.equal(h.states.at(-1).status, 'failed');
  }
  const needs = Object.fromEntries([...securityPolicy({ eventName: 'pull_request' }).required.map(job => [job, { result: 'success' }])]);
  needs['scorecard-analysis'].result = 'failure'; assert.equal(securitySummary({ eventName: 'pull_request' }, needs).ok, false);
});
test('foreign/private/base/control and non-merge checkout are refused before acquisition or scan', () => {
  for (const patch of [{ repository: 'other/repo' }, { eventRepository: 'other/repo' }, { public: false }, { repositoryId: undefined }, { baseRepository: 'other/repo' }, { baseRepositoryId: 9 }, { basePrivate: true }, { ref: 'refs/heads/main' }, { eventName: 'pull_request_target' }, { sha: 'main' }]) {
    const bad = { ...context, ...patch }, h = harness({ ctx: bad });
    assert.throws(() => prepare(h, bad)); assert.deepEqual(h.calls, []);
  }
  assert.deepEqual(validateContext(context, context.sha), context);
  assert.throws(() => validateContext(context, 'd'.repeat(40)), /checkout/);
  const h = harness(); h.ops.checkout = () => 'd'.repeat(40); assert.throws(() => prepare(h), /checkout/); assert.deepEqual(h.calls, []);
});
for (const phase of ['before', 'after', 'before-upload']) test(`source drift at ${phase} fails closed without retry or another settings invocation`, () => {
  const h = harness({ changeAt: phase });
  if (phase === 'before-upload') { const receipt = prepare(h); assert.throws(() => verifyBundle({ context, receipt, files: h.files() }, h.ops), /moved/); assert.equal(receipt.status, 'failed'); }
  else if (phase === 'before') {
    // An initial well-formed current source may be any real main commit. Make its
    // trusted identity invalid instead; later drift compares the sampled anchor.
    h.ops.observe = current => ({ ...snapshot(current), repository: { id: 42, full_name: repository, private: true, default_branch: 'main' } });
    assert.throws(() => prepare(h), /mismatch/);
  } else assert.throws(() => prepare(h), /moved/);
  assert.ok(h.calls.filter(call => call === 'scan').length <= 1);
});
test('wrong source/default/ref and checkout drift at each fence remain refusals', () => {
  for (const phase of ['before', 'after', 'before-upload']) for (const change of [value => { value.repository.full_name = 'other/repo'; }, value => { value.repository.id = 99; }, value => { value.repository.default_branch = 'dev'; }, value => { value.reference.ref = 'refs/heads/dev'; }, value => { value.reference.object.type = 'tag'; }, value => { value.checkoutSha = 'd'.repeat(40); }, value => { value.checkoutAfter = 'd'.repeat(40); }]) {
    const h = harness({ mutateSnapshot: (value, current) => { if (current === phase) change(value); } });
    if (phase === 'before-upload') { const receipt = prepare(h); assert.throws(() => verifyBundle({ context, receipt, files: h.files() }, h.ops)); }
    else assert.throws(() => prepare(h));
    assert.equal(h.states.at(-1).status, 'failed'); assert.ok(h.calls.filter(call => call === 'scan').length <= 1);
  }
  const invalid = snapshot('before'); delete invalid.reference; assert.throws(() => validateSnapshot(invalid, 'before', context));
  const h = harness(); h.ops.observe = () => { throw new Error('GET timeout/nonzero/invalid JSON'); }; assert.throws(() => prepare(h), /GET timeout/); assert.equal(h.states.at(-1).status, 'failed');
});
test('authentic one-check shape preserves findings and empty-score ambiguity; malformed native reports fail', () => {
  assert.equal(validateNative(bytes(report(['branch-protection'], true)), 'repository-metadata').findings, 1);
  assert.equal(validateNative(bytes(report(['branch-protection'])), 'repository-metadata').emptyFindingsAmbiguity, true);
  for (const mutate of [value => { value.runs = []; }, value => { value.runs[0].tool.driver.name = 'Other'; }, value => { value.runs[0].tool.driver.semanticVersion = '1.0.0'; }, value => { value.runs[0].automationDetails.id = `supply-chain/local/${pin.engine}-time`; }, value => { value.runs[0].automationDetails.id = `supply-chain/branch-protection/${context.sha}-time`; }, value => { value.runs[0].tool.driver.rules.push({ name: 'Code-Review', id: 'CodeReviewID' }); }, value => { value.runs[0].invocations = [{ executionSuccessful: false }]; }, value => { value.runs[0].invocations = [{ toolExecutionNotifications: [{ level: 'error' }] }]; }, value => { value.runs[0].results = [{ ruleId: 'foreign' }]; }]) {
    const value = report(['branch-protection']); mutate(value); assert.throws(() => validateNative(bytes(value), 'repository-metadata'));
  }
  for (const value of ['{broken', 'null', '{}']) assert.throws(() => validateNative(Buffer.from(value), 'repository-metadata'));
  assert.throws(() => validateNative(bytes(report(['branch-protection'])), 'local-pr'));
  assert.throws(() => validateNative(Buffer.alloc(8 * 1024 * 1024 + 1), 'repository-metadata'), /byte bound/);
});
test('pin, policy, arguments and valid native files after process failure cannot qualify; exactly one native attempt', () => {
  for (const wrongPin of [{ archiveSha256: 'd'.repeat(64) }, { policySha256: 'd'.repeat(64) }, { engine: 'd'.repeat(40) }]) {
    const h = harness({ wrongPin }); assert.throws(() => prepare(h), /mismatch/); assert.equal(h.calls.includes('scan'), false);
  }
  for (const change of [record => { record.code = 1; }, record => { record.signal = 'SIGKILL'; }, record => { record.error = 'ETIMEDOUT'; }, record => { record.error = 'ENOBUFS'; }, record => { record.stdoutBytes = 9 * 1024 * 1024; }, record => { record.args = ['--checks=Code-Review']; }, record => { record.policySha256 = 'd'.repeat(64); }, record => { record.bounds.timeoutMs = 0; }]) {
    const h = harness({ mutateRecord: change }); assert.throws(() => prepare(h)); assert.equal(h.calls.filter(call => call === 'scan').length, 1);
    assert.ok(h.storage.has('repository-settings.sarif')); assert.equal(h.states.at(-1).status, 'failed');
    assert.throws(() => verifyBundle({ context, receipt: h.states.at(-1), files: h.files() }, h.ops));
  }
  assert.throws(() => nativeArguments(''), /policy path/);
});
test('wrong hash, duplicate role, missing invocation, local tampering and changed checkout suppress final upload', () => {
  for (const kind of ['hash', 'role', 'invocation', 'pin', 'checkout']) {
    const h = harness(), receipt = prepare(h);
    if (kind === 'hash') h.storage.set('local-code.sarif', bytes(report(['local', 'online-scm'])));
    if (kind === 'role') receipt.inputs[0].role = 'repository-metadata';
    if (kind === 'invocation') receipt.invocations = [];
    if (kind === 'pin') h.ops.pinned = () => { throw new Error('binary bytes moved'); };
    if (kind === 'checkout') h.ops.checkout = () => 'd'.repeat(40);
    assert.throws(() => verifyBundle({ context, receipt, files: h.files() }, h.ops)); assert.equal(receipt.status, 'failed'); assert.equal(h.calls.filter(call => call === 'scan').length, 1);
  }
});
test('fresh directory admits exactly two untouched regular native files; extra/missing/stale/linked entries fail', () => {
  for (const kind of ['valid', 'extra', 'missing', 'stale', 'symlink', 'hardlink', 'directory', 'directory-symlink']) {
    const root = mkdtempSync(join(tmpdir(), 'scorecard-native-files-')), native = join(root, 'native'); mkdirSync(native);
    try {
      writeFileSync(join(native, 'local-code.sarif'), base('pull_request')); writeFileSync(join(native, 'repository-settings.sarif'), bytes(report(['branch-protection'])));
      if (kind === 'extra') writeFileSync(join(native, 'extra.sarif'), '{}');
      if (kind === 'stale') writeFileSync(join(native, 'old.txt'), 'stale');
      if (kind === 'missing') unlinkSync(join(native, 'repository-settings.sarif'));
      if (['symlink', 'hardlink', 'directory'].includes(kind)) { unlinkSync(join(native, 'repository-settings.sarif')); const outside = join(root, 'outside.sarif'); writeFileSync(outside, bytes(report(['branch-protection']))); if (kind === 'symlink') symlinkSync(outside, join(native, 'repository-settings.sarif')); else if (kind === 'hardlink') linkSync(outside, join(native, 'repository-settings.sarif')); else mkdirSync(join(native, 'repository-settings.sarif')); }
      if (kind === 'directory-symlink') { renameSync(native, join(root, 'actual')); symlinkSync(join(root, 'actual'), native); }
      if (kind === 'valid') assert.deepEqual(readNativeDirectory(native, 'local-pr').map(file => file.name), ['local-code.sarif', 'repository-settings.sarif']);
      else assert.throws(() => readNativeDirectory(native, 'local-pr'));
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
test('real bounded child execution exposes exit, timeout and output failures; no successful file can hide them', () => {
  const run = code => boundedProcess(process.execPath, ['-e', code], { timeoutMs: 2_000, maxBytes: 1024 });
  const success = run("process.stdout.write('native-text')"); assert.equal(success.receipt.code, 0); assert.equal(success.stdout.toString(), 'native-text');
  assert.equal(run('process.exit(3)').receipt.code, 3);
  const timeout = boundedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 20, maxBytes: 1024 }); assert.ok(timeout.receipt.error || timeout.receipt.signal);
  assert.ok(run("process.stdout.write('x'.repeat(1024*1024))").receipt.error);
  assert.equal(boundedProcess('/missing/scorecard', [], { timeoutMs: 100, maxBytes: 1024 }).receipt.error, 'ENOENT');
  for (const bounds of [{ timeoutMs: 0, maxBytes: 1 }, { timeoutMs: 1, maxBytes: Infinity }]) assert.throws(() => boundedProcess('unused', [], bounds), /finite process/);
});
test('hosted manual CLI preparation and final verification use fresh paths and never install a metadata CLI', () => {
  const root = mkdtempSync(join(tmpdir(), 'scorecard-manual-role-'));
  try {
    const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }); assert.equal(head.status, 0, head.stderr);
    const input = join(root, 'existing-native.sarif'), event = join(root, 'event.json'), directory = join(root, 'evidence');
    writeFileSync(input, base('workflow_dispatch')); writeFileSync(event, JSON.stringify({ repository: { id: 42, full_name: repository, private: false } }));
    const env = { ...process.env, GITHUB_EVENT_PATH: event, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: repository, GITHUB_REF: 'refs/heads/main', GITHUB_SHA: head.stdout.trim(), GITHUB_RUN_ID: '13', GITHUB_RUN_ATTEMPT: '1', GH_TOKEN: 'synthetic-token', LOCAL_SCORECARD_OUTCOME: 'success', GITHUB_STEP_SUMMARY: '' };
    const invoke = args => spawnSync(process.execPath, [resolve('scripts/scorecard-repository-metadata.mjs'), ...args], { env, encoding: 'utf8' });
    const prepared = invoke(['prepare', directory, input]); assert.equal(prepared.status, 0, prepared.stderr);
    const verified = invoke(['verify', directory]); assert.equal(verified.status, 0, verified.stderr);
    const receipt = JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8')); assert.equal(receipt.status, 'validated'); assert.deepEqual(receipt.invocations, []); assert.deepEqual(receipt.observations, []); assert.equal(receipt.pin, undefined);
    assert.deepEqual(readFileSync(join(directory, 'native', 'remote-manual.sarif')), readFileSync(input)); assert.equal(existsSync(join(directory, 'policy.yml')), false);
    const stale = invoke(['prepare', directory, input]); assert.equal(stale.status, 1); assert.match(stale.stderr, /exist/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('normal workflow requires hosted refusals, both native roles and one directory upload without readiness skips', () => {
  const full = readFileSync('.github/workflows/security.yml', 'utf8'), job = full.split('  scorecard-analysis:')[1].split('  # External Scorecard publishing')[0];
  const markers = ['run: node --test tests/scorecard-repository-metadata.test.mjs', 'uses: ossf/scorecard-action@v2.4.3', 'run: node scripts/security-contract.mjs sarif scorecard-results.sarif Scorecard', 'run: node scripts/scorecard-repository-metadata.mjs prepare ', 'run: node scripts/security-contract.mjs scorecard-source', 'run: node scripts/scorecard-repository-metadata.mjs verify ', 'uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370'];
  const first = markers.slice(0, 4).map(marker => job.indexOf(marker)); assert.ok(first.every((value, index) => value >= 0 && (index === 0 || value > first[index - 1])));
  const finalSource = job.lastIndexOf(markers[4]), verify = job.indexOf(markers[5]), upload = job.indexOf(markers[6]); assert.ok(finalSource > first[3] && verify > finalSource && upload > verify);
  assert.equal((job.match(/uses: github\/codeql-action\/upload-sarif@/g) ?? []).length, 1);
  assert.deepEqual((job.match(/^ {8}if:.*$/gm) ?? []).map(line => line.trim()), ['if: always()']);
  assert.equal((job.match(/run: node scripts\/security-contract\.mjs scorecard-source/g) ?? []).length, 3);
  assert.match(job, /id: local_scorecard/); assert.match(job, /LOCAL_SCORECARD_OUTCOME: \$\{\{ steps.local_scorecard.outcome \}\}/);
  assert.match(job, /sarif_file: \$\{\{ runner.temp \}\}\/scorecard-upload\/native/); assert.match(job, /wait-for-processing: true/);
  assert.doesNotMatch(job, /upload_ready|continue-on-error|category:|id-token|repo_token|secrets\.|sha:|ref: refs\/heads\/main/);
  assert.match(job, /ref: \$\{\{ github.sha \}\}/); assert.match(job, /publish_results: false/); assert.match(job, /timeout-minutes: 20/);
  assert.match(job, /if: always\(\)[\s\S]*actions\/upload-artifact@v4/); assert.doesNotMatch(job, /path:[\s\S]*\*\.tar|path:[\s\S]*scorecard-settings-pin/);
  const parent = readFileSync('.github/workflows/pr-checks.yml', 'utf8'); assert.match(parent, /node --test .*tests\/scorecard-repository-metadata\.test\.mjs/);
  assert.match(full, /needs: \[codeql-analysis, dependency-scan, secret-scan, api-security, dependency-review, scorecard-analysis\]/);
});
