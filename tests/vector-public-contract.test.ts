/** Real public registrations with fixed persisted grants. No operator routing. */
import { makeFunctionReference } from "convex/server";
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createNamedTestRunContext } from "./helpers/isolation";
const run = createNamedTestRunContext("public-vector-bridge");
const spaces = [run.memorySpaceId("selected"), run.memorySpaceId("preserved")];
let f: Awaited<ReturnType<typeof createRuntimeFixture>>;
beforeAll(async () => { f = await createRuntimeFixture(run.runId, spaces, run.userId("owner")); });
afterAll(async () => { await f?.close(); });
const store = (space: string, content: string) => f.cortex.vector.store(space, { content, contentType: "raw", source: { type: "system", userId: f.userId }, metadata: { importance: 70, tags: ["native-public-proof"] } });
it("lists, counts, keyword searches and exports only the genuinely admitted selected space", async () => {
  const a = await store(spaces[0]!, "bridge keyword selected");
  const b = await store(spaces[1]!, "bridge keyword preserved");
  expect(await f.cortex.vector.list({ memorySpaceId: spaces[0]! })).toEqual([a]);
  expect(await f.cortex.memory.list({ memorySpaceId: spaces[1]! })).toEqual([b]);
  expect(await f.cortex.vector.count({ memorySpaceId: spaces[0]! })).toBe(1);
  expect(await f.cortex.memory.count({ memorySpaceId: spaces[1]! })).toBe(1);
  expect((await f.cortex.vector.search(spaces[0]!, "bridge" )).map(row => row.memoryId)).toEqual([a.memoryId]);
  const exported = await f.cortex.vector.export({ memorySpaceId: spaces[0]!, format: "json" });
  expect(exported.count).toBe(1); expect(JSON.parse(exported.data)).toEqual([expect.objectContaining({ memoryId: a.memoryId, content: a.content })]);
  expect(exported.data).not.toContain(b.memoryId);
});
it("single and bulk deletion retire only selected native sources while the other space persists", async () => {
  const kept = await f.cortex.vector.list({ memorySpaceId: spaces[1]! });
  const selected = await f.cortex.vector.list({ memorySpaceId: spaces[0]! });
  expect(await f.cortex.vector.delete(spaces[0]!, selected[0]!.memoryId)).toMatchObject({ deleted: true, memoryId: selected[0]!.memoryId });
  await expect(f.cortex.vector.get(spaces[0]!, selected[0]!.memoryId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  const a = await store(spaces[0]!, "bulk selected one"); const b = await store(spaces[0]!, "bulk selected two");
  expect(await f.cortex.vector.deleteMany({ memorySpaceId: spaces[0]!, sourceType: "system" })).toMatchObject({ deleted: 2, memoryIds: expect.arrayContaining([a.memoryId, b.memoryId]) });
  expect(await f.cortex.vector.list({ memorySpaceId: spaces[0]! })).toEqual([]);
  expect(await f.cortex.vector.list({ memorySpaceId: spaces[1]! })).toEqual(kept);
  expect((await f.ownedRows("memories")).filter(row => (row as { tombstonedAt?: number }).tombstonedAt !== undefined)).toHaveLength(3);
});
it("unsupported selectors, embeddings and ungranted spaces refuse before data effects", async () => {
  const before = await f.ownedRows("memories");
  await expect(f.cortex.vector.list({ memorySpaceId: spaces[0]!, participantId: f.userId })).rejects.toMatchObject({ code: "UNSUPPORTED_PUBLIC_SELECTOR" });
  await expect(f.cortex.vector.count({ memorySpaceId: run.memorySpaceId("ungranted") })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  await expect(f.cortex.vector.store(spaces[0]!, { content: "refused embedding", embedding: Array(1536).fill(0), contentType: "raw", source: { type: "system", userId: f.userId }, metadata: { importance: 50, tags: [] } })).rejects.toMatchObject({ data: { code: "PROFILE_NOT_READY" } });
  expect(await f.ownedRows("memories")).toEqual(before);
});
it("a genuine write-only native grant confirms bulk effects while withholding IDs and read access", async () => {
  const writer = await createRuntimeFixture(run.runId + "-writer", run.memorySpaceId("writer"), run.userId("writer"));
  try {
    await writer.admin.mutation(makeFunctionReference<"mutation">("runtimeAuth:provision"), { ...writer.identity, actorKind: "user", metadataUserId: writer.userId, tenantId: writer.tenantId, memorySpaceId: writer.memorySpaceId, capabilities: ["write"], resourceAccess: "space" });
    await writer.cortex.vector.store(writer.memorySpaceId, { content: "private native row", contentType: "raw", source: { type: "system", userId: writer.userId }, metadata: { importance: 50, tags: [] } });
    await expect(writer.cortex.vector.list({ memorySpaceId: writer.memorySpaceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const result = await writer.cortex.vector.deleteMany({ memorySpaceId: writer.memorySpaceId });
    expect(result).toEqual({ deleted: 1, mutationReceipt: true });
    expect(result).not.toHaveProperty("memoryIds");
    expect(await writer.ownedRows("memories")).toEqual([expect.objectContaining({ content: "private native row", tombstonedAt: expect.any(Number) })]);
  } finally { await writer.close(); }
});
