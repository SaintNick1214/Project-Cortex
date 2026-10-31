import { CortexRuntimeClient } from '@cortexmemory/sdk/runtime';

export function connectIdentity(options: {
  deploymentUrl: string;
  assetHttpUrl: string;
  fetchToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>;
  clearPrivateViews: () => void;
}) {
  return new CortexRuntimeClient({
    deploymentUrl: options.deploymentUrl,
    assetHttpUrl: options.assetHttpUrl,
    fetchToken: options.fetchToken,
    onAuthChange: authenticated => {
      if (!authenticated) options.clearPrivateViews();
    },
  });
}
