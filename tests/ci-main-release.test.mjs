import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { checkMainReleaseTree, excludedFromMain, gitStreamLimits, parseReleasePolicy, prepareMainRelease, readNulCommand } from '../scripts/ci-main-release.mjs';
import { changedCiPaths } from '../scripts/ci-contract.mjs';

const policySource = readFileSync('.main-release-policy.json', 'utf8');
const policy = parseReleasePolicy(policySource);
const executable = resolve('scripts/ci-main-release.mjs');
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'cortex-main-policy-'));
  const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8' });
  const put = (path, content = 'fixture\n') => { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), content); };
  const commit = message => { git('add', '--all'); git('commit', '--quiet', '-m', message); return git('rev-parse', 'HEAD').trim(); };
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.name', 'CI fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'commit.gpgsign', 'false');
  put('.main-release-policy.json', policySource); put('scripts/ci-main-release.mjs', '// main policy helper fixture\n'); put('src/common.ts');
  commit('base');
  return { cwd, git, put, commit, close: () => rmSync(cwd, { recursive: true, force: true }) };
}
const childRecords = (source, options) => readNulCommand(process.execPath, ['-e', source], options);

test('versioned policy protects exactly root internal entries and one workflow; nested product names remain permitted', () => {
  for (const path of ['_goals/receipt.json', '_research/notes.md', 'work/file', '.agents/role.md', '_goals', 'AGENTS.md', '.github/workflows/task04-c8-native-infrastructure.yml']) assert.equal(excludedFromMain(path, policy), true, path);
  for (const path of ['src/index.ts', 'packages/tool/AGENTS.md', 'packages/tool/_goals/example.md', 'packages/tool/_research/example.md', 'packages/tool/work/example.md', 'packages/tool/.agents/example.md', '_goals-product/file', '.github/workflows/task04-c8-native-infrastructure.yml.bak', '.github/workflows/pr-checks.yml']) assert.equal(excludedFromMain(path, policy), false, path);
  for (const path of ['', '/tmp/file', '../elsewhere', 'src/../file', 'src//file', 'src/\0file']) assert.throws(() => excludedFromMain(path, policy), /Invalid repository path/);
  assert.equal(Object.isFrozen(policy), true);
});

test('missing, empty, weakened, unknown-version and malformed policy cannot remove the required boundary', () => {
  for (const source of ['', '{', '{}', 'null', '[]', JSON.stringify({ ...policy, version: 2 }), JSON.stringify({ ...policy, excludedRootEntries: [] }), JSON.stringify({ ...policy, excludedRootEntries: policy.excludedRootEntries.slice(1) }), JSON.stringify({ ...policy, excludedFiles: ['AGENTS.md'] }), JSON.stringify({ ...policy, preserveFromMain: [] }), JSON.stringify({ ...policy, excludedFiles: [...policy.excludedFiles, 'src'] }), JSON.stringify({ ...policy, extra: true })]) assert.throws(() => parseReleasePolicy(source), /policy/i);
});

test('complete committed allowed trees pass with nested internal-looking names and dirty forbidden local files', async () => {
  const f = fixture();
  try {
    for (const path of ['packages/example/AGENTS.md', 'packages/example/.agents/role.md', 'packages/example/_goals/usage.md', 'packages/example/_research/usage.md', 'packages/example/work/usage.md', 'src/with space\nand-é🧠.ts']) f.put(path);
    const sha = f.commit('allowed product tree');
    f.put('_goals/untracked-local.md');
    const observed = await checkMainReleaseTree(sha, { cwd: f.cwd });
    assert.equal(observed.tree, f.git('rev-parse', `${sha}^{tree}`).trim());
    assert.equal(observed.paths, 9); assert.equal(observed.policyVersion, 1);
    assert.equal(f.git('status', '--porcelain').includes('_goals/'), true);
  } finally { f.close(); }
});

