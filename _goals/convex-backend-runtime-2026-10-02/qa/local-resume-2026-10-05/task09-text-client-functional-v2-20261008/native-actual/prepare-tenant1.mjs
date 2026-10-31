import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openOwnedContext } from './common.mjs';

const c = await openOwnedContext(), records = [];
const scope = { memorySpaceId: c.memorySpaceId };
async function call(label, client, kind, name, args) {
  try {
    const result = await client[kind](name, args);
    records.push({ label, kind, function: name, args, result });
    await c.publish('prepare-tenant1-calls', { operation: c.pointer.operation, records });
    return result;
  } catch (error) {
    records.push({ label, kind, function: name, args, error: c.publicError(error) });
    await c.publish('prepare-tenant1-calls', { operation: c.pointer.operation, records });
    throw error;
  }
}
try {
  await c.verifyTarget('prepare-tenant1-target-verified');
  const expected = JSON.parse(await readFile(c.pointer.retainedHandoff.replace('retained-for-task09.json', 'installed-task08-source-manifest3.json')));
  const qualificationBytes = await readFile(join(c.handoff.fixtureHost, 'custom/backend/runtimeGatewayQualifications.ts'));
  const known = expected.files.find(row => row.path === 'runtimeGatewayQualifications.ts');
  assert.equal(createHash('sha256').update(qualificationBytes).digest('hex'), known.sha256);
  const text = qualificationBytes.toString('utf8');
  const policy = JSON.parse(text.split('export const DEFAULT_GATEWAY_POLICY_MANIFEST = ')[1].split(' as const satisfies DeploymentPolicyManifest;')[0]);
  assert.equal(policy.manifestId, 'cortex-gateway-agent-defaults-2026-10-08');
  assert.equal(policy.revision, 5);
  const now = Date.now();
  assert.ok(policy.dispatchEvidence.every(proof => proof.checkedAt <= now && now + 60000 < proof.expiresAt));
  const proofCurrentness = policy.dispatchEvidence.map(proof => ({ modelId: proof.modelId, nativeInterface: proof.nativeInterface,
    checkedAt: proof.checkedAt, expiresAt: proof.expiresAt, remainingMs: proof.expiresAt - now }));
  const owner = await call('provision-new09-owner', c.admin, 'mutation', 'runtimeAuth:provision', {
    issuer: c.auth.issuer, subject: 'cortex-owner', actorKind: 'user', tenantId: c.tenantId, ...scope,
    capabilities: ['read', 'write', 'run', 'admin', 'tool'], resourceAccess: 'space', expiresAt: Date.now() + 7200000,
  });
  const foreign = await call('provision-new09-foreign', c.admin, 'mutation', 'runtimeAuth:provision', {
    issuer: c.auth.issuer, subject: 'foreign-user', actorKind: 'user', tenantId: c.tenantId + '-foreign',
    memorySpaceId: c.memorySpaceId + '-foreign', capabilities: ['read', 'write', 'run'], resourceAccess: 'space', expiresAt: Date.now() + 7200000,
  });
  await call('register-new09-space', c.owner, 'mutation', 'memorySpaces:register', { ...scope, name: 'Owned Task09 text fixture', type: 'project' });
  const registryHash = await call('executable-registry', c.admin, 'query', 'ingestionQualification:registryHash', {});
  const definitions = {};
  for (const [key, tools, context, instructions] of [
    ['history', [], {}, 'Acknowledge the user briefly. Do not invoke tools. Remember the exact nickname in conversation history.'],
    ['tool', [{ toolId: 'memory.recall', toolVersion: 1, registryHash, requiredCapability: 'tool', approval: 'none' }], {},
      'Use memory_recall exactly once to retrieve the user codeword. Do not use memory_remember. Answer with the codeword and, if present, the latest nickname in the approved conversation history.'],
    ['approval', [{ toolId: 'memory.recall', toolVersion: 1, registryHash, requiredCapability: 'tool', approval: 'explicit' }], {},
      'Use memory_recall exactly once for the user codeword, awaiting its explicit approval. Do not use memory_remember. Then answer the codeword.'],
    ['strict', [], { memoryMode: 'strict', requiredStages: ['facts'], barrier: { deadlineMs: 1200, onFailure: 'fail' } },
      'Wait for required facts readiness. Do not answer before the barrier permits this request.'],
  ]) {
    definitions[key] = await call('publish-' + key, c.owner, 'mutation', 'agentDefinitions:publishVersion', {
      ...scope, clientMutationId: c.pointer.operation + '-' + key, expectedPreviousVersion: 0,
      definitionInput: { instructions: { text: instructions, promptVersion: 'task09-owned-text-v1' }, tools,
        context: { handlerId: 'cortex.transcript', handlerVersion: 1, registryHash, memoryMode: 'indexed-plus-pending', requiredStages: [], maxContextTokens: 4096, ...context },
        policies: [{ policyId: 'task09-' + c.pointer.operation + '-' + key, version: 1, operationKey: 'agent.respond',
          rules: { limits: { outputTokens: 128, toolSteps: tools.length ? 2 : 0 } } }] },
    });
  }
  const state = await c.admin.query('ingestionQualification:state', { tenantId: c.tenantId, ...scope });
  assert.equal(state.runtimeModelAttempts.length, 0);
  assert.equal(state.runtimeModelOperations.length, 0);
  await c.publish('owned-prerequisites1', { status: 'PASS_NONPAID_SETUP', projectId: c.handoff.projectId,
    deploymentUrl: c.handoff.url, tenantId: c.tenantId, memorySpaceId: c.memorySpaceId, owner, foreign,
    policyManifestId: policy.manifestId, policyRevision: policy.revision, proofCurrentness, registryHash, definitions,
    modelCalls: 0, sourceEvents: state.runtimeIngestionEvents.length, noTask08ScopeMutation: true,
    current09CandidateNotDeployed: true });
} finally {
  await c.close();
  await c.publish('prepare-tenant1-client-cleanup', { ownedClientsClosed: true, noReactiveClients: true });
}
