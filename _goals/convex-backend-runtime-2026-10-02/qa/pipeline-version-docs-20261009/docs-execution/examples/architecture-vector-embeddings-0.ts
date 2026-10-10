import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function readProfile(client: CortexRuntimeClient, expectedProfileId?: string) {
  return client.getEmbeddingProfile({ operationKey: 'embedding.query', expectedProfileId });
}
