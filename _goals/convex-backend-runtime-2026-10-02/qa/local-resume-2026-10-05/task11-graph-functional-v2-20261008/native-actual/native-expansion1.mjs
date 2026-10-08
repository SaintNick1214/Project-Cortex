/** Actual related-entity expansion; Core filters private/current reader scope. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext, denied, waitUntil, q} from './common.mjs';

const controller = new AbortController();
const context = await openOwnedContext({signal: controller.signal});
const started = performance.now(), outcomes = [], workers = [], connectors = [];
const timer = setTimeout(() => controller.abort(Error('TASK11_EXPANSION_DEADLINE')), 90000);
const scope = {tenantId: context.tenantId, memorySpaceId: context.memorySpaceId};
const inspect = () => context.admin.query(context.reference('graphNative:inspect'), scope);
let receipt;
try {
  await context.verifyTarget('native-expansion1-target-verified');
  assert.equal(JSON.parse(await readFile(join(q, 'native-core1-outcomes.json'))).status, 'ACTUAL_CORE_PASS');
  const setup = JSON.parse(await readFile(join(q, 'setup-scopes1.json')));
  const ownReader = context.http(setup.ownReader.subject);
  const initial = await inspect(), anchor = initial.facts[0]; assert.ok(anchor);
  const input = fact => ({...scope, fact, factType: 'knowledge', confidence: 100, sourceType: 'manual',
    tags: ['task11-native-expansion'], entities: [{name: 'Task11 project', type: 'project'}], relations: []});
  await context.owner.mutation(context.reference('facts:store'), input('The related Task11 project has a graph neighbor fact.'));
  await ownReader.mutation(context.reference('facts:store'), input('The own-only reader owns this Task11 anchor.'));
  const created = await inspect();
  const neighbor = created.facts.find(row => row.fact === 'The related Task11 project has a graph neighbor fact.');
  const privateAnchor = created.facts.find(row => row.fact === 'The own-only reader owns this Task11 anchor.');
  assert.ok(neighbor && privateAnchor); assert.notEqual(neighbor.lineage.sourceId, anchor.lineage.sourceId);
  assert.equal(privateAnchor.ownerPrincipalId, setup.ownReader.reference.principalId);
  const {CypherProjectionConnector, ConvexGraphWorkerTransport, CortexGraphWorker} = await import(pathToFileURL(join(context.host, 'task11-graph-runtime-entry.mjs')));
  for (const engine of ['neo4j', 'memgraph']) {
    const connectorId = 'task11-' + engine;
    const connector = new CypherProjectionConnector({...context.graphCredentials[engine], engine, ...scope, connectorId});
    connectors.push(connector);
    const transport = new ConvexGraphWorkerTransport({deploymentUrl: context.state.url,
      fetchToken: async signal => {signal.throwIfAborted(); controller.signal.throwIfAborted(); return context.token(context.fixture.workerSubject);}});
    const worker = new CortexGraphWorker({...scope, connectorId, workerId: 'task11-expansion-' + engine, transport, connector});
    workers.push(worker);
    await waitUntil('current related sources on ' + engine, async () => {
      const result = await worker.step(); const current = await inspect();
      return {result, pending: current.outbox.filter(row => row.connectorId === connectorId && ['pending', 'running'].includes(row.state)).length};
    }, value => value.pending === 0, {timeoutMs: 30000, pollMs: 250});
  }
  const projected = await inspect(); assert.ok(projected.graphSources.every(row => row.state === 'complete'));
  for (const [index, engine] of ['neo4j', 'memgraph'].entries()) {
    const connectorId = 'task11-' + engine;
    const requestId = 'related-entities-' + engine;
    await context.owner.mutation(context.reference('runtimeGraph:requestExpansion'), {...scope, sourceId: anchor.lineage.sourceId, connectorId, requestId, limit: 10});
    assert.equal((await workers[index].step()).state, 'complete');
    const result = await context.owner.query(context.reference('runtimeGraph:expansion'), {...scope, requestId});
    assert.ok(result.facts.some(row => row.factId === anchor.factId));
    assert.ok(result.facts.some(row => row.factId === neighbor.factId), 'Actual graph returns entity-connected different-source neighbor');
    outcomes.push({name: 'related-neighbor-' + engine, status: 'PASS', result, distinctSourceIds: [anchor.lineage.sourceId, neighbor.lineage.sourceId]});
    const ownRequest = 'own-reader-' + engine;
    await ownReader.mutation(context.reference('runtimeGraph:requestExpansion'), {...scope, sourceId: privateAnchor.lineage.sourceId, connectorId, requestId: ownRequest, limit: 10});
    assert.equal((await workers[index].step()).state, 'complete');
    const ownResult = await ownReader.query(context.reference('runtimeGraph:expansion'), {...scope, requestId: ownRequest});
    assert.deepEqual(ownResult.facts.map(row => row.factId), [privateAnchor.factId]);
    const nativeRow = (await inspect()).reads.find(row => row.requestId === ownRequest);
    assert.ok(nativeRow.factIds.includes(neighbor.factId), 'Remote candidate includes neighbor before Core reader filtering');
    outcomes.push({name: 'private-neighbor-current-core-filter-' + engine, status: 'PASS', remoteCandidateIds: nativeRow.factIds,
      result: ownResult, exactCurrentReader: setup.ownReader.reference.principalId});
    const graphSource = projected.graphSources.find(row => row.sourceId === anchor.lineage.sourceId);
    const payload = JSON.parse(projected.payloads.find(row => row.revision === graphSource.revision).payloadCanonical);
    const wrongProfile = await connectors[index].expand({scope: payload.scope, sourceId: anchor.lineage.sourceId,
      profileId: 'cortex-text-large-3072-v1', revision: graphSource.revision, limit: 10});
    assert.deepEqual(wrongProfile.factIds, []);
    outcomes.push({name: 'actual-remote-profile-index-fence-' + engine, status: 'PASS', wrongProfile,
      selectedCurrentProfile: graphSource.profile, scope: 'connector remote read; not a tenant policy-switch claim'});
  }
  const manifest = JSON.parse(await readFile(join(context.pointer.originQaDirectory, 'shipped-default-manifest9.json')));
  assert.equal(manifest.revision, 9);
  const largeProof = manifest.qualifications.find(row => row.modelId === 'openai/text-embedding-3-large' && row.nativeInterface === 'embedding');
  const smallProof = manifest.qualifications.find(row => row.modelId === 'openai/text-embedding-3-small' && row.nativeInterface === 'embedding');
  assert.ok(largeProof && smallProof);
  const beforeCounts = await context.admin.query('baselineQualification:counts', {});
  const makePolicy = (version, proof) => ({policyId: 'task11-native-embedding-query', version, scope: 'tenant',
    tenantId: context.tenantId, operationKey: 'embedding.query', rules: {modelId: proof.modelId, nativeInterface: 'embedding',
      pins: {priceRevision: proof.priceRevision, boundRevision: proof.boundRevision}}});
  const selected = await context.admin.mutation(context.reference('runtimeModelPolicy:provisionTenantPolicy'), {
    reference: setup.policyAdmin.reference, policyCanonical: JSON.stringify(makePolicy(1, largeProof)), overrideRequested: true});
  const profile = await context.owner.query(context.reference('runtimeMemory:defaultProfile'), scope);
  assert.equal(profile.profile.dimensions, 3072);
  const profileDenials = [];
  for (const engine of ['neo4j', 'memgraph']) {
    const error = await denied(() => context.owner.mutation(context.reference('runtimeGraph:requestExpansion'), {
      ...scope, sourceId: anchor.lineage.sourceId, connectorId: 'task11-' + engine,
      requestId: 'wrong-current-profile-' + engine, limit: 10}));
    assert.equal(error.data?.code, 'GRAPH_NOT_READY');
    profileDenials.push({engine, code: error.data.code});
  }
  const restore = await context.admin.mutation(context.reference('runtimeModelPolicy:provisionTenantPolicy'), {
    reference: setup.policyAdmin.reference, policyCanonical: JSON.stringify(makePolicy(2, smallProof)), overrideRequested: true});
  const restored = await context.owner.query(context.reference('runtimeMemory:defaultProfile'), scope);
  assert.equal(restored.profile.dimensions, 1536);
  const afterCounts = await context.admin.query('baselineQualification:counts', {});
  assert.equal(afterCounts.runtimeModelAttempts, beforeCounts.runtimeModelAttempts);
  assert.equal(afterCounts.runtimeModelOperations, beforeCounts.runtimeModelOperations);
  outcomes.push({name: 'registered-current-profile-strict-denial', status: 'PASS', selected, profile, profileDenials,
    restore, restored, priorModelAttempts: beforeCounts.runtimeModelAttempts, afterModelAttempts: afterCounts.runtimeModelAttempts,
    exactCompiledQualificationSelectors: true, accountingRootUnchanged: true, modelCalls: 0});
  await context.publish('native-expansion1-after', await inspect());
  receipt = {status: 'ACTUAL_EXPANSION_PASS', version: 1, outcomes, modelCalls: 0,
    currentPrincipalPrivateFiltering: true, distinctSourcesRelatedByEntity: true, deadlineMs: 90000};
} catch (error) {
  receipt = {status: 'FAIL_OR_UNKNOWN', version: 1, outcomes, error: context.publicError(error), modelCalls: 0, noBlindRepeat: true};
  process.exitCode = 1;
} finally {
  clearTimeout(timer); const cleanupErrors = [];
  for (const worker of workers) try {await worker.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  for (const connector of connectors) try {await connector.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  try {await context.close();} catch (error) {cleanupErrors.push(context.publicError(error));}
  receipt.cleanupErrors = cleanupErrors; receipt.ownedWorkersClosed = cleanupErrors.length === 0;
  receipt.elapsedMs = performance.now() - started;
  if (cleanupErrors.length) {receipt.status = 'FAIL_OR_UNKNOWN'; process.exitCode = 1;}
  await context.publish('native-expansion1-outcomes', receipt);
  console.log(JSON.stringify({status: receipt.status, groups: outcomes.length, modelCalls: 0, elapsedMs: receipt.elapsedMs}));
}
