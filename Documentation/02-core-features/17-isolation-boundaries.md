# Isolation Boundaries

> **Last Updated**: 2026-01-01

Understanding Cortex's multi-layered isolation model for security, privacy, and compliance.

## Overview

Cortex provides **four layers of isolation** that work together to ensure data security, enable multi-tenancy, and maintain privacy boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                   Isolation Hierarchy                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. TENANT ISOLATION (tenantId)                      │  │
│  │     Multi-tenant SaaS platform separation            │  │
│  │     ├─ Auto-injected from AuthContext                │  │
│  │     ├─ Enforced at ALL layers                        │  │
│  │     └─ Complete data separation per tenant           │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────┐    │  │
│  │  │  2. MEMORY SPACE ISOLATION (memorySpaceId)  │    │  │
│  │  │     Fundamental data boundary               │    │  │
│  │  │     ├─ Private to space                     │    │  │
│  │  │     ├─ Hive or Collaboration Mode           │    │  │
│  │  │     └─ Cross-space via Context Chains only  │    │  │
│  │  │                                              │    │  │
│  │  │  ┌──────────────────────────────────────┐  │    │  │
│  │  │  │  3. USER ISOLATION (userId)          │  │    │  │
│  │  │  │     GDPR compliance boundary         │  │    │  │
│  │  │  │     ├─ Optional on all entities      │  │    │  │
│  │  │  │     ├─ Enables cascade deletion      │  │    │  │
│  │  │  │     └─ Privacy-first design          │  │    │  │
│  │  │  │                                       │  │    │  │
│  │  │  │  ┌───────────────────────────────┐  │  │    │  │
│  │  │  │  │  4. PARTICIPANT TRACKING      │  │  │    │  │
│  │  │  │  │     (participantId)            │  │  │    │  │
│  │  │  │  │     Hive Mode attribution     │  │  │    │  │
│  │  │  │  │     ├─ Who stored what?        │  │  │    │  │
│  │  │  │  │     ├─ Audit trail            │  │  │    │  │
│  │  │  │  │     └─ Debugging support      │  │  │    │  │
│  │  │  │  └───────────────────────────────┘  │  │    │  │
│  │  │  └──────────────────────────────────────┘  │    │  │
│  │  └─────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Each layer serves a distinct purpose and can be used independently or combined.

---

## 1. Tenant Isolation (Multi-Tenant SaaS)

> **Purpose:** Complete data separation for SaaS platforms serving multiple organizations.

### What is Tenant Isolation?

**Tenant isolation** ensures that customers of a SaaS platform cannot access each other's data. Every entity in Cortex can be tagged with a `tenantId`, which is automatically enforced across all operations.

**Automatic via Auth Context:**

```typescript
import { Cortex, createAuthContext } from "@cortexmemory/sdk";

// Initialize with tenant context (one-time setup)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth: createAuthContext({
    tenantId: "customer-acme",    // All operations scoped to this tenant
    userId: "user-123",
    sessionId: "session-xyz",
  }),
});

// All operations automatically include tenantId
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  // tenantId: "customer-acme" ← Auto-injected!
  conversationId: "conv-123",
  userMessage: "Hello",
  agentResponse: "Hi!",
  userId: "user-123",
  userName: "Alice",
});

// Queries are automatically filtered by tenant
const memories = await cortex.memory.search("user-123-personal", "preferences");
// Only returns data from tenant "customer-acme"

const spaces = await cortex.memorySpaces.list();
// Only returns spaces for tenant "customer-acme"
```

### Which Layers Support Tenant Isolation?

**ALL Cortex layers automatically support `tenantId`:**

| Layer | API | Tenant Support | How |
|-------|-----|----------------|-----|
| **Layer 1a** | `cortex.conversations.*` | ✅ Full | Auto-injected from AuthContext |
| **Layer 1b** | `cortex.immutable.*` | ✅ Full | Auto-injected from AuthContext |
| **Layer 1c** | `cortex.mutable.*` | ✅ Full | Auto-injected from AuthContext |
| **Layer 2** | `cortex.vector.*` | ✅ Full | Auto-injected from AuthContext |
| **Layer 3** | `cortex.facts.*` | ✅ Full | Auto-injected from AuthContext |
| **Layer 4** | `cortex.memory.*` | ✅ Full | Auto-injected from AuthContext |
| **Spaces** | `cortex.memorySpaces.*` | ✅ Full | Auto-injected from AuthContext |
| **Users** | `cortex.users.*` | ✅ Full | Auto-injected from AuthContext |
| **Contexts** | `cortex.contexts.*` | ✅ Full | Auto-injected from AuthContext |
| **Sessions** | `cortex.sessions.*` | ✅ Full | Auto-injected from AuthContext |
| **Graph** | Graph nodes | ✅ Full | `tenantId` property on all nodes |

