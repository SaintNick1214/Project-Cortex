import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bearer, hostToken, runtimeConfig, withRuntime } from "../cortex.js";
import { config, runtimeMock } from "./helpers/test-utils.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe("verified remote configuration", () => {
  it("configuration labels are selectors, with no user or model credential defaults", () => {
    expect(runtimeConfig({ CONVEX_URL: "https://test.convex.cloud" })).toEqual({ deploymentUrl: "https://test.convex.cloud", agentId: "basic-assistant", agentVersion: 1, timeoutMs: 30000 });
  });
  it("consumes the additive setup's public selectors with explicit Basic overrides", () => {
    expect(runtimeConfig({ NEXT_PUBLIC_CONVEX_URL: config.deploymentUrl, NEXT_PUBLIC_CORTEX_AGENT_ID: "published-agent", NEXT_PUBLIC_CORTEX_AGENT_VERSION: "2", NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID: "published-space" })).toMatchObject({ deploymentUrl: config.deploymentUrl, agentId: "published-agent", agentVersion: 2, memorySpaceId: "published-space" });
    expect(runtimeConfig({ NEXT_PUBLIC_CONVEX_URL: config.deploymentUrl, NEXT_PUBLIC_CORTEX_AGENT_ID: "published-agent", AGENT_ID: "explicit-agent" }).agentId).toBe("explicit-agent");
  });
  it.each(["", "not-url", "http://foreign.test", "https://u:p@host.test", "https://host.test/?token=private"])("rejects invalid deployment %s before client allocation", url => { expect(() => runtimeConfig({ CONVEX_URL: url })).toThrow(); });
  it.each(["0", "NaN", "1.5"])("rejects invalid published version %s", version => { expect(() => runtimeConfig({ CONVEX_URL: config.deploymentUrl, AGENT_VERSION: version })).toThrow(); });
  it.each(["0", "120001", "NaN"])("rejects invalid deadline %s", timeout => { expect(() => runtimeConfig({ CONVEX_URL: config.deploymentUrl, RUNTIME_TIMEOUT_MS: timeout })).toThrow(); });
  it("permits only explicit loopback HTTP for development", () => { expect(runtimeConfig({ CONVEX_URL: "http://127.0.0.1:3210" }).deploymentUrl).toContain("127.0.0.1"); });
  it.each([undefined, "", "Basic key", "Bearer ", "Bearer token with spaces", `Bearer ${"x".repeat(32769)}`])("rejects missing or malformed caller auth", token => { expect(() => bearer(token)).toThrow("UNAUTHENTICATED"); });
  it("passes an opaque Bearer token only to the official callback", () => { expect(bearer("Bearer opaque-jwt")).toBe("opaque-jwt"); });
  it("rereads replaced host tokens without a singleton or secret output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cortex-basic-token-")), file = join(directory, "token");
    try { await writeFile(file, "old-jwt\n", { mode: 0o600 }); expect(await hostToken({ CORTEX_AUTH_TOKEN_FILE: file })).toBe("old-jwt");
      await writeFile(file, "renewed-jwt\n"); expect(await hostToken({ CORTEX_AUTH_TOKEN_FILE: file })).toBe("renewed-jwt");
      await writeFile(file, "x".repeat(32769)); await expect(hostToken({ CORTEX_AUTH_TOKEN_FILE: file })).rejects.toThrow("INVALID_HOST_TOKEN");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
describe("per-operation client ownership", () => {
  it("pins selectors and closes after a verified positive", async () => {
    const f = runtimeMock(), factory = vi.fn(() => f.client);
    expect(await withRuntime(async () => "token", async () => "result", { config, factory })).toBe("result");
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ scope: { tenantId: "tenant", memorySpaceId: "space" }, authTimeoutMs: 10000, requestTimeoutMs: 12000 }));
    expect(f.client.session).toHaveBeenCalledTimes(2); expect(f.client.close).toHaveBeenCalledOnce();
  });
  it("closes on failed authentication without invoking the work", async () => {
    const f = runtimeMock(), work = vi.fn(); f.client.session.mockRejectedValue(new Error("private auth diagnostics"));
    await expect(withRuntime(async () => "token", work, { config, factory: () => f.client })).rejects.toThrow();
    expect(work).not.toHaveBeenCalled(); expect(f.client.close).toHaveBeenCalledOnce();
  });
  it("suppresses a delayed result when the verified principal changes", async () => {
    const f = runtimeMock(); f.client.session.mockResolvedValueOnce(f.verified).mockResolvedValueOnce({ ...f.verified, principalId: "different" });
    await expect(withRuntime(async () => "token", async () => "private output", { config, factory: () => f.client })).rejects.toThrow("SESSION_CHANGED");
    expect(f.client.close).toHaveBeenCalledOnce();
  });
  it("deadline closes local ownership without retry or upstream cancellation", async () => {
    vi.useFakeTimers(); const f = runtimeMock(), work = vi.fn(() => new Promise<string>(() => {}));
    const pending = withRuntime(async () => "token", work, { config: { ...config, timeoutMs: 10 }, factory: () => f.client });
    const assertion = expect(pending).rejects.toThrow("REQUEST_DEADLINE_EXCEEDED"); await vi.advanceTimersByTimeAsync(11); await assertion;
    expect(work).toHaveBeenCalledOnce(); expect(f.client.close).toHaveBeenCalledOnce(); expect(f.client.cancel).not.toHaveBeenCalled();
  });
  it("pre-aborted work never allocates a client", async () => {
    const controller = new AbortController(); controller.abort(); const factory = vi.fn(() => runtimeMock().client);
    await expect(withRuntime(async () => "token", async () => null, { config, factory, signal: controller.signal })).rejects.toThrow("REQUEST_ABORTED"); expect(factory).not.toHaveBeenCalled();
  });
  it("operation failure closes exactly once and is never resubmitted", async () => {
    const f = runtimeMock(), work = vi.fn(async () => { throw new Error("failed"); });
    await expect(withRuntime(async () => "token", work, { config, factory: () => f.client })).rejects.toThrow("failed"); expect(work).toHaveBeenCalledOnce(); expect(f.client.close).toHaveBeenCalledOnce();
  });
});
