# Graph Operations API

> **Last Updated**: 2025-12-10
> **Version**: v0.21.0
> **Status**: Production Ready

Complete API reference for graph database integration, multi-hop queries, and knowledge graph operations.

## Overview

The Graph Operations API (`@cortexmemory/sdk/graph`) provides advanced graph database capabilities for Cortex, enabling multi-hop relationship queries, knowledge discovery, and cross-layer context enrichment.

**Key Characteristics:**

- ✅ **Optional** - Graph integration is completely optional
- ✅ **Multi-Database** - Works with Neo4j, Memgraph (single codebase)
- ✅ **Real-Time Sync** - Reactive worker for automatic synchronization
- ✅ **Orphan-Safe** - Sophisticated deletion with circular reference protection
- ✅ **Cross-Layer** - Connects L1a, L2, L3, L4 via relationships
- ✅ **Backward Compatible** - Existing code works unchanged

**When to Use Graph:**

- Deep context chains (5+ levels)
- Knowledge graphs with entity relationships
- Multi-hop reasoning requirements
- Provenance and audit trail needs
- Complex multi-agent coordination
- Large-scale fact databases (100s+ facts)

---

## Setup & Configuration

### Installation

```bash
# Install Neo4j driver
npm install neo4j-driver

# Start graph database (Docker)
docker-compose -f docker-compose.graph.yml up -d neo4j
```

See [Graph Database Setup Guide](../07-advanced-topics/05-graph-database-setup.md) for complete setup.

### Configuration

```typescript
import { Cortex } from "@cortexmemory/sdk";
import {
  CypherGraphAdapter,
  initializeGraphSchema,
} from "@cortexmemory/sdk/graph";

// 1. Setup graph adapter
const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: "bolt://localhost:7687",
  username: "neo4j",
  password: "your-password",
});

// 2. Initialize schema (one-time)
await initializeGraphSchema(graphAdapter);

// 3. Initialize Cortex with graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    orphanCleanup: true, // Enable orphan detection (default: true)
    autoSync: true, // Auto-start sync worker (default: false)
    syncWorkerOptions: {
      batchSize: 100,
      retryAttempts: 3,
      verbose: false,
    },
  },
});
```

---

## Core Operations

### GraphAdapter

Low-level graph database operations.

#### connect()

Connect to graph database.

```typescript
const adapter = new CypherGraphAdapter();
await adapter.connect({
  uri: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
});
```

#### createNode()

Create a node in the graph.

```typescript
const nodeId = await adapter.createNode({
  label: "Memory",
  properties: {
    memoryId: "mem-123",
    content: "User prefers dark mode",
    importance: 85,
  },
});
```

#### createEdge()

Create a relationship between nodes.

```typescript
const edgeId = await adapter.createEdge({
  type: "REFERENCES",
  from: memoryNodeId,
  to: conversationNodeId,
  properties: {
    messageIds: ["msg-1", "msg-2"],
    createdAt: Date.now(),
  },
});
```

#### query()

Execute Cypher query.

```typescript
const result = await adapter.query(
  `
  MATCH (m:Memory)-[:REFERENCES]->(c:Conversation)
  WHERE m.importance >= $minImportance
  RETURN m, c
  LIMIT 10
`,
  { minImportance: 80 },
);

for (const record of result.records) {
  console.log(record.m.properties, record.c.properties);
}
```

#### traverse()

Multi-hop graph traversal.

```typescript
const connected = await adapter.traverse({
  startId: nodeId,
  relationshipTypes: ["CHILD_OF", "PARENT_OF"],
  maxDepth: 5,
  direction: "BOTH",
});

console.log(`Found ${connected.length} connected nodes`);
```

#### findPath()

Find shortest path between nodes.

```typescript
const path = await adapter.findPath({
  fromId: aliceNodeId,
  toId: bobNodeId,
  maxHops: 10,
});

if (path) {
  console.log(`Path length: ${path.length} hops`);
  console.log(`Nodes: ${path.nodes.map((n) => n.label).join(" → ")}`);
  console.log(
    `Relationships: ${path.relationships.map((r) => r.type).join(" → ")}`,
  );
}
```

#### disconnect()

Close connection to graph database.

```typescript
await adapter.disconnect();
// Connection closed, resources freed
```

#### isConnected()

Test if adapter is connected to the database.

```typescript
const connected = await adapter.isConnected();
if (!connected) {
  console.log("Reconnecting to graph database...");
  await adapter.connect(config);
}
```

#### mergeNode()

Create or update a node using MERGE semantics (idempotent).

