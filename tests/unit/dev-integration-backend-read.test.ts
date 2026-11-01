import { describe, expect, it, jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { readBackend } from "../../src/common/backendRead";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
import { ConversationsAPI } from "../../src/conversations";
import { FactsAPI } from "../../src/facts";
import { collectCandidates } from "../../src/facts/discovery";

function fixture(result: unknown) {
  const query = jest.fn(async (_ref: unknown, _args: unknown) => result);
  const mutation = jest.fn(async (_ref: unknown, _args: unknown) => result);
  const client = {query, mutation, action: jest.fn(), onUpdate: jest.fn()} as unknown as ConvexClient;
  return {client, query, mutation};
}
const name = (value: unknown) => getFunctionName(value as Parameters<typeof getFunctionName>[0]);
describe("incoming operator APIs retain fresh protected public reads", () => {
  it("public protected read issues one mutation with its exact selector and returned value", async () => {
    const result = {current: true}; const f = fixture(result); const args = {memorySpaceId: "space"};
    await expect(readBackend(f.client, makeFunctionReference<"query">("memorySpaces:get"), args)).resolves.toBe(result);
    expect(f.query).not.toHaveBeenCalled(); expect(f.mutation).toHaveBeenCalledTimes(1);
    expect(name(f.mutation.mock.calls[0]![0])).toBe("memorySpaces:get"); expect(f.mutation.mock.calls[0]![1]).toBe(args);
  });
  it("explicit admin mode uses the separate internal legacy query, preserving argument identity", async () => {
    const result = {current: true}; const f = fixture(result); const args = {tenantId: "tenant", memorySpaceId: "space"};
    enableDeploymentOperator(f.client);
    await expect(readBackend(f.client, makeFunctionReference<"mutation">("memorySpaces:get"), args)).resolves.toBe(result);
    expect(f.mutation).not.toHaveBeenCalled(); expect(f.query).toHaveBeenCalledTimes(1);
    expect(name(f.query.mock.calls[0]![0])).toBe("cliOperator/memorySpaces:get"); expect(f.query.mock.calls[0]![1]).toBe(args);
  });
  it("a refused public read propagates without operator fallback or another call", async () => {
    const f = fixture(null); const denial = new Error("FORBIDDEN"); f.mutation.mockRejectedValueOnce(denial);
    await expect(readBackend(f.client, makeFunctionReference<"query">("facts:get"), {})).rejects.toBe(denial);
    expect(f.query).not.toHaveBeenCalled(); expect(f.mutation).toHaveBeenCalledTimes(1);
  });
  it("ordinary conversation list retains the canonical server envelope through a fresh mutation", async () => {
    const result = {conversations: [], total: 0, offset: 0, limit: 50, hasMore: false}; const f = fixture(result);
    const api = new ConversationsAPI(f.client, undefined, undefined, {userId: "actor", tenantId: "tenant"});
    await expect(api.list({memorySpaceId: "space", limit: 50})).resolves.toBe(result);
    expect(f.query).not.toHaveBeenCalled(); expect(name(f.mutation.mock.calls[0]![0])).toBe("conversations:list");
    expect(f.mutation.mock.calls[0]![1]).toMatchObject({tenantId: "tenant", memorySpaceId: "space", limit: 50});
    expect(f.mutation.mock.calls[0]![1]).not.toHaveProperty("paginationOpts");
  });
  it("public fact history avoids legacy provenance joins and returns the current authorized handler result", async () => {
    const result: unknown[] = []; const f = fixture(result);
    const api = new FactsAPI(f.client, undefined, undefined, {userId: "actor", tenantId: "tenant"});
    await expect(api.getHistory("space", "fact-valid")).resolves.toBe(result);
    expect(f.query).not.toHaveBeenCalled(); expect(f.mutation).toHaveBeenCalledTimes(1);
    expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:getHistory");
  });
  it("candidate reads keep their tenant selector in the supported fresh public list contract", async () => {
    const result: unknown[] = []; const f = fixture(result);
    await expect(collectCandidates(f.client, "findByStructure", {tenantId: "tenant", memorySpaceId: "space", subject: "actor"}, 20)).resolves.toBe(result);
    expect(f.query).not.toHaveBeenCalled(); expect(name(f.mutation.mock.calls[0]![0])).toBe("facts:list");
    expect(f.mutation.mock.calls[0]![1]).toEqual({tenantId: "tenant", memorySpaceId: "space", subject: "actor", includeSuperseded: false, limit: 20});
  });
  it("a mismatching tenant selector rejects before the SDK sends a public request", async () => {
    const f = fixture([]); const api = new FactsAPI(f.client, undefined, undefined, {userId: "actor", tenantId: "tenant"});
    await expect(api.list({memorySpaceId: "space", tenantId: "foreign"})).rejects.toThrow("TENANT_SCOPE_MISMATCH");
    expect(f.query).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled();
  });
});
