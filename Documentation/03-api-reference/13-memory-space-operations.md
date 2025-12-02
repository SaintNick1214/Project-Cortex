# Memory Space Operations API

> **Last Updated**: 2025-10-28

This document covers the `cortex.memorySpaces.*` namespace for managing memory spaces, participants, and access control.

## Overview

**Memory spaces** are the fundamental isolation boundary in Cortex. The `cortex.memorySpaces.*` API provides explicit management and registration capabilities beyond the implicit creation that happens automatically when you first use a memorySpaceId.

**When to use this API:**

- ✅ Production deployments (explicit registration)
- ✅ Analytics and observability needs
- ✅ Hive Mode with participant tracking
- ✅ Memory space lifecycle management
- ✅ Access control and permissions

**When you don't need it:**

- ⚠️ Quick prototypes (use implicit creation)
- ⚠️ Simple single-agent apps
- ⚠️ When you just want memory to "just work"

---

## Table of Contents

- [register()](#register) - Register a memory space with metadata
- [get()](#get) - Retrieve memory space details
- [list()](#list) - List all memory spaces
- [search()](#search) - Search memory spaces by metadata
- [update()](#update) - Update memory space metadata
- [updateParticipants()](#updateparticipants) - Add/remove participants (Hive Mode)
- [archive()](#archive) - Mark memory space as inactive
- [reactivate()](#reactivate) - Reactivate archived space
- [delete()](#delete) - Delete memory space and all data
- [getStats()](#getstats) - Get analytics for a memory space

---

## register()

Register a memory space with metadata and participant tracking.

### Signature

```typescript
cortex.memorySpaces.register(
  params: RegisterMemorySpaceParams,
  options?: { syncToGraph?: boolean }
): Promise<MemorySpace>
```

### Parameters

```typescript
interface RegisterMemorySpaceParams {
  id: string; // Memory space ID (e.g., "user-123-personal")
  name?: string; // Human-readable name
  type: "personal" | "team" | "project" | "custom"; // Organization type
  participants?: string[]; // For Hive Mode tracking
  metadata?: Record<string, any>; // Custom metadata
}
```

### Returns

```typescript
interface MemorySpace {
  id: string;
  name?: string;
  type: string;
  participants: string[];
  metadata: Record<string, any>;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}
```

### Examples

**Personal AI Memory:**

```typescript
// Register user's personal memory space
await cortex.memorySpaces.register({
  id: "user-123-personal",
  name: "Alice's Personal AI Memory",
  type: "personal",
  participants: ["cursor", "claude", "notion-ai"], // Hive Mode
  metadata: {
    owner: "user-123",
    environment: "production",
  },
});
```

**Team Workspace:**

```typescript
// Register team workspace
await cortex.memorySpaces.register({
  id: "team-engineering-workspace",
  name: "Engineering Team Workspace",
  type: "team",
  participants: ["code-review-bot", "deployment-bot", "ticket-bot"],
  metadata: {
    team: "engineering",
    project: "apollo",
    created: new Date(),
  },
});
```

**Autonomous Agent:**

```typescript
// Register agent's private space (Collaboration Mode)
await cortex.memorySpaces.register({
  id: "finance-agent-space",
  name: "Finance Agent Memory",
  type: "custom",
  participants: ["finance-agent"], // Single participant
  metadata: {
    agentType: "autonomous",
    capabilities: ["budget-approval", "reporting"],
  },
});
```

### Error Handling

```typescript
try {
  await cortex.memorySpaces.register({ id: "space-123", type: "personal" });
} catch (error) {
  if (error.code === "MEMORYSPACE_ALREADY_EXISTS") {
    console.log("Space already registered");
    // Use update() instead
  }
}
```

---

## get()

Retrieve memory space details and metadata.

### Signature

```typescript
cortex.memorySpaces.get(memorySpaceId: string, options?: GetOptions): Promise<MemorySpace | null>
```

### Parameters

```typescript
interface GetOptions {
  includeStats?: boolean; // Include usage statistics
}
```

### Returns

```typescript
interface MemorySpace {
  id: string;
  name?: string;
  type: string;
  participants: string[];
  metadata: Record<string, any>;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;

  // If includeStats: true
  stats?: {
    totalMemories: number;
    totalConversations: number;
    totalFacts: number;
    storageBytes: number;
    participants: ParticipantActivity[];
  };
}
```

### Examples

**Basic Get:**

```typescript
const space = await cortex.memorySpaces.get("user-123-personal");

console.log(space.name); // "Alice's Personal AI Memory"
console.log(space.participants); // ['cursor', 'claude', 'notion-ai']
console.log(space.type); // 'personal'
```

**With Statistics:**

```typescript
const space = await cortex.memorySpaces.get("team-engineering-workspace", {
  includeStats: true,
});

console.log(space.stats.totalMemories); // 1543
console.log(space.stats.participants);
// [
//   { participantId: 'code-review-bot', memoriesStored: 456, lastActive: '2025-10-28' },
//   { participantId: 'deployment-bot', memoriesStored: 892, lastActive: '2025-10-28' }
// ]
```

**Check if Exists:**

```typescript
const space = await cortex.memorySpaces.get("unknown-space");

if (space === null) {
  console.log("Memory space does not exist");
  // Create it
  await cortex.memorySpaces.register({ id: "unknown-space", type: "personal" });
}
```

---

## list()

List memory spaces with filtering and pagination.

### Signature

```typescript
cortex.memorySpaces.list(filters?: ListFilters): Promise<ListResult>
```

### Parameters

```typescript
interface ListFilters {
  type?: "personal" | "team" | "project" | "custom";
  status?: "active" | "archived";
  participant?: string; // Filter by participant
  metadata?: Record<string, any>; // Filter by metadata

  // Pagination
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}
```

### Returns

```typescript
interface ListResult {
  spaces: MemorySpace[];
  total: number;
  hasMore: boolean;
  offset: number;
}
```

### Examples

**List All Spaces:**

```typescript
const result = await cortex.memorySpaces.list();

console.log(`Found ${result.total} memory spaces`);
result.spaces.forEach((space) => {
  console.log(`${space.name} (${space.type})`);
});
```

**Filter by Type:**

```typescript
// Get all personal spaces
const personal = await cortex.memorySpaces.list({
  type: "personal",
  status: "active",
});

// Get all team workspaces
const teams = await cortex.memorySpaces.list({
  type: "team",
});
```

**Filter by Participant:**

```typescript
// Find all spaces where Cursor participates (Hive Mode)
const cursorSpaces = await cortex.memorySpaces.list({
  participant: "cursor",
});

console.log(`Cursor operates in ${cursorSpaces.total} memory spaces`);
```

**Pagination:**

```typescript
// Get first 20
const page1 = await cortex.memorySpaces.list({ limit: 20, offset: 0 });

// Get next 20
const page2 = await cortex.memorySpaces.list({ limit: 20, offset: 20 });
```

---

## search()

Search memory spaces by name or metadata.

### Signature

```typescript
cortex.memorySpaces.search(query: string, options?: SearchOptions): Promise<MemorySpace[]>
```

### Parameters

```typescript
interface SearchOptions {
  type?: "personal" | "team" | "project" | "custom";
  status?: "active" | "archived";
  limit?: number;
}
```

### Returns

```typescript
MemorySpace[] // Ranked by relevance
```

### Examples

**Search by Name:**

```typescript
const results = await cortex.memorySpaces.search("engineering");

// Returns spaces with "engineering" in name or metadata
// [
//   { id: 'team-engineering-workspace', name: 'Engineering Team', ... },
//   { id: 'project-engineering-docs', name: 'Engineering Docs Project', ... }
// ]
```

**Search with Filters:**

```typescript
const results = await cortex.memorySpaces.search("alice", {
  type: "personal",
  status: "active",
  limit: 5,
});
```

---

## update()

Update memory space metadata (not participants - use updateParticipants()).

### Signature

```typescript
cortex.memorySpaces.update(
  memorySpaceId: string,
  updates: MemorySpaceUpdates,
  options?: { syncToGraph?: boolean }
): Promise<MemorySpace>
```

### Parameters

```typescript
interface MemorySpaceUpdates {
  name?: string;
  metadata?: Record<string, any>; // Merged with existing
}
```

### Examples

**Update Name:**

```typescript
await cortex.memorySpaces.update("user-123-personal", {
  name: "Alice's Updated Personal Space",
});
```

**Update Metadata:**

```typescript
await cortex.memorySpaces.update("team-engineering-workspace", {
  metadata: {
    lastReview: new Date(),
    status: "active-development",
  },
});
```

---

## updateParticipants()

Add or remove participants from a memory space (Hive Mode).

### Signature

```typescript
cortex.memorySpaces.updateParticipants(
  memorySpaceId: string,
  updates: ParticipantUpdates
): Promise<MemorySpace>
```

### Parameters

```typescript
interface ParticipantUpdates {
  add?: string[]; // Add participants
  remove?: string[]; // Remove participants
}
```

### Examples

**Add Participant:**

```typescript
// User installs new AI tool
await cortex.memorySpaces.updateParticipants("user-123-personal", {
  add: ["github-copilot"], // Add to hive
});

// Now GitHub Copilot can access all memories in the space
```

**Remove Participant:**

```typescript
// User uninstalls tool
await cortex.memorySpaces.updateParticipants("user-123-personal", {
  remove: ["old-tool"],
});

// Old tool's participantId still in memories (audit trail)
// But space no longer lists it as active participant
```

**Replace Participants:**

```typescript
// Set exact participant list
await cortex.memorySpaces.updateParticipants("team-workspace", {
  remove: ["bot-1", "bot-2"], // Remove old
  add: ["bot-3", "bot-4"], // Add new
});
```

---

## archive()

Mark memory space as archived (inactive). Data is preserved but space is hidden from default lists.

### Signature

```typescript
cortex.memorySpaces.archive(memorySpaceId: string, options?: ArchiveOptions): Promise<MemorySpace>
```

### Parameters

```typescript
interface ArchiveOptions {
  reason?: string; // Why archived
  metadata?: Record<string, any>; // Archive metadata
}
```

### Examples

**Archive Project:**

```typescript
// Project complete, archive its memory space
await cortex.memorySpaces.archive("project-apollo", {
  reason: "Project completed successfully",
  metadata: {
    archivedBy: "admin-456",
    completedAt: new Date(),
  },
});

// Space still exists, data intact, but marked inactive
const space = await cortex.memorySpaces.get("project-apollo");
console.log(space.status); // 'archived'
```

**Archive Inactive User:**

```typescript
// User hasn't logged in for 90 days
await cortex.memorySpaces.archive(`user-${userId}-personal`, {
  reason: "User inactive for 90 days",
  metadata: {
    lastSeen: user.lastSeen,
  },
});
```

---

## reactivate()

Reactivate an archived memory space.

### Signature

```typescript
cortex.memorySpaces.reactivate(memorySpaceId: string): Promise<MemorySpace>
```

### Examples

```typescript
// User returns, reactivate their space
await cortex.memorySpaces.reactivate(`user-${userId}-personal`);

const space = await cortex.memorySpaces.get(`user-${userId}-personal`);
console.log(space.status); // 'active'
```

---

## delete()

**⚠️ DESTRUCTIVE:** Delete memory space and ALL associated data.

### Signature

```typescript
cortex.memorySpaces.delete(
  memorySpaceId: string,
  options: DeleteOptions
): Promise<DeleteResult>
```

### Parameters

```typescript
interface DeleteOptions {
  cascade: boolean; // REQUIRED: Must be true to proceed
  reason: string; // REQUIRED: Why deleting (audit trail)
  confirmId?: string; // Optional: Safety check (must match memorySpaceId)
  syncToGraph?: boolean; // Delete from graph database
}
```

### Returns

```typescript
interface DeleteResult {
  memorySpaceId: string;
  deleted: true;
  cascade: {
    conversationsDeleted: number; // Layer 1a
    memoriesDeleted: number; // Layer 2
    factsDeleted: number; // Layer 3
    totalBytes: number; // Storage freed
  };
  reason: string;
  deletedAt: Date;
}
```

### Examples

**GDPR Deletion:**

```typescript
// User requests data deletion
const result = await cortex.memorySpaces.delete("user-123-personal", {
  cascade: true,
  reason: "GDPR deletion request from user-123",
  confirmId: "user-123-personal", // Safety check
});

console.log(`Deleted ${result.cascade.memoriesDeleted} memories`);
console.log(`Deleted ${result.cascade.conversationsDeleted} conversations`);
console.log(`Deleted ${result.cascade.factsDeleted} facts`);
console.log(`Freed ${result.cascade.totalBytes} bytes`);
```

**Project Cleanup:**

```typescript
// Project archived, delete after retention period
await cortex.memorySpaces.delete("project-old-2023", {
  cascade: true,
  reason: "Data retention policy: 2 years expired",
});
```

**Safety Checks:**

```typescript
// Without cascade - ERROR
try {
  await cortex.memorySpaces.delete("user-123-personal", {
    cascade: false, // Must be true
    reason: "Test",
  });
} catch (error) {
  console.error("Must set cascade: true to delete");
}

// With confirmId (extra safety)
await cortex.memorySpaces.delete("production-space", {
  cascade: true,
  reason: "Migration to new architecture",
  confirmId: "production-space", // Must match memorySpaceId
});
```

---

## getStats()

Get analytics and usage statistics for a memory space.

### Signature

```typescript
cortex.memorySpaces.getStats(memorySpaceId: string, options?: StatsOptions): Promise<MemorySpaceStats>
```

### Parameters

```typescript
interface StatsOptions {
  timeWindow?: "24h" | "7d" | "30d" | "90d" | "all"; // Default: "all"
  includeParticipants?: boolean; // Participant activity (Hive Mode)
}
```

### Returns

```typescript
interface MemorySpaceStats {
  memorySpaceId: string;

  // Counts
  totalMemories: number;
  totalConversations: number;
  totalFacts: number;
  totalMessages: number;

  // Activity (based on timeWindow)
  memoriesThisWindow: number;
  conversationsThisWindow: number;

  // Storage
  storage: {
    conversationsBytes: number;
    memoriesBytes: number;
    factsBytes: number;
    totalBytes: number;
  };

  // Performance
  avgSearchTime: string; // e.g., "12ms"
  avgMemoryAccessTime: string;

  // Content Analysis
  topTags: string[];
  importanceBreakdown: {
    critical: number; // 90-100
    high: number; // 70-89
    medium: number; // 40-69
    low: number; // 10-39
    trivial: number; // 0-9
  };

  // Participant Activity (if includeParticipants: true)
  participants?: ParticipantActivity[];
}

interface ParticipantActivity {
  participantId: string;
  memoriesStored: number;
  conversationsStored: number;
  factsExtracted: number;
  firstActive: Date;
  lastActive: Date;
  avgImportance: number;
  topTags: string[];
}
```

### Examples

**Basic Stats:**

```typescript
const stats = await cortex.memorySpaces.getStats("user-123-personal");

console.log(`Total memories: ${stats.totalMemories}`);
console.log(
  `Storage used: ${(stats.storage.totalBytes / 1024 / 1024).toFixed(2)} MB`,
);
console.log(`Top tags: ${stats.topTags.join(", ")}`);
```

**With Participant Breakdown (Hive Mode):**

```typescript
const stats = await cortex.memorySpaces.getStats("team-engineering-workspace", {
  timeWindow: "7d",
  includeParticipants: true,
});

console.log(`Activity this week: ${stats.memoriesThisWindow} memories`);

// Participant breakdown
stats.participants.forEach((p) => {
  console.log(`${p.participantId}:`);
  console.log(`  - Stored: ${p.memoriesStored} memories`);
  console.log(`  - Last active: ${p.lastActive}`);
  console.log(`  - Avg importance: ${p.avgImportance}`);
});
```

**Time Window Analysis:**

```typescript
// Last 24 hours
const day = await cortex.memorySpaces.getStats("user-123-personal", {
  timeWindow: "24h",
});
console.log(`Last 24h: ${day.memoriesThisWindow} memories`);

// Last 30 days
const month = await cortex.memorySpaces.getStats("user-123-personal", {
  timeWindow: "30d",
});
console.log(`Last 30d: ${month.memoriesThisWindow} memories`);
```

---

## Common Patterns

### Pattern 1: Dynamic Space Creation (SaaS)

```typescript
// Create memory space per customer on signup
async function onUserSignup(userId: string) {
  const memorySpaceId = `customer-${userId}-space`;

  await cortex.memorySpaces.register({
    id: memorySpaceId,
    name: `Customer ${userId} Memory`,
    type: "personal",
    metadata: {
      customerId: userId,
      tier: "free",
      signupDate: new Date(),
    },
  });

  return memorySpaceId;
}
```

### Pattern 2: Team Workspace Management

```typescript
// Admin creates team workspace
async function createTeamWorkspace(
  teamId: string,
  teamName: string,
  members: string[],
) {
  const memorySpaceId = `team-${teamId}-workspace`;

  await cortex.memorySpaces.register({
    id: memorySpaceId,
    name: `${teamName} Workspace`,
    type: "team",
    participants: members.map((m) => `bot-${m}`), // Each member has a bot
    metadata: {
      teamId,
      createdBy: "admin",
      members,
    },
  });

  return memorySpaceId;
}

// Add new member
async function addTeamMember(teamId: string, memberId: string) {
  await cortex.memorySpaces.updateParticipants(`team-${teamId}-workspace`, {
    add: [`bot-${memberId}`],
  });
}
```

### Pattern 3: Lifecycle Management

```typescript
// Complete lifecycle
async function memorySpaceLifecycle(projectId: string) {
  const memorySpaceId = `project-${projectId}`;

  // 1. Create
  await cortex.memorySpaces.register({
    id: memorySpaceId,
    type: "project",
    metadata: { status: "active" },
  });

  // 2. Use (implicit in app)
  await cortex.memory.remember({ memorySpaceId, ... });

  // 3. Complete project - archive
  await cortex.memorySpaces.archive(memorySpaceId, {
    reason: "Project completed",
  });

  // 4. After retention period - delete
  await cortex.memorySpaces.delete(memorySpaceId, {
    cascade: true,
    reason: "Retention period (2 years) expired",
  });
}
```

### Pattern 4: Analytics Dashboard

```typescript
// Build memory space analytics dashboard
async function getMemorySpaceDashboard() {
  const spaces = await cortex.memorySpaces.list({ status: "active" });

  const dashboard = await Promise.all(
    spaces.spaces.map(async (space) => {
      const stats = await cortex.memorySpaces.getStats(space.id, {
        timeWindow: "7d",
        includeParticipants: true,
      });

      return {
        name: space.name,
        type: space.type,
        participants: space.participants.length,
        memoriesThisWeek: stats.memoriesThisWindow,
        storage: stats.storage.totalBytes,
        topParticipant: stats.participants?.[0]?.participantId,
      };
    }),
  );

  return dashboard;
}

// Usage
const dashboard = await getMemorySpaceDashboard();
console.table(dashboard);
```

### Pattern 5: Migration Between Spaces

```typescript
// Migrate data from one space to another
async function migrateMemorySpace(fromSpaceId: string, toSpaceId: string) {
  // Get all memories from source
  const memories = await cortex.memory.list(fromSpaceId);

  // Copy to destination
  for (const memory of memories) {
    await cortex.memory.remember({
      memorySpaceId: toSpaceId,
      participantId: memory.participantId, // Preserve participant
      conversationId: memory.conversationRef?.conversationId,
      userMessage: memory.content,
      agentResponse: "",
      userId: memory.userId,
      userName: memory.userId,
    });
  }

  // Archive source space
  await cortex.memorySpaces.archive(fromSpaceId, {
    reason: `Migrated to ${toSpaceId}`,
  });
}
```

---

## Best Practices

### 1. Use Structured IDs

```typescript
// ✅ GOOD: Structured, searchable
"user-{userId}-personal";
"team-{teamId}-workspace";
"project-{projectId}-memory";

// ❌ BAD: Random, opaque
"abc123";
"temp";
"space1";
```

### 2. Always Register in Production

```typescript
// Development: Implicit is fine
await cortex.memory.remember({ memorySpaceId: "test-space", ... });

// Production: Explicit registration
await cortex.memorySpaces.register({
  id: "user-123-personal",
  name: "Alice's Personal Space",
  type: "personal",
  metadata: { environment: "production" },
});
```

### 3. Track Participants in Hive Mode

```typescript
// ✅ GOOD: Clear participant list
await cortex.memorySpaces.register({
  id: "user-123-personal",
  participants: ["cursor", "claude", "notion-ai"],
  // ...
});

// Then filter/analyze by participant
const cursorMemories = await cortex.memory.list("user-123-personal", {
  participantId: "cursor",
});
```

### 4. Use Metadata for Organization

```typescript
// Rich metadata for filtering and search
await cortex.memorySpaces.register({
  id: "user-123-personal",
  metadata: {
    owner: "user-123",
    environment: "production",
    tier: "pro",
    region: "us-west-2",
    created: new Date(),
    tags: ["active", "premium"],
  },
});

// Later, filter by metadata
const proSpaces = await cortex.memorySpaces.list({
  metadata: { tier: "pro" },
});
```

### 5. Archive Before Delete

```typescript
// ✅ GOOD: Archive first, delete later
await cortex.memorySpaces.archive(memorySpaceId, { reason: "Inactive" });

// Wait for retention period
await sleep(90 * 24 * 60 * 60 * 1000); // 90 days

// Then delete
await cortex.memorySpaces.delete(memorySpaceId, {
  cascade: true,
  reason: "Retention period expired",
});

// ❌ BAD: Direct deletion without archival period
```

---

## Error Handling

### Common Errors

**MEMORYSPACE_ALREADY_EXISTS:**

```typescript
try {
  await cortex.memorySpaces.register({ id: "user-123-personal", ... });
} catch (error) {
  if (error.code === "MEMORYSPACE_ALREADY_EXISTS") {
    // Use update() instead
    await cortex.memorySpaces.update("user-123-personal", { ... });
  }
}
```

**MEMORYSPACE_NOT_FOUND:**

```typescript
try {
  await cortex.memorySpaces.get("nonexistent-space");
} catch (error) {
  if (error.code === "MEMORYSPACE_NOT_FOUND") {
    // Create it
    await cortex.memorySpaces.register({ id: "nonexistent-space", ... });
  }
}
```

**MEMORYSPACE_HAS_DATA (Delete Prevention):**

```typescript
try {
  await cortex.memorySpaces.delete("active-space", { cascade: false, ... });
} catch (error) {
  if (error.code === "MEMORYSPACE_HAS_DATA") {
    console.error("Must set cascade: true to delete space with data");
  }
}
```

---

## Migration from Agent Registry

### Before (Agent-Centric)

```typescript
// OLD: cortex.agents.* API
await cortex.agents.register({
  id: "my-agent",
  name: "My Agent",
  metadata: { capabilities: ["chat"] },
});

const agent = await cortex.agents.get("my-agent");
const agents = await cortex.agents.list();
```

### After (Memory-Space-Centric)

```typescript
// NEW: cortex.memorySpaces.* API
await cortex.memorySpaces.register({
  id: "my-agent-space", // Or "user-123-personal" for Hive Mode
  name: "My Agent's Memory Space",
  type: "custom",
  participants: ["my-agent"], // Single participant (Collaboration Mode)
  metadata: { capabilities: ["chat"] },
});

const space = await cortex.memorySpaces.get("my-agent-space");
const spaces = await cortex.memorySpaces.list();
```

**Note:** The old `cortex.agents.*` API may be deprecated in favor of `cortex.memorySpaces.*` to avoid confusion about the relationship between agents and memory spaces.

---

## Conclusion

The Memory Space Operations API provides explicit control over memory space lifecycle, participant management, and analytics.

**Key Takeaways:**

- ✅ Registration is optional (implicit creation works)
- ✅ Register in production for analytics and tracking
- ✅ Use participants for Hive Mode tracking
- ✅ Archive before delete (safer)
- ✅ Monitor with getStats() for observability

**Most important:** memorySpaceId is the fundamental isolation boundary. Everything else builds on this.

---

**Related Documentation:**

- [Memory Operations API](./02-memory-operations.md) - Using memory spaces
- [Hive Mode Guide](../02-core-features/10-hive-mode.md) - Multi-tool memory sharing
- [Memory Spaces Guide](../02-core-features/01-memory-spaces.md) - Core concepts
- [A2A Communication](./06-a2a-communication.md) - Collaboration Mode

**Questions?** Ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).
