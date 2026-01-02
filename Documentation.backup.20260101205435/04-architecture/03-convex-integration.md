# Convex Integration

> **Last Updated**: 2026-01-01

How Cortex leverages Convex features for persistent memory, vector search, and real-time updates.

## Overview

Cortex is built **natively on Convex** - not as a wrapper, but as a first-class Convex application. We use Convex's features directly:

- **Queries** - Read operations (reactive, cacheable)
- **Mutations** - Write operations (ACID transactions)
- **Actions** - External calls (embeddings, pub/sub)
- **Vector Search** - Native semantic similarity
- **Search Indexes** - Full-text keyword search
- **Real-time** - Reactive query subscriptions
- **TypeScript** - End-to-end type safety

---

## Convex Function Types

### Queries (Read Operations)

Queries are reactive, cached, and deterministic:

```typescript
// convex/memories.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { memorySpaceId: v.string(), memoryId: v.id("memories") },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);

    // Verify memory space owns this memory
    if (!memory || memory.memorySpaceId !== args.memorySpaceId) {
      return null;
    }

    // Update access tracking (read-only in query, so we schedule mutation)
    await ctx.scheduler.runAfter(0, "memories:updateAccessCount", {
      memoryId: args.memoryId,
    });

    return memory;
  },
});

export const search = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    embedding: v.optional(v.array(v.float64())),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    let results;

    if (args.embedding) {
      // Semantic search
      results = await ctx.db
        .query("memories")
        .withIndex("by_embedding", (q) =>
          q
            .similar("embedding", args.embedding, args.filters.limit || 20)
            .eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
    } else {
      // Keyword search
      results = await ctx.db
        .query("memories")
        .withSearchIndex("by_content", (q) =>
          q
            .search("content", args.query)
            .eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
    }

    // Apply filters (importance, tags, dates, participantId, etc.)
    return applyFilters(results, args.filters);
  },
});
```

**Characteristics:**

- ✅ Read-only (cannot modify database)
- ✅ Reactive (auto-update on data changes)
- ✅ Cacheable (Convex caches results)
- ✅ Fast (optimized by Convex)

### Mutations (Write Operations)

Mutations modify data with ACID guarantees:

```typescript
// convex/memories.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {
    memorySpaceId: v.string(),
    content: v.string(),
    contentType: v.union(v.literal("raw"), v.literal("summarized")),
    embedding: v.optional(v.array(v.float64())),
    source: v.any(),
    conversationRef: v.optional(v.any()),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    // Insert into memories table
    const memoryId = await ctx.db.insert("memories", {
      ...args,
      version: 1,
      previousVersions: [],
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(memoryId);
  },
});

export const update = mutation({
  args: {
    memorySpaceId: v.string(),
    memoryId: v.id("memories"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);

    if (!memory || memory.agentId !== args.agentId) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Create new version (preserve old)
    const newVersion = memory.version + 1;
    const previousVersions = [
      ...memory.previousVersions,
      {
        version: memory.version,
        content: memory.content,
        metadata: memory.metadata,
        timestamp: memory.updatedAt,
      },
    ];

    // Apply retention (keep last 10 versions)
    const retention = 10;
    if (previousVersions.length > retention) {
      previousVersions.shift(); // Remove oldest
    }

    // Update document
    await ctx.db.patch(args.memoryId, {
      ...args.updates,
      version: newVersion,
      previousVersions,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.memoryId);
  },
});

export const updateAccessCount = mutation({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoryId, {
      accessCount: (await ctx.db.get(args.memoryId))!.accessCount + 1,
      lastAccessed: Date.now(),
    });
  },
});
```

**Characteristics:**

- ✅ Atomic (all-or-nothing)
- ✅ Consistent (sees latest data)
- ✅ Isolated (no race conditions)
- ✅ Durable (persisted immediately)

### Actions (External Calls)

Actions can call external APIs (embeddings, pub/sub):

