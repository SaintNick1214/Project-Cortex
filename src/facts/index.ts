/**
 * Cortex SDK - Facts API (Layer 3)
 *
 * Structured knowledge with versioning and relationships
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  CountFactsFilter,
  DeleteFactOptions,
  DeleteManyFactsParams,
  DeleteManyFactsResult,
  FactRecord,
  ListFactsFilter,
  QueryByRelationshipFilter,
  QueryBySubjectFilter,
  SearchFactsOptions,
  StoreFactOptions,
  StoreFactParams,
  UpdateFactInput,
  UpdateFactOptions,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import {
  syncFactToGraph,
  syncFactRelationships,
  deleteFactFromGraph,
} from "../graph";
import {
  validateMemorySpaceId,
  validateRequiredString,
  validateConfidence,
  validateFactType,
  validateSourceType,
  validateStringArray,
  validateValidityPeriod,
  validateSourceRef,
  validateMetadata,
  validateFactIdFormat,
  validateTagMatch,
  validateNonNegativeInteger,
  validateSortBy,
  validateSortOrder,
  validateDateRange,
  validateUpdateHasFields,
  validateConsolidation,
  validateExportFormat,
} from "./validators";
import type { ResilienceLayer } from "../resilience";
import {
  FactDeduplicationService,
  type DeduplicationConfig,
  type DeduplicationStrategy,
  type StoreWithDedupResult,
} from "./deduplication";
import {
  BeliefRevisionService,
  type BeliefRevisionConfig,
  type ReviseParams,
  type ReviseResult,
  type ConflictCheckResult,
  type BeliefRevisionLLMClient,
} from "./belief-revision";
import {
  FactHistoryService,
  type FactChangeEvent,
  type ChangeFilter,
  type ActivitySummary,
  type SupersessionChainEntry,
} from "./history";

/**
 * Extended options for storing facts with deduplication
 */
export interface StoreFactWithDedupOptions extends StoreFactOptions {
  /**
   * Deduplication configuration. Set to false to disable deduplication.
   *
   * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
   * - 'structural': Subject + predicate + object match (fast, good accuracy)
   * - 'exact': Normalized text match (fastest, lowest accuracy)
   * - false: Disable deduplication
   *
   * @default undefined (no deduplication at facts.store level)
   */
  deduplication?: DeduplicationConfig | DeduplicationStrategy | false;
}

/**
 * Extended options for belief revision
 */
export interface BeliefRevisionOptions extends StoreFactOptions {
  /**
   * Belief revision configuration
   */
  beliefRevision?: BeliefRevisionConfig | false;
}

import type { AuthContext } from "../auth/types";

export class FactsAPI {
  private deduplicationService: FactDeduplicationService;
  private beliefRevisionService?: BeliefRevisionService;
  private historyService: FactHistoryService;
  private llmClient?: BeliefRevisionLLMClient;
  private authContext?: AuthContext;

  constructor(
    private client: ConvexClient,
    private graphAdapter?: GraphAdapter,
    private resilience?: ResilienceLayer,
    authContext?: AuthContext,
    llmClient?: BeliefRevisionLLMClient,
    beliefRevisionConfig?: BeliefRevisionConfig,
  ) {
    this.authContext = authContext;
    this.llmClient = llmClient;
    this.deduplicationService = new FactDeduplicationService(client);
    this.historyService = new FactHistoryService(client, resilience);

    // Always initialize belief revision service - "batteries included"
    // When no LLM is configured, the service uses heuristics via getDefaultDecision()
    // This enables intelligent fact supersession even without an LLM for conflict resolution
    this.beliefRevisionService = new BeliefRevisionService(
      client,
      llmClient,
      graphAdapter,
      beliefRevisionConfig,
    );
  }

