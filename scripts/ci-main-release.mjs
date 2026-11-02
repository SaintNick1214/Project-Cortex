/** Main's committed-tree boundary and local, reviewable two-parent release preparation. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const policyPath = '.main-release-policy.json';
const oidPattern = /^[a-f0-9]{40,64}$/;
const safePath = path => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\0') && !path.split('/').some(part => !part || part === '.' || part === '..');
export const gitStreamLimits = Object.freeze({ maxBytes: 256 * 1024 * 1024, maxRecords: 2_000_000, maxRecordBytes: 1024 * 1024, timeoutMs: 60_000 });

/** Read NUL records incrementally. Never return a partial list after any limit or Git error. */
export function readNulCommand(command, args, { cwd = process.cwd(), limits = {}, allowedExitCodes = [0], env = process.env } = {}) {
  const bounds = { ...gitStreamLimits, ...limits };
  for (const [name, value] of Object.entries(bounds)) if (!(name in gitStreamLimits) || !Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid stream limit: ${name}`);
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const records = [], decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    let bytes = 0, recordBytes = 0, fragments = [], failure, stderr = '';
    const fail = error => { failure ??= error; child.kill('SIGKILL'); };
    const timer = setTimeout(() => fail(new Error(`Git stream deadline exceeded (${bounds.timeoutMs}ms)`)), bounds.timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stderr.on('data', chunk => { if (stderr.length < 16_384) stderr += chunk.toString('utf8').slice(0, 16_384 - stderr.length); });
    child.stdout.on('data', chunk => {
      if (failure) return;
      try {
        bytes += chunk.length;
        if (bytes > bounds.maxBytes) throw new Error(`Git stream byte limit exceeded (${bounds.maxBytes})`);
        let start = 0;
        while (start < chunk.length) {
          const end = chunk.indexOf(0, start), stop = end < 0 ? chunk.length : end;
          const part = chunk.subarray(start, stop);
          recordBytes += part.length;
          if (recordBytes > bounds.maxRecordBytes) throw new Error(`Git stream record byte limit exceeded (${bounds.maxRecordBytes})`);
          if (part.length) fragments.push(part);
          if (end < 0) break;
          if (records.length >= bounds.maxRecords) throw new Error(`Git stream path limit exceeded (${bounds.maxRecords})`);
          records.push(decoder.decode(Buffer.concat(fragments, recordBytes)));
          fragments = []; recordBytes = 0; start = end + 1;
        }
      } catch (error) { fail(error); }
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (!allowedExitCodes.includes(code)) reject(new Error(`Git command failed (${code ?? signal}): ${stderr.trim()}`));
      else if (recordBytes) reject(new Error('Git returned an unterminated NUL record'));
      else accept({ records, code });
    });
  });
}

const gitRecords = (args, options) => readNulCommand('git', args, options);
function gitText(args, { cwd = process.cwd(), env = process.env, input, allowedExitCodes = [0] } = {}) {
  const result = spawnSync('git', args, { cwd, env, input, encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  if (!allowedExitCodes.includes(result.status)) throw new Error(`git ${args[0]} failed (${result.status ?? result.signal}): ${result.stderr.trim()}`);
  return result.stdout;
}

/** Version 1 deliberately cannot expand omissions to arbitrary product paths. */
export function parseReleasePolicy(source) {
  let policy;
  try { policy = JSON.parse(source); } catch { throw new Error('Missing or malformed main release policy JSON'); }
  const expected = {
    excludedRootEntries: ['_goals', '_research', 'work', '.agents'],
    excludedFiles: ['AGENTS.md', '.github/workflows/task04-c8-native-infrastructure.yml'],
    preserveFromMain: [policyPath, 'scripts/ci-main-release.mjs'],
  };
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) || policy.version !== 1 || Object.keys(policy).sort().join(',') !== ['version', ...Object.keys(expected)].sort().join(',')) throw new Error('Malformed main release policy schema');
  for (const [key, required] of Object.entries(expected)) {
    if (!Array.isArray(policy[key]) || policy[key].length !== required.length || new Set(policy[key]).size !== required.length || !required.every(path => policy[key].includes(path))) throw new Error(`Malformed main release policy: ${key} must retain the complete version 1 boundary`);
    Object.freeze(policy[key]);
  }
  return Object.freeze(policy);
}

export function excludedFromMain(path, policy) {
  if (!safePath(path)) throw new Error(`Invalid repository path: ${JSON.stringify(path)}`);
  return policy.excludedRootEntries.some(root => path === root || path.startsWith(`${root}/`)) || policy.excludedFiles.includes(path);
}

function exactTree(ref, cwd) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\s\0]/.test(ref)) throw new Error('A committed tree reference is required');
  const tree = gitText(['rev-parse', '--verify', '--end-of-options', `${ref}^{tree}`], { cwd }).trim();
  if (!oidPattern.test(tree)) throw new Error('Git did not resolve an exact tree');
  return tree;
}
function committedPolicy(tree, cwd) {
  try { return parseReleasePolicy(gitText(['show', `${tree}:${policyPath}`], { cwd })); }
  catch (error) { throw new Error(`Committed main release policy unavailable or malformed: ${error.message}`); }
}

/** ls-tree inspects every committed entry, even outside a sparse checkout or PR diff. */
export async function checkMainReleaseTree(ref = 'HEAD', { cwd = process.cwd(), limits } = {}) {
  const tree = exactTree(ref, cwd), policy = committedPolicy(tree, cwd);
  const { records: paths } = await gitRecords(['ls-tree', '--full-tree', '-r', '--name-only', '-z', tree], { cwd, limits });
  const forbidden = paths.filter(path => excludedFromMain(path, policy));
  if (forbidden.length) throw new Error(`Forbidden main tree paths (${forbidden.length}): ${forbidden.slice(0, 20).map(path => JSON.stringify(path)).join(', ')}`);
  return { tree, paths: paths.length, policyVersion: policy.version };
}

function pinCommit(ref, cwd) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\s\0~^:{}?*\[\\]/.test(ref)) throw new Error('Safe main/dev commit references are required');
  if (!oidPattern.test(ref)) gitText(['check-ref-format', '--allow-onelevel', ref], { cwd });
  const fullRef = oidPattern.test(ref) ? undefined : gitText(['rev-parse', '--symbolic-full-name', '--verify', '--end-of-options', ref], { cwd }).trim();
  if (fullRef && !fullRef.startsWith('refs/')) throw new Error('Source must name a branch, tag, remote ref or exact commit');
  // Sample the explicit mutable ref once, then peel only that immutable object.
  // The final ref transaction verifies this same raw OID, including tag objects.
  const oid = gitText(['rev-parse', '--verify', '--end-of-options', fullRef ?? ref], { cwd }).trim();
  if (!oidPattern.test(oid)) throw new Error('Git did not resolve an exact source object');
  const sha = gitText(['rev-parse', '--verify', '--end-of-options', `${oid}^{commit}`], { cwd }).trim();
  if (!oidPattern.test(sha)) throw new Error('Git did not resolve an exact commit');
  return { ref, fullRef, sha, oid };
}

/** Only committed objects are read; every existing worktree and index remains untouched. */
export async function prepareMainRelease({ main = 'origin/main', dev = 'origin/dev', branch, cwd = process.cwd() } = {}) {
  if (typeof branch !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.startsWith('refs/') || ['main', 'dev'].includes(branch)) throw new Error('A safe new local release branch (other than main/dev) is required');
  cwd = gitText(['rev-parse', '--show-toplevel'], { cwd }).trim();
  const destination = `refs/heads/${branch}`;
  gitText(['check-ref-format', destination], { cwd });
  const existing = spawnSync('git', ['show-ref', '--verify', '--quiet', destination], { cwd, timeout: 30_000, killSignal: 'SIGKILL' });
  if (existing.error) throw existing.error;
  if (existing.status !== 1) throw new Error('Destination branch already exists or cannot be inspected');
  const mainPin = pinCommit(main, cwd), devPin = pinCommit(dev, cwd);
  if (mainPin.sha === devPin.sha || [mainPin.fullRef, devPin.fullRef].includes(destination)) throw new Error('Distinct main/dev commits and a separate release branch are required');
  const mainTree = exactTree(mainPin.sha, cwd), policy = committedPolicy(mainTree, cwd);
  const merge = await gitRecords(['merge-tree', '--write-tree', '--name-only', '-z', '--no-messages', mainPin.sha, devPin.sha], { cwd, allowedExitCodes: [0, 1] });
  const [mergedTree, ...conflictRecords] = merge.records;
  if (!oidPattern.test(mergedTree ?? '')) throw new Error('Git did not return a merge tree');
  const conflicts = conflictRecords.filter(Boolean);
  if ((merge.code === 1 && !conflicts.length) || conflicts.some(path => !excludedFromMain(path, policy))) throw new Error(`Product merge conflict; resolve on dev before release: ${conflicts.map(path => JSON.stringify(path)).join(', ')}`);
  const { records: mergedPaths } = await gitRecords(['ls-tree', '--full-tree', '-r', '--name-only', '-z', mergedTree], { cwd });
  const omitted = mergedPaths.filter(path => excludedFromMain(path, policy));
  const directory = mkdtempSync(join(tmpdir(), 'cortex-main-release-'));
  let tree;
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(directory, 'index') };
    gitText(['read-tree', mergedTree], { cwd, env });
    if (omitted.length) gitText(['update-index', '--force-remove', '-z', '--stdin'], { cwd, env, input: omitted.join('\0') + '\0' });
    // These two files define this boundary; dev may not delete/replace main's guard.
    const preserved = await gitRecords(['--literal-pathspecs', 'ls-tree', '--full-tree', '-r', '-z', mainTree, '--', ...policy.preserveFromMain], { cwd });
    if (preserved.records.length !== policy.preserveFromMain.length || preserved.records.some(record => !/^100(?:644|755) blob [a-f0-9]{40,64}\t/.test(record))) throw new Error('Main is missing a canonical release policy/helper file');
    gitText(['update-index', '-z', '--index-info'], { cwd, env, input: preserved.records.map(record => record.replace(' blob ', ' ')).join('\0') + '\0' });
    tree = gitText(['write-tree'], { cwd, env }).trim();
  } finally { rmSync(directory, { recursive: true, force: true }); }
  await checkMainReleaseTree(tree, { cwd });
  const message = `Prepare main release from committed dev\n\nMain: ${mainPin.sha}\nDev: ${devPin.sha}\nPolicy: version ${policy.version}\n`;
  const commit = gitText(['commit-tree', tree, '-p', mainPin.sha, '-p', devPin.sha], { cwd, input: message }).trim();
  if (!oidPattern.test(commit)) throw new Error('Git did not create an exact release commit');
  // Lock and verify source refs in the same transaction that creates the new ref.
  // A concurrent fetch/commit therefore refuses instead of publishing stale pins.
  const sources = new Map([mainPin, devPin].filter(pin => pin.fullRef).map(pin => [pin.fullRef, pin.oid]));
  const transaction = ['start', ...[...sources].map(([ref, sha]) => `verify ${ref} ${sha}`), `create ${destination} ${commit}`, 'prepare', 'commit', ''].join('\n');
  gitText(['update-ref', '--stdin'], { cwd, input: transaction });
  const actual = gitText(['rev-parse', '--verify', destination], { cwd }).trim();
  if (actual !== commit) throw new Error('Release ref readback did not match the prepared commit');
  return { branch, ref: destination, commit, tree, parents: [mainPin.sha, devPin.sha], sources: { main: mainPin, dev: devPin }, omittedPaths: omitted.length, omittedConflicts: conflicts, policyVersion: policy.version };
}

function options(args, allowed) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!allowed.includes(flag) || !args[index + 1] || args[index + 1].startsWith('--') || Object.hasOwn(result, flag.slice(2))) throw new Error(`Invalid or missing option: ${flag}`);
    result[flag.slice(2)] = args[index + 1];
  }
  return result;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const command = process.argv[2];
    if (command === 'check') console.log(JSON.stringify(await checkMainReleaseTree(options(process.argv.slice(3), ['--tree']).tree), null, 2));
    else if (command === 'prepare') console.log(JSON.stringify(await prepareMainRelease(options(process.argv.slice(3), ['--main', '--dev', '--branch'])), null, 2));
    else throw new Error('Usage: ci-main-release.mjs check [--tree <ref>] | prepare [--main <ref>] [--dev <ref>] --branch <new-local-branch>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
