import { describe, expect, it, jest } from "@jest/globals";
import {
  assertInternalModelOperation, assertMemoryAuthorityCurrent, assertSourceLineage,
  buildSourceExtractionPrompt, DEFAULT_EMBEDDING_PROFILE, extractSourceFacts,
  isCurrentAuthorizedVector, isFactExtractionEligible, parseSourceFactsResponse,
  prepareSourceContent, processingIdentityKey, validateModelEmbeddings,
} from "../../../src/domain/index.js";
import type {
  DerivedVector, InternalModelOperation, MemoryAuthoritySnapshot, MemoryModel,
  SourceContent, SourceLineage, TrustedMemoryScope,
} from "../../../src/domain/index.js";

const scope: TrustedMemoryScope = {
  tenantId: "tenant", tenantEpoch: 1, memorySpaceId: "space", memorySpaceEpoch: 2,
  principalId: "principal", principalVersion: 1, membershipId: "membership", membershipVersion: 1,
  grantId: "grant", grantVersion: 1,
};
const lineage: SourceLineage = { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" };
const operation: InternalModelOperation = { operationId: "extract-event-1", policyVersion: "policy-v1", attempt: 1, source: lineage };
const result = { facts: [{
  fact: "User prefers dark mode", factType: "preference", subject: "User", predicate: "prefers", object: "dark mode",
  confidence: 0.95, tags: ["ui"], entities: [], relations: [],
}] };
const source: SourceContent = { tenantId: "tenant", memorySpaceId: "space", ownerPrincipalId: "principal", lineage, content: "I prefer dark mode", contentHash: "a".repeat(64), createdAt: 1000 };

describe("attributed source domain", () => {
  it("prepares independent logical source/chunks with stable Unicode normalization and revision IDs", async () => {
    const first = await prepareSourceContent(scope, lineage, " Cafe\u0301\r\n", { now: () => 1000 });
    const same = await prepareSourceContent(scope, lineage, "Café", { now: () => 2000 });
    const revision = await prepareSourceContent(scope, { ...lineage, sourceRevision: 2 }, "Café", { now: () => 2000 });
    expect(first.source.content).toBe("Café");
    expect(first.source.createdAt).toBe(1000);
    expect(first.source.ownerPrincipalId).toBe(scope.principalId);
    expect(first.source.contentHash).toBe(same.source.contentHash);
    expect(first.chunks).toEqual(same.chunks);
    expect(first.chunks[0].chunkId).not.toBe(revision.chunks[0].chunkId);
    expect(first.chunks[0]).toMatchObject({ ordinal: 0, start: 0, end: 4, sourceEventId: "event", sourceRevision: 1, profileId: DEFAULT_EMBEDDING_PROFILE.profileId });
    expect(first.source).not.toHaveProperty("embedding");
    expect(first.chunks[0]).not.toHaveProperty("embedding");
    await expect(prepareSourceContent({ ...scope, memorySpaceId: "" }, lineage, "x", { now: () => 0 })).rejects.toThrow("trusted tenant");
    await expect(prepareSourceContent(scope, lineage, "x", { now: () => NaN })).rejects.toThrow("clock");
  });

  it("rejects incomplete trusted scope and invalid preparation clocks", async () => {
    for (const field of ["tenantId", "memorySpaceId", "principalId", "membershipId", "grantId"] as const) {
      await expect(prepareSourceContent({ ...scope, [field]: " " }, lineage, "valid", { now: () => 1000 })).rejects.toThrow("INVALID_INPUT");
    }
    for (const field of ["tenantEpoch", "memorySpaceEpoch", "principalVersion", "membershipVersion", "grantVersion"] as const) {
      await expect(prepareSourceContent({ ...scope, [field]: 0 }, lineage, "valid", { now: () => 1000 })).rejects.toThrow("INVALID_INPUT");
    }
    for (const timestamp of [NaN, Infinity, -1, 8.64e15 + 1]) {
      await expect(prepareSourceContent(scope, lineage, "valid", { now: () => timestamp })).rejects.toThrow("clock");
    }
  });

  it("rejects invalid modern source metadata at prompt, parsing and dispatch with zero model calls", async () => {
    const extract = jest.fn<MemoryModel["extract"]>().mockResolvedValue(result);
    const invalid: SourceContent[] = [
      ...["tenantId", "memorySpaceId", "ownerPrincipalId"].map((field) => ({ ...source, [field]: "" })),
      ...["", " \n ", "  valid", "Cafe\u0301", "first\r\nsecond"].map((content) => ({ ...source, content })),
      ...["", "hash", "g".repeat(64)].map((contentHash) => ({ ...source, contentHash })),
      ...[NaN, Infinity, -1, 8.64e15 + 1].map((createdAt) => ({ ...source, createdAt })),
      { ...source, tombstonedAt: NaN },
      { ...source, lineage: { ...lineage, sourceRevision: 0 } },
    ];
    for (const malformed of invalid) {
      expect(() => buildSourceExtractionPrompt(malformed)).toThrow("INVALID_INPUT");
      expect(() => parseSourceFactsResponse(result, malformed)).toThrow("INVALID_INPUT");
      await expect(extractSourceFacts(malformed, { extract }, operation)).rejects.toThrow("INVALID_INPUT");
    }
    expect(extract).toHaveBeenCalledTimes(0);
  });

  it("pins stage identity to event/revision/policy, rather than changing timestamps", async () => {
    const identity = { ...lineage, stage: "extract" as const, semanticPolicyVersion: "v1" };
    const key = await processingIdentityKey(identity);
    expect(key).toBe(await processingIdentityKey(identity));
    for (const changed of [{ sourceRevision: 2 }, { semanticPolicyVersion: "v2" }, { stage: "vectors" as const }]) {
      expect(await processingIdentityKey({ ...identity, ...changed })).not.toBe(key);
    }
    await expect(processingIdentityKey({ ...identity, semanticPolicyVersion: "" })).rejects.toThrow("processing identity");
  });

  it("rejects invalid lineage and distinguishes user, verified tool and assistant sources", () => {
    expect(isFactExtractionEligible(lineage)).toBe(true);
    expect(isFactExtractionEligible({ ...lineage, role: "tool", trust: "verified_tool_evidence", operationId: "tool-1" })).toBe(true);
    expect(isFactExtractionEligible({ ...lineage, role: "assistant", trust: "assistant_claim" })).toBe(false);
    expect(() => assertSourceLineage({ ...lineage, sourceRevision: 0 })).toThrow("positive revision");
    expect(() => assertSourceLineage({ ...lineage, trust: "assistant_claim" })).toThrow("role/trust");
    expect(() => assertSourceLineage({ ...lineage, role: "tool", trust: "verified_tool_evidence", operationId: "" })).toThrow("role/trust");
    expect(buildSourceExtractionPrompt(source).system).toContain("Assistant claims/speculation");
    expect(buildSourceExtractionPrompt({ ...source, lineage: { ...lineage, role: "tool", trust: "verified_tool_evidence", operationId: "tool-1" } }).system).toContain("Preserve what the tool actually verified");
    expect(() => buildSourceExtractionPrompt({ ...source, tombstonedAt: 0 })).toThrow("POLICY_DENIED");
  });

  it("uses only the internal model operation and assigns trusted lineage outside the model", async () => {
    const extract = jest.fn<MemoryModel["extract"]>().mockResolvedValue(result);
    const facts = await extractSourceFacts(source, { extract }, operation);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract.mock.calls[0][0]).toMatchObject({ purpose: "memory.extract", operationId: operation.operationId, policyVersion: "policy-v1", attempt: 1, source: lineage });
    expect(facts).toEqual([{ ...result.facts[0], entities: undefined, relations: undefined, lineage }]);
    const assistant: SourceContent = { ...source, lineage: { ...lineage, role: "assistant", trust: "assistant_claim" } };
    await expect(extractSourceFacts(assistant, { extract }, operation)).rejects.toThrow("POLICY_DENIED");
    expect(extract).toHaveBeenCalledTimes(1);
    expect(() => parseSourceFactsResponse(result, assistant)).toThrow("POLICY_DENIED");
    await expect(extractSourceFacts(source, { extract }, { ...operation, source: { ...lineage, sourceRevision: 2 } })).rejects.toThrow("source does not match");
    expect(extract).toHaveBeenCalledTimes(1);
    extract.mockRejectedValueOnce(new Error("UNCERTAIN_OUTCOME"));
    await expect(extractSourceFacts(source, { extract }, operation)).rejects.toThrow("UNCERTAIN_OUTCOME");
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed structured output and attempted model source attribution", () => {
    expect(parseSourceFactsResponse({ facts: [] }, source)).toEqual([]);
    for (const output of [{}, { facts: [null] }, { facts: [{ ...result.facts[0], confidence: NaN }] },
      { facts: [{ ...result.facts[0], lineage }] }, { facts: [{ ...result.facts[0], subject: " " }] },
      { facts: [{ ...result.facts[0], entities: [{ name: "X", type: "invalid" }] }] },
      { facts: [{ ...result.facts[0], relations: [{ subject: "User", predicate: "prefers", object: "" }] }] }]) {
      expect(() => parseSourceFactsResponse(output, source)).toThrow("INVALID_INPUT");
    }
    expect(() => assertInternalModelOperation({ ...operation, attempt: 0 })).toThrow("positive attempt");
    expect(() => assertInternalModelOperation({ ...operation, policyVersion: "" })).toThrow("policy version");
  });

  it("rejects sparse arrays in every strict structured-output collection", () => {
    expect(() => parseSourceFactsResponse({ facts: Array(1) }, source)).toThrow("INVALID_INPUT");
    for (const field of ["tags", "entities", "relations"] as const) {
      expect(() => parseSourceFactsResponse({ facts: [{ ...result.facts[0], [field]: Array(1) }] }, source)).toThrow("INVALID_INPUT");
    }
    expect(() => parseSourceFactsResponse({ facts: [{ ...result.facts[0], tags: [undefined] }] }, source)).toThrow("INVALID_INPUT");
  });

  it("rejects revoked/deleted or changed authority, including deletion generations", () => {
    const snapshot: MemoryAuthoritySnapshot = { scope, principalActive: true, membershipActive: true, grantActive: true, tenantActive: true, memorySpaceActive: true };
    expect(assertMemoryAuthorityCurrent(scope, snapshot)).toBeUndefined();
    for (const flag of ["principalActive", "membershipActive", "grantActive", "tenantActive", "memorySpaceActive"] as const) {
      expect(() => assertMemoryAuthorityCurrent(scope, { ...snapshot, [flag]: false })).toThrow("FORBIDDEN");
    }
    for (const field of ["principalVersion", "membershipVersion", "grantVersion", "tenantEpoch", "memorySpaceEpoch"] as const) {
      expect(() => assertMemoryAuthorityCurrent(scope, { ...snapshot, scope: { ...scope, [field]: scope[field] + 1 } })).toThrow("FORBIDDEN");
    }
    expect(() => assertMemoryAuthorityCurrent(scope, { ...snapshot, scope: { ...scope, principalId: "other" } })).toThrow("FORBIDDEN");
  });

  it("filters cross-scope, stale, wrong-chunk and tombstoned search results", async () => {
    const prepared = await prepareSourceContent(scope, lineage, source.content, { now: () => 1000 });
    const chunk = prepared.chunks[0];
    const vector: DerivedVector = { ...lineage, vectorId: "vector", chunkId: chunk.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, profile: DEFAULT_EMBEDDING_PROFILE, embedding: Array<number>(1536).fill(0.1), processingReceiptId: "receipt" };
    expect(isCurrentAuthorizedVector(vector, prepared.source, chunk, scope)).toBe(true);
    expect(isCurrentAuthorizedVector({ ...vector, sourceRevision: 2 }, prepared.source, chunk, scope)).toBe(false);
    expect(isCurrentAuthorizedVector(vector, { ...prepared.source, tombstonedAt: 0 }, chunk, scope)).toBe(false);
    expect(isCurrentAuthorizedVector({ ...vector, tenantId: "other" }, prepared.source, chunk, scope)).toBe(false);
    expect(isCurrentAuthorizedVector(vector, prepared.source, { ...chunk, memorySpaceId: "other" }, scope)).toBe(false);
    expect(isCurrentAuthorizedVector({ ...vector, chunkId: "wrong" }, prepared.source, chunk, scope)).toBe(false);
    expect(() => isCurrentAuthorizedVector({ ...vector, profile: { ...DEFAULT_EMBEDDING_PROFILE, profileId: "same-size-other-profile" } }, prepared.source, chunk, scope)).toThrow("PROFILE_NOT_READY");
  });

  it("validates model response profile, batch count and vector shape", () => {
    const response = { profile: DEFAULT_EMBEDDING_PROFILE, vectors: [Array<number>(1536).fill(0.1)] };
    expect(validateModelEmbeddings(response, DEFAULT_EMBEDDING_PROFILE, 1)).toBeUndefined();
    expect(() => validateModelEmbeddings(response, DEFAULT_EMBEDDING_PROFILE, 2)).toThrow("count");
    expect(() => validateModelEmbeddings({ ...response, vectors: [[0.1]] }, DEFAULT_EMBEDDING_PROFILE, 1)).toThrow("finite embedding");
    expect(() => validateModelEmbeddings({ ...response, profile: { ...DEFAULT_EMBEDDING_PROFILE, modelId: "different" } }, DEFAULT_EMBEDDING_PROFILE, 1)).toThrow("PROFILE_NOT_READY");
  });

  it("rejects malformed matching vector/source/chunk identities instead of reporting currentness", async () => {
    const prepared = await prepareSourceContent(scope, lineage, source.content, { now: () => 1000 });
    const chunk = prepared.chunks[0];
    const vector: DerivedVector = { ...lineage, vectorId: "vector", chunkId: chunk.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, profile: DEFAULT_EMBEDDING_PROFILE, embedding: Array<number>(1536).fill(0.1), processingReceiptId: "receipt" };
    for (const sourceRevision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => isCurrentAuthorizedVector({ ...vector, sourceRevision }, { ...prepared.source, lineage: { ...lineage, sourceRevision } }, { ...chunk, sourceRevision }, scope)).toThrow("INVALID_INPUT");
      expect(() => isCurrentAuthorizedVector({ ...vector, sourceRevision }, prepared.source, chunk, scope)).toThrow("INVALID_INPUT");
      expect(() => isCurrentAuthorizedVector(vector, prepared.source, { ...chunk, sourceRevision }, scope)).toThrow("INVALID_INPUT");
    }
    for (const field of ["sourceId", "sourceEventId"] as const) {
      expect(() => isCurrentAuthorizedVector({ ...vector, [field]: "" }, prepared.source, chunk, scope)).toThrow("INVALID_INPUT");
      expect(() => isCurrentAuthorizedVector(vector, prepared.source, { ...chunk, [field]: "" }, scope)).toThrow("INVALID_INPUT");
    }
    for (const field of ["vectorId", "chunkId", "processingReceiptId"] as const) {
      expect(() => isCurrentAuthorizedVector({ ...vector, [field]: "" }, prepared.source, chunk, scope)).toThrow("INVALID_INPUT");
    }
    expect(() => isCurrentAuthorizedVector(vector, prepared.source, { ...chunk, chunkId: "" }, scope)).toThrow("INVALID_INPUT");
    expect(() => isCurrentAuthorizedVector(vector, { ...prepared.source, contentHash: "" }, chunk, scope)).toThrow("INVALID_INPUT");
    expect(() => isCurrentAuthorizedVector(vector, { ...prepared.source, createdAt: NaN }, chunk, scope)).toThrow("INVALID_INPUT");
  });
});
