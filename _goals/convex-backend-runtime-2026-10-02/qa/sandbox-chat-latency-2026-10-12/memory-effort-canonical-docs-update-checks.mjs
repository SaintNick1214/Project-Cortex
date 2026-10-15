import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const q = path.dirname(fileURLToPath(import.meta.url));
const w = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs';
const cwd = path.join(w, 'docs-site');
const node = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node';
const npm = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const env = { ...process.env, PATH: path.dirname(node) + ':' + process.env.PATH, npm_config_update_notifier: 'false' };
assert.equal(process.versions.node, '24.15.0');
assert.equal(execFileSync(node, [npm, '--version'], { cwd, env, encoding: 'utf8' }).trim(), '12.2.0');
const allowed = ['docs-site/docs/architecture/performance.mdx', 'docs-site/docs/core-features/memory-orchestration.mdx'];
const before = JSON.parse(await fs.readFile(path.join(q, 'memory-effort-canonical-docs-update-before.json'), 'utf8'));
const evidenceNames = ['memory-effort-canonical-actual-outcomes.json', 'memory-effort-canonical-full-chain.md',
  'memory-effort-canonical-full-chain.json', 'memory-effort-canonical-browser-summary.json',
  'memory-effort-canonical-cli-iris-1792059317098.json', 'memory-effort-canonical-native-regression-1792058195328.json',
  'memory-effort-canonical-runtime-readback-1792059539784.json', 'memory-effort-canonical-cleanup-1792059703133.json',
  'memory-effort-canonical-chat-ui.json', 'memory-effort-canonical-chat-install-report.json'];
const inputs = [];
for (const name of evidenceNames) {
  const bytes = await fs.readFile(path.join(q, name));
  inputs.push({ path: path.join(q, name), sha256: sha(bytes), bytes: bytes.length });
}
const targetBeforeChecks = [];
for (const name of allowed) {
  const bytes = await fs.readFile(path.join(w, name));
  targetBeforeChecks.push({ path: name, sha256: sha(bytes), bytes: bytes.length });
}
const results = [];
for (const name of ['typecheck', 'build']) {
  const startedAt = new Date().toISOString(), started = performance.now();
  let stdout = '', stderr = '', timedOut = false;
  const args = [npm, 'run', name];
  const child = spawn(node, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => { timedOut = true; process.kill(-child.pid, 'SIGTERM'); }, 600000);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (exitCode, signal) => resolve({ exitCode, signal })); });
  clearTimeout(timer);
  const logPath = path.join(q, 'memory-effort-canonical-docs-update-' + name + '.log');
  await fs.writeFile(logPath, stdout + '\n' + stderr, { flag: 'wx', mode: 0o600 });
  const receipt = { command: [node, ...args], cwd, node: process.versions.node, npm: '12.2.0',
    startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
    ...result, timedOut, naturalExit: !timedOut && result.signal === null, stdout, stderr, logPath,
    logSha256: sha(stdout + '\n' + stderr), executions: 1 };
  await fs.writeFile(path.join(q, 'memory-effort-canonical-docs-update-' + name + '-execution.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  results.push({ name, ...receipt });
  console.log(JSON.stringify({ name, exitCode: result.exitCode, naturalExit: receipt.naturalExit, elapsedMs: receipt.elapsedMs, logPath }));
}
const changed = [];
for (const file of before.files) {
  const hash = sha(await fs.readFile(path.join(w, file.path)));
  if (hash !== file.sha256) changed.push(file.path);
}
assert.deepEqual(changed.sort(), [...allowed].sort(), 'Only the two authorized dirty documents may change');
for (const file of targetBeforeChecks) assert.equal(sha(await fs.readFile(path.join(w, file.path))), file.sha256, 'Checks must not change an edited MDX source');
const current = execFileSync('git', ['status', '--porcelain=v1', '-z'], { cwd: w }).toString().split('\0').filter(Boolean).map(row => ({ status: row.slice(0, 2), path: row.slice(3) }));
assert.deepEqual(current.map(row => row.path).sort(), before.files.map(row => row.path).sort(), 'Checks must not add dirty tracked/untracked files');
for (const input of inputs) assert.equal(sha(await fs.readFile(input.path)), input.sha256, 'Authoritative input unchanged');
const report = { status: results.every(row => row.exitCode === 0 && row.naturalExit) ? 'DOCS_UPDATED_TYPECHECK_BUILD_PASS' : 'CHECKS_FAILED',
  hostedSourceCommit: '07f669e35cc3221c0411d1e4dfd790e4b95aa54d', docsRepository: w,
  docsHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: w, encoding: 'utf8' }).trim(),
  files: targetBeforeChecks, changedSinceTaskStart: changed, unrelatedDirtyFilesPreserved: before.files.length - changed.length,
  inputs, results: results.map(({ stdout, stderr, ...row }) => row),
  coverage: { browser: '4/6 timings; both Fast misses; 5/5 recall answers correct', cli: '2/2 correct; 0/2 Normal timings',
    chat: 'install/codegen/full types/production build and correct reply/reconnect/phone functional; no numeric SLO; misleading separate title retained',
    native: 'current651 checks with four semantic query embeddings; separate zero-inference 2/4/8/12 topology; strict facts/vectors4/4 in7304.627041ms',
    grammar: 'singleton browser direct route does not qualify new two-candidate grammar or retained late-prefix branch',
    accounting: '66 unique operations/66 first attempts;8.5M UNKNOWN remains charged;tenant mirrors excluded',
    readback: '277 checks/9 selected runs stable;no unmet checks', cleanup: '21 absence checks;controlled SIGTERM launcher130/Chat143',
    historical: '3875 and all earlier scoped observations retained;663 is historical;deferred video and other incomplete coverage remain explicit',
    next: 'First-answer publication source candidate work in progress;no promised latency saving;4/6 milestones and SLO not accepted' },
  publication: 'UNPUBLISHED_UNCOMMITTED', productImplementation: false, additionalReviewLoop: false,
  browserServerOrServiceCalls: 0, gitMutations: 0, finishedAt: new Date().toISOString() };
