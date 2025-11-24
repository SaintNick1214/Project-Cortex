/**
 * Debug traverse() implementation issue in Memgraph
 */

import { CypherGraphAdapter } from "../../src/graph";

async function main() {
  const adapter = new CypherGraphAdapter();
  await adapter.connect({
    uri: "bolt://localhost:7688",
    username: "memgraph",
    password: "cortex-dev-password",
  });

  console.log("Debugging Memgraph traverse()...\n");

  await adapter.clearDatabase();

  const n1 = await adapter.createNode({
    label: "Test",
    properties: { name: "A" },
  });
  const n2 = await adapter.createNode({
    label: "Test",
    properties: { name: "B" },
  });
  const n3 = await adapter.createNode({
    label: "Test",
    properties: { name: "C" },
  });

  await adapter.createEdge({ from: n1, to: n2, type: "LINK", properties: {} });
  await adapter.createEdge({ from: n2, to: n3, type: "LINK", properties: {} });

  console.log(`Created nodes: ${n1}, ${n2}, ${n3}\n`);

  // Test the actual query that traverse() generates
  console.log("Generated query (what traverse() creates):");
  const generatedQuery = `
    MATCH (start)
    WHERE id(start) = $startId
    MATCH path = (start)-[*1..2]->(connected)
    RETURN DISTINCT id(connected) as id, connected, labels(connected) as labels
  `;
  console.log(generatedQuery);

  try {
    const result = await adapter.query(generatedQuery, {
      startId: parseInt(n1),
    });
    console.log(`\nResult: ${result.count} records`);
    console.log("Records:", JSON.stringify(result.records, null, 2));
  } catch (error) {
    console.error("Error:", (error as Error).message);
  }

  // Try without path variable
  console.log("\n\nTrying without 'path =' variable:");
  const simpler = `
    MATCH (start)
    WHERE id(start) = $startId
    MATCH (start)-[*1..2]->(connected)
    RETURN DISTINCT id(connected) as id, connected, labels(connected) as labels
  `;

  try {
    const result = await adapter.query(simpler, { startId: parseInt(n1) });
    console.log(`Result: ${result.count} records`);
    console.log("Records:", JSON.stringify(result.records, null, 2));
  } catch (error) {
    console.error("Error:", (error as Error).message);
  }

  await adapter.disconnect();
}

main().catch(console.error);
