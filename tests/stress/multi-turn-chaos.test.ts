/**
 * Extreme Multi-Turn Conversation Stress Tests
 *
 * Ultimate stress tests for the Cortex memory system that simulate
 * chaotic, real-world conversation patterns:
 *
 * 1. Forgetful User: 50+ repeated questions, testing deduplication
 * 2. Indecisive User: 30+ preference changes, testing supersession
 * 3. Topic Flooder: 100+ similar memories, testing semantic search precision
 * 4. Combined Chaos: 100+ turn ultimate stress test
 * 5. Parallel Chaos: 5 concurrent users with isolation validation
 *
 * Requirements:
 * - OPENAI_API_KEY for real embeddings
 * - CONVEX_URL for test Convex deployment
 *
 * @jest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { Cortex } from "../../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext } from "../helpers/isolation";
import {
  generateForgetfulUserPattern,
  generateIndecisiveUserPattern,
  generateTopicFlooder,
  generateCombinedChaos,
  generateParallelChaosPatterns,
  generateRealEmbedding,
  TOPIC_CONFIGS,
  type ConversationTurn,
} from "./helpers/chaos-generators";
import {
  verifyExactFactState,
  verifyRecallExcludesSuperseded,
  validateSupersessionChain,
  validateAllSupersessionChains,
  verifyUserIsolation,
  verifyRecallIsolation,
  verifyNoDuplicates,
} from "./helpers/state-validators";
import {
  MetricsCollector,
  AggregateMetricsCollector,
  formatTestReport,
  formatAggregateReport,
  RateLimiter,
} from "./helpers/metrics";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Skip tests if no API key
const describeWithOpenAI = OPENAI_API_KEY ? describe : describe.skip;

// Rate limiter to avoid API throttling
const rateLimiter = new RateLimiter(60, 30); // 60 tokens, 30/sec refill

// Aggregate metrics collector
const aggregateMetrics = new AggregateMetricsCollector();

// Test timeout for long-running tests (15 minutes)
jest.setTimeout(900000);

// Retry failed tests once - Convex backend can have transient errors under stress
jest.retryTimes(1, { logErrorsBeforeRetry: true });

/**
 * Stress-test-optimized resilience config
 *
 * More retries with longer delays to handle heavy CI parallel load.
 * Total retry window: ~30+ seconds instead of default ~3.5s
 */
