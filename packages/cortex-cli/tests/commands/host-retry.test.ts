/** Compose actual SDK user updates and resilience with a controlled RPC/session peer. */
import { afterEach, expect, it, jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import type { AuthContext } from "../../../../src/auth/types.js";
import { ResilienceLayer } from "../../../../src/resilience/index.js";
import type { ResilienceConfig } from "../../../../src/resilience/index.js";
import { UsersAPI } from "../../../../src/users/index.js";
let effects = 0, failureDelivered = false;
const owned: ComposedCortex[] = [];
class ComposedCortex {
  readonly resilience: ResilienceLayer;
  readonly users: UsersAPI;
  readonly port = {
    query: async () => null,
    mutation: async (reference: Parameters<typeof getFunctionName>[0]) => {
      if (getFunctionName(reference) !== "immutable:store") return null;
      effects++;
      return { id: "user", tenantId: "tenant", data: { name: "Updated" }, version: effects, createdAt: 1, updatedAt: 2 };
    },
    action: async () => null,
  };
  constructor(options: { resilience?: ResilienceConfig; auth: AuthContext }) {
    this.resilience = new ResilienceLayer({ ...options.resilience, retry: { initialDelayMs: 1, maxDelayMs: 1, jitter: false } });
    this.users = new UsersAPI(this.port as unknown as ConvexClient, undefined, this.resilience, options.auth);
    owned.push(this);
  }
  getClient() { return this.port; }
  close() { this.resilience.stopQueueProcessor(); }
}
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ Cortex: ComposedCortex }));
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: class {
  setAuth() {}
  async mutation() {
    if (effects > 0 && !failureDelivered) { failureDelivered = true; throw new Error("AUTH_SESSION_TIMEOUT"); }
    return { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "principal", userId: "user", deliveryExpiresAt: Date.now() + 60000 };
  }
} }));
const { withClient, closeClient, configureClientOptions } = await import("../../src/utils/client.js");
afterEach(() => { closeClient(); for (const client of owned.splice(0)) client.close(); delete process.env.CORTEX_AUTH_TOKEN; });
it("never retries a committed retained user version after uncertain post-effect session delivery", async () => {
  effects = 0; failureDelivered = false; configureClientOptions({}); process.env.CORTEX_AUTH_TOKEN = "a.b.c";
  const config = { deployments: { test: { url: "https://fixture.convex.cloud" } }, default: "test", format: "json" as const, confirmDangerous: true };
  await expect(withClient(config, {}, async client => client.users.update("user", { name: "Updated" }))).rejects.toThrow("AUTH_SESSION_TIMEOUT");
  expect(effects).toBe(1);
  expect(failureDelivered).toBe(true);
});
