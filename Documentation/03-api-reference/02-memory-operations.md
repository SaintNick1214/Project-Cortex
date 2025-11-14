# Memory Operations API

> **Last Updated**: 2025-11-05

Complete API reference for memory operations across memory spaces.

> **New in v0.9.0**: `memory.rememberStream()` for streaming LLM responses

## Overview

The Memory Operations API is organized into **namespaces** corresponding to Cortex's complete architecture:

```typescript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 1: Three ACID Stores (Immutable Sources of Truth)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cortex.conversations.*   // Layer 1a: Conversations (memorySpace-scoped)
cortex.immutable.*       // Layer 1b: Shared immutable (NO memorySpace - TRULY shared)
cortex.mutable.*         // Layer 1c: Shared mutable (NO memorySpace - TRULY shared)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 2: Vector Index (memorySpace-scoped, Searchable)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cortex.vector.*          // Vector memory operations (memorySpace-scoped)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 3: Facts Store (memorySpace-scoped, Versioned) ✨ NEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cortex.facts.*           // LLM-extracted facts (memorySpace-scoped)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 4: Convenience API (Wrapper over L1a + L2 + L3)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cortex.memory.*          // Primary interface (recommended)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Additional APIs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cortex.memorySpaces.*    // Memory space management (Hive/Collaboration)
cortex.users.*           // User profiles (shared across all spaces)
cortex.contexts.*        // Context chains (cross-space support)
cortex.a2a.*             // Inter-space messaging (Collaboration Mode)
cortex.governance.*      // Retention policies
```

**Complete Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: ACID Stores                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Conversations   │  │  Immutable      │  │  Mutable    │  │
│  │ (memSpace)      │  │  (SHARED)       │  │  (SHARED)   │  │
│  │                 │  │                 │  │             │  │
│  │ User↔Agent      │  │ KB Articles     │  │ Inventory   │  │
│  │ Agent↔Agent     │  │ Policies        │  │ Config      │  │
│  │ Hive/Collab     │  │ Audit Logs      │  │ Counters    │  │
│  │ Versioned       │  │ Versioned       │  │ Live Data   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│  memorySpace-scoped   NO memorySpace       NO memorySpace   │
│  Purgeable            Purgeable            Mutable          │
└───────────┬───────────────────┬─────────────────┬───────────┘
            │                   │                 │
            │ conversationRef   │ immutableRef    │ mutableRef
            │                   │                 │
            └───────────────────┴─────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────┐
│       Layer 2: Vector Index (memorySpace-scoped)            │
├─────────────────────────────────────────────────────────────┤
│  Embedded memories for semantic search                      │
│  References Layer 1 stores via Ref fields                   │
│  Versioned with retention rules                             │
│  Optimized for semantic search within memory space          │
└───────────────────────────┬─────────────────────────────────┘
                            │ factsRef
                            ↓
┌─────────────────────────────────────────────────────────────┐
│    Layer 3: Facts Store (memorySpace-scoped, Versioned) ✨  │
├─────────────────────────────────────────────────────────────┤
│  LLM-extracted facts (60-90% token savings)                 │
│  cortex.facts.* for fact operations                         │
│  Enables infinite context capability                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│       Layer 4: Convenience API (Recommended Interface)      │
├─────────────────────────────────────────────────────────────┤
│  cortex.memory.remember() → L1a + L2 + optional L3          │
│  cortex.memory.search() → L2 + L3 + optional enrichment     │
│  Single API for conversation workflows + infinite context   │
└─────────────────────────────────────────────────────────────┘
```

**Which layer/API to use:**

- 🎯 **Conversations**: Use `cortex.memory.remember()` (Layer 4) or manual `cortex.conversations.*` + `cortex.vector.*`
- 📚 **Shared Knowledge**: Use `cortex.immutable.*` (Layer 1b - TRULY shared, NO memorySpace)
- 📊 **Live Data**: Use `cortex.mutable.*` (Layer 1c - TRULY shared, NO memorySpace)
- 🧠 **Facts**: Use `cortex.facts.*` (Layer 3 - memorySpace-scoped) or auto-extract via `remember()`
- 🔍 **Search**: Use `cortex.memory.search()` (Layer 4) or `cortex.vector.search()` (Layer 2)
- 👤 **User Profiles**: Use `cortex.users.*` (shared across ALL memory spaces + GDPR cascade)
- 🏛️ **Governance**: Use `cortex.governance.*` for all layers

**GDPR Compliance:**

All stores support **optional `userId` field** to enable cascade deletion:

```typescript
// Stores with userId can be deleted via cortex.users.delete(userId, { cascade: true })
await cortex.conversations.addMessage(convId, { userId: 'user-123', ... });
await cortex.immutable.store({ type: 'feedback', id: 'fb-1', userId: 'user-123', ... });
await cortex.mutable.set('sessions', 'sess-1', data, 'user-123');
await cortex.vector.store('user-123-personal', { userId: 'user-123', ... });

// One call deletes from ALL stores
await cortex.users.delete('user-123', { cascade: true });
```

## Three-Namespace Architecture

### Layer 1: cortex.conversations.\* (ACID)

```typescript
// Managing immutable conversation threads
await cortex.conversations.create({ type: 'user-agent', participants: {...} });
await cortex.conversations.addMessage(conversationId, message);
await cortex.conversations.get(conversationId);
await cortex.conversations.getHistory(conversationId, options);
// Returns raw messages, no Vector index involved
```

### Layer 2: cortex.vector.\* (Vector Index)

```typescript
// Managing searchable knowledge index
await cortex.vector.store(memorySpaceId, vectorInput); // Must provide conversationRef manually
await cortex.vector.get(memorySpaceId, memoryId);
await cortex.vector.search(memorySpaceId, query, options);
await cortex.vector.update(memorySpaceId, memoryId, updates);
// Direct Vector operations, you manage conversationRef
```

### Layer 3: cortex.memory.\* (Dual-Layer Convenience)

```typescript
// High-level operations that manage both layers
await cortex.memory.remember(params); // Stores in ACID + creates Vector index
await cortex.memory.get(memorySpaceId, memoryId, { includeConversation: true });
await cortex.memory.search(memorySpaceId, query, { enrichConversation: true });
// Handles both layers automatically
```

### Storage Flow Comparison

**Manual (Layer 1 + Layer 2):**

```
┌─────────────────────────────────────────────┐
│ Layer 1: cortex.conversations.addMessage()  │
│ Returns: msg.id                              │
└────────────┬────────────────────────────────┘
             │ Use msg.id in conversationRef
             ↓
┌─────────────────────────────────────────────┐
│ Layer 2: cortex.vector.store()              │
│ Provide conversationRef manually             │
└─────────────────────────────────────────────┘
```

**Automatic (Layer 3):**

```
┌─────────────────────────────────────────────┐
│ Layer 3: cortex.memory.remember()           │
│ Handles both layers + linking automatically  │
└─────────────────────────────────────────────┘
```

### Manual Flow (Layer 1 + Layer 2)

**For conversation-based memories:**

```typescript
// Step 1: Store raw message in ACID (Layer 1)
const msg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  text: "The password is Blue",
  userId: "user-123",
  timestamp: new Date(),
});
// Returns: { id: 'msg-789', ... }