Added in v0.19.1 for resilient, idempotent operations. Safe for concurrent operations and re-running scripts.

```typescript
// Idempotent - safe to call multiple times
const nodeId = await adapter.mergeNode(
  {
    label: "MemorySpace",
    properties: {
      memorySpaceId: "space-123",
      name: "Main Space",
      type: "personal",
      createdAt: Date.now(),
    },
  },
  { memorySpaceId: "space-123" }, // Match properties
);
// Creates if not exists, updates if exists
```

#### getNode()

Get a node by its internal graph ID.

```typescript
const node = await adapter.getNode(nodeId);
if (node) {
  console.log("Label:", node.label);
  console.log("Properties:", node.properties);
}
```

#### updateNode()

Update a node's properties.

```typescript
await adapter.updateNode(nodeId, {
  importance: 95,
  updatedAt: Date.now(),
});
```

#### deleteNode()

Delete a node from the graph.

```typescript
// Delete node and all connected relationships
await adapter.deleteNode(nodeId, true); // detach = true

// Delete node only (fails if has relationships)
await adapter.deleteNode(nodeId, false);
```

#### findNodes()

Find nodes by label and optional properties.

```typescript
// Find all Memory nodes
const allMemories = await adapter.findNodes("Memory");

// Find Memory nodes with specific properties
const importantMemories = await adapter.findNodes(
  "Memory",
  { importance: 100 },
  50, // limit
);

// Find specific entity by ID property
const entity = await adapter.findNodes("Entity", { name: "Alice" }, 1);
```

#### deleteEdge()

Delete an edge (relationship) by its ID.

```typescript
await adapter.deleteEdge(edgeId);
```

#### findEdges()

Find edges by type and optional properties.

```typescript
// Find all REFERENCES relationships
const references = await adapter.findEdges("REFERENCES");

// Find edges with specific properties
const recentEdges = await adapter.findEdges(
  "MENTIONS",
  { role: "subject" },
  100, // limit
);
```

#### batchWrite()

Execute multiple operations in a single transaction.

```typescript
await adapter.batchWrite([
  {
    type: "CREATE_NODE",
    data: {
      label: "Entity",
      properties: { name: "Alice", type: "person" },
    },
  },
  {
    type: "CREATE_NODE",
    data: {
      label: "Entity",
      properties: { name: "Acme Corp", type: "company" },
    },
  },
  {
    type: "CREATE_EDGE",
    data: {
      type: "WORKS_AT",
      from: aliceNodeId,
      to: acmeNodeId,
      properties: { since: 2020 },
    },
  },
]);
// All operations succeed or fail together
```

**Supported operation types:**

- `CREATE_NODE` - Create a new node
- `UPDATE_NODE` - Update node properties
- `DELETE_NODE` - Delete a node
- `CREATE_EDGE` - Create a relationship
- `DELETE_EDGE` - Delete a relationship

#### countNodes()

Count nodes in the database.

```typescript
// Count all nodes
const total = await adapter.countNodes();
console.log(`Total nodes: ${total}`);

// Count nodes by label
const memoryCount = await adapter.countNodes("Memory");
const factCount = await adapter.countNodes("Fact");
console.log(`Memories: ${memoryCount}, Facts: ${factCount}`);
```

#### countEdges()

Count edges (relationships) in the database.

```typescript
// Count all edges
const total = await adapter.countEdges();
console.log(`Total relationships: ${total}`);

// Count edges by type
const references = await adapter.countEdges("REFERENCES");
const mentions = await adapter.countEdges("MENTIONS");
console.log(`References: ${references}, Mentions: ${mentions}`);
```

#### clearDatabase()

Clear all data from the database.

```typescript
// ⚠️ WARNING: Deletes ALL nodes and relationships!
await adapter.clearDatabase();
// Use only for testing or complete reset
```

---

## Sync Operations

### syncToGraph Option

All Cortex APIs now support optional graph synchronization.

#### Convenience APIs (Auto-Sync)

```typescript
// memory.remember() auto-syncs by default if graph configured
await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "Alice works at Acme Corp",
  agentResponse: "Got it!",
  userId: "alice",
  userName: "Alice",
});
// ✅ Automatically synced to graph!

// Disable if needed
await cortex.memory.remember(params, { syncToGraph: false });
```

#### Low-Level APIs (Manual Sync)

```typescript
// Explicit opt-in via syncToGraph option
await cortex.vector.store(memorySpaceId, data, {
  syncToGraph: true,
});

await cortex.facts.store(params, {
  syncToGraph: true,
});

await cortex.contexts.create(params, {
  syncToGraph: true,
});

await cortex.conversations.create(input, {
  syncToGraph: true,
});
```

