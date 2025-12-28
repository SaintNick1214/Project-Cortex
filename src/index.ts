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
import { SessionsAPI } from "./sessions";
import type { AuthContext } from "./auth/types";
import type { GraphAdapter } from "./graph/types";
import { CypherGraphAdapter } from "./graph";
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
   * Optional authentication context for multi-tenant applications.
   *
   * When provided, all operations are automatically scoped to the
   * userId and tenantId from the auth context.
   *
   * @example
   * ```typescript
   * auth: createAuthContext({
   *   userId: 'user-123',
   *   tenantId: 'tenant-456',
   *   sessionId: 'sess-abc',
   * })
   * ```
   */
  auth?: AuthContext;

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
  private readonly authContext?: AuthContext;

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
  private static autoConfigureLLM(): LLMConfig | undefined {
    const factExtractionEnabled = process.env.CORTEX_FACT_EXTRACTION === "true";

    if (!factExtractionEnabled) {
      return undefined;
    }

    // Check providers in priority order
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY,
      };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    }

    // CORTEX_FACT_EXTRACTION=true but no API key found - warn user
    console.warn(
      "[Cortex] CORTEX_FACT_EXTRACTION=true but no API key found. " +
        "Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable automatic fact extraction.",
    );

    return undefined;
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
  private static async autoConfigureGraph(): Promise<GraphConfig | undefined> {
    const graphSyncEnabled = process.env.CORTEX_GRAPH_SYNC === "true";

    if (!graphSyncEnabled) {
      return undefined;
    }

    // Check providers in priority order
    const neo4jUri = process.env.NEO4J_URI;
    const memgraphUri = process.env.MEMGRAPH_URI;

    if (neo4jUri && memgraphUri) {
      console.warn(
        "[Cortex] Both NEO4J_URI and MEMGRAPH_URI set. Using Neo4j.",
      );
    }

    if (neo4jUri) {
      try {
        const adapter = new CypherGraphAdapter();
        await adapter.connect({
          uri: neo4jUri,
          username: process.env.NEO4J_USERNAME || "neo4j",
          password: process.env.NEO4J_PASSWORD || "",
        });
        return { adapter, autoSync: true };
      } catch (error) {
        console.error(
          "[Cortex] Failed to connect to Neo4j:",
          error instanceof Error ? error.message : error,
        );
        return undefined;
      }
    }

    if (memgraphUri) {
      try {
        const adapter = new CypherGraphAdapter();
        await adapter.connect({
          uri: memgraphUri,
          username: process.env.MEMGRAPH_USERNAME || "memgraph",
          password: process.env.MEMGRAPH_PASSWORD || "",
        });
        return { adapter, autoSync: true };
      } catch (error) {
        console.error(
          "[Cortex] Failed to connect to Memgraph:",
          error instanceof Error ? error.message : error,
        );
        return undefined;
      }
    }

    // CORTEX_GRAPH_SYNC=true but no URI found - warn user
    console.warn(
      "[Cortex] CORTEX_GRAPH_SYNC=true but no graph database URI found. " +
        "Set NEO4J_URI or MEMGRAPH_URI to enable graph sync.",
    );

    return undefined;
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
  static async create(config: CortexConfig): Promise<Cortex> {
    // Auto-configure graph if not explicitly provided
    const graphConfig = config.graph ?? (await Cortex.autoConfigureGraph());

    // Create instance with potentially auto-configured graph
    return new Cortex({
      ...config,
      graph: graphConfig,
    });
  }

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

  // Sessions: Native Session Management
  public sessions: SessionsAPI;

  constructor(config: CortexConfig) {
    // Initialize Convex client
    this.client = new ConvexClient(config.convexUrl);

    // Store LLM config for fact extraction
    // Use explicit config if provided, otherwise auto-configure from environment
    this.llmConfig = config.llm ?? Cortex.autoConfigureLLM();

    // Store auth context for auto-injection
    this.authContext = config.auth;

    // Initialize resilience layer (default: enabled with balanced settings)
    this.resilienceLayer = new ResilienceLayer(
      config.resilience ?? ResiliencePresets.default,
    );

    // Get graph adapter if configured
    const graphAdapter = config.graph?.adapter;

    // Initialize API modules with graph adapter, resilience layer, and auth context
    this.conversations = new ConversationsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext,
    );
    this.immutable = new ImmutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext,
    );
    this.mutable = new MutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext,
    );
    this.vector = new VectorAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.facts = new FactsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext,
    );
    this.contexts = new ContextsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.memorySpaces = new MemorySpacesAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext,
    );
    this.users = new UsersAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext,
    );
    this.agents = new AgentsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.governance = new GovernanceAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
    );
    this.a2a = new A2AAPI(this.client, graphAdapter, this.resilienceLayer);
    this.sessions = new SessionsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext,
    );

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
        authContext: this.authContext, // Pass authContext for tenant isolation
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
   * Get the authentication context (if configured)
   *
   * Returns the AuthContext that was passed during initialization.
   * Useful for checking the current user/tenant context.
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
  get auth(): AuthContext | undefined {
    return this.authContext;
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
export { CypherGraphAdapter } from "./graph";

// Re-export validation errors for user catch blocks
export { UserValidationError } from "./users";
export { GovernanceValidationError } from "./governance";
export { A2AValidationError } from "./a2a";
export { SessionValidationError } from "./sessions";
export { AuthValidationError } from "./auth";

// Re-export auth module
export { createAuthContext, validateAuthContext } from "./auth";
export type { AuthContext, AuthContextParams, AuthMethod } from "./auth/types";

// Re-export sessions module
export { SessionsAPI } from "./sessions";
export type {
  Session,
  SessionStatus,
  SessionMetadata,
  CreateSessionParams,
  SessionFilters,
  ExpireSessionsOptions,
  EndSessionsResult,
} from "./sessions/types";

// Re-export user schemas
export {
  validationPresets,
  validateUserProfile,
  createUserProfile,
} from "./users/schemas";
export type { StandardUserProfile, ValidationPreset } from "./users/schemas";

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Orchestration Observer Types (Integration-Agnostic Monitoring)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export type {
  /** Memory layer identifiers for orchestration monitoring */
  MemoryLayer,
  /** Layer status during orchestration */
  LayerStatus,
  /** Revision action from belief revision system */
  RevisionAction,
  /** Event emitted when a layer's status changes */
  LayerEvent,
  /** Summary of completed orchestration */
  OrchestrationSummary,
  /** Observer interface for real-time orchestration monitoring */
  OrchestrationObserver,
} from "./types";
