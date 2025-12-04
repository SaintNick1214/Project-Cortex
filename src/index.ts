/**
 * Cortex SDK - Main Entry Point
 *
 * Open-source SDK for AI agents with persistent memory
 * Built on Convex for reactive TypeScript queries
 */

import { ConvexClient } from "convex/browser";
import { ConversationsAPI } from "./conversations";
import { ImmutableAPI } from "./immutable";
import { MutableAPI } from "./mutable";
import { VectorAPI } from "./vector";
import { MemoryAPI } from "./memory";
import { FactsAPI } from "./facts";
import { MemorySpacesAPI } from "./memorySpaces";
import { ContextsAPI } from "./contexts";
import { UsersAPI } from "./users";
import { AgentsAPI } from "./agents";
import { GovernanceAPI } from "./governance";
import { A2AAPI } from "./a2a";
import type { GraphAdapter } from "./graph/types";
import {
  GraphSyncWorker,
  type GraphSyncWorkerOptions,
} from "./graph/worker/GraphSyncWorker";
import {
  ResilienceLayer,
  ResiliencePresets,
  type ResilienceConfig,
  type ResilienceMetrics,
} from "./resilience";

/**
 * Graph database configuration
 */
export interface GraphConfig {
  /** Pre-configured graph adapter */
  adapter: GraphAdapter;

  /** Enable orphan cleanup on deletes (default: true) */
  orphanCleanup?: boolean;

  /** Auto-start sync worker for real-time synchronization (default: false) */
  autoSync?: boolean;

  /** Sync worker configuration options */
  syncWorkerOptions?: GraphSyncWorkerOptions;
}

/**
 * LLM provider type
 */
export type LLMProvider = "openai" | "anthropic" | "custom";

/**
 * LLM configuration for auto fact extraction
 *
 * When configured, enables automatic fact extraction from conversations
 * during remember() operations (unless explicitly skipped via skipLayers).
 */
export interface LLMConfig {
  /** LLM provider */
  provider: LLMProvider;

  /** API key for the provider */
  apiKey: string;

  /**
   * Model to use for fact extraction.
   * Default: 'gpt-4o-mini' for OpenAI, 'claude-3-haiku-20240307' for Anthropic
   */
  model?: string;

  /**
   * Custom extraction function (for 'custom' provider or to override default behavior).
   * If provided, this will be used instead of the built-in extraction.
   */
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

  /**
   * Maximum tokens for fact extraction response.
   * Default: 1000
   */
  maxTokens?: number;

  /**
   * Temperature for fact extraction.
   * Default: 0.1 (low for consistent extraction)
   */
  temperature?: number;
}

/**
 * Cortex SDK configuration
 */
export interface CortexConfig {
  /** Convex deployment URL */
  convexUrl: string;

  /** Optional graph database integration */
  graph?: GraphConfig;

  /**
   * Optional LLM configuration for auto fact extraction.
   *
   * When configured, enables automatic fact extraction from conversations
   * during remember() operations (unless explicitly skipped via skipLayers).
   *
   * @example
   * ```typescript
   * llm: {
   *   provider: 'openai',
   *   apiKey: process.env.OPENAI_API_KEY,
   *   model: 'gpt-4o-mini',
   * }
   * ```
   */
  llm?: LLMConfig;

  /**
   * Resilience/overload protection configuration
   *
   * Provides rate limiting, concurrency control, circuit breaking,
   * and priority queuing for burst traffic handling.
   *
   * @default ResiliencePresets.default (enabled with balanced settings)
   *
   * @example
   * ```typescript
   * // Use preset
   * resilience: ResiliencePresets.hiveMode
   *
   * // Custom configuration
   * resilience: {
   *   enabled: true,
   *   rateLimiter: { bucketSize: 200, refillRate: 100 },
   *   circuitBreaker: { failureThreshold: 10 },
   * }
   *
   * // Disable resilience
   * resilience: { enabled: false }
   * ```
   */
  resilience?: ResilienceConfig;
}

export class Cortex {
  private readonly client: ConvexClient;
  private syncWorker?: GraphSyncWorker;
  private readonly resilienceLayer: ResilienceLayer;
  private readonly llmConfig?: LLMConfig;

  // Layer 1a: Conversations
  public conversations: ConversationsAPI;

  // Layer 1b: Immutable Store
  public immutable: ImmutableAPI;

  // Layer 1c: Mutable Store
  public mutable: MutableAPI;

  // Layer 2: Vector Memory
  public vector: VectorAPI;

  // Layer 3: Facts Store
  public facts: FactsAPI;

  // Layer 4: Context Chains
  public contexts: ContextsAPI;

  // Layer 4: Memory Spaces Registry
  public memorySpaces: MemorySpacesAPI;

  // Layer 4: Memory Convenience API
  public memory: MemoryAPI;

  // Coordination: User Management
  public users: UsersAPI;

