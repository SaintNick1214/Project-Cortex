# Graph Database Integration Guide

> **Last Updated**: 2025-10-28

Step-by-step guide for integrating a graph database with Cortex for advanced relationship queries.

## Overview

This guide shows you how to add graph database capabilities to Cortex. While **Graph-Lite** (built-in) handles most use cases, a native graph database unlocks powerful features for complex relationship queries.

**What you'll learn:**

- When to add a graph database
- Which graph database to choose
- How to set up and configure
- Sync patterns (Convex → Graph)
- Query examples and performance tuning

**Prerequisites:**

- Cortex SDK installed and working
- Convex deployment running
- Basic understanding of graph databases
- Docker (recommended for local development)

## Why Add a Graph Database?

### Graph-Lite vs Native Graph

**Graph-Lite is sufficient for:**

- Context hierarchies (depth 1-5)
- Agent collaboration patterns (1-3 hops)
- Audit trails with known paths
- User data relationships

**Add a graph database when you need:**

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

### Use Case Decision Matrix

**✅ Graph-Lite is sufficient for:**

| Use Case                          | Why It Works                                |
| --------------------------------- | ------------------------------------------- |
| Customer support ticketing system | Context chains (depth 1-3), known workflows |
| Simple multi-agent coordination   | Direct A2A relationships (1-2 hops)         |
| Project task hierarchies          | Parent-child contexts (depth < 5)           |
| Audit trails (known paths)        | Sequential workflow tracing                 |
| User preferences and profiles     | Direct userId relationships                 |
| Basic conversation tracing        | conversationRef links (1-hop)               |

**⚡ Add Native Graph DB for:**

| Use Case                                    | Why You Need It                                      |
| ------------------------------------------- | ---------------------------------------------------- |
| Healthcare evidence chains (FDA compliance) | Deep multi-hop provenance (10+ hops), <100ms queries |
| Complex multi-agent networks (50+ agents)   | Pattern matching, community detection                |
| Organizational knowledge graph              | Dense relationships, graph algorithms                |
| Fraud detection (unknown patterns)          | Pattern matching, anomaly detection                  |
| Social network / recommendations            | PageRank, shortest path, centrality                  |
| Legal case relationships                    | Complex relationship queries, evidence chains        |

## Supported Graph Databases

### Neo4j Community Edition

**Overview:** Industry-standard graph database with Cypher query language.

**Pros:**

- Most popular graph DB (large community)
- Excellent documentation and tooling
- Production-ready and battle-tested
- Great TypeScript support (neo4j-driver)
- Good performance (disk-based, scales to billions of nodes)

**Cons:**

- GPL license (copyleft, may require legal review)
- Heavier than alternatives (uses more resources)
- Enterprise features require commercial license

**License:** GPL v3 (Community), Commercial (Enterprise)

**Setup Difficulty:** Medium  
**Performance:** Excellent  
**Recommendation:** ⭐⭐⭐⭐⭐ Best for production

### Memgraph

**Overview:** High-performance in-memory graph database, Neo4j-compatible.

**Pros:**

- Very fast (in-memory architecture)
- Neo4j compatible (same Bolt protocol, Cypher language)
- Good documentation
- Works with neo4j-driver
- Modern and actively developed

**Cons:**

- BSL license (source-available, not OSI open-source)
- Requires sufficient RAM (all data in memory)
- Smaller community than Neo4j

**License:** BSL (Business Source License)

**Setup Difficulty:** Easy  
**Performance:** Excellent (fastest for queries)  
**Recommendation:** ⭐⭐⭐⭐⭐ Best for performance

### Kùzu

**Overview:** Embedded graph database ("SQLite for graphs").

**Pros:**

- MIT license (truly open source)
- Embedded (no separate server)
- Cypher-compatible
- Lightweight

**Cons:**

- Smaller community
- Less mature than Neo4j/Memgraph
- Limited TypeScript bindings
- Maintenance status uncertain

**License:** MIT

**Setup Difficulty:** Easy (if bindings available)  
**Performance:** Good  
**Recommendation:** ⭐⭐⭐ Experimental / lightweight use

