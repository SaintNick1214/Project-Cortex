import { describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { CortexRuntimeClient, type RuntimeClientPort } from "../../../src/client-runtime/client";
import { contentJob, contentJobList, contentSubmit } from "../../../src/client-runtime/content";
const actor = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "user" };
const job = { version: 1, jobId: "job", intent: "text", state: "pending", revision: 1, createdAt: 1, updatedAt: 2 };
const request = { version: 1 as const, requestId: "request", intent: "text" as const, prompt: "Write a short document" };
function fixture() {
  let current = actor;
  const calls: { name: string; args: unknown }[] = [];
  const mutation = jest.fn(async (ref: Parameters<RuntimeClientPort["mutation"]>[0], _args: Record<string, unknown>) => {
    const name = getFunctionName(ref); return name.endsWith(":list") ? [job] : job;
  });
  const port = { setAuth: (_fetch: unknown, cb: (value: boolean) => void) => cb(true), query: jest.fn(async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); }),
    mutation: (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
      const name = getFunctionName(ref); if (name === "runtimeClient:session") return Promise.resolve(current);
      calls.push({ name, args }); return mutation(ref, args);
    },
    action: jest.fn(), onUpdate: jest.fn(), close: jest.fn() } as unknown as RuntimeClientPort;
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", fetchToken: async () => "opaque", client: port });
  return { client, port, calls, mutation, actor: (value: typeof actor) => { current = value; } };
}
describe("backend-owned content client", () => {
  it("submits only closed intent and immutable selectors through the fresh verified scope", async () => {
    const f = fixture(); expect(await f.client.submitContentJob(request)).toEqual(job);
    expect(f.calls).toEqual([{ name: "runtimeContentJobs:submit", args: { tenantId: "tenant", memorySpaceId: "space", ...request } }]);
    expect(f.port.action).not.toHaveBeenCalled(); expect(f.port.query).not.toHaveBeenCalled(); await f.client.close();
  });
  it.each(["get", "cancel", "reconcile"] as const)("%s never submits a replacement inference", async method => {
    const f = fixture(); const methods = { get: () => f.client.getContentJob("job"), cancel: () => f.client.cancelContentJob("job"), reconcile: () => f.client.reconcileContentJob("job") };
    expect(await methods[method]()).toEqual(job);
    expect(f.calls).toEqual([{ name: `runtimeContentJobs:${method}`, args: { tenantId: "tenant", memorySpaceId: "space", jobId: "job" } }]); await f.client.close();
  });
  it("lists current conversation jobs without a cacheable private query", async () => {
    const f = fixture(); f.mutation.mockResolvedValueOnce([{ ...job, conversationId: "conversation" }] as never);
    expect(await f.client.listContentJobs({ conversationId: "conversation", limit: 10 })).toHaveLength(1);
    expect(f.calls[0]).toEqual({ name: "runtimeContentJobs:list", args: { tenantId: "tenant", memorySpaceId: "space", conversationId: "conversation", limit: 10 } }); await f.client.close();
  });
  it.each([
    { ...request, model: "override" }, { ...request, tenantId: "other" }, { ...request, budget: 1 }, { ...request, providerKey: "private" },
    { ...request, prompt: " " }, { ...request, prompt: "\ud800" }, { ...request, prompt: "é".repeat(2049) }, { ...request, intent: "image" },
    { ...request, sourceMessageId: "message" }, { ...request, intent: "title" }, { ...request, intent: "suggestions" },
    { ...request, artifact: { artifactId: "artifact", version: 0 } }, { ...request, artifact: { artifactId: "artifact", version: 1, content: "override" } },
  ])("rejects caller authority/model/malformed intent before any effect %#", async input => {
    const f = fixture(); await expect(f.client.submitContentJob(input as never)).rejects.toBeInstanceOf(Error);
    expect(f.calls).toEqual([]); await f.client.close();
  });
  it("does not invoke credential or prompt accessors", () => {
    const get = jest.fn(() => "private"), input = { ...request };
    Object.defineProperty(input, "prompt", { enumerable: true, get }); expect(() => contentSubmit(input)).toThrow(); expect(get).not.toHaveBeenCalled();
  });
  it("preserves exact Unicode content at its byte bound", () => {
    expect(contentSubmit({ ...request, prompt: "é".repeat(2048) }).prompt).toHaveLength(2048);
    expect(contentSubmit({ ...request, intent: "suggestions", artifact: { artifactId: "artifact", version: 2 } })).toMatchObject({ artifact: { version: 2 } });
    expect(contentSubmit({ ...request, requestId: "界".repeat(256) }).requestId).toHaveLength(256);
    expect(() => contentSubmit({ ...request, requestId: "界".repeat(257) })).toThrow();
  });
  it("projects bounded output and strips backend diagnostics and credentials", () => {
    expect(contentJob({ ...job, state: "ready", title: "Document", content: "A safe result", artifactId: "artifact", artifactVersion: 2,
      callbackSecret: "private", hiddenContext: "private", modelRequest: {}, providerKey: "private" }))
      .toEqual({ ...job, state: "ready", title: "Document", content: "A safe result", artifactId: "artifact", artifactVersion: 2 });
    expect(() => contentJob({ ...job, content: "x".repeat(32769) })).toThrow();
    expect(() => contentJob({ ...job, deliveryExpiresAt: NaN })).toThrow();
  });
  it("rejects duplicate jobs and malformed suggestions without leaking their private extras", () => {
    expect(() => contentJobList([job, job], 20)).toThrow();
    const suggestion = { suggestionId: "suggestion", originalText: "old", suggestedText: "new", description: "Fix", secret: "private" };
    expect(contentJob({ ...job, intent: "suggestions", suggestions: [suggestion] }).suggestions).toEqual([{ suggestionId: "suggestion", originalText: "old", suggestedText: "new", description: "Fix" }]);
    expect(() => contentJob({ ...job, suggestions: [suggestion, suggestion] })).toThrow();
    expect(() => contentJob({ ...job, suggestions: new Array(1) })).toThrow();
  });
  it("applies only an explicit suggestion at its immutable artifact version", async () => {
    const f = fixture(); f.mutation.mockResolvedValueOnce({ ...job, intent: "suggestions", state: "ready", artifactId: "artifact", artifactVersion: 3, content: "changed" } as never);
    expect(await f.client.applyContentSuggestion({ jobId: "job", suggestionId: "suggestion", artifactVersion: 2 })).toMatchObject({ artifactVersion: 3 });
    expect(f.calls[0]).toEqual({ name: "runtimeContentJobs:applySuggestion", args: { tenantId: "tenant", memorySpaceId: "space", jobId: "job", suggestionId: "suggestion", artifactVersion: 2 } });
    expect(f.calls.some(call => call.name.endsWith(":submit"))).toBe(false); await f.client.close();
  });
  it("withholds wrong identity/conversation and an unapplied suggestion response", async () => {
    const f = fixture(); f.mutation.mockResolvedValueOnce({ ...job, jobId: "other" });
    await expect(f.client.getContentJob("job")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    f.mutation.mockResolvedValueOnce([{ ...job, conversationId: "other" }] as never);
    await expect(f.client.listContentJobs({ conversationId: "conversation" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    f.mutation.mockResolvedValueOnce({ ...job, intent: "suggestions", artifactId: "artifact", artifactVersion: 2 } as never);
    await expect(f.client.applyContentSuggestion({ jobId: "job", suggestionId: "suggestion", artifactVersion: 2 })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); await f.client.close();
  });
  it("withholds content after a principal changes during delivery", async () => {
    const f = fixture(); let start = () => {}, release = (_value: unknown) => {};
    const started = new Promise<void>(resolve => { start = resolve; });
    f.mutation.mockImplementationOnce(async () => { start(); return await new Promise<unknown>(resolve => { release = resolve; }) as never; });
    const pending = f.client.getContentJob("job"); await started; f.actor({ ...actor, principalId: "other" }); await f.client.refreshAuth(); release(job);
    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" }); await f.client.close();
  });
  it("expires retained content delivery using the server-derived resource deadline", async () => {
    jest.useFakeTimers();
    try {
      const f = fixture(), expiresAt = Date.now() + 40; f.mutation.mockResolvedValueOnce({ ...job, deliveryExpiresAt: expiresAt } as never);
      expect(await f.client.getContentJob("job")).toMatchObject({ deliveryExpiresAt: expiresAt });
      await jest.advanceTimersByTimeAsync(40); await expect(f.client.session()).rejects.toMatchObject({ code: "UNAUTHENTICATED" }); await f.client.close();
    } finally { jest.useRealTimers(); }
  });
});
