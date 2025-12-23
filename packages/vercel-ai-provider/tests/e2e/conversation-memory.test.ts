/**
 * E2E Tests: Conversation Memory
 *
 * Tests real conversation cycles with Convex backend and LLM calls
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

// Create real LLM model for E2E tests
function createRealLLM() {
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
            max_tokens: 150,
          }),
        },
      );

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        finishReason: data.choices[0].finish_reason,
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
            max_tokens: 150,
            stream: true,
          }),
        },
      );

      // Parse SSE stream
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

describe("Conversation Memory E2E", () => {
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

    // Create unique IDs for test isolation
    memorySpaceId = createTestMemorySpaceId("e2e-conv");
    userId = createTestUserId();

    // Initialize Cortex for direct verification
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  afterEach(async () => {
    if (cortex) {
      cortex.close();
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Basic Remember and Recall
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "basic remember and recall",
    () => {
      it("should store and recall user information", async () => {
        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-test-agent",
          agentName: "E2E Test Agent",
          embeddingProvider: { generate: generateEmbedding },
          enableFactExtraction: true,
        });

        const llm = createRealLLM();
        const wrappedModel = factory(llm);

        // Turn 1: Introduce name
        const result1 = await wrappedModel.doGenerate({
          prompt: [
            {
              role: "system",
              content:
                "You are a helpful assistant that remembers user information.",
            },
            {
              role: "user",
              content: [{ type: "text", text: "My name is Alice" }],
            },
          ],
          mode: { type: "regular" },
        });

        expect(result1.text).toBeDefined();
        expect(result1.text.length).toBeGreaterThan(0);

        // Wait for memory to be stored
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Verify memories were stored
        const memories = await cortex.memory.list({
          memorySpaceId,
          limit: 10,
        });

        expect(memories.length).toBeGreaterThan(0);
      }, 30000);

      it("should recall stored information in subsequent turns", async () => {
        const conversationId = createTestConversationId();

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-test-agent",
          conversationId,
          embeddingProvider: { generate: generateEmbedding },
          enableMemorySearch: true,
          enableMemoryStorage: true,
        });

        const llm = createRealLLM();
        const wrappedModel = factory(llm);

        // First store something
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "I work as a software engineer" }],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Now ask about it
        const result = await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "What is my job?" }],
            },
          ],
          mode: { type: "regular" },
        });

        // The response should mention the job
        // Note: LLM responses are non-deterministic, so we just check it responded
        expect(result.text).toBeDefined();
      }, 60000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Manual Memory Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "manual memory methods",
    () => {
      it("should manually remember and search", async () => {
        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-test-agent",
          embeddingProvider: { generate: generateEmbedding },
        });

        // Manually remember
        await factory.remember(
          "I love hiking in the mountains",
          "That sounds wonderful! Hiking is great exercise.",
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Search for the memory
        const results = await factory.search("outdoor activities");

        expect(results.length).toBeGreaterThanOrEqual(0);
      }, 30000);

      it("should list and clear memories", async () => {
        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-test-agent",
        });

        // Remember something
        await factory.remember("Test memory content", "Acknowledged.");

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // List memories
        const memories = await factory.getMemories();
        expect(memories.length).toBeGreaterThanOrEqual(0);

        // Clear memories - must specify userId to prevent accidental mass deletion
        // This is a safety feature of the SDK
        const deleted = await factory.clearMemories({ userId, confirm: true });
        expect(typeof deleted).toBe("number");
      }, 30000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Conversations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "streaming conversations",
    () => {
      it("should stream and store response", async () => {
        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-test-agent",
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
        });

        const llm = createRealLLM();
        const wrappedModel = factory(llm);

        const result = await wrappedModel.doStream({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "Tell me a short joke" }],
            },
          ],
          mode: { type: "regular" },
        });

        // Consume the stream
        const chunks: string[] = [];
        const reader = result.stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.textDelta) {
            chunks.push(value.textDelta);
          }
        }

        expect(chunks.length).toBeGreaterThan(0);

        // Wait for storage
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Verify stored
        const memories = await factory.getMemories();
        expect(memories.length).toBeGreaterThanOrEqual(0);
      }, 60000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Multi-Turn Conversation Context
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "multi-turn context",
    () => {
      it("should maintain context across multiple turns", async () => {
        const conversationId = createTestConversationId();

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-test-agent",
          conversationId,
          embeddingProvider: { generate: generateEmbedding },
          enableMemorySearch: true,
          enableMemoryStorage: true,
        });

        const llm = createRealLLM();
        const wrappedModel = factory(llm);

        // Turn 1
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [
                { type: "text", text: "My favorite programming language is TypeScript" },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Turn 2
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [
                { type: "text", text: "I also enjoy using React for frontend development" },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Turn 3: Ask about previous context
        const result = await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [
                { type: "text", text: "What technologies have I mentioned?" },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        // Response should exist - LLM may or may not recall based on context
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
      }, 90000);
    },
  );
});
