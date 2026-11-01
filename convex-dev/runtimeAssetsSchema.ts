import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
const scope = { tenantId: v.string(), memorySpaceId: v.string() };
export const assetLineage = v.union(v.object({ kind: v.literal("upload"), requestId: v.string() }), v.object({ kind: v.literal("generated"), operationId: v.string(), modelId: v.string(), sourceVersionIds: v.optional(v.array(v.string())) }));
export const assetMediaKindValidator = v.union(v.literal("image"), v.literal("video"), v.literal("audio"), v.literal("document"), v.literal("binary"));
export const assetOwnerKind = v.union(v.literal("upload"), v.literal("artifact"), v.literal("attachment"), v.literal("agent"));
export const assetFileReference = v.object({ storageId: v.id("_storage"), assetId: v.string(), versionId: v.string(), assetVersion: v.number(), mimeType: v.string(), size: v.number(), checksum: v.string(), originalFilename: v.optional(v.string()) });
export const runtimeAssetTables = {
  runtimeAssets: defineTable({ ...scope, assetId: v.string(), ownerPrincipalId: v.string(), latestVersion: v.number(), deletedAt: v.optional(v.number()), createdAt: v.number() })
    .index("by_asset", ["tenantId", "memorySpaceId", "assetId"]).index("by_owner", ["ownerPrincipalId", "tenantId", "memorySpaceId", "assetId"]),
  runtimeAssetVersions: defineTable({ ...scope, assetId: v.string(), versionId: v.string(), assetVersion: v.number(), ownerPrincipalId: v.string(), storageId: v.id("_storage"), contentHash: v.string(), sizeBytes: v.number(), mimeType: v.string(), mediaKind: assetMediaKindValidator, filename: v.optional(v.string()), lineage: assetLineage,
    state: v.union(v.literal("ready"), v.literal("cleanup_pending"), v.literal("deleted")), cleanupAttempt: v.number(), createdAt: v.number(), deletedAt: v.optional(v.number()) })
    .index("by_version", ["tenantId", "memorySpaceId", "assetId", "assetVersion"]).index("by_version_id", ["tenantId", "memorySpaceId", "versionId"]).index("by_storage", ["storageId"]).index("by_cleanup", ["state", "createdAt"]),
  runtimeAssetReferences: defineTable({ ...scope, versionId: v.string(), kind: assetOwnerKind, ownerId: v.string(), ownerVersion: v.string(), ownerPrincipalId: v.string(), conversationId: v.optional(v.string()), active: v.boolean(), createdAt: v.number() })
    .index("by_version", ["tenantId", "memorySpaceId", "versionId", "active"]).index("by_owner", ["tenantId", "memorySpaceId", "kind", "ownerId", "ownerVersion"]).index("by_principal", ["ownerPrincipalId", "tenantId", "memorySpaceId", "ownerId"]).index("by_scope", ["tenantId", "memorySpaceId", "ownerId"]).index("by_conversation", ["tenantId", "memorySpaceId", "conversationId", "ownerId"]),
  runtimeAssetJobs: defineTable({ ...scope, jobId: v.string(), requestId: v.string(), assetId: v.string(), assetVersion: v.number(), versionId: v.string(), ownerPrincipalId: v.string(), reference: runtimeAuthorityReference, contentHash: v.string(), sizeBytes: v.number(), mimeType: v.string(), filename: v.optional(v.string()), lineage: assetLineage, marker: v.string(), storageId: v.optional(v.id("_storage")),
    state: v.union(v.literal("uploading"), v.literal("ready"), v.literal("cancelled"), v.literal("failed")), leaseExpiresAt: v.number(), createdAt: v.number(), failureCode: v.optional(v.string()), cleanupAttempt: v.optional(v.number()) })
    .index("by_request", ["tenantId", "memorySpaceId", "ownerPrincipalId", "requestId"]).index("by_job", ["jobId"]).index("by_owner", ["ownerPrincipalId", "jobId"]).index("by_scope", ["tenantId", "memorySpaceId", "jobId"]),
};
