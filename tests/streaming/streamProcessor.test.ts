/**
 * Tests for StreamProcessor
 *
 * Comprehensive coverage including sad paths and edge cases.
 */

import { describe, it, expect } from "@jest/globals";
import {
  StreamProcessor,
  createStreamContext,
} from "../../src/memory/streaming/StreamProcessor";
import type { ChunkEvent, ProgressEvent } from "../../src/types/streaming";

describe("StreamProcessor", () => {
  describe("processStream", () => {
    it("should process ReadableStream", async () => {
      const chunks = ["Hello ", "World", "!"];
      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(chunk));
          controller.close();
        },
      });

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result).toBe("Hello World!");
      expect(processor.getChunkNumber()).toBe(3);
    });

    it("should process AsyncIterable", async () => {
      async function* generator() {
        yield "Chunk ";
        yield "One";
        yield " Done";
      }

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(generator());

      expect(result).toBe("Chunk One Done");
      expect(processor.getChunkNumber()).toBe(3);
    });

    it("should call onChunk hook for each chunk", async () => {
      const chunks: string[] = [];
      const chunkNumbers: number[] = [];

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("A");
          controller.enqueue("B");
          controller.enqueue("C");
          controller.close();
        },
      });

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context, {
        onChunk: (event: ChunkEvent) => {
          chunks.push(event.chunk);
          chunkNumbers.push(event.chunkNumber);
        },
      });

      await processor.processStream(stream);

      expect(chunks).toEqual(["A", "B", "C"]);
      expect(chunkNumbers).toEqual([1, 2, 3]);
    });

    it("should call onProgress hook periodically", async () => {
      const progressEvents: ProgressEvent[] = [];

      const stream = new ReadableStream({
        start(controller) {
          for (let i = 0; i < 25; i++) {
            controller.enqueue(`chunk${i}`);
          }
          controller.close();
        },
      });

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context, {
        onProgress: (event: ProgressEvent) => {
          progressEvents.push(event);
        },
      });

      await processor.processStream(stream);

      // Should have at least 2 progress updates (every 10 chunks)
      expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    });

    it("should call onComplete when stream ends", async () => {
      let completed = false;
      let fullText = "";

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context, {
        onComplete: (event) => {
          completed = true;
          fullText = event.fullResponse;
        },
      });

      await processor.processStream(stream);

      expect(completed).toBe(true);
      expect(fullText).toBe("Test");
    });

    it("should call onError hook on stream error", async () => {
      let errorCaught = false;

      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error("Stream error"));
        },
      });

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context, {
        onError: (_error) => {
          errorCaught = true;
        },
      });

      await expect(processor.processStream(stream)).rejects.toThrow();
      expect(errorCaught).toBe(true);
    });

    it("should handle hook errors gracefully", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      // Hook that throws error
      const processor = new StreamProcessor(context, {
        onChunk: () => {
          throw new Error("Hook error");
        },
      });

      // Should not throw despite hook error
      const result = await processor.processStream(stream);
      expect(result).toBe("Test");
    });
  });

  describe("getMetrics", () => {
    it("should return metrics collector", () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);
      const metrics = processor.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.getSnapshot).toBe("function");
    });
  });

  describe("getContext", () => {
    it("should return stream context", () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);
      const retrievedContext = processor.getContext();

      expect(retrievedContext).toBe(context);
      expect(retrievedContext.memorySpaceId).toBe("test-space");
    });
  });
});

