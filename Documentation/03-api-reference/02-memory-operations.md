# Memory Operations API

> **Last Updated**: 2025-11-30

Complete API reference for memory operations across memory spaces.

> **Enhanced in v0.15.0**: `memory.rememberStream()` with progressive storage, streaming hooks, and comprehensive metrics
>
> **New in v0.15.0**: Enriched fact extraction with `enrichedContent` and `factCategory` for bullet-proof semantic search

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
cortex.graph.*           // Graph database integration
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
│  cortex.memory.remember() → L1a + L2 + L3 + graph (store)   │
│  cortex.memory.recall() → L2 + L3 + graph + merge/rank      │
│  cortex.memory.search() → L2 + optional enrichment          │
│  Full orchestration for conversation workflows              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓ (Sync)
┌─────────────────────────────────────────────────────────────┐
│        Graph Database (Optional - Neo4j/Memgraph)           │
├─────────────────────────────────────────────────────────────┤
│  Entities extracted from memories, facts, contexts          │
│  Enables multi-hop traversal and complex relationships      │
└─────────────────────────────────────────────────────────────┘
```

**Which layer/API to use:**

- 🚀 **`cortex.memory.*` (Layer 4 - START HERE)** - Recommended for most use cases
  - `remember()` / `recall()` - Full orchestration for storing and retrieving conversations
  - `search()` / `get()` - Quick retrieval with optional enrichment
- 💬 **`cortex.conversations.*`** (Layer 1a) - Direct ACID conversation access
- 🔢 **`cortex.vector.*`** (Layer 2) - Direct vector index control
- 🧠 **`cortex.facts.*`** (Layer 3) - Direct fact operations
- 📚 **`cortex.immutable.*`** (Layer 1b) - Shared knowledge (NO memorySpace - TRULY shared)
- 📊 **`cortex.mutable.*`** (Layer 1c) - Live mutable data (NO memorySpace - TRULY shared)
- 👤 **`cortex.users.*`** - User profiles (shared across ALL memory spaces + GDPR cascade)
- 🏛️ **`cortex.governance.*`** - Retention policies for all layers

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

### Layer 4: cortex.memory.\* (Convenience API)

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

**Automatic (Layer 4):**

```
┌─────────────────────────────────────────────┐
│ Layer 4: cortex.memory.remember()           │
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

### Convenience Flow (Layer 4 - recommended)

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

// Behind the scenes (Layer 4 does this):
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

// Option 2: Use Layer 4 (also works for non-conversations)
const memory = await cortex.memory.store("user-123-personal", {
  content: "Agent initialized successfully",
  source: { type: "system" },
  metadata: { importance: 30 },
});
// Layer 4 detects source.type='system' and skips ACID storage
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

| Operation                                       | Purpose                         | Returns                                             |
| ----------------------------------------------- | ------------------------------- | --------------------------------------------------- |
| `store(memorySpaceId, input, options?)`         | Store vector memory             | MemoryEntry                                         |
| `get(memorySpaceId, memoryId)`                  | Get vector memory               | MemoryEntry \| null                                 |
| `search(memorySpaceId, query, options?)`        | Search vector index             | MemoryEntry[]                                       |
| `update(memorySpaceId, memoryId, updates)`      | Update memory (creates version) | MemoryEntry                                         |
| `delete(memorySpaceId, memoryId, options?)`     | Delete from vector              | \{ deleted: boolean; memoryId: string \}              |
| `updateMany(filter, updates)`                   | Bulk update                     | \{ updated: number; memoryIds: string[] \}            |
| `deleteMany(filter)`                            | Bulk delete                     | \{ deleted: number; memoryIds: string[] \}            |
| `count(filter)`                                 | Count memories                  | number                                              |
| `list(filter)`                                  | List memories                   | MemoryEntry[]                                       |
| `export(options)`                               | Export vector memories          | \{ format: string; data: string; count: number; ... \}|
| `archive(memorySpaceId, memoryId)`              | Soft delete (single memory)     | \{ archived: boolean; memoryId: string; restorable: boolean \} |
| `restoreFromArchive(memorySpaceId, memoryId)`   | Restore from archive            | \{ restored: boolean; memoryId: string; memory: MemoryEntry \} |
| `getVersion(memorySpaceId, memoryId, version)`  | Get specific version            | MemoryVersion \| null                               |
| `getHistory(memorySpaceId, memoryId)`           | Get version history             | MemoryVersion[]                                     |
| `getAtTimestamp(memorySpaceId, memoryId, date)` | Temporal query                  | MemoryVersion \| null                               |

### Layer 4: cortex.memory.\* Operations (Convenience API)

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

