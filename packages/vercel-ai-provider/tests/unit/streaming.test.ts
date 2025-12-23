/**
 * Unit Tests: Streaming Utilities
 *
 * Tests for stream transformation and observation utilities
 */

import {
  createObservableStream,
  asyncIterableToStream,
  teeAndCollect,
  createCompletionStream,
} from "../../src/streaming";
import { createLogger } from "../../src/types";
import { consumeStream } from "../helpers/test-utils";

describe("Streaming Utilities", () => {
  const logger = createLogger(false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createObservableStream
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createObservableStream", () => {
    it("should forward all chunks downstream", async () => {
      const transform = createObservableStream();
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Hello ");
          controller.enqueue("World");
          controller.close();
        },
      });

      const output = input.pipeThrough(transform);
      const chunks = await consumeStream(output);

      expect(chunks).toEqual(["Hello ", "World"]);
    });

    it("should call onChunk for each chunk", async () => {
      const onChunk = jest.fn();
      const transform = createObservableStream(onChunk);

      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("A");
          controller.enqueue("B");
          controller.enqueue("C");
          controller.close();
        },
      });

      await consumeStream(input.pipeThrough(transform));

      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunk).toHaveBeenNthCalledWith(1, "A");
      expect(onChunk).toHaveBeenNthCalledWith(2, "B");
      expect(onChunk).toHaveBeenNthCalledWith(3, "C");
    });

    it("should call onComplete with full text when stream ends", async () => {
      const onComplete = jest.fn();
      const transform = createObservableStream(undefined, onComplete);

      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Hello ");
          controller.enqueue("World");
          controller.close();
        },
      });

      await consumeStream(input.pipeThrough(transform));

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith("Hello World");
    });

    it("should await async onComplete", async () => {
      let completionValue = "";
      const onComplete = jest.fn(async (text: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completionValue = text;
      });

      const transform = createObservableStream(undefined, onComplete);
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      await consumeStream(input.pipeThrough(transform));

      expect(completionValue).toBe("Test");
    });

    it("should call onError when transform throws", async () => {
      const onError = jest.fn();
      const onChunk = jest.fn(() => {
        throw new Error("Chunk error");
      });

      const transform = createObservableStream(onChunk, undefined, onError);
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      await expect(consumeStream(input.pipeThrough(transform))).rejects.toThrow(
        "Chunk error",
      );
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should call onError when onComplete throws", async () => {
      const onError = jest.fn();
      const onComplete = jest.fn(() => {
        throw new Error("Complete error");
      });

      const transform = createObservableStream(
        undefined,
        onComplete,
        onError,
        logger,
      );
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      // Consuming should complete (error is caught in flush)
      await consumeStream(input.pipeThrough(transform));
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle empty stream", async () => {
      const onComplete = jest.fn();
      const transform = createObservableStream(undefined, onComplete);

      const input = new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });

      const chunks = await consumeStream(input.pipeThrough(transform));

      expect(chunks).toEqual([]);
      expect(onComplete).toHaveBeenCalledWith("");
    });

    it("should work with logger", async () => {
      const debugLogger = createLogger(true);
      const transform = createObservableStream(
        undefined,
        undefined,
        undefined,
        debugLogger,
      );

      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Logged");
          controller.close();
        },
      });

      const chunks = await consumeStream(input.pipeThrough(transform));
      expect(chunks).toEqual(["Logged"]);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // asyncIterableToStream
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("asyncIterableToStream", () => {
    it("should convert async iterable to ReadableStream", async () => {
      async function* generator() {
        yield "A";
        yield "B";
        yield "C";
      }

      const stream = asyncIterableToStream(generator());
      const chunks = await consumeStream(stream);

      expect(chunks).toEqual(["A", "B", "C"]);
    });

    it("should handle empty async iterable", async () => {
      async function* emptyGenerator() {
        // Empty
      }

      const stream = asyncIterableToStream(emptyGenerator());
      const chunks = await consumeStream(stream);

      expect(chunks).toEqual([]);
    });

    it("should propagate errors from async iterable", async () => {
      async function* errorGenerator() {
        yield "A";
        throw new Error("Iterator error");
      }

      const stream = asyncIterableToStream(errorGenerator());

      await expect(consumeStream(stream)).rejects.toThrow("Iterator error");
    });

    it("should handle async delays in iterable", async () => {
      async function* delayedGenerator() {
        yield "First";
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield "Second";
      }

      const stream = asyncIterableToStream(delayedGenerator());
      const chunks = await consumeStream(stream);

      expect(chunks).toEqual(["First", "Second"]);
    });

    it("should handle different types", async () => {
      async function* numberGenerator() {
        yield 1;
        yield 2;
        yield 3;
      }

      const stream = asyncIterableToStream(numberGenerator());
      const chunks = await consumeStream(stream);

      expect(chunks).toEqual([1, 2, 3]);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // teeAndCollect
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("teeAndCollect", () => {
    it("should collect all text from stream", async () => {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Hello ");
          controller.enqueue("World");
          controller.close();
        },
      });

      const result = await teeAndCollect(input);

      expect(result.text).toBe("Hello World");
    });

    it("should return consumable stream copy", async () => {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("A");
          controller.enqueue("B");
          controller.close();
        },
      });

      const result = await teeAndCollect(input);

      // Original text collected
      expect(result.text).toBe("AB");

      // Stream should still be consumable
      const chunks = await consumeStream(result.stream);
      expect(chunks).toEqual(["A", "B"]);
    });

    it("should handle empty stream", async () => {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });

      const result = await teeAndCollect(input);

      expect(result.text).toBe("");
    });

    it("should propagate errors", async () => {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Start");
          controller.error(new Error("Stream error"));
        },
      });

      await expect(teeAndCollect(input)).rejects.toThrow("Stream error");
    });

    it("should work with logger", async () => {
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Logged");
          controller.close();
        },
      });

      const result = await teeAndCollect(input, logger);

      expect(result.text).toBe("Logged");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createCompletionStream
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createCompletionStream", () => {
    it("should call onComplete with full text", async () => {
      const onComplete = jest.fn();
      const transform = createCompletionStream(onComplete);

      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Hello ");
          controller.enqueue("World");
          controller.close();
        },
      });

      await consumeStream(input.pipeThrough(transform));

      expect(onComplete).toHaveBeenCalledWith("Hello World");
    });

    it("should forward all chunks", async () => {
      const transform = createCompletionStream(jest.fn());

      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("A");
          controller.enqueue("B");
          controller.close();
        },
      });

      const chunks = await consumeStream(input.pipeThrough(transform));

      expect(chunks).toEqual(["A", "B"]);
    });

    it("should await async onComplete", async () => {
      let completed = false;
      const onComplete = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed = true;
      });

      const transform = createCompletionStream(onComplete);
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      await consumeStream(input.pipeThrough(transform));

      expect(completed).toBe(true);
    });

    it("should call onError when onComplete throws", async () => {
      const onError = jest.fn();
      const onComplete = jest.fn(() => {
        throw new Error("Completion error");
      });

      const transform = createCompletionStream(onComplete, onError, logger);
      const input = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Test");
          controller.close();
        },
      });

      // Should complete without throwing (error caught in flush)
      await consumeStream(input.pipeThrough(transform));

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle empty stream", async () => {
      const onComplete = jest.fn();
      const transform = createCompletionStream(onComplete);

      const input = new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });

      await consumeStream(input.pipeThrough(transform));

      expect(onComplete).toHaveBeenCalledWith("");
    });
  });
});
