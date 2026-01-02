# Memory Spaces

> **Last Updated**: 2026-01-01

## Overview

**Memory Spaces** are the fundamental isolation boundary in Cortex. A memory space is a private namespace where memories, conversations, and facts are stored and retrieved.

**Think of it like:** A personal hard drive, team workspace, or project folder - isolated from others but shared among authorized participants.

## Quick Start

```typescript
// Store memory in a space
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Isolation boundary
  conversationId: "conv-abc",
  userMessage: "I prefer TypeScript",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "Alice",
});

// Search within that space
const memories = await cortex.memory.search(
  "user-123-personal",
  "programming preferences",
);
// Returns only memories from user-123-personal
```

## Core Concept

### Memory Space = Isolation Boundary

Every memory operation requires a `memorySpaceId`:

```typescript
interface MemorySpaceId {
  value: string; // e.g., "user-123-personal", "team-engineering", "project-apollo"
  scope: "personal" | "team" | "project" | "custom";
}
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
- ✅ Participant registry (for Hive Mode)

### Why Memory Spaces? (Not "Agents")

**The Problem with "Agent" as Isolation:**

```typescript
// OLD thinking (agent-centric)
// Problem: Each agent has separate memories
await cortex.memory.remember({ agentId: "cursor", ... });
await cortex.memory.remember({ agentId: "claude", ... });
// User repeats preferences to every tool ❌
```

**The Solution (memory-space-centric):**

```typescript
// NEW thinking (memory-space-centric)
// Solution: Tools share a memory space
await cortex.memory.remember({ memorySpaceId: "user-123-personal", participantId: "cursor", ... });
await cortex.memory.remember({ memorySpaceId: "user-123-personal", participantId: "claude", ... });
// Memory follows user across tools ✅
```

## Two Modes of Operation

### Hive Mode: Shared Memory Space

**Multiple participants share ONE memory space.**

```typescript
// Cursor stores
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

**Perfect for:**

- Personal AI tools (Cursor + Claude + Notion AI)
- MCP integration
- Team workspaces
- Multi-platform apps

**Learn more:** [Hive Mode Guide](./10-hive-mode.md)

### Collaboration Mode: Separate Memory Spaces

**Each participant has SEPARATE memory space, communicates via A2A.**

```typescript
// Finance agent (separate space)
await cortex.memory.remember({
  memorySpaceId: "finance-agent-space",
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
});
// Automatically stored in BOTH spaces
```

**Perfect for:**

- Autonomous agent swarms
- Enterprise workflows with strict isolation
- Multi-tenant systems
- Compliance requirements

**Learn more:** [A2A Communication](./05-a2a-communication.md)

## Four-Layer Architecture

Memory spaces organize data across four layers:

```
Memory Space: user-123-personal
│
├─ Layer 1a: Conversations (ACID, memorySpace-scoped)
│  └─ Raw message history, full audit trail
│
├─ Layer 2: Vector Memories (memorySpace-scoped, searchable)
│  └─ Embedded memories for semantic search
│
├─ Layer 3: Facts (memorySpace-scoped, versioned)
│  └─ LLM-extracted facts for efficient retrieval
│
└─ Layer 4: Convenience APIs
   └─ cortex.memory.* (wrapper over L1-3)

Shared Across ALL Spaces:
├─ Layer 1b: Immutable (KB, policies, org docs)
└─ Layer 1c: Mutable (config, inventory, state)
```

### Layer Details

**Layer 1a: Conversations (Private to Space)**

```typescript
// Stored in conversations table, filtered by memorySpaceId
interface Conversation {
  conversationId: string;
  memorySpaceId: string; // Isolation
  messages: Message[];
  createdAt: number; // Unix timestamp (milliseconds)
  updatedAt: number; // Unix timestamp (milliseconds)
}
```

**Layer 2: Vector Memories (Private to Space)**

```typescript
// Stored in memories table, filtered by memorySpaceId
interface VectorMemory {
  id: string;
  memorySpaceId: string; // Isolation
  content: string;
  embedding: number[];
  metadata: { importance: number; tags: string[]; };
  createdAt: number; // Unix timestamp (milliseconds)
  updatedAt: number; // Unix timestamp (milliseconds)
}
```

**Layer 3: Facts (Private to Space)**

```typescript
// Stored in facts table, filtered by memorySpaceId
interface Fact {
  id: string;
  memorySpaceId: string; // Isolation
  participantId?: string; // Hive Mode tracking
  userId?: string; // GDPR compliance
  fact: string;
  factType: string;
  confidence: number;
  createdAt: number; // Unix timestamp (milliseconds)
  updatedAt: number; // Unix timestamp (milliseconds)
}
```

