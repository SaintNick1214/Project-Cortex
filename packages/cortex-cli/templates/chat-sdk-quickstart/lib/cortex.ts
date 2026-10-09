/** Legacy app singleton and label-based identity are retired; request handlers use lib/runtime/server. */
import type { AuthContext, Cortex } from "@cortexmemory/sdk";
export function getCortex(): Cortex {
  throw new Error(
    "Use a request-scoped CortexRuntimeClient with a verified host JWT."
  );
}
export function getCortexWithAuth(_labels: AuthContext): Cortex {
  throw new Error(
    "AuthContext labels are not a verified host JWT. Use lib/runtime/server."
  );
}
export function getMemorySpaceId(): string {
  return (
    process.env.CORTEX_MEMORY_SPACE_ID ?? process.env.MEMORY_SPACE_ID ?? ""
  );
}
export function getAgentId(): string {
  return process.env.CORTEX_AGENT_ID ?? process.env.AGENT_ID ?? "";
}
