/**
 * Streaming utilities for Vercel AI SDK integration
 */

import type { Logger } from "./types";

/**
 * Create a passthrough transform stream that observes chunks
 *
 * This allows us to collect the full response while still streaming to the client
 */
export function createObservableStream(
  onChunk?: (chunk: string) => void,
  onComplete?: (fullText: string) => Promise<void> | void,
  onError?: (error: Error) => void,
  logger?: Logger,
): TransformStream<string, string> {
  const chunks: string[] = [];

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      try {
        // Collect chunk
        chunks.push(chunk);

        // Notify chunk observer
        if (onChunk) {
          onChunk(chunk);
        }

        // Forward chunk downstream
        controller.enqueue(chunk);
      } catch (error) {
        logger?.error("Error in stream transform:", error);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
      }
    },

    async flush() {
      try {
        // Stream completed successfully
        const fullText = chunks.join("");
        logger?.debug(`Stream completed: ${fullText.length} characters`);

        if (onComplete) {
          await Promise.resolve(onComplete(fullText));
        }
      } catch (error) {
        logger?.error("Error in stream flush:", error);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    },
  });
}

/**
 * Convert async iterable to ReadableStream
 *
 * Useful for normalizing different stream types
 */
export function asyncIterableToStream<T>(
  iterable: AsyncIterable<T>,
): ReadableStream<T> {
  return new ReadableStream<T>({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Collect all chunks from a stream without consuming it
 *
 * Returns both the collected text and a new stream with the same content
 */
export async function teeAndCollect(
  stream: ReadableStream<string>,
  logger?: Logger,
): Promise<{ text: string; stream: ReadableStream<string> }> {
  const chunks: string[] = [];

  // Create a tee to avoid consuming the original stream
  const [stream1, stream2] = stream.tee();

  // Consume stream1 to collect chunks
  const reader = stream1.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } catch (error) {
    logger?.error("Error collecting from stream:", error);
    reader.releaseLock();
    throw error;
  } finally {
    reader.releaseLock();
  }

  const text = chunks.join("");
  logger?.debug(`Collected ${text.length} characters from stream`);

  // Return both the collected text and the untouched stream2
  return { text, stream: stream2 };
}

/**
 * Create a stream that completes a callback after all data flows through
 */
export function createCompletionStream(
  onComplete: (fullText: string) => Promise<void> | void,
  onError?: (error: Error) => void,
  logger?: Logger,
): TransformStream<string, string> {
  const chunks: string[] = [];

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      chunks.push(chunk);
      controller.enqueue(chunk);
    },

    async flush() {
      try {
        const fullText = chunks.join("");
        await Promise.resolve(onComplete(fullText));
      } catch (error) {
        logger?.error("Error in completion callback:", error);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    },
  });
}