### Quick Comparison

| Feature               | Neo4j             | Memgraph         | Kùzu        |
| --------------------- | ----------------- | ---------------- | ----------- |
| **Query Language**    | Cypher            | Cypher           | Cypher      |
| **Protocol**          | Bolt              | Bolt             | Bolt        |
| **TypeScript Driver** | ✅ neo4j-driver   | ✅ neo4j-driver  | ⚠️ Limited  |
| **Storage**           | Disk              | Memory           | Embedded    |
| **Max Scale**         | Billions of nodes | RAM-limited      | Medium      |
| **Performance**       | Excellent         | Excellent+       | Good        |
| **License**           | GPL (Community)   | BSL              | MIT         |
| **Setup**             | Docker / Cloud    | Docker / Cloud   | Embedded    |
| **Best For**          | Production        | High-performance | Lightweight |

**Our Recommendation:** Start with **Memgraph** for development (fast, easy), use **Neo4j** for production (mature, proven).

## Setup Guide

### Option 1: Docker Compose (Recommended)

Create `docker-compose.yml` in your project:

```yaml
version: "3.8"

services:
  # Convex local development
  convex:
    image: convex/backend:latest
    ports:
      - "3210:3210"
    volumes:
      - convex-data:/data
    environment:
      - CONVEX_DEPLOYMENT=dev

  # Neo4j graph database
  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474" # HTTP (UI)
      - "7687:7687" # Bolt (queries)
    environment:
      - NEO4J_AUTH=neo4j/your-password-here
      - NEO4J_PLUGINS=["apoc"] # Useful procedures
      - NEO4J_dbms_memory_heap_max__size=2G
    volumes:
      - neo4j-data:/data
      - neo4j-logs:/logs

  # Alternative: Memgraph (faster)
  # memgraph:
  #   image: memgraph/memgraph:latest
  #   ports:
  #     - "7687:7687"
  #   environment:
  #     - MEMGRAPH_USER=cortex
  #     - MEMGRAPH_PASSWORD=your-password-here
  #   volumes:
  #     - memgraph-data:/var/lib/memgraph

volumes:
  convex-data:
  neo4j-data:
  neo4j-logs:
  # memgraph-data:
```

**Start services:**

```bash
docker-compose up -d
```

**Access Neo4j UI:** http://localhost:7474 (username: `neo4j`, password: `your-password-here`)

### Option 2: Local Install

**Neo4j:**

```bash
# macOS
brew install neo4j

# Linux
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
sudo apt-get install neo4j

# Start
neo4j start
```

**Memgraph:**

```bash
# macOS
brew install memgraph

# Linux (Docker recommended)
docker run -p 7687:7687 memgraph/memgraph:latest
```

### Option 3: Cloud Services

**Neo4j Aura (Managed):**

