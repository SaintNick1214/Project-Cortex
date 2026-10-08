import { ConvexHttpClient, type ConvexClient } from "convex/browser";
import { getFunctionName, makeFunctionReference, type FunctionReturnType } from "convex/server";

const operatorDomains = new Set([
  "memories", "facts", "factHistory", "conversations", "memorySpaces", "immutable", "graphSync",
]);

/** The deployment key authorizes internal administration. It does not provide the
 * verified runtime authority required by the corresponding public SDK endpoints.
 * These internal services deliberately preserve the audited SDK argument/results.
 */
function deploymentOperatorReference<T extends Parameters<typeof getFunctionName>[0]>(reference: T): T {
  const name = getFunctionName(reference);
  const [domain] = name.split(":");
  if (!operatorDomains.has(domain)) return reference;
  // Routing changes only the selected service path, preserving its SDK contract.
  return makeFunctionReference(`cliOperator/${name}`) as unknown as T;
}

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
    typeof capability.setAdminAuth !== "function" ||
    !("function" in capability) || typeof capability.function !== "function"
  ) {
    throw new Error(
      "Installed Convex client does not support deployment-key internal function execution; use the pinned supported CLI dependency",
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
  // /api/query, /api/mutation and /api/action accept public registrations only.
  // The pinned official function API preserves native codecs and permits internal
  // registrations only when the server accepts this selected deployment key.
  const admin = capability as {
    function<F extends Parameters<typeof getFunctionName>[0]>(
      reference: F, componentPath: undefined, args: unknown,
    ): Promise<Awaited<FunctionReturnType<F>>>;
  };
  const close = transport.close.bind(transport);
  transport.query = (reference, ...args) => redact(admin.function(deploymentOperatorReference(reference), undefined, args[0]));
  // CLI mutations use server execution only, with no optimistic update callback.
  transport.mutation = (reference, args) =>
    redact(admin.function(deploymentOperatorReference(reference), undefined, args));
  transport.action = (reference, ...args) => redact(admin.function(deploymentOperatorReference(reference), undefined, args[0]));
  transport.close = () => {
    lifetime.abort();
    return close();
  };
}
