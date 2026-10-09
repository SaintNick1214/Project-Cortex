/** Current verified runtime contract. Historical pre-authority catalog and coverage
 * mapping: _DEPRECATED/tests/legacy-registry/README.md. Public endpoints stay public. */
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createNamedTestRunContext } from "./helpers/isolation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

describe("Contexts: verified public hierarchy and history", () => {
  const run = createNamedTestRunContext("canonical-contexts");
  let f: Awaited<ReturnType<typeof createRuntimeFixture>>;
  beforeEach(async () => { const id = crypto.randomUUID(); f = await createRuntimeFixture(run.runId + id, run.memorySpaceId(id), run.userId(id)); });
  afterEach(async () => { await f?.close(); });
  const create = (purpose = "Owned context") => f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, purpose, userId: f.userId, data: { nested: { first: true } } });

  it("creates, gets, updates and reconstructs genuine version history", async () => {
    const first = await create();
    expect(first).toMatchObject({ memorySpaceId: f.memorySpaceId, userId: f.userId, version: 1 });
    expect(await f.cortex.contexts.get(first.contextId)).toMatchObject({ contextId: first.contextId });
    const second = await f.cortex.contexts.update(first.contextId, { description: "Updated", data: { nested: { second: true } }, status: "completed" });
    expect(second).toMatchObject({ version: 2, status: "completed", data: { nested: { second: true } } });
    expect(await f.cortex.contexts.getVersion(first.contextId, 1)).toMatchObject({ version: 1, status: "active" });
    expect((await f.cortex.contexts.getHistory(first.contextId)).map(v => v.version)).toEqual([1, 2]);
    expect(await f.cortex.contexts.getAtTimestamp(first.contextId, new Date(first.updatedAt))).toMatchObject({ version: 1 });
    expect(await f.cortex.contexts.getVersion(first.contextId, 99)).toBeNull();
  });
  it("builds parent/child/root/chain relations and recursively reads children", async () => {
    const root = await create("Root");
    const child = await f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, purpose: "Child", parentId: root.contextId });
    const leaf = await f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, purpose: "Leaf", parentId: child.contextId });
    expect(leaf).toMatchObject({ rootId: root.contextId, depth: 2 });
    expect((await f.cortex.contexts.getChildren(root.contextId)).map(c => c.contextId)).toEqual([child.contextId]);
    expect((await f.cortex.contexts.getChildren(root.contextId, { recursive: true })).map(c => c.contextId)).toEqual(expect.arrayContaining([child.contextId, leaf.contextId]));
    expect(await f.cortex.contexts.getRoot(leaf.contextId)).toMatchObject({ contextId: root.contextId });
    const chain = await f.cortex.contexts.getChain(leaf.contextId);
    expect(chain.current.contextId).toBe(leaf.contextId);
    expect(chain.ancestors.map(c => c.contextId)).toEqual([root.contextId, child.contextId]);
  });
  it("adds/removes participant metadata and grants access metadata without creating authority", async () => {
    const root = await create();
    await f.cortex.contexts.addParticipant(root.contextId, "descriptive-label");
    expect((await f.cortex.contexts.get(root.contextId))?.participants).toContain("descriptive-label");
    await f.cortex.contexts.removeParticipant(root.contextId, "descriptive-label");
    expect((await f.cortex.contexts.get(root.contextId))?.participants).not.toContain("descriptive-label");
    await f.cortex.contexts.grantAccess(root.contextId, f.memorySpaceId, "read");
    expect((await f.cortex.contexts.get(root.contextId))?.grantedAccess).toEqual(expect.arrayContaining([expect.objectContaining({ memorySpaceId: f.memorySpaceId, scope: "read" })]));
    const before = await f.ownedRows("contexts");
    await expect(f.cortex.contexts.grantAccess(root.contextId, f.memorySpaceId + "-ungranted", "read")).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(await f.ownedRows("contexts")).toEqual(before);
  });
  it("refuses canonical conversation linking and inclusion before effects", async () => {
    const before = await f.ownedRows("contexts");
    await expect(f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, purpose: "Linked", conversationRef: { conversationId: "conv-unqualified" } })).rejects.toThrow("CAPABILITY_NOT_READY");
    expect(await f.ownedRows("contexts")).toEqual(before);
    const root = await create();
    expect(await f.cortex.contexts.get(root.contextId, { includeConversation: true })).toMatchObject({ contextId: root.contextId });
    await expect(f.cortex.contexts.getByConversation("conv-unqualified")).rejects.toMatchObject({ data: { code: "CAPABILITY_NOT_READY" } });
  });
  it("conceals foreign contexts, refuses forged selectors and leaves records unchanged", async () => {
    const root = await create(); const before = await f.ownedRows("contexts");
    const foreign = await createRuntimeFixture(f.tenantId + "-foreign", f.memorySpaceId + "-foreign", f.userId + "-foreign");
    try {
      expect(await foreign.cortex.contexts.get(root.contextId)).toBeNull();
      await expect(f.cortex.getClient().mutation(makeFunctionReference<"mutation">("contexts:update"), { contextId: root.contextId, tenantId: foreign.tenantId, status: "cancelled" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      const ordinary = new ConvexHttpClient(process.env.CONVEX_URL!, { logger: false });
      await expect(ordinary.query(makeFunctionReference<"query">("contexts:get"), { contextId: root.contextId })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
      expect(await f.ownedRows("contexts")).toEqual(before);
    } finally { await foreign.close(); }
  });
  it("validates missing/invalid input without effects", async () => {
    await expect(f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, purpose: "" })).rejects.toThrow();
    await expect(f.cortex.contexts.get("bad-id")).rejects.toThrow();
    expect(await f.ownedRows("contexts")).toEqual([]);
  });
});
