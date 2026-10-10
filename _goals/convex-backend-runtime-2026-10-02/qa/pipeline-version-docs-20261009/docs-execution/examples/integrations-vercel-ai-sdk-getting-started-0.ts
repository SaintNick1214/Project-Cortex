import { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';
import { CortexRemoteTransport } from '@cortexmemory/vercel-ai-provider/remote';
import type { RuntimeObservation, RuntimeRunHandle } from '@cortexmemory/sdk/runtime';

export async function connectChat(options: {
  deploymentUrl: string;
  assetHttpUrl: string;
  agentId: string;
  agentVersion: number;
  fetchToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>;
  onRun: (handle: RuntimeRunHandle) => void;
  render: (observation: RuntimeObservation) => void;
  clearPrivateViews: () => void;
}) {
  const client = new CortexRuntimeClient({
    deploymentUrl: options.deploymentUrl,
    assetHttpUrl: options.assetHttpUrl,
    fetchToken: options.fetchToken,
    onAuthChange: authenticated => {
      if (!authenticated) options.clearPrivateViews();
    },
  });
  try {
    await client.session();
    await client.getDefinition(options.agentId, options.agentVersion);
    const transport = new CortexRemoteTransport({
      client, agentId: options.agentId, agentVersion: options.agentVersion,
      onRun: options.onRun, onObservation: options.render,
    });
    return { client, transport, close: async () => {
      transport.disconnect();
      await client.close();
    } };
  } catch (error) {
    await client.close();
    throw error;
  }
}
