/** Action-clock regression: native mutation time stays fixed throughout each RPC. */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
import { assetFixture, assets, artifacts, http, transcript, invoke, installMockRoot } from "./fixture";

beforeEach(() => { installMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
const selectors = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const download = (assetId: string) => new Request(`https://host/cortex/assets/download?assetId=${assetId}&version=1`);

function actionClock() {
  let now = Date.now();
  jest.spyOn(Date, "now").mockImplementation(() => now);
  return { get now() { return now; }, cross(deadline: number) { now = deadline; } };
}
function crossAfterRpc(f: Awaited<ReturnType<typeof assetFixture>>, name: string, deadline: number, clock: ReturnType<typeof actionClock>) {
  const mutation = f.ctx.runMutation.bind(f.ctx);
  let crossed = false;
  f.ctx.runMutation = (async (ref, args) => {
    const value = await mutation(ref, args);
    if (getFunctionName(ref) === name) { crossed = true; clock.cross(deadline); }
    return value;
  }) as MutationCtx["runMutation"];
  return () => crossed;
}

test("HTTP byte delivery rejects grant expiry after its final real mutation returns", async () => {
  const clock = actionClock(), f = await assetFixture(), { asset } = await f.upload();
  const deadline = clock.now + 1000; f.grant.expiresAt = deadline;
  const writes = f.db.writes;
  const crossed = crossAfterRpc(f, "runtimeAssets:downloadCheckpoint", deadline, clock);
  const response = await invoke<Response>(http.downloadAsset, f.ctx, download(asset.assetId));
  expect(crossed()).toBe(true); expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ version: 1, code: "FORBIDDEN" });
  expect(f.db.writes).toBe(writes); expect(f.blobs.size).toBe(1);
});

test("private provider materialization rejects grant expiry after its final real mutation returns", async () => {
  const clock = actionClock(), f = await assetFixture(), { asset } = await f.upload("image bytes", "image", "image/png");
  const deadline = clock.now + 1000; f.grant.expiresAt = deadline;
  const writes = f.db.writes;
  const crossed = crossAfterRpc(f, "runtimeAssets:downloadCheckpoint", deadline, clock);
  await expect(assets.readPrivateProviderAsset(f.action, f.reference, { assetId: asset.assetId, version: 1, protocol: "image-inline-v1" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(crossed()).toBe(true); expect(f.db.writes).toBe(writes); expect(f.blobs.size).toBe(1);
});

test("HTTP upload suppresses ready metadata after a confirmed commit crosses its grant deadline", async () => {
  const clock = actionClock(), f = await assetFixture();
  const deadline = clock.now + 1000; f.grant.expiresAt = deadline;
  const crossed = crossAfterRpc(f, "runtimeAssets:finalize", deadline, clock);
  const response = await invoke<Response>(http.uploadAsset, f.ctx, new Request("https://host/cortex/assets/upload?requestId=late", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "private upload" }));
  expect(crossed()).toBe(true); expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ version: 1, code: "FORBIDDEN" });
  expect(f.db.table("runtimeAssetJobs")[0].state).toBe("ready");
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.blobs.size).toBe(1); expect(f.deleted).toHaveLength(0);
});

async function sharedAsset(f: Awaited<ReturnType<typeof assetFixture>>, deadline: number): Promise<{ assetId: string; reference: RuntimeAuthorityReference }> {
  const { asset } = await f.upload("shared image", "shared", "image/png");
  const conversation = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "conversation" });
  await f.call(artifacts.create, { ...selectors, artifactId: "shared-artifact", title: "private", content: "document", conversationRef: { conversationId: conversation.conversationId } });
  await f.call(artifacts.attachAsset, { ...selectors, artifactId: "shared-artifact", assetId: asset.assetId, version: 1 });
  await f.call(assets.remove, { ...selectors, assetId: asset.assetId });
  const principal = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "reader", actorKind: "user", version: 1 });
  const member = f.db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1 });
  const grant = f.db.seed("runtimeAuthGrants", { ...selectors, principalId: principal._id, membershipId: member._id, tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["storage:read"], resourceAccess: "space", version: 1 });
  f.db.seed("runtimeConversationShares", { ...selectors, ownerPrincipalId: f.principal._id, shareId: "share", conversationId: conversation.conversationId, grantType: "user", grantedTo: principal._id,
    permissions: { canView: true, canExport: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false }, state: "active", actorReference: f.reference, expiresAt: deadline, viewCount: 0, createdAt: Date.now() });
  f.identity({ issuer: "https://host.test", subject: "reader" });
  return { assetId: asset.assetId, reference: { ...f.reference, principalId: principal._id, membershipId: member._id, grantId: grant._id } };
}