- Sign up at https://neo4j.com/cloud/aura/
- Create free tier instance
- Get connection URI (neo4j+s://xxxx.databases.neo4j.io)

**Memgraph Cloud:**

- Sign up at https://memgraph.com/cloud
- Create instance
- Get Bolt URI

## TypeScript Integration

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

### Create Graph Schema

```typescript
async function initializeGraphSchema() {
  const session = driver.session();

  try {
    // Create constraints (unique IDs)
    await session.run(`
      CREATE CONSTRAINT agent_id IF NOT EXISTS
      FOR (a:Agent) REQUIRE a.agentId IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT user_id IF NOT EXISTS
      FOR (u:User) REQUIRE u.userId IS UNIQUE
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
      CREATE INDEX agent_name IF NOT EXISTS
      FOR (a:Agent) ON (a.name)
    `);

    await session.run(`
      CREATE INDEX context_status IF NOT EXISTS
      FOR (c:Context) ON (c.status)
    `);

    await session.run(`
      CREATE INDEX fact_category IF NOT EXISTS
      FOR (f:Fact) ON (f.category)
    `);

    console.log("Graph schema initialized");
  } finally {
    await session.close();
  }
}

await initializeGraphSchema();
```

## Syncing Cortex to Graph

### Strategy 1: Manual Sync Functions

**Sync a context to graph:**

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
          c.createdAt = $createdAt,
          c.updatedAt = $updatedAt
    `,
      {
        contextId: context.id,
        purpose: context.purpose,
        status: context.status,
        depth: context.depth,
        createdAt: context.createdAt.getTime(),
        updatedAt: context.updatedAt.getTime(),
      },
    );

    // Create agent node (if not exists)
    await session.run(
      `
      MERGE (a:Agent {agentId: $agentId})
    `,
      {
        memorySpaceId: context.memorySpaceId,
      },
    );

    // Create HANDLED_BY relationship
    await session.run(
      `
      MATCH (c:Context {contextId: $contextId})
      MATCH (a:Agent {agentId: $agentId})
      MERGE (c)-[:HANDLED_BY]->(a)
    `,
      {
        contextId: context.id,
        memorySpaceId: context.memorySpaceId,
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
          childId: context.id,
          parentId: context.parentId,
        },
      );
    }

    // Create user relationship (if userId exists)
    if (context.userId) {
      await session.run(
        `
        MERGE (u:User {userId: $userId})
        WITH u
        MATCH (c:Context {contextId: $contextId})
        MERGE (c)-[:RELATES_TO]->(u)
      `,
        {
          userId: context.userId,
          contextId: context.id,
        },
      );
    }
  } finally {
    await session.close();
  }
}

// Usage
const context = await cortex.contexts.get("ctx-001");
await syncContextToGraph(context);
```

**Sync A2A communication:**

```typescript
async function syncA2AToGraph(memory: MemoryEntry) {
  if (memory.source.type !== "a2a") return;

  const session = driver.session();

  try {
    // Ensure agent nodes exist
    await session.run(
      `
      MERGE (from:Agent {agentId: $fromAgent})
      MERGE (to:Agent {agentId: $toAgent})
    `,
      {
        fromAgent: memory.source.fromAgent,
        toAgent: memory.metadata.toAgent,
      },
    );

    // Create communication relationship
    await session.run(
      `
      MATCH (from:Agent {agentId: $fromAgent})
      MATCH (to:Agent {agentId: $toAgent})
      CREATE (from)-[r:SENT_TO {
        messageId: $messageId,
        importance: $importance,
        timestamp: $timestamp,
        content: $content
      }]->(to)
    `,
      {
        fromAgent: memory.source.fromAgent,
        toAgent: memory.metadata.toAgent,
        messageId: memory.metadata.messageId,
        importance: memory.metadata.importance,
        timestamp: memory.createdAt.getTime(),
        content: memory.content.substring(0, 100), // Truncate for graph
      },
    );
  } finally {
    await session.close();
  }
}
```

**Sync facts with entities:**

```typescript
async function syncFactToGraph(fact: ImmutableRecord) {
  if (fact.type !== "fact") return;

  const session = driver.session();

  try {
    // Create fact node
    await session.run(
      `
      MERGE (f:Fact {factId: $factId})
      SET f.fact = $fact,
          f.category = $category,
          f.confidence = $confidence,
          f.version = $version,
          f.createdAt = $createdAt
    `,
      {
        factId: fact.id,
        fact: fact.data.fact,
        category: fact.data.category,
        confidence: fact.data.confidence || 1.0,
        version: fact.version,
        createdAt: fact.createdAt,
      },
    );

    // Create entity nodes and relationships
    if (fact.data.entities) {
      for (const entity of fact.data.entities) {
        await session.run(
          `
          MERGE (e:Entity {name: $name})
          WITH e
          MATCH (f:Fact {factId: $factId})
          MERGE (f)-[:MENTIONS]->(e)
        `,
          {
            name: entity,
            factId: fact.id,
          },
        );
      }
    }

    // Create typed relationships (if extracted)
    if (fact.data.relations) {
      for (const rel of fact.data.relations) {
        await session.run(
          `
          MERGE (subj:Entity {name: $subject})
          MERGE (obj:Entity {name: $object})
          MERGE (subj)-[r:${rel.predicate.toUpperCase()} {
            factId: $factId,
            confidence: $confidence
          }]->(obj)
        `,
          {
            subject: rel.subject,
            object: rel.object,
            factId: fact.id,
            confidence: rel.confidence || 1.0,
          },
        );
      }
    }
  } finally {
    await session.close();
  }
}
```

### Strategy 2: Automated Sync Worker

**Background sync process:**

```typescript
import { Cortex } from "@cortex-platform/sdk";
import neo4j from "neo4j-driver";

class CortexGraphSyncWorker {
  private cortex: Cortex;
  private driver: neo4j.Driver;
  private lastSyncTimestamp: number;

  constructor(cortexConfig: CortexConfig, graphConfig: GraphConfig) {
    this.cortex = new Cortex(cortexConfig);
    this.driver = neo4j.driver(
      graphConfig.uri,
      neo4j.auth.basic(graphConfig.username, graphConfig.password),
    );
    this.lastSyncTimestamp = Date.now();
  }

  async start() {
    console.log("Starting Cortex → Graph sync worker (real-time)...");

    // Initial sync (backfill existing data)
    await this.initialSync();

    // Real-time sync via Convex triggers and reactive queries
    // Subscribe to sync queue (auto-updates when triggers fire)
    this.convexClient.onUpdate(
      api.graphSync.getUnsynced,
      { limit: 100 },
      async (unsyncedItems) => {
        await this.processSyncBatch(unsyncedItems);
      },
    );

    console.log("Sync worker active - real-time monitoring via Convex");
  }

  private async processSyncBatch(items: SyncQueueItem[]) {
    for (const item of items) {
      try {
        if (item.operation === "insert" || item.operation === "update") {
          await this.syncEntity(item.entity, item.table);
        } else if (item.operation === "delete") {
          await this.deleteFromGraph(item.entityId);
        }

        // Mark as synced
        await this.convexClient.mutation(api.graphSync.markSynced, {
          id: item._id,
        });
      } catch (error) {
        console.error(`Sync failed for ${item.table}:${item.entityId}`, error);
      }
    }
  }

  private async initialSync() {
    console.log("Running initial graph sync...");

    // Sync all users
    const users = await this.cortex.users.list({ limit: 10000 });
    for (const user of users.users) {
      await this.syncUser(user);
    }

    // Sync all agents
    const agents = await this.cortex.agents.list({ limit: 1000 });
    for (const agent of agents.agents) {
      await this.syncAgent(agent);
    }

    // Sync all contexts
    const contexts = await this.cortex.contexts.list({ limit: 10000 });
    for (const context of contexts.contexts) {
      await this.syncContext(context);
    }

    // Sync all facts
    const facts = await this.cortex.immutable.list({
      type: "fact",
      limit: 10000,
    });
    for (const fact of facts.records) {
      await this.syncFact(fact);
    }

    console.log("Initial sync complete");
  }

  private async syncEntity(entity: any, table: string) {
    // Dispatch to appropriate sync method
    switch (table) {
      case "contexts":
        await this.syncContext(entity);
        break;
      case "immutable":
        if (entity.type === "fact") {
          await this.syncFact(entity);
        }
        break;
      case "memories":
        await this.syncMemory(entity);
        break;
      // ... other tables
    }
  }

  private async deleteFromGraph(entityId: string) {
    const session = this.driver.session();
    try {
      // Delete node and all relationships
      await session.run(
        `
        MATCH (n)
        WHERE elementId(n) = $entityId
        DETACH DELETE n
      `,
        { entityId },
      );
    } finally {
      await session.close();
    }
  }

  private async syncUser(user: UserProfile) {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MERGE (u:User {userId: $userId})
        SET u.displayName = $displayName,
            u.createdAt = $createdAt
      `,
        {
          userId: user.id,
          displayName: user.data.displayName || user.id,
          createdAt: user.createdAt,
        },
      );
    } finally {
      await session.close();
    }
  }

  private async syncAgent(agent: RegisteredAgent) {
    const session = this.driver.session();

    try {
      await session.run(
        `
        MERGE (a:Agent {agentId: $agentId})
        SET a.name = $name,
            a.capabilities = $capabilities,
            a.team = $team,
            a.createdAt = $createdAt
      `,
        {
          memorySpaceId: agent.id, // Note: Old agent model
          name: agent.name,
          capabilities: agent.metadata.capabilities || [],
          team: agent.metadata.team,
          createdAt: agent.registeredAt,
        },
      );
    } finally {
      await session.close();
    }
  }

  private async syncContext(context: Context) {
    // Implementation from earlier example
    await syncContextToGraph(context);
  }

  private async syncFact(fact: ImmutableRecord) {
    // Implementation from earlier example
    await syncFactToGraph(fact);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Start worker
const worker = new CortexGraphSyncWorker(
  { convexUrl: process.env.CONVEX_URL },
  {
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "password",
  },
);

await worker.start();
```

### Strategy 3: Event-Driven Sync (Advanced)

If Convex supports database triggers (check latest Convex docs):

```typescript
// Convex function: convex/triggers.ts
export const onContextCreated = internalMutation({
  args: { contextId: v.id("contexts") },
  handler: async (ctx, args) => {
    const context = await ctx.db.get(args.contextId);

    // Queue for graph sync
    await ctx.db.insert("graphSyncQueue", {
      type: "CONTEXT_CREATED",
      entityId: context._id,
      entity: context,
      timestamp: Date.now(),
      synced: false,
    });
  },
});

// Worker processes queue
async function processGraphSyncQueue() {
  while (true) {
    const items = await convex.query(api.graphSync.getUnsynced, { limit: 100 });

    for (const item of items) {
      try {
        if (item.type === "CONTEXT_CREATED") {
          await syncContextToGraph(item.entity);
        }
        // ... handle other types

        await convex.mutation(api.graphSync.markSynced, { id: item._id });
      } catch (error) {
        console.error("Sync failed:", error);
      }
    }

    await sleep(1000);
  }
}
```

## Querying the Graph

### Basic Queries

**Find all agents:**

```typescript
async function getAllAgents() {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (a:Agent)
      RETURN a
      ORDER BY a.name
    `);

    return result.records.map((r) => r.get("a").properties);
  } finally {
    await session.close();
  }
}
```

**Find agent collaborators:**

```typescript
async function getMemorySpaceCollaborators(memorySpaceId: string, maxHops = 2) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (a:Agent {agentId: $agentId})
      MATCH (a)-[:SENT_TO|RECEIVED_FROM*1..${maxHops}]-(connected:Agent)
      RETURN DISTINCT connected.agentId as agentId, connected.name as name
    `,
      { memorySpaceId },
    );

    return result.records.map((r) => ({
      memorySpaceId: r.get("agentId"), // Graph DB field name
      name: r.get("name"),
    }));
  } finally {
    await session.close();
  }
}

