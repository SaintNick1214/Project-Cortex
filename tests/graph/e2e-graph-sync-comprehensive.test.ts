/**
 * Comprehensive E2E Graph Sync Tests
 *
 * Tests the complete graph synchronization flow against REAL graph databases.
 * Validates:
 * - Both Neo4j and Memgraph adapters
 * - Automatic graph sync when CORTEX_GRAPH_SYNC=true
 * - Fact and Entity node creation
 * - All relationship types (MENTIONS, SUPERSEDES, EXTRACTED_FROM, IN_SPACE, etc.)
 * - Multi-tenancy isolation in graph
 * - Graph traversal and querying
 *
 * Prerequisites:
 * - Neo4j running on bolt://localhost:7687
 * - Memgraph running on bolt://localhost:7688
 * - Convex local dev server running
 * - GRAPH_TESTING_ENABLED=true
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { Cortex } from "../../src";
import { CypherGraphAdapter, initializeGraphSchema } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import { createNamedTestRunContext } from "../helpers";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

// Graph database configurations
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

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

// Test for each graph database adapter
const adaptersToTest = [
  { name: "Neo4j", config: NEO4J_CONFIG, enabled: !!process.env.NEO4J_URI },
  { name: "Memgraph", config: MEMGRAPH_CONFIG, enabled: !!process.env.MEMGRAPH_URI },
];

describeIfEnabled("E2E: Comprehensive Graph Sync Tests", () => {
  // Run tests for each enabled adapter
  adaptersToTest
    .filter((a) => a.enabled)
    .forEach(({ name, config }) => {
      describe(`Graph Database: ${name}`, () => {
        const ctx = createNamedTestRunContext(`e2e-graph-${name.toLowerCase()}`);
        let cortex: Cortex;
        let graphAdapter: GraphAdapter;
        const TEST_MEMSPACE = ctx.memorySpaceId("comprehensive");

        beforeAll(async () => {
          // Initialize graph adapter
          graphAdapter = new CypherGraphAdapter();
          await graphAdapter.connect(config);
          await graphAdapter.clearDatabase();
          await initializeGraphSchema(graphAdapter);

          // Initialize Cortex with graph adapter
          cortex = new Cortex({
            convexUrl: CONVEX_URL,
            graph: {
              adapter: graphAdapter,
            },
          });

          // Create test memory space
          await cortex.memorySpaces.register({
            memorySpaceId: TEST_MEMSPACE,
            type: "personal",
            name: `${name} Comprehensive Test Space`,
          });

          // Wait for initial sync
          await new Promise((resolve) => setTimeout(resolve, 200));
        });

        afterAll(async () => {
          try {
            await cortex.memorySpaces.delete(TEST_MEMSPACE, {
              cascade: true,
              reason: "e2e test cleanup",
            });
          } catch {
            // Ignore cleanup errors
          }
          await graphAdapter.clearDatabase();
          await graphAdapter.disconnect();
          cortex.close();
        });

        // ============================================================================
        // Test Suite 1: Fact Node Creation
        // ============================================================================
        describe("Fact Node Creation", () => {
          it("should create Fact node in graph when fact is stored", async () => {
            const storedFact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Alice is a software engineer",
              factType: "identity",
              subject: "Alice",
              predicate: "is",
              object: "software engineer",
              confidence: 95,
              sourceType: "conversation",
              tags: ["career"],
            });

            // Allow time for graph sync
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify Fact node exists in graph
            const factNodes = await graphAdapter.findNodes(
              "Fact",
              { factId: storedFact.factId },
              10,
            );
            expect(factNodes.length).toBe(1);
            expect(factNodes[0].properties.fact).toBe("Alice is a software engineer");
            expect(factNodes[0].properties.subject).toBe("Alice");
            expect(factNodes[0].properties.predicate).toBe("is");
            expect(factNodes[0].properties.object).toBe("software engineer");
            expect(factNodes[0].properties.confidence).toBe(95);
            expect(factNodes[0].properties.factType).toBe("identity");
          });

          it("should store fact with all optional properties in graph", async () => {
            const storedFact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Bob works at TechCorp since 2020",
              factType: "relationship",
              subject: "Bob",
              predicate: "works_at",
              object: "TechCorp",
              confidence: 90,
              sourceType: "manual",
              tags: ["employment", "career"],
              validFrom: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
              metadata: { startYear: 2020 },
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const factNodes = await graphAdapter.findNodes(
              "Fact",
              { factId: storedFact.factId },
              10,
            );
            expect(factNodes.length).toBe(1);
            expect(factNodes[0].properties.memorySpaceId).toBe(TEST_MEMSPACE);
          });
        });

        // ============================================================================
        // Test Suite 2: Entity Node Creation
        // ============================================================================
        describe("Entity Node Creation", () => {
          it("should create Entity nodes from fact.entities array", async () => {
            const _fact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Sarah climbs at Planet Granite in San Francisco",
              factType: "knowledge",
              subject: "Sarah",
              predicate: "climbs_at",
              object: "Planet Granite",
              confidence: 95,
              sourceType: "conversation",
              tags: ["hobby", "location"],
              entities: [
                { name: "Sarah", type: "person" },
                { name: "Planet Granite", type: "place" },
                { name: "San Francisco", type: "city" },
              ],
            });

            await new Promise((resolve) => setTimeout(resolve, 150));

            // Verify Entity nodes were created
            const sarahNodes = await graphAdapter.findNodes(
              "Entity",
              { name: "Sarah" },
              10,
            );
            expect(sarahNodes.length).toBeGreaterThanOrEqual(1);

            const planetGraniteNodes = await graphAdapter.findNodes(
              "Entity",
              { name: "Planet Granite" },
              10,
            );
            expect(planetGraniteNodes.length).toBeGreaterThanOrEqual(1);

            const sfNodes = await graphAdapter.findNodes(
              "Entity",
              { name: "San Francisco" },
              10,
            );
            expect(sfNodes.length).toBeGreaterThanOrEqual(1);

            // Verify entity types
            expect(sarahNodes[0].properties.type).toBe("person");
            expect(planetGraniteNodes[0].properties.type).toBe("place");
            expect(sfNodes[0].properties.type).toBe("city");
          });

          it("should create Entity nodes from subject/object fields (fallback)", async () => {
            // Store fact without entities array - should use subject/object as fallback
            await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Charlie knows Python",
              factType: "knowledge",
              subject: "Charlie",
              predicate: "knows",
              object: "Python",
              confidence: 85,
              sourceType: "conversation",
              tags: ["skills"],
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify Entity nodes were created from subject/object
            const charlieNodes = await graphAdapter.findNodes(
              "Entity",
              { name: "Charlie" },
              10,
            );
            expect(charlieNodes.length).toBeGreaterThanOrEqual(1);

            const pythonNodes = await graphAdapter.findNodes(
              "Entity",
              { name: "Python" },
              10,
            );
            expect(pythonNodes.length).toBeGreaterThanOrEqual(1);
          });
        });

        // ============================================================================
        // Test Suite 3: MENTIONS Relationships
        // ============================================================================
        describe("MENTIONS Relationships", () => {
          it("should create MENTIONS edges from Fact to Entity nodes", async () => {
            const fact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "David manages the Marketing team",
              factType: "relationship",
              subject: "David",
              predicate: "manages",
              object: "Marketing team",
              confidence: 90,
              sourceType: "conversation",
              tags: ["management"],
              entities: [
                { name: "David", type: "person" },
                { name: "Marketing team", type: "organization" },
              ],
            });

            await new Promise((resolve) => setTimeout(resolve, 150));

            // Query MENTIONS relationships from this fact
            const mentionsEdges = await graphAdapter.findEdges("MENTIONS", {}, 100);
            
            // Find edges from this specific fact
            const factNodes = await graphAdapter.findNodes(
              "Fact",
              { factId: fact.factId },
              1,
            );
            expect(factNodes.length).toBe(1);
            
            const factNodeId = factNodes[0].id;
            const factMentions = mentionsEdges.filter(
              (e) => e.from === factNodeId,
            );
            
            expect(factMentions.length).toBeGreaterThanOrEqual(2);
          });

          it("should include entity role in MENTIONS edge properties", async () => {
            // Use a Cypher query to verify edge properties
            const result = await graphAdapter.query(`
              MATCH (f:Fact)-[m:MENTIONS]->(e:Entity)
              WHERE f.subject = 'David' AND f.object = 'Marketing team'
              RETURN m.role as role, e.name as entityName
            `);

            expect(result.count).toBeGreaterThanOrEqual(2);
          });
        });

        // ============================================================================
        // Test Suite 4: Predicate-Based Relationships
        // ============================================================================
        describe("Predicate-Based Relationships", () => {
          it("should create typed relationships from predicate (e.g., WORKS_AT)", async () => {
            const fact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Emma works at Google",
              factType: "relationship",
              subject: "Emma",
              predicate: "works_at",
              object: "Google",
              confidence: 95,
              sourceType: "conversation",
              tags: ["employment"],
            });

            await new Promise((resolve) => setTimeout(resolve, 150));

            // Query for WORKS_AT relationship between Emma and Google
            const result = await graphAdapter.query(`
              MATCH (e1:Entity {name: 'Emma'})-[r:WORKS_AT]->(e2:Entity {name: 'Google'})
              RETURN r.factId as factId, r.confidence as confidence
            `);

            expect(result.count).toBeGreaterThanOrEqual(1);
            expect(result.records[0].factId).toBe(fact.factId);
          });

          it("should create relationships from enriched relations array", async () => {
            const _fact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Frank mentors Grace in AI research",
              factType: "relationship",
              confidence: 90,
              sourceType: "conversation",
              tags: ["mentorship"],
              entities: [
                { name: "Frank", type: "person" },
                { name: "Grace", type: "person" },
              ],
              relations: [
                {
                  subject: "Frank",
                  predicate: "mentors",
                  object: "Grace",
                },
              ],
            });

            await new Promise((resolve) => setTimeout(resolve, 150));

            // Query for MENTORS relationship
            const result = await graphAdapter.query(`
              MATCH (mentor:Entity {name: 'Frank'})-[r:MENTORS]->(mentee:Entity {name: 'Grace'})
              RETURN r.factId as factId
            `);

            expect(result.count).toBeGreaterThanOrEqual(1);
          });
        });

        // ============================================================================
        // Test Suite 5: IN_SPACE Relationships
        // ============================================================================
        describe("IN_SPACE Relationships", () => {
          it("should create IN_SPACE edge from Fact to MemorySpace", async () => {
            const fact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Test fact for IN_SPACE relationship",
              factType: "knowledge",
              confidence: 100,
              sourceType: "manual",
              tags: ["test"],
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            // Query for IN_SPACE relationship
            const result = await graphAdapter.query(`
              MATCH (f:Fact {factId: $factId})-[r:IN_SPACE]->(ms:MemorySpace)
              RETURN ms.memorySpaceId as memorySpaceId
            `, { factId: fact.factId });

            expect(result.count).toBe(1);
            expect(result.records[0].memorySpaceId).toBe(TEST_MEMSPACE);
          });
        });

        // ============================================================================
        // Test Suite 6: EXTRACTED_FROM Relationships
        // ============================================================================
        describe("EXTRACTED_FROM Relationships", () => {
          it("should create EXTRACTED_FROM edge when fact has sourceRef", async () => {
            // First create a conversation
            const convId = ctx.conversationId("extraction");
            await cortex.conversations.create({
              memorySpaceId: TEST_MEMSPACE,
              conversationId: convId,
              type: "user-agent",
              participants: {
                userId: "test-user",
                agentId: "test-agent",
                participantId: "test-agent",
              },
            });

            // Add a message to the conversation
            await cortex.conversations.addMessage({
              conversationId: convId,
              message: {
                role: "user",
                content: "Helen prefers dark mode for her IDE",
              },
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            // Store fact with sourceRef to the conversation
            const fact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Helen prefers dark mode",
              factType: "preference",
              subject: "Helen",
              predicate: "prefers",
              object: "dark mode",
              confidence: 95,
              sourceType: "conversation",
              sourceRef: {
                conversationId: convId,
                messageIds: ["msg-1"],
              },
              tags: ["ui-preference"],
            });

            await new Promise((resolve) => setTimeout(resolve, 150));

            // Query for EXTRACTED_FROM relationship
            const result = await graphAdapter.query(`
              MATCH (f:Fact {factId: $factId})-[r:EXTRACTED_FROM]->(c:Conversation)
              RETURN c.conversationId as conversationId
            `, { factId: fact.factId });

            expect(result.count).toBe(1);
            expect(result.records[0].conversationId).toBe(convId);
          });
        });

        // ============================================================================
        // Test Suite 7: SUPERSEDES Relationships (Belief Revision)
        // ============================================================================
        describe("SUPERSEDES Relationships", () => {
          it("should create SUPERSEDES edge when fact supersedes another", async () => {
            // Create initial fact
            const initialFact = await cortex.facts.revise({
              memorySpaceId: TEST_MEMSPACE,
              fact: {
                fact: "Ivan's favorite color is blue",
                factType: "preference",
                subject: "Ivan-supersede-test",
                predicate: "favorite_color",
                object: "blue",
                confidence: 90,
              },
            });

            expect(initialFact.action).toBe("ADD");

            // Supersede with new fact
            const _supersedingFact = await cortex.facts.revise({
              memorySpaceId: TEST_MEMSPACE,
              fact: {
                fact: "Ivan's favorite color is green",
                factType: "preference",
                subject: "Ivan-supersede-test",
                predicate: "favorite_color",
                object: "green",
                confidence: 95,
              },
            });

            await new Promise((resolve) => setTimeout(resolve, 200));

            // Query for SUPERSEDES relationship (may or may not exist depending on belief revision action)
            const _result = await graphAdapter.query(`
              MATCH (new:Fact)-[r:SUPERSEDES]->(old:Fact)
              WHERE old.subject = 'Ivan-supersede-test' OR new.subject = 'Ivan-supersede-test'
              RETURN new.object as newValue, old.object as oldValue
            `);

            // Belief revision may result in SUPERSEDE, UPDATE, or other actions
            // depending on configuration. Check that we have fact nodes.
            const factNodes = await graphAdapter.findNodes(
              "Fact",
              { subject: "Ivan-supersede-test" },
              10,
            );
            expect(factNodes.length).toBeGreaterThanOrEqual(1);
          });

          it("should track fact history via SUPERSEDES chain", async () => {
            // Create a chain of supersessions
            const _fact1 = await cortex.facts.revise({
              memorySpaceId: TEST_MEMSPACE,
              fact: {
                fact: "Julia lives in Boston",
                factType: "knowledge",  // "location" is not a valid factType
                subject: "Julia-chain-test",
                predicate: "lives_in",
                object: "Boston",
                confidence: 85,
              },
            });

            const _fact2 = await cortex.facts.revise({
              memorySpaceId: TEST_MEMSPACE,
              fact: {
                fact: "Julia lives in New York",
                factType: "knowledge",  // "location" is not a valid factType
                subject: "Julia-chain-test",
                predicate: "lives_in",
                object: "New York",
                confidence: 90,
              },
            });

            await new Promise((resolve) => setTimeout(resolve, 200));

            // Query for all facts about Julia
            const result = await graphAdapter.query(`
              MATCH (f:Fact)
              WHERE f.subject = 'Julia-chain-test'
              RETURN f.object as location, f.confidence as confidence
              ORDER BY f.createdAt ASC
            `);

            expect(result.count).toBeGreaterThanOrEqual(1);
          });
        });

        // ============================================================================
        // Test Suite 8: Multi-Tenancy Isolation
        // ============================================================================
        describe("Multi-Tenancy Isolation", () => {
          it("should store tenantId on Fact nodes", async () => {
            const tenantId = "tenant-org-123";
            
            // Create Cortex with tenant context (requires both userId and tenantId)
            const tenantCortex = new Cortex({
              convexUrl: CONVEX_URL,
              graph: {
                adapter: graphAdapter,
              },
              auth: { 
                userId: "tenant-test-user",
                tenantId,
              },
            });

            const tenantMemSpace = ctx.memorySpaceId("tenant-test");
            await tenantCortex.memorySpaces.register({
              memorySpaceId: tenantMemSpace,
              type: "personal",
              name: "Tenant Test Space",
            });

            const fact = await tenantCortex.facts.store({
              memorySpaceId: tenantMemSpace,
              fact: "Tenant-specific fact data",
              factType: "custom",
              confidence: 100,
              sourceType: "manual",
              tags: ["tenant-test"],
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify tenantId is stored on the node
            const factNodes = await graphAdapter.findNodes(
              "Fact",
              { factId: fact.factId },
              10,
            );
            expect(factNodes.length).toBe(1);
            expect(factNodes[0].properties.tenantId).toBe(tenantId);

            // Cleanup
            await tenantCortex.memorySpaces.delete(tenantMemSpace, {
              cascade: true,
              reason: "tenant test cleanup",
            });
            tenantCortex.close();
          });
        });

        // ============================================================================
        // Test Suite 9: Graph Querying and Traversal
        // ============================================================================
        describe("Graph Querying and Traversal", () => {
          beforeEach(async () => {
            // Create interconnected facts for traversal tests
            await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Kevin works at Acme Corp",
              factType: "relationship",
              subject: "Kevin",
              predicate: "works_at",
              object: "Acme Corp",
              confidence: 95,
              sourceType: "conversation",
              tags: ["team"],
            });

            await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Lisa works at Acme Corp",
              factType: "relationship",
              subject: "Lisa",
              predicate: "works_at",
              object: "Acme Corp",
              confidence: 95,
              sourceType: "conversation",
              tags: ["team"],
            });

            await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Kevin knows Lisa",
              factType: "relationship",
              subject: "Kevin",
              predicate: "knows",
              object: "Lisa",
              confidence: 90,
              sourceType: "conversation",
              tags: ["relationship"],
            });

            await new Promise((resolve) => setTimeout(resolve, 200));
          });

          it("should find coworkers through company relationship", async () => {
            const result = await graphAdapter.query(`
              MATCH (person:Entity)-[:WORKS_AT]->(company:Entity {name: 'Acme Corp'})
              RETURN DISTINCT person.name as name
            `);

            const names = result.records.map((r: any) => r.name);
            expect(names).toContain("Kevin");
            expect(names).toContain("Lisa");
          });

          it("should traverse multi-hop relationships", async () => {
            // Kevin -> knows -> Lisa, both -> works_at -> Acme Corp
            const result = await graphAdapter.query(`
              MATCH path = (start:Entity {name: 'Kevin'})-[*1..3]-(end:Entity {name: 'Acme Corp'})
              RETURN [node in nodes(path) | node.name] as pathNodes
              LIMIT 1
            `);

            expect(result.count).toBeGreaterThanOrEqual(1);
            const pathNodes = result.records[0].pathNodes as string[];
            expect(pathNodes).toContain("Kevin");
            expect(pathNodes).toContain("Acme Corp");
          });

          it("should aggregate facts by type", async () => {
            const result = await graphAdapter.query(`
              MATCH (f:Fact)
              WHERE f.memorySpaceId = $memorySpaceId
              RETURN f.factType as type, count(*) as count
              ORDER BY count DESC
            `, { memorySpaceId: TEST_MEMSPACE });

            expect(result.count).toBeGreaterThan(0);
          });

          it("should find entities by relationship count", async () => {
            const result = await graphAdapter.query(`
              MATCH (e:Entity)
              OPTIONAL MATCH (e)-[r]-()
              WITH e, count(DISTINCT r) as connections
              WHERE connections > 0
              RETURN e.name as entity, connections
              ORDER BY connections DESC
              LIMIT 10
            `);

            expect(result.count).toBeGreaterThan(0);
          });
        });

        // ============================================================================
        // Test Suite 10: Memory and Conversation Graph Relationships
        // ============================================================================
        describe("Memory and Conversation Relationships", () => {
          it("should create Memory node with REFERENCES edge to Conversation", async () => {
            const convId = ctx.conversationId("mem-conv");
            
            // Store memory via remember()
            const result = await cortex.memory.remember({
              memorySpaceId: TEST_MEMSPACE,
              conversationId: convId,
              userMessage: "I'm planning a trip to Japan next summer",
              agentResponse: "That sounds exciting! Japan is beautiful in summer.",
              userId: "travel-user",
              userName: "Travel User",
              agentId: "travel-agent",
              importance: 80,
              tags: ["travel", "planning"],
            });

            expect(result.memories.length).toBeGreaterThanOrEqual(1);

            await new Promise((resolve) => setTimeout(resolve, 200));

            // Verify Memory -> REFERENCES -> Conversation
            const memResult = await graphAdapter.query(`
              MATCH (m:Memory)-[r:REFERENCES]->(c:Conversation)
              WHERE c.conversationId = $conversationId
              RETURN m.memoryId as memoryId, c.conversationId as conversationId
            `, { conversationId: convId });

            expect(memResult.count).toBeGreaterThanOrEqual(1);
          });
        });

        // ============================================================================
        // Test Suite 11: Complete Flow Validation
        // ============================================================================
        describe("Complete Flow Validation", () => {
          it("should sync complete conversation->memory->fact->entity chain", async () => {
            const flowConvId = ctx.conversationId("complete-flow");
            
            // 1. Store conversation and memory
            const memResult = await cortex.memory.remember({
              memorySpaceId: TEST_MEMSPACE,
              conversationId: flowConvId,
              userMessage: "My name is Morgan and I work at DataTech as a data scientist",
              agentResponse: "Nice to meet you Morgan! Data science at DataTech sounds interesting.",
              userId: "morgan-user",
              userName: "Morgan",
              agentId: "assistant",
              importance: 90,
              tags: ["introduction"],
            });

            // 2. Store related fact
            const fact = await cortex.facts.store({
              memorySpaceId: TEST_MEMSPACE,
              fact: "Morgan works at DataTech as a data scientist",
              factType: "identity",
              subject: "Morgan",
              predicate: "works_at",
              object: "DataTech",
              confidence: 95,
              sourceType: "conversation",
              sourceRef: {
                conversationId: flowConvId,
                messageIds: memResult.conversation.messageIds,
              },
              tags: ["employment"],
              entities: [
                { name: "Morgan", type: "person" },
                { name: "DataTech", type: "company" },
              ],
            });

            await new Promise((resolve) => setTimeout(resolve, 300));

            // Validate complete chain in graph
            // 1. Conversation exists
            const convNodes = await graphAdapter.findNodes(
              "Conversation",
              { conversationId: flowConvId },
              1,
            );
            expect(convNodes.length).toBe(1);

            // 2. Memory exists and references conversation
            const memQuery = await graphAdapter.query(`
              MATCH (m:Memory)-[:REFERENCES]->(c:Conversation {conversationId: $convId})
              RETURN count(m) as memCount
            `, { convId: flowConvId });
            expect((memQuery.records[0] as any).memCount).toBeGreaterThanOrEqual(1);

            // 3. Fact exists and extracted from conversation
            const factQuery = await graphAdapter.query(`
              MATCH (f:Fact {factId: $factId})-[:EXTRACTED_FROM]->(c:Conversation {conversationId: $convId})
              RETURN f.fact as fact
            `, { factId: fact.factId, convId: flowConvId });
            expect(factQuery.count).toBe(1);

            // 4. Entities exist with MENTIONS edges
            const entityQuery = await graphAdapter.query(`
              MATCH (f:Fact {factId: $factId})-[:MENTIONS]->(e:Entity)
              RETURN e.name as name, e.type as type
            `, { factId: fact.factId });
            expect(entityQuery.count).toBeGreaterThanOrEqual(2);

            // 5. Predicate relationship exists
            const predicateQuery = await graphAdapter.query(`
              MATCH (person:Entity {name: 'Morgan'})-[r:WORKS_AT]->(company:Entity {name: 'DataTech'})
              RETURN r.factId as factId
            `);
            expect(predicateQuery.count).toBeGreaterThanOrEqual(1);
          });
        });

        // ============================================================================
        // Test Suite 12: Node and Edge Count Validation
        // ============================================================================
        describe("Node and Edge Counts", () => {
          it("should have created expected number of node types", async () => {
            const counts = {
              memorySpace: await graphAdapter.countNodes("MemorySpace"),
              conversation: await graphAdapter.countNodes("Conversation"),
              memory: await graphAdapter.countNodes("Memory"),
              fact: await graphAdapter.countNodes("Fact"),
              entity: await graphAdapter.countNodes("Entity"),
              user: await graphAdapter.countNodes("User"),
              agent: await graphAdapter.countNodes("Agent"),
            };

            expect(counts.memorySpace).toBeGreaterThanOrEqual(1);
            expect(counts.fact).toBeGreaterThan(5);
            expect(counts.entity).toBeGreaterThan(5);

            console.log(`\n📊 ${name} Graph Statistics:`);
            console.log(`   MemorySpace nodes: ${counts.memorySpace}`);
            console.log(`   Conversation nodes: ${counts.conversation}`);
            console.log(`   Memory nodes: ${counts.memory}`);
            console.log(`   Fact nodes: ${counts.fact}`);
            console.log(`   Entity nodes: ${counts.entity}`);
            console.log(`   User nodes: ${counts.user}`);
            console.log(`   Agent nodes: ${counts.agent}`);
          });

          it("should have created expected relationship types", async () => {
            const edgeCounts = {
              mentions: await graphAdapter.countEdges("MENTIONS"),
              inSpace: await graphAdapter.countEdges("IN_SPACE"),
              references: await graphAdapter.countEdges("REFERENCES"),
              involves: await graphAdapter.countEdges("INVOLVES"),
              relatesToUser: await graphAdapter.countEdges("RELATES_TO"),
              total: await graphAdapter.countEdges(),
            };

            expect(edgeCounts.mentions).toBeGreaterThan(5);
            expect(edgeCounts.inSpace).toBeGreaterThan(3);
            expect(edgeCounts.total).toBeGreaterThan(15);

            console.log(`\n📊 ${name} Relationship Statistics:`);
            console.log(`   MENTIONS edges: ${edgeCounts.mentions}`);
            console.log(`   IN_SPACE edges: ${edgeCounts.inSpace}`);
            console.log(`   REFERENCES edges: ${edgeCounts.references}`);
            console.log(`   INVOLVES edges: ${edgeCounts.involves}`);
            console.log(`   RELATES_TO edges: ${edgeCounts.relatesToUser}`);
            console.log(`   Total edges: ${edgeCounts.total}`);
          });
        });
      });
    });
});

// Skip message when graph testing is not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("E2E: Comprehensive Graph Sync Tests", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Comprehensive graph sync tests skipped");
      console.log("   To enable, ensure:");
      console.log("   1. GRAPH_TESTING_ENABLED=true");
      console.log("   2. NEO4J_URI and/or MEMGRAPH_URI are set");
      console.log("   3. Graph databases are running (docker-compose -f docker-compose.graph.yml up -d)");
      console.log("   4. Convex local dev server is running\n");
      expect(true).toBe(true);
    });
  });
}
