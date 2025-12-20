/**
 * Comprehensive enum-based filter tests for Conversations API (TypeScript)
 *
 * Tests both conversation types across all 3 filter operations to ensure:
 * 1. No ArgumentValidationError for valid enum values
 * 2. Filters return only matching results
 * 3. Combining type filter with other parameters works
 *
 * Comprehensive filter coverage tests
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src/index";

// All valid conversation types
const ALL_CONVERSATION_TYPES = ["user-agent", "agent-agent"] as const;

describe("Conversations API - Comprehensive Filter Coverage", () => {
  let cortex: Cortex;
  const TEST_MEMSPACE_ID = `filter-conv-test-${Date.now()}`;

  beforeAll(() => {
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  afterAll(async () => {
    // Cleanup test conversations (best-effort)
    try {
      await cortex.memorySpaces.delete(TEST_MEMSPACE_ID, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch (_e) {
      // Ignore cleanup errors
    }
  });

  describe.each(ALL_CONVERSATION_TYPES)("Type: %s", (convType) => {
    it(`list() should filter by type="${convType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-list-${convType}`;

      // Create conversation of target type
      let targetConv;
      if (convType === "user-agent") {
        targetConv = await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "user-agent",
          participants: {
            userId: "filter-test-user",
            agentId: "filter-test-agent",
          },
        });
      } else {
        targetConv = await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "agent-agent",
          participants: {
            participantId: "agent-a",
            memorySpaceIds: ["a1", "a2"],
          },
        });
      }

      // Create conversation of different type as noise
      if (convType === "user-agent") {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "agent-agent",
          participants: {
            participantId: "noise-a",
            memorySpaceIds: ["n1", "n2"],
          },
        });
      } else {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "user-agent",
          participants: { userId: "noise-user", agentId: "noise-agent" },
        });
      }

      // Execute: List with type filter
      const results = await cortex.conversations.list({
        type: convType,
        memorySpaceId: spaceId,
      });

      // Validate
      expect(results.conversations.length).toBeGreaterThanOrEqual(1);
      results.conversations.forEach((conv: any) => {
        expect(conv.type).toBe(convType);
      });

      // Verify target conversation is in results
      const convIds = results.conversations.map((c: any) => c.conversationId);
      expect(convIds).toContain(targetConv.conversationId);
    });

    it(`count() should filter by type="${convType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-count-${convType}`;

      // Create 2 conversations of target type
      if (convType === "user-agent") {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "user-agent",
          participants: { userId: "count-user-1", agentId: "count-agent-1" },
        });
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "user-agent",
          participants: { userId: "count-user-2", agentId: "count-agent-2" },
        });
      } else {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "agent-agent",
          participants: {
            participantId: "count-a1",
            memorySpaceIds: ["a1", "a2"],
          },
        });
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "agent-agent",
          participants: {
            participantId: "count-a2",
            memorySpaceIds: ["a1", "a2"],
          },
        });
      }

      // Create different type as noise
      if (convType === "user-agent") {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "agent-agent",
          participants: {
            participantId: "noise",
            memorySpaceIds: ["n1", "n2"],
          },
        });
      } else {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "user-agent",
          participants: { userId: "noise-user", agentId: "noise-agent" },
        });
      }

      // Execute: Count with type filter
      const count = await cortex.conversations.count({ type: convType });

      // Validate
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it(`search() should filter by type="${convType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-search-${convType}`;
      const searchTerm = "searchable";

      // Create conversation with searchable message
      let targetConv;
      if (convType === "user-agent") {
        targetConv = await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "user-agent",
          participants: { userId: "search-user", agentId: "search-agent" },
        });
      } else {
        targetConv = await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "agent-agent",
          participants: {
            participantId: "search-a",
            memorySpaceIds: ["s1", "s2"],
          },
        });
      }

      // Add message with search term
      await cortex.conversations.addMessage({
        conversationId: targetConv.conversationId,
        message: {
          content: `${searchTerm} message content`,
          role: "user",
        },
      });

      // Execute: Search with type filter
      const results = await cortex.conversations.search({
        query: searchTerm,
        filters: { type: convType, memorySpaceId: spaceId },
      });

      // Validate
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((result: any) => {
        expect(result.conversation.type).toBe(convType);
      });
    });
  });

  describe("Edge Cases", () => {
    it("list() should return empty array when no matches exist", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-empty`;

      // Create only user-agent conversations
      await cortex.conversations.create({
        memorySpaceId: spaceId,
        type: "user-agent",
        participants: { userId: "only-user", agentId: "only-agent" },
      });

      // Query for agent-agent type
      const results = await cortex.conversations.list({
        type: "agent-agent",
        memorySpaceId: spaceId,
      });

      // Should return empty conversations array, not error
      expect(results.conversations).toEqual([]);
    });

    it("list() should find both types in same memory space", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-both-types`;

      // Create user-agent conversation
      const uaConv = await cortex.conversations.create({
        memorySpaceId: spaceId,
        type: "user-agent",
        participants: { userId: "both-user", agentId: "both-agent" },
      });

      // Create agent-agent conversation
      const aaConv = await cortex.conversations.create({
        memorySpaceId: spaceId,
        type: "agent-agent",
        participants: { participantId: "both-a", memorySpaceIds: ["b1", "b2"] },
      });

      // List user-agent
      const uaResults = await cortex.conversations.list({
        type: "user-agent",
        memorySpaceId: spaceId,
      });
      expect(uaResults.conversations.length).toBeGreaterThanOrEqual(1);
      expect(
        uaResults.conversations.every((c: any) => c.type === "user-agent"),
      ).toBe(true);
      expect(
        uaResults.conversations.some(
          (c: any) => c.conversationId === uaConv.conversationId,
        ),
      ).toBe(true);

      // List agent-agent
      const aaResults = await cortex.conversations.list({
        type: "agent-agent",
        memorySpaceId: spaceId,
      });
      expect(aaResults.conversations.length).toBeGreaterThanOrEqual(1);
      expect(
        aaResults.conversations.every((c: any) => c.type === "agent-agent"),
      ).toBe(true);
      expect(
        aaResults.conversations.some(
          (c: any) => c.conversationId === aaConv.conversationId,
        ),
      ).toBe(true);
    });

    it("should combine type filter with userId filter", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-combine-user`;
      const targetUser = "combine-user";

      // Create user-agent conversation with target user
      const _targetConv = await cortex.conversations.create({
        memorySpaceId: spaceId,
        type: "user-agent",
        participants: { userId: targetUser, agentId: "target-agent" },
      });

      // Create user-agent conversation with different user
      await cortex.conversations.create({
        memorySpaceId: spaceId,
        type: "user-agent",
        participants: { userId: "different-user", agentId: "different-agent" },
      });

      // Create agent-agent conversation (wrong type)
      await cortex.conversations.create({
        memorySpaceId: spaceId,
        type: "agent-agent",
        participants: {
          participantId: "agent-a",
          memorySpaceIds: ["a1", "a2"],
        },
      });

      // Execute: Combine type + userId filters
      const results = await cortex.conversations.list({
        type: "user-agent",
        userId: targetUser,
        memorySpaceId: spaceId,
      });

      // Validate: Should only find target conversation
      expect(results.conversations.length).toBeGreaterThanOrEqual(1);
      results.conversations.forEach((conv: any) => {
        expect(conv.type).toBe("user-agent");
        // Check userId is in participants (participants is an object, not array)
        expect(conv.participants.userId).toBe(targetUser);
      });
    });

    it("count() should work with and without type filter", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-count-all`;

      // Create 3 user-agent
      for (let i = 0; i < 3; i++) {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "user-agent",
          participants: {
            userId: `count-all-user-${i}`,
            agentId: `count-all-agent-${i}`,
          },
        });
      }

      // Create 2 agent-agent
      for (let i = 0; i < 2; i++) {
        await cortex.conversations.create({
          memorySpaceId: spaceId,
          type: "agent-agent",
          participants: {
            participantId: `count-all-a-${i}`,
            memorySpaceIds: ["a1", "a2"],
          },
        });
      }

      // Count user-agent only
      const uaCount = await cortex.conversations.count({
        type: "user-agent",
      });
      expect(uaCount).toBeGreaterThanOrEqual(3);

      // Count agent-agent only
      const aaCount = await cortex.conversations.count({
        type: "agent-agent",
      });
      expect(aaCount).toBeGreaterThanOrEqual(2);

      // Count all (no filter)
      const totalCount = await cortex.conversations.count({});
      expect(totalCount).toBeGreaterThanOrEqual(5);
    });

    it("search() should return empty when filtering by wrong type", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-search-empty`;
      const searchTerm = "unique";

      // Create only user-agent conversations
      const conv = await cortex.conversations.create({
        memorySpaceId: spaceId,
        type: "user-agent",
        participants: { userId: "unique-user", agentId: "unique-agent" },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          content: `${searchTerm} message`,
          role: "user",
        },
      });

      // Search for agent-agent type (should be empty)
      const results = await cortex.conversations.search({
        query: searchTerm,
        filters: { type: "agent-agent", memorySpaceId: spaceId },
      });

      // Should return empty array
      expect(results).toEqual([]);
    });
  });
});
