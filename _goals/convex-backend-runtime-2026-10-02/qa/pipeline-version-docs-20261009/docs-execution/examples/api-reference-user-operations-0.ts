import type { Cortex } from '@cortexmemory/sdk';

type PrivateExportStage = {
  append(line: string): Promise<void>;
  commit(): Promise<void>;
  discard(): Promise<void>;
};

export async function exportSupportedUser(cortex: Cortex,
  options: { url: string; deploymentKey: string; userId: string; tenantId: string },
  stage: PrivateExportStage, signal?: AbortSignal) {
  const transport = cortex.users.createExportTransport({
    url: options.url, deploymentKey: options.deploymentKey, timeoutMs: 30_000,
  });
  let terminalManifestReceived = false;
  try {
    for await (const event of cortex.users.exportData(options.userId, {
      transport, tenantId: options.tenantId, pageSize: 50, signal,
    })) {
      await stage.append(cortex.users.serializeExportEvent(event) + '\n');
      if (event.type === 'manifest') terminalManifestReceived = event.complete;
    }
    if (!terminalManifestReceived) throw new Error('Export did not finish with a manifest');
    await stage.commit();
  } catch (error) {
    await stage.discard();
    throw error;
  }
}
