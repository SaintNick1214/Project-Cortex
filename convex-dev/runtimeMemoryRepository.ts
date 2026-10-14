import { deliveryExpiresAt } from "./runtimeDelivery";
/** Scoped Convex adapters. Every sensitive operation reloads the persisted grant. */
import { ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { RuntimeAuthority, RuntimeAuthorityReference, RuntimeResource } from "../src/auth/verified";
import type { DerivedFact, DerivedVector, MemoryRepository, ProfiledQuery, SourceChunk, SourceContent, TrustedMemoryScope, VectorMatch } from "../src/domain/contracts";
import type { DomainClock } from "../src/domain/clock";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE, assertSupportedEmbeddingProfile, assertEmbeddingVector, assertProfileMatches, normalizeSourceText, semanticHash } from "../src/domain/profile";
import { assertSourceLineage, isCurrentAuthorizedVector, prepareSourceContent, processingIdentityKey } from "../src/domain/sources";
import { assertResourceScope, createAuthorityReader, recheckAuthority } from "./runtimeAuth";
import { managedSourceIsCurrent } from "./runtimeDataAuth";
import type { EmbeddingProfile } from "../src/domain/profile";
import type { ContextSourcePermission } from "../src/domain/context-witness";
import { enqueueFactProjection } from "./runtimeGraph";

export type DerivedCommit = Parameters<MemoryRepository["commitDerived"]>[0];
export type FactQuery = Parameters<MemoryRepository["listFacts"]>[0];
type ScopedArgs = { reference: RuntimeAuthorityReference; capability: "read" | "write" };
export interface RecallFactBindings { facts: DerivedFact[]; bindings: MemoryDeliveryBindings }
export interface MemoryDeliveryBindings {
  sources: { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string;
    ownerPrincipalId: string; permission: "canViewFacts" | "canViewMemories" }[];
  facts: { factId: string; payloadHash: string }[];
  vectors: { vectorId: string; profile: EmbeddingProfile; payloadHash: string; chunkHash: string; runBudgetId?: string }[];
}

/** Explicit references to actual internal registrations; replace by codegen after installation. */
function internalQueryRef<Args extends Record<string, unknown>, Result>(name: string) {
  return makeFunctionReference<"query", Args, Result>(name) as unknown as FunctionReference<"query", "internal", Args, Result>;
}
function internalMutationRef<Args extends Record<string, unknown>, Result>(name: string) {
  return makeFunctionReference<"mutation", Args, Result>(name) as unknown as FunctionReference<"mutation", "internal", Args, Result>;
}
export const memoryReferences = {
  recheck: internalQueryRef<ScopedArgs, RuntimeAuthority>("runtimeMemory:checkAuthority"),
  getSource: internalQueryRef<ScopedArgs & { sourceId: string }, SourceContent | null>("runtimeMemory:readSource"),
  putSource: internalMutationRef<ScopedArgs & { source: SourceContent }, { source: SourceContent; created: boolean }>("runtimeMemory:writeSource"),
  commitDerived: internalMutationRef<ScopedArgs & { input: DerivedCommit }, { receiptId: string; created: boolean }>("runtimeMemory:writeDerived"),
  listFacts: internalQueryRef<ScopedArgs & { query: FactQuery }, DerivedFact[]>("runtimeMemory:readFacts"),
  profile: internalQueryRef<{ reference: RuntimeAuthorityReference; operationKey: "embedding.memory" | "embedding.query"; runBudgetId?: string }, EmbeddingProfile>("runtimeModelPolicy:embeddingProfile"),
  profileReady: internalQueryRef<ScopedArgs & { profile: EmbeddingProfile; runBudgetId?: string }, null>("runtimeMemory:checkProfileReady"),
  hydrateVectors: internalQueryRef<ScopedArgs & { profile: EmbeddingProfile; runBudgetId?: string; hits: { id: Id<"runtimeMemoryVectors">; score: number }[] }, VectorMatch[]>("runtimeMemory:readVectorMatches"),
  listBoundFacts: internalQueryRef<ScopedArgs & { query: FactQuery; includeBindings: true }, RecallFactBindings>("runtimeMemory:readFacts"),
  finalDelivery: internalMutationRef<{ reference: RuntimeAuthorityReference; bindings: MemoryDeliveryBindings }, { version: 1; deliveryExpiresAt?: number }>("runtimeMemory:finalDelivery"),
};

