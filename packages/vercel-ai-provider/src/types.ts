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

  /**
   * Belief Revision configuration (v0.24.0+)
   *
   * Automatically handles fact updates, supersessions, and deduplication.
   * When enabled, new facts are checked against existing facts to determine
   * if they should CREATE, UPDATE, SUPERSEDE, or be skipped as duplicates.
   *
   * Set to `false` to disable belief revision entirely.
   *
   * @example
   * ```typescript
   * beliefRevision: {
   *   enabled: true,      // Enable belief revision (default: true)
   *   slotMatching: true, // Enable slot-based matching (default: true)
   *   llmResolution: true // Enable LLM conflict resolution (default: true)
   * }
   * ```
   */
  beliefRevision?:
    | {
        /** Enable belief revision (default: true when configured) */
        enabled?: boolean;
        /** Enable slot-based matching for fast conflict detection (default: true) */
        slotMatching?: boolean;
        /** Enable LLM-based conflict resolution for nuanced decisions (default: true) */
        llmResolution?: boolean;
      }
    | false;

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
 * Sanitize a log argument to prevent log injection attacks.
 * Removes control characters and escapes newlines.
 */
function sanitizeLogArg(arg: unknown): unknown {
  if (typeof arg === "string") {
    // Remove control characters (except tab, newline which we escape)
    // and escape newlines to prevent log forging
    return arg
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars
      .replace(/\r?\n/g, "\\n"); // Escape newlines
  }
  if (arg instanceof Error) {
    // Preserve Error objects but sanitize their message
    const sanitizedMessage =
      typeof arg.message === "string"
        ? arg.message
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            .replace(/\r?\n/g, "\\n")
        : arg.message;
    // Return a new error-like object with sanitized message for logging
    return `${arg.name}: ${sanitizedMessage}`;
  }
  // For objects/arrays, let console handle them (they're stringified safely)
  return arg;
}

/**
 * Create a default logger
 */
export function createLogger(debug: boolean = false): Logger {
  const prefix = "[Cortex Memory]";

  if (debug) {
    return {
      debug: (...args) =>
        console.debug(prefix, ...args.map((a) => sanitizeLogArg(a))),
      info: (...args) =>
        console.info(prefix, ...args.map((a) => sanitizeLogArg(a))),
      warn: (...args) =>
        console.warn(prefix, ...args.map((a) => sanitizeLogArg(a))),
      error: (...args) =>
        console.error(prefix, ...args.map((a) => sanitizeLogArg(a))),
    };
  }

  // Silent logger when debug is false (except errors)
  return {
    debug: () => {},
    info: () => {},
    warn: (...args) =>
      console.warn(prefix, ...args.map((a) => sanitizeLogArg(a))),
    error: (...args) =>
      console.error(prefix, ...args.map((a) => sanitizeLogArg(a))),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer Observation Types (re-exported from core SDK)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Re-export orchestration types from core SDK for backward compatibility
// The core SDK now provides integration-agnostic observer infrastructure
export type {
  MemoryLayer,
  LayerStatus,
  RevisionAction,
  LayerEvent,
  OrchestrationSummary,
  OrchestrationObserver,
} from "@cortexmemory/sdk";

/**
 * Observer for memory layer orchestration (Vercel provider alias)
 *
 * This is an alias for OrchestrationObserver from the core SDK.
 * Maintained for backward compatibility with existing Vercel provider users.
 *
 * @deprecated Use OrchestrationObserver from @cortexmemory/sdk instead
 */
export type LayerObserver = import("@cortexmemory/sdk").OrchestrationObserver;