| Operation              | Layer 2 (cortex.vector.\*)     | Layer 4 (cortex.memory.\*)                  |
| ---------------------- | ------------------------------ | ------------------------------------------- |
| `remember()`           | N/A                            | ✨ Unique - stores in both layers           |
| `get()`                | Vector only                    | Can include ACID (`includeConversation`)    |
| `search()`             | Vector only                    | Can enrich with ACID (`enrichConversation`) |
| `delete()`             | Vector only                    | Same (preserves ACID)                       |
| `forget()`             | N/A                            | ✨ Unique - deletes from both layers        |
| `store()`              | Manual conversationRef         | Smart - detects layer from source.type      |
| `update()`             | Direct                         | Delegates to Layer 2                        |
| `updateMany()`         | Direct (filter, updates)       | Delegates to Layer 2                        |
| `deleteMany()`         | Direct (filter)                | Delegates to Layer 2                        |
| `count()`              | Direct (filter)                | Delegates to Layer 2                        |
| `list()`               | Direct (filter)                | Delegates to Layer 2                        |
| `export()`             | Direct (options)               | Delegates to Layer 2                        |
| `archive()`            | Single memory                  | Delegates to Layer 2                        |
| `restoreFromArchive()` | Restore archived memory        | Delegates to Layer 2                        |
| `archive()`    | Direct                     | Delegates to Layer 2                        |
| Version ops    | Direct                     | Delegates to Layer 2                        |

**Layer 4 Unique Operations:**

- `remember()` - Dual-layer storage
- `forget()` - Dual-layer deletion
- `get()` with `includeConversation` - Cross-layer retrieval
- `search()` with `enrichConversation` - Cross-layer search

**Layer 4 Delegations:**

- Most operations are thin wrappers around `cortex.vector.*`
- Convenience for not having to remember namespaces
- Use `cortex.vector.*` directly if you prefer explicit control

---

## Core Operations (Layer 4: cortex.memory.\*)

> Note: Layer 4 operations are convenience wrappers that orchestrate across all layers. For direct control, use Layer 1 (`cortex.conversations.*`), Layer 2 (`cortex.vector.*`), and Layer 3 (`cortex.facts.*`) separately.

### remember()

**RECOMMENDED HELPER** - Full orchestration across all memory layers.

> **Enhanced in v0.17.0**: Full multi-layer orchestration with auto-registration of memory spaces, users, and agents. Use `skipLayers` for explicit opt-out.

**Signature:**

```typescript
cortex.memory.remember(
  params: RememberParams,
  options?: RememberOptions
): Promise<RememberResult>
```

**Orchestration Flow:**

When calling `remember()`, the following layers are orchestrated by default:

```
cortex.memory.remember({...})
        │
        ▼
┌───────────────────────────────────────────┐
│ 1. VALIDATION (Cannot be skipped)          │
│    ├─ memorySpaceId: if missing → 'default'│
│    │    + emit warning (non-breaking)      │
│    └─ userId OR agentId: REQUIRED          │
│       (ownership - at least one)           │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ 2. MEMORYSPACE (Cannot be skipped)         │
│    └─ Auto-register/upsert memorySpace    │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ 3. OWNER PROFILES (skip: 'users'/'agents')│
│    ├─ userId → auto-create user profile   │
│    └─ agentId → auto-register agent       │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ 4. CONVERSATION (skip: 'conversations')    │
│    └─ Layer 1a: Add messages to ACID      │
│    (default: ON)                           │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ 5. VECTOR MEMORY (skip: 'vector')          │
│    └─ Layer 2: Create searchable memory   │
│    (default: ON)                           │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ 6. FACTS (skip: 'facts')                   │
│    └─ Layer 3: Auto-extract if LLM config │
│    (default: ON if LLM configured)         │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ 7. GRAPH (skip: 'graph')                   │
│    └─ Sync all entities if adapter config │
│    (default: ON if graph configured)       │
└───────────────────────────────────────────┘
```

**Parameters:**

```typescript
// Layers that can be explicitly skipped
type SkippableLayer =
  | "users" // Don't auto-create user profile
  | "agents" // Don't auto-register agent
  | "conversations" // Don't store in ACID conversation layer
  | "vector" // Don't store in vector memory layer
  | "facts" // Don't auto-extract facts
  | "graph"; // Don't sync to graph database

interface RememberParams {
  // Memory Space (defaults to 'default' with warning if not provided)
  memorySpaceId?: string;

  // Conversation
  conversationId: string; // ACID conversation (auto-created if needed)
  userMessage: string;
  agentResponse: string;

  // Owner Attribution (at least one required)
  userId?: string; // For user-owned memories
  agentId?: string; // For agent-owned memories
  userName?: string; // Required when userId is provided

  // Hive Mode (optional)
  participantId?: string; // Tracks WHO stored the memory (distinct from ownership)

  // Explicit opt-out
  skipLayers?: SkippableLayer[];

  // Optional extraction
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;

  // Optional embedding
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Optional fact extraction (overrides LLM config)
  extractFacts?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<Array<{
    fact: string;
    factType:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "observation"
      | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
  }> | null>;

  // Cloud Mode options
  autoEmbed?: boolean; // Cloud Mode: auto-generate embeddings
  autoSummarize?: boolean; // Cloud Mode: auto-summarize content

  // Metadata
  importance?: number; // Auto-detect if not provided
  tags?: string[]; // Auto-extract if not provided
}

interface RememberOptions {
  syncToGraph?: boolean; // Sync to graph database (default: true if configured)
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
  facts: FactRecord[]; // Extracted facts (Layer 3)
}
```

