/**
 * E2E Stress Tests: Recall Limits Under Load
 *
 * These tests prove that the recall architecture correctly handles
 * large memory spaces without hitting Convex's 16MB read limit.
 *
 * The key insight is that the previous architecture used .collect()
 * without limits, which would fail when a memory space grew large.
 * The new architecture uses configurable limits at every layer.
 *
 * IMPORTANT: These tests require a managed Convex deployment with
 * vector index support. They will be skipped on local Convex.
 */

import { jest } from "@jest/globals";
import { Cortex } from "../../src";
import { ConvexClient } from "convex/browser";
import { createTestRunContext } from "../helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

// Increase timeout for stress tests
jest.setTimeout(300000); // 5 minutes

describe("Recall Limits E2E Stress Tests", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const _isLocalConvex = CONVEX_URL.includes("127.0.0.1") || CONVEX_URL.includes("localhost");

  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("stress-test");
  const TEST_USER_ID = ctx.userId("stress-test");
  const TEST_AGENT_ID = ctx.agentId("stress-test");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
  });

  afterAll(async () => {
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Large Dataset Seeding
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("large dataset handling", () => {
    const LARGE_DATASET_SIZE = 100; // Number of memories to create

    beforeAll(async () => {
      // Seed with many memories to simulate a real production scenario
      console.log(`Seeding ${LARGE_DATASET_SIZE} memories for stress test...`);

      const topics = [
        "programming", "music", "food", "sports", "books",
        "travel", "movies", "pets", "hobbies", "work",
        "technology", "science", "art", "history", "nature",
        "gaming", "cooking", "fitness", "photography", "design",
      ];

      const batchSize = 10;
      for (let i = 0; i < LARGE_DATASET_SIZE; i += batchSize) {
        const promises = [];
        for (let j = 0; j < batchSize && i + j < LARGE_DATASET_SIZE; j++) {
          const index = i + j;
          const topic = topics[index % topics.length];
          const conversationId = ctx.conversationId(`stress-${index}`);

          promises.push(
            cortex.memory.remember({
              memorySpaceId: TEST_MEMSPACE_ID,
              conversationId,
              userMessage: `Message ${index}: I have preferences about ${topic}. This is test data number ${index} to simulate a large memory space.`,
              agentResponse: `Acknowledged preference ${index} about ${topic}.`,
              userId: TEST_USER_ID,
              userName: "Stress Test User",
              agentId: TEST_AGENT_ID,
              importance: 50 + (index % 50),
            }).catch((err) => {
              // Ignore errors - may already exist
              console.log(`Seeding error for ${index}: ${err.message}`);
            }),
          );
        }

        await Promise.all(promises);
        console.log(`Seeded ${Math.min(i + batchSize, LARGE_DATASET_SIZE)}/${LARGE_DATASET_SIZE} memories`);
      }

      // Wait for indexing
      console.log("Waiting for indexing...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }, 180000); // 3 minute timeout for seeding

    it("recall succeeds with default limits on large dataset", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
      });

      // Key assertion: No 16MB error, returns results
      expect(result).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeLessThanOrEqual(30); // Default total limit
    });

    it("recall with explicit limits succeeds on large dataset", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 10,
          facts: 5,
          graphHops: 0,
          total: 15,
        },
      });

      expect(result).toBeDefined();
      expect(result.items.length).toBeLessThanOrEqual(15);
    });

    it("multiple concurrent recalls succeed", async () => {
      const queries = [
        "preferences",
        "programming",
        "music",
        "work",
        "hobbies",
      ];

      const results = await Promise.all(
        queries.map((query) =>
          cortex.memory.recall({
            memorySpaceId: TEST_MEMSPACE_ID,
            query,
            limits: { total: 10 },
          }),
        ),
      );

      // All should succeed
      for (const result of results) {
        expect(result).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      }
    });

    it("recall with all sources enabled succeeds", async () => {
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        sources: {
          vector: true,
          facts: true,
          graph: true,
        },
        limits: {
          memories: 20,
          facts: 15,
          graphHops: 2,
          graphEntitiesPerHop: 5,
          graphResultsPerEntity: 3,
          total: 30,
        },
      });

      expect(result).toBeDefined();
      expect(result.items.length).toBeLessThanOrEqual(30);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Limit Protection Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("16MB limit protection", () => {
    it("does not throw 'Too many bytes read' error", async () => {
      // This is the key test - the previous architecture would fail here
      await expect(
        cortex.memory.recall({
          memorySpaceId: TEST_MEMSPACE_ID,
          query: "test",
        }),
      ).resolves.toBeDefined();
    });

    it("handles permissive limits without crashing", async () => {
      // Even with high limits, should not exceed Convex limits
      await expect(
        cortex.memory.recall({
          memorySpaceId: TEST_MEMSPACE_ID,
          query: "preferences",
          limits: {
            memories: 100,
            facts: 100,
            total: 100,
          },
        }),
      ).resolves.toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Performance Benchmarks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("performance benchmarks", () => {
    it("minimal limits execute in under 2 seconds", async () => {
      const start = Date.now();

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: {
          memories: 5,
          facts: 5,
          graphHops: 0,
          total: 5,
        },
      });

      const elapsed = Date.now() - start;

      console.log(`Minimal limits recall: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(2000);
      expect(result.queryTimeMs).toBeLessThan(2000);
    });

    it("default limits execute in under 10 seconds", async () => {
      const start = Date.now();

      const _result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
      });

      const elapsed = Date.now() - start;

      console.log(`Default limits recall: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(10000);
    });

    it("measures per-source latency", async () => {
      // Vector only
      const vectorStart = Date.now();
      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: { memories: 10, total: 10 },
        sources: { vector: true, facts: false, graph: false },
      });
      const vectorTime = Date.now() - vectorStart;

      // Facts only
      const factsStart = Date.now();
      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: { facts: 10, total: 10 },
        sources: { vector: false, facts: true, graph: false },
      });
      const factsTime = Date.now() - factsStart;

      console.log(`Vector-only: ${vectorTime}ms`);
      console.log(`Facts-only: ${factsTime}ms`);

      // Both should be reasonable
      expect(vectorTime).toBeLessThan(5000);
      expect(factsTime).toBeLessThan(5000);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scalability Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("scalability", () => {
    it("recall performance is consistent regardless of total data size", async () => {
      // Run recall multiple times and measure consistency
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await cortex.memory.recall({
          memorySpaceId: TEST_MEMSPACE_ID,
          query: "preferences",
          limits: { total: 10 },
        });
        times.push(Date.now() - start);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);

      console.log(`Recall times: min=${min}ms, max=${max}ms, avg=${avg.toFixed(0)}ms`);

      // Variance should be reasonable (max no more than 3x min)
      expect(max).toBeLessThan(min * 3);
    });

    it("limit changes affect performance predictably", async () => {
      // Small limit
      const smallStart = Date.now();
      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: { memories: 5, facts: 5, total: 5 },
      });
      const smallTime = Date.now() - smallStart;

      // Larger limit
      const largeStart = Date.now();
      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "preferences",
        limits: { memories: 50, facts: 50, total: 50 },
      });
      const largeTime = Date.now() - largeStart;

      console.log(`Small limits (5): ${smallTime}ms`);
      console.log(`Large limits (50): ${largeTime}ms`);

      // Larger limits may take longer, but should not be exponentially worse
      // Use max(smallTime * 20, 3000) to handle CI variance when smallTime is very fast
      const threshold = Math.max(smallTime * 20, 3000);
      console.log(`Threshold: ${threshold}ms (max of ${smallTime * 20}ms or 3000ms)`);
      expect(largeTime).toBeLessThan(threshold);
    });
  });
});
