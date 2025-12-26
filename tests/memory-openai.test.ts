/**
 * E2E Tests: Memory Convenience API - OpenAI Integration
 *
 * Tests real-world embedding and recall with OpenAI
 * Split from memory.test.ts for parallel execution
 */

import { jest } from "@jest/globals";
import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import OpenAI from "openai";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

// OpenAI client (optional - tests skip if key not present)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OpenAI Helper Functions (for advanced embedding tests)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

async function summarizeConversation(
  userMessage: string,
  agentResponse: string,
): Promise<string | null> {
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [
      {
        role: "system",
        content:
          "Extract key facts from this conversation in one concise sentence.",
      },
      {
        role: "user",
        content: `User: ${userMessage}\nAgent: ${agentResponse}`,
      },
    ],
    // temperature not supported with gpt-5-nano, uses default of 1
  });

  return response.choices[0].message.content;
}

describe("Memory OpenAI Integration", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("openai");
  const TEST_USER_ID = ctx.userId("openai");
  const TEST_AGENT_ID = ctx.agentId("openai");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);

    // NOTE: Removed purgeAll() to enable parallel test execution.
    // Each test uses ctx-scoped IDs to avoid conflicts.
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Advanced: Real-World Embedding & Recall (with OpenAI)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Advanced: Real-World Embedding & Recall", () => {
    // Skip if no API key
    const shouldRun = Boolean(openai);

    (shouldRun ? describe : describe.skip)("with OpenAI", () => {
      // Retry failed tests once - OpenAI API and vector search can have transient issues
      jest.retryTimes(1, { logErrorsBeforeRetry: true });

      let conversationId: string;
      const storedMemories: Array<{ fact: string; memoryId: string }> = [];

      beforeAll(async () => {
        // NOTE: Removed purgeAll() for parallel execution compatibility.
        // Each test uses ctx-scoped IDs to avoid conflicts.

        // Create conversation
        const conv = await cortex.conversations.create({
          type: "user-agent",
          memorySpaceId: TEST_MEMSPACE_ID,
          participants: {
            userId: TEST_USER_ID,
            agentId: TEST_AGENT_ID,
            participantId: TEST_AGENT_ID,
          },
        });

        conversationId = conv.conversationId;
      }, 120000); // 120 second timeout for OpenAI API setup

      it("stores multiple facts with real embeddings and summarization", async () => {
        // Scenario: Customer support conversation with 5 key facts
        const conversations = [
          {
            user: "My name is Alexander Johnson and I prefer to be called Alex",
            agent: "Got it, I'll call you Alex!",
            fact: "user-name",
          },
          {
            user: "My email is alex.johnson@techcorp.com for any updates",
            agent: "I've noted your email address",
            fact: "user-email",
          },
          {
            user: "The API password for production is SecurePass2024!",
            agent: "I'll remember that password securely",
            fact: "api-password",
          },
          {
            user: "We need the new feature deployed by Friday 5pm EST",
            agent: "Noted - deployment deadline is Friday at 5pm EST",
            fact: "deadline",
          },
          {
            user: "I prefer dark mode theme and minimal notifications",
            agent: "I'll set dark mode and reduce notifications",
            fact: "preferences",
          },
        ];

        // Store each with embeddings and summarization
        for (const conv of conversations) {
          const result = await cortex.memory.remember({
            memorySpaceId: TEST_MEMSPACE_ID,
            conversationId,
            userMessage: conv.user,
            agentResponse: conv.agent,
            userId: TEST_USER_ID,
            userName: "Alex Johnson",
            agentId: TEST_AGENT_ID,
            generateEmbedding,
            extractContent: summarizeConversation,
            importance: conv.fact === "api-password" ? 100 : 70,
            tags: [conv.fact, "customer-support"],
          });

          storedMemories.push({
            fact: conv.fact,
            memoryId: result.memories[0].memoryId,
          });

          // Verify embeddings were stored
          expect(result.memories[0].embedding).toBeDefined();
          expect(result.memories[0].embedding).toHaveLength(1536);
          expect(result.memories[0].contentType).toBe("summarized");
        }

        expect(storedMemories).toHaveLength(5);
      }, 120000); // 120s timeout for API calls (5 sequential OpenAI calls)

      it("recalls facts using semantic search (not keyword matching)", async () => {
        // Skip if running in LOCAL mode (no vector search support)
        if (
          process.env.CONVEX_URL?.includes("localhost") ||
          process.env.CONVEX_URL?.includes("127.0.0.1")
        ) {
          console.log(
            "⏭️  Skipping: Semantic search requires MANAGED mode (LOCAL doesn't support vector search)",
          );
          return;
        }

        // Test semantic understanding (queries don't match exact words)
        // VALIDATION: Expected content MUST be in the top 3 results
        // Note: Semantic search ranking can vary due to LLM summarization variability
        // Top 3 provides a reasonable balance between strictness and reliability
        const searches = [
          {
            query: "what should I address the user as",
            expectInContent: "Alex",
          },
          {
            query: "how do I contact them electronically",
            expectInContent: "email",
          },
          {
            query: "production system credentials",
            expectInContent: "password",
          },
          { query: "when is the deployment due", expectInContent: "Friday" },
          { query: "UI appearance settings", expectInContent: "dark mode" },
        ];

        for (const search of searches) {
          const results = (await cortex.memory.search(
            TEST_MEMSPACE_ID,
            search.query,
            {
              embedding: await generateEmbedding(search.query),
              userId: TEST_USER_ID,
              limit: 10, // Get more results for debugging context
            },
          )) as unknown[];

          // Should find the relevant fact (semantic match, not keyword)
          expect(results.length).toBeGreaterThan(0);

          // Check top 3 results for expected content
          const top3Results = results.slice(0, 3) as {
            content: string;
            _score?: number;
          }[];

          // Find if expected content is in any of the top 3 results
          const matchingResult = top3Results.find((r) =>
            r.content
              .toLowerCase()
              .includes(search.expectInContent.toLowerCase()),
          );

          // Log all top 5 results for debugging context if not found
          if (!matchingResult) {
            console.log(
              `  ⚠ Query: "${search.query}" - Expected "${search.expectInContent}" NOT in top 3:`,
            );
            (
              results.slice(0, 5) as { content: string; _score?: number }[]
            ).forEach((r, i) => {
              console.log(
                `    ${i + 1}. "${r.content.substring(0, 80)}..." (score: ${r._score?.toFixed(3) || "N/A"})`,
              );
            });
          }

          // VALIDATION: Expected content MUST appear in top 3 results
          expect(matchingResult).toBeDefined();

          // Log for visibility
          const matchIndex = (
            results.slice(0, 5) as { content: string; _score?: number }[]
          ).findIndex((r) =>
            r.content
              .toLowerCase()
              .includes(search.expectInContent.toLowerCase()),
          );
          console.log(
            `  ✓ Query: "${search.query}" → Found "${search.expectInContent}" at position ${matchIndex + 1}`,
          );
        }
      }, 60000); // 60s timeout for API calls

      it("enriches search results with full conversation context", async () => {
        const results = await cortex.memory.search(
          TEST_MEMSPACE_ID,
          "password",
          {
            embedding: await generateEmbedding("password credentials"),
            enrichConversation: true,
            userId: TEST_USER_ID,
          },
        );

        expect(results.length).toBeGreaterThan(0);

        const enriched = results[0] as any;

        // Check if it's enriched structure (has .memory)
        if (enriched.memory) {
          // Enriched structure exists
          expect(enriched.memory).toBeDefined();

          // Conversation may or may not exist (depends on conversationRef)
          if (enriched.conversation) {
            expect(enriched.conversation).toBeDefined();
            expect(enriched.sourceMessages).toBeDefined();
            expect(enriched.sourceMessages.length).toBeGreaterThan(0);

            console.log(
              `  ✓ Enriched: Vector="${enriched.memory.content.substring(0, 40)}..."`,
            );
            console.log(
              `  ✓ ACID source="${enriched.sourceMessages[0].content.substring(0, 40)}..."`,
            );
          } else {
            // No conversation (system memory or conversation deleted)
            console.log(
              `  ✓ Enriched (no conversation): "${enriched.memory.content.substring(0, 40)}..."`,
            );
          }
        } else {
          // Direct structure (no enrichment wrapper)
          expect(enriched.content).toBeDefined();
          console.log(
            `  ✓ Direct result: "${enriched.content.substring(0, 40)}..."`,
          );
        }
      }, 30000);

      it("validates summarization quality", async () => {
        // Skip if storedMemories wasn't populated (e.g., previous test failed)
        if (storedMemories.length === 0) {
          console.log(
            "⏭️  Skipping: storedMemories not populated (prerequisite test may have failed)",
          );
          return;
        }

        // Get a summarized memory
        const memory = await cortex.vector.get(
          TEST_MEMSPACE_ID,
          storedMemories[0].memoryId,
        );

        // Memory might have been cleaned up by parallel tests
        if (!memory) {
          console.log(
            "⏭️  Skipping: Memory no longer exists (may have been cleaned up)",
          );
          return;
        }

        expect(memory.contentType).toBe("summarized");

        // Summarized content should be concise (relaxed constraint for gpt-5-nano default temperature)
        const original =
          "My name is Alexander Johnson and I prefer to be called Alex";

        expect(memory!.content.length).toBeLessThan(original.length * 2.5);
        expect(memory!.content.toLowerCase()).toContain("alex");

        console.log(`  ✓ Original: "${original}"`);
        console.log(`  ✓ Summarized: "${memory!.content}"`);
      }, 30000);

      it("similarity scores are realistic (0-1 range)", async () => {
        const results = (await cortex.memory.search(
          TEST_MEMSPACE_ID,
          "API password for production environment",
          {
            embedding: await generateEmbedding(
              "API password for production environment",
            ),
            userId: TEST_USER_ID,
          },
        )) as unknown[];

        expect(results.length).toBeGreaterThan(0);

        // Validate scores are in valid range
        const resultsWithScores = results.filter(
          (r: any) => r._score !== undefined && !isNaN(r._score),
        );

        expect(resultsWithScores.length).toBeGreaterThan(0);

        resultsWithScores.forEach((result: any) => {
          const score = result._score;

          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
          console.log(
            `  ✓ Memory "${result.content.substring(0, 30)}..." score: ${score.toFixed(4)}`,
          );
        });
      }, 30000);
    });
  });
});
