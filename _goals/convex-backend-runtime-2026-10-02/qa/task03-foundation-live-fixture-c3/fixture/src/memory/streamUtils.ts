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
            onError(error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    },
  });
}

/**
 * Create a rolling context window for streaming
 * Keeps only the last N characters in memory
 */
export class RollingContextWindow {
  private window: string[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a chunk to the window
   */
  add(chunk: string): void {
    this.window.push(chunk);

    // Trim window if it exceeds max size
    const totalSize = this.window.join("").length;
    while (totalSize > this.maxSize && this.window.length > 1) {
      this.window.shift();
    }
  }

  /**
   * Get current context
   */
  getContext(): string {
    return this.window.join("");
  }

  /**
   * Get context size
   */
  getSize(): number {
    return this.window.join("").length;
  }

  /**
   * Clear the window
   */
  clear(): void {
    this.window = [];
  }
}

/**
 * Create an async queue for processing items
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private processing: boolean = false;
  private processor?: (item: T) => Promise<void>;

  constructor(processor?: (item: T) => Promise<void>) {
    this.processor = processor;
  }

  /**
   * Enqueue an item
   */
  async enqueue(item: T): Promise<void> {
    this.queue.push(item);

    if (this.processor && !this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Dequeue an item
   */
  dequeue(): T | undefined {
    return this.queue.shift();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Process all items in queue
   */
  private async processQueue(): Promise<void> {
    if (!this.processor || this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        try {
          await this.processor(item);
        } catch (error) {
          console.error("Error processing queue item:", error);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }
}

/**
 * Create a tee for a stream (split into multiple consumers)
 */
export function teeStream<T>(
  stream: ReadableStream<T>,
): [ReadableStream<T>, ReadableStream<T>] {
  return stream.tee();
}

/**
 * Create a timeout wrapper for a stream
 */
export function withStreamTimeout<T>(
  stream: ReadableStream<T>,
  timeoutMs: number,
): ReadableStream<T> {
  let timeoutId: NodeJS.Timeout;

  return new ReadableStream<T>({
    async start(controller) {
      const reader = stream.getReader();

      // Set timeout
      timeoutId = setTimeout(() => {
        controller.error(new Error(`Stream timeout after ${timeoutMs}ms`));
        void reader.cancel();
      }, timeoutMs);

      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            clearTimeout(timeoutId);
            controller.close();
            break;
          }

          controller.enqueue(value);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },

    cancel() {
      clearTimeout(timeoutId);
    },
  });
}

/**
 * Create a length-limited stream
 */
export function withMaxLength(
  stream: ReadableStream<string>,
  maxLength: number,
): ReadableStream<string> {
  let totalLength = 0;

  return new ReadableStream<string>({
    async start(controller) {
      const reader = stream.getReader();

      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            break;
          }

          totalLength += value.length;

          if (totalLength > maxLength) {
            controller.error(
              new Error(`Stream exceeded max length of ${maxLength}`),
            );
            void reader.cancel();
            break;
          }

          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

/**
 * Buffer stream chunks for batch processing
 */
export function bufferStream(
  stream: ReadableStream<string>,
  bufferSize: number,
): ReadableStream<string[]> {
  let buffer: string[] = [];

  return new ReadableStream<string[]>({
    async start(controller) {
      const reader = stream.getReader();

      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Emit remaining buffer
            if (buffer.length > 0) {
              controller.enqueue([...buffer]);
            }
            controller.close();
            break;
          }

          buffer.push(value);

          // Emit buffer when it reaches size
          if (buffer.length >= bufferSize) {
            controller.enqueue([...buffer]);
            buffer = [];
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}
