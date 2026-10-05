/** Scoped Convex adapters. Every sensitive operation reloads the persisted grant. */
import { ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { RuntimeAuthority, RuntimeAuthorityReference, RuntimeResource } from "../src/auth/verified";
import type { DerivedFact, DerivedVector, MemoryRepository, ProfiledQuery, SourceChunk, SourceContent, TrustedMemoryScope, VectorMatch } from "../src/domain/contracts";
import type { DomainClock } from "../src/domain/clock";
import { DEFAULT_EMBEDDING_PROFILE, assertEmbeddingVector, assertProfileMatches, normalizeSourceText, semanticHash } from "../src/domain/profile";
import { assertSourceLineage, isCurrentAuthorizedVector, prepareSourceContent, processingIdentityKey } from "../src/domain/sources";
import { assertResourceScope, createAuthorityReader, recheckAuthority } from "./runtimeAuth";

export type DerivedCommit = Parameters<MemoryRepository["commitDerived"]>[0];
export type FactQuery = Parameters<MemoryRepository["listFacts"]>[0];
type ScopedArgs = { reference: RuntimeAuthorityReference; capability: "read" | "write" };

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
  hydrateVectors: internalQueryRef<ScopedArgs & { hits: { id: Id<"runtimeMemoryVectors">; score: number }[] }, VectorMatch[]>("runtimeMemory:readVectorMatches"),
};

export function memoryError(code: string, message: string): never {
  throw new ConvexError({ version: 1, code, message, retryable: false, outcome: "not_dispatched" });
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
  constructor(private readonly ctx: Pick<QueryCtx, "db">, private readonly reference: RuntimeAuthorityReference,
    private readonly capability: "read" | "write", private readonly writer?: MutationCtx["db"],
    private readonly clock: DomainClock = { now: () => Date.now() }) {
    this.scope = memoryScope(reference);
  }
  async authority(resource?: RuntimeResource, capability = this.capability): Promise<RuntimeAuthority> {
    return await recheckAuthority(this.ctx, this.reference, { capability,
      tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId, ...(resource ? { resource } : {}) });
  }
  async recheckAuthority(): Promise<void> { await this.authority(); }
  private writeDb(): MutationCtx["db"] {
    if (!this.writer || this.capability !== "write") memoryError("FORBIDDEN", "A write-authorized mutation is required");
    return this.writer;
  }
  async getSource(sourceId: string): Promise<SourceContent | null> {
    await this.authority();
    const row = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
    if (!row) return null;
    const source = stripSystem(row);
    await this.authority(sourceResource(source));
    if (source.tombstonedAt !== undefined) memoryError("FORBIDDEN", "Source was deleted");
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
  async commitDerived(input: DerivedCommit): Promise<{ receiptId: string; created: boolean }> {
    const db = this.writeDb();
    const source = await this.getSource(input.source.sourceId);
    if (!source || !sameReference(source.lineage, input.source) || !sameReference(source.lineage, input.identity)) {
      memoryError("STALE_SOURCE", "Source event/revision is no longer current");
    }
    const receiptId = await processingIdentityKey(input.identity);
    const canonicalIdentity = canonicalMemoryValue(input.identity);
    const canonicalPayload = canonicalMemoryValue(input);
    const receipt = await db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("receiptId", receiptId)).unique();
    if (receipt) {
      if (receipt.canonicalIdentity !== canonicalIdentity || receipt.canonicalPayload !== canonicalPayload) conflict("Processing receipt identity/hash was reused with a different canonical payload");
      return { receiptId, created: false };
    }
    const prepared = await prepareSourceContent(this.scope, source.lineage, source.content, { now: () => source.createdAt });
    const expectedChunks = new Map(prepared.chunks.map((chunk) => [chunk.chunkId, chunk]));
    const chunks = new Map<string, SourceChunk>();
    for (const chunk of input.chunks ?? []) {
      if (chunks.has(chunk.chunkId) || canonicalMemoryValue(chunk) !== canonicalMemoryValue(expectedChunks.get(chunk.chunkId))) memoryError("INVALID_INPUT", "Chunk does not match canonical source/profile/window");
      chunks.set(chunk.chunkId, chunk);
    }
    const vectorIds = new Set<string>();
    for (const vector of input.vectors ?? []) {
      assertProfileMatches(vector.profile);
      assertEmbeddingVector(vector.embedding);
      const chunk = chunks.get(vector.chunkId) ?? await this.findChunk(vector.chunkId);
      if (vectorIds.has(vector.vectorId) || vector.processingReceiptId !== receiptId || !chunk
        || !isCurrentAuthorizedVector(vector, source, chunk, this.scope)) memoryError("INVALID_INPUT", "Vector has invalid provenance or duplicate identity");
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
      if (!existing) await db.insert("runtimeMemoryVectors", { ...vector, embedding: [...vector.embedding], profileId: vector.profile.profileId,
        scopeProfileKey: vectorScopeKey(vector.tenantId, vector.memorySpaceId, vector.profile.profileId),
        ownerPrincipalId: source.ownerPrincipalId,
        scopeProfileOwnerKey: vectorOwnerScopeKey(vector.tenantId, vector.memorySpaceId, vector.profile.profileId, source.ownerPrincipalId) });
    }
    for (const fact of input.facts ?? []) {
      const { _id: _id, ...fields } = fact;
      const existing = factRows.get(fact.factId);
      const record = { ...fields, processingReceiptId: receiptId };
      if (existing) await db.replace("facts", existing._id, record);
      else await db.insert("facts", record);
    }
    return { receiptId, created: true };
  }
  private async findChunk(chunkId: string): Promise<SourceChunk | null> {
    const row = await this.ctx.db.query("runtimeMemoryChunks").withIndex("by_scope_chunk", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("chunkId", chunkId)).unique();
    return row ? stripSystem(row) : null;
  }
  /** Derived rows whose source was deleted/changed are excluded; grant denial still throws. */
  private async visibleSource(sourceId: string, authority: RuntimeAuthority): Promise<SourceContent | null> {
    const row = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) =>
      q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
    if (!row || row.tombstonedAt !== undefined || (authority.resourceAccess === "own" && row.ownerPrincipalId !== authority.principalId)) return null;
    const reader = createAuthorityReader(this.ctx);
    if (await reader.hasTombstone({ tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId, resourceType: "source", resourceId: sourceId })
      || await reader.hasTombstone({ tenantId: this.scope.tenantId, resourceType: "source", resourceId: sourceId })) return null;
    const source = stripSystem(row);
    await this.authority(sourceResource(source), "read");
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
      const source = await this.visibleSource(row.lineage.sourceId, authority);
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
  async hydrateVectors(hits: { id: Id<"runtimeMemoryVectors">; score: number }[]): Promise<VectorMatch[]> {
    if (hits.length > 100) memoryError("INVALID_INPUT", "Too many vector candidates");
    const authority = await this.authority(undefined, "read");
    const matches: VectorMatch[] = [];
    for (const hit of hits) {
      const row = await this.ctx.db.get("runtimeMemoryVectors", hit.id);
      if (!row || row.tenantId !== this.scope.tenantId || row.memorySpaceId !== this.scope.memorySpaceId
        || row.profileId !== DEFAULT_EMBEDDING_PROFILE.profileId || !Number.isFinite(hit.score)) continue;
      const sourceRow = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", row.sourceId)).unique();
      if (!sourceRow || sourceRow.tombstonedAt !== undefined || row.ownerPrincipalId !== sourceRow.ownerPrincipalId
        || (authority.resourceAccess === "own" && sourceRow.ownerPrincipalId !== authority.principalId)) continue;
      const source = await this.visibleSource(row.sourceId, authority);
      const chunk = await this.findChunk(row.chunkId);
      const vector = stripVector(row);
      const receipt = await this.ctx.db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", (q) =>
        q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("receiptId", vector.processingReceiptId)).unique();
      if (!source || !chunk || !receipt || !sameReference(source.lineage, receipt.identity)) continue;
      try {
        if (isCurrentAuthorizedVector(vector, source, chunk, this.scope)) matches.push({ vector, source, chunk, score: hit.score });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("PROFILE_NOT_READY:")) throw error;
      }
    }
    return matches;
  }
}
function stripVector(row: Doc<"runtimeMemoryVectors">): DerivedVector {
  const { profileId: _profileId, scopeProfileKey: _scopeProfileKey, ownerPrincipalId: _owner,
    scopeProfileOwnerKey: _ownerKey, ...vector } = stripSystem(row);
  return vector;
}

