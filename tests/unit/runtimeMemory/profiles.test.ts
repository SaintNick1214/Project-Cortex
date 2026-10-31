/** Offline registered persistence/domain controls. Managed indexes are exercised separately. */
import { describe, expect, it, jest } from "@jest/globals";
import type { EmbeddingProfile } from "../../../src/domain/profile";
import type { MemoryModel } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE as small, LARGE_EMBEDDING_PROFILE as large, assertSupportedEmbeddingProfile } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { ConvexMemoryRepository, createActionMemoryRepository, memoryScope } from "../../../convex-dev/runtimeMemoryRepository";
import type { DerivedCommit } from "../../../convex-dev/runtimeMemoryRepository";
import { deriveSourceVectors, explicitSourceLineage, recallMemory } from "../../../convex-dev/runtimeMemoryServices";
import { memoryFixture } from "./fixture";

async function setup() {
  let selected: EmbeddingProfile = small;
  const f = memoryFixture({ profile: () => selected });
  const repository = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db);
  const source = await prepareSourceContent(memoryScope(f.reference), explicitSourceLineage(memoryScope(f.reference), "profile-source"), "The launch code is ORCHID", { now: () => 1000 });
  await repository.putSource(source.source);
  async function payload(profile: EmbeddingProfile): Promise<DerivedCommit> {
    const identity = { sourceId: source.source.lineage.sourceId, sourceEventId: source.source.lineage.sourceEventId, sourceRevision: 1,
      stage: "vectors" as const, semanticPolicyVersion: profile.profileId };
    const receiptId = await processingIdentityKey(identity);
    return { source: { sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: 1 }, identity, chunks: source.chunks,
      vectors: source.chunks.map(chunk => ({ sourceId: chunk.sourceId, sourceEventId: chunk.sourceEventId, sourceRevision: 1,
        vectorId: `${chunk.chunkId}:${profile.profileId}`, chunkId: chunk.chunkId, tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId!,
        profile, embedding: Array.from({ length: profile.dimensions }, (_, index) => index === 0 ? 1 : 0), processingReceiptId: receiptId })) };
  }
  return { ...f, repository, source, payload, select: (profile: EmbeddingProfile) => { selected = profile; } };
}
describe("backend-selected profile generations", () => {
  it("keeps source and versioned logical chunks identical across the two models", async () => {
    const f = await setup();
    const other = await prepareSourceContent(memoryScope(f.reference), f.source.source.lineage, f.source.source.content, { now: () => 1000 }, large);
    expect(other).toEqual(f.source); expect(other.chunks[0]).not.toHaveProperty("profileId");
    expect(() => assertSupportedEmbeddingProfile({ ...small, modelId: "openai/another-1536-model" })).toThrow("CAPABILITY_UNSUPPORTED");
  });
  it("stores distinct1536/3072 generations in their dimension-specific index fields without relabeling", async () => {
    const f = await setup(); await f.repository.commitDerived(await f.payload(small)); f.select(large);
    await f.repository.commitDerived(await f.payload(large));
    expect(f.db.table("runtimeMemorySources")).toHaveLength(1); expect(f.db.table("runtimeMemoryChunks")).toHaveLength(1);
    const [s, l] = f.db.table("runtimeMemoryVectors");
    expect(s.embedding).toHaveLength(1536); expect(s).not.toHaveProperty("embeddingLarge");
    expect(l.embeddingLarge).toHaveLength(3072); expect(l).not.toHaveProperty("embedding");
    expect(s.profile).toEqual(small); expect(l.profile).toEqual(large);
    expect(f.db.table("runtimeMemoryVectorGenerations").map(row => row.profile)).toEqual([small, large]);
  });
  it("returns explicit readiness before a paid query when only incompatible authorized generations exist", async () => {
    const f = await setup(); await f.repository.commitDerived(await f.payload(small)); f.select(large);
    const embed = jest.fn<MemoryModel["embed"]>();
    const model: MemoryModel = { resolveProfile: async () => ({ profile: large }), embed,
      extract: async () => { throw new Error("unexpected extraction"); }, resolve: async () => { throw new Error("unexpected resolution"); } };
    await expect(recallMemory({ repository: createActionMemoryRepository(f.actionCtx, f.reference, "read"), model, clock: { now: () => 1000 } },
      { text: "launch code", requestId: "readiness", limit: 5 })).rejects.toMatchObject({ data: { code: "PROFILE_NOT_READY" } });
    expect(embed).not.toHaveBeenCalled(); expect(f.searches).toHaveLength(0);
  });
  it("an empty compatible space is a valid empty search; private incompatible neighbors do not affect readiness", async () => {
    const f = await setup(); await f.repository.commitDerived(await f.payload(small)); f.select(large);
    const generation = f.db.table("runtimeMemoryVectorGenerations")[0]!;
    generation.ownerPrincipalId = "private-peer";
    for (let index = 0; index < 1025; index++) f.db.seed("runtimeMemoryVectorGenerations", { ...generation, _id: `peer-${index}`, sourceId: `peer-source-${index}` });
    await expect(f.repository.assertProfileReady(large)).resolves.toBeUndefined();
    const hits = await createActionMemoryRepository(f.actionCtx, f.reference, "read").searchVectors({ text: "none", profile: large, embedding: Array(3072).fill(0) as number[] }, 5);
    expect(hits).toEqual([]); expect(f.searches[0].index).toBe("by_large_embedding_v1");
  });
  it("queries only selected large generation and hydrates its exact native provenance", async () => {
    const f = await setup(); await f.repository.commitDerived(await f.payload(small)); f.select(large); await f.repository.commitDerived(await f.payload(large));
    const hits = await createActionMemoryRepository(f.actionCtx, f.reference, "read").searchVectors({ text: "launch", profile: large, embedding: Array(3072).fill(0) as number[] }, 5);
    expect(hits).toHaveLength(1); expect(hits[0].vector.profile).toEqual(large); expect(hits[0].vector.embedding).toHaveLength(3072);
    expect(f.searches[0].filter.value).toContain(large.profileId);
  });
  it.each(["dimensions", "model", "index", "nan"])("rejects malformed or relabeled %s generation atomically", async kind => {
    const f = await setup(); f.select(large); const input = await f.payload(large); const vector = input.vectors![0]!;
    if (kind === "dimensions") vector.embedding = [1];
    if (kind === "model") vector.profile = { ...large, modelId: small.modelId };
    if (kind === "index") vector.profile = { ...large, indexName: small.indexName };
    if (kind === "nan") vector.embedding = [NaN, ...vector.embedding.slice(1)];
    const before = f.db.writes;
    await expect(f.db.transaction(() => f.repository.commitDerived(input))).rejects.toThrow();
    expect(f.db.writes).toBe(before); expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(0);
  });
  it("a policy switch rejects old receipts and post-search results rather than falling back", async () => {
    const f = await setup(); const input = await f.payload(small); await f.repository.commitDerived(input); f.select(large);
    await expect(f.repository.commitDerived(input)).rejects.toThrow("PROFILE_NOT_READY");
    await expect(f.repository.hydrateVectors([{ id: f.db.table("runtimeMemoryVectors")[0]!._id as never, score: 1 }], small)).rejects.toThrow("PROFILE_NOT_READY");
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(1);
  });
  it.each(["edit", "delete", "revoke"])("late %s excludes the formerly matching generation", async change => {
    const f = await setup(); f.select(large); await f.repository.commitDerived(await f.payload(large));
    if (change === "edit") (f.db.table("runtimeMemorySources")[0]!.lineage as { sourceRevision: number }).sourceRevision++;
    if (change === "delete") f.db.table("runtimeMemorySources")[0]!.tombstonedAt = 2000;
    if (change === "revoke") f.grant.revokedAt = 2000;
    const read = createActionMemoryRepository(f.actionCtx, f.reference, "read").searchVectors({ text: "launch", profile: large, embedding: Array(3072).fill(0) as number[] }, 5);
    if (change === "revoke") await expect(read).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); else expect(await read).toEqual([]);
  });
  it("single-source generation calls only selected embedding, keeps source/chunks, and returns no extracted facts", async () => {
    const f = await setup(); await f.repository.commitDerived(await f.payload(small)); f.select(large);
    const extract = jest.fn<MemoryModel["extract"]>(); const embed = jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile, vectors: request.texts.map(() => Array(3072).fill(0.1) as number[]) }));
    const model: MemoryModel = { resolveProfile: async () => ({ profile: large }), embed, extract, resolve: async () => { throw new Error("unexpected"); } };
    const result = await deriveSourceVectors({ repository: createActionMemoryRepository(f.actionCtx, f.reference, "write"), model, clock: { now: () => 1000 } },
      { sourceId: f.source.source.lineage.sourceId, requestId: "additional-generation" });
    expect(result.profile).toEqual(large); expect(extract).not.toHaveBeenCalled(); expect(embed).toHaveBeenCalledTimes(1);
    expect(f.db.table("runtimeMemorySources")).toHaveLength(1); expect(f.db.table("runtimeMemoryChunks")).toHaveLength(1);
    expect(f.db.table("facts")).toHaveLength(0);
  });
});
