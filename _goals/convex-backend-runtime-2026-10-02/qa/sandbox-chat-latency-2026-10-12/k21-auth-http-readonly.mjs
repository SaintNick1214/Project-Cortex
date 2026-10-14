/** Official HTTP authentication comparison. Session handler is read-only; no inference. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, createSign } from 'node:crypto';
import { K21_PINS, requireK21ReadyPins } from './k21-collector-pins.mjs';
import { loadSession, createContext, PROOFS_ROOT } from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import { verifyCloud } from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';

requireK21ReadyPins();
const session = await loadSession(PROOFS_ROOT, K21_PINS.sessionId);
const exact = value => {
  assert.equal(value.phase, 'READY');
  assert.equal(value.id, K21_PINS.sessionId);
  assert.equal(value.target.name, K21_PINS.name);
  assert.equal(value.target.id, K21_PINS.targetId);
  assert.equal(value.target.teamId, 325340);
  assert.equal(value.target.projectId, 3200658);
  assert.equal(value.target.isDefault, false);
  assert.equal(value.target.reference, 'dev/cortex-sandbox-' + value.id);
  assert.equal(value.target.expiresAt, K21_PINS.expiresAt);
  assert.ok(value.target.expiresAt > Date.now());
  assert.equal(value.container.imageId, K21_PINS.imageId);
};
exact(session);
const prepared = JSON.parse(await fs.readFile(path.join(session.receiptDir, 'host-prepared.json')));
assert.equal(prepared.sourceCommit, K21_PINS.sourceCommit);
const ctx = await createContext(session, { logger: () => {} });
ctx.persist = async () => {};
ctx.receipt = async () => {};
const managementFetch = ctx.fetch;
ctx.fetch = (url, options = {}) => { assert.equal((options.method ?? 'GET').toUpperCase(), 'GET'); return managementFetch(url, options); };
await verifyCloud(session, ctx);
const identities = JSON.parse(await fs.readFile(path.join(session.issuerDir, 'identities.json')));
const privateKey = await fs.readFile(path.join(session.issuerDir, 'jwt-private.pem'));
const identity = identities.owner;
const scope = { tenantId: identity.tenantId, memorySpaceId: identity.memorySpaceId };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const signedToken = expired => {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = encode({ alg: 'RS256', typ: 'JWT', kid: 'sandbox-' + session.id }) + '.' + encode({ iss: identity.issuer, sub: identity.subject, aud: 'cortex-sandbox-' + session.id, iat: expired ? now - 7200 : now, exp: expired ? now - 3600 : Math.min(now + 3600, Math.floor(identity.expiresAt / 1000)) });
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  return unsigned + '.' + signer.sign(privateKey).toString('base64url');
};
const valid = signedToken(false);
const parts = valid.split('.');
const signature = Buffer.from(parts[2], 'base64url'); signature[0] ^= 1;
const invalid = parts[0] + '.' + parts[1] + '.' + signature.toString('base64url');
const { ConvexHttpClient } = createRequire(path.join(session.backendDir, 'package.json'))('convex/browser');
const cases = [];
for (const [name, token, expected] of [['valid-owner', valid, 'ACCEPT'], ['expired-signed', signedToken(true), 'REFUSE'], ['invalid-signature', invalid, 'REFUSE'], ['no-token', null, 'REFUSE']]) {
  exact(await loadSession(PROOFS_ROOT, session.id)); await verifyCloud(session, ctx);
  const httpStatuses = [];
  const client = new ConvexHttpClient(session.target.deploymentUrl, { logger: false, fetch: async (url, options) => {
    const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(4000), ...(options?.signal ? [options.signal] : [])]) });
    httpStatuses.push(response.status); return response;
  } });
  if (token) client.setAuth(token);
  const started = performance.now();
  let observed = 'REFUSE', errorMetadata, protectedPayloads = 0;
  try {
    const result = await client.mutation('runtimeClient:session', scope);
    assert.equal(result.tenantId, scope.tenantId);
    assert.equal(result.memorySpaceId, scope.memorySpaceId);
    protectedPayloads = 1; observed = 'ACCEPT';
  } catch (error) {
    const message = String(error?.message ?? error);
    errorMetadata = { code: typeof error?.data?.code === 'string' ? error.data.code : null, name: error?.name, messageSha256: createHash('sha256').update(message).digest('hex'), messageBytes: Buffer.byteLength(message), mentionsAuthentication: /authenticat|JWT|token|signature/i.test(message), timeout: /timeout|timed out|abort/i.test(message) };
  }
  cases.push({ name, expected, observed, passed: observed === expected && (expected === 'ACCEPT' || (!errorMetadata.timeout && (httpStatuses.includes(401) || errorMetadata.code === 'UNAUTHENTICATED'))), elapsedMs: performance.now() - started, httpStatuses, protectedPayloads, errorMetadata });
  client.clearAuth();
}
const receipt = { observedAt: new Date().toISOString(), transport: 'official ConvexHttpClient', target: { sessionId: session.id, name: session.target.name, id: session.target.id, sourceCommit: K21_PINS.sourceCommit }, cases, paidCalls: 0, productMutations: 0, rawTokenOrRemoteMessagesRetained: false, websocketFailureReclassified: false, passed: cases.every(row => row.passed) };
const output = path.join(path.dirname(new URL(import.meta.url).pathname), 'k21-auth-http-readonly-' + Date.now() + '.json');
await fs.writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ receipt: output, passed: receipt.passed, cases: cases.map(({ name, passed, httpStatuses, protectedPayloads }) => ({ name, passed, httpStatuses, protectedPayloads })) }));
if (!receipt.passed) process.exitCode = 1;
