import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
const server = await import("convex/server");
const tokenLookup = jest.fn<() => Promise<string>>().mockResolvedValue("controlled-service-token");
jest.unstable_mockModule("convex/server", () => ({ ...server, getServiceToken: tokenLookup }));
const { gateway, media, mediaFixture, installMediaMockRoot, mp4 } = await import("./fixture");

beforeEach(() => { installMediaMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });

it.each([[0.25, "0.250001"], [0, "0"]] as const)("preserves official video download cost %s with conservative decimal precision", async (cost, expected) => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
    data: [{ b64_json: btoa(String.fromCharCode(...mp4)), media_type: "video/mp4" }], usage: { cost },
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  const output = await gateway.officialMediaFactory("google/veo-3.1").download("controlled-operation", new AbortController().signal);
  expect(output).toMatchObject({ mimeType: "video/mp4", aggregateCostUsd: expected });
  expect(output.actualModel).toBeUndefined(); expect(output.usage).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(String(url)).toMatch(/\/v1\/videos\/download$/);
  expect(JSON.parse(init!.body as string)).toEqual({ operation: "controlled-operation" });
});

it.each([undefined, -1, "0.25", null])("keeps absent or unsupported native video cost %s unavailable", async cost => {
  jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
    data: [{ b64_json: btoa(String.fromCharCode(...mp4)), media_type: "video/mp4" }], usage: { cost },
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  const output = await gateway.officialMediaFactory("google/veo-3.1").download("controlled-operation", new AbortController().signal);
  expect(output.aggregateCostUsd).toBeUndefined();
});

it("unqualified native cost cannot settle a reservation or withhold a qualified unknown-cost media result", async () => {
  const f = await mediaFixture(), job = await f.submit("video");
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  f.status("completed"); await gateway.processPollHandler(f.action, { jobId: job.jobId }, f.factory);
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, model => ({ ...f.factory(model),
    download: async () => ({ data: mp4, mimeType: "video/mp4", aggregateCostUsd: "0.250001" }),
  }));
  const attempt = f.db.table("runtimeModelAttempts")[0];
  expect(attempt).toMatchObject({ state: "uncertain", slotReleased: true, resultAttachmentState: "attached" });
  expect(JSON.parse(attempt.terminalEvidenceCanonical as string)).toMatchObject({ costSource: "unavailable" });
  expect(JSON.parse(attempt.terminalEvidenceCanonical as string).aggregateCostUsd).toBeUndefined();
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "ready", costStatus: "incurred_unknown" });
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1);
});

it("reports official async configuration refusal without weakening uncertain charge or resubmitting", async () => {
  const f = await mediaFixture(), job = await f.submit("video"); let starts = 0;
  const factory = (model: string) => ({ ...f.factory(model), start: async () => {
    starts++; throw new Error("Asynchronous video generation is not configured");
  } });
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, factory);
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "submission_unknown", failureCode: "MEDIA_CAPABILITY_UNAVAILABLE", costStatus: "incurred_unknown" });
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
  await f.call(media.reconcile, { jobId: job.jobId });
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, factory);
  expect(starts).toBe(1); expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
});

it("cost-qualified media settles exact reported units once and preserves one version on replay", async () => {
  // This is an explicitly synthetic proof inside the controlled handler fixture,
  // not a production qualification or evidence of async service availability.
  const bootstrap = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
  const manifest = bootstrap.lookupDeploymentManifest("transcript-offline-root", 1)!;
  const proof = manifest.dispatchEvidence.find(value => value.nativeInterface === "video")!;
  Object.assign(proof, { terminalCost: "gateway-aggregate-usd-v1" });
  const f = await mediaFixture(), job = await f.submit("video");
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  f.status("completed"); await gateway.processPollHandler(f.action, { jobId: job.jobId }, f.factory);
  const factory = (model: string) => ({ ...f.factory(model), download: async () => ({
    data: mp4, mimeType: "video/mp4" as const, aggregateCostUsd: "0.000020",
  }) });
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, factory);
  const attempt = f.db.table("runtimeModelAttempts")[0];
  expect(attempt).toMatchObject({ state: "settled", slotReleased: true, resultAttachmentState: "attached", settledCostUnits: 20 });
  expect(JSON.parse(attempt.terminalEvidenceCanonical as string)).toMatchObject({ costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000020" });
  for (const account of f.db.table("runtimeBudgetAccounts")) expect(account).toMatchObject({ settledUnits: 20, uncertainUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
  expect(f.db.table("runtimeMediaJobs")[0]).toMatchObject({ state: "ready", costStatus: "settled" });
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.db.table("artifacts")[0].version).toBe(2);
  const accounting = JSON.stringify(f.db.table("runtimeBudgetAccounts"));
  await f.call(media.reconcile, { jobId: job.jobId });
  await gateway.processDownloadHandler(f.action, { jobId: job.jobId }, factory);
  expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(accounting);
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(1); expect(f.db.table("artifacts")[0].version).toBe(2);
  expect(f.counts().starts).toBe(1);
});
