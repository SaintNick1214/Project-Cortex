import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function searchMemory(client: CortexRuntimeClient, requestId: string, query: string) {
  const { profile } = await client.getEmbeddingProfile();
  const result = await client.recall({
    text: query,
    requestId,
    limit: 10,
  });
  return { profile, result };
}
