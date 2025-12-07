/**
 * E2E Tests: Memory Convenience API - Archive and Restore
 *
 * Tests archive and restore operations
 * Split from memory.test.ts for parallel execution
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Memory Archive Operations", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);

    // NOTE: Removed purgeAll() to enable parallel test execution.
    // Each test uses ctx-scoped IDs to avoid conflicts.
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Archive and Restore Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Archive and Restore Operations", () => {
    it("restores memory from archive", async () => {
      const memorySpaceId = ctx.memorySpaceId("archive");
      const userId = ctx.userId("archive-test");
      const agentId = ctx.agentId("archive-test");

      // Create and archive a memory
      const conv = await cortex.conversations.create({
        memorySpaceId,
        type: "user-agent",
        participants: {
          userId,
          agentId,
          participantId: agentId,
        },
      });

      const result = await cortex.memory.remember({
        memorySpaceId,
        conversationId: conv.conversationId,
        userMessage: "Important information",
        agentResponse: "Got it!",
        userId,
        userName: "Test User",
        agentId,
        importance: 80,
      });

      const memoryId = result.memories[0].memoryId;

      // Archive it
      const archived = await cortex.memory.archive(memorySpaceId, memoryId);
      expect(archived.archived).toBe(true);

      // Verify it's archived
      const archivedMemory = await cortex.vector.get(memorySpaceId, memoryId);
      expect(archivedMemory?.tags).toContain("archived");
      expect(archivedMemory?.importance).toBeLessThanOrEqual(10);

      // Restore from archive
      const restored = await cortex.memory.restoreFromArchive(
        memorySpaceId,
        memoryId,
      );

      expect(restored.restored).toBe(true);
      expect(restored.memoryId).toBe(memoryId);

      // Verify restoration
      const restoredMemory = await cortex.vector.get(memorySpaceId, memoryId);
      expect(restoredMemory?.tags).not.toContain("archived");
      expect(restoredMemory?.importance).toBeGreaterThanOrEqual(50);
    });

    it("throws error when restoring non-archived memory", async () => {
      const memorySpaceId = ctx.memorySpaceId("restore-error");
      const userId = ctx.userId("restore-error");
      const agentId = ctx.agentId("restore-error");

      const conv = await cortex.conversations.create({
        memorySpaceId,
        type: "user-agent",
        participants: {
          userId,
          agentId,
          participantId: agentId,
        },
      });

      const result = await cortex.memory.remember({
        memorySpaceId,
        conversationId: conv.conversationId,
        userMessage: "Not archived",
        agentResponse: "OK",
        userId,
        userName: "Test User",
        agentId,
      });

      const memoryId = result.memories[0].memoryId;

      // Try to restore without archiving first
      // Backend validation: archive status check
      await expect(
        cortex.memory.restoreFromArchive(memorySpaceId, memoryId),
      ).rejects.toThrow();
    });
  });
});
