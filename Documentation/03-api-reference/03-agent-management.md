# Agent Management API

> **Last Updated**: 2025-10-24

Complete API reference for agent management operations.

## Overview

The Agent Management API provides methods for registering, configuring, and querying agents. Cortex uses a **hybrid approach** - agents work with simple string IDs out of the box, with optional registration for enhanced features.

**Key Concept:**
- **Simple Mode**: Just use string IDs (`'agent-1'`, `'support-agent'`)
- **Registry Mode**: Optionally register agents for analytics, discovery, and configuration

---

## Hybrid Agent Management

### Simple Mode (No Registration Required)

```typescript
// Works immediately - no registration needed
await cortex.memory.remember({
  agentId: 'my-agent',  // Just a string ID
  conversationId: 'conv-123',
  userMessage: 'Hello!',
  agentResponse: 'Hi there!',
  userId: 'user-1',
  userName: 'Alex'
});

// Search works
const memories = await cortex.memory.search('my-agent', 'hello');

// That's it! No setup required.
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
  id: 'my-agent',
  name: 'Customer Support Bot',
  description: 'Handles customer inquiries and support tickets',
  metadata: {
    team: 'support',
    capabilities: ['empathy', 'problem-solving', 'escalation'],
    version: '2.1.0',
    owner: 'support-team@company.com'
  }
});

// Now get enhanced analytics
const stats = await cortex.analytics.getAgentStats('my-agent');
// Includes: name, team, capabilities, etc.

// Agent discovery
const supportAgents = await cortex.agents.search({ 
  metadata: { team: 'support' }
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
  id: string;                         // Agent ID (must match ID used in memory ops)
  name: string;                       // Display name
  description?: string;               // What this agent does
  metadata?: {
    team?: string;
    capabilities?: string[];
    version?: string;
    owner?: string;
    [key: string]: any;               // Custom fields
  };
  config?: {
    memoryVersionRetention?: number;  // Version retention override
    [key: string]: any;               // Custom config
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
  id: 'support-agent',
  name: 'Customer Support Bot',
  description: 'Handles customer inquiries, issues, and support tickets',
  metadata: {
    team: 'customer-success',
    capabilities: ['troubleshooting', 'empathy', 'escalation'],
    version: '2.1.0',
    owner: 'support@company.com',
    maxConcurrentChats: 5
  },
  config: {
    memoryVersionRetention: 20  // Keep 20 versions instead of default 10
  }
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
const agent = await cortex.agents.get('support-agent');

if (agent) {
  console.log(`Name: ${agent.name}`);
  console.log(`Team: ${agent.metadata.team}`);
  console.log(`Capabilities: ${agent.metadata.capabilities.join(', ')}`);
  console.log(`Total memories: ${agent.stats?.totalMemories}`);
} else {
  console.log('Agent not registered (but may still work with simple ID)');
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
  metadata?: Record<string, any>;     // Filter by metadata fields
  name?: string;                      // Search by name (partial match)
  capabilities?: string[];            // Has these capabilities
  registeredAfter?: Date;
  registeredBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'registeredAt' | 'lastActive';
  sortOrder?: 'asc' | 'desc';
}
```

**Returns:**
- `RegisteredAgent[]` - Array of matching agents

**Example:**
```typescript
// Find all support team agents
const supportAgents = await cortex.agents.search({
  metadata: { team: 'support' }
});

// Find agents with specific capability
const troubleshooters = await cortex.agents.search({
  capabilities: ['troubleshooting']
});

// Find recently registered agents
const newAgents = await cortex.agents.search({
  registeredAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  sortBy: 'registeredAt',
  sortOrder: 'desc'
});

// Find by name
const found = await cortex.agents.search({
  name: 'support'  // Partial match: "Customer Support Bot"
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
  limit?: number;                     // Default: 50
  offset?: number;                    // Default: 0
  sortBy?: 'name' | 'registeredAt' | 'lastActive' | 'totalMemories';
  sortOrder?: 'asc' | 'desc';
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
  sortBy: 'lastActive',
  sortOrder: 'desc'
});

console.log(`${page1.agents.length} of ${page1.total} registered agents`);

page1.agents.forEach(agent => {
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
  metadata: { team: 'support' }
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
const updated = await cortex.agents.update('support-agent', {
  metadata: {
    version: '2.2.0',  // Update version
    capabilities: ['troubleshooting', 'empathy', 'escalation', 'billing']  // Add capability
  }
});

// Update configuration
await cortex.agents.update('audit-agent', {
  config: {
    memoryVersionRetention: -1  // Unlimited retention
  }
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
  memoryVersionRetention?: number;    // -1 = unlimited, 1 = no history, 10 = default
  [key: string]: any;                 // Custom config options
}
```