### Manual Sync Functions

Direct sync control for power users.

```typescript
import {
  syncMemoryToGraph,
  syncFactToGraph,
  syncContextToGraph,
  syncMemoryRelationships,
  syncFactRelationships,
  syncContextRelationships,
} from "@cortexmemory/sdk/graph";

// Manual sync workflow
const memory = await cortex.vector.store(memorySpaceId, data);
const nodeId = await syncMemoryToGraph(memory, adapter);
await syncMemoryRelationships(memory, nodeId, adapter);
```

---

## Real-Time Sync Worker

Automatic synchronization using Convex reactive queries.

### Configuration

```typescript
const cortex = new Cortex({
  convexUrl: "...",
  graph: {
    adapter: graphAdapter,
    autoSync: true, // ← Auto-start worker!
    syncWorkerOptions: {
      batchSize: 100, // Items per batch
      retryAttempts: 3, // Retry failures
      verbose: true, // Enable logging
    },
  },
});
```

### Worker Control

```typescript
// Get worker instance
const worker = cortex.getGraphSyncWorker();

if (worker) {
  // Get health metrics
  const metrics = worker.getMetrics();
  console.log("Worker metrics:", metrics);
  /*
    {
      isRunning: true,
      totalProcessed: 150,
      successCount: 148,
      failureCount: 2,
      avgSyncTimeMs: 45,
      queueSize: 3,
      lastSyncAt: 1635789012345
    }
  */
}

// Worker stops automatically when cortex.close() is called
cortex.close();
```

### Manual Worker Control

```typescript
import { GraphSyncWorker } from "@cortexmemory/sdk/graph";

// Create worker manually
const worker = new GraphSyncWorker(client, graphAdapter, {
  batchSize: 50,
  verbose: true,
});

// Start worker
await worker.start();
console.log("Worker started, subscribing to sync queue...");

// Use Cortex normally
await cortex.memory.remember(params);
// Worker processes in background reactively!

// Monitor
setInterval(() => {
  const metrics = worker.getMetrics();
  console.log(
    `Processed: ${metrics.totalProcessed}, Queue: ${metrics.queueSize}`,
  );
}, 5000);

// Stop worker
worker.stop();
```

---

## Delete Operations with Orphan Cleanup

### Cascading Deletes

All delete operations support sophisticated orphan cleanup:

```typescript
// Delete memory - checks if conversation becomes orphaned
await cortex.memory.forget("agent-1", "mem-123", {
  deleteConversation: true,
  syncToGraph: true, // Enables orphan cleanup
});

// What happens:
// 1. Deletes memory from Convex (L2)
// 2. Deletes conversation from Convex (L1a) if requested
// 3. Deletes memory node from graph
// 4. Checks if conversation node is orphaned
// 5. If orphaned, deletes conversation node
// 6. Handles circular references safely
// 7. Detects and removes orphan islands
```

### Delete Functions

Direct delete functions for programmatic graph cleanup.

```typescript
import {
  deleteMemoryFromGraph,
  deleteFactFromGraph,
  deleteContextFromGraph,
  deleteConversationFromGraph,
  deleteMemorySpaceFromGraph,
} from "@cortexmemory/sdk/graph";
```

#### deleteMemoryFromGraph()

Delete a memory node with optional orphan cleanup.

```typescript
const result = await deleteMemoryFromGraph(
  "mem-123", // memoryId
  adapter,
  true, // enableOrphanCleanup (default: true)
);

console.log("Deleted nodes:", result.deletedNodes.length);
console.log("Orphan islands:", result.orphanIslands.length);
```

#### deleteFactFromGraph()

Delete a fact node and cascade to orphaned entities.

```typescript
const result = await deleteFactFromGraph(
  "fact-456", // factId
  adapter,
  true, // enableOrphanCleanup
);
// Entities mentioned only by this fact are also deleted
```

#### deleteContextFromGraph()

Delete a context node with relationship cleanup.

```typescript
const result = await deleteContextFromGraph(
  "ctx-789", // contextId
  adapter,
  true, // enableOrphanCleanup
);
```

#### deleteConversationFromGraph()

Delete a conversation node.

```typescript
const result = await deleteConversationFromGraph(
  "conv-abc", // conversationId
  adapter,
  true, // enableOrphanCleanup
);
```

#### deleteMemorySpaceFromGraph()

Delete a memory space node (use with caution).

```typescript
// ⚠️ WARNING: Does NOT cascade to memories/contexts in that space
const result = await deleteMemorySpaceFromGraph(
  "space-123", // memorySpaceId
  adapter,
);
```