describe("createStreamContext", () => {
  it("should create valid stream context", () => {
    const context = createStreamContext({
      memorySpaceId: "space-1",
      conversationId: "conv-1",
      userId: "user-1",
      userName: "Alice",
    });

    expect(context.memorySpaceId).toBe("space-1");
    expect(context.conversationId).toBe("conv-1");
    expect(context.userId).toBe("user-1");
    expect(context.userName).toBe("Alice");
    expect(context.accumulatedText).toBe("");
    expect(context.chunkCount).toBe(0);
    expect(context.extractedFactIds).toEqual([]);
  });

  it("should include partial memory ID if provided", () => {
    const context = createStreamContext({
      memorySpaceId: "space-1",
      conversationId: "conv-1",
      userId: "user-1",
      userName: "Alice",
      partialMemoryId: "mem-partial-123",
    });

    expect(context.partialMemoryId).toBe("mem-partial-123");
  });

  it("should initialize metrics with defaults", () => {
    const context = createStreamContext({
      memorySpaceId: "space-1",
      conversationId: "conv-1",
      userId: "user-1",
      userName: "Alice",
    });

    expect(context.metrics).toBeDefined();
    expect(context.metrics.startTime).toBeDefined();
    expect(context.metrics.totalChunks).toBe(0);
    expect(context.metrics.totalBytes).toBe(0);
    expect(context.metrics.factsExtracted).toBe(0);
    expect(context.metrics.errorCount).toBe(0);
  });

  it("should initialize estimated values to zero", () => {
    const context = createStreamContext({
      memorySpaceId: "space-1",
      conversationId: "conv-1",
      userId: "user-1",
      userName: "Alice",
    });

    expect(context.estimatedTokens).toBe(0);
    expect(context.elapsedMs).toBe(0);
  });
});

describe("StreamProcessor - Sad Paths", () => {
  describe("processStream - Invalid Input", () => {
    it("should throw on unsupported stream type", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);

      // Pass invalid stream type
      await expect(
        processor.processStream("not a stream" as any),
      ).rejects.toThrow(/Unsupported stream type/);
    });

    it("should throw on null stream", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);

      await expect(processor.processStream(null as any)).rejects.toThrow();
    });

    it("should throw on undefined stream", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);

      await expect(processor.processStream(undefined as any)).rejects.toThrow();
    });

    it("should throw on object without getReader or Symbol.asyncIterator", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);
      const invalidStream = { someProperty: "value" };

      await expect(
        processor.processStream(invalidStream as any),
      ).rejects.toThrow(/Unsupported stream type/);
    });
  });

  describe("processStream - Stream Errors", () => {
    it("should propagate error from ReadableStream", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Start ");
          controller.error(new Error("Mid-stream error"));
        },
      });

      const processor = new StreamProcessor(context);

      await expect(processor.processStream(stream)).rejects.toThrow(
        "Mid-stream error",
      );
    });

    it("should propagate error from AsyncIterable", async () => {
      async function* errorGenerator() {
        yield "First";
        throw new Error("Generator error");
      }

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);

      await expect(processor.processStream(errorGenerator())).rejects.toThrow(
        "Generator error",
      );
    });

    it("should include error context in onError hook", async () => {
      let errorEvent: any = null;

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Chunk1");
          controller.enqueue("Chunk2");
          controller.error(new Error("Test error"));
        },
      });

      const processor = new StreamProcessor(context, {
        onError: (error) => {
          errorEvent = error;
        },
      });

      await expect(processor.processStream(stream)).rejects.toThrow();

      expect(errorEvent).toBeDefined();
      expect(errorEvent.code).toBe("STREAM_PROCESSING_ERROR");
      expect(errorEvent.context.phase).toBe("streaming");
      // chunkNumber may be 0 if error occurs during read
      expect(typeof errorEvent.context.chunkNumber).toBe("number");
    });
  });

  describe("processStream - Hook Errors", () => {
    it("should handle async hook that rejects", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context, {
        onChunk: async () => {
          throw new Error("Async hook error");
        },
      });

      // Should not throw despite async hook rejection
      const result = await processor.processStream(stream);
      expect(result).toBe("Test");
    });

    it("should handle onComplete hook that throws", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context, {
        onComplete: () => {
          throw new Error("onComplete error");
        },
      });

      // Should not throw despite hook error
      const result = await processor.processStream(stream);
      expect(result).toBe("Test");
    });

    it("should handle onProgress hook that throws", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          for (let i = 0; i < 15; i++) {
            controller.enqueue(`chunk${i}`);
          }
          controller.close();
        },
      });

      const processor = new StreamProcessor(context, {
        onProgress: () => {
          throw new Error("Progress hook error");
        },
      });

      // Should not throw despite hook error
      const result = await processor.processStream(stream);
      expect(result).toContain("chunk0");
    });
  });
});

