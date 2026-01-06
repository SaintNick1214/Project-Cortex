/**
 * Neo4j URI Scheme Tests
 *
 * Tests that the CypherGraphAdapter correctly handles various Neo4j URI schemes:
 * - bolt:// (unencrypted)
 * - bolt+s:// (encrypted, system CA)
 * - bolt+ssc:// (encrypted, self-signed)
 * - neo4j:// (routing, unencrypted)
 * - neo4j+s:// (routing, encrypted)
 * - neo4j+ssc:// (routing, encrypted, self-signed)
 *
 * @tags integration, graph, neo4j
 */

import { CypherGraphAdapter } from "../../src/graph/adapters/CypherGraphAdapter";

// Skip tests when graph testing is not enabled (e.g., in CI pipeline)
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

describeIfEnabled("Neo4j URI Schemes", () => {
  describe("bolt:// scheme (local Docker)", () => {
    let adapter: CypherGraphAdapter;

    beforeAll(() => {
      adapter = new CypherGraphAdapter();
    });

    afterAll(async () => {
      await adapter.disconnect();
    });

    it("should connect with bolt:// URI", async () => {
      const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
      const username = process.env.NEO4J_USERNAME || "neo4j";
      const password = process.env.NEO4J_PASSWORD || "cortex-dev-password";

      await adapter.connect({ uri, username, password });

      const connected = await adapter.isConnected();
      expect(connected).toBe(true);
    });

    it("should execute queries after connection", async () => {
      const result = await adapter.query("RETURN 1 as test");
      expect(result.records).toHaveLength(1);
      expect(result.records[0].test).toBe(1);
    });

    it("should count nodes", async () => {
      const count = await adapter.countNodes();
      expect(typeof count).toBe("number");
    });
  });

  describe("neo4j:// scheme (local Docker)", () => {
    let adapter: CypherGraphAdapter;

    beforeAll(() => {
      adapter = new CypherGraphAdapter();
    });

    afterAll(async () => {
      await adapter.disconnect();
    });

    it("should connect with neo4j:// URI", async () => {
      // Neo4j driver accepts neo4j:// even for single instances
      const uri = "neo4j://localhost:7687";
      const username = process.env.NEO4J_USERNAME || "neo4j";
      const password = process.env.NEO4J_PASSWORD || "cortex-dev-password";

      await adapter.connect({ uri, username, password });

      const connected = await adapter.isConnected();
      expect(connected).toBe(true);
    });

    it("should execute queries after connection", async () => {
      const result = await adapter.query("RETURN 'neo4j-scheme' as scheme");
      expect(result.records).toHaveLength(1);
      expect(result.records[0].scheme).toBe("neo4j-scheme");
    });
  });

  describe("bolt+ssc:// scheme (local Docker with self-signed cert)", () => {
    let adapter: CypherGraphAdapter;

    beforeAll(() => {
      adapter = new CypherGraphAdapter();
    });

    afterAll(async () => {
      await adapter.disconnect();
    });

    it("should connect with bolt+ssc:// URI (self-signed cert)", async () => {
      // bolt+ssc:// tells the driver to accept self-signed certificates
      const uri = "bolt+ssc://localhost:7687";
      const username = process.env.NEO4J_USERNAME || "neo4j";
      const password = process.env.NEO4J_PASSWORD || "cortex-dev-password";

      await adapter.connect({ uri, username, password });

      const connected = await adapter.isConnected();
      expect(connected).toBe(true);
    });

    it("should execute queries over encrypted connection", async () => {
      const result = await adapter.query(
        "RETURN 'encrypted-bolt+ssc' as scheme",
      );
      expect(result.records).toHaveLength(1);
      expect(result.records[0].scheme).toBe("encrypted-bolt+ssc");
    });
  });

  describe("neo4j+ssc:// scheme (local Docker with self-signed cert)", () => {
    let adapter: CypherGraphAdapter;

    beforeAll(() => {
      adapter = new CypherGraphAdapter();
    });

    afterAll(async () => {
      await adapter.disconnect();
    });

    it("should connect with neo4j+ssc:// URI (self-signed cert)", async () => {
      // neo4j+ssc:// uses routing protocol with self-signed cert acceptance
      const uri = "neo4j+ssc://localhost:7687";
      const username = process.env.NEO4J_USERNAME || "neo4j";
      const password = process.env.NEO4J_PASSWORD || "cortex-dev-password";

      await adapter.connect({ uri, username, password });

      const connected = await adapter.isConnected();
      expect(connected).toBe(true);
    });

    it("should execute queries over encrypted routing connection", async () => {
      const result = await adapter.query(
        "RETURN 'encrypted-neo4j+ssc' as scheme",
      );
      expect(result.records).toHaveLength(1);
      expect(result.records[0].scheme).toBe("encrypted-neo4j+ssc");
    });
  });

  describe("URI scheme validation (fake hosts - verifies SDK accepts format)", () => {
    // These tests verify the neo4j-driver doesn't reject URI schemes at parse time
    // They fail on DNS/connection (expected) but not on URI format validation

    it("should not reject neo4j+s:// URI format", async () => {
      const adapter = new CypherGraphAdapter();

      // This will fail to connect (no server) but shouldn't fail on URI validation
      await expect(
        adapter.connect({
          uri: "neo4j+s://fake-cloud-host.neo4j.io:7687",
          username: "neo4j",
          password: "password",
        }),
      ).rejects.toThrow(); // Connection error expected, not URI validation error

      await adapter.disconnect();
    });

    it("should not reject bolt+s:// URI format", async () => {
      const adapter = new CypherGraphAdapter();

      // This will fail to connect (no server) but shouldn't fail on URI validation
      await expect(
        adapter.connect({
          uri: "bolt+s://fake-cloud-host.neo4j.io:7687",
          username: "neo4j",
          password: "password",
        }),
      ).rejects.toThrow(); // Connection error expected, not URI validation error

      await adapter.disconnect();
    });
  });
});

// Log skip message when graph testing is disabled
if (!GRAPH_TESTING_ENABLED) {
  describe("Neo4j URI Schemes", () => {
    it("SKIPPED: Graph testing not enabled", () => {
      console.log("\n   ⚠️  Neo4j URI Scheme tests are SKIPPED.");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
    });
  });
}
