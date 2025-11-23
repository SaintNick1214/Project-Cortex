/**
 * Type definitions for Cortex Memory Provider for Vercel AI SDK
 */

// Dynamic types to support AI SDK v3, v4, and v5
import type { MemoryEntry, RememberOptions } from "@cortexmemory/sdk";

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

  /** Enable fact extraction (default: false) */
  enableFactExtraction?: boolean;

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
        | "custom";
      subject?: string;
      predicate?: string;
      object?: string;
      confidence: number;
      tags?: string[];
    }>
  >;

  /** Enable graph memory sync (default: false, requires graph adapter in Cortex) */
  enableGraphMemory?: boolean;

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
   * const model = cortexMemory(openai('gpt-4'));
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
