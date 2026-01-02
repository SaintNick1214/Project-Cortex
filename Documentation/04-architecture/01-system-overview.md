# System Overview

> **Last Updated**: 2026-01-01

High-level architecture of Cortex and how it leverages Convex.

## Architecture at a Glance

Cortex is built **natively on Convex** - a reactive TypeScript database with built-in vector search. We organize storage into **four layers** (ACID + Vector + Facts + Convenience) plus **coordination entities** and a **resilience layer**:

```
                    ┌─────────────────────────────┐
                    │    Resilience Layer         │
                    │  (Rate Limiting, Circuit    │
                    │   Breaker, Concurrency)     │
                    └──────────────┬──────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: ACID Stores                      │
│                  (Convex Tables - Immutable Sources)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Conversations   │  │  Immutable      │  │  Mutable    │  │
│  │ (Layer 1a)      │  │  (Layer 1b)     │  │  (Layer 1c) │  │
│  │                 │  │                 │  │             │  │
│  │ User↔Agent      │  │ KB Articles     │  │ Inventory   │  │
│  │ Agent↔Agent     │  │ Policies        │  │ Config      │  │
│  │                 │  │ Audit Logs      │  │ Counters    │  │
│  │                 │  │ User Profiles   │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│  Append-only          Versioned             Current-value   │
│  memorySpace-scoped   TRULY SHARED          TRULY SHARED    │
│  Indexes: memorySpace Indexes: type, userId Indexes: userId │
└───────────┬───────────────────┬─────────────────┬───────────┘
            │                   │                 │
            │ conversationRef   │ immutableRef    │ mutableRef
            │                   │                 │
            └───────────────────┴─────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────┐
│              Layer 2: Vector Index (Convex Table)           │
├─────────────────────────────────────────────────────────────┤
│  memories                                                   │
│  ├── Vector Index: by_embedding (1536-dim default)          │
│  ├── Regular Indexes: by_memorySpace, by_userId, etc.       │
│  └── Search Index: by_content (full-text)                   │
│                                                             │
│  memorySpace-scoped memories with embeddings                │
│  References Layer 1 stores via Ref fields                   │
│  Versioned with retention rules                             │
│  participantId tracking for Hive Mode                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ factsRef
                            ↓
┌─────────────────────────────────────────────────────────────┐
│       Layer 3: Facts Store (Convex Table)                   │
├─────────────────────────────────────────────────────────────┤
│  facts                                                      │
│  ├── Structured knowledge with versioning                   │
│  ├── Belief Revision System (v0.24.0+)                      │
│  ├── 60-90% token savings for infinite context              │
│  └── Search Index: by_content (full-text)                   │
│                                                             │
│  memorySpace-scoped facts with confidence scoring           │
│  factHistory table for audit trail                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│       Layer 4: Convenience API (TypeScript SDK)             │
├─────────────────────────────────────────────────────────────┤
│  cortex.memory.remember() → Orchestrates L1 + L2 + L3       │
│  cortex.memory.recall() → Unified retrieval + ranking       │
│  TypeScript helpers over Convex functions                   │
│  Automatic orchestration across all layers                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Coordination Entities (Convex Tables)               │
├─────────────────────────────────────────────────────────────┤
│  memorySpaces     - Memory space registry (Hive/Collab)     │
│  users            - User profiles (GDPR cascade engine)     │
│  contexts         - Workflow coordination                   │
│  sessions         - Session lifecycle management (v0.27.0+) │
│  agents           - Agent registry (DEPRECATED)             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓ (Optional Sync)
┌─────────────────────────────────────────────────────────────┐
│        Graph Database (Optional - Neo4j/Memgraph)           │
├─────────────────────────────────────────────────────────────┤
│  graphSyncQueue   - Real-time sync queue                    │
│  Entities extracted from memories, facts, contexts          │
│  Enables multi-hop traversal and complex relationships      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            Governance & Compliance (Convex Tables)          │
├─────────────────────────────────────────────────────────────┤
│  governancePolicies      - Retention rules, compliance      │
│  governanceEnforcement   - Audit trail for enforcement      │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Convex-Native Architecture

**Everything is a Convex table:**

- Conversations → `conversations` table (Layer 1a, memorySpace-scoped)
- Immutable data → `immutable` table (Layer 1b, TRULY shared)
- Mutable data → `mutable` table (Layer 1c, TRULY shared)
- Vector memories → `memories` table with vector index (Layer 2, memorySpace-scoped)
- Facts → `facts` table with belief revision (Layer 3, memorySpace-scoped)
- Memory spaces → `memorySpaces` table (Hive/Collaboration registry)
- User profiles → Stored in `immutable` table (type='user', TRULY shared)
- Contexts → `contexts` table (memorySpace-scoped, cross-space support)
- Sessions → `sessions` table (v0.27.0+, user-scoped)
- Governance → `governancePolicies` + `governanceEnforcement` tables
- Graph sync → `graphSyncQueue` table (optional)

**Benefits:**

- ✅ ACID transactions (Convex guarantees)
- ✅ Real-time reactivity (Convex subscriptions)
- ✅ TypeScript type safety (end-to-end)
- ✅ Built-in vector search (native Convex feature)
- ✅ Automatic indexing (optimized queries)
- ✅ Multi-tenancy support (tenantId throughout)

### 2. Layer Separation

**Layer 1: ACID Stores (Source of Truth)**

- **1a: Conversations** - Append-only message history (memorySpace-scoped)
- **1b: Immutable** - Versioned shared data (NO memorySpace scoping, TRULY shared)
- **1c: Mutable** - Current-value shared data (NO memorySpace scoping, TRULY shared)
- Complete data preservation, compliance, and audit trail

**Layer 2: Vector Index (Searchable, Optimized)**

- Fast semantic search via embeddings
- Retention rules (default: 10 versions)
- References Layer 1 via Refs
- Performance optimized with indexes
- memorySpace-scoped for isolation

**Layer 3: Facts Store (Structured Knowledge)**

- LLM-extracted facts for 60-90% token savings
- Belief Revision System (v0.24.0+) - intelligent conflict resolution
- Versioned with supersede chains
- memorySpace-scoped for isolation
- factHistory audit trail

**Layer 4: Convenience API (SDK Orchestration)**

- Single API for all layers: `remember()`, `recall()`
- Automatic linking and registration
- Reduced boilerplate, type-safe
- Optional layer skipping for control

### 3. Memory Spaces as Isolation Boundaries

**Memory spaces** (not agents) are the primary isolation boundary:

```typescript
// Memory space = isolation boundary
memorySpaceId: "user-123-personal"  // User's personal space
memorySpaceId: "team-alpha"         // Team shared space
memorySpaceId: "project-acme"       // Project-specific space

