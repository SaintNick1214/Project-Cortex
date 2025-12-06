/**
 * Graph Auto-Configuration Tests
 *
 * Tests the two-gate approach for automatic graph database configuration:
 * - Gate 1: Connection credentials must be present (NEO4J_URI or MEMGRAPH_URI + auth)
 * - Gate 2: CORTEX_GRAPH_SYNC must be set to 'true'
 *
 * Note: These tests verify the environment variable gating logic.
 * Tests that involve actual graph connections require a running Neo4j/Memgraph instance.
 */

import { jest } from "@jest/globals";
import { Cortex, type GraphConfig } from "../src/index.js";

// Helper to access private static method for testing
const autoConfigureGraph = (): Promise<GraphConfig | undefined> =>
  (
    Cortex as unknown as {
      autoConfigureGraph: () => Promise<GraphConfig | undefined>;
    }
  ).autoConfigureGraph();

describe("Graph Auto-Configuration", () => {
  // Store original env vars to restore after tests
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.CORTEX_GRAPH_SYNC;
    delete process.env.NEO4J_URI;
    delete process.env.NEO4J_USERNAME;
    delete process.env.NEO4J_PASSWORD;
    delete process.env.MEMGRAPH_URI;
    delete process.env.MEMGRAPH_USERNAME;
    delete process.env.MEMGRAPH_PASSWORD;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Two-Gate Approach - Gate 2 (CORTEX_GRAPH_SYNC)", () => {
    it("does NOT auto-configure when only NEO4J_URI is set (no opt-in)", async () => {
      // Gate 1 satisfied, Gate 2 NOT satisfied
      process.env.NEO4J_URI = "bolt://localhost:7687";
      process.env.NEO4J_USERNAME = "neo4j";
      process.env.NEO4J_PASSWORD = "password";
      // CORTEX_GRAPH_SYNC is NOT set

      const result = await autoConfigureGraph();

      expect(result).toBeUndefined();
    });

    it("does NOT auto-configure when CORTEX_GRAPH_SYNC is 'false'", async () => {
      process.env.CORTEX_GRAPH_SYNC = "false";
      process.env.NEO4J_URI = "bolt://localhost:7687";

      const result = await autoConfigureGraph();

      expect(result).toBeUndefined();
    });

    it("does NOT auto-configure when CORTEX_GRAPH_SYNC is empty string", async () => {
      process.env.CORTEX_GRAPH_SYNC = "";
      process.env.NEO4J_URI = "bolt://localhost:7687";

      const result = await autoConfigureGraph();

      expect(result).toBeUndefined();
    });
  });

  describe("Two-Gate Approach - Gate 1 (Connection Credentials)", () => {
    it("warns when only CORTEX_GRAPH_SYNC is set (no URI)", async () => {
      // Gate 2 satisfied, Gate 1 NOT satisfied
      process.env.CORTEX_GRAPH_SYNC = "true";
      // No URI set

      // Suppress the expected warning
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await autoConfigureGraph();

      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "CORTEX_GRAPH_SYNC=true but no graph database URI found",
        ),
      );

      warnSpy.mockRestore();
    });

    it("warns when both NEO4J_URI and MEMGRAPH_URI are set", async () => {
      process.env.CORTEX_GRAPH_SYNC = "true";
      process.env.NEO4J_URI = "bolt://localhost:7687";
      process.env.NEO4J_USERNAME = "neo4j";
      process.env.NEO4J_PASSWORD = "neo4jpass";
      process.env.MEMGRAPH_URI = "bolt://localhost:7688";
      process.env.MEMGRAPH_USERNAME = "memgraph";
      process.env.MEMGRAPH_PASSWORD = "memgraphpass";

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await autoConfigureGraph();

      // Should have warned about both URIs set (Neo4j takes priority)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Both NEO4J_URI and MEMGRAPH_URI set. Using Neo4j",
        ),
      );

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("Connection Handling", () => {
    it("returns undefined and logs error when Neo4j connection fails", async () => {
      process.env.CORTEX_GRAPH_SYNC = "true";
      process.env.NEO4J_URI = "bolt://localhost:9999"; // Non-existent port
      process.env.NEO4J_USERNAME = "neo4j";
      process.env.NEO4J_PASSWORD = "password";

      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await autoConfigureGraph();

      // Should return undefined when connection fails
      expect(result).toBeUndefined();
      // Should have logged an error
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to connect to Neo4j"),
        expect.any(String),
      );

      errorSpy.mockRestore();
    });

    it("returns undefined and logs error when Memgraph connection fails", async () => {
      process.env.CORTEX_GRAPH_SYNC = "true";
      process.env.MEMGRAPH_URI = "bolt://localhost:9998"; // Non-existent port
      process.env.MEMGRAPH_USERNAME = "memgraph";
      process.env.MEMGRAPH_PASSWORD = "password";

      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await autoConfigureGraph();

      // Should return undefined when connection fails
      expect(result).toBeUndefined();
      // Should have logged an error
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to connect to Memgraph"),
        expect.any(String),
      );

      errorSpy.mockRestore();
    });
  });

  describe("Cortex.create() Factory", () => {
    it("creates Cortex instance without graph when auto-config fails", async () => {
      process.env.CORTEX_GRAPH_SYNC = "true";
      process.env.NEO4J_URI = "bolt://localhost:9999"; // Non-existent port

      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const cortex = await Cortex.create({
        convexUrl: "http://127.0.0.1:3210",
      });

      expect(cortex).toBeDefined();
      // Graph worker should not be running since connection failed
      expect(cortex.getGraphSyncWorker()).toBeUndefined();

      errorSpy.mockRestore();
      cortex.close();
    });

    it("uses explicit config.graph over auto-config", async () => {
      process.env.CORTEX_GRAPH_SYNC = "true";
      process.env.NEO4J_URI = "bolt://localhost:7687";

      // Suppress connection error since we're testing config priority
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Create a mock adapter
      const explicitAdapter = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        syncConversation: jest.fn(),
      };

      const cortex = await Cortex.create({
        convexUrl: "http://127.0.0.1:3210",
        graph: {
          adapter: explicitAdapter as unknown as GraphConfig["adapter"],
        },
      });

      expect(cortex).toBeDefined();

      errorSpy.mockRestore();
      cortex.close();
    });

    it("creates Cortex without graph when CORTEX_GRAPH_SYNC is not set", async () => {
      // No env vars set for graph

      const cortex = await Cortex.create({
        convexUrl: "http://127.0.0.1:3210",
      });

      expect(cortex).toBeDefined();
      expect(cortex.getGraphSyncWorker()).toBeUndefined();

      cortex.close();
    });
  });
});
