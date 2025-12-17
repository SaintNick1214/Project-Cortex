/**
 * Memory Workflow E2E Tests
 *
 * End-to-end tests for memory operations against a real Convex backend.
 * These tests require CONVEX_URL to be set.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "@cortexmemory/sdk";
import { cleanupTestData } from "../setup.js";

// Skip these tests if no Convex URL is configured
const CONVEX_URL = process.env.CONVEX_URL;
const describeE2E = CONVEX_URL ? describe : describe.skip;

describeE2E("Memory Workflow E2E", () => {
  let cortex: Cortex;
  const TIMESTAMP = Date.now();
  const TEST_PREFIX = `e2e-memory-${TIMESTAMP}`;
  const TEST_SPACE_ID = `${TEST_PREFIX}-space`;
  const TEST_USER_ID = `${TEST_PREFIX}-user`;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL! });

    // Clean up any leftover test data
    await cleanupTestData(TEST_PREFIX);

    // Create test space
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_SPACE_ID,
      name: "E2E Memory Test Space",
      type: "project",
    });
  }, 60000);

  afterAll(async () => {
    try {
      await cleanupTestData(TEST_PREFIX);
    } finally {
      cortex.close();
    }
  }, 60000);

  describe("Full Memory Lifecycle", () => {
    let testMemoryId: string;
    let conversationId: string;

    it("should create a conversation for memory storage", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_SPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: "e2e-test-agent",
          participantId: "e2e-test-agent",
        },
      });

      conversationId = conv.conversationId;
      expect(conversationId).toBeDefined();
    });

    it("should store memory via remember", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_SPACE_ID,
        conversationId,
        userMessage: "My favorite color is blue",
        agentResponse: "I'll remember that you like blue!",
        userId: TEST_USER_ID,
        agentId: "e2e-test-agent",
        userName: "E2E Test User",
      });

      expect(result).toBeDefined();
    });

    it("should store memory via vector store", async () => {
      const result = await cortex.vector.store(TEST_SPACE_ID, {
        content: "E2E test memory content for searching",
        contentType: "raw",
        userId: TEST_USER_ID,
        source: { type: "system", timestamp: Date.now() },
        metadata: {
          importance: 75,
          tags: ["e2e-test", "searchable"],
        },
      });

      testMemoryId = result.memoryId;
      expect(testMemoryId).toBeDefined();
    });

    it("should list memories in space", async () => {
      const memories = await cortex.memory.list({
        memorySpaceId: TEST_SPACE_ID,
        limit: 50,
      });

      expect(memories.length).toBeGreaterThan(0);
    });

    it("should filter memories by user", async () => {
      const memories = await cortex.memory.list({
        memorySpaceId: TEST_SPACE_ID,
        userId: TEST_USER_ID,
        limit: 50,
      });

      expect(memories.length).toBeGreaterThan(0);
      memories.forEach((m) => {
        const memory = "memory" in m ? m.memory : m;
        expect(memory.userId).toBe(TEST_USER_ID);
      });
    });

    it("should search memories by content", async () => {
      // Wait a moment for vector indexing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const results = await cortex.memory.search(TEST_SPACE_ID, "test searchable");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should get a specific memory", async () => {
      const memory = await cortex.memory.get(TEST_SPACE_ID, testMemoryId);

      expect(memory).not.toBeNull();
      expect((memory as any)?.memoryId || (memory as any)?.memory?.memoryId).toBe(testMemoryId);
    });

    it("should return null for non-existent memory", async () => {
      const memory = await cortex.memory.get(TEST_SPACE_ID, "nonexistent-memory-id");

      expect(memory).toBeNull();
    });

    it("should count memories in space", async () => {
      const count = await cortex.memory.count({
        memorySpaceId: TEST_SPACE_ID,
      });

      expect(count).toBeGreaterThan(0);
    });

    it("should export memories to JSON", async () => {
      const result = await cortex.memory.export({
        memorySpaceId: TEST_SPACE_ID,
        format: "json",
      });

      expect(result.format).toBe("json");
      expect(typeof result.data).toBe("string");

      const parsed = JSON.parse(result.data);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("should export memories to CSV", async () => {
      const result = await cortex.memory.export({
        memorySpaceId: TEST_SPACE_ID,
        format: "csv",
      });

      expect(result.format).toBe("csv");
      expect(result.data.includes(",")).toBe(true);
    });

    it("should archive a memory", async () => {
      const result = await cortex.memory.archive(TEST_SPACE_ID, testMemoryId);

      expect(result.archived).toBe(true);

      // Verify archived
      const memory = await cortex.vector.get(TEST_SPACE_ID, testMemoryId);
      expect(memory?.tags).toContain("archived");
    });

    it("should restore an archived memory", async () => {
      const result = await cortex.memory.restoreFromArchive(TEST_SPACE_ID, testMemoryId);

      expect(result.restored).toBe(true);

      // Verify restored
      const memory = await cortex.vector.get(TEST_SPACE_ID, testMemoryId);
      expect(memory?.tags).not.toContain("archived");
    });

    it("should delete a specific memory", async () => {
      // Create a memory to delete
      const stored = await cortex.vector.store(TEST_SPACE_ID, {
        content: "Memory to be deleted",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["delete-test"] },
      });

      const result = await cortex.memory.delete(TEST_SPACE_ID, stored.memoryId);

      expect(result.deleted).toBe(true);

      // Verify deleted
      const deleted = await cortex.vector.get(TEST_SPACE_ID, stored.memoryId);
      expect(deleted).toBeNull();
    });

    it("should delete multiple memories by filter", async () => {
      // Create memories to delete
      const deleteUserId = `${TEST_PREFIX}-delete-user`;
      for (let i = 0; i < 3; i++) {
        await cortex.vector.store(TEST_SPACE_ID, {
          content: `Bulk delete memory ${i}`,
          contentType: "raw",
          userId: deleteUserId,
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: ["bulk-delete"] },
        });
      }

      const result = await cortex.memory.deleteMany({
        memorySpaceId: TEST_SPACE_ID,
        userId: deleteUserId,
      });

      expect(result.deleted).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty search results", async () => {
      const results = await cortex.memory.search(
        TEST_SPACE_ID,
        "xyznonexistentquery12345"
      );

      expect(results).toEqual([]);
    });

    it("should handle search with special characters", async () => {
      const results = await cortex.memory.search(
        TEST_SPACE_ID,
        "query with special chars: @#$%"
      );

      // Should not throw
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle large content storage", async () => {
      const largeContent = "A".repeat(10000);

      const result = await cortex.vector.store(TEST_SPACE_ID, {
        content: largeContent,
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["large-content"] },
      });

      expect(result.memoryId).toBeDefined();

      // Clean up
      await cortex.memory.delete(TEST_SPACE_ID, result.memoryId);
    });
  });
});