for (const forbidden of ['_goals/unchanged.md', '_research/unchanged.md', 'work/unchanged.md', '.agents/unchanged.md', 'AGENTS.md', '.github/workflows/task04-c8-native-infrastructure.yml']) test(`full committed tree rejects unchanged ${forbidden}, even outside sparse checkout`, async () => {
  const f = fixture();
  try {
    f.put(forbidden); const base = f.commit('internal path');
    f.put('src/product.ts'); const head = f.commit('only product changed');
    assert.deepEqual(await changedCiPaths(base, head, f.cwd), ['src/product.ts']);
    f.git('sparse-checkout', 'set', '--no-cone', '/src/', '/.main-release-policy.json', '/scripts/');
    assert.equal(existsSync(join(f.cwd, forbidden)), false);
    await assert.rejects(checkMainReleaseTree(head, { cwd: f.cwd }), /Forbidden main tree paths/);
    const run = spawnSync(process.execPath, [executable, 'check', '--tree', head], { cwd: f.cwd, encoding: 'utf8' });
    assert.equal(run.status, 1); assert.match(run.stderr, /Forbidden main tree paths/);
  } finally { f.close(); }
});

for (const kind of ['missing', 'malformed', 'empty']) test(`committed ${kind} policy refuses despite a valid dirty working copy`, async () => {
  const f = fixture();
  try {
    if (kind === 'missing') f.git('rm', '.main-release-policy.json');
    else f.put('.main-release-policy.json', kind === 'empty' ? '{}' : '{');
    const sha = f.commit('invalid committed policy');
    f.put('.main-release-policy.json', policySource);
    await assert.rejects(checkMainReleaseTree(sha, { cwd: f.cwd }), /policy unavailable or malformed/);
  } finally { f.close(); }
});

test('change lists preserve deleted/added whitespace, newline and Unicode endpoints and ignore staged/untracked files', async () => {
  const f = fixture();
  try {
    const removed = '\uFEFFsrc/old space\né🧠.ts', added = '\uFEFFpackages/new space\né🧠.ts';
    f.put(removed); const base = f.commit('old endpoint');
    f.git('rm', '--', removed); f.put(added); const head = f.commit('new endpoint');
    f.put('src/staged.ts'); f.git('add', 'src/staged.ts'); f.put('src/untracked.ts');
    assert.deepEqual(new Set(await changedCiPaths(base, head, f.cwd)), new Set([removed, added]));
    const treePaths = await changedCiPaths('0'.repeat(40), head, f.cwd);
    assert.equal(treePaths.includes(added), true); assert.equal(treePaths.includes('src/staged.ts'), false); assert.equal(treePaths.includes('src/untracked.ts'), false);
  } finally { f.close(); }
});

test('stream parsing preserves leading BOMs and multibyte codepoints split at every byte, including a separate NUL chunk', async () => {
  const expected = ['\uFEFFsrc/first.ts', 'src/é🧠\n space.ts', '\uFEFFsrc/last.ts'];
  const source = `const data=Buffer.from(${JSON.stringify(expected.join('\0') + '\0')}); let i=0; function next(){ if(i<data.length){ process.stdout.write(data.subarray(i,i+1)); i++; setTimeout(next,1); } } next();`;
  assert.deepEqual((await childRecords(source)).records, expected);
  assert.deepEqual((await childRecords('')).records, []);
  const exact = await childRecords("process.stdout.write('abc\\0')", { limits: { maxBytes: 4, maxRecords: 1, maxRecordBytes: 3 } });
  assert.deepEqual(exact.records, ['abc']);
});