### Complete Tenant Separation Example

```typescript
// Tenant A's Cortex instance
const cortexTenantA = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth: createAuthContext({
    tenantId: "tenant-acme",
    userId: "admin-alice",
  }),
});

// Tenant B's Cortex instance
const cortexTenantB = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth: createAuthContext({
    tenantId: "tenant-globalco",
    userId: "admin-bob",
  }),
});

// Tenant A creates data
await cortexTenantA.memory.remember({
  memorySpaceId: "team-workspace",
  conversationId: "conv-1",
  userMessage: "Acme Corp confidential strategy",
  agentResponse: "Noted securely",
  userId: "user-alice",
  userName: "Alice",
});

// Tenant B CANNOT access Tenant A's data (even with same memorySpaceId!)
const memories = await cortexTenantB.memory.search("team-workspace", "strategy");
// Returns: [] (empty - different tenant)

// Each tenant has complete isolation:
const spacesA = await cortexTenantA.memorySpaces.list();
const spacesB = await cortexTenantB.memorySpaces.list();
// Completely independent lists
```

### Multi-Tenancy Guarantees

**Cortex provides ironclad tenant isolation:**

- ✅ **Query isolation** - Automatic filtering by `tenantId` on all reads
- ✅ **Write isolation** - `tenantId` auto-injected on all writes
- ✅ **GDPR isolation** - Cascade deletion respects tenant boundaries
- ✅ **Graph isolation** - All graph nodes include `tenantId` property
- ✅ **Session isolation** - Sessions are tenant-scoped
- ✅ **Analytics isolation** - Stats computed per-tenant only

**Security Model:**

```typescript
// Tenant A cannot query Tenant B's data by ANY means:
// ❌ Cannot access via memorySpaceId overlap
// ❌ Cannot access via userId overlap
// ❌ Cannot access via context chains
// ❌ Cannot access via graph queries
// ✅ Complete separation guaranteed at database level
```

### Implementation Details

When using AuthContext, the SDK automatically:

1. **Injects tenantId** into all create/update operations
2. **Filters by tenantId** on all query operations
3. **Validates tenant access** on all cross-entity operations
4. **Logs tenant context** in all audit trails

```typescript
// Developer code (clean, no tenant boilerplate)
await cortex.memory.remember({ memorySpaceId, ... });

// SDK internals (automatic)
await convex.mutation(api.memories.store, {
  memorySpaceId,
  tenantId: authContext.tenantId,  // ← Auto-injected
  ...params
});
```

### Multi-Tenant Administration

**Per-Tenant Configuration:**

```typescript
// Different governance policies per tenant
await cortex.governance.setPolicy({
  organizationId: "tenant-acme",
  sessions: {
    lifecycle: {
      idleTimeout: "1h",      // Enterprise customer - longer sessions
      maxDuration: "7d",
    },
  },
  vector: {
    retention: {
      defaultVersions: 20,    // More history
    },
  },
});

await cortex.governance.setPolicy({
  organizationId: "tenant-startup",
  sessions: {
    lifecycle: {
      idleTimeout: "30m",     // Standard timeout
      maxDuration: "24h",
    },
  },
  vector: {
    retention: {
      defaultVersions: 10,    // Standard history
    },
  },
});
```

**Per-Tenant Analytics:**

```typescript
// Get stats for a tenant
const tenantSpaces = await cortex.memorySpaces.list({
  tenantId: "tenant-acme",  // Optional explicit filter
  status: "active",
});

const tenantUsers = await cortex.users.list({
  tenantId: "tenant-acme",
  limit: 1000,
});

console.log(`Tenant has ${tenantSpaces.total} spaces, ${tenantUsers.total} users`);
```

---

