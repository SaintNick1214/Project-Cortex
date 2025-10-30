# System Overview

> **Last Updated**: 2025-10-28

High-level architecture of Cortex and how it leverages Convex.

## Architecture at a Glance

Cortex is built on **Convex** - a reactive TypeScript database with built-in vector search. We organize storage into **three layers** plus **coordination entities**:

```
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: ACID Stores                      │
│                  (Convex Tables - Immutable Sources)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Conversations   │  │  Immutable      │  │  Mutable    │  │
│  │ (Table)         │  │  (Table)        │  │  (Table)    │  │
│  │                 │  │                 │  │             │  │
│  │ User↔Agent      │  │ KB Articles     │  │ Inventory   │  │
│  │ Agent↔Agent     │  │ Policies        │  │ Config      │  │
│  │                 │  │ Audit Logs      │  │ Counters    │  │
│  │                 │  │                 │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│  Append-only          Versioned             Current-value   │
│  Indexes: userId      Indexes: type, userId Indexes: userId │
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
│  ├── Vector Index: by_embedding (3072-dim)                  │
│  ├── Regular Indexes: by_agent, by_userId, by_importance    │
│  └── Search Index: by_content (full-text)                   │
│                                                             │
│  Agent-private memories with embeddings                     │
│  References Layer 1 stores via Ref fields                   │
│  Versioned with retention rules                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│       Layer 3: Memory API (TypeScript SDK)                  │
├─────────────────────────────────────────────────────────────┤
│  cortex.memory.remember() → Conversations + Vector          │
│  cortex.memory.get/search() → Vector + optional enrichment  │
│  TypeScript helpers over Convex functions                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Coordination Entities (Convex Tables)               │
├─────────────────────────────────────────────────────────────┤
│  users      - User profiles (GDPR cascade engine)           │
│  contexts   - Workflow coordination                         │
│  agents     - Agent registry (optional)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Convex-Native Architecture

**Everything is a Convex table:**

- Conversations → `conversations` table
- Vector memories → `memories` table with vector index
- User profiles → Stored in `immutable` table (type='user')
- Contexts → `contexts` table
- Immutable data → `immutable` table
- Mutable data → `mutable` table

**Benefits:**

- ✅ ACID transactions (Convex guarantees)
- ✅ Real-time reactivity (Convex subscriptions)
- ✅ TypeScript type safety (end-to-end)
- ✅ Built-in vector search (native Convex feature)
- ✅ Automatic indexing (optimized queries)

### 2. Layer Separation

**Layer 1: Source of Truth (Immutable)**

- Complete data preservation
- Append-only or versioned
- No retention limits (conversations)
- Compliance and audit

**Layer 2: Searchable Index (Optimized)**

- Fast vector search
- Retention rules (default: 10 versions)
- References Layer 1
- Performance optimized

**Layer 3: Developer Convenience (SDK)**

- Single API for both layers
- Automatic linking
- Reduced boilerplate
- Type-safe

### 3. References Over Duplication

Data is linked via IDs, not duplicated:

```typescript
// Vector memory (Layer 2)
{
  _id: "mem_abc123",
  memorySpaceId: "support-agent",
  content: "User password is Blue",
  conversationRef: {
    conversationId: "conv_xyz789",  // ← Points to Layer 1
    messageIds: ["msg_001"],
  }
}