**Layer 4: Convenience APIs**

```typescript
// Wraps L1-3 with simple interface
await cortex.memory.remember({ memorySpaceId, ... }); // Stores in L1a + L2 + L3
await cortex.memory.recall({ memorySpaceId, query }); // Searches L2 + L3 + graph
await cortex.memory.search(memorySpaceId, query); // Searches L2 (vector) only
```

## Multi-Tenancy Support

> **New Feature**: Memory spaces support full multi-tenant isolation via `tenantId` (auto-injected from AuthContext).

All memory space operations automatically include tenant isolation when using auth context:

```typescript
import { Cortex, createAuthContext } from "@cortexmemory/sdk";

// Initialize with tenant context
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth: createAuthContext({
    userId: "user-123",
    tenantId: "customer-acme", // Tenant isolation
    sessionId: "session-xyz",
  }),
});

// All operations are now scoped to tenant-acme
await cortex.memorySpaces.register({
  memorySpaceId: "user-123-personal",
  // tenantId automatically injected from auth context
  name: "User Memory",
  type: "personal",
});

// Queries automatically filtered by tenant
const spaces = await cortex.memorySpaces.list();
// Only returns spaces for tenant-acme
```

See [Auth Integration](../08-integrations/auth-providers.md) for complete multi-tenancy documentation.

## Creating Memory Spaces

### Option 1: Implicit (Recommended for Most Cases)

Just use a `memorySpaceId` - space created automatically on first use:

```typescript
// First call creates space automatically
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  conversationId: "conv-123",
  userMessage: "Hello",
  agentResponse: "Hi!",
  userId: "user-123",
  userName: "Alice",
});
```

**Benefits:**

- Zero ceremony
- Works immediately
- Perfect for development

### Option 2: Explicit Registration (Recommended for Production)

Register the space with metadata for analytics and tracking:

```typescript
// Register once
await cortex.memorySpaces.register({
  memorySpaceId: "user-123-personal",
  name: "Alice's Personal AI Memory",
  type: "personal",
  participants: [
    { id: "cursor", type: "ai-tool" },
    { id: "claude", type: "ai-tool" },
    { id: "notion-ai", type: "ai-tool" },
  ], // For Hive Mode
  metadata: {
    owner: "user-123",
    environment: "production",
    created: Date.now(), // Unix timestamp (milliseconds)
  },
});

// Now use it
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  participantId: "cursor",
  // ...
});
```

**Benefits:**

- Enhanced analytics
- Participant tracking (Hive Mode)
- Better observability
- Metadata for organization

## Naming Conventions

### Good Patterns

```typescript
// Personal spaces
"user-{userId}-personal";
"user-123-personal";
"alice-workspace";

// Team spaces
"team-{teamName}-workspace";
"team-engineering-memory";
"support-team-context";

// Project spaces
"project-{projectName}";
"project-apollo-knowledge";
"client-acme-history";

// Agent spaces (Collaboration Mode)
"{agentName}-agent-space";
"finance-agent-space";
"security-scanner-space";
```

### Avoid

```typescript
// Bad: Too generic
"space1";
"memory";
"default";

// Bad: No structure
"abc123";
"temp";
"test";
```

## Isolation Guarantees

### What's Isolated

```typescript
// Space A
await cortex.memory.remember({
  memorySpaceId: "user-alice-personal",
  userMessage: "Secret information for Alice",
  // ...
});

// Space B cannot see it
const memories = await cortex.memory.search("user-bob-personal", "secret");
// Returns: [] (empty - different memory space)
```

**Guarantees:**

- ✅ Complete data isolation
- ✅ No accidental leakage
- ✅ GDPR-compliant deletion (delete one space, others unaffected)
- ✅ Independent analytics per space

### Cross-Space Access (Context Chains)

Limited cross-space access is possible via **context chains**:

```typescript
// Supervisor creates context
const context = await cortex.contexts.create({
  purpose: "Process refund request",
  memorySpaceId: "supervisor-space",
  userId: "user-123",
});

// Specialist can access supervisor's context (read-only, limited)
const fullContext = await cortex.contexts.get(context.id, {
  includeChain: true,
  requestingSpace: "specialist-space", // Cross-space access
});

// Specialist can read:
// ✅ The context chain (hierarchy)
// ✅ Conversations referenced in context
// ❌ Supervisor's other memories (isolated)
```

**Security Model:**

- Read-only access
- Only context-referenced data
- Audit trail for all cross-space reads
- Prevents memory poisoning