## 2. Memory Space Isolation (Fundamental Boundary)

> **Purpose:** Core data isolation boundary for organizing memories, conversations, and facts.

### What is Memory Space Isolation?

**Memory spaces** are Cortex's fundamental isolation boundary. Every memory, conversation, and fact belongs to exactly ONE memory space and can only be accessed via that space.

```typescript
// Space A
await cortex.memory.remember({
  memorySpaceId: "user-alice-personal",  // Space A
  userMessage: "My secret is Blue",
  agentResponse: "I'll keep it safe",
  userId: "alice",
  userName: "Alice",
});

// Space B cannot see Space A's data
const memories = await cortex.memory.search("user-bob-personal", "secret");
// Returns: [] (different memory space)
```

### What's Isolated by Memory Space?

**Memory-Space-Scoped (Private):**

- ✅ **Layer 1a: Conversations** - `cortex.conversations.*`
- ✅ **Layer 2: Vector Memories** - `cortex.vector.*`
- ✅ **Layer 3: Facts** - `cortex.facts.*`
- ✅ **Layer 4: Memory API** - `cortex.memory.*`

**TRULY Shared (No Memory Space Scoping):**

- 🌍 **Layer 1b: Immutable Store** - `cortex.immutable.*` (KB, policies, org docs)
- 🌍 **Layer 1c: Mutable Store** - `cortex.mutable.*` (config, inventory, counters)
- 🌍 **User Profiles** - `cortex.users.*` (shared across ALL spaces)

### Two Isolation Patterns

**Hive Mode: Shared Space**

Multiple participants share ONE memory space (zero duplication):

```typescript
// All AI tools share user's personal space
const memorySpaceId = "user-123-personal"; // One space for all tools

// Cursor stores
await cortex.memory.remember({
  memorySpaceId,
  participantId: "cursor",  // Track who stored it
  userMessage: "I prefer TypeScript",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "Alice",
});

// Claude reads same space
const memories = await cortex.memory.search(memorySpaceId, "preferences");
// ✅ Returns memories stored by cursor (zero duplication!)
```

**Collaboration Mode: Separate Spaces**

Each participant has their OWN memory space (full isolation):

```typescript
// Finance agent has separate space
await cortex.memory.remember({
  memorySpaceId: "finance-agent-space",  // Separate
  userMessage: "Approve $50k budget",
  agentResponse: "Approved",
  userId: "user-123",
  userName: "CFO",
});

// HR agent has separate space
await cortex.memory.remember({
  memorySpaceId: "hr-agent-space",  // Separate
  userMessage: "Hire 5 engineers",
  agentResponse: "Posted job listings",
  userId: "user-123",
  userName: "CFO",
});

// Communication via A2A (dual-write to both spaces)
await cortex.a2a.send({
  from: "finance-agent",
  to: "hr-agent",
  message: "Budget approved for hiring",
});
// ✅ Stored in BOTH spaces automatically
```

### Cross-Space Access (Limited)

**Only via Context Chains** - explicit delegation with read-only access:

```typescript
// Supervisor creates context in their space
const context = await cortex.contexts.create({
  purpose: "Process refund request",
  memorySpaceId: "supervisor-space",
  userId: "user-123",
});

// Grant access to specialist (explicit permission)
await cortex.contexts.grantAccess(
  context.contextId,
  "specialist-space",
  "read-only"
);

// Specialist can read THIS context (not entire supervisor space)
const ctx = await cortex.contexts.get(context.contextId, {
  requestingSpace: "specialist-space",
});

// ✅ Can read: Context chain, referenced conversations
// ❌ Cannot read: Supervisor's other memories
```

**Security Model:**

- Cross-space access requires explicit `grantAccess()` call
- Read-only by default
- Limited to context-referenced data only
- Full audit trail of cross-space reads
- No memory poisoning possible

---

## 3. User Data Isolation (GDPR Compliance)

> **Purpose:** Enable GDPR "right to be forgotten" via cascade deletion across all layers.

### What is User Data Isolation?

**User data isolation** enables linking data to users via the optional `userId` field. This powers GDPR-compliant cascade deletion - delete all data for a specific user across ALL memory spaces and layers.

### How userId Works

**All stores support optional `userId` field:**