// Conversation (Layer 1)
{
  _id: "conv_xyz789",
  messages: [
    {
      id: "msg_001",
      content: "My password is Blue",  // ← Original source
      ...
    }
  ]
}
```

**Benefits:**

- No data duplication
- Storage efficiency
- Consistency (single source of truth)
- Can always retrieve full context

### 4. Graph-Like Querying

**Implicit graph structure:**

- Entities are nodes (Agents, Users, Contexts, Conversations, Memories)
- References are edges (conversationRef, parentId, userId, agentId)
- Traversals via built-in APIs (Context Chains, A2A, conversationRef links)
- Performance: 1-5 hops in 50-200ms (Graph-Lite)
- Optional: Native graph DB for advanced queries (Graph-Premium)

**Learn more:** [Graph-Lite Traversal](../07-advanced-topics/01-graph-lite-traversal.md)

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

---

## Convex Tables

### Layer 1a: conversations

```typescript
conversations: defineTable({
  type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
  participants: v.any(), // UserAgentParticipants | AgentAgentParticipants
  messages: v.array(v.any()),
  messageCount: v.number(),
  metadata: v.any(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastMessageAt: v.optional(v.number()),
})
  .index("by_userId", ["participants.userId"])
  .index("by_agentId", ["participants.agentId"])
  .index("by_type", ["type"])
  .index("by_lastMessage", ["lastMessageAt"]);
```

**Purpose:** Immutable conversation threads (user-agent, agent-agent)  
**Size:** Can grow large (10K+ messages per conversation)  
**Retention:** Forever (no deletion unless GDPR or manual)

### Layer 1b: immutable

```typescript
immutable: defineTable({
  type: v.string(),
  id: v.string(),
  data: v.any(),
  userId: v.optional(v.string()),
  metadata: v.any(),
  version: v.number(),
  previousVersions: v.array(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_type_id", ["type", "id"])
  .index("by_userId", ["userId"])
  .index("by_type", ["type"])
  .index("by_version", ["type", "id", "version"]);
```

**Purpose:** Shared, versioned, immutable data (KB, policies, user profiles)  
**Size:** Medium (50-100KB per record)  
**Retention:** Configurable (default: 20 versions)

### Layer 1c: mutable

```typescript
mutable: defineTable({
  namespace: v.string(),
  key: v.string(),
  value: v.any(),
  userId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  accessCount: v.number(),
  lastAccessed: v.optional(v.number()),
})
  .index("by_namespace_key", ["namespace", "key"])
  .index("by_userId", ["userId"])
  .index("by_namespace", ["namespace"])
  .index("by_updated", ["updatedAt"]);
```

**Purpose:** Shared, mutable, current-value data (inventory, config, counters)  
**Size:** Small to medium  
**Retention:** No versioning (overwrites)

### Layer 2: memories

```typescript
memories: defineTable({
  memorySpaceId: v.string(),
  userId: v.optional(v.string()),
  content: v.string(),
  contentType: v.union(v.literal("raw"), v.literal("summarized")),
  embedding: v.optional(v.array(v.float64())),

  // Source
  source: v.object({
    type: v.union(
      v.literal("conversation"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("a2a"),
    ),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    fromAgent: v.optional(v.string()),
    toAgent: v.optional(v.string()),
    timestamp: v.number(),
  }),

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

  // Metadata
  metadata: v.any(),

  // Timestamps & versioning
  createdAt: v.number(),
  updatedAt: v.number(),
  lastAccessed: v.optional(v.number()),
  accessCount: v.number(),
  version: v.number(),
  previousVersions: v.array(v.any()),
})
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 3072, // Or configurable
    filterFields: ["agentId", "userId"],
  })
  .index("by_agent", ["agentId"])
  .index("by_userId", ["userId"])
  .index("by_agent_source", ["agentId", "source.type"])
  .index("by_importance", ["metadata.importance"])
  .searchIndex("by_content", {
    searchField: "content",
    filterFields: ["agentId", "userId"],
  });
```

**Purpose:** Searchable agent memories (vector + text search)  
**Size:** Small (< 10KB per memory)  
**Retention:** Versioned (default: 10 versions per memory)

### Coordination: users

```typescript
// Note: User profiles are stored in `immutable` table with type='user'
// No separate table needed - leverages Layer 1b infrastructure
```

### Coordination: contexts

```typescript
contexts: defineTable({
  purpose: v.string(),
  description: v.optional(v.string()),
  memorySpaceId: v.string(),
  userId: v.optional(v.string()),

  // Hierarchy
  parentId: v.optional(v.string()),
  rootId: v.string(),
  depth: v.number(),
  childIds: v.array(v.string()),
  participants: v.array(v.string()),

  // Links
  conversationRef: v.optional(
    v.object({
      conversationId: v.string(),
      messageIds: v.array(v.string()),
    }),
  ),

  // Data & status
  data: v.any(),
  status: v.union(
    v.literal("active"),
    v.literal("completed"),
    v.literal("cancelled"),
    v.literal("blocked"),
  ),

  // Timestamps & versioning
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  version: v.number(),
  previousVersions: v.array(v.any()),
})
  .index("by_agent", ["agentId"])
  .index("by_userId", ["userId"])
  .index("by_status", ["status"])
  .index("by_parentId", ["parentId"])
  .index("by_rootId", ["rootId"])
  .index("by_depth", ["depth"]);
```

**Purpose:** Workflow coordination and task hierarchies  
**Size:** Small  
**Retention:** Configurable (can delete completed workflows)

### Optional: agents

```typescript
agents: defineTable({
  memorySpaceId: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  capabilities: v.optional(v.array(v.string())),
  metadata: v.any(),
  config: v.any(),
  stats: v.any(),
  registeredAt: v.number(),
  updatedAt: v.number(),
}).index("by_agentId", ["agentId"]);
```

**Purpose:** Optional agent registry (enhanced features)  
**Size:** Small  
**Retention:** Until unregistered

---

## Data Flow

### Storing a Conversation Memory

```
User Message
     ↓
┌─────────────────────────────────┐
│ 1. cortex.memory.remember()     │ ← SDK Layer 3
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 2. Convex Mutation:             │
│    conversations.addMessage()   │ ← Layer 1a (ACID)
│    Returns: messageId           │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 3. Convex Mutation:             │
│    memories.insert()            │ ← Layer 2 (Vector)
│    With: conversationRef        │
└─────────────────────────────────┘
```

### Searching Memories

```
Search Query
     ↓
┌─────────────────────────────────┐
│ 1. cortex.memory.search()       │ ← SDK Layer 3
│    With: embedding              │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 2. Convex Query:                │
│    memories                     │ ← Layer 2
│    .withIndex("by_embedding")   │
│    .filter(agentId, userId)     │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ 3. Optional: Enrich with ACID   │
│    conversations.get()          │ ← Layer 1a
│    Via conversationRef          │
└─────────────────────────────────┘
```

### GDPR Cascade Deletion (Cloud Mode)

```
cortex.users.delete(userId, { cascade: true })
     ↓
┌─────────────────────────────────┐
│ Cloud Mode Service:             │
│ Orchestrates deletions          │
└────────────┬────────────────────┘
             ↓
     ┌───────┴────────┬────────────┬─────────────┐
     ↓                ↓            ↓             ↓
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Layer 1a │  │ Layer 1b │  │ Layer 1c │  │ Layer 2  │
│ convos   │  │ immut.   │  │ mutable  │  │ memories │
│ .delete  │  │ .delete  │  │ .delete  │  │ .delete  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
    All records with userId='user-123' deleted
```

---

## Convex Features We Use

### Vector Search (Native)

```typescript
// Convex provides native vector search
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 3072,  // Configurable (1536, 3072, etc.)
  filterFields: ["agentId", "userId"],  // Fast pre-filtering
});

// Query with vector similarity
const results = await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q.similar("embedding", queryVector, 10)
     .eq("agentId", agentId)
  )
  .collect();
