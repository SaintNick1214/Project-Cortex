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
    await cortex.close();
    client.close();
  });

  describe("create()", () => {
    it("creates a user-agent conversation", async () => {
      const result = await cortex.conversations.create({
        type: "user-agent",
        participants: {
          userId: "user-123",
          agentId: "agent-456",
        },
        metadata: {
          source: "test",
        },
      });

      // Validate SDK response
      expect(result.conversationId).toMatch(/^conv-/);
      expect(result.type).toBe("user-agent");
      expect(result.participants.userId).toBe("user-123");
      expect(result.participants.agentId).toBe("agent-456");
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
      expect(stored!.participants).toEqual({
        userId: "user-123",
        agentId: "agent-456",
      });
      expect(stored!.messages).toEqual([]);
      expect(stored!.messageCount).toBe(0);
    });

    it("creates an agent-agent conversation", async () => {
      const result = await cortex.conversations.create({
        type: "agent-agent",
        participants: {
          agentIds: ["agent-1", "agent-2", "agent-3"],
        },
      });

      // Validate SDK response
      expect(result.type).toBe("agent-agent");
      expect(result.participants.agentIds).toEqual(["agent-1", "agent-2", "agent-3"]);
      expect(result.messageCount).toBe(0);

      // Validate storage
      const stored = await client.query(api.conversations.get, {
        conversationId: result.conversationId,
      });

      expect(stored!.type).toBe("agent-agent");
      expect(stored!.participants.agentIds).toHaveLength(3);
    });

    it("accepts custom conversationId", async () => {
      const customId = "conv-custom-123";

      const result = await cortex.conversations.create({
        conversationId: customId,
        type: "user-agent",
        participants: {
          userId: "user-1",
          agentId: "agent-1",
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
      const conversationId = "conv-duplicate-test";

      await cortex.conversations.create({
        conversationId,
        type: "user-agent",
        participants: {
          userId: "user-1",
          agentId: "agent-1",
        },
      });

      // Attempt to create duplicate
      await expect(
        cortex.conversations.create({
          conversationId,
          type: "user-agent",
          participants: {
            userId: "user-2",
            agentId: "agent-2",
          },
        })
      ).rejects.toThrow("CONVERSATION_ALREADY_EXISTS");
    });

    it("throws error for invalid user-agent participants", async () => {
      await expect(
        cortex.conversations.create({
          type: "user-agent",
          participants: {
            userId: "user-1",
            // Missing agentId
          },
        })
      ).rejects.toThrow("user-agent conversations require userId and agentId");
    });

    it("throws error for invalid agent-agent participants", async () => {
      await expect(
        cortex.conversations.create({
          type: "agent-agent",
          participants: {
            agentIds: ["agent-1"], // Only one agent
          },
        })
      ).rejects.toThrow("agent-agent conversations require at least 2 agentIds");
    });
  });

  describe("get()", () => {
    it("retrieves an existing conversation", async () => {
      // Create conversation
      const created = await cortex.conversations.create({
        type: "user-agent",
        participants: {
          userId: "user-get-test",
          agentId: "agent-get-test",
        },
      });

      // Retrieve it
      const retrieved = await cortex.conversations.get(created.conversationId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.conversationId).toBe(created.conversationId);
      expect(retrieved!.type).toBe("user-agent");
      expect(retrieved!.participants).toEqual({
        userId: "user-get-test",
        agentId: "agent-get-test",
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
        type: "user-agent",
        participants: {
          userId: "user-msg-test",
          agentId: "agent-msg-test",
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
        type: "user-agent",
        participants: {
          userId: "user-append-test",
          agentId: "agent-append-test",
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
          agentId: "agent-append-test",
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
      expect(final.messages[0].timestamp).toBeLessThan(final.messages[1].timestamp);
      expect(final.messages[1].timestamp).toBeLessThan(final.messages[2].timestamp);

      // Validate storage
      const stored = await client.query(api.conversations.get, {
        conversationId: conversation.conversationId,
      });

      expect(stored!.messageCount).toBe(3);
      expect(stored!.messages).toHaveLength(3);
    });

    it("accepts custom messageId", async () => {
      const conversation = await cortex.conversations.create({
        type: "user-agent",
        participants: {
          userId: "user-1",
          agentId: "agent-1",
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
      await expect(
        cortex.conversations.addMessage({
          conversationId: "conv-does-not-exist",
          message: {
            role: "user",
            content: "Test",
          },
        })
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("list()", () => {
    beforeAll(async () => {
      // Create test data
      await cortex.conversations.create({
        conversationId: "conv-list-1",
        type: "user-agent",
        participants: {
          userId: "user-list-test",
          agentId: "agent-list-1",
        },
      });

      await cortex.conversations.create({
        conversationId: "conv-list-2",
        type: "user-agent",
        participants: {
          userId: "user-list-test",
          agentId: "agent-list-2",
        },
      });

      await cortex.conversations.create({
        conversationId: "conv-list-3",
        type: "agent-agent",
        participants: {
          agentIds: ["agent-list-1", "agent-list-2"],
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

    it("filters by agentId", async () => {
      const conversations = await cortex.conversations.list({
        agentId: "agent-list-1",
      });

      // Should find both user-agent (conv-list-1) and agent-agent (conv-list-3)
      expect(conversations.length).toBe(2);
      conversations.forEach((conv) => {
        const hasAgent =
          conv.participants.agentId === "agent-list-1" ||
          conv.participants.agentIds?.includes("agent-list-1");
        expect(hasAgent).toBe(true);
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

    it("combines filters (userId + agentId)", async () => {
      const conversations = await cortex.conversations.list({
        userId: "user-list-test",
        agentId: "agent-list-1",
      });

      expect(conversations.length).toBeGreaterThanOrEqual(1);
      conversations.forEach((conv) => {
        expect(conv.participants.userId).toBe("user-list-test");
        expect(conv.participants.agentId).toBe("agent-list-1");
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

    it("counts by agentId", async () => {
      const count = await cortex.conversations.count({
        agentId: "agent-list-1",
      });

      expect(count).toBeGreaterThanOrEqual(1);
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
        type: "user-agent",
        participants: {
          userId: "user-delete-test",
          agentId: "agent-delete-test",
        },
      });

      // Delete it
      const result = await cortex.conversations.delete(conversation.conversationId);
      expect(result.deleted).toBe(true);

      // Verify it's gone
      const retrieved = await cortex.conversations.get(conversation.conversationId);
      expect(retrieved).toBeNull();

      // Verify storage
      const stored = await client.query(api.conversations.get, {
        conversationId: conversation.conversationId,
      });
      expect(stored).toBeNull();
    });

    it("throws error for non-existent conversation", async () => {
      await expect(
        cortex.conversations.delete("conv-does-not-exist")
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("Storage Validation", () => {
    it("validates complete ACID properties", async () => {
      const conversation = await cortex.conversations.create({
        type: "user-agent",
        participants: {
          userId: "user-acid-test",
          agentId: "agent-acid-test",
        },
      });

      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        await cortex.conversations.addMessage({
          conversationId: conversation.conversationId,
          message: {
            role: i % 2 === 0 ? "user" : "agent",
            content: `Message ${i + 1}`,
            agentId: i % 2 === 0 ? undefined : "agent-acid-test",
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
          final!.messages[i - 1].timestamp
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
        agentId: "agent-list-1",
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
        type: "user-agent",
        participants: {
          userId: "user-history-test",
          agentId: "agent-history-test",
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
      const history = await cortex.conversations.getHistory(testConversationId, {
        sortOrder: "asc",
        limit: 3,
      });

      expect(history.messages[0].content).toBe("Message 1");
      expect(history.messages[1].content).toBe("Message 2");
      expect(history.messages[2].content).toBe("Message 3");
    });

    it("supports descending order (newest first)", async () => {
      const history = await cortex.conversations.getHistory(testConversationId, {
        sortOrder: "desc",
        limit: 3,
      });

      expect(history.messages[0].content).toBe("Message 10");
      expect(history.messages[1].content).toBe("Message 9");
      expect(history.messages[2].content).toBe("Message 8");
    });

    it("handles edge case: offset beyond messages", async () => {
      const history = await cortex.conversations.getHistory(testConversationId, {
        offset: 100,
      });

      expect(history.messages).toHaveLength(0);
      expect(history.hasMore).toBe(false);
    });

    it("throws error for non-existent conversation", async () => {
      await expect(
        cortex.conversations.getHistory("conv-does-not-exist")
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("search()", () => {
    beforeAll(async () => {
      // Create test conversations with searchable content
      const conv1 = await cortex.conversations.create({
        conversationId: "conv-search-1",
        type: "user-agent",
        participants: {
          userId: "user-search-test",
          agentId: "agent-search-test",
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
        type: "user-agent",
        participants: {
          userId: "user-search-test",
          agentId: "agent-search-test",
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
        type: "user-agent",
        participants: {
          userId: "user-search-other",
          agentId: "agent-search-test",
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
          msg.content.toLowerCase().includes("password")
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
        expect(result.conversation.participants.userId).toBe("user-search-test");
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
        type: "user-agent",
        participants: {
          userId: "user-export-test",
          agentId: "agent-export-test",
        },
        metadata: { campaign: "summer-2025" },
      });

      await cortex.conversations.create({
        conversationId: "conv-export-2",
        type: "agent-agent",
        participants: {
          agentIds: ["agent-export-test", "agent-export-other"],
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
        filters: { agentId: "agent-export-test" },
        format: "csv",
        includeMetadata: false,
      });

      expect(exported.format).toBe("csv");
      expect(exported.count).toBeGreaterThanOrEqual(2);
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
});

