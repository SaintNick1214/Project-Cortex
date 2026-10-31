import { makeFunctionReference } from "convex/server";
import type { ApiFromModules } from "convex/server";
import type * as AgentRuntime from "./runtimeAgent";
type RuntimeApi = ApiFromModules<{ runtimeAgent: typeof AgentRuntime }>["runtimeAgent"];
/** Explicit references retain registered visibility and survive host additive codegen. */
export function runtimeAgentReference<Name extends keyof RuntimeApi>(name: Name): RuntimeApi[Name] {
  return makeFunctionReference(`runtimeAgent:${name}`) as unknown as RuntimeApi[Name];
}
