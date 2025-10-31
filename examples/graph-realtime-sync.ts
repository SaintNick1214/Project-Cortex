/**
 * Graph Real-Time Sync Example
 *
 * Demonstrates how to use the GraphSyncWorker for automatic real-time
 * synchronization to graph database.
 */

import { Cortex } from "../src";
import { CypherGraphAdapter, initializeGraphSchema } from "../src/graph";

async function main() {
  // ============================================================================
  // Setup Graph Database
  // ============================================================================
  console.log("🔧 Setting up graph database...");

  const graphAdapter = new CypherGraphAdapter();
  await graphAdapter.connect({
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    username: process.env.NEO4J_USERNAME || "neo4j",
    password: process.env.NEO4J_PASSWORD || "password",
  });

  await initializeGraphSchema(graphAdapter);
  console.log("✓ Graph database ready\n");

  // ============================================================================
  // Initialize Cortex with Auto-Sync Enabled
  // ============================================================================
  console.log("🚀 Initializing Cortex with auto-sync...");

  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL!,
    graph: {
      adapter: graphAdapter,
      orphanCleanup: true,
      autoSync: true, // ← Auto-start sync worker!
      syncWorkerOptions: {
        batchSize: 100,
        retryAttempts: 3,
        verbose: true, // Enable logging
      },
    },
  });

  console.log("✓ Cortex initialized with real-time graph sync\n");

  // ============================================================================
  // Use Cortex Normally - Sync Happens Automatically!
  // ============================================================================
  console.log("📝 Creating data...");

  // Register memory space
  const memorySpace = await cortex.memorySpaces.register({
    memorySpaceId: "demo-agent",
    name: "Demo Agent",
    type: "personal",
  });

  // Create conversation
  const conversation = await cortex.conversations.create({
    memorySpaceId: "demo-agent",
    type: "user-agent",
    participants: {
      userId: "user-123",
      participantId: "demo-assistant",
    },
  });

  // Use convenience API - auto-syncs!
  await cortex.memory.remember({
    memorySpaceId: "demo-agent",
    conversationId: conversation.conversationId,
    userMessage: "I work at Acme Corp as a senior engineer using TypeScript",
    agentResponse: "Great! I'll remember that you're at Acme Corp.",
    userId: "user-123",
    userName: "User",
    importance: 90,
    tags: ["employment", "technology"],
  });

  console.log("✓ Data created");
  console.log(
    "✓ Sync worker is processing in background (check graph in a moment)\n",
  );

  // Give sync worker time to process
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // ============================================================================
  // Verify Sync Happened
  // ============================================================================
  console.log("🔍 Verifying graph sync...");

  const nodeCount = await graphAdapter.countNodes();
  const edgeCount = await graphAdapter.countEdges();

  console.log(`✓ Graph has ${nodeCount} nodes and ${edgeCount} relationships`);

  // Check sync worker metrics
  const worker = cortex.getGraphSyncWorker();
  if (worker) {
    const metrics = worker.getMetrics();
    console.log("\n📊 Sync Worker Metrics:");
    console.log(`  - Total processed: ${metrics.totalProcessed}`);
    console.log(`  - Successful: ${metrics.successCount}`);
    console.log(`  - Failed: ${metrics.failureCount}`);
    console.log(`  - Avg sync time: ${metrics.avgSyncTimeMs}ms`);
    console.log(`  - Queue size: ${metrics.queueSize}`);
  }

  // ============================================================================
  // Query Enriched Context via Graph
  // ============================================================================
  console.log("\n🔍 Querying enriched context via graph...");

  const entities = await graphAdapter.query(`
    MATCH (e:Entity)
    RETURN e.name as name
    ORDER BY e.name
  `);

  console.log(`\n✓ Found ${entities.count} entities in knowledge graph:`);
  for (const record of entities.records) {
    console.log(`  - ${record.name}`);
  }

  // Find connections
  const connections = await graphAdapter.query(`
    MATCH (e1:Entity)-[r]-(e2:Entity)
    RETURN e1.name as from, type(r) as relationship, e2.name as to
    LIMIT 5
  `);

  console.log(`\n✓ Entity relationships:`);
  for (const record of connections.records) {
    console.log(`  - ${record.from} → ${record.relationship} → ${record.to}`);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log("\n🧹 Cleaning up...");

  cortex.close(); // ← Stops sync worker automatically!
  await graphAdapter.disconnect();

  console.log("✓ Done!\n");
  console.log("🎉 Real-time graph sync demonstrated successfully!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

