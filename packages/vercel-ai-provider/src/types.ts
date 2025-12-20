/**
 * Type definitions for Cortex Memory Provider for Vercel AI SDK
 */

// Dynamic types to support AI SDK v3, v4, and v5
import type {
  MemoryEntry,
  RememberOptions,
  RememberStreamResult,
} from "@cortexmemory/sdk";

/**
 * Supported LLM providers
 */
export type SupportedProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "custom";

/**
 * Context injection strategy
 */
export type ContextInjectionStrategy = "system" | "user" | "custom";

/**
 * Memory search options for retrieval
 */
export interface MemorySearchOptions {
  /** Maximum number of memories to retrieve (default: 5) */
  limit?: number;

  /** Minimum relevance score (0-1, default: 0.7) */
  minScore?: number;

  /** Filter by tags */
  tags?: string[];

  /** Filter by source type */
  sourceType?: "conversation" | "system" | "tool" | "a2a";

  /** Minimum importance score (0-100) */
  minImportance?: number;
}

/**
 * Configuration for the Cortex Memory Provider
 */
export interface CortexMemoryConfig {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cortex Configuration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Convex deployment URL */
  convexUrl: string;

  /** Memory Space ID for isolation */
  memorySpaceId: string;

  /**
   * Agent ID - REQUIRED for user-agent conversations (SDK v0.17.0+)
   *
   * Every conversation requires an agent participant. This ID identifies
   * which agent is participating in the conversation.
   *
   * @example 'quickstart-assistant', 'support-bot', 'my-agent-v1'
   */
  agentId: string;

  /**
   * Agent display name (optional)
   *
   * Human-readable name for the agent, used in logging and debugging.
   * Defaults to agentId if not provided.
   */
  agentName?: string;

  /** User ID (or function returning user ID) */
  userId: string | (() => string | Promise<string>);

  /** User name (optional, defaults to 'User') */
  userName?: string;

  /** Conversation ID (or function returning conversation ID) */
  conversationId?: string | (() => string);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Retrieval Settings
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Number of memories to search for (default: 5) */
  memorySearchLimit?: number;

  /** Minimum relevance score for memory retrieval (default: 0.7) */
  minMemoryRelevance?: number;

  /** Enable automatic memory search (default: true) */
  enableMemorySearch?: boolean;

  /** Enable automatic memory storage (default: true) */
  enableMemoryStorage?: boolean;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Context Injection
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** How to inject memory context (default: 'system') */
  contextInjectionStrategy?: ContextInjectionStrategy;