**Examples:**

```typescript
// Full orchestration (default) - user-owned memory
const result = await cortex.memory.remember({
  memorySpaceId: "user-123-space",
  userId: "user-123",
  userName: "Alex",
  conversationId: "conv-456",
  userMessage: "Call me Alex",
  agentResponse: "I'll remember that, Alex!",
});
// → memorySpace registered (if needed)
// → user profile created (if needed)
// → conversation + vector stored
// → facts extracted (if LLM configured)
// → graph synced (if adapter configured)

// Agent-owned memory (no user involved)
await cortex.memory.remember({
  memorySpaceId: "system-space",
  agentId: "cleanup-agent",
  conversationId: "conv-789",
  userMessage: "System cleanup initiated",
  agentResponse: "Cleanup complete",
  skipLayers: ["users"], // No user to create
});

// Lightweight mode - skip facts and graph
await cortex.memory.remember({
  memorySpaceId: "quick-space",
  agentId: "quick-bot",
  conversationId: "conv-101",
  userMessage: "Quick question",
  agentResponse: "Quick answer",
  skipLayers: ["facts", "graph"], // Fast path
});

// With custom fact extraction
await cortex.memory.remember({
  memorySpaceId: "user-123-space",
  userId: "user-123",
  userName: "Alex",
  conversationId: "conv-456",
  userMessage: "My favorite color is blue",
  agentResponse: "I'll remember that blue is your favorite!",
  extractFacts: async (user, agent) => [
    {
      fact: "User prefers blue color",
      factType: "preference",
      subject: "user-123",
      predicate: "prefers_color",
      object: "blue",
      confidence: 95,
    },
  ],
});
```

**Validation Errors:**

```typescript
// Missing owner attribution
CortexError(
  "OWNER_REQUIRED",
  "Either userId or agentId must be provided for memory ownership",
);

// Missing userName when userId is provided
CortexError(
  "MISSING_REQUIRED_FIELD",
  "userName is required when userId is provided",
);
```

**Why use `remember()`:**

- ✅ Full multi-layer orchestration in one call
- ✅ Auto-registers memory spaces, users, and agents
- ✅ Automatic conversationRef linking
- ✅ Auto-extracts facts if LLM configured
- ✅ Auto-syncs to graph if configured
- ✅ Explicit opt-out via `skipLayers`
- ✅ Ensures consistency across all layers
- ✅ **This is the main way to store conversation memories**

**See Also:**

