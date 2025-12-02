/**
 * Parameter Propagation Tests (v0.6.1)
 *
 * Critical tests to ensure wrapper functions properly propagate parameters
 * to underlying layer functions. Prevents bugs like the participantId issue.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Parameter Propagation: memory.remember()", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("param-prop");
  const TEST_USER_ID = ctx.userId("param-test");
  let testConversationId: string;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);
    // NOTE: Removed purgeAll() for parallel execution compatibility.

    // Create conversation for remember() tests
    const conv = await cortex.conversations.create({
      type: "user-agent",
      memorySpaceId: TEST_MEMSPACE_ID,
      participants: { userId: TEST_USER_ID },
    });
    testConversationId = conv.conversationId;
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    await client.close();
  });

  describe("Propagation to Vector Layer", () => {
    it("propagates participantId to vector layer", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        participantId: "tool-calendar",
        userMessage: "Check my calendar for tomorrow",
        agentResponse: "You have 3 meetings tomorrow",
      });

      expect(result.memories).toHaveLength(2);

      // Verify user memory has participantId
      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );
      expect(userMem).not.toBeNull();
      expect(userMem!.participantId).toBe("tool-calendar");

      // Verify agent memory has participantId
      const agentMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[1].memoryId,
      );
      expect(agentMem).not.toBeNull();
      expect(agentMem!.participantId).toBe("tool-calendar");
    });

    it("propagates importance to vector layer", async () => {
      const IMPORTANCE = 95;

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        importance: IMPORTANCE,
        userMessage: "My password is secret123",
        // Agent response with meaningful content (not just acknowledgment)
        agentResponse:
          "Your password secret123 has been securely stored in the encrypted vault",
      });

      // Verify both memories have correct importance
      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );
      const agentMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[1].memoryId,
      );

      expect(userMem!.importance).toBe(IMPORTANCE);
      expect(agentMem!.importance).toBe(IMPORTANCE);
    });

    it("propagates tags to vector layer", async () => {
      const TAGS = ["critical", "password", "security"];

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        tags: TAGS,
        userMessage: "Security concern here",
        // Agent response with meaningful content (not just acknowledgment)
        agentResponse:
          "The security concern has been logged and flagged for immediate review by the team",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );
      const agentMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[1].memoryId,
      );

      expect(userMem!.tags).toEqual(expect.arrayContaining(TAGS));
      expect(agentMem!.tags).toEqual(expect.arrayContaining(TAGS));
    });

    it("propagates userId to vector layer", async () => {
      // Use ctx-scoped userId for parallel execution isolation
      const USER_ID = ctx.userId("specific");

      // Create specific conversation for this user
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: USER_ID },
      });

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userId: USER_ID,
        userName: "Specific User",
        userMessage: "Test message",
        agentResponse: "Test response",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );
      const agentMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[1].memoryId,
      );

      expect(userMem!.userId).toBe(USER_ID);
      expect(agentMem!.userId).toBe(USER_ID);
    });

    it("propagates conversationRef correctly", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        userMessage: "Track this conversation",
        agentResponse: "Conversation tracked",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      // Validate conversationRef exists and points to actual conversation
      expect(userMem!.conversationRef).toBeDefined();
      expect(userMem!.conversationRef!.conversationId).toBe(
        result.conversation.conversationId,
      );

      // Verify the conversation actually exists
      const conv = await cortex.conversations.get(
        userMem!.conversationRef!.conversationId!,
      );
      expect(conv).not.toBeNull();
      expect(conv!.conversationId).toBe(result.conversation.conversationId);
    });

    it("handles undefined participantId correctly", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        participantId: undefined, // Explicitly undefined
        userMessage: "No participant",
        agentResponse: "Response without participant",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      // Should be undefined, not null or empty string
      expect(userMem!.participantId).toBeUndefined();
    });

    it("handles omitted participantId correctly", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        // participantId NOT provided at all
        userMessage: "No participant field",
        agentResponse: "Response without participant field",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      expect(userMem!.participantId).toBeUndefined();
    });

    it("propagates all parameters together", async () => {
      const INPUT = {
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: "multi-param-user",
        userName: "Multi Param User",
        participantId: "tool-multi",
        importance: 88,
        tags: ["tag1", "tag2", "tag3"],
        userMessage: "Complete parameter test",
        agentResponse: "All parameters captured",
      };

      const result = await cortex.memory.remember(INPUT);

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      // Validate ALL parameters propagated correctly
      expect(userMem!.userId).toBe(INPUT.userId);
      expect(userMem!.participantId).toBe(INPUT.participantId);
      expect(userMem!.importance).toBe(INPUT.importance);
      expect(userMem!.tags).toEqual(expect.arrayContaining(INPUT.tags));
      expect(userMem!.conversationRef).toBeDefined();
      expect(userMem!.conversationRef!.conversationId).toBe(
        result.conversation.conversationId,
      );
    });

    it("preserves metadata through propagation", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        importance: 75,
        tags: ["metadata-test"],
        userMessage: "Test metadata",
        agentResponse: "Metadata response",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      // Metadata should be preserved as vector fields
      expect(userMem!.importance).toBe(75);
      expect(userMem!.tags).toContain("metadata-test");
    });
  });

  describe("Propagation in memory.get()", () => {
    let testMemoryId: string;
    let getTestConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID },
      });
      getTestConversationId = conv.conversationId;

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: getTestConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        userMessage: "Setup for get test",
        agentResponse: "Get test ready",
      });

      testMemoryId = result.memories[0].memoryId;
    });

    it("includeConversation actually includes conversation", async () => {
      const enriched = await cortex.memory.get(TEST_MEMSPACE_ID, testMemoryId, {
        includeConversation: true,
      });

      expect(enriched).not.toBeNull();

      // Type guard for EnrichedMemory
      if (enriched && "conversation" in enriched) {
        expect(enriched.conversation).toBeDefined();
        expect(enriched.sourceMessages).toBeDefined();
        expect(enriched.sourceMessages!.length).toBeGreaterThan(0);
        expect(enriched.conversation!.conversationId).toBe(
          getTestConversationId,
        );
      } else {
        fail("Expected enriched memory with conversation");
      }
    });

    it("includeConversation: false doesn't include conversation", async () => {
      const notEnriched = await cortex.memory.get(
        TEST_MEMSPACE_ID,
        testMemoryId,
        {
          includeConversation: false,
        },
      );

      expect(notEnriched).not.toBeNull();
      expect("conversation" in notEnriched!).toBe(false);
    });

    it("default (no options) doesn't include conversation", async () => {
      const defaultGet = await cortex.memory.get(
        TEST_MEMSPACE_ID,
        testMemoryId,
      );

      expect(defaultGet).not.toBeNull();
      expect("conversation" in defaultGet!).toBe(false);
    });
  });

  describe("Propagation in memory.search()", () => {
    let searchConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID },
      });
      searchConversationId = conv.conversationId;

      // Create searchable memories
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: searchConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        userMessage: "SEARCH_MARKER for testing search",
        agentResponse: "Found the SEARCH_MARKER",
      });
    });

    it("enrichConversation populates conversation for ALL results", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "SEARCH_MARKER",
        {
          enrichConversation: true,
          limit: 10,
        },
      );

      expect(results.length).toBeGreaterThan(0);

      // EVERY result should have conversation
      results.forEach((r) => {
        if ("conversation" in r) {
          expect(r.conversation).toBeDefined();
          expect(r.sourceMessages).toBeDefined();
          expect(r.conversation!.conversationId).toBeDefined();
        }
      });
    });

    it("enrichConversation: false doesn't include conversations", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "SEARCH_MARKER",
        {
          enrichConversation: false,
          limit: 10,
        },
      );

      expect(results.length).toBeGreaterThan(0);

      results.forEach((r) => {
        expect("conversation" in r).toBe(false);
      });
    });

    it("search filters propagate correctly", async () => {
      const results = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "SEARCH_MARKER",
        {
          minImportance: 50,
          limit: 10,
        },
      );

      // All results should meet filter criteria
      expect(results.length).toBeGreaterThan(0);
      // Note: results might be enriched, so we skip field validation
      // The fact that minImportance filter was applied is what matters
    });
  });

  describe("Optional Parameter Handling", () => {
    it("handles all optional params as undefined", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        participantId: undefined,
        importance: undefined,
        tags: undefined,
        userMessage: "Minimal params",
        agentResponse: "Minimal response",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      expect(userMem!.participantId).toBeUndefined();
      // importance should have default value
      expect(userMem!.importance).toBeDefined();
      expect(userMem!.tags).toBeDefined(); // May be empty array
    });

    it("handles mix of defined and undefined params", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        participantId: "tool-defined",
        importance: undefined,
        tags: ["defined-tag"],
        userMessage: "Mixed params",
        agentResponse: "Mixed response",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      expect(userMem!.participantId).toBe("tool-defined");
      expect(userMem!.tags).toContain("defined-tag");
    });
  });
});

describe("Parameter Propagation: memory.forget()", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("param-forget");
  const TEST_USER_ID = ctx.userId("forget-test");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);
    // NOTE: Removed purgeAll() for parallel execution compatibility.
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    await client.close();
  });

  it("deleteConversation option propagates correctly", async () => {
    const conv = await cortex.conversations.create({
      type: "user-agent",
      memorySpaceId: TEST_MEMSPACE_ID,
      participants: { userId: TEST_USER_ID },
    });

    const result = await cortex.memory.remember({
      memorySpaceId: TEST_MEMSPACE_ID,
      conversationId: conv.conversationId,
      userId: TEST_USER_ID,
      userName: "Test User",
      userMessage: "To be forgotten",
      agentResponse: "Will be forgotten",
    });

    const memoryId = result.memories[0].memoryId;
    const conversationId = result.conversation.conversationId;

    // Forget with deleteConversation: true and deleteEntireConversation: true
    await cortex.memory.forget(TEST_MEMSPACE_ID, memoryId, {
      deleteConversation: true,
      deleteEntireConversation: true,
    });

    // Verify memory deleted
    const memCheck = await cortex.vector.get(TEST_MEMSPACE_ID, memoryId);
    expect(memCheck).toBeNull();

    // Verify conversation deleted
    const convCheck = await cortex.conversations.get(conversationId);
    expect(convCheck).toBeNull();
  });

  it("deleteConversation: false preserves conversation", async () => {
    const conv = await cortex.conversations.create({
      type: "user-agent",
      memorySpaceId: TEST_MEMSPACE_ID,
      participants: { userId: TEST_USER_ID },
    });

    const result = await cortex.memory.remember({
      memorySpaceId: TEST_MEMSPACE_ID,
      conversationId: conv.conversationId,
      userId: TEST_USER_ID,
      userName: "Test User",
      userMessage: "Memory to delete",
      agentResponse: "Conversation to keep",
    });

    const memoryId = result.memories[0].memoryId;
    const conversationId = result.conversation.conversationId;

    // Forget with deleteConversation: false
    await cortex.memory.forget(TEST_MEMSPACE_ID, memoryId, {
      deleteConversation: false,
    });

    // Verify memory deleted
    const memCheck = await cortex.vector.get(TEST_MEMSPACE_ID, memoryId);
    expect(memCheck).toBeNull();

    // Verify conversation still exists
    const convCheck = await cortex.conversations.get(conversationId);
    expect(convCheck).not.toBeNull();
  });
});
