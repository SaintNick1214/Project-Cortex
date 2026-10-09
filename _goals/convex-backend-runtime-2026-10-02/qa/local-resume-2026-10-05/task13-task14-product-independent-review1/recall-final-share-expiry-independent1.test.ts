import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { memoryFixture, registeredHandler } from '../../../../../tests/unit/runtimeMemory/fixture';
import { finalDelivery } from '../../../../../convex-dev/runtimeMemory';
import { memoryScope } from '../../../../../convex-dev/runtimeMemoryRepository';
import { explicitSourceLineage } from '../../../../../convex-dev/runtimeMemoryServices';
import { prepareSourceContent } from '../../../../../src/domain/sources';
import type { MutationCtx } from '../../../../../convex-dev/_generated/server';

beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(1000));
afterEach(() => jest.restoreAllMocks());

it('final recall delivery retains the consumed fact-share deadline through its last authority await', async () => {
  const f = memoryFixture(), scope = memoryScope(f.reference);
  const lineage = explicitSourceLineage(scope, 'last-await-source');
  const prepared = await prepareSourceContent(scope, lineage, 'private fact source', { now: () => 1000 });
  f.db.seed('runtimeMemorySources', { ...prepared.source, transcriptOrigin: { conversationId: 'linked', conversationEpoch: 1, nativeMessageId: 'native-linked' } });
  f.db.seed('runtimeConversations', { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, conversationId: 'linked', ownerPrincipalId: f.principal._id, participants: [], visibility: 'private', epoch: 1 });
  f.db.seed('runtimeTranscriptMessages', { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, conversationId: 'linked', ownerPrincipalId: f.principal._id, nativeMessageId: 'native-linked', approved: true, ...lineage, revision: 1, role: 'user', sourceContentHash: prepared.source.contentHash });
  const peer = f.db.seed('runtimeAuthPrincipals', { issuer: 'https://host.test', subject: 'peer', actorKind: 'user', version: 1 });
  const member = f.db.seed('runtimeAuthMemberships', { principalId: peer._id, tenantId: scope.tenantId, version: 1 });
  const grant = f.db.seed('runtimeAuthGrants', { principalId: peer._id, membershipId: member._id, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ['read'], resourceAccess: 'space', version: 1 });
  const reference = { ...f.reference, principalId: peer._id, membershipId: member._id, grantId: grant._id };
  const permissions = { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: false };
  const share = { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, conversationId: 'linked', grantType: 'user', grantedTo: peer._id, state: 'active', viewCount: 0 };
  f.db.seed('runtimeConversationShares', { ...share, permissions });
  f.db.seed('runtimeConversationShares', { ...share, permissions: { ...permissions, canViewFacts: true }, expiresAt: 1001 });
  const args = { reference, bindings: { sources: [{ sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: 1, contentHash: prepared.source.contentHash, ownerPrincipalId: f.principal._id, permission: 'canViewFacts' }], facts: [], vectors: [] } };
  const handler = registeredHandler<typeof args, null>(finalDelivery);
  await expect(handler(f.ctx, args)).resolves.toBeNull();
  const query = f.db.query.bind(f.db), get = f.db.get.bind(f.db);
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  let sharesRead = 0, crossed = false;
  const db = Object.create(f.db);
  Object.defineProperty(db, 'query', { value: (table: string) => {
    const result = query(table);
    if (table === 'runtimeConversationShares') { const take = result.take; result.take = async (limit: number) => { const rows = await take(limit); sharesRead++; return rows; }; }
    return result;
  } });
  Object.defineProperty(db, 'get', { value: async (table: string, id: string) => {
    const row = await get(table, id);
    if (sharesRead >= 2 && table === 'runtimeAuthPrincipals') { crossed = true; now.mockReturnValue(1002); }
    return row;
  } });
  await expect(handler({ ...f.ctx, db } as MutationCtx, args)).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  expect(crossed).toBe(true); expect(f.db.writes).toBe(0);
});
