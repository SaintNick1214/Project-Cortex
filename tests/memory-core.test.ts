/**
 * E2E Tests: Memory Convenience API - Core Operations
 *
 * Tests remember() and forget() functionality (dual-layer orchestration)
 * Split from memory.test.ts for parallel execution
 */

import { jest } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Memory Core Operations", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("core");
  const TEST_USER_ID = ctx.userId("core");
  const TEST_AGENT_ID = ctx.agentId("core");
  const TEST_USER_NAME = "Test User";

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
  // remember() tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("remember()", () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create a conversation for testing
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });

      testConversationId = conv.conversationId;
    });

    it("stores both messages in ACID and creates 2 vector memories", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "The password is Blue",
        // Agent response with meaningful content (not just acknowledgment)
        agentResponse:
          "The password Blue has been securely stored in your vault",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      // Verify structure
      expect(result.conversation.messageIds).toHaveLength(2);
      expect(result.memories).toHaveLength(2);

      // Verify ACID storage
      const conv = await client.query(api.conversations.get, {
        conversationId: testConversationId,
      });

      expect(conv).not.toBeNull();
      expect(conv!.messages.length).toBeGreaterThanOrEqual(2);

      // Verify Vector storage
      const memory1 = await client.query(api.memories.get, {
        memorySpaceId: TEST_MEMSPACE_ID,
        memoryId: result.memories[0].memoryId,
      });

      expect(memory1).not.toBeNull();
      expect(memory1!.conversationRef).toBeDefined();
      expect(memory1!.conversationRef!.conversationId).toBe(testConversationId);
    });

    it("links vector memories to ACID messages via conversationRef", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Remember this important fact",
        // Agent response with meaningful content (not just acknowledgment)
        agentResponse:
          "This important fact has been stored for future reference",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      // Verify both memories created (agent response has meaningful content)
      expect(result.memories).toHaveLength(2);

      // Check user memory
      const userMemory = result.memories[0];

      expect(userMemory.conversationRef).toBeDefined();
      expect(userMemory.conversationRef!.messageIds).toContain(
        result.conversation.messageIds[0],
      );

      // Check agent memory
      const agentMemory = result.memories[1];

      expect(agentMemory.conversationRef).toBeDefined();
      expect(agentMemory.conversationRef!.messageIds).toContain(
        result.conversation.messageIds[1],
      );
    });

    it("skips vector storage for agent acknowledgments (noise filtering)", async () => {
      // Test that pure acknowledgments like "Got it!" don't create vector memories
      // This improves semantic search quality by filtering noise
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "My favorite color is purple",
        agentResponse: "Got it!", // Pure acknowledgment - no semantic value
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      // Only user memory should be created (agent acknowledgment filtered)
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toContain("purple");
      expect(result.memories[0].messageRole).toBe("user");

      // ACID still has both messages (for conversation history)
      expect(result.conversation.messageIds).toHaveLength(2);
    });

    it("handles embedding generation callback", async () => {
      let callCount = 0;
      const mockEmbed = async (_content: string) => {
        callCount++;

        return [0.1, 0.2, 0.3]; // Mock embedding
      };

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test embedding",
        agentResponse: "Embedded!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        generateEmbedding: mockEmbed,
      });

      // Verify callback was called
      expect(callCount).toBe(2); // Once for each message

      // Verify embeddings stored
      expect(result.memories[0].embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.memories[1].embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it("handles content extraction callback", async () => {
      let callCount = 0;
      const mockExtract = async (_user: string, _agent: string) => {
        callCount++;

        return `Extracted: ${_user}`;
      };

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Long user message with lots of detail",
        agentResponse: "Short response",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        extractContent: mockExtract,
      });

      // Verify extraction was called
      expect(callCount).toBe(1);

      // Verify extracted content
      expect(result.memories[0].content).toBe(
        "Extracted: Long user message with lots of detail",
      );
      expect(result.memories[0].contentType).toBe("summarized");
    });

    it("applies importance and tags to memories", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Critical password information",
        agentResponse: "Stored securely",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        importance: 95,
        tags: ["password", "security", "critical"],
      });

      // Verify metadata
      expect(result.memories[0].importance).toBe(95);
      expect(result.memories[0].tags).toEqual(
        expect.arrayContaining(["password", "security", "critical"]),
      );
      expect(result.memories[1].importance).toBe(95);
      expect(result.memories[1].tags).toEqual(
        expect.arrayContaining(["password", "security", "critical"]),
      );
    });

    it("defaults to importance=50 when not specified", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Regular message",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      expect(result.memories[0].importance).toBe(50);
      expect(result.memories[1].importance).toBe(50);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // forget() tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("forget()", () => {
    let testMemoryId: string;
    let testConversationId: string;

    beforeEach(async () => {
      // Create conversation and memory
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });

      testConversationId = conv.conversationId;

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Memory to forget",
        agentResponse: "Noted",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      testMemoryId = result.memories[0].memoryId;
    });

    it("deletes from vector by default", async () => {
      const result = await cortex.memory.forget(TEST_MEMSPACE_ID, testMemoryId);

      expect(result.memoryDeleted).toBe(true);
      expect(result.conversationDeleted).toBe(false);
      expect(result.restorable).toBe(true); // ACID preserved

      // Verify vector deleted
      const memory = await cortex.vector.get(TEST_MEMSPACE_ID, testMemoryId);

      expect(memory).toBeNull();

      // Verify ACID preserved
      const conv = await cortex.conversations.get(testConversationId);

      expect(conv).not.toBeNull();
    });

    it("deletes from both layers when deleteConversation=true", async () => {
      const result = await cortex.memory.forget(
        TEST_MEMSPACE_ID,
        testMemoryId,
        {
          deleteConversation: true,
          deleteEntireConversation: true,
        },
      );

      expect(result.memoryDeleted).toBe(true);
      expect(result.conversationDeleted).toBe(true);
      expect(result.restorable).toBe(false); // Both layers deleted

      // Verify vector deleted
      const memory = await cortex.vector.get(TEST_MEMSPACE_ID, testMemoryId);

      expect(memory).toBeNull();

      // Verify ACID deleted
      const conv = await cortex.conversations.get(testConversationId);

      expect(conv).toBeNull();
    });

    it("throws error for non-existent memory", async () => {
      // Backend validation: existence check
      await expect(
        cortex.memory.forget(TEST_MEMSPACE_ID, "non-existent"),
      ).rejects.toThrow("MEMORY_NOT_FOUND");
    });
  });
});
