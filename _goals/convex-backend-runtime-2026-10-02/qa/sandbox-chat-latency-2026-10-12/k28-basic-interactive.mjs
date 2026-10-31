import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const q = path.dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(fs.readFileSync('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/.sandbox-env-runs/14be01ce-2125-4d36-bb83-f4d842f994e9/session.json'));
assert.equal(process.env.CORTEX_K28_CLI_GO, '1');
assert.equal(s.phase, 'READY'); assert.equal(s.target.id, 6177151); assert.equal(s.target.name, 'resilient-ptarmigan-738');
assert.equal(s.target.teamId, 325340); assert.equal(s.target.projectId, 3200658); assert.equal(s.target.isDefault, false);
assert.equal(s.container.imageId, 'sha256:ae85998b5ffb20e8fd006136473740ec093d504c328d4021d9b7c755dbdaf565');
assert.equal(s.container.name, 'cortex-sandbox-14be01ce-2125-4d36-bb83-f4d842f994e9');
const trace = JSON.parse(fs.readFileSync(path.join(q, 'k28-backend-trace-enabled.json')));
assert.equal(trace.sessionId, s.id); assert.equal(trace.exitCode, 0); assert.equal(trace.readback, '1');
assert.equal(process.version, 'v24.15.0');
const fd = fs.openSync(path.join(q, 'k28-cli-session-v1.log'), 'wx');
const args = ['exec', '--interactive', '--workdir', '/work/basic', s.container.name, 'node', '--env-file-if-exists=.env.local', '--import', 'tsx', 'src/index.ts'];
const startedAt = new Date().toISOString();
const child = spawn('/Applications/Docker.app/Contents/Resources/bin/docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
const copy = stream => stream.on('data', bytes => { fs.writeSync(fd, bytes); process.stdout.write(bytes); });
copy(child.stdout); copy(child.stderr);
child.stdin.on('error', error => { if (error.code !== 'EPIPE') throw error; });
process.stdin.pipe(child.stdin);
const interrupt = () => child.kill('SIGINT'); process.once('SIGINT', interrupt);
child.once('error', error => {
  fs.writeFileSync(path.join(q, 'k28-cli-spawn-error-v1.json'), JSON.stringify({ errorCode: error.code ?? null }) + '\n', { flag: 'wx' });
  process.exitCode = 1;
});
child.once('close', (exitCode, signal) => {
  process.stdin.unpipe(child.stdin); process.stdin.pause(); process.removeListener('SIGINT', interrupt); fs.closeSync(fd);
  fs.writeFileSync(path.join(q, 'k28-cli-session-exit-v1.json'), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), args, exitCode, signal,
    source: 'Direct docker child close event; no pipeline or tee', sessionId: s.id }, null, 2) + '\n', { flag: 'wx' });
  process.exitCode = exitCode ?? 1;
});
