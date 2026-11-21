/** Additive immutable external custody, independent from normalized retrieval generations. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
const scope = { tenantId: v.string(), memorySpaceId: v.string() };
const owned = { ...scope, ownerPrincipalId: v.string() };
export const runtimeExternalTables = {
  runtimeExternalSources: defineTable({ ...owned, sourceId: v.string(), identityCanonical: v.string(), provider: v.string(), externalSourceId: v.string(),
    maxExternalRevision: v.number(), currentVersionId: v.string(), currentSourceRevision: v.optional(v.number()),
    tombstonedAt: v.optional(v.number()), erasedAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number() })
    .index("by_source", ["tenantId", "memorySpaceId", "sourceId"])
    .index("by_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId", "sourceId"])
    .index("by_principal", ["ownerPrincipalId", "tenantId", "memorySpaceId", "sourceId"])
    .index("by_tenant_source", ["tenantId", "sourceId", "memorySpaceId"])
    .index("by_principal_erasure", ["ownerPrincipalId", "erasedAt", "tenantId", "memorySpaceId", "sourceId"])
    .index("by_scope_erasure", ["tenantId", "memorySpaceId", "erasedAt", "sourceId"])
    .index("by_tenant_erasure", ["tenantId", "erasedAt", "memorySpaceId", "sourceId"]),
  runtimeExternalVersions: defineTable({ ...owned, sourceId: v.string(), versionId: v.string(), externalRevision: v.number(),
    kind: v.union(v.literal("content"), v.literal("tombstone")), detailsCanonical: v.string(), originalText: v.optional(v.string()),
    originalContentHash: v.optional(v.string()), normalizedContentHash: v.optional(v.string()),
    sourceRevision: v.optional(v.number()), ingestionEventId: v.optional(v.string()), sequence: v.number(), ownerSequence: v.number(), capturedAt: v.number() })
    .index("by_version", ["tenantId", "memorySpaceId", "sourceId", "versionId"])
    .index("by_revision", ["tenantId", "memorySpaceId", "sourceId", "externalRevision"])
    .index("by_source", ["tenantId", "memorySpaceId", "sourceId"])
    .index("by_scope_sequence", ["tenantId", "memorySpaceId", "sequence"])
    .index("by_owner_sequence", ["tenantId", "memorySpaceId", "ownerPrincipalId", "ownerSequence"])
    .searchIndex("by_original_text", { searchField: "originalText", filterFields: ["tenantId", "memorySpaceId", "ownerPrincipalId"] }),
  runtimeExternalObservations: defineTable({ ...owned, sourceId: v.string(), versionId: v.string(), receiptId: v.string(), provider: v.string(),
    externalEventId: v.string(), observationCanonical: v.string(), receiptCanonical: v.string(), sequence: v.number(), ownerSequence: v.number() })
    .index("by_event", ["tenantId", "memorySpaceId", "ownerPrincipalId", "provider", "externalEventId"])
    .index("by_receipt", ["tenantId", "memorySpaceId", "receiptId"])
    .index("by_source_sequence", ["tenantId", "memorySpaceId", "sourceId", "sequence"])
    .index("by_source_owner_sequence", ["tenantId", "memorySpaceId", "sourceId", "ownerSequence"]),
  runtimeExternalCounters: defineTable({ ...scope, streamOwner: v.string(), kind: v.union(v.literal("versions"), v.literal("observations")), sequence: v.number() })
    .index("by_stream", ["tenantId", "memorySpaceId", "streamOwner", "kind"]),
  runtimeExternalReadCursors: defineTable({ ...scope, principalId: v.string(), token: v.string(), kind: v.union(v.literal("history"), v.literal("search")),
    visibility: v.string(), bindingCanonical: v.string(), position: v.number(), through: v.number(), watermark: v.string(), createdAt: v.number(), invalidatedAt: v.optional(v.number()), erasureEpoch: v.optional(v.number()) })
    .index("by_token", ["token"])
    .index("by_scope", ["tenantId", "memorySpaceId", "principalId"])
    .index("by_visibility", ["tenantId", "memorySpaceId", "visibility", "principalId"]),
  /** Minimal identity fence survives physical policy erasure. It contains no source text or external identifiers. */
  runtimeExternalErasureFences: defineTable({ ...owned, sourceId: v.string(), erasedAt: v.number() })
    .index("by_source", ["tenantId", "memorySpaceId", "sourceId"]),
};
