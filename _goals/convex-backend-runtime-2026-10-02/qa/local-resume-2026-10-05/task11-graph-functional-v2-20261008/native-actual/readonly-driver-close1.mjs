/** Exact read-only driver-close diagnostic. Each awaited stage <=2s; parent owns a <=15s process. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {openOwnedContext, root} from './common.mjs';
import {openOwnedBoltDelayProxy} from './bolt-delay-proxy.mjs';
const context = await openOwnedContext(), started = performance.now();
const neo4j = createRequire(join(root, 'package.json'))('neo4j-driver');
const config = context.graphCredentials.neo4j;
const stages = [], settlements = {};
let driver, session, tx, proxy;
const record = async (name, value) => {
  stages.push({name, elapsedMs: performance.now() - started, ...value});
  await context.publish('readonly-driver-close1-' + name, stages.at(-1));
  console.log(JSON.stringify(stages.at(-1)));
};
function observed(name, promise) {
  settlements[name] = {state: 'pending'};
  return Promise.resolve(promise).then(value => {settlements[name] = {state: 'fulfilled'}; return value;},
    error => {settlements[name] = {state: 'rejected', code: error?.code ?? error?.name}; return undefined;});
}
async function bound(name, promise) {
  let timer;
  try {
    const result = await Promise.race([promise.then(() => 'settled'), new Promise(resolve => {timer = setTimeout(() => resolve('pending-after-2000ms'), 2000);})]);
    await record(name, {result, settlements: structuredClone(settlements), maximumWaitMs: 2000});
  } finally {clearTimeout(timer);}
}
let receipt;
try {
  assert.equal(config.uri, 'bolt://127.0.0.1:51389');
  proxy = await openOwnedBoltDelayProxy({upstreamPort: 51389, marker: 'CortexRuntimeGraphScope', maximumDelayMs: 30000});
  driver = neo4j.driver(proxy.uri, neo4j.auth.basic(config.username, config.password), {maxConnectionPoolSize: 1,
    connectionTimeout: 2000, connectionAcquisitionTimeout: 2000, maxTransactionRetryTime: 0});
  session = driver.session();
  await session.run('RETURN 1 AS value', {}, {timeout: 2000});
  tx = await session.beginTransaction({timeout: 2000});
  proxy.arm();
  const run = observed('RUN', tx.run('RETURN 7 AS value /* CortexRuntimeGraphScope */'));
  await proxy.waitUntilHeld(2000);
  await record('held', {readOnlyQuery: 'RETURN 7 AS value /* CortexRuntimeGraphScope */', proxy: proxy.summary(), settlements: structuredClone(settlements)});
  const close = observed('driverClose', driver.close());
  await record('driver-close-issued', {settlements: structuredClone(settlements)});
  await bound('driver-close-settlement', close);
  await bound('original-run-settlement', run);
  const txClose = observed('txClose', tx.close());
  await record('tx-close-issued', {settlements: structuredClone(settlements)});
  await bound('tx-close-settlement', txClose);
  const sessionClose = observed('sessionClose', session.close());
  await record('session-close-issued', {settlements: structuredClone(settlements)});
  await bound('session-close-settlement', sessionClose);
  const proxyClose = observed('proxyClose', proxy.close());
  await record('proxy-close-issued', {settlements: structuredClone(settlements)});
  await bound('proxy-close-settlement', proxyClose);
  await bound('after-proxy-close', Promise.all([run, close, txClose, sessionClose]));
  receipt = {status: 'READONLY_DIAGNOSIS_CLOSED', version: 1, engine: 'neo4j', stages,
    settlements, proxy: proxy.summary(), graphWrites: 0, modelCalls: 0, maxStageWaitMs: 2000,
    unknownOriginalTimeoutNotRetried: true, rawProtocolOrCredentialsRecorded: false};
} catch (error) {
  receipt = {status: 'DIAGNOSTIC_SETUP_OR_BOUND_FAILURE', version: 1, stages, settlements,
    error: {name: error?.name, code: error?.code}, graphWrites: 0, modelCalls: 0};
  // The bounded owned parent kills any remaining handles if cleanup itself stalls.
  if (proxy) await bound('failure-proxy-close', observed('proxyClose', proxy.close()));
  if (driver) await bound('failure-driver-close', observed('driverClose', driver.close()));
  process.exitCode = 1;
} finally {
  await context.close(); receipt.elapsedMs = performance.now() - started;
  await context.publish('readonly-driver-close1', receipt);
  console.log(JSON.stringify({status: receipt.status, elapsedMs: receipt.elapsedMs, settlements, graphWrites: 0, modelCalls: 0}));
}