```typescript
// convex/actions.ts
import { action } from "./_generated/server";
import { v } from "convex/values";

export const storeWithEmbedding = action({
  args: {
    memorySpaceId: v.string(),
    content: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    // 1. Call external embedding API
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: args.content,
      }),
    });

    const data = await response.json();
    const embedding = data.data[0].embedding;

    // 2. Store in database via mutation
    return await ctx.runMutation("memories:store", {
      ...args,
      embedding,
      contentType: "raw",
      source: { type: "system", timestamp: Date.now() },
    });
  },
});

export const publishA2ANotification = action({
  args: {
    memorySpaceId: v.string(),
    notification: v.any(),
  },
  handler: async (ctx, args) => {
    // Call external pub/sub (Redis, RabbitMQ, etc.)
    const redis = await connectRedis(process.env.REDIS_URL);

    await redis.publish(
      `agent:${args.agentId}:inbox`,
      JSON.stringify(args.notification),
    );

    await redis.quit();
  },
});
```

**Characteristics:**

- ✅ Can call external APIs
- ✅ Can call mutations/queries
- ✅ Non-deterministic allowed
- ✅ Used for embeddings, pub/sub, webhooks

---

## How Cortex Uses Each Type

### Queries (Read Path)

All read operations use Convex queries:

```typescript
// SDK call
const memory = await cortex.memory.get("agent-1", "mem_abc");

// Becomes Convex query
await client.query(api.memories.get, {
  memorySpaceId: "agent-1",
  memoryId: "mem_abc",
});

// Reactive in UI
const { data: memory } = useQuery(api.memories.get, {
  memorySpaceId: "agent-1",
  memoryId: "mem_abc",
});
// ↑ Auto-updates when memory changes!
```

**Cortex queries:**

- `memories.get` - Get single memory
- `memories.search` - Semantic or keyword search
- `memories.list` - Paginated listing
- `memories.count` - Count with filters
- `conversations.get` - Get conversation
- `conversations.getHistory` - Get message thread
- `immutable.get` - Get immutable record
- `mutable.get` - Get mutable value
- `contexts.get` - Get context
- `users.get` - Get user profile (via immutable)

### Mutations (Write Path)

All write operations use Convex mutations:

```typescript
// SDK call
await cortex.memory.store("agent-1", data);

// Becomes Convex mutation
await client.mutation(api.memories.store, {
  memorySpaceId: "agent-1",
  ...data,
});
```

**Cortex mutations:**

- `memories.store` - Create memory
- `memories.update` - Update memory (creates version)
- `memories.delete` - Delete memory
- `conversations.create` - Create conversation
- `conversations.addMessage` - Append message
- `immutable.store` - Store versioned record
- `mutable.set` - Set mutable value
- `mutable.update` - Atomic update
- `contexts.create` - Create context
- `contexts.update` - Update context status
- `users.update` - Update user profile (via immutable)

### Actions (External Integration)

Actions handle non-deterministic operations:

```typescript
// Direct Mode: Developer calls embedding API
const embedding = await openai.embeddings.create({ ... });
await cortex.memory.store('agent-1', { content, embedding });

// Cloud Mode: Cortex action calls embedding API
await cortex.memory.store('agent-1', {
  content,
  autoEmbed: true,  // ← Triggers action
});

// Convex action (Cloud Mode backend)
export const storeWithAutoEmbed = action({
  args: { memorySpaceId: v.string(), content: v.string(), ... },
  handler: async (ctx, args) => {
    // Call OpenAI
    const embedding = await generateEmbedding(args.content);

    // Store via mutation
    return await ctx.runMutation("memories:store", {
      ...args,
      embedding,
    });
  },
});
```

**Cortex actions:**

- `memories.storeWithAutoEmbed` - Cloud Mode auto-embeddings
- `a2a.publishNotification` - Pub/sub integration
- `users.cascadeDelete` - Cloud Mode GDPR cascade
- `governance.enforceRetention` - Cleanup jobs

---

## Vector Search Implementation

### Vector Index Definition

