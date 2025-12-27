/**
 * E2E Tests: Facts Deduplication
 *
 * Tests validate:
 * - Cross-session fact deduplication
 * - Exact, structural, and semantic matching strategies
 * - Confidence-based updates
 * - Integration with memory.remember() and memory.rememberStream()
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext, ScopedCleanup } from "./helpers";
import { FactDeduplicationService } from "../src/facts/deduplication";

describe("Facts Deduplication", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("facts-dedup");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Use context generator for test memory space ID
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("dedup");

  beforeAll(async () => {
    console.log(`\n🧪 Facts Deduplication Tests - Run ID: ${ctx.runId}\n`);

    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    // Clean up only data created by this test run
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  describe("FactDeduplicationService - Unit Tests", () => {
    let dedupService: FactDeduplicationService;

    beforeAll(() => {
      dedupService = new FactDeduplicationService(client);
    });

    describe("resolveConfig()", () => {
      it("returns default semantic config when no config provided", () => {
        const config = FactDeduplicationService.resolveConfig(undefined);
        // Should fall back to structural since no generateEmbedding provided
        expect(config.strategy).toBe("structural");
      });

      it("converts string shorthand to config", () => {
        const config = FactDeduplicationService.resolveConfig("exact");
        expect(config.strategy).toBe("exact");
      });

      it("falls back to structural when semantic without embedding", () => {
        const config = FactDeduplicationService.resolveConfig({
          strategy: "semantic",
        });
        expect(config.strategy).toBe("structural");
      });

      it("keeps semantic when generateEmbedding is provided", () => {
        const mockEmbed = async (_text: string) => [0.1, 0.2, 0.3];
        const config = FactDeduplicationService.resolveConfig({
          strategy: "semantic",
          generateEmbedding: mockEmbed,
        });
        expect(config.strategy).toBe("semantic");
        expect(config.generateEmbedding).toBe(mockEmbed);
      });

      it("uses fallback embedding function when provided", () => {
        const fallbackEmbed = async (_text: string) => [0.1, 0.2, 0.3];
        const config = FactDeduplicationService.resolveConfig(
          { strategy: "semantic" },
          fallbackEmbed,
        );
        expect(config.strategy).toBe("semantic");
        expect(config.generateEmbedding).toBe(fallbackEmbed);
      });
    });

    describe("findDuplicate() - none strategy", () => {
      it("returns no duplicate when strategy is none", async () => {
        const result = await dedupService.findDuplicate(
          {
            fact: "User likes blue",
            factType: "preference",
            confidence: 90,
          },
          TEST_MEMSPACE_ID,
          { strategy: "none" },
        );

        expect(result.isDuplicate).toBe(false);
      });
    });
  });

  describe("storeWithDedup() - Exact Strategy", () => {
    const EXACT_MEMSPACE_ID = ctx.memorySpaceId("exact");

    it("stores first fact without finding duplicate", async () => {
      const result = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: EXACT_MEMSPACE_ID,
          fact: "User prefers dark mode",
          factType: "preference",
          subject: "user-123",
          confidence: 85,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "exact" },
        },
      );

      expect(result.fact).toBeDefined();
      expect(result.wasUpdated).toBe(false);
      expect(result.deduplication?.matchedExisting).toBe(false);
    });

    it("detects exact duplicate and returns existing fact", async () => {
      // Store initial fact
      const firstResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: EXACT_MEMSPACE_ID,
          fact: "User's name is Alice",
          factType: "identity",
          subject: "user-456",
          confidence: 90,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "exact" },
        },
      );

      // Try to store duplicate with same text
      const secondResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: EXACT_MEMSPACE_ID,
          fact: "User's name is Alice",
          factType: "identity",
          subject: "user-456",
          confidence: 80, // Lower confidence
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "exact" },
        },
      );

      expect(secondResult.deduplication?.matchedExisting).toBe(true);
      expect(secondResult.fact.factId).toBe(firstResult.fact.factId);
      expect(secondResult.wasUpdated).toBe(false); // Not updated since lower confidence
    });

    it("updates existing fact when new confidence is higher", async () => {
      // Use isolated memory space for this test to avoid cross-test interference
      const isolatedMemSpace = ctx.memorySpaceId("exact-update");
      const uniqueFact = `User works at TechCorp-${ctx.runId}`;

      // Store initial fact
      const firstResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: isolatedMemSpace,
          fact: uniqueFact,
          factType: "identity",
          subject: "user-update-test",
          confidence: 70,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "exact" },
        },
      );

      expect(firstResult.deduplication?.matchedExisting).toBe(false);

      // Store duplicate with higher confidence
      const secondResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: isolatedMemSpace,
          fact: uniqueFact,
          factType: "identity",
          subject: "user-update-test",
          confidence: 95, // Higher confidence
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "exact" },
        },
      );

      // Verify duplicate was detected
      expect(secondResult.deduplication?.matchedExisting).toBe(true);
      expect(secondResult.wasUpdated).toBe(true);

      // After update, verify only 1 fact exists with the higher confidence
      const facts = await cortex.facts.list({
        memorySpaceId: isolatedMemSpace,
        subject: "user-update-test",
      });

      expect(facts.length).toBe(1);
      expect(facts[0].confidence).toBe(95);
    });

    it("does not match different facts with exact strategy", async () => {
      // Store initial fact
      await cortex.facts.storeWithDedup(
        {
          memorySpaceId: EXACT_MEMSPACE_ID,
          fact: "User likes pizza",
          factType: "preference",
          subject: "user-food",
          confidence: 90,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "exact" },
        },
      );

      // Store different fact
      const secondResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: EXACT_MEMSPACE_ID,
          fact: "User loves pizza", // Different text
          factType: "preference",
          subject: "user-food",
          confidence: 90,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "exact" },
        },
      );

      expect(secondResult.deduplication?.matchedExisting).toBe(false);
      expect(secondResult.wasUpdated).toBe(false);
    });
  });

  describe("storeWithDedup() - Structural Strategy", () => {
    const STRUCT_MEMSPACE_ID = ctx.memorySpaceId("structural");

    it("detects structural duplicate by subject+predicate+object", async () => {
      // Store initial fact
      const firstResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: STRUCT_MEMSPACE_ID,
          fact: "Alice is friends with Bob",
          factType: "relationship",
          subject: "alice",
          predicate: "friends_with",
          object: "bob",
          confidence: 85,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      // Store fact with same structure but different text
      const secondResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: STRUCT_MEMSPACE_ID,
          fact: "Alice and Bob are friends", // Different text
          factType: "relationship",
          subject: "alice",
          predicate: "friends_with",
          object: "bob",
          confidence: 80,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      expect(secondResult.deduplication?.matchedExisting).toBe(true);
      expect(secondResult.fact.factId).toBe(firstResult.fact.factId);
    });

    it("does not match facts with different structure", async () => {
      // Store initial fact
      await cortex.facts.storeWithDedup(
        {
          memorySpaceId: STRUCT_MEMSPACE_ID,
          fact: "User prefers morning meetings",
          factType: "preference",
          subject: "user-meetings",
          predicate: "prefers",
          object: "morning",
          confidence: 90,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      // Store fact with different structure
      const secondResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: STRUCT_MEMSPACE_ID,
          fact: "User prefers evening meetings",
          factType: "preference",
          subject: "user-meetings",
          predicate: "prefers",
          object: "evening", // Different object
          confidence: 90,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      expect(secondResult.deduplication?.matchedExisting).toBe(false);
    });
  });

  describe("storeWithDedup() - Disabled Deduplication", () => {
    const NO_DEDUP_MEMSPACE_ID = ctx.memorySpaceId("nodedup");

    it("stores duplicate facts when deduplication is disabled", async () => {
      // Store first fact
      const firstResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: NO_DEDUP_MEMSPACE_ID,
          fact: "Duplicate fact test",
          factType: "knowledge",
          subject: "test-subject",
          confidence: 90,
          sourceType: "manual",
        },
        {
          deduplication: false,
        },
      );

      // Store duplicate with dedup disabled
      const secondResult = await cortex.facts.storeWithDedup(
        {
          memorySpaceId: NO_DEDUP_MEMSPACE_ID,
          fact: "Duplicate fact test",
          factType: "knowledge",
          subject: "test-subject",
          confidence: 90,
          sourceType: "manual",
        },
        {
          deduplication: false,
        },
      );

      // Should create two separate facts
      expect(secondResult.fact.factId).not.toBe(firstResult.fact.factId);
      expect(secondResult.wasUpdated).toBe(false);
    });
  });

  describe("Cross-Session Deduplication", () => {
    const CROSS_SESSION_MEMSPACE_ID = ctx.memorySpaceId("crosssession");

    it("prevents duplicate facts across multiple store calls", async () => {
      const factText = "User's favorite programming language is TypeScript";

      // Simulate session 1: Store fact
      await cortex.facts.storeWithDedup(
        {
          memorySpaceId: CROSS_SESSION_MEMSPACE_ID,
          fact: factText,
          factType: "preference",
          subject: "user-lang",
          predicate: "favorite_language",
          object: "typescript",
          confidence: 90,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      // Simulate session 2: Try to store same fact
      await cortex.facts.storeWithDedup(
        {
          memorySpaceId: CROSS_SESSION_MEMSPACE_ID,
          fact: factText,
          factType: "preference",
          subject: "user-lang",
          predicate: "favorite_language",
          object: "typescript",
          confidence: 85,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      // Simulate session 3: Try to store same fact again
      await cortex.facts.storeWithDedup(
        {
          memorySpaceId: CROSS_SESSION_MEMSPACE_ID,
          fact: factText,
          factType: "preference",
          subject: "user-lang",
          predicate: "favorite_language",
          object: "typescript",
          confidence: 80,
          sourceType: "conversation",
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      // Count facts - should only be 1
      const count = await cortex.facts.count({
        memorySpaceId: CROSS_SESSION_MEMSPACE_ID,
        subject: "user-lang",
      });

      expect(count).toBe(1);
    });
  });

  describe("Memory Space Isolation", () => {
    const SPACE_A = ctx.memorySpaceId("spaceA");
    const SPACE_B = ctx.memorySpaceId("spaceB");

    it("does not deduplicate across different memory spaces", async () => {
      const sharedFact = {
        fact: "User prefers email communication",
        factType: "preference" as const,
        subject: "user-comm",
        predicate: "prefers",
        object: "email",
        confidence: 90,
        sourceType: "conversation" as const,
      };

      // Store in space A
      const resultA = await cortex.facts.storeWithDedup(
        {
          ...sharedFact,
          memorySpaceId: SPACE_A,
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      // Store in space B
      const resultB = await cortex.facts.storeWithDedup(
        {
          ...sharedFact,
          memorySpaceId: SPACE_B,
        },
        {
          deduplication: { strategy: "structural" },
        },
      );

      // Should create separate facts in each space
      expect(resultA.fact.factId).not.toBe(resultB.fact.factId);
      expect(resultA.deduplication?.matchedExisting).toBe(false);
      expect(resultB.deduplication?.matchedExisting).toBe(false);
    });
  });
});

describe("Memory API Deduplication Integration", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("memory-dedup");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  const TEST_MEMSPACE_ID = ctx.memorySpaceId("memapi");
  const TEST_USER_ID = ctx.userId("user");
  const TEST_AGENT_ID = ctx.agentId("agent");

  beforeAll(async () => {
    console.log(`\n🧪 Memory API Deduplication Tests - Run ID: ${ctx.runId}\n`);

    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    // Register memory space, user, and agent for tests
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_MEMSPACE_ID,
      type: "personal",
    });

    await cortex.users.getOrCreate(TEST_USER_ID, {
      displayName: "Test User",
    });

    await cortex.agents.register({
      id: TEST_AGENT_ID,
      name: "Test Agent",
    });

    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  describe("remember() with factDeduplication", () => {
    it("defaults to semantic deduplication (falling back to structural)", async () => {
      // Note: Since belief revision is now "batteries included" (always enabled by default),
      // we must explicitly disable it to test the deduplication fallback path.

      // First remember call - extracts facts
      await cortex.memory.remember(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          conversationId: ctx.conversationId("conv1"),
          userMessage: "My name is Alice",
          agentResponse: "Nice to meet you, Alice!",
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          userName: "Alice",
          extractFacts: async (_userMsg, _agentMsg) => [
            {
              fact: "User's name is Alice",
              factType: "identity",
              subject: TEST_USER_ID,
              predicate: "name",
              object: "Alice",
              confidence: 95,
            },
          ],
        },
        { beliefRevision: false },
      ); // Disable to test deduplication path

      // Second remember call - same fact should be deduplicated
      await cortex.memory.remember(
        {
          memorySpaceId: TEST_MEMSPACE_ID,
          conversationId: ctx.conversationId("conv2"),
          userMessage: "Remember, I'm Alice",
          agentResponse: "Of course, Alice!",
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          userName: "Alice",
          extractFacts: async (_userMsg, _agentMsg) => [
            {
              fact: "User is Alice",
              factType: "identity",
              subject: TEST_USER_ID,
              predicate: "name",
              object: "Alice",
              confidence: 90,
            },
          ],
        },
        { beliefRevision: false },
      ); // Disable to test deduplication path

      // Count facts for this user - should be 1 due to structural dedup
      const facts = await cortex.facts.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: TEST_USER_ID,
      });

      // Due to structural deduplication on subject/predicate/object
      expect(facts.length).toBe(1);
      expect(facts[0].confidence).toBe(95); // Original higher confidence preserved
    });

    it("allows disabling deduplication with factDeduplication: false", async () => {
      const noDedup = ctx.memorySpaceId("nodedup-mem");

      await cortex.memorySpaces.register({
        memorySpaceId: noDedup,
        type: "personal",
      });

      // First remember call
      await cortex.memory.remember({
        memorySpaceId: noDedup,
        conversationId: ctx.conversationId("conv-nodedup-1"),
        userMessage: "I love coffee",
        agentResponse: "Coffee is great!",
        userId: TEST_USER_ID,
        agentId: TEST_AGENT_ID,
        userName: "Test",
        factDeduplication: false, // Disable dedup
        extractFacts: async () => [
          {
            fact: "User loves coffee",
            factType: "preference",
            subject: TEST_USER_ID,
            predicate: "loves",
            object: "coffee",
            confidence: 90,
          },
        ],
      });

      // Second remember call - should create duplicate
      await cortex.memory.remember({
        memorySpaceId: noDedup,
        conversationId: ctx.conversationId("conv-nodedup-2"),
        userMessage: "I love coffee so much",
        agentResponse: "You really love coffee!",
        userId: TEST_USER_ID,
        agentId: TEST_AGENT_ID,
        userName: "Test",
        factDeduplication: false, // Disable dedup
        extractFacts: async () => [
          {
            fact: "User loves coffee",
            factType: "preference",
            subject: TEST_USER_ID,
            predicate: "loves",
            object: "coffee",
            confidence: 90,
          },
        ],
      });

      // Count facts - should be 2 since dedup is disabled
      const facts = await cortex.facts.list({
        memorySpaceId: noDedup,
        predicate: "loves",
      });

      expect(facts.length).toBe(2);
    });
  });

  describe("Real-world scenarios", () => {
    it("handles user stating name multiple times across conversations", async () => {
      const multiConv = ctx.memorySpaceId("multi-conv");

      await cortex.memorySpaces.register({
        memorySpaceId: multiConv,
        type: "personal",
      });

      const factExtractor = async () => [
        {
          fact: "User's name is Bob",
          factType: "identity" as const,
          subject: "user-bob",
          predicate: "name",
          object: "Bob",
          confidence: 90,
        },
      ];

      // Simulate multiple conversations where user states name
      for (let i = 0; i < 5; i++) {
        await cortex.memory.remember({
          memorySpaceId: multiConv,
          conversationId: ctx.conversationId(`bob-conv-${i}`),
          userMessage: `Hi, my name is Bob`,
          agentResponse: `Hello Bob!`,
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          userName: "Bob",
          extractFacts: factExtractor,
        });
      }

      // Should only have 1 fact
      const facts = await cortex.facts.list({
        memorySpaceId: multiConv,
        subject: "user-bob",
      });

      expect(facts.length).toBe(1);
    });
  });
});
