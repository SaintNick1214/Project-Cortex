import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { assetFixture, installMockRoot, artifacts } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAssets/fixture';
beforeEach(() => installMockRoot()); afterEach(() => jest.restoreAllMocks());
it('registers artifact metadata reads as fresh mutations rather than native cached queries', () => {
  for (const name of ['get', 'getByConversation', 'list', 'getVersion', 'getHistory', 'count'] as const) {
    expect((artifacts[name] as unknown as { isMutation?: boolean }).isMutation).toBe(true);
  }
});
it('freshly denies the exact same artifact-version metadata call after clock-only grant expiry without row effects', async () => {
  const f = await assetFixture(); const { asset } = await f.upload();
  const selectors = { tenantId: 'tenant-a', memorySpaceId: 'space-a', artifactId: 'expiry-art' };
  await f.call(artifacts.create, { ...selectors, content: 'owned draft' });
  await f.call(artifacts.attachAsset, { ...selectors, assetId: asset.assetId, version: asset.assetVersion });
  f.grant.expiresAt = 1_000_010;
  const args = { ...selectors, version: 2 };
  const current = await f.call<{ fileRef: { versionId: string } }>(artifacts.getVersion, args);
  expect(current.fileRef.versionId).toBe(asset.versionId);
  const writes = f.db.writes;
  jest.spyOn(Date, 'now').mockReturnValue(1_000_011);
  await expect(f.call(artifacts.getVersion, args)).rejects.toThrow();
  expect(f.db.writes).toBe(writes); expect(f.blobs.size).toBe(1); expect(f.deleted).toHaveLength(0);
});
