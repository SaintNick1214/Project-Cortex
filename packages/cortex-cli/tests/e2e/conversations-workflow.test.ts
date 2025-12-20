/**
 * Conversations Workflow E2E Tests
 *
 * End-to-end tests for conversation management.
 * These tests require CONVEX_URL to be set.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "@cortexmemory/sdk";
import { cleanupTestData } from "../setup.js";

// Skip these tests if no Convex URL is configured
const CONVEX_URL = process.env.CONVEX_URL;
const describeE2E = CONVEX_URL ? describe : describe.skip;

describeE2E("Conversations Workflow E2E", () => {
  let cortex: Cortex;
  const TIMESTAMP = Date.now();
  const TEST_PREFIX = `e2e-conv-${TIMESTAMP}`;
  const TEST_SPACE_ID = `${TEST_PREFIX}-space`;
  const TEST_USER_ID = `${TEST_PREFIX}-user`;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL! });
    await cleanupTestData(TEST_PREFIX);

    // Create test space
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_SPACE_ID,
      name: "E2E Conversations Test Space",
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

  describe("Conversation CRUD Operations", () => {
    let testConversationId: string;

    it("should create a conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_SPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: "conv-test-agent",
          participantId: "conv-test-agent",
        },
      });

      testConversationId = conv.conversationId;
      expect(testConversationId).toBeDefined();
    });

    it("should get a conversation", async () => {
      const conv = await cortex.conversations.get(testConversationId);

      expect(conv).not.toBeNull();
      expect(conv!.conversationId).toBe(testConversationId);
    });

    it("should return null for non-existent conversation", async () => {
      const conv = await cortex.conversations.get("nonexistent-conv-id");
      expect(conv).toBeNull();
    });

    it("should add messages via remember", async () => {
      await cortex.memory.remember({
        memorySpaceId: TEST_SPACE_ID,
        conversationId: testConversationId,
        userMessage: "First test message",
        agentResponse: "First test response",
        userId: TEST_USER_ID,
        agentId: "conv-test-agent",
        userName: "Test User",
      });

      await cortex.memory.remember({
        memorySpaceId: TEST_SPACE_ID,
        conversationId: testConversationId,
        userMessage: "Second test message",
        agentResponse: "Second test response",
        userId: TEST_USER_ID,
        agentId: "conv-test-agent",
        userName: "Test User",
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const conv = await cortex.conversations.get(testConversationId);
      expect(conv!.messageCount).toBeGreaterThanOrEqual(4);
    });

    it("should delete a conversation", async () => {
      // Create a conversation to delete
      const deleteConv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_SPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: "delete-test-agent",
          participantId: "delete-test-agent",
        },
      });

      const result = await cortex.conversations.delete(
        deleteConv.conversationId,
      );

      expect(result.deleted).toBe(true);

      // Verify deleted
      const deleted = await cortex.conversations.get(deleteConv.conversationId);
      expect(deleted).toBeNull();
    });
  });

  describe("Conversation Listing", () => {
    beforeAll(async () => {
      // Create multiple conversations
      for (let i = 0; i < 3; i++) {
        await cortex.conversations.create({
          type: "user-agent",
          memorySpaceId: TEST_SPACE_ID,
          participants: {
            userId: `${TEST_USER_ID}-list-${i}`,
            agentId: "list-test-agent",
            participantId: "list-test-agent",
          },
        });
      }
    });

    it("should list conversations", async () => {
      const result = await cortex.conversations.list({ limit: 100 });
      const convs = result.conversations || result;

      expect(convs.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter by space", async () => {
      const result = await cortex.conversations.list({
        memorySpaceId: TEST_SPACE_ID,
        limit: 100,
      });
      const convs = result.conversations || result;

      convs.forEach((conv) => {
        expect(conv.memorySpaceId).toBe(TEST_SPACE_ID);
      });
    });

    it("should filter by user", async () => {
      const result = await cortex.conversations.list({
        userId: `${TEST_USER_ID}-list-0`,
        limit: 100,
      });
      const convs = result.conversations || result;

      convs.forEach((conv) => {
        const participants = conv.participants as Record<string, unknown>;
        expect(participants.userId).toBe(`${TEST_USER_ID}-list-0`);
      });
    });

    it("should respect limit", async () => {
      const result = await cortex.conversations.list({ limit: 2 });
      const convs = result.conversations || result;

      expect(convs.length).toBeLessThanOrEqual(2);
    });

    it("should count conversations", async () => {
      const count = await cortex.conversations.count();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    });

    it("should count by space", async () => {
      const count = await cortex.conversations.count({
        memorySpaceId: TEST_SPACE_ID,
      });

      expect(typeof count).toBe("number");
    });
  });

  describe("Conversation Types", () => {
    it("should create user-agent conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_SPACE_ID,
        participants: {
          userId: `${TEST_USER_ID}-type-test`,
          agentId: "type-test-agent",
          participantId: "type-test-agent",
        },
      });

      expect(conv.type).toBe("user-agent");
    });
  });
});
