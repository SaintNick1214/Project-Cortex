# API Reference Overview

> **Last Updated**: 2025-10-24

Welcome to the Cortex API Reference! This guide explains how to navigate the documentation and use Cortex effectively.

## What is Cortex?

Cortex is a **persistent memory system for AI agents** built on Convex. It provides:

- **Three-layer architecture** - ACID stores + Vector index + Convenience API
- **Automatic versioning** - Track how information changes over time
- **GDPR compliance** - Built-in cascade deletion (Cloud Mode)
- **Universal filters** - Same filters work across all operations
- **Embedding-agnostic** - Bring your own embeddings or use Cloud Mode

## Documentation Structure

The API Reference is organized by architectural layers:

### **Core Memory System (Start Here)**

- **[Memory Operations](./02-memory-operations.md)** - The main API you'll use
  - Layer 3 convenience (`cortex.memory.*`)
  - Overview of all layers
  - `remember()`, `search()`, `get()`, `update()`, `delete()`
- **[Conversation Operations](./03-conversation-operations.md)** - Layer 1a (ACID)
  - Immutable conversation threads
  - Source of truth for all messages
  - `create()`, `addMessage()`, `getHistory()`

### **User & Coordination**

- **[User Operations](./04-user-operations.md)** - User profiles + GDPR
  - Shared user data across agents
  - One-click GDPR cascade deletion (Cloud Mode)
- **[Context Operations](./05-context-operations.md)** - Workflow coordination
  - Hierarchical task tracking
  - Multi-agent collaboration
- **[A2A Communication](./06-a2a-communication.md)** - Agent messaging
  - Inter-agent communication patterns
  - Requires pub/sub (BYO or Cloud-managed)

### **Advanced Storage**

- **[Immutable Store](./07-immutable-store-api.md)** - Layer 1b
  - Shared, versioned, immutable data
  - KB articles, policies, audit logs
- **[Mutable Store](./08-mutable-store-api.md)** - Layer 1c
  - Shared, mutable, current-value data
  - Inventory, config, counters

### **Supporting APIs**

- **[Agent Management](./09-agent-management.md)** - Agent registry
- **[Governance Policies](./10-governance-policies-api.md)** - Retention rules

### **Reference**

- **[Types & Interfaces](./11-types-interfaces.md)** - TypeScript definitions
- **[Error Handling](./12-error-handling.md)** - Error codes and debugging

---

## Quick Start

### 5-Minute Example

```typescript
import { Cortex } from "@cortex-platform/sdk";

// 1. Initialize Cortex
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});

// 2. Create a conversation
const conversation = await cortex.conversations.create({
  type: "user-agent",
  participants: {
    userId: "user-123",
    agentId: "support-agent",
  },
});

// 3. Store user-agent exchange (ACID + Vector automatically)
const result = await cortex.memory.remember({
  agentId: "support-agent",
  conversationId: conversation.conversationId,
  userMessage: "My password is Blue123",
  agentResponse: "I'll remember that securely!",
  userId: "user-123",
  userName: "Alex Johnson",
  importance: 100,
  tags: ["password", "security"],
});

// 4. Search memories (semantic)
const memories = await cortex.memory.search("support-agent", "user password", {
  embedding: await embed("user password"),
  userId: "user-123",
  minImportance: 70,
});

console.log("Found:", memories[0].content); // "My password is Blue123"

// 5. User profile (shared across all agents)
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

### The Three-Layer Architecture

```
┌─────────────────────────────────────┐
│   Layer 1: ACID Stores              │
│   ├── Conversations (1a)            │
│   ├── Immutable (1b)                │
│   └── Mutable (1c)                  │
│   Source of truth, immutable        │
└──────────────┬──────────────────────┘
               │ conversationRef, immutableRef, mutableRef
               ↓
┌─────────────────────────────────────┐
│   Layer 2: Vector Index             │
│   Searchable, versioned             │
│   References Layer 1                │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Layer 3: Memory API               │
│   Convenience (ACID + Vector)       │
│   cortex.memory.*                   │
└─────────────────────────────────────┘
```

**Most developers use Layer 3** (`cortex.memory.*`) - it handles Layers 1 and 2 automatically.

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
await cortex.memory.search(agentId, query, filters);
await cortex.memory.count(agentId, filters);
await cortex.memory.list(agentId, filters);
await cortex.memory.updateMany(agentId, filters, updates);
await cortex.memory.deleteMany(agentId, filters);
await cortex.memory.export(agentId, filters);
```

**Supported Filters:**

- `userId`, `tags`, `importance`, `createdBefore/After`
- `accessCount`, `version`, `source.type`
- Any `metadata.*` field

### Automatic Versioning

Updates don't overwrite - they create new versions:

```typescript
// v1
await cortex.memory.store('agent-1', {
  content: 'Password is Blue',
  ...
});

// v2 (v1 preserved in history)
await cortex.memory.update('agent-1', memoryId, {
  content: 'Password is Red',
});

// Access history
const memory = await cortex.memory.get('agent-1', memoryId);
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
// ✅ Conversations (Layer 1a)
// ✅ Immutable records (Layer 1b)
// ✅ Mutable keys (Layer 1c)
// ✅ Vector memories (Layer 2) across ALL agents
```