export function memoryError(code: string, message: string): never {
  throw new ConvexError({ version: 1, code, message, retryable: false, outcome: "not_dispatched" });
}
/** Only a native resource denial is eligible for read-list exclusion. */
export function isMemoryResourceDenied(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const data = Object.getOwnPropertyDescriptor(error, "data");
  return Boolean(data && "value" in data && data.value !== null && typeof data.value === "object"
    && Object.getOwnPropertyDescriptor(data.value, "code")?.value === "FORBIDDEN");
}
export function memoryScope(reference: RuntimeAuthorityReference): TrustedMemoryScope {
  if (!reference.memorySpaceId || !Number.isSafeInteger(reference.memorySpaceEpoch) || reference.memorySpaceEpoch! < 1) {
    memoryError("FORBIDDEN", "A concrete authorized memory space is required");
  }
  return { ...reference, memorySpaceId: reference.memorySpaceId, memorySpaceEpoch: reference.memorySpaceEpoch! };
}
function boundedLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) memoryError("INVALID_INPUT", "Limit must be between 1 and 100");
}
function sameReference(a: SourceContent["lineage"], b: DerivedCommit["source"]): boolean {
  return a.sourceId === b.sourceId && a.sourceEventId === b.sourceEventId && a.sourceRevision === b.sourceRevision;
}
/** Stable object-key order, exact array order and exact values; hashes never replace equality. */
export function canonicalMemoryValue(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalMemoryValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalMemoryValue(record[key])}`).join(",")}}`;
}
function stripSystem<T extends { _id: string; _creationTime: number }>(row: T): Omit<T, "_id" | "_creationTime"> {
  const { _id: _id, _creationTime: _creationTime, ...value } = row;
  return value;
}
function sourceResource(source: SourceContent): RuntimeResource {
  return { resourceType: "source", resourceId: source.lineage.sourceId, tenantId: source.tenantId,
    memorySpaceId: source.memorySpaceId, ownerPrincipalId: source.ownerPrincipalId };
}
function conflict(message: string): never { return memoryError("IDEMPOTENCY_CONFLICT", message); }
export function vectorScopeKey(tenantId: string, memorySpaceId: string, profileId: string): string {
  return JSON.stringify([tenantId, memorySpaceId, profileId]);
}
export function vectorOwnerScopeKey(tenantId: string, memorySpaceId: string, profileId: string, principalId: string): string {
  return JSON.stringify([tenantId, memorySpaceId, profileId, principalId]);
}

