import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSemgrep, securityPolicy, securitySummary, semgrepArguments, semgrepVersion, validateSarif, validateSemgrepResults } from '../scripts/security-contract.mjs';

const context = { eventName: 'pull_request', actor: 'contributor', ref: 'refs/pull/1/merge' };
const needsFor = input => Object.fromEntries([
  ...securityPolicy(input).required.map(job => [job, { result: 'success' }]),
  ...securityPolicy(input).skipped.map(job => [job, { result: 'skipped' }]),
  ['scorecard', { result: securityPolicy(input).scorecardExpected ? 'success' : 'skipped' }],
]);
const finding = { ruleId: 'security-rule', message: { text: 'Potential security issue' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/file.ts' } } }] };
const sarif = (results = [], name = 'Semgrep OSS') => ({ version: '2.1.0', runs: [{ tool: { driver: { name } }, results, invocations: [{ executionSuccessful: true }] }] });
const clean = () => ({ status: 0, json: { version: semgrepVersion, errors: [], results: [], paths: { scanned: ['src/file.ts'] } }, sarif: sarif() });

test('all PR actors and draft/fork origins require scans, PR upload and reviewed dependency policy', () => {
  for (const actor of ['contributor', 'dependabot[bot]']) {
    for (const fromFork of [false, true]) {
      for (const draft of [false, true]) {
        const input = { ...context, actor, fromFork, draft };
        assert.deepEqual(securityPolicy(input).required, ['codeql-analysis', 'dependency-scan', 'secret-scan', 'api-security', 'dependency-review']);
        assert.equal(securityPolicy(input).uploadRequired, true);
        assert.equal(securitySummary(input, needsFor(input)).ok, true);
      }
    }
  }
});

test('non-PR dependency review skip is explicit; only non-PR Dependabot upload is unavailable', () => {
  for (const eventName of ['push', 'schedule', 'workflow_dispatch']) {
    const input = { eventName, actor: 'maintainer', ref: 'refs/heads/main' };
    const policy = securityPolicy(input), result = securitySummary(input, needsFor(input));
    assert.equal(policy.uploadRequired, true);
    assert.deepEqual(policy.skipped, ['dependency-review']);
    assert.equal(result.ok, true);
    assert.match(result.rows.join('\n'), /expected skip: dependency review applies only to PRs/);
    const bot = { ...input, actor: 'dependabot[bot]' };
    assert.equal(securityPolicy(bot).uploadRequired, false);
    assert.match(securitySummary(bot, needsFor(bot)).rows.join('\n'), /uploaded alert coverage is incomplete/);
  }
  assert.throws(() => securityPolicy({ eventName: 'pull_request_target' }), /Unsupported security event/);
});

test('every required scanner and Dependency Review failure/cancellation/absence/skip blocks', () => {
  for (const job of securityPolicy(context).required) {
    for (const result of ['failure', 'cancelled', 'skipped', 'neutral', undefined]) {
      const needs = needsFor(context);
      if (result === undefined) delete needs[job];
      else needs[job].result = result;
      const summary = securitySummary(context, needs);
      assert.equal(summary.ok, false, `${job}: ${result}`);
      assert.deepEqual(summary.failures, [`${job}: ${result ?? 'missing'}`]);
    }
  }
  assert.equal(securitySummary(context, null).ok, false);
});

test('legitimate skip must itself be observed and Scorecard cannot certify mandatory coverage', () => {
  const push = { ...context, eventName: 'push', ref: 'refs/heads/dev' };
  for (const result of ['success', 'failure', 'cancelled', undefined]) {
    const needs = needsFor(push);
    if (result === undefined) delete needs['dependency-review'];
    else needs['dependency-review'].result = result;
    assert.equal(securitySummary(push, needs).ok, false);
  }
  for (const eventName of ['schedule', 'push']) {
    const input = { ...context, eventName, ref: 'refs/heads/main' };
    assert.equal(securityPolicy(input).scorecardExpected, true);
    const needs = needsFor(input);
    needs.scorecard.result = 'failure';
    assert.equal(securitySummary(input, needs).ok, true);
    assert.match(securitySummary(input, needs).rows.join('\n'), /scorecard: failure \(advisory/);
    needs['api-security'].result = 'cancelled';
    assert.equal(securitySummary(input, needs).ok, false);
  }
});

test('valid SARIF including findings is accepted; execution errors and malformed artifacts fail', () => {
  assert.deepEqual(validateSarif(sarif([finding]), 'Semgrep OSS'), { findings: 1 });
  assert.deepEqual(validateSarif(sarif([], 'Trivy'), 'Trivy'), { findings: 0 });
  for (const value of [undefined, {}, { version: '2.1.0', runs: [] }, sarif([], 'wrong-tool')]) assert.throws(() => validateSarif(value, 'Semgrep OSS'));
  const absent = sarif(); delete absent.runs[0].results;
  assert.throws(() => validateSarif(absent, 'Semgrep OSS'), /Missing SARIF results/);
  const badFinding = sarif([{ ...finding, message: { text: 7 } }]);
  assert.throws(() => validateSarif(badFinding, 'Semgrep OSS'), /Invalid SARIF finding/);
  assert.throws(() => validateSarif(sarif([{ ...finding, locations: [] }]), 'Semgrep OSS'), /location/);
  const unsuccessful = sarif(); unsuccessful.runs[0].invocations[0].executionSuccessful = false;
  assert.throws(() => validateSarif(unsuccessful, 'Semgrep OSS'), /execution errors/);
  const engineError = sarif(); engineError.runs[0].invocations[0].toolExecutionNotifications = [{ level: 'error' }];
  assert.throws(() => validateSarif(engineError, 'Semgrep OSS'), /execution errors/);
});

test('native Semgrep findings are reported without introducing a new exit threshold or tool alias', () => {
  const result = clean();
  result.json.results = [{}]; result.sarif = sarif([finding]);
  assert.deepEqual(validateSemgrepResults(result), { findings: 1, scanned: 1, version: semgrepVersion, partialParsing: [], findingPolicy: 'GitHub code-scanning alert rules; native CLI report-only' });
  assert.throws(() => validateSemgrepResults({ ...result, sarif: sarif([finding], 'Semgrep') }), /Unexpected SARIF tool/);
  assert.match(securitySummary(context, needsFor(context)).rows.join('\n'), /separate Snyk release gate/);
});

test('only classified CE PartialParsing warnings remain visible without suppressing findings', () => {
  const result = clean();
  const issue = { code: 3, level: 'warn', type: ['PartialParsing', []], path: 'src/types/index.ts' };
  result.json.errors = [issue];
  result.sarif.runs[0].invocations[0].toolExecutionNotifications = [{ level: 'warning', message: { text: 'Partial parse' } }];
  assert.deepEqual(validateSemgrepResults(result).partialParsing, ['src/types/index.ts']);
  for (const errors of [
    [{ ...issue, level: 'error' }], [{ ...issue, code: 2 }], [{ ...issue, type: ['Timeout', []] }],
    [{ ...issue, path: undefined }], [{ code: 7, level: 'error', type: ['InvalidRuleSchemaError', []] }],
  ]) assert.throws(() => validateSemgrepResults({ ...result, json: { ...result.json, errors } }), /fatal\/unclassified/);
  const needs = needsFor(context);
  needs['api-security'].outputs = { scanned: '869', findings: '3', partial_parsing: '4' };
  assert.match(securitySummary(context, needs).rows.join('\n'), /3 findings, 4 PartialParsing warnings/);
});

test('crash/invalid configuration status, wrong version, zero coverage and invalid output block', () => {
  for (const outcome of [{ status: 2 }, { status: 3 }, { status: 5 }, { status: null, signal: 'SIGTERM' }, { status: null, error: new Error('not installed') }]) assert.throws(() => validateSemgrepResults({ ...clean(), ...outcome }), /execution failed/);
  const wrongVersion = clean(); wrongVersion.json.version = '1.36.0';
  assert.throws(() => validateSemgrepResults(wrongVersion), /version\/coverage/);
  const empty = clean(); empty.json.paths.scanned = [];
  assert.throws(() => validateSemgrepResults(empty), /no source files/);
  const invalidPaths = clean(); invalidPaths.json.paths.scanned = [''];
  assert.throws(() => validateSemgrepResults(invalidPaths), /scanned paths/);
  const mismatched = clean(); mismatched.sarif = sarif([finding]);
  assert.throws(() => validateSemgrepResults(mismatched), /counts differ/);
});

test('actual child exit/signal and missing executable propagate after stale output removal', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cortex-security-'));
  try {
    for (const code of ['process.exit(2)', 'process.kill(process.pid, "SIGTERM")']) {
      writeFileSync(join(cwd, 'semgrep.json'), JSON.stringify(clean().json));
      writeFileSync(join(cwd, 'semgrep.sarif'), JSON.stringify(sarif()));
      assert.throws(() => runSemgrep({ cwd, spawn: (_executable, _args, options) => spawnSync(process.execPath, ['-e', code], options) }), /execution failed/);
      assert.equal(existsSync(join(cwd, 'semgrep.sarif')), false);
    }
    assert.throws(() => runSemgrep({ cwd, executable: join(cwd, 'not-installed') }), /execution failed/);
    assert.throws(() => runSemgrep({ cwd, spawn: () => ({ status: 0 }) }), /ENOENT/);
    assert.throws(() => runSemgrep({ cwd, spawn: () => {
      writeFileSync(join(cwd, 'semgrep.json'), '{invalid');
      writeFileSync(join(cwd, 'semgrep.sarif'), JSON.stringify(sarif()));
      return { status: 0 };
    } }), SyntaxError);
    assert.deepEqual(runSemgrep({ cwd, spawn: () => {
      writeFileSync(join(cwd, 'semgrep.json'), JSON.stringify(clean().json));
      writeFileSync(join(cwd, 'semgrep.sarif'), JSON.stringify(sarif()));
      return { status: 0 };
    } }).scanned, 1);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('CLI aggregate exits nonzero on cancellation and writes actionable summaries', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cortex-security-summary-'));
  try {
    const summaryFile = join(cwd, 'summary.md'), needs = needsFor(context);
    needs['api-security'].result = 'cancelled';
    const environment = { ...process.env, GITHUB_EVENT_NAME: context.eventName, GITHUB_ACTOR: context.actor, GITHUB_REF: context.ref, GITHUB_STEP_SUMMARY: summaryFile, SECURITY_NEEDS: JSON.stringify(needs) };
    const result = spawnSync(process.execPath, ['scripts/security-contract.mjs', 'summary'], { env: environment, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /api-security: cancelled/);
    assert.match(readFileSync(summaryFile, 'utf8'), /Mandatory security coverage failed/);
    environment.SECURITY_NEEDS = JSON.stringify(needsFor(context));
    assert.equal(spawnSync(process.execPath, ['scripts/security-contract.mjs', 'summary'], { env: environment }).status, 0);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('workflow requires supported token-free scan/upload contract and preserves scanner policies', () => {
  const workflow = readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8');
  assert.match(workflow, new RegExp(`python -m pip install semgrep==${semgrepVersion.replaceAll('.', '\\.')}`));
  assert.match(workflow, /id: scan\s+run: node scripts\/security-contract\.mjs semgrep/);
  assert.match(workflow, /sarif_file: semgrep\.sarif/);
  assert.match(workflow, /run: node scripts\/security-contract\.mjs summary/);
  assert.doesNotMatch(workflow, /semgrep-action|SEMGREP_APP_TOKEN|publishToken|pull_request_target|license-check:|openapi-security:|hashFiles\('semgrep/);
  assert.match(workflow, /trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25/);
  assert.match(workflow, /config-file: \.github\/dependency-review-config\.yml/);
  assert.match(workflow, /comment-summary-in-pr: never/);
  assert.match(workflow, /GITLEAKS_ENABLE_COMMENTS: false/);
  const args = semgrepArguments();
  assert.ok(args.includes('--no-strict'));
  assert.ok(args.includes('--oss-only'));
  assert.ok(!args.includes('--error'));
  assert.ok(!args.includes('p/python'));
  assert.ok(!args.includes('--exclude-rule'));
  assert.ok(!args.includes('convex-dev'));
});