for (const [name, source, limits, message] of [
  ['bytes', "process.stdout.write('abcd\\0'); setInterval(()=>{},1000)", { maxBytes: 4 }, /byte limit/],
  ['paths', "process.stdout.write('a\\0b\\0'); setInterval(()=>{},1000)", { maxRecords: 1 }, /path limit/],
  ['record', "process.stdout.write('abcd\\0'); setInterval(()=>{},1000)", { maxRecordBytes: 3 }, /record byte limit/],
  ['deadline', 'setInterval(()=>{},1000)', { timeoutMs: 25 }, /deadline exceeded/],
]) test(`finite ${name} exhaustion rejects and terminates the child instead of returning truncated paths`, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cortex-stream-limit-')), pid = join(directory, 'pid');
  try {
    const writePid = `require('node:fs').writeFileSync(${JSON.stringify(pid)},String(process.pid));`;
    await assert.rejects(childRecords(writePid + source, { limits }), message);
    // A startup deadline can kill Node before its first statement; otherwise close
    // must have reaped the child before the rejection is observed.
    if (existsSync(pid)) assert.throws(() => process.kill(Number(readFileSync(pid, 'utf8')), 0), { code: 'ESRCH' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Git failures, malformed streams, unknown committed objects and invalid finite bounds refuse completely', async () => {
  await assert.rejects(childRecords("process.stdout.write('partial\\0'); process.stderr.write('fixture git failure'); process.exitCode=7"), /failed \(7\).*fixture git failure/);
  await assert.rejects(childRecords("process.stdout.write('unterminated')"), /unterminated NUL/);
  await assert.rejects(childRecords('process.stdout.write(Buffer.from([0xff,0]))'), /encoded data|encoding/i);
  await assert.rejects(readNulCommand('/missing/cortex-git', []), /ENOENT/);
  for (const value of [0, -1, Infinity, NaN]) assert.throws(() => childRecords('', { limits: { timeoutMs: value } }), /Invalid stream limit/);
  assert.ok(gitStreamLimits.maxBytes > 32 * 1024 * 1024);
  const f = fixture();
  try {
    await assert.rejects(checkMainReleaseTree('f'.repeat(40), { cwd: f.cwd }), /failed/);
    await assert.rejects(changedCiPaths('f'.repeat(40), f.git('rev-parse', 'HEAD').trim(), f.cwd), /failed/);
    await assert.rejects(checkMainReleaseTree('--help', { cwd: f.cwd }), /committed tree reference/);
    await assert.rejects(changedCiPaths('0'.repeat(40), f.git('rev-parse', 'HEAD').trim(), f.cwd, { limits: { maxBytes: 1 } }), /byte limit/);
  } finally { f.close(); }
});

function releaseFixture({ internalConflict = false, productConflict = false } = {}) {
  const f = fixture();
  if (internalConflict) { f.put('_goals/record.md', 'base\n'); f.commit('internal base'); }
  f.git('branch', 'dev');
  f.put('src/main-only.ts', 'export const mainOnly = true;\n');
  if (internalConflict) f.put('_goals/record.md', 'main internal\n');
  if (productConflict) f.put('src/common.ts', 'main conflict\n');
  const main = f.commit('main product change');
  f.git('switch', '--quiet', 'dev');
  f.put('src/dev-only.ts', 'export const devOnly = true;\n');
  f.put('_research/dev-record.md'); f.put('.agents/dev-role.md'); f.put('work/dev-receipt.md'); f.put('AGENTS.md'); f.put('.github/workflows/task04-c8-native-infrastructure.yml');
  if (internalConflict) f.put('_goals/record.md', 'dev internal\n');
  if (productConflict) f.put('src/common.ts', 'dev conflict\n');
  f.git('rm', 'scripts/ci-main-release.mjs');
  const dev = f.commit('dev product and internal change');
  f.git('switch', '--quiet', 'main');
  return { ...f, main, dev };
}

for (const internalConflict of [false, true]) test(`preparation retains genuine main/dev merge contents, two parents, guards and dirty worktrees (${internalConflict ? 'excluded conflict' : 'clean merge'})`, async () => {
  const f = releaseFixture({ internalConflict });
  const linked = join(f.cwd, 'linked-worktree');
  try {
    f.git('worktree', 'add', '--quiet', '--detach', linked, f.dev);
    f.put('src/common.ts', 'dirty unstaged\n'); f.put('src/staged.ts', 'dirty staged\n'); f.git('add', 'src/staged.ts'); f.put('untracked.txt', 'untracked\n');
    writeFileSync(join(linked, 'src/common.ts'), 'linked dirty\n'); writeFileSync(join(linked, 'untracked.txt'), 'linked untracked\n');
    const beforeStatus = f.git('status', '--porcelain=v1', '-z');
    const beforeIndex = readFileSync(join(f.cwd, '.git/index'));
    const linkedBefore = execFileSync('git', ['status', '--porcelain=v1', '-z'], { cwd: linked, encoding: 'utf8' });
    const linkedIndexPath = resolve(linked, execFileSync('git', ['rev-parse', '--git-path', 'index'], { cwd: linked, encoding: 'utf8' }).trim());
    const beforeLinkedIndex = readFileSync(linkedIndexPath);
    const result = await prepareMainRelease({ main: 'main', dev: 'dev', branch: 'release/reviewable', cwd: f.cwd });
    assert.equal(result.commit, f.git('rev-parse', 'release/reviewable').trim());
    assert.deepEqual(result.parents, [f.main, f.dev]);
    assert.deepEqual(f.git('rev-list', '--parents', '-n', '1', result.commit).trim().split(' '), [result.commit, f.main, f.dev]);
    assert.equal(f.git('show', `${result.commit}:src/main-only.ts`), 'export const mainOnly = true;\n');
    assert.equal(f.git('show', `${result.commit}:src/dev-only.ts`), 'export const devOnly = true;\n');
    assert.equal(f.git('show', `${result.commit}:src/common.ts`), 'fixture\n');
    assert.equal(f.git('show', `${result.commit}:scripts/ci-main-release.mjs`), '// main policy helper fixture\n');
    assert.equal(f.git('show', `${result.commit}:.main-release-policy.json`), policySource);
    assert.equal((await checkMainReleaseTree(result.commit, { cwd: f.cwd })).tree, result.tree);
    assert.equal(result.omittedPaths >= 5, true);
    assert.equal(result.omittedConflicts.length > 0, internalConflict);
    assert.equal(f.git('rev-parse', 'main').trim(), f.main); assert.equal(f.git('rev-parse', 'dev').trim(), f.dev);
    assert.deepEqual(readFileSync(join(f.cwd, '.git/index')), beforeIndex);
    assert.deepEqual(readFileSync(linkedIndexPath), beforeLinkedIndex);
    assert.equal(f.git('status', '--porcelain=v1', '-z'), beforeStatus);
    assert.equal(readFileSync(join(f.cwd, 'src/common.ts'), 'utf8'), 'dirty unstaged\n');
    assert.equal(execFileSync('git', ['status', '--porcelain=v1', '-z'], { cwd: linked, encoding: 'utf8' }), linkedBefore);
    assert.equal(readFileSync(join(linked, 'src/common.ts'), 'utf8'), 'linked dirty\n');
    const message = f.git('show', '-s', '--format=%B', result.commit);
    assert.match(message, new RegExp(`Main: ${f.main}`)); assert.match(message, new RegExp(`Dev: ${f.dev}`)); assert.doesNotMatch(message, /\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]|skip-checks\s*:/i);
  } finally { f.close(); }
});

test('product conflicts refuse before a destination ref exists and preserve source refs/index/worktree', async () => {
  const f = releaseFixture({ internalConflict: true, productConflict: true });
  try {
    f.put('src/common.ts', 'dirty protected\n');
    const index = readFileSync(join(f.cwd, '.git/index'));
    await assert.rejects(prepareMainRelease({ main: 'main', dev: 'dev', branch: 'release/conflict', cwd: f.cwd }), /Product merge conflict/);
    assert.equal(spawnSync('git', ['show-ref', '--verify', '--quiet', 'refs/heads/release/conflict'], { cwd: f.cwd }).status, 1);
    assert.equal(f.git('rev-parse', 'main').trim(), f.main); assert.equal(f.git('rev-parse', 'dev').trim(), f.dev);
    assert.deepEqual(readFileSync(join(f.cwd, '.git/index')), index); assert.equal(readFileSync(join(f.cwd, 'src/common.ts'), 'utf8'), 'dirty protected\n');
  } finally { f.close(); }
});

test('unsafe, protected, absent and existing destinations and unknown source commits refuse without moving refs', async () => {
  const f = releaseFixture();
  try {
    for (const branch of [undefined, '', 'main', 'dev', '--help', '../escape', 'release/../escape', 'refs/heads/escape', 'release with spaces', 'release..unsafe', 'main.lock']) await assert.rejects(prepareMainRelease({ main: 'main', dev: 'dev', branch, cwd: f.cwd }), /branch|required|failed/);
    f.git('branch', 'release/existing', f.main);
    await assert.rejects(prepareMainRelease({ main: 'main', dev: 'dev', branch: 'release/existing', cwd: f.cwd }), /already exists/);
    await assert.rejects(prepareMainRelease({ main: 'main', dev: 'f'.repeat(40), branch: 'release/unknown', cwd: f.cwd }), /failed/);
    await assert.rejects(prepareMainRelease({ main: '--help', dev: 'dev', branch: 'release/unsafe', cwd: f.cwd }), /Safe main\/dev/);
    await assert.rejects(prepareMainRelease({ main: 'main', dev: 'main', branch: 'release/same', cwd: f.cwd }), /Distinct main\/dev/);
    assert.equal(f.git('rev-parse', 'release/existing').trim(), f.main);
    assert.equal(f.git('rev-parse', 'main').trim(), f.main); assert.equal(f.git('rev-parse', 'dev').trim(), f.dev);
    assert.deepEqual(f.git('for-each-ref', '--format=%(refname)', 'refs/heads/release/').trim().split('\n'), ['refs/heads/release/existing']);
  } finally { f.close(); }
});

test('source refs moving between raw object sampling and commit peeling refuse stale parents', async () => {
  const f = releaseFixture();
  const originalPath = process.env.PATH;
  try {
    const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
    const bin = join(f.cwd, 'bin'); mkdirSync(bin);
    const marker = join(f.cwd, 'pin-window-moved');
    // Intercept the first mutable main object read: the canonical raw ref in the
    // fixed implementation, or the old mutable peel in the regression version.
    // Moving after that command prints its result reproduces the sampling race.
    const wrapper = `#!/usr/bin/env node\nconst {spawnSync}=require('node:child_process'); const {existsSync,writeFileSync}=require('node:fs'); const git=${JSON.stringify(realGit)}; const marker=${JSON.stringify(marker)}; const args=process.argv.slice(2); const sample=args[0]==='rev-parse' && !args.includes('--symbolic-full-name') && ['refs/heads/main','main^{commit}'].includes(args.at(-1)) && !existsSync(marker); const result=spawnSync(git,args,{stdio:'inherit'}); if(result.status===0 && sample){ writeFileSync(marker,'sampled'); const move=spawnSync(git,['update-ref','refs/heads/main',${JSON.stringify(f.dev)}],{stdio:'inherit'}); if(move.status!==0)process.exit(91); } process.exit(result.status??92);\n`;
    writeFileSync(join(bin, 'git'), wrapper); chmodSync(join(bin, 'git'), 0o755);
    process.env.PATH = `${bin}:${originalPath}`;
    await assert.rejects(prepareMainRelease({ main: 'main', dev: 'dev', branch: 'release/pin-window', cwd: f.cwd }), /update-ref failed/);
    assert.equal(readFileSync(marker, 'utf8'), 'sampled');
    assert.equal(spawnSync(realGit, ['show-ref', '--verify', '--quiet', 'refs/heads/release/pin-window'], { cwd: f.cwd }).status, 1);
    assert.equal(execFileSync(realGit, ['rev-parse', 'main'], { cwd: f.cwd, encoding: 'utf8' }).trim(), f.dev);
    assert.equal(execFileSync(realGit, ['rev-parse', 'dev'], { cwd: f.cwd, encoding: 'utf8' }).trim(), f.dev);
  } finally { process.env.PATH = originalPath; f.close(); }
});

test('source refs moving just before the atomic destination update refuse stale output', async () => {
  const f = releaseFixture();
  const originalPath = process.env.PATH;
  try {
    const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
    const bin = join(f.cwd, 'bin'); mkdirSync(bin);
    const wrapper = `#!/usr/bin/env node\nconst {spawnSync}=require('node:child_process'); const git=${JSON.stringify(realGit)}; const args=process.argv.slice(2); if(args[0]==='update-ref' && args[1]==='--stdin'){ const move=spawnSync(git,['update-ref','refs/heads/main',${JSON.stringify(f.dev)}],{stdio:'inherit'}); if(move.status!==0)process.exit(91); } const result=spawnSync(git,args,{stdio:'inherit'}); process.exit(result.status??92);\n`;
    writeFileSync(join(bin, 'git'), wrapper); chmodSync(join(bin, 'git'), 0o755);
    process.env.PATH = `${bin}:${originalPath}`;
    await assert.rejects(prepareMainRelease({ main: 'main', dev: 'dev', branch: 'release/stale', cwd: f.cwd }), /update-ref failed/);
    assert.equal(spawnSync(realGit, ['show-ref', '--verify', '--quiet', 'refs/heads/release/stale'], { cwd: f.cwd }).status, 1);
    assert.equal(execFileSync(realGit, ['rev-parse', 'main'], { cwd: f.cwd, encoding: 'utf8' }).trim(), f.dev);
  } finally { process.env.PATH = originalPath; f.close(); }
});

test('CLI creates only a new local review branch using exact committed sources and rejects malformed arguments', () => {
  const f = releaseFixture();
  try {
    const run = spawnSync(process.execPath, [executable, 'prepare', '--main', 'main', '--dev', 'dev', '--branch', 'release/cli'], { cwd: f.cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout); assert.deepEqual(result.parents, [f.main, f.dev]);
    assert.equal(f.git('rev-parse', 'main').trim(), f.main); assert.equal(f.git('rev-parse', 'dev').trim(), f.dev);
    const check = spawnSync(process.execPath, [executable, 'check', '--tree', result.commit], { cwd: f.cwd, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr); assert.equal(JSON.parse(check.stdout).tree, result.tree);
    for (const args of [[], ['unknown'], ['prepare', '--branch'], ['prepare', '--branch', 'release/valid', '--branch', 'release/duplicate'], ['check', '--unknown', 'HEAD']]) {
      const invalid = spawnSync(process.execPath, [executable, ...args], { cwd: f.cwd, encoding: 'utf8' });
      assert.equal(invalid.status, 1); assert.match(invalid.stderr, /Usage|Invalid/);
    }
  } finally { f.close(); }
});

test('normal main PR/push workflow checks the complete committed tree before selection and executes these regressions', () => {
  const workflow = yaml.load(readFileSync('.github/workflows/pr-checks.yml', 'utf8'));
  const steps = workflow.jobs['detect-changes'].steps;
  const guard = steps.findIndex(step => step.name === 'Enforce complete committed main release contents');
  const selection = steps.findIndex(step => step.id === 'select');
  assert.ok(guard >= 0 && guard < selection);
  assert.equal(steps[guard].run, 'node scripts/ci-main-release.mjs check --tree "$MAIN_RELEASE_TREE"');
  assert.equal(steps[guard].if, "(github.event_name == 'pull_request' && github.base_ref == 'main') || (github.event_name == 'push' && github.ref == 'refs/heads/main')");
  assert.equal(steps[guard].env.MAIN_RELEASE_TREE, '${{ github.event.pull_request.head.sha || github.sha }}');
  const regressions = workflow.jobs['public-contracts'].steps.find(step => step.name === 'CI, security and delivery readiness regressions').run;
  assert.match(regressions, /node --test .*tests\/ci-main-release\.test\.mjs/);
  assert.ok(workflow.jobs['all-checks-passed'].needs.includes('detect-changes'));
  assert.ok(workflow.jobs['all-checks-passed'].needs.includes('public-contracts'));
});
