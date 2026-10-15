import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRedactor } from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import { readReady, readReviewedSource, verifyRuntimeIdentity } from './memory-effort-canonical-native-pins.mjs';

const q = path.dirname(fileURLToPath(import.meta.url));
const repository = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const resume = process.argv[2] === '--resume-preparation';
assert.ok(process.argv.length === 2 || resume && process.argv.length === 3);
const evidence = path.join(q, 'memory-effort-canonical-chat-install-checks' + (resume ? '-repair1' : ''));
const pins = JSON.parse(await fs.readFile(path.join(q, 'memory-effort-canonical-runtime-prospective-pins.json'), 'utf8'));
assert.equal(pins.sourceCommit, '07f669e35cc3221c0411d1e4dfd790e4b95aa54d');
assert.equal(pins.imageId, 'sha256:ee14fa15560b789a5720b4b645fc99aa05c05c7915a803936be7e6a5f2168657');
assert.equal(pins.targetId, 6191473); assert.equal(pins.launcherPid, 54107); assert.equal(pins.rootExecSession, 93608);
assert.equal(process.versions.node, '24.15.0');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const redactor = createRedactor(); let managementReceipts = [];
const ctx = { docker: '/Applications/Docker.app/Contents/Resources/bin/docker', registerSecret: redactor.registerSecret,
  persist: async () => {}, receipt: async (name, data) => managementReceipts.push({ name, ...data }) };
