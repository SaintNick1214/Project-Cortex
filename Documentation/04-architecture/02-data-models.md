# Data Models

> **Last Updated**: 2025-10-28

Detailed Convex schema definitions, indexes, and data structures for all Cortex tables.

## Overview

Cortex uses **seven Convex tables** to implement the 4-layer architecture plus coordination entities:

| Table           | Layer | Purpose                       | Versioned   | Retention                  |
| --------------- | ----- | ----------------------------- | ----------- | -------------------------- |
| `conversations` | 1a    | ACID message threads          | Append-only | Forever                    |
| `immutable`     | 1b    | Shared versioned data         | Auto        | Configurable (20 versions) |
| `mutable`       | 1c    | Shared live data              | No          | N/A (overwrites)           |
| `memories`      | 2     | Vector index                  | Auto        | Configurable (10 versions) |
| `facts`         | 3     | Structured knowledge          | Auto        | Configurable (10 versions) |
| `contexts`      | -     | Workflow coordination         | Auto        | Configurable               |
| `agents`        | -     | Agent registry (optional)     | No          | Until unregistered         |
| **Layer 4**: Graph database (optional Neo4j/Memgraph integration)                                        |

---

## Complete Schema Definition

### convex/schema.ts

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Layer 1a: ACID Conversations
  conversations: defineTable({
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.any(),
    messages: v.array(v.any()),
    messageCount: v.number(),
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_userId", ["participants.userId"])
    .index("by_agentId", ["participants.agentId"])
    .index("by_agent_user", ["participants.agentId", "participants.userId"])
    .index("by_type", ["type"])
    .index("by_lastMessage", ["lastMessageAt"])
    .searchIndex("by_messages", {
      searchField: "messages",
      filterFields: ["participants.userId", "participants.agentId"],
    }),

  // Layer 1b: Immutable Store
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
    .index("by_type_userId", ["type", "userId"])
    .index("by_version", ["type", "id", "version"])
    .searchIndex("by_data", {
      searchField: "data",
      filterFields: ["type", "userId"],
    }),

  // Layer 1c: Mutable Store
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
    .index("by_namespace_userId", ["namespace", "userId"])
    .index("by_updated", ["updatedAt"])
    .index("by_accessed", ["lastAccessed"]),

  // Layer 2: Vector Memories
  memories: defineTable({
    memorySpaceId: v.string(),
    userId: v.optional(v.string()),
    content: v.string(),
    contentType: v.union(v.literal("raw"), v.literal("summarized")),
    embedding: v.optional(v.array(v.float64())),

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

    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastAccessed: v.optional(v.number()),
    accessCount: v.number(),
    version: v.number(),
    previousVersions: v.array(v.any()),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072, // Configurable: 1536, 3072, etc.
      filterFields: ["agentId", "userId"],
    })
    .index("by_agent", ["agentId"])
    .index("by_userId", ["userId"])
    .index("by_agent_userId", ["agentId", "userId"])
    .index("by_source_type", ["source.type"])
    .index("by_agent_source", ["agentId", "source.type"])
    .index("by_conversationRef", ["conversationRef.conversationId"])
    .searchIndex("by_content", {
      searchField: "content",
      filterFields: ["agentId", "userId"],
    }),

  // Coordination: Contexts
  contexts: defineTable({
    purpose: v.string(),
    description: v.optional(v.string()),
    memorySpaceId: v.string(),
    userId: v.optional(v.string()),

    parentId: v.optional(v.string()),
    rootId: v.string(),
    depth: v.number(),
    childIds: v.array(v.string()),
    participants: v.array(v.string()),

    conversationRef: v.optional(
      v.object({
        conversationId: v.string(),
        messageIds: v.array(v.string()),
      }),
    ),

    data: v.any(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("blocked"),
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    version: v.number(),
    previousVersions: v.array(v.any()),
  })
    .index("by_agent", ["agentId"])
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_agent_status", ["agentId", "status"])
    .index("by_parentId", ["parentId"])
    .index("by_rootId", ["rootId"])
    .index("by_depth", ["depth"])
    .index("by_conversationRef", ["conversationRef.conversationId"])
    .searchIndex("by_purpose", {
      searchField: "purpose",
      filterFields: ["agentId", "status"],
    }),

  // Optional: Agent Registry
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
  }).index("by_agentId", ["agentId"]),
});
```

---

## Table Details

### conversations (Layer 1a)

**Purpose:** Immutable conversation threads

**Document Structure:**

```typescript
{
  _id: Id<"conversations">,
  type: "user-agent" | "agent-agent",

  // User-agent participants
  participants: {
    userId: string;
    memorySpaceId: string;
  } | {
    // Agent-agent participants
    agent1: string;
    agent2: string;
  },

  messages: Array<{
    id: string;  // Unique message ID

    // User-agent message
    role?: "user" | "agent" | "system";
    content?: string;
    userId?: string;
    agentId?: string;

    // Agent-agent message
    type?: "a2a";
    from?: string;
    to?: string;
    text?: string;

    timestamp: number;
    metadata?: any;
  }>,

  messageCount: number,
  metadata: any,

  createdAt: number,
  updatedAt: number,
  lastMessageAt?: number,
}
```

**Indexes:**

- `by_userId` - Find all conversations for a user (GDPR)
- `by_agentId` - Find all conversations for an agent
- `by_agent_user` - Find specific user-agent conversation
- `by_type` - Separate user-agent from agent-agent
- `by_lastMessage` - Sort by recent activity
- `by_messages` (search) - Full-text search in messages

**Query Patterns:**

```typescript
// Find user's conversations
await ctx.db
  .query("conversations")
  .withIndex("by_userId", (q) => q.eq("participants.userId", userId))
  .collect();