```typescript
// Link conversation to user
await cortex.conversations.create({
  memorySpaceId: "support-bot-space",
  type: "user-agent",
  participants: {
    userId: "user-123",  // ← GDPR link
    agentId: "support-agent",
  },
});

// Link memory to user
await cortex.vector.store("support-bot-space", {
  content: "User prefers email support",
  userId: "user-123",  // ← GDPR link
  source: { type: "conversation" },
  metadata: { importance: 70 },
});

// Link fact to user
await cortex.facts.store({
  memorySpaceId: "support-bot-space",
  userId: "user-123",  // ← GDPR link
  fact: "User is enterprise tier",
  factType: "relationship",
  confidence: 100,
  sourceType: "system",
});

// Link immutable record to user (e.g., feedback)
await cortex.immutable.store({
  type: "feedback",
  id: "feedback-456",
  userId: "user-123",  // ← GDPR link
  data: {
    rating: 5,
    comment: "Great service!",
  },
});

// Link mutable record to user (e.g., session data)
await cortex.mutable.set(
  "user-sessions",
  "session-abc",
  { active: true, startedAt: Date.now() },
  "user-123"  // ← GDPR link (4th parameter)
);
```

### GDPR Cascade Deletion

**One API call deletes from ALL layers:**

```typescript
// SDK (Free) & Cloud Mode: Cascade deletion implemented
const result = await cortex.users.delete("user-123", {
  cascade: true,    // Delete from ALL layers
  verify: true,     // Verify completeness
});

// Deleted from:
console.log(`Conversations: ${result.conversationsDeleted}`);
console.log(`Messages: ${result.conversationMessagesDeleted}`);
console.log(`Immutable records: ${result.immutableRecordsDeleted}`);
console.log(`Mutable keys: ${result.mutableKeysDeleted}`);
console.log(`Vector memories: ${result.vectorMemoriesDeleted}`);
console.log(`Facts: ${result.factsDeleted}`);
console.log(`Sessions: ${result.sessionsDeleted}`);
console.log(`Graph nodes: ${result.graphNodesDeleted || "N/A"}`);

// Summary
console.log(`Total: ${result.totalDeleted} records`);
console.log(`Affected layers: ${result.deletedLayers.join(", ")}`);
```

**Verification:**

```typescript
if (result.verification.complete) {
  console.log("✅ Deletion verified - no orphaned records");
} else {
  console.warn("⚠️ Issues found:");
  result.verification.issues.forEach(issue => console.warn(`  - ${issue}`));
}
```

### Multi-Tenant + GDPR

When both tenant and user isolation are active:

```typescript
// Tenant context + user deletion
const cortex = new Cortex({
  auth: createAuthContext({
    tenantId: "tenant-acme",
    userId: "admin-user",
  }),
});

// Delete user within tenant
await cortex.users.delete("user-123", { cascade: true });

// Deletes ALL data with:
// ✅ userId = "user-123"
// ✅ tenantId = "tenant-acme" (from auth context)
// ❌ Does NOT affect user-123 in other tenants
```

**Tenant-Aware Cascade:**

```
tenantId="tenant-acme" + userId="user-123" cascade:

Tenant A                           Tenant B
├─ User: user-123 (DELETE) ✅      ├─ User: user-123 (KEEP) ✅
├─ Memories with user-123 ✅       ├─ Memories with user-123 ✅
└─ Facts with user-123 ✅          └─ Facts with user-123 ✅
   DELETED                            PRESERVED
```

---

## 4. Participant Tracking (Hive Mode Attribution)

> **Purpose:** Track "who stored what" in shared memory spaces for debugging, auditing, and analytics.

### What is Participant Tracking?

In **Hive Mode** (multiple tools share one space), `participantId` tracks which participant stored each piece of data. This is NOT an isolation boundary - it's an attribution mechanism.

```typescript
// Cursor stores with participant ID
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",  // Shared space
  participantId: "cursor",             // Attribution
  userMessage: "I like Python",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "Alice",
});

// Claude stores to same space with different participant ID
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",  // Same shared space
  participantId: "claude",             // Different attribution
  userMessage: "I prefer TypeScript",
  agentResponse: "Got it!",
  userId: "user-123",
  userName: "Alice",
});

// Both are visible to all participants in the space
const allMemories = await cortex.memory.search("user-123-personal", "programming");
// Returns BOTH memories (no isolation, just tracking)

// Filter by participant for debugging
const cursorMemories = await cortex.memory.list("user-123-personal", {
  participantId: "cursor",
});
console.log(`Cursor stored ${cursorMemories.length} memories`);
```

