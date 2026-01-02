# Graph Database Integration Guide

> **Last Updated**: 2026-01-01

Comprehensive guide for integrating a graph database with Cortex for advanced relationship queries.

## Overview

This guide covers everything you need to add graph database capabilities to Cortex: from deciding if you need it, to choosing the right database, to setup and integration.

**What you'll learn:**

- When to add a graph database (vs using built-in Graph-Lite)
- Which graph database to choose (Neo4j vs Memgraph vs others)
- How to set up with Docker
- How to integrate with TypeScript
- Sync patterns and workers
- Advanced query patterns

**Prerequisites:**

- Cortex SDK installed and working
- Convex deployment running
- Basic understanding of graph databases
- Docker (recommended for local development)

---

## Section 1: Should You Add a Graph Database?

### Graph-Lite vs Native Graph

**Graph-Lite (built-in) is sufficient for:**

- Context hierarchies (depth 1-5)
- Agent collaboration patterns (1-3 hops)
- Audit trails with known paths
- User data relationships

See **[Graph Capabilities](./01-graph-capabilities.md)** for built-in graph features without external databases.

**Add a native graph database when you need:**

- Deep traversals (6+ hops)
- Complex pattern matching
- Graph algorithms (PageRank, shortest path, centrality)
- Sub-100ms query latency for multi-hop
- Dense relationship networks

### Performance Comparison

```
Query: "Find all agents connected to user-123 through any workflow"

Graph-Lite (Convex):
- Multiple sequential queries
- 5 hops = ~500-800ms
- 10 hops = impractical (2000ms+)

Native Graph (Neo4j):
- Single Cypher query
- 5 hops = ~30ms
- 10 hops = ~50ms
- 20× faster! ✅
```

### Decision Matrix

| Your Need                      | Graph-Lite      | Native Graph DB |
| ------------------------------ | --------------- | --------------- |
| Context hierarchies (depth <5) | ✅ Perfect      | ⚠️ Overkill     |
| Audit trails (known paths)     | ✅ Perfect      | ⚠️ Overkill     |
| Agent collaboration (1-3 hops) | ✅ Good         | Better          |
| Deep traversals (6+ hops)      | ❌ Too slow     | ✅ Required     |
| Pattern matching               | ❌ Very hard    | ✅ Required     |
| Graph algorithms               | ❌ Not feasible | ✅ Required     |
| Dense relationship networks    | ⚠️ Slow         | ✅ Best         |

---

## Section 2: Choosing a Graph Database

### Quick Recommendation

- **Development:** Memgraph (fast, easy Docker setup)
- **Production:** Neo4j Community (proven, mature, large community)
- **Enterprise:** Cortex Graph-Premium (fully managed, zero DevOps)

### Comparison Matrix

| Database            | License | Local Deploy      | TypeScript Support   | Query Language      | Performance            | Community | Recommendation              |
| ------------------- | ------- | ----------------- | -------------------- | ------------------- | ---------------------- | --------- | --------------------------- |
| **Neo4j Community** | GPL v3  | ✅ Docker/Install | ⭐⭐⭐⭐⭐ Excellent | Cypher (native)     | ⭐⭐⭐⭐⭐             | Large     | ⭐⭐⭐⭐⭐ Best overall     |
| **Memgraph**        | BSL     | ✅ Docker         | ⭐⭐⭐⭐⭐ Excellent | Cypher (compatible) | ⭐⭐⭐⭐⭐ (in-memory) | Growing   | ⭐⭐⭐⭐⭐ Best performance |
| **Kùzu**            | MIT     | ✅ Embedded       | ⭐⭐ Limited         | Cypher (compatible) | ⭐⭐⭐⭐ Good          | Small     | ⭐⭐⭐ Experimental         |

### Neo4j Community Edition

**Overview:** Industry-standard graph database with Cypher query language.

**Pros:**

- Most popular graph DB (large community)
- Excellent documentation and tooling
- Production-ready and battle-tested
- Great TypeScript support (neo4j-driver)
- Scales to billions of nodes

**Cons:**

- GPL license (copyleft, may require legal review)
- Heavier than alternatives
- Enterprise features require commercial license

**Best For:** Production deployments, long-term projects

### Memgraph

**Overview:** High-performance in-memory graph database, Neo4j-compatible.

**Pros:**

- Very fast (in-memory architecture)
- Neo4j compatible (same Bolt protocol, Cypher language)
- Works with neo4j-driver (same code as Neo4j!)
- Modern and actively developed

**Cons:**

