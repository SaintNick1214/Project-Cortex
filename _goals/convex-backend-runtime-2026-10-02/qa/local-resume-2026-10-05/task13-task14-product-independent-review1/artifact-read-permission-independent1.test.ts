import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { mediaFixture, media, installMediaMockRoot } from '../../../../../tests/unit/runtimeMedia/fixture';
import { artifacts } from '../../../../../tests/unit/runtimeAssets/fixture';
const shares = await import('../../../../../convex-dev/conversationShares');

beforeEach(() => installMediaMockRoot());
afterEach(() => jest.restoreAllMocks());

it('artifact_read preserves the linked conversation export permission used by the public artifact reader', async () => {
  const f = await mediaFixture(); const run = await f.run();
  await f.call(artifacts.create, { artifactId: 'linked-artifact', content: 'owned content', title: 'linked private metadata', conversationRef: { conversationId: run.conversationId } });
  const peer = f.db.seed('runtimeAuthPrincipals', { issuer: 'https://host.test', subject: 'peer', actorKind: 'user', version: 1 });
  const member = f.db.seed('runtimeAuthMemberships', { principalId: peer._id, tenantId: 'tenant-a', version: 1 });
  const grant = f.db.seed('runtimeAuthGrants', { principalId: peer._id, membershipId: member._id, tenantId: 'tenant-a', memorySpaceId: 'space-a', tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ['read'], resourceAccess: 'scope', version: 1 });
  const reference = { ...f.reference, principalId: peer._id, membershipId: member._id, grantId: grant._id };
  const created = await f.call<{ shareId: string }>(shares.create, { conversationId: run.conversationId, grantedBy: 'user-a', grantType: 'user', grantedTo: peer._id,
    permissions: { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: true } });
  f.identity({ issuer: 'https://host.test', subject: 'peer' });
  await expect(f.call(artifacts.get, { artifactId: 'linked-artifact' })).resolves.toBeDefined();
  await expect(f.call(media.readArtifactTrusted, { reference, artifactId: 'linked-artifact' })).resolves.toMatchObject({ artifactId: 'linked-artifact', title: 'linked private metadata' });
  const share = f.db.table('runtimeConversationShares').find(row => row.shareId === created.shareId)!;
  await f.db.patch('runtimeConversationShares', share._id, { permissions: { ...(share.permissions as object), canExport: false } });
  await expect(f.call(artifacts.get, { artifactId: 'linked-artifact' })).rejects.toThrow();
  await expect(f.call(media.readArtifactTrusted, { reference, artifactId: 'linked-artifact' })).rejects.toThrow();
});
