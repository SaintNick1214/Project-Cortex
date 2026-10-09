/** Fresh metadata carries the actual consumed export deadline; canonical bytes stay immutable. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { assetFixture, assets, artifacts, installMockRoot } from "../runtimeAssets/fixture";
import { clock } from "../runtimeTranscript/fixture";
const shares = await import("../../../convex-dev/conversationShares");
beforeEach(() => { installMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
it("a storage-only owner grant keeps its supported fresh metadata read", async () => {
  const f = await assetFixture(), { asset } = await f.upload();
  f.grant.capabilities = ["storage:read"]; f.grant.expiresAt = clock + 1000;
  expect(await f.call(assets.get, { assetId: asset.assetId, version: asset.assetVersion })).toEqual({ ...asset, deliveryExpiresAt: clock + 1000 });
});
it("fresh asset metadata exposes the consumed canExport deadline and denies the same selector after expiry", async () => {
  const f = await assetFixture(), { asset } = await f.upload(), run = await f.run();
  await f.call(artifacts.create, { artifactId: "asset-owner", content: "draft", conversationRef: { conversationId: run.conversationId } });
  await f.call(artifacts.attachAsset, { artifactId: "asset-owner", assetId: asset.assetId, version: asset.assetVersion });
  await f.call(assets.remove, { assetId: asset.assetId });
  const peer = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "peer", actorKind: "user", version: 1 });
  const membership = f.db.seed("runtimeAuthMemberships", { principalId: peer._id, tenantId: "tenant-a", version: 1 });
  f.db.seed("runtimeAuthGrants", { principalId: peer._id, membershipId: membership._id, tenantId: "tenant-a", memorySpaceId: "space-a",
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "storage:read"], resourceAccess: "space", version: 1, expiresAt: clock + 10_000 });
  await f.call(shares.create, { conversationId: run.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: peer._id,
    expiresAt: clock + 1000, permissions: { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: true } });
  f.identity({ issuer: "https://host.test", subject: "peer" });
  const input = { tenantId: "tenant-a", memorySpaceId: "space-a", assetId: asset.assetId, version: asset.assetVersion };
  const writes = f.db.writes;
  expect(await f.call(assets.get, input)).toEqual({ ...asset, deliveryExpiresAt: clock + 1000 });
  expect(asset).not.toHaveProperty("deliveryExpiresAt");
  expect(f.db.table("runtimeAssetVersions")[0]).not.toHaveProperty("deliveryExpiresAt");
  jest.spyOn(Date, "now").mockReturnValue(clock + 1001);
  await expect(f.call(assets.get, input)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.db.writes).toBe(writes); expect(f.deleted).toHaveLength(0);
});
