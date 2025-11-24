/**
 * Tests for StreamProcessor
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
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
        onError: (error) => {
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
      expect(typeof metrics.getSnapshot).toBe('function');
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
});
