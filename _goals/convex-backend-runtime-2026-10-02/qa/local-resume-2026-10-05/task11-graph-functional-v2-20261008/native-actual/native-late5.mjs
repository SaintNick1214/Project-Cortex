/** Focused successor: correct fact-deletion oracle plus genuine source tombstone race. Prior red immutable. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {openOwnedContext, denied, q, root} from './common.mjs';
import {openOwnedBoltDelayProxy} from './bolt-delay-proxy.mjs';

const signal = new AbortController();
const context = await openOwnedContext({signal: signal.signal});
const started = performance.now(), outcomes = [], ownedConnectors = [], proxies = [];
const timer = setTimeout(() => signal.abort(Error('TASK11_LATE_SUITE_DEADLINE')), 90000);
const scope = {tenantId: context.tenantId, memorySpaceId: context.memorySpaceId};
const inspect = () => context.admin.query(context.reference('graphNative:inspect'), scope);
const code = error => typeof error?.data === 'object' ? error.data.code : typeof error?.data === 'string' ? error.data : error?.code ?? error?.message;
const lease = value => Object.fromEntries(['tenantId', 'memorySpaceId', 'connectorId', 'jobId', 'workerId', 'leaseVersion'].map(key => [key, value[key]]));
let receipt;
try {
  await context.verifyTarget('native-late5-target-verified');
  assert.equal(JSON.parse(await readFile(join(q, 'native-core1-outcomes.json'))).status, 'ACTUAL_CORE_PASS');
  const initial = await inspect();
  const original = JSON.parse(await readFile(join(q, 'native-late3-source-race-identity.json')));
  original.fact = {factId: original.factId};
  const fact = initial.facts.find(row => row.factId === original.fact.factId);
  assert.ok(fact && !fact.tombstonedAt);
  assert.ok(initial.sources.find(row => row.lineage.sourceId === fact.lineage.sourceId && !row.tombstonedAt));
  let sourceId = fact.lineage.sourceId;
  const {CypherProjectionConnector, ConvexGraphWorkerTransport} = await import(pathToFileURL(join(context.host, 'task11-graph-runtime-entry.mjs')));
  const neo4j = createRequire(join(root, 'package.json'))('neo4j-driver');
  const transports = new Map();
  const direct = new Map();
  for (const engine of ['neo4j', 'memgraph']) {
    const connectorId = 'task11-' + engine;
    transports.set(engine, new ConvexGraphWorkerTransport({deploymentUrl: context.state.url,
      fetchToken: async s => {s.throwIfAborted(); signal.signal.throwIfAborted(); return context.token(context.fixture.workerSubject);}, timeoutMs: 10000}));
    const connector = new CypherProjectionConnector({...context.graphCredentials[engine], engine, ...scope, connectorId, timeoutMs: 30000});
    ownedConnectors.push(connector); await connector.connect(); direct.set(engine, connector);
  }
  async function remoteContent(engine) {
    const config = context.graphCredentials[engine];
    const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
      maxConnectionPoolSize: 1, connectionAcquisitionTimeout: 5000, maxTransactionRetryTime: 0});
    const session = driver.session();
    try {
      const result = await session.run('MATCH (n) WHERE n.scopeKey=$scopeKey AND n.sourceId=$sourceId AND (n:CortexRuntimeGraphFact OR n:CortexRuntimeGraphEntity) RETURN labels(n) AS labels, count(n) AS count', {
        scopeKey: JSON.stringify([scope.tenantId, scope.memorySpaceId]), sourceId}, {timeout: 5000});
      return result.records.map(row => ({labels: row.get('labels'), count: row.get('count').toNumber()}));
    } finally {await session.close(); await driver.close();}
  }
  async function applyCurrent(engine, label) {
    const transport = transports.get(engine);
    const work = await transport.claim({...scope, connectorId: 'task11-' + engine, workerId: 'task11-new-' + label + '-' + engine, leaseMs: 30000});
    assert.ok(work, 'Newer current job must be available'); assert.equal(work.payload.source.sourceId, sourceId);
    await transport.current(lease(work));
    const result = await direct.get(engine).apply(work);
    assert.equal(result.state, 'applied');
    await transport.complete({...lease(work), receipt: result});
    return {work, result};
  }
  async function delayedRace(label, newerMutation, expectTombstone) {
    signal.signal.throwIfAborted();
    // Each old work is claimed by the actual service boundary and started while its lease is current.
    const delayed = [];
    for (const engine of ['neo4j', 'memgraph']) {
      const proxy = await openOwnedBoltDelayProxy({upstreamPort: engine === 'neo4j' ? 51389 : 51397,
        marker: 'CortexRuntimeGraphScope', maximumDelayMs: 20000});
      proxies.push(proxy);
      const oldConnector = new CypherProjectionConnector({...context.graphCredentials[engine], uri: proxy.uri,
        engine, ...scope, connectorId: 'task11-' + engine, timeoutMs: 30000});
      ownedConnectors.push(oldConnector); await oldConnector.connect();
      const transport = transports.get(engine);
      const work = await transport.claim({...scope, connectorId: 'task11-' + engine,
        workerId: 'task11-old-' + label + '-' + engine, leaseMs: 1500});
      assert.ok(work); await transport.current(lease(work));
      assert.equal(work.payload.operation, 'replace');
      proxy.arm();
      let settled = false;
      const issued = oldConnector.apply(work).then(value => {settled = true; return {receipt: value};}, error => {settled = true; return {error: {code: code(error), name: error.name}};});
      const held = await proxy.waitUntilHeld(5000);
      assert.equal(settled, false);
      await context.publish('native-late5-' + label + '-held-' + engine, {
        version: 1, stage: 'ACTUAL_FIRST_PROJECTION_RUN_HELD_BEFORE_REMOTE_LOCK', engine,
        lease: lease(work), leaseExpiresAt: work.leaseExpiresAt, revision: work.payload.revision,
        payloadHash: work.payloadHash, held, proxy: proxy.summary(), observedAt: Date.now(),
        rawPacketBytesRecorded: false});
      delayed.push({engine, proxy, oldConnector, transport, work, issued, held});
    }
    // The backend owns lease expiry; host wall clocks and timer wakeups are not its authority.
    const waitStart=performance.now();
    for(const row of delayed){
      let expired=false;
      while(performance.now()-waitStart<10000){
        try{await row.transport.current(lease(row.work));}
        catch(error){assert.equal(code(error),'GRAPH_LEASE_EXPIRED');expired=true;break;}
        await new Promise(resolve=>setTimeout(resolve,100));
      }assert.equal(expired,true,'Bounded actual backend lease expiry');
    }
    await newerMutation();
    const current = await inspect();
    const source = current.graphSources.find(row => row.sourceId === sourceId);
    assert.equal(source.operation, expectTombstone ? 'tombstone' : 'replace');
    const newReceipts = new Map();
    for (const engine of ['neo4j', 'memgraph']) newReceipts.set(engine, await applyCurrent(engine, label));
    for (const row of delayed) {
      const newer = newReceipts.get(row.engine);
      assert.ok(newer.work.payload.revision > row.work.payload.revision);
      row.proxy.release();
      const late = await row.issued;
      if (late.receipt) {
        assert.equal(late.receipt.state, 'stale');
        assert.equal(late.receipt.currentRevision, newer.work.payload.revision);
      } else assert.equal(late.error.code, 'GRAPH_WRITE_FAILED_OR_UNKNOWN');
      // Never manufacture a success receipt when the server aborted the old transaction.
      const obsolete = await denied(() => row.transport.current(lease(row.work)));
      assert.ok(['GRAPH_LEASE_EXPIRED', 'STALE_GRAPH_WORK'].includes(code(obsolete)));
      if (late.receipt) {
        const deniedCompletion = await denied(() => row.transport.complete({...lease(row.work), receipt: late.receipt}));
        assert.ok(['GRAPH_LEASE_EXPIRED', 'STALE_GRAPH_WORK'].includes(code(deniedCompletion)));
      }
      const fence = await direct.get(row.engine).inspectSource(sourceId);
      assert.equal(fence.revision, newer.work.payload.revision);
      assert.equal(fence.payloadHash, newer.work.payloadHash);
      assert.equal(fence.tombstoned, expectTombstone);
      const content = await remoteContent(row.engine);
      if (expectTombstone) assert.equal(content.length, 0);
      else assert.ok(content.some(value => value.labels.includes('CortexRuntimeGraphFact') && value.count === 1));
      const outcome = {name: label + '-' + row.engine, status: 'PASS', heldFirstActualProjectionRun: row.held,
        oldLease: lease(row.work), oldExpiresAt: row.work.leaseExpiresAt, oldRevision: row.work.payload.revision,
        newer: {lease: lease(newer.work), revision: newer.work.payload.revision, receipt: newer.result},
        late, currentDenied: code(obsolete), finalFence: fence, remoteContentCounts: content,
        delay: row.proxy.summary(), rawPacketsRecorded: false};
      outcomes.push(outcome); await context.publish('native-late5-' + label + '-' + row.engine, outcome);
      console.log(JSON.stringify({name: outcome.name, status: outcome.status, late: late.receipt?.state ?? late.error.code,
        elapsedMs: performance.now() - started}));
      await row.oldConnector.close(); await row.proxy.close();
    }
  }
  assert.equal(JSON.parse(await readFile(join(q, 'deploy-current2.json'))).code, 0);
  // Existing source from failed atomic tombstone stays alive; a new explicit revision
  // supersedes closed old packets. No identical packet or uncertain write is retried.
  await context.owner.mutation(context.reference('facts:updateInPlace'), {memorySpaceId: scope.memorySpaceId,
    factId: fact.factId, fact: 'Task11 corrected native source tombstone uses authoritative expiry and prevents late restoration.'});
  await context.publish('native-late5-superseded-prior', {sourceId,
    priorFailure: 'native-late3-outcomes.json', current: (await inspect()).graphSources.find(row => row.sourceId === sourceId),
    oldHeldPacketsClosedNotRetried: true});
  await delayedRace('source-tombstone', () => context.admin.mutation(context.reference('runtimeAuth:tombstoneResource'), {
    ...scope, resourceType: 'source', resourceId: sourceId}), true);
  const currentDenied = await denied(() => context.owner.mutation(context.reference('runtimeGraph:requestExpansion'), {
    ...scope, sourceId, connectorId: 'task11-neo4j', requestId: 'source-tombstone-strict-no-delivery', limit: 5}));
  assert.equal(code(currentDenied), 'FORBIDDEN');
  outcomes.push({name: 'source-tombstone-current-reader-denied', status: 'PASS', sourceId,
    currentCode: code(currentDenied), modelCalls: 0});
  const after = await inspect(); await context.publish('native-late5-after', after);
  receipt = {status: 'ACTUAL_LATE_WRITE_PASS', version: 1, outcomes, modelCalls: 0,
    originalAlreadyIssuedNetworkPackets: true, noPacketContentOrCredentialsRecorded: true,
    currentOldLeaseCompletionDenied: true, priorFailure: "native-late3-outcomes.json", installedSource: "installed-current2-source-manifest.json", deadlineMs: 90000};
} catch (error) {
  receipt = {status: 'FAIL_OR_UNKNOWN', version: 1, outcomes, modelCalls: 0,
    error: context.publicError(error), noBlindRepeat: true}; process.exitCode = 1;
} finally {
  clearTimeout(timer);
  const cleanupErrors = [];
  // Close held proxies first on failure: never release an unqualified pending write during cleanup.
  for (const proxy of proxies) try {await proxy.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  for (const connector of ownedConnectors) try {await connector.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  try {await context.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  receipt.cleanupErrors = cleanupErrors; receipt.ownedConnectionsClosed = cleanupErrors.length === 0;
  receipt.elapsedMs = performance.now() - started;
  if (cleanupErrors.length) {receipt.status = 'FAIL_OR_UNKNOWN'; process.exitCode = 1;}
  await context.publish('native-late5-outcomes', receipt);
  console.log(JSON.stringify({status: receipt.status, groups: outcomes.length, modelCalls: 0, elapsedMs: receipt.elapsedMs}));
}
