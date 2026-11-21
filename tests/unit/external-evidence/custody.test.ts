import { jest, beforeEach, afterEach, describe, test, expect } from "@jest/globals";
import type { RuntimeExternalSourceInput, RuntimeExternalIngestResult, RuntimeExternalHistoryPage, RuntimeExternalSearchPage, RuntimeExternalSourceVersion } from "../../../src/client-runtime/external";
import { externalIngestResult, externalSourceVersion, externalHistoryPage, externalSearchPage } from "../../../src/client-runtime/external";
import { ingestionFixture, installIngestionMockRoot } from "../runtimeIngestion/fixture";
import { semanticHash, DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { prepareSourceContent, isFactExtractionEligible, parseSourceFactsResponse, processingIdentityKey } from "../../../src/domain/sources";



import type { Doc } from "../../../convex-dev/_generated/dataModel";
import type { SourceContent, DerivedFact } from "../../../src/domain/contracts";
const { ConvexMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
const { vectorRecallItems } = await import("../../../convex-dev/runtimeMemoryServices");
const api = await import("../../../convex-dev/runtimeExternalSources");
const assets = await import("../../../convex-dev/runtimeAssetCatalog");
const assetApi = await import("../../../convex-dev/runtimeAssets");
const attachments = await import("../../../convex-dev/attachments");
const transcripts = await import("../../../convex-dev/runtimeTranscript");
const shares = await import("../../../convex-dev/conversationShares");
function input(patch: Partial<RuntimeExternalSourceInput> = {}): RuntimeExternalSourceInput { return { provider: "archive", externalSourceId: "channel/message-1", externalEventId: "capture-1/message-1", externalRevision: 1,
  originalText: "  Could the church—time proposal be right?\r\nCafe\u0301: only a proposal.  ", author: { id: "external-author-42", name: "Archive author" }, authoredAt: 123, editedAt: 456, observedAt: 789,
  provenance: { location: "archive://channel/message-1", captureId: "capture-1", metadata: { file: "page.json", exact: true } }, metadata: { replyTo: "parent-7", reviewed: false }, assetReferences: [], attribution: "unverified_external", extraction: "none", ...patch }; }
async function fixture() {
  const f = await ingestionFixture();
  const ingest = (value: RuntimeExternalSourceInput = input(), requestId = "batch-1") => f.call<RuntimeExternalIngestResult>(api.ingest, { requestId, input: value });
  const get = (sourceId: string, versionId?: string) => f.call<RuntimeExternalSourceVersion>(api.get, { sourceId, ...(versionId ? { versionId } : {}) });
  return { ...f, get grant() { return f.grant; }, ingest, get };
}
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
describe("external custody actual handlers with transactional in-memory Convex port (no live service/provider)", () => {
  test("preserves exact original IDs/author/times/provenance and schedules vectors without a chat or fact", async () => {
    const f = await fixture(), original = input(), first = externalIngestResult(await f.ingest(original));
    expect(first.receipt).toMatchObject({ requestId: "batch-1", externalEventId: original.externalEventId, outcome: "created", observedAt: 789, provenance: original.provenance, originalContentHash: await semanticHash(original.originalText) });
    expect(first.readiness).toMatchObject({ facts: "skipped", vectors: "pending", sourceRevision: 1, attempt: 0 });
    const version = externalSourceVersion(await f.get(first.receipt.reference.sourceId));
    expect(version).toMatchObject({ kind: "content", originalText: original.originalText, originalContentHash: await semanticHash(original.originalText), normalizedContentHash: await semanticHash("Could the church—time proposal be right?\nCafé: only a proposal."), author: original.author, authoredAt: 123, editedAt: 456, metadata: original.metadata, current: true, tombstoned: false });
    const source = f.db.table("runtimeMemorySources")[0]; expect(source).toMatchObject({ content: "Could the church—time proposal be right?\nCafé: only a proposal.", lineage: { role: "external", trust: "unverified_external" } });
    expect(f.scheduled.filter(s => s.name === "runtimeIngestion:processStage").map(s => s.args)).toEqual([expect.objectContaining({ stage: "vectors" })]);
    expect(f.db.table("runtimeIngestionStages").map(s => [s.stage, s.state])).toEqual([["extract", "skipped"], ["facts", "skipped"], ["vectors", "pending"]]);
    expect(f.db.table("facts")).toHaveLength(0); expect(f.native.messages.size).toBe(0); expect(f.db.table("runtimeConversations")).toHaveLength(0);
    expect(isFactExtractionEligible((source as unknown as SourceContent).lineage)).toBe(false);
    expect(() => parseSourceFactsResponse({ facts: [] }, source as unknown as SourceContent)).toThrow("POLICY_DENIED");
    expect(await f.claim(first.readiness.ingestionEventId!, "extract")).toBeNull();
    const claim = await f.claim(first.readiness.ingestionEventId!, "vectors"); expect(claim).toMatchObject({ attempt: 1 });
    expect(await f.call(api.status, { receiptId: first.receipt.receiptId })).toMatchObject({ receipt: first.receipt, readiness: { facts: "skipped", vectors: "running", attempt: 1 } });
    expect(f.db.table("runtimeModelOperations").some(r => r.operationKey === "memory.extract")).toBe(false);
  });
  test("idempotent observation replay returns original receipt across batches, conflicting reuse rolls back", async () => {
    const f = await fixture(), first = await f.ingest(), counts = { observations: f.db.table("runtimeExternalObservations").length, versions: f.db.table("runtimeExternalVersions").length, scheduled: f.scheduled.length };
    const replay = await f.ingest(input(), "different-batch"); expect(replay.receipt).toEqual(first.receipt);
    expect({ observations: f.db.table("runtimeExternalObservations").length, versions: f.db.table("runtimeExternalVersions").length, scheduled: f.scheduled.length }).toEqual(counts);
    await expect(f.ingest(input({ originalText: "different text" }))).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    await expect(f.ingest(input({ externalSourceId: "different-source" }))).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(f.db.table("runtimeExternalSources")).toHaveLength(1); expect(f.db.table("runtimeExternalObservations")).toHaveLength(1);
  });
  test.each(["text", "author", "timestamp", "metadata"])("equal revision with changed %s conflicts without effects", async kind => {
    const f = await fixture(); await f.ingest();
    const change = kind === "text" ? { originalText: "edited" } : kind === "author" ? { author: { id: "other" } } : kind === "timestamp" ? { editedAt: 457 } : { metadata: { reviewed: true } };
    await expect(f.ingest(input({ externalEventId: "new-capture", ...change }))).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(f.db.table("runtimeExternalVersions")).toHaveLength(1); expect(f.db.table("runtimeExternalObservations")).toHaveLength(1); expect(f.db.table("runtimeIngestionEvents")).toHaveLength(1);
  });
  test("out-of-order capture retains body, unchanged observations retain provenance and higher revision reuses generation", async () => {
    const f = await fixture(), first = await f.ingest(input({ externalRevision: 3 }));
    const historical = await f.ingest(input({ externalRevision: 1, externalEventId: "late-1", originalText: "Older church candidate" })); expect(historical.receipt.outcome).toBe("historical"); expect(historical.readiness.vectors).toBe("not_current");
    const edit = await f.ingest(input({ externalRevision: 5, externalEventId: "edit-5", originalText: "I retract that church—time proposal.", editedAt: 800 })); expect(edit.receipt.outcome).toBe("revised");
    const unchanged = await f.ingest(input({ externalRevision: 6, externalEventId: "capture-6", originalText: "I retract that church—time proposal.", editedAt: 800, observedAt: 1000, provenance: { captureId: "capture-new", metadata: { file: "new-page.json" } } }));
    expect(unchanged.receipt.outcome).toBe("unchanged"); expect(unchanged.readiness.ingestionEventId).toBe(edit.readiness.ingestionEventId); expect(unchanged.readiness.sourceRevision).toBe(5);
    expect((await f.get(first.receipt.reference.sourceId)).reference).toEqual(unchanged.receipt.reference);
    expect(await f.get(first.receipt.reference.sourceId, first.receipt.reference.versionId)).toMatchObject({ originalText: input().originalText, current: false });
    expect(await f.get(first.receipt.reference.sourceId, historical.receipt.reference.versionId)).toMatchObject({ originalText: "Older church candidate", current: false });
    expect(f.db.table("runtimeIngestionEvents")).toHaveLength(2); expect(f.db.table("runtimeIngestionEvents")[0].eligibility).toBe("superseded");
    const capture = await f.ingest(input({ externalRevision: 6, externalEventId: "capture-6b", originalText: "I retract that church—time proposal.", editedAt: 800, observedAt: 1100 }));
    expect(capture.receipt.reference.versionId).toBe(unchanged.receipt.reference.versionId); expect(f.db.table("runtimeExternalVersions")).toHaveLength(4); expect(f.db.table("runtimeExternalObservations")).toHaveLength(5);
  });
  test("blank/attachment-only bodies preserve custody and text removal retires old index", async () => {
    const f = await fixture(), blank = await f.ingest(input({ originalText: " \r\n " })); expect(blank.readiness).toEqual({ facts: "skipped", vectors: "not_requested" }); expect(f.db.table("runtimeMemorySources")).toHaveLength(0);
    const text = await f.ingest(input({ externalRevision: 2, externalEventId: "text-2", originalText: "new text" })); expect(text.readiness.vectors).toBe("pending");
    const removed = await f.ingest(input({ externalRevision: 3, externalEventId: "empty-3", originalText: "" })); expect(removed.readiness.vectors).toBe("not_requested");
    expect(f.db.table("runtimeMemorySources")[0].tombstonedAt).toBeDefined(); expect(f.db.table("runtimeIngestionEvents")[0].eligibility).toBe("tombstoned");
    const restored = await f.ingest(input({ externalRevision: 4, externalEventId: "text-4", originalText: "different text" })); expect(restored.readiness.vectors).toBe("pending");
    expect(f.db.table("runtimeMemorySources")[0].tombstonedAt).toBeUndefined(); expect(f.db.table("runtimeMemorySources")[0].lineage).toMatchObject({ sourceRevision: 4 });
  });
  test("exact source search handles raw punctuation/Unicode/CRLF, current/history and snapshot pagination", async () => {
    const f = await fixture(), first = await f.ingest();
    const page = externalSearchPage(await f.call(api.search, { literal: "church—time" })); expect(page.items.map(v => v.originalText)).toEqual([input().originalText]); expect(page.completeThroughWatermark).toBe(true);
    for (const literal of ["Church—time", "church time", "Café", "proposal.\n"]) expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal })).items).toEqual([]);
    expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal: "Cafe\u0301" })).items).toHaveLength(1);
    await f.ingest(input({ externalRevision: 2, externalEventId: "retraction", originalText: "Retraction: not that clue" }));
    expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal: "church—time" })).items).toHaveLength(0);
    expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal: "church—time", includeHistory: true })).items[0].reference).toEqual(first.receipt.reference);
    for (let n = 2; n <= 4; n++) await f.ingest(input({ externalSourceId: `message-${n}`, externalEventId: `capture-${n}`, originalText: "needle" }));
    const a = await f.call<RuntimeExternalSearchPage>(api.search, { literal: "needle", limit: 1 }); expect(a.items).toHaveLength(1); expect(a.hasMore).toBe(true);
    await f.ingest(input({ externalSourceId: "message-late", externalEventId: "capture-late", originalText: "needle" }));
    await expect(f.call(api.search, { literal: "wrong", after: a.nextCursor })).rejects.toMatchObject({ data: { code: "CURSOR_SCOPE_CHANGED" } });
    const b = await f.call<RuntimeExternalSearchPage>(api.search, { literal: "needle", limit: 10, after: a.nextCursor }); expect(b.items).toHaveLength(2); expect(b.watermark).toBe(a.watermark); expect(b.completeThroughWatermark).toBe(true);
    expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal: "needle" })).items).toHaveLength(4);
  });
  test("observation history keeps all capture provenance and restart checkpoints bind source/filter/principal", async () => {
    const f = await fixture(), first = await f.ingest();
    await f.ingest(input({ externalEventId: "capture-2", observedAt: 1000, provenance: { captureId: "second" } }));
    const a = externalHistoryPage(await f.call(api.history, { sourceId: first.receipt.reference.sourceId, limit: 1 })); expect(a.items[0]).toEqual(first.receipt); expect(a.hasMore).toBe(true);
    await f.ingest(input({ externalEventId: "capture-3", observedAt: 1100, provenance: { captureId: "third" } }));
    const b = await f.call<RuntimeExternalHistoryPage>(api.history, { sourceId: first.receipt.reference.sourceId, after: a.nextCursor }); expect(b.items.map(r => r.provenance.captureId)).toEqual(["second"]); expect(b.hasMore).toBe(false);
    await expect(f.call(api.history, { sourceId: first.receipt.reference.sourceId, after: "unknown" })).rejects.toMatchObject({ data: { code: "CURSOR_INVALID" } });
    const c = await f.call<RuntimeExternalHistoryPage>(api.history, { sourceId: first.receipt.reference.sourceId }); expect(c.items).toHaveLength(3);
  });
  test("explicit tombstone has its own immutable version, retains authorized originals and cannot be undone", async () => {
    const f = await fixture(), first = await f.ingest(), args = { sourceId: first.receipt.reference.sourceId, requestId: "delete-batch", externalEventId: "delete-event", externalRevision: 2, observedAt: 1001, provenance: { captureId: "deletion-evidence" }, reason: "Explicit source removal" };
    const tombstone = externalIngestResult(await f.call(api.tombstone, args)); expect(tombstone.receipt).toMatchObject({ outcome: "tombstoned", reference: { externalRevision: 2 } }); expect(tombstone.receipt.originalContentHash).toBeUndefined();
    expect(await f.call(api.tombstone, { ...args, requestId: "retry" })).toMatchObject({ receipt: tombstone.receipt });
    expect(externalSourceVersion(await f.get(args.sourceId))).toMatchObject({ kind: "tombstone", current: true, tombstoned: true, reason: args.reason });
    expect(await f.get(args.sourceId, first.receipt.reference.versionId)).toMatchObject({ kind: "content", originalText: input().originalText, current: false, tombstoned: true });
    expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal: "church", includeHistory: true })).items).toEqual([]);
    expect(await f.call(api.status, { receiptId: first.receipt.receiptId })).toMatchObject({ readiness: { vectors: "not_current" } });
    await expect(f.ingest(input({ externalRevision: 3, externalEventId: "resurrection" }))).rejects.toMatchObject({ data: { code: "SOURCE_TOMBSTONED" } });
    expect(f.db.table("runtimeExternalVersions")).toHaveLength(2); expect(f.db.table("runtimeIngestionEvents")[0].eligibility).toBe("tombstoned");
  });
  test("stale tombstone and unknown targets are explicit failures without removing current evidence", async () => {
    const f = await fixture(), first = await f.ingest(input({ externalRevision: 3 })), args = { sourceId: first.receipt.reference.sourceId, requestId: "delete", externalEventId: "stale-delete", externalRevision: 2, observedAt: 1001, provenance: {} };
    await expect(f.call(api.tombstone, args)).rejects.toMatchObject({ data: { code: "STALE_REVISION" } });
    await expect(f.call(api.tombstone, { ...args, sourceId: "unknown" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); expect((await f.get(args.sourceId)).kind).toBe("content");
  });
  test("current authorization fences source/history/search/status and cross-owner reads remain explicit", async () => {
    const f = await fixture(), first = await f.ingest(), sourceId = first.receipt.reference.sourceId;
    await expect(f.call(api.get, { tenantId: "other-tenant", sourceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const principal = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-b", metadataUserId: "user-b", actorKind: "user", version: 1 });
    const member = f.db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1 });
    const grant = f.db.seed("runtimeAuthGrants", { principalId: principal._id, membershipId: member._id, tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write"], resourceAccess: "own", version: 1 });
    f.identity({ issuer: "https://host.test", subject: "user-b" });
    for (const [method, args] of [[api.get, { sourceId }], [api.history, { sourceId }], [api.status, { receiptId: first.receipt.receiptId }]] as const) await expect(f.call(method, args)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal: "church" })).items).toEqual([]);
    f.db.table("runtimeAuthGrants").find(r => r._id === grant._id)!.resourceAccess = "space"; expect(await f.get(sourceId)).toMatchObject({ principalId: f.principal._id, originalText: input().originalText });
    f.db.table("runtimeAuthPrincipals").find(r => r._id === f.principal._id)!.deletedAt = Date.now();
    await expect(f.get(sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    delete f.db.table("runtimeAuthPrincipals").find(r => r._id === f.principal._id)!.deletedAt;
    f.db.table("runtimeAuthGrants").find(r => r._id === grant._id)!.revokedAt = 1; await expect(f.get(sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    f.identity({ issuer: "https://host.test", subject: "user-a" }); f.db.seed("runtimeExternalErasureFences", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id, sourceId, erasedAt: Date.now() });
    await expect(f.get(sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); await expect(f.ingest(input({ externalEventId: "after-erasure" }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect((await f.call<RuntimeExternalSearchPage>(api.search, { literal: "church" })).items).toEqual([]);
  });
  test("asset versions are authorized and retained by immutable source custody; revocation still denies delivery", async () => {
    const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "storage:read", "storage:write"];
    f.db.seed("runtimeAssets", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "map-tile", ownerPrincipalId: f.principal._id, latestVersion: 1, createdAt: Date.now() });
    f.db.seed("runtimeAssetVersions", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "map-tile", versionId: "map-tile:v1", assetVersion: 1, ownerPrincipalId: f.principal._id, storageId: "_storage:tile", contentHash: "a".repeat(64), sizeBytes: 1024, mimeType: "image/png", mediaKind: "image", lineage: { kind: "upload", requestId: "map-upload" }, state: "ready", cleanupAttempt: 0, createdAt: Date.now() });
    f.db.seed("runtimeAssetReferences", { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "map-tile:v1", kind: "upload", ownerId: "map-tile", ownerVersion: "1", ownerPrincipalId: f.principal._id, active: true, createdAt: Date.now() });
    const first = await f.ingest(input({ assetReferences: [{ assetId: "map-tile", version: 1 }] })); expect(f.db.table("runtimeAssetReferences").filter(r => r.kind === "source")).toHaveLength(1);
    await f.call(attachments.create, { assetId: "map-tile", version: 1, attachmentId: "independent-attachment" });
    await f.call(assetApi.remove, { assetId: "map-tile" }); expect(await f.get(first.receipt.reference.sourceId)).toMatchObject({ assetReferences: [{ assetId: "map-tile", version: 1 }] });
    await assets.reconcileAssetOwnerReferences(f.ctx, { tenantId: "tenant-a", memorySpaceId: "space-a" }, "source", first.receipt.reference.sourceId); expect(f.db.table("runtimeAssetReferences").find(r => r.kind === "source")!.active).toBe(true);
    f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "storage", resourceId: "map-tile", deletedAt: Date.now() });
    await expect(f.get(first.receipt.reference.sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(new ConvexMemoryRepository(f.ctx, f.reference, "read").getSource(first.receipt.reference.sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.ingest(input({ externalSourceId: "unknown-asset-message", externalEventId: "unknown-asset", assetReferences: [{ assetId: "missing", version: 1 }] }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("runtimeExternalSources")).toHaveLength(1);
  });
  test("source custody retains bytes after the original owner is removed but supplies no delivery authority", async () => {
    const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "storage:read", "storage:write"];
    f.db.seed("runtimeAssets", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "retained-only", ownerPrincipalId: f.principal._id, latestVersion: 1, createdAt: Date.now() });
    f.db.seed("runtimeAssetVersions", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "retained-only", versionId: "retained-only:v1", assetVersion: 1, ownerPrincipalId: f.principal._id, storageId: "_storage:retained", contentHash: "a".repeat(64), sizeBytes: 1024, mimeType: "image/png", mediaKind: "image", lineage: { kind: "upload", requestId: "retained-upload" }, state: "ready", cleanupAttempt: 0, createdAt: Date.now() });
    f.db.seed("runtimeAssetReferences", { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "retained-only:v1", kind: "upload", ownerId: "retained-only", ownerVersion: "1", ownerPrincipalId: f.principal._id, active: true, createdAt: Date.now() });
    const first = await f.ingest(input({ assetReferences: [{ assetId: "retained-only", version: 1 }] }));
    await f.call(assetApi.remove, { assetId: "retained-only" });
    await f.call(assetApi.cleanupVersion, { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "retained-only:v1" });
    expect(f.db.table("runtimeAssetVersions")[0].state).toBe("ready"); expect(f.db.table("runtimeAssetReferences").filter(r => r.active).map(r => r.kind)).toEqual(["source"]);
    await expect(f.get(first.receipt.reference.sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(assetApi.downloadAuthorization, { assetId: "retained-only", version: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
  test("an importer downgrade cannot launder another owner's upload through an owned source reference", async () => {
    const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "storage:read", "storage:write"]; f.grant.resourceAccess = "space";
    const owner = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "asset-owner", metadataUserId: "asset-owner", actorKind: "user", version: 1 });
    f.db.seed("runtimeAuthMemberships", { principalId: owner._id, tenantId: "tenant-a", version: 1 });
    f.db.seed("runtimeAssets", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "foreign-upload", ownerPrincipalId: owner._id, latestVersion: 1, createdAt: Date.now() });
    f.db.seed("runtimeAssetVersions", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "foreign-upload", versionId: "foreign-upload:v1", assetVersion: 1, ownerPrincipalId: owner._id, storageId: "_storage:foreign", contentHash: "b".repeat(64), sizeBytes: 1024, mimeType: "image/png", mediaKind: "image", lineage: { kind: "upload", requestId: "foreign-upload" }, state: "ready", cleanupAttempt: 0, createdAt: Date.now() });
    f.db.seed("runtimeAssetReferences", { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "foreign-upload:v1", kind: "upload", ownerId: "foreign-upload", ownerVersion: "1", ownerPrincipalId: owner._id, active: true, createdAt: Date.now() });
    const first = await f.ingest(input({ assetReferences: [{ assetId: "foreign-upload", version: 1 }] }));
    expect(await f.call(assetApi.downloadAuthorization, { assetId: "foreign-upload", version: 1 })).toMatchObject({ storageId: "_storage:foreign" });
    f.grant.resourceAccess = "own";
    await expect(f.get(first.receipt.reference.sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(assetApi.get, { assetId: "foreign-upload", version: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(assetApi.downloadAuthorization, { assetId: "foreign-upload", version: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(api.history, { sourceId: first.receipt.reference.sourceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(api.status, { receiptId: first.receipt.receiptId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(new ConvexMemoryRepository(f.ctx, f.reference, "read").getSource(first.receipt.reference.sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("runtimeAssetVersions")[0].state).toBe("ready"); expect(f.db.table("runtimeAssetReferences").find(r => r.kind === "source")!.active).toBe(true);
  });
  test.each(["share", "conversation", "expiry"])("source references cannot outlive the original private asset's revoked %s authorization", async mode => {
    const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "storage:read", "storage:write"]; f.grant.resourceAccess = "space";
    const owner = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "asset-owner", metadataUserId: "asset-owner", actorKind: "user", version: 1 });
    const member = f.db.seed("runtimeAuthMemberships", { principalId: owner._id, tenantId: "tenant-a", version: 1 });
    f.db.seed("runtimeAuthGrants", { principalId: owner._id, membershipId: member._id, tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write", "admin", "storage:read", "storage:write"], resourceAccess: "own", version: 1 });
    f.db.seed("runtimeAssets", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "private-upload", ownerPrincipalId: owner._id, latestVersion: 1, createdAt: Date.now() });
    f.db.seed("runtimeAssetVersions", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "private-upload", versionId: "private-upload:v1", assetVersion: 1, ownerPrincipalId: owner._id, storageId: "_storage:private", contentHash: "c".repeat(64), sizeBytes: 1024, mimeType: "image/png", mediaKind: "image", lineage: { kind: "upload", requestId: "private-upload" }, state: "ready", cleanupAttempt: 0, createdAt: Date.now() });
    f.db.seed("runtimeAssetReferences", { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "private-upload:v1", kind: "upload", ownerId: "private-upload", ownerVersion: "1", ownerPrincipalId: owner._id, active: true, createdAt: Date.now() });
    f.identity({ issuer: "https://host.test", subject: "asset-owner" });
    const conversation = await f.call<{ conversationId: string }>(transcripts.create, { clientRequestId: "private-origin", memorySpaceId: "space-a" });
    await f.call(attachments.create, { assetId: "private-upload", version: 1, attachmentId: "private-attachment", conversationId: conversation.conversationId });
    await f.call(assetApi.remove, { assetId: "private-upload" });
    const shared = await f.call<{ shareId: string }>(shares.create, { conversationId: conversation.conversationId, grantedBy: "asset-owner", grantType: "user", grantedTo: f.principal._id,
      permissions: { canView: true, canExport: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false }, ...(mode === "expiry" ? { expiresAt: Date.now() + 100 } : {}) });
    f.identity({ issuer: "https://host.test", subject: "user-a" });
    const first = await f.ingest(input({ assetReferences: [{ assetId: "private-upload", version: 1 }] }));
    expect(await f.call(assetApi.downloadAuthorization, { assetId: "private-upload", version: 1 })).toMatchObject({ storageId: "_storage:private" });
    f.identity({ issuer: "https://host.test", subject: "asset-owner" });
    if (mode === "share") await f.call(shares.revoke, { shareId: shared.shareId });
    else if (mode === "expiry") jest.spyOn(Date, "now").mockReturnValue(Date.now() + 101);
    else {
      const row = f.db.table("runtimeConversations").find(row => row.conversationId === conversation.conversationId)!;
      await f.call(transcripts.setPolicy, { conversationId: conversation.conversationId, expectedRevision: row.historyRevision, manualWriteLocked: false });
      await f.call(transcripts.remove, { conversationId: conversation.conversationId });
    }
    f.identity({ issuer: "https://host.test", subject: "user-a" });
    await expect(f.get(first.receipt.reference.sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(assetApi.downloadAuthorization, { assetId: "private-upload", version: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(api.history, { sourceId: first.receipt.reference.sourceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.call(api.status, { receiptId: first.receipt.receiptId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(new ConvexMemoryRepository(f.ctx, f.reference, "read").getSource(first.receipt.reference.sourceId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("runtimeAssetReferences").find(r => r.kind === "source")!.active).toBe(true); expect(f.db.table("runtimeAssetVersions")[0].state).toBe("ready");
  });
  test("current-source replacement fences old vectors and recall preserves external lineage without inventing chat authorship", async () => {
    const f = await fixture(), first = await f.ingest(), repo = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db, { now: () => Date.now() }, async () => DEFAULT_EMBEDDING_PROFILE);
    const source = (await repo.getSource(first.receipt.reference.sourceId))!, prepared = await prepareSourceContent(repo.scope, source.lineage, source.content, { now: () => source.createdAt });
    const identity = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: 1, stage: "vectors" as const, semanticPolicyVersion: DEFAULT_EMBEDDING_PROFILE.profileId }, receiptId = await processingIdentityKey(identity), chunk = prepared.chunks[0];
    const vector = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: 1, vectorId: "test-vector", chunkId: chunk.chunkId, tenantId: "tenant-a", memorySpaceId: "space-a", profile: DEFAULT_EMBEDDING_PROFILE, embedding: Array(1536).fill(0.1) as number[], processingReceiptId: receiptId };
    await f.transaction(() => repo.commitDerived({ source: source.lineage, identity, chunks: prepared.chunks, vectors: [vector] }));
    const stored = f.db.table("runtimeMemoryVectors")[0] as unknown as Doc<"runtimeMemoryVectors">, matches = await repo.hydrateVectors([{ id: stored._id, score: 0.9 }]); expect(matches).toHaveLength(1);
    const recalled = vectorRecallItems(matches); expect(recalled[0].memory).toMatchObject({ sourceLineage: { role: "external", trust: "unverified_external", sourceId: source.lineage.sourceId }, attribution: "unverified_external" });
    expect(recalled[0].memory?.messageRole).toBeUndefined(); expect(recalled[0].memory?.userId).toBeUndefined();
    const fact = { factId: "forged-fact", ownerPrincipalId: f.principal._id, tenantId: "tenant-a", memorySpaceId: "space-a", lineage: source.lineage, extractionPolicyVersion: "forged", confidence: 100, fact: "Authoritative user fact", version: 1 } as DerivedFact;
    await expect(f.transaction(() => repo.commitDerived({ source: source.lineage, identity: { ...identity, stage: "facts" }, facts: [fact] }))).rejects.toThrow("INVALID_INPUT"); expect(f.db.table("facts")).toHaveLength(0);
    await f.ingest(input({ externalRevision: 2, externalEventId: "edit", originalText: "Corrected evidence" })); expect(await repo.hydrateVectors([{ id: stored._id, score: 0.9 }])).toEqual([]);
    await expect(repo.commitDerived({ source: source.lineage, identity, chunks: prepared.chunks, vectors: [vector] })).rejects.toThrow("STALE_SOURCE");
  });
  test("injected capture storage failure rolls source, ingestion, counters and scheduler back together", async () => {
    const f = await fixture(), nativeInsert = f.db.insert.bind(f.db), insert = jest.spyOn(f.db, "insert");
    insert.mockImplementation(async (table, value) => { if (table === "runtimeExternalObservations") throw new Error("injected observation failure"); return nativeInsert(table, value); });
    await expect(f.ingest()).rejects.toThrow("injected observation failure");
    for (const table of ["runtimeExternalSources", "runtimeExternalVersions", "runtimeExternalObservations", "runtimeExternalCounters", "runtimeMemorySources", "runtimeIngestionEvents", "runtimeIngestionStages"]) expect(f.db.table(table)).toEqual([]);
    expect(f.scheduled.filter(s => s.name === "runtimeIngestion:processStage")).toEqual([]);
    insert.mockRestore(); expect((await f.ingest()).receipt.outcome).toBe("created");
  });
  test("literal scans return empty intermediate pages honestly and keep persisted cursor rows schema-valid", async () => {
    const f = await fixture();
    for (let n = 0; n < 102; n++) await f.ingest(input({ externalSourceId: `scan-${n}`, externalEventId: `scan-event-${n}`, originalText: n === 101 ? "needle" : " " }));
    const first = await f.call<RuntimeExternalSearchPage>(api.search, { literal: "needle" }); expect(first.items).toEqual([]); expect(first.hasMore).toBe(true); expect(first.completeThroughWatermark).toBe(false);
    const last = await f.call<RuntimeExternalSearchPage>(api.search, { literal: "needle", after: first.nextCursor, includeHistory: false }); expect(last.items.map(item => item.originalText)).toEqual(["needle"]); expect(last.completeThroughWatermark).toBe(true); expect(last.watermark).toBe(first.watermark);
    const tables = (await import("../../../convex-dev/runtimeExternalSourcesSchema")).runtimeExternalTables;
    for (const [name, table] of Object.entries(tables)) for (const row of f.db.table(name)) expect(Object.keys(row).filter(key => !key.startsWith("_") && !(key in table.validator.fields))).toEqual([]);
    f.db.table("runtimeExternalReadCursors")[0].invalidatedAt = Date.now();
    await expect(f.call(api.search, { literal: "needle", after: first.nextCursor })).rejects.toMatchObject({ data: { code: "CURSOR_EXPIRED" } });
  });
  test("maximum custody text remains exactly retrievable independently of indexing readiness", async () => {
    const f = await fixture(), originalText = "é".repeat(32000), first = await f.ingest(input({ originalText }));
    expect(first.readiness.vectors).toBe("pending"); expect(first.receipt.originalContentHash).toBe(await semanticHash(originalText));
    expect(await f.get(first.receipt.reference.sourceId)).toMatchObject({ originalText, originalContentHash: await semanticHash(originalText) });
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  test("malformed public input never writes custody", async () => {
    const f = await fixture(); for (const patch of [{ externalRevision: 0 }, { attribution: "user_assertion" }, { extraction: "facts" }, { originalText: "x".repeat(64001) }, { observedAt: -1 }]) await expect(f.call(api.ingest, { requestId: "batch", input: { ...input(), ...patch } })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(f.db.table("runtimeExternalSources")).toEqual([]); expect(f.db.table("runtimeIngestionEvents")).toEqual([]);
  });
});
