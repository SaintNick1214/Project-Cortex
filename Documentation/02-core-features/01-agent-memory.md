# Agent Memory

> **Last Updated**: 2025-10-23

Private memory banks for each AI agent with complete isolation and semantic search.

## Overview

Every agent in Cortex gets its own private memory bank - a secure, isolated storage space where it can remember anything. Think of it like giving each agent its own brain with perfect recall.

## Key Concepts

### Memory Isolation

Each agent's memories are **completely isolated** from other agents:

```typescript
// Agent 1 stores customer info (Layer 2 - system memory, no conversation)
await cortex.vector.store("support-agent", {
  content: "Customer ABC123 has VIP status with 24/7 support",
  contentType: "raw",
  embedding: await embed("Customer ABC123 VIP status"),
  userId: "customer-abc123", // Which customer
  source: {
    type: "system",
    timestamp: new Date(),
  },
  // No conversationRef - system-generated
  metadata: { importance: 85, tags: ["customer", "vip"] },
});

// Agent 2 cannot see it (Layer 3 convenience - delegates to Layer 2)
const memories = await cortex.memory.search("sales-agent", "VIP customers");
// Returns: [] (empty - different agent)

// Only Agent 1 can access (Layer 3 convenience)
const memories = await cortex.memory.search("support-agent", "VIP customers");
// Returns: [{ content: 'Customer ABC123 has VIP status...', ... }]
```

**Why isolation matters:**

- 🔒 **Security** - Prevents accidental data leakage
- 🎯 **Relevance** - Each agent only sees its own context
- 🐛 **Debugging** - Easy to trace which agent stored what
- 📊 **Analytics** - Per-agent usage patterns

### Memory Structure

Each memory entry contains:

```typescript
interface MemoryEntry {
  // Identity
  id: string; // Unique memory ID (auto-generated)
  agentId: string; // Which agent owns this memory
  userId?: string; // User this memory relates to (if applicable)

  // Content
  content: string; // The actual information (raw or summarized)
  contentType: "raw" | "summarized"; // Track if content was processed
  embedding?: number[]; // Vector for semantic search (OPTIONAL but preferred)

  // Source Context
  source: {
    type: "conversation" | "system" | "tool" | "a2a";
    userId?: string; // Who provided this information
    userName?: string; // Display name for context
    timestamp: Date; // When this was captured
  };

  // Conversation Reference (links to ACID source of truth)
  conversationRef?: {
    conversationId: string; // Which conversation in ACID store
    messageIds: string[]; // Which message(s) informed this memory
  };

  // Metadata
  metadata: {
    importance: number; // 0-100 (0=trivial, 100=critical)
    tags: string[]; // For categorization and filtering
    [key: string]: any; // Custom fields as needed
  };

  // Temporal Tracking (ALWAYS INCLUDED)
  createdAt: Date; // When originally stored
  updatedAt: Date; // When last modified
  lastAccessed?: Date; // Last retrieval time
  accessCount: number; // Usage frequency

  // Version History (AUTOMATIC with retention rules)
  version: number; // Current version number
  previousVersions?: MemoryVersion[]; // Historical versions (subject to retention)
}

interface MemoryVersion {
  version: number;
  content: string;
  contentType: "raw" | "summarized";
  embedding?: number[];
  conversationRef?: {
    conversationId: string;
    messageIds: string[]; // Source messages for this version
  };
  metadata: any;
  timestamp: Date; // When this version was created
  updatedBy?: string; // What caused the update
}
```

> **Hybrid Architecture**: Cortex uses a two-layer system:
>
> - **ACID Conversations** (Convex): Immutable source of truth, complete message history, no retention limits
> - **Vector Memories** (Convex): Searchable knowledge index with versioning and retention rules
>
> `conversationRef` links vector memories back to their ACID source, allowing full context retrieval anytime.

> **Key Feature**: Memory versioning is **automatic** - every update creates a new version while preserving history (default: 10 versions). Each version tracks its source conversation messages.

## Architecture: ACID + Vector Hybrid

Cortex uses a **two-layer storage architecture** for optimal performance and complete data preservation.

**Complete API Organization:**

```
Layer 1: Three ACID Stores
├── cortex.conversations.*  (Private, append-only conversations)
├── cortex.immutable.*      (Shared, versioned knowledge)
└── cortex.mutable.*        (Shared, live data)

Layer 2: Vector Index
└── cortex.vector.*         (Searchable, references Layer 1)

Layer 3: Convenience
└── cortex.memory.*         (Conversations + Vector helper)

Additional APIs
├── cortex.users.*          (User profiles)
├── cortex.agents.*         (Agent registry)
├── cortex.contexts.*       (Workflow coordination)
├── cortex.a2a.*            (A2A helpers)
└── cortex.governance.*     (Retention policies)
```

**In this guide:**

- Conversation examples use `cortex.memory.remember()` (Layer 3 - recommended)
- System/tool examples use `cortex.vector.store()` (Layer 2 - explicit)
- Shared knowledge examples use `cortex.immutable.*` (Layer 1b) + optional Vector indexing
- Retrieval/search uses `cortex.memory.*` (Layer 3 - convenience)

For complete API details, see [Memory Operations API](../03-api-reference/02-memory-operations.md).

### Complete Lifecycle Example

Let's walk through a real scenario to understand how both layers work together:

**April 3, 10 AM - User sets password:**

```typescript
User: "The password is Red";

// Step 1: Store in ACID (forever)
const msg1 = await cortex.conversations.addMessage("conv-456", {
  id: "msg-001", // Auto-generated
  role: "user",
  text: "The password is Red",
  userId: "user-1",
  timestamp: new Date("2025-04-03T10:00:00Z"),
});

// Step 2: Index in Vector (with ref to ACID) - Layer 2 explicit
const mem1 = await cortex.vector.store("agent-1", {
  content: "The password is Red", // Raw text
  contentType: "raw",
  embedding: await embed("The password is Red"), // Optional
  userId: "user-1",
  source: {
    type: "conversation",
    userId: "user-1",
    timestamp: new Date("2025-04-03T10:00:00Z"),
  },
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-001"], // ← Links to ACID!
  },
  metadata: { importance: 100, tags: ["password"] },
});

// Result:
// - ACID: msg-001 stored (immutable)
// - Vector: mem_abc123 v1 created (references msg-001)
```

**August 5, 2 PM - User changes password:**

```typescript
User: "Actually the password is Blue now";

// Step 1: Append to ACID (msg-001 still exists!)
const msg183 = await cortex.conversations.addMessage("conv-456", {
  id: "msg-183", // New message
  role: "user",
  text: "Actually the password is Blue now",
  userId: "user-1",
  timestamp: new Date("2025-08-05T14:00:00Z"),
});

// Step 2: Update vector memory (creates v2, keeps v1 per retention)
await cortex.memory.update("agent-1", "mem_abc123", {
  content: "The password is Blue",
  embedding: await embed("The password is Blue"),
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-183"], // ← Now references new message!
  },
});

// Result:
// - ACID: msg-001 AND msg-183 both exist (immutable)
// - Vector: mem_abc123 now v2 (current), v1 in previousVersions[]
```

**October 23 - User asks:**

```typescript
User: "What's the password?"

// Step 1: Vector search (fast)
const memories = await cortex.memory.search('agent-1', 'password', {
  embedding: await embed('password'),
  userId: 'user-1'
});

// Returns:
{
  content: 'The password is Blue',  // v2 (current)
  version: 2,
  conversationRef: { conversationId: 'conv-456', messageIds: ['msg-183'] },
  previousVersions: [
    {
      version: 1,
      content: 'The password is Red',
      conversationRef: { conversationId: 'conv-456', messageIds: ['msg-001'] }
    }
  ]
}

// Step 2: Optional - Get full ACID context
const fullConversation = await cortex.conversations.get('conv-456');
const recentMessage = fullConversation.messages.find(m => m.id === 'msg-183');
console.log(recentMessage.text); // "Actually the password is Blue now"

// Step 3: Agent responds
Agent: "The password is Blue!"
```

**5 Years Later - After Retention Cleanup:**

```typescript
// Vector memory retention kicked in (kept only 10 versions)
const memory = await cortex.memory.get("agent-1", "mem_abc123");
console.log(memory.version); // 25 (after many updates)
console.log(memory.previousVersions.length); // 10 (retention limit)
// v1 is gone from vector memory!

// BUT - ACID conversation still has everything!
const conversation = await cortex.conversations.get("conv-456");
const originalMsg = conversation.messages.find((m) => m.id === "msg-001");
console.log(originalMsg.text); // "The password is Red" - STILL THERE!

// Full audit trail preserved even after vector retention cleanup! ✅
```

### The Two Layers:

### Layer 1: ACID Conversation History (Source of Truth)

Complete, immutable conversation threads stored in Convex:

```typescript
// Convex Table: conversations
{
  conversationId: 'conv-456',
  userId: 'user-1',
  agentId: 'agent-1',
  messages: [
    {
      id: 'msg-001',
      role: 'user',
      text: 'The password is Red',  // ← FULL original message
      timestamp: '2025-04-03T10:00:00Z'
    },
    {
      id: 'msg-183',
      role: 'user',
      text: 'Actually the password is Blue now',  // ← Never overwrites msg-001
      timestamp: '2025-08-05T14:00:00Z'
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

**Properties:**

- ✅ Append-only (never modified)
- ✅ Complete conversation history
- ✅ No retention limits (keeps forever)
- ✅ Legal/audit compliance
- ✅ Full context always available

### Layer 2: Vector Memory Index (Searchable Knowledge)

Optimized, searchable knowledge that references Layer 1:

```typescript
// Convex Table: memories (with vector index)
{
  id: 'mem_abc123',
  agentId: 'agent-1',
  userId: 'user-1',

  // Current knowledge
  content: 'The password is Blue',  // Raw or summarized
  contentType: 'raw',  // or 'summarized'
  embedding: [0.456, ...],  // Optional vector

  // Links to ACID source
  conversationRef: {
    conversationId: 'conv-456',
    messageIds: ['msg-183']  // ← Points to Layer 1!
  },

  // Version history (with retention)
  version: 2,
  previousVersions: [
    {
      version: 1,
      content: 'The password is Red',
      conversationRef: { conversationId: 'conv-456', messageIds: ['msg-001'] },
      timestamp: '2025-04-03T10:00:00Z'
    }
  ],  // ← Subject to retention rules (default: 10 versions)

  metadata: { importance: 100, tags: ['password'] }
}
```

**Properties:**

- ✅ Fast searchable (vector or text)
- ✅ Versioned with retention rules
- ✅ References immutable source
- ✅ Can retrieve full context via conversationRef
- ✅ Optimized for knowledge retrieval

### Why This Hybrid Approach?

**Without ACID reference (just vector):**

- ❌ Lose full context after retention cleanup
- ❌ Can't retrieve original message
- ❌ No audit trail to source

**Without Vector index (just ACID):**

- ❌ Slow to search large conversations
- ❌ No semantic search
- ❌ Have to scan all messages

**With Both (Hybrid):**

- ✅ Fast search via vector index
- ✅ Complete context via ACID
- ✅ Version retention doesn't lose data (source still available)
- ✅ Best of both worlds!

## Core API Principle: Universal Filters

**Key Design**: All filter options work across ALL operations for maximum flexibility.

```typescript
// The same filters work for:
const filters = {
  userId: "user-123",
  tags: ["preferences"],
  importance: { $gte: 50 },
  createdAfter: new Date("2025-10-01"),
};

// Search
await cortex.memory.search(agentId, query, filters);

// Update many
await cortex.memory.updateMany(agentId, filters, {
  metadata: { reviewed: true },
});

// Delete many
await cortex.memory.deleteMany(agentId, filters);

// Count
await cortex.memory.count(agentId, filters);

// List
await cortex.memory.list(agentId, filters);

// Export
await cortex.memory.export(agentId, filters);

// Archive
await cortex.memory.archive(agentId, filters);
```

**Supported Filters (work everywhere):**

- `userId` - User ID
- `tags` - Array of tags (with tagMatch: 'any' or 'all')
- `importance` - Number or range { $gte, $lte, $eq }
- `createdBefore/After` - Date range for creation
- `updatedBefore/After` - Date range for updates
- `lastAccessedBefore/After` - Access date range
- `accessCount` - Number or range
- `version` - Version number or range
- `source.type` - Source type filter
- `metadata.*` - Any metadata field

**Operations Using Filters:**

| Operation      | Filters | Returns        | Use Case                     |
| -------------- | ------- | -------------- | ---------------------------- |
| `search()`     | ✅      | MemoryEntry[]  | Find relevant memories       |
| `count()`      | ✅      | number         | Get count without retrieving |
| `list()`       | ✅      | MemoryEntry[]  | Paginated listing            |
| `updateMany()` | ✅      | UpdateResult   | Bulk updates                 |
| `deleteMany()` | ✅      | DeletionResult | Bulk deletion                |
| `archive()`    | ✅      | ArchiveResult  | Soft delete                  |
| `export()`     | ✅      | JSON/CSV       | Data export                  |
| `get()`        | ❌      | MemoryEntry    | Get by ID only               |
| `update()`     | ❌      | MemoryEntry    | Update by ID only            |
| `delete()`     | ❌      | DeletionResult | Delete by ID only            |

### Universal Filters Example

The same filter object works across all operations:

```typescript
// Define filters once
const oldDebugLogs = {
  tags: ["debug", "log"],
  importance: { $lte: 10 },
  createdBefore: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  accessCount: { $eq: 0 },
};

// Count them
const count = await cortex.memory.count("agent-1", oldDebugLogs);
console.log(`Found ${count} old debug logs`);

// Preview them
const preview = await cortex.memory.list("agent-1", {
  ...oldDebugLogs,
  limit: 10,
});
console.log(
  "Sample logs:",
  preview.map((m) => m.content),
);

// Export before deleting (backup)
await cortex.memory.export("agent-1", {
  ...oldDebugLogs,
  format: "json",
  outputPath: "backups/debug-logs.json",
});

// Delete them
const result = await cortex.memory.deleteMany("agent-1", oldDebugLogs);
console.log(`Deleted ${result.deleted} old debug logs`);

// Same filters, 4 different operations! 🎯
```

## Basic Operations

### Store vs Update Decision

**The Problem**: How do you know if information should update an existing memory or create a new one?

```
April 3: "Call me Alexander"
August 5: "Actually I prefer to be called Alex"
→ Update the existing memory? Or create new?
```

Cortex provides **multiple strategies** since we don't have an LLM to decide for you:

#### Strategy 1: Semantic Similarity (Recommended)

Use embeddings to find similar existing memories:

```typescript
async function storeOrUpdate(
  agentId: string,
  userId: string,
  content: string,
  options: StoreOptions
) {
  // Generate embedding
  const embedding = await embed(content);

  // Search for similar memories from this user
  const similar = await cortex.memory.search(agentId, content, {
    embedding,
    userId,  // Same user
    tags: options.tags,  // Same topic area
    limit: 3,
    minScore: 0.85  // High similarity threshold
  });

  // If highly similar memory exists, update it
  if (similar.length > 0 && similar[0].score > 0.85) {
    return await cortex.memory.update(agentId, similar[0].id, {
      content,
      embedding,
      metadata: {
        ...similar[0].metadata,
        updatedReason: 'similar-content',
        previousContent: similar[0].content  // Track what changed
      }
    });
  }

  // Otherwise, create new memory (Layer 2 - manual Vector storage)
  return await cortex.vector.store(agentId, {
    content,
    contentType: 'raw',
    embedding,
    userId,
    source: options.source,
    conversationRef: options.conversationRef,  // Pass through if provided
    metadata: options.metadata
  });
}

// Usage
await storeOrUpdate('agent-1', 'user-123',
  'Actually I prefer to be called Alex',
  {
    tags: ['name', 'preferences'],
    source: { type: 'conversation', userId: 'user-123', ... }
  }
);
// Finds "Call me Alexander" (similarity: 0.92) → Updates it!
```

#### Strategy 2: Topic-Based Matching

Use tags and userId to identify updateable memories:

```typescript
async function storeOrUpdateByTopic(
  agentId: string,
  userId: string,
  content: string,
  topicTags: string[],
) {
  // Search for existing memory on this topic for this user
  const existing = await cortex.memory.search(agentId, "*", {
    userId,
    tags: topicTags,
    sortBy: "updatedAt",
    sortOrder: "desc",
    limit: 1,
  });

  // If topic exists for this user, update it
  if (existing.length > 0) {
    return await cortex.memory.update(agentId, existing[0].id, {
      content,
      metadata: {
        ...existing[0].metadata,
        tags: topicTags,
        updateReason: "topic-match",
      },
    });
  }

  // Create new (Layer 2 - explicit Vector)
  return await cortex.vector.store(agentId, {
    content,
    contentType: "raw",
    userId,
    source: { type: "conversation", userId, timestamp: new Date() },
    metadata: { tags: topicTags },
  });
}

// Usage
await storeOrUpdateByTopic(
  "agent-1",
  "user-123",
  "Actually I prefer to be called Alex",
  ["name", "preferences", "user-123"],
);
// Finds memory tagged with ['name', 'preferences', 'user-123'] → Updates it!
```

#### Strategy 3: Explicit Memory Keys

Let developers specify what makes a memory unique:

```typescript
async function storeOrUpdateByKey(
  agentId: string,
  userId: string,
  memoryKey: string, // Unique key like 'user-name-preference'
  content: string,
) {
  // Search for memory with this key
  const existing = await cortex.memory.search(agentId, "*", {
    userId,
    metadata: { memoryKey },
    limit: 1,
  });

  if (existing.length > 0) {
    // Update existing
    return await cortex.memory.update(agentId, existing[0].id, {
      content,
    });
  }

  // Create new (Layer 2 - explicit Vector)
  return await cortex.vector.store(agentId, {
    content,
    contentType: "raw",
    userId,
    source: { type: "conversation", userId, timestamp: new Date() },
    metadata: { memoryKey },
  });
}