**Learn more:** [Context Chains](./04-context-chains.md)

## Participant Tracking (Hive Mode)

### What is participantId?

```typescript
interface Participant {
  id: string; // e.g., "cursor", "claude", "my-bot"
  type: string; // e.g., "ai-tool", "agent", "user", "tool"
  joinedAt: number; // Unix timestamp (milliseconds)
}
```

**Purpose:** Track "who stored what" in a shared memory space (Hive Mode).

### Usage

```typescript
// Cursor stores with participant tracking
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Shared space
  participantId: "cursor", // Who stored it
  conversationId: "conv-abc",
  userMessage: "I prefer TypeScript",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "Alice",
});

// Later, filter by participant
const cursorMemories = await cortex.memory.list("user-123-personal", {
  participantId: "cursor",
});

// Or analyze all participants
const memories = await cortex.memory.list("user-123-personal");
memories.forEach((m) => {
  console.log(`Stored by: ${m.participantId}`);
});
```

**Benefits:**

- **Debugging:** "Which tool stored incorrect information?"
- **Analytics:** "Which participant is most active?"
- **Audit:** "Who had access to this data?"
- **Cleanup:** Delete specific participant's contributions

## Memory Space Lifecycle

### Create → Use → Delete

```typescript
// 1. Create (implicit or explicit)
await cortex.memorySpaces.register({
  memorySpaceId: "project-apollo",
  name: "Apollo Project Memory",
  type: "project",
});

// 2. Use (store and retrieve)
await cortex.memory.remember({ memorySpaceId: "project-apollo", ... });
const memories = await cortex.memory.search("project-apollo", query);

// 3. Archive (mark inactive, keep data)
await cortex.memorySpaces.archive("project-apollo", {
  reason: "Project completed",
});

// 4. Delete (GDPR-compliant, complete removal)
await cortex.memorySpaces.delete("project-apollo", {
  cascade: true, // Delete all memories, facts, conversations
  reason: "Project archived, data retention expired",
});
```

### Archival

```typescript
// Archive space (keeps data, marks inactive)
await cortex.memorySpaces.archive("old-project-space", {
  reason: "Project completed",
  metadata: {
    archivedBy: "admin-123",
    archivedAt: Date.now(), // Unix timestamp (milliseconds)
  },
});

// List only active spaces
const activeSpaces = await cortex.memorySpaces.list({
  status: "active",
});

// Reactivate if needed
await cortex.memorySpaces.reactivate("old-project-space");
```

## Analytics and Observability

### Memory Space Stats

```typescript
const stats = await cortex.memorySpaces.getStats("user-123-personal");

console.log(stats);
// {
//   memorySpaceId: "user-123-personal",
//   totalMemories: 1543,
//   totalConversations: 45,
//   totalFacts: 234,
//   totalMessages: 890,
//   memoriesThisWindow: 234, // Based on timeWindow option
//   conversationsThisWindow: 12,
//   storage: {
//     conversationsBytes: 45600,
//     memoriesBytes: 234000,
//     factsBytes: 12300,
//     totalBytes: 291900
//   },
//   avgSearchTime: '12ms',
//   topTags: ['preferences', 'code', 'project'],
//   importanceBreakdown: {
//     critical: 23,  // 90-100
//     high: 100,     // 70-89
//     medium: 987,   // 40-69
//     low: 400,      // 10-39
//     trivial: 33    // 0-9
//   },
//   // With includeParticipants: true
//   participants: [
//     {
//       participantId: "cursor",
//       memoriesStored: 456,
//       conversationsStored: 15,
//       factsExtracted: 67,
//       firstActive: 1704067200000,
//       lastActive: 1735689600000,
//       avgImportance: 72,
//       topTags: ["code", "preferences"]
//     },
//     // ... more participants
//   ]
// }
```

### List Memory Spaces

```typescript
// List all spaces
const spaces = await cortex.memorySpaces.list();

// Filter by type
const personalSpaces = await cortex.memorySpaces.list({
  type: "personal",
});

// Filter by metadata
const prodSpaces = await cortex.memorySpaces.list({
  metadata: { environment: "production" },
});

// Search by name
const apolloSpaces = await cortex.memorySpaces.search("apollo");
```

## Use Cases

### 1. Personal AI Assistant

```typescript
// One space per user, all their AI tools share it
const memorySpaceId = `user-${userId}-personal`;

// Cursor, Claude, Notion AI all use same space
await cortex.memory.remember({
  memorySpaceId,
  participantId: "cursor",
  // ...
});
```

### 2. Multi-Tenant SaaS

