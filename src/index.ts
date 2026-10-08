/**
 * Cortex SDK - Main Entry Point
 *
 * Open-source SDK for AI agents with persistent memory
 * Built on Convex for reactive TypeScript queries
 */

import { ConvexClient, type ConvexClientOptions } from "convex/browser";
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
import { ArtifactsAPI } from "./artifacts";
import { AttachmentsAPI } from "./attachments";
import type { AuthContext } from "./auth/types";
import type { GraphAdapter } from "./graph/types";
import { CypherGraphAdapter } from "./graph";
import { resolveGraphConnection, type GraphConnectionOptions } from "./graph/config";
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

/** Ephemeral server transport setup, completed before any Cortex API construction. */
export interface CortexRuntimeOptions {
  initializeTransport?: (client: ConvexClient) => undefined;
}

type InitializationResourceStatus = "pending" | "complete" | "failed";
interface InitializationCleanup {
  status: InitializationResourceStatus;
  completion: Promise<void>;
}
const failedInitializations = new WeakMap<object, InitializationCleanup>();
const INITIALIZATION_FAILURE = "Cortex transport initialization failed.";

// Invoke release synchronously and observe rejection immediately, without retaining causes.
function observeInitializationRelease(release: () => unknown): InitializationCleanup {
  const observation: InitializationCleanup = { status: "pending", completion: Promise.resolve() };
  try {
    const result = release();
    observation.completion = Promise.resolve(result).then(
      () => { observation.status = "complete"; },
      () => { observation.status = "failed"; },
    );
  } catch {
    observation.status = "failed";
  }
  return observation;
}

async function observeFailedInitialization(
  client: InitializationCleanup,
  ownedAdapter?: GraphAdapter,
): Promise<never> {
  // The bound starts at factory failure entry; initiate every release before awaiting.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => { timer = setTimeout(resolve, 30000); });
  const graph = ownedAdapter
    ? observeInitializationRelease(() => ownedAdapter.disconnect())
    : undefined;
  try {
    await Promise.race([Promise.all([client.completion, graph?.completion]), deadline]);
  } finally {
    clearTimeout(timer);
  }
  const snapshot = `client: ${client.status}; owned graph: ${graph?.status ?? "not-owned"}`;
  const incomplete = client.status === "pending" || graph?.status === "pending";
  throw new Error(`${INITIALIZATION_FAILURE} ${incomplete ? "Cleanup incomplete" : "Cleanup observed"} (${snapshot}).`);
}

function initializeTransport(client: ConvexClient, runtime?: CortexRuntimeOptions): void {
  try {
    const initializer = runtime?.initializeTransport;
    if (initializer === undefined) return;
    if (typeof initializer !== "function" || Object.prototype.toString.call(initializer) === "[object AsyncFunction]") {
      throw new Error(INITIALIZATION_FAILURE);
    }
    const result: unknown = initializer(client);
    if (result !== undefined) {
      // Includes rejecting thenables and hostile then getters. No raw cause escapes.
      void Promise.resolve(result).then(() => undefined, () => undefined);
      throw new Error(INITIALIZATION_FAILURE);
    }
  } catch {
    const failure = new Error(INITIALIZATION_FAILURE);
    failedInitializations.set(failure, observeInitializationRelease(() => client.close()));
    throw failure;
  }
}

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
 * Embedding provider configuration for automatic embedding generation.
 *
 * When configured, enables batteries-included semantic search:
 * - recall() automatically generates embeddings for queries
 * - remember() automatically generates embeddings for facts
 * - No manual embedding handling required
 */
export interface EmbeddingConfig {
  /**
   * Embedding provider type.
   * - 'openai': Use OpenAI embeddings API
   * - 'custom': Use a custom embedding function
   */
  provider: "openai" | "custom";

  /**
   * API key for the provider (required for 'openai' provider)
   */
  apiKey?: string;

  /**
   * Model to use for embeddings.
   * Default: 'text-embedding-3-small' for OpenAI
   */
  model?: string;

  /**
   * Custom embedding function (required for 'custom' provider).
   * Takes text input and returns embedding vector.
   *
   * @example
   * ```typescript
   * generate: async (text) => {
   *   const response = await myEmbeddingAPI.embed(text);
   *   return response.embedding;
   * }
   * ```
   */
  generate?: (text: string) => Promise<number[]>;
}

/**
 * Cortex SDK configuration
 */
export interface CortexConfig {
  /** Convex deployment URL */
  convexUrl: string;

  /** Convex transport logger. Set false to suppress transport logs; omitted uses Convex defaults. */
  convexLogger?: ConvexClientOptions["logger"];

  /** Optional caller-owned graph adapter; takes precedence over automatic configuration. */
  graph?: GraphConfig;

  /** Explicit automatic graph switch; false prevents driver work regardless of env. */
  graphEnabled?: boolean;

