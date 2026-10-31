import {
  MetricsCollector
} from "./chunk-EOYUOIQS.js";
import "./chunk-3RG5ZIWI.js";

// src/memory/streamUtils.ts
function isReadableStream(stream) {
  return typeof stream === "object" && stream !== null && "getReader" in stream && typeof stream.getReader === "function";
}
function isAsyncIterable(value) {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value && typeof value[Symbol.asyncIterator] === "function";
}

// src/memory/streaming/StreamProcessor.ts
var StreamProcessor = class {
  metrics;
  hooks;
  context;
  accumulatedContent = "";
  chunkNumber = 0;
  progressCallbackCounter = 0;
  constructor(context, hooks = {}, metrics) {
    this.context = context;
    this.hooks = hooks;
    this.metrics = metrics || new MetricsCollector();
  }
  /**
   * Process a stream and return the complete content
   */
  async processStream(stream, options = {}) {
    try {
      if (isReadableStream(stream)) {
        await this.processReadableStream(stream, options);
      } else if (isAsyncIterable(stream)) {
        await this.processAsyncIterable(stream, options);
      } else {
        throw new Error(
          "Unsupported stream type. Must be ReadableStream<string> or AsyncIterable<string>"
        );
      }
      if (this.hooks.onComplete) {
        const completeEvent = {
          fullResponse: this.accumulatedContent,
          totalChunks: this.chunkNumber,
          durationMs: Date.now() - this.metrics.getSnapshot().startTime,
          factsExtracted: this.metrics.getSnapshot().factsExtracted
        };
        await this.safelyCallHook(() => this.hooks.onComplete(completeEvent));
      }
      return this.accumulatedContent;
    } catch (error) {
      if (this.hooks.onError) {
        await this.safelyCallHook(
          () => this.hooks.onError({
            code: "STREAM_PROCESSING_ERROR",
            message: error instanceof Error ? error.message : String(error),
            recoverable: false,
            partialDataSaved: false,
            context: {
              phase: "streaming",
              chunkNumber: this.chunkNumber,
              bytesProcessed: this.accumulatedContent.length
            },
            originalError: error instanceof Error ? error : void 0
          })
        );
      }
      throw error;
    }
  }
  /**
   * Process a ReadableStream
   */
  async processReadableStream(stream, options) {
    const reader = stream.getReader();
    try {
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
  async processAsyncIterable(iterable, options) {
    for await (const chunk of iterable) {
      if (chunk) {
        await this.processChunk(chunk, options);
      }
    }
  }
  /**
   * Process a single chunk
   */
  async processChunk(chunk, options) {
    this.chunkNumber++;
    this.accumulatedContent += chunk;
    this.metrics.recordChunk(chunk.length);
    this.context.chunkCount = this.chunkNumber;
    this.context.accumulatedText = this.accumulatedContent;
    this.context.estimatedTokens = this.metrics.getSnapshot().estimatedTokens;
    this.context.elapsedMs = Date.now() - this.metrics.getSnapshot().startTime;
    if (this.hooks.onChunk) {
      const chunkEvent = {
        chunk,
        chunkNumber: this.chunkNumber,
        accumulated: this.accumulatedContent,
        timestamp: Date.now(),
        estimatedTokens: this.metrics.getSnapshot().estimatedTokens
      };
      await this.safelyCallHook(() => this.hooks.onChunk(chunkEvent));
    }
    const progressInterval = options.progressiveFactExtraction ? 5 : 10;
    if (this.chunkNumber % progressInterval === 0 && this.hooks.onProgress) {
      this.progressCallbackCounter++;
      const metricsSnapshot = this.metrics.getSnapshot();
      const progressEvent = {
        bytesProcessed: this.accumulatedContent.length,
        chunks: this.chunkNumber,
        elapsedMs: metricsSnapshot.streamDurationMs,
        estimatedCompletion: this.estimateCompletion(metricsSnapshot),
        currentPhase: "streaming"
      };
      await this.safelyCallHook(() => this.hooks.onProgress(progressEvent));
    }
  }
  /**
   * Estimate completion time based on current metrics
   */
  estimateCompletion(_metrics) {
    if (this.chunkNumber < 5) {
      return void 0;
    }
    return void 0;
  }
  /**
   * Safely call a hook, catching and logging errors without stopping processing
   */
  async safelyCallHook(hookFn) {
    try {
      await hookFn();
    } catch (error) {
      console.warn("Error in stream hook:", error);
    }
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    return this.metrics;
  }
  /**
   * Get accumulated content so far
   */
  getAccumulatedContent() {
    return this.accumulatedContent;
  }
  /**
   * Get current chunk number
   */
  getChunkNumber() {
    return this.chunkNumber;
  }
  /**
   * Get stream context
   */
  getContext() {
    return this.context;
  }
};
function createStreamContext(params) {
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
      estimatedTokens: 0
    }
  };
}
export {
  StreamProcessor,
  createStreamContext
};
