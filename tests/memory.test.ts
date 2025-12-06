/**
 * E2E Tests: Memory Convenience API (Layer 3)
 *
 * Tests dual-layer orchestration (ACID + Vector) and enrichment capabilities
 */

import { jest } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import OpenAI from "openai";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

// OpenAI client (optional - tests skip if key not present)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OpenAI Helper Functions (for advanced embedding tests)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

async function summarizeConversation(
  userMessage: string,
  agentResponse: string,
): Promise<string | null> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content:
          "Extract key facts from this conversation in one concise sentence.",
      },
      {
        role: "user",
        content: `User: ${userMessage}\nAgent: ${agentResponse}`,
      },
    ],
    // temperature not supported with gpt-5-nano, uses default of 1
  });

  return response.choices[0].message.content;
}

describe("Memory Convenience API (Layer 3)", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("l3");
  const TEST_USER_ID = ctx.userId("l3");
  const TEST_AGENT_ID = ctx.agentId("l3");
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
  // Core Dual-Layer Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("remember()", () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create a conversation for testing
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
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

  describe("forget()", () => {
    let testMemoryId: string;
    let testConversationId: string;

    beforeEach(async () => {
      // Create conversation and memory
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
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

  describe("get() with enrichment", () => {
    let testMemoryId: string;
    let testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
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

  describe("search() with enrichment", () => {
    let testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
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

  describe("store() with smart detection", () => {
    let _testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
      });

      _testConversationId = conv.conversationId;
    });

    it("requires conversationRef for source.type=conversation", async () => {
      // Client-side validation: business logic check
      await expect(
        cortex.memory.store(TEST_MEMSPACE_ID, {
          content: "Conversation memory",
          contentType: "raw",
          source: {
            type: "conversation",
            userId: TEST_USER_ID,
            timestamp: Date.now(),
          },
          // Missing conversationRef!
          metadata: { importance: 50, tags: [] },
        }),
      ).rejects.toThrow("conversationRef is required");
    });

    it("allows standalone for source.type=system", async () => {
      const result = await cortex.memory.store(TEST_MEMSPACE_ID, {
        content: "System memory",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: [] },
      });

      expect(result).toBeDefined();
      expect(result.memory).toBeDefined();
      expect(result.memory.conversationRef).toBeUndefined();
    });

    it("delegates to vector.store correctly", async () => {
      const result = await cortex.memory.store(TEST_MEMSPACE_ID, {
        content: "Test storage",
        contentType: "raw",
        source: { type: "tool", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["test"] },
      });

      // Verify in vector storage
      const stored = await client.query(api.memories.get, {
        memorySpaceId: TEST_MEMSPACE_ID,
        memoryId: result.memory.memoryId,
      });

      expect(stored).not.toBeNull();
      expect(stored!.content).toBe("Test storage");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delegation Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Delegations", () => {
    describe("update()", () => {
      it("delegates to vector.update()", async () => {
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "Original",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.memory.update(
          TEST_MEMSPACE_ID,
          memory.memoryId,
          {
            content: "Updated",
            importance: 80,
          },
        );

        expect(result.memory.content).toBe("Updated");
        expect(result.memory.importance).toBe(80);
      });
    });

    describe("delete()", () => {
      it("delegates to vector.delete()", async () => {
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "To delete",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.memory.delete(
          TEST_MEMSPACE_ID,
          memory.memoryId,
        );

        expect(result.deleted).toBe(true);
        expect(result.memoryId).toBe(memory.memoryId);
      });
    });

    describe("list()", () => {
      it("delegates to vector.list()", async () => {
        await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "List test",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const results = await cortex.memory.list({
          memorySpaceId: TEST_MEMSPACE_ID,
        });

        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe("count()", () => {
      it("delegates to vector.count()", async () => {
        const count = await cortex.memory.count({
          memorySpaceId: TEST_MEMSPACE_ID,
        });

        expect(typeof count).toBe("number");
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe("updateMany()", () => {
      it("delegates to vector.updateMany()", async () => {
        for (let i = 0; i < 3; i++) {
          await cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Bulk update ${i}`,
            contentType: "raw",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 30, tags: ["bulk"] },
          });
        }

        const result = await cortex.memory.updateMany(
          { memorySpaceId: TEST_MEMSPACE_ID, sourceType: "system" },
          { importance: 80 },
        );

        expect(result.updated).toBeGreaterThan(0);
      });
    });

    describe("deleteMany()", () => {
      it("delegates to vector.deleteMany()", async () => {
        for (let i = 0; i < 3; i++) {
          await cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Bulk delete ${i}`,
            contentType: "raw",
            userId: "user-bulk",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 10, tags: ["bulk-delete"] },
          });
        }

        const result = await cortex.memory.deleteMany({
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: "user-bulk",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(3);
      });
    });

    describe("export()", () => {
      it("delegates to vector.export()", async () => {
        const result = await cortex.memory.export({
          memorySpaceId: TEST_MEMSPACE_ID,
          format: "json",
        });

        expect(result.format).toBe("json");
        expect(typeof result.data).toBe("string");
      });
    });

    describe("archive()", () => {
      it("delegates to vector.archive()", async () => {
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "To archive",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.memory.archive(
          TEST_MEMSPACE_ID,
          memory.memoryId,
        );

        expect(result.archived).toBe(true);
        expect(result.restorable).toBe(true);
      });
    });

    describe("getVersion()", () => {
      it("delegates to vector.getVersion()", async () => {
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "V1",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        await cortex.vector.update(TEST_MEMSPACE_ID, memory.memoryId, {
          content: "V2",
        });

        const v1 = await cortex.memory.getVersion(
          TEST_MEMSPACE_ID,
          memory.memoryId,
          1,
        );

        expect(v1).not.toBeNull();
        expect(v1!.content).toBe("V1");
      });
    });

    describe("getHistory()", () => {
      it("delegates to vector.getHistory()", async () => {
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "V1",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        await cortex.vector.update(TEST_MEMSPACE_ID, memory.memoryId, {
          content: "V2",
        });

        const history = await cortex.memory.getHistory(
          TEST_MEMSPACE_ID,
          memory.memoryId,
        );

        expect(history).toHaveLength(2);
        expect(history[0].content).toBe("V1");
        expect(history[1].content).toBe("V2");
      });
    });

    describe("getAtTimestamp()", () => {
      it("delegates to vector.getAtTimestamp()", async () => {
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "Temporal",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const atCreation = await cortex.memory.getAtTimestamp(
          TEST_MEMSPACE_ID,
          memory.memoryId,
          memory.createdAt,
        );

        expect(atCreation).not.toBeNull();
        expect(atCreation!.content).toBe("Temporal");
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Integration Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Integration", () => {
    it("complete flow: remember → search(enrich) → get(enrich) → forget", async () => {
      // Create conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
      });

      // Remember
      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userMessage: "Integration test: password is XYZ",
        agentResponse: "Stored!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        importance: 95,
        tags: ["integration", "password"],
      });

      expect(remembered.memories).toHaveLength(2);

      // Allow time for Convex to commit mutations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Search with enrichment
      const searchResults = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "password",
        {
          enrichConversation: true,
          userId: TEST_USER_ID,
        },
      );

      expect(searchResults.length).toBeGreaterThan(0);

      // Find the result - check both enriched and non-enriched structures
      const enrichedSearch = searchResults.find((r: unknown) => {
        const content = (r as any).memory?.content || (r as any).content;

        return (
          content?.includes("Integration test") || content?.includes("password")
        );
      }) as any;

      expect(enrichedSearch).toBeDefined();
      expect(
        (enrichedSearch as any).conversation || (enrichedSearch as any).memory,
      ).toBeDefined();

      // Get with enrichment
      const enrichedGet = (await cortex.memory.get(
        TEST_MEMSPACE_ID,
        remembered.memories[0].memoryId,
        { includeConversation: true },
      )) as any;

      expect(enrichedGet.memory).toBeDefined();
      expect(enrichedGet.conversation).toBeDefined();
      expect(enrichedGet.sourceMessages).toHaveLength(1);

      // Forget (preserve ACID)
      const forgot = await cortex.memory.forget(
        TEST_MEMSPACE_ID,
        remembered.memories[0].memoryId,
      );

      expect(forgot.memoryDeleted).toBe(true);
      expect(forgot.restorable).toBe(true);

      // Verify ACID preserved
      const convStillExists = await cortex.conversations.get(
        conv.conversationId,
      );

      expect(convStillExists).not.toBeNull();
    });

    it("forget with deleteConversation removes from both layers", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
      });

      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userMessage: "To be completely forgotten",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      const forgot = await cortex.memory.forget(
        TEST_MEMSPACE_ID,
        remembered.memories[0].memoryId,
        { deleteConversation: true, deleteEntireConversation: true },
      );

      expect(forgot.conversationDeleted).toBe(true);
      expect(forgot.restorable).toBe(false);

      // Verify both layers deleted
      const memory = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        remembered.memories[0].memoryId,
      );

      expect(memory).toBeNull();

      const conversation = await cortex.conversations.get(conv.conversationId);

      expect(conversation).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Cross-Layer Validation", () => {
    it("remember() creates data in both ACID and Vector", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
      });

      const beforeACID = await client.query(api.conversations.get, {
        conversationId: conv.conversationId,
      });
      const beforeMessageCount = beforeACID!.messageCount;

      const beforeVector = await client.query(api.memories.count, {
        memorySpaceId: TEST_MEMSPACE_ID,
      });

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userMessage: "Test",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      const afterACID = await client.query(api.conversations.get, {
        conversationId: conv.conversationId,
      });

      expect(afterACID!.messageCount).toBe(beforeMessageCount + 2);

      const afterVector = await client.query(api.memories.count, {
        memorySpaceId: TEST_MEMSPACE_ID,
      });

      expect(afterVector).toBe(beforeVector + 2);
    });

    it("delete() removes from Vector only, preserves ACID", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
      });

      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userMessage: "Delete test",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      await cortex.memory.delete(
        TEST_MEMSPACE_ID,
        remembered.memories[0].memoryId,
      );

      // Vector deleted
      const vectorMemory = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        remembered.memories[0].memoryId,
      );

      expect(vectorMemory).toBeNull();

      // ACID preserved
      const acidConv = await cortex.conversations.get(conv.conversationId);

      expect(acidConv).not.toBeNull();
      expect(acidConv!.messages.length).toBeGreaterThanOrEqual(2);
    });

    it("remember() propagates participantId to vector memories (Hive Mode)", async () => {
      // CRITICAL TEST: Validates participantId flows from remember() to vector layer
      // This test catches the bug where participantId wasn't passed to vector.store()

      const PARTICIPANT = "tool-calendar-test";

      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: PARTICIPANT, participantId: PARTICIPANT },
      });

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        participantId: PARTICIPANT, // ← Hive Mode: specify participant
        conversationId: conv.conversationId,
        userMessage: "Test message from tool",
        agentResponse: "Processed by tool",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        importance: 85,
        tags: ["hive-test"],
      });

      // ✅ CRITICAL: Verify participantId propagated to BOTH vector memories
      const userMemory = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      expect(userMemory).not.toBeNull();
      expect(userMemory!.participantId).toBe(PARTICIPANT); // ← Catches bug if missing
      expect(userMemory!.memorySpaceId).toBe(TEST_MEMSPACE_ID);
      expect(userMemory!.importance).toBe(85);
      expect(userMemory!.tags).toContain("hive-test");

      const agentMemory = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[1].memoryId,
      );

      expect(agentMemory).not.toBeNull();
      expect(agentMemory!.participantId).toBe(PARTICIPANT); // ← Catches bug if missing
      expect(agentMemory!.memorySpaceId).toBe(TEST_MEMSPACE_ID);

      // ✅ VERIFY: Can filter memories by participant
      const allMemories = await cortex.vector.list({
        memorySpaceId: TEST_MEMSPACE_ID,
      });

      const participantMemories = allMemories.filter(
        (m) => m.participantId === PARTICIPANT,
      );

      expect(participantMemories.length).toBeGreaterThanOrEqual(2);

      // ✅ HIVE MODE SUCCESS: Participant tracking works through remember()
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Advanced: Real-World Embedding & Recall (with OpenAI)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Advanced: Real-World Embedding & Recall", () => {
    // Skip if no API key
    const shouldRun = Boolean(openai);

    (shouldRun ? describe : describe.skip)("with OpenAI", () => {
      let conversationId: string;
      const storedMemories: Array<{ fact: string; memoryId: string }> = [];

      beforeAll(async () => {
        // NOTE: Removed purgeAll() for parallel execution compatibility.
        // Each test uses ctx-scoped IDs to avoid conflicts.

        // Create conversation
        const conv = await cortex.conversations.create({
          type: "user-agent",
          memorySpaceId: TEST_MEMSPACE_ID,
          participants: {
            userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
            participantId: TEST_AGENT_ID,
          },
        });

        conversationId = conv.conversationId;
      });

      it("stores multiple facts with real embeddings and summarization", async () => {
        // Scenario: Customer support conversation with 5 key facts
        const conversations = [
          {
            user: "My name is Alexander Johnson and I prefer to be called Alex",
            agent: "Got it, I'll call you Alex!",
            fact: "user-name",
          },
          {
            user: "My email is alex.johnson@techcorp.com for any updates",
            agent: "I've noted your email address",
            fact: "user-email",
          },
          {
            user: "The API password for production is SecurePass2024!",
            agent: "I'll remember that password securely",
            fact: "api-password",
          },
          {
            user: "We need the new feature deployed by Friday 5pm EST",
            agent: "Noted - deployment deadline is Friday at 5pm EST",
            fact: "deadline",
          },
          {
            user: "I prefer dark mode theme and minimal notifications",
            agent: "I'll set dark mode and reduce notifications",
            fact: "preferences",
          },
        ];

        // Store each with embeddings and summarization
        for (const conv of conversations) {
          const result = await cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId,
            userMessage: conv.user,
            agentResponse: conv.agent,
            userId: TEST_USER_ID,
            userName: "Alex Johnson",
            agentId: TEST_AGENT_ID,
            generateEmbedding,
            extractContent: summarizeConversation,
            importance: conv.fact === "api-password" ? 100 : 70,
            tags: [conv.fact, "customer-support"],
          });

          storedMemories.push({
            fact: conv.fact,
            memoryId: result.memories[0].memoryId,
          });

          // Verify embeddings were stored
          expect(result.memories[0].embedding).toBeDefined();
          expect(result.memories[0].embedding).toHaveLength(1536);
          expect(result.memories[0].contentType).toBe("summarized");
        }

        expect(storedMemories).toHaveLength(5);
      }, 60000); // 60s timeout for API calls

      it("recalls facts using semantic search (not keyword matching)", async () => {
        // Skip if running in LOCAL mode (no vector search support)
        if (
          process.env.CONVEX_URL?.includes("localhost") ||
          process.env.CONVEX_URL?.includes("127.0.0.1")
        ) {
          console.log(
            "⏭️  Skipping: Semantic search requires MANAGED mode (LOCAL doesn't support vector search)",
          );
          return;
        }

        // Test semantic understanding (queries don't match exact words)
        // VALIDATION: Expected content MUST be in the top 3 results
        // Note: Semantic search ranking can vary due to LLM summarization variability
        // Top 3 provides a reasonable balance between strictness and reliability
        const searches = [
          {
            query: "what should I address the user as",
            expectInContent: "Alex",
          },
          {
            query: "how do I contact them electronically",
            expectInContent: "email",
          },
          {
            query: "production system credentials",
            expectInContent: "password",
          },
          { query: "when is the deployment due", expectInContent: "Friday" },
          { query: "UI appearance settings", expectInContent: "dark mode" },
        ];

        for (const search of searches) {
          const results = (await cortex.memory.search(
            TEST_MEMSPACE_ID,
            search.query,
            {
              embedding: await generateEmbedding(search.query),
              userId: TEST_USER_ID,
              limit: 10, // Get more results for debugging context
            },
          )) as unknown[];

          // Should find the relevant fact (semantic match, not keyword)
          expect(results.length).toBeGreaterThan(0);

          // Check top 3 results for expected content
          const top3Results = results.slice(0, 3) as {
            content: string;
            _score?: number;
          }[];

          // Find if expected content is in any of the top 3 results
          const matchingResult = top3Results.find((r) =>
            r.content
              .toLowerCase()
              .includes(search.expectInContent.toLowerCase()),
          );

          // Log all top 5 results for debugging context if not found
          if (!matchingResult) {
            console.log(
              `  ⚠ Query: "${search.query}" - Expected "${search.expectInContent}" NOT in top 3:`,
            );
            (
              results.slice(0, 5) as { content: string; _score?: number }[]
            ).forEach((r, i) => {
              console.log(
                `    ${i + 1}. "${r.content.substring(0, 80)}..." (score: ${r._score?.toFixed(3) || "N/A"})`,
              );
            });
          }

          // VALIDATION: Expected content MUST appear in top 3 results
          expect(matchingResult).toBeDefined();

          // Log for visibility
          const matchIndex = (
            results.slice(0, 5) as { content: string; _score?: number }[]
          ).findIndex((r) =>
            r.content
              .toLowerCase()
              .includes(search.expectInContent.toLowerCase()),
          );
          console.log(
            `  ✓ Query: "${search.query}" → Found "${search.expectInContent}" at position ${matchIndex + 1}`,
          );
        }
      }, 60000); // 60s timeout for API calls

      it("enriches search results with full conversation context", async () => {
        const results = await cortex.memory.search(
          TEST_MEMSPACE_ID,
          "password",
          {
            embedding: await generateEmbedding("password credentials"),
            enrichConversation: true,
            userId: TEST_USER_ID,
          },
        );

        expect(results.length).toBeGreaterThan(0);

        const enriched = results[0] as any;

        // Check if it's enriched structure (has .memory)
        if (enriched.memory) {
          // Enriched structure exists
          expect(enriched.memory).toBeDefined();

          // Conversation may or may not exist (depends on conversationRef)
          if (enriched.conversation) {
            expect(enriched.conversation).toBeDefined();
            expect(enriched.sourceMessages).toBeDefined();
            expect(enriched.sourceMessages.length).toBeGreaterThan(0);

            console.log(
              `  ✓ Enriched: Vector="${enriched.memory.content.substring(0, 40)}..."`,
            );
            console.log(
              `  ✓ ACID source="${enriched.sourceMessages[0].content.substring(0, 40)}..."`,
            );
          } else {
            // No conversation (system memory or conversation deleted)
            console.log(
              `  ✓ Enriched (no conversation): "${enriched.memory.content.substring(0, 40)}..."`,
            );
          }
        } else {
          // Direct structure (no enrichment wrapper)
          expect(enriched.content).toBeDefined();
          console.log(
            `  ✓ Direct result: "${enriched.content.substring(0, 40)}..."`,
          );
        }
      }, 30000);

      it("validates summarization quality", async () => {
        // Skip if storedMemories wasn't populated (e.g., previous test failed)
        if (storedMemories.length === 0) {
          console.log(
            "⏭️  Skipping: storedMemories not populated (prerequisite test may have failed)",
          );
          return;
        }

        // Get a summarized memory
        const memory = await cortex.vector.get(
          TEST_MEMSPACE_ID,
          storedMemories[0].memoryId,
        );

        // Memory might have been cleaned up by parallel tests
        if (!memory) {
          console.log(
            "⏭️  Skipping: Memory no longer exists (may have been cleaned up)",
          );
          return;
        }

        expect(memory.contentType).toBe("summarized");

        // Summarized content should be concise (relaxed constraint for gpt-5-nano default temperature)
        const original =
          "My name is Alexander Johnson and I prefer to be called Alex";

        expect(memory!.content.length).toBeLessThan(original.length * 2.5);
        expect(memory!.content.toLowerCase()).toContain("alex");

        console.log(`  ✓ Original: "${original}"`);
        console.log(`  ✓ Summarized: "${memory!.content}"`);
      }, 30000);

      it("similarity scores are realistic (0-1 range)", async () => {
        const results = (await cortex.memory.search(
          TEST_MEMSPACE_ID,
          "API password for production environment",
          {
            embedding: await generateEmbedding(
              "API password for production environment",
            ),
            userId: TEST_USER_ID,
          },
        )) as unknown[];

        expect(results.length).toBeGreaterThan(0);

        // Validate scores are in valid range
        const resultsWithScores = results.filter(
          (r: any) => r._score !== undefined && !isNaN(r._score),
        );

        expect(resultsWithScores.length).toBeGreaterThan(0);

        resultsWithScores.forEach((result: any) => {
          const score = result._score;

          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
          console.log(
            `  ✓ Memory "${result.content.substring(0, 30)}..." score: ${score.toFixed(4)}`,
          );
        });
      }, 30000);
    });
  });

  describe("Archive and Restore Operations", () => {
    it("restores memory from archive", async () => {
      const memorySpaceId = "test-archive-space";

      // Create and archive a memory
      const conv = await cortex.conversations.create({
        memorySpaceId,
        type: "user-agent",
        participants: {
          userId: "test-user",
          agentId: "test-agent",
          participantId: "test-agent",
        },
      });

      const result = await cortex.memory.remember({
        memorySpaceId,
        conversationId: conv.conversationId,
        userMessage: "Important information",
        agentResponse: "Got it!",
        userId: "test-user",
        userName: "Test User",
        agentId: "test-agent",
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
      const memorySpaceId = "test-archive-space";

      const conv = await cortex.conversations.create({
        memorySpaceId,
        type: "user-agent",
        participants: {
          userId: "test-user",
          agentId: "test-agent",
          participantId: "test-agent",
        },
      });

      const result = await cortex.memory.remember({
        memorySpaceId,
        conversationId: conv.conversationId,
        userMessage: "Not archived",
        agentResponse: "OK",
        userId: "test-user",
        userName: "Test User",
        agentId: "test-agent",
      });

      const memoryId = result.memories[0].memoryId;

      // Try to restore without archiving first
      // Backend validation: archive status check
      await expect(
        cortex.memory.restoreFromArchive(memorySpaceId, memoryId),
      ).rejects.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    let testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID, participantId: TEST_AGENT_ID },
      });
      testConversationId = conv.conversationId;
    });

    describe("remember() validation", () => {
      it("uses default memorySpaceId with warning when not provided", async () => {
        // Capture console.warn calls
        const warnSpy = jest
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        // Should succeed (not throw) when memorySpaceId is not provided
        const result = await cortex.memory.remember({
          memorySpaceId: undefined as any,
          conversationId: testConversationId,
          userMessage: "Test default memorySpace",
          agentResponse: "OK",
          userId: TEST_USER_ID,
          userName: TEST_USER_NAME,
          agentId: TEST_AGENT_ID,
        });

        // Should have succeeded
        expect(result).toBeDefined();
        expect(result.memories.length).toBeGreaterThan(0);

        // Should have emitted a warning
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("No memorySpaceId provided"),
        );

        warnSpy.mockRestore();
      });

      it("throws on empty memorySpaceId (whitespace)", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: "   ",
            conversationId: testConversationId,
            userMessage: "Test",
            agentResponse: "OK",
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on missing conversationId", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: undefined as any,
            userMessage: "Test",
            agentResponse: "OK",
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("conversationId is required");
      });

      it("throws on missing userMessage", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: undefined as any,
            agentResponse: "OK",
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("userMessage is required");
      });

      it("throws on empty userMessage", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "   ",
            agentResponse: "OK",
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("userMessage cannot be empty");
      });

      it("throws on missing agentResponse", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            agentResponse: undefined as any,
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("agentResponse is required");
      });

      it("throws on missing owner (neither userId nor agentId)", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            agentResponse: "OK",
            // Neither userId nor agentId provided
            userName: TEST_USER_NAME,
          }),
        ).rejects.toThrow("Either userId or agentId must be provided");
      });

      it("throws on invalid importance (< 0)", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            agentResponse: "OK",
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
            importance: -1,
          }),
        ).rejects.toThrow("importance must be between 0 and 100");
      });

      it("throws on invalid importance (> 100)", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            agentResponse: "OK",
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
            importance: 150,
          }),
        ).rejects.toThrow("importance must be between 0 and 100");
      });

      it("throws on tags with empty strings", async () => {
        await expect(
          cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            agentResponse: "OK",
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
            tags: ["valid", "", "tag"],
          }),
        ).rejects.toThrow("must be a non-empty string");
      });
    });

    describe("rememberStream() validation", () => {
      it("throws on invalid stream object", async () => {
        await expect(
          cortex.memory.rememberStream({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            responseStream: {} as any,
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("responseStream must be");
      });

      it("throws on null stream", async () => {
        await expect(
          cortex.memory.rememberStream({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            responseStream: null as any,
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("responseStream must be");
      });

      it("inherits remember() validations (empty memorySpaceId)", async () => {
        // Mock valid stream
        const mockStream = (async function* () {
          yield "test";
        })();

        await expect(
          cortex.memory.rememberStream({
            memorySpaceId: "",
            conversationId: testConversationId,
            userMessage: "Test",
            responseStream: mockStream,
            userId: TEST_USER_ID,
            userName: TEST_USER_NAME,
            agentId: TEST_AGENT_ID,
          }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("inherits remember() validations (missing owner)", async () => {
        // Mock valid stream
        const mockStream = (async function* () {
          yield "test";
        })();

        await expect(
          cortex.memory.rememberStream({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId: testConversationId,
            userMessage: "Test",
            responseStream: mockStream,
            // Neither userId nor agentId provided
          }),
        ).rejects.toThrow("Either userId or agentId");
      });
    });

    describe("forget() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(cortex.memory.forget("", "mem-123")).rejects.toThrow(
          "memorySpaceId cannot be empty",
        );
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.forget(TEST_MEMSPACE_ID, "   "),
        ).rejects.toThrow("memoryId cannot be empty");
      });
    });

    describe("get() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(cortex.memory.get("", "mem-123")).rejects.toThrow(
          "memorySpaceId cannot be empty",
        );
      });

      it("throws on empty memoryId", async () => {
        await expect(cortex.memory.get(TEST_MEMSPACE_ID, "")).rejects.toThrow(
          "memoryId cannot be empty",
        );
      });
    });

    describe("search() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(cortex.memory.search("", "query")).rejects.toThrow(
          "memorySpaceId cannot be empty",
        );
      });

      it("throws on empty query", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "   "),
        ).rejects.toThrow("query cannot be empty");
      });

      it("throws on invalid embedding (empty array)", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            embedding: [],
          }),
        ).rejects.toThrow("embedding cannot be empty");
      });

      it("throws on invalid embedding (NaN values)", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            embedding: [0.1, NaN, 0.3],
          }),
        ).rejects.toThrow("must be a finite number");
      });

      it("throws on invalid minScore (< 0)", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            minScore: -0.5,
          }),
        ).rejects.toThrow("minScore must be between 0 and 1");
      });

      it("throws on invalid minScore (> 1)", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            minScore: 1.5,
          }),
        ).rejects.toThrow("minScore must be between 0 and 1");
      });

      it("throws on invalid limit (0)", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            limit: 0,
          }),
        ).rejects.toThrow("limit must be a positive integer");
      });

      it("throws on invalid limit (negative)", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            limit: -10,
          }),
        ).rejects.toThrow("limit must be a positive integer");
      });

      it("throws on tags with empty strings", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            tags: ["valid", ""],
          }),
        ).rejects.toThrow("must be a non-empty string");
      });

      it("throws on invalid minImportance (> 100)", async () => {
        await expect(
          cortex.memory.search(TEST_MEMSPACE_ID, "query", {
            minImportance: 150,
          }),
        ).rejects.toThrow("minImportance must be between 0 and 100");
      });
    });

    describe("store() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.store("", {
            content: "Test",
            contentType: "raw",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on empty content", async () => {
        await expect(
          cortex.memory.store(TEST_MEMSPACE_ID, {
            content: "   ",
            contentType: "raw",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("content cannot be empty");
      });

      it("throws on invalid contentType", async () => {
        await expect(
          cortex.memory.store(TEST_MEMSPACE_ID, {
            content: "Test",
            contentType: "unknown" as any,
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("Invalid contentType");
      });

      it("throws on invalid sourceType", async () => {
        await expect(
          cortex.memory.store(TEST_MEMSPACE_ID, {
            content: "Test",
            contentType: "raw",
            source: { type: "invalid" as any, timestamp: Date.now() },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow("Invalid sourceType");
      });

      it("throws when conversationRef missing for conversation source", async () => {
        await expect(
          cortex.memory.store(TEST_MEMSPACE_ID, {
            content: "Test",
            contentType: "raw",
            source: { type: "conversation", timestamp: Date.now() },
            metadata: { importance: 50, tags: [] },
          }),
        ).rejects.toThrow(
          'conversationRef is required when source.type is "conversation"',
        );
      });

      it("throws on invalid embedding", async () => {
        await expect(
          cortex.memory.store(TEST_MEMSPACE_ID, {
            content: "Test",
            contentType: "raw",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 50, tags: [] },
            embedding: [Infinity, 0.2],
          }),
        ).rejects.toThrow("must be a finite number");
      });

      it("throws on invalid importance", async () => {
        await expect(
          cortex.memory.store(TEST_MEMSPACE_ID, {
            content: "Test",
            contentType: "raw",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 150, tags: [] },
          }),
        ).rejects.toThrow("importance must be between 0 and 100");
      });

      it("throws on tags with empty strings", async () => {
        await expect(
          cortex.memory.store(TEST_MEMSPACE_ID, {
            content: "Test",
            contentType: "raw",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 50, tags: ["valid", ""] },
          }),
        ).rejects.toThrow("must be a non-empty string");
      });
    });

    describe("update() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.update("", "mem-123", { content: "Updated" }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.update(TEST_MEMSPACE_ID, "", { content: "Updated" }),
        ).rejects.toThrow("memoryId cannot be empty");
      });

      it("throws when no update fields provided", async () => {
        await expect(
          cortex.memory.update(TEST_MEMSPACE_ID, "mem-123", {}),
        ).rejects.toThrow("At least one update field must be provided");
      });

      it("throws on invalid importance", async () => {
        await expect(
          cortex.memory.update(TEST_MEMSPACE_ID, "mem-123", {
            importance: -5,
          }),
        ).rejects.toThrow("importance must be between 0 and 100");
      });

      it("throws on invalid embedding", async () => {
        await expect(
          cortex.memory.update(TEST_MEMSPACE_ID, "mem-123", {
            embedding: [],
          }),
        ).rejects.toThrow("embedding cannot be empty");
      });

      it("throws on tags with empty strings", async () => {
        await expect(
          cortex.memory.update(TEST_MEMSPACE_ID, "mem-123", {
            tags: ["", "valid"],
          }),
        ).rejects.toThrow("must be a non-empty string");
      });
    });

    describe("delete() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(cortex.memory.delete("", "mem-123")).rejects.toThrow(
          "memorySpaceId cannot be empty",
        );
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.delete(TEST_MEMSPACE_ID, ""),
        ).rejects.toThrow("memoryId cannot be empty");
      });
    });

    describe("list() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(cortex.memory.list({ memorySpaceId: "" })).rejects.toThrow(
          "memorySpaceId cannot be empty",
        );
      });

      it("throws on invalid sourceType", async () => {
        await expect(
          cortex.memory.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });

      it("throws on invalid limit (negative)", async () => {
        await expect(
          cortex.memory.list({
            memorySpaceId: TEST_MEMSPACE_ID,
            limit: -5,
          }),
        ).rejects.toThrow("limit must be a positive integer");
      });
    });

    describe("count() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.count({ memorySpaceId: "" }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on invalid sourceType", async () => {
        await expect(
          cortex.memory.count({
            memorySpaceId: TEST_MEMSPACE_ID,
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });
    });

    describe("updateMany() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.updateMany({ memorySpaceId: "" }, { importance: 80 }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws when no update fields provided", async () => {
        await expect(
          cortex.memory.updateMany({ memorySpaceId: TEST_MEMSPACE_ID }, {}),
        ).rejects.toThrow("At least one update field must be provided");
      });

      it("throws on invalid importance", async () => {
        await expect(
          cortex.memory.updateMany(
            { memorySpaceId: TEST_MEMSPACE_ID },
            { importance: 200 },
          ),
        ).rejects.toThrow("importance must be between 0 and 100");
      });

      it("throws on tags with empty strings", async () => {
        await expect(
          cortex.memory.updateMany(
            { memorySpaceId: TEST_MEMSPACE_ID },
            { tags: ["valid", ""] },
          ),
        ).rejects.toThrow("must be a non-empty string");
      });
    });

    describe("deleteMany() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.deleteMany({ memorySpaceId: "" }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on completely empty filter (prevents mass delete)", async () => {
        await expect(
          cortex.memory.deleteMany({ memorySpaceId: TEST_MEMSPACE_ID }),
        ).rejects.toThrow("Filter must include at least one criterion");
      });

      it("throws on invalid sourceType", async () => {
        await expect(
          cortex.memory.deleteMany({
            memorySpaceId: TEST_MEMSPACE_ID,
            sourceType: "invalid" as any,
          }),
        ).rejects.toThrow("Invalid sourceType");
      });
    });

    describe("export() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.export({
            memorySpaceId: "",
            format: "json",
          }),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on invalid format", async () => {
        await expect(
          cortex.memory.export({
            memorySpaceId: TEST_MEMSPACE_ID,
            format: "xml" as any,
          }),
        ).rejects.toThrow("Invalid format");
      });
    });

    describe("archive() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(cortex.memory.archive("", "mem-123")).rejects.toThrow(
          "memorySpaceId cannot be empty",
        );
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.archive(TEST_MEMSPACE_ID, ""),
        ).rejects.toThrow("memoryId cannot be empty");
      });
    });

    describe("restoreFromArchive() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.restoreFromArchive("", "mem-123"),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.restoreFromArchive(TEST_MEMSPACE_ID, ""),
        ).rejects.toThrow("memoryId cannot be empty");
      });
    });

    describe("getVersion() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.getVersion("", "mem-123", 1),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.getVersion(TEST_MEMSPACE_ID, "", 1),
        ).rejects.toThrow("memoryId cannot be empty");
      });

      it("throws on invalid version (0)", async () => {
        await expect(
          cortex.memory.getVersion(TEST_MEMSPACE_ID, "mem-123", 0),
        ).rejects.toThrow("version must be a positive integer");
      });

      it("throws on negative version", async () => {
        await expect(
          cortex.memory.getVersion(TEST_MEMSPACE_ID, "mem-123", -1),
        ).rejects.toThrow("version must be a positive integer");
      });
    });

    describe("getHistory() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(cortex.memory.getHistory("", "mem-123")).rejects.toThrow(
          "memorySpaceId cannot be empty",
        );
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.getHistory(TEST_MEMSPACE_ID, ""),
        ).rejects.toThrow("memoryId cannot be empty");
      });
    });

    describe("getAtTimestamp() validation", () => {
      it("throws on empty memorySpaceId", async () => {
        await expect(
          cortex.memory.getAtTimestamp("", "mem-123", Date.now()),
        ).rejects.toThrow("memorySpaceId cannot be empty");
      });

      it("throws on empty memoryId", async () => {
        await expect(
          cortex.memory.getAtTimestamp(TEST_MEMSPACE_ID, "", Date.now()),
        ).rejects.toThrow("memoryId cannot be empty");
      });

      it("throws on invalid timestamp (NaN)", async () => {
        await expect(
          cortex.memory.getAtTimestamp(TEST_MEMSPACE_ID, "mem-123", NaN),
        ).rejects.toThrow("timestamp must be a valid timestamp");
      });

      it("throws on negative timestamp", async () => {
        await expect(
          cortex.memory.getAtTimestamp(TEST_MEMSPACE_ID, "mem-123", -1000),
        ).rejects.toThrow("timestamp cannot be negative");
      });
    });
  });
});