// Usage
await storeOrUpdateByKey(
  "agent-1",
  "user-123",
  "user-name-preference", // Unique key
  "Actually I prefer to be called Alex",
);
// Always updates the same memory for this key
```

#### Strategy 4: Cortex Smart Store (Helper)

Cortex provides a helper that combines strategies:

```typescript
// Smart store - Cortex decides for you
const result = await cortex.memory.smartStore('agent-1', {
  content: 'Actually I prefer to be called Alex',
  embedding: await embed('Actually I prefer to be called Alex'),
  userId: 'user-123',
  source: { type: 'conversation', userId: 'user-123', ... },
  metadata: {
    importance: 70,
    tags: ['name', 'preferences']
  },
  // Smart store options
  updateStrategy: 'semantic',  // or 'topic' or 'key'
  similarityThreshold: 0.85,
  topicTags: ['name', 'preferences'],
  memoryKey: 'user-name-preference'
});

if (result.action === 'updated') {
  console.log(`Updated existing memory ${result.id} (was: "${result.oldContent}")`);
} else {
  console.log(`Created new memory ${result.id}`);
}
```

#### Strategy 5: Ask Developer (Callback)

Let developers provide custom logic:

```typescript
// Configure decision logic
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  onBeforeStore: async (agentId, newMemory) => {
    // Your custom logic
    const similar = await cortex.memory.search(agentId, newMemory.content, {
      embedding: newMemory.embedding,
      userId: newMemory.userId,
      limit: 1,
      minScore: 0.8,
    });

    if (similar.length > 0) {
      // Ask your LLM if this is an update
      const decision = await yourLLM.decide({
        old: similar[0].content,
        new: newMemory.content,
        question:
          "Is this an update to the existing memory or new information?",
      });

      if (decision === "update") {
        // Return update instruction
        return { action: "update", memoryId: similar[0].id };
      }
    }

    // Default: create new
    return { action: "create" };
  },
});
```

### Recommended Pattern: Smart Store Helper

**Example solving "Call me Alexander" → "Actually prefer Alex":**

```typescript
// April 3, 10 AM - First interaction
const result1 = await cortex.memory.smartStore("agent-1", {
  content: "Call me Alexander",
  embedding: await embed("Call me Alexander"),
  userId: "user-alex-johnson",
  source: {
    type: "conversation",
    userId: "user-alex-johnson",
    userName: "Alex Johnson",
    conversationId: "conv-001",
    timestamp: new Date("2025-04-03T10:00:00Z"),
  },
  metadata: {
    importance: 70,
    tags: ["name", "preferences"],
  },
  updateStrategy: "semantic",
  similarityThreshold: 0.85,
});
// Result: Created memory (no similar exists)

// August 5, 2 PM - User changes preference
const result2 = await cortex.memory.smartStore("agent-1", {
  content: "Actually I prefer to be called Alex",
  embedding: await embed("Actually I prefer to be called Alex"),
  userId: "user-alex-johnson",
  source: {
    type: "conversation",
    userId: "user-alex-johnson",
    userName: "Alex Johnson",
    conversationId: "conv-045",
    timestamp: new Date("2025-08-05T14:00:00Z"),
  },
  metadata: {
    importance: 70,
    tags: ["name", "preferences"],
  },
  updateStrategy: "semantic",
  similarityThreshold: 0.85,
});
// Result: Updated existing memory (similarity: 0.91)
// Old version preserved: "Call me Alexander" @ April 3
// New version: "Actually I prefer to be called Alex" @ August 5

// View the evolution
const memory = await cortex.memory.get("agent-1", result2.id);
console.log(memory.version); // 2
console.log(memory.content); // "Actually I prefer to be called Alex"
console.log(memory.previousVersions[0]);
// { version: 1, content: "Call me Alexander", timestamp: April 3 }
```

### Manual Store (No Auto-Decision)

If you prefer full control, use the basic API:

```typescript
// Step 1: Store message in ACID conversation (immutable source)
const msg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  content: "User prefers to be called Alex, not Alexander",
  userId: "user-123",
  timestamp: new Date(),
});

// Step 2: Index in vector memory (searchable) - Layer 2 explicit
const memory = await cortex.vector.store("my-agent", {
  content: "User prefers to be called Alex, not Alexander", // Raw
  contentType: "raw", // or 'summarized' if you extracted/processed
  embedding: await embed("User prefers Alex name"), // Optional but preferred
  userId: "user-123",
  source: {
    type: "conversation",
    userId: "user-123",
    userName: "Alex Johnson",
    timestamp: new Date(),
  },
  conversationRef: {
    conversationId: "conv-456",
    messageIds: [msg.id], // Links to ACID source!
  },
  metadata: {
    importance: 50,
    tags: ["preferences", "name", "personal"],
  },
});

console.log(memory.id); // "mem_abc123xyz"
console.log(memory.conversationRef); // { conversationId: 'conv-456', messageIds: ['msg-789'] }

// Later: Retrieve full conversation context from ACID
const conversation = await cortex.conversations.get(
  memory.conversationRef.conversationId,
);
const originalMessage = conversation.messages.find((m) =>
  memory.conversationRef.messageIds.includes(m.id),
);
console.log(originalMessage.text); // Full original message from ACID (never expires!)
```

### Helper: remember() - Recommended

Cortex provides a friendly helper that handles both layers automatically:

```typescript
// Stores in ACID + creates vector memory with reference
const result = await cortex.memory.remember({
  agentId: "agent-1",
  conversationId: "conv-456",
  userMessage: "The password is Red",
  agentResponse: "I'll remember that!",
  userId: "user-123",
  userName: "Alex Johnson",

  // Optional: Provide custom extraction/summarization
  extractContent: async (userMessage, agentResponse) => {
    // Return null to store raw, or return summarized content
    return null; // Stores raw
    // OR
    // return await yourLLM.extractFacts(userMessage);  // Stores summarized
  },

  // Optional: Provide embeddings
  generateEmbedding: async (content) => {
    return await embed(content); // Your embedding provider
    // OR return null for text-only search
  },

  // Or use Cloud Mode (easiest!)
  autoEmbed: true, // Cortex Cloud handles everything

  importance: 100, // or use auto-detection
  tags: ["password", "security"],
});

console.log(result);
// {
//   conversation: { messageIds: ['msg-001', 'msg-002'] },  // ACID
//   memories: [
//     { id: 'mem-abc', content: 'The password is Red', conversationRef: {...} },
//     { id: 'mem-def', content: "I told Alex: I'll remember that!", conversationRef: {...} }
//   ]
// }

// Friendly usage:
await cortex.memory.remember({
  agentId: "agent-1",
  conversationId: currentConvo,
  userMessage: req.body.message,
  agentResponse: response,
  userId: req.user.id,
  userName: req.user.name,
});
// That's it!
```

### Retrieving Specific Memories

```typescript
// Get by ID (Layer 3 - convenience)
const memory = await cortex.memory.get("my-agent", "mem_abc123xyz");

console.log(memory.content); // "User prefers to be called Alex..."
console.log(memory.accessCount); // Tracks how often accessed

// With full ACID conversation context
const enriched = await cortex.memory.get("my-agent", "mem_abc123xyz", {
  includeConversation: true,
});
console.log(enriched.sourceMessages[0].text); // Original message from ACID
```

### Searching Memories

```typescript
// Semantic search (Layer 3 - convenience, searches Vector index)
const memories = await cortex.memory.search(
  "my-agent",
  "what does the user like to be called?",
  {
    embedding: await embed("what does the user like to be called?"),
    userId: "user-123", // Filter to specific user
    limit: 5,
  },
);

// First result is the most relevant
console.log(memories[0].content); // "User prefers to be called Alex..."

// Or with ACID enrichment
const enriched = await cortex.memory.search(
  "my-agent",
  "user name preference",
  {
    embedding: await embed("user name preference"),
    userId: "user-123",
    enrichConversation: true, // Include full ACID context
  },
);
```

### Counting Memories

Use the same filters to count without retrieving:

```typescript
// Count total memories
const total = await cortex.memory.count("agent-1");

// Count for specific user
const userCount = await cortex.memory.count("agent-1", {
  userId: "user-123",
});

// Count by importance range
const criticalCount = await cortex.memory.count("agent-1", {
  importance: { $gte: 90 },
});

// Count with complex filters
const oldUnused = await cortex.memory.count("agent-1", {
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  accessCount: { $lte: 1 },
  importance: { $lte: 30 },
});

console.log(`Found ${oldUnused} old, unused, low-importance memories`);
```

### Listing Memories

List memories with the same filters (useful for pagination):

```typescript
// List all memories (paginated)
const page1 = await cortex.memory.list("agent-1", {
  limit: 50,
  offset: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
});

// List with filters (same as search/delete)
const userMemories = await cortex.memory.list("agent-1", {
  userId: "user-123",
  importance: { $gte: 50 },
  tags: ["important"],
  limit: 100,
});

// List memories needing review
const needsReview = await cortex.memory.list("agent-1", {
  metadata: { reviewed: false },
  importance: { $gte: 70 },
});
```

### Exporting Memories

Export with filters for analysis or backup:

```typescript
// Export all memories for a user (GDPR data export)
const userData = await cortex.memory.export("agent-1", {
  userId: "user-123",
  format: "json",
});

// Export by date range
const monthlyExport = await cortex.memory.export("agent-1", {
  createdAfter: new Date("2025-10-01"),
  createdBefore: new Date("2025-10-31"),
  format: "csv",
});

