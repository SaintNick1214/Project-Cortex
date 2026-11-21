/** Actual source pipeline and ledger policy; only embedding transport is mocked. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { MemoryModel } from "../../../src/domain/contracts";
import type { RuntimeExternalIngestResult } from "../../../src/client-runtime/external";
const { ingestionFixture, installIngestionMockRoot, ingestion } = await import("../runtimeIngestion/fixture");
const sources = await import("../../../convex-dev/runtimeExternalSources");
const { ConvexMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const { serverToolSourceLineage } = await import("../../../convex-dev/runtimeAgentTools");
const { prepareSourceContent } = await import("../../../src/domain/sources");
const ledger = await import("../../../convex-dev/runtimeModelPolicy");
const graph = await import("../../../convex-dev/runtimeGraph");
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
it("declared external tool descendants index vectors without fact budgets, extraction, promotion or forged-fact retrieval", async () => {
  const f = await ingestionFixture(), captured = await f.call<RuntimeExternalIngestResult>(sources.ingest, { requestId: "trust-root", input: {
    provider: "archive", externalSourceId: "assertion", externalEventId: "capture", externalRevision: 1, originalText: "Unverified church-time assertion", author: { id: "asserted-author" }, observedAt: 2,
    provenance: {}, attribution: "unverified_external", extraction: "none" } });
  const writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db), root = (await writer.getSource(captured.receipt.reference.sourceId))!;
  const witness = { sourceId: root.lineage.sourceId, sourceEventId: root.lineage.sourceEventId, sourceRevision: root.lineage.sourceRevision, contentHash: root.contentHash };
  const prepared = await prepareSourceContent(memoryScope(f.reference), serverToolSourceLineage(memoryScope(f.reference), "external-derived-tool"), "Derived unverified church-time assertion", { now: () => Date.now() });
  await writer.putSource({ ...prepared.source, contextSourceWitnesses: [witness] });
  const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, prepared.source, { eligibility: "eligible" });
  expect(await f.call(ingestion.claim, { reference: f.reference, eventId: event.eventId, stage: "extract" })).toBeNull();
  expect(f.db.table("runtimeIngestionJobs")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  const model = { extract: jest.fn<MemoryModel["extract"]>(async () => { throw Error("Unverified extraction attempted"); }), resolve: jest.fn<MemoryModel["resolve"]>(async () => { throw Error("Unverified resolution attempted"); }),
    embed: jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile, vectors: request.texts.map(() => Array<number>(request.profile.dimensions).fill(0.25)) })) };
  await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId: event.eventId, stage: "vectors" }, () => model);
  expect(model.embed).toHaveBeenCalledTimes(1); expect(model.extract).not.toHaveBeenCalled(); expect(model.resolve).not.toHaveBeenCalled();
  const stored = f.db.table("runtimeIngestionEvents").find(row => row.eventId === event.eventId)!;
  expect(stored).toMatchObject({ factsState: "skipped", vectorsState: "complete" });
  const stages = f.db.table("runtimeIngestionStages").filter(row => row.eventId === event.eventId);
  expect(stages.filter(row => row.stage !== "vectors").every(row => row.state === "skipped")).toBe(true);
  expect(JSON.parse(stages.find(row => row.stage === "vectors")!.policyCanonical as string)).toMatchObject({ operationKey: "embedding.memory" });
  expect(f.db.table("facts")).toEqual([]); expect(f.db.table("runtimeMemoryVectors").length).toBeGreaterThan(0);
  const deniedBudget = await ledger.bindTrustedBudget(f.ctx, { reference: f.reference, operationKey: "memory.extract", requestId: "denied-promotion", requestCanonical: "{}" });
  const source = { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1, contentHash: prepared.source.contentHash };
  for (const operationKey of ["memory.extract", "facts.resolve"]) await expect(f.call(ledger.resolve, { reference: f.reference, operationKey, runBudgetId: deniedBudget.runBudgetId, source })).rejects.toMatchObject({ data: { code: "CAPABILITY_UNAVAILABLE" } });
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  const forged = { factId: "old-forged-unverified", tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId, lineage: prepared.source.lineage,
    extractionPolicyVersion: "forged", fact: "Unverified assertion promoted as a user fact", factType: "knowledge", confidence: 100, sourceType: "tool", tags: [], version: 1, createdAt: Date.now(), updatedAt: Date.now() };
  f.db.seed("facts", forged);
  expect(await writer.getFact(forged.factId)).toBeNull();
  await graph.enqueueFactProjection(f.ctx, f.reference, source.sourceId);
  for (const payload of f.db.table("runtimeGraphPayloads")) expect(JSON.parse(payload.payloadCanonical as string).facts).toEqual([]);
});
