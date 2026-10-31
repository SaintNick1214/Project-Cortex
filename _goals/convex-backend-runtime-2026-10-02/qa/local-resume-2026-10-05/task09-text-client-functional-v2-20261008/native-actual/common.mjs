import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { sign, createHash } from 'node:crypto';

export const qa = dirname(new URL(import.meta.url).pathname);
export const root = '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Ordinary owned disposable-fixture auth; no provider credential or model loop. */
export async function openOwnedContext() {
  const pointer = JSON.parse(await readFile(join(qa, 'fixture-pointer.json')));
  const handoff = JSON.parse(await readFile(pointer.retainedHandoff));
  assert.equal(handoff.status, 'RETAINED_OWNED_NOT_RETIRED');
  assert.equal(handoff.projectId, 3173328);
  assert.equal(handoff.deploymentName, 'vivid-warbler-703');
  assert.equal(handoff.production, false);
  assert.match(pointer.tenantId, /^task09-[a-f0-9-]+$/);
  const state = JSON.parse(await readFile(join(handoff.privateDirectory, 'state.json')));
  assert.equal(state.projectId, handoff.projectId);
  assert.equal(state.operation, handoff.operation);
  assert.equal(state.retired, undefined);
  const credentials = JSON.parse(await readFile(join(handoff.privateDirectory, 'credentials.json')));
  const auth = JSON.parse(await readFile(join(handoff.privateDirectory, 'auth.json')));
  const pem = await readFile(join(handoff.privateDirectory, 'jwt-private.pem'));
  const { ConvexHttpClient, ConvexClient } = await import(pathToFileURL(join(handoff.fixtureHost, 'node_modules/convex/dist/esm/browser/index.js')));
  const { makeFunctionReference } = await import(pathToFileURL(join(handoff.fixtureHost, 'node_modules/convex/dist/esm/server/index.js')));
  const secrets = new Set([credentials.adminKey, credentials.deployKey]);
  const clients = new Set();
  const redact = value => {
    let text = String(value);
    for (const secret of secrets) if (secret) text = text.replaceAll(secret, '[REDACTED]');
    return text;
  };
  const publicError = error => ({
    name: error?.name ?? 'unknown',
    message: redact(error?.message ?? String(error)).slice(0, 8000),
    ...(error?.data !== undefined ? { data: JSON.parse(redact(JSON.stringify(error.data))) } : {}),
  });
  async function publish(name, value) {
    assert.match(name, /^[a-z0-9][a-z0-9._-]*$/);
    await writeFile(join(qa, name + '.json'), redact(JSON.stringify(value, null, 2)) + '\n');
  }
  function token(subject, lifetimeSeconds = 7200) {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const raw = encode({ alg: 'RS256', kid: auth.kid, typ: 'JWT' }) + '.' + encode({
      iss: auth.issuer, sub: subject, aud: auth.applicationID, iat: now, exp: now + lifetimeSeconds,
    });
    const jwt = raw + '.' + sign('RSA-SHA256', Buffer.from(raw), pem).toString('base64url');
    secrets.add(jwt);
    return jwt;
  }
  function http(subject) {
    const client = new ConvexHttpClient(handoff.url, {
      logger: false,
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(90000) }),
    });
    if (subject) client.setAuth(token(subject));
    return client;
  }
  function reactive(subject, suppliedToken) {
    const client = new ConvexClient(handoff.url, { logger: false });
    client.setAuth(async options => {
      const jwt = suppliedToken ? await suppliedToken(options) : token(subject);
      if (jwt) secrets.add(jwt);
      return jwt;
    });
    clients.add(client);
    return client;
  }
  async function close() {
    const errors = [];
    for (const client of [...clients]) {
      clients.delete(client);
      try { await client.close(); } catch (error) { errors.push(publicError(error)); }
    }
    if (errors.length) throw new AggregateError(errors, 'Owned Task09 observers did not close');
  }
  async function verifyTarget(label) {
    const account = JSON.parse(await readFile(join(homedir(), '.convex/config.json')));
    const helper = await import(pathToFileURL(join(handoff.fixtureHost, 'node_modules/@cortexmemory/cli/dist/utils/init/development-target.js')));
    const verified = await helper.verifyDisposableDevelopmentTarget({
      teamId: handoff.teamId, projectId: handoff.projectId,
      deploymentName: handoff.deploymentName, deploymentUrl: handoff.url, disposable: true,
    }, account.accessToken);
    await publish(label, { target: verified.target, verifiedAt: verified.verifiedAt, production: false });
    return verified;
  }
  const admin = http();
  admin.setAdminAuth(credentials.adminKey);
  return {
    pointer, handoff, state, auth, credentials, host: handoff.fixtureHost, functionsDirectory: 'custom/backend', admin, token, http, reactive, close, publish,
    redact, publicError, verifyTarget, reference: makeFunctionReference,
    tenantId: pointer.tenantId, memorySpaceId: pointer.memorySpaceId,
    owner: http('cortex-owner'), foreign: http('foreign-user'), anonymous: http(),
  };
}

export async function denied(action) {
  try { await action(); throw Error('UNEXPECTED_ALLOWED'); }
  catch (error) { assert.notEqual(error.message, 'UNEXPECTED_ALLOWED'); return error; }
}

export async function waitUntil(label, observe, predicate, { timeoutMs = 120000, pollMs = 250 } = {}) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = await observe();
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw Error(label + ': deadline exceeded (' + timeoutMs + ' ms)');
}
