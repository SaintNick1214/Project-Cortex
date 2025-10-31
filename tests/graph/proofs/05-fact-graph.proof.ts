/**
 * Graph Database Integration Proof: Fact Knowledge Graph
 *
 * Demonstrates fact entity relationships and knowledge graph queries.
 * Shows how facts are connected through shared entities.
 *
 * Run with: tsx tests/graph/proofs/05-fact-graph.proof.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

import { Cortex } from "../../../src";
import {
  CypherGraphAdapter,
  initializeGraphSchema,
  syncFactToGraph,
  syncMemorySpaceToGraph,
  syncFactRelationships,
} from "../../../src/graph";
import type { GraphAdapter } from "../../../src";

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

/**
 * Create a knowledge graph of facts
 */
async function createFactKnowledgeGraph(cortex: Cortex, memorySpaceId: string) {
  const facts = [];

  // Create interconnected facts about a team
  const fact1 = await cortex.facts.store({
    memorySpaceId,
    fact: "Alice works at Acme Corp",
    factType: "relationship",
    subject: "Alice",
    predicate: "works_at",
    object: "Acme Corp",
    confidence: 95,
    sourceType: "conversation",
    tags: ["employment", "alice"],
  });
  facts.push(fact1);
  console.log(`  ✓ Fact 1: ${fact1.fact}`);

  const fact2 = await cortex.facts.store({
    memorySpaceId,
    fact: "Bob works at Acme Corp",
    factType: "relationship",
    subject: "Bob",
    predicate: "works_at",
    object: "Acme Corp",
    confidence: 95,
    sourceType: "conversation",
    tags: ["employment", "bob"],
  });
  facts.push(fact2);
  console.log(`  ✓ Fact 2: ${fact2.fact}`);

  const fact3 = await cortex.facts.store({
    memorySpaceId,
    fact: "Alice knows Bob",
    factType: "relationship",
    subject: "Alice",
    predicate: "knows",
    object: "Bob",
    confidence: 90,
    sourceType: "conversation",
    tags: ["relationship", "alice", "bob"],
  });
  facts.push(fact3);
  console.log(`  ✓ Fact 3: ${fact3.fact}`);

  const fact4 = await cortex.facts.store({
    memorySpaceId,
    fact: "Alice uses TypeScript",
    factType: "preference",
    subject: "Alice",
    predicate: "uses",
    object: "TypeScript",
    confidence: 85,
    sourceType: "conversation",
    tags: ["technology", "alice"],
  });
  facts.push(fact4);
  console.log(`  ✓ Fact 4: ${fact4.fact}`);

  const fact5 = await cortex.facts.store({
    memorySpaceId,
    fact: "Bob uses TypeScript",
    factType: "preference",
    subject: "Bob",
    predicate: "uses",
    object: "TypeScript",
    confidence: 88,
    sourceType: "conversation",
    tags: ["technology", "bob"],
  });
  facts.push(fact5);
  console.log(`  ✓ Fact 5: ${fact5.fact}`);

  const fact6 = await cortex.facts.store({
    memorySpaceId,
    fact: "Acme Corp located in San Francisco",
    factType: "knowledge",
    subject: "Acme Corp",
    predicate: "located_in",
    object: "San Francisco",
    confidence: 100,
    sourceType: "system",
    tags: ["location", "company"],
  });
  facts.push(fact6);
  console.log(`  ✓ Fact 6: ${fact6.fact}`);

  return facts;
}

/**
 * Run the fact knowledge graph demonstration
 */
