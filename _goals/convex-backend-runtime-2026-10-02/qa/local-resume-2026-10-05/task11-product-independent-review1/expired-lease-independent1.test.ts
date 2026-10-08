import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { MutationCtx } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server';
import { TranscriptDb, invoke } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture';
import { DEFAULT_EMBEDDING_PROFILE } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
const graph = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGraph');
function fixture(attempt: number, expiresAt: number) {
  const now = 1_000_000; jest.spyOn(Date, 'now').mockReturnValue(now);
  const db = new TranscriptDb();
  // This controlled port supplies native first() selection, absent from the older reusable fixture.
  const query = db.query.bind(db);
  db.query = ((name: string) => { const b = query(name); return Object.assign(b, { first: async () => (await b.take(1))[0] ?? null }); }) as typeof db.query;
  const principal = db.seed('runtimeAuthPrincipals', { issuer: 'https://worker.test', subject: 'service', actorKind: 'service', version: 1 });
  const membership = db.seed('runtimeAuthMemberships', { principalId: principal._id, tenantId: 'worker-tenant', version: 1 });
  db.seed('runtimeAuthScopes', { tenantId: 'worker-tenant', epoch: 1 });
  db.seed('runtimeAuthScopes', { tenantId: 'worker-tenant', memorySpaceId: 'worker-space', epoch: 1 });
  db.seed('runtimeAuthGrants', { principalId: principal._id, membershipId: membership._id, tenantId: 'worker-tenant', memorySpaceId: 'worker-space',
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ['admin'], resourceAccess: 'space', version: 1 });
  db.seed('runtimeGraphConnectors', { tenantId: 'data-tenant', memorySpaceId: 'data-space', connectorId: 'c', workerPrincipalId: principal._id,
    workerTenantId: 'worker-tenant', workerMemorySpaceId: 'worker-space', enabled: true, createdAt: 0 });
  const source = db.seed('runtimeGraphSources', { tenantId: 'data-tenant', memorySpaceId: 'data-space', sourceId: 's', sourceEventId: 'e', sourceRevision: 1,
    ownerPrincipalId: 'owner', contentHash: 'a'.repeat(64), revision: 1, payloadHash: 'b'.repeat(64), profile: DEFAULT_EMBEDDING_PROFILE,
    operation: 'replace', state: 'pending', updatedAt: 0 });
  const event = db.seed('runtimeIngestionEvents', { tenantId: 'data-tenant', memorySpaceId: 'data-space', sequence: 1,
    lineage: { sourceId: 's', sourceEventId: 'e', sourceRevision: 1 }, contentHash: 'a'.repeat(64), graphState: 'pending' });
  const job = db.seed('runtimeGraphOutbox', { tenantId: 'data-tenant', memorySpaceId: 'data-space', connectorId: 'c', jobId: 'j', sourceId: 's', revision: 1,
    payloadHash: 'b'.repeat(64), state: 'running', attempt, leaseVersion: attempt, workerId: 'old', leaseExpiresAt: expiresAt, retryAt: 0, createdAt: 0, updatedAt: 0 });
  const ctx = { db, auth: { getUserIdentity: async () => ({ issuer: 'https://worker.test', subject: 'service' }) },
    scheduler: { runAfter: async () => { throw new Error('Unexpected schedule'); } }, runQuery: async () => { throw new Error('Unexpected read RPC'); } } as unknown as MutationCtx;
  return { ctx, db, source, event, job };
}
afterEach(() => jest.restoreAllMocks());
describe('independent last-lease exhaustion projection', () => {
  it('retired final unknown lease becomes failed in source and strict-stage metadata, without a synced receipt', async () => {
    const f = fixture(3, 999_999);
    expect(await invoke(graph.claim, f.ctx, { tenantId: 'data-tenant', memorySpaceId: 'data-space', connectorId: 'c', workerId: 'new' })).toBeNull();
    expect((await f.db.get('runtimeGraphOutbox', f.job._id))?.state).toBe('dead_letter');
    expect((await f.db.get('runtimeGraphSources', f.source._id))?.state).toBe('dead_letter');
    expect((await f.db.get('runtimeIngestionEvents', f.event._id))?.graphState).toBe('failed');
    expect(f.db.table('runtimeGraphReceipts')).toHaveLength(0);
  });
  it('unexpired final lease remains pending rather than fabricated failure or success', async () => {
    const f = fixture(3, 1_000_001);
    expect(await invoke(graph.claim, f.ctx, { tenantId: 'data-tenant', memorySpaceId: 'data-space', connectorId: 'c', workerId: 'new' })).toBeNull();
    expect((await f.db.get('runtimeGraphOutbox', f.job._id))?.state).toBe('running');
    expect((await f.db.get('runtimeGraphSources', f.source._id))?.state).toBe('pending');
    expect((await f.db.get('runtimeIngestionEvents', f.event._id))?.graphState).toBe('pending');
    expect(f.db.table('runtimeGraphReceipts')).toHaveLength(0);
  });
});
