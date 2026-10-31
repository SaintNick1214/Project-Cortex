/** Correct only the original fixture's canonical JSON encoding; no repeated expansion/model work. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext, denied, q, root, sha} from './common.mjs';
const context = await openOwnedContext();
let receipt;
try {
  await context.verifyTarget('native-profile2-target-verified');
  const prior = JSON.parse(await readFile(join(q, 'native-expansion1-outcomes.json')));
  assert.equal(prior.outcomes.length, 6); assert.equal(prior.error.data.code, 'INVALID_INPUT');
  const setup = JSON.parse(await readFile(join(q, 'setup-scopes1.json')));
  const manifest = JSON.parse(await readFile(join(context.pointer.originQaDirectory, 'shipped-default-manifest9.json')));
  const scope = {tenantId: context.tenantId, memorySpaceId: context.memorySpaceId};
  const ts = await import(pathToFileURL(join(root, 'node_modules/typescript/lib/typescript.js')));
  const directory = join(q, 'local-contract-check'); await mkdir(directory, {recursive: true});
  const sourcePins = [];
  for (const name of ['profile', 'model-policy']) {
    const path = join(root, 'src/domain', name + '.ts'), bytes = await readFile(path);
    sourcePins.push({path, bytes: bytes.length, sha256: sha(bytes)});
    await writeFile(join(directory, name + '.js'), ts.transpileModule(bytes.toString(), {
      compilerOptions: {target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ES2022}}).outputText, {flag: 'wx'});
  }
  const {canonicalModelJson, resolveModelPolicy} = await import(pathToFileURL(join(directory, 'model-policy.js')));
  const largeProof = manifest.qualifications.find(row => row.modelId === 'openai/text-embedding-3-large' && row.nativeInterface === 'embedding');
  const smallProof = manifest.qualifications.find(row => row.modelId === 'openai/text-embedding-3-small' && row.nativeInterface === 'embedding');
  assert.ok(largeProof && smallProof);
  const makePolicy = (version, proof) => ({policyId: 'task11-native-embedding-query', version, scope: 'tenant',
    tenantId: context.tenantId, operationKey: 'embedding.query', rules: {modelId: proof.modelId, nativeInterface: 'embedding',
      pins: {priceRevision: proof.priceRevision, boundRevision: proof.boundRevision}}});
  const largePolicy = makePolicy(1, largeProof), smallPolicy = makePolicy(2, smallProof);
  const checks = [];
  for (const policy of [largePolicy, smallPolicy]) {
    const override = {actorPrincipalId: setup.policyAdmin.reference.principalId, changeRevision: policy.version,
      authorizationId: 'LOCAL_INPUT_CHECK_ONLY_NOT_NATIVE_AUTHORITY'};
    const parsed = resolveModelPolicy({context: {scope: setup.data.reference, operationKey: 'embedding.query', runBudgetId: 'local-input-check',
      authorizedOverrides: [{...override, policyId: policy.policyId, policyVersion: policy.version}]},
      policies: [...manifest.policies.filter(row => !row.operationKey || row.operationKey === 'embedding.query'), {...policy, override}],
      qualifications: manifest.qualifications});
    assert.equal(parsed.modelId, policy.rules.modelId);
    const canonical = canonicalModelJson(policy); assert.equal(canonicalModelJson(JSON.parse(canonical)), canonical);
    checks.push({version: policy.version, modelId: parsed.modelId, dimensions: parsed.semanticProfile.dimensions,
      canonicalSha256: sha(canonical), localOnly: true});
  }
  const beforeCounts = await context.admin.query('baselineQualification:counts', {});
  const selected = await context.admin.mutation(context.reference('runtimeModelPolicy:provisionTenantPolicy'), {
    reference: setup.policyAdmin.reference, policyCanonical: canonicalModelJson(largePolicy), overrideRequested: true});
  const profile = await context.owner.query(context.reference('runtimeMemory:defaultProfile'), scope);
  assert.equal(profile.profile.dimensions, 3072);
  const current = await context.admin.query(context.reference('graphNative:inspect'), scope);
  const anchor = current.facts.find(row => row.fact.includes('GRAPH_7c3504e9'));
  assert.ok(anchor); const denials = [];
  for (const engine of ['neo4j', 'memgraph']) {
    const error = await denied(() => context.owner.mutation(context.reference('runtimeGraph:requestExpansion'), {...scope,
      sourceId: anchor.lineage.sourceId, connectorId: 'task11-' + engine, requestId: 'wrong-current-profile-' + engine, limit: 10}));
    assert.equal(error.data?.code, 'GRAPH_NOT_READY'); denials.push({engine, code: error.data.code});
  }
  const restore = await context.admin.mutation(context.reference('runtimeModelPolicy:provisionTenantPolicy'), {
    reference: setup.policyAdmin.reference, policyCanonical: canonicalModelJson(smallPolicy), overrideRequested: true});
  const restored = await context.owner.query(context.reference('runtimeMemory:defaultProfile'), scope);
  assert.equal(restored.profile.dimensions, 1536);
  const afterCounts = await context.admin.query('baselineQualification:counts', {});
  assert.equal(afterCounts.runtimeModelAttempts, beforeCounts.runtimeModelAttempts);
  assert.equal(afterCounts.runtimeModelOperations, beforeCounts.runtimeModelOperations);
  receipt = {status: 'ACTUAL_PROFILE_DENIAL_PASS', version: 1, priorFixtureRed: 'native-expansion1-outcomes.json',
    priorSixActualExpansionOutcomesNotRepeated: true, sourcePins, localPreparedContractChecks: checks,
    selected, profile, denials, restore, restored, priorModelAttempts: beforeCounts.runtimeModelAttempts,
    afterModelAttempts: afterCounts.runtimeModelAttempts, modelCalls: 0, financialRootReset: false};
} catch (error) {
  receipt = {status: 'FAIL_OR_UNKNOWN', version: 1, error: context.publicError(error), noBlindRepeat: true, modelCalls: 0};
  process.exitCode = 1;
} finally {
  await context.close(); receipt.ownedClientsClosed = true;
  await context.publish('native-profile2-outcomes', receipt);
  console.log(JSON.stringify({status: receipt.status, modelCalls: 0}));
}
