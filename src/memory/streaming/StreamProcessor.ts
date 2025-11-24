/**
 * Stream Processor
 *
 * Core stream processing with hook support, chunk handling,
 * and integration with metrics collection.
 */

import type {
  ChunkEvent,
  ProgressEvent,
  StreamCompleteEvent,
  StreamContext,
  StreamHooks,
  StreamingOptions,
} from "../../types/streaming";
import { MetricsCollector } from "./StreamMetrics";
import { isReadableStream, isAsyncIterable } from "../streamUtils";

/**
 * Core stream processor that handles chunk iteration with hooks
 */
export class StreamProcessor {
  private readonly metrics: MetricsCollector;
  private readonly hooks: StreamHooks;
  private readonly context: StreamContext;
  private accumulatedContent: string = "";
  private chunkNumber: number = 0;
  private progressCallbackCounter: number = 0;

  constructor(
    context: StreamContext,
    hooks: StreamHooks = {},
    metrics?: MetricsCollector,
  ) {
    this.context = context;
    this.hooks = hooks;
    this.metrics = metrics || new MetricsCollector();
  }

  /**
   * Process a stream and return the complete content
   */
  async processStream(
    stream: ReadableStream<string> | AsyncIterable<string>,
    options: StreamingOptions = {},
  ): Promise<string> {
    try {
      // Process chunks based on stream type
      if (isReadableStream(stream)) {
        await this.processReadableStream(stream, options);
      } else if (isAsyncIterable(stream)) {
        await this.processAsyncIterable(stream, options);
      } else {
        throw new Error(
          "Unsupported stream type. Must be ReadableStream<string> or AsyncIterable<string>",
        );
      }

      // Emit completion event
      if (this.hooks.onComplete) {
        const completeEvent: StreamCompleteEvent = {
          fullResponse: this.accumulatedContent,
          totalChunks: this.chunkNumber,
          durationMs: Date.now() - this.metrics.getSnapshot().startTime,
          factsExtracted: this.metrics.getSnapshot().factsExtracted,
        };
        await this.safelyCallHook(() => this.hooks.onComplete!(completeEvent));
      }

      return this.accumulatedContent;
    } catch (error) {
      // Emit error event
      if (this.hooks.onError) {
        await this.safelyCallHook(() =>
          this.hooks.onError!({
            code: "STREAM_PROCESSING_ERROR",
            message: error instanceof Error ? error.message : String(error),
            recoverable: false,
            partialDataSaved: false,
            context: {
              phase: "streaming",
              chunkNumber: this.chunkNumber,
              bytesProcessed: this.accumulatedContent.length,
            },
            originalError: error instanceof Error ? error : undefined,
          }),
        );
      }
      throw error;
    }
  }

  /**
   * Process a ReadableStream
   */
  private async processReadableStream(
    stream: ReadableStream<string>,
    options: StreamingOptions,
  ): Promise<void> {
    const reader = stream.getReader();

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          await this.processChunk(value, options);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process an AsyncIterable
   */
  private async processAsyncIterable(
    iterable: AsyncIterable<string>,
    options: StreamingOptions,
  ): Promise<void> {
    for await (const chunk of iterable) {
      if (chunk) {
        await this.processChunk(chunk, options);
      }
    }
  }

  /**
   * Process a single chunk
   */
  private async processChunk(
    chunk: string,
    options: StreamingOptions,
  ): Promise<void> {
    // Update state
    this.chunkNumber++;
    this.accumulatedContent += chunk;

    // Record metrics
    this.metrics.recordChunk(chunk.length);

    // Update context
    this.context.chunkCount = this.chunkNumber;
    this.context.accumulatedText = this.accumulatedContent;
    this.context.estimatedTokens = this.metrics.getSnapshot().estimatedTokens;
    this.context.elapsedMs = Date.now() - this.metrics.getSnapshot().startTime;

    // Emit chunk event
    if (this.hooks.onChunk) {
      const chunkEvent: ChunkEvent = {
        chunk,
        chunkNumber: this.chunkNumber,
        accumulated: this.accumulatedContent,
        timestamp: Date.now(),
        estimatedTokens: this.metrics.getSnapshot().estimatedTokens,
      };
      await this.safelyCallHook(() => this.hooks.onChunk!(chunkEvent));
    }

    // Emit progress event (every 10 chunks or as configured)
    const progressInterval = options.progressiveFactExtraction ? 5 : 10;
    if (this.chunkNumber % progressInterval === 0 && this.hooks.onProgress) {
      this.progressCallbackCounter++;
      const metricsSnapshot = this.metrics.getSnapshot();
      const progressEvent: ProgressEvent = {
        bytesProcessed: this.accumulatedContent.length,
        chunks: this.chunkNumber,
        elapsedMs: metricsSnapshot.streamDurationMs,
        estimatedCompletion: this.estimateCompletion(metricsSnapshot),
        currentPhase: "streaming",
      };
      await this.safelyCallHook(() => this.hooks.onProgress!(progressEvent));
    }
  }

  /**
   * Estimate completion time based on current metrics
   */
  private estimateCompletion(_metrics: unknown): number | undefined {
    // Simple heuristic: if we have at least 5 chunks, estimate based on throughput
    if (this.chunkNumber < 5) {
      return undefined;
    }

    // Assume similar throughput continues
    // This is a rough estimate and won't work for all cases
    return undefined; // Disabled for now as it requires more sophisticated prediction
  }

  /**
   * Safely call a hook, catching and logging errors without stopping processing
   */
  private async safelyCallHook(
    hookFn: () => void | Promise<void>,
  ): Promise<void> {
    try {
      await hookFn();
    } catch (error) {
      console.warn("Error in stream hook:", error);
      // Don't rethrow - hooks shouldn't break the stream
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  /**
   * Get accumulated content so far
   */
  getAccumulatedContent(): string {
    return this.accumulatedContent;
  }

  /**
   * Get current chunk number
   */
  getChunkNumber(): number {
    return this.chunkNumber;
  }

  /**
   * Get stream context
   */
  getContext(): StreamContext {
    return this.context;
  }
}

/**
 * Helper to create a StreamContext
 */
export function createStreamContext(params: {
  memorySpaceId: string;
  conversationId: string;
  userId: string;
  userName: string;
  partialMemoryId?: string;
}): StreamContext {
  return {
    memorySpaceId: params.memorySpaceId,
    conversationId: params.conversationId,
    userId: params.userId,
    userName: params.userName,
    accumulatedText: "",
    chunkCount: 0,
    estimatedTokens: 0,
    elapsedMs: 0,
    partialMemoryId: params.partialMemoryId,
    extractedFactIds: [],
    metrics: {
      startTime: Date.now(),
      firstChunkLatency: 0,
      streamDurationMs: 0,
      totalChunks: 0,
      totalBytes: 0,
      averageChunkSize: 0,
      chunksPerSecond: 0,
      factsExtracted: 0,
      partialUpdates: 0,
      errorCount: 0,
      retryCount: 0,
      estimatedTokens: 0,
    },
  };
}
