# Agent Registry

> **Last Updated**: 2026-01-01  
> **Status**: DEPRECATED - Use `memorySpaces` table instead

## ⚠️ Deprecation Notice

**The `agents` table is deprecated as of v0.21.0.** Use the `memorySpaces` table for production isolation.

**Why deprecated:**

- Memory spaces are the primary isolation boundary (not agents)
- Hive Mode requires participant tracking within spaces
- Collaboration Mode requires cross-space delegation
- memorySpaces table provides superior flexibility

**Migration path:** Replace `agentId` with `memorySpaceId` + optional `participantId`

## Overview (Legacy)

The agent registry was originally designed for agent-centric isolation. It has been superseded by the **memory space** paradigm, which enables:

- **Hive Mode:** Multiple participants (Cursor, Claude, etc.) share one memory space
- **Collaboration Mode:** Memory spaces delegate via context chains
- **Flexible boundaries:** Per-user, per-team, per-project isolation

**Current recommendation:** Use `cortex.memorySpaces.*` for registration and `participantId` for tracking.

```
┌────────────────────────────────────────────────────────────┐
│         Simple Mode (String IDs)                           │
├────────────────────────────────────────────────────────────┤
│ await cortex.memory.store('user-123-personal', { ... })    │
│ No registration needed ✅                                  │
│ Just works with any memorySpaceId string                   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│         Memory Space Mode (Recommended)                    │
├────────────────────────────────────────────────────────────┤
│ await cortex.memorySpaces.register({                       │
│   memorySpaceId: 'user-123-personal',                      │
│   name: 'User 123 Personal Space',                         │
│   type: 'personal',                                        │
│   participants: [                                          │
│     { id: 'cursor', type: 'ai-tool', joinedAt: ... },      │
│     { id: 'claude', type: 'ai-tool', joinedAt: ... },      │
│   ],                                                       │
│ });                                                        │
│                                                            │
│ Enables: Hive Mode, analytics, participant tracking ✅     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│         Legacy Agent Registry (Deprecated)                 │
├────────────────────────────────────────────────────────────┤
│ await cortex.agents.register({ id: 'my-agent', ... })      │
│ ⚠️ DEPRECATED - Use memorySpaces instead                   │
└────────────────────────────────────────────────────────────┘
```

**Current Principle:** Use memory spaces as primary isolation boundary, track participants within spaces via `participantId`.

---

## New Approach: Memory Spaces

### Memory Space Document

```typescript
{
  _id: Id<"memorySpaces">,

  // Identity
  memorySpaceId: string,       // Unique identifier
  name?: string,               // Human-readable name
  tenantId?: string,           // Multi-tenancy support

  // Type
  type: "personal" | "team" | "project" | "custom",

  // Participants (Hive Mode)
  participants: Array<{
    id: string,                // 'cursor', 'claude', 'my-bot', etc.
    type: string,              // 'ai-tool', 'human', 'ai-agent', 'system'
    joinedAt: number,
  }>,

  // Metadata
  metadata: any,
  status: "active" | "archived",

  // Timestamps
  createdAt: number,
  updatedAt: number,
}
```

**Indexes:**

- `by_memorySpaceId` - Unique lookup
- `by_tenantId` - Tenant's memory spaces
- `by_tenant_memorySpaceId` - Tenant-scoped lookup
- `by_status` - Filter active/archived
- `by_type` - Filter by type

### Legacy Agent Document (Deprecated)

```typescript
{
  _id: Id<"agents">,
  agentId: string,             // ⚠️ DEPRECATED concept
  tenantId?: string,

  name: string,
  description?: string,
  metadata?: any,
  config?: any,

  status: "active" | "inactive" | "archived",

  registeredAt: number,
  updatedAt: number,
  lastActive?: number,
}
```

**Index:**

- `by_agentId` - Unique lookup

---

## Registration vs Simple Mode

### Simple Mode (Default)

```typescript
// No registration needed
await cortex.memory.store('chatbot-v1', {
  content: 'User prefers dark mode',
  ...
});

await cortex.memory.store('support-agent', {
  content: 'Resolved ticket #456',
  ...
});

// Just works! ✅
// agentId can be any string
// No setup required
```

**Pros:**

- ✅ Zero setup
- ✅ Maximum flexibility
- ✅ Works immediately
- ✅ No extra storage

**Cons:**

