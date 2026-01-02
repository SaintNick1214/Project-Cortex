# Core Concepts

> **Last Updated**: January 1, 2026

Understanding these core concepts will help you make the most of Cortex. This guide covers the fundamental building blocks of the system.

> **Note on Feature Availability**: Cortex offers two deployment modes (Direct and Cloud). This guide covers all core concepts regardless of mode. As we develop the platform, certain advanced features may be available only in cloud mode. We'll clearly mark these distinctions as they're finalized.

## Table of Contents

- [Memory Spaces](#memory-spaces)
- [Hive Mode vs Collaboration Mode](#hive-mode-vs-collaboration-mode)
- [Infinite Context](#infinite-context)
- [Memory](#memory)
- [Embeddings](#embeddings)
- [Search Strategies](#search-strategies)
- [User Profiles](#user-profiles)
- [Context Chains](#context-chains)
- [Analytics](#analytics)
- [Data Flow](#data-flow)
- [Graph-Like Architecture](#graph-like-architecture)

---

## Memory Spaces

### What is a Memory Space?

A **memory space** is the fundamental isolation boundary in Cortex. Think of it as a private namespace where memories, facts, and conversations are stored.

**Previous term:** We used to call these "agents" - but that was confusing because multiple agents (or tools) can share one memory space!

```typescript
interface MemorySpace {
  id: string; // e.g., "user-123-personal" or "team-engineering"
  name?: string; // Human-readable name
  type: "personal" | "team" | "project"; // Organization type
  participants: string[]; // Who operates in this space (Hive Mode)
  createdAt: Date;
}
```

### Key Concept: Memory Space = Isolation Boundary

```typescript
// Every memory operation requires a memorySpaceId
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // ← Isolation boundary
  participantId: "cursor", // ← Who is storing this (optional)
  conversationId: "conv-123",
  userMessage: "I prefer TypeScript",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "User",
});
```

**What's isolated per memory space:**

- ✅ Layer 1a: Conversations (raw message history)
- ✅ Layer 2: Vector memories (embeddings + search)
- ✅ Layer 3: Facts (LLM-extracted knowledge)
- ✅ Layer 4: Convenience API results

**What's shared across ALL memory spaces:**

- ✅ Layer 1b: Immutable Store (policies, KB, org docs)
- ✅ Layer 1c: Mutable Store (config, inventory, counters)
- ✅ User profiles
- ✅ Agent/Participant registry

### Why Memory Spaces?

**Before (Agent-Centric):**

- Problem: Each agent had separate memories
- Issue: Cursor stores "User prefers TypeScript"
- Issue: Claude can't see it (different agent)
- Result: User repeats preferences to every tool ❌

**After (Memory-Space-Centric):**

- Solution: Tools share a memory space
- Cursor stores in `user-123-personal`
- Claude reads from `user-123-personal`
- Result: Memory follows user across tools ✅

### Creating Memory Spaces

**Option 1: Implicit Creation (Recommended)**

```typescript
// Just use memorySpaceId - space created automatically
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Created on first use
  conversationId: "conv-123",
  userMessage: "Hello",
  agentResponse: "Hi!",
  userId: "user-123",
  userName: "Alice",
});
```

**Option 2: Explicit Registration (For Analytics)**

```typescript
// Register space for rich metadata and analytics
await cortex.memorySpaces.register({
  id: "user-123-personal",
  name: "Alice's Personal Space",
  type: "personal",
  participants: ["cursor", "claude", "custom-bot"],
  metadata: {
    owner: "user-123",
    created: new Date(),
  },
});

// Now you get enhanced analytics
const stats = await cortex.analytics.getMemorySpaceStats("user-123-personal");
// { memoriesStored: 543, participants: 3, avgAccessTime: '12ms', ... }
```

**Using the CLI:**

```bash
# List all memory spaces
cortex spaces list

# Create a memory space
cortex spaces create user-123-personal \
  --type personal \
  --name "Alice's Personal Space"

# View space statistics
cortex spaces stats user-123-personal

# List participants (Hive Mode)
cortex spaces participants user-123-personal
```

**Learn more:**

- [Memory Spaces Guide](../02-core-features/01-memory-spaces.md)
- [CLI: spaces commands](../06-tools/01-cli-reference.md#cortex-spaces)

---

## Hive Mode vs Collaboration Mode

Cortex supports two architectural patterns for multi-agent/multi-tool systems:

### Hive Mode: Shared Memory Space

**Multiple participants share ONE memory space.**

```typescript
// Cursor stores memory
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Shared space
  participantId: "cursor", // Who stored it
  userMessage: "I prefer dark mode",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "Alice",
});

// Claude reads from SAME space
const memories = await cortex.memory.search("user-123-personal", "preferences");
// Returns: [{ content: "User prefers dark mode", participantId: "cursor", ... }]
```

**Characteristics:**

- ✅ **Single write** - One tool stores, all tools benefit
- ✅ **Zero duplication** - One copy of each memory
- ✅ **Consistent state** - Everyone sees the same data
- ✅ **Participant tracking** - `participantId` shows who stored what
- ✅ **Perfect for:** MCP integrations, personal AI assistants, tool ecosystems

**Use Cases:**

- Personal AI across Cursor, Claude Desktop, Notion AI
- Team workspace where all bots share memory
- Cross-application memory (MCP servers)
- Single user with multiple AI tools

### Collaboration Mode: Separate Memory Spaces

**Each participant has SEPARATE memory space, communicates via A2A.**

```typescript
// Finance agent stores in its own space
await cortex.memory.remember({
  memorySpaceId: "finance-agent-space", // Finance's space
  conversationId: "conv-123",
  userMessage: "Approve $50k budget",
  agentResponse: "Approved",
  userId: "user-123",
  userName: "CFO",
});

// Send message to HR agent (dual-write to BOTH spaces)
await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "Budget approved for hiring",
  importance: 85,
  metadata: { tags: ["approval", "hiring"] },
});
// Automatically stored in BOTH finance-agent-space AND hr-agent-space
```

**Characteristics:**

- ✅ **Dual-write** - A2A messages stored in both spaces
- ✅ **Complete isolation** - Each space is independent
- ✅ **No conflicts** - Separate memories can't conflict
- ✅ **GDPR compliant** - Delete one space without affecting others
- ✅ **Perfect for:** Autonomous agents, enterprise workflows, strict isolation needs

**Use Cases:**

- Autonomous agent swarms (each agent independent)
- Enterprise systems (strict data boundaries)
- Multi-tenant systems (customer isolation)
- Regulated industries (audit requirements)

### Comparison Table

| Aspect                   | Hive Mode           | Collaboration Mode       |
| ------------------------ | ------------------- | ------------------------ |
| **Memory Spaces**        | 1 shared space      | N separate spaces        |
| **Storage**              | Single write        | Dual-write (A2A)         |
| **Consistency**          | Always consistent   | Eventually consistent    |
| **Isolation**            | None (by design)    | Complete                 |
| **Use Case**             | Personal AI tools   | Autonomous agents        |
| **Participant Tracking** | Via `participantId` | Via `fromAgent/toAgent`  |
| **Example**              | Cursor + Claude     | Finance agent + HR agent |

### Cross-MemorySpace Access (Context Chains)

Even in Collaboration Mode, spaces can grant **limited** access via context chains:

```typescript
// Supervisor creates context and delegates
const context = await cortex.contexts.create({
  purpose: "Process refund request",
  memorySpaceId: "supervisor-space",
  userId: "user-123",
});

// Specialist can access supervisor's context (read-only)
const fullContext = await cortex.contexts.get(context.id, {
  includeChain: true,
  requestingSpace: "specialist-space", // Cross-space access
});

// specialist-space can read:
// ✅ The context chain (hierarchy)
// ✅ Referenced conversations (only those in context)
// ❌ Supervisor's other memories (isolated)
```

**Security Model:**

- Context chains grant **limited** read access
- Only context-referenced data accessible
- Audit trail for all cross-space reads
- Prevents memory poisoning

---

## Infinite Context

**The Breakthrough:** Never run out of context again.

### The Problem

Traditional AI chatbots accumulate conversation history:

```typescript
// Traditional approach (accumulation)
const conversation = {
  messages: [
    { role: "user", content: "Hi, I prefer TypeScript" },
    { role: "assistant", content: "Noted!" },
    // ... 500 more exchanges ...
    { role: "user", content: "What languages do I prefer?" },
    { role: "assistant", content: "???" }, // Message #1 was truncated!
  ],
};

// Token cost: 500 messages × 50 tokens = 25,000 tokens per request
// Eventually: Exceeds model's context window (128K, 200K, etc.)
```

### The Solution: Retrieval-Based Context

Instead of sending all history, **retrieve only relevant memories**:

```typescript
// Cortex approach (retrieval)
async function respondToUser(userMessage: string, memorySpaceId: string) {
  // 1. Retrieve relevant context from ALL past conversations
  const relevantContext = await cortex.memory.search(
    memorySpaceId,
    userMessage,
    {
      embedding: await embed(userMessage),
      limit: 10, // Top 10 most relevant facts/memories
    },
  );

  // 2. LLM call with ONLY relevant context
  const response = await llm.complete({
    messages: [
      {
        role: "system",
        content: `Relevant Context:\n${relevantContext.map((m) => m.content).join("\n")}`,
      },
      { role: "user", content: userMessage }, // Current message only
    ],
  });

  // 3. Store exchange (adds to knowledge pool)
  await cortex.memory.remember({
    memorySpaceId,
    conversationId: `ephemeral-${Date.now()}`, // New conversation each time
    userMessage,
    agentResponse: response,
    userId: "user-123",
    userName: "User",
    extractFacts: true, // Auto-extract for future retrieval
  });

  return response;
}
```

### Key Benefits

**1. Unlimited History**

- Can recall from 1,000,000+ past messages
- Token cost stays constant (only retrieve top-K)
- Never hit context window limits

**2. 99% Token Reduction**

- Traditional: 50,000 tokens (accumulated)
- Infinite Context: 400 tokens (retrieved)
- Savings: $1.50 → $0.012 per request (GPT-5-nano)

**3. Works with Any Model**

- Smaller, cheaper models can have "infinite" memory
- Retrieval is faster than large context windows
- Legacy models perform like SOTA with perfect retrieval

**4. Perfect Recall**

- Semantic search finds relevant info from years ago
- Importance-weighted (critical facts prioritized)
- 3-tier strategy (facts + summaries + raw when needed)

### 3-Tier Retrieval

```typescript
// Tier 1: Facts (most efficient)
const facts = await cortex.memory.search(memorySpaceId, query, {
  contentType: "fact",
  limit: 10,
});
// 10 facts × 8 tokens = 80 tokens

// Tier 2: Summaries (more detail)
const summaries = await cortex.memory.search(memorySpaceId, query, {
  contentType: "summarized",
  limit: 3,
});
// 3 summaries × 75 tokens = 225 tokens

// Tier 3: Raw (full detail, selective)
const critical = facts.filter((f) => f.metadata.importance >= 90);
const raw = await fetchRawForFacts(critical.slice(0, 2));
// 2 conversations × 50 tokens = 100 tokens

// Total: 405 tokens vs 20,000+ tokens accumulated!
```

**Learn more:** [Infinite Context Architecture](../04-architecture/10-infinite-context.md)

---

## Memory

### What is Memory?

In Cortex, a **memory** is a piece of information stored in a memory space for later retrieval. It consists of:

```typescript
interface MemoryEntry {
  id: string; // Unique identifier
  memorySpaceId: string; // Which space owns this
  participantId?: string; // Who stored it (Hive Mode)
  content: string; // The actual information
  embedding?: number[]; // Vector for semantic search
  metadata: {
    importance: number; // 0-100 scale
    tags: string[]; // Categorization
    [key: string]: any; // Custom metadata
  };
  createdAt: Date; // When stored
  lastAccessed?: Date; // Last retrieval
  accessCount: number; // Usage tracking
}
```

### Types of Memories

**1. Conversation Memories**
Information from user interactions:

```typescript
// Use Layer 4 remember() for conversations (recommended)
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId: "conv-123",
  userMessage: "I work in San Francisco",
  agentResponse: "That's great to know!",
  userId: "user-123",
  userName: "Alice",
  importance: 60, // 0-100 scale
  tags: ["location", "personal", "user-info"],
});
```

**2. Knowledge Memories**
Facts and information:

```typescript
// System-generated knowledge (Layer 2 - explicit Vector)
await cortex.vector.store("user-123-personal", {
  content: "Product X costs $49.99 with a 20% discount for annual billing",
  contentType: "raw",
  embedding: await embed("Product X pricing"),
  source: { type: "system", timestamp: new Date() },
  metadata: {
    importance: 85,
    tags: ["pricing", "product-x", "business"],
  },
});
```

**3. Task Memories**
What was done:

```typescript
// Tool result (Layer 2 - explicit Vector)
await cortex.vector.store("support-bot-space", {
  content: "Sent password reset email to user@example.com at 2025-10-28 10:30",
  contentType: "raw",
  embedding: await embed("password reset action"),
  source: { type: "tool", timestamp: new Date() },
  metadata: {
    importance: 90,
    tags: ["action", "security", "completed"],
  },
});
```

**4. Participant-to-Participant (Hive Mode)**
Communications within a shared space:

```typescript
// In Hive Mode, participants can signal each other
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  participantId: "finance-bot",
  conversationId: "internal-comm",
  userMessage: "[From hr-bot] New hire approved",
  agentResponse: "Budget allocated for salary",
  userId: "system",
  userName: "System",
  importance: 85,
  tags: ["internal", "coordination"],
});
```

**5. Agent-to-Agent (Collaboration Mode)**
Communications between separate spaces:

```typescript
// Use A2A helper (Layer 4 - handles dual-write)
await cortex.a2a.send({
  from: "finance-agent",
  to: "ceo-agent",
  message: "Received approval for $50k budget increase",
  importance: 85,
  metadata: { tags: ["approval", "budget"] },
});
// Stores in BOTH finance-agent-space AND ceo-agent-space
```

### Memory Versioning (Automatic)

**Critical Feature**: When you update a memory, the old version is **automatically preserved**:

```typescript
// Store password (Layer 4 for conversation)
const result = await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId: "conv-456",
  userMessage: "The password is Blue",
  agentResponse: "I've saved that password",
  userId: "user-123",
  userName: "Alice",
  importance: 100, // Critical
});
const memoryId = result.memories[0].id;

// Password changes (Layer 4 update - creates version 2)
await cortex.memory.update("user-123-personal", memoryId, {
  content: "The password is Red",
});

// Both versions are preserved!
const memory = await cortex.memory.get("user-123-personal", memoryId);
console.log(memory.content); // "The password is Red" (current)
console.log(memory.version); // 2

console.log(memory.previousVersions[0]);
// { version: 1, content: "The password is Blue", timestamp: ... }
```

**Using the CLI:**

```bash
# Get memory with version history
cortex memory get <memoryId> --space user-123-personal

# List all memories in a space
cortex memory list --space user-123-personal

# Search memories
cortex memory search "password" --space user-123-personal

# Export memories (includes version history)
cortex memory export --space user-123-personal --output backup.json
```

**Why this is revolutionary:**

- ✅ No data loss when information changes
- ✅ Temporal conflict resolution
- ✅ Complete audit trail
- ✅ Can query "what was true on date X?"
- ✅ Automatic - no code required
- ✅ Configurable retention (default: 10 versions)

### Memory Importance (0-100 Scale)

Cortex uses a granular 0-100 importance scale for precise prioritization:

**90-100** - Critical

- Passwords, credentials (100)
- Hard deadlines (95)
- Security alerts (95)
- Legal/compliance data (90)

**70-89** - High

- User requirements (80)
- Important decisions (85)
- Key preferences (75)
- Task specifications (80)

**40-69** - Medium (default: 50)

- General preferences (60)
- Conversation context (50)
- Background information (45)
- Routine data (50)

**10-39** - Low

- Casual observations (30)
- Minor details (20)
- Exploratory conversation (25)

**0-9** - Trivial

- Debug information (5)
- Temporary data (0)

```typescript
// Automatic scoring
const importance = determineImportance(content); // Returns 0-100

// Or set explicitly
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId,
  userMessage: "Security code is 1234",
  agentResponse: "Saved securely",
  userId: "user-123",
  userName: "Alice",
  importance: 100, // Critical
});
```

### Memory Space Isolation

Each memory space's memories are **completely isolated**:

```typescript
// Cursor stores in user-123-personal
await cortex.vector.store("user-123-personal", {
  content: "Secret information for Alice",
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 90 },
});

// Bob's space cannot see it
const memories = await cortex.memory.search("user-456-personal", "secret");
// Returns: [] (empty - different memory space)

// Only Alice's space can access
const memories = await cortex.memory.search("user-123-personal", "secret");
// Returns: [{ content: 'Secret information for Alice', ... }]
```

This ensures:

- Data privacy
- No accidental leakage
- Clear boundaries
- Easy debugging

---

## Embeddings

### What are Embeddings?

**Embeddings** are numerical vectors that represent the semantic meaning of text. They enable semantic search - finding related content by meaning, not just keywords.

```
"The cat sat on the mat"
↓
[0.234, -0.891, 0.445, ..., 0.123]  // 768, 1536, or 3072 dimensions
```

### Embedding-Agnostic Design

The **Cortex SDK does not generate embeddings** - you bring your own provider, or use Cortex Cloud for automatic generation.

**Direct Mode (SDK):**

```typescript
// Choose your provider
const embedding = await yourEmbeddingProvider.embed(text);

// Cortex SDK stores and searches
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: embedding, // Your vectors
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50 },
});

// Or use Layer 4 for conversations with your embeddings
await cortex.memory.remember({
  memorySpaceId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  generateEmbedding: async (content) =>
    await yourEmbeddingProvider.embed(content),
});
```

**Cloud Mode (Managed):**

```typescript
// Cortex Cloud generates embeddings automatically
await cortex.memory.remember({
  memorySpaceId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  autoEmbed: true, // ← Cloud Mode generates embeddings for you
  // No embedding provider needed!
});
```

**Why this design?**

- ✅ **Direct Mode:** Use any embedding model (OpenAI, Cohere, local)
- ✅ **Cloud Mode:** Zero-config automatic embeddings
- ✅ Optimize for your use case
- ✅ Upgrade models independently
- ✅ No vendor lock-in (can switch between modes)
- ✅ Fine-tune for your domain

### Popular Embedding Providers

**OpenAI**

```typescript
import OpenAI from "openai";
const openai = new OpenAI();

const result = await openai.embeddings.create({
  model: "text-embedding-3-large", // 3072 dimensions
  input: text,
});

const embedding = result.data[0].embedding;
```

**Cohere**

```typescript
import { CohereClient } from "cohere-ai";
const cohere = new CohereClient();

const result = await cohere.embed({
  texts: [text],
  model: "embed-english-v3.0", // 1024 dimensions
  inputType: "search_document",
});

const embedding = result.embeddings[0];
```

**Local Models (Transformers.js)**

```typescript
import { pipeline } from "@xenova/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
); // 384 dimensions

const output = await extractor(text, {
  pooling: "mean",
  normalize: true,
});

const embedding = Array.from(output.data);
```

### Flexible Dimensions

Cortex supports **any** vector dimension:

```typescript
// Small and fast (768 dimensions)
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: smallEmbedding, // [768 numbers]
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50, dimension: 768 },
});

// Balanced (1536 dimensions) - OpenAI default
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: standardEmbedding, // [1536 numbers]
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50, dimension: 1536 },
});

// High accuracy (3072 dimensions)
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: largeEmbedding, // [3072 numbers]
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50, dimension: 3072 },
});
```

**Tradeoffs:**

| Dimensions | Speed  | Accuracy | Cost   | Use Case                  |
| ---------- | ------ | -------- | ------ | ------------------------- |
| 384-768    | Fast   | Good     | Low    | High-volume, real-time    |
| 1536       | Medium | Better   | Medium | General purpose           |
| 3072       | Slower | Best     | High   | When accuracy is critical |

**Default Recommendation**: 3072 dimensions (OpenAI text-embedding-3-large) for the best accuracy. Scale down if you need faster search.

---

## Search Strategies

Cortex uses **multi-strategy search** for robust memory retrieval.

### Strategy 1: Semantic Search (Vector)

Primary method - finds similar meanings:

```typescript
const memories = await cortex.memory.search(
  "user-123-personal",
  "what is the user's favorite color?",
  {
    embedding: await embed("what is the user's favorite color?"),
    limit: 10,
  },
);
```

This finds: "User loves blue" even though query says "favorite" and "color" separately.

### Strategy 2: Keyword Search

Fallback when vector search finds nothing:

```typescript
// Extracts keywords: ['user', 'favorite', 'color']
// Searches for any memory containing these words
```

Useful for:

- Exact term matching
- Names and IDs
- Technical terms

### Strategy 3: Recent Memories

Final fallback - returns recent memories:

```typescript
// When all else fails, return the 20 most recent memories
// User might find what they need through recency
```

### Combined Strategy

Cortex automatically tries all strategies:

```
User Query
    │
    ├─> Try Semantic Search (embedding)
    │   ├─> Results found? ✓ Return them
    │   └─> No results? Continue...
    │
    ├─> Try Keyword Search
    │   ├─> Results found? ✓ Return them
    │   └─> No results? Continue...
    │
    └─> Return Recent Memories
        └─> Always returns something
```

### Custom Search Options

Fine-tune search behavior:

```typescript
// Layer 4 search with filters
await cortex.memory.search("user-123-personal", query, {
  embedding: await embed(query),
  limit: 20, // Max results
  minScore: 0.7, // Similarity threshold
  tags: ["preferences"], // Filter by tags
  minImportance: 50, // Minimum importance (0-100 scale)
  createdAfter: new Date("2025-01-01"),
  createdBefore: new Date("2025-01-31"),
  participantId: "cursor", // Only from cursor (Hive Mode)
});
```

**Using the CLI:**

```bash
# Search with filters
cortex memory search "preferences" \
  --space user-123-personal \
  --limit 20

# List and filter memories
cortex memory list \
  --space user-123-personal \
  --user alice \
  --limit 50

# Get memory statistics
cortex memory stats --space user-123-personal
```

**Learn more:**

- [Semantic Search Guide](../02-core-features/02-semantic-search.md)
- [CLI: memory commands](../06-tools/01-cli-reference.md#cortex-memory)

---

## User Profiles

### What are User Profiles?

**User profiles** store information about users across all memory spaces and conversations.

```typescript
interface UserProfile {
  id: string; // Unique user ID
  displayName: string; // How to address them
  email?: string; // Contact info
  preferences: {
    theme?: "light" | "dark";
    language?: string;
    timezone?: string;
    [key: string]: any; // Custom preferences
  };
  metadata: {
    tier?: "free" | "pro" | "enterprise";
    signupDate?: Date;
    lastSeen?: Date;
    [key: string]: any; // Custom metadata
  };
}
```

### Creating and Updating

```typescript
// Create a user profile
await cortex.users.update("user-123", {
  displayName: "Alice Johnson",
  email: "alice@example.com",
  preferences: {
    theme: "dark",
    language: "en",
    timezone: "America/Los_Angeles",
  },
  metadata: {
    tier: "pro",
    signupDate: new Date(),
    company: "Acme Corp",
  },
});

// Update specific fields
await cortex.users.update("user-123", {
  preferences: {
    theme: "light", // Only updates theme
  },
  metadata: {
    lastSeen: new Date(),
  },
});
```

### Retrieving Profiles

```typescript
// Get a user's profile
const user = await cortex.users.get("user-123");

// Use in agent interactions
const greeting = `Hello ${user.displayName}! I see you prefer ${user.preferences.theme} mode.`;
```

**Using the CLI:**

```bash
# List all users
cortex users list

# Get user details
cortex users get user-123

# Show user statistics
cortex users stats user-123

# Export user data (GDPR compliance)
cortex users export user-123 --output user-data.json

# Delete user (with GDPR cascade)
cortex users delete user-123 --cascade
```

**Learn more:**

- [User Profiles Guide](../02-core-features/03-user-profiles.md)
- [CLI: users commands](../06-tools/01-cli-reference.md#cortex-users)

### Cross-MemorySpace User Context

User profiles are shared across all memory spaces:

```typescript
// In user-123-personal space
await cortex.users.update("user-123", {
  preferences: { communicationStyle: "formal" },
});

// In team-engineering space (different memory space)
const user = await cortex.users.get("user-123");
if (user.preferences.communicationStyle === "formal") {
  response = formatFormal(response);
}
```

---

## Context Chains

### What are Context Chains?

**Context chains** enable hierarchical context sharing in multi-agent systems and enable **cross-memorySpace** access with security controls.

Think of it like a management hierarchy where:

- Supervisors see their team's work
- Teams share knowledge within their context
- Specialists can access supervisor context (limited)
- Everyone can access relevant historical context

### Creating a Context

```typescript
const context = await cortex.contexts.create({
  purpose: "Handle customer refund request",
  memorySpaceId: "supervisor-space",
  userId: "user-123",
  metadata: {
    ticketId: "TICKET-456",
    priority: "high",
  },
});

// Returns: { id: 'ctx_abc123', ... }
```

### Creating Child Contexts

```typescript
// Supervisor delegates to finance agent (different memory space)
const financeContext = await cortex.contexts.create({
  purpose: "Process $500 refund",
  memorySpaceId: "finance-agent-space", // Different space!
  parentId: context.id, // Link to parent
  metadata: {
    amount: 500,
    reason: "defective product",
  },
});
```

### Cross-MemorySpace Access

Context chains enable **limited** cross-space access:

```typescript
// Finance agent accesses supervisor context (different space)
const fullContext = await cortex.contexts.get(financeContext.id, {
  includeChain: true,
  requestingSpace: "finance-agent-space", // Declares who's asking
});

console.log(fullContext);
// {
//   current: { purpose: 'Process $500 refund', memorySpaceId: 'finance-agent-space' },
//   parent: { purpose: 'Handle customer refund request', memorySpaceId: 'supervisor-space' },
//   root: { purpose: 'Handle customer refund request', memorySpaceId: 'supervisor-space' },
//   children: [],
//   depth: 2
// }

// Finance agent can read:
// ✅ Context hierarchy (structure)
// ✅ Conversations referenced in context
// ❌ Supervisor's other memories (isolated)
```

**Security Model:**

- Context chains grant **read-only** cross-space access
- Only context-referenced data accessible
- Audit trail for all cross-space reads
- Prevents memory poisoning

### Context Chain Visualization

```
Root Context (Supervisor Space)
  "Handle customer refund request"
        │
        ├─> Child Context (Finance Space)
        │   "Process $500 refund"
        │
        └─> Child Context (Customer Relations Space)
            "Send apology email"
```

### Use Cases

**1. Hierarchical Multi-Agent Systems**
Supervisor agents delegate to worker agents with shared context (cross-space).

**2. Task Decomposition**
Break complex tasks into subtasks while maintaining context.

**3. Audit Trails**
Track the full history of how a task was handled across spaces.

**4. Secure Knowledge Sharing**
Teams share context without exposing unrelated information.

---

## Analytics

> **Cloud Mode Feature**: Advanced analytics are planned for Cortex Cloud. Basic usage tracking will be available in both modes.

### What are Analytics?

**Analytics** help you understand how memory spaces are used:

```typescript
const stats = await cortex.analytics.getMemorySpaceStats("user-123-personal");

console.log(stats);
// {
//   totalMemories: 15432,
//   memoriesThisWeek: 234,
//   avgSearchTime: '23ms',
//   participants: ['cursor', 'claude', 'custom-bot'],
//   topTags: ['preferences', 'support', 'product-info'],
//   accessPatterns: {
//     mostAccessed: [{ id: 'mem_123', count: 45 }, ...],
//     leastAccessed: [{ id: 'mem_789', count: 1 }, ...],
//   },
//   importanceBreakdown: {
//     high: 234,
//     medium: 12043,
//     low: 3155
//   }
// }
```

### Access Tracking

Every memory tracks its usage:

```typescript
const memory = await cortex.memory.get("user-123-personal", "mem_123");

console.log({
  accessCount: memory.accessCount, // How many times accessed
  lastAccessed: memory.lastAccessed, // When last accessed
  createdAt: memory.createdAt, // When created
});
```

**Using the CLI:**

```bash
# View database-wide statistics
cortex db stats

# View space-specific statistics
cortex spaces stats user-123-personal

# View memory statistics
cortex memory stats --space user-123-personal

# View user statistics
cortex users stats user-123
```

### Usage Insights

```typescript
// Find unused memories (potential cleanup)
const unused = await cortex.analytics.findUnusedMemories("user-123-personal", {
  olderThan: "30d",
  maxAccessCount: 1,
});

// Find hot memories (frequently accessed)
const hot = await cortex.analytics.findHotMemories("user-123-personal", {
  minAccessCount: 10,
  timeWindow: "7d",
});
```

**Learn more:**

- [Access Analytics Guide](../02-core-features/07-access-analytics.md)
- [CLI: db commands](../06-tools/01-cli-reference.md#cortex-db-stats)

---

## Data Flow

### Complete Memory Lifecycle

```
┌────────────────────────────────────────────────────────────┐
│                    User Interaction                         │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                 Your Application                            │
│  • Generate embedding (your provider)                       │
│  • Call cortex.memory.remember()                            │
│  • Specify memorySpaceId                                    │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                   Cortex Layer                              │
│  • Validate input                                           │
│  • Add metadata (timestamps, IDs)                           │
│  • Route to correct memory space                            │
│  • Store in Convex                                          │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│                  Convex Backend                             │
│  • ACID transaction                                         │
│  • Index embedding for vector search                        │
│  • Isolate by memorySpaceId                                 │
│  • Store in durable storage                                 │
│  • Trigger real-time updates                                │
└─────────────────────────────────────────────────────────────┘

                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│              Memory Available for Search                    │
│         (within memorySpaceId boundary)                     │
└─────────────────────────────────────────────────────────────┘
```

### Search Flow

```
User Query → Generate Embedding → Cortex Search →
  │
  ├─> Vector Search (Convex - filtered by memorySpaceId)
  │   └─> Returns matches by similarity
  │
  ├─> Keyword Search (Convex - filtered by memorySpaceId)
  │   └─> Returns matches by text
  │
  └─> Recent Memories (Convex - filtered by memorySpaceId)
      └─> Returns by timestamp

→ Combine & Rank → Return to Application → Present to User
```

---

## Graph-Like Architecture

Cortex is built on a **document-oriented database** (Convex) but provides **graph-like querying** through references and relationships.

### Your Data IS a Graph

Every entity in Cortex is a graph node:

- **Memory Spaces** - Isolation boundaries
- **Participants** - Agents/tools in a space (Hive Mode)
- **Users** - End users, customers
- **Contexts** - Workflow tasks, hierarchies
- **Conversations** - Message threads
- **Memories** - Knowledge entries
- **Facts** - Extracted knowledge (Layer 3)

References between documents are graph edges:

- `conversationRef` → Links Memory to Conversation
- `parentId` → Links Context to Parent Context (cross-space)
- `userId` → Links anything to User
- `memorySpaceId` → Links Memory/Context to Space
- `participantId` → Links Memory to Participant (Hive Mode)
- `fromAgent/toAgent` → Links A2A Messages between Spaces

### Built-In Graph Traversals

**Context Chain Navigation:**

```typescript
// Get complete context hierarchy (graph walk)
const chain = await cortex.contexts.get(contextId, {
  includeChain: true, // ← Graph traversal!
});

console.log("Parent:", chain.parent.purpose); // 1-hop up
console.log("Root:", chain.root.purpose); // N-hops to root
console.log("Children:", chain.children.length); // 1-hop down
```

**Memory Space Communication Graph:**

```typescript
// Get A2A conversation (relationship graph between spaces)
const conversation = await cortex.a2a.getConversation(
  "finance-agent",
  "hr-agent",
);

// Shows communication edges between memory spaces
conversation.messages.forEach((msg) => {
  console.log(`${msg.from} → ${msg.to}: ${msg.message}`);
});
```

**Conversation Tracing:**

```typescript
// Memory → Conversation link (reference graph)
const memory = await cortex.memory.get("user-123-personal", memoryId, {
  includeConversation: true, // ← Follow conversationRef
});

console.log("Source conversation:", memory.conversation.conversationId);
console.log("Source messages:", memory.sourceMessages);
```

**Participant Activity Graph (Hive Mode):**

```typescript
// See which participants stored what
const memories = await cortex.memory.list("team-workspace", {
  participantId: "cursor", // Filter by participant
});

// Analyze participant activity
const participants = [...new Set(memories.map((m) => m.participantId))];
console.log("Active participants:", participants);
```

### Performance Characteristics

| Hops | Query Type             | Latency  | Use Case                |
| ---- | ---------------------- | -------- | ----------------------- |
| 1-2  | Direct relationships   | 10-50ms  | Most queries            |
| 3-5  | Context hierarchies    | 50-200ms | Workflows, audit trails |
| 6+   | Deep traversals (rare) | 200ms+   | Consider graph DB       |

### When to Add a Graph Database

**Graph-Lite** (built-in) handles 90% of use cases. Add a native graph database when you need:

- Deep traversals (6+ hops) with <100ms latency
- Complex pattern matching ("Find all paths between A and B")
- Graph algorithms (PageRank, centrality, shortest path)
- Dense relationship networks (social graphs, knowledge graphs)

**Options:**

- **DIY:** Integrate Neo4j, Memgraph, or Kùzu yourself (documented patterns)
- **Cloud Mode:** Graph-Premium (fully managed, zero DevOps)

**Learn more:** [Graph Capabilities](../07-advanced-topics/01-graph-capabilities.md)

---

## Common Patterns

### Pattern 1: Store on User Message (Hive Mode)

```typescript
// User sends message - store in shared memory space
const userMessage = req.body.message;
const agentResponse = await generateResponse(userMessage);

// Store the exchange
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Shared space
  participantId: "cursor", // Which tool is storing
  conversationId: req.conversationId,
  userMessage,
  agentResponse,
  userId: req.user.id,
  userName: req.user.name,
  generateEmbedding: async (content) => await embed(content),
  importance: 50,
  tags: ["user-input"],
});
```

### Pattern 2: Search Before Response (Infinite Context)

```typescript
// Retrieve relevant context before generating response
const memories = await cortex.memory.search("user-123-personal", userMessage, {
  embedding: await embed(userMessage),
  limit: 10, // Top 10 most relevant
});

// Include memories in prompt
const context = memories.map((m) => m.content).join("\n");
const prompt = `
Relevant Context:
${context}

User: ${userMessage}
Assistant:
`;

const response = await llm.complete(prompt);
```

### Pattern 3: Cross-Space Collaboration

```typescript
// Finance agent sends message to HR agent (separate spaces)
await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "Budget approved for hiring",
  importance: 85,
  metadata: { tags: ["approval", "hiring"] },
});
// Automatically stored in BOTH spaces (Collaboration Mode)

// HR agent can retrieve
const messages = await cortex.a2a.getConversation("hr-agent", "finance-agent");
```

### Pattern 4: Hive Mode Coordination

```typescript
// In team workspace, participants coordinate
await cortex.memory.remember({
  memorySpaceId: "team-engineering",
  participantId: "code-reviewer-bot",
  conversationId: "internal-comm",
  userMessage: "[From deployment-bot] Build ready for review",
  agentResponse: "Starting code review",
  userId: "system",
  userName: "System",
  importance: 80,
  tags: ["coordination", "review"],
});

// Other participants see it immediately
const updates = await cortex.memory.search("team-engineering", "code review", {
  limit: 5,
});
```

---

## Next Steps

Now that you understand the core concepts:

1. **[API Reference](../03-api-reference/02-memory-operations.md)** - Complete API documentation
2. **[Architecture](../04-architecture/01-system-overview.md)** - Deep dive into how it works
3. **[Advanced Topics](../07-advanced-topics/01-graph-capabilities.md)** - Graph queries, fact extraction, and optimization
4. **[Hive Mode Guide](../02-core-features/10-hive-mode.md)** - Master multi-tool memory sharing
5. **[Infinite Context](../04-architecture/10-infinite-context.md)** - Never run out of context again

---

**Questions?** Ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).
