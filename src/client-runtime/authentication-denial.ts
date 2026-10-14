import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import type { RuntimeScope } from "./types.js";

const sessionRef = makeFunctionReference<"mutation">("runtimeClient:session");

/** A server refusal can end a silent WebSocket handshake. HTTP success cannot
 * authenticate it. This reads the existing session handler and never retries. */
export function probeAuthenticationDenial(options: {
  deploymentUrl: string; token: string; scope: Partial<RuntimeScope>;
  fetch?: typeof globalThis.fetch; active: () => boolean; denied: () => void;
}): () => void {
  const controller = new AbortController();
  let client: ConvexHttpClient | undefined;
  const deny = () => {
    if (!controller.signal.aborted && options.active()) options.denied();
  };
  try {
    const origin = new URL(options.deploymentUrl).origin;
    const fetchPort = options.fetch ?? globalThis.fetch;
    client = new ConvexHttpClient(options.deploymentUrl, { logger: false, fetch: async (input, init) => {
      // The official client constructs this URL; refuse any destination drift.
      if (new URL(String(input)).origin !== origin) throw new Error("AUTH_PROBE_ORIGIN_CHANGED");
      const response = await fetchPort(input, { ...init, redirect: "error", cache: "no-store",
        signal: init?.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal });
      if (response.status === 401) deny();
      return response;
    } });
    client.setAuth(options.token);
    void client.mutation(sessionRef, { ...options.scope }).catch(error => {
      // Only the official structured refusal is evidence. Network errors,
      // arbitrary messages, other codes and successful bodies decide nothing.
      const data: unknown = error instanceof ConvexError ? error.data : undefined;
      if (data !== null && typeof data === "object" && !Array.isArray(data)
        && Object.getOwnPropertyDescriptor(data, "code")?.value === "UNAUTHENTICATED") deny();
    }).finally(() => client?.clearAuth()).catch(() => {});
  } catch { /* Keep the original finite WebSocket handshake on local/probe failures. */ }
  return () => { controller.abort(); client?.clearAuth(); };
}
