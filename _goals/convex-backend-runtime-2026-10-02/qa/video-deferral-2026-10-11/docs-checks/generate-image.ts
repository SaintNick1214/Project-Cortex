import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function generateImage(
  client: CortexRuntimeClient,
  requestId: string,
  prompt: string,
) {
  return client.submitMediaJob({ requestId, kind: 'image', prompt });
}
