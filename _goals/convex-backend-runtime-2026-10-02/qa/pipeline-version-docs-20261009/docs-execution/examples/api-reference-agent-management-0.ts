import type { Cortex } from '@cortexmemory/sdk';

export async function inspectApprovedRegistry(cortex: Cortex, agentId: string) {
  const agent = await cortex.agents.get(agentId);
  if (!agent) return null;
  return agent;
}
