import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assertObservation, boundedProcess, checks, controlRef, executeBaseline, nativeArguments, pin, target, validateJson, validateSarif, verifyBeforeUpload } from '../scripts/scorecard-main-baseline.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.from(JSON.stringify(value));
const cli = { ...pin, executable: '/synthetic/official-scorecard', policyFile: '/synthetic/upstream-policy.yml', binarySha256: 'a'.repeat(64) };
const json = () => ({ repo: { name: target.repo, commit: target.sha }, scorecard: { version: 'v5.3.0', commit: pin.engine }, checks: checks.map(name => ({ name, score: name === 'Maintained' ? -1 : 0, reason: 'Synthetic native-shape fixture; no runtime qualification' })) });
const sarif = () => ({ version: '2.1.0', runs: ['branch-protection', 'local', 'online-scm'].map(category => ({ automationDetails: { id: `supply-chain/${category}/${pin.engine}-synthetic-time` }, tool: { driver: { name: 'Scorecard', informationUri: 'https://github.com/ossf/scorecard', semanticVersion: 'v5.3.0', rules: checks.filter(name => category === 'branch-protection' ? name === 'Branch-Protection' : category === 'online-scm' ? name === 'Maintained' : !['Branch-Protection', 'Maintained'].includes(name)).map(name => ({ id: name.replaceAll('-', '') + 'ID', name })) } }, results: category === 'local' ? [{ ruleId: checks.filter(name => !['Branch-Protection', 'Maintained'].includes(name))[0].replaceAll('-', '') + 'ID', message: { text: 'Synthetic finding retained without a score threshold' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'synthetic-fixture-only.ts' } } }] }] : [] })) });
const observation = phase => ({ phase, observedAt: 'synthetic-observation-time', repository: { full_name: target.repository, private: false, default_branch: 'main' }, reference: { ref: target.ref, object: { type: 'commit', sha: target.sha } } });
function harness({ changeAt, mutateOutput, mutateRecord, acquire } = {}) {
  const calls = [], snapshots = [], outputs = {};
  const operations = {
    acquire: acquire ?? (() => structuredClone(cli)),
    observe: phase => { calls.push(`observe:${phase}`); const value = observation(phase); if (phase === changeAt) value.reference.object.sha = 'b'.repeat(40); return value; },
    scan: format => {
      calls.push(`scan:${format}`);
      const stdout = mutateOutput ? mutateOutput(format) : bytes(format === 'json' ? json() : sarif()), stderr = Buffer.from('');
      outputs[format] = { stdout, stderr };
      const receipt = { executable: cli.executable, args: nativeArguments(format, cli.policyFile), bounds: { timeoutMs: 240_000, maxBytesPerStream: 8 * 1024 * 1024 }, code: 0, signal: null, error: null, stdoutBytes: stdout.length, stderrBytes: stderr.length, stdoutSha256: hash(stdout), stderrSha256: hash(stderr), binarySha256: cli.binarySha256, archiveSha256: pin.archiveSha256, version: pin.version, engine: pin.engine, target, stdoutFile: `/synthetic/native-${format}.stdout`, stderrFile: `/synthetic/native-${format}.stderr` };
      if (mutateRecord) mutateRecord(receipt, format);
      return { receipt, stdout, stderr };
    },
    persist: value => snapshots.push(structuredClone(value)),
  };
  return { operations, calls, outputs, snapshots };
}

test('reviewed upstream default catalog and immutable official release pin remain complete', () => {
  assert.deepEqual(checks, ['Token-Permissions', 'Branch-Protection', 'Code-Review', 'Dangerous-Workflow', 'License', 'Pinned-Dependencies', 'Security-Policy', 'SAST', 'Contributors', 'Packaging', 'Binary-Artifacts', 'Signed-Releases', 'Dependency-Update-Tool', 'Fuzzing', 'CII-Best-Practices', 'Vulnerabilities', 'CI-Tests', 'Maintained'].sort());
  assert.equal(pin.archiveSha256, '98351e001a2bae1d12ec6fbca7da42168bdda2eecbb4fa6951ebffb5ced3a0be');
  assert.equal(pin.engine, 'c22063e786c11f9dd714d777a687ff7c4599b600');
});

