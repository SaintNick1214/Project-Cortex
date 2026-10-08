import { describe, expect, it } from "@jest/globals";
import type { DerivedFact } from "../../../src/domain/contracts";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { ConvexMemoryRepository, createActionMemoryRepository, memoryScope, vectorOwnerScopeKey, vectorScopeKey } from "../../../convex-dev/runtimeMemoryRepository";
import type { DerivedCommit } from "../../../convex-dev/runtimeMemoryRepository";
import { explicitSourceLineage } from "../../../convex-dev/runtimeMemoryServices";
import { memoryFixture } from "./fixture";

async function setup() {
  const f = memoryFixture(); const scope = memoryScope(f.reference);
  const repository = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db, { now: () => 1000 });
  const lineage = explicitSourceLineage(scope, "repository-1");
  const prepared = await prepareSourceContent(scope, lineage, "I prefer dark mode", { now: () => 1000 });
  await repository.putSource(prepared.source);
  const source = { sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: 1 };
  const identity = { ...source, stage: "facts" as const, semanticPolicyVersion: "policy-v1" };
  const receiptId = await processingIdentityKey(identity);
  const fact: DerivedFact = { _id: "", factId: "fact-1", tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
    ownerPrincipalId: scope.principalId, lineage, extractionPolicyVersion: "policy-v1", fact: "User prefers dark mode",
    factType: "preference", confidence: 91, sourceType: "manual", tags: [], version: 1, createdAt: 1000, updatedAt: 1000 };
  const input: DerivedCommit = { source, identity, chunks: prepared.chunks, vectors: [{ ...source,
    vectorId: "vector-1", chunkId: prepared.chunks[0]!.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
    profile: DEFAULT_EMBEDDING_PROFILE, embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0), processingReceiptId: receiptId }],
    facts: [fact], expectedFactVersions: { "fact-1": 0 } };
  return { ...f, scope, repository, prepared, input, fact, receiptId };
}
const forbidden = { data: { code: "FORBIDDEN" } };
const invalid = { data: { code: "INVALID_INPUT" } };
describe("scoped Convex memory persistence", () => {
  it("selects actual canonical source in trusted tenant/space despite a foreign duplicate ID inserted first", async () => {
    const f = await setup(); f.db.table("runtimeMemorySources").unshift({ ...f.db.table("runtimeMemorySources")[0]!, _id: "foreign", tenantId: "tenant-b", content: "secret" });
    expect(await f.repository.getSource(f.prepared.source.lineage.sourceId)).toEqual(f.prepared.source);
  });
  it("checks actual normalized content SHA-256 rather than trusting supplied same-hash metadata", async () => {
    const f = await setup(); const before = f.db.writes;
    await expect(f.repository.putSource({ ...f.prepared.source, content: "other content" })).rejects.toMatchObject(invalid);
    expect(f.db.writes).toBe(before); expect(f.db.table("runtimeMemorySources")[0]!.content).toBe("I prefer dark mode");
  });
  it("rejects same-event aliases and cannot overwrite a canonical source on content hash collision", async () => {
    const f = await setup(); const changed = { ...f.prepared.source, lineage: { ...f.prepared.source.lineage, sourceId: "other-source" } };
    await expect(f.repository.putSource(changed)).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(f.db.table("runtimeMemorySources")).toHaveLength(1);
  });
  it.each(["tenantId", "memorySpaceId", "ownerPrincipalId"] as const)("rejects source %s forgery before writes", async (field) => {
    const f = await setup(); const before = f.db.writes;
    await expect(f.repository.putSource({ ...f.prepared.source, [field]: "foreign" })).rejects.toMatchObject(forbidden);
    expect(f.db.writes).toBe(before);
  });
  it("commits source-derived chunk/vector/fact and one receipt atomically and idempotently", async () => {
    const f = await setup(); expect(await f.repository.commitDerived(f.input)).toEqual({ receiptId: f.receiptId, created: true });
    expect(await f.repository.commitDerived(structuredClone(f.input))).toEqual({ receiptId: f.receiptId, created: false });
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1); expect(f.db.table("facts")).toHaveLength(1);
    expect(f.db.table("runtimeMemoryVectors")[0]).toMatchObject({ profileId: DEFAULT_EMBEDDING_PROFILE.profileId,
      scopeProfileKey: vectorScopeKey(f.scope.tenantId, f.scope.memorySpaceId, DEFAULT_EMBEDDING_PROFILE.profileId),
      scopeProfileOwnerKey: vectorOwnerScopeKey(f.scope.tenantId, f.scope.memorySpaceId, DEFAULT_EMBEDDING_PROFILE.profileId, f.scope.principalId) });
  });
  it("compares receipt canonical payload on reuse instead of accepting just its hash", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input);
    await expect(f.repository.commitDerived({ ...f.input, facts: [{ ...f.fact, confidence: 99 }] })).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(f.db.table("facts")[0]!.confidence).toBe(91);
  });
  it("rejects canonical identity collision when distinct source IDs share the receipt digest tuple", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input);
    const other = { ...f.prepared.source, lineage: { ...f.prepared.source.lineage, sourceId: "other-source" } };
    // Trusted-row corruption deliberately bypasses source-event uniqueness to exercise digest collision defense.
    f.db.seed("runtimeMemorySources", other);
    const input = { source: { ...f.input.source, sourceId: "other-source" }, identity: { ...f.input.identity, sourceId: "other-source" } };
    expect(await processingIdentityKey(input.identity)).toBe(f.receiptId);
    await expect(f.repository.commitDerived(input)).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1);
  });
  it.each(["sourceRevision", "sourceEventId"] as const)("rejects changed %s on a delayed commit", async (field) => {
    const f = await setup(); const source = f.db.table("runtimeMemorySources")[0]!;
    source.lineage = { ...(source.lineage as object), [field]: field === "sourceRevision" ? 2 : "later-event" };
    await expect(f.repository.commitDerived(f.input)).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    expect(f.db.table("facts")).toHaveLength(0); expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(0);
  });
  it.each(["row", "scoped-control", "tenant-control"])("fences source %s deletion before reads and commits", async (kind) => {
    const f = await setup();
    if (kind === "row") f.db.table("runtimeMemorySources")[0]!.tombstonedAt = 1001;
    else f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", ...(kind === "scoped-control" ? { memorySpaceId: "space-a" } : {}), resourceType: "source", resourceId: f.input.source.sourceId, deletedAt: 1001 });
    await expect(f.repository.getSource(f.input.source.sourceId)).rejects.toMatchObject(forbidden);
    await expect(f.repository.commitDerived(f.input)).rejects.toMatchObject(forbidden);
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(0);
  });
  it("checks every conflict candidate CAS and rolls back the full registered mutation on mismatch", async () => {
    const f = await setup(); f.db.seed("facts", { ...f.fact, factId: "candidate", version: 2 });
    const input = { ...f.input, expectedFactVersions: { "fact-1": 0, candidate: 1 } };
    await expect(createActionMemoryRepository(f.actionCtx, f.reference, "write").commitDerived(input)).rejects.toMatchObject({ data: { code: "FACT_VERSION_CONFLICT" } });
    expect(f.db.table("facts")).toHaveLength(1); expect(f.db.table("facts")[0]!.version).toBe(2);
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(0); expect(f.db.table("runtimeMemoryChunks")).toHaveLength(0);
    expect(f.db.table("runtimeMemoryVectors")).toHaveLength(0);
  });
  it("requires expected version for new and updated facts", async () => {
    const f = await setup(); await expect(f.repository.commitDerived({ ...f.input, expectedFactVersions: {} })).rejects.toMatchObject({ data: { code: "FACT_VERSION_CONFLICT" } });
    expect(f.db.table("facts")).toHaveLength(0);
  });
  it.each(["window", "hash", "profile", "duplicate"])("rejects noncanonical chunk %s before writes", async (kind) => {
    const f = await setup(); const chunk = f.prepared.chunks[0]!;
    const chunks = kind === "duplicate" ? [chunk, chunk] : [{ ...chunk, ...(kind === "window" ? { start: 9 } : kind === "hash" ? { textHash: await semanticHash("other") } : { profileId: "other" }) }];
    await expect(f.repository.commitDerived({ ...f.input, chunks })).rejects.toMatchObject(invalid);
    expect(f.db.table("runtimeMemoryChunks")).toHaveLength(0); expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(0);
  });
  it("rejects assistant-derived facts regardless of supplied fact role/trust", async () => {
    const f = await setup(); const source = f.db.table("runtimeMemorySources")[0]!;
    source.lineage = { ...f.prepared.source.lineage, role: "assistant", trust: "assistant_claim" };
    await expect(f.repository.commitDerived(f.input)).rejects.toMatchObject(invalid);
    expect(f.db.table("facts")).toHaveLength(0);
  });
  it("reads current facts from the authoritative store and excludes other owners/missing lineage/stale source", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input);
    f.db.table("facts").unshift({ ...f.db.table("facts")[0]!, _id: "foreign", tenantId: "tenant-b" });
    f.db.seed("facts", { ...f.fact, factId: "other-owner", ownerPrincipalId: "other-principal" });
    f.db.seed("facts", { ...f.fact, factId: "missing-lineage", lineage: undefined });
    f.db.seed("facts", { ...f.fact, factId: "stale", lineage: { ...f.fact.lineage, sourceRevision: 9 } });
    const facts = await f.repository.listFacts({ limit: 10 }); expect(facts.map((fact) => fact.factId)).toEqual(["fact-1"]);
  });
  it.each(["fact", "source"] as const)("excludes a tombstoned %s from derived recall", async (resourceType) => {
    const f = await setup(); await f.repository.commitDerived(f.input);
    f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType,
      resourceId: resourceType === "fact" ? "fact-1" : f.input.source.sourceId, deletedAt: 1001 });
    expect(await f.repository.listFacts({ limit: 10 })).toEqual([]);
    if (resourceType === "source") expect(await f.repository.hydrateVectors([{ id: f.db.table("runtimeMemoryVectors")[0]!._id as Id<"runtimeMemoryVectors">, score: 0.9 }])).toEqual([]);
  });
  it("uses injected clock for temporal validity", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input); f.db.table("facts")[0]!.validUntil = 999;
    expect(await f.repository.listFacts({ limit: 10 })).toEqual([]);
  });
  it.each(["revision", "profile", "owner", "tenant", "space", "missing-receipt"])("post-filters actual vector candidate with invalid %s", async (kind) => {
    const f = await setup(); await f.repository.commitDerived(f.input); const row = f.db.table("runtimeMemoryVectors")[0]!;
    if (kind === "revision") row.sourceRevision = 9;
    if (kind === "profile") row.profile = { ...DEFAULT_EMBEDDING_PROFILE, modelId: "another-model" };
    if (kind === "owner") row.ownerPrincipalId = "someone-else";
    if (kind === "tenant") row.tenantId = "tenant-b";
    if (kind === "space") row.memorySpaceId = "space-b";
    if (kind === "missing-receipt") row.processingReceiptId = "absent";
    expect(await f.repository.hydrateVectors([{ id: row._id as Id<"runtimeMemoryVectors">, score: 0.9 }])).toEqual([]);
  });
  it("exact vector prefilter prevents foreign tenant/profile/owner candidates consuming top-k slots", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input); const current = f.db.table("runtimeMemoryVectors")[0]!;
    f.db.table("runtimeMemoryVectors").unshift(
      { ...current, _id: "foreign-tenant", tenantId: "tenant-b", scopeProfileOwnerKey: vectorOwnerScopeKey("tenant-b", "space-a", DEFAULT_EMBEDDING_PROFILE.profileId, f.scope.principalId) },
      { ...current, _id: "foreign-profile", profileId: "other", scopeProfileOwnerKey: vectorOwnerScopeKey("tenant-a", "space-a", "other", f.scope.principalId) },
      { ...current, _id: "foreign-owner", ownerPrincipalId: "other", scopeProfileOwnerKey: vectorOwnerScopeKey("tenant-a", "space-a", DEFAULT_EMBEDDING_PROFILE.profileId, "other") },
    );
    const found = await createActionMemoryRepository(f.actionCtx, f.reference, "read").searchVectors({ text: "dark", profile: DEFAULT_EMBEDDING_PROFILE, embedding: f.input.vectors![0]!.embedding }, 1);
    expect(found).toHaveLength(1); expect(found[0]!.vector.vectorId).toBe("vector-1");
    expect(f.searches[0]!.filter.key).toBe("scopeProfileOwnerKey");
  });
  it("space-sharing uses exact scope/profile prefilter while retaining explicit owner checks", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input); f.grant.resourceAccess = "space";
    const found = await createActionMemoryRepository(f.actionCtx, f.reference, "read").searchVectors({ text: "dark", profile: DEFAULT_EMBEDDING_PROFILE, embedding: f.input.vectors![0]!.embedding }, 1);
    expect(found).toHaveLength(1); expect(f.searches[0]!.filter.key).toBe("scopeProfileKey");
  });
  it("rejects incompatible queries before search and revoked refs before any result", async () => {
    const f = await setup(); const adapter = createActionMemoryRepository(f.actionCtx, f.reference, "read");
    await expect(adapter.searchVectors({ text: "dark", profile: { ...DEFAULT_EMBEDDING_PROFILE, dimensions: 2 }, embedding: [1, 2] }, 1)).rejects.toThrow("PROFILE_NOT_READY");
    expect(f.searches).toHaveLength(0); f.grant.revokedAt = 1001;
    await expect(adapter.searchVectors({ text: "dark", profile: DEFAULT_EMBEDDING_PROFILE, embedding: f.input.vectors![0]!.embedding }, 1)).rejects.toMatchObject(forbidden);
    expect(f.searches).toHaveLength(0);
  });
});

