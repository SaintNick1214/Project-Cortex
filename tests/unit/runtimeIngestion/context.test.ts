/** Controlled native registered-handler checks; no service or paid-model claim. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ingestionFixture, installIngestionMockRoot, ingestion } from "./fixture";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { contextSourceKey } from "../../../src/domain/memory-context";
const context = await import("../../../convex-dev/runtimeMemoryContext");

describe("scoped contiguous memory context", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("a failed earlier fact event blocks only facts; explicit retirement closes the hole", async () => {
    const f = await ingestionFixture();
    for (const id of ["earlier", "later"]) await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source(id, id));
    const [earlier, later] = f.db.table("runtimeIngestionEvents");
    await f.db.patch("runtimeIngestionEvents", earlier._id, { factsState: "failed", vectorsState: "complete" });
    await f.db.patch("runtimeIngestionEvents", later._id, { factsState: "complete", vectorsState: "complete", profile: DEFAULT_EMBEDDING_PROFILE });
    expect(await context.refreshScopeWatermarks(f.ctx, f.reference)).toEqual({ sequence: 2, factsThrough: 0, vectorsThrough: 2 });
    expect(await context.readStageProgress(f.ctx, f.reference, 2)).toMatchObject({
      facts: { complete: false, indexedThrough: 0, hole: { sequence: 1, state: "failed" } }, vectors: { complete: true, indexedThrough: 2 } });
    await ingestion.retireSourceEvents(f.ctx, f.reference, "earlier", "tombstoned");
    expect(await context.refreshScopeWatermarks(f.ctx, f.reference)).toEqual({ sequence: 2, factsThrough: 2, vectorsThrough: 2 });
    expect((await context.readStageProgress(f.ctx, f.reference, 1)).facts!.complete).toBe(true);
  });
  test("authorized cross-thread tail respects cutoff and deduplicates exact approved history", async () => {
    const f = await ingestionFixture(); const first = await f.source("approved history", "history");
    // These standalone sources have no managed transcript origin. Registered
    // cross-thread conversation permissions are exercised in the independent test.
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, first);
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("cross-thread correction", "correction"));
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("future", "future"));
    const result = await context.readPendingContext(f.ctx, { reference: f.reference, cutoff: 2,
      alreadyRepresented: [contextSourceKey(first, first.lineage)], maxBytes: 16384 });
    expect(result.completeness).toBe("complete"); expect(result.text).toContain("cross-thread correction");
    expect(result.text).not.toContain("approved history"); expect(result.text).not.toContain('"text":"future"'); expect(result.sources).toHaveLength(1);
  });
  test("33 unrepresented sources withhold the whole tail; history dedup happens before the source bound", async () => {
    const f = await ingestionFixture(); const represented: string[] = [];
    for (let i = 0; i < 34; i++) { const source = await f.source(`bounded source ${i}`, `tail-${i}`);
      await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); represented.push(contextSourceKey(source, source.lineage)); }
    expect(await context.readPendingContext(f.ctx, { reference: f.reference, cutoff: 34, alreadyRepresented: [], maxBytes: 16384 }))
      .toMatchObject({ completeness: "incomplete", reason: "CONTEXT_OVERFLOW", text: "", sources: [] });
    expect(await context.readPendingContext(f.ctx, { reference: f.reference, cutoff: 34, alreadyRepresented: represented, maxBytes: 16384 }))
      .toMatchObject({ completeness: "complete", text: "", sources: [] });
    expect(f.db.table("runtimeModelOperations")).toHaveLength(0);
  });
  test("current scope auth and owner index exclude another principal before source hydration", async () => {
    const f = await ingestionFixture(); await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("owner context", "own"));
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("foreign private context", "foreign"));
    await f.db.patch("runtimeIngestionEvents", f.db.table("runtimeIngestionEvents")[1]._id, { ownerPrincipalId: "foreign-principal" });
    await f.db.patch("runtimeMemorySources", f.db.table("runtimeMemorySources")[1]._id, { ownerPrincipalId: "foreign-principal" });
    const result = await context.readPendingContext(f.ctx, { reference: f.reference, cutoff: 2, alreadyRepresented: [], maxBytes: 16384 });
    expect(result.text).toContain("owner context"); expect(result.text).not.toContain("foreign private context");
    f.grant.revokedAt = Date.now();
    await expect(context.readPendingContext(f.ctx, { reference: f.reference, cutoff: 2, alreadyRepresented: [], maxBytes: 16384 })).rejects.toThrow();
    await expect(context.refreshScopeWatermarks(f.ctx, f.reference)).rejects.toThrow();
  });
  test("later queued input is excluded from pending and indexed paths despite captured scope sequence", async () => {
    const f = await ingestionFixture(); const a = await f.run("A"); const b = await f.run("B", a.conversationId);
    const first = f.db.table("runtimeRuns").find(run => run.runId === a.runId)!;
    const bridge = f.db.table("runtimeTranscriptMessages").find(message => message.runId === a.runId)!;
    const boundary = { conversationId: a.conversationId, runId: a.runId, queueSequence: first.queueSequence as number,
      anchor: { order: bridge.order as number, stepOrder: bridge.stepOrder as number } };
    const cutoff = (await ingestion.readScopeCutoff(f.ctx, f.reference)).sequence;
    const pending = await context.readPendingContext(f.ctx, { reference: f.reference, cutoff, alreadyRepresented: [], maxBytes: 16384, boundary });
    expect(pending.sources.map(source => source.sourceEventId)).toEqual([bridge.sourceEventId]);
    const future = f.db.table("runtimeTranscriptMessages").find(message => message.runId === b.runId)!;
    expect(await f.call(context.indexedSourceAtCutoff, { reference: f.reference, sourceId: future.sourceId, sourceRevision: future.revision, cutoff, boundary })).toBe(false);
    expect(await f.call(context.indexedSourceAtCutoff, { reference: f.reference, sourceId: bridge.sourceId, sourceRevision: bridge.revision, cutoff, boundary })).toBe(true);
  });
  test("stage-specific progress is bounded without reading extraction payload bodies", async () => {
    const f = await ingestionFixture();
    for (let sequence = 1; sequence <= 270; sequence++) f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId,
      memorySpaceId: f.reference.memorySpaceId, sequence, eligibility: "eligible", factsState: sequence === 1 ? "failed" : "complete", vectorsState: "complete", profile: DEFAULT_EMBEDDING_PROFILE });
    f.db.seed("runtimeIngestionScopes", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      sequence: 270, factsThrough: 0, vectorsThrough: 256, graphThrough: 0, version: 1 });
    expect(await context.refreshScopeWatermarks(f.ctx, f.reference)).toEqual({ sequence: 270, factsThrough: 0, vectorsThrough: 270 });
    expect(f.db.table("runtimeIngestionStages")).toHaveLength(0);
  });
  test("whole-scope diagnostics require a scope-wide grant while own readiness stays on the run", async () => {
    const f = await ingestionFixture(); await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("private activity"));
    await expect(f.call(context.status, { memorySpaceId: "space-a" })).rejects.toThrow("FORBIDDEN");
    f.grant.resourceAccess = "space";
    expect(await f.call(context.status, { memorySpaceId: "space-a" })).toMatchObject({ cutoff: 1,
      stages: { facts: { indexedThrough: 0, hole: { sequence: 1, state: "pending" } } } });
  });
  test("a nondefault profile continues all bounded pages even when default and facts are already current", async () => {
    const f = await ingestionFixture();
    for (let sequence = 1; sequence <= 600; sequence++) f.db.seed("runtimeIngestionEvents", {
      tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, sequence, eligibility: "eligible",
      factsState: "complete", vectorsState: "complete", profile: DEFAULT_EMBEDDING_PROFILE,
      vectorProfilesComplete: [DEFAULT_EMBEDDING_PROFILE.profileId, LARGE_EMBEDDING_PROFILE.profileId] });
    f.db.seed("runtimeIngestionScopes", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      sequence: 600, factsThrough: 600, vectorsThrough: 600, graphThrough: 0, version: 1,
      vectorProfileThrough: { [DEFAULT_EMBEDDING_PROFILE.profileId]: 600, [LARGE_EMBEDDING_PROFILE.profileId]: 0 } });
    await context.refreshScopeWatermarks(f.ctx, f.reference);
    expect(f.db.table("runtimeIngestionScopes")[0].vectorProfileThrough).toMatchObject({ [LARGE_EMBEDDING_PROFILE.profileId]: 256 });
    expect(f.scheduled).toEqual([{ name: "runtimeMemoryContext:refreshWatermarks", args: { reference: f.reference } }]);
    await context.refreshScopeWatermarks(f.ctx, f.reference);
    expect(f.db.table("runtimeIngestionScopes")[0].vectorProfileThrough).toMatchObject({ [LARGE_EMBEDDING_PROFILE.profileId]: 512 });
    expect(f.scheduled).toHaveLength(2);
    await context.refreshScopeWatermarks(f.ctx, f.reference);
    expect(f.db.table("runtimeIngestionScopes")[0]).toMatchObject({ factsThrough: 600, vectorsThrough: 600,
      vectorProfileThrough: { [LARGE_EMBEDDING_PROFILE.profileId]: 600 } });
    expect(f.scheduled).toHaveLength(2); expect(f.db.table("runtimeIngestionStages")).toHaveLength(0);
    expect(f.db.table("runtimeModelOperations")).toHaveLength(0);
  });
});
