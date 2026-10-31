import type { Cortex } from '@cortexmemory/sdk';

export async function inspectApprovedSpace(cortex: Cortex, memorySpaceId: string) {
  const space = await cortex.memorySpaces.get(memorySpaceId);
  if (!space) return null;
  const stats = await cortex.memorySpaces.getStats(memorySpaceId);
  return { name: space.name, memories: stats.totalMemories,
    estimatedBytes: stats.storage.totalBytes, measurement: stats.storageMeasurement };
}