// Find conversation between user and agent
await ctx.db
  .query("conversations")
  .withIndex("by_agent_user", (q) =>
    q.eq("participants.agentId", agentId).eq("participants.userId", userId),
  )
  .first();

// Search messages
await ctx.db
  .query("conversations")
  .withSearchIndex("by_messages", (q) =>
    q.search("messages", "refund").eq("participants.userId", userId),
  )
  .collect();
```

---

### immutable (Layer 1b)

**Purpose:** Shared, versioned, immutable data

**Document Structure:**

```typescript
{
  _id: Id<"immutable">,
  type: string,  // 'kb-article', 'policy', 'user', 'feedback', etc.
  id: string,    // Logical ID (versioned together)

  data: any,     // Flexible payload
  userId?: string,  // Optional user link (GDPR)

  metadata?: {
    publishedBy?: string;
    tags?: string[];
    importance?: number;
    [key: string]: any;
  },

  version: number,
  previousVersions: Array<{
    version: number;
    data: any;
    userId?: string;
    metadata: any;
    timestamp: number;
  }>,

  createdAt: number,
  updatedAt: number,
}
```

**Indexes:**

- `by_type_id` - Primary lookup (unique per type+id)
- `by_userId` - Find all records for user (GDPR)
- `by_type` - List all of a type
- `by_type_userId` - User's records of specific type
- `by_version` - Get specific version
- `by_data` (search) - Full-text search in data payload

**Special Case: type='user' (ONLY Special Type)**

The **ONLY special type** is `'user'` - it's accessed via `cortex.users.*` wrapper which provides GDPR cascade deletion:

```typescript
// User profile (SPECIAL - has cortex.users.* wrapper)
{
  type: "user",  // ← ONLY special type
  id: "user-123",
  data: {
    displayName: "Alex Johnson",
    email: "alex@example.com",
    preferences: { theme: "dark" },
  },
  version: 5,
  previousVersions: [ /* ... */ ],
}