// Usage
const collaborators = await getAgentCollaborators("finance-agent", 2);
console.log("Collaborators:", collaborators);
// [{ agentId: 'hr-agent', name: 'HR Agent' }, ...]
```

**Find workflow chain:**

```typescript
async function getWorkflowChain(rootContextId: string) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (root:Context {contextId: $rootId})
      MATCH path = (root)-[:PARENT_OF*0..10]->(descendants:Context)
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

### Advanced Queries

**Shortest path between user and agent:**

```typescript
async function findPathToMemorySpace(userId: string, memorySpaceId: string) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u:User {userId: $userId})
      MATCH (a:Agent {agentId: $agentId})
      MATCH path = shortestPath((u)-[*..10]-(a))
      RETURN path
    `,
      { userId, memorySpaceId },
    );

    if (result.records.length === 0) {
      return null;
    }

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

// Usage
const path = await findPathToAgent("user-123", "specialist-agent");
console.log(`Path length: ${path.length} hops`);
console.log("Path:", path.relationships.join(" → "));
// Output: CREATED → TRIGGERED → HANDLED_BY
```

**Find central agents (most connected):**

```typescript
async function findCentralAgents(limit = 10) {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (a:Agent)
      OPTIONAL MATCH (a)-[r:SENT_TO|RECEIVED_FROM]-()
      WITH a, count(r) as connectionCount
      RETURN a.agentId as agentId, a.name as name, connectionCount
      ORDER BY connectionCount DESC
      LIMIT ${limit}
    `);

    return result.records.map((r) => ({
      memorySpaceId: r.get("agentId"), // Graph DB field name
      name: r.get("name"),
      connections: r.get("connectionCount").toNumber(),
    }));
  } finally {
    await session.close();
  }
}

// Usage
const central = await findCentralAgents(5);
console.log("Most connected agents:", central);
// [{ agentId: 'supervisor-agent', name: 'Supervisor', connections: 245 }, ...]
```

**Related facts via entities:**

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
             collect(DISTINCT e.name) as sharedEntities,
             related.confidence as confidence
      ORDER BY size(sharedEntities) DESC, confidence DESC
      LIMIT 10
    `,
      { factId },
    );

    return result.records.map((r) => ({
      id: r.get("id"),
      fact: r.get("fact"),
      sharedEntities: r.get("sharedEntities"),
      confidence: r.get("confidence"),
    }));
  } finally {
    await session.close();
  }
}
```

## Combining Graph with Convex Queries

### Hybrid Query Pattern

**Best practice:** Use Convex for primary data, graph for relationships:

```typescript
async function hybridContextQuery(userId: string) {
  // Step 1: Get user's contexts from Convex (fast, authoritative)
  const contexts = await cortex.contexts.list({
    userId,
    status: "active",
    limit: 50,
  });

  // Step 2: For each context, get related contexts via graph
  const enrichedContexts = await Promise.all(
    contexts.contexts.map(async (context) => {
      const session = driver.session();

      try {
        const related = await session.run(
          `
          MATCH (c:Context {contextId: $contextId})
          MATCH (c)-[:PARENT_OF|CHILD_OF|TRIGGERED_BY*1..3]-(related:Context)
          RETURN DISTINCT related.contextId as contextId
        `,
          { contextId: context.id },
        );

        const relatedIds = related.records.map((r) => r.get("contextId"));

        return {
          ...context,
          relatedContextIds: relatedIds,
        };
      } finally {
        await session.close();
      }
    }),
  );

  return enrichedContexts;
}
```

### Cache Graph Results in Convex

**Pattern:** Query graph, cache result in Convex metadata:

```typescript
async function updateContextWithGraphData(contextId: string) {
  // Query graph for related contexts
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (c:Context {contextId: $contextId})
      MATCH (c)-[:PARENT_OF*0..10]->(descendants:Context)
      RETURN count(descendants) as descendantCount
    `,
      { contextId },
    );

    const descendantCount = result.records[0].get("descendantCount").toNumber();

    // Cache in Convex
    await cortex.contexts.update(contextId, {
      data: {
        graphMetadata: {
          descendantCount,
          lastGraphQuery: new Date(),
          graphSynced: true,
        },
      },
    });

    return descendantCount;
  } finally {
    await session.close();
  }
}
```

## Performance Considerations

### Indexing Strategy

**Create indexes for fast queries:**

```cypher
-- Agent queries
CREATE INDEX agent_team FOR (a:Agent) ON (a.team);
CREATE INDEX agent_capabilities FOR (a:Agent) ON (a.capabilities);

