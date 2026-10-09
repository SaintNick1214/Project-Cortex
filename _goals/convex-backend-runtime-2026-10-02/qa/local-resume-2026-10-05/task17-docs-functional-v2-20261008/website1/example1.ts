import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import type { RuntimeObservation } from "@cortexmemory/sdk/runtime";

export async function openRun(options: {
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
  let stop = () => {};
  try {
    const session = await client.session();
    const handle = await client.submit({
      version: 1,
      agentId: options.agentId,
      agentVersion: options.agentVersion,
      clientRequestId: crypto.randomUUID(),
      parts: [{ type: "text", text: options.text }],
    });
    stop = client.watchObservation(handle, options.render, error => {
      options.clearPrivateViews();
      options.onError(error);
    });
    await client.start(handle, { streaming: true });
    return { client, session, handle, disconnect: stop };
  } catch (error) {
    stop();
    await client.close();
    throw error;
  }
}
