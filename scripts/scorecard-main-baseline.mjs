/** One diagnostic attempt: two independent native scans, observational main attribution. */
import { spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const target = Object.freeze({ repository: 'SaintNick1214/Project-Cortex', repo: 'github.com/SaintNick1214/Project-Cortex', ref: 'refs/heads/main', sha: '924b2e9ff6b615dcf0f26377de57aac9bf4607cb' });
export const controlRef = 'refs/heads/diagnostic/scorecard-main-baseline-924b';
const policy = "# Copyright 2021 Security Scorecard Authors\n#\n# Licensed under the Apache License, Version 2.0 (the \"License\");\n# you may not use this file except in compliance with the License.\n# You may obtain a copy of the License at\n#\n#      http://www.apache.org/licenses/LICENSE-2.0\n#\n# Unless required by applicable law or agreed to in writing, software\n# distributed under the License is distributed on an \"AS IS\" BASIS,\n# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n# See the License for the specific language governing permissions and\n# limitations under the License.\n\nversion: 1\npolicies:\n  Token-Permissions:\n      score: 10\n      mode: enforced\n  Branch-Protection:\n      score: 10\n      mode: enforced\n  Code-Review:\n      score: 10\n      mode: enforced\n  Dangerous-Workflow:\n      score: 10\n      mode: enforced\n  License:\n      score: 9\n      mode: enforced\n  Pinned-Dependencies:\n      score: 10\n      mode: enforced\n  Security-Policy:\n      score: 10\n      mode: enforced\n  SAST:\n      score: 10\n      mode: enforced\n  Contributors:\n      score: 10\n      mode: disabled\n  Packaging:\n      score: 10\n      mode: enforced\n  Binary-Artifacts:\n      score: 10\n      mode: enforced\n  Signed-Releases:\n      score: 10\n      mode: disabled\n  Dependency-Update-Tool:\n      score: 10\n      mode: enforced\n  Fuzzing:\n      score: 10\n      mode: enforced\n  CII-Best-Practices:\n      # passing score\n      score: 5\n      mode: enforced\n  Vulnerabilities:\n      score: 10\n      mode: enforced\n  CI-Tests:\n      score: 10\n      mode: enforced\n  Maintained:\n      score: 1\n      mode: enforced";
const hash = value => createHash('sha256').update(value).digest('hex');
export const pin = Object.freeze({ version: '5.3.0', engine: 'c22063e786c11f9dd714d777a687ff7c4599b600', archive: 'https://github.com/ossf/scorecard/releases/download/v5.3.0/scorecard_5.3.0_linux_amd64.tar.gz', archiveSha256: '98351e001a2bae1d12ec6fbca7da42168bdda2eecbb4fa6951ebffb5ced3a0be', asset: 298960557, policySource: 'https://github.com/ossf/scorecard-action/blob/4eaacf0543bb3f2c246792bd56e8cdeffafb205a/policies/template.yml', policySha256: hash(policy) });
export const checks = Object.freeze([...policy.matchAll(/^  ([A-Za-z-]+):$/gm)].map(match => match[1]).sort());
const scanBounds = Object.freeze({ timeoutMs: 240_000, maxBytes: 8 * 1024 * 1024 });
const categories = ['supply-chain/branch-protection', 'supply-chain/local', 'supply-chain/online-scm'];
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

/** Every output stream is bounded; errors remain explicit even if output exists. */
export function boundedProcess(executable, args, { timeoutMs, maxBytes, env = {} }, spawn = spawnSync) {
  requireThat(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && Number.isSafeInteger(maxBytes) && maxBytes > 0, 'Positive finite process bounds required');
  const startedAt = new Date().toISOString(), started = Date.now();
  const result = spawn(executable, args, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: maxBytes, env });
  const stdout = Buffer.from(result.stdout ?? ''), stderr = Buffer.from(result.stderr ?? '');
  const receipt = { executable, args, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, bounds: { timeoutMs, maxBytesPerStream: maxBytes }, code: result.status ?? null, signal: result.signal ?? null, error: result.error?.code ?? (result.error ? 'PROCESS_ERROR' : null), stdoutBytes: stdout.length, stderrBytes: stderr.length, stdoutSha256: hash(stdout), stderrSha256: hash(stderr) };
  return { receipt, stdout, stderr };
}
function successful(record) {
  requireThat(record.code === 0 && !record.signal && !record.error && record.stdoutBytes <= record.bounds.maxBytesPerStream && record.stderrBytes <= record.bounds.maxBytesPerStream, 'Native process failed, timed out or exceeded an output bound');
}
export function assertObservation(value, phase) {
  requireThat(value?.phase === phase && typeof value.observedAt === 'string' && value.repository?.full_name === target.repository && value.repository.private === false && value.repository.default_branch === 'main' && value.reference?.ref === target.ref && value.reference.object?.type === 'commit' && value.reference.object.sha === target.sha, `Remote-main source mismatch at ${phase}`);
  return value;
}
export function nativeArguments(format, policyFile) {
  requireThat(['json', 'sarif'].includes(format) && typeof policyFile === 'string' && policyFile.length > 0, 'Exact native format and policy path required');
  return [`--repo=${target.repo}`, '--commit=HEAD', `--format=${format}`, '--show-details', `--policy=${policyFile}`];
}
function identity(value) {
  requireThat(value?.archiveSha256 === pin.archiveSha256 && value.engine === pin.engine && value.version === pin.version && value.policySha256 === pin.policySha256 && /^[a-f0-9]{64}$/.test(value.binarySha256 ?? '') && typeof value.executable === 'string' && typeof value.policyFile === 'string', 'Official pinned CLI identity mismatch');
}
export function validateJson(bytes) {
  const value = JSON.parse(bytes.toString('utf8'));
  requireThat(value?.repo?.name === target.repo && value.repo.commit === target.sha, 'JSON invocation reported another repository or commit');
  requireThat(value.scorecard?.version?.replace(/^v/, '') === pin.version && value.scorecard.commit === pin.engine, 'JSON engine identity mismatch');
  requireThat(Array.isArray(value.checks) && same(value.checks.map(check => check.name).sort(), checks), 'Native default check catalog mismatch');
  requireThat((value.errors === undefined || (Array.isArray(value.errors) && value.errors.length === 0)) && value.checks.every(check => Number.isInteger(check.score) && check.score >= -1 && check.score <= 10 && typeof check.reason === 'string' && !check.error), 'Native JSON scanner error or malformed check');
  return { reportedRepo: value.repo.name, reportedCommit: value.repo.commit, unknownChecks: value.checks.filter(check => check.score === -1).map(check => check.name), claim: 'Native target self-report for the JSON invocation only; does not attest the separate SARIF scan.' };
}
export function validateSarif(bytes) {
  const value = JSON.parse(bytes.toString('utf8'));
  requireThat(value?.version === '2.1.0' && Array.isArray(value.runs) && value.runs.length === 3, 'Malformed native SARIF runs');
  const found = [], names = [];
  let findings = 0;
  for (const run of value.runs) {
    const driver = run.tool?.driver, id = run.automationDetails?.id;
    requireThat(driver?.name === 'Scorecard' && driver.informationUri === 'https://github.com/ossf/scorecard' && driver.semanticVersion?.replace(/^v/, '') === pin.version, 'Native SARIF tool mismatch');
    const category = typeof id === 'string' ? id.split('/').slice(0, 2).join('/') : '';
    requireThat(categories.includes(category) && id.startsWith(`${category}/${pin.engine}-`), 'Native SARIF category or engine mismatch');
    requireThat(Array.isArray(driver.rules) && driver.rules.length > 0 && Array.isArray(run.results), 'Malformed native SARIF rules/results');
    requireThat(!(run.invocations ?? []).some(invocation => invocation.executionSuccessful === false || invocation.toolExecutionNotifications?.some(notification => notification.level === 'error')), 'Native SARIF scanner execution error');
    if (category === 'supply-chain/branch-protection') requireThat(driver.rules.some(rule => rule.name === 'Branch-Protection'), 'Native branch-protection rule missing');
    const ids = new Set(driver.rules.map(rule => rule.id));
    for (const result of run.results) requireThat(ids.has(result.ruleId) && typeof result.message?.text === 'string' && result.message.text.length > 0 && result.locations?.some(location => typeof location.physicalLocation?.artifactLocation?.uri === 'string'), 'Malformed native SARIF finding');
    names.push(...driver.rules.map(rule => rule.name)); found.push(category); findings += run.results.length;
  }
  requireThat(same(found.sort(), categories) && same(names.sort(), checks), 'Missing/duplicate native categories or default checks');
  return { categories: found, findings, claim: 'Separate native SARIF invocation; target attribution is observational. SARIF does not report the analyzed target commit; its automation commit identifies the engine.' };
}
function validateInvocation(record, format, cli) {
  successful(record);
  requireThat(record.bounds.timeoutMs === scanBounds.timeoutMs && record.bounds.maxBytesPerStream === scanBounds.maxBytes && record.format === format && record.executable === cli.executable && same(record.args, nativeArguments(format, cli.policyFile)) && record.binarySha256 === cli.binarySha256 && record.archiveSha256 === pin.archiveSha256 && record.version === pin.version && record.engine === pin.engine && same(record.target, target) && record.stdoutFile === join(dirname(cli.policyFile), `native-${format}.stdout`) && record.stderrFile === join(dirname(cli.policyFile), `native-${format}.stderr`), 'Native invocation identity/arguments/bounds mismatch');
}
/** Dependencies are injected only for hosted refusal assertions, never for CLI target selection. */
export function executeBaseline({ acquire, observe, scan, persist }) {
  const receipt = { schema: 1, target, status: 'started', observations: [], invocations: [], uploadEligible: false, limitation: 'Two independent remote-HEAD analyses. JSON corroborates only itself; SARIF source is observational. Sampled ref fences cannot detect a move-and-revert between observations. Repository settings are live mutable data.' };
  try {
    receipt.pin = acquire(); identity(receipt.pin); persist(receipt);
    receipt.observations.push(assertObservation(observe('before-json'), 'before-json')); persist(receipt);
    for (const format of ['json', 'sarif']) {
      const outcome = scan(format, receipt.pin);
      receipt.invocations.push({ ...outcome.receipt, format }); persist(receipt);
      validateInvocation(receipt.invocations.at(-1), format, receipt.pin);
      receipt[format] = format === 'json' ? validateJson(outcome.stdout) : validateSarif(outcome.stdout);
      const phase = format === 'json' ? 'between-scans' : 'after-sarif';
      receipt.observations.push(assertObservation(observe(phase), phase)); persist(receipt);
    }
    receipt.status = 'ready-for-final-fence'; persist(receipt);
    return receipt;
  } catch (error) { receipt.status = 'failed'; receipt.error = error.message; persist(receipt); throw error; }
}
export function verifyBeforeUpload({ receipt, outputs }, { observe, persist }) {
  try {
    requireThat(receipt?.schema === 1 && same(receipt.target, target) && receipt.status === 'ready-for-final-fence' && receipt.uploadEligible === false && receipt.invocations?.length === 2, 'Incomplete, repeated or failed diagnostic bundle');
    identity(receipt.pin);
    for (const [index, format] of ['json', 'sarif'].entries()) {
      const record = receipt.invocations[index], output = outputs[format];
      validateInvocation(record, format, receipt.pin);
      requireThat(output && output.stdout.length === record.stdoutBytes && output.stderr.length === record.stderrBytes && hash(output.stdout) === record.stdoutSha256 && hash(output.stderr) === record.stderrSha256, 'Raw native output hash mismatch');
      if (format === 'json') validateJson(output.stdout); else validateSarif(output.stdout);
    }
    requireThat(same(receipt.observations.map(value => value.phase), ['before-json', 'between-scans', 'after-sarif']), 'Incomplete source fence history');
    for (const observation of receipt.observations) assertObservation(observation, observation.phase);
    receipt.observations.push(assertObservation(observe('before-upload'), 'before-upload'));
    receipt.uploadEligible = true; receipt.status = 'observational-upload-ready'; persist(receipt);
    return receipt;
  } catch (error) {
    if (receipt && typeof receipt === 'object') { receipt.status = 'failed'; receipt.uploadEligible = false; receipt.error = error.message; persist(receipt); }
    throw error;
  }
}