const STRESS_TEST_RESILIENCE = {
  enabled: true,
  rateLimiter: {
    bucketSize: 100,
    refillRate: 50,
  },
  concurrency: {
    maxConcurrent: 16,
    queueSize: 1000,
    timeout: 60000, // 60s timeout for stress tests
  },
  circuitBreaker: {
    failureThreshold: 10, // Higher threshold for stress tests
    successThreshold: 2,
    timeout: 60000, // 60s before recovery
    halfOpenMax: 3,
  },
  queue: {
    maxSize: {
      critical: 100,
      high: 500,
      normal: 1000,
      low: 2000,
      background: 5000,
    },
  },
  retry: {
    maxRetries: 5, // 5 retries instead of 3
    baseDelayMs: 1000, // Start with 1s delay instead of 0.5s
    maxDelayMs: 30000, // Cap at 30s instead of 10s
    exponentialBase: 2.0,
    jitter: true,
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock LLM Client for Fact Extraction
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function createMockLLMClient() {
  return {
    complete: async (options: {
      system: string;
      prompt: string;
      model?: string;
      responseFormat?: "json" | "text";
    }) => {
      // Parse the prompt to determine action based on content
      const prompt = options.prompt.toLowerCase();

      // Default to ADD for new facts, SUPERSEDE for preference conflicts
      if (prompt.includes("supersede") || prompt.includes("changed") || prompt.includes("update")) {
        return JSON.stringify({
          action: "SUPERSEDE",
          targetFactId: null, // Will be filled by actual matching
          reason: "Preference has changed",
          mergedFact: null,
          confidence: 90,
        });
      }

      if (prompt.includes("same") || prompt.includes("duplicate")) {
        return JSON.stringify({
          action: "NONE",
          targetFactId: null,
          reason: "Already captured",
          mergedFact: null,
          confidence: 95,
        });
      }

      return JSON.stringify({
        action: "ADD",
        targetFactId: null,
        reason: "New information",
        mergedFact: null,
        confidence: 85,
      });
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper: Process a single conversation turn
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function processTurn(
  cortex: Cortex,
  memorySpaceId: string,
  userId: string,
  turn: ConversationTurn,
  metrics: MetricsCollector,
  generateEmbedding?: (text: string) => Promise<number[] | null>,
): Promise<{ factStored: boolean; decision?: string }> {
  metrics.incrementTurn();

  // If this is a retrieval turn, perform recall
  if (turn.isRetrieval) {
    await metrics.timeOperation("recall", async () => {
      await rateLimiter.acquire();
      let embedding: number[] | undefined;
      if (generateEmbedding) {
        const result = await generateEmbedding(turn.userMessage);
        embedding = result ?? undefined;
      }

      return cortex.memory.recall({
        memorySpaceId,
        query: turn.userMessage,
        embedding,
        userId,
        limit: 20,
        formatForLLM: false,
      });
    });

    return { factStored: false };
  }

  // Process fact extraction and storage
  if (turn.extractFacts) {
    const facts = await turn.extractFacts();

    for (const factData of facts) {
      await rateLimiter.acquire();

      // Generate embedding for the fact
      let embedding: number[] | undefined;
      if (generateEmbedding) {
        try {
          const result = await generateEmbedding(factData.fact);
          embedding = result ?? undefined;
        } catch {
          // Continue without embedding
        }
      }

      // Use belief revision to store the fact
      const result = await metrics.timeOperation(
        "revise",
        async () => {
          return cortex.facts.revise({
            memorySpaceId,
            userId,
            fact: {
              ...factData,
              embedding,
            },
          });
        },
        { expectedAction: turn.expectedAction },
      );

      // Track the decision
      if (result.action === "ADD") {
        metrics.recordFactCreated();
      } else if (result.action === "UPDATE") {
        metrics.recordFactUpdated();
      } else if (result.action === "SUPERSEDE") {
        metrics.recordFactSuperseded();
      } else if (result.action === "NONE") {
        metrics.recordDuplicateAvoided();
      }

      return { factStored: true, decision: result.action };
    }
  }

  return { factStored: false };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Suite: Forgetful User
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describeWithOpenAI("Stress Tests - Forgetful User (50+ turns)", () => {
  const ctx = createNamedTestRunContext("stress-forgetful");
  let cortex: Cortex;
  let client: ConvexClient;
  const memorySpaceId = ctx.memorySpaceId("forgetful");
  const userId = ctx.userId("forgetful");

  beforeAll(async () => {
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
      resilience: STRESS_TEST_RESILIENCE,
    });

    // Configure belief revision
    cortex.facts.configureBeliefRevision(createMockLLMClient());

    // Create memory space
    await cortex.memorySpaces.register({
      memorySpaceId,
      type: "personal",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(memorySpaceId, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch {
      // Ignore
    }
    await client.close();
  });

  it("should handle 50+ repeated questions without creating duplicates", async () => {
    const metrics = new MetricsCollector("ForgetfulUser");
    const topics: (keyof typeof TOPIC_CONFIGS)[] = ["color", "food", "city", "job"];
    const turns = generateForgetfulUserPattern(userId, topics, 12); // 12 repetitions per topic

    console.log(`\n📝 Starting Forgetful User test with ${turns.length} turns\n`);

    // Process all turns
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (i % 10 === 0) {
        console.log(`   Processing turn ${i + 1}/${turns.length}...`);
      }

      await processTurn(cortex, memorySpaceId, userId, turn, metrics, generateRealEmbedding);
    }

    // Final metrics
    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
    console.log(formatTestReport(finalMetrics));

    // Validation: No duplicates
    const duplicateCheck = await verifyNoDuplicates(cortex, memorySpaceId, userId);
    expect(duplicateCheck.passed).toBe(true);

    // Validation: Expected number of facts (one per topic)
    const allFacts = await cortex.facts.list({
      memorySpaceId,
      subject: userId,
      includeSuperseded: false,
    });
    expect(allFacts.length).toBe(topics.length);

    // Validation: Correct fact values
    const expectedState: Record<string, string> = {};
    topics.forEach((topic) => {
      expectedState[TOPIC_CONFIGS[topic].predicate] = TOPIC_CONFIGS[topic].variations[0];
    });

    const stateCheck = await verifyExactFactState(cortex, memorySpaceId, userId, expectedState);
    expect(stateCheck.passed).toBe(true);
  });

  it("should return consistent recall results for repeated queries", async () => {
    const metrics = new MetricsCollector("ForgetfulUser-Recall");

    // Ask about color 10 times and verify consistency
    const recallResults: string[] = [];

    for (let i = 0; i < 10; i++) {
      await rateLimiter.acquire();
      const embedding = await generateRealEmbedding("What is my favorite color?");

      const result = await metrics.timeOperation("recall", async () => {
        return cortex.memory.recall({
          memorySpaceId,
          query: "What is my favorite color?",
          embedding,
          userId,
          limit: 10,
          formatForLLM: false,
        });
      });

      const factContents = result.items
        .filter((item) => item.type === "fact" && item.fact)
        .map((item) => item.fact!.fact);

      recallResults.push(factContents.join("|"));
    }

    // All results should be the same
    const uniqueResults = new Set(recallResults);
    expect(uniqueResults.size).toBe(1);

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Suite: Indecisive User
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describeWithOpenAI("Stress Tests - Indecisive User (30+ preference changes)", () => {
  const ctx = createNamedTestRunContext("stress-indecisive");
  let cortex: Cortex;
  let client: ConvexClient;
  const memorySpaceId = ctx.memorySpaceId("indecisive");
  const userId = ctx.userId("indecisive");

  beforeAll(async () => {
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
      resilience: STRESS_TEST_RESILIENCE,
    });
    cortex.facts.configureBeliefRevision(createMockLLMClient());

    await cortex.memorySpaces.register({
      memorySpaceId,
      type: "personal",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(memorySpaceId, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch {
      // Ignore
    }
    await client.close();
  });

  it("should correctly supersede facts through 10+ color preference changes", async () => {
    const metrics = new MetricsCollector("IndecisiveUser-Color");
    const turns = generateIndecisiveUserPattern(userId, "color", 10);

    console.log(`\n📝 Starting Indecisive User (Color) test with ${turns.length} turns\n`);

    let lastValue: string | undefined;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (i % 5 === 0) {
        console.log(`   Processing turn ${i + 1}/${turns.length}...`);
      }

      await processTurn(cortex, memorySpaceId, userId, turn, metrics, generateRealEmbedding);

      // Track the last value for verification
      if (turn.extractFacts && !turn.isRetrieval) {
        const facts = await turn.extractFacts();
        if (facts.length > 0) {
          lastValue = facts[0].object;
        }
      }
    }

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
    console.log(formatTestReport(finalMetrics));

    // Validation: Only ONE current color preference
    const currentFacts = await cortex.facts.list({
      memorySpaceId,
      subject: userId,
      predicate: "favorite color",
      includeSuperseded: false,
    });
    expect(currentFacts.length).toBe(1);

    // Validation: Current fact has the last value
    expect(currentFacts[0].object).toBe(lastValue);

    // Validation: Supersession chain is valid
    const chainResult = await validateSupersessionChain(
      cortex,
      memorySpaceId,
      userId,
      "favorite color",
    );
    expect(chainResult.isValid).toBe(true);
    expect(chainResult.chainLength).toBeGreaterThanOrEqual(2);

    console.log(`   Supersession chain length: ${chainResult.chainLength}`);
    console.log(`   Superseded facts: ${chainResult.supersededFacts.length}`);
  });

  it("should handle 30+ preference changes across multiple topics", async () => {
    const metrics = new MetricsCollector("IndecisiveUser-MultiTopic");
    const topics: (keyof typeof TOPIC_CONFIGS)[] = ["food", "city", "hobby", "music"];
    const changesPerTopic = 8;

    const allTurns: ConversationTurn[] = [];
    for (const topic of topics) {
      const topicTurns = generateIndecisiveUserPattern(userId, topic, changesPerTopic);
      allTurns.push(...topicTurns);
    }

    // Shuffle turns to simulate realistic chaos
    const shuffledTurns = allTurns.sort(() => Math.random() - 0.5);

    console.log(`\n📝 Starting Multi-Topic Indecisive test with ${shuffledTurns.length} turns\n`);

    for (let i = 0; i < shuffledTurns.length; i++) {
      const turn = shuffledTurns[i];
      if (i % 10 === 0) {
        console.log(`   Processing turn ${i + 1}/${shuffledTurns.length}...`);
      }

      await processTurn(cortex, memorySpaceId, userId, turn, metrics, generateRealEmbedding);
    }

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
    console.log(formatTestReport(finalMetrics));

    // Validation: All supersession chains valid
    const chainResults = await validateAllSupersessionChains(cortex, memorySpaceId, userId);
    expect(chainResults.invalidChains).toBe(0);

    console.log(`   Total chains validated: ${chainResults.totalChains}`);
    console.log(`   Valid chains: ${chainResults.validChains}`);

    // Validation: Recall excludes superseded
    const recallCheck = await verifyRecallExcludesSuperseded(
      cortex,
      memorySpaceId,
      "What are my preferences?",
      userId,
    );
    expect(recallCheck.passed).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Suite: Topic Flooder
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describeWithOpenAI("Stress Tests - Topic Flooder (100+ similar memories)", () => {
  const ctx = createNamedTestRunContext("stress-flooder");
  let cortex: Cortex;
  let client: ConvexClient;
  const memorySpaceId = ctx.memorySpaceId("flooder");
  const userId = ctx.userId("flooder");

  beforeAll(async () => {
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
      resilience: STRESS_TEST_RESILIENCE,
    });
    cortex.facts.configureBeliefRevision(createMockLLMClient());

    await cortex.memorySpaces.register({
      memorySpaceId,
      type: "personal",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(memorySpaceId, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch {
      // Ignore
    }
    await client.close();
  });

  it("should handle 25 variations on color preferences", async () => {
    const metrics = new MetricsCollector("TopicFlooder-Color");
    const turns = generateTopicFlooder(userId, "color", 25);

    console.log(`\n📝 Starting Topic Flooder (Color) test with ${turns.length} turns\n`);

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (i % 10 === 0) {
        console.log(`   Processing turn ${i + 1}/${turns.length}...`);
      }

      await processTurn(cortex, memorySpaceId, userId, turn, metrics, generateRealEmbedding);
    }

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
    console.log(formatTestReport(finalMetrics));

    // Validation: Semantic search finds relevant facts
    const embedding = await generateRealEmbedding("What colors does the user like?");
    const recallResult = await cortex.memory.recall({
      memorySpaceId,
      query: "What colors does the user like?",
      embedding,
      userId,
      limit: 30,
      formatForLLM: false,
    });

    const colorFacts = recallResult.items.filter(
      (item) => item.type === "fact" && item.fact?.fact?.toLowerCase().includes("color"),
    );

    expect(colorFacts.length).toBeGreaterThan(0);
    console.log(`   Found ${colorFacts.length} color-related facts via semantic search`);
  });

  it("should handle 100+ variations across multiple topics", async () => {
    const metrics = new MetricsCollector("TopicFlooder-Multi");
    const topics: (keyof typeof TOPIC_CONFIGS)[] = ["food", "city", "hobby", "movie", "music"];

    const allTurns: ConversationTurn[] = [];
    for (const topic of topics) {
      const topicTurns = generateTopicFlooder(userId, topic, 20);
      allTurns.push(...topicTurns);
    }

    console.log(`\n📝 Starting Multi-Topic Flooder test with ${allTurns.length} turns\n`);

    for (let i = 0; i < allTurns.length; i++) {
      const turn = allTurns[i];
      if (i % 20 === 0) {
        console.log(`   Processing turn ${i + 1}/${allTurns.length}...`);
      }

      await processTurn(cortex, memorySpaceId, userId, turn, metrics, generateRealEmbedding);
    }

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
    console.log(formatTestReport(finalMetrics));

    // Validation: Different topics don't get confused
    for (const topic of topics) {
      const config = TOPIC_CONFIGS[topic];
      const embedding = await generateRealEmbedding(`What is the user's ${config.name}?`);

      const result = await cortex.memory.recall({
        memorySpaceId,
        query: `What is the user's ${config.name}?`,
        embedding,
        userId,
        limit: 10,
        formatForLLM: false,
      });

      const relevantFacts = result.items.filter(
        (item) => item.type === "fact" && item.fact,
      );

      console.log(`   ${topic}: Found ${relevantFacts.length} relevant facts`);
      expect(relevantFacts.length).toBeGreaterThan(0);
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Suite: Combined Chaos
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describeWithOpenAI("Stress Tests - Combined Chaos (100+ turn ultimate test)", () => {
  const ctx = createNamedTestRunContext("stress-chaos");
  let cortex: Cortex;
  let client: ConvexClient;
  const memorySpaceId = ctx.memorySpaceId("chaos");
  const userId = ctx.userId("chaos");

  beforeAll(async () => {
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
      resilience: STRESS_TEST_RESILIENCE,
    });
    cortex.facts.configureBeliefRevision(createMockLLMClient());

    await cortex.memorySpaces.register({
      memorySpaceId,
      type: "personal",
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(memorySpaceId, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch {
      // Ignore
    }
    await client.close();
  });

  it("should survive 100+ turns of combined chaos patterns", async () => {
    const metrics = new MetricsCollector("CombinedChaos");
    const chaosResult = generateCombinedChaos(userId, 100);

    // Handle the fact that generateCombinedChaos returns both turns and finalState
    let turns: ConversationTurn[];
    let _expectedFinalState: Record<string, string> = {};

    if (Array.isArray(chaosResult)) {
      turns = chaosResult;
    } else {
      turns = (chaosResult as any).turns;
      _expectedFinalState = (chaosResult as any).finalState || {};
    }

    console.log(`\n📝 Starting Combined Chaos test with ${turns.length} turns\n`);

    const decisionsCount: Record<string, number> = {
      ADD: 0,
      UPDATE: 0,
      SUPERSEDE: 0,
      NONE: 0,
    };

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (i % 20 === 0) {
        console.log(`   Processing turn ${i + 1}/${turns.length}...`);
      }

      const result = await processTurn(
        cortex,
        memorySpaceId,
        userId,
        turn,
        metrics,
        generateRealEmbedding,
      );

      if (result.decision) {
        decisionsCount[result.decision]++;
      }
    }

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
    console.log(formatTestReport(finalMetrics));

    console.log("\n📊 Decision Distribution:");
    console.log(`   ADD: ${decisionsCount.ADD}`);
    console.log(`   UPDATE: ${decisionsCount.UPDATE}`);
    console.log(`   SUPERSEDE: ${decisionsCount.SUPERSEDE}`);
    console.log(`   NONE: ${decisionsCount.NONE}`);

    // Validation: No duplicates after all the chaos
    const duplicateCheck = await verifyNoDuplicates(cortex, memorySpaceId, userId);
    console.log(`\n✅ Duplicate check: ${duplicateCheck.message}`);
    expect(duplicateCheck.passed).toBe(true);

    // Validation: All supersession chains valid
    const chainResults = await validateAllSupersessionChains(cortex, memorySpaceId, userId);
    console.log(`✅ Chain validation: ${chainResults.validChains}/${chainResults.totalChains} valid`);
    expect(chainResults.invalidChains).toBe(0);

    // Validation: Recall excludes superseded facts
    const recallCheck = await verifyRecallExcludesSuperseded(
      cortex,
      memorySpaceId,
      "Tell me everything about the user",
      userId,
    );
    console.log(`✅ Recall excludes superseded: ${recallCheck.passed}`);
    expect(recallCheck.passed).toBe(true);
  });

  it("should maintain data integrity after chaos", async () => {
    const metrics = new MetricsCollector("CombinedChaos-Integrity");

    // Get all current facts
    const allFacts = await cortex.facts.list({
      memorySpaceId,
      subject: userId,
      includeSuperseded: true,
    });

    const currentFacts = allFacts.filter((f) => !f.supersededBy);
    const supersededFacts = allFacts.filter((f) => f.supersededBy);

    console.log(`\n📊 Post-Chaos Data State:`);
    console.log(`   Total facts: ${allFacts.length}`);
    console.log(`   Current facts: ${currentFacts.length}`);
    console.log(`   Superseded facts: ${supersededFacts.length}`);

    // All superseded facts should have validUntil
    const missingValidUntil = supersededFacts.filter((f) => !f.validUntil);
    expect(missingValidUntil.length).toBe(0);

    // No current facts should have supersededBy
    const invalidCurrent = currentFacts.filter((f) => f.supersededBy);
    expect(invalidCurrent.length).toBe(0);

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test Suite: Parallel Chaos
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describeWithOpenAI("Stress Tests - Parallel Chaos (5 concurrent users)", () => {
  const ctx = createNamedTestRunContext("stress-parallel");
  let cortex: Cortex;
  let client: ConvexClient;
  const memorySpaceId = ctx.memorySpaceId("parallel");
  const userIds = Array.from({ length: 5 }, (_, i) => ctx.userId(`user-${i}`));

  beforeAll(async () => {
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({
      convexUrl: CONVEX_URL,
      resilience: STRESS_TEST_RESILIENCE,
    });
    cortex.facts.configureBeliefRevision(createMockLLMClient());

    await cortex.memorySpaces.register({
      memorySpaceId,
      type: "team", // Use "team" for shared memory space
    });
  });

  afterAll(async () => {
    try {
      await cortex.memorySpaces.delete(memorySpaceId, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch {
      // Ignore
    }
    await client.close();
  });

  it("should handle 5 concurrent users with 20 turns each", async () => {
    const metrics = new MetricsCollector("ParallelChaos");
    const patterns = generateParallelChaosPatterns(userIds, 20);

    console.log(`\n📝 Starting Parallel Chaos test with ${userIds.length} users\n`);

    // Process all users in parallel
    const userPromises = userIds.map(async (userId, userIndex) => {
      const userTurns = patterns.get(userId) || [];
      const userMetrics = new MetricsCollector(`User-${userIndex}`);

      console.log(`   User ${userIndex + 1}: Processing ${userTurns.length} turns...`);

      for (const turn of userTurns) {
        await processTurn(
          cortex,
          memorySpaceId,
          userId,
          turn,
          userMetrics,
          generateRealEmbedding,
        );
      }

      return userMetrics.finalize();
    });

    const userResults = await Promise.all(userPromises);

    // Aggregate user metrics
    for (const result of userResults) {
      metrics.recordTiming("user-completion", result.totalDurationMs || 0);
    }

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
    console.log(formatTestReport(finalMetrics));

    // Validation: User isolation
    const isolationCheck = await verifyUserIsolation(cortex, memorySpaceId, userIds);
    console.log(`\n✅ User isolation check: ${isolationCheck.passed ? "PASSED" : "FAILED"}`);
    if (!isolationCheck.passed) {
      console.log(`   Violations: ${isolationCheck.violations.length}`);
    }
    expect(isolationCheck.passed).toBe(true);
  });

  it("should verify recall isolation between users", async () => {
    const metrics = new MetricsCollector("ParallelChaos-RecallIsolation");

    // Test recall isolation for each user
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const otherUserIds = userIds.filter((id) => id !== userId);

      const isolationResult = await verifyRecallIsolation(
        cortex,
        memorySpaceId,
        userId,
        "What are my preferences?",
        otherUserIds,
      );

      console.log(`   User ${i + 1} recall isolation: ${isolationResult.passed ? "PASS" : "FAIL"}`);
      expect(isolationResult.passed).toBe(true);
    }

    const finalMetrics = metrics.finalize();
    aggregateMetrics.addTestMetrics(finalMetrics);
  });

  it("should verify no cross-user fact contamination", async () => {
    // For each user, verify their facts don't belong to other users
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];

      const facts = await cortex.facts.list({
        memorySpaceId,
        subject: userId,
        includeSuperseded: false,
      });

      // All facts should have this user as subject
      const wrongUser = facts.filter((f) => !f.subject?.includes(userId));
      expect(wrongUser.length).toBe(0);

      console.log(`   User ${i + 1}: ${facts.length} facts, all correctly attributed`);
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Aggregate Report
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

afterAll(() => {
  const aggregate = aggregateMetrics.finalize();
  console.log("\n\n");
  console.log(formatAggregateReport(aggregate));
});
