/** Current verified runtime contract. Historical pre-authority catalog and coverage
 * mapping: _DEPRECATED/tests/legacy-registry/README.md. Public endpoints stay public. */
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createNamedTestRunContext } from "./helpers/isolation";

describe("Contexts: scoped filtering and export", () => {
  const run = createNamedTestRunContext("canonical-context-filters");
  let f: Awaited<ReturnType<typeof createRuntimeFixture>>;
  const roots: string[] = [];
  beforeAll(async () => {
    f = await createRuntimeFixture(run.runId, run.memorySpaceId("owner"), run.userId("owner"));
    for (const status of ["active", "completed", "cancelled", "blocked"] as const) {
      const c = await f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, purpose: status, status }); roots.push(c.contextId);
    }
    await f.cortex.contexts.create({ memorySpaceId: f.memorySpaceId, parentId: roots[0], purpose: "Child" });
  });
  afterAll(async () => { await f?.close(); });
  it.each(["active", "completed", "cancelled", "blocked"] as const)("list/search/count select %s within the grant", async status => {
    const list = await f.cortex.contexts.list({ memorySpaceId: f.memorySpaceId, status });
    expect(list.length).toBe(status === "active" ? 2 : 1);
    expect(list.every(c => c.status === status && c.memorySpaceId === f.memorySpaceId)).toBe(true);
    expect(await f.cortex.contexts.search({ memorySpaceId: f.memorySpaceId, status })).toEqual(list);
    expect(await f.cortex.contexts.count({ memorySpaceId: f.memorySpaceId, status })).toBe(list.length);
  });
  it("filters user, parent, root and depth; respects a bounded limit", async () => {
    expect(await f.cortex.contexts.count({ userId: f.userId })).toBe(5);
    expect((await f.cortex.contexts.list({ parentId: roots[0] })).length).toBe(1);
    expect((await f.cortex.contexts.list({ rootId: roots[0] })).length).toBe(2);
    expect((await f.cortex.contexts.list({ depth: 0 })).length).toBe(4);
    expect((await f.cortex.contexts.list({ limit: 2 })).length).toBe(2);
    expect(await f.cortex.contexts.list({ userId: "different-user" })).toEqual([]);
    expect(await f.cortex.contexts.findOrphaned()).toEqual([]);
  });
  it.each(["json", "csv"] as const)("exports %s with exact selected count", async format => {
    const result = await f.cortex.contexts.export({ status: "completed" }, { format, includeChain: true, includeVersionHistory: true });
    expect(result).toMatchObject({ format, count: 1 });
    expect(result.data).toContain(roots[1]);
    expect(result.data).not.toContain(roots[2]);
    if (format === "json") expect(JSON.parse(result.data)[0]).toMatchObject({ version: 1, contextId: roots[1] });
  });
  it("refuses a foreign memory-space selector before selecting rows", async () => {
    const before = await f.ownedRows("contexts");
    await expect(f.cortex.contexts.list({ memorySpaceId: f.memorySpaceId + "-foreign" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(await f.ownedRows("contexts")).toEqual(before);
  });
});
