import type { CortexRuntimeClient, RuntimeObservation } from '@cortexmemory/sdk/runtime';

export async function reconnect(
  client: CortexRuntimeClient,
  runId: string,
  render: (observation: RuntimeObservation) => void,
  onError: (error: unknown) => void,
) {
  const handle = await client.attach(runId);
  return client.watchObservation(handle, render, onError);
}
