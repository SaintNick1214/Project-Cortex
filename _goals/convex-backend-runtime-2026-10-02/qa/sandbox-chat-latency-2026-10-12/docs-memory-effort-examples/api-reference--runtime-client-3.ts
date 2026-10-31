import { CortexRuntimeClient, type CortexRuntimeClientOptions,
  type RuntimeLatencyEvent } from '@cortexmemory/sdk/runtime';

export function createTracedClient(options: CortexRuntimeClientOptions) {
  return new CortexRuntimeClient({ ...options,
    onLatencyEvent: (event: RuntimeLatencyEvent) => {
      console.log(JSON.stringify(event));
    },
  });
}
