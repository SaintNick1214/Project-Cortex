/** Actual asset/erasure handlers; storage and source/model rows are controlled ports. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import type { RuntimeAssetVersion } from "../../../src/domain/assets";
import { assetContentHash } from "../../../src/domain/assets";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
import { assetFixture, assets, installMockRoot } from "../runtimeAssets/fixture";
import { clock } from "../runtimeTranscript/fixture";
const erasure = await import("../../../convex-dev/runtimeExternalErasure");
const { registerSourceDependencies } = await import("../../../convex-dev/runtimeSourceDependencies");
beforeEach(() => { installMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });

async function fixture() {
  const f = await assetFixture(), sourceId = "external-transfer-root", text = "PRIVATE-EXTERNAL-GENERATED-BYTES", contentHash = await semanticHash(text);
  const scope = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId };
  const witness = { sourceId, sourceEventId: "external-transfer-capture", sourceRevision: 1, contentHash }, owned = { ...scope, ownerPrincipalId: f.reference.principalId };
  f.db.seed("runtimeMemorySources", { ...owned, lineage: { ...witness, role: "external", trust: "unverified_external" }, content: text, contentHash, createdAt: clock });
  f.db.seed("runtimeExternalSources", { ...owned, sourceId, identityCanonical: "[]", provider: "fixture", externalSourceId: "transfer-root", maxExternalRevision: 1,
    currentVersionId: "external-transfer-version", currentSourceRevision: 1, createdAt: clock, updatedAt: clock });
  f.db.seed("runtimeExternalVersions", { ...owned, sourceId, versionId: "external-transfer-version", externalRevision: 1, kind: "content", sourceRevision: 1,
    detailsCanonical: canonicalModelJson({ author: {}, assetReferences: [] }), originalText: text, originalContentHash: contentHash, normalizedContentHash: contentHash, sequence: 1, ownerSequence: 1, capturedAt: clock });
  // A native operation with declared external ancestry, deliberately no media
  // job: delivery must check the operation independently of a media join.
  const operation = f.db.seed("runtimeModelOperations", { ...scope, reference: f.reference, principalId: f.reference.principalId,
    operationId: "controlled-model-operation", operationKey: "media.image.generate", semanticId: "controlled-generation", cancelled: false, createdAt: clock });
  await f.transaction(() => registerSourceDependencies(f.ctx, scope, { kind: "model", id: operation._id }, [witness]));
  async function begin(requestId = "generated-transfer") {
    const bytes = new TextEncoder().encode(text), hash = await assetContentHash(bytes.buffer);
    const job = await f.call<{ jobId: string; marker: string }>(assets.beginGenerated, { reference: f.reference, requestId, filename: "PRIVATE-GENERATED-NAME",
      contentHash: hash, sizeBytes: bytes.byteLength, mimeType: "text/plain", lineage: { kind: "generated", operationId: operation._id, modelId: "controlled-model" } });
    return { ...job, bytes, hash };
  }
  const erase = () => f.call(erasure.eraseSource, { ...scope, sourceId });
  const advance = () => f.call<{ complete: boolean }>(erasure.continueSource, { ...scope, sourceId });
  async function purge() {
    let complete = false, turns = 0;
    while (!complete && turns++ < 200) complete = (await advance()).complete;
    expect(complete).toBe(true); return turns;
  }
  const issue = (job: Awaited<ReturnType<typeof begin>>) => f.call(assets.issueStorage, { jobId: job.jobId, marker: job.marker, contentHash: job.hash, sizeBytes: job.bytes.byteLength });
  return { ...f, operation, begin, erase, advance, purge, issue };
}

it("erasure waits for a paused issued store and removes its late object before reporting completion", async () => {
  const f = await fixture(), neighbor = await f.upload("Unaffected authored upload", "neighbor"), job = await f.begin();
  let release!: () => void, entered!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const store = f.storage.store.bind(f.storage);
  jest.spyOn(f.storage, "store").mockImplementation(async blob => { entered(); await pause; return store(blob); });
  const pending = assets.storeJobBytes(f.action, job, job.bytes.buffer).then(value => ({ value }), error => ({ error }));
  await started;
  expect(f.db.table("runtimeAssetJobs").find(row => row.jobId === job.jobId)?.transferState).toBe("issued");
  await f.erase();
  for (let count = 0; count < 20; count++) expect(await f.advance()).toMatchObject({ complete: false });
  await f.call(assets.cleanupJob, { jobId: job.jobId });
  expect(f.db.table("runtimeAssetJobs").find(value => value.jobId === job.jobId)).toMatchObject({ state: "uploading", transferState: "issued" });
  expect(await f.advance()).toMatchObject({ complete: false });
  release(); const outcome = await pending;
  expect(outcome).toHaveProperty("error.data.code", "STALE_CONTEXT");
  const acknowledged = f.db.table("runtimeAssetJobs").find(value => value.jobId === job.jobId)!;
  expect(acknowledged.transferState).toBe("settled"); expect(acknowledged.storageId).toEqual(expect.any(String));
  expect(f.blobs.has(acknowledged.storageId as string)).toBe(true);
  await f.purge();
  expect(f.blobs.has(acknowledged.storageId as string)).toBe(false);
  expect(f.db.table("runtimeAssetVersions").filter(value => value.lineage && (value.lineage as { kind: string }).kind === "generated")).toHaveLength(0);
  expect(f.db.table("runtimeAssetJobs").find(value => value.jobId === job.jobId)).toMatchObject({ sourceErasedAt: clock, transferState: "settled" });
  const uploaded = f.db.table("runtimeAssetVersions").find(value => value.versionId === neighbor.asset.versionId)!;
  expect(uploaded.state).toBe("ready"); expect(f.blobs.has(uploaded.storageId as string)).toBe(true);
});

it("model ancestry blocks late begin, finalize and delivery without requiring a media job", async () => {
  const f = await fixture(), ready = await f.begin("ready"), value = await assets.storeJobBytes(f.action, ready, ready.bytes.buffer), pending = await f.begin("pending");
  await f.issue(pending); const storageId = await f.storage.store(new Blob([pending.bytes], { type: pending.marker }));
  await f.call(assets.stageStorage, { jobId: pending.jobId, storageId });
  await f.erase();
  await expect(f.begin("late-new-job")).rejects.toThrow();
  await expect(f.call(assets.finalize, { jobId: pending.jobId })).rejects.toThrow();
  await expect(f.call(assets.get, { assetId: value.assetId, version: value.assetVersion })).rejects.toThrow();
  expect(f.db.table("runtimeMediaJobs")).toHaveLength(0); expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
  await f.call(assets.abandonJob, { jobId: pending.jobId, storageId }); await f.purge();
  expect(f.blobs.size).toBe(0);
});

it("a generated storage issue is atomic and cannot be repeated or issued after source erasure", async () => {
  const f = await fixture(), job = await f.begin();
  await f.issue(job);
  await expect(f.issue(job)).rejects.toMatchObject({ data: { code: "ASSET_UPLOAD_IN_PROGRESS" } });
  expect(f.stores).toBe(0);
  const held = await f.begin("not-issued"); await f.erase();
  await expect(f.issue(held)).rejects.toThrow();
  expect(f.db.table("runtimeAssetJobs").find(value => value.jobId === held.jobId)?.transferState).toBe("not_issued");
});

it("an unknown storage exception without an ID stays unresolved after cleanup and erasure retries", async () => {
  const f = await fixture(), job = await f.begin();
  jest.spyOn(f.storage, "store").mockRejectedValue(new Error("UNKNOWN_STORAGE_OUTCOME"));
  await expect(assets.storeJobBytes(f.action, job, job.bytes.buffer)).rejects.toThrow("UNKNOWN_STORAGE_OUTCOME");
  await f.db.patch("runtimeAssetJobs", f.db.table("runtimeAssetJobs")[0]._id, { leaseExpiresAt: clock - 1 });
  await f.call(assets.cleanupJob, { jobId: job.jobId });
  expect(f.db.table("runtimeAssetJobs")[0]).toMatchObject({ state: "failed", transferState: "issued" });
  expect(f.db.table("runtimeAssetJobs")[0].storageId).toBeUndefined();
  await f.erase(); for (let count = 0; count < 20; count++) expect(await f.advance()).toMatchObject({ complete: false });
  expect(f.blobs.size).toBe(0);
});

it("positive exact orphan discovery reconciles a lost store acknowledgement and preserves foreign bytes", async () => {
  const f = await fixture(), job = await f.begin(), store = f.storage.store.bind(f.storage);
  const foreign = await store(new Blob([job.bytes], { type: "application/vnd.cortex.unrelated" }));
  let owned: string | undefined;
  jest.spyOn(f.storage, "store").mockImplementation(async blob => { owned = await store(blob); throw new Error("LOST_STORAGE_ACK"); });
  await expect(assets.storeJobBytes(f.action, job, job.bytes.buffer)).rejects.toThrow("LOST_STORAGE_ACK");
  expect(f.db.table("runtimeAssetJobs")[0].transferState).toBe("issued");
  await f.call(assets.cleanupJob, { jobId: job.jobId });
  expect(f.db.table("runtimeAssetJobs")[0]).toMatchObject({ transferState: "settled", storageId: owned });
  expect(f.blobs.has(owned!)).toBe(false); expect(f.blobs.has(foreign)).toBe(true);
  await f.erase(); await f.purge(); expect(f.blobs.has(foreign)).toBe(true);
});

it("positive abandonment acknowledges an already ready generated transfer without deleting its committed bytes", async () => {
  const f = await fixture(), job = await f.begin(), value = await assets.storeJobBytes(f.action, job, job.bytes.buffer);
  const row = f.db.table("runtimeAssetJobs")[0], storageId = row.storageId as string;
  await f.db.patch("runtimeAssetJobs", row._id, { transferState: "issued" });
  await f.call(assets.abandonJob, { jobId: job.jobId, storageId });
  expect(f.db.table("runtimeAssetJobs")[0]).toMatchObject({ state: "ready", transferState: "settled" });
  expect(f.blobs.has(storageId)).toBe(true);
  await f.db.patch("runtimeAssetJobs", row._id, { transferState: "issued" });
  await f.call(assets.finalize, { jobId: job.jobId });
  expect(f.db.table("runtimeAssetJobs")[0]).toMatchObject({ state: "ready", transferState: "settled" });
  expect(await f.call<RuntimeAssetVersion>(assets.get, { assetId: value.assetId, version: value.assetVersion })).toMatchObject({ versionId: value.versionId });
});

it("legacy failed generated transfers without positive identity remain unresolved", async () => {
  const f = await fixture(), job = await f.begin();
  await f.db.patch("runtimeAssetJobs", f.db.table("runtimeAssetJobs")[0]._id, { transferState: undefined, state: "failed" });
  await f.call(assets.cleanupJob, { jobId: job.jobId }); await f.erase();
  for (let count = 0; count < 20; count++) expect(await f.advance()).toMatchObject({ complete: false });
  expect(f.db.table("runtimeAssetJobs")[0].sourceErasedAt).toBeUndefined();
});

it("erasing multiple never-issued intents preserves request identities and unrelated upload admission", async () => {
  const f = await fixture(); await f.begin("generated-a"); await f.begin("generated-b");
  await f.erase(); await f.purge();
  const erased = f.db.table("runtimeAssetJobs").filter(row => row.sourceErasedAt !== undefined);
  expect(erased.map(row => row.requestId).sort()).toEqual(["generated-a", "generated-b"]);
  const upload = await f.upload("Independent user bytes", "source-erased");
  expect(upload.asset.lineage.kind).toBe("upload"); expect(f.blobs.size).toBe(1);
});