**Direct Mode:** Manual deletion from each store (see User Operations API).

---

## Common Patterns

### Pattern 1: Simple Chatbot

```typescript
// User sends message
const conversation = await cortex.conversations.getOrCreate({
  type: "user-agent",
  participants: { userId: req.user.id, agentId: "chatbot" },
});

// Store exchange
await cortex.memory.remember({
  agentId: "chatbot",
  conversationId: conversation.conversationId,
  userMessage: req.body.message,
  agentResponse: response,
  userId: req.user.id,
  userName: req.user.name,
});

// Search for context
const context = await cortex.memory.search("chatbot", req.body.message, {
  embedding: await embed(req.body.message),
  userId: req.user.id,
  limit: 5,
});
```

### Pattern 2: Multi-Agent Workflow

```typescript
// Create workflow context
const context = await cortex.contexts.create({
  purpose: "Process refund request",
  agentId: "supervisor-agent",
  userId: "user-123",
});

// Delegate via A2A
await cortex.a2a.send({
  from: "supervisor-agent",
  to: "finance-agent",
  message: "Approve $500 refund",
  userId: "user-123",
  contextId: context.id,
  importance: 85,
});

// Finance agent accesses context
const ctx = await cortex.contexts.get(context.id);
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

// Index for search (optional)
await cortex.vector.store("kb-agent", {
  content: "Refund Policy: Refunds available within 30 days...",
  immutableRef: {
    type: "kb-article",
    id: "refund-policy",
  },
  metadata: { importance: 90, tags: ["policy"] },
});

// All agents can search
const results = await cortex.memory.search("support-agent", "refund policy");
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
});

// Store with your embeddings
await cortex.memory.store('agent-1', {
  content: 'User prefers dark mode',
  embedding: await openai.embeddings.create({ ... }),
  ...
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
  agentId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
});

// Store system memory (Vector only)
await cortex.vector.store(agentId, {
  content,
  source: { type: "system" },
  metadata,
});

// Search
await cortex.memory.search(agentId, query, {
  embedding,
  userId,
  minImportance,
  limit,
});

// Get
await cortex.memory.get(agentId, memoryId, { includeConversation: true });

// Update
await cortex.memory.update(agentId, memoryId, { content, metadata });

// Delete (preserves ACID)
await cortex.memory.delete(agentId, memoryId);

// Count
await cortex.memory.count(agentId, filters);

// List
await cortex.memory.list(agentId, { limit, offset, sortBy });

// Export
await cortex.memory.export(agentId, { userId, format: "json" });
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
  agentId,
  userId,
  parentId,
  data,
});

// Get with chain
await cortex.contexts.get(contextId, { includeChain: true });

// Update status
await cortex.contexts.update(contextId, { status: "completed", data });

// Delete with children
await cortex.contexts.delete(contextId, { cascadeChildren: true });

// Search
await cortex.contexts.search({
  agentId,
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

### 1. Start with Layer 3

Use `cortex.memory.*` for most operations:

```typescript
// ✅ Recommended: Layer 3 (handles ACID + Vector)
await cortex.memory.remember({ ... });

// ⚠️ Advanced: Manual Layer 1 + Layer 2
const msg = await cortex.conversations.addMessage(...);
await cortex.vector.store(...);
```

### 2. Always Link to ACID

Link Vector memories to their source:

```typescript
// ✅ Good: With conversationRef
await cortex.vector.store('agent-1', {
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
const count = await cortex.memory.count("agent-1", oldDebugLogs);

// Export
await cortex.memory.export("agent-1", { ...oldDebugLogs, format: "json" });

// Delete
await cortex.memory.deleteMany("agent-1", oldDebugLogs);
```

### 4. Handle Errors

Always catch and handle errors:

```typescript
try {
  await cortex.memory.store("agent-1", data);
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
await cortex.memory.store('agent-1', {
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
cortex.memory.*          // Layer 3: Memory convenience API
cortex.conversations.*   // Layer 1a: ACID conversations
cortex.immutable.*       // Layer 1b: Shared versioned data
cortex.mutable.*         // Layer 1c: Shared live data
cortex.vector.*          // Layer 2: Vector index
cortex.users.*           // User profiles + GDPR
cortex.contexts.*        // Workflow coordination
cortex.a2a.*             // A2A messaging helpers
cortex.agents.*          // Agent registry
cortex.governance.*      // Retention policies
```

### Most Used Operations

```typescript
// 1. Remember conversation
await cortex.memory.remember({
  agentId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
});

// 2. Search memories
await cortex.memory.search(agentId, query, { embedding, filters });

// 3. Update user profile
await cortex.users.update(userId, { data });

// 4. Send A2A message
await cortex.a2a.send({ from, to, message });

// 5. Create context
await cortex.contexts.create({ purpose, agentId, userId });
```

---

## Getting Help

### Documentation

- **[Memory Operations](./02-memory-operations.md)** - Most comprehensive guide
- **[Types & Interfaces](./11-types-interfaces.md)** - TypeScript reference
- **[Error Handling](./12-error-handling.md)** - Debugging guide

### Community

- **GitHub Discussions** - Ask questions, share patterns
- **Discord** - Real-time help in #help channel
- **Examples** - See working code in [Recipes](../06-recipes/)

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

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
