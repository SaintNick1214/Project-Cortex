import { afterEach, expect, it, jest } from '@jest/globals';
import { getFunctionName } from 'convex/server';
import type { MutationCtx } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server';
import { TranscriptDb } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture';
import { DEFAULT_EMBEDDING_PROFILE } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
import { evaluateMemoryBarrier } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/memory-context';
const { readStageProgress } = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryContext');
afterEach(() => jest.restoreAllMocks());
function fixture(eligibility: 'eligible' | 'ineligible') {
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const db = new TranscriptDb();
  const principal = db.seed('runtimeAuthPrincipals', { issuer: 'https://test.test', subject: 'owner', actorKind: 'user', version: 1 });
  const membership = db.seed('runtimeAuthMemberships', { principalId: principal._id, tenantId: 't', version: 1 });
  db.seed('runtimeAuthScopes', { tenantId: 't', epoch: 1 }); db.seed('runtimeAuthScopes', { tenantId: 't', memorySpaceId: 's', epoch: 1 });
  const grant = db.seed('runtimeAuthGrants', { principalId: principal._id, membershipId: membership._id, tenantId: 't', memorySpaceId: 's',
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ['read', 'write'], resourceAccess: 'space', version: 1 });
  const reference = { principalId: principal._id, principalVersion: 1, membershipId: membership._id, membershipVersion: 1,
    grantId: grant._id, grantVersion: 1, tenantId: 't', memorySpaceId: 's', tenantEpoch: 1, memorySpaceEpoch: 1 };
  db.seed('runtimeIngestionScopes', { tenantId: 't', memorySpaceId: 's', sequence: 1, factsThrough: 0, vectorsThrough: 0, vectorProfileThrough: {}, graphThrough: 0, version: 1 });
  db.seed('runtimeIngestionEvents', { tenantId: 't', memorySpaceId: 's', sequence: 1, eventId: 'event', ownerPrincipalId: principal._id,
    lineage: { sourceId: 'source', sourceEventId: 'event', sourceRevision: 1, role: 'user', trust: 'user_assertion' }, contentHash: 'a'.repeat(64),
    profile: DEFAULT_EMBEDDING_PROFILE, eligibility, factsState: 'pending', vectorsState: 'pending', graphState: 'pending' });
  db.seed('runtimeGraphConnectors', { tenantId: 't', memorySpaceId: 's', connectorId: 'c', enabled: true });
  const ctx = { db, runQuery: async (ref: unknown, args: unknown) => {
    expect(getFunctionName(ref as Parameters<typeof getFunctionName>[0])).toBe('runtimeModelPolicy:embeddingProfile');
    expect(args).toEqual({ reference, operationKey: 'embedding.query' }); return DEFAULT_EMBEDDING_PROFILE;
  } } as unknown as MutationCtx;
  return { ctx, reference };
}
async function decision(eligibility: 'eligible' | 'ineligible') {
  const f = fixture(eligibility);
  const progress = await readStageProgress(f.ctx, f.reference, 1, undefined, 0);
  return evaluateMemoryBarrier({ cutoff: 1, requiredStages: ['graph'], stageCutoffs: progress.graph ? { graph: progress.graph.cutoff } : {},
    progress, startedAt: 1_000_000, now: 1_000_001, deadlineMs: 30_000, onFailure: 'fail' });
}
it('graph-only strict waits for an eligible captured source whose fact job has not created graph intent yet', async () => {
  expect((await decision('eligible')).state).toBe('waiting');
});
it('an explicitly ineligible captured source does not fabricate a graph-stage dependency', async () => {
  expect((await decision('ineligible')).state).toBe('ready');
});
