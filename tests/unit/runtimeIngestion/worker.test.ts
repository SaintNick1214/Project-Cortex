import { jest, beforeEach, afterEach, describe, test, expect } from "@jest/globals";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { MemoryModel } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { ingestionFixture, installIngestionMockRoot, ingestion, candidate } from "./fixture";
import { ledger, currentMockRootSelection } from "../runtimeTranscript/fixture";
import { ConvexError } from "convex/values";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { planBeliefs } from "../../../src/domain/belief-plan";
import type { AttributedFact } from "../../../src/domain/contracts";
const nativeMemory = await import("../../../convex-dev/runtimeMemory");
const auth = await import("../../../convex-dev/runtimeAuth");
const repoModule = await import("../../../convex-dev/runtimeMemoryRepository");
const { prepareSourceContent, processingIdentityKey } = await import("../../../src/domain/sources");
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;
function controlled(overrides: Partial<MemoryModel> = {}) {
  const model: MemoryModel = { extract: jest.fn(async () => ({ facts: [candidate("blue")] })),
    resolve: jest.fn<MemoryModel["resolve"]>(async () => ({ action: "ADD", targetFactId: null, mergedFact: null, reason: "New fact" })),
    embed: jest.fn<MemoryModel["embed"]>(async request => ({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: request.texts.map(() => new Array(1536).fill(0.25)) })), ...overrides };
  return model;
}
async function worker(f: Fixture, eventId: string, stage: "extract" | "facts" | "vectors", model: MemoryModel) {
  await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage }, () => model);
}
async function fullReceipt(f: Fixture, role: "user" | "assistant" = "user") {
  const source = await f.source("User likes blue", "completed", 1, role);
  const prepared = await prepareSourceContent(f.reference, source.lineage, source.content, { now: () => source.createdAt });
  const identity = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: 1, stage: "facts" as const, semanticPolicyVersion: "foreground-policy" };
  const receiptId = await processingIdentityKey(identity);
  const vectors = prepared.chunks.map((chunk, ordinal) => ({ ...identity, vectorId: `vector-${ordinal}`, chunkId: chunk.chunkId,
    tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, profile: DEFAULT_EMBEDDING_PROFILE,
    embedding: new Array(1536).fill(0.25), processingReceiptId: receiptId }));
  return { source, input: { source: { sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: 1 }, identity, chunks: prepared.chunks,
    vectors: vectors.map(({ stage: _stage, semanticPolicyVersion: _version, ...vector }) => vector) } };
}
describe("bounded source-stage worker", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("first vector claim pins backend large policy and stores3072 without marking default complete", async () => {
    installIngestionMockRoot({ large: true });
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference,
      await f.source("attributed assistant context", "large-assistant", 1, "assistant"));
    const embed = jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile,
      vectors: request.texts.map(() => Array(request.profile.dimensions).fill(0.25) as number[]) }));
    await worker(f, event.eventId, "vectors", controlled({ embed }));
    expect(embed.mock.calls[0]![0].profile).toEqual(LARGE_EMBEDDING_PROFILE);
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ profile: LARGE_EMBEDDING_PROFILE,
      factsState: "skipped", vectorsState: "complete", vectorProfilesComplete: [LARGE_EMBEDDING_PROFILE.profileId] });
    const stage = f.db.table("runtimeIngestionStages").find(row => row.stage === "vectors")!;
    expect(JSON.parse(stage.policyCanonical as string).semanticProfile).toEqual(LARGE_EMBEDDING_PROFILE);
    expect(f.db.table("runtimeMemoryVectors")[0].embeddingLarge).toHaveLength(3072);
    expect(f.db.table("runtimeMemoryVectors")[0]).not.toHaveProperty("embedding");
    expect(f.db.table("runtimeIngestionJobs")).toHaveLength(1); expect(f.db.table("facts")).toHaveLength(0);
    const context = await import("../../../convex-dev/runtimeMemoryContext");
    await context.refreshScopeWatermarks(f.ctx, f.reference);
    expect(f.db.table("runtimeIngestionScopes")[0]).toMatchObject({ vectorsThrough: 0,
      vectorProfileThrough: { [LARGE_EMBEDDING_PROFILE.profileId]: 1 } });
  });
  test("an additional foreground generation updates profile readiness without repeating belief import", async () => {
    const f = await ingestionFixture(); const completed = await fullReceipt(f);
    await f.call(nativeMemory.writeDerived, { reference: f.reference, capability: "write", input: completed.input });
    const sourceBefore = f.db.table("runtimeMemorySources")[0]; const chunksBefore = structuredClone(f.db.table("runtimeMemoryChunks"));
    const outboxBefore = structuredClone(f.db.table("runtimeBeliefOutbox"));
    installIngestionMockRoot({ large: true });
    await f.call(ledger.installDeploymentPolicy, currentMockRootSelection());
    const identity = { ...completed.input.identity, stage: "vectors" as const, semanticPolicyVersion: LARGE_EMBEDDING_PROFILE.profileId };
    const receiptId = await processingIdentityKey(identity);
    const input = { source: completed.input.source, identity, chunks: completed.input.chunks,
      vectors: completed.input.vectors.map(vector => ({ ...vector, vectorId: `${vector.vectorId}:large`, profile: LARGE_EMBEDDING_PROFILE,
        embedding: Array(3072).fill(0.25) as number[], processingReceiptId: receiptId })) };
    await f.call(nativeMemory.writeDerived, { reference: f.reference, capability: "write", input });
    const writes = f.db.writes;
    await f.call(nativeMemory.writeDerived, { reference: f.reference, capability: "write", input });
    expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeIngestionEvents")).toHaveLength(1);
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ profile: DEFAULT_EMBEDDING_PROFILE,
      vectorProfilesComplete: [DEFAULT_EMBEDDING_PROFILE.profileId, LARGE_EMBEDDING_PROFILE.profileId] });
    expect(f.db.table("runtimeMemorySources")[0]).toEqual(sourceBefore); expect(f.db.table("runtimeMemoryChunks")).toEqual(chunksBefore);
    expect(f.db.table("runtimeBeliefOutbox")).toEqual(outboxBefore); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(2);
    expect(f.db.table("runtimeMemoryVectorGenerations")).toHaveLength(2); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  test("delayed extraction does not alter response finality and duplicate delivery performs no second call", async () => {
    const f = await ingestionFixture(); const source = await f.source("User likes blue");
    const run = f.db.seed("runtimeRuns", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, runId: "response", conversationId: "conversation", responseStatus: "complete", memoryStatus: "pending" });
    const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, source, { runId: "response", conversationId: "conversation", conversationSequence: 1 });
    let release!: (value: unknown) => void; const wait = new Promise<unknown>(resolve => { release = resolve; });
    const extract = jest.fn(async () => await wait); const model = controlled({ extract });
    const active = worker(f, event.eventId, "extract", model);
    for (let poll = 0; extract.mock.calls.length === 0 && poll < 30; poll++) await new Promise(resolve => setTimeout(resolve, 0));
    expect(extract).toHaveBeenCalledTimes(1);
    expect(run.responseStatus).toBe("complete"); expect(f.db.table("facts")).toHaveLength(0);
    await worker(f, event.eventId, "extract", model); expect(extract).toHaveBeenCalledTimes(1);
    release({ facts: [candidate("blue")] }); await active;
    expect(f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")!.state).toBe("complete");
    expect(f.db.table("runtimeRuns")[0]).toMatchObject({ responseStatus: "complete", memoryStatus: "pending" });
  });
  test("facts then default vectors use one new ingestion account and preserve completed extract parent", async () => {
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("User likes blue")); await f.extraction(event.eventId, [candidate("blue")]);
    const model = controlled(); await worker(f, event.eventId, "facts", model);
    expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("complete"); expect(model.extract).not.toHaveBeenCalled(); expect(model.resolve).not.toHaveBeenCalled();
    await worker(f, event.eventId, "vectors", model);
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ factsState: "complete", vectorsState: "complete" });
    expect(f.db.table("runtimeMemoryVectors")[0]).toMatchObject({ profile: DEFAULT_EMBEDDING_PROFILE, sourceRevision: 1 });
    expect(f.db.table("runtimeBudgetAccounts").filter(row => row.kind === "run")).toHaveLength(1);
    expect(model.embed).toHaveBeenCalledTimes(1); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1);
  });
  test.each(["uncertain", "predispatch"])("%s model failure is observable with exact retry semantics", async mode => {
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("User likes blue"));
    const extract = jest.fn(async () => { throw mode === "uncertain" ? new Error("Provider diagnostic secret") : new ConvexError({ outcome: "not_dispatched" }); });
    await worker(f, event.eventId, "extract", controlled({ extract }));
    expect(f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")!.state).toBe(mode === "uncertain" ? "unknown" : "failed");
    const observable = await f.call(ingestion.status, { eventId: event.eventId }); expect(JSON.stringify(observable)).not.toContain("Provider diagnostic secret");
    if (mode === "uncertain") await expect(f.call(ingestion.retry, { eventId: event.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
    else expect(await f.call(ingestion.retry, { eventId: event.eventId, stage: "extract" })).toEqual({ queued: true });
    expect(extract).toHaveBeenCalledTimes(1); expect(f.db.table("facts")).toHaveLength(0);
  });
  test("stale admission records a safe failed stage without constructing a model", async () => {
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("blue")); f.grant.revokedAt = Date.now();
    const factory = jest.fn(() => controlled());
    await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId: event.eventId, stage: "extract" }, factory);
    expect(factory).not.toHaveBeenCalled(); expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("failed"); expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0);
  });
  test("scheduled exact lease retirement is sticky unknown and an obsolete callback cannot retire its successor", async () => {
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("blue")); const owned = await f.claim(event.eventId);
    const scheduled = f.scheduled.find(item => item.name === "runtimeIngestion:expireStage")!.args as Record<string, unknown>;
    const stage = f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")!; stage.leaseExpiresAt = Date.now() - 1;
    await f.call(ingestion.expireStage, { ...scheduled, leaseVersion: (owned.leaseVersion as number) - 1 }); expect(stage.state).toBe("running");
    await f.call(ingestion.expireStage, scheduled); expect(stage.state).toBe("unknown");
    expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("unknown");
  });
  test("wrong paid vector output becomes unknown with no chunks/vectors and no automatic retry", async () => {
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("speculation", "assistant", 1, "assistant"));
    const embed = jest.fn(async () => ({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: [[1, 2]] })); await worker(f, event.eventId, "vectors", controlled({ embed }));
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ factsState: "skipped", vectorsState: "unknown" });
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0); expect(f.db.table("runtimeMemoryChunks")).toHaveLength(0); expect(embed).toHaveBeenCalledTimes(1);
  });
  test("completed foreground receipt stamps a contiguous source event without a second paid pipeline", async () => {
    const f = await ingestionFixture(); const completed = await fullReceipt(f); const result = await f.call<{ receiptId: string }>(nativeMemory.writeDerived,
      { reference: f.reference, capability: "write", input: completed.input });
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ sequence: 1, factsState: "complete", vectorsState: "complete" });
    const model = controlled(); await worker(f, f.db.table("runtimeIngestionEvents")[0].eventId as string, "extract", model); expect(model.extract).not.toHaveBeenCalled();
    await f.call(nativeMemory.writeDerived, { reference: f.reference, capability: "write", input: completed.input });
    expect(f.db.table("runtimeIngestionEvents")).toHaveLength(1); expect(f.db.table("runtimeMemoryReceipts")[0].receiptId).toBe(result.receiptId);
  });
  test("a foreground tool draft is neither visible nor eligible until its durable operation completes", async () => {
    const f = await ingestionFixture(); const completed = await fullReceipt(f);
    const operationId = "owned-memory-tool";
    const lineage = { sourceId: completed.source.lineage.sourceId, sourceEventId: completed.source.lineage.sourceEventId, sourceRevision: 1,
      role: "tool" as const, trust: "verified_tool_evidence" as const, operationId };
    await f.db.patch("runtimeMemorySources", f.db.table("runtimeMemorySources")[0]._id, { lineage });
    const operation = f.db.seed("runtimeAgentOperations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      operationId, runId: "owned-tool-run", toolName: "memory_remember", state: "started" });
    const result = await f.call<{ receiptId: string }>(nativeMemory.writeDerived, { reference: f.reference, capability: "write", input: completed.input });
    const event = f.db.table("runtimeIngestionEvents")[0];
    expect(event).toMatchObject({ eligibility: "awaiting_tool", lineage });
    expect(f.scheduled.filter(row => row.name === "runtimeIngestion:processStage")).toHaveLength(0);
    await expect(new repoModule.ConvexMemoryRepository(f.ctx, f.reference, "read").getSource(lineage.sourceId)).rejects.toThrow();
    await expect(ingestion.registerCompletedToolSource(f.ctx, f.reference, operationId)).rejects.toThrow("TOOL_NOT_COMPLETE");
    await f.db.patch("runtimeAgentOperations", operation._id, { state: "complete", resultCanonical: canonicalModelJson({ sourceId: lineage.sourceId, receiptId: result.receiptId }) });
    await f.transaction(async () => await ingestion.registerCompletedToolSource(f.ctx, f.reference, operationId));
    await f.transaction(async () => await ingestion.registerCompletedToolSource(f.ctx, f.reference, operationId));
    expect(f.db.table("runtimeIngestionEvents")).toHaveLength(1);
    expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ eligibility: "eligible", factsState: "complete", vectorsState: "complete", lineage });
    expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1);
    expect(await new repoModule.ConvexMemoryRepository(f.ctx, f.reference, "read").getSource(lineage.sourceId)).toMatchObject({ lineage });
    expect(f.db.table("runtimeModelOperations")).toHaveLength(0);
  });
  test("source tombstone atomically skips indexing holes and immediately removes derived visibility", async () => {
    const f = await ingestionFixture(); const completed = await fullReceipt(f); await f.call(nativeMemory.writeDerived, { reference: f.reference, capability: "write", input: completed.input });
    await f.call(auth.tombstoneResource, { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: completed.source.lineage.sourceId });
    expect(f.db.table("runtimeIngestionEvents")[0].eligibility).toBe("tombstoned");
    await expect(new repoModule.ConvexMemoryRepository(f.ctx, f.reference, "read").getSource(completed.source.lineage.sourceId)).rejects.toBeDefined();
  });
  test("confirmed facts draft survives interruption and reconciles once with zero new model calls", async () => {
    const f = await ingestionFixture(); const admitted = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("User prefers blue"));
    await f.extraction(admitted.eventId, [candidate("blue")]); const owned = await f.claim(admitted.eventId, "facts");
    const lease = { reference: f.reference, eventId: admitted.eventId, stage: "facts" as const, attempt: owned.attempt as number, leaseVersion: owned.leaseVersion as number };
    const input = await ingestion.requireStageLease(f.ctx, lease); const extract = f.db.table("runtimeIngestionStages").find(row => row.stage === "extract")!;
    const plan = await planBeliefs({ eventId: admitted.eventId, sequence: admitted.sequence, source: input.source,
      candidates: JSON.parse(extract.payloadCanonical as string) as AttributedFact[], existing: [], resolve: async () => { throw new Error("Unexpected model call"); } });
    await f.call(ingestion.persistDraft, { ...lease, payloadCanonical: canonicalModelJson(plan) });
    const stage = f.db.table("runtimeIngestionStages").find(row => row.stage === "facts")!; stage.leaseExpiresAt = Date.now() - 1;
    await f.call(ingestion.expireStage, lease); expect(stage.state).toBe("unknown"); expect(f.db.table("facts")).toHaveLength(0);
    expect(await f.call(ingestion.reconcile, { eventId: admitted.eventId, stage: "facts" })).toMatchObject({ reconciled: true });
    expect(await f.call(ingestion.reconcile, { eventId: admitted.eventId, stage: "facts" })).toMatchObject({ reconciled: true });
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("runtimeBeliefOutbox")).toHaveLength(1); expect(f.db.table("runtimeModelOperations")).toHaveLength(1);
  });
  test("unconfirmed unknown work cannot be reconciled; confirmed vectors reuse paid draft after storage failure", async () => {
    const f = await ingestionFixture(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("assistant speculation", "assistant", 1, "assistant"));
    const original = f.ctx.runMutation; let failCommit = true;
    f.ctx.runMutation = (async (reference, args) => {
      const { getFunctionName } = await import("convex/server");
      if (getFunctionName(reference) === "runtimeIngestion:commitVectors" && failCommit) throw new ConvexError({ code: "STORAGE_REJECTED", outcome: "not_dispatched" });
      return await original(reference, args);
    }) as typeof original;
    const model = controlled(); await worker(f, event.eventId, "vectors", model);
    expect(f.db.table("runtimeIngestionEvents")[0].vectorsState).toBe("failed"); expect(model.embed).toHaveBeenCalledTimes(1);
    const stage = f.db.table("runtimeIngestionStages").find(row => row.stage === "vectors")!; expect(stage.payloadCanonical).toBeDefined();
    failCommit = false; await f.call(ingestion.reconcile, { eventId: event.eventId, stage: "vectors" });
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(1); expect(model.embed).toHaveBeenCalledTimes(1);
    const pending = await ingestion.enqueueSourceEvent(f.ctx, f.reference, await f.source("not confirmed", "unknown")); const owned = await f.claim(pending.eventId);
    await f.call(ingestion.failStage, { reference: f.reference, eventId: pending.eventId, stage: "extract", attempt: owned.attempt, leaseVersion: owned.leaseVersion, uncertain: true, failureCode: "UNKNOWN" });
    await expect(f.call(ingestion.reconcile, { eventId: pending.eventId, stage: "extract" })).rejects.toMatchObject({ data: { code: "RECONCILIATION_NOT_SAFE" } });
  });
});
