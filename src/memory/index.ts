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
import { FactsAPI } from "../facts";
import type { MemorySpacesAPI } from "../memorySpaces";
import type { UsersAPI } from "../users";
import type { AgentsAPI } from "../agents";
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
} from "../types";
import type { GraphAdapter } from "../graph/types";
import type { LLMConfig } from "../index";
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
} from "./validators";
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

    // Pass resilience layer to sub-APIs
    this.conversations = new ConversationsAPI(client, graphAdapter, resilience);
    this.vector = new VectorAPI(client, graphAdapter, resilience);
    this.facts = new FactsAPI(client, graphAdapter, resilience);
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
   */
  private async cascadeDeleteFacts(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
    syncToGraph?: boolean,
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
        await this.facts.delete(memorySpaceId, fact.factId, { syncToGraph });
        deletedFactIds.push(fact.factId);
      } catch (error) {
        console.warn("Failed to delete linked fact:", error);
      }
    }

    return { count: deletedFactIds.length, factIds: deletedFactIds };
  }

  /**
   * Helper: Archive facts (mark as expired)
   */
  private async archiveFacts(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
    syncToGraph?: boolean,
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
        await this.facts.update(
          memorySpaceId,
          fact.factId,
          {
            validUntil: Date.now(),
            tags: [...fact.tags, "archived"],
          },
          { syncToGraph },
        );
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
    if (hasUserId && (!params.userName || params.userName.trim().length === 0)) {
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
   */
  private async ensureMemorySpaceExists(
    memorySpaceId: string,
    syncToGraph: boolean,
  ): Promise<void> {
    if (!this.memorySpacesAPI) {
      // No memorySpaces API available - skip auto-registration
      return;
    }

    const existingSpace = await this.memorySpacesAPI.get(memorySpaceId);
    if (!existingSpace) {
      await this.memorySpacesAPI.register(
        {
          memorySpaceId,
          type: "custom",
          name: memorySpaceId,
        },
        { syncToGraph },
      );
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
  private getFactExtractor(
    params: RememberParams,
  ): ((
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
  }> | null>) | null {
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
   * Create an LLM-based fact extractor function
   */
  private createLLMFactExtractor(): (
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
  }> | null> {
    // This is a placeholder implementation - in production, this would call the LLM
    // For now, we return a function that returns null (no facts extracted)
    // This allows the feature flag to work while actual LLM integration is added later
    return async (
      _userMessage: string,
      _agentResponse: string,
    ): Promise<Array<{
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
    }> | null> => {
      // TODO: Implement actual LLM-based fact extraction
      // For now, silently skip - LLM integration will be added in a future PR
      console.debug(
        "[Cortex] LLM fact extraction is configured but not yet implemented. " +
          "Provide an extractFacts function or wait for LLM integration.",
      );
      return null;
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

    // Determine if we should sync to graph (default: true if configured)
    const shouldSyncToGraph =
      options?.syncToGraph !== false &&
      this.graphAdapter !== undefined &&
      !this.shouldSkipLayer("graph", skipLayers);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: MEMORYSPACE (Cannot be skipped)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.ensureMemorySpaceExists(memorySpaceId, shouldSyncToGraph);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: OWNER PROFILES (skip: 'users'/'agents')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ownerType === "user" && !this.shouldSkipLayer("users", skipLayers)) {
      await this.ensureUserExists(ownerId, params.userName);
    }

    if (ownerType === "agent" && !this.shouldSkipLayer("agents", skipLayers)) {
      await this.ensureAgentExists(ownerId);
    }

    // Also ensure agentId is registered if both userId and agentId are provided
    if (
      params.agentId &&
      params.userId &&
      !this.shouldSkipLayer("agents", skipLayers)
    ) {
      await this.ensureAgentExists(params.agentId);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: CONVERSATION (skip: 'conversations')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let userMsgId: string | undefined;
    let agentMsgId: string | undefined;

    if (!this.shouldSkipLayer("conversations", skipLayers)) {
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

        await this.conversations.create(
          {
            memorySpaceId,
            conversationId: params.conversationId,
            type: conversationType,
            participants,
          },
          { syncToGraph: shouldSyncToGraph },
        );
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
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: VECTOR MEMORY (skip: 'vector')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const storedMemories: MemoryEntry[] = [];

    if (!this.shouldSkipLayer("vector", skipLayers)) {
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
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: FACTS (skip: 'facts')
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const extractedFacts: FactRecord[] = [];

    if (!this.shouldSkipLayer("facts", skipLayers)) {
      const factExtractor = this.getFactExtractor(params);

      if (factExtractor) {
        try {
          const factsToStore = await factExtractor(
            params.userMessage,
            params.agentResponse,
          );

          if (factsToStore && factsToStore.length > 0) {
            for (const factData of factsToStore) {
              try {
                const storedFact = await this.facts.store(
                  {
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
                      messageIds:
                        userMsgId && agentMsgId
                          ? [userMsgId, agentMsgId]
                          : undefined,
                      memoryId: storedMemories[0]?.memoryId,
                    },
                    tags: factData.tags || params.tags || [],
                  },
                  { syncToGraph: shouldSyncToGraph },
                );

                extractedFacts.push(storedFact);
              } catch (error) {
                console.warn("Failed to store fact:", error);
              }
            }
          }
        } catch (error) {
          console.warn("Failed to extract facts:", error);
        }
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: GRAPH (handled via syncToGraph in previous steps)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Graph sync is handled inline with each layer via the syncToGraph option

    return {
      conversation: {
        messageIds:
          userMsgId && agentMsgId ? [userMsgId, agentMsgId] : [],
        conversationId: params.conversationId,
      },
      memories: storedMemories,
      facts: extractedFacts,
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
    if (hasUserId && (!params.userName || params.userName.trim().length === 0)) {
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

    // Determine if we should sync to graph (default: true if configured)
    const shouldSyncToGraph =
      options?.syncToGraph !== false &&
      this.graphAdapter !== undefined &&
      !this.shouldSkipLayer("graph", skipLayers);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ORCHESTRATION: Same as remember() - auto-register entities
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Auto-register memory space
    await this.ensureMemorySpaceExists(memorySpaceId, shouldSyncToGraph);

    // Auto-create user/agent profiles
    if (ownerType === "user" && !this.shouldSkipLayer("users", skipLayers)) {
      await this.ensureUserExists(ownerId, params.userName);
    }

    if (ownerType === "agent" && !this.shouldSkipLayer("agents", skipLayers)) {
      await this.ensureAgentExists(ownerId);
    }

    // Also ensure agentId is registered if both userId and agentId are provided
    if (
      params.agentId &&
      params.userId &&
      !this.shouldSkipLayer("agents", skipLayers)
    ) {
      await this.ensureAgentExists(params.agentId);
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
      _factExtractor = new ProgressiveFactExtractor(
        this.facts,
        memorySpaceId,
        ownerId, // Use validated owner (userId or agentId)
        params.participantId,
        options.factExtractionThreshold || 500,
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
      // Note: remember() will handle all orchestration (memorySpace, user, agent, etc.)
      // We pass skipLayers to avoid double-orchestration since we already did it above
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
          // Skip orchestration layers we already handled in rememberStream
          skipLayers: [
            "users", // Already handled above
            "agents", // Already handled above
            ...(this.shouldSkipLayer("conversations", skipLayers)
              ? ["conversations" as const]
              : []), // Pass through if user skipped
          ],
        },
        { syncToGraph: options?.syncToGraph },
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
  async forget(
    agentId: string,
    memoryId: string,
    options?: ExtendedForgetOptions,
  ): Promise<ForgetResult> {
    // Client-side validation
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);

    // Get the memory first
    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Determine if we should sync to graph (default: true if configured)
    const shouldSyncToGraph =
      options?.syncToGraph !== false && this.graphAdapter !== undefined;

    // Delete from vector (with graph cascade)
    await this.vector.delete(agentId, memoryId, {
      syncToGraph: shouldSyncToGraph,
    });

    // Cascade delete associated facts
    const { count: factsDeleted, factIds } = await this.cascadeDeleteFacts(
      agentId,
      memoryId,
      memory.conversationRef?.conversationId,
      shouldSyncToGraph,
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

        // Delete entire conversation (with graph cascade)
        await this.conversations.delete(memory.conversationRef.conversationId, {
          syncToGraph: shouldSyncToGraph,
        });
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
   * @example
   * ```typescript
   * const enriched = await cortex.memory.get('agent-1', 'mem-123', {
   *   includeConversation: true,
   * });
   * ```
   */
  async get(
    agentId: string,
    memoryId: string,
    options?: GetMemoryOptions,
  ): Promise<MemoryEntry | EnrichedMemory | null> {
    // Client-side validation
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);

    // Get from vector
    const memory = await this.vector.get(agentId, memoryId);

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
      agentId,
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
   * @example
   * ```typescript
   * const results = await cortex.memory.search('agent-1', 'password', {
   *   embedding: await embed('password'),
   *   enrichConversation: true,
   * });
   * ```
   */
  async search(
    agentId: string,
    query: string,
    options?: SearchMemoryOptions,
  ): Promise<MemoryEntry[] | EnrichedMemory[]> {
    // Client-side validation
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateContent(query, "query");

    if (options) {
      validateSearchOptions(options);
    }

    // Search vector
    const memories = await this.vector.search(agentId, query, {
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
      memorySpaceId: agentId,
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
   * Store memory with smart layer detection and optional fact extraction
   *
   * @example
   * ```typescript
   * await cortex.memory.store('agent-1', {
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
    agentId: string,
    input: StoreMemoryInput,
  ): Promise<StoreMemoryResult> {
    // Client-side validation
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateStoreMemoryInput(input);
    validateConversationRefRequirement(
      input.source.type,
      input.conversationRef,
    );

    // Store memory
    const memory = await this.vector.store(agentId, input);

    // Extract and store facts if callback provided
    const extractedFacts: FactRecord[] = [];

    if (input.extractFacts) {
      const factsToStore = await input.extractFacts(input.content);

      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            const storedFact = await this.facts.store(
              {
                memorySpaceId: agentId,
                participantId: input.participantId,
                userId: input.userId, // ← BUG FIX: Add userId to facts!
                fact: factData.fact,
                factType: factData.factType,
                subject: factData.subject || input.userId,
                predicate: factData.predicate,
                object: factData.object,
                confidence: factData.confidence,
                sourceType: input.source.type,
                sourceRef: {
                  conversationId: input.conversationRef?.conversationId,
                  messageIds: input.conversationRef?.messageIds,
                  memoryId: memory.memoryId,
                },
                tags:
                  factData.tags && factData.tags.length > 0
                    ? factData.tags
                    : input.metadata.tags,
              },
              { syncToGraph: true },
            );

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
   */
  async update(
    agentId: string,
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
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);
    validateUpdateOptions(updates);

    const updatedMemory = await this.vector.update(agentId, memoryId, updates);

    const factsReextracted: FactRecord[] = [];

    // Re-extract facts if content changed and reextract requested
    if (options?.reextractFacts && updates.content && options.extractFacts) {
      // Delete old facts first
      await this.cascadeDeleteFacts(
        agentId,
        memoryId,
        undefined,
        options.syncToGraph,
      );

      // Extract new facts
      const factsToStore = await options.extractFacts(updates.content);

      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            const storedFact = await this.facts.store(
              {
                memorySpaceId: agentId,
                participantId: updatedMemory.participantId, // ← BUG FIX: Add participantId
                userId: updatedMemory.userId, // ← BUG FIX: Add userId to facts!
                fact: factData.fact,
                factType: factData.factType,
                subject: factData.subject || updatedMemory.userId,
                predicate: factData.predicate,
                object: factData.object,
                confidence: factData.confidence,
                sourceType: updatedMemory.sourceType,
                sourceRef: {
                  conversationId: updatedMemory.conversationRef?.conversationId,
                  messageIds: updatedMemory.conversationRef?.messageIds,
                  memoryId: updatedMemory.memoryId,
                },
                tags:
                  factData.tags && factData.tags.length > 0
                    ? factData.tags
                    : updatedMemory.tags,
              },
              { syncToGraph: options.syncToGraph },
            );

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
   */
  async delete(
    agentId: string,
    memoryId: string,
    options?: DeleteMemoryOptions,
  ): Promise<DeleteMemoryResult> {
    // Client-side validation
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);

    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    const shouldSyncToGraph =
      options?.syncToGraph !== false && this.graphAdapter !== undefined;
    const shouldCascade = options?.cascadeDeleteFacts !== false; // Default: true

    // Delete facts if cascade enabled
    let factsDeleted = 0;
    let factIds: string[] = [];

    if (shouldCascade) {
      const result = await this.cascadeDeleteFacts(
        agentId,
        memoryId,
        memory.conversationRef?.conversationId,
        shouldSyncToGraph,
      );
      factsDeleted = result.count;
      factIds = result.factIds;
    }

    // Delete from vector
    await this.vector.delete(agentId, memoryId, {
      syncToGraph: shouldSyncToGraph,
    });

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

    const result = await this.vector.updateMany(filter, updates);

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

    // Cascade delete facts for each memory
    for (const memory of memories) {
      const { count, factIds } = await this.cascadeDeleteFacts(
        filter.memorySpaceId,
        memory.memoryId,
        memory.conversationRef?.conversationId,
        true,
      );
      totalFactsDeleted += count;
      allFactIds.push(...factIds);
    }

    // Delete memories
    const result = await this.vector.deleteMany(filter);

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
   */
  async archive(agentId: string, memoryId: string): Promise<ArchiveResult> {
    // Client-side validation
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);

    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Archive facts (mark as expired, not deleted)
    const { count: factsArchived, factIds } = await this.archiveFacts(
      agentId,
      memoryId,
      memory.conversationRef?.conversationId,
      true,
    );

    // Archive memory
    const result = await this.vector.archive(agentId, memoryId);

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

    const result = await this.client.mutation(api.memories.restoreFromArchive, {
      memorySpaceId,
      memoryId,
    });

    return result as {
      restored: boolean;
      memoryId: string;
      memory: MemoryEntry;
    };
  }

  /**
   * Get specific version (delegates to vector.getVersion)
   */
  async getVersion(
    agentId: string,
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
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);
    validateVersion(version);

    return await this.vector.getVersion(agentId, memoryId, version);
  }

  /**
   * Get version history (delegates to vector.getHistory)
   */
  async getHistory(
    agentId: string,
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
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);

    return await this.vector.getHistory(agentId, memoryId);
  }

  /**
   * Get version at timestamp (delegates to vector.getAtTimestamp)
   */
  async getAtTimestamp(
    agentId: string,
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
    validateMemorySpaceId(agentId, "memorySpaceId");
    validateMemoryId(memoryId);
    validateTimestamp(timestamp);

    return await this.vector.getAtTimestamp(agentId, memoryId, timestamp);
  }
}

// Export validation error for users who want to catch it specifically
export { MemoryValidationError } from "./validators";
