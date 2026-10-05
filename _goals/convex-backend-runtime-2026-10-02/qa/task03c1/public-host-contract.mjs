import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const temporary = mkdtempSync(resolve('node_modules/.cortex-host-contract-'));
try {
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ name: 'cortex-host-contract-consumer', private: true, type: 'module' }));
  const pack = spawnSync('npm', ['pack', '--workspaces=false', '--ignore-scripts', '--json', '--pack-destination', temporary], { encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr);
  const packResult = JSON.parse(pack.stdout);
  const packed = Array.isArray(packResult) ? packResult[0] : packResult['@cortexmemory/sdk'];
  assert.equal(typeof packed?.filename, 'string', 'npm pack must return the SDK tarball filename');
  const destination = join(temporary, 'node_modules/@cortexmemory/sdk');
  mkdirSync(destination, { recursive: true });
  const extract = spawnSync('tar', ['-xzf', join(temporary, packed.filename), '--strip-components=1', '-C', destination]);
  assert.equal(extract.status, 0);
  const esm = await import(pathToFileURL(join(destination, 'dist/index.js')));
  const cjs = createRequire(join(temporary, 'consumer.cjs'))('@cortexmemory/sdk');
  for (const sdk of [esm, cjs]) {
    assert.equal(typeof sdk.HostCredentials, 'function');
    const credentials = new sdk.HostCredentials(async () => null);
    assert.equal(await credentials.fetchToken({ forceRefreshToken: true }), null);
    assert.deepEqual(await credentials.getAuthorizationHeaders(), {});
    assert.equal(typeof credentials.bindReactiveClient, 'function');
    assert.equal(typeof credentials.notifySessionChanged, 'function');
    assert.equal(typeof credentials.withHttpAuth, 'function');
  }
  const consumer = join(temporary, 'consumer.mts');
  writeFileSync(consumer, `
import { Cortex, HostCredentials, type CortexConfig, type HostTokenFetcher, type HostTokenRequest, type HostAuthFailure, type HostAuthErrorHandler } from '@cortexmemory/sdk';
const getter: HostTokenFetcher = async (request: HostTokenRequest) => request.forceRefreshToken ? null : 'header.payload.signature';
const onAuthError: HostAuthErrorHandler = async (failure: HostAuthFailure) => { void failure.code; void failure.attemptId; };
const config: CortexConfig = { convexUrl: 'https://example.convex.cloud', fetchAuthToken: getter, onAuthError };
function check() {
  const cortex = new Cortex(config);
  const credentials: HostCredentials | undefined = cortex.credentials;
  credentials?.notifySessionChanged();
  void credentials?.authFailure?.code;
}
// @ts-expect-error Host getter must return a Promise.
const synchronous: HostTokenFetcher = () => 'header.payload.signature';
// @ts-expect-error Host getter absence is null, never undefined.
const undefinedResult: HostTokenFetcher = async () => undefined;
// @ts-expect-error Tokens cannot be supplied as a static string.
const staticConfig: CortexConfig = { convexUrl: 'https://example.convex.cloud', fetchAuthToken: 'header.payload.signature' };
void check; void synchronous; void undefinedResult; void staticConfig;
`);
  const typecheck = spawnSync(resolve('node_modules/.bin/tsc'), ['--ignoreConfig', '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', consumer], { encoding: 'utf8' });
  if (typecheck.stdout) process.stdout.write(typecheck.stdout);
  if (typecheck.stderr) process.stderr.write(typecheck.stderr);
  assert.equal(typecheck.status, 0);
  console.log('Packed ESM/CJS HostCredentials exports and strict public constructor/host-getter types passed; no service calls.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
