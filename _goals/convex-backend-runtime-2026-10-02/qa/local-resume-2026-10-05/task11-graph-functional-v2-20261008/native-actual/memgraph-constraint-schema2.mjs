import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {openOwnedContext, root} from './common.mjs';

const context = await openOwnedContext();
const neo4j = createRequire(join(root, 'package.json'))('neo4j-driver');
const config = context.graphCredentials.memgraph;
const receipt = {version: 1, scope: 'READONLY_OWNED_MEMGRAPH_CONSTRAINT_METADATA',
  operation: context.pointer.operation, query: 'SHOW CONSTRAINT INFO', uri: config.uri,
  containerId: config.containerId, graphWrites: 0, modelCalls: 0,
  sessionClosed: false, driverClosed: false};
const started = performance.now();
let driver;
let session;
try {
  assert.equal(config.uri, 'bolt://127.0.0.1:51397');
  assert.equal(config.containerId, '3e15a768c3ab8715aadcd781a95ff7b49d3323b0b810df7735e3f4d4c035eaa8');
  const execute = promisify(execFile);
  const {stdout} = await execute('/usr/local/bin/docker', ['inspect', '--format',
    '{{json .Id}} {{json .State.Running}} {{json .Config.Labels}} {{json .HostConfig.PortBindings}}',
    config.containerId], {timeout: 5000, maxBuffer: 16384});
  assert.ok(stdout.startsWith(JSON.stringify(config.containerId) + ' true '));
  assert.ok(stdout.includes('"cortex.task":"11"'));
  assert.ok(stdout.includes('"cortex.owner":"backend-runtime-completion"'));
  assert.ok(stdout.includes('"HostIp":"127.0.0.1"'));
  receipt.verifiedOwnedRunningLoopbackTarget = true;
  driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
    maxConnectionPoolSize: 1, connectionAcquisitionTimeout: 5000,
    maxTransactionRetryTime: 0});
  session = driver.session({defaultAccessMode: neo4j.session.READ});
  const stream = session.run(receipt.query, {}, {timeout: 5000});
  receipt.columns = await stream.keys();
  const result = await stream;
  receipt.priorReceipt = 'memgraph-constraint-schema1.json';
  receipt.priorOmission = 'Awaited QueryResult does not expose keys; retained metadata-only success is incomplete for column discovery.';
  receipt.rows = result.records.map(record => record.toObject());
  receipt.rowCount = result.records.length;
  receipt.status = 'PASS';
} catch (error) {
  receipt.status = 'FAIL';
  receipt.error = {name: error?.name ?? 'unknown', code: error?.code ?? 'CONSTRAINT_METADATA_FAILED'};
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  if (session) try {await session.close(); receipt.sessionClosed = true;} catch (error) {cleanupErrors.push({name: error?.name});}
  if (driver) try {await driver.close(); receipt.driverClosed = true;} catch (error) {cleanupErrors.push({name: error?.name});}
  try {await context.close();} catch (error) {cleanupErrors.push({name: error?.name});}
  receipt.elapsedMs = performance.now() - started;
  receipt.cleanupErrors = cleanupErrors;
  if (cleanupErrors.length) {receipt.status = 'FAIL'; process.exitCode = 1;}
  await context.publish('memgraph-constraint-schema2', receipt);
  console.log(JSON.stringify({status: receipt.status, columns: receipt.columns,
    rows: receipt.rows, sessionClosed: receipt.sessionClosed, driverClosed: receipt.driverClosed,
    graphWrites: 0, modelCalls: 0}));
}