- BSL license (source-available, not OSI open-source)
- Requires sufficient RAM
- Smaller community than Neo4j

**Best For:** High-performance requirements, development

### License Considerations

**GPL v3 (Neo4j Community):**

- Free to use
- Must open-source your application if you distribute it
- SaaS usage: Generally okay if not competing with Neo4j
- For Cortex integration: Likely fine (user runs Neo4j)

**BSL (Memgraph):**

- Source-available, free for development
- Commercial use allowed for most cases
- Can't offer Memgraph "as a service"
- After 4 years, converts to Apache 2.0

**Our Recommendation:** Start with **Memgraph for development** (fast, easy), use **Neo4j for production** (mature, proven).

---

## Section 3: Setup & Configuration

### Quick Start with Docker

**Time to complete:** 5 minutes

#### Neo4j Setup

```bash
# Start Neo4j from project root
docker-compose -f docker-compose.graph.yml up -d neo4j

# Verify it's running
docker ps
# Should see: cortex-neo4j (ports 7474, 7687)

# Access Neo4j Browser
open http://localhost:7474
# Username: neo4j
# Password: cortex-dev-password
```

#### Memgraph Setup

```bash
# Start Memgraph
docker-compose -f docker-compose.graph.yml up -d memgraph

# Verify it's running
docker ps
# Should see: cortex-memgraph (ports 7688, 3001)

# Access Memgraph Lab
open http://localhost:3001
# Username: memgraph
# Password: cortex-dev-password
```

### Environment Configuration

Add to `.env.local`:

**For Neo4j:**

```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=cortex-dev-password
```

**For Memgraph:**

```bash
MEMGRAPH_URI=bolt://localhost:7688
MEMGRAPH_USERNAME=memgraph
MEMGRAPH_PASSWORD=cortex-dev-password
```

### Verify Connection

**Test in Browser/Lab:**

```cypher
RETURN "Connected!" as message
```

### Docker Management

```bash
# Stop services
docker-compose -f docker-compose.graph.yml stop neo4j
docker-compose -f docker-compose.graph.yml stop memgraph

# Restart
docker-compose -f docker-compose.graph.yml restart neo4j

# View logs
docker-compose -f docker-compose.graph.yml logs -f neo4j

# Fresh start (deletes data)
docker-compose -f docker-compose.graph.yml down -v
docker-compose -f docker-compose.graph.yml up -d
```

### Troubleshooting Setup

**Issue: Containers won't start**

```bash
# Check if ports are in use
lsof -i :7474 -i :7687 -i :7688 -i :3001

# If ports are in use, stop conflicting services
```

**Issue: "Connection refused"**

1. Wait 30 seconds for containers to fully start
2. Check container health: `docker-compose -f docker-compose.graph.yml ps`
3. Check logs: `docker-compose -f docker-compose.graph.yml logs`

**Issue: "Authentication failed"**

- Verify username/password in `.env.local`
- Neo4j: `neo4j` / `cortex-dev-password`
- Memgraph: `memgraph` / `cortex-dev-password`
- If changed, reset: `docker-compose -f docker-compose.graph.yml down -v && docker-compose -f docker-compose.graph.yml up -d`

---

## Section 4: TypeScript Integration

### Install Dependencies

```bash
npm install neo4j-driver
npm install --save-dev @types/neo4j-driver
```

### Basic Connection

```typescript
import neo4j from "neo4j-driver";

// Create driver
const driver = neo4j.driver(
  process.env.GRAPH_DB_URI || "bolt://localhost:7687",
  neo4j.auth.basic(
    process.env.GRAPH_DB_USER || "neo4j",
    process.env.GRAPH_DB_PASSWORD || "password",
  ),
);

// Test connection
async function testConnection() {
  const session = driver.session();

  try {
    const result = await session.run("RETURN 1 as test");
    console.log("Graph DB connected:", result.records[0].get("test"));
  } finally {
    await session.close();
  }
}

await testConnection();
```

### Initialize Graph Schema

```typescript
async function initializeGraphSchema() {
  const session = driver.session();

  try {
    // Create constraints (unique IDs)
    await session.run(`
      CREATE CONSTRAINT memory_space_id IF NOT EXISTS
      FOR (ms:MemorySpace) REQUIRE ms.memorySpaceId IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT context_id IF NOT EXISTS
      FOR (c:Context) REQUIRE c.contextId IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT fact_id IF NOT EXISTS
      FOR (f:Fact) REQUIRE f.factId IS UNIQUE
    `);

    // Create indexes for common queries
    await session.run(`
      CREATE INDEX context_status IF NOT EXISTS
      FOR (c:Context) ON (c.status)
    `);

    await session.run(`
      CREATE INDEX fact_category IF NOT EXISTS
      FOR (f:Fact) ON (f.factType)
    `);

    console.log("Graph schema initialized");
  } finally {
    await session.close();
  }
}

await initializeGraphSchema();
```

