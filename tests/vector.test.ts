/**
 * E2E Tests: Vector Memory API (Layer 2)
 *
 * Tests validate:
 * - SDK API calls
 * - Convex mutations/queries
 * - Storage validation
 * - Semantic search
 * - Agent isolation
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup } from "./helpers";

describe("Vector Memory API (Layer 2)", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL not set");
    }

    cortex = new Cortex({ convexUrl });
    client = new ConvexClient(convexUrl);
    cleanup = new TestCleanup(client);

    // Clean all test data before tests
    await cleanup.purgeAll();
  });

  afterAll(async () => {
    await cleanup.purgeAll();
    await client.close();
  });

  describe("store()", () => {
    it("stores memory without embedding (keyword search only)", async () => {
      const result = await cortex.vector.store("agent-store", {
        content: "User prefers dark mode",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 60,
          tags: ["preferences", "ui"],
        },
      });

      expect(result.memoryId).toMatch(/^mem-/);
      expect(result.agentId).toBe("agent-store");
      expect(result.content).toBe("User prefers dark mode");
      expect(result.embedding).toBeUndefined();
      expect(result.importance).toBe(60);
      expect(result.tags).toContain("preferences");
      expect(result.version).toBe(1);
      expect(result.previousVersions).toEqual([]);
    });

    it("stores memory with embedding (semantic search)", async () => {
      // Mock embedding (1536 dimensions)
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

      const result = await cortex.vector.store("agent-store", {
        content: "User password is Blue123",
        contentType: "raw",
        embedding: mockEmbedding,
        source: { type: "conversation", userId: "user-1" },
        metadata: {
          importance: 90,
          tags: ["password", "security"],
        },
      });

      expect(result.embedding).toHaveLength(1536);
      expect(result.sourceType).toBe("conversation");
      expect(result.sourceUserId).toBe("user-1");
    });

    it("stores memory with conversationRef", async () => {
      const result = await cortex.vector.store("agent-store", {
        content: "User asked about refunds",
        contentType: "summarized",
        source: { type: "conversation", userId: "user-1" },
        conversationRef: {
          conversationId: "conv-123",
          messageIds: ["msg-1", "msg-2"],
        },
        metadata: {
          importance: 70,
          tags: ["refunds"],
        },
      });

      expect(result.conversationRef).toBeDefined();
      expect(result.conversationRef!.conversationId).toBe("conv-123");
      expect(result.conversationRef!.messageIds).toEqual(["msg-1", "msg-2"]);
    });

    it("stores memory with userId for GDPR", async () => {
      const result = await cortex.vector.store("agent-store", {
        content: "User-specific data",
        contentType: "raw",
        userId: "user-gdpr",
        source: { type: "conversation", userId: "user-gdpr" },
        metadata: {
          importance: 50,
          tags: ["user-data"],
        },
      });

      expect(result.userId).toBe("user-gdpr");
    });
  });

  describe("get()", () => {
    let testMemoryId: string;

    beforeAll(async () => {
      const memory = await cortex.vector.store("agent-test", {
        content: "Test memory for retrieval",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 50,
          tags: ["test"],
        },
      });
      testMemoryId = memory.memoryId;
    });

    it("retrieves existing memory", async () => {
      const result = await cortex.vector.get("agent-test", testMemoryId);

      expect(result).not.toBeNull();
      expect(result!.memoryId).toBe(testMemoryId);
      expect(result!.content).toBe("Test memory for retrieval");
    });

    it("returns null for non-existent memory", async () => {
      const result = await cortex.vector.get(
        "agent-test",
        "mem-does-not-exist",
      );

      expect(result).toBeNull();
    });

    it("returns null for memory owned by different agent", async () => {
      // Try to access agent-test's memory from agent-test-2
      const result = await cortex.vector.get("agent-test-2", testMemoryId);

      expect(result).toBeNull(); // Permission denied (agent isolation)
    });
  });

  describe("search()", () => {
    beforeAll(async () => {
      // Create searchable memories
      await cortex.vector.store("agent-search", {
        content: "User prefers dark mode for the interface",
        contentType: "raw",
        source: { type: "conversation", userId: "user-1" },
        metadata: {
          importance: 70,
          tags: ["preferences", "ui"],
        },
      });

      await cortex.vector.store("agent-search", {
        content: "The password for admin account is Secret123",
        contentType: "raw",
        source: { type: "conversation", userId: "user-1" },
        metadata: {
          importance: 95,
          tags: ["password", "security"],
        },
      });

      await cortex.vector.store("agent-search", {
        content: "System started successfully at 10:00 AM",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 20,
          tags: ["system", "status"],
        },
      });
    });

    it("finds memories using keyword search", async () => {
      const results = await cortex.vector.search("agent-search", "password");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.content.includes("password"))).toBe(true);
    });

    it("filters by userId", async () => {
      // Search for content that exists in user-1's memories
      const results = await cortex.vector.search("agent-search", "dark mode", {
        userId: "user-1",
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((memory) => {
        expect(memory.sourceUserId).toBe("user-1"); // Check sourceUserId
      });
    });

    it("filters by tags", async () => {
      const results = await cortex.vector.search("agent-search", "system", {
        tags: ["system"],
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((memory) => {
        expect(memory.tags).toContain("system");
      });
    });

    it("filters by minImportance", async () => {
      const results = await cortex.vector.search("agent-search", "password", {
        minImportance: 90,
      });

      results.forEach((memory) => {
        expect(memory.importance).toBeGreaterThanOrEqual(90);
      });
    });

    it("respects limit parameter", async () => {
      const results = await cortex.vector.search("agent-search", "user", {
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("isolates by agent (agent-1 doesn't see agent-2's memories)", async () => {
      // Store memory for agent-test-2
      await cortex.vector.store("agent-test-2", {
        content: "Private information for agent-2",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 80,
          tags: ["private"],
        },
      });

      // agent-search shouldn't find it
      const results = await cortex.vector.search("agent-search", "private");

      const hasAgent2Memory = results.some((m) =>
        m.content.includes("agent-2"),
      );
      expect(hasAgent2Memory).toBe(false);
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      for (let i = 1; i <= 5; i++) {
        await cortex.vector.store("agent-test", {
          content: `Memory ${i}`,
          contentType: "raw",
          source: { type: i % 2 === 0 ? "conversation" : "system" },
          metadata: {
            importance: i * 10,
            tags: ["test"],
          },
        });
      }
    });

    it("lists all memories for agent", async () => {
      const results = await cortex.vector.list({
        agentId: "agent-test",
      });

      expect(results.length).toBeGreaterThanOrEqual(5);
      results.forEach((memory) => {
        expect(memory.agentId).toBe("agent-test");
      });
    });

    it("filters by sourceType", async () => {
      const results = await cortex.vector.list({
        agentId: "agent-test",
        sourceType: "conversation",
      });

      results.forEach((memory) => {
        expect(memory.sourceType).toBe("conversation");
      });
    });

    it("respects limit parameter", async () => {
      const results = await cortex.vector.list({
        agentId: "agent-test",
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("count()", () => {
    it("counts all memories for agent", async () => {
      const count = await cortex.vector.count({
        agentId: "agent-test",
      });

      expect(count).toBeGreaterThan(0);
    });

    it("counts by sourceType", async () => {
      const count = await cortex.vector.count({
        agentId: "agent-test",
        sourceType: "system",
      });

      expect(count).toBeGreaterThan(0);
    });
  });

  describe("delete()", () => {
    it("deletes a memory", async () => {
      // Create memory
      const memory = await cortex.vector.store("agent-test", {
        content: "Memory to delete",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 30,
          tags: ["temp"],
        },
      });

      // Verify exists
      const before = await cortex.vector.get("agent-test", memory.memoryId);
      expect(before).not.toBeNull();

      // Delete
      const result = await cortex.vector.delete("agent-test", memory.memoryId);
      expect(result.deleted).toBe(true);

      // Verify deleted
      const after = await cortex.vector.get("agent-test", memory.memoryId);
      expect(after).toBeNull();
    });

    it("throws error for non-existent memory", async () => {
      await expect(
        cortex.vector.delete("agent-test", "mem-does-not-exist"),
      ).rejects.toThrow("MEMORY_NOT_FOUND");
    });

    it("prevents deleting other agent's memories", async () => {
      const memory = await cortex.vector.store("agent-test", {
        content: "Protected memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await expect(
        cortex.vector.delete("agent-test-2", memory.memoryId),
      ).rejects.toThrow("PERMISSION_DENIED");
    });
  });

  describe("Agent Isolation", () => {
    it("each agent has private memory space", async () => {
      // Store for agent-1
      await cortex.vector.store("agent-test", {
        content: "Agent 1 private data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Store for agent-2
      await cortex.vector.store("agent-test-2", {
        content: "Agent 2 private data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Each agent only sees their own
      const agent1Memories = await cortex.vector.list({
        agentId: "agent-test",
      });
      const agent2Memories = await cortex.vector.list({
        agentId: "agent-test-2",
      });

      const agent1HasAgent2Data = agent1Memories.some((m) =>
        m.content.includes("Agent 2"),
      );
      const agent2HasAgent1Data = agent2Memories.some((m) =>
        m.content.includes("Agent 1"),
      );

      expect(agent1HasAgent2Data).toBe(false);
      expect(agent2HasAgent1Data).toBe(false);
    });
  });

  describe("GDPR Compliance", () => {
    it("supports userId for cascade deletion", async () => {
      await cortex.vector.store("agent-test", {
        content: "User-specific memory 1",
        contentType: "raw",
        userId: "user-gdpr",
        source: { type: "conversation", userId: "user-gdpr" },
        metadata: { importance: 60, tags: [] },
      });

      await cortex.vector.store("agent-test", {
        content: "User-specific memory 2",
        contentType: "raw",
        userId: "user-gdpr",
        source: { type: "conversation", userId: "user-gdpr" },
        metadata: { importance: 70, tags: [] },
      });

      // Count user memories
      const count = await cortex.vector.count({
        agentId: "agent-test",
        userId: "user-gdpr",
      });

      expect(count).toBeGreaterThanOrEqual(2);

      // List user memories
      const memories = await cortex.vector.list({
        agentId: "agent-test",
        userId: "user-gdpr",
      });

      expect(memories.length).toBeGreaterThanOrEqual(2);
      memories.forEach((memory) => {
        expect(memory.userId).toBe("user-gdpr");
      });
    });
  });

  describe("Advanced Operations", () => {
    describe("update()", () => {
      let memoryId: string;

      beforeAll(async () => {
        const memory = await cortex.vector.store("agent-test", {
          content: "Original content",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["test"] },
        });
        memoryId = memory.memoryId;
      });

      it("updates memory and creates new version", async () => {
        const result = await cortex.vector.update("agent-test", memoryId, {
          content: "Updated content",
          importance: 80,
        });

        expect(result.version).toBe(2);
        expect(result.content).toBe("Updated content");
        expect(result.importance).toBe(80);
        expect(result.previousVersions).toHaveLength(1);
      });

      it("preserves previous versions", async () => {
        const history = await cortex.vector.getHistory("agent-test", memoryId);
        expect(history).toHaveLength(2);
        expect(history[0].content).toBe("Original content");
        expect(history[1].content).toBe("Updated content");
      });
    });

    describe("getVersion()", () => {
      let memoryId: string;

      beforeAll(async () => {
        const m = await cortex.vector.store("agent-test", {
          content: "Version 1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
        memoryId = m.memoryId;

        await cortex.vector.update("agent-test", memoryId, {
          content: "Version 2",
        });
        await cortex.vector.update("agent-test", memoryId, {
          content: "Version 3",
        });
      });

      it("retrieves specific version", async () => {
        const v1 = await cortex.vector.getVersion("agent-test", memoryId, 1);
        expect(v1).not.toBeNull();
        expect(v1!.content).toBe("Version 1");

        const v2 = await cortex.vector.getVersion("agent-test", memoryId, 2);
        expect(v2!.content).toBe("Version 2");

        const v3 = await cortex.vector.getVersion("agent-test", memoryId, 3);
        expect(v3!.content).toBe("Version 3");
      });
    });

    describe("deleteMany()", () => {
      beforeAll(async () => {
        for (let i = 1; i <= 5; i++) {
          await cortex.vector.store("agent-test", {
            content: `Bulk delete test ${i}`,
            contentType: "raw",
            source: { type: "system" },
            userId: "user-bulk-delete",
            metadata: { importance: 30, tags: ["bulk-test"] },
          });
        }
      });

      it("deletes multiple memories by filter", async () => {
        const result = await cortex.vector.deleteMany({
          agentId: "agent-test",
          userId: "user-bulk-delete",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(5);
        expect(result.memoryIds).toHaveLength(result.deleted);
      });
    });

    describe("export()", () => {
      it("exports to JSON format", async () => {
        const result = await cortex.vector.export({
          agentId: "agent-test",
          format: "json",
        });

        expect(result.format).toBe("json");
        expect(result.count).toBeGreaterThan(0);

        const parsed = JSON.parse(result.data);
        expect(Array.isArray(parsed)).toBe(true);
      });

      it("exports to CSV format", async () => {
        const result = await cortex.vector.export({
          agentId: "agent-test",
          format: "csv",
        });

        expect(result.format).toBe("csv");
        expect(result.data).toContain("memoryId");
        expect(result.data).toContain("content");
      });
    });

    describe("updateMany()", () => {
      beforeAll(async () => {
        for (let i = 1; i <= 3; i++) {
          await cortex.vector.store("agent-test", {
            content: `Update many test ${i}`,
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 30, tags: ["update-test"] },
          });
        }
      });

      it("updates multiple memories", async () => {
        const result = await cortex.vector.updateMany(
          {
            agentId: "agent-test",
            sourceType: "system",
          },
          {
            importance: 80,
          },
        );

        expect(result.updated).toBeGreaterThan(0);
      });
    });

    describe("archive()", () => {
      it("archives a memory (soft delete)", async () => {
        const memory = await cortex.vector.store("agent-test", {
          content: "Archive test",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.vector.archive(
          "agent-test",
          memory.memoryId,
        );

        expect(result.archived).toBe(true);
        expect(result.restorable).toBe(true);

        // Verify archived (should still exist but tagged)
        const archived = await cortex.vector.get("agent-test", memory.memoryId);
        expect(archived).not.toBeNull();
        expect(archived!.tags).toContain("archived");
        expect(archived!.importance).toBeLessThanOrEqual(10);
      });
    });

    describe("getAtTimestamp()", () => {
      let memoryId: string;
      let v1Timestamp: number;
      let v2Timestamp: number;

      beforeAll(async () => {
        const m = await cortex.vector.store("agent-test", {
          content: "Temporal v1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
        memoryId = m.memoryId;
        v1Timestamp = m.createdAt;

        await new Promise((resolve) => setTimeout(resolve, 100));

        const v2 = await cortex.vector.update("agent-test", memoryId, {
          content: "Temporal v2",
        });
        v2Timestamp = v2.updatedAt;
      });

      it("returns version at specific timestamp", async () => {
        const atV1 = await cortex.vector.getAtTimestamp(
          "agent-test",
          memoryId,
          v1Timestamp,
        );
        expect(atV1!.content).toBe("Temporal v1");

        const atV2 = await cortex.vector.getAtTimestamp(
          "agent-test",
          memoryId,
          v2Timestamp,
        );
        expect(atV2!.content).toBe("Temporal v2");
      });
    });
  });

  describe("Storage Validation", () => {
    it("validates memory structure", async () => {
      const memory = await cortex.vector.store("agent-test", {
        content: "Validation test",
        contentType: "raw",
        source: { type: "system" },
        conversationRef: {
          conversationId: "conv-123",
          messageIds: ["msg-1"],
        },
        metadata: {
          importance: 75,
          tags: ["test", "validation"],
        },
      });

      // Verify all fields stored correctly
      const stored = await client.query(api.memories.get, {
        agentId: "agent-test",
        memoryId: memory.memoryId,
      });

      expect(stored).not.toBeNull();
      expect(stored!.memoryId).toBe(memory.memoryId);
      expect(stored!.content).toBe("Validation test");
      expect(stored!.conversationRef).toBeDefined();
      expect(stored!.conversationRef!.conversationId).toBe("conv-123");
      expect(stored!.importance).toBe(75);
      expect(stored!.tags).toEqual(["test", "validation"]);
      expect(stored!.version).toBe(1);
      expect(stored!.createdAt).toBeGreaterThan(0);
    });
  });
});
