import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';

// Execute only in the reviewed archive; packaging uses its own work directory.
mkdirSync(resolve('work'), { recursive: true });
const temporary = mkdtempSync(resolve('work/.cortex-metadata-contract-'));
try {
  const packResult = JSON.parse(execFileSync('npx', [
    '--yes', '--package=npm@12.2.0', '--', 'npm', 'pack',
    '--workspaces=false', '--ignore-scripts', '--json', '--pack-destination', temporary,
  ], { encoding: 'utf8' }));
  const packed = Array.isArray(packResult) ? packResult[0] : packResult['@cortexmemory/sdk'];
  assert.equal(typeof packed?.filename, 'string');
  const destination = join(temporary, 'node_modules/@cortexmemory/sdk');
  mkdirSync(destination, { recursive: true });
  execFileSync('tar', ['-xzf', join(temporary, packed.filename), '--strip-components=1', '-C', destination]);
  const entry = join(destination, 'dist/index.js');
  const esm = await import(pathToFileURL(entry));
  const cjs = createRequire(join(temporary, 'consumer.cjs'))('@cortexmemory/sdk');
  const safeReceipt = { updated: true, type: 'user', id: 'server-user', tenantId: 'tenant-a', memorySpaceId: 'space-a' };
  for (const sdk of [esm, cjs]) {
    const session = new sdk.SessionCapabilityError();
    assert.ok(session instanceof Error);
    assert.equal(session.code, 'BACKEND_MAINTENANCE_ONLY');
    assert.equal(session.retryable, false);
    assert.equal(session.outcome, 'not_dispatched');
    assert.equal(session.requiredExecution, 'trusted_backend_worker');
    const committed = new sdk.UserProfileWriteReceiptError({ ...safeReceipt, data: 'secret', cause: 'secret' });
    assert.ok(committed instanceof Error);
    assert.equal(committed.code, 'PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE');
    assert.equal(committed.retryable, false);
    assert.equal(committed.outcome, 'committed');
    assert.equal(committed.requiredCapability, 'read');
    assert.deepEqual(committed.receipt, safeReceipt);
    assert.equal(Object.isFrozen(committed.receipt), true);
    assert.equal('cause' in committed, false);
  }

  writeFileSync(join(temporary, 'consumer.ts'), `
import { UserProfileWriteReceiptError, UserValidationError, SessionCapabilityError, AuthValidationError, type Cortex, type UserProfile } from '@cortexmemory/sdk';
declare const cortex: Cortex;
const update: Promise<UserProfile> = cortex.users.update('user-a', { name: 'caller' });
const merge: Promise<UserProfile> = cortex.users.merge('user-a', {});
const create: Promise<UserProfile> = cortex.users.getOrCreate('user-a');
const bulk: Promise<{ updated: number; userIds: string[] }> = cortex.users.updateMany(['user-a'], { data: {} });
const expiration: Promise<{ expired: number }> = cortex.sessions.expireIdle();
const committed = new UserProfileWriteReceiptError({ updated: true, type: 'user', id: 'server-user', tenantId: 'tenant-a', memorySpaceId: 'space-a' });
const code: 'PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE' = committed.code;
const outcome: 'committed' = committed.outcome;
const capability: 'read' = committed.requiredCapability;
const updated: true = committed.receipt.updated;
const createdId: string | undefined = committed.receipt.createdId;
const space: string | undefined = committed.receipt.memorySpaceId;
const retryable: false = committed.retryable;
const session = new SessionCapabilityError();
const sessionCode: 'BACKEND_MAINTENANCE_ONLY' = session.code;
const sessionOutcome: 'not_dispatched' = session.outcome;
const execution: 'trusted_backend_worker' = session.requiredExecution;
const sessionRetry: false = session.retryable;
function handle(error: unknown) {
  if (error instanceof UserProfileWriteReceiptError) void error.receipt.id;
  if (error instanceof UserValidationError) void error.field;
  if (error instanceof SessionCapabilityError) void error.requiredExecution;
  if (error instanceof AuthValidationError) void error.field;
}
// @ts-expect-error A receipt never contains profile data.
committed.receipt.data;
// @ts-expect-error A receipt never fabricates a version.
committed.receipt.version;
// @ts-expect-error The server receipt is immutable.
committed.receipt.id = 'replacement';
// @ts-expect-error The committed write must not be replayed.
const retry: true = committed.retryable;
// @ts-expect-error The client does not report maintenance dispatch.
const dispatched: 'committed' = session.outcome;
void update; void merge; void create; void bulk; void expiration; void code; void outcome; void capability; void updated; void createdId; void space; void retryable; void sessionCode; void sessionOutcome; void execution; void sessionRetry; void handle; void retry; void dispatched;
`);
  const config = join(temporary, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    lib: ['ES2022', 'DOM'], types: [], strict: true, skipLibCheck: true, noEmit: true,
  }, files: ['consumer.ts'] }));
  execFileSync(resolve('node_modules/.bin/tsc'), ['--project', config], { stdio: 'inherit' });

  const bundle = await build({ entryPoints: [entry], platform: 'browser', bundle: true,
    format: 'iife', globalName: 'CortexSDK', write: false, metafile: true });
  const network = { fetchCalls: 0, socketSends: 0, syntheticSockets: 0 };
  class InertWebSocket {
    constructor() {
      network.syntheticSockets++;
      setTimeout(() => this.onclose?.({}), 0);
    }
    send() { network.socketSends++; throw new Error('Network dispatch forbidden'); }
    close() { this.onclose?.({}); }
  }
  const context = vm.createContext({
    crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, URLSearchParams,
    Headers, Response, Request, console, setTimeout, clearTimeout, setInterval, clearInterval,
    WebSocket: InertWebSocket,
    fetch: () => { network.fetchCalls++; throw new Error('Network dispatch forbidden'); },
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const browserOutcomes = await vm.runInContext(`(async () => {
    if (typeof process !== 'undefined' || typeof require !== 'undefined') throw Error('Node globals present');
    const cortex = new CortexSDK.Cortex({
      convexUrl: 'https://example.convex.cloud',
      auth: { userId: 'sdk-user', tenantId: 'tenant-a' },
      resilience: { enabled: true, retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false } },
    });
    const transport = { queries: 0, writes: 0, actions: 0 };
    const layer = cortex.getResilience();
    const execute = layer.execute.bind(layer);
    const attempts = [];
    layer.execute = (operation, name) => { attempts.push(name); return execute(operation, name); };
    // Public getClient() provides the real packed Convex client. Only its network
    // methods are replaced with a scoped transport fixture; real Cortex/Users/
    // Sessions APIs and enabled resilience operations remain in use.
    const client = cortex.getClient();
    client.query = async () => { transport.queries++; return null; };
    client.mutation = async () => {
      transport.writes++;
      return { updated: true, type: 'user', id: 'server-user', tenantId: 'tenant-a', memorySpaceId: 'space-a', createdId: 'server-created', data: 'private-server-payload' };
    };
    client.action = async () => { transport.actions++; throw Error('Unexpected action'); };
    try {
      let session;
      try { await cortex.sessions.expireIdle({ tenantId: 'tenant-a' }); } catch (error) { session = error; }
      if (!(session instanceof CortexSDK.SessionCapabilityError)) throw Error('Wrong session public identity');
      if (session.code !== 'BACKEND_MAINTENANCE_ONLY' || session.retryable !== false || session.outcome !== 'not_dispatched' || session.requiredExecution !== 'trusted_backend_worker') throw Error('Wrong session outcome');
      let mismatch;
      try { await cortex.sessions.expireIdle({ tenantId: 'tenant-b' }); } catch (error) { mismatch = error; }
      if (!(mismatch instanceof CortexSDK.AuthValidationError) || mismatch.code !== 'TENANT_SCOPE_MISMATCH') throw Error('Tenant validation changed');
      if (attempts.length !== 0 || transport.queries || transport.writes || transport.actions) throw Error('Session dispatched');
      let malformed;
      try { await cortex.users.update(' ', {}); } catch (error) { malformed = error; }
      if (!(malformed instanceof CortexSDK.UserValidationError)) throw Error('User validation changed');
      let committed;
      try { await cortex.users.update('caller-user', { secret: 'caller-payload' }); } catch (error) { committed = error; }
      if (!(committed instanceof CortexSDK.UserProfileWriteReceiptError)) throw Error('Wrong write public identity');
      if (committed.code !== 'PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE' || committed.outcome !== 'committed' || committed.retryable !== false || committed.requiredCapability !== 'read') throw Error('Wrong write outcome');
      const receipt = { updated: true, type: 'user', id: 'server-user', tenantId: 'tenant-a', memorySpaceId: 'space-a', createdId: 'server-created' };
      if (JSON.stringify(committed.receipt) !== JSON.stringify(receipt)) throw Error('Unsafe or fabricated receipt');
      if (!Object.isFrozen(committed.receipt) || 'cause' in committed) throw Error('Mutable receipt or cause');
      if (transport.queries !== 1 || transport.writes !== 1 || transport.actions !== 0 || attempts.join(',') !== 'users:get,users:update') throw Error('Extra read, write retry or action');
      return { sessionIdentity: true, writeIdentity: true, validationIdentity: true, receiptSafe: true, transport, attempts };
    } finally { await cortex.shutdown(); }
  })()`, context);
  assert.deepEqual(network, { fetchCalls: 0, socketSends: 0, syntheticSockets: 1 });
  const inputs = Object.keys(bundle.metafile.inputs);
  const forbidden = inputs.filter((path) => /convex-dev\/(?!_generated\/api\.js$)/.test(path));
  assert.deepEqual(forbidden, []);
  // Existing root exports load browser-compatible provider/graph packages. Their
  // presence does not indicate a model call or Node builtin; compare source input
  // graphs against the exact accepted baseline before certifying this boundary.
  const baselineRoot = resolve('../task03c2a-browser-baseline');
  const sourceGraphs = [];
  for (const sourceRoot of [baselineRoot, resolve('.')]) {
    const sourceBundle = await build({ entryPoints: [join(sourceRoot, 'src/index.ts')],
      platform: 'browser', bundle: true, write: false, metafile: true, format: 'esm' });
    const normalized = Object.keys(sourceBundle.metafile.inputs).map((input) => {
      const absolute = resolve(input);
      if (absolute.includes('/node_modules/')) return absolute.slice(absolute.indexOf('/node_modules/') + 1);
      return absolute.startsWith(sourceRoot + '/') ? absolute.slice(sourceRoot.length + 1) : absolute;
    }).sort();
    sourceGraphs.push(normalized);
  }
  assert.deepEqual(sourceGraphs[1], sourceGraphs[0]);
  assert.deepEqual(sourceGraphs[1].filter((input) => input.startsWith('convex-dev/')
    && input !== 'convex-dev/_generated/api.js'), []);
  assert.deepEqual(sourceGraphs[1].filter((input) => /^(node:|(?:fs|path|http|https|net|tls|child_process|worker_threads)$)/.test(input)), []);
  const existingBrowserPackages = sourceGraphs[1].filter((input) => /node_modules\/(?:openai|@anthropic-ai\/sdk|neo4j-driver)\//.test(input));
  if (process.env.CORTEX_METADATA_QA_OUTPUT) {
    writeFileSync(join(process.env.CORTEX_METADATA_QA_OUTPUT, 'browser-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
    writeFileSync(join(process.env.CORTEX_METADATA_QA_OUTPUT, 'browser-outcomes.json'), JSON.stringify({ node: process.version, npm: '12.2.0 scoped pack', network, browserOutcomes, forbiddenInputs: forbidden, baselineSourceInputs: sourceGraphs[0], candidateSourceInputs: sourceGraphs[1], sourceInputsIdentical: true, existingBrowserPackageInputCount: existingBrowserPackages.length }, null, 2) + '\n');
  }
  console.log('Packed ESM/CJS errors, strict DOM/types[] unchanged method contracts and public error literals, and real packed Cortex users/sessions methods in a browser VM passed.');
  console.log(JSON.stringify({ node: process.version, network, browserOutcomes, forbiddenInputs: forbidden, sourceInputsIdentical: true, existingBrowserPackageInputCount: existingBrowserPackages.length }));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
