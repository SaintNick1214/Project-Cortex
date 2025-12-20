/**
 * Tests for memory.remember() auto-conversation creation
 *
 * Verifies that remember() automatically creates conversations if they don't exist
 */

import { Cortex } from "../src/index.js";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext } from "./helpers/isolation.js";

describe("Memory API - Auto-Conversation Creation", () => {
  let cortex: Cortex;
  let client: ConvexClient;

  // Use TestRunContext for parallel-safe unique IDs
  const ctx = createNamedTestRunContext("auto-conv");

  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const memorySpaceId = ctx.memorySpaceId("main");
  const conversationId = ctx.conversationId("test");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    // No global cleanup needed - we use isolated IDs
  });

  afterAll(async () => {
    // Cleanup our isolated test data
    try {
      await cortex.memorySpaces.delete(memorySpaceId, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch (_e) {
      // Ignore cleanup errors
    }
    cortex.close();
    await client.close();
  });

  test("remember() auto-creates conversation if it doesn't exist", async () => {
    const userId = ctx.userId("alice");
    const agentId = ctx.agentId("alice-agent");

    // Verify conversation doesn't exist
    const beforeConv = await cortex.conversations.get(conversationId);
    expect(beforeConv).toBeNull();

    // Call remember() WITHOUT creating conversation first
    const result = await cortex.memory.remember({
      memorySpaceId,
      conversationId,
      userMessage: "I prefer dark mode",
      // Agent response with meaningful content (not just acknowledgment)
      agentResponse:
        "Your dark mode preference has been saved to your profile settings",
      userId,
      userName: "Alice",
      agentId,
    });

    // Verify conversation was auto-created
    const afterConv = await cortex.conversations.get(conversationId);
    expect(afterConv).not.toBeNull();
    expect(afterConv?.conversationId).toBe(conversationId);
    expect(afterConv?.type).toBe("user-agent");
    expect(afterConv?.participants.userId).toBe(userId);
    expect(afterConv?.messages.length).toBe(2); // User + agent messages

    // Verify memories were created
    expect(result.memories.length).toBe(2);
    expect(result.conversation.conversationId).toBe(conversationId);
    expect(result.conversation.messageIds.length).toBe(2);
  });

  test("remember() reuses existing conversation if it exists", async () => {
    const existingConvId = ctx.conversationId("existing");
    const userId = ctx.userId("bob");
    const agentId = ctx.agentId("test");

    // Create conversation explicitly
    await cortex.conversations.create({
      memorySpaceId,
      conversationId: existingConvId,
      type: "user-agent",
      participants: {
        userId,
        agentId,
        participantId: agentId,
      },
    });

    // Verify it exists
    const beforeConv = await cortex.conversations.get(existingConvId);
    expect(beforeConv).not.toBeNull();
    expect(beforeConv?.messages.length).toBe(0); // No messages yet

    // Call remember() - should reuse existing conversation
    const result = await cortex.memory.remember({
      memorySpaceId,
      conversationId: existingConvId,
      userMessage: "Second message",
      agentResponse: "Second response",
      userId,
      userName: "Bob",
      agentId,
    });

    // Verify conversation was reused (not recreated)
    const afterConv = await cortex.conversations.get(existingConvId);
    expect(afterConv?.conversationId).toBe(existingConvId);
    expect(afterConv?.messages.length).toBe(2); // Now has 2 messages
    expect(afterConv?.participants.userId).toBe(userId); // Original participant

    // Verify memories were created
    expect(result.memories.length).toBe(2);
  });

  test("remember() sets agentId in conversation participants", async () => {
    const convId = ctx.conversationId("no-participant");
    const userId = ctx.userId("charlie");
    const agentId = ctx.agentId("charlie-agent");

    // Call remember() WITH agentId
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Test message",
      agentResponse: "Test response",
      userId,
      userName: "Charlie",
      agentId,
      // No participantId provided
    });

    // Verify conversation was created with agentId
    const conv = await cortex.conversations.get(convId);
    expect(conv).not.toBeNull();
    expect(conv?.participants.agentId).toBe(agentId);
  });

  test("remember() preserves explicit participantId", async () => {
    const convId = ctx.conversationId("with-participant");
    const userId = ctx.userId("dave");
    const agentId = ctx.agentId("dave-agent");

    // Call remember() WITH explicit participantId
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Test message",
      agentResponse: "Test response",
      userId,
      userName: "Dave",
      agentId,
      participantId: "custom-agent",
    });

    // Verify conversation was created with specified participantId
    const conv = await cortex.conversations.get(convId);
    expect(conv).not.toBeNull();
    expect(conv?.participants.participantId).toBe("custom-agent"); // Custom value
  });

  test("remember() can be called multiple times on auto-created conversation", async () => {
    const convId = ctx.conversationId("multi-remember");
    const userId = ctx.userId("eve");
    const agentId = ctx.agentId("eve-agent");

    // First remember() - auto-creates conversation
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "First message",
      agentResponse: "First response",
      userId,
      userName: "Eve",
      agentId,
    });

    // Second remember() - reuses existing conversation
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Second message",
      agentResponse: "Second response",
      userId,
      userName: "Eve",
      agentId,
    });

    // Third remember() - still reuses
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Third message",
      agentResponse: "Third response",
      userId,
      userName: "Eve",
      agentId,
    });

    // Verify conversation has all messages
    const conv = await cortex.conversations.get(convId);
    expect(conv?.messages.length).toBe(6); // 3 × (user + agent)

    // Verify all memories were created
    const allMemories = await cortex.memory.list({
      memorySpaceId,
      limit: 100,
    });
    const convMemories = allMemories.filter((m) => {
      const memory = "memory" in m ? m.memory : m;
      return memory.conversationRef?.conversationId === convId;
    });
    expect(convMemories.length).toBe(6); // 3 exchanges × 2 memories each
  });
});
