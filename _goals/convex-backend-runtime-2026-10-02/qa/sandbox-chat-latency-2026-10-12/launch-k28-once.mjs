import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const qa = path.dirname(fileURLToPath(import.meta.url));
const proofs = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
const pinned = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin';
const sourceCommit = process.argv[2];
assert.equal(process.version, 'v24.15.0');
assert.equal(process.env.CORTEX_K28_LAUNCH_GO, '1', 'Explicit fresh sandbox launch GO required');
assert.match(sourceCommit ?? '', /^[a-f0-9]{40}$/);
const approval = JSON.parse(fs.readFileSync(path.join(proofs, 'sandbox-env/procedure-approval.json')));
assert.equal(approval.candidateSourceCommit, sourceCommit);
const fd = fs.openSync(path.join(qa, 'k28-launcher-v1.log'), 'wx', 0o600);
const startedAt = new Date().toISOString();
const child = spawn('/bin/bash', [path.join(proofs, 'start-sandbox.sh'), '--no-copy'], {
  cwd: proofs, env: { ...process.env, PATH: pinned + path.delimiter + process.env.PATH, CORTEX_RUNTIME_LATENCY_TRACE: '1' }, stdio: ['ignore', fd, fd],
});
fs.writeFileSync(path.join(qa, 'k28-launcher-start-v1.json'), JSON.stringify({ startedAt, wrapperPid: process.pid, launcherPid: child.pid,
  command: 'start-sandbox.sh --no-copy', clipboardCopied: false, sourceCommit, backendTraceReadbackRequiredBeforeMeasurement: true }, null, 2) + '\n', { flag: 'wx' });
child.once('error', error => {
  try { fs.closeSync(fd); } catch {}
  fs.writeFileSync(path.join(qa, 'k28-launcher-spawn-error-v1.json'), JSON.stringify({ errorCode: error.code ?? null }, null, 2) + '\n', { flag: 'wx' });
  process.exitCode = 1;
});
child.once('close', (exitCode, signal) => {
  try { fs.closeSync(fd); } catch {}
  fs.writeFileSync(path.join(qa, 'k28-launcher-child-exit-v1.json'), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), launcherPid: child.pid,
    exitCode, signal, source: 'direct child close event; no pipeline or tee' }, null, 2) + '\n', { flag: 'wx' });
  process.exitCode = exitCode ?? 1;
});
