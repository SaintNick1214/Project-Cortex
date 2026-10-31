import type { Cortex } from '@cortexmemory/sdk';

export async function reviseApprovedFact(cortex: Cortex, memorySpaceId: string) {
  cortex.facts.configureBeliefRevision(undefined, {
    semanticMatching: { enabled: false }, llmResolution: { enabled: false },
  });
  const input = { memorySpaceId, userId: 'user-123', sourceType: 'manual' as const,
    fact: { fact: 'Alex now prefers Wednesday deliveries', factType: 'preference',
      subject: 'user-123', predicate: 'delivery_window', object: 'Wednesday', confidence: 95 } };
  const preview = await cortex.facts.checkConflicts(input);
  const revision = await cortex.facts.revise(input);
  return { preview, action: revision.action, superseded: revision.superseded,
    pipeline: revision.pipeline, reason: revision.reason };
}