-- Context queries
CREATE INDEX context_status FOR (c:Context) ON (c.status);
CREATE INDEX context_depth FOR (c:Context) ON (c.depth);

-- Fact queries
CREATE INDEX fact_category FOR (f:Fact) ON (f.category);
CREATE INDEX fact_confidence FOR (f:Fact) ON (f.confidence);

-- Entity queries
CREATE INDEX entity_type FOR (e:Entity) ON (e.type);
```

### Query Optimization

```typescript
// ✅ Good: Use parameters (query plan cached)
await session.run(`
  MATCH (a:Agent {agentId: $agentId})
  RETURN a
`, { agentId });

// ❌ Bad: String concatenation (new plan each time)
await session.run(`
  MATCH (a:Agent {agentId: '${agentId}'})
  RETURN a
`);

// ✅ Good: Limit results
MATCH (a:Agent)-[:SENT_TO*1..3]-(connected)
RETURN connected
LIMIT 100

// ✅ Good: Use DISTINCT to avoid duplicates
MATCH (a:Agent)-[:SENT_TO*1..3]-(connected:Agent)
RETURN DISTINCT connected
```

### Batch Operations

```typescript
// Sync many entities at once (faster)
async function batchSyncContexts(contexts: Context[]) {
  const session = driver.session();

  try {
    const tx = session.beginTransaction();

    for (const context of contexts) {
      await tx.run(
        `
        MERGE (c:Context {contextId: $contextId})
        SET c += $properties
      `,
        {
          contextId: context.id,
          properties: {
            purpose: context.purpose,
            status: context.status,
            depth: context.depth,
            createdAt: context.createdAt.getTime(),
          },
        },
      );
    }

    await tx.commit();
  } catch (error) {
    console.error("Batch sync failed:", error);
  } finally {
    await session.close();
  }
}
```

## Cloud Mode: Graph-Premium

### Zero-Configuration Setup

In Cloud Mode with Graph-Premium, all sync is automatic:

```typescript
const cortex = new Cortex({
  mode: "cloud",
  apiKey: process.env.CORTEX_CLOUD_KEY,

  graphPremium: {
    enabled: true, // Cortex Cloud manages Neo4j instance + sync
  },
});

