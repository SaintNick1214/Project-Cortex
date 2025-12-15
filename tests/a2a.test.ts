/**
 * A2A Communication API Tests
 *
 * Comprehensive tests for agent-to-agent communication.
 * Tests cover: core operations, client-side validation, integration, and edge cases.
 */

import { Cortex, A2AValidationError } from "../src";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const _ctx = createTestRunContext();

describe("A2A Communication API", () => {
  let cortex: Cortex;
  let _cleanup: TestCleanup;

  beforeAll(() => {
    if (!process.env.CONVEX_URL) {
      throw new Error("CONVEX_URL environment variable is required for tests");
    }

    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL });
    _cleanup = new TestCleanup(cortex.getClient());
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() for parallel execution compatibility.
    cortex.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Operations (Happy Path)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("send()", () => {
    const uniquePrefix = `a2a-send-${Date.now()}`;

    it("should send basic message between agents", async () => {
      const result = await cortex.a2a.send({
        from: `${uniquePrefix}-agent-1`,
        to: `${uniquePrefix}-agent-2`,
        message: "Hello from agent 1",
        importance: 70,
      });

      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^a2a-msg-/);
      expect(result.sentAt).toBeGreaterThan(0);
      expect(result.senderMemoryId).toBeDefined();
      expect(result.receiverMemoryId).toBeDefined();
    });

    it("should create bidirectional memories", async () => {
      const agent1 = `${uniquePrefix}-bidir-agent-1`;
      const agent2 = `${uniquePrefix}-bidir-agent-2`;

      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Bidirectional test message",
        importance: 60,
      });

      // Verify sender memory exists
      const senderMemory = await cortex.vector.get(
        agent1,
        result.senderMemoryId,
      );
      expect(senderMemory).toBeDefined();
      expect(senderMemory?.content).toContain("Sent to");

      // Verify receiver memory exists
      const receiverMemory = await cortex.vector.get(
        agent2,
        result.receiverMemoryId,
      );
      expect(receiverMemory).toBeDefined();
      expect(receiverMemory?.content).toContain("Received from");
    });

    it("should track in ACID conversation by default", async () => {
      const result = await cortex.a2a.send({
        from: `${uniquePrefix}-acid-agent-1`,
        to: `${uniquePrefix}-acid-agent-2`,
        message: "ACID conversation test",
        importance: 65,
      });

      expect(result.conversationId).toBeDefined();
      expect(result.conversationId).toMatch(/^a2a-conv-/);
      expect(result.acidMessageId).toBeDefined();
    });

    it("should skip ACID when trackConversation=false", async () => {
      const result = await cortex.a2a.send({
        from: `${uniquePrefix}-noacid-agent-1`,
        to: `${uniquePrefix}-noacid-agent-2`,
        message: "No ACID tracking test",
        trackConversation: false,
        importance: 50,
      });

      expect(result.conversationId).toBeUndefined();
      expect(result.acidMessageId).toBeUndefined();
      // But memories should still exist
      expect(result.senderMemoryId).toBeDefined();
      expect(result.receiverMemoryId).toBeDefined();
    });

    it("should link to userId when provided", async () => {
      const agent1 = `${uniquePrefix}-user-agent-1`;
      const agent2 = `${uniquePrefix}-user-agent-2`;
      const testUserId = `user-${uniquePrefix}`;

      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Message about a specific user",
        userId: testUserId,
        importance: 75,
      });

      // Verify memory has userId linked
      const memory = await cortex.vector.get(agent1, result.senderMemoryId);
      expect(memory?.userId).toBe(testUserId);
    });

    it("should respect importance level", async () => {
      const agent1 = `${uniquePrefix}-imp-agent-1`;
      const agent2 = `${uniquePrefix}-imp-agent-2`;

      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "High importance message",
        importance: 95,
      });

      const memory = await cortex.vector.get(agent1, result.senderMemoryId);
      expect(memory?.importance).toBe(95);
    });

    it("should store metadata correctly", async () => {
      const agent1 = `${uniquePrefix}-meta-agent-1`;
      const agent2 = `${uniquePrefix}-meta-agent-2`;

      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Message with metadata",
        importance: 60,
        metadata: {
          tags: ["important", "budget"],
          priority: "high",
        },
      });

      const memory = await cortex.vector.get(agent1, result.senderMemoryId);
      expect(memory?.tags).toContain("important");
      expect(memory?.tags).toContain("budget");
    });

    it("should use default importance of 60 when not specified", async () => {
      const agent1 = `${uniquePrefix}-default-agent-1`;
      const agent2 = `${uniquePrefix}-default-agent-2`;

      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Default importance message",
      });

      const memory = await cortex.vector.get(agent1, result.senderMemoryId);
      expect(memory?.importance).toBe(60);
    });

    it("should store contextId correctly in metadata", async () => {
      const agent1 = `${uniquePrefix}-ctx-agent-1`;
      const agent2 = `${uniquePrefix}-ctx-agent-2`;
      const testContextId = `ctx-send-${Date.now()}`;

      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Message with contextId",
        contextId: testContextId,
        importance: 70,
      });

      // Verify sender memory has contextId in metadata
      const senderMemory = await cortex.vector.get(
        agent1,
        result.senderMemoryId,
      );
      expect(senderMemory).not.toBeNull();
      expect((senderMemory as any).metadata).toBeDefined();
      expect((senderMemory as any).metadata.contextId).toBe(testContextId);

      // Verify receiver memory has contextId in metadata
      const receiverMemory = await cortex.vector.get(
        agent2,
        result.receiverMemoryId,
      );
      expect(receiverMemory).not.toBeNull();
      expect((receiverMemory as any).metadata).toBeDefined();
      expect((receiverMemory as any).metadata.contextId).toBe(testContextId);
    });
  });

  describe("broadcast()", () => {
    const uniquePrefix = `a2a-broadcast-${Date.now()}`;

    it("should broadcast to multiple agents", async () => {
      const sender = `${uniquePrefix}-sender`;
      const recipients = [
        `${uniquePrefix}-recipient-1`,
        `${uniquePrefix}-recipient-2`,
        `${uniquePrefix}-recipient-3`,
      ];

      const result = await cortex.a2a.broadcast({
        from: sender,
        to: recipients,
        message: "Broadcast message to team",
        importance: 70,
      });

      expect(result.messageId).toBeDefined();
      expect(result.recipients).toHaveLength(3);
      expect(result.recipients).toEqual(expect.arrayContaining(recipients));
    });

    it("should create memories for all recipients", async () => {
      const sender = `${uniquePrefix}-mem-sender`;
      const recipients = [`${uniquePrefix}-mem-r1`, `${uniquePrefix}-mem-r2`];

      const result = await cortex.a2a.broadcast({
        from: sender,
        to: recipients,
        message: "Broadcast with memories",
        importance: 65,
      });

      expect(result.senderMemoryIds).toHaveLength(recipients.length);
      expect(result.receiverMemoryIds).toHaveLength(recipients.length);
    });

    it("should return correct counts", async () => {
      const sender = `${uniquePrefix}-count-sender`;
      const recipients = [
        `${uniquePrefix}-count-r1`,
        `${uniquePrefix}-count-r2`,
        `${uniquePrefix}-count-r3`,
        `${uniquePrefix}-count-r4`,
      ];

      const result = await cortex.a2a.broadcast({
        from: sender,
        to: recipients,
        message: "Counting broadcast",
        importance: 60,
      });

      // 4 recipients = 4 sender memories + 4 receiver memories = 8 total
      expect(result.memoriesCreated).toBe(8);
    });

    it("should handle larger recipient lists efficiently", async () => {
      const sender = `${uniquePrefix}-large-sender`;
      const recipients = Array.from(
        { length: 20 },
        (_, i) => `${uniquePrefix}-large-r${i}`,
      );

      const startTime = Date.now();
      const result = await cortex.a2a.broadcast({
        from: sender,
        to: recipients,
        message: "Large broadcast test",
        importance: 55,
      });
      const duration = Date.now() - startTime;

      expect(result.recipients).toHaveLength(20);
      expect(result.memoriesCreated).toBe(40); // 20 sender + 20 receiver
      // Should complete in reasonable time (< 30 seconds)
      expect(duration).toBeLessThan(30000);
    });

    it("should skip ACID when trackConversation=false", async () => {
      const sender = `${uniquePrefix}-noacid-sender`;
      const recipients = [
        `${uniquePrefix}-noacid-r1`,
        `${uniquePrefix}-noacid-r2`,
      ];

      const result = await cortex.a2a.broadcast({
        from: sender,
        to: recipients,
        message: "No ACID tracking broadcast",
        trackConversation: false,
        importance: 50,
      });

      // conversationIds should be undefined when trackConversation=false
      expect(result.conversationIds).toBeUndefined();
      // But memories should still exist
      expect(result.senderMemoryIds).toHaveLength(2);
      expect(result.receiverMemoryIds).toHaveLength(2);
      expect(result.memoriesCreated).toBe(4);
    });

    it("should return conversationIds array when trackConversation=true", async () => {
      const sender = `${uniquePrefix}-acid-sender`;
      const recipients = [
        `${uniquePrefix}-acid-r1`,
        `${uniquePrefix}-acid-r2`,
        `${uniquePrefix}-acid-r3`,
      ];

      const result = await cortex.a2a.broadcast({
        from: sender,
        to: recipients,
        message: "ACID tracking broadcast",
        trackConversation: true, // explicit true
        importance: 60,
      });

      // conversationIds should be defined and have one per recipient
      expect(result.conversationIds).toBeDefined();
      expect(result.conversationIds).toHaveLength(3);
      // Each conversationId should follow the a2a-conv pattern
      result.conversationIds!.forEach((convId) => {
        expect(convId).toMatch(/^a2a-conv-/);
      });
    });

    it("should store contextId correctly in metadata", async () => {
      const sender = `${uniquePrefix}-ctx-sender`;
      const recipients = [`${uniquePrefix}-ctx-r1`];
      const testContextId = `ctx-broadcast-${Date.now()}`;

      const result = await cortex.a2a.broadcast({
        from: sender,
        to: recipients,
        message: "Broadcast with context",
        contextId: testContextId,
        importance: 65,
      });

      // Verify sender memory has contextId in metadata
      const senderMemory = await cortex.vector.get(
        sender,
        result.senderMemoryIds[0],
      );
      expect(senderMemory).not.toBeNull();
      expect((senderMemory as any).metadata).toBeDefined();
      expect((senderMemory as any).metadata.contextId).toBe(testContextId);

      // Verify receiver memory has contextId in metadata
      const receiverMemory = await cortex.vector.get(
        recipients[0],
        result.receiverMemoryIds[0],
      );
      expect(receiverMemory).not.toBeNull();
      expect((receiverMemory as any).metadata).toBeDefined();
      expect((receiverMemory as any).metadata.contextId).toBe(testContextId);
    });
  });

  describe("getConversation()", () => {
    const uniquePrefix = `a2a-convo-${Date.now()}`;

    beforeAll(async () => {
      // Set up some test messages
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      // Send multiple messages with different importance levels
      await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "First message",
        importance: 80,
        metadata: { tags: ["budget"] },
      });

      await cortex.a2a.send({
        from: agent2,
        to: agent1,
        message: "Reply message",
        importance: 75,
        metadata: { tags: ["budget"] },
      });

      await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Low importance message",
        importance: 30,
      });
    });

    it("should retrieve conversation between two agents", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      const convo = await cortex.a2a.getConversation(agent1, agent2);

      expect(convo.participants).toContain(agent1);
      expect(convo.participants).toContain(agent2);
      expect(convo.messageCount).toBeGreaterThan(0);
      expect(convo.messages.length).toBeGreaterThan(0);
    });

    it("should return chronologically sorted messages", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      const convo = await cortex.a2a.getConversation(agent1, agent2);

      // Messages should be in ascending chronological order
      for (let i = 1; i < convo.messages.length; i++) {
        expect(convo.messages[i].timestamp).toBeGreaterThanOrEqual(
          convo.messages[i - 1].timestamp,
        );
      }
    });

    it("should apply importance filters", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      const convo = await cortex.a2a.getConversation(agent1, agent2, {
        minImportance: 70,
      });

      // All messages should have importance >= 70
      for (const msg of convo.messages) {
        expect(msg.importance).toBeGreaterThanOrEqual(70);
      }
    });

    it("should handle empty conversations", async () => {
      const convo = await cortex.a2a.getConversation(
        `${uniquePrefix}-nonexistent-1`,
        `${uniquePrefix}-nonexistent-2`,
      );

      expect(convo.messageCount).toBe(0);
      expect(convo.messages).toHaveLength(0);
    });

    it("should respect limit pagination", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      const convo = await cortex.a2a.getConversation(agent1, agent2, {
        limit: 1,
      });

      expect(convo.messages.length).toBeLessThanOrEqual(1);
    });

    it("should apply combined filters (since + until + minImportance)", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      // Get all messages first to establish time bounds
      const allConvo = await cortex.a2a.getConversation(agent1, agent2);
      expect(allConvo.messages.length).toBeGreaterThan(0);

      // Use the period from existing messages
      const since = new Date(allConvo.period.start - 1000); // 1 second before
      const until = new Date(allConvo.period.end + 1000); // 1 second after

      const filteredConvo = await cortex.a2a.getConversation(agent1, agent2, {
        since,
        until,
        minImportance: 70,
      });

      // Should only include high-importance messages within the time range
      for (const msg of filteredConvo.messages) {
        expect(msg.importance).toBeGreaterThanOrEqual(70);
        expect(msg.timestamp).toBeGreaterThanOrEqual(since.getTime());
        expect(msg.timestamp).toBeLessThanOrEqual(until.getTime());
      }
    });

    it("should apply tags filter", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      // Filter by "budget" tag which was set in beforeAll
      const convo = await cortex.a2a.getConversation(agent1, agent2, {
        tags: ["budget"],
      });

      // Should return messages with the budget tag
      expect(convo.messageCount).toBeGreaterThan(0);
      // Messages with budget tag have importance 75-80
      for (const msg of convo.messages) {
        expect(msg.importance).toBeGreaterThanOrEqual(75);
      }
    });

    it("should apply userId filter", async () => {
      // Create new agents with a specific userId
      const agent1 = `${uniquePrefix}-userid-agent-1`;
      const agent2 = `${uniquePrefix}-userid-agent-2`;
      const testUserId = `user-filter-${Date.now()}`;

      // Send messages with userId
      await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Message with userId",
        userId: testUserId,
        importance: 70,
      });

      // Send message without userId
      await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Message without userId",
        importance: 65,
      });

      // Filter by userId
      const convo = await cortex.a2a.getConversation(agent1, agent2, {
        userId: testUserId,
      });

      // Should only return messages with the specific userId
      expect(convo.messageCount).toBeGreaterThanOrEqual(1);
      // All returned messages should have the userId
      for (const msg of convo.messages) {
        // Verify through memory lookup
        const memory = await cortex.vector.get(agent1, msg.memoryId);
        expect(memory?.userId).toBe(testUserId);
      }
    });

    it("should verify period.start and period.end accuracy", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      const convo = await cortex.a2a.getConversation(agent1, agent2);

      expect(convo.messageCount).toBeGreaterThan(0);

      // period.start should be <= earliest message timestamp
      const earliestTimestamp = Math.min(
        ...convo.messages.map((m) => m.timestamp),
      );
      expect(convo.period.start).toBeLessThanOrEqual(earliestTimestamp);

      // period.end should be >= latest message timestamp
      const latestTimestamp = Math.max(
        ...convo.messages.map((m) => m.timestamp),
      );
      expect(convo.period.end).toBeGreaterThanOrEqual(latestTimestamp);
    });

    it("should apply offset pagination correctly", async () => {
      const agent1 = `${uniquePrefix}-agent-1`;
      const agent2 = `${uniquePrefix}-agent-2`;

      // Get all messages first
      const allConvo = await cortex.a2a.getConversation(agent1, agent2);

      if (allConvo.messageCount >= 2) {
        // Get first message with limit 1
        const firstPage = await cortex.a2a.getConversation(agent1, agent2, {
          limit: 1,
          offset: 0,
        });

        // Get second message with offset 1
        const secondPage = await cortex.a2a.getConversation(agent1, agent2, {
          limit: 1,
          offset: 1,
        });

        // Ensure different messages are returned
        expect(firstPage.messages[0]?.messageId).not.toBe(
          secondPage.messages[0]?.messageId,
        );
      }
    });
  });

  describe("request()", () => {
    it("should throw explaining pub/sub requirement", async () => {
      await expect(
        cortex.a2a.request({
          from: "test-requester",
          to: "test-responder",
          message: "What is the status?",
          timeout: 5000,
        }),
      ).rejects.toThrow(/pub.?sub/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Client-Side Validation", () => {
    describe("send() validation", () => {
      it("should throw on missing from agent", async () => {
        await expect(
          cortex.a2a.send({
            from: "",
            to: "agent-2",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "",
            to: "agent-2",
            message: "test",
          });
        } catch (error) {
          expect(error).toBeInstanceOf(A2AValidationError);
          expect((error as A2AValidationError).code).toBe("INVALID_AGENT_ID");
          expect((error as A2AValidationError).field).toBe("from");
        }
      });

      it("should throw on missing to agent", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "",
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_AGENT_ID");
          expect((error as A2AValidationError).field).toBe("to");
        }
      });

      it("should throw on empty message", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("EMPTY_MESSAGE");
        }
      });

      it("should throw on whitespace-only message", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "   \n\t   ",
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on message > 100KB", async () => {
        const largeMessage = "x".repeat(102401); // 100KB + 1 byte

        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: largeMessage,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: largeMessage,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("MESSAGE_TOO_LARGE");
        }
      });

      it("should throw on invalid importance (-1)", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: -1,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: -1,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_IMPORTANCE");
        }
      });

      it("should throw on invalid importance (101)", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: 101,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on non-integer importance", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            importance: 50.5,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on invalid agent ID format", async () => {
        await expect(
          cortex.a2a.send({
            from: "agent@invalid!chars",
            to: "agent-2",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw when from === to", async () => {
        await expect(
          cortex.a2a.send({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.send({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe(
            "SAME_AGENT_COMMUNICATION",
          );
        }
      });
    });

    describe("broadcast() validation", () => {
      it("should throw on empty recipients array", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: [],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: [],
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("EMPTY_RECIPIENTS");
        }
      });

      it("should throw on duplicate recipients", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: ["recipient-1", "recipient-1", "recipient-2"],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: ["recipient-1", "recipient-1"],
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe(
            "DUPLICATE_RECIPIENTS",
          );
        }
      });

      it("should throw on > 100 recipients", async () => {
        const tooManyRecipients = Array.from(
          { length: 101 },
          (_, i) => `recipient-${i}`,
        );

        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: tooManyRecipients,
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: tooManyRecipients,
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe(
            "TOO_MANY_RECIPIENTS",
          );
        }
      });

      it("should throw on invalid recipient ID", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: ["valid-recipient", "invalid@recipient!"],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw when sender in recipients", async () => {
        await expect(
          cortex.a2a.broadcast({
            from: "sender",
            to: ["recipient-1", "sender", "recipient-2"],
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.broadcast({
            from: "sender",
            to: ["sender"],
            message: "test",
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_RECIPIENT");
        }
      });
    });

    describe("getConversation() validation", () => {
      it("should throw when since > until", async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            since: now,
            until: yesterday,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.getConversation("agent-1", "agent-2", {
            since: now,
            until: yesterday,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_DATE_RANGE");
        }
      });

      it("should throw on invalid minImportance", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            minImportance: 150,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on limit = 0", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            limit: 0,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.getConversation("agent-1", "agent-2", {
            limit: 0,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_LIMIT");
        }
      });

      it("should throw on limit > 1000", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            limit: 1001,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on negative offset", async () => {
        await expect(
          cortex.a2a.getConversation("agent-1", "agent-2", {
            offset: -1,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.getConversation("agent-1", "agent-2", {
            offset: -1,
          });
        } catch (error) {
          expect((error as A2AValidationError).code).toBe("INVALID_OFFSET");
        }
      });

      it("should throw on empty agent1", async () => {
        await expect(cortex.a2a.getConversation("", "agent-2")).rejects.toThrow(
          A2AValidationError,
        );
      });

      it("should throw on empty agent2", async () => {
        await expect(cortex.a2a.getConversation("agent-1", "")).rejects.toThrow(
          A2AValidationError,
        );
      });
    });

    describe("request() validation", () => {
      it("should throw on invalid timeout (< 1000ms)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            timeout: 500,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            timeout: 500,
          });
        } catch (error) {
          if (error instanceof A2AValidationError) {
            expect(error.code).toBe("INVALID_TIMEOUT");
          }
        }
      });

      it("should throw on invalid timeout (> 300000ms)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            timeout: 400000,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw on invalid retries (negative)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            retries: -1,
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            retries: -1,
          });
        } catch (error) {
          if (error instanceof A2AValidationError) {
            expect(error.code).toBe("INVALID_RETRIES");
          }
        }
      });

      it("should throw on invalid retries (> 10)", async () => {
        await expect(
          cortex.a2a.request({
            from: "agent-1",
            to: "agent-2",
            message: "test",
            retries: 11,
          }),
        ).rejects.toThrow(A2AValidationError);
      });

      it("should throw when from === to", async () => {
        await expect(
          cortex.a2a.request({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          }),
        ).rejects.toThrow(A2AValidationError);

        try {
          await cortex.a2a.request({
            from: "same-agent",
            to: "same-agent",
            message: "test",
          });
        } catch (error) {
          if (error instanceof A2AValidationError) {
            expect(error.code).toBe("SAME_AGENT_COMMUNICATION");
          }
        }
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Integration Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Integration", () => {
    const uniquePrefix = `a2a-integration-${Date.now()}`;

    it("should integrate with Memory API search (source.type='a2a')", async () => {
      const agent1 = `${uniquePrefix}-search-agent`;
      const agent2 = `${uniquePrefix}-search-target`;

      // Send A2A message
      await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Searchable A2A message about quarterly budget",
        importance: 70,
      });

      // Search for A2A messages
      const searchResults = await cortex.vector.search(agent1, "budget", {
        sourceType: "a2a",
        limit: 10,
      });

      expect(searchResults.length).toBeGreaterThan(0);
      const found = searchResults.find((m) => m.sourceType === "a2a");
      expect(found).toBeDefined();
    });

    it("should support filtering by direction (outbound/inbound)", async () => {
      const agent1 = `${uniquePrefix}-dir-agent-1`;
      const agent2 = `${uniquePrefix}-dir-agent-2`;

      await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Direction test message",
        importance: 65,
      });

      // Query sender's memories - should have outbound
      const senderMemories = await cortex.vector.list({
        memorySpaceId: agent1,
        sourceType: "a2a",
      });
      expect(senderMemories.length).toBeGreaterThan(0);

      // Query receiver's memories - should have inbound
      const receiverMemories = await cortex.vector.list({
        memorySpaceId: agent2,
        sourceType: "a2a",
      });
      expect(receiverMemories.length).toBeGreaterThan(0);
    });

    it("A2A messages should have proper tags", async () => {
      const agent1 = `${uniquePrefix}-tag-agent-1`;
      const agent2 = `${uniquePrefix}-tag-agent-2`;

      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Tagged A2A message",
        importance: 60,
        metadata: {
          tags: ["custom-tag"],
        },
      });

      const memory = await cortex.vector.get(agent1, result.senderMemoryId);
      expect(memory?.tags).toContain("a2a");
      expect(memory?.tags).toContain("sent");
      expect(memory?.tags).toContain("custom-tag");
    });

    it("should cascade A2A memories when user data is deleted", async () => {
      const agent1 = `${uniquePrefix}-gdpr-agent-1`;
      const agent2 = `${uniquePrefix}-gdpr-agent-2`;
      const testUserId = `user-gdpr-cascade-${Date.now()}`;

      // Send A2A message with userId
      const result = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "GDPR cascade test message",
        userId: testUserId,
        importance: 75,
      });

      // Verify memories exist with userId
      const senderMemory = await cortex.vector.get(
        agent1,
        result.senderMemoryId,
      );
      expect(senderMemory).not.toBeNull();
      expect(senderMemory!.userId).toBe(testUserId);

      const receiverMemory = await cortex.vector.get(
        agent2,
        result.receiverMemoryId,
      );
      expect(receiverMemory).not.toBeNull();
      expect(receiverMemory!.userId).toBe(testUserId);

      // Delete memories by userId (GDPR cascade)
      const deleteResult = await cortex.vector.deleteMany({
        memorySpaceId: agent1,
        userId: testUserId,
      });
      expect(deleteResult.deleted).toBeGreaterThanOrEqual(1);

      await cortex.vector.deleteMany({
        memorySpaceId: agent2,
        userId: testUserId,
      });

      // Verify memories are deleted
      const senderCheck = await cortex.vector.get(agent1, result.senderMemoryId);
      expect(senderCheck).toBeNull();

      const receiverCheck = await cortex.vector.get(
        agent2,
        result.receiverMemoryId,
      );
      expect(receiverCheck).toBeNull();
    });

    it("should support multi-hop A2A workflow (agent1 → agent2 → agent3)", async () => {
      const agent1 = `${uniquePrefix}-hop-agent-1`;
      const agent2 = `${uniquePrefix}-hop-agent-2`;
      const agent3 = `${uniquePrefix}-hop-agent-3`;

      // Step 1: agent1 sends to agent2
      const msg1 = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Request to forward to agent3",
        importance: 80,
        metadata: { tags: ["multi-hop", "step-1"] },
      });

      expect(msg1.messageId).toBeDefined();

      // Step 2: agent2 forwards to agent3
      const msg2 = await cortex.a2a.send({
        from: agent2,
        to: agent3,
        message: "Forwarded request from agent1",
        importance: 80,
        metadata: {
          tags: ["multi-hop", "step-2"],
          originalMessageId: msg1.messageId,
        },
      });

      expect(msg2.messageId).toBeDefined();

      // Step 3: agent3 responds back to agent2
      const msg3 = await cortex.a2a.send({
        from: agent3,
        to: agent2,
        message: "Response for agent1",
        importance: 85,
        metadata: {
          tags: ["multi-hop", "step-3"],
          inResponseTo: msg2.messageId,
        },
      });

      expect(msg3.messageId).toBeDefined();

      // Verify conversation chain: agent1 ↔ agent2
      const convo12 = await cortex.a2a.getConversation(agent1, agent2);
      expect(convo12.messageCount).toBeGreaterThanOrEqual(1);

      // Verify conversation chain: agent2 ↔ agent3
      const convo23 = await cortex.a2a.getConversation(agent2, agent3);
      expect(convo23.messageCount).toBeGreaterThanOrEqual(2);

      // Verify agent2 has memories from both directions
      const agent2Memories = await cortex.vector.list({
        memorySpaceId: agent2,
        sourceType: "a2a",
      });

      // agent2 should have received from agent1 and agent3, and sent to both
      const agent2A2AMemories = agent2Memories.filter((m) =>
        m.tags.includes("multi-hop"),
      );
      expect(agent2A2AMemories.length).toBeGreaterThanOrEqual(3);
    });

    it("should link A2A messages to workflow contexts via contextId", async () => {
      const agent1 = `${uniquePrefix}-workflow-agent-1`;
      const agent2 = `${uniquePrefix}-workflow-agent-2`;
      const workflowContextId = `workflow-${Date.now()}`;

      // Send multiple A2A messages for same workflow
      const msg1 = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Start workflow task",
        contextId: workflowContextId,
        importance: 70,
      });

      const msg2 = await cortex.a2a.send({
        from: agent2,
        to: agent1,
        message: "Acknowledge workflow task",
        contextId: workflowContextId,
        importance: 70,
      });

      const msg3 = await cortex.a2a.send({
        from: agent1,
        to: agent2,
        message: "Complete workflow task",
        contextId: workflowContextId,
        importance: 80,
      });

      // Verify all messages are linked to the same contextId
      const memories = [
        await cortex.vector.get(agent1, msg1.senderMemoryId),
        await cortex.vector.get(agent2, msg2.senderMemoryId),
        await cortex.vector.get(agent1, msg3.senderMemoryId),
      ];

      for (const memory of memories) {
        expect(memory).not.toBeNull();
        expect((memory as any).metadata).toBeDefined();
        expect((memory as any).metadata.contextId).toBe(workflowContextId);
      }

      // Conversation should have all messages
      const convo = await cortex.a2a.getConversation(agent1, agent2);
      expect(convo.messageCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    const uniquePrefix = `a2a-edge-${Date.now()}`;

    it("should handle messages near 100KB limit", async () => {
      const nearLimitMessage = "x".repeat(100000); // Just under 100KB

      const result = await cortex.a2a.send({
        from: `${uniquePrefix}-large-1`,
        to: `${uniquePrefix}-large-2`,
        message: nearLimitMessage,
        importance: 50,
      });

      expect(result.messageId).toBeDefined();
    });

    it("should handle special characters (emoji, unicode)", async () => {
      const specialMessage = "Hello! 👋 こんにちは 🎉 مرحبا 🚀";

      const result = await cortex.a2a.send({
        from: `${uniquePrefix}-unicode-1`,
        to: `${uniquePrefix}-unicode-2`,
        message: specialMessage,
        importance: 55,
      });

      expect(result.messageId).toBeDefined();

      // Verify message content is preserved
      const memory = await cortex.vector.get(
        `${uniquePrefix}-unicode-1`,
        result.senderMemoryId,
      );
      expect(memory?.content).toContain("👋");
      expect(memory?.content).toContain("こんにちは");
    });

    it("should handle agents with no prior communication", async () => {
      const convo = await cortex.a2a.getConversation(
        `${uniquePrefix}-newagent-1`,
        `${uniquePrefix}-newagent-2`,
      );

      expect(convo.messageCount).toBe(0);
      expect(convo.messages).toHaveLength(0);
      expect(convo.canRetrieveFullHistory).toBe(false);
    });

    it("should handle rapid sequential messages", async () => {
      const agent1 = `${uniquePrefix}-rapid-1`;
      const agent2 = `${uniquePrefix}-rapid-2`;

      // Send 5 messages in rapid succession
      const promises = Array.from({ length: 5 }, (_, i) =>
        cortex.a2a.send({
          from: agent1,
          to: agent2,
          message: `Rapid message ${i + 1}`,
          importance: 60,
        }),
      );

      const results = await Promise.all(promises);

      // All messages should succeed with unique IDs
      const messageIds = results.map((r) => r.messageId);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(5);
    });

    it("should handle agent IDs with allowed special chars", async () => {
      // Hyphens and underscores are allowed
      const result = await cortex.a2a.send({
        from: `${uniquePrefix}-agent_one-test`,
        to: `${uniquePrefix}-agent_two-test`,
        message: "Test with special agent IDs",
        importance: 50,
      });

      expect(result.messageId).toBeDefined();
    });

    it("should handle boundary importance values", async () => {
      // Test importance = 0
      const result0 = await cortex.a2a.send({
        from: `${uniquePrefix}-imp0-1`,
        to: `${uniquePrefix}-imp0-2`,
        message: "Zero importance",
        importance: 0,
      });
      expect(result0.messageId).toBeDefined();

      // Test importance = 100
      const result100 = await cortex.a2a.send({
        from: `${uniquePrefix}-imp100-1`,
        to: `${uniquePrefix}-imp100-2`,
        message: "Max importance",
        importance: 100,
      });
      expect(result100.messageId).toBeDefined();
    });
  });
});