// Accessed via:
await cortex.users.get('user-123');  // ← Wrapper API
// Equivalent to:
await cortex.immutable.get('user', 'user-123');  // ← Direct API
```

**All Other Types (Developer-Defined Examples):**

Every other type is just an example - you define whatever types you need:

```typescript
// Example: KB article (no special treatment)
{
  type: "kb-article",  // ← Just an example, not special
  id: "refund-policy",
  data: { title: "Refund Policy", content: "..." },
  metadata: { importance: 90, tags: ["policy"] },
  version: 3,
}

// Example: Feedback (no special treatment)
{
  type: "user-feedback",  // ← Your custom type
  id: "feedback-456",
  data: { rating: 5, comment: "Great!" },
  userId: "user-123",  // ← GDPR-enabled
  version: 1,
}

// Example: Whatever you want (no special treatment)
{
  type: "my-custom-type",  // ← Anything you want
  id: "my-id",
  data: { /* your structure */ },
}
```

**Key Point:** Only `type='user'` gets special API treatment (`cortex.users.*` wrapper). All other types are accessed via `cortex.immutable.*` directly.

**Query Patterns:**

```typescript
// Get current version
await ctx.db
  .query("immutable")
  .withIndex("by_type_id", (q) =>
    q.eq("type", "kb-article").eq("id", "refund-policy"),
  )
  .first();

// Get all user profiles
await ctx.db
  .query("immutable")
  .withIndex("by_type", (q) => q.eq("type", "user"))
  .collect();

// GDPR: Get all records for user
await ctx.db
  .query("immutable")
  .withIndex("by_userId", (q) => q.eq("userId", "user-123"))
  .collect();
```

---

### mutable (Layer 1c)

**Purpose:** Shared, mutable, current-value data

**Document Structure:**

```typescript
{
  _id: Id<"mutable">,
  namespace: string,  // 'inventory', 'config', 'counters', etc.
  key: string,        // Unique within namespace
  value: any,         // Any JSON-serializable value
  userId?: string,    // Optional user link (GDPR)

  createdAt: number,
  updatedAt: number,
  accessCount: number,
  lastAccessed?: number,
}
```

**Indexes:**

- `by_namespace_key` - Primary lookup (unique per namespace+key)
- `by_userId` - Find all records for user (GDPR)
- `by_namespace` - List all in namespace
- `by_namespace_userId` - User's records in namespace
- `by_updated` - Sort by update time
- `by_accessed` - Find inactive records

**Examples:**

```typescript
// Inventory
{
  namespace: "inventory",
  key: "store-15:produce:apples",
  value: {
    quantity: 150,
    price: 2.99,
    unit: "lbs",
  },
  userId: undefined,  // System data
  updatedAt: 1729900000000,
}

// User session
{
  namespace: "user-sessions",
  key: "session-abc123",
  value: {
    startedAt: 1729900000000,
    pagesViewed: 5,
  },
  userId: "user-123",  // ← GDPR-enabled
  updatedAt: 1729900500000,
}
```

**Query Patterns:**

```typescript
// Get by namespace + key
await ctx.db
  .query("mutable")
  .withIndex("by_namespace_key", (q) =>
    q.eq("namespace", "inventory").eq("key", "widget-qty"),
  )
  .unique();

// List all in namespace
await ctx.db
  .query("mutable")
  .withIndex("by_namespace", (q) => q.eq("namespace", "inventory"))
  .collect();

// Prefix query (hierarchical keys)
const all = await ctx.db
  .query("mutable")
  .withIndex("by_namespace", (q) => q.eq("namespace", "inventory"))
  .collect();