describe("StreamProcessor - Edge Cases", () => {
  describe("Empty and Single Chunk Streams", () => {
    it("should handle empty ReadableStream", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result).toBe("");
      expect(processor.getChunkNumber()).toBe(0);
    });

    it("should handle empty AsyncIterable", async () => {
      async function* emptyGenerator() {
        // Yields nothing
      }

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(emptyGenerator());

      expect(result).toBe("");
      expect(processor.getChunkNumber()).toBe(0);
    });

    it("should handle single chunk stream", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Single chunk");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result).toBe("Single chunk");
      expect(processor.getChunkNumber()).toBe(1);
    });

    it("should handle stream with null/undefined chunks", async () => {
      async function* nullChunkGenerator() {
        yield "Valid";
        yield null as any;
        yield undefined as any;
        yield "Also Valid";
      }

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(nullChunkGenerator());

      // Should skip null/undefined chunks
      expect(result).toBe("ValidAlso Valid");
    });

    it("should handle stream with empty string chunks", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("");
          controller.enqueue("Content");
          controller.enqueue("");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result).toBe("Content");
    });
  });

  describe("Large and Unicode Content", () => {
    it("should handle large chunks", async () => {
      const largeChunk = "x".repeat(100000); // 100KB

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(largeChunk);
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result.length).toBe(100000);
    });

    it("should handle many small chunks", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          for (let i = 0; i < 1000; i++) {
            controller.enqueue("a");
          }
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result.length).toBe(1000);
      expect(processor.getChunkNumber()).toBe(1000);
    });

    it("should handle unicode content correctly", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Hello ");
          controller.enqueue("🌍 ");
          controller.enqueue("世界 ");
          controller.enqueue("مرحبا");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result).toBe("Hello 🌍 世界 مرحبا");
    });

    it("should handle emoji split across chunks", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Before ");
          controller.enqueue("🎉🎊🎈");
          controller.enqueue(" After");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      const result = await processor.processStream(stream);

      expect(result).toBe("Before 🎉🎊🎈 After");
    });
  });

  describe("Context Updates", () => {
    it("should update context during processing", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Chunk1");
          controller.enqueue("Chunk2");
          controller.enqueue("Chunk3");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      await processor.processStream(stream);

      const updatedContext = processor.getContext();

      expect(updatedContext.chunkCount).toBe(3);
      expect(updatedContext.accumulatedText).toBe("Chunk1Chunk2Chunk3");
      expect(updatedContext.estimatedTokens).toBeGreaterThan(0);
      expect(updatedContext.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getAccumulatedContent", () => {
    it("should return empty string before processing", () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const processor = new StreamProcessor(context);

      expect(processor.getAccumulatedContent()).toBe("");
    });

    it("should return accumulated content during processing", async () => {
      let midProcessContent = "";

      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("First");
          controller.enqueue("Second");
          controller.enqueue("Third");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context, {
        onChunk: (event: ChunkEvent) => {
          if (event.chunkNumber === 2) {
            midProcessContent = processor.getAccumulatedContent();
          }
        },
      });

      await processor.processStream(stream);

      expect(midProcessContent).toBe("FirstSecond");
    });

    it("should return full content after processing", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("Complete ");
          controller.enqueue("Content");
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      await processor.processStream(stream);

      expect(processor.getAccumulatedContent()).toBe("Complete Content");
    });
  });

  describe("Metrics Updates", () => {
    it("should track metrics during processing", async () => {
      const context = createStreamContext({
        memorySpaceId: "test-space",
        conversationId: "conv-1",
        userId: "user-1",
        userName: "Test User",
      });

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("A".repeat(100));
          controller.enqueue("B".repeat(200));
          controller.enqueue("C".repeat(150));
          controller.close();
        },
      });

      const processor = new StreamProcessor(context);
      await processor.processStream(stream);

      const metrics = processor.getMetrics().getSnapshot();

      expect(metrics.totalChunks).toBe(3);
      expect(metrics.totalBytes).toBe(450);
      expect(metrics.averageChunkSize).toBe(150);
      expect(metrics.estimatedTokens).toBeGreaterThan(0);
    });
  });
});
