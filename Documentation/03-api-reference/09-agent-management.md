# Agent Management API

> **Last Updated**: 2025-10-28

> ⚠️ **IMPORTANT:** The Agent Management API is being superseded by [Memory Space Operations](./13-memory-space-operations.md). While agent-based terminology remains supported for backwards compatibility, new applications should use memory spaces.
>
> **Migration Path:**
>
> - `agentId` → `memorySpaceId` (fundamental change)
> - `cortex.agents.*` → `cortex.memorySpaces.*` (new API)
> - See [Memory Spaces Guide](../02-core-features/01-memory-spaces.md) for details

Complete API reference for agent management operations (legacy model).

## Overview

The Agent Management API provides **optional metadata registration** for agent discovery, analytics, and team organization, plus **convenient cascade deletion** by participantId across all memory spaces.

**⚠️ New Architecture:** Cortex now uses **Memory Spaces** as the fundamental isolation boundary, not agents. Multiple agents/tools can share one memory space (Hive Mode), or operate in separate spaces (Collaboration Mode).

### Two Key Features

**1. Optional Registry (Metadata Layer)**

- Agents work without registration - just use string IDs
- Registration provides: discovery, analytics, team organization
- Purely optional enhancement

**2. Cascade Deletion by participantId (Convenience)**

- Delete all agent data across ALL memory spaces in one call
- Filters by `participantId` field in data (not userId)
- Works even if agent was never registered
- Similar to users API but for agent cleanup, not GDPR

**Hybrid Approach:**

**Key Concept:**

- **Simple Mode**: Just use string IDs (`'agent-1'`, `'support-agent'`)
- **Registry Mode**: Optionally register agents for analytics, discovery, and cascade deletion

**Relationship to Four-Layer Architecture:**

- **Legacy:** Agents were used across all layers
- **New Model:** Memory Spaces replace agents as isolation boundary
  - Layer 1a: Conversations (memorySpace-scoped)
  - Layer 2: Vector memories (memorySpace-scoped)
  - Layer 3: Facts (memorySpace-scoped)
  - Layer 4: Convenience API (memorySpace-scoped)
- **Migration:** Where you used `agentId`, now use `memorySpaceId`
- **Hive Mode:** Multiple agents can share one memorySpace
- Agent registry is now optional metadata (analytics only)

---

## Hybrid Agent Management

### Simple Mode (No Registration Required)

```typescript
// Works immediately - no registration needed
// Layer 3 - stores in ACID + Vector automatically
await cortex.memory.remember({
  agentId: "my-agent", // Just a string ID
  conversationId: "conv-123",
  userMessage: "Hello!",
  agentResponse: "Hi there!",
  userId: "user-1",
  userName: "Alex",
});

// Search works (Layer 3 - searches Vector index)
const memories = await cortex.memory.search("my-agent", "hello");

// That's it! No setup required - all three layers work.
```

**Use when:**

- ✅ Getting started quickly
- ✅ Simple applications
- ✅ Don't need agent metadata or analytics
- ✅ Maximum flexibility

### Registry Mode (Optional Registration)

```typescript
// Optionally register for enhanced features
await cortex.agents.register({
  id: "my-agent",
  name: "Customer Support Bot",
  description: "Handles customer inquiries and support tickets",
  metadata: {
    team: "support",
    capabilities: ["empathy", "problem-solving", "escalation"],
    version: "2.1.0",
    owner: "support-team@company.com",
  },
});

// Now get enhanced analytics
const stats = await cortex.analytics.getAgentStats("my-agent");
// Includes: name, team, capabilities, etc.

// Agent discovery
const supportAgents = await cortex.agents.search({
  metadata: { team: "support" },
});
```

**Use when:**

- ✅ Multiple agents (need organization)
- ✅ Want analytics and insights
- ✅ Team collaboration
- ✅ Agent discovery needed

---

## Core Operations

### register()

Register an agent in the registry (optional, enables enhanced features).

**Signature:**

```typescript
cortex.agents.register(
  agent: AgentRegistration
): Promise<RegisteredAgent>
```

**Parameters:**

