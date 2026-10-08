import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { assetFixture, installMockRoot, attachments } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAssets/fixture';
beforeEach(() => installMockRoot()); afterEach(() => jest.restoreAllMocks());
it('preserves accepted attachment filename, dimensions, duration and bounded metadata on actual attach/get handlers', async () => {
  const f = await assetFixture(); const { asset } = await f.upload('controlled-video-payload', 'metadata', 'video/mp4');
  const value = f.db.table('runtimeAssetVersions')[0];
  const fields = { filename: 'caller-preview.mp4', dimensions: { width: 320, height: 240 }, duration: 2.5, metadata: { label: 'kept', nested: [1, 2] } };
  const attached = await f.call<{ attachmentId: string }>(attachments.attach, { tenantId: 'tenant-a', memorySpaceId: 'space-a', userId: 'user-a', storageId: value.storageId, type: 'video', mimeType: asset.mimeType, size: asset.sizeBytes, ...fields });
  expect(attached).toMatchObject({ ...fields, type: 'video', mimeType: 'video/mp4', size: asset.sizeBytes });
  expect(await f.call(attachments.get, { tenantId: 'tenant-a', memorySpaceId: 'space-a', attachmentId: attached.attachmentId })).toMatchObject(fields);
  const writes = f.db.writes;
  await expect(f.call(attachments.attach, { tenantId: 'tenant-a', memorySpaceId: 'space-a', userId: 'user-a', storageId: value.storageId, type: 'image', mimeType: asset.mimeType, size: asset.sizeBytes, ...fields })).rejects.toMatchObject({ data: { code: 'ASSET_REFERENCE_CONFLICT' } });
  expect(f.db.writes).toBe(writes); expect(f.db.table('attachments')).toHaveLength(1); expect(f.deleted).toHaveLength(0);
});
