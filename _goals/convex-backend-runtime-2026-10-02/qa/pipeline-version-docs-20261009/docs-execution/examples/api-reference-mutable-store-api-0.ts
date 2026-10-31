import type { Cortex } from '@cortexmemory/sdk';

export async function updateApprovedInventory(cortex: Cortex) {
  const result = await cortex.mutable.transaction([
    { op: 'set', namespace: 'inventory', key: 'available', value: 20 },
    { op: 'decrement', namespace: 'inventory', key: 'available', amount: 2 },
    { op: 'set', namespace: 'inventory', key: 'last-order', value: 'order-42' },
  ]);
  return { committed: result.success, count: result.operationsExecuted,
    results: result.results };
}
