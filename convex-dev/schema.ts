/**
 * Cortex SDK - Convex Schema
 *
 * Layer 1: ACID Stores
 * - conversations (Layer 1a) - Immutable conversation history (memorySpace-scoped)
 * - immutable (Layer 1b) - Versioned immutable data (TRULY shared, NO memorySpace)
 * - mutable (Layer 1c) - Live operational data (TRULY shared, NO memorySpace)
 *
 * Layer 2: Vector Index
 * - memories - Searchable knowledge with embeddings (memorySpace-scoped)
 *
 * Layer 3: Facts Store
 * - facts - LLM-extracted facts (memorySpace-scoped, versioned)
 *
 * Layer 4: Convenience APIs (SDK only, no schema)
 *
 * Artifacts
 * - artifacts - Interactive versioned documents (memorySpace-scoped, streaming support)
 *
 * Attachments (Multi-modal)
 * - attachments - Multi-modal file storage (images, PDFs, audio, video, files)
 *
 * Coordination:
 * - contexts - Hierarchical context chains (memorySpace-scoped, cross-space support)
 * - memorySpaces - Memory space registry (Hive/Collaboration modes)
 * - agents - Optional agent metadata registry (analytics, discovery, team organization)
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1a: Conversations (ACID, Immutable)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversations: defineTable({
    // Identity
    conversationId: v.string(), // Unique ID (e.g., "conv-abc123")

    // Memory Space (NEW - fundamental isolation boundary)
    memorySpaceId: v.string(), // Which memory space owns this conversation
    participantId: v.optional(v.string()), // Hive Mode: which participant created this

    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    // Type: user-agent (user ↔ participant) or agent-agent (space ↔ space)
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),

    // Participants (based on type)
    participants: v.object({
      // user-agent conversations (single user)
      userId: v.optional(v.string()), // The primary human user in the conversation
      agentId: v.optional(v.string()), // The agent/assistant in the conversation

      // Collaborative conversations (Phase 4) - multiple human participants
      userIds: v.optional(v.array(v.string())), // Multiple human users

      // Hive Mode tracking (which tool/agent in shared space created this)
      participantId: v.optional(v.string()),

      // agent-agent conversations (Collaboration Mode - cross-space)
      memorySpaceIds: v.optional(v.array(v.string())), // Both spaces involved
    }),

    // Collaborative settings (Phase 4)
    collaborativeSettings: v.optional(
      v.object({
        // Whether messages from non-owners require approval
        requireApproval: v.boolean(),
        // The owner who can approve messages (defaults to first userId/userIds[0])
        ownerUserId: v.optional(v.string()),
        // IDs of approved participants (others require approval)
        approvedParticipants: v.optional(v.array(v.string())),
      }),
    ),

    // Messages (append-only, immutable)
    messages: v.array(
      v.object({
        id: v.string(), // Message ID
        role: v.union(
          v.literal("user"),
          v.literal("agent"),
          v.literal("system"),
        ),
        content: v.string(),
        timestamp: v.number(),

        // Optional fields
        participantId: v.optional(v.string()), // Which participant sent this (Hive Mode/Collaborative)
        metadata: v.optional(v.any()), // Flexible metadata
        attachmentIds: v.optional(v.array(v.string())), // Multi-modal attachment references

        // Collaborative approval (Phase 4)
        approvalStatus: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("approved"),
            v.literal("rejected"),
          ),
        ),
        approvedBy: v.optional(v.string()), // userId who approved
        approvedAt: v.optional(v.number()), // Approval timestamp
      }),
    ),

    // Statistics
    messageCount: v.number(),

    // Metadata (flexible)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Visibility for shareable chats (Phase 1)
    // - 'private': Only owner can access (default)
    // - 'space': Anyone in the memory space can access
    // - 'public': Anyone with the conversationId can access
    visibility: v.optional(
      v.union(
        v.literal("private"),
        v.literal("space"),
        v.literal("public"),
      ),
    ),
  })
    .index("by_conversationId", ["conversationId"]) // Unique lookup
    .index("by_memorySpace", ["memorySpaceId"]) // NEW: Memory space's conversations
    .index("by_tenantId", ["tenantId"]) // Tenant's conversations
    .index("by_tenant_space", ["tenantId", "memorySpaceId"]) // Tenant + space
    .index("by_type", ["type"]) // List by type
    .index("by_user", ["participants.userId"]) // User's conversations
    .index("by_agent", ["participants.agentId"]) // Agent's conversations
    .index("by_memorySpace_user", ["memorySpaceId", "participants.userId"]) // NEW: Space + user
    .index("by_memorySpace_agent", ["memorySpaceId", "participants.agentId"]) // Space + agent
    .index("by_created", ["createdAt"]) // Chronological ordering
    .index("by_visibility", ["visibility"]) // Filter by visibility
    .index("by_memorySpace_visibility", ["memorySpaceId", "visibility"]), // Space + visibility

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Shares (Shareable Chats Phase 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationShares: defineTable({
    // Identity
    shareId: v.string(), // Public-facing identifier for share links
    conversationId: v.string(),

    // Granter (owner)
    grantedBy: v.string(), // userId who shared
    sourceMemorySpaceId: v.string(),

    // Recipient(s)
    grantType: v.union(
      v.literal("user"), // Specific user
      v.literal("space"), // Entire memory space
      v.literal("link"), // Anyone with link
      v.literal("domain"), // Anyone from email domain
    ),
    grantedTo: v.optional(v.string()), // userId, memorySpaceId, or domain

    // Permissions
    permissions: v.object({
      canView: v.boolean(), // See messages
      canViewFacts: v.boolean(), // See extracted facts
      canViewMemories: v.boolean(), // See related memories
      canContinue: v.boolean(), // Add new messages
      canFork: v.boolean(), // Create a copy
      canExport: v.boolean(), // Download transcript
    }),

    // Constraints
    expiresAt: v.optional(v.number()), // Time-limited sharing
    maxViews: v.optional(v.number()), // View-limited sharing
    viewCount: v.number(),

    // Redaction
    redactBefore: v.optional(v.number()), // Hide messages before timestamp
    redactSensitive: v.boolean(), // Auto-redact PII

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("revoked"),
      v.literal("expired"),
    ),

    // Multi-tenancy
    tenantId: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_shareId", ["shareId"])
    .index("by_conversation", ["conversationId"])
    .index("by_grantedTo", ["grantedTo"])
    .index("by_grantedBy", ["grantedBy"])
    .index("by_status", ["status"])
    .index("by_tenant_shareId", ["tenantId", "shareId"])
    .index("by_tenant_conversation", ["tenantId", "conversationId"]),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Snapshots (Shareable Chats Phase 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationSnapshots: defineTable({
    // Identity
    snapshotId: v.string(),
    conversationId: v.string(), // Source conversation

    // Snapshot content (immutable after creation)
    messages: v.array(
      v.object({
        id: v.string(),
        role: v.union(
          v.literal("user"),
          v.literal("agent"),
          v.literal("system"),
        ),
        content: v.string(),
        timestamp: v.number(),
        participantId: v.optional(v.string()),
        // Note: PII-redacted version stored here
      }),
    ),

    // Original conversation metadata
    conversationType: v.union(
      v.literal("user-agent"),
      v.literal("agent-agent"),
    ),
    participants: v.object({
      userId: v.optional(v.string()),
      agentId: v.optional(v.string()),
      participantId: v.optional(v.string()),
      memorySpaceIds: v.optional(v.array(v.string())),
    }),

    // Snapshot metadata
    messageCount: v.number(),

    // What was included
    includedContent: v.object({
      messages: v.boolean(),
      facts: v.boolean(),
      memories: v.boolean(),
    }),

    // Redaction info
    redaction: v.object({
      piiRedacted: v.boolean(),
      messagesRedactedBefore: v.optional(v.number()), // Timestamp
      customRedactions: v.optional(
        v.array(
          v.object({
            pattern: v.string(),
            replacement: v.string(),
          }),
        ),
      ),
    }),

    // Associated facts snapshot (if included)
    facts: v.optional(
      v.array(
        v.object({
          factId: v.string(),
          fact: v.string(),
          factType: v.string(),
          confidence: v.number(),
        }),
      ),
    ),

    // Owner info
    createdBy: v.string(), // userId
    memorySpaceId: v.string(),

    // Multi-tenancy
    tenantId: v.optional(v.string()),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    ),

    // Timestamps
    createdAt: v.number(),
    snapshotOf: v.number(), // Timestamp of when the snapshot was taken
  })
    .index("by_snapshotId", ["snapshotId"])
    .index("by_conversation", ["conversationId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_memorySpace", ["memorySpaceId"])
    .index("by_status", ["status"])
    .index("by_tenant_snapshotId", ["tenantId", "snapshotId"]),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1b: Immutable Store (ACID, Versioned, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  immutable: defineTable({
    // Identity (composite key: type + id)
    type: v.string(), // Entity type: 'kb-article', 'policy', 'audit-log', 'feedback', 'user'
    id: v.string(), // Type-specific logical ID

    // Data (flexible, immutable once stored)
    data: v.any(),

    // GDPR support (optional)
    userId: v.optional(v.string()), // Links to user for cascade deletion

    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    // Versioning
    version: v.number(), // Current version number (starts at 1)
    previousVersions: v.array(
      v.object({
        version: v.number(),
        data: v.any(),
        timestamp: v.number(),
        metadata: v.optional(v.any()),
      }),
    ),

    // Metadata (flexible - any JSON-serializable object)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type_id", ["type", "id"]) // Unique lookup
    .index("by_type", ["type"]) // List by type
    .index("by_tenantId", ["tenantId"]) // Tenant's records
    .index("by_tenant_type_id", ["tenantId", "type", "id"]) // Tenant-scoped lookup
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_created", ["createdAt"]), // Chronological

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1c: Mutable Store (ACID, No Versioning, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mutable: defineTable({
    // Composite key: namespace + key
    namespace: v.string(), // Logical grouping: 'inventory', 'config', 'counters', etc.
    key: v.string(), // Unique key within namespace

    // Value (flexible, mutable)
    value: v.any(),

    // GDPR support (optional)
    userId: v.optional(v.string()), // Links to user for cascade deletion

    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    // Metadata (optional)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_namespace_key", ["namespace", "key"]) // Unique lookup
    .index("by_namespace", ["namespace"]) // List by namespace
    .index("by_tenantId", ["tenantId"]) // Tenant's records
    .index("by_tenant_namespace", ["tenantId", "namespace"]) // Tenant-scoped namespace listing
    .index("by_tenant_namespace_key", ["tenantId", "namespace", "key"]) // Tenant-scoped lookup
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_updated", ["updatedAt"]), // Recent changes

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 2: Vector Memory (Searchable, memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memories: defineTable({
    // Identity
    memoryId: v.string(), // Unique ID for this memory
    memorySpaceId: v.string(), // NEW: Memory space isolation (was agentId)
    participantId: v.optional(v.string()), // NEW: Hive Mode participant tracking

    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    // Content
    content: v.string(),
    contentType: v.union(
      v.literal("raw"),
      v.literal("summarized"),
      v.literal("fact"), // NEW: For facts indexed in vector layer
    ),
    embedding: v.optional(v.array(v.float64())), // Optional for keyword-only

    // Source (flattened for indexing performance)
    sourceType: v.union(
      v.literal("conversation"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("a2a"),
      v.literal("fact-extraction"), // NEW: For facts
    ),
    sourceUserId: v.optional(v.string()),
    sourceUserName: v.optional(v.string()),
    sourceTimestamp: v.number(),

    // Message role (for conversation memories) - helps with semantic search weighting
    messageRole: v.optional(
      v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    ),

    // Owner Attribution (at least one required for proper tracking)
    userId: v.optional(v.string()), // For user-owned memories (GDPR cascade)
    agentId: v.optional(v.string()), // For agent-owned memories (agent deletion cascade)

    // References to Layer 1 (mutually exclusive, all optional)
    conversationRef: v.optional(
      v.object({
        conversationId: v.string(),
        messageIds: v.array(v.string()),
      }),
    ),

    immutableRef: v.optional(
      v.object({
        type: v.string(),
        id: v.string(),
        version: v.optional(v.number()),
      }),
    ),

    mutableRef: v.optional(
      v.object({
        namespace: v.string(),
        key: v.string(),
        snapshotValue: v.any(),
        snapshotAt: v.number(),
      }),
    ),

    // NEW: Reference to Layer 3 fact
    factsRef: v.optional(
      v.object({
        factId: v.string(),
        version: v.optional(v.number()),
      }),
    ),

    // Metadata (flattened for indexing/filtering)
    importance: v.number(), // 0-100 (flattened for filtering)
    tags: v.array(v.string()), // Flattened for filtering

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    enrichedContent: v.optional(v.string()), // Concatenated searchable content for embedding
    factCategory: v.optional(v.string()), // Category for filtering (e.g., "addressing_preference")

    // Flexible metadata (for source-specific data like A2A direction, messageId, etc.)
    metadata: v.optional(v.any()),

    // Versioning (like immutable)
    version: v.number(),
    previousVersions: v.array(
      v.object({
        version: v.number(),
        content: v.string(),
        embedding: v.optional(v.array(v.float64())),
        timestamp: v.number(),
      }),
    ),

    // Timestamps & Access
    createdAt: v.number(),
    updatedAt: v.number(),
    lastAccessed: v.optional(v.number()),
    accessCount: v.number(),

    // Streaming support (NEW - for progressive storage)
    isPartial: v.optional(v.boolean()), // Flag for in-progress streaming memories
    partialMetadata: v.optional(v.any()), // Metadata for partial/streaming memories
  })
    .index("by_memorySpace", ["memorySpaceId"]) // NEW: Memory space's memories
    .index("by_memoryId", ["memoryId"]) // Unique lookup
    .index("by_tenantId", ["tenantId"]) // Tenant's memories
    .index("by_tenant_space", ["tenantId", "memorySpaceId"]) // Tenant + space
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_agentId", ["agentId"]) // Agent deletion cascade
    .index("by_memorySpace_created", ["memorySpaceId", "createdAt"]) // NEW: Chronological
    .index("by_memorySpace_userId", ["memorySpaceId", "userId"]) // NEW: Space + user
    .index("by_memorySpace_agentId", ["memorySpaceId", "agentId"]) // NEW: Space + agent
    .index("by_participantId", ["participantId"]) // NEW: Hive Mode tracking
    .searchIndex("by_content", {
      searchField: "content",
      filterFields: [
        "memorySpaceId",
        "tenantId",
        "sourceType",
        "userId",
        "agentId",
        "participantId",
      ], // Updated filters
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // Default: OpenAI text-embedding-3-small
      filterFields: [
        "memorySpaceId",
        "tenantId",
        "userId",
        "agentId",
        "participantId",
      ], // Updated: tenantId for isolation
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 3: Facts Store (NEW - memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  facts: defineTable({
    // Identity
    factId: v.string(), // Unique ID for this fact
    memorySpaceId: v.string(), // Memory space isolation
    participantId: v.optional(v.string()), // Hive Mode: which participant extracted this
    userId: v.optional(v.string()), // GDPR compliance - links to user

    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    // Fact content
    fact: v.string(), // The fact statement
    factType: v.union(
      v.literal("preference"),
      v.literal("identity"),
      v.literal("knowledge"),
      v.literal("relationship"),
      v.literal("event"),
      v.literal("observation"),
      v.literal("custom"),
    ),

    // Triple structure (subject-predicate-object)
    subject: v.optional(v.string()), // Primary entity (e.g., "user-123")
    predicate: v.optional(v.string()), // Relationship (e.g., "prefers", "works_at")
    object: v.optional(v.string()), // Secondary entity (e.g., "dark mode")

    // Quality & Source
    confidence: v.number(), // 0-100: extraction confidence
    sourceType: v.union(
      v.literal("conversation"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("manual"),
      v.literal("a2a"),
      v.literal("fact-extraction"), // For fact-extracted content
    ),
    sourceRef: v.optional(
      v.object({
        conversationId: v.optional(v.string()),
        messageIds: v.optional(v.array(v.string())),
        memoryId: v.optional(v.string()),
      }),
    ),

    // Metadata & Tags
    metadata: v.optional(v.any()),
    tags: v.array(v.string()),

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    category: v.optional(v.string()), // Specific sub-category (e.g., "addressing_preference")
    searchAliases: v.optional(v.array(v.string())), // Alternative search terms
    semanticContext: v.optional(v.string()), // Usage context sentence
    entities: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          fullValue: v.optional(v.string()),
        }),
      ),
    ), // Extracted entities with types
    relations: v.optional(
      v.array(
        v.object({
          subject: v.string(),
          predicate: v.string(),
          object: v.string(),
        }),
      ),
    ), // Subject-predicate-object triples for graph

    // Temporal validity
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),

    // Versioning (creates immutable chain)
    version: v.number(),
    supersededBy: v.optional(v.string()), // factId of newer version
    supersedes: v.optional(v.string()), // factId this replaces

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Embedding for semantic search (v0.30.0+)
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_factId", ["factId"]) // Unique lookup
    .index("by_memorySpace", ["memorySpaceId"]) // Memory space's facts
    .index("by_tenantId", ["tenantId"]) // Tenant's facts
    .index("by_tenant_space", ["tenantId", "memorySpaceId"]) // Tenant + space
    .index("by_memorySpace_subject", ["memorySpaceId", "subject"]) // Entity-centric queries
    .index("by_participantId", ["participantId"]) // Hive Mode tracking
    .index("by_userId", ["userId"]) // GDPR cascade
    .searchIndex("by_content", {
      searchField: "fact",
      filterFields: ["memorySpaceId", "tenantId", "factType"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // OpenAI text-embedding-3-small / ada-002
      filterFields: ["memorySpaceId", "tenantId"],
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Fact History (Belief Revision Audit Trail)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  factHistory: defineTable({
    // Identity
    eventId: v.string(), // Unique event ID
    factId: v.string(), // The fact this event relates to
    memorySpaceId: v.string(), // Memory space for scoping

    // Action that was taken
    action: v.union(
      v.literal("CREATE"),
      v.literal("UPDATE"),
      v.literal("SUPERSEDE"),
      v.literal("DELETE"),
    ),

    // Values (for tracking changes)
    oldValue: v.optional(v.string()), // Previous fact text
    newValue: v.optional(v.string()), // New fact text

    // Relationships
    supersededBy: v.optional(v.string()), // factId that replaced this
    supersedes: v.optional(v.string()), // factId this replaced

    // Decision context
    reason: v.optional(v.string()), // Why this action was taken
    confidence: v.optional(v.number()), // Confidence in the decision

    // Pipeline info
    pipeline: v.optional(
      v.object({
        slotMatching: v.optional(v.boolean()),
        semanticMatching: v.optional(v.boolean()),
        llmResolution: v.optional(v.boolean()),
      }),
    ),

    // Source context
    userId: v.optional(v.string()), // User who triggered the change
    participantId: v.optional(v.string()), // Participant who triggered
    conversationId: v.optional(v.string()), // Conversation context

    // Timestamps
    timestamp: v.number(),
  })
    .index("by_eventId", ["eventId"]) // Unique lookup
    .index("by_factId", ["factId"]) // Get history for a fact
    .index("by_memorySpace", ["memorySpaceId"]) // Get all changes in a space
    .index("by_memorySpace_timestamp", ["memorySpaceId", "timestamp"]) // Time-range queries
    .index("by_action", ["action"]) // Filter by action type
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_timestamp", ["timestamp"]), // Chronological

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Spaces Registry (Hive/Collaboration Mode Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memorySpaces: defineTable({
    // Identity
    memorySpaceId: v.string(), // Unique memory space ID
    name: v.optional(v.string()), // Human-readable name

    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    type: v.union(
      v.literal("personal"),
      v.literal("team"),
      v.literal("project"),
      v.literal("custom"),
    ),

    // Participants (for Hive Mode)
    participants: v.array(
      v.object({
        id: v.string(), // Participant ID (e.g., 'cursor', 'claude', 'my-bot')
        type: v.string(), // 'ai-tool', 'human', 'ai-agent', 'system'
        joinedAt: v.number(),
      }),
    ),

    // Metadata (flexible)
    metadata: v.any(),

    // Status
    status: v.union(v.literal("active"), v.literal("archived")),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_memorySpaceId", ["memorySpaceId"]) // Unique lookup
    .index("by_tenantId", ["tenantId"]) // Tenant's memory spaces
    .index("by_tenant_memorySpaceId", ["tenantId", "memorySpaceId"]) // Tenant-scoped lookup
    .index("by_tenant_status", ["tenantId", "status"]) // Tenant + status
    .index("by_status", ["status"]) // Filter active/archived
    .index("by_type", ["type"]) // Filter by type
    .index("by_created", ["createdAt"]), // Chronological

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Contexts (Hierarchical Coordination, memorySpace-scoped with cross-space support)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  contexts: defineTable({
    // Identity
    contextId: v.string(), // Unique ID
    memorySpaceId: v.string(), // NEW: Which memory space owns this context

    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    // Purpose
    purpose: v.string(), // What this context is for
    description: v.optional(v.string()), // Optional description

    // Hierarchy
    parentId: v.optional(v.string()), // Parent context (can be cross-space)
    rootId: v.optional(v.string()), // Root context
    depth: v.number(), // 0 for root, increments with depth
    childIds: v.array(v.string()), // Child contexts

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("blocked"),
    ),

    // Source conversation (optional)
    conversationRef: v.optional(
      v.object({
        conversationId: v.string(),
        messageIds: v.optional(v.array(v.string())),
      }),
    ),

    // User association (GDPR)
    userId: v.optional(v.string()),

    // Participants (for tracking)
    participants: v.array(v.string()), // Memory spaces or participants involved

    // Cross-space access control
    grantedAccess: v.optional(
      v.array(
        v.object({
          memorySpaceId: v.string(), // Which space has access
          scope: v.string(), // 'read-only', 'context-only', etc.
          grantedAt: v.number(),
        }),
      ),
    ),

    // Data (flexible)
    data: v.optional(v.any()),

    // Metadata
    metadata: v.optional(v.any()),

    // Versioning (automatic version tracking for updates)
    version: v.number(), // Current version number (starts at 1)
    previousVersions: v.array(
      v.object({
        version: v.number(),
        status: v.string(),
        data: v.optional(v.any()),
        timestamp: v.number(),
        updatedBy: v.optional(v.string()), // Agent/participant that made the change
      }),
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_contextId", ["contextId"]) // Unique lookup
    .index("by_memorySpace", ["memorySpaceId"]) // NEW: Space's contexts
    .index("by_tenantId", ["tenantId"]) // Tenant's contexts
    .index("by_tenant_contextId", ["tenantId", "contextId"]) // Tenant + context ID
    .index("by_tenant_space", ["tenantId", "memorySpaceId"]) // Tenant + space
    .index("by_parentId", ["parentId"]) // Child lookup
    .index("by_rootId", ["rootId"]) // All contexts in tree
    .index("by_status", ["status"]) // Filter by status
    .index("by_memorySpace_status", ["memorySpaceId", "status"]) // NEW
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_created", ["createdAt"]), // Chronological

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Agents Registry (Optional Metadata Layer)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  agents: defineTable({
    // Identity
    agentId: v.string(), // Unique agent identifier

    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v.optional(v.string()), // Tenant ID for isolation

    // Metadata
    name: v.string(), // Display name
    description: v.optional(v.string()), // What this agent does
    metadata: v.optional(v.any()), // Flexible metadata (team, capabilities, etc.)

    // Configuration
    config: v.optional(v.any()), // Agent-specific configuration

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived"),
    ),

    // Timestamps
    registeredAt: v.number(),
    updatedAt: v.number(),
    lastActive: v.optional(v.number()), // Last time agent created data
  })
    .index("by_agentId", ["agentId"]) // Unique lookup
    .index("by_tenantId", ["tenantId"]) // Tenant's agents
    .index("by_tenant_status", ["tenantId", "status"]) // Tenant + status
    .index("by_status", ["status"]) // Filter by status
    .index("by_registered", ["registeredAt"]), // Chronological ordering

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Sessions (Native Session Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  sessions: defineTable({
    // Identity
    sessionId: v.string(), // Unique session ID
    userId: v.string(), // User this session belongs to

    // Multi-tenancy (NEW - critical for isolation)
    tenantId: v.optional(v.string()), // Tenant ID for SaaS isolation

    // Memory space association
    memorySpaceId: v.optional(v.string()), // Memory space for this session

    // Session state
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("ended")),
    startedAt: v.number(), // When session started
    lastActiveAt: v.number(), // Last activity timestamp
    endedAt: v.optional(v.number()), // When session ended
    expiresAt: v.optional(v.number()), // When session expires (from governance policy)

    // Fully extensible metadata (v.any() allows any shape)
    metadata: v.optional(v.any()),

    // Statistics
    messageCount: v.number(), // Messages in this session
    memoryCount: v.number(), // Memories created in this session
  })
    .index("by_sessionId", ["sessionId"]) // Unique lookup
    .index("by_userId", ["userId"]) // User's sessions
    .index("by_tenantId", ["tenantId"]) // Tenant's sessions
    .index("by_tenant_user", ["tenantId", "userId"]) // Tenant + user sessions
    .index("by_status", ["status"]) // Active/idle/ended
    .index("by_memorySpace", ["memorySpaceId"]) // Sessions in memory space
    .index("by_lastActive", ["lastActiveAt"]) // For expiration cleanup
    .index("by_tenant_status", ["tenantId", "status"]), // Tenant + status

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Governance Policies (Data Retention, Purging, and Compliance)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  governancePolicies: defineTable({
    // Scope
    organizationId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Memory space override

    // Policy configuration (full JSON structure)
    policy: v.any(), // GovernancePolicy structure

    // Metadata
    isActive: v.boolean(),
    appliedBy: v.optional(v.string()), // Who applied this policy

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_memorySpace", ["memorySpaceId"])
    .index("by_active", ["isActive", "organizationId"])
    .index("by_updated", ["updatedAt"]),

  // Governance Enforcement Log (Audit Trail)
  governanceEnforcement: defineTable({
    // Scope
    organizationId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),

    // Enforcement details
    enforcementType: v.union(v.literal("automatic"), v.literal("manual")),
    layers: v.array(v.string()), // Which layers were enforced
    rules: v.array(v.string()), // Which rules were enforced

    // Results
    versionsDeleted: v.number(),
    recordsPurged: v.number(),
    storageFreed: v.number(), // MB

    // Metadata
    triggeredBy: v.optional(v.string()),

    // Timestamps
    executedAt: v.number(),
  })
    .index("by_organization", ["organizationId", "executedAt"])
    .index("by_memorySpace", ["memorySpaceId", "executedAt"])
    .index("by_executed", ["executedAt"]),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Graph Sync Queue (Real-time Graph Database Synchronization)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  graphSyncQueue: defineTable({
    // Entity identification
    table: v.string(), // "memories", "facts", "contexts", "conversations", etc.
    entityId: v.string(), // Cortex entity ID

    // Operation type
    operation: v.union(
      v.literal("insert"),
      v.literal("update"),
      v.literal("delete"),
    ),

    // Entity data (full object for sync)
    entity: v.optional(v.any()), // Null for deletes

    // Sync status
    synced: v.boolean(),
    syncedAt: v.optional(v.number()),

    // Retry tracking
    failedAttempts: v.optional(v.number()),
    lastError: v.optional(v.string()),

    // Priority (for ordering)
    priority: v.optional(v.string()), // "high", "normal", "low"

    // Timestamps
    createdAt: v.number(),
  })
    .index("by_synced", ["synced"]) // Get unsynced items (reactive query!)
    .index("by_table", ["table"]) // Filter by entity type
    .index("by_table_entity", ["table", "entityId"]) // Unique lookup
    .index("by_priority", ["priority", "synced"]) // Priority-based processing
    .index("by_created", ["createdAt"]), // Chronological

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Artifacts (Interactive Versioned Documents, memorySpace-scoped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  artifacts: defineTable({
    // Identity
    artifactId: v.string(),
    memorySpaceId: v.string(),
    participantId: v.optional(v.string()),

    // Multi-tenancy
    tenantId: v.optional(v.string()),

    // Ownership
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),

    // Kind
    kind: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("sheet"),
      v.literal("image"),
      v.literal("diagram"),
      v.literal("html"),
      v.literal("custom"),
    ),
    kindConfig: v.optional(
      v.object({
        customKind: v.optional(v.string()),
        mimeType: v.optional(v.string()),
        language: v.optional(v.string()),
        framework: v.optional(v.string()),
        schema: v.optional(v.any()),
      }),
    ),

    // Content (mutually exclusive)
    content: v.optional(v.string()),
    fileRef: v.optional(
      v.object({
        storageId: v.id("_storage"),
        mimeType: v.string(),
        size: v.number(),
        checksum: v.optional(v.string()),
        originalFilename: v.optional(v.string()),
      }),
    ),

    // Streaming
    streamingState: v.union(
      v.literal("draft"),
      v.literal("streaming"),
      v.literal("paused"),
      v.literal("final"),
      v.literal("error"),
    ),
    streamingMetadata: v.optional(
      v.object({
        sessionId: v.optional(v.string()),
        startedAt: v.optional(v.number()),
        lastChunkAt: v.optional(v.number()),
        bytesReceived: v.optional(v.number()),
        estimatedTotal: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
        errorCode: v.optional(v.string()),
        errorAt: v.optional(v.number()),
      }),
    ),

    // Display
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),

    // References
    conversationRef: v.optional(
      v.object({
        conversationId: v.string(),
        messageId: v.optional(v.string()),
        turnIndex: v.optional(v.number()),
      }),
    ),
    memoryRefs: v.optional(
      v.array(
        v.object({
          memoryId: v.string(),
          relevance: v.optional(v.number()),
        }),
      ),
    ),

    // Versioning (Undo/Redo)
    version: v.number(),
    versionPointer: v.number(),
    versionHistory: v.array(
      v.object({
        version: v.number(),
        content: v.optional(v.string()),
        fileRef: v.optional(
          v.object({
            storageId: v.id("_storage"),
            mimeType: v.string(),
            size: v.number(),
            checksum: v.optional(v.string()),
            originalFilename: v.optional(v.string()),
          }),
        ),
        title: v.optional(v.string()),
        timestamp: v.number(),
        changedBy: v.optional(v.string()),
        changeType: v.union(
          v.literal("create"),
          v.literal("update"),
          v.literal("undo"),
          v.literal("redo"),
        ),
        changeSummary: v.optional(v.string()),
      }),
    ),

    // Collaboration
    collaborators: v.optional(
      v.array(
        v.object({
          id: v.string(),
          type: v.union(v.literal("user"), v.literal("agent")),
          role: v.union(
            v.literal("owner"),
            v.literal("editor"),
            v.literal("viewer"),
          ),
          addedAt: v.number(),
          lastEditAt: v.optional(v.number()),
        }),
      ),
    ),

    // Stats
    stats: v.optional(
      v.object({
        characterCount: v.optional(v.number()),
        wordCount: v.optional(v.number()),
        lineCount: v.optional(v.number()),
        tokenCount: v.optional(v.number()),
      }),
    ),

    // Metadata
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    lastAccessedAt: v.optional(v.number()),
    accessCount: v.optional(v.number()),

    // Soft Delete
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
  })
    // Unique lookups
    .index("by_artifactId", ["artifactId"])

    // Memory space isolation
    .index("by_memorySpace", ["memorySpaceId"])
    .index("by_memorySpace_created", ["memorySpaceId", "createdAt"])
    .index("by_memorySpace_updated", ["memorySpaceId", "updatedAt"])
    .index("by_memorySpace_kind", ["memorySpaceId", "kind"])
    .index("by_memorySpace_state", ["memorySpaceId", "streamingState"])

    // Multi-tenancy
    .index("by_tenantId", ["tenantId"])
    .index("by_tenant_space", ["tenantId", "memorySpaceId"])
    .index("by_tenant_artifactId", ["tenantId", "artifactId"])
    .index("by_tenant_space_kind", ["tenantId", "memorySpaceId", "kind"])

    // Conversation association
    .index("by_conversation", ["conversationRef.conversationId"])
    .index("by_memorySpace_conversation", [
      "memorySpaceId",
      "conversationRef.conversationId",
    ])

    // Ownership (GDPR, attribution)
    .index("by_userId", ["userId"])
    .index("by_agentId", ["agentId"])
    .index("by_memorySpace_user", ["memorySpaceId", "userId"])
    .index("by_memorySpace_agent", ["memorySpaceId", "agentId"])
    .index("by_participantId", ["participantId"])

    // Streaming queries
    .index("by_streamingState", ["streamingState"])
    .index("by_memorySpace_streaming", [
      "memorySpaceId",
      "streamingState",
      "updatedAt",
    ])

    // Chronological
    .index("by_created", ["createdAt"])
    .index("by_updated", ["updatedAt"])
    .index("by_lastAccessed", ["lastAccessedAt"])

    // Full-text search
    .searchIndex("by_content", {
      searchField: "content",
      filterFields: [
        "memorySpaceId",
        "tenantId",
        "kind",
        "userId",
        "agentId",
        "participantId",
        "streamingState",
      ],
    })
    .searchIndex("by_title", {
      searchField: "title",
      filterFields: ["memorySpaceId", "tenantId", "kind"],
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Attachments (Multi-modal File Storage, memorySpace-scoped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  attachments: defineTable({
    // Identity
    attachmentId: v.string(), // Unique attachment ID
    memorySpaceId: v.string(), // Memory space isolation

    // Multi-tenancy
    tenantId: v.optional(v.string()), // Tenant ID for SaaS isolation

    // Ownership
    userId: v.string(), // User who uploaded this attachment
    conversationId: v.optional(v.string()), // Linked conversation
    messageId: v.optional(v.string()), // Linked message
    memoryId: v.optional(v.string()), // Linked memory
    artifactId: v.optional(v.string()), // Linked artifact

    // File storage (Convex native)
    storageId: v.id("_storage"), // Convex file storage reference

    // File metadata
    type: v.union(
      v.literal("image"),
      v.literal("audio"),
      v.literal("video"),
      v.literal("file"),
      v.literal("pdf"),
    ),
    mimeType: v.string(), // MIME type (e.g., "image/png")
    filename: v.string(), // Original filename
    size: v.number(), // File size in bytes

    // Extracted content (for future search/RAG - Phase 2+)
    extractedText: v.optional(v.string()), // OCR/PDF text extraction
    transcript: v.optional(v.string()), // Audio/video transcription
    embedding: v.optional(v.array(v.float64())), // Semantic search embedding

    // Type-specific metadata
    dimensions: v.optional(
      v.object({
        width: v.number(),
        height: v.number(),
      }),
    ), // Image/video dimensions
    duration: v.optional(v.number()), // Audio/video duration in seconds

    // Generic metadata
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // Unique lookups
    .index("by_attachmentId", ["attachmentId"])

    // Memory space isolation
    .index("by_memorySpace", ["memorySpaceId"])
    .index("by_memorySpace_type", ["memorySpaceId", "type"])
    .index("by_memorySpace_created", ["memorySpaceId", "createdAt"])

    // Multi-tenancy
    .index("by_tenantId", ["tenantId"])
    .index("by_tenant_space", ["tenantId", "memorySpaceId"])
    .index("by_tenant_attachmentId", ["tenantId", "attachmentId"])

    // Relationship lookups
    .index("by_conversation", ["conversationId"])
    .index("by_message", ["messageId"])
    .index("by_memory", ["memoryId"])
    .index("by_artifact", ["artifactId"])

    // Ownership (GDPR cascade)
    .index("by_userId", ["userId"])
    .index("by_memorySpace_user", ["memorySpaceId", "userId"])

    // Chronological
    .index("by_created", ["createdAt"])
    .index("by_updated", ["updatedAt"])

    // Vector search for semantic content (Phase 3+)
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // OpenAI text-embedding-3-small / ada-002
      filterFields: ["memorySpaceId", "tenantId", "type"],
    }),
});