const storeItems = all.filter((r) => r.key.startsWith("store-15:"));
```

---

### memories (Layer 2)

**Purpose:** Searchable agent memories with vector embeddings

**Document Structure:**

```typescript
{
  _id: Id<"memories">,
  memorySpaceId: string,
  userId?: string,

  content: string,
  contentType: "raw" | "summarized",
  embedding?: number[],  // 3072-dim vector (or configured)

  source: {
    type: "conversation" | "system" | "tool" | "a2a",
    userId?: string,
    userName?: string,
    fromAgent?: string,  // For A2A
    toAgent?: string,    // For A2A
    timestamp: number,
  },

  // Layer 1 References (mutually exclusive)
  conversationRef?: {
    conversationId: string,
    messageIds: string[],
  },
  immutableRef?: {
    type: string,
    id: string,
    version?: number,
  },
  mutableRef?: {
    namespace: string,
    key: string,
    snapshotValue: any,
    snapshotAt: number,
  },

  metadata: {
    importance: number,  // Enforced 0-100 at SDK level
    tags: string[],
    direction?: "inbound" | "outbound",  // For A2A
    messageId?: string,
    contextId?: string,
    [key: string]: any,  // Custom fields
  },

  createdAt: number,
  updatedAt: number,
  lastAccessed?: number,
  accessCount: number,

  version: number,
  previousVersions: Array<{
    version: number,
    content: string,
    contentType: "raw" | "summarized",
    embedding?: number[],
    conversationRef?: { conversationId: string, messageIds: string[] },
    metadata: any,
    timestamp: number,
    updatedBy?: string,
  }>,
}
```

**Indexes:**

- `by_embedding` (vector) - Semantic similarity search
- `by_agent` - Agent isolation (primary query)
- `by_userId` - User filtering
- `by_agent_userId` - Compound (most common)
- `by_source_type` - Filter by source
- `by_agent_source` - Agent + source compound
- `by_conversationRef` - Find memories from conversation
- `by_content` (search) - Full-text keyword search

**Query Patterns:**

```typescript
// Semantic search (agent-specific)
await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q.similar("embedding", queryVector, 10).eq("agentId", agentId),
  )
  .collect();

// Semantic search (user-specific)
await ctx.db
  .query("memories")
  .withIndex(
    "by_embedding",
    (q) =>
      q
        .similar("embedding", queryVector, 10)
        .eq("agentId", agentId)
        .eq("userId", userId), // ← Pre-filter before similarity
  )
  .collect();

// Keyword search
await ctx.db
  .query("memories")
  .withSearchIndex("by_content", (q) =>
    q.search("content", "password").eq("agentId", agentId),
  )
  .collect();

// Get by ID (direct lookup)
await ctx.db.get(memoryId);

// Filter by source type (A2A messages)
await ctx.db
  .query("memories")
  .withIndex("by_agent_source", (q) =>
    q.eq("agentId", agentId).eq("source.type", "a2a"),
  )
  .collect();
```

---

### contexts

**Purpose:** Workflow and task coordination

**Document Structure:**

```typescript
{
  _id: Id<"contexts">,
  purpose: string,
  description?: string,
  memorySpaceId: string,
  userId?: string,

  // Hierarchy
  parentId?: string,
  rootId: string,  // Self if root
  depth: number,   // 0 = root
  childIds: string[],
  participants: string[],  // All agents involved

  conversationRef?: {
    conversationId: string,
    messageIds: string[],
  },

  data: any,  // Context-specific data
  status: "active" | "completed" | "cancelled" | "blocked",

  createdAt: number,
  updatedAt: number,
  completedAt?: number,

  version: number,
  previousVersions: Array<{
    version: number,
    status: string,
    data: any,
    timestamp: number,
    updatedBy: string,
  }>,
}
```

**Indexes:**

- `by_agent` - Find contexts for agent
- `by_userId` - Find contexts for user
- `by_status` - Find active/completed workflows
- `by_agent_status` - Agent's active workflows
- `by_parentId` - Get children
- `by_rootId` - Get all in workflow
- `by_depth` - Get by hierarchy level
- `by_conversationRef` - Find workflows from conversation
- `by_purpose` (search) - Search workflow purposes

**Query Patterns:**

```typescript
// Get active contexts for agent
await ctx.db
  .query("contexts")
  .withIndex("by_agent_status", (q) =>
    q.eq("agentId", agentId).eq("status", "active"),
  )
  .collect();

