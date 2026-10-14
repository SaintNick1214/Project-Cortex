/** Real registered delivery/profile handlers with controlled persisted/component ports.
 * No services, managed ANN, inference or native OCC claim. The reference below
 * retains the pre-batch delivery algorithm for differential failure/order checks.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { MemoryDeliveryBindings } from "../../../convex-dev/runtimeMemoryRepository";
import type { SourceContent } from "../../../src/domain/contracts";
import type { EmbeddingProfile } from "../../../src/domain/profile";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { DEFAULT_EMBEDDING_PROFILE as small, LARGE_EMBEDDING_PROFILE as large, semanticHash } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { canonicalModelJson } from "../../../src/domain/model-policy";
const { installIngestionMockRoot, transcriptFixture, ledger, clock } = await import("../runtimeTranscript/fixture");
const { ConvexMemoryRepository, canonicalMemoryValue, memoryError: nativeMemoryError, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const memoryError: (code: string, message: string) => never = nativeMemoryError;
const { finalDelivery } = await import("../../../convex-dev/runtimeMemory");
const { deliveryExpiresAt } = await import("../../../convex-dev/runtimeDelivery");
const { explicitSourceLineage } = await import("../../../convex-dev/runtimeMemoryServices");

beforeEach(() => { installIngestionMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
async function setup(count = 3) {
  const f = await transcriptFixture({ maxContextTokens: 16384 });
  const repository = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db);
  const scope = memoryScope(f.reference);
  for (let i = 0; i < count; i++) {
    const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, `delivery-${i}`), `Favorite season ${i}`, { now: () => clock });
    await repository.putSource(prepared.source);
    const source = { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1 };
    const identity = { ...source, stage: "vectors" as const, semanticPolicyVersion: "batch-fixture-v1" };
    await repository.commitDerived({ source, identity, chunks: prepared.chunks, vectors: [{ ...source,
      vectorId: `vector-${i}`, chunkId: prepared.chunks[0]!.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
      profile: small, embedding: Array.from({ length: 1536 }, (_, index) => index === 0 ? 1 : 0), processingReceiptId: await processingIdentityKey(identity) }] });
  }
  const read = new ConvexMemoryRepository(f.ctx, f.reference, "read");
  const hits = f.db.table("runtimeMemoryVectors").map(row => ({ id: row._id as Id<"runtimeMemoryVectors">, score: 0 }));
  const matches = await read.hydrateVectors(hits);
  const bindings: MemoryDeliveryBindings = { sources: [], facts: [], vectors: await Promise.all(matches.map(async match => ({
    vectorId: match.vector.vectorId, profile: match.vector.profile,
    payloadHash: await semanticHash(canonicalMemoryValue(match.vector)), chunkHash: await semanticHash(canonicalMemoryValue(match.chunk)),
  }))) };
  const budgets: string[] = [];
  for (let i = 0; i < 2; i++) budgets.push((await f.call<{ runBudgetId: string }>(ledger.ensureBudget, {
    reference: f.reference, operationKey: "embedding.query", requestId: `delivery-budget-${i}`, requestCanonical: canonicalModelJson({ text: `query-${i}` }),
  })).runBudgetId);
  return { ...f, repository: read, bindings, budgets };
}
type Fixture = Awaited<ReturnType<typeof setup>>;
const sameReference = (a: SourceContent["lineage"], b: MemoryDeliveryBindings["sources"][number]) =>
  a.sourceId === b.sourceId && a.sourceEventId === b.sourceEventId && a.sourceRevision === b.sourceRevision;
// Original checkDelivery at 7fecfeb; method SHA-256 6c66e7e39879a1a1ef00ef74d52b64c1b259eee3e5925e79063e2b2161db5aec.
async function originalDelivery(f: Fixture, bindings: MemoryDeliveryBindings): Promise<{ version: 1; deliveryExpiresAt?: number }> {
  const repository = f.repository;
    // Recall admits 100 facts and 100 vectors, plus its one-fact preflight.
    if (bindings.sources.length > 201 || bindings.facts.length > 101 || bindings.vectors.length > 100
      || new TextEncoder().encode(canonicalMemoryValue(bindings)).byteLength > 262144) memoryError("INVALID_INPUT", "Recall delivery bindings exceed the bounded envelope");
    const deadlines: number[] = []; await repository.authority(undefined, "read");
    for (const expected of bindings.sources) {
      const current = await repository.getSource(expected.sourceId, expected.permission, deadlines);
      if (!current || !sameReference(current.lineage, expected) || current.contentHash !== expected.contentHash
        || current.ownerPrincipalId !== expected.ownerPrincipalId) memoryError("STALE_SOURCE", "Consumed recall source changed before delivery");
    }
    for (const expected of bindings.facts) {
      const row = await f.ctx.db.query("facts").withIndex("by_runtime_scope_factId", q =>
        q.eq("tenantId", repository.scope.tenantId).eq("memorySpaceId", repository.scope.memorySpaceId).eq("factId", expected.factId)).unique();
      if (!row?.ownerPrincipalId || !row.lineage || !row.extractionPolicyVersion || row.tombstonedAt !== undefined
        || row.supersededBy || row.sourceType === "fact-extraction" || (row.validUntil !== undefined && row.validUntil <= Date.now())) {
        memoryError("STALE_SOURCE", "Consumed recall fact is no longer current");
      }
      await repository.authority({ resourceType: "fact", resourceId: row.factId, tenantId: row.tenantId,
        memorySpaceId: row.memorySpaceId, ownerPrincipalId: row.ownerPrincipalId }, "read");
      if (row.validUntil !== undefined) deadlines.push(row.validUntil);
      const source = await repository.getSource(row.lineage.sourceId, "canViewFacts", deadlines);
      if (!source || source.ownerPrincipalId !== row.ownerPrincipalId || source.lineage.role === "assistant"
        || canonicalMemoryValue(source.lineage) !== canonicalMemoryValue(row.lineage)) memoryError("STALE_SOURCE", "Consumed recall fact lost source attribution");
      const { _creationTime: _creationTime, tombstonedAt: _tombstone, processingReceiptId: _receipt, ...payload } = row;
      if (await semanticHash(canonicalMemoryValue(payload)) !== expected.payloadHash) memoryError("STALE_SOURCE", "Consumed recall fact changed before delivery");
    }
    for (const expected of bindings.vectors) {
      const row = await f.ctx.db.query("runtimeMemoryVectors").withIndex("by_scope_vector", q =>
        q.eq("tenantId", repository.scope.tenantId).eq("memorySpaceId", repository.scope.memorySpaceId).eq("vectorId", expected.vectorId)).unique();
      const matches = row ? await repository.hydrateVectors([{ id: row._id, score: 0 }], expected.profile, expected.runBudgetId, deadlines) : [];
      const match = matches.at(0); // Same missing-element outcome, explicit in the test's array type.
      if (!match || await semanticHash(canonicalMemoryValue(match.vector)) !== expected.payloadHash
        || await semanticHash(canonicalMemoryValue(match.chunk)) !== expected.chunkHash) memoryError("STALE_SOURCE", "Consumed recall vector changed before delivery");
    }
    // Retain consumed share/source deadlines through the final authority awaits.
    const expiresAt = await deliveryExpiresAt(f.ctx, f.reference, deadlines);
    return { version: 1, ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
}

function storedState(f: Fixture) {
  return canonicalMemoryValue({ rows: [...f.db.rows].filter(([, rows]) => rows.length), writes: f.db.writes,
    effects: f.effects, scheduled: f.scheduled, native: [...f.native.messages] });
}
function track(f: Fixture) {
  const profileArgs: { profile?: EmbeddingProfile; runBudgetId?: string }[] = [], reads: string[] = [], readKeys = new Set<string>();
  const query = f.ctx.runQuery.bind(f.ctx);
  jest.spyOn(f.ctx, "runQuery").mockImplementation(async (...args) => {
    if (getFunctionName(args[0]) === "runtimeModelPolicy:embeddingProfile") profileArgs.push(args[1] as typeof profileArgs[number]);
    return query(args[0], args[1], args[2]);
  });
  const dbQuery = f.db.query.bind(f.db);
  jest.spyOn(f.db, "query").mockImplementation(table => {
    reads.push(table); const builder = dbQuery(table), withIndex = builder.withIndex.bind(builder);
    builder.withIndex = (name, callback) => withIndex(name, q => {
      const filters: unknown[] = [];
      const proxy: object = new Proxy(q as object, { get(target, key) {
        const value: unknown = Reflect.get(target, key);
        return typeof value === "function" ? (...args: unknown[]) => {
          filters.push([key, ...args]); const result: unknown = Reflect.apply(value, target, args);
          return result === target ? proxy : result;
        } : value;
      } });
      const result = callback(proxy);
      readKeys.add(canonicalMemoryValue([table, name, filters])); return result;
    });
    return builder;
  });
  const get = f.db.get.bind(f.db);
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => {
    reads.push(table); readKeys.add(canonicalMemoryValue([table, id])); return get(table, id);
  });
  return { profileArgs, reads, readKeys };
}
async function outcome(run: () => Promise<unknown>) {
  try { return { value: await run() }; }
  catch (error) { return { error: error instanceof ConvexError ? error.data : error instanceof Error ? error.message : String(error) }; }
}
async function compare(mutator: (f: Fixture) => void | Promise<void>, count = 3) {
  const results: unknown[] = [];
  for (const original of [true, false]) {
    const f = await setup(count); await mutator(f); const before = storedState(f);
    results.push(await outcome(() => original ? originalDelivery(f, f.bindings) : f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })));
    expect(storedState(f)).toBe(before);
  }
  expect(results[1]).toEqual(results[0]); return results[0] as { error?: string | { code?: string }; value?: unknown };
}

function shareVectorSource(f: Fixture, ordinal: number, expiresAt = clock + 10) {
  const row = f.db.table("runtimeMemorySources")[ordinal]!, vector = f.db.table("runtimeMemoryVectors")[ordinal]!;
  const lineage = row.lineage as SourceContent["lineage"], conversationId = `private-${ordinal}`, nativeMessageId = `private-message-${ordinal}`;
  f.grant.resourceAccess = "space"; row.ownerPrincipalId = "other-owner"; vector.ownerPrincipalId = "other-owner";
  row.transcriptOrigin = { conversationId, conversationEpoch: 1, nativeMessageId };
  f.db.seed("runtimeConversations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, conversationId,
    ownerPrincipalId: "other-owner", participants: [], visibility: "private", epoch: 1 });
  f.db.seed("runtimeTranscriptMessages", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, conversationId,
    ownerPrincipalId: "other-owner", nativeMessageId, approved: true, ...lineage, revision: lineage.sourceRevision, role: "user", sourceContentHash: row.contentHash });
  const permissions = { canView: true, canViewFacts: false, canViewMemories: true, canContinue: false, canFork: false, canExport: false };
  f.db.seed("runtimeConversationShares", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, conversationId,
    grantType: "user", grantedTo: f.reference.principalId, state: "active", viewCount: 0, permissions: { ...permissions, canViewMemories: false } });
  return f.db.seed("runtimeConversationShares", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, conversationId,
    grantType: "user", grantedTo: f.reference.principalId, state: "active", viewCount: 0, permissions, expiresAt });
}

describe("snapshot-local exact profile/budget initialization", () => {
  it.each([1, 3, 10, 100])("checks %i vector resources while native profile/budget initialization runs once", async count => {
    const f = await setup(count), trace = track(f), before = storedState(f);
    f.bindings.vectors.forEach(row => { row.runBudgetId = f.budgets[0]; });
    expect(finalDelivery.isInternal).toBe(true); expect(finalDelivery.isMutation).toBe(true);
    expect(await f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).toEqual({ version: 1 });
    expect(trace.profileArgs).toHaveLength(1); expect(trace.profileArgs[0]?.runBudgetId).toBe(f.budgets[0]);
    // Each vector still reloads source authority and every chunk/receipt candidate.
    expect(trace.reads.filter(table => table === "runtimeMemoryChunks")).toHaveLength(count);
    expect(trace.reads.filter(table => table === "runtimeMemoryReceipts")).toHaveLength(count);
    expect(trace.reads.filter(table => table === "runtimeMemorySources")).toHaveLength(count * 2);
    expect(storedState(f)).toBe(before);
  });
  it("runs current profile and budget work once per exact group, preserving interleaved vector order", async () => {
    const f = await setup(5), trace = track(f), before = storedState(f);
    [f.budgets[0], f.budgets[1], f.budgets[0], undefined, f.budgets[1]].forEach((runBudgetId, i) => {
      if (runBudgetId !== undefined) f.bindings.vectors[i]!.runBudgetId = runBudgetId;
    });
    expect(await f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).toEqual({ version: 1 });
    expect(trace.profileArgs.map(args => args.runBudgetId)).toEqual([f.budgets[0], f.budgets[1], undefined]);
    expect(trace.reads.filter(table => table === "runtimeBudgetAccounts")).not.toHaveLength(0);
    expect(storedState(f)).toBe(before);
  });
  it("distinguishes omitted budget from empty string and validates the complete profile, not its profileId", async () => {
    const f = await setup(), trace = track(f);
    f.bindings.vectors[1]!.runBudgetId = "";
    f.bindings.vectors[2]!.profile = { ...small, indexName: "forged-index" };
    await expect(f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).rejects.toThrow("PROFILE_NOT_READY");
    expect(trace.profileArgs).toHaveLength(3);
    expect(trace.profileArgs.map(args => args.runBudgetId)).toEqual([undefined, undefined, undefined]);
  });
  it("shares no profile context across invocations and does not change ordinary hydration", async () => {
    const f = await setup(), trace = track(f), before = storedState(f);
    for (let i = 0; i < 2; i++) expect(await f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).toEqual({ version: 1 });
    expect(trace.profileArgs).toHaveLength(2);
    const hits = f.db.table("runtimeMemoryVectors").map(row => ({ id: row._id as Id<"runtimeMemoryVectors">, score: 0 }));
    for (let i = 0; i < 2; i++) expect(await f.repository.hydrateVectors(hits)).toHaveLength(3);
    expect(trace.profileArgs).toHaveLength(4);
    await expect(f.repository.hydrateVectors(Array.from({ length: 101 }, () => hits[0]!))).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(trace.profileArgs).toHaveLength(4); expect(storedState(f)).toBe(before);
  });
  it("matches the original native read-set tables while reducing repeated profile initialization", async () => {
    const sets: string[][] = [], keys: string[][] = [], counts: number[] = [];
    for (const original of [true, false]) {
      const f = await setup(), trace = track(f);
      f.bindings.vectors.forEach(v => { v.runBudgetId = f.budgets[0]; });
      if (original) await originalDelivery(f, f.bindings); else await f.call(finalDelivery, { reference: f.reference, bindings: f.bindings });
      sets.push([...new Set(trace.reads)].sort()); keys.push([...trace.readKeys].sort()); counts.push(trace.profileArgs.length);
    }
    expect(sets[1]).toEqual(sets[0]); expect(keys[1]).toEqual(keys[0]); expect(counts).toEqual([3, 1]);
    expect(sets[1]).toEqual(expect.arrayContaining(["runtimeAuthPrincipals", "runtimeAuthGrants", "runtimeBudgetAccounts", "runtimeRuns",
      "runtimeIngestionJobs", "runtimeMemoryVectors", "runtimeMemorySources", "runtimeMemoryChunks", "runtimeMemoryReceipts"]));
  });
});

describe("original delivery outcome and failure precedence", () => {
  it("matches one/many unchanged vectors with no application or financial effect", async () => {
    for (const count of [1, 3]) expect(await compare(() => {}, count)).toEqual({ value: { version: 1 } });
  });
  it.each([0, 2])("checks invalid source/hash/profile/budget at vector ordinal %i", async ordinal => {
    for (const kind of ["revision", "source-delete", "source-control", "payload-hash", "chunk-hash", "chunk-change", "missing-chunk", "receipt-change", "missing-receipt", "profile", "profile-id", "owner", "tenant", "space", "missing-vector", "duplicate-vector", "duplicate-source", "bad-budget", "cancelled-budget", "inactive-budget"] as const) {
      const result = await compare(f => {
        const vector = f.db.table("runtimeMemoryVectors")[ordinal]!;
        const source = f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === vector.sourceId)!;
        const binding = f.bindings.vectors[ordinal]!;
        if (kind === "revision") vector.sourceRevision = 2;
        else if (kind === "source-delete") source.tombstonedAt = clock;
        else if (kind === "source-control") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: vector.sourceId, deletedAt: clock });
        else if (kind === "payload-hash") binding.payloadHash = "wrong";
        else if (kind === "chunk-hash") binding.chunkHash = "wrong";
        else if (kind === "chunk-change") f.db.table("runtimeMemoryChunks")[ordinal]!.text = "changed";
        else if (kind === "missing-chunk") vector.chunkId = "absent";
        else if (kind === "receipt-change") f.db.table("runtimeMemoryReceipts")[ordinal]!.identity = { sourceId: "other", sourceEventId: "other", sourceRevision: 1 };
        else if (kind === "missing-receipt") vector.processingReceiptId = "absent";
        else if (kind === "profile") binding.profile = { ...large };
        else if (kind === "profile-id") binding.profile = { ...small, modelId: "forged-model" };
        else if (kind === "owner") vector.ownerPrincipalId = "other";
        else if (kind === "tenant") vector.tenantId = "other";
        else if (kind === "space") vector.memorySpaceId = "other";
        else if (kind === "missing-vector") binding.vectorId = "missing";
        else if (kind === "duplicate-vector") f.db.seed("runtimeMemoryVectors", { ...vector, _id: "duplicate" });
        else if (kind === "duplicate-source") f.db.seed("runtimeMemorySources", { ...source, _id: "duplicate" });
        else if (kind === "bad-budget") binding.runBudgetId = "wrong";
        else {
          binding.runBudgetId = f.budgets[0];
          const budget = f.db.table("runtimeBudgetAccounts").find(row => row.runBudgetId === binding.runBudgetId && row.kind === "run")!;
          budget[kind === "cancelled-budget" ? "cancelled" : "current"] = kind === "cancelled-budget";
        }
      });
      expect(result.error).toBeDefined();
    }
  });
  it.each(["principal", "membership", "grant", "scope", "grant-expiry"] as const)("matches current %s denial with no vector delivery", async kind => {
    const result = await compare(f => {
      if (kind === "principal") f.principal.revokedAt = clock;
      else if (kind === "membership") f.membership.revokedAt = clock;
      else if (kind === "grant") f.grant.revokedAt = clock;
      else if (kind === "scope") f.db.table("runtimeAuthScopes")[1]!.epoch = 2;
      else f.grant.expiresAt = clock;
    });
    expect(result).toMatchObject({ error: { code: "FORBIDDEN" } });
  });
  it("does not move a later invalid profile ahead of an earlier vector hash failure", async () => {
    const result = await compare(f => {
      f.bindings.vectors[0]!.payloadHash = "changed";
      f.bindings.vectors[1]!.profile = large;
      f.bindings.vectors[2]!.runBudgetId = "missing-budget";
    });
    expect(result).toMatchObject({ error: { code: "STALE_SOURCE" } });
  });
  it("does not move profile initialization ahead of an absent or ambiguous canonical row", async () => {
    for (const ambiguous of [false, true]) {
      const result = await compare(f => {
        const row = f.db.table("runtimeMemoryVectors")[0]!;
        if (ambiguous) f.db.seed("runtimeMemoryVectors", { ...row, _id: "duplicate" }); else f.bindings.vectors[0]!.vectorId = "absent";
        f.bindings.vectors[0]!.profile = large; f.bindings.vectors[0]!.runBudgetId = "bad";
      });
      if (ambiguous) expect(result).toEqual({ error: "Duplicate rows" }); else expect(result).toMatchObject({ error: { code: "STALE_SOURCE" } });
    }
  });
  it.each(["sources", "facts", "vectors", "bytes"] as const)("retains exact %s envelope cap before any profile query", async kind => {
    const f = await setup(), trace = track(f), before = storedState(f);
    if (kind === "vectors") f.bindings.vectors = Array.from({ length: 101 }, () => f.bindings.vectors[0]!);
    else if (kind === "facts") f.bindings.facts = Array.from({ length: 102 }, () => ({ factId: "absent", payloadHash: "x" }));
    else if (kind === "sources") f.bindings.sources = Array.from({ length: 202 }, () => ({ sourceId: "x", sourceEventId: "x", sourceRevision: 1, contentHash: "x", ownerPrincipalId: f.reference.principalId, permission: "canViewMemories" }));
    else f.bindings.vectors[0]!.payloadHash = "x".repeat(262144);
    await expect(f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(trace.profileArgs).toHaveLength(0); expect(storedState(f)).toBe(before);
  });
});


describe("per-source delivery lifetimes and native budget fences", () => {
  it("retains each vector's consumed data-share deadline and returns their earliest bound", async () => {
    expect(await compare(f => {
      shareVectorSource(f, 0, clock + 2); shareVectorSource(f, 2, clock + 1);
      f.grant.expiresAt = clock + 3;
    })).toEqual({ value: { version: 1, deliveryExpiresAt: clock + 1 } });
  });
  it.each(["expired-share", "revoked-share", "data-permission", "own-scope", "conversation-delete", "conversation-expiry", "unapproved-message"] as const)(
    "preserves late vector %s despite an earlier validated identical group and permanent generic-view share", async kind => {
      const result = await compare(f => {
        const share = shareVectorSource(f, 2);
        if (kind === "expired-share") share.expiresAt = clock;
        else if (kind === "revoked-share") share.revokedAt = clock;
        else if (kind === "data-permission") share.permissions = { ...(share.permissions as object), canViewMemories: false };
        else if (kind === "own-scope") f.grant.resourceAccess = "own";
        else if (kind === "conversation-delete") f.db.table("runtimeConversations")[0]!.tombstonedAt = clock;
        else if (kind === "conversation-expiry") f.db.table("runtimeConversations")[0]!.retentionUntil = clock;
        else f.db.table("runtimeTranscriptMessages")[0]!.approved = false;
      });
      expect(result).toMatchObject({ error: { code: "STALE_SOURCE" } });
    });
  it("rechecks final authority after the last per-vector hash without returning partial payload", async () => {
    for (const original of [true, false]) {
      const f = await setup(), before = storedState(f), digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
      const { _id: _id, _creationTime: _time, ...lastChunk } = f.db.table("runtimeMemoryChunks")[2]!;
      const finalChunkInput = canonicalMemoryValue(lastChunk); let revocations = 0;
      const spy = jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (...args) => {
        const result = await digest(...args);
        if (new TextDecoder().decode(args[1]) === finalChunkInput) { f.grant.revokedAt = clock; revocations++; }
        return result;
      });
      const result = await outcome(() => original ? originalDelivery(f, f.bindings) : f.call(finalDelivery, { reference: f.reference, bindings: f.bindings }));
      expect(result).toMatchObject({ error: { code: "FORBIDDEN" } }); expect(revocations).toBe(1);
      spy.mockRestore();
      // The registered candidate restores the controlled transaction's injected
      // mutation too. A real finalDelivery has no application writes to roll back.
      if (!original) expect(storedState(f)).toBe(before);
    }
  });
  it("retains a consumed share deadline through the last hash and final authority awaits", async () => {
    // Controlled time interleaving: native mutation time is frozen in Convex.
    // The existing action delivery tests also fence expiry after the RPC returns.
    for (const original of [true, false]) {
      jest.spyOn(Date, "now").mockReturnValue(clock);
      const f = await setup(); shareVectorSource(f, 0, clock + 1);
      const before = storedState(f), digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
      const { _id: _id, _creationTime: _time, ...lastChunk } = f.db.table("runtimeMemoryChunks")[2]!;
      let advances = 0;
      const spy = jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (...args) => {
        const result = await digest(...args);
        if (new TextDecoder().decode(args[1]) === canonicalMemoryValue(lastChunk)) {
          jest.spyOn(Date, "now").mockReturnValue(clock + 2); advances++;
        }
        return result;
      });
      expect(await outcome(() => original ? originalDelivery(f, f.bindings)
        : f.call(finalDelivery, { reference: f.reference, bindings: f.bindings }))).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(advances).toBe(1); spy.mockRestore(); expect(storedState(f)).toBe(before);
    }
  });
  it("revalidates a cancelled run between fresh delivery invocations, with no cross-call budget cache", async () => {
    const f = await setup(), trace = track(f); f.bindings.vectors.forEach(v => { v.runBudgetId = f.budgets[0]; });
    expect(await f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).toEqual({ version: 1 });
    f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run" && row.runBudgetId === f.budgets[0])!.cancelled = true;
    const before = storedState(f);
    await expect(f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).rejects.toMatchObject({ data: { code: "RUN_CANCELLED" } });
    expect(trace.profileArgs).toHaveLength(2); expect(storedState(f)).toBe(before);
  });
  it("retains native Agent account linkage fences at a late distinct group", async () => {
    const result = await compare(f => {
      const account = f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run" && row.runBudgetId === f.budgets[0])!;
      f.db.seed("runtimeRuns", { runAccountId: account._id, executionRequested: true, authorityReference: f.reference,
        tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, runId: "missing-owned-execution", attemptNumber: 1, snapshotCanonical: "{}" });
      f.bindings.vectors[2]!.runBudgetId = f.budgets[0];
    });
    expect(result).toMatchObject({ error: { code: "INVALID_STATE" } });
  });
  it.each([false, true])("retains native ingestion lease fence (expired=%s) inside current profile selection", async expired => {
    const result = await compare(f => {
      const account = f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run" && row.runBudgetId === f.budgets[0])!;
      const source = f.db.table("runtimeMemorySources")[2]!, eventId = "delivery-ingestion";
      f.db.seed("runtimeIngestionJobs", { runAccountId: account._id, runBudgetId: account.runBudgetId,
        tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, eventId });
      f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, eventId,
        eligibility: "eligible", lineage: source.lineage, contentHash: source.contentHash, ownerPrincipalId: source.ownerPrincipalId, authorityReference: f.reference });
      f.db.seed("runtimeIngestionStages", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, eventId,
        stage: "extract", state: "running", leaseVersion: 1, attempt: 1, leaseExpiresAt: clock + (expired ? 0 : 1) });
      f.bindings.vectors[2]!.runBudgetId = f.budgets[0];
    });
    if (expired) expect(result).toMatchObject({ error: { code: "LEASE_EXPIRED" } }); else expect(result).toEqual({ value: { version: 1 } });
  });
});

it.each([true, false])("K27 public delivery shared=%s compares with the exact K26 scope, not the historical profile algorithm", async shared => {
  const f = await setup(3), { createAuthorityReadScope } = await import("../../../convex-dev/runtimeAuth");
  const writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db), scope = memoryScope(f.reference);
  const leaves: SourceContent[] = [];
  for (let i = 0; i < (shared ? 1 : 3); i++) {
    const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, `k27-parent-${i}`), `Independent parent ${i}`, { now: () => clock });
    await writer.putSource(prepared.source); leaves.push(prepared.source);
  }
  // Only original source graph records are added; vectors/bindings/profile stay exact.
  f.db.table("runtimeMemorySources").slice(0, 3).forEach((row, i) => {
    const leaf = leaves[shared ? 0 : i]!;
    row.contextSourceWitnesses = [{ sourceId: leaf.lineage.sourceId, sourceEventId: leaf.lineage.sourceEventId,
      sourceRevision: leaf.lineage.sourceRevision, contentHash: leaf.contentHash, permissions: ["canViewMemories"] }];
  });
  const before = storedState(f), trace = track(f);
  const expected = await new ConvexMemoryRepository(createAuthorityReadScope(f.ctx), f.reference, "read").checkDelivery(f.bindings, f.ctx);
  const baseline = [...trace.reads], identities = [...trace.readKeys].sort(); trace.reads.length = 0; trace.readKeys.clear();
  expect(await f.call(finalDelivery, { reference: f.reference, bindings: f.bindings })).toEqual(expected);
  expect([...trace.readKeys].sort()).toEqual(identities);
  const notRaw = (rows: string[]) => rows.filter(table => !table.startsWith("runtimeAuth") && !["runtimeMemorySources", "runtimeConversations", "runtimeTranscriptMessages", "runtimeRuns"].includes(table));
  expect(notRaw(trace.reads)).toEqual(notRaw(baseline)); expect(storedState(f)).toBe(before);
  if (shared) expect(trace.reads.length).toBeLessThan(baseline.length);
  else expect(trace.reads.length).toBe(baseline.length); // No repeated graph identity to remove.
  console.info(JSON.stringify({ type: "k27-public-final-delivery", shared, baselineReads: baseline.length, optimizedReads: trace.reads.length,
    exactRawIdentitySet: true, applicationWrites: 0, providerCalls: 0, nativeLatency: "UNAVAILABLE" }));
});
