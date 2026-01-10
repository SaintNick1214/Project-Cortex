/**
 * Layer 3: Memory Convenience API
 *
 * High-level helpers that orchestrate Layer 1 (ACID) and Layer 2 (Vector) automatically.
 * Recommended API for most use cases.
 *
 * ## Orchestration Flow
 *
 * When calling `remember()`, the following layers are orchestrated by default:
 *
 * 1. **VALIDATION** (cannot be skipped)
 *    - memorySpaceId: defaults to 'default' with warning if not provided
 *    - userId OR agentId: at least one is required for ownership
 *
 * 2. **MEMORYSPACE** (cannot be skipped)
 *    - Auto-registers memory space if it doesn't exist
 *
 * 3. **OWNER PROFILES** (skip: 'users'/'agents')
 *    - userId → auto-creates user profile
 *    - agentId → auto-registers agent
 *
 * 4. **CONVERSATION** (skip: 'conversations')
 *    - Stores messages in ACID conversation layer
 *
 * 5. **VECTOR MEMORY** (skip: 'vector')
 *    - Creates searchable vector memory
 *
 * 6. **FACTS** (skip: 'facts')
 *    - Auto-extracts facts if LLM configured
 *
 * 7. **GRAPH** (skip: 'graph')
 *    - Syncs entities to graph database if configured
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import { ConversationsAPI } from "../conversations";
import { VectorAPI } from "../vector";
import { FactsAPI, type ConflictAction } from "../facts";
import {
  FactDeduplicationService,
  type DeduplicationConfig,
} from "../facts/deduplication";
import type { BeliefRevisionLLMClient } from "../facts/belief-revision";

/**
 * Internal type for tracking belief revision actions in remember()
 */
