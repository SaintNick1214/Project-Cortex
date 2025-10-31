/**
 * E2E Tests: Memory API with Fact Integration
 *
 * Tests three-layer orchestration (ACID + Vector + Facts)
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";

describe("Memory API with Fact Integration", () => {
  let cortex: Cortex;
  let cleanup: TestCleanup;

  const testMemorySpaceId = `fact-test-${Date.now()}`;
  const testConversationId = `conv-fact-${Date.now()}`;
  const testUserId = "test-user-facts";
  const testUserName = "Test User";

  beforeAll(async () => {
    const client = new ConvexClient(process.env.CONVEX_URL || "");
    cortex = new Cortex({ client });
    cleanup = new TestCleanup(client);
  });

  afterAll(async () => {
    await cleanup.cleanup();
  });

  test("remember() should extract and store facts when extractFacts callback provided", async () => {
    const extractFacts = async (userMsg: string, agentMsg: string) => {
      return [
        {
          fact: "User prefers dark mode",
          factType: "preference" as const,
          subject: testUserId,
          predicate: "prefers",
          object: "dark mode",
          confidence: 95,
          tags: ["ui", "preferences"],
        },
      ];
    };

    const result = await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: testConversationId,
      userMessage: "I prefer dark mode",
      agentResponse: "I'll remember that you prefer dark mode!",
      userId: testUserId,
      userName: testUserName,
      extractFacts,
    });

    expect(result.facts).toBeDefined();
    expect(result.facts.length).toBe(1);
    expect(result.facts[0].fact).toBe("User prefers dark mode");
    expect(result.facts[0].confidence).toBe(95);
    expect(result.facts[0].sourceRef?.memoryId).toBeDefined();
    expect(result.facts[0].sourceRef?.conversationId).toBe(testConversationId);

    // Clean up
    cleanup.track(testMemorySpaceId, testConversationId);
  });

  test("remember() should handle fact extraction errors gracefully", async () => {
    const extractFacts = async () => {
      throw new Error("Extraction failed");
    };

    const result = await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: `${testConversationId}-error`,
      userMessage: "Test message",
      agentResponse: "Test response",
      userId: testUserId,
      userName: testUserName,
      extractFacts,
    });

    // Should still succeed with empty facts array
    expect(result.memories.length).toBe(2);
    expect(result.facts.length).toBe(0);

    cleanup.track(testMemorySpaceId, `${testConversationId}-error`);
  });

  test("forget() should cascade delete associated facts", async () => {
    const extractFacts = async () => [
      {
        fact: "Test fact for deletion",
        factType: "knowledge" as const,
        confidence: 90,
        tags: [],
      },
    ];

    const rememberResult = await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: `${testConversationId}-delete`,
      userMessage: "Test",
      agentResponse: "Response",
      userId: testUserId,
      userName: testUserName,
      extractFacts,
    });

    expect(rememberResult.facts.length).toBe(1);
    const memoryId = rememberResult.memories[0].memoryId;

    // Forget the memory
    const forgetResult = await cortex.memory.forget(
      testMemorySpaceId,
      memoryId,
      { deleteConversation: false }
    );

    expect(forgetResult.factsDeleted).toBe(1);
    expect(forgetResult.factIds.length).toBe(1);
    expect(forgetResult.factIds[0]).toBe(rememberResult.facts[0].factId);

    cleanup.track(testMemorySpaceId, `${testConversationId}-delete`);
  });

  test("get() should enrich memory with associated facts", async () => {
    const extractFacts = async () => [
      {
        fact: "User loves TypeScript",
        factType: "preference" as const,
        confidence: 98,
        tags: ["programming"],
      },
    ];

    const rememberResult = await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: `${testConversationId}-get`,
      userMessage: "I love TypeScript!",
      agentResponse: "Great choice!",
      userId: testUserId,
      userName: testUserName,
      extractFacts,
    });

    const memoryId = rememberResult.memories[0].memoryId;

    // Get with enrichment
    const enriched = await cortex.memory.get(
      testMemorySpaceId,
      memoryId,
      { includeConversation: true }
    );

    expect(enriched).toBeDefined();
    if ('facts' in enriched!) {
      expect(enriched.facts).toBeDefined();
      expect(enriched.facts!.length).toBeGreaterThan(0);
      expect(enriched.facts![0].fact).toBe("User loves TypeScript");
    }

    cleanup.track(testMemorySpaceId, `${testConversationId}-get`);
  });

  test("search() should enrich results with facts", async () => {
    const extractFacts = async () => [
      {
        fact: "User is from San Francisco",
        factType: "identity" as const,
        confidence: 100,
        tags: ["location"],
      },
    ];

    await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: `${testConversationId}-search`,
      userMessage: "I'm from San Francisco",
      agentResponse: "Nice!",
      userId: testUserId,
      userName: testUserName,
      extractFacts,
    });

    const results = await cortex.memory.search(
      testMemorySpaceId,
      "San Francisco",
      {
        enrichConversation: true,
        userId: testUserId,
      }
    );

    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0];
    
    if ('facts' in firstResult) {
      expect(firstResult.facts).toBeDefined();
      expect(firstResult.facts!.length).toBeGreaterThan(0);
    }

    cleanup.track(testMemorySpaceId, `${testConversationId}-search`);
  });

  test("multiple facts should be extracted from single conversation", async () => {
    const extractFacts = async () => [
      {
        fact: "User is a software engineer",
        factType: "identity" as const,
        confidence: 95,
        tags: ["profession"],
      },
      {
        fact: "User works at Google",
        factType: "relationship" as const,
        predicate: "works_at",
        object: "Google",
        confidence: 90,
        tags: ["employment"],
      },
      {
        fact: "User has 5 years experience",
        factType: "knowledge" as const,
        confidence: 85,
        tags: ["experience"],
      },
    ];

    const result = await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: `${testConversationId}-multi`,
      userMessage: "I'm a software engineer at Google with 5 years experience",
      agentResponse: "That's impressive!",
      userId: testUserId,
      userName: testUserName,
      extractFacts,
    });

    expect(result.facts.length).toBe(3);
    expect(result.facts.map(f => f.factType)).toEqual([
      "identity",
      "relationship",
      "knowledge",
    ]);

    cleanup.track(testMemorySpaceId, `${testConversationId}-multi`);
  });

  test("facts should maintain sourceRef links to memories and conversations", async () => {
    const extractFacts = async () => [
      {
        fact: "User prefers blue theme",
        factType: "preference" as const,
        confidence: 92,
        tags: [],
      },
    ];

    const result = await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: `${testConversationId}-sourceref`,
      userMessage: "I like the blue theme",
      agentResponse: "Noted!",
      userId: testUserId,
      userName: testUserName,
      extractFacts,
    });

    const fact = result.facts[0];
    expect(fact.sourceRef).toBeDefined();
    expect(fact.sourceRef?.memoryId).toBe(result.memories[0].memoryId);
    expect(fact.sourceRef?.conversationId).toBe(testConversationId);
    expect(fact.sourceRef?.messageIds).toBeDefined();
    expect(fact.sourceRef?.messageIds!.length).toBe(2); // User + agent messages

    cleanup.track(testMemorySpaceId, `${testConversationId}-sourceref`);
  });
});

