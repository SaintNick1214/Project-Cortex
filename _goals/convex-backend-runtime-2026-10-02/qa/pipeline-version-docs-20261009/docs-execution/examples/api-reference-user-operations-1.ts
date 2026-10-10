import type { Cortex } from '@cortexmemory/sdk';

export async function eraseSupportedUser(cortex: Cortex,
  options: { url: string; deploymentKey: string; userId: string;
    tenantId: string; dryRun: boolean }) {
  const erasureTransport = cortex.users.createErasureTransport({
    url: options.url, deploymentKey: options.deploymentKey,
  });
  try {
    return await cortex.users.delete(options.userId, {
      tenantId: options.tenantId, cascade: true, dryRun: options.dryRun,
      verify: true, erasureTransport,
    });
  } finally {
    erasureTransport.close();
  }
}
