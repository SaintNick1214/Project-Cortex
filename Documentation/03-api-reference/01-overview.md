# API Reference Overview

> **Last Updated**: 2025-10-28

Welcome to the Cortex API Reference! This guide explains how to navigate the documentation and use Cortex effectively.

## What is Cortex?

Cortex is a **persistent memory system for AI agents** built on Convex. It provides:

- **Four-layer architecture** - ACID stores + Vector index + Facts store + Convenience API
- **Memory Space isolation** - Flexible boundaries (per user, team, or project)
- **Hive Mode** - Multiple tools share one memory space (zero duplication)
- **Infinite Context** - Never run out of context via retrieval
- **Automatic versioning** - Track how information changes over time
- **GDPR compliance** - Built-in cascade deletion (Cloud Mode)
- **Universal filters** - Same filters work across all operations
- **Embedding-agnostic** - Bring your own embeddings or use Cloud Mode

## Documentation Structure

The API Reference is organized by architectural layers:

### **Core Memory System (Start Here)**

- **[Memory Operations](./02-memory-operations.md)** - The main API you'll use
  - Layer 4 convenience (`cortex.memory.*`)
  - Overview of all layers
  - `remember()`, `rememberStream()`, `search()`, `get()`, `update()`, `delete()`
- **[Memory Space Operations](./13-memory-space-operations.md)** - Memory space management
  - Create and manage memory spaces
  - Hive Mode participant tracking
  - Cross-space access control
  - `register()`, `list()`, `archive()`, `delete()`
- **[Conversation Operations](./03-conversation-operations.md)** - Layer 1a (ACID)
  - Immutable conversation threads (memorySpace-scoped)
  - Source of truth for all messages
  - `create()`, `addMessage()`, `getHistory()`

### **User & Coordination**

- **[User Operations](./04-user-operations.md)** - User profiles + GDPR ✅
  - Shared user data across all memory spaces
  - GDPR cascade deletion by userId (SDK + Cloud Mode)
  - Version history and time-travel queries
- **[Agent Management](./09-agent-management.md)** - Agent registry + cleanup ✅
  - Optional metadata registration for discovery
  - Cascade deletion by participantId across all spaces
  - Statistics and analytics
- **[Context Operations](./05-context-operations.md)** - Workflow coordination ✅
  - Hierarchical task tracking
  - Multi-agent collaboration
  - Cross-memorySpace delegation
- **[A2A Communication](./06-a2a-communication.md)** - Inter-space messaging
  - Collaboration Mode (dual-write to separate spaces)
  - Hive Mode (single write within shared space)
  - Requires pub/sub (BYO or Cloud-managed)

### **Advanced Storage**

- **[Immutable Store](./07-immutable-store-api.md)** - Layer 1b
  - TRULY shared (no memorySpace), versioned, immutable data
  - KB articles, policies, audit logs
  - Shared across ALL memory spaces
- **[Mutable Store](./08-mutable-store-api.md)** - Layer 1c
  - TRULY shared (no memorySpace), mutable, current-value data
  - Inventory, config, counters
  - Shared across ALL memory spaces

### **Supporting APIs**

- **[Governance Policies](./10-governance-policies-api.md)** - Retention rules
- **[Graph Operations](./15-graph-operations.md)** - Graph database integration

### **Reference**

- **[Types & Interfaces](./11-types-interfaces.md)** - TypeScript definitions
- **[Error Handling](./12-error-handling.md)** - Error codes and debugging

---

## Quick Start

### 5-Minute Example

```typescript
import { Cortex } from "@cortex-platform/sdk";

// 1. Initialize Cortex with optional LLM for auto fact extraction
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  // Optional: Enable auto fact extraction
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// 2. Store user-agent exchange - Full orchestration in ONE call!
// remember() now auto-registers: memory space, user profile, conversation
const result = await cortex.memory.remember({
  memorySpaceId: "support-bot-space", // Auto-registered if not exists
  userId: "user-123",                 // Auto-creates user profile
  userName: "Alex",                   // Required with userId
  conversationId: "conv-001",         // Auto-created if not exists
  userMessage: "My password is Blue123",
  agentResponse: "I'll remember that securely!",
  userId: "user-123",
  userName: "Alex Johnson",
  importance: 100,
  tags: ["password", "security"],
});

// 4. Search memories (semantic)
const memories = await cortex.memory.search(
  "support-bot-space",
  "user password",
  {
    embedding: await embed("user password"),
    userId: "user-123",
    minImportance: 70,
  },
);

console.log("Found:", memories[0].content); // "My password is Blue123"

// 5. User profile (shared across all memory spaces)
await cortex.users.update("user-123", {
  data: {
    displayName: "Alex Johnson",
    preferences: { theme: "dark" },
  },
});

// That's it! Your agent has persistent memory.
```

