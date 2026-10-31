import assert from 'node:assert/strict';
import { readFile, writeFile, chmod, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { openOwnedContext } from './common.mjs';

const c = await openOwnedContext();
try {
  const host = JSON.parse(await readFile(new URL('./host-final-readback.json', import.meta.url)));
  assert.equal(host.status, 'PASS'); assert.equal(host.target, 3172114);
  await c.verifyTarget('retirement-target-verified');
  await c.close();
  const account = JSON.parse(await readFile(join(homedir(), '.convex/config.json'), 'utf8'));
  const api = async (method, path) => {
    const response = await fetch('https://api.convex.dev' + path, {
      method, headers: { Authorization: 'Bearer ' + account.accessToken, 'Content-Type': 'application/json', 'Convex-Client': 'npm-cli-1.46.0' },
      signal: AbortSignal.timeout(30_000),
    });
    let data; try { data = await response.json(); } catch { data = null; }
    return { status: response.status, data };
  };
  const current = await api('GET', '/v1/projects/3172114');
  assert.equal(current.status, 200); assert.equal(current.data?.id, c.state.projectId);
  assert.equal(current.data?.slug, c.state.projectSlug);
  const deleted = await api('POST', '/v1/projects/3172114/delete');
  await c.publish('retirement-delete', { operation: c.state.operation, projectId: 3172114,
    projectSlug: c.state.projectSlug, deletionHttpStatus: deleted.status, at: new Date().toISOString(), ownedOnly: true });
  assert.equal(deleted.status, 200);
  const absent = await api('GET', '/v1/projects/3172114');
  await c.publish('retirement', { operation: c.state.operation, projectId: 3172114, deploymentName: c.state.deploymentName,
    readbackHttpStatus: absent.status, retired: absent.status === 404, retainedForNextTask: false,
    productionMutations: 0, at: new Date().toISOString() });
  assert.equal(absent.status, 404);
  const statePath = join(c.pointer.privateDirectory, 'state.json');
  await writeFile(statePath, JSON.stringify({ ...c.state, retired: true, retiredByTask: '07', retiredAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 });
  await chmod(statePath, 0o600);
  const removed = [];
  for (const name of ['credentials.json', 'jwt-private.pem', 'auth.json', 'project/.env.local']) {
    const path = join(c.pointer.privateDirectory, name);
    try { const info = await stat(path); assert.ok(info.isFile()); await unlink(path); removed.push(name); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await c.publish('owned-local-cleanup', { status: 'PASS', privateDirectory: c.pointer.privateDirectory,
    exactOwnedCredentialFilesRemoved: removed, reactiveClientsClosed: true, deploymentChildrenClosed: true,
    hostSnapshotRetainedWithoutActiveCredentials: true, noForeignFilesChanged: true });
  console.log(JSON.stringify({ status: 'PASS', projectId: 3172114, deletionHttpStatus: 200, readbackHttpStatus: 404, credentialsRemoved: removed.length }));
} finally { await c.close(); }
