import type { Cortex } from '@cortexmemory/sdk';

export async function trackApprovedTask(cortex: Cortex, memorySpaceId: string) {
  const root = await cortex.contexts.create({ purpose: 'delivery-check',
    memorySpaceId, userId: 'user-123', data: { orderId: 'order-42' } });
  const child = await cortex.contexts.create({ purpose: 'confirm-window',
    memorySpaceId, parentId: root.contextId, data: { window: 'Wednesday' } });
  await cortex.contexts.update(child.contextId, { status: 'completed',
    completedAt: Date.now(), data: { confirmed: true } });
  const chain = await cortex.contexts.get(child.contextId, { includeChain: true });
  const history = await cortex.contexts.getHistory(child.contextId);
  const previous = await cortex.contexts.getVersion(child.contextId, 1);
  return { chain, history, previous };
}
