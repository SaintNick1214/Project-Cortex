import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CLIConfig } from "../../types.js";
import { makeFunctionReference } from "convex/server";
let current = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "A", userId: "user-A", deliveryExpiresAt: Date.now() + 60000 };
let response: unknown = { privateValue: "current" }, onRpc: (() => void) | undefined;
const constructed: FakeCortex[] = [];
class FakeCortex {
  closed = false;
  constructor(readonly options: { fetchAuthToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>; auth: { userId: string; tenantId: string } }) { constructed.push(this); }
  readonly port = { query: async () => { onRpc?.(); return response; }, mutation: async () => { onRpc?.(); return response; }, action: async () => { onRpc?.(); return response; } };
  getClient() { return this.port; }
  close() { this.closed = true; }
}
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ Cortex: FakeCortex }));
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: class { setAuth() {} async mutation() { return { ...current }; } } }));
const { createClient, closeClient, withClient, configureClientOptions } = await import("../client.js");
const { credentialSource } = await import("../host-auth.js");
const config: CLIConfig = { deployments: { test: { url: "https://test.convex.cloud", key: "dev:not-a-host-jwt" } }, default: "test", format: "json", confirmDangerous: true };
const directories: string[] = [];
beforeEach(() => { constructed.length = 0; current = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "A", userId: "user-A", deliveryExpiresAt: Date.now() + 60000 }; response = { privateValue: "current" }; onRpc = undefined; configureClientOptions({}); process.env.CORTEX_AUTH_TOKEN = "a.b.c"; });
afterEach(async () => { closeClient(); delete process.env.CORTEX_AUTH_TOKEN; for (const dir of directories.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });
it("requires an actual host credential before constructing any SDK client; deploy keys do not authenticate", async () => {
  delete process.env.CORTEX_AUTH_TOKEN;
  await expect(createClient(config, {})).rejects.toThrow("Host JWT"); expect(constructed).toHaveLength(0);
});
it("never shares client identity for two principals at the same URL and closes each exact owned client", async () => {
  const a = await createClient(config, {}); current = { ...current, principalId: "B", userId: "user-B" }; const b = await createClient(config, {});
  expect(a).not.toBe(b); expect(constructed.map(c => c.options.auth.userId)).toEqual(["user-A", "user-B"]);
  closeClient(a); expect(constructed[0].closed).toBe(true); expect(constructed[1].closed).toBe(false);
});
it.each(["query", "mutation", "action"] as const)("fences %s delivery before command code can receive or print delayed A data", async kind => {
  const a = await createClient(config, {}); onRpc = () => { current = { ...current, principalId: "B", userId: "user-B" }; };
  const port = a.getClient();
  const result = kind === "query" ? port.query(makeFunctionReference<"query">("test:read"), {}) : kind === "mutation" ? port.mutation(makeFunctionReference<"mutation">("test:read"), {}) : port.action(makeFunctionReference<"action">("test:read"), {});
  await expect(result).rejects.toThrow("AUTH_SESSION_CHANGED");
});
it("checks resource delivery deadlines after awaited session confirmation and suppresses expired values", async () => {
  const a = await createClient(config, {});
  response = { metadata: { deliveryExpiresAt: "user-data" }, deliveryExpiresAt: Date.now() + 60000 };
  await expect(a.getClient().mutation(makeFunctionReference<"mutation">("test:read"), {})).resolves.toEqual(response);
  response = [{ privateValue: "expired", deliveryExpiresAt: Date.now() - 1 }];
  await expect(a.getClient().mutation(makeFunctionReference<"mutation">("test:read"), {})).rejects.toThrow("AUTH_DELIVERY_EXPIRED");
});
it("closes on operation failure without turning it into success", async () => {
  await expect(withClient(config, {}, async () => { throw new Error("real-failure"); })).rejects.toThrow("real-failure"); expect(constructed[0].closed).toBe(true);
});
it("forwards official force-refresh requests to a host callback and rejects a changed verified scope", async () => {
  delete process.env.CORTEX_AUTH_TOKEN; const callback = jest.fn(async (request: { forceRefreshToken: boolean }) => { void request; return "a.b.c"; }); await createClient(config, { fetchAuthToken: callback });
  await constructed[0].options.fetchAuthToken({ forceRefreshToken: false }); expect(callback).toHaveBeenLastCalledWith({ forceRefreshToken: false });
  current = { ...current, memorySpaceId: "other" }; await expect(constructed[0].options.fetchAuthToken({ forceRefreshToken: true })).rejects.toThrow("AUTH_SESSION_CHANGED");
});
it("rereads a private rotated token file and rejects insecure files/symlinks without token content", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-cli-auth-test-")); directories.push(dir); const file = path.join(dir, "jwt"), link = path.join(dir, "link");
  await fs.writeFile(file, "first.payload.signature\n", { mode: 0o600 }); const fetch = credentialSource({ tokenFile: file }); expect(await fetch({ forceRefreshToken: false })).toBe("first.payload.signature");
  await fs.writeFile(file, "next.payload.signature\n"); expect(await fetch({ forceRefreshToken: true })).toBe("next.payload.signature");
  await fs.chmod(file, 0o644); await expect(fetch({ forceRefreshToken: true })).rejects.toThrow("Host JWT"); await fs.chmod(file, 0o600); await fs.symlink(file, link);
  await expect(credentialSource({ tokenFile: link })({ forceRefreshToken: true })).rejects.toThrow("Host JWT");
});
it("pins configured selector scope against verified server metadata, not labels or decoded claims", async () => {
  await expect(createClient(config, { tenantId: "foreign" })).rejects.toThrow("INVALID_SESSION"); expect(constructed).toHaveLength(0);
});
