import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import { CortexRemoteTransport } from "@cortexmemory/vercel-ai-provider/remote";
import type { RuntimeObservation, RuntimeRunHandle } from "@cortexmemory/sdk/runtime";

export async function connectRemoteChat(options: {
  deploymentUrl: string;
  assetHttpUrl: string;
  memorySpaceId: string;
  agentId: string;
  agentVersion: number;
  conversationId?: string;
  fetchToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>;
  onRun: (handle: RuntimeRunHandle) => void;
  render: (observation: RuntimeObservation) => void;
  clearPrivateViews: () => void;
}) {
  const client = new CortexRuntimeClient({
    deploymentUrl: options.deploymentUrl,
    assetHttpUrl: options.assetHttpUrl,
    scope: { memorySpaceId: options.memorySpaceId },
    fetchToken: options.fetchToken,
    onAuthChange: authenticated => {
      if (!authenticated) options.clearPrivateViews();
    },
  });
  try {
    await client.session();
    await client.getDefinition(options.agentId, options.agentVersion);
    const transport = new CortexRemoteTransport({
      client,
      agentId: options.agentId,
      agentVersion: options.agentVersion,
      conversationId: options.conversationId,
      onRun: options.onRun,
      onObservation: options.render,
    });
    return {
      client,
      transport,
      close: async () => {
        transport.disconnect();
        await client.close();
      },
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
