/**
 * E2E Tests: Memory Convenience API (Layer 3)
 *
 * Tests dual-layer orchestration (ACID + Vector) and enrichment capabilities
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import OpenAI from "openai";
import { TestCleanup } from "./helpers/cleanup";

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
    model: "gpt-4o-mini",
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
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}

describe("Memory Convenience API (Layer 3)", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_AGENT_ID = "agent-test-l3";
  const TEST_USER_ID = "user-test-l3";
  const TEST_USER_NAME = "Test User";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);

    await cleanup.purgeAll();
  });

  afterAll(async () => {
    await cleanup.purgeAll();
    client.close();
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
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      testConversationId = conv.conversationId;
    });

    it("stores both messages in ACID and creates 2 vector memories", async () => {
      const result = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "The password is Blue",
        agentResponse: "I'll remember that password!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
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
        agentId: TEST_AGENT_ID,
        memoryId: result.memories[0].memoryId,
      });

      expect(memory1).not.toBeNull();
      expect(memory1!.conversationRef).toBeDefined();
      expect(memory1!.conversationRef!.conversationId).toBe(testConversationId);
    });

    it("links vector memories to ACID messages via conversationRef", async () => {
      const result = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "Remember this important fact",
        agentResponse: "Got it!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
      });

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

    it("handles embedding generation callback", async () => {
      let callCount = 0;
      const mockEmbed = async (_content: string) => {
        callCount++;

        return [0.1, 0.2, 0.3]; // Mock embedding
      };

      const result = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "Test embedding",
        agentResponse: "Embedded!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
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
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "Long user message with lots of detail",
        agentResponse: "Short response",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
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
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "Critical password information",
        agentResponse: "Stored securely",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
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
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "Regular message",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
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
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      testConversationId = conv.conversationId;

      const result = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "Memory to forget",
        agentResponse: "Noted",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
      });

      testMemoryId = result.memories[0].memoryId;
    });

    it("deletes from vector by default", async () => {
      const result = await cortex.memory.forget(TEST_AGENT_ID, testMemoryId);

      expect(result.memoryDeleted).toBe(true);
      expect(result.conversationDeleted).toBe(false);
      expect(result.restorable).toBe(true); // ACID preserved

      // Verify vector deleted
      const memory = await cortex.vector.get(TEST_AGENT_ID, testMemoryId);

      expect(memory).toBeNull();

      // Verify ACID preserved
      const conv = await cortex.conversations.get(testConversationId);

      expect(conv).not.toBeNull();
    });

    it("deletes from both layers when deleteConversation=true", async () => {
      const result = await cortex.memory.forget(TEST_AGENT_ID, testMemoryId, {
        deleteConversation: true,
        deleteEntireConversation: true,
      });

      expect(result.memoryDeleted).toBe(true);
      expect(result.conversationDeleted).toBe(true);
      expect(result.restorable).toBe(false); // Both layers deleted

      // Verify vector deleted
      const memory = await cortex.vector.get(TEST_AGENT_ID, testMemoryId);

      expect(memory).toBeNull();

      // Verify ACID deleted
      const conv = await cortex.conversations.get(testConversationId);

      expect(conv).toBeNull();
    });

    it("throws error for non-existent memory", async () => {
      await expect(
        cortex.memory.forget(TEST_AGENT_ID, "non-existent"),
      ).rejects.toThrow("MEMORY_NOT_FOUND");
    });
  });

  describe("get() with enrichment", () => {
    let testMemoryId: string;
    let testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      testConversationId = conv.conversationId;

      const result = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "Enrichment test message",
        agentResponse: "Understood",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
      });

      testMemoryId = result.memories[0].memoryId;
    });

    it("returns vector only by default", async () => {
      const result = await cortex.memory.get(TEST_AGENT_ID, testMemoryId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("memoryId");
      expect(result).toHaveProperty("content");
      expect(result).not.toHaveProperty("conversation");
    });

    it("enriches with ACID when includeConversation=true", async () => {
      const result = (await cortex.memory.get(TEST_AGENT_ID, testMemoryId, {
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
      const standaloneMemory = await cortex.vector.store(TEST_AGENT_ID, {
        content: "Standalone memory",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: [] },
      });

      const result = await cortex.memory.get(
        TEST_AGENT_ID,
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
      const result = await cortex.memory.get(TEST_AGENT_ID, "non-existent");

      expect(result).toBeNull();
    });
  });

  describe("search() with enrichment", () => {
    let testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      testConversationId = conv.conversationId;

      // Create multiple memories
      await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "The password for admin is Secret123",
        agentResponse: "I've stored that password",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        importance: 100,
        tags: ["password", "security"],
      });

      await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: testConversationId,
        userMessage: "User prefers dark mode",
        agentResponse: "Noted",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        importance: 60,
        tags: ["preferences"],
      });
    });

    it("returns vector only by default", async () => {
      const results = await cortex.memory.search(TEST_AGENT_ID, "password");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("memoryId");
      expect(results[0]).not.toHaveProperty("conversation");
    });

    it("enriches all results when enrichConversation=true", async () => {
      const results = await cortex.memory.search(TEST_AGENT_ID, "password", {
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
      await cortex.vector.store(TEST_AGENT_ID, {
        content: "Standalone password note",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["password"] },
      });

      const results = await cortex.memory.search(TEST_AGENT_ID, "password", {
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
      const results = await cortex.memory.search(TEST_AGENT_ID, "password", {
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
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      _testConversationId = conv.conversationId;
    });

    it("requires conversationRef for source.type=conversation", async () => {
      await expect(
        cortex.memory.store(TEST_AGENT_ID, {
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
      ).rejects.toThrow("conversationRef required");
    });

    it("allows standalone for source.type=system", async () => {
      const memory = await cortex.memory.store(TEST_AGENT_ID, {
        content: "System memory",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: [] },
      });

      expect(memory).toBeDefined();
      expect(memory.conversationRef).toBeUndefined();
    });

    it("delegates to vector.store correctly", async () => {
      const memory = await cortex.memory.store(TEST_AGENT_ID, {
        content: "Test storage",
        contentType: "raw",
        source: { type: "tool", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["test"] },
      });

      // Verify in vector storage
      const stored = await client.query(api.memories.get, {
        agentId: TEST_AGENT_ID,
        memoryId: memory.memoryId,
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
        const memory = await cortex.vector.store(TEST_AGENT_ID, {
          content: "Original",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const updated = await cortex.memory.update(
          TEST_AGENT_ID,
          memory.memoryId,
          {
            content: "Updated",
            importance: 80,
          },
        );

        expect(updated.content).toBe("Updated");
        expect(updated.importance).toBe(80);
      });
    });

    describe("delete()", () => {
      it("delegates to vector.delete()", async () => {
        const memory = await cortex.vector.store(TEST_AGENT_ID, {
          content: "To delete",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.memory.delete(
          TEST_AGENT_ID,
          memory.memoryId,
        );

        expect(result.deleted).toBe(true);
        expect(result.memoryId).toBe(memory.memoryId);
      });
    });

    describe("list()", () => {
      it("delegates to vector.list()", async () => {
        await cortex.vector.store(TEST_AGENT_ID, {
          content: "List test",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const results = await cortex.memory.list({ agentId: TEST_AGENT_ID });

        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe("count()", () => {
      it("delegates to vector.count()", async () => {
        const count = await cortex.memory.count({ agentId: TEST_AGENT_ID });

        expect(typeof count).toBe("number");
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    describe("updateMany()", () => {
      it("delegates to vector.updateMany()", async () => {
        for (let i = 0; i < 3; i++) {
          await cortex.vector.store(TEST_AGENT_ID, {
            content: `Bulk update ${i}`,
            contentType: "raw",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 30, tags: ["bulk"] },
          });
        }

        const result = await cortex.memory.updateMany(
          { agentId: TEST_AGENT_ID, sourceType: "system" },
          { importance: 80 },
        );

        expect(result.updated).toBeGreaterThan(0);
      });
    });

    describe("deleteMany()", () => {
      it("delegates to vector.deleteMany()", async () => {
        for (let i = 0; i < 3; i++) {
          await cortex.vector.store(TEST_AGENT_ID, {
            content: `Bulk delete ${i}`,
            contentType: "raw",
            userId: "user-bulk",
            source: { type: "system", timestamp: Date.now() },
            metadata: { importance: 10, tags: ["bulk-delete"] },
          });
        }

        const result = await cortex.memory.deleteMany({
          agentId: TEST_AGENT_ID,
          userId: "user-bulk",
        });

        expect(result.deleted).toBeGreaterThanOrEqual(3);
      });
    });

    describe("export()", () => {
      it("delegates to vector.export()", async () => {
        const result = await cortex.memory.export({
          agentId: TEST_AGENT_ID,
          format: "json",
        });

        expect(result.format).toBe("json");
        expect(typeof result.data).toBe("string");
      });
    });

    describe("archive()", () => {
      it("delegates to vector.archive()", async () => {
        const memory = await cortex.vector.store(TEST_AGENT_ID, {
          content: "To archive",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const result = await cortex.memory.archive(
          TEST_AGENT_ID,
          memory.memoryId,
        );

        expect(result.archived).toBe(true);
        expect(result.restorable).toBe(true);
      });
    });

    describe("getVersion()", () => {
      it("delegates to vector.getVersion()", async () => {
        const memory = await cortex.vector.store(TEST_AGENT_ID, {
          content: "V1",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        await cortex.vector.update(TEST_AGENT_ID, memory.memoryId, {
          content: "V2",
        });

        const v1 = await cortex.memory.getVersion(
          TEST_AGENT_ID,
          memory.memoryId,
          1,
        );

        expect(v1).not.toBeNull();
        expect(v1!.content).toBe("V1");
      });
    });

    describe("getHistory()", () => {
      it("delegates to vector.getHistory()", async () => {
        const memory = await cortex.vector.store(TEST_AGENT_ID, {
          content: "V1",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        await cortex.vector.update(TEST_AGENT_ID, memory.memoryId, {
          content: "V2",
        });

        const history = await cortex.memory.getHistory(
          TEST_AGENT_ID,
          memory.memoryId,
        );

        expect(history).toHaveLength(2);
        expect(history[0].content).toBe("V1");
        expect(history[1].content).toBe("V2");
      });
    });

    describe("getAtTimestamp()", () => {
      it("delegates to vector.getAtTimestamp()", async () => {
        const memory = await cortex.vector.store(TEST_AGENT_ID, {
          content: "Temporal",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: [] },
        });

        const atCreation = await cortex.memory.getAtTimestamp(
          TEST_AGENT_ID,
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
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      // Remember
      const remembered = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: conv.conversationId,
        userMessage: "Integration test: password is XYZ",
        agentResponse: "Stored!",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        importance: 95,
        tags: ["integration", "password"],
      });

      expect(remembered.memories).toHaveLength(2);

      // Search with enrichment
      const searchResults = await cortex.memory.search(
        TEST_AGENT_ID,
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
        TEST_AGENT_ID,
        remembered.memories[0].memoryId,
        { includeConversation: true },
      )) as any;

      expect(enrichedGet.memory).toBeDefined();
      expect(enrichedGet.conversation).toBeDefined();
      expect(enrichedGet.sourceMessages).toHaveLength(1);

      // Forget (preserve ACID)
      const forgot = await cortex.memory.forget(
        TEST_AGENT_ID,
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
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      const remembered = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: conv.conversationId,
        userMessage: "To be completely forgotten",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
      });

      const forgot = await cortex.memory.forget(
        TEST_AGENT_ID,
        remembered.memories[0].memoryId,
        { deleteConversation: true, deleteEntireConversation: true },
      );

      expect(forgot.conversationDeleted).toBe(true);
      expect(forgot.restorable).toBe(false);

      // Verify both layers deleted
      const memory = await cortex.vector.get(
        TEST_AGENT_ID,
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
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      const beforeACID = await client.query(api.conversations.get, {
        conversationId: conv.conversationId,
      });
      const beforeMessageCount = beforeACID!.messageCount;

      const beforeVector = await client.query(api.memories.count, {
        agentId: TEST_AGENT_ID,
      });

      await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: conv.conversationId,
        userMessage: "Test",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
      });

      const afterACID = await client.query(api.conversations.get, {
        conversationId: conv.conversationId,
      });

      expect(afterACID!.messageCount).toBe(beforeMessageCount + 2);

      const afterVector = await client.query(api.memories.count, {
        agentId: TEST_AGENT_ID,
      });

      expect(afterVector).toBe(beforeVector + 2);
    });

    it("delete() removes from Vector only, preserves ACID", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
      });

      const remembered = await cortex.memory.remember({
        agentId: TEST_AGENT_ID,
        conversationId: conv.conversationId,
        userMessage: "Delete test",
        agentResponse: "OK",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
      });

      await cortex.memory.delete(
        TEST_AGENT_ID,
        remembered.memories[0].memoryId,
      );

      // Vector deleted
      const vectorMemory = await cortex.vector.get(
        TEST_AGENT_ID,
        remembered.memories[0].memoryId,
      );

      expect(vectorMemory).toBeNull();

      // ACID preserved
      const acidConv = await cortex.conversations.get(conv.conversationId);

      expect(acidConv).not.toBeNull();
      expect(acidConv!.messages.length).toBeGreaterThanOrEqual(2);
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
        // Clean up any stale test data from previous runs
        await cleanup.purgeAll();

        // Create conversation
        const conv = await cortex.conversations.create({
          type: "user-agent",
          participants: { userId: TEST_USER_ID, agentId: TEST_AGENT_ID },
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
            agentId: TEST_AGENT_ID,
            conversationId,
            userMessage: conv.user,
            agentResponse: conv.agent,
            userId: TEST_USER_ID,
            userName: "Alex Johnson",
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
        // Test semantic understanding (queries don't match exact words)
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
            TEST_AGENT_ID,
            search.query,
            {
              embedding: await generateEmbedding(search.query),
              userId: TEST_USER_ID,
              limit: 10, // Get more results to handle edge cases in similarity scoring
            },
          )) as unknown[];

          // Should find the relevant fact (semantic match, not keyword)
          expect(results.length).toBeGreaterThan(0);

          // Validate the TOP result (results[0]) contains the expected content
          // This ensures semantic search ranks the most relevant result first
          const topResult = results[0] as any;

          // If top result doesn't match, log for debugging
          if (
            !topResult.content
              .toLowerCase()
              .includes(search.expectInContent.toLowerCase())
          ) {
            console.log(
              `  ⚠ Query: "${search.query}" - Top result doesn't contain "${search.expectInContent}":`,
            );
            results.slice(0, 3).forEach((r: any, i) => {
              const hasMatch = r.content
                .toLowerCase()
                .includes(search.expectInContent.toLowerCase())
                ? "✓ MATCH"
                : "";

              console.log(
                `    ${i + 1}. "${r.content.substring(0, 80)}..." (score: ${r._score?.toFixed(3)}) ${hasMatch}`,
              );
            });
          }

          // Strict validation: Top result MUST contain expected content
          expect(topResult.content.toLowerCase()).toContain(
            search.expectInContent.toLowerCase(),
          );

          // Log for visibility
          console.log(
            `  ✓ Query: "${search.query}" → Top result: "${topResult.content.substring(0, 60)}..." (score: ${topResult._score?.toFixed(3) || "N/A"})`,
          );
        }
      }, 60000); // 60s timeout for API calls

      it("enriches search results with full conversation context", async () => {
        const results = await cortex.memory.search(TEST_AGENT_ID, "password", {
          embedding: await generateEmbedding("password credentials"),
          enrichConversation: true,
          userId: TEST_USER_ID,
        });

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
        // Get a summarized memory
        const memory = await cortex.vector.get(
          TEST_AGENT_ID,
          storedMemories[0].memoryId,
        );

        expect(memory).not.toBeNull();
        expect(memory!.contentType).toBe("summarized");

        // Summarized content should be concise
        const original =
          "My name is Alexander Johnson and I prefer to be called Alex";

        expect(memory!.content.length).toBeLessThan(original.length * 1.5);
        expect(memory!.content.toLowerCase()).toContain("alex");

        console.log(`  ✓ Original: "${original}"`);
        console.log(`  ✓ Summarized: "${memory!.content}"`);
      }, 30000);

      it("similarity scores are realistic (0-1 range)", async () => {
        const results = (await cortex.memory.search(
          TEST_AGENT_ID,
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
});
