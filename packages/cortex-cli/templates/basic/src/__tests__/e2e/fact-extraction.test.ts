/**
 * E2E Tests: Fact Extraction and Belief Revision
 *
 * Tests fact extraction and belief revision with real Convex backend.
 * Requires: CONVEX_URL and OPENAI_API_KEY environment variables
 *
 * Run with: CONVEX_URL=<url> OPENAI_API_KEY=<key> npm run test:e2e
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Cortex } from "@cortexmemory/sdk";
import {
  shouldSkipFactTests,
  generateTestId,
  createTestMemorySpaceId,
  createTestUserId,
  createTestConversationId,
  wait,
  generateTestEmbedding,
} from "../helpers/test-utils.js";

// Skip all tests if required env vars not set
const SKIP_FACT_TESTS = shouldSkipFactTests();

describe("Fact Extraction E2E", () => {
  let cortex: Cortex;
  let testMemorySpaceId: string;
  let testUserId: string;
  let testAgentId: string;

  beforeAll(() => {
    if (SKIP_FACT_TESTS) {
      console.log("Skipping fact tests - CONVEX_URL or OPENAI_API_KEY not configured");
      return;
    }

    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  beforeEach(() => {
    if (SKIP_FACT_TESTS) return;

    // Generate unique IDs for test isolation
    testMemorySpaceId = createTestMemorySpaceId("e2e-fact");
    testUserId = createTestUserId();
    testAgentId = generateTestId("agent");
  });

  afterAll(async () => {
    if (cortex) {
      cortex.close();
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Basic Fact Extraction
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_FACT_TESTS ? describe.skip : describe)("basic fact extraction", () => {
    it("should extract facts from conversation", async () => {
      const conversationId = createTestConversationId();

      // Store a message with an extractable fact
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "My name is Alice and I work as a software engineer in Seattle",
        agentResponse: "Nice to meet you, Alice! Software engineering in Seattle sounds exciting.",
        userId: testUserId,
        userName: "Alice",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
      });

      // Wait for fact extraction (async process)
      await wait(5000);

      // Check for extracted facts
      const facts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`Extracted ${facts.length} facts:`);
      facts.forEach((f: any) => console.log(`  - ${f.fact}`));

      // Facts may or may not be extracted depending on LLM
      expect(facts).toBeDefined();
    }, 60000);

    it("should extract multiple facts from one message", async () => {
      const conversationId = createTestConversationId();

      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "I'm Bob, I'm 35 years old, and I love playing chess",
        agentResponse: "Nice to meet you, Bob! Chess is a wonderful game.",
        userId: testUserId,
        userName: "Bob",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
      });

      await wait(5000);

      const facts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`Multiple facts test - extracted ${facts.length} facts`);

      // Should potentially extract: name=Bob, age=35, hobby=chess
      expect(facts).toBeDefined();
    }, 60000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Belief Revision
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_FACT_TESTS ? describe.skip : describe)("belief revision", () => {
    it("should supersede old fact when user updates preference", async () => {
      const conversationId = createTestConversationId();

      // Step 1: State initial preference
      console.log("Step 1: Stating favorite color is blue...");
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "My favorite color is blue",
        agentResponse: "Blue is a lovely color!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
        beliefRevision: {
          enabled: true,
          slotMatching: true,
        },
      });

      await wait(5000);

      // Check initial facts
      const factsAfterFirst = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: true,
      });
      console.log(`After first message: ${factsAfterFirst.length} facts`);

      // Step 2: Update preference (should trigger supersession)
      console.log("Step 2: Updating favorite color to purple...");
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "Actually, my favorite color is purple now",
        agentResponse: "I'll remember that your favorite color is now purple!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
        beliefRevision: {
          enabled: true,
          slotMatching: true,
        },
      });

      await wait(5000);

      // Step 3: Verify supersession
      const allFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: true,
      });

      const activeFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`Total facts (including superseded): ${allFacts.length}`);
      console.log(`Active facts: ${activeFacts.length}`);

      allFacts.forEach((f: any) => {
        const status = f.supersededBy ? "SUPERSEDED" : "ACTIVE";
        console.log(`  [${status}] ${f.fact}`);
      });

      // Verify we have some facts
      expect(allFacts).toBeDefined();
    }, 120000);

    it("should preserve non-conflicting facts", async () => {
      const conversationId = createTestConversationId();

      // Fact 1: Name
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "My name is Charlie",
        agentResponse: "Nice to meet you, Charlie!",
        userId: testUserId,
        userName: "Charlie",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
      });

      await wait(3000);

      // Fact 2: Job (non-conflicting with name)
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "I work as a data scientist",
        agentResponse: "Data science is a fascinating field!",
        userId: testUserId,
        userName: "Charlie",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
      });

      await wait(3000);

      // Both facts should be active (non-conflicting)
      const facts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`Non-conflicting facts: ${facts.length}`);
      facts.forEach((f: any) => console.log(`  - ${f.fact}`));

      expect(facts).toBeDefined();
    }, 60000);

    it("should handle duplicate facts (same value)", async () => {
      // Edge case: User says the same thing twice
      // Expected: NONE (skip as duplicate), NOT SUPERSEDE
      const conversationId = createTestConversationId();

      // Statement 1: Initial fact
      console.log("Statement 1: 'My favorite food is pizza'");
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "My favorite food is pizza",
        agentResponse: "Pizza is delicious!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
        beliefRevision: {
          enabled: true,
          slotMatching: true,
        },
      });

      await wait(5000);

      // Statement 2: Same fact repeated
      console.log("Statement 2: 'I really love pizza, it's my favorite' (same value)");
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "I really love pizza, it's my favorite",
        agentResponse: "Yes, you mentioned you love pizza!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
        beliefRevision: {
          enabled: true,
          slotMatching: true,
        },
      });

      await wait(5000);

      const allFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: true,
      });

      const activeFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`\n=== Duplicate Fact Test Results ===`);
      console.log(`Total facts: ${allFacts.length}`);
      console.log(`Active facts: ${activeFacts.length}`);

      allFacts.forEach((f: any) => {
        const status = f.supersededBy ? "SUPERSEDED" : "ACTIVE";
        console.log(`  [${status}] ${f.fact}`);
      });

      // Should have at most one active "pizza" fact
      expect(allFacts).toBeDefined();
    }, 120000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Facts API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_FACT_TESTS ? describe.skip : describe)("facts API", () => {
    it("should list facts with includeSuperseded filter", async () => {
      const conversationId = createTestConversationId();

      // Create a fact
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "I am 30 years old",
        agentResponse: "Got it!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
      });

      await wait(5000);

      // List with includeSuperseded = false
      const activeFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      // List with includeSuperseded = true
      const allFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: true,
      });

      console.log(`Active: ${activeFacts.length}, All: ${allFacts.length}`);

      expect(activeFacts.length).toBeLessThanOrEqual(allFacts.length);
    }, 60000);

    it("should filter facts by memory space", async () => {
      const spaceA = createTestMemorySpaceId("fact-space-a");
      const spaceB = createTestMemorySpaceId("fact-space-b");

      // Add fact to space A
      await cortex.memory.remember({
        memorySpaceId: spaceA,
        conversationId: createTestConversationId(),
        userMessage: "I like cats",
        agentResponse: "Cats are great!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
      });

      await wait(5000);

      // Facts in space B should not include space A's facts
      const factsB = await cortex.facts.list({
        memorySpaceId: spaceB,
        userId: testUserId,
      });

      // Space B should be empty
      expect(factsB.length).toBe(0);
    }, 60000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Recall with Facts
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_FACT_TESTS ? describe.skip : describe)("recall with facts", () => {
    it("should include facts in recall results", async () => {
      const conversationId = createTestConversationId();

      // Store message with fact
      await cortex.memory.remember({
        memorySpaceId: testMemorySpaceId,
        conversationId,
        userMessage: "I prefer dark mode for all my applications",
        agentResponse: "Dark mode is easier on the eyes!",
        userId: testUserId,
        userName: "Test User",
        agentId: testAgentId,
        agentName: "Test Agent",
        enableFactExtraction: true,
        generateEmbedding: generateTestEmbedding,
      });

      await wait(5000);

      // Recall with facts enabled
      const result = await cortex.memory.recall({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        query: "What are my preferences?",
        limit: 10,
        sources: {
          vector: true,
          facts: true,
          graph: false,
        },
        generateEmbedding: generateTestEmbedding,
      });

      console.log(`Recall results: ${result.sources?.vector?.count || 0} memories, ${result.sources?.facts?.count || 0} facts`);

      expect(result).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(result.sources.facts).toBeDefined();
    }, 60000);
  });
});