### Orphan Detection

**Handles complex scenarios**:

```typescript
// Scenario: Circular references
Entity A → KNOWS → Entity B
Entity B → KNOWS → Entity A
Fact F1 → MENTIONS → Entity A

// Delete F1:
// - A and B reference each other (circular!)
// - But no external references remain (F1 was only anchor)
// - Algorithm: Detects orphan island, deletes both A and B ✅

// Scenario: Still referenced
Memory M1 → Conversation C1
Memory M2 → Conversation C1

// Delete M1:
// - C1 still referenced by M2
// - Algorithm: Keeps C1 (not orphaned) ✅
```

**Orphan Rules**:

- Conversation: Deleted if no Memory/Fact/Context references it
- Entity: Deleted if no Fact mentions it
- User: Never auto-deleted
- MemorySpace: Never auto-deleted
- Memory/Fact/Context: Only deleted if explicitly requested

### Programmatic Orphan Detection

For advanced use cases, access the orphan detection system directly.

```typescript
import {
  ORPHAN_RULES,
  createDeletionContext,
  deleteWithOrphanCleanup,
  detectOrphan,
  canRunOrphanCleanup,
} from "@cortexmemory/sdk/graph";
```

#### ORPHAN_RULES

Default orphan rules for each node type.

```typescript
const rules = ORPHAN_RULES;
/*
{
  Conversation: { keepIfReferencedBy: ['Memory', 'Fact', 'Context'] },
  Entity: { keepIfReferencedBy: ['Fact'] },
  User: { neverDelete: true },
  Participant: { neverDelete: true },
  MemorySpace: { neverDelete: true },
  Memory: { explicitOnly: true },
  Fact: { explicitOnly: true },
  Context: { explicitOnly: true },
}
*/
```

#### createDeletionContext()

Create a context for tracking cascading deletes.

```typescript
const deletionContext = createDeletionContext(
  "Delete Memory mem-123", // reason (for logging)
  ORPHAN_RULES, // optional custom rules
);

// Use with deleteWithOrphanCleanup
const result = await deleteWithOrphanCleanup(
  nodeId,
  "Memory",
  deletionContext,
  adapter,
);
```

#### deleteWithOrphanCleanup()

Low-level delete with orphan cascade.

```typescript
const result = await deleteWithOrphanCleanup(
  nodeId, // Graph node ID
  "Memory", // Node label
  deletionContext,
  adapter,
);

// Result type: DeleteResult
console.log("Deleted nodes:", result.deletedNodes);
console.log("Deleted edges:", result.deletedEdges);
console.log("Orphan islands:", result.orphanIslands);
```

#### detectOrphan()

Check if a node would be orphaned.

```typescript
const check = await detectOrphan(
  nodeId,
  "Conversation",
  deletionContext,
  adapter,
);

console.log("Is orphan:", check.isOrphan);
console.log("Reason:", check.reason);
console.log("Referenced by:", check.referencedBy);
console.log("Part of circular island:", check.partOfCircularIsland);
```

#### canRunOrphanCleanup()

Check if cleanup is safe to run.

```typescript
const canRun = await canRunOrphanCleanup(adapter);
if (canRun) {
  // Safe to proceed with cleanup
}
```

---

## Schema Management

### initializeGraphSchema()

Create constraints and indexes (one-time setup).

```typescript
import { initializeGraphSchema } from "@cortexmemory/sdk/graph";

await initializeGraphSchema(adapter);
// Creates:
// - 8 unique constraints (MemorySpace, Context, Memory, Fact, etc.)
// - 22 performance indexes
```

### verifyGraphSchema()

Check if schema is properly initialized.

```typescript
import { verifyGraphSchema } from "@cortexmemory/sdk/graph";

const status = await verifyGraphSchema(adapter);
console.log("Schema valid:", status.valid);
console.log("Constraints:", status.constraints.length);
console.log("Indexes:", status.indexes.length);
```

### dropGraphSchema()

Remove all constraints and indexes (testing/reset).

```typescript
import { dropGraphSchema } from "@cortexmemory/sdk/graph";

await dropGraphSchema(adapter);
// ⚠️ WARNING: Removes all schema constraints and indexes!
```

---

## Graph Enrichment Queries

### Pattern 1: Memory → Facts Enrichment

```typescript
// Get memory
const memory = await cortex.vector.get(memorySpaceId, memoryId);

// Find related facts via conversation
const relatedFacts = await adapter.query(
  `
  MATCH (m:Memory {memoryId: $memoryId})
  MATCH (m)-[:REFERENCES]->(conv:Conversation)
  MATCH (conv)<-[:EXTRACTED_FROM]-(f:Fact)
  RETURN f.fact as fact, f.confidence as confidence
  ORDER BY f.confidence DESC
