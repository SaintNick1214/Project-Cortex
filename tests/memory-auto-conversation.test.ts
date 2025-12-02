/**
 * Tests for memory.remember() auto-conversation creation
 *
 * Verifies that remember() automatically creates conversations if they don't exist
 */

import { Cortex } from "../src/index.js";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup.js";

describe("Memory API - Auto-Conversation Creation", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;

  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const memorySpaceId = "test-auto-conv-space";
  const conversationId = "test-auto-conv-123";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);

    // Clean slate
    await _cleanup.purgeConversations();
    await _cleanup.purgeMemories();
  });

  afterAll(async () => {
    await _cleanup.purgeConversations();
    await _cleanup.purgeMemories();
    cortex.close();
    await client.close();
  });

  test("remember() auto-creates conversation if it doesn't exist", async () => {
    // Verify conversation doesn't exist
    const beforeConv = await cortex.conversations.get(conversationId);
    expect(beforeConv).toBeNull();

    // Call remember() WITHOUT creating conversation first
    const result = await cortex.memory.remember({
      memorySpaceId,
      conversationId,
      userMessage: "I prefer dark mode",
      agentResponse: "Got it!",
      userId: "user-123",
      userName: "Alice",
    });

    // Verify conversation was auto-created
    const afterConv = await cortex.conversations.get(conversationId);
    expect(afterConv).not.toBeNull();
    expect(afterConv?.conversationId).toBe(conversationId);
    expect(afterConv?.type).toBe("user-agent");
    expect(afterConv?.participants.userId).toBe("user-123");
    expect(afterConv?.messages.length).toBe(2); // User + agent messages

    // Verify memories were created
    expect(result.memories.length).toBe(2);
    expect(result.conversation.conversationId).toBe(conversationId);
    expect(result.conversation.messageIds.length).toBe(2);
  });

  test("remember() reuses existing conversation if it exists", async () => {
    const existingConvId = "existing-conv-456";

    // Create conversation explicitly
    await cortex.conversations.create({
      memorySpaceId,
      conversationId: existingConvId,
      type: "user-agent",
      participants: {
        userId: "user-456",
        participantId: "test-agent",
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
      userId: "user-456",
      userName: "Bob",
    });

    // Verify conversation was reused (not recreated)
    const afterConv = await cortex.conversations.get(existingConvId);
    expect(afterConv?.conversationId).toBe(existingConvId);
    expect(afterConv?.messages.length).toBe(2); // Now has 2 messages
    expect(afterConv?.participants.userId).toBe("user-456"); // Original participant

    // Verify memories were created
    expect(result.memories.length).toBe(2);
  });

  test("remember() sets default participantId if not provided", async () => {
    const convId = "no-participant-conv";

    // Call remember() WITHOUT participantId
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Test message",
      agentResponse: "Test response",
      userId: "user-789",
      userName: "Charlie",
      // No participantId provided
    });

    // Verify conversation was created with default participantId
    const conv = await cortex.conversations.get(convId);
    expect(conv).not.toBeNull();
    expect(conv?.participants.participantId).toBe("agent"); // Default value
  });

  test("remember() preserves explicit participantId", async () => {
    const convId = "with-participant-conv";

    // Call remember() WITH explicit participantId
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Test message",
      agentResponse: "Test response",
      userId: "user-999",
      userName: "Dave",
      participantId: "custom-agent",
    });

    // Verify conversation was created with specified participantId
    const conv = await cortex.conversations.get(convId);
    expect(conv).not.toBeNull();
    expect(conv?.participants.participantId).toBe("custom-agent"); // Custom value
  });

  test("remember() can be called multiple times on auto-created conversation", async () => {
    const convId = "multi-remember-conv";

    // First remember() - auto-creates conversation
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "First message",
      agentResponse: "First response",
      userId: "user-multi",
      userName: "Eve",
    });

    // Second remember() - reuses existing conversation
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Second message",
      agentResponse: "Second response",
      userId: "user-multi",
      userName: "Eve",
    });

    // Third remember() - still reuses
    await cortex.memory.remember({
      memorySpaceId,
      conversationId: convId,
      userMessage: "Third message",
      agentResponse: "Third response",
      userId: "user-multi",
      userName: "Eve",
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
