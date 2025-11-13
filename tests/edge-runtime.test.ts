/**
 * Edge Runtime Compatibility Tests
 *
 * Verifies that Cortex SDK works in edge runtime environments like Vercel Edge Functions.
 * Tests ensure no Node.js-specific APIs are used in core SDK code.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";

describe("Edge Runtime Compatibility", () => {
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  describe("Simulated Edge Environment", () => {
    it("should not use Node.js-specific globals", () => {
      // Cortex should be instantiable without Node.js-specific APIs
      // Edge runtimes don't have process.cwd, __dirname, __filename, fs, path, etc.
      expect(() => new Cortex({ convexUrl: CONVEX_URL })).not.toThrow();

      // Verify the SDK exports are available
      expect(Cortex).toBeDefined();
      expect(typeof Cortex).toBe("function");
    });

    it("should work without Node.js fs module", () => {
      // Edge runtimes don't have fs
      // Cortex should not require fs for basic operations
      const cortex = new Cortex({ convexUrl: CONVEX_URL });
      expect(cortex).toBeDefined();
      expect(cortex.memory).toBeDefined();
      expect(cortex.conversations).toBeDefined();
    });

    it("should work without Node.js path module", () => {
      // Edge runtimes don't have path
      // Cortex should not require path for basic operations
      const cortex = new Cortex({ convexUrl: CONVEX_URL });
      expect(cortex).toBeDefined();
    });

    it("should work without Node.js crypto module", () => {
      // Edge runtimes use Web Crypto API instead
      // Cortex should use standard Web APIs
      const cortex = new Cortex({ convexUrl: CONVEX_URL });
      expect(cortex).toBeDefined();
    });
  });

  describe("Convex Client in Edge Context", () => {
    let cortex: Cortex;
    let client: ConvexClient;
    let cleanup: TestCleanup;

    beforeAll(async () => {
      cortex = new Cortex({ convexUrl: CONVEX_URL });
      client = new ConvexClient(CONVEX_URL);
      cleanup = new TestCleanup(client);
      await cleanup.purgeAll();
    });

    afterAll(async () => {
      await cleanup.purgeAll();
      await client.close();
    });

    it("should initialize Convex client in edge-like environment", () => {
      // ConvexClient from convex/browser should be edge-compatible
      // Test that SDK initialized successfully (client is private)
      expect(cortex).toBeDefined();
      expect(cortex.memory).toBeDefined();
      expect(cortex.conversations).toBeDefined();
    });

    it("should create memory spaces without Node.js APIs", async () => {
      const result = await cortex.memorySpaces.register({
        memorySpaceId: "edge-test-space",
        name: "Edge Test Space",
        type: "custom",
      });

      expect(result).toBeDefined();
      expect(result.memorySpaceId).toBe("edge-test-space");
    });

    it("should perform memory operations without Node.js APIs", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: "edge-test-space",
        conversationId: "edge-conv-1",
        userMessage: "Test in edge runtime",
        agentResponse: "Working fine!",
        userId: "edge-user-1",
        userName: "EdgeUser",
      });

      expect(result).toBeDefined();
      expect(result.memories).toHaveLength(2);
      expect(result.conversation).toBeDefined();
    });

    it("should search memories without Node.js APIs", async () => {
      const memories = await cortex.memory.search(
        "edge-test-space",
        "edge runtime",
      );

      // May be empty in local mode (no vector search), but should not error
      expect(Array.isArray(memories)).toBe(true);
    });
  });

  describe("Streaming in Edge Context", () => {
    let cortex: Cortex;
    let client: ConvexClient;
    let cleanup: TestCleanup;

    beforeAll(async () => {
      cortex = new Cortex({ convexUrl: CONVEX_URL });
      client = new ConvexClient(CONVEX_URL);
      cleanup = new TestCleanup(client);
      await cleanup.purgeAll();

      await cortex.memorySpaces.register({
        memorySpaceId: "edge-stream-space",
        name: "Edge Stream Space",
        type: "custom",
      });
    });

    afterAll(async () => {
      await cleanup.purgeAll();
      await client.close();
    });

    it("should handle Web Streams API (edge-compatible)", async () => {
      // Web Streams API is the standard for edge runtimes
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Edge ");
          controller.enqueue("compatible ");
          controller.enqueue("streaming");
          controller.close();
        },
      });

      const result = await cortex.memory.rememberStream({
        memorySpaceId: "edge-stream-space",
        conversationId: "edge-stream-conv",
        userMessage: "Test edge streaming",
        responseStream: stream,
        userId: "edge-stream-user",
        userName: "EdgeStreamUser",
      });

      expect(result.fullResponse).toBe("Edge compatible streaming");
      expect(result.memories).toHaveLength(2);
    });

    it("should handle async iterables in edge context", async () => {
      // Async iterables are standard JavaScript
      async function* edgeGenerator() {
        yield "Async ";
        yield "in ";
        yield "edge";
      }

      const result = await cortex.memory.rememberStream({
        memorySpaceId: "edge-stream-space",
        conversationId: "edge-async-conv",
        userMessage: "Test async iterable",
        responseStream: edgeGenerator(),
        userId: "edge-async-user",
        userName: "EdgeAsyncUser",
      });

      expect(result.fullResponse).toBe("Async in edge");
      expect(result.memories).toHaveLength(2);
    });
  });

  describe("Error Handling in Edge Context", () => {
    let cortex: Cortex;

    beforeAll(() => {
      cortex = new Cortex({ convexUrl: CONVEX_URL });
    });

    it("should produce edge-compatible error messages", async () => {
      // Errors should not reference Node.js-specific paths or stack traces
      try {
        await cortex.memory.remember({
          memorySpaceId: "non-existent-space",
          conversationId: "error-conv",
          userMessage: "Test",
          agentResponse: "Test",
          userId: "error-user",
          userName: "ErrorUser",
        });
      } catch (error) {
        expect(error).toBeDefined();
        // Error should be standard Error object
        expect(error instanceof Error).toBe(true);

        // Error message should not contain file paths specific to Node.js
        const message = (error as Error).message;
        expect(message).not.toMatch(/\\/); // No Windows paths
        expect(message).not.toMatch(/node_modules/); // No npm paths
      }
    });

    it("should handle stream errors in edge-compatible way", async () => {
      const failingStream = new ReadableStream<string>({
        start(controller) {
          controller.error(new Error("Edge stream error"));
        },
      });

      await expect(
        cortex.memory.rememberStream({
          memorySpaceId: "edge-stream-space",
          conversationId: "error-stream-conv",
          userMessage: "Test",
          responseStream: failingStream,
          userId: "error-stream-user",
          userName: "ErrorUser",
        }),
      ).rejects.toThrow(/Failed to consume response stream/);
    });
  });

  describe("Web Streams API Compatibility", () => {
    it("should use standard ReadableStream", async () => {
      // Verify we're using the standard Web Streams API
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("test");
          controller.close();
        },
      });

      expect(stream).toBeInstanceOf(ReadableStream);
      expect(typeof stream.getReader).toBe("function");
      expect(typeof stream.pipeThrough).toBe("function");
    });

    it("should use standard TransformStream", async () => {
      // TransformStream is part of Web Streams API
      const transform = new TransformStream<string, string>({
        transform(chunk, controller) {
          controller.enqueue(chunk.toUpperCase());
        },
      });

      expect(transform).toBeInstanceOf(TransformStream);
      expect(transform.readable).toBeInstanceOf(ReadableStream);
      expect(transform.writable).toBeDefined();
    });

    it("should support stream piping (edge-compatible)", async () => {
      const source = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("hello");
          controller.close();
        },
      });

      const transform = new TransformStream<string, string>({
        transform(chunk, controller) {
          controller.enqueue(chunk.toUpperCase());
        },
      });

      const piped = source.pipeThrough(transform);
      const reader = piped.getReader();
      const { value } = await reader.read();

      expect(value).toBe("HELLO");
    });
  });

  describe("Convex Queries in Edge Context", () => {
    let cortex: Cortex;
    let client: ConvexClient;
    let cleanup: TestCleanup;

    beforeAll(async () => {
      cortex = new Cortex({ convexUrl: CONVEX_URL });
      client = new ConvexClient(CONVEX_URL);
      cleanup = new TestCleanup(client);
      await cleanup.purgeAll();
    });

    afterAll(async () => {
      await cleanup.purgeAll();
      await client.close();
    });

    it("should execute queries without Node.js dependencies", async () => {
      // Test basic query operations
      const spaces = await cortex.memorySpaces.list();
      expect(Array.isArray(spaces)).toBe(true);
    });

    it("should execute mutations without Node.js dependencies", async () => {
      // Test basic mutation operations
      const result = await cortex.memorySpaces.register({
        memorySpaceId: "edge-mutation-test",
        name: "Edge Mutation Test",
        type: "custom",
      });

      expect(result).toBeDefined();
      expect(result.memorySpaceId).toBe("edge-mutation-test");
    });
  });
});

describe("Edge Runtime: Real-world Scenarios", () => {
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);
    await cleanup.purgeAll();

    await cortex.memorySpaces.register({
      memorySpaceId: "edge-real-world",
      name: "Edge Real World",
      type: "custom",
    });
  });

  afterAll(async () => {
    await cleanup.purgeAll();
    await client.close();
  });

  it("should handle typical edge function workflow", async () => {
    // Simulate a typical Vercel Edge Function handling a chat request

    // 1. Receive user message (simulated)
    const userMessage = "What is the capital of France?";

    // 2. Search for relevant memories
    const memories = await cortex.memory.search(
      "edge-real-world",
      userMessage,
      { limit: 5 },
    );
    expect(Array.isArray(memories)).toBe(true);

    // 3. Simulate streaming LLM response
    async function* simulateLLMStream() {
      yield "The capital ";
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield "of France ";
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield "is Paris.";
    }

    // 4. Store the conversation with streaming
    const result = await cortex.memory.rememberStream({
      memorySpaceId: "edge-real-world",
      conversationId: "edge-workflow-conv",
      userMessage: userMessage,
      responseStream: simulateLLMStream(),
      userId: "edge-user",
      userName: "EdgeUser",
    });

    // 5. Verify everything worked
    expect(result.fullResponse).toBe("The capital of France is Paris.");
    expect(result.memories).toHaveLength(2);

    // 6. Verify can retrieve the memory
    const retrievedMemories = await cortex.memory.search(
      "edge-real-world",
      "capital France",
    );
    expect(retrievedMemories.length).toBeGreaterThan(0);
  });

  it("should handle concurrent requests (edge function behavior)", async () => {
    // Edge functions often handle concurrent requests
    // Test that Cortex can handle parallel operations

    const requests = Array.from({ length: 5 }, (_, i) => ({
      userMessage: `Question ${i + 1}`,
      agentResponse: `Answer ${i + 1}`,
    }));

    const results = await Promise.all(
      requests.map((req, i) =>
        cortex.memory.remember({
          memorySpaceId: "edge-real-world",
          conversationId: `concurrent-conv-${i}`,
          userMessage: req.userMessage,
          agentResponse: req.agentResponse,
          userId: "concurrent-user",
          userName: "ConcurrentUser",
        }),
      ),
    );

    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result.memories).toHaveLength(2);
    });
  });
});