- [Helper Functions](../02-core-features/01-memory-spaces.md#helper-store-from-conversation-recommended)
- [Conversation Operations](./03-conversation-operations.md) - Managing ACID conversations
- [Memory Space Operations](./13-memory-space-operations.md) - Managing memory spaces
- [User Operations](./04-user-operations.md) - User profile management
- [Agent Management](./09-agent-management.md) - Agent registration

---

### recall()

**NEW in v0.23.0** - Unified orchestrated retrieval across all memory layers.

> **Design Philosophy**: `recall()` is the retrieval counterpart to `remember()`. It provides **total and complete orchestrated context retrieval** by default - batteries included.

**Signature:**

```typescript
cortex.memory.recall(
  params: RecallParams
): Promise<RecallResult>
```

**What it does:**

1. **Searches vector memories** (Layer 2) - Semantic search with optional embedding
2. **Searches facts directly** (Layer 3) - Facts as a primary source, not just enrichment
3. **Queries graph relationships** (Layer 4) - Discover related context via entity connections
4. **Merges, deduplicates, and ranks** results from all sources
5. **Returns unified context** ready for LLM injection

**Batteries Included Defaults:**

| Feature | Default | Description |
|---------|---------|-------------|
| Vector Search | Enabled | Searches Layer 2 vector memories |
| Facts Search | Enabled | Searches Layer 3 facts directly |
| Graph Expansion | Enabled (if configured) | Discovers related context via graph |
| LLM Context Formatting | Enabled | Generates ready-to-inject context string |
| Conversation Enrichment | Enabled | Includes ACID conversation data |
| Deduplication | Enabled | Removes duplicates across sources |
| Ranking | Enabled | Multi-signal scoring algorithm |

**Parameters:**

```typescript
interface RecallParams {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REQUIRED - Just these two for basic usage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memorySpaceId: string;  // Memory space to search
  query: string;          // Natural language query

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OPTIONAL - All have sensible defaults
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // Search enhancement
  embedding?: number[];   // Pre-computed embedding (recommended)
  userId?: string;        // Filter by user (common in H2A)

  // Source selection - ALL ENABLED BY DEFAULT
  // Only specify to DISABLE sources
  sources?: {
    vector?: boolean;     // Default: true
    facts?: boolean;      // Default: true
    graph?: boolean;      // Default: true (if graph configured)
  };

  // Graph expansion - ENABLED BY DEFAULT
  graphExpansion?: {
    enabled?: boolean;            // Default: true (if graph configured)
    maxDepth?: number;            // Default: 2
    relationshipTypes?: string[]; // Default: all types
    expandFromFacts?: boolean;    // Default: true
    expandFromMemories?: boolean; // Default: true
  };

  // Filtering
  minImportance?: number;   // Minimum importance (0-100)
  minConfidence?: number;   // Minimum fact confidence (0-100)
  tags?: string[];          // Filter by tags
  createdAfter?: Date;      // Only include after this date
  createdBefore?: Date;     // Only include before this date

  // Result options
  limit?: number;               // Default: 20
  includeConversation?: boolean; // Default: true
  formatForLLM?: boolean;       // Default: true
}
```

**Returns:**

```typescript
interface RecallResult {
  // Unified results (merged, deduped, ranked)
  items: RecallItem[];

  // Source breakdown
  sources: {
    vector: { count: number; items: MemoryEntry[] };
    facts: { count: number; items: FactRecord[] };
    graph: { count: number; expandedEntities: string[] };
  };

  // LLM-ready context (if formatForLLM: true)
  context?: string;

  // Metadata
  totalResults: number;
  queryTimeMs: number;
  graphExpansionApplied: boolean;
}

interface RecallItem {
  type: 'memory' | 'fact';
  id: string;
  content: string;
  score: number;  // Combined ranking score (0-1)
  source: 'vector' | 'facts' | 'graph-expanded';
  memory?: MemoryEntry;
  fact?: FactRecord;
  graphContext?: {
    connectedEntities: string[];
    relationshipPath?: string;
  };
  conversation?: Conversation;
  sourceMessages?: Message[];
}
```

**Example 1: Minimal Usage (Full Orchestration)**

```typescript
// Just two parameters - full orchestration by default
const result = await cortex.memory.recall({
  memorySpaceId: 'user-123-space',
  query: 'user preferences',
});

// Inject context directly into LLM prompt
const response = await llm.chat({
  messages: [
    { role: 'system', content: `You are a helpful assistant.\n\n${result.context}` },
    { role: 'user', content: userMessage },
  ],
});
```

**Example 2: With Semantic Search (Recommended)**

```typescript
const result = await cortex.memory.recall({
  memorySpaceId: 'user-123-space',
  query: 'user preferences',
  embedding: await embed('user preferences'), // Better relevance
  userId: 'user-123',                          // Scope to user
});

// result.context is LLM-ready
// result.items has full details if needed
// result.sources shows what came from where
```

**Example 3: Multi-Agent Context Sharing (A2A)**

```typescript
// Agent retrieving shared context from Hive space
const sharedContext = await cortex.memory.recall({
  memorySpaceId: 'team-hive-space',
  query: 'project requirements and deadlines',
  embedding: await embed('project requirements and deadlines'),
});

// Send context to collaborating agent
await cortex.a2a.send({
  from: 'planning-agent',
  to: 'execution-agent',
  message: `Here's the context: ${sharedContext.context}`,
});
```

**Example 4: Deep Graph Exploration**

```typescript
// When you need to discover relational connections
const result = await cortex.memory.recall({
  memorySpaceId: 'knowledge-base',
  query: 'who does Alice work with',
  embedding: await embed('who does Alice work with'),
  graphExpansion: {
    maxDepth: 3,  // Go deeper than default
    relationshipTypes: ['WORKS_AT', 'KNOWS', 'COLLABORATES_WITH'],
  },
  limit: 50,  // More results for comprehensive context
});

