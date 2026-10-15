import type { CortexRuntimeClient, MemoryEffortRequest } from '@cortexmemory/sdk/runtime';

export async function recallWithEffort(
  client: CortexRuntimeClient, requestId: string, text: string,
) {
  const memory: MemoryEffortRequest = { effort: 'high', maxEntries: 12 };
  const result = await client.recall({ requestId, text, memory });
  return { items: result.items, context: result.context, effort: result.memoryEffort };
}
