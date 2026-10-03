/** Fresh logical source/chunk/vector stores; no legacy vector adoption. */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const sourceReference = { sourceId: v.string(), sourceEventId: v.string(), sourceRevision: v.number() };
export const sourceLineage = v.union(
  v.object({ ...sourceReference, role: v.literal("user"), trust: v.literal("user_assertion") }),
  v.object({ ...sourceReference, role: v.literal("assistant"), trust: v.literal("assistant_claim") }),
  v.object({ ...sourceReference, role: v.literal("tool"), trust: v.literal("verified_tool_evidence"), operationId: v.string() }),
);
export const embeddingProfile = v.object({
  profileId: v.string(), modelId: v.string(), dimensions: v.number(),
  normalization: v.string(), chunking: v.string(), indexName: v.string(),
});
export const sourceContent = v.object({
  tenantId: v.string(), memorySpaceId: v.string(), ownerPrincipalId: v.string(),
  lineage: sourceLineage, content: v.string(), contentHash: v.string(), createdAt: v.number(),
  tombstonedAt: v.optional(v.number()),
});
export const sourceChunk = v.object({
  ...sourceReference, chunkId: v.string(), tenantId: v.string(), memorySpaceId: v.string(),
  profileId: v.string(), ordinal: v.number(), start: v.number(), end: v.number(),
  text: v.string(), textHash: v.string(),
});
export const derivedVector = v.object({
  ...sourceReference, vectorId: v.string(), chunkId: v.string(), tenantId: v.string(),
  memorySpaceId: v.string(), profile: embeddingProfile, embedding: v.array(v.float64()),
  processingReceiptId: v.string(),
});
export const processingIdentity = v.object({
  ...sourceReference, stage: v.union(v.literal("extract"), v.literal("facts"), v.literal("vectors")),
  semanticPolicyVersion: v.string(),
});
const factType = v.union(v.literal("preference"), v.literal("identity"), v.literal("knowledge"),
  v.literal("relationship"), v.literal("event"), v.literal("observation"), v.literal("custom"));
export const derivedFact = v.object({
  _id: v.string(), factId: v.string(), tenantId: v.optional(v.string()), memorySpaceId: v.string(),
  ownerPrincipalId: v.string(), lineage: sourceLineage, extractionPolicyVersion: v.string(),
  fact: v.string(), factType, subject: v.optional(v.string()), predicate: v.optional(v.string()),
  object: v.optional(v.string()), confidence: v.number(),
  sourceType: v.union(v.literal("conversation"), v.literal("system"), v.literal("tool"), v.literal("manual"), v.literal("a2a")),
  tags: v.array(v.string()), version: v.number(), createdAt: v.number(), updatedAt: v.number(),
  validFrom: v.optional(v.number()), validUntil: v.optional(v.number()),
  supersededBy: v.optional(v.string()), supersedes: v.optional(v.string()),
  userId: v.optional(v.string()), participantId: v.optional(v.string()),
  entities: v.optional(v.array(v.object({ name: v.string(), type: v.string(), fullValue: v.optional(v.string()) }))),
  relations: v.optional(v.array(v.object({ subject: v.string(), predicate: v.string(), object: v.string() }))),
});
export const commitDerivedInput = v.object({
  source: v.object(sourceReference), identity: processingIdentity,
  chunks: v.optional(v.array(sourceChunk)), vectors: v.optional(v.array(derivedVector)),
  facts: v.optional(v.array(derivedFact)), expectedFactVersions: v.optional(v.record(v.string(), v.number())),
});

export const runtimeMemoryTables = {
  runtimeMemorySources: defineTable(sourceContent.fields)
    .index("by_scope_source", ["tenantId", "memorySpaceId", "lineage.sourceId"])
    .index("by_scope_event", ["tenantId", "memorySpaceId", "lineage.sourceEventId"]),
  runtimeMemoryChunks: defineTable(sourceChunk.fields)
    .index("by_scope_chunk", ["tenantId", "memorySpaceId", "chunkId"]),
  runtimeMemoryVectors: defineTable({ ...derivedVector.fields, profileId: v.string(), scopeProfileKey: v.string(),
    ownerPrincipalId: v.string(), scopeProfileOwnerKey: v.string() })
    .index("by_scope_vector", ["tenantId", "memorySpaceId", "vectorId"])
    .index("by_scope_source_revision", ["tenantId", "memorySpaceId", "sourceId", "sourceRevision"])
    .vectorIndex("by_default_embedding_v1", { vectorField: "embedding", dimensions: 1536,
      filterFields: ["tenantId", "memorySpaceId", "profileId", "scopeProfileKey", "scopeProfileOwnerKey"] }),
  runtimeMemoryReceipts: defineTable({
    tenantId: v.string(), memorySpaceId: v.string(), receiptId: v.string(),
    identity: processingIdentity, canonicalIdentity: v.string(), canonicalPayload: v.string(), createdAt: v.number(),
  }).index("by_scope_receipt", ["tenantId", "memorySpaceId", "receiptId"]),
};
