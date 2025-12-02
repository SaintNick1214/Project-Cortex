/**
 * Memory Streaming Tests
 *
 * Comprehensive tests for the rememberStream() method and stream utilities.
 * Tests both ReadableStream and AsyncIterable support.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import {
  consumeStream,
  consumeReadableStream,
  consumeAsyncIterable,
  isReadableStream,
  isAsyncIterable,
  createPassthroughStream,
} from "../src/memory/streamUtils";

describe("Memory Streaming: Stream Utilities", () => {
  describe("Type Guards", () => {
    it("should correctly identify ReadableStream", () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("test");
          controller.close();
        },
      });

      expect(isReadableStream(stream)).toBe(true);
      expect(isReadableStream("not a stream")).toBe(false);
      expect(isReadableStream(null)).toBe(false);
      expect(isReadableStream(undefined)).toBe(false);
    });

    it("should correctly identify AsyncIterable", () => {
      async function* generator() {
        yield "test";
      }

      const iterable = generator();
      expect(isAsyncIterable(iterable)).toBe(true);
      expect(isAsyncIterable("not iterable")).toBe(false);
      expect(isAsyncIterable(null)).toBe(false);
      expect(isAsyncIterable(undefined)).toBe(false);
    });
  });

  describe("consumeReadableStream", () => {
    it("should consume a simple ReadableStream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Hello ");
          controller.enqueue("World");
          controller.close();
        },
      });

      const result = await consumeReadableStream(stream);
      expect(result).toBe("Hello World");
    });

    it("should handle empty streams", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });

      const result = await consumeReadableStream(stream);
      expect(result).toBe("");
    });

    it("should handle stream errors", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Test");
          controller.error(new Error("Stream error"));
        },
      });

      await expect(consumeReadableStream(stream)).rejects.toThrow(
        /Failed to consume ReadableStream/,
      );
    });

    it("should handle large streams efficiently", async () => {
      const chunkCount = 1000;
      const stream = new ReadableStream<string>({
        start(controller) {
          for (let i = 0; i < chunkCount; i++) {
            controller.enqueue(`chunk${i} `);
          }
          controller.close();
        },
      });

      const result = await consumeReadableStream(stream);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("chunk0");
      expect(result).toContain(`chunk${chunkCount - 1}`);
    });
  });

  describe("consumeAsyncIterable", () => {
    it("should consume a simple async generator", async () => {
      async function* generator() {
        yield "Hello ";
        yield "from ";
        yield "async";
      }

      const result = await consumeAsyncIterable(generator());
      expect(result).toBe("Hello from async");
    });

    it("should handle empty iterables", async () => {
      async function* generator() {
        // Empty
      }

      const result = await consumeAsyncIterable(generator());
      expect(result).toBe("");
    });

    it("should handle async generator errors", async () => {
      async function* generator() {
        yield "Test";
        throw new Error("Generator error");
      }

      await expect(consumeAsyncIterable(generator())).rejects.toThrow(
        /Failed to consume AsyncIterable/,
      );
    });

    it("should handle delayed yields", async () => {
      async function* generator() {
        yield "First";
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield " Second";
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield " Third";
      }

      const result = await consumeAsyncIterable(generator());
      expect(result).toBe("First Second Third");
    });
  });

  describe("consumeStream", () => {
    it("should auto-detect and consume ReadableStream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Auto");
          controller.enqueue("Detect");
          controller.close();
        },
      });

      const result = await consumeStream(stream);
      expect(result).toBe("AutoDetect");
    });

    it("should auto-detect and consume AsyncIterable", async () => {
      async function* generator() {
        yield "Auto";
        yield "Iterable";
      }

      const result = await consumeStream(generator());
      expect(result).toBe("AutoIterable");
    });

    it("should reject unsupported stream types", async () => {
      await expect(consumeStream("not a stream" as any)).rejects.toThrow(
        /Unsupported stream type/,
      );
    });
  });

  describe("createPassthroughStream", () => {
    it("should forward chunks while collecting them", async () => {
      const chunks: string[] = [];
      let fullText = "";

      const passthrough = createPassthroughStream(
        (chunk) => chunks.push(chunk),
        (text) => (fullText = text),
      );

      const source = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("A");
          controller.enqueue("B");
          controller.enqueue("C");
          controller.close();
        },
      });

      const result = await consumeReadableStream(
        source.pipeThrough(passthrough),
      );

      expect(result).toBe("ABC");
      expect(chunks).toEqual(["A", "B", "C"]);
      expect(fullText).toBe("ABC");
    });

    it("should handle errors in callbacks gracefully", async () => {
      // Track console.warn calls manually
      const originalWarn = console.warn;
      let warnCalled = false;
      console.warn = (...args: any[]) => {
        warnCalled = true;
        originalWarn(...args);
      };

      const passthrough = createPassthroughStream(() => {
        throw new Error("Callback error");
      }, undefined);

      const source = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      // Should still work despite callback error
      const result = await consumeReadableStream(
        source.pipeThrough(passthrough),
      );
      expect(result).toBe("Test");
      expect(warnCalled).toBe(true);

      // Restore
      console.warn = originalWarn;
    });
  });
});

// Import ctx helper for streaming tests
import { createTestRunContext } from "./helpers/isolation";
const streamCtx = createTestRunContext();

describe("Memory Streaming: rememberStream() Integration", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = streamCtx.memorySpaceId("streaming");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);
    // NOTE: Removed purgeAll() for parallel execution compatibility.

    // Create memory space
    await cortex.memorySpaces.register({
      memorySpaceId: TEST_MEMSPACE_ID,
      name: "Streaming Test Space",
      type: "custom",
    });
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    await client.close();
  });

  describe("Basic Streaming", () => {
    it("should store a simple streamed response", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("The weather ");
          controller.enqueue("is sunny ");
          controller.enqueue("today.");
          controller.close();
        },
      });

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "stream-conv-1",
        userMessage: "What's the weather?",
        responseStream: stream,
        userId: "user-stream-1",
        userName: "StreamUser",
      });

      expect(result.fullResponse).toBe("The weather is sunny today.");
      expect(result.memories).toHaveLength(2);
      expect(result.conversation.conversationId).toBe("stream-conv-1");

      // Verify stored in database
      const memories = await cortex.memory.search(
        TEST_MEMSPACE_ID,
        "weather sunny",
      );
      expect(memories.length).toBeGreaterThan(0);
    });

    it("should handle ReadableStream from async generator", async () => {
      async function* generator() {
        yield "Hello ";
        yield "from ";
        yield "generator";
      }

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "stream-conv-2",
        userMessage: "Say hello",
        responseStream: generator(),
        userId: "user-stream-2",
        userName: "StreamUser",
      });

      expect(result.fullResponse).toBe("Hello from generator");
      expect(result.memories).toHaveLength(2);
    });
  });

  describe("AsyncIterable Support", () => {
    it("should consume async generator correctly", async () => {
      async function* responseGenerator() {
        yield "First ";
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield "Second ";
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield "Third";
      }

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "stream-conv-3",
        userMessage: "Count to three",
        responseStream: responseGenerator(),
        userId: "user-stream-3",
        userName: "StreamUser",
      });

      expect(result.fullResponse).toBe("First Second Third");
      expect(result.memories.length).toBe(2);
    });
  });

  describe("Embedding Generation with Streaming", () => {
    it("should generate embeddings for streamed content", async () => {
      // Mock embedding function
      const generateEmbedding = async (text: string): Promise<number[]> => {
        // Simple mock: length-based embedding
        return [text.length / 100, text.split(" ").length / 10];
      };

      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("This is a test ");
          controller.enqueue("of embedding ");
          controller.enqueue("generation.");
          controller.close();
        },
      });

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "stream-conv-emb",
        userMessage: "Test embeddings",
        responseStream: stream,
        userId: "user-emb",
        userName: "EmbedUser",
        generateEmbedding,
      });

      expect(result.fullResponse).toBe(
        "This is a test of embedding generation.",
      );
      expect(result.memories).toHaveLength(2);
      // Embeddings should be present (if not in local mode where vector search isn't supported)
    });
  });

  describe("Fact Extraction with Streaming", () => {
    it("should extract facts from streamed content", async () => {
      const extractFacts = async (
        userMsg: string,
        agentResp: string,
      ): Promise<any[]> => {
        if (agentResp.includes("favorite color")) {
          return [
            {
              fact: "User's favorite color is blue",
              factType: "preference",
              confidence: 95,
              subject: "user",
              predicate: "favoriteColor",
              object: "blue",
            },
          ];
        }
        return [];
      };

      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Your favorite color ");
          controller.enqueue("is blue, ");
          controller.enqueue("noted!");
          controller.close();
        },
      });

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "stream-conv-facts",
        userMessage: "My favorite color is blue",
        responseStream: stream,
        userId: "user-facts",
        userName: "FactUser",
        extractFacts,
      });

      expect(result.fullResponse).toBe("Your favorite color is blue, noted!");
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].fact).toContain("blue");
    });
  });

  describe("Error Handling", () => {
    it("should reject empty streams", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.close(); // Empty stream
        },
      });

      await expect(
        cortex.memory.rememberStream({
          memorySpaceId: TEST_MEMSPACE_ID,
          conversationId: "stream-conv-empty",
          userMessage: "Test",
          responseStream: stream,
          userId: "user-error",
          userName: "ErrorUser",
        }),
      ).rejects.toThrow(/produced no content/);
    });

    it("should handle stream errors gracefully", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Start");
          controller.error(new Error("Stream failure"));
        },
      });

      await expect(
        cortex.memory.rememberStream({
          memorySpaceId: TEST_MEMSPACE_ID,
          conversationId: "stream-conv-error",
          userMessage: "Test",
          responseStream: stream,
          userId: "user-error-2",
          userName: "ErrorUser",
        }),
      ).rejects.toThrow(/Stream failure/);
    });

    it("should handle whitespace-only responses", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("   ");
          controller.enqueue("\n\n");
          controller.close();
        },
      });

      await expect(
        cortex.memory.rememberStream({
          memorySpaceId: TEST_MEMSPACE_ID,
          conversationId: "stream-conv-whitespace",
          userMessage: "Test",
          responseStream: stream,
          userId: "user-whitespace",
          userName: "WhitespaceUser",
        }),
      ).rejects.toThrow(/produced no content/);
    });
  });

  describe("Memory Space Isolation", () => {
    it("should respect memory space boundaries", async () => {
      const space1 = "stream-space-1";
      const space2 = "stream-space-2";

      // Create both spaces
      await cortex.memorySpaces.register({
        memorySpaceId: space1,
        name: "Stream Space 1",
        type: "custom",
      });
      await cortex.memorySpaces.register({
        memorySpaceId: space2,
        name: "Stream Space 2",
        type: "custom",
      });

      // Store in space 1
      const stream1 = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Content for space 1");
          controller.close();
        },
      });

      await cortex.memory.rememberStream({
        memorySpaceId: space1,
        conversationId: "conv-space-1",
        userMessage: "Test space 1",
        responseStream: stream1,
        userId: "user-space-test",
        userName: "SpaceUser",
      });

      // Store in space 2
      const stream2 = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Content for space 2");
          controller.close();
        },
      });

      await cortex.memory.rememberStream({
        memorySpaceId: space2,
        conversationId: "conv-space-2",
        userMessage: "Test space 2",
        responseStream: stream2,
        userId: "user-space-test",
        userName: "SpaceUser",
      });

      // Verify isolation
      const memories1 = await cortex.memory.search(space1, "space");
      const memories2 = await cortex.memory.search(space2, "space");

      const space1Content = memories1
        .map((m) => ("content" in m ? m.content : m.memory.content))
        .join(" ");
      const space2Content = memories2
        .map((m) => ("content" in m ? m.content : m.memory.content))
        .join(" ");

      expect(space1Content).toContain("space 1");
      expect(space1Content).not.toContain("space 2");
      expect(space2Content).toContain("space 2");
      expect(space2Content).not.toContain("space 1");
    });
  });

  describe("Hive Mode with Streaming", () => {
    it("should track participantId in streamed memories", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Response from assistant A");
          controller.close();
        },
      });

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "hive-conv-1",
        userMessage: "Test hive mode",
        responseStream: stream,
        userId: "user-hive",
        userName: "HiveUser",
        participantId: "assistant-a",
      });

      expect(result.memories).toHaveLength(2);
      // Verify participant tracking (both memories should have participantId)
      result.memories.forEach((memory) => {
        expect(memory.participantId).toBe("assistant-a");
      });
    });
  });

  describe("Conversation Threading", () => {
    it("should handle multiple streams to same conversation", async () => {
      const conversationId = "multi-stream-conv";

      // First stream
      const stream1 = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("First response");
          controller.close();
        },
      });

      await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "First question",
        responseStream: stream1,
        userId: "user-threading",
        userName: "ThreadUser",
      });

      // Second stream
      const stream2 = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Second response");
          controller.close();
        },
      });

      await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId,
        userMessage: "Second question",
        responseStream: stream2,
        userId: "user-threading",
        userName: "ThreadUser",
      });

      // Verify conversation has both exchanges
      const conversation = await cortex.conversations.get(conversationId);
      expect(conversation).not.toBeNull();
      expect(conversation!.messageCount).toBeGreaterThanOrEqual(4); // 2 user + 2 agent
    });
  });

  describe("Large Responses", () => {
    it("should handle large streamed responses (10K+ chars)", async () => {
      const chunkSize = 100;
      const chunkCount = 150; // 15K characters

      const stream = new ReadableStream<string>({
        start(controller) {
          for (let i = 0; i < chunkCount; i++) {
            controller.enqueue("x".repeat(chunkSize));
          }
          controller.close();
        },
      });

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "large-stream-conv",
        userMessage: "Generate large response",
        responseStream: stream,
        userId: "user-large",
        userName: "LargeUser",
      });

      expect(result.fullResponse.length).toBe(chunkSize * chunkCount);
      expect(result.memories).toHaveLength(2);
    });
  });

  describe("Chunk Boundaries", () => {
    it("should preserve content across chunk boundaries", async () => {
      // Test that multi-byte characters aren't corrupted at chunk boundaries
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Hello 🌍 ");
          controller.enqueue("World 🚀 ");
          controller.enqueue("Test 💡");
          controller.close();
        },
      });

      const result = await cortex.memory.rememberStream({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: "emoji-stream-conv",
        userMessage: "Emoji test",
        responseStream: stream,
        userId: "user-emoji",
        userName: "EmojiUser",
      });

      expect(result.fullResponse).toBe("Hello 🌍 World 🚀 Test 💡");
      expect(result.fullResponse).toContain("🌍");
      expect(result.fullResponse).toContain("🚀");
      expect(result.fullResponse).toContain("💡");
    });
  });
});
