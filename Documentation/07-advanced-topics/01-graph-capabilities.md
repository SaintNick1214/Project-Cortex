# Graph Capabilities: Built-In Graph Traversal

> **Last Updated**: 2026-01-01

Navigate relationships and traverse knowledge graphs using Cortex's document-oriented architecture.

> **Note:** This document covers advanced graph patterns and performance analysis. For basic context chain operations (creating, updating, querying), see **[Context Chains](../02-core-features/04-context-chains.md)**.

## Overview

Cortex is built on Convex, a **document-oriented database**, but provides **graph-like querying** through references and relationships. We call this **Graph-Lite** - you get graph capabilities without running a separate graph database.

**Your data IS a graph** - it's just stored in documents instead of native graph nodes and edges.

## The Implicit Graph

### Nodes (Entities)

Every entity in Cortex is a graph node:

```
┌──────────────┐
│ Agents       │ - AI agents, human operators
├──────────────┤
│ Users        │ - End users, customers
├──────────────┤
│ Contexts     │ - Workflow tasks, hierarchies
├──────────────┤
│ Conversations│ - Message threads
├──────────────┤
│ Memories     │ - Agent knowledge
├──────────────┤
│ Facts        │ - Extracted knowledge (optional)
└──────────────┘
```

### Edges (Relationships)

References between documents are graph edges:

```
conversationRef → Links Memory to Conversation
immutableRef    → Links Memory to Immutable Record (Fact, KB Article)
mutableRef      → Links Memory to Live Data
parentId        → Links Context to Parent Context
userId          → Links anything to User
memorySpaceId   → Links Memory/Context/Conversation to Memory Space
contextId       → Links Memory to Workflow Context
fromAgent/toAgent → Links A2A Messages between Agents
```

### Visualizing the Graph

```
User-123
  │
  ├──[CREATED]──> Conversation-456 (ACID)
  │                    │
  │                    └──[TRIGGERED]──> Context-001 (Root)
  │                                           │
  │                                           ├──[PARENT_OF]──> Context-002 (Finance)
  │                                           │                      │
  │                                           │                      └──[HANDLED_BY]──> finance-agent
  │                                           │
  │                                           └──[PARENT_OF]──> Context-003 (Customer)
  │                                                                  │
  │                                                                  └──[HANDLED_BY]──> customer-agent
  │
  └──[RELATES_TO]──> Memory-abc (Vector)
                          │
                          ├──[REFERENCES]──> Conversation-456
                          ├──[SOURCED_FROM]──> Fact-xyz
                          └──[LINKED_TO]──> Context-001

finance-agent ──[SENT_TO]──> customer-agent
      │                            │
      │                            └──[STORED_IN]──> Memory-def (A2A)
      └──[STORED_IN]──> Memory-ghi (A2A)
```

## Built-In Graph Traversals

### 1. Context Chain Navigation

Context chains provide hierarchical graph traversal:

```typescript
// Get complete context chain (multi-hop graph walk)
const chain = await cortex.contexts.get("ctx-child", {
  includeChain: true, // ← Graph traversal!
});

console.log("Graph nodes accessed:");
console.log("- Current:", chain.current.purpose);
console.log("- Parent:", chain.parent?.purpose); // 1-hop up
console.log("- Root:", chain.root.purpose); // N-hops to root
console.log("- Siblings:", chain.siblings.length); // Lateral traversal
console.log("- Children:", chain.children.length); // 1-hop down
console.log("- Ancestors:", chain.ancestors.length); // All hops to root
console.log("Total nodes in graph:", chain.totalNodes);
```

**Equivalent Graph Query:**

```cypher
// Neo4j Cypher equivalent
MATCH (current:Context {id: $contextId})
OPTIONAL MATCH (current)-[:CHILD_OF]->(parent:Context)
OPTIONAL MATCH (parent)-[:CHILD_OF*]->(root:Context)
OPTIONAL MATCH (current)<-[:CHILD_OF]-(siblings:Context)
OPTIONAL MATCH (current)-[:CHILD_OF]->(children:Context)
RETURN current, parent, root, siblings, children
```