---

## Key Concepts

### The Four-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│   Layer 1: ACID Stores (Source of Truth)                    │
│   ├── 1a: Conversations (memorySpace-scoped)                │
│   ├── 1b: Immutable (TRULY shared - KB, policies)           │
│   └── 1c: Mutable (TRULY shared - config, inventory)        │
└──────────────┬──────────────────────────────────────────────┘
               │ conversationRef, immutableRef, mutableRef
               ↓
┌─────────────────────────────────────────────────────────────┐
│   Layer 2: Vector Index (memorySpace-scoped, searchable)    │
│   Embedded memories for semantic search                     │
│   References Layer 1                                        │
└──────────────┬──────────────────────────────────────────────┘
               │ factsRef
               ↓
┌─────────────────────────────────────────────────────────────┐
│   Layer 3: Facts Store (memorySpace-scoped, versioned) ✨   │
│   LLM-extracted facts, 60-90% token savings                 │
│   cortex.facts.*                                            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────────────┐
│   Layer 4: Convenience APIs (wrapper over L1-3)             │
│   Primary developer interface                               │
│   cortex.memory.*                                           │
└─────────────────────────────────────────────────────────────┘
```

**Most developers use Layer 4** (`cortex.memory.*`) - it handles Layers 1, 2, and 3 automatically.

### Universal Filters

**Key Design Principle:** The same filters work across ALL operations.

```typescript
// Define filters once
const filters = {
  userId: "user-123",
  tags: ["preferences"],
  minImportance: 50,
  createdAfter: new Date("2025-10-01"),
};

// Use everywhere
await cortex.memory.search(memorySpaceId, query, filters);
await cortex.memory.count(memorySpaceId, filters);
await cortex.memory.list(memorySpaceId, filters);
await cortex.memory.updateMany(memorySpaceId, filters, updates);
await cortex.memory.deleteMany(memorySpaceId, filters);
await cortex.memory.export(memorySpaceId, filters);
```

**Supported Filters:**

- `userId`, `tags`, `importance`, `createdBefore/After`
- `accessCount`, `version`, `source.type`
- Any `metadata.*` field

### Automatic Versioning

Updates don't overwrite - they create new versions:

```typescript
// v1
await cortex.memory.store('user-123-personal', {
  content: 'Password is Blue',
  ...
});

// v2 (v1 preserved in history)
await cortex.memory.update('user-123-personal', memoryId, {
  content: 'Password is Red',
});

// Access history
const memory = await cortex.memory.get('user-123-personal', memoryId);
console.log(memory.version); // 2
console.log(memory.previousVersions[0].content); // "Password is Blue"
```

**Retention:** Default 10 versions (configurable per agent)

### GDPR Cascade Deletion

> **Cloud Mode Only**: Automatic cascade requires Cortex Cloud

One call deletes from ALL stores with `userId`:

```typescript
// Cloud Mode: One-click GDPR compliance
await cortex.users.delete("user-123", { cascade: true });

// Automatically deletes from:
// ✅ Conversations (Layer 1a) across ALL memory spaces
// ✅ Immutable records (Layer 1b)
// ✅ Mutable keys (Layer 1c)
// ✅ Vector memories (Layer 2) across ALL memory spaces
// ✅ Facts (Layer 3) across ALL memory spaces
```

**Direct Mode:** Manual deletion from each store (see User Operations API).

---

## Common Patterns

### Pattern 1: Simple Chatbot (Hive Mode)

```typescript
// User sends message - use shared memory space
const memorySpaceId = `user-${req.user.id}-personal`; // Hive space