// Export critical memories only
const criticalBackup = await cortex.memory.export("agent-1", {
  importance: { $gte: 90 },
  format: "json",
});
```

### Updating Memories

#### Update Single Memory by ID

When you update a memory, Cortex **automatically preserves the previous version**:

```typescript
// Original memory (use Layer 3 remember() for conversations)
await cortex.memory.remember({
  agentId: "my-agent",
  conversationId: "conv-123",
  userMessage: "The password is Blue",
  agentResponse: "I'll remember that password",
  userId: "user-1",
  userName: "User",
  importance: 100,
  tags: ["password", "security"],
});

// Update it (doesn't overwrite - creates new version!)
await cortex.memory.update("my-agent", "mem_abc123", {
  content: "The password is now Red",
  metadata: { importance: 100, tags: ["security", "password"] },
});

// Get current version
const current = await cortex.memory.get("my-agent", "mem_abc123");
console.log(current.content); // "The password is now Red"
console.log(current.version); // 2

// Access previous versions
console.log(current.previousVersions);
// [
//   {
//     version: 1,
//     content: 'The password is Blue',
//     timestamp: '2025-10-23T10:00:00Z'
//   }
// ]
```

**Why this matters:**

- ✅ No data loss when information changes
- ✅ Temporal conflict resolution (know what was true when)
- ✅ Audit trail for all changes
- ✅ Can reference historical states
- ✅ Debug what the agent knew at specific times

#### Update Many Memories (Bulk)

Use the same filters as search/delete to update multiple memories:

```typescript
// Update all memories for a user
await cortex.memory.updateMany(
  "agent-1",
  {
    userId: "user-123",
    tags: ["preferences"],
  },
  {
    metadata: {
      reviewed: true,
      reviewedAt: new Date(),
    },
  },
);

// Boost importance of frequently accessed memories
await cortex.memory.updateMany(
  "agent-1",
  {
    accessCount: { $gte: 10 },
  },
  {
    metadata: {
      importance: 75, // Bump to high
    },
  },
);

// Add tag to all old memories
await cortex.memory.updateMany(
  "agent-1",
  {
    createdBefore: new Date("2025-01-01"),
  },
  {
    metadata: {
      tags: ["legacy", "archived"], // Appends to existing tags
    },
  },
);

// Update embedding model version for all memories
await cortex.memory.updateMany(
  "agent-1",
  {
    metadata: { embeddingModel: "text-embedding-ada-002" }, // Old model
  },
  {
    metadata: {
      embeddingModel: "text-embedding-3-large", // New model
      needsReEmbedding: true,
    },
  },
);
```

#### Conditional Updates

Update based on complex conditions:

```typescript
// Decay importance for old, unaccessed memories
await cortex.memory.updateMany(
  "agent-1",
  {
    createdBefore: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    accessCount: { $lte: 1 },
    importance: { $gte: 50 },
  },
  {
    metadata: {
      importance: 30, // Reduce importance
      decayReason: "old-and-unaccessed",
    },
  },
);
```

### Deleting Memories

Cortex provides flexible deletion options with multiple filtering capabilities:

#### Single Memory Deletion

```typescript
// Delete specific memory by ID
await cortex.memory.delete("my-agent", "mem_abc123xyz");

// Returns deleted count
const result = await cortex.memory.delete("my-agent", "mem_abc123xyz");
console.log(result); // { deleted: 1, memoryId: 'mem_abc123xyz' }
```

#### Delete by User (GDPR Compliance)

```typescript
// Delete all memories for a specific user
const result = await cortex.memory.deleteMany("support-agent", {
  userId: "user-123",
});

console.log(`Deleted ${result.deleted} memories for user-123`);

// GDPR right to be forgotten
async function handleDataDeletionRequest(userId: string) {
  // Delete from all agents
  const agents = await cortex.agents.list();

  for (const agent of agents) {
    const result = await cortex.memory.deleteMany(agent.id, {
      userId: userId,
    });
    console.log(`${agent.id}: Deleted ${result.deleted} memories`);
  }
}
```

#### Delete by Tags

```typescript
// Delete all debug logs
await cortex.memory.deleteMany("agent-1", {
  tags: ["debug", "temporary"],
});

// Delete specific topic
await cortex.memory.deleteMany("agent-1", {
  tags: ["deprecated-feature"],
});

// Delete with tag combination (AND logic)
await cortex.memory.deleteMany("agent-1", {
  tags: ["user-123", "temporary"],
  tagMatch: "all", // Must have both tags
});
```

#### Delete by Importance Range

```typescript
// Delete trivial memories (0-10)
await cortex.memory.deleteMany("agent-1", {
  importance: { $lte: 10 },
});

// Delete low to medium importance (0-60)
await cortex.memory.deleteMany("agent-1", {
  importance: { $lte: 60 },
});

// Delete specific range
await cortex.memory.deleteMany("agent-1", {
  importance: { $gte: 20, $lte: 40 }, // 20-40 range only
});
```

#### Delete by Date Range

```typescript
// Delete memories older than 90 days
await cortex.memory.deleteMany("agent-1", {
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
});

// Delete from specific time period
await cortex.memory.deleteMany("agent-1", {
  createdAfter: new Date("2025-01-01"),
  createdBefore: new Date("2025-06-30"),
});

// Delete old, unaccessed memories
await cortex.memory.deleteMany("agent-1", {
  lastAccessedBefore: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
  accessCount: { $lte: 1 },
});
```

#### Combined Filters

```typescript
// Delete old, low-importance, rarely-accessed memories from specific user
const result = await cortex.memory.deleteMany("agent-1", {
  userId: "user-123",
  importance: { $lte: 30 },
  accessCount: { $lte: 2 },
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
});

console.log(`Deleted ${result.deleted} old, unimportant memories`);

// Delete failed tasks from last month
await cortex.memory.deleteMany("agent-1", {
  tags: ["task", "failed"],
  createdAfter: new Date("2025-09-01"),
  createdBefore: new Date("2025-10-01"),
});
```

#### Soft Delete (Archive)

```typescript
// Archive instead of deleting (moves to archive storage)
const result = await cortex.memory.archive("agent-1", {
  importance: { $lte: 20 },
  createdBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
});

console.log(`Archived ${result.archived} memories`);

// Retrieve from archive if needed
const archived = await cortex.memory.getFromArchive("agent-1", {
  dateRange: { start: new Date("2024-01-01"), end: new Date("2024-12-31") },
});
```

#### Safe Deletion with Dry Run

```typescript
// Preview what would be deleted
const preview = await cortex.memory.deleteMany("agent-1", {
  importance: { $lte: 30 },
  dryRun: true, // Don't actually delete
});

console.log(`Would delete ${preview.wouldDelete} memories:`);
preview.memories.forEach((m) => {
  console.log(
    `- ${m.content.substring(0, 50)}... (importance: ${m.metadata.importance})`,
  );
});

// Confirm and delete
if (confirm("Delete these memories?")) {
  const result = await cortex.memory.deleteMany("agent-1", {
    importance: { $lte: 30 },
  });
  console.log(`Deleted ${result.deleted} memories`);
}
```

#### Delete with Confirmation Threshold

```typescript
// Require confirmation for large deletions
const result = await cortex.memory.deleteMany(
  "agent-1",
  {
    userId: "user-123",
  },
  {
    requireConfirmation: true, // Prompts if > 10 memories
    confirmationThreshold: 10,
  },
);

// Or with custom confirmation
const preview = await cortex.memory.deleteMany(
  "agent-1",
  {
    tags: ["temporary"],
  },
  { dryRun: true },
);

if (preview.wouldDelete > 100) {
  throw new Error(
    `Too many memories to delete (${preview.wouldDelete}). Review manually.`,
  );
}
```

#### Clear All (Nuclear Option)

```typescript
// Delete ALL memories for an agent
const result = await cortex.memory.clear("my-agent", {
  confirm: true, // Must explicitly confirm
});

console.log(`Deleted all ${result.deleted} memories`);

// With safety check
async function clearAgentMemories(agentId: string) {
  const stats = await cortex.analytics.getAgentStats(agentId);

  console.log(`WARNING: About to delete ${stats.totalMemories} memories`);
  const confirmation = await prompt("Type DELETE to confirm: ");

  if (confirmation === "DELETE") {
    return await cortex.memory.clear(agentId, { confirm: true });
  }

  throw new Error("Deletion cancelled");
}
```

### Deletion Return Format

```typescript
interface DeletionResult {
  deleted: number; // Count of deleted memories
  memoryIds: string[]; // IDs of deleted memories
  restorable: boolean; // Can be restored from versions
  archived?: boolean; // If archived instead of deleted
  affectedUsers?: string[]; // User IDs affected (for audit)
}

// Example
const result = await cortex.memory.deleteMany("agent-1", {
  userId: "user-123",
});