// Graph queries just work
const result = await cortex.graph.traverse({
  start: { type: "user", id: "user-123" },
  relationships: ["CREATED", "TRIGGERED", "HANDLED_BY"],
  maxDepth: 10,
});

// No setup, no sync code, no graph DB management ✅
```

### Premium Features

**Graph Query API:**

```typescript
// Multi-hop traversal
await cortex.graph.traverse({
  start: NodeRef,
  relationships: string[],
  maxDepth: number,
  filter?: any
});

// Shortest path
await cortex.graph.findPath({
  from: NodeRef,
  to: NodeRef,
  maxHops: number
});

// Pattern matching (Cypher)
await cortex.graph.match({
  pattern: 'MATCH (a:Agent)-[:KNOWS*2..4]-(b:Agent) WHERE a.team = "engineering" RETURN b'
});

// Graph algorithms
await cortex.graph.centrality('pagerank');
await cortex.graph.communities();
```

**Visualization Dashboard:**

- Interactive graph visualization
- Filter by node type, relationship type
- Time-travel (see graph at past timestamp)
- Export to common formats (GraphML, JSON)

**Auto-Sync:**

- Real-time sync from Convex to graph (<1s lag)
- Automatic schema management
- Conflict resolution
- Performance monitoring

### Migration: DIY → Premium

```typescript
// Phase 1: Using DIY graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  graph: {
    enabled: true,
    provider: 'neo4j',
    connection: { uri: 'bolt://localhost:7687', ... }
  }
});

