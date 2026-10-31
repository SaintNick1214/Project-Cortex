import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import * as memories from "../../../convex-dev/memories";
import { harness } from "../runtimeEndpointAuth/sharedfixtures";
import { VectorAPI } from "../../../src/vector/index";
import type { ConvexClient } from "convex/browser";

beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(1000); });
afterEach(() => { jest.restoreAllMocks(); });

async function fixture() {
  const h = harness(), owner = await h.provisionScope();
  await h.seedData("memories", owner, "expiry-sentinel");
  await h.db.patch(owner.grantId, { expiresAt: 2000 });
  h.db.attemptedWrites = [];
  return h;
}
it("delivers current legacy search results through final fresh mutation without model or data writes", async () => {
  const h = await fixture();
  const result = await h.invoke<Array<{ content: string; deliveryExpiresAt: number }>>(memories.search, { memorySpaceId: "space-a", query: "expiry-sentinel" });
  expect(memories.fetchMemoriesByIds.isMutation).toBe(true);
  expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ deliveryExpiresAt: 2000 });
  expect(result[0]?.content).toContain("expiry-sentinel");
  expect(h.db.attemptedWrites).toEqual([]); expect(h.vectorCalls()).toBe(0);
});
it("withholds private memory when action time expires after the final RPC snapshot", async () => {
  const h = await fixture(); let finalRpcReturned = false;
  h.setInternalHook(async (name, stage) => {
    if (name === "memories:fetchMemoriesByIds" && stage === "after") {
      finalRpcReturned = true; jest.spyOn(Date, "now").mockReturnValue(2001);
    }
  });
  await expect(h.invoke(memories.search, { memorySpaceId: "space-a", query: "expiry-sentinel" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(finalRpcReturned).toBe(true); expect(h.db.attemptedWrites).toEqual([]); expect(h.vectorCalls()).toBe(0);
});
it.each([1000, 2000, 2001])("the installed-facing vector API respects returned delivery bounds at%s", async now => {
  jest.spyOn(Date, "now").mockReturnValue(now);
  const payload = [{ memoryId: "expiry-sentinel", content: "private", deliveryExpiresAt: 2000 }];
  const action = jest.fn(async () => payload);
  const api = new VectorAPI({ action } as unknown as ConvexClient);
  if (now < 2000) await expect(api.search("space-a", "expiry-sentinel")).resolves.toEqual(payload);
  else await expect(api.search("space-a", "expiry-sentinel")).rejects.toMatchObject({ code: "AUTHORITY_EXPIRED", outcome: "uncertain" });
  expect(action).toHaveBeenCalledTimes(1);
});