console.log(result);
// {
//   deleted: 45,
//   memoryIds: ['mem_abc', 'mem_def', ...],
//   restorable: false,
//   affectedUsers: ['user-123']
// }
```

## Advanced Features

### Importance Scoring (0-100)

Memories use a granular 0-100 importance scale:

**90-100** - Critical information

- Passwords, credentials, access codes (100)
- Hard deadlines and commitments (95)
- Security-relevant data (90)
- Critical errors or alerts (95)

**70-89** - High importance

- User preferences and requirements (75)
- Task specifications (80)
- Important decisions (85)
- Configuration changes (75)

**40-69** - Medium importance (default: 50)

- Conversation context (50)
- General preferences (60)
- Background information (45)
- Most day-to-day information (50)

**10-39** - Low importance

- Casual observations (30)
- Minor details (20)
- General context (25)
- Exploratory conversation (20)

**0-9** - Trivial

- Debug logs (5)
- Temporary information (0)
- Noise or spam (0)

```typescript
// Automatic importance scoring
function determineImportance(content: string): number {
  // Critical patterns
  if (/password|secret|credential/i.test(content)) return 100;
  if (/urgent|critical|emergency/i.test(content)) return 95;
  if (/deadline|must|required/i.test(content)) return 90;

  // High importance patterns
  if (/important|priority|decision/i.test(content)) return 80;
  if (/preference|requirement/i.test(content)) return 75;
  if (/meeting|appointment/i.test(content)) return 70;

  // Medium importance (default)
  if (/remember|note|consider/i.test(content)) return 60;

  // Low importance
  if (/maybe|perhaps|casual/i.test(content)) return 30;

  // Default
  return 50;
}

// Or explicitly set any value 0-100 (Layer 2 - system memories)
await cortex.vector.store("my-agent", {
  content: "System password is XYZ123",
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 100 }, // Maximum importance
});

await cortex.vector.store("my-agent", {
  content: "User mentioned they like sunny weather",
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 25 }, // Low importance
});
```

### Importance-Based Filtering

Use importance for precise filtering:

```typescript
// Only critical memories (90+)
const critical = await cortex.memory.search("agent-1", query, {
  embedding: await embed(query),
  minImportance: 90,
});

// Medium to high (50-100)
const important = await cortex.memory.search("agent-1", query, {
  minImportance: 50,
});

// Very specific range (70-85)
const specific = await cortex.memory.search("agent-1", query, {
  filter: {
    importance: { $gte: 70, $lte: 85 },
  },
});

// Exclude trivial (>10)
const meaningful = await cortex.memory.search("agent-1", query, {
  minImportance: 10, // Skip debug logs and noise
});
```

### Importance-Based Ranking

Boost results by importance:

```typescript
// Search with importance boost
const memories = await cortex.memory.search("agent-1", query, {
  embedding: await embed(query),
  boostImportance: true, // Adds (importance/100) to similarity score
});

// Manual importance ranking
const ranked = memories.sort((a, b) => {
  const scoreA = a.score * 0.7 + (a.metadata.importance / 100) * 0.3;
  const scoreB = b.score * 0.7 + (b.metadata.importance / 100) * 0.3;
  return scoreB - scoreA;
});
```

### Dynamic Importance Adjustment

Adjust importance based on context:

```typescript
// Increase importance when information proves valuable
async function boostImportance(agentId: string, memoryId: string) {
  const memory = await cortex.memory.get(agentId, memoryId);

  // Frequently accessed = more important
  if (memory.accessCount > 10) {
    const newImportance = Math.min(memory.metadata.importance + 10, 100);

    await cortex.memory.update(agentId, memoryId, {
      metadata: {
        ...memory.metadata,
        importance: newImportance,
        boostedAt: new Date(),
      },
    });
  }
}

// Decay importance over time for time-sensitive info
async function decayImportance(agentId: string, memoryId: string) {
  const memory = await cortex.memory.get(agentId, memoryId);
  const ageInDays =
    (Date.now() - memory.createdAt.getTime()) / (24 * 60 * 60 * 1000);

  // Meetings become less important after they pass
  if (memory.metadata.tags.includes("meeting") && ageInDays > 1) {
    const newImportance = Math.max(memory.metadata.importance - 20, 10);

    await cortex.memory.update(agentId, memoryId, {
      metadata: {
        ...memory.metadata,
        importance: newImportance,
      },
    });
  }
}
```

### Tagging for Organization

Tags help organize and filter memories:

```typescript
// Store with tags (Layer 2 - tool result)
await cortex.vector.store("support-agent", {
  content: "Resolved ticket #456 by restarting the service",
  contentType: "raw",
  source: { type: "tool", timestamp: new Date() },
  metadata: {
    importance: 75,
    tags: ["troubleshooting", "resolution", "restart", "ticket-456"],
  },
});

// Search by tags
const resolutions = await cortex.memory.search("support-agent", "*", {
  tags: ["resolution"],
  limit: 10,
});

// Get all troubleshooting memories
const troubleshooting = await cortex.memory.search("support-agent", "*", {
  tags: ["troubleshooting"],
});
```

### User-Specific Queries

Filter memories by user for personalized context:

```typescript
// Get all memories related to a specific user
const userMemories = await cortex.memory.search("support-agent", "*", {
  userId: "user-123",
  sortBy: "createdAt",
  sortOrder: "desc",
  limit: 20,
});

// Search within a user's context
const preferences = await cortex.memory.search(
  "support-agent",
  "user preferences",
  {
    embedding: await embed("user preferences"),
    userId: "user-123", // Only this user's preferences
    tags: ["preferences"],
  },
);

// Multi-user scenario
async function getRelevantContext(
  agentId: string,
  userId: string,
  query: string,
) {
  // Get memories specific to this user
  const userContext = await cortex.memory.search(agentId, query, {
    embedding: await embed(query),
    userId, // Filter to this user
    limit: 5,
  });

  // Also get general knowledge (no userId filter)
  const generalKnowledge = await cortex.memory.search(agentId, query, {
    embedding: await embed(query),
    filter: { userId: null }, // General knowledge only
    limit: 3,
  });

  return {
    userSpecific: userContext,
    general: generalKnowledge,
  };
}
```

**Why userId matters:**

- 🎯 Personalized responses per user
- 🔒 Privacy - users only see their own data
- 🎭 Multi-user agents don't mix contexts
- 📊 Per-user analytics and insights

### Source Attribution

The `source` field provides complete traceability:

```typescript
const memory = await cortex.memory.get("agent-1", memoryId);

console.log({
  type: memory.source.type, // 'conversation'
  who: memory.source.userName, // 'Alex Johnson'
  when: memory.source.timestamp, // 2025-10-23T10:30:00Z
  where: memory.source.conversationId, // 'conv-456'
});

// Use in responses
const response = `You told me earlier: "${memory.content}"`;
// vs
const response = `${memory.source.userName} mentioned: "${memory.content}"`;
```

**Source types:**

- `conversation` - From user chat
- `system` - Generated by the system
- `tool` - From tool execution
- `a2a` - From another agent

### Access Tracking

Cortex automatically tracks memory usage:

```typescript
const memory = await cortex.memory.get("my-agent", "mem_abc123");

console.log({
  accessCount: memory.accessCount, // How many times retrieved
  lastAccessed: memory.lastAccessed, // When last accessed
  createdAt: memory.createdAt, // When created
});

// Find most-accessed memories
const popular = await cortex.memory.search("my-agent", "*", {
  sortBy: "accessCount",
  sortOrder: "desc",
  limit: 10,
});

// Find unused memories (potential cleanup candidates)
const unused = await cortex.memory.search("my-agent", "*", {
  filter: { accessCount: { $lte: 1 } },
  olderThan: "30d",
});
```

## Real-World Patterns

### Pattern 1: Store User Input

```typescript
async function handleUserMessage(
  agentId: string,
  userId: string,
  userName: string,
  userMessage: string,
  agentResponse: string,
  conversationId: string,
) {
  // Use Layer 3 remember() for conversations (recommended)
  await cortex.memory.remember({
    agentId,
    conversationId,
    userMessage,
    agentResponse,
    userId,
    userName,
    generateEmbedding: async (content) => await embed(content),
    importance: determineImportance(userMessage), // Returns 0-100
    tags: extractTags(userMessage),
  });
  // Handles ACID + Vector automatically with proper conversationRef
}
```

### Pattern 2: Remember Agent Actions

```typescript
async function afterAgentAction(agentId: string, action: string, result: any) {
  // Store what the agent did (Layer 2 - tool-generated memory)
  await cortex.vector.store(agentId, {
    content: `I ${action} and the result was: ${JSON.stringify(result)}`,
    contentType: "raw",
    embedding: await embed(`${action} result`),
    source: {
      type: "tool", // Tool execution result
      timestamp: new Date(),
    },
    // No conversationRef - tool-generated, not from conversation
    metadata: {
      importance: result.success ? 60 : 85, // Higher if failed
      tags: ["agent-action", action],
      actionType: action,
      success: result.success,
    },
  });
}
```

### Pattern 3: Retrieve Context Before Responding

```typescript
async function buildContextForResponse(
  agentId: string,
  userId: string,
  query: string,
) {
  // Search relevant memories (Layer 3 - searches Vector index)
  const queryEmbedding = await embed(query);

  // Option 1: Fast (Vector only)
  const relevantMemories = await cortex.memory.search(agentId, query, {
    embedding: queryEmbedding,
    userId, // Only memories related to this user
    limit: 5,
    minImportance: 50, // Only importance >= 50
  });

  // Option 2: With full ACID context
  const enriched = await cortex.memory.search(agentId, query, {
    embedding: queryEmbedding,
    userId,
    limit: 5,
    minImportance: 50,
    enrichConversation: true, // Fetch ACID conversations too
  });

  // Build context string with source attribution
  const context = relevantMemories
    .map((m) => {
      const attribution = m.source.userName
        ? `${m.source.userName} said: `
        : "";
      return `${attribution}${m.content}`;
    })
    .join("\n\n");

  return context;
}
```

### Pattern 4: Scheduled Memory Cleanup

```typescript
async function cleanupOldMemories(agentId: string) {
  // Use deleteMany for efficient bulk deletion
  const result = await cortex.memory.deleteMany(agentId, {
    importance: { $lte: 30 }, // Low importance (30 or less)
    accessCount: { $lte: 2 },
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  });

  console.log(`Cleaned up ${result.deleted} old memories`);

  // Or archive instead of delete
  const archived = await cortex.memory.archive(agentId, {
    importance: { $lte: 30 },
    accessCount: { $lte: 2 },
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  });

  console.log(
    `Archived ${archived.archived} old memories (recoverable if needed)`,
  );
}