`,
  { memoryId },
);

console.log(
  `Memory enrichment: 1 memory → ${relatedFacts.count} related facts`,
);
// Enrichment factor: 5x more context!
```

### Pattern 2: Entity Network Discovery

```typescript
// Find who works at same company as Alice
const coworkers = await adapter.query(`
  MATCH (alice:Entity {name: 'Alice'})-[:WORKS_AT]->(company:Entity)
  MATCH (company)<-[:WORKS_AT]-(coworker:Entity)
  WHERE coworker.name <> 'Alice'
  RETURN DISTINCT coworker.name as name
`);

console.log(
  "Alice's coworkers:",
  coworkers.records.map((r) => r.name),
);
```

### Pattern 3: Knowledge Path Discovery

```typescript
// Multi-hop path: Alice → Company → Bob → Technology
const path = await adapter.query(`
  MATCH path = (alice:Entity {name: 'Alice'})-[*1..4]-(tech:Entity {name: 'TypeScript'})
  RETURN [node in nodes(path) | node.name] as pathNodes,
         [rel in relationships(path) | type(rel)] as pathRels,
         length(path) as hops
  LIMIT 1
`);

if (path.count > 0) {
  console.log("Path:", path.records[0].pathNodes.join(" → "));
  console.log("Via:", path.records[0].pathRels.join(" → "));
  console.log("Hops:", path.records[0].hops);
}
```

### Pattern 4: Context Chain Reconstruction

```typescript
// Get full context hierarchy via graph
const chain = await adapter.query(
  `
  MATCH (current:Context {contextId: $contextId})
  MATCH path = (current)-[:CHILD_OF*0..10]->(ancestors:Context)
  RETURN ancestors
  ORDER BY ancestors.depth
`,
  { contextId },
);

console.log("Full context chain:");
for (const record of chain.records) {
  const ctx = record.ancestors.properties;
  console.log(`  Depth ${ctx.depth}: ${ctx.purpose}`);
}
```

### Pattern 5: Provenance Tracing

```typescript
// Trace fact back to source conversation
const provenance = await adapter.query(
  `
  MATCH (f:Fact {factId: $factId})
  MATCH (f)-[:EXTRACTED_FROM]->(conv:Conversation)
  MATCH (conv)<-[:TRIGGERED_BY]-(ctx:Context)
  MATCH (ctx)-[:INVOLVES]->(user:User)
  RETURN conv.conversationId as conversation,
         ctx.purpose as context,
         user.userId as user
`,
  { factId },
);

console.log("Fact provenance:");
console.log("  Conversation:", provenance.records[0].conversation);
console.log("  Context:", provenance.records[0].context);
console.log("  User:", provenance.records[0].user);
// Complete audit trail! ✅
```

---

## Node Types

### MemorySpace

```cypher
(:MemorySpace {
  memorySpaceId: string,
  name: string,
  type: string,  // 'personal', 'team', 'project', 'custom'
  status: string,
  createdAt: number
})
```

### Context

```cypher
(:Context {
  contextId: string,
  memorySpaceId: string,
  purpose: string,
  status: string,
  depth: number,
  parentId: string,
  rootId: string,
  createdAt: number
})
```

### Memory

```cypher
(:Memory {
  memoryId: string,
  memorySpaceId: string,
  content: string,  // Truncated (first 200 chars)
  importance: number,
  sourceType: string,
  tags: array,
  createdAt: number
})
```

### Fact

```cypher
(:Fact {
  factId: string,
  memorySpaceId: string,
  fact: string,
  factType: string,
  subject: string,
  predicate: string,
  object: string,
  confidence: number,
  createdAt: number
})
```

### Entity

```cypher
(:Entity {
  name: string,
  type: string,
  createdAt: number
})
```

### Conversation

```cypher
(:Conversation {
  conversationId: string,
  memorySpaceId: string,
  type: string,
  messageCount: number,
  createdAt: number
})
```

### User

```cypher
(:User {
  userId: string,
  createdAt: number
})
```

---

## Relationship Types

### Hierarchy

```cypher
(Context)-[:PARENT_OF]->(Context)
(Context)-[:CHILD_OF]->(Context)
```

### Isolation

```cypher
(Memory|Fact|Context|Conversation)-[:IN_SPACE]->(MemorySpace)
```

### References

```cypher
(Memory)-[:REFERENCES]->(Conversation)
(Fact)-[:EXTRACTED_FROM]->(Conversation)
(Context)-[:TRIGGERED_BY]->(Conversation)
```

