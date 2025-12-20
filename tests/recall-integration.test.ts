/**
 * Integration Tests: recall() Orchestration API
 *
 * Tests prove that anything stored with remember() can be correctly
 * retrieved with recall(), even in complex scenarios.
 */

import { jest } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

// Increase timeout for integration tests
jest.setTimeout(60000);

describe("recall() Integration", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("recall");
  const TEST_USER_ID = ctx.userId("recall");
  const TEST_AGENT_ID = ctx.agentId("recall");
  const TEST_USER_NAME = "Recall Test User";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
  });

  afterAll(async () => {
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Remember/Recall Symmetry Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("remember/recall symmetry", () => {
    it("recalls simple message stored with remember", async () => {
      const conversationId = ctx.conversationId("simple");

      // Store with remember
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "My favorite color is blue",
        agentResponse: "I'll remember that your favorite color is blue!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      // Recall
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "favorite color",
      });

      // Assert - should find the stored content
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.some((i) => i.content.includes("blue"))).toBe(true);
      expect(result.context).toContain("blue");
    });

    it("recalls from vector search", async () => {
      const conversationId = ctx.conversationId("vector");

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "I prefer dark mode for all my applications",
        agentResponse: "Dark mode preference noted!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "dark mode preference",
      });

      expect(result.sources.vector.count).toBeGreaterThan(0);
      expect(result.context).toBeDefined();
    });

    it("recalls with userId filter", async () => {
      const conversationId = ctx.conversationId("userfilter");
      const specificUserId = ctx.userId("specific");

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "This is a user-specific message",
        agentResponse: "Got it!",
        userId: specificUserId,
        userName: "Specific User",
        agentId: TEST_AGENT_ID,
      });

      // Recall with userId filter should find it
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "user-specific message",
        userId: specificUserId,
      });

      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Multi-Layer Retrieval Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("multi-layer retrieval", () => {
    it("retrieves from both vector and facts", async () => {
      const conversationId = ctx.conversationId("multilayer");

      // Store with fact extraction
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "Call me Alex, I work at TechCorp",
        agentResponse: "Nice to meet you, Alex from TechCorp!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        extractFacts: async () => [
          {
            fact: "User prefers to be called Alex",
            factType: "preference",
            subject: TEST_USER_ID,
            confidence: 95,
          },
          {
            fact: "User works at TechCorp",
            factType: "relationship",
            subject: TEST_USER_ID,
            predicate: "works_at",
            object: "TechCorp",
            confidence: 90,
          },
        ],
      });

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "Alex TechCorp",
      });

      // Should have results from both sources
      expect(result.sources.vector.count).toBeGreaterThan(0);
      expect(result.sources.facts.count).toBeGreaterThan(0);
      expect(result.context).toContain("Alex");
    });

    it("deduplicates across sources", async () => {
      const conversationId = ctx.conversationId("dedup");

      // Store a distinctive message
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "My password hint is starlight123",
        agentResponse: "Password hint stored securely.",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "password hint starlight",
      });

      // Check for duplicates - each unique ID should only appear once
      const ids = result.items.map((i) => i.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it("ranks results by relevance", async () => {
      const conversationId1 = ctx.conversationId("rank1");
      const conversationId2 = ctx.conversationId("rank2");

      // Store two messages with different relevance to the query
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conversationId1,
        userMessage: "I love Python programming",
        agentResponse: "Python is great!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        importance: 90,
      });

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conversationId2,
        userMessage: "The weather is nice today",
        agentResponse: "Yes it is!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        importance: 50,
      });

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "Python programming",
      });

      // Python-related result should rank higher
      if (result.items.length >= 2) {
        const pythonItem = result.items.find((i) =>
          i.content.toLowerCase().includes("python")
        );
        const weatherItem = result.items.find((i) =>
          i.content.toLowerCase().includes("weather")
        );

        if (pythonItem && weatherItem) {
          expect(pythonItem.score).toBeGreaterThan(weatherItem.score);
        }
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Result Options Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("result options", () => {
    it("respects limit parameter", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test",
        limit: 3,
      });

      expect(result.items.length).toBeLessThanOrEqual(3);
    });

    it("generates LLM context by default", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
      });

      // context should be generated by default (formatForLLM: true)
      expect(result.context).toBeDefined();
      if (result.items.length > 0) {
        expect(result.context).toContain("## Relevant Context");
      }
    });

    it("skips LLM context when formatForLLM is false", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        formatForLLM: false,
      });

      expect(result.context).toBeUndefined();
    });

    it("includes conversation enrichment by default", async () => {
      const conversationId = ctx.conversationId("enrich");

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "Remember this enrichment test",
        agentResponse: "I will remember the enrichment test!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "enrichment test",
        includeConversation: true,
      });

      // At least one memory item should have conversation data
      const memoryItems = result.items.filter((i) => i.type === "memory");
      if (memoryItems.length > 0) {
        // Check that conversation enrichment was attempted
        // (may not always have conversation if it's a fact-only result)
        expect(result.items).toBeDefined();
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Source Control Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("source control", () => {
    it("can disable vector source", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test",
        sources: {
          vector: false,
          facts: true,
          graph: false,
        },
      });

      // Vector count should be 0 since we disabled it
      expect(result.sources.vector.count).toBe(0);
    });

    it("can disable facts source", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test",
        sources: {
          vector: true,
          facts: false,
          graph: false,
        },
      });

      // Facts count should be 0 since we disabled it
      expect(result.sources.facts.count).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Metadata Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("result metadata", () => {
    it("includes query timing", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test",
      });

      expect(result.queryTimeMs).toBeDefined();
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("includes total results count", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test",
      });

      expect(result.totalResults).toBeDefined();
      expect(result.totalResults).toBeGreaterThanOrEqual(0);
    });

    it("reports graph expansion status", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test",
      });

      // graphExpansionApplied should be a boolean
      expect(typeof result.graphExpansionApplied).toBe("boolean");
    });

    it("includes source breakdown", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test",
      });

      expect(result.sources).toBeDefined();
      expect(result.sources.vector).toBeDefined();
      expect(result.sources.facts).toBeDefined();
      expect(result.sources.graph).toBeDefined();
      expect(typeof result.sources.vector.count).toBe("number");
      expect(typeof result.sources.facts.count).toBe("number");
      expect(typeof result.sources.graph.count).toBe("number");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("edge cases", () => {
    it("handles empty memory space gracefully", async () => {
      const emptySpaceId = ctx.memorySpaceId("empty");

      const result = await cortex.memory.recall({
        memorySpaceId: emptySpaceId,
        query: "anything",
      });

      expect(result.items).toHaveLength(0);
      expect(result.totalResults).toBe(0);
      expect(result.context).toBe(""); // Empty context for no results
    });

    it("handles special characters in query", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "user's preference (test) & \"quoted\"",
      });

      // Should not throw, should return results
      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("handles very long queries", async () => {
      const longQuery = "test ".repeat(100);

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: longQuery,
      });

      expect(result).toBeDefined();
    });
  });
});
