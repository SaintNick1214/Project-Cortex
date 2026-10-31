"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// convex-dev/_generated/api.js
var api_exports = {};
__export(api_exports, {
  api: () => api,
  components: () => components,
  internal: () => internal
});
var import_server, api, internal, components;
var init_api = __esm({
  "convex-dev/_generated/api.js"() {
    "use strict";
    import_server = require("convex/server");
    api = import_server.anyApi;
    internal = import_server.anyApi;
    components = (0, import_server.componentsGeneric)();
  }
});

// src/domain/deduplication.ts
function normalizeFactText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,!?;:'"]+/g, "").replace(/\b(the|a|an|is|are|was|were|be|been|being)\b/gi, "").trim();
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  for (let index = 0; index < a.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(a, index) || !Object.prototype.hasOwnProperty.call(b, index) || !Number.isFinite(a[index]) || !Number.isFinite(b[index])) {
      throw new Error("Embedding coordinates must be dense and finite");
    }
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
}
var init_deduplication = __esm({
  "src/domain/deduplication.ts"() {
    "use strict";
  }
});

// src/facts/deduplication.ts
var FactDeduplicationService;
var init_deduplication2 = __esm({
  "src/facts/deduplication.ts"() {
    "use strict";
    init_api();
    init_deduplication();
    init_deduplication();
    FactDeduplicationService = class {
      constructor(client) {
        this.client = client;
      }
      /**
       * Find a duplicate fact in the database
       *
       * @param candidate - The fact to check for duplicates
       * @param memorySpaceId - Memory space to search in
       * @param config - Deduplication configuration
       * @param userId - Optional user ID filter
       * @returns Duplicate detection result
       */
      async findDuplicate(candidate, memorySpaceId, config, userId) {
        if (config.strategy === "none") {
          return { isDuplicate: false };
        }
        if (config.strategy === "structural" || config.strategy === "semantic") {
          const structuralMatch = await this.findStructuralMatch(
            candidate,
            memorySpaceId,
            userId
          );
          if (structuralMatch) {
            return {
              isDuplicate: true,
              existingFact: structuralMatch,
              similarityScore: 1,
              matchedBy: "structural",
              shouldUpdate: candidate.confidence > structuralMatch.confidence
            };
          }
        }
        if (config.strategy === "exact" || config.strategy === "semantic") {
          const exactMatch = await this.findExactMatch(
            candidate,
            memorySpaceId,
            userId
          );
          if (exactMatch) {
            return {
              isDuplicate: true,
              existingFact: exactMatch,
              similarityScore: 1,
              matchedBy: "exact",
              shouldUpdate: candidate.confidence > exactMatch.confidence
            };
          }
        }
        if (config.strategy === "semantic") {
          if (!config.generateEmbedding) {
            console.warn(
              "[Cortex] Semantic deduplication requested but no generateEmbedding function provided. Falling back to structural."
            );
            return { isDuplicate: false };
          }
          const semanticMatch = await this.findSemanticMatch(
            candidate,
            memorySpaceId,
            config.generateEmbedding,
            config.similarityThreshold ?? 0.85,
            userId
          );
          if (semanticMatch) {
            return {
              isDuplicate: true,
              existingFact: semanticMatch.fact,
              similarityScore: semanticMatch.score,
              matchedBy: "semantic",
              shouldUpdate: candidate.confidence > semanticMatch.fact.confidence
            };
          }
        }
        return { isDuplicate: false };
      }
      /**
       * Find a fact with matching subject, predicate, and object
       */
      async findStructuralMatch(candidate, memorySpaceId, userId) {
        if (!candidate.subject || !candidate.predicate && !candidate.object) {
          return null;
        }
        try {
          const facts = await this.client.query(api.facts.findByStructure, {
            memorySpaceId,
            subject: candidate.subject,
            predicate: candidate.predicate,
            object: candidate.object,
            userId,
            limit: 1
          });
          return facts && facts.length > 0 ? facts[0] : null;
        } catch {
          return null;
        }
      }
      /**
       * Find a fact with matching normalized text
       */
      async findExactMatch(candidate, memorySpaceId, userId) {
        const normalizedCandidate = normalizeFactText(candidate.fact);
        const facts = await this.client.query(api.facts.list, {
          memorySpaceId,
          userId,
          factType: candidate.factType,
          limit: 100
          // Check first 100 facts
        });
        for (const fact of facts) {
          const normalizedExisting = normalizeFactText(fact.fact);
          if (normalizedCandidate === normalizedExisting) {
            return fact;
          }
        }
        return null;
      }
      /**
       * Find a semantically similar fact using embeddings
       */
      async findSemanticMatch(candidate, memorySpaceId, generateEmbedding, threshold, userId) {
        const candidateEmbedding = await generateEmbedding(candidate.fact);
        const facts = await this.client.query(api.facts.list, {
          memorySpaceId,
          userId,
          factType: candidate.factType,
          limit: 50
          // Limit for performance
        });
        let bestMatch = null;
        for (const fact of facts) {
          const existingEmbedding = await generateEmbedding(fact.fact);
          const score = cosineSimilarity(candidateEmbedding, existingEmbedding);
          if (score >= threshold) {
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { fact, score };
            }
          }
        }
        return bestMatch;
      }
      /**
       * Get default deduplication config for a given strategy
       */
      static getDefaultConfig(strategy, generateEmbedding) {
        return {
          strategy,
          similarityThreshold: 0.85,
          generateEmbedding
        };
      }
      /**
       * Resolve deduplication config with fallbacks
       *
       * If semantic is requested but no embedding function is available,
       * falls back to structural.
       */
      static resolveConfig(config, fallbackEmbedding) {
        if (typeof config === "string") {
          config = { strategy: config };
        }
        if (!config) {
          config = { strategy: "semantic" };
        }
        if (!config.generateEmbedding && fallbackEmbedding) {
          config.generateEmbedding = fallbackEmbedding;
        }
        if (config.strategy === "semantic" && !config.generateEmbedding) {
          console.warn(
            "[Cortex] Semantic deduplication requested but no generateEmbedding function available. Falling back to structural strategy."
          );
          return {
            ...config,
            strategy: "structural"
          };
        }
        return config;
      }
    };
  }
});

// src/memory/streaming/StreamMetrics.ts
var StreamMetrics_exports = {};
__export(StreamMetrics_exports, {
  MetricsCollector: () => MetricsCollector
});
var MetricsCollector;
var init_StreamMetrics = __esm({
  "src/memory/streaming/StreamMetrics.ts"() {
    "use strict";
    MetricsCollector = class {
      startTime;
      firstChunkTime = null;
      chunkSizes = [];
      chunkTimestamps = [];
      factsCount = 0;
      partialUpdateCount = 0;
      errorCount = 0;
      retryCount = 0;
      tokenEstimate = 0;
      constructor() {
        this.startTime = Date.now();
      }
      /**
       * Record a received chunk
       */
      recordChunk(size) {
        const now = Date.now();
        if (this.firstChunkTime === null) {
          this.firstChunkTime = now;
        }
        this.chunkSizes.push(size);
        this.chunkTimestamps.push(now);
        this.tokenEstimate += Math.ceil(size / 4);
      }
      /**
       * Record fact extraction
       */
      recordFactExtraction(count) {
        this.factsCount += count;
      }
      /**
       * Record partial storage update
       */
      recordPartialUpdate() {
        this.partialUpdateCount++;
      }
      /**
       * Record an error occurrence
       */
      recordError(_error) {
        this.errorCount++;
      }
      /**
       * Record a retry attempt
       */
      recordRetry() {
        this.retryCount++;
      }
      /**
       * Get current metrics snapshot
       */
      getSnapshot() {
        const now = Date.now();
        const duration = now - this.startTime;
        const totalBytes = this.chunkSizes.reduce((sum, size) => sum + size, 0);
        const totalChunks = this.chunkSizes.length;
        return {
          // Timing
          startTime: this.startTime,
          firstChunkLatency: this.firstChunkTime ? this.firstChunkTime - this.startTime : 0,
          streamDurationMs: duration,
          // Throughput
          totalChunks,
          totalBytes,
          averageChunkSize: totalChunks > 0 ? totalBytes / totalChunks : 0,
          chunksPerSecond: duration > 0 ? totalChunks / duration * 1e3 : 0,
          // Processing
          factsExtracted: this.factsCount,
          partialUpdates: this.partialUpdateCount,
          errorCount: this.errorCount,
          retryCount: this.retryCount,
          // Estimates
          estimatedTokens: this.tokenEstimate,
          estimatedCost: this.calculateCost(this.tokenEstimate)
        };
      }
      /**
       * Calculate estimated cost based on tokens
       * Using GPT-4 pricing as baseline: ~$0.03/1K input tokens, $0.06/1K output tokens
       */
      calculateCost(tokens) {
        if (tokens === 0) return void 0;
        const costPer1K = 0.06;
        return tokens / 1e3 * costPer1K;
      }
      /**
       * Get chunk size statistics
       */
      getChunkStats() {
        if (this.chunkSizes.length === 0) {
          return { min: 0, max: 0, median: 0, stdDev: 0 };
        }
        const sorted = [...this.chunkSizes].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];
        const mean = this.chunkSizes.reduce((sum, size) => sum + size, 0) / this.chunkSizes.length;
        const variance = this.chunkSizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / this.chunkSizes.length;
        const stdDev = Math.sqrt(variance);
        return { min, max, median, stdDev };
      }
      /**
       * Get timing statistics
       */
      getTimingStats() {
        if (this.chunkTimestamps.length < 2) {
          return { averageInterChunkDelay: 0, minDelay: 0, maxDelay: 0 };
        }
        const delays = [];
        for (let i = 1; i < this.chunkTimestamps.length; i++) {
          delays.push(this.chunkTimestamps[i] - this.chunkTimestamps[i - 1]);
        }
        const averageInterChunkDelay = delays.reduce((sum, d) => sum + d, 0) / delays.length;
        const minDelay = Math.min(...delays);
        const maxDelay = Math.max(...delays);
        return { averageInterChunkDelay, minDelay, maxDelay };
      }
      /**
       * Detect stream characteristics
       */
      detectStreamType() {
        const timingStats = this.getTimingStats();
        const chunkStats = this.getChunkStats();
        if (timingStats.averageInterChunkDelay < 50) {
          return "fast";
        }
        if (timingStats.averageInterChunkDelay > 500) {
          return "slow";
        }
        const timingVariance = (timingStats.maxDelay - timingStats.minDelay) / timingStats.averageInterChunkDelay;
        if (timingVariance > 2 || chunkStats.stdDev > chunkStats.median) {
          return "bursty";
        }
        return "steady";
      }
      /**
       * Reset metrics (useful for testing or reuse)
       */
      reset() {
        this.startTime = Date.now();
        this.firstChunkTime = null;
        this.chunkSizes = [];
        this.chunkTimestamps = [];
        this.factsCount = 0;
        this.partialUpdateCount = 0;
        this.errorCount = 0;
        this.retryCount = 0;
        this.tokenEstimate = 0;
      }
      /**
       * Generate performance insights based on metrics
       */
      generateInsights() {
        const metrics = this.getSnapshot();
        const bottlenecks = [];
        const recommendations = [];
        if (metrics.firstChunkLatency > 2e3) {
          bottlenecks.push("High first chunk latency (> 2s)");
          recommendations.push(
            "Consider optimizing LLM prompt or switching to a faster model"
          );
        }
        if (metrics.chunksPerSecond < 1 && metrics.totalChunks > 10) {
          bottlenecks.push("Low throughput (< 1 chunk/second)");
          recommendations.push(
            "Stream may be slow, consider using progressive storage"
          );
        }
        const errorRate = metrics.totalChunks > 0 ? metrics.errorCount / metrics.totalChunks : 0;
        if (errorRate > 0.1) {
          bottlenecks.push(`High error rate (${(errorRate * 100).toFixed(1)}%)`);
          recommendations.push("Implement retry logic or check network stability");
        }
        if (metrics.factsExtracted === 0 && metrics.totalBytes > 1e3) {
          recommendations.push(
            "No facts extracted - consider enabling progressive fact extraction"
          );
        }
        if (metrics.partialUpdates === 0 && metrics.streamDurationMs > 5e3) {
          recommendations.push(
            "Long stream with no partial updates - enable progressive storage for better resilience"
          );
        }
        if (metrics.estimatedCost && metrics.estimatedCost > 1) {
          recommendations.push(
            `High estimated cost ($${metrics.estimatedCost.toFixed(2)}) - consider response length limits`
          );
        }
        return { bottlenecks, recommendations };
      }
    };
  }
});

// src/memory/streamUtils.ts
function isReadableStream(stream) {
  return typeof stream === "object" && stream !== null && "getReader" in stream && typeof stream.getReader === "function";
}
function isAsyncIterable(value) {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value && typeof value[Symbol.asyncIterator] === "function";
}
var init_streamUtils = __esm({
  "src/memory/streamUtils.ts"() {
    "use strict";
  }
});

// src/memory/streaming/StreamProcessor.ts
var StreamProcessor_exports = {};
__export(StreamProcessor_exports, {
  StreamProcessor: () => StreamProcessor,
  createStreamContext: () => createStreamContext
});
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
var StreamProcessor;
var init_StreamProcessor = __esm({
  "src/memory/streaming/StreamProcessor.ts"() {
    "use strict";
    init_StreamMetrics();
    init_streamUtils();
    StreamProcessor = class {
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
  }
});

// src/memory/streaming/ProgressiveStorageHandler.ts
var ProgressiveStorageHandler_exports = {};
__export(ProgressiveStorageHandler_exports, {
  ProgressiveStorageHandler: () => ProgressiveStorageHandler,
  calculateOptimalUpdateInterval: () => calculateOptimalUpdateInterval
});
function calculateOptimalUpdateInterval(averageChunkSize, chunksPerSecond) {
  if (chunksPerSecond > 10) {
    return 5e3;
  }
  if (chunksPerSecond < 1) {
    return 1e3;
  }
  return 3e3;
}
var ProgressiveStorageHandler;
var init_ProgressiveStorageHandler = __esm({
  "src/memory/streaming/ProgressiveStorageHandler.ts"() {
    "use strict";
    init_api();
    ProgressiveStorageHandler = class {
      client;
      memorySpaceId;
      conversationId;
      userId;
      updateInterval;
      partialMemoryId = null;
      lastUpdateTime = 0;
      updateHistory = [];
      isInitialized = false;
      isFinalized = false;
      constructor(client, memorySpaceId, conversationId, userId, updateInterval = 3e3) {
        this.client = client;
        this.memorySpaceId = memorySpaceId;
        this.conversationId = conversationId;
        this.userId = userId;
        this.updateInterval = updateInterval;
      }
      /**
       * Initialize partial memory storage
       * Creates the initial partial memory record
       */
      async initializePartialMemory(params) {
        if (this.isInitialized) {
          throw new Error("Partial memory already initialized");
        }
        try {
          const result = await this.client.mutation(
            api.memories.storePartialMemory,
            {
              memorySpaceId: this.memorySpaceId,
              participantId: params.participantId,
              conversationId: this.conversationId,
              userId: this.userId,
              content: "[Streaming in progress...]",
              isPartial: true,
              metadata: {
                userMessage: params.userMessage,
                streamStartTime: Date.now()
              },
              importance: params.importance || 50,
              tags: [...params.tags || [], "streaming", "partial"]
            }
          );
          this.partialMemoryId = result.memoryId;
          this.isInitialized = true;
          this.lastUpdateTime = Date.now();
          return this.partialMemoryId;
        } catch (error) {
          throw new Error(
            `Failed to initialize partial memory: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      /**
       * Update partial memory content
       * Only updates if enough time has passed since last update
       */
      async updatePartialContent(content, chunkNumber, force = false) {
        if (!this.isInitialized || !this.partialMemoryId) {
          throw new Error("Partial memory not initialized");
        }
        if (this.isFinalized) {
          return false;
        }
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        if (!force && timeSinceLastUpdate < this.updateInterval) {
          return false;
        }
        try {
          await this.client.mutation(api.memories.updatePartialMemory, {
            memoryId: this.partialMemoryId,
            content,
            metadata: {
              lastUpdateTime: now,
              currentChunk: chunkNumber,
              contentLength: content.length
            }
          });
          this.lastUpdateTime = now;
          this.updateHistory.push({
            timestamp: now,
            memoryId: this.partialMemoryId,
            contentLength: content.length,
            chunkNumber
          });
          return true;
        } catch (error) {
          console.warn("Failed to update partial memory:", error);
          return false;
        }
      }
      /**
       * Finalize the partial memory with complete content
       * Marks the memory as complete and removes partial flags
       */
      async finalizeMemory(fullContent, embedding) {
        if (!this.isInitialized || !this.partialMemoryId) {
          throw new Error("Partial memory not initialized");
        }
        if (this.isFinalized) {
          return;
        }
        try {
          await this.client.mutation(api.memories.finalizePartialMemory, {
            memoryId: this.partialMemoryId,
            content: fullContent,
            embedding,
            metadata: {
              streamCompleteTime: Date.now(),
              totalUpdates: this.updateHistory.length,
              finalContentLength: fullContent.length
            }
          });
          this.isFinalized = true;
        } catch (error) {
          throw new Error(
            `Failed to finalize partial memory: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      /**
       * Rollback/delete the partial memory
       * Used when stream fails and we want to clean up
       */
      async rollback() {
        if (!this.partialMemoryId) {
          return;
        }
        try {
          await this.client.mutation(api.memories.deleteMemory, {
            memorySpaceId: this.memorySpaceId,
            memoryId: this.partialMemoryId
          });
          this.partialMemoryId = null;
          this.isInitialized = false;
          this.isFinalized = false;
          this.updateHistory = [];
        } catch (error) {
          console.warn("Failed to rollback partial memory:", error);
        }
      }
      /**
       * Check if update should happen based on interval
       */
      shouldUpdate() {
        if (!this.isInitialized || this.isFinalized) {
          return false;
        }
        const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
        return timeSinceLastUpdate >= this.updateInterval;
      }
      /**
       * Get the partial memory ID
       */
      getPartialMemoryId() {
        return this.partialMemoryId;
      }
      /**
       * Get update history
       */
      getUpdateHistory() {
        return [...this.updateHistory];
      }
      /**
       * Check if initialized
       */
      isReady() {
        return this.isInitialized && !this.isFinalized;
      }
      /**
       * Check if finalized
       */
      isComplete() {
        return this.isFinalized;
      }
    };
  }
});

// src/memory/streaming/FactExtractor.ts
var FactExtractor_exports = {};
__export(FactExtractor_exports, {
  ProgressiveFactExtractor: () => ProgressiveFactExtractor
});
var ProgressiveFactExtractor;
var init_FactExtractor = __esm({
  "src/memory/streaming/FactExtractor.ts"() {
    "use strict";
    init_deduplication2();
    ProgressiveFactExtractor = class {
      factsAPI;
      extractionThreshold;
      memorySpaceId;
      userId;
      participantId;
      deduplicationConfig;
      extractedFacts = /* @__PURE__ */ new Map();
      lastExtractionPoint = 0;
      extractionCount = 0;
      constructor(factsAPI, memorySpaceId, userId, participantId, config) {
        this.factsAPI = factsAPI;
        this.memorySpaceId = memorySpaceId;
        this.userId = userId;
        this.participantId = participantId;
        this.extractionThreshold = config?.extractionThreshold ?? 500;
        if (config?.deduplication !== false) {
          this.deduplicationConfig = FactDeduplicationService.resolveConfig(
            config?.deduplication ?? "structural"
          );
        }
      }
      /**
       * Check if we should extract facts based on content length
       */
      shouldExtract(contentLength) {
        return contentLength - this.lastExtractionPoint >= this.extractionThreshold;
      }
      /**
       * Extract facts from a chunk of content
       */
      async extractFromChunk(content, chunkNumber, extractFacts, userMessage, conversationId) {
        const newFacts = [];
        try {
          const factsToStore = await extractFacts(userMessage, content);
          if (!factsToStore || factsToStore.length === 0) {
            this.lastExtractionPoint = content.length;
            return newFacts;
          }
          for (const factData of factsToStore) {
            const factKey = this.generateFactKey(factData.fact, factData.subject);
            if (this.extractedFacts.has(factKey)) {
              const existing = this.extractedFacts.get(factKey);
              if (factData.confidence > existing.confidence) {
                try {
                  await this.factsAPI.update(
                    this.memorySpaceId,
                    existing.factId,
                    { confidence: factData.confidence }
                  );
                } catch (error) {
                  console.warn("Failed to update fact confidence:", error);
                }
              }
              continue;
            }
            try {
              const storeParams = {
                memorySpaceId: this.memorySpaceId,
                participantId: this.participantId,
                userId: this.userId,
                fact: factData.fact,
                factType: factData.factType,
                subject: factData.subject || this.userId,
                predicate: factData.predicate,
                object: factData.object,
                confidence: factData.confidence,
                sourceType: "conversation",
                sourceRef: {
                  conversationId,
                  messageIds: []
                },
                tags: [
                  ...factData.tags || [],
                  "progressive",
                  `chunk-${chunkNumber}`
                ]
              };
              let storedFact;
              let wasDeduped = false;
              if (this.deduplicationConfig) {
                const result = await this.factsAPI.storeWithDedup(storeParams, {
                  deduplication: this.deduplicationConfig
                });
                storedFact = result.fact;
                wasDeduped = result.deduplication?.matchedExisting ?? false;
              } else {
                storedFact = await this.factsAPI.store(storeParams);
              }
              this.extractedFacts.set(factKey, storedFact);
              this.extractionCount++;
              newFacts.push({
                factId: storedFact.factId,
                extractedAtChunk: chunkNumber,
                confidence: factData.confidence,
                fact: factData.fact,
                deduped: wasDeduped
              });
            } catch (error) {
              console.warn("Failed to store progressive fact:", error);
            }
          }
          this.lastExtractionPoint = content.length;
        } catch (error) {
          console.warn("Progressive fact extraction failed:", error);
        }
        return newFacts;
      }
      /**
       * Finalize extraction with full content
       * Performs final fact extraction and deduplication
       */
      async finalizeExtraction(userMessage, fullAgentResponse, extractFacts, conversationId, memoryId, messageIds) {
        try {
          const finalFactsToStore = await extractFacts(
            userMessage,
            fullAgentResponse
          );
          if (!finalFactsToStore || finalFactsToStore.length === 0) {
            return Array.from(this.extractedFacts.values());
          }
          const uniqueFinalFacts = await this.deduplicateFacts(finalFactsToStore);
          for (const factData of uniqueFinalFacts) {
            try {
              const storeParams = {
                memorySpaceId: this.memorySpaceId,
                participantId: this.participantId,
                userId: this.userId,
                fact: factData.fact,
                factType: factData.factType,
                subject: factData.subject || this.userId,
                predicate: factData.predicate,
                object: factData.object,
                confidence: factData.confidence,
                sourceType: "conversation",
                sourceRef: {
                  conversationId,
                  messageIds,
                  memoryId
                },
                tags: factData.tags || []
              };
              let storedFact;
              if (this.deduplicationConfig) {
                const result = await this.factsAPI.storeWithDedup(storeParams, {
                  deduplication: this.deduplicationConfig
                });
                storedFact = result.fact;
              } else {
                storedFact = await this.factsAPI.store(storeParams);
              }
              const factKey = this.generateFactKey(factData.fact, factData.subject);
              this.extractedFacts.set(factKey, storedFact);
            } catch (error) {
              console.warn("Failed to store final fact:", error);
            }
          }
          await this.updateFactsWithMemoryRef(memoryId, messageIds);
          return Array.from(this.extractedFacts.values());
        } catch (error) {
          console.warn("Final fact extraction failed:", error);
          return Array.from(this.extractedFacts.values());
        }
      }
      /**
       * Deduplicate facts against already extracted ones
       */
      async deduplicateFacts(newFacts) {
        const uniqueFacts = [];
        for (const fact of newFacts) {
          const factKey = this.generateFactKey(fact.fact, fact.subject);
          if (!this.extractedFacts.has(factKey)) {
            uniqueFacts.push(fact);
          } else {
            const existing = this.extractedFacts.get(factKey);
            if (fact.confidence > existing.confidence + 10) {
              uniqueFacts.push(fact);
            }
          }
        }
        return uniqueFacts;
      }
      /**
       * Generate a key for fact deduplication
       * Simple implementation - could be enhanced with fuzzy matching
       */
      generateFactKey(fact, subject) {
        const normalized = fact.toLowerCase().trim();
        const key = subject ? `${subject}::${normalized}` : normalized;
        return key;
      }
      /**
       * Update all extracted facts with final memory reference
       * Note: sourceRef cannot be updated after creation, so we just remove progressive tags
       * Graph sync is automatic when graphAdapter is configured
       */
      async updateFactsWithMemoryRef(_memoryId, _messageIds) {
        const updatePromises = Array.from(this.extractedFacts.values()).map(
          async (fact) => {
            try {
              await this.factsAPI.update(this.memorySpaceId, fact.factId, {
                tags: fact.tags.filter((tag) => tag !== "progressive")
              });
            } catch (error) {
              console.warn(
                `Failed to update fact ${fact.factId} with memory ref:`,
                error
              );
            }
          }
        );
        await Promise.allSettled(updatePromises);
      }
      /**
       * Get all extracted facts
       */
      getExtractedFacts() {
        return Array.from(this.extractedFacts.values());
      }
      /**
       * Get extraction statistics
       */
      getStats() {
        return {
          totalFactsExtracted: this.extractedFacts.size,
          extractionPoints: this.extractionCount,
          averageFactsPerExtraction: this.extractionCount > 0 ? this.extractedFacts.size / this.extractionCount : 0
        };
      }
      /**
       * Reset extractor state
       */
      reset() {
        this.extractedFacts.clear();
        this.lastExtractionPoint = 0;
        this.extractionCount = 0;
      }
    };
  }
});

// src/memory/streaming/ErrorRecovery.ts
var ErrorRecovery_exports = {};
__export(ErrorRecovery_exports, {
  ResumableStreamError: () => ResumableStreamError,
  StreamErrorRecovery: () => StreamErrorRecovery
});
var StreamErrorRecovery, ResumableStreamError;
var init_ErrorRecovery = __esm({
  "src/memory/streaming/ErrorRecovery.ts"() {
    "use strict";
    init_api();
    StreamErrorRecovery = class {
      client;
      resumeTokenTTL = 36e5;
      // 1 hour
      constructor(client) {
        this.client = client;
      }
      /**
       * Handle a stream error and attempt recovery
       */
      async handleStreamError(error, context, options) {
        console.warn("Stream error occurred:", error.message);
        switch (options.strategy) {
          case "store-partial":
            return await this.storePartialOnFailure(context, options);
          case "rollback":
            return await this.rollbackToLastState(context);
          case "retry":
            return await this.retryStrategy(context, options);
          case "best-effort":
            return await this.bestEffortStrategy(context, options);
          default:
            return {
              success: false,
              strategy: options.strategy,
              error
            };
        }
      }
      /**
       * Store partial data on failure
       */
      async storePartialOnFailure(context, options) {
        try {
          let resumeToken;
          if (options.preservePartialData) {
            resumeToken = await this.generateResumeToken({
              resumeToken: "",
              // Will be filled in
              lastProcessedChunk: context.chunkCount,
              accumulatedContent: context.accumulatedText,
              partialMemoryId: context.partialMemoryId || "",
              factsExtracted: context.extractedFactIds,
              timestamp: Date.now(),
              checksum: await this.calculateChecksum(context.accumulatedText)
            });
          }
          return {
            success: true,
            strategy: "store-partial",
            partialMemoryId: context.partialMemoryId || "",
            resumeToken
          };
        } catch (error) {
          return {
            success: false,
            strategy: "store-partial",
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
      /**
       * Rollback to last known good state
       */
      async rollbackToLastState(context) {
        try {
          if (context.partialMemoryId) {
            await this.client.mutation(api.memories.deleteMemory, {
              memorySpaceId: context.memorySpaceId,
              memoryId: context.partialMemoryId
            });
          }
          return {
            success: true,
            strategy: "rollback"
          };
        } catch (error) {
          return {
            success: false,
            strategy: "rollback",
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
      /**
       * Retry strategy (placeholder - actual retry logic in caller)
       */
      async retryStrategy(_context, _options) {
        return {
          success: false,
          strategy: "retry"
        };
      }
      /**
       * Best-effort strategy - try to save what we can
       */
      async bestEffortStrategy(context, options) {
        try {
          if (context.accumulatedText && context.accumulatedText.length > 0) {
            const result = await this.storePartialOnFailure(context, options);
            return result;
          }
          return {
            success: false,
            strategy: "best-effort"
          };
        } catch (error) {
          return {
            success: false,
            strategy: "best-effort",
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
      /**
       * Retry an operation with exponential backoff
       */
      async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1e3) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries - 1) {
              const delay = baseDelay * Math.pow(2, attempt);
              await this.sleep(delay);
            }
          }
        }
        throw lastError || new Error("Max retries exceeded");
      }
      /**
       * Generate a resume token for interrupted streams
       */
      async generateResumeToken(context) {
        const randomPart = Array.from(
          globalThis.crypto.getRandomValues(new Uint8Array(16)),
          (byte) => byte.toString(16).padStart(2, "0")
        ).join("");
        const token = `resume_${Date.now()}_${randomPart}`;
        try {
          await this.client.mutation(api.mutable.set, {
            namespace: "resume-tokens",
            key: token,
            value: {
              ...context,
              expiresAt: Date.now() + this.resumeTokenTTL
            }
          });
          return token;
        } catch (error) {
          throw new Error(
            `Failed to generate resume token: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      /**
       * Validate and retrieve resume context from token
       */
      async validateResumeToken(token) {
        try {
          const stored = await this.client.query(api.mutable.get, {
            namespace: "resume-tokens",
            key: token
          });
          if (!stored || !stored.value) {
            return null;
          }
          const context = stored.value;
          if (context.expiresAt < Date.now()) {
            return null;
          }
          const calculatedChecksum = await this.calculateChecksum(
            context.accumulatedContent
          );
          if (calculatedChecksum !== context.checksum) {
            console.warn("Resume context checksum mismatch");
            return null;
          }
          return context;
        } catch (error) {
          console.error("Failed to validate resume token:", error);
          return null;
        }
      }
      /**
       * Delete a resume token (cleanup)
       * Note: Requires mutable.delete API to be implemented
       */
      async deleteResumeToken(_token) {
        try {
          console.warn("Resume token cleanup not yet implemented");
        } catch (error) {
          console.warn("Failed to delete resume token:", error);
        }
      }
      /**
       * Calculate checksum for content verification
       */
      async calculateChecksum(content) {
        const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
        return Array.from(
          new Uint8Array(digest),
          (byte) => byte.toString(16).padStart(2, "0")
        ).join("").substring(0, 16);
      }
      /**
       * Sleep utility for backoff delays
       */
      sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      /**
       * Create a StreamError from a generic error
       */
      createStreamError(error, context, phase) {
        return {
          code: this.errorCodeFromError(error),
          message: error.message,
          recoverable: this.isRecoverable(error),
          partialDataSaved: !!context.partialMemoryId,
          context: {
            phase,
            chunkNumber: context.chunkCount,
            bytesProcessed: context.accumulatedText.length,
            partialMemoryId: context.partialMemoryId
          },
          originalError: error
        };
      }
      /**
       * Determine if an error is recoverable
       */
      isRecoverable(error) {
        const recoverablePatterns = [
          "ECONNRESET",
          "ETIMEDOUT",
          "ENOTFOUND",
          "Network",
          "timeout"
        ];
        return recoverablePatterns.some(
          (pattern) => error.message.includes(pattern)
        );
      }
      /**
       * Get error code from error
       */
      errorCodeFromError(error) {
        if ("code" in error && typeof error.code === "string") {
          return error.code;
        }
        return "UNKNOWN_ERROR";
      }
    };
    ResumableStreamError = class extends Error {
      constructor(originalError, resumeToken) {
        super(
          `Stream interrupted: ${originalError.message}. Resume with token: ${resumeToken}`
        );
        this.originalError = originalError;
        this.resumeToken = resumeToken;
        this.name = "ResumableStreamError";
      }
    };
  }
});

// src/memory/streaming/AdaptiveProcessor.ts
var AdaptiveProcessor_exports = {};
__export(AdaptiveProcessor_exports, {
  AdaptiveStreamProcessor: () => AdaptiveStreamProcessor,
  createAdaptiveProcessor: () => createAdaptiveProcessor
});
function createAdaptiveProcessor() {
  return new AdaptiveStreamProcessor();
}
var AdaptiveStreamProcessor;
var init_AdaptiveProcessor = __esm({
  "src/memory/streaming/AdaptiveProcessor.ts"() {
    "use strict";
    AdaptiveStreamProcessor = class {
      chunkSizeHistory = [];
      processingTimeHistory = [];
      currentStrategy;
      maxHistorySize = 50;
      constructor(initialStrategy) {
        this.currentStrategy = initialStrategy || this.getDefaultStrategy();
      }
      /**
       * Adjust processing strategy based on current metrics
       */
      async adjustProcessingStrategy(metrics, metricsCollector) {
        const streamType = metricsCollector.detectStreamType();
        const newStrategy = this.optimizeForType(streamType, metrics);
        if (this.hasStrategyChanged(newStrategy)) {
          this.currentStrategy = newStrategy;
        }
        return this.currentStrategy;
      }
      /**
       * Detect stream type based on metrics
       */
      detectStreamType(metrics) {
        const { chunksPerSecond, totalChunks } = metrics;
        if (chunksPerSecond > 10) {
          return "fast";
        }
        if (chunksPerSecond < 1 && totalChunks > 5) {
          return "slow";
        }
        const chunkStats = this.calculateVariance(this.chunkSizeHistory);
        if (chunkStats.coefficient > 0.5) {
          return "bursty";
        }
        return "steady";
      }
      /**
       * Optimize strategy for detected stream type
       */
      optimizeForType(streamType, metrics) {
        switch (streamType) {
          case "fast":
            return this.getFastStreamStrategy(metrics);
          case "slow":
            return this.getSlowStreamStrategy(metrics);
          case "bursty":
            return this.getBurstyStreamStrategy(metrics);
          case "steady":
            return this.getSteadyStreamStrategy(metrics);
          default:
            return this.getDefaultStrategy();
        }
      }
      /**
       * Strategy for fast streams - batch processing
       */
      getFastStreamStrategy(_metrics) {
        return {
          bufferSize: 10,
          // Buffer 10 chunks before processing
          factExtractionFrequency: 1e3,
          // Extract every 1000 chars
          partialUpdateInterval: 5e3,
          // Update every 5 seconds
          enablePredictiveLoading: true
        };
      }
      /**
       * Strategy for slow streams - immediate processing
       */
      getSlowStreamStrategy(_metrics) {
        return {
          bufferSize: 1,
          // Process immediately
          factExtractionFrequency: 300,
          // Extract every 300 chars
          partialUpdateInterval: 2e3,
          // Update every 2 seconds
          enablePredictiveLoading: false
        };
      }
      /**
       * Strategy for bursty streams - dynamic buffering
       */
      getBurstyStreamStrategy(_metrics) {
        return {
          bufferSize: 5,
          // Medium buffering
          factExtractionFrequency: 500,
          // Extract every 500 chars
          partialUpdateInterval: 3e3,
          // Update every 3 seconds
          enablePredictiveLoading: false
        };
      }
      /**
       * Strategy for steady streams - balanced approach
       */
      getSteadyStreamStrategy(_metrics) {
        return {
          bufferSize: 3,
          // Small buffer
          factExtractionFrequency: 500,
          // Extract every 500 chars
          partialUpdateInterval: 3e3,
          // Update every 3 seconds
          enablePredictiveLoading: true
        };
      }
      /**
       * Default processing strategy
       */
      getDefaultStrategy() {
        return {
          bufferSize: 1,
          factExtractionFrequency: 500,
          partialUpdateInterval: 3e3,
          enablePredictiveLoading: false
        };
      }
      /**
       * Check if strategy has meaningfully changed
       */
      hasStrategyChanged(newStrategy) {
        return newStrategy.bufferSize !== this.currentStrategy.bufferSize || newStrategy.factExtractionFrequency !== this.currentStrategy.factExtractionFrequency || newStrategy.partialUpdateInterval !== this.currentStrategy.partialUpdateInterval;
      }
      /**
       * Record chunk size for analysis
       */
      recordChunkSize(size) {
        this.chunkSizeHistory.push(size);
        if (this.chunkSizeHistory.length > this.maxHistorySize) {
          this.chunkSizeHistory.shift();
        }
      }
      /**
       * Record processing time for analysis
       */
      recordProcessingTime(timeMs) {
        this.processingTimeHistory.push(timeMs);
        if (this.processingTimeHistory.length > this.maxHistorySize) {
          this.processingTimeHistory.shift();
        }
      }
      /**
       * Calculate variance and coefficient of variation
       */
      calculateVariance(values) {
        if (values.length === 0) {
          return { variance: 0, stdDev: 0, coefficient: 0 };
        }
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const coefficient = mean !== 0 ? stdDev / mean : 0;
        return { variance, stdDev, coefficient };
      }
      /**
       * Get current strategy
       */
      getCurrentStrategy() {
        return { ...this.currentStrategy };
      }
      /**
       * Predict if content should be chunked based on characteristics
       */
      shouldEnableChunking(metrics) {
        if (metrics.totalBytes > 5e4) {
          return true;
        }
        if (metrics.chunksPerSecond < 2 && metrics.totalBytes > 2e4) {
          return true;
        }
        return false;
      }
      /**
       * Suggest optimal chunk size based on stream characteristics
       */
      suggestChunkSize(metrics) {
        const avgChunkSize = metrics.averageChunkSize;
        if (avgChunkSize < 50) {
          return 2e3;
        }
        if (avgChunkSize > 200) {
          return 1e4;
        }
        return 5e3;
      }
      /**
       * Determine if we should enable progressive fact extraction
       */
      shouldEnableProgressiveFacts(metrics) {
        if (metrics.totalBytes > 2e3 && metrics.chunksPerSecond < 5) {
          return true;
        }
        if (metrics.chunksPerSecond > 15) {
          return false;
        }
        return metrics.totalBytes > 1e3;
      }
      /**
       * Get performance recommendations based on analysis
       */
      getRecommendations(metrics) {
        const recommendations = [];
        if (this.shouldEnableChunking(metrics)) {
          recommendations.push(
            `Enable chunked storage with ${this.suggestChunkSize(metrics)} char chunks`
          );
        }
        if (!this.shouldEnableProgressiveFacts(metrics)) {
          recommendations.push(
            "Consider disabling progressive fact extraction to improve throughput"
          );
        }
        const streamType = this.detectStreamType(metrics);
        if (streamType === "fast" && this.currentStrategy.bufferSize < 5) {
          recommendations.push(
            "Increase buffer size to improve batching efficiency"
          );
        }
        if (metrics.partialUpdates > metrics.totalChunks / 2) {
          recommendations.push(
            "Reduce partial update frequency to lower database load"
          );
        }
        return recommendations;
      }
      /**
       * Reset processor state
       */
      reset() {
        this.chunkSizeHistory = [];
        this.processingTimeHistory = [];
        this.currentStrategy = this.getDefaultStrategy();
      }
    };
  }
});

// src/memory/streaming/ChunkingStrategies.ts
var ChunkingStrategies_exports = {};
__export(ChunkingStrategies_exports, {
  ResponseChunker: () => ResponseChunker,
  estimateOptimalChunkSize: () => estimateOptimalChunkSize,
  shouldChunkContent: () => shouldChunkContent
});
function estimateOptimalChunkSize(contentLength, strategy) {
  switch (strategy) {
    case "token":
      return 500;
    case "sentence":
      return contentLength > 1e4 ? 10 : 5;
    case "paragraph":
      return contentLength > 5e3 ? 3 : 2;
    case "fixed":
      return 2e3;
    case "semantic":
      return 10;
    default:
      return 2e3;
  }
}
function shouldChunkContent(contentLength, threshold = 1e4) {
  return contentLength > threshold;
}
var ResponseChunker;
var init_ChunkingStrategies = __esm({
  "src/memory/streaming/ChunkingStrategies.ts"() {
    "use strict";
    ResponseChunker = class {
      /**
       * Chunk content based on the specified strategy
       */
      async chunkContent(content, config) {
        switch (config.strategy) {
          case "token":
            return this.chunkByTokens(
              content,
              config.maxChunkSize,
              config.overlapSize
            );
          case "sentence":
            return this.chunkBySentences(
              content,
              config.maxChunkSize,
              config.preserveBoundaries
            );
          case "paragraph":
            return this.chunkByParagraphs(
              content,
              config.maxChunkSize,
              config.preserveBoundaries
            );
          case "fixed":
            return this.chunkByFixed(
              content,
              config.maxChunkSize,
              config.overlapSize
            );
          case "semantic":
            console.warn(
              "Semantic chunking requires embeddings, falling back to sentence-based"
            );
            return this.chunkBySentences(
              content,
              config.maxChunkSize,
              config.preserveBoundaries
            );
          default:
            throw new Error(`Unknown chunking strategy: ${config.strategy}`);
        }
      }
      /**
       * Chunk by token count (approximate - 1 token ≈ 4 characters)
       */
      chunkByTokens(content, maxTokens, overlapTokens = 0) {
        const chunks = [];
        const maxChars = maxTokens * 4;
        const overlapChars = overlapTokens * 4;
        if (overlapChars >= maxChars) {
          throw new Error("overlapTokens must be smaller than maxTokens");
        }
        let startOffset = 0;
        let chunkIndex = 0;
        const stepSize = maxChars - overlapChars;
        if (stepSize <= 0) {
          throw new Error("Invalid chunking configuration");
        }
        while (startOffset < content.length) {
          const endOffset = Math.min(startOffset + maxChars, content.length);
          const chunkContent = content.substring(startOffset, endOffset);
          chunks.push({
            content: chunkContent,
            chunkIndex,
            startOffset,
            endOffset,
            metadata: {
              chunkIndex,
              startOffset,
              endOffset,
              hasOverlap: overlapTokens > 0 && startOffset > 0
            }
          });
          if (endOffset >= content.length) {
            break;
          }
          startOffset += stepSize;
          chunkIndex++;
          if (chunkIndex > 1e5) {
            throw new Error("Chunking exceeded maximum iterations");
          }
        }
        chunks.forEach((chunk) => {
          chunk.metadata.totalChunks = chunks.length;
        });
        return chunks;
      }
      /**
       * Chunk by sentences
       */
      chunkBySentences(content, maxSentences, _preserveBoundaries = true) {
        const chunks = [];
        const sentenceRegex = /[.!?]+\s+/g;
        const sentences = [];
        let lastIndex = 0;
        let match;
        while ((match = sentenceRegex.exec(content)) !== null) {
          sentences.push(
            content.substring(lastIndex, match.index + match[0].length)
          );
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < content.length) {
          sentences.push(content.substring(lastIndex));
        }
        if (sentences.length === 0) {
          return [
            {
              content,
              chunkIndex: 0,
              startOffset: 0,
              endOffset: content.length,
              metadata: {
                chunkIndex: 0,
                totalChunks: 1,
                startOffset: 0,
                endOffset: content.length,
                hasOverlap: false
              }
            }
          ];
        }
        let currentChunk = [];
        let currentStartOffset = 0;
        let chunkIndex = 0;
        for (let i = 0; i < sentences.length; i++) {
          currentChunk.push(sentences[i]);
          if (currentChunk.length >= maxSentences || i === sentences.length - 1) {
            const chunkContent = currentChunk.join("");
            const endOffset = currentStartOffset + chunkContent.length;
            chunks.push({
              content: chunkContent,
              chunkIndex,
              startOffset: currentStartOffset,
              endOffset,
              metadata: {
                chunkIndex,
                startOffset: currentStartOffset,
                endOffset,
                hasOverlap: false
              }
            });
            currentStartOffset = endOffset;
            currentChunk = [];
            chunkIndex++;
          }
        }
        chunks.forEach((chunk) => {
          chunk.metadata.totalChunks = chunks.length;
        });
        return chunks;
      }
      /**
       * Chunk by paragraphs
       */
      chunkByParagraphs(content, maxParagraphs, _preserveBoundaries = true) {
        const chunks = [];
        const paragraphs = content.split(/\n\n+/);
        if (paragraphs.length === 0) {
          return [
            {
              content,
              chunkIndex: 0,
              startOffset: 0,
              endOffset: content.length,
              metadata: {
                chunkIndex: 0,
                totalChunks: 1,
                startOffset: 0,
                endOffset: content.length,
                hasOverlap: false
              }
            }
          ];
        }
        let currentChunk = [];
        let currentStartOffset = 0;
        let chunkIndex = 0;
        for (let i = 0; i < paragraphs.length; i++) {
          currentChunk.push(paragraphs[i]);
          if (currentChunk.length >= maxParagraphs || i === paragraphs.length - 1) {
            const chunkContent = currentChunk.join("\n\n");
            const endOffset = currentStartOffset + chunkContent.length;
            chunks.push({
              content: chunkContent,
              chunkIndex,
              startOffset: currentStartOffset,
              endOffset,
              metadata: {
                chunkIndex,
                startOffset: currentStartOffset,
                endOffset,
                hasOverlap: false
              }
            });
            currentStartOffset = endOffset + 2;
            currentChunk = [];
            chunkIndex++;
          }
        }
        chunks.forEach((chunk) => {
          chunk.metadata.totalChunks = chunks.length;
        });
        return chunks;
      }
      /**
       * Chunk by fixed character size
       */
      chunkByFixed(content, maxSize, overlapSize = 0) {
        if (content.length === 0) {
          return [
            {
              content: "",
              chunkIndex: 0,
              startOffset: 0,
              endOffset: 0,
              metadata: {
                chunkIndex: 0,
                totalChunks: 1,
                startOffset: 0,
                endOffset: 0,
                hasOverlap: false
              }
            }
          ];
        }
        if (overlapSize >= maxSize) {
          throw new Error("overlapSize must be smaller than maxChunkSize");
        }
        const chunks = [];
        let startOffset = 0;
        let chunkIndex = 0;
        const stepSize = maxSize - overlapSize;
        if (stepSize <= 0) {
          throw new Error("Invalid chunking configuration");
        }
        while (startOffset < content.length) {
          const endOffset = Math.min(startOffset + maxSize, content.length);
          const chunkContent = content.substring(startOffset, endOffset);
          chunks.push({
            content: chunkContent,
            chunkIndex,
            startOffset,
            endOffset,
            metadata: {
              chunkIndex,
              startOffset,
              endOffset,
              hasOverlap: overlapSize > 0 && startOffset > 0
            }
          });
          if (endOffset >= content.length) {
            break;
          }
          startOffset += stepSize;
          chunkIndex++;
          if (chunkIndex > 1e5) {
            throw new Error(
              "Chunking exceeded maximum iterations - possible infinite loop"
            );
          }
        }
        chunks.forEach((chunk) => {
          chunk.metadata.totalChunks = chunks.length;
        });
        return chunks;
      }
      /**
       * Chunk by semantic similarity (requires embeddings)
       * This is a placeholder - would need embedding generation
       */
      async chunkBySemantic(content, _embeddings) {
        return this.chunkBySentences(content, 10, true);
      }
    };
  }
});

// src/memory/streaming/ProgressiveGraphSync.ts
var ProgressiveGraphSync_exports = {};
__export(ProgressiveGraphSync_exports, {
  ProgressiveGraphSync: () => ProgressiveGraphSync,
  createProgressiveGraphSync: () => createProgressiveGraphSync
});
function createProgressiveGraphSync(graphAdapter, syncInterval) {
  return new ProgressiveGraphSync(graphAdapter, syncInterval);
}
var ProgressiveGraphSync;
var init_ProgressiveGraphSync = __esm({
  "src/memory/streaming/ProgressiveGraphSync.ts"() {
    "use strict";
    ProgressiveGraphSync = class {
      graphAdapter;
      partialNodeId = null;
      syncEvents = [];
      syncInterval;
      lastSyncTime = 0;
      constructor(graphAdapter, syncInterval = 5e3) {
        this.graphAdapter = graphAdapter;
        this.syncInterval = syncInterval;
      }
      /**
       * Initialize partial memory node in graph
       */
      async initializePartialNode(partialMemory) {
        try {
          const nodeId = await this.graphAdapter.createNode({
            label: "Memory",
            properties: {
              memoryId: partialMemory.memoryId,
              memorySpaceId: partialMemory.memorySpaceId,
              userId: partialMemory.userId,
              contentPreview: this.truncateContent(
                partialMemory.content || "",
                100
              ),
              isPartial: true,
              isStreaming: true,
              streamStartTime: Date.now(),
              createdAt: Date.now()
            }
          });
          this.partialNodeId = nodeId;
          this.lastSyncTime = Date.now();
          this.recordSyncEvent({
            timestamp: Date.now(),
            eventType: "node-created",
            nodeId,
            details: "Created partial memory node"
          });
          return nodeId;
        } catch (error) {
          console.warn("Failed to initialize partial graph node:", error);
          throw error;
        }
      }
      /**
       * Update partial node with current content
       */
      async updatePartialNode(content, context) {
        if (!this.partialNodeId) {
          return;
        }
        const now = Date.now();
        if (now - this.lastSyncTime < this.syncInterval) {
          return;
        }
        try {
          await this.graphAdapter.updateNode(this.partialNodeId, {
            contentPreview: this.truncateContent(content, 100),
            contentLength: content.length,
            chunkCount: context.chunkCount,
            estimatedTokens: context.estimatedTokens,
            lastUpdatedAt: now
          });
          this.lastSyncTime = now;
          this.recordSyncEvent({
            timestamp: now,
            eventType: "node-updated",
            nodeId: this.partialNodeId,
            details: `Updated with ${context.chunkCount} chunks, ${content.length} chars`
          });
        } catch (error) {
          console.warn("Failed to update partial graph node:", error);
        }
      }
      /**
       * Finalize node when stream completes
       */
      async finalizeNode(completeMemory) {
        if (!this.partialNodeId) {
          return;
        }
        try {
          await this.graphAdapter.updateNode(this.partialNodeId, {
            contentPreview: this.truncateContent(completeMemory.content, 100),
            contentLength: completeMemory.content.length,
            isPartial: false,
            isStreaming: false,
            streamCompleteTime: Date.now(),
            importance: completeMemory.importance,
            tags: completeMemory.tags
          });
          this.recordSyncEvent({
            timestamp: Date.now(),
            eventType: "finalized",
            nodeId: this.partialNodeId,
            details: "Finalized memory node (relationships handled by standard sync)"
          });
        } catch (error) {
          console.warn("Failed to finalize graph node:", error);
        }
      }
      /**
       * Rollback/cleanup on failure
       */
      async rollback() {
        if (!this.partialNodeId) {
          return;
        }
        try {
          await this.graphAdapter.deleteNode(this.partialNodeId);
          this.partialNodeId = null;
        } catch (error) {
          console.warn("Failed to rollback graph node:", error);
        }
      }
      /**
       * Check if sync should happen based on interval
       */
      shouldSync() {
        if (!this.partialNodeId) {
          return false;
        }
        return Date.now() - this.lastSyncTime >= this.syncInterval;
      }
      /**
       * Get all sync events
       */
      getSyncEvents() {
        return [...this.syncEvents];
      }
      /**
       * Get the partial node ID
       */
      getPartialNodeId() {
        return this.partialNodeId;
      }
      /**
       * Record a sync event
       */
      recordSyncEvent(event) {
        this.syncEvents.push(event);
      }
      /**
       * Truncate content for preview
       */
      truncateContent(content, maxLength) {
        if (content.length <= maxLength) {
          return content;
        }
        return content.substring(0, maxLength) + "...";
      }
      /**
       * Reset sync state
       */
      reset() {
        this.partialNodeId = null;
        this.syncEvents = [];
        this.lastSyncTime = 0;
      }
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  A2AValidationError: () => A2AValidationError,
  AcquireTimeoutError: () => AcquireTimeoutError,
  AgentRegistryCapabilityError: () => AgentRegistryCapabilityError,
  AgentRegistryCommittedResultError: () => AgentRegistryCommittedResultError,
  AgentRegistryWriteReceiptError: () => AgentRegistryWriteReceiptError,
  ArtifactValidationError: () => ArtifactValidationError,
  AssetCapabilityUnavailableError: () => AssetCapabilityUnavailableError,
  AttachmentValidationError: () => AttachmentValidationError,
  AuthValidationError: () => AuthValidationError,
  CircuitBreaker: () => CircuitBreaker,
  CircuitOpenError: () => CircuitOpenError,
  Cortex: () => Cortex,
  CypherGraphAdapter: () => CypherGraphAdapter,
  GovernanceCapabilityError: () => GovernanceCapabilityError,
  GovernanceValidationError: () => GovernanceValidationError,
  GraphSyncWorker: () => GraphSyncWorker,
  HostCredentials: () => HostCredentials,
  MemoryValidationError: () => MemoryValidationError,
  OPERATION_PRIORITIES: () => OPERATION_PRIORITIES,
  PriorityQueue: () => PriorityQueue,
  QueueFullError: () => QueueFullError,
  RateLimitExceededError: () => RateLimitExceededError,
  ResilienceLayer: () => ResilienceLayer,
  ResiliencePresets: () => ResiliencePresets,
  Semaphore: () => Semaphore,
  SessionCapabilityError: () => SessionCapabilityError,
  SessionValidationError: () => SessionValidationError,
  SessionsAPI: () => SessionsAPI,
  TokenBucket: () => TokenBucket,
  UserProfileWriteReceiptError: () => UserProfileWriteReceiptError,
  UserValidationError: () => UserValidationError,
  buildShareUrl: () => buildShareUrl,
  createAuthContext: () => createAuthContext,
  createUserProfile: () => createUserProfile,
  extractShareId: () => extractShareId,
  getPresetForPlan: () => getPresetForPlan,
  getPriority: () => getPriority,
  isCritical: () => isCritical,
  validateAuthContext: () => validateAuthContext,
  validateUserProfile: () => validateUserProfile,
  validationPresets: () => validationPresets
});
module.exports = __toCommonJS(index_exports);

// src/runtime.ts
var runtimeEnv = new Proxy({}, {
  get(_target, key) {
    return typeof process === "undefined" ? void 0 : process.env[key];
  }
});

// src/index.ts
var import_browser = require("convex/browser");

// src/auth/validators.ts
var AuthValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "AuthValidationError";
  }
};
var VALID_AUTH_METHODS = [
  "oauth",
  "api_key",
  "jwt",
  "session",
  "custom"
];
function validateUserId(userId) {
  if (typeof userId !== "string") {
    throw new AuthValidationError(
      "userId must be a string",
      "INVALID_USER_ID",
      "userId"
    );
  }
  if (userId.trim().length === 0) {
    throw new AuthValidationError(
      "userId cannot be empty",
      "EMPTY_USER_ID",
      "userId"
    );
  }
  if (userId.length > 256) {
    throw new AuthValidationError(
      "userId cannot exceed 256 characters",
      "USER_ID_TOO_LONG",
      "userId"
    );
  }
}
function validateTenantId(tenantId) {
  if (typeof tenantId !== "string") {
    throw new AuthValidationError(
      "tenantId must be a string",
      "INVALID_TENANT_ID",
      "tenantId"
    );
  }
  if (tenantId.trim().length === 0) {
    throw new AuthValidationError(
      "tenantId cannot be empty",
      "EMPTY_TENANT_ID",
      "tenantId"
    );
  }
  if (tenantId.length > 256) {
    throw new AuthValidationError(
      "tenantId cannot exceed 256 characters",
      "TENANT_ID_TOO_LONG",
      "tenantId"
    );
  }
}
function validateOrganizationId(organizationId) {
  if (typeof organizationId !== "string") {
    throw new AuthValidationError(
      "organizationId must be a string",
      "INVALID_ORGANIZATION_ID",
      "organizationId"
    );
  }
  if (organizationId.trim().length === 0) {
    throw new AuthValidationError(
      "organizationId cannot be empty",
      "EMPTY_ORGANIZATION_ID",
      "organizationId"
    );
  }
  if (organizationId.length > 256) {
    throw new AuthValidationError(
      "organizationId cannot exceed 256 characters",
      "ORGANIZATION_ID_TOO_LONG",
      "organizationId"
    );
  }
}
function validateSessionId(sessionId) {
  if (typeof sessionId !== "string") {
    throw new AuthValidationError(
      "sessionId must be a string",
      "INVALID_SESSION_ID",
      "sessionId"
    );
  }
  if (sessionId.trim().length === 0) {
    throw new AuthValidationError(
      "sessionId cannot be empty",
      "EMPTY_SESSION_ID",
      "sessionId"
    );
  }
  if (sessionId.length > 256) {
    throw new AuthValidationError(
      "sessionId cannot exceed 256 characters",
      "SESSION_ID_TOO_LONG",
      "sessionId"
    );
  }
}
function validateAuthMethod(authMethod) {
  if (typeof authMethod !== "string") {
    throw new AuthValidationError(
      "authMethod must be a string",
      "INVALID_AUTH_METHOD",
      "authMethod"
    );
  }
  if (!VALID_AUTH_METHODS.includes(authMethod)) {
    throw new AuthValidationError(
      `authMethod must be one of: ${VALID_AUTH_METHODS.join(", ")}`,
      "INVALID_AUTH_METHOD_VALUE",
      "authMethod"
    );
  }
}
function validateClaims(claims) {
  if (claims === null || typeof claims !== "object" || Array.isArray(claims)) {
    throw new AuthValidationError(
      "claims must be a plain object",
      "INVALID_CLAIMS",
      "claims"
    );
  }
}
function validateMetadata(metadata) {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new AuthValidationError(
      "metadata must be a plain object",
      "INVALID_METADATA",
      "metadata"
    );
  }
}
function validateAuthContextParams(params) {
  if (params === null || typeof params !== "object") {
    throw new AuthValidationError(
      "Auth context params must be an object",
      "INVALID_PARAMS"
    );
  }
  const p = params;
  if (!("userId" in p)) {
    throw new AuthValidationError(
      "userId is required",
      "MISSING_USER_ID",
      "userId"
    );
  }
  validateUserId(p.userId);
  if (p.tenantId !== void 0) {
    validateTenantId(p.tenantId);
  }
  if (p.organizationId !== void 0) {
    validateOrganizationId(p.organizationId);
  }
  if (p.sessionId !== void 0) {
    validateSessionId(p.sessionId);
  }
  if (p.authProvider !== void 0) {
    if (typeof p.authProvider !== "string") {
      throw new AuthValidationError(
        "authProvider must be a string",
        "INVALID_AUTH_PROVIDER",
        "authProvider"
      );
    }
  }
  if (p.authMethod !== void 0) {
    validateAuthMethod(p.authMethod);
  }
  if (p.authenticatedAt !== void 0) {
    if (typeof p.authenticatedAt !== "number" || p.authenticatedAt < 0) {
      throw new AuthValidationError(
        "authenticatedAt must be a positive number (ms since epoch)",
        "INVALID_AUTHENTICATED_AT",
        "authenticatedAt"
      );
    }
  }
  if (p.claims !== void 0) {
    validateClaims(p.claims);
  }
  if (p.metadata !== void 0) {
    validateMetadata(p.metadata);
  }
}

// src/auth/tenant.ts
function resolveTenantId(configured, requested) {
  if (configured !== void 0 && requested !== void 0 && configured !== requested) {
    throw new AuthValidationError("Requested tenant does not match the SDK auth context", "TENANT_SCOPE_MISMATCH", "tenantId");
  }
  return configured ?? requested;
}

// src/conversations/index.ts
init_api();

// src/graph/types.ts
var GraphDatabaseError = class _GraphDatabaseError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = "GraphDatabaseError";
    Object.setPrototypeOf(this, _GraphDatabaseError.prototype);
  }
};
var GraphConnectionError = class _GraphConnectionError extends GraphDatabaseError {
  constructor(message, cause) {
    super(message, "CONNECTION_ERROR", cause);
    this.name = "GraphConnectionError";
    Object.setPrototypeOf(this, _GraphConnectionError.prototype);
  }
};
var GraphAuthenticationError = class _GraphAuthenticationError extends GraphConnectionError {
  constructor(message, uri, username, cause) {
    super(message, cause);
    this.uri = uri;
    this.username = username;
    this.name = "GraphAuthenticationError";
    Object.setPrototypeOf(this, _GraphAuthenticationError.prototype);
  }
};
var GraphQueryError = class _GraphQueryError extends GraphDatabaseError {
  constructor(message, query, cause) {
    super(message, "QUERY_ERROR", cause);
    this.query = query;
    this.name = "GraphQueryError";
    Object.setPrototypeOf(this, _GraphQueryError.prototype);
  }
};
var GraphNotFoundError = class _GraphNotFoundError extends GraphDatabaseError {
  constructor(resourceType, identifier) {
    super(`${resourceType} not found: ${identifier}`, "NOT_FOUND");
    this.name = "GraphNotFoundError";
    Object.setPrototypeOf(this, _GraphNotFoundError.prototype);
  }
};

// src/graph/adapters/CypherGraphAdapter.ts
var import_neo4j_driver = __toESM(require("neo4j-driver"), 1);
var CypherGraphAdapter = class {
  driver = null;
  config = null;
  useElementId = true;
  // Neo4j uses elementId(), Memgraph uses id()
  // ============================================================================
  // Connection Management
  // ============================================================================
  async connect(config) {
    try {
      this.config = config;
      this.driver = import_neo4j_driver.default.driver(
        config.uri,
        import_neo4j_driver.default.auth.basic(config.username, config.password),
        {
          maxConnectionPoolSize: config.maxConnectionPoolSize || 50,
          connectionAcquisitionTimeout: config.connectionTimeout || 6e4,
          // 60 seconds
          maxTransactionRetryTime: 3e4
          // 30 seconds
        }
      );
      await this.driver.verifyConnectivity();
      await this.verifyAuthentication();
      await this.detectDatabaseType();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error?.code;
      const cause = error instanceof Error ? error : void 0;
      throw this.createConnectionError(errorMessage, errorCode, config, cause);
    }
  }
  /**
   * Create appropriate error type based on connection failure diagnosis
   */
  createConnectionError(errorMessage, errorCode, config, cause) {
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes("authentication") || lowerMessage.includes("unauthorized") || lowerMessage.includes("credentials") || errorCode?.includes("Security.Unauthorized") || errorCode?.includes("Security.Authentication")) {
      const message = `Graph database authentication failed at ${config.uri}. Check that NEO4J_USERNAME and NEO4J_PASSWORD environment variables are correct. Current username: '${config.username}'. Original error: ${errorMessage}`;
      return new GraphAuthenticationError(
        message,
        config.uri,
        config.username,
        cause
      );
    }
    if (lowerMessage.includes("econnrefused") || lowerMessage.includes("connection refused") || lowerMessage.includes("failed to connect")) {
      const message = `Cannot connect to graph database at ${config.uri}. Ensure Neo4j/Memgraph is running and accessible. For Docker: 'docker compose -f docker-compose.graph.yml up -d'. Original error: ${errorMessage}`;
      return new GraphConnectionError(message, cause);
    }
    if (lowerMessage.includes("enotfound") || lowerMessage.includes("getaddrinfo") || lowerMessage.includes("name or service not known")) {
      const message = `Cannot resolve graph database host in ${config.uri}. Check that NEO4J_URI is correctly configured. Original error: ${errorMessage}`;
      return new GraphConnectionError(message, cause);
    }
    if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out") || lowerMessage.includes("timedout")) {
      const message = `Connection to graph database timed out at ${config.uri}. The database may be starting up, overloaded, or unreachable. Original error: ${errorMessage}`;
      return new GraphConnectionError(message, cause);
    }
    return new GraphConnectionError(
      `Failed to connect to graph database at ${config.uri}: ${errorMessage}`,
      cause
    );
  }
  async disconnect() {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.config = null;
    }
  }
  async isConnected() {
    if (!this.driver) {
      return false;
    }
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Verify authentication by running a simple query
   *
   * verifyConnectivity() only checks if the server is reachable, not
   * if credentials are valid. This method runs a simple query to
   * verify authentication works, failing fast with a clear error
   * if credentials are invalid.
   */
  async verifyAuthentication() {
    const session = this.getSession();
    try {
      await session.run("RETURN 1 as test");
    } finally {
      await session.close();
    }
  }
  /**
   * Detect database type and set appropriate ID function
   */
  async detectDatabaseType() {
    const session = this.getSession();
    try {
      await session.run("CREATE (n:__TEST__) RETURN elementId(n) as id");
      await session.run("MATCH (n:__TEST__) DELETE n");
      this.useElementId = true;
    } catch {
      this.useElementId = false;
      try {
        await session.run("MATCH (n:__TEST__) DELETE n");
      } catch {
      }
    } finally {
      await session.close();
    }
  }
  /**
   * Get the appropriate ID function for the connected database
   */
  getIdFunction() {
    return this.useElementId ? "elementId" : "id";
  }
  /**
   * Convert ID to appropriate type for database queries
   * Neo4j uses string IDs (elementId), Memgraph uses integer IDs (id)
   */
  convertIdForQuery(id) {
    return !this.useElementId ? parseInt(id, 10) : id;
  }
  // ============================================================================
  // Node Operations
  // ============================================================================
  async createNode(node) {
    const session = this.getSession();
    try {
      const idFunc = this.getIdFunction();
      const query = `
        CREATE (n:${this.escapeLabel(node.label)} $properties)
        RETURN ${idFunc}(n) as id
      `;
      const result = await session.run(query, {
        properties: this.serializeProperties(node.properties)
      });
      if (result.records.length === 0) {
        throw new GraphDatabaseError("Failed to create node: no ID returned");
      }
      const idValue = result.records[0].get("id");
      return typeof idValue === "object" && idValue !== null && "toString" in idValue ? idValue.toString() : String(idValue);
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to create node with label ${node.label}`
      );
    } finally {
      await session.close();
    }
  }
  async mergeNode(node, matchProperties) {
    const session = this.getSession();
    try {
      const idFunc = this.getIdFunction();
      const matchPropEntries = Object.entries(matchProperties);
      const matchPropStr = matchPropEntries.map(([key]) => `${key}: $match_${key}`).join(", ");
      const setPropEntries = Object.entries(node.properties).filter(
        ([key]) => !(key in matchProperties)
      );
      const setClause = setPropEntries.length > 0 ? `ON CREATE SET n += $createProps ON MATCH SET n += $updateProps` : "";
      const query = `
        MERGE (n:${this.escapeLabel(node.label)} {${matchPropStr}})
        ${setClause}
        RETURN ${idFunc}(n) as id
      `;
      const params = {};
      for (const [key, value] of matchPropEntries) {
        params[`match_${key}`] = this.serializeValue(value);
      }
      if (setPropEntries.length > 0) {
        const extraProps = Object.fromEntries(
          setPropEntries.map(([key, value]) => [
            key,
            this.serializeValue(value)
          ])
        );
        params.createProps = extraProps;
        params.updateProps = extraProps;
      }
      const result = await session.run(query, params);
      if (result.records.length === 0) {
        throw new GraphDatabaseError("Failed to merge node: no ID returned");
      }
      const idValue = result.records[0].get("id");
      return typeof idValue === "object" && idValue !== null && "toString" in idValue ? idValue.toString() : String(idValue);
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to merge node with label ${node.label}`
      );
    } finally {
      await session.close();
    }
  }
  async getNode(id) {
    const session = this.getSession();
    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH (n)
        WHERE ${idFunc}(n) = $id
        RETURN n, labels(n) as labels
      `;
      const result = await session.run(query, {
        id: this.convertIdForQuery(id)
      });
      if (result.records.length === 0) {
        return null;
      }
      const record = result.records[0];
      const node = record.get("n");
      const labels = record.get("labels");
      return {
        id,
        label: labels[0] || "Node",
        properties: this.deserializeProperties(node.properties)
      };
    } catch (error) {
      throw this.handleError(error, `Failed to get node ${id}`);
    } finally {
      await session.close();
    }
  }
  async updateNode(id, properties) {
    const session = this.getSession();
    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH (n)
        WHERE ${idFunc}(n) = $id
        SET n += $properties
        RETURN n
      `;
      const result = await session.run(query, {
        id: this.convertIdForQuery(id),
        properties: this.serializeProperties(properties)
      });
      if (result.records.length === 0) {
        throw new GraphNotFoundError("node", id);
      }
    } catch (error) {
      throw this.handleError(error, `Failed to update node ${id}`);
    } finally {
      await session.close();
    }
  }
  async deleteNode(id, detach = true) {
    const session = this.getSession();
    try {
      const idFunc = this.getIdFunction();
      const query = detach ? `
          MATCH (n)
          WHERE ${idFunc}(n) = $id
          DETACH DELETE n
        ` : `
          MATCH (n)
          WHERE ${idFunc}(n) = $id
          DELETE n
        `;
      await session.run(query, { id: this.convertIdForQuery(id) });
    } catch (error) {
      throw this.handleError(error, `Failed to delete node ${id}`);
    } finally {
      await session.close();
    }
  }
  async findNodes(label, properties, limit = 100) {
    const session = this.getSession();
    try {
      let query = `
        MATCH (n:${this.escapeLabel(label)})
      `;
      const params = {};
      if (properties && Object.keys(properties).length > 0) {
        const whereClauses = [];
        for (const [key, value] of Object.entries(properties)) {
          whereClauses.push(`n.${this.escapeProperty(key)} = $${key}`);
          params[key] = this.serializeValue(value);
        }
        query += ` WHERE ${whereClauses.join(" AND ")}`;
      }
      const idFunc = this.getIdFunction();
      query += `
        RETURN ${idFunc}(n) as id, n, labels(n) as labels
        LIMIT ${limit}
      `;
      const result = await session.run(query, params);
      return result.records.map((record) => ({
        id: record.get("id"),
        label: record.get("labels")[0] || label,
        properties: this.deserializeProperties(record.get("n").properties)
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to find nodes with label ${label}`);
    } finally {
      await session.close();
    }
  }
  // ============================================================================
  // Edge Operations
  // ============================================================================
  async createEdge(edge) {
    const session = this.getSession();
    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH (from), (to)
        WHERE ${idFunc}(from) = $fromId AND ${idFunc}(to) = $toId
        CREATE (from)-[r:${this.escapeLabel(edge.type)} $properties]->(to)
        RETURN ${idFunc}(r) as id
      `;
      const result = await session.run(query, {
        fromId: this.convertIdForQuery(edge.from),
        toId: this.convertIdForQuery(edge.to),
        properties: this.serializeProperties(edge.properties || {})
      });
      if (result.records.length === 0) {
        throw new GraphDatabaseError(
          `Failed to create edge: nodes not found (from: ${edge.from}, to: ${edge.to})`
        );
      }
      const idValue = result.records[0].get("id");
      return typeof idValue === "object" && idValue !== null && "toString" in idValue ? idValue.toString() : String(idValue);
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to create edge ${edge.type} from ${edge.from} to ${edge.to}`
      );
    } finally {
      await session.close();
    }
  }
  async deleteEdge(id) {
    const session = this.getSession();
    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH ()-[r]->()
        WHERE ${idFunc}(r) = $id
        DELETE r
      `;
      await session.run(query, { id: this.convertIdForQuery(id) });
    } catch (error) {
      throw this.handleError(error, `Failed to delete edge ${id}`);
    } finally {
      await session.close();
    }
  }
  async findEdges(type, properties, limit = 100) {
    const session = this.getSession();
    try {
      let query = `
        MATCH (from)-[r:${this.escapeLabel(type)}]->(to)
      `;
      const params = {};
      if (properties && Object.keys(properties).length > 0) {
        const whereClauses = [];
        for (const [key, value] of Object.entries(properties)) {
          whereClauses.push(`r.${this.escapeProperty(key)} = $${key}`);
          params[key] = this.serializeValue(value);
        }
        query += ` WHERE ${whereClauses.join(" AND ")}`;
      }
      const idFunc = this.getIdFunction();
      query += `
        RETURN ${idFunc}(r) as id, r, ${idFunc}(from) as fromId, ${idFunc}(to) as toId
        LIMIT ${limit}
      `;
      const result = await session.run(query, params);
      return result.records.map((record) => ({
        id: record.get("id"),
        type,
        from: record.get("fromId"),
        to: record.get("toId"),
        properties: this.deserializeProperties(record.get("r").properties)
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to find edges with type ${type}`);
    } finally {
      await session.close();
    }
  }
  // ============================================================================
  // Query Operations
  // ============================================================================
  async query(query, params) {
    const session = this.getSession();
    try {
      const cypher = typeof query === "string" ? query : query.cypher;
      const queryParams = typeof query === "string" ? params || {} : { ...query.params, ...params };
      const result = await session.run(
        cypher,
        this.serializeProperties(queryParams)
      );
      const records = result.records.map((record) => {
        const obj = {};
        for (const key of record.keys) {
          const keyStr = String(key);
          obj[keyStr] = this.deserializeValue(record.get(keyStr));
        }
        return obj;
      });
      const stats = result.summary.counters;
      const queryStats = {
        nodesCreated: stats.updates().nodesCreated,
        nodesDeleted: stats.updates().nodesDeleted,
        relationshipsCreated: stats.updates().relationshipsCreated,
        relationshipsDeleted: stats.updates().relationshipsDeleted,
        propertiesSet: stats.updates().propertiesSet,
        labelsAdded: stats.updates().labelsAdded,
        labelsRemoved: stats.updates().labelsRemoved,
        indexesAdded: stats.updates().indexesAdded,
        constraintsAdded: stats.updates().constraintsAdded
      };
      return {
        records,
        count: records.length,
        stats: queryStats
      };
    } catch (error) {
      const cypherStr = typeof query === "string" ? query : query.cypher;
      throw new GraphQueryError(
        `Query failed: ${error instanceof Error ? error.message : String(error)}`,
        cypherStr,
        error instanceof Error ? error : void 0
      );
    } finally {
      await session.close();
    }
  }
  async traverse(config) {
    const session = this.getSession();
    try {
      const relTypes = config.relationshipTypes && config.relationshipTypes.length > 0 ? `:${config.relationshipTypes.join("|")}` : "";
      const direction = config.direction || "BOTH";
      let relPattern;
      if (direction === "OUTGOING") {
        relPattern = `-[${relTypes}*1..${config.maxDepth}]->`;
      } else if (direction === "INCOMING") {
        relPattern = `<-[${relTypes}*1..${config.maxDepth}]-`;
      } else {
        relPattern = `-[${relTypes}*1..${config.maxDepth}]-`;
      }
      const idFunc = this.getIdFunction();
      let query = `
        MATCH (start)
        WHERE ${idFunc}(start) = $startId
        MATCH path = (start)${relPattern}(connected)
      `;
      const params = {
        startId: this.convertIdForQuery(config.startId)
        // FIX: Convert ID for Memgraph
      };
      if (config.filter) {
        query += ` WHERE ${config.filter}`;
        if (config.filterParams) {
          Object.assign(params, config.filterParams);
        }
      }
      query += `
        RETURN DISTINCT ${idFunc}(connected) as id, connected, labels(connected) as labels
      `;
      const result = await session.run(query, this.serializeProperties(params));
      return result.records.map((record) => ({
        id: record.get("id"),
        label: record.get("labels")[0] || "Node",
        properties: this.deserializeProperties(
          record.get("connected").properties
        )
      }));
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to traverse from node ${config.startId}`
      );
    } finally {
      await session.close();
    }
  }
  async findPath(config) {
    const session = this.getSession();
    try {
      const relTypes = config.relationshipTypes && config.relationshipTypes.length > 0 ? `:${config.relationshipTypes.join("|")}` : "";
      const direction = config.direction || "BOTH";
      let relPattern;
      if (direction === "OUTGOING") {
        relPattern = `-[${relTypes}*..${config.maxHops}]->`;
      } else if (direction === "INCOMING") {
        relPattern = `<-[${relTypes}*..${config.maxHops}]-`;
      } else {
        relPattern = `-[${relTypes}*..${config.maxHops}]-`;
      }
      const idFunc = this.getIdFunction();
      const query = `
        MATCH (start), (end)
        WHERE ${idFunc}(start) = $fromId AND ${idFunc}(end) = $toId
        MATCH path = shortestPath((start)${relPattern}(end))
        RETURN path
      `;
      const result = await session.run(query, {
        fromId: config.fromId,
        toId: config.toId
      });
      if (result.records.length === 0) {
        return null;
      }
      const pathObj = result.records[0].get("path");
      const nodes = pathObj.segments.map((segment) => {
        const node = segment.start;
        return {
          id: node.elementId,
          label: node.labels[0] || "Node",
          properties: this.deserializeProperties(node.properties)
        };
      });
      if (pathObj.segments.length > 0) {
        const lastSegment = pathObj.segments[pathObj.segments.length - 1];
        const endNode = lastSegment.end;
        nodes.push({
          id: endNode.elementId,
          label: endNode.labels[0] || "Node",
          properties: this.deserializeProperties(endNode.properties)
        });
      }
      const relationships = pathObj.segments.map(
        (segment) => {
          const rel = segment.relationship;
          return {
            id: rel.elementId,
            type: rel.type,
            from: segment.start.elementId,
            to: segment.end.elementId,
            properties: this.deserializeProperties(rel.properties)
          };
        }
      );
      return {
        nodes,
        relationships,
        length: pathObj.length
      };
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to find path from ${config.fromId} to ${config.toId}`
      );
    } finally {
      await session.close();
    }
  }
  // ============================================================================
  // Batch Operations
  // ============================================================================
  async batchWrite(operations) {
    const session = this.getSession();
    try {
      const tx = session.beginTransaction();
      for (const op of operations) {
        switch (op.type) {
          case "CREATE_NODE": {
            const node = op.data;
            const idFunc = this.getIdFunction();
            await tx.run(
              `CREATE (n:${this.escapeLabel(node.label)} $properties) RETURN ${idFunc}(n) as id`,
              { properties: this.serializeProperties(node.properties) }
            );
            break;
          }
          case "UPDATE_NODE": {
            const data = op.data;
            const idFunc = this.getIdFunction();
            await tx.run(
              `MATCH (n) WHERE ${idFunc}(n) = $id SET n += $properties`,
              {
                id: this.convertIdForQuery(data.id),
                properties: this.serializeProperties(data.properties)
              }
            );
            break;
          }
          case "DELETE_NODE": {
            const data = op.data;
            const idFunc = this.getIdFunction();
            await tx.run(`MATCH (n) WHERE ${idFunc}(n) = $id DETACH DELETE n`, {
              id: this.convertIdForQuery(data.id)
            });
            break;
          }
          case "CREATE_EDGE": {
            const edge = op.data;
            const idFunc = this.getIdFunction();
            await tx.run(
              `
              MATCH (from), (to)
              WHERE ${idFunc}(from) = $fromId AND ${idFunc}(to) = $toId
              CREATE (from)-[r:${this.escapeLabel(edge.type)} $properties]->(to)
              RETURN ${idFunc}(r) as id
            `,
              {
                fromId: this.convertIdForQuery(edge.from),
                toId: this.convertIdForQuery(edge.to),
                properties: this.serializeProperties(edge.properties || {})
              }
            );
            break;
          }
          case "DELETE_EDGE": {
            const data = op.data;
            const idFunc = this.getIdFunction();
            await tx.run(`MATCH ()-[r]->() WHERE ${idFunc}(r) = $id DELETE r`, {
              id: this.convertIdForQuery(data.id)
            });
            break;
          }
        }
      }
      await tx.commit();
    } catch (error) {
      throw this.handleError(error, `Batch write failed`);
    } finally {
      await session.close();
    }
  }
  // ============================================================================
  // Utility Operations
  // ============================================================================
  async countNodes(label) {
    const session = this.getSession();
    try {
      const query = label ? `MATCH (n:${this.escapeLabel(label)}) RETURN count(n) as count` : `MATCH (n) RETURN count(n) as count`;
      const result = await session.run(query);
      return this.toNumber(result.records[0].get("count"));
    } catch (error) {
      throw this.handleError(error, `Failed to count nodes`);
    } finally {
      await session.close();
    }
  }
  async countEdges(type) {
    const session = this.getSession();
    try {
      const query = type ? `MATCH ()-[r:${this.escapeLabel(type)}]->() RETURN count(r) as count` : `MATCH ()-[r]->() RETURN count(r) as count`;
      const result = await session.run(query);
      return this.toNumber(result.records[0].get("count"));
    } catch (error) {
      throw this.handleError(error, `Failed to count edges`);
    } finally {
      await session.close();
    }
  }
  async clearDatabase() {
    const session = this.getSession();
    try {
      await session.run(`MATCH (n) DETACH DELETE n`);
    } catch (error) {
      throw this.handleError(error, `Failed to clear database`);
    } finally {
      await session.close();
    }
  }
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  getSession() {
    if (!this.driver) {
      throw new GraphConnectionError("Not connected to graph database");
    }
    return this.config?.database ? this.driver.session({ database: this.config.database }) : this.driver.session();
  }
  escapeLabel(label) {
    return label.replace(/[^a-zA-Z0-9_]/g, "_");
  }
  escapeProperty(property) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(property)) {
      return property;
    }
    return `\`${property.replace(/`/g, "``")}\``;
  }
  serializeValue(value) {
    if (value instanceof Date) {
      return value.getTime();
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.serializeValue(v));
    }
    if (value && typeof value === "object" && !(value instanceof import_neo4j_driver.Integer)) {
      return JSON.stringify(value);
    }
    return value;
  }
  serializeProperties(properties) {
    const result = {};
    for (const [key, value] of Object.entries(properties)) {
      result[key] = this.serializeValue(value);
    }
    return result;
  }
  deserializeValue(value) {
    if (value instanceof import_neo4j_driver.Integer) {
      return value.toNumber();
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.deserializeValue(v));
    }
    if (value && typeof value === "object") {
      if (value.properties) {
        return this.deserializeProperties(value.properties);
      }
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
    }
    return value;
  }
  deserializeProperties(properties) {
    const result = {};
    for (const [key, value] of Object.entries(properties)) {
      result[key] = this.deserializeValue(value);
    }
    return result;
  }
  toNumber(value) {
    if (value instanceof import_neo4j_driver.Integer) {
      return value.toNumber();
    }
    return Number(value);
  }
  handleError(error, context) {
    if (error instanceof GraphDatabaseError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new GraphDatabaseError(
      `${context}: ${message}`,
      void 0,
      error instanceof Error ? error : void 0
    );
  }
};

// src/graph/sync/syncUtils.ts
async function syncContextToGraph(context, adapter, tenantId) {
  const nodeId = await adapter.mergeNode(
    {
      label: "Context",
      properties: {
        contextId: context.contextId,
        memorySpaceId: context.memorySpaceId,
        tenantId: tenantId || context.tenantId || null,
        purpose: context.purpose,
        status: context.status,
        depth: context.depth,
        userId: context.userId || null,
        parentId: context.parentId || null,
        rootId: context.rootId || null,
        participants: context.participants,
        createdAt: context.createdAt,
        updatedAt: context.updatedAt,
        completedAt: context.completedAt || null
      }
    },
    { contextId: context.contextId }
  );
  return nodeId;
}
async function syncConversationToGraph(conversation, adapter, tenantId) {
  const nodeId = await adapter.mergeNode(
    {
      label: "Conversation",
      properties: {
        conversationId: conversation.conversationId,
        memorySpaceId: conversation.memorySpaceId,
        tenantId: tenantId || conversation.tenantId || null,
        participantId: conversation.participantId || null,
        type: conversation.type,
        userId: conversation.participants.userId || null,
        agentId: conversation.participants.agentId || null,
        messageCount: conversation.messageCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    },
    { conversationId: conversation.conversationId }
  );
  return nodeId;
}
async function syncMemoryToGraph(memory, adapter, tenantId) {
  const nodeId = await adapter.mergeNode(
    {
      label: "Memory",
      properties: {
        memoryId: memory.memoryId,
        memorySpaceId: memory.memorySpaceId,
        tenantId: tenantId || memory.tenantId || null,
        participantId: memory.participantId || null,
        userId: memory.userId || null,
        agentId: memory.agentId || null,
        content: memory.content.substring(0, 200),
        // Truncate for graph
        contentType: memory.contentType,
        sourceType: memory.sourceType,
        sourceUserId: memory.sourceUserId || null,
        importance: memory.importance,
        tags: memory.tags,
        version: memory.version,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt
      }
    },
    { memoryId: memory.memoryId }
  );
  return nodeId;
}
async function syncFactToGraph(fact, adapter, tenantId) {
  const nodeId = await adapter.mergeNode(
    {
      label: "Fact",
      properties: {
        factId: fact.factId,
        memorySpaceId: fact.memorySpaceId,
        tenantId: tenantId || fact.tenantId || null,
        participantId: fact.participantId || null,
        fact: fact.fact,
        factType: fact.factType,
        subject: fact.subject || null,
        predicate: fact.predicate || null,
        object: fact.object || null,
        confidence: fact.confidence,
        sourceType: fact.sourceType,
        tags: fact.tags,
        version: fact.version,
        supersededBy: fact.supersededBy || null,
        supersedes: fact.supersedes || null,
        createdAt: fact.createdAt,
        updatedAt: fact.updatedAt
      }
    },
    { factId: fact.factId }
  );
  return nodeId;
}
async function syncMemorySpaceToGraph(memorySpace, adapter, tenantId) {
  const nodeId = await adapter.mergeNode(
    {
      label: "MemorySpace",
      properties: {
        memorySpaceId: memorySpace.memorySpaceId,
        tenantId: tenantId || memorySpace.tenantId || null,
        name: memorySpace.name || null,
        type: memorySpace.type,
        status: memorySpace.status,
        participantCount: memorySpace.participants.length,
        createdAt: memorySpace.createdAt,
        updatedAt: memorySpace.updatedAt
      }
    },
    { memorySpaceId: memorySpace.memorySpaceId }
  );
  return nodeId;
}
async function findGraphNodeId(label, cortexId, adapter) {
  let propertyName;
  switch (label) {
    case "Context":
      propertyName = "contextId";
      break;
    case "Conversation":
      propertyName = "conversationId";
      break;
    case "Memory":
      propertyName = "memoryId";
      break;
    case "Fact":
      propertyName = "factId";
      break;
    case "MemorySpace":
      propertyName = "memorySpaceId";
      break;
    case "User":
      propertyName = "userId";
      break;
    case "Agent":
      propertyName = "agentId";
      break;
    case "Participant":
      propertyName = "participantId";
      break;
    default:
      throw new Error(`Unknown label: ${label}`);
  }
  const nodes = await adapter.findNodes(label, { [propertyName]: cortexId }, 1);
  return nodes.length > 0 ? nodes[0].id : null;
}
async function ensureUserNode(userId, adapter, tenantId) {
  return await adapter.mergeNode(
    {
      label: "User",
      properties: {
        userId,
        tenantId: tenantId || null,
        createdAt: Date.now()
      }
    },
    { userId }
  );
}
async function ensureAgentNode(agentId, adapter, tenantId) {
  return await adapter.mergeNode(
    {
      label: "Agent",
      properties: {
        agentId,
        tenantId: tenantId || null,
        createdAt: Date.now()
      }
    },
    { agentId }
  );
}
async function ensureParticipantNode(participantId, adapter, tenantId) {
  return await adapter.mergeNode(
    {
      label: "Participant",
      properties: {
        participantId,
        tenantId: tenantId || null,
        createdAt: Date.now()
      }
    },
    { participantId }
  );
}
async function ensureEntityNode(entityName, entityType, adapter, tenantId) {
  return await adapter.mergeNode(
    {
      label: "Entity",
      properties: {
        name: entityName,
        type: entityType,
        tenantId: tenantId || null,
        createdAt: Date.now()
      }
    },
    { name: entityName }
  );
}
async function ensureEnrichedEntityNode(entityName, entityType, fullValue, adapter, tenantId) {
  return await adapter.mergeNode(
    {
      label: "Entity",
      properties: {
        name: entityName,
        type: entityType,
        tenantId: tenantId || null,
        entityType,
        // Specific entity type (e.g., "preferred_name")
        fullValue: fullValue || null,
        // Full value if available
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    },
    { name: entityName }
  );
}

// src/graph/sync/syncRelationships.ts
async function syncContextRelationships(context, contextNodeId, adapter) {
  if (context.parentId) {
    const parentNodeId = await findGraphNodeId(
      "Context",
      context.parentId,
      adapter
    );
    if (parentNodeId) {
      await adapter.createEdge({
        type: "CHILD_OF",
        from: contextNodeId,
        to: parentNodeId,
        properties: {
          depth: context.depth,
          createdAt: context.createdAt
        }
      });
    }
  }
  if (context.userId) {
    const userNodeId = await ensureUserNode(context.userId, adapter);
    await adapter.createEdge({
      type: "INVOLVES",
      from: contextNodeId,
      to: userNodeId,
      properties: {
        createdAt: context.createdAt
      }
    });
  }
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    context.memorySpaceId,
    adapter
  );
  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: contextNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: context.createdAt
      }
    });
  }
  if (context.conversationRef) {
    const conversationNodeId = await findGraphNodeId(
      "Conversation",
      context.conversationRef.conversationId,
      adapter
    );
    if (conversationNodeId) {
      await adapter.createEdge({
        type: "TRIGGERED_BY",
        from: contextNodeId,
        to: conversationNodeId,
        properties: {
          messageIds: context.conversationRef.messageIds || [],
          createdAt: context.createdAt
        }
      });
    }
  }
  if (context.grantedAccess) {
    for (const grant of context.grantedAccess) {
      const grantedMemorySpaceNodeId = await findGraphNodeId(
        "MemorySpace",
        grant.memorySpaceId,
        adapter
      );
      if (grantedMemorySpaceNodeId) {
        await adapter.createEdge({
          type: "GRANTS_ACCESS_TO",
          from: contextNodeId,
          to: grantedMemorySpaceNodeId,
          properties: {
            scope: grant.scope,
            grantedAt: grant.grantedAt
          }
        });
      }
    }
  }
}
async function syncConversationRelationships(conversation, conversationNodeId, adapter) {
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    conversation.memorySpaceId,
    adapter
  );
  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: conversationNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: conversation.createdAt
      }
    });
  }
  if (conversation.participants.userId) {
    const userNodeId = await ensureUserNode(
      conversation.participants.userId,
      adapter
    );
    await adapter.createEdge({
      type: "INVOLVES",
      from: conversationNodeId,
      to: userNodeId,
      properties: {
        createdAt: conversation.createdAt
      }
    });
  }
  if (conversation.participants.agentId) {
    const agentNodeId = await ensureAgentNode(
      conversation.participants.agentId,
      adapter
    );
    await adapter.createEdge({
      type: "INVOLVES",
      from: conversationNodeId,
      to: agentNodeId,
      properties: {
        createdAt: conversation.createdAt
      }
    });
  }
  if (conversation.participantId) {
    const participantNodeId = await ensureParticipantNode(
      conversation.participantId,
      adapter
    );
    await adapter.createEdge({
      type: "HAS_PARTICIPANT",
      from: conversationNodeId,
      to: participantNodeId,
      properties: {
        createdAt: conversation.createdAt
      }
    });
  }
}
async function syncMemoryRelationships(memory, memoryNodeId, adapter) {
  if (memory.conversationRef) {
    const conversationNodeId = await findGraphNodeId(
      "Conversation",
      memory.conversationRef.conversationId,
      adapter
    );
    if (conversationNodeId) {
      await adapter.createEdge({
        type: "REFERENCES",
        from: memoryNodeId,
        to: conversationNodeId,
        properties: {
          messageIds: memory.conversationRef.messageIds,
          createdAt: memory.createdAt
        }
      });
    }
  }
  if (memory.userId) {
    const userNodeId = await ensureUserNode(memory.userId, adapter);
    await adapter.createEdge({
      type: "RELATES_TO",
      from: memoryNodeId,
      to: userNodeId,
      properties: {
        createdAt: memory.createdAt
      }
    });
  }
  if (memory.agentId) {
    const agentNodeId = await ensureAgentNode(memory.agentId, adapter);
    await adapter.createEdge({
      type: "RELATES_TO",
      from: memoryNodeId,
      to: agentNodeId,
      properties: {
        createdAt: memory.createdAt
      }
    });
  }
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    memory.memorySpaceId,
    adapter
  );
  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: memoryNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: memory.createdAt
      }
    });
  }
  if (memory.immutableRef && memory.immutableRef.type === "fact") {
    const factNodeId = await findGraphNodeId(
      "Fact",
      memory.immutableRef.id,
      adapter
    );
    if (factNodeId) {
      await adapter.createEdge({
        type: "SOURCED_FROM",
        from: memoryNodeId,
        to: factNodeId,
        properties: {
          version: memory.immutableRef.version,
          createdAt: memory.createdAt
        }
      });
    }
  }
  if (memory.participantId) {
    const participantNodeId = await ensureParticipantNode(
      memory.participantId,
      adapter
    );
    await adapter.createEdge({
      type: "STORED_BY",
      from: memoryNodeId,
      to: participantNodeId,
      properties: {
        createdAt: memory.createdAt
      }
    });
  }
}
async function syncFactRelationships(fact, factNodeId, adapter) {
  const entityNodeIds = /* @__PURE__ */ new Map();
  if (fact.entities && fact.entities.length > 0) {
    for (const entity of fact.entities) {
      const entityNodeId = await ensureEnrichedEntityNode(
        entity.name,
        entity.type,
        entity.fullValue,
        adapter
      );
      entityNodeIds.set(entity.name.toLowerCase(), entityNodeId);
      await adapter.createEdge({
        type: "MENTIONS",
        from: factNodeId,
        to: entityNodeId,
        properties: {
          role: entity.type,
          fullValue: entity.fullValue,
          createdAt: fact.createdAt
        }
      });
    }
  }
  if (fact.relations && fact.relations.length > 0) {
    for (const relation of fact.relations) {
      let subjectNodeId = entityNodeIds.get(relation.subject.toLowerCase());
      if (!subjectNodeId) {
        subjectNodeId = await ensureEntityNode(
          relation.subject,
          "subject",
          adapter
        );
        entityNodeIds.set(relation.subject.toLowerCase(), subjectNodeId);
      }
      let objectNodeId = entityNodeIds.get(relation.object.toLowerCase());
      if (!objectNodeId) {
        objectNodeId = await ensureEntityNode(
          relation.object,
          "object",
          adapter
        );
        entityNodeIds.set(relation.object.toLowerCase(), objectNodeId);
      }
      const relationshipType = relation.predicate.toUpperCase().replace(/\s+/g, "_");
      await adapter.createEdge({
        type: relationshipType,
        from: subjectNodeId,
        to: objectNodeId,
        properties: {
          factId: fact.factId,
          confidence: fact.confidence,
          category: fact.category,
          createdAt: fact.createdAt
        }
      });
    }
  }
  if (fact.subject && !entityNodeIds.has(fact.subject.toLowerCase())) {
    const subjectNodeId = await ensureEntityNode(
      fact.subject,
      "subject",
      adapter
    );
    await adapter.createEdge({
      type: "MENTIONS",
      from: factNodeId,
      to: subjectNodeId,
      properties: {
        role: "subject",
        createdAt: fact.createdAt
      }
    });
  }
  if (fact.object && !entityNodeIds.has(fact.object.toLowerCase())) {
    const objectNodeId = await ensureEntityNode(fact.object, "object", adapter);
    await adapter.createEdge({
      type: "MENTIONS",
      from: factNodeId,
      to: objectNodeId,
      properties: {
        role: "object",
        createdAt: fact.createdAt
      }
    });
  }
  if (fact.subject && fact.object && fact.predicate && (!fact.relations || fact.relations.length === 0)) {
    const subjectNodes = await adapter.findNodes(
      "Entity",
      { name: fact.subject },
      1
    );
    const objectNodes = await adapter.findNodes(
      "Entity",
      { name: fact.object },
      1
    );
    if (subjectNodes.length > 0 && objectNodes.length > 0) {
      const relationshipType = fact.predicate.toUpperCase().replace(/\s+/g, "_");
      await adapter.createEdge({
        type: relationshipType,
        from: subjectNodes[0].id,
        to: objectNodes[0].id,
        properties: {
          factId: fact.factId,
          confidence: fact.confidence,
          createdAt: fact.createdAt
        }
      });
    }
  }
  if (fact.sourceRef?.conversationId) {
    const conversationNodeId = await findGraphNodeId(
      "Conversation",
      fact.sourceRef.conversationId,
      adapter
    );
    if (conversationNodeId) {
      await adapter.createEdge({
        type: "EXTRACTED_FROM",
        from: factNodeId,
        to: conversationNodeId,
        properties: {
          messageIds: fact.sourceRef.messageIds || [],
          createdAt: fact.createdAt
        }
      });
    }
  }
  if (fact.sourceRef?.memoryId) {
    const memoryNodeId = await findGraphNodeId(
      "Memory",
      fact.sourceRef.memoryId,
      adapter
    );
    if (memoryNodeId) {
      await adapter.createEdge({
        type: "EXTRACTED_WITH",
        from: factNodeId,
        to: memoryNodeId,
        properties: {
          createdAt: fact.createdAt
        }
      });
    }
  }
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    fact.memorySpaceId,
    adapter
  );
  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: factNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: fact.createdAt
      }
    });
  }
  if (fact.supersedes) {
    const supersededFactNodeId = await findGraphNodeId(
      "Fact",
      fact.supersedes,
      adapter
    );
    if (supersededFactNodeId) {
      await adapter.createEdge({
        type: "SUPERSEDES",
        from: factNodeId,
        to: supersededFactNodeId,
        properties: {
          version: fact.version,
          createdAt: fact.createdAt
        }
      });
    }
  }
  if (fact.participantId) {
    const participantNodeId = await ensureParticipantNode(
      fact.participantId,
      adapter
    );
    await adapter.createEdge({
      type: "EXTRACTED_BY",
      from: factNodeId,
      to: participantNodeId,
      properties: {
        createdAt: fact.createdAt
      }
    });
  }
}

// src/graph/sync/orphanDetection.ts
var ORPHAN_RULES = {
  // Conversations: Keep if referenced by Memory, Fact, or Context
  Conversation: {
    keepIfReferencedBy: ["Memory", "Fact", "Context"]
  },
  // Entities: Keep if referenced by any Fact
  Entity: {
    keepIfReferencedBy: ["Fact"]
  },
  // Users: Never auto-delete (shared across memory spaces)
  User: {
    neverDelete: true
  },
  // Participants: Never auto-delete (Hive Mode participants)
  Participant: {
    neverDelete: true
  },
  // Memory Spaces: Never auto-delete (critical isolation boundary)
  MemorySpace: {
    neverDelete: true
  },
  // Primary entities: Only delete if explicitly requested
  Memory: { explicitOnly: true },
  Fact: { explicitOnly: true },
  Context: { explicitOnly: true }
};
async function detectOrphan(nodeId, nodeLabel, deletionContext, adapter) {
  const rules = deletionContext.orphanRules ?? ORPHAN_RULES;
  const rule = rules[nodeLabel];
  if (rule !== void 0 && rule.neverDelete) {
    return {
      isOrphan: false,
      reason: "Never delete rule",
      referencedBy: [],
      partOfCircularIsland: false
    };
  }
  if (rule !== void 0 && rule.explicitOnly) {
    return {
      isOrphan: false,
      reason: "Explicit delete only",
      referencedBy: [],
      partOfCircularIsland: false
    };
  }
  const incoming = await adapter.query(
    `
    MATCH (referrer)-[r]->(target)
    WHERE id(target) = $nodeId
    RETURN id(referrer) as referrerId, 
           labels(referrer)[0] as refererLabel,
           type(r) as relationshipType
  `,
    { nodeId }
  );
  const externalRefs = incoming.records.filter(
    (r) => !deletionContext.deletedNodeIds.has(r.referrerId) && r.referrerId !== nodeId
  );
  if (externalRefs.length === 0) {
    const islandCheck = await checkCircularIsland(
      nodeId,
      nodeLabel,
      deletionContext,
      adapter
    );
    return {
      isOrphan: true,
      reason: islandCheck.isIsland ? "Circular orphan island" : "No references",
      referencedBy: [],
      partOfCircularIsland: islandCheck.isIsland,
      islandNodes: islandCheck.islandNodes
    };
  }
  const defaultAnchors = ["Memory", "Fact", "Context"];
  const anchorLabels = rule ? rule.keepIfReferencedBy || defaultAnchors : defaultAnchors;
  const hasAnchorRef = externalRefs.some(
    (r) => anchorLabels.includes(r.refererLabel)
  );
  if (!hasAnchorRef) {
    return {
      isOrphan: true,
      reason: "No anchor references",
      referencedBy: externalRefs.map((r) => r.referrerId),
      partOfCircularIsland: false
    };
  }
  return {
    isOrphan: false,
    reason: "Has anchor references",
    referencedBy: externalRefs.map((r) => r.referrerId),
    partOfCircularIsland: false
  };
}
async function checkCircularIsland(nodeId, nodeLabel, deletionContext, adapter) {
  const visited = /* @__PURE__ */ new Set();
  const islandNodes = /* @__PURE__ */ new Set([nodeId]);
  const queue = [nodeId];
  const maxDepth = 10;
  let depth = 0;
  while (queue.length > 0 && depth < maxDepth) {
    const currentBatch = [...queue];
    queue.length = 0;
    for (const current of currentBatch) {
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = await adapter.query(
        `
        MATCH (n)--(neighbor)
        WHERE id(n) = $currentId
        RETURN DISTINCT id(neighbor) as neighborId,
               labels(neighbor)[0] as neighborLabel
      `,
        { currentId: current }
      );
      for (const neighbor of neighbors.records) {
        if (deletionContext.deletedNodeIds.has(neighbor.neighborId)) {
          continue;
        }
        if (["Memory", "Fact", "Context"].includes(neighbor.neighborLabel)) {
          return { isIsland: false, islandNodes: [] };
        }
        if (!visited.has(neighbor.neighborId)) {
          islandNodes.add(neighbor.neighborId);
          queue.push(neighbor.neighborId);
        }
      }
    }
    depth++;
  }
  return {
    isIsland: true,
    islandNodes: Array.from(islandNodes)
  };
}
async function deleteWithOrphanCleanup(nodeId, nodeLabel, deletionContext, adapter) {
  const deletedNodes = [nodeId];
  const deletedEdges = [];
  const orphanIslands = [];
  deletionContext.deletedNodeIds.add(nodeId);
  const referencedNodes = await adapter.query(
    `
    MATCH (n)-[r]->(referenced)
    WHERE id(n) = $nodeId
    RETURN id(referenced) as refId, 
           labels(referenced)[0] as refLabel,
           id(r) as edgeId
  `,
    { nodeId }
  );
  await adapter.deleteNode(nodeId, true);
  for (const ref of referencedNodes.records) {
    const orphanCheck = await detectOrphan(
      ref.refId,
      ref.refLabel,
      deletionContext,
      adapter
    );
    if (orphanCheck.isOrphan) {
      if (orphanCheck.partOfCircularIsland && orphanCheck.islandNodes) {
        for (const islandNodeId of orphanCheck.islandNodes) {
          if (!deletionContext.deletedNodeIds.has(islandNodeId)) {
            await adapter.deleteNode(islandNodeId, true);
            deletedNodes.push(islandNodeId);
            deletionContext.deletedNodeIds.add(islandNodeId);
          }
        }
        orphanIslands.push({
          nodes: orphanCheck.islandNodes,
          reason: orphanCheck.reason
        });
      } else {
        const cascadeResult = await deleteWithOrphanCleanup(
          ref.refId,
          ref.refLabel,
          deletionContext,
          adapter
        );
        deletedNodes.push(...cascadeResult.deletedNodes);
        deletedEdges.push(...cascadeResult.deletedEdges);
        orphanIslands.push(...cascadeResult.orphanIslands);
      }
    }
  }
  return {
    deletedNodes,
    deletedEdges,
    orphanIslands
  };
}
function createDeletionContext(reason, orphanRules) {
  return {
    deletedNodeIds: /* @__PURE__ */ new Set(),
    reason,
    timestamp: Date.now(),
    orphanRules
  };
}

// src/graph/sync/syncDeletes.ts
async function deleteMemoryFromGraph(memoryId, adapter, enableOrphanCleanup = true) {
  const nodeId = await findGraphNodeId("Memory", memoryId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }
  if (!enableOrphanCleanup) {
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }
  const deletionContext = createDeletionContext(
    `Delete Memory ${memoryId}`,
    ORPHAN_RULES
  );
  return await deleteWithOrphanCleanup(
    nodeId,
    "Memory",
    deletionContext,
    adapter
  );
}
async function deleteFactFromGraph(factId, adapter, enableOrphanCleanup = true) {
  const nodeId = await findGraphNodeId("Fact", factId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }
  if (!enableOrphanCleanup) {
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }
  const deletionContext = createDeletionContext(
    `Delete Fact ${factId}`,
    ORPHAN_RULES
  );
  return await deleteWithOrphanCleanup(
    nodeId,
    "Fact",
    deletionContext,
    adapter
  );
}
async function deleteContextFromGraph(contextId, adapter, enableOrphanCleanup = true) {
  const nodeId = await findGraphNodeId("Context", contextId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }
  if (!enableOrphanCleanup) {
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }
  const deletionContext = createDeletionContext(
    `Delete Context ${contextId}`,
    ORPHAN_RULES
  );
  return await deleteWithOrphanCleanup(
    nodeId,
    "Context",
    deletionContext,
    adapter
  );
}
async function deleteConversationFromGraph(conversationId, adapter, enableOrphanCleanup = true) {
  const nodeId = await findGraphNodeId("Conversation", conversationId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }
  if (!enableOrphanCleanup) {
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }
  const deletionContext = createDeletionContext(
    `Delete Conversation ${conversationId}`,
    ORPHAN_RULES
  );
  return await deleteWithOrphanCleanup(
    nodeId,
    "Conversation",
    deletionContext,
    adapter
  );
}
async function deleteMemorySpaceFromGraph(memorySpaceId, adapter) {
  const nodeId = await findGraphNodeId("MemorySpace", memorySpaceId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }
  await adapter.deleteNode(nodeId, true);
  return {
    deletedNodes: [nodeId],
    deletedEdges: [],
    orphanIslands: []
  };
}
async function deleteMutableFromGraph(namespace, key, adapter) {
  const nodes = await adapter.findNodes("Mutable", {
    namespace,
    key
  });
  if (nodes.length === 0) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }
  await adapter.deleteNode(nodes[0].id, true);
  return {
    deletedNodes: [nodes[0].id],
    deletedEdges: [],
    orphanIslands: []
  };
}

// src/graph/worker/GraphSyncWorker.ts
var GraphSyncWorker = class {
  client;
  adapter;
  options;
  running = false;
  unsubscribe;
  // Metrics
  metrics = {
    isRunning: false,
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    avgSyncTimeMs: 0,
    queueSize: 0
  };
  syncTimes = [];
  constructor(client, adapter, options) {
    this.client = client;
    this.adapter = adapter;
    this.options = {
      batchSize: options?.batchSize || 100,
      retryAttempts: options?.retryAttempts || 3,
      verbose: options?.verbose || false
    };
  }
  /**
   * Start the sync worker
   *
   * Subscribes to sync queue reactively - callback fires automatically
   * when items are added to the queue!
   */
  async start() {
    if (this.running) {
      if (this.options.verbose) {
        console.log("GraphSyncWorker already running");
      }
      return;
    }
    const connected = await this.adapter.isConnected();
    if (!connected) {
      throw new Error(
        "GraphSyncWorker: Graph adapter not connected. Call adapter.connect() first."
      );
    }
    this.running = true;
    this.metrics.isRunning = true;
    if (this.options.verbose) {
      console.log(
        `GraphSyncWorker: Starting (batch size: ${this.options.batchSize})`
      );
    }
    this.unsubscribe = this.client.onUpdate(
      // Note: In a real app, import from generated API
      // For now, we'll use a type assertion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "graphSync:getUnsyncedItems",
      { limit: this.options.batchSize },
      async (items) => {
        if (!this.running) return;
        this.metrics.queueSize = items.length;
        if (items.length > 0) {
          await this.processBatch(items);
        }
      }
    );
    if (this.options.verbose) {
      console.log("GraphSyncWorker: Subscribed to sync queue (reactive)");
    }
  }
  /**
   * Stop the sync worker
   */
  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.metrics.isRunning = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = void 0;
    }
    if (this.options.verbose) {
      console.log("GraphSyncWorker: Stopped");
      console.log("Final metrics:", this.metrics);
    }
  }
  /**
   * Get current health metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
  /**
   * Process a batch of sync items
   */
  async processBatch(items) {
    if (this.options.verbose) {
      console.log(`GraphSyncWorker: Processing ${items.length} items`);
    }
    for (const item of items) {
      await this.processItem(item);
    }
  }
  /**
   * Process a single sync item
   */
  async processItem(item) {
    const startTime = Date.now();
    try {
      if (item.operation === "delete") {
        await this.performDelete(item);
      } else {
        await this.performSync(item);
      }
      await this.client.mutation("graphSync:markSynced", {
        id: item._id
      });
      this.metrics.totalProcessed++;
      this.metrics.successCount++;
      this.metrics.lastSyncAt = Date.now();
      const syncTime = Date.now() - startTime;
      this.syncTimes.push(syncTime);
      if (this.syncTimes.length > 100) {
        this.syncTimes.shift();
      }
      this.metrics.avgSyncTimeMs = this.syncTimes.reduce((a, b) => a + b, 0) / this.syncTimes.length;
      if (this.options.verbose) {
        console.log(
          `GraphSyncWorker: Synced ${item.table}:${item.entityId} in ${syncTime}ms`
        );
      }
    } catch (error) {
      await this.client.mutation("graphSync:markFailed", {
        id: item._id,
        error: error instanceof Error ? error.message : String(error)
      });
      this.metrics.totalProcessed++;
      this.metrics.failureCount++;
      if (this.options.verbose) {
        console.error(
          `GraphSyncWorker: Failed to sync ${item.table}:${item.entityId}:`,
          error
        );
      }
    }
  }
  /**
   * Perform sync operation (insert or update)
   */
  async performSync(item) {
    if (!item.entity) {
      throw new Error("Entity data required for insert/update operations");
    }
    switch (item.table) {
      case "memories": {
        const nodeId = await syncMemoryToGraph(item.entity, this.adapter);
        await syncMemoryRelationships(item.entity, nodeId, this.adapter);
        break;
      }
      case "facts": {
        const nodeId = await syncFactToGraph(item.entity, this.adapter);
        await syncFactRelationships(item.entity, nodeId, this.adapter);
        break;
      }
      case "contexts": {
        const nodeId = await syncContextToGraph(item.entity, this.adapter);
        await syncContextRelationships(item.entity, nodeId, this.adapter);
        break;
      }
      case "conversations": {
        const nodeId = await syncConversationToGraph(item.entity, this.adapter);
        await syncConversationRelationships(item.entity, nodeId, this.adapter);
        break;
      }
      case "memorySpaces": {
        await syncMemorySpaceToGraph(item.entity, this.adapter);
        break;
      }
      default:
        throw new Error(`Unknown table type: ${item.table}`);
    }
  }
  /**
   * Perform delete operation
   */
  async performDelete(item) {
    switch (item.table) {
      case "memories":
        await deleteMemoryFromGraph(item.entityId, this.adapter, true);
        break;
      case "facts":
        await deleteFactFromGraph(item.entityId, this.adapter, true);
        break;
      case "contexts":
        await deleteContextFromGraph(item.entityId, this.adapter, true);
        break;
      case "conversations":
        await deleteConversationFromGraph(item.entityId, this.adapter, true);
        break;
      case "memorySpaces":
        await deleteMemorySpaceFromGraph(item.entityId, this.adapter);
        break;
      default:
        throw new Error(`Unknown table type: ${item.table}`);
    }
  }
};

// src/conversations/validators.ts
var ConversationValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "ConversationValidationError";
  }
};
function validateRequiredString(value, fieldName) {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new ConversationValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateConversationType(type) {
  if (type !== "user-agent" && type !== "agent-agent") {
    throw new ConversationValidationError(
      `Invalid conversation type "${type}". Must be "user-agent" or "agent-agent"`,
      "INVALID_TYPE",
      "type"
    );
  }
}
function validateMessageRole(role) {
  if (role !== "user" && role !== "agent" && role !== "system") {
    throw new ConversationValidationError(
      `Invalid message role "${role}". Must be "user", "agent", or "system"`,
      "INVALID_ROLE",
      "role"
    );
  }
}
function validateIdFormat(id, idType, fieldName) {
  if (id === void 0) {
    return;
  }
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ConversationValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_ID_FORMAT",
      fieldName
    );
  }
  if (id.includes("\n") || id.includes("\0")) {
    throw new ConversationValidationError(
      `${fieldName} contains invalid characters`,
      "INVALID_ID_FORMAT",
      fieldName
    );
  }
  if (id.length > 500) {
    throw new ConversationValidationError(
      `${fieldName} exceeds maximum length of 500 characters`,
      "INVALID_ID_FORMAT",
      fieldName
    );
  }
}
function validateExportFormat(format) {
  if (format !== "json" && format !== "csv") {
    throw new ConversationValidationError(
      `Invalid export format "${format}". Must be "json" or "csv"`,
      "INVALID_FORMAT",
      "format"
    );
  }
}
function validateSortOrder(order) {
  if (order === void 0) {
    return;
  }
  if (order !== "asc" && order !== "desc") {
    throw new ConversationValidationError(
      `Invalid sort order "${order}". Must be "asc" or "desc"`,
      "INVALID_SORT_ORDER",
      "sortOrder"
    );
  }
}
function validateSearchQuery(query) {
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new ConversationValidationError(
      "Search query is required and cannot be empty",
      "EMPTY_STRING",
      "query"
    );
  }
}
function validateLimit(limit, fieldName = "limit") {
  if (limit === void 0) {
    return;
  }
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    throw new ConversationValidationError(
      `${fieldName} must be an integer`,
      "INVALID_RANGE",
      fieldName
    );
  }
  if (limit < 1 || limit > 1e3) {
    throw new ConversationValidationError(
      `${fieldName} must be between 1 and 1000, got ${limit}`,
      "INVALID_RANGE",
      fieldName
    );
  }
}
function validateOffset(offset, fieldName = "offset") {
  if (offset === void 0) {
    return;
  }
  if (typeof offset !== "number" || !Number.isInteger(offset)) {
    throw new ConversationValidationError(
      `${fieldName} must be an integer`,
      "INVALID_RANGE",
      fieldName
    );
  }
  if (offset < 0) {
    throw new ConversationValidationError(
      `${fieldName} must be >= 0, got ${offset}`,
      "INVALID_RANGE",
      fieldName
    );
  }
}
function validateNonEmptyArray(arr, fieldName) {
  if (arr === void 0) {
    return;
  }
  if (!Array.isArray(arr)) {
    throw new ConversationValidationError(
      `${fieldName} must be an array`,
      "INVALID_RANGE",
      fieldName
    );
  }
  if (arr.length === 0) {
    throw new ConversationValidationError(
      `${fieldName} cannot be empty`,
      "EMPTY_ARRAY",
      fieldName
    );
  }
}
function validateDateRange(start, end) {
  if (start === void 0 || end === void 0) {
    return;
  }
  if (typeof start !== "number" || typeof end !== "number") {
    throw new ConversationValidationError(
      "Date range values must be numbers (timestamps)",
      "INVALID_DATE_RANGE"
    );
  }
  if (start >= end) {
    throw new ConversationValidationError(
      "Start date must be before end date",
      "INVALID_DATE_RANGE"
    );
  }
}
function validateParticipants(type, participants) {
  if (!participants) {
    throw new ConversationValidationError(
      "Participants is required",
      "MISSING_REQUIRED_FIELD",
      "participants"
    );
  }
  if (type === "user-agent") {
    const hasUserId = participants.userId && participants.userId.trim().length > 0;
    const hasUserIds = participants.userIds && Array.isArray(participants.userIds) && participants.userIds.length > 0;
    if (!hasUserId && !hasUserIds) {
      throw new ConversationValidationError(
        "user-agent conversations require userId or userIds",
        "INVALID_PARTICIPANTS",
        "participants.userId"
      );
    }
  } else {
    if (!participants.memorySpaceIds || !Array.isArray(participants.memorySpaceIds)) {
      throw new ConversationValidationError(
        "agent-agent conversations require memorySpaceIds array",
        "INVALID_PARTICIPANTS",
        "participants.memorySpaceIds"
      );
    }
    if (participants.memorySpaceIds.length < 2) {
      throw new ConversationValidationError(
        "agent-agent conversations require at least 2 memorySpaceIds",
        "INVALID_PARTICIPANTS",
        "participants.memorySpaceIds"
      );
    }
  }
}
function validateNoDuplicates(arr, fieldName) {
  if (!Array.isArray(arr)) {
    throw new ConversationValidationError(
      `${fieldName} must be an array`,
      "INVALID_RANGE",
      fieldName
    );
  }
  const seen = /* @__PURE__ */ new Set();
  const duplicates = [];
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.push(item);
    }
    seen.add(item);
  }
  if (duplicates.length > 0) {
    throw new ConversationValidationError(
      `${fieldName} contains duplicate values: ${duplicates.join(", ")}`,
      "DUPLICATE_VALUES",
      fieldName
    );
  }
}
var VALID_VISIBILITY_VALUES = ["private", "space", "public"];
function validateVisibility(visibility, fieldName = "visibility") {
  if (visibility === void 0) {
    return;
  }
  if (typeof visibility !== "string" || !VALID_VISIBILITY_VALUES.includes(
    visibility
  )) {
    throw new ConversationValidationError(
      `Invalid ${fieldName} "${visibility}". Must be "private", "space", or "public"`,
      "INVALID_VISIBILITY",
      fieldName
    );
  }
}
var VALID_GRANT_TYPES = ["user", "space", "link", "domain"];
var VALID_SHARE_STATUSES = ["active", "revoked", "expired"];
function validateGrantType(grantType, fieldName = "grantType") {
  if (!VALID_GRANT_TYPES.includes(
    grantType
  )) {
    throw new ConversationValidationError(
      `Invalid ${fieldName} "${grantType}". Must be "user", "space", "link", or "domain"`,
      "INVALID_GRANT_TYPE",
      fieldName
    );
  }
}
function validateShareStatus(status, fieldName = "status") {
  if (status === void 0) {
    return;
  }
  if (!VALID_SHARE_STATUSES.includes(
    status
  )) {
    throw new ConversationValidationError(
      `Invalid ${fieldName} "${status}". Must be "active", "revoked", or "expired"`,
      "INVALID_SHARE_STATUS",
      fieldName
    );
  }
}
function validateGrantedTo(grantType, grantedTo) {
  if (grantType === "user" && !grantedTo) {
    throw new ConversationValidationError(
      "grantedTo (userId) is required for user share type",
      "GRANTEE_REQUIRED",
      "grantedTo"
    );
  }
  if (grantType === "space" && !grantedTo) {
    throw new ConversationValidationError(
      "grantedTo (memorySpaceId) is required for space share type",
      "GRANTEE_REQUIRED",
      "grantedTo"
    );
  }
  if (grantType === "domain" && !grantedTo) {
    throw new ConversationValidationError(
      "grantedTo (email domain) is required for domain share type",
      "GRANTEE_REQUIRED",
      "grantedTo"
    );
  }
}

// src/conversations/index.ts
var ConversationsAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls (queries that don't go through resilience)
   * Extracts error.data and includes it in the thrown error message
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Create a new conversation
   *
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.create({
   *   memorySpaceId: 'user-123-personal',
   *   type: 'user-agent',
   *   participants: {
   *     userId: 'user-123',
   *     participantId: 'my-bot',
   *   },
   * });
   * ```
   */
  async create(input, _options) {
    validateRequiredString(input.memorySpaceId, "memorySpaceId");
    validateConversationType(input.type);
    validateIdFormat(input.conversationId, "conversation", "conversationId");
    validateParticipants(input.type, input.participants);
    if (input.type === "agent-agent" && input.participants.memorySpaceIds) {
      validateNoDuplicates(
        input.participants.memorySpaceIds,
        "participants.memorySpaceIds"
      );
    }
    validateVisibility(input.visibility);
    const conversationId = input.conversationId || this.generateConversationId();
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversations.create, {
        conversationId,
        memorySpaceId: input.memorySpaceId,
        participantId: input.participantId,
        tenantId: this.authContext?.tenantId,
        // Inject tenantId from auth context
        type: input.type,
        participants: input.participants,
        metadata: input.metadata,
        visibility: input.visibility,
        // Pass visibility (defaults to 'private' if undefined)
        collaborativeSettings: input.collaborativeSettings
        // Phase 4: Collaborative
      }),
      "conversations:create"
    );
    if (this.graphAdapter) {
      try {
        const nodeId = await syncConversationToGraph(
          result,
          this.graphAdapter
        );
        await syncConversationRelationships(
          result,
          nodeId,
          this.graphAdapter
        );
      } catch (error) {
        console.warn("Failed to sync conversation to graph:", error);
      }
    }
    return result;
  }
  /**
   * Get a conversation by ID
   *
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.get('conv-abc123');
   *
   * // With options
   * const convNoMessages = await cortex.conversations.get('conv-abc123', {
   *   includeMessages: false,
   * });
   *
   * // Limit messages returned
   * const convLimited = await cortex.conversations.get('conv-abc123', {
   *   messageLimit: 10,
   * });
   * ```
   */
  async get(conversationId, options) {
    validateRequiredString(conversationId, "conversationId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.get, {
        conversationId,
        tenantId: this.authContext?.tenantId,
        // Inject tenantId for isolation
        includeMessages: options?.includeMessages,
        messageLimit: options?.messageLimit
      }),
      "conversations:get"
    );
    return result;
  }
  /**
   * Add a message to a conversation
   *
   * @example
   * ```typescript
   * await cortex.conversations.addMessage({
   *   conversationId: 'conv-abc123',
   *   message: {
   *     role: 'user',
   *     content: 'Hello!',
   *   },
   * });
   * ```
   */
  async addMessage(input, _options) {
    validateRequiredString(input.conversationId, "conversationId");
    validateRequiredString(input.message.content, "message.content");
    validateMessageRole(input.message.role);
    validateIdFormat(input.message.id, "message", "message.id");
    const messageId = input.message.id || this.generateMessageId();
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.conversations.addMessage, {
          conversationId: input.conversationId,
          message: {
            id: messageId,
            role: input.message.role,
            content: input.message.content,
            participantId: input.message.participantId,
            // Updated for Hive Mode
            metadata: input.message.metadata
          }
        }),
        "conversations:addMessage"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        const nodes = await this.graphAdapter.findNodes(
          "Conversation",
          { conversationId: input.conversationId },
          1
        );
        if (nodes.length > 0) {
          await this.graphAdapter.updateNode(nodes[0].id, {
            messageCount: result.messageCount,
            updatedAt: result.updatedAt
          });
        }
      } catch (error) {
        console.warn("Failed to update conversation in graph:", error);
      }
    }
    return result;
  }
  /**
   * List conversations with optional filters and pagination
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.list({
   *   userId: 'user-123',
   *   limit: 10,
   * });
   * console.log(`Found ${result.total} conversations`);
   *
   * // With pagination and sorting
   * const page2 = await cortex.conversations.list({
   *   memorySpaceId: 'space-123',
   *   offset: 10,
   *   limit: 10,
   *   sortBy: 'lastMessageAt',
   *   sortOrder: 'desc',
   * });
   *
   * // Filter by date range
   * const recent = await cortex.conversations.list({
   *   createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last week
   * });
   * ```
   */
  async list(filter) {
    if (filter?.type) {
      validateConversationType(filter.type);
    }
    if (filter?.limit !== void 0) {
      validateLimit(filter.limit);
    }
    if (filter?.offset !== void 0) {
      validateOffset(filter.offset);
    }
    if (filter?.sortOrder) {
      validateSortOrder(filter.sortOrder);
    }
    let messageCountMin;
    let messageCountMax;
    if (filter?.messageCount !== void 0) {
      if (typeof filter.messageCount === "number") {
        messageCountMin = filter.messageCount;
        messageCountMax = filter.messageCount;
      } else {
        messageCountMin = filter.messageCount.min;
        messageCountMax = filter.messageCount.max;
      }
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.list, {
        type: filter?.type,
        userId: filter?.userId,
        memorySpaceId: filter?.memorySpaceId,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter?.tenantId),
        // Support explicit or auth context
        participantId: filter?.participantId,
        createdBefore: filter?.createdBefore,
        createdAfter: filter?.createdAfter,
        updatedBefore: filter?.updatedBefore,
        updatedAfter: filter?.updatedAfter,
        lastMessageBefore: filter?.lastMessageBefore,
        lastMessageAfter: filter?.lastMessageAfter,
        messageCountMin,
        messageCountMax,
        limit: filter?.limit,
        offset: filter?.offset,
        sortBy: filter?.sortBy,
        sortOrder: filter?.sortOrder,
        includeMessages: filter?.includeMessages
      }),
      "conversations:list"
    );
    return result;
  }
  /**
   * Count conversations
   *
   * @example
   * ```typescript
   * const count = await cortex.conversations.count({
   *   memorySpaceId: 'user-123-personal',
   * });
   * ```
   */
  async count(filter) {
    if (filter?.type) {
      validateConversationType(filter.type);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.count, {
        type: filter?.type,
        userId: filter?.userId,
        memorySpaceId: filter?.memorySpaceId
        // Updated
      }),
      "conversations:count"
    );
    return result;
  }
  /**
   * Delete a conversation (for GDPR/cleanup)
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.delete('conv-abc123');
   * console.log(`Deleted ${result.messagesDeleted} messages`);
   * console.log(`Restorable: ${result.restorable}`); // false - permanent!
   * ```
   */
  async delete(conversationId, _options) {
    validateRequiredString(conversationId, "conversationId");
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.conversations.deleteConversation, {
          conversationId
        }),
        "conversations:delete"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        await deleteConversationFromGraph(
          conversationId,
          this.graphAdapter,
          true
        );
      } catch (error) {
        console.warn("Failed to delete conversation from graph:", error);
      }
    }
    return result;
  }
  /**
   * Delete many conversations matching filters
   *
   * @example
   * ```typescript
   * // Preview what would be deleted (dryRun)
   * const preview = await cortex.conversations.deleteMany(
   *   { userId: 'user-123' },
   *   { dryRun: true }
   * );
   * console.log(`Would delete ${preview.wouldDelete} conversations`);
   *
   * // Execute deletion
   * const result = await cortex.conversations.deleteMany({
   *   memorySpaceId: 'user-123-personal',
   *   userId: 'user-123',
   *   type: 'user-agent',
   * });
   * console.log(`Deleted ${result.deleted} conversations`);
   * ```
   */
  async deleteMany(filter, options) {
    if (filter.type) {
      validateConversationType(filter.type);
    }
    if (!filter.userId && !filter.memorySpaceId && !filter.type) {
      throw new ConversationValidationError(
        "deleteMany requires at least one filter (userId, memorySpaceId, or type)",
        "MISSING_REQUIRED_FIELD"
      );
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversations.deleteMany, {
        userId: filter.userId,
        memorySpaceId: filter.memorySpaceId,
        type: filter.type,
        dryRun: options?.dryRun,
        confirmationThreshold: options?.confirmationThreshold
      }),
      "conversations:deleteMany"
    );
    return result;
  }
  /**
   * Get a specific message by ID
   *
   * @example
   * ```typescript
   * const message = await cortex.conversations.getMessage('conv-123', 'msg-456');
   * ```
   */
  async getMessage(conversationId, messageId) {
    validateRequiredString(conversationId, "conversationId");
    validateRequiredString(messageId, "messageId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.getMessage, {
        conversationId,
        messageId
      }),
      "conversations:getMessage"
    );
    return result;
  }
  /**
   * Get multiple messages by their IDs
   *
   * @example
   * ```typescript
   * const messages = await cortex.conversations.getMessagesByIds('conv-123', ['msg-1', 'msg-2']);
   * ```
   */
  async getMessagesByIds(conversationId, messageIds) {
    validateRequiredString(conversationId, "conversationId");
    validateNonEmptyArray(messageIds, "messageIds");
    validateNoDuplicates(messageIds, "messageIds");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.getMessagesByIds, {
        conversationId,
        messageIds
      }),
      "conversations:getMessagesByIds"
    );
    return result;
  }
  /**
   * Find an existing conversation by participants
   *
   * @example
   * ```typescript
   * const existing = await cortex.conversations.findConversation({
   *   memorySpaceId: 'user-123-personal',
   *   type: 'user-agent',
   *   userId: 'user-123',
   * });
   * ```
   */
  async findConversation(params) {
    validateRequiredString(params.memorySpaceId, "memorySpaceId");
    validateConversationType(params.type);
    if (params.type === "user-agent" && !params.userId) {
      throw new ConversationValidationError(
        "userId is required for user-agent conversation search",
        "MISSING_REQUIRED_FIELD",
        "userId"
      );
    }
    if (params.type === "agent-agent") {
      if (!params.memorySpaceIds || params.memorySpaceIds.length < 2) {
        throw new ConversationValidationError(
          "agent-agent conversations require at least 2 memorySpaceIds",
          "INVALID_ARRAY_LENGTH",
          "memorySpaceIds"
        );
      }
      validateNoDuplicates(params.memorySpaceIds, "memorySpaceIds");
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.findConversation, {
        memorySpaceId: params.memorySpaceId,
        type: params.type,
        userId: params.userId,
        memorySpaceIds: params.memorySpaceIds
      }),
      "conversations:findConversation"
    );
    return result;
  }
  /**
   * Get or create a conversation (atomic)
   *
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.getOrCreate({
   *   memorySpaceId: 'user-123-personal',
   *   type: 'user-agent',
   *   participants: { userId: 'user-123', participantId: 'my-bot' },
   * });
   * ```
   */
  async getOrCreate(input) {
    validateRequiredString(input.memorySpaceId, "memorySpaceId");
    validateConversationType(input.type);
    validateParticipants(input.type, input.participants);
    if (input.type === "agent-agent" && input.participants.memorySpaceIds) {
      validateNoDuplicates(
        input.participants.memorySpaceIds,
        "participants.memorySpaceIds"
      );
    }
    validateVisibility(input.visibility);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversations.getOrCreate, {
        memorySpaceId: input.memorySpaceId,
        participantId: input.participantId,
        type: input.type,
        participants: input.participants,
        metadata: input.metadata,
        visibility: input.visibility
        // Pass visibility (defaults to 'private' if undefined)
      }),
      "conversations:getOrCreate"
    );
    return result;
  }
  /**
   * Get paginated message history from a conversation
   *
   * @example
   * ```typescript
   * const history = await cortex.conversations.getHistory('conv-abc123', {
   *   limit: 20,
   *   offset: 0,
   *   sortOrder: 'desc',
   * });
   *
   * // Filter by date range
   * const recent = await cortex.conversations.getHistory('conv-abc123', {
   *   since: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
   * });
   *
   * // Filter by roles
   * const userMessages = await cortex.conversations.getHistory('conv-abc123', {
   *   roles: ['user'],
   * });
   * ```
   */
  async getHistory(conversationId, options) {
    validateRequiredString(conversationId, "conversationId");
    if (options?.limit !== void 0) {
      validateLimit(options.limit);
    }
    if (options?.offset !== void 0) {
      validateOffset(options.offset);
    }
    if (options?.sortOrder) {
      validateSortOrder(options.sortOrder);
    }
    if (options?.since !== void 0 && options?.until !== void 0) {
      validateDateRange(options.since, options.until);
    }
    try {
      const result = await this.executeWithResilience(
        () => this.client.query(api.conversations.getHistory, {
          conversationId,
          limit: options?.limit,
          offset: options?.offset,
          sortOrder: options?.sortOrder,
          since: options?.since,
          until: options?.until,
          roles: options?.roles
        }),
        "conversations:getHistory"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Search conversations by text query
   *
   * @example
   * ```typescript
   * const results = await cortex.conversations.search({
   *   query: 'password',
   *   filters: {
   *     userId: 'user-123',
   *     limit: 5,
   *   },
   * });
   *
   * // Search with options
   * const fuzzyResults = await cortex.conversations.search({
   *   query: 'account balance',
   *   options: {
   *     searchIn: 'both', // Search content and metadata
   *     matchMode: 'fuzzy',
   *   },
   * });
   * ```
   */
  async search(input) {
    validateSearchQuery(input.query);
    if (input.filters?.type) {
      validateConversationType(input.filters.type);
    }
    if (input.filters?.limit !== void 0) {
      validateLimit(input.filters.limit);
    }
    validateDateRange(
      input.filters?.dateRange?.start,
      input.filters?.dateRange?.end
    );
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.search, {
        tenantId: this.authContext?.tenantId,
        query: input.query,
        type: input.filters?.type,
        userId: input.filters?.userId,
        memorySpaceId: input.filters?.memorySpaceId,
        dateStart: input.filters?.dateRange?.start,
        dateEnd: input.filters?.dateRange?.end,
        limit: input.filters?.limit,
        searchIn: input.options?.searchIn,
        matchMode: input.options?.matchMode
      }),
      "conversations:search"
    );
    return result;
  }
  /**
   * Export conversations to JSON or CSV
   *
   * @example
   * ```typescript
   * const exported = await cortex.conversations.export({
   *   filters: { memorySpaceId: 'user-123-personal', userId: 'user-123' },
   *   format: 'json',
   *   includeMetadata: true,
   * });
   * ```
   */
  async export(options) {
    validateExportFormat(options.format);
    if (options.filters?.type) {
      validateConversationType(options.filters.type);
    }
    if (options.filters?.conversationIds) {
      validateNonEmptyArray(
        options.filters.conversationIds,
        "filters.conversationIds"
      );
    }
    validateDateRange(
      options.filters?.dateRange?.start,
      options.filters?.dateRange?.end
    );
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.exportConversations, {
        userId: options.filters?.userId,
        memorySpaceId: options.filters?.memorySpaceId,
        // Updated
        conversationIds: options.filters?.conversationIds,
        type: options.filters?.type,
        dateStart: options.filters?.dateRange?.start,
        dateEnd: options.filters?.dateRange?.end,
        format: options.format,
        includeMetadata: options.includeMetadata
      }),
      "conversations:export"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Visibility & Access Control (Shareable Chats Phase 1)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Check if a user has access to a conversation based on visibility
   *
   * This is a quick, cheap method to check access rights without fetching
   * the full conversation data. Use this for access control checks.
   *
   * @example
   * ```typescript
   * const access = await cortex.conversations.checkAccess({
   *   conversationId: 'conv-abc123',
   *   userId: 'user-456',
   * });
   *
   * if (access.canView) {
   *   // User can access the conversation
   * }
   * ```
   */
  async checkAccess(input) {
    validateRequiredString(input.conversationId, "conversationId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversations.checkAccess, {
        conversationId: input.conversationId,
        userId: input.userId,
        memorySpaceId: input.memorySpaceId
      }),
      "conversations:checkAccess"
    );
    return result;
  }
  /**
   * Set the visibility of a conversation
   *
   * Only the owner (participants.userId) can change visibility.
   *
   * @example
   * ```typescript
   * // Make a conversation public
   * const updated = await cortex.conversations.setVisibility({
   *   conversationId: 'conv-abc123',
   *   visibility: 'public',
   * });
   *
   * // Make it space-visible
   * await cortex.conversations.setVisibility({
   *   conversationId: 'conv-abc123',
   *   visibility: 'space',
   * });
   * ```
   */
  async setVisibility(input) {
    validateRequiredString(input.conversationId, "conversationId");
    validateVisibility(input.visibility);
    if (!["private", "space", "public"].includes(input.visibility)) {
      throw new ConversationValidationError(
        `Invalid visibility "${input.visibility}". Must be "private", "space", or "public"`,
        "INVALID_VISIBILITY",
        "visibility"
      );
    }
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.conversations.setVisibility, {
          conversationId: input.conversationId,
          visibility: input.visibility,
          userId: this.authContext?.userId
          // Pass userId from auth context for ownership verification
        }),
        "conversations:setVisibility"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Sharing Grants (Shareable Chats Phase 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Create a share for a conversation
   *
   * Creates a shareable link or grant for accessing a conversation.
   * Returns the share ID which can be used with `buildShareUrl()` to create URLs.
   *
   * @example
   * ```typescript
   * import { buildShareUrl } from '@cortex/sdk';
   *
   * // Create a public link share
   * const result = await cortex.conversations.share({
   *   conversationId: 'conv-abc123',
   *   grantType: 'link',
   *   permissions: { canView: true, canFork: true },
   *   expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
   * });
   *
   * // Build the URL
   * const url = buildShareUrl(result.shareId, {
   *   baseUrl: 'https://myapp.com/shared'
   * });
   * ```
   */
  async share(input) {
    validateRequiredString(input.conversationId, "conversationId");
    validateGrantType(input.grantType);
    validateGrantedTo(input.grantType, input.grantedTo);
    const permissions = {
      canView: input.permissions?.canView ?? true,
      canViewFacts: input.permissions?.canViewFacts ?? false,
      canViewMemories: input.permissions?.canViewMemories ?? false,
      canContinue: input.permissions?.canContinue ?? false,
      canFork: input.permissions?.canFork ?? false,
      canExport: input.permissions?.canExport ?? false
    };
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversationShares.create, {
        conversationId: input.conversationId,
        grantedBy: this.authContext?.userId || "anonymous",
        // Note: sourceMemorySpaceId is derived by the backend from the conversation
        grantType: input.grantType,
        grantedTo: input.grantedTo,
        permissions,
        expiresAt: input.expiresAt,
        maxViews: input.maxViews,
        redactBefore: input.redactBefore,
        redactSensitive: input.redactSensitive,
        tenantId: this.authContext?.tenantId
      }),
      "conversationShares:create"
    );
    const share = result;
    return {
      shareId: share.shareId,
      expiresAt: share.expiresAt,
      share
    };
  }
  /**
   * Revoke an existing share
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.revokeShare('share-abc123');
   * console.log(`Revoked at: ${result.revokedAt}`);
   * ```
   */
  async revokeShare(shareId) {
    validateRequiredString(shareId, "shareId");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversationShares.revoke, {
        shareId,
        userId: this.authContext?.userId
      }),
      "conversationShares:revoke"
    );
    const share = result;
    return {
      revoked: true,
      revokedAt: share.revokedAt || Date.now(),
      share
    };
  }
  /**
   * List shares for a conversation
   *
   * @example
   * ```typescript
   * // List all active shares
   * const shares = await cortex.conversations.listShares('conv-abc123', {
   *   status: 'active',
   * });
   * ```
   */
  async listShares(conversationId, filter) {
    validateRequiredString(conversationId, "conversationId");
    if (filter?.status) {
      validateShareStatus(filter.status);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversationShares.listByConversation, {
        conversationId,
        status: filter?.status
      }),
      "conversationShares:listByConversation"
    );
    return result;
  }
  /**
   * Get a share by its ID
   *
   * Also validates whether the share is still active and within limits.
   *
   * @example
   * ```typescript
   * const share = await cortex.conversations.getShare('share-abc123');
   * if (share?.isValid) {
   *   // Share is valid and can be used
   * }
   * ```
   */
  async getShare(shareId) {
    validateRequiredString(shareId, "shareId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversationShares.get, {
        shareId
      }),
      "conversationShares:get"
    );
    return result;
  }
  /**
   * Check if a user/space has access to a conversation via share
   *
   * @example
   * ```typescript
   * const access = await cortex.conversations.checkShareAccess({
   *   conversationId: 'conv-abc123',
   *   userId: 'user-456',
   * });
   *
   * if (access.hasAccess) {
   *   console.log('Permissions:', access.permissions);
   * }
   * ```
   */
  async checkShareAccess(input) {
    validateRequiredString(input.conversationId, "conversationId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversationShares.checkAccess, {
        conversationId: input.conversationId,
        userId: input.userId,
        memorySpaceId: input.memorySpaceId,
        emailDomain: input.emailDomain
      }),
      "conversationShares:checkAccess"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Snapshots (Shareable Chats Phase 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Create a snapshot of a conversation
   *
   * Creates an immutable point-in-time copy of a conversation with optional
   * PII redaction. Useful for sharing or archiving conversations.
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.snapshot({
   *   conversationId: 'conv-abc123',
   *   redactPII: true,
   * });
   * console.log(result.snapshotId);
   * ```
   */
  async snapshot(input) {
    validateRequiredString(input.conversationId, "conversationId");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversationSnapshots.create, {
        conversationId: input.conversationId,
        createdBy: this.authContext?.userId || "anonymous",
        redactPII: input.redactPII,
        redactBefore: input.redactBefore,
        customRedactions: input.customRedactions,
        includeFacts: input.includeFacts,
        includeMemories: input.includeMemories,
        tenantId: this.authContext?.tenantId
      }),
      "conversationSnapshots:create"
    );
    const snapshot = result;
    return {
      snapshotId: snapshot.snapshotId,
      snapshot
    };
  }
  /**
   * Get a snapshot by ID
   */
  async getSnapshot(snapshotId) {
    validateRequiredString(snapshotId, "snapshotId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversationSnapshots.get, {
        snapshotId
      }),
      "conversationSnapshots:get"
    );
    return result;
  }
  /**
   * List snapshots for a conversation
   */
  async listSnapshots(conversationId, options) {
    validateRequiredString(conversationId, "conversationId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.conversationSnapshots.listByConversation, {
        conversationId,
        includeArchived: options?.includeArchived
      }),
      "conversationSnapshots:listByConversation"
    );
    return result;
  }
  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId) {
    validateRequiredString(snapshotId, "snapshotId");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversationSnapshots.deleteSnapshot, {
        snapshotId,
        userId: this.authContext?.userId
      }),
      "conversationSnapshots:deleteSnapshot"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Collaborative Conversations (Shareable Chats Phase 4)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Approve a pending message in a collaborative conversation
   *
   * Only the conversation owner can approve messages.
   *
   * @example
   * ```typescript
   * await cortex.conversations.approveMessage({
   *   conversationId: 'conv-abc123',
   *   messageId: 'msg-456',
   * });
   * ```
   */
  async approveMessage(input) {
    validateRequiredString(input.conversationId, "conversationId");
    validateRequiredString(input.messageId, "messageId");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversations.approveMessage, {
        conversationId: input.conversationId,
        messageId: input.messageId,
        approverId: this.authContext?.userId || ""
      }),
      "conversations:approveMessage"
    );
    return result;
  }
  /**
   * Reject a pending message in a collaborative conversation
   *
   * Only the conversation owner can reject messages.
   *
   * @example
   * ```typescript
   * await cortex.conversations.rejectMessage({
   *   conversationId: 'conv-abc123',
   *   messageId: 'msg-456',
   * });
   * ```
   */
  async rejectMessage(input) {
    validateRequiredString(input.conversationId, "conversationId");
    validateRequiredString(input.messageId, "messageId");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.conversations.rejectMessage, {
        conversationId: input.conversationId,
        messageId: input.messageId,
        rejecterId: this.authContext?.userId || ""
      }),
      "conversations:rejectMessage"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helper Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  generateConversationId() {
    return `conv-${this.generateId()}`;
  }
  generateMessageId() {
    return `msg-${this.generateId()}`;
  }
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
};

// src/immutable/index.ts
init_api();

// src/immutable/validators.ts
var ImmutableValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "ImmutableValidationError";
  }
};
function validateType(type, fieldName = "type") {
  if (type === void 0 || type === null) {
    throw new ImmutableValidationError(
      `Type is required`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (typeof type !== "string" || type.trim().length === 0) {
    throw new ImmutableValidationError(
      `Type must be a non-empty string`,
      "INVALID_TYPE",
      fieldName
    );
  }
  const typeRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!typeRegex.test(type)) {
    throw new ImmutableValidationError(
      `${fieldName} must contain only valid characters (alphanumeric, dash, underscore, dot), got "${type}"`,
      "INVALID_TYPE",
      fieldName
    );
  }
}
function validateId(id, fieldName = "id") {
  if (id === void 0 || id === null) {
    throw new ImmutableValidationError(
      `ID is required`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ImmutableValidationError(
      `ID must be a non-empty string`,
      "INVALID_ID",
      fieldName
    );
  }
}
function validateData(data, fieldName = "data") {
  if (data === null || data === void 0) {
    throw new ImmutableValidationError(
      `Data is required`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new ImmutableValidationError(
      `Data must be a valid object`,
      "INVALID_DATA",
      fieldName
    );
  }
}
function validateMetadata2(metadata, fieldName = "metadata") {
  if (metadata === void 0) {
    return;
  }
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    throw new ImmutableValidationError(
      `Metadata must be an object`,
      "INVALID_METADATA",
      fieldName
    );
  }
}
function validateUserId2(userId, fieldName = "userId") {
  if (userId === void 0) {
    return;
  }
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new ImmutableValidationError(
      `${fieldName} cannot be empty if provided`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateVersion(version, fieldName = "version") {
  if (typeof version !== "number" || isNaN(version) || version < 1) {
    throw new ImmutableValidationError(
      `Version must be a positive integer >= 1`,
      "INVALID_VERSION",
      fieldName
    );
  }
  if (!Number.isInteger(version)) {
    throw new ImmutableValidationError(
      `Version must be a positive integer`,
      "INVALID_VERSION",
      fieldName
    );
  }
}
function validateTimestamp(timestamp, fieldName = "timestamp") {
  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) {
      throw new ImmutableValidationError(
        `Timestamp must be a valid Date object`,
        "INVALID_TIMESTAMP",
        fieldName
      );
    }
    return;
  }
  if (typeof timestamp !== "number" || isNaN(timestamp) || timestamp < 0) {
    throw new ImmutableValidationError(
      `Timestamp must be a valid Date object or positive number`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
}
function validateLimit2(limit, fieldName = "limit") {
  if (limit === void 0) {
    return;
  }
  if (typeof limit !== "number" || isNaN(limit) || limit < 1 || !Number.isInteger(limit)) {
    throw new ImmutableValidationError(
      `Limit must be a positive integer`,
      "INVALID_LIMIT",
      fieldName
    );
  }
}
function validateKeepLatest(keepLatest, fieldName = "keepLatest") {
  if (typeof keepLatest !== "number" || isNaN(keepLatest)) {
    throw new ImmutableValidationError(
      `${fieldName} must be a positive integer >= 1, got ${keepLatest}`,
      "INVALID_KEEP_LATEST",
      fieldName
    );
  }
  if (keepLatest < 1) {
    throw new ImmutableValidationError(
      `${fieldName} must be a positive integer >= 1, got ${keepLatest}`,
      "INVALID_KEEP_LATEST",
      fieldName
    );
  }
  if (!Number.isInteger(keepLatest)) {
    throw new ImmutableValidationError(
      `${fieldName} must be a positive integer, got ${keepLatest}`,
      "INVALID_KEEP_LATEST",
      fieldName
    );
  }
}
function validateImmutableEntry(entry) {
  if (!entry) {
    throw new ImmutableValidationError(
      "Entry is required",
      "MISSING_REQUIRED_FIELD"
    );
  }
  validateType(entry.type, "type");
  validateId(entry.id, "id");
  validateData(entry.data, "data");
  if (entry.metadata !== void 0) {
    validateMetadata2(entry.metadata, "metadata");
  }
  if (entry.userId !== void 0) {
    validateUserId2(entry.userId, "userId");
  }
}
function validateListFilter(filter) {
  if (filter.type !== void 0) {
    validateType(filter.type, "type");
  }
  if (filter.userId !== void 0) {
    validateUserId2(filter.userId, "userId");
  }
  if (filter.limit !== void 0) {
    validateLimit2(filter.limit, "limit");
  }
}
function validateSearchInput(input) {
  if (!input) {
    throw new ImmutableValidationError(
      "Search input is required",
      "MISSING_REQUIRED_FIELD"
    );
  }
  if (!input.query || typeof input.query !== "string" || input.query.trim().length === 0) {
    throw new ImmutableValidationError(
      "Search query is required and must be a non-empty string",
      "MISSING_REQUIRED_FIELD",
      "query"
    );
  }
  if (input.type !== void 0) {
    validateType(input.type, "type");
  }
  if (input.userId !== void 0) {
    validateUserId2(input.userId, "userId");
  }
  if (input.limit !== void 0) {
    validateLimit2(input.limit, "limit");
  }
}
function validateCountFilter(filter) {
  if (filter.type !== void 0) {
    validateType(filter.type, "type");
  }
  if (filter.userId !== void 0) {
    validateUserId2(filter.userId, "userId");
  }
}
function validatePurgeManyFilter(filter) {
  if (!filter) {
    throw new ImmutableValidationError("Filter is required", "INVALID_FILTER");
  }
  if (filter.type === void 0 && filter.userId === void 0) {
    throw new ImmutableValidationError(
      "purgeMany requires at least one filter (type or userId)",
      "INVALID_FILTER"
    );
  }
  if (filter.type !== void 0) {
    validateType(filter.type, "type");
  }
  if (filter.userId !== void 0) {
    validateUserId2(filter.userId, "userId");
  }
}

// src/immutable/index.ts
var ImmutableAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Store immutable data (creates v1 or increments version if exists)
   *
   * @example
   * ```typescript
   * const record = await cortex.immutable.store({
   *   type: 'kb-article',
   *   id: 'refund-policy',
   *   data: {
   *     title: 'Refund Policy',
   *     content: 'Refunds available within 30 days...',
   *   },
   * });
   * ```
   */
  async store(entry, _options) {
    validateImmutableEntry(entry);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.immutable.store, {
        type: entry.type,
        id: entry.id,
        data: entry.data,
        userId: entry.userId,
        tenantId: this.authContext?.tenantId,
        // Inject tenantId from auth context
        metadata: entry.metadata
      }),
      "immutable:store"
    );
    if (this.graphAdapter && entry.type !== "fact") {
      try {
        await this.graphAdapter.createNode({
          label: "Immutable",
          properties: {
            immutableType: entry.type,
            immutableId: entry.id,
            ...result
          }
        });
      } catch (error) {
        console.warn("Failed to sync immutable to graph:", error);
      }
    }
    return result;
  }
  /**
   * Get current version of an immutable entry
   *
   * @example
   * ```typescript
   * const article = await cortex.immutable.get('kb-article', 'refund-policy');
   * ```
   */
  async get(type, id) {
    validateType(type, "type");
    validateId(id, "id");
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.get, {
        type,
        id,
        tenantId: this.authContext?.tenantId
        // Multi-tenancy filter
      }),
      "immutable:get"
    );
    return result;
  }
  /**
   * Get a specific version of an immutable entry
   *
   * @example
   * ```typescript
   * const v1 = await cortex.immutable.getVersion('kb-article', 'refund-policy', 1);
   * ```
   */
  async getVersion(type, id, version) {
    validateType(type, "type");
    validateId(id, "id");
    validateVersion(version, "version");
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.getVersion, {
        type,
        id,
        version,
        tenantId: this.authContext?.tenantId
        // Multi-tenancy filter
      }),
      "immutable:getVersion"
    );
    return result;
  }
  /**
   * Get all versions of an immutable entry
   *
   * @example
   * ```typescript
   * const history = await cortex.immutable.getHistory('kb-article', 'refund-policy');
   * console.log(`${history.length} versions`);
   * ```
   */
  async getHistory(type, id) {
    validateType(type, "type");
    validateId(id, "id");
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.getHistory, {
        type,
        id
      }),
      "immutable:getHistory"
    );
    return result;
  }
  /**
   * List immutable entries with optional filters
   *
   * @example
   * ```typescript
   * const articles = await cortex.immutable.list({
   *   type: 'kb-article',
   *   limit: 10,
   * });
   * ```
   */
  async list(filter) {
    if (filter) {
      validateListFilter(filter);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.list, {
        type: filter?.type,
        userId: filter?.userId,
        tenantId: this.authContext?.tenantId,
        // Multi-tenancy filter
        limit: filter?.limit
      }),
      "immutable:list"
    );
    const paginatedResult = result;
    return paginatedResult.entries;
  }
  /**
   * Search immutable entries by text query
   *
   * @example
   * ```typescript
   * const results = await cortex.immutable.search({
   *   query: 'refund',
   *   type: 'kb-article',
   * });
   * ```
   */
  async search(input) {
    validateSearchInput(input);
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.search, {
        query: input.query,
        type: input.type,
        userId: input.userId,
        limit: input.limit
      }),
      "immutable:search"
    );
    return result;
  }
  /**
   * Count immutable entries
   *
   * @example
   * ```typescript
   * const count = await cortex.immutable.count({
   *   type: 'kb-article',
   * });
   * ```
   */
  async count(filter) {
    if (filter) {
      validateCountFilter(filter);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.count, {
        type: filter?.type,
        userId: filter?.userId
      }),
      "immutable:count"
    );
    return result;
  }
  /**
   * Delete (purge) an immutable entry and all its versions
   *
   * @example
   * ```typescript
   * await cortex.immutable.purge('feedback', 'feedback-123');
   * ```
   */
  async purge(type, id) {
    validateType(type, "type");
    validateId(id, "id");
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.immutable.purge, {
          type,
          id
        }),
        "immutable:purge"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Get version that was current at specific timestamp
   *
   * @example
   * ```typescript
   * const policy = await cortex.immutable.getAtTimestamp(
   *   'policy',
   *   'refund-policy',
   *   Date.parse('2025-01-01')
   * );
   * ```
   */
  async getAtTimestamp(type, id, timestamp) {
    validateType(type, "type");
    validateId(id, "id");
    validateTimestamp(timestamp, "timestamp");
    const ts = typeof timestamp === "number" ? timestamp : timestamp.getTime();
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.getAtTimestamp, {
        type,
        id,
        timestamp: ts
      }),
      "immutable:getAtTimestamp"
    );
    return result;
  }
  /**
   * Bulk delete immutable entries matching filters
   *
   * @example
   * ```typescript
   * const result = await cortex.immutable.purgeMany({ type: 'old-data', userId: 'user-123' });
   * ```
   */
  async purgeMany(filter) {
    validatePurgeManyFilter(filter);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.immutable.purgeMany, {
        type: filter.type,
        userId: filter.userId
      }),
      "immutable:purgeMany"
    );
    return result;
  }
  /**
   * Delete old versions while keeping recent ones
   *
   * @example
   * ```typescript
   * await cortex.immutable.purgeVersions('kb-article', 'guide-123', 20); // Keep latest 20
   * ```
   */
  async purgeVersions(type, id, keepLatest) {
    validateType(type, "type");
    validateId(id, "id");
    validateKeepLatest(keepLatest, "keepLatest");
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.immutable.purgeVersions, {
          type,
          id,
          keepLatest
        }),
        "immutable:purgeVersions"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
};

// src/mutable/index.ts
init_api();

// src/mutable/validators.ts
var MutableValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "MutableValidationError";
  }
};
var NAMESPACE_MAX_LENGTH = 100;
var KEY_MAX_LENGTH = 255;
var MAX_VALUE_SIZE = 1048576;
var MAX_LIMIT = 1e3;
var NAMESPACE_PATTERN = /^[a-zA-Z0-9-_.:]+$/;
var KEY_PATTERN = /^[a-zA-Z0-9-_.:/@]+$/;
function validateNamespace(namespace, fieldName = "namespace") {
  if (namespace === null || namespace === void 0) {
    throw new MutableValidationError(
      `${fieldName} is required`,
      "MISSING_NAMESPACE",
      fieldName
    );
  }
  if (typeof namespace !== "string") {
    throw new MutableValidationError(
      `${fieldName} must be a string, got ${typeof namespace}`,
      "INVALID_NAMESPACE",
      fieldName
    );
  }
  if (namespace.trim().length === 0) {
    throw new MutableValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_NAMESPACE",
      fieldName
    );
  }
}
function validateKey(key, fieldName = "key") {
  if (key === null || key === void 0) {
    throw new MutableValidationError(
      `${fieldName} is required`,
      "MISSING_KEY",
      fieldName
    );
  }
  if (typeof key !== "string") {
    throw new MutableValidationError(
      `${fieldName} must be a string, got ${typeof key}`,
      "INVALID_KEY",
      fieldName
    );
  }
  if (key.trim().length === 0) {
    throw new MutableValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_KEY",
      fieldName
    );
  }
}
function validateValue(value) {
  if (value === void 0) {
    throw new MutableValidationError(
      "Value is required (use null if you want to store null)",
      "MISSING_VALUE",
      "value"
    );
  }
}
function validateUserId3(userId) {
  if (userId === null || userId === void 0) {
    return;
  }
  if (typeof userId !== "string") {
    throw new MutableValidationError(
      `userId must be a string, got ${typeof userId}`,
      "INVALID_USER_ID",
      "userId"
    );
  }
  if (userId.trim().length === 0) {
    throw new MutableValidationError(
      "userId cannot be empty",
      "INVALID_USER_ID",
      "userId"
    );
  }
}
function validateNamespaceFormat(namespace) {
  if (namespace.length > NAMESPACE_MAX_LENGTH) {
    throw new MutableValidationError(
      `Namespace exceeds maximum length of ${NAMESPACE_MAX_LENGTH} characters (got ${namespace.length})`,
      "NAMESPACE_TOO_LONG",
      "namespace"
    );
  }
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new MutableValidationError(
      `Invalid namespace format "${namespace}". Must contain only alphanumeric characters, hyphens, underscores, dots, and colons`,
      "INVALID_NAMESPACE",
      "namespace"
    );
  }
}
function validateKeyFormat(key) {
  if (key.length > KEY_MAX_LENGTH) {
    throw new MutableValidationError(
      `Key exceeds maximum length of ${KEY_MAX_LENGTH} characters (got ${key.length})`,
      "KEY_TOO_LONG",
      "key"
    );
  }
  if (!KEY_PATTERN.test(key)) {
    throw new MutableValidationError(
      `Invalid key format "${key}". Must contain only alphanumeric characters, hyphens, underscores, dots, colons, slashes, and @ symbols`,
      "INVALID_KEY",
      "key"
    );
  }
}
function validateKeyPrefix(keyPrefix) {
  if (keyPrefix === null || keyPrefix === void 0) {
    return;
  }
  if (typeof keyPrefix !== "string") {
    throw new MutableValidationError(
      `keyPrefix must be a string, got ${typeof keyPrefix}`,
      "INVALID_KEY_PREFIX",
      "keyPrefix"
    );
  }
  if (keyPrefix.trim().length === 0) {
    throw new MutableValidationError(
      "keyPrefix cannot be empty",
      "INVALID_KEY_PREFIX",
      "keyPrefix"
    );
  }
  if (!KEY_PATTERN.test(keyPrefix)) {
    throw new MutableValidationError(
      `Invalid keyPrefix format "${keyPrefix}". Must contain only alphanumeric characters, hyphens, underscores, dots, colons, slashes, and @ symbols`,
      "INVALID_KEY_PREFIX",
      "keyPrefix"
    );
  }
}
function validateLimit3(limit) {
  if (limit === null || limit === void 0) {
    return;
  }
  if (typeof limit !== "number") {
    throw new MutableValidationError(
      `limit must be a number, got ${typeof limit}`,
      "INVALID_LIMIT_TYPE",
      "limit"
    );
  }
  if (!Number.isInteger(limit)) {
    throw new MutableValidationError(
      `limit must be an integer, got ${limit}`,
      "INVALID_LIMIT_TYPE",
      "limit"
    );
  }
  if (limit < 0) {
    throw new MutableValidationError(
      `limit must be non-negative, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit"
    );
  }
  if (limit > MAX_LIMIT) {
    throw new MutableValidationError(
      `limit exceeds maximum of ${MAX_LIMIT}, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit"
    );
  }
}
function validateAmount(amount, fieldName = "amount") {
  if (amount === null || amount === void 0) {
    return;
  }
  if (typeof amount !== "number") {
    throw new MutableValidationError(
      `${fieldName} must be a number, got ${typeof amount}`,
      "INVALID_AMOUNT_TYPE",
      fieldName
    );
  }
  if (!Number.isFinite(amount)) {
    throw new MutableValidationError(
      `${fieldName} must be a finite number, got ${amount}`,
      "INVALID_AMOUNT_TYPE",
      fieldName
    );
  }
  if (amount === 0) {
    console.warn(
      `Warning: ${fieldName} is zero, which will have no effect on the value`
    );
  }
}
function validateValueSize(value) {
  try {
    const serialized = JSON.stringify(value);
    const sizeInBytes = new Blob([serialized]).size;
    if (sizeInBytes > MAX_VALUE_SIZE) {
      const sizeInMB = (sizeInBytes / 1048576).toFixed(2);
      throw new MutableValidationError(
        `Value exceeds maximum size of 1MB (got ${sizeInMB}MB). Consider splitting data into multiple keys or using a different storage approach.`,
        "VALUE_TOO_LARGE",
        "value"
      );
    }
  } catch (error) {
    if (error instanceof MutableValidationError) {
      throw error;
    }
  }
}
function validateOffset2(offset) {
  if (offset === null || offset === void 0) {
    return;
  }
  if (typeof offset !== "number") {
    throw new MutableValidationError(
      `offset must be a number, got ${typeof offset}`,
      "INVALID_OFFSET_TYPE",
      "offset"
    );
  }
  if (!Number.isInteger(offset)) {
    throw new MutableValidationError(
      `offset must be an integer, got ${offset}`,
      "INVALID_OFFSET_TYPE",
      "offset"
    );
  }
  if (offset < 0) {
    throw new MutableValidationError(
      `offset must be non-negative, got ${offset}`,
      "INVALID_OFFSET_RANGE",
      "offset"
    );
  }
}
function validateTimestamp2(timestamp, fieldName) {
  if (timestamp === null || timestamp === void 0) {
    return;
  }
  if (typeof timestamp !== "number") {
    throw new MutableValidationError(
      `${fieldName} must be a number, got ${typeof timestamp}`,
      "INVALID_TIMESTAMP_TYPE",
      fieldName
    );
  }
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new MutableValidationError(
      `${fieldName} must be a valid Unix timestamp (positive number), got ${timestamp}`,
      "INVALID_TIMESTAMP_VALUE",
      fieldName
    );
  }
}
var VALID_SORT_BY = ["key", "updatedAt", "accessCount"];
function validateSortBy(sortBy) {
  if (sortBy === null || sortBy === void 0) {
    return;
  }
  if (typeof sortBy !== "string") {
    throw new MutableValidationError(
      `sortBy must be a string, got ${typeof sortBy}`,
      "INVALID_SORT_BY_TYPE",
      "sortBy"
    );
  }
  if (!VALID_SORT_BY.includes(sortBy)) {
    throw new MutableValidationError(
      `sortBy must be one of: ${VALID_SORT_BY.join(", ")}. Got "${sortBy}"`,
      "INVALID_SORT_BY_VALUE",
      "sortBy"
    );
  }
}
var VALID_SORT_ORDER = ["asc", "desc"];
function validateSortOrder2(sortOrder) {
  if (sortOrder === null || sortOrder === void 0) {
    return;
  }
  if (typeof sortOrder !== "string") {
    throw new MutableValidationError(
      `sortOrder must be a string, got ${typeof sortOrder}`,
      "INVALID_SORT_ORDER_TYPE",
      "sortOrder"
    );
  }
  if (!VALID_SORT_ORDER.includes(sortOrder)) {
    throw new MutableValidationError(
      `sortOrder must be one of: ${VALID_SORT_ORDER.join(", ")}. Got "${sortOrder}"`,
      "INVALID_SORT_ORDER_VALUE",
      "sortOrder"
    );
  }
}
function validateDryRun(dryRun) {
  if (dryRun === null || dryRun === void 0) {
    return;
  }
  if (typeof dryRun !== "boolean") {
    throw new MutableValidationError(
      `dryRun must be a boolean, got ${typeof dryRun}`,
      "INVALID_DRY_RUN_TYPE",
      "dryRun"
    );
  }
}
function validateUpdater(updater) {
  if (updater === null || updater === void 0) {
    throw new MutableValidationError(
      "Updater function is required",
      "INVALID_UPDATER_TYPE",
      "updater"
    );
  }
  if (typeof updater !== "function") {
    throw new MutableValidationError(
      `Updater must be a function, got ${typeof updater}`,
      "INVALID_UPDATER_TYPE",
      "updater"
    );
  }
}
function validateListFilter2(filter) {
  if (filter === null || filter === void 0) {
    throw new MutableValidationError(
      "Filter is required",
      "MISSING_FILTER",
      "filter"
    );
  }
  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new MutableValidationError(
      `Filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter"
    );
  }
  const filterObj = filter;
  if (!filterObj.namespace) {
    throw new MutableValidationError(
      "Filter must include namespace",
      "MISSING_NAMESPACE",
      "filter.namespace"
    );
  }
  validateNamespace(filterObj.namespace, "filter.namespace");
  validateNamespaceFormat(filterObj.namespace);
  if (filterObj.keyPrefix !== void 0) {
    validateKeyPrefix(filterObj.keyPrefix);
  }
  if (filterObj.userId !== void 0) {
    validateUserId3(filterObj.userId);
  }
  if (filterObj.limit !== void 0) {
    validateLimit3(filterObj.limit);
  }
  if (filterObj.offset !== void 0) {
    validateOffset2(filterObj.offset);
  }
  if (filterObj.updatedAfter !== void 0) {
    validateTimestamp2(filterObj.updatedAfter, "filter.updatedAfter");
  }
  if (filterObj.updatedBefore !== void 0) {
    validateTimestamp2(filterObj.updatedBefore, "filter.updatedBefore");
  }
  if (filterObj.sortBy !== void 0) {
    validateSortBy(filterObj.sortBy);
  }
  if (filterObj.sortOrder !== void 0) {
    validateSortOrder2(filterObj.sortOrder);
  }
}
function validateCountFilter2(filter) {
  if (filter === null || filter === void 0) {
    throw new MutableValidationError(
      "Filter is required",
      "MISSING_FILTER",
      "filter"
    );
  }
  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new MutableValidationError(
      `Filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter"
    );
  }
  const filterObj = filter;
  if (!filterObj.namespace) {
    throw new MutableValidationError(
      "Filter must include namespace",
      "MISSING_NAMESPACE",
      "filter.namespace"
    );
  }
  validateNamespace(filterObj.namespace, "filter.namespace");
  validateNamespaceFormat(filterObj.namespace);
  if (filterObj.keyPrefix !== void 0) {
    validateKeyPrefix(filterObj.keyPrefix);
  }
  if (filterObj.userId !== void 0) {
    validateUserId3(filterObj.userId);
  }
  if (filterObj.updatedAfter !== void 0) {
    validateTimestamp2(filterObj.updatedAfter, "filter.updatedAfter");
  }
  if (filterObj.updatedBefore !== void 0) {
    validateTimestamp2(filterObj.updatedBefore, "filter.updatedBefore");
  }
}
function validatePurgeFilter(filter) {
  if (filter === null || filter === void 0) {
    throw new MutableValidationError(
      "Filter is required",
      "MISSING_FILTER",
      "filter"
    );
  }
  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new MutableValidationError(
      `Filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter"
    );
  }
  const filterObj = filter;
  if (!filterObj.namespace) {
    throw new MutableValidationError(
      "Filter must include namespace",
      "MISSING_NAMESPACE",
      "filter.namespace"
    );
  }
  validateNamespace(filterObj.namespace, "filter.namespace");
  validateNamespaceFormat(filterObj.namespace);
  if (filterObj.keyPrefix !== void 0) {
    validateKeyPrefix(filterObj.keyPrefix);
  }
  if (filterObj.userId !== void 0) {
    validateUserId3(filterObj.userId);
  }
  if (filterObj.updatedBefore !== void 0) {
    validateTimestamp2(filterObj.updatedBefore, "filter.updatedBefore");
  }
}
function validatePurgeNamespaceOptions(options) {
  if (options === null || options === void 0) {
    return;
  }
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new MutableValidationError(
      `Options must be an object, got ${typeof options}`,
      "INVALID_OPTIONS",
      "options"
    );
  }
  const optionsObj = options;
  if (optionsObj.dryRun !== void 0) {
    validateDryRun(optionsObj.dryRun);
  }
}
var VALID_OPERATIONS = ["set", "update", "delete", "increment", "decrement"];
function validateOperationsArray(operations) {
  if (operations === null || operations === void 0) {
    throw new MutableValidationError(
      "Operations array is required",
      "MISSING_OPERATIONS",
      "operations"
    );
  }
  if (!Array.isArray(operations)) {
    throw new MutableValidationError(
      `Operations must be an array, got ${typeof operations}`,
      "INVALID_OPERATIONS_ARRAY",
      "operations"
    );
  }
  if (operations.length === 0) {
    throw new MutableValidationError(
      "Operations array cannot be empty",
      "EMPTY_OPERATIONS_ARRAY",
      "operations"
    );
  }
}
function validateTransactionOperation(operation, index) {
  if (operation === null || operation === void 0 || typeof operation !== "object") {
    throw new MutableValidationError(
      `Operation at index ${index} must be an object`,
      "INVALID_TRANSACTION_OPERATION",
      `operations[${index}]`
    );
  }
  const op = operation;
  if (!op.op) {
    throw new MutableValidationError(
      `Operation at index ${index} is missing required field "op"`,
      "MISSING_OPERATION_FIELD",
      `operations[${index}].op`
    );
  }
  if (typeof op.op !== "string" || !VALID_OPERATIONS.includes(op.op)) {
    throw new MutableValidationError(
      `Operation at index ${index} has invalid "op" value "${op.op}". Must be one of: ${VALID_OPERATIONS.join(", ")}`,
      "INVALID_OPERATION_TYPE",
      `operations[${index}].op`
    );
  }
  if (!op.namespace) {
    throw new MutableValidationError(
      `Operation at index ${index} is missing required field "namespace"`,
      "MISSING_OPERATION_FIELD",
      `operations[${index}].namespace`
    );
  }
  if (!op.key) {
    throw new MutableValidationError(
      `Operation at index ${index} is missing required field "key"`,
      "MISSING_OPERATION_FIELD",
      `operations[${index}].key`
    );
  }
  validateNamespace(op.namespace, `operations[${index}].namespace`);
  validateNamespaceFormat(op.namespace);
  validateKey(op.key, `operations[${index}].key`);
  validateKeyFormat(op.key);
  if (op.op === "set") {
    if (op.value === void 0) {
      throw new MutableValidationError(
        `Operation at index ${index} with op="set" is missing required field "value"`,
        "MISSING_OPERATION_FIELD",
        `operations[${index}].value`
      );
    }
  } else if (op.op === "update") {
    if (op.value === void 0) {
      throw new MutableValidationError(
        `Operation at index ${index} with op="update" is missing required field "value"`,
        "MISSING_OPERATION_FIELD",
        `operations[${index}].value`
      );
    }
  } else if (op.op === "increment" || op.op === "decrement") {
    if (op.amount !== void 0) {
      validateAmount(op.amount, `operations[${index}].amount`);
    }
  }
}
function validateTransactionOperations(operations) {
  for (let i = 0; i < operations.length; i++) {
    validateTransactionOperation(operations[i], i);
  }
}

// src/mutable/index.ts
var MutableAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Set a key to a value (creates or overwrites)
   *
   * @example
   * ```typescript
   * await cortex.mutable.set('inventory', 'widget-qty', 100);
   * ```
   */
  async set(namespace, key, value, userId, metadata, _options) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateValue(value);
    validateValueSize(value);
    if (userId !== void 0) {
      validateUserId3(userId);
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.mutable.set, {
        namespace,
        key,
        value,
        userId,
        tenantId: this.authContext?.tenantId,
        // Inject tenantId for tenant isolation
        metadata
      }),
      "mutable:set"
    );
    if (this.graphAdapter) {
      try {
        await this.graphAdapter.createNode({
          label: "Mutable",
          properties: { namespace, key, value, userId, metadata }
        });
      } catch (error) {
        console.warn("Failed to sync mutable to graph:", error);
      }
    }
    return result;
  }
  /**
   * Get current value for a key
   *
   * @example
   * ```typescript
   * const qty = await cortex.mutable.get('inventory', 'widget-qty');
   * ```
   */
  async get(namespace, key) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    const result = await this.executeWithResilience(
      () => this.client.query(api.mutable.get, {
        namespace,
        key,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "mutable:get"
    );
    return result ? result.value : null;
  }
  /**
   * Get full record (including metadata)
   *
   * @example
   * ```typescript
   * const record = await cortex.mutable.getRecord('inventory', 'widget-qty');
   * console.log(record.updatedAt);
   * ```
   */
  async getRecord(namespace, key) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    const result = await this.executeWithResilience(
      () => this.client.query(api.mutable.get, {
        namespace,
        key,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "mutable:getRecord"
    );
    return result;
  }
  /**
   * Atomic update using updater function
   *
   * @example
   * ```typescript
   * await cortex.mutable.update('inventory', 'widget-qty', (qty) => qty - 10);
   * ```
   */
  async update(namespace, key, updater) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateUpdater(updater);
    const current = await this.get(namespace, key);
    const newValue = updater(current);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.mutable.update, {
          namespace,
          key,
          operation: "custom",
          operand: newValue,
          tenantId: this.authContext?.tenantId
          // Inject tenantId for tenant isolation
        }),
        "mutable:update"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Increment a numeric value
   *
   * @example
   * ```typescript
   * await cortex.mutable.increment('counters', 'total-sales', 1);
   * ```
   */
  async increment(namespace, key, amount = 1) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateAmount(amount, "amount");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.mutable.update, {
        namespace,
        key,
        operation: "increment",
        operand: amount,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "mutable:increment"
    );
    return result;
  }
  /**
   * Decrement a numeric value
   *
   * @example
   * ```typescript
   * await cortex.mutable.decrement('inventory', 'widget-qty', 10);
   * ```
   */
  async decrement(namespace, key, amount = 1) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateAmount(amount, "amount");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.mutable.update, {
        namespace,
        key,
        operation: "decrement",
        operand: amount,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "mutable:decrement"
    );
    return result;
  }
  /**
   * Check if key exists
   *
   * @example
   * ```typescript
   * if (await cortex.mutable.exists('inventory', 'widget-qty')) { ... }
   * ```
   */
  async exists(namespace, key) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    const result = await this.executeWithResilience(
      () => this.client.query(api.mutable.exists, {
        namespace,
        key,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "mutable:exists"
    );
    return result;
  }
  /**
   * List keys in namespace
   *
   * @param filter - Filter options for listing keys
   * @param filter.namespace - Required namespace to list
   * @param filter.keyPrefix - Filter by key prefix
   * @param filter.userId - Filter by user
   * @param filter.limit - Max results (default: 100)
   * @param filter.offset - Pagination offset
   * @param filter.updatedAfter - Filter by updatedAt > timestamp
   * @param filter.updatedBefore - Filter by updatedAt < timestamp
   * @param filter.sortBy - Sort by "key" | "updatedAt" | "accessCount"
   * @param filter.sortOrder - Sort order "asc" | "desc"
   * @returns Array of matching MutableRecord objects
   *
   * @example
   * ```typescript
   * const items = await cortex.mutable.list({
   *   namespace: 'inventory',
   *   keyPrefix: 'widget-',
   *   sortBy: 'updatedAt',
   *   sortOrder: 'desc',
   *   limit: 50,
   * });
   * ```
   */
  async list(filter) {
    validateListFilter2(filter);
    const result = await this.executeWithResilience(
      () => this.client.query(api.mutable.list, {
        namespace: filter.namespace,
        keyPrefix: filter.keyPrefix,
        userId: filter.userId,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter.tenantId),
        // Support explicit or auth context
        limit: filter.limit,
        offset: filter.offset,
        updatedAfter: filter.updatedAfter,
        updatedBefore: filter.updatedBefore,
        sortBy: filter.sortBy,
        sortOrder: filter.sortOrder
      }),
      "mutable:list"
    );
    return result;
  }
  /**
   * Count keys in namespace
   *
   * @param filter - Filter options for counting keys
   * @param filter.namespace - Required namespace to count
   * @param filter.userId - Filter by user
   * @param filter.keyPrefix - Filter by key prefix
   * @param filter.updatedAfter - Filter by updatedAt > timestamp
   * @param filter.updatedBefore - Filter by updatedAt < timestamp
   * @returns Count of matching keys
   *
   * @example
   * ```typescript
   * const count = await cortex.mutable.count({
   *   namespace: 'inventory',
   *   updatedAfter: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
   * });
   * ```
   */
  async count(filter) {
    validateCountFilter2(filter);
    const result = await this.executeWithResilience(
      () => this.client.query(api.mutable.count, {
        namespace: filter.namespace,
        userId: filter.userId,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter.tenantId),
        // Support explicit or auth context
        keyPrefix: filter.keyPrefix,
        updatedAfter: filter.updatedAfter,
        updatedBefore: filter.updatedBefore
      }),
      "mutable:count"
    );
    return result;
  }
  /**
   * Delete a key
   *
   * @example
   * ```typescript
   * await cortex.mutable.delete('inventory', 'discontinued-item');
   * ```
   */
  async delete(namespace, key, _options) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.mutable.deleteKey, {
          namespace,
          key,
          tenantId: this.authContext?.tenantId
          // Inject tenantId for tenant isolation
        }),
        "mutable:delete"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        await deleteMutableFromGraph(namespace, key, this.graphAdapter);
      } catch (error) {
        console.warn("Failed to delete mutable from graph:", error);
      }
    }
    return result;
  }
  /**
   * Purge a key (alias for delete - for API consistency)
   *
   * @example
   * ```typescript
   * await cortex.mutable.purge('inventory', 'discontinued-item');
   * ```
   */
  async purge(namespace, key) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    return await this.delete(namespace, key);
  }
  /**
   * Purge all keys in a namespace
   *
   * @param namespace - Namespace to purge
   * @param options - Optional settings
   * @param options.dryRun - If true, returns what would be deleted without deleting
   * @param options.tenantId - Override tenant ID (defaults to authContext.tenantId)
   * @returns Result with deleted count, namespace, and optionally keys (in dryRun mode)
   *
   * @example
   * ```typescript
   * // Preview what would be deleted
   * const preview = await cortex.mutable.purgeNamespace('temp-cache', { dryRun: true });
   * console.log(`Would delete ${preview.deleted} keys`);
   *
   * // Actually delete
   * const result = await cortex.mutable.purgeNamespace('temp-cache');
   * console.log(`Deleted ${result.deleted} keys`);
   * ```
   */
  async purgeNamespace(namespace, options) {
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validatePurgeNamespaceOptions(options);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.mutable.purgeNamespace, {
        namespace,
        dryRun: options?.dryRun,
        tenantId: resolveTenantId(this.authContext?.tenantId, options?.tenantId)
        // Support explicit or auth context
      }),
      "mutable:purgeNamespace"
    );
    return result;
  }
  /**
   * Execute multiple operations atomically
   *
   * @example
   * ```typescript
   * await cortex.mutable.transaction([
   *   { op: 'increment', namespace: 'counters', key: 'sales', amount: 1 },
   *   { op: 'decrement', namespace: 'inventory', key: 'widget-qty', amount: 1 },
   *   { op: 'set', namespace: 'state', key: 'last-sale', value: Date.now() },
   * ]);
   * ```
   */
  async transaction(operations) {
    validateOperationsArray(operations);
    validateTransactionOperations(operations);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.mutable.transaction, {
          operations,
          tenantId: this.authContext?.tenantId
          // Inject tenantId for tenant isolation
        }),
        "mutable:transaction"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Bulk delete keys matching filters
   *
   * @param filter - Filter options for deleting keys
   * @param filter.namespace - Required namespace to purge from
   * @param filter.keyPrefix - Filter by key prefix
   * @param filter.userId - Filter by user
   * @param filter.updatedBefore - Delete keys updated before this timestamp
   * @param filter.tenantId - Override tenant ID (defaults to authContext.tenantId)
   * @returns Result with deleted count, namespace, and deleted keys
   *
   * @example
   * ```typescript
   * // Delete keys with prefix
   * await cortex.mutable.purgeMany({
   *   namespace: 'cache',
   *   keyPrefix: 'temp-',
   * });
   *
   * // Delete old keys
   * await cortex.mutable.purgeMany({
   *   namespace: 'cache',
   *   updatedBefore: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
   * });
   *
   * // Delete by user (GDPR compliance)
   * await cortex.mutable.purgeMany({
   *   namespace: 'sessions',
   *   userId: 'user-123',
   * });
   * ```
   */
  async purgeMany(filter) {
    validatePurgeFilter(filter);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.mutable.purgeMany, {
        namespace: filter.namespace,
        keyPrefix: filter.keyPrefix,
        userId: filter.userId,
        updatedBefore: filter.updatedBefore,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter.tenantId)
        // Support explicit or auth context
      }),
      "mutable:purgeMany"
    );
    return result;
  }
};

// src/vector/index.ts
init_api();

// src/vector/validators.ts
var VectorValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "VectorValidationError";
  }
};
var VALID_CONTENT_TYPES = ["raw", "summarized", "fact"];
var VALID_SOURCE_TYPES = ["conversation", "system", "tool", "a2a"];
var VALID_EXPORT_FORMATS = ["json", "csv"];
function validateMemorySpaceId(memorySpaceId) {
  if (!memorySpaceId || typeof memorySpaceId !== "string" || memorySpaceId.trim().length === 0) {
    throw new VectorValidationError(
      "memorySpaceId is required and cannot be empty",
      "INVALID_MEMORY_SPACE_ID",
      "memorySpaceId"
    );
  }
}
function validateMemoryId(memoryId) {
  if (!memoryId || typeof memoryId !== "string" || memoryId.trim().length === 0) {
    throw new VectorValidationError(
      "memoryId is required and cannot be empty",
      "INVALID_MEMORY_ID",
      "memoryId"
    );
  }
}
function validateContentType(contentType, fieldName = "contentType") {
  if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
    throw new VectorValidationError(
      `Invalid ${fieldName} "${contentType}". Valid values: ${VALID_CONTENT_TYPES.join(", ")}`,
      "INVALID_CONTENT_TYPE",
      fieldName
    );
  }
}
function validateSourceType(sourceType, fieldName = "sourceType") {
  if (!sourceType || !VALID_SOURCE_TYPES.includes(sourceType)) {
    throw new VectorValidationError(
      `Invalid ${fieldName} "${sourceType}". Valid values: ${VALID_SOURCE_TYPES.join(", ")}`,
      "INVALID_SOURCE_TYPE",
      fieldName
    );
  }
}
function validateExportFormat2(format) {
  if (!format || !VALID_EXPORT_FORMATS.includes(format)) {
    throw new VectorValidationError(
      `Invalid format "${format}". Valid values: ${VALID_EXPORT_FORMATS.join(", ")}`,
      "INVALID_EXPORT_FORMAT",
      "format"
    );
  }
}
function validateImportance(importance, fieldName = "importance") {
  if (typeof importance !== "number" || isNaN(importance)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_IMPORTANCE_RANGE",
      fieldName
    );
  }
  if (importance < 0 || importance > 100) {
    throw new VectorValidationError(
      `${fieldName} must be between 0 and 100, got ${importance}`,
      "INVALID_IMPORTANCE_RANGE",
      fieldName
    );
  }
}
function validateMinScore(minScore, fieldName = "minScore") {
  if (typeof minScore !== "number" || isNaN(minScore)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_MIN_SCORE_RANGE",
      fieldName
    );
  }
  if (minScore < 0 || minScore > 1) {
    throw new VectorValidationError(
      `${fieldName} must be between 0 and 1, got ${minScore}`,
      "INVALID_MIN_SCORE_RANGE",
      fieldName
    );
  }
}
function validateLimit4(limit, fieldName = "limit") {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_LIMIT",
      fieldName
    );
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new VectorValidationError(
      `${fieldName} must be a positive integer (>= 1), got ${limit}`,
      "INVALID_LIMIT",
      fieldName
    );
  }
}
function validateVersion2(version, fieldName = "version") {
  if (typeof version !== "number" || isNaN(version)) {
    throw new VectorValidationError(
      `${fieldName} must be a number`,
      "INVALID_VERSION",
      fieldName
    );
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new VectorValidationError(
      `${fieldName} must be a positive integer (>= 1), got ${version}`,
      "INVALID_VERSION",
      fieldName
    );
  }
}
function validateTimestamp3(timestamp, fieldName = "timestamp") {
  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) {
      throw new VectorValidationError(
        `${fieldName} must be a valid Date`,
        "INVALID_TIMESTAMP",
        fieldName
      );
    }
    return;
  }
  if (typeof timestamp !== "number" || isNaN(timestamp)) {
    throw new VectorValidationError(
      `${fieldName} must be a number or Date`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
  if (timestamp < 0) {
    throw new VectorValidationError(
      `${fieldName} must be a non-negative number, got ${timestamp}`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
}
function validateTags(tags, fieldName = "tags") {
  if (!Array.isArray(tags)) {
    throw new VectorValidationError(
      `${fieldName} must be an array`,
      "INVALID_TAGS",
      fieldName
    );
  }
  for (let i = 0; i < tags.length; i++) {
    if (typeof tags[i] !== "string") {
      throw new VectorValidationError(
        `${fieldName}[${i}] must be a string, got ${typeof tags[i]}`,
        "INVALID_TAGS",
        fieldName
      );
    }
  }
}
function validateEmbedding(embedding, fieldName = "embedding") {
  if (embedding === void 0 || embedding === null) {
    return;
  }
  if (!Array.isArray(embedding)) {
    throw new VectorValidationError(
      `${fieldName} must be an array`,
      "INVALID_EMBEDDING",
      fieldName
    );
  }
  if (embedding.length === 0) {
    return;
  }
  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== "number" || isNaN(embedding[i])) {
      throw new VectorValidationError(
        `${fieldName}[${i}] must be a number, got ${typeof embedding[i]}`,
        "INVALID_EMBEDDING",
        fieldName
      );
    }
  }
}
function validateStoreInput(input) {
  if (!input) {
    throw new VectorValidationError(
      "input is required",
      "MISSING_REQUIRED_FIELD",
      "input"
    );
  }
  if (!input.content || typeof input.content !== "string") {
    throw new VectorValidationError(
      "content is required and must be a string",
      "MISSING_REQUIRED_FIELD",
      "content"
    );
  }
  if (input.content.trim().length === 0) {
    throw new VectorValidationError(
      "content cannot be empty",
      "MISSING_REQUIRED_FIELD",
      "content"
    );
  }
  if (!input.contentType) {
    throw new VectorValidationError(
      "contentType is required",
      "MISSING_REQUIRED_FIELD",
      "contentType"
    );
  }
  validateContentType(input.contentType, "contentType");
  if (!input.source) {
    throw new VectorValidationError(
      "source is required",
      "MISSING_REQUIRED_FIELD",
      "source"
    );
  }
  if (!input.source.type) {
    throw new VectorValidationError(
      "source.type is required",
      "MISSING_REQUIRED_FIELD",
      "source.type"
    );
  }
  validateSourceType(input.source.type, "source.type");
  if (!input.metadata) {
    throw new VectorValidationError(
      "metadata is required",
      "MISSING_REQUIRED_FIELD",
      "metadata"
    );
  }
  if (input.metadata.importance === void 0 || input.metadata.importance === null) {
    throw new VectorValidationError(
      "metadata.importance is required",
      "MISSING_REQUIRED_FIELD",
      "metadata.importance"
    );
  }
  validateImportance(input.metadata.importance, "metadata.importance");
  if (!input.metadata.tags) {
    throw new VectorValidationError(
      "metadata.tags is required",
      "MISSING_REQUIRED_FIELD",
      "metadata.tags"
    );
  }
  validateTags(input.metadata.tags, "metadata.tags");
  if (input.embedding !== void 0) {
    validateEmbedding(input.embedding, "embedding");
  }
}
function validateSearchOptions(options) {
  if (!options) {
    return;
  }
  if (options.embedding !== void 0) {
    validateEmbedding(options.embedding, "embedding");
  }
  if (options.tags !== void 0) {
    validateTags(options.tags, "tags");
  }
  if (options.sourceType !== void 0) {
    validateSourceType(options.sourceType, "sourceType");
  }
  if (options.minImportance !== void 0) {
    validateImportance(options.minImportance, "minImportance");
  }
  if (options.minScore !== void 0) {
    validateMinScore(options.minScore, "minScore");
  }
  if (options.limit !== void 0) {
    validateLimit4(options.limit, "limit");
  }
  if (options.queryCategory !== void 0) {
    if (typeof options.queryCategory !== "string") {
      throw new VectorValidationError(
        "queryCategory must be a string",
        "INVALID_QUERY_CATEGORY",
        "queryCategory"
      );
    }
  }
}
function validateListFilter3(filter) {
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter"
    );
  }
  validateMemorySpaceId(filter.memorySpaceId);
  if (filter.sourceType !== void 0) {
    validateSourceType(filter.sourceType, "sourceType");
  }
  if (filter.limit !== void 0) {
    validateLimit4(filter.limit, "limit");
  }
}
function validateCountFilter3(filter) {
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter"
    );
  }
  validateMemorySpaceId(filter.memorySpaceId);
  if (filter.sourceType !== void 0) {
    validateSourceType(filter.sourceType, "sourceType");
  }
}
function validateUpdateInput(updates) {
  if (!updates) {
    throw new VectorValidationError(
      "updates is required",
      "MISSING_REQUIRED_FIELD",
      "updates"
    );
  }
  if (updates.importance !== void 0) {
    validateImportance(updates.importance, "importance");
  }
  if (updates.tags !== void 0) {
    validateTags(updates.tags, "tags");
  }
  if (updates.embedding !== void 0) {
    validateEmbedding(updates.embedding, "embedding");
  }
}
function validateExportOptions(options) {
  if (!options) {
    throw new VectorValidationError(
      "options is required",
      "MISSING_REQUIRED_FIELD",
      "options"
    );
  }
  validateMemorySpaceId(options.memorySpaceId);
  validateExportFormat2(options.format);
}
function validateDeleteManyFilter(filter) {
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter"
    );
  }
  validateMemorySpaceId(filter.memorySpaceId);
  if (filter.sourceType !== void 0) {
    validateSourceType(filter.sourceType, "sourceType");
  }
}
function validateUpdateManyInputs(filter, updates) {
  if (!filter) {
    throw new VectorValidationError(
      "filter is required",
      "MISSING_REQUIRED_FIELD",
      "filter"
    );
  }
  validateMemorySpaceId(filter.memorySpaceId);
  if (filter.sourceType !== void 0) {
    validateSourceType(filter.sourceType, "sourceType");
  }
  if (!updates) {
    throw new VectorValidationError(
      "updates is required",
      "MISSING_REQUIRED_FIELD",
      "updates"
    );
  }
  if (updates.importance !== void 0) {
    validateImportance(updates.importance, "importance");
  }
  if (updates.tags !== void 0) {
    validateTags(updates.tags, "tags");
  }
}

// src/vector/index.ts
var VectorAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Store a vector memory
   *
   * @param memorySpaceId - The memory space to store the memory in
   * @param input - Memory input data including content, embedding, and metadata
   * @param options - Optional storage options (e.g., syncToGraph)
   * @returns The stored memory entry
   *
   * @example
   * ```typescript
   * const memory = await cortex.vector.store('agent-1', {
   *   content: 'User prefers dark mode',
   *   contentType: 'raw',
   *   embedding: await embed('User prefers dark mode'),
   *   source: { type: 'conversation', userId: 'user-123' },
   *   metadata: { importance: 70, tags: ['preferences'] },
   *   // For bullet-proof retrieval (v0.21.0+)
   *   enrichedContent: 'User prefers dark mode for UI',
   *   factCategory: 'ui_preference',
   * });
   *
   * // With graph sync
   * const memory = await cortex.vector.store('agent-1', data, {
   *   syncToGraph: true
   * });
   * ```
   */
  async store(memorySpaceId, input, _options) {
    validateMemorySpaceId(memorySpaceId);
    validateStoreInput(input);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memories.store, {
        memorySpaceId,
        tenantId: resolveTenantId(this.authContext?.tenantId, input.tenantId),
        participantId: input.participantId,
        // NEW: Hive Mode
        content: input.content,
        contentType: input.contentType,
        embedding: input.embedding,
        sourceType: input.source.type,
        sourceUserId: input.source.userId,
        sourceUserName: input.source.userName,
        userId: input.userId,
        agentId: input.agentId,
        // NEW: Agent-owned memories support
        messageRole: input.messageRole,
        // NEW: For semantic search weighting
        enrichedContent: input.enrichedContent,
        // Enrichment for bullet-proof retrieval
        factCategory: input.factCategory,
        // Category for filtering
        conversationRef: input.conversationRef,
        immutableRef: input.immutableRef,
        mutableRef: input.mutableRef,
        importance: input.metadata.importance,
        tags: input.metadata.tags
      }),
      "vector:store"
    );
    if (this.graphAdapter) {
      try {
        const nodeId = await syncMemoryToGraph(
          result,
          this.graphAdapter
        );
        await syncMemoryRelationships(
          result,
          nodeId,
          this.graphAdapter
        );
      } catch (error) {
        console.warn("Failed to sync memory to graph:", error);
      }
    }
    return result;
  }
  /**
   * Get memory by ID
   *
   * @example
   * ```typescript
   * const memory = await cortex.vector.get('agent-1', 'mem-abc123');
   * ```
   */
  async get(memorySpaceId, memoryId) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.memories.get, {
        memorySpaceId,
        memoryId,
        tenantId: this.authContext?.tenantId
      }),
      "vector:get"
    );
    return result;
  }
  /**
   * Search memories (semantic with embeddings or keyword without)
   *
   * @param memorySpaceId - The memory space to search in
   * @param query - Text query for keyword search
   * @param options - Search options including embedding for semantic search
   * @returns Array of matching memory entries
   *
   * @example
   * ```typescript
   * const results = await cortex.vector.search('agent-1', 'user preferences', {
   *   embedding: await embed('user preferences'),
   *   limit: 10,
   *   // For bullet-proof retrieval (v0.21.0+)
   *   queryCategory: 'ui_preference', // +30% score boost for matching category
   * });
   * ```
   */
  async search(memorySpaceId, query, options) {
    validateMemorySpaceId(memorySpaceId);
    validateSearchOptions(options);
    const result = await this.executeWithResilience(
      () => this.client.action(api.memories.search, {
        memorySpaceId,
        query,
        embedding: options?.embedding,
        userId: options?.userId,
        tags: options?.tags,
        sourceType: options?.sourceType,
        minImportance: options?.minImportance,
        minScore: options?.minScore,
        queryCategory: options?.queryCategory,
        // Category boost for bullet-proof retrieval
        limit: options?.limit
      }),
      "vector:search"
    );
    return result;
  }
  /**
   * Delete a memory
   *
   * @example
   * ```typescript
   * await cortex.vector.delete('agent-1', 'mem-abc123');
   *
   * // With graph sync and orphan cleanup
   * await cortex.vector.delete('agent-1', 'mem-abc123', {
   *   syncToGraph: true
   * });
   * ```
   */
  async delete(memorySpaceId, memoryId, _options) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.memories.deleteMemory, {
          memorySpaceId,
          memoryId
        }),
        "vector:delete"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        await deleteMemoryFromGraph(memoryId, this.graphAdapter, true);
      } catch (error) {
        console.warn("Failed to delete memory from graph:", error);
      }
    }
    return result;
  }
  /**
   * List memories with filters
   *
   * @example
   * ```typescript
   * const memories = await cortex.vector.list({
   *   agentId: 'agent-1',
   *   userId: 'user-123',
   *   limit: 50,
   * });
   * ```
   */
  async list(filter) {
    validateListFilter3(filter);
    const result = await this.executeWithResilience(
      () => this.client.query(api.memories.list, {
        memorySpaceId: filter.memorySpaceId,
        userId: filter.userId,
        sourceType: filter.sourceType,
        limit: filter.limit
      }),
      "vector:list"
    );
    return result;
  }
  /**
   * Count memories
   *
   * @example
   * ```typescript
   * const count = await cortex.vector.count({
   *   agentId: 'agent-1',
   *   userId: 'user-123',
   * });
   * ```
   */
  async count(filter) {
    validateCountFilter3(filter);
    const result = await this.executeWithResilience(
      () => this.client.query(api.memories.count, {
        memorySpaceId: filter.memorySpaceId,
        userId: filter.userId,
        sourceType: filter.sourceType
      }),
      "vector:count"
    );
    return result;
  }
  /**
   * Update a memory (creates new version)
   *
   * @example
   * ```typescript
   * await cortex.vector.update('agent-1', 'mem-123', {
   *   content: 'Updated content',
   *   importance: 90,
   * });
   * ```
   */
  async update(memorySpaceId, memoryId, updates) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    validateUpdateInput(updates);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memories.update, {
        memorySpaceId,
        memoryId,
        content: updates.content,
        embedding: updates.embedding,
        importance: updates.importance,
        tags: updates.tags
      }),
      "vector:update"
    );
    return result;
  }
  /**
   * Get specific version of a memory
   *
   * @example
   * ```typescript
   * const v1 = await cortex.vector.getVersion('agent-1', 'mem-123', 1);
   * ```
   */
  async getVersion(memorySpaceId, memoryId, version) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    validateVersion2(version);
    const result = await this.executeWithResilience(
      () => this.client.query(api.memories.getVersion, {
        memorySpaceId,
        memoryId,
        version
      }),
      "vector:getVersion"
    );
    return result;
  }
  /**
   * Get version history for a memory
   *
   * @example
   * ```typescript
   * const history = await cortex.vector.getHistory('agent-1', 'mem-123');
   * ```
   */
  async getHistory(memorySpaceId, memoryId) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.memories.getHistory, {
        memorySpaceId,
        memoryId
      }),
      "vector:getHistory"
    );
    return result;
  }
  /**
   * Delete many memories matching filters
   *
   * @example
   * ```typescript
   * await cortex.vector.deleteMany({
   *   agentId: 'agent-1',
   *   sourceType: 'system',
   * });
   * ```
   */
  async deleteMany(filter) {
    validateDeleteManyFilter(filter);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memories.deleteMany, {
        memorySpaceId: filter.memorySpaceId,
        userId: filter.userId,
        sourceType: filter.sourceType
      }),
      "vector:deleteMany"
    );
    return result;
  }
  /**
   * Export memories to JSON or CSV
   *
   * @example
   * ```typescript
   * const exported = await cortex.vector.export({
   *   agentId: 'agent-1',
   *   format: 'json',
   * });
   * ```
   */
  async export(options) {
    validateExportOptions(options);
    const result = await this.executeWithResilience(
      () => this.client.query(api.memories.exportMemories, {
        memorySpaceId: options.memorySpaceId,
        userId: options.userId,
        format: options.format,
        includeEmbeddings: options.includeEmbeddings
      }),
      "vector:export"
    );
    return result;
  }
  /**
   * Update many memories matching filters
   *
   * @example
   * ```typescript
   * await cortex.vector.updateMany({
   *   agentId: 'agent-1',
   *   sourceType: 'system',
   * }, {
   *   importance: 20,
   * });
   * ```
   */
  async updateMany(filter, updates) {
    validateUpdateManyInputs(filter, updates);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memories.updateMany, {
        memorySpaceId: filter.memorySpaceId,
        userId: filter.userId,
        sourceType: filter.sourceType,
        importance: updates.importance,
        tags: updates.tags
      }),
      "vector:updateMany"
    );
    return result;
  }
  /**
   * Archive a memory (soft delete)
   *
   * @example
   * ```typescript
   * await cortex.vector.archive('agent-1', 'mem-123');
   * ```
   */
  async archive(memorySpaceId, memoryId) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memories.archive, {
        memorySpaceId,
        memoryId
      }),
      "vector:archive"
    );
    return result;
  }
  /**
   * Restore a memory from archive
   *
   * @example
   * ```typescript
   * const result = await cortex.vector.restoreFromArchive('agent-1', 'mem-123');
   * console.log(result.restored); // true
   * console.log(result.memory); // MemoryEntry
   * ```
   */
  async restoreFromArchive(memorySpaceId, memoryId) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memories.restoreFromArchive, {
        memorySpaceId,
        memoryId
      }),
      "vector:restoreFromArchive"
    );
    return result;
  }
  /**
   * Get version at specific timestamp
   *
   * @example
   * ```typescript
   * const memory = await cortex.vector.getAtTimestamp('agent-1', 'mem-123', Date.parse('2025-01-01'));
   * ```
   */
  async getAtTimestamp(memorySpaceId, memoryId, timestamp) {
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    validateTimestamp3(timestamp);
    const ts = typeof timestamp === "number" ? timestamp : timestamp.getTime();
    const result = await this.executeWithResilience(
      () => this.client.query(api.memories.getAtTimestamp, {
        memorySpaceId,
        memoryId,
        timestamp: ts
      }),
      "vector:getAtTimestamp"
    );
    return result;
  }
};

// src/memory/index.ts
init_api();

// src/facts/index.ts
init_api();

// src/facts/validators.ts
var FactsValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "FactsValidationError";
  }
};
var VALID_FACT_TYPES = [
  "preference",
  "identity",
  "knowledge",
  "relationship",
  "event",
  "observation",
  "custom"
];
var VALID_SOURCE_TYPES2 = [
  "conversation",
  "system",
  "tool",
  "manual",
  "a2a"
];
var VALID_EXPORT_FORMATS2 = ["json", "jsonld", "csv"];
var VALID_SORT_BY_FIELDS = [
  "createdAt",
  "updatedAt",
  "confidence",
  "version"
];
var VALID_TAG_MATCH = ["any", "all"];
var VALID_SORT_ORDER2 = ["asc", "desc"];
function validateRequiredString2(value, fieldName) {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new FactsValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateRequiredNumber(value, fieldName) {
  if (value === void 0 || value === null || typeof value !== "number") {
    throw new FactsValidationError(
      `${fieldName} is required and must be a number`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (isNaN(value)) {
    throw new FactsValidationError(
      `${fieldName} must be a valid number, got NaN`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateFactIdFormat(factId, fieldName = "factId") {
  if (!factId || typeof factId !== "string") {
    throw new FactsValidationError(
      `${fieldName} must be a non-empty string`,
      "INVALID_FACT_ID_FORMAT",
      fieldName
    );
  }
  if (!factId.startsWith("fact-")) {
    throw new FactsValidationError(
      `${fieldName} must start with "fact-", got "${factId}"`,
      "INVALID_FACT_ID_FORMAT",
      fieldName
    );
  }
}
function validateMemorySpaceId2(memorySpaceId) {
  validateRequiredString2(memorySpaceId, "memorySpaceId");
}
function validateStringArray(arr, fieldName, allowEmpty = true) {
  if (!Array.isArray(arr)) {
    throw new FactsValidationError(
      `${fieldName} must be an array`,
      "INVALID_ARRAY",
      fieldName
    );
  }
  if (!allowEmpty && arr.length === 0) {
    throw new FactsValidationError(
      `${fieldName} must contain at least one element`,
      "EMPTY_ARRAY",
      fieldName
    );
  }
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== "string") {
      throw new FactsValidationError(
        `${fieldName} must contain only strings, found ${typeof arr[i]} at index ${i}`,
        "INVALID_ARRAY",
        fieldName
      );
    }
  }
}
function validateConfidence(confidence, fieldName = "confidence") {
  validateRequiredNumber(confidence, fieldName);
  if (confidence < 0 || confidence > 100) {
    throw new FactsValidationError(
      `${fieldName} must be between 0 and 100, got ${confidence}`,
      "INVALID_CONFIDENCE",
      fieldName
    );
  }
}
function validateNonNegativeInteger(value, fieldName) {
  if (value === void 0) {
    return;
  }
  if (typeof value !== "number" || isNaN(value)) {
    throw new FactsValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_ARRAY",
      fieldName
    );
  }
  if (value < 0) {
    throw new FactsValidationError(
      `${fieldName} must be non-negative, got ${value}`,
      "INVALID_ARRAY",
      fieldName
    );
  }
  if (!Number.isInteger(value)) {
    throw new FactsValidationError(
      `${fieldName} must be an integer, got ${value}`,
      "INVALID_ARRAY",
      fieldName
    );
  }
}
function validateFactType(factType) {
  if (!VALID_FACT_TYPES.includes(factType)) {
    throw new FactsValidationError(
      `Invalid factType "${factType}". Valid types: ${VALID_FACT_TYPES.join(", ")}`,
      "INVALID_FACT_TYPE",
      "factType"
    );
  }
}
function validateSourceType2(sourceType) {
  if (!VALID_SOURCE_TYPES2.includes(sourceType)) {
    throw new FactsValidationError(
      `Invalid sourceType "${sourceType}". Valid types: ${VALID_SOURCE_TYPES2.join(", ")}`,
      "INVALID_SOURCE_TYPE",
      "sourceType"
    );
  }
}
function validateExportFormat3(format) {
  if (!VALID_EXPORT_FORMATS2.includes(format)) {
    throw new FactsValidationError(
      `Invalid format "${format}". Valid formats: ${VALID_EXPORT_FORMATS2.join(", ")}`,
      "INVALID_EXPORT_FORMAT",
      "format"
    );
  }
}
function validateSortBy2(sortBy) {
  if (!VALID_SORT_BY_FIELDS.includes(sortBy)) {
    throw new FactsValidationError(
      `Invalid sortBy "${sortBy}". Valid fields: ${VALID_SORT_BY_FIELDS.join(", ")}`,
      "INVALID_SORT_BY",
      "sortBy"
    );
  }
}
function validateTagMatch(tagMatch) {
  if (!VALID_TAG_MATCH.includes(tagMatch)) {
    throw new FactsValidationError(
      `Invalid tagMatch "${tagMatch}". Valid values: ${VALID_TAG_MATCH.join(", ")}`,
      "INVALID_TAG_MATCH",
      "tagMatch"
    );
  }
}
function validateSortOrder3(sortOrder) {
  if (!VALID_SORT_ORDER2.includes(sortOrder)) {
    throw new FactsValidationError(
      `Invalid sortOrder "${sortOrder}". Valid values: ${VALID_SORT_ORDER2.join(", ")}`,
      "INVALID_SORT_ORDER",
      "sortOrder"
    );
  }
}
function validateDate(date, fieldName) {
  if (date === void 0) {
    return;
  }
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new FactsValidationError(
      `${fieldName} must be a valid Date object`,
      "INVALID_DATE_RANGE",
      fieldName
    );
  }
}
function validateDateRange2(start, end, startFieldName, endFieldName) {
  if (!start || !end) {
    return;
  }
  validateDate(start, startFieldName);
  validateDate(end, endFieldName);
  if (start.getTime() >= end.getTime()) {
    throw new FactsValidationError(
      `${startFieldName} must be before ${endFieldName}`,
      "INVALID_DATE_RANGE"
    );
  }
}
function validateValidityPeriod(validFrom, validUntil) {
  if (validFrom === void 0 || validUntil === void 0) {
    return;
  }
  if (typeof validFrom !== "number" || typeof validUntil !== "number") {
    throw new FactsValidationError(
      "validFrom and validUntil must be numbers (timestamps)",
      "INVALID_VALIDITY_PERIOD"
    );
  }
  if (isNaN(validFrom) || isNaN(validUntil)) {
    throw new FactsValidationError(
      "validFrom and validUntil must be valid timestamps",
      "INVALID_VALIDITY_PERIOD"
    );
  }
  if (validFrom >= validUntil) {
    throw new FactsValidationError(
      "validFrom must be before validUntil",
      "INVALID_VALIDITY_PERIOD"
    );
  }
}
function validateUpdateHasFields(updates) {
  const hasFields = updates.fact !== void 0 || updates.confidence !== void 0 || updates.tags !== void 0 || updates.validUntil !== void 0 || updates.metadata !== void 0 || // Enrichment fields
  updates.category !== void 0 || updates.searchAliases !== void 0 || updates.semanticContext !== void 0 || updates.entities !== void 0 || updates.relations !== void 0;
  if (!hasFields) {
    throw new FactsValidationError(
      "Update must include at least one field (fact, confidence, tags, validUntil, metadata, or enrichment fields)",
      "INVALID_UPDATE"
    );
  }
}
function validateConsolidation(factIds, keepFactId) {
  if (factIds.length < 2) {
    throw new FactsValidationError(
      `consolidation requires at least 2 facts, got ${factIds.length}`,
      "INVALID_CONSOLIDATION",
      "factIds"
    );
  }
  if (!factIds.includes(keepFactId)) {
    throw new FactsValidationError(
      `keepFactId "${keepFactId}" must be in factIds array`,
      "INVALID_CONSOLIDATION",
      "keepFactId"
    );
  }
  const uniqueIds = new Set(factIds);
  if (uniqueIds.size !== factIds.length) {
    throw new FactsValidationError(
      "factIds array must not contain duplicates",
      "INVALID_CONSOLIDATION",
      "factIds"
    );
  }
}
function validateSourceRef(sourceRef) {
  if (sourceRef === null || typeof sourceRef !== "object") {
    throw new FactsValidationError(
      "sourceRef must be an object",
      "INVALID_METADATA",
      "sourceRef"
    );
  }
  const ref = sourceRef;
  if (ref.conversationId !== void 0 && typeof ref.conversationId !== "string") {
    throw new FactsValidationError(
      "sourceRef.conversationId must be a string",
      "INVALID_METADATA",
      "sourceRef.conversationId"
    );
  }
  if (ref.messageIds !== void 0) {
    if (!Array.isArray(ref.messageIds)) {
      throw new FactsValidationError(
        "sourceRef.messageIds must be an array",
        "INVALID_METADATA",
        "sourceRef.messageIds"
      );
    }
    for (const id of ref.messageIds) {
      if (typeof id !== "string") {
        throw new FactsValidationError(
          "sourceRef.messageIds must contain only strings",
          "INVALID_METADATA",
          "sourceRef.messageIds"
        );
      }
    }
  }
  if (ref.memoryId !== void 0 && typeof ref.memoryId !== "string") {
    throw new FactsValidationError(
      "sourceRef.memoryId must be a string",
      "INVALID_METADATA",
      "sourceRef.memoryId"
    );
  }
}
function validateMetadata3(metadata) {
  if (metadata === null || typeof metadata !== "object") {
    throw new FactsValidationError(
      "metadata must be an object",
      "INVALID_METADATA",
      "metadata"
    );
  }
  if (Array.isArray(metadata)) {
    throw new FactsValidationError(
      "metadata must be an object, not an array",
      "INVALID_METADATA",
      "metadata"
    );
  }
}

// src/facts/index.ts
init_deduplication2();

// src/domain/slots.ts
var DEFAULT_PREDICATE_CLASSES = {
  // Color preferences
  favorite_color: [
    "favorite color",
    "favorite colour",
    "preferred color",
    "preferred colour",
    "likes color",
    "likes the color",
    "prefers color",
    "color preference",
    "colour preference"
  ],
  // Location/residence
  location: [
    "lives in",
    "lives at",
    "resides in",
    "resides at",
    "located in",
    "based in",
    "home is",
    "hometown is",
    "current location",
    "current city",
    "current country",
    "moved to"
  ],
  // Employment
  employment: [
    "works at",
    "works for",
    "employed by",
    "employed at",
    "job at",
    "job is",
    "occupation is",
    "profession is",
    "career is",
    "employer is",
    "company is",
    "workplace is"
  ],
  // Age
  age: [
    "age is",
    "is years old",
    "years old",
    "born in",
    "birthday is",
    "birth date",
    "date of birth"
  ],
  // Name/identity
  name: [
    "name is",
    "called",
    "named",
    "goes by",
    "known as",
    "nickname is",
    "full name is",
    "first name is",
    "last name is"
  ],
  // Relationship status
  relationship_status: [
    "married to",
    "engaged to",
    "dating",
    "in a relationship with",
    "single",
    "divorced",
    "widowed",
    "partner is",
    "spouse is",
    "relationship status"
  ],
  // Education
  education: [
    "studied at",
    "graduated from",
    "attends",
    "attended",
    "school is",
    "university is",
    "college is",
    "degree is",
    "major is",
    "education is"
  ],
  // Language preferences
  language: [
    "speaks",
    "native language",
    "primary language",
    "preferred language",
    "language is",
    "fluent in"
  ],
  // Contact preferences
  contact_preference: [
    "prefers to be contacted",
    "contact preference",
    "preferred contact",
    "best way to reach",
    "communication preference"
  ],
  // Food preferences
  food_preference: [
    "favorite food",
    "favorite cuisine",
    "dietary restriction",
    "diet is",
    "vegetarian",
    "vegan",
    "allergic to",
    "food allergy",
    "likes to eat",
    "favorite meal"
  ],
  // Music preferences
  music_preference: [
    "favorite music",
    "favorite genre",
    "favorite artist",
    "favorite band",
    "favorite song",
    "listens to",
    "music taste"
  ],
  // Hobby/interest
  hobby: [
    "hobby is",
    "hobbies are",
    "enjoys",
    "likes doing",
    "interested in",
    "passion is",
    "pastime is"
  ],
  // Pet
  pet: [
    "has a pet",
    "pet is",
    "owns a",
    "pet name is",
    "has a dog",
    "has a cat"
  ],
  // Addressing preference
  addressing_preference: [
    "prefers to be called",
    "prefers to be addressed",
    "preferred name",
    "call me",
    "address me as",
    "pronoun",
    "pronouns are"
  ],
  // Time zone
  timezone: ["timezone is", "time zone is", "in timezone", "local time"]
};
function normalizeSubject(subject) {
  if (!subject) return "";
  return subject.toLowerCase().trim().replace(/\s+/g, " ");
}
function normalizePredicate(predicate) {
  if (!predicate) return "";
  return predicate.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,!?;:'"]+/g, "");
}
function classifyPredicate(predicate, customClasses) {
  if (!predicate) return "unknown";
  const normalized = normalizePredicate(predicate);
  let classes;
  if (customClasses) {
    classes = { ...DEFAULT_PREDICATE_CLASSES };
    for (const [key, patterns] of Object.entries(customClasses)) {
      if (key in classes) {
        classes[key] = [...patterns, ...classes[key]];
      } else {
        classes[key] = patterns;
      }
    }
  } else {
    classes = DEFAULT_PREDICATE_CLASSES;
  }
  for (const [className, patterns] of Object.entries(classes)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern.toLowerCase())) {
        return className;
      }
    }
  }
  return normalized;
}
function extractSlot(subject, predicate, customClasses) {
  const normalizedSubject = normalizeSubject(subject);
  if (!normalizedSubject || !predicate) {
    return null;
  }
  return {
    subject: normalizedSubject,
    predicateClass: classifyPredicate(predicate, customClasses)
  };
}

// src/facts/slot-matching.ts
var SlotMatchingService = class {
  constructor(client, config) {
    this.client = client;
    this.customClasses = config?.predicateClasses;
  }
  customClasses;
  /**
   * Find existing facts that occupy the same slot as the candidate
   *
   * @param candidate - The fact candidate to check
   * @param memorySpaceId - Memory space to search in
   * @param userId - Optional user ID filter
   * @returns Slot conflict result
   */
  async findSlotConflicts(candidate, memorySpaceId, userId) {
    const slot = extractSlot(
      candidate.subject,
      candidate.predicate,
      this.customClasses
    );
    if (!slot) {
      return {
        hasConflict: false,
        conflictingFacts: []
      };
    }
    const subjectFacts = await this.queryBySubject(
      memorySpaceId,
      candidate.subject,
      userId
    );
    const conflictingFacts = subjectFacts.filter((fact) => {
      const factSlot = extractSlot(
        fact.subject,
        fact.predicate,
        this.customClasses
      );
      return factSlot && factSlot.predicateClass === slot.predicateClass && fact.supersededBy === void 0;
    });
    return {
      hasConflict: conflictingFacts.length > 0,
      slot,
      conflictingFacts
    };
  }
  /**
   * Query facts by subject from the database
   */
  async queryBySubject(memorySpaceId, subject, userId) {
    try {
      const { api: api2 } = await Promise.resolve().then(() => (init_api(), api_exports));
      const facts = await this.client.query(api2.facts.queryBySubject, {
        memorySpaceId,
        subject: normalizeSubject(subject),
        userId,
        includeSuperseded: false,
        limit: 100
        // Reasonable limit for slot matching
      });
      return facts;
    } catch {
      return [];
    }
  }
  /**
   * Get the slot for a fact (useful for debugging/inspection)
   */
  getSlot(subject, predicate) {
    return extractSlot(subject, predicate, this.customClasses);
  }
  /**
   * Check if two facts would be in the same slot
   */
  sameSlot(fact1, fact2) {
    const slot1 = extractSlot(
      fact1.subject,
      fact1.predicate,
      this.customClasses
    );
    const slot2 = extractSlot(
      fact2.subject,
      fact2.predicate,
      this.customClasses
    );
    if (!slot1 || !slot2) {
      return false;
    }
    return slot1.subject === slot2.subject && slot1.predicateClass === slot2.predicateClass;
  }
  /**
   * Get all predicate classes (default + custom)
   */
  getPredicateClasses() {
    return this.customClasses ? { ...DEFAULT_PREDICATE_CLASSES, ...this.customClasses } : DEFAULT_PREDICATE_CLASSES;
  }
  /**
   * Get the default predicate classes
   */
  static getDefaultPredicateClasses() {
    return DEFAULT_PREDICATE_CLASSES;
  }
};

// src/domain/conflicts.ts
var CONFLICT_RESOLUTION_SYSTEM_PROMPT = `You are a knowledge base manager responsible for maintaining accurate, non-redundant facts about entities.

Your task is to determine the correct action when a new fact is added that may conflict with existing facts.

## Available Actions

1. **UPDATE**: The new fact refines, corrects, or provides newer information about the same concept. The existing fact should be updated with merged information.

2. **SUPERSEDE**: The new fact explicitly contradicts or replaces an existing fact. The old fact should be marked as superseded (kept for history) and the new fact becomes current.

3. **NONE**: The new fact is already captured by existing facts (duplicate or less specific). No action needed - return the existing fact.

4. **ADD**: The new fact is genuinely new information not covered by existing facts. Create a new fact record.

## Understanding Temporal Metadata

Each existing fact includes temporal metadata that you MUST consider:

- **Created/Updated timestamps**: When the fact was recorded and last modified
- **Status**: Shows the fact's current state:
  - "Active" = Current, valid fact
  - "\u26A0\uFE0F SUPERSEDED by [factId]" = This fact has been REPLACED by a newer fact - treat as historical
  - "Replaced: [factId]" = This fact replaced an older one - it is the current truth
  - "EXPIRED" = This fact is no longer valid

## Critical Rules for Temporal Reasoning

1. **NEVER merge superseded facts with current facts** - If an existing fact shows "\u26A0\uFE0F SUPERSEDED", it has already been replaced. Do not combine old and new values (e.g., do NOT create "user likes both blue and purple" if blue was superseded by purple).

2. **Supersession chains indicate preference CHANGES** - When you see a fact that "Replaced" another, the user explicitly changed their preference/information. The old value is historical, not additive.

3. **The "Object" field is the key value** - For preference facts, the Object field contains the actual value (e.g., "blue", "purple", "New York"). Different Objects with the same Subject+Predicate = conflict requiring SUPERSEDE.

4. **Timestamps matter** - When in doubt, newer information (higher Updated timestamp) is more likely to be accurate.

## Decision Guidelines

- Prefer UPDATE when the new fact adds detail to an existing fact (same Object, more specificity)
- Use SUPERSEDE when facts are mutually exclusive (same Subject+Predicate, different Object)
- Use NONE when the new fact doesn't add value or is less specific than existing
- Use ADD when facts can coexist (different predicate categories, different aspects)
- Consider confidence levels - higher confidence facts take precedence

## Output Format

Return a JSON object with this exact structure:
{
  "action": "UPDATE" | "SUPERSEDE" | "NONE" | "ADD",
  "targetFactId": "fact-xxx" | null,
  "reason": "Brief explanation of the decision",
  "mergedFact": "Combined fact text if UPDATE, null otherwise",
  "confidence": 0-100
}`;
var CONFLICT_RESOLUTION_EXAMPLES = `## Examples

### Example 1: UPDATE (More Specific)
New Fact: "User's favorite pizza is pepperoni"
Existing Facts:
1. [ID: fact-001] "User likes cheese pizza"

Decision:
{
  "action": "UPDATE",
  "targetFactId": "fact-001",
  "reason": "New fact is more specific about pizza preference - pepperoni over generic cheese",
  "mergedFact": "User's favorite pizza is pepperoni",
  "confidence": 85
}

### Example 2: SUPERSEDE (Location Change)
New Fact: "User moved to San Francisco"
Existing Facts:
1. [ID: fact-002] "User lives in New York"

Decision:
{
  "action": "SUPERSEDE",
  "targetFactId": "fact-002",
  "reason": "User has moved - new location supersedes old location",
  "mergedFact": null,
  "confidence": 90
}

### Example 3: NONE (Duplicate)
New Fact: "User enjoys outdoor activities"
Existing Facts:
1. [ID: fact-003] "User likes hiking and camping outdoors"

Decision:
{
  "action": "NONE",
  "targetFactId": "fact-003",
  "reason": "New fact is less specific - existing fact already captures outdoor activities",
  "mergedFact": null,
  "confidence": 95
}

### Example 4: ADD (Different Aspect)
New Fact: "User's age is 25"
Existing Facts:
1. [ID: fact-004] "User was born in 1999"

Decision:
{
  "action": "ADD",
  "targetFactId": null,
  "reason": "Age and birth year are related but distinct facts - both valid",
  "mergedFact": null,
  "confidence": 80
}

### Example 5: UPDATE (Refinement)
New Fact: "User has a dog named Rex"
Existing Facts:
1. [ID: fact-005] "User has a dog"

Decision:
{
  "action": "UPDATE",
  "targetFactId": "fact-005",
  "reason": "New fact adds the dog's name - a refinement of existing fact",
  "mergedFact": "User has a dog named Rex",
  "confidence": 90
}

### Example 6: SUPERSEDE (Preference Change)
New Fact: "User prefers purple as favorite color"
Existing Facts:
1. [ID: fact-006] "User's favorite color is blue"

Decision:
{
  "action": "SUPERSEDE",
  "targetFactId": "fact-006",
  "reason": "Color preference has changed - purple replaces blue",
  "mergedFact": null,
  "confidence": 85
}`;
function buildSystemPrompt(options) {
  let prompt = CONFLICT_RESOLUTION_SYSTEM_PROMPT;
  if (options?.includeExamples !== false) {
    prompt += "\n\n" + CONFLICT_RESOLUTION_EXAMPLES;
  }
  if (options?.customInstructions) {
    prompt += "\n\n## Additional Instructions\n" + options.customInstructions;
  }
  return prompt;
}
function formatTemporalStatus(fact, now) {
  const statusParts = [];
  if (fact.supersededBy) {
    statusParts.push(`\u26A0\uFE0F SUPERSEDED by ${fact.supersededBy}`);
  }
  if (fact.supersedes) {
    statusParts.push(`Replaced: ${fact.supersedes}`);
  }
  if (fact.validFrom) {
    statusParts.push(`Valid from: ${new Date(fact.validFrom).toISOString()}`);
  }
  if (fact.validUntil) {
    const isExpired = fact.validUntil < now;
    statusParts.push(
      `Valid until: ${new Date(fact.validUntil).toISOString()}${isExpired ? " (EXPIRED)" : ""}`
    );
  }
  return statusParts.length > 0 ? statusParts.join(" | ") : "Active";
}
function buildUserPrompt(newFact, existingFacts, options, clock) {
  const now = clock.now();
  const maxFacts = options?.maxExistingFacts ?? 10;
  const factsToInclude = existingFacts.slice(0, maxFacts);
  let prompt = `## New Fact to Evaluate

Fact: "${newFact.fact}"
Type: ${newFact.factType || "unknown"}
Subject: ${newFact.subject || "unknown"}
Predicate: ${newFact.predicate || "unknown"}
Object: ${newFact.object || "unknown"}
Confidence: ${newFact.confidence}
Tags: ${newFact.tags?.join(", ") || "none"}

## Existing Facts

`;
  if (factsToInclude.length === 0) {
    prompt += "No existing facts found.\n";
  } else {
    const hasSupersessionChain = factsToInclude.some(
      (f) => f.supersedes || f.supersededBy
    );
    if (hasSupersessionChain) {
      prompt += `NOTE: Some facts have supersession relationships. Facts marked "\u26A0\uFE0F SUPERSEDED" 
have been replaced by newer facts and should be considered outdated.
Facts with "Replaced:" indicate they superseded an older fact.

`;
    }
    factsToInclude.forEach((fact, index) => {
      const temporalStatus = formatTemporalStatus(fact, now);
      prompt += `${index + 1}. [ID: ${fact.factId}] "${fact.fact}"
   Type: ${fact.factType}
   Subject: ${fact.subject || "unknown"}
   Predicate: ${fact.predicate || "unknown"}
   Object: ${fact.object || "unknown"}
   Confidence: ${fact.confidence}
   Created: ${new Date(fact.createdAt).toISOString()}
   Updated: ${new Date(fact.updatedAt).toISOString()}
   Status: ${temporalStatus}

`;
    });
  }
  prompt += `## Your Task

Analyze the new fact against the existing facts and determine the appropriate action.
IMPORTANT: 
- If an existing fact is marked "\u26A0\uFE0F SUPERSEDED", it has already been replaced and should not be considered current.
- Pay attention to the temporal relationships between facts.
- The "Object" field often contains the specific value (e.g., "blue", "purple") that determines if facts conflict.

Return ONLY a valid JSON object with your decision.`;
  return prompt;
}
function buildConflictResolutionPrompt(newFact, existingFacts, options, clock) {
  return {
    system: buildSystemPrompt(options),
    user: buildUserPrompt(newFact, existingFacts, options, clock)
  };
}
function parseConflictDecision(response) {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in response");
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid decision object");
    const fields = parsed;
    if (typeof fields.action !== "string" || !isValidAction(fields.action)) {
      throw new Error(`Invalid action: ${String(fields.action)}`);
    }
    return {
      action: fields.action,
      targetFactId: typeof fields.targetFactId === "string" && fields.targetFactId ? fields.targetFactId : null,
      reason: typeof fields.reason === "string" && fields.reason ? fields.reason : "No reason provided",
      mergedFact: typeof fields.mergedFact === "string" && fields.mergedFact ? fields.mergedFact : null,
      confidence: typeof fields.confidence === "number" ? fields.confidence : 75
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
    throw error;
  }
}
function isValidAction(action) {
  return ["UPDATE", "SUPERSEDE", "NONE", "ADD"].includes(action);
}
function validateConflictDecision(decision, existingFacts) {
  if ((decision.action === "UPDATE" || decision.action === "SUPERSEDE") && !decision.targetFactId) {
    return {
      valid: false,
      error: `${decision.action} action requires a targetFactId`
    };
  }
  if (decision.targetFactId) {
    const targetExists = existingFacts.some(
      (f) => f.factId === decision.targetFactId
    );
    if (!targetExists) {
      return {
        valid: false,
        error: `targetFactId ${decision.targetFactId} not found in existing facts`
      };
    }
  }
  if (decision.action === "UPDATE" && !decision.mergedFact) {
    return {
      valid: false,
      error: "UPDATE action requires a mergedFact"
    };
  }
  if (decision.confidence !== void 0 && (!Number.isFinite(decision.confidence) || decision.confidence < 0 || decision.confidence > 100)) {
    return {
      valid: false,
      error: "Confidence must be between 0 and 100"
    };
  }
  return { valid: true };
}
function arePredicatesRelated(predicate1, predicate2) {
  if (!predicate1 || !predicate2) {
    return true;
  }
  const p1 = predicate1.toLowerCase().trim();
  const p2 = predicate2.toLowerCase().trim();
  if (p1 === p2) {
    return true;
  }
  const words1 = new Set(p1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(p2.split(/\s+/).filter((w) => w.length > 2));
  const intersection = [...words1].filter((w) => words2.has(w));
  if (intersection.length > 0) {
    const uniqueWords1 = [...words1].filter((w) => !words2.has(w));
    const uniqueWords2 = [...words2].filter((w) => !words1.has(w));
    if (uniqueWords1.length === 0 || uniqueWords2.length === 0) {
      return true;
    }
    for (const w1 of uniqueWords1) {
      for (const w2 of uniqueWords2) {
        if (wordsSimilar(w1, w2)) {
          return true;
        }
      }
    }
    return false;
  }
  const similarity = stringSimilarity(p1, p2);
  return similarity > 0.7;
}
function wordsSimilar(w1, w2) {
  if (w1 === w2) return true;
  const variations = {
    color: ["colour"],
    favorite: ["favourite"],
    neighbor: ["neighbour"],
    organize: ["organise"]
  };
  for (const [base, alts] of Object.entries(variations)) {
    if (w1 === base && alts.includes(w2) || w2 === base && alts.includes(w1)) {
      return true;
    }
  }
  return stringSimilarity(w1, w2) > 0.8;
}
function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  const chars1 = new Set(s1.split(""));
  const chars2 = new Set(s2.split(""));
  const intersection = [...chars1].filter((c) => chars2.has(c));
  const union = /* @__PURE__ */ new Set([...chars1, ...chars2]);
  return intersection.length / union.size;
}
function getDefaultDecision(newFact, existingFacts) {
  if (existingFacts.length === 0) {
    return {
      action: "ADD",
      targetFactId: null,
      reason: "No existing facts found - adding new fact",
      mergedFact: null,
      confidence: 100
    };
  }
  const normalizedNew = newFact.fact.toLowerCase().trim();
  let bestMatch = null;
  for (const existing of existingFacts) {
    const normalizedExisting = existing.fact.toLowerCase().trim();
    const newWords = new Set(normalizedNew.split(/\s+/));
    const existingWords = new Set(normalizedExisting.split(/\s+/));
    const intersection = [...newWords].filter((w) => existingWords.has(w));
    const union = /* @__PURE__ */ new Set([...newWords, ...existingWords]);
    const similarity = intersection.length / union.size;
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { fact: existing, similarity };
    }
  }
  if (bestMatch && bestMatch.similarity > 0.8) {
    if (newFact.confidence > bestMatch.fact.confidence) {
      return {
        action: "UPDATE",
        targetFactId: bestMatch.fact.factId,
        reason: "High similarity with existing fact - updating with higher confidence",
        mergedFact: newFact.fact,
        confidence: 70
      };
    }
    return {
      action: "NONE",
      targetFactId: bestMatch.fact.factId,
      reason: "High similarity with existing fact - likely duplicate",
      mergedFact: null,
      confidence: 70
    };
  }
  const sameSubject = newFact.subject && bestMatch?.fact.subject && newFact.subject.toLowerCase() === bestMatch.fact.subject.toLowerCase();
  const sameObject = newFact.object && bestMatch?.fact.object && newFact.object.toLowerCase().trim() === bestMatch.fact.object.toLowerCase().trim();
  const predicatesRelated = arePredicatesRelated(
    newFact.predicate,
    bestMatch?.fact.predicate
  );
  if (bestMatch && sameSubject && predicatesRelated) {
    if (sameObject) {
      if (newFact.confidence > bestMatch.fact.confidence) {
        return {
          action: "UPDATE",
          targetFactId: bestMatch.fact.factId,
          reason: "Same subject and object with higher confidence - refining existing fact",
          mergedFact: newFact.fact,
          confidence: 75
        };
      }
      return {
        action: "NONE",
        targetFactId: bestMatch.fact.factId,
        reason: "Same subject and object - existing fact already captures this",
        mergedFact: null,
        confidence: 75
      };
    } else {
      return {
        action: "SUPERSEDE",
        targetFactId: bestMatch.fact.factId,
        reason: "Same subject with different value - preference or fact has changed",
        mergedFact: null,
        confidence: 70
      };
    }
  }
  if (bestMatch && bestMatch.similarity > 0.5) {
    return {
      action: "SUPERSEDE",
      targetFactId: bestMatch.fact.factId,
      reason: "Medium similarity suggests related content - possible update to existing knowledge",
      mergedFact: null,
      confidence: 60
    };
  }
  return {
    action: "ADD",
    targetFactId: null,
    reason: "No similar existing facts found - adding new fact",
    mergedFact: null,
    confidence: 80
  };
}

// src/facts/conflict-prompts.ts
var clientClock = { now: () => Date.now() };
function buildConflictResolutionPrompt2(newFact, existingFacts, options, clock = clientClock) {
  return buildConflictResolutionPrompt(newFact, existingFacts, options, clock);
}

// src/facts/belief-revision.ts
init_deduplication2();
var BeliefRevisionService = class {
  constructor(client, llmClient, graphAdapter, config) {
    this.client = client;
    this.llmClient = llmClient;
    this.graphAdapter = graphAdapter;
    this.config = config || {};
    const slotConfig = {
      enabled: config?.slotMatching?.enabled ?? true,
      predicateClasses: config?.slotMatching?.predicateClasses
    };
    this.slotMatcher = new SlotMatchingService(client, slotConfig);
    this.deduplicationService = new FactDeduplicationService(client);
  }
  slotMatcher;
  deduplicationService;
  config;
  /**
   * Main entry point: evaluate a new fact and determine the appropriate action
   */
  async revise(params) {
    const pipelineResult = {};
    let candidates = [];
    let action = "ADD";
    let targetFact = null;
    let reason = "No conflicts found - adding new fact";
    let confidence = 100;
    if (this.config.slotMatching?.enabled !== false) {
      const slotResult = await this.findSlotConflicts(params);
      pipelineResult.slotMatching = {
        executed: true,
        matched: slotResult.hasConflict,
        factIds: slotResult.conflictingFacts.map((f) => f.factId)
      };
      if (slotResult.hasConflict) {
        candidates = slotResult.conflictingFacts;
      }
    }
    if (candidates.length === 0 && this.config.semanticMatching?.enabled !== false) {
      const semanticResult = await this.findSemanticConflicts(params);
      pipelineResult.semanticMatching = {
        executed: true,
        matched: semanticResult.length > 0,
        factIds: semanticResult.map((r) => r.fact.factId)
      };
      if (semanticResult.length > 0) {
        candidates = semanticResult.map((r) => r.fact);
      }
    }
    if (candidates.length === 0) {
      const subjectTypeCandidates = await this.findSubjectTypeConflicts(params);
      pipelineResult.subjectTypeMatching = {
        executed: true,
        matched: subjectTypeCandidates.length > 0,
        factIds: subjectTypeCandidates.map((f) => f.factId)
      };
      if (subjectTypeCandidates.length > 0) {
        candidates = subjectTypeCandidates;
      }
    }
    if (candidates.length > 0) {
      const decision = await this.resolveWithLLM(params.fact, candidates);
      pipelineResult.llmResolution = {
        executed: true,
        decision: decision.action
      };
      action = decision.action;
      reason = decision.reason;
      confidence = decision.confidence ?? 75;
      if (decision.targetFactId) {
        targetFact = candidates.find((f) => f.factId === decision.targetFactId) || null;
      }
      if (action === "UPDATE" && decision.mergedFact && targetFact) {
        params.fact.fact = decision.mergedFact;
      }
    }
    const executionResult = await this.executeDecision(
      action,
      params,
      targetFact,
      reason
    );
    return {
      action,
      fact: executionResult.fact,
      superseded: executionResult.superseded,
      reason,
      confidence,
      pipeline: pipelineResult
    };
  }
  /**
   * Check for conflicts without executing (preview mode)
   */
  async checkConflicts(params) {
    const slotConflicts = [];
    const semanticConflicts = [];
    if (this.config.slotMatching?.enabled !== false) {
      const slotResult = await this.findSlotConflicts(params);
      if (slotResult.hasConflict) {
        slotConflicts.push(...slotResult.conflictingFacts);
      }
    }
    if (this.config.semanticMatching?.enabled !== false) {
      const semanticResult = await this.findSemanticConflicts(params);
      semanticConflicts.push(...semanticResult);
    }
    const allCandidates = [
      ...slotConflicts,
      ...semanticConflicts.map((r) => r.fact)
    ];
    const uniqueCandidates = this.deduplicateFacts(allCandidates);
    let recommendedAction = "ADD";
    let reason = "No conflicts found";
    if (uniqueCandidates.length > 0) {
      const decision = await this.resolveWithLLM(params.fact, uniqueCandidates);
      recommendedAction = decision.action;
      reason = decision.reason;
    }
    return {
      hasConflicts: slotConflicts.length > 0 || semanticConflicts.length > 0,
      slotConflicts,
      semanticConflicts,
      recommendedAction,
      reason
    };
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private: Pipeline Stages
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Stage 1: Find slot-based conflicts
   */
  async findSlotConflicts(params) {
    return this.slotMatcher.findSlotConflicts(
      {
        subject: params.fact.subject,
        predicate: params.fact.predicate,
        object: params.fact.object
      },
      params.memorySpaceId,
      params.userId
    );
  }
  /**
   * Stage 2: Find semantic conflicts
   */
  async findSemanticConflicts(params) {
    const config = {
      strategy: "semantic",
      similarityThreshold: this.config.semanticMatching?.threshold ?? 0.7,
      generateEmbedding: this.config.semanticMatching?.generateEmbedding
    };
    if (!config.generateEmbedding) {
      config.strategy = "structural";
    }
    const result = await this.deduplicationService.findDuplicate(
      {
        fact: params.fact.fact,
        factType: params.fact.factType || "custom",
        subject: params.fact.subject,
        predicate: params.fact.predicate,
        object: params.fact.object,
        confidence: params.fact.confidence,
        tags: params.fact.tags
      },
      params.memorySpaceId,
      config,
      params.userId
    );
    if (result.isDuplicate && result.existingFact) {
      return [
        {
          fact: result.existingFact,
          score: result.similarityScore ?? 1
        }
      ];
    }
    return [];
  }
  /**
   * Stage 2.5: Find conflicts by subject + factType
   *
   * This stage catches conflicts that slip through slot and semantic matching
   * by querying for facts with the same subject AND factType. For example,
   * "User likes blue" and "User prefers purple" both have subject="user" and
   * factType="preference", making them candidates for LLM review even if their
   * predicates differ.
   */
  async findSubjectTypeConflicts(params) {
    if (!params.fact.subject || !params.fact.factType) {
      return [];
    }
    const { api: api2 } = await Promise.resolve().then(() => (init_api(), api_exports));
    const facts = await this.client.query(api2.facts.list, {
      memorySpaceId: params.memorySpaceId,
      userId: params.userId,
      subject: params.fact.subject,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      factType: params.fact.factType,
      includeSuperseded: false,
      limit: 20
      // Reasonable limit for LLM processing
    });
    return facts;
  }
  /**
   * Stage 3: Resolve conflict with LLM
   */
  async resolveWithLLM(newFact, existingFacts) {
    if (this.config.llmResolution?.enabled === false || !this.llmClient) {
      return getDefaultDecision(newFact, existingFacts);
    }
    try {
      const { system, user } = buildConflictResolutionPrompt2(
        newFact,
        existingFacts,
        { includeExamples: true }
      );
      const response = await this.llmClient.complete({
        system,
        prompt: user,
        model: this.config.llmResolution?.model,
        responseFormat: "json"
      });
      const decision = parseConflictDecision(response);
      const validation = validateConflictDecision(decision, existingFacts);
      if (!validation.valid) {
        console.warn(
          `[Cortex] LLM decision validation failed: ${validation.error}. Falling back to default.`
        );
        return getDefaultDecision(newFact, existingFacts);
      }
      return decision;
    } catch (error) {
      console.warn(
        `[Cortex] LLM conflict resolution failed: ${error}. Falling back to default.`
      );
      return getDefaultDecision(newFact, existingFacts);
    }
  }
  /**
   * Stage 4: Execute the decision
   */
  async executeDecision(action, params, targetFact, _reason) {
    const { api: api2 } = await Promise.resolve().then(() => (init_api(), api_exports));
    const superseded = [];
    switch (action) {
      case "NONE": {
        if (targetFact) {
          return { fact: targetFact, superseded: [] };
        }
        break;
      }
      case "UPDATE": {
        if (targetFact) {
          const updated = await this.client.mutation(api2.facts.updateInPlace, {
            memorySpaceId: params.memorySpaceId,
            factId: targetFact.factId,
            fact: params.fact.fact,
            confidence: params.fact.confidence,
            tags: params.fact.tags
          });
          const updatedFact = updated;
          await this.syncFactToGraphIfConfigured(updatedFact, params.tenantId);
          return { fact: updatedFact, superseded: [] };
        }
        break;
      }
      case "SUPERSEDE": {
        if (targetFact) {
          const newFact2 = await this.client.mutation(api2.facts.store, {
            memorySpaceId: params.memorySpaceId,
            participantId: params.participantId,
            userId: params.userId,
            tenantId: params.tenantId,
            // Multi-tenancy: SaaS platform isolation
            fact: params.fact.fact,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            factType: params.fact.factType || "custom",
            subject: params.fact.subject,
            predicate: params.fact.predicate,
            object: params.fact.object,
            confidence: params.fact.confidence,
            sourceType: params.sourceType || "conversation",
            sourceRef: params.sourceRef,
            tags: params.fact.tags || [],
            // Embedding for semantic search (v0.30.0+)
            embedding: params.fact.embedding,
            // Enriched entity/relation extraction for graph sync (v0.30.1+)
            entities: params.fact.entities,
            relations: params.fact.relations
          });
          const createdFact2 = newFact2;
          await this.client.mutation(api2.facts.supersede, {
            memorySpaceId: params.memorySpaceId,
            oldFactId: targetFact.factId,
            newFactId: createdFact2.factId,
            reason: _reason
          });
          superseded.push(targetFact);
          await this.syncFactToGraphIfConfigured(createdFact2, params.tenantId);
          return { fact: createdFact2, superseded };
        }
        break;
      }
      case "ADD":
      default: {
        const newFact2 = await this.client.mutation(api2.facts.store, {
          memorySpaceId: params.memorySpaceId,
          participantId: params.participantId,
          userId: params.userId,
          tenantId: params.tenantId,
          // Multi-tenancy: SaaS platform isolation
          fact: params.fact.fact,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          factType: params.fact.factType || "custom",
          subject: params.fact.subject,
          predicate: params.fact.predicate,
          object: params.fact.object,
          confidence: params.fact.confidence,
          sourceType: params.sourceType || "conversation",
          sourceRef: params.sourceRef,
          tags: params.fact.tags || [],
          // Embedding for semantic search (v0.30.0+)
          embedding: params.fact.embedding,
          // Enriched entity/relation extraction for graph sync (v0.30.1+)
          entities: params.fact.entities,
          relations: params.fact.relations
        });
        const createdFact2 = newFact2;
        await this.syncFactToGraphIfConfigured(createdFact2, params.tenantId);
        return { fact: createdFact2, superseded: [] };
      }
    }
    const newFact = await this.client.mutation(api2.facts.store, {
      memorySpaceId: params.memorySpaceId,
      participantId: params.participantId,
      userId: params.userId,
      tenantId: params.tenantId,
      // Multi-tenancy: SaaS platform isolation
      fact: params.fact.fact,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      factType: params.fact.factType || "custom",
      subject: params.fact.subject,
      predicate: params.fact.predicate,
      object: params.fact.object,
      confidence: params.fact.confidence,
      sourceType: params.sourceType || "conversation",
      sourceRef: params.sourceRef,
      tags: params.fact.tags || [],
      // Embedding for semantic search (v0.30.0+)
      embedding: params.fact.embedding,
      // Enriched entity/relation extraction for graph sync (v0.30.1+)
      entities: params.fact.entities,
      relations: params.fact.relations
    });
    const createdFact = newFact;
    await this.syncFactToGraphIfConfigured(createdFact, params.tenantId);
    return { fact: createdFact, superseded: [] };
  }
  /**
   * Stage 5: Sync fact to graph database (if configured)
   *
   * Creates Fact node and Entity nodes with relationships:
   * - Fact node with all properties
   * - Entity nodes from fact.entities array
   * - MENTIONS relationships from Fact to Entity
   * - Predicate-based relationships (e.g., WORKS_AT, KNOWS)
   * - EXTRACTED_FROM relationship if sourceRef exists
   * - IN_SPACE relationship to MemorySpace
   * - SUPERSEDES relationship if fact supersedes another
   */
  async syncFactToGraphIfConfigured(fact, tenantId) {
    if (!this.graphAdapter) {
      return;
    }
    try {
      const nodeId = await syncFactToGraph(fact, this.graphAdapter, tenantId);
      await syncFactRelationships(fact, nodeId, this.graphAdapter);
    } catch (error) {
      console.warn("[Cortex] Failed to sync fact to graph:", error);
    }
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private: Utilities
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Remove duplicate facts from array (by factId)
   */
  deduplicateFacts(facts) {
    const seen = /* @__PURE__ */ new Set();
    return facts.filter((f) => {
      if (seen.has(f.factId)) {
        return false;
      }
      seen.add(f.factId);
      return true;
    });
  }
  /**
   * Get the current configuration
   */
  getConfig() {
    return this.config;
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (config.slotMatching?.predicateClasses) {
      this.slotMatcher = new SlotMatchingService(this.client, {
        enabled: this.config.slotMatching?.enabled ?? true,
        predicateClasses: this.config.slotMatching?.predicateClasses
      });
    }
  }
};

// src/facts/history.ts
init_api();
var FactHistoryCapabilityError = class extends Error {
  version = 1;
  code = "CAPABILITY_UNAVAILABLE";
  retryable = false;
  outcome = "not_dispatched";
  constructor() {
    super(
      "Fact history writes and maintenance require trusted backend execution. No operation was dispatched by this client."
    );
    this.name = "FactHistoryCapabilityError";
  }
};
var FactHistoryService = class {
  constructor(client, resilience) {
    this.client = client;
    this.resilience = resilience;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Log a fact change event
   *
   * @param params - Event parameters
   * @throws FactHistoryCapabilityError before dispatch; history is server-owned.
   */
  async log(params) {
    void params;
    throw new FactHistoryCapabilityError();
  }
  /**
   * Get history for a specific fact
   *
   * @param factId - The fact ID to get history for
   * @param limit - Max events to return (default: 100)
   * @returns Array of change events
   */
  async getHistory(factId, limit) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.factHistory.getHistory, {
        factId,
        limit
      }),
      "factHistory:getHistory"
    );
    return result;
  }
  /**
   * Get a specific change event by ID
   *
   * @param eventId - The event ID
   * @returns The event or null if not found
   */
  async getEvent(eventId) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.factHistory.getEvent, {
        eventId
      }),
      "factHistory:getEvent"
    );
    return result;
  }
  /**
   * Get changes in a time range with filters
   *
   * @param filter - Filter parameters
   * @returns Array of change events
   */
  async getChanges(filter) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.factHistory.getChangesByTimeRange, {
        memorySpaceId: filter.memorySpaceId,
        after: filter.after?.getTime(),
        before: filter.before?.getTime(),
        action: filter.action,
        limit: filter.limit,
        offset: filter.offset
      }),
      "factHistory:getChanges"
    );
    return result;
  }
  /**
   * Count changes by action type
   *
   * @param memorySpaceId - Memory space to query
   * @param after - Start timestamp
   * @param before - End timestamp
   * @returns Counts by action type
   */
  async countByAction(memorySpaceId, after, before) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.factHistory.countByAction, {
        memorySpaceId,
        after: after?.getTime(),
        before: before?.getTime()
      }),
      "factHistory:countByAction"
    );
    return result;
  }
  /**
   * Get the supersession chain for a fact
   *
   * Returns the chain of facts that led to the current state,
   * showing how the knowledge evolved over time.
   *
   * @param factId - The fact ID to trace
   * @returns Array of chain entries from oldest to newest
   */
  async getSupersessionChain(factId) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.factHistory.getSupersessionChain, {
        factId
      }),
      "factHistory:getSupersessionChain"
    );
    return result;
  }
  /**
   * Get activity summary for a time period
   *
   * @param memorySpaceId - Memory space to query
   * @param hours - Number of hours to look back (default: 24)
   * @returns Activity summary
   */
  async getActivitySummary(memorySpaceId, hours) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.factHistory.getActivitySummary, {
        memorySpaceId,
        hours
      }),
      "factHistory:getActivitySummary"
    );
    return result;
  }
  /**
   * Delete history for a fact (GDPR cascade)
   *
   * @param factId - The fact ID
   * @throws FactHistoryCapabilityError before dispatch; requires trusted backend execution.
   */
  async deleteByFactId(factId) {
    void factId;
    throw new FactHistoryCapabilityError();
  }
  /**
   * Delete history for a user (GDPR cascade)
   *
   * @param userId - The user ID
   * @throws FactHistoryCapabilityError before dispatch; requires trusted backend execution.
   */
  async deleteByUserId(userId) {
    void userId;
    throw new FactHistoryCapabilityError();
  }
  /**
   * Delete history for a memory space
   *
   * @param memorySpaceId - The memory space ID
   * @throws FactHistoryCapabilityError before dispatch; requires trusted backend execution.
   */
  async deleteByMemorySpace(memorySpaceId) {
    void memorySpaceId;
    throw new FactHistoryCapabilityError();
  }
  /**
   * Purge old history events (retention policy)
   *
   * @param memorySpaceId - Optional memory space filter
   * @param olderThan - Delete events before this date
   * @param limit - Max events to delete per call
   * @throws FactHistoryCapabilityError before dispatch; requires trusted backend execution.
   */
  async purgeOldEvents(olderThan, memorySpaceId, limit) {
    void olderThan;
    void memorySpaceId;
    void limit;
    throw new FactHistoryCapabilityError();
  }
};

// src/facts/index.ts
init_deduplication2();
var FactsAPI = class {
  constructor(client, graphAdapter, resilience, authContext, llmClient, beliefRevisionConfig) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
    this.llmClient = llmClient;
    this.deduplicationService = new FactDeduplicationService(client);
    this.historyService = new FactHistoryService(client, resilience);
    this.beliefRevisionService = new BeliefRevisionService(
      client,
      llmClient,
      graphAdapter,
      beliefRevisionConfig
    );
  }
  deduplicationService;
  beliefRevisionService;
  historyService;
  llmClient;
  authContext;
  /**
   * Configure or update the belief revision service
   */
  configureBeliefRevision(llmClient, config) {
    this.beliefRevisionService = new BeliefRevisionService(
      this.client,
      llmClient || this.llmClient,
      this.graphAdapter,
      config
    );
  }
  /**
   * Check if belief revision is configured and available
   *
   * @returns true if belief revision service is initialized
   *
   * @example
   * ```typescript
   * if (facts.hasBeliefRevision()) {
   *   // Use revise() for intelligent fact management
   *   await facts.revise({ ... });
   * } else {
   *   // Fall back to storeWithDedup()
   *   await facts.storeWithDedup({ ... });
   * }
   * ```
   */
  hasBeliefRevision() {
    return this.beliefRevisionService !== void 0;
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Store a new fact
   *
   * @example
   * ```typescript
   * const fact = await cortex.facts.store({
   *   memorySpaceId: 'space-1',
   *   fact: 'User prefers dark mode',
   *   factType: 'preference',
   *   subject: 'user-123',
   *   confidence: 95,
   *   sourceType: 'conversation',
   *   tags: ['ui', 'preferences'],
   * });
   * ```
   */
  async store(params, _options) {
    validateMemorySpaceId2(params.memorySpaceId);
    validateRequiredString2(params.fact, "fact");
    validateFactType(params.factType);
    validateConfidence(params.confidence, "confidence");
    validateSourceType2(params.sourceType);
    if (params.tags !== void 0) {
      validateStringArray(params.tags, "tags", true);
    }
    if (params.validFrom !== void 0 && params.validUntil !== void 0) {
      validateValidityPeriod(params.validFrom, params.validUntil);
    }
    if (params.sourceRef !== void 0) {
      validateSourceRef(params.sourceRef);
    }
    if (params.metadata !== void 0) {
      validateMetadata3(params.metadata);
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.facts.store, {
        memorySpaceId: params.memorySpaceId,
        participantId: params.participantId,
        userId: params.userId,
        tenantId: resolveTenantId(this.authContext?.tenantId, params.tenantId),
        fact: params.fact,
        factType: params.factType,
        subject: params.subject,
        predicate: params.predicate,
        object: params.object,
        confidence: params.confidence,
        sourceType: params.sourceType,
        sourceRef: params.sourceRef,
        metadata: params.metadata,
        tags: params.tags || [],
        validFrom: params.validFrom,
        validUntil: params.validUntil,
        // Enrichment fields (for bullet-proof retrieval)
        category: params.category,
        searchAliases: params.searchAliases,
        semanticContext: params.semanticContext,
        entities: params.entities,
        relations: params.relations,
        // Embedding for semantic search (v0.30.0+)
        embedding: params.embedding
      }),
      "facts:store"
    );
    const factRecord = result;
    if (this.graphAdapter) {
      try {
        const nodeId = await syncFactToGraph(
          factRecord,
          this.graphAdapter,
          this.authContext?.tenantId
        );
        await syncFactRelationships(factRecord, nodeId, this.graphAdapter);
      } catch (error) {
        console.warn("[Cortex] Failed to sync fact to graph:", error);
      }
    }
    return factRecord;
  }
  /**
   * Store a fact with cross-session deduplication
   *
   * This method checks for existing similar facts before storing.
   * If a duplicate is found:
   * - If the new fact has higher confidence, the existing fact is updated
   * - Otherwise, the existing fact is returned without creating a duplicate
   *
   * @example
   * ```typescript
   * const result = await cortex.facts.storeWithDedup(
   *   {
   *     memorySpaceId: 'space-1',
   *     fact: 'User prefers dark mode',
   *     factType: 'preference',
   *     subject: 'user-123',
   *     confidence: 95,
   *     sourceType: 'conversation',
   *   },
   *   {
   *     deduplication: {
   *       strategy: 'semantic',
   *       generateEmbedding: embedFn,
   *     },
   *   }
   * );
   *
   * if (result.wasUpdated) {
   *   console.log('Updated existing fact:', result.fact.factId);
   * } else {
   *   console.log('Created new fact:', result.fact.factId);
   * }
   * ```
   */
  async storeWithDedup(params, options) {
    if (options?.deduplication === false) {
      const fact2 = await this.store(params, options);
      return {
        fact: fact2,
        wasUpdated: false
      };
    }
    const dedupConfig = FactDeduplicationService.resolveConfig(
      options?.deduplication
    );
    if (dedupConfig.strategy === "none") {
      const fact2 = await this.store(params, options);
      return {
        fact: fact2,
        wasUpdated: false
      };
    }
    const duplicateResult = await this.deduplicationService.findDuplicate(
      {
        fact: params.fact,
        factType: params.factType,
        subject: params.subject,
        predicate: params.predicate,
        object: params.object,
        confidence: params.confidence,
        tags: params.tags
      },
      params.memorySpaceId,
      dedupConfig,
      params.userId
    );
    if (duplicateResult.isDuplicate && duplicateResult.existingFact) {
      const existing = duplicateResult.existingFact;
      if (duplicateResult.shouldUpdate) {
        const updatedFact = await this.update(
          params.memorySpaceId,
          existing.factId,
          {
            confidence: params.confidence,
            // Optionally update tags if new ones are provided
            tags: params.tags ? [.../* @__PURE__ */ new Set([...existing.tags, ...params.tags])] : void 0
          }
        );
        return {
          fact: updatedFact,
          wasUpdated: true,
          deduplication: {
            strategy: dedupConfig.strategy,
            matchedExisting: true,
            similarityScore: duplicateResult.similarityScore
          }
        };
      }
      return {
        fact: existing,
        wasUpdated: false,
        deduplication: {
          strategy: dedupConfig.strategy,
          matchedExisting: true,
          similarityScore: duplicateResult.similarityScore
        }
      };
    }
    const fact = await this.store(params, options);
    return {
      fact,
      wasUpdated: false,
      deduplication: {
        strategy: dedupConfig.strategy,
        matchedExisting: false
      }
    };
  }
  /**
   * Get fact by ID
   *
   * @example
   * ```typescript
   * const fact = await cortex.facts.get('space-1', 'fact-123');
   * ```
   */
  async get(memorySpaceId, factId) {
    validateMemorySpaceId2(memorySpaceId);
    validateRequiredString2(factId, "factId");
    validateFactIdFormat(factId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.get, {
        memorySpaceId,
        factId,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "facts:get"
    );
    return result;
  }
  /**
   * List facts with filters
   *
   * @example
   * ```typescript
   * const facts = await cortex.facts.list({
   *   memorySpaceId: 'space-1',
   *   factType: 'preference',
   *   subject: 'user-123',
   * });
   * ```
   */
  async list(filter) {
    validateMemorySpaceId2(filter.memorySpaceId);
    if (filter.factType !== void 0) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== void 0) {
      validateSourceType2(filter.sourceType);
    }
    if (filter.confidence !== void 0) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== void 0) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== void 0) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== void 0) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.limit !== void 0) {
      validateNonNegativeInteger(filter.limit, "limit");
    }
    if (filter.offset !== void 0) {
      validateNonNegativeInteger(filter.offset, "offset");
    }
    if (filter.sortBy !== void 0) {
      validateSortBy2(filter.sortBy);
    }
    if (filter.sortOrder !== void 0) {
      validateSortOrder3(filter.sortOrder);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange2(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore"
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange2(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore"
      );
    }
    if (filter.metadata !== void 0) {
      validateMetadata3(filter.metadata);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.list, {
        memorySpaceId: filter.memorySpaceId,
        tenantId: this.authContext?.tenantId,
        // Tenant isolation
        factType: filter.factType,
        subject: filter.subject,
        predicate: filter.predicate,
        object: filter.object,
        minConfidence: filter.minConfidence,
        confidence: filter.confidence,
        userId: filter.userId,
        participantId: filter.participantId,
        tags: filter.tags,
        tagMatch: filter.tagMatch,
        sourceType: filter.sourceType,
        createdBefore: filter.createdBefore?.getTime(),
        createdAfter: filter.createdAfter?.getTime(),
        updatedBefore: filter.updatedBefore?.getTime(),
        updatedAfter: filter.updatedAfter?.getTime(),
        version: filter.version,
        includeSuperseded: filter.includeSuperseded,
        validAt: filter.validAt?.getTime(),
        metadata: filter.metadata,
        limit: filter.limit,
        offset: filter.offset,
        sortBy: filter.sortBy,
        sortOrder: filter.sortOrder
      }),
      "facts:list"
    );
    return result;
  }
  /**
   * Count facts
   *
   * @example
   * ```typescript
   * const count = await cortex.facts.count({
   *   memorySpaceId: 'space-1',
   *   factType: 'knowledge',
   * });
   * ```
   */
  async count(filter) {
    validateMemorySpaceId2(filter.memorySpaceId);
    if (filter.factType !== void 0) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== void 0) {
      validateSourceType2(filter.sourceType);
    }
    if (filter.confidence !== void 0) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== void 0) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== void 0) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== void 0) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange2(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore"
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange2(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore"
      );
    }
    if (filter.metadata !== void 0) {
      validateMetadata3(filter.metadata);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.count, {
        memorySpaceId: filter.memorySpaceId,
        tenantId: this.authContext?.tenantId,
        // Tenant isolation
        factType: filter.factType,
        subject: filter.subject,
        predicate: filter.predicate,
        object: filter.object,
        minConfidence: filter.minConfidence,
        confidence: filter.confidence,
        userId: filter.userId,
        participantId: filter.participantId,
        tags: filter.tags,
        tagMatch: filter.tagMatch,
        sourceType: filter.sourceType,
        createdBefore: filter.createdBefore?.getTime(),
        createdAfter: filter.createdAfter?.getTime(),
        updatedBefore: filter.updatedBefore?.getTime(),
        updatedAfter: filter.updatedAfter?.getTime(),
        version: filter.version,
        includeSuperseded: filter.includeSuperseded,
        validAt: filter.validAt?.getTime(),
        metadata: filter.metadata
      }),
      "facts:count"
    );
    return result;
  }
  /**
   * Search facts
   *
   * @example
   * ```typescript
   * const results = await cortex.facts.search('space-1', 'password', {
   *   factType: 'knowledge',
   *   minConfidence: 80,
   * });
   * ```
   */
  async search(memorySpaceId, query, options) {
    validateMemorySpaceId2(memorySpaceId);
    validateRequiredString2(query, "query");
    if (options) {
      if (options.factType !== void 0) {
        validateFactType(options.factType);
      }
      if (options.sourceType !== void 0) {
        validateSourceType2(options.sourceType);
      }
      if (options.confidence !== void 0) {
        validateConfidence(options.confidence, "confidence");
      }
      if (options.minConfidence !== void 0) {
        validateConfidence(options.minConfidence, "minConfidence");
      }
      if (options.tags !== void 0) {
        validateStringArray(options.tags, "tags", true);
      }
      if (options.tagMatch !== void 0) {
        validateTagMatch(options.tagMatch);
      }
      if (options.limit !== void 0) {
        validateNonNegativeInteger(options.limit, "limit");
      }
      if (options.offset !== void 0) {
        validateNonNegativeInteger(options.offset, "offset");
      }
      if (options.sortBy !== void 0) {
        validateSortBy2(options.sortBy);
      }
      if (options.sortOrder !== void 0) {
        validateSortOrder3(options.sortOrder);
      }
      if (options.createdBefore && options.createdAfter) {
        validateDateRange2(
          options.createdAfter,
          options.createdBefore,
          "createdAfter",
          "createdBefore"
        );
      }
      if (options.updatedBefore && options.updatedAfter) {
        validateDateRange2(
          options.updatedAfter,
          options.updatedBefore,
          "updatedAfter",
          "updatedBefore"
        );
      }
      if (options.metadata !== void 0) {
        validateMetadata3(options.metadata);
      }
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.search, {
        memorySpaceId,
        tenantId: this.authContext?.tenantId,
        // Tenant isolation
        query,
        factType: options?.factType,
        subject: options?.subject,
        predicate: options?.predicate,
        object: options?.object,
        minConfidence: options?.minConfidence,
        confidence: options?.confidence,
        userId: options?.userId,
        participantId: options?.participantId,
        tags: options?.tags,
        tagMatch: options?.tagMatch,
        sourceType: options?.sourceType,
        createdBefore: options?.createdBefore?.getTime(),
        createdAfter: options?.createdAfter?.getTime(),
        updatedBefore: options?.updatedBefore?.getTime(),
        updatedAfter: options?.updatedAfter?.getTime(),
        version: options?.version,
        includeSuperseded: options?.includeSuperseded,
        validAt: options?.validAt?.getTime(),
        metadata: options?.metadata,
        limit: options?.limit,
        offset: options?.offset,
        sortBy: options?.sortBy,
        sortOrder: options?.sortOrder
      }),
      "facts:search"
    );
    return result;
  }
  /**
   * Semantic search for facts using vector embeddings (v0.30.0+)
   *
   * Uses cosine similarity to find semantically related facts,
   * unlike text search which requires keyword matching.
   *
   * @param memorySpaceId - The memory space to search in
   * @param embedding - The query embedding vector
   * @param options - Search options (filters, limits, etc.)
   * @returns Array of matching fact records
   *
   * @example
   * ```typescript
   * const embedding = await generateEmbedding('user preferences');
   * const facts = await cortex.facts.semanticSearch('space-1', embedding, {
   *   minConfidence: 80,
   *   limit: 10,
   * });
   * ```
   */
  async semanticSearch(memorySpaceId, embedding, options) {
    validateMemorySpaceId2(memorySpaceId);
    if (!embedding || embedding.length === 0) {
      throw new Error("Embedding vector is required for semantic search");
    }
    if (options) {
      if (options.minConfidence !== void 0) {
        validateConfidence(options.minConfidence, "minConfidence");
      }
      if (options.tags !== void 0) {
        validateStringArray(options.tags, "tags", true);
      }
      if (options.limit !== void 0) {
        validateNonNegativeInteger(options.limit, "limit");
      }
      if (options.createdBefore && options.createdAfter) {
        validateDateRange2(
          options.createdAfter,
          options.createdBefore,
          "createdAfter",
          "createdBefore"
        );
      }
    }
    const result = await this.executeWithResilience(
      () => this.client.action(api.facts.semanticSearch, {
        memorySpaceId,
        embedding,
        tenantId: resolveTenantId(this.authContext?.tenantId, options?.tenantId),
        userId: options?.userId,
        minConfidence: options?.minConfidence,
        includeSuperseded: options?.includeSuperseded,
        minScore: options?.minScore,
        limit: options?.limit,
        tags: options?.tags,
        createdAfter: options?.createdAfter?.getTime(),
        createdBefore: options?.createdBefore?.getTime()
      }),
      "facts:semanticSearch"
    );
    return result;
  }
  /**
   * Update fact (creates new version)
   *
   * @example
   * ```typescript
   * const updated = await cortex.facts.update('space-1', 'fact-123', {
   *   fact: 'Updated fact statement',
   *   confidence: 99,
   * });
   * ```
   */
  async update(memorySpaceId, factId, updates, _options) {
    validateMemorySpaceId2(memorySpaceId);
    validateRequiredString2(factId, "factId");
    validateFactIdFormat(factId);
    validateUpdateHasFields(updates);
    if (updates.confidence !== void 0) {
      validateConfidence(updates.confidence, "confidence");
    }
    if (updates.tags !== void 0) {
      validateStringArray(updates.tags, "tags", true);
    }
    if (updates.metadata !== void 0) {
      validateMetadata3(updates.metadata);
    }
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.facts.update, {
          memorySpaceId,
          factId,
          fact: updates.fact,
          confidence: updates.confidence,
          tags: updates.tags,
          validUntil: updates.validUntil,
          metadata: updates.metadata,
          // Enrichment fields (for bullet-proof retrieval)
          category: updates.category,
          searchAliases: updates.searchAliases,
          semanticContext: updates.semanticContext,
          entities: updates.entities,
          relations: updates.relations,
          // Embedding for semantic search (v0.30.0+)
          embedding: updates.embedding
        }),
        "facts:update"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    const factRecord = result;
    if (this.graphAdapter) {
      try {
        const nodes = await this.graphAdapter.findNodes("Fact", { factId }, 1);
        if (nodes.length > 0) {
          await this.graphAdapter.updateNode(
            nodes[0].id,
            updates
          );
        }
      } catch (error) {
        console.warn("[Cortex] Failed to update fact in graph:", error);
      }
    }
    return factRecord;
  }
  /**
   * Delete fact (soft delete - marks as invalidated)
   *
   * @example
   * ```typescript
   * await cortex.facts.delete('space-1', 'fact-123');
   * ```
   */
  async delete(memorySpaceId, factId, _options) {
    validateMemorySpaceId2(memorySpaceId);
    validateRequiredString2(factId, "factId");
    validateFactIdFormat(factId);
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.facts.deleteFact, {
          memorySpaceId,
          factId
        }),
        "facts:delete"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        await deleteFactFromGraph(factId, this.graphAdapter, true);
      } catch (error) {
        console.warn("[Cortex] Failed to delete fact from graph:", error);
      }
    }
    return result;
  }
  /**
   * Delete multiple facts matching filters in a single operation
   *
   * @example
   * ```typescript
   * // Delete all facts in a memory space
   * const result = await cortex.facts.deleteMany({
   *   memorySpaceId: 'space-1',
   * });
   *
   * // Delete all facts for a specific user (GDPR compliance)
   * const gdprResult = await cortex.facts.deleteMany({
   *   memorySpaceId: 'space-1',
   *   userId: 'user-to-delete',
   * });
   *
   * // Delete all preference facts
   * const prefResult = await cortex.facts.deleteMany({
   *   memorySpaceId: 'space-1',
   *   factType: 'preference',
   * });
   * ```
   */
  async deleteMany(params) {
    validateMemorySpaceId2(params.memorySpaceId);
    if (params.factType !== void 0) {
      validateFactType(params.factType);
    }
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.facts.deleteMany, {
          memorySpaceId: params.memorySpaceId,
          userId: params.userId,
          factType: params.factType
        }),
        "facts:deleteMany"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    return result;
  }
  /**
   * Get fact version history
   *
   * @example
   * ```typescript
   * const history = await cortex.facts.getHistory('space-1', 'fact-123');
   * ```
   */
  async getHistory(memorySpaceId, factId) {
    validateMemorySpaceId2(memorySpaceId);
    validateRequiredString2(factId, "factId");
    validateFactIdFormat(factId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.getHistory, {
        memorySpaceId,
        factId
      }),
      "facts:getHistory"
    );
    return result;
  }
  /**
   * Query facts by subject (entity-centric view)
   *
   * @example
   * ```typescript
   * const userFacts = await cortex.facts.queryBySubject({
   *   memorySpaceId: 'space-1',
   *   subject: 'user-123',
   *   factType: 'preference',
   * });
   * ```
   */
  async queryBySubject(filter) {
    validateMemorySpaceId2(filter.memorySpaceId);
    validateRequiredString2(filter.subject, "subject");
    if (filter.factType !== void 0) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== void 0) {
      validateSourceType2(filter.sourceType);
    }
    if (filter.confidence !== void 0) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== void 0) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== void 0) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== void 0) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.limit !== void 0) {
      validateNonNegativeInteger(filter.limit, "limit");
    }
    if (filter.offset !== void 0) {
      validateNonNegativeInteger(filter.offset, "offset");
    }
    if (filter.sortBy !== void 0) {
      validateSortBy2(filter.sortBy);
    }
    if (filter.sortOrder !== void 0) {
      validateSortOrder3(filter.sortOrder);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange2(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore"
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange2(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore"
      );
    }
    if (filter.metadata !== void 0) {
      validateMetadata3(filter.metadata);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.queryBySubject, {
        memorySpaceId: filter.memorySpaceId,
        subject: filter.subject,
        factType: filter.factType,
        userId: filter.userId,
        participantId: filter.participantId,
        predicate: filter.predicate,
        object: filter.object,
        minConfidence: filter.minConfidence,
        confidence: filter.confidence,
        tags: filter.tags,
        tagMatch: filter.tagMatch,
        sourceType: filter.sourceType,
        createdBefore: filter.createdBefore?.getTime(),
        createdAfter: filter.createdAfter?.getTime(),
        updatedBefore: filter.updatedBefore?.getTime(),
        updatedAfter: filter.updatedAfter?.getTime(),
        version: filter.version,
        includeSuperseded: filter.includeSuperseded,
        validAt: filter.validAt?.getTime(),
        metadata: filter.metadata,
        limit: filter.limit,
        offset: filter.offset,
        sortBy: filter.sortBy,
        sortOrder: filter.sortOrder
      }),
      "facts:queryBySubject"
    );
    return result;
  }
  /**
   * Query facts by relationship (graph traversal)
   *
   * @example
   * ```typescript
   * const workPlaces = await cortex.facts.queryByRelationship({
   *   memorySpaceId: 'space-1',
   *   subject: 'user-123',
   *   predicate: 'works_at',
   * });
   * ```
   */
  async queryByRelationship(filter) {
    validateMemorySpaceId2(filter.memorySpaceId);
    validateRequiredString2(filter.subject, "subject");
    validateRequiredString2(filter.predicate, "predicate");
    if (filter.factType !== void 0) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== void 0) {
      validateSourceType2(filter.sourceType);
    }
    if (filter.confidence !== void 0) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== void 0) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== void 0) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== void 0) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.limit !== void 0) {
      validateNonNegativeInteger(filter.limit, "limit");
    }
    if (filter.offset !== void 0) {
      validateNonNegativeInteger(filter.offset, "offset");
    }
    if (filter.sortBy !== void 0) {
      validateSortBy2(filter.sortBy);
    }
    if (filter.sortOrder !== void 0) {
      validateSortOrder3(filter.sortOrder);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange2(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore"
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange2(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore"
      );
    }
    if (filter.metadata !== void 0) {
      validateMetadata3(filter.metadata);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.queryByRelationship, {
        memorySpaceId: filter.memorySpaceId,
        subject: filter.subject,
        predicate: filter.predicate,
        object: filter.object,
        factType: filter.factType,
        userId: filter.userId,
        participantId: filter.participantId,
        minConfidence: filter.minConfidence,
        confidence: filter.confidence,
        tags: filter.tags,
        tagMatch: filter.tagMatch,
        sourceType: filter.sourceType,
        createdBefore: filter.createdBefore?.getTime(),
        createdAfter: filter.createdAfter?.getTime(),
        updatedBefore: filter.updatedBefore?.getTime(),
        updatedAfter: filter.updatedAfter?.getTime(),
        version: filter.version,
        includeSuperseded: filter.includeSuperseded,
        validAt: filter.validAt?.getTime(),
        metadata: filter.metadata,
        limit: filter.limit,
        offset: filter.offset,
        sortBy: filter.sortBy,
        sortOrder: filter.sortOrder
      }),
      "facts:queryByRelationship"
    );
    return result;
  }
  /**
   * Export facts
   *
   * @example
   * ```typescript
   * const exported = await cortex.facts.export({
   *   memorySpaceId: 'space-1',
   *   format: 'jsonld',
   * });
   * ```
   */
  async export(options) {
    validateMemorySpaceId2(options.memorySpaceId);
    validateExportFormat3(options.format);
    if (options.factType !== void 0) {
      validateFactType(options.factType);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.facts.exportFacts, {
        memorySpaceId: options.memorySpaceId,
        format: options.format,
        factType: options.factType
      }),
      "facts:export"
    );
    return result;
  }
  /**
   * Consolidate duplicate facts
   *
   * @example
   * ```typescript
   * await cortex.facts.consolidate({
   *   memorySpaceId: 'space-1',
   *   factIds: ['fact-1', 'fact-2', 'fact-3'],
   *   keepFactId: 'fact-1',
   * });
   * ```
   */
  async consolidate(params) {
    validateMemorySpaceId2(params.memorySpaceId);
    validateStringArray(params.factIds, "factIds", false);
    validateRequiredString2(params.keepFactId, "keepFactId");
    validateConsolidation(params.factIds, params.keepFactId);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.facts.consolidate, {
        memorySpaceId: params.memorySpaceId,
        factIds: params.factIds,
        keepFactId: params.keepFactId
      }),
      "facts:consolidate"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Belief Revision Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Revise a fact using the belief revision pipeline
   *
   * This method intelligently determines whether a new fact should:
   * - CREATE: Add as new fact (no conflicts)
   * - UPDATE: Merge with existing fact (refinement)
   * - SUPERSEDE: Replace existing fact (contradiction)
   * - NONE: Skip (duplicate)
   *
   * @example
   * ```typescript
   * const result = await cortex.facts.revise({
   *   memorySpaceId: 'space-1',
   *   fact: {
   *     fact: 'User prefers purple',
   *     subject: 'user-123',
   *     predicate: 'favorite color',
   *     object: 'purple',
   *     confidence: 90,
   *   },
   * });
   *
   * console.log(`Action: ${result.action}, Reason: ${result.reason}`);
   * ```
   */
  async revise(params) {
    validateMemorySpaceId2(params.memorySpaceId);
    validateRequiredString2(params.fact.fact, "fact.fact");
    validateConfidence(params.fact.confidence, "fact.confidence");
    if (!this.beliefRevisionService) {
      throw new Error(
        "Belief revision service not configured. Call configureBeliefRevision() first or provide LLM client in constructor."
      );
    }
    const result = await this.beliefRevisionService.revise(params);
    const historyAction = result.action === "NONE" ? "UPDATE" : result.action === "ADD" ? "CREATE" : result.action;
    await this.historyService.log({
      factId: result.fact.factId,
      memorySpaceId: params.memorySpaceId,
      action: historyAction,
      oldValue: result.superseded[0]?.fact,
      newValue: result.fact.fact,
      supersededBy: result.action === "SUPERSEDE" ? result.fact.factId : void 0,
      supersedes: result.superseded[0]?.factId,
      reason: result.reason,
      confidence: result.confidence,
      pipeline: {
        slotMatching: result.pipeline.slotMatching?.executed,
        semanticMatching: result.pipeline.semanticMatching?.executed,
        llmResolution: result.pipeline.llmResolution?.executed
      },
      userId: params.userId,
      participantId: params.participantId
    });
    return result;
  }
  /**
   * Check for conflicts without executing (preview mode)
   *
   * Useful for showing users what would happen before committing.
   *
   * @example
   * ```typescript
   * const conflicts = await cortex.facts.checkConflicts({
   *   memorySpaceId: 'space-1',
   *   fact: {
   *     fact: 'User prefers purple',
   *     subject: 'user-123',
   *     predicate: 'favorite color',
   *     object: 'purple',
   *     confidence: 90,
   *   },
   * });
   *
   * if (conflicts.hasConflicts) {
   *   console.log(`Found ${conflicts.slotConflicts.length} slot conflicts`);
   *   console.log(`Recommended action: ${conflicts.recommendedAction}`);
   * }
   * ```
   */
  async checkConflicts(params) {
    validateMemorySpaceId2(params.memorySpaceId);
    validateRequiredString2(params.fact.fact, "fact.fact");
    validateConfidence(params.fact.confidence, "fact.confidence");
    if (!this.beliefRevisionService) {
      throw new Error(
        "Belief revision service not configured. Call configureBeliefRevision() first or provide LLM client in constructor."
      );
    }
    return this.beliefRevisionService.checkConflicts(params);
  }
  /**
   * Manually supersede a fact
   *
   * Marks an existing fact as superseded by a new fact.
   * This creates an audit trail and maintains history.
   *
   * @example
   * ```typescript
   * await cortex.facts.supersede({
   *   memorySpaceId: 'space-1',
   *   oldFactId: 'fact-old',
   *   newFactId: 'fact-new',
   *   reason: 'User explicitly corrected this information',
   * });
   * ```
   */
  async supersede(params) {
    validateMemorySpaceId2(params.memorySpaceId);
    validateRequiredString2(params.oldFactId, "oldFactId");
    validateFactIdFormat(params.oldFactId);
    validateRequiredString2(params.newFactId, "newFactId");
    validateFactIdFormat(params.newFactId);
    const [oldFact, newFact] = await Promise.all([
      this.get(params.memorySpaceId, params.oldFactId),
      this.get(params.memorySpaceId, params.newFactId)
    ]);
    if (!oldFact) {
      throw new Error(`Old fact not found: ${params.oldFactId}`);
    }
    if (!newFact) {
      throw new Error(`New fact not found: ${params.newFactId}`);
    }
    await this.update(params.memorySpaceId, params.oldFactId, {
      validUntil: Date.now()
    });
    await this.historyService.log({
      factId: params.oldFactId,
      memorySpaceId: params.memorySpaceId,
      action: "SUPERSEDE",
      oldValue: oldFact.fact,
      newValue: newFact.fact,
      supersededBy: params.newFactId,
      reason: params.reason || "Manual supersession"
    });
    return {
      superseded: true,
      oldFactId: params.oldFactId,
      newFactId: params.newFactId
    };
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // History Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Get change history for a fact
   *
   * Returns the audit trail of all changes to a fact.
   *
   * @example
   * ```typescript
   * const history = await cortex.facts.history('fact-123');
   * for (const event of history) {
   *   console.log(`${event.action} at ${new Date(event.timestamp)}: ${event.reason}`);
   * }
   * ```
   */
  async history(factId, limit) {
    validateRequiredString2(factId, "factId");
    validateFactIdFormat(factId);
    return this.historyService.getHistory(factId, limit);
  }
  /**
   * Get change events for a memory space in a time range
   *
   * @example
   * ```typescript
   * const changes = await cortex.facts.getChanges({
   *   memorySpaceId: 'space-1',
   *   after: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
   *   action: 'SUPERSEDE',
   * });
   * ```
   */
  async getChanges(filter) {
    validateMemorySpaceId2(filter.memorySpaceId);
    return this.historyService.getChanges(filter);
  }
  /**
   * Get the supersession chain for a fact
   *
   * Shows the evolution of knowledge over time.
   *
   * @example
   * ```typescript
   * const chain = await cortex.facts.getSupersessionChain('fact-latest');
   * // Returns: [oldest] -> [older] -> [old] -> [current]
   * ```
   */
  async getSupersessionChain(factId) {
    validateRequiredString2(factId, "factId");
    validateFactIdFormat(factId);
    return this.historyService.getSupersessionChain(factId);
  }
  /**
   * Get activity summary for a memory space
   *
   * @example
   * ```typescript
   * const summary = await cortex.facts.getActivitySummary('space-1', 24); // Last 24 hours
   * console.log(`Total events: ${summary.totalEvents}`);
   * console.log(`Creates: ${summary.actionCounts.CREATE}`);
   * ```
   */
  async getActivitySummary(memorySpaceId, hours) {
    validateMemorySpaceId2(memorySpaceId);
    return this.historyService.getActivitySummary(memorySpaceId, hours);
  }
};

// src/memory/index.ts
init_deduplication2();

// src/config.ts
var MODEL_DEFAULTS = {
  factExtraction: {
    openai: "gpt-4o-2024-11-20",
    anthropic: "claude-3-haiku-20240307"
  },
  conflictResolution: {
    openai: "gpt-4o-2024-11-20",
    anthropic: "claude-3-haiku-20240307"
  },
  embedding: "text-embedding-3-small"
};
function resolveFactExtractionModel(configModel, provider = "openai") {
  return configModel || runtimeEnv.CORTEX_FACT_EXTRACTION_MODEL || MODEL_DEFAULTS.factExtraction[provider];
}
function resolveConflictResolutionModel(configModel, provider = "openai") {
  return configModel || runtimeEnv.CORTEX_CONFLICT_RESOLUTION_MODEL || runtimeEnv.CORTEX_FACT_EXTRACTION_MODEL || MODEL_DEFAULTS.conflictResolution[provider];
}
function resolveEmbeddingModel(configModel) {
  return configModel || runtimeEnv.CORTEX_EMBEDDING_MODEL || MODEL_DEFAULTS.embedding;
}
function parseEnvInt(envVar, defaultValue) {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
var RECALL_DEFAULTS = {
  memories: parseEnvInt(runtimeEnv.CORTEX_RECALL_LIMIT_MEMORIES, 20),
  facts: parseEnvInt(runtimeEnv.CORTEX_RECALL_LIMIT_FACTS, 15),
  graphHops: parseEnvInt(runtimeEnv.CORTEX_RECALL_GRAPH_HOPS, 2),
  graphEntitiesPerHop: parseEnvInt(
    runtimeEnv.CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP,
    5
  ),
  graphResultsPerEntity: parseEnvInt(
    runtimeEnv.CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY,
    3
  ),
  total: parseEnvInt(runtimeEnv.CORTEX_RECALL_LIMIT_TOTAL, 30)
};
function resolveRecallLimits(userLimits, legacyLimit) {
  const resolved = { ...RECALL_DEFAULTS };
  if (userLimits) {
    if (userLimits.memories !== void 0) {
      resolved.memories = userLimits.memories;
    }
    if (userLimits.facts !== void 0) {
      resolved.facts = userLimits.facts;
    }
    if (userLimits.graphHops !== void 0) {
      resolved.graphHops = userLimits.graphHops;
    }
    if (userLimits.graphEntitiesPerHop !== void 0) {
      resolved.graphEntitiesPerHop = userLimits.graphEntitiesPerHop;
    }
    if (userLimits.graphResultsPerEntity !== void 0) {
      resolved.graphResultsPerEntity = userLimits.graphResultsPerEntity;
    }
    if (userLimits.total !== void 0) {
      resolved.total = userLimits.total;
    }
  }
  if (legacyLimit !== void 0 && userLimits?.total === void 0) {
    resolved.total = legacyLimit;
  }
  return resolved;
}

// src/domain/extraction.ts
var EXTRACTION_SYSTEM_PROMPT = `You are a fact and entity extraction assistant. Extract key facts from conversations that should be remembered long-term, along with the named entities mentioned.

Guidelines:
- Focus on user preferences, attributes, decisions, events, and relationships
- Write facts in third-person, present tense (e.g., "User prefers X")
- Be specific and actionable
- One fact = one statement
- Avoid redundancy
- Only extract facts that are explicitly stated or strongly implied
- Assign confidence based on how clearly the fact was stated (0.5-1.0)

For each fact, determine the type:
- preference: User likes/dislikes, preferred tools/methods
- identity: Personal attributes, name, role, location
- knowledge: Skills, expertise, domain knowledge
- relationship: Connections to people, organizations, projects
- event: Things that happened, milestones, decisions made
- observation: General observations about user behavior
- custom: Other important facts

Entity Extraction:
- Extract all named entities mentioned (people, organizations, places, products)
- Classify each entity by type: person, organization, place, product, concept, other
- If an entity is abbreviated, provide the full value (e.g., "SF" \u2192 fullValue: "San Francisco")

Relation Extraction:
- Extract subject-predicate-object triples that describe relationships between entities
- Use snake_case for predicates (e.g., "works_at", "located_in", "prefers")
- Each relation should connect two entities mentioned in the conversation`;
function buildExtractionPrompt(userMessage, agentResponse) {
  return `Extract facts and entities from this conversation:

User: ${userMessage}
Agent: ${agentResponse}

Return ONLY a JSON object with a "facts" array. Each fact should have:
- fact: The fact statement (clear, third-person, present tense)
- factType: One of "preference", "identity", "knowledge", "relationship", "event", "observation", "custom"
- confidence: Your confidence this is meaningful (0.5-1.0)
- subject: The entity the fact is about (REQUIRED - use "User" if about the user)
- predicate: The relationship or action (REQUIRED - use snake_case like "prefers", "is_named", "works_at")
- object: The target of the relationship (REQUIRED - the value or entity)
- tags: Array of relevant tags (can be empty [])
- entities: Array of ALL named entities mentioned in this fact (REQUIRED, can be empty []), each with:
  - name: Entity name as mentioned
  - type: One of "person", "organization", "place", "product", "concept", "other"
  - fullValue: Full name if abbreviated (omit if not abbreviated)
- relations: Array of entity relationships extracted from this fact (REQUIRED, can be empty []), each with:
  - subject: Subject entity name
  - predicate: Relationship type in snake_case (e.g., "works_at", "located_in")
  - object: Object entity name

Example response:
{
  "facts": [
    {
      "fact": "Sarah works at Planet Granite in San Francisco",
      "factType": "knowledge",
      "confidence": 0.95,
      "subject": "Sarah",
      "predicate": "works_at",
      "object": "Planet Granite",
      "tags": ["work", "location"],
      "entities": [
        { "name": "Sarah", "type": "person" },
        { "name": "Planet Granite", "type": "organization" },
        { "name": "San Francisco", "type": "place" }
      ],
      "relations": [
        { "subject": "Sarah", "predicate": "works_at", "object": "Planet Granite" },
        { "subject": "Planet Granite", "predicate": "located_in", "object": "San Francisco" }
      ]
    }
  ]
}

If no meaningful facts can be extracted, return: {"facts": []}`;
}
function parseEntity(e) {
  if (typeof e !== "object" || e === null) return null;
  const entity = e;
  if (typeof entity.name !== "string" || !entity.name.trim()) return null;
  const validTypes = [
    "person",
    "organization",
    "place",
    "product",
    "concept",
    "other"
  ];
  const entityType = typeof entity.type === "string" && validTypes.includes(entity.type) ? entity.type : "other";
  return {
    name: entity.name.trim(),
    type: entityType,
    fullValue: typeof entity.fullValue === "string" ? entity.fullValue : void 0
  };
}
function parseRelation(r) {
  if (typeof r !== "object" || r === null) return null;
  const relation = r;
  if (typeof relation.subject !== "string" || typeof relation.predicate !== "string" || typeof relation.object !== "string") {
    return null;
  }
  return {
    subject: relation.subject.trim(),
    predicate: relation.predicate.trim().toLowerCase().replace(/\s+/g, "_"),
    object: relation.object.trim()
  };
}
function parseFactsResponse(content) {
  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(jsonStr);
    const facts = typeof parsed === "object" && parsed !== null && "facts" in parsed ? parsed.facts || parsed : parsed;
    if (!Array.isArray(facts)) {
      return null;
    }
    return facts.filter((f) => {
      if (typeof f !== "object" || f === null) return false;
      const fact = f;
      return typeof fact.fact === "string" && typeof fact.factType === "string";
    }).map((f) => {
      const entities = Array.isArray(
        f.entities
      ) ? f.entities.map(parseEntity).filter((e) => e !== null) : void 0;
      const relations = Array.isArray(
        f.relations
      ) ? f.relations.map(parseRelation).filter((r) => r !== null) : void 0;
      return {
        fact: f.fact,
        factType: normalizeFactType(f.factType),
        confidence: typeof f.confidence === "number" && Number.isFinite(f.confidence) ? Math.min(1, Math.max(0, f.confidence)) : 0.7,
        subject: typeof f.subject === "string" ? f.subject : void 0,
        predicate: typeof f.predicate === "string" ? f.predicate : void 0,
        object: typeof f.object === "string" ? f.object : void 0,
        tags: Array.isArray(f.tags) ? f.tags.filter((t) => typeof t === "string") : void 0,
        entities: entities && entities.length > 0 ? entities : void 0,
        relations: relations && relations.length > 0 ? relations : void 0
      };
    });
  } catch {
    return null;
  }
}
function normalizeFactType(type) {
  const validTypes = [
    "preference",
    "identity",
    "knowledge",
    "relationship",
    "event",
    "observation",
    "custom"
  ];
  const normalized = type.toLowerCase().trim();
  return validTypes.includes(normalized) ? normalized : "custom";
}

// src/llm/index.ts
async function loadOpenAI() {
  if (typeof require !== "undefined") {
    try {
      const mod = require("openai");
      return mod.default || mod;
    } catch {
    }
  }
  return (await import("openai")).default;
}
async function loadAnthropic() {
  if (typeof require !== "undefined") {
    try {
      const mod = require("@anthropic-ai/sdk");
      return mod.default || mod;
    } catch {
    }
  }
  return (await import("@anthropic-ai/sdk")).default;
}
var OpenAIClient = class {
  config;
  constructor(config) {
    this.config = config;
  }
  async extractFacts(userMessage, agentResponse) {
    try {
      const OpenAI = await loadOpenAI();
      const client = new OpenAI({ apiKey: this.config.apiKey });
      const model = resolveFactExtractionModel(this.config.model, "openai");
      const isO1Model = model.startsWith("o1");
      const isGpt5Model = model.startsWith("gpt-5");
      const messages = [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildExtractionPrompt(userMessage, agentResponse)
        }
      ];
      let response;
      if (isO1Model) {
        response = await client.chat.completions.create({
          model,
          messages
        });
      } else if (isGpt5Model) {
        response = await client.chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" }
        });
      } else {
        response = await client.chat.completions.create({
          model,
          messages,
          temperature: this.config.temperature ?? 0.1,
          max_tokens: this.config.maxTokens ?? 1e3,
          response_format: { type: "json_object" }
        });
      }
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        console.warn("[Cortex LLM] OpenAI returned empty response");
        return null;
      }
      return parseFactsResponse(content);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Cannot find module")) {
        console.error(
          "[Cortex LLM] OpenAI SDK not installed. Run: npm install openai"
        );
      } else {
        console.error("[Cortex LLM] OpenAI extraction failed:", error);
      }
      return null;
    }
  }
  /**
   * General completion for belief revision conflict resolution
   */
  async complete(options) {
    const OpenAI = await loadOpenAI();
    const client = new OpenAI({ apiKey: this.config.apiKey });
    const model = options.model || resolveConflictResolutionModel(this.config.model, "openai");
    const isO1Model = model.startsWith("o1");
    const isGpt5Model = model.startsWith("gpt-5");
    const messages = [
      { role: "system", content: options.system },
      { role: "user", content: options.prompt }
    ];
    let response;
    if (isO1Model) {
      response = await client.chat.completions.create({
        model,
        messages
      });
    } else if (isGpt5Model) {
      const requestOptions = {
        model,
        messages
      };
      if (options.responseFormat === "json") {
        requestOptions.response_format = { type: "json_object" };
      }
      response = await client.chat.completions.create(requestOptions);
    } else {
      const requestOptions = {
        model,
        messages,
        temperature: this.config.temperature ?? 0.1,
        max_tokens: this.config.maxTokens ?? 2e3
      };
      if (options.responseFormat === "json") {
        requestOptions.response_format = { type: "json_object" };
      }
      response = await client.chat.completions.create(requestOptions);
    }
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("[Cortex LLM] OpenAI returned empty response");
    }
    return content;
  }
};
var AnthropicClient = class {
  config;
  constructor(config) {
    this.config = config;
  }
  async extractFacts(userMessage, agentResponse) {
    try {
      const Anthropic = await loadAnthropic();
      const client = new Anthropic({ apiKey: this.config.apiKey });
      const model = resolveFactExtractionModel(this.config.model, "anthropic");
      const response = await client.messages.create({
        model,
        max_tokens: this.config.maxTokens ?? 1e3,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildExtractionPrompt(userMessage, agentResponse) + "\n\nRespond with ONLY the JSON object, no other text."
          }
        ],
        temperature: this.config.temperature ?? 0.1
      });
      const textBlock = response.content.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (block) => block.type === "text"
      );
      if (!textBlock || textBlock.type !== "text") {
        console.warn("[Cortex LLM] Anthropic returned no text content");
        return null;
      }
      return parseFactsResponse(textBlock.text);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Cannot find module")) {
        console.error(
          "[Cortex LLM] Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk"
        );
      } else {
        console.error("[Cortex LLM] Anthropic extraction failed:", error);
      }
      return null;
    }
  }
  /**
   * General completion for belief revision conflict resolution
   */
  async complete(options) {
    const Anthropic = await loadAnthropic();
    const client = new Anthropic({ apiKey: this.config.apiKey });
    const model = options.model || resolveConflictResolutionModel(this.config.model, "anthropic");
    const response = await client.messages.create({
      model,
      max_tokens: this.config.maxTokens ?? 2e3,
      system: options.system,
      messages: [
        {
          role: "user",
          content: options.responseFormat === "json" ? options.prompt + "\n\nRespond with ONLY a JSON object, no other text." : options.prompt
        }
      ],
      temperature: this.config.temperature ?? 0.1
    });
    const textBlock = response.content.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (block) => block.type === "text"
    );
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("[Cortex LLM] Anthropic returned no text content");
    }
    return textBlock.text;
  }
};
function createLLMClient(config) {
  switch (config.provider) {
    case "openai":
      return new OpenAIClient(config);
    case "anthropic":
      return new AnthropicClient(config);
    case "custom":
      if (config.extractFacts) {
        return {
          extractFacts: config.extractFacts
        };
      }
      console.warn(
        "[Cortex LLM] Custom provider requires extractFacts function in config"
      );
      return null;
    default:
      console.warn(`[Cortex LLM] Unknown provider: ${config.provider}`);
      return null;
  }
}

// src/memory/validators.ts
var MemoryValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "MemoryValidationError";
  }
};
function validateMemorySpaceId3(memorySpaceId, fieldName = "memorySpaceId") {
  if (typeof memorySpaceId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (memorySpaceId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateMemoryId2(memoryId, fieldName = "memoryId") {
  if (typeof memoryId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (memoryId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateUserId4(userId, fieldName = "userId") {
  if (typeof userId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (userId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateConversationId(conversationId, fieldName = "conversationId") {
  if (typeof conversationId !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (conversationId.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validateContent(content, fieldName = "content") {
  if (typeof content !== "string") {
    throw new MemoryValidationError(
      `${fieldName} is required and must be a string`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
  if (content.trim().length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
var VALID_CONTENT_TYPES2 = ["raw", "summarized", "fact"];
function validateContentType2(contentType) {
  if (!VALID_CONTENT_TYPES2.includes(contentType)) {
    throw new MemoryValidationError(
      `Invalid contentType "${contentType}". Valid types: ${VALID_CONTENT_TYPES2.join(", ")}`,
      "INVALID_FORMAT",
      "contentType"
    );
  }
}
var VALID_SOURCE_TYPES3 = ["conversation", "system", "tool", "a2a"];
function validateSourceType3(sourceType) {
  if (!VALID_SOURCE_TYPES3.includes(sourceType)) {
    throw new MemoryValidationError(
      `Invalid sourceType "${sourceType}". Valid types: ${VALID_SOURCE_TYPES3.join(", ")}`,
      "INVALID_SOURCE_TYPE",
      "sourceType"
    );
  }
}
var VALID_EXPORT_FORMATS3 = ["json", "csv"];
function validateExportFormat4(format) {
  if (!VALID_EXPORT_FORMATS3.includes(format)) {
    throw new MemoryValidationError(
      `Invalid format "${format}". Valid formats: ${VALID_EXPORT_FORMATS3.join(", ")}`,
      "INVALID_FORMAT",
      "format"
    );
  }
}
function validateImportance2(importance, fieldName = "importance") {
  if (typeof importance !== "number" || isNaN(importance)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "INVALID_IMPORTANCE",
      fieldName
    );
  }
  if (importance < 0 || importance > 100) {
    throw new MemoryValidationError(
      `${fieldName} must be between 0 and 100, got ${importance}`,
      "INVALID_IMPORTANCE",
      fieldName
    );
  }
}
function validateVersion3(version, fieldName = "version") {
  if (typeof version !== "number" || isNaN(version)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "NEGATIVE_NUMBER",
      fieldName
    );
  }
  if (version < 1 || !Number.isInteger(version)) {
    throw new MemoryValidationError(
      `${fieldName} must be a positive integer >= 1, got ${version}`,
      "NEGATIVE_NUMBER",
      fieldName
    );
  }
}
function validateLimit5(limit, fieldName = "limit") {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "NEGATIVE_NUMBER",
      fieldName
    );
  }
  if (limit < 1) {
    throw new MemoryValidationError(
      `${fieldName} must be a positive integer >= 1, got ${limit}`,
      "NEGATIVE_NUMBER",
      fieldName
    );
  }
}
function validateTimestamp4(timestamp, fieldName = "timestamp") {
  if (timestamp instanceof Date) {
    if (isNaN(timestamp.getTime())) {
      throw new MemoryValidationError(
        `${fieldName} is an invalid Date object`,
        "INVALID_TIMESTAMP",
        fieldName
      );
    }
    return;
  }
  if (typeof timestamp !== "number" || isNaN(timestamp)) {
    throw new MemoryValidationError(
      `${fieldName} must be a valid timestamp (number) or Date object`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
  if (timestamp < 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be negative, got ${timestamp}`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
}
function validateMinScore2(minScore, fieldName = "minScore") {
  if (typeof minScore !== "number" || isNaN(minScore)) {
    throw new MemoryValidationError(
      `${fieldName} must be a number`,
      "INVALID_FORMAT",
      fieldName
    );
  }
  if (minScore < 0 || minScore > 1) {
    throw new MemoryValidationError(
      `${fieldName} must be between 0 and 1 (similarity score), got ${minScore}`,
      "INVALID_FORMAT",
      fieldName
    );
  }
}
function validateEmbedding2(embedding, fieldName = "embedding") {
  if (!Array.isArray(embedding)) {
    throw new MemoryValidationError(
      `${fieldName} must be an array of numbers`,
      "INVALID_EMBEDDING",
      fieldName
    );
  }
  if (embedding.length === 0) {
    throw new MemoryValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_EMBEDDING",
      fieldName
    );
  }
  for (let i = 0; i < embedding.length; i++) {
    const value = embedding[i];
    if (typeof value !== "number" || !isFinite(value)) {
      throw new MemoryValidationError(
        `${fieldName}[${i}] must be a finite number, got ${value}`,
        "INVALID_EMBEDDING",
        fieldName
      );
    }
  }
}
function validateTags2(tags, fieldName = "tags") {
  if (!Array.isArray(tags)) {
    throw new MemoryValidationError(
      `${fieldName} must be an array`,
      "INVALID_FORMAT",
      fieldName
    );
  }
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof tag !== "string" || tag.trim().length === 0) {
      throw new MemoryValidationError(
        `${fieldName}[${i}] must be a non-empty string`,
        "INVALID_FORMAT",
        fieldName
      );
    }
  }
}
function validateStoreMemoryInput(input) {
  validateContent(input.content);
  validateContentType2(input.contentType);
  if (!input.source || typeof input.source !== "object") {
    throw new MemoryValidationError(
      "source is required and must be an object",
      "MISSING_REQUIRED_FIELD",
      "source"
    );
  }
  validateSourceType3(input.source.type);
  if (!input.metadata || typeof input.metadata !== "object") {
    throw new MemoryValidationError(
      "metadata is required and must be an object",
      "MISSING_REQUIRED_FIELD",
      "metadata"
    );
  }
  validateImportance2(input.metadata.importance);
  validateTags2(input.metadata.tags);
  if (input.embedding !== void 0) {
    validateEmbedding2(input.embedding);
  }
  if (input.userId !== void 0) {
    validateUserId4(input.userId, "userId");
  }
  if (input.participantId !== void 0) {
    if (typeof input.participantId !== "string" || input.participantId.trim().length === 0) {
      throw new MemoryValidationError(
        "participantId must be a non-empty string if provided",
        "INVALID_FORMAT",
        "participantId"
      );
    }
  }
}
function validateSearchOptions2(options) {
  if (options.embedding !== void 0) {
    validateEmbedding2(options.embedding);
  }
  if (options.minScore !== void 0) {
    validateMinScore2(options.minScore);
  }
  if (options.limit !== void 0) {
    validateLimit5(options.limit);
  }
  if (options.tags) {
    validateTags2(options.tags);
  }
  if (options.minImportance !== void 0) {
    validateImportance2(options.minImportance, "minImportance");
  }
  if (options.userId !== void 0) {
    validateUserId4(options.userId, "userId");
  }
  if (options.sourceType !== void 0) {
    validateSourceType3(options.sourceType);
  }
}
function validateUpdateOptions(updates) {
  const hasUpdates = updates.content !== void 0 || updates.embedding !== void 0 || updates.importance !== void 0 || updates.tags !== void 0;
  if (!hasUpdates) {
    throw new MemoryValidationError(
      "At least one update field must be provided (content, embedding, importance, or tags)",
      "INVALID_FORMAT"
    );
  }
  if (updates.content !== void 0) {
    validateContent(updates.content);
  }
  if (updates.embedding !== void 0) {
    validateEmbedding2(updates.embedding);
  }
  if (updates.importance !== void 0) {
    validateImportance2(updates.importance);
  }
  if (updates.tags !== void 0) {
    validateTags2(updates.tags);
  }
}
function validateConversationRefRequirement(sourceType, conversationRef) {
  if (sourceType === "conversation" && !conversationRef) {
    throw new MemoryValidationError(
      'conversationRef is required when source.type is "conversation"',
      "MISSING_CONVERSATION_REF",
      "conversationRef"
    );
  }
}
function validateStreamObject(stream) {
  if (!stream || typeof stream !== "object") {
    throw new MemoryValidationError(
      "responseStream must be a ReadableStream or AsyncIterable object",
      "INVALID_STREAM",
      "responseStream"
    );
  }
  const hasReader = "getReader" in stream;
  const hasIterator = Symbol.asyncIterator in stream || Symbol.iterator in stream;
  if (!hasReader && !hasIterator) {
    throw new MemoryValidationError(
      "responseStream must be a ReadableStream (with getReader) or AsyncIterable (with Symbol.asyncIterator)",
      "INVALID_STREAM",
      "responseStream"
    );
  }
}
function validateFilterCombination(filter) {
  const hasAdditionalFilter = filter.userId !== void 0 || filter.sourceType !== void 0;
  if (!hasAdditionalFilter) {
    throw new MemoryValidationError(
      "Filter must include at least one criterion (userId or sourceType) in addition to memorySpaceId to prevent accidental mass deletion",
      "INVALID_FILTER"
    );
  }
}
function validateRecallParams(params) {
  validateMemorySpaceId3(params.memorySpaceId);
  validateContent(params.query, "query");
  if (params.embedding !== void 0) {
    validateEmbedding2(params.embedding);
  }
  if (params.userId !== void 0) {
    validateUserId4(params.userId, "userId");
  }
  if (params.minImportance !== void 0) {
    validateImportance2(params.minImportance, "minImportance");
  }
  if (params.minConfidence !== void 0) {
    if (typeof params.minConfidence !== "number" || params.minConfidence < 0 || params.minConfidence > 100) {
      throw new MemoryValidationError(
        "minConfidence must be a number between 0 and 100",
        "INVALID_CONFIDENCE",
        "minConfidence"
      );
    }
  }
  if (params.tags !== void 0) {
    validateTags2(params.tags);
  }
  if (params.limit !== void 0) {
    validateLimit5(params.limit);
  }
  if (params.createdAfter && params.createdBefore) {
    const after = params.createdAfter instanceof Date ? params.createdAfter.getTime() : params.createdAfter;
    const before = params.createdBefore instanceof Date ? params.createdBefore.getTime() : params.createdBefore;
    if (after > before) {
      throw new MemoryValidationError(
        "createdAfter must be before createdBefore",
        "INVALID_DATE_RANGE",
        "createdAfter/createdBefore"
      );
    }
  }
  if (params.graphExpansion !== void 0) {
    const ge = params.graphExpansion;
    if (ge.maxDepth !== void 0) {
      if (typeof ge.maxDepth !== "number" || ge.maxDepth < 1 || ge.maxDepth > 5) {
        throw new MemoryValidationError(
          "graphExpansion.maxDepth must be a number between 1 and 5",
          "INVALID_GRAPH_DEPTH",
          "graphExpansion.maxDepth"
        );
      }
    }
    if (ge.relationshipTypes !== void 0) {
      if (!Array.isArray(ge.relationshipTypes)) {
        throw new MemoryValidationError(
          "graphExpansion.relationshipTypes must be an array of strings",
          "INVALID_FORMAT",
          "graphExpansion.relationshipTypes"
        );
      }
      for (const type of ge.relationshipTypes) {
        if (typeof type !== "string" || type.trim().length === 0) {
          throw new MemoryValidationError(
            "graphExpansion.relationshipTypes must contain non-empty strings",
            "INVALID_FORMAT",
            "graphExpansion.relationshipTypes"
          );
        }
      }
    }
  }
}

// src/memory/recall/graphEnhancement.ts
function extractEntitiesFromResults(memories, facts) {
  const entities = /* @__PURE__ */ new Set();
  for (const fact of facts) {
    if (fact.subject) {
      entities.add(fact.subject);
    }
    if (fact.object) {
      entities.add(fact.object);
    }
    if (fact.entities) {
      for (const entity of fact.entities) {
        entities.add(entity.name);
      }
    }
  }
  for (const memory of memories) {
    if (memory.userId) {
      entities.add(memory.userId);
    }
    if (memory.factCategory) {
      entities.add(memory.factCategory);
    }
  }
  return Array.from(entities).filter(
    (e) => e && e.trim().length > 0 && e.length < 100
  );
}
async function extractEntitiesFromQuery(query, graphAdapter) {
  if (!graphAdapter || !query || query.trim().length === 0) {
    return [];
  }
  try {
    const isConnected = await graphAdapter.isConnected();
    if (!isConnected) {
      return [];
    }
    const matchedEntities = [];
    const words = query.toLowerCase().replace(/[^\w\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const candidates = /* @__PURE__ */ new Set();
    for (const word of words) {
      const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      candidates.add(capitalized);
      candidates.add(word);
    }
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words.slice(i, i + 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      candidates.add(phrase);
    }
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      candidates.add(phrase);
    }
    const candidateArray = Array.from(candidates).slice(0, 20);
    for (const candidate of candidateArray) {
      try {
        const entityNodes = await graphAdapter.findNodes(
          "Entity",
          { name: candidate },
          1
        );
        if (entityNodes.length > 0) {
          matchedEntities.push(candidate);
        }
      } catch {
        continue;
      }
    }
    return matchedEntities;
  } catch {
    return [];
  }
}
async function expandViaGraph(initialEntities, graphAdapter, config) {
  if (!graphAdapter || initialEntities.length === 0) {
    return [];
  }
  const discoveredEntities = /* @__PURE__ */ new Set();
  try {
    const isConnected = await graphAdapter.isConnected();
    if (!isConnected) {
      return [];
    }
    const maxEntities = config.entitiesPerHop ?? 5;
    for (const entityName of initialEntities.slice(0, maxEntities)) {
      try {
        const entityNodes = await graphAdapter.findNodes(
          "Entity",
          { name: entityName },
          1
        );
        if (entityNodes.length === 0) {
          continue;
        }
        const entityNode = entityNodes[0];
        if (!entityNode.id) {
          continue;
        }
        const connectedNodes = await graphAdapter.traverse({
          startId: entityNode.id,
          maxDepth: config.maxDepth,
          relationshipTypes: config.relationshipTypes.length > 0 ? config.relationshipTypes : void 0,
          direction: "BOTH"
        });
        for (const node of connectedNodes) {
          if (node.label === "Entity" && node.properties?.name) {
            discoveredEntities.add(node.properties.name);
          }
        }
      } catch {
        continue;
      }
    }
    for (const initial of initialEntities) {
      discoveredEntities.delete(initial);
    }
    return Array.from(discoveredEntities);
  } catch {
    return [];
  }
}
async function fetchRelatedMemories(discoveredEntities, memorySpaceId, vectorAPI, processedIds, limit = 10) {
  if (discoveredEntities.length === 0) {
    return [];
  }
  const relatedMemories = [];
  try {
    for (const entity of discoveredEntities.slice(0, 5)) {
      try {
        const memories = await vectorAPI.search(memorySpaceId, entity, {
          limit: Math.ceil(limit / 5),
          // Distribute limit across entities
          minScore: 0.5
          // Reasonable relevance threshold
        });
        for (const memory of memories) {
          if (processedIds.has(memory.memoryId)) {
            continue;
          }
          relatedMemories.push(memory);
          processedIds.add(memory.memoryId);
          if (relatedMemories.length >= limit) {
            break;
          }
        }
        if (relatedMemories.length >= limit) {
          break;
        }
      } catch {
        continue;
      }
    }
    return relatedMemories;
  } catch {
    return [];
  }
}
async function fetchRelatedFacts(discoveredEntities, memorySpaceId, factsAPI, processedIds, limit = 10) {
  if (discoveredEntities.length === 0) {
    return [];
  }
  const relatedFacts = [];
  try {
    for (const entity of discoveredEntities.slice(0, 5)) {
      try {
        const subjectFacts = await factsAPI.queryBySubject({
          memorySpaceId,
          subject: entity,
          limit: Math.ceil(limit / 10)
        });
        for (const fact of subjectFacts) {
          if (processedIds.has(fact.factId)) {
            continue;
          }
          relatedFacts.push(fact);
          processedIds.add(fact.factId);
        }
        const searchFacts = await factsAPI.search(memorySpaceId, entity, {
          limit: Math.ceil(limit / 10)
        });
        for (const fact of searchFacts) {
          if (processedIds.has(fact.factId)) {
            continue;
          }
          relatedFacts.push(fact);
          processedIds.add(fact.factId);
        }
        if (relatedFacts.length >= limit) {
          break;
        }
      } catch {
        continue;
      }
    }
    return relatedFacts.slice(0, limit);
  } catch {
    return [];
  }
}
async function performGraphExpansion(initialMemories, initialFacts, memorySpaceId, graphAdapter, vectorAPI, factsAPI, config, queryText) {
  const processedIds = /* @__PURE__ */ new Set();
  for (const memory of initialMemories) {
    processedIds.add(memory.memoryId);
  }
  for (const fact of initialFacts) {
    processedIds.add(fact.factId);
  }
  if (!graphAdapter || !config.expandFromFacts || !config.expandFromMemories) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds
    };
  }
  const queryEntities = queryText ? await extractEntitiesFromQuery(queryText, graphAdapter) : [];
  const resultEntities = extractEntitiesFromResults(
    initialMemories,
    initialFacts
  );
  const allEntities = Array.from(
    /* @__PURE__ */ new Set([...queryEntities, ...resultEntities])
  );
  if (allEntities.length === 0) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds
    };
  }
  const discoveredEntities = await expandViaGraph(
    allEntities,
    graphAdapter,
    config
  );
  const maxEntities = config.entitiesPerHop ?? 5;
  const rawEntitiesToFetch = discoveredEntities.length > 0 ? discoveredEntities : allEntities;
  const entitiesToFetch = rawEntitiesToFetch.slice(0, maxEntities);
  if (entitiesToFetch.length === 0) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds
    };
  }
  const resultsPerEntity = config.resultsPerEntity ?? 3;
  const totalResultsLimit = entitiesToFetch.length * resultsPerEntity;
  const [relatedMemories, relatedFacts] = await Promise.all([
    config.expandFromMemories ? fetchRelatedMemories(
      entitiesToFetch,
      memorySpaceId,
      vectorAPI,
      processedIds,
      totalResultsLimit
    ) : Promise.resolve([]),
    config.expandFromFacts ? fetchRelatedFacts(
      entitiesToFetch,
      memorySpaceId,
      factsAPI,
      processedIds,
      totalResultsLimit
    ) : Promise.resolve([])
  ]);
  return {
    discoveredEntities: entitiesToFetch,
    relatedMemories,
    relatedFacts,
    processedIds
  };
}

// src/domain/recall.ts
var RANKING_WEIGHTS = {
  /** Weight for vector similarity score */
  semantic: 0.35,
  /** Weight for fact confidence (0-100 → 0-1) */
  confidence: 0.2,
  /** Weight for importance (0-100 → 0-1) */
  importance: 0.15,
  /** Weight for recency (time decay) */
  recency: 0.15,
  /** Weight for graph connectivity */
  graphConnectivity: 0.15
};
var SCORE_BOOSTS = {
  /** Boost for items with many graph connections */
  highlyConnected: 1.2,
  /** Boost for user messages (more likely to contain preferences) */
  userMessage: 1.1,
  /** Threshold for highly connected (number of entities) */
  highlyConnectedThreshold: 3
};
function memoryToRecallItem(memory, source, baseScore = 0.5) {
  return {
    type: "memory",
    id: memory.memoryId,
    content: memory.content,
    score: baseScore,
    source,
    memory,
    graphContext: {
      connectedEntities: []
    }
  };
}
function factToRecallItem(fact, source, baseScore = 0.5) {
  return {
    type: "fact",
    id: fact.factId,
    content: fact.fact,
    score: baseScore,
    source,
    fact,
    graphContext: {
      connectedEntities: fact.subject ? [fact.subject, ...fact.object ? [fact.object] : []] : []
    }
  };
}
function mergeResults(vectorMemories, directFacts, graphExpandedMemories, graphExpandedFacts, discoveredEntities = []) {
  const items = [];
  for (const memory of vectorMemories) {
    const item = memoryToRecallItem(memory, "vector", 0.7);
    items.push(item);
  }
  for (const fact of directFacts) {
    const item = factToRecallItem(fact, "facts", 0.7);
    items.push(item);
  }
  for (const memory of graphExpandedMemories) {
    const item = memoryToRecallItem(memory, "graph-expanded", 0.5);
    item.graphContext = {
      connectedEntities: discoveredEntities,
      relationshipPath: "graph-traversal"
    };
    items.push(item);
  }
  for (const fact of graphExpandedFacts) {
    const item = factToRecallItem(fact, "graph-expanded", 0.5);
    item.graphContext = {
      connectedEntities: [
        ...fact.subject ? [fact.subject] : [],
        ...fact.object ? [fact.object] : [],
        ...discoveredEntities
      ],
      relationshipPath: "graph-traversal"
    };
    items.push(item);
  }
  return items;
}
function deduplicateResults(items) {
  const seen = /* @__PURE__ */ new Map();
  for (const original of items) {
    const item = { ...original, graphContext: original.graphContext && {
      ...original.graphContext,
      connectedEntities: [...original.graphContext.connectedEntities]
    } };
    const existing = seen.get(item.id);
    if (!existing) {
      seen.set(item.id, item);
      continue;
    }
    if (existing.source !== "graph-expanded" && item.source === "graph-expanded") {
      existing.graphContext = {
        connectedEntities: [
          ...existing.graphContext?.connectedEntities || [],
          ...item.graphContext?.connectedEntities || []
        ],
        relationshipPath: existing.graphContext?.relationshipPath || item.graphContext?.relationshipPath
      };
      existing.score = Math.min(1, existing.score * 1.1);
      continue;
    }
    if (item.source !== "graph-expanded" && existing.source === "graph-expanded") {
      item.graphContext = {
        connectedEntities: [
          ...item.graphContext?.connectedEntities || [],
          ...existing.graphContext?.connectedEntities || []
        ],
        relationshipPath: item.graphContext?.relationshipPath || existing.graphContext?.relationshipPath
      };
      item.score = Math.min(1, item.score * 1.1);
      seen.set(item.id, item);
      continue;
    }
    if (item.score > existing.score) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}
function calculateRecencyScore(timestamp, now) {
  const ageMs = now - timestamp;
  const halfLifeMs = 30 * 24 * 60 * 60 * 1e3;
  return Math.pow(2, -ageMs / halfLifeMs);
}
function calculateConnectivityScore(connectedEntities) {
  const count = connectedEntities.length;
  return Math.min(1, Math.log2(count + 1) / Math.log2(11));
}
function rankResults(items, clock) {
  const now = clock.now();
  const scoredItems = items.map((item) => {
    let score = 0;
    const semanticScore = item.score || 0.5;
    score += semanticScore * RANKING_WEIGHTS.semantic;
    if (item.type === "fact" && item.fact) {
      const confidenceScore = item.fact.confidence / 100;
      score += confidenceScore * RANKING_WEIGHTS.confidence;
    } else {
      score += 0.8 * RANKING_WEIGHTS.confidence;
    }
    if (item.type === "memory" && item.memory) {
      const importanceScore = item.memory.importance / 100;
      score += importanceScore * RANKING_WEIGHTS.importance;
    } else if (item.type === "fact" && item.fact) {
      score += item.fact.confidence / 100 * RANKING_WEIGHTS.importance;
    }
    const timestamp = item.type === "memory" ? item.memory?.createdAt || now : item.fact?.createdAt || now;
    const recencyScore = calculateRecencyScore(timestamp, now);
    score += recencyScore * RANKING_WEIGHTS.recency;
    const connectedEntities = item.graphContext?.connectedEntities || [];
    const connectivityScore = calculateConnectivityScore(connectedEntities);
    score += connectivityScore * RANKING_WEIGHTS.graphConnectivity;
    if (connectedEntities.length > SCORE_BOOSTS.highlyConnectedThreshold) {
      score *= SCORE_BOOSTS.highlyConnected;
    }
    if (item.type === "memory" && item.memory?.messageRole === "user") {
      score *= SCORE_BOOSTS.userMessage;
    }
    return { ...item, score: Math.min(1, Math.max(0, score)) };
  });
  return scoredItems.sort((a, b) => b.score - a.score);
}
function formatRelativeTime(timestamp, now, clock) {
  const diffMs = now - timestamp;
  const diffSecs = Math.floor(diffMs / 1e3);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 30) {
    return clock.formatDate?.(timestamp) ?? new Date(timestamp).toISOString().slice(0, 10);
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else {
    return "just now";
  }
}
function formatFactForLLM(item, now, clock) {
  const fact = item.fact;
  if (!fact) {
    return `- ${item.content}`;
  }
  const parts = [];
  parts.push(`- ${item.content}`);
  const metadata = [];
  metadata.push(`confidence: ${fact.confidence}%`);
  if (fact.validFrom) {
    metadata.push(`established: ${formatRelativeTime(fact.validFrom, now, clock)}`);
  } else if (fact.createdAt) {
    metadata.push(`recorded: ${formatRelativeTime(fact.createdAt, now, clock)}`);
  }
  if (fact.supersededBy) {
    metadata.push("\u26A0\uFE0F SUPERSEDED - this information may be outdated");
  } else if (fact.supersedes) {
    metadata.push("\u2713 CURRENT - replaced previous value");
  }
  if (fact.validUntil) {
    if (fact.validUntil < now) {
      metadata.push("\u26A0\uFE0F EXPIRED");
    } else {
      metadata.push(`valid until: ${formatRelativeTime(fact.validUntil, now, clock)}`);
    }
  }
  return `${parts.join("")} (${metadata.join(", ")})`;
}
function formatForLLM(items, clock) {
  const now = clock.now();
  const facts = items.filter((i) => i.type === "fact");
  const memories = items.filter((i) => i.type === "memory");
  const sections = [];
  if (facts.length > 0) {
    const hasSupersessionInfo = facts.some(
      (item) => item.fact?.supersedes || item.fact?.supersededBy
    );
    let factsHeader = "### Known Facts";
    if (hasSupersessionInfo) {
      factsHeader += `
NOTE: Facts marked "\u2713 CURRENT" are the latest values and should be trusted.
Facts marked "\u26A0\uFE0F SUPERSEDED" have been replaced - do not use outdated information.`;
    }
    const factLines = facts.map((item) => formatFactForLLM(item, now, clock));
    sections.push(`${factsHeader}
${factLines.join("\n")}`);
  }
  if (memories.length > 0) {
    const memoryLines = memories.map((item) => {
      const role = item.memory?.messageRole || "unknown";
      return `[${role}]: ${item.content}`;
    });
    sections.push(`### Conversation History
${memoryLines.join("\n")}`);
  }
  if (sections.length === 0) {
    return "";
  }
  return `## Relevant Context

${sections.join("\n\n")}`;
}
function buildSourceBreakdown(vectorMemories, directFacts, graphExpandedMemories, graphExpandedFacts, discoveredEntities) {
  return {
    vector: {
      count: vectorMemories.length,
      items: vectorMemories
    },
    facts: {
      count: directFacts.length,
      items: directFacts
    },
    graph: {
      count: graphExpandedMemories.length + graphExpandedFacts.length,
      expandedEntities: discoveredEntities
    }
  };
}
function enrichWithConversations(items, conversationsMap) {
  return items.map((item) => {
    if (item.type !== "memory" || !item.memory?.conversationRef) {
      return item;
    }
    const convId = item.memory.conversationRef.conversationId;
    const conversation = conversationsMap.get(convId);
    if (!conversation) {
      return item;
    }
    const sourceMessages = conversation.messages.filter(
      (m) => item.memory.conversationRef.messageIds.includes(m.id)
    );
    return {
      ...item,
      conversation,
      sourceMessages
    };
  });
}
function processRecallResults(vectorMemories, directFacts, graphExpandedMemories, graphExpandedFacts, discoveredEntities, options, clock) {
  const merged = mergeResults(
    vectorMemories,
    directFacts,
    graphExpandedMemories,
    graphExpandedFacts,
    discoveredEntities
  );
  const deduped = deduplicateResults(merged);
  const ranked = rankResults(deduped, clock);
  const limited = options.limit ? ranked.slice(0, options.limit) : ranked;
  const sources = buildSourceBreakdown(
    vectorMemories,
    directFacts,
    graphExpandedMemories,
    graphExpandedFacts,
    discoveredEntities
  );
  const context = options.formatForLLM !== false ? formatForLLM(limited, clock) : void 0;
  return {
    items: limited,
    sources,
    context
  };
}

// src/memory/recall/resultProcessor.ts
var clientClock2 = { now: () => Date.now(), formatDate: (timestamp) => new Date(timestamp).toLocaleDateString() };
function processRecallResults2(vectorMemories, directFacts, graphExpandedMemories, graphExpandedFacts, discoveredEntities, options = {}, clock = clientClock2) {
  return processRecallResults(vectorMemories, directFacts, graphExpandedMemories, graphExpandedFacts, discoveredEntities, options, clock);
}

// src/memory/index.ts
var DEFAULT_MEMORY_SPACE_ID = "default";
var MemoryAPI = class {
  client;
  conversations;
  vector;
  facts;
  graphAdapter;
  resilience;
  // Dependencies for orchestration
  memorySpacesAPI;
  usersAPI;
  agentsAPI;
  llmConfig;
  embeddingConfig;
  authContext;
  llmClient;
  // Cached embedding generator function (created from config)
  embeddingGenerator;
  constructor(client, graphAdapter, resilience, dependencies) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.memorySpacesAPI = dependencies?.memorySpaces;
    this.usersAPI = dependencies?.users;
    this.agentsAPI = dependencies?.agents;
    this.llmConfig = dependencies?.llm;
    this.embeddingConfig = dependencies?.embedding;
    this.authContext = dependencies?.authContext;
    if (this.embeddingConfig) {
      this.embeddingGenerator = this.createEmbeddingGenerator(this.embeddingConfig);
    }
    this.conversations = new ConversationsAPI(
      client,
      graphAdapter,
      resilience,
      this.authContext
    );
    this.vector = new VectorAPI(client, graphAdapter, resilience);
    let beliefRevisionLLMClient;
    if (this.llmConfig) {
      const llmClient = createLLMClient(this.llmConfig);
      if (llmClient?.complete) {
        beliefRevisionLLMClient = {
          complete: (opts) => llmClient.complete(opts)
        };
      }
    }
    this.facts = new FactsAPI(
      client,
      graphAdapter,
      resilience,
      this.authContext,
      beliefRevisionLLMClient
    );
  }
  /**
   * Create an embedding generator function from config (v0.30.0+)
   *
   * Enables batteries-included semantic search by auto-generating embeddings.
   */
  createEmbeddingGenerator(config) {
    if (config.provider === "custom" && config.generate) {
      return async (text) => {
        try {
          return await config.generate(text);
        } catch (error) {
          console.warn("[Cortex] Custom embedding generation failed:", error);
          return null;
        }
      };
    }
    if (config.provider === "openai" && config.apiKey) {
      const apiKey = config.apiKey;
      const model = resolveEmbeddingModel(config.model);
      return async (text) => {
        try {
          const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              input: text
            })
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.warn("[Cortex] OpenAI embedding API error:", errorText);
            return null;
          }
          const data = await response.json();
          return data.data?.[0]?.embedding || null;
        } catch (error) {
          console.warn("[Cortex] OpenAI embedding generation failed:", error);
          return null;
        }
      };
    }
    console.warn("[Cortex] Invalid embedding config, no embedding generation available");
    return async () => null;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helper Methods for Fact Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Helper: Find and cascade delete facts linked to a memory
   * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
   */
  async cascadeDeleteFacts(memorySpaceId, memoryId, conversationId) {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 1e4
    });
    const factsToDelete = allFacts.filter(
      (fact) => fact.sourceRef?.memoryId === memoryId || conversationId && fact.sourceRef?.conversationId === conversationId
    );
    const deletedFactIds = [];
    for (const fact of factsToDelete) {
      try {
        await this.facts.delete(memorySpaceId, fact.factId);
        deletedFactIds.push(fact.factId);
      } catch (error) {
        console.warn("Failed to delete linked fact:", error);
      }
    }
    return { count: deletedFactIds.length, factIds: deletedFactIds };
  }
  /**
   * Helper: Archive facts (mark as expired)
   * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
   */
  async archiveFacts(memorySpaceId, memoryId, conversationId) {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 1e4
    });
    const factsToArchive = allFacts.filter(
      (fact) => fact.sourceRef?.memoryId === memoryId || conversationId && fact.sourceRef?.conversationId === conversationId
    );
    const archivedFactIds = [];
    for (const fact of factsToArchive) {
      try {
        await this.facts.update(memorySpaceId, fact.factId, {
          validUntil: Date.now(),
          tags: [...fact.tags, "archived"]
        });
        archivedFactIds.push(fact.factId);
      } catch (error) {
        console.warn("Failed to archive linked fact:", error);
      }
    }
    return { count: archivedFactIds.length, factIds: archivedFactIds };
  }
  /**
   * Helper: Fetch facts for a memory or conversation
   */
  async fetchFactsForMemory(memorySpaceId, memoryId, conversationId) {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 1e4
    });
    return allFacts.filter(
      (fact) => fact.sourceRef?.memoryId === memoryId || conversationId && fact.sourceRef?.conversationId === conversationId
    );
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Dual-Layer Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Orchestration Observer Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Generate a unique orchestration ID
   */
  generateOrchestrationId() {
    return `orch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
  /**
   * Notify the observer of a layer update (safely handles async observers)
   */
  notifyLayerUpdate(observer, event) {
    if (!observer?.onLayerUpdate) return;
    try {
      const result = observer.onLayerUpdate(event);
      if (result instanceof Promise) {
        result.catch(
          (e) => console.warn("[Cortex] Observer onLayerUpdate failed:", e)
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onLayerUpdate threw:", e);
    }
  }
  /**
   * Notify the observer of remember phase start
   */
  notifyRememberStart(observer, orchestrationId) {
    if (!observer?.onRememberStart) return;
    try {
      const result = observer.onRememberStart(orchestrationId);
      if (result instanceof Promise) {
        result.catch(
          (e) => console.warn("[Cortex] Observer onRememberStart failed:", e)
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onRememberStart threw:", e);
    }
  }
  /**
   * Notify the observer of remember phase completion
   */
  notifyRememberComplete(observer, summary) {
    if (!observer?.onRememberComplete) return;
    try {
      const result = observer.onRememberComplete(summary);
      if (result instanceof Promise) {
        result.catch(
          (e) => console.warn("[Cortex] Observer onRememberComplete failed:", e)
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onRememberComplete threw:", e);
    }
  }
  /**
   * Notify the observer of recall phase start
   */
  notifyRecallStart(observer, orchestrationId) {
    if (!observer?.onRecallStart) return;
    try {
      const result = observer.onRecallStart(orchestrationId);
      if (result instanceof Promise) {
        result.catch(
          (e) => console.warn("[Cortex] Observer onRecallStart failed:", e)
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onRecallStart threw:", e);
    }
  }
  /**
   * Notify the observer of recall phase completion
   */
  notifyRecallComplete(observer, summary) {
    if (!observer?.onRecallComplete) return;
    try {
      const result = observer.onRecallComplete(summary);
      if (result instanceof Promise) {
        result.catch(
          (e) => console.warn("[Cortex] Observer onRecallComplete failed:", e)
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onRecallComplete threw:", e);
    }
  }
  /**
   * Create a layer event with current timing info
   */
  createLayerEvent(layer, status, orchestrationStartTime, phase, data, error, revisionInfo) {
    const now = Date.now();
    return {
      layer,
      status,
      timestamp: now,
      latencyMs: now - orchestrationStartTime,
      phase,
      data,
      error,
      revisionAction: revisionInfo?.action,
      supersededFacts: revisionInfo?.supersededFacts
    };
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Orchestration Helper Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Check if a layer should be skipped
   */
  shouldSkipLayer(layer, skipLayers) {
    return skipLayers?.includes(layer) ?? false;
  }
  /**
   * Build deduplication config from remember params
   *
   * Defaults to 'semantic' strategy for maximum effectiveness (convenience layer).
   * BATTERIES INCLUDED (v0.30.0+): Falls back to this.embeddingGenerator if available,
   * then to 'structural' if no embedding function is available.
   * Returns undefined if deduplication is explicitly disabled.
   */
  buildDeduplicationConfig(params) {
    if (params.factDeduplication === false) {
      return void 0;
    }
    const strategy = params.factDeduplication ?? "semantic";
    const effectiveGenerator = params.generateEmbedding || this.embeddingGenerator;
    const config = {
      strategy,
      similarityThreshold: 0.85,
      generateEmbedding: effectiveGenerator ? async (text) => {
        const result = await effectiveGenerator(text);
        if (!result) {
          throw new Error("generateEmbedding returned null");
        }
        return result;
      } : void 0
    };
    return FactDeduplicationService.resolveConfig(config);
  }
  /**
   * Validate and normalize remember params with orchestration defaults
   */
  validateAndNormalizeParams(params) {
    const warnings = [];
    validateConversationId(params.conversationId);
    validateContent(params.userMessage, "userMessage");
    validateContent(params.agentResponse, "agentResponse");
    let memorySpaceId = params.memorySpaceId;
    if (memorySpaceId === void 0 || memorySpaceId === null) {
      memorySpaceId = DEFAULT_MEMORY_SPACE_ID;
      warnings.push(
        `[Cortex Warning] No memorySpaceId provided, using '${DEFAULT_MEMORY_SPACE_ID}'. Consider explicitly setting a memorySpaceId for proper memory isolation.`
      );
    } else if (memorySpaceId.trim().length === 0) {
      throw new MemoryValidationError(
        "memorySpaceId cannot be empty. Either provide a valid memorySpaceId or omit it to use the default.",
        "INVALID_MEMORYSPACE_ID",
        "memorySpaceId"
      );
    }
    const hasUserId = params.userId && params.userId.trim().length > 0;
    const hasAgentId = params.agentId && params.agentId.trim().length > 0;
    if (!hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "Either userId or agentId must be provided for memory ownership. Use userId for user-owned memories, agentId for agent-owned memories.",
        "OWNER_REQUIRED",
        "userId/agentId"
      );
    }
    if (hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "agentId is required when userId is provided. User-agent conversations require both a user and an agent participant.",
        "AGENT_REQUIRED_FOR_USER_CONVERSATION",
        "agentId"
      );
    }
    const ownerId = hasUserId ? params.userId : params.agentId;
    const ownerType = hasUserId ? "user" : "agent";
    if (hasUserId && (!params.userName || params.userName.trim().length === 0)) {
      throw new MemoryValidationError(
        "userName is required when userId is provided",
        "MISSING_REQUIRED_FIELD",
        "userName"
      );
    }
    if (params.importance !== void 0) {
      validateImportance2(params.importance);
    }
    if (params.tags) {
      validateTags2(params.tags);
    }
    return {
      memorySpaceId,
      ownerId,
      ownerType,
      warnings
    };
  }
  /**
   * Ensure memory space exists, auto-register if not
   * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
   */
  async ensureMemorySpaceExists(memorySpaceId) {
    if (!this.memorySpacesAPI) {
      return;
    }
    const existingSpace = await this.memorySpacesAPI.get(memorySpaceId);
    if (!existingSpace) {
      await this.memorySpacesAPI.register({
        memorySpaceId,
        type: "custom",
        name: memorySpaceId
      });
    }
  }
  /**
   * Ensure user profile exists, auto-create if not
   */
  async ensureUserExists(userId, userName) {
    if (!this.usersAPI) {
      return;
    }
    await this.usersAPI.getOrCreate(userId, {
      displayName: userName || userId,
      createdAt: Date.now()
    });
  }
  /**
   * Ensure agent is registered, auto-register if not
   */
  async ensureAgentExists(agentId) {
    if (!this.agentsAPI) {
      return;
    }
    const existingAgent = await this.agentsAPI.exists(agentId);
    if (!existingAgent) {
      await this.agentsAPI.register({
        id: agentId,
        name: agentId,
        description: "Auto-registered by memory.remember()"
      });
    }
  }
  /**
   * Get fact extraction function - uses provided extractor, LLM config, or returns null
   */
  getFactExtractor(params) {
    if (params.extractFacts) {
      return params.extractFacts;
    }
    if (this.llmConfig?.extractFacts) {
      return this.llmConfig.extractFacts;
    }
    if (this.llmConfig?.apiKey) {
      return this.createLLMFactExtractor();
    }
    return null;
  }
  /**
   * Get or create LLM client for fact extraction
   */
  getLLMClient() {
    if (this.llmClient !== void 0) {
      return this.llmClient;
    }
    if (this.llmConfig) {
      this.llmClient = createLLMClient(this.llmConfig);
    } else {
      this.llmClient = null;
    }
    return this.llmClient;
  }
  /**
   * Create an LLM-based fact extractor function
   *
   * Uses the configured LLM provider (OpenAI or Anthropic) to automatically
   * extract structured facts from conversations. Falls back to null if
   * extraction fails or LLM is not properly configured.
   */
  createLLMFactExtractor() {
    const client = this.getLLMClient();
    if (!client) {
      return async () => {
        console.debug(
          "[Cortex] LLM fact extraction configured but client could not be created. Ensure openai or @anthropic-ai/sdk is installed."
        );
        return null;
      };
    }
    return async (userMessage, agentResponse) => {
      try {
        return await client.extractFacts(userMessage, agentResponse);
      } catch (error) {
        console.error("[Cortex] LLM fact extraction failed:", error);
        return null;
      }
    };
  }
  /**
   * Remember a conversation exchange (stores in both ACID and Vector)
   *
   * This method orchestrates across multiple layers by default:
   * - Auto-registers memory space if it doesn't exist
   * - Auto-creates user profile if userId is provided
   * - Auto-registers agent if agentId is provided
   * - Stores messages in ACID conversation layer
   * - Creates searchable vector memories
   * - Extracts facts if LLM is configured or extractFacts provided
   * - Syncs to graph if configured
   *
   * Use `skipLayers` to explicitly opt-out of specific layers.
   *
   * @example
   * ```typescript
   * // Full orchestration (default)
   * await cortex.memory.remember({
   *   memorySpaceId: 'user-123-space',
   *   userId: 'user-123',
   *   userName: 'Alex',
   *   conversationId: 'conv-123',
   *   userMessage: 'Call me Alex',
   *   agentResponse: "I'll remember that, Alex!",
   * });
   *
   * // Skip facts and graph (lightweight mode)
   * await cortex.memory.remember({
   *   memorySpaceId: 'user-123-space',
   *   agentId: 'quick-bot',
   *   conversationId: 'conv-456',
   *   userMessage: 'Quick question',
   *   agentResponse: 'Quick answer',
   *   skipLayers: ['facts', 'graph'],
   * });
   * ```
   */
  async remember(params, options) {
    const observer = params.observer;
    const orchestrationId = observer ? this.generateOrchestrationId() : "";
    const orchestrationStartTime = Date.now();
    const layerEvents = {};
    const { memorySpaceId, ownerId, ownerType, warnings } = this.validateAndNormalizeParams(params);
    for (const warning of warnings) {
      console.warn(warning);
    }
    const now = Date.now();
    const skipLayers = params.skipLayers || [];
    const isPartialOrchestration = this.shouldSkipLayer("users", skipLayers) || this.shouldSkipLayer("agents", skipLayers);
    if (observer && !isPartialOrchestration) {
      this.notifyRememberStart(observer, orchestrationId);
    }
    const shouldSyncToGraph = this.graphAdapter !== void 0 && !this.shouldSkipLayer("graph", skipLayers);
    if (observer && !isPartialOrchestration) {
      const event = this.createLayerEvent(
        "memorySpace",
        "in_progress",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.memorySpace = event;
      this.notifyLayerUpdate(observer, event);
    }
    try {
      await this.ensureMemorySpaceExists(memorySpaceId);
      if (observer && !isPartialOrchestration) {
        const event = this.createLayerEvent(
          "memorySpace",
          "complete",
          orchestrationStartTime,
          "remember",
          {
            id: memorySpaceId,
            preview: `Memory space: ${memorySpaceId}`
          }
        );
        layerEvents.memorySpace = event;
        this.notifyLayerUpdate(observer, event);
      }
    } catch (error) {
      if (observer && !isPartialOrchestration) {
        const event = this.createLayerEvent(
          "memorySpace",
          "error",
          orchestrationStartTime,
          "remember",
          void 0,
          {
            message: error instanceof Error ? error.message : String(error)
          }
        );
        layerEvents.memorySpace = event;
        this.notifyLayerUpdate(observer, event);
      }
      throw error;
    }
    const shouldProcessUser = ownerType === "user" && !this.shouldSkipLayer("users", skipLayers);
    const shouldProcessAgent = ownerType === "agent" && !this.shouldSkipLayer("agents", skipLayers);
    const shouldProcessSecondaryAgent = params.agentId && params.userId && !this.shouldSkipLayer("agents", skipLayers);
    if (shouldProcessUser) {
      if (observer) {
        const event = this.createLayerEvent(
          "user",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.user = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureUserExists(ownerId, params.userName);
        if (observer) {
          const event = this.createLayerEvent(
            "user",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: ownerId,
              preview: `User: ${params.userName || ownerId}`
            }
          );
          layerEvents.user = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "user",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.user = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer && !this.shouldSkipLayer("users", skipLayers)) {
      const event = this.createLayerEvent(
        "user",
        "skipped",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.user = event;
      this.notifyLayerUpdate(observer, event);
    }
    if (shouldProcessAgent) {
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.agent = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureAgentExists(ownerId);
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: ownerId,
              preview: `Agent: ${ownerId}`
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (shouldProcessSecondaryAgent) {
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.agent = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureAgentExists(params.agentId);
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: params.agentId,
              preview: `Agent: ${params.agentId}`
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer && !this.shouldSkipLayer("agents", skipLayers)) {
      const event = this.createLayerEvent(
        "agent",
        "skipped",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.agent = event;
      this.notifyLayerUpdate(observer, event);
    }
    let userMsgId;
    let agentMsgId;
    if (!this.shouldSkipLayer("conversations", skipLayers)) {
      if (observer) {
        const event = this.createLayerEvent(
          "conversation",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.conversation = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        const existingConversation = await this.conversations.get(
          params.conversationId
        );
        if (!existingConversation) {
          const conversationType = params.userId ? "user-agent" : "agent-agent";
          const participants = params.userId ? {
            userId: params.userId,
            agentId: params.agentId,
            // The agent in this user↔agent conversation
            participantId: params.participantId
            // Hive Mode: who created this
          } : {
            // For agent-agent, store the agentId as the owner
            agentId: params.agentId,
            participantId: params.participantId
            // Hive Mode: who created this
          };
          try {
            await this.conversations.create(
              {
                memorySpaceId,
                conversationId: params.conversationId,
                type: conversationType,
                participants
              },
              { syncToGraph: shouldSyncToGraph }
            );
          } catch (createError) {
            const errorMessage = createError instanceof Error ? createError.message : String(createError);
            if (errorMessage.includes("CONVERSATION_ALREADY_EXISTS")) {
            } else {
              throw createError;
            }
          }
        }
        const userMsg = await this.conversations.addMessage({
          conversationId: params.conversationId,
          message: {
            role: "user",
            content: params.userMessage,
            metadata: { userId: params.userId }
          }
        });
        userMsgId = userMsg.messages[userMsg.messages.length - 1].id;
        const agentMsg = await this.conversations.addMessage({
          conversationId: params.conversationId,
          message: {
            role: "agent",
            content: params.agentResponse,
            participantId: params.participantId || params.agentId,
            metadata: {}
          }
        });
        agentMsgId = agentMsg.messages[agentMsg.messages.length - 1].id;
        if (observer) {
          const event = this.createLayerEvent(
            "conversation",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: params.conversationId,
              preview: `Conversation: ${params.conversationId} (2 messages)`,
              metadata: { userMsgId, agentMsgId }
            }
          );
          layerEvents.conversation = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "conversation",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.conversation = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer) {
      const event = this.createLayerEvent(
        "conversation",
        "skipped",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.conversation = event;
      this.notifyLayerUpdate(observer, event);
    }
    const storedMemories = [];
    if (!this.shouldSkipLayer("vector", skipLayers)) {
      if (observer) {
        const event = this.createLayerEvent(
          "vector",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.vector = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        let userContent = params.userMessage;
        const agentContent = params.agentResponse;
        let contentType = "raw";
        if (params.extractContent) {
          const extracted = await params.extractContent(
            params.userMessage,
            params.agentResponse
          );
          if (extracted) {
            userContent = extracted;
            contentType = "summarized";
          }
        }
        let userEmbedding;
        let agentEmbedding;
        const effectiveEmbeddingFn = params.generateEmbedding || this.embeddingGenerator;
        if (effectiveEmbeddingFn) {
          userEmbedding = await effectiveEmbeddingFn(userContent) || void 0;
          agentEmbedding = await effectiveEmbeddingFn(agentContent) || void 0;
        }
        const userMemory = await this.vector.store(
          memorySpaceId,
          {
            content: userContent,
            contentType,
            tenantId: resolveTenantId(this.authContext?.tenantId, params.tenantId),
            // Multi-tenancy: SaaS platform isolation
            participantId: params.participantId,
            embedding: userEmbedding,
            userId: params.userId,
            agentId: params.agentId,
            // NEW: Support agent-owned memories
            messageRole: "user",
            source: {
              type: "conversation",
              userId: params.userId,
              userName: params.userName,
              timestamp: now
            },
            conversationRef: userMsgId ? {
              conversationId: params.conversationId,
              messageIds: [userMsgId]
            } : void 0,
            metadata: {
              importance: params.importance || 50,
              tags: params.tags || []
            }
          },
          { syncToGraph: shouldSyncToGraph }
        );
        storedMemories.push(userMemory);
        const agentContentLower = agentContent.toLowerCase();
        const acknowledgmentPhrases = [
          "got it",
          "i've noted",
          "i'll remember",
          "noted",
          "understood",
          "i'll set",
          "i'll call you",
          "will do",
          "sure thing",
          "okay,",
          "ok,"
        ];
        const isAcknowledgment = agentContent.length < 80 && acknowledgmentPhrases.some(
          (phrase) => agentContentLower.includes(phrase)
        );
        if (!isAcknowledgment) {
          const agentMemory = await this.vector.store(
            memorySpaceId,
            {
              content: agentContent,
              contentType: "raw",
              tenantId: resolveTenantId(this.authContext?.tenantId, params.tenantId),
              // Multi-tenancy: SaaS platform isolation
              participantId: params.participantId,
              embedding: agentEmbedding,
              userId: params.userId,
              agentId: params.agentId,
              // NEW: Support agent-owned memories
              messageRole: "agent",
              source: {
                type: "conversation",
                userId: params.userId,
                userName: params.userName,
                timestamp: now + 1
              },
              conversationRef: agentMsgId ? {
                conversationId: params.conversationId,
                messageIds: [agentMsgId]
              } : void 0,
              metadata: {
                importance: params.importance || 50,
                tags: params.tags || []
              }
            },
            { syncToGraph: shouldSyncToGraph }
          );
          storedMemories.push(agentMemory);
        }
        if (observer) {
          const event = this.createLayerEvent(
            "vector",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: storedMemories[0]?.memoryId,
              preview: `${storedMemories.length} memories stored`,
              metadata: { memoryIds: storedMemories.map((m) => m.memoryId) }
            }
          );
          layerEvents.vector = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "vector",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.vector = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer) {
      const event = this.createLayerEvent(
        "vector",
        "skipped",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.vector = event;
      this.notifyLayerUpdate(observer, event);
    }
    const extractedFacts = [];
    const revisionActions = [];
    if (!this.shouldSkipLayer("facts", skipLayers)) {
      const factExtractor = this.getFactExtractor(params);
      if (factExtractor) {
        if (observer) {
          const event = this.createLayerEvent(
            "facts",
            "in_progress",
            orchestrationStartTime,
            "remember"
          );
          layerEvents.facts = event;
          this.notifyLayerUpdate(observer, event);
        }
        try {
          const factsToStore = await factExtractor(
            params.userMessage,
            params.agentResponse
          );
          if (factsToStore && factsToStore.length > 0) {
            const useBeliefRevision = options?.beliefRevision !== false && params.factDeduplication !== false && this.facts.hasBeliefRevision();
            const dedupConfig = this.buildDeduplicationConfig(params);
            for (const factData of factsToStore) {
              try {
                let factEmbedding;
                const factEmbeddingFn = params.generateEmbedding || this.embeddingGenerator;
                if (factEmbeddingFn && factData.fact) {
                  try {
                    const embeddingResult = await factEmbeddingFn(factData.fact);
                    factEmbedding = embeddingResult ?? void 0;
                  } catch (embeddingError) {
                    console.warn(
                      "[Cortex] Failed to generate fact embedding, continuing without:",
                      embeddingError
                    );
                  }
                }
                if (useBeliefRevision) {
                  const reviseResult = await this.facts.revise({
                    memorySpaceId,
                    userId: params.userId,
                    participantId: params.participantId,
                    // Include source provenance for traceability
                    sourceType: "conversation",
                    sourceRef: {
                      conversationId: params.conversationId,
                      messageIds: userMsgId && agentMsgId ? [userMsgId, agentMsgId] : void 0,
                      memoryId: storedMemories[0]?.memoryId
                    },
                    fact: {
                      fact: factData.fact,
                      factType: factData.factType,
                      subject: factData.subject || params.userId || params.agentId,
                      predicate: factData.predicate,
                      object: factData.object,
                      confidence: factData.confidence,
                      tags: factData.tags || params.tags || [],
                      // Embedding for semantic search (v0.30.0+)
                      embedding: factEmbedding,
                      // Enriched entity/relation extraction for graph sync (v0.31.0+)
                      entities: factData.entities,
                      relations: factData.relations
                    }
                  });
                  revisionActions.push({
                    action: reviseResult.action,
                    fact: reviseResult.fact,
                    superseded: reviseResult.superseded.length > 0 ? reviseResult.superseded : void 0,
                    reason: reviseResult.reason
                  });
                  if (reviseResult.action !== "NONE") {
                    extractedFacts.push(reviseResult.fact);
                  }
                } else {
                  const storeParams = {
                    memorySpaceId,
                    participantId: params.participantId,
                    userId: params.userId,
                    fact: factData.fact,
                    factType: factData.factType,
                    subject: factData.subject || params.userId || params.agentId,
                    predicate: factData.predicate,
                    object: factData.object,
                    confidence: factData.confidence,
                    sourceType: "conversation",
                    sourceRef: {
                      conversationId: params.conversationId,
                      messageIds: userMsgId && agentMsgId ? [userMsgId, agentMsgId] : void 0,
                      memoryId: storedMemories[0]?.memoryId
                    },
                    tags: factData.tags || params.tags || [],
                    // Embedding for semantic search (v0.30.0+)
                    embedding: factEmbedding,
                    // Enriched entity/relation extraction for graph sync (v0.31.0+)
                    entities: factData.entities,
                    relations: factData.relations
                  };
                  if (dedupConfig) {
                    const result = await this.facts.storeWithDedup(
                      storeParams,
                      { deduplication: dedupConfig }
                    );
                    extractedFacts.push(result.fact);
                  } else {
                    const storedFact = await this.facts.store(storeParams);
                    extractedFacts.push(storedFact);
                  }
                }
              } catch (error) {
                console.warn("Failed to store fact:", error);
              }
            }
          }
          if (observer) {
            const lastRevisionAction = revisionActions[revisionActions.length - 1];
            const event = this.createLayerEvent(
              "facts",
              "complete",
              orchestrationStartTime,
              "remember",
              {
                id: extractedFacts[0]?.factId,
                preview: `${extractedFacts.length} facts extracted`,
                metadata: { factIds: extractedFacts.map((f) => f.factId) }
              },
              void 0,
              lastRevisionAction ? {
                action: lastRevisionAction.action,
                supersededFacts: lastRevisionAction.superseded?.map(
                  (f) => f.factId
                )
              } : void 0
            );
            layerEvents.facts = event;
            this.notifyLayerUpdate(observer, event);
          }
        } catch (error) {
          console.warn("Failed to extract facts:", error);
          if (observer) {
            const event = this.createLayerEvent(
              "facts",
              "error",
              orchestrationStartTime,
              "remember",
              void 0,
              {
                message: error instanceof Error ? error.message : String(error)
              }
            );
            layerEvents.facts = event;
            this.notifyLayerUpdate(observer, event);
          }
        }
      } else if (observer) {
        const event = this.createLayerEvent(
          "facts",
          "skipped",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.facts = event;
        this.notifyLayerUpdate(observer, event);
      }
    } else if (observer) {
      const event = this.createLayerEvent(
        "facts",
        "skipped",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.facts = event;
      this.notifyLayerUpdate(observer, event);
    }
    if (observer) {
      if (shouldSyncToGraph) {
        const event = this.createLayerEvent(
          "graph",
          "complete",
          orchestrationStartTime,
          "remember",
          {
            preview: "Graph sync completed with layer operations"
          }
        );
        layerEvents.graph = event;
        this.notifyLayerUpdate(observer, event);
      } else {
        const event = this.createLayerEvent(
          "graph",
          "skipped",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.graph = event;
        this.notifyLayerUpdate(observer, event);
      }
    }
    if (observer) {
      const summary = {
        orchestrationId,
        phase: "remember",
        totalLatencyMs: Date.now() - orchestrationStartTime,
        layers: layerEvents,
        createdIds: {
          conversationId: params.conversationId,
          memoryIds: storedMemories.map((m) => m.memoryId),
          factIds: extractedFacts.map((f) => f.factId)
        }
      };
      this.notifyRememberComplete(observer, summary);
    }
    return {
      conversation: {
        messageIds: userMsgId && agentMsgId ? [userMsgId, agentMsgId] : [],
        conversationId: params.conversationId
      },
      memories: storedMemories,
      facts: extractedFacts,
      // Include belief revision actions if any were taken
      factRevisions: revisionActions.length > 0 ? revisionActions : void 0
    };
  }
  /**
   * Remember a conversation exchange from a streaming response (ENHANCED)
   *
   * This method provides true streaming capabilities with:
   * - Progressive storage during streaming
   * - Real-time fact extraction
   * - Streaming hooks for monitoring
   * - Error recovery with resume capability
   * - Adaptive processing based on stream characteristics
   * - Optional chunking for very long responses
   *
   * Auto-syncs to graph if configured (default: true)
   *
   * @param params - Stream parameters including responseStream
   * @param options - Optional streaming options
   * @returns Promise with enhanced remember result including metrics
   *
   * @example
   * ```typescript
   * // Basic usage
   * const result = await cortex.memory.rememberStream({
   *   memorySpaceId: 'agent-1',
   *   conversationId: 'conv-123',
   *   userMessage: 'What is the weather?',
   *   responseStream: llmStream,
   *   userId: 'user-1',
   *   userName: 'Alex',
   * });
   *
   * // With progressive features
   * const result = await cortex.memory.rememberStream({
   *   memorySpaceId: 'agent-1',
   *   conversationId: 'conv-123',
   *   userMessage: 'Explain quantum computing',
   *   responseStream: llmStream,
   *   userId: 'user-1',
   *   userName: 'Alex',
   *   extractFacts: extractFactsFromText,
   * }, {
   *   storePartialResponse: true,
   *   partialResponseInterval: 3000,
   *   progressiveFactExtraction: true,
   *   factExtractionThreshold: 500,
   *   hooks: {
   *     onChunk: (event) => console.log('Chunk:', event.chunk),
   *     onProgress: (event) => console.log('Progress:', event.bytesProcessed),
   *   },
   *   partialFailureHandling: 'store-partial',
   * });
   * ```
   */
  async rememberStream(params, options) {
    validateConversationId(params.conversationId);
    validateContent(params.userMessage, "userMessage");
    validateStreamObject(params.responseStream);
    let memorySpaceId = params.memorySpaceId;
    if (memorySpaceId === void 0 || memorySpaceId === null) {
      memorySpaceId = DEFAULT_MEMORY_SPACE_ID;
      console.warn(
        `[Cortex Warning] No memorySpaceId provided, using '${DEFAULT_MEMORY_SPACE_ID}'. Consider explicitly setting a memorySpaceId for proper memory isolation.`
      );
    } else if (memorySpaceId.trim().length === 0) {
      throw new MemoryValidationError(
        "memorySpaceId cannot be empty. Either provide a valid memorySpaceId or omit it to use the default.",
        "INVALID_MEMORYSPACE_ID",
        "memorySpaceId"
      );
    }
    const hasUserId = params.userId && params.userId.trim().length > 0;
    const hasAgentId = params.agentId && params.agentId.trim().length > 0;
    if (!hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "Either userId or agentId must be provided for memory ownership. Use userId for user-owned memories, agentId for agent-owned memories.",
        "OWNER_REQUIRED",
        "userId/agentId"
      );
    }
    if (hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "agentId is required when userId is provided. User-agent conversations require both a user and an agent participant.",
        "AGENT_REQUIRED_FOR_USER_CONVERSATION",
        "agentId"
      );
    }
    if (hasUserId && (!params.userName || params.userName.trim().length === 0)) {
      throw new MemoryValidationError(
        "userName is required when userId is provided",
        "MISSING_REQUIRED_FIELD",
        "userName"
      );
    }
    if (params.importance !== void 0) {
      validateImportance2(params.importance);
    }
    if (params.tags) {
      validateTags2(params.tags);
    }
    const ownerId = hasUserId ? params.userId : params.agentId;
    const ownerType = hasUserId ? "user" : "agent";
    const skipLayers = params.skipLayers || [];
    const { StreamProcessor: StreamProcessor2, createStreamContext: createStreamContext2 } = await Promise.resolve().then(() => (init_StreamProcessor(), StreamProcessor_exports));
    const { MetricsCollector: MetricsCollector2 } = await Promise.resolve().then(() => (init_StreamMetrics(), StreamMetrics_exports));
    const { ProgressiveStorageHandler: ProgressiveStorageHandler2 } = await Promise.resolve().then(() => (init_ProgressiveStorageHandler(), ProgressiveStorageHandler_exports));
    const { ProgressiveFactExtractor: ProgressiveFactExtractor2 } = await Promise.resolve().then(() => (init_FactExtractor(), FactExtractor_exports));
    const { StreamErrorRecovery: StreamErrorRecovery2, ResumableStreamError: ResumableStreamError2 } = await Promise.resolve().then(() => (init_ErrorRecovery(), ErrorRecovery_exports));
    const { AdaptiveStreamProcessor: AdaptiveStreamProcessor2 } = await Promise.resolve().then(() => (init_AdaptiveProcessor(), AdaptiveProcessor_exports));
    const {
      ResponseChunker: _ResponseChunker,
      shouldChunkContent: _shouldChunkContent
    } = await Promise.resolve().then(() => (init_ChunkingStrategies(), ChunkingStrategies_exports));
    const { ProgressiveGraphSync: ProgressiveGraphSync2 } = await Promise.resolve().then(() => (init_ProgressiveGraphSync(), ProgressiveGraphSync_exports));
    const shouldSyncToGraph = this.graphAdapter !== void 0 && !this.shouldSkipLayer("graph", skipLayers);
    const observer = params.observer;
    const orchestrationId = observer ? this.generateOrchestrationId() : "";
    const orchestrationStartTime = Date.now();
    const layerEvents = {};
    if (observer) {
      this.notifyRememberStart(observer, orchestrationId);
    }
    if (observer) {
      const event = this.createLayerEvent(
        "memorySpace",
        "in_progress",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.memorySpace = event;
      this.notifyLayerUpdate(observer, event);
    }
    try {
      await this.ensureMemorySpaceExists(memorySpaceId);
      if (observer) {
        const event = this.createLayerEvent(
          "memorySpace",
          "complete",
          orchestrationStartTime,
          "remember",
          {
            id: memorySpaceId,
            preview: `Memory space: ${memorySpaceId}`
          }
        );
        layerEvents.memorySpace = event;
        this.notifyLayerUpdate(observer, event);
      }
    } catch (error) {
      if (observer) {
        const event = this.createLayerEvent(
          "memorySpace",
          "error",
          orchestrationStartTime,
          "remember",
          void 0,
          {
            message: error instanceof Error ? error.message : String(error)
          }
        );
        layerEvents.memorySpace = event;
        this.notifyLayerUpdate(observer, event);
      }
      throw error;
    }
    const shouldProcessUser = ownerType === "user" && !this.shouldSkipLayer("users", skipLayers);
    if (shouldProcessUser) {
      if (observer) {
        const event = this.createLayerEvent(
          "user",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.user = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureUserExists(ownerId, params.userName);
        if (observer) {
          const event = this.createLayerEvent(
            "user",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: ownerId,
              preview: `User: ${params.userName || ownerId}`
            }
          );
          layerEvents.user = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "user",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.user = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer) {
      const event = this.createLayerEvent(
        "user",
        "skipped",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.user = event;
      this.notifyLayerUpdate(observer, event);
    }
    const shouldProcessAgent = ownerType === "agent" && !this.shouldSkipLayer("agents", skipLayers);
    const shouldProcessSecondaryAgent = params.agentId && params.userId && !this.shouldSkipLayer("agents", skipLayers);
    if (shouldProcessAgent) {
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.agent = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureAgentExists(ownerId);
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: ownerId,
              preview: `Agent: ${ownerId}`
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (shouldProcessSecondaryAgent) {
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
          "remember"
        );
        layerEvents.agent = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureAgentExists(params.agentId);
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "complete",
            orchestrationStartTime,
            "remember",
            {
              id: params.agentId,
              preview: `Agent: ${params.agentId}`
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "error",
            orchestrationStartTime,
            "remember",
            void 0,
            {
              message: error instanceof Error ? error.message : String(error)
            }
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer) {
      const event = this.createLayerEvent(
        "agent",
        "skipped",
        orchestrationStartTime,
        "remember"
      );
      layerEvents.agent = event;
      this.notifyLayerUpdate(observer, event);
    }
    const metrics = new MetricsCollector2();
    const context = createStreamContext2({
      memorySpaceId,
      conversationId: params.conversationId,
      userId: params.userId || params.agentId || "unknown",
      // Use ownerId
      userName: params.userName || params.agentId || "Agent"
    });
    const processor = new StreamProcessor2(
      context,
      options?.hooks || {},
      metrics
    );
    const errorRecovery = new StreamErrorRecovery2(this.client);
    let storageHandler = null;
    if (options?.storePartialResponse) {
      storageHandler = new ProgressiveStorageHandler2(
        this.client,
        memorySpaceId,
        params.conversationId,
        params.userId || params.agentId || ownerId,
        // Use owner
        options.partialResponseInterval || 3e3
      );
    }
    let _factExtractor = null;
    if (options?.progressiveFactExtraction && params.extractFacts) {
      const dedupConfig = this.buildDeduplicationConfig(params);
      _factExtractor = new ProgressiveFactExtractor2(
        this.facts,
        memorySpaceId,
        ownerId,
        // Use validated owner (userId or agentId)
        params.participantId,
        {
          extractionThreshold: options.factExtractionThreshold || 500,
          deduplication: dedupConfig
        }
      );
    }
    let _adaptiveProcessor = null;
    if (options?.enableAdaptiveProcessing) {
      _adaptiveProcessor = new AdaptiveStreamProcessor2();
    }
    let graphSync = null;
    if (options?.progressiveGraphSync && this.graphAdapter) {
      graphSync = new ProgressiveGraphSync2(
        this.graphAdapter,
        options.graphSyncInterval || 5e3
      );
    }
    const progressiveFacts = [];
    let fullResponse = "";
    try {
      if (!this.shouldSkipLayer("conversations", skipLayers)) {
        const existingConversation = await this.conversations.get(
          params.conversationId
        );
        if (!existingConversation) {
          await this.conversations.create(
            {
              memorySpaceId,
              conversationId: params.conversationId,
              type: "user-agent",
              participants: {
                userId: params.userId,
                agentId: params.agentId,
                // The agent in this conversation
                participantId: params.participantId
                // Hive Mode: who created this
              }
            },
            { syncToGraph: shouldSyncToGraph }
          );
        }
      }
      if (storageHandler) {
        const partialMemoryId = await storageHandler.initializePartialMemory({
          participantId: params.participantId,
          userMessage: params.userMessage,
          importance: params.importance,
          tags: params.tags
        });
        context.partialMemoryId = partialMemoryId;
        if (graphSync) {
          await graphSync.initializePartialNode({
            memoryId: partialMemoryId,
            memorySpaceId: params.memorySpaceId,
            userId: params.userId,
            content: "[Streaming...]"
          });
        }
      }
      fullResponse = await processor.processStream(
        params.responseStream,
        options || {}
      );
      if (!fullResponse || fullResponse.trim().length === 0) {
        throw new Error("Response stream completed but produced no content.");
      }
      if (storageHandler && storageHandler.isReady()) {
        const streamEmbeddingFn = params.generateEmbedding || this.embeddingGenerator;
        await storageHandler.finalizeMemory(
          fullResponse,
          streamEmbeddingFn ? await streamEmbeddingFn(fullResponse) || void 0 : void 0
        );
      }
      const rememberResult = await this.remember(
        {
          memorySpaceId,
          // Use normalized memorySpaceId
          participantId: params.participantId,
          conversationId: params.conversationId,
          userMessage: params.userMessage,
          agentResponse: fullResponse,
          userId: params.userId,
          agentId: params.agentId,
          userName: params.userName,
          extractContent: params.extractContent,
          generateEmbedding: params.generateEmbedding,
          extractFacts: params.extractFacts,
          autoEmbed: params.autoEmbed,
          autoSummarize: params.autoSummarize,
          importance: params.importance,
          tags: params.tags,
          // Pass through the observer for real-time layer tracking of remaining layers
          // Note: rememberStream() already emitted events for memorySpace, user, agent
          // remember() will emit events for conversation, vector, facts, graph
          // The "skipped" events for users/agents from remember() are harmless since
          // rememberStream() already emitted "complete" events first
          observer: params.observer,
          // Skip orchestration layers we already handled in rememberStream
          // Also pass through any user-requested skip layers (facts, vector, graph, etc.)
          skipLayers: [
            "users",
            // Already handled above
            "agents",
            // Already handled above
            // Pass through other user-requested skip layers
            ...this.shouldSkipLayer("conversations", skipLayers) ? ["conversations"] : [],
            ...this.shouldSkipLayer("facts", skipLayers) ? ["facts"] : [],
            ...this.shouldSkipLayer("vector", skipLayers) ? ["vector"] : [],
            ...this.shouldSkipLayer("graph", skipLayers) ? ["graph"] : []
          ]
        },
        {
          // Translate streaming beliefRevision (boolean) to remember() format
          // true → { enabled: true }, false → false, undefined → undefined
          beliefRevision: options?.beliefRevision === true ? { enabled: true } : options?.beliefRevision === false ? false : void 0
        }
      );
      if (graphSync && rememberResult.memories.length > 0) {
        await graphSync.finalizeNode(rememberResult.memories[0]);
      }
      const metricsSnapshot = metrics.getSnapshot();
      const insights = metrics.generateInsights();
      return {
        ...rememberResult,
        fullResponse,
        streamMetrics: metricsSnapshot,
        progressiveProcessing: {
          factsExtractedDuringStream: progressiveFacts,
          partialStorageHistory: storageHandler?.getUpdateHistory() || [],
          graphSyncEvents: graphSync?.getSyncEvents()
        },
        performance: {
          bottlenecks: insights.bottlenecks,
          recommendations: insights.recommendations,
          costEstimate: metricsSnapshot.estimatedCost
        }
      };
    } catch (error) {
      const _streamError = errorRecovery.createStreamError(
        error instanceof Error ? error : new Error(String(error)),
        context,
        "streaming"
      );
      if (options?.partialFailureHandling) {
        const recoveryResult = await errorRecovery.handleStreamError(
          error instanceof Error ? error : new Error(String(error)),
          context,
          {
            strategy: options.partialFailureHandling,
            maxRetries: options.maxRetries,
            retryDelay: options.retryDelay,
            preservePartialData: true
          }
        );
        if (recoveryResult.success && options.generateResumeToken) {
          throw new ResumableStreamError2(
            error instanceof Error ? error : new Error(String(error)),
            recoveryResult.resumeToken || ""
          );
        }
      }
      if (storageHandler) {
        await storageHandler.rollback();
      }
      if (graphSync) {
        await graphSync.rollback();
      }
      throw error;
    }
  }
  /**
   * Forget a memory (delete from Vector and optionally ACID)
   *
   * Auto-syncs to graph if configured (default: true)
   *
   * @example
   * ```typescript
   * await cortex.memory.forget('agent-1', 'mem-123', {
   *   deleteConversation: true,
   * });
   *
   * // Disable graph sync
   * await cortex.memory.forget('agent-1', 'mem-123', {
   *   deleteConversation: true,
   *   syncToGraph: false,
   * });
   * ```
   */
  /**
   * Forget a memory (delete from Vector and optionally ACID)
   *
   * Auto-syncs to graph if configured (default: true)
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to forget
   * @param options - Options for deletion behavior
   * @returns ForgetResult with deletion details
   *
   * @example
   * ```typescript
   * await cortex.memory.forget('user-123-space', 'mem-123', {
   *   deleteConversation: true,
   * });
   *
   * // Disable graph sync
   * await cortex.memory.forget('user-123-space', 'mem-123', {
   *   deleteConversation: true,
   *   syncToGraph: false,
   * });
   * ```
   */
  async forget(memorySpaceId, memoryId, options) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    const memory = await this.vector.get(memorySpaceId, memoryId);
    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }
    await this.vector.delete(memorySpaceId, memoryId);
    const { count: factsDeleted, factIds } = await this.cascadeDeleteFacts(
      memorySpaceId,
      memoryId,
      memory.conversationRef?.conversationId
    );
    let conversationDeleted = false;
    let messagesDeleted = 0;
    if (options?.deleteConversation && memory.conversationRef) {
      if (options.deleteEntireConversation) {
        const conv = await this.conversations.get(
          memory.conversationRef.conversationId
        );
        messagesDeleted = conv?.messageCount || 0;
        await this.conversations.delete(
          memory.conversationRef.conversationId
        );
        conversationDeleted = true;
      } else {
        messagesDeleted = memory.conversationRef.messageIds.length;
      }
    }
    return {
      memoryDeleted: true,
      conversationDeleted,
      messagesDeleted,
      factsDeleted,
      factIds,
      restorable: !options?.deleteConversation
      // Restorable if ACID preserved
    };
  }
  async get(memorySpaceId, memoryId, options) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    const memory = await this.vector.get(memorySpaceId, memoryId);
    if (!memory) {
      return null;
    }
    if (!options?.includeConversation) {
      return memory;
    }
    let conversation = void 0;
    let sourceMessages = void 0;
    if (memory.conversationRef) {
      const conv = await this.conversations.get(
        memory.conversationRef.conversationId
      );
      conversation = conv ?? void 0;
      if (conversation) {
        sourceMessages = conversation.messages.filter(
          (m) => memory.conversationRef.messageIds.includes(m.id)
        );
      }
    }
    const relatedFacts = await this.fetchFactsForMemory(
      memorySpaceId,
      memoryId,
      memory.conversationRef?.conversationId
    );
    return {
      memory,
      conversation,
      sourceMessages,
      facts: relatedFacts.length > 0 ? relatedFacts : void 0
    };
  }
  async search(memorySpaceId, query, options) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateContent(query, "query");
    if (options) {
      validateSearchOptions2(options);
    }
    let effectiveEmbedding = options?.embedding;
    if (!effectiveEmbedding && this.embeddingGenerator && query) {
      try {
        effectiveEmbedding = await this.embeddingGenerator(query) ?? void 0;
      } catch (error) {
        console.warn("[Cortex] Auto-embedding generation failed in search(), falling back to text search:", error);
      }
    }
    const memories = await this.vector.search(memorySpaceId, query, {
      embedding: effectiveEmbedding,
      // BATTERIES INCLUDED: use auto-generated or provided embedding
      userId: options?.userId,
      tags: options?.tags,
      sourceType: options?.sourceType,
      minImportance: options?.minImportance,
      limit: options?.limit,
      minScore: options?.minScore
    });
    if (!options?.enrichConversation) {
      return memories;
    }
    const conversationIds = new Set(
      memories.filter((m) => m.conversationRef).map((m) => m.conversationRef.conversationId)
    );
    const conversations = /* @__PURE__ */ new Map();
    for (const convId of conversationIds) {
      const conv = await this.conversations.get(convId);
      if (conv) {
        conversations.set(convId, conv);
      }
    }
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 1e4
    });
    const factsByMemoryId = /* @__PURE__ */ new Map();
    const factsByConversationId = /* @__PURE__ */ new Map();
    for (const fact of allFacts) {
      if (fact.sourceRef?.memoryId) {
        if (!factsByMemoryId.has(fact.sourceRef.memoryId)) {
          factsByMemoryId.set(fact.sourceRef.memoryId, []);
        }
        factsByMemoryId.get(fact.sourceRef.memoryId).push(fact);
      }
      if (fact.sourceRef?.conversationId) {
        if (!factsByConversationId.has(fact.sourceRef.conversationId)) {
          factsByConversationId.set(fact.sourceRef.conversationId, []);
        }
        factsByConversationId.get(fact.sourceRef.conversationId).push(fact);
      }
    }
    const enriched = memories.map((memory) => {
      const result = { memory };
      if (memory.conversationRef) {
        const conversation = conversations.get(
          memory.conversationRef.conversationId
        );
        if (conversation) {
          result.conversation = conversation;
          result.sourceMessages = conversation.messages.filter(
            (m) => memory.conversationRef.messageIds.includes(m.id)
          );
        }
      }
      const relatedFacts = [
        ...factsByMemoryId.get(memory.memoryId) || [],
        ...memory.conversationRef ? factsByConversationId.get(memory.conversationRef.conversationId) || [] : []
      ];
      const uniqueFacts = Array.from(
        new Map(relatedFacts.map((f) => [f.factId, f])).values()
      );
      if (uniqueFacts.length > 0) {
        result.facts = uniqueFacts;
      }
      return result;
    });
    return enriched;
  }
  /**
   * Recall context from all memory layers with unified orchestration.
   *
   * This is the retrieval counterpart to `remember()`. It orchestrates across:
   * - Vector memories (Layer 2) via semantic search
   * - Facts store (Layer 3) as a primary search source
   * - Graph database for relational context discovery
   *
   * Results are merged, deduplicated, ranked, and formatted for LLM injection.
   *
   * **Batteries Included Defaults:**
   * - All sources enabled (vector, facts, graph)
   * - Graph expansion enabled (if graph configured)
   * - LLM-ready context formatting enabled
   * - Conversation enrichment enabled
   *
   * @example
   * ```typescript
   * // Minimal usage - full orchestration
   * const result = await cortex.memory.recall({
   *   memorySpaceId: 'user-123-space',
   *   query: 'user preferences',
   * });
   *
   * // Inject context into LLM prompt
   * const response = await llm.chat({
   *   messages: [
   *     { role: 'system', content: `Context:\n${result.context}` },
   *     { role: 'user', content: userMessage },
   *   ],
   * });
   *
   * // With semantic search (recommended)
   * const result = await cortex.memory.recall({
   *   memorySpaceId: 'user-123-space',
   *   query: 'user preferences',
   *   embedding: await embed('user preferences'),
   *   userId: 'user-123',
   * });
   * ```
   */
  async recall(params) {
    const startTime = Date.now();
    const observer = params.observer;
    const orchestrationId = observer ? this.generateOrchestrationId() : "";
    const orchestrationStartTime = startTime;
    const layerEvents = {};
    validateRecallParams(params);
    if (observer) {
      this.notifyRecallStart(observer, orchestrationId);
    }
    const sources = {
      vector: params.sources?.vector !== false,
      facts: params.sources?.facts !== false,
      graph: params.sources?.graph !== false && this.graphAdapter !== void 0
    };
    const limits = resolveRecallLimits(params.limits, params.limit);
    const graphExpansionEnabled = params.graphExpansion?.enabled !== false && this.graphAdapter !== void 0 && limits.graphHops > 0;
    const graphExpansionConfig = {
      maxDepth: params.graphExpansion?.maxDepth ?? limits.graphHops,
      relationshipTypes: params.graphExpansion?.relationshipTypes ?? [],
      expandFromFacts: params.graphExpansion?.expandFromFacts !== false,
      expandFromMemories: params.graphExpansion?.expandFromMemories !== false,
      // New: Pass entity limits to graph expansion
      entitiesPerHop: limits.graphEntitiesPerHop,
      resultsPerEntity: limits.graphResultsPerEntity
    };
    const includeConversation = params.includeConversation !== false;
    const formatForLLMFlag = params.formatForLLM !== false;
    const effectiveTenantId = resolveTenantId(this.authContext?.tenantId, params.tenantId);
    let effectiveEmbedding = params.embedding;
    if (!effectiveEmbedding && this.embeddingGenerator && params.query) {
      try {
        effectiveEmbedding = await this.embeddingGenerator(params.query) ?? void 0;
      } catch (error) {
        console.warn("[Cortex] Auto-embedding generation failed, falling back to text search:", error);
      }
    }
    const hasEmbedding = effectiveEmbedding && Array.isArray(effectiveEmbedding) && effectiveEmbedding.length > 0;
    if (observer && sources.vector) {
      const event = this.createLayerEvent(
        "vector",
        "in_progress",
        orchestrationStartTime,
        "recall"
      );
      layerEvents.vector = event;
      this.notifyLayerUpdate(observer, event);
    }
    if (observer && sources.facts) {
      const event = this.createLayerEvent(
        "facts",
        "in_progress",
        orchestrationStartTime,
        "recall"
      );
      layerEvents.facts = event;
      this.notifyLayerUpdate(observer, event);
    }
    const [rawVectorMemories, rawDirectFacts] = await Promise.all([
      // Vector search (uses embedding for semantic matching)
      // Skip search when limits.memories is 0 to gracefully return empty results
      sources.vector && limits.memories > 0 ? this.vector.search(params.memorySpaceId, params.query, {
        embedding: effectiveEmbedding,
        // BATTERIES INCLUDED: use auto-generated or provided embedding
        userId: params.userId,
        tags: params.tags,
        minImportance: params.minImportance,
        limit: limits.memories,
        // Use configured per-source limit
        minScore: 0.3
        // Reasonable threshold
      }) : Promise.resolve([]),
      // Facts search - USE SEMANTIC when embedding available, TEXT otherwise
      // Skip search when limits.facts is 0 to gracefully return empty results
      sources.facts && limits.facts > 0 ? hasEmbedding ? (
        // Semantic search for facts (v0.30.0+) - finds semantically related facts
        this.facts.semanticSearch(params.memorySpaceId, effectiveEmbedding, {
          userId: params.userId,
          tenantId: effectiveTenantId,
          minConfidence: params.minConfidence,
          tags: params.tags,
          createdAfter: params.createdAfter,
          createdBefore: params.createdBefore,
          limit: limits.facts,
          // Use configured per-source limit
          minScore: 0.3
          // Reasonable threshold
        })
      ) : (
        // Fallback to text search when no embedding provided
        this.facts.search(params.memorySpaceId, params.query, {
          userId: params.userId,
          minConfidence: params.minConfidence,
          tags: params.tags,
          createdAfter: params.createdAfter,
          createdBefore: params.createdBefore,
          limit: limits.facts
          // Use configured per-source limit
        })
      ) : Promise.resolve([])
    ]);
    const vectorMemories = effectiveTenantId ? rawVectorMemories.filter((m) => m.tenantId === effectiveTenantId) : rawVectorMemories;
    const directFacts = effectiveTenantId ? rawDirectFacts.filter((f) => f.tenantId === effectiveTenantId) : rawDirectFacts;
    if (observer && sources.vector) {
      const event = this.createLayerEvent(
        "vector",
        "complete",
        orchestrationStartTime,
        "recall",
        {
          metadata: {
            count: vectorMemories.length
          }
        }
      );
      layerEvents.vector = event;
      this.notifyLayerUpdate(observer, event);
    }
    if (observer && sources.facts) {
      const event = this.createLayerEvent(
        "facts",
        "complete",
        orchestrationStartTime,
        "recall",
        {
          metadata: {
            count: directFacts.length
          }
        }
      );
      layerEvents.facts = event;
      this.notifyLayerUpdate(observer, event);
    }
    let graphExpandedMemories = [];
    let graphExpandedFacts = [];
    let discoveredEntities = [];
    if (graphExpansionEnabled && this.graphAdapter) {
      if (observer) {
        const event = this.createLayerEvent(
          "graph",
          "in_progress",
          orchestrationStartTime,
          "recall"
        );
        layerEvents.graph = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        const expansion = await performGraphExpansion(
          vectorMemories,
          directFacts,
          params.memorySpaceId,
          this.graphAdapter,
          this.vector,
          this.facts,
          graphExpansionConfig,
          params.query
          // NEW: Pass query text for entity extraction
        );
        graphExpandedMemories = expansion.relatedMemories;
        graphExpandedFacts = expansion.relatedFacts;
        discoveredEntities = expansion.discoveredEntities;
        if (observer) {
          const event = this.createLayerEvent(
            "graph",
            "complete",
            orchestrationStartTime,
            "recall",
            {
              metadata: {
                expandedMemories: graphExpandedMemories.length,
                expandedFacts: graphExpandedFacts.length,
                discoveredEntities: discoveredEntities.length
              }
            }
          );
          layerEvents.graph = event;
          this.notifyLayerUpdate(observer, event);
        }
      } catch (error) {
        if (observer) {
          const event = this.createLayerEvent(
            "graph",
            "error",
            orchestrationStartTime,
            "recall",
            void 0,
            {
              message: error instanceof Error ? error.message : "Graph expansion failed"
            }
          );
          layerEvents.graph = event;
          this.notifyLayerUpdate(observer, event);
        }
        console.warn(
          "[Cortex] Graph expansion failed, continuing without:",
          error
        );
      }
    } else if (observer && sources.graph) {
      const event = this.createLayerEvent(
        "graph",
        "skipped",
        orchestrationStartTime,
        "recall"
      );
      layerEvents.graph = event;
      this.notifyLayerUpdate(observer, event);
    }
    if (observer) {
      const event = this.createLayerEvent(
        "context",
        "in_progress",
        orchestrationStartTime,
        "recall"
      );
      layerEvents.context = event;
      this.notifyLayerUpdate(observer, event);
    }
    const processedResults = processRecallResults2(
      vectorMemories,
      directFacts,
      graphExpandedMemories,
      graphExpandedFacts,
      discoveredEntities,
      {
        limit: limits.total,
        // Use aggregate limit from resolved limits
        formatForLLM: formatForLLMFlag
      }
    );
    let items = processedResults.items;
    const sourceBreakdown = processedResults.sources;
    const context = processedResults.context;
    if (includeConversation) {
      const conversationIds = /* @__PURE__ */ new Set();
      for (const item of items) {
        if (item.type === "memory" && item.memory?.conversationRef) {
          conversationIds.add(item.memory.conversationRef.conversationId);
        }
      }
      if (conversationIds.size > 0) {
        const conversationsMap = /* @__PURE__ */ new Map();
        for (const convId of conversationIds) {
          try {
            const conv = await this.conversations.get(convId);
            if (conv) {
              conversationsMap.set(convId, conv);
            }
          } catch {
          }
        }
        items = enrichWithConversations(items, conversationsMap);
      }
    }
    if (observer) {
      const event = this.createLayerEvent(
        "context",
        "complete",
        orchestrationStartTime,
        "recall",
        {
          preview: context?.substring(0, 100),
          metadata: {
            memoriesCount: sourceBreakdown.vector.count,
            factsCount: sourceBreakdown.facts.count,
            graphEntitiesCount: sourceBreakdown.graph.count,
            contextLength: context?.length ?? 0
          }
        }
      );
      layerEvents.context = event;
      this.notifyLayerUpdate(observer, event);
    }
    const queryTimeMs = Date.now() - startTime;
    if (observer) {
      const summary = {
        orchestrationId,
        phase: "recall",
        totalLatencyMs: queryTimeMs,
        layers: layerEvents,
        context: {
          formatted: context,
          memoriesCount: sourceBreakdown.vector.count,
          factsCount: sourceBreakdown.facts.count,
          graphEntitiesCount: sourceBreakdown.graph.count
        }
      };
      this.notifyRecallComplete(observer, summary);
    }
    return {
      items,
      sources: sourceBreakdown,
      context,
      totalResults: vectorMemories.length + directFacts.length + graphExpandedMemories.length + graphExpandedFacts.length,
      queryTimeMs,
      graphExpansionApplied: graphExpansionEnabled && discoveredEntities.length > 0
    };
  }
  /**
   * Store memory with smart layer detection and optional fact extraction
   *
   * @param memorySpaceId - Memory space to store the memory in
   * @param input - Memory input data (content, source, metadata, etc.)
   * @returns StoreMemoryResult with memory and extracted facts
   *
   * @example
   * ```typescript
   * await cortex.memory.store('user-123-space', {
   *   content: 'User prefers dark mode',
   *   contentType: 'raw',
   *   source: { type: 'system' },
   *   metadata: { importance: 60, tags: ['preferences'] },
   *   extractFacts: async (content) => [{
   *     fact: 'User prefers dark mode',
   *     factType: 'preference',
   *     confidence: 90,
   *   }],
   * });
   * ```
   */
  async store(memorySpaceId, input) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateStoreMemoryInput(input);
    validateConversationRefRequirement(
      input.source.type,
      input.conversationRef
    );
    const memory = await this.vector.store(memorySpaceId, input);
    const extractedFacts = [];
    if (input.extractFacts) {
      const factsToStore = await input.extractFacts(input.content);
      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            const storedFact = await this.facts.store({
              memorySpaceId,
              participantId: input.participantId,
              userId: input.userId,
              // ← BUG FIX: Add userId to facts!
              fact: factData.fact,
              factType: factData.factType,
              subject: factData.subject || input.userId,
              predicate: factData.predicate,
              object: factData.object,
              confidence: factData.confidence,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sourceType: input.source.type,
              sourceRef: {
                conversationId: input.conversationRef?.conversationId,
                messageIds: input.conversationRef?.messageIds,
                memoryId: memory.memoryId
              },
              tags: factData.tags && factData.tags.length > 0 ? factData.tags : input.metadata.tags
            });
            extractedFacts.push(storedFact);
          } catch (error) {
            console.warn("Failed to store fact:", error);
          }
        }
      }
    }
    return {
      memory,
      facts: extractedFacts
    };
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delegations (Thin Wrappers to Layer 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Update a memory with optional fact re-extraction
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to update
   * @param updates - Fields to update (content, embedding, importance, tags)
   * @param options - Options for update behavior (reextractFacts, syncToGraph)
   * @returns UpdateMemoryResult with updated memory and optionally re-extracted facts
   *
   * @example
   * ```typescript
   * const updated = await cortex.memory.update('user-123-space', 'mem-123', {
   *   content: 'Updated content',
   *   importance: 80,
   * });
   * ```
   */
  async update(memorySpaceId, memoryId, updates, options) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    validateUpdateOptions(updates);
    const updatedMemory = await this.vector.update(
      memorySpaceId,
      memoryId,
      updates
    );
    const factsReextracted = [];
    if (options?.reextractFacts && updates.content && options.extractFacts) {
      await this.cascadeDeleteFacts(memorySpaceId, memoryId, void 0);
      const factsToStore = await options.extractFacts(updates.content);
      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            const storedFact = await this.facts.store({
              memorySpaceId,
              participantId: updatedMemory.participantId,
              // ← BUG FIX: Add participantId
              userId: updatedMemory.userId,
              // ← BUG FIX: Add userId to facts!
              fact: factData.fact,
              factType: factData.factType,
              subject: factData.subject || updatedMemory.userId,
              predicate: factData.predicate,
              object: factData.object,
              confidence: factData.confidence,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sourceType: updatedMemory.sourceType,
              sourceRef: {
                conversationId: updatedMemory.conversationRef?.conversationId,
                messageIds: updatedMemory.conversationRef?.messageIds,
                memoryId: updatedMemory.memoryId
              },
              tags: factData.tags && factData.tags.length > 0 ? factData.tags : updatedMemory.tags
            });
            factsReextracted.push(storedFact);
          } catch (error) {
            console.warn("Failed to re-extract fact:", error);
          }
        }
      }
    }
    return {
      memory: updatedMemory,
      factsReextracted: factsReextracted.length > 0 ? factsReextracted : void 0
    };
  }
  /**
   * Delete a memory with cascade delete of facts
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to delete
   * @param options - Options for deletion behavior (cascadeDeleteFacts, syncToGraph)
   * @returns DeleteMemoryResult with deletion details
   *
   * @example
   * ```typescript
   * const result = await cortex.memory.delete('user-123-space', 'mem-123');
   * console.log(`Deleted ${result.factsDeleted} associated facts`);
   * ```
   */
  async delete(memorySpaceId, memoryId, options) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    const memory = await this.vector.get(memorySpaceId, memoryId);
    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }
    const shouldCascade = options?.cascadeDeleteFacts !== false;
    let factsDeleted = 0;
    let factIds = [];
    if (shouldCascade) {
      const result = await this.cascadeDeleteFacts(
        memorySpaceId,
        memoryId,
        memory.conversationRef?.conversationId
      );
      factsDeleted = result.count;
      factIds = result.factIds;
    }
    await this.vector.delete(memorySpaceId, memoryId);
    return {
      deleted: true,
      memoryId,
      factsDeleted,
      factIds
    };
  }
  async list(filter) {
    validateMemorySpaceId3(filter.memorySpaceId);
    if (filter.userId !== void 0) {
      validateUserId4(filter.userId, "userId");
    }
    if (filter.sourceType !== void 0) {
      validateSourceType3(filter.sourceType);
    }
    if (filter.limit !== void 0) {
      validateLimit5(filter.limit);
    }
    const memories = await this.vector.list(filter);
    if (!filter.enrichFacts) {
      return memories;
    }
    const allFacts = await this.facts.list({
      memorySpaceId: filter.memorySpaceId,
      limit: 1e4
    });
    const factsByMemoryId = /* @__PURE__ */ new Map();
    for (const fact of allFacts) {
      if (fact.sourceRef?.memoryId) {
        if (!factsByMemoryId.has(fact.sourceRef.memoryId)) {
          factsByMemoryId.set(fact.sourceRef.memoryId, []);
        }
        factsByMemoryId.get(fact.sourceRef.memoryId).push(fact);
      }
    }
    return memories.map((memory) => ({
      memory,
      facts: factsByMemoryId.get(memory.memoryId)
    }));
  }
  /**
   * Count memories (delegates to vector.count)
   */
  async count(filter) {
    validateMemorySpaceId3(filter.memorySpaceId);
    if (filter.userId !== void 0) {
      validateUserId4(filter.userId, "userId");
    }
    if (filter.sourceType !== void 0) {
      validateSourceType3(filter.sourceType);
    }
    return await this.vector.count(filter);
  }
  /**
   * Update many memories and track affected facts
   */
  async updateMany(filter, updates) {
    validateMemorySpaceId3(filter.memorySpaceId);
    validateUpdateOptions(updates);
    if (filter.userId !== void 0) {
      validateUserId4(filter.userId, "userId");
    }
    if (filter.sourceType !== void 0) {
      validateSourceType3(filter.sourceType);
    }
    const result = await this.vector.updateMany(filter, updates);
    const allFacts = await this.facts.list({
      memorySpaceId: filter.memorySpaceId,
      limit: 1e4
    });
    const affectedFacts = allFacts.filter(
      (fact) => result.memoryIds.includes(fact.sourceRef?.memoryId || "")
    );
    return {
      ...result,
      factsAffected: affectedFacts.length
    };
  }
  /**
   * Delete many memories with batch cascade delete of facts
   */
  async deleteMany(filter) {
    validateMemorySpaceId3(filter.memorySpaceId);
    validateFilterCombination(filter);
    if (filter.userId !== void 0) {
      validateUserId4(filter.userId, "userId");
    }
    if (filter.sourceType !== void 0) {
      validateSourceType3(filter.sourceType);
    }
    const memories = await this.vector.list(filter);
    let totalFactsDeleted = 0;
    const allFactIds = [];
    for (const memory of memories) {
      const { count, factIds } = await this.cascadeDeleteFacts(
        filter.memorySpaceId,
        memory.memoryId,
        memory.conversationRef?.conversationId
      );
      totalFactsDeleted += count;
      allFactIds.push(...factIds);
    }
    const result = await this.vector.deleteMany(filter);
    return {
      ...result,
      factsDeleted: totalFactsDeleted,
      factIds: allFactIds
    };
  }
  /**
   * Export memories with optional fact inclusion
   */
  async export(options) {
    validateMemorySpaceId3(options.memorySpaceId);
    validateExportFormat4(options.format);
    if (options.userId !== void 0) {
      validateUserId4(options.userId, "userId");
    }
    const result = await this.vector.export(options);
    if (!options.includeFacts) {
      return result;
    }
    const facts = await this.facts.list({
      memorySpaceId: options.memorySpaceId,
      limit: 1e4
    });
    const data = JSON.parse(result.data);
    const enrichedData = data.map((memory) => {
      const relatedFacts = facts.filter(
        (fact) => fact.sourceRef?.memoryId === memory.memoryId
      );
      return {
        ...memory,
        facts: relatedFacts.map((f) => ({
          factId: f.factId,
          fact: f.fact,
          factType: f.factType,
          confidence: f.confidence,
          tags: f.tags
        }))
      };
    });
    return {
      ...result,
      data: JSON.stringify(enrichedData, null, 2)
    };
  }
  /**
   * Archive a memory and mark associated facts as expired
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to archive
   * @returns ArchiveResult with archive details
   *
   * @example
   * ```typescript
   * const result = await cortex.memory.archive('user-123-space', 'mem-123');
   * console.log(`Archived ${result.factsArchived} associated facts`);
   * ```
   */
  async archive(memorySpaceId, memoryId) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    const memory = await this.vector.get(memorySpaceId, memoryId);
    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }
    const { count: factsArchived, factIds } = await this.archiveFacts(
      memorySpaceId,
      memoryId,
      memory.conversationRef?.conversationId
    );
    const result = await this.vector.archive(memorySpaceId, memoryId);
    return {
      ...result,
      factsArchived,
      factIds
    };
  }
  /**
   * Restore memory from archive
   *
   * @example
   * ```typescript
   * const restored = await cortex.memory.restoreFromArchive('agent-1', 'mem-123');
   * ```
   */
  async restoreFromArchive(memorySpaceId, memoryId) {
    validateMemorySpaceId3(memorySpaceId);
    validateMemoryId2(memoryId);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memories.restoreFromArchive, {
        memorySpaceId,
        memoryId
      }),
      "memory:restoreFromArchive"
    );
    return result;
  }
  /**
   * Get specific version of a memory
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to get version for
   * @param version - Version number to retrieve
   * @returns MemoryVersion or null if not found
   *
   * @example
   * ```typescript
   * const v1 = await cortex.memory.getVersion('user-123-space', 'mem-123', 1);
   * if (v1) {
   *   console.log(`Version 1 content: ${v1.content}`);
   * }
   * ```
   */
  async getVersion(memorySpaceId, memoryId, version) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    validateVersion3(version);
    return await this.vector.getVersion(memorySpaceId, memoryId, version);
  }
  /**
   * Get version history of a memory
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to get history for
   * @returns Array of MemoryVersion sorted by version number
   *
   * @example
   * ```typescript
   * const history = await cortex.memory.getHistory('user-123-space', 'mem-123');
   * history.forEach(v => console.log(`v${v.version}: ${v.content}`));
   * ```
   */
  async getHistory(memorySpaceId, memoryId) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    return await this.vector.getHistory(memorySpaceId, memoryId);
  }
  /**
   * Get memory version at specific point in time (temporal query)
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to query
   * @param timestamp - Point in time to query (Date or Unix timestamp)
   * @returns MemoryVersion that was current at that time, or null
   *
   * @example
   * ```typescript
   * const historicalMemory = await cortex.memory.getAtTimestamp(
   *   'user-123-space',
   *   'mem-password',
   *   new Date('2025-08-01')
   * );
   * if (historicalMemory) {
   *   console.log(`Value on Aug 1: ${historicalMemory.content}`);
   * }
   * ```
   */
  async getAtTimestamp(memorySpaceId, memoryId, timestamp) {
    validateMemorySpaceId3(memorySpaceId, "memorySpaceId");
    validateMemoryId2(memoryId);
    validateTimestamp4(timestamp);
    return await this.vector.getAtTimestamp(memorySpaceId, memoryId, timestamp);
  }
};

// src/agents/statistics.ts
var import_values = require("convex/values");
var expected = {
  version: 1,
  code: "CAPABILITY_NOT_READY",
  message: "Access denied or invalid registry input",
  retryable: false,
  outcome: "not_dispatched"
};
var identifyingField = Symbol.for("ConvexError");
function isRegistryStatisticsUnavailable(error) {
  try {
    if (!error || typeof error !== "object" || Object.getPrototypeOf(error) !== import_values.ConvexError.prototype) return false;
    const errorKeys = Reflect.ownKeys(error);
    if (errorKeys.some((key) => !["stack", "message", "name", "data", identifyingField].includes(key))) return false;
    const dataDescriptor = Object.getOwnPropertyDescriptor(error, "data");
    const nameDescriptor = Object.getOwnPropertyDescriptor(error, "name");
    const markerDescriptor = Object.getOwnPropertyDescriptor(error, identifyingField);
    const messageDescriptor = Object.getOwnPropertyDescriptor(error, "message");
    if (!dataDescriptor || !("value" in dataDescriptor) || !nameDescriptor || !("value" in nameDescriptor) || nameDescriptor.value !== "ConvexError" || !markerDescriptor || !("value" in markerDescriptor) || markerDescriptor.value !== true || !messageDescriptor || !("value" in messageDescriptor)) return false;
    const data = dataDescriptor.value;
    if (!data || typeof data !== "object" || Object.getPrototypeOf(data) !== Object.prototype) return false;
    const keys = Reflect.ownKeys(data);
    if (keys.length !== Object.keys(expected).length) return false;
    const captured = {};
    for (const key of keys) {
      if (typeof key !== "string" || !Object.hasOwn(expected, key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(data, key);
      const expectation = Object.getOwnPropertyDescriptor(expected, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !expectation || descriptor.value !== expectation.value) return false;
      captured[key] = descriptor.value;
    }
    const canonical = new import_values.ConvexError(captured);
    return messageDescriptor.value === Object.getOwnPropertyDescriptor(canonical, "message")?.value;
  } catch {
    return false;
  }
}

// src/memorySpaces/index.ts
init_api();

// src/memorySpaces/validators.ts
var MemorySpaceValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "MemorySpaceValidationError";
  }
};
function validateMemorySpaceId4(id, fieldName = "memorySpaceId") {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new MemorySpaceValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_MEMORYSPACE_ID",
      fieldName
    );
  }
  const trimmedId = id.trim();
  if (trimmedId.length > 128) {
    throw new MemorySpaceValidationError(
      `${fieldName} must be 128 characters or less, got ${trimmedId.length}`,
      "INVALID_MEMORYSPACE_ID",
      fieldName
    );
  }
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(trimmedId)) {
    throw new MemorySpaceValidationError(
      `Invalid ${fieldName} format "${trimmedId}". Only alphanumeric characters, hyphens, and underscores are allowed`,
      "INVALID_MEMORYSPACE_ID",
      fieldName
    );
  }
}
var VALID_TYPES = ["personal", "team", "project", "custom"];
var VALID_STATUSES = ["active", "archived"];
function validateMemorySpaceType(type) {
  if (!type || typeof type !== "string") {
    throw new MemorySpaceValidationError(
      "type is required and must be a string",
      "INVALID_TYPE",
      "type"
    );
  }
  if (!VALID_TYPES.includes(type)) {
    throw new MemorySpaceValidationError(
      `Invalid type "${type}". Valid types: ${VALID_TYPES.join(", ")}`,
      "INVALID_TYPE",
      "type"
    );
  }
}
function validateMemorySpaceStatus(status) {
  if (!status || typeof status !== "string") {
    throw new MemorySpaceValidationError(
      "status is required and must be a string",
      "INVALID_STATUS",
      "status"
    );
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new MemorySpaceValidationError(
      `Invalid status "${status}". Valid statuses: ${VALID_STATUSES.join(", ")}`,
      "INVALID_STATUS",
      "status"
    );
  }
}
function validateLimit6(limit, max = 1e3) {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new MemorySpaceValidationError(
      "limit must be a number",
      "INVALID_LIMIT",
      "limit"
    );
  }
  if (limit < 1) {
    throw new MemorySpaceValidationError(
      `limit must be at least 1, got ${limit}`,
      "INVALID_LIMIT",
      "limit"
    );
  }
  if (limit > max) {
    throw new MemorySpaceValidationError(
      `limit must be at most ${max}, got ${limit}`,
      "INVALID_LIMIT",
      "limit"
    );
  }
}
function validateParticipant(participant) {
  if (!participant || typeof participant !== "object") {
    throw new MemorySpaceValidationError(
      "Participant must be an object",
      "INVALID_PARTICIPANT"
    );
  }
  const p = participant;
  if (!p.id || typeof p.id !== "string" || p.id.trim().length === 0) {
    throw new MemorySpaceValidationError(
      "participant.id is required and cannot be empty",
      "MISSING_PARTICIPANT_ID",
      "participant.id"
    );
  }
  if (!p.type || typeof p.type !== "string" || p.type.trim().length === 0) {
    throw new MemorySpaceValidationError(
      "participant.type is required and cannot be empty",
      "MISSING_PARTICIPANT_TYPE",
      "participant.type"
    );
  }
  if (p.joinedAt !== void 0) {
    if (typeof p.joinedAt !== "number" || isNaN(p.joinedAt)) {
      throw new MemorySpaceValidationError(
        "participant.joinedAt must be a number",
        "INVALID_TIMESTAMP",
        "participant.joinedAt"
      );
    }
    if (p.joinedAt < 0) {
      throw new MemorySpaceValidationError(
        `participant.joinedAt must be a positive number, got ${p.joinedAt}`,
        "INVALID_TIMESTAMP",
        "participant.joinedAt"
      );
    }
  }
}
function validateParticipants2(participants) {
  if (!Array.isArray(participants)) {
    throw new MemorySpaceValidationError(
      "participants must be an array",
      "INVALID_PARTICIPANT"
    );
  }
  if (participants.length === 0) {
    return;
  }
  const participantIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    validateParticipant(participant);
    const p = participant;
    if (participantIds.has(p.id)) {
      throw new MemorySpaceValidationError(
        `Duplicate participant ID "${p.id}" found in participants array`,
        "DUPLICATE_PARTICIPANT",
        "participants"
      );
    }
    participantIds.add(p.id);
  }
}
function validateSearchQuery2(query) {
  if (!query || typeof query !== "string") {
    throw new MemorySpaceValidationError(
      "Search query is required and must be a string",
      "EMPTY_QUERY",
      "query"
    );
  }
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    throw new MemorySpaceValidationError(
      "Search query cannot be empty",
      "EMPTY_QUERY",
      "query"
    );
  }
  if (trimmedQuery.length > 500) {
    throw new MemorySpaceValidationError(
      `Search query must be 500 characters or less, got ${trimmedQuery.length}`,
      "EMPTY_QUERY",
      "query"
    );
  }
}
function validateName(name) {
  if (name === void 0) {
    return;
  }
  if (typeof name !== "string") {
    throw new MemorySpaceValidationError(
      "name must be a string",
      "INVALID_NAME",
      "name"
    );
  }
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    throw new MemorySpaceValidationError(
      "name cannot be empty when provided",
      "INVALID_NAME",
      "name"
    );
  }
  if (trimmedName.length > 200) {
    throw new MemorySpaceValidationError(
      `name must be 200 characters or less, got ${trimmedName.length}`,
      "INVALID_NAME",
      "name"
    );
  }
}
var VALID_TIME_WINDOWS = ["24h", "7d", "30d", "90d", "all"];
function validateTimeWindow(timeWindow) {
  if (!timeWindow || typeof timeWindow !== "string") {
    throw new MemorySpaceValidationError(
      "timeWindow is required and must be a string",
      "INVALID_TIME_WINDOW",
      "timeWindow"
    );
  }
  if (!VALID_TIME_WINDOWS.includes(timeWindow)) {
    throw new MemorySpaceValidationError(
      `Invalid timeWindow "${timeWindow}". Valid values: ${VALID_TIME_WINDOWS.join(", ")}`,
      "INVALID_TIME_WINDOW",
      "timeWindow"
    );
  }
}
function validateDeleteOptions(memorySpaceId, options) {
  if (options.cascade !== true) {
    throw new MemorySpaceValidationError(
      "cascade must be true to delete a memory space",
      "CASCADE_REQUIRED",
      "cascade"
    );
  }
  if (!options.reason || typeof options.reason !== "string" || options.reason.trim().length === 0) {
    throw new MemorySpaceValidationError(
      "reason is required and cannot be empty",
      "MISSING_REASON",
      "reason"
    );
  }
  if (options.confirmId !== void 0 && options.confirmId !== memorySpaceId) {
    throw new MemorySpaceValidationError(
      `confirmId "${options.confirmId}" does not match memorySpaceId "${memorySpaceId}"`,
      "CONFIRM_ID_MISMATCH",
      "confirmId"
    );
  }
}
function validateUpdateParams(updates) {
  if (!updates || typeof updates !== "object") {
    throw new MemorySpaceValidationError(
      "Updates must be an object",
      "EMPTY_UPDATES"
    );
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) {
    throw new MemorySpaceValidationError(
      "At least one field must be provided for update",
      "EMPTY_UPDATES"
    );
  }
}

// src/memorySpaces/index.ts
var MemorySpacesAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls (queries that don't go through resilience)
   * Extracts error.data and includes it in the thrown error message
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Register a new memory space
   *
   * @example
   * ```typescript
   * const space = await cortex.memorySpaces.register({
   *   memorySpaceId: 'team-alpha',
   *   name: 'Team Alpha Workspace',
   *   type: 'team',
   *   participants: [
   *     { id: 'user-1', type: 'user', joinedAt: Date.now() },
   *     { id: 'agent-assistant', type: 'agent', joinedAt: Date.now() },
   *   ],
   * });
   * ```
   */
  async register(params, _options) {
    validateMemorySpaceId4(params.memorySpaceId);
    if (!params.type) {
      throw new MemorySpaceValidationError(
        "type is required",
        "MISSING_TYPE",
        "type"
      );
    }
    validateMemorySpaceType(params.type);
    if (params.name !== void 0) {
      validateName(params.name);
    }
    if (params.participants !== void 0) {
      validateParticipants2(params.participants);
    }
    const now = Date.now();
    const participants = params.participants?.map((p) => ({
      ...p,
      joinedAt: now
    })) || [];
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.memorySpaces.register, {
          memorySpaceId: params.memorySpaceId,
          name: params.name,
          type: params.type,
          tenantId: this.authContext?.tenantId,
          // Multi-tenancy: associate space with tenant
          participants,
          metadata: params.metadata
        }),
        "memorySpaces:register"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        await syncMemorySpaceToGraph(result, this.graphAdapter);
      } catch (error) {
        console.warn("Failed to sync memory space to graph:", error);
      }
    }
    return result;
  }
  /**
   * Get memory space by ID
   *
   * @example
   * ```typescript
   * const space = await cortex.memorySpaces.get('team-alpha');
   * ```
   */
  async get(memorySpaceId) {
    validateMemorySpaceId4(memorySpaceId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.memorySpaces.get, {
        memorySpaceId,
        tenantId: this.authContext?.tenantId
        // Multi-tenancy: find space within tenant
      }),
      "memorySpaces:get"
    );
    return result;
  }
  /**
   * List memory spaces with pagination and sorting
   *
   * @example
   * ```typescript
   * // Basic listing
   * const teams = await cortex.memorySpaces.list({
   *   type: 'team',
   *   status: 'active',
   * });
   *
   * // With pagination and sorting
   * const result = await cortex.memorySpaces.list({
   *   type: 'personal',
   *   limit: 20,
   *   offset: 0,
   *   sortBy: 'createdAt',
   *   sortOrder: 'desc',
   * });
   * console.log(`Found ${result.total} spaces, showing ${result.spaces.length}`);
   *
   * // Filter by participant (Hive Mode)
   * const cursorSpaces = await cortex.memorySpaces.list({
   *   participant: 'cursor',
   * });
   * ```
   */
  async list(filter) {
    if (filter?.type) {
      validateMemorySpaceType(filter.type);
    }
    if (filter?.status) {
      validateMemorySpaceStatus(filter.status);
    }
    if (filter?.limit !== void 0) {
      validateLimit6(filter.limit, 1e3);
    }
    if (filter?.participant !== void 0 && filter.participant.trim().length === 0) {
      throw new MemorySpaceValidationError(
        "participant filter cannot be empty",
        "INVALID_PARTICIPANT",
        "participant"
      );
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.memorySpaces.list, {
        type: filter?.type,
        status: filter?.status,
        participant: filter?.participant,
        limit: filter?.limit,
        offset: filter?.offset,
        sortBy: filter?.sortBy,
        sortOrder: filter?.sortOrder,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "memorySpaces:list"
    );
    return result;
  }
  /**
   * Count memory spaces
   *
   * @example
   * ```typescript
   * const activeCount = await cortex.memorySpaces.count({ status: 'active' });
   * ```
   */
  async count(filter) {
    if (filter?.type) {
      validateMemorySpaceType(filter.type);
    }
    if (filter?.status) {
      validateMemorySpaceStatus(filter.status);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.memorySpaces.count, {
        type: filter?.type,
        status: filter?.status
      }),
      "memorySpaces:count"
    );
    return result;
  }
  /**
   * Update memory space metadata
   *
   * @example
   * ```typescript
   * // Update name and status
   * await cortex.memorySpaces.update('team-alpha', {
   *   name: 'Updated Name',
   *   status: 'archived',
   * });
   *
   * // Update with graph sync
   * await cortex.memorySpaces.update('team-alpha', {
   *   metadata: { lastReview: Date.now() },
   * }, { syncToGraph: true });
   * ```
   */
  async update(memorySpaceId, updates, _options) {
    validateMemorySpaceId4(memorySpaceId);
    validateUpdateParams(updates);
    if (updates.name !== void 0) {
      validateName(updates.name);
    }
    if (updates.status !== void 0) {
      validateMemorySpaceStatus(updates.status);
    }
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.memorySpaces.update, {
          memorySpaceId,
          name: updates.name,
          metadata: updates.metadata,
          status: updates.status
        }),
        "memorySpaces:update"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        await syncMemorySpaceToGraph(result, this.graphAdapter);
      } catch (error) {
        console.warn("Failed to sync memory space update to graph:", error);
      }
    }
    return result;
  }
  /**
   * Add participant to memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.addParticipant('team-alpha', {
   *   id: 'tool-analyzer',
   *   type: 'tool',
   *   joinedAt: Date.now(),
   * });
   * ```
   */
  async addParticipant(memorySpaceId, participant) {
    validateMemorySpaceId4(memorySpaceId);
    validateParticipant(participant);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.memorySpaces.addParticipant, {
          memorySpaceId,
          participant
        }),
        "memorySpaces:addParticipant"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Remove participant from memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.removeParticipant('team-alpha', 'tool-analyzer');
   * ```
   */
  async removeParticipant(memorySpaceId, participantId) {
    validateMemorySpaceId4(memorySpaceId);
    if (!participantId || participantId.trim().length === 0) {
      throw new MemorySpaceValidationError(
        "participantId is required and cannot be empty",
        "MISSING_PARTICIPANT_ID",
        "participantId"
      );
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memorySpaces.removeParticipant, {
        memorySpaceId,
        participantId
      }),
      "memorySpaces:removeParticipant"
    );
    return result;
  }
  /**
   * Archive memory space (marks as inactive but preserves data)
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.archive('project-apollo', {
   *   reason: 'Project completed successfully'
   * });
   * ```
   */
  async archive(memorySpaceId, options) {
    validateMemorySpaceId4(memorySpaceId);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memorySpaces.archive, {
        memorySpaceId,
        reason: options?.reason,
        metadata: options?.metadata
      }),
      "memorySpaces:archive"
    );
    return result;
  }
  /**
   * Reactivate archived memory space
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.reactivate('project-apollo');
   * ```
   */
  async reactivate(memorySpaceId) {
    validateMemorySpaceId4(memorySpaceId);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memorySpaces.reactivate, {
        memorySpaceId
      }),
      "memorySpaces:reactivate"
    );
    return result;
  }
  /**
   * Delete memory space and all associated data
   *
   * @example
   * ```typescript
   * // GDPR deletion request
   * const result = await cortex.memorySpaces.delete('user-123-personal', {
   *   cascade: true,
   *   reason: 'GDPR deletion request from user-123',
   *   confirmId: 'user-123-personal', // Safety check
   * });
   *
   * console.log(`Deleted ${result.cascade.memoriesDeleted} memories`);
   * console.log(`Deleted ${result.cascade.conversationsDeleted} conversations`);
   * console.log(`Deleted ${result.cascade.factsDeleted} facts`);
   * ```
   */
  async delete(memorySpaceId, options) {
    validateMemorySpaceId4(memorySpaceId);
    validateDeleteOptions(memorySpaceId, options);
    const space = await this.get(memorySpaceId);
    if (!space) {
      throw new Error(`Memory space not found: ${memorySpaceId}`);
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memorySpaces.deleteSpace, {
        memorySpaceId,
        tenantId: this.authContext?.tenantId,
        // Multi-tenancy: ensure delete is tenant-scoped
        cascade: options.cascade,
        reason: options.reason,
        confirmId: options.confirmId
      }),
      "memorySpaces:delete"
    );
    return result;
  }
  /**
   * Get memory space statistics with optional time window and participant breakdown
   *
   * @example
   * ```typescript
   * // Basic stats
   * const stats = await cortex.memorySpaces.getStats('team-alpha');
   * console.log(`${stats.totalConversations} conversations, ${stats.totalMemories} memories`);
   *
   * // With time window
   * const weekStats = await cortex.memorySpaces.getStats('team-alpha', {
   *   timeWindow: '7d',
   * });
   * console.log(`Activity this week: ${weekStats.memoriesThisWindow} memories`);
   *
   * // With participant breakdown (Hive Mode)
   * const hiveStats = await cortex.memorySpaces.getStats('team-engineering-workspace', {
   *   timeWindow: '7d',
   *   includeParticipants: true,
   * });
   * hiveStats.participants?.forEach((p) => {
   *   console.log(`${p.participantId}: ${p.memoriesStored} memories`);
   * });
   * ```
   */
  async getStats(memorySpaceId, options) {
    validateMemorySpaceId4(memorySpaceId);
    if (options?.timeWindow) {
      validateTimeWindow(options.timeWindow);
    }
    const tenantId = resolveTenantId(this.authContext?.tenantId, options?.tenantId);
    try {
      const result = await this.executeWithResilience(
        async () => {
          try {
            return { stats: await this.client.query(api.memorySpaces.getStats, {
              memorySpaceId,
              tenantId,
              timeWindow: options?.timeWindow,
              includeParticipants: options?.includeParticipants
            }) };
          } catch (error) {
            if (isRegistryStatisticsUnavailable(error)) {
              return { unavailable: error };
            }
            throw error;
          }
        },
        "memorySpaces:getStats"
      );
      if (result.unavailable) throw result.unavailable;
      return result.stats;
    } catch (error) {
      if (isRegistryStatisticsUnavailable(error)) throw error;
      this.handleConvexError(error);
    }
  }
  /**
   * Find memory spaces by participant
   *
   * @example
   * ```typescript
   * const userSpaces = await cortex.memorySpaces.findByParticipant('user-123');
   * ```
   */
  async findByParticipant(participantId) {
    if (!participantId || participantId.trim().length === 0) {
      throw new MemorySpaceValidationError(
        "participantId is required and cannot be empty",
        "MISSING_PARTICIPANT_ID",
        "participantId"
      );
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.memorySpaces.findByParticipant, {
        participantId
      }),
      "memorySpaces:findByParticipant"
    );
    return result;
  }
  /**
   * Search memory spaces by name or metadata
   *
   * @example
   * ```typescript
   * const results = await cortex.memorySpaces.search('engineering', {
   *   type: 'team',
   *   status: 'active',
   *   limit: 10
   * });
   * ```
   */
  async search(query, options) {
    validateSearchQuery2(query);
    if (options?.type) {
      validateMemorySpaceType(options.type);
    }
    if (options?.status) {
      validateMemorySpaceStatus(options.status);
    }
    if (options?.limit !== void 0) {
      validateLimit6(options.limit, 1e3);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.memorySpaces.search, {
        query,
        type: options?.type,
        status: options?.status,
        limit: options?.limit
      }),
      "memorySpaces:search"
    );
    return result;
  }
  /**
   * Update participants (combined add/remove)
   *
   * @example
   * ```typescript
   * await cortex.memorySpaces.updateParticipants('user-123-personal', {
   *   add: [{ id: 'github-copilot', type: 'ai-tool', joinedAt: Date.now() }],
   *   remove: ['old-tool']
   * });
   * ```
   */
  async updateParticipants(memorySpaceId, updates) {
    validateMemorySpaceId4(memorySpaceId);
    if (!updates.add && !updates.remove) {
      throw new MemorySpaceValidationError(
        "At least one of 'add' or 'remove' must be provided",
        "EMPTY_UPDATES"
      );
    }
    if (updates.add && updates.add.length > 0) {
      validateParticipants2(updates.add);
    }
    if (updates.remove && updates.remove.length > 0) {
      for (const id of updates.remove) {
        if (!id || id.trim().length === 0) {
          throw new MemorySpaceValidationError(
            "Participant ID to remove cannot be empty",
            "MISSING_PARTICIPANT_ID"
          );
        }
      }
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.memorySpaces.updateParticipants, {
        memorySpaceId,
        add: updates.add,
        remove: updates.remove
      }),
      "memorySpaces:updateParticipants"
    );
    return result;
  }
};

// src/contexts/index.ts
init_api();

// src/contexts/validators.ts
var ContextsValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "ContextsValidationError";
  }
};
function validateRequiredString3(value, fieldName) {
  if (value === null || value === void 0 || typeof value !== "string" || value.trim().length === 0) {
    throw new ContextsValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_REQUIRED_FIELD",
      fieldName
    );
  }
}
function validatePurpose(purpose) {
  if (!purpose || typeof purpose !== "string") {
    throw new ContextsValidationError(
      "purpose is required and cannot be empty",
      "MISSING_REQUIRED_FIELD",
      "purpose"
    );
  }
  if (purpose.trim().length === 0) {
    throw new ContextsValidationError(
      "purpose cannot contain only whitespace",
      "WHITESPACE_ONLY",
      "purpose"
    );
  }
}
function validateContextIdFormat(contextId) {
  const contextIdRegex = /^ctx-\d+-[a-z0-9]+$/;
  if (!contextIdRegex.test(contextId)) {
    throw new ContextsValidationError(
      `Invalid contextId format "${contextId}". Expected format: "ctx-{timestamp}-{random}" (e.g., "ctx-1234567890-abc123")`,
      "INVALID_CONTEXT_ID_FORMAT",
      "contextId"
    );
  }
}
function validateConversationIdFormat(conversationId) {
  if (!conversationId.startsWith("conv-")) {
    throw new ContextsValidationError(
      `Invalid conversationId format "${conversationId}". Must start with "conv-"`,
      "INVALID_CONVERSATION_ID_FORMAT",
      "conversationId"
    );
  }
}
var VALID_STATUSES2 = ["active", "completed", "cancelled", "blocked"];
function validateStatus(status) {
  if (!status || typeof status !== "string") {
    throw new ContextsValidationError(
      "status is required and must be a string",
      "INVALID_STATUS",
      "status"
    );
  }
  if (!VALID_STATUSES2.includes(status)) {
    throw new ContextsValidationError(
      `Invalid status "${status}". Valid statuses: ${VALID_STATUSES2.join(", ")}`,
      "INVALID_STATUS",
      "status"
    );
  }
}
var VALID_FORMATS = ["json", "csv"];
function validateExportFormat5(format) {
  if (!format || typeof format !== "string") {
    throw new ContextsValidationError(
      "format is required and must be a string",
      "INVALID_FORMAT",
      "format"
    );
  }
  if (!VALID_FORMATS.includes(format)) {
    throw new ContextsValidationError(
      `Invalid format "${format}". Valid formats: ${VALID_FORMATS.join(", ")}`,
      "INVALID_FORMAT",
      "format"
    );
  }
}
function validateDepth(depth) {
  if (typeof depth !== "number" || isNaN(depth)) {
    throw new ContextsValidationError(
      "depth must be a number",
      "INVALID_RANGE",
      "depth"
    );
  }
  if (depth < 0) {
    throw new ContextsValidationError(
      `depth must be >= 0, got ${depth}`,
      "INVALID_RANGE",
      "depth"
    );
  }
}
function validateLimit7(limit) {
  if (typeof limit !== "number" || isNaN(limit)) {
    throw new ContextsValidationError(
      "limit must be a number",
      "INVALID_RANGE",
      "limit"
    );
  }
  if (limit <= 0) {
    throw new ContextsValidationError(
      `limit must be > 0, got ${limit}`,
      "INVALID_RANGE",
      "limit"
    );
  }
  if (limit > 1e3) {
    throw new ContextsValidationError(
      `limit must be <= 1000, got ${limit}`,
      "INVALID_RANGE",
      "limit"
    );
  }
}
function validateVersion4(version) {
  if (typeof version !== "number" || isNaN(version)) {
    throw new ContextsValidationError(
      "version must be a number",
      "INVALID_RANGE",
      "version"
    );
  }
  if (version < 1) {
    throw new ContextsValidationError(
      `version must be >= 1, got ${version}`,
      "INVALID_RANGE",
      "version"
    );
  }
  if (!Number.isInteger(version)) {
    throw new ContextsValidationError(
      `version must be an integer, got ${version}`,
      "INVALID_RANGE",
      "version"
    );
  }
}
function validateTimestamp5(timestamp, fieldName) {
  if (typeof timestamp !== "number" || isNaN(timestamp)) {
    throw new ContextsValidationError(
      `${fieldName} must be a number`,
      "INVALID_RANGE",
      fieldName
    );
  }
  if (timestamp <= 0) {
    throw new ContextsValidationError(
      `${fieldName} must be > 0, got ${timestamp}`,
      "INVALID_RANGE",
      fieldName
    );
  }
}
function validateDataObject(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new ContextsValidationError(
      "data must be an object",
      "INVALID_TYPE",
      "data"
    );
  }
}
function validateConversationRef(ref) {
  if (ref === null || typeof ref !== "object" || Array.isArray(ref)) {
    throw new ContextsValidationError(
      "conversationRef must be an object",
      "INVALID_TYPE",
      "conversationRef"
    );
  }
  const refObj = ref;
  if (!refObj.conversationId || typeof refObj.conversationId !== "string") {
    throw new ContextsValidationError(
      "conversationRef must include conversationId string",
      "MISSING_REQUIRED_FIELD",
      "conversationRef.conversationId"
    );
  }
  validateConversationIdFormat(refObj.conversationId);
  if (refObj.messageIds !== void 0) {
    if (!Array.isArray(refObj.messageIds)) {
      throw new ContextsValidationError(
        "conversationRef.messageIds must be an array",
        "INVALID_TYPE",
        "conversationRef.messageIds"
      );
    }
  }
}
function validateDateObject(date, fieldName) {
  if (!(date instanceof Date)) {
    throw new ContextsValidationError(
      `${fieldName} must be a Date object`,
      "INVALID_DATE",
      fieldName
    );
  }
  if (isNaN(date.getTime())) {
    throw new ContextsValidationError(
      `${fieldName} must be a valid Date object`,
      "INVALID_DATE",
      fieldName
    );
  }
}
function validateUpdatesObject(updates) {
  if (updates === null || typeof updates !== "object" || Array.isArray(updates)) {
    throw new ContextsValidationError(
      "updates must be an object",
      "INVALID_TYPE",
      "updates"
    );
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) {
    throw new ContextsValidationError(
      "updates must include at least one field to update",
      "EMPTY_UPDATES",
      "updates"
    );
  }
}
function validateHasFilters(filters) {
  if (filters === null || typeof filters !== "object" || Array.isArray(filters)) {
    throw new ContextsValidationError(
      "filters must be an object",
      "INVALID_TYPE",
      "filters"
    );
  }
  const hasDefinedFilter = Object.values(filters).some(
    (value) => value !== void 0
  );
  if (!hasDefinedFilter) {
    throw new ContextsValidationError(
      "filters must include at least one defined filter field",
      "EMPTY_FILTERS",
      "filters"
    );
  }
}

// src/contexts/index.ts
var ContextsAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Create a new context
   *
   * @example
   * ```typescript
   * const context = await cortex.contexts.create({
   *   purpose: 'Process customer refund',
   *   memorySpaceId: 'supervisor-space',
   *   userId: 'user-123',
   *   conversationRef: {
   *     conversationId: 'conv-456',
   *     messageIds: ['msg-089'],
   *   },
   * });
   * ```
   */
  async create(params, _options) {
    validatePurpose(params.purpose);
    validateRequiredString3(params.memorySpaceId, "memorySpaceId");
    if (params.userId !== void 0) {
      validateRequiredString3(params.userId, "userId");
    }
    if (params.parentId !== void 0) {
      validateContextIdFormat(params.parentId);
    }
    if (params.status !== void 0) {
      validateStatus(params.status);
    }
    if (params.conversationRef !== void 0) {
      validateConversationRef(params.conversationRef);
    }
    if (params.data !== void 0) {
      validateDataObject(params.data);
    }
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.contexts.create, {
          purpose: params.purpose,
          memorySpaceId: params.memorySpaceId,
          tenantId: this.authContext?.tenantId,
          // Multi-tenancy
          description: params.description,
          userId: params.userId,
          parentId: params.parentId,
          conversationRef: params.conversationRef,
          data: params.data,
          status: params.status
        }),
        "contexts:create"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        const nodeId = await syncContextToGraph(
          result,
          this.graphAdapter
        );
        await syncContextRelationships(
          result,
          nodeId,
          this.graphAdapter
        );
      } catch (error) {
        console.warn("Failed to sync context to graph:", error);
      }
    }
    return result;
  }
  async get(contextId, options) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.get, {
        contextId,
        tenantId: this.authContext?.tenantId,
        // Multi-tenancy
        includeChain: options?.includeChain,
        includeConversation: options?.includeConversation
      }),
      "contexts:get"
    );
    return result;
  }
  /**
   * Update a context
   *
   * @example
   * ```typescript
   * await cortex.contexts.update('ctx-123', {
   *   status: 'completed',
   *   data: { result: 'success' },
   * });
   * ```
   */
  async update(contextId, updates, _options) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    if (updates.status !== void 0) {
      validateStatus(updates.status);
    }
    if (updates.data !== void 0) {
      validateDataObject(updates.data);
    }
    if (updates.completedAt !== void 0) {
      validateTimestamp5(updates.completedAt, "completedAt");
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.contexts.update, {
        contextId,
        tenantId: this.authContext?.tenantId,
        // Multi-tenancy
        status: updates.status,
        description: updates.description,
        data: updates.data,
        completedAt: updates.completedAt
      }),
      "contexts:update"
    );
    if (this.graphAdapter) {
      try {
        const nodes = await this.graphAdapter.findNodes(
          "Context",
          { contextId },
          1
        );
        if (nodes.length > 0) {
          await this.graphAdapter.updateNode(
            nodes[0].id,
            updates
          );
        }
      } catch (error) {
        console.warn("Failed to update context in graph:", error);
      }
    }
    return result;
  }
  /**
   * Delete a context
   *
   * @example
   * ```typescript
   * // Delete single context (must have no children)
   * await cortex.contexts.delete('ctx-123');
   *
   * // Delete context and all descendants
   * await cortex.contexts.delete('ctx-123', { cascadeChildren: true });
   *
   * // Allow orphaning (remove parent, keep children as new roots)
   * await cortex.contexts.delete('ctx-123', { orphanChildren: true });
   * ```
   */
  async delete(contextId, options) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.contexts.deleteContext, {
          contextId,
          tenantId: this.authContext?.tenantId,
          // Multi-tenancy
          cascadeChildren: options?.cascadeChildren,
          orphanChildren: options?.orphanChildren
        }),
        "contexts:delete"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (this.graphAdapter) {
      try {
        await deleteContextFromGraph(contextId, this.graphAdapter, true);
      } catch (error) {
        console.warn("Failed to delete context from graph:", error);
      }
    }
    return result;
  }
  /**
   * List contexts
   *
   * @example
   * ```typescript
   * const contexts = await cortex.contexts.list({
   *   memorySpaceId: 'finance-space',
   *   status: 'active',
   * });
   * ```
   */
  async list(filter) {
    if (filter) {
      if (filter.memorySpaceId !== void 0) {
        validateRequiredString3(filter.memorySpaceId, "memorySpaceId");
      }
      if (filter.userId !== void 0) {
        validateRequiredString3(filter.userId, "userId");
      }
      if (filter.status !== void 0) {
        validateStatus(filter.status);
      }
      if (filter.parentId !== void 0) {
        validateContextIdFormat(filter.parentId);
      }
      if (filter.rootId !== void 0) {
        validateContextIdFormat(filter.rootId);
      }
      if (filter.depth !== void 0) {
        validateDepth(filter.depth);
      }
      if (filter.limit !== void 0) {
        validateLimit7(filter.limit);
      }
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.list, {
        memorySpaceId: filter?.memorySpaceId,
        tenantId: this.authContext?.tenantId,
        // Multi-tenancy
        userId: filter?.userId,
        status: filter?.status,
        parentId: filter?.parentId,
        rootId: filter?.rootId,
        depth: filter?.depth,
        limit: filter?.limit
      }),
      "contexts:list"
    );
    return result;
  }
  /**
   * Count contexts
   *
   * @example
   * ```typescript
   * const count = await cortex.contexts.count({
   *   memorySpaceId: 'supervisor-space',
   *   status: 'active',
   * });
   * ```
   */
  async count(filter) {
    if (filter) {
      if (filter.memorySpaceId !== void 0) {
        validateRequiredString3(filter.memorySpaceId, "memorySpaceId");
      }
      if (filter.userId !== void 0) {
        validateRequiredString3(filter.userId, "userId");
      }
      if (filter.status !== void 0) {
        validateStatus(filter.status);
      }
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.count, {
        memorySpaceId: filter?.memorySpaceId,
        userId: filter?.userId,
        status: filter?.status
      }),
      "contexts:count"
    );
    return result;
  }
  /**
   * Search contexts (alias for list with filters)
   *
   * @example
   * ```typescript
   * const contexts = await cortex.contexts.search({
   *   userId: 'user-123',
   *   status: 'active',
   * });
   * ```
   */
  async search(filter) {
    return await this.list(filter);
  }
  /**
   * Get complete chain from any context
   *
   * @example
   * ```typescript
   * const chain = await cortex.contexts.getChain('ctx-child');
   * console.log(chain.root.purpose);
   * console.log(chain.children.length);
   * ```
   */
  async getChain(contextId) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.getChain, {
        contextId
      }),
      "contexts:getChain"
    );
    return result;
  }
  /**
   * Get root context
   *
   * @example
   * ```typescript
   * const root = await cortex.contexts.getRoot('ctx-deeply-nested');
   * ```
   */
  async getRoot(contextId) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.getRoot, {
        contextId
      }),
      "contexts:getRoot"
    );
    return result;
  }
  /**
   * Get children of a context
   *
   * @example
   * ```typescript
   * const children = await cortex.contexts.getChildren('ctx-root');
   *
   * // Get all descendants recursively
   * const all = await cortex.contexts.getChildren('ctx-root', { recursive: true });
   * ```
   */
  async getChildren(contextId, options) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    if (options?.status !== void 0) {
      validateStatus(options.status);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.getChildren, {
        contextId,
        status: options?.status,
        recursive: options?.recursive
      }),
      "contexts:getChildren"
    );
    return result;
  }
  /**
   * Add participant to context
   *
   * @example
   * ```typescript
   * await cortex.contexts.addParticipant('ctx-123', 'legal-agent-space');
   * ```
   */
  async addParticipant(contextId, participantId) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateRequiredString3(participantId, "participantId");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.contexts.addParticipant, {
        contextId,
        participantId
      }),
      "contexts:addParticipant"
    );
    return result;
  }
  /**
   * Grant cross-space access to a context (Collaboration Mode)
   *
   * @example
   * ```typescript
   * await cortex.contexts.grantAccess('ctx-123', 'partner-space', 'read-only');
   * ```
   */
  async grantAccess(contextId, targetMemorySpaceId, scope) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateRequiredString3(targetMemorySpaceId, "targetMemorySpaceId");
    validateRequiredString3(scope, "scope");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.contexts.grantAccess, {
        contextId,
        targetMemorySpaceId,
        scope
      }),
      "contexts:grantAccess"
    );
    return result;
  }
  /**
   * Update many contexts matching filters
   *
   * @example
   * ```typescript
   * await cortex.contexts.updateMany(
   *   { status: 'completed', completedBefore: Date.now() - 30*24*60*60*1000 },
   *   { data: { archived: true } }
   * );
   * ```
   */
  async updateMany(filters, updates) {
    validateHasFilters(filters);
    validateUpdatesObject(updates);
    if (filters.memorySpaceId !== void 0) {
      validateRequiredString3(filters.memorySpaceId, "memorySpaceId");
    }
    if (filters.userId !== void 0) {
      validateRequiredString3(filters.userId, "userId");
    }
    if (filters.status !== void 0) {
      validateStatus(filters.status);
    }
    if (filters.parentId !== void 0) {
      validateContextIdFormat(filters.parentId);
    }
    if (filters.rootId !== void 0) {
      validateContextIdFormat(filters.rootId);
    }
    if (updates.status !== void 0) {
      validateStatus(updates.status);
    }
    if (updates.data !== void 0) {
      validateDataObject(updates.data);
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.contexts.updateMany, {
        memorySpaceId: filters.memorySpaceId,
        userId: filters.userId,
        status: filters.status,
        parentId: filters.parentId,
        rootId: filters.rootId,
        updates
      }),
      "contexts:updateMany"
    );
    return result;
  }
  /**
   * Delete many contexts matching filters
   *
   * @example
   * ```typescript
   * await cortex.contexts.deleteMany({
   *   status: 'cancelled',
   *   completedBefore: Date.now() - 90*24*60*60*1000
   * }, { cascadeChildren: true });
   * ```
   */
  async deleteMany(filters, options) {
    validateHasFilters(filters);
    if (filters.memorySpaceId !== void 0) {
      validateRequiredString3(filters.memorySpaceId, "memorySpaceId");
    }
    if (filters.userId !== void 0) {
      validateRequiredString3(filters.userId, "userId");
    }
    if (filters.status !== void 0) {
      validateStatus(filters.status);
    }
    if (filters.completedBefore !== void 0) {
      validateTimestamp5(filters.completedBefore, "completedBefore");
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.contexts.deleteMany, {
        memorySpaceId: filters.memorySpaceId,
        userId: filters.userId,
        status: filters.status,
        completedBefore: filters.completedBefore,
        cascadeChildren: options?.cascadeChildren
      }),
      "contexts:deleteMany"
    );
    return result;
  }
  /**
   * Export contexts to JSON or CSV
   *
   * @example
   * ```typescript
   * const exported = await cortex.contexts.export(
   *   { userId: 'user-123' },
   *   { format: 'json', includeChain: true, includeVersionHistory: true }
   * );
   * ```
   */
  async export(filters, options) {
    if (options?.format) {
      validateExportFormat5(options.format);
    }
    if (filters) {
      if (filters.memorySpaceId !== void 0) {
        validateRequiredString3(filters.memorySpaceId, "memorySpaceId");
      }
      if (filters.userId !== void 0) {
        validateRequiredString3(filters.userId, "userId");
      }
      if (filters.status !== void 0) {
        validateStatus(filters.status);
      }
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.exportContexts, {
        memorySpaceId: filters?.memorySpaceId,
        userId: filters?.userId,
        status: filters?.status,
        format: options?.format || "json",
        includeChain: options?.includeChain,
        includeVersionHistory: options?.includeVersionHistory
      }),
      "contexts:export"
    );
    return result;
  }
  /**
   * Remove participant from context
   *
   * @example
   * ```typescript
   * await cortex.contexts.removeParticipant('ctx-123', 'old-agent-space');
   * ```
   */
  async removeParticipant(contextId, participantId) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateRequiredString3(participantId, "participantId");
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.contexts.removeParticipant, {
        contextId,
        participantId
      }),
      "contexts:removeParticipant"
    );
    return result;
  }
  /**
   * Get all contexts originating from a specific conversation
   *
   * @example
   * ```typescript
   * const contexts = await cortex.contexts.getByConversation('conv-456');
   * ```
   */
  async getByConversation(conversationId) {
    validateRequiredString3(conversationId, "conversationId");
    validateConversationIdFormat(conversationId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.getByConversation, {
        conversationId
      }),
      "contexts:getByConversation"
    );
    return result;
  }
  /**
   * Find contexts whose parent no longer exists
   *
   * @example
   * ```typescript
   * const orphaned = await cortex.contexts.findOrphaned();
   * console.log(`Found ${orphaned.length} orphaned contexts`);
   * ```
   */
  async findOrphaned() {
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.findOrphaned, {}),
      "contexts:findOrphaned"
    );
    return result;
  }
  /**
   * Get specific version of a context
   *
   * @example
   * ```typescript
   * const v1 = await cortex.contexts.getVersion('ctx-123', 1);
   * ```
   */
  async getVersion(contextId, version) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateVersion4(version);
    return await this.executeWithResilience(
      () => this.client.query(api.contexts.getVersion, {
        contextId,
        version
      }),
      "contexts:getVersion"
    );
  }
  /**
   * Get all versions of a context
   *
   * @example
   * ```typescript
   * const history = await cortex.contexts.getHistory('ctx-123');
   * console.log(`Context has ${history.length} versions`);
   * ```
   */
  async getHistory(contextId) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.contexts.getHistory, {
        contextId
      }),
      "contexts:getHistory"
    );
    return result;
  }
  /**
   * Get context state at specific point in time
   *
   * @example
   * ```typescript
   * const historical = await cortex.contexts.getAtTimestamp(
   *   'ctx-123',
   *   new Date('2025-10-20')
   * );
   * ```
   */
  async getAtTimestamp(contextId, timestamp) {
    validateRequiredString3(contextId, "contextId");
    validateContextIdFormat(contextId);
    validateDateObject(timestamp, "timestamp");
    return await this.executeWithResilience(
      () => this.client.query(api.contexts.getAtTimestamp, {
        contextId,
        timestamp: timestamp.getTime()
      }),
      "contexts:getAtTimestamp"
    );
  }
};

// src/users/index.ts
init_api();

// src/users/validators.ts
var UserValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "UserValidationError";
  }
};
function validateUserId5(userId, fieldName = "userId") {
  if (userId === null || userId === void 0) {
    throw new UserValidationError(
      `${fieldName} is required`,
      "MISSING_USER_ID",
      fieldName
    );
  }
  if (typeof userId !== "string") {
    throw new UserValidationError(
      `${fieldName} must be a string`,
      "INVALID_USER_ID_FORMAT",
      fieldName
    );
  }
  if (userId.trim().length === 0) {
    throw new UserValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_USER_ID_FORMAT",
      fieldName
    );
  }
}
function validateData2(data, fieldName = "data") {
  if (data === null || data === void 0) {
    throw new UserValidationError(
      `${fieldName} is required`,
      "MISSING_DATA",
      fieldName
    );
  }
  if (typeof data !== "object") {
    throw new UserValidationError(
      `${fieldName} must be an object`,
      "INVALID_DATA_TYPE",
      fieldName
    );
  }
  if (Array.isArray(data)) {
    throw new UserValidationError(
      `${fieldName} must be an object, not an array`,
      "INVALID_DATA_TYPE",
      fieldName
    );
  }
}
function validateVersionNumber(version, fieldName = "version") {
  if (typeof version !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number`,
      "INVALID_VERSION_NUMBER",
      fieldName
    );
  }
  if (isNaN(version) || !isFinite(version)) {
    throw new UserValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_VERSION_NUMBER",
      fieldName
    );
  }
  if (!Number.isInteger(version)) {
    throw new UserValidationError(
      `${fieldName} must be an integer`,
      "INVALID_VERSION_NUMBER",
      fieldName
    );
  }
  if (version < 1) {
    throw new UserValidationError(
      `${fieldName} must be >= 1, got ${version}`,
      "INVALID_VERSION_RANGE",
      fieldName
    );
  }
}
function validateTimestamp6(timestamp, fieldName = "timestamp") {
  if (timestamp === null || timestamp === void 0) {
    throw new UserValidationError(
      `${fieldName} is required`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
  if (typeof timestamp !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number (Unix timestamp)`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
  if (isNaN(timestamp) || !isFinite(timestamp)) {
    throw new UserValidationError(
      `${fieldName} must be a valid numeric timestamp`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
  if (timestamp < 0) {
    throw new UserValidationError(
      `${fieldName} cannot be negative`,
      "INVALID_TIMESTAMP",
      fieldName
    );
  }
}
function validateExportFormat6(format) {
  if (!format || typeof format !== "string") {
    throw new UserValidationError(
      "Export format is required",
      "INVALID_EXPORT_FORMAT",
      "format"
    );
  }
  if (format !== "json" && format !== "csv") {
    throw new UserValidationError(
      `Invalid export format "${format}". Valid formats: json, csv`,
      "INVALID_EXPORT_FORMAT",
      "format"
    );
  }
}
function validateLimit8(limit, fieldName = "limit") {
  if (limit === void 0) {
    return;
  }
  if (typeof limit !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number`,
      "INVALID_LIMIT",
      fieldName
    );
  }
  if (isNaN(limit) || !isFinite(limit)) {
    throw new UserValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_LIMIT",
      fieldName
    );
  }
  if (limit < 1 || limit > 1e3) {
    throw new UserValidationError(
      `${fieldName} must be between 1 and 1000, got ${limit}`,
      "INVALID_LIMIT",
      fieldName
    );
  }
}
function validateOffset3(offset, fieldName = "offset") {
  if (offset === void 0) {
    return;
  }
  if (typeof offset !== "number") {
    throw new UserValidationError(
      `${fieldName} must be a number`,
      "INVALID_OFFSET",
      fieldName
    );
  }
  if (isNaN(offset) || !isFinite(offset)) {
    throw new UserValidationError(
      `${fieldName} must be a valid number`,
      "INVALID_OFFSET",
      fieldName
    );
  }
  if (offset < 0) {
    throw new UserValidationError(
      `${fieldName} must be >= 0, got ${offset}`,
      "INVALID_OFFSET",
      fieldName
    );
  }
}
function validateListUsersFilter(filters) {
  if (filters === void 0) {
    return;
  }
  if (typeof filters !== "object" || filters === null) {
    throw new UserValidationError(
      "Filters must be an object",
      "INVALID_FILTER_STRUCTURE",
      "filters"
    );
  }
  if (filters.limit !== void 0) {
    validateLimit8(filters.limit, "filters.limit");
  }
  if (filters.offset !== void 0) {
    validateOffset3(filters.offset, "filters.offset");
  }
  if (filters.createdAfter !== void 0) {
    validateTimestamp6(filters.createdAfter, "filters.createdAfter");
  }
  if (filters.createdBefore !== void 0) {
    validateTimestamp6(filters.createdBefore, "filters.createdBefore");
  }
  if (filters.updatedAfter !== void 0) {
    validateTimestamp6(filters.updatedAfter, "filters.updatedAfter");
  }
  if (filters.updatedBefore !== void 0) {
    validateTimestamp6(filters.updatedBefore, "filters.updatedBefore");
  }
  if (filters.createdAfter !== void 0 && filters.createdBefore !== void 0 && filters.createdAfter >= filters.createdBefore) {
    throw new UserValidationError(
      "createdAfter must be before createdBefore",
      "INVALID_DATE_RANGE",
      "filters.createdAfter"
    );
  }
  if (filters.updatedAfter !== void 0 && filters.updatedBefore !== void 0 && filters.updatedAfter >= filters.updatedBefore) {
    throw new UserValidationError(
      "updatedAfter must be before updatedBefore",
      "INVALID_DATE_RANGE",
      "filters.updatedAfter"
    );
  }
  if (filters.sortBy !== void 0) {
    if (filters.sortBy !== "createdAt" && filters.sortBy !== "updatedAt") {
      throw new UserValidationError(
        "sortBy must be 'createdAt' or 'updatedAt'",
        "INVALID_SORT_BY",
        "filters.sortBy"
      );
    }
  }
  if (filters.sortOrder !== void 0) {
    if (filters.sortOrder !== "asc" && filters.sortOrder !== "desc") {
      throw new UserValidationError(
        "sortOrder must be 'asc' or 'desc'",
        "INVALID_SORT_ORDER",
        "filters.sortOrder"
      );
    }
  }
  if (filters.displayName !== void 0) {
    if (typeof filters.displayName !== "string") {
      throw new UserValidationError(
        "displayName must be a string",
        "INVALID_DISPLAY_NAME_FILTER",
        "filters.displayName"
      );
    }
    if (filters.displayName.length > 200) {
      throw new UserValidationError(
        "displayName filter cannot exceed 200 characters",
        "INVALID_DISPLAY_NAME_FILTER",
        "filters.displayName"
      );
    }
  }
  if (filters.email !== void 0) {
    if (typeof filters.email !== "string") {
      throw new UserValidationError(
        "email must be a string",
        "INVALID_EMAIL_FILTER",
        "filters.email"
      );
    }
    if (filters.email.length > 254) {
      throw new UserValidationError(
        "email filter cannot exceed 254 characters",
        "INVALID_EMAIL_FILTER",
        "filters.email"
      );
    }
  }
}
function validateUserFilters(filters) {
  validateListUsersFilter(filters);
}
function validateDeleteUserOptions(options) {
  if (options === void 0) {
    return;
  }
  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DELETE_OPTIONS",
      "options"
    );
  }
  if (options.cascade !== void 0 && typeof options.cascade !== "boolean") {
    throw new UserValidationError(
      "options.cascade must be a boolean",
      "INVALID_DELETE_OPTIONS",
      "options.cascade"
    );
  }
  if (options.verify !== void 0 && typeof options.verify !== "boolean") {
    throw new UserValidationError(
      "options.verify must be a boolean",
      "INVALID_DELETE_OPTIONS",
      "options.verify"
    );
  }
  if (options.dryRun !== void 0 && typeof options.dryRun !== "boolean") {
    throw new UserValidationError(
      "options.dryRun must be a boolean",
      "INVALID_DELETE_OPTIONS",
      "options.dryRun"
    );
  }
}
function validateUserIdsArray(userIds, minLength = 1, maxLength = 100) {
  if (!Array.isArray(userIds)) {
    throw new UserValidationError(
      "userIds must be an array",
      "INVALID_DATA_TYPE",
      "userIds"
    );
  }
  if (userIds.length < minLength) {
    throw new UserValidationError(
      `userIds array cannot be empty`,
      "EMPTY_USER_IDS_ARRAY",
      "userIds"
    );
  }
  if (userIds.length > maxLength) {
    throw new UserValidationError(
      `userIds array cannot exceed ${maxLength} items, got ${userIds.length}`,
      "USER_ID_ARRAY_TOO_LARGE",
      "userIds"
    );
  }
  for (let i = 0; i < userIds.length; i++) {
    try {
      validateUserId5(userIds[i], `userIds[${i}]`);
    } catch (error) {
      if (error instanceof UserValidationError) {
        throw new UserValidationError(
          `Invalid userId at index ${i}: ${error.message}`,
          error.code,
          `userIds[${i}]`
        );
      }
      throw error;
    }
  }
  const uniqueIds = new Set(userIds);
  if (uniqueIds.size !== userIds.length) {
    throw new UserValidationError(
      "Duplicate userIds found in array",
      "INVALID_DATA_TYPE",
      "userIds"
    );
  }
}
function validateBulkUpdateOptions(options) {
  if (options === void 0) {
    return;
  }
  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DATA_TYPE",
      "options"
    );
  }
  if (options.skipVersioning !== void 0 && typeof options.skipVersioning !== "boolean") {
    throw new UserValidationError(
      "options.skipVersioning must be a boolean",
      "INVALID_DATA_TYPE",
      "options.skipVersioning"
    );
  }
  if (options.dryRun !== void 0 && typeof options.dryRun !== "boolean") {
    throw new UserValidationError(
      "options.dryRun must be a boolean",
      "INVALID_DATA_TYPE",
      "options.dryRun"
    );
  }
}
function validateBulkDeleteOptions(options) {
  if (options === void 0) {
    return;
  }
  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DATA_TYPE",
      "options"
    );
  }
  if (options.cascade !== void 0 && typeof options.cascade !== "boolean") {
    throw new UserValidationError(
      "options.cascade must be a boolean",
      "INVALID_DATA_TYPE",
      "options.cascade"
    );
  }
  if (options.dryRun !== void 0 && typeof options.dryRun !== "boolean") {
    throw new UserValidationError(
      "options.dryRun must be a boolean",
      "INVALID_DATA_TYPE",
      "options.dryRun"
    );
  }
}
function validateExportOptions2(options) {
  if (options === void 0) {
    throw new UserValidationError(
      "Export options are required",
      "MISSING_REQUIRED_PARAMETER",
      "options"
    );
  }
  if (typeof options !== "object" || options === null) {
    throw new UserValidationError(
      "Options must be an object",
      "INVALID_DATA_TYPE",
      "options"
    );
  }
  validateExportFormat6(options.format);
  if (options.filters !== void 0) {
    validateUserFilters(options.filters);
  }
}

// src/users/index.ts
var CascadeDeletionError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "CascadeDeletionError";
  }
};
var UserProfileWriteReceiptError = class extends Error {
  code = "PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE";
  retryable = false;
  outcome = "committed";
  requiredCapability = "read";
  receipt;
  constructor(receipt) {
    super(
      "The user profile write committed, but the updated profile is unavailable without read capability. Do not retry the committed write."
    );
    this.name = "UserProfileWriteReceiptError";
    this.receipt = Object.freeze({
      updated: receipt.updated,
      type: receipt.type,
      id: receipt.id,
      tenantId: receipt.tenantId,
      memorySpaceId: receipt.memorySpaceId,
      ...receipt.createdId === void 0 ? {} : { createdId: receipt.createdId }
    });
  }
};
var UsersAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Get user profile by ID
   *
   * @example
   * ```typescript
   * const user = await cortex.users.get('user-123');
   * if (user) {
   *   console.log(user.data.displayName);
   * }
   * ```
   */
  async get(userId) {
    validateUserId5(userId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.get, {
        type: "user",
        id: userId,
        tenantId: this.authContext?.tenantId
        // Tenant isolation
      }),
      "users:get"
    );
    if (!result) {
      return null;
    }
    if (result.tenantId && this.authContext?.tenantId) {
      if (result.tenantId !== this.authContext.tenantId) {
        return null;
      }
    }
    return {
      id: result.id,
      tenantId: result.tenantId,
      // Include tenantId in response
      data: result.data ?? {},
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    };
  }
  /**
   * Update user profile (creates new version by default)
   *
   * Throws UserProfileWriteReceiptError if the write committed but the backend
   * returned a safe receipt because the updated profile could not be read.
   *
   * @param userId - User ID to update
   * @param data - Profile data to store
   * @param options - Update options
   * @param options.skipVersioning - Don't create new version (default: false)
   * @param options.versionReason - Why this update happened (stored in metadata)
   * @param options.merge - Merge with existing data (default: true)
   *
   * @example
   * ```typescript
   * // Basic update (merges with existing, creates new version)
   * const updated = await cortex.users.update('user-123', {
   *   displayName: 'Alex Johnson',
   *   email: 'alex@example.com',
   *   preferences: { theme: 'dark' }
   * });
   *
   * // Skip versioning for routine updates
   * await cortex.users.update('user-123', {
   *   lastSeen: new Date().toISOString()
   * ```
   */
  async update(userId, data) {
    validateUserId5(userId);
    validateData2(data, "data");
    let finalData = data;
    const existing = await this.get(userId);
    if (existing) {
      finalData = this.deepMerge(existing.data, data);
    }
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.immutable.store, {
        type: "user",
        id: userId,
        data: finalData,
        tenantId: this.authContext?.tenantId
        // Inject tenantId from auth context
      }),
      "users:update"
    );
    if (!result) {
      throw new Error("Failed to store user profile");
    }
    if ("updated" in result) {
      throw new UserProfileWriteReceiptError(result);
    }
    return {
      id: result.id,
      tenantId: result.tenantId,
      // Include tenantId in response
      data: result.data ?? {},
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    };
  }
  /**
   * Delete user profile with optional cascade deletion across all layers
   *
   * @param userId - User ID to delete
   * @param options - Deletion options
   * @param options.cascade - Enable cascade deletion across all layers (default: false)
   * @param options.verify - Run verification after deletion (default: true)
   * @param options.dryRun - Preview what would be deleted without actually deleting (default: false)
   *
   * @example
   * ```typescript
   * // Simple deletion (user profile only)
   * await cortex.users.delete('user-123');
   *
   * // GDPR cascade deletion (all layers)
   * const result = await cortex.users.delete('user-123', {
   *   cascade: true
   * });
   * console.log(`Deleted ${result.totalDeleted} records across ${result.deletedLayers.length} layers`);
   * ```
   */
  async delete(userId, options) {
    validateUserId5(userId);
    validateDeleteUserOptions(options);
    const cascade = options?.cascade ?? false;
    const verify = options?.verify ?? true;
    const dryRun = options?.dryRun ?? false;
    if (!cascade) {
      if (!dryRun) {
        await this.executeWithResilience(
          () => this.client.mutation(api.immutable.purge, {
            type: "user",
            id: userId,
            tenantId: this.authContext?.tenantId
            // Multi-tenancy: scope to tenant
          }),
          "users:delete"
        );
      }
      return {
        userId,
        deletedAt: Date.now(),
        conversationsDeleted: 0,
        conversationMessagesDeleted: 0,
        immutableRecordsDeleted: 0,
        mutableKeysDeleted: 0,
        vectorMemoriesDeleted: 0,
        factsDeleted: 0,
        graphNodesDeleted: 0,
        verification: {
          complete: true,
          issues: []
        },
        totalDeleted: dryRun ? 0 : 1,
        deletedLayers: dryRun ? [] : ["user-profile"]
      };
    }
    const deletionPlan = await this.collectDeletionTargets(userId);
    const totals = this.calculateDeletionTotals(deletionPlan);
    if (dryRun) {
      return {
        userId,
        deletedAt: Date.now(),
        ...totals,
        verification: {
          complete: true,
          issues: [
            `DRY RUN: Would delete ${totals.totalDeleted} total records`
          ]
        },
        deletedLayers: this.getAffectedLayers(deletionPlan)
      };
    }
    const backups = await this.backupRecords(deletionPlan);
    try {
      const result = await this.executeCascadeDeletion(userId, deletionPlan);
      if (verify) {
        const verification = await this.verifyDeletion(userId);
        result.verification = verification;
      }
      return result;
    } catch (error) {
      await this.rollbackDeletion(backups);
      throw new CascadeDeletionError(
        `Cascade deletion failed for user ${userId}, rolled back all changes`,
        error
      );
    }
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Query Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * List user profiles with pagination, filtering, and sorting
   *
   * @param filters - Filter and pagination options
   * @returns ListUsersResult with pagination metadata
   *
   * @example
   * ```typescript
   * // Basic listing with limit
   * const result = await cortex.users.list({ limit: 50 });
   * console.log(`Found ${result.total} users, showing ${result.users.length}`);
   *
   * // With date filters and sorting
   * const recent = await cortex.users.list({
   *   createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000,
   *   sortBy: 'createdAt',
   *   sortOrder: 'desc',
   *   limit: 20
   * });
   *
   * // Pagination
   * const page2 = await cortex.users.list({ limit: 10, offset: 10 });
   * ```
   */
  async list(filters) {
    validateListUsersFilter(filters);
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.list, {
        type: "user",
        limit: filters?.limit,
        offset: filters?.offset,
        createdAfter: filters?.createdAfter,
        createdBefore: filters?.createdBefore,
        updatedAfter: filters?.updatedAfter,
        updatedBefore: filters?.updatedBefore,
        sortBy: filters?.sortBy,
        sortOrder: filters?.sortOrder,
        tenantId: this.authContext?.tenantId
        // Inject tenantId for tenant isolation
      }),
      "users:list"
    );
    const entries = result.entries;
    const total = result.total;
    const hasMore = result.hasMore;
    let users = entries.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      // Include tenantId for multi-tenancy
      data: r.data,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    if (filters?.displayName) {
      const searchName = filters.displayName.toLowerCase();
      users = users.filter((u) => {
        const name = u.data.displayName;
        return name?.toLowerCase().includes(searchName);
      });
    }
    if (filters?.email) {
      const searchEmail = filters.email.toLowerCase();
      users = users.filter((u) => {
        const email = u.data.email;
        return email?.toLowerCase().includes(searchEmail);
      });
    }
    return {
      users,
      total,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
      hasMore
    };
  }
  /**
   * Search user profiles with filters
   *
   * @param filters - Filter, sorting, and pagination options
   * @returns Array of matching user profiles
   *
   * @example
   * ```typescript
   * // Search with date filter
   * const recentUsers = await cortex.users.search({
   *   createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
   *   limit: 100
   * });
   *
   * // Search by displayName (client-side filter)
   * const alexUsers = await cortex.users.search({
   *   displayName: 'alex',
   *   limit: 50
   * });
   *
   * // Search with sorting
   * const sorted = await cortex.users.search({
   *   sortBy: 'updatedAt',
   *   sortOrder: 'desc'
   * });
   * ```
   */
  async search(filters) {
    validateUserFilters(filters);
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.list, {
        type: "user",
        limit: filters.limit,
        offset: filters.offset,
        createdAfter: filters.createdAfter,
        createdBefore: filters.createdBefore,
        updatedAfter: filters.updatedAfter,
        updatedBefore: filters.updatedBefore,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        tenantId: this.authContext?.tenantId
        // Multi-tenancy: scope to tenant
      }),
      "users:search"
    );
    const entries = result.entries;
    let users = entries.map((r) => ({
      id: r.id,
      data: r.data,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    if (filters.displayName) {
      const searchName = filters.displayName.toLowerCase();
      users = users.filter((u) => {
        const name = u.data.displayName;
        return name?.toLowerCase().includes(searchName);
      });
    }
    if (filters.email) {
      const searchEmail = filters.email.toLowerCase();
      users = users.filter((u) => {
        const email = u.data.email;
        return email?.toLowerCase().includes(searchEmail);
      });
    }
    return users;
  }
  /**
   * Count user profiles with optional filters
   *
   * @param filters - Optional filter parameters
   * @returns Count of matching user profiles
   *
   * @example
   * ```typescript
   * // Total users
   * const total = await cortex.users.count();
   * console.log(`Total users: ${total}`);
   *
   * // Count recent users (last 30 days)
   * const recentCount = await cortex.users.count({
   *   createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000
   * });
   *
   * // Count users updated this week
   * const activeCount = await cortex.users.count({
   *   updatedAfter: Date.now() - 7 * 24 * 60 * 60 * 1000
   * });
   * ```
   */
  async count(filters) {
    validateUserFilters(filters);
    return await this.executeWithResilience(
      () => this.client.query(api.immutable.count, {
        type: "user",
        createdAfter: filters?.createdAfter,
        createdBefore: filters?.createdBefore,
        updatedAfter: filters?.updatedAfter,
        updatedBefore: filters?.updatedBefore
        // Note: count doesn't have tenantId filter in Convex schema yet
      }),
      "users:count"
    );
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Version Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Get specific version of user profile
   *
   * @example
   * ```typescript
   * const v1 = await cortex.users.getVersion('user-123', 1);
   * ```
   */
  async getVersion(userId, version) {
    validateUserId5(userId);
    validateVersionNumber(version);
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.getVersion, {
        type: "user",
        id: userId,
        version,
        tenantId: this.authContext?.tenantId
        // Multi-tenancy: scope to tenant
      }),
      "users:getVersion"
    );
    if (!result) {
      return null;
    }
    return {
      version: result.version,
      data: result.data ?? {},
      timestamp: result.timestamp
    };
  }
  /**
   * Get version history of user profile
   *
   * @example
   * ```typescript
   * const history = await cortex.users.getHistory('user-123');
   * console.log(`User has ${history.length} versions`);
   * ```
   */
  async getHistory(userId) {
    validateUserId5(userId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.getHistory, {
        type: "user",
        id: userId
      }),
      "users:getHistory"
    );
    return result.map(
      (v) => ({
        version: v.version,
        data: v.data ?? {},
        timestamp: v.timestamp
      })
    );
  }
  /**
   * Get user profile at specific timestamp
   *
   * @example
   * ```typescript
   * const snapshot = await cortex.users.getAtTimestamp(
   *   'user-123',
   *   new Date('2025-10-01')
   * );
   * ```
   */
  async getAtTimestamp(userId, timestamp) {
    validateUserId5(userId);
    validateTimestamp6(timestamp.getTime());
    const result = await this.executeWithResilience(
      () => this.client.query(api.immutable.getAtTimestamp, {
        type: "user",
        id: userId,
        timestamp: timestamp.getTime()
      }),
      "users:getAtTimestamp"
    );
    if (!result) {
      return null;
    }
    return {
      version: result.version,
      data: result.data ?? {},
      timestamp: result.timestamp
    };
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Utility Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Check if user profile exists
   *
   * @example
   * ```typescript
   * if (await cortex.users.exists('user-123')) {
   *   console.log('User exists');
   * }
   * ```
   */
  async exists(userId) {
    validateUserId5(userId);
    const user = await this.get(userId);
    return user !== null;
  }
  /**
   * Get user profile or create with defaults if doesn't exist
   *
   * @param userId - User ID
   * @param defaults - Default profile data if user doesn't exist
   * @returns User profile (existing or newly created)
   *
   * @example
   * ```typescript
   * const user = await cortex.users.getOrCreate('user-123', {
   *   displayName: 'Guest User',
   *   preferences: { theme: 'light' },
   *   metadata: { tier: 'free' }
   * });
   * ```
   */
  async getOrCreate(userId, defaults) {
    validateUserId5(userId);
    if (defaults !== void 0) {
      validateData2(defaults, "defaults");
    }
    const existing = await this.get(userId);
    if (existing) {
      return existing;
    }
    return await this.update(userId, defaults || {});
  }
  /**
   * Merge partial updates with existing profile
   *
   * This is an alias for update() with merge behavior, which is the default.
   *
   * @param userId - User ID
   * @param updates - Partial updates to merge with existing data
   * @returns Updated user profile
   *
   * @example
   * ```typescript
   * // Existing: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en' } }
   * await cortex.users.merge('user-123', {
   *   preferences: { notifications: true }  // Adds notifications, keeps theme and language
   * });
   * // Result: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en', notifications: true } }
   * ```
   */
  async merge(userId, updates) {
    validateUserId5(userId);
    validateData2(updates, "updates");
    const existing = await this.get(userId);
    if (!existing) {
      return await this.update(userId, updates);
    }
    const mergedData = this.deepMerge(existing.data, updates);
    return await this.update(userId, mergedData);
  }
  /**
   * Helper: Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue) && targetValue && typeof targetValue === "object" && !Array.isArray(targetValue)) {
          result[key] = this.deepMerge(
            targetValue,
            sourceValue
          );
        } else {
          result[key] = sourceValue;
        }
      }
    }
    return result;
  }
  /**
   * Export user profiles with optional related data
   *
   * @param options - Export options including format and what to include
   * @returns Exported data as JSON or CSV string
   *
   * @example
   * ```typescript
   * // Basic JSON export
   * const json = await cortex.users.export({ format: 'json' });
   *
   * // Export with version history
   * const withHistory = await cortex.users.export({
   *   format: 'json',
   *   includeVersionHistory: true
   * });
   *
   * // Full GDPR export with conversations and memories
   * const gdprExport = await cortex.users.export({
   *   format: 'json',
   *   filters: { displayName: 'alex' },
   *   includeVersionHistory: true,
   *   includeConversations: true,
   *   includeMemories: true
   * });
   * ```
   */
  async export(options) {
    validateExportOptions2(options);
    const result = await this.list(options?.filters);
    const users = result.users;
    const exportData = [];
    for (const user of users) {
      const userData = {
        id: user.id,
        data: user.data,
        version: user.version,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      if (options?.includeVersionHistory) {
        try {
          const history = await this.getHistory(user.id);
          userData.versionHistory = history;
        } catch (_e) {
        }
      }
      if (options?.includeConversations) {
        try {
          const convosResult = await this.client.query(api.conversations.list, {
            userId: user.id
          });
          const convos = Array.isArray(convosResult) ? convosResult : convosResult.conversations;
          userData.conversations = convos;
        } catch (_e) {
        }
      }
      if (options?.includeMemories) {
        try {
          const allMemories = [];
          if (userData.conversations && userData.conversations.length > 0) {
            const memorySpaceIds = /* @__PURE__ */ new Set();
            for (const convo of userData.conversations) {
              if (convo.memorySpaceId) {
                memorySpaceIds.add(convo.memorySpaceId);
              }
            }
            for (const memorySpaceId of memorySpaceIds) {
              try {
                const memories = await this.client.query(api.memories.list, {
                  memorySpaceId,
                  userId: user.id
                });
                if (Array.isArray(memories)) {
                  allMemories.push(...memories);
                }
              } catch (_memErr) {
              }
            }
          }
          userData.memories = allMemories;
        } catch (_e) {
        }
      }
      exportData.push(userData);
    }
    if (options?.format === "csv") {
      const headers = [
        "id",
        "version",
        "createdAt",
        "updatedAt",
        "data",
        ...options.includeVersionHistory ? ["versionHistoryCount"] : [],
        ...options.includeConversations ? ["conversationsCount"] : [],
        ...options.includeMemories ? ["memoriesCount"] : []
      ];
      const rows = exportData.map((u) => [
        u.id,
        u.version.toString(),
        new Date(u.createdAt).toISOString(),
        new Date(u.updatedAt).toISOString(),
        JSON.stringify(u.data),
        ...options.includeVersionHistory ? [(u.versionHistory?.length || 0).toString()] : [],
        ...options.includeConversations ? [(u.conversations?.length || 0).toString()] : [],
        ...options.includeMemories ? [(u.memories?.length || 0).toString()] : []
      ]);
      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }
    return JSON.stringify(exportData, null, 2);
  }
  /**
   * Bulk update multiple users by explicit IDs or filters
   *
   * @param userIdsOrFilters - Array of user IDs OR UserFilters object
   * @param updates - Updates to apply to matching users
   * @param options - Update options
   * @returns Update result with count and affected userIds
   * @throws UserProfileWriteReceiptError if an item committed without a readable
   * profile. Earlier items may already have committed; do not replay the batch.
   *
   * @example
   * ```typescript
   * // Update by explicit IDs
   * const result = await cortex.users.updateMany(
   *   ['user-1', 'user-2', 'user-3'],
   *   { data: { status: 'active' } }
   * );
   *
   * // Update by filters (all users created in last 7 days)
   * const filtered = await cortex.users.updateMany(
   *   { createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000 },
   *   { data: { welcomeEmailSent: true } }
   * );
   *
   * // Dry run to preview
   * const preview = await cortex.users.updateMany(
   *   { displayName: 'alex' },
   *   { data: { verified: true } },
   *   { dryRun: true }
   * );
   * console.log(`Would update ${preview.userIds.length} users`);
   * ```
   */
  async updateMany(userIdsOrFilters, updates, options) {
    if (!updates || !updates.data) {
      throw new UserValidationError(
        "updates.data is required",
        "MISSING_DATA",
        "updates.data"
      );
    }
    validateData2(updates.data, "updates.data");
    validateBulkUpdateOptions(options);
    let targetUserIds;
    if (Array.isArray(userIdsOrFilters)) {
      validateUserIdsArray(userIdsOrFilters, 1, 100);
      targetUserIds = userIdsOrFilters;
    } else {
      validateUserFilters(userIdsOrFilters);
      const matchingUsers = await this.search(userIdsOrFilters);
      targetUserIds = matchingUsers.map((u) => u.id);
      if (targetUserIds.length > 100) {
        throw new UserValidationError(
          `Filter matched ${targetUserIds.length} users, maximum is 100. Add more specific filters or use limit.`,
          "TOO_MANY_MATCHES",
          "filters"
        );
      }
    }
    if (options?.dryRun) {
      return {
        updated: 0,
        userIds: targetUserIds
      };
    }
    const results = [];
    for (const userId of targetUserIds) {
      try {
        const user = await this.get(userId);
        if (user) {
          await this.update(userId, updates.data);
          results.push(userId);
        }
      } catch (error) {
        if (error instanceof UserProfileWriteReceiptError) {
          throw error;
        }
        continue;
      }
    }
    return {
      updated: results.length,
      userIds: results
    };
  }
  /**
   * Bulk delete multiple users by explicit IDs or filters
   *
   * @param userIdsOrFilters - Array of user IDs OR UserFilters object
   * @param options - Delete options (cascade, dryRun)
   * @returns Delete result with count and affected userIds
   *
   * @example
   * ```typescript
   * // Delete by explicit IDs
   * const result = await cortex.users.deleteMany(
   *   ['user-1', 'user-2', 'user-3'],
   *   { cascade: true }
   * );
   *
   * // Delete by filters (inactive users older than 1 year)
   * const oldUsers = await cortex.users.deleteMany(
   *   { createdBefore: Date.now() - 365 * 24 * 60 * 60 * 1000 },
   *   { cascade: true }
   * );
   *
   * // Dry run to preview what would be deleted
   * const preview = await cortex.users.deleteMany(
   *   { updatedBefore: Date.now() - 90 * 24 * 60 * 60 * 1000 },
   *   { dryRun: true }
   * );
   * console.log(`Would delete ${preview.userIds.length} users`);
   * ```
   */
  async deleteMany(userIdsOrFilters, options) {
    validateBulkDeleteOptions(options);
    let targetUserIds;
    if (Array.isArray(userIdsOrFilters)) {
      validateUserIdsArray(userIdsOrFilters, 1, 100);
      targetUserIds = userIdsOrFilters;
    } else {
      validateUserFilters(userIdsOrFilters);
      const matchingUsers = await this.search(userIdsOrFilters);
      targetUserIds = matchingUsers.map((u) => u.id);
      if (targetUserIds.length > 100) {
        throw new UserValidationError(
          `Filter matched ${targetUserIds.length} users, maximum is 100. Add more specific filters or use limit.`,
          "TOO_MANY_MATCHES",
          "filters"
        );
      }
    }
    if (options?.dryRun) {
      return {
        deleted: 0,
        userIds: targetUserIds
      };
    }
    const results = [];
    for (const userId of targetUserIds) {
      try {
        await this.delete(userId, options);
        results.push(userId);
      } catch (_e) {
        continue;
      }
    }
    return {
      deleted: results.length,
      userIds: results
    };
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Cascade Deletion Implementation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * PHASE 1: Collect all records that will be deleted
   *
   * OPTIMIZED: Instead of collecting all individual records (which requires
   * looping through all memory spaces), we collect:
   * - Memory space IDs (for batch deleteMany operations)
   * - Individual records only where batch operations aren't available
   *
   * This matches the Python SDK approach for fast cascade deletion.
   */
  async collectDeletionTargets(userId) {
    const plan = {
      conversations: [],
      immutable: [],
      mutable: [],
      vector: [],
      // Will store MemoryEntry[] for compatibility, but we use memorySpaceIds for deletion
      facts: [],
      graph: [],
      userProfile: null
    };
    const memorySpaceIds = /* @__PURE__ */ new Set();
    try {
      const convosResult = await this.client.query(api.conversations.list, {
        userId
      });
      const convos = Array.isArray(convosResult) ? convosResult : convosResult.conversations;
      plan.conversations = convos;
      for (const conv of plan.conversations) {
        if (conv.memorySpaceId) {
          memorySpaceIds.add(conv.memorySpaceId);
        }
      }
    } catch (error) {
      console.warn("Failed to collect conversations:", error);
    }
    plan.memorySpaceIds = Array.from(memorySpaceIds);
    try {
      const result = await this.client.query(api.immutable.list, {
        userId,
        tenantId: this.authContext?.tenantId
        // Multi-tenancy: scope to tenant
      });
      const immutableRecords = result.entries;
      plan.immutable = immutableRecords.filter(
        (r) => !(r.type === "user" && r.id === userId)
      );
    } catch (error) {
      console.warn("Failed to collect immutable records:", error);
    }
    try {
      const mutableKeys = await this.collectMutableKeys(userId);
      plan.mutable = mutableKeys;
    } catch (error) {
      console.warn("Failed to collect mutable keys:", error);
    }
    for (const spaceId of memorySpaceIds) {
      try {
        const facts = await this.client.query(api.facts.list, {
          memorySpaceId: spaceId,
          userId
        });
        plan.facts.push(...facts);
      } catch (_error) {
      }
    }
    if (this.graphAdapter) {
      try {
        const graphNodes = await this.collectGraphNodes(userId);
        plan.graph = graphNodes;
      } catch (error) {
        console.warn("Failed to collect graph nodes:", error);
      }
    }
    const profile = await this.get(userId);
    plan.userProfile = profile;
    return plan;
  }
  /**
   * Collect mutable keys associated with user
   */
  async collectMutableKeys(userId) {
    const commonNamespaces = [
      "user-sessions",
      "user-cache",
      "user-preferences",
      "user-data",
      "sessions",
      "cache",
      "preferences"
    ];
    const allMutableKeys = [];
    for (const namespace of commonNamespaces) {
      try {
        const keys = await this.client.query(api.mutable.list, {
          namespace,
          userId
        });
        allMutableKeys.push(...keys);
      } catch (_error) {
        continue;
      }
    }
    return allMutableKeys;
  }
  // NOTE: collectVectorMemories and collectFacts were removed as part of
  // optimization. We now use batch deleteMany operations instead of collecting
  // individual records. This matches the Python SDK approach.
  /**
   * Collect graph nodes associated with user
   */
  async collectGraphNodes(userId) {
    if (!this.graphAdapter) {
      return [];
    }
    try {
      const result = await this.graphAdapter.query(
        `MATCH (n {userId: $userId}) RETURN elementId(n) as id, labels(n) as labels`,
        { userId }
      );
      return result.records.map((record) => {
        const node = record;
        return {
          nodeId: node.id,
          labels: node.labels
        };
      });
    } catch (error) {
      console.warn("Failed to query graph nodes:", error);
      return [];
    }
  }
  /**
   * PHASE 2: Backup records for rollback
   */
  async backupRecords(plan) {
    return {
      conversations: JSON.parse(
        JSON.stringify(plan.conversations)
      ),
      immutable: JSON.parse(
        JSON.stringify(plan.immutable)
      ),
      mutable: JSON.parse(JSON.stringify(plan.mutable)),
      vector: JSON.parse(JSON.stringify(plan.vector)),
      facts: JSON.parse(JSON.stringify(plan.facts)),
      userProfile: plan.userProfile ? JSON.parse(
        JSON.stringify(plan.userProfile)
      ) : null
    };
  }
  /**
   * PHASE 3: Execute cascade deletion in reverse dependency order
   *
   * OPTIMIZED: Uses batch deleteMany operations instead of individual deletes.
   * This is much faster for large datasets and matches the Python SDK approach.
   */
  async executeCascadeDeletion(userId, plan) {
    const result = {
      userId,
      deletedAt: Date.now(),
      conversationsDeleted: 0,
      conversationMessagesDeleted: 0,
      immutableRecordsDeleted: 0,
      mutableKeysDeleted: 0,
      vectorMemoriesDeleted: 0,
      factsDeleted: 0,
      graphNodesDeleted: 0,
      verification: {
        complete: false,
        issues: []
      },
      totalDeleted: 0,
      deletedLayers: []
    };
    const memorySpaceIds = plan.memorySpaceIds || [];
    for (const spaceId of memorySpaceIds) {
      try {
        const deleteResult = await this.client.mutation(
          api.memories.deleteMany,
          {
            memorySpaceId: spaceId,
            userId
          }
        );
        const deleted = deleteResult.deleted || 0;
        result.vectorMemoriesDeleted += deleted;
      } catch (error) {
        console.warn(`Failed to delete memories in space ${spaceId}:`, error);
      }
    }
    if (result.vectorMemoriesDeleted > 0) {
      result.deletedLayers.push("vector");
    }
    for (const fact of plan.facts) {
      try {
        await this.client.mutation(api.facts.deleteFact, {
          memorySpaceId: fact.memorySpaceId,
          factId: fact.factId
        });
        result.factsDeleted++;
      } catch (error) {
        console.warn(`Failed to delete fact ${fact.factId}:`, error);
      }
    }
    if (result.factsDeleted > 0) {
      result.deletedLayers.push("facts");
    }
    for (const mutable of plan.mutable) {
      try {
        await this.client.mutation(api.mutable.deleteKey, {
          namespace: mutable.namespace,
          key: mutable.key
        });
        result.mutableKeysDeleted++;
      } catch (error) {
        console.warn(
          `Failed to delete mutable ${mutable.namespace}:${mutable.key}:`,
          error
        );
      }
    }
    if (result.mutableKeysDeleted > 0) {
      result.deletedLayers.push("mutable");
    }
    for (const immutable of plan.immutable) {
      try {
        await this.client.mutation(api.immutable.purge, {
          type: immutable.type,
          id: immutable.id,
          tenantId: this.authContext?.tenantId
          // Multi-tenancy: scope to tenant
        });
        result.immutableRecordsDeleted++;
      } catch (error) {
        console.warn(
          `Failed to delete immutable ${immutable.type}:${immutable.id}:`,
          error
        );
      }
    }
    if (result.immutableRecordsDeleted > 0) {
      result.deletedLayers.push("immutable");
    }
    for (const conversation of plan.conversations) {
      try {
        await this.client.mutation(api.conversations.deleteConversation, {
          conversationId: conversation.conversationId
        });
        result.conversationsDeleted++;
        result.conversationMessagesDeleted += conversation.messageCount || 0;
      } catch (error) {
        const errorStr = String(error);
        if (errorStr.includes("CONVERSATION_NOT_FOUND") || errorStr.includes("not found")) {
          result.conversationsDeleted++;
          result.conversationMessagesDeleted += conversation.messageCount || 0;
        } else {
          console.warn(
            `Failed to delete conversation ${conversation.conversationId}:`,
            error
          );
        }
      }
    }
    if (result.conversationsDeleted > 0) {
      result.deletedLayers.push("conversations");
    }
    if (this.graphAdapter && plan.graph.length > 0) {
      const deletionContext = createDeletionContext(
        `GDPR cascade deletion for user ${userId}`,
        {
          ...ORPHAN_RULES,
          User: { explicitOnly: false, neverDelete: false }
        }
      );
      for (const node of plan.graph) {
        try {
          const deleteResult = await deleteWithOrphanCleanup(
            node.nodeId,
            node.labels[0] || "User",
            deletionContext,
            this.graphAdapter
          );
          result.graphNodesDeleted = (result.graphNodesDeleted || 0) + deleteResult.deletedNodes.length;
        } catch (error) {
          console.warn(`Failed to delete graph node ${node.nodeId}:`, error);
        }
      }
      if (result.graphNodesDeleted && result.graphNodesDeleted > 0) {
        result.deletedLayers.push("graph");
      }
    }
    if (plan.userProfile) {
      try {
        await this.client.mutation(api.immutable.purge, {
          type: "user",
          id: userId,
          tenantId: this.authContext?.tenantId
          // Multi-tenancy: scope to tenant
        });
        result.deletedLayers.push("user-profile");
      } catch (error) {
        const errorStr = String(error);
        if (!errorStr.includes("IMMUTABLE_ENTRY_NOT_FOUND") && !errorStr.includes("not found")) {
          console.warn(`Failed to delete user profile ${userId}:`, error);
        }
      }
    }
    result.totalDeleted = result.conversationsDeleted + result.immutableRecordsDeleted + result.mutableKeysDeleted + result.vectorMemoriesDeleted + result.factsDeleted + (result.graphNodesDeleted || 0) + (plan.userProfile ? 1 : 0);
    return result;
  }
  /**
   * ROLLBACK: Restore backed up records
   */
  async rollbackDeletion(backups) {
    console.warn("Rolling back cascade deletion...");
    if (backups.userProfile) {
      try {
        await this.client.mutation(api.immutable.store, {
          type: "user",
          id: backups.userProfile.id,
          data: backups.userProfile.data,
          tenantId: this.authContext?.tenantId
          // Multi-tenancy: scope to tenant
        });
      } catch (error) {
        console.error("Failed to restore user profile:", error);
      }
    }
    for (const conversation of backups.conversations) {
      try {
        console.warn(
          `Conversation ${conversation.conversationId} requires manual restoration`
        );
      } catch (error) {
        console.error("Failed to restore conversation:", error);
      }
    }
    for (const immutable of backups.immutable) {
      try {
        await this.client.mutation(api.immutable.store, {
          type: immutable.type,
          id: immutable.id,
          data: immutable.data,
          userId: immutable.userId,
          tenantId: this.authContext?.tenantId,
          // Multi-tenancy: scope to tenant
          metadata: immutable.metadata
        });
      } catch (error) {
        console.error("Failed to restore immutable record:", error);
      }
    }
    for (const mutable of backups.mutable) {
      try {
        await this.client.mutation(api.mutable.set, {
          namespace: mutable.namespace,
          key: mutable.key,
          value: mutable.value,
          userId: mutable.userId,
          metadata: mutable.metadata
        });
      } catch (error) {
        console.error("Failed to restore mutable record:", error);
      }
    }
    for (const memory of backups.vector) {
      try {
        console.warn(`Memory ${memory.memoryId} requires manual restoration`);
      } catch (error) {
        console.error("Failed to restore memory:", error);
      }
    }
    for (const fact of backups.facts) {
      try {
        console.warn(`Fact ${fact.factId} requires manual restoration`);
      } catch (error) {
        console.error("Failed to restore fact:", error);
      }
    }
    console.warn(
      "Rollback completed (best-effort, some records may require manual restoration)"
    );
  }
  /**
   * PHASE 4: Verify deletion completeness
   *
   * OPTIMIZED: Uses simple count queries instead of looping through all memory spaces.
   * This matches the Python SDK approach for fast verification.
   */
  async verifyDeletion(userId) {
    const issues = [];
    try {
      const remainingConvos = await this.client.query(api.conversations.count, {
        userId
      });
      if (remainingConvos > 0) {
        issues.push(`${remainingConvos} conversations still reference userId`);
      }
    } catch (error) {
      issues.push(`Failed to verify conversations: ${error}`);
    }
    try {
      const remainingImmutable = await this.client.query(api.immutable.count, {
        userId
      });
      if (remainingImmutable > 0) {
        issues.push(
          `${remainingImmutable} immutable records still reference userId`
        );
      }
    } catch (error) {
      issues.push(`Failed to verify immutable records: ${error}`);
    }
    try {
      const user = await this.get(userId);
      if (user) {
        issues.push("User profile still exists");
      }
    } catch (error) {
      issues.push(`Failed to verify user profile: ${error}`);
    }
    if (this.graphAdapter) {
      try {
        const remainingGraph = await this.countGraphNodes(userId);
        if (remainingGraph > 0) {
          issues.push(`${remainingGraph} graph nodes still reference userId`);
        }
      } catch (error) {
        issues.push(`Failed to verify graph nodes: ${error}`);
      }
    }
    return {
      complete: issues.length === 0,
      issues
    };
  }
  // NOTE: countVectorMemories and countFacts were removed as part of
  // verification optimization. Vector memories and facts are now verified
  // implicitly through the deletion execution phase, avoiding expensive
  // O(n) queries across all memory spaces.
  /**
   * Count remaining graph nodes for user
   */
  async countGraphNodes(userId) {
    if (!this.graphAdapter) {
      return 0;
    }
    try {
      const result = await this.graphAdapter.query(
        `MATCH (n {userId: $userId}) RETURN count(n) as count`,
        { userId }
      );
      const record = result.records[0];
      return record?.count ?? 0;
    } catch (error) {
      console.warn("Failed to count graph nodes:", error);
      return 0;
    }
  }
  /**
   * Calculate deletion totals from plan
   */
  calculateDeletionTotals(plan) {
    const conversationsDeleted = plan.conversations.length;
    const conversationMessagesDeleted = plan.conversations.reduce(
      (sum, c) => sum + (c.messageCount || 0),
      0
    );
    const immutableRecordsDeleted = plan.immutable.length;
    const mutableKeysDeleted = plan.mutable.length;
    const vectorMemoriesDeleted = plan.vector.length;
    const factsDeleted = plan.facts.length;
    const graphNodesDeleted = plan.graph.length;
    const totalDeleted = conversationsDeleted + immutableRecordsDeleted + mutableKeysDeleted + vectorMemoriesDeleted + factsDeleted + graphNodesDeleted + (plan.userProfile ? 1 : 0);
    return {
      conversationsDeleted,
      conversationMessagesDeleted,
      immutableRecordsDeleted,
      mutableKeysDeleted,
      vectorMemoriesDeleted,
      factsDeleted,
      graphNodesDeleted,
      totalDeleted
    };
  }
  /**
   * Get affected layers from deletion plan
   */
  getAffectedLayers(plan) {
    const layers = [];
    if (plan.conversations.length > 0) layers.push("conversations");
    if (plan.immutable.length > 0) layers.push("immutable");
    if (plan.mutable.length > 0) layers.push("mutable");
    if (plan.vector.length > 0) layers.push("vector");
    if (plan.facts.length > 0) layers.push("facts");
    if (plan.graph.length > 0) layers.push("graph");
    if (plan.userProfile) layers.push("user-profile");
    return layers;
  }
};

// src/agents/index.ts
init_api();

// src/agents/validators.ts
var AgentValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "AgentValidationError";
  }
};
function validateAgentId(agentId, fieldName = "agentId") {
  if (agentId === null || agentId === void 0) {
    throw new AgentValidationError(
      `${fieldName} is required`,
      "MISSING_AGENT_ID",
      fieldName
    );
  }
  if (typeof agentId !== "string") {
    throw new AgentValidationError(
      `${fieldName} must be a string`,
      "INVALID_AGENT_ID_FORMAT",
      fieldName
    );
  }
  if (agentId.trim().length === 0) {
    throw new AgentValidationError(
      `${fieldName} cannot be empty or whitespace only`,
      "EMPTY_AGENT_ID",
      fieldName
    );
  }
  if (agentId.length > 256) {
    throw new AgentValidationError(
      `${fieldName} cannot exceed 256 characters, got ${agentId.length}`,
      "AGENT_ID_TOO_LONG",
      fieldName
    );
  }
}
function validateAgentName(name, fieldName = "name") {
  if (name === null || name === void 0) {
    throw new AgentValidationError(
      `${fieldName} is required`,
      "MISSING_AGENT_NAME",
      fieldName
    );
  }
  if (typeof name !== "string") {
    throw new AgentValidationError(
      `${fieldName} must be a string`,
      "INVALID_NAME_FORMAT",
      fieldName
    );
  }
  if (name.trim().length === 0) {
    throw new AgentValidationError(
      `${fieldName} cannot be empty or whitespace only`,
      "EMPTY_AGENT_NAME",
      fieldName
    );
  }
  if (name.length > 200) {
    throw new AgentValidationError(
      `${fieldName} cannot exceed 200 characters, got ${name.length}`,
      "AGENT_NAME_TOO_LONG",
      fieldName
    );
  }
}
function validateAgentRegistration(agent) {
  if (!agent) {
    throw new AgentValidationError(
      "Agent registration object is required",
      "MISSING_AGENT_ID"
    );
  }
  if (agent.id === void 0 || agent.id === null) {
    throw new AgentValidationError(
      "Agent ID is required",
      "MISSING_AGENT_ID",
      "id"
    );
  }
  if (agent.name === void 0 || agent.name === null) {
    throw new AgentValidationError(
      "Agent name is required",
      "MISSING_AGENT_NAME",
      "name"
    );
  }
  validateAgentId(agent.id, "id");
  validateAgentName(agent.name, "name");
  if (agent.metadata !== void 0) {
    validateMetadata4(agent.metadata, "metadata");
  }
  if (agent.config !== void 0) {
    validateConfig(agent.config, "config");
  }
}
var VALID_STATUSES3 = ["active", "inactive", "archived"];
function validateAgentStatus(status, fieldName = "status") {
  if (!status || typeof status !== "string") {
    throw new AgentValidationError(
      `${fieldName} is required and must be a string`,
      "INVALID_STATUS_VALUE",
      fieldName
    );
  }
  if (!VALID_STATUSES3.includes(status)) {
    throw new AgentValidationError(
      `Invalid status "${status}". Valid values: ${VALID_STATUSES3.join(", ")}`,
      "INVALID_STATUS",
      fieldName
    );
  }
}
var VALID_SORT_BY2 = ["name", "registeredAt", "lastActive"];
var VALID_SORT_ORDER3 = ["asc", "desc"];
function validateAgentFilters(filters) {
  if (!filters) {
    return;
  }
  if (filters.limit !== void 0) {
    if (typeof filters.limit !== "number") {
      throw new AgentValidationError(
        "limit must be a number",
        "INVALID_LIMIT_VALUE",
        "limit"
      );
    }
    if (filters.limit < 1 || filters.limit > 1e3) {
      throw new AgentValidationError(
        `limit must be between 1 and 1000, got ${filters.limit}`,
        "INVALID_LIMIT_VALUE",
        "limit"
      );
    }
  }
  if (filters.offset !== void 0) {
    if (typeof filters.offset !== "number") {
      throw new AgentValidationError(
        "offset must be a number",
        "INVALID_OFFSET_VALUE",
        "offset"
      );
    }
    if (filters.offset < 0) {
      throw new AgentValidationError(
        `offset must be >= 0, got ${filters.offset}`,
        "INVALID_OFFSET_VALUE",
        "offset"
      );
    }
  }
  if (filters.status !== void 0) {
    validateAgentStatus(filters.status, "status");
  }
  if (filters.metadata !== void 0) {
    validateMetadata4(filters.metadata, "metadata");
  }
  if (filters.registeredAfter !== void 0 && filters.registeredBefore !== void 0) {
    if (filters.registeredAfter >= filters.registeredBefore) {
      throw new AgentValidationError(
        "registeredAfter must be before registeredBefore",
        "INVALID_TIMESTAMP_RANGE"
      );
    }
  }
  if (filters.sortBy !== void 0) {
    if (!VALID_SORT_BY2.includes(filters.sortBy)) {
      throw new AgentValidationError(
        `Invalid sortBy "${filters.sortBy}". Valid values: ${VALID_SORT_BY2.join(", ")}`,
        "INVALID_SORT_BY",
        "sortBy"
      );
    }
  }
  if (filters.sortOrder !== void 0) {
    if (!VALID_SORT_ORDER3.includes(filters.sortOrder)) {
      throw new AgentValidationError(
        `Invalid sortOrder "${filters.sortOrder}". Valid values: ${VALID_SORT_ORDER3.join(", ")}`,
        "INVALID_SORT_ORDER",
        "sortOrder"
      );
    }
  }
}
function validateUnregisterOptions(options) {
  if (!options) {
    return;
  }
  if (options.dryRun === true && options.verify === false) {
    throw new AgentValidationError(
      "Cannot disable verification in dry run mode. Set verify=true or remove verify option.",
      "CONFLICTING_OPTIONS"
    );
  }
}
function validateMetadata4(metadata, fieldName = "metadata") {
  if (metadata === null) {
    throw new AgentValidationError(
      `${fieldName} cannot be null`,
      "INVALID_METADATA_FORMAT",
      fieldName
    );
  }
  if (typeof metadata !== "object") {
    throw new AgentValidationError(
      `${fieldName} must be an object`,
      "INVALID_METADATA_FORMAT",
      fieldName
    );
  }
  if (Array.isArray(metadata)) {
    throw new AgentValidationError(
      `${fieldName} must be a plain object, not an array`,
      "INVALID_METADATA_FORMAT",
      fieldName
    );
  }
}
function validateConfig(config, fieldName = "config") {
  if (config === null) {
    throw new AgentValidationError(
      `${fieldName} cannot be null`,
      "INVALID_CONFIG_FORMAT",
      fieldName
    );
  }
  if (typeof config !== "object") {
    throw new AgentValidationError(
      `${fieldName} must be an object`,
      "INVALID_CONFIG_FORMAT",
      fieldName
    );
  }
  if (Array.isArray(config)) {
    throw new AgentValidationError(
      `${fieldName} must be a plain object, not an array`,
      "INVALID_CONFIG_FORMAT",
      fieldName
    );
  }
}
function validateUpdatePayload(agentId, updates) {
  validateAgentId(agentId, "agentId");
  const hasUpdates = updates.name !== void 0 || updates.description !== void 0 || updates.metadata !== void 0 || updates.config !== void 0 || updates.status !== void 0;
  if (!hasUpdates) {
    throw new AgentValidationError(
      "At least one field must be provided for update (name, description, metadata, config, or status)",
      "MISSING_UPDATES"
    );
  }
  if (updates.name !== void 0) {
    validateAgentName(updates.name, "name");
  }
  if (updates.metadata !== void 0) {
    validateMetadata4(updates.metadata, "metadata");
  }
  if (updates.config !== void 0) {
    validateConfig(updates.config, "config");
  }
  if (updates.status !== void 0) {
    validateAgentStatus(updates.status, "status");
  }
}
var VALID_EXPORT_FORMATS4 = ["json", "csv"];
function validateExportOptions3(options) {
  if (!options) {
    throw new AgentValidationError(
      "Export options are required",
      "MISSING_OPTIONS"
    );
  }
  if (!options.format) {
    throw new AgentValidationError(
      "format is required",
      "MISSING_FORMAT",
      "format"
    );
  }
  if (!VALID_EXPORT_FORMATS4.includes(options.format)) {
    throw new AgentValidationError(
      `Invalid format "${options.format}". Valid values: ${VALID_EXPORT_FORMATS4.join(", ")}`,
      "INVALID_FORMAT",
      "format"
    );
  }
  if (options.filters) {
    validateAgentFilters(options.filters);
  }
}

// src/agents/index.ts
var AgentRegistryCapabilityError = class extends Error {
  code = "TRUSTED_BACKEND_CASCADE_REQUIRED";
  requiredCapability = "trusted-backend-cascade";
  constructor() {
    super("Agent cascade cleanup requires trusted backend execution with authorized child-resource coverage.");
    this.name = "AgentRegistryCapabilityError";
  }
};
var AgentRegistryCommittedResultError = class extends Error {
  constructor(deleted) {
    super("The agent registry deletion committed, but result IDs are unavailable. Do not retry the deletion.");
    this.deleted = deleted;
    this.name = "AgentRegistryCommittedResultError";
  }
  code = "AGENT_REGISTRY_COMMITTED_RESULT_UNAVAILABLE";
  retryable = false;
  outcome = "committed";
};
var AgentRegistryWriteReceiptError = class extends Error {
  code = "AGENT_REGISTRY_WRITE_COMMITTED_READ_UNAVAILABLE";
  retryable = false;
  outcome = "committed";
  requiredCapability = "read";
  receipt;
  constructor(receipt) {
    super("The agent registry write committed, but its row is unavailable without read capability. Do not retry the committed write.");
    this.name = "AgentRegistryWriteReceiptError";
    this.receipt = Object.freeze({ accepted: true, resourceType: "agents", resourceId: receipt.resourceId });
  }
};
var AgentCascadeDeletionError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "AgentCascadeDeletionError";
  }
};
var AgentsAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Registry Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Register an agent in the registry
   *
   * @example
   * ```typescript
   * const agent = await cortex.agents.register({
   *   id: 'support-agent',
   *   name: 'Customer Support Bot',
   *   description: 'Handles customer inquiries',
   *   metadata: {
   *     team: 'support',
   *     capabilities: ['troubleshooting', 'empathy']
   *   }
   * });
   * ```
   */
  async register(agent) {
    validateAgentRegistration(agent);
    if (agent.metadata) validateMetadata4(agent.metadata);
    if (agent.config) validateConfig(agent.config);
    let result;
    try {
      result = await this.executeWithResilience(
        () => this.client.mutation(api.agents.register, {
          agentId: agent.id,
          tenantId: resolveTenantId(this.authContext?.tenantId, agent.tenantId),
          memorySpaceId: agent.memorySpaceId,
          name: agent.name,
          description: agent.description,
          metadata: agent.metadata,
          config: agent.config
        }),
        "agents:register"
      );
    } catch (error) {
      this.handleConvexError(error);
    }
    if (!result) {
      throw new Error(`Failed to register agent ${agent.id}`);
    }
    if ("accepted" in result) {
      throw new AgentRegistryWriteReceiptError({ ...result, resourceType: "agents" });
    }
    if (this.graphAdapter) {
      try {
        await this.graphAdapter.createNode({
          label: "Agent",
          properties: {
            agentId: result.agentId,
            name: result.name,
            description: result.description || null,
            status: result.status,
            registeredAt: result.registeredAt,
            updatedAt: result.updatedAt,
            lastActive: result.lastActive || null
          }
        });
      } catch (error) {
        console.warn("Failed to sync agent to graph:", error);
      }
    }
    return {
      id: result.agentId,
      tenantId: result.tenantId,
      memorySpaceId: result.memorySpaceId,
      name: result.name,
      description: result.description,
      metadata: result.metadata ?? {},
      config: result.config ?? {},
      status: result.status,
      registeredAt: result.registeredAt,
      updatedAt: result.updatedAt,
      lastActive: result.lastActive
    };
  }
  /**
   * Get agent registration by ID
   *
   * @example
   * ```typescript
   * const agent = await cortex.agents.get('support-agent');
   * if (agent) {
   *   console.log(agent.name, agent.metadata.team);
   * }
   * ```
   */
  async get(agentId, scope) {
    validateAgentId(agentId, "agentId");
    const result = await this.executeWithResilience(
      () => this.client.query(api.agents.get, { tenantId: resolveTenantId(this.authContext?.tenantId, scope?.tenantId), memorySpaceId: scope?.memorySpaceId, agentId }),
      "agents:get"
    );
    if (!result) {
      return null;
    }
    return {
      id: result.agentId,
      tenantId: result.tenantId,
      memorySpaceId: result.memorySpaceId,
      name: result.name,
      description: result.description,
      metadata: result.metadata ?? {},
      config: result.config ?? {},
      status: result.status,
      registeredAt: result.registeredAt,
      updatedAt: result.updatedAt,
      lastActive: result.lastActive
    };
  }
  /**
   * List agents with filters
   *
   * @param filters - Optional filters to apply
   * @returns Array of registered agents matching the filters
   *
   * @remarks
   * **Pagination Limitation:** The `offset` and `limit` parameters are applied at the
   * database level BEFORE client-side filtering. This means combining `offset` with
   * client-side filters (`metadata`, `name`, `capabilities`, `lastActiveAfter`,
   * `lastActiveBefore`) may produce unexpected results.
   *
   * For example, if you have 100 agents and request `{ metadata: { team: "alpha" }, offset: 10 }`,
   * the database will skip the first 10 agents (regardless of team), then the SDK filters
   * the remaining results for `team: "alpha"`. This may return fewer results than expected
   * or empty results even when matching agents exist.
   *
   * **Safe pagination patterns:**
   * - Use `offset`/`limit` with `status` filter only (backend-applied)
   * - Use `offset`/`limit` without any client-side filters
   * - For paginating with metadata/name/capabilities, fetch all results and paginate client-side
   *
   * @example
   * ```typescript
   * // Safe: offset with backend filter only
   * const agents = await cortex.agents.list({ status: 'active', offset: 10, limit: 20 });
   *
   * // Safe: client-side filter without offset
   * const teamAgents = await cortex.agents.list({ metadata: { team: 'alpha' } });
   *
   * // WARNING: offset + metadata may produce unexpected results
   * const paginated = await cortex.agents.list({ metadata: { team: 'alpha' }, offset: 10 });
   * ```
   */
  async list(filters) {
    if (filters) {
      validateAgentFilters(filters);
    }
    const hasClientSideFilters = filters?.metadata || filters?.name || filters?.capabilities || filters?.lastActiveAfter !== void 0 || filters?.lastActiveBefore !== void 0;
    if (filters?.offset !== void 0 && hasClientSideFilters) {
      console.warn(
        "[Cortex SDK] Warning: Using 'offset' with client-side filters (metadata, name, capabilities, lastActiveAfter, lastActiveBefore) may produce unexpected results. The offset is applied at the database level before client-side filtering. See documentation for safe pagination patterns."
      );
    }
    const results = await this.executeWithResilience(
      () => this.client.query(api.agents.list, {
        tenantId: resolveTenantId(this.authContext?.tenantId, filters?.tenantId),
        memorySpaceId: filters?.memorySpaceId,
        status: filters?.status,
        limit: filters?.limit,
        offset: filters?.offset
      }),
      "agents:list"
    );
    let filtered = results;
    if (filters?.metadata) {
      filtered = filtered.filter((agent) => {
        return Object.entries(filters.metadata).every(
          ([key, value]) => agent.metadata?.[key] === value
        );
      });
    }
    if (filters?.name) {
      filtered = filtered.filter(
        (agent) => agent.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }
    if (filters?.capabilities && filters.capabilities.length > 0) {
      filtered = filtered.filter((agent) => {
        const agentCaps = Array.isArray(agent.metadata?.capabilities) ? agent.metadata.capabilities : [];
        const matchMode = filters.capabilitiesMatch ?? "any";
        if (matchMode === "all") {
          return filters.capabilities.every((cap) => agentCaps.includes(cap));
        }
        return filters.capabilities.some((cap) => agentCaps.includes(cap));
      });
    }
    if (filters?.lastActiveAfter !== void 0) {
      filtered = filtered.filter(
        (agent) => agent.lastActive !== void 0 && agent.lastActive >= filters.lastActiveAfter
      );
    }
    if (filters?.lastActiveBefore !== void 0) {
      filtered = filtered.filter(
        (agent) => agent.lastActive !== void 0 && agent.lastActive <= filters.lastActiveBefore
      );
    }
    return filtered.map((r) => ({
      id: r.agentId,
      tenantId: r.tenantId,
      memorySpaceId: r.memorySpaceId,
      name: r.name,
      description: r.description,
      metadata: r.metadata ?? {},
      config: r.config ?? {},
      status: r.status,
      registeredAt: r.registeredAt,
      updatedAt: r.updatedAt,
      lastActive: r.lastActive
    }));
  }
  /**
   * Search agents (alias for list with filters)
   *
   * @example
   * ```typescript
   * const supportAgents = await cortex.agents.search({
   *   metadata: { team: 'support' }
   * });
   * ```
   */
  async search(filters) {
    return this.list(filters);
  }
  /**
   * Count registered agents
   *
   * @example
   * ```typescript
   * const total = await cortex.agents.count();
   * console.log(`Total agents: ${total}`);
   * ```
   */
  async count(filters) {
    if (filters) {
      validateAgentFilters(filters);
    }
    return await this.executeWithResilience(
      () => this.client.query(api.agents.count, {
        tenantId: resolveTenantId(this.authContext?.tenantId, filters?.tenantId),
        memorySpaceId: filters?.memorySpaceId,
        status: filters?.status
      }),
      "agents:count"
    );
  }
  /**
   * Update agent registration
   *
   * @example
   * ```typescript
   * await cortex.agents.update('support-agent', {
   *   metadata: { team: 'customer-success' }
   * });
   * ```
   */
  async update(agentId, updates) {
    validateUpdatePayload(agentId, updates);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.agents.update, {
        agentId,
        tenantId: resolveTenantId(this.authContext?.tenantId, updates.tenantId),
        memorySpaceId: updates.memorySpaceId,
        name: updates.name,
        description: updates.description,
        metadata: updates.metadata,
        config: updates.config,
        status: updates.status
      }),
      "agents:update"
    );
    if ("accepted" in result) {
      throw new AgentRegistryWriteReceiptError({ ...result, resourceType: "agents" });
    }
    return {
      id: result.agentId,
      tenantId: result.tenantId,
      memorySpaceId: result.memorySpaceId,
      name: result.name,
      description: result.description,
      metadata: result.metadata ?? {},
      config: result.config ?? {},
      status: result.status,
      registeredAt: result.registeredAt,
      updatedAt: result.updatedAt,
      lastActive: result.lastActive
    };
  }
  /**
   * Configure agent settings
   *
   * @example
   * ```typescript
   * await cortex.agents.configure('audit-agent', {
   *   memoryVersionRetention: -1  // Unlimited
   * });
   * ```
   */
  async configure(agentId, config, scope) {
    validateAgentId(agentId, "agentId");
    validateConfig(config, "config");
    if (Object.keys(config).length === 0) {
      throw new AgentValidationError(
        "config cannot be empty",
        "EMPTY_CONFIG_OBJECT",
        "config"
      );
    }
    await this.executeWithResilience(
      () => this.client.mutation(api.agents.update, {
        tenantId: resolveTenantId(this.authContext?.tenantId, scope?.tenantId),
        memorySpaceId: scope?.memorySpaceId,
        agentId,
        config
      }),
      "agents:configure"
    );
  }
  /**
   * Check if agent is registered
   *
   * @example
   * ```typescript
   * if (await cortex.agents.exists('my-agent')) {
   *   console.log('Agent is registered');
   * }
   * ```
   */
  async exists(agentId, scope) {
    validateAgentId(agentId, "agentId");
    return await this.executeWithResilience(
      () => this.client.query(api.agents.exists, { tenantId: resolveTenantId(this.authContext?.tenantId, scope?.tenantId), memorySpaceId: scope?.memorySpaceId, agentId }),
      "agents:exists"
    );
  }
  /**
   * Unregister agent with optional cascade deletion by participantId
   *
   * @param agentId - Agent ID to unregister
   * @param options - Unregistration options
   * @param options.cascade - Delete all data where participantId = agentId (default: false)
   * @param options.verify - Verify deletion completeness (default: true)
   * @param options.dryRun - Preview what would be deleted (default: false)
   *
   * @example
   * ```typescript
   * // Simple unregister (keep data)
   * await cortex.agents.unregister('old-agent');
   *
   * // Cascade delete all agent data
   * const result = await cortex.agents.unregister('old-agent', {
   *   cascade: true
   * });
   * console.log(`Deleted ${result.totalDeleted} records from ${result.memorySpacesAffected.length} spaces`);
   * ```
   */
  async unregister(agentId, options) {
    validateAgentId(agentId, "agentId");
    if (options) {
      validateUnregisterOptions(options);
    }
    if (options?.cascade) throw new AgentRegistryCapabilityError();
    const cascade = options?.cascade ?? false;
    const verify = options?.verify ?? true;
    const dryRun = options?.dryRun ?? false;
    if (!cascade) {
      if (!dryRun) {
        await this.executeWithResilience(
          () => this.client.mutation(api.agents.unregister, { tenantId: resolveTenantId(this.authContext?.tenantId, options?.tenantId), memorySpaceId: options?.memorySpaceId, agentId }),
          "agents:unregister"
        );
      }
      return {
        agentId,
        unregisteredAt: Date.now(),
        conversationsDeleted: 0,
        conversationMessagesDeleted: 0,
        memoriesDeleted: 0,
        factsDeleted: 0,
        graphNodesDeleted: 0,
        verification: {
          complete: true,
          issues: []
        },
        totalDeleted: dryRun ? 0 : 1,
        deletedLayers: dryRun ? [] : ["agent-registration"],
        memorySpacesAffected: []
      };
    }
    const deletionPlan = await this.collectAgentDeletionTargets(agentId);
    const totals = this.calculateDeletionTotals(deletionPlan);
    if (dryRun) {
      return {
        agentId,
        unregisteredAt: Date.now(),
        ...totals,
        verification: {
          complete: true,
          issues: [
            `DRY RUN: Would delete ${totals.totalDeleted} total records across ${deletionPlan.memorySpaces.length} spaces`
          ]
        },
        deletedLayers: this.getAffectedLayers(deletionPlan),
        memorySpacesAffected: deletionPlan.memorySpaces
      };
    }
    const backups = await this.backupRecords(deletionPlan);
    try {
      const result = await this.executeAgentCascadeDeletion(
        agentId,
        deletionPlan
      );
      if (verify) {
        const verification = await this.verifyAgentDeletion(agentId);
        result.verification = verification;
      }
      return result;
    } catch (error) {
      await this.rollbackAgentDeletion(backups);
      throw new AgentCascadeDeletionError(
        `Cascade deletion failed for agent ${agentId}, rolled back all changes`,
        error
      );
    }
  }
  /**
   * Unregister multiple agents matching filters
   *
   * @param filters - Filter criteria for agents to unregister
   * @param options - Unregistration options
   * @returns Unregistration result
   *
   * @example
   * ```typescript
   * // Unregister experimental agents (keep data)
   * const result = await cortex.agents.unregisterMany(
   *   { metadata: { environment: 'experimental' } },
   *   { cascade: false }
   * );
   * console.log(`Unregistered ${result.deleted} agents`);
   *
   * // Unregister and cascade delete all data
   * const result = await cortex.agents.unregisterMany(
   *   { status: 'archived' },
   *   { cascade: true }
   * );
   * ```
   */
  async unregisterMany(filters, options) {
    validateAgentFilters(filters);
    if (options) {
      validateUnregisterOptions(options);
    }
    if (options?.cascade) throw new AgentRegistryCapabilityError();
    const agents = await this.list(filters);
    if (agents.length === 0) {
      return {
        deleted: 0,
        agentIds: [],
        totalDataDeleted: 0
      };
    }
    if (options?.dryRun) {
      return {
        deleted: 0,
        agentIds: agents.map((a) => a.id)
      };
    }
    const results = [];
    let totalDataDeleted = 0;
    if (options?.cascade) {
      for (const agent of agents) {
        try {
          const result = await this.unregister(agent.id, options);
          results.push(agent.id);
          totalDataDeleted += result.totalDeleted;
        } catch (error) {
          console.error(`Failed to unregister agent ${agent.id}:`, error);
        }
      }
    } else {
      const agentIds = agents.map((a) => a.id);
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.agents.unregisterMany, {
          tenantId: resolveTenantId(this.authContext?.tenantId, filters.tenantId),
          memorySpaceId: filters.memorySpaceId,
          agentIds
        }),
        "agents:unregisterMany"
      );
      if (!result.agentIds) throw new AgentRegistryCommittedResultError(result.deleted);
      return {
        deleted: result.deleted,
        agentIds: result.agentIds
      };
    }
    return {
      deleted: results.length,
      agentIds: results,
      totalDataDeleted
    };
  }
  /**
   * Update multiple agents matching filters
   *
   * @param filters - Filter criteria for agents to update
   * @param updates - Fields to update on matching agents
   * @returns Update result with count and agent IDs
   *
   * @example
   * ```typescript
   * // Update all agents in a team
   * const result = await cortex.agents.updateMany(
   *   { metadata: { team: 'support' } },
   *   { metadata: { trainingCompleted: true } }
   * );
   * console.log(`Updated ${result.updated} agents`);
   *
   * // Upgrade all agents to new version
   * await cortex.agents.updateMany(
   *   { metadata: { version: '2.0.0' } },
   *   { metadata: { version: '2.1.0' } }
   * );
   * ```
   */
  async updateMany(filters, updates) {
    validateAgentFilters(filters);
    if (updates.metadata) validateMetadata4(updates.metadata);
    if (updates.config) validateConfig(updates.config);
    const hasUpdates = updates.name !== void 0 || updates.description !== void 0 || updates.metadata !== void 0 || updates.config !== void 0;
    if (!hasUpdates) {
      throw new AgentValidationError(
        "At least one field must be provided for update (name, description, metadata, or config)",
        "MISSING_UPDATES"
      );
    }
    const agents = await this.list(filters);
    if (agents.length === 0) {
      return {
        updated: 0,
        agentIds: []
      };
    }
    const agentIds = agents.map((a) => a.id);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.agents.updateMany, {
        tenantId: resolveTenantId(this.authContext?.tenantId, filters.tenantId),
        memorySpaceId: filters.memorySpaceId,
        agentIds,
        name: updates.name,
        description: updates.description,
        metadata: updates.metadata,
        config: updates.config
      }),
      "agents:updateMany"
    );
    return {
      updated: result.updated,
      agentIds: result.agentIds
    };
  }
  /**
   * Export registered agents matching filters
   *
   * @param options - Export options including format and filters
   * @returns Export result with data string
   *
   * @example
   * ```typescript
   * // Export all agents as JSON
   * const result = await cortex.agents.export({
   *   format: "json",
   *   includeStats: true,
   * });
   * fs.writeFileSync("agents.json", result.data);
   *
   * // Export support team as CSV
   * const csv = await cortex.agents.export({
   *   filters: { metadata: { team: "support" } },
   *   format: "csv",
   * });
   * ```
   */
  async export(options) {
    validateExportOptions3(options);
    const agents = await this.list(options.filters);
    const includeMetadata = options.includeMetadata !== false;
    const includeStats = options.includeStats ?? false;
    let exportData = agents;
    if (includeStats) {
      exportData = await Promise.all(
        agents.map(async (agent) => {
          const stats = await this.getAgentStats(agent.id, { tenantId: agent.tenantId, memorySpaceId: agent.memorySpaceId });
          return { ...agent, stats };
        })
      );
    }
    if (options.format === "csv") {
      const headers = [
        "id",
        "name",
        "description",
        "status",
        "registeredAt",
        "updatedAt",
        "lastActive"
      ];
      if (includeMetadata) {
        headers.push("metadata", "config");
      }
      if (includeStats) {
        headers.push(
          "totalMemories",
          "totalConversations",
          "totalFacts",
          "memorySpacesActive"
        );
      }
      const rows = exportData.map((a) => {
        const row = [
          this.escapeCsvField(String(a.id)),
          this.escapeCsvField(String(a.name)),
          this.escapeCsvField(String(a.description || "")),
          this.escapeCsvField(String(a.status)),
          new Date(a.registeredAt).toISOString(),
          new Date(a.updatedAt).toISOString(),
          a.lastActive ? new Date(a.lastActive).toISOString() : ""
        ];
        if (includeMetadata) {
          row.push(
            this.escapeCsvField(JSON.stringify(a.metadata)),
            this.escapeCsvField(JSON.stringify(a.config))
          );
        }
        if (includeStats && a.stats) {
          const stats = a.stats;
          row.push(
            String(stats.totalMemories),
            String(stats.totalConversations),
            String(stats.totalFacts),
            String(stats.memorySpacesActive)
          );
        }
        return row.join(",");
      });
      return {
        format: "csv",
        data: [headers.join(","), ...rows].join("\n"),
        count: agents.length,
        exportedAt: Date.now()
      };
    }
    return {
      format: "json",
      data: JSON.stringify(exportData, null, 2),
      count: agents.length,
      exportedAt: Date.now()
    };
  }
  /**
   * Escape a field for CSV output
   */
  escapeCsvField(field) {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Statistics
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Get agent statistics
   */
  async getAgentStats(agentId, scope) {
    const result = await this.executeWithResilience(
      async () => {
        try {
          return { stats: await this.client.query(api.agents.computeStats, {
            agentId,
            tenantId: resolveTenantId(this.authContext?.tenantId, scope.tenantId),
            memorySpaceId: scope.memorySpaceId
          }) };
        } catch (error) {
          if (isRegistryStatisticsUnavailable(error)) {
            return { unavailable: error };
          }
          throw error;
        }
      },
      "agents:computeStats"
    );
    if (result.unavailable) throw result.unavailable;
    return result.stats;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Cascade Deletion by participantId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * PHASE 1: Collect all records where participantId = agentId
   * This queries across ALL memory spaces IN PARALLEL for performance
   */
  async collectAgentDeletionTargets(agentId) {
    const plan = {
      conversations: [],
      memories: [],
      facts: [],
      graph: [],
      agentRegistration: null,
      memorySpaces: []
    };
    const affectedSpaces = /* @__PURE__ */ new Set();
    const memorySpacesResult = await this.client.query(
      api.memorySpaces.list,
      {}
    );
    const memorySpacesList = memorySpacesResult.spaces;
    const [conversationResults, memoryResults, factResults, graphNodes] = await Promise.all([
      // Collect all conversations in parallel across spaces
      Promise.all(
        memorySpacesList.map(
          (space) => this.client.query(api.conversations.list, {
            memorySpaceId: space.memorySpaceId
          }).then((result) => {
            const conversations = result.conversations;
            return {
              spaceId: space.memorySpaceId,
              conversations: conversations.filter(
                (c) => c.participants.participantId === agentId || c.participants.agentId === agentId || c.participantId === agentId
              )
            };
          }).catch(() => ({
            spaceId: space.memorySpaceId,
            conversations: []
          }))
        )
      ),
      // Collect all memories in parallel across spaces
      Promise.all(
        memorySpacesList.map(
          (space) => this.client.query(api.memories.list, {
            memorySpaceId: space.memorySpaceId
          }).then((memories) => ({
            spaceId: space.memorySpaceId,
            memories: memories.filter(
              (m) => m.participantId === agentId
            )
          })).catch(() => ({
            spaceId: space.memorySpaceId,
            memories: []
          }))
        )
      ),
      // Collect all facts in parallel across spaces
      Promise.all(
        memorySpacesList.map(
          (space) => this.client.query(api.facts.list, {
            memorySpaceId: space.memorySpaceId
          }).then((facts) => ({
            spaceId: space.memorySpaceId,
            facts: facts.filter(
              (f) => f.participantId === agentId
            )
          })).catch(() => ({
            spaceId: space.memorySpaceId,
            facts: []
          }))
        )
      ),
      // Collect graph nodes (single query, already efficient)
      this.graphAdapter ? this.collectGraphNodes(agentId).catch(() => []) : Promise.resolve([])
    ]);
    for (const result of conversationResults) {
      if (result.conversations.length > 0) {
        plan.conversations.push(...result.conversations);
        affectedSpaces.add(result.spaceId);
      }
    }
    for (const result of memoryResults) {
      if (result.memories.length > 0) {
        plan.memories.push(...result.memories);
        affectedSpaces.add(result.spaceId);
      }
    }
    for (const result of factResults) {
      if (result.facts.length > 0) {
        plan.facts.push(...result.facts);
        affectedSpaces.add(result.spaceId);
      }
    }
    plan.graph = graphNodes;
    const registration = await this.get(agentId);
    plan.agentRegistration = registration;
    plan.memorySpaces = Array.from(affectedSpaces);
    return plan;
  }
  /**
   * Collect graph nodes where participantId = agentId
   */
  async collectGraphNodes(agentId) {
    if (!this.graphAdapter) {
      return [];
    }
    try {
      const result = await this.graphAdapter.query(
        `MATCH (n {participantId: $participantId}) RETURN elementId(n) as id, labels(n) as labels`,
        { participantId: agentId }
      );
      return result.records.map((record) => {
        const node = record;
        return {
          nodeId: node.id,
          labels: node.labels
        };
      });
    } catch (error) {
      console.warn("Failed to query graph nodes:", error);
      return [];
    }
  }
  /**
   * PHASE 2: Backup records for rollback
   */
  async backupRecords(plan) {
    return {
      conversations: JSON.parse(
        JSON.stringify(plan.conversations)
      ),
      memories: JSON.parse(JSON.stringify(plan.memories)),
      facts: JSON.parse(JSON.stringify(plan.facts)),
      agentRegistration: plan.agentRegistration ? JSON.parse(
        JSON.stringify(plan.agentRegistration)
      ) : null
    };
  }
  /**
   * PHASE 3: Execute cascade deletion in reverse dependency order
   * OPTIMIZED: Uses batch deletes instead of individual API calls
   */
  async executeAgentCascadeDeletion(agentId, plan) {
    const result = {
      agentId,
      unregisteredAt: Date.now(),
      conversationsDeleted: 0,
      conversationMessagesDeleted: 0,
      memoriesDeleted: 0,
      factsDeleted: 0,
      graphNodesDeleted: 0,
      verification: {
        complete: false,
        issues: []
      },
      totalDeleted: 0,
      deletedLayers: [],
      memorySpacesAffected: plan.memorySpaces
    };
    if (plan.facts.length > 0) {
      try {
        const factIds = plan.facts.map((f) => f.factId);
        const deleteResult = await this.client.mutation(api.facts.deleteByIds, {
          factIds
        });
        result.factsDeleted = deleteResult.deleted;
        result.deletedLayers.push("facts");
      } catch (error) {
        throw new Error(`Failed to batch delete facts: ${error}`);
      }
    }
    if (plan.memories.length > 0) {
      try {
        const memoryIds = plan.memories.map((m) => m.memoryId);
        const deleteResult = await this.client.mutation(
          api.memories.deleteByIds,
          { memoryIds }
        );
        result.memoriesDeleted = deleteResult.deleted;
        result.deletedLayers.push("memories");
      } catch (error) {
        throw new Error(`Failed to batch delete memories: ${error}`);
      }
    }
    if (plan.conversations.length > 0) {
      try {
        const conversationIds = plan.conversations.map((c) => c.conversationId);
        const deleteResult = await this.client.mutation(
          api.conversations.deleteByIds,
          { conversationIds }
        );
        result.conversationsDeleted = deleteResult.deleted;
        result.conversationMessagesDeleted = deleteResult.totalMessagesDeleted;
        result.deletedLayers.push("conversations");
      } catch (error) {
        throw new Error(`Failed to batch delete conversations: ${error}`);
      }
    }
    if (this.graphAdapter && plan.graph.length > 0) {
      const deletionContext = createDeletionContext(
        `Agent cascade deletion for ${agentId}`,
        {
          ...ORPHAN_RULES,
          // Override rules for agent deletion (explicitly requested)
          Agent: { explicitOnly: false, neverDelete: false },
          Participant: { explicitOnly: false, neverDelete: false }
        }
      );
      const BATCH_SIZE = 10;
      for (let i = 0; i < plan.graph.length; i += BATCH_SIZE) {
        const batch = plan.graph.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (node) => {
            try {
              return await deleteWithOrphanCleanup(
                node.nodeId,
                node.labels[0] || "Agent",
                deletionContext,
                this.graphAdapter
              );
            } catch (error) {
              console.warn(
                `Failed to delete graph node ${node.nodeId}:`,
                error
              );
              return { deletedNodes: [], orphanIslands: [] };
            }
          })
        );
        for (const deleteResult of batchResults) {
          result.graphNodesDeleted = (result.graphNodesDeleted || 0) + deleteResult.deletedNodes.length;
        }
      }
      if (result.graphNodesDeleted && result.graphNodesDeleted > 0) {
        result.deletedLayers.push("graph");
      }
    }
    if (plan.agentRegistration) {
      try {
        await this.client.mutation(api.agents.unregister, { tenantId: this.authContext?.tenantId, agentId });
        result.deletedLayers.push("agent-registration");
      } catch (error) {
        throw new Error(`Failed to unregister agent ${agentId}: ${error}`);
      }
    }
    result.totalDeleted = result.conversationsDeleted + result.memoriesDeleted + result.factsDeleted + (result.graphNodesDeleted || 0) + (plan.agentRegistration ? 1 : 0);
    return result;
  }
  /**
   * ROLLBACK: Restore backed up records
   */
  async rollbackAgentDeletion(backups) {
    console.warn("Rolling back agent cascade deletion...");
    if (backups.agentRegistration) {
      try {
        await this.client.mutation(api.agents.register, {
          tenantId: this.authContext?.tenantId,
          agentId: backups.agentRegistration.id,
          name: backups.agentRegistration.name,
          description: backups.agentRegistration.description,
          metadata: backups.agentRegistration.metadata,
          config: backups.agentRegistration.config
        });
      } catch (error) {
        console.error("Failed to restore agent registration:", error);
      }
    }
    console.warn(
      "Rollback completed for agent registration (data restoration requires manual intervention)"
    );
  }
  /**
   * PHASE 4: Verify deletion completeness
   * OPTIMIZED: Runs all verification queries in parallel
   */
  async verifyAgentDeletion(agentId) {
    const issues = [];
    const memorySpacesResult = await this.client.query(
      api.memorySpaces.list,
      {}
    );
    const memorySpacesList = memorySpacesResult.spaces;
    const [memoryCounts, conversationCounts, factCounts, graphCount] = await Promise.all([
      // Check for remaining memories (parallel across all spaces)
      Promise.all(
        memorySpacesList.map(
          (space) => this.client.query(api.memories.list, { memorySpaceId: space.memorySpaceId }).then(
            (memories) => memories.filter(
              (m) => m.participantId === agentId
            ).length
          ).catch(() => 0)
        )
      ),
      // Check for remaining conversations (parallel across all spaces)
      Promise.all(
        memorySpacesList.map(
          (space) => this.client.query(api.conversations.list, {
            memorySpaceId: space.memorySpaceId
          }).then((result) => {
            const conversations = result.conversations;
            return conversations.filter(
              (c) => c.participants.participantId === agentId || c.participants.agentId === agentId || c.participantId === agentId
            ).length;
          }).catch(() => 0)
        )
      ),
      // Check for remaining facts (parallel across all spaces)
      Promise.all(
        memorySpacesList.map(
          (space) => this.client.query(api.facts.list, { memorySpaceId: space.memorySpaceId }).then(
            (facts) => facts.filter(
              (f) => f.participantId === agentId
            ).length
          ).catch(() => 0)
        )
      ),
      // Check graph nodes
      this.graphAdapter ? this.countGraphNodes(agentId).catch(() => 0) : Promise.resolve(-1)
      // -1 indicates no graph adapter
    ]);
    const remainingMemories = memoryCounts.reduce((a, b) => a + b, 0);
    const remainingConvos = conversationCounts.reduce((a, b) => a + b, 0);
    const remainingFacts = factCounts.reduce((a, b) => a + b, 0);
    if (remainingMemories > 0) {
      issues.push(
        `${remainingMemories} memories still reference participantId`
      );
    }
    if (remainingConvos > 0) {
      issues.push(
        `${remainingConvos} conversations still reference participantId`
      );
    }
    if (remainingFacts > 0) {
      issues.push(`${remainingFacts} facts still reference participantId`);
    }
    if (graphCount === -1) {
      issues.push(
        "Graph adapter not configured - manual graph cleanup required"
      );
    } else if (graphCount > 0) {
      issues.push(`${graphCount} graph nodes still reference participantId`);
    }
    return {
      complete: issues.length === 0 || issues.length === 1 && issues[0].includes("Graph adapter"),
      issues
    };
  }
  /**
   * Count remaining graph nodes for agent
   */
  async countGraphNodes(agentId) {
    if (!this.graphAdapter) {
      return 0;
    }
    try {
      const result = await this.graphAdapter.query(
        `MATCH (n {participantId: $participantId}) RETURN count(n) as count`,
        { participantId: agentId }
      );
      const record = result.records[0];
      return record?.count ?? 0;
    } catch (error) {
      console.warn("Failed to count graph nodes:", error);
      return 0;
    }
  }
  /**
   * Calculate deletion totals from plan
   */
  calculateDeletionTotals(plan) {
    const conversationsDeleted = plan.conversations.length;
    const conversationMessagesDeleted = plan.conversations.reduce(
      (sum, c) => sum + (c.messageCount || 0),
      0
    );
    const memoriesDeleted = plan.memories.length;
    const factsDeleted = plan.facts.length;
    const graphNodesDeleted = plan.graph.length;
    const totalDeleted = conversationsDeleted + memoriesDeleted + factsDeleted + graphNodesDeleted + (plan.agentRegistration ? 1 : 0);
    return {
      conversationsDeleted,
      conversationMessagesDeleted,
      memoriesDeleted,
      factsDeleted,
      graphNodesDeleted,
      totalDeleted
    };
  }
  /**
   * Get affected layers from deletion plan
   */
  getAffectedLayers(plan) {
    const layers = [];
    if (plan.conversations.length > 0) layers.push("conversations");
    if (plan.memories.length > 0) layers.push("memories");
    if (plan.facts.length > 0) layers.push("facts");
    if (plan.graph.length > 0) layers.push("graph");
    if (plan.agentRegistration) layers.push("agent-registration");
    return layers;
  }
};

// src/governance/index.ts
init_api();

// src/governance/validators.ts
var GovernanceValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "GovernanceValidationError";
  }
};
function validateGovernancePolicy(policy) {
  if (!policy) {
    throw new GovernanceValidationError("Policy is required", "MISSING_POLICY");
  }
  if (!policy.conversations) {
    throw new GovernanceValidationError(
      "Policy must include conversations configuration",
      "MISSING_REQUIRED_FIELD",
      "conversations"
    );
  }
  if (!policy.immutable) {
    throw new GovernanceValidationError(
      "Policy must include immutable configuration",
      "MISSING_REQUIRED_FIELD",
      "immutable"
    );
  }
  if (!policy.mutable) {
    throw new GovernanceValidationError(
      "Policy must include mutable configuration",
      "MISSING_REQUIRED_FIELD",
      "mutable"
    );
  }
  if (!policy.vector) {
    throw new GovernanceValidationError(
      "Policy must include vector configuration",
      "MISSING_REQUIRED_FIELD",
      "vector"
    );
  }
  if (!policy.compliance) {
    throw new GovernanceValidationError(
      "Policy must include compliance configuration",
      "MISSING_REQUIRED_FIELD",
      "compliance"
    );
  }
  if (!policy.conversations.retention) {
    throw new GovernanceValidationError(
      "Conversations policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "conversations.retention"
    );
  }
  if (!policy.conversations.purging) {
    throw new GovernanceValidationError(
      "Conversations policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "conversations.purging"
    );
  }
  if (!policy.immutable.retention) {
    throw new GovernanceValidationError(
      "Immutable policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "immutable.retention"
    );
  }
  if (!policy.immutable.purging) {
    throw new GovernanceValidationError(
      "Immutable policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "immutable.purging"
    );
  }
  if (!policy.mutable.retention) {
    throw new GovernanceValidationError(
      "Mutable policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "mutable.retention"
    );
  }
  if (!policy.mutable.purging) {
    throw new GovernanceValidationError(
      "Mutable policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "mutable.purging"
    );
  }
  if (!policy.vector.retention) {
    throw new GovernanceValidationError(
      "Vector policy must include retention configuration",
      "MISSING_REQUIRED_FIELD",
      "vector.retention"
    );
  }
  if (!policy.vector.purging) {
    throw new GovernanceValidationError(
      "Vector policy must include purging configuration",
      "MISSING_REQUIRED_FIELD",
      "vector.purging"
    );
  }
}
function validatePeriodFormat(period, fieldName = "period") {
  if (!period || typeof period !== "string") {
    throw new GovernanceValidationError(
      `${fieldName} is required and must be a string`,
      "INVALID_PERIOD_FORMAT",
      fieldName
    );
  }
  const periodRegex = /^\d+[dmy]$/;
  if (!periodRegex.test(period)) {
    throw new GovernanceValidationError(
      `Invalid period format "${period}". Must be in format like "7d" (days), "30m" (months), or "1y" (years)`,
      "INVALID_PERIOD_FORMAT",
      fieldName
    );
  }
}
function validateImportanceRanges(ranges) {
  if (!Array.isArray(ranges)) {
    throw new GovernanceValidationError(
      "Importance ranges must be an array",
      "INVALID_IMPORTANCE_RANGE"
    );
  }
  for (let i = 0; i < ranges.length; i++) {
    const { range, versions } = ranges[i];
    if (!Array.isArray(range) || range.length !== 2) {
      throw new GovernanceValidationError(
        `Range at index ${i} must be a tuple [min, max]`,
        "INVALID_IMPORTANCE_RANGE"
      );
    }
    const [min, max] = range;
    if (typeof min !== "number" || typeof max !== "number") {
      throw new GovernanceValidationError(
        `Range at index ${i} must contain numbers`,
        "INVALID_IMPORTANCE_RANGE"
      );
    }
    if (min < 0 || min > 100) {
      throw new GovernanceValidationError(
        `Range minimum at index ${i} must be between 0 and 100, got ${min}`,
        "INVALID_IMPORTANCE_RANGE"
      );
    }
    if (max < 0 || max > 100) {
      throw new GovernanceValidationError(
        `Range maximum at index ${i} must be between 0 and 100, got ${max}`,
        "INVALID_IMPORTANCE_RANGE"
      );
    }
    if (min >= max) {
      throw new GovernanceValidationError(
        `Range at index ${i} must have min < max, got [${min}, ${max}]`,
        "INVALID_IMPORTANCE_RANGE"
      );
    }
    if (typeof versions !== "number" || versions < -1) {
      throw new GovernanceValidationError(
        `Versions at index ${i} must be a number >= -1 (where -1 means unlimited), got ${versions}`,
        "INVALID_VERSIONS"
      );
    }
    for (let j = 0; j < i; j++) {
      const [prevMin, prevMax] = ranges[j].range;
      if (min >= prevMin && min <= prevMax || max >= prevMin && max <= prevMax || min <= prevMin && max >= prevMax) {
        throw new GovernanceValidationError(
          `Range [${min}, ${max}] at index ${i} overlaps with range [${prevMin}, ${prevMax}] at index ${j}`,
          "OVERLAPPING_IMPORTANCE_RANGES"
        );
      }
    }
  }
}
function validateVersionCount(versions, fieldName = "versions") {
  if (typeof versions !== "number") {
    throw new GovernanceValidationError(
      `${fieldName} must be a number`,
      "INVALID_VERSIONS",
      fieldName
    );
  }
  if (versions < -1) {
    throw new GovernanceValidationError(
      `${fieldName} must be >= -1 (where -1 means unlimited), got ${versions}`,
      "INVALID_VERSIONS",
      fieldName
    );
  }
}
function validatePolicyScope(scope) {
  if (!scope) {
    throw new GovernanceValidationError("Scope is required", "MISSING_SCOPE");
  }
  const hasOrgId = scope.organizationId && scope.organizationId.trim().length > 0;
  const hasSpaceId = scope.memorySpaceId && scope.memorySpaceId.trim().length > 0;
  if (!hasOrgId && !hasSpaceId) {
    throw new GovernanceValidationError(
      "Scope must include either organizationId or memorySpaceId",
      "INVALID_SCOPE"
    );
  }
  if (scope.organizationId !== void 0 && !hasOrgId) {
    throw new GovernanceValidationError(
      "organizationId cannot be empty",
      "INVALID_SCOPE",
      "organizationId"
    );
  }
  if (scope.memorySpaceId !== void 0 && !hasSpaceId) {
    throw new GovernanceValidationError(
      "memorySpaceId cannot be empty",
      "INVALID_SCOPE",
      "memorySpaceId"
    );
  }
}
var VALID_LAYERS = [
  "conversations",
  "immutable",
  "mutable",
  "vector"
];
var VALID_RULES = ["retention", "purging"];
function validateEnforcementOptions(options) {
  if (!options) {
    throw new GovernanceValidationError(
      "Enforcement options are required",
      "MISSING_OPTIONS"
    );
  }
  if (!options.scope) {
    throw new GovernanceValidationError(
      "Enforcement requires a scope (organizationId or memorySpaceId)",
      "MISSING_SCOPE"
    );
  }
  validatePolicyScope(options.scope);
  if (options.layers !== void 0) {
    if (!Array.isArray(options.layers)) {
      throw new GovernanceValidationError(
        "Layers must be an array",
        "INVALID_LAYERS"
      );
    }
    if (options.layers.length === 0) {
      throw new GovernanceValidationError(
        "Layers array cannot be empty. Valid layers: conversations, immutable, mutable, vector",
        "INVALID_LAYERS"
      );
    }
    for (const layer of options.layers) {
      if (!VALID_LAYERS.includes(layer)) {
        throw new GovernanceValidationError(
          `Invalid layer "${layer}". Valid layers: ${VALID_LAYERS.join(", ")}`,
          "INVALID_LAYERS"
        );
      }
    }
  }
  if (options.rules !== void 0) {
    if (!Array.isArray(options.rules)) {
      throw new GovernanceValidationError(
        "Rules must be an array",
        "INVALID_RULES"
      );
    }
    if (options.rules.length === 0) {
      throw new GovernanceValidationError(
        "Rules array cannot be empty. Valid rules: retention, purging",
        "INVALID_RULES"
      );
    }
    for (const rule of options.rules) {
      if (!VALID_RULES.includes(rule)) {
        throw new GovernanceValidationError(
          `Invalid rule "${rule}". Valid rules: ${VALID_RULES.join(", ")}`,
          "INVALID_RULES"
        );
      }
    }
  }
}
function validateDateRange3(start, end) {
  if (!(start instanceof Date) || isNaN(start.getTime())) {
    throw new GovernanceValidationError(
      "Start date must be a valid Date object",
      "INVALID_DATE_RANGE",
      "start"
    );
  }
  if (!(end instanceof Date) || isNaN(end.getTime())) {
    throw new GovernanceValidationError(
      "End date must be a valid Date object",
      "INVALID_DATE_RANGE",
      "end"
    );
  }
  if (start.getTime() >= end.getTime()) {
    throw new GovernanceValidationError(
      "Start date must be before end date",
      "INVALID_DATE_RANGE"
    );
  }
}
var VALID_PERIODS = ["7d", "30d", "90d", "1y"];
function validateStatsPeriod(period) {
  if (!period || typeof period !== "string") {
    throw new GovernanceValidationError(
      "Period is required and must be a string",
      "INVALID_PERIOD"
    );
  }
  if (!VALID_PERIODS.includes(period)) {
    throw new GovernanceValidationError(
      `Invalid period "${period}". Valid periods: ${VALID_PERIODS.join(", ")}`,
      "INVALID_PERIOD"
    );
  }
}
var VALID_TEMPLATES = ["GDPR", "HIPAA", "SOC2", "FINRA"];
function validateComplianceTemplate(template) {
  if (!template || typeof template !== "string") {
    throw new GovernanceValidationError(
      "Compliance template is required",
      "INVALID_COMPLIANCE_MODE"
    );
  }
  if (!VALID_TEMPLATES.includes(template)) {
    throw new GovernanceValidationError(
      `Invalid compliance template "${template}". Valid templates: ${VALID_TEMPLATES.join(", ")}`,
      "INVALID_COMPLIANCE_MODE"
    );
  }
}

// src/governance/index.ts
var GovernanceCapabilityError = class extends Error {
  code = "BACKEND_ENFORCEMENT_ONLY";
  retryable = false;
  outcome = "not_dispatched";
  requiredExecution = "trusted_backend_worker";
  enforcementAdapter = "SIMULATION";
  constructor() {
    super(
      "Manual governance enforcement requires a trusted backend worker. No operation was dispatched. The current backend enforcement adapter performs simulation only; automatic retention deletion is not implemented."
    );
    this.name = "GovernanceCapabilityError";
  }
};
var GovernanceAPI = class {
  constructor(client, _graphAdapter, resilience) {
    this.client = client;
    this._graphAdapter = _graphAdapter;
    this.resilience = resilience;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Set governance policy for organization or memory space
   *
   * @param policy - Complete governance policy
   * @returns Policy result with confirmation
   *
   * @example
   * ```typescript
   * await cortex.governance.setPolicy({
   *   organizationId: "org-123",
   *   conversations: {
   *     retention: { deleteAfter: "7y", purgeOnUserRequest: true },
   *     purging: { autoDelete: true, deleteInactiveAfter: "2y" }
   *   },
   *   compliance: { mode: "GDPR", dataRetentionYears: 7, auditLogging: true }
   * });
   * ```
   */
  async setPolicy(policy) {
    validateGovernancePolicy(policy);
    if (!policy.organizationId && !policy.memorySpaceId) {
      throw new GovernanceValidationError(
        "Policy must specify either organizationId or memorySpaceId",
        "MISSING_SCOPE"
      );
    }
    validatePeriodFormat(
      policy.conversations.retention.deleteAfter,
      "conversations.retention.deleteAfter"
    );
    if (policy.conversations.retention.archiveAfter) {
      validatePeriodFormat(
        policy.conversations.retention.archiveAfter,
        "conversations.retention.archiveAfter"
      );
    }
    if (policy.conversations.purging.deleteInactiveAfter) {
      validatePeriodFormat(
        policy.conversations.purging.deleteInactiveAfter,
        "conversations.purging.deleteInactiveAfter"
      );
    }
    if (policy.mutable.retention.defaultTTL) {
      validatePeriodFormat(
        policy.mutable.retention.defaultTTL,
        "mutable.retention.defaultTTL"
      );
    }
    if (policy.mutable.retention.purgeInactiveAfter) {
      validatePeriodFormat(
        policy.mutable.retention.purgeInactiveAfter,
        "mutable.retention.purgeInactiveAfter"
      );
    }
    if (policy.mutable.purging.deleteUnaccessedAfter) {
      validatePeriodFormat(
        policy.mutable.purging.deleteUnaccessedAfter,
        "mutable.purging.deleteUnaccessedAfter"
      );
    }
    if (policy.immutable.purging.purgeUnusedAfter) {
      validatePeriodFormat(
        policy.immutable.purging.purgeUnusedAfter,
        "immutable.purging.purgeUnusedAfter"
      );
    }
    validateVersionCount(
      policy.immutable.retention.defaultVersions,
      "immutable.retention.defaultVersions"
    );
    validateVersionCount(
      policy.vector.retention.defaultVersions,
      "vector.retention.defaultVersions"
    );
    if (policy.vector.retention.byImportance.length > 0) {
      validateImportanceRanges(policy.vector.retention.byImportance);
    }
    return await this.executeWithResilience(
      () => this.client.mutation(
        api.governance.setPolicy,
        { policy }
      ),
      "governance:setPolicy"
    );
  }
  /**
   * Get current governance policy
   *
   * @param scope - Optional organization or memory space scope
   * @returns Current policy (includes org defaults + overrides)
   *
   * @example
   * ```typescript
   * // Get org-wide policy
   * const orgPolicy = await cortex.governance.getPolicy({
   *   organizationId: "org-123"
   * });
   *
   * // Get memory-space-specific policy (includes org defaults)
   * const spacePolicy = await cortex.governance.getPolicy({
   *   memorySpaceId: "audit-agent-space"
   * });
   * ```
   */
  async getPolicy(scope) {
    if (scope && (scope.organizationId !== void 0 || scope.memorySpaceId !== void 0)) {
      validatePolicyScope(scope);
    }
    return await this.executeWithResilience(
      () => this.client.query(
        api.governance.getPolicy,
        { scope: scope || {} }
      ),
      "governance:getPolicy"
    );
  }
  /**
   * Override policy for specific memory space
   *
   * @param memorySpaceId - Memory space to override
   * @param overrides - Partial policy to override org defaults
   *
   * @example
   * ```typescript
   * // Audit agent needs unlimited retention
   * await cortex.governance.setAgentOverride("audit-agent", {
   *   vector: {
   *     retention: { defaultVersions: -1 } // Unlimited
   *   }
   * });
   * ```
   */
  async setAgentOverride(memorySpaceId, overrides) {
    if (!memorySpaceId || memorySpaceId.trim().length === 0) {
      throw new GovernanceValidationError(
        "memorySpaceId is required and cannot be empty",
        "MISSING_SCOPE",
        "memorySpaceId"
      );
    }
    if (overrides.conversations?.retention.deleteAfter) {
      validatePeriodFormat(
        overrides.conversations.retention.deleteAfter,
        "conversations.retention.deleteAfter"
      );
    }
    if (overrides.conversations?.retention.archiveAfter) {
      validatePeriodFormat(
        overrides.conversations.retention.archiveAfter,
        "conversations.retention.archiveAfter"
      );
    }
    if (overrides.conversations?.purging.deleteInactiveAfter) {
      validatePeriodFormat(
        overrides.conversations.purging.deleteInactiveAfter,
        "conversations.purging.deleteInactiveAfter"
      );
    }
    if (overrides.mutable?.retention.defaultTTL) {
      validatePeriodFormat(
        overrides.mutable.retention.defaultTTL,
        "mutable.retention.defaultTTL"
      );
    }
    if (overrides.mutable?.retention.purgeInactiveAfter) {
      validatePeriodFormat(
        overrides.mutable.retention.purgeInactiveAfter,
        "mutable.retention.purgeInactiveAfter"
      );
    }
    if (overrides.mutable?.purging.deleteUnaccessedAfter) {
      validatePeriodFormat(
        overrides.mutable.purging.deleteUnaccessedAfter,
        "mutable.purging.deleteUnaccessedAfter"
      );
    }
    if (overrides.immutable?.purging.purgeUnusedAfter) {
      validatePeriodFormat(
        overrides.immutable.purging.purgeUnusedAfter,
        "immutable.purging.purgeUnusedAfter"
      );
    }
    if (overrides.immutable?.retention.defaultVersions !== void 0) {
      validateVersionCount(
        overrides.immutable.retention.defaultVersions,
        "immutable.retention.defaultVersions"
      );
    }
    if (overrides.vector?.retention.defaultVersions !== void 0) {
      validateVersionCount(
        overrides.vector.retention.defaultVersions,
        "vector.retention.defaultVersions"
      );
    }
    if (overrides.vector?.retention.byImportance) {
      validateImportanceRanges(overrides.vector.retention.byImportance);
    }
    await this.executeWithResilience(
      () => this.client.mutation(
        api.governance.setAgentOverride,
        { memorySpaceId, overrides }
      ),
      "governance:setAgentOverride"
    );
  }
  /**
   * Get compliance template (GDPR, HIPAA, SOC2, FINRA)
   *
   * @param template - Template name
   * @returns Pre-configured policy for compliance standard
   *
   * @example
   * ```typescript
   * const gdprPolicy = await cortex.governance.getTemplate("GDPR");
   * await cortex.governance.setPolicy({
   *   organizationId: "org-123",
   *   ...gdprPolicy
   * });
   * ```
   */
  async getTemplate(template) {
    validateComplianceTemplate(template);
    return await this.executeWithResilience(
      () => this.client.query(
        api.governance.getTemplate,
        { template }
      ),
      "governance:getTemplate"
    );
  }
  /**
   * Validate a manual enforcement request and reject client-side execution.
   *
   * Enforcement is internal to trusted backend workers. This client method
   * dispatches no request and does not enter the resilience layer. The current
   * backend adapter records simulations only; actual retention deletion,
   * including automatic retention enforcement, is not implemented.
   *
   * @param options - Enforcement options (layers, rules)
   * @throws {GovernanceValidationError} If the options are invalid.
   * @throws {GovernanceCapabilityError} For valid options; requires a trusted
   * backend worker, is not retryable, and has outcome `not_dispatched`.
   */
  async enforce(options) {
    validateEnforcementOptions(options);
    throw new GovernanceCapabilityError();
  }
  /**
   * Simulate policy impact without applying
   *
   * Previews what would happen if a policy were applied, without actually
   * applying it. Useful for testing policy changes before committing.
   *
   * @param options - Simulation options (policy to test)
   * @returns Simulation result with impact analysis
   *
   * @example
   * ```typescript
   * const impact = await cortex.governance.simulate({
   *   organizationId: "org-123",
   *   vector: {
   *     retention: {
   *       byImportance: [{ range: [0, 30], versions: 1 }]
   *     }
   *   }
   * });
   * console.log(`Would delete ${impact.versionsAffected} versions`);
   * console.log(`Would save ${impact.storageFreed} MB`);
   * console.log(`Estimated savings: $${impact.costSavings}/month`);
   * ```
   */
  async simulate(options) {
    if (options.conversations?.retention.deleteAfter) {
      validatePeriodFormat(
        options.conversations.retention.deleteAfter,
        "conversations.retention.deleteAfter"
      );
    }
    if (options.conversations?.retention.archiveAfter) {
      validatePeriodFormat(
        options.conversations.retention.archiveAfter,
        "conversations.retention.archiveAfter"
      );
    }
    if (options.conversations?.purging.deleteInactiveAfter) {
      validatePeriodFormat(
        options.conversations.purging.deleteInactiveAfter,
        "conversations.purging.deleteInactiveAfter"
      );
    }
    if (options.mutable?.retention.defaultTTL) {
      validatePeriodFormat(
        options.mutable.retention.defaultTTL,
        "mutable.retention.defaultTTL"
      );
    }
    if (options.mutable?.retention.purgeInactiveAfter) {
      validatePeriodFormat(
        options.mutable.retention.purgeInactiveAfter,
        "mutable.retention.purgeInactiveAfter"
      );
    }
    if (options.mutable?.purging.deleteUnaccessedAfter) {
      validatePeriodFormat(
        options.mutable.purging.deleteUnaccessedAfter,
        "mutable.purging.deleteUnaccessedAfter"
      );
    }
    if (options.immutable?.purging.purgeUnusedAfter) {
      validatePeriodFormat(
        options.immutable.purging.purgeUnusedAfter,
        "immutable.purging.purgeUnusedAfter"
      );
    }
    if (options.immutable?.retention.defaultVersions !== void 0) {
      validateVersionCount(
        options.immutable.retention.defaultVersions,
        "immutable.retention.defaultVersions"
      );
    }
    if (options.vector?.retention.defaultVersions !== void 0) {
      validateVersionCount(
        options.vector.retention.defaultVersions,
        "vector.retention.defaultVersions"
      );
    }
    if (options.vector?.retention.byImportance) {
      validateImportanceRanges(options.vector.retention.byImportance);
    }
    return await this.executeWithResilience(
      () => this.client.query(
        api.governance.simulate,
        { options }
      ),
      "governance:simulate"
    );
  }
  /**
   * Generate compliance report
   *
   * Creates a detailed compliance report showing policy adherence,
   * data retention status, and user request fulfillment.
   *
   * @param options - Report options (org, period)
   * @returns Compliance report
   *
   * @example
   * ```typescript
   * const report = await cortex.governance.getComplianceReport({
   *   organizationId: "org-123",
   *   period: {
   *     start: new Date("2025-01-01"),
   *     end: new Date("2025-10-31")
   *   }
   * });
   * console.log(`Status: ${report.conversations.complianceStatus}`);
   * ```
   */
  async getComplianceReport(options) {
    validateDateRange3(options.period.start, options.period.end);
    if (options.organizationId || options.memorySpaceId) {
      validatePolicyScope({
        organizationId: options.organizationId,
        memorySpaceId: options.memorySpaceId
      });
    }
    const convexOptions = {
      organizationId: options.organizationId,
      memorySpaceId: options.memorySpaceId,
      period: {
        start: options.period.start.getTime(),
        end: options.period.end.getTime()
      }
    };
    return await this.executeWithResilience(
      () => this.client.query(
        api.governance.getComplianceReport,
        { options: convexOptions }
      ),
      "governance:getComplianceReport"
    );
  }
  /**
   * Get enforcement statistics
   *
   * Returns statistics about policy enforcement over a time period.
   * Shows what has been purged, storage freed, and cost savings.
   *
   * @param options - Stats options (period)
   * @returns Enforcement statistics
   *
   * @example
   * ```typescript
   * const stats = await cortex.governance.getEnforcementStats({
   *   period: "30d"
   * });
   * console.log(`Vector versions deleted: ${stats.vector.versionsDeleted}`);
   * console.log(`Storage freed: ${stats.storageFreed} MB`);
   * console.log(`Cost savings: $${stats.costSavings}`);
   * ```
   */
  async getEnforcementStats(options) {
    validateStatsPeriod(options.period);
    if (options.organizationId || options.memorySpaceId) {
      validatePolicyScope({
        organizationId: options.organizationId,
        memorySpaceId: options.memorySpaceId
      });
    }
    return await this.executeWithResilience(
      () => this.client.query(
        api.governance.getEnforcementStats,
        { options }
      ),
      "governance:getEnforcementStats"
    );
  }
};

// src/a2a/index.ts
init_api();

// src/types/index.ts
var A2ATimeoutError = class extends Error {
  constructor(message, messageId, timeout) {
    super(message);
    this.messageId = messageId;
    this.timeout = timeout;
  }
  name = "A2ATimeoutError";
};

// src/a2a/validators.ts
var A2AValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
  }
  name = "A2AValidationError";
};
var AGENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
var MAX_AGENT_ID_LENGTH = 100;
function validateAgentId2(id, fieldName) {
  if (id === void 0 || id === null) {
    throw new A2AValidationError(
      `${fieldName} is required`,
      "INVALID_AGENT_ID",
      fieldName
    );
  }
  if (typeof id !== "string") {
    throw new A2AValidationError(
      `${fieldName} must be a string`,
      "INVALID_AGENT_ID",
      fieldName
    );
  }
  if (id.trim() === "") {
    throw new A2AValidationError(
      `${fieldName} cannot be empty`,
      "INVALID_AGENT_ID",
      fieldName
    );
  }
  if (id.length > MAX_AGENT_ID_LENGTH) {
    throw new A2AValidationError(
      `${fieldName} exceeds maximum length of ${MAX_AGENT_ID_LENGTH} characters`,
      "INVALID_AGENT_ID",
      fieldName
    );
  }
  if (!AGENT_ID_PATTERN.test(id)) {
    throw new A2AValidationError(
      `${fieldName} contains invalid characters. Only alphanumeric characters, hyphens, and underscores are allowed`,
      "INVALID_AGENT_ID",
      fieldName
    );
  }
}
var MAX_MESSAGE_SIZE = 102400;
function validateMessage(message) {
  if (message === void 0 || message === null) {
    throw new A2AValidationError(
      "Message is required",
      "EMPTY_MESSAGE",
      "message"
    );
  }
  if (typeof message !== "string") {
    throw new A2AValidationError(
      "Message must be a string",
      "EMPTY_MESSAGE",
      "message"
    );
  }
  if (message.trim() === "") {
    throw new A2AValidationError(
      "Message cannot be empty or whitespace-only",
      "EMPTY_MESSAGE",
      "message"
    );
  }
  const byteSize = new TextEncoder().encode(message).length;
  if (byteSize > MAX_MESSAGE_SIZE) {
    throw new A2AValidationError(
      `Message exceeds maximum size of 100KB (current size: ${Math.round(byteSize / 1024)}KB)`,
      "MESSAGE_TOO_LARGE",
      "message"
    );
  }
}
function validateImportance3(importance) {
  if (importance === void 0) {
    return;
  }
  if (typeof importance !== "number") {
    throw new A2AValidationError(
      "Importance must be a number",
      "INVALID_IMPORTANCE",
      "importance"
    );
  }
  if (!Number.isInteger(importance)) {
    throw new A2AValidationError(
      "Importance must be an integer",
      "INVALID_IMPORTANCE",
      "importance"
    );
  }
  if (importance < 0 || importance > 100) {
    throw new A2AValidationError(
      `Importance must be between 0 and 100, got ${importance}`,
      "INVALID_IMPORTANCE",
      "importance"
    );
  }
}
var MIN_TIMEOUT = 1e3;
var MAX_TIMEOUT = 3e5;
function validateTimeout(timeout) {
  if (timeout === void 0) {
    return;
  }
  if (typeof timeout !== "number") {
    throw new A2AValidationError(
      "Timeout must be a number",
      "INVALID_TIMEOUT",
      "timeout"
    );
  }
  if (!Number.isInteger(timeout)) {
    throw new A2AValidationError(
      "Timeout must be an integer",
      "INVALID_TIMEOUT",
      "timeout"
    );
  }
  if (timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) {
    throw new A2AValidationError(
      `Timeout must be between ${MIN_TIMEOUT}ms (1 second) and ${MAX_TIMEOUT}ms (5 minutes), got ${timeout}ms`,
      "INVALID_TIMEOUT",
      "timeout"
    );
  }
}
var MAX_RETRIES = 10;
function validateRetries(retries) {
  if (retries === void 0) {
    return;
  }
  if (typeof retries !== "number") {
    throw new A2AValidationError(
      "Retries must be a number",
      "INVALID_RETRIES",
      "retries"
    );
  }
  if (!Number.isInteger(retries)) {
    throw new A2AValidationError(
      "Retries must be an integer",
      "INVALID_RETRIES",
      "retries"
    );
  }
  if (retries < 0 || retries > MAX_RETRIES) {
    throw new A2AValidationError(
      `Retries must be between 0 and ${MAX_RETRIES}, got ${retries}`,
      "INVALID_RETRIES",
      "retries"
    );
  }
}
var MAX_RECIPIENTS = 100;
function validateRecipients(recipients, sender) {
  if (!recipients || !Array.isArray(recipients)) {
    throw new A2AValidationError(
      "Recipients must be an array",
      "EMPTY_RECIPIENTS",
      "to"
    );
  }
  if (recipients.length === 0) {
    throw new A2AValidationError(
      "Recipients array cannot be empty",
      "EMPTY_RECIPIENTS",
      "to"
    );
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw new A2AValidationError(
      `Maximum ${MAX_RECIPIENTS} recipients allowed, got ${recipients.length}`,
      "TOO_MANY_RECIPIENTS",
      "to"
    );
  }
  const seen = /* @__PURE__ */ new Set();
  for (const recipient of recipients) {
    if (seen.has(recipient)) {
      throw new A2AValidationError(
        `Duplicate recipient: ${recipient}`,
        "DUPLICATE_RECIPIENTS",
        "to"
      );
    }
    seen.add(recipient);
  }
  if (recipients.includes(sender)) {
    throw new A2AValidationError(
      "Sender cannot be included in recipients list",
      "INVALID_RECIPIENT",
      "to"
    );
  }
  for (let i = 0; i < recipients.length; i++) {
    try {
      validateAgentId2(recipients[i], `to[${i}]`);
    } catch (error) {
      if (error instanceof A2AValidationError) {
        throw new A2AValidationError(
          `Invalid recipient at index ${i}: ${error.message}`,
          "INVALID_AGENT_ID",
          "to"
        );
      }
      throw error;
    }
  }
}
var MAX_LIMIT2 = 1e3;
function validateConversationFilters(filters) {
  if (!filters) {
    return;
  }
  if (filters.since && filters.until) {
    const sinceTime = filters.since instanceof Date ? filters.since.getTime() : filters.since;
    const untilTime = filters.until instanceof Date ? filters.until.getTime() : filters.until;
    if (sinceTime > untilTime) {
      throw new A2AValidationError(
        "'since' must be before 'until'",
        "INVALID_DATE_RANGE"
      );
    }
  }
  if (filters.minImportance !== void 0) {
    if (typeof filters.minImportance !== "number" || filters.minImportance < 0 || filters.minImportance > 100) {
      throw new A2AValidationError(
        "minImportance must be between 0 and 100",
        "INVALID_IMPORTANCE",
        "minImportance"
      );
    }
  }
  if (filters.limit !== void 0) {
    if (typeof filters.limit !== "number" || !Number.isInteger(filters.limit)) {
      throw new A2AValidationError(
        "Limit must be an integer",
        "INVALID_LIMIT",
        "limit"
      );
    }
    if (filters.limit <= 0) {
      throw new A2AValidationError(
        "Limit must be greater than 0",
        "INVALID_LIMIT",
        "limit"
      );
    }
    if (filters.limit > MAX_LIMIT2) {
      throw new A2AValidationError(
        `Limit cannot exceed ${MAX_LIMIT2}`,
        "INVALID_LIMIT",
        "limit"
      );
    }
  }
  if (filters.offset !== void 0) {
    if (typeof filters.offset !== "number" || !Number.isInteger(filters.offset)) {
      throw new A2AValidationError(
        "Offset must be an integer",
        "INVALID_OFFSET",
        "offset"
      );
    }
    if (filters.offset < 0) {
      throw new A2AValidationError(
        "Offset cannot be negative",
        "INVALID_OFFSET",
        "offset"
      );
    }
  }
}
function validateSendParams(params) {
  if (!params) {
    throw new A2AValidationError(
      "Send parameters are required",
      "MISSING_PARAMS"
    );
  }
  validateAgentId2(params.from, "from");
  validateAgentId2(params.to, "to");
  validateMessage(params.message);
  if (params.from === params.to) {
    throw new A2AValidationError(
      "Cannot send message to self. 'from' and 'to' must be different agents",
      "SAME_AGENT_COMMUNICATION"
    );
  }
  validateImportance3(params.importance);
}
function validateRequestParams(params) {
  if (!params) {
    throw new A2AValidationError(
      "Request parameters are required",
      "MISSING_PARAMS"
    );
  }
  validateAgentId2(params.from, "from");
  validateAgentId2(params.to, "to");
  validateMessage(params.message);
  if (params.from === params.to) {
    throw new A2AValidationError(
      "Cannot send request to self. 'from' and 'to' must be different agents",
      "SAME_AGENT_COMMUNICATION"
    );
  }
  validateTimeout(params.timeout);
  validateRetries(params.retries);
  validateImportance3(params.importance);
}
function validateBroadcastParams(params) {
  if (!params) {
    throw new A2AValidationError(
      "Broadcast parameters are required",
      "MISSING_PARAMS"
    );
  }
  validateAgentId2(params.from, "from");
  validateMessage(params.message);
  validateRecipients(params.to, params.from);
  validateImportance3(params.importance);
}

// src/a2a/index.ts
var a2aApi = api;
var A2AAPI = class {
  constructor(client, _graphAdapter, resilience) {
    this.client = client;
    this._graphAdapter = _graphAdapter;
    this.resilience = resilience;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Send a message from one agent to another.
   * Stores in ACID conversation + both agents' Vector memories.
   *
   * No pub/sub required - this is fire-and-forget.
   *
   * @param params - Send parameters
   * @returns A2A message result
   *
   * @example
   * ```typescript
   * const result = await cortex.a2a.send({
   *   from: "sales-agent",
   *   to: "support-agent",
   *   message: "Customer asking about enterprise pricing",
   *   importance: 70
   * });
   * console.log(`Message ${result.messageId} sent`);
   * ```
   */
  async send(params) {
    validateSendParams(params);
    const result = await this.executeWithResilience(
      () => this.client.mutation(a2aApi.a2a.send, {
        from: params.from,
        to: params.to,
        message: params.message,
        userId: params.userId,
        contextId: params.contextId,
        importance: params.importance,
        trackConversation: params.trackConversation,
        autoEmbed: params.autoEmbed,
        metadata: params.metadata
      }),
      "a2a:send"
    );
    return result;
  }
  /**
   * Send a request and wait for response (synchronous request-response).
   *
   * REQUIRES PUB/SUB INFRASTRUCTURE:
   * - Direct Mode: Configure your own Redis/RabbitMQ/NATS adapter
   * - Cloud Mode: Pub/sub infrastructure included automatically
   *
   * @param params - Request parameters
   * @returns A2A response
   * @throws A2ATimeoutError if no response within timeout
   *
   * @example
   * ```typescript
   * try {
   *   const response = await cortex.a2a.request({
   *     from: "finance-agent",
   *     to: "hr-agent",
   *     message: "What is the Q4 budget?",
   *     timeout: 30000
   *   });
   *   console.log(response.response);
   * } catch (error) {
   *   if (error instanceof A2ATimeoutError) {
   *     console.log("HR agent did not respond within timeout");
   *   }
   * }
   * ```
   */
  async request(params) {
    validateRequestParams(params);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(a2aApi.a2a.request, {
          from: params.from,
          to: params.to,
          message: params.message,
          timeout: params.timeout,
          retries: params.retries,
          userId: params.userId,
          contextId: params.contextId,
          importance: params.importance
        }),
        "a2a:request"
      );
      const typedResult = result;
      if (typedResult.timeout) {
        throw new A2ATimeoutError(
          `Request to ${params.to} timed out after ${params.timeout ?? 3e4}ms`,
          typedResult.messageId ?? "unknown",
          params.timeout ?? 3e4
        );
      }
      return result;
    } catch (error) {
      if (error instanceof A2ATimeoutError) {
        throw error;
      }
      let errorMessage = "";
      if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
        const convexError = error;
        errorMessage = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (errorMessage.includes("PUBSUB_NOT_CONFIGURED")) {
        const messageIdMatch = errorMessage.match(/messageId: ([a-z0-9-]+)/);
        const messageId = messageIdMatch ? messageIdMatch[1] : "unknown";
        throw new A2ATimeoutError(
          `request() requires pub/sub infrastructure for real-time responses. In Direct Mode, configure your own Redis/RabbitMQ/NATS adapter. In Cloud Mode, pub/sub is included automatically.`,
          messageId,
          params.timeout ?? 3e4
        );
      }
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      throw error;
    }
  }
  /**
   * Broadcast a message to multiple agents.
   *
   * REQUIRES PUB/SUB for optimized delivery confirmation.
   * Without pub/sub, messages are stored but delivery is not confirmed.
   *
   * @param params - Broadcast parameters
   * @returns Broadcast result
   *
   * @example
   * ```typescript
   * const result = await cortex.a2a.broadcast({
   *   from: "manager-agent",
   *   to: ["dev-agent-1", "dev-agent-2", "qa-agent"],
   *   message: "Sprint review meeting Friday at 2 PM",
   *   importance: 70
   * });
   * console.log(`Broadcast to ${result.recipients.length} agents`);
   * console.log(`Created ${result.memoriesCreated} total memories`);
   * ```
   */
  async broadcast(params) {
    validateBroadcastParams(params);
    const result = await this.executeWithResilience(
      () => this.client.mutation(a2aApi.a2a.broadcast, {
        from: params.from,
        to: params.to,
        message: params.message,
        userId: params.userId,
        contextId: params.contextId,
        importance: params.importance,
        trackConversation: params.trackConversation,
        metadata: params.metadata
      }),
      "a2a:broadcast"
    );
    return result;
  }
  /**
   * Get conversation between two agents with filtering.
   *
   * No pub/sub required - this is a database query only.
   *
   * @param agent1 - First agent ID
   * @param agent2 - Second agent ID
   * @param filters - Optional filters
   * @returns A2A conversation with messages
   *
   * @example
   * ```typescript
   * const convo = await cortex.a2a.getConversation(
   *   "finance-agent",
   *   "hr-agent",
   *   {
   *     since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
   *     minImportance: 70,
   *     tags: ["budget"]
   *   }
   * );
   * console.log(`${convo.messageCount} messages exchanged`);
   * ```
   */
  async getConversation(agent1, agent2, filters) {
    validateAgentId2(agent1, "agent1");
    validateAgentId2(agent2, "agent2");
    if (filters) {
      validateConversationFilters(filters);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(a2aApi.a2a.getConversation, {
        agent1,
        agent2,
        since: filters?.since ? filters.since.getTime() : void 0,
        until: filters?.until ? filters.until.getTime() : void 0,
        minImportance: filters?.minImportance,
        tags: filters?.tags,
        userId: filters?.userId,
        limit: filters?.limit,
        offset: filters?.offset
      }),
      "a2a:getConversation"
    );
    return result;
  }
};

// src/sessions/index.ts
init_api();

// src/sessions/validators.ts
var SessionValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "SessionValidationError";
  }
};
var VALID_STATUSES4 = ["active", "idle", "ended"];
function validateSessionId2(sessionId) {
  if (typeof sessionId !== "string") {
    throw new SessionValidationError(
      "sessionId must be a string",
      "INVALID_SESSION_ID",
      "sessionId"
    );
  }
  if (sessionId.trim().length === 0) {
    throw new SessionValidationError(
      "sessionId cannot be empty",
      "EMPTY_SESSION_ID",
      "sessionId"
    );
  }
  if (sessionId.length > 256) {
    throw new SessionValidationError(
      "sessionId cannot exceed 256 characters",
      "SESSION_ID_TOO_LONG",
      "sessionId"
    );
  }
}
function validateUserId6(userId) {
  if (typeof userId !== "string") {
    throw new SessionValidationError(
      "userId must be a string",
      "INVALID_USER_ID",
      "userId"
    );
  }
  if (userId.trim().length === 0) {
    throw new SessionValidationError(
      "userId cannot be empty",
      "EMPTY_USER_ID",
      "userId"
    );
  }
  if (userId.length > 256) {
    throw new SessionValidationError(
      "userId cannot exceed 256 characters",
      "USER_ID_TOO_LONG",
      "userId"
    );
  }
}
function validateTenantId2(tenantId) {
  if (typeof tenantId !== "string") {
    throw new SessionValidationError(
      "tenantId must be a string",
      "INVALID_TENANT_ID",
      "tenantId"
    );
  }
  if (tenantId.trim().length === 0) {
    throw new SessionValidationError(
      "tenantId cannot be empty",
      "EMPTY_TENANT_ID",
      "tenantId"
    );
  }
  if (tenantId.length > 256) {
    throw new SessionValidationError(
      "tenantId cannot exceed 256 characters",
      "TENANT_ID_TOO_LONG",
      "tenantId"
    );
  }
}
function validateStatus2(status) {
  if (typeof status !== "string") {
    throw new SessionValidationError(
      "status must be a string",
      "INVALID_STATUS",
      "status"
    );
  }
  if (!VALID_STATUSES4.includes(status)) {
    throw new SessionValidationError(
      `status must be one of: ${VALID_STATUSES4.join(", ")}`,
      "INVALID_STATUS_VALUE",
      "status"
    );
  }
}
function validateCreateSessionParams(params) {
  if (params === null || typeof params !== "object") {
    throw new SessionValidationError(
      "Session params must be an object",
      "INVALID_PARAMS"
    );
  }
  const p = params;
  if (!("userId" in p)) {
    throw new SessionValidationError(
      "userId is required",
      "MISSING_USER_ID",
      "userId"
    );
  }
  validateUserId6(p.userId);
  if (p.sessionId !== void 0) {
    validateSessionId2(p.sessionId);
  }
  if (p.tenantId !== void 0) {
    validateTenantId2(p.tenantId);
  }
  if (p.memorySpaceId !== void 0) {
    if (typeof p.memorySpaceId !== "string") {
      throw new SessionValidationError(
        "memorySpaceId must be a string",
        "INVALID_MEMORY_SPACE_ID",
        "memorySpaceId"
      );
    }
  }
  if (p.expiresAt !== void 0) {
    if (typeof p.expiresAt !== "number" || p.expiresAt < 0) {
      throw new SessionValidationError(
        "expiresAt must be a positive number (ms since epoch)",
        "INVALID_EXPIRES_AT",
        "expiresAt"
      );
    }
  }
  if (p.metadata !== void 0) {
    if (p.metadata === null || typeof p.metadata !== "object" || Array.isArray(p.metadata)) {
      throw new SessionValidationError(
        "metadata must be a plain object",
        "INVALID_METADATA",
        "metadata"
      );
    }
  }
}
function validateSessionFilters(filters) {
  if (filters === null || typeof filters !== "object") {
    throw new SessionValidationError(
      "Session filters must be an object",
      "INVALID_FILTERS"
    );
  }
  const f = filters;
  if (f.userId !== void 0) {
    validateUserId6(f.userId);
  }
  if (f.tenantId !== void 0) {
    validateTenantId2(f.tenantId);
  }
  if (f.memorySpaceId !== void 0) {
    if (typeof f.memorySpaceId !== "string") {
      throw new SessionValidationError(
        "memorySpaceId must be a string",
        "INVALID_MEMORY_SPACE_ID",
        "memorySpaceId"
      );
    }
  }
  if (f.status !== void 0) {
    validateStatus2(f.status);
  }
  if (f.limit !== void 0) {
    if (typeof f.limit !== "number" || f.limit < 1 || f.limit > 1e3) {
      throw new SessionValidationError(
        "limit must be a number between 1 and 1000",
        "INVALID_LIMIT",
        "limit"
      );
    }
  }
  if (f.offset !== void 0) {
    if (typeof f.offset !== "number" || f.offset < 0) {
      throw new SessionValidationError(
        "offset must be a non-negative number",
        "INVALID_OFFSET",
        "offset"
      );
    }
  }
}

// src/sessions/index.ts
var SessionCapabilityError = class extends Error {
  code = "BACKEND_MAINTENANCE_ONLY";
  retryable = false;
  outcome = "not_dispatched";
  requiredExecution = "trusted_backend_worker";
  constructor() {
    super(
      "Idle session expiration requires a trusted backend worker. No operation was dispatched by this client."
    );
    this.name = "SessionCapabilityError";
  }
};
var SessionsAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Create a new session for a user.
   *
   * @param params - Session creation parameters
   * @returns Created session
   *
   * @example
   * ```typescript
   * const session = await cortex.sessions.create({
   *   userId: 'user-123',
   *   tenantId: 'tenant-456',
   *   memorySpaceId: 'workspace-abc',
   *   metadata: {
   *     device: 'Chrome on macOS',
   *     browser: 'Chrome 120',
   *     ip: '192.168.1.1',
   *     location: 'San Francisco, CA',
   *   },
   * });
   * ```
   */
  async create(params) {
    validateCreateSessionParams(params);
    const now = Date.now();
    const sessionId = params.sessionId || this.generateSessionId();
    const session = await this.executeWithResilience(
      () => this.client.mutation(api.sessions.create, {
        sessionId,
        userId: params.userId,
        tenantId: resolveTenantId(this.authContext?.tenantId, params.tenantId),
        // Fall back to auth context
        memorySpaceId: params.memorySpaceId,
        metadata: params.metadata,
        startedAt: now,
        expiresAt: params.expiresAt
      }),
      "sessions:create"
    );
    return session;
  }
  /**
   * Get a session by ID.
   *
   * @param sessionId - Session ID to retrieve
   * @returns Session or null if not found
   *
   * @example
   * ```typescript
   * const session = await cortex.sessions.get('sess-123');
   * if (session && session.status === 'active') {
   *   console.log('Session is active');
   * }
   * ```
   */
  async get(sessionId) {
    validateSessionId2(sessionId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.sessions.get, {
        sessionId
      }),
      "sessions:get"
    );
    const session = result;
    if (session && session.tenantId && this.authContext?.tenantId) {
      if (session.tenantId !== this.authContext.tenantId) {
        return null;
      }
    }
    return session;
  }
  /**
   * Get or create a session for a user.
   *
   * If the user has an active session, returns it.
   * Otherwise, creates a new session.
   *
   * @param userId - User ID
   * @param metadata - Optional session metadata
   * @returns Session (existing or newly created)
   *
   * @example
   * ```typescript
   * const session = await cortex.sessions.getOrCreate('user-123', {
   *   device: 'Mobile Safari',
   * });
   * ```
   */
  async getOrCreate(userId, metadata) {
    validateUserId6(userId);
    const active = await this.getActive(userId);
    if (active.length > 0) {
      return active[0];
    }
    return this.create({
      userId,
      metadata
    });
  }
  /**
   * Update session activity timestamp (touch).
   *
   * @param sessionId - Session ID to touch
   *
   * @example
   * ```typescript
   * // Keep session alive during user activity
   * await cortex.sessions.touch('sess-123');
   * ```
   */
  async touch(sessionId) {
    validateSessionId2(sessionId);
    await this.executeWithResilience(
      () => this.client.mutation(api.sessions.touch, {
        sessionId
      }),
      "sessions:touch"
    );
  }
  /**
   * End a session.
   *
   * @param sessionId - Session ID to end
   *
   * @example
   * ```typescript
   * // End session on logout
   * await cortex.sessions.end('sess-123');
   * ```
   */
  async end(sessionId) {
    validateSessionId2(sessionId);
    if (this.authContext?.tenantId) {
      const session = await this.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
    }
    await this.executeWithResilience(
      () => this.client.mutation(api.sessions.end, {
        sessionId
      }),
      "sessions:end"
    );
  }
  /**
   * End all sessions for a user.
   *
   * @param userId - User ID
   * @param options - Optional parameters including tenantId for multi-tenant isolation
   * @returns Result with count of ended sessions
   *
   * @example
   * ```typescript
   * // End all sessions on password change
   * const result = await cortex.sessions.endAll('user-123');
   * console.log(`Ended ${result.ended} sessions`);
   *
   * // End sessions only for a specific tenant (multi-tenant safe)
   * const tenantResult = await cortex.sessions.endAll('admin', {
   *   tenantId: 'tenant-456',
   * });
   * ```
   */
  async endAll(userId, options) {
    validateUserId6(userId);
    const tenantId = resolveTenantId(this.authContext?.tenantId, options?.tenantId);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.sessions.endAll, {
        userId,
        tenantId
      }),
      "sessions:endAll"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Query Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * List sessions with filters.
   *
   * @param filters - Filter parameters
   * @returns Array of matching sessions
   *
   * @example
   * ```typescript
   * // List all active sessions for a tenant
   * const sessions = await cortex.sessions.list({
   *   tenantId: 'tenant-456',
   *   status: 'active',
   * });
   * ```
   */
  async list(filters) {
    validateSessionFilters(filters);
    const effectiveTenantId = this.authContext?.tenantId ?? filters.tenantId;
    const result = await this.executeWithResilience(
      () => this.client.query(api.sessions.list, {
        userId: filters.userId,
        tenantId: effectiveTenantId,
        memorySpaceId: filters.memorySpaceId,
        status: filters.status,
        limit: filters.limit,
        offset: filters.offset
      }),
      "sessions:list"
    );
    return result;
  }
  /**
   * Count sessions with filters.
   *
   * @param filters - Filter parameters
   * @returns Count of matching sessions
   *
   * @example
   * ```typescript
   * const activeCount = await cortex.sessions.count({
   *   tenantId: 'tenant-456',
   *   status: 'active',
   * });
   * ```
   */
  async count(filters) {
    validateSessionFilters(filters);
    const effectiveTenantId = this.authContext?.tenantId ?? filters.tenantId;
    const result = await this.executeWithResilience(
      () => this.client.query(api.sessions.count, {
        userId: filters.userId,
        tenantId: effectiveTenantId,
        memorySpaceId: filters.memorySpaceId,
        status: filters.status
      }),
      "sessions:count"
    );
    return result;
  }
  /**
   * Get active sessions for a user.
   *
   * @param userId - User ID
   * @returns Array of active sessions
   *
   * @example
   * ```typescript
   * const active = await cortex.sessions.getActive('user-123');
   * console.log(`User has ${active.length} active sessions`);
   * ```
   */
  async getActive(userId) {
    validateUserId6(userId);
    return this.list({
      userId,
      status: "active"
    });
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Maintenance Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Request idle session expiration, which requires a trusted backend worker.
   *
   * Valid client requests reject with SessionCapabilityError before dispatch.
   * This method does not perform or schedule automatic session maintenance.
   * Tenant selectors retain the existing SDK auth-context mismatch validation.
   *
   * @param options - Expiration options (idle timeout defaults to 30 minutes)
   * @throws SessionCapabilityError when trusted backend execution is required
   */
  async expireIdle(options) {
    resolveTenantId(this.authContext?.tenantId, options?.tenantId);
    const idleTimeout = options?.idleTimeout ?? 30 * 60 * 1e3;
    void idleTimeout;
    throw new SessionCapabilityError();
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Generate a cryptographically secure unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Array.from(
      globalThis.crypto.getRandomValues(new Uint8Array(8)),
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");
    return `sess-${timestamp}-${randomPart}`;
  }
};

// src/assets/errors.ts
var AssetCapabilityUnavailableError = class extends Error {
  version = 1;
  code = "CAPABILITY_UNAVAILABLE";
  retryable = false;
  outcome = "not_dispatched";
  constructor() {
    super("Authenticated asset upload and delivery are unavailable in this SDK deployment.");
    this.name = "AssetCapabilityUnavailableError";
  }
};

// src/artifacts/index.ts
init_api();

// src/artifacts/validators.ts
var ArtifactValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "ArtifactValidationError";
  }
};
var ARTIFACT_ID_MAX_LENGTH = 100;
var TITLE_MAX_LENGTH = 500;
var CONTENT_MAX_SIZE = 10 * 1024 * 1024;
var MAX_TAGS = 50;
var TAG_MAX_LENGTH = 100;
var MAX_LIMIT3 = 1e3;
var ARTIFACT_ID_PATTERN = /^[a-zA-Z0-9-_.:]+$/;
var TAG_PATTERN = /^[a-zA-Z0-9-_.:]+$/;
var VALID_KINDS = [
  "text",
  "code",
  "sheet",
  "image",
  "diagram",
  "html",
  "custom"
];
var VALID_STREAMING_STATES = [
  "draft",
  "streaming",
  "paused",
  "final",
  "error"
];
var VALID_SORT_BY3 = ["createdAt", "updatedAt", "title", "accessCount"];
var VALID_SORT_ORDER4 = ["asc", "desc"];
var VALID_TAG_MATCH2 = ["any", "all"];
function validateArtifactId(artifactId, fieldName = "artifactId") {
  if (artifactId === null || artifactId === void 0) {
    throw new ArtifactValidationError(
      `${fieldName} is required`,
      "MISSING_ARTIFACT_ID",
      fieldName
    );
  }
  if (typeof artifactId !== "string") {
    throw new ArtifactValidationError(
      `${fieldName} must be a string, got ${typeof artifactId}`,
      "INVALID_ARTIFACT_ID",
      fieldName
    );
  }
  if (artifactId.trim().length === 0) {
    throw new ArtifactValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_ARTIFACT_ID",
      fieldName
    );
  }
}
function validateArtifactIdFormat(artifactId) {
  if (artifactId.length > ARTIFACT_ID_MAX_LENGTH) {
    throw new ArtifactValidationError(
      `artifactId exceeds maximum length of ${ARTIFACT_ID_MAX_LENGTH} characters (got ${artifactId.length})`,
      "ARTIFACT_ID_TOO_LONG",
      "artifactId"
    );
  }
  if (!ARTIFACT_ID_PATTERN.test(artifactId)) {
    throw new ArtifactValidationError(
      `Invalid artifactId format "${artifactId}". Must contain only alphanumeric characters, hyphens, underscores, dots, and colons`,
      "INVALID_ARTIFACT_ID",
      "artifactId"
    );
  }
}
function validateTitle(title) {
  if (title === null || title === void 0) {
    throw new ArtifactValidationError(
      "title is required",
      "MISSING_TITLE",
      "title"
    );
  }
  if (typeof title !== "string") {
    throw new ArtifactValidationError(
      `title must be a string, got ${typeof title}`,
      "INVALID_TITLE",
      "title"
    );
  }
  if (title.trim().length === 0) {
    throw new ArtifactValidationError(
      "title is required and cannot be empty",
      "MISSING_TITLE",
      "title"
    );
  }
}
function validateTitleLength(title) {
  if (title.length > TITLE_MAX_LENGTH) {
    throw new ArtifactValidationError(
      `title exceeds maximum length of ${TITLE_MAX_LENGTH} characters (got ${title.length})`,
      "TITLE_TOO_LONG",
      "title"
    );
  }
}
function validateContent2(content) {
  if (content === void 0) {
    throw new ArtifactValidationError(
      "content is required",
      "MISSING_CONTENT",
      "content"
    );
  }
  if (typeof content !== "string") {
    throw new ArtifactValidationError(
      `content must be a string, got ${typeof content}`,
      "INVALID_CONTENT",
      "content"
    );
  }
}
function validateContentSize(content) {
  const sizeInBytes = new Blob([content]).size;
  if (sizeInBytes > CONTENT_MAX_SIZE) {
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    throw new ArtifactValidationError(
      `content exceeds maximum size of 10MB (got ${sizeInMB}MB)`,
      "CONTENT_TOO_LARGE",
      "content"
    );
  }
}
function validateMemorySpaceId5(memorySpaceId) {
  if (memorySpaceId === null || memorySpaceId === void 0) {
    throw new ArtifactValidationError(
      "memorySpaceId is required",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId"
    );
  }
  if (typeof memorySpaceId !== "string") {
    throw new ArtifactValidationError(
      `memorySpaceId must be a string, got ${typeof memorySpaceId}`,
      "INVALID_MEMORY_SPACE_ID",
      "memorySpaceId"
    );
  }
  if (memorySpaceId.trim().length === 0) {
    throw new ArtifactValidationError(
      "memorySpaceId is required and cannot be empty",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId"
    );
  }
}
function validateKind(kind) {
  if (kind === null || kind === void 0) {
    return;
  }
  if (typeof kind !== "string") {
    throw new ArtifactValidationError(
      `kind must be a string, got ${typeof kind}`,
      "INVALID_KIND_TYPE",
      "kind"
    );
  }
  if (!VALID_KINDS.includes(kind)) {
    throw new ArtifactValidationError(
      `kind must be one of: ${VALID_KINDS.join(", ")}. Got "${kind}"`,
      "INVALID_KIND_VALUE",
      "kind"
    );
  }
}
function validateStreamingState(streamingState) {
  if (streamingState === null || streamingState === void 0) {
    return;
  }
  if (typeof streamingState !== "string") {
    throw new ArtifactValidationError(
      `streamingState must be a string, got ${typeof streamingState}`,
      "INVALID_STREAMING_STATE_TYPE",
      "streamingState"
    );
  }
  if (!VALID_STREAMING_STATES.includes(streamingState)) {
    throw new ArtifactValidationError(
      `streamingState must be one of: ${VALID_STREAMING_STATES.join(", ")}. Got "${streamingState}"`,
      "INVALID_STREAMING_STATE_VALUE",
      "streamingState"
    );
  }
}
function validateTags3(tags) {
  if (tags === null || tags === void 0) {
    return;
  }
  if (!Array.isArray(tags)) {
    throw new ArtifactValidationError(
      `tags must be an array, got ${typeof tags}`,
      "INVALID_TAGS_TYPE",
      "tags"
    );
  }
  if (tags.length > MAX_TAGS) {
    throw new ArtifactValidationError(
      `tags array exceeds maximum of ${MAX_TAGS} items (got ${tags.length})`,
      "TOO_MANY_TAGS",
      "tags"
    );
  }
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof tag !== "string") {
      throw new ArtifactValidationError(
        `tags[${i}] must be a string, got ${typeof tag}`,
        "INVALID_TAG_TYPE",
        `tags[${i}]`
      );
    }
    if (tag.length > TAG_MAX_LENGTH) {
      throw new ArtifactValidationError(
        `tags[${i}] exceeds maximum length of ${TAG_MAX_LENGTH} characters`,
        "TAG_TOO_LONG",
        `tags[${i}]`
      );
    }
    if (!TAG_PATTERN.test(tag)) {
      throw new ArtifactValidationError(
        `tags[${i}] contains invalid characters. Must contain only alphanumeric characters, hyphens, underscores, dots, and colons`,
        "INVALID_TAG_FORMAT",
        `tags[${i}]`
      );
    }
  }
}
function validateLimit9(limit) {
  if (limit === null || limit === void 0) {
    return;
  }
  if (typeof limit !== "number") {
    throw new ArtifactValidationError(
      `limit must be a number, got ${typeof limit}`,
      "INVALID_LIMIT_TYPE",
      "limit"
    );
  }
  if (!Number.isInteger(limit)) {
    throw new ArtifactValidationError(
      `limit must be an integer, got ${limit}`,
      "INVALID_LIMIT_TYPE",
      "limit"
    );
  }
  if (limit < 1) {
    throw new ArtifactValidationError(
      `limit must be at least 1, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit"
    );
  }
  if (limit > MAX_LIMIT3) {
    throw new ArtifactValidationError(
      `limit exceeds maximum of ${MAX_LIMIT3}, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit"
    );
  }
}
function validateOffset4(offset) {
  if (offset === null || offset === void 0) {
    return;
  }
  if (typeof offset !== "number") {
    throw new ArtifactValidationError(
      `offset must be a number, got ${typeof offset}`,
      "INVALID_OFFSET_TYPE",
      "offset"
    );
  }
  if (!Number.isInteger(offset)) {
    throw new ArtifactValidationError(
      `offset must be an integer, got ${offset}`,
      "INVALID_OFFSET_TYPE",
      "offset"
    );
  }
  if (offset < 0) {
    throw new ArtifactValidationError(
      `offset must be non-negative, got ${offset}`,
      "INVALID_OFFSET_RANGE",
      "offset"
    );
  }
}
function validateTimestamp7(timestamp, fieldName) {
  if (timestamp === null || timestamp === void 0) {
    return;
  }
  if (typeof timestamp !== "number") {
    throw new ArtifactValidationError(
      `${fieldName} must be a number, got ${typeof timestamp}`,
      "INVALID_TIMESTAMP_TYPE",
      fieldName
    );
  }
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new ArtifactValidationError(
      `${fieldName} must be a valid Unix timestamp (positive number), got ${timestamp}`,
      "INVALID_TIMESTAMP_VALUE",
      fieldName
    );
  }
}
function validateVersion5(version) {
  if (version === null || version === void 0) {
    throw new ArtifactValidationError(
      "version is required",
      "MISSING_VERSION",
      "version"
    );
  }
  if (typeof version !== "number") {
    throw new ArtifactValidationError(
      `version must be a number, got ${typeof version}`,
      "INVALID_VERSION_TYPE",
      "version"
    );
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new ArtifactValidationError(
      `version must be a positive integer, got ${version}`,
      "INVALID_VERSION",
      "version"
    );
  }
}
function validateSortBy3(sortBy) {
  if (sortBy === null || sortBy === void 0) {
    return;
  }
  if (typeof sortBy !== "string") {
    throw new ArtifactValidationError(
      `sortBy must be a string, got ${typeof sortBy}`,
      "INVALID_SORT_BY_TYPE",
      "sortBy"
    );
  }
  if (!VALID_SORT_BY3.includes(sortBy)) {
    throw new ArtifactValidationError(
      `sortBy must be one of: ${VALID_SORT_BY3.join(", ")}. Got "${sortBy}"`,
      "INVALID_SORT_BY_VALUE",
      "sortBy"
    );
  }
}
function validateSortOrder4(sortOrder) {
  if (sortOrder === null || sortOrder === void 0) {
    return;
  }
  if (typeof sortOrder !== "string") {
    throw new ArtifactValidationError(
      `sortOrder must be a string, got ${typeof sortOrder}`,
      "INVALID_SORT_ORDER_TYPE",
      "sortOrder"
    );
  }
  if (!VALID_SORT_ORDER4.includes(sortOrder)) {
    throw new ArtifactValidationError(
      `sortOrder must be one of: ${VALID_SORT_ORDER4.join(", ")}. Got "${sortOrder}"`,
      "INVALID_SORT_ORDER_VALUE",
      "sortOrder"
    );
  }
}
function validateTagMatch2(tagMatch) {
  if (tagMatch === null || tagMatch === void 0) {
    return;
  }
  if (typeof tagMatch !== "string") {
    throw new ArtifactValidationError(
      `tagMatch must be a string, got ${typeof tagMatch}`,
      "INVALID_TAG_MATCH_TYPE",
      "tagMatch"
    );
  }
  if (!VALID_TAG_MATCH2.includes(tagMatch)) {
    throw new ArtifactValidationError(
      `tagMatch must be one of: ${VALID_TAG_MATCH2.join(", ")}. Got "${tagMatch}"`,
      "INVALID_TAG_MATCH_VALUE",
      "tagMatch"
    );
  }
}
function validateSessionId3(sessionId) {
  if (sessionId === null || sessionId === void 0) {
    throw new ArtifactValidationError(
      "sessionId is required",
      "MISSING_SESSION_ID",
      "sessionId"
    );
  }
  if (typeof sessionId !== "string") {
    throw new ArtifactValidationError(
      `sessionId must be a string, got ${typeof sessionId}`,
      "INVALID_SESSION_ID",
      "sessionId"
    );
  }
  if (sessionId.trim().length === 0) {
    throw new ArtifactValidationError(
      "sessionId cannot be empty",
      "INVALID_SESSION_ID",
      "sessionId"
    );
  }
}
function validateCreateOptions(options) {
  if (options === null || options === void 0) {
    throw new ArtifactValidationError(
      "options is required",
      "MISSING_OPTIONS",
      "options"
    );
  }
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactValidationError(
      `options must be an object, got ${typeof options}`,
      "INVALID_OPTIONS",
      "options"
    );
  }
  const opts = options;
  validateMemorySpaceId5(opts.memorySpaceId);
  validateTitle(opts.title);
  validateTitleLength(opts.title);
  validateContent2(opts.content);
  validateContentSize(opts.content);
  validateKind(opts.kind);
  validateStreamingState(opts.streamingState);
  validateTags3(opts.tags);
  if (opts.artifactId !== void 0) {
    validateArtifactId(opts.artifactId);
    validateArtifactIdFormat(opts.artifactId);
  }
}
function validateUpdateOptions2(options) {
  if (options === null || options === void 0) {
    return;
  }
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactValidationError(
      `options must be an object, got ${typeof options}`,
      "INVALID_OPTIONS",
      "options"
    );
  }
  const opts = options;
  if (opts.title !== void 0) {
    validateTitle(opts.title);
    validateTitleLength(opts.title);
  }
  validateKind(opts.kind);
  validateTags3(opts.tags);
}
function validateListFilter4(filter) {
  if (filter === null || filter === void 0) {
    throw new ArtifactValidationError(
      "filter is required",
      "MISSING_FILTER",
      "filter"
    );
  }
  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new ArtifactValidationError(
      `filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter"
    );
  }
  const f = filter;
  validateMemorySpaceId5(f.memorySpaceId);
  validateKind(f.kind);
  validateStreamingState(f.streamingState);
  validateTags3(f.tags);
  validateTagMatch2(f.tagMatch);
  validateLimit9(f.limit);
  validateOffset4(f.offset);
  validateSortBy3(f.sortBy);
  validateSortOrder4(f.sortOrder);
  validateTimestamp7(f.createdAfter, "createdAfter");
  validateTimestamp7(f.createdBefore, "createdBefore");
  validateTimestamp7(f.updatedAfter, "updatedAfter");
  validateTimestamp7(f.updatedBefore, "updatedBefore");
}
function validateCountFilter4(filter) {
  if (filter === null || filter === void 0) {
    throw new ArtifactValidationError(
      "filter is required",
      "MISSING_FILTER",
      "filter"
    );
  }
  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new ArtifactValidationError(
      `filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter"
    );
  }
  const f = filter;
  validateMemorySpaceId5(f.memorySpaceId);
  validateKind(f.kind);
  validateStreamingState(f.streamingState);
  validateTags3(f.tags);
  validateTagMatch2(f.tagMatch);
}
function validateHistoryOptions(options) {
  if (options === null || options === void 0) {
    return;
  }
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new ArtifactValidationError(
      `options must be an object, got ${typeof options}`,
      "INVALID_OPTIONS",
      "options"
    );
  }
  const opts = options;
  validateLimit9(opts.limit);
  if (opts.fromVersion !== void 0) {
    if (typeof opts.fromVersion !== "number" || !Number.isInteger(opts.fromVersion) || opts.fromVersion < 1) {
      throw new ArtifactValidationError(
        "fromVersion must be a positive integer",
        "INVALID_FROM_VERSION",
        "fromVersion"
      );
    }
  }
  if (opts.toVersion !== void 0) {
    if (typeof opts.toVersion !== "number" || !Number.isInteger(opts.toVersion) || opts.toVersion < 1) {
      throw new ArtifactValidationError(
        "toVersion must be a positive integer",
        "INVALID_TO_VERSION",
        "toVersion"
      );
    }
  }
}
function validateStartStreamingParams(params) {
  if (params === null || params === void 0) {
    throw new ArtifactValidationError(
      "params is required",
      "MISSING_PARAMS",
      "params"
    );
  }
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new ArtifactValidationError(
      `params must be an object, got ${typeof params}`,
      "INVALID_PARAMS",
      "params"
    );
  }
  const p = params;
  validateArtifactId(p.artifactId);
  validateArtifactIdFormat(p.artifactId);
}
function validateAppendContentParams(params) {
  if (params === null || params === void 0) {
    throw new ArtifactValidationError(
      "params is required",
      "MISSING_PARAMS",
      "params"
    );
  }
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new ArtifactValidationError(
      `params must be an object, got ${typeof params}`,
      "INVALID_PARAMS",
      "params"
    );
  }
  const p = params;
  validateArtifactId(p.artifactId);
  validateArtifactIdFormat(p.artifactId);
  validateSessionId3(p.sessionId);
  if (p.chunk === void 0 || typeof p.chunk !== "string") {
    throw new ArtifactValidationError(
      "chunk is required and must be a string",
      "INVALID_CHUNK",
      "chunk"
    );
  }
}

// src/artifacts/index.ts
var ArtifactsAPI = class {
  constructor(client, graphAdapter, resilience, authContext) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  /**
   * Sync artifact to graph database (if configured)
   */
  async syncToGraph(artifact) {
    if (!this.graphAdapter) return;
    try {
      await this.graphAdapter.createNode({
        label: "Artifact",
        properties: {
          artifactId: artifact.artifactId,
          title: artifact.title,
          kind: artifact.kind,
          streamingState: artifact.streamingState,
          version: artifact.version,
          memorySpaceId: artifact.memorySpaceId,
          userId: artifact.userId,
          agentId: artifact.agentId,
          createdAt: artifact.createdAt,
          updatedAt: artifact.updatedAt
        }
      });
      if (artifact.conversationRef?.conversationId) {
        await this.graphAdapter.createEdge({
          from: artifact.artifactId,
          to: artifact.conversationRef.conversationId,
          type: "DERIVED_FROM"
        });
      }
      if (artifact.memoryRefs && artifact.memoryRefs.length > 0) {
        for (const memRef of artifact.memoryRefs) {
          await this.graphAdapter.createEdge({
            from: artifact.artifactId,
            to: memRef.memoryId,
            type: "DERIVED_FROM",
            properties: { relevance: memRef.relevance }
          });
        }
      }
    } catch (error) {
      console.warn("Failed to sync artifact to graph:", error);
    }
  }
  /**
   * Update artifact in graph database
   */
  async updateInGraph(artifactId, properties) {
    if (!this.graphAdapter) return;
    try {
      await this.graphAdapter.updateNode(artifactId, properties);
    } catch (error) {
      console.warn("Failed to update artifact in graph:", error);
    }
  }
  /**
   * Delete artifact from graph database
   */
  async deleteFromGraph(artifactId) {
    if (!this.graphAdapter) return;
    try {
      await this.graphAdapter.deleteNode(artifactId, true);
    } catch (error) {
      console.warn("Failed to delete artifact from graph:", error);
    }
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core CRUD Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Create a new artifact
   *
   * @example
   * ```typescript
   * const artifact = await cortex.artifacts.create({
   *   memorySpaceId: 'user-123-space',
   *   title: 'Code Snippet',
   *   content: 'function hello() { return "world"; }',
   *   kind: 'code',
   *   tags: ['javascript', 'function'],
   * });
   * console.log(artifact.artifactId); // "art-abc123def456"
   * ```
   */
  async create(options) {
    validateCreateOptions(options);
    const result = await this.executeWithResilience(
      () => this.client.mutation(api.artifacts.create, {
        memorySpaceId: options.memorySpaceId,
        title: options.title,
        content: options.content,
        kind: options.kind ?? "text",
        streamingState: options.streamingState ?? "draft",
        artifactId: options.artifactId,
        tenantId: resolveTenantId(this.authContext?.tenantId, options.tenantId),
        userId: options.userId,
        participantId: options.participantId,
        description: options.description,
        metadata: options.metadata,
        tags: options.tags ?? [],
        conversationRef: options.conversationRef,
        language: options.kindConfig?.language,
        mimeType: options.kindConfig?.mimeType
      }),
      "artifacts:create"
    );
    const artifact = result;
    await this.syncToGraph(artifact);
    return artifact;
  }
  /**
   * Get an artifact by ID
   *
   * @example
   * ```typescript
   * const artifact = await cortex.artifacts.get('art-abc123def456');
   * if (artifact) {
   *   console.log(artifact.title, artifact.content);
   * }
   * ```
   */
  async get(artifactId) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.artifacts.get, {
        artifactId,
        tenantId: this.authContext?.tenantId
      }),
      "artifacts:get"
    );
    return result;
  }
  /**
   * Update an artifact's content (creates a new version)
   *
   * @example
   * ```typescript
   * const updated = await cortex.artifacts.update(
   *   'art-abc123def456',
   *   'function hello() { return "updated world"; }',
   *   { changeSummary: 'Fixed return value' }
   * );
   * console.log(updated.version); // 2
   * ```
   */
  async update(artifactId, content, options) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    validateContent2(content);
    validateContentSize(content);
    if (options) {
      validateUpdateOptions2(options);
    }
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.update, {
          artifactId,
          content,
          tenantId: this.authContext?.tenantId,
          title: options?.title,
          metadata: options?.metadata,
          tags: options?.tags,
          changeSummary: options?.changeSummary
        }),
        "artifacts:update"
      );
      const artifact = result;
      await this.updateInGraph(artifactId, {
        version: artifact.version,
        updatedAt: artifact.updatedAt
      });
      return artifact;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Delete an artifact
   *
   * @param artifactId - The artifact ID to delete
   * @param hard - If true, permanently deletes. If false (default), soft deletes.
   *
   * @example
   * ```typescript
   * const result = await cortex.artifacts.delete('art-abc123def456');
   * console.log(result.deleted); // true
   * ```
   */
  async delete(artifactId, hard = false) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.deleteArtifact, {
          artifactId,
          tenantId: this.authContext?.tenantId,
          hard
        }),
        "artifacts:delete"
      );
      if (hard) {
        await this.deleteFromGraph(artifactId);
      } else {
        await this.updateInGraph(artifactId, { isDeleted: true });
      }
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * List artifacts with filtering
   *
   * @example
   * ```typescript
   * const artifacts = await cortex.artifacts.list({
   *   memorySpaceId: 'user-123-space',
   *   streamingState: 'final',
   *   tags: ['important'],
   *   sortBy: 'updatedAt',
   *   sortOrder: 'desc',
   *   limit: 20,
   * });
   * ```
   */
  async list(filter) {
    validateListFilter4(filter);
    const result = await this.executeWithResilience(
      () => this.client.query(api.artifacts.list, {
        memorySpaceId: filter.memorySpaceId,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter.tenantId),
        userId: filter.userId,
        participantId: filter.participantId,
        kind: filter.kind,
        streamingState: filter.streamingState,
        tags: filter.tags,
        createdAfter: filter.createdAfter,
        createdBefore: filter.createdBefore,
        updatedAfter: filter.updatedAfter,
        updatedBefore: filter.updatedBefore,
        limit: filter.limit,
        offset: filter.offset,
        sortBy: filter.sortBy,
        sortOrder: filter.sortOrder,
        includeDeleted: filter.includeDeleted
      }),
      "artifacts:list"
    );
    const listResult = result;
    return listResult.artifacts;
  }
  /**
   * Count artifacts matching filter
   *
   * @example
   * ```typescript
   * const count = await cortex.artifacts.count({
   *   memorySpaceId: 'user-123-space',
   *   streamingState: 'final',
   * });
   * console.log(`${count} finalized artifacts`);
   * ```
   */
  async count(filter) {
    validateCountFilter4(filter);
    const result = await this.executeWithResilience(
      () => this.client.query(api.artifacts.count, {
        memorySpaceId: filter.memorySpaceId,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter.tenantId),
        userId: filter.userId,
        kind: filter.kind,
        streamingState: filter.streamingState,
        includeDeleted: filter.includeDeleted,
        createdAfter: filter.createdAfter,
        createdBefore: filter.createdBefore
      }),
      "artifacts:count"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Undo/Redo Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Undo the last change to an artifact
   *
   * Restores the artifact to its previous version using the version pointer.
   * Does not delete version history - moves the pointer backward.
   *
   * @example
   * ```typescript
   * // Make changes
   * await cortex.artifacts.update('art-abc123', 'version 2 content');
   * await cortex.artifacts.update('art-abc123', 'version 3 content');
   *
   * // Undo to version 2
   * const undone = await cortex.artifacts.undo('art-abc123');
   * console.log(undone.content); // "version 2 content"
   * ```
   *
   * @throws Error if no previous version exists (UNDO_NOT_AVAILABLE)
   */
  async undo(artifactId) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.undo, {
          artifactId,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:undo"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Redo a previously undone change
   *
   * Restores the artifact to a more recent version after undo.
   * Moves the version pointer forward.
   *
   * @example
   * ```typescript
   * // After undoing
   * await cortex.artifacts.undo('art-abc123');
   *
   * // Redo to restore
   * const redone = await cortex.artifacts.redo('art-abc123');
   * console.log(redone.content); // Back to latest version content
   * ```
   *
   * @throws Error if no newer version exists (REDO_NOT_AVAILABLE)
   */
  async redo(artifactId) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.redo, {
          artifactId,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:redo"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Get the version history of an artifact
   *
   * @example
   * ```typescript
   * const history = await cortex.artifacts.getHistory('art-abc123');
   * for (const version of history) {
   *   console.log(`v${version.version}: ${version.changeSummary || 'No note'}`);
   * }
   * ```
   */
  async getHistory(artifactId, options) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    if (options) {
      validateHistoryOptions(options);
    }
    const result = await this.executeWithResilience(
      () => this.client.query(api.artifacts.getHistory, {
        artifactId,
        tenantId: this.authContext?.tenantId,
        limit: options?.limit,
        offset: options?.offset,
        sortOrder: options?.sortOrder
      }),
      "artifacts:getHistory"
    );
    const historyResult = result;
    return historyResult?.history ?? [];
  }
  /**
   * Get a specific version of an artifact
   *
   * @example
   * ```typescript
   * const v2 = await cortex.artifacts.getVersion('art-abc123', 2);
   * console.log(v2.content);
   * ```
   */
  async getVersion(artifactId, version) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    validateVersion5(version);
    const result = await this.executeWithResilience(
      () => this.client.query(api.artifacts.getVersion, {
        artifactId,
        version,
        tenantId: this.authContext?.tenantId
      }),
      "artifacts:getVersion"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Start a streaming session for an artifact
   *
   * Transitions the artifact to "streaming" state and returns a session ID
   * for appending content chunks.
   *
   * @example
   * ```typescript
   * const { sessionId, artifact } = await cortex.artifacts.startStreaming({
   *   artifactId: 'art-abc123',
   * });
   *
   * // Now append content chunks...
   * await cortex.artifacts.appendContent({
   *   artifactId: 'art-abc123',
   *   sessionId,
   *   chunk: 'First chunk of content...',
   * });
   * ```
   */
  async startStreaming(params) {
    validateStartStreamingParams(params);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.startStreaming, {
          artifactId: params.artifactId,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:startStreaming"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Append a content chunk to a streaming artifact
   *
   * @example
   * ```typescript
   * await cortex.artifacts.appendContent({
   *   artifactId: 'art-abc123',
   *   sessionId: 'session-xyz',
   *   chunk: 'More content...',
   * });
   * ```
   */
  async appendContent(params) {
    validateAppendContentParams(params);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.appendContent, {
          artifactId: params.artifactId,
          sessionId: params.sessionId,
          chunk: params.chunk,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:appendContent"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Pause an active streaming session
   *
   * Transitions the artifact to "paused" state. Can be resumed later.
   */
  async pauseStreaming(params) {
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId3(params.sessionId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.pauseStreaming, {
          artifactId: params.artifactId,
          sessionId: params.sessionId,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:pauseStreaming"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Resume a paused streaming session
   *
   * Transitions the artifact back to "streaming" state.
   */
  async resumeStreaming(params) {
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId3(params.sessionId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.resumeStreaming, {
          artifactId: params.artifactId,
          sessionId: params.sessionId,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:resumeStreaming"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Cancel an active streaming session
   *
   * Transitions the artifact to "draft" state and discards streaming progress.
   */
  async cancelStreaming(params) {
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId3(params.sessionId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.cancelStreaming, {
          artifactId: params.artifactId,
          sessionId: params.sessionId,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:cancelStreaming"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Finalize a streaming session
   *
   * Completes streaming and transitions the artifact to "final" state.
   * Creates a new version in the history.
   *
   * @example
   * ```typescript
   * const final = await cortex.artifacts.finalizeStreaming({
   *   artifactId: 'art-abc123',
   *   sessionId: 'session-xyz',
   *   changeSummary: 'AI-generated code completion',
   * });
   * console.log(final.streamingState); // "final"
   * ```
   */
  async finalizeStreaming(params) {
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId3(params.sessionId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.finalizeStreaming, {
          artifactId: params.artifactId,
          sessionId: params.sessionId,
          changeSummary: params.changeSummary,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:finalizeStreaming"
      );
      const finalizeResult = result;
      await this.updateInGraph(params.artifactId, {
        streamingState: "final",
        version: finalizeResult.version,
        updatedAt: finalizeResult.finalizedAt
      });
      return finalizeResult;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Status Management
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Set the streaming state of an artifact
   *
   * Directly sets the streaming state. Use with caution - prefer the
   * streaming methods (startStreaming, finalizeStreaming) for proper
   * state transitions.
   *
   * @example
   * ```typescript
   * // Mark as error state
   * await cortex.artifacts.setStreamingState('art-abc123', 'error');
   * ```
   */
  async setStreamingState(artifactId, streamingState) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    validateStreamingState(streamingState);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.setStreamingState, {
          artifactId,
          streamingState,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:setStreamingState"
      );
      const stateResult = result;
      await this.updateInGraph(artifactId, { streamingState });
      return stateResult;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // File Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Asset upload and delivery require a qualified authenticated backend capability.
   * This intermediate SDK rejects with AssetCapabilityUnavailableError before
   * transport or file processing; no bearer URL or upload result is returned.
   * Future support uses bounded authenticated Convex upload and delivery.
   *
   * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
   */
  async uploadFile(params) {
    void params;
    throw new AssetCapabilityUnavailableError();
  }
  /**
   * Asset upload and delivery require a qualified authenticated backend capability.
   * This intermediate SDK rejects with AssetCapabilityUnavailableError before
   * transport or file processing; no bearer URL or upload result is returned.
   * Future support uses bounded authenticated Convex upload and delivery.
   *
   * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
   */
  async getFileUrl(artifactId) {
    void artifactId;
    throw new AssetCapabilityUnavailableError();
  }
  /**
   * Detach a file from an artifact
   *
   * Removes the file reference. The file may still exist in storage
   * depending on retention policy.
   *
   * @example
   * ```typescript
   * const artifact = await cortex.artifacts.detachFile(
   *   'art-abc123',
   *   'file-xyz789'
   * );
   * ```
   */
  async detachFile(artifactId, deleteFile = false) {
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.artifacts.detachFile, {
          artifactId,
          deleteFile,
          tenantId: this.authContext?.tenantId
        }),
        "artifacts:detachFile"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
};

// src/attachments/index.ts
init_api();

// src/attachments/validators.ts
var AttachmentValidationError = class extends Error {
  constructor(message, code, field) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "AttachmentValidationError";
  }
};
var ATTACHMENT_ID_MAX_LENGTH = 100;
var FILENAME_MAX_LENGTH = 255;
var MAX_LIMIT4 = 1e3;
var VALID_ATTACHMENT_TYPES = [
  "image",
  "audio",
  "video",
  "file",
  "pdf"
];
var VALID_SORT_BY4 = ["createdAt", "updatedAt"];
var VALID_SORT_ORDER5 = ["asc", "desc"];
function validateAttachmentId(attachmentId, fieldName = "attachmentId") {
  if (attachmentId === null || attachmentId === void 0) {
    throw new AttachmentValidationError(
      `${fieldName} is required`,
      "MISSING_ATTACHMENT_ID",
      fieldName
    );
  }
  if (typeof attachmentId !== "string") {
    throw new AttachmentValidationError(
      `${fieldName} must be a string, got ${typeof attachmentId}`,
      "INVALID_ATTACHMENT_ID",
      fieldName
    );
  }
  if (attachmentId.trim().length === 0) {
    throw new AttachmentValidationError(
      `${fieldName} is required and cannot be empty`,
      "MISSING_ATTACHMENT_ID",
      fieldName
    );
  }
  if (attachmentId.length > ATTACHMENT_ID_MAX_LENGTH) {
    throw new AttachmentValidationError(
      `${fieldName} exceeds maximum length of ${ATTACHMENT_ID_MAX_LENGTH} characters`,
      "ATTACHMENT_ID_TOO_LONG",
      fieldName
    );
  }
}
function validateStorageId(storageId) {
  if (storageId === null || storageId === void 0) {
    throw new AttachmentValidationError(
      "storageId is required",
      "MISSING_STORAGE_ID",
      "storageId"
    );
  }
  if (typeof storageId !== "string") {
    throw new AttachmentValidationError(
      `storageId must be a string, got ${typeof storageId}`,
      "INVALID_STORAGE_ID",
      "storageId"
    );
  }
  if (storageId.trim().length === 0) {
    throw new AttachmentValidationError(
      "storageId is required and cannot be empty",
      "MISSING_STORAGE_ID",
      "storageId"
    );
  }
}
function validateMemorySpaceId6(memorySpaceId) {
  if (memorySpaceId === null || memorySpaceId === void 0) {
    throw new AttachmentValidationError(
      "memorySpaceId is required",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId"
    );
  }
  if (typeof memorySpaceId !== "string") {
    throw new AttachmentValidationError(
      `memorySpaceId must be a string, got ${typeof memorySpaceId}`,
      "INVALID_MEMORY_SPACE_ID",
      "memorySpaceId"
    );
  }
  if (memorySpaceId.trim().length === 0) {
    throw new AttachmentValidationError(
      "memorySpaceId is required and cannot be empty",
      "MISSING_MEMORY_SPACE_ID",
      "memorySpaceId"
    );
  }
}
function validateUserId7(userId) {
  if (userId === null || userId === void 0) {
    throw new AttachmentValidationError(
      "userId is required",
      "MISSING_USER_ID",
      "userId"
    );
  }
  if (typeof userId !== "string") {
    throw new AttachmentValidationError(
      `userId must be a string, got ${typeof userId}`,
      "INVALID_USER_ID",
      "userId"
    );
  }
  if (userId.trim().length === 0) {
    throw new AttachmentValidationError(
      "userId is required and cannot be empty",
      "MISSING_USER_ID",
      "userId"
    );
  }
}
function validateMimeType(mimeType) {
  if (mimeType === null || mimeType === void 0) {
    throw new AttachmentValidationError(
      "mimeType is required",
      "MISSING_MIME_TYPE",
      "mimeType"
    );
  }
  if (typeof mimeType !== "string") {
    throw new AttachmentValidationError(
      `mimeType must be a string, got ${typeof mimeType}`,
      "INVALID_MIME_TYPE",
      "mimeType"
    );
  }
  if (!mimeType.includes("/")) {
    throw new AttachmentValidationError(
      "mimeType must be a valid MIME type (e.g., image/png)",
      "INVALID_MIME_TYPE",
      "mimeType"
    );
  }
}
function validateFilename(filename) {
  if (filename === null || filename === void 0) {
    throw new AttachmentValidationError(
      "filename is required",
      "MISSING_FILENAME",
      "filename"
    );
  }
  if (typeof filename !== "string") {
    throw new AttachmentValidationError(
      `filename must be a string, got ${typeof filename}`,
      "INVALID_FILENAME",
      "filename"
    );
  }
  if (filename.trim().length === 0) {
    throw new AttachmentValidationError(
      "filename is required and cannot be empty",
      "MISSING_FILENAME",
      "filename"
    );
  }
  if (filename.length > FILENAME_MAX_LENGTH) {
    throw new AttachmentValidationError(
      `filename exceeds maximum length of ${FILENAME_MAX_LENGTH} characters`,
      "FILENAME_TOO_LONG",
      "filename"
    );
  }
}
function validateFileSize(size) {
  if (size === null || size === void 0) {
    throw new AttachmentValidationError(
      "size is required",
      "MISSING_SIZE",
      "size"
    );
  }
  if (typeof size !== "number") {
    throw new AttachmentValidationError(
      `size must be a number, got ${typeof size}`,
      "INVALID_SIZE",
      "size"
    );
  }
  if (size <= 0) {
    throw new AttachmentValidationError(
      "size must be a positive number",
      "INVALID_SIZE",
      "size"
    );
  }
}
function validateAttachmentType(type) {
  if (type === null || type === void 0) {
    throw new AttachmentValidationError(
      "type is required",
      "MISSING_TYPE",
      "type"
    );
  }
  if (typeof type !== "string") {
    throw new AttachmentValidationError(
      `type must be a string, got ${typeof type}`,
      "INVALID_TYPE",
      "type"
    );
  }
  if (!VALID_ATTACHMENT_TYPES.includes(type)) {
    throw new AttachmentValidationError(
      `type must be one of: ${VALID_ATTACHMENT_TYPES.join(", ")}. Got "${type}"`,
      "INVALID_TYPE_VALUE",
      "type"
    );
  }
}
function validateOptionalAttachmentType(type) {
  if (type === null || type === void 0) {
    return;
  }
  validateAttachmentType(type);
}
function validateDimensions(dimensions) {
  if (dimensions === null || dimensions === void 0) {
    return;
  }
  if (typeof dimensions !== "object" || Array.isArray(dimensions)) {
    throw new AttachmentValidationError(
      `dimensions must be an object, got ${typeof dimensions}`,
      "INVALID_DIMENSIONS",
      "dimensions"
    );
  }
  const dim = dimensions;
  if (typeof dim.width !== "number" || dim.width <= 0) {
    throw new AttachmentValidationError(
      "dimensions.width must be a positive number",
      "INVALID_DIMENSIONS",
      "dimensions.width"
    );
  }
  if (typeof dim.height !== "number" || dim.height <= 0) {
    throw new AttachmentValidationError(
      "dimensions.height must be a positive number",
      "INVALID_DIMENSIONS",
      "dimensions.height"
    );
  }
}
function validateDuration(duration) {
  if (duration === null || duration === void 0) {
    return;
  }
  if (typeof duration !== "number") {
    throw new AttachmentValidationError(
      `duration must be a number, got ${typeof duration}`,
      "INVALID_DURATION",
      "duration"
    );
  }
  if (duration <= 0) {
    throw new AttachmentValidationError(
      "duration must be a positive number",
      "INVALID_DURATION",
      "duration"
    );
  }
}
function validateLimit10(limit) {
  if (limit === null || limit === void 0) {
    return;
  }
  if (typeof limit !== "number") {
    throw new AttachmentValidationError(
      `limit must be a number, got ${typeof limit}`,
      "INVALID_LIMIT_TYPE",
      "limit"
    );
  }
  if (!Number.isInteger(limit)) {
    throw new AttachmentValidationError(
      `limit must be an integer, got ${limit}`,
      "INVALID_LIMIT_TYPE",
      "limit"
    );
  }
  if (limit < 1) {
    throw new AttachmentValidationError(
      `limit must be at least 1, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit"
    );
  }
  if (limit > MAX_LIMIT4) {
    throw new AttachmentValidationError(
      `limit exceeds maximum of ${MAX_LIMIT4}, got ${limit}`,
      "INVALID_LIMIT_RANGE",
      "limit"
    );
  }
}
function validateSortBy4(sortBy) {
  if (sortBy === null || sortBy === void 0) {
    return;
  }
  if (typeof sortBy !== "string") {
    throw new AttachmentValidationError(
      `sortBy must be a string, got ${typeof sortBy}`,
      "INVALID_SORT_BY_TYPE",
      "sortBy"
    );
  }
  if (!VALID_SORT_BY4.includes(sortBy)) {
    throw new AttachmentValidationError(
      `sortBy must be one of: ${VALID_SORT_BY4.join(", ")}. Got "${sortBy}"`,
      "INVALID_SORT_BY_VALUE",
      "sortBy"
    );
  }
}
function validateSortOrder5(sortOrder) {
  if (sortOrder === null || sortOrder === void 0) {
    return;
  }
  if (typeof sortOrder !== "string") {
    throw new AttachmentValidationError(
      `sortOrder must be a string, got ${typeof sortOrder}`,
      "INVALID_SORT_ORDER_TYPE",
      "sortOrder"
    );
  }
  if (!VALID_SORT_ORDER5.includes(sortOrder)) {
    throw new AttachmentValidationError(
      `sortOrder must be one of: ${VALID_SORT_ORDER5.join(", ")}. Got "${sortOrder}"`,
      "INVALID_SORT_ORDER_VALUE",
      "sortOrder"
    );
  }
}
function validateAttachParams(params) {
  if (params === null || params === void 0) {
    throw new AttachmentValidationError(
      "params is required",
      "MISSING_PARAMS",
      "params"
    );
  }
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new AttachmentValidationError(
      `params must be an object, got ${typeof params}`,
      "INVALID_PARAMS",
      "params"
    );
  }
  const p = params;
  validateStorageId(p.storageId);
  validateMemorySpaceId6(p.memorySpaceId);
  validateUserId7(p.userId);
  validateAttachmentType(p.type);
  validateMimeType(p.mimeType);
  validateFilename(p.filename);
  validateFileSize(p.size);
  validateDimensions(p.dimensions);
  validateDuration(p.duration);
}
function validateListAttachmentsFilter(filter) {
  if (filter === null || filter === void 0) {
    throw new AttachmentValidationError(
      "filter is required",
      "MISSING_FILTER",
      "filter"
    );
  }
  if (typeof filter !== "object" || Array.isArray(filter)) {
    throw new AttachmentValidationError(
      `filter must be an object, got ${typeof filter}`,
      "INVALID_FILTER",
      "filter"
    );
  }
  const f = filter;
  validateMemorySpaceId6(f.memorySpaceId);
  validateOptionalAttachmentType(f.type);
  validateLimit10(f.limit);
  validateSortBy4(f.sortBy);
  validateSortOrder5(f.sortOrder);
}
function validateAttachmentIds(attachmentIds) {
  if (attachmentIds === null || attachmentIds === void 0) {
    throw new AttachmentValidationError(
      "attachmentIds is required",
      "MISSING_ATTACHMENT_IDS",
      "attachmentIds"
    );
  }
  if (!Array.isArray(attachmentIds)) {
    throw new AttachmentValidationError(
      `attachmentIds must be an array, got ${typeof attachmentIds}`,
      "INVALID_ATTACHMENT_IDS",
      "attachmentIds"
    );
  }
  for (let i = 0; i < attachmentIds.length; i++) {
    validateAttachmentId(attachmentIds[i], `attachmentIds[${i}]`);
  }
}

// src/attachments/index.ts
var AttachmentsAPI = class {
  constructor(client, resilience, authContext) {
    this.client = client;
    this.resilience = resilience;
    this.authContext = authContext;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Execute an operation through the resilience layer (if available)
   */
  async executeWithResilience(operation, operationName) {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }
  /**
   * Handle ConvexError from direct Convex calls
   */
  handleConvexError(error) {
    if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
      const convexError = error;
      const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Upload Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Asset upload and delivery require a qualified authenticated backend capability.
   * This intermediate SDK rejects with AssetCapabilityUnavailableError before
   * transport or file processing; no bearer URL or upload result is returned.
   * Future support uses bounded authenticated Convex upload and delivery.
   *
   * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
   */
  async generateUploadUrl() {
    throw new AssetCapabilityUnavailableError();
  }
  /**
   * Register an uploaded file as an attachment.
   *
   * Call this after successfully uploading a file using the URL from generateUploadUrl.
   *
   * @example
   * ```typescript
   * const attachment = await cortex.attachments.attach({
   *   storageId: 'kg2abc123...',
   *   memorySpaceId: 'my-space',
   *   userId: 'user-123',
   *   type: 'image',
   *   mimeType: 'image/png',
   *   filename: 'screenshot.png',
   *   size: 1024000,
   *   conversationId: 'conv-456',
   * });
   * console.log(attachment.attachmentId); // "attach-abc123..."
   * ```
   */
  async attach(params) {
    validateAttachParams(params);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.attachments.attach, {
          storageId: params.storageId,
          memorySpaceId: params.memorySpaceId,
          userId: params.userId,
          type: params.type,
          mimeType: params.mimeType,
          filename: params.filename,
          size: params.size,
          conversationId: params.conversationId,
          messageId: params.messageId,
          memoryId: params.memoryId,
          artifactId: params.artifactId,
          dimensions: params.dimensions,
          duration: params.duration,
          metadata: params.metadata,
          tenantId: resolveTenantId(this.authContext?.tenantId, params.tenantId)
        }),
        "attachments:attach"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Read Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Get an attachment by ID.
   *
   * @example
   * ```typescript
   * const attachment = await cortex.attachments.get('attach-abc123');
   * if (attachment) {
   *   console.log(attachment.filename, attachment.mimeType);
   * }
   * ```
   */
  async get(attachmentId) {
    validateAttachmentId(attachmentId);
    const result = await this.executeWithResilience(
      () => this.client.query(api.attachments.get, {
        attachmentId,
        tenantId: this.authContext?.tenantId
      }),
      "attachments:get"
    );
    return result;
  }
  /**
   * Asset upload and delivery require a qualified authenticated backend capability.
   * This intermediate SDK rejects with AssetCapabilityUnavailableError before
   * transport or file processing; no bearer URL or upload result is returned.
   * Future support uses bounded authenticated Convex upload and delivery.
   *
   * @throws AssetCapabilityUnavailableError with CAPABILITY_UNAVAILABLE
   */
  async getUrl(attachmentId) {
    void attachmentId;
    throw new AssetCapabilityUnavailableError();
  }
  /**
   * List attachments with comprehensive filters and pagination.
   *
   * @example
   * ```typescript
   * const result = await cortex.attachments.list({
   *   memorySpaceId: 'my-space',
   *   type: 'image',
   *   limit: 20,
   * });
   *
   * for (const attachment of result.attachments) {
   *   console.log(attachment.filename);
   * }
   *
   * // Pagination
   * if (result.hasMore) {
   *   const nextPage = await cortex.attachments.list({
   *     memorySpaceId: 'my-space',
   *     cursor: result.cursor,
   *   });
   * }
   * ```
   */
  async list(filter) {
    validateListAttachmentsFilter(filter);
    const result = await this.executeWithResilience(
      () => this.client.query(api.attachments.list, {
        memorySpaceId: filter.memorySpaceId,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter.tenantId),
        conversationId: filter.conversationId,
        messageId: filter.messageId,
        memoryId: filter.memoryId,
        artifactId: filter.artifactId,
        userId: filter.userId,
        type: filter.type,
        limit: filter.limit,
        cursor: filter.cursor,
        sortBy: filter.sortBy,
        sortOrder: filter.sortOrder
      }),
      "attachments:list"
    );
    return result;
  }
  /**
   * Get attachments for a specific conversation.
   *
   * @example
   * ```typescript
   * const attachments = await cortex.attachments.getByConversation('conv-123');
   * console.log(`${attachments.length} attachments in this conversation`);
   * ```
   */
  async getByConversation(conversationId, options) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.attachments.getByConversation, {
        conversationId,
        tenantId: this.authContext?.tenantId,
        type: options?.type,
        limit: options?.limit
      }),
      "attachments:getByConversation"
    );
    return result;
  }
  /**
   * Get attachments for a specific message.
   *
   * @example
   * ```typescript
   * const attachments = await cortex.attachments.getByMessage('msg-123');
   * for (const att of attachments) {
   *   console.log(att.filename);
   * }
   * ```
   */
  async getByMessage(messageId) {
    const result = await this.executeWithResilience(
      () => this.client.query(api.attachments.getByMessage, {
        messageId,
        tenantId: this.authContext?.tenantId
      }),
      "attachments:getByMessage"
    );
    return result;
  }
  /**
   * Count attachments matching filters.
   *
   * @example
   * ```typescript
   * const count = await cortex.attachments.count({
   *   memorySpaceId: 'my-space',
   *   type: 'image',
   * });
   * console.log(`${count} images in this space`);
   * ```
   */
  async count(filter) {
    validateListAttachmentsFilter({ memorySpaceId: filter.memorySpaceId });
    const result = await this.executeWithResilience(
      () => this.client.query(api.attachments.count, {
        memorySpaceId: filter.memorySpaceId,
        tenantId: resolveTenantId(this.authContext?.tenantId, filter.tenantId),
        conversationId: filter.conversationId,
        messageId: filter.messageId,
        userId: filter.userId,
        type: filter.type
      }),
      "attachments:count"
    );
    return result;
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delete Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Delete an attachment.
   *
   * Removes both the metadata record and the file from storage.
   *
   * @example
   * ```typescript
   * const success = await cortex.attachments.delete('attach-abc123');
   * if (success) {
   *   console.log('Attachment deleted');
   * }
   * ```
   */
  async delete(attachmentId) {
    validateAttachmentId(attachmentId);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.attachments.remove, {
          attachmentId,
          tenantId: this.authContext?.tenantId
        }),
        "attachments:delete"
      );
      return result.deleted;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  /**
   * Bulk delete multiple attachments.
   *
   * Returns the count of successfully deleted attachments.
   *
   * @example
   * ```typescript
   * const result = await cortex.attachments.deleteMany([
   *   'attach-123',
   *   'attach-456',
   *   'attach-789',
   * ]);
   * console.log(`Deleted ${result.deleted} of ${result.total} attachments`);
   * ```
   */
  async deleteMany(attachmentIds) {
    validateAttachmentIds(attachmentIds);
    try {
      const result = await this.executeWithResilience(
        () => this.client.mutation(api.attachments.removeMany, {
          attachmentIds,
          tenantId: this.authContext?.tenantId
        }),
        "attachments:deleteMany"
      );
      return result;
    } catch (error) {
      this.handleConvexError(error);
    }
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Convenience Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Upload a file and register it as an attachment in one operation.
   *
   * This is a convenience method that handles the full upload flow:
   * generates upload URL, uploads file, and registers the attachment.
   *
   * @example
   * ```typescript
   * const attachment = await cortex.attachments.upload({
   *   file: imageBlob,
   *   memorySpaceId: 'my-space',
   *   userId: 'user-123',
   *   type: 'image',
   *   filename: 'photo.png',
   *   conversationId: 'conv-456',
   * });
   * console.log(attachment.attachmentId);
   * ```
   */
  async upload(params) {
    const { uploadUrl } = await this.generateUploadUrl();
    const mimeType = params.mimeType ?? (params.file.type || "application/octet-stream");
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: params.file
    });
    if (!response.ok) {
      throw new Error(`File upload failed: ${response.statusText}`);
    }
    const { storageId } = await response.json();
    return this.attach({
      storageId,
      memorySpaceId: params.memorySpaceId,
      userId: params.userId,
      type: params.type,
      mimeType,
      filename: params.filename,
      size: params.file.size,
      conversationId: params.conversationId,
      messageId: params.messageId,
      memoryId: params.memoryId,
      artifactId: params.artifactId,
      dimensions: params.dimensions,
      duration: params.duration,
      metadata: params.metadata,
      tenantId: params.tenantId
    });
  }
};

// src/auth/credentials.ts
var InvalidHostTokenResultError = class extends TypeError {
};
var HostCredentials = class {
  constructor(fetchAuthToken, onAuthError) {
    this.fetchAuthToken = fetchAuthToken;
    this.onAuthError = onAuthError;
    if (typeof fetchAuthToken !== "function") {
      throw new TypeError("fetchAuthToken must be an async function");
    }
    if (onAuthError !== void 0 && typeof onAuthError !== "function") {
      throw new TypeError("onAuthError must be a function");
    }
  }
  httpOperations = /* @__PURE__ */ new WeakMap();
  reactiveClient;
  reactiveVersion = 0;
  reactiveAttemptId = 0;
  latestAuthFailure;
  pendingDeauthTimer;
  /** Latest reactive failure; only a later current successful token/null fetch clears it. */
  get authFailure() {
    return this.latestAuthFailure;
  }
  /** Direct token retrieval rejects errors. Reactive binding uses a safe adapter. */
  fetchToken = async (request) => {
    const pending = this.fetchAuthToken(request);
    if (typeof pending !== "object" || pending === null || !("then" in pending) || typeof pending.then !== "function") {
      throw new InvalidHostTokenResultError("fetchAuthToken must return a Promise");
    }
    const token = await Promise.resolve(pending);
    if (token === null) {
      return null;
    }
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      throw new InvalidHostTokenResultError("fetchAuthToken must resolve to a raw JWT or null");
    }
    return token;
  };
  /** Bind one reactive transport using Convex's official refresh callback. */
  bindReactiveClient(client) {
    if (client.closed) {
      throw new Error("Cannot bind a closed reactive client");
    }
    if (this.reactiveClient && this.reactiveClient !== client && !this.reactiveClient.closed) {
      throw new Error("Host credentials already have a bound reactive client");
    }
    this.reactiveClient = client;
    this.configureReactiveAuth(client, false);
  }
  /**
   * Call after host login, logout or identity changes. Reconfigure official Convex
   * auth and force the first host token fetch to bypass its cache; later refresh
   * requests are forwarded unchanged. A null token clears Convex identity.
   * Stop private observers on logout; persisted background grants still require
   * explicit backend revocation/deletion. Throws when unbound or already closed.
   */
  notifySessionChanged() {
    const client = this.reactiveClient;
    if (!client) {
      throw new Error("No reactive client is bound to host credentials");
    }
    if (client.closed) {
      this.reactiveClient = void 0;
      throw new Error("Cannot refresh a closed reactive client");
    }
    this.configureReactiveAuth(client, true);
  }
  configureReactiveAuth(client, forceFirstFetch) {
    const version = ++this.reactiveVersion;
    if (this.pendingDeauthTimer !== void 0) {
      clearTimeout(this.pendingDeauthTimer);
      this.pendingDeauthTimer = void 0;
    }
    const baseClient = client.client;
    if (baseClient.hasAuth()) {
      baseClient.clearAuth();
    }
    let firstFetch = forceFirstFetch;
    client.setAuth(async (request) => {
      if (version !== this.reactiveVersion || client.closed) {
        return null;
      }
      const currentRequest = firstFetch ? { ...request, forceRefreshToken: true } : request;
      firstFetch = false;
      const attemptId = ++this.reactiveAttemptId;
      try {
        const token = await this.fetchToken(currentRequest);
        if (this.isCurrentReactiveAttempt(client, version, attemptId)) {
          this.latestAuthFailure = void 0;
        }
        return token;
      } catch (error) {
        if (this.isCurrentReactiveAttempt(client, version, attemptId)) {
          const failure = Object.freeze({
            code: error instanceof InvalidHostTokenResultError ? "INVALID_HOST_TOKEN" : "HOST_TOKEN_FETCH_FAILED",
            attemptId
          });
          this.latestAuthFailure = failure;
          try {
            void Promise.resolve(this.onAuthError?.(failure)).catch(() => void 0);
          } catch (_observerError) {
          }
        }
        return null;
      }
    }, (authenticated) => {
      if (authenticated || version !== this.reactiveVersion || client.closed) return;
      const attemptId = this.reactiveAttemptId;
      if (this.pendingDeauthTimer !== void 0) {
        clearTimeout(this.pendingDeauthTimer);
      }
      const timer = setTimeout(() => {
        if (this.pendingDeauthTimer === timer) {
          this.pendingDeauthTimer = void 0;
        }
        if (this.isCurrentReactiveAttempt(client, version, attemptId)) {
          baseClient.clearAuth();
        }
      }, 0);
      this.pendingDeauthTimer = timer;
    });
  }
  isCurrentReactiveAttempt(client, version, attemptId) {
    return version === this.reactiveVersion && attemptId === this.reactiveAttemptId && !client.closed;
  }
  /**
   * Fresh headers for a host-approved private Convex HTTP request. Use this
   * result as the request's auth headers; do not retain old Authorization headers
   * after null/logout. The caller owns route/origin validation and byte limits.
   */
  async getAuthorizationHeaders(request = { forceRefreshToken: false }) {
    const token = await this.fetchToken(request);
    return token === null ? {} : { Authorization: `Bearer ${token}` };
  }
  /**
   * Attach the current credential before one HTTP operation. The official HTTP
   * client accepts a static token, so obtain it again for every invocation.
   * Serialize operations on this client to keep concurrent credentials separate.
   * No authentication failure or operation error triggers an operation retry.
   * Use a dedicated client with this helper for all of its authenticated calls.
   */
  async withHttpAuth(client, operation, request = { forceRefreshToken: false }) {
    const previous = this.httpOperations.get(client) ?? Promise.resolve();
    const result = previous.then(async () => {
      const token = await this.fetchToken(request);
      if (token === null) {
        client.clearAuth();
      } else {
        client.setAuth(token);
      }
      return await operation(client);
    });
    const settled = result.then(() => void 0, () => void 0);
    this.httpOperations.set(client, settled);
    try {
      return await result;
    } finally {
      if (this.httpOperations.get(client) === settled) {
        this.httpOperations.delete(client);
      }
    }
  }
};

// src/resilience/types.ts
var PRIORITY_ORDER = [
  "critical",
  "high",
  "normal",
  "low",
  "background"
];
var DEFAULT_RATE_LIMITER_CONFIG = {
  bucketSize: 100,
  refillRate: 50
};
var DEFAULT_CONCURRENCY_CONFIG = {
  maxConcurrent: 20,
  queueSize: 1e3,
  timeout: 3e4
};
var DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 3e4,
  halfOpenMax: 3
};
var DEFAULT_QUEUE_SIZES = {
  critical: 100,
  high: 500,
  normal: 1e3,
  low: 2e3,
  background: 5e3
};
var DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 1e4,
  exponentialBase: 2,
  jitter: true
};
var CircuitOpenError = class extends Error {
  constructor(message = "Circuit breaker is open - request rejected", retryAfterMs) {
    super(message);
    this.retryAfterMs = retryAfterMs;
    this.name = "CircuitOpenError";
  }
};
var QueueFullError = class extends Error {
  constructor(priority, queueSize) {
    super(
      `Queue full for priority '${priority}' (size: ${queueSize}) - request dropped`
    );
    this.priority = priority;
    this.queueSize = queueSize;
    this.name = "QueueFullError";
  }
};
var AcquireTimeoutError = class extends Error {
  constructor(timeoutMs, waitingCount) {
    super(
      `Timed out waiting for permit after ${timeoutMs}ms (${waitingCount} requests waiting)`
    );
    this.timeoutMs = timeoutMs;
    this.waitingCount = waitingCount;
    this.name = "AcquireTimeoutError";
  }
};
var RateLimitExceededError = class extends Error {
  constructor(tokensAvailable, refillInMs) {
    super(
      `Rate limit exceeded (${tokensAvailable} tokens available, refill in ${refillInMs}ms)`
    );
    this.tokensAvailable = tokensAvailable;
    this.refillInMs = refillInMs;
    this.name = "RateLimitExceededError";
  }
};

// src/resilience/CircuitBreaker.ts
var CircuitBreaker = class {
  state = "closed";
  failures = 0;
  successes = 0;
  halfOpenAttempts = 0;
  lastFailureAt;
  lastStateChangeAt;
  openedAt;
  // Configuration
  failureThreshold;
  successThreshold;
  timeout;
  halfOpenMax;
  // Metrics
  totalOpens = 0;
  // Event callbacks
  onOpen;
  onClose;
  onHalfOpen;
  constructor(config = {}, callbacks) {
    const merged = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.failureThreshold = merged.failureThreshold;
    this.successThreshold = merged.successThreshold;
    this.timeout = merged.timeout;
    this.halfOpenMax = merged.halfOpenMax;
    this.lastStateChangeAt = Date.now();
    this.onOpen = callbacks?.onOpen;
    this.onClose = callbacks?.onClose;
    this.onHalfOpen = callbacks?.onHalfOpen;
  }
  /**
   * Check if circuit is currently open (not accepting requests)
   */
  isOpen() {
    if (this.state === "open") {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= this.timeout) {
        this.transitionTo("half-open");
      }
    }
    return this.state === "open";
  }
  /**
   * Check if circuit allows execution
   */
  allowsExecution() {
    this.isOpen();
    switch (this.state) {
      case "closed":
        return true;
      case "open":
        return false;
      case "half-open":
        return this.halfOpenAttempts < this.halfOpenMax;
    }
  }
  /**
   * Execute a function through the circuit breaker
   *
   * @param fn The function to execute
   * @returns The result of the function
   * @throws CircuitOpenError if circuit is open
   */
  async execute(fn) {
    if (!this.allowsExecution()) {
      const retryAfter = this.openedAt ? this.timeout - (Date.now() - this.openedAt) : this.timeout;
      throw new CircuitOpenError(
        "Circuit breaker is open - request rejected",
        Math.max(0, retryAfter)
      );
    }
    if (this.state === "half-open") {
      this.halfOpenAttempts++;
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
  /**
   * Record a successful execution
   */
  recordSuccess() {
    switch (this.state) {
      case "closed":
        this.failures = 0;
        break;
      case "half-open":
        this.successes++;
        if (this.successes >= this.successThreshold) {
          this.transitionTo("closed");
        }
        break;
      case "open":
        break;
    }
  }
  /**
   * Record a failed execution
   */
  recordFailure(_error) {
    this.lastFailureAt = Date.now();
    switch (this.state) {
      case "closed":
        this.failures++;
        if (this.failures >= this.failureThreshold) {
          this.transitionTo("open");
        }
        break;
      case "half-open":
        this.transitionTo("open");
        break;
      case "open":
        break;
    }
  }
  /**
   * Get current circuit state
   */
  getState() {
    this.isOpen();
    return this.state;
  }
  /**
   * Get time until circuit might close (ms)
   * Returns 0 if circuit is closed
   */
  getTimeUntilClose() {
    if (this.state === "closed") {
      return 0;
    }
    if (this.state === "open" && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      return Math.max(0, this.timeout - elapsed);
    }
    return 0;
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    this.isOpen();
    return {
      state: this.state,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt,
      lastStateChangeAt: this.lastStateChangeAt,
      totalOpens: this.totalOpens
    };
  }
  /**
   * Manually reset circuit to closed state
   */
  reset() {
    this.transitionTo("closed");
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureAt = void 0;
    this.totalOpens = 0;
  }
  /**
   * Force circuit to open state (for testing/maintenance)
   */
  forceOpen() {
    this.transitionTo("open");
  }
  /**
   * Force circuit to closed state (for testing/recovery)
   */
  forceClose() {
    this.transitionTo("closed");
  }
  /**
   * Transition to a new state
   */
  transitionTo(newState) {
    if (this.state === newState) {
      return;
    }
    const previousState = this.state;
    this.state = newState;
    this.lastStateChangeAt = Date.now();
    switch (newState) {
      case "closed":
        this.failures = 0;
        this.successes = 0;
        this.halfOpenAttempts = 0;
        this.onClose?.();
        break;
      case "open":
        this.openedAt = Date.now();
        this.successes = 0;
        this.halfOpenAttempts = 0;
        if (previousState !== "open") {
          this.totalOpens++;
        }
        this.onOpen?.(this.failures);
        break;
      case "half-open":
        this.successes = 0;
        this.halfOpenAttempts = 0;
        this.onHalfOpen?.();
        break;
    }
  }
};

// src/resilience/PriorityQueue.ts
var PriorityQueue = class {
  queues;
  limits;
  // Metrics tracking
  processed = 0;
  dropped = 0;
  constructor(config = {}) {
    this.queues = /* @__PURE__ */ new Map();
    for (const priority of PRIORITY_ORDER) {
      this.queues.set(priority, []);
    }
    this.limits = { ...DEFAULT_QUEUE_SIZES, ...config.maxSize };
  }
  /**
   * Add a request to the queue
   *
   * @param request The request to queue
   * @returns true if queued, false if queue was full
   * @throws QueueFullError if queue is full for the given priority
   */
  enqueue(request) {
    const queue = this.queues.get(request.priority);
    const limit = this.limits[request.priority];
    if (queue.length >= limit) {
      this.dropped++;
      throw new QueueFullError(request.priority, queue.length);
    }
    queue.push(request);
    return true;
  }
  /**
   * Try to add a request without throwing
   *
   * @param request The request to queue
   * @returns true if queued, false if queue was full
   */
  tryEnqueue(request) {
    const queue = this.queues.get(request.priority);
    const limit = this.limits[request.priority];
    if (queue.length >= limit) {
      this.dropped++;
      return false;
    }
    queue.push(request);
    return true;
  }
  /**
   * Remove and return the highest priority request
   *
   * @returns The next request to process, or undefined if queue is empty
   */
  dequeue() {
    for (const priority of PRIORITY_ORDER) {
      const queue = this.queues.get(priority);
      if (queue.length > 0) {
        this.processed++;
        return queue.shift();
      }
    }
    return void 0;
  }
  /**
   * Peek at the highest priority request without removing it
   *
   * @returns The next request that would be dequeued, or undefined if empty
   */
  peek() {
    for (const priority of PRIORITY_ORDER) {
      const queue = this.queues.get(priority);
      if (queue.length > 0) {
        return queue[0];
      }
    }
    return void 0;
  }
  /**
   * Get total number of queued requests
   */
  size() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
  /**
   * Get queue size broken down by priority
   */
  sizeByPriority() {
    const result = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0
    };
    for (const [priority, queue] of this.queues.entries()) {
      result[priority] = queue.length;
    }
    return result;
  }
  /**
   * Check if the queue is empty
   */
  isEmpty() {
    return this.size() === 0;
  }
  /**
   * Check if a specific priority queue has capacity
   */
  hasCapacity(priority) {
    const queue = this.queues.get(priority);
    return queue.length < this.limits[priority];
  }
  /**
   * Get the age of the oldest request in the queue (ms)
   */
  getOldestRequestAge() {
    let oldest;
    const now = Date.now();
    for (const queue of this.queues.values()) {
      if (queue.length > 0) {
        const age = now - queue[0].queuedAt;
        if (oldest === void 0 || age > oldest) {
          oldest = age;
        }
      }
    }
    return oldest;
  }
  /**
   * Remove all expired requests (older than maxAge)
   *
   * @param maxAgeMs Maximum age in milliseconds
   * @returns Number of requests removed
   */
  removeExpired(maxAgeMs) {
    const now = Date.now();
    let removed = 0;
    for (const [_, queue] of this.queues.entries()) {
      const toRemove = [];
      for (let i = 0; i < queue.length; i++) {
        if (now - queue[i].queuedAt > maxAgeMs) {
          toRemove.push(i);
        }
      }
      for (let i = toRemove.length - 1; i >= 0; i--) {
        const request = queue.splice(toRemove[i], 1)[0];
        request.reject(
          new Error(`Request expired after ${maxAgeMs}ms in queue`)
        );
        removed++;
      }
    }
    return removed;
  }
  /**
   * Cancel a specific request by ID
   *
   * @param requestId The request ID to cancel
   * @returns true if found and cancelled, false otherwise
   */
  cancel(requestId) {
    for (const [_, queue] of this.queues.entries()) {
      const index = queue.findIndex((r) => r.id === requestId);
      if (index !== -1) {
        const [request] = queue.splice(index, 1);
        request.reject(new Error("Request cancelled"));
        return true;
      }
    }
    return false;
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      total: this.size(),
      byPriority: this.sizeByPriority(),
      processed: this.processed,
      dropped: this.dropped,
      oldestRequestAgeMs: this.getOldestRequestAge()
    };
  }
  /**
   * Clear all queues and reject all pending requests
   */
  clear() {
    for (const [_, queue] of this.queues.entries()) {
      while (queue.length > 0) {
        const request = queue.shift();
        request.reject(new Error("Queue cleared"));
      }
    }
  }
  /**
   * Reset metrics (but keep queued requests)
   */
  resetMetrics() {
    this.processed = 0;
    this.dropped = 0;
  }
};

// src/resilience/priorities.ts
var OPERATION_PRIORITIES = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CRITICAL - GDPR/Security (never delayed, never dropped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "users:delete": "critical",
  "users:purge": "critical",
  "governance:purge": "critical",
  "governance:deleteUserData": "critical",
  "governance:executeRetentionPolicy": "critical",
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HIGH - Real-time conversation (low latency required)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "memory:remember": "high",
  "memory:rememberStream": "high",
  "conversations:create": "high",
  "conversations:addMessage": "high",
  "conversations:update": "high",
  "a2a:sendMessage": "high",
  "a2a:broadcast": "high",
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NORMAL - Standard operations (default)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "memory:search": "normal",
  "memory:get": "normal",
  "memory:store": "normal",
  "memory:update": "normal",
  "memory:delete": "normal",
  "memory:list": "normal",
  "memory:count": "normal",
  "conversations:get": "normal",
  "conversations:list": "normal",
  "conversations:delete": "normal",
  "facts:store": "normal",
  "facts:get": "normal",
  "facts:search": "normal",
  "facts:update": "normal",
  "facts:delete": "normal",
  "facts:list": "normal",
  "contexts:create": "normal",
  "contexts:get": "normal",
  "contexts:update": "normal",
  "contexts:delete": "normal",
  "vector:store": "normal",
  "vector:search": "normal",
  "vector:get": "normal",
  "vector:update": "normal",
  "vector:delete": "normal",
  "immutable:append": "normal",
  "immutable:get": "normal",
  "immutable:list": "normal",
  "mutable:set": "normal",
  "mutable:get": "normal",
  "mutable:delete": "normal",
  "users:create": "normal",
  "users:get": "normal",
  "users:update": "normal",
  "users:list": "normal",
  "agents:create": "normal",
  "agents:get": "normal",
  "agents:update": "normal",
  "agents:delete": "normal",
  "agents:list": "normal",
  "memorySpaces:create": "normal",
  "memorySpaces:get": "normal",
  "memorySpaces:update": "normal",
  "memorySpaces:delete": "normal",
  "memorySpaces:list": "normal",
  "a2a:get": "normal",
  "a2a:list": "normal",
  "a2a:subscribe": "normal",
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOW - Bulk operations (can tolerate delays)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "memory:export": "low",
  "memory:deleteMany": "low",
  "memory:updateMany": "low",
  "memory:archive": "low",
  "memory:restoreFromArchive": "low",
  "facts:deleteMany": "low",
  "facts:updateMany": "low",
  "facts:export": "low",
  "conversations:deleteMany": "low",
  "conversations:export": "low",
  "vector:deleteMany": "low",
  "vector:updateMany": "low",
  "governance:listPolicies": "low",
  "governance:createPolicy": "low",
  "governance:updatePolicy": "low",
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BACKGROUND - Async operations (run when idle)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "graphSync:*": "background",
  "graph:sync": "background",
  "graph:batchSync": "background"
};
var DEFAULT_PRIORITY = "normal";
function getPriority(operationName) {
  if (operationName in OPERATION_PRIORITIES) {
    return OPERATION_PRIORITIES[operationName];
  }
  const [namespace] = operationName.split(":");
  const wildcardKey = `${namespace}:*`;
  if (wildcardKey in OPERATION_PRIORITIES) {
    return OPERATION_PRIORITIES[wildcardKey];
  }
  return DEFAULT_PRIORITY;
}
function isCritical(operationName) {
  return getPriority(operationName) === "critical";
}

// src/resilience/Semaphore.ts
var Semaphore = class {
  availablePermits;
  maxPermits;
  queueLimit;
  defaultTimeout;
  waiting = [];
  // Metrics tracking
  maxReached = 0;
  timeouts = 0;
  constructor(config = {}) {
    const merged = { ...DEFAULT_CONCURRENCY_CONFIG, ...config };
    this.maxPermits = merged.maxConcurrent;
    this.queueLimit = merged.queueSize;
    this.defaultTimeout = merged.timeout;
    this.availablePermits = this.maxPermits;
  }
  /**
   * Acquire a permit, waiting if necessary
   *
   * @param timeout Maximum time to wait (ms). Uses default if not provided.
   * @returns A permit that must be released when done
   * @throws AcquireTimeoutError if timeout is reached
   * @throws Error if queue is full
   */
  async acquire(timeout) {
    if (this.availablePermits > 0) {
      this.availablePermits--;
      this.updateMaxReached();
      return this.createPermit();
    }
    if (this.waiting.length >= this.queueLimit) {
      throw new Error(
        `Semaphore queue full (${this.queueLimit} requests waiting)`
      );
    }
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    return new Promise((resolve, reject) => {
      const request = { resolve, reject };
      if (effectiveTimeout > 0) {
        request.timeoutId = setTimeout(() => {
          const index = this.waiting.indexOf(request);
          if (index !== -1) {
            this.waiting.splice(index, 1);
          }
          this.timeouts++;
          reject(
            new AcquireTimeoutError(effectiveTimeout, this.waiting.length)
          );
        }, effectiveTimeout);
      }
      this.waiting.push(request);
    });
  }
  /**
   * Try to acquire a permit without waiting
   *
   * @returns A permit if available, undefined otherwise
   */
  tryAcquire() {
    if (this.availablePermits > 0) {
      this.availablePermits--;
      this.updateMaxReached();
      return this.createPermit();
    }
    return void 0;
  }
  /**
   * Create a permit object with release function
   */
  createPermit() {
    let released = false;
    return {
      release: () => {
        if (released) {
          console.warn("Semaphore permit released multiple times");
          return;
        }
        released = true;
        this.release();
      }
    };
  }
  /**
   * Release a permit back to the semaphore
   * (Called internally by permit.release())
   */
  release() {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next.timeoutId) {
        clearTimeout(next.timeoutId);
      }
      this.updateMaxReached();
      next.resolve(this.createPermit());
    } else {
      this.availablePermits++;
    }
  }
  /**
   * Update max concurrent reached metric
   */
  updateMaxReached() {
    const active = this.maxPermits - this.availablePermits;
    if (active > this.maxReached) {
      this.maxReached = active;
    }
  }
  /**
   * Get number of currently active (acquired) permits
   */
  getActiveCount() {
    return this.maxPermits - this.availablePermits;
  }
  /**
   * Get number of requests waiting for a permit
   */
  getWaitingCount() {
    return this.waiting.length;
  }
  /**
   * Get available permits
   */
  getAvailableCount() {
    return this.availablePermits;
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      active: this.getActiveCount(),
      waiting: this.waiting.length,
      maxReached: this.maxReached,
      timeouts: this.timeouts
    };
  }
  /**
   * Reset semaphore to initial state
   * WARNING: This will reject all waiting requests
   */
  reset() {
    const waitingCopy = [...this.waiting];
    this.waiting = [];
    for (const request of waitingCopy) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(new Error("Semaphore reset"));
    }
    this.availablePermits = this.maxPermits;
    this.maxReached = 0;
    this.timeouts = 0;
  }
};

// src/resilience/TokenBucket.ts
var TokenBucket = class {
  tokens;
  lastRefill;
  bucketSize;
  refillRate;
  // Metrics tracking
  requestsThrottled = 0;
  totalWaitTimeMs = 0;
  constructor(config = {}) {
    const merged = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config };
    this.bucketSize = merged.bucketSize;
    this.refillRate = merged.refillRate;
    this.tokens = this.bucketSize;
    this.lastRefill = Date.now();
  }
  /**
   * Refill tokens based on time elapsed since last refill
   */
  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed / 1e3 * this.refillRate;
    this.tokens = Math.min(this.bucketSize, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  /**
   * Try to acquire a token without waiting
   *
   * @returns true if token was acquired, false if bucket is empty
   */
  tryAcquire() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
  /**
   * Acquire a token, waiting if necessary
   *
   * @param timeout Maximum time to wait (ms). If not provided, waits indefinitely.
   * @throws RateLimitExceededError if timeout is reached
   */
  async acquire(timeout) {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const tokensNeeded = 1 - this.tokens;
    const waitTimeMs = tokensNeeded / this.refillRate * 1e3;
    if (timeout !== void 0 && waitTimeMs > timeout) {
      throw new RateLimitExceededError(
        Math.floor(this.tokens),
        Math.ceil(waitTimeMs)
      );
    }
    this.requestsThrottled++;
    this.totalWaitTimeMs += waitTimeMs;
    await this.sleep(waitTimeMs);
    this.refill();
    this.tokens -= 1;
  }
  /**
   * Get the number of tokens currently available
   */
  getAvailableTokens() {
    this.refill();
    return Math.floor(this.tokens);
  }
  /**
   * Get time until next token is available (ms)
   */
  getTimeUntilNextToken() {
    this.refill();
    if (this.tokens >= 1) {
      return 0;
    }
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate * 1e3);
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    this.refill();
    return {
      tokensAvailable: Math.floor(this.tokens),
      requestsThrottled: this.requestsThrottled,
      avgWaitTimeMs: this.requestsThrottled > 0 ? this.totalWaitTimeMs / this.requestsThrottled : 0
    };
  }
  /**
   * Reset the bucket to full and clear metrics
   */
  reset() {
    this.tokens = this.bucketSize;
    this.lastRefill = Date.now();
    this.requestsThrottled = 0;
    this.totalWaitTimeMs = 0;
  }
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// src/resilience/index.ts
function isNonSystemFailure(error) {
  const errorStr = String(error);
  const errorLower = errorStr.toLowerCase();
  const notFoundPatterns = [
    "IMMUTABLE_ENTRY_NOT_FOUND",
    "USER_NOT_FOUND",
    "CONVERSATION_NOT_FOUND",
    "MEMORY_NOT_FOUND",
    "FACT_NOT_FOUND",
    "MUTABLE_KEY_NOT_FOUND",
    "KEY_NOT_FOUND",
    "CONTEXT_NOT_FOUND",
    "MEMORY_SPACE_NOT_FOUND",
    "MEMORYSPACE_NOT_FOUND",
    "AGENT_NOT_FOUND",
    "AGENT_NOT_REGISTERED",
    "VERSION_NOT_FOUND",
    "PARENT_NOT_FOUND",
    "NOT_FOUND",
    "not found"
  ];
  const validationPatterns = [
    "INVALID_",
    // Catches all INVALID_* errors
    "DATA_TOO_LARGE",
    "VALUE_TOO_LARGE",
    "invalid ",
    "validation error",
    "validation failed"
  ];
  const duplicatePatterns = [
    "ALREADY_EXISTS",
    "ALREADY_REGISTERED",
    "MEMORYSPACE_ALREADY_EXISTS",
    "AGENT_ALREADY_REGISTERED",
    "DUPLICATE",
    "CONFLICT",
    "already exists",
    "already registered"
  ];
  const emptyResultPatterns = [
    "NO_MEMORIES_MATCHED",
    "NO_USERS_MATCHED",
    "no results",
    "no matches"
  ];
  const permissionPatterns = [
    "PERMISSION_DENIED",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "ACCESS_DENIED",
    "permission denied",
    "unauthorized",
    "forbidden"
  ];
  const configPatterns = [
    "CLOUD_MODE_REQUIRED",
    "PUBSUB_NOT_CONFIGURED",
    "not configured",
    "not enabled"
  ];
  const businessLogicPatterns = [
    "HAS_CHILDREN",
    "MEMORYSPACE_HAS_DATA",
    "PURGE_CANCELLED",
    "DELETION_CANCELLED",
    "has children",
    "has data",
    "cancelled"
  ];
  const allPatterns = [
    ...notFoundPatterns,
    ...validationPatterns,
    ...duplicatePatterns,
    ...emptyResultPatterns,
    ...permissionPatterns,
    ...configPatterns,
    ...businessLogicPatterns
  ];
  return allPatterns.some(
    (pattern) => errorStr.includes(pattern) || errorLower.includes(pattern.toLowerCase())
  );
}
function isEventualConsistencyError(error) {
  const errorStr = String(error);
  const eventualConsistencyPatterns = [
    "CONTEXT_NOT_FOUND",
    "MEMORY_NOT_FOUND",
    "FACT_NOT_FOUND",
    "CONVERSATION_NOT_FOUND",
    "MEMORY_SPACE_NOT_FOUND",
    "MEMORYSPACE_NOT_FOUND",
    "AGENT_NOT_FOUND"
  ];
  return eventualConsistencyPatterns.some(
    (pattern) => errorStr.includes(pattern)
  );
}
function isRetryableError(error) {
  if (isEventualConsistencyError(error)) {
    return true;
  }
  if (isNonSystemFailure(error)) {
    return false;
  }
  const errorStr = String(error);
  const errorLower = errorStr.toLowerCase();
  const retryablePatterns = [
    // Generic server errors (often transient)
    "Server Error",
    "server error",
    "Internal Server Error",
    "internal server error",
    // Rate limiting
    "rate limit",
    "too many requests",
    "429",
    "throttl",
    // Timeouts
    "timeout",
    "timed out",
    "request timed out",
    "deadline exceeded",
    // Network issues
    "connection",
    "network",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    // Temporary unavailability
    "temporarily unavailable",
    "service unavailable",
    "503",
    "502",
    "504",
    // Convex-specific transient errors
    "overloaded",
    "try again",
    "retry"
  ];
  return retryablePatterns.some(
    (pattern) => errorStr.includes(pattern) || errorLower.includes(pattern.toLowerCase())
  );
}
function calculateRetryDelay(attempt, baseDelayMs, maxDelayMs, exponentialBase, jitter) {
  const delay = baseDelayMs * Math.pow(exponentialBase, attempt);
  const cappedDelay = Math.min(delay, maxDelayMs);
  if (jitter) {
    const jitterFactor = 0.5 + Math.random();
    return Math.floor(cappedDelay * jitterFactor);
  }
  return Math.floor(cappedDelay);
}
var ResiliencePresets = {
  /**
   * Default configuration for Convex Free/Starter plan
   *
   * Respects Convex's 16 concurrent query/mutation limit.
   * Good for most single-agent use cases.
   * Includes automatic retry (3 attempts) for transient failures.
   */
  default: {
    enabled: true,
    rateLimiter: {
      bucketSize: 100,
      // Allow burst of 100 calls
      refillRate: 50
      // Sustain ~50 ops/sec (well under 1M/month)
    },
    concurrency: {
      maxConcurrent: 16,
      // Convex free plan limit for queries/mutations
      queueSize: 1e3,
      // Queue excess requests
      timeout: 3e4
      // 30s timeout (queries/mutations must complete in 1s anyway)
    },
    circuitBreaker: {
      failureThreshold: 5,
      // Open after 5 consecutive failures
      successThreshold: 2,
      // Close after 2 successes in half-open
      timeout: 3e4,
      // 30s before attempting recovery
      halfOpenMax: 3
      // Allow 3 test requests in half-open
    },
    queue: {
      maxSize: {
        critical: 100,
        high: 500,
        normal: 1e3,
        low: 2e3,
        background: 5e3
      }
    },
    retry: {
      maxRetries: 3,
      // Retry up to 3 times
      baseDelayMs: 500,
      // Start with 0.5s delay
      maxDelayMs: 1e4,
      // Cap at 10s
      exponentialBase: 2,
      // Double delay each attempt
      jitter: true
      // Prevent thundering herd
    }
  },
  /**
   * Real-time agent configuration for Convex Free/Starter plan
   *
   * Optimized for low latency conversation storage.
   * Uses conservative limits to ensure fast response times.
   */
  realTimeAgent: {
    enabled: true,
    rateLimiter: {
      bucketSize: 30,
      // Small burst for responsive UX
      refillRate: 20
      // Modest sustained rate
    },
    concurrency: {
      maxConcurrent: 8,
      // Half of free plan limit for headroom
      queueSize: 100,
      // Small queue - prefer fast failure
      timeout: 5e3
      // 5s timeout - fail fast for real-time
    },
    circuitBreaker: {
      failureThreshold: 3,
      // Trip quickly on issues
      successThreshold: 2,
      timeout: 1e4,
      // Quick recovery attempt
      halfOpenMax: 2
    },
    queue: {
      maxSize: {
        critical: 50,
        high: 100,
        normal: 200,
        low: 100,
        background: 50
      }
    },
    retry: {
      maxRetries: 2,
      // Fewer retries for real-time UX
      baseDelayMs: 200,
      // Shorter delays for responsiveness
      maxDelayMs: 2e3,
      // Cap at 2s for real-time
      exponentialBase: 2,
      jitter: true
    }
  },
  /**
   * Batch processing configuration for Convex Professional plan
   *
   * High throughput for bulk operations.
   * ⚠️ Requires Professional plan (256 concurrent limit)
   */
  batchProcessing: {
    enabled: true,
    rateLimiter: {
      bucketSize: 500,
      // Large burst for batch imports
      refillRate: 100
      // High sustained throughput
    },
    concurrency: {
      maxConcurrent: 64,
      // Professional plan allows 256, use 64 for safety
      queueSize: 1e4,
      // Large queue for batch jobs
      timeout: 6e4
      // 1 minute timeout for batch operations
    },
    circuitBreaker: {
      failureThreshold: 10,
      // More tolerant of transient failures
      successThreshold: 3,
      timeout: 6e4,
      // Longer recovery for batch context
      halfOpenMax: 5
    },
    queue: {
      maxSize: {
        critical: 200,
        high: 1e3,
        normal: 5e3,
        low: 1e4,
        background: 2e4
      }
    },
    retry: {
      maxRetries: 5,
      // More retries for batch resilience
      baseDelayMs: 1e3,
      // Longer base delay for batch
      maxDelayMs: 3e4,
      // Higher cap for batch operations
      exponentialBase: 2,
      jitter: true
    }
  },
  /**
   * Hive Mode configuration for Convex Professional plan
   *
   * Extreme concurrency for multi-agent swarms sharing one database.
   * ⚠️ Requires Professional plan with increased limits.
   * Contact Convex support for limits beyond default Professional tier.
   */
  hiveMode: {
    enabled: true,
    rateLimiter: {
      bucketSize: 1e3,
      // Large burst for swarm coordination
      refillRate: 200
      // High sustained for many agents
    },
    concurrency: {
      maxConcurrent: 128,
      // High concurrency for swarms
      queueSize: 5e4,
      // Very large queue for burst absorption
      timeout: 12e4
      // 2 minute timeout for complex coordination
    },
    circuitBreaker: {
      failureThreshold: 20,
      // Very tolerant - swarms have natural backoff
      successThreshold: 5,
      timeout: 3e4,
      halfOpenMax: 10
    },
    queue: {
      maxSize: {
        critical: 500,
        high: 5e3,
        normal: 2e4,
        low: 3e4,
        background: 5e4
      }
    },
    retry: {
      maxRetries: 4,
      // Good retry coverage for swarm coordination
      baseDelayMs: 500,
      maxDelayMs: 15e3,
      exponentialBase: 2,
      jitter: true
      // Critical for swarms to avoid thundering herd
    }
  },
  /**
   * Disabled configuration
   *
   * Bypasses all resilience mechanisms.
   * ⚠️ Not recommended for production - may hit Convex rate limits.
   */
  disabled: {
    enabled: false
  }
};
function getPresetForPlan(plan) {
  const effectivePlan = plan || runtimeEnv.CONVEX_PLAN || "free";
  switch (effectivePlan.toLowerCase()) {
    case "professional":
      return ResiliencePresets.batchProcessing;
    case "free":
    case "starter":
    default:
      return ResiliencePresets.default;
  }
}
var ResilienceLayer = class {
  enabled;
  tokenBucket;
  semaphore;
  queue;
  circuitBreaker;
  config;
  // Queue processing state
  isProcessingQueue = false;
  queueProcessorInterval;
  // Request counter for unique IDs
  requestCounter = 0;
  constructor(config = ResiliencePresets.default) {
    this.config = config;
    this.enabled = config.enabled !== false;
    this.tokenBucket = new TokenBucket(config.rateLimiter);
    this.semaphore = new Semaphore(config.concurrency);
    this.queue = new PriorityQueue(config.queue);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, {
      onOpen: config.onCircuitOpen,
      onClose: config.onCircuitClose,
      onHalfOpen: config.onCircuitHalfOpen
    });
    if (this.enabled) {
      this.startQueueProcessor();
    }
  }
  /**
   * Execute an operation through all resilience layers with automatic retry
   * for transient failures (timeouts, rate limits, server errors).
   *
   * @param operation The async operation to execute
   * @param operationName Operation identifier for priority mapping
   * @returns The result of the operation
   */
  async execute(operation, operationName) {
    if (!this.enabled) {
      return operation();
    }
    const priority = getPriority(operationName);
    if (this.circuitBreaker.isOpen()) {
      return this.enqueueAndWait(operation, priority, operationName);
    }
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...this.config.retry };
    const maxAttempts = retryConfig.maxRetries + 1;
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this._executeSingleAttempt(operation);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof CircuitOpenError) {
          throw error;
        }
        if (error instanceof QueueFullError) {
          throw error;
        }
        if (!isRetryableError(error)) {
          throw lastError;
        }
        if (attempt < maxAttempts - 1) {
          const delay = calculateRetryDelay(
            attempt,
            retryConfig.baseDelayMs,
            retryConfig.maxDelayMs,
            retryConfig.exponentialBase,
            retryConfig.jitter
          );
          if (this.config.onRetry) {
            try {
              this.config.onRetry(attempt + 1, lastError, delay);
            } catch {
            }
          }
          await this.sleep(delay);
        }
      }
    }
    throw lastError || new Error("Max retries exceeded");
  }
  /**
   * Execute a single attempt through rate limiting, concurrency, and circuit breaker
   */
  async _executeSingleAttempt(operation) {
    await this.tokenBucket.acquire(this.config.concurrency?.timeout);
    const permit = await this.semaphore.acquire();
    try {
      const result = await operation();
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      if (!isNonSystemFailure(error)) {
        this.circuitBreaker.recordFailure(
          error instanceof Error ? error : new Error(String(error))
        );
      }
      if (error && typeof error === "object" && "data" in error && error.data !== void 0) {
        const convexError = error;
        const errorData = typeof convexError.data === "string" ? convexError.data : JSON.stringify(convexError.data);
        throw new Error(errorData);
      }
      throw error;
    } finally {
      permit.release();
      void this.processQueueBatch();
    }
  }
  /**
   * Execute with automatic retry on transient failures
   *
   * @param operation The operation to execute
   * @param operationName Operation identifier
   * @param maxRetries Maximum retry attempts
   * @param retryDelayMs Delay between retries (ms)
   */
  async executeWithRetry(operation, operationName, maxRetries = 3, retryDelayMs = 1e3) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(operation, operationName);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof CircuitOpenError) {
          throw error;
        }
        if (error instanceof QueueFullError) {
          throw error;
        }
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }
    throw lastError || new Error("Max retries exceeded");
  }
  /**
   * Enqueue an operation and wait for execution
   */
  enqueueAndWait(operation, priority, operationName) {
    return new Promise((resolve, reject) => {
      const request = {
        id: `req_${Date.now()}_${++this.requestCounter}`,
        operation,
        priority,
        operationName,
        queuedAt: Date.now(),
        attempts: 0,
        resolve,
        reject
      };
      try {
        this.queue.enqueue(request);
      } catch (error) {
        if (error instanceof QueueFullError) {
          this.config.onQueueFull?.(priority);
        }
        reject(error);
      }
    });
  }
  /**
   * Process queued requests
   */
  async processQueueBatch() {
    if (this.isProcessingQueue) {
      return;
    }
    this.isProcessingQueue = true;
    try {
      while (!this.queue.isEmpty() && this.circuitBreaker.allowsExecution()) {
        if (!this.tokenBucket.tryAcquire()) {
          break;
        }
        const permit = this.semaphore.tryAcquire();
        if (!permit) {
          break;
        }
        const request = this.queue.dequeue();
        if (!request) {
          permit.release();
          break;
        }
        this.executeQueuedRequest(request, permit).catch(() => {
        });
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
  /**
   * Execute a queued request
   */
  async executeQueuedRequest(request, permit) {
    try {
      const result = await request.operation();
      this.circuitBreaker.recordSuccess();
      request.resolve(result);
    } catch (error) {
      if (!isNonSystemFailure(error)) {
        this.circuitBreaker.recordFailure(
          error instanceof Error ? error : new Error(String(error))
        );
      }
      request.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      permit.release();
    }
  }
  /**
   * Start background queue processor
   */
  startQueueProcessor() {
    this.queueProcessorInterval = setInterval(() => {
      if (!this.queue.isEmpty()) {
        void this.processQueueBatch();
      }
    }, 100);
  }
  /**
   * Stop background queue processor
   */
  stopQueueProcessor() {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = void 0;
    }
  }
  /**
   * Get current metrics from all layers
   */
  getMetrics() {
    return {
      rateLimiter: this.tokenBucket.getMetrics(),
      concurrency: this.semaphore.getMetrics(),
      circuitBreaker: this.circuitBreaker.getMetrics(),
      queue: this.queue.getMetrics(),
      timestamp: Date.now()
    };
  }
  /**
   * Check if the system is healthy
   */
  isHealthy() {
    if (!this.enabled) {
      return true;
    }
    const state = this.circuitBreaker.getState();
    return state === "closed";
  }
  /**
   * Check if the system is accepting requests
   */
  isAcceptingRequests() {
    if (!this.enabled) {
      return true;
    }
    return this.circuitBreaker.allowsExecution();
  }
  /**
   * Reset all layers to initial state
   */
  reset() {
    this.tokenBucket.reset();
    this.semaphore.reset();
    this.queue.clear();
    this.circuitBreaker.reset();
  }
  /**
   * Graceful shutdown - wait for pending operations
   *
   * @param timeoutMs Maximum time to wait for pending operations
   */
  async shutdown(timeoutMs = 3e4) {
    this.stopQueueProcessor();
    const startTime = Date.now();
    while (!this.queue.isEmpty() && Date.now() - startTime < timeoutMs) {
      await this.sleep(100);
    }
    if (!this.queue.isEmpty()) {
      console.warn(
        `Shutdown timeout: ${this.queue.size()} requests still in queue`
      );
      this.queue.clear();
    }
  }
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// src/auth/context.ts
function createAuthContext(params) {
  validateAuthContextParams(params);
  const context = {
    userId: params.userId
  };
  if (params.tenantId !== void 0) {
    context.tenantId = params.tenantId;
  }
  if (params.organizationId !== void 0) {
    context.organizationId = params.organizationId;
  }
  if (params.sessionId !== void 0) {
    context.sessionId = params.sessionId;
  }
  if (params.authProvider !== void 0) {
    context.authProvider = params.authProvider;
  }
  if (params.authMethod !== void 0) {
    context.authMethod = params.authMethod;
  }
  if (params.authenticatedAt !== void 0) {
    context.authenticatedAt = params.authenticatedAt;
  }
  if (params.claims !== void 0) {
    context.claims = { ...params.claims };
  }
  if (params.metadata !== void 0) {
    context.metadata = { ...params.metadata };
  }
  return context;
}
function validateAuthContext(context) {
  validateAuthContextParams(context);
  return true;
}

// src/sharing/index.ts
function buildShareUrl(shareId, config) {
  const style = config.style || "path";
  if (style === "path") {
    const base = config.baseUrl.replace(/\/$/, "");
    return `${base}/${encodeURIComponent(shareId)}`;
  } else {
    const paramName = config.paramName || "id";
    const separator = config.baseUrl.includes("?") ? "&" : "?";
    return `${config.baseUrl}${separator}${paramName}=${encodeURIComponent(shareId)}`;
  }
}
function extractShareId(url, config = {}) {
  const style = config.style || "path";
  try {
    const urlObj = new URL(url);
    if (style === "path") {
      const segments = urlObj.pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      return lastSegment ? decodeURIComponent(lastSegment) : null;
    } else {
      const paramName = config.paramName || "id";
      const value = urlObj.searchParams.get(paramName);
      return value || null;
    }
  } catch {
    return null;
  }
}

// src/users/schemas.ts
var validationPresets = {
  /**
   * Strict validation for production/enterprise apps.
   *
   * Requires displayName and email, validates email format,
   * enforces reasonable size limits.
   */
  strict: {
    requiredFields: ["displayName", "email"],
    validateEmail: true,
    maxDataSize: 64 * 1024,
    // 64KB
    maxStringLength: 1024
    // 1KB per string field
  },
  /**
   * Standard validation for most applications.
   *
   * Requires displayName, validates email if present.
   */
  standard: {
    requiredFields: ["displayName"],
    validateEmail: true,
    maxDataSize: 256 * 1024
    // 256KB
  },
  /**
   * Minimal validation for prototyping.
   *
   * Only requires displayName.
   */
  minimal: {
    requiredFields: ["displayName"]
  },
  /**
   * No validation - fully flexible.
   *
   * Use with caution - no constraints on profile data.
   */
  none: {}
};
function validateUserProfile(data, preset = validationPresets.minimal) {
  const errors = [];
  if (preset.requiredFields) {
    for (const field of preset.requiredFields) {
      if (!(field in data) || data[field] === null || data[field] === void 0) {
        errors.push(`Missing required field: ${field}`);
      } else if (typeof data[field] === "string" && data[field].trim() === "") {
        errors.push(`Required field cannot be empty: ${field}`);
      }
    }
  }
  if (preset.validateEmail && "email" in data && data.email) {
    const email = data.email;
    const parts = email.split("@");
    const isValidEmail = email.length <= 254 && // RFC 5321 max length
    email.includes("@") && !email.includes(" ") && // No spaces allowed
    !email.startsWith("@") && !email.endsWith("@") && parts.length === 2 && parts[0].length > 0 && // Local part must have content
    parts[1].length > 0 && // Domain part must have content
    parts[1].includes(".") && !parts[1].startsWith(".") && // Domain can't start with dot
    !parts[1].endsWith(".");
    if (!isValidEmail) {
      errors.push(`Invalid email format: ${email}`);
    }
  }
  if (preset.validatePhone && "phone" in data && data.phone) {
    const phone = data.phone;
    const phoneRegex = /^[+\d\s()-]{7,20}$/;
    if (!phoneRegex.test(phone)) {
      errors.push(`Invalid phone format: ${phone}`);
    }
  }
  if (preset.maxDataSize) {
    const dataSize = new TextEncoder().encode(JSON.stringify(data)).length;
    if (dataSize > preset.maxDataSize) {
      errors.push(
        `Profile data exceeds maximum size: ${dataSize} bytes > ${preset.maxDataSize} bytes`
      );
    }
  }
  if (preset.maxStringLength) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value.length > preset.maxStringLength) {
        errors.push(
          `Field '${key}' exceeds maximum length: ${value.length} > ${preset.maxStringLength}`
        );
      }
    }
  }
  if (preset.customValidator) {
    const customResult = preset.customValidator(data);
    if (!customResult.valid) {
      errors.push(...customResult.errors);
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function createUserProfile(data, defaults) {
  const merged = { ...defaults, ...data };
  if (!merged.displayName) {
    throw new Error("displayName is required for user profile");
  }
  return merged;
}

// src/index.ts
var Cortex = class _Cortex {
  client;
  syncWorker;
  resilienceLayer;
  llmConfig;
  embeddingConfig;
  authContext;
  /** Host credential seam for HTTP/private fetch transports; absent without a getter. */
  credentials;
  /**
   * Auto-configure embedding from environment variables.
   *
   * Uses a two-gate approach:
   * - Gate 1: An API key must be present (OPENAI_API_KEY)
   * - Gate 2: CORTEX_EMBEDDING must be explicitly set to 'true'
   *
   * This prevents accidental API costs - users must explicitly opt-in.
   *
   * @returns EmbeddingConfig if both gates pass, undefined otherwise
   */
  static autoConfigureEmbedding() {
    const embeddingEnabled = runtimeEnv.CORTEX_EMBEDDING === "true";
    if (!embeddingEnabled) {
      return void 0;
    }
    if (runtimeEnv.OPENAI_API_KEY) {
      return {
        provider: "openai",
        apiKey: runtimeEnv.OPENAI_API_KEY,
        model: "text-embedding-3-small"
      };
    }
    console.warn(
      "[Cortex] CORTEX_EMBEDDING=true but no API key found. Set OPENAI_API_KEY to enable automatic embedding generation."
    );
    return void 0;
  }
  /**
   * Auto-configure LLM from environment variables.
   *
   * Uses a two-gate approach:
   * - Gate 1: An API key must be present (OPENAI_API_KEY or ANTHROPIC_API_KEY)
   * - Gate 2: CORTEX_FACT_EXTRACTION must be explicitly set to 'true'
   *
   * This prevents accidental API costs - users must explicitly opt-in.
   *
   * @returns LLMConfig if both gates pass, undefined otherwise
   */
  static autoConfigureLLM() {
    const factExtractionEnabled = runtimeEnv.CORTEX_FACT_EXTRACTION === "true";
    if (!factExtractionEnabled) {
      return void 0;
    }
    if (runtimeEnv.OPENAI_API_KEY) {
      return {
        provider: "openai",
        apiKey: runtimeEnv.OPENAI_API_KEY
      };
    }
    if (runtimeEnv.ANTHROPIC_API_KEY) {
      return {
        provider: "anthropic",
        apiKey: runtimeEnv.ANTHROPIC_API_KEY
      };
    }
    console.warn(
      "[Cortex] CORTEX_FACT_EXTRACTION=true but no API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable automatic fact extraction."
    );
    return void 0;
  }
  /**
   * Auto-configure graph database from environment variables.
   *
   * Uses a two-gate approach:
   * - Gate 1: Connection credentials must be present (NEO4J_URI or MEMGRAPH_URI + auth)
   * - Gate 2: CORTEX_GRAPH_SYNC must be explicitly set to 'true'
   *
   * This prevents accidental graph connections - users must explicitly opt-in.
   *
   * @returns GraphConfig if both gates pass, undefined otherwise
   */
  static async autoConfigureGraph() {
    const graphSyncEnabled = runtimeEnv.CORTEX_GRAPH_SYNC === "true";
    if (!graphSyncEnabled) {
      return void 0;
    }
    const neo4jUri = runtimeEnv.NEO4J_URI;
    const memgraphUri = runtimeEnv.MEMGRAPH_URI;
    if (neo4jUri && memgraphUri) {
      console.warn(
        "[Cortex] Both NEO4J_URI and MEMGRAPH_URI set. Using Neo4j."
      );
    }
    if (neo4jUri) {
      try {
        const adapter = new CypherGraphAdapter();
        await adapter.connect({
          uri: neo4jUri,
          username: runtimeEnv.NEO4J_USERNAME || "neo4j",
          password: runtimeEnv.NEO4J_PASSWORD || ""
        });
        return { adapter, autoSync: true };
      } catch (error) {
        console.error(
          "[Cortex] Failed to connect to Neo4j:",
          error instanceof Error ? error.message : error
        );
        return void 0;
      }
    }
    if (memgraphUri) {
      try {
        const adapter = new CypherGraphAdapter();
        await adapter.connect({
          uri: memgraphUri,
          username: runtimeEnv.MEMGRAPH_USERNAME || "memgraph",
          password: runtimeEnv.MEMGRAPH_PASSWORD || ""
        });
        return { adapter, autoSync: true };
      } catch (error) {
        console.error(
          "[Cortex] Failed to connect to Memgraph:",
          error instanceof Error ? error.message : error
        );
        return void 0;
      }
    }
    console.warn(
      "[Cortex] CORTEX_GRAPH_SYNC=true but no graph database URI found. Set NEO4J_URI or MEMGRAPH_URI to enable graph sync."
    );
    return void 0;
  }
  /**
   * Create a Cortex instance with automatic configuration.
   *
   * This factory method enables async auto-configuration of:
   * - Graph database (if CORTEX_GRAPH_SYNC=true and connection credentials set)
   * - LLM for fact extraction (if CORTEX_FACT_EXTRACTION=true and API key set)
   *
   * Use this instead of `new Cortex()` when you want environment-based auto-config.
   *
   * @example
   * ```typescript
   * // With env vars: CORTEX_GRAPH_SYNC=true, NEO4J_URI=bolt://localhost:7687
   * const cortex = await Cortex.create({ convexUrl: process.env.CONVEX_URL! });
   * // Graph is automatically connected and sync worker started
   * ```
   *
   * @param config - Cortex configuration (explicit config takes priority over env vars)
   * @returns Promise<Cortex> - Fully configured Cortex instance
   */
  static async create(config) {
    const graphConfig = config.graph ?? await _Cortex.autoConfigureGraph();
    return new _Cortex({
      ...config,
      graph: graphConfig
    });
  }
  // Layer 1a: Conversations
  conversations;
  // Layer 1b: Immutable Store
  immutable;
  // Layer 1c: Mutable Store
  mutable;
  // Layer 2: Vector Memory
  vector;
  // Layer 3: Facts Store
  facts;
  // Layer 4: Context Chains
  contexts;
  // Layer 4: Memory Spaces Registry
  memorySpaces;
  // Layer 4: Memory Convenience API
  memory;
  // Coordination: User Management
  users;
  // Coordination: Agent Registry (Optional)
  agents;
  // Governance: Data Retention & Compliance
  governance;
  // A2A: Agent-to-Agent Communication
  a2a;
  // Sessions: Native Session Management
  sessions;
  // Artifacts - Versioned Document Management
  artifacts;
  // Attachments - Multi-modal File Storage
  attachments;
  constructor(config) {
    this.credentials = config.fetchAuthToken === void 0 ? void 0 : new HostCredentials(config.fetchAuthToken, config.onAuthError);
    this.client = new import_browser.ConvexClient(config.convexUrl);
    if (this.credentials) {
      this.credentials.bindReactiveClient(this.client);
    }
    this.llmConfig = config.llm ?? _Cortex.autoConfigureLLM();
    this.embeddingConfig = config.embedding ?? _Cortex.autoConfigureEmbedding();
    this.authContext = config.auth;
    this.resilienceLayer = new ResilienceLayer(
      config.resilience ?? ResiliencePresets.default
    );
    const graphAdapter = config.graph?.adapter;
    this.conversations = new ConversationsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.immutable = new ImmutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.mutable = new MutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.vector = new VectorAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.facts = new FactsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.contexts = new ContextsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
      // Pass authContext for multi-tenancy
    );
    this.memorySpaces = new MemorySpacesAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.users = new UsersAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.agents = new AgentsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.governance = new GovernanceAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer
    );
    this.a2a = new A2AAPI(this.client, graphAdapter, this.resilienceLayer);
    this.sessions = new SessionsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.artifacts = new ArtifactsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext
    );
    this.attachments = new AttachmentsAPI(
      this.client,
      this.resilienceLayer,
      this.authContext
    );
    this.memory = new MemoryAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      {
        memorySpaces: this.memorySpaces,
        users: this.users,
        agents: this.agents,
        llm: this.llmConfig,
        embedding: this.embeddingConfig,
        // Pass embedding config for auto semantic search
        authContext: this.authContext
        // Pass authContext for tenant isolation
      }
    );
    if (config.graph?.autoSync && graphAdapter) {
      this.syncWorker = new GraphSyncWorker(
        this.client,
        graphAdapter,
        config.graph.syncWorkerOptions
      );
      void this.syncWorker.start().catch((error) => {
        console.error("Failed to start graph sync worker:", error);
      });
    }
  }
  /**
   * Get the caller metadata and scope selectors (if configured).
   *
   * Returns the AuthContext that was passed during initialization.
   * These labels do not establish verified identity or trusted access grants.
   *
   * @example
   * ```typescript
   * const cortex = new Cortex({
   *   convexUrl: process.env.CONVEX_URL!,
   *   auth: createAuthContext({ userId: 'user-123', tenantId: 'tenant-456' })
   * });
   *
   * console.log(cortex.auth?.userId); // 'user-123'
   * console.log(cortex.auth?.tenantId); // 'tenant-456'
   * ```
   */
  get auth() {
    return this.authContext;
  }
  /**
   * Get the underlying Convex client (for testing and advanced use cases)
   */
  getClient() {
    return this.client;
  }
  /**
   * Get graph sync worker (if running)
   */
  getGraphSyncWorker() {
    return this.syncWorker;
  }
  /**
   * Get the resilience layer for monitoring and manual control
   *
   * @example
   * ```typescript
   * // Check system health
   * const isHealthy = cortex.getResilience().isHealthy();
   *
   * // Get current metrics
   * const metrics = cortex.getResilience().getMetrics();
   * console.log('Circuit state:', metrics.circuitBreaker.state);
   * console.log('Queue size:', metrics.queue.total);
   *
   * // Reset all resilience state (use with caution)
   * cortex.getResilience().reset();
   * ```
   */
  getResilience() {
    return this.resilienceLayer;
  }
  /**
   * Get current resilience metrics
   *
   * Convenience method equivalent to `getResilience().getMetrics()`
   */
  getResilienceMetrics() {
    return this.resilienceLayer.getMetrics();
  }
  /**
   * Check if the SDK is healthy and accepting requests
   *
   * Returns false if circuit breaker is open
   */
  isHealthy() {
    return this.resilienceLayer.isHealthy();
  }
  /**
   * Close the connection to Convex and stop all workers
   */
  close() {
    if (this.syncWorker) {
      this.syncWorker.stop();
    }
    this.resilienceLayer.stopQueueProcessor();
    void this.client.close();
  }
  /**
   * Gracefully shutdown the SDK
   *
   * Waits for pending operations to complete before closing.
   *
   * @param timeoutMs Maximum time to drain pending operations (default: 30000ms)
   */
  async shutdown(timeoutMs = 3e4) {
    if (this.syncWorker) {
      this.syncWorker.stop();
    }
    try {
      await this.resilienceLayer.shutdown(timeoutMs);
    } finally {
      await this.client.close();
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  A2AValidationError,
  AcquireTimeoutError,
  AgentRegistryCapabilityError,
  AgentRegistryCommittedResultError,
  AgentRegistryWriteReceiptError,
  ArtifactValidationError,
  AssetCapabilityUnavailableError,
  AttachmentValidationError,
  AuthValidationError,
  CircuitBreaker,
  CircuitOpenError,
  Cortex,
  CypherGraphAdapter,
  GovernanceCapabilityError,
  GovernanceValidationError,
  GraphSyncWorker,
  HostCredentials,
  MemoryValidationError,
  OPERATION_PRIORITIES,
  PriorityQueue,
  QueueFullError,
  RateLimitExceededError,
  ResilienceLayer,
  ResiliencePresets,
  Semaphore,
  SessionCapabilityError,
  SessionValidationError,
  SessionsAPI,
  TokenBucket,
  UserProfileWriteReceiptError,
  UserValidationError,
  buildShareUrl,
  createAuthContext,
  createUserProfile,
  extractShareId,
  getPresetForPlan,
  getPriority,
  isCritical,
  validateAuthContext,
  validateUserProfile,
  validationPresets
});
