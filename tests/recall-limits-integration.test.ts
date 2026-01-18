/**
 * Integration Tests: Recall Limits
 *
 * Tests that recall() properly enforces limits across all layers.
 * These tests use a real Convex backend to verify end-to-end behavior.
 */

import { jest } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

// Increase timeout for integration tests
jest.setTimeout(120000);

describe("Recall Limits Integration", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("recall-limits");
  const TEST_USER_ID = ctx.userId("recall-limits");
  const TEST_AGENT_ID = ctx.agentId("recall-limits");
  const TEST_USER_NAME = "Recall Limits Test User";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);

    // Seed the memory space with test data
    await seedTestData();
  });

  afterAll(async () => {
    await client.close();
  });

  /**
   * Seed the memory space with enough data to test limits
   */
  async function seedTestData() {
    // Create multiple conversations with different content
    const topics = [
      { topic: "programming", content: "I love programming in TypeScript" },
      { topic: "music", content: "My favorite music genre is jazz" },
      { topic: "food", content: "I prefer Italian food over other cuisines" },
      { topic: "sports", content: "I enjoy playing tennis on weekends" },
      { topic: "books", content: "I read science fiction novels" },
      { topic: "travel", content: "I want to visit Japan next year" },
      { topic: "movies", content: "I watch documentary films" },
      { topic: "pets", content: "I have a golden retriever named Max" },
      { topic: "hobbies", content: "I collect vintage vinyl records" },
      { topic: "work", content: "I work as a software engineer at TechCorp" },
    ];

    for (const { topic, content } of topics) {
      const conversationId = ctx.conversationId(`limits-${topic}`);
      try {
        await cortex.memory.remember({
          memorySpaceId: TEST_MEMSPACE_ID,
          conversationId,
          userMessage: content,
          agentResponse: `Got it! I'll remember your ${topic} preference.`,
          userId: TEST_USER_ID,
          userName: TEST_USER_NAME,
          agentId: TEST_AGENT_ID,
          importance: 80,
        });
      } catch {
        // Ignore errors during seeding (may already exist)
      }
    }

    // Wait for data to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Total Limit Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("limits.total enforcement", () => {
    it("returns at most limits.total results", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences hobbies interests",
        limits: {
          total: 3,
        },
      });

      expect(result.items.length).toBeLessThanOrEqual(3);
    });

    it("returns at most limits.total=1 result", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          total: 1,
        },
      });

      expect(result.items.length).toBeLessThanOrEqual(1);
    });

    it("backward compatible: legacy limit param works", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limit: 2,
      });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });

    it("limits.total takes precedence over legacy limit", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limit: 100, // Legacy - should be ignored
        limits: {
          total: 2, // Should take precedence
        },
      });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Per-Source Limit Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("per-source limits", () => {
    it("limits.memories caps vector search results", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 2,
          total: 100, // High total so it doesn't interfere
        },
        sources: {
          vector: true,
          facts: false,
          graph: false,
        },
      });

      expect(result.sources.vector.count).toBeLessThanOrEqual(2);
    });

    it("limits.facts caps facts search results", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          facts: 2,
          total: 100,
        },
        sources: {
          vector: false,
          facts: true,
          graph: false,
        },
      });

      expect(result.sources.facts.count).toBeLessThanOrEqual(2);
    });

    it("different per-source limits work together", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 3,
          facts: 2,
          total: 10,
        },
        sources: {
          vector: true,
          facts: true,
          graph: false,
        },
      });

      expect(result.sources.vector.count).toBeLessThanOrEqual(3);
      expect(result.sources.facts.count).toBeLessThanOrEqual(2);
      expect(result.items.length).toBeLessThanOrEqual(10);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Graph Limit Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("graph limits", () => {
    it("graphHops: 0 disables graph expansion", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          graphHops: 0,
        },
      });

      expect(result.graphExpansionApplied).toBe(false);
      expect(result.sources.graph.count).toBe(0);
    });

    it("graphHops: 1 limits traversal depth", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          graphHops: 1,
        },
      });

      // Should not throw, should return valid result
      expect(result).toBeDefined();
      expect(typeof result.graphExpansionApplied).toBe("boolean");
    });

    it("graphEntitiesPerHop limits entity expansion", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          graphHops: 2,
          graphEntitiesPerHop: 1, // Only expand 1 entity per hop
        },
      });

      // Should not throw, should return valid result
      expect(result).toBeDefined();
    });

    it("graphResultsPerEntity limits results per entity", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          graphHops: 2,
          graphResultsPerEntity: 1, // Only 1 result per entity
        },
      });

      // Should not throw, should return valid result
      expect(result).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Combined Limit Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("combined limits", () => {
    it("all limits work together", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 5,
          facts: 3,
          graphHops: 1,
          graphEntitiesPerHop: 2,
          graphResultsPerEntity: 1,
          total: 8,
        },
      });

      expect(result.items.length).toBeLessThanOrEqual(8);
      expect(result.sources.vector.count).toBeLessThanOrEqual(5);
      expect(result.sources.facts.count).toBeLessThanOrEqual(3);
    });

    it("restrictive limits produce small results", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 1,
          facts: 1,
          graphHops: 0, // Disabled
          total: 2,
        },
      });

      expect(result.items.length).toBeLessThanOrEqual(2);
      expect(result.totalResults).toBeLessThanOrEqual(2);
    });

    it("permissive limits still bounded by available data", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 1000,
          facts: 1000,
          graphHops: 5,
          graphEntitiesPerHop: 100,
          graphResultsPerEntity: 100,
          total: 10000,
        },
      });

      // Should return whatever is available, not fail
      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Performance Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("performance with limits", () => {
    it("small limits execute quickly", async () => {
      const start = Date.now();

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 2,
          facts: 2,
          graphHops: 0,
          total: 4,
        },
      });

      const elapsed = Date.now() - start;

      // Should complete in under 5 seconds with small limits
      expect(elapsed).toBeLessThan(5000);
      expect(result.queryTimeMs).toBeDefined();
    });

    it("queryTimeMs is reported correctly", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          total: 5,
        },
      });

      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.queryTimeMs).toBeLessThan(60000); // Under 1 minute
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("edge cases", () => {
    it("handles limits of 0 gracefully", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 0,
          facts: 0,
          graphHops: 0,
          total: 0,
        },
      });

      // Should not throw, should return empty or minimal results
      expect(result).toBeDefined();
      expect(result.items.length).toBe(0);
    });

    it("handles empty memory space with limits", async () => {
      const emptySpaceId = ctx.memorySpaceId("empty-limits");

      const result = await cortex.memory.recall({
        memorySpaceId: emptySpaceId,
        query: "anything",
        limits: {
          total: 100,
        },
      });

      expect(result.items).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    it("limits do not cause errors on no-match queries", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "xyzzynonexistentquery12345",
        limits: {
          memories: 10,
          facts: 10,
          total: 20,
        },
      });

      // Should not throw, should return empty results
      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });
  });
});
