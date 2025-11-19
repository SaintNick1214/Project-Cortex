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
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL || "" });
    const client = new ConvexClient(process.env.CONVEX_URL || "");
    cleanup = new TestCleanup(client);
  });

  afterAll(async () => {
    await cleanup.purgeAll();
  });

  test("remember() should extract and store facts when extractFacts callback provided", async () => {
    // Create conversation first
    await cortex.conversations.create({
      conversationId: testConversationId,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: "agent-test" },
    });

    const extractFacts = async (_userMsg: string, _agentMsg: string) => {
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
      participantId: "agent-test", // Add participantId so we can test it propagates
      extractFacts,
    });

    expect(result.facts).toBeDefined();
    expect(result.facts.length).toBe(1);
    expect(result.facts[0].fact).toBe("User prefers dark mode");
    expect(result.facts[0].confidence).toBe(95);
    expect(result.facts[0].sourceRef?.memoryId).toBeDefined();
    expect(result.facts[0].sourceRef?.conversationId).toBe(testConversationId);

    // CRITICAL: Verify userId was propagated from remember() to facts.store()
    // This was a bug fixed in v0.9.2 - userId was missing!
    expect(result.facts[0].userId).toBe(testUserId);
    expect(result.facts[0].participantId).toBe("agent-test");
  });

  test("remember() should propagate ALL parameters from remember() to facts.store()", async () => {
    // REGRESSION TEST: Ensures all parameters are properly passed through
    // Bug found: userId was not being passed to facts.store() in SDK v0.9.1
    const specificConvId = `${testConversationId}-param-propagation`;
    const specificParticipantId = "agent-param-test";

    await cortex.conversations.create({
      conversationId: specificConvId,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: specificParticipantId },
    });

    const extractFacts = async () => [
      {
        fact: "Parameter propagation test fact",
        factType: "knowledge" as const,
        confidence: 88,
        tags: ["regression-test"],
      },
    ];

    const result = await cortex.memory.remember({
      memorySpaceId: testMemorySpaceId,
      conversationId: specificConvId,
      userMessage: "Test message for parameter propagation",
      agentResponse: "Acknowledged",
      userId: testUserId,
      userName: testUserName,
      participantId: specificParticipantId,
      tags: ["test-tag"],
      extractFacts,
    });

    expect(result.facts.length).toBe(1);
    const fact = result.facts[0];

    // Verify ALL parameters were properly propagated
    expect(fact.memorySpaceId).toBe(testMemorySpaceId);
    expect(fact.userId).toBe(testUserId); // ← This was the bug!
    expect(fact.participantId).toBe(specificParticipantId);
    expect(fact.sourceType).toBe("conversation");
    expect(fact.sourceRef?.conversationId).toBe(specificConvId);
    expect(fact.sourceRef?.memoryId).toBeDefined();
    expect(fact.sourceRef?.messageIds).toBeDefined();
    expect(fact.sourceRef?.messageIds!.length).toBe(2);

    // Now test that filtering by userId actually works
    const filteredFacts = await cortex.facts.list({
      memorySpaceId: testMemorySpaceId,
      userId: testUserId,
    });

    const foundFact = filteredFacts.find((f) => f.factId === fact.factId);
    expect(foundFact).toBeDefined();
    expect(foundFact!.userId).toBe(testUserId);
  });

  test("remember() should handle fact extraction errors gracefully", async () => {
    // Create conversation first
    await cortex.conversations.create({
      conversationId: `${testConversationId}-error`,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: "agent-test" },
    });

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
  });

  test("forget() should cascade delete associated facts", async () => {
    // Create conversation first
    await cortex.conversations.create({
      conversationId: `${testConversationId}-delete`,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: "agent-test" },
    });

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
      { deleteConversation: false },
    );

    expect(forgetResult.factsDeleted).toBe(1);
    expect(forgetResult.factIds.length).toBe(1);
    expect(forgetResult.factIds[0]).toBe(rememberResult.facts[0].factId);
  });

  test("get() should enrich memory with associated facts", async () => {
    // Create conversation first
    await cortex.conversations.create({
      conversationId: `${testConversationId}-get`,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: "agent-test" },
    });

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
    const enriched = await cortex.memory.get(testMemorySpaceId, memoryId, {
      includeConversation: true,
    });

    expect(enriched).toBeDefined();
    if ("facts" in enriched!) {
      expect(enriched.facts).toBeDefined();
      expect(enriched.facts!.length).toBeGreaterThan(0);
      expect(enriched.facts![0].fact).toBe("User loves TypeScript");
    }
  });

  test("search() should enrich results with facts", async () => {
    // Create conversation first
    await cortex.conversations.create({
      conversationId: `${testConversationId}-search`,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: "agent-test" },
    });

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
      },
    );

    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0];

    if ("facts" in firstResult) {
      expect(firstResult.facts).toBeDefined();
      expect(firstResult.facts!.length).toBeGreaterThan(0);
    }
  });

  test("multiple facts should be extracted from single conversation", async () => {
    // Create conversation first
    await cortex.conversations.create({
      conversationId: `${testConversationId}-multi`,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: "agent-test" },
    });

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
    expect(result.facts.map((f) => f.factType)).toEqual([
      "identity",
      "relationship",
      "knowledge",
    ]);
  });

  test("facts should maintain sourceRef links to memories and conversations", async () => {
    // Create conversation first
    await cortex.conversations.create({
      conversationId: `${testConversationId}-sourceref`,
      type: "user-agent",
      memorySpaceId: testMemorySpaceId,
      participants: { userId: testUserId, participantId: "agent-test" },
    });

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
    expect(fact.sourceRef?.conversationId).toBe(
      `${testConversationId}-sourceref`,
    );
    expect(fact.sourceRef?.messageIds).toBeDefined();
    expect(fact.sourceRef?.messageIds!.length).toBe(2); // User + agent messages
  });
});