```typescript
// convex/schema.ts
memories: defineTable({
  memoryId: v.string(),
  memorySpaceId: v.string(),
  participantId: v.optional(v.string()),
  tenantId: v.optional(v.string()),
  content: v.string(),
  embedding: v.optional(v.array(v.float64())),
  // ...
}).vectorIndex("by_embedding", {
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

### Vector Search Query

```typescript
// convex/memories.ts
export const semanticSearch = query({
  args: {
    memorySpaceId: v.string(),
    embedding: v.array(v.float64()),
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("memories")
      .withIndex("by_embedding", (q) =>
        q
          .similar("embedding", args.embedding, args.limit)
          .eq("memorySpaceId", args.memorySpaceId),
      );

    // Optional filters (pre-filtered before similarity via filterFields)
    if (args.tenantId) {
      q = q.filter((q) => q.eq(q.field("tenantId"), args.tenantId));
    }

    if (args.userId) {
      q = q.filter((q) => q.eq(q.field("userId"), args.userId));
    }

    if (args.participantId) {
      q = q.filter((q) => q.eq(q.field("participantId"), args.participantId));
    }

    return await q.collect();
  },
});
```

**Convex vector search features:**

- Cosine similarity (built-in)
- Pre-filtering before similarity (filterFields)
- Multiple dimensions supported (1536, 3072, etc.)
- Sub-100ms for millions of vectors

---

## Full-Text Search Implementation

### Search Index Definition

```typescript
// convex/schema.ts
memories: defineTable({
  memorySpaceId: v.string(),
  tenantId: v.optional(v.string()),
  content: v.string(),
  sourceType: v.union(...),
  userId: v.optional(v.string()),
  agentId: v.optional(v.string()),
  participantId: v.optional(v.string()),
  // ...
}).searchIndex("by_content", {
  searchField: "content",
  filterFields: ["memorySpaceId", "tenantId", "sourceType", "userId", "agentId", "participantId"],
});
```

### Keyword Search Query

```typescript
// convex/memories.ts
export const keywordSearch = query({
  args: {
    memorySpaceId: v.string(),
    keywords: v.string(),
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("memories")
      .withSearchIndex("by_content", (q) => {
        let search = q
          .search("content", args.keywords)
          .eq("memorySpaceId", args.memorySpaceId);

        if (args.tenantId) {
          search = search.eq("tenantId", args.tenantId);
        }

        return search;
      })
      .take(args.limit);

    // Additional filtering
    if (args.userId) {
      results = results.filter((m) => m.userId === args.userId);
    }

    if (args.participantId) {
      results = results.filter((m) => m.participantId === args.participantId);
    }

    return results;
  },
});
```

**Convex search features:**

- Tokenization (automatic)
- Ranking by relevance
- Prefix matching
- Fast filtering before search

---

## ACID Transactions

### Single-Document Operations

```typescript
// Automatic transaction for single doc
export const addMessage = mutation({
  args: { conversationId: v.id("conversations"), message: v.any() },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);

    // Atomic update (read + modify + write)
    await ctx.db.patch(args.conversationId, {
      messages: [...conversation.messages, args.message],
      messageCount: conversation.messageCount + 1,
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
    });
  },
});
```

### Multi-Document Operations

```typescript
// All mutations are transactional
export const remember = mutation({
  args: { memorySpaceId: v.string(), conversationId: v.id("conversations"), userMessage: v.string(), agentResponse: v.string() },
  handler: async (ctx, args) => {
    // Step 1: Add to conversation (ACID)
    const userMsgId = await ctx.db.insert("messages", { ... });
    const agentMsgId = await ctx.db.insert("messages", { ... });

    // Step 2: Create vector memory (ACID)
    const memoryId = await ctx.db.insert("memories", {
      conversationRef: {
        conversationId: args.conversationId,
        messageIds: [userMsgId, agentMsgId],
      },
      ...
    });

    // If any step fails, ALL steps roll back ✅
    return { userMsgId, agentMsgId, memoryId };
  },
});
```

### Mutable Store Transactions

```typescript
// Optimistic locking for mutable updates
export const atomicUpdate = mutation({
  args: { namespace: v.string(), key: v.string(), updater: v.string() },
  handler: async (ctx, args) => {
    // Get current value
    const record = await ctx.db
      .query("mutable")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key),
      )
      .unique();

    // Apply update function
    const updaterFn = eval(args.updater); // Simplified
    const newValue = updaterFn(record.value);

    // Atomic update
    await ctx.db.patch(record._id, {
      value: newValue,
      updatedAt: Date.now(),
    });

    // No race conditions - Convex handles concurrency ✅
  },
});
```

**Convex ACID benefits:**

- All mutations are transactions
- No manual locking needed
- Optimistic concurrency control
- Isolation levels automatic

---

## Reactive Queries

### Client-Side Reactivity

```typescript
// React component
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function AgentMemoryList({ agentId }) {
  // Reactive query - auto-updates!
  const memories = useQuery(api.memories.list, {
    agentId,
    filters: { minImportance: 50 },
  });

  const storeMemory = useMutation(api.memories.store);

  return (
    <div>
      {memories?.map(m => (
        <div key={m._id}>{m.content}</div>
      ))}

      <button onClick={() => storeMemory({ agentId, content: "New memory" })}>
        Add Memory
      </button>
    </div>
  );
  // ↑ List auto-updates when mutation runs!
}
```

### Server-Side Subscriptions

```typescript
// Node.js server
import { ConvexClient } from "convex/browser";