test('two independent scans retain their own target/argv/output receipts; only four matched fences admit upload', () => {
  const h = harness(), receipt = executeBaseline(h.operations);
  assert.deepEqual(h.calls, ['observe:before-json', 'scan:json', 'observe:between-scans', 'scan:sarif', 'observe:after-sarif']);
  assert.deepEqual(receipt.invocations.map(record => record.format), ['json', 'sarif']);
  for (const record of receipt.invocations) { assert.deepEqual(record.target, target); assert.equal(record.version, pin.version); assert.equal(record.engine, pin.engine); assert.equal(record.stdoutFile, `/synthetic/native-${record.format}.stdout`); }
  assert.equal(receipt.uploadEligible, false);
  assert.equal(receipt.sarif.findings, 1);
  assert.equal(receipt.json.reportedCommit, target.sha);
  assert.deepEqual(receipt.json.unknownChecks, ['Maintained']);
  assert.match(receipt.json.claim, /JSON invocation only/); assert.match(receipt.sarif.claim, /does not report/);
  const rawBefore = Buffer.from(h.outputs.sarif.stdout);
  const ready = verifyBeforeUpload({ receipt, outputs: h.outputs }, h.operations);
  assert.equal(ready.uploadEligible, true); assert.equal(ready.status, 'observational-upload-ready');
  assert.equal(h.calls.at(-1), 'observe:before-upload'); assert.deepEqual(h.outputs.sarif.stdout, rawBefore);
  assert.equal(h.calls.filter(call => call.startsWith('scan:')).length, 2);
  assert.throws(() => verifyBeforeUpload({ receipt, outputs: h.outputs }, h.operations), /Incomplete, repeated/);
  assert.equal(receipt.uploadEligible, false);
});

for (const [phase, scans] of [['before-json', 0], ['between-scans', 1], ['after-sarif', 2]]) test(`drift at ${phase} suppresses upload with exactly ${scans} scans and no recovery scan`, () => {
  const h = harness({ changeAt: phase });
  assert.throws(() => executeBaseline(h.operations), /source mismatch/);
  assert.equal(h.calls.filter(call => call.startsWith('scan:')).length, scans);
  assert.equal(h.snapshots.at(-1).status, 'failed'); assert.equal(h.snapshots.at(-1).uploadEligible, false);
});
test('last-minute drift, altered outputs and incomplete fence history never yield upload permission', () => {
  for (const kind of ['drift', 'hash', 'missing-fence', 'missing-invocation', 'failed-receipt']) {
    const h = harness({ changeAt: kind === 'drift' ? 'before-upload' : undefined }), receipt = executeBaseline(h.operations);
    if (kind === 'hash') h.outputs.sarif.stdout = Buffer.from('altered');
    if (kind === 'missing-fence') receipt.observations.pop();
    if (kind === 'missing-invocation') receipt.invocations.pop();
    if (kind === 'failed-receipt') receipt.status = 'failed';
    assert.throws(() => verifyBeforeUpload({ receipt, outputs: h.outputs }, h.operations));
    assert.equal(receipt.uploadEligible, false); assert.equal(receipt.status, 'failed');
    assert.equal(h.calls.filter(call => call.startsWith('scan:')).length, 2);
  }
});

test('wrong public repository, default branch, ref, SHA and malformed/failed source observations refuse', () => {
  for (const change of [value => { value.repository.full_name = 'elsewhere/repo'; }, value => { value.repository.private = true; }, value => { value.repository.default_branch = 'dev'; }, value => { value.reference.ref = 'refs/heads/dev'; }, value => { value.reference.object.sha = 'b'.repeat(40); }, value => { value.reference.object.type = 'tag'; }, value => { delete value.reference; }]) {
    const value = observation('before-json'); change(value); assert.throws(() => assertObservation(value, 'before-json'), /source mismatch/);
    const h = harness(); h.operations.observe = () => value;
    assert.throws(() => executeBaseline(h.operations), /source mismatch/); assert.equal(h.calls.some(call => call.startsWith('scan:')), false);
  }
  const broken = harness(); broken.operations.observe = () => { throw new Error('GET failed/timeout/malformed'); };
  assert.throws(() => executeBaseline(broken.operations), /GET failed/); assert.equal(broken.snapshots.at(-1).uploadEligible, false);
});

