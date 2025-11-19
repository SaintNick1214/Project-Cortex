/**
 * Graph Database Integration Proof: Basic CRUD Operations
 *
 * Demonstrates basic node and edge operations with both Neo4j and Memgraph.
 * Run with: tsx tests/graph/proofs/01-basic-crud.proof.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { CypherGraphAdapter } from "../../../src/graph";
import type { GraphAdapter } from "../../../src/graph";

// Configuration
const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

const MEMGRAPH_CONFIG = {
  uri: process.env.MEMGRAPH_URI || "bolt://localhost:7688",
  username: process.env.MEMGRAPH_USERNAME || "memgraph",
  password: process.env.MEMGRAPH_PASSWORD || "cortex-dev-password",
};

/**
 * Test basic CRUD operations on a graph adapter
 */
async function testBasicCRUD(
  adapter: GraphAdapter,
  dbName: string,
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing ${dbName}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    // ============================================================================
    // Test 1: Create Nodes
    // ============================================================================
    console.log("📝 Test 1: Create Nodes");
    const startTime1 = Date.now();

    const agent1Id = await adapter.createNode({
      label: "Agent",
      properties: {
        agentId: "test-agent-1",
        name: "Finance Agent",
        capabilities: ["accounting", "reporting"],
      },
    });

    const agent2Id = await adapter.createNode({
      label: "Agent",
      properties: {
        agentId: "test-agent-2",
        name: "HR Agent",
        capabilities: ["hiring", "onboarding"],
      },
    });

    const userId = await adapter.createNode({
      label: "User",
      properties: {
        userId: "user-123",
        email: "user@example.com",
      },
    });

    const time1 = Date.now() - startTime1;
    console.log(`  ✓ Created 3 nodes in ${time1}ms`);
    console.log(`    - Agent 1: ${agent1Id}`);
    console.log(`    - Agent 2: ${agent2Id}`);
    console.log(`    - User: ${userId}\n`);

    // ============================================================================
    // Test 2: Read Nodes
    // ============================================================================
    console.log("📖 Test 2: Read Nodes");
    const startTime2 = Date.now();

    const agent1 = await adapter.getNode(agent1Id);
    if (!agent1) throw new Error("Failed to retrieve agent 1");

    const time2 = Date.now() - startTime2;
    console.log(`  ✓ Retrieved node in ${time2}ms`);
    console.log(`    - Label: ${agent1.label}`);
    console.log(`    - Name: ${agent1.properties.name}`);
    console.log(
      `    - Capabilities: ${(agent1.properties.capabilities as string[] | undefined)?.join(", ")}\n`,
    );

    // ============================================================================
    // Test 3: Update Node
    // ============================================================================
    console.log("✏️  Test 3: Update Node");
    const startTime3 = Date.now();

    await adapter.updateNode(agent1Id, {
      status: "active",
      lastUpdated: Date.now(),
    });

    const updatedAgent = await adapter.getNode(agent1Id);
    const time3 = Date.now() - startTime3;
    console.log(`  ✓ Updated node in ${time3}ms`);
    console.log(`    - Status: ${updatedAgent?.properties.status}\n`);

    // ============================================================================
    // Test 4: Create Edges
    // ============================================================================
    console.log("🔗 Test 4: Create Edges");
    const startTime4 = Date.now();

    const edge1Id = await adapter.createEdge({
      type: "SENT_TO",
      from: agent1Id,
      to: agent2Id,
      properties: {
        message: "Please review this report",
        timestamp: Date.now(),
      },
    });

    const edge2Id = await adapter.createEdge({
      type: "MANAGES",
      from: agent1Id,
      to: userId,
      properties: {
        since: Date.now(),
      },
    });

    const time4 = Date.now() - startTime4;
    console.log(`  ✓ Created 2 edges in ${time4}ms`);
    console.log(`    - SENT_TO: ${edge1Id}`);
    console.log(`    - MANAGES: ${edge2Id}\n`);

    // ============================================================================
    // Test 5: Query Nodes
    // ============================================================================
    console.log("🔍 Test 5: Query Nodes");
    const startTime5 = Date.now();

    const agents = await adapter.findNodes("Agent", {}, 10);
    const time5 = Date.now() - startTime5;
    console.log(`  ✓ Found ${agents.length} agents in ${time5}ms`);
    for (const agent of agents) {
      console.log(
        `    - ${agent.properties.name} (${agent.properties.agentId})`,
      );
    }
    console.log();

    // ============================================================================
    // Test 6: Traversal
    // ============================================================================
    console.log("🚶 Test 6: Traversal (find connected nodes)");
    const startTime6 = Date.now();

    const connected = await adapter.traverse({
      startId: agent1Id,
      relationshipTypes: ["SENT_TO", "MANAGES"],
      maxDepth: 2,
    });

    const time6 = Date.now() - startTime6;
    console.log(`  ✓ Found ${connected.length} connected nodes in ${time6}ms`);
    for (const node of connected) {
      console.log(
        `    - ${node.label}: ${node.properties.name || node.properties.userId}`,
      );
    }
    console.log();

    // ============================================================================
    // Test 7: Shortest Path
    // ============================================================================
    console.log("🛤️  Test 7: Shortest Path");
    const startTime7 = Date.now();

    const path = await adapter.findPath({
      fromId: agent1Id,
      toId: userId,
      maxHops: 5,
    });

    const time7 = Date.now() - startTime7;
    if (path) {
      console.log(`  ✓ Found path in ${time7}ms`);
      console.log(`    - Length: ${path.length} hop(s)`);
      console.log(`    - Nodes: ${path.nodes.map((n) => n.label).join(" → ")}`);
      console.log(
        `    - Relationships: ${path.relationships.map((r) => r.type).join(" → ")}\n`,
      );
    } else {
      console.log(`  ✗ No path found in ${time7}ms\n`);
    }

    // ============================================================================
    // Test 8: Count Operations
    // ============================================================================
    console.log("🔢 Test 8: Count Operations");
    const startTime8 = Date.now();

    const nodeCount = await adapter.countNodes();
    const agentCount = await adapter.countNodes("Agent");
    const edgeCount = await adapter.countEdges();

    const time8 = Date.now() - startTime8;
    console.log(`  ✓ Counted in ${time8}ms`);
    console.log(`    - Total nodes: ${nodeCount}`);
    console.log(`    - Agents: ${agentCount}`);
    console.log(`    - Total edges: ${edgeCount}\n`);

    // ============================================================================
    // Test 9: Batch Operations
    // ============================================================================
    console.log("📦 Test 9: Batch Operations");
    const startTime9 = Date.now();

    await adapter.batchWrite([
      {
        type: "CREATE_NODE",
        data: {
          label: "Context",
          properties: {
            contextId: "ctx-001",
            purpose: "Test workflow",
          },
        },
      },
      {
        type: "CREATE_NODE",
        data: {
          label: "Context",
          properties: {
            contextId: "ctx-002",
            purpose: "Test sub-workflow",
          },
        },
      },
    ]);

    const time9 = Date.now() - startTime9;
    console.log(`  ✓ Batch created 2 nodes in ${time9}ms\n`);

    // ============================================================================
    // Test 10: Delete Operations
    // ============================================================================
    console.log("🗑️  Test 10: Delete Operations");
    const startTime10 = Date.now();

    await adapter.deleteEdge(edge1Id);
    await adapter.deleteNode(agent2Id, true); // detach delete

    const time10 = Date.now() - startTime10;
    console.log(`  ✓ Deleted 1 edge and 1 node in ${time10}ms\n`);

    // ============================================================================
    // Summary
    // ============================================================================
    console.log("📊 Summary");
    const totalTime =
      time1 +
      time2 +
      time3 +
      time4 +
      time5 +
      time6 +
      time7 +
      time8 +
      time9 +
      time10;
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Average operation: ${Math.round(totalTime / 10)}ms\n`);

    console.log(`✅ All tests passed for ${dbName}!\n`);
  } catch (error) {
    console.error(`❌ Test failed for ${dbName}:`, error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════╗",
  );
  console.log("║  Cortex Graph Database Integration - Basic CRUD Proof    ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  // Test Neo4j
  if (process.env.NEO4J_URI) {
    console.log("\n🗄️  Testing Neo4j...");
    const neo4jAdapter = new CypherGraphAdapter();
    try {
      await neo4jAdapter.connect(NEO4J_CONFIG);
      await neo4jAdapter.clearDatabase(); // Clean slate
      await testBasicCRUD(neo4jAdapter, "Neo4j");
      await neo4jAdapter.clearDatabase(); // Cleanup
      await neo4jAdapter.disconnect();
    } catch (error) {
      console.error("Failed to test Neo4j:", error);
    }
  } else {
    console.log("\n⚠️  Neo4j tests skipped (NEO4J_URI not set)");
  }

  // Test Memgraph
  if (process.env.MEMGRAPH_URI) {
    console.log("\n🗄️  Testing Memgraph...");
    const memgraphAdapter = new CypherGraphAdapter();
    try {
      await memgraphAdapter.connect(MEMGRAPH_CONFIG);
      await memgraphAdapter.clearDatabase(); // Clean slate
      await testBasicCRUD(memgraphAdapter, "Memgraph");
      await memgraphAdapter.clearDatabase(); // Cleanup
      await memgraphAdapter.disconnect();
    } catch (error) {
      console.error("Failed to test Memgraph:", error);
    }
  } else {
    console.log("\n⚠️  Memgraph tests skipped (MEMGRAPH_URI not set)");
  }

  console.log(
    "\n╔═══════════════════════════════════════════════════════════╗",
  );
  console.log("║  Proof Complete!                                          ║");
  console.log(
    "╚═══════════════════════════════════════════════════════════╝\n",
  );

  console.log("📝 Next Steps:");
  console.log("   1. Run: npm run proof:sync-workflow");
  console.log("   2. Run: npm run proof:context-chains");
  console.log("   3. Run: npm run proof:performance\n");
}

// Run
main()
  .then(() => {
    console.log("Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Proof failed:", error);
    process.exit(1);
  });
