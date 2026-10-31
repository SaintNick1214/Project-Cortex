import {requireK27ReadyPins} from './k27-collector-pins.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, createSign, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadSession, createContext, PROOFS_ROOT } from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import { verifyCloud } from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';

const Q = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(PROOFS_ROOT, 'manual-sandbox-prompt-trust-2026-10-14');
const AUTH_MS = 4000, RPC_MS = 4000, MAX_EVENTS = 256;
const officialSourceHashes = Object.freeze({
  'src/browser/sync/authentication_manager.ts': '13fa5fa3d1f4c64e56f28777eb959d314e9698b51c3656edabcfc7fb8a15ecd6',
  'src/browser/sync/web_socket_manager.ts': '9312e27e093abacf79c1ce544861aaf9ae5ef027dc6463e56ea6c0522e7bdfb3',
  'src/browser/simple_client.ts': 'c9e5c1c2bebf7a91b6740ffb05207b6e42b76779f7d4a2496a21c2bfde51c9fe',
  'src/browser/logging.ts': '01f09107def1c9aa6038079a8b03f8e312c7d9b73df131a313ab724bc55c722e',
});
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const knownCodes = new Set(['UNAUTHENTICATED', 'AUTHENTICATION_TIMEOUT', 'AUTH_TOKEN_FETCH_FAILED', 'AUTH_REFRESHED', 'CLIENT_CLOSED',
  'FORBIDDEN', 'SESSION_CHANGED', 'AUTHORITY_EXPIRED', 'RPC_DEADLINE_EXCEEDED', 'TRANSPORT_ERROR', 'INVALID_RESPONSE',
  'DIAGNOSTIC_DEADLINE', 'DIAGNOSTIC_BLOCKED_PORT', 'DIAGNOSTIC_CLOSE_TIMEOUT']);
export function safeError(error) {
  const code = typeof error?.code === 'string' ? error.code : typeof error?.data?.code === 'string' ? error.data.code : undefined;
  const message = typeof error?.message === 'string' ? error.message : '';
  return { code: knownCodes.has(code) ? code : 'OTHER_ERROR', messageSha256: hash(message), messageBytes: Buffer.byteLength(message) };
}
function diagnosticError(code) { return Object.assign(new Error(code), { code }); }

/** Only known constant protocol classes survive. Never store logger arguments,
 * auth-state JSON (which includes a token suffix), raw errors or payloads. */
export function classifyOfficialLog(args) {
  const message = args.find(arg => typeof arg === 'string');
  if (message === undefined) return 'other';
  if (message === 'received ws message with type AuthError') return 'native_auth_error';
  if (message === 'received ws message with type Transition') return 'native_transition';
  if (message === 'received ws message with type FatalError') return 'native_fatal_error';
  if (message.startsWith('[CONVEX FATAL ERROR] ')) return 'official_fatal_error';
  if (message.startsWith('WebSocket error message: ')) return 'socket_error';
  if (message.startsWith('WebSocket closed with code ')) return 'socket_close_log';
  if (message.startsWith('WebSocket reconnected at')) return 'socket_reconnected';
  if (message.startsWith('attempting to reauthenticate: ')) return 'reauthentication_attempt';
  if (message.startsWith('ignoring non-auth token expired error')) return 'ignored_non_auth_expiry';
  if (message.startsWith('ignoring auth error for previous auth attempt')) return 'ignored_old_auth_error';
  if (message.startsWith('retrying reauthentication, ')) return 'reauthentication_retry';
  if (message.startsWith('reauthentication failed, could not fetch a new token')) return 'reauthentication_no_new_token';
  if (message.startsWith('Failed to authenticate: ')) return 'official_auth_failed';
  if (message.startsWith('server confirmed auth token is valid') || message.startsWith('server confirmed new auth token is valid')) return 'official_token_confirmed';
  if (message.startsWith('fetching token with config version ')) return 'official_token_fetch';
  if (message.startsWith('stale config version, ')) return 'official_stale_config';
  if (message === 'begin ws.onopen') return 'socket_open';
  if (message.startsWith('begin ws.onclose')) return 'socket_closed';
  if (message.startsWith('Attempting reconnect in ')) return 'socket_reconnect';
  if (message.startsWith('setting auth state to ')) {
    for (const state of ['noAuth', 'initialRefetch', 'waitingForServerConfirmationOfCachedToken', 'waitingForServerConfirmationOfFreshToken', 'notRefetching', 'waitingForScheduledRefetch']) {
      if (message.includes('"state":"' + state + '"')) return 'auth_state_' + state;
    }
  }
  return 'other';
}
/** Diagnostic-only public CloseEvent projection. Classes are lexical metadata,
 * never proof of authentication denial. Real close reasons are protocol bounded;
 * oversized synthetic values receive only a byte count, not a partial hash. */