/** Action reads/mutations cross ctx through internal registrations, never a ConvexClient. */
export function createActionMemoryRepository(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation" | "vectorSearch">,
  reference: RuntimeAuthorityReference, capability: "read" | "write",
): MemoryRepository {
  const scope = memoryScope(reference);
  const args = { reference, capability };
  return {
    scope,
    recheckAuthority: async () => { await ctx.runQuery(memoryReferences.recheck, args); },
    getSource: async (sourceId) => await ctx.runQuery(memoryReferences.getSource, { ...args, sourceId }),
    putSource: async (source) => await ctx.runMutation(memoryReferences.putSource, { ...args, source }),
    commitDerived: async (input) => await ctx.runMutation(memoryReferences.commitDerived, { ...args, input }),
    listFacts: async (query) => await ctx.runQuery(memoryReferences.listFacts, { ...args, capability: "read", query }),
    searchVectors: async (query: ProfiledQuery, limit) => {
      boundedLimit(limit); assertProfileMatches(query.profile); assertEmbeddingVector(query.embedding);
      const readArgs = { ...args, capability: "read" as const };
      const authority = await ctx.runQuery(memoryReferences.recheck, readArgs);
      const hits = await ctx.vectorSearch("runtimeMemoryVectors", "by_default_embedding_v1", {
        vector: [...query.embedding], limit,
        // Convex vector filters support eq/or only. This exact canonical tuple encodes conjunction.
        filter: (q) => authority.resourceAccess === "own"
          ? q.eq("scopeProfileOwnerKey", vectorOwnerScopeKey(scope.tenantId, scope.memorySpaceId, query.profile.profileId, scope.principalId))
          : q.eq("scopeProfileKey", vectorScopeKey(scope.tenantId, scope.memorySpaceId, query.profile.profileId)),
      });
      // A second internal query rechecks revocation and canonical source currentness after search.
      return await ctx.runQuery(memoryReferences.hydrateVectors, { ...readArgs, hits: hits.map((hit) => ({ id: hit._id, score: hit._score })) });
    },
  };
}
