/**
 * Streaming-specific type definitions for RememberStream API
 *
 * Comprehensive types for progressive streaming, real-time processing,
 * error recovery, and advanced streaming features.
 */

import type { RememberResult } from "./index";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stream Hooks & Events
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Event emitted for each chunk received from the stream
 */
export interface ChunkEvent {
  chunk: string;
  chunkNumber: number;
  accumulated: string;
  timestamp: number;
  estimatedTokens: number;
}

/**
 * Progress update during streaming
 */
export interface ProgressEvent {
  bytesProcessed: number;
  chunks: number;
  elapsedMs: number;
  estimatedCompletion?: number;
  currentPhase?: "streaming" | "fact-extraction" | "storage" | "finalization";
}

/**
 * Event emitted when stream completes successfully
 */
export interface StreamCompleteEvent {
  fullResponse: string;
  totalChunks: number;
  durationMs: number;
  factsExtracted: number;
}

/**
 * Hooks for stream lifecycle events
 */
export interface StreamHooks {
  onChunk?: (event: ChunkEvent) => void | Promise<void>;
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  onError?: (error: StreamError) => void | Promise<void>;
  onComplete?: (event: StreamCompleteEvent) => void | Promise<void>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stream Metrics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Comprehensive streaming performance metrics
 */
export interface StreamMetrics {
  // Timing
  startTime: number;
  firstChunkLatency: number;
  streamDurationMs: number;

  // Throughput
  totalChunks: number;
  totalBytes: number;
  averageChunkSize: number;
  chunksPerSecond: number;

  // Processing
  factsExtracted: number;
  partialUpdates: number;
  errorCount: number;
  retryCount: number;

  // Estimates
  estimatedTokens: number;
  estimatedCost?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Progressive Storage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Update record for partial storage
 */
export interface PartialUpdate {
  timestamp: number;
  memoryId: string;
  contentLength: number;
  chunkNumber: number;
}

/**
 * Progressive fact extraction result
 */
export interface ProgressiveFact {
  factId: string;
  extractedAtChunk: number;
  confidence: number;
  fact: string;
  deduped?: boolean;
}

/**
 * Graph sync event during streaming
 */
export interface GraphSyncEvent {
  timestamp: number;
  eventType:
    | "node-created"
    | "node-updated"
    | "relationship-created"
    | "finalized";
  nodeId?: string;
  details?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Error Handling & Recovery
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Failure handling strategy
 */
export type FailureStrategy =
  | "store-partial"
  | "rollback"
  | "retry"
  | "best-effort";

/**
 * Error context for debugging
 */
export interface ErrorContext {
  phase:
    | "initialization"
    | "streaming"
    | "fact-extraction"
    | "storage"
    | "finalization";
  chunkNumber: number;
  bytesProcessed: number;
  partialMemoryId?: string;
  lastSuccessfulUpdate?: number;
}

/**
 * Stream error with recovery information
 */
export interface StreamError {
  code: string;
  message: string;
  recoverable: boolean;
  partialDataSaved: boolean;
  resumeToken?: string;
  context: ErrorContext;
  originalError?: Error;
}

/**
 * Recovery options for stream errors
 */
export interface RecoveryOptions {
  strategy: FailureStrategy;
  maxRetries?: number;
  retryDelay?: number;
  preservePartialData?: boolean;
  notifyOnRecovery?: boolean;
}

/**
 * Result of recovery attempt
 */
export interface RecoveryResult {
  success: boolean;
  strategy: FailureStrategy;
  partialMemoryId?: string;
  resumeToken?: string;
  error?: Error;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Resume Capability
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Context for resuming interrupted streams
 */
export interface ResumeContext {
  resumeToken: string;
  lastProcessedChunk: number;
  accumulatedContent: string;
  partialMemoryId: string;
  factsExtracted: string[];
  timestamp: number;
  checksum: string;
}

/**
 * Partial memory result for recovery
 */
export interface PartialMemoryResult {
  memoryId: string;
  content: string;
  isPartial: true;
  timestamp: number;
  resumeToken?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Chunking Strategies
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Strategy for breaking content into chunks
 */
export type ChunkStrategy =
  | "token"
  | "sentence"
  | "paragraph"
  | "fixed"
  | "semantic";

/**
 * Configuration for content chunking
 */
export interface ChunkingConfig {
  strategy: ChunkStrategy;
  maxChunkSize: number;
  overlapSize?: number;
  preserveBoundaries?: boolean;
}

/**
 * Metadata for a content chunk
 */
export interface ChunkMetadata {
  parentMemoryId?: string;
  chunkIndex: number;
  totalChunks?: number;
  startOffset: number;
  endOffset: number;
  hasOverlap: boolean;
}

/**
 * A single content chunk
 */
export interface ContentChunk {
  content: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  metadata: ChunkMetadata;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Adaptive Processing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Stream type classification
 */
export type StreamType = "fast" | "slow" | "bursty" | "steady";

/**
 * Processing strategy for adaptive behavior
 */
export interface ProcessingStrategy {
  bufferSize: number;
  factExtractionFrequency: number;
  partialUpdateInterval: number;
  enablePredictiveLoading: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory Efficiency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Options for memory-efficient streaming
 */
export interface MemoryEfficiencyOptions {
  maxBufferSize: number;
  useStreaming: boolean;
  incrementalEmbeddings: boolean;
  lazyFactStorage: boolean;
  compressPartialStorage: boolean;
}

/**
 * Embedding merge strategy for chunked content
 */
export type EmbeddingMergeStrategy = "concatenate" | "average" | "hierarchical";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Streaming Options
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Comprehensive streaming options extending RememberOptions
 */
export interface StreamingOptions {
  // Graph sync
  syncToGraph?: boolean;
  progressiveGraphSync?: boolean;
  graphSyncInterval?: number;