// Get all children
await ctx.db
  .query("contexts")
  .withIndex("by_parentId", (q) => q.eq("parentId", parentId))
  .collect();

// Get all in workflow
await ctx.db
  .query("contexts")
  .withIndex("by_rootId", (q) => q.eq("rootId", rootId))
  .collect();

// Search by purpose
await ctx.db
  .query("contexts")
  .withSearchIndex("by_purpose", (q) =>
    q.search("purpose", "refund").eq("status", "active"),
  )
  .collect();
```

---

### agents (Optional)

**Purpose:** Agent registry for enhanced features

**Document Structure:**

```typescript
{
  _id: Id<"agents">,
  memorySpaceId: string,  // Unique agent identifier
  name: string,
  description?: string,
  capabilities?: string[],

  metadata: {
    owner?: string,
    team?: string,
    [key: string]: any,
  },

  config: {
    memoryVersionRetention?: number,
    embeddingDimensions?: number,
    [key: string]: any,
  },

  stats: {
    totalMemories: number,
    totalConversations: number,
    lastActive?: number,
  },

  registeredAt: number,
  updatedAt: number,
}
```

**Indexes:**

- `by_agentId` - Unique lookup

**Query Patterns:**

```typescript
// Get agent
await ctx.db
  .query("agents")
  .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
  .unique();

// List all agents
await ctx.db.query("agents").collect();
```

---

## Data Relationships

### conversationRef (Vector → ACID Conversation)

```typescript
// Vector memory
{
  _id: "mem_abc",
  content: "User password is Blue",
  conversationRef: {
    conversationId: "conv_xyz",  // ← Points to conversation
    messageIds: ["msg_001"],
  }
}

// ACID conversation
{
  _id: "conv_xyz",
  messages: [
    {
      id: "msg_001",  // ← Referenced by memory
      content: "My password is Blue",
    }
  ]
}

// Relationship: memories → conversations (many-to-one)
```

### immutableRef (Vector → Immutable Record)

```typescript
// Vector memory
{
  _id: "mem_def",
  content: "Refund policy allows 30 days",
  immutableRef: {
    type: "kb-article",
    id: "refund-policy",
    version: 2,  // ← Specific version
  }
}

// Immutable record
{
  _id: "imm_ghi",
  type: "kb-article",
  id: "refund-policy",
  version: 2,
  data: {
    title: "Refund Policy",
    content: "...",
  }
}

// Relationship: memories → immutable (many-to-one)
```

### mutableRef (Vector → Mutable Snapshot)

```typescript
// Vector memory
{
  _id: "mem_jkl",
  content: "API endpoint changed to v2",
  mutableRef: {
    namespace: "config",
    key: "api-endpoint",
    snapshotValue: "https://api.example.com/v2",  // ← Value at time
    snapshotAt: 1729900000000,
  }
}

// Mutable record (current value might have changed!)
{
  _id: "mut_mno",
  namespace: "config",
  key: "api-endpoint",
  value: "https://api.example.com/v3",  // ← Current (different!)
  updatedAt: 1729950000000,
}

// Relationship: memories → mutable (snapshot, not live)
```

### contextId (Memory → Context)

```typescript
// Memory metadata
{
  _id: "mem_pqr",
  memorySpaceId: "finance-agent",
  metadata: {
    contextId: "ctx_stu",  // ← Links to workflow
  }
}

// Context
{
  _id: "ctx_stu",
  purpose: "Approve budget increase",
  memorySpaceId: "supervisor-agent",
}