// You manage: Neo4j server, sync worker, backups

// Phase 2: Migrate to Cloud Mode
const cortex = new Cortex({
  mode: 'cloud',
  apiKey: process.env.CORTEX_CLOUD_KEY,
  graphPremium: { enabled: true }
});

// Cortex Cloud:
// 1. Provisions managed Neo4j
// 2. Migrates your data from DIY graph
// 3. Sets up automatic sync
// 4. No code changes needed in your app ✅
```

## Troubleshooting

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
  } else {
    const graphProps = graphContext.records[0].get("c").properties;
    console.log("Sync status:", {
      convexStatus: convexContext.status,
      graphStatus: graphProps.status,
      match: convexContext.status === graphProps.status,
    });
  }
}
```

### Slow Graph Queries

**Problem:** Graph queries taking >1s

**Solutions:**

1. **Add indexes:**

```cypher
CREATE INDEX IF NOT EXISTS FOR (a:Agent) ON (a.agentId);
```

2. **Limit depth:**

```cypher
-- ❌ Slow: Unlimited depth
MATCH (a)-[*]-(b) RETURN b

-- ✅ Fast: Limited depth
MATCH (a)-[*1..5]-(b) RETURN b
```

3. **Use DISTINCT:**

```cypher
-- Removes duplicates (faster results)
MATCH (a)-[:SENT_TO*1..3]-(connected)
RETURN DISTINCT connected
```