const client = new ConvexClient(process.env.CONVEX_URL);

// Subscribe to query results
client.onUpdate(api.memories.list, { memorySpaceId: "agent-1" }, (memories) => {
  console.log(`Agent now has ${memories.length} memories`);
  // Called every time data changes!
});
```

**Cortex usage:**

- Real-time dashboards (Cloud Mode)
- Live collaboration features
- Agent activity monitoring

---

## Compound Operations (Layer 3)

### remember() - Multi-Layer Mutation

The `remember()` helper coordinates multiple mutations across all layers:

```typescript
// SDK call
await cortex.memory.remember({
  memorySpaceId: 'user-123-personal',
  participantId: 'my-assistant',  // NEW: Hive Mode tracking
  conversationId: 'conv-123',
  userMessage: 'Hello',
  agentResponse: 'Hi!',
  userId: 'user-123',
  userName: 'Alex',
  extractFacts: true,  // NEW: Auto-extract facts
});

// Becomes coordinated mutations
export const remember = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    // 1. Add user message to conversation (Layer 1a)
    const userMsgId = await ctx.runMutation("conversations:addMessage", {
      conversationId: args.conversationId,
      message: {
        id: generateId(),
        role: "user",
        content: args.userMessage,
        userId: args.userId,
        participantId: args.participantId,
        timestamp: Date.now(),
      },
    });

    // 2. Add agent message to conversation (Layer 1a)
    const agentMsgId = await ctx.runMutation("conversations:addMessage", {
      conversationId: args.conversationId,
      message: {
        id: generateId(),
        role: "agent",
        content: args.agentResponse,
        participantId: args.participantId,
        timestamp: Date.now(),
      },
    });

    // 3. Create vector memory (Layer 2)
    const memoryId = await ctx.db.insert("memories", {
      memoryId: generateId(),
      memorySpaceId: args.memorySpaceId,
      participantId: args.participantId,
      tenantId: args.tenantId,
      userId: args.userId,
      content: `${args.userName}: ${args.userMessage}\nAgent: ${args.agentResponse}`,
      contentType: "summarized",
      sourceType: "conversation",
      sourceUserId: args.userId,
      sourceUserName: args.userName,
      sourceTimestamp: Date.now(),
      messageRole: "user",
      conversationRef: {
        conversationId: args.conversationId,
        messageIds: [userMsgId, agentMsgId],  // ← Links to Layer 1a
      },
      importance: args.importance || 50,
      tags: args.tags || [],
      version: 1,
      previousVersions: [],
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 4. Extract and store facts (Layer 3) if configured
    let factIds = [];
    if (args.extractFacts && ctx.llm) {
      const facts = await extractFactsFromExchange(
        args.userMessage,
        args.agentResponse
      );

      for (const fact of facts) {
        const factId = await ctx.runMutation("facts:store", {
          ...fact,
          memorySpaceId: args.memorySpaceId,
          participantId: args.participantId,
          userId: args.userId,
          sourceRef: {
            conversationId: args.conversationId,
            messageIds: [userMsgId, agentMsgId],
          },
        });

        factIds.push(factId);
      }
    }

    // All steps are atomic (Convex transaction)
    return {
      conversation: { messageIds: [userMsgId, agentMsgId] },
      memories: [memoryId],
      facts: factIds,  // NEW: Facts extracted
    };
  },
});
```

**Transaction guarantee:** All inserts succeed or all fail (no partial state).  
**Orchestration:** Handles L1a + L2 + L3 in one call.

---

## Index Usage Patterns

### Memory Space Isolation

```typescript
// Compound index for space+user queries
.index("by_memorySpace_userId", ["memorySpaceId", "userId"])