**Performance:**

- Depth 0-2: 50-100ms (single Convex query)
- Depth 3-5: 100-300ms (2-3 Convex queries)
- Depth 6+: 300ms+ (consider native graph DB)

### 2. Conversation Tracing

Trace memories back to their source conversations:

```typescript
// Memory → Conversation link via conversationRef
const memory = await cortex.vector.get("agent-1", "mem-abc123", {
  includeConversation: true, // ← Graph traversal!
});

console.log("Memory content:", memory.content);
console.log("Source conversation:", memory.conversationRef?.conversationId);

// Get full conversation from ACID layer
if (memory.conversationRef) {
  const conversation = await cortex.conversations.get(
    memory.conversationRef.conversationId
  );
  console.log("Source messages:", conversation.messages.map((m) => m.content));
}

// Full audit trail preserved in ACID layer
```

**Graph Structure:**

```
Memory-abc (Vector Layer)
  │
  └──[conversationRef]──> Conversation-456 (ACID Layer)
                               │
                               └── Messages: [msg-001, msg-183, ...]
```

**Use Cases:**

- Audit trails: "Where did this fact come from?"
- Compliance: "Show original user statement for this memory"
- Context enrichment: "Get full conversation around this fact"

### 3. Agent Communication Graph

A2A communication creates an agent relationship graph:

```typescript
// Get all A2A messages between two agents
const conversation = await cortex.a2a.getConversation(
  "finance-agent",
  "hr-agent",
  {
    since: new Date("2025-10-01"),
    minImportance: 70,
    tags: ["budget"],
  },
);

console.log(`${conversation.messageCount} messages exchanged`);
console.log("Communication graph:");
conversation.messages.forEach((msg) => {
  console.log(`  ${msg.from} ──[SENT_TO]──> ${msg.to}: ${msg.message}`);
});
```

**Graph Structure:**

```
Agent: finance-agent
  │
  ├──[SENT_TO {importance: 85}]──> Agent: hr-agent
  │
  ├──[SENT_TO {importance: 90}]──> Agent: legal-agent
  │
  └──[RECEIVED_FROM]──> Agent: ceo-agent
```

**Multi-Hop Example:**

```typescript
// Find all memory spaces finance-agent has communicated with (1-hop)
const directConnections = await cortex.vector.search("finance-agent", "*", {
  sourceType: "a2a",
  limit: 100,
});

const connectedSpaces = new Set(
  directConnections
    .filter(m => m.metadata?.toMemorySpace)
    .map((m) => m.metadata.toMemorySpace as string),
);

console.log("Direct collaborators:", Array.from(connectedSpaces));

// Find second-degree connections (2-hop)
const secondDegree = new Set();

for (const space of connectedSpaces) {
  const theirConnections = await cortex.vector.search(space, "*", {
    sourceType: "a2a",
    limit: 100,
  });

  theirConnections.forEach((m) => {
    const toSpace = m.metadata?.toMemorySpace as string;
    if (toSpace && toSpace !== "finance-agent") {
      secondDegree.add(toSpace);
    }
  });
}

console.log("2nd-degree collaborators:", Array.from(secondDegree));
```

**Performance:** 2-hop query = 100-200ms (acceptable for collaboration queries)

### 4. User Data Graph

Trace all data related to a user across the entire system:

```typescript
// User → Everything relationship
async function getUserDataGraph(userId: string) {
  const graph = {
    user: await cortex.users.get(userId),
    conversations: await cortex.conversations.list({ userId }),
    contexts: await cortex.contexts.list({ userId }),
    memories: [] as any[],
    facts: [] as any[]
  };

  // Get memories from all memory spaces
  const spaces = await cortex.memorySpaces.list();

  for (const space of spaces.spaces) {
    const spaceMemories = await cortex.vector.search(space.memorySpaceId, '*', {
      userId,
      limit: 100
    });

    graph.memories.push(...spaceMemories);
  }

  // Get facts about user
  const userFacts = await cortex.facts.list({
    memorySpaceId: "*", // Search all spaces
    userId
  });

  graph.facts.push(...userFacts);

  return graph;
}

// Result: Complete graph of user's data
{
  user: { id: 'user-123', data: { displayName: 'Alex' }, ... },
  conversations: [5 conversations],
  contexts: [12 workflows],
  memories: [234 memories across 8 memory spaces],
  facts: [45 extracted facts]
}
```

**Graph Visualization:**

```
User-123
  ├──> 5 Conversations
  ├──> 12 Contexts
  ├──> 234 Memories (across 8 agents)
  └──> 45 Facts
```

**Use Case:** GDPR data export, user analytics, personalization

## Graph-Lite Query Patterns

### Pattern 1: Audit Trail Reconstruction

Trace the complete path from user request to agent action:

```typescript
async function traceAuditTrail(conversationId: string) {
  const trail = [];

  // Step 1: Get originating conversation
  const conversation = await cortex.conversations.get(conversationId);
  trail.push({ type: "conversation", entity: conversation });

  // Step 2: Find contexts triggered by this conversation
  const contexts = await cortex.contexts.search({
    "conversationRef.conversationId": conversationId,
  });

  for (const context of contexts) {
    trail.push({ type: "context", entity: context });

    // Step 3: Find all child contexts (workflow tree)
    const children = await cortex.contexts.getChildren(context.id, {
      recursive: true,
    });

    trail.push(...children.map((c) => ({ type: "context", entity: c })));

    // Step 4: Find memories linked to this context
    const contextMemories = await cortex.memory.search("*", "*", {
      metadata: { contextId: context.id },
    });

    trail.push(...contextMemories.map((m) => ({ type: "memory", entity: m })));
  }

  return trail;
}

// Usage
const trail = await traceAuditTrail("conv-456");

console.log("Audit trail (graph path):");
trail.forEach((node, i) => {
  console.log(`${i}. [${node.type}] ${node.entity.id}`);
});

// Output:
// 0. [conversation] conv-456
// 1. [context] ctx-001 (root)
// 2. [context] ctx-002 (child: finance approval)
// 3. [memory] mem-abc (finance agent's memory)
// 4. [context] ctx-003 (child: customer notification)
// 5. [memory] mem-def (customer agent's memory)
```

**Performance:** ~200-500ms for typical workflow (5-10 nodes)

### Pattern 2: Knowledge Graph Traversal

Find related facts via entities:

```typescript
async function findRelatedFacts(factId: string) {
  // Get the source fact
  const fact = await cortex.immutable.get("fact", factId);

  if (!fact.data.entities || fact.data.entities.length === 0) {
    return [];
  }

  // Find other facts mentioning same entities
  const relatedFacts = [];

  for (const entity of fact.data.entities) {
    const facts = await cortex.immutable.search(entity, {
      type: "fact",
      limit: 10,
    });

    relatedFacts.push(...facts);
  }

  // Deduplicate
  const unique = Array.from(
    new Map(relatedFacts.map((f) => [f.id, f])).values(),
  ).filter((f) => f.id !== factId);

  return unique;
}

// Example
const fact = {
  id: "fact-1",
  fact: "Alice works at Acme Corp",
  entities: ["Alice", "Acme Corp"],
};

const related = await findRelatedFacts(fact.id);
// Returns:
// - "Alice manages the engineering team"
// - "Acme Corp is headquartered in San Francisco"
// - "Alice joined Acme Corp in 2020"
```