- ❌ No analytics
- ❌ No agent discovery
- ❌ No centralized config
- ❌ Can't enforce policies

### Registry Mode (Enhanced)

```typescript
// Register agents
await cortex.agents.register({
  id: "support-agent",
  name: "Support Agent",
  description: "Handles customer support tickets",
  capabilities: ["support", "billing", "technical"],
  metadata: {
    owner: "support-team",
    model: "gpt-5-nano",
    version: "2.0",
  },
  config: {
    memoryVersionRetention: 20, // Override default (10)
    maxMemories: 100000,
  },
});

// Now get analytics
const agent = await cortex.agents.get("support-agent");
console.log(`${agent.name}: ${agent.stats.totalMemories} memories`);

// Discovery
const supportAgents = await cortex.agents.search({
  capabilities: ["support"],
});
```

**Pros:**

- ✅ Analytics and insights
- ✅ Agent discovery by capability
- ✅ Per-agent configuration
- ✅ Usage tracking
- ✅ Better organization

**Cons:**

- ⚠️ Extra setup step
- ⚠️ Additional storage (minimal)

---

## Registration Operations

### Register Agent

```typescript
export const register = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check if already registered
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.id))
      .unique();

    if (existing) {
      throw new Error("AGENT_ALREADY_REGISTERED");
    }

    // Create registration
    const agentId = await ctx.db.insert("agents", {
      memorySpaceId: args.id,
      name: args.name,
      description: args.description,
      capabilities: args.capabilities || [],
      metadata: args.metadata || {},
      config: args.config || {},
      stats: {
        totalMemories: 0,
        totalConversations: 0,
        totalContexts: 0,
      },
      registeredAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(agentId);
  },
});
```

### Update Agent

```typescript
export const update = mutation({
  args: {
    memorySpaceId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    await ctx.db.patch(agent._id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(agent._id);
  },
});
```

### Unregister Agent

```typescript
export const unregister = mutation({
  args: {
    memorySpaceId: v.string(),
    deleteData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    if (args.deleteData) {
      // Delete all agent data
      const memories = await ctx.db
        .query("memories")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .collect();

      for (const memory of memories) {
        await ctx.db.delete(memory._id);
      }

      // Delete conversations, contexts, etc.
    }

    // Delete registration
    await ctx.db.delete(agent._id);

    return { deleted: true, dataDeleted: args.deleteData };
  },
});
```

---

## Statistics Tracking

### Automatic Stats Updates

```typescript
// Trigger on memory creation
export const storeMemory = mutation({
  handler: async (ctx, args) => {
    // Insert memory
    const memoryId = await ctx.db.insert("memories", args);

    // Update agent stats (if registered)
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (agent) {
      await ctx.db.patch(agent._id, {
        stats: {
          ...agent.stats,
          totalMemories: agent.stats.totalMemories + 1,
          lastActive: Date.now(),
        },
      });
    }

    return await ctx.db.get(memoryId);
  },
});
```

### Computed Statistics

```typescript
export const computeStats = mutation({
  args: { memorySpaceId: v.string() },
  handler: async (ctx, args) => {
    // Count memories
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    // Count conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_agentId", (q) =>
        q.eq("participants.agentId", args.agentId),
      )
      .collect();

    // Count contexts
    const contexts = await ctx.db
      .query("contexts")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    // Calculate storage
    const storageBytes = memories.reduce((sum, m) => {
      return (
        sum +
        (m.content?.length || 0) +
        (m.embedding?.length || 0) * 8 +
        JSON.stringify(m.metadata).length
      );
    }, 0);

    // Update agent
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (agent) {
      await ctx.db.patch(agent._id, {
        stats: {
          totalMemories: memories.length,
          totalConversations: conversations.length,
          totalContexts: contexts.length,
          memoryStorageBytes: storageBytes,
          lastActive: Date.now(),
        },
      });
    }

    return {
      memories: memories.length,
      conversations: conversations.length,
      contexts: contexts.length,
      storage: storageBytes,
    };
  },
});
```

---

## Agent Discovery

### Search by Capabilities

```typescript
export const searchByCapabilities = query({
  args: { capabilities: v.array(v.string()) },
  handler: async (ctx, args) => {
    const allAgents = await ctx.db.query("agents").collect();

    // Find agents with ALL specified capabilities
    return allAgents.filter((agent) =>
      args.capabilities.every((cap) => agent.capabilities.includes(cap)),
    );
  },
});

// Usage
const supportAgents = await cortex.agents.search({
  capabilities: ["support", "billing"],
});

console.log(`Found ${supportAgents.length} support agents`);
```

