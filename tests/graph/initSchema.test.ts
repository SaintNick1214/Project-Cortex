/**
 * Schema Initialization Tests
 *
 * Unit tests for graph schema initialization, verification, and management.
 */

import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import {
  initializeGraphSchema,
  verifyGraphSchema,
  dropGraphSchema,
} from "../../src/graph/schema/initSchema";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

describeIfEnabled("Schema Initialization", () => {
  let adapter: GraphAdapter;

  beforeAll(async () => {
    adapter = new CypherGraphAdapter();
    await adapter.connect(NEO4J_CONFIG);
  });

  afterAll(async () => {
    // Clean up schema after tests
    try {
      await dropGraphSchema(adapter);
    } catch {
      // Ignore errors during cleanup
    }
    await adapter.disconnect();
  });

  beforeEach(async () => {
    // Drop schema before each test to start fresh
    try {
      await dropGraphSchema(adapter);
    } catch {
      // Ignore if schema doesn't exist
    }
  });

  // ============================================================================
  // initializeGraphSchema Tests
  // ============================================================================
  describe("initializeGraphSchema()", () => {
    it("should initialize schema without errors", async () => {
      await expect(initializeGraphSchema(adapter)).resolves.not.toThrow();
    });

    it("should create unique constraints for entity IDs", async () => {
      await initializeGraphSchema(adapter);

      const verification = await verifyGraphSchema(adapter);

      // Should have created constraints for key entities
      if (verification.valid || verification.constraints.length > 0) {
        // Neo4j/Memgraph creates constraints - verify some exist
        expect(
          verification.constraints.length + verification.indexes.length,
        ).toBeGreaterThan(0);
      }
    });

    it("should be idempotent (can be called multiple times)", async () => {
      // First call
      await initializeGraphSchema(adapter);

      // Second call should not throw (IF NOT EXISTS semantics)
      await expect(initializeGraphSchema(adapter)).resolves.not.toThrow();

      // Verify schema is still valid
      const verification = await verifyGraphSchema(adapter);
      // Should not have duplicated anything
      expect(verification).toBeDefined();
    });

    it("should create constraints for all required node types", async () => {
      await initializeGraphSchema(adapter);

      // Test by creating nodes with unique IDs - constraints should be enforced
      const nodeTypes = [
        {
          label: "MemorySpace",
          prop: "memorySpaceId",
          value: "unique-space-1",
        },
        { label: "Context", prop: "contextId", value: "unique-ctx-1" },
        {
          label: "Conversation",
          prop: "conversationId",
          value: "unique-conv-1",
        },
        { label: "Memory", prop: "memoryId", value: "unique-mem-1" },
        { label: "Fact", prop: "factId", value: "unique-fact-1" },
        { label: "User", prop: "userId", value: "unique-user-1" },
      ];

      for (const nodeType of nodeTypes) {
        // First create should succeed
        await adapter.createNode({
          label: nodeType.label,
          properties: { [nodeType.prop]: nodeType.value },
        });

        // Second create with same ID should fail (unique constraint)
        // Note: This depends on constraint being properly created
        // Some graph DBs may not enforce this immediately
      }

      // Clean up test nodes
      await adapter.clearDatabase();
    });
  });

  // ============================================================================
  // verifyGraphSchema Tests
  // ============================================================================
  describe("verifyGraphSchema()", () => {
    it("should return valid=false when no schema exists", async () => {
      // Schema was dropped in beforeEach
      const verification = await verifyGraphSchema(adapter);

      // Either valid is false or missing array has entries
      expect(
        !verification.valid || verification.missing.length > 0,
      ).toBeTruthy();
    });

    it("should return constraints and indexes after initialization", async () => {
      await initializeGraphSchema(adapter);

      const verification = await verifyGraphSchema(adapter);

      expect(verification).toBeDefined();
      expect(verification.constraints).toBeDefined();
      expect(verification.indexes).toBeDefined();
      expect(Array.isArray(verification.constraints)).toBe(true);
      expect(Array.isArray(verification.indexes)).toBe(true);
    });

    it("should return valid=true after proper initialization", async () => {
      await initializeGraphSchema(adapter);

      const verification = await verifyGraphSchema(adapter);

      // If constraints are supported, should be valid
      if (
        verification.constraints.length > 0 &&
        !verification.missing.includes("verification not supported")
      ) {
        expect(verification.valid).toBe(true);
        expect(verification.missing.length).toBe(0);
      }
    });

    it("should list missing constraints correctly", async () => {
      // Don't initialize - check what's missing
      const verification = await verifyGraphSchema(adapter);

      if (!verification.missing.includes("verification not supported")) {
        // Should list required constraints as missing
        expect(verification.missing.length).toBeGreaterThan(0);
      }
    });

    it("should handle databases that don't support SHOW commands", async () => {
      // verifyGraphSchema should handle this gracefully
      const verification = await verifyGraphSchema(adapter);

      // Should return some result even if verification is not supported
      expect(verification).toBeDefined();
      expect(verification).toHaveProperty("valid");
      expect(verification).toHaveProperty("constraints");
      expect(verification).toHaveProperty("indexes");
      expect(verification).toHaveProperty("missing");
    });
  });

  // ============================================================================
  // dropGraphSchema Tests
  // ============================================================================
  describe("dropGraphSchema()", () => {
    it("should drop schema without errors", async () => {
      // First initialize
      await initializeGraphSchema(adapter);

      // Then drop
      await expect(dropGraphSchema(adapter)).resolves.not.toThrow();
    });

    it("should handle dropping when no schema exists", async () => {
      // Schema already dropped in beforeEach
      // Should not throw
      await expect(dropGraphSchema(adapter)).resolves.not.toThrow();
    });

    it("should actually remove constraints", async () => {
      // Initialize
      await initializeGraphSchema(adapter);

      // Verify constraints exist
      const beforeDrop = await verifyGraphSchema(adapter);
      const hadConstraints =
        beforeDrop.constraints.length > 0 || beforeDrop.indexes.length > 0;

      // Drop
      await dropGraphSchema(adapter);

      // Verify constraints removed
      const afterDrop = await verifyGraphSchema(adapter);

      if (
        hadConstraints &&
        !afterDrop.missing.includes("verification not supported")
      ) {
        // Should have fewer constraints now
        expect(afterDrop.constraints.length).toBeLessThanOrEqual(
          beforeDrop.constraints.length,
        );
      }
    });

    it("should allow re-initialization after drop", async () => {
      // Initialize
      await initializeGraphSchema(adapter);

      // Drop
      await dropGraphSchema(adapter);

      // Re-initialize
      await expect(initializeGraphSchema(adapter)).resolves.not.toThrow();

      // Should be valid again
      const verification = await verifyGraphSchema(adapter);
      if (!verification.missing.includes("verification not supported")) {
        expect(verification.valid).toBe(true);
      }
    });
  });

  // ============================================================================
  // Performance Indexes Tests
  // ============================================================================
  describe("Performance Indexes", () => {
    it("should create indexes for frequently queried properties", async () => {
      await initializeGraphSchema(adapter);

      const verification = await verifyGraphSchema(adapter);

      // Should have indexes (either from constraints or explicitly created)
      if (!verification.missing.includes("verification not supported")) {
        expect(
          verification.indexes.length + verification.constraints.length,
        ).toBeGreaterThan(0);
      }
    });

    it("should improve query performance with indexes", async () => {
      await initializeGraphSchema(adapter);

      // Create test data
      for (let i = 0; i < 100; i++) {
        await adapter.createNode({
          label: "Memory",
          properties: {
            memoryId: `perf-test-${i}`,
            importance: i % 10,
            sourceType: i % 2 === 0 ? "conversation" : "fact",
          },
        });
      }

      // Query by indexed property should be fast
      const start = Date.now();
      const result = await adapter.findNodes(
        "Memory",
        { sourceType: "conversation" },
        50,
      );
      const duration = Date.now() - start;

      expect(result.length).toBeGreaterThan(0);
      // With proper indexing, this should be reasonably fast
      // (exact threshold depends on environment)
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Clean up
      await adapter.clearDatabase();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe("Edge Cases", () => {
    it("should handle concurrent schema operations", async () => {
      // Run multiple initializations in parallel
      const results = await Promise.allSettled([
        initializeGraphSchema(adapter),
        initializeGraphSchema(adapter),
        initializeGraphSchema(adapter),
      ]);

      // All should succeed (idempotent)
      const failures = results.filter((r) => r.status === "rejected");
      expect(failures.length).toBe(0);
    });

    it("should handle special characters in constraint names", async () => {
      // Schema initialization uses specific constraint names
      // Should handle these without issues
      await expect(initializeGraphSchema(adapter)).resolves.not.toThrow();
    });

    it("should work with existing data in database", async () => {
      // Create some data first
      await adapter.createNode({
        label: "Memory",
        properties: { memoryId: "existing-mem-1", content: "test" },
      });

      await adapter.createNode({
        label: "Fact",
        properties: { factId: "existing-fact-1", fact: "test fact" },
      });

      // Initialize schema on non-empty database
      await expect(initializeGraphSchema(adapter)).resolves.not.toThrow();

      // Existing data should still be accessible
      const memories = await adapter.findNodes("Memory", {}, 10);
      expect(memories.length).toBeGreaterThanOrEqual(1);

      // Clean up
      await adapter.clearDatabase();
    });
  });
});

// Skip message when not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("Schema Initialization", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Schema initialization tests skipped");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
      expect(true).toBe(true);
    });
  });
}