// Run cleanup weekly
setInterval(() => cleanupOldMemories("agent-1"), 7 * 24 * 60 * 60 * 1000);
```

### Pattern 5: User Data Deletion (GDPR)

```typescript
async function deleteAllUserData(userId: string) {
  const deletionLog = [];

  // Get all agents
  const agents = await cortex.agents.list();

  // Delete from each agent
  for (const agent of agents) {
    const result = await cortex.memory.deleteMany(agent.id, {
      userId: userId,
    });

    if (result.deleted > 0) {
      deletionLog.push({
        agentId: agent.id,
        deleted: result.deleted,
        memoryIds: result.memoryIds,
      });
    }
  }

  // Also delete user profile
  await cortex.users.delete(userId);

  // Return audit trail
  return {
    userId,
    deletedAt: new Date(),
    totalMemoriesDeleted: deletionLog.reduce(
      (sum, log) => sum + log.deleted,
      0,
    ),
    agentsAffected: deletionLog.length,
    detailedLog: deletionLog,
  };
}
```

## Memory Lifecycle

```
┌──────────┐
│ Created  │ (version 1, timestamp T0)
└─────┬────┘
      │
      ▼
┌──────────┐       ┌───────────┐
│ Indexed  │──────>│ Searchable│
└──────────┘       └─────┬─────┘
                         │
                         ▼
                   ┌──────────┐
                   │ Accessed │ (accessCount++, lastAccessed updated)
                   └─────┬────┘
                         │
                    ┌────┴────┐
                    ▼         ▼
              ┌──────────┐  ┌──────────┐
              │ Updated  │  │ Deleted  │
              │(v2, T1)  │  │          │
              │History:  │  └──────────┘
              │ v1@T0    │
              └──────────┘
```

**Automatic Versioning**:

- Every update creates a new version
- Previous versions automatically retained
- Default retention: Last 10 versions
- Configurable per agent or globally

## Memory Versioning (Automatic)

### How Versioning Works

Every update automatically preserves history:

```typescript
// Version 1 (system memory - Layer 2 explicit)
const v1 = await cortex.vector.store("agent-1", {
  content: "The API endpoint is https://api.example.com/v1",
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 70, tags: ["config", "api"] },
});

// Version 2 (update - Layer 3 delegates to Layer 2)
await cortex.memory.update("agent-1", v1.id, {
  content: "The API endpoint is https://api.example.com/v2",
});

// Version 3 (update again)
await cortex.memory.update("agent-1", memoryId, {
  content: "The API endpoint is https://api.example.com/v3",
});

// Get current state
const memory = await cortex.memory.get("agent-1", memoryId);
console.log(memory.content); // "The API endpoint is https://api.example.com/v3"
console.log(memory.version); // 3

// View history
console.log(memory.previousVersions);
// [
//   { version: 1, content: '...v1', timestamp: T0 },
//   { version: 2, content: '...v2', timestamp: T1 }
// ]
```

### Accessing Historical Versions

```typescript
// Get specific version
const v1 = await cortex.memory.getVersion("agent-1", memoryId, 1);
console.log(v1.content); // "The API endpoint is https://api.example.com/v1"

// Get all versions
const history = await cortex.memory.getHistory("agent-1", memoryId);
history.forEach((v) => {
  console.log(`v${v.version} (${v.timestamp}): ${v.content}`);
});

// Find what was true at a specific time
const atTime = await cortex.memory.getAtTimestamp(
  "agent-1",
  memoryId,
  new Date("2025-10-20T10:00:00Z"),
);
console.log("Password at that time:", atTime.content);
```

### Version Retention Configuration

```typescript
// Configure retention per agent (default: 10 versions)
await cortex.agents.configure("my-agent", {
  memoryVersionRetention: 10, // Keep last 10 versions
});

// Or globally
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  defaultVersionRetention: 20, // Keep last 20 versions for all agents
});

// Disable versioning for specific agent (not recommended)
await cortex.agents.configure("temporary-agent", {
  memoryVersionRetention: 1, // Only keep current version
});

// Unlimited retention for audit-critical agents
await cortex.agents.configure("audit-agent", {
  memoryVersionRetention: -1, // Keep all versions forever
});
```

### Temporal Queries

Find what changed over time:

```typescript
// Get all memories that changed this week
const recentUpdates = await cortex.memory.search("agent-1", "*", {
  filter: {
    updatedAt: {
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    version: { $gt: 1 }, // Only memories that have been updated
  },
});

// Find memories with many updates (frequently changing)
const volatile = await cortex.memory.search("agent-1", "*", {
  filter: {
    version: { $gte: 5 }, // 5+ versions
  },
  sortBy: "version",
  sortOrder: "desc",
});
```

### Conflict Resolution Example

```typescript
// Scenario: Password changes multiple times

// Initial (system memory - Layer 2)
const initial = await cortex.vector.store("agent-1", {
  content: "System password is Blue",
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 100, tags: ["security", "password"], system: "prod" },
});

// Update 1 (Layer 3 - delegates to Layer 2, creates version 2)
await cortex.memory.update("agent-1", initial.id, {
  content: "System password is Red (changed for security audit)",
  metadata: {
    importance: 100,
    tags: ["security", "password"],
    system: "prod",
    changeReason: "security-audit",
  },
});

// Update 2 (Layer 3 - creates version 3)
await cortex.memory.update("agent-1", initial.id, {
  content: "System password is Green (changed after breach)",
  metadata: {
    importance: 100, // Critical - increased due to breach
    tags: ["security", "password"],
    system: "prod",
    changeReason: "security-breach",
  },
});

// Now you can ask: "What was the password on October 20th?"
// Layer 3 - temporal query (delegates to Layer 2)
const historical = await cortex.memory.getAtTimestamp(
  "agent-1",
  initial.id,
  new Date("2025-10-20"),
);

// Or: "Why did the password change?"
// Layer 3 - version history (delegates to Layer 2)
const history = await cortex.memory.getHistory("agent-1", initial.id);
history.forEach((v) => {
  console.log(`v${v.version}: ${v.content}`);
  console.log(`  Reason: ${v.metadata.changeReason || "N/A"}`);
});
```

### Lifecycle Hooks (Planned)

Future versions may support hooks:

```typescript
// Before storing
cortex.memory.onBeforeStore((agentId, entry) => {
  // Validate, modify, or reject
  if (entry.content.length > 10000) {
    throw new Error("Memory too large");
  }
});

// After retrieval
cortex.memory.onAfterRetrieve((agentId, memory) => {
  // Log, track, or augment
  analytics.track("memory-accessed", { agentId, memoryId: memory.id });
});

// On version creation
cortex.memory.onVersionCreated((agentId, memoryId, newVersion, oldVersion) => {
  // Audit trail
  console.log(
    `Memory ${memoryId} updated: v${oldVersion.version} → v${newVersion.version}`,
  );
});
```

## Performance Considerations

### Batch Operations

When storing multiple memories, use batch operations:

```typescript
// ❌ Slow - one at a time
for (const item of items) {
  await cortex.vector.store(agentId, item); // Layer 2
}

// ✅ Fast - batch insert (Layer 2 batch operation)
await cortex.vector.storeBatch(agentId, items);

// Or for conversations, use Layer 3 remember() with batch support
await cortex.memory.rememberBatch(conversationExchanges);
```

### Embedding Strategy

Choose when to generate embeddings:

```typescript
// For conversations: Use Layer 3 remember() with embedding options
await cortex.memory.remember({
  agentId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  generateEmbedding: async (content) => await embed(content), // Best search
});

// For system memories: Layer 2 with embedding choices

// Option 1: Always embed (best search, higher cost)
await cortex.vector.store(agentId, {
  content: text,
  contentType: "raw",
  embedding: await embed(text),
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50 },
});

// Option 2: Selective embedding (balanced)
const shouldEmbed = importance >= 70 || tags.includes("searchable");
await cortex.vector.store(agentId, {
  content: text,
  contentType: "raw",
  embedding: shouldEmbed ? await embed(text) : undefined,
  source: { type: "system", timestamp: new Date() },
  metadata: { importance },
});

// Option 3: Lazy embedding (store now, embed later via update)
await cortex.vector.store(agentId, {
  content: text,
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  // No embedding - can add later via cortex.memory.update()
  metadata: { importance: 50 },
});
```

### Cache Recent Memories

For frequently accessed recent memories, consider caching:

```typescript
// Simple in-memory cache
const recentCache = new Map<string, MemoryEntry[]>();