// Step 2: Index in Vector (Layer 2) - references Step 1
const memory = await cortex.vector.store("user-123-personal", {
  content: "The password is Blue", // Raw or extracted
  contentType: "raw",
  embedding: await embed("The password is Blue"), // Optional
  userId: "user-123",
  source: {
    type: "conversation",
    userId: "user-123",
    userName: "Alex Johnson",
    timestamp: new Date(),
  },
  conversationRef: {
    // Links to ACID
    conversationId: "conv-456",
    messageIds: [msg.id], // From Step 1
  },
  metadata: {
    importance: 100,
    tags: ["password", "security"],
  },
});
```

### Convenience Flow (Layer 3 - recommended)

**Use `cortex.memory.*` to handle both layers automatically:**

```typescript
// Does both ACID + Vector in one call
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-456",
  userMessage: "The password is Blue",
  agentResponse: "I'll remember that!",
  userId: "user-123",
  userName: "Alex",
});

// Behind the scenes (Layer 3 does this):
// 1. cortex.conversations.addMessage() × 2  (ACID Layer 1)
// 2. cortex.vector.store() × 2              (Vector Layer 2)
// 3. Links them via conversationRef
```

### Non-Conversation Memories

**For system/tool memories (no ACID conversation):**

```typescript
// Option 1: Use Layer 2 directly
const memory = await cortex.vector.store("user-123-personal", {
  content: "Agent initialized successfully",
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  // No conversationRef - not from a conversation
  metadata: { importance: 30, tags: ["system", "startup"] },
});

// Option 2: Use Layer 3 (also works for non-conversations)
const memory = await cortex.memory.store("user-123-personal", {
  content: "Agent initialized successfully",
  source: { type: "system" },
  metadata: { importance: 30 },
});
// Layer 3 detects source.type='system' and skips ACID storage
```

### Layer 1 Reference Rules

| source.type    | Typical Ref              | Why                                                      |
| -------------- | ------------------------ | -------------------------------------------------------- |
| `conversation` | **conversationRef**      | Links to private conversation (Layer 1a)                 |
| `a2a`          | **conversationRef**      | Links to A2A conversation (Layer 1a)                     |
| `system`       | **immutableRef** or none | May link to immutable data (Layer 1b) or standalone      |
| `tool`         | **immutableRef** or none | May link to immutable audit log (Layer 1b) or standalone |

**Reference Types:**

- **conversationRef** - Links to Layer 1a (private conversations)
- **immutableRef** - Links to Layer 1b (shared knowledge/policies)
- **mutableRef** - Links to Layer 1c (live data snapshot)
- **None** - Standalone Vector memory (no Layer 1 source)

**Notes:**

- References are mutually exclusive (only one per memory)
- All references are optional
- conversationRef required for `source.type='conversation'` (unless opt-out)
- immutableRef/mutableRef used when indexing shared data

---

## Complete API Reference by Namespace

### Layer 1: cortex.conversations.\* Operations

| Operation                             | Purpose                 | Returns        |
| ------------------------------------- | ----------------------- | -------------- |
| `create(params)`                      | Create new conversation | Conversation   |
| `get(conversationId)`                 | Get conversation        | Conversation   |
| `addMessage(conversationId, message)` | Add message to ACID     | Message        |
| `getHistory(conversationId, options)` | Get message thread      | Message[]      |
| `list(filters)`                       | List conversations      | Conversation[] |
| `search(query, filters)`              | Search conversations    | SearchResult[] |
| `count(filters)`                      | Count conversations     | number         |
| `export(filters, options)`            | Export conversations    | JSON/CSV       |
| `delete(conversationId)`              | Delete conversation     | DeletionResult |

**See:** [Conversation Operations API](./03-conversation-operations.md)

### Layer 2: cortex.vector.\* Operations

| Operation                                       | Purpose                         | Returns         |
| ----------------------------------------------- | ------------------------------- | --------------- |
| `store(memorySpaceId, input)`                   | Store vector memory             | MemoryEntry     |
| `get(memorySpaceId, memoryId)`                  | Get vector memory               | MemoryEntry     |
| `search(memorySpaceId, query, options)`         | Search vector index             | MemoryEntry[]   |
| `update(memorySpaceId, memoryId, updates)`      | Update memory (creates version) | MemoryEntry     |
| `delete(memorySpaceId, memoryId)`               | Delete from vector              | DeletionResult  |
| `updateMany(memorySpaceId, filters, updates)`   | Bulk update                     | UpdateResult    |
| `deleteMany(memorySpaceId, filters, options)`   | Bulk delete                     | DeletionResult  |
| `count(memorySpaceId, filters)`                 | Count memories                  | number          |
| `list(memorySpaceId, options)`                  | List memories                   | ListResult      |
| `export(memorySpaceId, options)`                | Export vector memories          | JSON/CSV        |
| `archive(memorySpaceId, filters)`               | Soft delete                     | ArchiveResult   |
| `getVersion(memorySpaceId, memoryId, version)`  | Get specific version            | MemoryVersion   |
| `getHistory(memorySpaceId, memoryId)`           | Get version history             | MemoryVersion[] |
| `getAtTimestamp(memorySpaceId, memoryId, date)` | Temporal query                  | MemoryVersion   |

### Layer 3: cortex.memory.\* Operations (Dual-Layer)

| Operation                                  | Purpose                   | Returns          | Does                         |
| ------------------------------------------ | ------------------------- | ---------------- | ---------------------------- |
| `remember(params)`                         | Store conversation        | RememberResult   | ACID + Vector                |
| `get(memorySpaceId, memoryId, options)`    | Get memory + conversation | EnrichedMemory   | Vector + optional ACID       |
| `search(memorySpaceId, query, options)`    | Search + enrich           | EnrichedMemory[] | Vector + optional ACID       |
| `store(memorySpaceId, input)`              | Smart store               | MemoryEntry      | Detects layer automatically  |
| `update(memorySpaceId, memoryId, updates)` | Update memory             | MemoryEntry      | Vector (creates version)     |
| `delete(memorySpaceId, memoryId, options)` | Delete memory             | DeletionResult   | Vector only (preserves ACID) |
| `forget(memorySpaceId, memoryId, options)` | Delete both layers        | DeletionResult   | Vector + optionally ACID     |
| _All vector operations_                    | Same as Layer 2           | Same             | Convenience wrappers         |

**Key Differences:**

| Operation      | Layer 2 (cortex.vector.\*) | Layer 3 (cortex.memory.\*)                  |
| -------------- | -------------------------- | ------------------------------------------- |
| `remember()`   | N/A                        | ✨ Unique - stores in both layers           |
| `get()`        | Vector only                | Can include ACID (`includeConversation`)    |
| `search()`     | Vector only                | Can enrich with ACID (`enrichConversation`) |
| `delete()`     | Vector only                | Same (preserves ACID)                       |
| `forget()`     | N/A                        | ✨ Unique - deletes from both layers        |
| `store()`      | Manual conversationRef     | Smart - detects layer from source.type      |
| `update()`     | Direct                     | Delegates to Layer 2                        |
| `updateMany()` | Direct                     | Delegates to Layer 2                        |
| `deleteMany()` | Direct                     | Delegates to Layer 2                        |
| `count()`      | Direct                     | Delegates to Layer 2                        |
| `list()`       | Direct                     | Delegates to Layer 2                        |
| `export()`     | Direct                     | Delegates to Layer 2                        |
| `archive()`    | Direct                     | Delegates to Layer 2                        |
| Version ops    | Direct                     | Delegates to Layer 2                        |

**Layer 3 Unique Operations:**

- `remember()` - Dual-layer storage
- `forget()` - Dual-layer deletion
- `get()` with `includeConversation` - Cross-layer retrieval
- `search()` with `enrichConversation` - Cross-layer search

**Layer 3 Delegations:**

- Most operations are thin wrappers around `cortex.vector.*`
- Convenience for not having to remember namespaces
- Use `cortex.vector.*` directly if you prefer explicit control

---

## Core Operations (Layer 3: cortex.memory.\*)

> Note: Layer 3 operations are convenience wrappers. For direct control, use Layer 1 (`cortex.conversations.*`) and Layer 2 (`cortex.vector.*`) separately.

### remember()

**Layer 3 Operation** - Stores in both ACID and Vector automatically.

Store a new memory for an agent.

**Signature:**

```typescript
cortex.memory.store(
  memorySpaceId: string,
  entry: MemoryInput
): Promise<MemoryEntry>
```

**Parameters:**

```typescript
interface MemoryInput {
  // Content (required)
  content: string; // The information to remember
  contentType: "raw" | "summarized"; // Type of content