test('native JSON keeps unknown scores visible but rejects another source, engine, check selection and errors', () => {
  assert.equal(validateJson(bytes(json())).reportedRepo, target.repo);
  for (const change of [value => { value.repo.name = 'github.com/elsewhere/repo'; }, value => { value.repo.commit = 'b'.repeat(40); }, value => { value.scorecard.commit = 'b'.repeat(40); }, value => { value.scorecard.version = '0.0.0'; }, value => { value.checks.pop(); }, value => { value.checks[0].error = 'native runtime error'; }, value => { value.errors = [{ message: 'native error' }]; }, value => { value.errors = {}; }, value => { value.checks[0].score = -2; }]) {
    const value = json(); change(value); assert.throws(() => validateJson(bytes(value)));
  }
  for (const value of ['{broken', 'null', '{}']) assert.throws(() => validateJson(Buffer.from(value)));
});
test('native SARIF requires genuine tool, three categories/default checks and no reported execution error', () => {
  assert.equal(validateSarif(bytes(sarif())).categories.length, 3);
  for (const change of [value => { value.runs.pop(); }, value => { value.runs[0].tool.driver.name = 'CodeQL'; }, value => { value.runs[0].automationDetails.id = `supply-chain/local/${pin.engine}-synthetic`; }, value => { value.runs[0].automationDetails.id = `supply-chain/branch-protection/${target.sha}-synthetic`; }, value => { value.runs[0].tool.driver.rules = []; }, value => { value.runs[0].invocations = [{ executionSuccessful: false }]; }, value => { value.runs[0].invocations = [{ toolExecutionNotifications: [{ level: 'error' }] }]; }, value => { value.runs[0].results = [{ ruleId: 'unknown' }]; }]) {
    const value = sarif(); change(value); assert.throws(() => validateSarif(bytes(value)));
  }
  for (const value of ['{broken', 'null', '{}']) assert.throws(() => validateSarif(Buffer.from(value)));
});

test('wrong pin/args, nonzero/timeout/oversized process outcomes and malformed native outputs cannot authorize upload', () => {
  const wrongPin = harness({ acquire: () => ({ ...cli, archiveSha256: 'b'.repeat(64) }) });
  assert.throws(() => executeBaseline(wrongPin.operations), /identity mismatch/); assert.equal(wrongPin.calls.length, 0);
  for (const format of ['json', 'sarif']) for (const change of [record => { record.code = 1; }, record => { record.signal = 'SIGKILL'; }, record => { record.error = 'ETIMEDOUT'; }, record => { record.error = 'ENOBUFS'; }, record => { record.stdoutBytes = 9 * 1024 * 1024; }, record => { record.args = ['--local=.']; }, record => { record.bounds.timeoutMs = 0; }]) {
    const h = harness({ mutateRecord: (record, current) => { if (format === current) change(record); } });
    assert.throws(() => executeBaseline(h.operations)); assert.equal(h.snapshots.at(-1).uploadEligible, false); assert.equal(h.snapshots.at(-1).status, 'failed');
    assert.equal(h.calls.filter(call => call.startsWith('scan:')).length, format === 'json' ? 1 : 2);
  }
  for (const format of ['json', 'sarif']) {
    const h = harness({ mutateOutput: current => current === format ? Buffer.from('{invalid') : bytes(current === 'json' ? json() : sarif()) });
    assert.throws(() => executeBaseline(h.operations)); assert.equal(h.snapshots.at(-1).uploadEligible, false);
  }
  assert.throws(() => nativeArguments('raw', cli.policyFile), /Exact native format/);
});