---

## Section 5: Syncing Cortex to Graph

### Strategy 1: Automatic Sync (Recommended)

Use Cortex's built-in graph sync:

```typescript
import { Cortex } from "@cortexmemory/sdk";
import { CypherGraphAdapter } from "@cortexmemory/sdk/graph";

// Setup graph adapter
const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: "bolt://localhost:7687",
  username: "neo4j",
  password: "cortex-dev-password",
});

// Initialize Cortex with graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    autoSync: true, // Auto-start sync worker
  },
});

// Use Cortex normally - graph syncs automatically!
await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I work at Acme Corp",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "User",
});
// Automatically synced to graph! ✅
```

### Strategy 2: Manual Sync Functions

For fine-grained control:

```typescript
import {
  syncContextToGraph,
  syncMemoryToGraph,
  syncFactToGraph,
} from "@cortexmemory/sdk/graph";

// Sync a context
const context = await cortex.contexts.get("ctx-001");
const nodeId = await syncContextToGraph(context, graphAdapter);

// Sync a memory
const memory = await cortex.vector.get("agent-1", "mem-123");
await syncMemoryToGraph(memory, graphAdapter);

// Sync a fact
const fact = await cortex.facts.get("agent-1", "fact-456");
await syncFactToGraph(fact, graphAdapter);
```

### Real-Time Sync Worker

The auto-sync worker uses Convex reactive queries:

```typescript
// Worker starts automatically with autoSync: true
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    autoSync: true,
    syncWorkerOptions: {
      batchSize: 100,
      retryAttempts: 3,
      verbose: true,
    },
  },
});

// Monitor worker health
const worker = cortex.getGraphSyncWorker();
if (worker) {
  const metrics = worker.getMetrics();
  console.log("Worker metrics:", metrics);
  // { isRunning: true, totalProcessed: 150, queueSize: 3, ... }
}
```

### Sync Context Example

```typescript
async function syncContextToGraph(context: Context) {
  const session = driver.session();

  try {
    // Create context node
    await session.run(
      `
      MERGE (c:Context {contextId: $contextId})
      SET c.purpose = $purpose,
          c.status = $status,
          c.depth = $depth,
          c.createdAt = $createdAt
    `,
      {
        contextId: context.contextId,
        purpose: context.purpose,
        status: context.status,
        depth: context.depth,
        createdAt: context.createdAt,
      },
    );

    // Create parent-child relationship
    if (context.parentId) {
      await session.run(
        `
        MATCH (child:Context {contextId: $childId})
        MATCH (parent:Context {contextId: $parentId})
        MERGE (child)-[:CHILD_OF]->(parent)
      `,
        {
          childId: context.contextId,
          parentId: context.parentId,
        },
      );
    }
  } finally {
    await session.close();
  }
}
```

### Sync Facts with Entities

```typescript
async function syncFactToGraph(fact: FactRecord) {
  const session = driver.session();

  try {
    // Create fact node
    await session.run(
      `
      MERGE (f:Fact {factId: $factId})
      SET f.fact = $fact,
          f.factType = $factType,
          f.confidence = $confidence
    `,
      {
        factId: fact.factId,
        fact: fact.fact,
        factType: fact.factType,
        confidence: fact.confidence,
      },
    );

    // Create entity nodes and relationships
    if (fact.entities) {
      for (const entity of fact.entities) {
        await session.run(
          `
          MERGE (e:Entity {name: $name, type: $type})
          WITH e
          MATCH (f:Fact {factId: $factId})
          MERGE (f)-[:MENTIONS]->(e)
        `,
          {
            name: entity.name,
            type: entity.type,
            factId: fact.factId,
          },
        );
      }
    }
  } finally {
    await session.close();
  }
}
```

---

## Section 6: Querying the Graph

### Basic Queries

**Find all contexts for a memory space:**

