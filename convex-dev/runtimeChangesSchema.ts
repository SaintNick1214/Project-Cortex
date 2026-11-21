/** Private, durable external-source change positions. Sequence numbers never cross the public boundary. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
const scope = { tenantId: v.string(), memorySpaceId: v.string() };
export const runtimeChangesTables = {
  runtimeChangeHeads: defineTable({ ...scope, streamOwner: v.string(), sequence: v.number(), erasureEpoch: v.number(), nonce: v.string() })
    .index("by_stream", ["tenantId", "memorySpaceId", "streamOwner"]),
  runtimeChangeEvents: defineTable({ ...scope, eventId: v.string(), ownerPrincipalId: v.string(), sourceId: v.string(),
    identityCanonical: v.string(), payloadCanonical: v.string(), sequence: v.number(), ownerSequence: v.number() })
    .index("by_event", ["tenantId", "memorySpaceId", "eventId"])
    .index("by_scope_sequence", ["tenantId", "memorySpaceId", "sequence"])
    .index("by_owner_sequence", ["tenantId", "memorySpaceId", "ownerPrincipalId", "ownerSequence"])
    .index("by_source", ["tenantId", "memorySpaceId", "sourceId"]),
  runtimeChangeCursors: defineTable({ ...scope, token: v.string(), principalId: v.string(), visibility: v.string(),
    filterCanonical: v.string(), position: v.number(), through: v.number(), watermark: v.string(), erasureEpoch: v.number(),
    complete: v.boolean(), createdAt: v.number(), invalidatedAt: v.optional(v.number()) })
    .index("by_token", ["token"]),
  runtimeExternalErasureJobs: defineTable({ ...scope, sourceId: v.string(), ownerPrincipalId: v.string(), phase: v.string(),
    complete: v.boolean(), createdAt: v.number(), updatedAt: v.number() })
    .index("by_source", ["tenantId", "memorySpaceId", "sourceId"]),
  runtimeExternalAuthorityErasureJobs: defineTable({ jobId: v.string(), principalId: v.optional(v.string()), tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), after: v.optional(v.string()), complete: v.boolean(), createdAt: v.number(), updatedAt: v.number() })
    .index("by_job", ["jobId"]),
};