### Participant vs Isolation

**participantId is NOT isolation** - it's tracking:

| Aspect | Memory Space Isolation | Participant Tracking |
|--------|------------------------|----------------------|
| **Purpose** | Data privacy | Data attribution |
| **Field** | `memorySpaceId` (required) | `participantId` (optional) |
| **Effect** | Complete isolation | Shared visibility |
| **Query** | Must match to access | Can filter optionally |
| **Use Case** | Privacy boundaries | Debugging, analytics |
| **Example** | User A vs User B spaces | Cursor vs Claude in shared space |

### Participant Analytics

**Track participant activity:**

```typescript
const stats = await cortex.memorySpaces.getStats("user-123-personal", {
  includeParticipants: true,
});

// Per-participant breakdown
stats.participants?.forEach((p) => {
  console.log(`${p.participantId}:`);
  console.log(`  - Stored: ${p.memoriesStored} memories`);
  console.log(`  - Extracted: ${p.factsExtracted} facts`);
  console.log(`  - Last active: ${new Date(p.lastActive).toISOString()}`);
  console.log(`  - Avg importance: ${p.avgImportance}`);
});
```

**Cleanup by participant:**

```typescript
// Remove all data from a specific participant (useful for debugging)
const cursorData = await cortex.memory.list("user-123-personal", {
  participantId: "old-buggy-tool",
});

// Delete one by one or use deleteMany
for (const memory of cursorData) {
  await cortex.memory.delete("user-123-personal", memory.memoryId);
}
```

---

## Combined Isolation Examples

### Example 1: Multi-Tenant SaaS with Hive Mode

```typescript
// Tenant: customer-acme, User: alice, Shared space for all her tools

const cortex = new Cortex({
  auth: createAuthContext({
    tenantId: "customer-acme",     // Tenant isolation
    userId: "alice",
    sessionId: "session-1",
  }),
});

// Cursor stores
await cortex.memory.remember({
  memorySpaceId: "alice-workspace",  // Memory space isolation
  participantId: "cursor",            // Participant attribution
  userMessage: "Acme Corp project details",
  agentResponse: "Noted securely",
  userId: "alice",                    // User isolation (GDPR)
  userName: "Alice",
});

// Isolation guarantees:
// ✅ Tenant "customer-globalco" cannot access (tenant isolation)
// ✅ User "bob" in same tenant cannot access (memory space isolation)
// ✅ Alice can delete all her data via cascade (user isolation)
// ✅ Can identify that cursor stored it (participant tracking)
```

### Example 2: Enterprise with Strict Isolation

```typescript
// Tenant + Collaboration Mode (separate spaces per agent)

const cortex = new Cortex({
  auth: createAuthContext({
    tenantId: "enterprise-corp",
    userId: "system-user",
  }),
});

// Finance agent has dedicated space
await cortex.memory.remember({
  memorySpaceId: "finance-agent-space",  // Isolated
  userMessage: "Confidential budget data",
  agentResponse: "Stored securely",
  userId: "cfo-user",
  userName: "CFO",
});

// HR agent has dedicated space
await cortex.memory.remember({
  memorySpaceId: "hr-agent-space",       // Isolated
  userMessage: "Employee salary info",
  agentResponse: "Stored securely",
  userId: "hr-manager",
  userName: "HR Manager",
});

// Isolation guarantees:
// ✅ Other tenants cannot access (tenant isolation)
// ✅ Finance cannot see HR space (memory space isolation)
// ✅ HR cannot see Finance space (memory space isolation)
// ✅ Each user's data can be deleted independently (user isolation)
```

### Example 3: Personal AI with GDPR

