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
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Vector Memory API (Layer 2)", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;

    if (!convexUrl) {
      throw new Error("CONVEX_URL not set");
    }

    cortex = new Cortex({ convexUrl });
    client = new ConvexClient(convexUrl);
    _cleanup = new TestCleanup(client);

    // NOTE: Removed purgeAll() to enable parallel test execution.
    // Each test uses ctx-scoped IDs to avoid conflicts.
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    // Test-scoped IDs ensure isolation without global cleanup.
    await client.close();
  });

  describe("store()", () => {
    // Use test-scoped IDs
    const storeSpace = ctx.memorySpaceId("store");
    const storeUser = ctx.userId("store-1");
    const gdprUser = ctx.userId("gdpr");
    const storeConvId = ctx.conversationId("store-ref");

    it("stores memory without embedding (keyword search only)", async () => {
      const result = await cortex.vector.store(storeSpace, {
        content: "User prefers dark mode",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 60,
          tags: ["preferences", "ui"],
        },
      });

      expect(result.memoryId).toMatch(/^mem-/);
      expect(result.memorySpaceId).toBe(storeSpace);
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

      const result = await cortex.vector.store(storeSpace, {
        content: "User password is Blue123",
        contentType: "raw",
        embedding: mockEmbedding,
        source: { type: "conversation", userId: storeUser },
        metadata: {
          importance: 90,
          tags: ["password", "security"],
        },
      });

      expect(result.embedding).toHaveLength(1536);
      expect(result.sourceType).toBe("conversation");
      expect(result.sourceUserId).toBe(storeUser);
    });

    it("stores memory with conversationRef", async () => {
      const result = await cortex.vector.store(storeSpace, {
        content: "User asked about refunds",
        contentType: "summarized",
        source: { type: "conversation", userId: storeUser },
        conversationRef: {
          conversationId: storeConvId,
          messageIds: ["msg-1", "msg-2"],
        },
        metadata: {
          importance: 70,
          tags: ["refunds"],
        },
      });

      expect(result.conversationRef).toBeDefined();
      expect(result.conversationRef!.conversationId).toBe(storeConvId);
      expect(result.conversationRef!.messageIds).toEqual(["msg-1", "msg-2"]);
    });

    it("stores memory with userId for GDPR", async () => {
      const result = await cortex.vector.store(storeSpace, {
        content: "User-specific data",
        contentType: "raw",
        userId: gdprUser,
        source: { type: "conversation", userId: gdprUser },
        metadata: {
          importance: 50,
          tags: ["user-data"],
        },
      });

      expect(result.userId).toBe(gdprUser);
    });
  });

  describe("get()", () => {
    let testMemoryId: string;

    // Use test-scoped IDs
    const getSpace = ctx.memorySpaceId("get");
    const getSpaceOther = ctx.memorySpaceId("get-other");

    beforeAll(async () => {
      const memory = await cortex.vector.store(getSpace, {
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
      const result = await cortex.vector.get(getSpace, testMemoryId);

      expect(result).not.toBeNull();
      expect(result!.memoryId).toBe(testMemoryId);
      expect(result!.content).toBe("Test memory for retrieval");
    });

    it("returns null for non-existent memory", async () => {
      const result = await cortex.vector.get(
        getSpace,
        `mem-nonexistent-${ctx.runId}`,
      );

      expect(result).toBeNull();
    });

    it("returns null for memory owned by different memory space", async () => {
      // Try to access getSpace's memory from getSpaceOther
      const result = await cortex.vector.get(getSpaceOther, testMemoryId);

      expect(result).toBeNull(); // Permission denied (memory space isolation)
    });
  });

  describe("search()", () => {
    // Use test-scoped IDs
    const searchSpace = ctx.memorySpaceId("search");
    const searchUser = ctx.userId("search-1");
    // Unique search term to avoid cross-test conflicts
    const searchKeyword = `secretkey-${ctx.runId}`;

    beforeAll(async () => {
      // Create searchable memories
      await cortex.vector.store(searchSpace, {
        content: "User prefers dark mode for the interface",
        contentType: "raw",
        source: { type: "conversation", userId: searchUser },
        metadata: {
          importance: 70,
          tags: ["preferences", "ui"],
        },
      });

      await cortex.vector.store(searchSpace, {
        content: `The ${searchKeyword} for admin account is Secret123`,
        contentType: "raw",
        source: { type: "conversation", userId: searchUser },
        metadata: {
          importance: 95,
          tags: ["password", "security"],
        },
      });

      await cortex.vector.store(searchSpace, {
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
      const results = await cortex.vector.search(searchSpace, searchKeyword);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.content.includes(searchKeyword))).toBe(true);
    });

    it("filters by userId", async () => {
      // Search for content that exists in searchUser's memories
      const results = await cortex.vector.search(searchSpace, "dark mode", {
        userId: searchUser,
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((memory) => {
        expect(memory.sourceUserId).toBe(searchUser); // Check sourceUserId
      });
    });

    it("filters by tags", async () => {
      const results = await cortex.vector.search(searchSpace, "system", {
        tags: ["system"],
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((memory) => {
        expect(memory.tags).toContain("system");
      });
    });

    it("filters by minImportance", async () => {
      const results = await cortex.vector.search(searchSpace, searchKeyword, {
        minImportance: 90,
      });

      results.forEach((memory) => {
        expect(memory.importance).toBeGreaterThanOrEqual(90);
      });
    });

    it("respects limit parameter", async () => {
      const results = await cortex.vector.search(searchSpace, "user", {
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("isolates by agent (agent-1 doesn't see agent-2's memories)", async () => {
      // Use test-scoped isolated space
      const isolatedSpace = ctx.memorySpaceId("isolated");
      const privateKeyword = `private-${ctx.runId}`;

      // Store memory in isolated space
      await cortex.vector.store(isolatedSpace, {
        content: `${privateKeyword} information for isolated space`,
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 80,
          tags: ["private"],
        },
      });

      // searchSpace shouldn't find it
      const results = await cortex.vector.search(searchSpace, privateKeyword);

      const hasIsolatedMemory = results.some((m) =>
        m.content.includes(privateKeyword),
      );

      expect(hasIsolatedMemory).toBe(false);
    });
  });

  describe("list()", () => {
    // Use test-scoped IDs
    const listSpace = ctx.memorySpaceId("list");

    beforeAll(async () => {
      for (let i = 1; i <= 5; i++) {
        await cortex.vector.store(listSpace, {
          content: `Memory ${i} - ${ctx.runId}`,
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
        memorySpaceId: listSpace,
      });

      expect(results.length).toBeGreaterThanOrEqual(5);
      results.forEach((memory) => {
        expect(memory.memorySpaceId).toBe(listSpace);
      });
    });

    it("filters by sourceType", async () => {
      const results = await cortex.vector.list({
        memorySpaceId: listSpace,
        sourceType: "conversation",
      });

      results.forEach((memory) => {
        expect(memory.sourceType).toBe("conversation");
      });
    });

    it("respects limit parameter", async () => {
      const results = await cortex.vector.list({
        memorySpaceId: listSpace,
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("count()", () => {
    // Use list space which has test data
    const countSpace = ctx.memorySpaceId("count");

    beforeAll(async () => {
      // Create test data for counting
      await cortex.vector.store(countSpace, {
        content: `Count test system memory - ${ctx.runId}`,
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["test"] },
      });
      await cortex.vector.store(countSpace, {
        content: `Count test conversation memory - ${ctx.runId}`,
        contentType: "raw",
        source: { type: "conversation", userId: ctx.userId("count") },
        metadata: { importance: 50, tags: ["test"] },
      });
    });

    it("counts all memories for agent", async () => {
      const count = await cortex.vector.count({
        memorySpaceId: countSpace,
      });

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("counts by sourceType", async () => {
      const count = await cortex.vector.count({
        memorySpaceId: countSpace,
        sourceType: "system",
      });

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("delete()", () => {
    // Use test-scoped IDs
    const deleteSpace = ctx.memorySpaceId("delete");

    it("deletes a memory", async () => {
      // Create memory
      const memory = await cortex.vector.store(deleteSpace, {
        content: "Memory to delete",
        contentType: "raw",
        source: { type: "system" },
        metadata: {
          importance: 30,
          tags: ["temp"],
        },
      });

      // Verify exists
      const before = await cortex.vector.get(deleteSpace, memory.memoryId);

      expect(before).not.toBeNull();

      // Delete
      const result = await cortex.vector.delete(
        deleteSpace,
        memory.memoryId,
      );

      expect(result.deleted).toBe(true);

      // Verify deleted
      const after = await cortex.vector.get(deleteSpace, memory.memoryId);

      expect(after).toBeNull();
    });

    it("throws error for non-existent memory", async () => {
      await expect(
        cortex.vector.delete(deleteSpace, `mem-nonexistent-${ctx.runId}`),
      ).rejects.toThrow("MEMORY_NOT_FOUND");
    });

    it("prevents deleting other memory space's memories", async () => {
      const otherSpace = ctx.memorySpaceId("delete-other");

      const memory = await cortex.vector.store(deleteSpace, {
        content: "Protected memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await expect(
        cortex.vector.delete(otherSpace, memory.memoryId),
      ).rejects.toThrow("PERMISSION_DENIED");
    });
  });

  describe("Memory Space Isolation", () => {
    it("each agent has private memory space", async () => {
      // Use test-scoped IDs
      const isolationSpace1 = ctx.memorySpaceId("isolation-1");
      const isolationSpace2 = ctx.memorySpaceId("isolation-2");
      const uniqueMarker1 = `private-data-1-${ctx.runId}`;
      const uniqueMarker2 = `private-data-2-${ctx.runId}`;

      // Store for space-1
      await cortex.vector.store(isolationSpace1, {
        content: uniqueMarker1,
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Store for space-2
      await cortex.vector.store(isolationSpace2, {
        content: uniqueMarker2,
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      // Each space only sees their own
      const space1Memories = await cortex.vector.list({
        memorySpaceId: isolationSpace1,
      });
      const space2Memories = await cortex.vector.list({
        memorySpaceId: isolationSpace2,
      });

      const space1HasSpace2Data = space1Memories.some((m) =>
        m.content.includes(uniqueMarker2),
      );
      const space2HasSpace1Data = space2Memories.some((m) =>
        m.content.includes(uniqueMarker1),
      );

      expect(space1HasSpace2Data).toBe(false);
      expect(space2HasSpace1Data).toBe(false);
    });
  });

  describe("GDPR Compliance", () => {
    // Use test-scoped IDs
    const gdprSpace = ctx.memorySpaceId("gdpr");
    const gdprUser = ctx.userId("gdpr-test");

    it("supports userId for cascade deletion", async () => {
      await cortex.vector.store(gdprSpace, {
        content: "User-specific memory 1",
        contentType: "raw",
        userId: gdprUser,
        source: { type: "conversation", userId: gdprUser },
        metadata: { importance: 60, tags: [] },
      });

      await cortex.vector.store(gdprSpace, {
        content: "User-specific memory 2",
        contentType: "raw",
        userId: gdprUser,
        source: { type: "conversation", userId: gdprUser },
        metadata: { importance: 70, tags: [] },
      });

      // Count user memories
      const count = await cortex.vector.count({
        memorySpaceId: gdprSpace,
        userId: gdprUser,
      });

      expect(count).toBeGreaterThanOrEqual(2);

      // List user memories
      const memories = await cortex.vector.list({
        memorySpaceId: gdprSpace,
        userId: gdprUser,
      });

      expect(memories.length).toBeGreaterThanOrEqual(2);
      memories.forEach((memory) => {
        expect(memory.userId).toBe(gdprUser);
      });
    });
  });

  describe("Advanced Operations", () => {
    describe("update()", () => {
      let memoryId: string;
      const updateSpace = ctx.memorySpaceId("update");

      beforeAll(async () => {
        const memory = await cortex.vector.store(updateSpace, {
          content: "Original content",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["test"] },
        });

        memoryId = memory.memoryId;
      });

      it("updates memory and creates new version", async () => {
        const result = await cortex.vector.update(updateSpace, memoryId, {
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
          updateSpace,
          memoryId,
        );

        expect(history).toHaveLength(2);
        expect(history[0].content).toBe("Original content");
        expect(history[1].content).toBe("Updated content");
      });
    });

    describe("getVersion()", () => {
      let memoryId: string;
      const versionSpace = ctx.memorySpaceId("version");

      beforeAll(async () => {
        const m = await cortex.vector.store(versionSpace, {
          content: "Version 1",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        memoryId = m.memoryId;

        await cortex.vector.update(versionSpace, memoryId, {
          content: "Version 2",
        });
        await cortex.vector.update(versionSpace, memoryId, {
          content: "Version 3",
        });
      });

      it("retrieves specific version", async () => {
        const v1 = await cortex.vector.getVersion(versionSpace, memoryId, 1);

        expect(v1).not.toBeNull();
        expect(v1!.content).toBe("Version 1");

        const v2 = await cortex.vector.getVersion(versionSpace, memoryId, 2);

        expect(v2!.content).toBe("Version 2");

        const v3 = await cortex.vector.getVersion(versionSpace, memoryId, 3);

        expect(v3!.content).toBe("Version 3");
      });
    });

    describe("deleteMany()", () => {
      const deleteManySpace = ctx.memorySpaceId("delete-many");
      const bulkDeleteUser = ctx.userId("bulk-delete");
      const bulkTag = `bulk-test-${ctx.runId}`;

      beforeAll(async () => {
        for (let i = 1; i <= 5; i++) {
          await cortex.vector.store(deleteManySpace, {
            content: `Bulk delete test ${i} - ${ctx.runId}`,
            contentType: "raw",
            source: { type: "system" },
            userId: bulkDeleteUser,
            metadata: { importance: 30, tags: [bulkTag] },
          });
        }
      });

      it("deletes multiple memories by filter", async () => {
        const result = await cortex.vector.deleteMany({
          memorySpaceId: deleteManySpace,
          userId: bulkDeleteUser,
        });

        expect(result.deleted).toBeGreaterThanOrEqual(5);
        expect(result.memoryIds).toHaveLength(result.deleted);
      });
    });

    describe("export()", () => {
      const exportSpace = ctx.memorySpaceId("export");

      beforeAll(async () => {
        // Create data to export
        await cortex.vector.store(exportSpace, {
          content: `Export test data - ${ctx.runId}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["export"] },
        });
      });

      it("exports to JSON format", async () => {
        const result = await cortex.vector.export({
          memorySpaceId: exportSpace,
          format: "json",
        });

        expect(result.format).toBe("json");
        expect(result.count).toBeGreaterThan(0);

        const parsed = JSON.parse(result.data);

        expect(Array.isArray(parsed)).toBe(true);
      });

      it("exports to CSV format", async () => {
        const result = await cortex.vector.export({
          memorySpaceId: exportSpace,
          format: "csv",
        });

        expect(result.format).toBe("csv");
        expect(result.data).toContain("memoryId");
        expect(result.data).toContain("content");
      });
    });

    describe("updateMany()", () => {
      const updateManySpace = ctx.memorySpaceId("update-many");
      const updateTag = `update-test-${ctx.runId}`;

      beforeAll(async () => {
        for (let i = 1; i <= 3; i++) {
          await cortex.vector.store(updateManySpace, {
            content: `Update many test ${i} - ${ctx.runId}`,
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 30, tags: [updateTag] },
          });
        }
      });

      it("updates multiple memories", async () => {
        const result = await cortex.vector.updateMany(
          {
            memorySpaceId: updateManySpace,
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
      const archiveSpace = ctx.memorySpaceId("archive");

      it("archives a memory (soft delete)", async () => {
        const memory = await cortex.vector.store(archiveSpace, {
          content: "Archive test",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.vector.archive(
          archiveSpace,
          memory.memoryId,
        );

        expect(result.archived).toBe(true);
        expect(result.restorable).toBe(true);

        // Verify archived (should still exist but tagged)
        const archived = await cortex.vector.get(
          archiveSpace,
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    // These tests verify that invalid inputs are caught synchronously
    // before making backend calls, providing faster error feedback.

    describe("store() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.store("", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.vector.store("   ", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on missing content", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          } as any),
        ).rejects.toThrow("content is required");
      });

      it("should throw on empty content", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "   ",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("content cannot be empty");
      });

      it("should throw on missing contentType", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          } as any),
        ).rejects.toThrow("contentType is required");
      });

      it("should throw on invalid contentType", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "invalid" as any,
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("Invalid contentType");
      });

      it("should throw on missing source", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            metadata: { importance: 50, tags: [] },
          } as any),
        ).rejects.toThrow("source is required");
      });

      it("should throw on missing source.type", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: {} as any,
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("source.type is required");
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "invalid" as any },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("Invalid source.type");
      });

      it("should throw on missing metadata", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
          } as any),
        ).rejects.toThrow("metadata is required");
      });

      it("should throw on missing metadata.importance", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { tags: [] } as any,
          }),
        ).rejects.toThrow("metadata.importance is required");
      });

      it("should throw on importance below 0", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: -1, tags: [] },
          }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on importance above 100", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 101, tags: [] },
          }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on missing metadata.tags", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50 } as any,
          }),
        ).rejects.toThrow("metadata.tags is required");
      });

      it("should throw on invalid tags (not array)", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: "tag" as any },
          }),
        ).rejects.toThrow("must be an array");
      });

      it("should throw on invalid embedding (not array of numbers)", async () => {
        await expect(
          cortex.vector.store("memspace-test", {
            content: "test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
            embedding: ["a", "b"] as any,
          }),
        ).rejects.toThrow("must be a number");
      });

      it("should accept valid importance at boundary 0", async () => {
        const result = await cortex.vector.store("memspace-validation-test", {
          content: "boundary test 0",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 0, tags: [] },
        });
        expect(result.importance).toBe(0);
      });

      it("should accept valid importance at boundary 100", async () => {
        const result = await cortex.vector.store("memspace-validation-test", {
          content: "boundary test 100",
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 100, tags: [] },
        });
        expect(result.importance).toBe(100);
      });
    });

    describe("get() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(cortex.vector.get("", "mem-123")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(cortex.vector.get("   ", "mem-123")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on empty memoryId", async () => {
        await expect(cortex.vector.get("memspace-test", "")).rejects.toThrow(
          "memoryId is required",
        );
      });

      it("should throw on whitespace-only memoryId", async () => {
        await expect(cortex.vector.get("memspace-test", "   ")).rejects.toThrow(
          "memoryId is required",
        );
      });
    });

    describe("search() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(cortex.vector.search("", "query")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on invalid minImportance below 0", async () => {
        await expect(
          cortex.vector.search("memspace-test", "query", { minImportance: -1 }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on invalid minImportance above 100", async () => {
        await expect(
          cortex.vector.search("memspace-test", "query", {
            minImportance: 101,
          }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on invalid minScore below 0", async () => {
        await expect(
          cortex.vector.search("memspace-test", "query", { minScore: -0.1 }),
        ).rejects.toThrow("must be between 0 and 1");
      });

      it("should throw on invalid minScore above 1", async () => {
        await expect(
          cortex.vector.search("memspace-test", "query", { minScore: 1.5 }),
        ).rejects.toThrow("must be between 0 and 1");
      });

      it("should throw on invalid limit (0)", async () => {
        await expect(
          cortex.vector.search("memspace-test", "query", { limit: 0 }),
        ).rejects.toThrow("must be a positive integer");
      });

      it("should throw on invalid limit (negative)", async () => {
        await expect(
          cortex.vector.search("memspace-test", "query", { limit: -1 }),
        ).rejects.toThrow("must be a positive integer");
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.vector.search("memspace-test", "query", {
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });

      it("should accept valid minScore at boundary 0", async () => {
        // Should not throw
        const results = await cortex.vector.search("memspace-test", "query", {
          minScore: 0,
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it("should accept valid minScore at boundary 1", async () => {
        // Should not throw
        const results = await cortex.vector.search("memspace-test", "query", {
          minScore: 1,
        });
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe("delete() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(cortex.vector.delete("", "mem-123")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(cortex.vector.delete("   ", "mem-123")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on empty memoryId", async () => {
        await expect(cortex.vector.delete("memspace-test", "")).rejects.toThrow(
          "memoryId is required",
        );
      });

      it("should throw on whitespace-only memoryId", async () => {
        await expect(
          cortex.vector.delete("memspace-test", "   "),
        ).rejects.toThrow("memoryId is required");
      });
    });

    describe("list() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.vector.list({} as any)).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on empty memorySpaceId", async () => {
        await expect(cortex.vector.list({ memorySpaceId: "" })).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.vector.list({
            memorySpaceId: "memspace-test",
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });

      it("should throw on invalid limit", async () => {
        await expect(
          cortex.vector.list({ memorySpaceId: "memspace-test", limit: 0 }),
        ).rejects.toThrow("must be a positive integer");
      });
    });

    describe("count() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.vector.count({} as any)).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.count({ memorySpaceId: "" }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.vector.count({
            memorySpaceId: "memspace-test",
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });
    });

    describe("update() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.update("", "mem-123", { content: "new" }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.vector.update("   ", "mem-123", { content: "new" }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on empty memoryId", async () => {
        await expect(
          cortex.vector.update("memspace-test", "", { content: "new" }),
        ).rejects.toThrow("memoryId is required");
      });

      it("should throw on whitespace-only memoryId", async () => {
        await expect(
          cortex.vector.update("memspace-test", "   ", { content: "new" }),
        ).rejects.toThrow("memoryId is required");
      });

      it("should throw on invalid importance below 0", async () => {
        await expect(
          cortex.vector.update("memspace-test", "mem-123", { importance: -1 }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on invalid importance above 100", async () => {
        await expect(
          cortex.vector.update("memspace-test", "mem-123", { importance: 101 }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on invalid tags (not array)", async () => {
        await expect(
          cortex.vector.update("memspace-test", "mem-123", {
            tags: "tag" as any,
          }),
        ).rejects.toThrow("must be an array");
      });

      it("should throw on invalid embedding", async () => {
        await expect(
          cortex.vector.update("memspace-test", "mem-123", {
            embedding: ["a"] as any,
          }),
        ).rejects.toThrow("must be a number");
      });
    });

    describe("getVersion() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.getVersion("", "mem-123", 1),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.vector.getVersion("   ", "mem-123", 1),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on empty memoryId", async () => {
        await expect(
          cortex.vector.getVersion("memspace-test", "", 1),
        ).rejects.toThrow("memoryId is required");
      });

      it("should throw on version 0", async () => {
        await expect(
          cortex.vector.getVersion("memspace-test", "mem-123", 0),
        ).rejects.toThrow("must be a positive integer");
      });

      it("should throw on negative version", async () => {
        await expect(
          cortex.vector.getVersion("memspace-test", "mem-123", -1),
        ).rejects.toThrow("must be a positive integer");
      });

      it("should throw on non-integer version", async () => {
        await expect(
          cortex.vector.getVersion("memspace-test", "mem-123", 1.5),
        ).rejects.toThrow("must be a positive integer");
      });
    });

    describe("getHistory() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(cortex.vector.getHistory("", "mem-123")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.vector.getHistory("   ", "mem-123"),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on empty memoryId", async () => {
        await expect(
          cortex.vector.getHistory("memspace-test", ""),
        ).rejects.toThrow("memoryId is required");
      });

      it("should throw on whitespace-only memoryId", async () => {
        await expect(
          cortex.vector.getHistory("memspace-test", "   "),
        ).rejects.toThrow("memoryId is required");
      });
    });

    describe("deleteMany() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(cortex.vector.deleteMany({} as any)).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.deleteMany({ memorySpaceId: "" }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.vector.deleteMany({ memorySpaceId: "   " }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.vector.deleteMany({
            memorySpaceId: "memspace-test",
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });
    });

    describe("export() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.vector.export({ format: "json" } as any),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.export({ memorySpaceId: "", format: "json" }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on missing format", async () => {
        await expect(
          cortex.vector.export({ memorySpaceId: "memspace-test" } as any),
        ).rejects.toThrow("Invalid format");
      });

      it("should throw on invalid format", async () => {
        await expect(
          cortex.vector.export({
            memorySpaceId: "memspace-test",
            format: "xml" as any,
          }),
        ).rejects.toThrow("Invalid format");
      });
    });

    describe("updateMany() validation", () => {
      it("should throw on missing memorySpaceId", async () => {
        await expect(
          cortex.vector.updateMany({} as any, { importance: 50 }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.updateMany({ memorySpaceId: "" }, { importance: 50 }),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.vector.updateMany(
            { memorySpaceId: "   " },
            { importance: 50 },
          ),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on invalid sourceType", async () => {
        await expect(
          cortex.vector.updateMany(
            { memorySpaceId: "memspace-test", sourceType: "invalid" as any },
            { importance: 50 },
          ),
        ).rejects.toThrow("Invalid sourceType");
      });

      it("should throw on invalid importance below 0", async () => {
        await expect(
          cortex.vector.updateMany(
            { memorySpaceId: "memspace-test" },
            { importance: -1 },
          ),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on invalid importance above 100", async () => {
        await expect(
          cortex.vector.updateMany(
            { memorySpaceId: "memspace-test" },
            { importance: 101 },
          ),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on invalid tags", async () => {
        await expect(
          cortex.vector.updateMany(
            { memorySpaceId: "memspace-test" },
            { tags: "tag" as any },
          ),
        ).rejects.toThrow("must be an array");
      });
    });

    describe("archive() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(cortex.vector.archive("", "mem-123")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(cortex.vector.archive("   ", "mem-123")).rejects.toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw on empty memoryId", async () => {
        await expect(
          cortex.vector.archive("memspace-test", ""),
        ).rejects.toThrow("memoryId is required");
      });

      it("should throw on whitespace-only memoryId", async () => {
        await expect(
          cortex.vector.archive("memspace-test", "   "),
        ).rejects.toThrow("memoryId is required");
      });
    });

    describe("getAtTimestamp() validation", () => {
      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.vector.getAtTimestamp("", "mem-123", Date.now()),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.vector.getAtTimestamp("   ", "mem-123", Date.now()),
        ).rejects.toThrow("memorySpaceId is required");
      });

      it("should throw on empty memoryId", async () => {
        await expect(
          cortex.vector.getAtTimestamp("memspace-test", "", Date.now()),
        ).rejects.toThrow("memoryId is required");
      });

      it("should throw on whitespace-only memoryId", async () => {
        await expect(
          cortex.vector.getAtTimestamp("memspace-test", "   ", Date.now()),
        ).rejects.toThrow("memoryId is required");
      });

      it("should throw on negative timestamp", async () => {
        await expect(
          cortex.vector.getAtTimestamp("memspace-test", "mem-123", -1),
        ).rejects.toThrow("must be a non-negative number");
      });

      it("should throw on invalid Date object", async () => {
        await expect(
          cortex.vector.getAtTimestamp(
            "memspace-test",
            "mem-123",
            new Date("invalid"),
          ),
        ).rejects.toThrow("must be a valid Date");
      });

      it("should accept valid timestamp as number", async () => {
        // Should not throw (will return null if memory doesn't exist)
        const result = await cortex.vector.getAtTimestamp(
          "memspace-test",
          "mem-does-not-exist",
          Date.now(),
        );
        expect(result).toBeNull();
      });

      it("should accept valid timestamp as Date", async () => {
        // Should not throw (will return null if memory doesn't exist)
        const result = await cortex.vector.getAtTimestamp(
          "memspace-test",
          "mem-does-not-exist",
          new Date(),
        );
        expect(result).toBeNull();
      });
    });
  });
});