// Efficient query
const memories = await ctx.db
  .query("memories")
  .withIndex("by_memorySpace_userId", (q) =>
    q.eq("memorySpaceId", memorySpaceId).eq("userId", userId)
  )
  .collect();
// Uses compound index ✅ O(log n)
```

### Multi-Tenancy

```typescript
// Tenant+space compound index
.index("by_tenant_space", ["tenantId", "memorySpaceId"])

// Tenant-isolated query
const memories = await ctx.db
  .query("memories")
  .withIndex("by_tenant_space", (q) =>
    q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId)
  )
  .collect();
```

### GDPR Cascade

```typescript
// userId index across all tables
.index("by_userId", ["userId"])

// Fast cascade query (across ALL memory spaces)
const allMemories = await ctx.db
  .query("memories")
  .withIndex("by_userId", (q) => q.eq("userId", "user-123"))
  .collect();

const allFacts = await ctx.db
  .query("facts")
  .withIndex("by_userId", (q) => q.eq("userId", "user-123"))
  .collect();

// Delete all (in transaction)
for (const record of [...allMemories, ...allFacts]) {
  await ctx.db.delete(record._id);
}
```

### Hierarchical Contexts (Cross-Space Support)

```typescript
// Multiple indexes for hierarchy navigation
.index("by_parentId", ["parentId"])
.index("by_rootId", ["rootId"])
.index("by_memorySpace", ["memorySpaceId"])
.index("by_memorySpace_status", ["memorySpaceId", "status"])

// Get all children (can be cross-space)
await ctx.db
  .query("contexts")
  .withIndex("by_parentId", (q) => q.eq("parentId", parentId))
  .collect();

// Get entire workflow
await ctx.db
  .query("contexts")
  .withIndex("by_rootId", (q) => q.eq("rootId", rootId))
  .collect();

// Get active contexts in memory space
await ctx.db
  .query("contexts")
  .withIndex("by_memorySpace_status", (q) =>
    q.eq("memorySpaceId", memorySpaceId).eq("status", "active")
  )
  .collect();
```

---

## Versioning Implementation

### Automatic Version Management

```typescript
export const update = mutation({
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);

    // Create version snapshot
    const snapshot = {
      version: current.version,
      content: current.content,
      metadata: current.metadata,
      timestamp: current.updatedAt,
    };

    // Add to history (with retention)
    const previousVersions = [...current.previousVersions, snapshot];

    // Apply retention limit
    const retention = args.retention || 10;
    while (previousVersions.length > retention) {
      previousVersions.shift(); // Remove oldest
    }

    // Update with new version
    await ctx.db.patch(args.id, {
      content: args.newContent,
      version: current.version + 1,
      previousVersions,
      updatedAt: Date.now(),
    });
  },
});
```

**Stored in same document** - no separate versions table needed.

---

## Real-Time Features

### Live Dashboard Example

```typescript
// React component with real-time updates
function AgentDashboard({ agentId }) {
  // Query auto-updates when data changes
  const stats = useQuery(api.agents.getStats, { agentId });
  const recentMemories = useQuery(api.memories.list, {
    agentId,
    limit: 10,
  });
  const activeContexts = useQuery(api.contexts.list, {
    agentId,
    status: "active",
  });

  return (
    <div>
      <h2>{stats?.name}</h2>
      <p>{stats?.totalMemories} memories</p>
      <p>{recentMemories?.length} recent</p>
      <p>{activeContexts?.length} active workflows</p>

      {/* All values update in real-time! */}
    </div>
  );
}
```

### Subscription-Based Triggers

```typescript
// Server-side agent runner
const client = new ConvexClient(process.env.CONVEX_URL);

