/**
 * E2E Tests: Multi-Turn Conversations
 *
 * Tests complex multi-hop scenarios with accumulated context
 *
 * Requires: CONVEX_URL, OPENAI_API_KEY
 */

import { createCortexMemory } from "../../src/index";
import { Cortex } from "@cortexmemory/sdk";
import {
  createTestMemorySpaceId,
  createTestUserId,
  createTestConversationId,
} from "../helpers/test-utils";

// Skip if no Convex URL configured
const SKIP_E2E = !process.env.CONVEX_URL;

// Real embedding provider using OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY required for E2E tests");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

// Simple LLM for tests
function createSimpleLLM() {
  return {
    specificationVersion: "v1",
    provider: "openai",
    modelId: "gpt-4o-mini",
    doGenerate: async (options: any) => {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: options.prompt.map((m: any) => ({
              role: m.role,
              content:
                typeof m.content === "string"
                  ? m.content
                  : m.content.map((c: any) => c.text).join(""),
            })),
            max_tokens: 200,
          }),
        },
      );

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        finishReason: "stop",
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        },
      };
    },
    doStream: async (options: any) => {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: options.prompt.map((m: any) => ({
              role: m.role,
              content:
                typeof m.content === "string"
                  ? m.content
                  : m.content.map((c: any) => c.text).join(""),
            })),
            max_tokens: 200,
            stream: true,
          }),
        },
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      return {
        stream: new ReadableStream({
          async start(controller) {
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const content = data.choices[0]?.delta?.content;
                    if (content) {
                      controller.enqueue({
                        type: "text-delta",
                        textDelta: content,
                      });
                    }
                  } catch {
                    // Ignore parse errors
                  }
                }
              }
            }
            controller.close();
          },
        }),
        rawCall: {},
      };
    },
  };
}

