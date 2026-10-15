import type { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export async function requireIndexedMemory(client: CortexRuntimeClient) {
  return client.memoryReadiness({ strictStages: ['facts', 'vectors'] });
}
