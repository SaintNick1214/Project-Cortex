/** Real registrations and worker bodies on the transactional in-memory port. No live Convex/OCC/provider claim. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { MemoryModel, SourceContent } from "../../../src/domain/contracts";
import type { ModelCallRequest, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import type { RuntimeExternalSourceInput, RuntimeExternalIngestResult, RuntimeChangesPage } from "../../../src/client-runtime/external";
import { changesPage, externalCapabilities } from "../../../src/client-runtime/external";
import { ingestionFixture, installIngestionMockRoot, ingestion, invoke } from "../runtimeIngestion/fixture";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
const sources = await import("../../../convex-dev/runtimeExternalSources");
const changes = await import("../../../convex-dev/runtimeChanges");
const erasure = await import("../../../convex-dev/runtimeExternalErasure");
const auth = await import("../../../convex-dev/runtimeAuth");
const ledger = await import("../../../convex-dev/runtimeModelPolicy");
const attachments = await import("../../../convex-dev/attachments");
const assetApi = await import("../../../convex-dev/runtimeAssets");
const transcripts = await import("../../../convex-dev/runtimeTranscript");
const shares = await import("../../../convex-dev/conversationShares");
type Fixture = Awaited<ReturnType<typeof fixture>>;
function input(patch: Partial<RuntimeExternalSourceInput> = {}): RuntimeExternalSourceInput { return { provider: "archive", externalSourceId: "message-1", externalEventId: "capture-1", externalRevision: 1,
  originalText: "ERASE-ME-CHURCH: an unverified church—time suggestion.", author: { id: "external-author" }, authoredAt: 1, observedAt: 2,
  provenance: { captureId: "capture-1", metadata: { rawPath: "archive-custody-original" } }, attribution: "unverified_external", extraction: "none", ...patch }; }
async function fixture() {
  const f = await ingestionFixture(), base = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name: string; try { name = getFunctionName(ref); } catch { return base(ref, args); }
    const registrations = { "runtimeExternalErasure:eraseSource": erasure.eraseSource,
      "runtimeExternalErasure:retireAuthority": erasure.retireAuthority, "runtimeExternalErasure:continueSource": erasure.continueSource, "runtimeExternalErasure:continueAuthority": erasure.continueAuthority };
    if (name in registrations) return f.transaction(() => invoke(registrations[name as keyof typeof registrations], f.ctx, args));
    return base(ref, args);
  }) as MutationCtx["runMutation"];
  const ingest = (value = input()) => f.call<RuntimeExternalIngestResult>(sources.ingest, { requestId: "batch", input: value });
  const list = (args: Parameters<typeof changes.listChangesHandler>[1] = {}) => f.call<RuntimeChangesPage>(changes.list, args);
  return { ...f, get grant() { return f.grant; }, ingest, list };
}
function secondOwner(f: Fixture, subject = "user-b") {
  const principal = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject, metadataUserId: subject, actorKind: "user", version: 1 });
  const membership = f.db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1 });
  const grant = f.db.seed("runtimeAuthGrants", { principalId: principal._id, membershipId: membership._id, tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write"], resourceAccess: "own", version: 1 });
  return { principal, membership, grant, select: () => f.identity({ issuer: "https://host.test", subject }) };
}
const selectA = (f: Fixture) => f.identity({ issuer: "https://host.test", subject: "user-a" });
function model() {
  return { extract: jest.fn<MemoryModel["extract"]>(async () => { throw Error("External extraction must never run"); }),
    resolve: jest.fn<MemoryModel["resolve"]>(async () => { throw Error("External belief reasoning must never run"); }),
    embed: jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile, vectors: request.texts.map(() => Array<number>(request.profile.dimensions).fill(0.25)) })) };
}
async function work(f: Fixture, eventId: string, owned = model()) {
  await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage: "vectors" }, () => owned); return owned;
}
async function purge(f: Fixture, sourceId: string) {
  let complete = false;
  for (let attempt = 0; attempt < 128 && !complete; attempt++) complete = (await f.call<{ complete: boolean }>(erasure.continueSource, { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId })).complete;
  expect(complete).toBe(true);
}
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
describe("transactional external-source feed and policy erasure", () => {
  test("same-time source events retain historical evidence and suppress repeated and unchanged captures", async () => {
    const f = await fixture(), first = await f.ingest(input({ externalRevision: 3 }));
    await f.ingest(input({ externalRevision: 3 }));
    await f.ingest(input({ externalRevision: 4, externalEventId: "unchanged-4" }));
    const old = input({ externalRevision: 1, externalEventId: "old-1", originalText: "Original old evidence" }); await f.ingest(old);
    await f.ingest({ ...old, externalEventId: "old-1-new-observation", observedAt: 3 });
    await f.ingest(input({ externalRevision: 5, externalEventId: "edit-5", originalText: "Delayed retraction" }));
    await f.call(sources.tombstone, { sourceId: first.receipt.reference.sourceId, requestId: "delete", externalEventId: "delete-6", externalRevision: 6, observedAt: 4, provenance: {} });
    const page = changesPage(await f.list());
    expect(page.events.map(event => [event.type, event.source.externalRevision, event.current])).toEqual([["source.created", 3, true], ["source.revised", 1, false], ["source.revised", 5, true], ["source.tombstoned", 6, true]]);
    expect(new Set(page.events.map(event => event.eventId)).size).toBe(4); expect(new Set(page.events.map(event => event.occurredAt)).size).toBe(1);
    expect(JSON.stringify(page)).not.toMatch(/ERASE-ME|external-author|captureId|rawPath|externalSourceId|ownerSequence|"sequence"/);
    expect(page.completeThroughWatermark).toBe(true);
  });
  test("persistent checkpoints replay fixed catch-up windows and continue after restart without timestamp gaps", async () => {
    const f = await fixture();
    for (let n = 1; n <= 3; n++) await f.ingest(input({ externalSourceId: `source-${n}`, externalEventId: `capture-${n}` }));
    const first = await f.list({ limit: 1 }); expect(first.events).toHaveLength(1); expect(first.hasMore).toBe(true);
    const saved = JSON.parse(JSON.stringify(first.nextCursor)) as string;
    await f.ingest(input({ externalSourceId: "source-4", externalEventId: "capture-4" }));
    const second = await f.list({ after: saved, limit: 1 }), replay = await f.list({ after: saved, limit: 1 });
    expect(replay).toEqual(second); expect(second.watermark).toBe(first.watermark);
    const third = await f.list({ after: second.nextCursor, limit: 10 }); expect(third.events).toHaveLength(1); expect(third.completeThroughWatermark).toBe(true); expect(third.watermark).toBe(first.watermark);
    const caught = await f.list({ after: third.nextCursor }); expect(caught.events.map(event => event.source.externalRevision)).toEqual([1]); expect(caught.events[0].eventId).not.toBe(first.events[0].eventId); expect(caught.watermark).not.toBe(first.watermark);
    const ids = [...first.events, ...second.events, ...third.events, ...caught.events].map(event => event.eventId); expect(new Set(ids).size).toBe(4);
    const rows = f.db.table("runtimeChangeCursors").length, empty = await f.list({ after: caught.nextCursor });
    expect(empty.events).toEqual([]); expect(empty.nextCursor).toBe(caught.nextCursor); expect(f.db.table("runtimeChangeCursors")).toHaveLength(rows);
  });
  test("filters bind cursors and invalid, expired, changed-principal and unauthorized scope replay fail explicitly", async () => {
    const f = await fixture(), first = await f.ingest(); await f.ingest(input({ externalRevision: 2, externalEventId: "edit-2", originalText: "edited" }));
    const filtered = await f.list({ types: ["source.revised"] }); expect(filtered.events.map(event => event.type)).toEqual(["source.revised"]);
    await expect(f.list({ after: filtered.nextCursor, types: ["source.created"] })).rejects.toMatchObject({ data: { code: "CURSOR_SCOPE_CHANGED" } });
    await expect(f.list({ after: "unknown-handle" })).rejects.toMatchObject({ data: { code: "CURSOR_INVALID" } });
    await expect(f.list({ tenantId: "foreign-tenant", after: filtered.nextCursor, types: ["source.revised"] })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const b = secondOwner(f); b.select(); await expect(f.list({ after: filtered.nextCursor, types: ["source.revised"] })).rejects.toMatchObject({ data: { code: "CURSOR_SCOPE_CHANGED" } });
    selectA(f); f.db.table("runtimeChangeCursors").find(row => row.token === filtered.nextCursor)!.invalidatedAt = Date.now();
    await expect(f.list({ after: filtered.nextCursor, types: ["source.revised"] })).rejects.toMatchObject({ data: { code: "CURSOR_EXPIRED" } });
    f.grant.revokedAt = Date.now(); await expect(f.list()).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); expect(first.receipt.outcome).toBe("created");
  });
  test("own-grant cursors, watermarks and hasMore cannot reveal another owner's creation or erasure", async () => {
    const f = await fixture(), empty = await f.list(), b = secondOwner(f); b.select(); const other = await f.ingest(input()); selectA(f);
    const afterOther = await f.list({ after: empty.nextCursor }); expect(afterOther).toEqual(empty);
    await f.call(erasure.eraseSource, { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId: other.receipt.reference.sourceId });
    expect(await f.list({ after: empty.nextCursor })).toEqual(empty);
    await f.ingest(input()); const own = await f.list({ after: empty.nextCursor }); expect(own.events).toHaveLength(1); expect(own.events[0].principalId).toBe(f.principal._id);
    f.grant.resourceAccess = "space"; await expect(f.list({ after: own.nextCursor })).rejects.toMatchObject({ data: { code: "CURSOR_SCOPE_CHANGED" } });
    const shared = await f.list(); expect(shared.events).toHaveLength(1); expect(shared.principalId).toBe(f.principal._id);
  });
  test("private stream randomness prevents foreign checkpoint existence probes from public sequence guesses", async () => {
    const f = await fixture(), a = await f.list(), b = secondOwner(f); b.select(); await f.ingest(); const live = await f.list(); selectA(f);
    expect(JSON.stringify(live)).not.toMatch(/nonce|erasureEpoch|"through"|"position"/);
    for (let through = 0; through <= 3; through++) {
      const visibility = `own:${b.principal._id}`, filterCanonical = "[]", erasureEpoch = 0;
      const guessedWatermark = `change-watermark:${await semanticHash(canonicalModelJson(["tenant-a", "space-a", b.principal._id, visibility, filterCanonical, through, erasureEpoch]))}`;
      expect(live.watermark).not.toBe(guessedWatermark);
      for (let position = 0; position <= through; position++) {
        const guessedCursor = `change-cursor:${await semanticHash(canonicalModelJson({ tenantId: "tenant-a", memorySpaceId: "space-a", principalId: b.principal._id, visibility, filterCanonical,
          position, through, watermark: guessedWatermark, erasureEpoch, complete: position === through }))}`;
        expect(live.nextCursor).not.toBe(guessedCursor);
        await expect(f.list({ after: guessedCursor })).rejects.toMatchObject({ data: { code: "CURSOR_INVALID" } });
      }
    }
    expect(await f.list({ after: a.nextCursor })).toEqual(a);
    const heads = f.db.table("runtimeChangeHeads"), ownerA = heads.find(row => row.streamOwner === f.principal._id)!, nonce = ownerA.nonce;
    await f.ingest(); expect(f.db.table("runtimeChangeHeads").find(row => row.streamOwner === f.principal._id)!.nonce).toBe(nonce);
    expect(f.db.table("runtimeChangeCursors").every(row => !("nonce" in row))).toBe(true);
  });
  test("source publication failure rolls custody, pipeline, counters and events back together", async () => {
    const f = await fixture(), original = f.db.insert.bind(f.db), spy = jest.spyOn(f.db, "insert");
    spy.mockImplementation(async (table, value) => { if (table === "runtimeChangeEvents") throw Error("injected atomic event failure"); return original(table, value); });
    await expect(f.ingest()).rejects.toThrow("injected atomic event failure");
    for (const table of ["runtimeExternalSources", "runtimeExternalVersions", "runtimeExternalObservations", "runtimeExternalCounters", "runtimeMemorySources", "runtimeIngestionEvents", "runtimeIngestionStages", "runtimeChangeHeads", "runtimeChangeEvents"]) expect(f.db.table(table)).toEqual([]);
    expect(f.scheduled).toEqual([]); spy.mockRestore(); expect((await f.ingest()).receipt.outcome).toBe("created");
  });
  test("actual vector worker publishes failed-attempt and recovery-ready events once, with no extraction or facts", async () => {
    const f = await fixture(), first = await f.ingest(), eventId = first.readiness.ingestionEventId!, owned = await f.claim(eventId, "vectors");
    const fail = { reference: f.reference, eventId, stage: "vectors", attempt: owned.attempt, leaseVersion: owned.leaseVersion, uncertain: false, failureCode: "private raw failure\nERASE-ME" };
    await f.call(ingestion.failStage, fail); await f.call(ingestion.failStage, fail);
    expect((await f.list()).events.map(event => [event.type, event.attempt, event.failureCode])).toEqual([["source.created", undefined, undefined], ["source.index.failed", 1, "INDEXING_FAILED"]]);
    expect(await f.call(sources.status, { receiptId: first.receipt.receiptId })).toMatchObject({ receipt: first.receipt, readiness: { vectors: "failed", failureCode: "INDEXING_FAILED" } });
    await f.call(ingestion.retry, { eventId, stage: "vectors" }); const controlled = await work(f, eventId); await work(f, eventId, controlled);
    const page = await f.list(); expect(page.events.map(event => [event.type, event.attempt])).toEqual([["source.created", undefined], ["source.index.failed", 1], ["source.index.ready", 2]]);
    expect(page.events[2].receiptId).toBe(f.db.table("runtimeMemoryReceipts")[0].receiptId); expect(controlled.embed).toHaveBeenCalledTimes(1); expect(controlled.extract).not.toHaveBeenCalled(); expect(controlled.resolve).not.toHaveBeenCalled();
    expect(f.db.table("facts")).toEqual([]); expect(f.db.table("runtimeMemoryVectors").length).toBeGreaterThan(0);
  });
  test("actual failed stage publication is atomic and a lost/expired lease has a distinct replayable failure", async () => {
    const f = await fixture(), first = await f.ingest(), eventId = first.readiness.ingestionEventId!, owned = await f.claim(eventId, "vectors");
    const original = f.db.insert.bind(f.db), spy = jest.spyOn(f.db, "insert"); spy.mockImplementation(async (table, value) => { if (table === "runtimeChangeEvents") throw Error("stage-event failure"); return original(table, value); });
    await expect(f.call(ingestion.failStage, { reference: f.reference, eventId, stage: "vectors", attempt: owned.attempt, leaseVersion: owned.leaseVersion, uncertain: false, failureCode: "SAFE_FAILURE" })).rejects.toThrow("stage-event failure");
    expect(f.db.table("runtimeIngestionStages").find(row => row.stage === "vectors")!.state).toBe("running"); expect(f.db.table("runtimeIngestionEvents")[0].vectorsState).toBe("pending"); expect(f.db.table("runtimeChangeEvents")).toHaveLength(1); spy.mockRestore();
    const row = f.db.table("runtimeIngestionStages").find(row => row.stage === "vectors")!; row.leaseExpiresAt = Date.now() - 1;
    await f.call(ingestion.expireStage, { reference: f.reference, eventId, stage: "vectors", attempt: owned.attempt, leaseVersion: owned.leaseVersion });
    const page = await f.list(); expect(page.events[1]).toMatchObject({ type: "source.index.failed", indexState: "unknown", attempt: 1, failureCode: "INTERRUPTED_REQUIRES_RECONCILIATION" });
    await expect(f.call(ingestion.retry, { eventId, stage: "vectors" })).rejects.toMatchObject({ data: { code: "RETRY_NOT_SAFE" } });
  });
  test("exact-version asset rights are rechecked on replay; retention edges do not authorize evidence", async () => {
    const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "storage:read", "storage:write"];
    const head = f.db.seed("runtimeAssets", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "private-map", ownerPrincipalId: f.principal._id, latestVersion: 1, createdAt: Date.now() });
    f.db.seed("runtimeAssetVersions", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "private-map", versionId: "private-map:v1", assetVersion: 1, ownerPrincipalId: f.principal._id, storageId: "_storage:private-map", contentHash: "a".repeat(64), sizeBytes: 1024, mimeType: "image/png", mediaKind: "image", lineage: { kind: "upload", requestId: "upload" }, state: "ready", cleanupAttempt: 0, createdAt: Date.now() });
    f.db.seed("runtimeAssetReferences", { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "private-map:v1", kind: "upload", ownerId: "private-map", ownerVersion: "1", ownerPrincipalId: f.principal._id, active: true, createdAt: Date.now() });
    await f.ingest(input({ assetReferences: [{ assetId: "private-map", version: 1 }] })); expect((await f.list()).events).toHaveLength(1);
    f.db.table("runtimeAssets").find(row => row._id === head._id)!.deletedAt = Date.now();
    expect((await f.list()).events).toEqual([]); expect(f.db.table("runtimeAssetReferences").filter(row => row.kind === "source" && row.active)).toHaveLength(1);
    delete f.db.table("runtimeAssets").find(row => row._id === head._id)!.deletedAt; expect((await f.list()).events).toHaveLength(1);
  });
  test("replay honors revoked private-conversation asset sharing, and erasure releases only source retention", async () => {
    const f = await fixture(), owner = secondOwner(f, "asset-owner");
    f.grant.resourceAccess = "space"; f.grant.capabilities = [...f.grant.capabilities as string[], "storage:read", "storage:write"];
    const empty = await f.list();
    owner.grant.capabilities = ["read", "write", "admin", "storage:read", "storage:write"]; owner.select();
    f.db.seed("runtimeAssets", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "shared-private", ownerPrincipalId: owner.principal._id, latestVersion: 1, createdAt: Date.now() });
    f.db.seed("runtimeAssetVersions", { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: "shared-private", versionId: "shared-private:v1", assetVersion: 1, ownerPrincipalId: owner.principal._id, storageId: "_storage:private-shared", contentHash: "c".repeat(64), sizeBytes: 1024, mimeType: "image/png", mediaKind: "image", lineage: { kind: "upload", requestId: "private-upload" }, state: "ready", cleanupAttempt: 0, createdAt: Date.now() });
    f.db.seed("runtimeAssetReferences", { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "shared-private:v1", kind: "upload", ownerId: "shared-private", ownerVersion: "1", ownerPrincipalId: owner.principal._id, active: true, createdAt: Date.now() });
    const conversation = await f.call<{ conversationId: string }>(transcripts.create, { clientRequestId: "private-origin", memorySpaceId: "space-a" });
    await f.call(attachments.create, { assetId: "shared-private", version: 1, attachmentId: "private-attachment", conversationId: conversation.conversationId });
    await f.call(assetApi.remove, { assetId: "shared-private" });
    const shared = await f.call<{ shareId: string }>(shares.create, { conversationId: conversation.conversationId, grantedBy: "asset-owner", grantType: "user", grantedTo: f.principal._id,
      permissions: { canView: true, canExport: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false } });
    selectA(f); const source = await f.ingest(input({ assetReferences: [{ assetId: "shared-private", version: 1 }] }));
    for (let revision = 2; revision <= 20; revision++) await f.ingest(input({ externalRevision: revision, externalEventId: `asset-observation-${revision}`, assetReferences: [{ assetId: "shared-private", version: 1 }] }));
    const before = await f.list(); expect(before.events).toHaveLength(1);
    owner.select(); await f.call(shares.revoke, { shareId: shared.shareId }); selectA(f);
    expect((await f.list()).events).toEqual([]); expect((await f.list({ after: empty.nextCursor })).events).toEqual([]);
    const scope = { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId: source.receipt.reference.sourceId };
    await f.call(erasure.eraseSource, scope);
    expect(f.db.table("runtimeAssetReferences").filter(row => row.kind === "source")).toHaveLength(20);
    expect(await f.call(erasure.continueSource, scope)).toMatchObject({ complete: false });
    expect(f.db.table("runtimeAssetReferences").filter(row => row.kind === "source")).toHaveLength(12);
    await purge(f, source.receipt.reference.sourceId);
    expect(f.db.table("runtimeAssetReferences").filter(row => row.kind === "source")).toEqual([]);
    expect(f.db.table("runtimeAssetReferences").find(row => row.kind === "attachment")!.active).toBe(true); expect(f.db.table("runtimeAssetVersions")[0].state).toBe("ready");
  });
  test("filtered catch-up advances over bounded empty pages and every persisted private row fits its additive schema", async () => {
    const f = await fixture();
    for (let n = 0; n < 102; n++) await f.ingest(input({ externalSourceId: `source-${n}`, externalEventId: `capture-${n}`, originalText: "" }));
    const first = await f.list({ types: ["source.revised"] }); expect(first.events).toEqual([]); expect(first.hasMore).toBe(true); expect(first.completeThroughWatermark).toBe(false);
    const last = await f.list({ after: first.nextCursor, types: ["source.revised"] }); expect(last.events).toEqual([]); expect(last.hasMore).toBe(false); expect(last.completeThroughWatermark).toBe(true); expect(last.watermark).toBe(first.watermark);
    const schema = (await import("../../../convex-dev/runtimeChangesSchema")).runtimeChangesTables;
    for (const [name, table] of Object.entries(schema)) for (const row of f.db.table(name)) expect(Object.keys(row).filter(key => !key.startsWith("_") && !(key in table.validator.fields))).toEqual([]);
    await expect(f.list({ limit: 0 })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });
  test("bounded policy erasure purges originals, observations and derived payloads, expires cursors and prevents resurrection", async () => {
    const f = await fixture(), first = await f.ingest(); await work(f, first.readiness.ingestionEventId!);
    for (let n = 2; n <= 20; n++) await f.ingest(input({ externalRevision: n, externalEventId: `capture-${n}`, originalText: `ERASE-ME-CHURCH revision ${n}` }));
    const unrelated = await f.ingest(input({ externalSourceId: "unrelated", externalEventId: "unrelated", originalText: "preserved" }));
    const scope = { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId: first.receipt.reference.sourceId }, cursor = await f.list({ limit: 1 });
    const operation = f.db.seed("runtimeModelOperations", { tenantId: "tenant-a", memorySpaceId: "space-a", source: { sourceId: scope.sourceId }, settledUnits: 7, cancelled: false });
    f.db.seed("runtimeModelAttempts", { operationDocumentId: operation._id, canonical: "ERASE-ME-CHURCH raw input", inputProofCanonical: "ERASE-ME-CHURCH proof", privateResultCanonical: "ERASE-ME-CHURCH result", settledCostUnits: 7 });
    expect(await f.call(erasure.eraseSource, scope)).toEqual({ found: true, complete: false });
    await expect(f.call(sources.get, { sourceId: scope.sourceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.list({ after: cursor.nextCursor })).rejects.toMatchObject({ data: { code: "CURSOR_EXPIRED" } });
    await expect(f.ingest(input({ externalRevision: 99, externalEventId: "new-event-after-fence" }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await f.call(erasure.continueSource, scope); expect(f.db.table("runtimeExternalObservations").filter(row => row.sourceId === scope.sourceId)).toHaveLength(12);
    await purge(f, scope.sourceId);
    for (const table of ["runtimeExternalSources", "runtimeExternalVersions", "runtimeExternalObservations", "runtimeMemoryChunks", "runtimeMemoryVectors", "runtimeMemoryVectorGenerations", "runtimeMemoryReceipts", "runtimeIngestionStages", "runtimeChangeEvents"]) expect(JSON.stringify(f.db.table(table))).not.toContain("ERASE-ME-CHURCH");
    expect(f.db.table("runtimeExternalSources").map(row => row.sourceId)).toEqual([unrelated.receipt.reference.sourceId]);
    expect(f.db.table("runtimeExternalErasureFences")).toEqual([expect.objectContaining({ sourceId: scope.sourceId })]);
    expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ canonical: '{"erased":true,"version":1}', inputProofCanonical: '{"erased":true,"version":1}', privateResultCanonical: undefined, resultWithheld: true, sourceErasedAt: Date.now(), settledCostUnits: 7 });
    expect((await f.list()).events.map(event => event.source.sourceId)).toEqual([unrelated.receipt.reference.sourceId]);
    await expect(f.call(sources.history, { sourceId: scope.sourceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); await expect(f.call(sources.status, { receiptId: first.receipt.receiptId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.ingest(input({ externalEventId: "after-physical-purge" }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(await f.call(erasure.eraseSource, scope)).toEqual({ found: true, complete: true }); expect(await f.call(erasure.continueSource, scope)).toEqual({ found: true, complete: true });
  });
  test("late native model liability is accounted after erasure without restoring input, private result, stage payload or events", async () => {
    const f = await fixture(), first = await f.ingest(), eventId = first.readiness.ingestionEventId!, claimed = await f.claim(eventId, "vectors");
    const stage = f.db.table("runtimeIngestionStages").find(row => row.stage === "vectors")!, snapshot = JSON.parse(stage.policyCanonical as string) as ModelPolicySnapshotV1;
    const source = f.db.table("runtimeMemorySources")[0] as unknown as SourceContent;
    const sourcePin = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash };
    const request: ModelCallRequest = { semanticId: "erasure-native-call", childCallId: "server-replaces-this", texts: [source.content], inputTokens: 1, outputTokens: 0,
      toolSteps: 0, timeoutMs: snapshot.limits.timeoutMs, reservationUnits: 1, promptVersion: snapshot.pins.promptVersion, schemaVersion: snapshot.pins.schemaVersion,
      extractionVersion: snapshot.pins.extractionVersion, toolRegistryVersion: snapshot.pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 }, profile: snapshot.semanticProfile!, batch: { ordinal: 0, start: 0, end: 1 } };
    const args = { reference: f.reference, operationKey: "embedding.memory", runBudgetId: claimed.runBudgetId, semanticId: request.semanticId, ordinal: 0, source: sourcePin, requestCanonical: canonicalModelJson(request) };
    const admitted = await f.call<{ status: string; operationId: Id<"runtimeModelOperations">; attemptId: Id<"runtimeModelAttempts">; requestCanonical: string }>(ledger.admit, args);
    expect(admitted.status).toBe("reserved");
    await f.call(ledger.checkpoint, { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical });
    const attempt = f.db.table("runtimeModelAttempts").find(row => row._id === admitted.attemptId)!;
    expect(attempt.canonical).toContain("ERASE-ME-CHURCH"); const dispatchIdentity = attempt.dispatchIdentity;
    await f.call(erasure.eraseSource, { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId: sourcePin.sourceId }); await purge(f, sourcePin.sourceId);
    const captured = await f.call<{ evidenceId: string; state: string; settledCostUnits: number }>(ledger.captureTerminalEvidence, { attemptId: admitted.attemptId, dispatchIdentity,
      receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity, receiptId: "late-native-liability", modelId: snapshot.modelId, nativeInterface: "embedding", outcome: "confirmed", proof: "provider-terminal-v1", costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000001" }) });
    // The installed embedding proof deliberately has unavailable terminal cost. Do not invent a settled price from provider text.
    expect(captured).toMatchObject({ state: "uncertain" }); expect(captured.settledCostUnits).toBeUndefined();
    expect(await f.call(ledger.attachTerminalResult, { reference: f.reference, attemptId: admitted.attemptId, evidenceId: captured.evidenceId, privateResultCanonical: "ERASE-ME-CHURCH late body" })).toEqual({ attached: false, resultWithheld: true });
    await expect(f.call(ledger.checkpoint, { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical })).rejects.toBeDefined();
    await expect(f.call(ledger.admit, { ...args, semanticId: "late-new-model-op" })).rejects.toBeDefined();
    await expect(f.call(ingestion.persistDraft, { reference: f.reference, eventId, stage: "vectors", attempt: claimed.attempt, leaseVersion: claimed.leaseVersion, payloadCanonical: "ERASE-ME-CHURCH stage body" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    expect(f.db.table("runtimeModelOperations")).toHaveLength(1); expect(f.db.table("runtimeModelOperations")[0]).toMatchObject({ settledUnits: 0, reservedUnits: 0, uncertainUnits: attempt.reservationUnits });
    expect(f.db.table("runtimeModelAttempts").find(row => row._id === admitted.attemptId)).toMatchObject({ slotReleased: true, resultAttachmentState: "closed", resultWithheld: true });
    for (const table of ["runtimeModelAttempts", "runtimeMemoryReceipts", "runtimeIngestionStages", "runtimeChangeEvents"]) expect(JSON.stringify(f.db.table(table))).not.toContain("ERASE-ME-CHURCH");
    expect(f.db.table("runtimeIngestionStages")).toEqual([]); expect(f.db.table("runtimeChangeEvents")).toEqual([]);
  });
  test.each(["source", "principal", "space", "tenant"])("trusted %s lifecycle retirement starts fenced cleanup; active authority cannot request blanket retirement", async kind => {
    const f = await fixture(), first = await f.ingest(), sourceId = first.receipt.reference.sourceId;
    await expect(f.call(erasure.retireAuthority, { principalId: f.principal._id })).rejects.toMatchObject({ data: { code: "ERASURE_SCOPE_NOT_RETIRED" } });
    if (kind === "source") await f.call(auth.tombstoneResource, { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: sourceId });
    else if (kind === "principal") await f.call(auth.deletePrincipal, { principalId: f.principal._id });
    else await f.call(auth.deleteScope, { tenantId: "tenant-a", ...(kind === "space" ? { memorySpaceId: "space-a" } : {}) });
    if (kind !== "source") {
      const job = f.db.table("runtimeExternalAuthorityErasureJobs")[0]; expect(job).toBeDefined(); await f.call(erasure.continueAuthority, { jobId: job.jobId });
    }
    expect(f.db.table("runtimeExternalErasureFences").map(row => row.sourceId)).toEqual([sourceId]);
    if (kind === "source") { expect((await f.list()).events).toEqual([]); await expect(f.call(sources.get, { sourceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); }
    else await expect(f.list()).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await purge(f, sourceId); expect(f.db.table("runtimeExternalSources")).toEqual([]);
  });
  test("retired-owner enumeration is bounded, resumable and never erases another owner", async () => {
    const f = await fixture(), own: string[] = [];
    for (let n = 0; n < 12; n++) own.push((await f.ingest(input({ externalSourceId: `owned-${n}`, externalEventId: `owned-${n}`, originalText: "" }))).receipt.reference.sourceId);
    const other = secondOwner(f); other.select(); const kept = await f.ingest(input({ originalText: "another owner's preserved evidence" })); selectA(f);
    await f.call(auth.deletePrincipal, { principalId: f.principal._id }); const job = f.db.table("runtimeExternalAuthorityErasureJobs")[0];
    expect(await f.call(erasure.continueAuthority, { jobId: job.jobId })).toEqual({ fencedComplete: false }); expect(f.db.table("runtimeExternalErasureFences")).toHaveLength(8);
    expect(await f.call(erasure.continueAuthority, { jobId: job.jobId })).toEqual({ fencedComplete: true }); expect(f.db.table("runtimeExternalErasureFences")).toHaveLength(12);
    for (const id of own) await purge(f, id);
    other.select(); expect((await f.list()).events.map(event => event.source.sourceId)).toEqual([kept.receipt.reference.sourceId]); expect(await f.call(sources.get, { sourceId: kept.receipt.reference.sourceId })).toMatchObject({ originalText: "another owner's preserved evidence" });
    expect(await f.call(erasure.continueAuthority, { jobId: job.jobId })).toEqual({ fencedComplete: true });
    await expect(f.call(erasure.continueAuthority, { jobId: "unknown" })).rejects.toMatchObject({ data: { code: "ERASURE_JOB_NOT_FOUND" } });
    await expect(f.call(erasure.continueSource, { tenantId: "tenant-a", memorySpaceId: "space-a", sourceId: "unknown" })).rejects.toMatchObject({ data: { code: "ERASURE_JOB_NOT_FOUND" } });
    await expect(f.call(erasure.retireAuthority, { principalId: other.principal._id, tenantId: "tenant-a" })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });
  test("capabilities are authenticated, versioned, nonbillable and limited to the external lifecycle", async () => {
    const f = await fixture(), result = externalCapabilities(await f.call(sources.capabilities, {}));
    expect(result.changes).toMatchObject({ version: 1, durable: true, atomicPublication: true, retention: "until_policy_erasure", cursorExpiry: "explicit_invalidation_only" });
    expect(result.largeAssets).toEqual({ resumableUpload: false, rangeRetrieval: false, maxManagedBytes: 20_000_000, modelInputLimitsSeparate: true }); expect(f.db.table("runtimeModelOperations")).toEqual([]);
    f.identity(null); await expect(f.call(sources.capabilities, {})).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});