// Watch for new A2A messages
client.onUpdate(
  api.memories.list,
  {
    memorySpaceId: "hr-agent",
    filters: {
      "source.type": "a2a",
      "metadata.direction": "inbound",
      "metadata.responded": false,
    },
  },
  async (pendingRequests) => {
    for (const request of pendingRequests) {
      // Process request
      const answer = await processRequest(request.content);

      // Respond
      await client.mutation(api.a2a.send, {
        from: "hr-agent",
        to: request.source.fromAgent,
        message: answer,
      });
    }
  },
);
```

---

## Performance Optimizations

### Pagination

```typescript
export const list = query({
  args: {
    memorySpaceId: v.string(),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc") // Most recent first
      .skip(args.offset)
      .take(args.limit)
      .collect();

    const total = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .count();

    return {
      memories,
      total,
      hasMore: args.offset + args.limit < total,
    };
  },
});
```

### Lazy Loading

```typescript
// Get conversation without messages initially
export const getConversationMeta = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);

    // Return metadata only (no messages)
    return {
      conversationId: conversation._id,
      type: conversation.type,
      participants: conversation.participants,
      messageCount: conversation.messageCount,
      lastMessageAt: conversation.lastMessageAt,
    };
  },
});

// Load messages separately when needed
export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.number(),
    offset: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);

    // Paginate messages
    return conversation.messages.slice(args.offset, args.offset + args.limit);
  },
});
```

### Filter Before Sort

```typescript
// ✅ Efficient: Use index, then filter, then sort
const memories = await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .filter((q) => q.gte(q.field("metadata.importance"), 70))
  .order("desc") // Sort by createdAt
  .take(20)
  .collect();

// ❌ Inefficient: Filter without index
const all = await ctx.db.query("memories").collect();
const filtered = all.filter(
  (m) => m.agentId === agentId && m.metadata.importance >= 70,
);
```

---

## TypeScript Type Safety

### Generated API Types

```typescript
// Convex generates types from schema
import { api } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";

// Type-safe function calls
const memory: Doc<"memories"> = await client.query(api.memories.get, {
  memorySpaceId: "agent-1",
  memoryId: "mem_abc" as Id<"memories">,
});

// Type errors caught at compile-time
await client.query(api.memories.get, {
  memorySpaceId: 123, // ❌ TypeScript error: number not assignable to string
  memoryId: "mem_abc",
});
```

### SDK Type Wrappers

```typescript
// Cortex SDK wraps Convex types
import { MemoryEntry } from "@cortex-platform/sdk";

// Convex Doc<"memories"> → Cortex MemoryEntry
class CortexSDK {
  async get(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<MemoryEntry | null> {
    const doc = await this.client.query(api.memories.get, {
      agentId,
      memoryId: memoryId as Id<"memories">,
    });

    // Transform Convex doc to SDK type
    return doc ? this.toMemoryEntry(doc) : null;
  }

  private toMemoryEntry(doc: Doc<"memories">): MemoryEntry {
    return {
      id: doc._id,
      memorySpaceId: doc.agentId,
      userId: doc.userId,
      content: doc.content,
      contentType: doc.contentType,
      embedding: doc.embedding,
      source: doc.source,
      conversationRef: doc.conversationRef,
      metadata: doc.metadata,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
      lastAccessed: doc.lastAccessed ? new Date(doc.lastAccessed) : undefined,
      accessCount: doc.accessCount,
      version: doc.version,
      previousVersions: doc.previousVersions,
    };
  }
}
```

---

## Scheduler for Background Tasks

### Access Count Updates

```typescript
// Query schedules mutation (queries are read-only)
export const get = query({
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);

    // Schedule access count update (runs after query completes)
    await ctx.scheduler.runAfter(0, api.memories.updateAccessCount, {
      memoryId: args.memoryId,
    });

    return memory;
  },
});

