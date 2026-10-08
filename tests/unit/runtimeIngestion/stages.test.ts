import { jest, beforeEach, afterEach, describe, test, expect } from "@jest/globals";
import { ingestionFixture, installIngestionMockRoot, ingestion, candidate } from "./fixture";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import type { Doc } from "../../../convex-dev/_generated/dataModel";

describe("durable ingestion stage boundary", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("same tuple replay is one event/counter, changed hash or event alias cannot enter", async () => {
    const f = await ingestionFixture(); const source = await f.source("User prefers blue");
    const first = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    expect(await ingestion.enqueueSourceEvent(f.ctx, f.reference, source)).toEqual({ ...first, created: false });
    const counts = [f.db.table("runtimeIngestionEvents").length, f.db.table("runtimeIngestionStages").length];
    await expect(ingestion.enqueueSourceEvent(f.ctx, f.reference, { ...source, contentHash: "f".repeat(64) })).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    await expect(ingestion.enqueueSourceEvent(f.ctx, f.reference, { ...source, lineage: { ...source.lineage, sourceEventId: "aliased" } })).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect([f.db.table("runtimeIngestionEvents").length, f.db.table("runtimeIngestionStages").length]).toEqual(counts);
    expect((await ingestion.readScopeCutoff(f.ctx, f.reference)).sequence).toBe(1);
  });
  test("scope counter is shared across conversations, separate from their queue position", async () => {
    const f = await ingestionFixture();
    const a = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("A", "source-a"), { conversationId: "conversation-a", conversationSequence: 4 });
    const b = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("B", "source-b"), { conversationId: "conversation-b", conversationSequence: 1 });
    expect([a.sequence, b.sequence]).toEqual([1, 2]);
    expect((await ingestion.readScopeEvents(f.ctx, f.reference, { after: 0, through: 2, limit: 3 })).map(e => [e.sequence, e.conversationSequence])).toEqual([[1, 4], [2, 1]]);
  });
  test("approved user source schedules independently, awaiting approval never creates a job or dispatch", async () => {
    const f = await ingestionFixture(); const source = await f.source("approved later");
    const pending = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source, { eligibility: "awaiting_approval" });
    expect(f.scheduled.filter(s => s.name === "runtimeIngestion:processStage")).toHaveLength(0);
    await expect(f.claim(pending.eventId)).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0);
    const approved = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("approved later", "source-1", 2));
    expect(approved.sequence).toBe(2); expect(f.db.table("runtimeIngestionEvents")[0].eligibility).toBe("superseded");
    expect(f.scheduled.filter(s => s.name === "runtimeIngestion:processStage")).toHaveLength(1);
  });
  test("assistant completion is context/vector work with fact extraction explicitly skipped", async () => {
    const f = await ingestionFixture(); const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("Maybe the user likes red", "assistant", 1, "assistant"));
    const event = f.db.table("runtimeIngestionEvents")[0]; expect(event.eligibility).toBe("eligible"); expect(event.factsState).toBe("skipped");
    expect(f.scheduled.find(s => s.name === "runtimeIngestion:processStage")!.args).toMatchObject({ stage: "vectors" });
    expect(await f.claim(admitted.eventId, "extract")).toBeNull(); expect(f.db.table("facts")).toHaveLength(0);
  });
  test("duplicate delivery claims once; native account is fresh and policy pin rejects wrong stage", async () => {
    const f = await ingestionFixture(); const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("blue"));
    const owned = await f.claim(admitted.eventId); expect(await f.claim(admitted.eventId)).toBeNull();
    const job = f.db.table("runtimeIngestionJobs")[0]; const row = f.db.table("runtimeIngestionStages").find(s => s.stage === "extract")!;
    expect(owned.runBudgetId).toBe(job.runBudgetId); expect(f.db.table("runtimeBudgetAccounts").filter(a => a.kind === "run")).toHaveLength(1);
    const pin = JSON.parse(row.policyCanonical as string);
    await expect(ingestion.assertIngestionPolicyPin(f.ctx, job.runAccountId as never, "embedding.memory", pin, false, true)).rejects.toMatchObject({ data: { code: "LEASE_EXPIRED" } });
    await expect(ingestion.assertIngestionPolicyPin(f.ctx, job.runAccountId as never, "memory.extract", { ...pin, limits: { ...pin.limits, outputTokens: pin.limits.outputTokens - 1 } }, false, true)).rejects.toMatchObject({ data: { code: "POLICY_CHANGED" } });
  });
  test("expired lease is unknown and cannot be retried or attach its old extraction", async () => {
    const f = await ingestionFixture(); const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("blue")); const owned = await f.claim(admitted.eventId);
    const row = f.db.table("runtimeIngestionStages").find(s => s.stage === "extract")!; row.leaseExpiresAt = Date.now() - 1;
    expect(await f.claim(admitted.eventId)).toBeNull(); expect(row.state).toBe("unknown");
    await expect(f.call(ingestion.persistStage, { ...owned, reference: f.reference, stage: "extract", eventId: admitted.eventId,
      payloadCanonical: canonicalModelJson([{ ...candidate("blue"), lineage: f.db.table("runtimeIngestionEvents")[0].lineage }]) })).rejects.toMatchObject({ data: { code: "LEASE_EXPIRED" } });
    await expect(f.call(ingestion.retry, { eventId: admitted.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
  });
  test.each(["revision", "tombstone", "grant"])("%s change blocks all late stage writes", async mode => {
    const f = await ingestionFixture(); const source = await f.source("blue"); const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); const owned = await f.claim(admitted.eventId);
    if (mode === "revision") await f.source("red", "source-1", 2);
    else if (mode === "tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "source-1", deletedAt: Date.now() });
    else f.db.table("runtimeAuthGrants")[0].revokedAt = Date.now();
    await expect(ingestion.requireStageLease(f.ctx, { reference: f.reference, eventId: admitted.eventId, stage: "extract", attempt: owned.attempt as number, leaseVersion: owned.leaseVersion as number })).rejects.toBeDefined();
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
  });
  test("safe failure has finite retry budget; known unknown never retries and summaries reflect it", async () => {
    const f = await ingestionFixture(); const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("blue"));
    for (let attempt = 1; attempt <= 3; attempt++) {
      const owned = await f.claim(admitted.eventId);
      await f.call(ingestion.failStage, { reference: f.reference, eventId: admitted.eventId, stage: "extract", attempt: owned.attempt, leaseVersion: owned.leaseVersion, uncertain: false, failureCode: "SAFE_PRE_DISPATCH" });
      if (attempt < 3) await f.call(ingestion.retry, { eventId: admitted.eventId, stage: "extract" });
    }
    expect(f.db.table("runtimeIngestionStages").find(s => s.stage === "extract")!.state).toBe("dead_letter");
    expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("dead_letter");
    await expect(f.call(ingestion.retry, { eventId: admitted.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
  });
  test("facts and vector stages are distinct; default profile is pinned1536", async () => {
    const f = await ingestionFixture(); const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("blue"));
    await f.extraction(admitted.eventId, [candidate("blue")]);
    const event = f.db.table("runtimeIngestionEvents")[0] as unknown as Doc<"runtimeIngestionEvents">;
    expect(event.profile).toEqual(DEFAULT_EMBEDDING_PROFILE); expect(event.profile.dimensions).toBe(1536);
    expect((await ingestion.readEventStages(f.ctx, event)).map(s => [s.stage, s.state])).toEqual([["extract", "complete"], ["facts", "pending"], ["vectors", "pending"]]);
  });
});
