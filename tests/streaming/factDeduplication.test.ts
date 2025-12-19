/**
 * Streaming Fact Deduplication Tests
 *
 * Tests the ProgressiveFactExtractor's cross-session deduplication during streaming.
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 */

import { Cortex } from "../../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext, ScopedCleanup } from "../helpers";
import { ProgressiveFactExtractor } from "../../src/memory/streaming/FactExtractor";
import type { FactsAPI } from "../../src/facts";

describe("ProgressiveFactExtractor - Deduplication", () => {
  const ctx = createNamedTestRunContext("stream-dedup");

  let cortex: Cortex;
  let client: ConvexClient;
  let scopedCleanup: ScopedCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  const TEST_MEMSPACE_ID = ctx.memorySpaceId("stream");
  const TEST_USER_ID = ctx.userId("user");

  beforeAll(async () => {
    console.log(`\n🧪 Streaming Fact Deduplication Tests - Run ID: ${ctx.runId}\n`);

    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    scopedCleanup = new ScopedCleanup(client, ctx);

    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);
    await scopedCleanup.cleanupAll();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  describe("Constructor with deduplication config", () => {
    it("creates extractor with default structural deduplication", () => {
      const factsApi = cortex.facts as FactsAPI;

      const extractor = new ProgressiveFactExtractor(
        factsApi,
        TEST_MEMSPACE_ID,
        TEST_USER_ID,
      );

      expect(extractor).toBeDefined();
    });

    it("creates extractor with custom config", () => {
      const factsApi = cortex.facts as FactsAPI;

      const extractor = new ProgressiveFactExtractor(
        factsApi,
        TEST_MEMSPACE_ID,
        TEST_USER_ID,
        undefined,
        {
          extractionThreshold: 300,
          deduplication: "exact",
        },
      );

      expect(extractor).toBeDefined();
    });

    it("creates extractor with deduplication disabled", () => {
      const factsApi = cortex.facts as FactsAPI;

      const extractor = new ProgressiveFactExtractor(
        factsApi,
        TEST_MEMSPACE_ID,
        TEST_USER_ID,
        undefined,
        {
          deduplication: false,
        },
      );

      expect(extractor).toBeDefined();
    });
  });

  describe("Cross-session deduplication during extraction", () => {
    it("prevents duplicates across extractor instances", async () => {
      const factsApi = cortex.facts as FactsAPI;
      const convId = ctx.conversationId("stream-dedup");
      const memSpaceId = ctx.memorySpaceId("cross-extract");

      // Create fact extractor function
      const extractFacts = async () => [
        {
          fact: "User prefers TypeScript",
          factType: "preference",
          subject: TEST_USER_ID,
          predicate: "prefers",
          object: "TypeScript",
          confidence: 90,
        },
      ];

      // First extractor instance (simulating session 1)
      const extractor1 = new ProgressiveFactExtractor(
        factsApi,
        memSpaceId,
        TEST_USER_ID,
        undefined,
        { deduplication: "structural" },
      );

      await extractor1.extractFromChunk(
        "I really like using TypeScript for all my projects.",
        1,
        extractFacts,
        "What's your favorite language?",
        convId,
        false,
      );

      // Second extractor instance (simulating session 2)
      const extractor2 = new ProgressiveFactExtractor(
        factsApi,
        memSpaceId,
        TEST_USER_ID,
        undefined,
        { deduplication: "structural" },
      );

      await extractor2.extractFromChunk(
        "TypeScript is my go-to language.",
        1,
        extractFacts,
        "Tell me about your coding preferences",
        convId,
        false,
      );

      // Count facts - should be 1 due to cross-session deduplication
      const count = await cortex.facts.count({
        memorySpaceId: memSpaceId,
        subject: TEST_USER_ID,
      });

      expect(count).toBe(1);
    });

    it("deduplicates within a single streaming session", async () => {
      const factsApi = cortex.facts as FactsAPI;
      const convId = ctx.conversationId("single-session");
      const memSpaceId = ctx.memorySpaceId("single-session");

      const extractFacts = async () => {
        return [
          {
            fact: "User enjoys hiking",
            factType: "preference",
            subject: TEST_USER_ID,
            predicate: "enjoys",
            object: "hiking",
            confidence: 85,
          },
        ];
      };

      const extractor = new ProgressiveFactExtractor(
        factsApi,
        memSpaceId,
        TEST_USER_ID,
        undefined,
        { extractionThreshold: 100, deduplication: "structural" },
      );

      // Simulate multiple extraction points during streaming
      const content1 = "I love going hiking on weekends.";
      const content2 = content1 + " The mountains are beautiful for hiking.";
      const content3 = content2 + " Hiking keeps me fit and healthy.";

      await extractor.extractFromChunk(content1, 1, extractFacts, "What are your hobbies?", convId);
      await extractor.extractFromChunk(content2, 2, extractFacts, "What are your hobbies?", convId);
      await extractor.extractFromChunk(content3, 3, extractFacts, "What are your hobbies?", convId);

      // Get all facts from this extractor
      const facts = extractor.getExtractedFacts();

      // Should only have 1 fact due to in-memory deduplication
      expect(facts.length).toBe(1);
    });
  });

  describe("Integration with rememberStream()", () => {
    it("deduplicates facts during progressive extraction", async () => {
      const memSpaceId = ctx.memorySpaceId("remember-stream");
      const userId = ctx.userId("stream-user");
      const agentId = ctx.agentId("stream-agent");

      // Register entities
      await cortex.memorySpaces.register({
        memorySpaceId: memSpaceId,
        type: "personal",
      });

      await cortex.users.getOrCreate(userId, { displayName: "Stream User" });
      await cortex.agents.register({ id: agentId, name: "Stream Agent" });

      // Create a mock stream
      async function* createMockStream() {
        yield "I love ";
        yield "programming ";
        yield "in Python. ";
        yield "Python is my ";
        yield "favorite language.";
      }

      // Helper to convert generator to ReadableStream
      const stream = new ReadableStream<string>({
        async start(controller) {
          for await (const chunk of createMockStream()) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      // Call rememberStream with fact extraction
      await cortex.memory.rememberStream(
        {
          memorySpaceId: memSpaceId,
          conversationId: ctx.conversationId("stream-1"),
          userMessage: "What's your favorite programming language?",
          responseStream: stream,
          userId: userId,
          agentId: agentId,
          userName: "Test User",
          extractFacts: async () => [
            {
              fact: "User's favorite language is Python",
              factType: "preference",
              subject: userId,
              predicate: "favorite_language",
              object: "Python",
              confidence: 90,
            },
          ],
        },
        {
          progressiveFactExtraction: true,
          factExtractionThreshold: 10,
        },
      );

      // Second stream session with same fact
      const stream2 = new ReadableStream<string>({
        async start(controller) {
          controller.enqueue("Python is still my preferred language!");
          controller.close();
        },
      });

      await cortex.memory.rememberStream(
        {
          memorySpaceId: memSpaceId,
          conversationId: ctx.conversationId("stream-2"),
          userMessage: "Do you still like Python?",
          responseStream: stream2,
          userId: userId,
          agentId: agentId,
          userName: "Test User",
          extractFacts: async () => [
            {
              fact: "User prefers Python programming",
              factType: "preference",
              subject: userId,
              predicate: "favorite_language",
              object: "Python",
              confidence: 85,
            },
          ],
        },
        {
          progressiveFactExtraction: true,
          factExtractionThreshold: 10,
        },
      );

      // Count facts - should be deduplicated
      const count = await cortex.facts.count({
        memorySpaceId: memSpaceId,
        subject: userId,
      });

      // Should be 1 due to structural deduplication
      expect(count).toBe(1);
    });
  });
});