**Returns:**
- `void`

**Example:**
```typescript
// Configure version retention
await cortex.agents.configure('audit-agent', {
  memoryVersionRetention: -1  // Keep all versions forever
});

await cortex.agents.configure('temp-agent', {
  memoryVersionRetention: 1  // Only keep current (no history)
});

// Custom configuration
await cortex.agents.configure('support-agent', {
  autoArchiveAfterDays: 90,
  maxMemoriesPerUser: 1000,
  enableAutoSummarization: true  // Cloud Mode feature
});
```

**Errors:**
- `CortexError('INVALID_CONFIG')` - Configuration is invalid

**Note:** Configuration works even if agent isn't registered. It's stored separately.

---

### unregister()

Remove agent from registry.

**Signature:**
```typescript
cortex.agents.unregister(
  agentId: string,
  options?: UnregisterOptions
): Promise<UnregisterResult>
```

**Parameters:**
```typescript
interface UnregisterOptions {
  deleteMemories?: boolean;           // Delete all agent's memories
  deleteConversations?: boolean;      // Delete all conversations
  preserveData?: boolean;             // Keep data, just remove registration (default)
}
```

**Returns:**
```typescript
interface UnregisterResult {
  agentId: string;
  unregisteredAt: Date;
  memoriesDeleted?: number;
  conversationsDeleted?: number;
  dataPreserved: boolean;
}
```

**Example:**
```typescript
// Unregister but keep data
const result = await cortex.agents.unregister('old-agent', {
  preserveData: true  // Keep memories and conversations
});

console.log(`Unregistered ${result.agentId}, data preserved`);

// Unregister and delete everything
const purged = await cortex.agents.unregister('temp-agent', {
  deleteMemories: true,
  deleteConversations: true
});

console.log(`Deleted ${purged.memoriesDeleted} memories`);
console.log(`Deleted ${purged.conversationsDeleted} conversations`);
```

**Errors:**
- `CortexError('AGENT_NOT_REGISTERED')` - Agent not in registry
- `CortexError('DELETION_FAILED')` - Data deletion failed

**Warning:** This doesn't prevent using the agent ID again. It just removes registry entry.

---

## Agent Discovery

### Querying by Capabilities

```typescript
// Find agents with specific capabilities
const agents = await cortex.agents.search({
  capabilities: ['troubleshooting', 'billing']
});

// Find agents with ALL capabilities
const specialists = await cortex.agents.search({
  capabilities: ['troubleshooting', 'billing', 'escalation'],
  capabilitiesMatch: 'all'  // Must have all three
});
```

### Querying by Team

```typescript
// Get all agents in a team
const team = await cortex.agents.search({
  metadata: { team: 'customer-success' }
});

team.forEach(agent => {
  console.log(`${agent.name}: ${agent.metadata.capabilities.join(', ')}`);
});
```

### Active Agent Discovery

```typescript
// Find recently active agents
const active = await cortex.agents.search({
  sortBy: 'lastActive',
  sortOrder: 'desc',
  limit: 10
});

console.log('Most recently active agents:');
active.forEach(agent => {
  console.log(`${agent.name} - last active: ${agent.stats?.lastActive}`);
});
```

---

## Agent Statistics

### Get Agent Stats

```typescript
// Get statistics for any agent (registered or not)
const stats = await cortex.analytics.getAgentStats('support-agent');

console.log({
  totalMemories: stats.totalMemories,
  totalConversations: stats.conversationStats.totalConversations,
  lastActive: stats.lastActivity,
  
  // If registered, also includes:
  name: stats.agentInfo?.name,
  team: stats.agentInfo?.metadata.team,
  capabilities: stats.agentInfo?.metadata.capabilities
});
```

**Note:** Stats work for all agents, but registered agents have richer metadata.

---

## Best Practices

### 1. Register Important Agents

```typescript
// Production agents - register them
await cortex.agents.register({
  id: 'production-support-agent',
  name: 'Production Support Bot',
  metadata: { environment: 'production', team: 'support' }
});

// Experimental agents - simple IDs are fine
await cortex.memory.remember({
  agentId: 'experiment-123',  // Not registered, works fine
  ...
});
```

### 2. Use Meaningful IDs

```typescript
// ✅ Good agent IDs
'customer-support-agent'
'finance-analyst-agent'
'hr-recruiter-agent'

// ❌ Bad agent IDs
'agent1'
'bot'
'a'
```