// Scheduled mutation
export const updateAccessCount = mutation({
  args: { memoryId: v.id("memories") },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);
    await ctx.db.patch(args.memoryId, {
      accessCount: memory.accessCount + 1,
      lastAccessed: Date.now(),
    });
  },
});
```

### Retention Cleanup

```typescript
// Cron job for governance
export const cleanupOldVersions = mutation({
  args: {},
  handler: async (ctx) => {
    const memories = await ctx.db.query("memories").collect();

    for (const memory of memories) {
      if (memory.previousVersions.length > 10) {
        // Trim to retention limit
        await ctx.db.patch(memory._id, {
          previousVersions: memory.previousVersions.slice(-10),
        });
      }
    }
  },
});

// Schedule daily
export default {
  cleanupVersions: {
    schedule: "0 2 * * *", // 2 AM daily
    handler: api.governance.cleanupOldVersions,
  },
};
```

---

## Error Handling

### Convex Error Patterns

```typescript
export const store = mutation({
  handler: async (ctx, args) => {
    // Validation
    if (!args.content || args.content.length === 0) {
      throw new ConvexError({
        code: "INVALID_CONTENT",
        message: "Content cannot be empty",
      });
    }

    if (args.metadata.importance < 0 || args.metadata.importance > 100) {
      throw new ConvexError({
        code: "INVALID_IMPORTANCE",
        message: "Importance must be 0-100",
      });
    }

    // Permission check
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      throw new ConvexError({
        code: "INVALID_AGENT_ID",
        message: "Agent not found",
      });
    }

    // Insert
    try {
      return await ctx.db.insert("memories", args);
    } catch (error) {
      throw new ConvexError({
        code: "CONVEX_ERROR",
        message: "Database insert failed",
        details: error,
      });
    }
  },
});
```

### SDK Error Transformation

```typescript
// Cortex SDK catches Convex errors
try {
  await cortex.memory.store("agent-1", data);
} catch (error) {
  // Transform Convex error to Cortex error
  if (error.data?.code) {
    throw new CortexError(
      error.data.code,
      error.data.message,
      error.data.details,
    );
  }
  throw error;
}
```

---

## Deployment Patterns

### Direct Mode (Your Convex Instance)

```typescript
// Your Convex backend
// convex/memories.ts - Your functions
export const store = mutation({ ... });
export const search = query({ ... });

// Your app
import { ConvexClient } from "convex/browser";
import { Cortex } from "@cortex-platform/sdk";

const convexClient = new ConvexClient(process.env.CONVEX_URL);

// Cortex SDK uses your Convex client
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  // OR provide client directly
  client: convexClient,
});
```

### Cloud Mode (Cortex-Managed Functions)

```typescript
// Your Convex instance (just storage)
// No custom functions needed - Cortex Cloud provides them

// Your app
const cortex = new Cortex({
  mode: "cloud",
  apiKey: process.env.CORTEX_CLOUD_KEY,
});

// Cortex Cloud API:
// - Deploys functions to your Convex
// - OR uses Cortex-hosted functions
// - Manages credentials securely
```

---

## Next Steps

- **[Vector Embeddings](./04-vector-embeddings.md)** - Embedding strategy and dimensions
- **[Search Strategy](./05-search-strategy.md)** - Multi-strategy search implementation
- **[Performance](./08-performance.md)** - Optimization techniques
- **[Security & Privacy](./09-security-privacy.md)** - Data protection

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