// All operations scoped by memorySpaceId:
await cortex.memory.remember({ memorySpaceId: "user-123-personal", ... });
await cortex.memory.search("user-123-personal", query, filters);

// Cross-space access requires explicit context chain permission
```

**Key Insight:** `memorySpaceId` replaced `agentId` as the primary scoping parameter. This enables:

- Hive Mode: Multiple participants in one shared space
- Collaboration Mode: Memory spaces delegate via context chains
- Flexible isolation: Per-user, per-team, per-project, or custom

### 4. References Over Duplication

Data is linked via IDs, not duplicated:

```typescript
// Vector memory (Layer 2)
{
  _id: "mem_abc123",
  memorySpaceId: "support-space",
  participantId: "support-bot",      // NEW: Hive Mode tracking
  content: "User password is Blue",
  conversationRef: {
    conversationId: "conv_xyz789",   // ← Points to Layer 1a
    messageIds: ["msg_001"],
  },
  factsRef: {
    factId: "fact_456",              // ← Points to Layer 3
    version: 1,
  }
}

// Conversation (Layer 1a)
{
  _id: "conv_xyz789",
  memorySpaceId: "support-space",
  messages: [
    {
      id: "msg_001",
      content: "My password is Blue",  // ← Original source
      participantId: "support-bot",
      ...
    }
  ]
}

// Fact (Layer 3)
{
  _id: "fact_456",
  memorySpaceId: "support-space",
  fact: "User's password is Blue",
  factType: "identity",
  subject: "user-123",
  confidence: 95,
  sourceRef: {
    conversationId: "conv_xyz789",
    messageIds: ["msg_001"],
  }
}
```

**Benefits:**

- No data duplication
- Storage efficiency
- Consistency (single source of truth)
- Can always retrieve full context via references

### 5. Universal Filters Across Operations

**The same filters work everywhere:**

```typescript
// Define filters once
const filters = {
  userId: "user-123",
  tags: ["preferences"],
  minImportance: 70,
  createdAfter: new Date("2025-10-01"),
};

// Use across all operations
await cortex.memory.search(memorySpaceId, query, filters);
await cortex.memory.count(memorySpaceId, filters);
await cortex.memory.list(memorySpaceId, filters);
await cortex.memory.deleteMany(memorySpaceId, filters);
```

### 6. Automatic Versioning

All updates create new versions, preserving history:

```typescript
// Update creates v2, preserves v1 in previousVersions array
await cortex.memory.update(memorySpaceId, memoryId, { content: "New value" });

// Applies to: memories, facts, immutable, contexts
// Does NOT apply to: conversations (append-only), mutable (overwrites)
```

**Retention:** Configurable per layer (default: 10 versions)

### 7. Optional Graph Integration

**Graph-Lite (Built-in):**

- Uses Convex references (conversationRef, parentId, factsRef) as edges
- Excellent for 1-5 hop traversals
- Zero setup, always available
- Powered by efficient indexed lookups

**Native Graph (Optional):**

- Syncs to Neo4j or Memgraph via graphSyncQueue
- Enables deep traversals (6+ hops), complex pattern matching
- Managed automatically via `syncToGraph` option
- Best for knowledge graphs and complex dependency analysis

**Learn more:** [Graph Operations API](../03-api-reference/13-graph-operations.md)

### 5. Flexible Yet Typed

**Schema flexibility:**

- Core fields typed (agentId, conversationId, etc.)
- `data`, `metadata`, `value` use `v.any()` for flexibility
- TypeScript types enforce structure at SDK level
- Convex schema enforces core fields

**Example:**

```typescript
// Convex schema (minimal constraints)
memories: defineTable({
  memorySpaceId: v.string(),
  content: v.string(),
  embedding: v.optional(v.array(v.float64())),
  metadata: v.any(), // ← Flexible
}).vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 3072,
  filterFields: ["agentId"],
});