  // Embedding (optional but preferred)
  embedding?: number[]; // Vector for semantic search

  // Context
  userId?: string; // User this relates to

  // Source (required)
  source: {
    type: "conversation" | "system" | "tool" | "a2a";
    userId?: string;
    userName?: string;
    timestamp: Date;
  };

  // Layer 1 References (optional - link to ACID stores)
  // ONE of these may be present (mutually exclusive)

  conversationRef?: {
    // Layer 1a: Private conversations
    conversationId: string; // Which conversation
    messageIds: string[]; // Specific message(s)
  };

  immutableRef?: {
    // Layer 1b: Shared immutable data
    type: string; // Entity type
    id: string; // Logical ID
    version?: number; // Specific version (optional)
  };

  mutableRef?: {
    // Layer 1c: Shared mutable data (snapshot)
    namespace: string;
    key: string;
    snapshotValue: any; // Value at indexing time
    snapshotAt: Date;
  };

  // Metadata (required)
  metadata: {
    importance: number; // 0-100
    tags: string[]; // Categorization
    [key: string]: any; // Custom fields
  };
}
```

**Returns:**

```typescript
interface MemoryEntry {
  id: string; // Auto-generated ID
  memorySpaceId: string;
  userId?: string;
  content: string;
  contentType: "raw" | "summarized";
  embedding?: number[];
  source: MemorySource;
  conversationRef?: ConversationRef;
  metadata: MemoryMetadata;
  version: number; // Always 1 for new
  previousVersions: []; // Empty for new
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  accessCount: number; // Always 0 for new
}
```

**Example 1: Conversation Memory (conversationRef required)**

```typescript
// FIRST: Store in ACID (you must do this first for conversations)
const msg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  text: "The password is Blue",
  userId: "user-123",
});

// THEN: Store in Vector (with conversationRef linking to ACID)
const memory = await cortex.memory.store("user-123-personal", {
  content: "The password is Blue",
  contentType: "raw",
  embedding: await embed("The password is Blue"),
  userId: "user-123",
  source: {
    type: "conversation", // ← Conversation type
    userId: "user-123",
    userName: "Alex Johnson",
    timestamp: new Date(),
  },
  conversationRef: {
    // ← REQUIRED for conversations
    conversationId: "conv-456",
    messageIds: [msg.id], // From ACID message
  },
  metadata: {
    importance: 100,
    tags: ["password", "security"],
  },
});

console.log(memory.id); // "mem_abc123xyz"
console.log(memory.conversationRef.conversationId); // "conv-456"
```

**Example 2: System Memory (no conversationRef)**

```typescript
// No ACID storage needed - this isn't from a conversation
const memory = await cortex.memory.store("user-123-personal", {
  content: "Agent started successfully at 10:00 AM",
  contentType: "raw",
  source: {
    type: "system", // ← System type
    timestamp: new Date(),
  },
  // No conversationRef - not from a conversation
  metadata: {
    importance: 20,
    tags: ["system", "status"],
  },
});
```

**Example 3: Use remember() - recommended for conversations**

```typescript
// Helper does both steps automatically
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-456",
  userMessage: "The password is Blue",
  agentResponse: "I'll remember that!",
  userId: "user-123",
  userName: "Alex",
});

// Automatically:
// 1. Stored 2 messages in ACID
// 2. Created 2 vector memories with conversationRef
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('INVALID_CONTENT')` - Content is empty or too large
- `CortexError('INVALID_IMPORTANCE')` - Importance not in 0-100 range
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [Agent Memory Guide](../02-core-features/01-agent-memory.md#storing-memories)
- [Store vs Update Decision](../02-core-features/01-agent-memory.md#store-vs-update-decision)

---

### remember()

**RECOMMENDED HELPER** - Handles both ACID storage and Vector indexing automatically.

**Signature:**

```typescript
cortex.memory.remember(
  params: RememberParams
): Promise<RememberResult>
```

**What it does:**

1. Stores raw messages in **ACID** (Layer 1)
2. Creates vector memories in **Vector Memory** (Layer 2)
3. Automatically links them via `conversationRef`
4. Handles embedding generation (optional)
5. Auto-detects importance and tags

**Parameters:**

```typescript
interface RememberParams {
  memorySpaceId: string;
  conversationId: string; // ACID conversation (create first if new)
  userMessage: string;
  agentResponse: string;
  userId: string;
  userName: string;

  // Optional extraction
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;

  // Optional embedding
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Cloud Mode options
  autoEmbed?: boolean; // Cloud Mode: auto-generate embeddings
  autoSummarize?: boolean; // Cloud Mode: auto-summarize content

  // Metadata
  importance?: number; // Auto-detect if not provided
  tags?: string[]; // Auto-extract if not provided
}
```

**Returns:**

```typescript
interface RememberResult {
  conversation: {
    messageIds: string[]; // IDs stored in ACID Layer 1
    conversationId: string; // ACID conversation ID
  };
  memories: MemoryEntry[]; // Created in Vector Layer 2 (with conversationRef)
}
```

**Example:**

```typescript
// This ONE call does everything:
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-456", // ACID conversation (must exist or be created)
  userMessage: "The password is Red",
  agentResponse: "I'll remember that!",
  userId: "user-123",
  userName: "Alex Johnson",

  // Optional: Custom embedding
  generateEmbedding: async (content) => {
    return await embed(content); // Your embedder
  },

  // Or use Cloud Mode
  autoEmbed: true, // Cortex Cloud handles embeddings

  importance: 100,
  tags: ["password", "security"],
});

// What happened:
// 1. Stored in ACID: 2 messages (user + agent)
console.log(`ACID messages: ${result.conversation.messageIds.join(", ")}`);
// ['msg-001', 'msg-002']

