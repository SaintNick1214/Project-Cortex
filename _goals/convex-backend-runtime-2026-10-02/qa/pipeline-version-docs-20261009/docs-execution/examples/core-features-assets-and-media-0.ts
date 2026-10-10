import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function previewUpload(client: CortexRuntimeClient, requestId: string, file: File) {
  const asset = await client.uploadAsset(file, {
    requestId,
    mimeType: file.type || 'application/octet-stream',
    filename: file.name,
  });
  const preview = await client.createAssetUrl({ assetId: asset.assetId, version: asset.assetVersion });
  return { asset, preview, close: () => preview.revoke() };
}
