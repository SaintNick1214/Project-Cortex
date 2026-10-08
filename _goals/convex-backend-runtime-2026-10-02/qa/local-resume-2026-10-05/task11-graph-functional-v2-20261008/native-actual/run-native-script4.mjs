/** Ordinary bounded owned child runner. No target selection or product certification layer. */
import assert from 'node:assert/strict';
import {access, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {spawn} from 'node:child_process';
import {openOwnedContext, root, q} from './common.mjs';
const [name, label, requested] = process.argv.slice(2);
assert.ok(['native-late1', 'native-late2', 'native-late3', 'native-late4', 'native-exhaustion2', 'native-revocation2', 'native-retirement2', 'native-exhaustion1', 'native-timeout2', 'native-retirement1', 'native-revocation1', 'readonly-driver-close1'].includes(name));
assert.match(label ?? '', /^[a-z0-9-]+$/);
const totalRequested = Number(requested ?? 90000);
assert.ok([15000, 60000, 90000, 120000].includes(totalRequested));
const deadlineMs = totalRequested === 15000 ? 13000 : totalRequested;
const cleanupGraceMs = totalRequested === 15000 ? 2000 : 5000;
let exists = true; try {await access(join(q, label + '.json'));} catch (error) {if (error.code === 'ENOENT') exists = false; else throw error;}
assert.equal(exists, false, 'Preserve the original closed runner receipt');
const context = await openOwnedContext();
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['HOME', 'PATH', 'TMPDIR', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'NO_COLOR', 'CI'].includes(key)));
env.PATH = dirname(process.execPath) + ':' + env.PATH;
const args = [join(q, name + '.mjs')], startedAt = Date.now();
const child = spawn(process.execPath, args, {cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe']});
let stdout = '', stderr = '', closed = false, timedOut = false;
const signals = [];
await context.publish(label + '-started', {version: 1, executable: process.execPath, args, cwd: root,
  pid: child.pid, groupOwnedFromSpawn: true, startedAt, deadlineMs, cleanupGraceMs, noCredentialEnvironment: true});
child.stdout.on('data', bytes => {stdout += bytes; process.stdout.write(context.redact(bytes));});
child.stderr.on('data', bytes => {stderr += bytes;});
const stop = signal => {if (!closed) try {process.kill(-child.pid, signal); signals.push({signal, ownedGroup: child.pid, at: Date.now()});} catch (error) {signals.push({signal, code: error.code});}};
const timer = setTimeout(() => {timedOut = true; stop('SIGTERM');}, deadlineMs);
const hard = setTimeout(() => {if (timedOut) stop('SIGKILL');}, deadlineMs + cleanupGraceMs);
let exit;
try {exit = await new Promise((resolve, reject) => {
  child.once('error', reject); child.once('close', (code, signal) => {closed = true; resolve({code, signal});});
});} finally {clearTimeout(timer); clearTimeout(hard);}
await writeFile(join(q, label + '.stdout.log'), context.redact(stdout), {flag: 'wx'});
await writeFile(join(q, label + '.stderr.log'), context.redact(stderr), {flag: 'wx'});
await context.publish(label, {version: 1, executable: process.execPath, args, cwd: root, pid: child.pid,
  groupOwnedFromSpawn: true, ...exit, timedOut, childClosed: closed, deadlineMs, cleanupGraceMs,
  elapsedMs: Date.now() - startedAt, signals, unknownRemoteSideEffectsPreservedOnTimeout: timedOut});
await context.close();
console.log(JSON.stringify({label, ...exit, timedOut, childClosed: closed, elapsedMs: Date.now() - startedAt}));
if (timedOut || exit.code !== 0) process.exitCode = 1;
