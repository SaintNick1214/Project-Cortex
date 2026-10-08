import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { assetFixture, installMockRoot, assets, attachments } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAssets/fixture';
beforeEach(() => installMockRoot()); afterEach(() => jest.restoreAllMocks());
it('denies the first owner above the read bound atomically while retaining readable existing owners and idempotent joins', async () => {
  const f = await assetFixture(); const { asset } = await f.upload();
  const select = { tenantId: 'tenant-a', memorySpaceId: 'space-a', assetId: asset.assetId, version: asset.assetVersion };
  for (let i = 0; i < 99; i++) await f.call(attachments.create, { ...select, attachmentId: 'owner-' + i });
  expect(f.db.table('runtimeAssetReferences').filter(edge => edge.active && edge.versionId === asset.versionId)).toHaveLength(100);
  expect(await f.call(assets.get, select)).toEqual(asset);
  const writes = f.db.writes;
  await expect(f.call(attachments.create, { ...select, attachmentId: 'owner-over-cap' })).rejects.toMatchObject({ data: { code: 'ASSET_REFERENCE_LIMIT' } });
  expect(f.db.writes).toBe(writes);
  expect(f.db.table('attachments').find(row => row.attachmentId === 'owner-over-cap')).toBeUndefined();
  expect(await f.call(assets.get, select)).toEqual(asset);
  const existing = await f.call<{ attachmentId: string }>(attachments.create, { ...select, attachmentId: 'owner-0' });
  expect(existing.attachmentId).toBe('owner-0');
  expect(f.db.table('runtimeAssetReferences').filter(edge => edge.active && edge.versionId === asset.versionId)).toHaveLength(100);
});
