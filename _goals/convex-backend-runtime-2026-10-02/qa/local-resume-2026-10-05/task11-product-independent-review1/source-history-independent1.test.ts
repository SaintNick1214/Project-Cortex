import { afterEach, expect, it, jest } from '@jest/globals';
import type { MutationCtx } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/_generated/server';
import { TranscriptDb } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture';
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile';
const { enqueueSourceProjection } = await import('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGraph');
afterEach(() => jest.restoreAllMocks());
async function fixture(oldVersions: number, activeFacts: number) {
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const db = new TranscriptDb(), query = db.query.bind(db);
  // Existing fixture's expression port gains the two actual native filter operators used by the new snapshot query.
  db.query = ((name: string) => { const builder = query(name); const nativeFilter = builder.filter.bind(builder);
    builder.filter = ((callback: (q: unknown) => unknown) => nativeFilter((q: unknown) => {
      const read = (value: unknown, row: unknown) => typeof value === 'function' ? value(row) : value;
      return callback({ ...(q as object), or: (...terms: ((row: unknown) => boolean)[]) => (row: unknown) => terms.some(fn => fn(row)),
        gt: (a: unknown, b: unknown) => (row: unknown) => (read(a, row) as number) > (read(b, row) as number) });
    })) as typeof builder.filter; return builder;
  }) as typeof db.query;
  const principal = db.seed('runtimeAuthPrincipals', { issuer: 'https://owner.test', subject: 'owner', actorKind: 'user', version: 1 });
  const membership = db.seed('runtimeAuthMemberships', { principalId: principal._id, tenantId: 't', version: 1 });
  db.seed('runtimeAuthScopes', { tenantId: 't', epoch: 1 }); db.seed('runtimeAuthScopes', { tenantId: 't', memorySpaceId: 's', epoch: 1 });
  const grant = db.seed('runtimeAuthGrants', { principalId: principal._id, membershipId: membership._id, tenantId: 't', memorySpaceId: 's',
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ['read', 'write'], resourceAccess: 'own', version: 1 });
  const reference = { principalId: principal._id, principalVersion: 1, membershipId: membership._id, membershipVersion: 1,
    grantId: grant._id, grantVersion: 1, tenantId: 't', memorySpaceId: 's', tenantEpoch: 1, memorySpaceEpoch: 1 };
  const currentRevision = oldVersions + 1;
  const lineage = { sourceId: 'manual-source', sourceEventId: 'manual-source', sourceRevision: currentRevision, role: 'user', trust: 'user_assertion' };
  db.seed('runtimeMemorySources', { tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id, lineage, content: 'current', contentHash: await semanticHash('current') });
  for (let n = 1; n <= oldVersions; n++) db.seed('facts', { tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id,
    factId: `historical-${n}`, fact: 'old content', version: n, lineage: { ...lineage, sourceRevision: n }, validUntil: 999_999 });
  for (let n = 0; n < activeFacts; n++) db.seed('facts', { tenantId: 't', memorySpaceId: 's', ownerPrincipalId: principal._id,
    factId: `current-${n}`, fact: 'current content', version: currentRevision, lineage, entities: [], relations: [] });
  const ctx = { db } as unknown as MutationCtx;
  return { db, ctx, reference };
}
it('one current manual fact projects after 100 retained source versions without a connector or paid policy lookup', async () => {
  const f = await fixture(100, 1);
  const result = await enqueueSourceProjection(f.ctx, f.reference, 'manual-source');
  expect(result.profile).toEqual(DEFAULT_EMBEDDING_PROFILE);
  const payload = JSON.parse(f.db.table('runtimeGraphPayloads')[0]?.payloadCanonical as string);
  expect(payload.facts.map((fact: { factId: string; text: string }) => [fact.factId, fact.text])).toEqual([['current-0', 'current content']]);
  expect(payload.source.sourceRevision).toBe(101);
});
it('101 genuinely active current facts still deny before graph metadata writes', async () => {
  const f = await fixture(0, 101); const writes = f.db.writes;
  await expect(enqueueSourceProjection(f.ctx, f.reference, 'manual-source')).rejects.toMatchObject({ data: { code: 'GRAPH_SCOPE_TOO_BROAD' } });
  expect(f.db.writes).toBe(writes);
  expect(f.db.table('runtimeGraphPayloads')).toHaveLength(0);
});