```typescript
// User has one shared space, multiple AI tools, wants to delete everything

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  // No tenantId - single-tenant app
});

// Register user's shared space
await cortex.memorySpaces.register({
  memorySpaceId: "user-123-personal",
  type: "personal",
  participants: [
    { id: "cursor", type: "ai-tool" },
    { id: "claude", type: "ai-tool" },
    { id: "chatgpt", type: "ai-tool" },
  ],
});

// All tools store to same space with attribution
await cortex.memory.remember({
  memorySpaceId: "user-123-personal",
  participantId: "cursor",
  userId: "user-123",
  userName: "Alice",
  // ...
});

// User requests deletion
await cortex.users.delete("user-123", { cascade: true });

// Deletes:
// ✅ All memories with userId="user-123" across ALL spaces
// ✅ All conversations with userId="user-123"
// ✅ All facts with userId="user-123"
// ✅ User profile
// ✅ All sessions for user-123
// ❌ Memory space "user-123-personal" is NOT deleted (only the data)
```

---

## Isolation Matrix

Complete reference of what's isolated by which field:

| Data Type | tenantId | memorySpaceId | userId | participantId | Truly Shared |
|-----------|----------|---------------|--------|---------------|--------------|
| **Conversations (L1a)** | ✅ | ✅ | Optional | Optional | ❌ |
| **Immutable (L1b)** | ✅ | ❌ | Optional | ❌ | ✅ |
| **Mutable (L1c)** | ✅ | ❌ | Optional | ❌ | ✅ |
| **Vector Memories (L2)** | ✅ | ✅ | Optional | Optional | ❌ |
| **Facts (L3)** | ✅ | ✅ | Optional | Optional | ❌ |
| **User Profiles** | ✅ | ❌ | N/A (is user) | ❌ | ✅ |
| **Memory Spaces** | ✅ | N/A (is space) | ❌ | Via list | Registry |
| **Contexts** | ✅ | ✅ | Optional | ❌ | ❌ |
| **Sessions** | ✅ | Optional | ✅ | ❌ | ❌ |

**Legend:**
- ✅ = Scoping field (data is isolated by this field)
- Optional = Can be set for cascade deletion/filtering
- ❌ = Not applicable
- N/A = Entity IS that type

---

## Best Practices

### 1. Choose the Right Isolation Pattern

**Use Hive Mode when:**
- ✅ Personal AI assistants (Cursor + Claude share memory)
- ✅ MCP integration (all tools share user memory)
- ✅ Team collaboration bots
- ✅ Want zero data duplication

**Use Collaboration Mode when:**
- ✅ Autonomous agent swarms (each agent isolated)
- ✅ Enterprise workflows (compliance isolation)
- ✅ Financial/healthcare apps (strict boundaries)
- ✅ Different security levels per agent

### 2. Always Use tenantId for SaaS

```typescript
// ✅ GOOD: Use AuthContext
const cortex = new Cortex({
  auth: createAuthContext({
    tenantId: req.headers.get("x-tenant-id"),
    userId: req.user.id,
  }),
});
// All operations automatically tenant-scoped

// ❌ BAD: Manual tenantId management
await cortex.memory.remember({
  memorySpaceId: `${tenantId}-user-space`,  // Brittle!
  // ...
});
```

### 3. Link User Data for GDPR

```typescript
// ✅ GOOD: Always set userId for user-related data
await cortex.memory.remember({
  memorySpaceId: "support-bot",
  userId: "user-123",  // Enables cascade deletion
  userMessage: "My account issue",
  agentResponse: "Let me help",
  userName: "Alice",
});

// ❌ BAD: Missing userId
await cortex.memory.remember({
  memorySpaceId: "support-bot",
  // userId: ??? - Missing! Cannot cascade delete
  userMessage: "My account issue",
  agentResponse: "Let me help",
  userName: "Alice",
});
```

### 4. Use participantId in Hive Mode

```typescript
// ✅ GOOD: Track attribution in shared spaces
await cortex.memory.remember({
  memorySpaceId: "team-workspace",
  participantId: "code-review-bot",  // Clear attribution
  // ...
});

// Later: Debug bad data
const badData = await cortex.memory.list("team-workspace", {
  participantId: "buggy-bot",
  tags: ["incorrect"],
});
// Easy to identify source!
```

### 5. Descriptive Memory Space Names

```typescript
// ✅ GOOD: Clear, scoped naming
"user-{userId}-personal"
"team-{teamId}-workspace"
"project-{projectId}-memory"
"tenant-{tenantId}-customer-{customerId}-space"

// ❌ BAD: Generic naming
"space1"
"memory"
"default"
```

