import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { mediaFixture, media, gateway, installMediaMockRoot, png } from "./fixture";
import { clock, definitions } from "../runtimeTranscript/fixture";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { decodeMediaBytes, assertMediaBytes, mediaInputBound } from "../../../src/domain/media-jobs";
import type { MediaNativeFactory } from "../../../convex-dev/runtimeMediaGateway";
describe("durable governed media", () => {
  beforeEach(() => { installMediaMockRoot(); }); afterEach(() => { jest.restoreAllMocks(); });
  it("persists pending artifact/budget before one image call; one immutable version and unknown liability survive replay", async () => {
    const f = await mediaFixture(); const job = await f.submit();
    expect(job.state).toBe("pending"); expect(f.db.table("artifacts")).toHaveLength(1); expect(f.counts().images).toBe(0);
    await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
    const ready = await f.call(media.get, { jobId: job.jobId }); expect(ready).toMatchObject({ state: "ready", asset: { mimeType: "image/png", sizeBytes: png.length }, costStatus: "incurred_unknown" });
    expect(JSON.stringify(ready)).not.toMatch(/PRIVATE_|storageId|"operation":|webhookSecret/);
    await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
    await f.call(media.reconcile, { jobId: job.jobId }); expect(f.counts().images).toBe(1); expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
    expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true, resultAttachmentState: "attached" });
    expect(f.db.table("runtimeBudgetAccounts").find(row => row.kind === "tenant")).toMatchObject({ uncertainUnits: 100, reservedUnits: 0, activeConcurrency: 0 });
    expect(f.scheduled.filter(row => row.name === "runtimeMediaJobs:processDownload")).toHaveLength(0);
  });
  it("exact request replay reuses pending job; changed request rolls back before another artifact/budget", async () => {
    const f = await mediaFixture(); const job = await f.submit(); expect(await f.submit()).toEqual(job);
    await expect(f.call(media.submit, { kind: "image", requestId: "media-1", prompt: "Different" })).rejects.toMatchObject({ data: { code: "MEDIA_IDEMPOTENCY_CONFLICT" } });
    expect(f.db.table("artifacts")).toHaveLength(1); expect(f.db.table("runtimeMediaJobs")).toHaveLength(1);
  });
  it("lost submission becomes unknown, never starts again or silently refunds", async () => {
    const f = await mediaFixture(); const job = await f.submit("video"); let starts = 0;
    const factory: MediaNativeFactory = model => ({ ...f.factory(model), start: async () => { starts++; throw new Error("NETWORK_LOST_PRIVATE"); } });
    await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, factory);
    expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "submission_unknown", failureCode: "MEDIA_SUBMISSION_UNKNOWN", costStatus: "incurred_unknown" });
    await f.call(media.reconcile, { jobId: job.jobId }); await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, factory); expect(starts).toBe(1);
    expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
  });
  it("polling and repeated download create one asset and preserve saved private handle", async () => {
    const f = await mediaFixture(); const job = await f.submit("video"); await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
    expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "processing" });
    f.status("completed"); await gateway.processPollHandler(f.action, { jobId: job.jobId }, f.factory); await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory);
    await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory); expect(f.counts()).toMatchObject({ starts: 1, downloads: 1 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
    expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "ready", asset: { mimeType: "video/mp4" } });
  });
  it("cancel before submission has zero model effects and does not claim upstream cancellation", async () => {
    const f = await mediaFixture(); const job = await f.submit("video"); await f.call(media.cancel, { jobId: job.jobId }); await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
    expect(f.counts().starts).toBe(0); expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "cancelled", upstreamCancellation: "not_supported" }); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  it("late image after cancellation charges terminal evidence but cannot become ready", async () => {
    const f = await mediaFixture(); const job = await f.submit();
    const factory: MediaNativeFactory = model => ({ ...f.factory(model), image: async () => { await f.call(media.cancel, { jobId: job.jobId }); return { data: png, mimeType: "image/png" }; } });
    await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, factory);
    expect(f.db.table("runtimeMediaJobs")[0].state).toBe("cancelled"); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
    expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true, resultAttachmentState: "closed" });
  });
  it("expired first-submission lease retires without a second generation", async () => {
    const f = await mediaFixture(); const job = await f.submit(); const held = await f.call<{ leaseToken: string }>(media.claimSubmission, { jobId: job.jobId });
    jest.spyOn(Date, "now").mockReturnValue(clock + 120_001); await f.call(media.expireSubmission, { jobId: job.jobId, leaseToken: held.leaseToken });
    expect(f.db.table("runtimeMediaJobs")[0].state).toBe("submission_unknown"); await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory); expect(f.counts().images).toBe(0);
  });
  it("no JWT and current revoked grant deny job metadata and all new dispatch", async () => {
    const f = await mediaFixture(); const job = await f.submit(); f.identity(null); await expect(f.call(media.get, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    f.identity({ issuer: "https://host.test", subject: "user-a" }); await f.db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: clock });
    await expect(f.call(media.get, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); expect(f.counts().images).toBe(0);
  });
  it("oversize returned bytes fail typed, release terminal slot and never store a partial object", async () => {
    const f = await mediaFixture(); const job = await f.submit(); const factory: MediaNativeFactory = model => ({ ...f.factory(model), image: async () => ({ data: new Uint8Array(20_000_001), mimeType: "image/png" }) });
    await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, factory);
    expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "failed", failureCode: "ASSET_TOO_LARGE" }); expect(f.stores).toBe(0);
    expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true, resultAttachmentState: "closed" });
  });
  it("V1 executable registry/hash remains valid alongside distinct closed V2", async () => {
    const f = await mediaFixture(); expect(await definitions.executableRegistryHash()).not.toBe(await definitions.executableRegistryHashV2());
    expect(await f.call(definitions.get, { agentId: f.published.agentId, version: 1 })).toBeTruthy();
  });
  it("closed V2 definitions select qualified media separately while original V1 definitions remain readable", async () => {
    installMediaMockRoot({ v2: true }); const f = await mediaFixture(); const registryHash = await definitions.executableRegistryHashV2();
    const input = { ...f.definitionInput, context: { ...f.definitionInput.context, registryHash }, tools: [{ toolId: "media.image.generate", toolVersion: 1, registryHash, requiredCapability: "tool", approval: "explicit" }],
      policies: [{ policyId: "chat-tools", version: 1, operationKey: "agent.respond", rules: { limits: { toolSteps: 4 } } }, { policyId: "image", version: 1, operationKey: "media.image.generate", rules: { limits: { toolSteps: 0 } } }] };
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "media-v2", expectedPreviousVersion: 0, definitionInput: input });
    expect(await f.call(definitions.get, { agentId: published.agentId, version: published.version })).toBeTruthy();
    expect(await f.call(definitions.get, { agentId: f.published.agentId, version: f.published.version })).toBeTruthy();
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  it("fixed wire proof counts immutable input without persisting base64 and rejects caller options", () => {
    const envelope = { version: 1, prompt: "hello", options: { kind: "image", n: 1, size: "1024x1024", quality: "low", outputFormat: "png" } };
    const contract = { version: 1, options: envelope.options, inputProtocol: "none", maximumInputAssetBytes: 0, maximumResultBytes: 20_000_000, callbacks: false, terminalIdentity: "requested-only", usage: "optional" };
    expect(mediaInputBound(envelope, contract, "openai/gpt-image-1")).toBeGreaterThan(5);
    expect(() => mediaInputBound({ ...envelope, options: { ...envelope.options, n: 2 } }, contract, "openai/gpt-image-1")).toThrow();
    expect(decodeMediaBytes(btoa(String.fromCharCode(...png)))).toEqual(png); expect(() => decodeMediaBytes("AAAA", 1)).toThrow("ASSET_TOO_LARGE"); expect(() => assertMediaBytes(new Uint8Array([1]), "image/png")).toThrow("MEDIA_OUTPUT_INVALID");
    expect(canonicalModelJson(envelope)).not.toContain("base64");
  });
});