```typescript
// One space per customer
const memorySpaceId = `customer-${customerId}-space`;

// Complete isolation between customers
await cortex.memory.remember({
  memorySpaceId,
  participantId: "saas-app",
  // ...
});
```

### 3. Team Collaboration

```typescript
// One space per team
const memorySpaceId = `team-${teamId}-workspace`;

// All team bots share memory
await cortex.memory.remember({
  memorySpaceId,
  participantId: "code-review-bot",
  // ...
});

await cortex.memory.remember({
  memorySpaceId,
  participantId: "deployment-bot",
  // ...
});
```

### 4. Project-Based

```typescript
// One space per project
const memorySpaceId = `project-${projectId}`;

// Project context isolated from other projects
await cortex.memory.remember({
  memorySpaceId,
  participantId: "project-manager-bot",
  // ...
});
```

### 5. Autonomous Agents (Collaboration Mode)

```typescript
// Each agent has its own space
const financeSpace = "finance-agent-space";
const hrSpace = "hr-agent-space";

// Complete isolation, communicate via A2A
await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "Budget approved",
});
// Dual-write to both spaces
```

## Migration from Agent-Centric Model

### Before (Agent-Centric)

```typescript
// OLD: agentId was isolation boundary
await cortex.memory.remember({
  agentId: "my-agent", // Isolated per agent
  conversationId: "conv-123",
  userMessage: "Hello",
  agentResponse: "Hi!",
  userId: "user-123",
  userName: "User",
});
```

### After (Memory-Space-Centric)

```typescript
// NEW: memorySpaceId is isolation boundary
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Isolated per space
  participantId: "my-agent", // Optional tracking
  conversationId: "conv-123",
  userMessage: "Hello",
  agentResponse: "Hi!",
  userId: "user-123",
  userName: "User",
});
```

### Migration Helper

```typescript
// Migrate old agent-centric data to memory spaces
async function migrateToMemorySpaces() {
  // Map: agent → memory space
  const agentToSpace = {
    "cursor-agent": "user-123-personal",
    "claude-agent": "user-123-personal", // Same space for Hive Mode
    "finance-agent": "finance-agent-space", // Separate for Collaboration Mode
  };

  for (const [agentId, memorySpaceId] of Object.entries(agentToSpace)) {
    // Get old agent's memories
    const oldMemories = await cortex.memory.list(agentId);

    // Copy to new memory space
    for (const memory of oldMemories) {
      await cortex.memory.remember({
        memorySpaceId,
        participantId: agentId, // Track origin
        conversationId: memory.conversationRef?.conversationId,
        userMessage: memory.content,
        agentResponse: "",
        userId: memory.userId,
        userName: memory.userId,
      });
    }
  }
}
```

## Best Practices

### 1. Use Descriptive Names

```typescript
// ✅ GOOD: Clear, scoped, structured
"user-123-personal";
"team-engineering-workspace";
"project-apollo-memory";

// ❌ BAD: Generic, ambiguous
"space1";
"memory";
"default";
```

### 2. Register Spaces for Production

```typescript
// Development: Implicit is fine
await cortex.memory.remember({ memorySpaceId: "test-space", ... });

// Production: Explicit registration
await cortex.memorySpaces.register({
  memorySpaceId: "user-123-personal",
  name: "Alice's Personal Space",
  type: "personal",
  metadata: { environment: "production" },
});
```

### 3. Always Set participantId in Hive Mode

```typescript
// ✅ GOOD: Track who stored what
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  participantId: "deployment-bot", // Clear tracking
  // ...
});

// ⚠️ ACCEPTABLE but not recommended
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  // participantId omitted - harder to debug
  // ...
});
```

### 4. Choose the Right Mode

```typescript
// Hive Mode: Multiple tools share space
// Use when: Personal AI, MCP, team bots
const memorySpaceId = "user-123-personal"; // Shared

// Collaboration Mode: Separate spaces
// Use when: Autonomous agents, compliance, isolation
const financeSpace = "finance-agent-space"; // Separate
const hrSpace = "hr-agent-space"; // Separate
```

### 5. Plan for GDPR

```typescript
// Easy deletion per user
await cortex.memorySpaces.delete(`user-${userId}-personal`, {
  cascade: true,
  reason: "GDPR deletion request",
});

// Or per project
await cortex.memorySpaces.delete(`project-${projectId}`, {
  cascade: true,
  reason: "Project data retention expired",
});
```

## Security Considerations

### Data Isolation