async function getRecentMemories(agentId: string, limit: number = 20) {
  // Check cache first
  if (recentCache.has(agentId)) {
    return recentCache.get(agentId)!;
  }

  // Fetch from Cortex
  const memories = await cortex.memory.search(agentId, "*", {
    sortBy: "createdAt",
    sortOrder: "desc",
    limit,
  });

  // Cache for 60 seconds
  recentCache.set(agentId, memories);
  setTimeout(() => recentCache.delete(agentId), 60000);

  return memories;
}
```

## Security & Privacy

### Data Isolation

Agent memories are isolated at the database level:

```typescript
// Convex enforces isolation
// All queries automatically filter by agentId
// No way to access another agent's memories
```

### Sensitive Data

Handle sensitive information carefully:

```typescript
// ❌ Don't store plaintext secrets
await cortex.vector.store(agentId, {
  content: "User password is: mysecretpass123", // BAD!
  contentType: "raw",
  source: { type: "system" },
});

// ✅ Store references or hashed versions (Layer 2 - system memory)
await cortex.vector.store(agentId, {
  content: "User updated their password on 2025-10-23",
  contentType: "raw",
  userId,
  source: { type: "system", timestamp: new Date() },
  metadata: {
    importance: 95,
    tags: ["security", "password-change"],
    passwordHash: hashPassword("mysecretpass123"), // Store hash only
  },
});

// ✅ Or use secure storage for actual secrets
await cortex.vector.store(agentId, {
  content: "User authentication credentials are stored in secure vault",
  contentType: "raw",
  userId,
  source: { type: "system", timestamp: new Date() },
  metadata: {
    importance: 100,
    vaultReference: "vault://credentials/user-123",
  },
});
```

### Access Control

Implement access control in your application layer:

```typescript
async function storeMemoryWithAuth(
  userId: string,
  agentId: string,
  memory: MemoryInput,
) {
  // Verify user owns this agent
  const agent = await cortex.agents.get(agentId);
  if (agent.metadata.ownerId !== userId) {
    throw new Error("Unauthorized: User does not own this agent");
  }

  // Now safe to store (Layer 3 delegates to appropriate layer)
  return await cortex.memory.store(agentId, memory);
  // Or use cortex.vector.store() for explicit Layer 2 control
}
```

## Automatic Features

### 1. Timestamps (Always Included)

Every memory has precise temporal tracking:

```typescript
const memory = await cortex.memory.get("agent-1", memoryId);

console.log({
  createdAt: memory.createdAt, // When first stored
  updatedAt: memory.updatedAt, // When last modified
  lastAccessed: memory.lastAccessed, // When last retrieved
  age: Date.now() - memory.createdAt.getTime(), // How old
});
```

**Why timestamps matter:**

- Know when information was learned
- Resolve temporal conflicts ("password WAS Blue, now Red")
- Find recent vs old information
- Audit trail for compliance

### 2. Version History (Automatic)

Updates don't overwrite - they create new versions:

```typescript
// Original (v1) - For conversation, use Layer 3 remember()
const result = await cortex.memory.remember({
  agentId: "agent-1",
  conversationId: "conv-123",
  userMessage: "Schedule meeting for Monday at 2 PM",
  agentResponse: "I'll remember that",
  userId,
  userName,
});
const memoryId = result.memories[0].id;

// Reschedule (v2 - v1 preserved!) - Layer 3 update
await cortex.memory.update("agent-1", memoryId, {
  content: "The meeting is scheduled for Tuesday at 3 PM",
});

// View complete history (Layer 3 - delegates to Layer 2)
const memory = await cortex.memory.get("agent-1", memoryId);
console.log(`Current (v${memory.version}): ${memory.content}`);
memory.previousVersions.forEach((v) => {
  console.log(`v${v.version} (${v.timestamp}): ${v.content}`);
});
```

**Version retention** (configurable):

- Default: Keep last 10 versions
- Automatic cleanup of older versions
- Critical memories: Keep all versions
- Temporary data: Keep only current

### 3. Access Tracking (Automatic)

Every read increments counters:

```typescript
// Reading a memory updates tracking
const memory = await cortex.memory.get("agent-1", memoryId);

// Automatically updated:
// - accessCount: 45 → 46
// - lastAccessed: [current timestamp]
```

## Best Practices

### 1. Store Everything (Initially)

Early in development, store liberally:

```typescript
// ✅ Store conversation exchanges (Layer 3 - recommended)
await cortex.memory.remember({
  agentId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName: user.displayName,
  generateEmbedding: async (content) => await embed(content),
  importance: 50, // Default medium
});
// Stores both messages in ACID + creates 2 Vector memories automatically
```

Later, optimize based on usage patterns.

### 2. Decide Create vs Update Strategy Early

Choose your update detection strategy based on use case:

**For structured preferences** → Use memory keys

```typescript
// Always use same key for user's name preference
await storeOrUpdateByKey(agentId, userId, "user-name-pref", content);
```

**For natural conversations** → Use semantic similarity

```typescript
// Let embeddings detect similar topics
await storeOrUpdate(agentId, userId, content, {
  tags: ["preferences"],
  similarityThreshold: 0.85,
});
```

**For topic-based memory** → Use tag matching

```typescript
// One memory per tag combination
await storeOrUpdateByTopic(agentId, userId, content, ["email", "contact"]);
```

**For explicit control** → Use callbacks

```typescript
// Your LLM decides
const cortex = new Cortex({
  onBeforeStore: yourCustomDecisionLogic,
});
```

### 3. Use Descriptive Content

Make memories self-contained and clear:

```typescript
// ❌ Vague
await cortex.vector.store(agentId, {
  content: "User said yes",
  contentType: "raw",
  source: { type: "system" },
});

// ✅ Clear and contextual (use remember() for conversations)
await cortex.memory.remember({
  agentId,
  conversationId,
  userMessage: "Yes, I want weekly newsletters on Mondays at 9 AM EST",
  agentResponse: "I'll set that up for you",
  userId,
  userName,
});
```

### 3. Tag Strategically

Use consistent tagging conventions:

```typescript
// Define tag categories
const TAG_CATEGORIES = {
  source: ["user-input", "agent-action", "system-event", "a2a"],
  topic: ["preferences", "support", "billing", "technical"],
  status: ["pending", "completed", "failed"],
  priority: ["urgent", "normal", "low"],
};

// Apply consistently (Layer 3 for conversation)
await cortex.memory.remember({
  agentId,
  conversationId,
  userMessage: "I need to reset my password",
  agentResponse: "I'll help you reset it",
  userId,
  userName,
  tags: ["user-input", "security", "pending", "urgent"],
});
```

### 4. Set Importance Appropriately

Use importance to prioritize retrieval:

```typescript
// High importance pattern
const HIGH_IMPORTANCE_PATTERNS = [
  /password|secret|credential/i,
  /urgent|critical|emergency/i,
  /deadline|due date|must/i,
  /security|breach|vulnerability/i,
];

// Medium importance pattern
const MEDIUM_IMPORTANCE_PATTERNS = [
  /prefer|like|want/i,
  /meeting|appointment|schedule/i,
  /important|priority/i,
];

function determineImportance(content: string): "low" | "medium" | "high" {
  if (HIGH_IMPORTANCE_PATTERNS.some((p) => p.test(content))) return "high";
  if (MEDIUM_IMPORTANCE_PATTERNS.some((p) => p.test(content))) return "medium";
  return "low";
}
```

### 5. Monitor Memory Growth

Track memory usage over time:

```typescript
// Get memory count per agent
const stats = await cortex.analytics.getAgentStats("my-agent");
console.log(`Agent has ${stats.totalMemories} memories`);

// Set up alerts
if (stats.totalMemories > 10000) {
  console.warn("Agent memory growing large - consider cleanup");
}

// Analyze growth rate
const growthRate = stats.memoriesThisWeek / 7; // per day
console.log(`Adding ${growthRate.toFixed(0)} memories per day`);
```

## Deletion Best Practices

### 1. Always Use Dry Run First

```typescript
// Preview before deleting
const preview = await cortex.memory.deleteMany(agentId, filters, {
  dryRun: true,
});

console.log(`Will delete ${preview.wouldDelete} memories`);
if (preview.wouldDelete > 0) {
  // Review first few
  preview.memories.slice(0, 5).forEach((m) => {
    console.log(`- ${m.content}`);
  });
}

// Then execute
const result = await cortex.memory.deleteMany(agentId, filters);
```

### 2. Archive Before Deleting

```typescript
// Safer: Archive first, delete later
const archived = await cortex.memory.archive(agentId, {
  importance: { $lte: 20 },
  createdBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
});

// Review archived data
const archivedData = await cortex.memory.listArchived(agentId);

