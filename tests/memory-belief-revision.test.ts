/**
 * Unit Tests: Memory API with Belief Revision
 *
 * Tests the belief revision integration in remember() for intelligent
 * fact management (CREATE/UPDATE/SUPERSEDE/NONE actions).
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Memory API with Belief Revision", () => {
  let cortex: Cortex;
  let _cleanup: TestCleanup;

  // Use ctx-scoped IDs for parallel execution isolation
  const testMemorySpaceId = ctx.memorySpaceId("belief-revision");
  const testConversationId = ctx.conversationId("belief");
  const testUserId = ctx.userId("belief");
  const testAgentId = ctx.agentId("belief");
  const testUserName = "Test User";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL || "" });
    const client = new ConvexClient(process.env.CONVEX_URL || "");
    _cleanup = new TestCleanup(client);
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() for parallel execution compatibility.
  });

  describe("Belief Revision Disabled Path", () => {
    test("remember() should use deduplication when beliefRevision: false", async () => {
      const convId = `${testConversationId}-dedup-path`;

      // Create conversation first
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

      const extractFacts = async (_userMsg: string, _agentMsg: string) => {
        return [
          {
            fact: "User prefers blue color",
            factType: "preference" as const,
            subject: testUserId,
            predicate: "favorite color",
            object: "blue",
            confidence: 90,
            tags: ["color", "preference"],
          },
        ];
      };

      // Explicitly disable belief revision
      const result = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "My favorite color is blue",
          agentResponse: "I'll remember that blue is your favorite color!",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts,
        },
        { beliefRevision: false },
      );

      expect(result.facts).toBeDefined();
      expect(result.facts.length).toBe(1);
      expect(result.facts[0].fact).toBe("User prefers blue color");

      // factRevisions should NOT be present when belief revision is disabled
      expect(result.factRevisions).toBeUndefined();
    });

    test("remember() should store facts using deduplication path when beliefRevision explicitly disabled", async () => {
      // This test verifies deduplication path works correctly when belief revision is disabled
      const convId = `${testConversationId}-no-llm`;

      // Create conversation first
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

      const extractFacts = async (_userMsg: string, _agentMsg: string) => {
        return [
          {
            fact: "User likes hiking",
            factType: "preference" as const,
            subject: testUserId,
            predicate: "likes",
            object: "hiking",
            confidence: 85,
            tags: ["outdoor", "activity"],
          },
        ];
      };

      // Explicitly disable belief revision
      const result = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "I love hiking in the mountains",
          agentResponse: "Hiking is a great outdoor activity!",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts,
        },
        { beliefRevision: false },
      );

      expect(result.facts).toBeDefined();
      expect(result.facts.length).toBe(1);

      // factRevisions should NOT be present when belief revision is disabled
      expect(result.factRevisions).toBeUndefined();
    });
  });

  describe("FactsAPI hasBeliefRevision()", () => {
    test("hasBeliefRevision() returns consistent value based on LLM config", async () => {
      // Note: hasBeliefRevision() may return true if CORTEX_FACT_EXTRACTION=true 
      // and OPENAI_API_KEY is set in the environment (auto-configuration)
      const hasRevision = (cortex as any).memory.facts.hasBeliefRevision();
      
      // Value should be boolean
      expect(typeof hasRevision).toBe("boolean");
    });

    test("hasBeliefRevision() should return true when LLM is configured", async () => {
      // Create Cortex with LLM config
      const cortexWithLLM = new Cortex({
        convexUrl: process.env.CONVEX_URL || "",
        llm: {
          provider: "openai",
          apiKey: "test-api-key", // Won't be used in this test
        },
      });

      // Access internal facts API
      const factsHasRevision = (cortexWithLLM as any).memory.facts.hasBeliefRevision();
      expect(factsHasRevision).toBe(true);
    });
  });

  describe("RememberResult Type Validation", () => {
    test("RememberResult should include factRevisions field type", async () => {
      const convId = `${testConversationId}-type-check`;

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

      const extractFacts = async (_userMsg: string, _agentMsg: string) => {
        return [
          {
            fact: "User speaks English",
            factType: "identity" as const,
            subject: testUserId,
            predicate: "speaks",
            object: "English",
            confidence: 100,
            tags: ["language"],
          },
        ];
      };

      const result = await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId: convId,
        userMessage: "I speak English fluently",
        agentResponse: "Great, we can communicate in English!",
        userId: testUserId,
        userName: testUserName,
        agentId: testAgentId,
        participantId: testAgentId,
        extractFacts,
      });

      // Type check: factRevisions should be optional array or undefined
      expect(
        result.factRevisions === undefined ||
        Array.isArray(result.factRevisions)
      ).toBe(true);

      // If present, each revision should have required fields
      if (result.factRevisions) {
        for (const revision of result.factRevisions) {
          expect(["ADD", "UPDATE", "SUPERSEDE", "NONE"]).toContain(revision.action);
          expect(revision.fact).toBeDefined();
          expect(revision.fact.factId).toBeDefined();
        }
      }
    });
  });

  describe("Fact Extraction with Deduplication Fallback", () => {
    test("should store multiple facts when no conflicts exist", async () => {
      const convId = `${testConversationId}-multi-facts`;

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

      const extractFacts = async (_userMsg: string, _agentMsg: string) => {
        return [
          {
            fact: "User name is John",
            factType: "identity" as const,
            subject: testUserId,
            predicate: "name",
            object: "John",
            confidence: 100,
            tags: ["identity"],
          },
          {
            fact: "User works as engineer",
            factType: "identity" as const,
            subject: testUserId,
            predicate: "occupation",
            object: "engineer",
            confidence: 90,
            tags: ["work"],
          },
          {
            fact: "User enjoys coffee",
            factType: "preference" as const,
            subject: testUserId,
            predicate: "enjoys",
            object: "coffee",
            confidence: 85,
            tags: ["food", "beverage"],
          },
        ];
      };

      const result = await cortex.memory.remember(
        {
          memorySpaceId: testMemorySpaceId,
          conversationId: convId,
          userMessage: "Hi, I'm John. I work as an engineer and I love coffee.",
          agentResponse: "Nice to meet you, John! I'll remember you're an engineer who loves coffee.",
          userId: testUserId,
          userName: testUserName,
          agentId: testAgentId,
          participantId: testAgentId,
          extractFacts,
        },
        { beliefRevision: false }, // Use deduplication path
      );

      expect(result.facts).toBeDefined();
      expect(result.facts.length).toBe(3);

      // Verify all facts were stored
      const factTexts = result.facts.map((f) => f.fact);
      expect(factTexts).toContain("User name is John");
      expect(factTexts).toContain("User works as engineer");
      expect(factTexts).toContain("User enjoys coffee");
    });
  });

  describe("Skip Facts Layer", () => {
    test("should not store facts when skipLayers includes 'facts'", async () => {
      const convId = `${testConversationId}-skip-facts`;

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

      const extractFacts = async (_userMsg: string, _agentMsg: string) => {
        return [
          {
            fact: "This fact should not be stored",
            factType: "observation" as const,
            subject: testUserId,
            predicate: "test",
            object: "skip",
            confidence: 100,
            tags: ["skip-test"],
          },
        ];
      };

      const result = await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId: convId,
        userMessage: "Test message",
        agentResponse: "Test response",
        userId: testUserId,
        userName: testUserName,
        agentId: testAgentId,
        participantId: testAgentId,
        extractFacts,
        skipLayers: ["facts"],
      });

      // Facts should be empty when layer is skipped
      expect(result.facts).toBeDefined();
      expect(result.facts.length).toBe(0);
      expect(result.factRevisions).toBeUndefined();
    });
  });
});
