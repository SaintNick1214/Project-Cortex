import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import type { RuntimeObservation } from "@cortexmemory/sdk/runtime";

export async function openConversation(options: {
  deploymentUrl: string;
  assetHttpUrl: string;
  memorySpaceId: string;
  agentId: string;
  agentVersion: number;
  fetchToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>;
  text: string;
  render: (observation: RuntimeObservation) => void;
  clearPrivateViews: () => void;
  onError: (error: unknown) => void;
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
  let disconnect = () => {};
  try {
    await client.session();
    await client.getDefinition(options.agentId, options.agentVersion);
    const handle = await client.submit({
      version: 1,
      agentId: options.agentId,
      agentVersion: options.agentVersion,
      clientRequestId: crypto.randomUUID(),
      parts: [{ type: "text", text: options.text }],
    });
    disconnect = client.watchObservation(handle, options.render, error => {
      options.clearPrivateViews();
      options.onError(error);
    });
    await client.start(handle, { streaming: true });
    return { client, handle, disconnect };
  } catch (error) {
    disconnect();
    await client.close();
    throw error;
  }
}