### 3. Register When You Need Analytics

```typescript
// Start simple
await cortex.memory.remember({ agentId: 'my-agent', ... });

// Later, when you need insights, register
await cortex.agents.register({
  id: 'my-agent',  // Same ID
  name: 'My Agent',
  metadata: { team: 'experimental' }
});

// Now analytics include metadata
const stats = await cortex.analytics.getAgentStats('my-agent');
console.log(stats.agentInfo.name); // "My Agent"
```

### 4. Keep Registration Up to Date

```typescript
// Update when capabilities change
await cortex.agents.update('support-agent', {
  metadata: {
    capabilities: ['troubleshooting', 'billing', 'refunds'],  // Added 'refunds'
    version: '2.2.0'
  }
});
```

---

## Migration: Simple → Registry

Agents can be used without registration, then registered later:

```typescript
// Day 1: Simple usage
await cortex.memory.remember({ agentId: 'agent-1', ... });
await cortex.memory.remember({ agentId: 'agent-1', ... });
// Works fine!

// Day 30: Register for better organization
await cortex.agents.register({
  id: 'agent-1',  // Same ID that already has memories
  name: 'Sales Agent',
  metadata: { team: 'sales' }
});

// All existing memories are now associated with registered agent
const stats = await cortex.analytics.getAgentStats('agent-1');
console.log(`${stats.totalMemories} memories (created before registration)`);
```

**No data migration needed** - registration is just metadata!

---

## Universal Filters for Agents

```typescript
// Same filter patterns as memory operations
const filters = {
  metadata: {
    team: 'support',
    version: { $gte: '2.0.0' }
  },
  capabilities: ['troubleshooting'],
  registeredAfter: new Date('2025-01-01')
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
await cortex.agents.updateMany({
  metadata: { team: 'support' }
}, {
  metadata: {
    trainingCompleted: true,
    trainingDate: new Date()
  }
});

// Upgrade all agents to new version
await cortex.agents.updateMany({
  metadata: { version: '2.0.0' }
}, {
  metadata: { version: '2.1.0' }
});
```

### Delete Many (Unregister)

```typescript
// Unregister experimental agents
const result = await cortex.agents.unregisterMany({
  metadata: { environment: 'experimental' }
}, {
  preserveData: true  // Keep their memories
});

console.log(`Unregistered ${result.count} experimental agents`);
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
    id: 'triage-agent',
    name: 'Triage Bot',
    metadata: { team: 'support', priority: 1 }
  },
  {
    id: 'technical-support-agent',
    name: 'Technical Support Specialist',
    metadata: { team: 'support', priority: 2, capabilities: ['troubleshooting', 'debugging'] }
  },
  {
    id: 'billing-agent',
    name: 'Billing Specialist',
    metadata: { team: 'support', priority: 2, capabilities: ['billing', 'refunds'] }
  }
];

for (const agent of agents) {
  await cortex.agents.register(agent);
}

// Find agent for specific task
const technicalAgents = await cortex.agents.search({
  capabilities: ['troubleshooting']
});

const selectedAgent = technicalAgents[0];
console.log(`Routing to: ${selectedAgent.name}`);
```

### Example 2: Agent Fleet Management

```typescript
// Get overview of all agents
const allAgents = await cortex.agents.list({
  sortBy: 'totalMemories',
  sortOrder: 'desc'
});

// Analyze fleet
const analysis = {
  total: allAgents.total,
  byTeam: groupBy(allAgents.agents, a => a.metadata.team),
  heavyUsers: allAgents.agents.filter(a => 
    a.stats.totalMemories > 10000
  ),
  inactive: allAgents.agents.filter(a => 
    a.stats.lastActive < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  )
};

console.log('Fleet analysis:', analysis);
```

---

## Summary

**Agent Management is optional but powerful:**
- ✅ Start with simple string IDs (zero configuration)
- ✅ Register when you need organization and analytics
- ✅ Configure retention and behavior per agent
- ✅ Search and discover agents by capabilities
- ✅ Same universal filter patterns as other operations

**Registration provides:**
- Agent metadata (name, description, capabilities)
- Team organization
- Enhanced analytics
- Custom configuration
- Agent discovery

**But isn't required** - all core functionality works with simple IDs!

---

## Next Steps

- **[User Operations API](./04-user-operations.md)** - User profile management
- **[Memory Operations API](./02-memory-operations.md)** - Memory CRUD
- **[Analytics Operations API](./07-analytics-operations.md)** - Get agent stats
- **[Types & Interfaces](./08-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).