async function verify() {
  const ready = await readReady(pins);
  const frozen = await readReviewedSource(pins);
  for (const [name, hash] of Object.entries(frozen.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(repository, name))), hash, name);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(), pins.sourceCommit);
  const session = await verifyRuntimeIdentity(ctx, pins, ready);
  const owner = execFileSync('ps', ['-p', String(pins.launcherPid), '-o', 'pid=,ppid=,uid=,command='], { encoding: 'utf8' }).trim();
  assert.ok(owner.includes('/Project-Cortex-Proofs/sandbox-env/runner.mjs --no-copy'));
  const docker = JSON.parse(execFileSync(ctx.docker, ['container', 'inspect', '--format', '{"mounts":{{json .Mounts}},"ports":{{json .NetworkSettings.Ports}}}', session.container.id], { encoding: 'utf8' }));
  const work = docker.mounts.find(row => row.Destination === '/work');
  assert.equal(work.Source, session.workspace); assert.equal(work.RW, true);
  assert.deepEqual(docker.ports['3001/tcp'], [{ HostIp: '127.0.0.1', HostPort: '3367' }]);
  return { session, ready, frozenSourceFiles: Object.keys(frozen.sourceHashes).length, owner, docker };
}
const initial = await verify();
const existingRoot = path.join(initial.session.workspace, 'chat');
if (resume) {
  const existingOwner = JSON.parse(await fs.readFile(path.join(existingRoot, '.owner.json'), 'utf8'));
  assert.equal(existingOwner.installId, 'ffca9306-7f0a-45c6-915a-342aecddbded');
  assert.equal(existingOwner.sessionId, pins.sessionId);
  await assert.rejects(fs.access(path.join(existingRoot, 'app')), error => error.code === 'ENOENT');
} else await assert.rejects(fs.access(existingRoot), error => error.code === 'ENOENT');
await fs.mkdir(evidence, { mode: 0o700 });
const installId = resume ? 'ffca9306-7f0a-45c6-915a-342aecddbded' : randomUUID();
const jsonWrite = async (name, data) => fs.writeFile(path.join(evidence, name + '.json'), redactor.redact(JSON.stringify(data, null, 2)) + '\n', { flag: 'wx', mode: 0o600 });
await jsonWrite('identity-before', { ...initial, managementReceipts }); managementReceipts = [];
const installerPath = path.join(repository, 'scripts/install-ci-demo.mjs');
const installer = await fs.readFile(installerPath, 'utf8');
assert.equal(sha(installer), sha(execFileSync('git', ['show', pins.sourceCommit + ':scripts/install-ci-demo.mjs'], { cwd: repository })));
const containerHelper = await fs.readFile(path.join(q, 'memory-effort-canonical-chat-install-container.mjs'), 'utf8');
const results = [];
async function dockerRun(name, args, input) {
  const started = Date.now(); let stdout = '', stderr = '', timedOut = false;
  const command = ['exec', ...(input === undefined ? [] : ['-i']), initial.session.container.id, ...args];
  const child = spawn(ctx.docker, command, { stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 900000);
  if (input !== undefined) child.stdin.end(input);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  clearTimeout(timer);
  const receipt = { name, command: [ctx.docker, ...command], sourceCommit: pins.sourceCommit, sessionId: pins.sessionId,
    installId, ...result, elapsedMs: Date.now() - started, naturalExit: !timedOut && result.signal === null,
    timedOut, stdout: redactor.redact(stdout), stderr: redactor.redact(stderr) };
  await jsonWrite(name, receipt);
  await fs.writeFile(path.join(evidence, name + '.log'), receipt.stdout + '\n' + receipt.stderr, { flag: 'wx', mode: 0o600 });
  results.push({ name, code: result.code, naturalExit: receipt.naturalExit, elapsedMs: receipt.elapsedMs });
  console.log(JSON.stringify({ stage: name, code: result.code, naturalExit: receipt.naturalExit, elapsedMs: receipt.elapsedMs }));
  assert.equal(result.code, 0, name + ' failed; inspect retained log'); assert.equal(receipt.naturalExit, true);
}
const bootstrap = `import fs from 'node:fs/promises'; import assert from 'node:assert/strict';
const p=JSON.parse(await new Promise(resolve=>{let b='';process.stdin.on('data',x=>b+=x);process.stdin.on('end',()=>resolve(b));}));
assert.equal(process.getuid(),501);
if(p.resume){
const owner=JSON.parse(await fs.readFile('/work/chat/.owner.json','utf8'));assert.equal(owner.installId,p.owner.installId);assert.equal(owner.sessionId,p.owner.sessionId);
await assert.rejects(fs.access('/work/chat/app'),e=>e.code==='ENOENT');
assert.equal(await fs.readFile('/work/chat/.tooling/install-ci-demo.mjs','utf8'),p.installer);
await fs.writeFile('/work/chat/.tooling/runner.mjs',p.helper,{mode:0o600});
}else{
await assert.rejects(fs.access('/work/chat'),e=>e.code==='ENOENT');
await fs.mkdir('/work/chat',{mode:0o700});await fs.mkdir('/work/chat/.tooling',{mode:0o700});
await fs.writeFile('/work/chat/.owner.json',JSON.stringify(p.owner,null,2),{flag:'wx',mode:0o600});
await fs.writeFile('/work/chat/.tooling/install-ci-demo.mjs',p.installer,{flag:'wx',mode:0o600});
await fs.writeFile('/work/chat/.tooling/runner.mjs',p.helper,{flag:'wx',mode:0o600});
}console.log(JSON.stringify({state:p.resume?'OWNED_PREPARATION_HELPER_REPAIRED':'NEW_OWNED_CHAT_ROOT_CREATED',installId:p.owner.installId}));`;
const fresh = await verify();
await jsonWrite('identity-bootstrap', { sessionId: fresh.session.id, target: fresh.session.target, managementReceipts }); managementReceipts = [];
await dockerRun('bootstrap', ['node', '--input-type=module', '-e', bootstrap], JSON.stringify({ resume,
  owner: { version: 1, installId, sessionId: pins.sessionId, sourceCommit: pins.sourceCommit, ownerUid: 501,
    createdAt: new Date().toISOString(), cleanupOwner: 'Root exact session cleanup', app: '/work/chat/app' }, installer, helper: containerHelper,
}));
try {
  for (const stage of ['prepare', 'codegen', 'types', 'build']) {
    const current = await verify();
    await jsonWrite('identity-' + stage, { sessionId: current.session.id, target: current.session.target, frozenSourceFiles: current.frozenSourceFiles, managementReceipts }); managementReceipts = [];
    await dockerRun(stage, ['node', '/work/chat/.tooling/runner.mjs', stage]);
  }
} finally {
  const current = await verify();
  const root = path.join(current.session.workspace, 'chat');
  const state = await fs.readFile(path.join(root, '.tooling/state.json'), 'utf8').then(JSON.parse).catch(() => null);
  for (const name of await fs.readdir(path.join(root, '.tooling/receipts')).catch(() => [])) {
    assert.ok(/^[a-z-]+\.(?:json|log)$/.test(name));
    await fs.writeFile(path.join(evidence, 'native-' + name), redactor.redact(await fs.readFile(path.join(root, '.tooling/receipts', name), 'utf8')), { flag: 'wx', mode: 0o600 });
  }
  const complete = results.filter(row => ['prepare', 'codegen', 'types', 'build'].includes(row.name)).length === 4 && results.every(row => row.code === 0 && row.naturalExit);
  await jsonWrite('report', { status: complete ? 'GENUINE_CHAT_INSTALL_CODEGEN_TYPES_PRODUCTION_BUILD_PASS' : 'INCOMPLETE',
    sourceCommit: pins.sourceCommit, sessionId: pins.sessionId, installId, target: current.session.target,
    container: current.session.container, launcherPid: pins.launcherPid, rootExecSession: pins.rootExecSession,
    appContainerPath: '/work/chat/app', appHostPath: path.join(root, 'app'), installRoot: root, state, results,
    identityAfter: { owner: current.owner, frozenSourceFiles: current.frozenSourceFiles, managementReceipts },
    serverStarted: false, modelCalls: 0, deployments: 0, cleanupOwner: 'Root owns exact session cleanup; this task has no active app processes',
    serving: { host: 'http://127.0.0.1:3367', containerPort: 3001,
      command: [ctx.docker, 'exec', '-w', '/work/chat/app', current.session.container.id, 'node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', '3001'],
      config: '.env.local contains only the verified public runtime tuple. Browser bearer identity must come from the existing owned session. AUTH_SECRET was build-only; retained Auth.js routes need their own app secret only if exercised.' } });
  console.log(JSON.stringify({ status: complete ? 'PASS' : 'INCOMPLETE', app: '/work/chat/app', host: 'http://127.0.0.1:3367', report: path.join(evidence, 'report.json'), serverStarted: false }));
}
