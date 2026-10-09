/** Current verified runtime contract. Historical pre-authority catalog and coverage
 * mapping: _DEPRECATED/tests/legacy-registry/README.md. Public endpoints stay public. */
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createNamedTestRunContext } from "./helpers/isolation";

describe("Contexts: scoped bulk updates and hierarchy retirement", () => {
  const run = createNamedTestRunContext("canonical-context-ops");
  let f: Awaited<ReturnType<typeof createRuntimeFixture>>;
  beforeEach(async () => { const id = crypto.randomUUID(); f = await createRuntimeFixture(run.runId + id, run.memorySpaceId(id), run.userId(id)); });
  afterEach(async () => { await f?.close(); });
  const create = (parentId?: string) => f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, purpose: "Owned", parentId });
  it("updates and deletes only matching scoped roots", async () => {
    const a = await create(), b = await create();
    await f.cortex.contexts.update(b.contextId, { status: "blocked" });
    const changed = await f.cortex.contexts.updateMany({ memorySpaceId: f.memorySpaceId, status: "active" }, { status: "completed", data: { done: true } });
    expect(changed).toEqual({ updated: 1, contextIds: [a.contextId] });
    expect(await f.cortex.contexts.get(b.contextId)).toMatchObject({ status: "blocked" });
    const deleted = await f.cortex.contexts.deleteMany({ memorySpaceId: f.memorySpaceId, status: "completed" });
    expect(deleted).toEqual({ deleted: 1, contextIds: [a.contextId] });
    await expect(f.cortex.contexts.get(a.contextId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(await f.cortex.contexts.count()).toBe(1);
  });
  it("rejects deletion with live children, then cascades exact descendants", async () => {
    const root = await create(), child = await create(root.contextId), leaf = await create(child.contextId);
    const before = await f.ownedRows("contexts");
    await expect(f.cortex.contexts.delete(root.contextId)).rejects.toThrow("INVALID_INPUT");
    expect(await f.ownedRows("contexts")).toEqual(before);
    const receipt = await f.cortex.contexts.delete(root.contextId, { cascadeChildren: true });
    expect(receipt.deleted).toBe(true);
    expect(receipt.descendantsDeleted).toBe(2);
    expect(await f.cortex.contexts.count()).toBe(0);
    for (const id of [root.contextId, child.contextId, leaf.contextId]) await expect(f.cortex.contexts.get(id)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect((await f.ownedRows("contexts")).every(row => Boolean((row as { tombstonedAt?: number }).tombstonedAt))).toBe(true);
  });
  it("orphans children as new consistent roots while retaining them", async () => {
    const root = await create(), child = await create(root.contextId), leaf = await create(child.contextId);
    await f.cortex.contexts.delete(root.contextId, { orphanChildren: true });
    expect(await f.cortex.contexts.get(child.contextId)).toMatchObject({ rootId: child.contextId, depth: 0 });
    expect(await f.cortex.contexts.get(leaf.contextId)).toMatchObject({ rootId: child.contextId, depth: 1 });
    expect(await f.cortex.contexts.count()).toBe(2);
  });
  it("refuses incompatible deletion options and unfiltered bulk writes without effects", async () => {
    const root = await create(); const before = await f.ownedRows("contexts");
    await expect(f.cortex.contexts.delete(root.contextId, { orphanChildren: true, cascadeChildren: true })).rejects.toThrow();
    await expect(f.cortex.contexts.updateMany({}, { status: "completed" })).rejects.toThrow();
    await expect(f.cortex.contexts.deleteMany({})).rejects.toThrow();
    expect(await f.ownedRows("contexts")).toEqual(before);
  });
});
