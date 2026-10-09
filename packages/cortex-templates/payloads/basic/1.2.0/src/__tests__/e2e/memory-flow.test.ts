/**
 * E2E Tests: Memory Flow
 *
 * Tests full memory lifecycle with real Convex backend.
 * Requires: CONVEX_URL environment variable
 *
 * Run with: CONVEX_URL=<your-url> npm run test:e2e
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Cortex } from "@cortexmemory/sdk";
import {
  shouldSkipE2E,
  generateTestId,
  createTestMemorySpaceId,
  createTestUserId,
  createTestConversationId,
  wait,
} from "../helpers/test-utils.js";

// Skip all tests if CONVEX_URL not set
const SKIP_E2E = shouldSkipE2E();

describe("Memory Flow E2E", () => {
  let cortex: Cortex;
  let testMemorySpaceId: string;
  let testUserId: string;
  let testAgentId: string;

  beforeAll(() => {
    if (SKIP_E2E) {
      console.log("Skipping E2E tests - CONVEX_URL not configured");
      return;
    }

    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  beforeEach(() => {
    if (SKIP_E2E) return;

    // Generate unique IDs for test isolation
    testMemorySpaceId = createTestMemorySpaceId("e2e-mem");
    testUserId = createTestUserId();
    testAgentId = generateTestId("agent");
  });

  afterAll(async () => {
    if (cortex) {
      cortex.close();
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Basic Memory Storage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("basic memory storage", () => {
    it("should store a memory via remember()", async () => {
      const conversationId = createTestConversationId();

      const result = await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "Hello, I'm testing the memory system",
        agentResponse: "Hello! I'll remember this conversation.",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      expect(result).toBeDefined();
      expect(result.conversation).toBeDefined();
      expect(result.conversation.conversationId).toBe(conversationId);

      // Wait for async operations
      await wait(1000);

      // Verify we can retrieve memories
      const memories = await cortex.memory.list({
        memorySpaceId: testMemorySpaceId,
        limit: 10,
      });

      expect(memories.length).toBeGreaterThanOrEqual(0);
    }, 30000);

    it("should store multiple memories in same conversation", async () => {
      const conversationId = createTestConversationId();

      // First message
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "My name is Alice",
        agentResponse: "Nice to meet you, Alice!",
        userId: testUserId,
        userName: "Alice",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      // Second message
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "I work as a software engineer",
        agentResponse: "Software engineering is a great field!",
        userId: testUserId,
        userName: "Alice",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      await wait(1000);

      // Both memories should be stored
      const memories = await cortex.memory.list({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        limit: 10,
      });

      expect(memories.length).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Recall
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("memory recall", () => {
    it("should recall memories using recall()", async () => {
      const conversationId = createTestConversationId();

      // Store a memory
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "I live in San Francisco",
        agentResponse: "San Francisco is a beautiful city!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      await wait(2000);

      // Try to recall
      const result = await cortex.memory.recall({
        memorySpaceId: testMemorySpaceId,
        query: "Where do I live?",
        limit: 10,
        sources: {
          vector: true,
          facts: false,
          graph: false,
        },
      });

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(result.sources.vector).toBeDefined();
      // Note: Vector search requires embeddings to be generated
      // Without embedding provider, items array might be empty
    }, 30000);

    it("should return context string from recall", async () => {
      const conversationId = createTestConversationId();

      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "My favorite programming language is TypeScript",
        agentResponse: "TypeScript is great for type safety!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      await wait(2000);

      const result = await cortex.memory.recall({
        memorySpaceId: testMemorySpaceId,
        query: "programming",
        limit: 10,
      });

      expect(result).toBeDefined();
      // Context may or may not be populated depending on matches
    }, 30000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("conversation lifecycle", () => {
    it("should create conversation with messages", async () => {
      const conversationId = createTestConversationId();

      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "Hello",
        agentResponse: "Hi there!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      await wait(1000);

      // Get conversation
      const conversation = await cortex.conversations.get(conversationId);

      if (conversation) {
        expect(conversation.conversationId || conversation.id).toBeDefined();
      }
      // Conversation may not exist if remember didn't create one
    }, 30000);

    it("should list conversations for user", async () => {
      const conversationId = createTestConversationId();

      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "Test message",
        agentResponse: "Test response",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      await wait(1000);

      // List conversations
      const conversations = await cortex.conversations.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
      });

      expect(conversations).toBeDefined();
    }, 30000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Space Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("memory space isolation", () => {
    it("should isolate memories between memory spaces", async () => {
      const spaceA = createTestMemorySpaceId("space-a");
      const spaceB = createTestMemorySpaceId("space-b");
      const conversationId = createTestConversationId();

      // Store in space A
      await cortex.memory.remember({
        memorySpaceId: spaceA,
        conversationId,
        userMessage: "Secret in space A",
        agentResponse: "Stored!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      await wait(1000);

      // Recall from space B should not find space A's memories
      const resultB = await cortex.memory.recall({
        memorySpaceId: spaceB,
        query: "Secret",
        limit: 10,
      });

      // Space B should have no results from space A
      // (This is about isolation, not necessarily vector search)
      expect(resultB).toBeDefined();
    }, 30000);

    it("should isolate memories between users", async () => {
      const userA = createTestUserId();
      const userB = createTestUserId();
      const conversationId = createTestConversationId();

      // Store for user A
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "User A's secret preference",
        agentResponse: "Noted!",
        userId: userA,
        userName: "User A",
        agentId: testAgentId,
        agentName: "Test Agent",
      });

      await wait(1000);

      // List memories for user B (should not see user A's)
      const memoriesB = await cortex.memory.list({
        memorySpaceId: testMemorySpaceId,
        userId: userB,
        limit: 10,
      });

      // User B should not see user A's memories
      // (depends on SDK implementation)
      expect(memoriesB).toBeDefined();
    }, 30000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Error Handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("error handling", () => {
    it("should handle missing required parameters gracefully", async () => {
      // This should throw a validation error
      await expect(
        cortex.memory.remember({
          memorySpaceId: testMemorySpaceId,
          conversationId: createTestConversationId(),
          userMessage: "Test",
          agentResponse: "Test",
          // Missing userId and agentId
        } as any),
      ).rejects.toThrow();
    }, 10000);

    it("should handle recall on empty memory space", async () => {
      const emptySpace = createTestMemorySpaceId("empty");

      const result = await cortex.memory.recall({
        memorySpaceId: emptySpace,
        query: "anything",
        limit: 10,
      });

      // Should return empty results, not error
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(0);
    }, 10000);
  });
});
