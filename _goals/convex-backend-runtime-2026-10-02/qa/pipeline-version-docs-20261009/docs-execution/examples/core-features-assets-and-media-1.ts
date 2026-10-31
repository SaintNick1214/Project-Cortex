import type { CortexRuntimeClient, RuntimeAssetReference } from '@cortexmemory/sdk/runtime';

export async function generateVideo(
  client: CortexRuntimeClient,
  requestId: string,
  prompt: string,
  inputAsset?: RuntimeAssetReference,
) {
  return client.submitMediaJob({ requestId, kind: 'video', prompt, inputAsset });
}
