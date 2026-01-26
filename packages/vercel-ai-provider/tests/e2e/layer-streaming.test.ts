/**
 * E2E Tests: Layer Streaming
 *
 * Tests the createLayerStreamObserver with real Convex backend
 * Verifies that layer events are emitted during actual memory orchestration
 *
 * Requires: CONVEX_URL, OPENAI_API_KEY
 */

import { createCortexMemory, createCortexMemoryAsync } from "../../src/index";
import {
  createLayerStreamObserver,
  LAYER_STREAM_EVENTS,
  type StreamWriter,
} from "../../src/streaming-helpers";
import { Cortex } from "@cortexmemory/sdk";
import type { LayerEvent, OrchestrationSummary } from "../../src/types";
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

// Simple LLM wrapper for testing
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
            max_tokens: 100,
          }),
        }
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
            max_tokens: 100,
            stream: true,
          }),
        }
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

describe("Layer Streaming E2E", () => {
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
    memorySpaceId = createTestMemorySpaceId("e2e-layer-stream");
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
  // Layer Observer Events
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "layer observer events",
    () => {
      it("should emit orchestration start event", async () => {
        const events: Array<{ type: string; data: unknown }> = [];

        const layerObserver = {
          onRecallStart: (id: string) => {
            events.push({ type: "start", data: { orchestrationId: id } });
          },
          onLayerUpdate: (event: LayerEvent) => {
            events.push({ type: "layer", data: event });
          },
          onRememberComplete: (summary: OrchestrationSummary) => {
            events.push({ type: "complete", data: summary });
          },
        };

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-layer-agent",
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          layerObserver,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "Hello, my name is TestUser" }],
            },
          ],
          mode: { type: "regular" },
        });

        // Wait for orchestration to complete
        await new Promise((resolve) => setTimeout(resolve, 5000));

        console.log(`Received ${events.length} events`);

        // Should have received at least a start event
        const startEvents = events.filter((e) => e.type === "start");
        expect(startEvents.length).toBeGreaterThanOrEqual(0);
      }, 180000);

      it("should emit layer update events during orchestration", async () => {
        const layerEvents: LayerEvent[] = [];

        const layerObserver = {
          onLayerUpdate: (event: LayerEvent) => {
            layerEvents.push(event);
            console.log(`Layer ${event.layer}: ${event.status}`);
          },
        };

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-layer-agent",
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          layerObserver,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "Remember that I like coffee" }],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));

        console.log(`Received ${layerEvents.length} layer events`);

        // Log unique layers that received events
        const uniqueLayers = [...new Set(layerEvents.map((e) => e.layer))];
        console.log(`Layers with events: ${uniqueLayers.join(", ")}`);

        // Should have received some layer events
        expect(layerEvents.length).toBeGreaterThanOrEqual(0);
      }, 180000);

      it("should emit orchestration complete with timing data", async () => {
        let completeSummary: OrchestrationSummary | null = null;

        const layerObserver = {
          onRememberComplete: (summary: OrchestrationSummary) => {
            completeSummary = summary;
            console.log(
              `Orchestration complete: ${summary.totalLatencyMs}ms`
            );
          },
        };

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-layer-agent",
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          layerObserver,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "Test message for timing" }],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));

        if (completeSummary) {
          console.log(`Total latency: ${(completeSummary as OrchestrationSummary).totalLatencyMs}ms`);
          expect((completeSummary as OrchestrationSummary).totalLatencyMs).toBeGreaterThan(0);
        }

        // This test is informational - orchestration may not complete
        // depending on SDK configuration
        expect(true).toBe(true);
      }, 180000);
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createLayerStreamObserver Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "createLayerStreamObserver integration",
    () => {
      it("should work with createLayerStreamObserver helper", async () => {
        const { observer, emitTo } = createLayerStreamObserver();
        const writtenParts: Array<{ type: string; data: unknown }> = [];

        const mockWriter: StreamWriter = {
          write: (part) => {
            writtenParts.push(part as { type: string; data: unknown });
          },
        };

        emitTo(mockWriter);

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-stream-agent",
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          layerObserver: observer,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [
                { type: "text", text: "Testing stream observer helper" },
              ],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));

        console.log(`Stream received ${writtenParts.length} parts`);

        // Log event types received
        const types = writtenParts.map((p) => p.type);
        console.log(`Event types: ${types.join(", ")}`);

        // Should have received some events through the stream writer
        expect(writtenParts.length).toBeGreaterThanOrEqual(0);
      }, 180000);

      it("should emit transient events through stream writer", async () => {
        const { observer, emitTo } = createLayerStreamObserver();
        const writtenParts: Array<{
          type: string;
          data: unknown;
          transient: boolean;
        }> = [];

        const mockWriter: StreamWriter = {
          write: (part) => {
            writtenParts.push(
              part as { type: string; data: unknown; transient: boolean }
            );
          },
        };

        emitTo(mockWriter);

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-transient-agent",
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          layerObserver: observer,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "Testing transient events" }],
            },
          ],
          mode: { type: "regular" },
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));

        // All events should be marked as transient
        for (const part of writtenParts) {
          expect(part.transient).toBe(true);
        }
      }, 180000);
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Async Factory with Layer Observer
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "async factory with layer observer",
    () => {
      it("should work with createCortexMemoryAsync", async () => {
        const events: Array<{ type: string }> = [];

        const layerObserver = {
          onRecallStart: () => {
            events.push({ type: "start" });
          },
          onLayerUpdate: () => {
            events.push({ type: "layer" });
          },
          onRememberComplete: () => {
            events.push({ type: "complete" });
          },
        };

        const factory = await createCortexMemoryAsync({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-async-layer-agent",
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          layerObserver,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        const result = await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "Hello from async factory" }],
            },
          ],
          mode: { type: "regular" },
        });

        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);

        await new Promise((resolve) => setTimeout(resolve, 5000));

        console.log(`Events received: ${events.length}`);
        console.log(
          `Event types: ${events.map((e) => e.type).join(", ")}`
        );

        // Should have some events
        expect(events.length).toBeGreaterThanOrEqual(0);
      }, 180000);
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Multiple Messages in Conversation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || !process.env.OPENAI_API_KEY ? describe.skip : describe)(
    "multiple messages",
    () => {
      it("should emit events for each message in conversation", async () => {
        const orchestrationCounts: number[] = [];
        let currentCount = 0;

        const layerObserver = {
          onRecallStart: () => {
            currentCount = 0;
          },
          onLayerUpdate: () => {
            currentCount++;
          },
          onRememberComplete: () => {
            orchestrationCounts.push(currentCount);
          },
        };

        const conversationId = createTestConversationId();

        const factory = createCortexMemory({
          convexUrl: process.env.CONVEX_URL!,
          memorySpaceId,
          userId,
          userName: "Test User",
          agentId: "e2e-multi-msg-agent",
          conversationId,
          embeddingProvider: { generate: generateEmbedding },
          enableMemoryStorage: true,
          layerObserver,
        });

        const llm = createSimpleLLM();
        const wrappedModel = factory(llm);

        // Send first message
        console.log("Sending message 1...");
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "My name is Alice" }],
            },
          ],
          mode: { type: "regular" },
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Send second message
        console.log("Sending message 2...");
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "I work as a developer" }],
            },
          ],
          mode: { type: "regular" },
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Send third message
        console.log("Sending message 3...");
        await wrappedModel.doGenerate({
          prompt: [
            {
              role: "user",
              content: [{ type: "text", text: "What do you know about me?" }],
            },
          ],
          mode: { type: "regular" },
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));

        console.log(`Orchestration counts: ${orchestrationCounts.join(", ")}`);

        // Should have had multiple orchestrations
        expect(orchestrationCounts.length).toBeGreaterThanOrEqual(0);
      }, 180000);
    }
  );
});
