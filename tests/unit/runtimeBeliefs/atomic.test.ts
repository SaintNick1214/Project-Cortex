import { jest, beforeEach, afterEach, describe, test, expect } from "@jest/globals";
import { ingestionFixture, installIngestionMockRoot, ingestion, beliefs, candidate } from "../runtimeIngestion/fixture";
import { planBeliefs } from "../../../src/domain/belief-plan";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { AttributedFact } from "../../../src/domain/contracts";
import type { ConflictDecision } from "../../../src/domain/conflicts";
const { ConvexMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;
async function staged(f: Fixture, id: string, value: string) {
  const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source(`User prefers ${value}`, id));
  await f.extraction(admitted.eventId, [candidate(value)]);
  const owned = await f.claim(admitted.eventId, "facts");
  return { reference: f.reference, eventId: admitted.eventId, stage: "facts" as const, attempt: owned.attempt as number, leaseVersion: owned.leaseVersion as number };
}
async function planned(f: Fixture, lease: Awaited<ReturnType<typeof staged>>, decision?: ConflictDecision) {
  const { event, source } = await ingestion.requireStageLease(f.ctx, lease);
  const extract = f.db.table("runtimeIngestionStages").find(row => row.eventId === lease.eventId && row.stage === "extract")!;
  const existing = await new ConvexMemoryRepository(f.ctx, f.reference, "read").listFacts({ limit: 100 });
  return await planBeliefs({ eventId: event.eventId, sequence: event.sequence, source,
    candidates: JSON.parse(extract.payloadCanonical as string) as AttributedFact[], existing,
    resolve: async () => { if (!decision) throw new Error("Unexpected conflict call"); return decision; } });
}
async function commit(f: Fixture, lease: Awaited<ReturnType<typeof staged>>, plan: Awaited<ReturnType<typeof planned>>) {
  return await f.call<{ receiptId: string; created: boolean }>(beliefs.commit, { ...lease, planCanonical: canonicalModelJson(plan) });
}
describe("ordered atomic belief history", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("one source produces exactly one projection/history/outbox/stage receipt and replay cannot duplicate", async () => {
    const f = await ingestionFixture(); const lease = await staged(f, "blue", "blue"); const plan = await planned(f, lease);
    const receipt = await commit(f, lease, plan);
    expect(receipt.created).toBe(true); expect(f.db.table("facts")).toHaveLength(1);
    expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1);
    expect(f.db.table("runtimeBeliefHeads")[0]).toMatchObject({ sequence: 1, eventId: lease.eventId, factId: f.db.table("facts")[0].factId });
    expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("complete");
    expect(f.db.table("runtimeIngestionEvents")[0].vectorsState).toBe("pending");
    await expect(commit(f, lease, plan)).rejects.toMatchObject({ data: { code: "LEASE_EXPIRED" } });
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1);
  });
  test("later correction replaces the current belief under whole read-set CAS and preserves ordered history", async () => {
    const f = await ingestionFixture(); const first = await staged(f, "blue", "blue"); await commit(f, first, await planned(f, first));
    const fact = f.db.table("facts")[0]; const later = await staged(f, "red", "red");
    const plan = await planned(f, later, { action: "UPDATE", targetFactId: fact.factId as string, mergedFact: "User now prefers red", reason: "Explicit correction" });
    await commit(f, later, plan);
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("facts")[0]).toMatchObject({ fact: "User now prefers red", version: 2, lineage: { sourceId: "red" } });
    expect(f.db.table("runtimeBeliefHeads")[0].sequence).toBe(2);
    expect(f.db.table("runtimeBeliefHistory").map(row => row.action)).toEqual(["ADD", "UPDATE"]);
    expect(JSON.parse(f.db.table("runtimeBeliefHistory")[1].beforeCanonical as string).version).toBe(1);
    expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(2);
  });
  test("newer completed correction wins when model completions arrive backwards", async () => {
    const f = await ingestionFixture(); const old = await staged(f, "old", "blue"); const newer = await staged(f, "new", "red");
    const oldPlan = await planned(f, old); const newPlan = await planned(f, newer); await commit(f, newer, newPlan);
    const before = canonicalModelJson(f.db.table("facts"));
    await expect(commit(f, old, oldPlan)).rejects.toMatchObject({ data: { code: "FACT_VERSION_CONFLICT" } });
    expect(canonicalModelJson(f.db.table("facts"))).toBe(before); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1);
    expect(f.db.table("runtimeBeliefHeads")[0].eventId).toBe(newer.eventId);
  });
  test("concurrent fact mutation invalidates the plan before any belief/history/outbox effect", async () => {
    const f = await ingestionFixture(); const first = await staged(f, "blue", "blue"); await commit(f, first, await planned(f, first));
    const next = await staged(f, "red", "red"); const fact = f.db.table("facts")[0];
    const plan = await planned(f, next, { action: "NONE", targetFactId: fact.factId as string, mergedFact: null, reason: "Keep" });
    await f.db.patch("facts", fact._id, { version: 2 });
    await expect(commit(f, next, plan)).rejects.toMatchObject({ data: { code: "FACT_VERSION_CONFLICT" } });
    expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1);
  });
  test("failed outbox insertion rolls back projection, receipt, slot head, history and stage completion together", async () => {
    const f = await ingestionFixture(); const lease = await staged(f, "blue", "blue"); const plan = await planned(f, lease);
    const original = f.db.insert.bind(f.db); jest.spyOn(f.db, "insert").mockImplementation(async (table, row) => {
      if (table === "runtimeBeliefOutbox") throw new Error("Controlled storage failure"); return await original(table, row);
    });
    await expect(commit(f, lease, plan)).rejects.toThrow("Controlled storage failure");
    for (const table of ["facts", "runtimeMemoryReceipts", "runtimeBeliefHeads", "runtimeBeliefHistory", "runtimeBeliefOutbox"]) expect(f.db.table(table)).toHaveLength(0);
    expect(f.db.table("runtimeIngestionStages").find(row => row.stage === "facts")!.state).toBe("running");
  });
  test.each(["edit", "delete", "grant"])("%s during resolution rejects late commit without history writes", async mode => {
    const f = await ingestionFixture(); const lease = await staged(f, "blue", "blue"); const plan = await planned(f, lease);
    if (mode === "edit") await f.source("User prefers red", "blue", 2);
    else if (mode === "delete") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "blue", deletedAt: Date.now() });
    else f.db.table("runtimeAuthGrants")[0].revokedAt = Date.now();
    await expect(commit(f, lease, plan)).rejects.toBeDefined();
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(0); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(0);
  });
  test("changed plan identity and injected assistant attribution cannot become authoritative facts", async () => {
    const f = await ingestionFixture(); const lease = await staged(f, "blue", "blue"); const plan = await planned(f, lease);
    await expect(commit(f, lease, { ...plan, sequence: plan.sequence + 1 })).rejects.toMatchObject({ data: { code: "INVALID_BELIEF_PLAN" } });
    const altered = { ...plan, entries: plan.entries.map(entry => ({ ...entry, candidate: { ...entry.candidate, lineage: { ...entry.candidate.lineage, role: "assistant" as const, trust: "assistant_claim" as const } } })) };
    await expect(commit(f, lease, altered)).rejects.toMatchObject({ data: { code: "FACT_VERSION_CONFLICT" } }); expect(f.db.table("facts")).toHaveLength(0);
  });
});
