/** Real planner + original native commit. No hosted OCC or paid inference. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { AttributedFact, MemoryModel } from "../../../src/domain/contracts";
import { planBeliefs } from "../../../src/domain/belief-plan";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { ingestionFixture, ingestion, installIngestionMockRoot, candidate } from "../runtimeIngestion/fixture";
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;
async function setup(values: Record<string, unknown>[]) {
  const f = await ingestionFixture(), event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("User prefers coral", "duplicate-source"));
  await f.extraction(event.eventId, values); return { f, event };
}
async function worker(f: Fixture, eventId: string) {
  const resolve = jest.fn<MemoryModel["resolve"]>(async () => { throw Error("Unexpected paid resolver"); });
  const model: MemoryModel = { resolve, extract: async () => { throw Error("No re-extraction"); }, embed: async () => { throw Error("No embedding in facts stage"); } };
  await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage: "facts" }, () => model);
  return resolve;
}
describe("exact duplicate extraction candidates", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("one assertion has one native write/history/receipt while the raw extraction keeps both candidates", async () => {
    const value = candidate("coral"), { f, event } = await setup([value, structuredClone(value)]);
    const extraction = f.db.table("runtimeIngestionStages").find(s => s.eventId === event.eventId && s.stage === "extract")!;
    const before = canonicalModelJson(extraction);
    expect(JSON.parse(extraction.payloadCanonical as string)).toHaveLength(2);
    const resolve = await worker(f, event.eventId);
    expect(resolve).not.toHaveBeenCalled(); expect(canonicalModelJson(extraction)).toBe(before);
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("runtimeBeliefHeads")).toHaveLength(1);
    expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1);
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1);
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ factsState: "complete", vectorsState: "pending" });
    const final = canonicalModelJson(f.db.table("facts")); await worker(f, event.eventId);
    expect(canonicalModelJson(f.db.table("facts"))).toBe(final); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1);
  });
  test("normalized slot duplicates before another assertion retain dense ordinals accepted by the original native revalidation", async () => {
    const value = candidate("coral"), { f, event } = await setup([value, { ...value, subject: " user ", predicate: " PREFERS_COLOR " },
      { ...candidate("piano"), predicate: "plays_instrument" }]);
    await worker(f, event.eventId);
    expect(f.db.table("facts")).toHaveLength(2); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(2);
    const plan = JSON.parse(f.db.table("runtimeIngestionStages").find(s => s.eventId === event.eventId && s.stage === "facts")!.payloadCanonical as string) as { entries: { ordinal: number; candidate: AttributedFact }[] };
    expect(plan.entries.map(e => e.ordinal)).toEqual([0, 1]); expect(plan.entries.map(e => e.candidate.object)).toEqual(["coral", "piano"]);
    expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("complete");
  });
  test.each(["value", "wording", "confidence", "tags", "entities", "relations"] as const)("different %s in the same slot stays ambiguous, without a committed plan", async kind => {
    const first = candidate("coral"), changed: Record<string, unknown> = { ...first };
    if (kind === "value") changed.object = "lavender";
    if (kind === "wording") changed.fact = "User sometimes prefers coral";
    if (kind === "confidence") changed.confidence = 0.5;
    if (kind === "tags") changed.tags = ["qualified"];
    if (kind === "entities") changed.entities = [{ name: "coral", type: "concept" }];
    if (kind === "relations") changed.relations = [{ subject: "User", predicate: "sometimes_prefers", object: "coral" }];
    const { f, event } = await setup([first, changed]); await worker(f, event.eventId);
    for (const table of ["facts", "runtimeBeliefHistory", "runtimeBeliefOutbox", "runtimeMemoryReceipts"]) expect(f.db.table(table)).toHaveLength(0);
    expect(f.db.table("runtimeIngestionStages").find(s => s.eventId === event.eventId && s.stage === "facts")).not.toMatchObject({ state: "complete" });
  });
  test.each(["foreign-source", "over-limit"] as const)("%s cannot use consolidation to bypass the original lineage/count bound", async kind => {
    const { f, event } = await setup([candidate("coral")]); const source = (await ingestion.readEventCurrent(f.ctx, f.reference, event.eventId)).source;
    const value = { ...candidate("coral"), lineage: source.lineage } as AttributedFact;
    const candidates = kind === "over-limit" ? Array.from({ length: 101 }, () => value)
      : [value, { ...value, lineage: { ...source.lineage, sourceEventId: "foreign" } }];
    await expect(planBeliefs({ eventId: event.eventId, sequence: event.sequence, source, candidates, existing: [],
      resolve: async () => { throw Error("Unexpected resolver"); } })).rejects.toThrow("INVALID_BELIEF_PLAN");
    expect(f.db.table("facts")).toHaveLength(0);
  });
  test.each(["edit", "revocation", "tombstone"] as const)("%s still rejects the original fresh commit of a consolidated plan", async kind => {
    const value = candidate("coral"), { f, event } = await setup([value, value]), owned = await f.claim(event.eventId, "facts");
    const input = await ingestion.requireStageLease(f.ctx, { reference: f.reference, eventId: event.eventId, stage: "facts", attempt: owned.attempt as number, leaseVersion: owned.leaseVersion as number });
    const candidates = JSON.parse(f.db.table("runtimeIngestionStages").find(s => s.eventId === event.eventId && s.stage === "extract")!.payloadCanonical as string) as AttributedFact[];
    const plan = await planBeliefs({ eventId: event.eventId, sequence: event.sequence, source: input.source, candidates, existing: [], resolve: async () => { throw Error("Unexpected resolver"); } });
    if (kind === "edit") await f.source("User prefers lavender", "duplicate-source", 2);
    if (kind === "revocation") f.grant.revokedAt = Date.now();
    if (kind === "tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "duplicate-source", deletedAt: Date.now() });
    const { beliefs } = await import("../runtimeIngestion/fixture");
    await expect(f.call(beliefs.commit, { reference: f.reference, eventId: event.eventId, stage: "facts", attempt: owned.attempt, leaseVersion: owned.leaseVersion, planCanonical: canonicalModelJson(plan) })).rejects.toBeDefined();
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeBeliefHistory")).toHaveLength(0);
  });
});