---

## Security Guarantees

### Guarantee 1: Tenant Isolation

**No cross-tenant data leakage possible:**

```typescript
// Tenant A creates data
const cortexA = new Cortex({ auth: { tenantId: "tenant-a" } });
await cortexA.memory.remember({ memorySpaceId: "shared-name", ... });

// Tenant B queries same memorySpaceId
const cortexB = new Cortex({ auth: { tenantId: "tenant-b" } });
const memories = await cortexB.memory.search("shared-name", "anything");

// Returns: [] (empty - different tenant)
// ✅ NO DATA LEAKAGE even with identical memorySpaceId
```

### Guarantee 2: Memory Space Isolation

**No cross-space queries possible:**

```typescript
// Store in space A
await cortex.memory.remember({
  memorySpaceId: "space-a",
  userMessage: "Secret data",
  agentResponse: "Stored",
  userId: "user-1",
  userName: "User",
});

// Query space B
const memories = await cortex.memory.search("space-b", "secret");

// Returns: [] (empty - different space)
// ✅ NO ACCESS to space-a from space-b
```

### Guarantee 3: GDPR Cascade

**Complete deletion across all layers:**

```typescript
const result = await cortex.users.delete("user-123", {
  cascade: true,
  verify: true,
});

// If verify: true and complete: false
if (!result.verification.complete) {
  throw new Error("GDPR deletion incomplete!");
}

// ✅ VERIFIED: No orphaned user data remains
```

---

## Common Patterns

### Pattern 1: Single-Tenant App (No tenantId)

```typescript
// Simple app - no multi-tenancy
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  // No tenantId
});

// Isolation layers:
// ✅ Memory spaces (per user/team/project)
// ✅ User data (for GDPR)
// ✅ Participants (for Hive Mode)
```

### Pattern 2: Multi-Tenant SaaS

```typescript
// Per-request tenant isolation
app.post("/api/chat", async (req, res) => {
  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    auth: createAuthContext({
      tenantId: req.tenant.id,        // From auth middleware
      userId: req.user.id,
      sessionId: req.session.id,
    }),
  });

  // All operations automatically tenant-scoped
  await cortex.memory.remember({
    memorySpaceId: `user-${req.user.id}-personal`,
    // tenantId auto-injected
    // ...
  });
});
```

### Pattern 3: Enterprise with Compliance

```typescript
// Financial services - strict isolation + GDPR

const cortex = new Cortex({
  auth: createAuthContext({
    tenantId: "bank-customer-1",          // Tenant isolation
    userId: "compliance-officer",
    sessionId: "session-xyz",
  }),
});

// Separate space per department (Collaboration Mode)
await cortex.memory.remember({
  memorySpaceId: "department-trading",    // Space isolation
  userId: "trader-123",                    // User isolation (GDPR)
  userName: "Trader",
  userMessage: "Execute trade",
  agentResponse: "Trade executed",
});

// Isolation layers:
// ✅ Tenant isolation (bank-customer-1)
// ✅ Space isolation (department-trading)
// ✅ User isolation (trader-123)
// ✅ Audit trail via ACID Layer 1a
```

### Pattern 4: Personal AI with MCP

```typescript
// User with multiple AI tools via MCP

// Memory space is shared across all tools
const memorySpaceId = "user-alice-personal";

// Each tool stores with participant ID
await cortex.memory.remember({
  memorySpaceId,
  participantId: "cursor",
  userId: "alice",
  userName: "Alice",
  // ...
});

await cortex.memory.remember({
  memorySpaceId,
  participantId: "claude-desktop",
  userId: "alice",
  userName: "Alice",
  // ...
});

// Alice's memory follows her across all tools
// No tenantId (single-user app)
// No space isolation (Hive Mode)
// Participant tracking for debugging
```

---

## Cross-Layer Isolation Summary