  /** Custom context builder function */
  customContextBuilder?: (memories: MemoryEntry[]) => string;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Embedding Configuration (Optional)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Embedding provider for memory search */
  embeddingProvider?: {
    generate: (text: string) => Promise<number[]>;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Advanced Cortex Features
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Enable fact extraction (default: false)
   *
   * When enabled, facts are automatically extracted from conversations.
   * Can also be auto-enabled via CORTEX_FACT_EXTRACTION=true env var.
   */
  enableFactExtraction?: boolean;

  /**
   * Fact extraction configuration
   *
   * Provides fine-grained control over automatic fact extraction.
   * Uses environment variables by default:
   * - CORTEX_FACT_EXTRACTION=true to enable
   * - CORTEX_FACT_EXTRACTION_MODEL=gpt-4o to override model
   */
  factExtractionConfig?: {
    /** Override the fact extraction model (default: uses CORTEX_FACT_EXTRACTION_MODEL or 'gpt-4o-mini') */
    model?: string;
    /** Provider to use ('openai' | 'anthropic', default: auto-detected from API key) */
    provider?: "openai" | "anthropic";
  };

  /** Fact extraction function (if custom) */
  extractFacts?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<
    Array<{
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
    }>
  >;

  /**
   * Enable graph memory sync (default: false)
   *
   * When enabled, memories are synced to a graph database (Neo4j/Memgraph).
   * Can also be auto-enabled via CORTEX_GRAPH_SYNC=true env var.
   * Requires graph database connection configured via env vars:
   * - NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
   * - or MEMGRAPH_URI, MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD
   */
  enableGraphMemory?: boolean;

  /**
   * Graph database configuration
   *
   * Override the default graph database connection settings.
   * If not provided, uses environment variables for auto-configuration.
   */
  graphConfig?: {
    /** Override the graph database URI */
    uri?: string;
    /** Override the graph database username */
    username?: string;
    /** Override the graph database password */
    password?: string;
    /** Graph database type ('neo4j' | 'memgraph', default: auto-detected) */
    type?: "neo4j" | "memgraph";
  };

  /** Hive Mode configuration */
  hiveMode?: {
    /** Participant ID (which agent/tool is this) */
    participantId: string;
  };

  /** Default importance for memories (0-100, default: 50) */
  defaultImportance?: number;

  /** Default tags for memories */
  defaultTags?: string[];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Enhancements (v0.2.0+)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Streaming options for enhanced streaming capabilities */
  streamingOptions?: {
    /** Enable progressive storage during streaming (default: false) */
    storePartialResponse?: boolean;
    /** Interval for partial updates in ms (default: 3000) */
    partialResponseInterval?: number;

    /** Enable progressive fact extraction during streaming (default: false) */
    progressiveFactExtraction?: boolean;
    /** Extract facts every N characters (default: 500) */
    factExtractionThreshold?: number;

    /** Enable progressive graph sync during streaming (default: false) */
    progressiveGraphSync?: boolean;
    /** Graph sync interval in ms (default: 5000) */
    graphSyncInterval?: number;

    /** How to handle partial failures */
    partialFailureHandling?:
      | "store-partial"
      | "rollback"
      | "retry"
      | "best-effort";
    /** Maximum retry attempts (default: 3) */
    maxRetries?: number;
    /** Generate resume tokens for interrupted streams (default: false) */
    generateResumeToken?: boolean;
    /** Stream timeout in ms (default: 30000) */
    streamTimeout?: number;

    /** Maximum response length in characters */
    maxResponseLength?: number;
    /** Enable adaptive processing based on stream characteristics (default: false) */
    enableAdaptiveProcessing?: boolean;
  };

  /** Streaming hooks for real-time monitoring */
  streamingHooks?: {
    /** Called for each chunk received */
    onChunk?: (event: {
      chunk: string;
      chunkNumber: number;
      accumulated: string;
      timestamp: number;
      estimatedTokens: number;
    }) => void | Promise<void>;
    /** Called periodically with progress updates */
    onProgress?: (event: {
      bytesProcessed: number;
      chunks: number;
      elapsedMs: number;
      estimatedCompletion?: number;
      currentPhase?:
        | "streaming"
        | "fact-extraction"
        | "storage"
        | "finalization";
    }) => void | Promise<void>;
    /** Called when stream errors occur */
    onError?: (error: {
      message: string;
      code?: string;
      phase?: string;
      recoverable?: boolean;
      resumeToken?: string;
    }) => void | Promise<void>;
    /** Called when stream completes successfully */
    onComplete?: (event: {
      fullResponse: string;
      totalChunks: number;
      durationMs: number;
      factsExtracted: number;
    }) => void | Promise<void>;
  };

  /** Enable automatic metrics collection (default: true) */
  enableStreamMetrics?: boolean;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer Observation (for visualization/debugging)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Layer observation hooks for real-time visualization
   *
   * These callbacks are invoked as data flows through the Cortex
   * memory orchestration layers, enabling real-time UI updates.
   */
  layerObserver?: LayerObserver;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Debug and Logging
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

/**
 * Options for manual memory operations
 */
export interface ManualMemorySearchOptions extends MemorySearchOptions {
  /** User ID to filter by */
  userId?: string;

  /** Custom embedding for search */
  embedding?: number[];
}

export interface ManualRememberOptions {
  /** Custom conversation ID */
  conversationId?: string;

  /** Generate embedding for the memory */
  generateEmbedding?: (text: string) => Promise<number[]>;

  /** Extract facts from the conversation */
  extractFacts?: (
    userMsg: string,
    agentResp: string,
  ) => Promise<
    Array<{
      fact: string;
      factType: string;
      confidence: number;
      subject?: string;
      predicate?: string;
      object?: string;
    }>
  >;

  /** Sync to graph (if configured) */
  syncToGraph?: boolean;
}

export interface ManualClearOptions {
  /** User ID to filter by */
  userId?: string;

  /** Source type to filter by */
  sourceType?: "conversation" | "system" | "tool" | "a2a";

  /** Confirm deletion (safety check) */
  confirm?: boolean;
}

/**
 * Cortex Memory Model - Augmented language model with memory capabilities
 *
 * This is the main export from createCortexMemory()
 */
export interface CortexMemoryModel {
  /**
   * Wrap a language model with memory capabilities
   *
   * @param underlyingModel - Language model to wrap (from @ai-sdk/*)
   * @param settings - Optional model settings
   * @returns Augmented language model with automatic memory
   *
   * @example
   * ```typescript
   * import { openai } from '@ai-sdk/openai';
   * const model = cortexMemory(openai('gpt-4.1-nano'));
   *
   * const result = await streamText({
   *   model,
   *   messages: [{ role: 'user', content: 'What did I tell you about my name?' }],
   * });
   * ```
   */
  (underlyingModel: any, settings?: Record<string, unknown>): any;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Manual Memory Control Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Manually search memories
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching memories
   *
   * @example
   * ```typescript
   * const memories = await cortexMemory.search('favorite color', {
   *   limit: 10,
   *   minScore: 0.8,
   * });
   * ```
   */
  search: (
    query: string,
    options?: ManualMemorySearchOptions,
  ) => Promise<MemoryEntry[]>;

  /**
   * Manually store a conversation
   *
   * @param userMessage - User's message
   * @param agentResponse - Agent's response
   * @param options - Remember options
   * @returns Memory result
   *
   * @example
   * ```typescript
   * await cortexMemory.remember(
   *   'My name is Alice',
   *   'Nice to meet you, Alice!',
   *   { conversationId: 'conv-123' }
   * );
   * ```
   */
  remember: (
    userMessage: string,
    agentResponse: string,
    options?: ManualRememberOptions,
  ) => Promise<void>;

  /**
   * Get all memories (paginated)
   *
   * @param options - Filter options
   * @returns All memories
   *
   * @example
   * ```typescript
   * const all = await cortexMemory.getMemories({ limit: 100 });
   * ```
   */
  getMemories: (options?: { limit?: number }) => Promise<MemoryEntry[]>;

  /**
   * Clear memories
   *
   * @param options - Clear options
   * @returns Number of memories deleted
   *
   * @example
   * ```typescript
   * await cortexMemory.clearMemories({ userId: 'user-123', confirm: true });
   * ```
   */
  clearMemories: (options?: ManualClearOptions) => Promise<number>;

  /**
   * Get current configuration
   *
   * @returns Current configuration (read-only)
   */
  getConfig: () => Readonly<CortexMemoryConfig>;
}

/**
 * Re-export AI SDK types for convenience
 */
// Prompt types handled dynamically

/**
 * Internal logger interface
 */
export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

/**
 * Create a default logger
 */
export function createLogger(debug: boolean = false): Logger {
  const prefix = "[Cortex Memory]";

  if (debug) {
    return {
      debug: (...args) => console.debug(prefix, ...args),
      info: (...args) => console.info(prefix, ...args),
      warn: (...args) => console.warn(prefix, ...args),
      error: (...args) => console.error(prefix, ...args),
    };
  }

  // Silent logger when debug is false (except errors)
  return {
    debug: () => {},
    info: () => {},
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer Observation Types (for visualization)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Memory orchestration layer types
 */
export type MemoryLayer =
  | "memorySpace"
  | "user"
  | "agent"
  | "conversation"
  | "vector"
  | "facts"
  | "graph";

/**
 * Layer status during orchestration
 */
export type LayerStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "error"
  | "skipped";

/**
 * Event emitted when a layer's status changes
 */
export interface LayerEvent {
  /** Which layer this event is for */
  layer: MemoryLayer;

  /** Current status of the layer */
  status: LayerStatus;

  /** Timestamp when this status was set */
  timestamp: number;

  /** Time elapsed since orchestration started (ms) */
  latencyMs?: number;

  /** Data stored in this layer (if complete) */
  data?: {
    /** ID of the stored record */
    id?: string;
    /** Summary or preview of the data */
    preview?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
  };

  /** Error details (if error status) */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Summary of the full orchestration flow
 */
export interface OrchestrationSummary {
  /** Unique ID for this orchestration run */
  orchestrationId: string;

  /** Total time for all layers (ms) */
  totalLatencyMs: number;

  /** Status of each layer */
  layers: Record<MemoryLayer, LayerEvent>;

  /** IDs of records created */
  createdIds: {
    conversationId?: string;
    memoryIds?: string[];
    factIds?: string[];
  };
}

/**
 * Observer for memory layer orchestration
 *
 * Used by the quickstart demo to visualize data flowing
 * through the Cortex memory system in real-time.
 */
export interface LayerObserver {
  /**
   * Called when a layer's status changes
   */
  onLayerUpdate?: (event: LayerEvent) => void | Promise<void>;

  /**
   * Called when orchestration starts
   */
  onOrchestrationStart?: (orchestrationId: string) => void | Promise<void>;

  /**
   * Called when orchestration completes (all layers done)
   */
  onOrchestrationComplete?: (
    summary: OrchestrationSummary,
  ) => void | Promise<void>;
}
