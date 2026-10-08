import { ConvexHttpClient, type ConvexClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

/** Keep deployment credentials on each nonreactive request. WebSocket auth errors
 * may reconnect anonymously; CLI commands must never inherit that downgrade.
 */
export function initializeKeyedHttpTransport(
  transport: ConvexClient,
  url: string,
  key: string,
  logger: NonNullable<ConstructorParameters<typeof ConvexHttpClient>[1]>["logger"] = false,
): void {
  const lifetime = new AbortController();
  const http = new ConvexHttpClient(url, {
    logger,
    fetch: (input, init) => fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([lifetime.signal, init.signal])
        : lifetime.signal,
    }),
  });
  // The pinned runtime exposes admin auth, but omits it from public declarations.
  const capability: unknown = http;
  if (
    !capability || typeof capability !== "object" ||
    !("setAdminAuth" in capability) ||
    typeof capability.setAdminAuth !== "function"
  ) {
    throw new Error(
      "Installed Convex client does not support deployment-key admin authentication; use the pinned supported CLI dependency",
    );
  }
  try {
    capability.setAdminAuth(key);
  } catch {
    throw new Error(
      "Could not apply deployment credentials; verify deployment-key capability and credentials",
    );
  }
  const redact = async <T>(request: Promise<T>): Promise<T> => {
    try {
      return await request;
    } catch (error) {
      if (error instanceof Error)
        error.message = error.message.split(key).join("***");
      throw error;
    }
  };
  const close = transport.close.bind(transport);
  transport.query = (reference, ...args) => redact(http.query(reference, ...args));
  // CLI mutations use server execution only, with no optimistic update callback.
  transport.mutation = (reference, args) =>
    redact(http.mutation(reference as FunctionReference<"mutation">, args));
  transport.action = (reference, ...args) => redact(http.action(reference, ...args));
  transport.close = () => {
    lifetime.abort();
    return close();
  };
}
