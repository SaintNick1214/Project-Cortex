/**
 * GraphAdapter Tests
 *
 * Unit tests for CypherGraphAdapter with both Neo4j and Memgraph.
 * These tests run if graph databases are configured in environment.
 */

import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";

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

      const result = await adapter.query("MATCH (n:QueryTest) RETURN n LIMIT 1");

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

      await adapter.createEdge({ type: "REL1", from: n1, to: n2, properties: {} });
      await adapter.createEdge({ type: "REL2", from: n2, to: n1, properties: {} });

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
});

// Note: Memgraph tests would be similar but skip shortestPath tests
describeIfEnabled("Graph Adapter (Memgraph)", () => {
  let adapter: GraphAdapter;

  beforeAll(async () => {
    if (!process.env.MEMGRAPH_URI) return;

    adapter = new CypherGraphAdapter();
    await adapter.connect(MEMGRAPH_CONFIG);
    await adapter.clearDatabase();
  });

  afterAll(async () => {
    if (adapter) {
      await adapter.clearDatabase();
      await adapter.disconnect();
    }
  });

  describe("Basic Operations", () => {
    it("should create and query nodes", async () => {
      if (!process.env.MEMGRAPH_URI) return;

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

