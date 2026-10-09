/** Explicit deployment administration for legacy API integration tests.
 * Public/JWT security tests must continue importing the public SDK directly. */
import { ConvexClient as PublicConvexClient } from "convex/browser";
import { Cortex as PublicCortex, type CortexConfig, type CortexRuntimeOptions } from "../../src";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
export * from "../../src";

export function testDeploymentKey(url: string): string {
  if (!process.env.CORTEX_TEST_EXPECTED_CONVEX_URL || url !== process.env.CORTEX_TEST_EXPECTED_CONVEX_URL)
    throw new Error("Operator tests require an exact dedicated CORTEX_TEST_EXPECTED_CONVEX_URL target.");
  const key = process.env.CONVEX_DEPLOY_KEY;
  if (!key?.trim()) throw new Error("Operator tests require deployment authentication.");
  return key;
}

function authenticate(client: PublicConvexClient, key: string): undefined {
  // Native administrative authentication exists at runtime but is deliberately
  // omitted from Convex's browser-facing declarations.
  const transport = client as unknown as { setAdminAuth(key: string): void };
  if (typeof transport.setAdminAuth !== "function") throw new Error("Native administrative test transport is unavailable.");
  transport.setAdminAuth(key);
  return undefined;
}

export class Cortex extends PublicCortex {
  constructor(config: CortexConfig, runtime?: CortexRuntimeOptions) {
    if (runtime || config.fetchAuthToken) throw new Error("Operator test fixtures must be separate from public JWT transports.");
    const key = testDeploymentKey(config.convexUrl);
    super(config, { deploymentOperator: true, initializeTransport: client => authenticate(client, key) });
  }
}

export class ConvexClient extends PublicConvexClient {
  constructor(url: string, options?: ConstructorParameters<typeof PublicConvexClient>[1], tenantId?: string) {
    const key = testDeploymentKey(url);
    super(url, options);
    authenticate(this, key);
    enableDeploymentOperator(this);
    if (tenantId !== undefined) {
      for (const method of ["query", "mutation", "action"] as const) {
        const original = this[method];
        Object.defineProperty(this, method, { value: (...args: unknown[]) => {
          args[1] = { tenantId, ...args[1] as Record<string, unknown> };
          return Reflect.apply(original, this, args);
        } });
      }
    }
  }
}