const conversation = await cortex.conversations.getOrCreate({
  type: "user-agent",
  memorySpaceId,
  participants: { userId: req.user.id, participantId: "chatbot" },
});

// Store exchange
await cortex.memory.remember({
  memorySpaceId,
  participantId: "chatbot", // Track who stored it
  conversationId: conversation.conversationId,
  userMessage: req.body.message,
  agentResponse: response,
  userId: req.user.id,
  userName: req.user.name,
});

// Search for context (infinite context pattern)
const context = await cortex.memory.search(memorySpaceId, req.body.message, {
  embedding: await embed(req.body.message),
  userId: req.user.id,
  limit: 10, // Top 10 most relevant from ALL history
});
```

### Pattern 2: Multi-Agent Workflow (Collaboration Mode)

```typescript
// Supervisor agent creates context in its own space
const context = await cortex.contexts.create({
  purpose: "Process refund request",
  memorySpaceId: "supervisor-agent-space", // Separate space
  userId: "user-123",
});

// Delegate via A2A (dual-write to both spaces)
await cortex.a2a.send({
  from: "supervisor-agent",
  to: "finance-agent",
  message: "Approve $500 refund",
  userId: "user-123",
  contextId: context.id,
  importance: 85,
});
// Stored in BOTH supervisor-agent-space AND finance-agent-space

// Finance agent accesses context (cross-space via context chain)
const ctx = await cortex.contexts.get(context.id, {
  requestingSpace: "finance-agent-space", // Cross-space access
});
```

### Pattern 3: Knowledge Base

```typescript
// Store KB article (shared, versioned)
await cortex.immutable.store({
  type: "kb-article",
  id: "refund-policy",
  data: {
    title: "Refund Policy",
    content: "Refunds available within 30 days...",
  },
  metadata: {
    importance: 90,
    tags: ["policy", "refunds"],
  },
});

// Index for search (optional) - in a memory space
await cortex.vector.store("support-bot-space", {
  content: "Refund Policy: Refunds available within 30 days...",
  immutableRef: {
    type: "kb-article",
    id: "refund-policy",
  },
  metadata: { importance: 90, tags: ["policy"] },
});

// Search within memory space
const results = await cortex.memory.search(
  "support-bot-space",
  "refund policy",
);
```

### Pattern 4: Live Inventory

```typescript
// Set inventory (mutable, no versioning)
await cortex.mutable.set("inventory", "widget-qty", 100);

// Customer orders (atomic decrement)
await cortex.mutable.update("inventory", "widget-qty", (qty) => {
  if (qty < 10) throw new Error("Out of stock");
  return qty - 10;
});

// Check availability
const qty = await cortex.mutable.get("inventory", "widget-qty");
console.log(`${qty} available`);
```

### Pattern 5: Fact-Based Knowledge (Infinite Context)

```typescript
// Extract and store facts (60-90% token savings for infinite context)
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  participantId: "personal-assistant",
  conversationId: "conv-123",
  userMessage: "I work at Acme Corp in San Francisco as a senior engineer",
  agentResponse: "Thanks for sharing!",
  userId: "user-123",
  userName: "Alice",
  extractFacts: true, // Extract facts (Layer 3)
  storeRaw: true, // Also keep raw (Layer 1a, hybrid approach)
});

// Facts extracted and stored in Layer 3:
// 1. "User works at Acme Corp"
// 2. "User located in San Francisco"
// 3. "User's role: Senior Engineer"

// Search facts (fast, precise, unlimited history)
const facts = await cortex.memory.search(
  "user-123-personal",
  "user employment",
  {
    userId: "user-123",
    contentType: "fact", // Only facts from Layer 3
    limit: 5,
  },
);
// Retrieves from ALL past conversations (infinite context!)
```

### Pattern 6: Cross-Application Memory (MCP)

```typescript
// Run MCP server
// $ cortex-mcp-server --convex-url=$CONVEX_URL

// Now Cursor, Claude Desktop, etc. all share memory

// In Cursor: "I prefer TypeScript"
// → Stored via MCP

// In Claude: "What language does user prefer?"
// → Claude queries MCP
// → Retrieves "User prefers TypeScript"
// → Personalizes response ✅

