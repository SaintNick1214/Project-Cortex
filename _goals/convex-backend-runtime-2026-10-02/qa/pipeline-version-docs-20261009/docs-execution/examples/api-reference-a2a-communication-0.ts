import type { Cortex } from '@cortexmemory/sdk';

export async function sendApprovedAgentRecord(cortex: Cortex) {
  return cortex.a2a.send({ from: 'dispatch-agent', to: 'routing-agent',
    message: 'The delivery window changed to Wednesday.', importance: 70,
    metadata: { priority: 'normal', tags: ['delivery'] } });
}
