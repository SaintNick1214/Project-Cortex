import { afterEach, expect, it, jest } from '@jest/globals';
import type { MutationCtx } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server';
import { TranscriptDb, invoke } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture';
import { DEFAULT_EMBEDDING_PROFILE } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
const graph = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGraph');

afterEach(() => jest.restoreAllMocks());
it('fresh Graph RPC registration denies expired service authority while the owned work lease is still valid', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const db = new TranscriptDb();
  const principal = db.seed('runtimeAuthPrincipals', { issuer: 'https://worker.test', subject: 'service', actorKind: 'service', version: 1 });
  const membership = db.seed('runtimeAuthMemberships', { principalId: principal._id, tenantId: 'worker-tenant', version: 1 });
  for (const tenantId of ['worker-tenant', 'data-tenant']) {
    db.seed('runtimeAuthScopes', { tenantId, epoch: 1 });
    db.seed('runtimeAuthScopes', { tenantId, memorySpaceId: tenantId === 'worker-tenant' ? 'worker-space' : 'data-space', epoch: 1 });
  }
  db.seed('runtimeAuthGrants', { principalId: principal._id, membershipId: membership._id, tenantId: 'worker-tenant', memorySpaceId: 'worker-space',
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ['admin'], resourceAccess: 'space', version: 1, expiresAt: 1_000_050 });
  db.seed('runtimeGraphConnectors', { tenantId: 'data-tenant', memorySpaceId: 'data-space', connectorId: 'c', workerPrincipalId: principal._id,
    workerTenantId: 'worker-tenant', workerMemorySpaceId: 'worker-space', enabled: true, createdAt: 0 });
  const payload = { version: 1, scope: { tenantId: 'data-tenant', memorySpaceId: 'data-space', tenantEpoch: 1, memorySpaceEpoch: 1 },
    source: { sourceId: 's', sourceEventId: 'e', sourceRevision: 1, ownerPrincipalId: 'owner', contentHash: 'a'.repeat(64) },
    revision: 1, operation: 'tombstone', profile: DEFAULT_EMBEDDING_PROFILE, facts: [] };
  db.seed('runtimeGraphPayloads', { tenantId: 'data-tenant', memorySpaceId: 'data-space', revision: 1, payloadCanonical: JSON.stringify(payload) });
  db.seed('runtimeGraphSources', { tenantId: 'data-tenant', memorySpaceId: 'data-space', ...payload.source,
    revision: 1, payloadHash: 'b'.repeat(64), profile: DEFAULT_EMBEDDING_PROFILE, operation: 'tombstone', state: 'pending', updatedAt: 0 });
  db.seed('runtimeGraphOutbox', { tenantId: 'data-tenant', memorySpaceId: 'data-space', connectorId: 'c', jobId: 'j', sourceId: 's', revision: 1,
    payloadHash: 'b'.repeat(64), state: 'running', attempt: 1, leaseVersion: 1, workerId: 'w', leaseExpiresAt: 1_060_000,
    retryAt: 0, createdAt: 0, updatedAt: 0 });
  const ctx = { db, auth: { getUserIdentity: async () => ({ issuer: 'https://worker.test', subject: 'service' }) },
    runQuery: async () => { throw Error('No model/profile query belongs to this cleanup fixture'); } } as unknown as MutationCtx;
  const args = { tenantId: 'data-tenant', memorySpaceId: 'data-space', connectorId: 'c', jobId: 'j', workerId: 'w', leaseVersion: 1 };
  const before = JSON.stringify(db.table('runtimeGraphOutbox'));
  expect(await invoke(graph.current, ctx, args)).toMatchObject({ leaseExpiresAt: 1_060_000, payload });
  clock.mockReturnValue(1_000_051);
  await expect(invoke(graph.current, ctx, args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  expect(JSON.stringify(db.table('runtimeGraphOutbox'))).toBe(before);
  expect(db.table('runtimeGraphReceipts')).toHaveLength(0);
  // The direct handler above proves the authority check; fresh mutation
  // registration prevents Convex's time-stale query cache from bypassing it.
  // This CODE fixture does not claim to reproduce the native cache itself.
  for (const registration of [graph.current, graph.currentExpansion, graph.expansion]) {
    expect((registration as unknown as { isMutation?: boolean }).isMutation).toBe(true);
  }
});
