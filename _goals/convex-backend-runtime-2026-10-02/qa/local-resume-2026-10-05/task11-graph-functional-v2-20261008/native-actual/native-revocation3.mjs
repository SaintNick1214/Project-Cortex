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
  await context.verifyTarget('native-revocation3-target-verified');
  assert.equal(JSON.parse(await readFile(join(q, 'native-core1-outcomes.json'))).status, 'ACTUAL_CORE_PASS');
  assert.equal(JSON.parse(await readFile(join(q,'native-late6-outcomes.json'))).status,'ACTUAL_LATE_WRITE_PASS');
  const setup=JSON.parse(await readFile(join(q,'setup-scopes1.json')));
  const text='Task11 current grant revocation must prevent stale remote restoration.';
  await context.owner.mutation(context.reference('facts:store'),{...scope,fact:text,factType:'knowledge',confidence:100,
    sourceType:'manual',tags:['task11-native-revocation'],entities:[],relations:[]});
  const initial=await inspect(),fact=initial.facts.find(row=>row.fact===text);assert.ok(fact&&!fact.tombstonedAt);
  let sourceId=fact.lineage.sourceId;
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
  async function applyCurrent(engine,label){
    const transport=transports.get(engine),prior=[];
    for(let n=0;n<32;n++){
      const work=await transport.claim({...scope,connectorId:'task11-'+engine,workerId:'task11-new-'+label+'-'+engine,leaseMs:30000});
      assert.ok(work,'Current revoked cleanup job must remain available');assert.equal(work.payload.operation,'tombstone');
      await transport.current(lease(work));const result=await direct.get(engine).apply(work);assert.ok(['applied','duplicate'].includes(result.state));
      await transport.complete({...lease(work),receipt:result});
      if(work.payload.source.sourceId===sourceId)return{work,result,priorCleanup:prior};
      prior.push({jobId:work.jobId,sourceId:work.payload.source.sourceId,revision:work.payload.revision});
    }throw Error('BOUNDED_REVOKED_TARGET_JOB_NOT_REACHED');
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
      await context.publish('native-revocation3-' + label + '-held-' + engine, {
        version: 1, stage: 'ACTUAL_FIRST_PROJECTION_RUN_HELD_BEFORE_REMOTE_LOCK', engine,
        lease: lease(work), leaseExpiresAt: work.leaseExpiresAt, revision: work.payload.revision,
        payloadHash: work.payloadHash, held, proxy: proxy.summary(), observedAt: Date.now(),
        rawPacketBytesRecorded: false});
      delayed.push({engine, proxy, oldConnector, transport, work, issued, held});
    }
    await new Promise(resolve=>setTimeout(resolve,3000));
    for(const row of delayed){const error=await denied(()=>row.transport.fail({...lease(row.work),outcome:'unknown'}));
      assert.equal(code(error),'GRAPH_LEASE_EXPIRED');}
    await newerMutation();
    const current = await inspect();
    const source = current.graphSources.find(row => row.sourceId === sourceId);
    assert.equal(source.operation, expectTombstone ? 'tombstone' : 'replace');
    const newReceipts = new Map();
    await Promise.all(['neo4j','memgraph'].map(async engine=>newReceipts.set(engine,await applyCurrent(engine,label))));
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
      assert.ok(['GRAPH_LEASE_EXPIRED', 'STALE_GRAPH_WORK','FORBIDDEN'].includes(code(obsolete)));
      if (late.receipt) {
        const deniedCompletion = await denied(() => row.transport.complete({...lease(row.work), receipt: late.receipt}));
        assert.ok(['GRAPH_LEASE_EXPIRED', 'STALE_GRAPH_WORK','FORBIDDEN'].includes(code(deniedCompletion)));
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
      outcomes.push(outcome); await context.publish('native-revocation3-' + label + '-' + row.engine, outcome);
      console.log(JSON.stringify({name: outcome.name, status: outcome.status, late: late.receipt?.state ?? late.error.code,
        elapsedMs: performance.now() - started}));
      await row.oldConnector.close(); await row.proxy.close();
    }
  }
  await delayedRace('owner-grant-revocation',()=>context.admin.mutation(context.reference('runtimeAuth:revokeGrant'),
    {grantId:setup.data.reference.grantId}),true);
  const sourceDenied=await denied(()=>context.owner.query(context.reference('runtimeGraph:status'),scope));
  assert.equal(code(sourceDenied),'FORBIDDEN');
  outcomes.push({name:'revoked-owner-current-core-denied',status:'PASS',code:code(sourceDenied)});
  await context.admin.mutation(context.reference('runtimeAuth:revokeGrant'),{grantId:setup.ownReader.reference.grantId});
  // Service cleanup remains authorized in its separate control scope after users are revoked.
  for(const engine of ['neo4j','memgraph']){
    let idle=false,completed=[];const transport=transports.get(engine);
    for(let n=0;n<48;n++){
      const work=await transport.claim({...scope,connectorId:'task11-'+engine,workerId:'task11-final-cleanup-'+engine,leaseMs:30000});
      if(!work){idle=true;break;}assert.equal(work.payload.operation,'tombstone');
      const result=await direct.get(engine).apply(work);assert.ok(['applied','duplicate'].includes(result.state));
      await transport.complete({...lease(work),receipt:result});completed.push({sourceId:work.payload.source.sourceId,revision:work.payload.revision,receipt:result});
    }assert.equal(idle,true);outcomes.push({name:'separate-service-control-drains-revoked-data-'+engine,status:'PASS',completed});
  }
  const after = await inspect(); await context.publish('native-revocation3-after', after);
  receipt = {status: 'ACTUAL_REVOCATION_PASS', version: 1, outcomes, modelCalls: 0,
    originalAlreadyIssuedNetworkPackets: true, noPacketContentOrCredentialsRecorded: true,
    currentOldLeaseCompletionDenied: true, priorFailure: "native-late3-outcomes.json", installedSource: "installed-current3-source-manifest.json", deadlineMs: 90000};
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
  await context.publish('native-revocation3-outcomes', receipt);
  console.log(JSON.stringify({status: receipt.status, groups: outcomes.length, modelCalls: 0, elapsedMs: receipt.elapsedMs}));
}