export function safeCloseMetadata(event) {
  const code = event.code, reason = event.reason, wasClean = event.wasClean;
  const closeCode = Number.isSafeInteger(code) && code >= 0 && code <= 65535 ? code : null;
  if (typeof reason !== 'string') return { closeCode, wasClean: typeof wasClean === 'boolean' ? wasClean : null,
    reasonPresent: false, reasonClass: 'unavailable' };
  const reasonBytes = Buffer.byteLength(reason);
  if (reasonBytes > 1024) return { closeCode, wasClean: typeof wasClean === 'boolean' ? wasClean : null,
    reasonPresent: reason.length > 0, reasonBytes, reasonClass: 'over_bound' };
  const reasonClass = reason.length === 0 ? 'empty' : 'present';
  return { closeCode, wasClean: typeof wasClean === 'boolean' ? wasClean : null,
    reasonPresent: reason.length > 0, reasonBytes, reasonSha256: hash(reason), reasonClass,
    reasonMentionsAuth: /\b(?:auth|jwt|token|unauthenticated|forbidden)\b/i.test(reason),
    reasonMentionsExpiry: /\b(?:expired|expiration|expiry)\b/i.test(reason) };
}
/** Inherit the exact selected native constructor and its public EventTarget /
 * onclose APIs. One additional listener observes close; it never forwards,
 * suppresses, mutates or replaces a transport callback/event. */
export function createCloseCaptureWebSocket(Base, closed) {
  assert.equal(typeof Base, 'function', 'Original native WebSocket constructor required');
  assert.equal(typeof Base.prototype.addEventListener, 'function');
  assert.equal(typeof Base.prototype.removeEventListener, 'function');
  assert.equal(typeof closed, 'function');
  return class CloseCaptureWebSocket extends Base {
    constructor(...args) {
      super(...args);
      super.addEventListener('close', event => { try { closed(event); } catch { /* Diagnostics cannot affect transport. */ } });
    }
  };
}