4. **Profile queries:**

```cypher
PROFILE
MATCH (a:Agent {agentId: 'finance-agent'})-[:SENT_TO*1..3]-(connected)
RETURN connected
-- Shows query plan and performance
```

### Connection Issues

**Problem:** Cannot connect to graph DB

**Solutions:**

```typescript
// Test connection with better error handling
async function testGraphConnection() {
  try {
    const driver = neo4j.driver(
      process.env.GRAPH_DB_URI,
      neo4j.auth.basic(
        process.env.GRAPH_DB_USER,
        process.env.GRAPH_DB_PASSWORD,
      ),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 60000, // 60s
      },
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

## Best Practices

### 1. Convex is Source of Truth

```typescript
// ✅ Always write to Convex first
await cortex.contexts.create({ ... });
await syncContextToGraph(context);  // Then sync

// ❌ Don't write to graph first
await graphAdapter.createNode({ ... });  // Graph could succeed but Convex fail
```

### 2. Handle Sync Failures Gracefully

```typescript
// ✅ App continues working if graph sync fails
try {
  await syncToGraph(entity);
} catch (error) {
  console.error("Graph sync failed (non-critical):", error);
  // App continues, will retry later
}
```

### 3. Rebuild Graph from Convex

```typescript
// Graph should be rebuildable from Convex at any time
async function rebuildGraphFromScratch() {
  console.log("Rebuilding graph from Convex (source of truth)...");

  // Clear graph
  const session = driver.session();
  await session.run("MATCH (n) DETACH DELETE n");
  await session.close();

  // Re-sync all data
  await initialGraphSync();

  console.log("Graph rebuilt successfully");
}
```

### 4. Monitor Sync Lag

```typescript
// Track how far behind graph is
async function getSyncLag() {
  const lastSyncTime = await getLastGraphSyncTimestamp();
  const latestConvexUpdate = await getLatestConvexUpdate();

  const lag = latestConvexUpdate - lastSyncTime;

  if (lag > 60000) {
    // 1 minute
    console.warn(`Graph sync lag: ${lag / 1000}s`);
  }

  return lag;
}
```

## Example: Complete Integration

Here's a full working example:

```typescript
// app.ts
import { Cortex } from "@cortex-platform/sdk";
import neo4j from "neo4j-driver";

// Initialize Cortex
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});

// Initialize Graph DB
const graphDriver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "password"),
);

// Initialize schema
await initializeGraphSchema(graphDriver);

// Start sync worker (background process)
const syncWorker = new CortexGraphSyncWorker(cortex, graphDriver);
syncWorker.start(); // Runs continuously

// Use Cortex normally
await cortex.memory.remember({
  agentId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I work at Acme Corp with Alice",
  agentResponse: "Noted!",
  userId: "user-123",
  userName: "User",
  extractFacts: true, // Facts will be synced to graph
});

// Graph query (after sync completes)
await sleep(1000); // Give sync time

const session = graphDriver.session();
const result = await session.run(`
  MATCH (f:Fact)-[:MENTIONS]->(e:Entity {name: 'Alice'})
  RETURN f.fact as fact
`);
await session.close();

console.log(
  "Facts about Alice:",
  result.records.map((r) => r.get("fact")),
);
// ["User works at Acme Corp with Alice"]
```

## Next Steps

- **[Graph Database Selection](./04-graph-database-selection.md)** - Detailed database comparison
- **[Graph-Lite Traversal](./01-graph-lite-traversal.md)** - Using built-in capabilities
- **[Facts vs Conversations](./03-facts-vs-conversations.md)** - Storage strategies
- **[Context Chains](../02-core-features/04-context-chains.md)** - Hierarchical graph API

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
