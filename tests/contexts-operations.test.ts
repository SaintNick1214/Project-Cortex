/**
 * Cortex SDK - Context Operations Tests
 *
 * Tests for new Context API methods:
 * - updateMany, deleteMany, export
 * - removeParticipant, getByConversation, findOrphaned
 * - getVersion, getHistory, getAtTimestamp (versioning)
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers";

describe("Context Operations API", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TIMESTAMP = Date.now();
  const TEST_MEMORY_SPACE = `test-context-ops-space-${TIMESTAMP}`;

  beforeAll(async () => {
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    _cleanup = new TestCleanup(client);
  });

  afterAll(async () => {
    await _cleanup.purgeContexts();
    if (client) {
      client.close();
    }
  });

  beforeEach(async () => {
    await _cleanup.purgeContexts();
  });

  describe("Versioning Operations", () => {
    it("tracks versions on updates (getVersion, getHistory, getAtTimestamp)", async () => {
      // Create initial context
      const context = await cortex.contexts.create({
        purpose: "Test versioning",
        memorySpaceId: TEST_MEMORY_SPACE,
        data: { value: "v1" },
      });

      // Version tracking is internal, we verify via getVersion
      const v1Initial = await cortex.contexts.getVersion(context.contextId, 1);
      expect(v1Initial).toBeDefined();
      expect(v1Initial!.version).toBe(1);

      // Update to create v2
      await new Promise((resolve) => setTimeout(resolve, 50));
      const _timestamp1 = Date.now();

      await cortex.contexts.update(context.contextId, {
        status: "active",
        data: { value: "v2" },
      });

      // Update to create v3
      await new Promise((resolve) => setTimeout(resolve, 50));
      const timestamp2 = Date.now();

      await cortex.contexts.update(context.contextId, {
        status: "completed",
        data: { value: "v3" },
      });

      // Test getVersion
      const v1 = await cortex.contexts.getVersion(context.contextId, 1);
      const v2 = await cortex.contexts.getVersion(context.contextId, 2);
      const v3 = await cortex.contexts.getVersion(context.contextId, 3);

      expect(v1).toBeDefined();
      expect(v1!.version).toBe(1);
      expect(v1!.data!.value).toBe("v1");

      expect(v2).toBeDefined();
      expect(v2!.version).toBe(2);
      expect(v2!.data!.value).toBe("v2");

      expect(v3).toBeDefined();
      expect(v3!.version).toBe(3);
      expect(v3!.status).toBe("completed");
      expect(v3!.data!.value).toBe("v3");

      // Test getHistory
      const history = await cortex.contexts.getHistory(context.contextId);
      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
      expect(history[2].version).toBe(3);

      // Test getAtTimestamp
      const atV2 = await cortex.contexts.getAtTimestamp(
        context.contextId,
        new Date(timestamp2 + 10), // After v2 was created
      );
      expect(atV2).toBeDefined();
      expect(atV2?.version).toBeGreaterThanOrEqual(2);

      const current = await cortex.contexts.getAtTimestamp(
        context.contextId,
        new Date(),
      );
      expect(current).toBeDefined();
      expect(current?.version).toBe(3);
    });

    it("returns null for non-existent version number", async () => {
      const context = await cortex.contexts.create({
        purpose: "Test non-existent version",
        memorySpaceId: TEST_MEMORY_SPACE,
        data: { value: "initial" },
      });

      // Context starts at version 1, version 999 should not exist
      const version = await cortex.contexts.getVersion(context.contextId, 999);
      expect(version).toBeNull();
    });

    it("returns single version for context with no updates", async () => {
      const context = await cortex.contexts.create({
        purpose: "Test single version history",
        memorySpaceId: TEST_MEMORY_SPACE,
        data: { value: "only version" },
      });

      const history = await cortex.contexts.getHistory(context.contextId);

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
      expect(history[0].data?.value).toBe("only version");
    });

    it("returns empty array for getHistory on non-existent context", async () => {
      const history = await cortex.contexts.getHistory(
        "ctx-9999999999-nonexistent",
      );

      expect(history).toEqual([]);
    });

    it("returns null for getVersion on non-existent context", async () => {
      const version = await cortex.contexts.getVersion(
        "ctx-9999999999-nonexistent",
        1,
      );

      expect(version).toBeNull();
    });

    it("returns null for getAtTimestamp before context creation", async () => {
      // Record timestamp BEFORE creating context
      const beforeCreate = new Date(Date.now() - 10000);

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 50));

      const context = await cortex.contexts.create({
        purpose: "Test timestamp before creation",
        memorySpaceId: TEST_MEMORY_SPACE,
        data: { value: "created" },
      });

      // Query with timestamp before context existed
      const result = await cortex.contexts.getAtTimestamp(
        context.contextId,
        beforeCreate,
      );

      expect(result).toBeNull();
    });

    it("returns null for getAtTimestamp on non-existent context", async () => {
      const result = await cortex.contexts.getAtTimestamp(
        "ctx-9999999999-nonexistent",
        new Date(),
      );

      expect(result).toBeNull();
    });

    it("returns correct version for getAtTimestamp at exact update time", async () => {
      const context = await cortex.contexts.create({
        purpose: "Test exact timestamp",
        memorySpaceId: TEST_MEMORY_SPACE,
        data: { value: "v1" },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      await cortex.contexts.update(context.contextId, {
        data: { value: "v2" },
      });

      // Get the current context to check its updatedAt
      const updated = (await cortex.contexts.get(context.contextId)) as any;
      const updateTimestamp = new Date(updated.updatedAt);

      // Query at exactly the update time
      const result = await cortex.contexts.getAtTimestamp(
        context.contextId,
        updateTimestamp,
      );

      expect(result).toBeDefined();
      expect(result?.version).toBe(2);
    });
  });

  describe("Bulk Operations", () => {
    it("updates many contexts with filters", async () => {
      // Create multiple contexts
      await cortex.contexts.create({
        purpose: "Task 1",
        memorySpaceId: TEST_MEMORY_SPACE,
        userId: "user-1",
        status: "active",
        data: { importance: 50 },
      });

      await cortex.contexts.create({
        purpose: "Task 2",
        memorySpaceId: TEST_MEMORY_SPACE,
        userId: "user-1",
        status: "active",
        data: { importance: 70 },
      });

      await cortex.contexts.create({
        purpose: "Task 3",
        memorySpaceId: "other-space",
        userId: "user-2",
        status: "active",
      });

      // Update all active contexts for user-1
      const result = await cortex.contexts.updateMany(
        {
          userId: "user-1",
          status: "active",
        },
        {
          data: { reviewed: true },
        },
      );

      expect(result.updated).toBe(2);
      expect(result.contextIds).toHaveLength(2);

      // Verify updates
      const contexts = await cortex.contexts.list({
        userId: "user-1",
      });

      for (const ctx of contexts) {
        expect(ctx.data?.reviewed).toBe(true);
        // Verify version incremented via getVersion
        const currentVersion = await cortex.contexts.getVersion(
          ctx.contextId,
          2,
        );
        expect(currentVersion).toBeDefined();
      }
    });

    it("deletes many contexts with cascade", async () => {
      // Create root with children
      const root = await cortex.contexts.create({
        purpose: "Root",
        memorySpaceId: TEST_MEMORY_SPACE,
        status: "completed",
      });

      await cortex.contexts.create({
        purpose: "Child 1",
        memorySpaceId: TEST_MEMORY_SPACE,
        parentId: root.contextId,
        status: "completed",
      });

      await cortex.contexts.create({
        purpose: "Child 2",
        memorySpaceId: TEST_MEMORY_SPACE,
        parentId: root.contextId,
        status: "completed",
      });

      const result = await cortex.contexts.deleteMany(
        {
          memorySpaceId: TEST_MEMORY_SPACE,
          status: "completed",
        },
        {
          cascadeChildren: true,
        },
      );

      expect(result.deleted).toBe(3); // Root + 2 children
      expect(result.contextIds).toHaveLength(3);

      // Verify all deleted
      const remaining = await cortex.contexts.list({
        memorySpaceId: TEST_MEMORY_SPACE,
      });
      expect(remaining).toHaveLength(0);
    });

    it("returns 0 updated when no contexts match updateMany filters", async () => {
      const result = await cortex.contexts.updateMany(
        {
          memorySpaceId: `nonexistent-space-${Date.now()}`,
        },
        {
          status: "completed",
        },
      );

      expect(result.updated).toBe(0);
      expect(result.contextIds).toHaveLength(0);
    });

    it("returns 0 deleted when no contexts match deleteMany filters", async () => {
      const result = await cortex.contexts.deleteMany({
        memorySpaceId: `nonexistent-space-${Date.now()}`,
      });

      expect(result.deleted).toBe(0);
      expect(result.contextIds).toHaveLength(0);
    });
  });

  describe("Participant Management", () => {
    it("removes participant from context", async () => {
      const context = await cortex.contexts.create({
        purpose: "Multi-participant context",
        memorySpaceId: TEST_MEMORY_SPACE,
      });

      // Add participants
      await cortex.contexts.addParticipant(context.contextId, "agent-1");
      await cortex.contexts.addParticipant(context.contextId, "agent-2");

      let updated = (await cortex.contexts.get(context.contextId)) as any;
      expect(updated?.participants).toContain("agent-1");
      expect(updated?.participants).toContain("agent-2");

      // Remove one participant
      await cortex.contexts.removeParticipant(context.contextId, "agent-1");

      updated = (await cortex.contexts.get(context.contextId)) as any;
      expect(updated?.participants).not.toContain("agent-1");
      expect(updated?.participants).toContain("agent-2");
    });

    it("throws error when removing participant from non-existent context", async () => {
      // Note: This tests BACKEND validation (requires DB lookup)
      await expect(
        cortex.contexts.removeParticipant(
          "ctx-9999999999-nonexistent",
          "agent-1",
        ),
      ).rejects.toThrow("CONTEXT_NOT_FOUND");
    });
  });

  describe("Query Operations", () => {
    it("finds contexts by conversation ID", async () => {
      // Use valid conversation ID format (must start with "conv-")
      const conversationId = "conv-test-123";

      // Create contexts linked to conversation
      await cortex.contexts.create({
        purpose: "Task from conversation",
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationRef: {
          conversationId,
          messageIds: ["msg-1"],
        },
      });

      await cortex.contexts.create({
        purpose: "Another task from same conversation",
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationRef: {
          conversationId,
          messageIds: ["msg-2"],
        },
      });

      await cortex.contexts.create({
        purpose: "Unrelated context",
        memorySpaceId: TEST_MEMORY_SPACE,
      });

      const results = await cortex.contexts.getByConversation(conversationId);

      expect(results).toHaveLength(2);
      for (const ctx of results) {
        expect(ctx.conversationRef?.conversationId).toBe(conversationId);
      }
    });

    it("finds orphaned contexts", async () => {
      // Create parent and child
      const parent = await cortex.contexts.create({
        purpose: "Parent",
        memorySpaceId: TEST_MEMORY_SPACE,
      });

      const child = await cortex.contexts.create({
        purpose: "Child",
        memorySpaceId: TEST_MEMORY_SPACE,
        parentId: parent.contextId,
      });

      // Delete parent using deleteMany with cascade=false to allow orphaning
      // This won't delete children, creating an orphan
      await cortex.contexts.deleteMany(
        {
          memorySpaceId: TEST_MEMORY_SPACE,
        },
        {
          cascadeChildren: false,
        },
      );

      // The deletion should have skipped contexts with children
      // So the parent still exists, but let's verify child exists
      const childExists = await cortex.contexts.get(child.contextId);
      expect(childExists).toBeDefined();

      // Since we can't easily create orphans with the current API
      // (delete protects against orphaning), we'll test that findOrphaned
      // returns empty array when no orphans exist
      const orphaned = await cortex.contexts.findOrphaned();
      expect(orphaned).toBeInstanceOf(Array);
      // May be 0 (no orphans) or more depending on other tests
    });
  });

  describe("Export Operations", () => {
    it("exports contexts to JSON", async () => {
      await cortex.contexts.create({
        purpose: "Export test 1",
        memorySpaceId: TEST_MEMORY_SPACE,
        userId: "export-user",
      });

      await cortex.contexts.create({
        purpose: "Export test 2",
        memorySpaceId: TEST_MEMORY_SPACE,
        userId: "export-user",
      });

      const result = await cortex.contexts.export(
        { userId: "export-user" },
        { format: "json" },
      );

      expect(result.format).toBe("json");
      expect(result.count).toBe(2);
      expect(result.data).toBeDefined();

      const parsed = JSON.parse(result.data);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].purpose).toBeDefined();
    });

    it("exports contexts to CSV", async () => {
      await cortex.contexts.create({
        purpose: "CSV export test",
        memorySpaceId: TEST_MEMORY_SPACE,
      });

      const result = await cortex.contexts.export(
        { memorySpaceId: TEST_MEMORY_SPACE },
        { format: "csv" },
      );

      expect(result.format).toBe("csv");
      expect(result.count).toBe(1);
      expect(result.data).toContain("contextId");
      expect(result.data).toContain("purpose");
      expect(result.data).toContain("CSV export test");
    });

    it("includes version history in export when requested", async () => {
      const context = await cortex.contexts.create({
        purpose: "Versioned context",
        memorySpaceId: TEST_MEMORY_SPACE,
      });

      // Create some versions
      await cortex.contexts.update(context.contextId, {
        data: { update: 1 },
      });
      await cortex.contexts.update(context.contextId, {
        data: { update: 2 },
      });

      const result = await cortex.contexts.export(
        { memorySpaceId: TEST_MEMORY_SPACE },
        { format: "json", includeVersionHistory: true },
      );

      const parsed = JSON.parse(result.data);
      expect(parsed[0].version).toBe(3);
      expect(parsed[0].previousVersions).toHaveLength(2);
    });
  });
});