### List All Agents

```typescript
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});
```

---

## Per-Agent Configuration

### Configuration Hierarchy

```typescript
// Global defaults (Cortex config)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  defaultVersionRetention: 10, // Global default
});

// Agent-specific override
await cortex.agents.configure("audit-agent", {
  memoryVersionRetention: -1, // Unlimited for audit agent
});

await cortex.agents.configure("temp-agent", {
  memoryVersionRetention: 1, // Only current for temp agent
});

// Apply configuration
export const storeMemory = mutation({
  handler: async (ctx, args) => {
    // Get agent config
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    const retention = agent?.config.memoryVersionRetention || 10; // Default

    // Use retention when updating
    // (trim previousVersions to retention limit)
  },
});
```

---

## Hybrid Approach (Recommended)

### Mix Registered and Unregistered

```typescript
// Production agents: Registered
await cortex.agents.register({
  id: 'support-agent-prod',
  name: 'Production Support Agent',
  capabilities: ['support'],
});

// Development agents: Unregistered (simple strings)
await cortex.memory.store('test-agent-123', { ... });
await cortex.memory.store('dev-agent-temp', { ... });

// Both work! ✅
// Registered agents get analytics
// Unregistered agents work without setup
```

**Best Practice:**

- Development: Use simple strings
- Production: Register for analytics
- Temporary: Use simple strings
- Critical: Register for config overrides

---

## Registry-Enabled Features

### 1. Analytics Dashboard (Cloud Mode)

```typescript
// Get agent analytics
const agent = await cortex.agents.get("support-agent");

console.log({
  name: agent.name,
  totalMemories: agent.stats.totalMemories,
  totalConversations: agent.stats.totalConversations,
  storageUsed: formatBytes(agent.stats.memoryStorageBytes),
  lastActive: new Date(agent.stats.lastActive),
});

// Aggregate analytics
const allAgents = await cortex.agents.list();
const totalMemories = allAgents.reduce(
  (sum, a) => sum + a.stats.totalMemories,
  0,
);
const totalStorage = allAgents.reduce(
  (sum, a) => sum + (a.stats.memoryStorageBytes || 0),
  0,
);
```

### 2. Agent Discovery

```typescript
// Find agents by capability
const billingAgents = await cortex.agents.search({
  capabilities: ["billing"],
});

// Find by metadata
const productionAgents = await cortex.agents.search({
  metadata: { environment: "production" },
});

// Useful for:
// - Dynamic routing
// - Load balancing
// - Agent selection
```

### 3. Per-Agent Policies

```typescript
// Set agent-specific retention
await cortex.agents.configure("audit-agent", {
  memoryVersionRetention: -1, // Unlimited
  maxMemories: Infinity,
});

// Apply in governance
export const enforceRetention = mutation({
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();

    for (const agent of agents) {
      const retention = agent.config.memoryVersionRetention || 10;

      // Apply to agent's memories
      await enforceRetentionForAgent(ctx, agent.agentId, retention);
    }
  },
});
```

---

## Implementation Details

### Registration is Optional Check

```typescript
// Before operations, optionally verify registration
export const store = mutation({
  args: { memorySpaceId: v.string(), ... },
  handler: async (ctx, args) => {
    // Optional: Check if agent exists
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (agent) {
      // Registered: Update stats
      await ctx.db.patch(agent._id, {
        stats: {
          ...agent.stats,
          totalMemories: agent.stats.totalMemories + 1,
          lastActive: Date.now(),
        },
      });
    }

    // Store memory (works with or without registration)
    return await ctx.db.insert("memories", {
      memorySpaceId: args.agentId,  // String ID works either way
      ...
    });
  },
});
```

### No Foreign Key Constraints

```typescript
// Convex doesn't enforce foreign keys
// This is valid even if agent not registered:
await ctx.db.insert("memories", {
  memorySpaceId: "unregistered-agent",  // ✅ Works!
  content: "Test",
  ...
});

// vs SQL:
// INSERT INTO memories (agent_id, content) VALUES ('unregistered-agent', 'Test');
// ❌ FOREIGN KEY constraint failed

// Cortex benefit: Flexibility!
// - Development: No registration needed
// - Production: Register for features
```

