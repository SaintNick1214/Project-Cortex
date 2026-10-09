import { beforeEach, afterEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { mediaFixture, media, gateway, http, installMediaMockRoot, png } from "./fixture";
import { assets, invoke } from "../runtimeAssets/fixture";
import { clock, transcript } from "../runtimeTranscript/fixture";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { MediaNativeFactory } from "../../../convex-dev/runtimeMediaGateway";
import type { MessageDoc } from "@convex-dev/agent";
import { MEDIA_LEASE_MS, MEDIA_MAX_POLLS } from "../../../src/domain/media-jobs";
beforeEach(() => { installMediaMockRoot(); }); afterEach(() => { jest.restoreAllMocks(); });

/** Omit the action after a real registered mutation commits: no catch/finally or client reconciliation. */
async function interruptedClaim(f: Awaited<ReturnType<typeof mediaFixture>>, jobId: string, kind: "download" | "poll") {
  const original = f.ctx.runMutation.bind(f.ctx);
  let stopped = false;
  f.ctx.runMutation = (async (reference, args) => {
    const result = await original(reference, args);
    if (!stopped && result && getFunctionName(reference) === `runtimeMediaJobs:${kind === "download" ? "claimDownload" : "pollCheckpoint"}`) {
      stopped = true; throw new Error("HARD_ACTION_INTERRUPTED_AFTER_COMMIT");
    }
    return result;
  }) as MutationCtx["runMutation"];
  try { await expect(f.runScheduled({ name: `runtimeMediaJobs:${kind === "download" ? "processDownload" : "processPoll"}`, args: { jobId } })).rejects.toThrow("HARD_ACTION_INTERRUPTED_AFTER_COMMIT"); }
  finally { f.ctx.runMutation = original; }
}
function scheduledCall(spy: jest.SpiedFunction<MutationCtx["scheduler"]["runAfter"]>, name: string, delay: number) {
  const row = spy.mock.calls.find(([time, reference]) => time === delay && getFunctionName(reference) === `runtimeMediaJobs:${name}`);
  expect(row).toBeDefined();
  return { name: `runtimeMediaJobs:${name}`, args: row![2] };
}
async function processingVideo() {
  // Synthetic proof lifetime chosen before admission, solely for this controlled
  // lease interval. Production qualification and expiry fences are unchanged.
  const bootstrap = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
  const root = bootstrap.lookupDeploymentManifest("transcript-offline-root", 1)!;
  for (const proof of root.dispatchEvidence.filter(value => value.nativeInterface === "video")) Object.assign(proof, { expiresAt: clock + MEDIA_LEASE_MS * 10 });
  const f = await mediaFixture(); const job = await f.submit("video");
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  return { f, job };
}
async function downloadingVideo() {
  const { f, job } = await processingVideo();
  f.status("completed"); await gateway.processPollHandler(f.action, { jobId: job.jobId }, f.factory);
  return { f, job };
}
it("a hard download action interruption recovers automatically from the committed lease without another generation", async () => {
  const { f, job } = await downloadingVideo(); const spy = jest.spyOn(f.ctx.scheduler, "runAfter");
  await interruptedClaim(f, job.jobId, "download");
  const wake = scheduledCall(spy, "processDownload", MEDIA_LEASE_MS);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "downloading", downloadAttempt: 1 });
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS - 1); await f.runScheduled(wake);
  expect(f.counts()).toMatchObject({ starts: 1, downloads: 0 });
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(wake);
  await f.runScheduled(wake);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "ready", downloadAttempt: 2, costStatus: "incurred_unknown" });
  expect(f.counts()).toMatchObject({ starts: 1, downloads: 1 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
  expect(f.db.table("artifacts")[0].version).toBe(2);
});
it("download lease and recovery schedule commit atomically or neither does", async () => {
  const { f, job } = await downloadingVideo(); const before = { ...f.db.table("runtimeMediaJobs")[0] }; const schedules = [...f.scheduled];
  jest.spyOn(f.ctx.scheduler, "runAfter").mockRejectedValueOnce(new Error("SCHEDULER_UNAVAILABLE"));
  await expect(f.call(media.claimDownload, { jobId: job.jobId })).rejects.toThrow("SCHEDULER_UNAVAILABLE");
  expect(f.db.table("runtimeMediaJobs")[0]).toEqual(before); expect(f.scheduled).toEqual(schedules); expect(f.counts().downloads).toBe(0);
});
it("an older download wake preserves a newer active third lease, then stops at the real attempt limit without refund", async () => {
  const { f, job } = await downloadingVideo(); const spy = jest.spyOn(f.ctx.scheduler, "runAfter");
  for (let attempt = 0; attempt < 3; attempt++) {
    jest.spyOn(Date, "now").mockReturnValue(clock + attempt * 1000); await interruptedClaim(f, job.jobId, "download");
    if (attempt < 2) await f.call(media.downloadFailed, { jobId: job.jobId, leaseToken: f.db.table("runtimeMediaJobs")[0].leaseToken });
  }
  const wake = scheduledCall(spy, "processDownload", MEDIA_LEASE_MS);
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(wake);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "downloading", downloadAttempt: 3 });
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS + 2000); await f.runScheduled(wake); await f.runScheduled(wake);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "failed", failureCode: "MEDIA_DOWNLOAD_FAILED", downloadAttempt: 3, costStatus: "incurred_unknown" });
  expect(f.counts()).toMatchObject({ starts: 1, downloads: 0 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
});
it("lease recovery joins an already saved output before any additional download or artifact version", async () => {
  const { f, job } = await downloadingVideo(); const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); const original = f.ctx.runMutation.bind(f.ctx); let gap = true;
  f.ctx.runMutation = (async (reference, args) => { if (gap && getFunctionName(reference) === "runtimeMediaJobs:materialized") { gap = false; throw new Error("SAVED_OUTPUT_ACK_GAP"); } return original(reference, args); }) as MutationCtx["runMutation"];
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, f.factory); f.ctx.runMutation = original;
  const wake = scheduledCall(spy, "processDownload", MEDIA_LEASE_MS);
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(wake); await f.runScheduled(wake);
  expect(f.db.table("runtimeMediaJobs")[0].state).toBe("ready"); expect(f.counts()).toMatchObject({ starts: 1, downloads: 1 });
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.db.table("artifacts")[0].version).toBe(2);
});
it("a hard poll action interruption resumes only the saved operation through a token-fenced durable wake", async () => {
  const { f, job } = await processingVideo();
  const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, "poll");
  const wake = scheduledCall(spy, "expirePoll", MEDIA_LEASE_MS);
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 0 });
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS - 1); await f.runScheduled(wake);
  expect(spy.mock.calls.filter(([delay, reference]) => delay === 0 && getFunctionName(reference) === "runtimeMediaJobs:processPoll")).toHaveLength(0);
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(wake); await f.runScheduled(wake);
  const successor = scheduledCall(spy, "processPoll", 0); f.status("completed"); await f.runScheduled(successor);
  await f.runScheduled(scheduledCall(spy, "processDownload", 0));
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 1, downloads: 1 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "ready", pollCount: 2 });
});
it("normal poll backoff has one successor and stale watchdogs or finishes cannot compete with a newer lease", async () => {
  const { f, job } = await processingVideo();
  const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await f.runScheduled({ name: "runtimeMediaJobs:processPoll", args: { jobId: job.jobId } });
  const oldWake = scheduledCall(spy, "expirePoll", MEDIA_LEASE_MS); const oldToken = (oldWake.args as { leaseToken: string }).leaseToken;
  const backoff = scheduledCall(spy, "processPoll", 2000);
  await f.call(media.pollAgain, { jobId: job.jobId, leaseToken: oldToken });
  expect(spy.mock.calls.filter(([, reference]) => getFunctionName(reference) === "runtimeMediaJobs:processPoll")).toHaveLength(1);
  jest.spyOn(Date, "now").mockReturnValue(clock + 2000); await interruptedClaim(f, job.jobId, "poll");
  const current = f.db.table("runtimeMediaJobs")[0]; const currentToken = current.pollLeaseToken;
  expect(currentToken).not.toBe(oldToken); expect(backoff.args).toEqual({ jobId: job.jobId });
  await f.runScheduled(backoff); expect(f.counts().statuses).toBe(1); expect(current.pollCount).toBe(2);
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(oldWake);
  await f.call(media.pollAgain, { jobId: job.jobId, leaseToken: oldToken });
  await f.call(media.providerTerminal, { jobId: job.jobId, pollLeaseToken: oldToken, status: "completed" });
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "processing", pollLeaseToken: currentToken, pollCount: 2 });
  expect(spy.mock.calls.filter(([delay, reference]) => delay === 0 && getFunctionName(reference) === "runtimeMediaJobs:processPoll")).toHaveLength(0);
  const currentWake = { name: "runtimeMediaJobs:expirePoll", args: { jobId: job.jobId, leaseToken: currentToken } };
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS + 2000); await f.runScheduled(currentWake); await f.runScheduled(currentWake);
  await f.call(media.providerTerminal, { jobId: job.jobId, pollLeaseToken: currentToken, status: "completed" });
  expect(f.db.table("runtimeMediaJobs")[0].state).toBe("processing");
  expect(spy.mock.calls.filter(([delay, reference]) => delay === 0 && getFunctionName(reference) === "runtimeMediaJobs:processPoll")).toHaveLength(1);
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 1, downloads: 0 });
});
it("poll lease and its watchdog roll back together on scheduling failure", async () => {
  const { f, job } = await processingVideo();
  const before = { ...f.db.table("runtimeMediaJobs")[0] }; const schedules = [...f.scheduled];
  jest.spyOn(f.ctx.scheduler, "runAfter").mockRejectedValueOnce(new Error("SCHEDULER_UNAVAILABLE"));
  await expect(f.call(media.pollCheckpoint, { jobId: job.jobId })).rejects.toThrow("SCHEDULER_UNAVAILABLE");
  expect(f.db.table("runtimeMediaJobs")[0]).toEqual(before); expect(f.scheduled).toEqual(schedules); expect(f.counts().statuses).toBe(0);
});
it("poll watchdog scheduling failure retains its token for the same durable successor to retry", async () => {
  const { f, job } = await processingVideo();
  const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, "poll"); const wake = scheduledCall(spy, "expirePoll", MEDIA_LEASE_MS);
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); const before = { ...f.db.table("runtimeMediaJobs")[0] };
  spy.mockRejectedValueOnce(new Error("SCHEDULER_UNAVAILABLE")); await expect(f.runScheduled(wake)).rejects.toThrow("SCHEDULER_UNAVAILABLE");
  expect(f.db.table("runtimeMediaJobs")[0]).toEqual(before); await f.runScheduled(wake); await f.runScheduled(wake);
  expect(spy.mock.calls.filter(([delay, reference]) => delay === 0 && getFunctionName(reference) === "runtimeMediaJobs:processPoll")).toHaveLength(2); // one rejected call, one committed successor
  expect(f.scheduled.filter(row => row.name === "runtimeMediaJobs:processPoll")).toHaveLength(2); // original admission and one recovery
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 0, downloads: 0 });
});
it("the final allowed poll claim stays active until its lease expires, then expires without another poll or refund", async () => {
  const { f, job } = await processingVideo();
  await f.db.patch("runtimeMediaJobs", f.db.table("runtimeMediaJobs")[0]._id as string, { pollCount: MEDIA_MAX_POLLS - 1 });
  const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, "poll"); const wake = scheduledCall(spy, "expirePoll", MEDIA_LEASE_MS);
  await f.runScheduled({ name: "runtimeMediaJobs:processPoll", args: { jobId: job.jobId } });
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "processing", pollCount: MEDIA_MAX_POLLS });
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(wake); await f.runScheduled(wake);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "expired", failureCode: "MEDIA_JOB_EXPIRED", costStatus: "incurred_unknown" });
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 0, downloads: 0 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
  expect(spy.mock.calls.filter(([delay, reference]) => delay === 0 && getFunctionName(reference) === "runtimeMediaJobs:processPoll")).toHaveLength(0);
});
it.each(["download", "poll"] as const)("%s wake requires current authority and cannot recover after scope revocation", async kind => {
  const { f, job } = kind === "download" ? await downloadingVideo() : await processingVideo();
  const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, kind);
  const wake = scheduledCall(spy, kind === "download" ? "processDownload" : "expirePoll", MEDIA_LEASE_MS);
  await f.db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: clock }); jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS);
  await expect(f.runScheduled(wake)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.counts()).toMatchObject({ starts: 1, downloads: 0 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
});
it.each(["download", "poll"] as const)("%s wake cannot publish or poll after the artifact is deleted", async kind => {
  const { f, job } = kind === "download" ? await downloadingVideo() : await processingVideo();
  const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, kind);
  const wake = scheduledCall(spy, kind === "download" ? "processDownload" : "expirePoll", MEDIA_LEASE_MS);
  await f.db.patch("artifacts", f.db.table("artifacts")[0]._id as string, { isDeleted: true }); jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS);
  await expect(f.runScheduled(wake)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.counts()).toMatchObject({ starts: 1, downloads: 0 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
});
it.each([["download", "cancel"], ["download", "expire"], ["poll", "cancel"], ["poll", "expire"]] as const)("%s wake is inert after %s", async (kind, end) => {
    const { f, job } = kind === "download" ? await downloadingVideo() : await processingVideo();
    const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, kind);
    const wake = scheduledCall(spy, kind === "download" ? "processDownload" : "expirePoll", MEDIA_LEASE_MS);
    if (end === "cancel") await f.call(media.cancel, { jobId: job.jobId });
    else { jest.spyOn(Date, "now").mockReturnValue(f.db.table("runtimeMediaJobs")[0].expiresAt as number); await f.call(media.expireJob, { jobId: job.jobId }); }
    jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); const schedules = [...f.scheduled]; await f.runScheduled(wake); await f.runScheduled(wake);
    expect(f.scheduled).toEqual(schedules); expect(f.db.table("runtimeMediaJobs")[0].state).toBe(end === "cancel" ? "cancelled" : "expired");
    expect(f.counts()).toMatchObject({ starts: 1, downloads: 0 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
    expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
});
it("download recovery with expired proof remains withheld, without another generation or manufactured qualification", async () => {
  // Original short-lived synthetic proof: the lease outlives it by20seconds.
  const f = await mediaFixture(); const job = await f.submit("video"); await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  f.status("completed"); await gateway.processPollHandler(f.action, { jobId: job.jobId }, f.factory);
  const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, "download"); const wake = scheduledCall(spy, "processDownload", MEDIA_LEASE_MS);
  const attachments: unknown[] = []; const original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (reference, args) => { const result = await original(reference, args); if (getFunctionName(reference) === "runtimeModelPolicy:attachTerminalResult") attachments.push(result); return result; }) as MutationCtx["runMutation"];
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(wake); await f.runScheduled(wake);
  expect(attachments).toContainEqual({ attached: false, resultWithheld: true });
  expect(JSON.parse(f.db.table("runtimeMediaJobs")[0].proofCanonical as string).expiresAt).toBe(clock + 100_000);
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true, resultAttachmentState: "closed", resultWithheld: true });
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "failed", failureCode: "MEDIA_PROVIDER_FAILED", costStatus: "incurred_unknown" });
  expect(f.counts()).toMatchObject({ starts: 1, downloads: 1 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
});
it("a late failed real poll action cannot capture ledger evidence after its lease is replaced", async () => {
  const { f, job } = await processingVideo(); const before = { attempts: JSON.stringify(f.db.table("runtimeModelAttempts")), accounts: JSON.stringify(f.db.table("runtimeBudgetAccounts")) };
  const factory: MediaNativeFactory = model => ({ ...f.factory(model), status: async (operation, signal) => {
    await f.factory(model).status(operation, signal);
    const oldToken = f.db.table("runtimeMediaJobs")[0].pollLeaseToken;
    jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS);
    await f.call(media.expirePoll, { jobId: job.jobId, leaseToken: oldToken });
    await interruptedClaim(f, job.jobId, "poll"); return "failed";
  } });
  await gateway.processPollHandler(f.action, { jobId: job.jobId }, factory);
  expect(JSON.stringify(f.db.table("runtimeModelAttempts"))).toBe(before.attempts); expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(before.accounts);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "processing", pollCount: 2 });
  expect(f.db.table("runtimeMediaJobs")[0].terminalStatus).toBeUndefined(); expect(f.counts()).toMatchObject({ starts: 1, statuses: 1, downloads: 0 });
});
it("a current failed poll preserves the charge-only terminal evidence and conservative accounting", async () => {
  const { f, job } = await processingVideo(); f.status("failed"); await f.runScheduled({ name: "runtimeMediaJobs:processPoll", args: { jobId: job.jobId } });
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "failed", terminalStatus: "failed", costStatus: "incurred_unknown" });
  const attempt = f.db.table("runtimeModelAttempts")[0]; expect(attempt).toMatchObject({ state: "uncertain", slotReleased: true });
  expect(JSON.parse(attempt.terminalEvidenceCanonical as string)).toMatchObject({ outcome: "confirmed_rejected", costSource: "unavailable" });
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 1, downloads: 0 }); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
});
it("nested terminal capture failure rolls back ledger and job together, leaving the committed poll watchdog", async () => {
  const { f, job } = await processingVideo(); const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); await interruptedClaim(f, job.jobId, "poll");
  const row = f.db.table("runtimeMediaJobs")[0]; const before = JSON.stringify({ jobs: f.db.table("runtimeMediaJobs"), attempts: f.db.table("runtimeModelAttempts"), accounts: f.db.table("runtimeBudgetAccounts") });
  const original = f.ctx.runMutation.bind(f.ctx); let failOnce = true;
  f.ctx.runMutation = (async (reference, args) => {
    const result = await original(reference, args);
    if (failOnce && getFunctionName(reference) === "runtimeModelPolicy:captureTerminalEvidence") { failOnce = false; throw new Error("NESTED_CAPTURE_ACK_LOST"); }
    return result;
  }) as MutationCtx["runMutation"];
  await expect(f.call(media.providerTerminal, { jobId: job.jobId, pollLeaseToken: row.pollLeaseToken, status: "failed" })).rejects.toThrow("NESTED_CAPTURE_ACK_LOST");
  f.ctx.runMutation = original;
  expect(JSON.stringify({ jobs: f.db.table("runtimeMediaJobs"), attempts: f.db.table("runtimeModelAttempts"), accounts: f.db.table("runtimeBudgetAccounts") })).toBe(before);
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(scheduledCall(spy, "expirePoll", MEDIA_LEASE_MS));
  f.status("failed"); await f.runScheduled(scheduledCall(spy, "processPoll", 0));
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "failed", terminalStatus: "failed" });
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true });
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 1, downloads: 0 });
});
it("committed terminal acknowledgement loss cannot capture twice or start another poll chain", async () => {
  const { f, job } = await processingVideo(); f.status("failed"); const spy = jest.spyOn(f.ctx.scheduler, "runAfter"); const original = f.ctx.runMutation.bind(f.ctx); let loseOnce = true;
  f.ctx.runMutation = (async (reference, args) => {
    const result = await original(reference, args);
    if (loseOnce && getFunctionName(reference) === "runtimeMediaJobs:providerTerminal") { loseOnce = false; throw new Error("COMMITTED_TERMINAL_ACK_LOST"); }
    return result;
  }) as MutationCtx["runMutation"];
  await f.runScheduled({ name: "runtimeMediaJobs:processPoll", args: { jobId: job.jobId } }); f.ctx.runMutation = original;
  const before = JSON.stringify({ jobs: f.db.table("runtimeMediaJobs"), attempts: f.db.table("runtimeModelAttempts"), accounts: f.db.table("runtimeBudgetAccounts") });
  jest.spyOn(Date, "now").mockReturnValue(clock + MEDIA_LEASE_MS); await f.runScheduled(scheduledCall(spy, "expirePoll", MEDIA_LEASE_MS));
  await f.runScheduled({ name: "runtimeMediaJobs:processPoll", args: { jobId: job.jobId } });
  expect(JSON.stringify({ jobs: f.db.table("runtimeMediaJobs"), attempts: f.db.table("runtimeModelAttempts"), accounts: f.db.table("runtimeBudgetAccounts") })).toBe(before);
  expect(f.counts()).toMatchObject({ starts: 1, statuses: 1, downloads: 0 });
  expect(spy.mock.calls.filter(([, reference]) => getFunctionName(reference) === "runtimeMediaJobs:processPoll")).toHaveLength(0);
});
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
