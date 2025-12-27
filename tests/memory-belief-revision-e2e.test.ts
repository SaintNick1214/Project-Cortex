/**
 * E2E Tests: Memory API Belief Revision Workflows
 *
 * End-to-end tests for the complete belief revision flow with
 * real Convex backend and mock LLM responses.
 *
 * Tests scenarios:
 * - Color preference changes (SUPERSEDE)
 * - Employment updates (SUPERSEDE)
 * - Fact refinement (UPDATE)
 * - Duplicate detection (NONE)
 * - New fact addition (ADD)
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Memory Belief Revision E2E Workflows", () => {
  let cortex: Cortex;
  let _cleanup: TestCleanup;

  // Use ctx-scoped IDs for parallel execution isolation
  const testMemorySpaceId = ctx.memorySpaceId("br-e2e");
  const testUserId = ctx.userId("br-e2e");
  const testAgentId = ctx.agentId("br-e2e");
  const testUserName = "Test User";

  beforeAll(async () => {
    // Note: For full E2E tests with actual belief revision,
    // you would configure Cortex with a real LLM API key.
    // These tests use the deduplication fallback path.
    cortex = new Cortex({
      convexUrl: process.env.CONVEX_URL || "",
    });
    const client = new ConvexClient(process.env.CONVEX_URL || "");
    _cleanup = new TestCleanup(client);
  });

  afterAll(async () => {
    // Cleanup handled per-test for parallel execution
  });

  describe("Color Preference Change Workflow", () => {
    test("should store initial color preference and subsequent change", async () => {
      const convId = `${ctx.conversationId("color")}-workflow`;

      // Create conversation
      await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: testMemorySpaceId,
        participants: {
          userId: testUserId,
          agentId: testAgentId,
          participantId: testAgentId,
        },
      });

      // Step 1: Store initial color preference (blue)
      const extractBlue = async () => [
        {
          fact: "User's favorite color is blue",
          factType: "preference" as const,
          subject: testUserId,
          predicate: "favorite color",
          object: "blue",
          confidence: 90,
          tags: ["color", "preference"],
        },
      ];

      const result1 = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "My favorite color is blue",
          agentResponse: "I'll remember that blue is your favorite color!",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts: extractBlue,
        },
        { beliefRevision: false },
      );

      expect(result1.facts.length).toBe(1);
      expect(result1.facts[0].fact).toBe("User's favorite color is blue");

      // Step 2: Store new color preference (purple)
      const extractPurple = async () => [
        {
          fact: "User's favorite color is purple",
          factType: "preference" as const,
          subject: testUserId,
          predicate: "favorite color",
          object: "purple",
          confidence: 95,
          tags: ["color", "preference"],
        },
      ];

      const result2 = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "Actually, I now prefer purple",
          agentResponse: "Updated! Purple is now your favorite color.",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts: extractPurple,
        },
        { beliefRevision: false },
      );

      expect(result2.facts.length).toBe(1);
      expect(result2.facts[0].fact).toBe("User's favorite color is purple");

      // Both facts should exist in the system (dedup path doesn't supersede)
      const allFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        subject: testUserId,
      });

      const colorFacts = allFacts.filter((f) =>
        f.fact.includes("favorite color"),
      );
      expect(colorFacts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Employment Update Workflow", () => {
    test("should store job changes over time", async () => {
      const convId = `${ctx.conversationId("job")}-workflow`;

      await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: testMemorySpaceId,
        participants: {
          userId: testUserId,
          agentId: testAgentId,
          participantId: testAgentId,
        },
      });

      // First job: Acme Corp
      const extractJob1 = async () => [
        {
          fact: "User works at Acme Corp",
          factType: "identity" as const,
          subject: testUserId,
          predicate: "works at",
          object: "Acme Corp",
          confidence: 95,
          tags: ["employment", "work"],
        },
      ];

      const result1 = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "I just started at Acme Corp",
          agentResponse: "Congratulations on the new job at Acme Corp!",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts: extractJob1,
        },
        { beliefRevision: false },
      );

      expect(result1.facts[0].fact).toBe("User works at Acme Corp");

      // New job: TechStartup Inc
      const extractJob2 = async () => [
        {
          fact: "User works at TechStartup Inc",
          factType: "identity" as const,
          subject: testUserId,
          predicate: "works at",
          object: "TechStartup Inc",
          confidence: 95,
          tags: ["employment", "work"],
        },
      ];

      const result2 = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "I switched to TechStartup Inc",
          agentResponse: "Good luck at TechStartup Inc!",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts: extractJob2,
        },
        { beliefRevision: false },
      );

      expect(result2.facts[0].fact).toBe("User works at TechStartup Inc");
    });
  });

  describe("Fact Refinement Workflow", () => {
    test("should store progressive fact refinement", async () => {
      const convId = `${ctx.conversationId("pet")}-workflow`;

      await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: testMemorySpaceId,
        participants: {
          userId: testUserId,
          agentId: testAgentId,
          participantId: testAgentId,
        },
      });

      // Basic pet fact
      const extractPet1 = async () => [
        {
          fact: "User has a dog",
          factType: "identity" as const,
          subject: testUserId,
          predicate: "has pet",
          object: "dog",
          confidence: 90,
          tags: ["pet"],
        },
      ];

      const result1 = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "I have a dog",
          agentResponse: "Dogs are wonderful companions!",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts: extractPet1,
        },
        { beliefRevision: false },
      );

      expect(result1.facts[0].fact).toBe("User has a dog");

      // Refined pet fact with name
      const extractPet2 = async () => [
        {
          fact: "User has a dog named Max",
          factType: "identity" as const,
          subject: testUserId,
          predicate: "has pet",
          object: "dog named Max",
          confidence: 95,
          tags: ["pet"],
        },
      ];

      const result2 = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "His name is Max",
          agentResponse: "Max is a great name for a dog!",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts: extractPet2,
        },
        { beliefRevision: false },
      );

      expect(result2.facts[0].fact).toBe("User has a dog named Max");
    });
  });

  describe("Multiple Facts Mixed Actions", () => {
    test("should handle multiple facts in single remember() call", async () => {
      const convId = `${ctx.conversationId("multi")}-workflow`;

      await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: testMemorySpaceId,
        participants: {
          userId: testUserId,
          agentId: testAgentId,
          participantId: testAgentId,
        },
      });

      // Multiple facts at once
      const extractMultiple = async () => [
        {
          fact: "User is 30 years old",
          factType: "identity" as const,
          subject: testUserId,
          predicate: "age",
          object: "30",
          confidence: 100,
          tags: ["age", "identity"],
        },
        {
          fact: "User lives in San Francisco",
          factType: "identity" as const,
          subject: testUserId,
          predicate: "lives in",
          object: "San Francisco",
          confidence: 95,
          tags: ["location"],
        },
        {
          fact: "User enjoys reading",
          factType: "preference" as const,
          subject: testUserId,
          predicate: "enjoys",
          object: "reading",
          confidence: 85,
          tags: ["hobby"],
        },
      ];

      const result = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage:
            "I'm 30, live in San Francisco, and love reading in my spare time",
          agentResponse:
            "Thanks for sharing! You're 30, based in SF, and enjoy reading.",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts: extractMultiple,
        },
        { beliefRevision: false },
      );

      expect(result.facts.length).toBe(3);

      const factTexts = result.facts.map((f) => f.fact);
      expect(factTexts).toContain("User is 30 years old");
      expect(factTexts).toContain("User lives in San Francisco");
      expect(factTexts).toContain("User enjoys reading");
    });
  });

  describe("Empty Fact Extraction", () => {
    test("should handle empty fact extraction gracefully", async () => {
      const convId = `${ctx.conversationId("empty")}-workflow`;

      await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: testMemorySpaceId,
        participants: {
          userId: testUserId,
          agentId: testAgentId,
          participantId: testAgentId,
        },
      });

      // No facts to extract
      const extractEmpty = async () => [];

      const result = await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId: convId,
        userMessage: "Hello there!",
        agentResponse: "Hi! How can I help you?",
        userId: testUserId,
        userName: testUserName,
        agentId: testAgentId,
        participantId: testAgentId,
        extractFacts: extractEmpty,
      });

      // Should complete successfully with no facts
      expect(result.facts).toBeDefined();
      expect(result.facts.length).toBe(0);
      expect(result.factRevisions).toBeUndefined();
    });

    test("should handle null fact extraction gracefully", async () => {
      const convId = `${ctx.conversationId("null")}-workflow`;

      await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: testMemorySpaceId,
        participants: {
          userId: testUserId,
          agentId: testAgentId,
          participantId: testAgentId,
        },
      });

      // Null return from extractor
      const extractNull = async () => null as any;

      const result = await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId: convId,
        userMessage: "Testing null",
        agentResponse: "Processing...",
        userId: testUserId,
        userName: testUserName,
        agentId: testAgentId,
        participantId: testAgentId,
        extractFacts: extractNull,
      });

      // Should complete successfully with no facts
      expect(result.facts).toBeDefined();
      expect(result.facts.length).toBe(0);
    });
  });
});
