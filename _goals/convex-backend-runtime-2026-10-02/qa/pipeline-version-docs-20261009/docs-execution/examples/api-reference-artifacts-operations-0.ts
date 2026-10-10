import type { Cortex } from '@cortexmemory/sdk';

export async function saveApprovedArtifact(cortex: Cortex, memorySpaceId: string) {
  const artifact = await cortex.artifacts.create({ memorySpaceId,
    title: 'Delivery plan', content: 'Deliver on Tuesday.', kind: 'text' });
  const updated = await cortex.artifacts.update(artifact.artifactId,
    'Deliver on Wednesday.', { changeSummary: 'Confirmed new window', changedBy: 'user-123' });
  const history = await cortex.artifacts.getHistory(updated.artifactId);
  return { artifact: updated, history };
}