// Your memory follows you across all AI tools!
```

### Pattern 7: Graph Traversal (Advanced)

```typescript
// Graph-Lite (built-in): Context hierarchy
const chain = await cortex.contexts.get(contextId, {
  includeChain: true, // Multi-hop graph walk
});

console.log("Ancestors:", chain.ancestors.length); // Walk up
console.log("Descendants:", chain.descendants.length); // Walk down

// Native Graph DB (if integrated): Complex queries
const related = await cortex.graph.traverse({
  start: { type: "user", id: "user-123" },
  relationships: ["CREATED", "TRIGGERED", "HANDLED_BY"],
  maxDepth: 10,
});

console.log("All entities user touched:", related);
```

---

## API Conventions

### Naming Patterns

- **Operations**: Verb-based (`create`, `get`, `update`, `delete`, `search`)
- **Namespaces**: Plural (`conversations`, `users`, `contexts`, `agents`)
- **Options**: `*Options` suffix (`SearchOptions`, `DeleteOptions`)
- **Results**: `*Result` suffix (`RememberResult`, `DeleteResult`)
- **Filters**: `*Filters` suffix (`UniversalFilters`, `UserFilters`)

### Return Values

- **Single item**: `Entity | null`
- **Multiple items**: `Entity[]`
- **With pagination**: `{ items: Entity[], total: number, hasMore: boolean }`
- **Operations**: `*Result` interface with details

### Async/Await

All Cortex operations are async:

```typescript
// ✅ Always use await
const memory = await cortex.memory.get("agent-1", memoryId);

// ❌ Don't forget await
const memory = cortex.memory.get("agent-1", memoryId); // Returns Promise!
```

### Error Handling

All errors are catchable with type information:

```typescript
try {
  await cortex.memory.store("agent-1", data);
} catch (error) {
  if (error instanceof CortexError) {
    console.log(`Error: ${error.code}`);
    // Type-safe error handling
  }
}
```

---

## Direct Mode vs Cloud Mode

### Direct Mode (Free, Open Source)

**What you get:**

- ✅ Full storage APIs (all layers)
- ✅ All memory operations
- ✅ Universal filters
- ✅ Automatic versioning
- ✅ Complete flexibility

**What you provide:**

- Your Convex instance
- Your embeddings (OpenAI, Cohere, local)
- Agent execution infrastructure
- Pub/sub for A2A (optional)

**Example:**

```typescript
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,

  // Optional: LLM config for auto fact extraction
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },

  // Optional: Graph database integration
  graph: {
    adapter: graphAdapter,
    autoSync: true,
  },
});

// Full orchestration with remember() - auto-registers entities
await cortex.memory.remember({
  memorySpaceId: 'user-123-space', // Auto-registered if not exists
  userId: 'user-123',              // Auto-creates user profile
  userName: 'Alex',
  conversationId: 'conv-456',
  userMessage: 'User prefers dark mode',
  agentResponse: "I'll remember that preference!",
  // → Facts auto-extracted if LLM configured
  // → Graph synced if adapter configured
});
```

### Cloud Mode (Managed, Premium)

**Additional features:**

- ✅ **GDPR cascade** - One-click deletion across all stores
- ✅ **Auto-embeddings** - No API keys needed
- ✅ **Managed pub/sub** - Real-time A2A without infrastructure
- ✅ **Smart Store AI** - Automatic update detection
- ✅ **Analytics dashboard** - Usage insights
- ✅ **Governance policies** - Automatic retention rules

**Example:**

```typescript
const cortex = new Cortex({
  mode: 'cloud',
  apiKey: process.env.CORTEX_CLOUD_KEY,
});

// Auto-embeddings (Cloud handles it)
await cortex.memory.store('agent-1', {
  content: 'User prefers dark mode',
  autoEmbed: true,  // ← Cloud Mode generates embedding
  ...
});

