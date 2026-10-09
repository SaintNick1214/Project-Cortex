import { beforeEach, afterEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { mediaFixture, media, gateway, http, installMediaMockRoot, png } from "./fixture";
import { assets, invoke } from "../runtimeAssets/fixture";
import { clock, transcript } from "../runtimeTranscript/fixture";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { MediaNativeFactory } from "../../../convex-dev/runtimeMediaGateway";
import type { MessageDoc } from "@convex-dev/agent";
beforeEach(() => { installMediaMockRoot(); }); afterEach(() => { jest.restoreAllMocks(); });
async function signed(body: string, secret = "PRIVATE_SECRET", timestamp = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp},${body}`)));
  return `t=${timestamp},v1=${Array.from(mac, b => b.toString(16).padStart(2, "0")).join("")}`;
}
it("raw signed callback is a deduplicated signal; forged, stale, wrong identity and early callbacks never grant readiness", async () => {
  const f = await mediaFixture(); const job = await f.submit("video");
  const body = JSON.stringify({ id: "PRIVATE_INFERENCE", type: "video.generation.completed", status: "completed", operation: "PRIVATE_OPERATION" });
  const send = async (raw: string, signature: string) => invoke<Response>(http.videoWebhook, f.ctx, new Request(`https://host/cortex/media/video/webhook?jobId=${job.jobId}`, { method: "POST", headers: { "x-convex-video-signature": signature }, body: raw }));
  expect((await send(body, await signed(body))).status).toBe(409);
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  for (const signature of [await signed(body, "FORGED"), await signed(body, "PRIVATE_SECRET", Math.floor(Date.now() / 1000) - 301)]) expect((await send(body, signature)).status).toBe(403);
  const wrong = body.replace("PRIVATE_INFERENCE", "OTHER"); expect((await send(wrong, await signed(wrong))).status).toBe(403);
  expect(f.db.table("runtimeMediaCallbacks")).toHaveLength(0);
  expect((await send(body, await signed(body))).status).toBe(200); expect((await send(body, await signed(body))).status).toBe(200);
  expect(f.db.table("runtimeMediaCallbacks")).toHaveLength(1); expect((await f.call(media.get, { jobId: job.jobId }) as { state: string }).state).toBe("processing");
  f.status("completed"); await gateway.processPollHandler(f.action, { jobId: job.jobId }, f.factory); await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory);
  const late = body.replaceAll("completed", "failed"); expect((await send(late, await signed(late))).status).toBe(409);
  expect(f.db.table("runtimeMediaJobs")[0].state).toBe("ready"); expect(f.counts()).toMatchObject({ starts: 1, downloads: 1 });
});
it("confirmed image save gap reconciles once with no new image call; committed acknowledgement loss preserves output", async () => {
  const f = await mediaFixture(); const job = await f.submit(); const original = f.ctx.runMutation.bind(f.ctx); let failBefore = true;
  f.ctx.runMutation = (async (reference, args) => { if (getFunctionName(reference) === "runtimeMediaJobs:materialized" && failBefore) { failBefore = false; throw new Error("CORE_GAP"); } return original(reference, args); }) as MutationCtx["runMutation"];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  expect(f.db.table("runtimeMediaJobs")[0].state).toBe("downloading"); expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
  await f.call(media.reconcile, { jobId: job.jobId }); expect(f.scheduled.some(row => row.name === "runtimeMediaJobs:processDownload")).toBe(true);
  let loseAck = true;
  f.ctx.runMutation = (async (reference, args) => { const result = await original(reference, args); if (getFunctionName(reference) === "runtimeMediaJobs:materialized" && loseAck) { loseAck = false; throw new Error("ACK_LOST"); } return result; }) as MutationCtx["runMutation"];
  await expect(gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory)).rejects.toThrow("ACK_LOST");
  await f.call(media.cleanupOutput, { jobId: job.jobId }); await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory);
  expect(f.counts()).toMatchObject({ images: 1, downloads: 0 }); expect(f.blobs.size).toBe(1); expect(f.db.table("artifacts")[0].version).toBe(2); expect(f.db.table("runtimeMediaJobs")[0].state).toBe("ready");
});
it("cancelled saved-output gap removes only unjoined owned bytes, without resetting terminal liability", async () => {
  const f = await mediaFixture(); const job = await f.submit(); const original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (reference, args) => { if (getFunctionName(reference) === "runtimeMediaJobs:materialized") throw new Error("CORE_GAP"); return original(reference, args); }) as MutationCtx["runMutation"];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory); const version = f.db.table("runtimeAssetVersions")[0];
  await f.call(media.cancel, { jobId: job.jobId }); await f.call(media.cleanupOutput, { jobId: job.jobId }); await f.call(assets.cleanupVersion, { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, versionId: version.versionId });
  expect(f.blobs.size).toBe(0); expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true }); expect(f.counts().images).toBe(1);
});
it.each(["materialized", "recoverStoredOutput"] as const)("%s fences late publication atomically and cleans only unjoined output", async boundary => {
  const f = await mediaFixture(); const job = await f.submit(); const row = f.db.table("runtimeMediaJobs")[0];
  await f.db.patch("runtimeMediaJobs", row._id as string, { expiresAt: clock + 100 });
  const original = f.ctx.runMutation.bind(f.ctx); let gap = boundary === "recoverStoredOutput";
  f.ctx.runMutation = (async (reference, args) => {
    if (getFunctionName(reference) === "runtimeMediaJobs:materialized") {
      if (gap) { gap = false; throw new Error("OWNED_SAVE_GAP"); }
      if (boundary === "materialized") jest.spyOn(Date, "now").mockReturnValue(clock + 101);
    }
    return original(reference, args);
  }) as MutationCtx["runMutation"];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  if (boundary === "recoverStoredOutput") { jest.spyOn(Date, "now").mockReturnValue(clock + 101); await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory); }
  const version = f.db.table("runtimeAssetVersions")[0];
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "expired", failureCode: "MEDIA_JOB_EXPIRED" });
  expect(f.db.table("artifacts")[0].fileRef).toBeUndefined();
  await f.call(media.cleanupOutput, { jobId: job.jobId });
  await f.call(assets.cleanupVersion, { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, versionId: version.versionId });
  expect(f.blobs.size).toBe(0); expect(f.counts()).toMatchObject({ images: 1, downloads: 0 });
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true });
});
it("a budget cancelled during owned storage cannot publish a previously attached result", async () => {
  const f = await mediaFixture(); const job = await f.submit(); const original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (reference, args) => {
    if (getFunctionName(reference) === "runtimeMediaJobs:materialized") {
      const row = f.db.table("runtimeMediaJobs")[0]; await f.db.patch("runtimeBudgetAccounts", row.runAccountId as string, { cancelled: true });
    }
    return original(reference, args);
  }) as MutationCtx["runMutation"];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  const version = f.db.table("runtimeAssetVersions")[0]; expect(f.db.table("artifacts")[0].fileRef).toBeUndefined();
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "failed", failureCode: "MEDIA_RESULT_WITHHELD" });
  await f.call(media.cleanupOutput, { jobId: job.jobId }); await f.call(assets.cleanupVersion, { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, versionId: version.versionId });
  expect(f.blobs.size).toBe(0); expect(f.counts().images).toBe(1); expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true });
});
it("download retry reuses saved operation and expiry never readmits generation", async () => {
  const f = await mediaFixture(); const job = await f.submit("video"); await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory); f.status("completed"); await gateway.processPollHandler(f.action, { jobId: job.jobId }, f.factory);
  let retries = 0; const factory: MediaNativeFactory = model => ({ ...f.factory(model), download: async (operation, signal) => { retries++; if (retries === 1) throw new Error("DOWNLOAD_NETWORK"); return f.factory(model).download(operation, signal); } });
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, factory); await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, factory); expect(retries).toBe(2); expect(f.counts().starts).toBe(1);
  const other = await f.submit("video", "expired"); await gateway.processSubmissionHandler(f.action, { jobId: other.jobId }, f.factory);
  jest.spyOn(Date, "now").mockReturnValue(clock + 8 * 24 * 60 * 60_000); await f.db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: clock }); await f.call(media.expireJob, { jobId: other.jobId });
  expect(f.db.table("runtimeMediaJobs")[1].state).toBe("expired"); expect(f.counts().starts).toBe(2);
});
it("canonical tool-result bridge delivers only exact current media reference and text; private handles never escape", async () => {
  const f = await mediaFixture(); const job = await f.submit(); await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  const run = await f.run(); const conversation = f.db.table("runtimeConversations")[0];
  const native = [{ ...f.native.messages.get(run.inputMessageIds[0])!, _id: "media-result", stepOrder: 1, message: { role: "tool", content: [{ type: "tool-result", toolCallId: "call", toolName: "media_image_generate", output: { type: "json", value: await f.call(media.get, { jobId: job.jobId }) } }] } }];
  f.native.messages.set("media-result", native[0]);
  await transcript.registerMessages(f.ctx, conversation as never, f.reference, native as unknown as MessageDoc[], { trustedToolMessages: true });
  const page = await f.call<{ page: { parts: unknown[] }[] }>(transcript.messages, { conversationId: run.conversationId });
  expect(page.page.flatMap(message => message.parts)).toContainEqual({ type: "media-job", version: 1, jobId: job.jobId, artifactId: job.artifactId, kind: "image" });
  expect(JSON.stringify(page)).not.toMatch(/PRIVATE_|storageId|webhookSecret|"operation":/);
  const artifact = f.db.table("artifacts").find(row => row.artifactId === job.artifactId)!; await f.db.patch("artifacts", artifact._id as string, { isDeleted: true });
  await expect(f.call(transcript.messages, { conversationId: run.conversationId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});
it("exhausted observer cursor reauthorizes retained media references before any cached projection replay", async () => {
  const f = await mediaFixture(); const job = await f.submit(); const run = await f.run();
  const runtime = await import("../../../convex-dev/runtimeAgent"); const row = f.db.table("runtimeRuns")[0];
  await f.db.patch("runtimeRuns", row._id as string, { attemptNumber: 1, responseStatus: "complete" });
  const part = { type: "media-job", version: 1, jobId: job.jobId, artifactId: job.artifactId, kind: job.kind };
  f.db.seed("runtimeAgentExecutions", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, runId: run.runId, attemptNumber: 1, state: "complete", streaming: true, sourceWitnesses: [], mediaJobReferences: [part] });
  f.db.seed("runtimeAgentOutput", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, runId: run.runId, attemptNumber: 1, sequence: 1, final: true, partCanonical: JSON.stringify(part) });
  expect(await f.call(runtime.observe, { runId: run.runId, afterSequence: 1, finalOnly: true })).toMatchObject({ parts: [] });
  const artifact = f.db.table("artifacts").find(value => value.artifactId === job.artifactId)!; await f.db.patch("artifacts", artifact._id as string, { isDeleted: true });
  for (const afterSequence of [0, 1]) await expect(f.call(runtime.observe, { runId: run.runId, afterSequence, finalOnly: true })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});
it("immutable private input is reauthorized before video start and remains an output dependency", async () => {
  const f = await mediaFixture(); const uploaded = await f.upload(String.fromCharCode(...png), "frame", "image/png");
  const job = await f.call<{ jobId: string }>(media.submit, { kind: "video", requestId: "input-video", prompt: "Slow motion.", inputAsset: { assetId: uploaded.asset.assetId, version: 1 } });
  await f.call(assets.remove, { assetId: uploaded.asset.assetId });
  await expect(gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); expect(f.counts().starts).toBe(0);
});

it("lost returned image buffer fails download truthfully without another inference or a download loop", async () => {
  const f = await mediaFixture(); const job = await f.submit(); const original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (reference, args) => { if (getFunctionName(reference) === "runtimeAssets:beginGenerated") throw new Error("SAVE_INTERRUPTED"); return original(reference, args); }) as MutationCtx["runMutation"];
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory); await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory);
  expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "failed", failureCode: "MEDIA_DOWNLOAD_FAILED", costStatus: "incurred_unknown" });
  expect(f.counts()).toMatchObject({ images: 1, downloads: 0 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true });
});
it("generated byte delivery rechecks the job's consumed source permissions after output was ready", async () => {
  const f = await mediaFixture(); await f.run(); const source = f.db.table("runtimeMemorySources")[0]; const job = await f.submit(); const row = f.db.table("runtimeMediaJobs")[0];
  const lineage = source.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
  await f.db.patch("runtimeMediaJobs", row._id as string, { contextSourceWitnesses: [{ sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: lineage.sourceRevision, contentHash: source.contentHash, permissions: ["canViewFacts"] }] });
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  const ready = await f.call<{ asset: { assetId: string; assetVersion: number } }>(media.get, { jobId: job.jobId });
  expect(await f.call(assets.get, { assetId: ready.asset.assetId, version: ready.asset.assetVersion })).toBeTruthy();
  await f.db.patch("runtimeMemorySources", source._id as string, { tombstonedAt: clock });
  await expect(f.call(assets.get, { assetId: ready.asset.assetId, version: ready.asset.assetVersion })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.counts().images).toBe(1); expect(f.blobs.size).toBe(1);
});

it("revocation during native image output preserves genuine terminal charge while withholding bytes", async () => {
  const f = await mediaFixture(); const job = await f.submit();
  const factory: MediaNativeFactory = model => ({ ...f.factory(model), image: async () => { await f.db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: clock }); return { data: png, mimeType: "image/png" }; } });
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, factory);
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true, resultAttachmentState: "closed" });
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(0); expect(f.db.table("runtimeMediaJobs")[0].state).toBe("failed");
  await expect(f.call(media.get, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});

it("retained deleted job artifacts cannot block current authorized list items; global revocation still denies", async () => {
  const f = await mediaFixture(); const first = await f.submit("image", "retired"); const second = await f.submit("image", "live");
  const old = f.db.table("artifacts").find(row => row.artifactId === first.artifactId)!; await f.db.patch("artifacts", old._id as string, { isDeleted: true });
  expect(await f.call(media.list, { limit: 20 })).toMatchObject({ version: 1, jobs: [{ jobId: second.jobId }] });
  await f.db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: clock });
  await expect(f.call(media.list, { limit: 20 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});
