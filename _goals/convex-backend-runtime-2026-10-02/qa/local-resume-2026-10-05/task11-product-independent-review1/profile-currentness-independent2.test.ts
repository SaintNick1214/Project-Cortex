import { afterEach, expect, it, jest } from '@jest/globals';
import { getFunctionName } from 'convex/server';
import type { MutationCtx } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server';
import { TranscriptDb, invoke } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture';
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE, semanticHash } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
import { canonicalModelJson } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy';
const graph = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGraph');
afterEach(() => jest.restoreAllMocks());
it('a current large source replacement cannot retain strict small graph completeness from the deleted generation', async () => {
  const now = 1_000_000; jest.spyOn(Date, 'now').mockReturnValue(now);
  const db = new TranscriptDb(); const query = db.query.bind(db);
  db.query = ((name: string) => { const b = query(name); return Object.assign(b, { first: async () => (await b.take(1))[0] ?? null }); }) as typeof db.query;
  const principal = db.seed('runtimeAuthPrincipals', { issuer: 'https://worker.test', subject: 'service', actorKind: 'service', version: 1 });
  const membership = db.seed('runtimeAuthMemberships', { principalId: principal._id, tenantId: 't', version: 1 });
  db.seed('runtimeAuthScopes', { tenantId: 't', epoch: 1 }); db.seed('runtimeAuthScopes', { tenantId: 't', memorySpaceId: 's', epoch: 1 });
  const grant = db.seed('runtimeAuthGrants', { principalId: principal._id, membershipId: membership._id, tenantId: 't', memorySpaceId: 's',
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ['admin', 'read', 'write'], resourceAccess: 'space', version: 1 });
  const reference = { principalId: principal._id, principalVersion: 1, membershipId: membership._id, membershipVersion: 1,
    grantId: grant._id, grantVersion: 1, tenantId: 't', memorySpaceId: 's', tenantEpoch: 1, memorySpaceEpoch: 1 };
  const source = { sourceId: 'source', sourceEventId: 'event', sourceRevision: 1, contentHash: 'a'.repeat(64), ownerPrincipalId: principal._id };
  const lineage = { sourceId: source.sourceId, sourceEventId: source.sourceEventId, sourceRevision: 1, role: 'user', trust: 'user_assertion' };
  db.seed('runtimeMemorySources', { tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id, lineage, contentHash: source.contentHash, content: 'content' });
  db.seed('runtimeGraphConnectors', { tenantId: 't', memorySpaceId: 's', connectorId: 'c', workerPrincipalId: principal._id,
    workerTenantId: 't', workerMemorySpaceId: 's', enabled: true, createdAt: 0 });
  const payload = { version: 1, scope: { tenantId: 't', memorySpaceId: 's', tenantEpoch: 1, memorySpaceEpoch: 1 }, source,
    revision: 2, operation: 'replace', profile: LARGE_EMBEDDING_PROFILE, facts: [] };
  const payloadCanonical = canonicalModelJson(payload), payloadHash = await semanticHash(payloadCanonical);
  db.seed('runtimeGraphPayloads', { tenantId: 't', memorySpaceId: 's', revision: 2, payloadCanonical });
  db.seed('runtimeGraphSources', { tenantId: 't', memorySpaceId: 's', ...source, revision: 2, payloadHash,
    profile: LARGE_EMBEDDING_PROFILE, operation: 'replace', authorityReference: reference, state: 'pending', updatedAt: 0 });
  db.seed('runtimeGraphOutbox', { tenantId: 't', memorySpaceId: 's', connectorId: 'c', jobId: 'j', sourceId: source.sourceId,
    revision: 2, payloadHash, state: 'running', attempt: 1, leaseVersion: 1, workerId: 'w', leaseExpiresAt: now + 1000, retryAt: 0, createdAt: 0, updatedAt: 0 });
  db.seed('runtimeIngestionEvents', { tenantId: 't', memorySpaceId: 's', sequence: 1, lineage, contentHash: source.contentHash,
    eligibility: 'eligible', factsState: 'complete', graphState: 'pending', graphProfilesComplete: [DEFAULT_EMBEDDING_PROFILE.profileId] });
  const ctx = { db, auth: { getUserIdentity: async () => ({ issuer: 'https://worker.test', subject: 'service' }) },
    scheduler: { runAfter: async () => 'scheduled' }, runQuery: async (ref: unknown, args: unknown) => {
      expect(getFunctionName(ref as Parameters<typeof getFunctionName>[0])).toBe('runtimeModelPolicy:embeddingProfile');
      expect(args).toEqual({ reference, operationKey: 'embedding.memory' }); return LARGE_EMBEDDING_PROFILE;
    } } as unknown as MutationCtx;
  // Controlled trusted remote receipt models the connector's full source replacement, not a service qualification.
  await invoke(graph.complete, ctx, { tenantId: 't', memorySpaceId: 's', connectorId: 'c', jobId: 'j', workerId: 'w', leaseVersion: 1,
    receipt: { version: 1, tenantId: 't', memorySpaceId: 's', connectorId: 'c', jobId: 'j', payloadHash, sourceId: source.sourceId,
      tenantEpoch: 1, memorySpaceEpoch: 1, revision: 2, state: 'applied', currentRevision: 2 } });
  expect((await graph.readGraphProgress(ctx, reference, 1, 0, LARGE_EMBEDDING_PROFILE)).complete).toBe(true);
  const small = await graph.readGraphProgress(ctx, reference, 1, 0, DEFAULT_EMBEDDING_PROFILE);
  expect(small.complete).toBe(false);
  expect(small.hole).toEqual({ sequence: 1, state: 'pending' });
});