// GDPR cascade (Cloud only)
await cortex.users.delete('user-123', { cascade: true });
// Deletes from ALL stores automatically ✅
```

---

## Navigation Guide

### By Use Case

**I want to...**

**Store conversation messages:**
→ [Memory Operations](./02-memory-operations.md#remember) - `cortex.memory.remember()`

**Search agent memories:**
→ [Memory Operations](./02-memory-operations.md#search) - `cortex.memory.search()`

**Manage user profiles:**
→ [User Operations](./04-user-operations.md) - `cortex.users.*`

**Delete user data (GDPR):**
→ [User Operations](./04-user-operations.md#delete) - `cortex.users.delete({ cascade: true })`

**Track multi-agent workflows:**
→ [Context Operations](./05-context-operations.md) - `cortex.contexts.*`

**Send agent-to-agent messages:**
→ [A2A Communication](./06-a2a-communication.md) - `cortex.a2a.send()`

**Store shared knowledge:**
→ [Immutable Store](./07-immutable-store-api.md) - `cortex.immutable.store()`

**Store live data (inventory, config):**
→ [Mutable Store](./08-mutable-store-api.md) - `cortex.mutable.set()`

**Set retention policies:**
→ [Governance Policies](./10-governance-policies-api.md) - `cortex.governance.*`

**See all TypeScript types:**
→ [Types & Interfaces](./11-types-interfaces.md)

**Debug an error:**
→ [Error Handling](./12-error-handling.md)

### By Layer

**Layer 1a (ACID Conversations):**
→ [Conversation Operations](./03-conversation-operations.md)

**Layer 1b (Immutable Store):**
→ [Immutable Store](./07-immutable-store-api.md)

**Layer 1c (Mutable Store):**
→ [Mutable Store](./08-mutable-store-api.md)

**Layer 2 (Vector Index):**
→ [Memory Operations](./02-memory-operations.md#layer-2-cortexvector-operations)

**Layer 3 (Convenience):**
→ [Memory Operations](./02-memory-operations.md#layer-3-cortexmemory-operations-dual-layer)

---

## Core Principles

### 1. Layered Architecture

Cortex separates **storage** (immutable source) from **search** (optimized index):

- **Layer 1**: ACID stores (conversations, immutable, mutable) - Never lose data
- **Layer 2**: Vector index - Fast searchable, versioned, retention rules
- **Layer 3**: Memory API - Convenience wrapper over Layers 1+2

**Benefits:**

- Retention on Vector doesn't lose ACID source
- Can always retrieve full context
- Fast search + complete audit trail

### 2. References Over Duplication

Data is linked, not duplicated:

```typescript
// Vector memory references ACID conversation
{
  id: 'mem-123',
  content: 'User password is Blue',
  conversationRef: {
    conversationId: 'conv-456',
    messageIds: ['msg-001'],  // ← Link to source
  }
}

// Can always get full context
const conversation = await cortex.conversations.get('conv-456');
const originalMessage = conversation.messages.find(m => m.id === 'msg-001');
```

### 3. Importance Scale (0-100)

Granular importance for filtering and retention:

- **90-100**: Critical (passwords, security)
- **70-89**: High (user preferences, decisions)
- **40-69**: Medium (conversation context) - default: 50
- **10-39**: Low (casual observations)
- **0-9**: Trivial (debug logs)

```typescript
await cortex.memory.store("agent-1", {
  content: "System password is XYZ",
  metadata: { importance: 100 }, // Critical
});

// Search only important
const important = await cortex.memory.search("agent-1", query, {
  minImportance: 70,
});
```

### 4. Optional userId for GDPR

All stores support optional `userId` field:

```typescript
// With userId (GDPR-enabled)
await cortex.conversations.addMessage('conv-123', {
  userId: 'user-123',  // ← Links to user
  ...
});

await cortex.immutable.store({
  type: 'feedback',
  userId: 'user-123',  // ← GDPR cascade target
  ...
});

// GDPR cascade finds and deletes all
await cortex.users.delete('user-123', { cascade: true });
```

### 5. Automatic Versioning

Updates create new versions, not overwrites:

```typescript
// Every update preserves history
await cortex.memory.update("agent-1", memoryId, { content: "New value" });

// Previous version still accessible
const history = await cortex.memory.getHistory("agent-1", memoryId);
```

---

## Common Operations Cheat Sheet

### Memory Operations

```typescript
// Store conversation (ACID + Vector)
await cortex.memory.remember({
  memorySpaceId,
  participantId, // Optional: Hive Mode tracking
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
});

// Store system memory (Vector only)
await cortex.vector.store(memorySpaceId, {
  content,
  source: { type: "system" },
  metadata,
});

