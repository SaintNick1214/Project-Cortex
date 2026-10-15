import type { CortexRuntimeClient, MemoryEffortRequest } from '@cortexmemory/sdk/runtime';
import { CortexRemoteTransport } from '@cortexmemory/vercel-ai-provider/remote';

export async function createEffortTransport(
  client: CortexRuntimeClient, agentId: string, agentVersion: number,
) {
  const definition = await client.getDefinition(agentId, agentVersion);
  const supported = definition.inputSelectionVersion === 2 &&
    definition.memoryEffortPolicyVersion === 1;
  const memory: MemoryEffortRequest = { effort: 'normal' };
  return new CortexRemoteTransport({ client, agentId, agentVersion,
    ...(supported ? { memory } : {}),
  });
}
