/**
 * Clear Graph Databases Script
 *
 * Clears all data from both Neo4j and Memgraph databases
 * Run with: npx tsx tests/graph/clear-databases.ts
 */

import { CypherGraphAdapter } from "../../src/graph";

async function main() {
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║          Clearing Graph Databases                            ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n",
  );

  // Clear Neo4j
  console.log("🔷 Clearing Neo4j...");
  const neo4jAdapter = new CypherGraphAdapter();
  await neo4jAdapter.connect({
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "cortex-dev-password",
  });

  const neo4jBefore = await neo4jAdapter.countNodes();
  console.log(`   Before: ${neo4jBefore} nodes`);

  await neo4jAdapter.clearDatabase();

  const neo4jAfter = await neo4jAdapter.countNodes();
  console.log(`   After: ${neo4jAfter} nodes`);
  console.log(`   ✅ Neo4j cleared\n`);

  await neo4jAdapter.disconnect();

  // Clear Memgraph
  console.log("🔶 Clearing Memgraph...");
  const memgraphAdapter = new CypherGraphAdapter();
  await memgraphAdapter.connect({
    uri: "bolt://localhost:7688",
    username: "memgraph",
    password: "cortex-dev-password",
  });

  const memgraphBefore = await memgraphAdapter.countNodes();
  console.log(`   Before: ${memgraphBefore} nodes`);

  await memgraphAdapter.clearDatabase();

  const memgraphAfter = await memgraphAdapter.countNodes();
  console.log(`   After: ${memgraphAfter} nodes`);
  console.log(`   ✅ Memgraph cleared\n`);

  await memgraphAdapter.disconnect();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Both databases cleared successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
