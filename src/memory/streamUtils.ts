/**
 * Stream Utility Helpers
 * 
 * Utilities for consuming and handling streaming responses in the Memory API.
 * Supports both Web Streams API (ReadableStream) and AsyncIterable.
 */

/**
 * Type guard to check if a value is a ReadableStream
 */
export function isReadableStream(
  stream: unknown,
): stream is ReadableStream<string> {
  return (
    typeof stream === "object" &&
    stream !== null &&
    "getReader" in stream &&
    typeof (stream as ReadableStream).getReader === "function"
  );
}

/**
 * Type guard to check if a value is an AsyncIterable
 */
export function isAsyncIterable(
  value: unknown,
): value is AsyncIterable<string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof (value as AsyncIterable<string>)[Symbol.asyncIterator] === "function"
  );
}

/**
 * Consume a ReadableStream and return the complete text
 * 
 * @param stream - ReadableStream to consume
 * @returns Promise resolving to the complete text
 * @throws Error if stream reading fails
 * 
 * @example
 * ```typescript
 * const stream = new ReadableStream({...});
 * const fullText = await consumeReadableStream(stream);
 * ```
 */
export async function consumeReadableStream(
  stream: ReadableStream<string>,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: string[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        chunks.push(value);
      }
    }

    return chunks.join("");
  } catch (error) {
    // Ensure reader is released on error
    reader.releaseLock();
    throw new Error(
      `Failed to consume ReadableStream: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Consume an AsyncIterable and return the complete text
 * 
 * @param iterable - AsyncIterable to consume
 * @returns Promise resolving to the complete text
 * @throws Error if iteration fails
 * 
 * @example
 * ```typescript
 * async function* generator() {
 *   yield "Hello ";
 *   yield "World";
 * }
 * const fullText = await consumeAsyncIterable(generator());
 * ```
 */
export async function consumeAsyncIterable(
  iterable: AsyncIterable<string>,
): Promise<string> {
  const chunks: string[] = [];

  try {
    for await (const chunk of iterable) {
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks.join("");
  } catch (error) {
    throw new Error(
      `Failed to consume AsyncIterable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Consume any supported stream type and return the complete text
 * 
 * Automatically detects the stream type and uses the appropriate consumer.
 * 
 * @param stream - ReadableStream or AsyncIterable to consume
 * @returns Promise resolving to the complete text
 * @throws Error if stream type is unsupported or consumption fails
 * 
 * @example
 * ```typescript
 * // Works with ReadableStream
 * const stream1 = new ReadableStream({...});
 * const text1 = await consumeStream(stream1);
 * 
 * // Works with AsyncIterable
 * async function* gen() { yield "test"; }
 * const text2 = await consumeStream(gen());
 * ```
 */
export async function consumeStream(
  stream: ReadableStream<string> | AsyncIterable<string>,
): Promise<string> {
  if (isReadableStream(stream)) {
    return consumeReadableStream(stream);
  } else if (isAsyncIterable(stream)) {
    return consumeAsyncIterable(stream);
  } else {
    throw new Error(
      "Unsupported stream type. Must be ReadableStream<string> or AsyncIterable<string>",
    );
  }
}

/**
 * Create a passthrough stream that collects chunks while forwarding them
 * 
 * Useful for observing stream content without interrupting the flow.
 * The onComplete callback receives the full text after the stream ends.
 * 
 * @param onChunk - Optional callback called for each chunk
 * @param onComplete - Optional callback called with full text when stream ends
 * @param onError - Optional callback called if stream errors
 * @returns TransformStream that can be piped
 * 
 * @example
 * ```typescript
 * const originalStream = getStreamFromSomewhere();
 * const observer = createPassthroughStream(
 *   (chunk) => console.log('Chunk:', chunk),
 *   (fullText) => console.log('Complete:', fullText)
 * );
 * const observedStream = originalStream.pipeThrough(observer);
 * ```
 */
export function createPassthroughStream(
  onChunk?: (chunk: string) => void,
  onComplete?: (fullText: string) => void,
  onError?: (error: Error) => void,
): TransformStream<string, string> {
  const chunks: string[] = [];

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      // Collect chunk
      chunks.push(chunk);

      // Notify observers
      if (onChunk) {
        try {
          onChunk(chunk);
        } catch (error) {
          console.warn("Error in onChunk callback:", error);
        }
      }

      // Forward chunk downstream
      controller.enqueue(chunk);
    },

    flush() {
      // Stream completed - notify with full text
      if (onComplete) {
        try {
          const fullText = chunks.join("");
          onComplete(fullText);
        } catch (error) {
          console.warn("Error in onComplete callback:", error);
          if (onError) {
            onError(
              error instanceof Error
                ? error
                : new Error(String(error)),
            );
          }
        }
      }
    },

    cancel(reason) {
      // Stream was cancelled
      if (onError) {
        onError(
          reason instanceof Error
            ? reason
            : new Error(`Stream cancelled: ${String(reason)}`),
        );
      }
    },
  });
}

