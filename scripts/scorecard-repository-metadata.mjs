/** Preserve native local analysis; add one independent live repository-settings snapshot for PRs. */
import { spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const repository = 'SaintNick1214/Project-Cortex';
const policy = "# Copyright 2021 Security Scorecard Authors\n#\n# Licensed under the Apache License, Version 2.0 (the \"License\");\n# you may not use this file except in compliance with the License.\n# You may obtain a copy of the License at\n#\n#      http://www.apache.org/licenses/LICENSE-2.0\n#\n# Unless required by applicable law or agreed to in writing, software\n# distributed under the License is distributed on an \"AS IS\" BASIS,\n# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n# See the License for the specific language governing permissions and\n# limitations under the License.\n\nversion: 1\npolicies:\n  Token-Permissions:\n      score: 10\n      mode: enforced\n  Branch-Protection:\n      score: 10\n      mode: enforced\n  Code-Review:\n      score: 10\n      mode: enforced\n  Dangerous-Workflow:\n      score: 10\n      mode: enforced\n  License:\n      score: 9\n      mode: enforced\n  Pinned-Dependencies:\n      score: 10\n      mode: enforced\n  Security-Policy:\n      score: 10\n      mode: enforced\n  SAST:\n      score: 10\n      mode: enforced\n  Contributors:\n      score: 10\n      mode: disabled\n  Packaging:\n      score: 10\n      mode: enforced\n  Binary-Artifacts:\n      score: 10\n      mode: enforced\n  Signed-Releases:\n      score: 10\n      mode: disabled\n  Dependency-Update-Tool:\n      score: 10\n      mode: enforced\n  Fuzzing:\n      score: 10\n      mode: enforced\n  CII-Best-Practices:\n      # passing score\n      score: 5\n      mode: enforced\n  Vulnerabilities:\n      score: 10\n      mode: enforced\n  CI-Tests:\n      score: 10\n      mode: enforced\n  Maintained:\n      score: 1\n      mode: enforced";
export const pin = Object.freeze({ version: '5.3.0', engine: 'c22063e786c11f9dd714d777a687ff7c4599b600', archive: 'https://github.com/ossf/scorecard/releases/download/v5.3.0/scorecard_5.3.0_linux_amd64.tar.gz', archiveSha256: '98351e001a2bae1d12ec6fbca7da42168bdda2eecbb4fa6951ebffb5ced3a0be', asset: 298960557, policySha256: '6e75dcc0df989d333492c0e1f6e484fc5b4d26ab768333ddcd0e3788539689b0', policySource: 'https://github.com/ossf/scorecard-action/blob/4eaacf0543bb3f2c246792bd56e8cdeffafb205a/policies/template.yml' });
const maximumBytes = 8 * 1024 * 1024;
const categories = ['supply-chain/branch-protection', 'supply-chain/local', 'supply-chain/online-scm'];
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const demand = (condition, message) => { if (!condition) throw new Error(message); };
const roleFor = context => context.eventName === 'pull_request' ? 'local-pr' : 'remote-manual';
const expectedNames = role => role === 'local-pr' ? ['local-code.sarif', 'repository-settings.sarif'] : ['remote-manual.sarif'];

export function validateContext(context, checkoutSha) {
  demand(context?.repository === repository && context.eventRepository === repository && context.public === true && Number.isSafeInteger(context.repositoryId) && context.repositoryId > 0 && /^[a-f0-9]{40}$/.test(context.sha ?? '') && checkoutSha === context.sha && /^\d+$/.test(context.runId ?? '') && /^[1-9]\d*$/.test(context.attempt ?? ''), 'Public repository, current checkout and workflow control mismatch');
  if (context.eventName === 'pull_request') demand(Number.isSafeInteger(context.number) && context.number > 0 && context.ref === `refs/pull/${context.number}/merge` && context.baseRepository === repository && context.baseRepositoryId === context.repositoryId && context.basePrivate === false, 'Normal PR merge evaluation context required');
  else demand(context.eventName === 'workflow_dispatch' && /^refs\/heads\/.+/.test(context.ref ?? ''), 'Only PR or existing manual coverage applies');
  return context;
}
export function boundedProcess(executable, args, { timeoutMs, maxBytes, env = {} }, spawn = spawnSync) {
  demand(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && Number.isSafeInteger(maxBytes) && maxBytes > 0, 'Positive finite process bounds required');
  const startedAt = new Date().toISOString(), started = Date.now();
  const result = spawn(executable, args, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: maxBytes, env });
  const stdout = Buffer.from(result.stdout ?? ''), stderr = Buffer.from(result.stderr ?? '');
  return { stdout, stderr, receipt: { executable, args, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, bounds: { timeoutMs, maxBytes }, code: result.status ?? null, signal: result.signal ?? null, error: result.error?.code ?? (result.error ? 'PROCESS_ERROR' : null), stdoutBytes: stdout.length, stderrBytes: stderr.length, stdoutSha256: hash(stdout), stderrSha256: hash(stderr) } };
}
function successful(record) {
  demand(record?.code === 0 && !record.signal && !record.error && record.stdoutBytes <= record.bounds.maxBytes && record.stderrBytes <= record.bounds.maxBytes, 'Native process failed, timed out or exceeded an output bound');
}
export function nativeArguments(policyFile) {
  demand(typeof policyFile === 'string' && policyFile.length > 0, 'Exact native policy path required');
  return [`--repo=github.com/${repository}`, '--commit=HEAD', '--checks=Branch-Protection', '--format=sarif', '--show-details', `--policy=${policyFile}`];
}
function validPin(value) {
  demand(value?.archiveSha256 === pin.archiveSha256 && value.policySha256 === pin.policySha256 && value.engine === pin.engine && value.version === pin.version && /^[a-f0-9]{64}$/.test(value.binarySha256 ?? '') && typeof value.executable === 'string' && typeof value.policyFile === 'string', 'Pinned official executable/policy mismatch');
}
export function validateSnapshot(value, phase, context, anchor) {
  validateContext(context, value?.checkoutSha); validateContext(context, value.checkoutAfter);
  demand(value.phase === phase && Number.isFinite(Date.parse(value.observedAt)) && value.repository?.full_name === repository && value.repository.id === context.repositoryId && value.repository.private === false && value.repository.default_branch === 'main' && value.reference?.ref === 'refs/heads/main' && value.reference.object?.type === 'commit' && /^[a-f0-9]{40}$/.test(value.reference.object.sha ?? ''), `Live public default-ref mismatch at ${phase}`);
  if (anchor) demand(value.reference.object.sha === anchor.reference.object.sha && value.repository.id === anchor.repository.id, `Live repository/default HEAD moved at ${phase}`);
  return value;
}
export function validateNative(bytes, role) {
  demand(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes, 'Native SARIF byte bound exceeded');
  const value = JSON.parse(bytes.toString('utf8'));
  const required = role === 'repository-metadata' ? [categories[0]] : role === 'local-pr' ? categories.slice(1) : role === 'remote-manual' ? categories : [];
  demand(required.length > 0 && value?.version === '2.1.0' && Array.isArray(value.runs) && value.runs.length === required.length, 'Native SARIF schema/role mismatch');
  const found = [], allRules = [];
  let findings = 0;
  for (const run of value.runs) {
    const driver = run.tool?.driver, id = run.automationDetails?.id;
    demand(driver?.name === 'Scorecard' && driver.informationUri === 'https://github.com/ossf/scorecard' && driver.semanticVersion?.replace(/^v/, '') === pin.version, 'Native Scorecard tool/version mismatch');
    const category = typeof id === 'string' ? id.split('/').slice(0, 2).join('/') : '';
    demand(required.includes(category) && id.startsWith(`${category}/${pin.engine}-`) && Array.isArray(driver.rules) && driver.rules.length > 0 && Array.isArray(run.results), 'Native category/engine/rules mismatch');
    demand(!(run.invocations ?? []).some(invocation => invocation.executionSuccessful === false || invocation.toolExecutionNotifications?.some(notification => notification.level === 'error')), 'Native scanner execution error');
    const names = driver.rules.map(rule => rule.name), ids = driver.rules.map(rule => rule.id);
    demand(driver.rules.every(rule => typeof rule.name === 'string' && rule.id === rule.name.replaceAll('-', '') + 'ID') && new Set(ids).size === ids.length, 'Malformed native rule identity');
    if (category === categories[0]) demand(same(names, ['Branch-Protection']) && same(ids, ['BranchProtectionID']), 'Exactly the native Branch-Protection rule required');
    else demand(!names.includes('Branch-Protection'), 'Repository rule cannot masquerade as local code');
    for (const result of run.results) demand(ids.includes(result.ruleId) && typeof result.message?.text === 'string' && result.message.text.length > 0 && result.locations?.some(location => typeof location.physicalLocation?.artifactLocation?.uri === 'string'), 'Malformed native finding');
    found.push(category); allRules.push(...ids); findings += run.results.length;
  }
  demand(same(found.sort(), required) && new Set(allRules).size === allRules.length, 'Duplicate/missing native category or rule');
  return { role, categories: found, findings, emptyFindingsAmbiguity: role === 'repository-metadata' && findings === 0, interpretation: role === 'repository-metadata' ? 'Independent live GLOBAL repository-settings snapshot. No native target-commit or separate unknown-score field. Empty findings may mean satisfied or inconclusive; they do not prove all settings were read. PR SHA is evaluation context only.' : 'Untouched existing native analysis; source checkout/context is recorded separately from SARIF.' };
}
function invocation(record, cli) {
  successful(record); validPin(cli);
  demand(record.bounds.timeoutMs === 240_000 && record.bounds.maxBytes === maximumBytes && record.executable === cli.executable && same(record.args, nativeArguments(cli.policyFile)) && record.binarySha256 === cli.binarySha256 && record.archiveSha256 === pin.archiveSha256 && record.policySha256 === pin.policySha256 && record.engine === pin.engine && record.version === pin.version, 'Native settings invocation pin/argv/bounds mismatch');
}
export function prepareBundle({ context, localOutcome, baseBytes }, operations) {
  const receipt = { schema: 1, context, role: roleFor(context), status: 'started', observations: [], invocations: [], inputs: [], limitation: 'Repository settings are live mutable global metadata. Sampled stable-source fences do not detect a move-and-revert or attest settings/code at an exact Git SHA.' };
  try {
    validateContext(context, context?.sha); validateContext(context, operations.checkout());
    demand(localOutcome === 'success', 'Failed local/manual native analysis cannot be rescued by settings');
    receipt.base = validateNative(baseBytes, receipt.role);
    const baseName = context.eventName === 'pull_request' ? 'local-code.sarif' : 'remote-manual.sarif';
    operations.writeBase(baseName, baseBytes); receipt.inputs.push({ name: baseName, sha256: hash(baseBytes), bytes: baseBytes.length, role: receipt.role }); operations.persist(receipt);
    if (context.eventName === 'pull_request') {
      receipt.pin = operations.acquire(); validPin(receipt.pin); operations.persist(receipt);
      receipt.observations.push(validateSnapshot(operations.observe('before'), 'before', context)); operations.persist(receipt);
      const outcome = operations.scan(receipt.pin);
      receipt.invocations.push(outcome.receipt); operations.persist(receipt);
      invocation(outcome.receipt, receipt.pin);
      demand(hash(outcome.stdout) === outcome.receipt.stdoutSha256 && outcome.stdout.length === outcome.receipt.stdoutBytes, 'Native settings output capture mismatch');
      receipt.metadata = validateNative(outcome.stdout, 'repository-metadata');
      receipt.inputs.push({ name: 'repository-settings.sarif', sha256: hash(outcome.stdout), bytes: outcome.stdout.length, role: 'repository-metadata' });
      receipt.observations.push(validateSnapshot(operations.observe('after'), 'after', context, receipt.observations[0]));
    }
    receipt.status = 'prepared'; operations.persist(receipt); return receipt;
  } catch (error) { receipt.status = 'failed'; receipt.error = error.message; operations.persist(receipt); throw error; }
}
/** Fresh owned directory: regular, single-link native files only; never rewritten. */
export function readNativeDirectory(directory, role) {
  demand(['local-pr', 'remote-manual'].includes(role), 'Known native group role required');
  const directoryStat = lstatSync(directory);
  demand(directoryStat.isDirectory() && !directoryStat.isSymbolicLink(), 'Owned native directory required');
  const names = readdirSync(directory).sort();
  demand(same(names, expectedNames(role)), 'Missing, stale or extra native upload file');
  return names.map(name => {
    const path = join(directory, name), stat = lstatSync(path);
    demand(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size > 0 && stat.size <= maximumBytes, 'Native upload inputs must be bounded regular files without links');
    return { name, bytes: readFileSync(path) };
  });
}
export function verifyBundle({ context, receipt, files }, operations) {
  try {
    validateContext(context, context?.sha); validateContext(context, operations.checkout());
    demand(receipt?.schema === 1 && same(receipt.context, context) && receipt.status === 'prepared' && receipt.role === roleFor(context) && same(files.map(file => file.name).sort(), expectedNames(receipt.role)), 'Incomplete/failed/foreign native bundle');
    demand(same(receipt.inputs.map(input => input.name).sort(), expectedNames(receipt.role)), 'Native input receipt mismatch');
    const allCategories = [];
    for (const file of files) {
      const record = receipt.inputs.find(input => input.name === file.name);
      demand(record && record.sha256 === hash(file.bytes) && record.bytes === file.bytes.length, 'Native bytes changed');
      allCategories.push(...validateNative(file.bytes, record.role).categories);
    }
    demand(same(allCategories.sort(), categories), 'Missing or duplicate analysis role/tool/category');
    if (context.eventName === 'pull_request') {
      demand(receipt.invocations.length === 1 && same(receipt.observations.map(value => value.phase), ['before', 'after']), 'Exactly one settings invocation and both source fences required');
      invocation(receipt.invocations[0], receipt.pin); operations.pinned(receipt.pin);
      for (const value of receipt.observations) validateSnapshot(value, value.phase, context, receipt.observations[0]);
      const settings = files.find(file => file.name === 'repository-settings.sarif');
      demand(hash(settings.bytes) === receipt.invocations[0].stdoutSha256, 'Settings native process/file hash mismatch');
      receipt.observations.push(validateSnapshot(operations.observe('before-upload'), 'before-upload', context, receipt.observations[0]));
    } else demand(receipt.invocations.length === 0 && receipt.observations.length === 0 && !receipt.pin, 'Manual analysis must not duplicate repository metadata');
    validateContext(context, operations.checkout()); receipt.status = 'validated'; operations.persist(receipt); return receipt;
  } catch (error) { if (receipt) { receipt.status = 'failed'; receipt.error = error.message; operations.persist(receipt); } throw error; }
}