test("HTTP byte delivery rejects consumed export share expiry with a permanent actor grant", async () => {
  const clock = actionClock(), f = await assetFixture(), deadline = clock.now + 1000;
  const { assetId } = await sharedAsset(f, deadline);
  const crossed = crossAfterRpc(f, "runtimeAssets:downloadCheckpoint", deadline, clock);
  const response = await invoke<Response>(http.downloadAsset, f.ctx, download(assetId));
  expect(crossed()).toBe(true); expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ version: 1, code: "FORBIDDEN" }); expect(f.blobs.size).toBe(1);
});

test("current storage-only shared input remains usable on both private byte paths", async () => {
  const clock = actionClock(), f = await assetFixture(); const { assetId, reference } = await sharedAsset(f, clock.now + 1000);
  const response = await invoke<Response>(http.downloadAsset, f.ctx, download(assetId));
  expect(response.status).toBe(200); expect(await response.text()).toBe("shared image");
  const result = await assets.readPrivateProviderAsset(f.action, reference, { assetId, version: 1, protocol: "image-inline-v1" });
  expect(result.metadata.assetId).toBe(assetId); expect(result.envelope.image).toBe("data:image/png;base64,c2hhcmVkIGltYWdl");
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(f.blobs.size).toBe(1);
});

test("generated output denies delivery after the stored-version checkpoint without deleting its confirmed bytes", async () => {
  const clock = actionClock(), f = await assetFixture(), deadline = clock.now + 1000;
  f.grant.expiresAt = deadline;
  const crossed = crossAfterRpc(f, "runtimeAssets:storedDeliveryCheckpoint", deadline, clock);
  await expect(assets.storeGeneratedAsset(f.action, f.reference,
    { requestId: "generated", mimeType: "image/png", lineage: { kind: "generated", operationId: "confirmed-operation", modelId: "qualified-model" } }, new Blob(["generated image"])))
    .rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(crossed()).toBe(true); expect(f.db.table("runtimeAssetJobs")[0].state).toBe("ready");
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.blobs.size).toBe(1); expect(f.deleted).toHaveLength(0);
});

test("idempotent HTTP upload replay still fresh-fences the exact ready version", async () => {
  const clock = actionClock(), f = await assetFixture(); await f.upload("private replay", "replay");
  const deadline = clock.now + 1000; f.grant.expiresAt = deadline;
  const crossed = crossAfterRpc(f, "runtimeAssets:downloadCheckpoint", deadline, clock);
  const response = await invoke<Response>(http.uploadAsset, f.ctx, new Request("https://host/cortex/assets/upload?requestId=replay", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "private replay" }));
  expect(crossed()).toBe(true); expect(response.status).toBe(403); expect(await response.json()).toEqual({ version: 1, code: "FORBIDDEN" });
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.stores).toBe(1); expect(f.deleted).toHaveLength(0);
});

test("private provider input carries the consumed export-share cutoff with a permanent actor grant", async () => {
  const clock = actionClock(), f = await assetFixture(), deadline = clock.now + 1000;
  const { assetId, reference } = await sharedAsset(f, deadline);
  const crossed = crossAfterRpc(f, "runtimeAssets:downloadCheckpoint", deadline, clock);
  await expect(assets.readPrivateProviderAsset(f.action, reference, { assetId, version: 1, protocol: "image-inline-v1" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(crossed()).toBe(true); expect(f.blobs.size).toBe(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});

test("HTTP upload and replay preserve current storage-write-only grant parity and canonical metadata", async () => {
  const clock = actionClock(), f = await assetFixture(); f.grant.capabilities = ["storage:write"]; f.grant.expiresAt = clock.now + 1000;
  const request = () => new Request("https://host/cortex/assets/upload?requestId=storage-only", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "bytes" });
  const response = await invoke<Response>(http.uploadAsset, f.ctx, request()); expect(response.status).toBe(200);
  const value = await response.json(); const replay = await invoke<Response>(http.uploadAsset, f.ctx, request()); expect(replay.status).toBe(200);
  expect(await replay.json()).toEqual(value); expect(value).not.toHaveProperty("deliveryExpiresAt");
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.stores).toBe(1);
});
