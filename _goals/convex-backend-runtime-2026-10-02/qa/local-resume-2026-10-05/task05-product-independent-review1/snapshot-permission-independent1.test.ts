import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { installMockRoot, transcriptFixture, transcript } from '../../../../../tests/unit/runtimeTranscript/fixture';
const shares = await import('../../../../../convex-dev/conversationShares');
const snapshots = await import('../../../../../convex-dev/conversationSnapshots');
beforeEach(installMockRoot);
afterEach(() => jest.restoreAllMocks());
describe('independent registered snapshot export boundary', () => {
  it('owner snapshot returns canonical text without hidden definition or provider fields', async () => {
    const f = await transcriptFixture(); const run = await f.run();
    const saved = await f.call<{snapshotId:string}>(snapshots.create, {conversationId:run.conversationId, createdBy:'user-a'});
    const result = await f.call<{messages:{content:string}[]}>(snapshots.get, {snapshotId:saved.snapshotId});
    expect(result.messages.map(x=>x.content)).toEqual(['Hello \nworld!']);
    expect(JSON.stringify(result)).not.toMatch(/HIDDEN|PROVIDER_SECRET|authorityReference|threadId/);
  });
  it('canView-only recipient can view current transcript but cannot download an existing snapshot', async () => {
    const f = await transcriptFixture(); const run = await f.run();
    const saved = await f.call<{snapshotId:string}>(snapshots.create, {conversationId:run.conversationId, createdBy:'user-a'});
    const peer=f.db.seed('runtimeAuthPrincipals',{issuer:'https://host.test',subject:'snapshot-reader',actorKind:'user',version:1});
    const membership=f.db.seed('runtimeAuthMemberships',{principalId:peer._id,tenantId:'tenant-a',version:1});
    f.db.seed('runtimeAuthGrants',{principalId:peer._id,membershipId:membership._id,tenantId:'tenant-a',memorySpaceId:'space-a',tenantEpoch:1,memorySpaceEpoch:1,capabilities:['read','write'],resourceAccess:'scope',version:1});
    await f.call(shares.create,{conversationId:run.conversationId,grantedBy:'user-a',grantType:'user',grantedTo:peer._id,permissions:{canView:true,canViewFacts:false,canViewMemories:false,canContinue:false,canFork:false,canExport:false}});
    f.identity({issuer:'https://host.test',subject:'snapshot-reader'});
    expect(await f.call(transcript.get,{conversationId:run.conversationId})).toMatchObject({conversationId:run.conversationId});
    await expect(f.call(transcript.exportPage,{conversationId:run.conversationId})).rejects.toThrow();
    const writes=f.db.writes;
    await expect(f.call(snapshots.get,{snapshotId:saved.snapshotId})).rejects.toThrow();
    expect(f.db.writes).toBe(writes);
  });
});
