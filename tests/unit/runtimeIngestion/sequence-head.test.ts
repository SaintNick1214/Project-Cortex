/** Prospective heads and original pending/progress handlers; no deployment or migration. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { ingestionFixture, ingestion, installIngestionMockRoot } from "./fixture";
import { contextSourceKey } from "../../../src/domain/memory-context";
const context = await import("../../../convex-dev/runtimeMemoryContext");
const runs = await import("../../../convex-dev/runs");
beforeEach(installIngestionMockRoot);
afterEach(() => { jest.restoreAllMocks(); });
it("creates a head only with a new scope and captures increasing sequences atomically", async () => {
  const f = await ingestionFixture();
  for (const id of ["one", "two"]) await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source(id, id));
  expect(f.db.table("runtimeIngestionSequenceHeads")).toHaveLength(1);
  expect(await ingestion.readScopeSequence(f.ctx, f.reference)).toMatchObject({ sequence: 2, stable: true });
  const head = f.db.table("runtimeIngestionSequenceHeads")[0];
  const saved = JSON.stringify(head);
  for (const event of f.db.table("runtimeIngestionEvents")) Object.assign(event, { factsState: "complete", vectorsState: "complete" });
  await context.refreshScopeWatermarks(f.ctx, f.reference);
  expect(JSON.stringify(head)).toBe(saved);
  expect(f.db.table("runtimeIngestionScopes")[0]).toMatchObject({ factsThrough: 2, vectorsThrough: 2 });
});
it("an existing scope without a head is never backfilled and keeps exact old cutoff/progress", async () => {
  const f = await ingestionFixture();
  f.db.seed("runtimeIngestionScopes", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    sequence: 0, factsThrough: 0, vectorsThrough: 0, graphThrough: 0, version: 1, updatedAt: Date.now() });
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("legacy absent head", "absent"));
  expect(f.db.table("runtimeIngestionSequenceHeads")).toHaveLength(0);
  expect(await ingestion.readScopeSequence(f.ctx, f.reference)).toEqual({ ...await ingestion.readScopeCutoff(f.ctx, f.reference), stable: false });
});
it("a divergent head refuses capture and rolls back its source retirement/scope writes", async () => {
  const f = await ingestionFixture();await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("one", "one"));
  f.db.table("runtimeIngestionSequenceHeads")[0].sequence = 9;
  const next = await f.source("two", "two");const before = JSON.stringify([...f.db.rows]); const writes = f.db.writes;
  await expect(f.transaction(() => ingestion.enqueueSourceEvent(f.ctx, f.reference, next))).rejects.toThrow("INGESTION_CONFLICT");
  expect(JSON.stringify([...f.db.rows])).toBe(before);expect(f.db.writes).toBe(writes);
});
it("stable bounded empty scan matches original pending output without a progress-row read", async () => {
  const f = await ingestionFixture(), source = await f.source("already represented", "represented");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const args = { reference: f.reference, cutoff: 1, alreadyRepresented: [contextSourceKey(source, source.lineage)], maxBytes: 16384 };
  const original = await context.readPendingContext(f.ctx, args), tables: string[] = [];
  const query = f.db.query.bind(f.db);jest.spyOn(f.db, "query").mockImplementation((name: string) => { tables.push(name);return query(name); });
  expect(await context.readEmptyPendingContext(f.ctx, args)).toEqual(original);
  expect(tables).not.toContain("runtimeIngestionScopes");expect(tables).toContain("runtimeIngestionSequenceHeads");
});
it("any unrepresented candidate takes the original populated scan and does not claim an empty result", async () => {
  const f = await ingestionFixture();await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("unrepresented", "candidate"));
  const args = { reference: f.reference, cutoff: 1, alreadyRepresented: [], maxBytes: 16384 };
  expect(await context.readEmptyPendingContext(f.ctx, args)).toEqual(await context.readPendingContext(f.ctx, args));
  expect((await context.readEmptyPendingContext(f.ctx, args)).sources).toHaveLength(1);
});
it.each(["revoked", "foreign", "future", "overflow"])("stable empty %s fails the original current fence", async fault => {
  const f = await ingestionFixture(), source = await f.source("represented", "represented");await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const args = { reference: f.reference, cutoff: 1, alreadyRepresented: [contextSourceKey(source, source.lineage)], maxBytes: 16384 };
  if (fault === "revoked") f.grant.revokedAt = Date.now();
  if (fault === "foreign") args.reference = { ...args.reference, principalId: "other" };
  if (fault === "future") args.cutoff = 2;
  if (fault === "overflow") args.maxBytes = 16385;
  const writes = f.db.writes;
  await expect(context.readEmptyPendingContext(f.ctx, args)).rejects.toThrow();expect(f.db.writes).toBe(writes);
});

it.each([false, true])("bounded metadata overflow preserves the original nonempty result with stable head=%s", async stable => {
  const f = await ingestionFixture(), run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() });
  f.db.table("runtimeIngestionEvents")[0].eligibility = "superseded";
  for (let index = 2; index <= 1026; index++) f.db.seed("runtimeIngestionEvents", {
    tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
    sequence: index, eligibility: "superseded", lineage: { sourceId: `overflow:${index}`, sourceEventId: `overflow:${index}`, sourceRevision: 1 },
  });
  f.db.table("runtimeIngestionScopes")[0].sequence = 1026;
  if (stable) f.db.table("runtimeIngestionSequenceHeads")[0].sequence = 1026;
  else f.db.rows.delete("runtimeIngestionSequenceHeads");
  const args = { reference: f.reference, cutoff: 1026, excludedSourceKeys: [], runBudgetId: f.db.table("runtimeRuns")[0].runBudgetId as string,
    boundary: { conversationId: run.conversationId, runId: run.runId, queueSequence: 1, anchor: { order: 0, stepOrder: 0 } } };
  const stored = () => JSON.stringify([...f.db.rows].filter(([, rows]) => rows.length));
  const before = stored(), writes = f.db.writes;
  expect(await context.readIndexedContextAvailability(f.ctx, args)).toMatchObject({ empty: false });
  expect(await ingestion.readScopeSequence(f.ctx, f.reference)).toMatchObject({ sequence: 1026, stable });
  expect(stored()).toBe(before); expect(f.db.writes).toBe(writes);
});