```typescript
interface AgentRegistration {
  id: string; // Agent ID (must match ID used in memory ops)
  name: string; // Display name
  description?: string; // What this agent does
  metadata?: {
    team?: string;
    capabilities?: string[];
    version?: string;
    owner?: string;
    [key: string]: any; // Custom fields
  };
  config?: {
    memoryVersionRetention?: number; // Version retention override
    [key: string]: any; // Custom config
  };
}
```

**Returns:**

```typescript
interface RegisteredAgent {
  id: string;
  name: string;
  description?: string;
  metadata: any;
  config: any;
  registeredAt: Date;
  updatedAt: Date;
  stats?: {
    totalMemories: number;
    totalConversations: number;
    lastActive: Date;
  };
}
```

**Example:**

```typescript
const agent = await cortex.agents.register({
  id: "support-agent",
  name: "Customer Support Bot",
  description: "Handles customer inquiries, issues, and support tickets",
  metadata: {
    team: "customer-success",
    capabilities: ["troubleshooting", "empathy", "escalation"],
    version: "2.1.0",
    owner: "support@company.com",
    maxConcurrentChats: 5,
  },
  config: {
    memoryVersionRetention: 20, // Keep 20 versions instead of default 10
  },
});

console.log(`Registered ${agent.name}`);
console.log(`Total memories: ${agent.stats?.totalMemories}`);
```

**Errors:**

- `CortexError('AGENT_ALREADY_REGISTERED')` - Agent ID already exists
- `CortexError('INVALID_AGENT_ID')` - ID is empty or malformed
- `CortexError('INVALID_METADATA')` - Metadata is invalid

**See Also:**

