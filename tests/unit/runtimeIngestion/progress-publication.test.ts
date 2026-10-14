/** Actual registered ingestion handlers/storage ports; no cloud or inference claim. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { StageLease } from "../../../convex-dev/runtimeIngestion";
import type { MemoryModel } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE as small, LARGE_EMBEDDING_PROFILE as large } from "../../../src/domain/profile";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { ingestionFixture, installIngestionMockRoot, ingestion } from "./fixture";
import { currentMockRootSelection, ledger } from "../runtimeTranscript/fixture";
const context = await import("../../../convex-dev/runtimeMemoryContext");
const memory = await import("../../../convex-dev/runtimeMemory");
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;

async function setup(role: "user" | "assistant" = "user") {
  const f = await ingestionFixture();
  const run = f.db.seed("runtimeRuns", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    runId: "progress-run", conversationId: "progress-conversation", responseStatus: "complete", memoryStatus: "pending", updatedAt: 7 });
  const source = await f.source("User prefers blue", "progress-source", 1, role);
  const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source, { runId: run.runId as string, conversationId: run.conversationId as string });
  return { ...f, sourceValue: source, eventId: admitted.eventId, event: () => f.db.table("runtimeIngestionEvents").find(e => e.eventId === admitted.eventId)!,
    runRow: () => f.db.table("runtimeRuns").find(r => r._id === run._id)!,
    stage: (name: string) => f.db.table("runtimeIngestionStages").find(s => s.eventId === admitted.eventId && s.stage === name)! };
}
function patches(f: Fixture) {
  const spy = jest.spyOn(f.db, "patch");
  return { spy, rows: (table: string) => spy.mock.calls.flatMap(call => {
    const values: readonly unknown[] = call;
    if (values[0] !== table) return [];
    const patch = values[2];
    if (values.length !== 3 || !patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Unexpected patch port");
    return [{ patch: patch as Record<string, unknown> }];
  }) };
}
function lease(f: Fixture, eventId: string, stage: StageLease["stage"], owned: Record<string, unknown>): StageLease {
  return { reference: f.reference, eventId, stage, attempt: owned.attempt as number, leaseVersion: owned.leaseVersion as number };
}
async function receiptInput(f: Awaited<ReturnType<typeof setup>>, profile = small) {
  const source = f.sourceValue;
  const prepared = await prepareSourceContent(f.reference, source.lineage, source.content, { now: () => source.createdAt });
  const identity = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: 1,
    stage: "facts" as const, semanticPolicyVersion: "foreground-complete" };
  const receiptId = await processingIdentityKey(identity);
  return { source: { sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: 1 }, identity, chunks: prepared.chunks,
    vectors: prepared.chunks.map((chunk, ordinal) => ({ sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: 1,
      vectorId: `progress-vector-${profile.profileId}-${ordinal}`, chunkId: chunk.chunkId, tenantId: source.tenantId,
      memorySpaceId: source.memorySpaceId, profile, embedding: Array(profile.dimensions).fill(0.25) as number[], processingReceiptId: receiptId })) };
}
const model: MemoryModel = { extract: async () => ({ facts: [] }), resolve: async () => { throw new Error("Unexpected conflict model"); },
  embed: async request => ({ profile: request.profile, vectors: request.texts.map(() => Array(request.profile.dimensions).fill(0.25) as number[]) }) };

async function work(f: Fixture, eventId: string, stage: StageLease["stage"]) {
  await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage }, () => model);
}

describe("semantic ingestion progress publication", () => {
  beforeEach(() => installIngestionMockRoot());
  afterEach(() => { jest.restoreAllMocks(); });

  test.each(["user", "assistant"] as const)("%s claim retains event/run bytes while public stages show its exact running lease", async role => {
    const f = await setup(role), beforeEvent = structuredClone(f.event()), beforeRun = structuredClone(f.runRow()), stage = role === "assistant" ? "vectors" : "extract";
    const seen = patches(f), owned = await f.claim(f.eventId, stage);
    expect(owned).toMatchObject({ eventId: f.eventId, stage, attempt: 1, leaseVersion: 1 });
    expect(f.stage(stage)).toMatchObject({ state: "running", attempt: 1, leaseVersion: 1 });
    expect(f.stage(stage).leaseExpiresAt).toBeGreaterThan(Date.now());
    expect(f.stage(stage).policyCanonical).toBeDefined();
    expect(f.event()).toEqual(beforeEvent); expect(f.runRow()).toEqual(beforeRun);
    expect(seen.rows("runtimeIngestionEvents")).toHaveLength(0); expect(seen.rows("runtimeRuns")).toHaveLength(0);
    expect(await f.call(ingestion.status, { eventId: f.eventId })).toMatchObject({ stages: expect.arrayContaining([{ stage, state: "running", attempt: 1, failureCode: null, receiptId: null }]) });
    const progress = await context.readStageProgress(f.ctx, f.reference, 1);
    expect(progress.vectors).toMatchObject({ complete: false, hole: { sequence: 1, state: "pending" } });
    expect(await f.claim(f.eventId, stage)).toBeNull();
    expect(seen.rows("runtimeIngestionEvents")).toHaveLength(0); expect(seen.rows("runtimeRuns")).toHaveLength(0);
    expect(f.scheduled.filter(s => s.name === "runtimeIngestion:expireStage")).toHaveLength(1);
  });

  test("a genuine first-claim profile change still publishes exactly that profile", async () => {
    installIngestionMockRoot({ large: true });
    const f = await setup("assistant"), seen = patches(f);
    await f.claim(f.eventId, "vectors");
    expect(f.event().profile).toEqual(large); expect(f.event().vectorsState).toBe("pending");
    expect(JSON.parse(f.stage("vectors").policyCanonical as string).semanticProfile).toEqual(large);
    expect(seen.rows("runtimeIngestionEvents").map(call => call.patch)).toEqual([{ profile: large }]);
    expect(seen.rows("runtimeRuns")).toHaveLength(0);
  });

  test("completed extraction persists its receipt and scheduling without republishing pending readiness", async () => {
    const f = await setup(), beforeEvent = structuredClone(f.event()), beforeRun = structuredClone(f.runRow()), seen = patches(f);
    await f.extraction(f.eventId);
    expect(f.stage("extract")).toMatchObject({ state: "complete", payloadCanonical: "[]", receiptId: expect.any(String) });
    expect(f.event()).toEqual(beforeEvent); expect(f.runRow()).toEqual(beforeRun);
    expect(seen.rows("runtimeIngestionEvents")).toHaveLength(0); expect(seen.rows("runtimeRuns")).toHaveLength(0);
    expect(f.scheduled.filter(s => s.name === "runtimeMemoryContext:refreshWatermarks")).toHaveLength(2);
    expect(f.scheduled.filter(s => s.name === "runtimeIngestion:processStage" && s.args !== null && typeof s.args === "object" && "stage" in s.args && s.args.stage === "facts")).toHaveLength(1);
  });

  test("real facts/vector completion publishes readiness once and preserves contiguous profile watermarks", async () => {
    const f = await setup(), seen = patches(f);
    await f.extraction(f.eventId); await work(f, f.eventId, "facts");
    expect(f.event()).toMatchObject({ factsState: "complete", vectorsState: "pending" });
    expect(f.runRow().memoryStatus).toBe("pending"); expect(seen.rows("runtimeRuns")).toHaveLength(0);
    await work(f, f.eventId, "vectors");
    expect(f.event()).toMatchObject({ factsState: "complete", vectorsState: "complete", vectorProfilesComplete: [small.profileId] });
    expect(f.runRow()).toMatchObject({ responseStatus: "complete", memoryStatus: "complete" });
    expect(seen.rows("runtimeRuns")).toHaveLength(1);
    expect(seen.rows("runtimeRuns")[0]!.patch).toMatchObject({ memoryStatus: "complete" });
    await context.refreshScopeWatermarks(f.ctx, f.reference);
    expect(await context.readStageProgress(f.ctx, f.reference, 1)).toMatchObject({ facts: { complete: true, indexedThrough: 1 }, vectors: { complete: true, indexedThrough: 1 } });
    const before = f.db.writes;
    await work(f, f.eventId, "vectors"); expect(f.db.writes).toBe(before);
  });

  test("multi-stage completed import compares the current event, restoring complete after earlier pending publication", async () => {
    const f = await setup();
    await f.db.patch("runtimeIngestionEvents", f.event()._id, { factsState: "complete" });
    await f.db.patch("runtimeIngestionStages", f.stage("facts")._id, { state: "complete" });
    const input = await receiptInput(f), seen = patches(f);
    await f.call(memory.writeDerived, { reference: f.reference, capability: "write", input });
    expect(f.event()).toMatchObject({ factsState: "complete", vectorsState: "complete", vectorProfilesComplete: [small.profileId] });
    expect(seen.rows("runtimeIngestionEvents").map(call => call.patch).filter(patch => "factsState" in patch)).toEqual([
      { factsState: "pending", updatedAt: Date.now() }, { factsState: "complete", updatedAt: Date.now() }]);
    expect(f.stage("extract").state).toBe("skipped"); expect(f.stage("facts").state).toBe("complete");
    expect(f.runRow().memoryStatus).toBe("complete"); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1);
  });

  test("running vector stage cannot be repinned by another positive foreground generation", async () => {
    const f = await setup("assistant"), owned = await f.claim(f.eventId, "vectors");
    const pinned = f.stage("vectors").policyCanonical;
    expect(f.event().vectorsState).toBe("pending"); expect(f.stage("vectors").state).toBe("running");
    installIngestionMockRoot({ large: true }); await f.call(ledger.installDeploymentPolicy, currentMockRootSelection());
    const input = await receiptInput(f, large), seen = patches(f);
    await f.call(memory.writeDerived, { reference: f.reference, capability: "write", input });
    // Preserve original positive receipt import, but never repin the claimed worker.
    expect(f.event().profile).toEqual(small); expect(f.stage("vectors").policyCanonical).toBe(pinned);
    expect(f.event().vectorProfilesComplete).toEqual([large.profileId]);
    expect(seen.rows("runtimeIngestionEvents").some(call => "profile" in call.patch)).toBe(false);
    await expect(ingestion.requireStageLease(f.ctx, lease(f, f.eventId, "vectors", owned))).rejects.toMatchObject({ data: { code: "LEASE_EXPIRED" } });
  });

  test("safe failures/retry and interrupted leases publish real failure transitions without resetting response", async () => {
    const f = await setup(), first = await f.claim(f.eventId), seen = patches(f), args = lease(f, f.eventId, "extract", first);
    await f.call(ingestion.failStage, { ...args, uncertain: false, failureCode: "SAFE_PRE_DISPATCH" });
    expect(f.event().factsState).toBe("failed"); expect(f.runRow()).toMatchObject({ responseStatus: "complete", memoryStatus: "failed" });
    await f.call(ingestion.retry, { eventId: f.eventId, stage: "extract" });
    expect(f.event().factsState).toBe("pending"); expect(f.runRow().memoryStatus).toBe("pending");
    const next = await f.claim(f.eventId), current = lease(f, f.eventId, "extract", next);
    f.stage("extract").leaseExpiresAt = Date.now() - 1;
    await f.call(ingestion.expireStage, current);
    expect(f.event().factsState).toBe("unknown"); expect(f.runRow().memoryStatus).toBe("failed");
    expect(seen.rows("runtimeRuns").map(call => call.patch.memoryStatus)).toEqual(["failed", "pending", "failed"]);
    const writes = f.db.writes; await f.call(ingestion.expireStage, args); expect(f.db.writes).toBe(writes);
    await expect(f.call(ingestion.retry, { eventId: f.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
    expect(await context.readStageProgress(f.ctx, f.reference, 1)).toMatchObject({ facts: { complete: false, hole: { state: "failed" } } });
  });

  test("same failure status on another event does not rewrite the run or its timestamp", async () => {
    const f = await setup(), first = await f.claim(f.eventId);
    await f.call(ingestion.failStage, { ...lease(f, f.eventId, "extract", first), uncertain: true, failureCode: "UNKNOWN_RESULT" });
    const second = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("another source", "second"), { runId: "progress-run", conversationId: "progress-conversation" });
    const secondLease = await f.claim(second.eventId), before = structuredClone(f.runRow()), seen = patches(f);
    await f.call(ingestion.failStage, { ...lease(f, second.eventId, "extract", secondLease), uncertain: false, failureCode: "SAFE_PRE_DISPATCH" });
    expect(f.runRow()).toEqual(before); expect(seen.rows("runtimeRuns")).toHaveLength(0);
    expect(f.db.table("runtimeIngestionEvents").find(e => e.eventId === second.eventId)!.factsState).toBe("failed");
    expect(f.scheduled.filter(s => s.name === "runtimeMemoryContext:refreshWatermarks")).toHaveLength(4);
  });

  test("tracked source revision retires old readiness and resets the complete run to pending", async () => {
    const f = await setup(); await f.call(memory.writeDerived, { reference: f.reference, capability: "write", input: await receiptInput(f) });
    expect(f.runRow().memoryStatus).toBe("complete");
    const seen = patches(f), edited = await f.source("User now prefers green", "progress-source", 2);
    const next = await f.transaction(() => ingestion.enqueueSourceEvent(f.ctx, f.reference, edited, { runId: "progress-run", conversationId: "progress-conversation" }));
    expect(f.event().eligibility).toBe("superseded"); expect(next.sequence).toBe(2);
    expect(f.db.table("runtimeIngestionEvents").find(e => e.eventId === next.eventId)).toMatchObject({ eligibility: "eligible", factsState: "pending", vectorsState: "pending" });
    expect(f.runRow()).toMatchObject({ responseStatus: "complete", memoryStatus: "pending" });
    expect(seen.rows("runtimeRuns").map(call => call.patch.memoryStatus)).toEqual(["pending"]);
  });

  test.each(["grant", "source", "tombstone"])("fresh %s denial still rolls back late completion and preserves pending event/run", async change => {
    const f = await setup(), owned = await f.claim(f.eventId), before = structuredClone({ event: f.event(), run: f.runRow(), stage: f.stage("extract") });
    if (change === "grant") f.grant.revokedAt = Date.now();
    else if (change === "source") await f.source("Changed source", "progress-source", 2);
    else f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "progress-source", deletedAt: Date.now() });
    const seen = patches(f);
    await expect(f.call(ingestion.persistStage, { ...lease(f, f.eventId, "extract", owned), payloadCanonical: canonicalModelJson([]) })).rejects.toThrow();
    expect({ event: f.event(), run: f.runRow(), stage: f.stage("extract") }).toEqual(before);
    expect(seen.rows("runtimeIngestionEvents")).toHaveLength(0); expect(seen.rows("runtimeRuns")).toHaveLength(0);
  });

  test("a scheduling failure after semantic publication rolls back stage/event/run writes", async () => {
    const f = await setup(), owned = await f.claim(f.eventId), before = structuredClone({ event: f.event(), run: f.runRow(), stage: f.stage("extract") }), scheduled = structuredClone(f.scheduled);
    jest.spyOn(f.ctx.scheduler, "runAfter").mockRejectedValueOnce(new Error("SCHEDULER_FAULT"));
    await expect(f.call(ingestion.failStage, { ...lease(f, f.eventId, "extract", owned), uncertain: true, failureCode: "UNKNOWN_RESULT" })).rejects.toThrow("SCHEDULER_FAULT");
    expect({ event: f.event(), run: f.runRow(), stage: f.stage("extract") }).toEqual(before); expect(f.scheduled).toEqual(scheduled);
  });
});
