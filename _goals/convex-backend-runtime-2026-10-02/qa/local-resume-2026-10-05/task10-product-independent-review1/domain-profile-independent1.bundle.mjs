// _goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task10-product-independent-review1/domain-profile-independent1.mjs
import assert from "node:assert/strict";

// src/domain/profile.ts
var DEFAULT_EMBEDDING_PROFILE = Object.freeze({
  profileId: "cortex-text-small-1536-v1",
  modelId: "openai/text-embedding-3-small",
  dimensions: 1536,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_default_embedding_v1"
});
var LARGE_EMBEDDING_PROFILE = Object.freeze({
  profileId: "cortex-text-large-3072-v1",
  modelId: "openai/text-embedding-3-large",
  dimensions: 3072,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_large_embedding_v1"
});
var SUPPORTED_EMBEDDING_PROFILES = Object.freeze([DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE]);
function embeddingProfileForModel(modelId) {
  const profile = SUPPORTED_EMBEDDING_PROFILES.find((value) => value.modelId === modelId);
  if (!profile) throw new Error("CAPABILITY_UNSUPPORTED: embedding model has no supported profile/index");
  return profile;
}
function assertSupportedEmbeddingProfile(actual) {
  assertProfileMatches(actual, embeddingProfileForModel(actual.modelId));
}
var DEFAULT_VECTOR_FILTER_FIELDS = Object.freeze([
  "tenantId",
  "memorySpaceId",
  "profileId"
]);
function normalizeSourceText(text) {
  const normalized = text.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("INVALID_INPUT: normalized text is empty");
  return normalized;
}
function assertProfileMatches(actual, expected = DEFAULT_EMBEDDING_PROFILE) {
  const fields = ["profileId", "modelId", "dimensions", "normalization", "chunking", "indexName"];
  if (fields.some((field) => actual[field] !== expected[field])) {
    throw new Error("PROFILE_NOT_READY: embedding profile does not match the pinned profile");
  }
}
function assertEmbeddingVector(vector, profile = DEFAULT_EMBEDDING_PROFILE) {
  if (!Number.isSafeInteger(profile.dimensions) || profile.dimensions <= 0 || !Array.isArray(vector) || vector.length !== profile.dimensions || Array.from(vector).some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(`INVALID_INPUT: expected ${profile.dimensions} finite embedding coordinates`);
  }
}
async function semanticHash(value) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function chunkNormalizedText(text) {
  if (!text || normalizeSourceText(text) !== text) {
    throw new Error("INVALID_INPUT: chunking requires normalized source text");
  }
  const points = Array.from(text);
  const windows = [];
  for (let start = 0; start < points.length; start += 1400) {
    const end = Math.min(start + 1600, points.length);
    windows.push({ ordinal: windows.length, start, end, text: points.slice(start, end).join("") });
    if (end === points.length) break;
  }
  return windows;
}