```typescript
async function getMemorySpaceContexts(memorySpaceId: string) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (c:Context)
      WHERE c.memorySpaceId = $memorySpaceId
      RETURN c
      ORDER BY c.createdAt DESC
    `,
      { memorySpaceId },
    );

    return result.records.map((r) => r.get("c").properties);
  } finally {
    await session.close();
  }
}
```

**Find context hierarchy:**

```typescript
async function getContextHierarchy(rootContextId: string) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (root:Context {contextId: $rootId})
      MATCH path = (root)<-[:CHILD_OF*0..10]-(descendants:Context)
      RETURN descendants
      ORDER BY descendants.depth
    `,
      { rootId: rootContextId },
    );

    return result.records.map((r) => r.get("descendants").properties);
  } finally {
    await session.close();
  }
}
```

**Find related facts via entities:**

```typescript
async function findRelatedFacts(factId: string) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (f:Fact {factId: $factId})
      MATCH (f)-[:MENTIONS]->(e:Entity)<-[:MENTIONS]-(related:Fact)
      WHERE related.factId <> $factId
      RETURN related.factId as id, 
             related.fact as fact,
             collect(DISTINCT e.name) as sharedEntities
      ORDER BY size(sharedEntities) DESC
      LIMIT 10
    `,
      { factId },
    );

    return result.records.map((r) => ({
      id: r.get("id"),
      fact: r.get("fact"),
      sharedEntities: r.get("sharedEntities"),
    }));
  } finally {
    await session.close();
  }
}
```

### Advanced Queries

**Shortest path between user and agent:**

```typescript
async function findPathToMemorySpace(userId: string, memorySpaceId: string) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u:User {userId: $userId})
      MATCH (ms:MemorySpace {memorySpaceId: $memorySpaceId})
      MATCH path = shortestPath((u)-[*..10]-(ms))
      RETURN path
    `,
      { userId, memorySpaceId },
    );

    if (result.records.length === 0) return null;

    const path = result.records[0].get("path");
    return {
      length: path.length,
      nodes: path.segments.map((s) => s.start.properties),
      relationships: path.segments.map((s) => s.relationship.type),
    };
  } finally {
    await session.close();
  }
}
```

### Combining Graph with Convex

**Best practice:** Use Convex for primary data, graph for relationships:

```typescript
async function hybridContextQuery(userId: string) {
  // Step 1: Get user's contexts from Convex (authoritative)
  const contexts = await cortex.contexts.list({
    userId,
    status: "active",
    limit: 50,
  });

  // Step 2: For each context, get related contexts via graph
  const enriched = await Promise.all(
    contexts.map(async (context) => {
      const session = driver.session();

      try {
        const related = await session.run(
          `
          MATCH (c:Context {contextId: $contextId})
          MATCH (c)-[:PARENT_OF|CHILD_OF*1..3]-(r:Context)
          RETURN DISTINCT r.contextId as contextId
        `,
          { contextId: context.contextId },
        );

        return {
          ...context,
          relatedContextIds: related.records.map((r) => r.get("contextId")),
        };
      } finally {
        await session.close();
      }
    }),
  );

  return enriched;
}
```

---

## Section 7: Performance & Best Practices

### Indexing Strategy

```cypher
-- Context queries
CREATE INDEX context_status FOR (c:Context) ON (c.status);
CREATE INDEX context_depth FOR (c:Context) ON (c.depth);

-- Fact queries
CREATE INDEX fact_category FOR (f:Fact) ON (f.factType);
CREATE INDEX fact_confidence FOR (f:Fact) ON (f.confidence);

-- Entity queries
CREATE INDEX entity_name FOR (e:Entity) ON (e.name);
```

### Query Optimization

```typescript
// ✅ Good: Use parameters (query plan cached)
await session.run(
  `
  MATCH (c:Context {contextId: $contextId})
  RETURN c
`,
  { contextId },
);

// ❌ Bad: String concatenation (new plan each time)
await session.run(`
  MATCH (c:Context {contextId: '${contextId}'})
  RETURN c
`);

// ✅ Good: Limit results
MATCH (c:Context)-[:CHILD_OF*1..3]-(related)
RETURN related
LIMIT 100

// ✅ Good: Use DISTINCT
MATCH (c:Context)-[:CHILD_OF*1..3]-(related:Context)
RETURN DISTINCT related
```

### Best Practices

#### 1. Convex is Source of Truth

```typescript
// ✅ Always write to Convex first
await cortex.contexts.create({ ... });
await syncContextToGraph(context);  // Then sync

// ❌ Don't write to graph first
await graphAdapter.createNode({ ... });  // Graph could succeed but Convex fail
```

#### 2. Handle Sync Failures Gracefully

```typescript
// ✅ App continues working if graph sync fails
try {
  await syncToGraph(entity);
} catch (error) {
  console.error("Graph sync failed (non-critical):", error);
  // App continues, will retry later
}
```