// 2. Created in Vector: 2 memories (both reference ACID)
console.log(`Vector memories: ${result.memories.length}`); // 2
console.log(result.memories[0].conversationRef.conversationId); // 'conv-456'
console.log(result.memories[0].conversationRef.messageIds); // ['msg-001']
```

**Why use `remember()`:**

- ✅ Handles ACID + Vector in one call
- ✅ Automatic conversationRef linking
- ✅ Auto-detects importance and tags
- ✅ Ensures consistency between layers
- ✅ Friendly, intuitive name
- ✅ **This is the main way to store conversation memories**

**Typical usage:**

```typescript
// Natural and simple
await cortex.memory.remember({
  memorySpaceId: "support-agent",
  conversationId: currentConversation,
  userMessage: req.body.message,
  agentResponse: response,
  userId: req.user.id,
  userName: req.user.name,
});

// That's it! Everything is stored and linked.
```

**See Also:**

- [Helper Functions](../02-core-features/01-agent-memory.md#helper-store-from-conversation-recommended)
- [Conversation Operations](./04-conversation-operations.md) - Managing ACID conversations

---

### rememberStream()

**NEW in v0.9.0** - Store streaming LLM responses with automatic buffering.

**Signature:**

```typescript
cortex.memory.rememberStream(
  params: RememberStreamParams,
  options?: RememberOptions
): Promise<RememberStreamResult>
```

**What it does:**

1. Consumes streaming response (ReadableStream or AsyncIterable)
2. Buffers chunks until stream completes
3. Stores in ACID (Layer 1) once complete
4. Creates vector memories in Vector Memory (Layer 2)
5. Automatically links them via `conversationRef`
6. Returns both memory result AND the full response text

**Parameters:**

```typescript
interface RememberStreamParams {
  // Required
  memorySpaceId: string;
  conversationId: string;
  userMessage: string;
  responseStream: ReadableStream<string> | AsyncIterable<string>; // Stream to consume
  userId: string;
  userName: string;

  // Optional - Hive Mode
  participantId?: string;

  // Optional - Content processing
  extractContent?: (
    userMsg: string,
    agentResp: string,
  ) => Promise<string | null>;

  // Optional - Embeddings
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Optional - Fact extraction
  extractFacts?: (
    userMsg: string,
    agentResp: string,
  ) => Promise<FactData[] | null>;

  // Optional - Cloud Mode
  autoEmbed?: boolean;
  autoSummarize?: boolean;

  // Optional - Metadata
  importance?: number;
  tags?: string[];
}

interface RememberOptions {
  syncToGraph?: boolean; // Default: true if graph adapter configured
}
```

**Returns:**

```typescript
interface RememberStreamResult {
  // Standard remember() result
  conversation: {
    messageIds: string[];
    conversationId: string;
  };
  memories: MemoryEntry[];
  facts: FactRecord[];

  // Plus streaming-specific
  fullResponse: string; // Complete text from consumed stream
}
```

**Example 1: Vercel AI SDK**

```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const response = await streamText({
  model: openai("gpt-4"),
  messages: [{ role: "user", content: "What is AI?" }],
});

const result = await cortex.memory.rememberStream({
  memorySpaceId: "ai-tutor",
  conversationId: "lesson-1",
  userMessage: "What is AI?",
  responseStream: response.textStream, // ReadableStream
  userId: "student-123",
  userName: "Alice",
});

console.log("Full response:", result.fullResponse);
console.log("Memories stored:", result.memories.length); // 2 (user + agent)
```

**Example 2: OpenAI SDK (AsyncIterable)**

```typescript
import OpenAI from "openai";

const openai = new OpenAI();
const stream = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

const result = await cortex.memory.rememberStream({
  memorySpaceId: "chat-bot",
  conversationId: "conv-789",
  userMessage: "Hello!",
  responseStream: stream, // AsyncIterable
  userId: "user-456",
  userName: "Bob",
});
```

**Example 3: With Embeddings and Facts**

```typescript
const result = await cortex.memory.rememberStream({
  memorySpaceId: "smart-bot",
  conversationId: "conv-999",
  userMessage: "My favorite color is blue",
  responseStream: stream,
  userId: "user-789",
  userName: "Charlie",

  // Generate embeddings
  generateEmbedding: async (text) => {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    });
    return embedding;
  },

  // Extract facts
  extractFacts: async (userMsg, agentResp) => {
    return [
      {
        fact: "User's favorite color is blue",
        factType: "preference",
        confidence: 95,
        subject: "user",
        predicate: "favoriteColor",
        object: "blue",
      },
    ];
  },
});

console.log("Response:", result.fullResponse);
console.log("Facts:", result.facts); // Extracted facts
```

**Example 4: Edge Runtime (Vercel Edge Functions)**

```typescript
// app/api/chat/route.ts
export const runtime = "edge";

export async function POST(req: Request) {
  const { message } = await req.json();

  const response = await streamText({
    model: openai("gpt-4"),
    messages: [{ role: "user", content: message }],
  });

  // Store in background (works in edge runtime!)
  cortex.memory
    .rememberStream({
      memorySpaceId: "edge-chat",
      conversationId: "conv-" + Date.now(),
      userMessage: message,
      responseStream: response.textStream,
      userId: req.headers.get("x-user-id") || "anonymous",
      userName: "User",
    })
    .catch((error) => {
      console.error("Memory failed:", error);
    });

  // Return stream to client
  return response.toAIStreamResponse();
}
```

**Why use `rememberStream()`:**

- ✅ No manual buffering required
- ✅ Works with any stream type (ReadableStream, AsyncIterable)
- ✅ Edge runtime compatible
- ✅ Same features as `remember()` (embeddings, facts, graph sync)
- ✅ Returns the full response text
- ✅ Type safe with proper TypeScript inference

**When to use:**

- ✅ Vercel AI SDK integration
- ✅ OpenAI SDK with streaming
- ✅ LangChain streaming
- ✅ Edge Functions (Vercel, Cloudflare)
- ✅ Real-time chat applications
- ✅ Any streaming LLM response

**Errors:**

- `Error('Failed to consume response stream')` - Stream reading failed
- `Error('produced no content')` - Stream was empty or whitespace only
- Same as `remember()` for storage errors

**Performance:**

- Stream consumption: Minimal overhead (< 20ms for 10K chars)
- Storage: Same as `remember()` after stream completes
- Memory usage: ~16 bytes per character buffered

**See Also:**

- [Streaming Support Guide](../02-core-features/12-streaming-support.md) - Complete streaming documentation
- [Conversation History](../02-core-features/06-conversation-history.md#streaming-support) - Streaming in context
- [remember()](#remember) - Non-streaming variant

---

### get()

**Layer 3 Operation** - Get Vector memory with optional ACID conversation retrieval.

**Signature:**

```typescript
cortex.memory.get(
  memorySpaceId: string,
  memoryId: string,
  options?: GetOptions
): Promise<MemoryEntry | EnrichedMemory | null>
```

**Parameters:**

```typescript
interface GetOptions {
  includeConversation?: boolean; // Fetch ACID conversation too (default: false)
}
```

**Returns:**

```typescript
// Default (includeConversation: false)
MemoryEntry | null;

