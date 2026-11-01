import { beforeEach, afterEach, describe, expect, test, jest } from "@jest/globals";
import { assetFixture, installMockRoot, assets, artifacts, attachments, auth, http, transcript, invoke } from "./fixture";
import { ASSET_MAX_BYTES, assertAssetSize, readBoundedAsset } from "../../../src/domain/assets";
import type { RuntimeAssetVersion } from "../../../src/domain/assets";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { MessageDoc } from "@convex-dev/agent";
const selectors = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const read = (value: RuntimeAssetVersion) => ({ ...selectors, assetId: value.assetId, version: value.assetVersion });
beforeEach(() => installMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
describe("immutable private assets and reference ownership", () => {
  test("actual bytes commit once, replay keeps exact metadata, no bearer URL", async () => {
    const f = await assetFixture(); const { asset, job } = await f.upload();
    expect(await f.call(assets.get, read(asset))).toEqual(asset); expect(asset).toMatchObject({ version: 1, assetVersion: 1, sizeBytes: 13, mimeType: "text/plain", mediaKind: "document", lineage: { kind: "upload", requestId: "upload-1" } });
    expect(await f.call(assets.finalize, { jobId: job.jobId })).toEqual(asset); expect((await f.reserve()).ready).toEqual(asset);
    expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.stores).toBe(1); expect(JSON.stringify(asset)).not.toMatch(/storageId|https?:|url/i);
  });
  test("same request with a changed payload is a no-write idempotency conflict", async () => { const f = await assetFixture(); await f.upload(); const count = f.db.writes; await expect(f.reserve("changed")).rejects.toMatchObject({ data: { code: "ASSET_IDEMPOTENCY_CONFLICT" } }); expect(f.db.writes).toBe(count); });
  test("the 100th owner stays readable and idempotent; a 101st join rolls back", async () => {
    const f = await assetFixture(); const { asset } = await f.upload();
    for (let i = 0; i < 98; i++) f.db.seed("runtimeAssetReferences", { ...selectors, versionId: asset.versionId, kind: "attachment", ownerId: `prior-${i}`, ownerVersion: "current", ownerPrincipalId: f.principal._id, active: true, createdAt: Date.now() });
    const input = { ...read(asset), attachmentId: "last-owner" };
    const last = await f.call(attachments.create, input);
    expect(await f.call(attachments.create, input)).toEqual(last);
    expect(await f.call(assets.get, read(asset))).toEqual(asset);
    const count = f.db.writes;
    await expect(f.call(attachments.create, { ...read(asset), attachmentId: "over-cap" })).rejects.toMatchObject({ data: { code: "ASSET_REFERENCE_LIMIT" } });
    expect(f.db.writes).toBe(count); expect(f.db.table("attachments")).toHaveLength(1);
    expect(f.db.table("runtimeAssetReferences").filter(row => row.active)).toHaveLength(100);
  });
  test("catalog-backed legacy attachment preserves validated caller metadata without relabeling bytes", async () => {
    const f = await assetFixture(); const { asset } = await f.upload("movie", "movie", "video/mp4");
    const storageId = f.db.table("runtimeAssetVersions")[0].storageId;
    const input = { ...selectors, storageId, userId: "user-a", type: "video", mimeType: "video/mp4", filename: "kept.mp4", size: 5, dimensions: { width: 640, height: 360 }, duration: 4, metadata: { caption: "typed metadata", source: { version: 1 } } };
    const item = await f.call<{ attachmentId: string }>(attachments.attach, input);
    expect(await f.call(attachments.get, { ...selectors, attachmentId: item.attachmentId })).toMatchObject({ ...input, asset, type: "video" });
    const writes = f.db.writes;
    await expect(f.call(attachments.attach, { ...input, type: "image" })).rejects.toMatchObject({ data: { code: "ASSET_REFERENCE_CONFLICT" } });
    await expect(f.call(attachments.attach, { ...input, dimensions: { width: -1, height: 360 } })).rejects.toMatchObject({ data: { code: "INVALID_ASSET_METADATA" } });
    expect(f.db.writes).toBe(writes);
  });
  test("a blob with the wrong hash cannot stage or become ready", async () => { const f = await assetFixture(); const job = await f.reserve(); const id = await f.storage.store(new Blob(["wrong"], { type: job.marker })); await expect(f.call(assets.stageStorage, { jobId: job.jobId, storageId: id })).rejects.toMatchObject({ data: { code: "ASSET_INTEGRITY_FAILED" } }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0); });
  test.each(["revoked", "deleted", "cancelled"])("late finalize after %s cannot revive a reserved version", async reason => {
    const f = await assetFixture(); const job = await f.reserve(); const storageId = await f.storage.store(new Blob([job.bytes], { type: job.marker })); await f.call(assets.stageStorage, { jobId: job.jobId, storageId });
    if (reason === "revoked") f.grant.revokedAt = Date.now(); else if (reason === "deleted") await f.call(assets.remove, { assetId: job.jobId }); else await f.call(assets.cancel, { requestId: "upload-1" });
    await expect(f.call(assets.finalize, { jobId: job.jobId })).rejects.toThrow(); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
    await f.call(assets.abandonJob, { jobId: job.jobId, storageId }); await f.call(assets.cleanupJob, { jobId: job.jobId }); expect(f.blobs.size).toBe(0);
  });
  test("lost ready acknowledgement cannot trigger deletion of committed referenced bytes", async () => {
    const f = await assetFixture(); const job = await f.reserve(); const original = f.ctx.runMutation.bind(f.ctx);
    f.ctx.runMutation = (async (ref, args) => { const result = await original(ref, args); const name = (await import("convex/server")).getFunctionName(ref); if (name === "runtimeAssets:finalize") throw new Error("lost acknowledgement"); return result; }) as MutationCtx["runMutation"];
    await expect(assets.storeJobBytes(f.action, job, job.bytes.buffer)).rejects.toThrow("lost acknowledgement");
    expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.db.table("runtimeAssetJobs")[0].state).toBe("ready"); expect(f.blobs.size).toBe(1); expect(f.deleted).toHaveLength(0);
  });
  test("attachment removal preserves artifact history; last owner deletion cleans bytes", async () => {
    const f = await assetFixture(); const { asset } = await f.upload(); const item = await f.call<{ attachmentId: string }>(attachments.create, { ...read(asset), attachmentId: "attachment-one" });
    await f.call(artifacts.create, { ...selectors, artifactId: "artifact-one", content: "draft", kind: "video" }); await f.call(artifacts.attachAsset, { ...read(asset), artifactId: "artifact-one" });
    await f.call(assets.remove, { assetId: asset.assetId }); await f.call(attachments.remove, { attachmentId: item.attachmentId });
    await f.call(assets.cleanupVersion, { ...selectors, versionId: asset.versionId }); expect(f.blobs.size).toBe(1); expect(await f.call(assets.get, read(asset))).toEqual(asset);
    await f.call(artifacts.deleteArtifact, { ...selectors, artifactId: "artifact-one" }); await f.call(assets.cleanupVersion, { ...selectors, versionId: asset.versionId }); expect(f.blobs.size).toBe(0);
  });
  test("undo, redo and historical export identify the same immutable lineage", async () => {
    const f = await assetFixture(); const a = (await f.upload("first", "first")).asset; const b = (await f.upload("second", "second")).asset;
    await f.call(artifacts.create, { ...selectors, artifactId: "art", content: "original" }); await f.call(artifacts.attachAsset, { ...read(a), artifactId: "art" }); await f.call(artifacts.attachAsset, { ...read(b), artifactId: "art" });
    await f.call(artifacts.undo, { ...selectors, artifactId: "art" }); expect(f.db.table("artifacts")[0].fileRef).toMatchObject({ versionId: a.versionId, checksum: a.contentHash });
    await f.call(artifacts.redo, { ...selectors, artifactId: "art" }); expect(f.db.table("artifacts")[0].fileRef).toMatchObject({ versionId: b.versionId });
    const v = await f.call<{ fileRef: { versionId: string } }>(artifacts.getVersion, { ...selectors, artifactId: "art", version: 2 }); expect(v.fileRef.versionId).toBe(a.versionId);
    expect(await f.call(assets.get, read(a))).toEqual(a);
  });
  test("a retained 257-edge artifact can be deleted in bounded pages without losing the last owner", async () => {
    const f = await assetFixture(); const pool: RuntimeAssetVersion[] = [];
    for (let i = 0; i < 3; i++) pool.push((await f.upload(`bytes-${i}`, `asset-${i}`)).asset);
    await f.call(artifacts.create, { ...selectors, artifactId: "long-history", content: "initial" });
    const row = f.db.table("artifacts")[0];
    const file = (asset: RuntimeAssetVersion) => ({ assetId: asset.assetId, versionId: asset.versionId, assetVersion: asset.assetVersion, storageId: f.db.table("runtimeAssetVersions").find(value => value.versionId === asset.versionId)!.storageId, checksum: asset.contentHash, mimeType: asset.mimeType, size: asset.sizeBytes });
    // Seed a previously retained prefix; the final admission and deletion below
    // use the registered production handlers, not a 256-mutation mock benchmark.
    const history = [{ version: 1, content: "initial", timestamp: Date.now(), changeType: "create" }, ...Array.from({ length: 255 }, (_, i) => ({ version: i + 2, content: "", fileRef: file(pool[i % 3]), timestamp: Date.now(), changeType: "update" }))];
    Object.assign(row, { version: 256, versionPointer: 256, versionHistory: history, fileRef: file(pool[254 % 3]), content: "" });
    for (let i = 0; i < 255; i++) f.db.seed("runtimeAssetReferences", { ...selectors, versionId: pool[i % 3].versionId, kind: "artifact", ownerId: "long-history", ownerVersion: String(i + 2), ownerPrincipalId: f.principal._id, active: true, createdAt: Date.now() });
    f.db.seed("runtimeAssetReferences", { ...selectors, versionId: pool[254 % 3].versionId, kind: "artifact", ownerId: "long-history", ownerVersion: "current", ownerPrincipalId: f.principal._id, active: true, createdAt: Date.now() });
    await f.call(artifacts.attachAsset, { ...read(pool[0]), artifactId: "long-history" });
    expect(f.db.table("runtimeAssetReferences").filter(edge => edge.kind === "artifact" && edge.active)).toHaveLength(257);
    for (const value of pool) await f.call(assets.remove, { assetId: value.assetId });
    await f.call(artifacts.deleteArtifact, { ...selectors, artifactId: "long-history" });
    expect(f.db.table("artifacts")[0].isDeleted).toBe(true);
    const continuation = [...f.scheduled].reverse().find(item => item.name === "runtimeAssets:reconcileOwnerReferences");
    expect(continuation).toBeDefined(); await f.call(assets.reconcileOwnerReferences, continuation!.args);
    expect(f.db.table("runtimeAssetReferences").filter(edge => edge.active)).toHaveLength(0);
    for (const value of pool) await f.call(assets.cleanupVersion, { ...selectors, versionId: value.versionId });
    expect(f.blobs.size).toBe(0);
  });
  test("an old cleanup continuation preserves a currently retained replacement version", async () => {
    const f = await assetFixture(); const a = (await f.upload("old", "old")).asset; const b = (await f.upload("new", "new")).asset;
    await f.call(artifacts.create, { ...selectors, artifactId: "retained", content: "initial" });
    await f.call(artifacts.attachAsset, { ...read(a), artifactId: "retained" });
    await f.call(artifacts.attachAsset, { ...read(b), artifactId: "retained" });
    await f.call(assets.reconcileOwnerReferences, { ...selectors, kind: "artifact", ownerId: "retained", afterOwnerVersion: "1" });
    expect(f.db.table("runtimeAssetReferences").find(edge => edge.kind === "artifact" && edge.ownerVersion === "current" && edge.active)?.versionId).toBe(b.versionId);
    expect(await f.call(assets.get, read(a))).toEqual(a); expect(await f.call(assets.get, read(b))).toEqual(b);
  });
  test("artifact metadata reads are fresh and deny time-only expiry with unchanged arguments", async () => {
    const f = await assetFixture(); const { asset } = await f.upload();
    const run = await f.run();
    await f.call(artifacts.create, { ...selectors, artifactId: "expiring", content: "private", conversationRef: { conversationId: run.conversationId } });
    await f.call(artifacts.attachAsset, { ...read(asset), artifactId: "expiring" });
    const reads = [
      [artifacts.get, { ...selectors, artifactId: "expiring" }],
      [artifacts.getByConversation, { ...selectors, conversationId: run.conversationId }],
      [artifacts.list, selectors], [artifacts.count, selectors],
      [artifacts.getVersion, { ...selectors, artifactId: "expiring", version: 2 }],
      [artifacts.getHistory, { ...selectors, artifactId: "expiring" }],
    ] as const;
    f.grant.expiresAt = Date.now() + 100;
    for (const [registration, input] of reads) { expect(registration.isMutation).toBe(true); await f.call(registration, input); }
    const now = Date.now(); jest.spyOn(Date, "now").mockReturnValue(now + 101); const writes = f.db.writes;
    for (const [registration, input] of reads) await expect(f.call(registration, input)).rejects.toThrow();
    expect(f.db.writes).toBe(writes); expect(f.deleted).toHaveLength(0);
  });
  test.each(["no-auth", "foreign", "revoked"])("%s metadata delivery denies without row or byte effects", async kind => { const f = await assetFixture(); const { asset } = await f.upload(); if (kind === "no-auth") f.identity(null); else if (kind === "foreign") f.identity({ issuer: "https://host.test", subject: "other" }); else f.grant.revokedAt = Date.now(); const writes = f.db.writes; await expect(f.call(assets.get, read(asset))).rejects.toThrow(); expect(f.db.writes).toBe(writes); expect(f.deleted).toHaveLength(0); });
  test("failed last-owner delete remains retryable and never reports physically deleted", async () => { const f = await assetFixture(); const { asset } = await f.upload(); await f.call(assets.remove, { assetId: asset.assetId }); f.failDelete(true); await f.call(assets.cleanupVersion, { ...selectors, versionId: asset.versionId }); expect(f.db.table("runtimeAssetVersions")[0]).toMatchObject({ state: "cleanup_pending", cleanupAttempt: 1 }); expect(f.blobs.size).toBe(1); f.failDelete(false); await f.call(assets.cleanupVersion, { ...selectors, versionId: asset.versionId }); expect(f.db.table("runtimeAssetVersions")[0].state).toBe("deleted"); expect(f.blobs.size).toBe(0); });
  test("orphan marker cannot match a predictable unrelated host blob", async () => { const f = await assetFixture(); const job = await f.reserve(); const foreign = await f.storage.store(new Blob([job.bytes], { type: `application/vnd.cortex.asset-${job.jobId}` })); const owned = await f.storage.store(new Blob([job.bytes], { type: job.marker })); await f.call(assets.abandonJob, { jobId: job.jobId }); await f.call(assets.cleanupJob, { jobId: job.jobId }); expect(f.blobs.has(owned)).toBe(false); expect(f.blobs.has(foreign)).toBe(true); });
  test("principal cascade retires owned edges and preserves unrelated host bytes", async () => { const f = await assetFixture(); const { asset } = await f.upload(); const host = await f.storage.store(new Blob(["host"], { type: "text/plain" })); await f.call(auth.deletePrincipal, { principalId: f.principal._id }); await f.call(assets.cleanupVersion, { ...selectors, versionId: asset.versionId }); expect(f.blobs.size).toBe(1); expect(f.blobs.has(host)).toBe(true); });
  test("Agent file parts add independent ownership, and vacuum is not artifact ownership", async () => {
    const f = await assetFixture(); const { asset } = await f.upload(); const run = await f.run(); const conversation = f.db.table("runtimeConversations")[0];
    const id = "native:asset"; const native = { _id: id, threadId: conversation.threadId, order: 1, stepOrder: 0, status: "success", message: { role: "assistant", content: [{ type: "text", text: "result" }, { type: "file", mediaType: asset.mimeType, data: `cortex-asset:${asset.versionId}` }] } };
    f.native.messages.set(id, native); await f.transaction(async () => await transcript.registerMessages(f.ctx, conversation as never, f.reference, [native as unknown as MessageDoc]));
    expect(f.db.table("runtimeAssetReferences").filter(row => row.kind === "agent" && row.active)).toHaveLength(1);
    await f.call(artifacts.create, { ...selectors, artifactId: "art-agent", content: "draft" }); await f.call(artifacts.attachAsset, { ...read(asset), artifactId: "art-agent" }); await f.call(assets.remove, { assetId: asset.assetId });
    f.native.messages.delete(id); await f.call(assets.cleanupVersion, { ...selectors, versionId: asset.versionId }); expect(f.blobs.size).toBe(1); expect(run.conversationId).toBe(conversation.conversationId);
    expect(f.db.table("runtimeAssetReferences").filter(row => row.kind === "agent" && row.active)).toHaveLength(0);
    await f.call(artifacts.deleteArtifact, { ...selectors, artifactId: "art-agent" }); await f.call(assets.cleanupVersion, { ...selectors, versionId: asset.versionId }); expect(f.blobs.size).toBe(0);
  });
  test("generated output cannot become ready after its exact input version loses its last owner", async () => {
    const f = await assetFixture(); const { asset } = await f.upload("frame", "frame", "image/png");
    const bytes = new TextEncoder().encode("movie"); const { assetContentHash } = await import("../../../src/domain/assets");
    const job = await f.call<{ jobId: string; marker: string }>(assets.beginGenerated, { reference: f.reference, requestId: "movie", mimeType: "video/mp4", contentHash: await assetContentHash(bytes.buffer), sizeBytes: bytes.byteLength, lineage: { kind: "generated", operationId: "native-operation", modelId: "video-model", sourceVersionIds: [asset.versionId] } });
    const storageId = await f.storage.store(new Blob([bytes], { type: job.marker })); await f.call(assets.stageStorage, { jobId: job.jobId, storageId });
    await f.call(assets.remove, { assetId: asset.assetId });
    await expect(f.call(assets.finalize, { jobId: job.jobId })).rejects.toThrow();
    expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
    await f.call(assets.abandonJob, { jobId: job.jobId, storageId }); await f.call(assets.cleanupJob, { jobId: job.jobId }); expect(f.blobs.has(storageId)).toBe(false);
  });
});
describe("actual application and private protocol byte bounds", () => {
  test("exact 20,000,000 accepted and one byte above rejected", async () => { expect(() => assertAssetSize(ASSET_MAX_BYTES)).not.toThrow(); expect(() => assertAssetSize(ASSET_MAX_BYTES + 1)).toThrow("ASSET_TOO_LARGE"); const bytes = await readBoundedAsset(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(ASSET_MAX_BYTES)); controller.close(); } })); expect(bytes.byteLength).toBe(ASSET_MAX_BYTES); });
  test("streamed overflow cancels before any storage acceptance", async () => { let cancelled = false; const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(ASSET_MAX_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } }); await expect(readBoundedAsset(stream)).rejects.toThrow("ASSET_TOO_LARGE"); expect(cancelled).toBe(true); });
  test("generated oversized bytes fail before job creation/store/ready", async () => { const f = await assetFixture(); await expect(assets.storeGeneratedAsset(f.action, f.reference, { requestId: "generated", mimeType: "video/mp4", lineage: { kind: "generated", operationId: "paid-unknown", modelId: "model" } }, new Blob([new Uint8Array(ASSET_MAX_BYTES + 1)]))).rejects.toMatchObject({ data: { code: "ASSET_TOO_LARGE" } }); expect(f.stores).toBe(0); expect(f.db.table("runtimeAssetJobs")).toHaveLength(0); });
  test("upload current storage grant is checked before reading body", async () => { const f = await assetFixture(); f.grant.capabilities = ["read"]; const request = new Request("https://host/cortex/assets/upload?requestId=a", { method: "POST", headers: { "Content-Type": "text/plain" }, body: new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }), duplex: "half" } as RequestInit); const reader = jest.spyOn(request.body!, "getReader"); const response = await invoke<Response>(http.uploadAsset, f.ctx, request); expect(response.status).toBe(403); expect(reader).not.toHaveBeenCalled(); expect(f.stores).toBe(0); });
  test("HTTP delivers authorized catalog MIME/hash with no-store and rejects corrupted oversized storage", async () => { const f = await assetFixture(); const { asset } = await f.upload(); const url = `https://host/cortex/assets/download?assetId=${asset.assetId}&version=1`; const response = await invoke<Response>(http.downloadAsset, f.ctx, new Request(url)); expect(response.status).toBe(200); expect(await response.text()).toBe("private bytes"); expect(response.headers.get("Cache-Control")).toBe("no-store"); const id = f.db.table("runtimeAssetVersions")[0].storageId as string; f.blobs.set(id, new Blob([new Uint8Array(ASSET_MAX_BYTES + 1)])); const denied = await invoke<Response>(http.downloadAsset, f.ctx, new Request(url)); expect(denied.status).toBe(413); expect(await denied.json()).toEqual({ version: 1, code: "ASSET_TOO_LARGE" }); });
  test("private provider materialization uses exact authorized bytes and full encoded bound", async () => { const f = await assetFixture(); const { asset } = await f.upload("png-input", "image", "image/png"); const input = await assets.readPrivateProviderAsset(f.action, f.reference, { assetId: asset.assetId, version: 1, protocol: "image-inline-v1" }); expect(input.envelope).toMatchObject({ image: "data:image/png;base64,cG5nLWlucHV0" }); expect(input.protocolBytes).toBe(new TextEncoder().encode(JSON.stringify(input.envelope)).byteLength); f.grant.revokedAt = Date.now(); await expect(assets.readPrivateProviderAsset(f.action, f.reference, { assetId: asset.assetId, version: 1, protocol: "image-inline-v1" })).rejects.toThrow(); });
});