#### 3. Graph is Rebuildable

```typescript
// Graph should be rebuildable from Convex at any time
async function rebuildGraphFromConvex() {
  console.log("Rebuilding graph from Convex...");

  // Clear graph
  const session = driver.session();
  await session.run("MATCH (n) DETACH DELETE n");
  await session.close();

  // Re-sync all data
  await initialGraphSync();

  console.log("Graph rebuilt successfully");
}
```

#### 4. Use Graph for Discovery, Not Storage

```typescript
// ✅ Query graph for relationships
const related = await graphAdapter.query(`
  MATCH (m:Memory)-[:REFERENCES]->(c:Conversation)
  RETURN c.conversationId
`);

// ✅ But fetch full data from Convex
for (const record of related.records) {
  const conversation = await cortex.conversations.get(record.conversationId);
  // Full data from authoritative source
}
```

---

## Section 8: Troubleshooting

### Graph Out of Sync

**Problem:** Graph returns stale data

**Solution:**

```typescript
// Force re-sync
async function forceSyncContext(contextId: string) {
  const context = await cortex.contexts.get(contextId);
  await syncContextToGraph(context);
  console.log(`Context ${contextId} re-synced to graph`);
}

// Verify sync
async function verifySync(contextId: string) {
  const convexContext = await cortex.contexts.get(contextId);

  const session = driver.session();
  const graphContext = await session.run(
    `
    MATCH (c:Context {contextId: $contextId})
    RETURN c
  `,
    { contextId },
  );
  await session.close();

  if (graphContext.records.length === 0) {
    console.warn("Context missing from graph!");
    await syncContextToGraph(convexContext);
  }
}
```

### Slow Graph Queries

**Solutions:**

1. **Add indexes:**

```cypher
CREATE INDEX IF NOT EXISTS FOR (c:Context) ON (c.contextId);
```

2. **Limit depth:**

```cypher
-- ❌ Slow: Unlimited depth
MATCH (a)-[*]-(b) RETURN b

-- ✅ Fast: Limited depth
MATCH (a)-[*1..5]-(b) RETURN b
```

3. **Profile queries:**

```cypher
PROFILE
MATCH (c:Context {contextId: 'ctx-123'})-[:CHILD_OF*1..3]-(related)
RETURN related
-- Shows query plan and performance
```

### Connection Issues

```typescript
// Test connection with better error handling
async function testGraphConnection() {
  try {
    const driver = neo4j.driver(
      process.env.GRAPH_DB_URI!,
      neo4j.auth.basic(
        process.env.GRAPH_DB_USER!,
        process.env.GRAPH_DB_PASSWORD!,
      ),
    );

    const session = driver.session();
    await session.run("RETURN 1");
    await session.close();

    console.log("✅ Graph DB connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Graph DB connection failed:", error.message);
    console.error("Check: URI, username, password, network access");
    return false;
  }
}
```

---

## Section 9: Complete Integration Example

Here's a full working example:

```typescript
// app.ts
import { Cortex } from "@cortexmemory/sdk";
import {
  CypherGraphAdapter,
  initializeGraphSchema,
} from "@cortexmemory/sdk/graph";

// Initialize graph adapter
const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: "bolt://localhost:7687",
  username: "neo4j",
  password: "cortex-dev-password",
});

// Initialize schema
await initializeGraphSchema(graphAdapter);

// Initialize Cortex with graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    autoSync: true,
  },
});

// Use Cortex normally
await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I work at Acme Corp with Alice",
  agentResponse: "Got it!",
  userId: "user-123",
  userName: "User",
  extractFacts: async () => [
    {
      fact: "User works at Acme Corp",
      factType: "relationship",
      subject: "user-123",
      predicate: "worksAt",
      object: "Acme Corp",
      confidence: 95,
    },
  ],
});

// Graph query (after sync)
await new Promise((r) => setTimeout(r, 1000)); // Wait for sync

const session = graphAdapter.session();
const result = await session.run(`
  MATCH (f:Fact)-[:MENTIONS]->(e:Entity {name: 'Acme Corp'})
  RETURN f.fact as fact
`);
await session.close();

console.log(
  "Facts about Acme Corp:",
  result.records.map((r) => r.get("fact")),
);
```

---

## Next Steps

- **[Graph Capabilities](./01-graph-capabilities.md)** - Built-in graph features (Graph-Lite)
- **[Graph Operations API](../03-api-reference/13-graph-operations.md)** - Complete API reference
- **[Context Chains](../02-core-features/04-context-chains.md)** - Hierarchical coordination

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