await fs.writeFile(path.join(q, 'memory-effort-canonical-docs-update.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
await fs.writeFile(path.join(q, 'memory-effort-canonical-docs-update.md'), [
  '# Canonical hosted measurement documentation update', '',
  'Status: ' + report.status + '. Website remains unpublished and uncommitted.', '',
  'Updated only architecture/performance.mdx and core-features/memory-orchestration.mdx in the docs worktree. ' + report.unrelatedDirtyFilesPreserved + ' other dirty documents were preserved by byte hash.', '',
  'Current source: 07f669e35cc3221c0411d1e4dfd790e4b95aa54d. Browser timings: 4/6, both Fast misses; recall correctness5/5. Basic CLI: both correct, both Normal targets missed. Chat functional install/codegen/types/build/reply/reconnect/phone passed; no numeric SLO; misleading separate automatic title retained.', '',
  'Current native qualification651, separate2/4/8/12-hop topology and strict4/4; historical663 remains historical. Singleton direct browser facts do not prove new two-candidate grammar or late-prefix coverage. All earlier hosted failures and deferred video remain explicit.', '',
  'Accounting:66 unique operations/66 first attempts;8,500,000 conservative UNKNOWN units remain charged, tenant mirrors not summed. Readback277 checks across9 selected runs; cleanup21 absence checks; launcher130/Chat143 after controlled SIGTERM.', '',
  'Next first-answer publication source candidate is work in progress with no SLO saving claimed. Goal remains4/6 milestones.', '',
  ...results.map(row => '- ' + row.name + ': exit' + row.exitCode + ', signal ' + row.signal + ', naturalExit=' + row.naturalExit + ', ' + Math.round(row.elapsedMs) + 'ms. ' + row.logPath), '',
  'No browser/server/service calls, product implementation, new review loop, Git mutation or publication.', '',
].join('\n'), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: report.status, changed: report.changedSinceTaskStart, unrelatedDirtyFilesPreserved: report.unrelatedDirtyFilesPreserved,
  report: path.join(q, 'memory-effort-canonical-docs-update.json') }));
process.exitCode = report.status === 'DOCS_UPDATED_TYPECHECK_BUILD_PASS' ? 0 : 1;