  /** One provider-specific automatic graph connection tuple. */
  graphConnection?: GraphConnectionOptions;

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
   * Optional embedding configuration for automatic semantic search.
   *
   * When configured, enables batteries-included semantic search:
   * - recall() automatically generates embeddings for queries
   * - remember() automatically generates embeddings for extracted facts
   *
   * @example
   * ```typescript
   * // OpenAI embeddings (recommended)
   * embedding: {
   *   provider: 'openai',
   *   apiKey: process.env.OPENAI_API_KEY,
   *   model: 'text-embedding-3-small',
   * }
   *
   * // Custom embedding function
   * embedding: {
   *   provider: 'custom',
   *   generate: async (text) => myEmbedFunction(text),
   * }
   * ```
   */
  embedding?: EmbeddingConfig;

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
  private syncWorkerStart?: Promise<void>;
  private ownedGraphAdapter?: GraphAdapter;
  private cleanupPromise?: Promise<void>;
  private readonly resilienceLayer: ResilienceLayer;
  private readonly llmConfig?: LLMConfig;
  private readonly embeddingConfig?: EmbeddingConfig;
  private readonly authContext?: AuthContext;

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
  private static autoConfigureEmbedding(): EmbeddingConfig | undefined {
    const embeddingEnabled = process.env.CORTEX_EMBEDDING === "true";

    if (!embeddingEnabled) {
      return undefined;
    }

    // Check for OpenAI API key
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY,
        model: "text-embedding-3-small",
      };
    }

    // CORTEX_EMBEDDING=true but no API key found - warn user
    console.warn(
      "[Cortex] CORTEX_EMBEDDING=true but no API key found. " +
        "Set OPENAI_API_KEY to enable automatic embedding generation.",
    );

    return undefined;
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
  private static async autoConfigureGraph(config: CortexConfig): Promise<GraphConfig | undefined> {
    const connection = resolveGraphConnection({ enabled: config.graphEnabled, connection: config.graphConnection });
    if (!connection) return undefined;
    const adapter = new CypherGraphAdapter();
    await adapter.connect(connection);
    return { adapter, autoSync: true };
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
  static async create(config: CortexConfig, runtime?: CortexRuntimeOptions): Promise<Cortex> {
    const graphConfig = config.graph ?? (await Cortex.autoConfigureGraph(config));
    const ownedAdapter = config.graph ? undefined : graphConfig?.adapter;
    let cortex: Cortex | undefined;
    try {
      cortex = new Cortex({ ...config, graph: graphConfig }, runtime);
      cortex.ownedGraphAdapter = ownedAdapter;
      await cortex.syncWorkerStart;
      return cortex;
    } catch (error) {
      const failedInitialization = typeof error === "object" && error !== null ? failedInitializations.get(error) : undefined;
      if (failedInitialization) return observeFailedInitialization(failedInitialization, ownedAdapter);
      if (cortex) {
        try { await cortex.shutdown(); } catch { /* All resource cleanup was attempted. */ }
        throw new Error("Graph sync initialization failed. Check the graph and Convex connection configuration.");
      }
      if (ownedAdapter) {
        try { await ownedAdapter.disconnect(); } catch { /* Preserve construction failure without exposing credentials. */ }
      }
      throw error;
    }
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

  // Artifacts - Versioned Document Management
  public artifacts: ArtifactsAPI;

  // Attachments - Multi-modal File Storage
  public attachments: AttachmentsAPI;

  constructor(config: CortexConfig, runtime?: CortexRuntimeOptions) {
    // Initialize Convex client
    this.client = config.convexLogger === undefined
      ? new ConvexClient(config.convexUrl)
      : new ConvexClient(config.convexUrl, { logger: config.convexLogger });
    initializeTransport(this.client, runtime);

    // Store LLM config for fact extraction
    // Use explicit config if provided, otherwise auto-configure from environment
    this.llmConfig = config.llm ?? Cortex.autoConfigureLLM();

    // Store embedding config for automatic semantic search
    // Use explicit config if provided, otherwise auto-configure from environment
    this.embeddingConfig = config.embedding ?? Cortex.autoConfigureEmbedding();

    // Store auth context for auto-injection
    this.authContext = config.auth;

    // Initialize resilience layer (default: enabled with balanced settings)
    this.resilienceLayer = new ResilienceLayer(
      config.resilience ?? ResiliencePresets.default,
    );

    // Get graph adapter if configured
    const graphAdapter = config.graph?.adapter;
    const graphPolicy: import("./graph/types").GraphSyncPolicy = {mode: config.graph?.autoSync ? "background" : "inline"};

    // Initialize API modules with graph adapter, resilience layer, and auth context
    this.conversations = new ConversationsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, graphPolicy
    );
    this.immutable = new ImmutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, graphPolicy
    );
    this.mutable = new MutableAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, graphPolicy
    );
    this.vector = new VectorAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, graphPolicy
    );
    this.facts = new FactsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, undefined, undefined, graphPolicy
    );
    this.contexts = new ContextsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, graphPolicy // Pass authContext for multi-tenancy
    );
    this.memorySpaces = new MemorySpacesAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, graphPolicy
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
    this.artifacts = new ArtifactsAPI(
      this.client,
      graphAdapter,
      this.resilienceLayer,
      this.authContext, graphPolicy
    );
    this.attachments = new AttachmentsAPI(
      this.client,
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
        embedding: this.embeddingConfig, // Pass embedding config for auto semantic search
        authContext: this.authContext, // Pass authContext for tenant isolation
        graphSyncPolicy: graphPolicy,
      },
    );

    // Start graph sync worker if enabled
    if (config.graph?.autoSync && graphAdapter) {
      this.syncWorker = new GraphSyncWorker(
        this.client,
        graphAdapter,
        config.graph.syncWorkerOptions, {tenantId: this.authContext?.tenantId}
      );

      // Start worker asynchronously (don't block constructor)
      this.syncWorkerStart = this.syncWorker.start();
      void this.syncWorkerStart.catch(() => {
        console.error("[Cortex] Graph sync worker initialization failed.");
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
    // Keep the synchronous public signature; shutdown() can await the same cleanup.
    void this.dispose(false).catch(() => {
      console.warn("[Cortex] Resource cleanup failed. Use shutdown() to observe completion.");
    });
  }

  private dispose(graceful: boolean, timeoutMs = 30000): Promise<void> {
    if (!this.cleanupPromise) {
      this.cleanupPromise = (async () => {
        const failures: unknown[] = [];
        try { await this.syncWorkerStart; } catch (error) { failures.push(error); }
        try {
          await this.syncWorker?.stop();
          if (graceful) await this.resilienceLayer.shutdown(timeoutMs);
          else this.resilienceLayer.stopQueueProcessor();
        } catch (error) { failures.push(error); }
        const adapter = this.ownedGraphAdapter;
        this.ownedGraphAdapter = undefined;
        // Each owned resource is attempted even if an earlier cleanup fails.
        const results = await Promise.allSettled([
          Promise.resolve().then(() => this.client.close()),
          ...(adapter ? [Promise.resolve().then(() => adapter.disconnect())] : []),
        ]);
        if (failures.length || results.some((result) => result.status === "rejected")) {
          throw new Error("Cortex resource cleanup failed.");
        }
      })();
    }
    return this.cleanupPromise;
  }

  /** Await exactly-once cleanup, including automatically created graph resources. */
  async shutdown(timeoutMs: number = 30000): Promise<void> {
    await this.dispose(true, timeoutMs);
  }
}

// Re-export types
export type * from "./types";
export { DomainOperationPartialError, A2ATimeoutError } from "./types";

// Re-export graph types and classes
export type * from "./graph/types";
export type {
  GraphSyncWorkerOptions,
  SyncHealthMetrics,
} from "./graph/worker/GraphSyncWorker";
export { GraphSyncWorker } from "./graph/worker/GraphSyncWorker";
export { CypherGraphAdapter, GraphDatabaseError, GraphConnectionError, GraphAuthenticationError, GraphQueryError, GraphNotFoundError } from "./graph";

// Re-export validation errors for user catch blocks
export { UserValidationError } from "./users";
export { GovernanceValidationError } from "./governance";
export { A2AValidationError } from "./a2a";
export { SessionValidationError } from "./sessions";
export { AuthValidationError } from "./auth";
export { ArtifactValidationError } from "./artifacts";
export { AttachmentValidationError } from "./attachments";

// Re-export auth module
export { createAuthContext, validateAuthContext } from "./auth";
export type { AuthContext, AuthContextParams, AuthMethod } from "./auth/types";

// Re-export sharing utilities (Shareable Chats Phase 2)
export { buildShareUrl, extractShareId } from "./sharing";
export type { ShareUrlStyle, ShareUrlConfig } from "./sharing";

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

export { resolveGraphConnection } from "./graph/config";
export type { GraphConnectionOptions } from "./graph/config";

// Managed graph administration and truthful original-job reconciliation.
export {createGraphRebuildTransport,createGraphErasureTransport,initialGraphSync,GraphRebuildPartialError,GraphErasureProgressError,prepareGraphErasure,eraseGraphItem,verifyGraphErasure,deliverGraphJob,GraphJobUnresolved,GraphPrimaryOutcomeUnknown,GraphCommittedPartial,assertManagedGraphCompatibility,initializeGraphSchema,verifyGraphSchema,dropGraphSchema} from "./graph";
export type {GraphRebuildTransport,GraphRebuildSelection,GraphErasureTransport,GraphErasureStatus,BatchSyncOptions,BatchSyncResult,GraphErasureItem,PreparedGraphErasureItem,GraphErasureDelivery} from "./graph";
