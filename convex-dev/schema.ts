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
 * Coordination:
 * - contexts - Hierarchical context chains (memorySpace-scoped, cross-space support)
 * - memorySpaces - Memory space registry (Hive/Collaboration modes)
 * - agents - DEPRECATED: Use memorySpaces instead
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

    // Type: user-agent (user ↔ participant) or agent-agent (space ↔ space)
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),

    // Participants (based on type)
    participants: v.object({
      // user-agent conversations
      userId: v.optional(v.string()),
      participantId: v.optional(v.string()), // Hive Mode tracking

      // agent-agent conversations (Collaboration Mode - cross-space)
      memorySpaceIds: v.optional(v.array(v.string())), // Both spaces involved
    }),

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
        participantId: v.optional(v.string()), // Which participant sent this (Hive Mode)
        metadata: v.optional(v.any()), // Flexible metadata
      }),
    ),

    // Statistics
    messageCount: v.number(),

    // Metadata (flexible)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversationId", ["conversationId"]) // Unique lookup
    .index("by_memorySpace", ["memorySpaceId"]) // NEW: Memory space's conversations
    .index("by_type", ["type"]) // List by type
    .index("by_user", ["participants.userId"]) // User's conversations
    .index("by_memorySpace_user", ["memorySpaceId", "participants.userId"]) // NEW: Space + user
    .index("by_created", ["createdAt"]), // Chronological ordering

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

    // Metadata (flexible)
    metadata: v.optional(
      v.object({
        publishedBy: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        importance: v.optional(v.number()),
      }),
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type_id", ["type", "id"]) // Unique lookup
    .index("by_type", ["type"]) // List by type
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

    // Metadata (optional)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Access tracking
    accessCount: v.number(),
    lastAccessed: v.optional(v.number()),
  })
    .index("by_namespace_key", ["namespace", "key"]) // Unique lookup
    .index("by_namespace", ["namespace"]) // List by namespace
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

    // GDPR support
    userId: v.optional(v.string()), // For cascade deletion

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

    // Metadata
    importance: v.number(), // 0-100 (flattened for filtering)
    tags: v.array(v.string()), // Flattened for filtering

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
  })
    .index("by_memorySpace", ["memorySpaceId"]) // NEW: Memory space's memories
    .index("by_memoryId", ["memoryId"]) // Unique lookup
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_memorySpace_created", ["memorySpaceId", "createdAt"]) // NEW: Chronological
    .index("by_memorySpace_userId", ["memorySpaceId", "userId"]) // NEW: Space + user
    .index("by_participantId", ["participantId"]) // NEW: Hive Mode tracking
    .searchIndex("by_content", {
      searchField: "content",
      filterFields: ["memorySpaceId", "sourceType", "userId", "participantId"], // Updated filters
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // Default: OpenAI text-embedding-3-small
      filterFields: ["memorySpaceId", "userId", "participantId"], // Updated: memorySpace isolation
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 3: Facts Store (NEW - memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  facts: defineTable({
    // Identity
    factId: v.string(), // Unique ID for this fact
    memorySpaceId: v.string(), // Memory space isolation
    participantId: v.optional(v.string()), // Hive Mode: which participant extracted this

    // Fact content
    fact: v.string(), // The fact statement
    factType: v.union(
      v.literal("preference"),
      v.literal("identity"),
      v.literal("knowledge"),
      v.literal("relationship"),
      v.literal("event"),
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
  })
    .index("by_factId", ["factId"]) // Unique lookup
    .index("by_memorySpace", ["memorySpaceId"]) // Memory space's facts
    .index("by_memorySpace_subject", ["memorySpaceId", "subject"]) // Entity-centric queries
    .index("by_participantId", ["participantId"]) // Hive Mode tracking
    .searchIndex("by_content", {
      searchField: "fact",
      filterFields: ["memorySpaceId", "factType"],
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Spaces Registry (Hive/Collaboration Mode Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memorySpaces: defineTable({
    // Identity
    memorySpaceId: v.string(), // Unique memory space ID
    name: v.optional(v.string()), // Human-readable name
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

    // Purpose
    purpose: v.string(), // What this context is for

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

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_contextId", ["contextId"]) // Unique lookup
    .index("by_memorySpace", ["memorySpaceId"]) // NEW: Space's contexts
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
    .index("by_status", ["status"]) // Filter by status
    .index("by_registered", ["registeredAt"]), // Chronological ordering

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
});