export function authMetadata(now = () => performance.now()) {
  const startedAt = now(), events = [], counters = {}, officialAuth = [], sdkAuth = [];
  let forceRefreshCount = 0, fetchCount = 0, overflow = 0, nativeAuthErrorObserved = false, publicCloseCount = 0, closeMetadataReadFailures = 0;
  const add = (kind, scalar = {}) => { if (events.length < MAX_EVENTS) events.push({ kind, elapsedMs: now() - startedAt, ...scalar }); else overflow++; };
  const log = level => (...args) => {
    const classification = classifyOfficialLog(args);
    counters[classification] = (counters[classification] ?? 0) + 1;
    if (classification === 'native_auth_error') nativeAuthErrorObserved = true;
    if (classification !== 'other') add('official_log', { level, classification });
  };
  return {
    logger: { logVerbose: log('debug'), log: log('info'), warn: log('warn'), error: log('error') },
    closed(event) {
      publicCloseCount++;
      try { add('public_socket_close', { ...safeCloseMetadata(event), beforeAuthDeadline: now() - startedAt < AUTH_MS }); }
      catch { closeMetadataReadFailures++; }
    },
    fetched(forceRefreshToken) { assert.equal(typeof forceRefreshToken, 'boolean'); fetchCount++; if (forceRefreshToken) forceRefreshCount++; add('fetch_token', { forceRefreshToken }); },
    officialChanged(authenticated) { assert.equal(typeof authenticated, 'boolean'); if (officialAuth.length < MAX_EVENTS) officialAuth.push(authenticated); add('official_auth_callback', { authenticated }); },
    sdkChanged(authenticated) { assert.equal(typeof authenticated, 'boolean'); if (sdkAuth.length < MAX_EVENTS) sdkAuth.push(authenticated); add('sdk_auth_callback', { authenticated }); },
    rpc(method, phase) { assert.ok(['runtimeClient:session', 'runtimeMemory:defaultProfile'].includes(method)); add('rpc', { method, phase }); },
    elapsed() { return now() - startedAt; },
    snapshot() { return { events: events.map(event => ({ ...event })), loggerClassCounts: { ...counters }, fetchCount, forceRefreshCount,
      officialAuthChanges: [...officialAuth], sdkAuthChanges: [...sdkAuth], nativeAuthErrorObserved, droppedMetadataEvents: overflow, publicCloseCount, closeMetadataReadFailures }; },
  };
}
export function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    assert.ok(['--session', '--name', '--id', '--expires-at', '--source-commit', '--manifest-sha256', '--sdk-archive-sha256', '--image-id', '--owner-control'].includes(key), 'Unknown diagnostic argument');
    assert.ok(typeof value === 'string' && !Object.hasOwn(options, key), 'Each argument requires one value'); options[key] = value;
  }
  for (const name of ['--session', '--name', '--id', '--expires-at', '--source-commit', '--manifest-sha256', '--sdk-archive-sha256', '--image-id']) assert.ok(Object.hasOwn(options, name), 'Exact READY identity/pins required');
  assert.match(options['--session'], /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.match(options['--name'], /^[a-z]+(?:-[a-z]+)+-\d+$/); assert.match(options['--source-commit'], /^[a-f0-9]{40}$/);
  for (const key of ['--manifest-sha256', '--sdk-archive-sha256']) assert.match(options[key], /^[a-f0-9]{64}$/);
  assert.match(options['--image-id'], /^sha256:[a-f0-9]{64}$/);
  for (const key of ['--id', '--expires-at']) { assert.match(options[key], /^[1-9]\d*$/); assert.ok(Number.isSafeInteger(Number(options[key]))); }
  assert.ok(options['--owner-control'] === undefined || ['0', '1'].includes(options['--owner-control']));
  return { sessionId: options['--session'], name: options['--name'], id: Number(options['--id']), expiresAt: Number(options['--expires-at']),
    sourceCommit: options['--source-commit'], manifestSha256: options['--manifest-sha256'], sdkArchiveSha256: options['--sdk-archive-sha256'],
    imageId: options['--image-id'], ownerControl: options['--owner-control'] === '1' };
}
async function privateFile(filename) {
  const stat = await fs.lstat(filename);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0, 'Owned private regular file required');
  return fs.readFile(filename, 'utf8');
}
async function bound(work, ms, code) {
  let timer; try { return await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(diagnosticError(code)), ms); })]); }
  finally { clearTimeout(timer); }
}
async function context(options) {
  const pins = requireK27ReadyPins();
  assert.equal(options.sourceCommit, '6ce044425b7e52270cdf89cde0ea3a8fbb42f91a', 'K27 accepted source required');
  for (const [key, expected] of Object.entries({sessionId:pins.sessionId,name:pins.name,id:pins.targetId,expiresAt:pins.expiresAt,sourceCommit:pins.sourceCommit,imageId:pins.imageId,manifestSha256:pins.manifestSha256,sdkArchiveSha256:pins.sdkArchiveSha256})) assert.equal(options[key], expected, 'Exact K27 pending/READY pin guard required');
  const s = await loadSession(PROOFS_ROOT, options.sessionId), ctx = await createContext(s, { logger: () => {} });
  ctx.persist = async () => {}; ctx.receipt = async () => {};
  const managementFetch = ctx.fetch;
  ctx.fetch = (url, args = {}) => { assert.equal((args.method ?? 'GET').toUpperCase(), 'GET', 'Management mutation is forbidden'); return managementFetch(url, args); };
  function identity(current) {
    assert.equal(current.phase, 'READY'); assert.equal(current.id, options.sessionId);
    assert.equal(current.target.name, options.name); assert.equal(current.target.id, options.id);
    assert.equal(current.target.teamId, 325340); assert.equal(current.target.projectId, 3200658);
    assert.equal(current.target.reference, 'dev/cortex-sandbox-' + options.sessionId);
    assert.equal(current.target.deploymentUrl, 'https://' + options.name + '.convex.cloud');
    assert.equal(current.target.kind, 'cloud'); assert.equal(current.target.deploymentType, 'dev'); assert.equal(current.target.isDefault, false);
    assert.equal(current.target.disposable, true); assert.equal(current.target.expiresAt, options.expiresAt); assert.ok(options.expiresAt > Date.now());
    assert.equal(current.container.imageId, options.imageId); assert.equal(current.launcherPid, s.launcherPid); process.kill(current.launcherPid, 0);
  }
  let verificationCount = 0;
  async function verify() { identity(await loadSession(PROOFS_ROOT, options.sessionId)); identity(s); await verifyCloud(s, ctx); identity(s); verificationCount++; }
  await verify();
  const manifestPath = path.join(KIT, 'image/archives/manifest.json'), manifestBytes = await fs.readFile(manifestPath);
  assert.equal(hash(manifestBytes), options.manifestSha256); const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.sourceCommit, options.sourceCommit); assert.equal(manifest.node, '24.15.0'); assert.equal(manifest.npm, '12.2.0');
  const sdkArchive = manifest.packages.find(item => item.role === 'sdk'); assert.equal(sdkArchive.version, '0.39.0'); assert.equal(sdkArchive.sha256, options.sdkArchiveSha256);
  assert.equal(hash(await fs.readFile(path.join(KIT, 'image/archives', sdkArchive.filename))), options.sdkArchiveSha256);
  assert.equal((await fs.readFile(path.join(KIT, 'image-id.txt'), 'utf8')).trim(), options.imageId);
  const sdkPath = path.join(s.backendDir, 'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js');
  // Establish a prospective content baseline from the verified immutable archive.
  // Git/cleanup cannot restore an old staging directory or historical filesystem identity.
  const { stdout: archiveSdk } = await promisify(execFile)('/usr/bin/tar', ['-xOf', path.join(KIT, 'image/archives', sdkArchive.filename), 'package/dist/client-runtime/index.js'], { timeout: 30000, maxBuffer: 2 * 1024 * 1024, encoding: 'buffer' });
  const sdkSha256 = hash(await fs.readFile(sdkPath)); assert.equal(sdkSha256, hash(archiveSdk), 'Actual installed SDK must match pinned immutable archive');
  const sdkPackage = JSON.parse(await fs.readFile(path.join(s.backendDir, 'node_modules/@cortexmemory/sdk/package.json'))); assert.equal(sdkPackage.version, '0.39.0');
  const requireHost = createRequire(path.join(s.backendDir, 'package.json')), convexPackagePath = requireHost.resolve('convex/package.json');
  const convexRoot = path.dirname(convexPackagePath), convexPackage = JSON.parse(await fs.readFile(convexPackagePath)); assert.equal(convexPackage.version, '1.46.0');
  const authSources = ['src/browser/sync/authentication_manager.ts', 'src/browser/sync/web_socket_manager.ts', 'src/browser/simple_client.ts', 'src/browser/logging.ts'];
  const sourcePins = await Promise.all(authSources.map(async relative => ({ path: relative, sha256: hash(await fs.readFile(path.join(convexRoot, relative))) })));
  for (const pin of sourcePins) assert.equal(pin.sha256, officialSourceHashes[pin.path], 'Official diagnostic logger/callback source applicability changed');
  const { ConvexClient, ConvexHttpClient } = requireHost('convex/browser'); const { getFunctionName } = requireHost('convex/server');
  const { CortexRuntimeClient } = await import(pathToFileURL(sdkPath));
  const key = await privateFile(s.deploymentKeyPath); assert.ok(key.startsWith('dev:' + options.name + '|'));
  const admin = new ConvexHttpClient(s.target.deploymentUrl, { logger: false, fetch: async (url, args) => fetch(url, { ...args, redirect: 'error', signal: AbortSignal.timeout(30000) }) }); admin.setAdminAuth(key);
  const identities = JSON.parse(await privateFile(path.join(s.issuerDir, 'identities.json'))), owner = identities.owner;
  assert.ok(owner && owner.expiresAt > Date.now()); const signingKey = await privateFile(path.join(s.issuerDir, 'jwt-private.pem'));
  function token(expired) {
    const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    assert.ok(owner.expiresAt > Date.now());
    const unsigned = encode({ alg: 'RS256', typ: 'JWT', kid: 'sandbox-' + options.sessionId }) + '.' + encode({ iss: owner.issuer, sub: owner.subject,
      aud: 'cortex-sandbox-' + options.sessionId, iat: expired ? now - 3600 : now, exp: expired ? now - 60 : Math.min(now + 3600, Math.floor(owner.expiresAt / 1000)) });
    const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end(); return unsigned + '.' + signer.sign(signingKey).toString('base64url');
  }
  async function snapshot() {
    const names = ['runtimeAuthPrincipals', 'runtimeAuthMemberships', 'runtimeAuthScopes', 'runtimeAuthGrants', 'runtimeAuthTombstones',
      'runtimeRuns', 'runtimeRunOutbox', 'runtimeRunAttempts', 'runtimeAgentExecutions', 'runtimeAgentOperations', 'runtimeModelOperations', 'runtimeModelAttempts',
      'runtimeBudgetAccounts', 'runtimeMemorySources', 'facts', 'runtimeMemoryChunks', 'runtimeMemoryVectors', 'runtimeMemoryReceipts', 'runtimeMemoryVectorGenerations',
      'runtimeIngestionEvents', 'runtimeIngestionScopes', 'runtimeIngestionStages', 'runtimeIngestionJobs'];
    const result = { counts: {}, hashes: {}, financialSha256: undefined };
    for (const name of names) {
      await verify(); let value;
      try { value = await admin.query('_system/cli/tableData', { table: name, order: 'desc', paginationOpts: { cursor: null, numItems: 256 } }); }
      finally { await verify(); }
      assert.ok(Array.isArray(value.page) && value.isDone && value.page.length <= 256, 'Complete bounded metadata table required');
      result.counts[name] = value.page.length; result.hashes[name] = hash(value.page);
      if (name === 'runtimeBudgetAccounts') result.financialSha256 = hash(value.page.map(row => Object.fromEntries(['_id', 'kind', 'limitUnits', 'reservedUnits', 'settledUnits', 'uncertainUnits', 'activeConcurrency', 'version', 'cancelled'].filter(field => row[field] !== undefined).map(field => [field, row[field]]))));
    }
    return result;
  }
  async function runCase(name, jwt, expectedCode, control = false) {
    await verify(); const metadata = authMetadata(), httpStatuses = [];
    // Pinned Node 24.15 has a global native WebSocket. Official Convex 1.46
    // selects that same constructor when present; do not substitute ws/fallback.
    assert.equal(process.version, 'v24.15.0');
    const webSocketConstructor = createCloseCaptureWebSocket(globalThis.WebSocket, metadata.closed);
    const port = new ConvexClient(s.target.deploymentUrl, { logger: metadata.logger, verbose: true, unsavedChangesWarning: false, reportDebugInfoToConvex: false, webSocketConstructor });
    const setAuth = port.setAuth.bind(port), mutation = port.mutation.bind(port); const methods = [];
    port.setAuth = (fetchToken, onChange) => setAuth(fetchToken, authenticated => { metadata.officialChanged(authenticated); onChange?.(authenticated); });
    port.query = async () => { throw diagnosticError('DIAGNOSTIC_BLOCKED_PORT'); };
    port.action = async () => { throw diagnosticError('DIAGNOSTIC_BLOCKED_PORT'); };
    port.mutation = async (ref, args) => {
      const method = getFunctionName(ref); assert.ok(['runtimeClient:session', 'runtimeMemory:defaultProfile'].includes(method), 'Only original read-only mutation handlers are allowed');
      assert.deepEqual(Object.keys(args).sort(), ['memorySpaceId', 'tenantId']); assert.equal(args.tenantId, s.publicRuntime.tenantId); assert.equal(args.memorySpaceId, s.publicRuntime.memorySpaceId);
      await verify(); methods.push(method); metadata.rpc(method, 'begin');
      try { return await mutation(ref, args); } finally { metadata.rpc(method, 'end'); await verify(); }
    };
    let client, deliveredProtectedPayload = 0, error, profileDelivered = false, closed = false, sdkClosed = false, operationElapsedMs;
    try {
      client = new CortexRuntimeClient({ deploymentUrl: s.target.deploymentUrl, scope: { tenantId: s.publicRuntime.tenantId, memorySpaceId: s.publicRuntime.memorySpaceId }, client: port,
        authTimeoutMs: AUTH_MS, requestTimeoutMs: RPC_MS,
        fetch: async (url, args) => {
          assert.equal(new URL(String(url)).origin, new URL(s.target.deploymentUrl).origin);
          assert.equal(args.method, 'POST'); assert.equal(args.redirect, 'error');
          const request = JSON.parse(args.body);
          assert.equal(request.path, 'runtimeClient:session');
          const response = await fetch(url, args); httpStatuses.push(response.status); return response;
        }, fetchToken: async ({ forceRefreshToken }) => { metadata.fetched(forceRefreshToken); return jwt; },
        onAuthChange: authenticated => metadata.sdkChanged(authenticated) });
      // Same public SDK session/auth-ready boundary as the original K9 SDK
      // observation pre-session, without any observation/prompt/output read.
      const value = await bound(() => client.session(), AUTH_MS, 'DIAGNOSTIC_DEADLINE');
      assert.equal(value.tenantId, s.publicRuntime.tenantId); assert.equal(value.memorySpaceId, s.publicRuntime.memorySpaceId); deliveredProtectedPayload = 1;
      if (control) { const profile = await bound(() => client.getDefaultProfile(), RPC_MS * 3, 'DIAGNOSTIC_DEADLINE'); assert.equal(profile.version, 1); profileDelivered = true; }
    } catch (caught) { error = safeError(caught); }
    finally {
      operationElapsedMs = metadata.elapsed();
      try { await bound(async () => { try { if (client) { await client.close(); sdkClosed = true; } } finally { await port.close(); } }, 1500, 'DIAGNOSTIC_CLOSE_TIMEOUT'); closed = port.closed; }
      catch (caught) { error ??= safeError(caught); }
    }
    await verify();
    const verdict = control ? deliveredProtectedPayload === 1 && profileDelivered && !error && closed ? 'PASS' : 'FAIL'
      : deliveredProtectedPayload === 0 && error?.code === expectedCode && closed ? 'PASS' : 'FAIL';
    return { name, expectedCode, verdict, deliveredProtectedPayload, profileDelivered, observedError: error,
      authTimeoutMs: AUTH_MS, requestTimeoutMs: RPC_MS, operationElapsedMs, rpcMethods: methods, registrationKind: 'mutation; original read-only session/profile handler bodies',
      httpStatuses, denialOnlyProbeOptIn: true, ownership: { sdkClosed, suppliedOfficialConvexClientClosed: closed }, ...metadata.snapshot() };
  }
  return { s, verify, snapshot, runCase, token, verificationCount: () => verificationCount,
    sdkIdentity: { version: sdkPackage.version, sourceCommit: options.sourceCommit, installedEntrySha256: sdkSha256, archiveSha256: options.sdkArchiveSha256, convexVersion: convexPackage.version, sourcePins } };
}
// Shared exact-target/archive guards; importing this alias invokes no diagnostic.
export { context as createK27DiagnosticContext };
export async function main(argv) {
  assert.equal(process.env.CORTEX_K27_AUTH_GO, '1', 'Fresh exact READY auth qualification go required');
  const options = parseArgs(argv), result = { version: 2, qualificationOnly: true, denialOnlyHttpProbe: true, historicalWebSocketResultsUnchanged: true, expectedCodeGateUnchanged: true, authTimeoutMs: AUTH_MS,
    rawPrivatePayloadRetained: false, managementGetOnly: true, effectfulMutationsBlocked: true, actionsBlocked: true, paidCalls: 0, cases: [],
    historicalK9: { receipt: 'k9-native-negative-final-receipt.json', failuresPreserved: ['expired valid signature: AUTHENTICATION_TIMEOUT', 'invalid signature: AUTHENTICATION_TIMEOUT'], expectedCode: 'UNAUTHENTICATED' } };
  const receipt = path.join(Q, 'k27-auth-close-diagnostic-readonly-' + Date.now() + '-' + randomUUID() + '.json');
  try {
    const c = await context(options); result.target = { sessionId: options.sessionId, name: options.name, id: options.id, teamId: 325340, projectId: 3200658,
      reference: 'dev/cortex-sandbox-' + options.sessionId, expiresAt: options.expiresAt, sourceCommit: options.sourceCommit, imageId: options.imageId }; result.sdk = c.sdkIdentity;
    result.before = await c.snapshot();
    if (options.ownerControl) result.cases.push(await c.runCase('valid owner metadata control', c.token(false), null, true));
    result.cases.push(await c.runCase('expired valid signature', c.token(true), 'UNAUTHENTICATED'));
    const invalid = c.token(false).split('.'); invalid[2] = (invalid[2][0] === 'A' ? 'B' : 'A') + invalid[2].slice(1);
    result.cases.push(await c.runCase('invalid signature', invalid.join('.'), 'UNAUTHENTICATED'));
    result.after = await c.snapshot(); result.dataAndFinanceUnchanged = JSON.stringify(result.before) === JSON.stringify(result.after);
    result.freshVerifications = c.verificationCount(); result.verdict = result.dataAndFinanceUnchanged && result.cases.every(value => value.verdict === 'PASS') ? 'PASS' : 'FAIL';
  } catch (caught) { result.verdict = 'FAIL'; result.guardOrDiagnosticError = safeError(caught); }
  result.observedAt = new Date().toISOString();
  await fs.writeFile(receipt, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ receipt, verdict: result.verdict, cases: result.cases.map(value => ({ name: value.name, verdict: value.verdict, code: value.observedError?.code,
    operationElapsedMs: value.operationElapsedMs, deliveredProtectedPayload: value.deliveredProtectedPayload, nativeAuthErrorObserved: value.nativeAuthErrorObserved, forceRefreshCount: value.forceRefreshCount })), paidCalls: 0 }));
  return result.verdict === 'PASS' ? 0 : 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.slice(2).join(' ') === '--help') console.log('READ-ONLY public-close auth diagnostic. ROOT GO required on the next fresh owned READY target; no service call is authorized by preparation/help. Required paired args: --session UUID --name NAME --id ID --expires-at EPOCH_MS --source-commit SHA40 --manifest-sha256 SHA64 --sdk-archive-sha256 SHA64 --image-id sha256:SHA64 [--owner-control 0|1]. Original auth deadline4000ms and UNAUTHENTICATED expectations retained. No service calls for --help.');
  else { try { process.exitCode = await main(process.argv.slice(2)); } catch (caught) { console.log(JSON.stringify({ failed: true, diagnostic: safeError(caught), paidCalls: 0 })); process.exitCode = 1; } }
}
