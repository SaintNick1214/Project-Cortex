/** One foreground session owns exactly one new managed development database and one container. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { IMAGE_ID, preflightDocker, selectPorts, createDocker, removeDocker, configureApps, launchDemo } from './docker.mjs';

export const PROOFS_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KIT_NAME = 'manual-sandbox-latency-progress-source-batch-2026-10-13';
const TOOLING_KIT_NAME = 'manual-sandbox-2026-10-12';
const NPM_CLI = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const safeLabel = value => typeof value === 'string' && /^[a-zA-Z0-9-]+$/.test(value);
const HELP = `Usage: ./start-sandbox.sh [--no-copy | --smoke | --dry-run | --help]
       ./start-sandbox.sh cleanup SESSION_UUID
       ./start-sandbox.sh refresh-tokens SESSION_UUID
       ./start-sandbox.sh copy-token SESSION_UUID [owner|reader|outsider]

Each normal run creates a NEW isolated Docker container and NEW nondefault dev
Convex DB in the approved Cortex sandbox project; eight fixed setup calls have at most
$2.70 unknown-cost liability. Manual calls retain $3/run and $10/tenant caps.
The demo stays foreground. Normal exit, errors and Ctrl-C remove only these new
resources. --smoke checks fresh readiness/demo health then cleans up; --no-copy
avoids the optional owner-token clipboard. No token is printed.
SIGKILL/power loss cannot run traps: recover with cleanup SESSION_UUID. Retained
private receipts preserve uncertain costs. The server DB expires within7days.
See SANDBOX.md for testing, finite expiry, authentication and recovery details.
`;

export function parseArgs(args) {
  if (!args.length) return { action: 'run', mode: 'demo', copy: true };
  if (args.length === 1 && ['--help', '-h', 'help'].includes(args[0])) return { action: 'help' };
  if (args.length === 1 && args[0] === '--dry-run') return { action: 'dry-run' };
  if (args.length === 1 && args[0] === '--smoke') return { action: 'run', mode: 'smoke', copy: false };
  if (args.length === 1 && args[0] === '--no-copy') return { action: 'run', mode: 'demo', copy: false };
  const [action, id, role = 'owner'] = args;
  if (['cleanup', 'refresh-tokens', 'copy-token'].includes(action) && UUID.test(id ?? '')
    && (action === 'copy-token' ? args.length <= 3 && ['owner', 'reader', 'outsider'].includes(role) : args.length === 2)) return { action, id, role };
  throw Error('Invalid arguments. Run ./start-sandbox.sh --help.');
}

async function privateDirectory(directory, create = false) {
  if (create) await fs.mkdir(directory, { mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) throw Error('Session directory must be current-owner0700 with no symlink.');
}
export async function privateWrite(file, data) {
  try { const before = await fs.lstat(file); if (!before.isFile() || before.isSymbolicLink() || before.uid !== process.getuid() || (before.mode & 0o777) !== 0o600) throw Error('Refusing an unsafe private file destination.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, data, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
export function sessionPaths(root, id) {
  if (!UUID.test(id)) throw Error('A canonical v4 session UUID is required.');
  const runDir = path.join(root, '.sandbox-env-runs', id);
  return { id, runDir, workspace: path.join(runDir, 'workspace'), backendDir: path.join(runDir, 'host'), issuerDir: path.join(runDir, 'issuer'),
    secretsDir: path.join(runDir, 'secrets'), receiptDir: path.join(runDir, 'receipts'), deploymentKeyPath: path.join(runDir, 'secrets', 'dev-deploy-key.txt') };
}
export async function newSession(root, mode) {
  const base = path.join(root, '.sandbox-env-runs');
  await fs.mkdir(base, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  await privateDirectory(base);
  const session = { version: 1, ...sessionPaths(root, randomUUID()), mode, ownerUid: process.getuid(), ownerGid: process.getgid(),
    createdAt: Date.now(), target: null, container: null, publicRuntime: null, phase: 'NEW', launcherPid: process.pid, launcherHost: os.hostname() };
  await privateDirectory(session.runDir, true);
  for (const field of ['workspace', 'backendDir', 'issuerDir', 'secretsDir', 'receiptDir']) await privateDirectory(session[field], true);
  for (const name of ['host-home', 'tmp']) await privateDirectory(path.join(session.runDir, name), true);
  await privateWrite(path.join(session.runDir, 'session.json'), JSON.stringify(session, null, 2) + '\n');
  return session;
}
export async function loadSession(root, id) {
  const expected = sessionPaths(root, id);
  await privateDirectory(path.join(root, '.sandbox-env-runs'));
  await privateDirectory(expected.runDir);
  const journal = path.join(expected.runDir, 'session.json');
  const stat = await fs.lstat(journal);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw Error('Unsafe session journal.');
  const session = JSON.parse(await fs.readFile(journal, 'utf8'));
  if (session.version !== 1 || session.ownerUid !== process.getuid() || session.ownerGid !== process.getgid()
    || Object.entries(expected).some(([key, value]) => session[key] !== value)) throw Error('Session journal identity/path/owner drift.');
  for (const field of ['workspace', 'backendDir', 'issuerDir', 'secretsDir', 'receiptDir']) {
    try { await privateDirectory(session[field]); } catch (error) { if (error.code !== 'ENOENT' || !['CLEANED', 'CLEANUP_FAILED', 'CLEANING'].includes(session.phase) || !['workspace', 'backendDir', 'issuerDir', 'secretsDir'].includes(field)) throw error; }
  }
  return session;
}

export function createRedactor() {
  const secrets = new Set();
  return { registerSecret(value) { if (typeof value === 'string' && value.length >= 8) secrets.add(value); },
    redact(value) { let text = typeof value === 'string' ? value : JSON.stringify(value);
      for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
      return text.replace(/\b(?:dev|prod|preview):[a-z0-9-]+\|[^\s"'\\]+/g, '[REDACTED_DEPLOY_KEY]')
        .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
        .replace(/-----BEGIN [^-\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\n]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'); } };
}

export function commandRunner(session, options = {}) {
  const children = new Set();
  const closedChildren = new WeakSet();
  const redact = options.redact ?? String;
  const receipt = options.receipt ?? (async () => {});
  const log = options.log ?? (() => {});
  const pinnedBin = '/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin';
  const environment = { PATH: `${pinnedBin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: path.join(session.runDir, 'host-home'), TMPDIR: path.join(session.runDir, 'tmp'), LANG: 'en_US.UTF-8', CI: '1', npm_config_update_notifier: 'false' };
  const kill = (child, signal) => { if (!closedChildren.has(child) && child.pid) { try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } } };
  async function command(name, executable, args, commandOptions = {}) {
    if (!safeLabel(name) || typeof executable !== 'string' || !Array.isArray(args) || args.some(arg => typeof arg !== 'string')) throw Error('Invalid bounded command invocation.');
    const signal = commandOptions.signal ?? options.signal;
    signal?.throwIfAborted();
    const timeoutMs = commandOptions.timeoutMs ?? 180_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0 || (timeoutMs === 0 && commandOptions.foreground !== true)) throw Error('Only foreground user sessions may omit a command deadline.');
    let stdout = '', stderr = '', foregroundLines = '', failure = null;
    const started = Date.now();
    const child = spawn(executable, args, { cwd: commandOptions.cwd ?? session.runDir, env: { ...environment, ...commandOptions.env },
      detached: true, stdio: [commandOptions.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    const entry = { child, done: null }; children.add(entry);
    let graceTimer;
    const terminate = error => { failure ??= error; kill(child, 'SIGTERM'); graceTimer ??= setTimeout(() => kill(child, 'SIGKILL'), 5_000); graceTimer.unref(); };
    const onAbort = () => terminate(signal.reason ?? Error('Command interrupted.'));
    signal?.addEventListener('abort', onAbort, { once: true });
    const deadline = timeoutMs > 0 ? setTimeout(() => terminate(Error(`Command ${name} exceeded its ${timeoutMs}ms deadline.`)), timeoutMs) : null;
    deadline?.unref();
    const capture = (kind, chunk) => {
      if (kind === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
      if (stdout.length + stderr.length > 16_777_216) terminate(Error(`Command ${name} exceeded bounded output.`));
      if (commandOptions.foreground) {
        foregroundLines += chunk.toString();
        const end = foregroundLines.lastIndexOf('\n');
        if (end >= 0) { log(redact(foregroundLines.slice(0, end + 1))); foregroundLines = foregroundLines.slice(end + 1); }
      }
    };
    child.stdout.on('data', chunk => capture('stdout', chunk)); child.stderr.on('data', chunk => capture('stderr', chunk));
    entry.done = new Promise(resolve => { child.once('error', error => { failure ??= error; }); child.once('close', (code, processSignal) => { closedChildren.add(child); resolve({ code, processSignal }); }); });
    if (commandOptions.input !== undefined) { child.stdin.on('error', error => { failure ??= error; }); child.stdin.end(commandOptions.input); }
    let completed;
    try { completed = await entry.done; }
    finally { if (deadline) clearTimeout(deadline); if (graceTimer) clearTimeout(graceTimer); signal?.removeEventListener('abort', onAbort); children.delete(entry); }
    if (foregroundLines) log(redact(foregroundLines));
    await receipt(name, { executable: path.basename(executable), code: completed.code, signal: completed.processSignal, elapsedMs: Date.now() - started,
      stdout: redact(stdout), stderr: redact(stderr), error: failure ? redact(String(failure.message ?? failure)) : null });
    if (failure || completed.code !== 0) {
      const error = Error(redact(failure?.message ?? `Command ${name} exited ${completed.code ?? completed.processSignal}. ${stderr.slice(-4000)}`));
      error.stdout = stdout; error.stderr = stderr; error.code = completed.code; throw error;
    }
    return { code: completed.code, stdout, stderr };
  }
  async function stopChildren() {
    const owned = [...children];
    for (const entry of owned) kill(entry.child, 'SIGTERM');
    const timer = setTimeout(() => { for (const entry of owned) kill(entry.child, 'SIGKILL'); }, 5_000); timer.unref();
    try { await Promise.allSettled(owned.map(entry => entry.done)); } finally { clearTimeout(timer); }
  }
  return { command, stopChildren };
}

export async function createContext(session, { signal, cleanup = false, logger = message => process.stdout.write(String(message) + (String(message).endsWith('\n') ? '' : '\n')) } = {}) {
  const redactor = createRedactor();
  const kit = path.join(PROOFS_ROOT, KIT_NAME);
  const ctx = { node: process.execPath, npmCli: NPM_CLI, kit, dependenciesDir: path.join(PROOFS_ROOT, TOOLING_KIT_NAME, 'workspace', 'backend', 'node_modules'), signal, cleanup,
    docker: '/Applications/Docker.app/Contents/Resources/bin/docker', fetch: globalThis.fetch, latencyTrace: process.env.CORTEX_RUNTIME_LATENCY_TRACE === '1',
    registerSecret: redactor.registerSecret, log: message => logger(redactor.redact(message)),
    persist: () => privateWrite(path.join(session.runDir, 'session.json'), JSON.stringify(session, null, 2) + '\n'),
    receipt: async (name, data) => { if (!safeLabel(name)) throw Error('Unsafe receipt name.');
      await privateWrite(path.join(session.receiptDir, `${name}.json`), redactor.redact(JSON.stringify(data, null, 2)) + '\n'); } };
  const commands = commandRunner(session, { signal, redact: redactor.redact, receipt: ctx.receipt, log: ctx.log });
  Object.assign(ctx, commands);
  return ctx;
}

export async function cleanupSession(session, ctx, services) {
  session.phase = 'CLEANING'; await ctx.persist();
  const errors = [];
  // Neither a failed Docker operation nor a canceled setup signal bypasses exact cloud cleanup.
  await ctx.stopChildren().catch(error => errors.push(`Owned children: ${error.message}`));
  for (const [label, remove] of [['Docker', services.removeDocker], ['Convex', services.deleteCloud]]) {
    try { await remove(session, ctx); } catch (error) { errors.push(`${label}: ${error.message}`); }
  }
  if (errors.length) {
    session.phase = 'CLEANUP_FAILED';
    await ctx.persist();
    await ctx.receipt('cleanup-recovery', { status: 'FAILED', sessionId: session.id, errors,
      recoveryCommand: `./start-sandbox.sh cleanup ${session.id}`, ttl: session.target?.expiresAt ?? null });
    throw Error(`Cleanup incomplete; credentials retained for recovery. Run ./start-sandbox.sh cleanup ${session.id}. ${errors.join(' ')}`);
  }
  // Delete scoped keys/token-bearing app configs only after both resources are positively absent.
  for (const field of ['issuerDir', 'secretsDir', 'workspace', 'backendDir']) {
    try { await privateDirectory(session[field]); await fs.rm(session[field], { recursive: true }); }
    catch (error) { if (error.code !== 'ENOENT') errors.push(`Scoped ${field} removal: ${error.message}`); }
  }
  for (const name of ['host-home', 'tmp']) {
    const directory = path.join(session.runDir, name);
    try { await privateDirectory(directory); await fs.rm(directory, { recursive: true }); } catch (error) { if (error.code !== 'ENOENT') errors.push(`Scoped ${name} removal: ${error.message}`); }
  }
  if (errors.length) {
    session.phase = 'CLEANUP_FAILED'; await ctx.persist();
    await ctx.receipt('cleanup-recovery', { status: 'FAILED_SCOPED_FILE_REMOVAL', sessionId: session.id, container: 'ABSENT', database: 'ABSENT', errors, recoveryCommand: `./start-sandbox.sh cleanup ${session.id}` });
    throw Error(`Owned resources are absent but private file cleanup failed. Run ./start-sandbox.sh cleanup ${session.id}. ${errors.join(' ')}`);
  }
  session.phase = 'CLEANED'; session.cleanedAt = Date.now(); await ctx.persist();
  await ctx.receipt('cleanup-final', { status: 'ABSENT', sessionId: session.id, container: 'ABSENT', database: 'ABSENT', credentialsRemoved: true, retained: 'public journal and private redacted receipts' });
}

export async function awaitDemoHealth(session, ctx, launch, deadlineMs = 120_000) {
  const end = Date.now() + deadlineMs;
  let ended = false, earlyError;
  launch.then(() => { ended = true; }, error => { ended = true; earlyError = error; });
  while (Date.now() < end) {
    ctx.signal?.throwIfAborted();
    if (ended) throw earlyError ?? Error('Demo exited before health could be established.');
    try {
      const signal = ctx.signal ? AbortSignal.any([ctx.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
      const response = await ctx.fetch(`http://127.0.0.1:${session.ports.web}`, { signal, redirect: 'error' });
      const body = await response.text();
      if (response.status === 200 && /Cortex/i.test(body)) {
        await ctx.receipt('demo-health', { status: 'PASS', url: `http://127.0.0.1:${session.ports.web}`, httpStatus: response.status, bodyBytes: Buffer.byteLength(body), marker: 'Cortex' });
        return;
      }
    } catch (error) { if (ctx.signal?.aborted) throw error; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('Demo health did not pass its startup deadline.');
}

export async function runLifecycle(session, ctx, services, options = {}) {
  let refreshTimer, refreshTask = null, launch, intentionalStop = false;
  const stage = async phase => { session.phase = phase; await ctx.persist(); ctx.signal?.throwIfAborted(); };
  try {
    await stage('PREFLIGHT'); await services.preflight(session, ctx);
    await stage('CREATING_CLOUD'); await services.createCloud(session, ctx);
    await stage('PROVISIONING_RUNTIME'); await services.verifyCloud(session, ctx); await services.provisionRuntime(session, ctx);
    await stage('CREATING_DOCKER'); await services.createDocker(session, ctx);
    await stage('CONFIGURING_APPS'); await services.configureApps(session, ctx);
    await services.refreshTokens(session, ctx);
    await stage('READY');
    if (options.copy) await sessionActionLock(session, () => services.copyToken(session, ctx, 'owner')).catch(error => {
      if (error.code !== 'SANDBOX_ACTION_BUSY') throw error;
      ctx.log(`Another local token action is active; copy the owner token with ./start-sandbox.sh copy-token ${session.id} owner.`);
    });
    ctx.log(formatHandoff(session));
    const refresh = () => { if (refreshTask || ctx.signal?.aborted) return;
      refreshTask = sessionActionLock(session, () => services.refreshTokens(session, ctx)).catch(error => {
        if (error.code === 'SANDBOX_ACTION_BUSY') return;
        options.abort?.(error); throw error;
      }).finally(() => { refreshTask = null; });
      // Keep a rejection handler immediately; finally below still observes the real outcome.
      refreshTask.catch(() => {}); };
    refreshTimer = setInterval(refresh, options.refreshEveryMs ?? 25 * 60_000); refreshTimer.unref();
    launch = services.launchDemo(session, ctx).catch(error => { if (!intentionalStop) throw error; });
    if (session.mode === 'smoke') {
      await services.awaitDemoHealth(session, ctx, launch);
      intentionalStop = true; await ctx.stopChildren(); await launch;
    } else await launch;
    return { status: 'SESSION_FINISHED', sessionId: session.id };
  } finally {
    if (refreshTimer) clearInterval(refreshTimer);
    await refreshTask?.catch(() => {});
    // runLifecycle settles all setup/refresh before the caller creates an uncanceled cleanup context.
  }
}
export function formatHandoff(session) {
  return `Sandbox ${session.id}: http://127.0.0.1:${session.ports.web}\nNew disposable DB: ${session.target.name}\nConnect with owner token (clipboard if available), then New chat.\nCleanup on exit/Ctrl-C; recovery: ./start-sandbox.sh cleanup ${session.id}\nRefresh: ./start-sandbox.sh refresh-tokens ${session.id}\nInteractive Basic chat: docker exec -it --workdir /work/basic ${session.container.name} npm start\nCLI help: docker exec --workdir /work/basic ${session.container.name} cortex --help`;
}

export async function copyToken(session, ctx, role) {
  if (!['owner', 'reader', 'outsider'].includes(role)) throw Error('Unknown credential role.');
  const file = path.join(session.secretsDir, `${role}.jwt`), stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== session.ownerUid || (stat.mode & 0o777) !== 0o600) throw Error('Unsafe credential file.');
  const token = (await fs.readFile(file, 'utf8')).trim(); ctx.registerSecret(token);
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw Error('Invalid local token file.');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  if (!Number.isSafeInteger(payload.exp) || payload.exp * 1000 <= Date.now()) throw Error('Local token expired; refresh-tokens this session first.');
  // Never put JWT into argv/environment or stdout. Clipboard is a local optional convenience.
  await ctx.command(`clipboard-${role}`, '/usr/bin/pbcopy', [], { input: token, timeoutMs: 10_000 });
  ctx.log(`Copied the ${role} token to the local clipboard; no token output.`);
  await ctx.receipt(`clipboard-${role}`, { status: 'COPIED', expiresAt: payload.exp * 1000 });
}

async function runtimeServices() {
  const cloud = await import('./cloud.mjs'), runtime = await import('./runtime.mjs');
  const { verifyProcedure } = await import('./qualification.mjs');
  return { ...cloud, ...runtime, createDocker, removeDocker, configureApps, launchDemo, awaitDemoHealth,
    copyToken: async (session, ctx, role) => { await copyToken(session, ctx, role).catch(error => ctx.log(`${error.message} Read the private ${role}.jwt file locally; never share it.`)); },
    preflight: async (session, ctx) => {
      if (process.version !== 'v24.15.0') throw Error('Pinned Node24.15.0 required.');
      const observed = await ctx.command('toolchain-npm', process.execPath, [ctx.npmCli, '--version']);
      if (observed.stdout.trim() !== '12.2.0') throw Error('Pinned npm12.2.0 required.');
      await preflightDocker(session, ctx);
      const approved = await verifyProcedure();
      await ctx.receipt('procedure-preflight', { status: 'APPROVED_PROCEDURE_HASHES_MATCH', digest: approved.digest, reviewSha256: approved.reviewSha256, maximumPaidRequests: approved.maximumPaidRequests, maximumUnknownLiabilityUnits: approved.maximumUnknownLiabilityUnits });
      session.ports = await selectPorts(); await ctx.persist();
    } };
}
function assertInactiveForCleanup(session) {
  if (session.launcherHost !== os.hostname()) throw Error('Recovery must run on the original host.');
  if (session.launcherPid && session.launcherPid !== process.pid) {
    try { process.kill(session.launcherPid, 0); throw Error('Original session launcher is active; exit it before cleanup.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
async function activeSession(session, ctx, services) {
  if (session.phase !== 'READY' || session.launcherHost !== os.hostname()) throw Error('Token actions require this host’s active READY session.');
  try { process.kill(session.launcherPid, 0); } catch { throw Error('Launcher is no longer active; recover cleanup instead.'); }
  await services.verifyCloud(session, ctx);
}

export async function sessionActionLock(session, operation, { waitMs = 0 } = {}) {
  if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 120_000) throw Error('Invalid session action-lock deadline.');
  await privateDirectory(session.runDir);
  const file = path.join(session.runDir, 'action-lock.sqlite');
  const created = await fs.open(file, 'wx', 0o600).catch(error => { if (error.code !== 'EEXIST') throw error; return null; });
  await created?.close();
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw Error('Unsafe session action lock.');
  // SQLite’s OS transaction lock releases on process death, without racy stale-file deletion.
  // The pinned Node24 builtin adds no dependency; this private lock stores no credentials.
  const { DatabaseSync } = await import('node:sqlite');
  const lock = new DatabaseSync(file); let acquired = false;
  try {
    lock.exec('PRAGMA busy_timeout=0');
    const deadline = Date.now() + waitMs;
    while (!acquired) {
      try { lock.exec('BEGIN IMMEDIATE'); acquired = true; }
      catch (error) {
        if (error.errcode !== 5 && error.errcode !== 6) throw error;
        if (Date.now() >= deadline) { const busy = Error('Another owned session action is active; wait for it to finish.'); busy.code = 'SANDBOX_ACTION_BUSY'; throw busy; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    return await operation();
  } finally { if (acquired) lock.exec('ROLLBACK'); lock.close(); }
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.action === 'help') { process.stdout.write(HELP); return 0; }
  if (options.action === 'dry-run') {
    process.stdout.write(HELP + `\nDry run: UUID private session → verified local image/archives → NEW approved Cortex dev DB → eight actual bounded qualifications → NEW Docker + installed canonical Basic/Vercel scaffolds → foreground demo → owned cleanup.\nNo resource, file, deployment or inference is created by this command.\nCandidate kit: ${KIT_NAME}\nPinned image: ${IMAGE_ID}\n`);
    return 0;
  }
  const services = await runtimeServices();
  if (options.action !== 'run') {
    const session = await loadSession(PROOFS_ROOT, options.id);
    const ctx = await createContext(session, { cleanup: options.action === 'cleanup' });
    await sessionActionLock(session, async () => {
      if (options.action === 'cleanup') { assertInactiveForCleanup(session); await cleanupSession(session, ctx, services); ctx.log(`Recovered sandbox ${session.id}: owned container and DB absent.`); }
      else { await activeSession(session, ctx, services); if (options.action === 'refresh-tokens') await services.refreshTokens(session, ctx); else await copyToken(session, ctx, options.role); }
    }, { waitMs: options.action === 'cleanup' ? 120_000 : 0 });
    return 0;
  }
  const session = await newSession(PROOFS_ROOT, options.mode);
  const controller = new AbortController(); let requestedSignal = null, primaryError = null, cleanupError = null;
  const onSignal = signal => { requestedSignal ??= signal; if (!controller.signal.aborted) controller.abort(Error(`Session interrupted by ${signal}.`)); };
  const onInt = () => onSignal('SIGINT'), onTerm = () => onSignal('SIGTERM'), onHup = () => onSignal('SIGHUP');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm); process.on('SIGHUP', onHup);
  const ctx = await createContext(session, { signal: controller.signal });
  ctx.log(`Creating fresh sandbox ${session.id}. Qualification has at most $2.70 unknown-cost liability; no automatic paid retries.`);
  try { await runLifecycle(session, ctx, services, { copy: options.copy, abort: error => controller.abort(error) }); }
  catch (error) { primaryError = error; ctx.log(`Session stopped: ${error.message}`); }
  finally {
    // The main setup has settled. Cleanup gets independent uncanceled commands, never races cloud creation.
    try { const cleanupCtx = await createContext(session, { cleanup: true }); await sessionActionLock(session, () => cleanupSession(session, cleanupCtx, { ...services, removeDocker: async (s, c) => { await ctx.stopChildren(); return services.removeDocker(s, c); } }), { waitMs: 120_000 }); }
    catch (error) { cleanupError = error; ctx.log(error.message); }
    process.off('SIGINT', onInt); process.off('SIGTERM', onTerm); process.off('SIGHUP', onHup);
  }
  if (!cleanupError) ctx.log(`Sandbox ${session.id} cleaned: owned Docker container and disposable Convex DB absent; receipts retained.`);
  return cleanupError ? 1 : requestedSignal === 'SIGINT' ? 130 : requestedSignal === 'SIGTERM' ? 143 : requestedSignal === 'SIGHUP' ? 129 : primaryError ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    const { redact } = createRedactor(); process.stderr.write(redact(error.message) + '\n'); process.exitCode = 1;
  });
}