  /**
   * Configure or update the belief revision service
   */
  configureBeliefRevision(
    llmClient?: BeliefRevisionLLMClient,
    config?: BeliefRevisionConfig,
  ): void {
    this.beliefRevisionService = new BeliefRevisionService(
      this.client,
      llmClient || this.llmClient,
      this.graphAdapter,
      config,
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
  hasBeliefRevision(): boolean {
    return this.beliefRevisionService !== undefined;
  }

  /**
   * Handle ConvexError from direct Convex calls
   */
  private handleConvexError(error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "data" in error &&
      (error as { data: unknown }).data !== undefined
    ) {
      const convexError = error as { data: unknown };
      const errorData =
        typeof convexError.data === "string"
          ? convexError.data
          : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
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
  async store(
    params: StoreFactParams,
    _options?: StoreFactOptions,
  ): Promise<FactRecord> {
    // Validate required fields
    validateMemorySpaceId(params.memorySpaceId);
    validateRequiredString(params.fact, "fact");
    validateFactType(params.factType);
    validateConfidence(params.confidence, "confidence");
    validateSourceType(params.sourceType);

    // Validate optional fields if provided
    if (params.tags !== undefined) {
      validateStringArray(params.tags, "tags", true);
    }
    if (params.validFrom !== undefined && params.validUntil !== undefined) {
      validateValidityPeriod(params.validFrom, params.validUntil);
    }
    if (params.sourceRef !== undefined) {
      validateSourceRef(params.sourceRef);
    }
    if (params.metadata !== undefined) {
      validateMetadata(params.metadata);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.facts.store, {
          memorySpaceId: params.memorySpaceId,
          participantId: params.participantId,
          userId: params.userId,
          tenantId: this.authContext?.tenantId, // Inject tenantId from auth context
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
        }),
      "facts:store",
    );

    const factRecord = result as FactRecord;

    // Sync to graph automatically when graph adapter is configured
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    if (this.graphAdapter) {
      try {
        const nodeId = await syncFactToGraph(
          factRecord,
          this.graphAdapter,
          this.authContext?.tenantId,
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
  async storeWithDedup(
    params: StoreFactParams,
    options?: StoreFactWithDedupOptions,
  ): Promise<StoreWithDedupResult> {
    // If deduplication is disabled, just store normally
    if (options?.deduplication === false) {
      const fact = await this.store(params, options);
      return {
        fact,
        wasUpdated: false,
      };
    }

    // Resolve deduplication config
    const dedupConfig = FactDeduplicationService.resolveConfig(
      options?.deduplication,
    );

    // Skip dedup if strategy is 'none'
    if (dedupConfig.strategy === "none") {
      const fact = await this.store(params, options);
      return {
        fact,
        wasUpdated: false,
      };
    }

    // Check for duplicates
    const duplicateResult = await this.deduplicationService.findDuplicate(
      {
        fact: params.fact,
        factType: params.factType,
        subject: params.subject,
        predicate: params.predicate,
        object: params.object,
        confidence: params.confidence,
        tags: params.tags,
      },
      params.memorySpaceId,
      dedupConfig,
      params.userId,
    );

    // If duplicate found
    if (duplicateResult.isDuplicate && duplicateResult.existingFact) {
      const existing = duplicateResult.existingFact;

      // If new confidence is higher, update the existing fact
      if (duplicateResult.shouldUpdate) {
        const updatedFact = await this.update(
          params.memorySpaceId,
          existing.factId,
          {
            confidence: params.confidence,
            // Optionally update tags if new ones are provided
            tags: params.tags
              ? [...new Set([...existing.tags, ...params.tags])]
              : undefined,
          },
        );

        return {
          fact: updatedFact,
          wasUpdated: true,
          deduplication: {
            strategy: dedupConfig.strategy,
            matchedExisting: true,
            similarityScore: duplicateResult.similarityScore,
          },
        };
      }

      // Return existing fact without modification
      return {
        fact: existing,
        wasUpdated: false,
        deduplication: {
          strategy: dedupConfig.strategy,
          matchedExisting: true,
          similarityScore: duplicateResult.similarityScore,
        },
      };
    }

    // No duplicate found, store new fact
    const fact = await this.store(params, options);
    return {
      fact,
      wasUpdated: false,
      deduplication: {
        strategy: dedupConfig.strategy,
        matchedExisting: false,
      },
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
  async get(memorySpaceId: string, factId: string): Promise<FactRecord | null> {
    validateMemorySpaceId(memorySpaceId);
    validateRequiredString(factId, "factId");
    validateFactIdFormat(factId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.get, {
          memorySpaceId,
          factId,
          tenantId: this.authContext?.tenantId, // Inject tenantId for tenant isolation
        }),
      "facts:get",
    );

    return result as FactRecord | null;
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
  async list(filter: ListFactsFilter): Promise<FactRecord[]> {
    validateMemorySpaceId(filter.memorySpaceId);

    if (filter.factType !== undefined) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }
    if (filter.confidence !== undefined) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== undefined) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== undefined) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== undefined) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.limit !== undefined) {
      validateNonNegativeInteger(filter.limit, "limit");
    }
    if (filter.offset !== undefined) {
      validateNonNegativeInteger(filter.offset, "offset");
    }
    if (filter.sortBy !== undefined) {
      validateSortBy(filter.sortBy);
    }
    if (filter.sortOrder !== undefined) {
      validateSortOrder(filter.sortOrder);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore",
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore",
      );
    }
    if (filter.metadata !== undefined) {
      validateMetadata(filter.metadata);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.list, {
          memorySpaceId: filter.memorySpaceId,
          tenantId: this.authContext?.tenantId, // Tenant isolation
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
          sortOrder: filter.sortOrder,
        }),
      "facts:list",
    );

    return result as FactRecord[];
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
  async count(filter: CountFactsFilter): Promise<number> {
    validateMemorySpaceId(filter.memorySpaceId);

    if (filter.factType !== undefined) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }
    if (filter.confidence !== undefined) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== undefined) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== undefined) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== undefined) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore",
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore",
      );
    }
    if (filter.metadata !== undefined) {
      validateMetadata(filter.metadata);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.count, {
          memorySpaceId: filter.memorySpaceId,
          tenantId: this.authContext?.tenantId, // Tenant isolation
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
        }),
      "facts:count",
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
  async search(
    memorySpaceId: string,
    query: string,
    options?: SearchFactsOptions,
  ): Promise<FactRecord[]> {
    validateMemorySpaceId(memorySpaceId);
    validateRequiredString(query, "query");

    if (options) {
      if (options.factType !== undefined) {
        validateFactType(options.factType);
      }
      if (options.sourceType !== undefined) {
        validateSourceType(options.sourceType);
      }
      if (options.confidence !== undefined) {
        validateConfidence(options.confidence, "confidence");
      }
      if (options.minConfidence !== undefined) {
        validateConfidence(options.minConfidence, "minConfidence");
      }
      if (options.tags !== undefined) {
        validateStringArray(options.tags, "tags", true);
      }
      if (options.tagMatch !== undefined) {
        validateTagMatch(options.tagMatch);
      }
      if (options.limit !== undefined) {
        validateNonNegativeInteger(options.limit, "limit");
      }
      if (options.offset !== undefined) {
        validateNonNegativeInteger(options.offset, "offset");
      }
      if (options.sortBy !== undefined) {
        validateSortBy(options.sortBy);
      }
      if (options.sortOrder !== undefined) {
        validateSortOrder(options.sortOrder);
      }
      if (options.createdBefore && options.createdAfter) {
        validateDateRange(
          options.createdAfter,
          options.createdBefore,
          "createdAfter",
          "createdBefore",
        );
      }
      if (options.updatedBefore && options.updatedAfter) {
        validateDateRange(
          options.updatedAfter,
          options.updatedBefore,
          "updatedAfter",
          "updatedBefore",
        );
      }
      if (options.metadata !== undefined) {
        validateMetadata(options.metadata);
      }
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.search, {
          memorySpaceId,
          tenantId: this.authContext?.tenantId, // Tenant isolation
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
          sortOrder: options?.sortOrder,
        }),
      "facts:search",
    );

    return result as FactRecord[];
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
  async update(
    memorySpaceId: string,
    factId: string,
    updates: UpdateFactInput,
    _options?: UpdateFactOptions,
  ): Promise<FactRecord> {
    validateMemorySpaceId(memorySpaceId);
    validateRequiredString(factId, "factId");
    validateFactIdFormat(factId);
    validateUpdateHasFields(updates);

    if (updates.confidence !== undefined) {
      validateConfidence(updates.confidence, "confidence");
    }
    if (updates.tags !== undefined) {
      validateStringArray(updates.tags, "tags", true);
    }
    if (updates.metadata !== undefined) {
      validateMetadata(updates.metadata);
    }

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.facts.update, {
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
          }),
        "facts:update",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    const factRecord = result as FactRecord;

    // Sync to graph automatically when graph adapter is configured
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    if (this.graphAdapter) {
      try {
        const nodes = await this.graphAdapter.findNodes("Fact", { factId }, 1);
        if (nodes.length > 0) {
          await this.graphAdapter.updateNode(
            nodes[0].id!,
            updates as unknown as Record<string, unknown>,
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
  async delete(
    memorySpaceId: string,
    factId: string,
    _options?: DeleteFactOptions,
  ): Promise<{ deleted: boolean; factId: string }> {
    validateMemorySpaceId(memorySpaceId);
    validateRequiredString(factId, "factId");
    validateFactIdFormat(factId);

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.facts.deleteFact, {
            memorySpaceId,
            factId,
          }),
        "facts:delete",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Delete from graph automatically with Entity orphan cleanup
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    if (this.graphAdapter) {
      try {
        await deleteFactFromGraph(factId, this.graphAdapter, true);
      } catch (error) {
        console.warn("[Cortex] Failed to delete fact from graph:", error);
      }
    }

    return result as { deleted: boolean; factId: string };
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
  async deleteMany(
    params: DeleteManyFactsParams,
  ): Promise<DeleteManyFactsResult> {
    validateMemorySpaceId(params.memorySpaceId);

    if (params.factType !== undefined) {
      validateFactType(params.factType);
    }

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.facts.deleteMany, {
            memorySpaceId: params.memorySpaceId,
            userId: params.userId,
            factType: params.factType,
          }),
        "facts:deleteMany",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    return result as DeleteManyFactsResult;
  }

  /**
   * Get fact version history
   *
   * @example
   * ```typescript
   * const history = await cortex.facts.getHistory('space-1', 'fact-123');
   * ```
   */
  async getHistory(
    memorySpaceId: string,
    factId: string,
  ): Promise<FactRecord[]> {
    validateMemorySpaceId(memorySpaceId);
    validateRequiredString(factId, "factId");
    validateFactIdFormat(factId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.getHistory, {
          memorySpaceId,
          factId,
        }),
      "facts:getHistory",
    );

    return result as FactRecord[];
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
  async queryBySubject(filter: QueryBySubjectFilter): Promise<FactRecord[]> {
    validateMemorySpaceId(filter.memorySpaceId);
    validateRequiredString(filter.subject, "subject");

    if (filter.factType !== undefined) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }
    if (filter.confidence !== undefined) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== undefined) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== undefined) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== undefined) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.limit !== undefined) {
      validateNonNegativeInteger(filter.limit, "limit");
    }
    if (filter.offset !== undefined) {
      validateNonNegativeInteger(filter.offset, "offset");
    }
    if (filter.sortBy !== undefined) {
      validateSortBy(filter.sortBy);
    }
    if (filter.sortOrder !== undefined) {
      validateSortOrder(filter.sortOrder);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore",
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore",
      );
    }
    if (filter.metadata !== undefined) {
      validateMetadata(filter.metadata);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.queryBySubject, {
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
          sortOrder: filter.sortOrder,
        }),
      "facts:queryBySubject",
    );

    return result as FactRecord[];
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
  async queryByRelationship(
    filter: QueryByRelationshipFilter,
  ): Promise<FactRecord[]> {
    validateMemorySpaceId(filter.memorySpaceId);
    validateRequiredString(filter.subject, "subject");
    validateRequiredString(filter.predicate, "predicate");

    if (filter.factType !== undefined) {
      validateFactType(filter.factType);
    }
    if (filter.sourceType !== undefined) {
      validateSourceType(filter.sourceType);
    }
    if (filter.confidence !== undefined) {
      validateConfidence(filter.confidence, "confidence");
    }
    if (filter.minConfidence !== undefined) {
      validateConfidence(filter.minConfidence, "minConfidence");
    }
    if (filter.tags !== undefined) {
      validateStringArray(filter.tags, "tags", true);
    }
    if (filter.tagMatch !== undefined) {
      validateTagMatch(filter.tagMatch);
    }
    if (filter.limit !== undefined) {
      validateNonNegativeInteger(filter.limit, "limit");
    }
    if (filter.offset !== undefined) {
      validateNonNegativeInteger(filter.offset, "offset");
    }
    if (filter.sortBy !== undefined) {
      validateSortBy(filter.sortBy);
    }
    if (filter.sortOrder !== undefined) {
      validateSortOrder(filter.sortOrder);
    }
    if (filter.createdBefore && filter.createdAfter) {
      validateDateRange(
        filter.createdAfter,
        filter.createdBefore,
        "createdAfter",
        "createdBefore",
      );
    }
    if (filter.updatedBefore && filter.updatedAfter) {
      validateDateRange(
        filter.updatedAfter,
        filter.updatedBefore,
        "updatedAfter",
        "updatedBefore",
      );
    }
    if (filter.metadata !== undefined) {
      validateMetadata(filter.metadata);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.queryByRelationship, {
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
          sortOrder: filter.sortOrder,
        }),
      "facts:queryByRelationship",
    );

    return result as FactRecord[];
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
  async export(options: {
    memorySpaceId: string;
    format: "json" | "jsonld" | "csv";
    factType?:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "observation"
      | "custom";
  }): Promise<{
    format: string;
    data: string;
    count: number;
    exportedAt: number;
  }> {
    validateMemorySpaceId(options.memorySpaceId);
    validateExportFormat(options.format);

    if (options.factType !== undefined) {
      validateFactType(options.factType);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.exportFacts, {
          memorySpaceId: options.memorySpaceId,
          format: options.format,
          factType: options.factType,
        }),
      "facts:export",
    );

    return result as {
      format: string;
      data: string;
      count: number;
      exportedAt: number;
    };
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
  async consolidate(params: {
    memorySpaceId: string;
    factIds: string[];
    keepFactId: string;
  }): Promise<{
    consolidated: boolean;
    keptFactId: string;
    mergedCount: number;
  }> {
    validateMemorySpaceId(params.memorySpaceId);
    validateStringArray(params.factIds, "factIds", false);
    validateRequiredString(params.keepFactId, "keepFactId");
    validateConsolidation(params.factIds, params.keepFactId);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.facts.consolidate, {
          memorySpaceId: params.memorySpaceId,
          factIds: params.factIds,
          keepFactId: params.keepFactId,
        }),
      "facts:consolidate",
    );

    return result as {
      consolidated: boolean;
      keptFactId: string;
      mergedCount: number;
    };
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
  async revise(params: ReviseParams): Promise<ReviseResult> {
    validateMemorySpaceId(params.memorySpaceId);
    validateRequiredString(params.fact.fact, "fact.fact");
    validateConfidence(params.fact.confidence, "fact.confidence");

    if (!this.beliefRevisionService) {
      throw new Error(
        "Belief revision service not configured. Call configureBeliefRevision() first or provide LLM client in constructor.",
      );
    }

    const result = await this.beliefRevisionService.revise(params);

    // Log to history - map belief revision actions to history actions
    const historyAction =
      result.action === "NONE"
        ? "UPDATE"
        : result.action === "ADD"
          ? "CREATE"
          : result.action;

    await this.historyService.log({
      factId: result.fact.factId,
      memorySpaceId: params.memorySpaceId,
      action: historyAction,
      oldValue: result.superseded[0]?.fact,
      newValue: result.fact.fact,
      supersededBy:
        result.action === "SUPERSEDE" ? result.fact.factId : undefined,
      supersedes: result.superseded[0]?.factId,
      reason: result.reason,
      confidence: result.confidence,
      pipeline: {
        slotMatching: result.pipeline.slotMatching?.executed,
        semanticMatching: result.pipeline.semanticMatching?.executed,
        llmResolution: result.pipeline.llmResolution?.executed,
      },
      userId: params.userId,
      participantId: params.participantId,
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
  async checkConflicts(params: ReviseParams): Promise<ConflictCheckResult> {
    validateMemorySpaceId(params.memorySpaceId);
    validateRequiredString(params.fact.fact, "fact.fact");
    validateConfidence(params.fact.confidence, "fact.confidence");

    if (!this.beliefRevisionService) {
      throw new Error(
        "Belief revision service not configured. Call configureBeliefRevision() first or provide LLM client in constructor.",
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
  async supersede(params: {
    memorySpaceId: string;
    oldFactId: string;
    newFactId: string;
    reason?: string;
  }): Promise<{ superseded: boolean; oldFactId: string; newFactId: string }> {
    validateMemorySpaceId(params.memorySpaceId);
    validateRequiredString(params.oldFactId, "oldFactId");
    validateFactIdFormat(params.oldFactId);
    validateRequiredString(params.newFactId, "newFactId");
    validateFactIdFormat(params.newFactId);

    // Get both facts to verify they exist
    const [oldFact, newFact] = await Promise.all([
      this.get(params.memorySpaceId, params.oldFactId),
      this.get(params.memorySpaceId, params.newFactId),
    ]);

    if (!oldFact) {
      throw new Error(`Old fact not found: ${params.oldFactId}`);
    }
    if (!newFact) {
      throw new Error(`New fact not found: ${params.newFactId}`);
    }

    // Mark old fact as superseded
    await this.update(params.memorySpaceId, params.oldFactId, {
      validUntil: Date.now(),
    });

    // Log to history
    await this.historyService.log({
      factId: params.oldFactId,
      memorySpaceId: params.memorySpaceId,
      action: "SUPERSEDE",
      oldValue: oldFact.fact,
      newValue: newFact.fact,
      supersededBy: params.newFactId,
      reason: params.reason || "Manual supersession",
    });

    return {
      superseded: true,
      oldFactId: params.oldFactId,
      newFactId: params.newFactId,
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
  async history(factId: string, limit?: number): Promise<FactChangeEvent[]> {
    validateRequiredString(factId, "factId");
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
  async getChanges(filter: ChangeFilter): Promise<FactChangeEvent[]> {
    validateMemorySpaceId(filter.memorySpaceId);

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
  async getSupersessionChain(
    factId: string,
  ): Promise<SupersessionChainEntry[]> {
    validateRequiredString(factId, "factId");
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
  async getActivitySummary(
    memorySpaceId: string,
    hours?: number,
  ): Promise<ActivitySummary> {
    validateMemorySpaceId(memorySpaceId);

    return this.historyService.getActivitySummary(memorySpaceId, hours);
  }
}

// Export validation error for users who want to catch it specifically
export { FactsValidationError } from "./validators";

// Export deduplication types and service
export {
  FactDeduplicationService,
  type DeduplicationConfig,
  type DeduplicationStrategy,
  type FactCandidate,
  type DuplicateResult,
  type StoreWithDedupResult,
} from "./deduplication";

// Export belief revision types and service
export {
  BeliefRevisionService,
  type BeliefRevisionConfig,
  type ReviseParams,
  type ReviseResult,
  type ConflictCheckResult,
} from "./belief-revision";

// Export slot matching utilities
export {
  SlotMatchingService,
  type SlotMatch,
  type SlotMatchingConfig,
  type SlotConflictResult,
  classifyPredicate,
  normalizeSubject,
  normalizePredicate,
  extractSlot,
  DEFAULT_PREDICATE_CLASSES,
} from "./slot-matching";

// Export conflict resolution types
export {
  type ConflictAction,
  type ConflictDecision,
  type ConflictCandidate,
  buildConflictResolutionPrompt,
  parseConflictDecision,
  getDefaultDecision,
} from "./conflict-prompts";

// Export history types and service
export {
  FactHistoryService,
  type FactChangeEvent,
  type FactChangeAction,
  type FactChangePipeline,
  type ChangeFilter,
  type ActivitySummary,
  type SupersessionChainEntry,
} from "./history";