/** Query/mutation adapter. Only a real mutation ctx can write. */
export class ConvexMemoryRepository {
  readonly scope: TrustedMemoryScope;
  constructor(private readonly ctx: Pick<QueryCtx, "db"> & Partial<Pick<QueryCtx, "runQuery">> & Partial<Pick<MutationCtx, "scheduler">>, private readonly reference: RuntimeAuthorityReference,
    private readonly capability: "read" | "write", private readonly writer?: MutationCtx["db"],
    private readonly clock: DomainClock = { now: () => Date.now() },
    private readonly profileReader?: (key: "embedding.memory" | "embedding.query", runBudgetId?: string) => Promise<EmbeddingProfile>) {
    this.scope = memoryScope(reference);
  }
  async authority(resource?: RuntimeResource, capability = this.capability): Promise<RuntimeAuthority> {
    return await recheckAuthority(this.ctx, this.reference, { capability,
      tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId, ...(resource ? { resource } : {}) });
  }
  async recheckAuthority(): Promise<void> { await this.authority(); }
  async assertReadAuthority(): Promise<void> { await this.authority(undefined, "read"); }
  private writeDb(): MutationCtx["db"] {
    if (!this.writer || this.capability !== "write") memoryError("FORBIDDEN", "A write-authorized mutation is required");
    return this.writer;
  }
  async getSource(sourceId: string, permission?: ContextSourcePermission, deadlines?: number[]): Promise<SourceContent | null> {
    await this.authority();
    const row = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
    if (!row) return null;
    const source = stripSystem(row);
    await this.authority(sourceResource(source));
    if (source.tombstonedAt !== undefined || !await managedSourceIsCurrent(this.ctx, this.reference, row, this.capability, permission, deadlines)) memoryError("FORBIDDEN", "Source was deleted or access was revoked");
    return source;
  }
  async putSource(source: SourceContent): Promise<{ source: SourceContent; created: boolean }> {
    const db = this.writeDb();
    await this.authority(sourceResource(source));
    assertSourceLineage(source.lineage);
    if (source.ownerPrincipalId !== this.scope.principalId || source.tombstonedAt !== undefined
      || normalizeSourceText(source.content) !== source.content || await semanticHash(source.content) !== source.contentHash
      || !Number.isFinite(source.createdAt) || source.createdAt < 0 || source.createdAt > 8.64e15) {
      memoryError("INVALID_INPUT", "Source must have canonical content, hash, attribution and owner");
    }
    const existing = await this.getSource(source.lineage.sourceId);
    if (existing) {
      // The initial persisted timestamp remains authoritative on request replay.
      if (canonicalMemoryValue({ ...source, createdAt: existing.createdAt }) !== canonicalMemoryValue(existing)) conflict("Source identity was reused with different content or attribution");
      return { source: existing, created: false };
    }
    const event = await db.query("runtimeMemorySources").withIndex("by_scope_event", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceEventId", source.lineage.sourceEventId)).unique();
    if (event) conflict("Source event already belongs to another canonical source");
    await db.insert("runtimeMemorySources", source);
    return { source, created: true };
  }
  async selectedProfile(key: "embedding.memory" | "embedding.query", runBudgetId?: string): Promise<EmbeddingProfile> {
    if (this.profileReader) return await this.profileReader(key, runBudgetId);
    if (!this.ctx.runQuery) memoryError("POLICY_NOT_CONFIGURED", "Native profile policy reader is required");
    return this.ctx.runQuery(memoryReferences.profile, { reference: this.reference, operationKey: key, ...(runBudgetId ? { runBudgetId } : {}) });
  }
  /** Bounded metadata scan, never the dimension-sized vector bodies. */
  async assertProfileReady(profile: EmbeddingProfile, runBudgetId?: string): Promise<void> {
    assertSupportedEmbeddingProfile(profile);
    assertProfileMatches(profile, await this.selectedProfile("embedding.query", runBudgetId));
    const authority = await this.authority(undefined, "read");
    const selected = authority.resourceAccess === "own"
      ? this.ctx.db.query("runtimeMemoryVectorGenerations").withIndex("by_owner", q => q.eq("tenantId", this.scope.tenantId)
        .eq("memorySpaceId", this.scope.memorySpaceId).eq("ownerPrincipalId", authority.principalId))
      : this.ctx.db.query("runtimeMemoryVectorGenerations").withIndex("by_scope", q => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId));
    const generations = await selected.take(1025);
    if (generations.length > 1024) memoryError("QUERY_TOO_BROAD", "Profile readiness exceeds bounded metadata scan");
    let incompatible = false;
    for (const generation of generations) {
      if (authority.resourceAccess === "own" && generation.ownerPrincipalId !== authority.principalId) continue;
      const source = await this.visibleSource(generation.sourceId, authority, "canViewMemories");
      if (!source || !sameReference(source.lineage, generation) || source.contentHash !== generation.contentHash) continue;
      if (canonicalMemoryValue(generation.profile) === canonicalMemoryValue(profile)) return;
      incompatible = true;
    }
    if (incompatible) memoryError("PROFILE_NOT_READY", "Current sources have no compatible vector generation for the selected profile");
  }
  async commitDerived(input: DerivedCommit): Promise<{ receiptId: string; created: boolean }> {
    const db = this.writeDb();
    const source = await this.getSource(input.source.sourceId);
    if (!source || !sameReference(source.lineage, input.source) || !sameReference(source.lineage, input.identity)) {
      memoryError("STALE_SOURCE", "Source event/revision is no longer current");
    }
    const profile = input.vectors?.length ? await this.selectedProfile("embedding.memory", input.embeddingRunBudgetId) : DEFAULT_EMBEDDING_PROFILE;
    for (const vector of input.vectors ?? []) assertProfileMatches(vector.profile, profile);
    const receiptId = await processingIdentityKey(input.identity);
    const canonicalIdentity = canonicalMemoryValue(input.identity);
    const canonicalPayload = canonicalMemoryValue(input);
    const receipt = await db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("receiptId", receiptId)).unique();
    if (receipt) {
      if (receipt.canonicalIdentity !== canonicalIdentity || receipt.canonicalPayload !== canonicalPayload) conflict("Processing receipt identity/hash was reused with a different canonical payload");
      return { receiptId, created: false };
    }
    const prepared = await prepareSourceContent(this.scope, source.lineage, source.content, { now: () => source.createdAt }, profile);
    const expectedChunks = new Map(prepared.chunks.map((chunk) => [chunk.chunkId, chunk]));
    const chunks = new Map<string, SourceChunk>();
    for (const chunk of input.chunks ?? []) {
      if (chunks.has(chunk.chunkId) || canonicalMemoryValue(chunk) !== canonicalMemoryValue(expectedChunks.get(chunk.chunkId))) memoryError("INVALID_INPUT", "Chunk does not match canonical source/profile/window");
      chunks.set(chunk.chunkId, chunk);
    }
    const vectorIds = new Set<string>();
    for (const vector of input.vectors ?? []) {
      assertSupportedEmbeddingProfile(vector.profile); assertProfileMatches(vector.profile, profile);
      assertEmbeddingVector(vector.embedding, profile);
      const chunk = chunks.get(vector.chunkId) ?? await this.findChunk(vector.chunkId);
      if (vectorIds.has(vector.vectorId) || vector.processingReceiptId !== receiptId || !chunk
        || !isCurrentAuthorizedVector(vector, source, chunk, this.scope, profile)) memoryError("INVALID_INPUT", "Vector has invalid provenance or duplicate identity");
      vectorIds.add(vector.vectorId);
    }
    const factIds = new Set<string>();
    const factRows = new Map<string, Doc<"facts"> | null>();
    // Every read version used by conflict resolution is fenced, even a candidate not rewritten.
    for (const [factId, expected] of Object.entries(input.expectedFactVersions ?? {})) {
      if (!Number.isSafeInteger(expected) || expected < 0) memoryError("INVALID_INPUT", "Expected fact versions must be nonnegative integers");
      const existing = await db.query("facts").withIndex("by_runtime_scope_factId", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("factId", factId)).unique();
      if (expected !== (existing?.version ?? 0)) memoryError("FACT_VERSION_CONFLICT", "A resolution candidate changed before commit");
      if (existing) {
        await this.authority({ resourceType: "fact", resourceId: existing.factId, tenantId: existing.tenantId,
          memorySpaceId: existing.memorySpaceId, ownerPrincipalId: existing.ownerPrincipalId });
        if (existing.tombstonedAt !== undefined) memoryError("FORBIDDEN", "Resolution candidate was deleted");
      }
    }
    for (const fact of input.facts ?? []) {
      if (factIds.has(fact.factId) || fact.ownerPrincipalId !== source.ownerPrincipalId
        || fact.tenantId !== source.tenantId || fact.memorySpaceId !== source.memorySpaceId
        || canonicalMemoryValue(fact.lineage) !== canonicalMemoryValue(source.lineage)
        || source.lineage.role === "assistant" || !fact.extractionPolicyVersion.trim()
        || !Number.isFinite(fact.confidence) || fact.confidence < 0 || fact.confidence > 100
        || !fact.fact.trim() || !Number.isSafeInteger(fact.version) || fact.version < 1) memoryError("INVALID_INPUT", "Invalid attributed fact");
      factIds.add(fact.factId);
      await this.authority({ resourceType: "fact", resourceId: fact.factId, tenantId: fact.tenantId,
        memorySpaceId: fact.memorySpaceId, ownerPrincipalId: fact.ownerPrincipalId });
      const existing = await db.query("facts").withIndex("by_runtime_scope_factId", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("factId", fact.factId)).unique();
      if (existing) {
        if (!existing.ownerPrincipalId || existing.tombstonedAt !== undefined) memoryError("FORBIDDEN", "Fact has no current runtime owner");
        await this.authority({ resourceType: "fact", resourceId: existing.factId, tenantId: existing.tenantId,
          memorySpaceId: existing.memorySpaceId, ownerPrincipalId: existing.ownerPrincipalId });
      }
      const expected = input.expectedFactVersions?.[fact.factId];
      if (expected === undefined || !Number.isSafeInteger(expected) || expected < 0
        || expected !== (existing?.version ?? 0) || fact.version !== expected + 1) memoryError("FACT_VERSION_CONFLICT", "Fact commit must compare the current version");
      factRows.set(fact.factId, existing);
    }
    // Complete all validation before writes; Convex additionally rolls back the whole mutation.
    for (const chunk of chunks.values()) {
      const existing = await this.findChunk(chunk.chunkId);
      if (existing && canonicalMemoryValue(existing) !== canonicalMemoryValue(chunk)) conflict("Chunk identity collision");
    }
    for (const vector of input.vectors ?? []) {
      const existing = await db.query("runtimeMemoryVectors").withIndex("by_scope_vector", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("vectorId", vector.vectorId)).unique();
      if (existing && canonicalMemoryValue(stripVector(existing)) !== canonicalMemoryValue(vector)) conflict("Vector identity collision");
    }
    await this.authority(sourceResource(source));
    await db.insert("runtimeMemoryReceipts", { tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId,
      receiptId, identity: input.identity, canonicalIdentity, canonicalPayload, createdAt: source.createdAt });
    for (const chunk of chunks.values()) if (!await this.findChunk(chunk.chunkId)) await db.insert("runtimeMemoryChunks", chunk);
    for (const vector of input.vectors ?? []) {
      const existing = await db.query("runtimeMemoryVectors").withIndex("by_scope_vector", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("vectorId", vector.vectorId)).unique();
      const { embedding, ...metadata } = vector;
      if (!existing) await db.insert("runtimeMemoryVectors", { ...metadata,
        ...(profile.profileId === LARGE_EMBEDDING_PROFILE.profileId ? { embeddingLarge: [...embedding] } : { embedding: [...embedding] }), profileId: vector.profile.profileId,
        scopeProfileKey: vectorScopeKey(vector.tenantId, vector.memorySpaceId, vector.profile.profileId),
        ownerPrincipalId: source.ownerPrincipalId,
        scopeProfileOwnerKey: vectorOwnerScopeKey(vector.tenantId, vector.memorySpaceId, vector.profile.profileId, source.ownerPrincipalId) });
    }
    if (input.vectors?.length) {
      const previous = await db.query("runtimeMemoryVectorGenerations").withIndex("by_scope_profile_source", q =>
        q.eq("tenantId", source.tenantId).eq("memorySpaceId", source.memorySpaceId).eq("profile.profileId", profile.profileId)
          .eq("sourceId", source.lineage.sourceId).eq("sourceRevision", source.lineage.sourceRevision)).unique();
      const generation = { tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, ownerPrincipalId: source.ownerPrincipalId,
        ...input.source, contentHash: source.contentHash, profile, receiptId };
      if (previous && canonicalMemoryValue({ ...stripSystem(previous), receiptId }) !== canonicalMemoryValue(generation)) conflict("Vector generation identity collision");
      if (!previous) await db.insert("runtimeMemoryVectorGenerations", generation);
    }
    for (const fact of input.facts ?? []) {
      const { _id: _id, ...fields } = fact;
      const existing = factRows.get(fact.factId);
      const record = { ...fields, processingReceiptId: receiptId };
      if (existing) await db.replace("facts", existing._id, record);
      else await db.insert("facts", record);
    }
    await enqueueFactProjection({ ...this.ctx, db }, this.reference, source.lineage.sourceId, input.vectors?.length ? profile : undefined);
    return { receiptId, created: true };
  }
  private async findChunk(chunkId: string): Promise<SourceChunk | null> {
    const row = await this.ctx.db.query("runtimeMemoryChunks").withIndex("by_scope_chunk", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("chunkId", chunkId)).unique();
    return row ? stripSystem(row) : null;
  }
  /** Derived rows whose source was deleted/changed are excluded; grant denial still throws. */
  private async visibleSource(sourceId: string, authority: RuntimeAuthority, permission: "canViewFacts" | "canViewMemories", deadlines?: number[]): Promise<SourceContent | null> {
    const row = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
    if (!row || row.tombstonedAt !== undefined || (authority.resourceAccess === "own" && row.ownerPrincipalId !== authority.principalId)) return null;
    const reader = createAuthorityReader(this.ctx);
    if (await reader.hasTombstone({ tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId, resourceType: "source", resourceId: sourceId })
      || await reader.hasTombstone({ tenantId: this.scope.tenantId, resourceType: "source", resourceId: sourceId })) return null;
    const source = stripSystem(row);
    try {
      if (!await managedSourceIsCurrent(this.ctx, this.reference, row, "read", permission, deadlines)) return null;
      await this.authority(sourceResource(source), "read");
    } catch (error) {
      if (!isMemoryResourceDenied(error)) throw error;
      // A private neighbor is excluded; revoking the reader's grant still denies the whole read.
      await this.authority(undefined, "read"); return null;
    }
    return source;
  }
  async listFacts(query: FactQuery): Promise<DerivedFact[]> {
    boundedLimit(query.limit);
    const authority = await this.authority(undefined, "read");
    const rows = await this.ctx.db.query("facts").withIndex("by_tenant_space", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId))
      .filter((q) => q.and(
        ...(authority.resourceAccess === "own" ? [q.eq(q.field("ownerPrincipalId"), authority.principalId)] : []),
        ...(query.subject !== undefined ? [q.eq(q.field("subject"), query.subject)] : []),
        ...(query.factType !== undefined ? [q.eq(q.field("factType"), query.factType)] : []),
      )).take(1025);
    if (rows.length > 1024) memoryError("QUERY_TOO_BROAD", "Fact scope exceeds bounded scan; narrower indexed selection is required");
    const facts: DerivedFact[] = [];
    const reader = createAuthorityReader(this.ctx);
    for (const row of rows) {
      if (!row.ownerPrincipalId || !row.lineage || !row.extractionPolicyVersion || row.tombstonedAt !== undefined
        || row.supersededBy || (row.validUntil !== undefined && row.validUntil <= this.clock.now())
        || (query.subject !== undefined && row.subject !== query.subject)
        || (query.factType !== undefined && row.factType !== query.factType)
        || (authority.resourceAccess === "own" && row.ownerPrincipalId !== authority.principalId)) continue;
      assertResourceScope(authority, { resourceType: "fact", resourceId: row.factId, tenantId: row.tenantId,
        memorySpaceId: row.memorySpaceId, ownerPrincipalId: row.ownerPrincipalId });
      if (await reader.hasTombstone({ tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId, resourceType: "fact", resourceId: row.factId })
        || await reader.hasTombstone({ tenantId: this.scope.tenantId, resourceType: "fact", resourceId: row.factId })) continue;
      const source = await this.visibleSource(row.lineage.sourceId, authority, "canViewFacts");
      if (!source || !sameReference(source.lineage, row.lineage) || source.ownerPrincipalId !== row.ownerPrincipalId
        || row.lineage.role === "assistant" || canonicalMemoryValue(row.lineage) !== canonicalMemoryValue(source.lineage)) continue;
      const { _creationTime: _creationTime, tombstonedAt: _tombstonedAt, processingReceiptId: _receipt,
        lineage, ownerPrincipalId, extractionPolicyVersion, ...record } = row;
      // fact-extraction is an old schema-only source type; fresh runtime writes use manual/tool.
      if (record.sourceType === "fact-extraction") continue;
      const sourceType = record.sourceType;
      facts.push({ ...record, sourceType, lineage, ownerPrincipalId, extractionPolicyVersion });
      if (facts.length === query.limit) break;
    }
    return facts;
  }
  /** Bounded exact consumed-row checks; this method is registered only as an internal mutation. */
  async checkDelivery(bindings: MemoryDeliveryBindings, finalAuthorityCtx: Pick<QueryCtx, "db"> = this.ctx): Promise<{ version: 1; deliveryExpiresAt?: number }> {
    // Recall admits 100 facts and 100 vectors, plus its one-fact preflight.
    if (bindings.sources.length > 201 || bindings.facts.length > 101 || bindings.vectors.length > 100
      || new TextEncoder().encode(canonicalMemoryValue(bindings)).byteLength > 262144) memoryError("INVALID_INPUT", "Recall delivery bindings exceed the bounded envelope");
    const deadlines: number[] = []; await this.authority(undefined, "read");
    for (const expected of bindings.sources) {
      const current = await this.getSource(expected.sourceId, expected.permission, deadlines);
      if (!current || !sameReference(current.lineage, expected) || current.contentHash !== expected.contentHash
        || current.ownerPrincipalId !== expected.ownerPrincipalId) memoryError("STALE_SOURCE", "Consumed recall source changed before delivery");
    }
    for (const expected of bindings.facts) {
      const row = await this.ctx.db.query("facts").withIndex("by_runtime_scope_factId", q =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("factId", expected.factId)).unique();
      if (!row?.ownerPrincipalId || !row.lineage || !row.extractionPolicyVersion || row.tombstonedAt !== undefined
        || row.supersededBy || row.sourceType === "fact-extraction" || (row.validUntil !== undefined && row.validUntil <= this.clock.now())) {
        memoryError("STALE_SOURCE", "Consumed recall fact is no longer current");
      }
      await this.authority({ resourceType: "fact", resourceId: row.factId, tenantId: row.tenantId,
        memorySpaceId: row.memorySpaceId, ownerPrincipalId: row.ownerPrincipalId }, "read");
      if (row.validUntil !== undefined) deadlines.push(row.validUntil);
      const source = await this.getSource(row.lineage.sourceId, "canViewFacts", deadlines);
      if (!source || source.ownerPrincipalId !== row.ownerPrincipalId || source.lineage.role === "assistant"
        || canonicalMemoryValue(source.lineage) !== canonicalMemoryValue(row.lineage)) memoryError("STALE_SOURCE", "Consumed recall fact lost source attribution");
      const { _creationTime: _creationTime, tombstonedAt: _tombstone, processingReceiptId: _receipt, ...payload } = row;
      if (await semanticHash(canonicalMemoryValue(payload)) !== expected.payloadHash) memoryError("STALE_SOURCE", "Consumed recall fact changed before delivery");
    }
    // This invocation runs in one finalDelivery mutation snapshot. Retain vector
    // order and per-resource authority reads; only identical profile/budget
    // initialization is shared, after the original canonical row lookup.
    const checkedProfiles = new Set<string>();
    for (const expected of bindings.vectors) {
      const row = await this.ctx.db.query("runtimeMemoryVectors").withIndex("by_scope_vector", q =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("vectorId", expected.vectorId)).unique();
      let matches: VectorMatch[] = [];
      if (row) {
        const profileKey = canonicalMemoryValue([expected.profile, expected.runBudgetId]);
        if (!checkedProfiles.has(profileKey)) {
          assertProfileMatches(expected.profile, await this.selectedProfile("embedding.query", expected.runBudgetId));
          checkedProfiles.add(profileKey);
        }
        const authority = await this.authority(undefined, "read");
        matches = await this.hydrateVectorCandidates([{ id: row._id, score: 0 }], expected.profile, authority, deadlines);
      }
      const match = matches[0];
      if (!match || await semanticHash(canonicalMemoryValue(match.vector)) !== expected.payloadHash
        || await semanticHash(canonicalMemoryValue(match.chunk)) !== expected.chunkHash) memoryError("STALE_SOURCE", "Consumed recall vector changed before delivery");
    }
    // Retain consumed share/source deadlines through the final authority awaits.
    const expiresAt = await deliveryExpiresAt(finalAuthorityCtx, this.reference, deadlines);
    return { version: 1, ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
  }
  async hydrateVectors(hits: { id: Id<"runtimeMemoryVectors">; score: number }[], profile: EmbeddingProfile = DEFAULT_EMBEDDING_PROFILE, runBudgetId?: string, deadlines?: number[]): Promise<VectorMatch[]> {
    if (hits.length > 100) memoryError("INVALID_INPUT", "Too many vector candidates");
    assertProfileMatches(profile, await this.selectedProfile("embedding.query", runBudgetId));
    const authority = await this.authority(undefined, "read");
    return this.hydrateVectorCandidates(hits, profile, authority, deadlines);
  }
  /** Callers validate current profile/budget and read authority in their own snapshot. */
  private async hydrateVectorCandidates(hits: { id: Id<"runtimeMemoryVectors">; score: number }[], profile: EmbeddingProfile,
    authority: RuntimeAuthority, deadlines?: number[]): Promise<VectorMatch[]> {
    const matches: VectorMatch[] = [];
    for (const hit of hits) {
      const row = await this.ctx.db.get("runtimeMemoryVectors", hit.id);
      if (!row || row.tenantId !== this.scope.tenantId || row.memorySpaceId !== this.scope.memorySpaceId
        || row.profileId !== profile.profileId || canonicalMemoryValue(row.profile) !== canonicalMemoryValue(profile) || !Number.isFinite(hit.score)) continue;
      const sourceRow = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", row.sourceId)).unique();
      if (!sourceRow || sourceRow.tombstonedAt !== undefined || row.ownerPrincipalId !== sourceRow.ownerPrincipalId
        || (authority.resourceAccess === "own" && sourceRow.ownerPrincipalId !== authority.principalId)) continue;
      const source = await this.visibleSource(row.sourceId, authority, "canViewMemories", deadlines);
      const chunk = await this.findChunk(row.chunkId);
      const vector = stripVector(row);
      const receipt = await this.ctx.db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("receiptId", vector.processingReceiptId)).unique();
      if (!source || !chunk || !receipt || !sameReference(source.lineage, receipt.identity)) continue;
      try {
        if (isCurrentAuthorizedVector(vector, source, chunk, this.scope, profile)) matches.push({ vector, source, chunk, score: hit.score });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("PROFILE_NOT_READY:")) throw error;
      }
    }
    return matches;
  }
}
function stripVector(row: Doc<"runtimeMemoryVectors">): DerivedVector {
  const { profileId: _profileId, scopeProfileKey: _scopeProfileKey, ownerPrincipalId: _owner,
    scopeProfileOwnerKey: _ownerKey, embedding, embeddingLarge, ...vector } = stripSystem(row);
  assertSupportedEmbeddingProfile(vector.profile);
  const values = vector.profile.profileId === LARGE_EMBEDDING_PROFILE.profileId ? embeddingLarge : embedding;
  if (!values || (embedding !== undefined && embeddingLarge !== undefined)) memoryError("INVALID_INPUT", "Vector storage field does not match its exact profile");
  return { ...vector, embedding: values };
}