// src/domain/sources.ts
function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function validTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 864e13;
}
function assertTrustedScope(scope2) {
  const identifiers = ["tenantId", "memorySpaceId", "principalId", "membershipId", "grantId"];
  const versions = ["tenantEpoch", "memorySpaceEpoch", "principalVersion", "membershipVersion", "grantVersion"];
  if (!isRecord(scope2) || identifiers.some((field) => !nonempty(scope2[field])) || versions.some((field) => !Number.isSafeInteger(scope2[field]) || scope2[field] < 1)) {
    throw new Error("INVALID_INPUT: a trusted tenant, memory space, principal, membership and grant with positive versions are required");
  }
}
function assertSourceReference(source) {
  if (!isRecord(source) || !nonempty(source.sourceId) || !nonempty(source.sourceEventId) || !Number.isSafeInteger(source.sourceRevision) || source.sourceRevision < 1) {
    throw new Error("INVALID_INPUT: source requires stable IDs and a positive revision");
  }
}
function assertSourceContent(source) {
  if (!isRecord(source)) throw new Error("INVALID_INPUT: source content record is required");
  assertSourceLineage(source.lineage);
  if (![source.tenantId, source.memorySpaceId, source.ownerPrincipalId].every(nonempty) || typeof source.content !== "string" || normalizeSourceText(source.content) !== source.content || typeof source.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(source.contentHash) || !validTimestamp(source.createdAt) || source.tombstonedAt !== void 0 && !validTimestamp(source.tombstonedAt)) {
    throw new Error("INVALID_INPUT: source requires normalized content, scope/owner, SHA-256 hash and valid timestamps");
  }
}
function assertSourceLineage(source) {
  if (!isRecord(source) || !nonempty(source.sourceId) || !nonempty(source.sourceEventId) || typeof source.sourceRevision !== "number" || !Number.isSafeInteger(source.sourceRevision) || source.sourceRevision < 1) {
    throw new Error("INVALID_INPUT: source requires stable IDs and a positive revision");
  }
  const eligible = source.role === "user" && source.trust === "user_assertion" || source.role === "assistant" && source.trust === "assistant_claim" || source.role === "tool" && source.trust === "verified_tool_evidence" && nonempty(source.operationId);
  if (!eligible) throw new Error("INVALID_INPUT: invalid source role/trust attribution");
}
function sameReference(a, b) {
  return a.sourceId === b.sourceId && a.sourceEventId === b.sourceEventId && a.sourceRevision === b.sourceRevision;
}
async function prepareSourceContent(scope2, lineage2, text, clock, profile = DEFAULT_EMBEDDING_PROFILE) {
  assertSourceLineage(lineage2);
  assertSupportedEmbeddingProfile(profile);
  assertTrustedScope(scope2);
  const content = normalizeSourceText(text);
  const createdAt = clock.now();
  if (!validTimestamp(createdAt)) throw new Error("INVALID_INPUT: clock must return a finite valid timestamp");
  const source = {
    tenantId: scope2.tenantId,
    memorySpaceId: scope2.memorySpaceId,
    ownerPrincipalId: scope2.principalId,
    lineage: { ...lineage2 },
    content,
    contentHash: await semanticHash(content),
    createdAt
  };
  const chunks = await Promise.all(chunkNormalizedText(content).map(async (window) => ({
    ...window,
    sourceId: lineage2.sourceId,
    sourceEventId: lineage2.sourceEventId,
    sourceRevision: lineage2.sourceRevision,
    tenantId: scope2.tenantId,
    memorySpaceId: scope2.memorySpaceId,
    normalization: profile.normalization,
    chunking: profile.chunking,
    chunkId: await semanticHash(JSON.stringify([
      scope2.tenantId,
      scope2.memorySpaceId,
      lineage2.sourceId,
      lineage2.sourceEventId,
      lineage2.sourceRevision,
      profile.normalization,
      profile.chunking,
      window.ordinal,
      window.text
    ])),
    textHash: await semanticHash(window.text)
  })));
  return { source, chunks };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCurrentAuthorizedVector(vector, source, chunk, scope2, profile = DEFAULT_EMBEDDING_PROFILE) {
  assertTrustedScope(scope2);
  assertSourceContent(source);
  assertSourceReference(vector);
  assertSourceReference(chunk);
  if (![
    vector.vectorId,
    vector.chunkId,
    vector.tenantId,
    vector.memorySpaceId,
    vector.processingReceiptId,
    chunk.chunkId,
    chunk.tenantId,
    chunk.memorySpaceId,
    chunk.normalization,
    chunk.chunking
  ].every(nonempty)) {
    throw new Error("INVALID_INPUT: vector and chunk require stable IDs, scope and processing provenance");
  }
  assertProfileMatches(vector.profile, profile);
  assertEmbeddingVector(vector.embedding, profile);
  return source.tombstonedAt === void 0 && [source, vector, chunk].every((record) => record.tenantId === scope2.tenantId && record.memorySpaceId === scope2.memorySpaceId) && sameReference(vector, source.lineage) && sameReference(chunk, source.lineage) && vector.chunkId === chunk.chunkId && chunk.normalization === profile.normalization && chunk.chunking === profile.chunking;
}

// _goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task10-product-independent-review1/domain-profile-independent1.mjs
var scope = { tenantId: "review10-tenant", tenantEpoch: 1, memorySpaceId: "review10-space", memorySpaceEpoch: 1, principalId: "review10-reader", principalVersion: 1, membershipId: "review10-membership", membershipVersion: 1, grantId: "review10-grant", grantVersion: 1 };
var lineage = { sourceId: "review10-source", sourceEventId: "review10-event", sourceRevision: 1, role: "user", trust: "user_assertion" };
var results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: String(error) });
  }
}
await check("logical source and chunk identities are independent of model generation", async () => {
  const clock = { now: () => 17e11 };
  const text = "  Caf\xE9\r\n" + "evidence \u{1F9EA} ".repeat(170) + "tail  ";
  const a = await prepareSourceContent(scope, lineage, text, clock, DEFAULT_EMBEDDING_PROFILE), b = await prepareSourceContent(scope, lineage, text, clock, LARGE_EMBEDDING_PROFILE);
  assert.equal(a.chunks.length, b.chunks.length);
  assert.ok(a.chunks.length > 1);
  assert.deepEqual(a.source, b.source);
  assert.deepEqual(a.chunks, b.chunks);
  assert.ok(a.chunks.every((c) => !Object.hasOwn(c, "profileId") && c.normalization === DEFAULT_EMBEDDING_PROFILE.normalization && c.chunking === DEFAULT_EMBEDDING_PROFILE.chunking));
});
await check("current vector positive and same-dimensional different-model denial", async () => {
  const { source, chunks } = await prepareSourceContent(scope, lineage, "known review fixture", { now: () => 17e11 }, DEFAULT_EMBEDDING_PROFILE);
  const chunk = chunks[0];
  const vector = { sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: 1, vectorId: "review10-vector", chunkId: chunk.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, profile: DEFAULT_EMBEDDING_PROFILE, embedding: Array(DEFAULT_EMBEDDING_PROFILE.dimensions).fill(0.125), processingReceiptId: "review10-receipt" };
  assert.equal(isCurrentAuthorizedVector(vector, source, chunk, scope, DEFAULT_EMBEDDING_PROFILE), true);
  const incompatible = { ...DEFAULT_EMBEDDING_PROFILE, modelId: LARGE_EMBEDDING_PROFILE.modelId };
  assert.equal(incompatible.dimensions, DEFAULT_EMBEDDING_PROFILE.dimensions);
  assert.throws(() => isCurrentAuthorizedVector({ ...vector, profile: incompatible }, source, chunk, scope, DEFAULT_EMBEDDING_PROFILE), /PROFILE_NOT_READY/);
});
await check("dimension, nonfinite and sparse vectors cannot satisfy profile validation", async () => {
  assertEmbeddingVector(Array(LARGE_EMBEDDING_PROFILE.dimensions).fill(0.125), LARGE_EMBEDDING_PROFILE);
  assert.throws(() => assertEmbeddingVector(Array(DEFAULT_EMBEDDING_PROFILE.dimensions).fill(0.125), LARGE_EMBEDDING_PROFILE), /INVALID_INPUT/);
  const bad = Array(LARGE_EMBEDDING_PROFILE.dimensions).fill(0.125);
  bad[123] = NaN;
  assert.throws(() => assertEmbeddingVector(bad, LARGE_EMBEDDING_PROFILE), /INVALID_INPUT/);
  const sparse = new Array(LARGE_EMBEDDING_PROFILE.dimensions);
  assert.throws(() => assertEmbeddingVector(sparse, LARGE_EMBEDDING_PROFILE), /INVALID_INPUT/);
});
await check("unsupported model and undeclared index have explicit catalog denial", async () => {
  assert.equal(embeddingProfileForModel(LARGE_EMBEDDING_PROFILE.modelId), LARGE_EMBEDDING_PROFILE);
  assertSupportedEmbeddingProfile(LARGE_EMBEDDING_PROFILE);
  assert.throws(() => embeddingProfileForModel("other/unknown-embedding"), /CAPABILITY_UNSUPPORTED/);
  assert.throws(() => assertSupportedEmbeddingProfile({ ...LARGE_EMBEDDING_PROFILE, indexName: "undeclared_index" }), /PROFILE_NOT_READY/);
});
console.log(JSON.stringify({ scope: "DOMAIN_CODE_ONLY_NOT_MANAGED_RETRIEVAL", independentlyAuthoredControls: 4, results, passed: results.filter((r) => r.status === "PASS").length, failed: results.filter((r) => r.status === "FAIL").length, noServiceEffects: true }, null, 2));
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;
