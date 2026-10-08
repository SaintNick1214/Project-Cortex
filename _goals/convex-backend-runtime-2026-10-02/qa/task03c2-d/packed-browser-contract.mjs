import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';

// Run from the reviewed snapshot. Scratch/package extraction stays in its own
// work directory, never in the symlinked shared node_modules or main dist.
mkdirSync(resolve('work'), { recursive: true });
const temporary = mkdtempSync(resolve('work/.cortex-governance-contract-'));
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
  for (const sdk of [esm, cjs]) {
    assert.equal(typeof sdk.GovernanceCapabilityError, 'function');
    assert.equal(typeof sdk.GovernanceValidationError, 'function');
    const error = new sdk.GovernanceCapabilityError();
    assert.ok(error instanceof Error);
    assert.equal(error.code, 'BACKEND_ENFORCEMENT_ONLY');
    assert.equal(error.retryable, false);
    assert.equal(error.outcome, 'not_dispatched');
    assert.equal(error.requiredExecution, 'trusted_backend_worker');
    assert.equal(error.enforcementAdapter, 'SIMULATION');
  }

  const consumer = join(temporary, 'consumer.ts');
  writeFileSync(consumer, `
import { GovernanceCapabilityError, GovernanceValidationError, type Cortex, type EnforcementResult } from '@cortexmemory/sdk';
declare const cortex: Cortex;
const request: Promise<EnforcementResult> = cortex.governance.enforce({ scope: { memorySpaceId: 'space-a' } });
const capability = new GovernanceCapabilityError();
const code: 'BACKEND_ENFORCEMENT_ONLY' = capability.code;
const retryable: false = capability.retryable;
const outcome: 'not_dispatched' = capability.outcome;
const requiredExecution: 'trusted_backend_worker' = capability.requiredExecution;
const adapter: 'SIMULATION' = capability.enforcementAdapter;
function handle(error: unknown) {
  if (error instanceof GovernanceCapabilityError) { void error.requiredExecution; }
  if (error instanceof GovernanceValidationError) { void error.field; }
}
// @ts-expect-error Client capability does not report automatic retention execution.
const real: 'RETENTION' = capability.enforcementAdapter;
// @ts-expect-error Unsupported requests are not retryable.
const retry: true = capability.retryable;
void request; void code; void retryable; void outcome; void requiredExecution; void adapter; void real; void retry; void handle;
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
      // Deliver a synthetic close after synchronous construction and rejection.
      // This lets the real client's graceful shutdown finish without a server.
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
  await vm.runInContext(`(async () => {
    if (typeof process !== 'undefined' || typeof require !== 'undefined') throw Error('Node globals unavailable');
    const cortex = new CortexSDK.Cortex({ convexUrl: 'https://example.convex.cloud', resilience: { enabled: false } });
    try {
      let capability;
      try { await cortex.governance.enforce({ scope: { memorySpaceId: 'space-a' } }); }
      catch (error) { capability = error; }
      if (!(capability instanceof CortexSDK.GovernanceCapabilityError)) throw Error('Wrong public error identity');
      if (capability.code !== 'BACKEND_ENFORCEMENT_ONLY' || capability.retryable !== false || capability.outcome !== 'not_dispatched') throw Error('Wrong dispatch outcome');
      if (capability.enforcementAdapter !== 'SIMULATION' || capability.requiredExecution !== 'trusted_backend_worker') throw Error('Wrong capability');
      let validation;
      try { await cortex.governance.enforce({}); } catch (error) { validation = error; }
      if (!(validation instanceof CortexSDK.GovernanceValidationError) || validation.code !== 'MISSING_SCOPE') throw Error('Validation changed');
    } finally { await cortex.shutdown(); }
  })()`, context);
  assert.deepEqual(network, { fetchCalls: 0, socketSends: 0, syntheticSockets: 1 });
  const inputs = Object.keys(bundle.metafile.inputs);
  assert.equal(inputs.some((path) => /convex-dev\/(governance|runtimeWorkerAuth|runtimeDataAuth|runtimeAuth|schema)\.ts$/.test(path)), false);
  if (process.env.CORTEX_GOVERNANCE_QA_OUTPUT) {
    writeFileSync(join(process.env.CORTEX_GOVERNANCE_QA_OUTPUT, 'browser-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  }
  console.log('Packed ESM/CJS capability exports, strict browser consumer declarations, and real packed Cortex governance rejection in a browser VM passed.');
  console.log(JSON.stringify({ node: process.version, npm: '12.2.0 scoped pack', network, backendImplementationsInBrowser: false }));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