// Search
await cortex.memory.search(memorySpaceId, query, {
  embedding,
  userId,
  minImportance,
  limit,
  participantId, // Optional: Filter by participant
});

// Get
await cortex.memory.get(memorySpaceId, memoryId, { includeConversation: true });

// Update
await cortex.memory.update(memorySpaceId, memoryId, { content, metadata });

// Delete (preserves ACID)
await cortex.memory.delete(memorySpaceId, memoryId);

// Count
await cortex.memory.count(memorySpaceId, filters);

// List
await cortex.memory.list(memorySpaceId, { limit, offset, sortBy });

// Export
await cortex.memory.export(memorySpaceId, { userId, format: "json" });
```

### User Operations

```typescript
// Create/update
await cortex.users.update(userId, {
  data: { displayName, email, preferences },
});

// Get
await cortex.users.get(userId);

// Delete (Cloud Mode - cascade across all stores)
await cortex.users.delete(userId, { cascade: true });

// Search
await cortex.users.search({ data: { tier: "pro" } });

// Count
await cortex.users.count({ createdAfter: new Date("2025-01-01") });
```

### Context Operations

```typescript
// Create workflow
const ctx = await cortex.contexts.create({
  purpose,
  memorySpaceId, // Which memory space
  userId,
  parentId, // Cross-space parent allowed
  data,
});

// Get with chain (supports cross-space traversal)
await cortex.contexts.get(contextId, {
  includeChain: true,
  requestingSpace: memorySpaceId, // For cross-space access
});

// Update status
await cortex.contexts.update(contextId, { status: "completed", data });

// Delete with children
await cortex.contexts.delete(contextId, { cascadeChildren: true });

// Search
await cortex.contexts.search({
  memorySpaceId,
  status: "active",
  data: { importance: { $gte: 80 } },
});
```

### A2A Communication

```typescript
// Send message
await cortex.a2a.send({ from, to, message, importance, userId, contextId });

// Request-response (requires pub/sub)
const response = await cortex.a2a.request({ from, to, message, timeout });

// Broadcast
await cortex.a2a.broadcast({ from, to: [agent1, agent2, agent3], message });

// Get conversation
await cortex.a2a.getConversation(agent1, agent2, {
  since,
  minImportance,
  tags,
});
```

### Immutable Store

```typescript
// Store versioned data
await cortex.immutable.store({ type, id, data, userId, metadata });

// Get current version
await cortex.immutable.get(type, id);

// Get specific version
await cortex.immutable.getVersion(type, id, version);

// Get history
await cortex.immutable.getHistory(type, id);

// Purge
await cortex.immutable.purge(type, id);
```

### Mutable Store

```typescript
// Set value
await cortex.mutable.set(namespace, key, value, userId);

// Get value
await cortex.mutable.get(namespace, key);

// Atomic update
await cortex.mutable.update(namespace, key, (current) => current + 1);

// Transaction
await cortex.mutable.transaction(async (tx) => {
  tx.update("inventory", "product-a", (qty) => qty - 1);
  tx.update("counters", "sales", (n) => n + 1);
});

// Delete
await cortex.mutable.delete(namespace, key);
```

---

## Best Practices

### 1. Start with Layer 4

Use `cortex.memory.*` for most operations:

```typescript
// ✅ Recommended: Layer 4 (handles L1a + L2 + L3)
await cortex.memory.remember({ ... });

// ⚠️ Advanced: Manual Layer 1 + Layer 2 + Layer 3
const msg = await cortex.conversations.addMessage(...);
await cortex.vector.store(...);
await cortex.facts.store(...);
```

### 2. Always Link to ACID

Link Vector memories to their source:

```typescript
// ✅ Good: With conversationRef
await cortex.vector.store('user-123-personal', {
  content: 'User prefers dark mode',
  conversationRef: {
    conversationId: 'conv-123',
    messageIds: ['msg-456'],
  },
  ...
});

// ⚠️ Only omit for non-conversation sources
```

### 3. Use Universal Filters

Define filters once, reuse everywhere:

```typescript
const oldDebugLogs = {
  tags: ["debug"],
  importance: { $lte: 10 },
  createdBefore: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
};