test('real bounded child capture preserves bytes and exposes actual timeout/output exhaustion before scans', () => {
  const success = boundedProcess(process.execPath, ['-e', "process.stdout.write('native-bytes');process.stderr.write('native-log')"], { timeoutMs: 5_000, maxBytes: 1024, env: {} });
  assert.equal(success.receipt.code, 0); assert.equal(success.stdout.toString(), 'native-bytes'); assert.equal(success.stderr.toString(), 'native-log');
  assert.equal(success.receipt.stdoutSha256, hash(success.stdout));
  const timeout = boundedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 20, maxBytes: 1024, env: {} });
  assert.ok(timeout.receipt.error || timeout.receipt.signal); assert.notEqual(timeout.receipt.code, 0);
  const tooLarge = boundedProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(1024*1024))"], { timeoutMs: 5_000, maxBytes: 1024, env: {} });
  assert.ok(tooLarge.receipt.error); assert.notEqual(tooLarge.receipt.code, 0);
  const absent = boundedProcess('/missing/official-scorecard', [], { timeoutMs: 100, maxBytes: 100, env: {} }); assert.equal(absent.receipt.error, 'ENOENT');
  for (const bounds of [{ timeoutMs: 0, maxBytes: 1 }, { timeoutMs: Infinity, maxBytes: 1 }, { timeoutMs: 1, maxBytes: 0 }]) assert.throws(() => boundedProcess('unused', [], bounds), /finite process bounds/);
});

test('CLI refuses another control branch or rerun before any pin download/API/scan', () => {
  const directory = mkdtempSync(join(tmpdir(), 'scorecard-control-refusal-'));
  try {
    for (const [ref, attempt] of [['refs/heads/main', '1'], [controlRef, '2']]) {
      const out = join(directory, `unused-${attempt}-${ref.includes('main') ? 'main' : 'other'}`);
      const run = spawnSync(process.execPath, [resolve('scripts/scorecard-main-baseline.mjs'), 'run', out], { env: { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: target.repository, GITHUB_REF: ref, GITHUB_RUN_ATTEMPT: attempt, GH_TOKEN: 'synthetic-token' }, encoding: 'utf8' });
      assert.equal(run.status, 1); assert.match(run.stderr, /first manual attempt/); assert.equal(existsSync(out), false);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('diagnostic workflow is manual-only with refusals before scans, fail-closed upload and exact main/native identity', () => {
  const workflow = readFileSync('.github/workflows/security.yml', 'utf8');
  assert.match(workflow, /on:\n  workflow_dispatch:\n/); assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule):/m);
  assert.match(workflow, /^  scorecard:/m); assert.doesNotMatch(workflow, /security-summary|id-token|publish_results|secrets\./);
  const tests = workflow.indexOf('run: node --test tests/scorecard-main-baseline.test.mjs'), scan = workflow.indexOf('run: node scripts/scorecard-main-baseline.mjs run '), fence = workflow.indexOf('run: node scripts/scorecard-main-baseline.mjs preupload '), upload = workflow.indexOf('uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370');
  assert.ok(tests >= 0 && scan > tests && fence > scan && upload > fence);
  assert.match(workflow, /if: success\(\) && steps.preupload.outputs.upload_ready == 'true'/);
  assert.match(workflow, /ref: refs\/heads\/main/); assert.ok(workflow.includes(`sha: ${target.sha}`));
  assert.match(workflow, /wait-for-processing: true/); assert.match(workflow, /timeout-minutes: 20/);
  assert.doesNotMatch(workflow, /category:|continue-on-error|npm ci|managed-tests|workflow_call/);
  assert.match(workflow, /if: always\(\)[\s\S]*actions\/upload-artifact@v4/);
  const prChecks = readFileSync('.github/workflows/pr-checks.yml', 'utf8'); assert.match(prChecks, /push:\n    branches: \[main\]/);
  const managed = readFileSync('.github/workflows/managed-ci.yml', 'utf8'); assert.match(managed, /workflow_call:/); assert.doesNotMatch(managed, /^  push:/m);
  const publishing = readFileSync('.github/workflows/publish.yml', 'utf8'); assert.match(publishing, /workflow_run:[\s\S]*branches: \[main, dev\]/); assert.doesNotMatch(publishing, /^  push:/m);
  const scorecardPublishing = readFileSync('.github/workflows/scorecard-publish.yml', 'utf8'); assert.match(scorecardPublishing, /push:\n    branches: \[main\]/);
});
