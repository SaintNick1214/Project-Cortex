import { jest } from "@jest/globals";
import type { ConvexClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { VectorAPI } from "../../src/vector";
import { enableDeploymentOperator } from "../../src/common/deploymentOperator";
const name = (reference: unknown) => getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
function transport() {
  const query = jest.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => []);
  const mutation = jest.fn(async (reference: unknown, _args: unknown): Promise<unknown> => {
    if (name(reference) === "memories:list") return [];
    if (name(reference) === "memories:count") return 0;
    if (name(reference) === "memories:exportMemories") return { data: "[]", count: 0, format: "json" };
    return { deleted: true, memoryId: "selected" };
  });
  const action = jest.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => []);
  const client = { query, mutation, action, onUpdate: jest.fn() } as unknown as ConvexClient;
  return { query, mutation, action, client, api: new VectorAPI(client, undefined, undefined, { tenantId: "owned-tenant", userId: "owner" }) };
}
it("uses the actual public list/search/count/export validators without legacy paging or extra tenant selectors", async () => {
  const f = transport();
  await f.api.list({ memorySpaceId: "owned-space", limit: 7, userId: "owner" });
  await f.api.count({ memorySpaceId: "owned-space", userId: "owner" });
  await f.api.export({ memorySpaceId: "owned-space", format: "json", includeEmbeddings: false });
  await f.api.search("owned-space", "secret", { limit: 3, userId: "owner" });
  expect(f.mutation.mock.calls.map(([reference]) => name(reference))).toEqual(["memories:list", "memories:count", "memories:exportMemories"]);
  expect(f.query).not.toHaveBeenCalled();
  expect(name(f.action.mock.calls[0]![0])).toBe("memories:search");
  for (const [, args] of [...f.mutation.mock.calls, ...f.action.mock.calls]) {
    expect(args).not.toHaveProperty("tenantId"); expect(args).not.toHaveProperty("participantId"); expect(args).not.toHaveProperty("paginationOpts");
  }
  expect(f.mutation.mock.calls[0]![1]).toMatchObject({ memorySpaceId: "owned-space", limit: 7, userId: "owner" });
});
it("keeps the existing zero list window local and rejects a conflicting tenant before I/O", async () => {
  const f = transport();
  expect(await f.api.list({ memorySpaceId: "owned-space", limit: 0 })).toEqual([]);
  await expect(f.api.search("owned-space", "secret", { tenantId: "foreign" })).rejects.toThrow("TENANT_SCOPE_MISMATCH");
  expect(f.query).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
});
it.each(["list", "search", "count", "deleteMany"])("refuses unsupported public participant selectors for %s before dispatch", async operation => {
  const f = transport();
  const selected = { memorySpaceId: "owned-space", participantId: "another-owner" };
  const result = operation === "search" ? f.api.search("owned-space", "secret", selected) : operation === "count" ? f.api.count(selected) : operation === "deleteMany" ? f.api.deleteMany(selected) : f.api.list(selected);
  await expect(result).rejects.toMatchObject({ code: "UNSUPPORTED_PUBLIC_SELECTOR", selector: "participantId" });
  expect(f.query).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled(); expect(f.mutation).not.toHaveBeenCalled();
});
it("public single deletion and write-only bulk deletion preserve native confirmation and redacted IDs without a read", async () => {
  const f = transport();
  expect(await f.api.delete("owned-space", "selected")).toEqual({ deleted: true, memoryId: "selected" });
  const receipt = { deleted: 2, mutationReceipt: true };
  f.mutation.mockResolvedValueOnce(receipt);
  expect(await f.api.deleteMany({ memorySpaceId: "owned-space", sourceType: "system" })).toBe(receipt);
  expect(f.query).not.toHaveBeenCalled();
  expect(f.mutation.mock.calls.map(([reference]) => name(reference))).toEqual(["memories:deleteMemory", "memories:deleteMany"]);
  expect(f.mutation.mock.calls[1]![1]).not.toHaveProperty("tenantId");
  expect(receipt).not.toHaveProperty("memoryIds");
});
it.each([new ConvexError({ code: "FORBIDDEN" }), new Error("network outcome unknown")])("propagates refusal/unknown outcome without retry or operator fallback: %p", async error => {
  const f = transport(); f.mutation.mockRejectedValueOnce(error);
  await expect(f.api.delete("owned-space", "selected")).rejects.toBe(error);
  expect(f.mutation).toHaveBeenCalledTimes(1); expect(f.query).not.toHaveBeenCalled();
});
it("retains explicit deployment operator paging/search selectors instead of changing operator behavior", async () => {
  const f = transport(); enableDeploymentOperator(f.client);
  f.query.mockResolvedValueOnce({ page: [], isDone: true, continueCursor: "" });
  await f.api.list({ memorySpaceId: "owned-space", participantId: "owner" });
  await f.api.search("owned-space", "secret", { participantId: "owner" });
  expect(name(f.query.mock.calls[0]![0])).toBe("cliOperator/memories:domainPage");
  expect(f.query.mock.calls[0]![1]).toMatchObject({ tenantId: "owned-tenant", participantId: "owner", paginationOpts: { numItems: 128 } });
  expect(name(f.action.mock.calls[0]![0])).toBe("cliOperator/memories:search");
  expect(f.action.mock.calls[0]![1]).toMatchObject({ tenantId: "owned-tenant", participantId: "owner" });
});
it("refuses the unsupported public bulk source selector without broadening deletion", async () => {
  const f = transport();
  await expect(f.api.deleteMany({ memorySpaceId: "owned-space", sourceType: "fact-extraction" })).rejects.toMatchObject({ code: "UNSUPPORTED_PUBLIC_SELECTOR", selector: "sourceType" });
  expect(f.mutation).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled();
});
describe.each(["delete", "deleteMany"] as const)("public %s deadline validation", operation => {
  it.each([0, -1, NaN, Infinity])("rejects deadline %p before any I/O", async deadlineMs => {
    const f = transport();
    const result = operation === "delete"
      ? f.api.delete("owned-space", "selected", { deadlineMs })
      : f.api.deleteMany({ memorySpaceId: "owned-space" }, { deadlineMs });
    await expect(result).rejects.toThrow("DOMAIN_INVALID_DEADLINE");
    expect(f.mutation).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
  });
  it("accepts a positive finite deadline and retains the actual confirmation", async () => {
    const f = transport();
    const receipt = { deleted: 1, mutationReceipt: true };
    f.mutation.mockResolvedValueOnce(receipt);
    const result = operation === "delete"
      ? f.api.delete("owned-space", "selected", { deadlineMs: 1000 })
      : f.api.deleteMany({ memorySpaceId: "owned-space" }, { deadlineMs: 1000 });
    expect(await result).toBe(receipt); expect(f.mutation).toHaveBeenCalledTimes(1); expect(f.query).not.toHaveBeenCalled();
  });
});
