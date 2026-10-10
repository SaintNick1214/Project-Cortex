import type { Cortex } from '@cortexmemory/sdk';

export async function saveApprovedPolicy(cortex: Cortex) {
  const first = await cortex.immutable.store({ type: 'delivery-policy', id: 'window',
    data: { day: 'Tuesday' }, userId: 'user-123' });
  const second = await cortex.immutable.store({ type: 'delivery-policy', id: 'window',
    data: { day: 'Wednesday' }, userId: 'user-123' });
  const original = await cortex.immutable.getVersion('delivery-policy', 'window', first.version);
  const history = await cortex.immutable.getHistory('delivery-policy', 'window');
  return { currentVersion: second.version, original, history };
}