- [Hybrid Agent Management](../02-core-features/01-agent-memory.md#hybrid-agent-management)

---

### get()

Get registered agent details.

**Signature:**

```typescript
cortex.agents.get(
  agentId: string
): Promise<RegisteredAgent | null>
```

**Parameters:**

- `agentId` (string) - Agent ID to retrieve

**Returns:**

- `RegisteredAgent` - Complete agent registration
- `null` - If agent not registered (but may still have memories!)

**Example:**

```typescript
const agent = await cortex.agents.get("support-agent");

if (agent) {
  console.log(`Name: ${agent.name}`);
  console.log(`Team: ${agent.metadata.team}`);
  console.log(`Capabilities: ${agent.metadata.capabilities.join(", ")}`);
  console.log(`Total memories: ${agent.stats?.totalMemories}`);
} else {
  console.log("Agent not registered (but may still work with simple ID)");
}
```

**Errors:**

- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid

**Note:** Agents don't need to be registered to function. This just retrieves registry info if it exists.

---

### search()

Find registered agents by metadata.

**Signature:**

```typescript
cortex.agents.search(
  filters?: AgentFilters
): Promise<RegisteredAgent[]>
```

**Parameters:**

```typescript
interface AgentFilters {
  metadata?: Record<string, any>; // Filter by metadata fields
  name?: string; // Search by name (partial match)
  capabilities?: string[]; // Has these capabilities
  registeredAfter?: Date;
  registeredBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "registeredAt" | "lastActive";
  sortOrder?: "asc" | "desc";
}
```

**Returns:**

- `RegisteredAgent[]` - Array of matching agents

**Example:**

```typescript
// Find all support team agents
const supportAgents = await cortex.agents.search({
  metadata: { team: "support" },
});

// Find agents with specific capability
const troubleshooters = await cortex.agents.search({
  capabilities: ["troubleshooting"],
});

// Find recently registered agents
const newAgents = await cortex.agents.search({
  registeredAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  sortBy: "registeredAt",
  sortOrder: "desc",
});

// Find by name
const found = await cortex.agents.search({
  name: "support", // Partial match: "Customer Support Bot"
});
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed

**Note:** Only returns **registered** agents. Unregistered agents (simple ID mode) won't appear.

---

### list()

List all registered agents with pagination.

**Signature:**

```typescript
cortex.agents.list(
  options?: ListOptions
): Promise<ListResult>
```

**Parameters:**

```typescript
interface ListOptions {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  sortBy?: "name" | "registeredAt" | "lastActive" | "totalMemories";
  sortOrder?: "asc" | "desc";
}
```

**Returns:**

```typescript
interface ListResult {
  agents: RegisteredAgent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

**Example:**

```typescript
// List all registered agents
const page1 = await cortex.agents.list({
  limit: 50,
  sortBy: "lastActive",
  sortOrder: "desc",
});

console.log(`${page1.agents.length} of ${page1.total} registered agents`);

page1.agents.forEach((agent) => {
  console.log(`${agent.name} (${agent.id})`);
  console.log(`  Team: ${agent.metadata.team}`);
  console.log(`  Memories: ${agent.stats?.totalMemories}`);
});
```

**Errors:**

- `CortexError('INVALID_PAGINATION')` - Invalid limit/offset

---

### count()

Count registered agents.

**Signature:**

```typescript
cortex.agents.count(
  filters?: AgentFilters
): Promise<number>
```

**Parameters:**

- `filters` (AgentFilters, optional) - Same filters as search()

**Returns:**

- `number` - Count of matching agents

**Example:**

```typescript
// Total registered agents
const total = await cortex.agents.count();

// Count by team
const supportCount = await cortex.agents.count({
  metadata: { team: "support" },
});

console.log(`${supportCount} agents on support team`);
```

---

### update()

Update registered agent details.

**Signature:**

```typescript
cortex.agents.update(
  agentId: string,
  updates: Partial<AgentRegistration>
): Promise<RegisteredAgent>
```

**Parameters:**

- `agentId` (string) - Agent to update
- `updates` (Partial<AgentRegistration>) - Fields to update

**Returns:**

- `RegisteredAgent` - Updated agent

**Example:**

```typescript
// Update agent metadata
const updated = await cortex.agents.update("support-agent", {
  metadata: {
    version: "2.2.0", // Update version
    capabilities: ["troubleshooting", "empathy", "escalation", "billing"], // Add capability
  },
});

// Update configuration
await cortex.agents.update("audit-agent", {
  config: {
    memoryVersionRetention: -1, // Unlimited retention
  },
});
```

**Errors:**

- `CortexError('AGENT_NOT_REGISTERED')` - Agent not in registry
- `CortexError('INVALID_UPDATE')` - Update data is invalid

---

### configure()

Update agent-specific configuration.

**Signature:**

```typescript
cortex.agents.configure(
  agentId: string,
  config: AgentConfig
): Promise<void>
```

**Parameters:**

```typescript
interface AgentConfig {
  memoryVersionRetention?: number; // -1 = unlimited, 1 = no history, 10 = default
  [key: string]: any; // Custom config options
}
```

**Returns:**

- `void`

**Example:**

```typescript
// Configure version retention
await cortex.agents.configure("audit-agent", {
  memoryVersionRetention: -1, // Keep all versions forever
});

await cortex.agents.configure("temp-agent", {
  memoryVersionRetention: 1, // Only keep current (no history)
});

// Custom configuration
await cortex.agents.configure("support-agent", {
  autoArchiveAfterDays: 90,
  maxMemoriesPerUser: 1000,
  enableAutoSummarization: true, // Cloud Mode feature
});
```

**Errors:**

- `CortexError('INVALID_CONFIG')` - Configuration is invalid

**Note:** Configuration works even if agent isn't registered. It's stored separately.

---

### unregister()

Remove agent from registry with optional cascade deletion by participantId.

> **Cascade Deletion**: Fully implemented in SDK with graph orphan detection. Filters by `participantId` across ALL memory spaces.

**Signature:**

```typescript
cortex.agents.unregister(
  agentId: string,
  options?: UnregisterAgentOptions
): Promise<UnregisterAgentResult>
```

**Parameters:**

```typescript
interface UnregisterAgentOptions {
  cascade?: boolean;  // Delete all data where participantId = agentId (default: false)
  verify?: boolean;   // Verify deletion completeness (default: true)
  dryRun?: boolean;   // Preview what would be deleted (default: false)
}
```

**Returns:**

```typescript
interface UnregisterAgentResult {
  agentId: string;
  unregisteredAt: number;

  // Per-layer deletion counts
  conversationsDeleted: number;
  conversationMessagesDeleted: number;
  memoriesDeleted: number;
  factsDeleted: number;
  graphNodesDeleted?: number;

  // Verification
  verification: {
    complete: boolean;
    issues: string[];
  };

  // Summary
  totalDeleted: number;
  deletedLayers: string[];
  memorySpacesAffected: string[];  // Which memory spaces had data
}
```

**Implementation:**

Uses three-phase cascade deletion (same pattern as users API):
1. **Collection**: Query all memory spaces for records where participantId = agentId
2. **Backup**: Create rollback snapshots
3. **Execution**: Delete in reverse dependency order (facts → memories → conversations → graph → registration)

If any deletion fails, automatically rolls back all changes.

**Example 1: Simple Unregister (keep data)**

```typescript
// Remove from registry, keep all memories/conversations
const result = await cortex.agents.unregister("old-agent");

console.log(`Unregistered ${result.agentId}`);
console.log(`Total deleted: ${result.totalDeleted}`); // 1 (just registration)
console.log(`Data preserved: memories still accessible with agentId string`);
```

**Example 2: Cascade Delete by participantId**

```typescript
// Delete registration + ALL data where participantId = agentId
const result = await cortex.agents.unregister("old-agent", {
  cascade: true,
  verify: true,
});

// Per-layer breakdown
console.log(`Conversations deleted: ${result.conversationsDeleted}`);
console.log(`  Messages in those conversations: ${result.conversationMessagesDeleted}`);
console.log(`Memories deleted: ${result.memoriesDeleted}`);
console.log(`Facts deleted: ${result.factsDeleted}`);
console.log(`Graph nodes deleted: ${result.graphNodesDeleted || 'N/A'}`);

// Summary
console.log(`Total deleted: ${result.totalDeleted}`);
console.log(`Memory spaces affected: ${result.memorySpacesAffected.join(", ")}`);
console.log(`Layers: ${result.deletedLayers.join(", ")}`);

// Verification
if (result.verification.complete) {
  console.log("✅ Deletion verified - no orphaned records");
} else {
  console.warn("⚠️ Verification issues:");
  result.verification.issues.forEach(issue => console.warn(`  - ${issue}`));
}
```

**Example 3: Dry Run (Preview)**

```typescript
// Preview what would be deleted
const preview = await cortex.agents.unregister("agent-123", {
  cascade: true,
  dryRun: true,
});

console.log(`Would delete ${preview.totalDeleted} records`);
console.log(`Across ${preview.memorySpacesAffected.length} memory spaces`);
console.log(`Memories: ${preview.memoriesDeleted}`);
console.log(`Conversations: ${preview.conversationsDeleted}`);

// Agent still exists after dry run
const agent = await cortex.agents.get("agent-123");
console.log(`Agent still registered: ${agent !== null}`); // true
```

**Example 4: Cascade Without Registration**

```typescript
// Agent never registered, but created data with participantId
// (This is the key difference from users API!)

// Day 1: Create data (no registration)
await cortex.memory.remember({
  memorySpaceId: "space-1",
  participantId: "agent-xyz",  // ← Agent never registered
  conversationId: "conv-1",
  userMessage: "Hello",
  agentResponse: "Hi",
  userId: "user-1",
  userName: "User"
});

// Day 30: Delete all agent data (works without registration!)
const result = await cortex.agents.unregister("agent-xyz", {
  cascade: true,
});

// ✅ Deletes memories even though agent was never registered
// ✅ Queries by participantId field in data, not registration
console.log(`Deleted ${result.memoriesDeleted} memories from unregistered agent`);
```

**Cascade Deletion: Users vs Agents**

| Feature | cortex.users.delete() | cortex.agents.unregister() |
|---------|----------------------|---------------------------|
| **Filter key** | userId | participantId |
| **Scope** | Across all layers | Across all memory spaces |
| **Purpose** | GDPR compliance | Convenience (cleanup) |
| **Required** | Legal requirement | Optional feature |
| **Registration** | Works even if no user profile | Works even if never registered |
| **Query logic** | `WHERE userId = X` | `WHERE participantId = X` |
| **Orphan detection** | ✅ Included | ✅ Included |
| **Rollback** | ✅ Transaction-like | ✅ Transaction-like |

**Why both exist:**
- **Users**: GDPR compliance requires deleting by userId (users exist across agents)
- **Agents**: Convenience requires deleting by participantId (agents create data in spaces)

**Key insight**: An agent's `participantId` appears in the data they create (memories, conversations, facts). Cascade deletion queries this field, regardless of registration status.

**Errors:**

- `AgentCascadeDeletionError` - Cascade deletion failed (after rollback)
- `CortexError('AGENT_NOT_REGISTERED')` - Agent not in registry (simple mode only)

**Warning:** This doesn't prevent using the agent ID again. It just removes registry entry and optionally deletes data.

**Graph Integration:**

Cascade deletion includes graph nodes if you provide a graph adapter:

```typescript
import { CypherGraphAdapter } from "@cortex-platform/sdk/graph";

// Configure graph adapter (DIY in free SDK)
const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: process.env.NEO4J_URI,
  username: process.env.NEO4J_USER,
  password: process.env.NEO4J_PASSWORD,
});

// Initialize Cortex with graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  graph: {
    adapter: graphAdapter,
    orphanCleanup: true,
  },
});

// Now cascade includes graph with orphan detection!
await cortex.agents.unregister("agent-123", { cascade: true });
// ✅ Deletes from memories, conversations, facts, AND graph
// ✅ Includes orphan island detection
```

---

## Agent Discovery

### Querying by Capabilities

```typescript
// Find agents with specific capabilities
const agents = await cortex.agents.search({
  capabilities: ["troubleshooting", "billing"],
});

// Find agents with ALL capabilities
const specialists = await cortex.agents.search({
  capabilities: ["troubleshooting", "billing", "escalation"],
  capabilitiesMatch: "all", // Must have all three
});
```

### Querying by Team

```typescript
// Get all agents in a team
const team = await cortex.agents.search({
  metadata: { team: "customer-success" },
});

team.forEach((agent) => {
  console.log(`${agent.name}: ${agent.metadata.capabilities.join(", ")}`);
});
```

### Active Agent Discovery

```typescript
// Find recently active agents
const active = await cortex.agents.search({
  sortBy: "lastActive",
  sortOrder: "desc",
  limit: 10,
});

console.log("Most recently active agents:");
active.forEach((agent) => {
  console.log(`${agent.name} - last active: ${agent.stats?.lastActive}`);
});
```

---

## Agent Statistics

### Get Agent Stats

```typescript
// Get statistics for any agent (registered or not)
const stats = await cortex.analytics.getAgentStats("support-agent");

console.log({
  totalMemories: stats.totalMemories,
  totalConversations: stats.conversationStats.totalConversations,
  lastActive: stats.lastActivity,

  // If registered, also includes:
  name: stats.agentInfo?.name,
  team: stats.agentInfo?.metadata.team,
  capabilities: stats.agentInfo?.metadata.capabilities,
});
```

**Note:** Stats work for all agents, but registered agents have richer metadata.

---

## Best Practices

### 1. Register Important Agents

```typescript
// Production agents - register them
await cortex.agents.register({
  id: "production-support-agent",
  name: "Production Support Bot",
  metadata: { environment: "production", team: "support" },
});

// Experimental agents - simple IDs are fine (Layer 3)
await cortex.memory.remember({
  agentId: "experiment-123", // Not registered, still works
  conversationId: "conv-456",
  userMessage: "Test message",
  agentResponse: "Test response",
  userId: "test-user",
  userName: "Tester",
});
// All layers work without registration!
```

### 2. Use Meaningful IDs

```typescript
// ✅ Good agent IDs
"customer-support-agent";
"finance-analyst-agent";
"hr-recruiter-agent";

// ❌ Bad agent IDs
"agent1";
"bot";
"a";
```

### 3. Register When You Need Analytics

```typescript
// Start simple (Layer 3 - all layers work)
await cortex.memory.remember({
  agentId: "my-agent",
  conversationId: "conv-123",
  userMessage: "Hello",
  agentResponse: "Hi",
  userId: "user-1",
  userName: "User",
});

// Later, when you need insights, register
await cortex.agents.register({
  id: "my-agent", // Same ID that already has memories
  name: "My Agent",
  metadata: { team: "experimental" },
});

// Now analytics include metadata
const stats = await cortex.analytics.getAgentStats("my-agent");
console.log(stats.agentInfo.name); // "My Agent"
```

### 4. Keep Registration Up to Date

```typescript
// Update when capabilities change
await cortex.agents.update("support-agent", {
  metadata: {
    capabilities: ["troubleshooting", "billing", "refunds"], // Added 'refunds'
    version: "2.2.0",
  },
});
```

---

## Migration: Simple → Registry

Agents can be used without registration, then registered later:

```typescript
// Day 1: Simple usage (Layer 3 - ACID + Vector automatic)
await cortex.memory.remember({
  agentId: "agent-1",
  conversationId: "conv-1",
  userMessage: "First message",
  agentResponse: "First response",
  userId: "user-1",
  userName: "User",
});

await cortex.memory.remember({
  agentId: "agent-1",
  conversationId: "conv-1",
  userMessage: "Second message",
  agentResponse: "Second response",
  userId: "user-1",
  userName: "User",
});
// Works fine! ACID + Vector populated automatically

// Day 30: Register for better organization
await cortex.agents.register({
  id: "agent-1", // Same ID that already has ACID + Vector data
  name: "Sales Agent",
  metadata: { team: "sales" },
});

// All existing memories/conversations now associated with registered agent
const stats = await cortex.analytics.getAgentStats("agent-1");
console.log(`${stats.totalMemories} memories (created before registration)`);
console.log(`${stats.conversationStats.totalConversations} conversations`);
```

**No data migration needed** - registration is just metadata!

---

## Universal Filters for Agents

```typescript
// Same filter patterns as memory operations
const filters = {
  metadata: {
    team: "support",
    version: { $gte: "2.0.0" },
  },
  capabilities: ["troubleshooting"],
  registeredAfter: new Date("2025-01-01"),
};

// Search
await cortex.agents.search(filters);

// Count
await cortex.agents.count(filters);

// List
await cortex.agents.list({ ...filters, limit: 50 });

// Export
await cortex.agents.export(filters);
```

**Supported Filters:**

- `metadata.*` - Any metadata field
- `capabilities` - Array of capabilities
- `capabilitiesMatch` - 'any' or 'all'
- `name` - Name search (partial match)
- `registeredBefore/After` - Date ranges
- `lastActiveBefore/After` - Activity dates

---

## Bulk Operations

### Update Many Agents

```typescript
// Update all agents in a team
await cortex.agents.updateMany(
  {
    metadata: { team: "support" },
  },
  {
    metadata: {
      trainingCompleted: true,
      trainingDate: new Date(),
    },
  },
);

// Upgrade all agents to new version
await cortex.agents.updateMany(
  {
    metadata: { version: "2.0.0" },
  },
  {
    metadata: { version: "2.1.0" },
  },
);
```

### Delete Many (Unregister)

```typescript
// Unregister experimental agents
const result = await cortex.agents.unregisterMany(
  {
    metadata: { environment: "experimental" },
  },
  {
    preserveData: true, // Keep Layer 1 (ACID) + Layer 2 (Vector)
  },
);

console.log(`Unregistered ${result.count} experimental agents`);
console.log(`Data preserved in both layers`);

// Or clean up Vector but preserve ACID
const cleaned = await cortex.agents.unregisterMany(
  {
    metadata: { environment: "test" },
  },
  {
    deleteVectorMemories: true, // Clean Layer 2
    deleteConversations: false, // Preserve Layer 1 audit trail
  },
);
```

---

## Agent Lifecycle

### Typical Lifecycle

```
┌──────────────┐
│   Created    │ (Just use agentId string)
│  (Implicit)  │
└──────┬───────┘
       │
       ├─> Use with simple ID
       │   await cortex.memory.remember({ agentId: 'agent-1', ... })
       │
       ↓
┌──────────────┐
│  Registered  │ (Optional: cortex.agents.register())
│  (Explicit)  │
└──────┬───────┘
       │
       ├─> Enhanced analytics
       ├─> Team organization
       ├─> Agent discovery
       │
       ↓
┌──────────────┐
│ Configured   │ (cortex.agents.configure())
└──────┬───────┘
       │
       ├─> Custom retention rules
       ├─> Team-specific settings
       │
       ↓
┌──────────────┐
│ Unregistered │ (cortex.agents.unregister())
│ (Optional)   │
└──────────────┘
       │
       └─> Can still use with simple ID
```

---

## Cloud Mode Features

> **Cloud Mode Only**: Enhanced agent management features

### Agent Analytics Dashboard

Visual insights per agent:

- Memory growth over time
- Conversation volume
- User engagement
- Performance metrics
- Cost attribution

### Team Management

- Team-level dashboards
- Cross-agent analytics
- Resource allocation
- Collaboration patterns

### Auto-Discovery

Cortex Cloud can suggest:

- When to split an agent (too many capabilities)
- When to merge agents (overlapping domains)
- Capability gaps in teams
- Load balancing opportunities

---

## Examples

### Example 1: Multi-Agent System

```typescript
// Register a team of specialized agents
const agents = [
  {
    id: "triage-agent",
    name: "Triage Bot",
    metadata: { team: "support", priority: 1 },
  },
  {
    id: "technical-support-agent",
    name: "Technical Support Specialist",
    metadata: {
      team: "support",
      priority: 2,
      capabilities: ["troubleshooting", "debugging"],
    },
  },
  {
    id: "billing-agent",
    name: "Billing Specialist",
    metadata: {
      team: "support",
      priority: 2,
      capabilities: ["billing", "refunds"],
    },
  },
];

for (const agent of agents) {
  await cortex.agents.register(agent);
}

// Find agent for specific task
const technicalAgents = await cortex.agents.search({
  capabilities: ["troubleshooting"],
});

const selectedAgent = technicalAgents[0];
console.log(`Routing to: ${selectedAgent.name}`);
```

### Example 2: Agent Fleet Management

```typescript
// Get overview of all agents
const allAgents = await cortex.agents.list({
  sortBy: "totalMemories",
  sortOrder: "desc",
});

// Analyze fleet
const analysis = {
  total: allAgents.total,
  byTeam: groupBy(allAgents.agents, (a) => a.metadata.team),
  heavyUsers: allAgents.agents.filter((a) => a.stats.totalMemories > 10000),
  inactive: allAgents.agents.filter(
    (a) => a.stats.lastActive < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  ),
};

console.log("Fleet analysis:", analysis);
```

---

## Graph-Lite Capabilities

Agents are graph nodes representing AI assistants or human operators:

**Agent as Graph Node:**

- Owns memories (via agentId)
- Handles contexts (via agentId)
- Participates in A2A communication (via fromAgent/toAgent)

**Edges:**

- `agentId` from Memories (agent → memories, 1-to-many)
- `agentId` from Contexts (agent → contexts, 1-to-many)
- A2A messages create agent-to-agent edges (SENT_TO/RECEIVED_FROM)

**Graph Queries:**

```typescript
// Agent → Memories
const agentMemories = await cortex.memory.search('agent-1', '*');

// Agent → Contexts
const agentContexts = await cortex.contexts.search({ agentId: 'agent-1' });

// Agent → Agent (collaboration graph via A2A)
const collaborations = await cortex.memory.search('agent-1', '*', {
  source: { type: 'a2a' },
  metadata: { direction: 'outbound' }
});

const partners = collaborations.map(m => m.metadata.toAgent);

// Build agent network
{
  agent: 'agent-1',
  memories: 1543,
  activeContexts: 12,
  collaborators: ['agent-2', 'agent-3', 'agent-5']
}
```

**Performance:** Agent-scoped queries are highly optimized (agentId is primary index). Typical queries: 10-30ms.

**Learn more:** [Graph-Lite Traversal](../07-advanced-topics/01-graph-lite-traversal.md)

---

## Summary

**Agent Management is optional but powerful:**

- ✅ Start with simple string IDs (zero configuration)
- ✅ All three layers work immediately (ACID, Vector, Memory API)
- ✅ Register when you need organization and analytics
- ✅ Configure retention and behavior per agent
- ✅ Search and discover agents by capabilities
- ✅ Same universal filter patterns as other operations

**Registration provides:**

- Agent metadata (name, description, capabilities)
- Team organization
- Enhanced analytics with agent context
- Custom configuration (version retention, etc.)
- Agent discovery by capabilities

**But isn't required** - all core functionality (Layer 1/2/3) works with simple IDs!

---

## Next Steps

- **[User Operations API](./04-user-operations.md)** - User profile management
- **[Memory Operations API](./02-memory-operations.md)** - Memory CRUD
- **[Analytics Operations API](./07-analytics-operations.md)** - Get agent stats
- **[Types & Interfaces](./08-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