/** Action reads/mutations cross ctx through internal registrations, never a ConvexClient. */
/** Original recall binding capture; no authority decision or persistent cache. */
export function captureRecallSource(target: MemoryDeliveryBindings, source: SourceContent, permission: "canViewFacts" | "canViewMemories") {
    const next = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId,
      sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash, ownerPrincipalId: source.ownerPrincipalId, permission };
    if (!target.sources.some(value => canonicalMemoryValue(value) === canonicalMemoryValue(next))) target.sources.push(next);
}
export async function captureRecallFact(target: MemoryDeliveryBindings, fact: DerivedFact, source: SourceContent | null) {
  if (!source || !sameReference(source.lineage, fact.lineage) || canonicalMemoryValue(source.lineage) !== canonicalMemoryValue(fact.lineage)
    || source.ownerPrincipalId !== fact.ownerPrincipalId) memoryError("STALE_SOURCE", "Recalled fact source changed during read");
  captureRecallSource(target, source, "canViewFacts");
  const next = { factId: fact.factId, payloadHash: await semanticHash(canonicalMemoryValue(fact)) };
  if (!target.facts.some(value => value.factId === next.factId && value.payloadHash === next.payloadHash)) target.facts.push(next);
}
export async function captureRecallVectors(target: MemoryDeliveryBindings, matches: readonly VectorMatch[], profile: EmbeddingProfile, pin: { runBudgetId?: string }) {
  for (const match of matches) {
    captureRecallSource(target, match.source, "canViewMemories");
    target.vectors.push({ vectorId: match.vector.vectorId, profile, ...pin,
      payloadHash: await semanticHash(canonicalMemoryValue(match.vector)), chunkHash: await semanticHash(canonicalMemoryValue(match.chunk)) });
  }
}
export function createActionMemoryRepository(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation" | "vectorSearch">,
  reference: RuntimeAuthorityReference, capability: "read" | "write", options?: { boundRecallFacts: true },
): MemoryRepository & Required<Pick<MemoryRepository, "stageRecallReads">> {
  const scope = memoryScope(reference);
  const args = { reference, capability };
  const bindings: MemoryDeliveryBindings = { sources: [], facts: [], vectors: [] };
  const listFacts = async (query: FactQuery, target: MemoryDeliveryBindings) => {
    // Explicit public-recall native composition only; old/injected adapters
    // retain their original independently guarded per-source RPCs.
    if (options?.boundRecallFacts) {
      const result = await ctx.runQuery(memoryReferences.listBoundFacts, { ...args, capability: "read", query, includeBindings: true });
      for (const source of result.bindings.sources) if (!target.sources.some(value => canonicalMemoryValue(value) === canonicalMemoryValue(source))) target.sources.push(source);
      for (const fact of result.bindings.facts) if (!target.facts.some(value => value.factId === fact.factId && value.payloadHash === fact.payloadHash)) target.facts.push(fact);
      return result.facts;
    }
    const facts = await ctx.runQuery(memoryReferences.listFacts, { ...args, capability: "read", query });
    for (const fact of facts) {
      const source = await ctx.runQuery(memoryReferences.getSource, { ...args, capability: "read", sourceId: fact.lineage.sourceId });
      await captureRecallFact(target, fact, source);
    }
    return facts;
  };
  const searchVectors = async (query: ProfiledQuery, limit: number, target: MemoryDeliveryBindings) => {
    boundedLimit(limit); assertSupportedEmbeddingProfile(query.profile); assertEmbeddingVector(query.embedding, query.profile);
    const readArgs = { ...args, capability: "read" as const };
    const authority = await ctx.runQuery(memoryReferences.recheck, readArgs);
    const pin = query.embeddingRunBudgetId ? { runBudgetId: query.embeddingRunBudgetId } : {};
    await ctx.runQuery(memoryReferences.profileReady, { ...readArgs, profile: query.profile, ...pin });
    const hits = await ctx.vectorSearch("runtimeMemoryVectors", query.profile.indexName === LARGE_EMBEDDING_PROFILE.indexName ? "by_large_embedding_v1" : "by_default_embedding_v1", {
      vector: [...query.embedding], limit,
      // Convex vector filters support eq/or only. This exact canonical tuple encodes conjunction.
      filter: (q) => authority.resourceAccess === "own"
        ? q.eq("scopeProfileOwnerKey", vectorOwnerScopeKey(scope.tenantId, scope.memorySpaceId, query.profile.profileId, scope.principalId))
        : q.eq("scopeProfileKey", vectorScopeKey(scope.tenantId, scope.memorySpaceId, query.profile.profileId)),
    });
    // A second internal query rechecks revocation and canonical source currentness after search.
    const matches = await ctx.runQuery(memoryReferences.hydrateVectors, { ...readArgs, profile: query.profile, ...pin, hits: hits.map((hit) => ({ id: hit._id, score: hit._score })) });
    await captureRecallVectors(target, matches, query.profile, pin);
    return matches;
  };
  const repository: MemoryRepository & Required<Pick<MemoryRepository, "stageRecallReads">> = {
    scope,
    recheckAuthority: async () => { await ctx.runQuery(memoryReferences.recheck, args); },
    assertReadAuthority: async () => { await ctx.runQuery(memoryReferences.recheck, { ...args, capability: "read" }); },
    getSource: async (sourceId) => await ctx.runQuery(memoryReferences.getSource, { ...args, sourceId }),
    putSource: async (source) => await ctx.runMutation(memoryReferences.putSource, { ...args, source }),
    commitDerived: async (input) => await ctx.runMutation(memoryReferences.commitDerived, { ...args, input }),
    listFacts: async query => await listFacts(query, bindings),
    finalDelivery: async () => await ctx.runMutation(memoryReferences.finalDelivery, { reference, bindings }),
    assertProfileReady: async (profile, runBudgetId) => { await ctx.runQuery(memoryReferences.profileReady,
      { ...args, capability: "read", profile, ...(runBudgetId ? { runBudgetId } : {}) }); },
    searchVectors: async (query, limit) => await searchVectors(query, limit, bindings),
    stageRecallReads: () => {
      const vectorBindings: MemoryDeliveryBindings = { sources: [], facts: [], vectors: [] };
      const factBindings: MemoryDeliveryBindings = { sources: [], facts: [], vectors: [] };
      return {
        searchVectors: async (query, limit) => await searchVectors(query, limit, vectorBindings),
        listFacts: async query => await listFacts(query, factBindings),
        commit: () => {
          // Match serial capture/dedupe exactly, including the source scan order
          // used by the fresh finalDelivery mutation when several sources fail.
          for (const branch of [vectorBindings, factBindings]) {
            for (const source of branch.sources) {
              if (!bindings.sources.some(value => canonicalMemoryValue(value) === canonicalMemoryValue(source))) bindings.sources.push(source);
            }
            for (const fact of branch.facts) {
              if (!bindings.facts.some(value => value.factId === fact.factId && value.payloadHash === fact.payloadHash)) bindings.facts.push(fact);
            }
            bindings.vectors.push(...branch.vectors);
          }
        },
      };
    },
  };
  // A wrapper replacing read methods must explicitly supply its own staging.
  // Spreading this private seam would bypass that wrapper's guards/bookkeeping.
  Object.defineProperty(repository, "stageRecallReads", { enumerable: false });
  return repository;
}
