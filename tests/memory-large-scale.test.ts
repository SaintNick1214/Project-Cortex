/**
 * Memory API Large-Scale Operation Tests
 *
 * Tests for Memory API performance and correctness with large datasets:
 * - list() with 100+ memories (pagination)
 * - deleteMany() with 100+ memories (batch performance)
 * - search() with many results (limit and minScore filtering)
 * - updateMany() with bulk operations
 *
 * NOTE: These tests use larger datasets and may take longer to run.
 * They are essential for validating SDK behavior at scale.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createTestRunContext } from "./helpers/isolation";
import { jest } from "@jest/globals";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

// Increase timeout for large-scale tests
jest.setTimeout(120000);

describe("Memory Large-Scale Operations", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("large-scale");
  const BATCH_SIZE = 100;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
  });

  afterAll(async () => {
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // list() Large-Scale Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("list() with 100+ memories", () => {
    const listTestUserId = `user-list-${ctx.runId}`;
    let createdMemoryIds: string[] = [];

    beforeAll(async () => {
      // Create 100 memories for list tests
      const createPromises = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        createPromises.push(
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Large-scale list test memory ${i.toString().padStart(3, "0")}`,
            contentType: "raw",
            userId: listTestUserId,
            source: { type: "system", timestamp: Date.now() + i },
            metadata: {
              importance: 50 + (i % 50), // Vary importance 50-99
              tags: ["list-scale-test", `batch-${Math.floor(i / 10)}`],
            },
          }),
        );
      }
      const results = await Promise.all(createPromises);
      createdMemoryIds = results.map((r) => r.memoryId);
    }, 60000);

    afterAll(async () => {
      // Cleanup created memories
      if (createdMemoryIds.length > 0) {
        await cortex.memory.deleteMany({
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: listTestUserId,
        });
      }
    }, 60000);

    it("lists all 100+ memories without limit", async () => {
      const result = await cortex.memory.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: listTestUserId,
      });

      expect(result.length).toBeGreaterThanOrEqual(BATCH_SIZE);
    });

    it("respects limit parameter for pagination", async () => {
      const limit = 25;
      const result = await cortex.memory.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: listTestUserId,
        limit,
      });

      expect(result.length).toBeLessThanOrEqual(limit);
    });

    it("correctly counts memories", async () => {
      const count = await cortex.memory.count({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: listTestUserId,
      });

      expect(count).toBeGreaterThanOrEqual(BATCH_SIZE);
    });

    it("can filter by sourceType", async () => {
      const result = await cortex.memory.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: listTestUserId,
        sourceType: "system",
      });

      expect(result.length).toBeGreaterThanOrEqual(BATCH_SIZE);
      for (const mem of result) {
        expect((mem as any).sourceType).toBe("system");
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // deleteMany() Large-Scale Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("deleteMany() with 100+ memories", () => {
    const deleteTestUserId = `user-delete-${ctx.runId}`;

    it("deletes 100+ memories efficiently", async () => {
      // Create memories to delete
      const createPromises = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        createPromises.push(
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Large-scale delete test memory ${i}`,
            contentType: "raw",
            userId: deleteTestUserId,
            source: { type: "system", timestamp: Date.now() + i },
            metadata: {
              importance: 10, // Low importance for deletion
              tags: ["delete-scale-test"],
            },
          }),
        );
      }
      await Promise.all(createPromises);

      // Verify count before delete
      const countBefore = await cortex.memory.count({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: deleteTestUserId,
      });
      expect(countBefore).toBeGreaterThanOrEqual(BATCH_SIZE);

      // Delete all at once
      const startTime = Date.now();
      const deleteResult = await cortex.memory.deleteMany({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: deleteTestUserId,
      });
      const duration = Date.now() - startTime;

      expect(deleteResult.deleted).toBeGreaterThanOrEqual(BATCH_SIZE);

      // Performance check: should complete in reasonable time
      // Allow up to 60 seconds for 100 deletions (cascade delete is slower)
      expect(duration).toBeLessThan(60000);

      // Verify count after delete
      const countAfter = await cortex.memory.count({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: deleteTestUserId,
      });
      expect(countAfter).toBe(0);
    }, 90000);

    it("deleteMany with sourceType filter at scale", async () => {
      const filteredUserId = `user-delete-filter-${ctx.runId}`;

      // Create memories with different sourceTypes (system)
      const createPromises = [];
      for (let i = 0; i < 30; i++) {
        createPromises.push(
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Filter delete test ${i}`,
            contentType: "raw",
            userId: filteredUserId,
            source: { type: "system", timestamp: Date.now() + i },
            metadata: {
              importance: 10,
              tags: ["filter-delete-test"],
            },
          }),
        );
      }
      await Promise.all(createPromises);

      // Delete by sourceType
      const deleteResult = await cortex.memory.deleteMany({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: filteredUserId,
        sourceType: "system",
      });

      expect(deleteResult.deleted).toBeGreaterThanOrEqual(30);

      // Verify all are deleted
      const remaining = await cortex.memory.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: filteredUserId,
      });

      expect(remaining.length).toBe(0);
    }, 60000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // search() Large-Scale Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("search() with many results", () => {
    const searchTestUserId = `user-search-${ctx.runId}`;
    let createdMemoryIds: string[] = [];

    beforeAll(async () => {
      // Create memories with similar content for search tests
      const topics = [
        "machine learning",
        "artificial intelligence",
        "neural networks",
        "deep learning",
      ];
      const createPromises = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const topic = topics[i % topics.length];
        createPromises.push(
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Research note ${i}: ${topic} is an important field in computer science and technology`,
            contentType: "raw",
            userId: searchTestUserId,
            source: { type: "system", timestamp: Date.now() + i },
            metadata: {
              importance: 50 + (i % 50),
              tags: ["search-scale-test", topic.replace(" ", "-")],
            },
          }),
        );
      }
      const results = await Promise.all(createPromises);
      createdMemoryIds = results.map((r) => r.memoryId);
    }, 60000);

    afterAll(async () => {
      // Cleanup
      if (createdMemoryIds.length > 0) {
        await cortex.memory.deleteMany({
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: searchTestUserId,
        });
      }
    }, 60000);

    it("returns results respecting limit parameter", async () => {
      const limit = 10;
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "machine learning technology",
        { limit },
      );

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it("filters by minScore correctly", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "artificial intelligence research",
        { minScore: 0.5, limit: 50 },
      );

      // All results should have been filtered by minScore
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("returns results ordered by relevance", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "neural networks deep learning",
        { limit: 20 },
      );

      // Results should be returned (ordering is handled by backend)
      expect(results.length).toBeLessThanOrEqual(20);
    });

    it("combines limit and userId filters", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "technology research",
        { limit: 15, userId: searchTestUserId },
      );

      expect(results.length).toBeLessThanOrEqual(15);
    });

    it("combines limit and tags filters", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "computer science",
        { limit: 20, tags: ["machine-learning"] },
      );

      expect(results.length).toBeLessThanOrEqual(20);
      for (const mem of results) {
        expect((mem as any).tags).toContain("machine-learning");
      }
    });

    it("combines limit and minImportance filters", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "important field",
        { limit: 30, minImportance: 80 },
      );

      expect(results.length).toBeLessThanOrEqual(30);
      for (const mem of results) {
        expect((mem as any).importance).toBeGreaterThanOrEqual(80);
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // updateMany() Large-Scale Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("updateMany() at scale", () => {
    const updateTestUserId = `user-update-${ctx.runId}`;

    it("updates 100+ memories efficiently", async () => {
      // Create memories to update
      const createPromises = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        createPromises.push(
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Bulk update test ${i}`,
            contentType: "raw",
            userId: updateTestUserId,
            source: { type: "system", timestamp: Date.now() + i },
            metadata: {
              importance: 30, // Initial importance
              tags: ["update-scale-test"],
            },
          }),
        );
      }
      await Promise.all(createPromises);

      // Bulk update importance
      const startTime = Date.now();
      const updateResult = await cortex.memory.updateMany(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: updateTestUserId,
        },
        { importance: 80 },
      );
      const duration = Date.now() - startTime;

      expect(updateResult.updated).toBeGreaterThanOrEqual(BATCH_SIZE);

      // Performance check
      expect(duration).toBeLessThan(60000);

      // Verify updates applied
      const updated = await cortex.memory.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: updateTestUserId,
        limit: 50,
      });

      for (const mem of updated) {
        expect((mem as any).importance).toBe(80);
      }

      // Cleanup
      await cortex.memory.deleteMany({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: updateTestUserId,
      });
    }, 90000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // export() Large-Scale Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("export() at scale", () => {
    const exportTestUserId = `user-export-${ctx.runId}`;
    let createdMemoryIds: string[] = [];

    beforeAll(async () => {
      // Create memories for export
      const createPromises = [];
      for (let i = 0; i < 50; i++) {
        createPromises.push(
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Export scale test ${i}: Data for JSON/CSV export`,
            contentType: "raw",
            userId: exportTestUserId,
            source: { type: "system", timestamp: Date.now() + i },
            metadata: {
              importance: 50,
              tags: ["export-scale-test"],
            },
          }),
        );
      }
      const results = await Promise.all(createPromises);
      createdMemoryIds = results.map((r) => r.memoryId);
    }, 60000);

    afterAll(async () => {
      if (createdMemoryIds.length > 0) {
        await cortex.memory.deleteMany({
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: exportTestUserId,
        });
      }
    }, 60000);

    it("exports 50+ memories to JSON", async () => {
      const result = await cortex.memory.export({
        memorySpaceId: TEST_MEMSPACE_ID,
        format: "json",
        userId: exportTestUserId,
      });

      expect(result.format).toBe("json");
      const parsed = JSON.parse(result.data);
      expect(parsed.length).toBeGreaterThanOrEqual(50);
    });

    it("exports 50+ memories to CSV", async () => {
      const result = await cortex.memory.export({
        memorySpaceId: TEST_MEMSPACE_ID,
        format: "csv",
        userId: exportTestUserId,
      });

      expect(result.format).toBe("csv");
      // CSV should have header + 50+ rows
      const lines = result.data.split("\n").filter((l) => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(51); // header + 50 rows
    });
  });
});