interface FactRevisionAction {
  /** Action taken: ADD (new), UPDATE (merged), SUPERSEDE (replaced), NONE (skipped) */
  action: ConflictAction;
  /** The resulting fact (or existing fact for NONE) */
  fact: FactRecord;
  /** Facts that were superseded by this action */
  superseded?: FactRecord[];
  /** Reason for the action */
  reason?: string;
}
import type { MemorySpacesAPI } from "../memorySpaces";
import type { UsersAPI } from "../users";
import type { AgentsAPI } from "../agents";
import type { AuthContext } from "../auth/types";
import {
  type ArchiveResult,
  type Conversation,
  type CountMemoriesFilter,
  type DeleteManyResult,
  type DeleteMemoryOptions,
  type DeleteMemoryResult,
  type EnrichedMemory,
  type ExportMemoriesOptions,
  type ExtendedForgetOptions,
  type FactRecord,
  type ForgetResult,
  type GetMemoryOptions,
  type ListMemoriesFilter,
  type MemoryEntry,
  type Message,
  type RecallParams,
  type RecallResult,
  type RememberOptions,
  type RememberParams,
  type RememberResult,
  type RememberStreamParams,
  type SearchMemoryOptions,
  type SkippableLayer,
  type SourceType,
  type StoreMemoryInput,
  type StoreMemoryResult,
  type UpdateManyResult,
  type UpdateMemoryOptions,
  type UpdateMemoryResult,
  // Orchestration observer types
  type OrchestrationObserver,
  type LayerEvent,
  type MemoryLayer,
  type LayerStatus,
  type OrchestrationSummary,
  type RevisionAction,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import type { LLMConfig } from "../index";
import { createLLMClient, type ExtractedFact, type LLMClient } from "../llm";
import {
  MemoryValidationError,
  validateMemorySpaceId,
  validateMemoryId,
  validateUserId,
  validateConversationId,
  validateContent,
  validateSourceType,
  validateExportFormat,
  validateImportance,
  validateVersion,
  validateLimit,
  validateTimestamp,
  validateTags,
  validateStoreMemoryInput,
  validateSearchOptions,
  validateUpdateOptions,
  validateConversationRefRequirement,
  validateStreamObject,
  validateFilterCombination,
  validateRecallParams,
} from "./validators";
import {
  performGraphExpansion,
  processRecallResults,
  enrichWithConversations,
  type GraphExpansionConfig,
} from "./recall";
import type { ResilienceLayer } from "../resilience";

/** Default memory space ID used when none is provided */
const DEFAULT_MEMORY_SPACE_ID = "default";

// Type for conversation with messages
interface ConversationWithMessages {
  messages: Message[];
  [key: string]: unknown;
}

/**
 * Dependencies for full memory orchestration
 */
export interface MemoryAPIDependencies {
  /** Memory spaces API for auto-registration */
  memorySpaces: MemorySpacesAPI;
  /** Users API for auto-profile creation */
  users: UsersAPI;
  /** Agents API for auto-registration */
  agents: AgentsAPI;
  /** LLM config for auto fact extraction */
  llm?: LLMConfig;
  /** Auth context for tenant isolation */
  authContext?: AuthContext;
}

export class MemoryAPI {
  private readonly client: ConvexClient;
  private readonly conversations: ConversationsAPI;
  private readonly vector: VectorAPI;
  private readonly facts: FactsAPI;
  private readonly graphAdapter?: GraphAdapter;
  private readonly resilience?: ResilienceLayer;

  // Dependencies for orchestration
  private readonly memorySpacesAPI?: MemorySpacesAPI;
  private readonly usersAPI?: UsersAPI;
  private readonly agentsAPI?: AgentsAPI;
  private readonly llmConfig?: LLMConfig;
  private readonly authContext?: AuthContext;
  private llmClient?: LLMClient | null;

  constructor(
    client: ConvexClient,
    graphAdapter?: GraphAdapter,
    resilience?: ResilienceLayer,
    dependencies?: MemoryAPIDependencies,
  ) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.resilience = resilience;

    // Store orchestration dependencies
    this.memorySpacesAPI = dependencies?.memorySpaces;
    this.usersAPI = dependencies?.users;
    this.agentsAPI = dependencies?.agents;
    this.llmConfig = dependencies?.llm;
    this.authContext = dependencies?.authContext;

    // Pass resilience layer to sub-APIs (with authContext for tenant isolation)
    this.conversations = new ConversationsAPI(
      client,
      graphAdapter,
      resilience,
      this.authContext,
    );
    this.vector = new VectorAPI(client, graphAdapter, resilience);

    // Create belief revision LLM client adapter if LLM is configured
    let beliefRevisionLLMClient: BeliefRevisionLLMClient | undefined;
    if (this.llmConfig) {
      const llmClient = createLLMClient(this.llmConfig);
      if (llmClient?.complete) {
        beliefRevisionLLMClient = {
          complete: (opts) => llmClient.complete!(opts),
        };
      }
    }

    // Pass authContext to FactsAPI for tenant isolation
    this.facts = new FactsAPI(
      client,
      graphAdapter,
      resilience,
      this.authContext,
      beliefRevisionLLMClient,
    );
  }

  /**
   * Execute an operation through the resilience layer (if available)
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
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
  private async cascadeDeleteFacts(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
  ): Promise<{ count: number; factIds: string[] }> {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 10000,
    });

    const factsToDelete = allFacts.filter(
      (fact) =>
        fact.sourceRef?.memoryId === memoryId ||
        (conversationId && fact.sourceRef?.conversationId === conversationId),
    );

    const deletedFactIds: string[] = [];
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
  private async archiveFacts(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
  ): Promise<{ count: number; factIds: string[] }> {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 10000,
    });

    const factsToArchive = allFacts.filter(
      (fact) =>
        fact.sourceRef?.memoryId === memoryId ||
        (conversationId && fact.sourceRef?.conversationId === conversationId),
    );

    const archivedFactIds: string[] = [];
    for (const fact of factsToArchive) {
      try {
        await this.facts.update(memorySpaceId, fact.factId, {
          validUntil: Date.now(),
          tags: [...fact.tags, "archived"],
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
  private async fetchFactsForMemory(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
  ): Promise<FactRecord[]> {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 10000,
    });

    return allFacts.filter(
      (fact) =>
        fact.sourceRef?.memoryId === memoryId ||
        (conversationId && fact.sourceRef?.conversationId === conversationId),
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
  private generateOrchestrationId(): string {
    return `orch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Notify the observer of a layer update (safely handles async observers)
   */
  private notifyLayerUpdate(
    observer: OrchestrationObserver | undefined,
    event: LayerEvent,
  ): void {
    if (!observer?.onLayerUpdate) return;
    try {
      const result = observer.onLayerUpdate(event);
      // Handle async observers - fire and forget to avoid blocking
      if (result instanceof Promise) {
        result.catch((e) =>
          console.warn("[Cortex] Observer onLayerUpdate failed:", e),
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onLayerUpdate threw:", e);
    }
  }

  /**
   * Notify the observer of orchestration start
   */
  private notifyOrchestrationStart(
    observer: OrchestrationObserver | undefined,
    orchestrationId: string,
  ): void {
    if (!observer?.onOrchestrationStart) return;
    try {
      const result = observer.onOrchestrationStart(orchestrationId);
      if (result instanceof Promise) {
        result.catch((e) =>
          console.warn("[Cortex] Observer onOrchestrationStart failed:", e),
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onOrchestrationStart threw:", e);
    }
  }

  /**
   * Notify the observer of orchestration completion
   */
  private notifyOrchestrationComplete(
    observer: OrchestrationObserver | undefined,
    summary: OrchestrationSummary,
  ): void {
    if (!observer?.onOrchestrationComplete) return;
    try {
      const result = observer.onOrchestrationComplete(summary);
      if (result instanceof Promise) {
        result.catch((e) =>
          console.warn("[Cortex] Observer onOrchestrationComplete failed:", e),
        );
      }
    } catch (e) {
      console.warn("[Cortex] Observer onOrchestrationComplete threw:", e);
    }
  }

  /**
   * Create a layer event with current timing info
   */
  private createLayerEvent(
    layer: MemoryLayer,
    status: LayerStatus,
    orchestrationStartTime: number,
    data?: LayerEvent["data"],
    error?: LayerEvent["error"],
    revisionInfo?: { action?: RevisionAction; supersededFacts?: string[] },
  ): LayerEvent {
    const now = Date.now();
    return {
      layer,
      status,
      timestamp: now,
      latencyMs: now - orchestrationStartTime,
      data,
      error,
      revisionAction: revisionInfo?.action,
      supersededFacts: revisionInfo?.supersededFacts,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Orchestration Helper Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Check if a layer should be skipped
   */
  private shouldSkipLayer(
    layer: SkippableLayer,
    skipLayers?: SkippableLayer[],
  ): boolean {
    return skipLayers?.includes(layer) ?? false;
  }

  /**
   * Build deduplication config from remember params
   *
   * Defaults to 'semantic' strategy for maximum effectiveness (convenience layer).
   * Falls back to 'structural' if no generateEmbedding function is available.
   * Returns undefined if deduplication is explicitly disabled.
   */
  private buildDeduplicationConfig(
    params: RememberParams | RememberStreamParams,
  ): DeduplicationConfig | undefined {
    // If explicitly disabled, return undefined
    if (params.factDeduplication === false) {
      return undefined;
    }

    // Determine the strategy - default to 'semantic'
    const strategy = params.factDeduplication ?? "semantic";

    // Build the config
    const config: DeduplicationConfig = {
      strategy,
      similarityThreshold: 0.85,
      generateEmbedding: params.generateEmbedding
        ? async (text: string) => {
            const result = await params.generateEmbedding!(text);
            if (!result) {
              throw new Error("generateEmbedding returned null");
            }
            return result;
          }
        : undefined,
    };

    // Use the resolve function to handle fallback logic
    return FactDeduplicationService.resolveConfig(config);
  }

  /**
   * Validate and normalize remember params with orchestration defaults
   */
  private validateAndNormalizeParams(params: RememberParams): {
    memorySpaceId: string;
    ownerId: string;
    ownerType: "user" | "agent";
    warnings: string[];
  } {
    const warnings: string[] = [];

    // 1. Validate required fields
    validateConversationId(params.conversationId);
    validateContent(params.userMessage, "userMessage");
    validateContent(params.agentResponse, "agentResponse");

    // 2. Handle memorySpaceId - default to 'default' with warning if not specified
    let memorySpaceId = params.memorySpaceId;
    if (memorySpaceId === undefined || memorySpaceId === null) {
      // Not specified - use default with warning
      memorySpaceId = DEFAULT_MEMORY_SPACE_ID;
      warnings.push(
        `[Cortex Warning] No memorySpaceId provided, using '${DEFAULT_MEMORY_SPACE_ID}'. ` +
          "Consider explicitly setting a memorySpaceId for proper memory isolation.",
      );
    } else if (memorySpaceId.trim().length === 0) {
      // Specified but empty/whitespace - this is an error
      throw new MemoryValidationError(
        "memorySpaceId cannot be empty. Either provide a valid memorySpaceId or omit it to use the default.",
        "INVALID_MEMORYSPACE_ID",
        "memorySpaceId",
      );
    }

    // 3. Validate owner attribution - at least one of userId or agentId required
    const hasUserId = params.userId && params.userId.trim().length > 0;
    const hasAgentId = params.agentId && params.agentId.trim().length > 0;

    if (!hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "Either userId or agentId must be provided for memory ownership. " +
          "Use userId for user-owned memories, agentId for agent-owned memories.",
        "OWNER_REQUIRED",
        "userId/agentId",
      );
    }

    // 4. For user-agent conversations, require agentId when userId is provided
    // A user can't have a conversation with themselves - there must be an agent
    if (hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "agentId is required when userId is provided. " +
          "User-agent conversations require both a user and an agent participant.",
        "AGENT_REQUIRED_FOR_USER_CONVERSATION",
        "agentId",
      );
    }

    // Determine primary owner
    const ownerId = hasUserId ? params.userId! : params.agentId!;
    const ownerType = hasUserId ? "user" : "agent";

    // 5. Validate userName is provided when userId is provided
    if (
      hasUserId &&
      (!params.userName || params.userName.trim().length === 0)
    ) {
      throw new MemoryValidationError(
        "userName is required when userId is provided",
        "MISSING_REQUIRED_FIELD",
        "userName",
      );
    }

    // 5. Validate optional fields
    if (params.importance !== undefined) {
      validateImportance(params.importance);
    }
    if (params.tags) {
      validateTags(params.tags);
    }

    return {
      memorySpaceId,
      ownerId,
      ownerType,
      warnings,
    };
  }

  /**
   * Ensure memory space exists, auto-register if not
   * Graph sync is automatic when CORTEX_GRAPH_SYNC=true and graphAdapter is configured
   */
  private async ensureMemorySpaceExists(memorySpaceId: string): Promise<void> {
    if (!this.memorySpacesAPI) {
      // No memorySpaces API available - skip auto-registration
      return;
    }

    const existingSpace = await this.memorySpacesAPI.get(memorySpaceId);
    if (!existingSpace) {
      await this.memorySpacesAPI.register({
        memorySpaceId,
        type: "custom",
        name: memorySpaceId,
      });
    }
  }

  /**
   * Ensure user profile exists, auto-create if not
   */
  private async ensureUserExists(
    userId: string,
    userName?: string,
  ): Promise<void> {
    if (!this.usersAPI) {
      // No users API available - skip auto-creation
      return;
    }

    await this.usersAPI.getOrCreate(userId, {
      displayName: userName || userId,
      createdAt: Date.now(),
    });
  }

  /**
   * Ensure agent is registered, auto-register if not
   */
  private async ensureAgentExists(agentId: string): Promise<void> {
    if (!this.agentsAPI) {
      // No agents API available - skip auto-registration
      return;
    }

    const existingAgent = await this.agentsAPI.exists(agentId);
    if (!existingAgent) {
      await this.agentsAPI.register({
        id: agentId,
        name: agentId,
        description: "Auto-registered by memory.remember()",
      });
    }
  }

  /**
   * Get fact extraction function - uses provided extractor, LLM config, or returns null
   */
  private getFactExtractor(params: RememberParams):
    | ((
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
      }> | null>)
    | null {
    // 1. Use provided extractor if available
    if (params.extractFacts) {
      return params.extractFacts;
    }

    // 2. Use LLM config's custom extractor if available
    if (this.llmConfig?.extractFacts) {
      return this.llmConfig.extractFacts;
    }

    // 3. If LLM is configured, use built-in extraction (to be implemented)
    if (this.llmConfig?.apiKey) {
      // Return a function that will call the LLM for fact extraction
      return this.createLLMFactExtractor();
    }

    // 4. No fact extraction available
    return null;
  }

  /**
   * Get or create LLM client for fact extraction
   */
  private getLLMClient(): LLMClient | null {
    // Return cached client if available
    if (this.llmClient !== undefined) {
      return this.llmClient;
    }

    // Create and cache client
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
  private createLLMFactExtractor(): (
    userMessage: string,
    agentResponse: string,
  ) => Promise<ExtractedFact[] | null> {
    const client = this.getLLMClient();

    if (!client) {
      // No LLM client available - return function that logs and returns null
      return async (): Promise<ExtractedFact[] | null> => {
        console.debug(
          "[Cortex] LLM fact extraction configured but client could not be created. " +
            "Ensure openai or @anthropic-ai/sdk is installed.",
        );
        return null;
      };
    }

    // Return the client's extractFacts method bound to the client
    return async (
      userMessage: string,
      agentResponse: string,
    ): Promise<ExtractedFact[] | null> => {
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
  async remember(
    params: RememberParams,
    options?: RememberOptions,
  ): Promise<RememberResult> {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ORCHESTRATION OBSERVER SETUP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const observer = params.observer;
    const orchestrationId = observer ? this.generateOrchestrationId() : "";
    const orchestrationStartTime = Date.now();
    const layerEvents: Partial<Record<MemoryLayer, LayerEvent>> = {};

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: VALIDATION (Cannot be skipped)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const { memorySpaceId, ownerId, ownerType, warnings } =
      this.validateAndNormalizeParams(params);

    // Emit warnings (non-breaking)
    for (const warning of warnings) {
      console.warn(warning);
    }

    const now = Date.now();
    const skipLayers = params.skipLayers || [];

    // Determine if this is a partial orchestration (called from rememberStream)
    // When called from rememberStream, skipLayers includes "users" and "agents"
    const isPartialOrchestration =
      this.shouldSkipLayer("users", skipLayers) ||
      this.shouldSkipLayer("agents", skipLayers);

    // Notify orchestration start (skip if called from rememberStream which already notified)
    if (observer && !isPartialOrchestration) {
      this.notifyOrchestrationStart(observer, orchestrationId);
    }

    // Determine if we should sync to graph (automatic when graphAdapter is configured)
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    const shouldSyncToGraph =
      this.graphAdapter !== undefined &&
      !this.shouldSkipLayer("graph", skipLayers);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: MEMORYSPACE (Cannot be skipped)
    // Skip notifications if this is a partial orchestration (called from rememberStream)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (observer && !isPartialOrchestration) {
      const event = this.createLayerEvent(
        "memorySpace",
        "in_progress",
        orchestrationStartTime,
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
          {
            id: memorySpaceId,
            preview: `Memory space: ${memorySpaceId}`,
          },
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
          undefined,
          {
            message: error instanceof Error ? error.message : String(error),
          },
        );
        layerEvents.memorySpace = event;
        this.notifyLayerUpdate(observer, event);
      }
      throw error;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: OWNER PROFILES (skip: 'users'/'agents')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const shouldProcessUser =
      ownerType === "user" && !this.shouldSkipLayer("users", skipLayers);
    const shouldProcessAgent =
      ownerType === "agent" && !this.shouldSkipLayer("agents", skipLayers);
    const shouldProcessSecondaryAgent =
      params.agentId &&
      params.userId &&
      !this.shouldSkipLayer("agents", skipLayers);

    // User layer
    if (shouldProcessUser) {
      if (observer) {
        const event = this.createLayerEvent(
          "user",
          "in_progress",
          orchestrationStartTime,
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
            {
              id: ownerId,
              preview: `User: ${params.userName || ownerId}`,
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
          );
          layerEvents.user = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer && !this.shouldSkipLayer("users", skipLayers)) {
      // Only emit "skipped" if the layer wasn't explicitly skipped by caller
      // (e.g., when ownerType is "agent", user layer is naturally skipped)
      // If caller passed "users" in skipLayers, they've already emitted the event
      const event = this.createLayerEvent(
        "user",
        "skipped",
        orchestrationStartTime,
      );
      layerEvents.user = event;
      this.notifyLayerUpdate(observer, event);
    }

    // Agent layer
    if (shouldProcessAgent) {
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
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
            {
              id: ownerId,
              preview: `Agent: ${ownerId}`,
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (shouldProcessSecondaryAgent) {
      // Handle case where userId is primary but agentId also needs registration
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
        );
        layerEvents.agent = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureAgentExists(params.agentId!);
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "complete",
            orchestrationStartTime,
            {
              id: params.agentId!,
              preview: `Agent: ${params.agentId}`,
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (observer && !this.shouldSkipLayer("agents", skipLayers)) {
      // Only emit "skipped" if the layer wasn't explicitly skipped by caller
      // If caller passed "agents" in skipLayers, they've already emitted the event
      const event = this.createLayerEvent(
        "agent",
        "skipped",
        orchestrationStartTime,
      );
      layerEvents.agent = event;
      this.notifyLayerUpdate(observer, event);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: CONVERSATION (skip: 'conversations')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let userMsgId: string | undefined;
    let agentMsgId: string | undefined;

    if (!this.shouldSkipLayer("conversations", skipLayers)) {
      if (observer) {
        const event = this.createLayerEvent(
          "conversation",
          "in_progress",
          orchestrationStartTime,
        );
        layerEvents.conversation = event;
        this.notifyLayerUpdate(observer, event);
      }

      try {
        // Ensure conversation exists (auto-create if needed)
        const existingConversation = await this.conversations.get(
          params.conversationId,
        );

        if (!existingConversation) {
          // Determine conversation type based on owner:
          // - user-agent: when userId is provided (user↔agent interaction)
          // - agent-agent: when only agentId is provided (agent-only or system interaction)
          const conversationType = params.userId ? "user-agent" : "agent-agent";
          const participants = params.userId
            ? {
                userId: params.userId,
                agentId: params.agentId, // The agent in this user↔agent conversation
                participantId: params.participantId, // Hive Mode: who created this
              }
            : {
                // For agent-agent, store the agentId as the owner
                agentId: params.agentId,
                participantId: params.participantId, // Hive Mode: who created this
              };

          try {
            await this.conversations.create(
              {
                memorySpaceId,
                conversationId: params.conversationId,
                type: conversationType,
                participants,
              },
              { syncToGraph: shouldSyncToGraph },
            );
          } catch (createError) {
            // Handle race condition: another parallel call may have created the conversation
            // Check if it's a duplicate error and the conversation now exists
            const errorMessage =
              createError instanceof Error
                ? createError.message
                : String(createError);
            if (errorMessage.includes("CONVERSATION_ALREADY_EXISTS")) {
              // Race condition handled - conversation was created by parallel call, continue
            } else {
              throw createError;
            }
          }
        }

        // Store user message in ACID
        const userMsg = await this.conversations.addMessage({
          conversationId: params.conversationId,
          message: {
            role: "user",
            content: params.userMessage,
            metadata: { userId: params.userId },
          },
        });
        userMsgId = userMsg.messages[userMsg.messages.length - 1].id;

        // Store agent response in ACID
        const agentMsg = await this.conversations.addMessage({
          conversationId: params.conversationId,
          message: {
            role: "agent",
            content: params.agentResponse,
            participantId: params.participantId || params.agentId,
            metadata: {},
          },
        });
        agentMsgId = agentMsg.messages[agentMsg.messages.length - 1].id;

        if (observer) {
          const event = this.createLayerEvent(
            "conversation",
            "complete",
            orchestrationStartTime,
            {
              id: params.conversationId,
              preview: `Conversation: ${params.conversationId} (2 messages)`,
              metadata: { userMsgId, agentMsgId },
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
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
      );
      layerEvents.conversation = event;
      this.notifyLayerUpdate(observer, event);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: VECTOR MEMORY (skip: 'vector')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const storedMemories: MemoryEntry[] = [];

    if (!this.shouldSkipLayer("vector", skipLayers)) {
      if (observer) {
        const event = this.createLayerEvent(
          "vector",
          "in_progress",
          orchestrationStartTime,
        );
        layerEvents.vector = event;
        this.notifyLayerUpdate(observer, event);
      }

      try {
        // Extract content (if provided)
        let userContent = params.userMessage;
        const agentContent = params.agentResponse;
        let contentType: "raw" | "summarized" = "raw";

        if (params.extractContent) {
          const extracted = await params.extractContent(
            params.userMessage,
            params.agentResponse,
          );
          if (extracted) {
            userContent = extracted;
            contentType = "summarized";
          }
        }

        // Generate embeddings (if provided)
        let userEmbedding: number[] | undefined;
        let agentEmbedding: number[] | undefined;

        if (params.generateEmbedding) {
          userEmbedding =
            (await params.generateEmbedding(userContent)) || undefined;
          agentEmbedding =
            (await params.generateEmbedding(agentContent)) || undefined;
        }

        // Store user message in Vector with conversationRef
        const userMemory = await this.vector.store(
          memorySpaceId,
          {
            content: userContent,
            contentType,
            tenantId: params.tenantId ?? this.authContext?.tenantId, // Multi-tenancy: SaaS platform isolation
            participantId: params.participantId,
            embedding: userEmbedding,
            userId: params.userId,
            agentId: params.agentId, // NEW: Support agent-owned memories
            messageRole: "user",
            source: {
              type: "conversation",
              userId: params.userId,
              userName: params.userName,
              timestamp: now,
            },
            conversationRef: userMsgId
              ? {
                  conversationId: params.conversationId,
                  messageIds: [userMsgId],
                }
              : undefined,
            metadata: {
              importance: params.importance || 50,
              tags: params.tags || [],
            },
          },
          { syncToGraph: shouldSyncToGraph },
        );
        storedMemories.push(userMemory);

        // Store agent response in Vector (only if it contains meaningful info)
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
          "ok,",
        ];
        const isAcknowledgment =
          agentContent.length < 80 &&
          acknowledgmentPhrases.some((phrase) =>
            agentContentLower.includes(phrase),
          );

        if (!isAcknowledgment) {
          const agentMemory = await this.vector.store(
            memorySpaceId,
            {
              content: agentContent,
              contentType: "raw",
              tenantId: params.tenantId ?? this.authContext?.tenantId, // Multi-tenancy: SaaS platform isolation
              participantId: params.participantId,
              embedding: agentEmbedding,
              userId: params.userId,
              agentId: params.agentId, // NEW: Support agent-owned memories
              messageRole: "agent",
              source: {
                type: "conversation",
                userId: params.userId,
                userName: params.userName,
                timestamp: now + 1,
              },
              conversationRef: agentMsgId
                ? {
                    conversationId: params.conversationId,
                    messageIds: [agentMsgId],
                  }
                : undefined,
              metadata: {
                importance: params.importance || 50,
                tags: params.tags || [],
              },
            },
            { syncToGraph: shouldSyncToGraph },
          );
          storedMemories.push(agentMemory);
        }

        if (observer) {
          const event = this.createLayerEvent(
            "vector",
            "complete",
            orchestrationStartTime,
            {
              id: storedMemories[0]?.memoryId,
              preview: `${storedMemories.length} memories stored`,
              metadata: { memoryIds: storedMemories.map((m) => m.memoryId) },
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
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
      );
      layerEvents.vector = event;
      this.notifyLayerUpdate(observer, event);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: FACTS (skip: 'facts')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const extractedFacts: FactRecord[] = [];
    const revisionActions: FactRevisionAction[] = [];

    if (!this.shouldSkipLayer("facts", skipLayers)) {
      const factExtractor = this.getFactExtractor(params);

      if (factExtractor) {
        if (observer) {
          const event = this.createLayerEvent(
            "facts",
            "in_progress",
            orchestrationStartTime,
          );
          layerEvents.facts = event;
          this.notifyLayerUpdate(observer, event);
        }

        try {
          const factsToStore = await factExtractor(
            params.userMessage,
            params.agentResponse,
          );

          if (factsToStore && factsToStore.length > 0) {
            // Determine if we should use belief revision
            // Batteries included: ON by default when LLM is configured
            // Also skip belief revision when factDeduplication is explicitly false
            // (belief revision's slot matching would prevent duplicate storage)
            const useBeliefRevision =
              options?.beliefRevision !== false &&
              params.factDeduplication !== false &&
              this.facts.hasBeliefRevision();

            // Build deduplication config for fallback path
            const dedupConfig = this.buildDeduplicationConfig(params);

            for (const factData of factsToStore) {
              try {
                if (useBeliefRevision) {
                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  // BELIEF REVISION PATH (intelligent fact management)
                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  const reviseResult = await this.facts.revise({
                    memorySpaceId,
                    userId: params.userId,
                    participantId: params.participantId,
                    // Include source provenance for traceability
                    sourceType: "conversation",
                    sourceRef: {
                      conversationId: params.conversationId,
                      messageIds:
                        userMsgId && agentMsgId
                          ? [userMsgId, agentMsgId]
                          : undefined,
                      memoryId: storedMemories[0]?.memoryId,
                    },
                    fact: {
                      fact: factData.fact,
                      factType: factData.factType,
                      subject:
                        factData.subject || params.userId || params.agentId,
                      predicate: factData.predicate,
                      object: factData.object,
                      confidence: factData.confidence,
                      tags: factData.tags || params.tags || [],
                    },
                  });

                  // Track revision action
                  revisionActions.push({
                    action: reviseResult.action,
                    fact: reviseResult.fact,
                    superseded:
                      reviseResult.superseded.length > 0
                        ? reviseResult.superseded
                        : undefined,
                    reason: reviseResult.reason,
                  });

                  // Only add to extractedFacts if action wasn't NONE (duplicate/skip)
                  if (reviseResult.action !== "NONE") {
                    extractedFacts.push(reviseResult.fact);
                  }
                } else {
                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  // DEDUPLICATION PATH (fallback when no LLM)
                  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  const storeParams = {
                    memorySpaceId,
                    participantId: params.participantId,
                    userId: params.userId,
                    fact: factData.fact,
                    factType: factData.factType,
                    subject:
                      factData.subject || params.userId || params.agentId,
                    predicate: factData.predicate,
                    object: factData.object,
                    confidence: factData.confidence,
                    sourceType: "conversation" as const,
                    sourceRef: {
                      conversationId: params.conversationId,
                      messageIds:
                        userMsgId && agentMsgId
                          ? [userMsgId, agentMsgId]
                          : undefined,
                      memoryId: storedMemories[0]?.memoryId,
                    },
                    tags: factData.tags || params.tags || [],
                  };

                  // Use storeWithDedup if deduplication is enabled
                  // Graph sync is automatic when graphAdapter is configured
                  if (dedupConfig) {
                    const result = await this.facts.storeWithDedup(
                      storeParams,
                      { deduplication: dedupConfig },
                    );
                    extractedFacts.push(result.fact);
                  } else {
                    // Deduplication disabled - use regular store
                    const storedFact = await this.facts.store(storeParams);
                    extractedFacts.push(storedFact);
                  }
                }
              } catch (error) {
                console.warn("Failed to store fact:", error);
              }
            }
          }

          // Notify facts layer complete
          if (observer) {
            // Build revision info from the accumulated actions
            const lastRevisionAction =
              revisionActions[revisionActions.length - 1];
            const event = this.createLayerEvent(
              "facts",
              "complete",
              orchestrationStartTime,
              {
                id: extractedFacts[0]?.factId,
                preview: `${extractedFacts.length} facts extracted`,
                metadata: { factIds: extractedFacts.map((f) => f.factId) },
              },
              undefined,
              lastRevisionAction
                ? {
                    action: lastRevisionAction.action as RevisionAction,
                    supersededFacts: lastRevisionAction.superseded?.map(
                      (f) => f.factId,
                    ),
                  }
                : undefined,
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
              undefined,
              {
                message: error instanceof Error ? error.message : String(error),
              },
            );
            layerEvents.facts = event;
            this.notifyLayerUpdate(observer, event);
          }
          // Don't throw - fact extraction failures are non-fatal
        }
      } else if (observer) {
        // No fact extractor available - mark as skipped
        const event = this.createLayerEvent(
          "facts",
          "skipped",
          orchestrationStartTime,
        );
        layerEvents.facts = event;
        this.notifyLayerUpdate(observer, event);
      }
    } else if (observer) {
      const event = this.createLayerEvent(
        "facts",
        "skipped",
        orchestrationStartTime,
      );
      layerEvents.facts = event;
      this.notifyLayerUpdate(observer, event);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: GRAPH (automatic when CORTEX_GRAPH_SYNC=true)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Graph sync is handled automatically by each layer when graphAdapter is configured
    // We just need to notify the observer of the status
    if (observer) {
      if (shouldSyncToGraph) {
        // Graph sync was handled inline - mark as complete
        const event = this.createLayerEvent(
          "graph",
          "complete",
          orchestrationStartTime,
          {
            preview: "Graph sync completed with layer operations",
          },
        );
        layerEvents.graph = event;
        this.notifyLayerUpdate(observer, event);
      } else {
        // Graph sync was disabled or not configured
        const event = this.createLayerEvent(
          "graph",
          "skipped",
          orchestrationStartTime,
        );
        layerEvents.graph = event;
        this.notifyLayerUpdate(observer, event);
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ORCHESTRATION COMPLETE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (observer) {
      const summary: OrchestrationSummary = {
        orchestrationId,
        totalLatencyMs: Date.now() - orchestrationStartTime,
        layers: layerEvents as Record<MemoryLayer, LayerEvent>,
        createdIds: {
          conversationId: params.conversationId,
          memoryIds: storedMemories.map((m) => m.memoryId),
          factIds: extractedFacts.map((f) => f.factId),
        },
      };
      this.notifyOrchestrationComplete(observer, summary);
    }

    return {
      conversation: {
        messageIds: userMsgId && agentMsgId ? [userMsgId, agentMsgId] : [],
        conversationId: params.conversationId,
      },
      memories: storedMemories,
      facts: extractedFacts,
      // Include belief revision actions if any were taken
      factRevisions: revisionActions.length > 0 ? revisionActions : undefined,
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
  async rememberStream(
    params: RememberStreamParams,
    options?: import("../types/streaming").StreamingOptions,
  ): Promise<import("../types/streaming").EnhancedRememberStreamResult> {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // VALIDATION: Same validation as remember() but without agentResponse
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    validateConversationId(params.conversationId);
    validateContent(params.userMessage, "userMessage");
    validateStreamObject(params.responseStream);

    // Handle memorySpaceId - default to 'default' with warning if not specified
    let memorySpaceId = params.memorySpaceId;
    if (memorySpaceId === undefined || memorySpaceId === null) {
      // Not specified - use default with warning
      memorySpaceId = DEFAULT_MEMORY_SPACE_ID;
      console.warn(
        `[Cortex Warning] No memorySpaceId provided, using '${DEFAULT_MEMORY_SPACE_ID}'. ` +
          "Consider explicitly setting a memorySpaceId for proper memory isolation.",
      );
    } else if (memorySpaceId.trim().length === 0) {
      // Specified but empty/whitespace - this is an error
      throw new MemoryValidationError(
        "memorySpaceId cannot be empty. Either provide a valid memorySpaceId or omit it to use the default.",
        "INVALID_MEMORYSPACE_ID",
        "memorySpaceId",
      );
    }

    // Validate owner attribution - at least one of userId or agentId required
    const hasUserId = params.userId && params.userId.trim().length > 0;
    const hasAgentId = params.agentId && params.agentId.trim().length > 0;

    if (!hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "Either userId or agentId must be provided for memory ownership. " +
          "Use userId for user-owned memories, agentId for agent-owned memories.",
        "OWNER_REQUIRED",
        "userId/agentId",
      );
    }

    // For user-agent conversations, require agentId when userId is provided
    if (hasUserId && !hasAgentId) {
      throw new MemoryValidationError(
        "agentId is required when userId is provided. " +
          "User-agent conversations require both a user and an agent participant.",
        "AGENT_REQUIRED_FOR_USER_CONVERSATION",
        "agentId",
      );
    }

    // Validate userName is provided when userId is provided
    if (
      hasUserId &&
      (!params.userName || params.userName.trim().length === 0)
    ) {
      throw new MemoryValidationError(
        "userName is required when userId is provided",
        "MISSING_REQUIRED_FIELD",
        "userName",
      );
    }

    if (params.importance !== undefined) {
      validateImportance(params.importance);
    }

    if (params.tags) {
      validateTags(params.tags);
    }

    // Determine owner for orchestration
    const ownerId = hasUserId ? params.userId! : params.agentId!;
    const ownerType = hasUserId ? "user" : "agent";
    const skipLayers = params.skipLayers || [];

    // Import streaming components (lazy to avoid circular deps)
    const { StreamProcessor, createStreamContext } = await import(
      "./streaming/StreamProcessor"
    );
    const { MetricsCollector } = await import("./streaming/StreamMetrics");
    const { ProgressiveStorageHandler } = await import(
      "./streaming/ProgressiveStorageHandler"
    );
    const { ProgressiveFactExtractor } = await import(
      "./streaming/FactExtractor"
    );
    const { StreamErrorRecovery, ResumableStreamError } = await import(
      "./streaming/ErrorRecovery"
    );
    const { AdaptiveStreamProcessor } = await import(
      "./streaming/AdaptiveProcessor"
    );
    // Note: ResponseChunker and shouldChunkContent are not currently used but kept for future chunking implementation
    const {
      ResponseChunker: _ResponseChunker,
      shouldChunkContent: _shouldChunkContent,
    } = await import("./streaming/ChunkingStrategies");
    const { ProgressiveGraphSync } = await import(
      "./streaming/ProgressiveGraphSync"
    );

    // Determine if we should sync to graph (automatic when graphAdapter is configured)
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    const shouldSyncToGraph =
      this.graphAdapter !== undefined &&
      !this.shouldSkipLayer("graph", skipLayers);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ORCHESTRATION: Same as remember() - auto-register entities
    // With observer notifications for real-time layer tracking
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const observer = params.observer;
    const orchestrationId = observer ? this.generateOrchestrationId() : "";
    const orchestrationStartTime = Date.now();
    const layerEvents: Partial<Record<MemoryLayer, LayerEvent>> = {};

    // Notify orchestration start
    if (observer) {
      this.notifyOrchestrationStart(observer, orchestrationId);
    }

    // STEP 1: MEMORYSPACE (Cannot be skipped)
    if (observer) {
      const event = this.createLayerEvent(
        "memorySpace",
        "in_progress",
        orchestrationStartTime,
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
          {
            id: memorySpaceId,
            preview: `Memory space: ${memorySpaceId}`,
          },
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
          undefined,
          {
            message: error instanceof Error ? error.message : String(error),
          },
        );
        layerEvents.memorySpace = event;
        this.notifyLayerUpdate(observer, event);
      }
      throw error;
    }

    // STEP 2: USER LAYER
    const shouldProcessUser =
      ownerType === "user" && !this.shouldSkipLayer("users", skipLayers);
    if (shouldProcessUser) {
      if (observer) {
        const event = this.createLayerEvent(
          "user",
          "in_progress",
          orchestrationStartTime,
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
            {
              id: ownerId,
              preview: `User: ${params.userName || ownerId}`,
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
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
      );
      layerEvents.user = event;
      this.notifyLayerUpdate(observer, event);
    }

    // STEP 3: AGENT LAYER
    const shouldProcessAgent =
      ownerType === "agent" && !this.shouldSkipLayer("agents", skipLayers);
    const shouldProcessSecondaryAgent =
      params.agentId &&
      params.userId &&
      !this.shouldSkipLayer("agents", skipLayers);

    if (shouldProcessAgent) {
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
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
            {
              id: ownerId,
              preview: `Agent: ${ownerId}`,
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
          );
          layerEvents.agent = event;
          this.notifyLayerUpdate(observer, event);
        }
        throw error;
      }
    } else if (shouldProcessSecondaryAgent) {
      // Handle case where userId is primary but agentId also needs registration
      if (observer) {
        const event = this.createLayerEvent(
          "agent",
          "in_progress",
          orchestrationStartTime,
        );
        layerEvents.agent = event;
        this.notifyLayerUpdate(observer, event);
      }
      try {
        await this.ensureAgentExists(params.agentId!);
        if (observer) {
          const event = this.createLayerEvent(
            "agent",
            "complete",
            orchestrationStartTime,
            {
              id: params.agentId!,
              preview: `Agent: ${params.agentId}`,
            },
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
            undefined,
            {
              message: error instanceof Error ? error.message : String(error),
            },
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
      );
      layerEvents.agent = event;
      this.notifyLayerUpdate(observer, event);
    }

    // Initialize components
    const metrics = new MetricsCollector();
    const context = createStreamContext({
      memorySpaceId,
      conversationId: params.conversationId,
      userId: params.userId || params.agentId || "unknown", // Use ownerId
      userName: params.userName || params.agentId || "Agent",
    });

    const processor = new StreamProcessor(
      context,
      options?.hooks || {},
      metrics,
    );
    const errorRecovery = new StreamErrorRecovery(this.client);

    // Progressive storage handler (if enabled)
    let storageHandler: InstanceType<typeof ProgressiveStorageHandler> | null =
      null;
    if (options?.storePartialResponse) {
      storageHandler = new ProgressiveStorageHandler(
        this.client,
        memorySpaceId,
        params.conversationId,
        params.userId || params.agentId || ownerId, // Use owner
        options.partialResponseInterval || 3000,
      );
    }

    // Progressive fact extractor (if enabled)
    // Note: factExtractor is prepared for future integration
    let _factExtractor: InstanceType<typeof ProgressiveFactExtractor> | null =
      null;
    if (options?.progressiveFactExtraction && params.extractFacts) {
      // Build deduplication config from params
      // Default to 'semantic' for convenience layer, falls back to 'structural'
      const dedupConfig = this.buildDeduplicationConfig(params);

      _factExtractor = new ProgressiveFactExtractor(
        this.facts,
        memorySpaceId,
        ownerId, // Use validated owner (userId or agentId)
        params.participantId,
        {
          extractionThreshold: options.factExtractionThreshold || 500,
          deduplication: dedupConfig,
        },
      );
    }

    // Adaptive processor (if enabled)
    // Note: adaptiveProcessor is prepared for future integration
    let _adaptiveProcessor: InstanceType<
      typeof AdaptiveStreamProcessor
    > | null = null;
    if (options?.enableAdaptiveProcessing) {
      _adaptiveProcessor = new AdaptiveStreamProcessor();
    }

    // Progressive graph sync (if enabled)
    let graphSync: InstanceType<typeof ProgressiveGraphSync> | null = null;
    if (options?.progressiveGraphSync && this.graphAdapter) {
      graphSync = new ProgressiveGraphSync(
        this.graphAdapter,
        options.graphSyncInterval || 5000,
      );
    }

    const progressiveFacts: import("../types/streaming").ProgressiveFact[] = [];
    let fullResponse = "";

    try {
      // Ensure conversation exists (if not skipped)
      if (!this.shouldSkipLayer("conversations", skipLayers)) {
        const existingConversation = await this.conversations.get(
          params.conversationId,
        );
        if (!existingConversation) {
          await this.conversations.create(
            {
              memorySpaceId,
              conversationId: params.conversationId,
              type: "user-agent",
              participants: {
                userId: params.userId,
                agentId: params.agentId, // The agent in this conversation
                participantId: params.participantId, // Hive Mode: who created this
              },
            },
            { syncToGraph: shouldSyncToGraph },
          );
        }
      }

      // Step 2: Initialize progressive storage
      if (storageHandler) {
        const partialMemoryId = await storageHandler.initializePartialMemory({
          participantId: params.participantId,
          userMessage: params.userMessage,
          importance: params.importance,
          tags: params.tags,
        });
        context.partialMemoryId = partialMemoryId;

        // Initialize graph node if enabled
        if (graphSync) {
          await graphSync.initializePartialNode({
            memoryId: partialMemoryId,
            memorySpaceId: params.memorySpaceId,
            userId: params.userId,
            content: "[Streaming...]",
          });
        }
      }

      // Step 3: Process stream with all features
      fullResponse = await processor.processStream(
        params.responseStream,
        options || {},
      );

      // Step 4: Progressive processing during stream
      // (This is handled by StreamProcessor hooks and integrated components)

      // Step 5: Validate we got content
      if (!fullResponse || fullResponse.trim().length === 0) {
        throw new Error("Response stream completed but produced no content.");
      }

      // Step 6: Finalize storage
      if (storageHandler && storageHandler.isReady()) {
        await storageHandler.finalizeMemory(
          fullResponse,
          params.generateEmbedding
            ? (await params.generateEmbedding(fullResponse)) || undefined
            : undefined,
        );
      }

      // Step 7: Use remember() for final storage
      // Note: remember() will handle remaining orchestration (conversation, vector, facts, graph)
      // We pass skipLayers to avoid double-orchestration since we already did memorySpace, user, agent above
      // We pass the observer so remember() can emit events for conversation, vector, facts, graph layers
      const rememberResult = await this.remember(
        {
          memorySpaceId, // Use normalized memorySpaceId
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
            "users", // Already handled above
            "agents", // Already handled above
            // Pass through other user-requested skip layers
            ...(this.shouldSkipLayer("conversations", skipLayers)
              ? ["conversations" as const]
              : []),
            ...(this.shouldSkipLayer("facts", skipLayers)
              ? ["facts" as const]
              : []),
            ...(this.shouldSkipLayer("vector", skipLayers)
              ? ["vector" as const]
              : []),
            ...(this.shouldSkipLayer("graph", skipLayers)
              ? ["graph" as const]
              : []),
          ],
        },
        {
          // Translate streaming beliefRevision (boolean) to remember() format
          // true → { enabled: true }, false → false, undefined → undefined
          beliefRevision:
            options?.beliefRevision === true
              ? { enabled: true }
              : options?.beliefRevision === false
                ? false
                : undefined,
        },
      );

      // Step 8: Finalize graph sync
      if (graphSync && rememberResult.memories.length > 0) {
        await graphSync.finalizeNode(rememberResult.memories[0]);
      }

      // Step 9: Generate performance insights
      const metricsSnapshot = metrics.getSnapshot();
      const insights = metrics.generateInsights();

      // Step 10: Return enhanced result
      return {
        ...rememberResult,
        fullResponse,
        streamMetrics: metricsSnapshot,
        progressiveProcessing: {
          factsExtractedDuringStream: progressiveFacts,
          partialStorageHistory: storageHandler?.getUpdateHistory() || [],
          graphSyncEvents: graphSync?.getSyncEvents(),
        },
        performance: {
          bottlenecks: insights.bottlenecks,
          recommendations: insights.recommendations,
          costEstimate: metricsSnapshot.estimatedCost,
        },
      };
    } catch (error) {
      // Error recovery
      const _streamError = errorRecovery.createStreamError(
        error instanceof Error ? error : new Error(String(error)),
        context,
        "streaming",
      );

      // Handle based on strategy
      if (options?.partialFailureHandling) {
        const recoveryResult = await errorRecovery.handleStreamError(
          error instanceof Error ? error : new Error(String(error)),
          context,
          {
            strategy: options.partialFailureHandling,
            maxRetries: options.maxRetries,
            retryDelay: options.retryDelay,
            preservePartialData: true,
          },
        );

        if (recoveryResult.success && options.generateResumeToken) {
          throw new ResumableStreamError(
            error instanceof Error ? error : new Error(String(error)),
            recoveryResult.resumeToken || "",
          );
        }
      }

      // Cleanup on failure
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
  async forget(
    memorySpaceId: string,
    memoryId: string,
    options?: ExtendedForgetOptions,
  ): Promise<ForgetResult> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);

    // Get the memory first
    const memory = await this.vector.get(memorySpaceId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Graph sync is automatic when graphAdapter is configured
    // (controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization)

    // Delete from vector (graph sync handled automatically)
    await this.vector.delete(memorySpaceId, memoryId);

    // Cascade delete associated facts (graph sync handled automatically)
    const { count: factsDeleted, factIds } = await this.cascadeDeleteFacts(
      memorySpaceId,
      memoryId,
      memory.conversationRef?.conversationId,
    );

    let conversationDeleted = false;
    let messagesDeleted = 0;

    // Optionally delete from ACID
    if (options?.deleteConversation && memory.conversationRef) {
      if (options.deleteEntireConversation) {
        // Get conversation first to count messages
        const conv = await this.conversations.get(
          memory.conversationRef.conversationId,
        );

        messagesDeleted = conv?.messageCount || 0;

        // Delete entire conversation (graph sync handled automatically)
        await this.conversations.delete(
          memory.conversationRef.conversationId,
        );
        conversationDeleted = true;
      } else {
        // Delete specific messages (not implemented in Layer 1a yet)
        // For now, just note that messages would be deleted
        messagesDeleted = memory.conversationRef.messageIds.length;
      }
    }

    return {
      memoryDeleted: true,
      conversationDeleted,
      messagesDeleted,
      factsDeleted,
      factIds,
      restorable: !options?.deleteConversation, // Restorable if ACID preserved
    };
  }

  /**
   * Get memory with optional ACID enrichment
   *
   * @param memorySpaceId - Memory space that contains the memory
   * @param memoryId - Memory ID to retrieve
   * @param options - Options for retrieval (includeConversation)
   * @returns MemoryEntry, EnrichedMemory (if includeConversation), or null
   *
   * @example
   * ```typescript
   * const enriched = await cortex.memory.get('user-123-space', 'mem-123', {
   *   includeConversation: true,
   * });
   * ```
   */
  async get(
    memorySpaceId: string,
    memoryId: string,
    options?: GetMemoryOptions,
  ): Promise<MemoryEntry | EnrichedMemory | null> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);

    // Get from vector
    const memory = await this.vector.get(memorySpaceId, memoryId);

    if (!memory) {
      return null;
    }

    // If no enrichment, return vector only
    if (!options?.includeConversation) {
      return memory;
    }

    // Fetch conversation if exists
    let conversation = undefined;
    let sourceMessages = undefined;

    if (memory.conversationRef) {
      const conv = await this.conversations.get(
        memory.conversationRef.conversationId,
      );

      conversation = conv ?? undefined;

      if (conversation) {
        sourceMessages = conversation.messages.filter((m) =>
          memory.conversationRef!.messageIds.includes(m.id),
        );
      }
    }

    // Fetch associated facts
    const relatedFacts = await this.fetchFactsForMemory(
      memorySpaceId,
      memoryId,
      memory.conversationRef?.conversationId,
    );

    return {
      memory,
      conversation,
      sourceMessages,
      facts: relatedFacts.length > 0 ? relatedFacts : undefined,
    };
  }

  /**
   * Search memories with optional ACID enrichment
   *
   * @param memorySpaceId - Memory space to search in
   * @param query - Search query string
   * @param options - Search options (embedding, filters, enrichConversation)
   * @returns Array of MemoryEntry or EnrichedMemory results
   *
   * @example
   * ```typescript
   * const results = await cortex.memory.search('user-123-space', 'password', {
   *   embedding: await embed('password'),
   *   enrichConversation: true,
   * });
   * ```
   */
  async search(
    memorySpaceId: string,
    query: string,
    options?: SearchMemoryOptions,
  ): Promise<MemoryEntry[] | EnrichedMemory[]> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateContent(query, "query");

    if (options) {
      validateSearchOptions(options);
    }

    // Search vector
    const memories = await this.vector.search(memorySpaceId, query, {
      embedding: options?.embedding,
      userId: options?.userId,
      tags: options?.tags,
      sourceType: options?.sourceType,
      minImportance: options?.minImportance,
      limit: options?.limit,
      minScore: options?.minScore,
    });

    // If no enrichment, return vector only
    if (!options?.enrichConversation) {
      return memories;
    }

    // Batch fetch conversations (avoid N+1 queries)
    const conversationIds = new Set(
      memories
        .filter((m) => m.conversationRef)
        .map((m) => m.conversationRef!.conversationId),
    );

    const conversations = new Map();

    for (const convId of conversationIds) {
      const conv = await this.conversations.get(convId);

      if (conv) {
        conversations.set(convId, conv);
      }
    }

    // Batch fetch all facts for this memory space
    const allFacts = await this.facts.list({
      memorySpaceId: memorySpaceId,
      limit: 10000,
    });

    // Create lookup maps for efficient fact matching
    const factsByMemoryId = new Map<string, FactRecord[]>();
    const factsByConversationId = new Map<string, FactRecord[]>();

    for (const fact of allFacts) {
      if (fact.sourceRef?.memoryId) {
        if (!factsByMemoryId.has(fact.sourceRef.memoryId)) {
          factsByMemoryId.set(fact.sourceRef.memoryId, []);
        }
        factsByMemoryId.get(fact.sourceRef.memoryId)!.push(fact);
      }

      if (fact.sourceRef?.conversationId) {
        if (!factsByConversationId.has(fact.sourceRef.conversationId)) {
          factsByConversationId.set(fact.sourceRef.conversationId, []);
        }
        factsByConversationId.get(fact.sourceRef.conversationId)!.push(fact);
      }
    }

    // Enrich results with conversations AND facts
    const enriched: EnrichedMemory[] = memories.map((memory) => {
      const result: EnrichedMemory = { memory };

      // Add conversation
      if (memory.conversationRef) {
        const conversation = conversations.get(
          memory.conversationRef.conversationId,
        ) as ConversationWithMessages | undefined;
        if (conversation) {
          result.conversation = conversation as unknown as Conversation;
          result.sourceMessages = conversation.messages.filter((m: Message) =>
            memory.conversationRef!.messageIds.includes(m.id),
          );
        }
      }

      // Add facts
      const relatedFacts = [
        ...(factsByMemoryId.get(memory.memoryId) || []),
        ...(memory.conversationRef
          ? factsByConversationId.get(memory.conversationRef.conversationId) ||
            []
          : []),
      ];

      // Deduplicate facts by factId
      const uniqueFacts = Array.from(
        new Map(relatedFacts.map((f) => [f.factId, f])).values(),
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
  async recall(params: RecallParams): Promise<RecallResult> {
    const startTime = Date.now();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: VALIDATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    validateRecallParams(params);

    // Apply defaults (batteries included)
    const sources = {
      vector: params.sources?.vector !== false,
      facts: params.sources?.facts !== false,
      graph: params.sources?.graph !== false && this.graphAdapter !== undefined,
    };

    const graphExpansionEnabled =
      params.graphExpansion?.enabled !== false &&
      this.graphAdapter !== undefined;

    const graphExpansionConfig: GraphExpansionConfig = {
      maxDepth: params.graphExpansion?.maxDepth ?? 2,
      relationshipTypes: params.graphExpansion?.relationshipTypes ?? [],
      expandFromFacts: params.graphExpansion?.expandFromFacts !== false,
      expandFromMemories: params.graphExpansion?.expandFromMemories !== false,
    };

    const limit = params.limit ?? 20;
    const includeConversation = params.includeConversation !== false;
    const formatForLLMFlag = params.formatForLLM !== false;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: PARALLEL SEARCH - Vector + Facts
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const effectiveTenantId = params.tenantId ?? this.authContext?.tenantId;

    const [rawVectorMemories, rawDirectFacts] = await Promise.all([
      // Vector search
      sources.vector
        ? this.vector.search(params.memorySpaceId, params.query, {
            embedding: params.embedding,
            userId: params.userId,
            tags: params.tags,
            minImportance: params.minImportance,
            limit: limit * 4, // Fetch extra for tenant filtering and dedup
            minScore: 0.3, // Reasonable threshold
          })
        : Promise.resolve([]),

      // Facts search
      sources.facts
        ? this.facts.search(params.memorySpaceId, params.query, {
            userId: params.userId,
            minConfidence: params.minConfidence,
            tags: params.tags,
            createdAfter: params.createdAfter,
            createdBefore: params.createdBefore,
            limit: limit * 4, // Fetch extra for tenant filtering and dedup
          })
        : Promise.resolve([]),
    ]);

    // Apply tenant isolation filter if tenantId is configured
    const vectorMemories = effectiveTenantId
      ? rawVectorMemories.filter((m) => m.tenantId === effectiveTenantId)
      : rawVectorMemories;

    const directFacts = effectiveTenantId
      ? rawDirectFacts.filter((f) => f.tenantId === effectiveTenantId)
      : rawDirectFacts;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: GRAPH EXPANSION (if enabled)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let graphExpandedMemories: MemoryEntry[] = [];
    let graphExpandedFacts: FactRecord[] = [];
    let discoveredEntities: string[] = [];

    if (graphExpansionEnabled && this.graphAdapter) {
      try {
        const expansion = await performGraphExpansion(
          vectorMemories,
          directFacts,
          params.memorySpaceId,
          this.graphAdapter,
          this.vector,
          this.facts,
          graphExpansionConfig,
        );

        graphExpandedMemories = expansion.relatedMemories;
        graphExpandedFacts = expansion.relatedFacts;
        discoveredEntities = expansion.discoveredEntities;
      } catch (error) {
        // Graph expansion failed - continue with direct results
        console.warn(
          "[Cortex] Graph expansion failed, continuing without:",
          error,
        );
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: MERGE, DEDUPE, RANK, FORMAT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const processedResults = processRecallResults(
      vectorMemories,
      directFacts,
      graphExpandedMemories,
      graphExpandedFacts,
      discoveredEntities,
      {
        limit,
        formatForLLM: formatForLLMFlag,
      },
    );
    let items = processedResults.items;
    const sourceBreakdown = processedResults.sources;
    const context = processedResults.context;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: CONVERSATION ENRICHMENT (if enabled)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (includeConversation) {
      // Collect unique conversation IDs
      const conversationIds = new Set<string>();
      for (const item of items) {
        if (item.type === "memory" && item.memory?.conversationRef) {
          conversationIds.add(item.memory.conversationRef.conversationId);
        }
      }

      // Batch fetch conversations
      if (conversationIds.size > 0) {
        const conversationsMap = new Map<string, Conversation>();
        for (const convId of conversationIds) {
          try {
            const conv = await this.conversations.get(convId);
            if (conv) {
              conversationsMap.set(convId, conv);
            }
          } catch {
            // Individual conversation fetch failure - continue
          }
        }

        // Enrich items
        items = enrichWithConversations(items, conversationsMap);
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: BUILD RESULT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const queryTimeMs = Date.now() - startTime;

    return {
      items,
      sources: sourceBreakdown,
      context,
      totalResults:
        vectorMemories.length +
        directFacts.length +
        graphExpandedMemories.length +
        graphExpandedFacts.length,
      queryTimeMs,
      graphExpansionApplied:
        graphExpansionEnabled && discoveredEntities.length > 0,
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
  async store(
    memorySpaceId: string,
    input: StoreMemoryInput,
  ): Promise<StoreMemoryResult> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateStoreMemoryInput(input);
    validateConversationRefRequirement(
      input.source.type,
      input.conversationRef,
    );

    // Store memory
    const memory = await this.vector.store(memorySpaceId, input);

    // Extract and store facts if callback provided
    const extractedFacts: FactRecord[] = [];

    if (input.extractFacts) {
      const factsToStore = await input.extractFacts(input.content);

      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            // Store fact (graph sync handled automatically)
            const storedFact = await this.facts.store({
              memorySpaceId: memorySpaceId,
              participantId: input.participantId,
              userId: input.userId, // ← BUG FIX: Add userId to facts!
              fact: factData.fact,
              factType: factData.factType,
              subject: factData.subject || input.userId,
              predicate: factData.predicate,
              object: factData.object,
              confidence: factData.confidence,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sourceType: input.source.type as any,
              sourceRef: {
                conversationId: input.conversationRef?.conversationId,
                messageIds: input.conversationRef?.messageIds,
                memoryId: memory.memoryId,
              },
              tags:
                factData.tags && factData.tags.length > 0
                  ? factData.tags
                  : input.metadata.tags,
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
      facts: extractedFacts,
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
  async update(
    memorySpaceId: string,
    memoryId: string,
    updates: {
      content?: string;
      embedding?: number[];
      importance?: number;
      tags?: string[];
    },
    options?: UpdateMemoryOptions,
  ): Promise<UpdateMemoryResult> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);
    validateUpdateOptions(updates);

    const updatedMemory = await this.vector.update(
      memorySpaceId,
      memoryId,
      updates,
    );

    const factsReextracted: FactRecord[] = [];

    // Re-extract facts if content changed and reextract requested
    if (options?.reextractFacts && updates.content && options.extractFacts) {
      // Delete old facts first (graph sync handled automatically)
      await this.cascadeDeleteFacts(memorySpaceId, memoryId, undefined);

      // Extract new facts
      const factsToStore = await options.extractFacts(updates.content);

      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            // Store new fact (graph sync handled automatically)
            const storedFact = await this.facts.store({
              memorySpaceId: memorySpaceId,
              participantId: updatedMemory.participantId, // ← BUG FIX: Add participantId
              userId: updatedMemory.userId, // ← BUG FIX: Add userId to facts!
              fact: factData.fact,
              factType: factData.factType,
              subject: factData.subject || updatedMemory.userId,
              predicate: factData.predicate,
              object: factData.object,
              confidence: factData.confidence,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sourceType: updatedMemory.sourceType as any,
              sourceRef: {
                conversationId: updatedMemory.conversationRef?.conversationId,
                messageIds: updatedMemory.conversationRef?.messageIds,
                memoryId: updatedMemory.memoryId,
              },
              tags:
                factData.tags && factData.tags.length > 0
                  ? factData.tags
                  : updatedMemory.tags,
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
      factsReextracted:
        factsReextracted.length > 0 ? factsReextracted : undefined,
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
  async delete(
    memorySpaceId: string,
    memoryId: string,
    options?: DeleteMemoryOptions,
  ): Promise<DeleteMemoryResult> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);

    const memory = await this.vector.get(memorySpaceId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Graph sync is automatic when graphAdapter is configured
    // (controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization)
    const shouldCascade = options?.cascadeDeleteFacts !== false; // Default: true

    // Delete facts if cascade enabled (graph sync handled automatically)
    let factsDeleted = 0;
    let factIds: string[] = [];

    if (shouldCascade) {
      const result = await this.cascadeDeleteFacts(
        memorySpaceId,
        memoryId,
        memory.conversationRef?.conversationId,
      );
      factsDeleted = result.count;
      factIds = result.factIds;
    }

    // Delete from vector (graph sync handled automatically)
    await this.vector.delete(memorySpaceId, memoryId);

    return {
      deleted: true,
      memoryId,
      factsDeleted,
      factIds,
    };
  }

  /**
   * List memories with optional fact enrichment
   */
  async list(
    filter: ListMemoriesFilter,
  ): Promise<MemoryEntry[] | EnrichedMemory[]> {
    // Client-side validation
    validateMemorySpaceId(filter.memorySpaceId);

    if (filter.userId !== undefined) {
      validateUserId(filter.userId, "userId");
    }

    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }

    if (filter.limit !== undefined) {
      validateLimit(filter.limit);
    }

    const memories = await this.vector.list(filter);

    if (!filter.enrichFacts) {
      return memories;
    }

    // Batch fetch facts
    const allFacts = await this.facts.list({
      memorySpaceId: filter.memorySpaceId,
      limit: 10000,
    });

    const factsByMemoryId = new Map<string, FactRecord[]>();

    for (const fact of allFacts) {
      if (fact.sourceRef?.memoryId) {
        if (!factsByMemoryId.has(fact.sourceRef.memoryId)) {
          factsByMemoryId.set(fact.sourceRef.memoryId, []);
        }
        factsByMemoryId.get(fact.sourceRef.memoryId)!.push(fact);
      }
    }

    return memories.map((memory) => ({
      memory,
      facts: factsByMemoryId.get(memory.memoryId),
    }));
  }

  /**
   * Count memories (delegates to vector.count)
   */
  async count(filter: CountMemoriesFilter): Promise<number> {
    // Client-side validation
    validateMemorySpaceId(filter.memorySpaceId);

    if (filter.userId !== undefined) {
      validateUserId(filter.userId, "userId");
    }

    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }

    return await this.vector.count(filter);
  }

  /**
   * Update many memories and track affected facts
   */
  async updateMany(
    filter: {
      memorySpaceId: string;
      userId?: string;
      sourceType?: SourceType;
    },
    updates: {
      importance?: number;
      tags?: string[];
    },
  ): Promise<UpdateManyResult> {
    // Client-side validation
    validateMemorySpaceId(filter.memorySpaceId);
    validateUpdateOptions(updates);

    if (filter.userId !== undefined) {
      validateUserId(filter.userId, "userId");
    }

    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.vector.updateMany(filter as any, updates);

    // Count facts that reference updated memories
    const allFacts = await this.facts.list({
      memorySpaceId: filter.memorySpaceId,
      limit: 10000,
    });

    const affectedFacts = allFacts.filter((fact) =>
      result.memoryIds.includes(fact.sourceRef?.memoryId || ""),
    );

    return {
      ...result,
      factsAffected: affectedFacts.length,
    };
  }

  /**
   * Delete many memories with batch cascade delete of facts
   */
  async deleteMany(filter: {
    memorySpaceId: string;
    userId?: string;
    sourceType?: SourceType;
  }): Promise<DeleteManyResult> {
    // Client-side validation
    validateMemorySpaceId(filter.memorySpaceId);
    validateFilterCombination(filter);

    if (filter.userId !== undefined) {
      validateUserId(filter.userId, "userId");
    }

    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }

    // Get all memories to delete
    const memories = await this.vector.list(filter);

    let totalFactsDeleted = 0;
    const allFactIds: string[] = [];

    // Cascade delete facts for each memory (graph sync handled automatically)
    for (const memory of memories) {
      const { count, factIds } = await this.cascadeDeleteFacts(
        filter.memorySpaceId,
        memory.memoryId,
        memory.conversationRef?.conversationId,
      );
      totalFactsDeleted += count;
      allFactIds.push(...factIds);
    }

    // Delete memories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.vector.deleteMany(filter as any);

    return {
      ...result,
      factsDeleted: totalFactsDeleted,
      factIds: allFactIds,
    };
  }

  /**
   * Export memories with optional fact inclusion
   */
  async export(options: ExportMemoriesOptions): Promise<{
    format: string;
    data: string;
    count: number;
    exportedAt: number;
  }> {
    // Client-side validation
    validateMemorySpaceId(options.memorySpaceId);
    validateExportFormat(options.format);

    if (options.userId !== undefined) {
      validateUserId(options.userId, "userId");
    }

    const result = await this.vector.export(options);

    if (!options.includeFacts) {
      return result;
    }

    // Fetch all facts for this memory space
    const facts = await this.facts.list({
      memorySpaceId: options.memorySpaceId,
      limit: 10000,
    });

    // Parse existing export data
    const data = JSON.parse(result.data) as MemoryEntry[];

    // Add facts to each memory
    const enrichedData = data.map((memory: MemoryEntry) => {
      const relatedFacts = facts.filter(
        (fact) => fact.sourceRef?.memoryId === memory.memoryId,
      );

      return {
        ...memory,
        facts: relatedFacts.map((f) => ({
          factId: f.factId,
          fact: f.fact,
          factType: f.factType,
          confidence: f.confidence,
          tags: f.tags,
        })),
      };
    });

    return {
      ...result,
      data: JSON.stringify(enrichedData, null, 2),
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
  async archive(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<ArchiveResult> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);

    const memory = await this.vector.get(memorySpaceId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Archive facts (mark as expired, not deleted)
    // Graph sync handled automatically
    const { count: factsArchived, factIds } = await this.archiveFacts(
      memorySpaceId,
      memoryId,
      memory.conversationRef?.conversationId,
    );

    // Archive memory
    const result = await this.vector.archive(memorySpaceId, memoryId);

    return {
      ...result,
      factsArchived,
      factIds,
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
  async restoreFromArchive(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<{
    restored: boolean;
    memoryId: string;
    memory: MemoryEntry;
  }> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memories.restoreFromArchive, {
          memorySpaceId,
          memoryId,
        }),
      "memory:restoreFromArchive",
    );

    return result as {
      restored: boolean;
      memoryId: string;
      memory: MemoryEntry;
    };
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
  async getVersion(
    memorySpaceId: string,
    memoryId: string,
    version: number,
  ): Promise<{
    memoryId: string;
    version: number;
    content: string;
    embedding?: number[];
    timestamp: number;
  } | null> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);
    validateVersion(version);

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
  async getHistory(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<
    Array<{
      memoryId: string;
      version: number;
      content: string;
      embedding?: number[];
      timestamp: number;
    }>
  > {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);

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
  async getAtTimestamp(
    memorySpaceId: string,
    memoryId: string,
    timestamp: number | Date,
  ): Promise<{
    memoryId: string;
    version: number;
    content: string;
    embedding?: number[];
    timestamp: number;
  } | null> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId, "memorySpaceId");
    validateMemoryId(memoryId);
    validateTimestamp(timestamp);

    return await this.vector.getAtTimestamp(memorySpaceId, memoryId, timestamp);
  }
}

// Export validation error for users who want to catch it specifically
export { MemoryValidationError } from "./validators";