  // Coordination: Agent Registry (Optional)
  public agents: AgentsAPI;

  // Governance: Data Retention & Compliance
  public governance: GovernanceAPI;

  // A2A: Agent-to-Agent Communication
  public a2a: A2AAPI;

  constructor(config: CortexConfig) {
    // Initialize Convex client
    this.client = new ConvexClient(config.convexUrl);

    // Store LLM config for fact extraction
    this.llmConfig = config.llm;

    // Initialize resilience layer (default: enabled with balanced settings)
    this.resilienceLayer = new ResilienceLayer(
      config.resilience ?? ResiliencePresets.default,
    );

    // Get graph adapter if configured
    const graphAdapter = config.graph?.adapter;

    // Initialize API modules with graph adapter and resilience layer
    this.conversations = new ConversationsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.immutable = new ImmutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.mutable = new MutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.vector = new VectorAPI(this.client, graphAdapter, this.resilienceLayer);
    this.facts = new FactsAPI(this.client, graphAdapter, this.resilienceLayer);
    this.contexts = new ContextsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.memorySpaces = new MemorySpacesAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.users = new UsersAPI(this.client, graphAdapter, this.resilienceLayer);
    this.agents = new AgentsAPI(this.client, graphAdapter, this.resilienceLayer);
    this.governance = new GovernanceAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.a2a = new A2AAPI(this.client, graphAdapter, this.resilienceLayer);

    // Initialize MemoryAPI with dependencies for full orchestration
    this.memory = new MemoryAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      {
        memorySpaces: this.memorySpaces,
        users: this.users,
        agents: this.agents,
        llm: this.llmConfig,
      },
    );

    // Start graph sync worker if enabled
    if (config.graph?.autoSync && graphAdapter) {
      this.syncWorker = new GraphSyncWorker(
        this.client,
        graphAdapter,
        config.graph.syncWorkerOptions,
      );

      // Start worker asynchronously (don't block constructor)
      void this.syncWorker.start().catch((error) => {
        console.error("Failed to start graph sync worker:", error);
      });
    }
  }

  /**
   * Get the underlying Convex client (for testing and advanced use cases)
   */
  getClient(): ConvexClient {
    return this.client;
  }

  /**
   * Get graph sync worker (if running)
   */
  getGraphSyncWorker(): GraphSyncWorker | undefined {
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
  getResilience(): ResilienceLayer {
    return this.resilienceLayer;
  }

  /**
   * Get current resilience metrics
   *
   * Convenience method equivalent to `getResilience().getMetrics()`
   */
  getResilienceMetrics(): ResilienceMetrics {
    return this.resilienceLayer.getMetrics();
  }

  /**
   * Check if the SDK is healthy and accepting requests
   *
   * Returns false if circuit breaker is open
   */
  isHealthy(): boolean {
    return this.resilienceLayer.isHealthy();
  }

  /**
   * Close the connection to Convex and stop all workers
   */
  close(): void {
    // Stop graph sync worker
    if (this.syncWorker) {
      this.syncWorker.stop();
    }

    // Stop resilience layer queue processor
    this.resilienceLayer.stopQueueProcessor();

    void this.client.close();
  }

  /**
   * Gracefully shutdown the SDK
   *
   * Waits for pending operations to complete before closing.
   *
   * @param timeoutMs Maximum time to wait (default: 30000ms)
   */
  async shutdown(timeoutMs: number = 30000): Promise<void> {
    // Stop graph sync worker
    if (this.syncWorker) {
      this.syncWorker.stop();
    }

    // Gracefully shutdown resilience layer
    await this.resilienceLayer.shutdown(timeoutMs);

    // Close Convex client
    void this.client.close();
  }
}

// Re-export types
export type * from "./types";

// Re-export graph types and classes
export type * from "./graph/types";
export type {
  GraphSyncWorkerOptions,
  SyncHealthMetrics,
} from "./graph/worker/GraphSyncWorker";
export { GraphSyncWorker } from "./graph/worker/GraphSyncWorker";

// Re-export validation errors for user catch blocks
export { UserValidationError } from "./users";
export { GovernanceValidationError } from "./governance";
export { A2AValidationError } from "./a2a";

// Re-export resilience types and presets
export {
  ResilienceLayer,
  ResiliencePresets,
  TokenBucket,
  Semaphore,
  PriorityQueue,
  CircuitBreaker,
  CircuitOpenError,
  QueueFullError,
  AcquireTimeoutError,
  RateLimitExceededError,
  getPriority,
  isCritical,
  OPERATION_PRIORITIES,
} from "./resilience";
export type {
  ResilienceConfig,
  ResilienceMetrics,
  Priority,
  CircuitState,
  RateLimiterConfig,
  ConcurrencyConfig,
  CircuitBreakerConfig,
  QueueConfig,
} from "./resilience";