// See what the graph discovered
console.log('Discovered entities:', result.sources.graph.expandedEntities);
// ['Acme Corp', 'Bob', 'Engineering Team', 'Project Alpha']
```

**Example 5: Lightweight Mode (Opt-Out)**

```typescript
// When you need speed over completeness
const result = await cortex.memory.recall({
  memorySpaceId: 'user-space',
  query: 'quick lookup',
  sources: {
    vector: true,
    facts: false,      // Skip facts
    graph: false,      // Skip graph
  },
  formatForLLM: false, // Just get raw items
});
```

**Symmetric API Design:**

`remember()` and `recall()` form a symmetric pair - the two primary orchestration APIs:

| Aspect | remember() | recall() |
|--------|-----------|----------|
| Purpose | Store with full orchestration | Retrieve with full orchestration |
| Default | All layers enabled | All sources enabled |
| Opt-out | `skipLayers: ['facts', 'graph']` | `sources: { facts: false }` |
| Graph | Auto-syncs entities | Auto-expands via relationships |
| Output | `RememberResult` | `RecallResult` with LLM context |

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Cortex Memory Lifecycle                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   STORE (remember)                  RETRIEVE (recall)               │
│   ─────                              ────────                       │
│       │                                  │                          │
│       ▼                                  ▼                          │
│   ┌─────────┐                       ┌─────────┐                     │
│   │ Vector  │ ◄─────────────────────│ Vector  │                     │
│   │ (L2)    │                       │ Search  │                     │
│   └─────────┘                       └─────────┘                     │
│       │                                  │                          │
│       ▼                                  ▼                          │
│   ┌─────────┐                       ┌─────────┐                     │
│   │ Facts   │ ◄─────────────────────│ Facts   │                     │
│   │ (L3)    │                       │ Search  │                     │
│   └─────────┘                       └─────────┘                     │
│       │                                  │                          │
│       ▼                                  ▼                          │
│   ┌─────────┐                       ┌─────────┐                     │
│   │ Graph   │ ◄─────────────────────│ Graph   │                     │
│   │ Sync    │                       │ Expand  │                     │
│   └─────────┘                       └─────────┘                     │
│                                          │                          │
│                                          ▼                          │
│                                     ┌─────────┐                     │
│                                     │ Format  │                     │
│                                     │ for LLM │                     │
│                                     └─────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Ranking Algorithm:**

Results are ranked using a multi-signal scoring algorithm:

```typescript
score = (
  semanticScore * 0.35 +          // Vector similarity
  confidenceScore * 0.20 +        // Fact confidence (0-100 → 0-1)
  importanceScore * 0.15 +        // Importance (0-100 → 0-1)
  recencyScore * 0.15 +           // Time decay
  graphConnectivityScore * 0.15   // Graph centrality
);

// Boosts
if (connectedEntities.length > 3) score *= 1.2;  // 20% boost
if (memory.messageRole === 'user') score *= 1.1; // 10% boost
```

**LLM Context Format:**

When `formatForLLM: true` (default), the context string is structured as:

```markdown
## Relevant Context

### Known Facts
- User prefers dark mode (confidence: 95%)
- User works at Acme Corp (confidence: 88%)

### Conversation History
[user]: I prefer dark mode
[agent]: I'll remember that!
```

**When to Use `recall()` vs `search()`:**

| Use Case | Use `recall()` | Use `search()` |
|----------|---------------|----------------|
| AI Chatbot context | Yes | No |
| Multi-agent coordination | Yes | No |
| LLM prompt injection | Yes | No |
| Simple vector lookup | No | Yes |
| Direct Layer 2 access | No | Yes |
| Custom result processing | No | Yes |

**Errors:**

- `MemoryValidationError('MISSING_REQUIRED_FIELD')` - Missing memorySpaceId or query
- `MemoryValidationError('INVALID_EMBEDDING')` - Invalid embedding array
- `MemoryValidationError('INVALID_DATE_RANGE')` - createdAfter > createdBefore
- `MemoryValidationError('INVALID_GRAPH_DEPTH')` - maxDepth not in 1-5 range

**See Also:**

- [remember()](#remember) - The storage counterpart
- [Semantic Search Guide](../02-core-features/02-semantic-search.md)
- [Graph Operations](./15-graph-operations.md)
- [Facts Operations](./14-facts-operations.md)

---

### rememberStream()

**ENHANCED in v0.15.0** - Advanced streaming orchestration with progressive storage, real-time fact extraction, comprehensive metrics, and error recovery.

**Signature:**

```typescript
cortex.memory.rememberStream(
  params: RememberStreamParams,
  options?: StreamingOptions
): Promise<EnhancedRememberStreamResult>
```

**What it does:**

1. **Processes stream progressively** - Not just buffering, but real processing during streaming
2. **Progressive storage** - Optionally stores partial memories as content arrives
3. **Real-time fact extraction** - Extract facts incrementally during streaming
4. **Streaming hooks** - Monitor progress with `onChunk`, `onProgress`, `onError`, `onComplete` callbacks
5. **Comprehensive metrics** - Track latency, throughput, token usage, and costs
6. **Error recovery** - Resume interrupted streams with resume tokens
7. **Adaptive processing** - Auto-optimize based on stream characteristics
8. **Graph sync** - Progressively sync to graph databases (Neo4j/Memgraph)
9. **Complete feature parity** - All `remember()` features work in streaming mode

**Parameters:**

```typescript
interface RememberStreamParams {
  // Required
  memorySpaceId: string;
  conversationId: string;
  userMessage: string;
  responseStream: ReadableStream<string> | AsyncIterable<string>;
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

interface StreamingOptions {
  // Graph sync
  syncToGraph?: boolean;
  progressiveGraphSync?: boolean; // Sync during streaming
  graphSyncInterval?: number; // How often to sync (ms)

  // Progressive storage
  storePartialResponse?: boolean; // Store in-progress memories
  partialResponseInterval?: number; // Update interval (ms)

  // Progressive fact extraction
  progressiveFactExtraction?: boolean;
  factExtractionThreshold?: number; // Extract every N chars

