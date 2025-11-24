/**
 * Integration tests for rememberStream API
 *
 * Tests the complete streaming workflow including:
 * - Progressive storage
 * - Fact extraction
 * - Error recovery
 * - Metrics collection
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "@jest/globals";
import { Cortex } from "../../src";
import { ConvexClient } from "convex/browser";

// Test configuration
const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const TEST_MEMORY_SPACE = "test-streaming-space";
const TEST_USER_ID = "test-user-streaming";

describe("rememberStream Integration Tests", () => {
  let cortex: Cortex;
  let client: ConvexClient;

  beforeAll(async () => {
    // Initialize Cortex client
    client = new ConvexClient(CONVEX_URL);
    cortex = new Cortex({ convexUrl: CONVEX_URL });

    // Wait for client to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup
    if (client) {
      client.close();
    }
  });

  describe("Basic Streaming", () => {
    it("should process simple stream and store memory", async () => {
      // Create a simple stream
      async function* testStream() {
        yield "Hello ";
        yield "from ";
        yield "stream";
      }

      const conversationId = `conv-stream-${Date.now()}`;

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationId,
        userMessage: "Say hello",
        responseStream: testStream(),
        userId: TEST_USER_ID,
        userName: "Test User",
      });

      expect(result.fullResponse).toBe("Hello from stream");
      expect(result.conversation.conversationId).toBe(conversationId);
      expect(result.memories.length).toBe(2); // user + agent
      expect(result.streamMetrics).toBeDefined();
      expect(result.streamMetrics.totalChunks).toBe(3);
    });

    it("should handle ReadableStream", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Chunk ");
          controller.enqueue("One");
          controller.close();
        },
      });

      const conversationId = `conv-readable-${Date.now()}`;

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationId,
        userMessage: "Test readable",
        responseStream: stream,
        userId: TEST_USER_ID,
        userName: "Test User",
      });

      expect(result.fullResponse).toBe("Chunk One");
      expect(result.streamMetrics.totalChunks).toBe(2);
    });
  });

  describe("Progressive Features", () => {
    it("should call streaming hooks", async () => {
      const chunks: string[] = [];
      let progressCallbacks = 0;
      let completed = false;

      async function* testStream() {
        for (let i = 0; i < 15; i++) {
          yield `chunk${i} `;
        }
      }

      const conversationId = `conv-hooks-${Date.now()}`;

      const result = await cortex.memory.rememberStream(
        {
          memorySpaceId: TEST_MEMORY_SPACE,
          conversationId,
          userMessage: "Test hooks",
          responseStream: testStream(),
          userId: TEST_USER_ID,
          userName: "Test User",
        },
        {
          hooks: {
            onChunk: (_event) => {
              chunks.push(event.chunk);
            },
            onProgress: (_event) => {
              progressCallbacks++;
            },
            onComplete: (_event) => {
              completed = true;
            },
          },
        },
      );

      expect(chunks.length).toBe(15);
      expect(progressCallbacks).toBeGreaterThan(0);
      expect(completed).toBe(true);
      expect(result.fullResponse).toContain("chunk0");
    });

    it("should provide detailed metrics", async () => {
      async function* testStream() {
        yield "A".repeat(100);
        yield "B".repeat(200);
        yield "C".repeat(150);
      }

      const conversationId = `conv-metrics-${Date.now()}`;

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationId,
        userMessage: "Test metrics",
        responseStream: testStream(),
        userId: TEST_USER_ID,
        userName: "Test User",
      });

      expect(result.streamMetrics).toBeDefined();
      expect(result.streamMetrics.totalChunks).toBe(3);
      expect(result.streamMetrics.totalBytes).toBe(450);
      expect(result.streamMetrics.averageChunkSize).toBeCloseTo(150, 0);
      expect(result.streamMetrics.estimatedTokens).toBeGreaterThan(0);
      expect(result.streamMetrics.firstChunkLatency).toBeGreaterThanOrEqual(0);
    });

    it("should provide performance insights", async () => {
      async function* slowStream() {
        yield "Slow ";
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield "stream ";
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield "here";
      }

      const conversationId = `conv-insights-${Date.now()}`;

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationId,
        userMessage: "Test insights",
        responseStream: slowStream(),
        userId: TEST_USER_ID,
        userName: "Test User",
      });

      expect(result.performance).toBeDefined();
      expect(result.performance?.bottlenecks).toBeDefined();
      expect(result.performance?.recommendations).toBeDefined();
    }, 10000);
  });

  describe("Error Handling", () => {
    it("should handle empty streams", async () => {
      async function* emptyStream() {
        // Yields nothing
      }

      const conversationId = `conv-empty-${Date.now()}`;

      await expect(
        cortex.memory.rememberStream({
          memorySpaceId: TEST_MEMORY_SPACE,
          conversationId,
          userMessage: "Empty test",
          responseStream: emptyStream(),
          userId: TEST_USER_ID,
          userName: "Test User",
        }),
      ).rejects.toThrow(/no content/i);
    });

    it("should handle stream errors", async () => {
      async function* errorStream() {
        yield "Start ";
        throw new Error("Stream error");
      }

      const conversationId = `conv-error-${Date.now()}`;

      await expect(
        cortex.memory.rememberStream({
          memorySpaceId: TEST_MEMORY_SPACE,
          conversationId,
          userMessage: "Error test",
          responseStream: errorStream(),
          userId: TEST_USER_ID,
          userName: "Test User",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Backward Compatibility", () => {
    it("should work with minimal parameters (old API)", async () => {
      async function* simpleStream() {
        yield "Simple response";
      }

      const conversationId = `conv-compat-${Date.now()}`;

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationId,
        userMessage: "Compatibility test",
        responseStream: simpleStream(),
        userId: TEST_USER_ID,
        userName: "Test User",
      });

      // Old API fields still work
      expect(result.fullResponse).toBe("Simple response");
      expect(result.conversation).toBeDefined();
      expect(result.memories).toBeDefined();

      // New API fields are present
      expect(result.streamMetrics).toBeDefined();
    });
  });

  describe("Content Validation", () => {
    it("should store correct content in memories", async () => {
      async function* contentStream() {
        yield "The ";
        yield "password ";
        yield "is ";
        yield "Blue123";
      }

      const conversationId = `conv-content-${Date.now()}`;

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationId,
        userMessage: "What is the password?",
        responseStream: contentStream(),
        userId: TEST_USER_ID,
        userName: "Test User",
      });

      expect(result.fullResponse).toBe("The password is Blue123");

      // Verify memory was stored correctly
      // Note: result.memories includes both user message and agent response
      const agentMemory = result.memories.find(
        (m) => m.content === "The password is Blue123",
      );
      expect(agentMemory).toBeDefined();
      expect(agentMemory?.content).toBe("The password is Blue123");
    });

    it("should preserve importance and tags", async () => {
      async function* stream() {
        yield "Important information";
      }

      const conversationId = `conv-metadata-${Date.now()}`;

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMORY_SPACE,
        conversationId,
        userMessage: "Tell me something important",
        responseStream: stream(),
        userId: TEST_USER_ID,
        userName: "Test User",
        importance: 90,
        tags: ["critical", "security"],
      });

      const agentMemory = result.memories.find((m) =>
        m.content.includes("Important"),
      );
      expect(agentMemory?.importance).toBe(90);
      expect(agentMemory?.tags).toContain("critical");
      expect(agentMemory?.tags).toContain("security");
    });
  });
});