// Relationship: memories ← contexts (one-to-many)
// Note: Stored in metadata, not separate field
```

---

## Storage Estimates

### Size Per Document

| Table           | Typical Size | Max Size | Notes               |
| --------------- | ------------ | -------- | ------------------- |
| `conversations` | 5-50KB       | 1MB      | Grows with messages |
| `immutable`     | 1-10KB       | 100KB    | Data payload size   |
| `mutable`       | 100B-5KB     | 1MB      | Usually small       |
| `memories`      | 2-8KB        | 50KB     | Includes embedding  |
| `contexts`      | 500B-2KB     | 10KB     | Usually small       |
| `agents`        | 500B         | 5KB      | Metadata only       |

**Embedding sizes:**

- 1536-dim × 8 bytes = 12KB
- 3072-dim × 8 bytes = 24KB
- 768-dim × 8 bytes = 6KB

### Growth Estimates

**Small deployment (1K users, 10 agents):**

- Conversations: 5K conversations × 10KB = 50MB
- Memories: 50K memories × 5KB = 250MB
- Immutable: 100 records × 5KB = 500KB
- Mutable: 1K records × 1KB = 1MB
- **Total:** ~300MB

**Medium deployment (100K users, 50 agents):**

- Conversations: 500K × 10KB = 5GB
- Memories: 5M × 5KB = 25GB
- Immutable: 10K × 5KB = 50MB
- Mutable: 100K × 1KB = 100MB
- **Total:** ~30GB

**Large deployment (1M users, 200 agents):**

- Conversations: 5M × 10KB = 50GB
- Memories: 50M × 5KB = 250GB
- Immutable: 100K × 5KB = 500MB
- Mutable: 1M × 1KB = 1GB
- **Total:** ~300GB

**Convex pricing (estimate):**

- Storage: $0.50/GB/month
- Bandwidth: $0.10/GB
- Medium deployment: ~$15-30/month storage
- Large deployment: ~$150-300/month storage

---

## Index Strategy

### Compound Indexes for Common Queries

```typescript
// Single field (basic)
.index("by_agent", ["agentId"])

// Compound (optimized)
.index("by_agent_userId", ["agentId", "userId"])
.index("by_agent_source", ["agentId", "source.type"])

// Why: Pre-filter before expensive operations
// Example: Get user's memories for an agent
await ctx.db
  .query("memories")
  .withIndex("by_agent_userId", (q) =>
    q.eq("agentId", agentId).eq("userId", userId)
  )
  .collect();
// Uses compound index ✅ (fast)

// vs
await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .filter((q) => q.eq(q.field("userId"), userId))
  .collect();
// Filters after index ⚠️ (slower)
```

### Vector Index with Filters

```typescript
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 3072,
  filterFields: ["agentId", "userId"],  // ← Fast pre-filtering
});

// Query with pre-filter (fast)
await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q.similar("embedding", vector, 10)
     .eq("agentId", agentId)          // ← Filtered BEFORE similarity
     .eq("userId", userId)            // ← Filtered BEFORE similarity
  )
  .collect();
// Only searches vectors for this agent+user ✅
```

### Search Indexes for Keywords

```typescript
.searchIndex("by_content", {
  searchField: "content",
  filterFields: ["agentId", "userId"],
});

// Keyword search with filters
await ctx.db
  .query("memories")
  .withSearchIndex("by_content", (q) =>
    q.search("content", "password")
     .eq("agentId", agentId)
  )
  .collect();
```

---

## Versioning Strategy

### Automatic Version Arrays

All versioned entities store history in `previousVersions` array:

```typescript
{
  version: 3,  // Current
  previousVersions: [
    { version: 1, ..., timestamp: T0 },
    { version: 2, ..., timestamp: T1 },
  ],  // Subject to retention
}
```

**Retention rules:**

- Memories: Keep last 10 versions (configurable)
- Immutable: Keep last 20 versions (configurable by type)
- Contexts: Keep last 5 versions (configurable)
- Users: Keep all versions (no limit)

**Cleanup:** Governance policies automatically trim old versions.

### Version Lookup

```typescript
// Get current version
const record = await ctx.db.get(recordId);

// Get specific version
const v2 = record.previousVersions.find((v) => v.version === 2);

