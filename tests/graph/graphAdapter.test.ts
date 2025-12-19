/**
 * GraphAdapter Tests
 *
 * Unit tests for CypherGraphAdapter with both Neo4j and Memgraph.
 * These tests run if graph databases are configured in environment.
 */

import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import {
  GraphConnectionError,
  GraphQueryError,
  GraphNotFoundError,
} from "../../src/graph";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";

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

// Skip all tests if graph testing is not enabled
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

describeIfEnabled("Graph Adapter (Neo4j)", () => {
  let adapter: GraphAdapter;

  beforeAll(async () => {
    adapter = new CypherGraphAdapter();
    await adapter.connect(NEO4J_CONFIG);
    await adapter.clearDatabase();
  });

  afterAll(async () => {
    await adapter.clearDatabase();
    await adapter.disconnect();
  });

  describe("Connection", () => {
    it("should connect to database", async () => {
      const connected = await adapter.isConnected();
      expect(connected).toBe(true);
    });
  });

  describe("Node Operations", () => {
    it("should create a node", async () => {
      const nodeId = await adapter.createNode({
        label: "TestNode",
        properties: {
          name: "Test",
          value: 123,
        },
      });

      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe("string");
    });

    it("should read a node", async () => {
      const nodeId = await adapter.createNode({
        label: "TestNode",
        properties: { name: "Read Test" },
      });

      const node = await adapter.getNode(nodeId);

      expect(node).not.toBeNull();
      expect(node!.label).toBe("TestNode");
      expect(node!.properties.name).toBe("Read Test");
    });

    it("should update a node", async () => {
      const nodeId = await adapter.createNode({
        label: "TestNode",
        properties: { status: "pending" },
      });

      await adapter.updateNode(nodeId, { status: "active" });

      const updated = await adapter.getNode(nodeId);
      expect(updated!.properties.status).toBe("active");
    });

    it("should delete a node", async () => {
      const nodeId = await adapter.createNode({
        label: "TestNode",
        properties: { temp: true },
      });

      await adapter.deleteNode(nodeId);

      const deleted = await adapter.getNode(nodeId);
      expect(deleted).toBeNull();
    });

    it("should find nodes by label and properties", async () => {
      await adapter.createNode({
        label: "Agent",
        properties: { agentId: "agent-1", team: "finance" },
      });

      await adapter.createNode({
        label: "Agent",
        properties: { agentId: "agent-2", team: "hr" },
      });

      const agents = await adapter.findNodes("Agent", {}, 10);
      expect(agents.length).toBeGreaterThanOrEqual(2);

      const financeAgents = await adapter.findNodes(
        "Agent",
        { team: "finance" },
        10,
      );
      expect(financeAgents.length).toBe(1);
      expect(financeAgents[0].properties.agentId).toBe("agent-1");
    });
  });

  describe("Edge Operations", () => {
    it("should create an edge", async () => {
      const node1 = await adapter.createNode({
        label: "Agent",
        properties: { agentId: "a1" },
      });

      const node2 = await adapter.createNode({
        label: "Agent",
        properties: { agentId: "a2" },
      });

      const edgeId = await adapter.createEdge({
        type: "SENT_TO",
        from: node1,
        to: node2,
        properties: { timestamp: Date.now() },
      });

      expect(edgeId).toBeDefined();
    });

    it("should find edges by type", async () => {
      const node1 = await adapter.createNode({
        label: "TestNode",
        properties: { id: "n1" },
      });

      const node2 = await adapter.createNode({
        label: "TestNode",
        properties: { id: "n2" },
      });

      await adapter.createEdge({
        type: "TEST_REL",
        from: node1,
        to: node2,
        properties: {},
      });

      const edges = await adapter.findEdges("TEST_REL", {}, 10);
      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(edges[0].type).toBe("TEST_REL");
    });
  });

  describe("Query Operations", () => {
    it("should execute a simple query", async () => {
      await adapter.createNode({
        label: "QueryTest",
        properties: { value: 42 },
      });

      const result = await adapter.query(
        "MATCH (n:QueryTest) RETURN n LIMIT 1",
      );

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.records.length).toBeGreaterThanOrEqual(1);
    });

    it("should execute a parameterized query", async () => {
      await adapter.createNode({
        label: "ParamTest",
        properties: { key: "test-key" },
      });

      const result = await adapter.query(
        "MATCH (n:ParamTest {key: $key}) RETURN n",
        { key: "test-key" },
      );

      expect(result.count).toBe(1);
    });
  });

  describe("Traversal Operations", () => {
    it("should traverse relationships", async () => {
      // Create chain: A → B → C
      const nodeA = await adapter.createNode({
        label: "TraversalTest",
        properties: { name: "A" },
      });

      const nodeB = await adapter.createNode({
        label: "TraversalTest",
        properties: { name: "B" },
      });

      const nodeC = await adapter.createNode({
        label: "TraversalTest",
        properties: { name: "C" },
      });

      await adapter.createEdge({
        type: "NEXT",
        from: nodeA,
        to: nodeB,
        properties: {},
      });

      await adapter.createEdge({
        type: "NEXT",
        from: nodeB,
        to: nodeC,
        properties: {},
      });

      // Traverse from A
      const connected = await adapter.traverse({
        startId: nodeA,
        relationshipTypes: ["NEXT"],
        maxDepth: 2,
        direction: "OUTGOING",
      });

      expect(connected.length).toBe(2); // B and C
    });
  });

  describe("Utility Operations", () => {
    it("should count nodes", async () => {
      await adapter.clearDatabase();

      await adapter.createNode({ label: "Counter", properties: {} });
      await adapter.createNode({ label: "Counter", properties: {} });
      await adapter.createNode({ label: "Other", properties: {} });

      const total = await adapter.countNodes();
      expect(total).toBe(3);

      const counters = await adapter.countNodes("Counter");
      expect(counters).toBe(2);
    });

    it("should count edges", async () => {
      await adapter.clearDatabase();

      const n1 = await adapter.createNode({ label: "Node", properties: {} });
      const n2 = await adapter.createNode({ label: "Node", properties: {} });

      await adapter.createEdge({
        type: "REL1",
        from: n1,
        to: n2,
        properties: {},
      });
      await adapter.createEdge({
        type: "REL2",
        from: n2,
        to: n1,
        properties: {},
      });

      const total = await adapter.countEdges();
      expect(total).toBe(2);

      const rel1Count = await adapter.countEdges("REL1");
      expect(rel1Count).toBe(1);
    });
  });

  describe("Batch Operations", () => {
    it("should execute batch writes in transaction", async () => {
      await adapter.clearDatabase();

      await adapter.batchWrite([
        {
          type: "CREATE_NODE",
          data: {
            label: "BatchTest",
            properties: { id: "batch-1" },
          },
        },
        {
          type: "CREATE_NODE",
          data: {
            label: "BatchTest",
            properties: { id: "batch-2" },
          },
        },
      ]);

      const nodes = await adapter.findNodes("BatchTest", {}, 10);
      expect(nodes.length).toBe(2);
    });
  });

  // ============================================================================
  // Sad Path Tests - Connection Errors
  // ============================================================================
  describe("Connection Error Handling", () => {
    it("should throw GraphConnectionError with invalid URI", async () => {
      const badAdapter = new CypherGraphAdapter();
      await expect(
        badAdapter.connect({
          uri: "bolt://invalid-host:9999",
          username: "neo4j",
          password: "password",
        }),
      ).rejects.toThrow(GraphConnectionError);
    });

    it("should return false from isConnected when not connected", async () => {
      const disconnectedAdapter = new CypherGraphAdapter();
      const connected = await disconnectedAdapter.isConnected();
      expect(connected).toBe(false);
    });

    it("should throw when performing operations without connection", async () => {
      const disconnectedAdapter = new CypherGraphAdapter();
      await expect(
        disconnectedAdapter.createNode({
          label: "Test",
          properties: {},
        }),
      ).rejects.toThrow(/Not connected/);
    });
  });

  // ============================================================================
  // Disconnect Tests
  // ============================================================================
  describe("Disconnect Operations", () => {
    it("should disconnect cleanly", async () => {
      const tempAdapter = new CypherGraphAdapter();
      await tempAdapter.connect(NEO4J_CONFIG);

      const beforeDisconnect = await tempAdapter.isConnected();
      expect(beforeDisconnect).toBe(true);

      await tempAdapter.disconnect();

      const afterDisconnect = await tempAdapter.isConnected();
      expect(afterDisconnect).toBe(false);
    });

    it("should handle disconnect when not connected", async () => {
      const tempAdapter = new CypherGraphAdapter();
      // Should not throw
      await expect(tempAdapter.disconnect()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Merge Node Tests
  // ============================================================================
  describe("Merge Node Operations", () => {
    beforeEach(async () => {
      await adapter.clearDatabase();
    });

    it("should create new node when merging non-existent node", async () => {
      const nodeId = await adapter.mergeNode(
        {
          label: "MergeTest",
          properties: {
            uniqueId: "merge-1",
            name: "Initial Name",
            value: 100,
          },
        },
        { uniqueId: "merge-1" },
      );

      expect(nodeId).toBeDefined();

      const node = await adapter.getNode(nodeId);
      expect(node).not.toBeNull();
      expect(node!.properties.uniqueId).toBe("merge-1");
      expect(node!.properties.name).toBe("Initial Name");
      expect(node!.properties.value).toBe(100);
    });

    it("should update existing node when merging", async () => {
      // First create
      const _nodeId1 = await adapter.mergeNode(
        {
          label: "MergeTest",
          properties: {
            uniqueId: "merge-2",
            name: "First Name",
            value: 50,
          },
        },
        { uniqueId: "merge-2" },
      );

      // Then merge again with same match property
      const _nodeId2 = await adapter.mergeNode(
        {
          label: "MergeTest",
          properties: {
            uniqueId: "merge-2",
            name: "Updated Name",
            value: 200,
          },
        },
        { uniqueId: "merge-2" },
      );

      // Should return same node (may have different internal ID format)
      const nodes = await adapter.findNodes(
        "MergeTest",
        { uniqueId: "merge-2" },
        10,
      );
      expect(nodes.length).toBe(1);
      expect(nodes[0].properties.name).toBe("Updated Name");
      expect(nodes[0].properties.value).toBe(200);
    });

    it("should merge with complex match properties", async () => {
      await adapter.mergeNode(
        {
          label: "ComplexMerge",
          properties: {
            type: "user",
            externalId: "ext-123",
            name: "John",
            role: "admin",
          },
        },
        { type: "user", externalId: "ext-123" },
      );

      // Merge again with same composite key
      await adapter.mergeNode(
        {
          label: "ComplexMerge",
          properties: {
            type: "user",
            externalId: "ext-123",
            name: "John Doe",
            role: "superadmin",
          },
        },
        { type: "user", externalId: "ext-123" },
      );

      const nodes = await adapter.findNodes(
        "ComplexMerge",
        { type: "user", externalId: "ext-123" },
        10,
      );
      expect(nodes.length).toBe(1);
      expect(nodes[0].properties.name).toBe("John Doe");
      expect(nodes[0].properties.role).toBe("superadmin");
    });

    it("should create separate nodes with different match properties", async () => {
      await adapter.mergeNode(
        {
          label: "MergeTest",
          properties: { uniqueId: "different-1", name: "Node 1" },
        },
        { uniqueId: "different-1" },
      );

      await adapter.mergeNode(
        {
          label: "MergeTest",
          properties: { uniqueId: "different-2", name: "Node 2" },
        },
        { uniqueId: "different-2" },
      );

      const nodes = await adapter.findNodes("MergeTest", {}, 10);
      expect(nodes.length).toBe(2);
    });
  });

  // ============================================================================
  // Not Found Tests
  // ============================================================================
  describe("Not Found Scenarios", () => {
    it("should return null when getting non-existent node", async () => {
      const node = await adapter.getNode("non-existent-id-12345");
      expect(node).toBeNull();
    });

    it("should throw GraphNotFoundError when updating non-existent node", async () => {
      await expect(
        adapter.updateNode("non-existent-id-12345", { status: "active" }),
      ).rejects.toThrow(GraphNotFoundError);
    });

    it("should not throw when deleting non-existent node", async () => {
      // Delete should be idempotent - no error for non-existent
      await expect(
        adapter.deleteNode("non-existent-id-12345"),
      ).resolves.not.toThrow();
    });

    it("should return empty array when finding nodes with no matches", async () => {
      const nodes = await adapter.findNodes(
        "NonExistentLabel",
        { key: "value" },
        10,
      );
      expect(nodes).toEqual([]);
    });

    it("should return empty array when finding edges with no matches", async () => {
      const edges = await adapter.findEdges(
        "NON_EXISTENT_TYPE",
        { key: "value" },
        10,
      );
      expect(edges).toEqual([]);
    });
  });

  // ============================================================================
  // Delete Edge Tests
  // ============================================================================
  describe("Delete Edge Operations", () => {
    beforeEach(async () => {
      await adapter.clearDatabase();
    });

    it("should delete an existing edge", async () => {
      const node1 = await adapter.createNode({
        label: "EdgeDeleteTest",
        properties: { id: "node1" },
      });

      const node2 = await adapter.createNode({
        label: "EdgeDeleteTest",
        properties: { id: "node2" },
      });

      const edgeId = await adapter.createEdge({
        type: "TEST_EDGE",
        from: node1,
        to: node2,
        properties: { weight: 10 },
      });

      // Verify edge exists
      let edges = await adapter.findEdges("TEST_EDGE", {}, 10);
      expect(edges.length).toBe(1);

      // Delete the edge
      await adapter.deleteEdge(edgeId);

      // Verify edge is deleted
      edges = await adapter.findEdges("TEST_EDGE", {}, 10);
      expect(edges.length).toBe(0);

      // Nodes should still exist
      const n1 = await adapter.getNode(node1);
      const n2 = await adapter.getNode(node2);
      expect(n1).not.toBeNull();
      expect(n2).not.toBeNull();
    });

    it("should not throw when deleting non-existent edge", async () => {
      await expect(
        adapter.deleteEdge("non-existent-edge-id"),
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Find Path Tests
  // ============================================================================
  describe("Find Path Operations", () => {
    beforeEach(async () => {
      await adapter.clearDatabase();
    });

    it("should find shortest path between nodes", async () => {
      // Create nodes: A → B → C → D
      const nodeA = await adapter.createNode({
        label: "PathTest",
        properties: { name: "A" },
      });

      const nodeB = await adapter.createNode({
        label: "PathTest",
        properties: { name: "B" },
      });

      const nodeC = await adapter.createNode({
        label: "PathTest",
        properties: { name: "C" },
      });

      const nodeD = await adapter.createNode({
        label: "PathTest",
        properties: { name: "D" },
      });

      await adapter.createEdge({
        type: "PATH_NEXT",
        from: nodeA,
        to: nodeB,
        properties: {},
      });

      await adapter.createEdge({
        type: "PATH_NEXT",
        from: nodeB,
        to: nodeC,
        properties: {},
      });

      await adapter.createEdge({
        type: "PATH_NEXT",
        from: nodeC,
        to: nodeD,
        properties: {},
      });

      const path = await adapter.findPath({
        fromId: nodeA,
        toId: nodeD,
        maxHops: 5,
        relationshipTypes: ["PATH_NEXT"],
        direction: "OUTGOING",
      });

      expect(path).not.toBeNull();
      expect(path!.length).toBe(3); // 3 hops: A→B, B→C, C→D
      expect(path!.nodes.length).toBe(4); // 4 nodes: A, B, C, D
      expect(path!.relationships.length).toBe(3);
    });

    it("should return null when no path exists", async () => {
      const node1 = await adapter.createNode({
        label: "Isolated",
        properties: { name: "Isolated1" },
      });

      const node2 = await adapter.createNode({
        label: "Isolated",
        properties: { name: "Isolated2" },
      });

      // No edge between them
      const path = await adapter.findPath({
        fromId: node1,
        toId: node2,
        maxHops: 5,
      });

      expect(path).toBeNull();
    });

    it("should respect relationship type filters", async () => {
      const nodeA = await adapter.createNode({
        label: "FilterTest",
        properties: { name: "A" },
      });

      const nodeB = await adapter.createNode({
        label: "FilterTest",
        properties: { name: "B" },
      });

      const nodeC = await adapter.createNode({
        label: "FilterTest",
        properties: { name: "C" },
      });

      // A → B with LIKES
      await adapter.createEdge({
        type: "LIKES",
        from: nodeA,
        to: nodeB,
        properties: {},
      });

      // B → C with DISLIKES
      await adapter.createEdge({
        type: "DISLIKES",
        from: nodeB,
        to: nodeC,
        properties: {},
      });

      // Should not find path when filtering for LIKES only
      const pathLikesOnly = await adapter.findPath({
        fromId: nodeA,
        toId: nodeC,
        maxHops: 5,
        relationshipTypes: ["LIKES"],
      });

      expect(pathLikesOnly).toBeNull();

      // Should find path when including both types
      const pathBoth = await adapter.findPath({
        fromId: nodeA,
        toId: nodeC,
        maxHops: 5,
        relationshipTypes: ["LIKES", "DISLIKES"],
      });

      expect(pathBoth).not.toBeNull();
      expect(pathBoth!.length).toBe(2);
    });

    it("should respect direction constraints", async () => {
      const nodeA = await adapter.createNode({
        label: "DirectionTest",
        properties: { name: "A" },
      });

      const nodeB = await adapter.createNode({
        label: "DirectionTest",
        properties: { name: "B" },
      });

      // Only A → B, no B → A
      await adapter.createEdge({
        type: "ONE_WAY",
        from: nodeA,
        to: nodeB,
        properties: {},
      });

      // Should find path from A to B
      const forwardPath = await adapter.findPath({
        fromId: nodeA,
        toId: nodeB,
        maxHops: 5,
        direction: "OUTGOING",
      });
      expect(forwardPath).not.toBeNull();

      // Should NOT find path from B to A with OUTGOING direction
      const reversePath = await adapter.findPath({
        fromId: nodeB,
        toId: nodeA,
        maxHops: 5,
        direction: "OUTGOING",
      });
      expect(reversePath).toBeNull();
    });
  });

  // ============================================================================
  // Query Error Tests
  // ============================================================================
  describe("Query Error Handling", () => {
    it("should throw GraphQueryError for invalid Cypher", async () => {
      await expect(
        adapter.query("THIS IS NOT VALID CYPHER SYNTAX!!! @#$"),
      ).rejects.toThrow(GraphQueryError);
    });

    it("should handle missing parameters gracefully", async () => {
      // Query with required parameter but not provided
      await expect(
        adapter.query("MATCH (n {id: $missingParam}) RETURN n"),
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Edge Creation Sad Path Tests
  // ============================================================================
  describe("Edge Creation Sad Paths", () => {
    it("should throw when source node does not exist", async () => {
      const validNode = await adapter.createNode({
        label: "EdgeTest",
        properties: { id: "valid" },
      });

      await expect(
        adapter.createEdge({
          type: "INVALID_EDGE",
          from: "non-existent-source-id",
          to: validNode,
          properties: {},
        }),
      ).rejects.toThrow();
    });

    it("should throw when target node does not exist", async () => {
      const validNode = await adapter.createNode({
        label: "EdgeTest",
        properties: { id: "valid" },
      });

      await expect(
        adapter.createEdge({
          type: "INVALID_EDGE",
          from: validNode,
          to: "non-existent-target-id",
          properties: {},
        }),
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Traverse Edge Cases
  // ============================================================================
  describe("Traverse Edge Cases", () => {
    it("should return empty array for traverse with no connections", async () => {
      const isolatedNode = await adapter.createNode({
        label: "Isolated",
        properties: { name: "Lonely" },
      });

      const connected = await adapter.traverse({
        startId: isolatedNode,
        relationshipTypes: ["ANY"],
        maxDepth: 5,
      });

      expect(connected).toEqual([]);
    });

    it("should traverse with INCOMING direction", async () => {
      await adapter.clearDatabase();

      const nodeA = await adapter.createNode({
        label: "DirTest",
        properties: { name: "A" },
      });

      const nodeB = await adapter.createNode({
        label: "DirTest",
        properties: { name: "B" },
      });

      // B → A
      await adapter.createEdge({
        type: "POINTS_TO",
        from: nodeB,
        to: nodeA,
        properties: {},
      });

      // Traverse INCOMING from A should find B
      const incoming = await adapter.traverse({
        startId: nodeA,
        relationshipTypes: ["POINTS_TO"],
        maxDepth: 2,
        direction: "INCOMING",
      });

      expect(incoming.length).toBe(1);
      expect(incoming[0].properties.name).toBe("B");
    });

    it("should traverse with BOTH direction", async () => {
      await adapter.clearDatabase();

      const nodeA = await adapter.createNode({
        label: "BothTest",
        properties: { name: "A" },
      });

      const nodeB = await adapter.createNode({
        label: "BothTest",
        properties: { name: "B" },
      });

      const nodeC = await adapter.createNode({
        label: "BothTest",
        properties: { name: "C" },
      });

      // B → A and A → C
      await adapter.createEdge({
        type: "CONNECTED",
        from: nodeB,
        to: nodeA,
        properties: {},
      });

      await adapter.createEdge({
        type: "CONNECTED",
        from: nodeA,
        to: nodeC,
        properties: {},
      });

      // Traverse BOTH from A should find B and C
      const both = await adapter.traverse({
        startId: nodeA,
        relationshipTypes: ["CONNECTED"],
        maxDepth: 2,
        direction: "BOTH",
      });

      expect(both.length).toBe(2);
      const names = both.map((n) => n.properties.name).sort();
      expect(names).toEqual(["B", "C"]);
    });
  });

  // ============================================================================
  // Clear Database Tests
  // ============================================================================
  describe("Clear Database", () => {
    it("should remove all nodes and edges", async () => {
      // Create some data
      const n1 = await adapter.createNode({
        label: "ClearTest",
        properties: { id: "1" },
      });
      const n2 = await adapter.createNode({
        label: "ClearTest",
        properties: { id: "2" },
      });
      await adapter.createEdge({
        type: "TEST_REL",
        from: n1,
        to: n2,
        properties: {},
      });

      const beforeClear = await adapter.countNodes();
      expect(beforeClear).toBeGreaterThanOrEqual(2);

      await adapter.clearDatabase();

      const afterClear = await adapter.countNodes();
      expect(afterClear).toBe(0);

      const edgesAfter = await adapter.countEdges();
      expect(edgesAfter).toBe(0);
    });
  });
});

// Note: Memgraph tests - only run if Memgraph is actually available
const MEMGRAPH_AVAILABLE =
  GRAPH_TESTING_ENABLED && process.env.MEMGRAPH_URI !== undefined;
const describeIfMemgraph = MEMGRAPH_AVAILABLE ? describe : describe.skip;

describeIfMemgraph("Graph Adapter (Memgraph)", () => {
  let adapter: GraphAdapter;
  let connected = false;

  beforeAll(async () => {
    try {
      adapter = new CypherGraphAdapter();
      await adapter.connect(MEMGRAPH_CONFIG);
      await adapter.clearDatabase();
      connected = true;
    } catch {
      // Memgraph not available - tests will be skipped via connected check
      connected = false;
    }
  });

  afterAll(async () => {
    if (connected && adapter) {
      try {
        await adapter.clearDatabase();
        await adapter.disconnect();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("Basic Operations", () => {
    it("should create and query nodes", async () => {
      if (!connected) {
        console.log("⚠️  Memgraph not available - skipping test");
        return;
      }

      const nodeId = await adapter.createNode({
        label: "MemgraphTest",
        properties: { name: "Test" },
      });

      const node = await adapter.getNode(nodeId);
      expect(node).not.toBeNull();
      expect(node!.properties.name).toBe("Test");
    });
  });
});