**How isolation works across Cortex's architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│  Tenant: customer-acme (SaaS platform isolation)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Memory Space: user-123-personal (Hive Mode)       │   │
│  ├────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │  Participant: cursor                                │   │
│  │  ├─ L1a: Conversations (userId: user-123)          │   │
│  │  ├─ L2: Vector Memories (userId: user-123)         │   │
│  │  └─ L3: Facts (userId: user-123)                   │   │
│  │                                                     │   │
│  │  Participant: claude                                │   │
│  │  ├─ L1a: Conversations (userId: user-123)          │   │
│  │  ├─ L2: Vector Memories (userId: user-123)         │   │
│  │  └─ L3: Facts (userId: user-123)                   │   │
│  │                                                     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Memory Space: finance-agent-space (Collab Mode)   │   │
│  ├────────────────────────────────────────────────────┤   │
│  │  (Completely separate, Collaboration Mode)          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  Shared Across ALL Spaces (TRULY shared):                  │
│  ├─ L1b: Immutable (KB, policies) - All agents access      │
│  ├─ L1c: Mutable (config, inventory) - All agents access   │
│  └─ User Profiles (cortex.users.*) - All agents access     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting Isolation Issues

### Issue 1: Data Visible Across Tenants

**Symptom:** Tenant A sees Tenant B's data

**Cause:** Not using AuthContext or tenantId not set

**Fix:**

```typescript
// ✅ Always use AuthContext for multi-tenant apps
const cortex = new Cortex({
  auth: createAuthContext({
    tenantId: req.tenant.id,  // REQUIRED
    userId: req.user.id,
  }),
});
```

### Issue 2: Memory Space Leakage

**Symptom:** Memories from one space appear in another

**Cause:** Using wrong memorySpaceId or no isolation

**Fix:**

```typescript
// ✅ Always use distinct memorySpaceIds
const memorySpaceId = `user-${userId}-personal`;  // Per-user
await cortex.memory.search(memorySpaceId, query);

// ❌ Don't share memorySpaceIds across users
const memorySpaceId = "shared";  // Everyone sees everything!
```

### Issue 3: Cannot Delete User Data

**Symptom:** GDPR deletion doesn't remove all data

**Cause:** userId not set on all entities

**Fix:**

```typescript
// ✅ Always set userId when storing user data
await cortex.memory.remember({
  memorySpaceId: "bot-space",
  userId: "user-123",  // Required for cascade
  userMessage: "User's data",
  agentResponse: "Stored",
  userName: "User",
});

// Then cascade works
await cortex.users.delete("user-123", { cascade: true });
```

### Issue 4: Participant Confusion

**Symptom:** Can't identify who stored bad data

**Cause:** participantId not used in Hive Mode

**Fix:**

```typescript
// ✅ Always use participantId in Hive Mode
await cortex.memory.remember({
  memorySpaceId: "shared-space",
  participantId: "new-bot",  // Attribution
  // ...
});

// Later: Find bad data
const badData = await cortex.memory.list("shared-space", {
  participantId: "new-bot",
  tags: ["error"],
});
```

---

## Conclusion

Cortex provides **four complementary isolation layers**:

1. **Tenant Isolation** (`tenantId`) - Multi-tenant SaaS separation
2. **Memory Space Isolation** (`memorySpaceId`) - Fundamental data boundary
3. **User Data Isolation** (`userId`) - GDPR compliance
4. **Participant Tracking** (`participantId`) - Hive Mode attribution

**Key Insights:**

- ✅ Use **AuthContext** for automatic tenant injection (zero boilerplate)
- ✅ Use **memory spaces** as primary isolation (Hive or Collaboration)
- ✅ Always set **userId** for GDPR compliance
- ✅ Use **participantId** for debugging in Hive Mode
- ✅ Combine all four for maximum security and compliance

**When in doubt:**
- Multi-tenant SaaS → Use ALL four layers
- Single-tenant app → Use memory spaces + userId + participantId
- Simple prototype → Use memory spaces only

---

## Next Steps

- **[Memory Spaces Guide](./01-memory-spaces.md)** - Detailed memory space concepts
- **[Hive Mode Guide](./10-hive-mode.md)** - Multi-participant shared spaces
- **[A2A Communication](./05-a2a-communication.md)** - Collaboration Mode patterns
- **[Auth Integration](../08-integrations/auth-providers.md)** - AuthContext setup for multi-tenancy
- **[User Operations API](../03-api-reference/04-user-operations.md)** - GDPR cascade deletion
- **[Memory Space Operations API](../03-api-reference/11-memory-space-operations.md)** - Space management
- **[Sessions Operations API](../03-api-reference/14-sessions-operations.md)** - Session isolation

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
