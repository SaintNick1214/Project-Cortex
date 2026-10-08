import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { api } from "../../../convex-dev/_generated/api";
import { isRegistryStatisticsUnavailable } from "../../../src/agents/statistics";
import { AgentsAPI } from "../../../src/agents";
import { MemorySpacesAPI } from "../../../src/memorySpaces";
import { ResilienceLayer } from "../../../src/resilience";

const row = {
  _id: "owned-agent" as Id<"agents">, _creationTime: 1,
  agentId: "agent-a", name: "Official profile", metadata: { source: "official" }, config: {},
  tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: "principal-a",
  status: "active", registeredAt: 1, updatedAt: 2,
} satisfies Exclude<FunctionReturnType<typeof api.agents.get>, null>;
function unavailable() {
  return new ConvexError({ version: 1, code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input", retryable: false, outcome: "not_dispatched" });
}

describe.each(["absent", "disabled", "enabled"] as const)("explicit stats bridge resilience=%s", (mode) => {
  let client: ConvexClient;
  let resilience: ResilienceLayer;
  afterEach(async () => { await client.close(); await resilience.shutdown(); jest.restoreAllMocks(); });
  function fixture() {
    client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
    const retry = jest.fn(); const circuitOpen = jest.fn();
    resilience = new ResilienceLayer({ enabled: mode === "enabled", retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false }, onRetry: retry, onCircuitOpen: circuitOpen });
    const query = jest.spyOn(client, "query"); const mutation = jest.spyOn(client, "mutation"); const action = jest.spyOn(client, "action");
    const auth = { userId: "user-a", tenantId: "tenant-a" };
    const layer = mode === "absent" ? undefined : resilience;
    return { query, mutation, action, retry, circuitOpen, agents: new AgentsAPI(client, undefined, layer, auth), spaces: new MemorySpacesAPI(client, undefined, layer, auth) };
  }

  it("get returns official readable profile without implicit stats lookup", async () => {
    const f = fixture(); f.query.mockResolvedValueOnce(row).mockRejectedValue(unavailable());
    const result = await f.agents.get("agent-a", { memorySpaceId: "space-a" });
    expect(result).toEqual({ id: row.agentId, tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, name: row.name, description: undefined, metadata: row.metadata, config: row.config, status: row.status, registeredAt: row.registeredAt, updatedAt: row.updatedAt, lastActive: undefined });
    expect(result).not.toHaveProperty("stats");
    expect(f.query).toHaveBeenCalledTimes(1); expect(f.mutation).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
  });

  it("export requested stats preserves exact typed unready failure and selected-row scope", async () => {
    const f = fixture(); const error = unavailable(); f.query.mockResolvedValueOnce([row]).mockRejectedValue(error);
    await expect(f.agents.export({ format: "json", includeStats: true, filters: { memorySpaceId: "space-a" } })).rejects.toBe(error);
    expect(JSON.parse(JSON.stringify(error.data))).toEqual({ version: 1, code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input", retryable: false, outcome: "not_dispatched" });
    expect(f.query).toHaveBeenCalledTimes(2);
    expect(f.query.mock.calls[1]).toEqual([api.agents.computeStats, { agentId: "agent-a", tenantId: "tenant-a", memorySpaceId: "space-a" }]);
    expect(f.circuitOpen).not.toHaveBeenCalled(); expect(f.retry).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
  });

  it("export without stats remains a profile-only operation", async () => {
    const f = fixture(); f.query.mockResolvedValueOnce([row]).mockRejectedValue(unavailable());
    const result = await f.agents.export({ format: "json", includeStats: false });
    expect(JSON.parse(result.data)).toEqual([expect.objectContaining({ id: "agent-a", name: "Official profile", memorySpaceId: "space-a" })]);
    expect(JSON.parse(result.data)[0]).not.toHaveProperty("stats"); expect(f.query).toHaveBeenCalledTimes(1);
  });

  it("explicit export denies configured tenant mismatch without stats transport", async () => {
    const f = fixture(); f.query.mockResolvedValue([{ ...row, tenantId: "tenant-other" }]);
    await expect(f.agents.export({ format: "json", includeStats: true })).rejects.toMatchObject({ code: "TENANT_SCOPE_MISMATCH" });
    expect(f.query).toHaveBeenCalledTimes(1); expect(f.mutation).not.toHaveBeenCalled();
  });

  it("memory-space stats forwards concrete selectors and preserves typed unready", async () => {
    const f = fixture(); const error = unavailable(); f.query.mockRejectedValue(error);
    await expect(f.spaces.getStats("space-a", { tenantId: "tenant-a", timeWindow: "7d", includeParticipants: true })).rejects.toBe(error);
    expect(f.query).toHaveBeenCalledWith(api.memorySpaces.getStats, { memorySpaceId: "space-a", tenantId: "tenant-a", timeWindow: "7d", includeParticipants: true });
    expect(f.query).toHaveBeenCalledTimes(1); expect(f.retry).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
  });

  it("memory-space stats rejects tenant mismatch and invalid target before transport", async () => {
    const f = fixture();
    await expect(f.spaces.getStats("space-a", { tenantId: "tenant-other" })).rejects.toMatchObject({ code: "TENANT_SCOPE_MISMATCH" });
    await expect(f.spaces.getStats("")).rejects.toMatchObject({ name: "MemorySpaceValidationError" });
    expect(f.query).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
  });
  it.each([
    { data: "MEMORY_SPACE_NOT_FOUND", message: "MEMORY_SPACE_NOT_FOUND" },
    { data: { code: "NOT_AUTHORIZED", message: "Access denied" }, message: JSON.stringify({ code: "NOT_AUTHORIZED", message: "Access denied" }) },
  ])("ordinary native error $message retains baseline normalization alongside pending capability", async ({ data, message }) => {
    const f = fixture(); const ordinary = new ConvexError(data); const pending = unavailable();
    f.query.mockRejectedValue(ordinary);
    const normalized = await f.spaces.getStats("space-a").catch((error: unknown) => error);
    expect(normalized).toBeInstanceOf(Error);
    expect(normalized).not.toBeInstanceOf(ConvexError);
    expect(normalized).not.toBe(ordinary);
    expect(normalized).toMatchObject({ name: "Error", message });
    expect(normalized).not.toHaveProperty("data");
    const ordinaryAttempts = mode === "enabled" && data === "MEMORY_SPACE_NOT_FOUND" ? 3 : 1;
    expect(f.query).toHaveBeenCalledTimes(ordinaryAttempts);
    f.query.mockRejectedValue(pending);
    await expect(f.spaces.getStats("space-a")).rejects.toBe(pending);
    expect(f.query).toHaveBeenCalledTimes(ordinaryAttempts + 1);
    expect(f.query.mock.calls.every((call) => call[1].tenantId === "tenant-a" && call[1].memorySpaceId === "space-a")).toBe(true);
    expect(f.retry).toHaveBeenCalledTimes(ordinaryAttempts - 1); expect(f.circuitOpen).not.toHaveBeenCalled();
    expect(f.mutation).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
  });

  it("unexpected infrastructure errors remain failures rather than fake stats", async () => {
    const f = fixture(); const error = new Error("unexpected statistics infrastructure failure");
    f.query.mockResolvedValueOnce([row]).mockRejectedValue(error);
    await expect(f.agents.export({ format: "json", includeStats: true })).rejects.toBe(error);
    f.query.mockRejectedValue(error);
    await expect(f.spaces.getStats("space-a")).rejects.toBe(error);
    expect(f.circuitOpen).not.toHaveBeenCalled(); expect(f.retry).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
  });

});

describe("exact capability envelope inspection", () => {
  it("recognizes the native static envelope and does not read its lazy stack", () => {
    const error = unavailable(); const stackGetter = jest.fn(() => { throw new Error("private stack"); });
    Object.defineProperty(error, "stack", { get: stackGetter });
    expect(isRegistryStatisticsUnavailable(error)).toBe(true);
    expect(stackGetter).not.toHaveBeenCalled();
  });

  it.each(["version", "code", "message", "retryable", "outcome"] as const)("rejects a getter in %s without invoking it", (key) => {
    const error = unavailable(); const getter = jest.fn(() => { throw new Error("private envelope getter"); });
    Object.defineProperty(error.data, key, { get: getter });
    expect(isRegistryStatisticsUnavailable(error)).toBe(false); expect(getter).not.toHaveBeenCalled();
  });

  it("rejects a data getter without invoking it", () => {
    const error = unavailable(); const getter = jest.fn(() => { throw new Error("private data getter"); });
    Object.defineProperty(error, "data", { get: getter });
    expect(isRegistryStatisticsUnavailable(error)).toBe(false); expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    { code: "CAPABILITY_NOT_READY" },
    { version: 2, code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input", retryable: false, outcome: "not_dispatched" },
    { version: 1, code: "CAPABILITY_NOT_READY", message: "private message", retryable: false, outcome: "not_dispatched" },
    { version: 1, code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input", retryable: true, outcome: "not_dispatched" },
    { version: 1, code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input", retryable: false, outcome: "committed" },
    { version: 1, code: "CAPABILITY_NOT_READY", message: "Access denied or invalid registry input", retryable: false, outcome: "not_dispatched", privateCause: "secret" },
  ])("rejects malformed/extra/private static data %j", (data) => {
    expect(isRegistryStatisticsUnavailable(new ConvexError(data))).toBe(false);
  });

  it("rejects private wrapper properties and modified messages", () => {
    const error = unavailable(); Object.defineProperty(error, "cause", { value: "private cause" });
    expect(isRegistryStatisticsUnavailable(error)).toBe(false);
    const altered = unavailable(); altered.message = "private altered wrapper";
    expect(isRegistryStatisticsUnavailable(altered)).toBe(false);
  });

  it("rejects hidden capability fields and private symbol extras", () => {
    const hidden = unavailable(); Object.defineProperty(hidden.data, "code", { enumerable: false });
    expect(isRegistryStatisticsUnavailable(hidden)).toBe(false);
    const privateExtra = unavailable(); Object.defineProperty(privateExtra.data, Symbol("private"), { value: "secret" });
    expect(isRegistryStatisticsUnavailable(privateExtra)).toBe(false);
  });

  it("proxy reflection failures remain infrastructure failures", () => {
    const error = unavailable(); const trap = jest.fn(() => { throw new Error("private proxy trap"); });
    const proxy = new Proxy(error, { ownKeys: trap });
    expect(isRegistryStatisticsUnavailable(proxy)).toBe(false); expect(trap).toHaveBeenCalledTimes(1);
    expect(isRegistryStatisticsUnavailable(new Error("CAPABILITY_NOT_READY"))).toBe(false);
  });
});
