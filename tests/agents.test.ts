/** Current verified runtime contract. Historical pre-authority catalog and coverage
 * mapping: _DEPRECATED/tests/legacy-registry/README.md. Public endpoints stay public. */
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createNamedTestRunContext } from "./helpers/isolation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

describe("Agents: canonical scoped registry", () => {
  const run = createNamedTestRunContext("canonical-agents");
  let f: Awaited<ReturnType<typeof createRuntimeFixture>>;
  beforeEach(async () => { const id = crypto.randomUUID(); f = await createRuntimeFixture(run.runId + id, run.memorySpaceId(id), run.userId(id)); });
  afterEach(async () => { await f?.close(); });
  const register = (suffix = "a") => f.cortex.agents.register({ id: run.agentId(suffix + crypto.randomUUID()), memorySpaceId: f.memorySpaceId, name: "Support", metadata: { team: "support" }, config: { temperature: 0.2 } });
  it("registers, gets, tests existence, updates and configures canonical metadata", async () => {
    const agent = await register();
    expect(agent).toMatchObject({ memorySpaceId: f.memorySpaceId, tenantId: f.tenantId, status: "active" });
    expect(await f.cortex.agents.get(agent.id)).toEqual(agent);
    expect(await f.cortex.agents.exists(agent.id)).toBe(true);
    const updated = await f.cortex.agents.update(agent.id, { name: "Updated", status: "inactive", memorySpaceId: f.memorySpaceId });
    expect(updated).toMatchObject({ name: "Updated", status: "inactive" });
    await f.cortex.agents.configure(agent.id, { temperature: 0.5 });
    expect((await f.cortex.agents.get(agent.id))?.config).toEqual({ temperature: 0.5 });
  });
  it("lists, searches, counts, bulk updates and exports the admitted registry", async () => {
    const a = await register(), b = await register("b");
    expect((await f.cortex.agents.list({ memorySpaceId: f.memorySpaceId })).map(x => x.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(await f.cortex.agents.count({ status: "active" })).toBe(2);
    expect(await f.cortex.agents.search({ name: "Supp" })).toHaveLength(2);
    expect(await f.cortex.agents.updateMany({ metadata: { team: "support" } }, { description: "Bulk" })).toMatchObject({ updated: 2 });
    expect((await f.cortex.agents.get(a.id))?.description).toBe("Bulk");
    const json = await f.cortex.agents.export({ format: "json" });
    expect(json.count).toBe(2); expect(json.data).toContain(a.id);
    const csv = await f.cortex.agents.export({ format: "csv" }); expect(csv.count).toBe(2); expect(csv.data).toContain(b.id);
  });
  it("dry run preserves rows; unregister and unregisterMany retire exact registrations", async () => {
    const a = await register(), b = await register("b");
    const before = await f.ownedRows("agents");
    expect((await f.cortex.agents.unregister(a.id, { dryRun: true })).totalDeleted).toBe(0);
    expect(await f.ownedRows("agents")).toEqual(before);
    expect((await f.cortex.agents.unregister(a.id)).totalDeleted).toBe(1);
    await expect(f.cortex.agents.exists(a.id)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(await f.cortex.agents.unregisterMany({ status: "active" })).toMatchObject({ deleted: 1, agentIds: [b.id] });
    expect(await f.cortex.agents.count()).toBe(0);
  });
  it("refuses unavailable source statistics and cascade before effects", async () => {
    const a = await register(); const before = await f.ownedRows("agents");
    await expect(f.cortex.getClient().query(makeFunctionReference<"query">("agents:computeStats"), { agentId: a.id })).rejects.toMatchObject({ data: { code: "CAPABILITY_NOT_READY" } });
    await expect(f.cortex.agents.export({ format: "json", includeStats: true })).rejects.toThrow();
    await expect(f.cortex.agents.unregister(a.id, { cascade: true })).rejects.toMatchObject({ code: "TRUSTED_BACKEND_CASCADE_REQUIRED" });
    await expect(f.cortex.agents.unregisterMany({ status: "active" }, { cascade: true })).rejects.toMatchObject({ code: "TRUSTED_BACKEND_CASCADE_REQUIRED" });
    expect(await f.ownedRows("agents")).toEqual(before);
  });
  it("conceals foreign registrations and refuses forged tenant/public clients without effects", async () => {
    const a = await register(); const before = await f.ownedRows("agents");
    const other = await createRuntimeFixture(f.tenantId + "-other", f.memorySpaceId + "-other", f.userId + "-other");
    try {
      expect(await other.cortex.agents.get(a.id)).toBeNull();
      await expect(f.cortex.getClient().mutation(makeFunctionReference<"mutation">("agents:update"), { agentId: a.id, tenantId: other.tenantId, name: "Forged" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      const ordinary = new ConvexHttpClient(process.env.CONVEX_URL!, { logger: false });
      await expect(ordinary.query(makeFunctionReference<"query">("agents:get"), { agentId: a.id })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
      expect(await f.ownedRows("agents")).toEqual(before);
    } finally { await other.close(); }
  });
});