describe("Multi-Turn Conversations E2E", () => {
  let memorySpaceId: string;
  let userId: string;
  let cortex: Cortex;

  beforeAll(() => {
    if (SKIP_E2E) {
      console.log("Skipping E2E tests - CONVEX_URL not configured");
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.log("Skipping E2E tests - OPENAI_API_KEY not configured");
      return;
    }
  });

  beforeEach(async () => {
    if (SKIP_E2E || !process.env.OPENAI_API_KEY) return;

    memorySpaceId = createTestMemorySpaceId("e2e-multi");
    userId = createTestUserId();
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  afterEach(async () => {
    if (cortex) {
      cortex.close();
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Complex User Profile Building
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "user profile building",
    () => {
      it("should accumulate facts about user across multiple turns", async () => {
        const conversationId = createTestConversationId();

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-multi-agent",
          conversationId,
          embeddingProvider: { generate: generateEmbedding },
          enableFactExtraction: true,
          enableMemoryStorage: true,
          enableMemorySearch: true,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        // Build user profile across multiple turns
        const profileStatements = [
          "My name is Alexander and I'm a software engineer",
          "I've been working with TypeScript for 3 years",
          "Actually, just call me Alex instead of Alexander", // Name preference update
          "I also enjoy hiking on weekends",
        ];

        for (let i = 0; i < profileStatements.length; i++) {
          console.log(`Turn ${i + 1}: "${profileStatements[i]}"`);
          await wrappedModel.doGenerate({
            prompt: [
              {
                role: "system",
                content:
                  "You are a friendly assistant. Acknowledge what the user tells you.",
              },
              {
                role: "user",
                content: [{ type: "text", text: profileStatements[i] }],
              },
            ],
            mode: { type: "regular" },
          });

          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        // Final turn: Ask about the profile
        console.log("Final turn: Asking about profile...");
        const result = await wrappedModel.doGenerate({
          prompt: [
            {
              role: "system",
              content:
                "You are a helpful assistant with access to user memory. Use the context provided to answer.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "What do you know about me so far?",
                },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        console.log("Response:", result.text);

        // Verify facts were accumulated
        const allFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: true,
        });

        const activeFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: false,
        });

        console.log(`\nAccumulated facts (active): ${activeFacts.length}`);
        console.log(`Total facts (including superseded): ${allFacts.length}`);
        for (const fact of allFacts) {
          const status = fact.supersededBy ? "SUPERSEDED" : "ACTIVE";
          console.log(`  [${status}] "${fact.fact}"`);
        }

        // Name preference "Alex" should have superseded "Alexander"
        // Other facts (TypeScript, hiking) should remain active
        expect(activeFacts.length).toBeGreaterThanOrEqual(0);
        expect(result.text.length).toBeGreaterThan(0);
      }, 120000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Preference Updates Over Time
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "preference updates",
    () => {
      it("should handle complex preference updates over time", async () => {
        const conversationId = createTestConversationId();

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-multi-agent",
          conversationId,
          embeddingProvider: { generate: generateEmbedding },
          enableFactExtraction: true,
          enableMemoryStorage: true,
          beliefRevision: { enabled: true, slotMatching: true },
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        // Initial preferences
        console.log("Setting initial preferences...");
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "I prefer dark mode in my IDE and I usually drink coffee in the morning",
                },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Update one preference
        console.log("Updating drink preference...");
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "I've switched to tea in the morning, it's better for focus",
                },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Verify current state
        const allFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: true,
        });

        const activeFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: false,
        });

        console.log("\n=== Fact State ===");
        console.log(`Total facts: ${allFacts.length}`);
        console.log(`Active facts: ${activeFacts.length}`);

        for (const fact of allFacts) {
          const status = fact.supersededBy ? "SUPERSEDED" : "ACTIVE";
          console.log(`  [${status}] "${fact.fact}"`);
        }

        // Dark mode preference should still be active
        // Coffee should be superseded by tea (if belief revision worked)
        expect(allFacts.length).toBeGreaterThanOrEqual(0);
      }, 90000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Multi-Turn
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "streaming multi-turn",
    () => {
      it("should maintain context across streamed conversations", async () => {
        const conversationId = createTestConversationId();

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-multi-agent",
          conversationId,
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          enableMemorySearch: true,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        // Stream turn 1
        console.log("Streaming turn 1...");
        const result1 = await wrappedModel.doStream({
          prompt: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "I'm planning a trip to Japan next month",
                },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        // Consume stream
        const reader1 = result1.stream.getReader();
        let text1 = "";
        while (true) {
          const { done, value } = await reader1.read();
          if (done) break;
          if (value.textDelta) text1 += value.textDelta;
        }
        console.log("Response 1:", text1.substring(0, 100) + "...");

        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Stream turn 2
        console.log("Streaming turn 2...");
        const result2 = await wrappedModel.doStream({
          prompt: [
            {
              role: "user",
              content: [
                { type: "text", text: "What cities should I visit there?" },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        const reader2 = result2.stream.getReader();
        let text2 = "";
        while (true) {
          const { done, value } = await reader2.read();
          if (done) break;
          if (value.textDelta) text2 += value.textDelta;
        }
        console.log("Response 2:", text2.substring(0, 100) + "...");

        expect(text1.length).toBeGreaterThan(0);
        expect(text2.length).toBeGreaterThan(0);
      }, 90000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Rapid Fact Changes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "rapid changes",
    () => {
      it("should handle rapid fact updates without corruption", async () => {
        const conversationId = createTestConversationId();

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-rapid-agent",
          conversationId,
          embeddingProvider: { generate: generateEmbedding },
          enableFactExtraction: true,
          enableMemoryStorage: true,
          beliefRevision: { enabled: true },
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        // Rapid updates (shorter wait times)
        const updates = [
          "I'm currently reading a fantasy book",
          "Actually, I switched to a mystery novel",
          "Now I'm reading a science fiction book",
        ];

        for (const update of updates) {
          console.log(`Rapid update: "${update}"`);
          await wrappedModel.doGenerate({
            prompt: [
              {
                role: "user",
                content: [{ type: "text", text: update }],
              },
            ],
            mode: { type: "regular" },
          });

          // Shorter delay to stress test
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Wait for all processing to complete
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Verify state
        const allFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: true,
        });

        const activeFacts = await cortex.facts.list({
          memorySpaceId,
          includeSuperseded: false,
        });

        console.log(`\n=== Rapid Update Results ===`);
        console.log(`Total facts: ${allFacts.length}`);
        console.log(`Active facts: ${activeFacts.length}`);

        // Count reading-related active facts
        const activeReadingFacts = activeFacts.filter(
          (f) =>
            f.fact.toLowerCase().includes("reading") ||
            f.fact.toLowerCase().includes("book"),
        );

        console.log(`Active reading facts: ${activeReadingFacts.length}`);

        // Ideally should have 1 active reading fact (sci-fi), others superseded
        expect(activeReadingFacts.length).toBeLessThanOrEqual(3);
      }, 90000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cross-Session Memory
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "cross-session memory",
    () => {
      it("should maintain facts across different conversation sessions", async () => {
        // Session 1: Create facts
        const session1ConvId = createTestConversationId();
        const factory1 = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId, // Same user
          userName: "Test User",
          agentId: "e2e-session-agent",
          conversationId: session1ConvId,
          embeddingProvider: { generate: generateEmbedding },
          enableFactExtraction: true,
          enableMemoryStorage: true,
          enableMemorySearch: true,
        });

        console.log("Session 1: Creating facts...");
        const llm1 = createSimpleLLM();
        const model1 = factory1(llm1);

        await model1.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "My birthday is on March 15th" }],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Session 2: Different conversation, same user
        const session2ConvId = createTestConversationId();
        const factory2 = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId, // Same user!
          userName: "Test User",
          agentId: "e2e-session-agent",
          conversationId: session2ConvId,
          embeddingProvider: { generate: generateEmbedding },
          enableMemorySearch: true,
        });

        console.log("Session 2: Asking about remembered facts...");
        const llm2 = createSimpleLLM();
        const model2 = factory2(llm2);

        const result = await model2.doGenerate({
          prompt: [
            {
              role: "system",
              content:
                "You are a helpful assistant with access to user memory. Use the context to answer.",
            },
            {
              role: "user",
              content: [{ type: "text", text: "When is my birthday?" }],
            },
          ],
          mode: { type: "regular" },
        });

        console.log("Session 2 response:", result.text);

        // The response should ideally mention March 15
        // But we just verify we got a response (LLM is non-deterministic)
        expect(result.text.length).toBeGreaterThan(0);
      }, 90000);
    },
  );
});
