import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
const qa = path.dirname(new URL(import.meta.url).pathname);
const source = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const kit = '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-managed-source-2026-10-14';
const tag = 'cortex-sandbox-managed-source:20261014';
const expectedSource = '9fb9687536af0b7abfcb7280e0aa26ef450051ea';
assert.match(expectedSource, /^[a-f0-9]{40}$/, '9fb9687536af0b7abfcb7280e0aa26ef450051ea: root accepted commit GO required');
const identity = JSON.parse(fs.readFileSync(path.join(kit, 'identity.json')));
const receipt = JSON.parse(fs.readFileSync(path.join(kit, 'image/archives/manifest.json')));
assert.equal(receipt.sourceCommit, expectedSource); assert.equal(receipt.backend.files, 170);
assert.equal(identity.ownerUid, process.getuid()); assert.equal(identity.ownerGid, process.getgid());
assert.match(identity.id, /^[a-f0-9-]{36}$/); assert.equal(fs.statSync(path.join(kit, 'identity.json')).mode & 0o777, 0o600);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const archive of receipt.packages) assert.equal(digest(fs.readFileSync(path.join(kit, 'image/archives', archive.filename))), archive.sha256);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(), expectedSource);
const args = ['build', '--platform', 'linux/arm64', '--tag', tag, '--build-arg', `SANDBOX_UID=${identity.ownerUid}`, '--build-arg', `SANDBOX_GID=${identity.ownerGid}`,
  '--label', `dev.cortex.manual-sandbox=${identity.id}`, '--label', `dev.cortex.manual-sandbox.path=${kit}`, '--label', `dev.cortex.manual-sandbox.source=${expectedSource}`,
  '--iidfile', path.join(qa, 'docker-image-id.txt'), '--progress', 'plain', path.join(kit, 'image')];
const fd = fs.openSync(path.join(qa, 'docker-build-v1.log'), 'wx');
let code;
try { code = await new Promise((resolve, reject) => {
  const child = spawn('docker', args, { stdio: ['ignore', fd, fd] }); child.once('error', reject); child.once('exit', resolve);
}); } finally { fs.closeSync(fd); }
fs.writeFileSync(path.join(qa, 'docker-build-exit.json'), JSON.stringify({ command: ['docker', ...args], exitCode: code, runtimeContainersStarted: 0 }, null, 2) + '\n');
assert.equal(code, 0, 'Docker build failed; preserve raw log, do not blindly retry.');
const inspected = JSON.parse(execFileSync('docker', ['image', 'inspect', tag], { encoding: 'utf8' }));
fs.writeFileSync(path.join(qa, 'docker-image-inspect-full.json'), JSON.stringify(inspected, null, 2) + '\n');
assert.equal(inspected.length, 1); const image = inspected[0];
assert.equal(image.Id, fs.readFileSync(path.join(qa, 'docker-image-id.txt'), 'utf8').trim());
assert.equal(image.Os, 'linux'); assert.equal(image.Architecture, 'arm64'); assert.equal(image.Config.User, 'sandbox');
assert.equal(image.Config.Labels['dev.cortex.manual-sandbox'], identity.id);
assert.equal(image.Config.Labels['dev.cortex.manual-sandbox.path'], kit);
assert.equal(image.Config.Labels['dev.cortex.manual-sandbox.source'], expectedSource);
assert.deepEqual(image.Config.Entrypoint, ['node', '/opt/entrypoint.mjs']); assert.equal(image.Config.WorkingDir, '/work');
fs.writeFileSync(path.join(kit, 'image-id.txt'), image.Id + '\n', { flag: 'wx', mode: 0o600 });
assert.equal(fs.statSync(path.join(kit, 'image-id.txt')).mode & 0o777, 0o600);
const summary = { imageId: image.Id, tag, os: image.Os, architecture: image.Architecture, user: image.Config.User, kitIdentity: identity,
  labels: image.Config.Labels, size: image.Size, entrypoint: image.Config.Entrypoint, workdir: image.Config.WorkingDir, liveRunStarted: false };
fs.writeFileSync(path.join(qa, 'docker-image-identity.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
