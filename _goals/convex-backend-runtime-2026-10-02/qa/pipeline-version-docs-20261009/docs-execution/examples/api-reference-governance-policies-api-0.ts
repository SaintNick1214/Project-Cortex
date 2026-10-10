import type { Cortex } from '@cortexmemory/sdk';

export async function previewApprovedRetention(cortex: Cortex) {
  const template = await cortex.governance.getTemplate('GDPR');
  const simulation = await cortex.governance.simulate(template);
  return { proposed: template, simulation };
}
