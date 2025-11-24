/**
 * Graph DB Demo - NO CLEANUP
 * 
 * Creates test data in both Neo4j and Memgraph and LEAVES IT THERE
 * for manual inspection in the UIs.
 * 
 * Run with: npx tsx tests/graph/demo-no-cleanup.ts
 */

import { CypherGraphAdapter } from "../../src/graph";

async function createDemoData(name: string, config: any) {
  console.log(`\n🔷 Creating demo data in ${name}...`);
  
  const adapter = new CypherGraphAdapter();
  await adapter.connect(config);
  
  // Create User node
  const userId = await adapter.createNode({
    label: "User",
    properties: {
      userId: "demo-user-1",
      name: "Demo User",
      email: "demo@example.com",
      createdAt: Date.now(),
    },
  });
  console.log(`   ✅ Created User node: ${userId}`);
  
  // Create Conversation node
  const convId = await adapter.createNode({
    label: "Conversation",
    properties: {
      conversationId: "demo-conv-1",
      memorySpaceId: "demo-space",
      type: "user-agent",
      messageCount: 2,
      createdAt: Date.now(),
    },
  });
  console.log(`   ✅ Created Conversation node: ${convId}`);
  
  // Create Memory nodes
  const mem1Id = await adapter.createNode({
    label: "Memory",
    properties: {
      memoryId: "mem-demo-1",
      memorySpaceId: "demo-space",
      content: "User asked: What is AI?",
      contentType: "raw",
      sourceType: "conversation",
      importance: 75,
      tags: ["demo", "question"],
      chunkCount: 3,
      estimatedTokens: 25,
      streamCompleteTime: Date.now(),
      createdAt: Date.now(),
    },
  });
  console.log(`   ✅ Created Memory node 1: ${mem1Id}`);
  
  const mem2Id = await adapter.createNode({
    label: "Memory",
    properties: {
      memoryId: "mem-demo-2",
      memorySpaceId: "demo-space",
      content: "AI is artificial intelligence - computer systems that can perform tasks requiring human intelligence.",
      contentType: "raw",
      sourceType: "conversation",
      importance: 85,
      tags: ["demo", "answer", "knowledge"],
      chunkCount: 12,
      estimatedTokens: 95,
      streamCompleteTime: Date.now(),
      createdAt: Date.now(),
    },
  });
  console.log(`   ✅ Created Memory node 2: ${mem2Id}`);
  
  const mem3Id = await adapter.createNode({
    label: "Memory",
    properties: {
      memoryId: "mem-demo-3",
      memorySpaceId: "demo-space",
      content: "Follow-up question: How does machine learning work?",
      contentType: "raw",
      sourceType: "conversation",
      importance: 80,
      tags: ["demo", "question", "ml"],
      chunkCount: 4,
      estimatedTokens: 35,
      streamCompleteTime: Date.now(),
      createdAt: Date.now(),
    },
  });
  console.log(`   ✅ Created Memory node 3: ${mem3Id}`);
  
  // Create relationships (edges)
  const edge1 = await adapter.createEdge({
    from: mem1Id,
    to: convId,
    type: "PART_OF_CONVERSATION",
    properties: { messageIndex: 0, createdAt: Date.now() },
  });
  console.log(`   ✅ Created PART_OF_CONVERSATION edge: ${edge1}`);
  
  const edge2 = await adapter.createEdge({
    from: mem2Id,
    to: convId,
    type: "PART_OF_CONVERSATION",
    properties: { messageIndex: 1, createdAt: Date.now() },
  });
  console.log(`   ✅ Created PART_OF_CONVERSATION edge: ${edge2}`);
  
  const edge3 = await adapter.createEdge({
    from: mem3Id,
    to: convId,
    type: "PART_OF_CONVERSATION",
    properties: { messageIndex: 2, createdAt: Date.now() },
  });
  console.log(`   ✅ Created PART_OF_CONVERSATION edge: ${edge3}`);
  
  const edge4 = await adapter.createEdge({
    from: convId,
    to: userId,
    type: "BELONGS_TO_USER",
    properties: { createdAt: Date.now() },
  });
  console.log(`   ✅ Created BELONGS_TO_USER edge: ${edge4}`);
  
  const edge5 = await adapter.createEdge({
    from: mem2Id,
    to: mem1Id,
    type: "ANSWERS",
    properties: { confidence: 0.95, createdAt: Date.now() },
  });
  console.log(`   ✅ Created ANSWERS edge: ${edge5}`);
  
  const edge6 = await adapter.createEdge({
    from: mem3Id,
    to: mem2Id,
    type: "FOLLOWS_UP",
    properties: { relevance: 0.88, createdAt: Date.now() },
  });
  console.log(`   ✅ Created FOLLOWS_UP edge: ${edge6}`);
  
  // Count to verify
  const nodeCount = await adapter.countNodes();
  const edgeCount = await adapter.countEdges();
  
  console.log(`\n   📊 ${name} Summary:`);
  console.log(`      Nodes: ${nodeCount} (1 User, 1 Conversation, 3 Memory)`);
  console.log(`      Relationships: ${edgeCount}`);
  
  await adapter.disconnect();
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║   Graph DB Demo - Creating Persistent Data                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  // Create in Neo4j
  await createDemoData("Neo4j", {
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "cortex-dev-password",
  });

  // Create in Memgraph
  await createDemoData("Memgraph", {
    uri: "bolt://localhost:7688",
    username: "memgraph",
    password: "cortex-dev-password",
  });

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ DATA CREATED!                            ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  
  console.log("📊 View in Neo4j Browser (http://localhost:7474):");
  console.log("   Login: neo4j / cortex-dev-password");
  console.log("");
  console.log("   Query 1: View all nodes and relationships:");
  console.log("   MATCH (n)-[r]->(m) RETURN n, r, m;");
  console.log("");
  console.log("   Query 2: View just Memory nodes:");
  console.log("   MATCH (n:Memory) RETURN n;");
  console.log("");
  console.log("   Query 3: See conversation flow:");
  console.log("   MATCH path = (m:Memory)-[:PART_OF_CONVERSATION]->(c:Conversation)-[:BELONGS_TO_USER]->(u:User)");
  console.log("   RETURN path;");
  console.log("");
  
  console.log("📊 View in Memgraph Lab (http://localhost:3001):");
  console.log("   (Auto-connects)");
  console.log("");
  console.log("   Query 1: View everything:");
  console.log("   MATCH (n)-[r]->(m) RETURN n, r, m;");
  console.log("");
  console.log("   Query 2: See Q&A relationships:");
  console.log("   MATCH (question:Memory)-[:ANSWERS]-(answer:Memory)");
  console.log("   RETURN question.content as Question, answer.content as Answer;");
  console.log("");
  
  console.log("💡 Key Features to Notice:");
  console.log("   • Memory nodes have streaming metadata (chunkCount, estimatedTokens)");
  console.log("   • Relationships show conversation flow");
  console.log("   • ANSWERS relationship connects questions to answers");
  console.log("   • FOLLOWS_UP shows conversation continuity");
  console.log("");
  
  console.log("🧹 To clear when done:");
  console.log("   npx tsx tests/graph/clear-databases.ts");
  console.log("");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
