import { afterEach, expect, it, jest } from '@jest/globals';
import { getFunctionName } from 'convex/server';
import type { MutationCtx } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server';
import { TranscriptDb, invoke } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture';
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
const graph = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGraph');
const auth = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAuth');
const ingestion = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeIngestion');
const data = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeDataAuth');
const { serverToolSourceLineage } = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgentTools');
afterEach(() => jest.restoreAllMocks());
it('upstream source deletion must enqueue retirement for a projected tool derivative that is now ineligible', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const db = new TranscriptDb();
  const principal = db.seed('runtimeAuthPrincipals', { issuer: 'https://owner.test', subject: 'owner', actorKind: 'user', version: 1 });
  const membership = db.seed('runtimeAuthMemberships', { principalId: principal._id, tenantId: 't', version: 1 });
  db.seed('runtimeAuthScopes', { tenantId: 't', epoch: 1 }); db.seed('runtimeAuthScopes', { tenantId: 't', memorySpaceId: 's', epoch: 1 });
  const grant = db.seed('runtimeAuthGrants', { principalId: principal._id, membershipId: membership._id, tenantId: 't', memorySpaceId: 's', tenantEpoch: 1,
    memorySpaceEpoch: 1, capabilities: ['read', 'write'], resourceAccess: 'own', version: 1 });
  const reference = { principalId: principal._id, principalVersion: 1, membershipId: membership._id, membershipVersion: 1,
    grantId: grant._id, grantVersion: 1, tenantId: 't', memorySpaceId: 's', tenantEpoch: 1, memorySpaceEpoch: 1 };
  const original = db.seed('runtimeMemorySources', { tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id, lineage: {
    sourceId: 'upstream', sourceEventId: 'upstream', sourceRevision: 1, role: 'user', trust: 'user_assertion' }, content: 'private upstream',
    contentHash: await semanticHash('private upstream'), createdAt: Date.now() });
  const lineage = serverToolSourceLineage({ tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id }, 'remember-op');
  const derivative = db.seed('runtimeMemorySources', { tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id, lineage,
    content: 'derived upstream fact', contentHash: await semanticHash('derived upstream fact'), createdAt: Date.now(),
    // This is the exact immutable witness shape written by runtimeAgent.writeToolSource.
    contextSourceWitnesses: [{ sourceId: 'upstream', sourceEventId: 'upstream', sourceRevision: 1,
      contentHash: original.contentHash, permissions: ['canViewFacts'] }] });
  db.seed('runtimeAgentOperations', { tenantId: 't', memorySpaceId: 's', operationId: 'remember-op', toolName: 'memory_remember', state: 'complete' });
  db.seed('facts', { tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id, lineage, factId: 'derived-fact',
    fact: 'derived upstream fact', version: 1, entities: [], relations: [] });
  db.seed('runtimeGraphConnectors', { tenantId: 't', memorySpaceId: 's', connectorId: 'owned-connector', enabled: true,
    workerPrincipalId: 'service', workerTenantId: 'control', workerMemorySpaceId: 'workers', createdAt: Date.now() });
  const ctx = { db, scheduler: { runAfter: async () => 'scheduled' }, runQuery: async () => DEFAULT_EMBEDDING_PROFILE,
    runMutation: async (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      const name = getFunctionName(ref);
      if (name === 'runtimeIngestion:retireScopedSource') return await invoke(ingestion.retireScopedSource, ctx, args);
      if (name === 'runtimeGraph:retireAuthority') return await invoke(graph.retireAuthority, ctx, args);
      throw new Error('unexpected child ' + name);
    } } as unknown as MutationCtx;
  expect(await data.managedSourceIsCurrent(ctx, reference, derivative as never, 'write')).toBe(true);
  const initial = await graph.enqueueSourceProjection(ctx, reference, lineage.sourceId, DEFAULT_EMBEDDING_PROFILE);
  // Controlled initial condition: a prior worker has projected and acknowledged this exact immutable intent.
  await db.patch('runtimeGraphSources', initial._id, { state: 'complete' });
  await db.patch('runtimeGraphOutbox', db.table('runtimeGraphOutbox')[0]._id, { state: 'complete' });
  await invoke(auth.tombstoneResource, ctx, { tenantId: 't', memorySpaceId: 's', resourceType: 'source', resourceId: 'upstream' });
  expect(await data.managedSourceIsCurrent(ctx, reference, derivative as never, 'read')).toBe(false);
  const after = db.table('runtimeGraphSources').find(row => row.sourceId === lineage.sourceId)!;
  expect({ operation: after.operation, state: after.state, advanced: Number(after.revision) > initial.revision }).toEqual({
    operation: 'tombstone', state: 'pending', advanced: true });
});
