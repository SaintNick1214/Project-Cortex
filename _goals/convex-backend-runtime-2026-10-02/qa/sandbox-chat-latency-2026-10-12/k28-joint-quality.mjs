import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const qa = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qa, '../../../..');
const pinned = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin';
const npm = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
process.env.PATH = pinned + path.delimiter + process.env.PATH;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
assert.equal(process.version, 'v24.15.0');
assert.equal(execFileSync(process.execPath, [npm, '--version'], { encoding: 'utf8' }).trim(), '12.2.0');
assert.equal(path.basename(root), 'backend-runtime-completion');
const files = [...new Set([...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])]
  .filter(name => /^(convex-dev|src|tests|scripts|packages)\//.test(name) && fs.statSync(path.join(root, name)).isFile());
assert.ok(files.length > 0);
const hashes = Object.fromEntries(files.map(name => [name, hash(fs.readFileSync(path.join(root, name)))]));
const save = (name, value) => fs.writeFileSync(path.join(qa, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
save('k28-joint-quality-inputs-v1.json', { productBaseline: '6ce044425b7e52270cdf89cde0ea3a8fbb42f91a', head: git(['rev-parse', 'HEAD'])[0], node: process.version, npm: '12.2.0', hashes });
const results = [];
async function check(name, args) {
  const log = path.join(qa, `k28-joint-${name}-v1.log`), fd = fs.openSync(log, 'wx');
  const startedAt = new Date().toISOString();
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: ['ignore', fd, fd] });
    child.once('error', error => resolve({ exitCode: null, error: error.code ?? error.message }));
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  fs.closeSync(fd);
  const receipt = { check: name, startedAt, endedAt: new Date().toISOString(), ...result, log: path.basename(log), logSha256: hash(fs.readFileSync(log)) };
  save(`k28-joint-${name}-v1-exit.json`, receipt);
  results.push(receipt); console.log(JSON.stringify(receipt)); return receipt;
}
const tsc = path.join(root, 'node_modules/typescript/bin/tsc');
const early = await Promise.all([
  check('root-types', [tsc, '--noEmit', '-p', 'tsconfig.json']),
  check('backend-types', [tsc, '--noEmit', '-p', 'convex-dev/tsconfig.json']),
  check('lint-types', [tsc, '--noEmit', '-p', 'tsconfig.lint.json']),
  check('scoped-lint', [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...files.filter(name => name.endsWith('.ts') && !name.startsWith('packages/cortex-cli/templates/') && !name.startsWith('packages/cortex-templates/payloads/'))]),
]);
if (early.every(result => result.exitCode === 0)) {
  if ((await check('build', [npm, 'run', 'build'])).exitCode === 0) await check('packed-contracts', [path.join(root, 'scripts/verify-public-contracts.mjs')]);
}
const unchanged = Object.entries(hashes).every(([name, digest]) => hash(fs.readFileSync(path.join(root, name))) === digest);
const passed = unchanged && results.length === 6 && results.every(result => result.exitCode === 0);
save('k28-joint-quality-final-v1.json', { endedAt: new Date().toISOString(), unchanged, files: files.length, results, passed, serviceCalls: 0, nativeQualified: false });
if (!passed) process.exitCode = 1;