// With includeConversation: true
interface EnrichedMemory {
  memory: MemoryEntry; // Vector Layer 2 data
  conversation?: Conversation; // ACID Layer 1 data (if conversationRef exists)
  sourceMessages?: Message[]; // Specific messages that informed this memory
}
```

**Side Effects:**

- Increments `accessCount`
- Updates `lastAccessed` timestamp

**Example 1: Default (Vector only)**

```typescript
const memory = await cortex.memory.get("user-123-personal", "mem_abc123");

if (memory) {
  console.log(memory.content); // Vector content
  console.log(`Version: ${memory.version}`);
  console.log(`conversationRef:`, memory.conversationRef); // Reference only
}
```

**Example 2: With ACID conversation**

```typescript
const enriched = await cortex.memory.get("user-123-personal", "mem_abc123", {
  includeConversation: true,
});

if (enriched) {
  // Layer 2 (Vector)
  console.log("Vector content:", enriched.memory.content);
  console.log("Version:", enriched.memory.version);

  // Layer 1 (ACID) - automatically fetched
  if (enriched.conversation) {
    console.log("Conversation ID:", enriched.conversation.conversationId);
    console.log("Total messages:", enriched.conversation.messages.length);
    console.log("Source message:", enriched.sourceMessages[0].text);
  }
}
```

**Comparison:**

```typescript
// Layer 2 directly (fast, Vector only)
const vectorMem = await cortex.vector.get("user-123-personal", "mem_abc123");

// Layer 3 default (same as Layer 2)
const mem = await cortex.memory.get("user-123-personal", "mem_abc123");

// Layer 3 enriched (Vector + ACID)
const enriched = await cortex.memory.get("user-123-personal", "mem_abc123", {
  includeConversation: true,
});
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory

**See Also:**

