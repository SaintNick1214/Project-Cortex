import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { assetFixture, installMockRoot, http, invoke } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAssets/fixture';
beforeEach(() => installMockRoot()); afterEach(() => jest.restoreAllMocks());
it('withholds private bytes if grant is revoked while the authorized storage read is in flight', async () => {
  const f = await assetFixture(); const { asset } = await f.upload();
  let opened = () => {}; const readStarted = new Promise<void>(resolve => { opened = resolve; });
  let release = () => {}; const held = new Promise<void>(resolve => { release = resolve; });
  const original = f.storage.get.bind(f.storage);
  f.storage.get = async id => { opened(); await held; return original(id); };
  const writes = f.db.writes;
  const request = new Request('https://host/cortex/assets/download?assetId=' + encodeURIComponent(asset.assetId) + '&version=1');
  const pending = invoke<Response>(http.downloadAsset, f.ctx, request);
  await readStarted; f.grant.revokedAt = Date.now(); release();
  const response = await pending;
  expect(response.status).toBe(403); expect(await response.json()).toEqual({ version: 1, code: 'FORBIDDEN' });
  expect(f.db.writes).toBe(writes); expect(f.deleted).toHaveLength(0); expect(f.blobs.size).toBe(1);
});
it('returns exact authenticated bytes and immutable MIME when the final grant remains current', async () => {
  const f = await assetFixture(); const { asset } = await f.upload('checkpoint-positive', 'positive');
  const response = await invoke<Response>(http.downloadAsset, f.ctx, new Request('https://host/cortex/assets/download?assetId=' + encodeURIComponent(asset.assetId) + '&version=1'));
  expect(response.status).toBe(200); expect(await response.text()).toBe('checkpoint-positive');
  expect(response.headers.get('Content-Type')).toBe(asset.mimeType); expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(f.deleted).toHaveLength(0); expect(f.blobs.size).toBe(1);
});
