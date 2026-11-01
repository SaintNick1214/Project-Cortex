/** External projection metadata. Graph data remains in the external service. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { embeddingProfile } from "./runtimeMemorySchema";
const scope = { tenantId: v.string(), memorySpaceId: v.string() };
export const graphLease = { ...scope, connectorId: v.string(), jobId: v.string(), workerId: v.string(), leaseVersion: v.number() };
export const graphReceipt = v.object({ version: v.literal(1), connectorId: v.string(), jobId: v.string(), payloadHash: v.string(),
  ...scope, sourceId: v.string(), tenantEpoch: v.number(), memorySpaceEpoch: v.number(), revision: v.number(),
  state: v.union(v.literal("applied"), v.literal("duplicate"), v.literal("stale")), currentRevision: v.number() });
export const runtimeGraphTables = {
  runtimeGraphConnectors: defineTable({ ...scope, connectorId: v.string(), workerPrincipalId: v.string(), enabled: v.boolean(),
    workerTenantId: v.string(), workerMemorySpaceId: v.string(),
    createdAt: v.number() }).index("by_connector", ["tenantId", "memorySpaceId", "connectorId"])
    .index("by_scope", ["tenantId", "memorySpaceId"]),
  runtimeGraphScopes: defineTable({ ...scope, sequence: v.number(), profileThrough: v.optional(v.record(v.string(), v.number())),
    pendingRetirements: v.optional(v.number()), updatedAt: v.number() }).index("by_scope", ["tenantId", "memorySpaceId"]),
  runtimeGraphDependencies: defineTable({ ...scope, sourceId: v.string(), dependentSourceId: v.string(), dependentRevision: v.number() })
    .index("by_upstream", ["tenantId", "memorySpaceId", "sourceId", "dependentSourceId"])
    .index("by_dependent", ["tenantId", "memorySpaceId", "dependentSourceId"]),
  runtimeGraphRevisions: defineTable({ ...scope, revision: v.number(), sourceId: v.string(), profileId: v.string(),
    state: v.union(v.literal("pending"), v.literal("complete"), v.literal("failed"), v.literal("skipped")) })
    .index("by_scope_revision", ["tenantId", "memorySpaceId", "revision"]),
  runtimeGraphSources: defineTable({ ...scope, sourceId: v.string(), sourceEventId: v.string(), sourceRevision: v.number(),
    ownerPrincipalId: v.string(), conversationId: v.optional(v.string()), contentHash: v.string(), revision: v.number(), payloadHash: v.string(), profile: embeddingProfile,
    operation: v.union(v.literal("replace"), v.literal("tombstone")), authorityReference: v.optional(runtimeAuthorityReference),
    failureCode: v.optional(v.string()),
    state: v.union(v.literal("pending"), v.literal("complete"), v.literal("dead_letter")), updatedAt: v.number() })
    .index("by_source", ["tenantId", "memorySpaceId", "sourceId"])
    .index("by_scope", ["tenantId", "memorySpaceId"])
    .index("by_tenant_source", ["tenantId", "sourceId", "memorySpaceId"])
    .index("by_conversation", ["tenantId", "memorySpaceId", "conversationId", "sourceId"])
    .index("by_grant", ["authorityReference.grantId", "tenantId", "memorySpaceId", "sourceId"])
    .index("by_principal", ["authorityReference.principalId", "tenantId", "memorySpaceId", "sourceId"])
    .index("by_membership", ["authorityReference.membershipId", "tenantId", "memorySpaceId", "sourceId"]),
  runtimeGraphPayloads: defineTable({ ...scope, revision: v.number(), payloadCanonical: v.string() })
    .index("by_revision", ["tenantId", "memorySpaceId", "revision"]),
  runtimeGraphOutbox: defineTable({ ...scope, connectorId: v.string(), jobId: v.string(), sourceId: v.string(), revision: v.number(),
    payloadHash: v.string(), state: v.union(v.literal("pending"), v.literal("running"), v.literal("complete"), v.literal("dead_letter"), v.literal("superseded")),
    attempt: v.number(), leaseVersion: v.number(), workerId: v.optional(v.string()), leaseExpiresAt: v.optional(v.number()),
    retryAt: v.number(), failureCode: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number() })
    .index("by_job", ["tenantId", "memorySpaceId", "connectorId", "jobId"])
    .index("by_queue", ["tenantId", "memorySpaceId", "connectorId", "state", "revision"])
    .index("by_source", ["tenantId", "memorySpaceId", "sourceId", "connectorId"]),
  runtimeGraphReceipts: defineTable({ ...scope, connectorId: v.string(), jobId: v.string(), receiptCanonical: v.string(),
    payloadHash: v.string(), revision: v.number(), createdAt: v.number() }).index("by_job", ["tenantId", "memorySpaceId", "connectorId", "jobId"]),
  runtimeGraphReads: defineTable({ ...scope, requestId: v.string(), sourceId: v.string(), profile: embeddingProfile,
    sourceRevision: v.number(), contentHash: v.string(), graphRevision: v.number(), connectorId: v.string(),
    authorityReference: runtimeAuthorityReference, limit: v.number(), state: v.union(v.literal("pending"), v.literal("running"), v.literal("complete"), v.literal("failed")),
    workerId: v.optional(v.string()), leaseVersion: v.number(), leaseExpiresAt: v.optional(v.number()), factIds: v.optional(v.array(v.string())), createdAt: v.number() })
    .index("by_request", ["tenantId", "memorySpaceId", "requestId"])
    .index("by_queue", ["tenantId", "memorySpaceId", "connectorId", "state", "createdAt"]),
};
