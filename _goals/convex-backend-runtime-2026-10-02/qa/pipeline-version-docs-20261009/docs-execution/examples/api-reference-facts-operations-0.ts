import type { Cortex } from '@cortexmemory/sdk';

export async function storeApprovedFact(cortex: Cortex, memorySpaceId: string) {
  const result = await cortex.facts.storeWithDedup({
    memorySpaceId, userId: 'user-123',
    fact: 'Alex prefers Tuesday morning deliveries', factType: 'preference',
    subject: 'user-123', predicate: 'delivery_window', object: 'Tuesday morning',
    confidence: 95, sourceType: 'manual', tags: ['delivery'],
  }, { deduplication: 'structural' });
  return { factId: result.fact.factId, updated: result.wasUpdated,
    matchedExisting: result.deduplication?.matchedExisting ?? false };
}