function cliEnvironment(token) { return { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.RUNNER_TEMP, GITHUB_AUTH_TOKEN: token, ENABLE_SARIF: '1' }; }
function capture(directory, name, executable, args, bounds, env) {
  const outcome = boundedProcess(executable, args, { ...bounds, env });
  outcome.receipt.stdoutFile = join(directory, `${name}.stdout`); outcome.receipt.stderrFile = join(directory, `${name}.stderr`);
  writeFileSync(outcome.receipt.stdoutFile, outcome.stdout); writeFileSync(outcome.receipt.stderrFile, outcome.stderr);
  writeFileSync(join(directory, `${name}.process.json`), JSON.stringify(outcome.receipt, null, 2));
  return outcome;
}
function acquireCli(directory) {
  const download = capture(directory, 'release', 'curl', ['--fail', '--location', '--max-time', '60', '--proto', '=https', '--proto-redir', '=https', pin.archive], { timeoutMs: 65_000, maxBytes: 32 * 1024 * 1024 }, { PATH: process.env.PATH });
  successful(download.receipt); requireThat(hash(download.stdout) === pin.archiveSha256, 'Official archive digest mismatch');
  const unpack = capture(directory, 'scorecard', 'tar', ['-xzOf', join(directory, 'release.stdout'), 'scorecard'], { timeoutMs: 30_000, maxBytes: 64 * 1024 * 1024 }, { PATH: process.env.PATH });
  successful(unpack.receipt);
  const executable = join(directory, 'scorecard.stdout'), policyFile = join(directory, 'native-policy.yml');
  chmodSync(executable, 0o700); writeFileSync(policyFile, policy);
  return { ...pin, executable, policyFile, binarySha256: hash(unpack.stdout) };
}
function pinnedFiles(cli) {
  identity(cli); requireThat(hash(readFileSync(cli.executable)) === cli.binarySha256 && hash(readFileSync(cli.policyFile)) === pin.policySha256, 'Pinned CLI/policy bytes moved');
}
function observeSource(phase, directory, token) {
  const get = (name, endpoint) => {
    const outcome = capture(directory, `${phase}-${name}`, 'gh', ['api', '--hostname', 'github.com', '--method', 'GET', endpoint], { timeoutMs: 10_000, maxBytes: 64 * 1024 }, { PATH: process.env.PATH, GH_TOKEN: token });
    successful(outcome.receipt); return JSON.parse(outcome.stdout.toString('utf8'));
  };
  return { phase, observedAt: new Date().toISOString(), repository: get('repository', `repos/${target.repository}`), reference: get('ref', `repos/${target.repository}/git/ref/heads/main`) };
}
function context() {
  requireThat(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.GITHUB_REPOSITORY === target.repository && process.env.GITHUB_REF === controlRef && process.env.GITHUB_RUN_ATTEMPT === '1', 'Only the first manual attempt on the isolated diagnostic branch is allowed');
  requireThat(/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '') && /^\d+$/.test(process.env.GITHUB_RUN_ID ?? ''), 'Exact diagnostic control SHA/run ID required');
  requireThat(process.platform === 'linux' && process.arch === 'x64' && typeof process.env.GH_TOKEN === 'string' && process.env.GH_TOKEN.length > 0, 'Linux-amd64 and the default GitHub token required');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    context();
    const [command, suppliedDirectory] = process.argv.slice(2), directory = resolve(suppliedDirectory ?? '');
    requireThat(['run', 'preupload'].includes(command) && suppliedDirectory, 'Expected run|preupload <owned evidence directory>');
    const token = process.env.GH_TOKEN;
    const control = { repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF, sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT };
    const persist = value => { value.control ??= control; writeFileSync(join(directory, 'receipt.json'), JSON.stringify(value, null, 2)); };
    if (command === 'run') {
      mkdirSync(directory);
      executeBaseline({ acquire: () => acquireCli(directory), observe: phase => observeSource(phase, directory, token), persist, scan: (format, cli) => {
        pinnedFiles(cli);
        const outcome = capture(directory, `native-${format}`, cli.executable, nativeArguments(format, cli.policyFile), scanBounds, cliEnvironment(token));
        outcome.receipt.binarySha256 = cli.binarySha256; outcome.receipt.archiveSha256 = cli.archiveSha256;
        outcome.receipt.version = pin.version; outcome.receipt.engine = pin.engine; outcome.receipt.target = target; outcome.receipt.format = format;
        writeFileSync(join(directory, `native-${format}.process.json`), JSON.stringify(outcome.receipt, null, 2));
        return outcome;
      } });
    } else {
      const receipt = JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8')); requireThat(same(receipt.control, control), 'Diagnostic control run changed'); pinnedFiles(receipt.pin);
      const outputs = Object.fromEntries(['json', 'sarif'].map(format => [format, { stdout: readFileSync(join(directory, `native-${format}.stdout`)), stderr: readFileSync(join(directory, `native-${format}.stderr`)) }]));
      verifyBeforeUpload({ receipt, outputs }, { observe: phase => observeSource(phase, directory, token), persist });
      requireThat(process.env.GITHUB_OUTPUT, 'GitHub output file required'); appendFileSync(process.env.GITHUB_OUTPUT, 'upload_ready=true\n');
    }
    console.log('Remote-main baseline protocol completed its selected phase; source attribution remains observational.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
