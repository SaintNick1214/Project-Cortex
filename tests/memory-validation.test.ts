/**
 * E2E Tests: Memory Convenience API - Validation
 *
 * Tests client-side and cross-layer validation
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

describe("Memory Validation", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("valid");
  const TEST_USER_ID = ctx.userId("valid");
  const TEST_AGENT_ID = ctx.agentId("valid");
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
  // Cross-Layer Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Cross-Layer Validation", () => {
    it("remember() creates data in both ACID and Vector", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
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
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
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
        participants: {
          userId: TEST_USER_ID,
          agentId: PARTICIPANT,
          participantId: PARTICIPANT,
        },
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
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cross-Space Permission Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Cross-Space Permission Errors", () => {
    const SPACE_A = ctx.memorySpaceId("perm-a");
    const SPACE_B = ctx.memorySpaceId("perm-b");
    let memoryInSpaceA: string;

    beforeAll(async () => {
      // Create a memory in Space A
      const memory = await cortex.vector.store(SPACE_A, {
        content: "Memory in Space A for permission tests",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["permission-test"] },
      });
      memoryInSpaceA = memory.memoryId;
    });

    describe("get() cross-space access", () => {
      it("should return null when accessing memory from wrong space (silent permission denial)", async () => {
        // Attempting to get a memory from Space A using Space B's ID
        const result = await cortex.memory.get(SPACE_B, memoryInSpaceA);
        expect(result).toBeNull();
      });

      it("should return memory when accessed from correct space", async () => {
        const result = await cortex.memory.get(SPACE_A, memoryInSpaceA);
        expect(result).not.toBeNull();
        expect(
          (result as any).memoryId || (result as any).memory?.memoryId,
        ).toBe(memoryInSpaceA);
      });
    });

    describe("update() cross-space access", () => {
      it("should throw PERMISSION_DENIED when memorySpaceId doesn't match", async () => {
        await expect(
          cortex.memory.update(SPACE_B, memoryInSpaceA, {
            content: "Attempted update from wrong space",
          }),
        ).rejects.toThrow(/PERMISSION_DENIED|not found/i);
      });
    });

    describe("delete() cross-space access", () => {
      it("should throw PERMISSION_DENIED when memorySpaceId doesn't match", async () => {
        await expect(
          cortex.memory.delete(SPACE_B, memoryInSpaceA),
        ).rejects.toThrow(/PERMISSION_DENIED|MEMORY_NOT_FOUND|not found/i);
      });
    });

    describe("forget() cross-space access", () => {
      it("should throw error when memorySpaceId doesn't own memory", async () => {
        await expect(
          cortex.memory.forget(SPACE_B, memoryInSpaceA),
        ).rejects.toThrow(/PERMISSION_DENIED|MEMORY_NOT_FOUND|not found/i);
      });
    });

    describe("archive() cross-space access", () => {
      it("should throw PERMISSION_DENIED when memorySpaceId doesn't match", async () => {
        await expect(
          cortex.memory.archive(SPACE_B, memoryInSpaceA),
        ).rejects.toThrow(/PERMISSION_DENIED|MEMORY_NOT_FOUND|not found/i);
      });
    });

    describe("getVersion() cross-space access", () => {
      it("should return null when accessing version from wrong space", async () => {
        const result = await cortex.memory.getVersion(
          SPACE_B,
          memoryInSpaceA,
          1,
        );
        expect(result).toBeNull();
      });
    });

    describe("getHistory() cross-space access", () => {
      it("should return empty array when accessing history from wrong space", async () => {
        const result = await cortex.memory.getHistory(SPACE_B, memoryInSpaceA);
        expect(result).toEqual([]);
      });
    });

    describe("getAtTimestamp() cross-space access", () => {
      it("should return null when accessing from wrong space", async () => {
        const result = await cortex.memory.getAtTimestamp(
          SPACE_B,
          memoryInSpaceA,
          Date.now(),
        );
        expect(result).toBeNull();
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NOT_FOUND Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("NOT_FOUND Error Handling", () => {
    const NONEXISTENT_MEMORY_ID = "mem-nonexistent-12345";

    describe("update() not found", () => {
      it("should throw MEMORY_NOT_FOUND when memory does not exist", async () => {
        await expect(
          cortex.memory.update(TEST_MEMSPACE_ID, NONEXISTENT_MEMORY_ID, {
            content: "Updated content",
          }),
        ).rejects.toThrow(/MEMORY_NOT_FOUND|not found/i);
      });
    });

    describe("delete() not found", () => {
      it("should throw MEMORY_NOT_FOUND when memory does not exist", async () => {
        await expect(
          cortex.memory.delete(TEST_MEMSPACE_ID, NONEXISTENT_MEMORY_ID),
        ).rejects.toThrow(/MEMORY_NOT_FOUND|not found/i);
      });
    });

    describe("archive() not found", () => {
      it("should throw MEMORY_NOT_FOUND when memory does not exist", async () => {
        await expect(
          cortex.memory.archive(TEST_MEMSPACE_ID, NONEXISTENT_MEMORY_ID),
        ).rejects.toThrow(/MEMORY_NOT_FOUND|not found/i);
      });
    });

    describe("restoreFromArchive() not found", () => {
      it("should throw MEMORY_NOT_FOUND when memory does not exist", async () => {
        await expect(
          cortex.memory.restoreFromArchive(
            TEST_MEMSPACE_ID,
            NONEXISTENT_MEMORY_ID,
          ),
        ).rejects.toThrow(/MEMORY_NOT_FOUND|not found/i);
      });

      it("should throw MEMORY_NOT_ARCHIVED when memory is not archived", async () => {
        // Create a non-archived memory
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "Non-archived memory for restore test",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: ["restore-test"] },
        });

        await expect(
          cortex.memory.restoreFromArchive(TEST_MEMSPACE_ID, memory.memoryId),
        ).rejects.toThrow(/MEMORY_NOT_ARCHIVED|not archived/i);
      });
    });

    describe("getVersion() not found", () => {
      it("should return null when memory does not exist", async () => {
        const result = await cortex.memory.getVersion(
          TEST_MEMSPACE_ID,
          NONEXISTENT_MEMORY_ID,
          1,
        );
        expect(result).toBeNull();
      });

      it("should return null when version does not exist", async () => {
        // Create a memory with only v1
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "Single version memory",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: ["version-test"] },
        });

        // Try to get non-existent version 99
        const result = await cortex.memory.getVersion(
          TEST_MEMSPACE_ID,
          memory.memoryId,
          99,
        );
        expect(result).toBeNull();
      });
    });

    describe("getHistory() not found", () => {
      it("should return empty array when memory does not exist", async () => {
        const result = await cortex.memory.getHistory(
          TEST_MEMSPACE_ID,
          NONEXISTENT_MEMORY_ID,
        );
        expect(result).toEqual([]);
      });
    });

    describe("getAtTimestamp() not found", () => {
      it("should return null when memory does not exist", async () => {
        const result = await cortex.memory.getAtTimestamp(
          TEST_MEMSPACE_ID,
          NONEXISTENT_MEMORY_ID,
          Date.now(),
        );
        expect(result).toBeNull();
      });

      it("should return null when timestamp is before memory creation", async () => {
        // Create memory now
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "Temporal test memory",
          contentType: "raw",
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 50, tags: ["temporal-test"] },
        });

        // Query for timestamp way before creation (1 year ago)
        const pastTimestamp = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const result = await cortex.memory.getAtTimestamp(
          TEST_MEMSPACE_ID,
          memory.memoryId,
          pastTimestamp,
        );
        expect(result).toBeNull();
      });
    });
  });
});
