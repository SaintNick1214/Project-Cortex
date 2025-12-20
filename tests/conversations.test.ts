/**
 * Cortex SDK - Conversations API E2E Tests
 *
 * Tests the complete Layer 1a implementation:
 * - SDK API calls
 * - Convex mutations/queries
 * - Storage validation
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api } from "../convex-dev/_generated/api";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";

describe("Conversations API (Layer 1a)", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("conversations");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  beforeAll(async () => {
    console.log(`\n🧪 Conversations API Tests - Run ID: ${ctx.runId}\n`);

    // Initialize SDK
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    // Direct client for storage validation
    client = new ConvexClient(CONVEX_URL);
    // Scoped cleanup (only cleans data from this test run)
    scopedCleanup = new ScopedCleanup(client, ctx);

    // Note: No global purge - test data is isolated by prefix
    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    cortex.close();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  describe("create()", () => {
    it("creates a user-agent conversation", async () => {
      // Use test-scoped IDs
      const createSpace = ctx.memorySpaceId("create-1");
      const createUser = ctx.userId("create-123");
      const createAgent = ctx.agentId("create-456");

      const result = await cortex.conversations.create({
        memorySpaceId: createSpace,
        participantId: createAgent,
        type: "user-agent",
        participants: {
          userId: createUser,
          agentId: createAgent,
          participantId: createAgent,
        },
        metadata: {
          source: "test",
        },
      });

      // Validate SDK response
      expect(result.conversationId).toMatch(/^conv-/);
      expect(result.type).toBe("user-agent");
      expect(result.participants.userId).toBe(createUser);
      expect(result.participants.participantId).toBe(createAgent);
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
      expect(stored!.participants.userId).toBe(createUser);
      expect(stored!.participants.participantId).toBe(createAgent);
      expect(stored!.messages).toEqual([]);
      expect(stored!.messageCount).toBe(0);
    });

    it("creates an agent-agent conversation", async () => {
      // Use test-scoped IDs
      const collabSpace = ctx.memorySpaceId("collab-create");
      const agent1 = ctx.agentId("collab-1");
      const agent2 = ctx.agentId("collab-2");
      const agent3 = ctx.agentId("collab-3");

      const result = await cortex.conversations.create({
        memorySpaceId: collabSpace,
        type: "agent-agent",
        participants: {
          memorySpaceIds: [agent1, agent2, agent3],
        },
      });

      // Validate SDK response
      expect(result.type).toBe("agent-agent");
      expect(result.participants.memorySpaceIds).toEqual([
        agent1,
        agent2,
        agent3,
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
      // Use test-scoped IDs
      const customId = ctx.conversationId("custom-123");
      const customSpace = ctx.memorySpaceId("custom");
      const customUser = ctx.userId("custom-1");
      const customAgent = ctx.agentId("custom-1");

      const result = await cortex.conversations.create({
        conversationId: customId,
        memorySpaceId: customSpace,
        type: "user-agent",
        participants: {
          userId: customUser,
          agentId: customAgent,
          participantId: customAgent,
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
      const conversationId = ctx.conversationId("duplicate-test");
      const dupSpace = ctx.memorySpaceId("dup");
      const dupUser1 = ctx.userId("dup-1");
      const dupUser2 = ctx.userId("dup-2");
      const dupAgent1 = ctx.agentId("dup-1");
      const dupAgent2 = ctx.agentId("dup-2");

      await cortex.conversations.create({
        conversationId,
        memorySpaceId: dupSpace,
        type: "user-agent",
        participants: {
          userId: dupUser1,
          agentId: dupAgent1,
          participantId: dupAgent1,
        },
      });

      // Attempt to create duplicate
      await expect(
        cortex.conversations.create({
          conversationId,
          memorySpaceId: dupSpace,
          type: "user-agent",
          participants: {
            userId: dupUser2,
            agentId: dupAgent2,
            participantId: dupAgent2,
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
          memorySpaceId: ctx.memorySpaceId("error-agent"),
          type: "agent-agent",
          participants: {
            memorySpaceIds: [ctx.agentId("single")], // Only one space
          },
        }),
      ).rejects.toThrow(
        "agent-agent conversations require at least 2 memorySpaceIds",
      );
    });
  });

  describe("get()", () => {
    it("retrieves an existing conversation", async () => {
      // Use test-scoped IDs
      const getSpace = ctx.memorySpaceId("get-test");
      const getUser = ctx.userId("get-test");
      const getAgent = ctx.agentId("get-test");

      // Create conversation
      const created = await cortex.conversations.create({
        memorySpaceId: getSpace,
        type: "user-agent",
        participants: {
          userId: getUser,
          agentId: getAgent,
          participantId: getAgent,
        },
      });

      // Retrieve it
      const retrieved = await cortex.conversations.get(created.conversationId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.conversationId).toBe(created.conversationId);
      expect(retrieved!.type).toBe("user-agent");
      expect(retrieved!.participants).toEqual({
        userId: getUser,
        agentId: getAgent,
        participantId: getAgent,
      });
    });

    it("returns null for non-existent conversation", async () => {
      const result = await cortex.conversations.get(`nonexistent-${ctx.runId}`);

      expect(result).toBeNull();
    });
  });

  describe("addMessage()", () => {
    it("adds a message to a conversation", async () => {
      // Use test-scoped IDs
      const msgSpace = ctx.memorySpaceId("msg-test");
      const msgUser = ctx.userId("msg-test");
      const msgAgent = ctx.agentId("msg-test");

      // Create conversation
      const conversation = await cortex.conversations.create({
        memorySpaceId: msgSpace,
        type: "user-agent",
        participants: {
          userId: msgUser,
          agentId: msgAgent,
          participantId: msgAgent,
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
      // Use test-scoped IDs
      const appendSpace = ctx.memorySpaceId("append-test");
      const appendUser = ctx.userId("append-test");
      const appendAgent = ctx.agentId("append-test");

      // Create conversation
      const conversation = await cortex.conversations.create({
        memorySpaceId: appendSpace,
        type: "user-agent",
        participants: {
          userId: appendUser,
          agentId: appendAgent,
          participantId: appendAgent,
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
          participantId: appendAgent,
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
      // Use test-scoped IDs
      const deleteSpace = ctx.memorySpaceId("delete-msg");
      const deleteUser = ctx.userId("delete-msg-1");
      const deleteAgent = ctx.agentId("delete-msg-1");

      const conversation = await cortex.conversations.create({
        memorySpaceId: deleteSpace,
        type: "user-agent",
        participants: {
          userId: deleteUser,
          agentId: deleteAgent,
          participantId: deleteAgent,
        },
      });

      const customMessageId = `msg-custom-${ctx.runId}`;

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
    // Use test-scoped IDs to avoid parallel conflicts
    const listSpace1 = ctx.memorySpaceId("list-space-1");
    const listSpace2 = ctx.memorySpaceId("list-space-2");
    const listUser = ctx.userId("list-test");
    const listAgent1 = ctx.agentId("list-1");
    const listAgent2 = ctx.agentId("list-2");
    const convList1 = ctx.conversationId("list-1");
    const convList2 = ctx.conversationId("list-2");
    const convList3 = ctx.conversationId("list-3");

    beforeAll(async () => {
      // Create test data
      await cortex.conversations.create({
        conversationId: convList1,
        memorySpaceId: listSpace1,
        type: "user-agent",
        participants: {
          userId: listUser,
          agentId: listAgent1,
          participantId: listAgent1,
        },
      });

      await cortex.conversations.create({
        conversationId: convList2,
        memorySpaceId: listSpace1,
        type: "user-agent",
        participants: {
          userId: listUser,
          agentId: listAgent2,
          participantId: listAgent2,
        },
      });

      await cortex.conversations.create({
        conversationId: convList3,
        memorySpaceId: listSpace2,
        type: "agent-agent",
        participants: {
          memorySpaceIds: [listAgent1, listAgent2],
        },
      });
    });

    it("lists all conversations (no filter)", async () => {
      const result = await cortex.conversations.list();

      expect(result.conversations.length).toBeGreaterThan(0);
    });

    it("filters by userId", async () => {
      const result = await cortex.conversations.list({
        userId: listUser,
      });

      expect(result.conversations.length).toBeGreaterThanOrEqual(2);
      result.conversations.forEach((conv) => {
        expect(conv.participants.userId).toBe(listUser);
      });
    });

    it("filters by memorySpaceId", async () => {
      const result = await cortex.conversations.list({
        memorySpaceId: listSpace1,
      });

      // Should find both user-agent conversations
      expect(result.conversations.length).toBe(2);
      result.conversations.forEach((conv) => {
        expect(conv.memorySpaceId).toBe(listSpace1);
      });
    });

    it("filters by type", async () => {
      const result = await cortex.conversations.list({
        type: "user-agent",
      });

      expect(result.conversations.length).toBeGreaterThan(0);
      result.conversations.forEach((conv) => {
        expect(conv.type).toBe("user-agent");
      });
    });

    it("combines filters (userId + memorySpaceId)", async () => {
      const result = await cortex.conversations.list({
        userId: listUser,
        memorySpaceId: listSpace1,
      });

      expect(result.conversations.length).toBeGreaterThanOrEqual(1);
      result.conversations.forEach((conv) => {
        expect(conv.participants.userId).toBe(listUser);
        expect(conv.memorySpaceId).toBe(listSpace1);
      });
    });

    it("respects limit parameter", async () => {
      const result = await cortex.conversations.list({
        limit: 2,
      });

      expect(result.conversations.length).toBeLessThanOrEqual(2);
    });

    describe("sortBy options", () => {
      const sortBySpace = ctx.memorySpaceId("sort-by-test");
      const sortByUser = ctx.userId("sort-by-test");
      const sortByAgent = ctx.agentId("sort-by-test");
      let convOldest: string;
      let convMiddle: string;
      let convNewest: string;

      beforeAll(async () => {
        // Create conversations with different timestamps and message counts
        const convOldestResult = await cortex.conversations.create({
          conversationId: ctx.conversationId("sort-oldest"),
          memorySpaceId: sortBySpace,
          type: "user-agent",
          participants: {
            userId: sortByUser,
            agentId: sortByAgent,
            participantId: sortByAgent,
          },
        });
        convOldest = convOldestResult.conversationId;

        // Add several messages to make it have most messages
        for (let i = 0; i < 5; i++) {
          await cortex.conversations.addMessage({
            conversationId: convOldest,
            message: { role: "user", content: `Oldest conv message ${i}` },
          });
        }

        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 100));

        const convMiddleResult = await cortex.conversations.create({
          conversationId: ctx.conversationId("sort-middle"),
          memorySpaceId: sortBySpace,
          type: "user-agent",
          participants: {
            userId: sortByUser,
            agentId: sortByAgent,
            participantId: sortByAgent,
          },
        });
        convMiddle = convMiddleResult.conversationId;

        // Add 2 messages
        await cortex.conversations.addMessage({
          conversationId: convMiddle,
          message: { role: "user", content: "Middle conv message 1" },
        });
        await cortex.conversations.addMessage({
          conversationId: convMiddle,
          message: { role: "agent", content: "Middle conv message 2" },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const convNewestResult = await cortex.conversations.create({
          conversationId: ctx.conversationId("sort-newest"),
          memorySpaceId: sortBySpace,
          type: "user-agent",
          participants: {
            userId: sortByUser,
            agentId: sortByAgent,
            participantId: sortByAgent,
          },
        });
        convNewest = convNewestResult.conversationId;

        // Add 1 message (fewest)
        await cortex.conversations.addMessage({
          conversationId: convNewest,
          message: { role: "user", content: "Newest conv message" },
        });
      });

      it("sorts by createdAt (default, descending)", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: sortBySpace,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        expect(result.conversations.length).toBe(3);
        // Newest should be first
        expect(result.conversations[0].conversationId).toBe(convNewest);
        // Oldest should be last
        expect(result.conversations[2].conversationId).toBe(convOldest);
      });

      it("sorts by createdAt ascending", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: sortBySpace,
          sortBy: "createdAt",
          sortOrder: "asc",
        });

        expect(result.conversations.length).toBe(3);
        // Oldest should be first
        expect(result.conversations[0].conversationId).toBe(convOldest);
        // Newest should be last
        expect(result.conversations[2].conversationId).toBe(convNewest);
      });

      it("sorts by updatedAt descending", async () => {
        // Update the oldest conversation to make it most recently updated
        await cortex.conversations.addMessage({
          conversationId: convOldest,
          message: { role: "user", content: "Updated message" },
        });

        const result = await cortex.conversations.list({
          memorySpaceId: sortBySpace,
          sortBy: "updatedAt",
          sortOrder: "desc",
        });

        expect(result.conversations.length).toBe(3);
        // Most recently updated should be first (convOldest just got a message)
        expect(result.conversations[0].conversationId).toBe(convOldest);
      });

      it("sorts by lastMessageAt descending", async () => {
        // Add a new message to convMiddle to make it most recent lastMessageAt
        await cortex.conversations.addMessage({
          conversationId: convMiddle,
          message: { role: "agent", content: "Latest message" },
        });

        const result = await cortex.conversations.list({
          memorySpaceId: sortBySpace,
          sortBy: "lastMessageAt",
          sortOrder: "desc",
        });

        expect(result.conversations.length).toBe(3);
        // Most recently messaged should be first
        expect(result.conversations[0].conversationId).toBe(convMiddle);
      });

      it("sorts by messageCount descending", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: sortBySpace,
          sortBy: "messageCount",
          sortOrder: "desc",
        });

        expect(result.conversations.length).toBe(3);
        // Conversation with most messages should be first (convOldest has 6)
        expect(result.conversations[0].messageCount).toBeGreaterThan(
          result.conversations[1].messageCount,
        );
        expect(result.conversations[1].messageCount).toBeGreaterThan(
          result.conversations[2].messageCount,
        );
      });

      it("sorts by messageCount ascending", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: sortBySpace,
          sortBy: "messageCount",
          sortOrder: "asc",
        });

        expect(result.conversations.length).toBe(3);
        // Conversation with fewest messages should be first (convNewest has 1)
        expect(result.conversations[0].messageCount).toBeLessThan(
          result.conversations[1].messageCount,
        );
        expect(result.conversations[1].messageCount).toBeLessThan(
          result.conversations[2].messageCount,
        );
      });
    });

    describe("messageCount filter", () => {
      const msgCountSpace = ctx.memorySpaceId("msg-count-filter");
      const msgCountUser = ctx.userId("msg-count-filter");
      const msgCountAgent = ctx.agentId("msg-count-filter");

      beforeAll(async () => {
        // Create conversations with varying message counts
        // Conv with 2 messages
        const conv2 = await cortex.conversations.create({
          conversationId: ctx.conversationId("msg-count-2"),
          memorySpaceId: msgCountSpace,
          type: "user-agent",
          participants: {
            userId: msgCountUser,
            agentId: msgCountAgent,
            participantId: msgCountAgent,
          },
        });
        for (let i = 0; i < 2; i++) {
          await cortex.conversations.addMessage({
            conversationId: conv2.conversationId,
            message: { role: "user", content: `Message ${i}` },
          });
        }

        // Conv with 5 messages
        const conv5 = await cortex.conversations.create({
          conversationId: ctx.conversationId("msg-count-5"),
          memorySpaceId: msgCountSpace,
          type: "user-agent",
          participants: {
            userId: msgCountUser,
            agentId: msgCountAgent,
            participantId: msgCountAgent,
          },
        });
        for (let i = 0; i < 5; i++) {
          await cortex.conversations.addMessage({
            conversationId: conv5.conversationId,
            message: { role: "user", content: `Message ${i}` },
          });
        }

        // Conv with 10 messages
        const conv10 = await cortex.conversations.create({
          conversationId: ctx.conversationId("msg-count-10"),
          memorySpaceId: msgCountSpace,
          type: "user-agent",
          participants: {
            userId: msgCountUser,
            agentId: msgCountAgent,
            participantId: msgCountAgent,
          },
        });
        for (let i = 0; i < 10; i++) {
          await cortex.conversations.addMessage({
            conversationId: conv10.conversationId,
            message: { role: "user", content: `Message ${i}` },
          });
        }
      });

      it("filters by exact messageCount", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: msgCountSpace,
          messageCount: 5,
        });

        expect(result.conversations.length).toBe(1);
        expect(result.conversations[0].messageCount).toBe(5);
      });

      it("filters by messageCount range (min only)", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: msgCountSpace,
          messageCount: { min: 5 },
        });

        expect(result.conversations.length).toBe(2);
        result.conversations.forEach((conv) => {
          expect(conv.messageCount).toBeGreaterThanOrEqual(5);
        });
      });

      it("filters by messageCount range (max only)", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: msgCountSpace,
          messageCount: { max: 5 },
        });

        expect(result.conversations.length).toBe(2);
        result.conversations.forEach((conv) => {
          expect(conv.messageCount).toBeLessThanOrEqual(5);
        });
      });

      it("filters by messageCount range (min and max)", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: msgCountSpace,
          messageCount: { min: 3, max: 8 },
        });

        expect(result.conversations.length).toBe(1);
        expect(result.conversations[0].messageCount).toBe(5);
      });
    });

    describe("participantId filter", () => {
      const participantSpace = ctx.memorySpaceId("participant-filter");
      const participantUser = ctx.userId("participant-filter");
      const participantBot1 = ctx.agentId("bot1-filter");
      const participantBot2 = ctx.agentId("bot2-filter");

      beforeAll(async () => {
        // Create conversation with bot1 as top-level participantId (Hive Mode tracking)
        await cortex.conversations.create({
          conversationId: ctx.conversationId("participant-bot1"),
          memorySpaceId: participantSpace,
          participantId: participantBot1, // Top-level participantId for Hive Mode
          type: "user-agent",
          participants: {
            userId: participantUser,
            agentId: participantBot1,
            participantId: participantBot1,
          },
        });

        // Create conversation with bot2 as top-level participantId
        await cortex.conversations.create({
          conversationId: ctx.conversationId("participant-bot2"),
          memorySpaceId: participantSpace,
          participantId: participantBot2, // Top-level participantId for Hive Mode
          type: "user-agent",
          participants: {
            userId: participantUser,
            agentId: participantBot2,
            participantId: participantBot2,
          },
        });
      });

      it("filters by participantId", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: participantSpace,
          participantId: participantBot1,
        });

        expect(result.conversations.length).toBe(1);
        expect(result.conversations[0].participants.agentId).toBe(
          participantBot1,
        );
      });

      it("returns empty when participantId not found", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: participantSpace,
          participantId: ctx.agentId("nonexistent-bot"),
        });

        expect(result.conversations.length).toBe(0);
      });
    });

    describe("date filters", () => {
      const dateSpace = ctx.memorySpaceId("date-filter");
      const dateUser = ctx.userId("date-filter");
      const dateAgent = ctx.agentId("date-filter");
      let beforeMiddleTimestamp: number;
      let afterMiddleTimestamp: number;

      beforeAll(async () => {
        // Create first conversation
        await cortex.conversations.create({
          conversationId: ctx.conversationId("date-early"),
          memorySpaceId: dateSpace,
          type: "user-agent",
          participants: {
            userId: dateUser,
            agentId: dateAgent,
            participantId: dateAgent,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        beforeMiddleTimestamp = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Create middle conversation
        await cortex.conversations.create({
          conversationId: ctx.conversationId("date-middle"),
          memorySpaceId: dateSpace,
          type: "user-agent",
          participants: {
            userId: dateUser,
            agentId: dateAgent,
            participantId: dateAgent,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        afterMiddleTimestamp = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Create late conversation
        await cortex.conversations.create({
          conversationId: ctx.conversationId("date-late"),
          memorySpaceId: dateSpace,
          type: "user-agent",
          participants: {
            userId: dateUser,
            agentId: dateAgent,
            participantId: dateAgent,
          },
        });
      });

      it("filters by createdAfter", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: dateSpace,
          createdAfter: beforeMiddleTimestamp,
        });

        // Should include middle and late (2 conversations)
        expect(result.conversations.length).toBe(2);
        result.conversations.forEach((conv) => {
          expect(conv.createdAt).toBeGreaterThan(beforeMiddleTimestamp);
        });
      });

      it("filters by createdBefore", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: dateSpace,
          createdBefore: afterMiddleTimestamp,
        });

        // Should include early and middle (2 conversations)
        expect(result.conversations.length).toBe(2);
        result.conversations.forEach((conv) => {
          expect(conv.createdAt).toBeLessThan(afterMiddleTimestamp);
        });
      });

      it("filters by combined createdAfter + createdBefore", async () => {
        const result = await cortex.conversations.list({
          memorySpaceId: dateSpace,
          createdAfter: beforeMiddleTimestamp,
          createdBefore: afterMiddleTimestamp,
        });

        // Should include only middle (1 conversation)
        expect(result.conversations.length).toBe(1);
        expect(result.conversations[0].createdAt).toBeGreaterThan(
          beforeMiddleTimestamp,
        );
        expect(result.conversations[0].createdAt).toBeLessThan(
          afterMiddleTimestamp,
        );
      });

      it("filters by updatedAfter + updatedBefore", async () => {
        // First update the middle conversation to set its updatedAt
        await cortex.conversations.addMessage({
          conversationId: ctx.conversationId("date-middle"),
          message: { role: "user", content: "Update message" },
        });

        const afterUpdate = Date.now();

        const result = await cortex.conversations.list({
          memorySpaceId: dateSpace,
          updatedAfter: beforeMiddleTimestamp,
          updatedBefore: afterUpdate,
        });

        // Should include all conversations updated in this window
        expect(result.conversations.length).toBeGreaterThanOrEqual(1);
        result.conversations.forEach((conv) => {
          expect(conv.updatedAt).toBeGreaterThan(beforeMiddleTimestamp);
          expect(conv.updatedAt).toBeLessThanOrEqual(afterUpdate);
        });
      });
    });
  });

  describe("count()", () => {
    // Re-use scoped IDs from list() test setup (which runs in beforeAll)
    const countUser = ctx.userId("list-test");
    const countSpace = ctx.memorySpaceId("list-space-1");

    it("counts all conversations", async () => {
      const count = await cortex.conversations.count();

      expect(count).toBeGreaterThan(0);
    });

    it("counts by userId", async () => {
      const count = await cortex.conversations.count({
        userId: countUser,
      });

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("counts by memorySpaceId", async () => {
      const count = await cortex.conversations.count({
        memorySpaceId: countSpace,
      });

      expect(count).toBeGreaterThanOrEqual(2);
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
      // Use test-scoped IDs
      const delSpace = ctx.memorySpaceId("delete-conv");
      const delUser = ctx.userId("delete-test");
      const delAgent = ctx.agentId("delete-test");

      // Create conversation
      const conversation = await cortex.conversations.create({
        memorySpaceId: delSpace,
        type: "user-agent",
        participants: {
          userId: delUser,
          agentId: delAgent,
          participantId: delAgent,
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
        cortex.conversations.delete(`nonexistent-${ctx.runId}`),
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("Storage Validation", () => {
    it("validates complete ACID properties", async () => {
      // Use test-scoped IDs
      const acidSpace = ctx.memorySpaceId("acid-test");
      const acidUser = ctx.userId("acid-test");
      const acidAgent = ctx.agentId("acid-test");

      const conversation = await cortex.conversations.create({
        memorySpaceId: acidSpace,
        type: "user-agent",
        participants: {
          userId: acidUser,
          agentId: acidAgent,
          participantId: acidAgent,
        },
      });

      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        await cortex.conversations.addMessage({
          conversationId: conversation.conversationId,
          message: {
            role: i % 2 === 0 ? "user" : "agent",
            content: `Message ${i + 1}`,
            participantId: i % 2 === 0 ? undefined : acidAgent,
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
      // Use the list-test user/space from the list() describe block
      const indexUser = ctx.userId("list-test");
      const indexSpace = ctx.memorySpaceId("list-space-1");

      const startTime = Date.now();

      await cortex.conversations.list({
        userId: indexUser,
        memorySpaceId: indexSpace,
      });

      const duration = Date.now() - startTime;

      // Should be fast with proper indexing
      expect(duration).toBeLessThan(1000); // < 1 second
    });
  });

  describe("getHistory()", () => {
    let testConversationId: string;

    // Use test-scoped IDs
    const historySpace = ctx.memorySpaceId("history");
    const historyUser = ctx.userId("history-test");
    const historyAgent = ctx.agentId("history-test");

    beforeAll(async () => {
      // Create conversation with multiple messages
      const conversation = await cortex.conversations.create({
        memorySpaceId: historySpace,
        type: "user-agent",
        participants: {
          userId: historyUser,
          agentId: historyAgent,
          participantId: historyAgent,
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
        cortex.conversations.getHistory(`nonexistent-${ctx.runId}`),
      ).rejects.toThrow("CONVERSATION_NOT_FOUND");
    });
  });

  describe("search()", () => {
    // Use test-scoped IDs
    const searchSpace1 = ctx.memorySpaceId("search-space");
    const searchSpace2 = ctx.memorySpaceId("search-space-other");
    const searchUser1 = ctx.userId("search-test");
    const searchUser2 = ctx.userId("search-other");
    const searchAgent = ctx.agentId("search-test");
    const convSearch1 = ctx.conversationId("search-1");
    const convSearch2 = ctx.conversationId("search-2");
    const convSearch3 = ctx.conversationId("search-3");
    // Use unique search term scoped to this run
    const searchKeyword = `secretword-${ctx.runId}`;

    beforeAll(async () => {
      // Create test conversations with searchable content
      const conv1 = await cortex.conversations.create({
        conversationId: convSearch1,
        memorySpaceId: searchSpace1,
        type: "user-agent",
        participants: {
          userId: searchUser1,
          agentId: searchAgent,
          participantId: searchAgent,
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv1.conversationId,
        message: {
          role: "user",
          content: `What is the ${searchKeyword} for the system?`,
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv1.conversationId,
        message: {
          role: "agent",
          content: `The ${searchKeyword} is Blue123!`,
        },
      });

      const conv2 = await cortex.conversations.create({
        conversationId: convSearch2,
        memorySpaceId: searchSpace1,
        type: "user-agent",
        participants: {
          userId: searchUser1,
          agentId: searchAgent,
          participantId: searchAgent,
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
          content: `The weather is sunny with no ${searchKeyword} required!`,
        },
      });

      const conv3 = await cortex.conversations.create({
        conversationId: convSearch3,
        memorySpaceId: searchSpace2,
        type: "user-agent",
        participants: {
          userId: searchUser2,
          agentId: searchAgent,
          participantId: searchAgent,
        },
      });

      await cortex.conversations.addMessage({
        conversationId: conv3.conversationId,
        message: {
          role: "user",
          content: `This conversation has no ${searchKeyword} mentions at all.`,
        },
      });
    });

    it("finds conversations containing search query", async () => {
      const results = await cortex.conversations.search({
        query: searchKeyword,
      });

      expect(results.length).toBeGreaterThanOrEqual(2);

      // All results should contain the search keyword
      results.forEach((result) => {
        const hasMatch = result.matchedMessages.some((msg) =>
          msg.content.toLowerCase().includes(searchKeyword.toLowerCase()),
        );

        expect(hasMatch).toBe(true);
      });
    });

    it("filters by userId", async () => {
      const results = await cortex.conversations.search({
        query: searchKeyword,
        filters: {
          userId: searchUser1,
        },
      });

      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(result.conversation.participants.userId).toBe(searchUser1);
      });
    });

    it("includes highlights from matched messages", async () => {
      const results = await cortex.conversations.search({
        query: searchKeyword,
        filters: { limit: 1 },
      });

      expect(results[0].highlights.length).toBeGreaterThan(0);
      results[0].highlights.forEach((highlight) => {
        expect(highlight.toLowerCase()).toContain(searchKeyword.toLowerCase());
      });
    });

    it("calculates relevance scores", async () => {
      const results = await cortex.conversations.search({
        query: searchKeyword,
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
        query: `nonexistent-query-${ctx.runId}-xyz`,
      });

      expect(results).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const results = await cortex.conversations.search({
        query: searchKeyword,
        filters: { limit: 1 },
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("export()", () => {
    // Use test-scoped IDs
    const exportSpace1 = ctx.memorySpaceId("export-space");
    const exportSpace2 = ctx.memorySpaceId("export-collab");
    const exportUser = ctx.userId("export-test");
    const exportAgent = ctx.agentId("export-test");
    const convExport1 = ctx.conversationId("export-1");
    const convExport2 = ctx.conversationId("export-2");
    const campaignTag = `summer-${ctx.runId}`;

    beforeAll(async () => {
      // Create test conversations for export
      await cortex.conversations.create({
        conversationId: convExport1,
        memorySpaceId: exportSpace1,
        type: "user-agent",
        participants: {
          userId: exportUser,
          agentId: exportAgent,
          participantId: exportAgent,
        },
        metadata: { campaign: campaignTag },
      });

      await cortex.conversations.create({
        conversationId: convExport2,
        memorySpaceId: exportSpace2,
        type: "agent-agent",
        participants: {
          memorySpaceIds: [exportAgent, ctx.agentId("export-other")],
        },
        metadata: { priority: "high" },
      });
    });

    it("exports to JSON format", async () => {
      const exported = await cortex.conversations.export({
        filters: { userId: exportUser },
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
        filters: { userId: exportUser },
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
        filters: { conversationIds: [convExport1] },
        format: "json",
        includeMetadata: true,
      });

      const parsed = JSON.parse(withMetadata.data);

      expect(parsed[0].metadata).toBeDefined();
      expect(parsed[0].metadata.campaign).toBe(campaignTag);
    });

    it("excludes metadata when not requested", async () => {
      const withoutMetadata = await cortex.conversations.export({
        filters: { conversationIds: [convExport1] },
        format: "json",
        includeMetadata: false,
      });

      const parsed = JSON.parse(withoutMetadata.data);

      expect(parsed[0].metadata).toBeUndefined();
    });

    it("filters by conversation IDs", async () => {
      const exported = await cortex.conversations.export({
        filters: {
          conversationIds: [convExport1, convExport2],
        },
        format: "json",
      });

      expect(exported.count).toBe(2);
      const parsed = JSON.parse(exported.data);
      const ids = parsed.map((c: any) => c.conversationId);

      expect(ids).toContain(convExport1);
      expect(ids).toContain(convExport2);
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

    it("handles large dataset export (100+ conversations)", async () => {
      // Use test-scoped IDs for isolation
      const largeExportSpace = ctx.memorySpaceId("large-export");
      const largeExportUser = ctx.userId("large-export");
      const largeExportAgent = ctx.agentId("large-export");
      const TOTAL_CONVERSATIONS = 105;

      // Create 105 conversations in batches
      const createPromises = [];
      for (let i = 1; i <= TOTAL_CONVERSATIONS; i++) {
        createPromises.push(
          cortex.conversations.create({
            conversationId: ctx.conversationId(`large-export-${i}`),
            memorySpaceId: largeExportSpace,
            type: "user-agent",
            participants: {
              userId: largeExportUser,
              agentId: largeExportAgent,
              participantId: largeExportAgent,
            },
            metadata: { batch: Math.floor(i / 25), index: i },
          }),
        );

        // Process in batches of 25 to avoid overwhelming the backend
        if (i % 25 === 0) {
          await Promise.all(createPromises);
          createPromises.length = 0;
        }
      }
      // Process remaining
      if (createPromises.length > 0) {
        await Promise.all(createPromises);
      }

      // Export to JSON
      const jsonExport = await cortex.conversations.export({
        filters: { memorySpaceId: largeExportSpace },
        format: "json",
        includeMetadata: true,
      });

      expect(jsonExport.count).toBe(TOTAL_CONVERSATIONS);
      expect(jsonExport.format).toBe("json");

      // Validate JSON is parseable and complete
      const parsed = JSON.parse(jsonExport.data);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(TOTAL_CONVERSATIONS);

      // Verify all conversations are present
      const exportedIds = new Set(parsed.map((c: any) => c.conversationId));
      for (let i = 1; i <= TOTAL_CONVERSATIONS; i++) {
        expect(exportedIds.has(ctx.conversationId(`large-export-${i}`))).toBe(
          true,
        );
      }

      // Export to CSV
      const csvExport = await cortex.conversations.export({
        filters: { memorySpaceId: largeExportSpace },
        format: "csv",
        includeMetadata: false,
      });

      expect(csvExport.count).toBe(TOTAL_CONVERSATIONS);
      expect(csvExport.format).toBe("csv");

      // Validate CSV structure
      const lines = csvExport.data.split("\n");
      // Header + 105 data rows
      expect(lines.length).toBe(TOTAL_CONVERSATIONS + 1);

      // Verify CSV header has expected columns
      const header = lines[0];
      expect(header).toContain("conversationId");
      expect(header).toContain("type");

      // Clean up all created conversations (with high threshold to allow bulk delete)
      const deleteResult = await cortex.conversations.deleteMany(
        { memorySpaceId: largeExportSpace },
        { confirmationThreshold: 150 },
      );
      expect(deleteResult.deleted).toBe(TOTAL_CONVERSATIONS);
    }, 120000); // Extended timeout for large dataset operations
  });

  describe("State Change Propagation", () => {
    // Use test-scoped IDs
    const propSpace = ctx.memorySpaceId("propagation");
    const propUser = ctx.userId("propagation-test");
    const propAgent = ctx.agentId("propagation-test");
    const propKeyword = `PROPAGATE-${ctx.runId}`;

    it("message additions propagate to all read operations", async () => {
      // Create conversation
      const conv = await cortex.conversations.create({
        memorySpaceId: propSpace,
        type: "user-agent",
        participants: {
          userId: propUser,
          agentId: propAgent,
          participantId: propAgent,
        },
      });

      // Verify initial state in all operations
      let retrieved = await cortex.conversations.get(conv.conversationId);

      expect(retrieved!.messageCount).toBe(0);

      let listResult = await cortex.conversations.list({
        userId: propUser,
      });

      expect(listResult.conversations[0].messageCount).toBe(0);

      // Add message
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: `Test message with keyword ${propKeyword}`,
        },
      });

      // Verify change in get()
      retrieved = await cortex.conversations.get(conv.conversationId);
      expect(retrieved!.messageCount).toBe(1);
      expect(retrieved!.messages[0].content).toContain(propKeyword);

      // Verify change in list()
      listResult = await cortex.conversations.list({
        userId: propUser,
      });
      expect(listResult.conversations[0].messageCount).toBe(1);

      // Verify in search()
      const searchResults = await cortex.conversations.search({
        query: propKeyword,
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

      const finalListResult = await cortex.conversations.list({
        userId: propUser,
      });

      expect(finalListResult.conversations[0].messageCount).toBe(5);
    });

    it("deletion propagates to all read operations", async () => {
      // Use test-scoped IDs
      const deleteSpace = ctx.memorySpaceId("delete-prop");
      const deleteUser = ctx.userId("delete-test");
      const deleteAgent = ctx.agentId("delete-test");
      const deleteConvId = ctx.conversationId("deletion-prop");

      // Create conversation
      const conv = await cortex.conversations.create({
        conversationId: deleteConvId,
        memorySpaceId: deleteSpace,
        type: "user-agent",
        participants: {
          userId: deleteUser,
          agentId: deleteAgent,
          participantId: deleteAgent,
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

      let listResult = await cortex.conversations.list({
        userId: deleteUser,
      });

      expect(
        listResult.conversations.some(
          (c) => c.conversationId === conv.conversationId,
        ),
      ).toBe(true);

      const count = await cortex.conversations.count({
        userId: deleteUser,
      });

      expect(count).toBeGreaterThanOrEqual(1);

      // Delete conversation
      await cortex.conversations.delete(conv.conversationId);

      // Verify deleted in all operations
      get = await cortex.conversations.get(conv.conversationId);
      expect(get).toBeNull();

      listResult = await cortex.conversations.list({ userId: deleteUser });
      expect(
        listResult.conversations.some(
          (c) => c.conversationId === conv.conversationId,
        ),
      ).toBe(false);

      const countAfter = await cortex.conversations.count({
        userId: deleteUser,
      });

      expect(countAfter).toBe(count - 1);
    });
  });

  describe("Edge Cases", () => {
    it("handles conversation with many messages (100+)", async () => {
      // Use test-scoped IDs
      const manySpace = ctx.memorySpaceId("many-messages");
      const manyUser = ctx.userId("many-messages");
      const manyAgent = ctx.agentId("many-messages");

      const conv = await cortex.conversations.create({
        memorySpaceId: manySpace,
        type: "user-agent",
        participants: {
          userId: manyUser,
          agentId: manyAgent,
          participantId: manyAgent,
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
      const emptySpace = ctx.memorySpaceId("empty-test");
      const emptyUser = ctx.userId("empty-test");
      const emptyAgent = ctx.agentId("empty-test");

      const conv = await cortex.conversations.create({
        memorySpaceId: emptySpace,
        type: "user-agent",
        participants: {
          userId: emptyUser,
          agentId: emptyAgent,
          participantId: emptyAgent,
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
      const longSpace = ctx.memorySpaceId("long-test");
      const longUser = ctx.userId("long-test");
      const longAgent = ctx.agentId("long-test");

      const conv = await cortex.conversations.create({
        memorySpaceId: longSpace,
        type: "user-agent",
        participants: {
          userId: longUser,
          agentId: longAgent,
          participantId: longAgent,
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
      const specialId = `conv_test-${ctx.runId}.special-chars`;
      const specialSpace = ctx.memorySpaceId("special");
      const specialUser = ctx.userId("special");
      const specialAgent = ctx.agentId("special");

      const conv = await cortex.conversations.create({
        conversationId: specialId,
        memorySpaceId: specialSpace,
        type: "user-agent",
        participants: {
          userId: specialUser,
          agentId: specialAgent,
          participantId: specialAgent,
        },
      });

      expect(conv.conversationId).toBe(specialId);

      const retrieved = await cortex.conversations.get(specialId);

      expect(retrieved).not.toBeNull();
    });

    it("handles concurrent message additions", async () => {
      const concurrentSpace = ctx.memorySpaceId("concurrent-edge");
      const concurrentUser = ctx.userId("concurrent-edge");
      const concurrentAgent = ctx.agentId("concurrent-edge");

      const conv = await cortex.conversations.create({
        memorySpaceId: concurrentSpace,
        type: "user-agent",
        participants: {
          userId: concurrentUser,
          agentId: concurrentAgent,
          participantId: concurrentAgent,
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
      // Use test-scoped IDs
      const bulkSpace = ctx.memorySpaceId("bulk-delete");
      const bulkUser = ctx.userId("bulk-delete");
      const bulkAgent = ctx.agentId("bulk-delete");

      beforeAll(async () => {
        // Create test conversations for bulk delete
        for (let i = 1; i <= 5; i++) {
          await cortex.conversations.create({
            conversationId: ctx.conversationId(`bulk-delete-${i}`),
            memorySpaceId: bulkSpace,
            type: "user-agent",
            participants: {
              userId: bulkUser,
              agentId: bulkAgent,
              participantId: bulkAgent,
            },
          });
        }
      });

      it("deletes multiple conversations by userId", async () => {
        const result = await cortex.conversations.deleteMany({
          userId: bulkUser,
        });

        expect(result.deleted).toBeGreaterThanOrEqual(5);
        expect(result.conversationIds).toHaveLength(result.deleted);

        // Verify deletion
        const remaining = await cortex.conversations.list({
          userId: bulkUser,
        });

        expect(remaining.conversations.length).toBe(0);
      }, 60000); // Extended timeout for bulk delete with resilience layer

      it("returns count of messages deleted", async () => {
        // Use test-scoped IDs
        const deleteMsgsSpace = ctx.memorySpaceId("delete-msgs");
        const deleteMsgsUser = ctx.userId("delete-many-msgs");
        const deleteMsgsAgent = ctx.agentId("delete-msgs");

        // Create conversation with messages
        const conv = await cortex.conversations.create({
          memorySpaceId: deleteMsgsSpace,
          type: "user-agent",
          participants: {
            userId: deleteMsgsUser,
            agentId: deleteMsgsAgent,
            participantId: deleteMsgsAgent,
          },
        });

        for (let i = 0; i < 5; i++) {
          await cortex.conversations.addMessage({
            conversationId: conv.conversationId,
            message: { role: "user", content: `Message ${i}` },
          });
        }

        const result = await cortex.conversations.deleteMany({
          userId: deleteMsgsUser,
        });

        expect(result.totalMessagesDeleted).toBeGreaterThanOrEqual(5);
      });

      it("dryRun returns preview without deleting", async () => {
        // Use test-scoped IDs
        const dryRunSpace = ctx.memorySpaceId("dry-run");
        const dryRunUser = ctx.userId("dry-run-test");
        const dryRunAgent = ctx.agentId("dry-run");

        // Create test conversations
        for (let i = 1; i <= 3; i++) {
          const conv = await cortex.conversations.create({
            conversationId: ctx.conversationId(`dry-run-${i}`),
            memorySpaceId: dryRunSpace,
            type: "user-agent",
            participants: {
              userId: dryRunUser,
              agentId: dryRunAgent,
              participantId: dryRunAgent,
            },
          });

          // Add messages to each conversation
          await cortex.conversations.addMessage({
            conversationId: conv.conversationId,
            message: { role: "user", content: `Message in conv ${i}` },
          });
        }

        // Execute dryRun
        const preview = await cortex.conversations.deleteMany(
          { userId: dryRunUser },
          { dryRun: true },
        );

        // Validate preview result
        expect(preview.dryRun).toBe(true);
        expect(preview.deleted).toBe(0); // Nothing actually deleted
        expect(preview.wouldDelete).toBeGreaterThanOrEqual(3);
        expect(preview.totalMessagesDeleted).toBe(0);
        expect(preview.conversationIds).toHaveLength(0);

        // Verify conversations still exist
        const remaining = await cortex.conversations.list({
          userId: dryRunUser,
        });
        expect(remaining.conversations.length).toBeGreaterThanOrEqual(3);

        // Clean up by actually deleting
        await cortex.conversations.deleteMany({ userId: dryRunUser });
      });

      it("confirmationThreshold blocks deletion above limit", async () => {
        // Use test-scoped IDs
        const thresholdSpace = ctx.memorySpaceId("threshold");
        const thresholdUser = ctx.userId("threshold-test");
        const thresholdAgent = ctx.agentId("threshold");

        // Create 5 conversations (more than default threshold of 10, but we'll set low threshold)
        for (let i = 1; i <= 5; i++) {
          await cortex.conversations.create({
            conversationId: ctx.conversationId(`threshold-${i}`),
            memorySpaceId: thresholdSpace,
            type: "user-agent",
            participants: {
              userId: thresholdUser,
              agentId: thresholdAgent,
              participantId: thresholdAgent,
            },
          });
        }

        // Attempt deletion with threshold of 3 (should fail since we have 5)
        await expect(
          cortex.conversations.deleteMany(
            { userId: thresholdUser },
            { confirmationThreshold: 3 },
          ),
        ).rejects.toThrow(/DELETE_MANY_THRESHOLD_EXCEEDED/);

        // Verify conversations still exist
        const remaining = await cortex.conversations.list({
          userId: thresholdUser,
        });
        expect(remaining.conversations.length).toBeGreaterThanOrEqual(5);

        // Now delete with higher threshold
        const result = await cortex.conversations.deleteMany(
          { userId: thresholdUser },
          { confirmationThreshold: 10 },
        );

        expect(result.deleted).toBeGreaterThanOrEqual(5);
      });

      it("combines all filters (userId + memorySpaceId + type)", async () => {
        // Use test-scoped IDs
        const combinedSpace = ctx.memorySpaceId("combined-filter");
        const combinedUser = ctx.userId("combined-filter");
        const combinedAgent = ctx.agentId("combined-filter");

        // Create user-agent conversations
        for (let i = 1; i <= 2; i++) {
          await cortex.conversations.create({
            conversationId: ctx.conversationId(`combined-ua-${i}`),
            memorySpaceId: combinedSpace,
            type: "user-agent",
            participants: {
              userId: combinedUser,
              agentId: combinedAgent,
              participantId: combinedAgent,
            },
          });
        }

        // Create agent-agent conversation (different type)
        await cortex.conversations.create({
          conversationId: ctx.conversationId("combined-aa-1"),
          memorySpaceId: combinedSpace,
          type: "agent-agent",
          participants: {
            memorySpaceIds: [
              ctx.agentId("combined-a1"),
              ctx.agentId("combined-a2"),
            ],
          },
        });

        // Delete only user-agent conversations with all filters
        const result = await cortex.conversations.deleteMany({
          userId: combinedUser,
          memorySpaceId: combinedSpace,
          type: "user-agent",
        });

        expect(result.deleted).toBe(2);

        // Verify agent-agent conversation still exists
        const remaining = await cortex.conversations.list({
          memorySpaceId: combinedSpace,
          type: "agent-agent",
        });
        expect(remaining.conversations.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("getMessage()", () => {
      let testConversationId: string;
      let testMessageId: string;

      // Use test-scoped IDs
      const getMsgSpace = ctx.memorySpaceId("get-msg");
      const getMsgUser = ctx.userId("get-message");
      const getMsgAgent = ctx.agentId("get-message");

      beforeAll(async () => {
        const conv = await cortex.conversations.create({
          memorySpaceId: getMsgSpace,
          type: "user-agent",
          participants: {
            userId: getMsgUser,
            agentId: getMsgAgent,
            participantId: getMsgAgent,
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
          `msg-nonexistent-${ctx.runId}`,
        );

        expect(message).toBeNull();
      });

      it("returns null for non-existent conversation", async () => {
        const message = await cortex.conversations.getMessage(
          `conv-nonexistent-${ctx.runId}`,
          testMessageId,
        );

        expect(message).toBeNull();
      });
    });

    describe("getMessagesByIds()", () => {
      let testConversationId: string;
      let messageIds: string[];

      // Use test-scoped IDs
      const getMsgsSpace = ctx.memorySpaceId("get-msgs");
      const getMsgsUser = ctx.userId("get-messages");
      const getMsgsAgent = ctx.agentId("get-messages");

      beforeAll(async () => {
        const conv = await cortex.conversations.create({
          memorySpaceId: getMsgsSpace,
          type: "user-agent",
          participants: {
            userId: getMsgsUser,
            agentId: getMsgsAgent,
            participantId: getMsgsAgent,
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
          `conv-nonexistent-${ctx.runId}`,
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
      // Use test-scoped IDs
      const findSpace = ctx.memorySpaceId("find");
      const findCollabSpace = ctx.memorySpaceId("collab-find");
      const findUser = ctx.userId("find");
      const findAgent = ctx.agentId("find");
      const findAgentA = ctx.agentId("find-a");
      const findAgentB = ctx.agentId("find-b");

      beforeAll(async () => {
        await cortex.conversations.create({
          memorySpaceId: findSpace,
          type: "user-agent",
          participants: {
            userId: findUser,
            agentId: findAgent,
            participantId: findAgent,
          },
        });

        await cortex.conversations.create({
          memorySpaceId: findCollabSpace,
          type: "agent-agent",
          participants: {
            memorySpaceIds: [findAgentA, findAgentB],
          },
        });
      });

      it("finds existing user-agent conversation", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: findSpace,
          type: "user-agent",
          userId: findUser,
        });

        expect(found).not.toBeNull();
        expect(found!.type).toBe("user-agent");
        expect(found!.participants.userId).toBe(findUser);
        expect(found!.participants.participantId).toBe(findAgent);
      });

      it("finds existing agent-agent conversation", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: findCollabSpace,
          type: "agent-agent",
          memorySpaceIds: [findAgentA, findAgentB],
        });

        expect(found).not.toBeNull();
        expect(found!.type).toBe("agent-agent");
        expect(found!.participants.memorySpaceIds).toContain(findAgentA);
        expect(found!.participants.memorySpaceIds).toContain(findAgentB);
      });

      it("finds agent-agent regardless of order", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: findCollabSpace,
          type: "agent-agent",
          memorySpaceIds: [findAgentB, findAgentA], // Reversed order
        });

        expect(found).not.toBeNull();
      });

      it("returns null for non-existent conversation", async () => {
        const found = await cortex.conversations.findConversation({
          memorySpaceId: ctx.memorySpaceId("nonexistent"),
          type: "user-agent",
          userId: ctx.userId("nonexistent"),
        });

        expect(found).toBeNull();
      });
    });

    describe("getOrCreate()", () => {
      it("creates new conversation if doesn't exist", async () => {
        const gocSpace = ctx.memorySpaceId("goc-new");
        const gocUser = ctx.userId("goc-new");
        const gocAgent = ctx.agentId("goc-new");

        const result = await cortex.conversations.getOrCreate({
          memorySpaceId: gocSpace,
          type: "user-agent",
          participants: {
            userId: gocUser,
            agentId: gocAgent,
            participantId: gocAgent,
          },
        });

        expect(result.conversationId).toBeDefined();
        expect(result.type).toBe("user-agent");
        expect(result.messageCount).toBe(0);
      });

      it("returns existing conversation if found", async () => {
        const gocExistSpace = ctx.memorySpaceId("goc-existing");
        const gocExistUser = ctx.userId("goc-existing");
        const gocExistAgent = ctx.agentId("goc-existing");

        // First call creates
        const first = await cortex.conversations.getOrCreate({
          memorySpaceId: gocExistSpace,
          type: "user-agent",
          participants: {
            userId: gocExistUser,
            agentId: gocExistAgent,
            participantId: gocExistAgent,
          },
        });

        // Second call returns same
        const second = await cortex.conversations.getOrCreate({
          memorySpaceId: gocExistSpace,
          type: "user-agent",
          participants: {
            userId: gocExistUser,
            agentId: gocExistAgent,
            participantId: gocExistAgent,
          },
        });

        expect(second.conversationId).toBe(first.conversationId);
        expect(second._id).toBe(first._id);
      });

      it("works with agent-agent conversations", async () => {
        const gocCollabSpace = ctx.memorySpaceId("goc-collab");
        const gocAgentX = ctx.agentId("goc-x");
        const gocAgentY = ctx.agentId("goc-y");

        const first = await cortex.conversations.getOrCreate({
          memorySpaceId: gocCollabSpace,
          type: "agent-agent",
          participants: {
            memorySpaceIds: [gocAgentX, gocAgentY],
          },
        });

        const second = await cortex.conversations.getOrCreate({
          memorySpaceId: gocCollabSpace,
          type: "agent-agent",
          participants: {
            memorySpaceIds: [gocAgentY, gocAgentX], // Different order
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
      it("validation errors are synchronous (no network latency)", async () => {
        const start = Date.now();
        try {
          await cortex.conversations.create({
            memorySpaceId: "",
            type: "user-agent",
            participants: {},
          } as any);
        } catch (error: any) {
          const duration = Date.now() - start;

          // Validation should be nearly instant (no network call)
          // Using 10ms threshold to account for Date.now() millisecond precision
          // and CI environment variability (still much faster than any network call)
          expect(duration).toBeLessThan(10);
          expect(error.name).toBe("ConversationValidationError");
        }
      });
    });
  });

  describe("Cross-Operation Integration", () => {
    it("create → addMessage → list → search → export consistency", async () => {
      // Use test-scoped IDs
      const integrationSpace = ctx.memorySpaceId("integration");
      const integrationUser = ctx.userId("integration-test");
      const integrationAgent = ctx.agentId("integration-test");
      const uniqueSearchTerm = `UNIQUE_SEARCH_${ctx.runId}`;

      // Create with unique keyword
      const conv = await cortex.conversations.create({
        memorySpaceId: integrationSpace,
        type: "user-agent",
        participants: {
          userId: integrationUser,
          agentId: integrationAgent,
          participantId: integrationAgent,
        },
        metadata: {
          testKeyword: `INTEGRATION_TEST_${ctx.runId}`,
        },
      });

      // Add message with unique content
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: `This message contains ${uniqueSearchTerm} for testing`,
        },
      });

      // Verify in list
      const listResults = await cortex.conversations.list({
        userId: integrationUser,
      });

      expect(
        listResults.conversations.some(
          (c) => c.conversationId === conv.conversationId,
        ),
      ).toBe(true);
      expect(
        listResults.conversations.find(
          (c) => c.conversationId === conv.conversationId,
        )?.messageCount,
      ).toBe(1);

      // Verify in search
      const searchResults = await cortex.conversations.search({
        query: uniqueSearchTerm,
      });

      expect(
        searchResults.some(
          (r) => r.conversation.conversationId === conv.conversationId,
        ),
      ).toBe(true);

      // Verify in count
      const count = await cortex.conversations.count({
        userId: integrationUser,
      });

      expect(count).toBeGreaterThanOrEqual(1);

      // Verify in export
      const exported = await cortex.conversations.export({
        filters: { userId: integrationUser },
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
        userId: integrationUser,
      });

      expect(
        updatedList.conversations.find(
          (c) => c.conversationId === conv.conversationId,
        )?.messageCount,
      ).toBe(2);
    });

    it("search results update as messages are added", async () => {
      // Use test-scoped IDs
      const searchUpdateSpace = ctx.memorySpaceId("search-update");
      const searchUpdateUser = ctx.userId("search-update");
      const searchUpdateAgent = ctx.agentId("search-update");
      // Use unique search term to avoid conflicts
      const searchTerm = `secretpassword-${ctx.runId}`;

      const conv = await cortex.conversations.create({
        memorySpaceId: searchUpdateSpace,
        type: "user-agent",
        participants: {
          userId: searchUpdateUser,
          agentId: searchUpdateAgent,
          participantId: searchUpdateAgent,
        },
      });

      // Initially no matches for our unique term
      let results = await cortex.conversations.search({ query: searchTerm });

      expect(
        results.some(
          (r) => r.conversation.conversationId === conv.conversationId,
        ),
      ).toBe(false);

      // Add message with our unique term
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: `What is the ${searchTerm} for the account?`,
        },
      });

      // Should now find it
      results = await cortex.conversations.search({ query: searchTerm });
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

      // Add another message with our unique term
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "agent",
          content: `The ${searchTerm} is reset123`,
        },
      });

      // Should find 2 matched messages
      results = await cortex.conversations.search({ query: searchTerm });
      const thisResult = results.find(
        (r) => r.conversation.conversationId === conv.conversationId,
      );

      expect(thisResult?.matchedMessages.length).toBe(2);
    });
  });
});
