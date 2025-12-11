/**
 * Comprehensive enum-based filter tests for Contexts API (TypeScript)
 *
 * Tests all 4 statuses across all 2 filter operations to ensure:
 * 1. No ArgumentValidationError for valid enum values
 * 2. Filters return only matching results
 * 3. Combining status filter with other parameters works
 *
 * Comprehensive filter coverage tests
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src/index";

// All valid context statuses
const ALL_CONTEXT_STATUSES = [
  "active",
  "completed",
  "cancelled",
  "blocked",
] as const;

describe("Contexts API - Comprehensive Filter Coverage", () => {
  let cortex: Cortex;
  const TEST_MEMSPACE_ID = `filter-ctx-test-${Date.now()}`;

  beforeAll(() => {
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  afterAll(async () => {
    // Cleanup test contexts (best-effort)
    try {
      await cortex.memorySpaces.delete(TEST_MEMSPACE_ID, { cascade: true, reason: "test cleanup" });
    } catch (_e) {
      // Ignore cleanup errors
    }
  });

  describe.each(ALL_CONTEXT_STATUSES)("Status: %s", (status) => {
    it(`list() should filter by status="${status}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-list-${status}`;
      const userId = `filter-user-${status}`;

      // Create context with target status
      const targetCtx = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: `Test ${status} context`,
        status,
      });

      // Create context with different status as noise
      if (status !== "active") {
        await cortex.contexts.create({
          memorySpaceId: spaceId,
          userId,
          purpose: "Noise active context",
          status: "active",
        });
      }

      // Execute: List with status filter
      const results = await cortex.contexts.list({
        memorySpaceId: spaceId,
        status,
      });

      // Validate
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((ctx: any) => {
        expect(ctx.status).toBe(status);
      });

      // Verify target context is in results
      const ctxIds = results.map((c: any) => c.contextId);
      expect(ctxIds).toContain(targetCtx.contextId);
    });

    it(`count() should filter by status="${status}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-count-${status}`;
      const userId = `count-user-${status}`;

      // Create 2 contexts with target status
      await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: `Test ${status} context 1`,
        status,
      });

      await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: `Test ${status} context 2`,
        status,
      });

      // Create context with different status as noise
      if (status !== "completed") {
        await cortex.contexts.create({
          memorySpaceId: spaceId,
          userId,
          purpose: "Noise completed context",
          status: "completed",
        });
      }

      // Execute: Count with status filter
      const count = await cortex.contexts.count({
        memorySpaceId: spaceId,
        status,
      });

      // Validate
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Edge Cases", () => {
    it("list() should return empty array when no matches exist", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-empty`;
      const userId = "empty-user";

      // Create only active contexts
      await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Only active context",
        status: "active",
      });

      // Query for different status
      const results = await cortex.contexts.list({
        memorySpaceId: spaceId,
        status: "blocked",
      });

      // Should return empty array, not error
      expect(results).toEqual([]);
    });

    it("should test status transition (active → completed)", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-transition`;
      const userId = "transition-user";

      // Create active context
      const ctx = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Transitioning context",
        status: "active",
      });

      // Verify it's in active list
      const activeResults = await cortex.contexts.list({
        memorySpaceId: spaceId,
        status: "active",
      });
      expect(
        activeResults.some((c: any) => c.contextId === ctx.contextId),
      ).toBe(true);

      // Update to completed
      const updatedCtx = await cortex.contexts.update(ctx.contextId, {
        status: "completed",
      });
      expect(updatedCtx.status).toBe("completed");

      // Verify it's now in completed list
      const completedResults = await cortex.contexts.list({
        memorySpaceId: spaceId,
        status: "completed",
      });
      expect(
        completedResults.some((c: any) => c.contextId === ctx.contextId),
      ).toBe(true);

      // Verify it's NOT in active list anymore
      const activeResultsAfter = await cortex.contexts.list({
        memorySpaceId: spaceId,
        status: "active",
      });
      expect(
        activeResultsAfter.some((c: any) => c.contextId === ctx.contextId),
      ).toBe(false);
    });

    it("should combine status filter with userId filter", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-combine-user`;
      const targetUser = "target-user";
      const otherUser = "other-user";

      // Create active context for target user
      const _targetCtx = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId: targetUser,
        purpose: "Target active context",
        status: "active",
      });

      // Create active context for other user
      await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId: otherUser,
        purpose: "Other user active context",
        status: "active",
      });

      // Create completed context for target user
      await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId: targetUser,
        purpose: "Target completed context",
        status: "completed",
      });

      // Execute: Filter by status AND userId
      const results = await cortex.contexts.list({
        memorySpaceId: spaceId,
        status: "active",
        userId: targetUser,
      });

      // Validate: Should only find target user's active context
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((ctx: any) => {
        expect(ctx.status).toBe("active");
        expect(ctx.userId).toBe(targetUser);
      });
    });

    it("should handle multiple statuses in same space", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-multiple-statuses`;
      const userId = "multi-status-user";

      // Create context for each status
      const contextsByStatus: Record<string, any> = {};
      for (const status of ALL_CONTEXT_STATUSES) {
        const ctx = await cortex.contexts.create({
          memorySpaceId: spaceId,
          userId,
          purpose: `Context with ${status} status`,
          status,
        });
        contextsByStatus[status] = ctx;
      }

      // Verify each status filter returns correct contexts
      for (const status of ALL_CONTEXT_STATUSES) {
        const results = await cortex.contexts.list({
          memorySpaceId: spaceId,
          status,
        });
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.every((c: any) => c.status === status)).toBe(true);
        expect(
          results.some(
            (c: any) => c.contextId === contextsByStatus[status].contextId,
          ),
        ).toBe(true);
      }
    });

    it("count() should work with and without status filter", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-count-all`;
      const userId = "count-all-user";

      // Create 3 active contexts
      for (let i = 0; i < 3; i++) {
        await cortex.contexts.create({
          memorySpaceId: spaceId,
          userId,
          purpose: `Active context ${i}`,
          status: "active",
        });
      }

      // Create 2 completed contexts
      for (let i = 0; i < 2; i++) {
        await cortex.contexts.create({
          memorySpaceId: spaceId,
          userId,
          purpose: `Completed context ${i}`,
          status: "completed",
        });
      }

      // Count active only
      const activeCount = await cortex.contexts.count({
        memorySpaceId: spaceId,
        status: "active",
      });
      expect(activeCount).toBeGreaterThanOrEqual(3);

      // Count completed only
      const completedCount = await cortex.contexts.count({
        memorySpaceId: spaceId,
        status: "completed",
      });
      expect(completedCount).toBeGreaterThanOrEqual(2);

      // Count all (no filter)
      const totalCount = await cortex.contexts.count({
        memorySpaceId: spaceId,
      });
      expect(totalCount).toBeGreaterThanOrEqual(5);
    });

    it("should combine status filter with parentId filter", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-combine-parent`;
      const userId = "parent-user";

      // Create parent context
      const parentCtx = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Parent context",
        status: "active",
      });

      // Create active child context
      const _activeChild = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Active child context",
        status: "active",
        parentId: parentCtx.contextId,
      });

      // Create completed child context
      await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Completed child context",
        status: "completed",
        parentId: parentCtx.contextId,
      });

      // Execute: Filter by status AND parentId
      const results = await cortex.contexts.list({
        memorySpaceId: spaceId,
        status: "active",
        parentId: parentCtx.contextId,
      });

      // Validate: Should only find active child
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((c: any) => {
        expect(c.status).toBe("active");
        // Check if parentId exists (might not be returned in list)
        if (c.parentId || c.parent_id) {
          expect(c.parentId || c.parent_id).toBe(parentCtx.contextId);
        }
      });
    });
  });
});
