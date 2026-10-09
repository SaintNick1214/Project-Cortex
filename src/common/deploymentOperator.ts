/** Explicit deployment administration; selectors never become JWT authority. */
import type { ConvexClient } from "convex/browser";
import { getFunctionName, makeFunctionReference } from "convex/server";

const deploymentOperatorDomains = new Set([
  "admin", "memories", "facts", "factHistory", "conversations", "memorySpaces",
  "immutable", "graphSync", "agents", "mutable", "artifacts", "attachments",
]);
const operatorClients = new WeakSet<ConvexClient>();

export function isDeploymentOperatorClient(client: ConvexClient): boolean {
  return operatorClients.has(client);
}

/** The initializer must have installed genuine deployment admin authentication.
 * This opt-in changes only function routing and local SDK capability handling.
 * The Convex server independently rejects these internal functions without a key.
 */
export function enableDeploymentOperator(client: ConvexClient): void {
  if (operatorClients.has(client)) return;
  for (const method of ["query", "mutation", "action", "onUpdate"] as const) {
    const original = client[method];
    const routed = (...args: unknown[]) => {
      const reference = args[0] as Parameters<typeof getFunctionName>[0];
      const name = getFunctionName(reference);
      const [domain, operation] = name.split(":");
      if (deploymentOperatorDomains.has(domain) && operation) args[0] = makeFunctionReference(`cliOperator/${domain}:${operation}`);
      return Reflect.apply(original, client, args);
    };
    // The wrapper preserves every argument/return and changes only the reference.
    Object.defineProperty(client, method, { configurable: true, writable: true, value: routed });
  }
  operatorClients.add(client);
}
