import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ConvexClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { api } from "../../../convex-dev/_generated/api";
import { AgentsAPI, AgentRegistryWriteReceiptError, AgentRegistryCapabilityError, AgentRegistryCommittedResultError } from "../../../src/agents";
import { ResilienceLayer } from "../../../src/resilience";
import type { GraphAdapter } from "../../../src/graph/types";
import { createTestRunContext } from "../../helpers/isolation";
import { TestCleanup, TestCleanupCapabilityError, ScopedCleanup } from "../../helpers/cleanup";

type RegisterResult = FunctionReturnType<typeof api.agents.register>;
const row = {
  _id: "owned-agent-document" as Id<"agents">, _creationTime: 1,
  agentId: "server-agent", name: "Server canonical", tenantId: "tenant-a", memorySpaceId: "space-a",
  ownerPrincipalId: "principal-a", metadata: { team: "server" }, config: { model: "server" },
  status: "active", registeredAt: 10, updatedAt: 20,
} satisfies Exclude<RegisterResult, null | { accepted: true }>;
const receipt = { accepted: true, resourceType: "agents", resourceId: "server-agent" } satisfies Extract<RegisterResult, { accepted: true }>;

function fixture(mode: "absent" | "disabled" | "enabled") {
  const client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
  const mutation = jest.spyOn(client, "mutation");
  const query = jest.spyOn(client, "query");
  const action = jest.spyOn(client, "action");
  const retry = jest.fn();
  const resilience = new ResilienceLayer({ enabled: mode === "enabled", retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1, jitter: false }, onRetry: retry });
  const execute = jest.spyOn(resilience, "execute");
  const createNode = jest.fn<GraphAdapter["createNode"]>().mockResolvedValue("graph-agent");
  // Only createNode is used by this bounded registry bridge; other graph methods fail if called.
  const graph = { createNode } as unknown as GraphAdapter;
  const agents = new AgentsAPI(client, graph, mode === "absent" ? undefined : resilience, { userId: "sdk-user", tenantId: "tenant-a" });
  return { client, mutation, query, action, retry, resilience, execute, createNode, agents };
}

