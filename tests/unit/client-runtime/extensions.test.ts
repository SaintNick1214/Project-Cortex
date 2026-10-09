import { describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { CortexRuntimeClient } from "../../../src/client-runtime/client";
import type { RuntimeClientPort } from "../../../src/client-runtime/client";
import { memoryReadiness, memoryStages, runtimeArtifact, runtimeEmbeddingProfile } from "../../../src/client-runtime/extensions";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";

const actor = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "user" };
const complete = { cutoff: 2, indexedThrough: 2, complete: true, hole: null };
const pending = { cutoff: 2, indexedThrough: 0, complete: false, hole: { sequence: 1, state: "pending" } };
const result = { version: 1, cutoff: 2, graphCutoff: 0, profile: DEFAULT_EMBEDDING_PROFILE, stages: { facts: pending, vectors: complete }, strictStages: [] };
function fixture() {
  let current = actor;
  const calls: { name: string; args: unknown }[] = [];
  const mutation = jest.fn(async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
    const name = getFunctionName(ref); calls.push({ name, args });
    return name.endsWith(":embeddingProfile") ? { version: 1, profile: DEFAULT_EMBEDDING_PROFILE } : result;
  });
  const port = { setAuth: (_fetch: unknown, cb: (value: boolean) => void) => cb(true),
    query: jest.fn(async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); }), mutation: ((ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => getFunctionName(ref) === "runtimeClient:session" ? Promise.resolve(current) : mutation(ref, args)), action: jest.fn(), onUpdate: jest.fn(), close: jest.fn() } as unknown as RuntimeClientPort;
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", fetchToken: async () => "opaque", client: port });
  return { client, port, calls, mutation, actor: (value: typeof actor) => { current = value; } };
}
describe("fresh browser profile and stage APIs", () => {
  it("sends only verified selectors and an explicit administrator-profile guard", async () => {
    const f = fixture();
    expect(await f.client.getEmbeddingProfile({ expectedProfileId: DEFAULT_EMBEDDING_PROFILE.profileId })).toEqual({ version: 1, profile: DEFAULT_EMBEDDING_PROFILE });
    expect(f.calls).toEqual([{ name: "runtimeClientExtensions:embeddingProfile", args: { tenantId: "tenant", memorySpaceId: "space", expectedProfileId: DEFAULT_EMBEDDING_PROFILE.profileId } }]);
    expect(f.port.action).not.toHaveBeenCalled(); await f.client.close();
  });
  it.each([DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE])("preserves all matching profile/index provenance for $dimensions dimensions", profile => {
    expect(runtimeEmbeddingProfile({ ...profile, providerToken: "private" })).toEqual(profile);
    expect(Object.isFrozen(runtimeEmbeddingProfile(profile))).toBe(true);
  });
  it.each(["indexName", "normalization", "chunking"])("rejects mixed or unknown managed profile %s", key => {
    expect(() => runtimeEmbeddingProfile({ ...DEFAULT_EMBEDDING_PROFILE, [key]: "other" })).toThrow();
  });
  it("uses fresh mutations for scoped readiness and preserves a facts hole independently from vector completion", async () => {
    const f = fixture(); expect(await f.client.memoryReadiness({ cutoff: 2 })).toEqual(result);
    expect(f.calls[0]).toEqual({ name: "runtimeClientExtensions:memoryReadiness", args: { tenantId: "tenant", memorySpaceId: "space", cutoff: 2 } });
    expect(f.port.action).not.toHaveBeenCalled(); await f.client.close();
  });
  it("passes only the requested strict stage and checks the returned barrier", async () => {
    const f = fixture(); f.mutation.mockResolvedValueOnce({ ...result, strictStages: ["vectors"] } as never);
    expect((await f.client.memoryReadiness({ strictStages: ["vectors"] })).stages.facts!.complete).toBe(false);
    expect(f.mutation.mock.calls[0][1]).toMatchObject({ strictStages: ["vectors"] });
    f.mutation.mockResolvedValueOnce({ ...result, strictStages: ["facts"] } as never);
    await expect(f.client.memoryReadiness({ strictStages: ["facts"] })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); await f.client.close();
  });
  it("accepts a current watermark beyond an earlier captured cutoff", () => {
    expect(memoryReadiness({ ...result, stages: { facts: { ...complete, indexedThrough: 5 }, vectors: complete } }).stages.facts!.indexedThrough).toBe(5);
  });
  it("keeps graph's independent direct-write hole even when source counters are caught up", () => {
    const graph = { ...complete, complete: false, hole: { sequence: 2, state: "pending" } };
    expect(memoryReadiness({ ...result, graphCutoff: 5, stages: { facts: complete, vectors: complete, graph } }).stages.graph).toEqual(graph);
  });
  it.each([
    { strictStages: ["facts", "facts"] }, { strictStages: ["all"] }, { cutoff: -1 }, { graphCutoff: 0.5 },
    { expectedProfileId: "" }, { modelId: "caller-override" }, { strictStages: new Array(1) },
  ])("rejects malformed or override options before any backend effects %#", async options => {
    const f = fixture(); await expect(f.client.memoryReadiness(options as never)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(f.calls).toEqual([]); await f.client.close();
  });
  it("does not invoke stage or option getters", async () => {
    const f = fixture(), get = jest.fn(() => "facts"), stages: string[] = [];
    Object.defineProperty(stages, "0", { enumerable: true, get });
    expect(() => memoryStages(stages)).toThrow(); expect(get).not.toHaveBeenCalled();
    const options = {}; Object.defineProperty(options, "expectedProfileId", { enumerable: true, get });
    await expect(f.client.getEmbeddingProfile(options)).rejects.toMatchObject({ code: "INVALID_INPUT" }); expect(get).not.toHaveBeenCalled(); await f.client.close();
  });
  it.each([
    { ...result, profile: { ...DEFAULT_EMBEDDING_PROFILE, dimensions: 12 } },
    { ...result, stages: { facts: complete, vectors: { ...pending, hole: null } } },
    { ...result, stages: { facts: complete } },
  ])("rejects contradictory public response metadata %#", value => { expect(() => memoryReadiness(value)).toThrow(); });
  it("withholds mismatching profile or captured cutoffs", async () => {
    const f = fixture(); await expect(f.client.getEmbeddingProfile({ expectedProfileId: LARGE_EMBEDDING_PROFILE.profileId })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(f.client.memoryReadiness({ cutoff: 1 })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); await f.client.close();
  });
  it("preserves explicit unavailable and strict failures without backend diagnostics", async () => {
    const f = fixture(); f.mutation.mockRejectedValueOnce({ data: { code: "CAPABILITY_UNAVAILABLE", outcome: "not_dispatched", message: "private" } });
    await expect(f.client.memoryReadiness({ strictStages: ["graph"] })).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", message: "Cortex runtime: CAPABILITY_UNAVAILABLE", outcome: "not_dispatched" }); await f.client.close();
  });
  it("withholds an in-flight response after auth generation changes", async () => {
    const f = fixture(); let start = () => {}, release = (_value: unknown) => {};
    const started = new Promise<void>(resolve => { start = resolve; });
    f.mutation.mockImplementationOnce(async () => { start(); return await new Promise<unknown>(resolve => { release = resolve; }) as never; });
    const pending = f.client.memoryReadiness(); await started; f.actor({ ...actor, principalId: "other" }); await f.client.refreshAuth(); release(result);
    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" }); await f.client.close();
  });
  it("retains current artifact text and a tracked undo pointer without exposing private extras", () => {
    const artifact = { artifactId: "artifact", version: 3, versionPointer: 2, kind: "text", title: "Draft", content: "Current content",
      streamingState: "final", createdAt: 1, updatedAt: 3, conversationRef: { conversationId: "conversation" }, secret: "private", versionHistory: [] };
    expect(runtimeArtifact(artifact)).toEqual({ contractVersion: 1, artifactId: "artifact", artifactVersion: 3, versionPointer: 2,
      kind: "text", title: "Draft", content: "Current content", streamingState: "final", createdAt: 1, updatedAt: 3, conversationId: "conversation" });
  });
  it("projects immutable artifact files without storage IDs or external URLs", () => {
    const artifact = { artifactId: "artifact", version: 1, versionPointer: 1, kind: "video", title: "Video", streamingState: "final", createdAt: 1, updatedAt: 2,
      fileRef: { assetId: "asset", versionId: "version", assetVersion: 1, checksum: "a".repeat(64), size: 20_000_000, mimeType: "video/mp4", storageId: "private-storage" } };
    expect(runtimeArtifact(artifact).file).toEqual({ assetId: "asset", version: 1, versionId: "version", contentHash: "a".repeat(64), sizeBytes: 20_000_000, mimeType: "video/mp4" });
    expect(() => runtimeArtifact({ ...artifact, fileRef: { ...artifact.fileRef, size: 20_000_001 } })).toThrow();
    expect(() => runtimeArtifact({ ...artifact, content: "ambiguous" })).toThrow();
  });
  it("fetches retained artifacts freshly while omitting unbounded version history", async () => {
    const f = fixture(); f.mutation.mockResolvedValueOnce({ artifactId: "artifact", version: 1, versionPointer: 1, kind: "text", title: "Text", content: "Text",
      streamingState: "final", createdAt: 1, updatedAt: 2 } as never);
    expect((await f.client.getArtifact("artifact")).artifactId).toBe("artifact");
    expect(f.mutation.mock.calls[0][1]).toEqual({ tenantId: "tenant", memorySpaceId: "space", artifactId: "artifact", includeVersionHistory: false }); await f.client.close();
  });
});
