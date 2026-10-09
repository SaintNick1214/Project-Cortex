import type { Cortex, CortexRuntimeOptions } from "@cortexmemory/sdk";

/** Legacy local orchestration is available only to explicit server administration. */
export class LegacyOrchestrationUnavailableError extends Error {
  readonly code = "CAPABILITY_UNAVAILABLE";
  constructor() {
    super("Legacy Cortex orchestration requires an explicit administrative server client. Use the remote runtime transport for application requests.");
    this.name = "LegacyOrchestrationUnavailableError";
  }
}
export function requireLegacyRuntime(runtime: CortexRuntimeOptions | undefined): asserts runtime is CortexRuntimeOptions {
  if (runtime?.deploymentOperator !== true) throw new LegacyOrchestrationUnavailableError();
}
export function requireLegacyClient(cortex: Cortex): void {
  if (cortex.deploymentOperator !== true) throw new LegacyOrchestrationUnavailableError();
}