  // Belief revision (v0.24.0+)
  // Controls whether extracted facts go through the belief revision pipeline
  // Default: true if LLM is configured (batteries-included)
  beliefRevision?: boolean;

  // Progressive storage
  storePartialResponse?: boolean;
  partialResponseInterval?: number;

  // Progressive fact extraction
  progressiveFactExtraction?: boolean;
  factExtractionThreshold?: number;

  // Chunking
  chunkSize?: number;
  chunkingStrategy?: ChunkStrategy;
  maxSingleMemorySize?: number;

  // Hooks
  hooks?: StreamHooks;

  // Error handling
  partialFailureHandling?: FailureStrategy;
  maxRetries?: number;
  retryDelay?: number;
  generateResumeToken?: boolean;
  streamTimeout?: number;

  // Memory efficiency
  maxBufferSize?: number;
  incrementalEmbeddings?: boolean;
  embeddingMergeStrategy?: EmbeddingMergeStrategy;

  // Adaptive processing
  enableAdaptiveProcessing?: boolean;

  // Advanced
  maxResponseLength?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stream Context
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Internal streaming context for processing
 */
export interface StreamContext {
  memorySpaceId: string;
  conversationId: string;
  userId: string;
  userName: string;

  // State
  accumulatedText: string;
  chunkCount: number;
  estimatedTokens: number;
  elapsedMs: number;

  // Processing
  partialMemoryId?: string;
  extractedFactIds: string[];
  graphNodeId?: string;

  // Metrics
  metrics: StreamMetrics;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enhanced Result Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Performance insights and recommendations
 */
export interface PerformanceInsights {
  bottlenecks: string[];
  recommendations: string[];
  costEstimate?: number;
}

/**
 * Progressive processing results
 */
export interface ProgressiveProcessing {
  factsExtractedDuringStream: ProgressiveFact[];
  partialStorageHistory: PartialUpdate[];
  graphSyncEvents?: GraphSyncEvent[];
}

/**
 * Enhanced result from rememberStream with comprehensive metadata
 */
export interface EnhancedRememberStreamResult extends RememberResult {
  // Core data (existing)
  fullResponse: string;

  // Stream metrics
  streamMetrics: StreamMetrics;

  // Progressive processing results
  progressiveProcessing?: ProgressiveProcessing;

  // Error/recovery info
  errors?: StreamError[];
  recovered?: boolean;
  resumeToken?: string;

  // Performance insights
  performance?: PerformanceInsights;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enhanced Parameters
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Enhanced parameters for rememberStream
 */
export interface EnhancedRememberStreamParams {
  memorySpaceId: string;
  participantId?: string;
  conversationId: string;
  userMessage: string;
  responseStream: ReadableStream<string> | AsyncIterable<string>;
  userId: string;
  userName: string;

  // Optional extraction
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;

  // Optional embedding
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Optional fact extraction
  extractFacts?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<Array<{
    fact: string;
    factType:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "observation"
      | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
  }> | null>;

  // Cloud Mode options
  autoEmbed?: boolean;
  autoSummarize?: boolean;

  // Metadata
  importance?: number;
  tags?: string[];

  // Resume support
  resumeFrom?: ResumeContext;

  // Stream management
  streamTimeout?: number;
  maxResponseLength?: number;

  // Chunked processing
  chunkProcessor?: (
    chunk: string,
    context: StreamContext,
  ) => Promise<ProcessedChunk>;

  // Progressive embeddings
  embedChunks?: boolean;
  mergeStrategy?: EmbeddingMergeStrategy;

  // Error recovery
  partialFailureHandling?: FailureStrategy;
  resumeToken?: string;
}

/**
 * Processed chunk result
 */
export interface ProcessedChunk {
  content: string;
  shouldStore: boolean;
  extractedFacts?: Array<{
    fact: string;
    factType: string;
    confidence: number;
    tags?: string[];
  }>;
  metadata?: Record<string, unknown>;
}
