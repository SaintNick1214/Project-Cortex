import { describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { CortexRuntimeClient } from "../../../src/client-runtime/client";
import type { RuntimeClientPort } from "../../../src/client-runtime/client";
import { mediaJob, mediaSubmit } from "../../../src/client-runtime/media";
import { runtimePublicPart } from "../../../src/client-runtime/validation";
const actor = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "user" };
const job = { version: 1, jobId: "job", artifactId: "artifact", kind: "image", state: "pending", revision: 1, createdAt: 1, updatedAt: 2, costStatus: "reserved", upstreamCancellation: "not_requested" };
const request = { requestId: "request", kind: "image" as const, prompt: "A blue square" };
function fixture() {
  let current = actor;
  const calls: { name: string; args: unknown }[] = [];
  const mutation = jest.fn(async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
    const name = getFunctionName(ref); calls.push({ name, args }); return name.endsWith(":list") ? { version: 1, jobs: [job] } : job;
  });
  const port = { setAuth: (_fetch: unknown, cb: (value: boolean) => void) => cb(true), query: jest.fn(async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); }), mutation: ((ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => getFunctionName(ref) === "runtimeClient:session" ? Promise.resolve(current) : mutation(ref, args)),
    action: jest.fn(), onUpdate: jest.fn(), close: jest.fn() } as unknown as RuntimeClientPort;
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", fetchToken: async () => "opaque", client: port });
  return { client, port, calls, mutation, actor: (value: typeof actor) => { current = value; } };
}
describe("backend-owned media client", () => {
  it("admits only prompt and verified selectors without any client inference", async () => {
    const f = fixture(); expect(await f.client.submitMediaJob(request)).toEqual(job);
    expect(f.calls).toEqual([{ name: "runtimeMediaJobs:submit", args: { tenantId: "tenant", memorySpaceId: "space", ...request } }]);
    expect(f.port.action).not.toHaveBeenCalled(); await f.client.close();
  });
  it.each(["get", "cancel", "reconcile"] as const)("%s uses an exact fresh job mutation", async method => {
    const f = fixture(); const methods = { get: () => f.client.getMediaJob("job"), cancel: () => f.client.cancelMediaJob("job"), reconcile: () => f.client.reconcileMediaJob("job") };
    expect(await methods[method]()).toEqual(job);
    expect(f.calls).toEqual([{ name: `runtimeMediaJobs:${method}`, args: { tenantId: "tenant", memorySpaceId: "space", jobId: "job" } }]);
    expect(f.calls.some(call => call.name.endsWith(":submit"))).toBe(false); await f.client.close();
  });
  it("lists bounded durable jobs within the current conversation", async () => {
    const f = fixture(); expect(await f.client.listMediaJobs({ conversationId: "conversation", limit: 10 })).toEqual({ version: 1, jobs: [job] });
    expect(f.calls[0]).toEqual({ name: "runtimeMediaJobs:list", args: { tenantId: "tenant", memorySpaceId: "space", conversationId: "conversation", limit: 10 } }); await f.client.close();
  });
  it.each([
    { ...request, model: "override" }, { ...request, options: {} }, { ...request, webhookUrl: "https://caller.invalid" },
    { ...request, prompt: " " }, { ...request, prompt: "\ud800" }, { ...request, prompt: "é".repeat(513) },
    { ...request, inputAsset: { assetId: "private", version: 1 } }, { ...request, kind: "audio" },
  ])("denies unsupported media/options before any backend effects %#", async input => {
    const f = fixture(); await expect(f.client.submitMediaJob(input as never)).rejects.toBeInstanceOf(Error);
    expect(f.calls).toEqual([]); await f.client.close();
  });
  it("accepts only an immutable private video input selector and exact Unicode prompt", () => {
    const input = { requestId: "video", kind: "video", prompt: "e\u0301 🎬", inputAsset: { assetId: "private", version: 2 } };
    expect(mediaSubmit(input)).toEqual(input);
    expect(() => mediaSubmit({ ...input, inputAsset: { ...input.inputAsset, url: "https://external.invalid" } })).toThrow();
  });
  it("does not read accessor prompts", () => {
    const get = jest.fn(() => "private"); const input = { ...request };
    Object.defineProperty(input, "prompt", { enumerable: true, get }); expect(() => mediaSubmit(input)).toThrow(); expect(get).not.toHaveBeenCalled();
  });
  it("redacts callback, upstream and provider diagnostics and retains honest cancellation/cost status", () => {
    const input = { ...job, state: "cancelled", costStatus: "incurred_unknown", upstreamCancellation: "not_supported",
      callbackSecret: "private", operationId: "upstream", downloadUrl: "https://upstream.invalid", diagnostic: "secret" };
    expect(mediaJob(input)).toEqual({ ...job, state: "cancelled", costStatus: "incurred_unknown", upstreamCancellation: "not_supported" });
  });
  it("ready jobs carry a bounded immutable asset, never output base64 or an external URL", () => {
    const asset = { version: 1, assetId: "asset", versionId: "version", assetVersion: 1, contentHash: "a".repeat(64), sizeBytes: 20_000_000,
      mimeType: "image/png", mediaKind: "image", lineage: { kind: "generated", operationId: "operation", modelId: "requested" } };
    expect(mediaJob({ ...job, state: "ready", asset, bytes: "private" }).asset).toEqual(asset);
    expect(() => mediaJob({ ...job, state: "ready", asset: { ...asset, sizeBytes: 20_000_001 } })).toThrow();
    expect(() => mediaJob({ ...job, state: "ready" })).toThrow();
    expect(() => mediaJob({ ...job, state: "pending", asset })).toThrow();
  });
  it("rejects a mismatching backend identity and malformed bounded list", async () => {
    const f = fixture(); f.mutation.mockResolvedValueOnce({ ...job, jobId: "other" });
    await expect(f.client.getMediaJob("job")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    f.mutation.mockResolvedValueOnce({ version: 1, jobs: [job, job] });
    await expect(f.client.listMediaJobs()).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); await f.client.close();
  });
  it("parses persisted media references with no cached state or bytes", () => {
    expect(runtimePublicPart({ type: "media-job", version: 1, jobId: "job", artifactId: "artifact", kind: "image", state: "ready", privateKey: "private" }))
      .toEqual({ type: "media-job", version: 1, jobId: "job", artifactId: "artifact", kind: "image" });
    expect(() => runtimePublicPart({ type: "media-job", version: 2, jobId: "job", artifactId: "artifact", kind: "image" })).toThrow();
  });
  it("withholds a job response after a principal switch", async () => {
    const f = fixture(); let start = () => {}, release = (_value: unknown) => {};
    const started = new Promise<void>(resolve => { start = resolve; });
    f.mutation.mockImplementationOnce(async () => { start(); return await new Promise<unknown>(resolve => { release = resolve; }) as never; });
    const pending = f.client.getMediaJob("job"); await started; f.actor({ ...actor, principalId: "other" }); await f.client.refreshAuth(); release(job);
    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" }); await f.client.close();
  });
  it("retains the server metadata deadline and clears retained delivery at expiry", async () => {
    jest.useFakeTimers();
    try {
      const f = fixture(), expiresAt = Date.now() + 40;
      f.mutation.mockResolvedValueOnce({ ...job, deliveryExpiresAt: expiresAt } as never);
      expect(await f.client.getMediaJob("job")).toMatchObject({ deliveryExpiresAt: expiresAt });
      await jest.advanceTimersByTimeAsync(40); await expect(f.client.session()).rejects.toMatchObject({ code: "UNAUTHENTICATED" }); await f.client.close();
    } finally { jest.useRealTimers(); }
  });

});