  // Streaming hooks
  hooks?: {
    onChunk?: (event: ChunkEvent) => void | Promise<void>;
    onProgress?: (event: ProgressEvent) => void | Promise<void>;
    onError?: (error: StreamError) => void | Promise<void>;
    onComplete?: (event: StreamCompleteEvent) => void | Promise<void>;
  };

  // Error handling
  partialFailureHandling?:
    | "store-partial"
    | "rollback"
    | "retry"
    | "best-effort";
  maxRetries?: number;
  generateResumeToken?: boolean;
  streamTimeout?: number;

  // Advanced
  maxResponseLength?: number;
  enableAdaptiveProcessing?: boolean;
}
```

**Returns:**

```typescript
interface EnhancedRememberStreamResult {
  // Standard remember() result
  conversation: {
    messageIds: string[];
    conversationId: string;
  };
  memories: MemoryEntry[];
  facts: FactRecord[];
  fullResponse: string;

  // Stream metrics
  streamMetrics: {
    totalChunks: number;
    streamDurationMs: number;
    averageChunkSize: number;
    firstChunkLatency: number;
    totalBytesProcessed: number;
    chunksPerSecond: number;
    estimatedTokens: number;
    estimatedCost?: number;
  };

  // Progressive processing results (if enabled)
  progressiveProcessing?: {
    factsExtractedDuringStream: ProgressiveFact[];
    partialStorageHistory: PartialUpdate[];
    graphSyncEvents?: GraphSyncEvent[];
  };

  // Performance insights
  performance?: {
    bottlenecks: string[];
    recommendations: string[];
    costEstimate?: number;
  };

