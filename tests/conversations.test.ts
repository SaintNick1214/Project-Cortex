/**
 * Cortex SDK - Conversations API E2E Tests
 *
 * Tests the complete Layer 1a implementation:
 * - SDK API calls
 * - Convex mutations/queries
 * - Storage validation
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup } from "./helpers";

describe("Conversations API (Layer 1a)", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    // Initialize SDK
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    // Direct client for storage validation
    client = new ConvexClient(CONVEX_URL);
    // Cleanup helper
    cleanup = new TestCleanup(client);

    // 🧹 Purge conversations table before all tests
    console.log("\n🧹 Purging conversations table before tests...");
    const result = await cleanup.purgeConversations();

    console.log(`✅ Purged ${result.deleted} conversations\n`);

    // Verify empty (warn if not, but don't fail - parallel tests might create data)
    await cleanup.verifyConversationsEmpty();
  });

  afterAll(async () => {
    cortex.close();
    await client.close();
  });

  describe("create()", () => {
    it("creates a user-agent conversation", async () => {
      const result = await cortex.conversations.create({
        memorySpaceId: "test-space-1",
        participantId: "test-agent",
        type: "user-agent",
        participants: {
          userId: "user-123",
          participantId: "agent-456",
        },
        metadata: {
          source: "test",
        },
      });

      // Validate SDK response
      expect(result.conversationId).toMatch(/^conv-/);
      expect(result.type).toBe("user-agent");
      expect(result.participants.userId).toBe("user-123");
      expect(result.participants.participantId).toBe("agent-456");
      expect(result.messageCount).toBe(0);
      expect(result.messages).toHaveLength(0);
      expect(result.metadata).toEqual({ source: "test" });
      expect(result.createdAt).toBeGreaterThan(0);
      expect(result.updatedAt).toBeGreaterThan(0);

      // Validate Convex storage
      const stored = await client.query(api.conversations.get, {
        conversationId: result.conversationId,
      });

      expect(stored).not.toBeNull();
      expect(stored!._id).toBeDefined();
      expect(stored!.conversationId).toBe(result.conversationId);
      expect(stored!.type).toBe("user-agent");
      expect(stored!.participants.userId).toBe("user-123");
      expect(stored!.participants.participantId).toBe("agent-456");
      expect(stored!.messages).toEqual([]);
      expect(stored!.messageCount).toBe(0);
    });

    it("creates an agent-agent conversation", async () => {
      const result = await cortex.conversations.create({
        memorySpaceId: "test-collab-space",
        type: "agent-agent",
        participants: {
          memorySpaceIds: ["agent-1", "agent-2", "agent-3"],
        },
      });

      // Validate SDK response
      expect(result.type).toBe("agent-agent");
      expect(result.participants.memorySpaceIds).toEqual([
        "agent-1",
        "agent-2",
        "agent-3",
      ]);
      expect(result.messageCount).toBe(0);

      // Validate storage
      const stored = await client.query(api.conversations.get, {
        conversationId: result.conversationId,
      });

      expect(stored!.type).toBe("agent-agent");
      expect(stored!.participants.memorySpaceIds).toHaveLength(3);
    });

    it("accepts custom conversationId", async () => {
      const customId = "conv-custom-123";

      const result = await cortex.conversations.create({
        conversationId: customId,
        memorySpaceId: "test-space-custom",
        type: "user-agent",
        participants: {
          userId: "user-1",
          participantId: "agent-1",
        },
      });

      expect(result.conversationId).toBe(customId);

      // Validate storage
      const stored = await client.query(api.conversations.get, {
        conversationId: customId,
      });

      expect(stored!.conversationId).toBe(customId);
    });

    it("throws error for duplicate conversationId", async () => {
      // NOTE: This tests BACKEND validation (database uniqueness check)
      // Client-side validation only checks format, not existence
      const conversationId = "conv-duplicate-test";

      await cortex.conversations.create({
        conversationId,
        memorySpaceId: "test-space-dup",
        type: "user-agent",
        participants: {
          userId: "user-1",
          participantId: "agent-1",
        },
      });

      // Attempt to create duplicate
      await expect(
        cortex.conversations.create({
          conversationId,
          memorySpaceId: "test-space-dup",
          type: "user-agent",
          participants: {
            userId: "user-2",
            participantId: "agent-2",
          },
        }),
      ).rejects.toThrow("CONVERSATION_ALREADY_EXISTS");
    });

    it("throws error for invalid user-agent participants", async () => {
      // NOTE: This tests CLIENT-SIDE validation (participant structure check)
      await expect(
        cortex.conversations.create({
          memorySpaceId: "test-space-error",
          type: "user-agent",
          participants: {
            // Missing userId (required)
          } as any,
        }),
      ).rejects.toThrow();
    });

    it("throws error for invalid agent-agent participants", async () => {
      // NOTE: This tests CLIENT-SIDE validation (array length check)
      await expect(
        cortex.conversations.create({
          memorySpaceId: "test-space-error-agent",
          type: "agent-agent",
          participants: {
            memorySpaceIds: ["agent-1"], // Only one space
          },
        }),
      ).rejects.toThrow(
        "agent-agent conversations require at least 2 memorySpaceIds",
      );
    });
  });

  describe("get()", () => {
    it("retrieves an existing conversation", async () => {
      // Create conversation
      const created = await cortex.conversations.create({
        memorySpaceId: "test-space-get",
        type: "user-agent",
        participants: {
          userId: "user-get-test",
          participantId: "agent-get-test",
        },
      });

      // Retrieve it
      const retrieved = await cortex.conversations.get(created.conversationId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.conversationId).toBe(created.conversationId);
      expect(retrieved!.type).toBe("user-agent");
      expect(retrieved!.participants).toEqual({
        userId: "user-get-test",
        participantId: "agent-get-test",
      });
    });

    it("returns null for non-existent conversation", async () => {
      const result = await cortex.conversations.get("conv-does-not-exist");

      expect(result).toBeNull();
    });
  });

  describe("addMessage()", () => {
    it("adds a message to a conversation", async () => {
      // Create conversation
      const conversation = await cortex.conversations.create({
        memorySpaceId: "test-space-msg",
        type: "user-agent",
        participants: {
          userId: "user-msg-test",
          participantId: "agent-msg-test",
        },
      });

      // Add message
      const updated = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "user",
          content: "Hello, agent!",
          metadata: {
            sentiment: "positive",
          },
        },
      });

      // Validate response
      expect(updated.messageCount).toBe(1);
      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].id).toMatch(/^msg-/);
      expect(updated.messages[0].role).toBe("user");
      expect(updated.messages[0].content).toBe("Hello, agent!");
      expect(updated.messages[0].timestamp).toBeGreaterThan(0);
      expect(updated.messages[0].metadata).toEqual({ sentiment: "positive" });

      // Validate storage
      const stored = await client.query(api.conversations.get, {
        conversationId: conversation.conversationId,
      });

      expect(stored!.messageCount).toBe(1);
      expect(stored!.messages).toHaveLength(1);
      expect(stored!.messages[0].content).toBe("Hello, agent!");
    });

    it("appends multiple messages (immutability)", async () => {
      // Create conversation
      const conversation = await cortex.conversations.create({
        memorySpaceId: "test-space-append",
        type: "user-agent",
        participants: {
          userId: "user-append-test",
          participantId: "agent-append-test",
        },
      });

      // Add first message
      await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "user",
          content: "First message",
        },
      });

      // Add second message
      await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "agent",
          content: "Second message",
          participantId: "agent-append-test",
        },
      });

      // Add third message
      const final = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "user",
          content: "Third message",
        },
      });

      // Validate all messages are present
      expect(final.messageCount).toBe(3);
      expect(final.messages).toHaveLength(3);
      expect(final.messages[0].content).toBe("First message");
      expect(final.messages[1].content).toBe("Second message");
      expect(final.messages[2].content).toBe("Third message");

      // Validate chronological order
      expect(final.messages[0].timestamp).toBeLessThan(
        final.messages[1].timestamp,
      );
      expect(final.messages[1].timestamp).toBeLessThan(
        final.messages[2].timestamp,
      );

      // Validate storage
      const stored = await client.query(api.conversations.get, {
        conversationId: conversation.conversationId,
      });

      expect(stored!.messageCount).toBe(3);
      expect(stored!.messages).toHaveLength(3);
    });

    it("accepts custom messageId", async () => {
      const conversation = await cortex.conversations.create({
        memorySpaceId: "test-space-delete-msg",
        type: "user-agent",
        participants: {
          userId: "user-1",
          participantId: "agent-1",
        },
      });

      const customMessageId = "msg-custom-abc";

      const updated = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          id: customMessageId,
          role: "user",
          content: "Custom ID message",
        },
      });

      expect(updated.messages[0].id).toBe(customMessageId);
    });

    it("throws error for non-existent conversation", async () => {
      // NOTE: This tests BACKEND validation (existence check)
      // Client-side validation only checks required fields and format
      await expect(
        cortex.conversations.addMessage({
          conversationId: "conv-does-not-exist",
          message: {
            role: "user",
            content: "Test",
          },
        }),
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      // Create test data
      await cortex.conversations.create({
        conversationId: "conv-list-1",
        memorySpaceId: "test-space-list",
        type: "user-agent",
        participants: {
          userId: "user-list-test",
          participantId: "agent-list-1",
        },
      });

      await cortex.conversations.create({
        conversationId: "conv-list-2",
        memorySpaceId: "test-space-list",
        type: "user-agent",
        participants: {
          userId: "user-list-test",
          participantId: "agent-list-2",
        },
      });

      await cortex.conversations.create({
        conversationId: "conv-list-3",
        memorySpaceId: "test-collab-list",
        type: "agent-agent",
        participants: {
          memorySpaceIds: ["agent-list-1", "agent-list-2"],
        },
      });
    });

    it("lists all conversations (no filter)", async () => {
      const conversations = await cortex.conversations.list();

      expect(conversations.length).toBeGreaterThan(0);
    });

    it("filters by userId", async () => {
      const conversations = await cortex.conversations.list({
        userId: "user-list-test",
      });

      expect(conversations.length).toBeGreaterThanOrEqual(2);
      conversations.forEach((conv) => {
        expect(conv.participants.userId).toBe("user-list-test");
      });
    });

    it("filters by memorySpaceId", async () => {
      const conversations = await cortex.conversations.list({
        memorySpaceId: "test-space-list",
      });

      // Should find both user-agent conversations (conv-list-1 and conv-list-2)
      expect(conversations.length).toBe(2);
      conversations.forEach((conv) => {
        expect(conv.memorySpaceId).toBe("test-space-list");
      });
    });

    it("filters by type", async () => {
      const conversations = await cortex.conversations.list({
        type: "user-agent",
      });

      expect(conversations.length).toBeGreaterThan(0);
      conversations.forEach((conv) => {
        expect(conv.type).toBe("user-agent");
      });
    });

    it("combines filters (userId + memorySpaceId)", async () => {
      const conversations = await cortex.conversations.list({
        userId: "user-list-test",
        memorySpaceId: "test-space-list",
      });

      expect(conversations.length).toBeGreaterThanOrEqual(1);
      conversations.forEach((conv) => {
        expect(conv.participants.userId).toBe("user-list-test");
        expect(conv.memorySpaceId).toBe("test-space-list");
      });
    });

    it("respects limit parameter", async () => {
      const conversations = await cortex.conversations.list({
        limit: 2,
      });

      expect(conversations.length).toBeLessThanOrEqual(2);
    });
  });

  describe("count()", () => {
    it("counts all conversations", async () => {
      const count = await cortex.conversations.count();

      expect(count).toBeGreaterThan(0);
    });

    it("counts by userId", async () => {
      const count = await cortex.conversations.count({
        userId: "user-list-test",
      });

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("counts by memorySpaceId", async () => {
      const count = await cortex.conversations.count({
        memorySpaceId: "test-space-list",
      });

      expect(count).toBeGreaterThanOrEqual(2); // Should find conv-list-1 and conv-list-2
    });

    it("counts by type", async () => {
      const count = await cortex.conversations.count({
        type: "user-agent",
      });

      expect(count).toBeGreaterThan(0);
    });
  });

  describe("delete()", () => {
    it("deletes a conversation", async () => {
      // Create conversation
      const conversation = await cortex.conversations.create({
        memorySpaceId: "test-space-delete",
        type: "user-agent",
        participants: {
          userId: "user-delete-test",
          participantId: "agent-delete-test",
        },
      });

      // Delete it
      const result = await cortex.conversations.delete(
        conversation.conversationId,
      );

      expect(result.deleted).toBe(true);

      // Verify it's gone
      const retrieved = await cortex.conversations.get(
        conversation.conversationId,
      );

      expect(retrieved).toBeNull();

      // Verify storage
      const stored = await client.query(api.conversations.get, {
        conversationId: conversation.conversationId,
      });

      expect(stored).toBeNull();
    });

    it("throws error for non-existent conversation", async () => {
      await expect(
        cortex.conversations.delete("conv-does-not-exist"),
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("Storage Validation", () => {
    it("validates complete ACID properties", async () => {
      const conversation = await cortex.conversations.create({
        memorySpaceId: "test-space-acid",
        type: "user-agent",
        participants: {
          userId: "user-acid-test",
          participantId: "agent-acid-test",
        },
      });

      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        await cortex.conversations.addMessage({
          conversationId: conversation.conversationId,
          message: {
            role: i % 2 === 0 ? "user" : "agent",
            content: `Message ${i + 1}`,
            participantId: i % 2 === 0 ? undefined : "agent-acid-test",
          },
        });
      }

      // Retrieve and validate
      const final = await cortex.conversations.get(conversation.conversationId);

      // Atomicity: All messages are present
      expect(final!.messageCount).toBe(5);
      expect(final!.messages).toHaveLength(5);

      // Consistency: messageCount matches array length
      expect(final!.messageCount).toBe(final!.messages.length);

      // Isolation: Messages are in chronological order
      for (let i = 1; i < final!.messages.length; i++) {
        expect(final!.messages[i].timestamp).toBeGreaterThanOrEqual(
          final!.messages[i - 1].timestamp,
        );
      }

      // Durability: Storage matches SDK response
      const stored = await client.query(api.conversations.get, {
        conversationId: conversation.conversationId,
      });

      expect(stored!.messageCount).toBe(final!.messageCount);
      expect(stored!.messages).toEqual(final!.messages);
    });

    it("validates index usage", async () => {
      // This test ensures indexes are being used
      // by verifying queries complete in reasonable time

      const startTime = Date.now();

      await cortex.conversations.list({
        userId: "user-list-test",
        memorySpaceId: "test-space-list-1",
      });

      const duration = Date.now() - startTime;

      // Should be fast with proper indexing
      expect(duration).toBeLessThan(1000); // < 1 second
    });
  });

  describe("getHistory()", () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create conversation with multiple messages
      const conversation = await cortex.conversations.create({
        memorySpaceId: "test-space-history",
        type: "user-agent",
        participants: {
          userId: "user-history-test",
          participantId: "agent-history-test",
        },
      });

      testConversationId = conversation.conversationId;

      // Add 10 messages
      for (let i = 1; i <= 10; i++) {
        await cortex.conversations.addMessage({
          conversationId: testConversationId,
          message: {
            role: i % 2 === 0 ? "agent" : "user",
            content: `Message ${i}`,
          },
        });
      }
    });

    it("retrieves all messages by default", async () => {
      const history = await cortex.conversations.getHistory(testConversationId);

      expect(history.messages).toHaveLength(10);
      expect(history.total).toBe(10);
      expect(history.hasMore).toBe(false);
      expect(history.conversationId).toBe(testConversationId);
    });

    it("paginates messages with limit and offset", async () => {
      const page1 = await cortex.conversations.getHistory(testConversationId, {
        limit: 3,
        offset: 0,
      });

      expect(page1.messages).toHaveLength(3);
      expect(page1.messages[0].content).toBe("Message 1");
      expect(page1.messages[2].content).toBe("Message 3");
      expect(page1.total).toBe(10);
      expect(page1.hasMore).toBe(true);

      const page2 = await cortex.conversations.getHistory(testConversationId, {
        limit: 3,
        offset: 3,
      });

      expect(page2.messages).toHaveLength(3);
      expect(page2.messages[0].content).toBe("Message 4");
      expect(page2.hasMore).toBe(true);
    });

    it("supports ascending order (oldest first)", async () => {
      const history = await cortex.conversations.getHistory(
        testConversationId,
        {
          sortOrder: "asc",
          limit: 3,
        },
      );

      expect(history.messages[0].content).toBe("Message 1");
      expect(history.messages[1].content).toBe("Message 2");
      expect(history.messages[2].content).toBe("Message 3");
    });

    it("supports descending order (newest first)", async () => {
      const history = await cortex.conversations.getHistory(
        testConversationId,
        {
          sortOrder: "desc",
          limit: 3,
        },
      );

      expect(history.messages[0].content).toBe("Message 10");
      expect(history.messages[1].content).toBe("Message 9");
      expect(history.messages[2].content).toBe("Message 8");
    });

    it("handles edge case: offset beyond messages", async () => {
      const history = await cortex.conversations.getHistory(
        testConversationId,
        {
          offset: 100,
        },
      );

      expect(history.messages).toHaveLength(0);
      expect(history.hasMore).toBe(false);
    });

    it("throws error for non-existent conversation", async () => {
      // NOTE: This tests BACKEND validation (existence check)
      // Client-side validation only checks required fields and format
      await expect(
        cortex.conversations.getHistory("conv-does-not-exist"),
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("search()", () => {
    beforeAll(async () => {
      // Create test conversations with searchable content
      const conv1 = await cortex.conversations.create({
        conversationId: "conv-search-1",
        memorySpaceId: "test-space-search",
        type: "user-agent",
        participants: {
          userId: "user-search-test",
          participantId: "agent-search-test",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv1.conversationId,
        message: {
          role: "user",
          content: "What is the password for the system?",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv1.conversationId,
        message: {
          role: "agent",
          content: "The password is Blue123!",
        },
      });

      const conv2 = await cortex.conversations.create({
        conversationId: "conv-search-2",
        memorySpaceId: "test-space-search",
        type: "user-agent",
        participants: {
          userId: "user-search-test",
          participantId: "agent-search-test",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv2.conversationId,
        message: {
          role: "user",
          content: "Tell me about the weather today",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv2.conversationId,
        message: {
          role: "agent",
          content: "The weather is sunny with no password required!",
        },
      });

      const conv3 = await cortex.conversations.create({
        conversationId: "conv-search-3",
        memorySpaceId: "test-space-search-other",
        type: "user-agent",
        participants: {
          userId: "user-search-other",
          participantId: "agent-search-test",
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv3.conversationId,
        message: {
          role: "user",
          content: "This conversation has no password mentions at all.",
        },
      });
    });

    it("finds conversations containing search query", async () => {
      const results = await cortex.conversations.search({
        query: "password",
      });

      expect(results.length).toBeGreaterThanOrEqual(2);

      // All results should contain "password"
      results.forEach((result) => {
        const hasMatch = result.matchedMessages.some((msg) =>
          msg.content.toLowerCase().includes("password"),
        );

        expect(hasMatch).toBe(true);
      });
    });

    it("filters by userId", async () => {
      const results = await cortex.conversations.search({
        query: "password",
        filters: {
          userId: "user-search-test",
        },
      });

      expect(results.length).toBe(2); // conv-search-1 and conv-search-2
      results.forEach((result) => {
        expect(result.conversation.participants.userId).toBe(
          "user-search-test",
        );
      });
    });

    it("includes highlights from matched messages", async () => {
      const results = await cortex.conversations.search({
        query: "password",
        filters: { limit: 1 },
      });

      expect(results[0].highlights.length).toBeGreaterThan(0);
      results[0].highlights.forEach((highlight) => {
        expect(highlight.toLowerCase()).toContain("password");
      });
    });

    it("calculates relevance scores", async () => {
      const results = await cortex.conversations.search({
        query: "password",
      });

      // All results should have scores
      results.forEach((result) => {
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });

      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it("returns empty array when no matches", async () => {
      const results = await cortex.conversations.search({
        query: "nonexistent-query-xyz",
      });

      expect(results).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const results = await cortex.conversations.search({
        query: "password",
        filters: { limit: 1 },
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("export()", () => {
    beforeAll(async () => {
      // Create test conversations for export
      await cortex.conversations.create({
        conversationId: "conv-export-1",
        memorySpaceId: "test-space-export",
        type: "user-agent",
        participants: {
          userId: "user-export-test",
          participantId: "agent-export-test",
        },
        metadata: { campaign: "summer-2025" },
      });

      await cortex.conversations.create({
        conversationId: "conv-export-2",
        memorySpaceId: "test-collab-export",
        type: "agent-agent",
        participants: {
          memorySpaceIds: ["agent-export-test", "agent-export-other"],
        },
        metadata: { priority: "high" },
      });
    });

    it("exports to JSON format", async () => {
      const exported = await cortex.conversations.export({
        filters: { userId: "user-export-test" },
        format: "json",
        includeMetadata: true,
      });

      expect(exported.format).toBe("json");
      expect(exported.count).toBeGreaterThanOrEqual(1);
      expect(exported.exportedAt).toBeGreaterThan(0);
      expect(exported.data).toBeTruthy();

      // Validate JSON is parseable
      const parsed = JSON.parse(exported.data);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(exported.count);
    });

    it("exports to CSV format", async () => {
      const exported = await cortex.conversations.export({
        filters: { userId: "user-export-test" },
        format: "csv",
        includeMetadata: false,
      });

      expect(exported.format).toBe("csv");
      expect(exported.count).toBeGreaterThanOrEqual(1);
      expect(exported.data).toBeTruthy();

      // Validate CSV structure
      const lines = exported.data.split("\n");

      expect(lines[0]).toContain("conversationId");
      expect(lines[0]).toContain("type");
      expect(lines.length).toBe(exported.count + 1); // Header + data rows
    });

    it("includes metadata when requested", async () => {
      const withMetadata = await cortex.conversations.export({
        filters: { conversationIds: ["conv-export-1"] },
        format: "json",
        includeMetadata: true,
      });

      const parsed = JSON.parse(withMetadata.data);

      expect(parsed[0].metadata).toBeDefined();
      expect(parsed[0].metadata.campaign).toBe("summer-2025");
    });

    it("excludes metadata when not requested", async () => {
      const withoutMetadata = await cortex.conversations.export({
        filters: { conversationIds: ["conv-export-1"] },
        format: "json",
        includeMetadata: false,
      });

      const parsed = JSON.parse(withoutMetadata.data);

      expect(parsed[0].metadata).toBeUndefined();
    });

    it("filters by conversation IDs", async () => {
      const exported = await cortex.conversations.export({
        filters: {
          conversationIds: ["conv-export-1", "conv-export-2"],
        },
        format: "json",
      });

      expect(exported.count).toBe(2);
      const parsed = JSON.parse(exported.data);
      const ids = parsed.map((c: any) => c.conversationId);

      expect(ids).toContain("conv-export-1");
      expect(ids).toContain("conv-export-2");
    });

    it("filters by type", async () => {
      const exported = await cortex.conversations.export({
        filters: { type: "agent-agent" },
        format: "json",
      });

      const parsed = JSON.parse(exported.data);

      parsed.forEach((conv: any) => {
        expect(conv.type).toBe("agent-agent");
      });
    });

    it("filters by date range", async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const exported = await cortex.conversations.export({
        filters: {
          dateRange: {
            start: oneHourAgo,
            end: now,
          },
        },
        format: "json",
      });

      const parsed = JSON.parse(exported.data);

      parsed.forEach((conv: any) => {
        expect(conv.createdAt).toBeGreaterThanOrEqual(oneHourAgo);
        expect(conv.createdAt).toBeLessThanOrEqual(now);
      });
    });
  });

  describe("State Change Propagation", () => {
    it("message additions propagate to all read operations", async () => {
      // Create conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space-propagation",
        type: "user-agent",
        participants: {
          userId: "user-propagation-test",
          participantId: "agent-propagation-test",
        },
      });

      // Verify initial state in all operations
      let retrieved = await cortex.conversations.get(conv.conversationId);

      expect(retrieved!.messageCount).toBe(0);

      let list = await cortex.conversations.list({
        userId: "user-propagation-test",
      });

      expect(list[0].messageCount).toBe(0);

      // Add message
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Test message with keyword PROPAGATE",
        },
      });

      // Verify change in get()
      retrieved = await cortex.conversations.get(conv.conversationId);
      expect(retrieved!.messageCount).toBe(1);
      expect(retrieved!.messages[0].content).toContain("PROPAGATE");

      // Verify change in list()
      list = await cortex.conversations.list({
        userId: "user-propagation-test",
      });
      expect(list[0].messageCount).toBe(1);

      // Verify in search()
      const searchResults = await cortex.conversations.search({
        query: "PROPAGATE",
      });

      expect(
        searchResults.some(
          (r) => r.conversation.conversationId === conv.conversationId,
        ),
      ).toBe(true);

      // Verify in getHistory()
      const history = await cortex.conversations.getHistory(
        conv.conversationId,
      );

      expect(history.messages).toHaveLength(1);

      // Add more messages
      for (let i = 2; i <= 5; i++) {
        await cortex.conversations.addMessage({
          conversationId: conv.conversationId,
          message: {
            role: i % 2 === 0 ? "agent" : "user",
            content: `Message ${i}`,
          },
        });
      }

      // All operations should see 5 messages
      retrieved = await cortex.conversations.get(conv.conversationId);
      expect(retrieved!.messageCount).toBe(5);

      const finalHistory = await cortex.conversations.getHistory(
        conv.conversationId,
      );

      expect(finalHistory.messages).toHaveLength(5);

      const finalList = await cortex.conversations.list({
        userId: "user-propagation-test",
      });

      expect(finalList[0].messageCount).toBe(5);
    });

    it("deletion propagates to all read operations", async () => {
      // Create conversation
      const conv = await cortex.conversations.create({
        conversationId: "conv-deletion-propagation",
        memorySpaceId: "test-space-delete-prop",
        type: "user-agent",
        participants: {
          userId: "user-delete-test",
          participantId: "agent-delete-test",
        },
      });

      // Add messages
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Message 1" },
      });

      // Verify exists in all operations
      let get = await cortex.conversations.get(conv.conversationId);

      expect(get).not.toBeNull();

      let list = await cortex.conversations.list({
        userId: "user-delete-test",
      });

      expect(list.some((c) => c.conversationId === conv.conversationId)).toBe(
        true,
      );

      const count = await cortex.conversations.count({
        userId: "user-delete-test",
      });

      expect(count).toBeGreaterThanOrEqual(1);

      // Delete conversation
      await cortex.conversations.delete(conv.conversationId);

      // Verify deleted in all operations
      get = await cortex.conversations.get(conv.conversationId);
      expect(get).toBeNull();

      list = await cortex.conversations.list({ userId: "user-delete-test" });
      expect(list.some((c) => c.conversationId === conv.conversationId)).toBe(
        false,
      );

      const countAfter = await cortex.conversations.count({
        userId: "user-delete-test",
      });

      expect(countAfter).toBe(count - 1);
    });
  });

  describe("Edge Cases", () => {
    it("handles conversation with many messages (100+)", async () => {
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space-many",
        type: "user-agent",
        participants: {
          userId: "user-many-messages",
          participantId: "agent-many-messages",
        },
      });

      // Add 100 messages
      for (let i = 1; i <= 100; i++) {
        await cortex.conversations.addMessage({
          conversationId: conv.conversationId,
          message: {
            role: i % 2 === 0 ? "agent" : "user",
            content: `Message ${i}`,
          },
        });
      }

      // Get should have all 100
      const retrieved = await cortex.conversations.get(conv.conversationId);

      expect(retrieved!.messageCount).toBe(100);
      expect(retrieved!.messages).toHaveLength(100);

      // Pagination should work
      const page1 = await cortex.conversations.getHistory(conv.conversationId, {
        limit: 20,
        offset: 0,
      });

      expect(page1.messages).toHaveLength(20);

      const page2 = await cortex.conversations.getHistory(conv.conversationId, {
        limit: 20,
        offset: 20,
      });

      expect(page2.messages).toHaveLength(20);

      // Messages should be different
      expect(page1.messages[0].content).not.toBe(page2.messages[0].content);
    });

    it("rejects empty message content", async () => {
      // NOTE: This now tests CLIENT-SIDE validation
      // Empty content is caught by validation before reaching backend
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space-empty",
        type: "user-agent",
        participants: {
          userId: "user-empty-test",
          participantId: "agent-empty-test",
        },
      });

      await expect(
        cortex.conversations.addMessage({
          conversationId: conv.conversationId,
          message: {
            role: "user",
            content: "",
          },
        }),
      ).rejects.toMatchObject({
        name: "ConversationValidationError",
        code: "MISSING_REQUIRED_FIELD",
        field: "message.content",
      });
    });

    it("handles very long message content", async () => {
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space-long",
        type: "user-agent",
        participants: {
          userId: "user-long-test",
          participantId: "agent-long-test",
        },
      });

      // 10KB message
      const longContent = "A".repeat(10000);

      const result = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: longContent,
        },
      });

      expect(result.messages[0].content).toHaveLength(10000);

      const retrieved = await cortex.conversations.get(conv.conversationId);

      expect(retrieved!.messages[0].content).toHaveLength(10000);
    });

    it("handles special characters in conversationId", async () => {
      const specialId = "conv_test-123.special-chars";

      const conv = await cortex.conversations.create({
        conversationId: specialId,
        memorySpaceId: "test-space-special",
        type: "user-agent",
        participants: {
          userId: "user-special",
          participantId: "agent-special",
        },
      });

      expect(conv.conversationId).toBe(specialId);

      const retrieved = await cortex.conversations.get(specialId);

      expect(retrieved).not.toBeNull();
    });

    it("handles concurrent message additions", async () => {
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space-concurrent",
        type: "user-agent",
        participants: {
          userId: "user-concurrent-edge",
          participantId: "agent-concurrent-edge",
        },
      });

      // Add 20 messages concurrently
      const promises = Array.from(
        { length: 20 },
        async (_, i) =>
          await cortex.conversations.addMessage({
            conversationId: conv.conversationId,
            message: {
              role: i % 2 === 0 ? "user" : "agent",
              content: `Concurrent message ${i}`,
            },
          }),
      );

      await Promise.all(promises);

      // All 20 should be stored
      const final = await cortex.conversations.get(conv.conversationId);

      expect(final!.messageCount).toBe(20);
      expect(final!.messages).toHaveLength(20);
    });
  });

  describe("Advanced Operations", () => {
    describe("deleteMany()", () => {
      beforeAll(async () => {
        // Create test conversations for bulk delete
        for (let i = 1; i <= 5; i++) {
          await cortex.conversations.create({
            conversationId: `conv-bulk-delete-${i}`,
            memorySpaceId: "test-space-bulk",
            type: "user-agent",
            participants: {
              userId: "user-bulk-delete",
              participantId: "agent-bulk-delete",
            },
          });
        }
      });

      it("deletes multiple conversations by userId", async () => {
        const result = await cortex.conversations.deleteMany({
          userId: "user-bulk-delete",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(5);
        expect(result.conversationIds).toHaveLength(result.deleted);

        // Verify deletion
        const remaining = await cortex.conversations.list({
          userId: "user-bulk-delete",
        });

        expect(remaining.length).toBe(0);
      });

      it("returns count of messages deleted", async () => {
        // Create conversation with messages
        const conv = await cortex.conversations.create({
          memorySpaceId: "test-space-delete-msgs",
          type: "user-agent",
          participants: {
            userId: "user-delete-many-msgs",
            participantId: "agent-test",
          },
        });

        for (let i = 0; i < 5; i++) {
          await cortex.conversations.addMessage({
            conversationId: conv.conversationId,
            message: { role: "user", content: `Message ${i}` },
          });
        }

        const result = await cortex.conversations.deleteMany({
          userId: "user-delete-many-msgs",
        });

        expect(result.totalMessagesDeleted).toBeGreaterThanOrEqual(5);
      });
    });

    describe("getMessage()", () => {
      let testConversationId: string;
      let testMessageId: string;

      beforeAll(async () => {
        const conv = await cortex.conversations.create({
          memorySpaceId: "test-space-get-msg",
          type: "user-agent",
          participants: {
            userId: "user-get-message",
            participantId: "agent-get-message",
          },
        });

        testConversationId = conv.conversationId;

        const result = await cortex.conversations.addMessage({
          conversationId: testConversationId,
          message: {
            role: "user",
            content: "Specific message to retrieve",
          },
        });

        testMessageId = result.messages[0].id;
      });

      it("retrieves specific message by ID", async () => {
        const message = await cortex.conversations.getMessage(
          testConversationId,
          testMessageId,
        );

        expect(message).not.toBeNull();
        expect(message!.id).toBe(testMessageId);
        expect(message!.content).toBe("Specific message to retrieve");
      });

      it("returns null for non-existent message", async () => {
        const message = await cortex.conversations.getMessage(
          testConversationId,
          "msg-does-not-exist",
        );

        expect(message).toBeNull();
      });

      it("returns null for non-existent conversation", async () => {
        const message = await cortex.conversations.getMessage(
          "conv-does-not-exist",
          testMessageId,
        );

        expect(message).toBeNull();
      });
    });

    describe("getMessagesByIds()", () => {
      let testConversationId: string;
      let messageIds: string[];

      beforeAll(async () => {
        const conv = await cortex.conversations.create({
          memorySpaceId: "test-space-get-msgs",
          type: "user-agent",
          participants: {
            userId: "user-get-messages",
            participantId: "agent-get-messages",
          },
        });

        testConversationId = conv.conversationId;

        // Add 5 messages
        messageIds = [];
        for (let i = 1; i <= 5; i++) {
          const result = await cortex.conversations.addMessage({
            conversationId: testConversationId,
            message: {
              role: i % 2 === 0 ? "agent" : "user",
              content: `Message ${i}`,
            },
          });

          messageIds.push(result.messages[result.messages.length - 1].id);
        }
      });

      it("retrieves multiple messages by IDs", async () => {
        const messages = await cortex.conversations.getMessagesByIds(
          testConversationId,
          [messageIds[0], messageIds[2], messageIds[4]],
        );

        expect(messages).toHaveLength(3);
        expect(messages.map((m) => m.id)).toContain(messageIds[0]);
        expect(messages.map((m) => m.id)).toContain(messageIds[2]);
        expect(messages.map((m) => m.id)).toContain(messageIds[4]);
      });

      it("returns empty array for non-existent conversation", async () => {
        const messages = await cortex.conversations.getMessagesByIds(
          "conv-does-not-exist",
          messageIds,
        );

        expect(messages).toEqual([]);
      });

      it("filters out non-existent message IDs", async () => {
        const messages = await cortex.conversations.getMessagesByIds(
          testConversationId,
          [messageIds[0], "msg-fake", messageIds[1]],
        );

        expect(messages).toHaveLength(2);
        expect(messages.map((m) => m.id)).toContain(messageIds[0]);
        expect(messages.map((m) => m.id)).toContain(messageIds[1]);
      });
    });

    describe("findConversation()", () => {
      beforeAll(async () => {
        await cortex.conversations.create({
          memorySpaceId: "test-space-find",
          type: "user-agent",
          participants: {
            userId: "user-find",
            participantId: "agent-find",
          },
        });

        await cortex.conversations.create({
          memorySpaceId: "test-collab-find",
          type: "agent-agent",
          participants: {
            memorySpaceIds: ["agent-a", "agent-b"],
          },
        });
      });

      it("finds existing user-agent conversation", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: "test-space-find",
          type: "user-agent",
          userId: "user-find",
        });

        expect(found).not.toBeNull();
        expect(found!.type).toBe("user-agent");
        expect(found!.participants.userId).toBe("user-find");
        expect(found!.participants.participantId).toBe("agent-find");
      });

      it("finds existing agent-agent conversation", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: "test-collab-find",
          type: "agent-agent",
          memorySpaceIds: ["agent-a", "agent-b"],
        });

        expect(found).not.toBeNull();
        expect(found!.type).toBe("agent-agent");
        expect(found!.participants.memorySpaceIds).toContain("agent-a");
        expect(found!.participants.memorySpaceIds).toContain("agent-b");
      });

      it("finds agent-agent regardless of order", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: "test-collab-find",
          type: "agent-agent",
          memorySpaceIds: ["agent-b", "agent-a"], // Reversed order
        });

        expect(found).not.toBeNull();
      });

      it("returns null for non-existent conversation", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: "test-space-nonexistent",
          type: "user-agent",
          userId: "user-nonexistent",
        });

        expect(found).toBeNull();
      });
    });

    describe("getOrCreate()", () => {
      it("creates new conversation if doesn't exist", async () => {
        const result = await cortex.conversations.getOrCreate({
          memorySpaceId: "test-space-get-or-create-new",
          type: "user-agent",
          participants: {
            userId: "user-get-or-create-new",
            participantId: "agent-get-or-create-new",
          },
        });

        expect(result.conversationId).toBeDefined();
        expect(result.type).toBe("user-agent");
        expect(result.messageCount).toBe(0);
      });

      it("returns existing conversation if found", async () => {
        // First call creates
        const first = await cortex.conversations.getOrCreate({
          memorySpaceId: "test-space-get-or-create-existing",
          type: "user-agent",
          participants: {
            userId: "user-get-or-create-existing",
            participantId: "agent-get-or-create-existing",
          },
        });

        // Second call returns same
        const second = await cortex.conversations.getOrCreate({
          memorySpaceId: "test-space-get-or-create-existing",
          type: "user-agent",
          participants: {
            userId: "user-get-or-create-existing",
            participantId: "agent-get-or-create-existing",
          },
        });

        expect(second.conversationId).toBe(first.conversationId);
        expect(second._id).toBe(first._id);
      });

      it("works with agent-agent conversations", async () => {
        const first = await cortex.conversations.getOrCreate({
          memorySpaceId: "test-collab-get-or-create",
          type: "agent-agent",
          participants: {
            memorySpaceIds: ["agent-x", "agent-y"],
          },
        });

        const second = await cortex.conversations.getOrCreate({
          memorySpaceId: "test-collab-get-or-create",
          type: "agent-agent",
          participants: {
            memorySpaceIds: ["agent-y", "agent-x"], // Different order
          },
        });

        expect(second.conversationId).toBe(first.conversationId);
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    describe("create() validation", () => {
      it("throws on missing memorySpaceId", async () => {
        await expect(
          cortex.conversations.create({
            type: "user-agent",
            participants: { userId: "user-123" },
          } as any),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "memorySpaceId",
        });
      });

      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.conversations.create({
            memorySpaceId: "",
            type: "user-agent",
            participants: { userId: "user-123" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "memorySpaceId",
        });
      });

      it("throws on whitespace-only memorySpaceId", async () => {
        await expect(
          cortex.conversations.create({
            memorySpaceId: "   ",
            type: "user-agent",
            participants: { userId: "user-123" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "memorySpaceId",
        });
      });

      it("throws on invalid type", async () => {
        await expect(
          cortex.conversations.create({
            memorySpaceId: "test-space",
            type: "invalid-type" as any,
            participants: { userId: "user-123" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });

      it("throws on invalid conversationId format (contains newline)", async () => {
        await expect(
          cortex.conversations.create({
            conversationId: "conv-123\n456",
            memorySpaceId: "test-space",
            type: "user-agent",
            participants: { userId: "user-123" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_ID_FORMAT",
        });
      });

      it("throws when user-agent missing userId", async () => {
        await expect(
          cortex.conversations.create({
            memorySpaceId: "test-space",
            type: "user-agent",
            participants: {},
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_PARTICIPANTS",
        });
      });

      it("throws when agent-agent has < 2 memorySpaceIds", async () => {
        await expect(
          cortex.conversations.create({
            memorySpaceId: "test-space",
            type: "agent-agent",
            participants: { memorySpaceIds: ["agent-1"] },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_PARTICIPANTS",
        });
      });

      it("throws when agent-agent has duplicate memorySpaceIds", async () => {
        await expect(
          cortex.conversations.create({
            memorySpaceId: "test-space",
            type: "agent-agent",
            participants: { memorySpaceIds: ["agent-1", "agent-1"] },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "DUPLICATE_VALUES",
        });
      });
    });

    describe("addMessage() validation", () => {
      it("throws on missing conversationId", async () => {
        await expect(
          cortex.conversations.addMessage({
            conversationId: undefined as any,
            message: { role: "user", content: "test" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });

      it("throws on missing message.content", async () => {
        await expect(
          cortex.conversations.addMessage({
            conversationId: "conv-123",
            message: { role: "user", content: undefined as any },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "message.content",
        });
      });

      it("throws on empty message.content", async () => {
        await expect(
          cortex.conversations.addMessage({
            conversationId: "conv-123",
            message: { role: "user", content: "" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "message.content",
        });
      });

      it("throws on invalid message.role", async () => {
        await expect(
          cortex.conversations.addMessage({
            conversationId: "conv-123",
            message: { role: "invalid" as any, content: "test" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_ROLE",
        });
      });

      it("throws on invalid message ID format", async () => {
        await expect(
          cortex.conversations.addMessage({
            conversationId: "conv-123",
            message: {
              id: "msg\0invalid",
              role: "user",
              content: "test",
            },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_ID_FORMAT",
        });
      });
    });

    describe("get() validation", () => {
      it("throws on missing conversationId", async () => {
        await expect(
          cortex.conversations.get(undefined as any),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });

      it("throws on empty conversationId", async () => {
        await expect(cortex.conversations.get("")).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });
    });

    describe("list() validation", () => {
      it("throws on invalid type", async () => {
        await expect(
          cortex.conversations.list({ type: "invalid" as any }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });

      it("throws on invalid limit (negative)", async () => {
        await expect(
          cortex.conversations.list({ limit: -1 }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_RANGE",
          field: "limit",
        });
      });

      it("throws on invalid limit (zero)", async () => {
        await expect(
          cortex.conversations.list({ limit: 0 }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_RANGE",
          field: "limit",
        });
      });

      it("throws on limit too large (>1000)", async () => {
        await expect(
          cortex.conversations.list({ limit: 1001 }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_RANGE",
          field: "limit",
        });
      });
    });

    describe("count() validation", () => {
      it("throws on invalid type", async () => {
        await expect(
          cortex.conversations.count({ type: "wrong-type" as any }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });
    });

    describe("delete() validation", () => {
      it("throws on missing conversationId", async () => {
        await expect(
          cortex.conversations.delete(undefined as any),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });

      it("throws on empty conversationId", async () => {
        await expect(cortex.conversations.delete("")).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });
    });

    describe("deleteMany() validation", () => {
      it("throws on invalid type", async () => {
        await expect(
          cortex.conversations.deleteMany({ type: "bad-type" as any }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });

      it("throws when no filters provided", async () => {
        await expect(cortex.conversations.deleteMany({})).rejects.toMatchObject(
          {
            name: "ConversationValidationError",
            code: "MISSING_REQUIRED_FIELD",
          },
        );
      });
    });

    describe("getMessage() validation", () => {
      it("throws on missing conversationId", async () => {
        await expect(
          cortex.conversations.getMessage(undefined as any, "msg-123"),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });

      it("throws on missing messageId", async () => {
        await expect(
          cortex.conversations.getMessage("conv-123", undefined as any),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "messageId",
        });
      });
    });

    describe("getMessagesByIds() validation", () => {
      it("throws on missing conversationId", async () => {
        await expect(
          cortex.conversations.getMessagesByIds(undefined as any, ["msg-1"]),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });

      it("throws on empty messageIds array", async () => {
        await expect(
          cortex.conversations.getMessagesByIds("conv-123", []),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "EMPTY_ARRAY",
          field: "messageIds",
        });
      });

      it("throws on duplicate messageIds", async () => {
        await expect(
          cortex.conversations.getMessagesByIds("conv-123", [
            "msg-1",
            "msg-2",
            "msg-1",
          ]),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "DUPLICATE_VALUES",
          field: "messageIds",
        });
      });
    });

    describe("findConversation() validation", () => {
      it("throws on missing memorySpaceId", async () => {
        await expect(
          cortex.conversations.findConversation({
            memorySpaceId: undefined as any,
            type: "user-agent",
            userId: "user-123",
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "memorySpaceId",
        });
      });

      it("throws on invalid type", async () => {
        await expect(
          cortex.conversations.findConversation({
            memorySpaceId: "test-space",
            type: "bad-type" as any,
            userId: "user-123",
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });

      it("throws when user-agent missing userId", async () => {
        await expect(
          cortex.conversations.findConversation({
            memorySpaceId: "test-space",
            type: "user-agent",
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "userId",
        });
      });

      it("throws when agent-agent missing memorySpaceIds", async () => {
        await expect(
          cortex.conversations.findConversation({
            memorySpaceId: "test-space",
            type: "agent-agent",
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_ARRAY_LENGTH",
        });
      });

      it("throws when agent-agent has < 2 memorySpaceIds", async () => {
        await expect(
          cortex.conversations.findConversation({
            memorySpaceId: "test-space",
            type: "agent-agent",
            memorySpaceIds: ["agent-1"],
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_ARRAY_LENGTH",
        });
      });

      it("throws when agent-agent has duplicate memorySpaceIds", async () => {
        await expect(
          cortex.conversations.findConversation({
            memorySpaceId: "test-space",
            type: "agent-agent",
            memorySpaceIds: ["agent-1", "agent-1"],
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "DUPLICATE_VALUES",
        });
      });
    });

    describe("getOrCreate() validation", () => {
      it("throws on missing memorySpaceId", async () => {
        await expect(
          cortex.conversations.getOrCreate({
            memorySpaceId: undefined as any,
            type: "user-agent",
            participants: { userId: "user-123" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "memorySpaceId",
        });
      });

      it("throws on invalid type", async () => {
        await expect(
          cortex.conversations.getOrCreate({
            memorySpaceId: "test-space",
            type: "invalid" as any,
            participants: { userId: "user-123" },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });

      it("throws when user-agent missing userId", async () => {
        await expect(
          cortex.conversations.getOrCreate({
            memorySpaceId: "test-space",
            type: "user-agent",
            participants: {},
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_PARTICIPANTS",
        });
      });

      it("throws when agent-agent has < 2 memorySpaceIds", async () => {
        await expect(
          cortex.conversations.getOrCreate({
            memorySpaceId: "test-space",
            type: "agent-agent",
            participants: { memorySpaceIds: ["agent-1"] },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_PARTICIPANTS",
        });
      });
    });

    describe("getHistory() validation", () => {
      it("throws on missing conversationId", async () => {
        await expect(
          cortex.conversations.getHistory(undefined as any),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "MISSING_REQUIRED_FIELD",
          field: "conversationId",
        });
      });

      it("throws on invalid limit", async () => {
        await expect(
          cortex.conversations.getHistory("conv-123", { limit: 0 }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_RANGE",
          field: "limit",
        });
      });

      it("throws on invalid offset (negative)", async () => {
        await expect(
          cortex.conversations.getHistory("conv-123", { offset: -1 }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_RANGE",
          field: "offset",
        });
      });

      it("throws on invalid sortOrder", async () => {
        await expect(
          cortex.conversations.getHistory("conv-123", {
            sortOrder: "invalid" as any,
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_SORT_ORDER",
        });
      });
    });

    describe("search() validation", () => {
      it("throws on empty query", async () => {
        await expect(
          cortex.conversations.search({ query: "" }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "EMPTY_STRING",
          field: "query",
        });
      });

      it("throws on whitespace-only query", async () => {
        await expect(
          cortex.conversations.search({ query: "   " }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "EMPTY_STRING",
          field: "query",
        });
      });

      it("throws on invalid type filter", async () => {
        await expect(
          cortex.conversations.search({
            query: "test",
            filters: { type: "invalid" as any },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });

      it("throws on invalid limit", async () => {
        await expect(
          cortex.conversations.search({
            query: "test",
            filters: { limit: -5 },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_RANGE",
          field: "limit",
        });
      });

      it("throws on invalid date range (start > end)", async () => {
        const now = Date.now();
        await expect(
          cortex.conversations.search({
            query: "test",
            filters: {
              dateRange: { start: now, end: now - 1000 },
            },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_DATE_RANGE",
        });
      });

      it("throws on invalid date range (start === end)", async () => {
        const now = Date.now();
        await expect(
          cortex.conversations.search({
            query: "test",
            filters: {
              dateRange: { start: now, end: now },
            },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_DATE_RANGE",
        });
      });
    });

    describe("export() validation", () => {
      it("throws on invalid format", async () => {
        await expect(
          cortex.conversations.export({ format: "xml" as any }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_FORMAT",
        });
      });

      it("throws on invalid type filter", async () => {
        await expect(
          cortex.conversations.export({
            format: "json",
            filters: { type: "bad" as any },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_TYPE",
        });
      });

      it("throws on empty conversationIds array", async () => {
        await expect(
          cortex.conversations.export({
            format: "json",
            filters: { conversationIds: [] },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "EMPTY_ARRAY",
        });
      });

      it("throws on invalid date range", async () => {
        const now = Date.now();
        await expect(
          cortex.conversations.export({
            format: "json",
            filters: {
              dateRange: { start: now + 1000, end: now },
            },
          }),
        ).rejects.toMatchObject({
          name: "ConversationValidationError",
          code: "INVALID_DATE_RANGE",
        });
      });
    });

    describe("Validation timing", () => {
      it("validation errors are synchronous (<1ms)", async () => {
        const start = Date.now();
        try {
          await cortex.conversations.create({
            memorySpaceId: "",
            type: "user-agent",
            participants: {},
          } as any);
        } catch (error: any) {
          const duration = Date.now() - start;

          expect(duration).toBeLessThan(1);
          expect(error.name).toBe("ConversationValidationError");
        }
      });
    });
  });

  describe("Cross-Operation Integration", () => {
    it("create → addMessage → list → search → export consistency", async () => {
      // Create with unique keyword
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space-integration",
        type: "user-agent",
        participants: {
          userId: "user-integration-test",
          participantId: "agent-integration-test",
        },
        metadata: {
          testKeyword: "INTEGRATION_TEST_MARKER",
        },
      });

      // Add message with unique content
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "This message contains UNIQUE_SEARCH_TERM for testing",
        },
      });

      // Verify in list
      const listResults = await cortex.conversations.list({
        userId: "user-integration-test",
      });

      expect(
        listResults.some((c) => c.conversationId === conv.conversationId),
      ).toBe(true);
      expect(
        listResults.find((c) => c.conversationId === conv.conversationId)
          ?.messageCount,
      ).toBe(1);

      // Verify in search
      const searchResults = await cortex.conversations.search({
        query: "UNIQUE_SEARCH_TERM",
      });

      expect(
        searchResults.some(
          (r) => r.conversation.conversationId === conv.conversationId,
        ),
      ).toBe(true);

      // Verify in count
      const count = await cortex.conversations.count({
        userId: "user-integration-test",
      });

      expect(count).toBeGreaterThanOrEqual(1);

      // Verify in export
      const exported = await cortex.conversations.export({
        filters: { userId: "user-integration-test" },
        format: "json",
      });
      const parsed = JSON.parse(exported.data);

      expect(
        parsed.some((c: any) => c.conversationId === conv.conversationId),
      ).toBe(true);

      // Add more messages
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "agent", content: "Response" },
      });

      // All operations should see 2 messages now
      const updatedGet = await cortex.conversations.get(conv.conversationId);

      expect(updatedGet!.messageCount).toBe(2);

      const updatedList = await cortex.conversations.list({
        userId: "user-integration-test",
      });

      expect(
        updatedList.find((c) => c.conversationId === conv.conversationId)
          ?.messageCount,
      ).toBe(2);
    });

    it("search results update as messages are added", async () => {
      const conv = await cortex.conversations.create({
        memorySpaceId: "test-space-search-update",
        type: "user-agent",
        participants: {
          userId: "user-search-update",
          participantId: "agent-search-update",
        },
      });

      // Initially no matches for "password"
      let results = await cortex.conversations.search({ query: "password" });

      expect(
        results.some(
          (r) => r.conversation.conversationId === conv.conversationId,
        ),
      ).toBe(false);

      // Add message with "password"
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "What is the password for the account?",
        },
      });

      // Should now find it
      results = await cortex.conversations.search({ query: "password" });
      expect(
        results.some(
          (r) => r.conversation.conversationId === conv.conversationId,
        ),
      ).toBe(true);
      expect(
        results.find(
          (r) => r.conversation.conversationId === conv.conversationId,
        )?.matchedMessages.length,
      ).toBe(1);

      // Add another message with "password"
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "agent",
          content: "The password is reset123",
        },
      });

      // Should find 2 matched messages
      results = await cortex.conversations.search({ query: "password" });
      const thisResult = results.find(
        (r) => r.conversation.conversationId === conv.conversationId,
      );

      expect(thisResult?.matchedMessages.length).toBe(2);
    });
  });
});