- [Retrieving Memories](../02-core-features/01-agent-memory.md#retrieving-specific-memories)

---

### search()

**Layer 3 Operation** - Search Vector index with optional ACID enrichment.

**Signature:**

```typescript
cortex.memory.search(
  memorySpaceId: string,
  query: string,
  options?: SearchOptions
): Promise<MemoryEntry[] | EnrichedMemory[]>
```

**Parameters:**

```typescript
interface SearchOptions {
  // Layer enrichment
  enrichConversation?: boolean; // Fetch ACID conversations (default: false)

  // Semantic search
  embedding?: number[]; // Query vector (enables semantic search)

  // Filtering (universal filters)
  userId?: string;
  tags?: string[];
  tagMatch?: "any" | "all"; // Default: 'any'
  importance?: number | RangeQuery; // Number or { $gte, $lte, $eq }
  minImportance?: number; // Shorthand for { $gte: n }

  // Date filtering
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastAccessedBefore?: Date;
  lastAccessedAfter?: Date;

  // Access filtering
  accessCount?: number | RangeQuery;
  version?: number | RangeQuery;

  // Source filtering
  "source.type"?: "conversation" | "system" | "tool" | "a2a";

  // Metadata filtering
  metadata?: Record<string, any>;

  // Result options
  limit?: number; // Default: 20
  offset?: number; // Default: 0
  minScore?: number; // Similarity threshold (0-1)
  sortBy?: "score" | "createdAt" | "updatedAt" | "accessCount" | "importance";
  sortOrder?: "asc" | "desc"; // Default: 'desc'

  // Strategy
  strategy?: "auto" | "semantic" | "keyword" | "recent";
  boostImportance?: boolean; // Boost by importance score
  boostRecent?: boolean; // Boost recent memories
  boostPopular?: boolean; // Boost frequently accessed
}

interface RangeQuery {
  $gte?: number;
  $lte?: number;
  $eq?: number;
  $ne?: number;
  $gt?: number;
  $lt?: number;
}
```

**Returns:**

```typescript
interface SearchResult extends MemoryEntry {
  score: number; // Similarity score (0-1)
  strategy: "semantic" | "keyword" | "recent";
  highlights?: string[]; // Matched snippets
  explanation?: string; // Cloud Mode: why matched
}
```

**Example 1: Default (Vector only - fast)**

```typescript
const memories = await cortex.memory.search(
  "user-123-personal",
  "user preferences",
  {
    embedding: await embed("user preferences"),
    userId: "user-123",
    tags: ["preferences"],
    minImportance: 50,
    limit: 10,
  },
);

memories.forEach((m) => {
  console.log(`${m.content} (score: ${m.score})`);
  console.log(`  conversationRef: ${m.conversationRef?.conversationId}`); // Reference only
});
```

**Example 2: With ACID enrichment**

```typescript
const enriched = await cortex.memory.search(
  "user-123-personal",
  "user preferences",
  {
    embedding: await embed("user preferences"),
    userId: "user-123",
    enrichConversation: true, // Fetch ACID conversations too
  },
);

enriched.forEach((m) => {
  // Vector data
  console.log("Vector content:", m.memory.content);
  console.log("Score:", m.score);

  // ACID data (if conversationRef exists)
  if (m.conversation) {
    console.log(
      "Full conversation:",
      m.conversation.messages.length,
      "messages",
    );
    console.log("Source message:", m.sourceMessages[0].text);
  }
});
```

**Comparison:**

```typescript
// Layer 2 directly (Vector only)
const vectorResults = await cortex.vector.search(
  "user-123-personal",
  query,
  options,
);

// Layer 3 default (same as Layer 2, but can enrich)
const results = await cortex.memory.search("user-123-personal", query, options);

// Layer 3 enriched (Vector + ACID)
const enriched = await cortex.memory.search("user-123-personal", query, {
  ...options,
  enrichConversation: true,
});
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('INVALID_EMBEDDING_DIMENSION')` - Embedding dimension mismatch
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [Semantic Search Guide](../02-core-features/02-semantic-search.md)
- [Universal Filters](../02-core-features/01-agent-memory.md#core-api-principle-universal-filters)

---

### update()

Update a single memory by ID. Automatically creates new version.

**Signature:**

```typescript
cortex.memory.update(
  memorySpaceId: string,
  memoryId: string,
  updates: MemoryUpdate
): Promise<MemoryEntry>
```

**Parameters:**

```typescript
interface MemoryUpdate {
  content?: string;
  contentType?: "raw" | "summarized";
  embedding?: number[];
  conversationRef?: ConversationRef; // Update ACID link
  metadata?: Partial<MemoryMetadata>; // Merges with existing
}
```

**Returns:**

- `MemoryEntry` - Updated memory with incremented version

**Side Effects:**

- Creates new version (v2, v3, etc.)
- Preserves previous version in `previousVersions` (subject to retention)
- Updates `updatedAt` timestamp

**Example:**

```typescript
// Update password memory (creates version 2)
const updated = await cortex.memory.update("user-123-personal", "mem_abc123", {
  content: "The password is Green now",
  embedding: await embed("The password is Green now"),
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-999"], // New message that updated this
  },
  metadata: {
    importance: 100, // Can update importance
  },
});

console.log(updated.version); // 2
console.log(updated.content); // "The password is Green now"
console.log(updated.previousVersions[0].content); // "The password is Blue"
```

**Errors:**

- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory
- `CortexError('INVALID_UPDATE')` - Update data is invalid

**See Also:**

- [Updating Memories](../02-core-features/01-agent-memory.md#updating-memories)
- [Memory Versioning](../02-core-features/01-agent-memory.md#memory-versioning-automatic)

---

### updateMany()

Bulk update memories matching filters.

**Signature:**

```typescript
cortex.memory.updateMany(
  memorySpaceId: string,
  filters: UniversalFilters,
  updates: MemoryUpdate
): Promise<UpdateManyResult>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the memories
- `filters` (UniversalFilters) - Same filters as search()
- `updates` (MemoryUpdate) - Fields to update

**Returns:**

```typescript
interface UpdateManyResult {
  updated: number; // Count of updated memories
  memoryIds: string[]; // IDs of updated memories
  newVersions: number[]; // New version numbers
}
```

**Example:**

```typescript
// Boost importance of frequently accessed memories
const result = await cortex.memory.updateMany(
  "agent-1",
  {
    accessCount: { $gte: 10 },
  },
  {
    metadata: {
      importance: 75, // Bump to high (70-89 range)
    },
  },
);

console.log(`Updated ${result.updated} memories`);

// Add tag to all old memories
await cortex.memory.updateMany(
  "agent-1",
  {
    createdBefore: new Date("2025-01-01"),
  },
  {
    metadata: {
      tags: ["legacy"], // Appends to existing tags
    },
  },
);
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('NO_MEMORIES_MATCHED')` - No memories match filters

**See Also:**

- [Bulk Operations](../02-core-features/01-agent-memory.md#update-many-memories-bulk)

---

### delete()

**Layer 3 Operation** - Deletes from Vector only (preserves ACID).

**Signature:**

```typescript
cortex.memory.delete(
  memorySpaceId: string,
  memoryId: string
): Promise<DeletionResult>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the memory
- `memoryId` (string) - Memory to delete

**Returns:**

```typescript
interface DeletionResult {
  deleted: number; // Always 1 if successful
  memoryId: string;
  deletedFrom: "vector" | "both"; // What was deleted
  restorable: boolean; // True if ACID preserved
}
```

**Side Effects:**

- Deletes memory from **Vector layer only**
- **Preserves** ACID conversation (if conversationRef exists)
- Restorable from ACID if needed

**Example:**

```typescript
const result = await cortex.memory.delete("user-123-personal", "mem_abc123");

console.log(`Deleted from: ${result.deletedFrom}`); // 'vector'
console.log(`Restorable: ${result.restorable}`); // true (if had conversationRef)

// ACID conversation still accessible
if (result.restorable) {
  // Can retrieve original message from ACID
  const conversation = await cortex.conversations.get(conversationId);
}
```

**Comparison:**

```typescript
// Layer 2 directly (Vector only, explicit)
await cortex.vector.delete("user-123-personal", "mem_abc123");

// Layer 3 (same as Layer 2, but preserves ACID)
await cortex.memory.delete("user-123-personal", "mem_abc123");
// Vector deleted, ACID preserved

// Layer 3 forget() (delete from both - see below)
await cortex.memory.forget("user-123-personal", "mem_abc123", {
  deleteConversation: true,
});
// Vector AND ACID deleted
```

**Errors:**

- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory

**See Also:**

- [Deleting Memories](../02-core-features/01-agent-memory.md#deleting-memories)

---

### forget()

**Layer 3 Operation** - Delete from both Vector and ACID (complete removal).

**Signature:**

```typescript
cortex.memory.forget(
  memorySpaceId: string,
  memoryId: string,
  options?: ForgetOptions
): Promise<ForgetResult>
```

**Parameters:**

```typescript
interface ForgetOptions {
  deleteConversation?: boolean; // Delete ACID conversation too (default: false)
  deleteEntireConversation?: boolean; // Delete whole conversation vs just message (default: false)
}
```

**Returns:**

```typescript
interface ForgetResult {
  memoryDeleted: boolean; // Vector deletion
  conversationDeleted: boolean; // ACID deletion
  messagesDeleted: number; // ACID messages deleted
  restorable: boolean; // False
}
```

**Example:**

```typescript
// Delete memory + its source message from ACID
const result = await cortex.memory.forget("user-123-personal", "mem_abc123", {
  deleteConversation: true,
});

console.log(`Memory deleted from Vector: ${result.memoryDeleted}`);
console.log(`ACID messages deleted: ${result.messagesDeleted}`);
console.log(`Restorable: ${result.restorable}`); // false - gone from both layers

// WARNING: Use carefully! This is permanent across both layers.
```

**Warning:** `forget()` is destructive. Use `delete()` to preserve ACID audit trail.

**Use cases for `forget()`:**

- User requests complete data deletion (GDPR)
- Removing sensitive information completely
- Test data cleanup

**See Also:**

- [GDPR Compliance](../02-core-features/01-agent-memory.md#pattern-5-user-data-deletion-gdpr)

---

### deleteMany()

Bulk delete memories matching filters.

**Signature:**

```typescript
cortex.memory.deleteMany(
  memorySpaceId: string,
  filters: UniversalFilters,
  options?: DeleteOptions
): Promise<DeletionResult>
```

**Parameters:**

```typescript
interface DeleteOptions {
  dryRun?: boolean; // Preview without deleting
  requireConfirmation?: boolean; // Prompt if > threshold
  confirmationThreshold?: number; // Default: 10
}
```

**Returns:**

```typescript
interface DeletionResult {
  deleted: number; // Count deleted
  memoryIds: string[]; // IDs deleted
  restorable: boolean; // False
  affectedUsers?: string[]; // User IDs affected
  wouldDelete?: number; // For dryRun
  memories?: MemoryEntry[]; // For dryRun preview
}
```

**Example:**

```typescript
// Preview deletion
const preview = await cortex.memory.deleteMany(
  "agent-1",
  {
    importance: { $lte: 30 },
    accessCount: { $lte: 1 },
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  },
  { dryRun: true },
);

console.log(`Would delete ${preview.wouldDelete} memories`);

// Review and confirm
if (preview.wouldDelete < 100) {
  const result = await cortex.memory.deleteMany("user-123-personal", {
    importance: { $lte: 30 },
    accessCount: { $lte: 1 },
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  });

  console.log(`Deleted ${result.deleted} memories`);
  console.log(`Affected users: ${result.affectedUsers?.join(", ")}`);
}
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('DELETION_CANCELLED')` - User cancelled confirmation

**See Also:**

- [Bulk Deletion](../02-core-features/01-agent-memory.md#delete-by-user-gdpr-compliance)
- [Deletion Best Practices](../02-core-features/01-agent-memory.md#deletion-best-practices)

---

### count()

Count memories matching filters without retrieving them.

**Signature:**

```typescript
cortex.memory.count(
  memorySpaceId: string,
  filters?: UniversalFilters
): Promise<number>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space to count memories for
- `filters` (UniversalFilters, optional) - Same filters as search()

**Returns:**

- `number` - Count of matching memories

**Example:**

```typescript
// Total memories
const total = await cortex.memory.count("user-123-personal");

// Count critical memories
const critical = await cortex.memory.count("user-123-personal", {
  importance: { $gte: 90 },
});

// Count for specific user
const userCount = await cortex.memory.count("user-123-personal", {
  userId: "user-123",
});

// Complex filter count
const oldUnused = await cortex.memory.count("user-123-personal", {
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  accessCount: { $lte: 1 },
  importance: { $lte: 30 },
});

console.log(`Found ${oldUnused} old, unused, low-importance memories`);
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed

**See Also:**

- [Counting Memories](../02-core-features/01-agent-memory.md#counting-memories)

---

### list()

List memories with pagination and filtering.

**Signature:**

```typescript
cortex.memory.list(
  memorySpaceId: string,
  options?: ListOptions
): Promise<ListResult>
```

**Parameters:**

```typescript
interface ListOptions extends UniversalFilters {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  sortBy?: "createdAt" | "updatedAt" | "accessCount" | "importance";
  sortOrder?: "asc" | "desc"; // Default: 'desc'
}
```

**Returns:**

```typescript
interface ListResult {
  memories: MemoryEntry[];
  total: number; // Total count (for pagination)
  limit: number;
  offset: number;
  hasMore: boolean; // More results available
}
```

**Example:**

```typescript
// Paginated listing
const page1 = await cortex.memory.list("user-123-personal", {
  limit: 50,
  offset: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
});

console.log(`Showing ${page1.memories.length} of ${page1.total} memories`);
console.log(`Has more: ${page1.hasMore}`);

// Filtered listing
const userMemories = await cortex.memory.list("user-123-personal", {
  userId: "user-123",
  importance: { $gte: 50 },
  tags: ["important"],
  limit: 100,
});
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('INVALID_PAGINATION')` - Invalid limit/offset

**See Also:**

- [Listing Memories](../02-core-features/01-agent-memory.md#listing-memories)

---

### export()

Export memories to JSON or CSV format.

**Signature:**

```typescript
cortex.memory.export(
  memorySpaceId: string,
  options?: ExportOptions
): Promise<string | ExportData>
```

**Parameters:**

```typescript
interface ExportOptions extends UniversalFilters {
  format: "json" | "csv";
  outputPath?: string; // File path (returns string if provided)
  includeVersionHistory?: boolean; // Include previousVersions
  includeConversationContext?: boolean; // Fetch ACID conversations
}
```

**Returns:**

- `string` - File path if `outputPath` provided
- `ExportData` - Structured data if no `outputPath`

**Example:**

```typescript
// Export all memories for a user (GDPR)
const userData = await cortex.memory.export("user-123-personal", {
  userId: "user-123",
  format: "json",
  includeVersionHistory: true,
  includeConversationContext: true, // Include ACID conversations
});

// Export critical memories only
const criticalBackup = await cortex.memory.export("user-123-personal", {
  importance: { $gte: 90 },
  format: "json",
  outputPath: "backups/critical-memories.json",
});

console.log(`Exported to ${criticalBackup}`);
```

**Errors:**

- `CortexError('INVALID_FORMAT')` - Format not supported
- `CortexError('EXPORT_FAILED')` - File write error

**See Also:**

- [Exporting Memories](../02-core-features/01-agent-memory.md#exporting-memories)

---

### archive()

Soft delete (move to archive storage, recoverable).

**Signature:**

```typescript
cortex.memory.archive(
  memorySpaceId: string,
  filters: UniversalFilters
): Promise<ArchiveResult>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the memories
- `filters` (UniversalFilters) - Same filters as search()

**Returns:**

```typescript
interface ArchiveResult {
  archived: number;
  memoryIds: string[];
  restorable: boolean; // True
  archiveId: string; // Archive batch ID
}
```

**Example:**

```typescript
// Archive old low-importance memories
const result = await cortex.memory.archive("user-123-personal", {
  importance: { $lte: 20 },
  createdBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
});

console.log(`Archived ${result.archived} memories`);
console.log(`Archive ID: ${result.archiveId}`);

// Restore from archive if needed
const restored = await cortex.memory.restoreFromArchive(
  "agent-1",
  result.archiveId,
);
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('ARCHIVE_FAILED')` - Archive operation failed

**See Also:**

- [Soft Delete](../02-core-features/01-agent-memory.md#soft-delete-archive)

---

## Version Operations

### getVersion()

Retrieve a specific version of a memory.

**Signature:**

```typescript
cortex.memory.getVersion(
  memorySpaceId: string,
  memoryId: string,
  version: number
): Promise<MemoryVersion | null>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the memory
- `memoryId` (string) - Memory ID
- `version` (number) - Version number to retrieve

**Returns:**

- `MemoryVersion` - Specific version
- `null` - If version doesn't exist or was cleaned up by retention

**Example:**

```typescript
// Get version 1
const v1 = await cortex.memory.getVersion("user-123-personal", "mem_abc123", 1);

if (v1) {
  console.log(`v1 content: ${v1.content}`);
  console.log(`v1 timestamp: ${v1.timestamp}`);
  if (v1.conversationRef) {
    console.log(`v1 ACID source: ${v1.conversationRef.conversationId}`);
  }
} else {
  console.log(
    "Version 1 cleaned up by retention (but ACID source still available)",
  );
}
```

**Errors:**

- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('VERSION_NOT_FOUND')` - Version doesn't exist

**See Also:**

- [Accessing Historical Versions](../02-core-features/01-agent-memory.md#accessing-historical-versions)

---

### getHistory()

Get all versions of a memory.

**Signature:**

```typescript
cortex.memory.getHistory(
  memorySpaceId: string,
  memoryId: string
): Promise<MemoryVersion[]>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the memory
- `memoryId` (string) - Memory ID

**Returns:**

- `MemoryVersion[]` - Array of all versions (subject to retention)

**Example:**

```typescript
const history = await cortex.memory.getHistory(
  "user-123-personal",
  "mem_abc123",
);

console.log(`Memory has ${history.length} versions:`);
history.forEach((v) => {
  console.log(`v${v.version} (${v.timestamp}): ${v.content}`);
  if (v.conversationRef) {
    console.log(`  ACID: ${v.conversationRef.conversationId}`);
  }
});

// Note: With default retention=10, only last 10 versions returned
// But ACID conversations still have all source messages!
```

**Errors:**

- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist

**See Also:**

- [Version History](../02-core-features/01-agent-memory.md#memory-versioning-automatic)

---

### getAtTimestamp()

Get memory state at a specific point in time (temporal query).

**Signature:**

```typescript
cortex.memory.getAtTimestamp(
  memorySpaceId: string,
  memoryId: string,
  timestamp: Date
): Promise<MemoryVersion | null>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the memory
- `memoryId` (string) - Memory ID
- `timestamp` (Date) - Point in time to query

**Returns:**

- `MemoryVersion` - Version that was current at that time
- `null` - If memory didn't exist at that time or version cleaned up

**Example:**

```typescript
// What was the password on August 1st?
const historicalMemory = await cortex.memory.getAtTimestamp(
  "agent-1",
  "mem_password",
  new Date("2025-08-01T00:00:00Z"),
);

if (historicalMemory) {
  console.log(`Password on Aug 1: ${historicalMemory.content}`);

  // Can still get ACID source even if version cleaned up
  if (historicalMemory.conversationRef) {
    const conversation = await cortex.conversations.get(
      historicalMemory.conversationRef.conversationId,
    );
    const sourceMsg = conversation.messages.find((m) =>
      historicalMemory.conversationRef.messageIds.includes(m.id),
    );
    console.log(`Original message: ${sourceMsg.text}`);
  }
} else {
  console.log("Version not available (cleaned up), check ACID conversations");
}
```

**Errors:**

- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('INVALID_TIMESTAMP')` - Timestamp is invalid

**See Also:**

- [Temporal Queries](../02-core-features/01-agent-memory.md#temporal-queries)
- [Conflict Resolution](../02-core-features/01-agent-memory.md#conflict-resolution-example)

---

## Advanced Operations

### smartStore()

Intelligent store with automatic update detection (Cloud Mode helper).

**Signature:**

```typescript
cortex.memory.smartStore(
  memorySpaceId: string,
  entry: SmartStoreInput
): Promise<SmartStoreResult>
```

**Parameters:**

```typescript
interface SmartStoreInput extends MemoryInput {
  updateStrategy: "semantic" | "topic" | "key";
  similarityThreshold?: number; // Default: 0.85
  memoryKey?: string; // For 'key' strategy
  autoEmbed?: boolean; // Cloud Mode: auto-generate embedding
  autoSummarize?: boolean; // Cloud Mode: auto-summarize content
}
```

**Returns:**

```typescript
interface SmartStoreResult {
  action: "created" | "updated";
  id: string;
  version: number;
  oldContent?: string; // If updated
}
```

**Example:**

```typescript
const result = await cortex.memory.smartStore("user-123-personal", {
  content: "Actually I prefer to be called Alex",
  contentType: "raw",
  userId: "user-123",
  source: { type: "conversation", userId: "user-123", timestamp: new Date() },
  conversationRef: { conversationId: "conv-456", messageIds: ["msg-999"] },
  metadata: {
    importance: 70,
    tags: ["name", "preferences"],
  },
  updateStrategy: "semantic",
  similarityThreshold: 0.85,
  autoEmbed: true, // Cloud Mode
});

if (result.action === "updated") {
  console.log(`Updated existing memory (was: "${result.oldContent}")`);
} else {
  console.log(`Created new memory ${result.id}`);
}
```

**Errors:**

- `CortexError('STRATEGY_FAILED')` - Update detection failed
- `CortexError('CLOUD_MODE_REQUIRED')` - autoEmbed/autoSummarize requires Cloud Mode

**See Also:**

- [Smart Store Helper](../02-core-features/01-agent-memory.md#strategy-4-cortex-smart-store-helper)
- [Store vs Update](../02-core-features/01-agent-memory.md#store-vs-update-decision)

---

## Universal Filters Reference

All filter options that work across operations:

```typescript
interface UniversalFilters {
  // Identity
  userId?: string;

  // Tags
  tags?: string[];
  tagMatch?: "any" | "all";

  // Importance (0-100)
  importance?: number | RangeQuery;
  minImportance?: number; // Shorthand for { $gte }

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastAccessedBefore?: Date;
  lastAccessedAfter?: Date;

  // Access patterns
  accessCount?: number | RangeQuery;
  version?: number | RangeQuery;

  // Source
  "source.type"?: "conversation" | "system" | "tool" | "a2a";

  // Content
  contentType?: "raw" | "summarized";

  // ACID link
  "conversationRef.conversationId"?: string;

  // Metadata
  metadata?: Record<string, any>;

  // Results
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
```

**Operations supporting universal filters:**

- `search()`
- `count()`
- `list()`
- `updateMany()`
- `deleteMany()`
- `archive()`
- `export()`

**See Also:**

- [Universal Filters](../02-core-features/01-agent-memory.md#core-api-principle-universal-filters)

---

## Configuration

### Version Retention

Configure per-agent or globally:

```typescript
// Global configuration
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  defaultVersionRetention: 10, // Keep last 10 versions (default)
});

// Per-agent configuration
await cortex.agents.configure("audit-agent", {
  memoryVersionRetention: -1, // Unlimited (keep all versions)
});

await cortex.agents.configure("temp-agent", {
  memoryVersionRetention: 1, // Only current (no history)
});
```

**See Also:**

- [Version Retention](../02-core-features/01-agent-memory.md#version-retention-configuration)

---

## Graph-Lite Capabilities

Memory entries participate in the Cortex graph through references:

**Memory as Graph Node:**

- Each memory is a node in the implicit graph
- Connected to other entities via reference fields

**Edges (Relationships):**

- `conversationRef` → Links to Conversation (ACID source)
- `immutableRef` → Links to Fact or KB Article
- `userId` → Links to User
- `memorySpaceId` → Links to Memory Space
- `participantId` → Links to Participant (Hive Mode)
- `contextId` (in metadata) → Links to Context

**Graph Queries via Memory API:**

```typescript
// Find all memories in a workflow (via contextId edge)
const workflowMemories = await cortex.memory.search("user-123-personal", "*", {
  metadata: { contextId: "ctx-001" },
});

// Trace memory to source conversation (via conversationRef edge)
const enriched = await cortex.memory.get("user-123-personal", memoryId, {
  includeConversation: true, // ← Follow conversationRef edge
});

// Get all user's memories across agents (via userId edge)
const agents = await cortex.agents.list();
for (const agent of agents) {
  const userMemories = await cortex.memory.search(agent.id, "*", {
    userId: "user-123",
  });
}
```

**Performance:**

- 1-2 hop queries: 10-50ms (direct lookups)
- 3-5 hop queries: 50-200ms (sequential queries)

**Learn more:** [Graph-Lite Traversal Guide](../07-advanced-topics/01-graph-lite-traversal.md)

## Error Reference

All memory operation errors:

| Error Code                    | Description                  | Cause                                  |
| ----------------------------- | ---------------------------- | -------------------------------------- |
| `INVALID_MEMORYSPACE_ID`      | Memory space ID is invalid   | Empty or malformed memorySpaceId       |
| `INVALID_CONTENT`             | Content is invalid           | Empty content or > 100KB               |
| `INVALID_IMPORTANCE`          | Importance out of range      | Not in 0-100                           |
| `INVALID_EMBEDDING_DIMENSION` | Embedding dimension mismatch | Wrong vector size                      |
| `MEMORY_NOT_FOUND`            | Memory doesn't exist         | Invalid memoryId                       |
| `VERSION_NOT_FOUND`           | Version doesn't exist        | Cleaned up by retention                |
| `PERMISSION_DENIED`           | Access denied                | Agent doesn't own memory               |
| `INVALID_FILTERS`             | Filters malformed            | Bad filter syntax                      |
| `CONVEX_ERROR`                | Database error               | Convex operation failed                |
| `CLOUD_MODE_REQUIRED`         | Feature requires Cloud       | autoEmbed/autoSummarize in Direct mode |

**See Also:**

- [Error Handling Guide](./09-error-handling.md)

---

## Next Steps

- **[Agent Management API](./09-agent-management.md)** - Agent registry operations
- **[User Operations API](./04-user-operations.md)** - User profile API
- **[Context Operations API](./05-context-operations.md)** - Context chain API
- **[Types & Interfaces](./11-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
