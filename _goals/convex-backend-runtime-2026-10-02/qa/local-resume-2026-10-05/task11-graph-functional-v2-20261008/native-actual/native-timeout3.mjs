/** Actual silent first-RUN network delay, bounded connector close, durable retry. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext, q} from './common.mjs';
import {openOwnedBoltDelayProxy} from './bolt-delay-proxy.mjs';

const controller = new AbortController(), context = await openOwnedContext({signal: controller.signal});
const started = performance.now(), outcomes = [], connectors = [], proxies = [];
const timer = setTimeout(() => controller.abort(Error('TASK11_NATIVE_TIMEOUT_SUITE')), 60000);
const scope = {tenantId: context.tenantId, memorySpaceId: context.memorySpaceId};
const inspect = () => context.admin.query(context.reference('graphNative:inspect'), scope);
const lease = value => Object.fromEntries(['tenantId', 'memorySpaceId', 'connectorId', 'jobId', 'workerId', 'leaseVersion'].map(key => [key, value[key]]));
let receipt;
try {
  await context.verifyTarget('native-timeout3-target-verified');
  assert.equal(JSON.parse(await readFile(join(q, 'native-core1-outcomes.json'))).status, 'ACTUAL_CORE_PASS');
  const {CypherProjectionConnector, ConvexGraphWorkerTransport} = await import(pathToFileURL(join(context.host, 'task11-graph-runtime-entry.mjs')));
  assert.equal(JSON.parse(await readFile(join(q, 'deploy-current3.json'))).code, 0);
  const text = 'Task11 bounded silent RUN successor after independently owned rejection race repair.';
  await context.owner.mutation(context.reference('facts:store'), {...scope, fact: text,
    factType: 'knowledge', confidence: 100, sourceType: 'manual', tags: ['task11-timeout-successor'], entities: [], relations: []});
  const created = await inspect(), fact = created.facts.find(row => row.fact === text); assert.ok(fact);
  for (const engine of ['memgraph']) {
    const connectorId = 'task11-' + engine;
    const transport = new ConvexGraphWorkerTransport({deploymentUrl: context.state.url,
      fetchToken: async signal => {signal.throwIfAborted(); controller.signal.throwIfAborted(); return context.token(context.fixture.workerSubject);}});
    const proxy = await openOwnedBoltDelayProxy({upstreamPort: engine === 'neo4j' ? 51389 : 51397,
      marker: 'CortexRuntimeGraphScope', maximumDelayMs: 5000}); proxies.push(proxy);
    const old = new CypherProjectionConnector({...context.graphCredentials[engine], uri: proxy.uri,
      engine, ...scope, connectorId, timeoutMs: 3000}); connectors.push(old);
    await old.connect();
    const work = await transport.claim({...scope, connectorId, workerId: 'task11-timeout-old-' + engine, leaseMs: 10000});
    assert.ok(work); await transport.current(lease(work));
    proxy.arm(); const issuedAt = performance.now();
    const issued = old.apply(work).then(value => ({unexpectedReceipt: value}), error => ({error: {name: error.name, code: error.code}}));
    const held = await proxy.waitUntilHeld(1000);
    await context.publish('native-timeout3-held-' + engine, {stage: 'ACTUAL_FIRST_PROJECTION_RUN_HELD', engine,
      held, lease: lease(work), revision: work.payload.revision, deadlineMs: 3000, rawPacketBytesRecorded: false});
    console.log(JSON.stringify({stage: 'held', engine}));
    const failed = await issued, elapsedMs = performance.now() - issuedAt;
    assert.equal(failed.error?.code, 'GRAPH_WRITE_FAILED_OR_UNKNOWN');
    assert.ok(elapsedMs < 5000, 'Client timeout must reap silent native transaction without waiting server RUN');
    const summary = proxy.summary(); await proxy.close(); await old.close();
    const failedState = await transport.fail({...lease(work), outcome: 'unknown'});
    assert.equal(failedState.state, 'pending');
    const afterFailure = await inspect(), job = afterFailure.outbox.find(row => row.jobId === work.jobId);
    assert.equal(job.failureCode, 'GRAPH_WRITE_UNKNOWN'); assert.equal(job.attempt, 1);
    assert.equal(afterFailure.receipts.filter(row => row.jobId === work.jobId).length, 0);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, job.retryAt - Date.now() + 10)));
    const retry = await transport.claim({...scope, connectorId, workerId: 'task11-timeout-retry-' + engine, leaseMs: 30000});
    assert.equal(retry.jobId, work.jobId); assert.equal(retry.payloadHash, work.payloadHash);
    const direct = new CypherProjectionConnector({...context.graphCredentials[engine], engine, ...scope, connectorId});
    connectors.push(direct); await direct.connect();
    const result = await direct.apply(retry); assert.equal(result.state, 'applied');
    await transport.complete({...lease(retry), receipt: result});
    const outcome = {name: 'silent-actual-first-run-' + engine, status: 'PASS', connectorTimeoutMs: 3000,
      issuedAtLeaseCurrent: true, held, failed, elapsedMs, proxy: summary,
      alreadyIssuedOutcome: 'unknown, no remote success claimed', retrySameDurableJob: true,
      retryLeaseVersion: retry.leaseVersion, result, modelCalls: 0};
    outcomes.push(outcome); await context.publish('native-timeout3-' + engine, outcome);
    console.log(JSON.stringify({name: outcome.name, status: 'PASS', elapsedMs}));
  }
  // The new manual source also creates one ordinary Neo4j job; no second Neo timeout probe.
  const {CortexGraphWorker} = await import(pathToFileURL(join(context.host, 'task11-graph-runtime-entry.mjs')));
  const neo = new CypherProjectionConnector({...context.graphCredentials.neo4j,engine:'neo4j',...scope,connectorId:'task11-neo4j'}); connectors.push(neo);
  const nt = new ConvexGraphWorkerTransport({deploymentUrl:context.state.url,fetchToken:async signal=>{signal.throwIfAborted();return context.token(context.fixture.workerSubject);}});
  const nw = new CortexGraphWorker({...scope,connectorId:'task11-neo4j',workerId:'task11-timeout3-ordinary-neo4j',transport:nt,connector:neo});
  try {for(let i=0;i<24;i++){const v=await nw.step();if(v.kind==='idle')break;assert.equal(v.state,'complete');}} finally {await nw.close();}
  await context.publish('native-timeout3-after', await inspect());
  receipt = {status: 'ACTUAL_TIMEOUT_PASS', version: 1, outcomes, modelCalls: 0, deadlineMs: 60000};
} catch (error) {
  receipt = {status: 'FAIL_OR_UNKNOWN', version: 1, outcomes, error: context.publicError(error), noBlindRepeat: true, modelCalls: 0};
  process.exitCode = 1;
} finally {
  clearTimeout(timer); const cleanupErrors = [];
  for (const proxy of proxies) try {await proxy.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  for (const connector of connectors) try {await connector.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  try {await context.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  receipt.cleanupErrors = cleanupErrors; receipt.ownedConnectionsClosed = cleanupErrors.length === 0;
  receipt.elapsedMs = performance.now() - started;
  if (cleanupErrors.length) {receipt.status = 'FAIL_OR_UNKNOWN'; process.exitCode = 1;}
  await context.publish('native-timeout3-outcomes', receipt);
  console.log(JSON.stringify({status: receipt.status, groups: outcomes.length, modelCalls: 0, elapsedMs: receipt.elapsedMs}));
}
