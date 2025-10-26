/**
 * Cortex SDK - Conversations API E2E Tests (DEBUG MODE)
 * 
 * Enhanced test suite with:
 * - Table cleanup before all tests
 * - Storage inspection after each operation
 * - Step-by-step execution support
 * - Verbose logging
 * 
 * Run with: TEST_DEBUG=true TEST_VERBOSE=true npm test conversations.debug
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import {
  TestCleanup,
  StorageInspector,
  enableDebugMode,
  logStep,
  logSection,
  debugLog,
  pause,
  DEBUG_CONFIG,
} from "./helpers";

describe("Conversations API (Layer 1a) - DEBUG MODE", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  let inspector: StorageInspector;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    // Enable debug mode (can also use TEST_DEBUG=true env var)
    enableDebugMode({
      verboseLogging: true,
      inspectStorage: true,
      pauseAfterEachTest: false, // Set to true to pause between tests
    });

    logSection("TEST SUITE INITIALIZATION");

    // Initialize SDK and helpers
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);
    inspector = new StorageInspector(client);

    debugLog("Setup", "SDK and helpers initialized");

    // 🧹 CRITICAL: Purge conversations table before tests
    logStep(1, "Purging conversations table");
    await cleanup.purgeConversations();
    await cleanup.verifyConversationsEmpty();

    await pause("Table purged. Ready to start tests.");
  });

  afterAll(async () => {
    logSection("TEST SUITE CLEANUP");
    await cortex.close();
    client.close();
  });

  describe("create() - Step-by-Step", () => {
    it("Step 1: Create user-agent conversation with storage inspection", async () => {
      logSection("TEST: Create User-Agent Conversation");

      logStep(1, "Call SDK create method");
      const result = await cortex.conversations.create({
        type: "user-agent",
        participants: {
          userId: "user-123",
          agentId: "agent-456",
        },
        metadata: {
          source: "debug-test",
        },
      });

      debugLog("SDK Response", "Conversation created", {
        conversationId: result.conversationId,
        type: result.type,
        messageCount: result.messageCount,
      });

      logStep(2, "Validate SDK response");
      expect(result.conversationId).toMatch(/^conv-/);
      expect(result.type).toBe("user-agent");
      expect(result.participants.userId).toBe("user-123");
      expect(result.participants.agentId).toBe("agent-456");
      expect(result.messageCount).toBe(0);
      expect(result.metadata?.source).toBe("debug-test");

      logStep(3, "Inspect storage");
      await inspector.inspectConversation(result.conversationId);

      logStep(4, "Compare SDK result with storage");
      const comparison = await inspector.compareWithStorage(
        result.conversationId,
        result
      );
      expect(comparison.matches).toBe(true);

      logStep(5, "Print storage statistics");
      await inspector.printStats();

      await pause("Test complete. Review storage state above.");
    });

    it("Step 2: Create agent-agent conversation", async () => {
      logSection("TEST: Create Agent-Agent Conversation");

      logStep(1, "Call SDK create method");
      const result = await cortex.conversations.create({
        type: "agent-agent",
        participants: {
          agentIds: ["agent-1", "agent-2", "agent-3"],
        },
      });

      debugLog("SDK Response", "Agent-agent conversation created", {
        conversationId: result.conversationId,
        agentIds: result.participants.agentIds,
      });

      logStep(2, "Inspect storage");
      await inspector.inspectConversation(result.conversationId);

      logStep(3, "Verify storage state");
      expect(result.type).toBe("agent-agent");
      expect(result.participants.agentIds).toHaveLength(3);

      await pause();
    });

    it("Step 3: Test duplicate conversation error", async () => {
      logSection("TEST: Duplicate Conversation Error");

      const customId = "conv-duplicate-debug";

      logStep(1, "Create first conversation");
      await cortex.conversations.create({
        conversationId: customId,
        type: "user-agent",
        participants: {
          userId: "user-1",
          agentId: "agent-1",
        },
      });

      debugLog("Storage", "First conversation created");
      await inspector.inspectConversation(customId);

      logStep(2, "Attempt to create duplicate");
      await expect(
        cortex.conversations.create({
          conversationId: customId,
          type: "user-agent",
          participants: {
            userId: "user-2",
            agentId: "agent-2",
          },
        })
      ).rejects.toThrow("CONVERSATION_ALREADY_EXISTS");

      debugLog("Error", "Duplicate correctly rejected");

      await pause();
    });
  });

  describe("addMessage() - Step-by-Step", () => {
    it("Step 1: Add message and inspect full conversation", async () => {
      logSection("TEST: Add Message to Conversation");

      logStep(1, "Create conversation");
      const conversation = await cortex.conversations.create({
        type: "user-agent",
        participants: {
          userId: "user-msg-debug",
          agentId: "agent-msg-debug",
        },
      });

      debugLog("Initial State", "Empty conversation created");
      await inspector.inspectConversation(conversation.conversationId);

      logStep(2, "Add first message");
      const updated1 = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "user",
          content: "Hello, agent! This is message 1.",
          metadata: {
            sentiment: "positive",
          },
        },
      });

      debugLog("After Message 1", "Conversation updated", {
        messageCount: updated1.messageCount,
      });
      await inspector.inspectConversation(conversation.conversationId);

      logStep(3, "Add second message");
      const updated2 = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "agent",
          content: "Hi! This is message 2 from the agent.",
          agentId: "agent-msg-debug",
        },
      });

      debugLog("After Message 2", "Conversation updated", {
        messageCount: updated2.messageCount,
      });
      await inspector.inspectConversation(conversation.conversationId);

      logStep(4, "Add third message");
      const updated3 = await cortex.conversations.addMessage({
        conversationId: conversation.conversationId,
        message: {
          role: "user",
          content: "Great! This is message 3.",
        },
      });

      debugLog("After Message 3", "Final state", {
        messageCount: updated3.messageCount,
      });
      await inspector.inspectConversation(conversation.conversationId);

      logStep(5, "Validate immutability");
      expect(updated3.messageCount).toBe(3);
      expect(updated3.messages).toHaveLength(3);
      expect(updated3.messages[0].content).toContain("message 1");
      expect(updated3.messages[1].content).toContain("message 2");
      expect(updated3.messages[2].content).toContain("message 3");

      // Verify chronological order
      expect(updated3.messages[0].timestamp).toBeLessThan(
        updated3.messages[1].timestamp
      );
      expect(updated3.messages[1].timestamp).toBeLessThan(
        updated3.messages[2].timestamp
      );

      debugLog("Validation", "✅ All messages present in order");

      await pause("Review the conversation history above.");
    });
  });

  describe("list() and count() - Step-by-Step", () => {
    beforeAll(async () => {
      logSection("SETUP: Creating test data for list/count operations");

      // Create test conversations
      await cortex.conversations.create({
        conversationId: "conv-list-debug-1",
        type: "user-agent",
        participants: {
          userId: "user-list-debug",
          agentId: "agent-list-1",
        },
      });

      await cortex.conversations.create({
        conversationId: "conv-list-debug-2",
        type: "user-agent",
        participants: {
          userId: "user-list-debug",
          agentId: "agent-list-2",
        },
      });

      await cortex.conversations.create({
        conversationId: "conv-list-debug-3",
        type: "agent-agent",
        participants: {
          agentIds: ["agent-list-1", "agent-list-2"],
        },
      });

      debugLog("Setup", "Created 3 test conversations");
      await inspector.printStats();
      await inspector.inspectAllConversations();

      await pause("Test data created. Ready to test list/count operations.");
    });

    it("Step 1: List all conversations", async () => {
      logSection("TEST: List All Conversations");

      const conversations = await cortex.conversations.list();

      debugLog("Result", `Found ${conversations.length} conversations`);
      expect(conversations.length).toBeGreaterThan(0);

      await inspector.inspectAllConversations();
      await pause();
    });

    it("Step 2: List by userId", async () => {
      logSection("TEST: List by userId");

      const conversations = await cortex.conversations.list({
        userId: "user-list-debug",
      });

      debugLog("Result", `Found ${conversations.length} conversations for user-list-debug`);
      expect(conversations.length).toBeGreaterThanOrEqual(2);

      conversations.forEach((conv, idx) => {
        console.log(`  [${idx + 1}] ${conv.conversationId}`);
        expect(conv.participants.userId).toBe("user-list-debug");
      });

      await pause();
    });

    it("Step 3: Count operations", async () => {
      logSection("TEST: Count Operations");

      logStep(1, "Count all");
      const totalCount = await cortex.conversations.count();
      debugLog("Count", `Total conversations: ${totalCount}`);

      logStep(2, "Count by userId");
      const userCount = await cortex.conversations.count({
        userId: "user-list-debug",
      });
      debugLog("Count", `User conversations: ${userCount}`);

      logStep(3, "Count by type");
      const userAgentCount = await cortex.conversations.count({
        type: "user-agent",
      });
      debugLog("Count", `User-agent conversations: ${userAgentCount}`);

      await inspector.printStats();
      await pause();
    });
  });

  describe("delete() - Step-by-Step", () => {
    it("Step 1: Delete conversation and verify removal", async () => {
      logSection("TEST: Delete Conversation");

      logStep(1, "Create conversation to delete");
      const conversation = await cortex.conversations.create({
        type: "user-agent",
        participants: {
          userId: "user-delete-debug",
          agentId: "agent-delete-debug",
        },
      });

      debugLog("Created", "Conversation to be deleted");
      await inspector.inspectConversation(conversation.conversationId);

      logStep(2, "Delete the conversation");
      const result = await cortex.conversations.delete(conversation.conversationId);
      expect(result.deleted).toBe(true);
      debugLog("Deleted", `Conversation ${conversation.conversationId} removed`);

      logStep(3, "Verify it's gone from SDK");
      const retrieved = await cortex.conversations.get(conversation.conversationId);
      expect(retrieved).toBeNull();
      debugLog("Verification", "SDK confirms deletion");

      logStep(4, "Verify it's gone from storage");
      const stored = await client.query(api.conversations.get, {
        conversationId: conversation.conversationId,
      });
      expect(stored).toBeNull();
      debugLog("Verification", "Storage confirms deletion");

      await inspector.printStats();
      await pause("Deletion complete. Conversation removed from storage.");
    });
  });

  describe("Final Storage Inspection", () => {
    it("Review all conversations in storage", async () => {
      logSection("FINAL STORAGE STATE");

      await inspector.inspectAllConversations();
      await inspector.printStats();

      console.log("\n" + "🎉".repeat(40));
      console.log("All debug tests complete!");
      console.log("🎉".repeat(40) + "\n");
    });
  });
});