// TypeScript SDK (structure enforcement)
interface MemoryMetadata {
  importance: number; // 0-100
  tags: string[];
  [key: string]: any; // ← Custom fields allowed
}
```

### 6. Graph Integration

Cortex offers two levels of graph capabilities:

**Graph-Lite (Built-in):**

- Uses Convex references (`conversationRef`, `parentId`) as edges
- Excellent for 1-5 hop traversals (e.g. Memory -> Conversation -> User)
- Zero setup, always available
- Powered by efficient indexed lookups

**Native Graph (Optional Integration):**

- Syncs Cortex data to Neo4j or Memgraph
- Enables deep traversals (6+ hops), complex pattern matching, and graph algorithms
- Managed automatically via `syncToGraph` option in all APIs
- Best for social graphs, knowledge graphs, and complex dependency analysis

See [Graph Operations API](../03-api-reference/15-graph-operations.md) for details.

---

## Convex Tables

### Layer 1a: conversations

```typescript
conversations: defineTable({
  // Identity & Isolation
  conversationId: v.string(),
  memorySpaceId: v.string(), // NEW: Primary isolation boundary
  participantId: v.optional(v.string()), // NEW: Hive Mode tracking
  tenantId: v.optional(v.string()), // NEW: Multi-tenancy

  // Type
  type: v.union(v.literal("user-agent"), v.literal("agent-agent")),

  // Participants
  participants: v.object({
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    memorySpaceIds: v.optional(v.array(v.string())), // For agent-agent
  }),

  // Messages (append-only)
  messages: v.array(
    v.object({
      id: v.string(),
      role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
      content: v.string(),
      timestamp: v.number(),
      participantId: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  ),

  messageCount: v.number(),
  metadata: v.optional(v.any()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_conversationId", ["conversationId"])
  .index("by_memorySpace", ["memorySpaceId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_space", ["tenantId", "memorySpaceId"])
  .index("by_type", ["type"])
  .index("by_user", ["participants.userId"])
  .index("by_agent", ["participants.agentId"])
  .index("by_memorySpace_user", ["memorySpaceId", "participants.userId"])
  .index("by_memorySpace_agent", ["memorySpaceId", "participants.agentId"])
  .index("by_created", ["createdAt"]);
```

**Purpose:** Immutable conversation threads (user-agent, agent-agent)  
**Scoped:** memorySpaceId (primary isolation)  
**Size:** Can grow large (10K+ messages per conversation)  
**Retention:** Forever (no deletion unless GDPR or manual)

### Layer 1b: immutable

```typescript
immutable: defineTable({
  // Composite key
  type: v.string(), // 'kb-article', 'policy', 'user', 'feedback', etc.
  id: v.string(), // Type-specific logical ID

  // Data (flexible, immutable once stored)
  data: v.any(),

  // GDPR support
  userId: v.optional(v.string()),

  // Multi-tenancy (NEW)
  tenantId: v.optional(v.string()),

  // Metadata
  metadata: v.optional(v.any()),

  // Versioning
  version: v.number(),
  previousVersions: v.array(
    v.object({
      version: v.number(),
      data: v.any(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    }),
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_type_id", ["type", "id"])
  .index("by_type", ["type"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_type_id", ["tenantId", "type", "id"])
  .index("by_userId", ["userId"])
  .index("by_created", ["createdAt"]);
```

**Purpose:** Shared, versioned, immutable data (KB, policies, user profiles)  
**Scoped:** NOT scoped by memorySpace - TRULY SHARED across all spaces  
**Size:** Medium (50-100KB per record)  
**Retention:** Configurable (default: 20 versions)

### Layer 1c: mutable

```typescript
mutable: defineTable({
  // Composite key
  namespace: v.string(), // 'inventory', 'config', 'counters', etc.
  key: v.string(), // Unique within namespace

  // Value (flexible, mutable)
  value: v.any(),

  // GDPR support
  userId: v.optional(v.string()),

  // Multi-tenancy (NEW)
  tenantId: v.optional(v.string()),

  // Metadata
  metadata: v.optional(v.any()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_namespace_key", ["namespace", "key"])
  .index("by_namespace", ["namespace"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_namespace", ["tenantId", "namespace"])
  .index("by_tenant_namespace_key", ["tenantId", "namespace", "key"])
  .index("by_userId", ["userId"])
  .index("by_updated", ["updatedAt"]);
```

**Purpose:** Shared, mutable, current-value data (inventory, config, counters)  
**Scoped:** NOT scoped by memorySpace - TRULY SHARED across all spaces  
**Size:** Small to medium  
**Retention:** No versioning (overwrites)

### Layer 2: memories

```typescript
memories: defineTable({
  // Identity & Isolation
  memoryId: v.string(),
  memorySpaceId: v.string(), // PRIMARY: Memory space isolation
  participantId: v.optional(v.string()), // NEW: Hive Mode participant
  tenantId: v.optional(v.string()), // NEW: Multi-tenancy

  // Content
  content: v.string(),
  contentType: v.union(
    v.literal("raw"),
    v.literal("summarized"),
    v.literal("fact"), // NEW: For facts indexed in vector
  ),
  embedding: v.optional(v.array(v.float64())),

  // Source (flattened for indexing)
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

  // Message role (for conversation memories)
  messageRole: v.optional(
    v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
  ),

  // Owner Attribution
  userId: v.optional(v.string()), // For GDPR cascade
  agentId: v.optional(v.string()), // For agent deletion cascade

  // Layer 1 References
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

  // NEW: Layer 3 Reference
  factsRef: v.optional(
    v.object({
      factId: v.string(),
      version: v.optional(v.number()),
    }),
  ),

  // Metadata (flattened for indexing)
  importance: v.number(), // Flattened from metadata
  tags: v.array(v.string()), // Flattened from metadata

  // Enrichment Fields
  enrichedContent: v.optional(v.string()),
  factCategory: v.optional(v.string()),
  metadata: v.optional(v.any()),

  // Versioning
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

  // Streaming support (NEW)
  isPartial: v.optional(v.boolean()),
  partialMetadata: v.optional(v.any()),
})
  .index("by_memorySpace", ["memorySpaceId"])
  .index("by_memoryId", ["memoryId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_space", ["tenantId", "memorySpaceId"])
  .index("by_userId", ["userId"])
  .index("by_agentId", ["agentId"])
  .index("by_memorySpace_created", ["memorySpaceId", "createdAt"])
  .index("by_memorySpace_userId", ["memorySpaceId", "userId"])
  .index("by_memorySpace_agentId", ["memorySpaceId", "agentId"])
  .index("by_participantId", ["participantId"])
  .searchIndex("by_content", {
    searchField: "content",
    filterFields: [
      "memorySpaceId",
      "tenantId",
      "sourceType",
      "userId",
      "agentId",
      "participantId",
    ],
  })
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536, // Default: text-embedding-3-small
    filterFields: [
      "memorySpaceId",
      "tenantId",
      "userId",
      "agentId",
      "participantId",
    ],
  });
```

**Purpose:** Searchable memories with semantic and keyword search  
**Scoped:** memorySpaceId (primary isolation)  
**Size:** Small (< 10KB per memory)  
**Retention:** Versioned (default: 10 versions per memory)

### Layer 3: facts

```typescript
facts: defineTable({
  // Identity & Isolation
  factId: v.string(),
  memorySpaceId: v.string(), // Memory space isolation
  participantId: v.optional(v.string()), // Hive Mode tracking
  userId: v.optional(v.string()), // GDPR compliance
  tenantId: v.optional(v.string()), // Multi-tenancy

  // Fact content
  fact: v.string(),
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
  subject: v.optional(v.string()),
  predicate: v.optional(v.string()),
  object: v.optional(v.string()),

  // Quality & Source
  confidence: v.number(), // 0-100
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

  // Enrichment Fields (v0.15.0+)
  category: v.optional(v.string()),
  searchAliases: v.optional(v.array(v.string())),
  semanticContext: v.optional(v.string()),
  entities: v.optional(
    v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        fullValue: v.optional(v.string()),
      }),
    ),
  ),
  relations: v.optional(
    v.array(
      v.object({
        subject: v.string(),
        predicate: v.string(),
        object: v.string(),
      }),
    ),
  ),

  // Temporal validity
  validFrom: v.optional(v.number()),
  validUntil: v.optional(v.number()),

  // Versioning (creates immutable chain)
  version: v.number(),
  supersededBy: v.optional(v.string()), // factId of newer version
  supersedes: v.optional(v.string()), // factId this replaces

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_factId", ["factId"])
  .index("by_memorySpace", ["memorySpaceId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_space", ["tenantId", "memorySpaceId"])
  .index("by_memorySpace_subject", ["memorySpaceId", "subject"])
  .index("by_participantId", ["participantId"])
  .index("by_userId", ["userId"])
  .searchIndex("by_content", {
    searchField: "fact",
    filterFields: ["memorySpaceId", "tenantId", "factType"],
  });
```

**Purpose:** Structured knowledge with belief revision (60-90% token savings)  
**Scoped:** memorySpaceId (primary isolation)  
**Size:** Small (~1KB per fact)  
**Retention:** Versioned with supersede chains

### factHistory: Belief Revision Audit Trail

```typescript
factHistory: defineTable({
  eventId: v.string(),
  factId: v.string(),
  memorySpaceId: v.string(),

  // Action
  action: v.union(
    v.literal("CREATE"),
    v.literal("UPDATE"),
    v.literal("SUPERSEDE"),
    v.literal("DELETE"),
  ),

  // Values
  oldValue: v.optional(v.string()),
  newValue: v.optional(v.string()),

  // Relationships
  supersededBy: v.optional(v.string()),
  supersedes: v.optional(v.string()),

  // Decision context
  reason: v.optional(v.string()),
  confidence: v.optional(v.number()),
  pipeline: v.optional(
    v.object({
      slotMatching: v.optional(v.boolean()),
      semanticMatching: v.optional(v.boolean()),
      llmResolution: v.optional(v.boolean()),
    }),
  ),

  // Source context
  userId: v.optional(v.string()),
  participantId: v.optional(v.string()),
  conversationId: v.optional(v.string()),

  timestamp: v.number(),
})
  .index("by_eventId", ["eventId"])
  .index("by_factId", ["factId"])
  .index("by_memorySpace", ["memorySpaceId"])
  .index("by_memorySpace_timestamp", ["memorySpaceId", "timestamp"])
  .index("by_action", ["action"])
  .index("by_userId", ["userId"])
  .index("by_timestamp", ["timestamp"]);
```

**Purpose:** Audit trail for Belief Revision System (v0.24.0+)  
**Size:** Small  
**Retention:** Configurable via governance policies

### Coordination: memorySpaces

```typescript
memorySpaces: defineTable({
  // Identity
  memorySpaceId: v.string(),
  name: v.optional(v.string()),
  tenantId: v.optional(v.string()),

  type: v.union(
    v.literal("personal"),
    v.literal("team"),
    v.literal("project"),
    v.literal("custom"),
  ),

  // Participants (for Hive Mode)
  participants: v.array(
    v.object({
      id: v.string(),
      type: v.string(), // 'ai-tool', 'human', 'ai-agent', 'system'
      joinedAt: v.number(),
    }),
  ),

  // Metadata
  metadata: v.any(),
  status: v.union(v.literal("active"), v.literal("archived")),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_memorySpaceId", ["memorySpaceId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_memorySpaceId", ["tenantId", "memorySpaceId"])
  .index("by_tenant_status", ["tenantId", "status"])
  .index("by_status", ["status"])
  .index("by_type", ["type"])
  .index("by_created", ["createdAt"]);
```

**Purpose:** Memory space registry for Hive/Collaboration modes  
**Size:** Small  
**Retention:** Until archived/deleted

### Coordination: users

```typescript
// Note: User profiles are stored in `immutable` table with type='user'
// No separate table needed - leverages Layer 1b infrastructure
// Accessed via cortex.users.* wrapper API
```

### Coordination: contexts

```typescript
contexts: defineTable({
  // Identity & Isolation
  contextId: v.string(),
  memorySpaceId: v.string(), // Which memory space owns this
  tenantId: v.optional(v.string()), // Multi-tenancy

  // Purpose
  purpose: v.string(),
  description: v.optional(v.string()),

  // Hierarchy
  parentId: v.optional(v.string()), // Can be cross-space
  rootId: v.optional(v.string()),
  depth: v.number(),
  childIds: v.array(v.string()),

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
  participants: v.array(v.string()),

  // Cross-space access control
  grantedAccess: v.optional(
    v.array(
      v.object({
        memorySpaceId: v.string(),
        scope: v.string(),
        grantedAt: v.number(),
      }),
    ),
  ),

  // Data (flexible)
  data: v.optional(v.any()),
  metadata: v.optional(v.any()),

  // Versioning
  version: v.number(),
  previousVersions: v.array(
    v.object({
      version: v.number(),
      status: v.string(),
      data: v.optional(v.any()),
      timestamp: v.number(),
      updatedBy: v.optional(v.string()),
    }),
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_contextId", ["contextId"])
  .index("by_memorySpace", ["memorySpaceId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_contextId", ["tenantId", "contextId"])
  .index("by_tenant_space", ["tenantId", "memorySpaceId"])
  .index("by_parentId", ["parentId"])
  .index("by_rootId", ["rootId"])
  .index("by_status", ["status"])
  .index("by_memorySpace_status", ["memorySpaceId", "status"])
  .index("by_userId", ["userId"])
  .index("by_created", ["createdAt"]);
```

**Purpose:** Workflow coordination with cross-space delegation  
**Scoped:** memorySpaceId (with cross-space access support)  
**Size:** Small  
**Retention:** Configurable (can delete completed workflows)

### Coordination: sessions (v0.27.0+)

```typescript
sessions: defineTable({
  // Identity
  sessionId: v.string(),
  userId: v.string(),
  tenantId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),

  // Session state
  status: v.union(v.literal("active"), v.literal("idle"), v.literal("ended")),
  startedAt: v.number(),
  lastActiveAt: v.number(),
  endedAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()),

  // Fully extensible metadata
  metadata: v.optional(v.any()),

  // Statistics
  messageCount: v.number(),
  memoryCount: v.number(),
})
  .index("by_sessionId", ["sessionId"])
  .index("by_userId", ["userId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_user", ["tenantId", "userId"])
  .index("by_status", ["status"])
  .index("by_memorySpace", ["memorySpaceId"])
  .index("by_lastActive", ["lastActiveAt"])
  .index("by_tenant_status", ["tenantId", "status"]);
```

**Purpose:** Multi-session tracking (web, mobile, API)  
**Scoped:** userId (user-centric)  
**Size:** Small  
**Retention:** Configurable timeouts via governance

### Coordination: agents (DEPRECATED)

```typescript
agents: defineTable({
  // Identity
  agentId: v.string(),
  tenantId: v.optional(v.string()),

  // Metadata
  name: v.string(),
  description: v.optional(v.string()),
  capabilities: v.optional(v.array(v.string())),
  metadata: v.optional(v.any()),
  config: v.optional(v.any()),
  stats: v.optional(v.any()),

  // Status
  status: v.union(
    v.literal("active"),
    v.literal("inactive"),
    v.literal("archived"),
  ),

  registeredAt: v.number(),
  updatedAt: v.number(),
  lastActive: v.optional(v.number()),
})
  .index("by_agentId", ["agentId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_tenant_status", ["tenantId", "status"])
  .index("by_status", ["status"])
  .index("by_registered", ["registeredAt"]);
```

**Purpose:** Optional metadata registry (DEPRECATED - use memorySpaces instead)  
**Note:** Superseded by `memorySpaces` table for production isolation  
**Size:** Small  
**Retention:** Until unregistered

### Governance: governancePolicies

```typescript
governancePolicies: defineTable({
  // Scope
  organizationId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),

  // Policy configuration
  policy: v.any(), // Full GovernancePolicy structure

  // Metadata
  isActive: v.boolean(),
  appliedBy: v.optional(v.string()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_memorySpace", ["memorySpaceId"])
  .index("by_active", ["isActive", "organizationId"])
  .index("by_updated", ["updatedAt"]);
```

**Purpose:** Data retention, purging, and compliance rules  
**Size:** Small  
**Retention:** Until policy removed

### Governance: governanceEnforcement

```typescript
governanceEnforcement: defineTable({
  // Scope
  organizationId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),

  // Enforcement details
  enforcementType: v.union(v.literal("automatic"), v.literal("manual")),
  layers: v.array(v.string()),
  rules: v.array(v.string()),

  // Results
  versionsDeleted: v.number(),
  recordsPurged: v.number(),
  storageFreed: v.number(),

  // Metadata
  triggeredBy: v.optional(v.string()),

  executedAt: v.number(),
})
  .index("by_organization", ["organizationId", "executedAt"])
  .index("by_memorySpace", ["memorySpaceId", "executedAt"])
  .index("by_executed", ["executedAt"]);
```

**Purpose:** Audit trail for governance enforcement  
**Size:** Small  
**Retention:** Configurable

### Graph: graphSyncQueue

```typescript
graphSyncQueue: defineTable({
  // Entity identification
  table: v.string(), // "memories", "facts", "contexts", etc.
  entityId: v.string(),

  // Operation
  operation: v.union(
    v.literal("insert"),
    v.literal("update"),
    v.literal("delete"),
  ),

  // Entity data
  entity: v.optional(v.any()), // Null for deletes

  // Sync status
  synced: v.boolean(),
  syncedAt: v.optional(v.number()),

  // Retry tracking
  failedAttempts: v.optional(v.number()),
  lastError: v.optional(v.string()),
  priority: v.optional(v.string()),

  createdAt: v.number(),
})
  .index("by_synced", ["synced"])
  .index("by_table", ["table"])
  .index("by_table_entity", ["table", "entityId"])
  .index("by_priority", ["priority", "synced"])
  .index("by_created", ["createdAt"]);
```

**Purpose:** Real-time graph database synchronization queue  
**Size:** Small (processed and cleared regularly)  
**Retention:** Deleted after successful sync

---

## Data Flow

### Storing a Conversation Memory (Full Orchestration)

```
User Message → Agent Response
     ↓
┌────────────────────────────────────────────────────────┐
│ 1. cortex.memory.remember()                            │ ← SDK Layer 4
│    Auto-registers: memorySpace, user, conversation     │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 2. Resilience Layer                                    │
│    - Rate limiting (token bucket)                      │
│    - Concurrency control (16/256 based on plan)       │
│    - Circuit breaker (if backend overloaded)          │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 3. Convex Mutation: conversations.addMessage()        │ ← Layer 1a (ACID)
│    Stores both user + agent messages                   │
│    Returns: messageIds                                 │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 4. Convex Mutation: memories.insert()                 │ ← Layer 2 (Vector)
│    With: conversationRef linking to Layer 1            │
│    Optional: embedding for semantic search             │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 5. Fact Extraction (if configured)                    │ ← Layer 3
│    - Extract facts via LLM                             │
│    - Belief Revision System checks conflicts           │
│    - Store in facts table                              │
│    - Log in factHistory                                │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 6. Optional: Graph Sync (if configured)               │
│    - Queue in graphSyncQueue                           │
│    - GraphSyncWorker syncs to Neo4j/Memgraph          │
└────────────────────────────────────────────────────────┘
```

### Searching Memories (Unified Retrieval)

```
Search Query
     ↓
┌────────────────────────────────────────────────────────┐
│ 1. cortex.memory.recall()                              │ ← SDK Layer 4
│    Or: cortex.memory.search()                          │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 2. Resilience Layer                                    │
│    - Rate limiting check                               │
│    - Circuit breaker check                             │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 3. Multi-Strategy Search                               │
│    ├─ Vector search (Layer 2) - semantic similarity    │
│    ├─ Facts search (Layer 3) - structured knowledge    │
│    └─ Graph expansion (optional) - entity relationships│
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 4. Merge, Deduplicate, and Rank                        │
│    Multi-signal scoring algorithm                      │
└────────────┬───────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────┐
│ 5. Optional: Enrich with ACID                          │
│    conversations.get() via conversationRef             │ ← Layer 1a
└────────────────────────────────────────────────────────┘
```

### GDPR Cascade Deletion (Cloud Mode)

```
cortex.users.delete(userId, { cascade: true })
     ↓
┌────────────────────────────────────────────────────────┐
│ Cloud Mode Service: Orchestrates deletions             │
└────────────┬───────────────────────────────────────────┘
             ↓
     ┌───────┴────────┬──────────┬──────────┬────────────┐
     ↓                ↓          ↓          ↓            ↓
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Layer 1a │  │ Layer 1b │  │ Layer 1c │  │ Layer 2  │  │ Layer 3  │
│ convos   │  │ immut.   │  │ mutable  │  │ memories │  │ facts    │
│ .delete  │  │ .delete  │  │ .delete  │  │ .delete  │  │ .delete  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
    All records with userId='user-123' deleted across ALL layers
    Also: sessions, contexts, factHistory with userId
```

---

## Convex Features We Use

### Vector Search (Native)

```typescript
// Convex provides native vector search
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,  // Default: text-embedding-3-small
  filterFields: ["memorySpaceId", "tenantId", "userId", "agentId", "participantId"],
});

// Query with vector similarity
const results = await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q.similar("embedding", queryVector, 10)
     .eq("memorySpaceId", memorySpaceId)  // Pre-filter by space
     .eq("tenantId", tenantId)            // Pre-filter by tenant
  )
  .collect();
```

**Our usage:**

- Semantic memory search across all layers
- Similarity scoring with multi-signal ranking
- Memory space isolation
- Tenant-based filtering
- User and participant filtering

### Full-Text Search (Native)

```typescript
// Convex provides keyword search
.searchIndex("by_content", {
  searchField: "content",
  filterFields: ["memorySpaceId", "tenantId", "sourceType", "userId", "agentId", "participantId"],
});

// Query with keywords
const results = await ctx.db
  .query("memories")
  .withSearchIndex("by_content", (q) =>
    q.search("content", keywords)
     .eq("memorySpaceId", memorySpaceId)
     .eq("tenantId", tenantId)
  )
  .collect();
```

**Our usage:**

- Keyword search (no embedding needed)
- Fallback when embeddings unavailable
- Full-text conversation and fact search
- Multi-strategy search combinations

### Regular Indexes (Native)

```typescript
// Efficient queries on indexed fields
.index("by_memorySpace", ["memorySpaceId"])
.index("by_tenantId", ["tenantId"])
.index("by_tenant_space", ["tenantId", "memorySpaceId"])  // Compound
.index("by_memorySpace_userId", ["memorySpaceId", "userId"])
.index("by_participantId", ["participantId"])

// Fast equality queries
const memories = await ctx.db
  .query("memories")
  .withIndex("by_memorySpace_userId", (q) =>
    q.eq("memorySpaceId", memorySpaceId).eq("userId", userId)
  )
  .collect();
```

**Our usage:**

- Memory space isolation (primary boundary)
- Multi-tenancy filtering
- User filtering (GDPR)
- Participant tracking (Hive Mode)
- Date range queries via by_memorySpace_created

### Reactive Queries (Native)

```typescript
// Convex queries auto-update
const { useQuery } = convex;

function AgentMemories({ agentId }) {
  const memories = useQuery(api.memories.list, { agentId });

  // Automatically re-renders when memories change! ✅
  return <MemoryList memories={memories} />;
}
```

**Our usage:**

- Real-time UI updates
- Live agent dashboards
- Collaboration features

### TypeScript Functions (Native)

```typescript
// Convex functions are TypeScript
export const storeMemory = mutation({
  args: {
    memorySpaceId: v.string(),
    content: v.string(),
    embedding: v.optional(v.array(v.float64())),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const memoryId = await ctx.db.insert("memories", {
      ...args,
      createdAt: Date.now(),
      version: 1,
      accessCount: 0,
    });

    return memoryId;
  },
});
```

**Our usage:**

- Type-safe operations
- Compile-time validation
- IntelliSense support

---

## Resilience Layer (v0.16.0+)

Cortex includes a **resilience layer** that protects all operations from overload:

```typescript
┌────────────────────────────────────────────────────────┐
│              Resilience Layer                          │
├────────────────────────────────────────────────────────┤
│  Token Bucket Rate Limiter                             │
│  ├─ 100 tokens per second default                      │
│  ├─ Configurable per operation                         │
│  └─ Prevents API overload                              │
│                                                        │
│  Concurrency Control                                   │
│  ├─ 16 concurrent (Convex Starter)                     │
│  ├─ 256 concurrent (Convex Professional)               │
│  └─ Based on your Convex plan                          │
│                                                        │
│  Circuit Breaker                                       │
│  ├─ Detects backend failures                           │
│  ├─ Opens circuit after N failures                     │
│  └─ Auto-recovery with exponential backoff             │
└────────────────────────────────────────────────────────┘
```

**Configuration:**

```typescript
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  resilience: {
    rateLimit: {
      tokensPerSecond: 100,
      maxBurst: 200,
    },
    circuitBreaker: {
      failureThreshold: 5,
      timeout: 60000,
      resetTimeout: 300000,
    },
  },
});
```

**Protection against:**

- API rate limit exhaustion
- Convex concurrent operation limits
- Backend failures and cascading errors
- Resource contention

## Scalability

### Storage Capacity

**Convex limits (as of 2026):**

- Database size: Unlimited (pay-per-GB)
- Document size: 1 MB per document
- Vector dimensions: Flexible (768, 1024, 1536, 3072, etc.)
- Index count: Up to 32 indexes per table

**Cortex design:**

- Memories: < 10KB each (fits easily)
- Facts: ~1KB each (very efficient)
- Conversations: Paginated (load in chunks)
- Vectors: 1536-dim × 8 bytes = ~12KB (default)
- All well within limits ✅

### Query Performance

**Convex guarantees:**

- Index queries: O(log n) + result size
- Vector search: Sub-100ms for millions of vectors
- Reactive updates: Real-time (< 100ms)

**Cortex optimizations:**

- Compound indexes for common queries (e.g., tenant+space, space+user)
- Vector filtering before similarity search via filterFields
- Pagination for large result sets
- Memory space isolation reduces query scope
- Resilience layer prevents overload

### Concurrent Operations

**Convex plan limits:**

- **Starter:** 16 concurrent operations
- **Professional:** 256 concurrent operations

**Resilience layer protection:**

- Token bucket rate limiter (configurable)
- Concurrency semaphore (respects Convex plan)
- Circuit breaker for backend failures
- Automatic queuing and retry

**Convex ACID guarantees:**

- Automatic transactions (all mutations)
- Optimistic concurrency control
- Conflict-free concurrent queries
- No manual locking needed

**Cortex benefits:**

- Multiple memory spaces writing concurrently ✅
- Multiple participants in Hive Mode ✅
- No race conditions
- Atomic updates (e.g., inventory decrement)
- Transactional multi-key updates (mutable store)

---

## Direct Mode vs Cloud Mode

### Direct Mode (Open Source)

**Architecture:**

```
Your App → Cortex SDK → Your Convex Instance
```

**What you control:**

- Convex deployment (Cloud, localhost, self-hosted)
- Database costs (Convex pricing)
- Embedding generation (OpenAI, Cohere, local)
- Agent execution (how agents run)
- Pub/sub for A2A (optional Redis)

**What Cortex provides:**

- TypeScript SDK
- Convex schema definitions
- Query functions
- Helper utilities
- Documentation

### Cloud Mode (Managed - Future)

**Architecture:**

```
Your App → Cortex Cloud API → Your Convex Instance
             ↓
      Cortex Services:
      - GDPR cascade orchestration
      - Auto-embedding generation
      - Managed pub/sub (Redis)
      - Agent webhooks/triggers
      - Analytics aggregation
```

**Additional features:**

- GDPR cascade (automatic)
- Auto-embeddings (zero-config)
- Managed pub/sub
- Analytics dashboard
- Governance automation

**Data stays in YOUR Convex instance** - Cortex Cloud is a management layer, not a data host.

---

## Technology Stack

### Core

- **Database:** Convex (reactive TypeScript database)
- **Vector Search:** Convex native vector indexes
- **Full-Text Search:** Convex search indexes
- **Language:** TypeScript (end-to-end)
- **Packaging:** npm package (`@cortex-platform/sdk`)

### Optional (Direct Mode)

- **Embeddings:** OpenAI, Cohere, local models (your choice)
- **Pub/Sub:** Redis, RabbitMQ, NATS (your choice)
- **Agent Runtime:** Express, Lambda, cron, etc. (your choice)

### Optional (Cloud Mode)

- **Embeddings:** Cortex-managed (OpenAI)
- **Pub/Sub:** Cortex-managed (Redis)
- **Agent Triggers:** Cortex-managed (webhooks)
- **Analytics:** Cortex-managed (aggregation service)

---

## Design Decisions

### Why Convex?

1. **Native vector search** - No separate vector database needed
2. **TypeScript queries** - Type-safe end-to-end
3. **Reactive by default** - Real-time updates built-in
4. **ACID guarantees** - Transactions and consistency
5. **Developer experience** - Excellent DX, minimal boilerplate
6. **Flexible scaling** - Serverless, pay-per-use
7. **Open source option** - Can self-host (FSL license)

### Why Four Layers?

1. **Layer 1 (ACID)** - Complete data preservation, compliance, audit trail
   - 1a: Conversations (memorySpace-scoped)
   - 1b: Immutable (TRULY shared, versioned)
   - 1c: Mutable (TRULY shared, current-value)
2. **Layer 2 (Vector)** - Fast semantic search, optimized retrieval, retention rules
   - memorySpace-scoped with participant tracking
3. **Layer 3 (Facts)** - Structured knowledge extraction, 60-90% token savings
   - Belief Revision System prevents duplicates
   - factHistory provides complete audit trail
4. **Layer 4 (Convenience)** - Automatic orchestration across all layers
   - `remember()` and `recall()` as primary interface

**Benefits:**

- Aggressive retention on Vector (save costs) without losing ACID audit trail
- Facts extraction for infinite context capability
- Resilience layer protects all operations
- Memory spaces enable flexible isolation boundaries

### Why memorySpaceId (not agentId)?

**Decision:** Memory spaces are the primary isolation boundary, not agents.

**Reasons:**

1. **Hive Mode** - Multiple participants (Cursor, Claude, etc.) in one shared space
2. **Collaboration Mode** - Memory spaces delegate via context chains
3. **Flexible boundaries** - Per-user, per-team, per-project, or custom
4. **participantId** - Track which tool/agent in a shared space created data

**Migration:** `agentId` → `memorySpaceId` (terminology shift in v0.21.0+)

### Why userId Everywhere?

1. **GDPR compliance** - Single field enables cascade deletion
2. **User isolation** - Filter by user across all stores
3. **Multi-tenant** - tenantId separate from userId for SaaS platforms
4. **Privacy** - User-specific data clearly marked
5. **Audit trail** - Track which user's data was involved

---

## Performance Characteristics

### Read Operations

| Operation                    | Typical Latency | Indexed                 | Scalability               |
| ---------------------------- | --------------- | ----------------------- | ------------------------- |
| `memory.get()`               | < 10ms          | Yes (by memoryId)       | Millions of memories      |
| `memory.search()` (semantic) | < 100ms         | Yes (vector)            | Millions of vectors       |
| `memory.search()` (keyword)  | < 50ms          | Yes (search index)      | Millions of memories      |
| `memory.recall()` (unified)  | < 150ms         | Yes (multi-strategy)    | Unlimited history         |
| `facts.search()`             | < 50ms          | Yes (search index)      | Millions of facts         |
| `conversations.get()`        | < 20ms          | Yes (by conversationId) | Millions of conversations |
| `users.get()`                | < 10ms          | Yes (by type+id)        | Millions of users         |
| `contexts.get()`             | < 10ms          | Yes (by contextId)      | Millions of contexts      |
| `sessions.get()`             | < 10ms          | Yes (by sessionId)      | Millions of sessions      |

### Write Operations

| Operation                    | Typical Latency | ACID | Versioning                    |
| ---------------------------- | --------------- | ---- | ----------------------------- |
| `memory.remember()`          | < 100ms         | ✅   | Full orchestration (L1+L2+L3) |
| `conversations.addMessage()` | < 20ms          | ✅   | Append-only                   |
| `immutable.store()`          | < 30ms          | ✅   | Auto (versioned)              |
| `mutable.set()`              | < 15ms          | ✅   | No (overwrites)               |
| `facts.store()`              | < 40ms          | ✅   | Auto (with belief revision)   |
| `users.update()`             | < 25ms          | ✅   | Auto (versioned)              |
| `sessions.create()`          | < 20ms          | ✅   | No versioning                 |

### Bulk Operations

| Operation                         | Typical Latency | Notes                    |
| --------------------------------- | --------------- | ------------------------ |
| `memory.deleteMany()` (100 items) | < 200ms         | Parallel deletes         |
| `facts.deleteMany()` (100 items)  | < 200ms         | Parallel deletes         |
| `users.deleteMany()` (50 items)   | < 150ms         | Parallel deletes         |
| GDPR cascade (1K records)         | < 3s            | All layers + factHistory |

---

## Next Steps

- **[Data Models](./02-data-models.md)** - Detailed schema definitions
- **[Convex Integration](./03-convex-integration.md)** - How we use Convex features
- **[Vector Embeddings](./04-vector-embeddings.md)** - Embedding strategy
- **[Performance](./08-performance.md)** - Optimization techniques

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