**Graph Pattern (what we're simulating):**

```
Fact-1 ──[MENTIONS]──> Entity: Alice <──[MENTIONED_BY]── Fact-2
Fact-1 ──[MENTIONS]──> Entity: Acme Corp <──[MENTIONED_BY]── Fact-3
```

### Pattern 3: Workflow Dependency Graph

Find all dependent contexts in a workflow:

```typescript
async function getWorkflowDependencies(rootContextId: string) {
  const visited = new Set();
  const dependencies = [];

  async function traverse(contextId: string, depth = 0) {
    if (visited.has(contextId)) return;
    visited.add(contextId);

    const context = await cortex.contexts.get(contextId);
    dependencies.push({ context, depth });

    // Traverse children
    for (const childId of context.childIds) {
      await traverse(childId, depth + 1);
    }
  }

  await traverse(rootContextId);

  return dependencies;
}

// Usage
const deps = await getWorkflowDependencies("ctx-root");

console.log("Workflow graph:");
deps.forEach(({ context, depth }) => {
  const indent = "  ".repeat(depth);
  console.log(`${indent}${context.purpose} (${context.status})`);
});

// Output:
// Process refund request (active)
//   Approve refund (completed)
//   Send apology email (completed)
//   Update CRM (active)
```

**Performance:** O(n) where n = number of nodes, typically <500ms for <50 nodes

### Pattern 4: Agent Expertise Network

Build a graph of agent capabilities and collaborations:

```typescript
async function buildMemorySpaceNetwork() {
  const spaces = await cortex.memorySpaces.list();
  const network = {
    nodes: [] as any[],
    edges: [] as any[]
  };

  // Add memory space nodes
  for (const space of spaces.spaces) {
    network.nodes.push({
      id: space.memorySpaceId,
      name: space.name || space.memorySpaceId,
      type: space.type,
      metadata: space.metadata
    });
  }

  // Find collaboration edges (via A2A)
  for (const space of spaces.spaces) {
    const collaborations = await cortex.vector.search(space.memorySpaceId, '*', {
      sourceType: 'a2a',
      limit: 1000
    });

    // Count messages per collaborator
    const counts = new Map<string, number>();

    collaborations.forEach(m => {
      const partner = m.metadata?.toMemorySpace as string;
      if (partner) {
        counts.set(partner, (counts.get(partner) || 0) + 1);
      }
    });

    // Add edges
    for (const [partner, count] of counts.entries()) {
      network.edges.push({
        from: space.memorySpaceId,
        to: partner,
        weight: count,
        type: 'COLLABORATED_WITH'
      });
    }
  }

  return network;
}

// Result: Memory space collaboration graph
{
  nodes: [
    { id: 'finance-space', name: 'Finance Agent', type: 'custom' },
    { id: 'hr-space', name: 'HR Agent', type: 'custom' },
    { id: 'legal-space', name: 'Legal Agent', type: 'custom' }
  ],
  edges: [
    { from: 'finance-space', to: 'hr-space', weight: 45 },
    { from: 'finance-space', to: 'legal-space', weight: 23 },
    { from: 'hr-space', to: 'legal-space', weight: 12 }
  ]
}
```

**Visualization:**

```
finance-agent ══(45)══> hr-agent
      ║                    │
     (23)                 (12)
      ║                    │
      ╚══════════> legal-agent
```

**Use Cases:**

- Find bottleneck agents (highest edge weight)
- Identify collaboration patterns
- Recommend agent for task based on network position

## Performance Characteristics

### Graph-Lite Performance

| Hops | Query Type         | Avg Latency | Complexity   | Use Case                     |
| ---- | ------------------ | ----------- | ------------ | ---------------------------- |
| 1    | Single lookup      | 10-50ms     | Simple       | Direct relationships         |
| 2-3  | Sequential queries | 50-200ms    | Moderate     | Context chains, A2A patterns |
| 4-5  | Multiple queries   | 200-500ms   | Complex      | Workflow hierarchies         |
| 6+   | Many queries       | 500-2000ms+ | Very complex | Consider native graph        |

**Example:**

```typescript
// 3-hop query: User → Conversation → Context → Agent
// Query 1: Get conversation (by userId)
const convos = await cortex.conversations.list({ userId }); // 20ms

// Query 2: Get contexts triggered by conversation
const contexts = await cortex.contexts.search({
  "conversationRef.conversationId": convos[0].conversationId,
}); // 30ms

// Query 3: Get agent handling context
const memorySpace = await cortex.memorySpaces.get(contexts[0].memorySpaceId); // 15ms

// Total: ~65ms (acceptable!) ✅
```

**Scaling:**

- Well-indexed queries remain fast even with millions of documents
- Agent isolation helps (queries scoped to single agent are fastest)
- Compound indexes critical (e.g., `by_agent_userId`)

### When Graph-Lite Is Sufficient

**Use Cases That Work Well:**

1. **Context Chain Hierarchies** (depth typically 1-5)
   - Task delegation workflows
   - Approval chains
   - Project/sprint structures

2. **Direct Relationships** (1-2 hops)
   - "Get user's conversations"
   - "Find agent's active contexts"
   - "List memories for this context"

3. **Audit Trails** (3-5 hops)
   - Conversation → Context → Memories → Agent
   - Compliance queries with known path

4. **Agent Collaboration** (1-3 hops)
   - Direct collaborators
   - Recent communication patterns
   - Message threads

**Performance Profile:**

- Queries complete in <500ms
- Acceptable for user-facing features
- Good enough for background jobs
- Pagination helps with large result sets

### When to Add a Graph Database

**Limitations of Graph-Lite:**

1. **Deep Traversals** (6+ hops)
   - Each hop = another Convex query
   - Latency compounds (500ms+ becomes unusable)
   - Memory consumption increases

2. **Complex Patterns**
   - "Find all paths between A and B"
   - "Which nodes are most central?" (PageRank)
   - Pattern matching with wildcards

3. **Graph Algorithms**
   - Shortest path algorithms
   - Community detection
   - Centrality calculations
   - Recommendation graphs

4. **Highly Connected Graphs**
   - Social networks (users connected to users)
   - Knowledge graphs with dense relationships
   - Recommendation engines

**Use Cases Requiring Native Graph:**

- Healthcare: Clinical trial relationships, drug interactions, patient histories
- Legal: Case law precedents, evidence chains, multi-party litigation
- Finance: Transaction networks, fraud detection, risk graphs
- Research: Citation networks, collaboration graphs, concept relationships

**Decision Matrix:**

| Your Need                      | Graph-Lite      | Native Graph DB |
| ------------------------------ | --------------- | --------------- |
| Context hierarchies (depth <5) | ✅ Perfect      | ⚠️ Overkill     |
| Audit trails (known paths)     | ✅ Perfect      | ⚠️ Overkill     |
| Agent collaboration (1-3 hops) | ✅ Good         | Better          |
| Deep traversals (6+ hops)      | ❌ Too slow     | ✅ Required     |
| Pattern matching               | ❌ Very hard    | ✅ Required     |
| Graph algorithms               | ❌ Not feasible | ✅ Required     |
| Dense relationship networks    | ⚠️ Slow         | ✅ Best         |

**When to Upgrade:**

- Queries consistently taking >500ms
- Need for complex pattern matching
- Graph algorithm requirements
- Dense relationship graphs (>1M edges)

## Transition to Native Graph

### Step 1: Identify Need

Monitor query performance:

```typescript
// Track graph-like query latency
async function monitoredTraversal(startId: string, depth: number) {
  const start = Date.now();

  const result = await traverseContextChain(startId, depth);

  const latency = Date.now() - start;

  if (latency > 500) {
    console.warn(`Graph-Lite query slow: ${latency}ms at depth ${depth}`);
    console.warn("Consider upgrading to native graph database");
  }

  return result;
}
```

### Step 2: Evaluate Options

See: **[Graph Database Integration Guide](./02-graph-database-integration.md)** for complete setup and integration instructions.

**Quick comparison:**

| Database              | Setup Difficulty | Performance | Cost               | Best For            |
| --------------------- | ---------------- | ----------- | ------------------ | ------------------- |
| Neo4j Community       | Medium (Docker)  | Excellent   | Free (self-hosted) | Production ready    |
| Memgraph              | Easy (Docker)    | Excellent   | Free (self-hosted) | High performance    |

### Step 3: Migration Path

**Parallel Operation:**

```typescript
// Run both Graph-Lite and native graph during migration
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,

  graph: {
    enabled: true,
    provider: 'neo4j',
    connection: { uri: 'bolt://localhost:7687', ... },

    // Compare results during migration
    compareMode: true,  // Query both, compare latency
    fallbackToConvex: true  // Use Graph-Lite if graph fails
  }
});
```

**Verify Results Match:**

```typescript
// Ensure graph and Convex give same results
const graphResult = await cortex.graph.traverse(...);
const convexResult = await cortexTraverse(...);

assert.deepEqual(graphResult, convexResult);
```

**Cutover:**

```typescript
// Once confident, switch fully to graph for complex queries
const cortex = new Cortex({
  graph: {
    enabled: true,
    preferGraphFor: ["traverse", "findPath", "pattern"],
    fallbackToConvex: true, // Safety net
  },
});
```

## Advanced Graph-Lite Patterns

### Pattern: Time-Based Graph Queries

```typescript
// Find what was connected at a specific point in time
async function getHistoricalGraph(timestamp: Date) {
  // Get contexts that existed at that time
  const contexts = await cortex.contexts.list({
    createdBefore: timestamp,
    $or: [
      { completedAfter: timestamp },
      { status: { $in: ["active", "blocked"] } },
    ],
  });

  // Get A2A messages from that period
  const a2aMessages = await cortex.memory.search("*", "*", {
    source: { type: "a2a" },
    createdBefore: timestamp,
    createdAfter: new Date(timestamp.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days window
  });

  // Reconstruct graph state at that time
  return {
    activeContexts: contexts,
    activeCollaborations: buildCollaborationGraph(a2aMessages),
    timestamp,
  };
}
```

### Pattern: Weighted Graph Edges

```typescript
// Build graph with weighted edges (importance, frequency, recency)
async function getWeightedCollaborationGraph() {
  const spaces = await cortex.memorySpaces.list();
  const edges = [];

  for (const space of spaces.spaces) {
    const a2a = await cortex.vector.search(space.memorySpaceId, "*", {
      sourceType: "a2a",
      limit: 1000,
    });

    // Calculate edge weights
    const weights = new Map();

    a2a.forEach((m) => {
      const partner = m.metadata?.toMemorySpace as string;
      if (!partner) return;
      
      const current = weights.get(partner) || {
        count: 0,
        totalImportance: 0,
        lastContact: 0,
      };

      weights.set(partner, {
        count: current.count + 1,
        totalImportance: current.totalImportance + (m.importance || 0),
        lastContact: Math.max(current.lastContact, m.createdAt),
      });
    });

    // Create weighted edges
    for (const [partner, stats] of weights.entries()) {
      const recencyWeight = Math.max(
        0,
        1 - (Date.now() - stats.lastContact) / (30 * 24 * 60 * 60 * 1000),
      );
      const importanceWeight = stats.totalImportance / stats.count / 100;
      const frequencyWeight = Math.min(stats.count / 100, 1);

      edges.push({
        from: space.memorySpaceId,
        to: partner,
        weight: (recencyWeight + importanceWeight + frequencyWeight) / 3,
        count: stats.count,
        avgImportance: stats.totalImportance / stats.count,
        lastContact: new Date(stats.lastContact),
      });
    }
  }

  return edges.sort((a, b) => b.weight - a.weight);
}
```

## Best Practices

### 1. Use Existing Traversal Methods

```typescript
// ✅ Use built-in traversal when available
const chain = await cortex.contexts.get(contextId, { includeChain: true });

// ❌ Don't manually traverse when built-in exists
const context = await cortex.contexts.get(contextId);
const parent = context.parentId
  ? await cortex.contexts.get(context.parentId)
  : null;
const grandparent = parent?.parentId
  ? await cortex.contexts.get(parent.parentId)
  : null;
// etc. (slower and more code)
```

### 2. Limit Traversal Depth

```typescript
// ✅ Set reasonable depth limits
const MAX_DEPTH = 5;

async function safeTraverse(contextId: string, depth = 0) {
  if (depth > MAX_DEPTH) {
    console.warn("Max depth reached, consider graph database");
    return [];
  }

  // ... traverse logic
}
```

### 3. Cache Traversal Results

```typescript
// Cache frequently-accessed graphs
const graphCache = new Map();

async function cachedContextChain(contextId: string) {
  if (graphCache.has(contextId)) {
    return graphCache.get(contextId);
  }

  const chain = await cortex.contexts.get(contextId, { includeChain: true });

  graphCache.set(contextId, chain);
  setTimeout(() => graphCache.delete(contextId), 60000); // 1 min TTL

  return chain;
}
```

### 4. Use Batch Queries

```typescript
// ✅ Fetch all related entities in one query when possible
const contexts = await cortex.contexts.list({
  rootId: rootContextId, // Gets entire workflow in one query
});

// ❌ Don't query one-by-one
const root = await cortex.contexts.get(rootId);
for (const childId of root.childIds) {
  const child = await cortex.contexts.get(childId); // N queries!
}
```

## Comparison: Graph-Lite vs Native Graph

| Feature         | Graph-Lite (Built-in)      | Native Graph DB           |
| --------------- | -------------------------- | ------------------------- |
| **Setup**       | None (included)            | Docker or managed service |
| **Storage**     | Convex only                | Convex + Graph DB         |
| **Consistency** | Always consistent          | Eventually consistent     |
| **Query Speed** | 50-500ms (depth-dependent) | 10-100ms (constant)       |
| **Max Depth**   | 5 hops practical           | 100+ hops                 |
| **Algorithms**  | Manual implementation      | Built-in                  |
| **Cost**        | Free (Convex storage)      | Graph DB cost + sync      |
| **Complexity**  | Low (no extra systems)     | Medium (2 databases)      |
| **Use Cases**   | 90% of use cases           | Advanced/enterprise       |

**Summary:** Start with Graph-Lite. Upgrade to native graph only when you hit performance/complexity limits.

## Migration Example

**Phase 1: Using Graph-Lite**

```typescript
// Current code works fine
const chain = await cortex.contexts.get(contextId, { includeChain: true });
// 150ms, depth 3 - acceptable ✅
```

**Phase 2: Hit Limits**

```typescript
// Performance degrading
const chain = await cortex.contexts.get(complexContextId, {
  includeChain: true,
});
// 800ms, depth 8 - too slow ❌

// Complex query needed
// "Find all agents who worked on contexts related to user-123 through any path"
// → Very difficult with Graph-Lite, easy with native graph
```

**Phase 3: Add Native Graph**

```typescript
// Enable graph integration
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  graph: {
    enabled: true,
    provider: 'neo4j',
    connection: { uri: 'bolt://localhost:7687', ... }
  }
});

// Now use graph for complex queries
const agents = await cortex.graph.traverse({
  start: { type: 'user', id: 'user-123' },
  relationships: ['INVOLVES', 'HANDLED_BY'],
  maxDepth: 10
});
// 45ms - fast! ✅

// Keep using Graph-Lite for simple queries
const chain = await cortex.contexts.get(contextId, { includeChain: true });
// Still works, automatically uses best method
```

## Next Steps

- **[Graph Database Integration](./02-graph-database-integration.md)** - Complete guide to external graph databases
- **[Context Chains](../02-core-features/04-context-chains.md)** - Basic hierarchical operations
- **[A2A Communication](../02-core-features/05-a2a-communication.md)** - Agent communication patterns
- **[Graph Operations API](../03-api-reference/13-graph-operations.md)** - Complete API reference

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
