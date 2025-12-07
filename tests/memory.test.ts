/**
 * E2E Tests: Memory Convenience API (Layer 3)
 *
 * Tests dual-layer orchestration (ACID + Vector) and enrichment capabilities
 *
 * NOTE: This file has been split for parallel execution. Related tests are in:
 * - memory-core.test.ts: remember(), forget()
 * - memory-enrichment.test.ts: get(), search() with enrichment
 * - memory-openai.test.ts: Advanced OpenAI embedding tests
 * - memory-validation.test.ts: Cross-layer and client-side validation
 * - memory-archive.test.ts: Archive and restore operations
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

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
  // store() with smart detection
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("store() with smart detection", () => {
    let _testConversationId: string;

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
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
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
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
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
});
