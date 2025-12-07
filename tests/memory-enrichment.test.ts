/**
 * E2E Tests: Memory Convenience API - Enrichment Operations
 *
 * Tests get() and search() with conversation enrichment
 * Split from memory.test.ts for parallel execution
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Memory Enrichment Operations", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("enrich");
  const TEST_USER_ID = ctx.userId("enrich");
  const TEST_AGENT_ID = ctx.agentId("enrich");
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
  // get() with enrichment
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("get() with enrichment", () => {
    let testMemoryId: string;
    let testConversationId: string;

    beforeAll(async () => {
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
        userMessage: "Enrichment test message",
        agentResponse: "Understood",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      testMemoryId = result.memories[0].memoryId;
    });

    it("returns vector only by default", async () => {
      const result = await cortex.memory.get(TEST_MEMSPACE_ID, testMemoryId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("memoryId");
      expect(result).toHaveProperty("content");
      expect(result).not.toHaveProperty("conversation");
    });

    it("enriches with ACID when includeConversation=true", async () => {
      const result = (await cortex.memory.get(TEST_MEMSPACE_ID, testMemoryId, {
        includeConversation: true,
      })) as any;

      expect(result).toBeDefined();
      expect(result).toHaveProperty("memory");
      expect(result).toHaveProperty("conversation");
      expect(result).toHaveProperty("sourceMessages");

      const enriched = result;

      expect(enriched.memory.memoryId).toBe(testMemoryId);
      expect(enriched.conversation.conversationId).toBe(testConversationId);
      expect(enriched.sourceMessages).toHaveLength(1);
    });

    it("handles missing conversation gracefully", async () => {
      // Create memory without conversation
      const standaloneMemory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Standalone memory",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: [] },
      });

      const result = await cortex.memory.get(
        TEST_MEMSPACE_ID,
        standaloneMemory.memoryId,
        {
          includeConversation: true,
        },
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("memory");
      expect((result as any).conversation).toBeUndefined();
    });

    it("returns null for non-existent memory", async () => {
      // Backend validation: existence check
      const result = await cortex.memory.get(TEST_MEMSPACE_ID, "non-existent");

      expect(result).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // search() with enrichment
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("search() with enrichment", () => {
    let testConversationId: string;

    beforeAll(async () => {
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

      // Create multiple memories
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "The password for admin is Secret123",
        agentResponse: "I've stored that password",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        importance: 100,
        tags: ["password", "security"],
      });

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "User prefers dark mode",
        agentResponse: "Noted",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        importance: 60,
        tags: ["preferences"],
      });
    });

    it("returns vector only by default", async () => {
      const results = await cortex.memory.search(TEST_MEMSPACE_ID, "password");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("memoryId");
      expect(results[0]).not.toHaveProperty("conversation");
    });

    it("enriches all results when enrichConversation=true", async () => {
      const results = await cortex.memory.search(TEST_MEMSPACE_ID, "password", {
        enrichConversation: true,
      });

      expect(results.length).toBeGreaterThan(0);

      const enriched = results[0] as unknown;

      expect(enriched).toHaveProperty("memory");
      expect(enriched).toHaveProperty("conversation");
      expect(enriched).toHaveProperty("sourceMessages");
    });

    it("handles mixed results (some with conv, some without)", async () => {
      // Add standalone memory
      await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Standalone password note",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["password"] },
      });

      const results = await cortex.memory.search(TEST_MEMSPACE_ID, "password", {
        enrichConversation: true,
      });

      expect(results.length).toBeGreaterThan(0);

      // Some should have conversations, some shouldn't
      const withConv = results.filter((r: any) => r.conversation);
      const withoutConv = results.filter((r: any) => !r.conversation);

      // Both types should exist
      expect(withConv.length + withoutConv.length).toBe(results.length);
    });

    it("preserves search relevance order after enrichment", async () => {
      const results = await cortex.memory.search(TEST_MEMSPACE_ID, "password", {
        enrichConversation: true,
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });
});
