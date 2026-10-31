/** Meaningful native retry exhaustion; the fault is pre-dispatch, no fabricated success. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext, denied, q} from './common.mjs';

const controller = new AbortController(), context = await openOwnedContext({signal: controller.signal});
const started = performance.now(), outcomes = [], workers = [];
const timer = setTimeout(() => controller.abort(Error('TASK11_EXHAUSTION_DEADLINE')), 60000);
const scope = {tenantId: context.tenantId, memorySpaceId: context.memorySpaceId};
const inspect = () => context.admin.query(context.reference('graphNative:inspect'), scope);
let receipt;
try {
  await context.verifyTarget('native-exhaustion2-target-verified');
  assert.equal(JSON.parse(await readFile(join(q, 'native-late6-outcomes.json'))).status, 'ACTUAL_LATE_WRITE_PASS');
  const {ConvexGraphWorkerTransport, CortexGraphWorker} = await import(pathToFileURL(join(context.host, 'task11-graph-runtime-entry.mjs')));
  await context.owner.mutation(context.reference('facts:store'), {...scope, fact: 'Task11 deliberate projection exhaustion must remain visibly failed.',
    factType: 'knowledge', confidence: 100, sourceType: 'manual', tags: ['task11-native-exhaustion'], entities: [], relations: []});
  const initial = await inspect(), fact = initial.facts.find(row => row.fact === 'Task11 deliberate projection exhaustion must remain visibly failed.');
  assert.ok(fact);
  for (const engine of ['neo4j', 'memgraph']) {
    const connectorId = 'task11-' + engine;
    const transport = new ConvexGraphWorkerTransport({deploymentUrl: context.state.url,
      fetchToken: async signal => {signal.throwIfAborted(); controller.signal.throwIfAborted(); return context.token(context.fixture.workerSubject);}});
    let connectAttempts = 0, forbiddenApplyCalls = 0;
    const connector = {connect: async () => {connectAttempts++; throw Error('FIXTURE_REACHABLE_PRE_DISPATCH_FAILURE');},
      apply: async () => {forbiddenApplyCalls++; throw Error('UNREACHABLE_AFTER_CONNECT_FAILURE');},
      expand: async () => {throw Error('NO_EXPANSION_EXPECTED');}, close: async () => {}};
    const worker = new CortexGraphWorker({...scope, connectorId, workerId: 'task11-exhaustion-' + engine, transport, connector});
    workers.push(worker); const steps = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const before = await inspect(), target = before.outbox.find(row => row.connectorId === connectorId && row.sourceId === fact.lineage.sourceId);
      assert.equal(target.attempt, attempt - 1); assert.equal(target.state, 'pending');
      await new Promise(resolve => setTimeout(resolve, Math.max(0, target.retryAt - Date.now() + 10)));
      controller.signal.throwIfAborted(); let step; const waitStarted=performance.now();
      do {step=await worker.step();if(step.kind!=='idle')break;await new Promise(resolve=>setTimeout(resolve,100));}
      while(performance.now()-waitStarted<5000);
      assert.equal(step.state, 'failed'); assert.equal(step.backendAcknowledged, true);
      const after = await inspect(), job = after.outbox.find(row => row.jobId === target.jobId);
      assert.equal(job.attempt, attempt); assert.equal(job.state, attempt === 3 ? 'dead_letter' : 'pending');
      steps.push({attempt, result: step, state: job.state, retryAt: job.retryAt, failureCode: job.failureCode});
    }
    assert.equal(connectAttempts, 3); assert.equal(forbiddenApplyCalls, 0);
    outcomes.push({name: 'native-max-three-exhaustion-' + engine, status: 'PASS', steps,
      connectAttempts, remoteApplyCalls: forbiddenApplyCalls, fixtureFault: 'pre-dispatch connector failure'});
  }
  const failed = await inspect(), source = failed.graphSources.find(row => row.sourceId === fact.lineage.sourceId);
  assert.equal(source.state, 'dead_letter');
  assert.equal(failed.revisions.find(row => row.revision === source.revision).state, 'failed');
  const status = await context.owner.query(context.reference('runtimeGraph:status'), {...scope, sourceId: source.sourceId});
  assert.equal(status.state, 'dead_letter');
  const strict = await denied(() => context.owner.mutation(context.reference('runtimeGraph:requestExpansion'), {...scope,
    sourceId: source.sourceId, connectorId: 'task11-neo4j', requestId: 'exhausted-must-not-complete', limit: 5}));
  assert.equal(strict.data?.code, 'GRAPH_NOT_READY');
  const progress = await context.owner.query(context.reference('runtimeGraph:status'), scope);
  outcomes.push({name: 'native-exhaustion-visible-failure-strict-freshness', status: 'PASS', status, progress,
    strictCode: strict.data.code, completeClaimed: false, sourceId: source.sourceId});
  await context.publish('native-exhaustion2-after', failed);
  receipt = {status: 'ACTUAL_EXHAUSTION_PASS', version: 1, outcomes, modelCalls: 0,
    noRemoteApplyOrUnknownSuccessClaim: true, maximumAttempts: 3, deadlineMs: 60000};
} catch (error) {
  receipt = {status: 'FAIL_OR_UNKNOWN', version: 1, outcomes, error: context.publicError(error), modelCalls: 0, noBlindRepeat: true};
  process.exitCode = 1;
} finally {
  clearTimeout(timer); const cleanupErrors = [];
  for (const worker of workers) try {await worker.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  try {await context.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  receipt.cleanupErrors = cleanupErrors; receipt.ownedWorkersClosed = cleanupErrors.length === 0;
  receipt.elapsedMs = performance.now() - started;
  if (cleanupErrors.length) {receipt.status = 'FAIL_OR_UNKNOWN'; process.exitCode = 1;}
  await context.publish('native-exhaustion2-outcomes', receipt);
  console.log(JSON.stringify({status: receipt.status, groups: outcomes.length, modelCalls: 0, elapsedMs: receipt.elapsedMs}));
}