function requireFile(path) { const stat = lstatSync(path); demand(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size > 0 && stat.size <= maximumBytes, 'Bounded native source file required'); return readFileSync(path); }
function sourceContext() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  return { eventName: process.env.GITHUB_EVENT_NAME, repository: process.env.GITHUB_REPOSITORY, eventRepository: event.repository?.full_name, repositoryId: event.repository?.id, public: event.repository?.private === false, ref: process.env.GITHUB_REF, sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, ...(process.env.GITHUB_EVENT_NAME === 'pull_request' ? { number: event.number, baseRepository: event.pull_request?.base?.repo?.full_name, baseRepositoryId: event.pull_request?.base?.repo?.id, basePrivate: event.pull_request?.base?.repo?.private } : {}) };
}
function capture(directory, name, executable, args, bounds, env, output) {
  const result = boundedProcess(executable, args, { ...bounds, env });
  result.receipt.stdoutFile = output; result.receipt.stderrFile = join(directory, `${name}.stderr.txt`);
  writeFileSync(output, result.stdout, { flag: 'wx' }); writeFileSync(result.receipt.stderrFile, result.stderr, { flag: 'wx' });
  writeFileSync(join(directory, `${name}.process.json`), JSON.stringify(result.receipt, null, 2), { flag: 'wx' });
  return result;
}
function install(directory) {
  const scratch = mkdtempSync(join(tmpdir(), 'scorecard-settings-pin-'));
  const archive = join(scratch, 'release.tar.gz'), executable = join(scratch, 'scorecard'), policyFile = join(directory, 'policy.yml');
  const download = capture(directory, 'acquisition', 'curl', ['--fail', '--location', '--max-time', '60', '--proto', '=https', '--proto-redir', '=https', pin.archive], { timeoutMs: 65_000, maxBytes: 32 * 1024 * 1024 }, { PATH: process.env.PATH }, archive);
  successful(download.receipt); demand(hash(download.stdout) === pin.archiveSha256, 'Official archive digest mismatch');
  const unpack = capture(directory, 'extraction', 'tar', ['-xzOf', archive, 'scorecard'], { timeoutMs: 30_000, maxBytes: 64 * 1024 * 1024 }, { PATH: process.env.PATH }, executable);
  successful(unpack.receipt); demand(hash(policy) === pin.policySha256, 'Reviewed official policy bytes mismatch');
  chmodSync(executable, 0o700); writeFileSync(policyFile, policy, { flag: 'wx' });
  return { ...pin, executable, policyFile, binarySha256: hash(unpack.stdout) };
}
function pinned(cli) { validPin(cli); demand(hash(readFileSync(cli.executable)) === cli.binarySha256 && hash(readFileSync(cli.policyFile)) === pin.policySha256, 'Pinned executable/policy bytes changed'); }
function operations(directory, token, stage) {
  let reads = 0;
  const checkout = () => { const name = `${stage}-checkout-${++reads}`; const result = capture(directory, name, 'git', ['rev-parse', '--verify', 'HEAD'], { timeoutMs: 10_000, maxBytes: 64 * 1024 }, { PATH: process.env.PATH }, join(directory, `${name}.stdout.txt`)); successful(result.receipt); return result.stdout.toString('utf8').trim(); };
  return {
    checkout, pinned,
    persist: value => writeFileSync(join(directory, 'receipt.json'), JSON.stringify(value, null, 2)),
    writeBase: (name, bytes) => writeFileSync(join(directory, 'native', name), bytes, { flag: 'wx' }),
    acquire: () => install(directory),
    observe: phase => {
      const checkoutSha = checkout();
      const get = (name, endpoint) => { const value = capture(directory, `${phase}-${name}`, 'gh', ['api', '--hostname', 'github.com', '--method', 'GET', endpoint], { timeoutMs: 10_000, maxBytes: 64 * 1024 }, { PATH: process.env.PATH, HOME: process.env.HOME, GH_TOKEN: token, GH_PROMPT_DISABLED: '1' }, join(directory, `${phase}-${name}.json`)); successful(value.receipt); return JSON.parse(value.stdout.toString('utf8')); };
      return { phase, observedAt: new Date().toISOString(), checkoutSha, repository: get('repository', `repos/${repository}`), reference: get('head', `repos/${repository}/git/ref/heads/main`), checkoutAfter: checkout() };
    },
    scan: cli => {
      pinned(cli);
      const output = join(directory, 'native', 'repository-settings.sarif');
      const result = capture(directory, 'settings', cli.executable, nativeArguments(cli.policyFile), { timeoutMs: 240_000, maxBytes: maximumBytes }, { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.RUNNER_TEMP, GITHUB_AUTH_TOKEN: token, ENABLE_SARIF: '1' }, output);
      Object.assign(result.receipt, { binarySha256: cli.binarySha256, archiveSha256: pin.archiveSha256, policySha256: pin.policySha256, engine: pin.engine, version: pin.version, scope: 'live-global-repository-settings' });
      writeFileSync(join(directory, 'settings.process.json'), JSON.stringify(result.receipt, null, 2)); return result;
    },
  };
}
function summary(receipt) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const description = receipt.context.eventName === 'pull_request' ? `Existing local code analysis uses normal PR merge checkout ${receipt.context.sha}. The independent GLOBAL repository-settings snapshot observes remote main ${receipt.observations[0]?.reference.object.sha}. PR SHA is evaluation context, not immutable settings provenance. Empty metadata findings may be satisfied or inconclusive; complete settings coverage is not claimed.` : 'Existing manual remote analysis only; no additional repository-settings CLI invocation.';
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Scorecard source roles\n\n${description}\n\nNative outputs are preserved; GitHub upload processing, server attribution and normal protection evaluation remain separate requirements.\n`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const context = sourceContext(); validateContext(context, context.sha);
    demand(process.platform === 'linux' && process.arch === 'x64' && process.env.GH_TOKEN, 'Linux-amd64 and the default GitHub token required');
    const [command, location, source] = process.argv.slice(2), directory = resolve(location ?? '');
    demand(['prepare', 'verify'].includes(command) && location, 'Expected prepare <owned directory> <native source> or verify <owned directory>');
    if (command === 'prepare') { mkdirSync(directory, { mode: 0o700 }); mkdirSync(join(directory, 'native'), { mode: 0o700 }); }
    const io = operations(directory, process.env.GH_TOKEN, command);
    if (command === 'prepare') { demand(source, 'Existing native source required'); summary(prepareBundle({ context, localOutcome: process.env.LOCAL_SCORECARD_OUTCOME, baseBytes: requireFile(resolve(source)) }, io)); }
    else {
      const receipt = JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8'));
      const files = readNativeDirectory(join(directory, 'native'), roleFor(context));
      summary(verifyBundle({ context, receipt, files }, io));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
