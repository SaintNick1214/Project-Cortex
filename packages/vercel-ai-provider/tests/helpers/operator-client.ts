/** Explicit deployment operator for server-provider native integration fixtures. */
import { Cortex as SDK, type CortexConfig } from "@cortexmemory/sdk";
import { serverRuntimeOptions } from "../../src/server-credentials";

export function nativeProviderCredentials(url: string) {
  const key = process.env.CONVEX_DEPLOY_KEY;
  if (!url || url !== process.env.CONVEX_URL || url !== process.env.CORTEX_TEST_EXPECTED_CONVEX_URL ||
      typeof key !== "string" || !key.trim() || /[\r\n\0]/.test(key))
    throw new Error("Provider integration requires an exact expected native target and deployment key.");
  return { deploymentKey: key };
}
export class Cortex extends SDK {
  constructor(config: CortexConfig) {
    super({ ...config, convexLogger: false, resilience: { enabled: false } }, serverRuntimeOptions(nativeProviderCredentials(config.convexUrl)));
  }
}
