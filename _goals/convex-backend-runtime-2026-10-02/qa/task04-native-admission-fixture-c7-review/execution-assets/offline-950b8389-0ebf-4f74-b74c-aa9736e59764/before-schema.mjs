// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/before-schema.ts
import { defineSchema, defineTable as defineTable3 } from "convex/server";
import { v as v3 } from "convex/values";

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeAuthSchema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
var runtimeCapability = v.union(
  v.literal("read"),
  v.literal("write"),
  v.literal("run"),
  v.literal("admin"),
  v.literal("tool"),
  v.literal("storage:read"),
  v.literal("storage:write")
);
var runtimeResourceAccess = v.union(v.literal("own"), v.literal("space"), v.literal("tenant"));
var runtimeActorKind = v.union(v.literal("user"), v.literal("service"));
var runtimeResourceType = v.union(
  v.literal("tenant"),
  v.literal("memorySpace"),
  v.literal("conversation"),
  v.literal("memory"),
  v.literal("fact"),
  v.literal("artifact"),
  v.literal("attachment"),
  v.literal("source"),
  v.literal("run"),
  v.literal("context"),
  v.literal("storage")
);
var runtimeAuthorityReference = v.object({
  principalId: v.string(),
  principalVersion: v.number(),
  membershipId: v.string(),
  membershipVersion: v.number(),
  grantId: v.string(),
  grantVersion: v.number(),
  tenantId: v.string(),
  tenantEpoch: v.number(),
  memorySpaceId: v.optional(v.string()),
  memorySpaceEpoch: v.optional(v.number())
});
var runtimeResource = v.object({
  resourceType: runtimeResourceType,
  resourceId: v.string(),
  tenantId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),
  ownerPrincipalId: v.optional(v.string())
});
var runtimeAuthorityRequirement = v.object({
  capability: runtimeCapability,
  tenantId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),
  resource: v.optional(runtimeResource),
  actorKind: v.optional(runtimeActorKind)
});
var runtimeAuthTables = {
  runtimeAuthPrincipals: defineTable({
    issuer: v.string(),
    subject: v.string(),
    actorKind: runtimeActorKind,
    metadataUserId: v.optional(v.string()),
    version: v.number(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number())
  }).index("by_issuer_subject", ["issuer", "subject"]),
  runtimeAuthMemberships: defineTable({
    principalId: v.id("runtimeAuthPrincipals"),
    tenantId: v.string(),
    version: v.number(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number())
  }).index("by_principal_tenant", ["principalId", "tenantId"]),
  runtimeAuthScopes: defineTable({
    tenantId: v.string(),
    memorySpaceId: v.optional(v.string()),
    epoch: v.number(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number())
  }).index("by_tenant_space", ["tenantId", "memorySpaceId"]),
  runtimeAuthGrants: defineTable({
    principalId: v.id("runtimeAuthPrincipals"),
    membershipId: v.id("runtimeAuthMemberships"),
    tenantId: v.string(),
    memorySpaceId: v.optional(v.string()),
    tenantEpoch: v.number(),
    memorySpaceEpoch: v.optional(v.number()),
    capabilities: v.array(runtimeCapability),
    resourceAccess: runtimeResourceAccess,
    version: v.number(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number())
  }).index("by_membership", ["membershipId"]).index("by_membership_scope_version", ["membershipId", "memorySpaceId", "version"]),
  runtimeAuthTombstones: defineTable({
    tenantId: v.string(),
    memorySpaceId: v.optional(v.string()),
    resourceType: runtimeResourceType,
    resourceId: v.string(),
    deletedAt: v.number()
  }).index("by_resource", ["tenantId", "memorySpaceId", "resourceType", "resourceId"])
};

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeMemorySchema.ts
import { defineTable as defineTable2 } from "convex/server";
import { v as v2 } from "convex/values";
var sourceReference = { sourceId: v2.string(), sourceEventId: v2.string(), sourceRevision: v2.number() };
var sourceLineage = v2.union(
  v2.object({ ...sourceReference, role: v2.literal("user"), trust: v2.literal("user_assertion") }),
  v2.object({ ...sourceReference, role: v2.literal("assistant"), trust: v2.literal("assistant_claim") }),
  v2.object({ ...sourceReference, role: v2.literal("tool"), trust: v2.literal("verified_tool_evidence"), operationId: v2.string() })
);
var embeddingProfile = v2.object({
  profileId: v2.string(),
  modelId: v2.string(),
  dimensions: v2.number(),
  normalization: v2.string(),
  chunking: v2.string(),
  indexName: v2.string()
});
var sourceContent = v2.object({
  tenantId: v2.string(),
  memorySpaceId: v2.string(),
  ownerPrincipalId: v2.string(),
  lineage: sourceLineage,
  content: v2.string(),
  contentHash: v2.string(),
  createdAt: v2.number(),
  tombstonedAt: v2.optional(v2.number())
});
var sourceChunk = v2.object({
  ...sourceReference,
  chunkId: v2.string(),
  tenantId: v2.string(),
  memorySpaceId: v2.string(),
  profileId: v2.string(),
  ordinal: v2.number(),
  start: v2.number(),
  end: v2.number(),
  text: v2.string(),
  textHash: v2.string()
});
var derivedVector = v2.object({
  ...sourceReference,
  vectorId: v2.string(),
  chunkId: v2.string(),
  tenantId: v2.string(),
  memorySpaceId: v2.string(),
  profile: embeddingProfile,
  embedding: v2.array(v2.float64()),
  processingReceiptId: v2.string()
});
var processingIdentity = v2.object({
  ...sourceReference,
  stage: v2.union(v2.literal("extract"), v2.literal("facts"), v2.literal("vectors")),
  semanticPolicyVersion: v2.string()
});
var factType = v2.union(
  v2.literal("preference"),
  v2.literal("identity"),
  v2.literal("knowledge"),
  v2.literal("relationship"),
  v2.literal("event"),
  v2.literal("observation"),
  v2.literal("custom")
);
var derivedFact = v2.object({
  _id: v2.string(),
  factId: v2.string(),
  tenantId: v2.optional(v2.string()),
  memorySpaceId: v2.string(),
  ownerPrincipalId: v2.string(),
  lineage: sourceLineage,
  extractionPolicyVersion: v2.string(),
  fact: v2.string(),
  factType,
  subject: v2.optional(v2.string()),
  predicate: v2.optional(v2.string()),
  object: v2.optional(v2.string()),
  confidence: v2.number(),
  sourceType: v2.union(v2.literal("conversation"), v2.literal("system"), v2.literal("tool"), v2.literal("manual"), v2.literal("a2a")),
  tags: v2.array(v2.string()),
  version: v2.number(),
  createdAt: v2.number(),
  updatedAt: v2.number(),
  validFrom: v2.optional(v2.number()),
  validUntil: v2.optional(v2.number()),
  supersededBy: v2.optional(v2.string()),
  supersedes: v2.optional(v2.string()),
  userId: v2.optional(v2.string()),
  participantId: v2.optional(v2.string()),
  entities: v2.optional(v2.array(v2.object({ name: v2.string(), type: v2.string(), fullValue: v2.optional(v2.string()) }))),
  relations: v2.optional(v2.array(v2.object({ subject: v2.string(), predicate: v2.string(), object: v2.string() })))
});
var commitDerivedInput = v2.object({
  source: v2.object(sourceReference),
  identity: processingIdentity,
  chunks: v2.optional(v2.array(sourceChunk)),
  vectors: v2.optional(v2.array(derivedVector)),
  facts: v2.optional(v2.array(derivedFact)),
  expectedFactVersions: v2.optional(v2.record(v2.string(), v2.number()))
});
var runtimeMemoryTables = {
  runtimeMemorySources: defineTable2(sourceContent.fields).index("by_scope_source", ["tenantId", "memorySpaceId", "lineage.sourceId"]).index("by_scope_event", ["tenantId", "memorySpaceId", "lineage.sourceEventId"]),
  runtimeMemoryChunks: defineTable2(sourceChunk.fields).index("by_scope_chunk", ["tenantId", "memorySpaceId", "chunkId"]),
  runtimeMemoryVectors: defineTable2({
    ...derivedVector.fields,
    profileId: v2.string(),
    scopeProfileKey: v2.string(),
    ownerPrincipalId: v2.string(),
    scopeProfileOwnerKey: v2.string()
  }).index("by_scope_vector", ["tenantId", "memorySpaceId", "vectorId"]).index("by_scope_source_revision", ["tenantId", "memorySpaceId", "sourceId", "sourceRevision"]).vectorIndex("by_default_embedding_v1", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["tenantId", "memorySpaceId", "profileId", "scopeProfileKey", "scopeProfileOwnerKey"]
  }),
  runtimeMemoryReceipts: defineTable2({
    tenantId: v2.string(),
    memorySpaceId: v2.string(),
    receiptId: v2.string(),
    identity: processingIdentity,
    canonicalIdentity: v2.string(),
    canonicalPayload: v2.string(),
    createdAt: v2.number()
  }).index("by_scope_receipt", ["tenantId", "memorySpaceId", "receiptId"])
};

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/before-schema.ts
var before_schema_default = defineSchema({
  ...runtimeAuthTables,
  ...runtimeMemoryTables,
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1a: Conversations (ACID, Immutable)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversations: defineTable3({
    // Identity
    conversationId: v3.string(),
    // Unique ID (e.g., "conv-abc123")
    // Memory Space (NEW - fundamental isolation boundary)
    memorySpaceId: v3.string(),
    // Which memory space owns this conversation
    participantId: v3.optional(v3.string()),
    // Hive Mode: which participant created this
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v3.optional(v3.string()),
    // Tenant ID for isolation
    // Type: user-agent (user ↔ participant) or agent-agent (space ↔ space)
    type: v3.union(v3.literal("user-agent"), v3.literal("agent-agent")),
    // Participants (based on type)
    participants: v3.object({
      // user-agent conversations (single user)
      userId: v3.optional(v3.string()),
      // The primary human user in the conversation
      agentId: v3.optional(v3.string()),
      // The agent/assistant in the conversation
      // Collaborative conversations (Phase 4) - multiple human participants
      userIds: v3.optional(v3.array(v3.string())),
      // Multiple human users
      // Hive Mode tracking (which tool/agent in shared space created this)
      participantId: v3.optional(v3.string()),
      // agent-agent conversations (Collaboration Mode - cross-space)
      memorySpaceIds: v3.optional(v3.array(v3.string()))
      // Both spaces involved
    }),
    // Collaborative settings (Phase 4)
    collaborativeSettings: v3.optional(
      v3.object({
        // Whether messages from non-owners require approval
        requireApproval: v3.boolean(),
        // The owner who can approve messages (defaults to first userId/userIds[0])
        ownerUserId: v3.optional(v3.string()),
        // IDs of approved participants (others require approval)
        approvedParticipants: v3.optional(v3.array(v3.string()))
      })
    ),
    // Messages (append-only, immutable)
    messages: v3.array(
      v3.object({
        id: v3.string(),
        // Message ID
        role: v3.union(
          v3.literal("user"),
          v3.literal("agent"),
          v3.literal("system")
        ),
        content: v3.string(),
        timestamp: v3.number(),
        // Optional fields
        participantId: v3.optional(v3.string()),
        // Which participant sent this (Hive Mode/Collaborative)
        metadata: v3.optional(v3.any()),
        // Flexible metadata
        attachmentIds: v3.optional(v3.array(v3.string())),
        // Multi-modal attachment references
        // Collaborative approval (Phase 4)
        approvalStatus: v3.optional(
          v3.union(
            v3.literal("pending"),
            v3.literal("approved"),
            v3.literal("rejected")
          )
        ),
        approvedBy: v3.optional(v3.string()),
        // userId who approved
        approvedAt: v3.optional(v3.number())
        // Approval timestamp
      })
    ),
    // Statistics
    messageCount: v3.number(),
    // Metadata (flexible)
    metadata: v3.optional(v3.any()),
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number(),
    // Visibility for shareable chats (Phase 1)
    // - 'private': Only owner can access (default)
    // - 'space': Anyone in the memory space can access
    // - 'public': Anyone with the conversationId can access
    visibility: v3.optional(
      v3.union(
        v3.literal("private"),
        v3.literal("space"),
        v3.literal("public")
      )
    )
  }).index("by_conversationId", ["conversationId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_type", ["type"]).index("by_user", ["participants.userId"]).index("by_agent", ["participants.agentId"]).index("by_memorySpace_user", ["memorySpaceId", "participants.userId"]).index("by_memorySpace_agent", ["memorySpaceId", "participants.agentId"]).index("by_created", ["createdAt"]).index("by_visibility", ["visibility"]).index("by_memorySpace_visibility", ["memorySpaceId", "visibility"]),
  // Space + visibility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Shares (Shareable Chats Phase 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationShares: defineTable3({
    // Identity
    shareId: v3.string(),
    // Public-facing identifier for share links
    conversationId: v3.string(),
    // Granter (owner)
    grantedBy: v3.string(),
    // userId who shared
    sourceMemorySpaceId: v3.string(),
    // Recipient(s)
    grantType: v3.union(
      v3.literal("user"),
      // Specific user
      v3.literal("space"),
      // Entire memory space
      v3.literal("link"),
      // Anyone with link
      v3.literal("domain")
      // Anyone from email domain
    ),
    grantedTo: v3.optional(v3.string()),
    // userId, memorySpaceId, or domain
    // Permissions
    permissions: v3.object({
      canView: v3.boolean(),
      // See messages
      canViewFacts: v3.boolean(),
      // See extracted facts
      canViewMemories: v3.boolean(),
      // See related memories
      canContinue: v3.boolean(),
      // Add new messages
      canFork: v3.boolean(),
      // Create a copy
      canExport: v3.boolean()
      // Download transcript
    }),
    // Constraints
    expiresAt: v3.optional(v3.number()),
    // Time-limited sharing
    maxViews: v3.optional(v3.number()),
    // View-limited sharing
    viewCount: v3.number(),
    // Redaction
    redactBefore: v3.optional(v3.number()),
    // Hide messages before timestamp
    redactSensitive: v3.boolean(),
    // Auto-redact PII
    // Status
    status: v3.union(
      v3.literal("active"),
      v3.literal("revoked"),
      v3.literal("expired")
    ),
    // Multi-tenancy
    tenantId: v3.optional(v3.string()),
    // Timestamps
    createdAt: v3.number(),
    revokedAt: v3.optional(v3.number())
  }).index("by_shareId", ["shareId"]).index("by_conversation", ["conversationId"]).index("by_grantedTo", ["grantedTo"]).index("by_grantedBy", ["grantedBy"]).index("by_status", ["status"]).index("by_tenant_shareId", ["tenantId", "shareId"]).index("by_tenant_conversation", ["tenantId", "conversationId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Snapshots (Shareable Chats Phase 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationSnapshots: defineTable3({
    // Identity
    snapshotId: v3.string(),
    conversationId: v3.string(),
    // Source conversation
    // Snapshot content (immutable after creation)
    messages: v3.array(
      v3.object({
        id: v3.string(),
        role: v3.union(
          v3.literal("user"),
          v3.literal("agent"),
          v3.literal("system")
        ),
        content: v3.string(),
        timestamp: v3.number(),
        participantId: v3.optional(v3.string())
        // Note: PII-redacted version stored here
      })
    ),
    // Original conversation metadata
    conversationType: v3.union(
      v3.literal("user-agent"),
      v3.literal("agent-agent")
    ),
    participants: v3.object({
      userId: v3.optional(v3.string()),
      agentId: v3.optional(v3.string()),
      participantId: v3.optional(v3.string()),
      memorySpaceIds: v3.optional(v3.array(v3.string()))
    }),
    // Snapshot metadata
    messageCount: v3.number(),
    // What was included
    includedContent: v3.object({
      messages: v3.boolean(),
      facts: v3.boolean(),
      memories: v3.boolean()
    }),
    // Redaction info
    redaction: v3.object({
      piiRedacted: v3.boolean(),
      messagesRedactedBefore: v3.optional(v3.number()),
      // Timestamp
      customRedactions: v3.optional(
        v3.array(
          v3.object({
            pattern: v3.string(),
            replacement: v3.string()
          })
        )
      )
    }),
    // Associated facts snapshot (if included)
    facts: v3.optional(
      v3.array(
        v3.object({
          factId: v3.string(),
          fact: v3.string(),
          factType: v3.string(),
          confidence: v3.number()
        })
      )
    ),
    // Owner info
    createdBy: v3.string(),
    // userId
    memorySpaceId: v3.string(),
    // Multi-tenancy
    tenantId: v3.optional(v3.string()),
    // Status
    status: v3.union(
      v3.literal("active"),
      v3.literal("archived"),
      v3.literal("deleted")
    ),
    // Timestamps
    createdAt: v3.number(),
    snapshotOf: v3.number()
    // Timestamp of when the snapshot was taken
  }).index("by_snapshotId", ["snapshotId"]).index("by_conversation", ["conversationId"]).index("by_createdBy", ["createdBy"]).index("by_memorySpace", ["memorySpaceId"]).index("by_status", ["status"]).index("by_tenant_snapshotId", ["tenantId", "snapshotId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1b: Immutable Store (ACID, Versioned, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  immutable: defineTable3({
    // Identity (composite key: type + id)
    type: v3.string(),
    // Entity type: 'kb-article', 'policy', 'audit-log', 'feedback', 'user'
    id: v3.string(),
    // Type-specific logical ID
    // Data (flexible, immutable once stored)
    data: v3.any(),
    // GDPR support (optional)
    userId: v3.optional(v3.string()),
    // Links to user for cascade deletion
    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v3.optional(v3.string()),
    // Trusted tenant selector
    ownerPrincipalId: v3.optional(v3.string()),
    tombstonedAt: v3.optional(v3.number()),
    memorySpaceId: v3.optional(v3.string()),
    // Optional trusted grant scope
    // Versioning
    version: v3.number(),
    // Current version number (starts at 1)
    previousVersions: v3.array(
      v3.object({
        version: v3.number(),
        data: v3.any(),
        timestamp: v3.number(),
        metadata: v3.optional(v3.any())
      })
    ),
    // Metadata (flexible - any JSON-serializable object)
    metadata: v3.optional(v3.any()),
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number()
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "type", "id"]).index("by_type_id", ["type", "id"]).index("by_type", ["type"]).index("by_tenantId", ["tenantId"]).index("by_tenant_type_id", ["tenantId", "type", "id"]).index("by_userId", ["userId"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1c: Mutable Store (ACID, No Versioning, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mutable: defineTable3({
    // Composite key: namespace + key
    namespace: v3.string(),
    // Logical grouping: 'inventory', 'config', 'counters', etc.
    key: v3.string(),
    // Unique key within namespace
    // Value (flexible, mutable)
    value: v3.any(),
    // GDPR support (optional)
    userId: v3.optional(v3.string()),
    // Links to user for cascade deletion
    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v3.optional(v3.string()),
    // Trusted tenant selector
    ownerPrincipalId: v3.optional(v3.string()),
    tombstonedAt: v3.optional(v3.number()),
    memorySpaceId: v3.optional(v3.string()),
    // Optional trusted grant scope
    // Metadata (optional)
    metadata: v3.optional(v3.any()),
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number()
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "namespace", "key"]).index("by_namespace_key", ["namespace", "key"]).index("by_namespace", ["namespace"]).index("by_tenantId", ["tenantId"]).index("by_tenant_namespace", ["tenantId", "namespace"]).index("by_tenant_namespace_key", ["tenantId", "namespace", "key"]).index("by_userId", ["userId"]).index("by_updated", ["updatedAt"]),
  // Recent changes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 2: Vector Memory (Searchable, memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memories: defineTable3({
    // Fresh runtime ownership/provenance; old unowned rows are never adopted.
    ownerPrincipalId: v3.optional(v3.string()),
    runtimeEditor: v3.optional(v3.object({ principalId: v3.string(), userId: v3.string(), editedAt: v3.number() })),
    manualSourceBinding: v3.optional(v3.object({ resourceType: v3.union(v3.literal("memory"), v3.literal("fact")), resourceId: v3.string() })),
    lineage: v3.optional(sourceLineage),
    tombstonedAt: v3.optional(v3.number()),
    // Identity
    memoryId: v3.string(),
    // Unique ID for this memory
    memorySpaceId: v3.string(),
    // NEW: Memory space isolation (was agentId)
    participantId: v3.optional(v3.string()),
    // NEW: Hive Mode participant tracking
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v3.optional(v3.string()),
    // Tenant ID for isolation
    // Content
    content: v3.string(),
    contentType: v3.union(
      v3.literal("raw"),
      v3.literal("summarized"),
      v3.literal("fact")
      // NEW: For facts indexed in vector layer
    ),
    embedding: v3.optional(v3.array(v3.float64())),
    // Optional for keyword-only
    // Source (flattened for indexing performance)
    sourceType: v3.union(
      v3.literal("conversation"),
      v3.literal("system"),
      v3.literal("tool"),
      v3.literal("a2a"),
      v3.literal("fact-extraction")
      // NEW: For facts
    ),
    sourceUserId: v3.optional(v3.string()),
    sourceUserName: v3.optional(v3.string()),
    sourceTimestamp: v3.number(),
    // Message role (for conversation memories) - helps with semantic search weighting
    messageRole: v3.optional(
      v3.union(v3.literal("user"), v3.literal("agent"), v3.literal("system"))
    ),
    // Owner Attribution (at least one required for proper tracking)
    userId: v3.optional(v3.string()),
    // For user-owned memories (GDPR cascade)
    agentId: v3.optional(v3.string()),
    // For agent-owned memories (agent deletion cascade)
    // References to Layer 1 (mutually exclusive, all optional)
    conversationRef: v3.optional(
      v3.object({
        conversationId: v3.string(),
        messageIds: v3.array(v3.string())
      })
    ),
    immutableRef: v3.optional(
      v3.object({
        type: v3.string(),
        id: v3.string(),
        version: v3.optional(v3.number())
      })
    ),
    mutableRef: v3.optional(
      v3.object({
        namespace: v3.string(),
        key: v3.string(),
        snapshotValue: v3.any(),
        snapshotAt: v3.number()
      })
    ),
    // NEW: Reference to Layer 3 fact
    factsRef: v3.optional(
      v3.object({
        factId: v3.string(),
        version: v3.optional(v3.number())
      })
    ),
    // Metadata (flattened for indexing/filtering)
    importance: v3.number(),
    // 0-100 (flattened for filtering)
    tags: v3.array(v3.string()),
    // Flattened for filtering
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    enrichedContent: v3.optional(v3.string()),
    // Concatenated searchable content for embedding
    factCategory: v3.optional(v3.string()),
    // Category for filtering (e.g., "addressing_preference")
    // Flexible metadata (for source-specific data like A2A direction, messageId, etc.)
    metadata: v3.optional(v3.any()),
    // Versioning (like immutable)
    version: v3.number(),
    previousVersions: v3.array(
      v3.object({
        version: v3.number(),
        content: v3.string(),
        embedding: v3.optional(v3.array(v3.float64())),
        timestamp: v3.number()
      })
    ),
    // Timestamps & Access
    createdAt: v3.number(),
    updatedAt: v3.number(),
    lastAccessed: v3.optional(v3.number()),
    accessCount: v3.number(),
    // Streaming support (NEW - for progressive storage)
    isPartial: v3.optional(v3.boolean()),
    // Flag for in-progress streaming memories
    partialMetadata: v3.optional(v3.any())
    // Metadata for partial/streaming memories
  }).index("by_memorySpace", ["memorySpaceId"]).index("by_memoryId", ["memoryId"]).index("by_runtime_scope_memoryId", ["tenantId", "memorySpaceId", "memoryId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_userId", ["userId"]).index("by_agentId", ["agentId"]).index("by_memorySpace_created", ["memorySpaceId", "createdAt"]).index("by_memorySpace_userId", ["memorySpaceId", "userId"]).index("by_memorySpace_agentId", ["memorySpaceId", "agentId"]).index("by_participantId", ["participantId"]).searchIndex("by_content", {
    searchField: "content",
    filterFields: [
      "ownerPrincipalId",
      "memorySpaceId",
      "tenantId",
      "sourceType",
      "userId",
      "agentId",
      "participantId"
    ]
    // Updated filters
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    // Default: OpenAI text-embedding-3-small
    filterFields: [
      "memorySpaceId",
      "tenantId",
      "userId",
      "agentId",
      "participantId"
    ]
    // Updated: tenantId for isolation
  }),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 3: Facts Store (NEW - memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  facts: defineTable3({
    // Trusted runtime provenance; unrelated explicit facts share this authoritative table.
    ownerPrincipalId: v3.optional(v3.string()),
    runtimeEditor: v3.optional(v3.object({ principalId: v3.string(), userId: v3.string(), editedAt: v3.number() })),
    manualSourceBinding: v3.optional(v3.object({ resourceType: v3.union(v3.literal("memory"), v3.literal("fact")), resourceId: v3.string() })),
    lineage: v3.optional(sourceLineage),
    extractionPolicyVersion: v3.optional(v3.string()),
    processingReceiptId: v3.optional(v3.string()),
    tombstonedAt: v3.optional(v3.number()),
    // Identity
    factId: v3.string(),
    // Unique ID for this fact
    memorySpaceId: v3.string(),
    // Memory space isolation
    participantId: v3.optional(v3.string()),
    // Hive Mode: which participant extracted this
    userId: v3.optional(v3.string()),
    // GDPR compliance - links to user
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v3.optional(v3.string()),
    // Tenant ID for isolation
    // Fact content
    fact: v3.string(),
    // The fact statement
    factType: v3.union(
      v3.literal("preference"),
      v3.literal("identity"),
      v3.literal("knowledge"),
      v3.literal("relationship"),
      v3.literal("event"),
      v3.literal("observation"),
      v3.literal("custom")
    ),
    // Triple structure (subject-predicate-object)
    subject: v3.optional(v3.string()),
    // Primary entity (e.g., "user-123")
    predicate: v3.optional(v3.string()),
    // Relationship (e.g., "prefers", "works_at")
    object: v3.optional(v3.string()),
    // Secondary entity (e.g., "dark mode")
    // Quality & Source
    confidence: v3.number(),
    // 0-100: extraction confidence
    sourceType: v3.union(
      v3.literal("conversation"),
      v3.literal("system"),
      v3.literal("tool"),
      v3.literal("manual"),
      v3.literal("a2a"),
      v3.literal("fact-extraction")
      // For fact-extracted content
    ),
    sourceRef: v3.optional(
      v3.object({
        conversationId: v3.optional(v3.string()),
        messageIds: v3.optional(v3.array(v3.string())),
        memoryId: v3.optional(v3.string())
      })
    ),
    // Metadata & Tags
    metadata: v3.optional(v3.any()),
    tags: v3.array(v3.string()),
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    category: v3.optional(v3.string()),
    // Specific sub-category (e.g., "addressing_preference")
    searchAliases: v3.optional(v3.array(v3.string())),
    // Alternative search terms
    semanticContext: v3.optional(v3.string()),
    // Usage context sentence
    entities: v3.optional(
      v3.array(
        v3.object({
          name: v3.string(),
          type: v3.string(),
          fullValue: v3.optional(v3.string())
        })
      )
    ),
    // Extracted entities with types
    relations: v3.optional(
      v3.array(
        v3.object({
          subject: v3.string(),
          predicate: v3.string(),
          object: v3.string()
        })
      )
    ),
    // Subject-predicate-object triples for graph
    // Temporal validity
    validFrom: v3.optional(v3.number()),
    validUntil: v3.optional(v3.number()),
    // Versioning (creates immutable chain)
    version: v3.number(),
    supersededBy: v3.optional(v3.string()),
    // factId of newer version
    supersedes: v3.optional(v3.string()),
    // factId this replaces
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number(),
    // Embedding for semantic search (v0.30.0+)
    embedding: v3.optional(v3.array(v3.float64()))
  }).index("by_factId", ["factId"]).index("by_runtime_scope_factId", ["tenantId", "memorySpaceId", "factId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_memorySpace_subject", ["memorySpaceId", "subject"]).index("by_participantId", ["participantId"]).index("by_userId", ["userId"]).searchIndex("by_content", {
    searchField: "fact",
    filterFields: ["memorySpaceId", "tenantId", "factType", "ownerPrincipalId"]
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    // OpenAI text-embedding-3-small / ada-002
    filterFields: ["memorySpaceId", "tenantId"]
  }),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Fact History (Belief Revision Audit Trail)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  factHistory: defineTable3({
    // Identity
    eventId: v3.string(),
    // Unique event ID
    factId: v3.string(),
    // The fact this event relates to
    memorySpaceId: v3.string(),
    // Memory space for scoping
    // Action that was taken
    action: v3.union(
      v3.literal("CREATE"),
      v3.literal("UPDATE"),
      v3.literal("SUPERSEDE"),
      v3.literal("DELETE")
    ),
    // Values (for tracking changes)
    oldValue: v3.optional(v3.string()),
    // Previous fact text
    newValue: v3.optional(v3.string()),
    // New fact text
    // Relationships
    supersededBy: v3.optional(v3.string()),
    // factId that replaced this
    supersedes: v3.optional(v3.string()),
    // factId this replaced
    // Decision context
    reason: v3.optional(v3.string()),
    // Why this action was taken
    confidence: v3.optional(v3.number()),
    // Confidence in the decision
    // Pipeline info
    pipeline: v3.optional(
      v3.object({
        slotMatching: v3.optional(v3.boolean()),
        semanticMatching: v3.optional(v3.boolean()),
        llmResolution: v3.optional(v3.boolean())
      })
    ),
    // Source context
    userId: v3.optional(v3.string()),
    // User who triggered the change
    participantId: v3.optional(v3.string()),
    // Participant who triggered
    conversationId: v3.optional(v3.string()),
    // Conversation context
    // Timestamps
    timestamp: v3.number()
  }).index("by_eventId", ["eventId"]).index("by_factId", ["factId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_timestamp", ["memorySpaceId", "timestamp"]).index("by_action", ["action"]).index("by_userId", ["userId"]).index("by_timestamp", ["timestamp"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Spaces Registry (Hive/Collaboration Mode Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memorySpaces: defineTable3({
    // Identity
    memorySpaceId: v3.string(),
    // Unique memory space ID
    name: v3.optional(v3.string()),
    // Human-readable name
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v3.optional(v3.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v3.optional(v3.string()),
    // Trusted verified resource owner
    tombstonedAt: v3.optional(v3.number()),
    // Retained deletion fence
    type: v3.union(
      v3.literal("personal"),
      v3.literal("team"),
      v3.literal("project"),
      v3.literal("custom")
    ),
    // Participants (for Hive Mode)
    participants: v3.array(
      v3.object({
        id: v3.string(),
        // Participant ID (e.g., 'cursor', 'claude', 'my-bot')
        type: v3.string(),
        // 'ai-tool', 'human', 'ai-agent', 'system'
        joinedAt: v3.number()
      })
    ),
    // Metadata (flexible)
    metadata: v3.any(),
    // Status
    status: v3.union(v3.literal("active"), v3.literal("archived")),
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number()
  }).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_memorySpaceId", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_memorySpaceId", ["tenantId", "memorySpaceId"]).index("by_tenant_status", ["tenantId", "status"]).index("by_status", ["status"]).index("by_type", ["type"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Contexts (Hierarchical Coordination, memorySpace-scoped with cross-space support)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  contexts: defineTable3({
    // Identity
    contextId: v3.string(),
    // Unique ID
    memorySpaceId: v3.string(),
    // NEW: Which memory space owns this context
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v3.optional(v3.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v3.optional(v3.string()),
    // Trusted verified resource owner
    tombstonedAt: v3.optional(v3.number()),
    // Retained deletion fence
    // Purpose
    purpose: v3.string(),
    // What this context is for
    description: v3.optional(v3.string()),
    // Optional description
    // Hierarchy
    parentId: v3.optional(v3.string()),
    // Parent context (can be cross-space)
    rootId: v3.optional(v3.string()),
    // Root context
    depth: v3.number(),
    // 0 for root, increments with depth
    childIds: v3.array(v3.string()),
    // Child contexts
    // Status
    status: v3.union(
      v3.literal("active"),
      v3.literal("completed"),
      v3.literal("cancelled"),
      v3.literal("blocked")
    ),
    // Source conversation (optional)
    conversationRef: v3.optional(
      v3.object({
        conversationId: v3.string(),
        messageIds: v3.optional(v3.array(v3.string()))
      })
    ),
    // User association (GDPR)
    userId: v3.optional(v3.string()),
    // Participants (for tracking)
    participants: v3.array(v3.string()),
    // Memory spaces or participants involved
    // Cross-space access control
    grantedAccess: v3.optional(
      v3.array(
        v3.object({
          memorySpaceId: v3.string(),
          // Which space has access
          scope: v3.string(),
          // 'read-only', 'context-only', etc.
          grantedAt: v3.number()
        })
      )
    ),
    // Data (flexible)
    data: v3.optional(v3.any()),
    // Metadata
    metadata: v3.optional(v3.any()),
    // Versioning (automatic version tracking for updates)
    lastUpdatedBy: v3.optional(v3.string()),
    // Actual verified writer of the current revision
    version: v3.number(),
    // Current version number (starts at 1)
    previousVersions: v3.array(
      v3.object({
        version: v3.number(),
        status: v3.string(),
        data: v3.optional(v3.any()),
        timestamp: v3.number(),
        updatedBy: v3.optional(v3.string())
        // Agent/participant that made the change
      })
    ),
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number(),
    completedAt: v3.optional(v3.number())
  }).index("by_runtime_scope_context", ["tenantId", "memorySpaceId", "contextId"]).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_contextId", ["contextId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_contextId", ["tenantId", "contextId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_parentId", ["parentId"]).index("by_rootId", ["rootId"]).index("by_status", ["status"]).index("by_memorySpace_status", ["memorySpaceId", "status"]).index("by_userId", ["userId"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Agents Registry (Optional Metadata Layer)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  agents: defineTable3({
    // Identity
    agentId: v3.string(),
    // Unique agent identifier
    memorySpaceId: v3.optional(v3.string()),
    // Optional trusted space scope
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v3.optional(v3.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v3.optional(v3.string()),
    // Trusted verified resource owner
    tombstonedAt: v3.optional(v3.number()),
    // Retained deletion fence
    // Metadata
    name: v3.string(),
    // Display name
    description: v3.optional(v3.string()),
    // What this agent does
    metadata: v3.optional(v3.any()),
    // Flexible metadata (team, capabilities, etc.)
    // Configuration
    config: v3.optional(v3.any()),
    // Agent-specific configuration
    // Status
    status: v3.union(
      v3.literal("active"),
      v3.literal("inactive"),
      v3.literal("archived")
    ),
    // Timestamps
    registeredAt: v3.number(),
    updatedAt: v3.number(),
    lastActive: v3.optional(v3.number())
    // Last time agent created data
  }).index("by_runtime_scope_agent", ["tenantId", "memorySpaceId", "agentId"]).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_agentId", ["agentId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_status", ["tenantId", "status"]).index("by_status", ["status"]).index("by_registered", ["registeredAt"]),
  // Chronological ordering
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Sessions (Native Session Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  sessions: defineTable3({
    // Identity
    sessionId: v3.string(),
    // Unique session ID
    userId: v3.string(),
    // User this session belongs to
    // Multi-tenancy (NEW - critical for isolation)
    tenantId: v3.optional(v3.string()),
    // Trusted tenant selector
    ownerPrincipalId: v3.optional(v3.string()),
    tombstonedAt: v3.optional(v3.number()),
    authorityReference: v3.optional(runtimeAuthorityReference),
    // Server-pinned maintenance authority
    // Memory space association
    memorySpaceId: v3.optional(v3.string()),
    // Memory space for this session
    // Session state
    status: v3.union(v3.literal("active"), v3.literal("idle"), v3.literal("ended")),
    startedAt: v3.number(),
    // When session started
    lastActiveAt: v3.number(),
    // Last activity timestamp
    endedAt: v3.optional(v3.number()),
    // When session ended
    expiresAt: v3.optional(v3.number()),
    // When session expires (from governance policy)
    // Fully extensible metadata (v.any() allows any shape)
    metadata: v3.optional(v3.any()),
    // Statistics
    messageCount: v3.number(),
    // Messages in this session
    memoryCount: v3.number()
    // Memories created in this session
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "sessionId"]).index("by_sessionId", ["sessionId"]).index("by_userId", ["userId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_user", ["tenantId", "userId"]).index("by_status", ["status"]).index("by_memorySpace", ["memorySpaceId"]).index("by_lastActive", ["lastActiveAt"]).index("by_tenant_status", ["tenantId", "status"]),
  // Tenant + status
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Governance Policies (Data Retention, Purging, and Compliance)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  governancePolicies: defineTable3({
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v3.optional(v3.string()),
    ownerPrincipalId: v3.optional(v3.string()),
    authority: v3.optional(runtimeAuthorityReference),
    // Scope
    organizationId: v3.optional(v3.string()),
    memorySpaceId: v3.optional(v3.string()),
    // Memory space override
    // Policy configuration (full JSON structure)
    policy: v3.any(),
    // GovernancePolicy structure
    // Metadata
    isActive: v3.boolean(),
    appliedBy: v3.optional(v3.string()),
    // Who applied this policy
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number()
  }).index("by_organization", ["organizationId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_active", ["isActive", "organizationId"]).index("by_updated", ["updatedAt"]).index("by_runtime_scope_active", ["tenantId", "memorySpaceId", "isActive"]),
  // Governance Enforcement Log (Audit Trail)
  governanceEnforcement: defineTable3({
    policyId: v3.optional(v3.id("governancePolicies")),
    simulation: v3.optional(v3.boolean()),
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v3.optional(v3.string()),
    ownerPrincipalId: v3.optional(v3.string()),
    authority: v3.optional(runtimeAuthorityReference),
    // Scope
    organizationId: v3.optional(v3.string()),
    memorySpaceId: v3.optional(v3.string()),
    // Enforcement details
    enforcementType: v3.union(v3.literal("automatic"), v3.literal("manual")),
    layers: v3.array(v3.string()),
    // Which layers were enforced
    rules: v3.array(v3.string()),
    // Which rules were enforced
    // Results
    versionsDeleted: v3.number(),
    recordsPurged: v3.number(),
    storageFreed: v3.number(),
    // MB
    // Metadata
    triggeredBy: v3.optional(v3.string()),
    // Timestamps
    executedAt: v3.number()
  }).index("by_organization", ["organizationId", "executedAt"]).index("by_memorySpace", ["memorySpaceId", "executedAt"]).index("by_executed", ["executedAt"]).index("by_runtime_scope_executed", ["tenantId", "memorySpaceId", "executedAt"]).index("by_runtime_policy", ["policyId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Graph Sync Queue (Real-time Graph Database Synchronization)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  graphSyncQueue: defineTable3({
    memorySpaceId: v3.optional(v3.string()),
    entityDocumentId: v3.optional(v3.id("facts")),
    entityVersion: v3.optional(v3.number()),
    sourceId: v3.optional(v3.string()),
    sourceEventId: v3.optional(v3.string()),
    sourceRevision: v3.optional(v3.number()),
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v3.optional(v3.string()),
    ownerPrincipalId: v3.optional(v3.string()),
    authority: v3.optional(runtimeAuthorityReference),
    // Entity identification
    table: v3.string(),
    // "memories", "facts", "contexts", "conversations", etc.
    entityId: v3.string(),
    // Cortex entity ID
    // Operation type
    operation: v3.union(
      v3.literal("insert"),
      v3.literal("update"),
      v3.literal("delete")
    ),
    // Entity data (full object for sync)
    entity: v3.optional(v3.any()),
    // Null for deletes
    // Sync status
    synced: v3.boolean(),
    syncedAt: v3.optional(v3.number()),
    // Retry tracking
    failedAttempts: v3.optional(v3.number()),
    lastError: v3.optional(v3.string()),
    // Priority (for ordering)
    priority: v3.optional(v3.string()),
    // "high", "normal", "low"
    // Timestamps
    createdAt: v3.number()
  }).index("by_synced", ["synced"]).index("by_table", ["table"]).index("by_table_entity", ["table", "entityId"]).index("by_priority", ["priority", "synced"]).index("by_created", ["createdAt"]).index("by_runtime_worker_entity", ["tenantId", "memorySpaceId", "authority.grantId", "table", "entityId"]).index("by_runtime_worker_state", ["tenantId", "memorySpaceId", "authority.grantId", "synced", "priority"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Artifacts (Interactive Versioned Documents, memorySpace-scoped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  artifacts: defineTable3({
    // Identity
    artifactId: v3.string(),
    memorySpaceId: v3.string(),
    participantId: v3.optional(v3.string()),
    // Multi-tenancy
    tenantId: v3.optional(v3.string()),
    // Fresh trusted ownership; caller user/participant labels never grant access.
    ownerPrincipalId: v3.optional(v3.string()),
    lastActorPrincipalId: v3.optional(v3.string()),
    tombstonedAt: v3.optional(v3.number()),
    // Ownership
    userId: v3.optional(v3.string()),
    agentId: v3.optional(v3.string()),
    // Kind
    kind: v3.union(
      v3.literal("text"),
      v3.literal("code"),
      v3.literal("sheet"),
      v3.literal("image"),
      v3.literal("diagram"),
      v3.literal("html"),
      v3.literal("custom")
    ),
    kindConfig: v3.optional(
      v3.object({
        customKind: v3.optional(v3.string()),
        mimeType: v3.optional(v3.string()),
        language: v3.optional(v3.string()),
        framework: v3.optional(v3.string()),
        schema: v3.optional(v3.any())
      })
    ),
    // Content (mutually exclusive)
    content: v3.optional(v3.string()),
    fileRef: v3.optional(
      v3.object({
        storageId: v3.id("_storage"),
        mimeType: v3.string(),
        size: v3.number(),
        checksum: v3.optional(v3.string()),
        originalFilename: v3.optional(v3.string())
      })
    ),
    // Streaming
    streamingState: v3.union(
      v3.literal("draft"),
      v3.literal("streaming"),
      v3.literal("paused"),
      v3.literal("final"),
      v3.literal("error")
    ),
    streamingMetadata: v3.optional(
      v3.object({
        sessionId: v3.optional(v3.string()),
        startedAt: v3.optional(v3.number()),
        lastChunkAt: v3.optional(v3.number()),
        bytesReceived: v3.optional(v3.number()),
        estimatedTotal: v3.optional(v3.number()),
        errorMessage: v3.optional(v3.string()),
        errorCode: v3.optional(v3.string()),
        errorAt: v3.optional(v3.number())
      })
    ),
    // Display
    title: v3.string(),
    description: v3.optional(v3.string()),
    tags: v3.array(v3.string()),
    // References
    conversationRef: v3.optional(
      v3.object({
        conversationId: v3.string(),
        messageId: v3.optional(v3.string()),
        turnIndex: v3.optional(v3.number())
      })
    ),
    memoryRefs: v3.optional(
      v3.array(
        v3.object({
          memoryId: v3.string(),
          relevance: v3.optional(v3.number())
        })
      )
    ),
    // Versioning (Undo/Redo)
    version: v3.number(),
    versionPointer: v3.number(),
    versionHistory: v3.array(
      v3.object({
        version: v3.number(),
        content: v3.optional(v3.string()),
        fileRef: v3.optional(
          v3.object({
            storageId: v3.id("_storage"),
            mimeType: v3.string(),
            size: v3.number(),
            checksum: v3.optional(v3.string()),
            originalFilename: v3.optional(v3.string())
          })
        ),
        title: v3.optional(v3.string()),
        timestamp: v3.number(),
        changedBy: v3.optional(v3.string()),
        changeType: v3.union(
          v3.literal("create"),
          v3.literal("update"),
          v3.literal("undo"),
          v3.literal("redo")
        ),
        changeSummary: v3.optional(v3.string())
      })
    ),
    // Collaboration
    collaborators: v3.optional(
      v3.array(
        v3.object({
          id: v3.string(),
          type: v3.union(v3.literal("user"), v3.literal("agent")),
          role: v3.union(
            v3.literal("owner"),
            v3.literal("editor"),
            v3.literal("viewer")
          ),
          addedAt: v3.number(),
          lastEditAt: v3.optional(v3.number())
        })
      )
    ),
    // Stats
    stats: v3.optional(
      v3.object({
        characterCount: v3.optional(v3.number()),
        wordCount: v3.optional(v3.number()),
        lineCount: v3.optional(v3.number()),
        tokenCount: v3.optional(v3.number())
      })
    ),
    // Metadata
    metadata: v3.optional(v3.any()),
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number(),
    lastAccessedAt: v3.optional(v3.number()),
    accessCount: v3.optional(v3.number()),
    // Soft Delete
    isDeleted: v3.optional(v3.boolean()),
    deletedAt: v3.optional(v3.number()),
    deletedBy: v3.optional(v3.string())
  }).index("by_runtime_key", ["tenantId", "memorySpaceId", "artifactId"]).index("by_artifactId", ["artifactId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_created", ["memorySpaceId", "createdAt"]).index("by_memorySpace_updated", ["memorySpaceId", "updatedAt"]).index("by_memorySpace_kind", ["memorySpaceId", "kind"]).index("by_memorySpace_state", ["memorySpaceId", "streamingState"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_tenant_artifactId", ["tenantId", "artifactId"]).index("by_tenant_space_kind", ["tenantId", "memorySpaceId", "kind"]).index("by_conversation", ["conversationRef.conversationId"]).index("by_memorySpace_conversation", [
    "memorySpaceId",
    "conversationRef.conversationId"
  ]).index("by_userId", ["userId"]).index("by_agentId", ["agentId"]).index("by_memorySpace_user", ["memorySpaceId", "userId"]).index("by_memorySpace_agent", ["memorySpaceId", "agentId"]).index("by_participantId", ["participantId"]).index("by_streamingState", ["streamingState"]).index("by_memorySpace_streaming", [
    "memorySpaceId",
    "streamingState",
    "updatedAt"
  ]).index("by_created", ["createdAt"]).index("by_updated", ["updatedAt"]).index("by_lastAccessed", ["lastAccessedAt"]).searchIndex("by_content", {
    searchField: "content",
    filterFields: [
      "memorySpaceId",
      "tenantId",
      "kind",
      "userId",
      "agentId",
      "participantId",
      "streamingState"
    ]
  }).searchIndex("by_title", {
    searchField: "title",
    filterFields: ["memorySpaceId", "tenantId", "kind"]
  }),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Attachments (Multi-modal File Storage, memorySpace-scoped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  attachments: defineTable3({
    // Identity
    attachmentId: v3.string(),
    // Unique attachment ID
    memorySpaceId: v3.string(),
    // Memory space isolation
    // Multi-tenancy
    tenantId: v3.optional(v3.string()),
    // Tenant ID for SaaS isolation
    // Ownership
    userId: v3.string(),
    // User who uploaded this attachment
    conversationId: v3.optional(v3.string()),
    // Linked conversation
    messageId: v3.optional(v3.string()),
    // Linked message
    memoryId: v3.optional(v3.string()),
    // Linked memory
    artifactId: v3.optional(v3.string()),
    // Linked artifact
    // File storage (Convex native)
    storageId: v3.id("_storage"),
    // Convex file storage reference
    // File metadata
    type: v3.union(
      v3.literal("image"),
      v3.literal("audio"),
      v3.literal("video"),
      v3.literal("file"),
      v3.literal("pdf")
    ),
    mimeType: v3.string(),
    // MIME type (e.g., "image/png")
    filename: v3.string(),
    // Original filename
    size: v3.number(),
    // File size in bytes
    // Extracted content (for future search/RAG - Phase 2+)
    extractedText: v3.optional(v3.string()),
    // OCR/PDF text extraction
    transcript: v3.optional(v3.string()),
    // Audio/video transcription
    embedding: v3.optional(v3.array(v3.float64())),
    // Semantic search embedding
    // Type-specific metadata
    dimensions: v3.optional(
      v3.object({
        width: v3.number(),
        height: v3.number()
      })
    ),
    // Image/video dimensions
    duration: v3.optional(v3.number()),
    // Audio/video duration in seconds
    // Generic metadata
    metadata: v3.optional(v3.any()),
    // Timestamps
    createdAt: v3.number(),
    updatedAt: v3.number()
  }).index("by_attachmentId", ["attachmentId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_type", ["memorySpaceId", "type"]).index("by_memorySpace_created", ["memorySpaceId", "createdAt"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_tenant_attachmentId", ["tenantId", "attachmentId"]).index("by_conversation", ["conversationId"]).index("by_message", ["messageId"]).index("by_memory", ["memoryId"]).index("by_artifact", ["artifactId"]).index("by_userId", ["userId"]).index("by_memorySpace_user", ["memorySpaceId", "userId"]).index("by_created", ["createdAt"]).index("by_updated", ["updatedAt"]).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    // OpenAI text-embedding-3-small / ada-002
    filterFields: ["memorySpaceId", "tenantId", "type"]
  })
});
export {
  before_schema_default as default
};