---

## Migration Path

### From Simple to Registry

```typescript
// Phase 1: Start simple (no registry)
await cortex.memory.store('agent-1', { ... });
await cortex.memory.store('agent-2', { ... });

// Phase 2: Add registry when needed
await cortex.agents.register({
  id: 'agent-1',  // Same ID as before
  name: 'Agent One',
});

await cortex.agents.register({
  id: 'agent-2',
  name: 'Agent Two',
});

// Phase 3: Backfill stats
for (const agent of ['agent-1', 'agent-2']) {
  await cortex.agents.computeStats(agent);
}

// All existing memories still work! ✅
// Now have analytics on top
```

---

## Cloud Mode Features

### Agent Billing

```typescript
// Track usage for billing (Cloud Mode)
{
  memorySpaceId: "support-agent",
  stats: {
    totalMemories: 50000,
    memoryStorageBytes: 1200000000,  // 1.2 GB
    totalEmbeddings: 45000,
    embeddingTokens: 2500000,  // For billing
  }
}

// Monthly bill calculation
const usage = agent.stats.totalEmbeddings * tokensPerEmbedding * pricePerToken;
```

### Agent Limits (Enterprise)

```typescript
export const enforceLimit = mutation({
  handler: async (ctx, args) => {
    const agent = await getAgent(ctx, args.agentId);

    if (!agent) {
      return; // Unregistered - no limits
    }

    // Check limits
    if (agent.stats.totalMemories >= agent.config.maxMemories) {
      throw new Error("AGENT_MEMORY_LIMIT_EXCEEDED");
    }

    if (agent.stats.memoryStorageBytes >= agent.config.maxStorageBytes) {
      throw new Error("AGENT_STORAGE_LIMIT_EXCEEDED");
    }

    // Proceed with operation...
  },
});
```

---

## Performance Impact

### Minimal Overhead

**With registry:**

- Extra query per operation: ~5ms
- Extra stats update: ~10ms (async, doesn't block)
- Total overhead: < 15ms

**Without registry:**

- No extra queries
- No stats updates
- Pure operation time

**Recommendation:** Registry overhead is negligible for production use.

### Caching

```typescript
// Cache agent registrations
const agentCache = new Map<string, Agent>();

async function getAgentCached(ctx: any, memorySpaceId: string) {
  if (agentCache.has(agentId)) {
    return agentCache.get(agentId);
  }

  const agent = await ctx.db
    .query("agents")
    .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
    .unique();

  if (agent) {
    agentCache.set(agentId, agent);

    // Cache for 5 minutes
    setTimeout(() => agentCache.delete(agentId), 5 * 60 * 1000);
  }

  return agent;
}
```

---

## Best Practices

### 1. Register Production Agents

```typescript
// ✅ Register production agents
await cortex.agents.register({
  id: 'support-agent-prod',
  name: 'Production Support Agent',
  metadata: { environment: 'production' },
});

// ⚠️ Don't register temporary agents
await cortex.memory.store('test-agent-' + Date.now(), { ... });
// Just use string ID
```

### 2. Use Descriptive Names

```typescript
// ✅ Good
await cortex.agents.register({
  id: "support-agent",
  name: "Customer Support Agent",
  description: "Handles tier-1 support tickets and billing inquiries",
  capabilities: ["support", "billing"],
});

// ❌ Bad
await cortex.agents.register({
  id: "agent1",
  name: "Agent",
});
```

### 3. Track Capabilities

```typescript
// Enable discovery
await cortex.agents.register({
  id: "multilingual-support",
  capabilities: [
    "support",
    "language:en",
    "language:es",
    "language:fr",
    "timezone:americas",
  ],
});

// Find agents
const spanishSupport = await cortex.agents.search({
  capabilities: ["support", "language:es"],
});
```

### 4. Configure Retention Per Agent

```typescript
// Critical agent: Unlimited retention
await cortex.agents.configure("audit-agent", {
  memoryVersionRetention: -1,
});

// Temporary agent: Minimal retention
await cortex.agents.configure("demo-agent", {
  memoryVersionRetention: 1,
});
```

---

## Next Steps

- **[Performance](./08-performance.md)** - Optimization techniques
- **[Security & Privacy](./09-security-privacy.md)** - Data protection
- **[Agent Management API](../03-api-reference/09-agent-management.md)** - API usage

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