describe("memory capability separation and bounded selection", () => {
  it("does not grant list/search read permission to a write-only repository", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input); f.grant.capabilities = ["write"];
    expect(await f.repository.getSource(f.input.source.sourceId)).toEqual(f.prepared.source);
    await expect(f.repository.listFacts({ limit: 1 })).rejects.toMatchObject(forbidden);
    const adapter = createActionMemoryRepository(f.actionCtx, f.reference, "write");
    await expect(adapter.listFacts({ limit: 1 })).rejects.toMatchObject(forbidden);
    await expect(adapter.searchVectors({ text: "dark", profile: DEFAULT_EMBEDDING_PROFILE, embedding: f.input.vectors![0]!.embedding }, 1)).rejects.toMatchObject(forbidden);
    await expect(f.repository.hydrateVectors([{ id: f.db.table("runtimeMemoryVectors")[0]!._id as Id<"runtimeMemoryVectors">, score: 0.9 }])).rejects.toMatchObject(forbidden);
    expect(f.searches).toHaveLength(0);
  });
  it("filters actual owner/subject/type before bounded take so unrelated rows cannot starve a narrow read", async () => {
    const f = await setup(); await f.repository.commitDerived(f.input);
    f.db.table("facts")[0]!.subject = "user-a";
    const base = f.db.table("facts")[0]!;
    f.db.table("facts").unshift(...Array.from({ length: 1025 }, (_, i) => ({ ...base, _id: `unrelated:${i}`,
      factId: `unrelated-${i}`, ownerPrincipalId: i < 500 ? "foreign-owner" : f.scope.principalId,
      subject: i < 1000 ? "other-subject" : "user-a", factType: "knowledge" })));
    expect((await f.repository.listFacts({ subject: "user-a", factType: "preference", limit: 1 })).map((fact) => fact.factId)).toEqual(["fact-1"]);
  });
});