```

**Our usage:**

- Semantic memory search
- Similarity scoring
- Agent-specific filtering
- User-specific filtering

### Full-Text Search (Native)

```typescript
// Convex provides keyword search
.searchIndex("by_content", {
  searchField: "content",
  filterFields: ["agentId"],
});

// Query with keywords
const results = await ctx.db
  .query("memories")
  .withSearchIndex("by_content", (q) =>
    q.search("content", keywords)
     .eq("agentId", agentId)
  )
  .collect();
```

**Our usage:**

- Keyword search (no embedding needed)
- Fallback when embeddings unavailable
- Full-text conversation search

### Regular Indexes (Native)

```typescript
// Efficient queries on indexed fields
.index("by_agent", ["agentId"])
.index("by_userId", ["userId"])
.index("by_agent_userId", ["agentId", "userId"])  // Compound
.index("by_importance", ["metadata.importance"]);  // Nested field

// Fast equality queries
const memories = await ctx.db
  .query("memories")
  .withIndex("by_agent_userId", (q) =>
    q.eq("agentId", agentId).eq("userId", userId)
  )
  .collect();
```

**Our usage:**

- Agent isolation
- User filtering
- Importance-based queries
- Date range queries

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

## Scalability

### Storage Capacity

**Convex limits (as of 2024):**

- Database size: Unlimited (pay-per-GB)
- Document size: 1 MB per document
- Vector dimensions: Flexible (1536, 3072, etc.)
- Index count: Up to 32 indexes per table

**Cortex design:**

- Memories: < 10KB each (fits easily)
- Conversations: Paginated (load in chunks)
- Vectors: 3072-dim × 8 bytes = ~24KB max
- All well within limits ✅

### Query Performance

**Convex guarantees:**

- Index queries: O(log n) + result size
- Vector search: Sub-100ms for millions of vectors
- Reactive updates: Real-time (< 100ms)

**Cortex optimizations:**

- Compound indexes for common queries
- Vector filtering before similarity search
- Pagination for large result sets
- Agent isolation reduces query scope

### Concurrent Operations

**Convex handles:**

- ACID transactions (automatic)
- Optimistic concurrency control
- Conflict-free concurrent queries
- No manual locking needed

**Cortex benefits:**

- Multiple agents writing concurrently ✅
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

### Why Three Layers?

1. **Layer 1 (ACID)** - Complete data preservation, compliance, audit trail
2. **Layer 2 (Vector)** - Fast search, optimized retrieval, retention rules
3. **Layer 3 (SDK)** - Developer convenience, reduced code

**Benefit:** Aggressive retention on Vector (save costs) without losing ACID audit trail.

### Why userId Everywhere?

1. **GDPR compliance** - Single field enables cascade deletion
2. **User isolation** - Filter by user across all stores
3. **Multi-tenant** - Tenant ID = userId pattern
4. **Privacy** - User-specific data clearly marked

---

## Performance Characteristics

### Read Operations

| Operation                    | Typical Latency | Indexed            | Scalability               |
| ---------------------------- | --------------- | ------------------ | ------------------------- |
| `memory.get()`               | < 10ms          | Yes (by ID)        | Millions of memories      |
| `memory.search()` (semantic) | < 100ms         | Yes (vector)       | Millions of vectors       |
| `memory.search()` (keyword)  | < 50ms          | Yes (search index) | Millions of memories      |
| `conversations.get()`        | < 20ms          | Yes (by ID)        | Millions of conversations |
| `users.get()`                | < 10ms          | Yes (by type+id)   | Millions of users         |
| `contexts.get()`             | < 10ms          | Yes (by ID)        | Millions of contexts      |

### Write Operations

| Operation                    | Typical Latency | ACID | Versioning                |
| ---------------------------- | --------------- | ---- | ------------------------- |
| `memory.remember()`          | < 50ms          | ✅   | Auto (creates 2 versions) |
| `conversations.addMessage()` | < 20ms          | ✅   | Append-only               |
| `immutable.store()`          | < 30ms          | ✅   | Auto (versioned)          |
| `mutable.set()`              | < 15ms          | ✅   | No (overwrites)           |
| `users.update()`             | < 25ms          | ✅   | Auto (versioned)          |

### Bulk Operations

| Operation                         | Typical Latency | Notes                   |
| --------------------------------- | --------------- | ----------------------- |
| `memory.deleteMany()` (100 items) | < 200ms         | Parallel deletes        |
| `users.deleteMany()` (50 items)   | < 150ms         | Parallel deletes        |
| GDPR cascade (1K records)         | < 2s            | Cloud Mode orchestrated |

---

## Next Steps

- **[Data Models](./02-data-models.md)** - Detailed schema definitions
- **[Convex Integration](./03-convex-integration.md)** - How we use Convex features
- **[Vector Embeddings](./04-vector-embeddings.md)** - Embedding strategy
- **[Performance](./08-performance.md)** - Optimization techniques

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
