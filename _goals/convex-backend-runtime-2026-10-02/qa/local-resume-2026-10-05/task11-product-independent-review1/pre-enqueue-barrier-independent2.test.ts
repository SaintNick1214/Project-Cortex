import { afterEach, expect, it, jest } from '@jest/globals';
import { getFunctionName } from 'convex/server';
import type { MutationCtx } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server';
import { installIngestionMockRoot, transcriptFixture } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture';
import { DEFAULT_EMBEDDING_PROFILE } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
import { evaluateMemoryBarrier } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/memory-context';
const { readStageProgress } = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryContext');
afterEach(() => jest.restoreAllMocks());
async function fixture(eligibility: 'eligible' | 'ineligible') {
  installIngestionMockRoot();
  const f = await transcriptFixture(); const db = f.db;
  const scope = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId };
  db.seed('runtimeIngestionScopes', { ...scope, sequence: 1, factsThrough: 0, vectorsThrough: 0, vectorProfileThrough: {}, graphThrough: 0, version: 1 });
  db.seed('runtimeIngestionEvents', { ...scope, sequence: 1, eventId: 'event', ownerPrincipalId: f.reference.principalId,
    lineage: { sourceId: 'source', sourceEventId: 'event', sourceRevision: 1, role: 'user', trust: 'user_assertion' }, contentHash: 'a'.repeat(64),
    profile: DEFAULT_EMBEDDING_PROFILE, eligibility, factsState: 'pending', vectorsState: 'pending', graphState: 'pending' });
  db.seed('runtimeGraphConnectors', { ...scope, connectorId: 'c', enabled: true });
  return { ctx: f.ctx, reference: f.reference };
}
async function decision(eligibility: 'eligible' | 'ineligible') {
  const f = await fixture(eligibility);
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