// Preview
const count = await cortex.memory.count("user-123-personal", oldDebugLogs);

// Export
await cortex.memory.export("user-123-personal", {
  ...oldDebugLogs,
  format: "json",
});

// Delete
await cortex.memory.deleteMany("user-123-personal", oldDebugLogs);
```

### 4. Handle Errors

Always catch and handle errors:

```typescript
try {
  await cortex.memory.store("user-123-personal", data);
} catch (error) {
  if (error instanceof CortexError) {
    console.error(`Cortex error: ${error.code}`);
    // Handle specific error codes
  }
}
```

### 5. Set userId for GDPR

Link user-related data for compliance:

```typescript
// ✅ With userId (GDPR-enabled)
await cortex.memory.store('user-123-personal', {
  userId: 'user-123',  // ← Critical for GDPR
  ...
});

await cortex.immutable.store({
  type: 'feedback',
  userId: 'user-123',  // ← Enables cascade deletion
  ...
});
```

---

## Quick Reference

### Import

```typescript
import { Cortex } from "@cortex-platform/sdk";
import type { MemoryEntry, UserProfile, Context } from "@cortex-platform/sdk";
```

### Initialize

```typescript
// Direct Mode
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});

// Cloud Mode
const cortex = new Cortex({
  mode: "cloud",
  apiKey: process.env.CORTEX_CLOUD_KEY,
});
```

### Core Namespaces

```typescript
cortex.memory.*          // Layer 4: Memory convenience API (primary interface)
cortex.memorySpaces.*    // Memory space management (Hive/Collaboration)
cortex.conversations.*   // Layer 1a: ACID conversations (memorySpace-scoped)
cortex.immutable.*       // Layer 1b: Shared versioned data (NO memorySpace)
cortex.mutable.*         // Layer 1c: Shared live data (NO memorySpace)
cortex.vector.*          // Layer 2: Vector index (memorySpace-scoped)
cortex.facts.*           // Layer 3: Facts store (memorySpace-scoped, LLM extraction)
cortex.users.*           // User profiles + GDPR (shared across all spaces)
cortex.contexts.*        // Workflow coordination (cross-space support)
cortex.a2a.*             // Inter-space messaging (Collaboration Mode)
cortex.governance.*      // Retention policies
cortex.mcp.*             // MCP server utilities (Hive Mode default)
cortex.graph.*           // Graph queries (Graph-Premium or DIY)
```

### Most Used Operations

```typescript
// 1. Remember conversation
await cortex.memory.remember({
  memorySpaceId,
  participantId, // Optional: Hive Mode tracking
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
});

// 2. Search memories (infinite context pattern)
await cortex.memory.search(memorySpaceId, query, { embedding, filters });

// 3. Update user profile
await cortex.users.update(userId, { data });

// 4. Send inter-space message (Collaboration Mode)
await cortex.a2a.send({ from, to, message });

// 5. Create context
await cortex.contexts.create({ purpose, memorySpaceId, userId });
```

---

## Getting Help

### Documentation

- **[Memory Operations](./02-memory-operations.md)** - Most comprehensive guide
- **[Types & Interfaces](./11-types-interfaces.md)** - TypeScript reference
- **[Error Handling](./12-error-handling.md)** - Debugging guide

### Community

- **GitHub Discussions** - Ask questions, share patterns

### Found a Bug?

1. Check [Error Handling](./12-error-handling.md) for known issues
2. Search GitHub Issues for existing reports
3. Open new issue with minimal reproduction

---

## Next Steps

**New to Cortex?**
→ Start with [Memory Operations](./02-memory-operations.md) - the main API

**Building multi-agent systems?**
→ Read [Context Operations](./05-context-operations.md) and [A2A Communication](./06-a2a-communication.md)

**Need GDPR compliance?**
→ Check [User Operations](./04-user-operations.md#delete) for cascade deletion

**Working with shared data?**
→ Explore [Immutable Store](./07-immutable-store-api.md) and [Mutable Store](./08-mutable-store-api.md)

**TypeScript user?**
→ Review [Types & Interfaces](./11-types-interfaces.md) for complete definitions

---

**Ready to build?** Head to [Memory Operations](./02-memory-operations.md) →

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
