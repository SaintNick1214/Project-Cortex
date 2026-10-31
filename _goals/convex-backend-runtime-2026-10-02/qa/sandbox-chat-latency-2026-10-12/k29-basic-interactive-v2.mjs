import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const q = path.dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(fs.readFileSync('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/.sandbox-env-runs/ee12c10d-424f-4c65-b1a5-1f4e64bdb8d2/session.json'));
assert.equal(process.env.CORTEX_K29_CLI_GO, '1');
assert.equal(s.phase, 'READY'); assert.equal(s.target.id, 6178760); assert.equal(s.target.name, 'savory-pheasant-21');
assert.equal(s.target.teamId, 325340); assert.equal(s.target.projectId, 3200658); assert.equal(s.target.isDefault, false);
assert.equal(s.container.imageId, 'sha256:8d1afbb653dbcfa5c1592b79831502be3ac7f7e5ee51ee6ceaa7a96703e22fbd');
assert.equal(s.container.name, 'cortex-sandbox-ee12c10d-424f-4c65-b1a5-1f4e64bdb8d2');
const trace = JSON.parse(fs.readFileSync(path.join(q, 'k29-backend-trace-enabled.json')));
assert.equal(trace.sessionId, s.id); assert.equal(trace.directExecFinalExit, 0); assert.equal(trace.readback, 1); assert.equal(trace.enabled, true); assert.equal(trace.measuredTurnsBeforeEnable, 0); assert.equal(trace.sourceCommit, 'f87695783e8b21ffecf6298057a87cd8e69a3016');
assert.equal(process.version, 'v24.15.0');
const fd = fs.openSync(path.join(q, 'k29-cli-session-v1.log'), 'wx');
const args = ['exec', '--interactive', '--workdir', '/work/basic', s.container.name, 'node', '--env-file-if-exists=.env.local', '--import', 'tsx', 'src/index.ts'];
const startedAt = new Date().toISOString();
const child = spawn('/Applications/Docker.app/Contents/Resources/bin/docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
const copy = stream => stream.on('data', bytes => { fs.writeSync(fd, bytes); process.stdout.write(bytes); });
copy(child.stdout); copy(child.stderr);
child.stdin.on('error', error => { if (error.code !== 'EPIPE') throw error; });
process.stdin.pipe(child.stdin);
const interrupt = () => child.kill('SIGINT'); process.once('SIGINT', interrupt);
child.once('error', error => {
  fs.writeFileSync(path.join(q, 'k29-cli-spawn-error-v1.json'), JSON.stringify({ errorCode: error.code ?? null }) + '\n', { flag: 'wx' });
  process.exitCode = 1;
});
child.once('close', (exitCode, signal) => {
  process.stdin.unpipe(child.stdin); process.stdin.pause(); process.removeListener('SIGINT', interrupt); fs.closeSync(fd);
  fs.writeFileSync(path.join(q, 'k29-cli-session-exit-v1.json'), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), args, exitCode, signal,
    source: 'Direct docker child close event; no pipeline or tee', sessionId: s.id }, null, 2) + '\n', { flag: 'wx' });
  process.exitCode = exitCode ?? 1;
});