describe.each(["absent", "disabled", "enabled"] as const)("registry bridge resilience=%s", (mode) => {
  let current: ReturnType<typeof fixture>;
  afterEach(async () => { await current.client.close(); await current.resilience.shutdown(); jest.restoreAllMocks(); });

  it.each(["register", "update"] as const)("%s receipt is committed, exact and never retried or hydrated", async (operation) => {
    current = fixture(mode);
    current.mutation.mockResolvedValue(receipt);
    const call = operation === "register"
      ? current.agents.register({ id: "server-agent", name: "Input", memorySpaceId: "space-a" })
      : current.agents.update("server-agent", { name: "Input", memorySpaceId: "space-a" });
    const error = await call.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AgentRegistryWriteReceiptError);
    expect(error).toMatchObject({ code: "AGENT_REGISTRY_WRITE_COMMITTED_READ_UNAVAILABLE", retryable: false, outcome: "committed", requiredCapability: "read", receipt });
    expect(Object.keys((error as AgentRegistryWriteReceiptError).receipt).sort()).toEqual(["accepted", "resourceId", "resourceType"]);
    expect(Object.isFrozen((error as AgentRegistryWriteReceiptError).receipt)).toBe(true);
    expect(current.mutation).toHaveBeenCalledTimes(1);
    expect(current.mutation.mock.calls[0][1]).toMatchObject({ tenantId: "tenant-a", memorySpaceId: "space-a" });
    expect(current.query).not.toHaveBeenCalled();
    expect(current.createNode).not.toHaveBeenCalled();
    expect(current.action).not.toHaveBeenCalled();
    expect(current.retry).not.toHaveBeenCalled();
    expect(current.execute.mock.calls.map((call) => call[1])).toEqual(mode === "absent" ? [] : [`agents:${operation}`]);
  });

  it.each(["register", "update"] as const)("%s maps the readable official row and runs poststeps once", async (operation) => {
    current = fixture(mode); current.mutation.mockResolvedValue(row); current.query.mockRejectedValue(new Error("statistics unavailable"));
    const result = operation === "register"
      ? await current.agents.register({ id: "server-agent", name: "Input" })
      : await current.agents.update("server-agent", { name: "Input" });
    expect(result).toEqual({ id: row.agentId, tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, name: row.name, description: undefined, metadata: row.metadata, config: row.config, status: row.status, registeredAt: row.registeredAt, updatedAt: row.updatedAt, lastActive: undefined });
    expect(current.query).not.toHaveBeenCalled();
    expect(current.mutation).toHaveBeenCalledTimes(1);
    expect(current.createNode).toHaveBeenCalledTimes(operation === "register" ? 1 : 0);
  });

  it("invalid input and conflicting tenant reject before transport", async () => {
    current = fixture(mode);
    await expect(current.agents.register({ id: "", name: "Input" })).rejects.toMatchObject({ name: "AgentValidationError" });
    await expect(current.agents.register({ id: "agent", name: "Input", tenantId: "tenant-other" })).rejects.toMatchObject({ code: "TENANT_SCOPE_MISMATCH" });
    await expect(current.agents.list({ tenantId: "tenant-other" })).rejects.toMatchObject({ code: "TENANT_SCOPE_MISMATCH" });
    expect(current.mutation).not.toHaveBeenCalled(); expect(current.query).not.toHaveBeenCalled();
  });

  it("backend failure remains failure without local poststeps", async () => {
    current = fixture(mode); current.mutation.mockRejectedValue(new Error("permission denied"));
    await expect(current.agents.register({ id: "agent", name: "Input" })).rejects.toThrow("permission denied");
    expect(current.query).not.toHaveBeenCalled(); expect(current.createNode).not.toHaveBeenCalled();
  });

  it("single and bulk cascade fail before discovering or deleting children", async () => {
    current = fixture(mode);
    await expect(current.agents.unregister("agent", { cascade: true })).rejects.toBeInstanceOf(AgentRegistryCapabilityError);
    await expect(current.agents.unregisterMany({}, { cascade: true })).rejects.toBeInstanceOf(AgentRegistryCapabilityError);
    expect(current.mutation).not.toHaveBeenCalled(); expect(current.query).not.toHaveBeenCalled(); expect(current.createNode).not.toHaveBeenCalled();
  });

  it("unexpected missing bulk IDs reports committed count without invented IDs", async () => {
    current = fixture(mode); current.query.mockResolvedValue([row]); current.mutation.mockResolvedValue({ deleted: 1 });
    const error = await current.agents.unregisterMany({ memorySpaceId: "space-a" }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AgentRegistryCommittedResultError);
    expect(error).toMatchObject({ name: "AgentRegistryCommittedResultError", outcome: "committed", retryable: false, deleted: 1 });
    expect(current.mutation).toHaveBeenCalledTimes(1); expect(current.retry).not.toHaveBeenCalled();
  });

  it("get and exists propagate verified-selector requests without metadata impersonation", async () => {
    current = fixture(mode); current.query.mockResolvedValue(null);
    await expect(current.agents.get("agent", { memorySpaceId: "space-a" })).resolves.toBeNull();
    current.query.mockResolvedValue(false);
    await expect(current.agents.exists("agent", { memorySpaceId: "space-a" })).resolves.toBe(false);
    expect(current.query.mock.calls.map((call) => call[1])).toEqual([{ tenantId: "tenant-a", memorySpaceId: "space-a", agentId: "agent" }, { tenantId: "tenant-a", memorySpaceId: "space-a", agentId: "agent" }]);
    expect(current.action).not.toHaveBeenCalled();
  });
  it("list, count and configure propagate scope; readable list keeps official scope", async () => {
    current = fixture(mode); current.query.mockResolvedValueOnce([row]).mockResolvedValueOnce(1);
    await expect(current.agents.list({ memorySpaceId: "space-a" })).resolves.toEqual([expect.objectContaining({ id: row.agentId, tenantId: "tenant-a", memorySpaceId: "space-a" })]);
    await expect(current.agents.count({ memorySpaceId: "space-a" })).resolves.toBe(1);
    current.mutation.mockResolvedValue(receipt);
    await expect(current.agents.configure("agent", { model: "requested" }, { memorySpaceId: "space-a" })).resolves.toBeUndefined();
    expect(current.query.mock.calls.every((call) => call[1].tenantId === "tenant-a" && call[1].memorySpaceId === "space-a")).toBe(true);
    expect(current.mutation.mock.calls[0][1]).toMatchObject({ tenantId: "tenant-a", memorySpaceId: "space-a", config: { model: "requested" } });
    expect(current.createNode).not.toHaveBeenCalled();
  });

  it("explicit bulk IDs and simple unregister preserve server-confirmed results", async () => {
    current = fixture(mode); current.query.mockResolvedValue([row]); current.mutation.mockResolvedValueOnce({ deleted: 1, agentIds: [row.agentId] }).mockResolvedValueOnce({ deleted: true, agentId: row.agentId });
    await expect(current.agents.unregisterMany({ memorySpaceId: "space-a" })).resolves.toEqual({ deleted: 1, agentIds: [row.agentId] });
    await expect(current.agents.unregister(row.agentId, { memorySpaceId: "space-a" })).resolves.toMatchObject({ agentId: row.agentId, totalDeleted: 1, deletedLayers: ["agent-registration"], memoriesDeleted: 0, factsDeleted: 0 });
    expect(current.mutation.mock.calls[0][1]).toMatchObject({ agentIds: [row.agentId], tenantId: "tenant-a", memorySpaceId: "space-a" });
    expect(current.mutation.mock.calls[1][1]).toEqual({ agentId: row.agentId, tenantId: "tenant-a", memorySpaceId: "space-a" });
  });

});

describe("global cleanup public-client capability", () => {
  it.each(["purgeMemories", "purgeFacts", "purgeContexts", "purgeMemorySpaces", "purgeAll"] as const)("%s fails before any transport", async (method) => {
    const client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
    const query = jest.spyOn(client, "query"); const mutation = jest.spyOn(client, "mutation"); const action = jest.spyOn(client, "action");
    try {
      await expect(new TestCleanup(client)[method]()).rejects.toBeInstanceOf(TestCleanupCapabilityError);
      expect(query).not.toHaveBeenCalled(); expect(mutation).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
    } finally { await client.close(); jest.restoreAllMocks(); }
  });
  it("scoped memory cleanup deletes only owned per-ID targets", async () => {
    const client = new ConvexClient("https://example.convex.cloud", { disabled: true, logger: false });
    const query = jest.spyOn(client, "query"); const mutation = jest.spyOn(client, "mutation").mockResolvedValue({ deleted: true });
    const context = createTestRunContext(); const owned = context.memorySpaceId("space");
    query.mockResolvedValueOnce({ spaces: [{ memorySpaceId: "foreign-space" }, { memorySpaceId: owned }] }).mockResolvedValueOnce([{ memoryId: "owned-memory" }]);
    try {
      await expect(new ScopedCleanup(client, context).cleanupMemories()).resolves.toBe(1);
      expect(query).toHaveBeenCalledTimes(2);
      expect(mutation).toHaveBeenCalledTimes(1);
      expect(mutation).toHaveBeenCalledWith(api.memories.deleteMemory, { memorySpaceId: owned, memoryId: "owned-memory" });
    } finally { await client.close(); jest.restoreAllMocks(); }
  });

});
