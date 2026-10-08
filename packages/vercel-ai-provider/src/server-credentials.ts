import type { CortexRuntimeOptions } from "@cortexmemory/sdk";
import type { CortexServerCredentials } from "./types";

/** Private compatibility seam for the native admin setter omitted by public declarations. */
export function serverRuntimeOptions(credentials?: CortexServerCredentials): CortexRuntimeOptions | undefined {
  if (credentials === undefined) return undefined;
  if (typeof window !== "undefined" || typeof document !== "undefined") {
    throw new Error("Cortex server credentials require a server context.");
  }
  let key: string;
  try {
    const value: unknown = credentials?.deploymentKey;
    if (typeof value !== "string" || !value.trim()) throw new Error();
    key = value;
  } catch {
    throw new Error("Cortex server credentials require a nonempty deployment key.");
  }
  return { initializeTransport(client) {
    try {
      const setter = (client as unknown as { setAdminAuth?: (key: string) => void }).setAdminAuth;
      if (typeof setter !== "function") throw new Error("Missing native admin transport.");
      setter.call(client, key);
      return undefined;
    } catch {
      throw new Error("Cortex server transport authentication initialization failed.");
    }
  } };
}