// Later, if confirmed not needed
const deleted = await cortex.memory.deleteArchived(agentId, {
  archivedBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
});
```

### 3. Log Deletions for Audit

```typescript
async function auditedDelete(agentId: string, filters: any) {
  // Preview
  const preview = await cortex.memory.deleteMany(agentId, filters, {
    dryRun: true,
  });

  // Log before deleting
  await auditLog.record({
    action: "memory-deletion",
    agentId,
    filters,
    count: preview.wouldDelete,
    timestamp: new Date(),
    performedBy: getCurrentUser(),
  });

  // Delete
  const result = await cortex.memory.deleteMany(agentId, filters);

  // Log result
  await auditLog.record({
    action: "memory-deletion-complete",
    agentId,
    deleted: result.deleted,
    memoryIds: result.memoryIds,
  });

  return result;
}
```

### 4. Scheduled Cleanup Jobs

```typescript
// Daily cleanup of trivial memories
cron.schedule("0 2 * * *", async () => {
  // 2 AM daily
  const agents = await cortex.agents.list();

  for (const agent of agents) {
    const result = await cortex.memory.deleteMany(agent.id, {
      importance: { $lte: 10 }, // Trivial only
      createdBefore: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7+ days old
    });

    if (result.deleted > 0) {
      console.log(
        `Cleaned ${result.deleted} trivial memories from ${agent.id}`,
      );
    }
  }
});

// Weekly archive of old low-importance memories
cron.schedule("0 3 * * 0", async () => {
  // 3 AM Sunday
  const agents = await cortex.agents.list();

  for (const agent of agents) {
    await cortex.memory.archive(agent.id, {
      importance: { $lte: 40 },
      createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    });
  }
});
```

### 5. User-Initiated Deletion

```typescript
// Let users delete their own data
async function deleteMyMemories(userId: string, filters?: any) {
  // Show user what will be deleted
  const preview = await cortex.memory.deleteMany(
    "agent-1",
    {
      userId: userId,
      ...filters,
    },
    { dryRun: true },
  );

  return {
    wouldDelete: preview.wouldDelete,
    memories: preview.memories.map((m) => ({
      content: m.content,
      created: m.createdAt,
      importance: m.metadata.importance,
    })),
    confirmToken: generateToken(), // For confirmation
  };
}

// After user confirms
async function confirmDeleteMyMemories(userId: string, confirmToken: string) {
  if (!verifyToken(confirmToken)) {
    throw new Error("Invalid confirmation token");
  }

  const result = await cortex.memory.deleteMany("agent-1", {
    userId: userId,
  });

  return {
    deleted: result.deleted,
    message: "Your data has been permanently deleted",
  };
}
```

## Common Pitfalls

### ❌ Storing Duplicate Information

```typescript
// DON'T store the same info multiple times
await cortex.vector.store(agentId, {
  content: "User email is user@example.com",
  contentType: "raw",
  source: { type: "system" },
  metadata: { importance: 60 },
});
await cortex.vector.store(agentId, {
  content: "The user's email address: user@example.com", // Duplicate!
  contentType: "raw",
  source: { type: "system" },
  metadata: { importance: 60 },
});
```

**Solution**: Search before storing, update if exists:

```typescript
// Check if info already exists
const existing = await cortex.memory.search(agentId, "user email", {
  tags: ["email"],
  limit: 1,
});

if (existing.length === 0) {
  // Store new memory (Layer 2 - system/extracted info)
  await cortex.vector.store(agentId, {
    content: "User email is user@example.com",
    contentType: "raw",
    userId,
    source: { type: "system", timestamp: new Date() },
    metadata: { importance: 60, tags: ["email", "contact"] },
  });
} else {
  // Update existing (Layer 3 - creates v2, keeps v1 in history)
  await cortex.memory.update(agentId, existing[0].id, {
    content: "User email is user@example.com (confirmed current)",
    metadata: {
      tags: ["email", "contact"],
      verifiedAt: new Date(),
    },
  });
}
```

**Versioning prevents data loss**: Even if you accidentally update the wrong memory, the old version is still available!

### ❌ Storing Too Much in One Memory

```typescript
// DON'T create giant memories
await cortex.vector.store(agentId, {
  content: `User profile: ${JSON.stringify(massiveObject)}`, // Too much!
  contentType: "raw",
  source: { type: "system" },
});
```

**Solution**: Break into logical pieces:

```typescript
// Store discrete facts (Layer 2 - extracted info)
await cortex.vector.store(agentId, {
  content: "User name is Alex Johnson",
  contentType: "raw",
  userId,
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 60, tags: ["profile", "name"] },
});

await cortex.vector.store(agentId, {
  content: "User email is alex@example.com",
  contentType: "raw",
  userId,
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 60, tags: ["profile", "email"] },
});

await cortex.vector.store(agentId, {
  content: "User prefers dark mode theme",
  contentType: "raw",
  userId,
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50, tags: ["profile", "preferences"] },
});
```

### ❌ Not Providing Embeddings

```typescript
// Semantic search won't work well without embeddings
await cortex.vector.store(agentId, {
  content: "Important information",
  contentType: "raw",
  source: { type: "system" },
  // No embedding provided - only text search will work
  metadata: { importance: 70 },
});
```

**Solution**: Always include embeddings for searchable content:

```typescript
await cortex.vector.store(agentId, {
  content: "Important information",
  contentType: "raw",
  embedding: await embed("Important information"), // Enables semantic search
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 70 },
});

// Or use Layer 3 remember() for conversations (auto-links to ACID)
await cortex.memory.remember({
  agentId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  generateEmbedding: async (content) => await embed(content),
});
```

### ❌ Deleting Without Preview

```typescript
// DON'T delete blindly
await cortex.memory.deleteMany(agentId, {
  importance: { $lte: 50 }, // Might delete too much!
});
```

**Solution**: Always preview with dry run:

```typescript
// ✅ Preview first
const preview = await cortex.memory.deleteMany(
  agentId,
  {
    importance: { $lte: 50 },
  },
  { dryRun: true },
);

console.log(`Would delete ${preview.wouldDelete} memories`);

// Review and confirm
if (preview.wouldDelete < 100 && userConfirms()) {
  const result = await cortex.memory.deleteMany(agentId, {
    importance: { $lte: 50 },
  });
  console.log(`Deleted ${result.deleted} memories`);
}
```

### ❌ Forgetting User Context in Deletions

```typescript
// DON'T delete across all users by accident
await cortex.memory.deleteMany(agentId, {
  tags: ["temporary"], // Deletes for ALL users!
});
```

**Solution**: Always specify userId when appropriate:

```typescript
// ✅ Delete only for specific user
await cortex.memory.deleteMany(agentId, {
  userId: "user-123", // Limit to this user
  tags: ["temporary"],
});
```

## Testing Agent Memory

### Unit Testing

```typescript
import { describe, it, expect } from "vitest";

describe("Agent Memory", () => {
  it("should isolate memories between agents", async () => {
    // Store in agent-1 (Layer 2 - system memory for testing)
    await cortex.vector.store("agent-1", {
      content: "Secret for agent 1",
      contentType: "raw",
      source: { type: "system", timestamp: new Date() },
      metadata: { importance: 50 },
    });

    // Try to access from agent-2 (Layer 3 search)
    const memories = await cortex.memory.search("agent-2", "secret");

    expect(memories).toHaveLength(0);
  });

  it("should track access count", async () => {
    const stored = await cortex.vector.store("agent-1", {
      content: "Test memory",
      contentType: "raw",
      source: { type: "system", timestamp: new Date() },
      metadata: { importance: 50 },
    });

    expect(stored.accessCount).toBe(0);

    // Access it (Layer 3 - increments count)
    await cortex.memory.get("agent-1", stored.id);
    const accessed = await cortex.memory.get("agent-1", stored.id);

    expect(accessed.accessCount).toBeGreaterThan(0);
  });
});
```

## Cloud Mode Features

> **Cloud Mode Only**: The following features require Cortex Cloud subscription

### Memory Analytics Dashboard

View visual analytics for agent memory:

- Memory growth over time
- Most accessed memories
- Tag distribution
- Importance breakdown
- Search performance metrics

### Memory Recommendations

AI-powered suggestions:

- "You have 50 duplicate memories about user email - consolidate?"
- "These 100 memories are never accessed - archive or delete?"
- "Tag 'support' appears in 30% of memories - consider splitting this agent"

### Cross-Agent Insights

With team features:

- Compare memory patterns across agents
- Identify shared knowledge opportunities
- Detect information silos

## Troubleshooting

### Memories Not Found

**Problem**: Searching returns no results even though memory was stored.

**Solutions**:

1. Check agent ID matches exactly
2. Verify embedding was provided
3. Try broader search query
4. Check tags filter isn't too restrictive
5. Search with `*` to see all memories

```typescript
// Debug search
const allMemories = await cortex.memory.search("my-agent", "*", {
  limit: 100,
});
console.log(`Agent has ${allMemories.length} total memories`);
```

### Memory Growth Too Fast

**Problem**: Agent accumulating memories too quickly.

**Solutions**:

1. Implement deduplication logic
2. Set up periodic cleanup
3. Use higher importance threshold
4. Archive old memories

### Search is Slow

**Problem**: Search queries taking too long.

**Solutions**:

1. Reduce limit parameter
2. Use more specific tags
3. Add importance filter
4. Consider smaller embedding dimensions
5. Check Convex query performance

## Next Steps

- **[Semantic Search](./02-semantic-search.md)** - Learn about search strategies
- **[User Profiles](./03-user-profiles.md)** - Manage user context
- **[Context Chains](./04-context-chains.md)** - Multi-agent coordination
- **[Dimension Strategies](../07-advanced-topics/02-dimension-strategies.md)** - Choosing embedding models
- **[API Reference](../03-api-reference/02-memory-operations.md)** - Complete API docs

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
