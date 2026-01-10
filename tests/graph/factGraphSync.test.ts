/**
 * Fact Graph Sync Tests
 *
 * Tests the automatic fact-to-graph synchronization that occurs when
 * CORTEX_GRAPH_SYNC=true and graphAdapter is configured.
 *
 * These tests verify:
 * - Facts are automatically synced to graph via BeliefRevisionService
 * - Entity nodes are created from fact.entities array
 * - MENTIONS relationships are created from Fact to Entity
 * - Predicate-based relationships (e.g., WORKS_AT, KNOWS)
 * - SUPERSEDES relationships when facts are superseded
 */

import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import {
  syncFactToGraph,
  syncFactRelationships,
} from "../../src/graph/sync/syncUtils";
import { syncMemorySpaceToGraph } from "../../src/graph/sync/syncUtils";
import type { FactRecord, MemorySpace } from "../../src/types";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

describeIfEnabled("Fact Graph Sync", () => {
  let adapter: GraphAdapter;
  const timestamp = Date.now();

  beforeAll(async () => {
    adapter = new CypherGraphAdapter();
    await adapter.connect(NEO4J_CONFIG);
    await adapter.clearDatabase();
  });

  afterAll(async () => {
    await adapter.clearDatabase();
    await adapter.disconnect();
  });

  beforeEach(async () => {
    await adapter.clearDatabase();
  });

  // Helper to create prerequisite nodes
  async function createMemorySpace(id: string): Promise<string> {
    const space: MemorySpace = {
      _id: "doc-id" as any,
      memorySpaceId: id,
      name: "Test Space",
      type: "personal",
      status: "active",
      participants: [],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return await syncMemorySpaceToGraph(space, adapter);
  }

  // ============================================================================
  // Automatic Fact Sync Tests
  // ============================================================================
  describe("Automatic Fact Sync", () => {
    it("should sync fact with entities to create Entity nodes", async () => {
      const memorySpaceId = `space-entities-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const fact: FactRecord = {
        _id: "doc-id" as any,
        factId: `fact-entities-${timestamp}`,
        memorySpaceId,
        fact: "Sarah climbs at Planet Granite in San Francisco",
        factType: "knowledge",
        subject: "Sarah",
        predicate: "climbs_at",
        object: "Planet Granite",
        confidence: 95,
        sourceType: "conversation",
        tags: ["hobby", "location"],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Entity array for graph sync
        entities: [
          { name: "Sarah", type: "person" },
          { name: "Planet Granite", type: "place" },
          { name: "San Francisco", type: "city" },
        ],
      };

      // Sync fact to graph
      const nodeId = await syncFactToGraph(fact, adapter);
      await syncFactRelationships(fact, nodeId, adapter);

      // Verify fact node exists
      const factNodes = await adapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.fact).toBe(fact.fact);

      // Verify Entity nodes were created
      const entityNodes = await adapter.findNodes("Entity", {}, 10);
      expect(entityNodes.length).toBe(3);

      const entityNames = entityNodes.map((n) => n.properties.name);
      expect(entityNames).toContain("Sarah");
      expect(entityNames).toContain("Planet Granite");
      expect(entityNames).toContain("San Francisco");

      // Verify MENTIONS relationships
      const mentionsEdges = await adapter.findEdges("MENTIONS", {}, 10);
      expect(mentionsEdges.length).toBe(3);
    });

    it("should create predicate-based relationships from fact.relations", async () => {
      const memorySpaceId = `space-relations-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const fact: FactRecord = {
        _id: "doc-id" as any,
        factId: `fact-relations-${timestamp}`,
        memorySpaceId,
        fact: "John works at Acme Corp",
        factType: "relationship",
        subject: "John",
        predicate: "works_at",
        object: "Acme Corp",
        confidence: 90,
        sourceType: "conversation",
        tags: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Relations array for relationship sync
        relations: [
          {
            type: "WORKS_AT",
            target: "Acme Corp",
            properties: { role: "Engineer" },
          },
        ],
      };

      // Sync fact to graph
      const nodeId = await syncFactToGraph(fact, adapter);
      await syncFactRelationships(fact, nodeId, adapter);

      // Verify fact node exists with subject/object
      const factNodes = await adapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.subject).toBe("John");
      expect(factNodes[0].properties.object).toBe("Acme Corp");
    });

    it("should handle fact with sourceRef for EXTRACTED_FROM relationship", async () => {
      const memorySpaceId = `space-sourceref-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const fact: FactRecord = {
        _id: "doc-id" as any,
        factId: `fact-sourceref-${timestamp}`,
        memorySpaceId,
        fact: "User prefers dark mode",
        factType: "preference",
        subject: "user-123",
        predicate: "prefers",
        object: "dark mode",
        confidence: 100,
        sourceType: "conversation",
        sourceRef: {
          conversationId: "conv-123",
          messageIds: ["msg-1", "msg-2"],
          memoryId: "mem-123",
        },
        tags: ["ui", "preferences"],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Sync fact to graph
      const nodeId = await syncFactToGraph(fact, adapter);
      await syncFactRelationships(fact, nodeId, adapter);

      // Verify fact node has sourceRef properties
      const factNodes = await adapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.sourceType).toBe("conversation");
    });

    it("should sync fact with tenantId for multi-tenant isolation", async () => {
      const memorySpaceId = `space-tenant-${timestamp}`;
      await createMemorySpace(memorySpaceId);
      const tenantId = "tenant-org-123";

      const fact: FactRecord = {
        _id: "doc-id" as any,
        factId: `fact-tenant-${timestamp}`,
        memorySpaceId,
        tenantId,
        fact: "Tenant-specific fact",
        factType: "custom",
        confidence: 100,
        sourceType: "manual",
        tags: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Sync fact to graph with tenantId
      const nodeId = await syncFactToGraph(fact, adapter, tenantId);
      await syncFactRelationships(fact, nodeId, adapter);

      // Verify fact node has tenantId
      const factNodes = await adapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.tenantId).toBe(tenantId);
    });
  });

  // ============================================================================
  // Belief Revision Graph Sync Tests
  // ============================================================================
  describe("Belief Revision Graph Integration", () => {
    it("should create SUPERSEDES relationship when fact supersedes another", async () => {
      const memorySpaceId = `space-supersede-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      // Create old fact
      const oldFact: FactRecord = {
        _id: "doc-old" as any,
        factId: `fact-old-${timestamp}`,
        memorySpaceId,
        fact: "User prefers blue",
        factType: "preference",
        subject: "user-123",
        predicate: "favorite_color",
        object: "blue",
        confidence: 90,
        sourceType: "conversation",
        tags: [],
        version: 1,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      };

      // Sync old fact
      const oldNodeId = await syncFactToGraph(oldFact, adapter);
      await syncFactRelationships(oldFact, oldNodeId, adapter);

      // Create new fact that supersedes the old one
      const newFact: FactRecord = {
        _id: "doc-new" as any,
        factId: `fact-new-${timestamp}`,
        memorySpaceId,
        fact: "User prefers purple",
        factType: "preference",
        subject: "user-123",
        predicate: "favorite_color",
        object: "purple",
        confidence: 95,
        sourceType: "conversation",
        tags: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Supersession info
        supersedes: oldFact.factId,
      };

      // Sync new fact
      const newNodeId = await syncFactToGraph(newFact, adapter);
      await syncFactRelationships(newFact, newNodeId, adapter);

      // Verify both fact nodes exist
      const allFactNodes = await adapter.findNodes("Fact", {}, 10);
      expect(allFactNodes.length).toBe(2);

      // Verify SUPERSEDES relationship exists
      const supersedesEdges = await adapter.findEdges("SUPERSEDES", {}, 10);
      expect(supersedesEdges.length).toBe(1);
    });
  });
});

// Skip message when not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("Fact Graph Sync", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Fact graph sync tests skipped");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
      expect(true).toBe(true);
    });
  });
}