```typescript
// Each space is completely isolated
// No queries can cross memory space boundaries (unless via context chains)

// Space A
await cortex.memory.remember({ memorySpaceId: "space-a", ... });

// Space B cannot access
const memories = await cortex.memory.search("space-b", query);
// Will NEVER return memories from space-a
```

### Access Control

```typescript
// Memory spaces don't have built-in user permissions
// Implement access control in your application layer

async function canAccessMemorySpace(
  userId: string,
  memorySpaceId: string,
): Promise<boolean> {
  // Your authorization logic
  const space = await cortex.memorySpaces.get(memorySpaceId);
  return space.metadata.owner === userId || space.participants.includes(userId);
}

// Then in your API
if (!(await canAccessMemorySpace(req.user.id, memorySpaceId))) {
  throw new Error("Unauthorized");
}

const memories = await cortex.memory.search(memorySpaceId, query);
```

### Cross-Space Access (Limited)

```typescript
// Only via context chains, with explicit delegation
const context = await cortex.contexts.create({
  purpose: "Delegated task",
  memorySpaceId: "supervisor-space",
  grantReadAccess: ["specialist-space"], // Explicit permission
});

// specialist-space can now read THIS context's data (limited)
// NOT all of supervisor-space
```

## Common Pitfalls

### Pitfall 1: Using User ID as Memory Space ID

```typescript
// ❌ BAD: User ID directly
await cortex.memory.remember({
  memorySpaceId: "user-123", // Fragile
  // ...
});

// ✅ GOOD: Structured naming
await cortex.memory.remember({
  memorySpaceId: "user-123-personal", // Clear purpose
  // ...
});
```

### Pitfall 2: Mixing Hive and Collaboration Patterns

```typescript
// ❌ BAD: Inconsistent usage
await cortex.memory.remember({ memorySpaceId: "shared-space", ... }); // Hive
await cortex.a2a.send({ from: "agent-1", to: "agent-2", ... }); // Collaboration
// Confusing!

// ✅ GOOD: Pick one pattern
// Either Hive Mode (shared spaces) OR Collaboration Mode (separate spaces)
```

### Pitfall 3: Forgetting participantId

```typescript
// ❌ BAD: No tracking in Hive Mode
await cortex.memory.remember({
  memorySpaceId: "team-workspace", // Shared
  // participantId: ??? // Forgot to track!
  // ...
});
// Later: "Who stored bad data?" - Can't tell!

// ✅ GOOD: Always track
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  participantId: "buggy-bot", // Clear tracking
  // ...
});
```

## GDPR Cascade Deletion

Memory spaces participate in cascade deletion when users are deleted:

```typescript
// Delete all data for a user across all memory spaces
await cortex.users.delete("user-123", { cascade: true });

// Cascade automatically deletes from:
// ✅ User profile
// ✅ All conversations with userId in ALL memory spaces
// ✅ All vector memories with userId in ALL memory spaces
// ✅ All facts with userId in ALL memory spaces
// ✅ All sessions with userId
// ✅ Graph nodes (if configured)

// Memory space deletion
await cortex.memorySpaces.delete("user-123-personal", {
  cascade: true,
  reason: "User requested data deletion (GDPR)",
});
// Deletes the space and ALL data within it
```

See [User Operations API](../03-api-reference/04-user-operations.md) for complete GDPR deletion documentation.

## Conclusion

**Memory spaces** are the foundation of Cortex's architecture. They provide:

- ✅ **Flexible isolation** - One space per user, team, or project
- ✅ **Hive Mode** - Multiple tools share one space (zero duplication)
- ✅ **Collaboration Mode** - Separate spaces with secure cross-space access
- ✅ **Infinite Context** - Recall from unlimited history via retrieval
- ✅ **Clean architecture** - Clear boundaries, no memory poisoning
- ✅ **Multi-tenancy** - Full SaaS isolation via `tenantId`

**Key Takeaway:** `memorySpaceId` replaces `agentId` as the fundamental parameter. Everything else builds on this foundation.

---

**Next Steps:**

- **[Memory Space Operations API](../03-api-reference/11-memory-space-operations.md)** - Complete API reference
- **[Memory Orchestration](./00-memory-orchestration.md)** - Understand how all layers work together
- **[Hive Mode Guide](./10-hive-mode.md)** - Learn multi-tool memory sharing
- **[A2A Communication](./05-a2a-communication.md)** - Learn Collaboration Mode
- **[Context Chains](./04-context-chains.md)** - Learn cross-space delegation
- **[Sessions Management](./14-sessions-management.md)** - Session lifecycle within spaces
- **[Governance Policies](../03-api-reference/10-governance-policies-api.md)** - Configure retention rules

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
