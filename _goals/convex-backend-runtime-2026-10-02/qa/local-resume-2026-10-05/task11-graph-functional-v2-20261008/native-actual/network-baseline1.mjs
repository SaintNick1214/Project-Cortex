import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {openOwnedContext, root, q} from './common.mjs';

const context = await openOwnedContext();
const executeFile = promisify(execFile);
const load = createRequire(join(root, 'package.json'));
const neo4j = load('neo4j-driver');
const openedDrivers = new Set();
const started = performance.now();
const receipt = {version: 1, scope: 'READONLY_HOST_NODE_CONVEX_AND_OWNED_BOLT_NETWORK',
  operation: context.pointer.operation, node: process.version, projectId: context.state.projectId,
  deploymentName: context.state.deploymentName, services: [], graphWrites: 0, modelCalls: 0,
  task11WorkerAccepted: false};
try {
  await context.verifyTarget('network-baseline1-target-verified');
  const credentialPath = context.pointer.graphCredentials;
  assert.equal((await stat(credentialPath)).mode & 0o777, 0o600);
  const graphCredentials = JSON.parse(await readFile(credentialPath, 'utf8'));
  const original = JSON.parse(await readFile(join(q, '..', 'owned-service-start1.json'), 'utf8'));
  const nodes = await context.hostOwner.query(context.reference('host:authenticated'), {});
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, 'unrelated Task10 host sentinel');
  receipt.hostSentinelPreserved = true;
  receipt.authenticatedConvexHTTP = true;
  for (const service of original.services) {
    const config = graphCredentials[service.service];
    assert.equal(config.uri, service.uri);
    assert.equal(config.containerId, service.containerId);
    assert.ok(config.uri === 'bolt://127.0.0.1:51389' || config.uri === 'bolt://127.0.0.1:51397');
    const {stdout} = await executeFile('/usr/local/bin/docker', ['inspect', '--format',
      '{{json .Id}} {{json .State.Running}} {{json .Config.Labels}} {{json .HostConfig.PortBindings}}',
      service.containerId], {timeout: 5000, maxBuffer: 16384});
    // Only selected non-secret metadata is inspected; never inspect Docker Env or log protocol bytes.
    assert.ok(stdout.startsWith(JSON.stringify(service.containerId) + ' true '));
    assert.ok(stdout.includes('"cortex.goal":"convex-backend-runtime-2026-10-02"'));
    assert.ok(stdout.includes('"cortex.owner":"backend-runtime-completion"'));
    assert.ok(stdout.includes('"cortex.task":"11"'));
    assert.ok(stdout.includes('"HostIp":"127.0.0.1"'));
    const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
      maxConnectionPoolSize: 1, connectionAcquisitionTimeout: 5000, maxTransactionRetryTime: 0});
    openedDrivers.add(driver);
    const session = driver.session();
    try {
      const one = await session.run('RETURN 1 AS value', {}, {timeout: 5000});
      assert.equal(one.records[0].get('value').toNumber(), 1);
      const count = await session.run('MATCH (n) RETURN count(n) AS total', {}, {timeout: 5000});
      const nodeCount = count.records[0].get('total').toNumber();
      assert.equal(nodeCount, 0);
      receipt.services.push({service: service.service, uri: config.uri, containerId: service.containerId,
        exactOwnedRunningLoopbackTarget: true, authenticatedReturnOne: true, nodeCount,
        prospectiveEmptyBaseline: true, sessionClosed: false});
    } finally {
      await session.close();
      if (receipt.services.at(-1)?.service === service.service) receipt.services.at(-1).sessionClosed = true;
      await driver.close();
      openedDrivers.delete(driver);
    }
  }
  receipt.status = 'PASS';
} catch (error) {
  receipt.status = 'FAIL';
  // Errors are deliberately reduced to type/code; graph driver messages may contain credentials.
  receipt.error = {name: error?.name ?? 'unknown', code: error?.code ?? 'NETWORK_BASELINE_FAILED'};
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  for (const driver of openedDrivers) {
    try {await driver.close();} catch (error) {cleanupErrors.push({name: error?.name ?? 'unknown'});}
  }
  try {await context.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  receipt.elapsedMs = performance.now() - started;
  receipt.cleanupErrors = cleanupErrors;
  receipt.ownedClientsClosed = cleanupErrors.length === 0;
  receipt.credentialsPrinted = false;
  if (cleanupErrors.length) {receipt.status = 'FAIL'; process.exitCode = 1;}
  await context.publish('network-baseline1', receipt);
  console.log(JSON.stringify({status: receipt.status, services: receipt.services.length,
    graphWrites: 0, modelCalls: 0, ownedClientsClosed: receipt.ownedClientsClosed,
    elapsedMs: receipt.elapsedMs}));
}