// Get all versions
const allVersions = [
  ...record.previousVersions,
  {
    version: record.version,
    data: record.data,
    timestamp: record.updatedAt,
  },
];
```

---

## GDPR Compliance Schema

### userId Propagation

All tables support optional `userId` field:

```typescript
// Conversations
{
  participants: { userId: "user-123", memorySpaceId: "agent-1" }
  // ↑ Queryable via index
}

// Immutable
{
  userId: "user-123",  // ← Direct field
  // ↑ Indexed for fast queries
}

// Mutable
{
  userId: "user-123",  // ← Direct field
  // ↑ Indexed for cascade deletion
}

// Memories
{
  userId: "user-123",  // ← Direct field
  // ↑ Indexed with agentId compound
}
```

### Cascade Deletion Query Plan (Cloud Mode)

```typescript
// 1. Find all conversations
const convos = await ctx.db
  .query("conversations")
  .withIndex("by_userId", (q) => q.eq("participants.userId", userId))
  .collect();

// 2. Find all immutable records
const immutable = await ctx.db
  .query("immutable")
  .withIndex("by_userId", (q) => q.eq("userId", userId))
  .collect();

// 3. Find all mutable records
const mutable = await ctx.db
  .query("mutable")
  .withIndex("by_userId", (q) => q.eq("userId", userId))
  .collect();

// 4. Find all memories (across all agents)
const memories = await ctx.db
  .query("memories")
  .withIndex("by_userId", (q) => q.eq("userId", userId))
  .collect();

// 5. Delete all (in transaction)
for (const record of [...convos, ...immutable, ...mutable, ...memories]) {
  await ctx.db.delete(record._id);
}
```

**Performance:** With proper indexes, O(log n) per table + result size deletion.

---

## Flexible Fields with v.any()

### Why v.any() for metadata, data, value

**Convex allows flexible schemas:**

```typescript
metadata: v.any(),  // ← Any JSON-serializable value

// Can be:
metadata: { importance: 85, tags: ["test"] }
metadata: { customField: "value", nested: { deep: true } }
metadata: null
metadata: { anything: "you want" }
```

**TypeScript SDK enforces structure:**

```typescript
// SDK enforces MemoryMetadata structure
interface MemoryMetadata {
  importance: number; // REQUIRED at SDK level
  tags: string[]; // REQUIRED at SDK level
  [key: string]: any; // Custom fields allowed
}

// But Convex schema is flexible (allows evolution)
```

**Benefits:**

- Schema evolution without migrations
- Custom fields per use case
- TypeScript type safety at SDK level
- Database flexibility at storage level

---

## Query Optimization

### Use Appropriate Index

```typescript
// ❌ Slow: No index
const memories = await ctx.db
  .query("memories")
  .filter((q) => q.eq(q.field("agentId"), agentId))
  .collect();
// Scans entire table!

// ✅ Fast: With index
const memories = await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .collect();
// O(log n) lookup
```

### Compound Indexes for Multiple Filters

```typescript
// ❌ Inefficient: Filter after index
await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .filter((q) => q.eq(q.field("userId"), userId))
  .collect();

// ✅ Efficient: Compound index
await ctx.db
  .query("memories")
  .withIndex("by_agent_userId", (q) =>
    q.eq("agentId", agentId).eq("userId", userId),
  )
  .collect();
```

### Vector Search with Pre-Filtering

```typescript
// ✅ Fast: Filter before similarity
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 3072,
  filterFields: ["agentId", "userId"],  // ← Pre-filter
});

// Query only searches relevant subset
await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q.similar("embedding", vector, 10)
     .eq("agentId", agentId)  // ← Filters BEFORE similarity calculation
  )
  .collect();
```

---

## Next Steps

- **[Convex Integration](./03-convex-integration.md)** - How we use Convex features
- **[Vector Embeddings](./04-vector-embeddings.md)** - Embedding strategy and dimensions
- **[Search Strategy](./05-search-strategy.md)** - Multi-strategy search implementation
- **[Performance](./08-performance.md)** - Optimization techniques

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
