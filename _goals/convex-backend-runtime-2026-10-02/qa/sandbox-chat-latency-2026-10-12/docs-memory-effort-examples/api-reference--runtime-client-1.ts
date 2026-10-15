import type { CortexRuntimeClient, MemoryEffortRequest } from '@cortexmemory/sdk/runtime';

export async function selectMemory(
  client: CortexRuntimeClient, agentId: string, agentVersion: number,
  requestId: string, text: string,
) {
  const definition = await client.getDefinition(agentId, agentVersion);
  const supported = definition.inputSelectionVersion === 2 &&
    definition.memoryEffortPolicyVersion === 1;
  const memory: MemoryEffortRequest = { effort: 'normal', maxEntries: 8 };
  return client.recall({ text, requestId, ...(supported ? { memory } : {}) });
}
