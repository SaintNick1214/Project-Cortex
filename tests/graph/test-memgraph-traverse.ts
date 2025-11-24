/**
 * Debug Memgraph traverse() issue
 */

import { CypherGraphAdapter } from "../../src/graph";

async function main() {
  const adapter = new CypherGraphAdapter();
  await adapter.connect({
    uri: "bolt://localhost:7688",
    username: "memgraph",
    password: "cortex-dev-password",
  });

  console.log("🔶 Testing Memgraph traverse patterns...\n");

  // Clear and create test data
  await adapter.clearDatabase();

  const node1 = await adapter.createNode({
    label: "TestNode",
    properties: { id: 1, name: "Node 1" },
  });
  console.log("Created node 1:", node1);

  const node2 = await adapter.createNode({
    label: "TestNode",
    properties: { id: 2, name: "Node 2" },
  });
  console.log("Created node 2:", node2);

  const node3 = await adapter.createNode({
    label: "TestNode",
    properties: { id: 3, name: "Node 3" },
  });
  console.log("Created node 3:", node3);

  // Create relationships
  await adapter.createEdge({
    from: node1,
    to: node2,
    type: "CONNECTS",
    properties: {},
  });
  console.log("Created edge 1->2");

  await adapter.createEdge({
    from: node2,
    to: node3,
    type: "CONNECTS",
    properties: {},
  });
  console.log("Created edge 2->3\n");

  // Test 1: Try the traverse() method
  console.log("Test 1: Using traverse() method");
  try {
    const result = await adapter.traverse({
      startId: node1,
      maxDepth: 2,
      direction: "OUTGOING",
    });
    console.log(`✅ traverse() returned ${result.length} nodes`);
    result.forEach((n, i) =>
      console.log(`   Node ${i + 1}:`, n.properties.name),
    );
  } catch (error) {
    console.error("❌ traverse() failed:", (error as Error).message);
  }

  // Test 2: Try direct query with variable length pattern
  console.log("\nTest 2: Direct query with variable length pattern");
  try {
    const query = `
      MATCH (start)
      WHERE id(start) = $startId
      MATCH (start)-[*1..2]->(connected)
      RETURN DISTINCT id(connected) as id, connected, labels(connected) as labels
    `;

    const result = await adapter.query(query, { startId: parseInt(node1) });
    console.log(`✅ Direct query returned ${result.count} records`);
    result.records.forEach((r, i) => console.log(`   Record ${i + 1}:`, r));
  } catch (error) {
    console.error("❌ Direct query failed:", (error as Error).message);
  }

  // Test 3: Simplified pattern
  console.log("\nTest 3: Simplified single MATCH");
  try {
    const query = `
      MATCH path = (start)-[*1..2]->(connected)
      WHERE id(start) = $startId
      RETURN DISTINCT id(connected) as id, labels(connected) as labels
    `;

    const result = await adapter.query(query, { startId: parseInt(node1) });
    console.log(`✅ Simplified query returned ${result.count} records`);
  } catch (error) {
    console.error("❌ Simplified query failed:", (error as Error).message);
  }

  // Test 4: Even simpler - no variable length
  console.log("\nTest 4: Simple one-hop traversal");
  try {
    const query = `
      MATCH (start)-[:CONNECTS]->(connected)
      WHERE id(start) = $startId
      RETURN id(connected) as id, connected.name as name
    `;

    const result = await adapter.query(query, { startId: parseInt(node1) });
    console.log(`✅ One-hop query returned ${result.count} records`);
    result.records.forEach((r) => console.log(`   Found:`, r));
  } catch (error) {
    console.error("❌ One-hop query failed:", (error as Error).message);
  }

  await adapter.disconnect();
}

main().catch(console.error);
