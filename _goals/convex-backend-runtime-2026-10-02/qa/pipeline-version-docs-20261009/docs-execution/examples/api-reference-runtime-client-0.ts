import { CortexRuntimeClient, CortexRuntimeError } from '@cortexmemory/sdk/runtime';
import type { RuntimeObservation } from '@cortexmemory/sdk/runtime';

export async function openRun(options: {
  deploymentUrl: string;
  assetHttpUrl: string;
  agentId: string;
  agentVersion: number;
  text: string;
  clientRequestId: string;
  fetchToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>;
  render: (observation: RuntimeObservation) => void;
  clearPrivateViews: () => void;
  onError: (error: unknown) => void;
}) {
  const client = new CortexRuntimeClient({
    deploymentUrl: options.deploymentUrl,
    assetHttpUrl: options.assetHttpUrl,
    fetchToken: options.fetchToken,
    onAuthChange: authenticated => {
      if (!authenticated) options.clearPrivateViews();
    },
  });
  let disconnect = () => {};
  const clearOnAuthorityError = (error: unknown) => {
    if (error instanceof CortexRuntimeError &&
        ['FORBIDDEN', 'UNAUTHENTICATED', 'AUTHORITY_EXPIRED', 'SESSION_CHANGED'].includes(error.code)) {
      options.clearPrivateViews();
    }
  };
  try {
    await client.session();
    const handle = await client.submit({
      version: 1,
      agentId: options.agentId,
      agentVersion: options.agentVersion,
      clientRequestId: options.clientRequestId,
      parts: [{ type: 'text', text: options.text }],
    });
    disconnect = client.watchObservation(handle, options.render, error => {
      if (error instanceof CortexRuntimeError &&
          ['FORBIDDEN', 'UNAUTHENTICATED', 'AUTHORITY_EXPIRED', 'SESSION_CHANGED'].includes(error.code)) {
        clearOnAuthorityError(error);
        disconnect();
        void client.close();
      }
      options.onError(error);
    });
    await client.start(handle, { streaming: true });
    return { client, handle, disconnect, close: async () => {
      disconnect();
      await client.close();
    } };
  } catch (error) {
    clearOnAuthorityError(error);
    disconnect();
    await client.close();
    throw error;
  }
}