### Users

```cypher
(Memory|Context|Conversation)-[:INVOLVES|RELATES_TO]->(User)
```

### Facts & Entities

```cypher
(Fact)-[:MENTIONS]->(Entity)
(Entity)-[:WORKS_AT|KNOWS|USES|LOCATED_IN|...]->(Entity)
```

### Versioning

```cypher
(Fact)-[:SUPERSEDES]->(Fact)
```

---

## syncToGraph Option Reference

All Cortex APIs support the `syncToGraph` option:

### Conversations API

```typescript
await cortex.conversations.create(input, { syncToGraph: true });
await cortex.conversations.addMessage(input, { syncToGraph: true });
await cortex.conversations.delete(id, { syncToGraph: true });
```

### Vector API

```typescript
await cortex.vector.store(memorySpaceId, input, { syncToGraph: true });
await cortex.vector.update(memorySpaceId, memoryId, updates, {
  syncToGraph: true,
});
await cortex.vector.delete(memorySpaceId, memoryId, { syncToGraph: true });
```

### Facts API

```typescript
await cortex.facts.store(params, { syncToGraph: true });
await cortex.facts.update(memorySpaceId, factId, updates, {
  syncToGraph: true,
});
await cortex.facts.delete(memorySpaceId, factId, { syncToGraph: true });
```

### Contexts API

```typescript
await cortex.contexts.create(params, { syncToGraph: true });
await cortex.contexts.update(contextId, updates, { syncToGraph: true });
await cortex.contexts.delete(contextId, { syncToGraph: true });
```

### Memory Spaces API

```typescript
await cortex.memorySpaces.register(params, { syncToGraph: true });
```

### Memory API (Convenience)

```typescript
// Auto-syncs by default if graph configured
await cortex.memory.remember(params); // syncToGraph: true by default

// Explicit control
await cortex.memory.remember(params, { syncToGraph: false });

// Forget with cascade
await cortex.memory.forget(memorySpaceId, memoryId, {
  deleteConversation: true,
  syncToGraph: true, // Orphan cleanup enabled
});
```

---

## Batch Sync

For initial sync or large data imports:

```typescript
import { initialGraphSync } from "@cortexmemory/sdk/graph";

const result = await initialGraphSync(cortex, adapter, {
  limits: {
    memorySpaces: 1000,
    contexts: 5000,
    memories: 10000,
    facts: 5000,
  },
  syncRelationships: true,
  onProgress: (entity, current, total) => {
    console.log(`Syncing ${entity}: ${current}/${total}`);
  },
});

console.log("Sync complete:");
console.log("  Memory Spaces:", result.memorySpaces.synced);
console.log("  Contexts:", result.contexts.synced);
console.log("  Memories:", result.memories.synced);
console.log("  Facts:", result.facts.synced);
console.log("  Errors:", result.errors.length);
console.log("  Duration:", result.duration, "ms");
```

---

## Performance

### Query Performance

| Query Type       | Graph-Lite (Convex) | Native Graph | When to Use       |
| ---------------- | ------------------- | ------------ | ----------------- |
| 1-hop traversal  | 3-10ms              | 10-25ms      | Graph-Lite        |
| 3-hop traversal  | 10-50ms             | 4-10ms       | Native Graph      |
| 7-hop traversal  | 50-200ms            | 4-15ms       | Native Graph      |
| Pattern matching | Not feasible        | 10-100ms     | Native Graph only |
| Entity networks  | Not feasible        | 20-50ms      | Native Graph only |

### Sync Performance

- **Single entity**: 30-60ms
- **Batch sync**: ~300 entities/second
- **Real-time lag**: <1 second with worker
- **Enrichment overhead**: +90ms for 2-5x context

---

## Error Handling

### Graph Connection Errors

```typescript
try {
  await adapter.connect(config);
} catch (error) {
  if (error.code === "CONNECTION_ERROR") {
    console.error("Failed to connect to graph database");
    // Fall back to Graph-Lite or disable graph features
  }
}
```

### Sync Failures

```typescript
// Sync failures log warnings but don't throw
await cortex.vector.store(data, { syncToGraph: true });
// If graph sync fails: Logs warning, continues
// Convex remains source of truth
```

### Query Errors

```typescript
try {
  const result = await adapter.query(cypherQuery);
} catch (error) {
  if (error.name === "GraphQueryError") {
    console.error("Query failed:", error.query);
  }
}
```

---

## Best Practices

### 1. Convex as Source of Truth

