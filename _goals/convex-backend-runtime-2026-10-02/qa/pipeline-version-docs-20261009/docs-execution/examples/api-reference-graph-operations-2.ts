import { initialGraphSync, createGraphRebuildTransport,
  type Cortex, type GraphAdapter } from '@cortexmemory/sdk';

export async function rebuildAdministrativeScope(cortex: Cortex, adapter: GraphAdapter,
  options: { url: string; deploymentKey: string; tenantId: string; memorySpaceId: string },
  signal: AbortSignal) {
  const transport = createGraphRebuildTransport({
    url: options.url, deploymentKey: options.deploymentKey,
  });
  try {
    return await initialGraphSync(cortex, adapter, {
      transport, tenantId: options.tenantId, memorySpaceId: options.memorySpaceId,
      syncRelationships: true, deadlineMs: 120_000, signal,
    });
  } finally {
    transport.close();
  }
}
