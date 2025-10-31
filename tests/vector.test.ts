/**
 * E2E Tests: Vector Memory API (Layer 2)
 *
 * Tests validate:
 * - SDK API calls
 * - Convex mutations/queries
 * - Storage validation
 * - Semantic search
 * - Memory space isolation
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
      const result = await cortex.vector.store("memspace-test", {
        content: "User prefers dark mode",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 60,
          tags: ["preferences", "ui"],
        },
      });

      expect(result.memoryId).toMatch(/^mem-/);
      expect(result.memorySpaceId).toBe("memspace-test");
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

      const result = await cortex.vector.store("memspace-test", {
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
      const result = await cortex.vector.store("memspace-test", {
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
      const result = await cortex.vector.store("memspace-test", {
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
      const memory = await cortex.vector.store("memspace-test", {
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
      const result = await cortex.vector.get("memspace-test", testMemoryId);

      expect(result).not.toBeNull();
      expect(result!.memoryId).toBe(testMemoryId);
      expect(result!.content).toBe("Test memory for retrieval");
    });

    it("returns null for non-existent memory", async () => {
      const result = await cortex.vector.get(
        "memspace-test",
        "mem-does-not-exist",
      );

      expect(result).toBeNull();
    });

    it("returns null for memory owned by different memory space", async () => {
      // Try to access memspace-test's memory from memspace-test-2
      const result = await cortex.vector.get("memspace-test-2", testMemoryId);

      expect(result).toBeNull(); // Permission denied (memory space isolation)
    });
  });

  describe("search()", () => {
    beforeAll(async () => {
      // Create searchable memories
      await cortex.vector.store("memspace-test", {
        content: "User prefers dark mode for the interface",
        contentType: "raw",
        source: { type: "conversation", userId: "user-1" },
        metadata: {
          importance: 70,
          tags: ["preferences", "ui"],
        },
      });

      await cortex.vector.store("memspace-test", {
        content: "The password for admin account is Secret123",
        contentType: "raw",
        source: { type: "conversation", userId: "user-1" },
        metadata: {
          importance: 95,
          tags: ["password", "security"],
        },
      });

      await cortex.vector.store("memspace-test", {
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
      const results = await cortex.vector.search("memspace-test", "password");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.content.includes("password"))).toBe(true);
    });

    it("filters by userId", async () => {
      // Search for content that exists in user-1's memories
      const results = await cortex.vector.search("memspace-test", "dark mode", {
        userId: "user-1",
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((memory) => {
        expect(memory.sourceUserId).toBe("user-1"); // Check sourceUserId
      });
    });

    it("filters by tags", async () => {
      const results = await cortex.vector.search("memspace-test", "system", {
        tags: ["system"],
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((memory) => {
        expect(memory.tags).toContain("system");
      });
    });

    it("filters by minImportance", async () => {
      const results = await cortex.vector.search("memspace-test", "password", {
        minImportance: 90,
      });

      results.forEach((memory) => {
        expect(memory.importance).toBeGreaterThanOrEqual(90);
      });
    });

    it("respects limit parameter", async () => {
      const results = await cortex.vector.search("memspace-test", "user", {
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("isolates by agent (agent-1 doesn't see agent-2's memories)", async () => {
      // Store memory for agent-test-2
      await cortex.vector.store("memspace-test-2", {
        content: "Private information for agent-2",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 80,
          tags: ["private"],
        },
      });

      // agent-search shouldn't find it
      const results = await cortex.vector.search("memspace-test", "private");

      const hasAgent2Memory = results.some((m) =>
        m.content.includes("agent-2"),
      );

      expect(hasAgent2Memory).toBe(false);
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      for (let i = 1; i <= 5; i++) {
        await cortex.vector.store("memspace-test", {
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
        memorySpaceId: "memspace-test",
      });

      expect(results.length).toBeGreaterThanOrEqual(5);
      results.forEach((memory) => {
        expect(memory.memorySpaceId).toBe("memspace-test");
      });
    });

    it("filters by sourceType", async () => {
      const results = await cortex.vector.list({
        memorySpaceId: "memspace-test",
        sourceType: "conversation",
      });

      results.forEach((memory) => {
        expect(memory.sourceType).toBe("conversation");
      });
    });

    it("respects limit parameter", async () => {
      const results = await cortex.vector.list({
        memorySpaceId: "memspace-test",
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("count()", () => {
    it("counts all memories for agent", async () => {
      const count = await cortex.vector.count({
        memorySpaceId: "memspace-test",
      });

      expect(count).toBeGreaterThan(0);
    });

    it("counts by sourceType", async () => {
      const count = await cortex.vector.count({
        memorySpaceId: "memspace-test",
        sourceType: "system",
      });

      expect(count).toBeGreaterThan(0);
    });
  });

  describe("delete()", () => {
    it("deletes a memory", async () => {
      // Create memory
      const memory = await cortex.vector.store("memspace-test", {
        content: "Memory to delete",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 30,
          tags: ["temp"],
        },
      });

      // Verify exists
      const before = await cortex.vector.get("memspace-test", memory.memoryId);

      expect(before).not.toBeNull();

      // Delete
      const result = await cortex.vector.delete(
        "memspace-test",
        memory.memoryId,
      );

      expect(result.deleted).toBe(true);

      // Verify deleted
      const after = await cortex.vector.get("memspace-test", memory.memoryId);

      expect(after).toBeNull();
    });

    it("throws error for non-existent memory", async () => {
      await expect(
        cortex.vector.delete("memspace-test", "mem-does-not-exist"),
      ).rejects.toThrow("MEMORY_NOT_FOUND");
    });

    it("prevents deleting other memory space's memories", async () => {
      const memory = await cortex.vector.store("memspace-test", {
        content: "Protected memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await expect(
        cortex.vector.delete("memspace-test-2", memory.memoryId),
      ).rejects.toThrow("PERMISSION_DENIED");
    });
  });

  describe("Memory Space Isolation", () => {
    it("each agent has private memory space", async () => {
      // Store for agent-1
      await cortex.vector.store("memspace-test", {
        content: "Agent 1 private data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Store for agent-2
      await cortex.vector.store("memspace-test-2", {
        content: "Agent 2 private data",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Each agent only sees their own
      const agent1Memories = await cortex.vector.list({
        memorySpaceId: "memspace-test",
      });
      const agent2Memories = await cortex.vector.list({
        memorySpaceId: "memspace-test-2",
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
      await cortex.vector.store("memspace-test", {
        content: "User-specific memory 1",
        contentType: "raw",
        userId: "user-gdpr",
        source: { type: "conversation", userId: "user-gdpr" },
        metadata: { importance: 60, tags: [] },
      });

      await cortex.vector.store("memspace-test", {
        content: "User-specific memory 2",
        contentType: "raw",
        userId: "user-gdpr",
        source: { type: "conversation", userId: "user-gdpr" },
        metadata: { importance: 70, tags: [] },
      });

      // Count user memories
      const count = await cortex.vector.count({
        memorySpaceId: "memspace-test",
        userId: "user-gdpr",
      });

      expect(count).toBeGreaterThanOrEqual(2);

      // List user memories
      const memories = await cortex.vector.list({
        memorySpaceId: "memspace-test",
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
        const memory = await cortex.vector.store("memspace-test", {
          content: "Original content",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["test"] },
        });

        memoryId = memory.memoryId;
      });

      it("updates memory and creates new version", async () => {
        const result = await cortex.vector.update("memspace-test", memoryId, {
          content: "Updated content",
          importance: 80,
        });

        expect(result.version).toBe(2);
        expect(result.content).toBe("Updated content");
        expect(result.importance).toBe(80);
        expect(result.previousVersions).toHaveLength(1);
      });

      it("preserves previous versions", async () => {
        const history = await cortex.vector.getHistory(
          "memspace-test",
          memoryId,
        );

        expect(history).toHaveLength(2);
        expect(history[0].content).toBe("Original content");
        expect(history[1].content).toBe("Updated content");
      });
    });

    describe("getVersion()", () => {
      let memoryId: string;

      beforeAll(async () => {
        const m = await cortex.vector.store("memspace-test", {
          content: "Version 1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        memoryId = m.memoryId;

        await cortex.vector.update("memspace-test", memoryId, {
          content: "Version 2",
        });
        await cortex.vector.update("memspace-test", memoryId, {
          content: "Version 3",
        });
      });

      it("retrieves specific version", async () => {
        const v1 = await cortex.vector.getVersion("memspace-test", memoryId, 1);

        expect(v1).not.toBeNull();
        expect(v1!.content).toBe("Version 1");

        const v2 = await cortex.vector.getVersion("memspace-test", memoryId, 2);

        expect(v2!.content).toBe("Version 2");

        const v3 = await cortex.vector.getVersion("memspace-test", memoryId, 3);

        expect(v3!.content).toBe("Version 3");
      });
    });

    describe("deleteMany()", () => {
      beforeAll(async () => {
        for (let i = 1; i <= 5; i++) {
          await cortex.vector.store("memspace-test", {
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
          memorySpaceId: "memspace-test",
          userId: "user-bulk-delete",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(5);
        expect(result.memoryIds).toHaveLength(result.deleted);
      });
    });

    describe("export()", () => {
      it("exports to JSON format", async () => {
        const result = await cortex.vector.export({
          memorySpaceId: "memspace-test",
          format: "json",
        });

        expect(result.format).toBe("json");
        expect(result.count).toBeGreaterThan(0);

        const parsed = JSON.parse(result.data);

        expect(Array.isArray(parsed)).toBe(true);
      });

      it("exports to CSV format", async () => {
        const result = await cortex.vector.export({
          memorySpaceId: "memspace-test",
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
          await cortex.vector.store("memspace-test", {
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
            memorySpaceId: "memspace-test",
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
        const memory = await cortex.vector.store("memspace-test", {
          content: "Archive test",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.vector.archive(
          "memspace-test",
          memory.memoryId,
        );

        expect(result.archived).toBe(true);
        expect(result.restorable).toBe(true);

        // Verify archived (should still exist but tagged)
        const archived = await cortex.vector.get(
          "memspace-test",
          memory.memoryId,
        );

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
        const m = await cortex.vector.store("memspace-test", {
          content: "Temporal v1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        memoryId = m.memoryId;
        v1Timestamp = m.createdAt;

        await new Promise((resolve) => setTimeout(resolve, 100));

        const v2 = await cortex.vector.update("memspace-test", memoryId, {
          content: "Temporal v2",
        });

        v2Timestamp = v2.updatedAt;
      });

      it("returns version at specific timestamp", async () => {
        const atV1 = await cortex.vector.getAtTimestamp(
          "memspace-test",
          memoryId,
          v1Timestamp,
        );

        expect(atV1!.content).toBe("Temporal v1");

        const atV2 = await cortex.vector.getAtTimestamp(
          "memspace-test",
          memoryId,
          v2Timestamp,
        );

        expect(atV2!.content).toBe("Temporal v2");
      });
    });
  });

  describe("Storage Validation", () => {
    it("validates memory structure", async () => {
      const memory = await cortex.vector.store("memspace-test", {
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
        memorySpaceId: "memspace-test",
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // v0.6.1 Field-by-Field Validation Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Field-by-Field Validation (v0.6.1)", () => {
    it("store() preserves all input fields", async () => {
      const INPUT = {
        content: "Complete field test",
        contentType: "raw" as const,
        participantId: "tool-test",
        userId: "user-field-test",
        source: {
          type: "tool" as const,
          userId: "user-field-test",
          userName: "Field Test User",
        },
        conversationRef: {
          conversationId: "conv-field-test",
          messageIds: ["msg-1", "msg-2"],
        },
        metadata: {
          importance: 85,
          tags: ["field-test", "validation"],
        },
      };

      const result = await cortex.vector.store("memspace-test", INPUT);

      // Field-by-field validation
      expect(result.memoryId).toBeDefined();
      expect(result.memorySpaceId).toBe("memspace-test");
      expect(result.content).toBe(INPUT.content);
      expect(result.contentType).toBe(INPUT.contentType);
      expect(result.participantId).toBe(INPUT.participantId);
      expect(result.userId).toBe(INPUT.userId);
      expect(result.sourceType).toBe(INPUT.source.type);
      expect(result.sourceUserId).toBe(INPUT.source.userId);
      expect(result.sourceUserName).toBe(INPUT.source.userName);
      expect(result.importance).toBe(INPUT.metadata.importance);
      expect(result.tags).toEqual(INPUT.metadata.tags);
      expect(result.conversationRef).toBeDefined();
      expect(result.conversationRef!.conversationId).toBe(
        INPUT.conversationRef.conversationId,
      );
      expect(result.conversationRef!.messageIds).toEqual(
        INPUT.conversationRef.messageIds,
      );

      // Verify in database
      const stored = await cortex.vector.get("memspace-test", result.memoryId);
      expect(stored).toEqual(result);
    });

    it("get() returns exact stored data", async () => {
      const INPUT = {
        content: "Get validation test",
        contentType: "summarized" as const,
        participantId: "agent-test",
        userId: "user-get-test",
        source: { type: "conversation" as const, userId: "user-get-test" },
        metadata: { importance: 92, tags: ["get-test"] },
      };

      const stored = await cortex.vector.store("memspace-test", INPUT);
      const retrieved = await cortex.vector.get(
        "memspace-test",
        stored.memoryId,
      );

      // All fields should match
      expect(retrieved!.memoryId).toBe(stored.memoryId);
      expect(retrieved!.content).toBe(INPUT.content);
      expect(retrieved!.contentType).toBe(INPUT.contentType);
      expect(retrieved!.participantId).toBe(INPUT.participantId);
      expect(retrieved!.userId).toBe(INPUT.userId);
      expect(retrieved!.importance).toBe(INPUT.metadata.importance);
      expect(retrieved!.tags).toEqual(INPUT.metadata.tags);
    });

    it("update() preserves non-updated fields", async () => {
      const original = await cortex.vector.store("memspace-test", {
        content: "Original content",
        contentType: "raw",
        participantId: "tool-update",
        userId: "user-update",
        source: { type: "tool", userId: "user-update" },
        metadata: { importance: 50, tags: ["original", "tag"] },
      });

      const updated = await cortex.vector.update(
        "memspace-test",
        original.memoryId,
        {
          content: "Updated content",
          importance: 80,
          tags: ["original", "tag", "updated"],
        },
      );

      // Updated fields changed
      expect(updated.content).toBe("Updated content");
      expect(updated.importance).toBe(80);
      expect(updated.tags).toContain("updated");

      // Non-updated fields preserved
      expect(updated.participantId).toBe(original.participantId);
      expect(updated.userId).toBe(original.userId);
      expect(updated.contentType).toBe(original.contentType);
    });

    it("list() returns all fields for each memory", async () => {
      const mem1 = await cortex.vector.store("memspace-list-test", {
        content: "List test 1",
        contentType: "raw",
        participantId: "tool-list",
        userId: "user-list",
        source: { type: "tool", userId: "user-list" },
        metadata: { importance: 70, tags: ["list-field-test"] },
      });

      const results = await cortex.vector.list({
        memorySpaceId: "memspace-list-test",
      });

      const found = results.find((r) => r.memoryId === mem1.memoryId);

      expect(found).toBeDefined();
      expect(found!.content).toBe(mem1.content);
      expect(found!.participantId).toBe(mem1.participantId);
      expect(found!.userId).toBe(mem1.userId);
      expect(found!.importance).toBe(mem1.importance);
      expect(found!.tags).toEqual(mem1.tags);
    });

    it("search() returns all fields for each result", async () => {
      await cortex.vector.store("memspace-search-test", {
        content: "FIELD_SEARCH_MARKER searchable content",
        contentType: "raw",
        participantId: "tool-search",
        userId: "user-search",
        source: { type: "tool", userId: "user-search" },
        metadata: { importance: 88, tags: ["search-field-test"] },
      });

      const results = await cortex.vector.search(
        "memspace-search-test",
        "FIELD_SEARCH_MARKER",
        { limit: 10 },
      );

      const found = results.find((r) =>
        r.content.includes("FIELD_SEARCH_MARKER"),
      );

      expect(found).toBeDefined();
      expect(found!.participantId).toBe("tool-search");
      expect(found!.userId).toBe("user-search");
      expect(found!.importance).toBe(88);
      expect(found!.tags).toContain("search-field-test");
    });

    it("conversationRef structure preserved through all operations", async () => {
      const conversationRefWithMessages = {
        conversationId: "conv-ref-test",
        messageIds: ["msg-a", "msg-b", "msg-c"],
      };

      const memory = await cortex.vector.store("memspace-test", {
        content: "Conversation ref test",
        contentType: "raw",
        source: { type: "conversation", userId: "user-ref" },
        conversationRef: conversationRefWithMessages,
        metadata: { importance: 50, tags: [] },
      });

      // Verify structure preserved
      expect(memory.conversationRef).toBeDefined();
      expect(memory.conversationRef!.conversationId).toBe(
        conversationRefWithMessages.conversationId,
      );
      expect(memory.conversationRef!.messageIds).toEqual(
        conversationRefWithMessages.messageIds,
      );

      // Verify after retrieval
      const retrieved = await cortex.vector.get(
        "memspace-test",
        memory.memoryId,
      );

      expect(retrieved!.conversationRef!.conversationId).toBe(
        conversationRefWithMessages.conversationId,
      );
      expect(retrieved!.conversationRef!.messageIds).toEqual(
        conversationRefWithMessages.messageIds,
      );
    });

    it("source information preserved correctly", async () => {
      const source = {
        type: "conversation" as const,
        userId: "user-source",
        userName: "Source User",
      };

      const memory = await cortex.vector.store("memspace-test", {
        content: "Source test",
        contentType: "raw",
        source,
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.sourceType).toBe(source.type);
      expect(memory.sourceUserId).toBe(source.userId);
      expect(memory.sourceUserName).toBe(source.userName);

      const retrieved = await cortex.vector.get(
        "memspace-test",
        memory.memoryId,
      );

      expect(retrieved!.sourceType).toBe(source.type);
      expect(retrieved!.sourceUserId).toBe(source.userId);
      expect(retrieved!.sourceUserName).toBe(source.userName);
    });

    it("embedding preserved when provided", async () => {
      const embedding = Array.from({ length: 1536 }, () => Math.random());

      const memory = await cortex.vector.store("memspace-test", {
        content: "Embedding test",
        contentType: "raw",
        source: { type: "system" },
        embedding,
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.embedding).toBeDefined();
      expect(memory.embedding).toHaveLength(1536);

      const retrieved = await cortex.vector.get(
        "memspace-test",
        memory.memoryId,
      );

      expect(retrieved!.embedding).toBeDefined();
      expect(retrieved!.embedding).toHaveLength(1536);
      // Check a few values match
      expect(retrieved!.embedding![0]).toBe(embedding[0]);
      expect(retrieved!.embedding![100]).toBe(embedding[100]);
    });

    it("version and timestamps preserved", async () => {
      const memory = await cortex.vector.store("memspace-test", {
        content: "Version test",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.version).toBe(1);
      expect(memory.createdAt).toBeGreaterThan(0);
      expect(memory.updatedAt).toBeDefined();
      expect(memory.previousVersions).toEqual([]);

      const retrieved = await cortex.vector.get(
        "memspace-test",
        memory.memoryId,
      );

      expect(retrieved!.version).toBe(memory.version);
      expect(retrieved!.createdAt).toBe(memory.createdAt);
      expect(retrieved!.updatedAt).toBe(memory.updatedAt);
    });

    it("count() accurate across all operations", async () => {
      const countBefore = await cortex.vector.count({
        memorySpaceId: "memspace-count-test",
      });

      // Create 5 memories
      for (let i = 0; i < 5; i++) {
        await cortex.vector.store("memspace-count-test", {
          content: `Count test ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["count-test"] },
        });
      }

      const countAfter = await cortex.vector.count({
        memorySpaceId: "memspace-count-test",
      });

      expect(countAfter).toBe(countBefore + 5);
    });
  });
});
