import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { checkScorecardSource, runSemgrep, securityPolicy, securitySummary, semgrepArguments, semgrepVersion, validateSarif, validateSemgrepResults } from '../scripts/security-contract.mjs';

const context = { eventName: 'pull_request', actor: 'contributor', ref: 'refs/pull/1/merge' };
const needsFor = input => Object.fromEntries([
  ...securityPolicy(input).required.map(job => [job, { result: 'success' }]),
  ...securityPolicy(input).skipped.map(job => [job, { result: 'skipped' }]),
]);
const finding = { ruleId: 'security-rule', message: { text: 'Potential security issue' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/file.ts' } } }] };
const sarif = (results = [], name = 'Semgrep OSS') => ({ version: '2.1.0', runs: [{ tool: { driver: { name } }, results, invocations: [{ executionSuccessful: true }] }] });
const clean = () => ({ status: 0, json: { version: semgrepVersion, errors: [], results: [], paths: { scanned: ['src/file.ts'] } }, sarif: sarif() });

test('PR policy requires all analyses for every actor/origin without claiming upstream fork runtime support', () => {
  // Synthetic outcomes exercise selection/aggregation, not upstream action support.
  for (const actor of ['contributor', 'dependabot[bot]']) {
    for (const fromFork of [false, true]) {
      for (const draft of [false, true]) {
        const input = { ...context, actor, fromFork, draft };
        assert.deepEqual(securityPolicy(input).required, ['codeql-analysis', 'dependency-scan', 'secret-scan', 'api-security', 'dependency-review', 'scorecard-analysis']);
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
    assert.deepEqual(policy.skipped, ['dependency-review', ...(eventName === 'workflow_dispatch' ? [] : ['scorecard-analysis'])]);
    assert.equal(result.ok, true);
    assert.match(result.rows.join('\n'), /expected skip: dependency review applies only to PRs/);
    const bot = { ...input, actor: 'dependabot[bot]' };
    assert.equal(securityPolicy(bot).uploadRequired, false);
    assert.match(securitySummary(bot, needsFor(bot)).rows.join('\n'), /uploaded alert coverage is incomplete/);
  }
  assert.throws(() => securityPolicy({ eventName: 'pull_request_target' }), /Unsupported security event/);
});

test('every selected scanner, Scorecard analysis and review failure/cancellation/absence/skip blocks', () => {
  for (const input of [context, { ...context, eventName: 'workflow_dispatch', ref: 'refs/heads/main' }]) {
    for (const job of securityPolicy(input).required) {
      for (const result of ['failure', 'cancelled', 'skipped', 'neutral', undefined]) {
        const needs = needsFor(input);
        if (result === undefined) delete needs[job];
        else needs[job].result = result;
        const summary = securitySummary(input, needs);
        assert.equal(summary.ok, false, `${input.eventName}: ${job}: ${result}`);
        assert.deepEqual(summary.failures, [`${job}: ${result ?? 'missing'}`]);
      }
    }
  }
  assert.equal(securitySummary(context, null).ok, false);
});

test('legitimate skips must be observed and the separate advisory publisher outcome is never invented', () => {
  const push = { ...context, eventName: 'push', ref: 'refs/heads/dev' };
  for (const job of securityPolicy(push).skipped) for (const result of ['success', 'failure', 'cancelled', undefined]) {
    const needs = needsFor(push);
    if (result === undefined) delete needs[job]; else needs[job].result = result;
    assert.equal(securitySummary(push, needs).ok, false);
  }
  for (const eventName of ['schedule', 'push']) {
    const input = { ...context, eventName, ref: 'refs/heads/main' }, needs = needsFor(input);
    assert.equal(securitySummary(input, needs).ok, true);
    assert.equal(securityPolicy(input).required.includes('scorecard'), false);
    assert.equal(Object.hasOwn(needs, 'scorecard'), false);
    assert.match(securitySummary(input, needs).rows.join('\n'), /separate advisory Scorecard Publishing workflow; its outcome is not observed/);
    assert.equal(securitySummary(input, needs).rows.some(row => row.startsWith('scorecard:')), false);
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

test('Scorecard findings remain advisory while missing/malformed/wrong-tool/execution-error SARIF refuses', () => {
  assert.deepEqual(validateSarif(sarif([finding], 'scorecard'), 'Scorecard'), { findings: 1 });
  const missingResults = sarif([], 'scorecard'); delete missingResults.runs[0].results;
  const failedExecution = sarif([], 'scorecard'); failedExecution.runs[0].invocations[0].executionSuccessful = false;
  for (const value of [undefined, {}, sarif([], 'Semgrep OSS'), missingResults, failedExecution]) assert.throws(() => validateSarif(value, 'Scorecard'));
  const cwd = mkdtempSync(join(tmpdir(), 'cortex-scorecard-sarif-'));
  try {
    const file = join(cwd, 'scorecard-results.sarif');
    const execute = () => spawnSync(process.execPath, ['scripts/security-contract.mjs', 'sarif', file, 'Scorecard'], { encoding: 'utf8' });
    assert.equal(execute().status, 1);
    for (const value of ['{invalid', JSON.stringify(sarif([], 'wrong-tool')), JSON.stringify(failedExecution)]) {
      writeFileSync(file, value); assert.equal(execute().status, 1);
    }
    writeFileSync(file, JSON.stringify(sarif([finding], 'scorecard')));
    const valid = execute(); assert.equal(valid.status, 0, valid.stderr); assert.deepEqual(JSON.parse(valid.stdout), { findings: 1 });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
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

test('Scorecard analysis selection matches the real workflow and never hides required analysis as skipped', () => {
  const workflow = yaml.load(readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8'));
  const analysis = workflow.jobs['scorecard-analysis'];
  assert.equal(analysis.if, "github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch'");
  assert.ok(workflow.jobs['security-summary'].needs.includes('scorecard-analysis'));
  assert.equal(workflow.jobs['security-summary'].if, 'always()');
  for (const [eventName, ref, analysisRequired] of [
    ['pull_request', 'refs/pull/1/merge', true],
    ['workflow_dispatch', 'refs/heads/main', true],
    // Upstream may refuse this manual target; the required job must fail visibly.
    ['workflow_dispatch', 'refs/heads/dev', true],
    ['push', 'refs/heads/main', false],
    ['push', 'refs/heads/dev', false],
    ['schedule', 'refs/heads/main', false],
  ]) {
    const input = { ...context, eventName, ref }, policy = securityPolicy(input);
    assert.equal(policy.required.includes('scorecard-analysis'), analysisRequired);
    assert.equal(policy.skipped.includes('scorecard-analysis'), !analysisRequired);
    assert.equal(securitySummary(input, needsFor(input)).ok, true);
    const missing = needsFor(input); delete missing['scorecard-analysis'];
    assert.equal(securitySummary(input, missing).ok, false);
  }
});

test('PR/manual Scorecard scan, validated SARIF and upload run in order without OIDC/PAT/secrets or softened failures', () => {
  const workflow = yaml.load(readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8'));
  const job = workflow.jobs['scorecard-analysis'];
  assert.deepEqual(job.permissions, { contents: 'read', 'security-events': 'write' });
  assert.equal(job['continue-on-error'], undefined);
  assert.equal(job.runs, undefined); assert.equal(job['runs-on'], 'ubuntu-latest');
  assert.equal(job.env, undefined); assert.equal(job.secrets, undefined);
  assert.doesNotMatch(JSON.stringify(job), /id-token|secrets\.|repo_token|internal_default_token|pull_request_target/);
  const scan = job.steps.findIndex(step => step.uses === 'ossf/scorecard-action@v2.4.3');
  const validate = job.steps.findIndex(step => step.run === 'node scripts/security-contract.mjs sarif scorecard-results.sarif Scorecard');
  const upload = job.steps.findIndex(step => step.uses === 'github/codeql-action/upload-sarif@v4');
  assert.ok(scan >= 0 && validate > scan && upload > validate);
  assert.deepEqual(job.steps[scan].with, { results_file: 'scorecard-results.sarif', results_format: 'sarif', publish_results: false });
  assert.deepEqual(job.steps[upload].with, { sarif_file: 'scorecard-results.sarif', category: 'scorecard' });
  for (const index of [scan, validate, upload]) {
    assert.equal(job.steps[index].if, undefined);
    assert.equal(job.steps[index]['continue-on-error'], undefined);
  }
  const checkout = job.steps.find(step => step.uses === 'actions/checkout@v6');
  assert.equal(checkout.with['persist-credentials'], false);
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  for (const eventName of ['pull_request', 'workflow_dispatch']) {
    const input = { ...context, eventName };
    for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
      const needs = needsFor(input);
      if (result === undefined) delete needs['scorecard-analysis']; else needs['scorecard-analysis'].result = result;
      assert.equal(securitySummary(input, needs).ok, false);
    }
  }
});

const sourceSha = 'a'.repeat(40);
const manualSource = { eventName: 'workflow_dispatch', repository: 'owner/cortex', ref: 'refs/heads/main', sha: sourceSha };
const sourceObservations = (values = [sourceSha, { default_branch: 'main' }, { ref: 'refs/heads/main', object: { type: 'commit', sha: sourceSha } }, sourceSha]) => {
  const calls = [];
  return { calls, spawn: (executable, args, options) => {
    calls.push({ executable, args, options });
    const value = values[calls.length - 1];
    if (value?.failure) return value.failure;
    return { status: 0, stdout: typeof value === 'string' ? value + '\n' : JSON.stringify(value), stderr: '' };
  } };
};

test('manual Scorecard source observations bind dispatch SHA, exact checkout and the public GitHub default ref with finite GET-only reads', () => {
  const observed = sourceObservations();
  assert.deepEqual(checkScorecardSource(manualSource, { spawn: observed.spawn, token: 'synthetic-github-token' }), { ...manualSource, checkoutSha: sourceSha, source: 'remote-default-head', defaultBranch: 'main', remoteSha: sourceSha });
  assert.deepEqual(observed.calls.map(({ executable, args }) => [executable, args]), [
    ['git', ['rev-parse', '--verify', 'HEAD']],
    ['gh', ['api', '--hostname', 'github.com', '--method', 'GET', 'repos/owner/cortex']],
    ['gh', ['api', '--hostname', 'github.com', '--method', 'GET', 'repos/owner/cortex/git/ref/heads/main']],
    ['git', ['rev-parse', '--verify', 'HEAD']],
  ]);
  for (const call of observed.calls) {
    assert.equal(call.options.timeout, 10_000); assert.equal(call.options.maxBuffer, 64 * 1024); assert.equal(call.options.killSignal, 'SIGKILL');
    if (call.executable === 'gh') assert.equal(call.options.env.GH_TOKEN, 'synthetic-github-token');
  }
  const pr = sourceObservations([sourceSha]);
  assert.equal(checkScorecardSource({ ...manualSource, eventName: 'pull_request', ref: 'refs/pull/42/merge' }, { spawn: pr.spawn }).source, 'normal-pr-merge-checkout');
  assert.equal(pr.calls.length, 1); assert.equal(pr.calls[0].executable, 'git');
});

test('stale/nondefault/manual source movement at each fence refuses without retries; PR source must be its normal merge checkout', () => {
  const changed = 'b'.repeat(40);
  for (const changeAt of [0, 1, 2]) {
    for (let phase = 0; phase <= changeAt; phase++) {
      const observed = sourceObservations([sourceSha, { default_branch: 'main' }, { ref: 'refs/heads/main', object: { type: 'commit', sha: phase === changeAt ? changed : sourceSha } }, sourceSha]);
      if (phase === changeAt) {
        assert.throws(() => checkScorecardSource(manualSource, { spawn: observed.spawn, token: 'synthetic-github-token' }), /no longer matches/);
        assert.equal(observed.calls.length, 3);
      } else assert.equal(checkScorecardSource(manualSource, { spawn: observed.spawn, token: 'synthetic-github-token' }).remoteSha, sourceSha);
    }
  }
  for (const [input, values, pattern, expectedReads] of [
    [{ ...manualSource, ref: 'refs/heads/dev' }, [sourceSha, { default_branch: 'main' }], /default branch/, 2],
    [manualSource, [changed], /checkout HEAD does not match/, 1],
    [manualSource, [sourceSha, { default_branch: 'main' }, { ref: 'refs/heads/main', object: { type: 'commit', sha: sourceSha } }, changed], /HEAD moved/, 4],
    [manualSource, [sourceSha, { default_branch: 'main' }, { ref: 'refs/heads/dev', object: { type: 'commit', sha: sourceSha } }], /no longer matches/, 3],
    [manualSource, [sourceSha, { default_branch: 'main' }, { ref: 'refs/heads/main', object: { type: 'tag', sha: sourceSha } }], /no longer matches/, 3],
  ]) {
    const observed = sourceObservations(values);
    assert.throws(() => checkScorecardSource(input, { spawn: observed.spawn, token: 'synthetic-github-token' }), pattern);
    assert.equal(observed.calls.length, expectedReads);
  }
  for (const input of [{ ...manualSource, eventName: 'pull_request_target' }, { ...manualSource, eventName: 'pull_request', ref: 'refs/heads/main' }, { ...manualSource, repository: '../unsafe' }, { ...manualSource, repository: './unsafe' }, { ...manualSource, repository: 'owner/.' }, { ...manualSource, repository: 'owner/..' }, { ...manualSource, sha: 'main' }]) {
    const observed = sourceObservations();
    assert.throws(() => checkScorecardSource(input, { spawn: observed.spawn }), /required|normal PR/); assert.equal(observed.calls.length, 0);
  }
});

test('manual source checks fail closed on missing token, malformed remote JSON, absent metadata and bounded command errors', () => {
  const noToken = sourceObservations();
  assert.throws(() => checkScorecardSource(manualSource, { spawn: noToken.spawn, token: '' }), /GH_TOKEN/); assert.equal(noToken.calls.length, 1);
  for (const failure of [{ status: 1 }, { status: null, signal: 'SIGKILL' }, { error: new Error('timeout') }, { error: new Error('ENOBUFS') }]) {
    const observed = sourceObservations([sourceSha, { failure }]);
    assert.throws(() => checkScorecardSource(manualSource, { spawn: observed.spawn, token: 'synthetic-github-token' }), /observation failed/); assert.equal(observed.calls.length, 2);
  }
  for (const value of ['{malformed', '{}', JSON.stringify({ default_branch: '' })]) {
    const observed = sourceObservations([sourceSha, value]);
    assert.throws(() => checkScorecardSource(manualSource, { spawn: observed.spawn, token: 'synthetic-github-token' }), /Invalid GitHub JSON|valid repository default branch/); assert.equal(observed.calls.length, 2);
  }
});

test('source CLI observes the actual checkout for PR merge metadata and refuses a mismatched workflow SHA', () => {
  const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' });
  assert.equal(head.status, 0, head.stderr);
  const sha = head.stdout.trim();
  const env = { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/42/merge', GITHUB_REPOSITORY: 'owner/cortex', GITHUB_SHA: sha, GH_TOKEN: '' };
  const valid = spawnSync(process.execPath, ['scripts/security-contract.mjs', 'scorecard-source'], { env, encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stderr); assert.equal(JSON.parse(valid.stdout).checkoutSha, sha);
  const invalid = spawnSync(process.execPath, ['scripts/security-contract.mjs', 'scorecard-source'], { env: { ...env, GITHUB_SHA: 'f'.repeat(40) }, encoding: 'utf8' });
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /checkout HEAD does not match/);
});

test('the real workflow source fences bracket analysis and precede upload with the default token and fatal failures', () => {
  const workflow = yaml.load(readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8'));
  const job = workflow.jobs['scorecard-analysis'];
  const indices = ['Verify Scorecard source before analysis', 'Run Scorecard analysis without external publication', 'Verify Scorecard source after analysis', 'Validate Scorecard results', 'Verify Scorecard source before upload', 'Upload Scorecard SARIF'].map(name => job.steps.findIndex(step => step.name === name));
  assert.ok(indices.every((index, position) => index >= 0 && (position === 0 || index > indices[position - 1])));
  for (const position of [0, 2, 4]) {
    const step = job.steps[indices[position]];
    assert.equal(step.run, 'node scripts/security-contract.mjs scorecard-source');
    assert.deepEqual(step.env, { GH_TOKEN: '${{ github.token }}' });
    assert.equal(step.if, undefined); assert.equal(step['continue-on-error'], undefined);
  }
});

test('one Scorecard job per producing workflow isolates the advisory publisher under the complete upstream workflow restrictions', () => {
  const security = yaml.load(readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8'));
  const publishing = yaml.load(readFileSync(new URL('../.github/workflows/scorecard-publish.yml', import.meta.url), 'utf8'));
  const scorecardJobs = workflow => Object.entries(workflow.jobs).filter(([, job]) => job.steps?.some(step => step.uses === 'ossf/scorecard-action@v2.4.3'));
  assert.deepEqual(scorecardJobs(security).map(([name]) => name), ['scorecard-analysis']);
  assert.deepEqual(scorecardJobs(publishing).map(([name]) => name), ['scorecard']);
  assert.equal(security.jobs.scorecard, undefined); assert.equal(security.jobs['security-summary'].needs.includes('scorecard'), false);
  assert.deepEqual(publishing.on, { push: { branches: ['main'] }, schedule: [{ cron: '0 3 * * 1' }] });
  assert.equal(publishing.name, 'Scorecard Publishing'); assert.equal(publishing.env, undefined); assert.equal(publishing.defaults, undefined);
  assert.deepEqual(publishing.permissions, { contents: 'read' }); assert.deepEqual(Object.keys(publishing.jobs), ['scorecard']);
  const job = publishing.jobs.scorecard;
  assert.equal(job.if, "github.event_name == 'schedule' || (github.event_name == 'push' && github.ref == 'refs/heads/main')");
  assert.equal(job['continue-on-error'], true);
  assert.deepEqual(job.permissions, { 'security-events': 'write', 'id-token': 'write', contents: 'read', actions: 'read' });
  assert.equal(job['runs-on'], 'ubuntu-latest');
  for (const field of ['env', 'defaults', 'container', 'services']) assert.equal(job[field], undefined);
  const allowed = new Set(['actions/checkout', 'actions/upload-artifact', 'github/codeql-action/upload-sarif', 'ossf/scorecard-action', 'step-security/harden-runner']);
  for (const step of job.steps) {
    assert.equal(typeof step.uses, 'string'); assert.equal(step.run, undefined); assert.ok(allowed.has(step.uses.split('@')[0]), step.uses);
  }
  assert.equal(job.steps.find(step => step.uses === 'ossf/scorecard-action@v2.4.3').with.publish_results, true);
  for (const other of Object.values(security.jobs)) assert.notEqual(other.permissions?.['id-token'], 'write');
  assert.match(securitySummary(context, needsFor(context)).rows.join('\n'), /separate advisory Scorecard Publishing workflow; its outcome is not observed/);
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