```typescript
// ✅ Always write to Convex first
await cortex.memory.remember(params, { syncToGraph: true });
// Convex write succeeds → then sync to graph

// ❌ Don't write to graph first
await adapter.createNode({ ... }); // Graph could succeed but Convex fail
```

### 2. Use Auto-Sync for Simplicity

```typescript
// ✅ Enable auto-sync, use convenience APIs
const cortex = new Cortex({
  convexUrl: "...",
  graph: { adapter, autoSync: true },
});

await cortex.memory.remember(params);
// Syncs automatically in background!
```

### 3. Monitor Sync Health

```typescript
// Check worker periodically
const worker = cortex.getGraphSyncWorker();
if (worker) {
  const metrics = worker.getMetrics();

  if (metrics.queueSize > 1000) {
    console.warn("Sync queue backing up!");
  }

  if (metrics.failureCount > 100) {
    console.error("High failure rate, check graph connection");
  }
}
```

### 4. Use Graph for Discovery, Not Storage

```typescript
// ✅ Query graph for relationships
const related = await adapter.query(`
  MATCH (m:Memory)-[:REFERENCES]->(conv:Conversation)<-[:EXTRACTED_FROM]-(f:Fact)
  RETURN f
`);

// ✅ But fetch full data from Convex
for (const record of related.records) {
  const fullFact = await cortex.facts.get(
    memorySpaceId,
    record.f.properties.factId,
  );
  // Full data with all versions from Convex
}
```

---

## TypeScript Types

### Core Types

```typescript
import type {
  GraphAdapter,
  GraphNode,
  GraphEdge,
  GraphPath,
  GraphQuery,
  GraphQueryResult,
  QueryStatistics,
  GraphConnectionConfig,
  GraphOperation,
  TraversalConfig,
  ShortestPathConfig,
  SyncHealthMetrics,
  GraphSyncWorkerOptions,
  BatchSyncOptions,
  BatchSyncResult,
} from "@cortexmemory/sdk/graph";
```

### GraphNode

Represents a node in the graph database.

```typescript
interface GraphNode {
  /** Node label (e.g., 'Context', 'Memory', 'Fact') */
  label: string;

  /** Node properties (key-value pairs) */
  properties: Record<string, unknown>;

  /** Optional node ID (set by graph database after creation) */
  id?: string;
}
```

### GraphEdge

Represents a relationship between nodes.

```typescript
interface GraphEdge {
  /** Relationship type (e.g., 'CHILD_OF', 'MENTIONS', 'SENT_TO') */
  type: string;

  /** Source node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Optional relationship properties */
  properties?: Record<string, unknown>;

  /** Optional edge ID (set by graph database after creation) */
  id?: string;
}
```

### GraphPath

Path between nodes in the graph.

```typescript
interface GraphPath {
  /** Nodes in the path */
  nodes: GraphNode[];

  /** Relationships in the path */
  relationships: GraphEdge[];

  /** Path length (number of hops) */
  length: number;
}
```

### GraphQuery

Cypher query with parameters.

```typescript
interface GraphQuery {
  /** Cypher query string */
  cypher: string;

  /** Query parameters (for parameterized queries) */
  params?: Record<string, unknown>;
}
```

### GraphQueryResult

Result from a graph query.

```typescript
interface GraphQueryResult {
  /** Records returned by the query */
  records: Record<string, unknown>[];

  /** Number of records returned */
  count: number;

  /** Optional query statistics */
  stats?: QueryStatistics;
}
```

### QueryStatistics

Query execution statistics.

```typescript
interface QueryStatistics {
  nodesCreated?: number;
  nodesDeleted?: number;
  relationshipsCreated?: number;
  relationshipsDeleted?: number;
  propertiesSet?: number;
  labelsAdded?: number;
  labelsRemoved?: number;
  indexesAdded?: number;
  constraintsAdded?: number;
}
```

### GraphConnectionConfig

Connection configuration for graph database.

```typescript
interface GraphConnectionConfig {
  /** Bolt URI (e.g., 'bolt://localhost:7687') */
  uri: string;

  /** Username for authentication */
  username: string;

  /** Password for authentication */
  password: string;

  /** Optional database name (Neo4j 4.0+) */
  database?: string;

  /** Optional connection pool configuration */
  maxConnectionPoolSize?: number;

  /** Optional connection timeout (ms) */
  connectionTimeout?: number;
}
```

### GraphOperation

Batch operation for graph write.

```typescript
interface GraphOperation {
  /** Operation type */
  type:
    | "CREATE_NODE"
    | "UPDATE_NODE"
    | "DELETE_NODE"
    | "CREATE_EDGE"
    | "DELETE_EDGE";

  /** Operation data */
  data:
    | GraphNode
    | GraphEdge
    | { id: string; properties?: Record<string, unknown> };
}
```