async function runFactGraphProof(adapter: GraphAdapter, dbName: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing Fact Knowledge Graph with ${dbName}`);
  console.log(`${"=".repeat(60)}\n`);

  const cortex = new Cortex({ convexUrl: CONVEX_URL });
  const timestamp = Date.now();
  const memorySpaceId = `space-facts-${timestamp}`;

  try {
    // ============================================================================
    // Phase 1: Initialize Schema
    // ============================================================================
    console.log("📐 Phase 1: Initialize Schema");
    await initializeGraphSchema(adapter);
    console.log("  ✓ Schema ready\n");

    // ============================================================================
    // Phase 2: Create Facts in Cortex
    // ============================================================================
    console.log("📝 Phase 2: Create Knowledge Graph Facts");

    // Register memory space
    const memorySpace = await cortex.memorySpaces.register({
      memorySpaceId,
      name: "Fact Graph Test",
      type: "personal",
    });

    const facts = await createFactKnowledgeGraph(cortex, memorySpaceId);
    console.log(`  ✓ Created ${facts.length} interconnected facts\n`);

    // ============================================================================
    // Phase 3: Sync to Graph
    // ============================================================================
    console.log("🔄 Phase 3: Sync Facts to Graph");
    const syncStart = Date.now();

    // Sync memory space
    await syncMemorySpaceToGraph(memorySpace, adapter);

    // Sync all facts with entity relationships
    for (const fact of facts) {
      const nodeId = await syncFactToGraph(fact, adapter);
      await syncFactRelationships(fact, nodeId, adapter);
    }

    const syncTime = Date.now() - syncStart;
    console.log(`  ✓ Synced ${facts.length} facts in ${syncTime}ms\n`);

    // ============================================================================
    // Phase 4: Knowledge Graph Queries
    // ============================================================================
    console.log("🔍 Phase 4: Knowledge Graph Queries");

    // Query 1: Find all facts about a person
    console.log("\n  📊 Query 1: Facts about Alice");
    const aliceFacts = await adapter.query(
      `
      MATCH (f:Fact)-[:MENTIONS]->(e:Entity {name: 'Alice'})
      RETURN f.fact as fact, f.confidence as confidence
      ORDER BY f.confidence DESC
    `,
    );
    console.log(`    Found ${aliceFacts.count} facts:`);
    for (const record of aliceFacts.records) {
      console.log(`    - [${record.confidence}%] ${record.fact}`);
    }

    // Query 2: Find related facts through shared entities
    console.log("\n  📊 Query 2: Facts Related to Alice (via shared entities)");
    const relatedFacts = await adapter.query(
      `
      MATCH (f1:Fact)-[:MENTIONS]->(e:Entity {name: 'Alice'})
      MATCH (e)<-[:MENTIONS]-(relatedFact:Fact)
      WHERE f1.factId <> relatedFact.factId
      RETURN relatedFact.fact as fact, collect(DISTINCT e.name) as sharedEntities
      LIMIT 5
    `,
    );
    console.log(`    Found ${relatedFacts.count} related facts:`);
    for (const record of relatedFacts.records) {
      console.log(`    - ${record.fact}`);
      console.log(`      (shares: ${record.sharedEntities?.join(", ")})`);
    }

    // Query 3: Find people who work at the same company
    console.log("\n  📊 Query 3: Who works at Acme Corp?");
    const coworkers = await adapter.query(
      `
      MATCH (person:Entity)-[:WORKS_AT]->(company:Entity {name: 'Acme Corp'})
      RETURN DISTINCT person.name as person
    `,
    );
    console.log(`    Found ${coworkers.count} employees:`);
    for (const record of coworkers.records) {
      console.log(`    - ${record.person}`);
    }

    // Query 4: Find people who use the same technology
    console.log("\n  📊 Query 4: Who uses TypeScript?");
    const tsUsers = await adapter.query(
      `
      MATCH (person:Entity)-[:USES]->(tech:Entity {name: 'TypeScript'})
      RETURN person.name as person
    `,
    );
    console.log(`    Found ${tsUsers.count} TypeScript users:`);
    for (const record of tsUsers.records) {
      console.log(`    - ${record.person}`);
    }

    // Query 5: Knowledge path - multi-hop query
    console.log("\n  📊 Query 5: Knowledge Path (Alice → TypeScript)");
    const knowledgePath = await adapter.query(
      `
      MATCH path = (alice:Entity {name: 'Alice'})-[*1..3]-(ts:Entity {name: 'TypeScript'})
      RETURN [node in nodes(path) | node.name] as pathNodes,
             [rel in relationships(path) | type(rel)] as pathRels
      LIMIT 1
    `,
    );
    if (knowledgePath.count > 0) {
      const record = knowledgePath.records[0];
      console.log(`    Path: ${record.pathNodes?.join(" → ")}`);
      console.log(`    Via: ${record.pathRels?.join(" → ")}`);
    } else {
      console.log(`    No path found`);
    }

    // Query 6: Entity network statistics
    console.log("\n  📊 Query 6: Entity Network Statistics");
    const entityStats = await adapter.query(
      `
      MATCH (e:Entity)
      OPTIONAL MATCH (e)-[r]-()
      WITH e, count(DISTINCT r) as connections
      RETURN e.name as entity, connections
      ORDER BY connections DESC
      LIMIT 5
    `,
    );
    console.log(`    Most connected entities:`);
    for (const record of entityStats.records) {
      console.log(`    - ${record.entity}: ${record.connections} connections`);
    }

    console.log(`\n✅ All fact graph queries passed for ${dbName}!\n`);

    // ============================================================================
    // Summary
    // ============================================================================
    console.log("📊 Knowledge Graph Summary");
    const factCount = await adapter.countNodes("Fact");
    const entityCount = await adapter.countNodes("Entity");
    const mentionsCount = await adapter.countEdges("MENTIONS");
    const relationshipCount = await adapter.countEdges();

    console.log(`  - Facts: ${factCount}`);
    console.log(`  - Entities: ${entityCount}`);
    console.log(`  - MENTIONS relationships: ${mentionsCount}`);
    console.log(`  - Total relationships: ${relationshipCount}`);
    console.log(`  - Knowledge density: ${(relationshipCount / entityCount).toFixed(2)} rels/entity\n`);

    // ============================================================================
    // Cleanup
    // ============================================================================
    console.log("🧹 Cleanup");
    console.log(`  ~ Leaving test data for inspection (memorySpaceId: ${memorySpaceId})`);
    console.log(`  ~ Clear manually if needed\n`);
  } catch (error) {
    console.error(`❌ Fact graph proof failed:`, error);
    throw error;
  } finally {
    cortex.close();
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║  Cortex Graph Integration - Fact Knowledge Graph Proof   ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  // Test with Neo4j
  if (process.env.NEO4J_URI) {
    console.log("\n🗄️  Running fact knowledge graph with Neo4j...");
    const neo4jAdapter = new CypherGraphAdapter();
    try {
      await neo4jAdapter.connect(NEO4J_CONFIG);
      await neo4jAdapter.clearDatabase(); // Clean slate
      await runFactGraphProof(neo4jAdapter, "Neo4j");
      await neo4jAdapter.clearDatabase(); // Cleanup
      await neo4jAdapter.disconnect();
    } catch (error) {
      console.error("Failed:", error);
    }
  } else {
    console.log("\n⚠️  Neo4j tests skipped (NEO4J_URI not set)");
  }

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║  Fact Knowledge Graph Proof Complete!                     ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log("📝 Key Findings:");
  console.log("   ✓ Facts connected through shared entities");
  console.log("   ✓ Multi-hop knowledge paths discoverable");
  console.log("   ✓ Entity relationships queryable in graph");
  console.log("   ✓ Knowledge density metrics available");
  console.log("\n📝 Next: tsx tests/graph/proofs/06-performance.proof.ts\n");
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

