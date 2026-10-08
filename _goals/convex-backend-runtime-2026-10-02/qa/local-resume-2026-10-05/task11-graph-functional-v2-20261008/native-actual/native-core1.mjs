/** Invoke only after coherent product deployment. No inference or user graph transport. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext, denied, waitUntil, q} from './common.mjs';

const controller = new AbortController();
const context = await openOwnedContext({signal: controller.signal});
const started = performance.now();
const workers = [];
const outcomes = [];
const deadlineMs = 90000;
let timer;
const check = (name, values) => {controller.signal.throwIfAborted(); outcomes.push({name, status: 'PASS', ...values}); console.log(JSON.stringify({name, status: 'PASS', elapsedMs: performance.now() - started}));};
const scope = {tenantId: context.tenantId, memorySpaceId: context.memorySpaceId};
const inspect = () => context.admin.query(context.reference('graphNative:inspect'), scope);
const brief = value => Object.fromEntries(['facts', 'sources', 'connectors', 'graphSources', 'revisions', 'payloads', 'outbox', 'receipts', 'reads'].map(key => [key, value[key].length]));
const errorCode = error => typeof error?.data === 'object' ? error.data?.code : typeof error?.data === 'string' ? error.data : error?.message;
let receipt;
try {
  // Bound all ordinary calls; official HTTP calls and graph transactions have their own shorter bounds.
  timer = setTimeout(() => {controller.abort(Error('TASK11_NATIVE_CORE_DEADLINE')); process.exitCode = 1;}, deadlineMs);
  await context.verifyTarget('native-core1-target-verified');
  const setup = JSON.parse(await readFile(join(q, 'setup-scopes1.json'), 'utf8'));
  assert.equal(setup.status, 'PASS');
  const installed = JSON.parse(await readFile(join(q, 'installed-current1-source-manifest.json'), 'utf8'));
  const {CypherProjectionConnector, ConvexGraphWorkerTransport, CortexGraphWorker} = await import(pathToFileURL(join(context.host, 'task11-graph-runtime-entry.mjs')));
  for (const engine of ['neo4j', 'memgraph']) {
    await context.admin.mutation(context.reference('runtimeGraph:configureConnector'), {
      ...scope, connectorId: 'task11-' + engine, workerPrincipalId: setup.worker.reference.principalId,
      workerTenantId: setup.worker.reference.tenantId, workerMemorySpaceId: setup.worker.reference.memorySpaceId,
      enabled: true,
    });
  }
  const before = await inspect();
  assert.equal(before.facts.length, 0); assert.equal(before.outbox.length, 0);
  const rollback = await denied(() => context.owner.mutation(context.reference('graphNative:storeThenRollback'), {...scope, text: 'Task11 parent rollback must not commit'}));
  assert.equal(errorCode(rollback), 'FIXTURE_REQUESTED_PARENT_ROLLBACK');
  const afterRollback = await inspect();
  assert.deepEqual(brief(afterRollback), brief(before));
  check('real-parent-mutation-fact-source-outbox-rollback', {before: brief(before), after: brief(afterRollback), code: errorCode(rollback)});
  const forbidden = [];
  const identity = {...scope, connectorId: 'task11-neo4j', workerId: 'task11-core-worker'};
  for (const [name, client] of [['noJWT', context.anonymous], ['owner-not-service', context.owner], ['foreign-scope', context.foreign], ['control-user-not-service', context.operator]]) {
    const error = await denied(() => client.mutation(context.reference('runtimeGraph:claim'), identity));
    forbidden.push({name, code: errorCode(error)});
  }
  const workerClient = context.http(context.fixture.workerSubject);
  const badConnector = await denied(() => workerClient.mutation(context.reference('runtimeGraph:claim'), {...identity, connectorId: 'not-configured'}));
  const badScope = await denied(() => workerClient.mutation(context.reference('runtimeGraph:claim'), {...identity, tenantId: setup.foreign.reference.tenantId, memorySpaceId: setup.foreign.reference.memorySpaceId}));
  forbidden.push({name: 'wrong-connector', code: errorCode(badConnector)}, {name: 'wrong-data-scope', code: errorCode(badScope)});
  assert.equal((await inspect()).outbox.length, 0);
  check('current-exact-service-worker-authority-negatives', {denials: forbidden, remoteDispatches: 0});
  const created = await context.owner.mutation(context.reference('facts:store'), {...scope,
    fact: 'The Task11 project codeword is GRAPH_7c3504e9.', factType: 'knowledge', confidence: 100,
    sourceType: 'manual', tags: ['task11-native'], entities: [{name: 'Task11 project', type: 'project'}],
    relations: [{subject: 'Task11 project', predicate: 'codeword', object: 'GRAPH_7c3504e9'}],
  });
  const committed = await inspect();
  assert.equal(committed.facts.length, 1); assert.equal(committed.sources.length, 1);
  assert.equal(committed.graphSources.length, 1); assert.equal(committed.outbox.length, 2);
  const fact = committed.facts[0], source = committed.graphSources[0];
  assert.equal(fact.lineage.sourceId, source.sourceId);
  assert.equal(source.contentHash, committed.sources[0].contentHash);
  assert.ok(committed.outbox.every(row => row.state === 'pending' && row.attempt === 0 && row.revision === source.revision));
  await context.publish('native-core1-committed', {created, fact, source, outbox: committed.outbox, counts: brief(committed)});
  check('native-manual-fact-atomic-two-connector-outbox', {factId: fact.factId, sourceId: source.sourceId,
    revision: source.revision, jobs: committed.outbox.map(row => ({jobId: row.jobId, connectorId: row.connectorId, state: row.state}))});
  const notReady = await denied(() => context.owner.mutation(context.reference('runtimeGraph:requestExpansion'), {...scope,
    sourceId: source.sourceId, connectorId: 'task11-neo4j', requestId: 'before-ready', limit: 5}));
  assert.equal(errorCode(notReady), 'GRAPH_NOT_READY'); assert.equal((await inspect()).reads.length, 0);
  const app = context.reactive(context.fixture.ownerSubject);
  let observed = false;
  const unsubscribe = app.onUpdate(context.reference('runtimeGraph:status'), {...scope, sourceId: source.sourceId}, () => {observed = true;});
  await waitUntil('owned app subscriber before worker', async () => observed, Boolean, {timeoutMs: 10000});
  unsubscribe(); await context.closeReactive(app);
  check('strict-pending-denial-and-application-disconnected', {code: errorCode(notReady), appClosedBeforeWorkerDrain: true});
  const serviceOutcomes = [];
  for (const engine of ['neo4j', 'memgraph']) {
    const config = context.graphCredentials[engine];
    const connectorId = 'task11-' + engine;
    const transport = new ConvexGraphWorkerTransport({deploymentUrl: context.state.url,
      fetchToken: async signal => {signal.throwIfAborted(); controller.signal.throwIfAborted(); return context.token(context.fixture.workerSubject);}, timeoutMs: 10000});
    const connector = new CypherProjectionConnector({...config, engine, ...scope, connectorId, timeoutMs: 10000});
    let failConnectOnce = true;
    const ownedConnector = {connect: async () => {if (failConnectOnce) {failConnectOnce = false; throw Error('FIXTURE_PRE_DISPATCH_CONNECT_FAILURE');} await connector.connect();},
      apply: work => connector.apply(work), expand: work => connector.expand(work), close: () => connector.close()};
    const worker = new CortexGraphWorker({...scope, connectorId, workerId: 'task11-core-' + engine,
      transport, connector: ownedConnector, leaseMs: 30000});
    workers.push(worker);
    const failed = await worker.step();
    assert.equal(failed.state, 'failed'); assert.equal(failed.backendAcknowledged, true);
    const afterFailure = await inspect();
    const failedJob = afterFailure.outbox.find(row => row.connectorId === connectorId);
    assert.equal(failedJob.state, 'pending'); assert.equal(failedJob.attempt, 1);
    assert.equal(afterFailure.receipts.filter(row => row.connectorId === connectorId).length, 0);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, failedJob.retryAt - Date.now() + 10)));
    const completed = await worker.step();
    assert.equal(completed.state, 'complete'); assert.equal(completed.backendAcknowledged, true);
    const afterCompletion = await inspect();
    const job = afterCompletion.outbox.find(row => row.connectorId === connectorId);
    const recorded = afterCompletion.receipts.find(row => row.jobId === job.jobId);
    assert.equal(job.state, 'complete'); assert.equal(job.attempt, 2); assert.ok(recorded);
    const heldLease = {...scope, connectorId, jobId: job.jobId, workerId: job.workerId, leaseVersion: job.leaseVersion};
    const remoteReceipt = JSON.parse(recorded.receiptCanonical);
    const duplicate = await transport.complete({...heldLease, receipt: remoteReceipt});
    assert.equal(duplicate.duplicate, true);
    const conflict = await denied(() => transport.complete({...heldLease, receipt: {...remoteReceipt, payloadHash: '0'.repeat(64)}}));
    assert.equal(errorCode(conflict), 'IDEMPOTENCY_CONFLICT');
    const fence = await connector.inspectSource(source.sourceId);
    assert.equal(fence.revision, source.revision); assert.equal(fence.payloadHash, source.payloadHash); assert.equal(fence.tombstoned, false);
    serviceOutcomes.push({engine, failed, completed, attempt: job.attempt, duplicate, changedReceiptCode: errorCode(conflict), fence});
  }
  const projected = await inspect();
  assert.equal(projected.graphSources[0].state, 'complete'); assert.equal(projected.receipts.length, 2);
  const status = await context.owner.query(context.reference('runtimeGraph:status'), {...scope, sourceId: source.sourceId});
  assert.equal(status.state, 'complete');
  check('both-native-services-backend-retry-and-dedup', {services: serviceOutcomes, receiptCount: 2,
    applicationDisconnected: true, noModelCalls: true});
  for (const [index, engine] of ['neo4j', 'memgraph'].entries()) {
    const connectorId = 'task11-' + engine, requestId = 'native-expansion-' + engine;
    const queued = await context.owner.mutation(context.reference('runtimeGraph:requestExpansion'), {...scope,
      sourceId: source.sourceId, connectorId, requestId, limit: 5});
    assert.equal(queued.state, 'pending');
    const drained = await workers[index].step(); assert.equal(drained.kind, 'expansion'); assert.equal(drained.state, 'complete');
    const result = await context.owner.query(context.reference('runtimeGraph:expansion'), {...scope, requestId});
    assert.equal(result.state, 'complete'); assert.ok(result.facts.some(row => row.factId === fact.factId && row.text === fact.fact));
    check('native-' + engine + '-expansion-core-current-rehydration', {requestId, result});
  }
  const after = await inspect();
  await context.publish('native-core1-after', after);
  receipt = {status: 'ACTUAL_CORE_PASS', version: 1, operation: context.pointer.operation,
    installedManifest: installed.manifestSha256 ?? installed.sha256, outcomes, deadlineMs,
    elapsedMs: performance.now() - started, modelCalls: 0, serviceFailureInjection: 'pre-dispatch connector.connect once per engine; real Core fail/reclaim and actual service apply',
    broaderLateWriteAndCleanupPending: true};
} catch (error) {
  receipt = {status: 'FAIL_OR_UNKNOWN', version: 1, operation: context.pointer.operation, outcomes,
    error: context.publicError(error), elapsedMs: performance.now() - started, modelCalls: 0,
    noBlindRepeat: true};
  process.exitCode = 1;
} finally {
  if (timer) clearTimeout(timer);
  const cleanupErrors = [];
  for (const worker of workers) try {await worker.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  try {await context.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  receipt.ownedWorkerAndClientsClosed = cleanupErrors.length === 0; receipt.cleanupErrors = cleanupErrors;
  receipt.totalElapsedMs = performance.now() - started;
  if (cleanupErrors.length) {receipt.status = 'FAIL_OR_UNKNOWN'; process.exitCode = 1;}
  await context.publish('native-core1-outcomes', receipt);
  console.log(JSON.stringify({status: receipt.status, groups: outcomes.length, modelCalls: 0, totalElapsedMs: receipt.totalElapsedMs}));
}