### TraversalConfig

Configuration for graph traversal.

```typescript
interface TraversalConfig {
  /** Starting node ID */
  startId: string;

  /** Relationship types to follow (empty = all types) */
  relationshipTypes?: string[];

  /** Maximum depth to traverse */
  maxDepth: number;

  /** Optional direction: 'OUTGOING', 'INCOMING', or 'BOTH' */
  direction?: "OUTGOING" | "INCOMING" | "BOTH";

  /** Optional filter predicate (Cypher WHERE clause) */
  filter?: string;

  /** Optional filter parameters */
  filterParams?: Record<string, unknown>;
}
```

### ShortestPathConfig

Configuration for shortest path queries.

```typescript
interface ShortestPathConfig {
  /** Source node ID */
  fromId: string;

  /** Target node ID */
  toId: string;

  /** Maximum number of hops to search */
  maxHops: number;

  /** Optional relationship types to follow */
  relationshipTypes?: string[];

  /** Optional direction */
  direction?: "OUTGOING" | "INCOMING" | "BOTH";
}
```

### Orphan Detection Types

```typescript
import type {
  OrphanRule,
  DeletionContext,
  DeleteResult,
  OrphanCheckResult,
} from "@cortexmemory/sdk/graph";
```

### OrphanRule

Orphan detection rules for node types.

```typescript
interface OrphanRule {
  /** Node types that must reference this node to keep it alive */
  keepIfReferencedBy?: string[];

  /** Never auto-delete this node type */
  neverDelete?: boolean;

  /** Only delete if explicitly requested (not cascaded) */
  explicitOnly?: boolean;
}
```

### DeletionContext

Context for tracking cascading deletes.

```typescript
interface DeletionContext {
  /** Set of node IDs being deleted in this operation */
  deletedNodeIds: Set<string>;

  /** Reason for deletion (for logging/debugging) */
  reason: string;

  /** Timestamp of deletion */
  timestamp: number;

  /** Orphan rules to use (can be customized) */
  orphanRules?: Record<string, OrphanRule>;
}
```

### DeleteResult

Result of a delete operation with orphan cleanup.

```typescript
interface DeleteResult {
  /** IDs of all nodes deleted (including cascaded orphans) */
  deletedNodes: string[];

  /** IDs of all edges deleted */
  deletedEdges: string[];

  /** Orphan islands that were removed */
  orphanIslands: Array<{
    nodes: string[];
    reason: string;
  }>;
}
```

### OrphanCheckResult

Result of orphan detection check.

```typescript
interface OrphanCheckResult {
  /** Is this node an orphan? */
  isOrphan: boolean;

  /** Reason for orphan status */
  reason: string;

  /** IDs of nodes that reference this node */
  referencedBy: string[];

  /** Is this part of a circular orphan island? */
  partOfCircularIsland: boolean;

  /** If part of island, the full island node IDs */
  islandNodes?: string[];
}
```

### Error Classes

```typescript
import {
  GraphDatabaseError,
  GraphConnectionError,
  GraphQueryError,
  GraphNotFoundError,
} from "@cortexmemory/sdk/graph";
```

- **GraphDatabaseError** - Base error for graph operations
- **GraphConnectionError** - Connection failures (code: `CONNECTION_ERROR`)
- **GraphQueryError** - Query execution failures (includes query string)
- **GraphNotFoundError** - Node or edge not found (code: `NOT_FOUND`)

---

## Examples

Complete examples in:

- `examples/graph-realtime-sync.ts` - Real-time worker usage
- `tests/graph/proofs/07-multilayer-retrieval.proof.ts` - Multi-layer enhancement
- `tests/graph/end-to-end-multilayer.test.ts` - Complete validation

---

## Limitations

### Memgraph Compatibility

- ✅ Basic operations: 100%
- ✅ Traversal: 100%
- ⚠️ shortestPath: Not supported (use traversal instead)
- Overall: ~80% compatible

### Real-Time Sync

- Reactive (NOT polling)
- <1s lag typical
- Requires Convex running
- Uses `client.onUpdate()` pattern

---

## Next Steps

- **[Graph Database Setup](../07-advanced-topics/05-graph-database-setup.md)** - Quick start guide
- **[Graph Database Integration](../07-advanced-topics/02-graph-database-integration.md)** - Detailed guide
- **[Graph Database Selection](../07-advanced-topics/04-graph-database-selection.md)** - Neo4j vs Memgraph

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
