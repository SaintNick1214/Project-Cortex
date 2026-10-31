import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { installMockRoot, transcriptFixture, transcript } from '../../../../../tests/unit/runtimeTranscript/fixture';
const shares = await import('../../../../../convex-dev/conversationShares');
beforeEach(installMockRoot);
afterEach(() => jest.restoreAllMocks());
describe('independent supported share-view cap', () => {
  it('does not silently accept a maxViews limit that cannot be enforced', async () => {
    const f=await transcriptFixture(); const run=await f.run();
    const peer=f.db.seed('runtimeAuthPrincipals',{issuer:'https://host.test',subject:'view-limited-reader',actorKind:'user',version:1});
    const membership=f.db.seed('runtimeAuthMemberships',{principalId:peer._id,tenantId:'tenant-a',version:1});
    f.db.seed('runtimeAuthGrants',{principalId:peer._id,membershipId:membership._id,tenantId:'tenant-a',memorySpaceId:'space-a',tenantEpoch:1,memorySpaceEpoch:1,capabilities:['read'],resourceAccess:'scope',version:1});
    const writes=f.db.writes; let share:{shareId:string,maxViews:number}|undefined;
    try { share=await f.call(shares.create,{conversationId:run.conversationId,grantedBy:'user-a',grantType:'user',grantedTo:peer._id,maxViews:1,permissions:{canView:true,canViewFacts:false,canViewMemories:false,canContinue:false,canFork:false,canExport:false}}); }
    catch (error) { expect((error as {data?:{code?:string}}).data?.code).toBe('CAPABILITY_UNAVAILABLE'); expect(f.db.writes).toBe(writes); return; }
    expect(share).toMatchObject({maxViews:1});
    f.identity({issuer:'https://host.test',subject:'view-limited-reader'});
    expect(await f.call(transcript.get,{conversationId:run.conversationId})).toMatchObject({conversationId:run.conversationId});
    await expect(f.call(transcript.get,{conversationId:run.conversationId})).rejects.toThrow();
  });
});