  // Error/recovery info
  errors?: StreamError[];
  recovered?: boolean;
  resumeToken?: string;
}
```

**Example 1: Vercel AI SDK**

```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const response = await streamText({
  model: openai("gpt-5-nano"),
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
console.log("Stream metrics:", result.streamMetrics);
// NEW: Access streaming metrics
// {
//   totalChunks: 5,
//   streamDurationMs: 432,
//   firstChunkLatency: 123,
//   estimatedTokens: 250,
//   estimatedCost: 0.015
// }
```

**Example 2: With Progressive Features**

```typescript
const result = await cortex.memory.rememberStream(
  {
    memorySpaceId: "ai-tutor",
    conversationId: "lesson-2",
    userMessage: "Explain quantum computing in detail",
    responseStream: llmStream,
    userId: "student-123",
    userName: "Alice",
    extractFacts: extractFactsCallback,
  },
  {
    // Progressive storage - save partial content during streaming
    storePartialResponse: true,
    partialResponseInterval: 3000, // Update every 3 seconds

    // Progressive fact extraction
    progressiveFactExtraction: true,
    factExtractionThreshold: 500, // Extract every 500 chars

    // Streaming hooks for real-time updates
    hooks: {
      onChunk: (event) => {
        console.log(`Chunk ${event.chunkNumber}: ${event.chunk}`);
        websocket.send({ type: "chunk", data: event.chunk });
      },
      onProgress: (event) => {
        console.log(`Progress: ${event.bytesProcessed} bytes`);
        updateProgressBar(event.bytesProcessed);
      },
      onComplete: (event) => {
        console.log(
          `Complete! ${event.totalChunks} chunks, ${event.durationMs}ms`,
        );
      },
    },

    // Error recovery
    partialFailureHandling: "store-partial",
    generateResumeToken: true,

    // Graph sync
    progressiveGraphSync: true,
    graphSyncInterval: 5000,
  },
);

// Access enhanced results
console.log("Stream metrics:", result.streamMetrics);
console.log(
  "Facts extracted during stream:",
  result.progressiveProcessing?.factsExtractedDuringStream,
);
console.log(
  "Performance recommendations:",
  result.performance?.recommendations,
);
```

**Example 3: OpenAI SDK (AsyncIterable)**

```typescript
import OpenAI from "openai";

const openai = new OpenAI();
const stream = await openai.chat.completions.create({
  model: "gpt-5-nano",
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

**Example 4: With Embeddings and Facts**

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

**Example 5: Error Recovery with Resume**

```typescript
try {
  const result = await cortex.memory.rememberStream(params, {
    partialFailureHandling: "store-partial",
    generateResumeToken: true,
    streamTimeout: 30000, // 30 second timeout
  });
} catch (error) {
  if (error instanceof ResumableStreamError) {
    // Stream was interrupted but partial data was saved
    console.log("Stream interrupted. Resume token:", error.resumeToken);

    // Later, resume the stream
    const resumed = await cortex.memory.rememberStream({
      ...params,
      resumeFrom: await validateResumeToken(error.resumeToken),
    });
  }
}
```

**Example 6: Edge Runtime (Vercel Edge Functions)**

```typescript
// app/api/chat/route.ts
export const runtime = "edge";

export async function POST(req: Request) {
  const { message } = await req.json();

  const response = await streamText({
    model: openai("gpt-5-nano"),
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

**Key Features (v0.15.0+):**

- ✅ **Progressive Storage** - Store partial memories during streaming (resumable)
- ✅ **Streaming Hooks** - Real-time callbacks for monitoring and UI updates
- ✅ **Comprehensive Metrics** - Track latency, throughput, tokens, costs
- ✅ **Progressive Facts** - Extract facts incrementally with deduplication
- ✅ **Error Recovery** - Resume interrupted streams with checkpoints
- ✅ **Graph Sync** - Progressively update Neo4j/Memgraph during streaming
- ✅ **Adaptive Processing** - Auto-optimize based on stream characteristics
- ✅ **Complete Parity** - All `remember()` features (embeddings, facts, graph sync)
- ✅ **Type Safe** - Full TypeScript support with comprehensive types

**When to Use:**

- ✅ Streaming LLM responses (OpenAI, Anthropic, Vercel AI SDK, etc.)
- ✅ Long-running agent responses (> 5 seconds)
- ✅ Real-time chat applications with live updates
- ✅ Edge runtime functions (Vercel, Cloudflare Workers)
- ✅ When you need resumability (long streams that might fail)
- ✅ When monitoring performance is critical
- ✅ When you want real-time fact extraction

**When NOT to Use:**

- ❌ Already have complete response (use `remember()` - simpler and faster)
- ❌ Very short responses (< 50 chars) where overhead isn't worth it

**Error Handling:**

- `Error('Failed to consume response stream')` - Stream reading failed
- `Error('produced no content')` - Stream was empty or whitespace only
- `ResumableStreamError` - Stream interrupted, includes resume token
- `Error('Stream timeout')` - Stream exceeded timeout limit
- `Error('Stream exceeded max length')` - Stream too long
- Standard `remember()` errors for final storage

**Performance:**

- **First Chunk Latency**: 6-10ms (excellent)
- **Overhead vs Buffering**: < 5% (minimal impact)
- **Memory Usage**: O(1) for unbounded streams (with rolling window)
- **Throughput**: Processes immediately, no accumulation delay
- **Graph Sync Latency**: < 50ms per update (both Neo4j and Memgraph)

**See Also:**

- [Streaming Support Guide](../02-core-features/12-streaming-support.md) - Complete streaming documentation
- [Conversation History](../02-core-features/06-conversation-history.md#streaming-support) - Streaming in context
- [remember()](#remember) - Non-streaming variant

---

### search()

**Layer 4 Operation** - Search Vector index with optional ACID enrichment.

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

  // Enriched fact boosting (v0.15.0+)
  queryCategory?: string; // Category to boost (e.g., "addressing_preference")
  // Facts with matching factCategory get +30% score boost
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

// Layer 4 default (same as Layer 2, but can enrich)
const results = await cortex.memory.search("user-123-personal", query, options);

// Layer 4 enriched (Vector + ACID)
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
- [Universal Filters](../02-core-features/01-memory-spaces.md#core-api-principle-universal-filters)

---

### get()

**Layer 4 Operation** - Get Vector memory with optional ACID conversation retrieval.

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

// Layer 4 default (same as Layer 2)
const mem = await cortex.memory.get("user-123-personal", "mem_abc123");

// Layer 4 enriched (Vector + ACID)
const enriched = await cortex.memory.get("user-123-personal", "mem_abc123", {
  includeConversation: true,
});
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory

**See Also:**

- [Retrieving Memories](../02-core-features/01-memory-spaces.md#retrieving-specific-memories)

---

### store()

**Layer 4 Operation** - Stores in Vector with optional fact extraction.

Store a new memory for an agent. Use this for non-conversation memories (system, tool). For conversation memories, prefer `remember()`.

**Signature:**

```typescript
cortex.memory.store(
  memorySpaceId: string,
  entry: MemoryInput,
  options?: { syncToGraph?: boolean }
): Promise<StoreMemoryResult>
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

  // Enrichment fields (v0.15.0+) - for bullet-proof retrieval
  enrichedContent?: string; // Concatenated searchable content for embedding
  factCategory?: string; // Category for filtering (e.g., "addressing_preference")
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

- [Agent Memory Guide](../02-core-features/01-memory-spaces.md#storing-memories)
- [Store vs Update Decision](../02-core-features/01-memory-spaces.md#store-vs-update-decision)

---

### update()

Update a single memory by ID. Automatically creates new version.

**Signature:**

```typescript
cortex.memory.update(
  memorySpaceId: string,
  memoryId: string,
  updates: MemoryUpdate,
  options?: { syncToGraph?: boolean }
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

- [Updating Memories](../02-core-features/01-memory-spaces.md#updating-memories)
- [Memory Versioning](../02-core-features/01-memory-spaces.md#memory-versioning-automatic)

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

- [Bulk Operations](../02-core-features/01-memory-spaces.md#update-many-memories-bulk)

---

### delete()

**Layer 4 Operation** - Deletes from Vector only (preserves ACID).

**Signature:**

```typescript
cortex.memory.delete(
  memorySpaceId: string,
  memoryId: string,
  options?: { syncToGraph?: boolean }
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

// Layer 4 (same as Layer 2, but preserves ACID)
await cortex.memory.delete("user-123-personal", "mem_abc123");
// Vector deleted, ACID preserved

// Layer 4 forget() (delete from both - see below)
await cortex.memory.forget("user-123-personal", "mem_abc123", {
  deleteConversation: true,
});
// Vector AND ACID deleted
```

**Errors:**

- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('PERMISSION_DENIED')` - Agent doesn't own this memory

**See Also:**

- [Deleting Memories](../02-core-features/01-memory-spaces.md#deleting-memories)

---

### forget()

**Layer 4 Operation** - Delete from both Vector and ACID (complete removal).

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

- [GDPR Compliance](../02-core-features/01-memory-spaces.md#pattern-5-user-data-deletion-gdpr)

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

- [Bulk Deletion](../02-core-features/01-memory-spaces.md#delete-by-user-gdpr-compliance)
- [Deletion Best Practices](../02-core-features/01-memory-spaces.md#deletion-best-practices)

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

- [Counting Memories](../02-core-features/01-memory-spaces.md#counting-memories)

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

- [Listing Memories](../02-core-features/01-memory-spaces.md#listing-memories)

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

- [Exporting Memories](../02-core-features/01-memory-spaces.md#exporting-memories)

---

### archive()

Soft delete a single memory (move to archive storage, recoverable).

**Signature:**

```typescript
cortex.memory.archive(
  memorySpaceId: string,
  memoryId: string
): Promise<ArchiveResult>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the memory
- `memoryId` (string) - Memory ID to archive

**Returns:**

```typescript
interface ArchiveResult {
  archived: boolean; // True if successfully archived
  memoryId: string; // ID of archived memory
  restorable: boolean; // True (can be restored)
  factsArchived: number; // Number of associated facts archived
  factIds: string[]; // IDs of archived facts
}
```

**Example:**

```typescript
// Archive a specific memory
const result = await cortex.memory.archive("user-123-personal", "mem_abc123");

console.log(`Archived: ${result.archived}`);
console.log(`Memory ID: ${result.memoryId}`);
console.log(`Restorable: ${result.restorable}`);

// Restore from archive if needed
const restored = await cortex.memory.restoreFromArchive(
  "user-123-personal",
  "mem_abc123",
);
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('ARCHIVE_FAILED')` - Archive operation failed

**See Also:**

- [Soft Delete](../02-core-features/01-memory-spaces.md#soft-delete-archive)

---

### restoreFromArchive()

Restore a previously archived memory back to active status.

**Signature:**

```typescript
cortex.memory.restoreFromArchive(
  memorySpaceId: string,
  memoryId: string
): Promise<RestoreResult>
```

**Parameters:**

- `memorySpaceId` (string) - Memory space that contains the archived memory
- `memoryId` (string) - ID of the archived memory to restore

**Returns:**

```typescript
interface RestoreResult {
  restored: boolean; // True if successfully restored
  memoryId: string; // ID of restored memory
  memory: MemoryEntry; // The restored memory entry
}
```

**Example:**

```typescript
// Restore a specific archived memory
const result = await cortex.memory.restoreFromArchive(
  "user-123-personal",
  "mem_abc123",
);

if (result.restored) {
  console.log(`Restored memory: ${result.memoryId}`);
  console.log(`Content: ${result.memory.content}`);
}
```

**Errors:**

- `CortexError('MEMORY_NOT_FOUND')` - Memory doesn't exist
- `CortexError('MEMORY_NOT_ARCHIVED')` - Memory is not in archived state
- `CortexError('PERMISSION_DENIED')` - Memory space doesn't own this memory

**See Also:**

- [archive()](#archive) - Archive memories (soft delete)
- [Soft Delete](../02-core-features/01-memory-spaces.md#soft-delete-archive)

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

- [Accessing Historical Versions](../02-core-features/01-memory-spaces.md#accessing-historical-versions)

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

- [Version History](../02-core-features/01-memory-spaces.md#memory-versioning-automatic)

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

- [Temporal Queries](../02-core-features/01-memory-spaces.md#temporal-queries)
- [Conflict Resolution](../02-core-features/01-memory-spaces.md#conflict-resolution-example)

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

- [Universal Filters](../02-core-features/01-memory-spaces.md#core-api-principle-universal-filters)

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

- [Version Retention](../02-core-features/01-memory-spaces.md#version-retention-configuration)

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

- [Error Handling Guide](./12-error-handling.md)

---

## Next Steps

- **[Agent Management API](./09-agent-management.md)** - Agent registry operations
- **[User Operations API](./04-user-operations.md)** - User profile API
- **[Context Operations API](./05-context-operations.md)** - Context chain API
- **[Graph Operations API](./15-graph-operations.md)** - Graph database integration
- **[Types & Interfaces](./11-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
