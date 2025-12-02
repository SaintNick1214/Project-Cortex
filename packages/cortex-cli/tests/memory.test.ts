/**
 * CLI Memory Commands Integration Tests
 *
 * Tests CLI commands against a real Convex instance
 */

import { Cortex } from "@cortexmemory/sdk";
import { cleanupTestData } from "./setup";

describe("CLI Memory Commands", () => {
  let cortex: Cortex;
  const CONVEX_URL = process.env.CONVEX_URL!;
  const TIMESTAMP = Date.now();
  const TEST_PREFIX = `cli-test-memory-${TIMESTAMP}`;
  const TEST_SPACE_ID = `${TEST_PREFIX}-space`;
  const TEST_USER_ID = `${TEST_PREFIX}-user`;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });

    // Clean up any leftover test data
    await cleanupTestData(TEST_PREFIX);
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    try {
      // Clean up test data
      await cleanupTestData(TEST_PREFIX);
    } finally {
      // Ensure client is closed even if cleanup fails
      try {
        cortex.close();
      } catch (error) {
        console.warn('⚠️  Error closing cortex client:', error);
      }
    }
  }, 60000); // 60 second timeout for cleanup

  describe("memory operations via SDK (underlying CLI operations)", () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create test memory space
      await cortex.memorySpaces.register({
        memorySpaceId: TEST_SPACE_ID,
        name: "CLI Test Space",
        type: "project",
      });

      // Create a conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_SPACE_ID,
        participants: { userId: TEST_USER_ID, participantId: "agent-cli-test" },
      });

      testConversationId = conv.conversationId;
    });

    describe("memory list", () => {
      beforeAll(async () => {
        // Create some test memories
        await cortex.memory.remember({
          memorySpaceId: TEST_SPACE_ID,
          conversationId: testConversationId,
          userMessage: "CLI test message 1",
          agentResponse: "Response 1",
          userId: TEST_USER_ID,
          userName: "Test User",
        });

        await cortex.memory.remember({
          memorySpaceId: TEST_SPACE_ID,
          conversationId: testConversationId,
          userMessage: "CLI test message 2",
          agentResponse: "Response 2",
          userId: TEST_USER_ID,
          userName: "Test User",
        });
      });

      it("should list memories in a space", async () => {
        const memories = await cortex.memory.list({
          memorySpaceId: TEST_SPACE_ID,
          limit: 50,
        });

        expect(memories.length).toBeGreaterThanOrEqual(4); // 2 user + 2 agent messages
      });

      it("should filter by userId", async () => {
        const memories = await cortex.memory.list({
          memorySpaceId: TEST_SPACE_ID,
          userId: TEST_USER_ID,
        });

        expect(memories.length).toBeGreaterThan(0);
        memories.forEach((m) => {
          expect(m.userId).toBe(TEST_USER_ID);
        });
      });

      it("should respect limit parameter", async () => {
        const memories = await cortex.memory.list({
          memorySpaceId: TEST_SPACE_ID,
          limit: 2,
        });

        expect(memories.length).toBeLessThanOrEqual(2);
      });
    });

    describe("memory search", () => {
      beforeAll(async () => {
        // Create a specific memory to search for
        await cortex.vector.store(TEST_SPACE_ID, {
          content: "The secret password is Hunter2",
          contentType: "raw",
          userId: TEST_USER_ID,
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 100, tags: ["password", "secret"] },
        });
      });

      it("should search memories by content", async () => {
        const results = await cortex.memory.search(TEST_SPACE_ID, "password");

        expect(results.length).toBeGreaterThan(0);
        // At least one result should contain password-related content
        const hasPassword = results.some(
          (r: any) =>
            r.content?.toLowerCase().includes("password") ||
            r.tags?.includes("password"),
        );
        expect(hasPassword).toBe(true);
      });

      it("should filter search by userId", async () => {
        const results = await cortex.memory.search(TEST_SPACE_ID, "test", {
          userId: TEST_USER_ID,
        });

        results.forEach((r: any) => {
          expect(r.userId).toBe(TEST_USER_ID);
        });
      });
    });

    describe("memory count", () => {
      it("should count memories in a space", async () => {
        const count = await cortex.memory.count({
          memorySpaceId: TEST_SPACE_ID,
        });

        expect(typeof count).toBe("number");
        expect(count).toBeGreaterThan(0);
      });

      it("should count by userId", async () => {
        const count = await cortex.memory.count({
          memorySpaceId: TEST_SPACE_ID,
          userId: TEST_USER_ID,
        });

        expect(count).toBeGreaterThan(0);
      });
    });

    describe("memory get", () => {
      let testMemoryId: string;

      beforeAll(async () => {
        const stored = await cortex.vector.store(TEST_SPACE_ID, {
          content: "Memory to get",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: ["test"] },
        });
        testMemoryId = stored.memoryId;
      });

      it("should get a specific memory", async () => {
        const memory = await cortex.memory.get(TEST_SPACE_ID, testMemoryId);

        expect(memory).not.toBeNull();
        expect(
          (memory as any).memoryId || (memory as any).memory?.memoryId,
        ).toBe(testMemoryId);
      });

      it("should return null for non-existent memory", async () => {
        const memory = await cortex.memory.get(
          TEST_SPACE_ID,
          "non-existent-id",
        );

        expect(memory).toBeNull();
      });
    });

    describe("memory delete", () => {
      it("should delete a memory", async () => {
        // Create memory to delete
        const stored = await cortex.vector.store(TEST_SPACE_ID, {
          content: "Memory to delete",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: ["delete-test"] },
        });

        const result = await cortex.memory.delete(
          TEST_SPACE_ID,
          stored.memoryId,
        );

        expect(result.deleted).toBe(true);

        // Verify deleted
        const deleted = await cortex.vector.get(TEST_SPACE_ID, stored.memoryId);
        expect(deleted).toBeNull();
      });
    });

    describe("memory clear (deleteMany)", () => {
      beforeAll(async () => {
        // Create memories to clear
        for (let i = 0; i < 3; i++) {
          await cortex.vector.store(TEST_SPACE_ID, {
            content: `Clear test memory ${i}`,
            contentType: "raw",
            userId: `${TEST_PREFIX}-clear-user`,
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 50, tags: ["clear-test"] },
          });
        }
      });

      it("should delete multiple memories by filter", async () => {
        const result = await cortex.memory.deleteMany({
          memorySpaceId: TEST_SPACE_ID,
          userId: `${TEST_PREFIX}-clear-user`,
        });

        expect(result.deleted).toBeGreaterThanOrEqual(3);
      });
    });

    describe("memory stats", () => {
      it("should return memory statistics", async () => {
        // Get counts
        const totalCount = await cortex.memory.count({
          memorySpaceId: TEST_SPACE_ID,
        });

        expect(typeof totalCount).toBe("number");
        expect(totalCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe("memory export", () => {
      it("should export memories to JSON", async () => {
        const result = await cortex.memory.export({
          memorySpaceId: TEST_SPACE_ID,
          format: "json",
        });

        expect(result.format).toBe("json");
        expect(typeof result.data).toBe("string");
        expect(typeof result.count).toBe("number");

        // Should be valid JSON
        const parsed = JSON.parse(result.data);
        expect(Array.isArray(parsed)).toBe(true);
      });

      it("should export memories to CSV", async () => {
        const result = await cortex.memory.export({
          memorySpaceId: TEST_SPACE_ID,
          format: "csv",
        });

        expect(result.format).toBe("csv");
        expect(typeof result.data).toBe("string");
        // CSV should have headers
        expect(result.data.includes(",")).toBe(true);
      });
    });

    describe("memory archive and restore", () => {
      let archiveMemoryId: string;

      beforeAll(async () => {
        const stored = await cortex.vector.store(TEST_SPACE_ID, {
          content: "Memory to archive",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 80, tags: ["archive-test"] },
        });
        archiveMemoryId = stored.memoryId;
      });

      it("should archive a memory", async () => {
        const result = await cortex.memory.archive(
          TEST_SPACE_ID,
          archiveMemoryId,
        );

        expect(result.archived).toBe(true);

        // Verify archived
        const memory = await cortex.vector.get(TEST_SPACE_ID, archiveMemoryId);
        expect(memory?.tags).toContain("archived");
      });

      it("should restore an archived memory", async () => {
        const result = await cortex.memory.restoreFromArchive(
          TEST_SPACE_ID,
          archiveMemoryId,
        );

        expect(result.restored).toBe(true);

        // Verify restored
        const memory = await cortex.vector.get(TEST_SPACE_ID, archiveMemoryId);
        expect(memory?.tags).not.toContain("archived");
      });
    });
  });
});
