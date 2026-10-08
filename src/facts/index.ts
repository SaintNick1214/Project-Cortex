import { GraphCommittedPartial, GraphJobUnresolved } from "../graph/types";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { writeGraphMutation, type GraphPrimary } from "../graph/erasure";
import type { GraphSyncPolicy } from "../graph/types";
import { randomUUID } from "node:crypto";
import { waitDomainOperation, isDomainGraphIdentity, domainLoader, collectDomain, selectDomain, sameSelection, resolveDomainTenant, partialFrom, assertDomainActive } from "../common/domainPaging";
import { factsExport } from "../common/domainExport";
import { DomainOperationPartialError, type DomainReadOptions, type DomainItemOutcome, type DomainPartial } from "../types";
import { validateTenantId } from "../auth/validators";
import { ConvexError } from "convex/values";
import { resolveFactScope } from "./discovery";
import type { Id } from "../../convex-dev/_generated/dataModel";
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
  SemanticSearchFactsOptions,
  StoreFactOptions,
  StoreFactParams,
  UpdateFactInput,
  UpdateFactOptions,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import {
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
  HistoryWriteAfterCommitError,
  FactCommitOutcomeUnknownError,
  FactCommittedResultUnavailableError,
  FactCommittedReceiptUnresolvedError,
  DecisionLogError,
  type HistoryReceipt,
  type HistorySelector,
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
    private readonly graphSyncPolicy?: GraphSyncPolicy,
  ) {
    this.authContext = authContext;
    this.llmClient = llmClient;
    this.deduplicationService = new FactDeduplicationService(client);
    this.historyService = new FactHistoryService(
      client,
      resilience,
      authContext,
    );

    // Always initialize belief revision service - "batteries included"
    // When no LLM is configured, the service uses heuristics via getDefaultDecision()
    // This enables intelligent fact supersession even without an LLM for conflict resolution
    this.beliefRevisionService = new BeliefRevisionService(
      client,
      llmClient,
      graphAdapter,
      beliefRevisionConfig,
      this.graphSyncPolicy,
    );
  }
  private mutateGraph<M extends FunctionReference<"mutation", "public">>(reference: M, args: FunctionArgs<M>, explicit?: boolean): Promise<GraphPrimary<FunctionReturnType<M>>> {
    return writeGraphMutation(this.client, this.graphAdapter, this.graphSyncPolicy, reference, args, explicit);
  }
  private executeGraphWrite<T>(operation: () => Promise<T>, name: string, explicit?: boolean): Promise<T> {
    // A configured graph writer has one primary application invocation; delivery retries are separate.
    return this.graphAdapter && explicit !== false ? operation() : this.executeWithResilience(operation, name);
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
      this.graphSyncPolicy,
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

    const result = await this.executeGraphWrite(
      () =>
        this.mutateGraph(api.facts.store, {
          memorySpaceId: params.memorySpaceId,
          participantId: params.participantId,
          userId: params.userId,
          tenantId: resolveFactScope(
            this.authContext?.tenantId,
            params.tenantId,
          ), // Exact data scope, not authentication
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
          // Embedding for semantic search (v0.30.0+)
          embedding: params.embedding,
        }, _options?.syncToGraph),
      "facts:store", _options?.syncToGraph,
    );

    const factRecord = result as FactRecord;

    // Sync to graph automatically when graph adapter is configured
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    

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
      resolveFactScope(this.authContext?.tenantId, params.tenantId),
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
          {
            tenantId: resolveFactScope(
              this.authContext?.tenantId,
              params.tenantId,
            ),
            expectedSourceFactId: existing._id,
            syncToGraph:options?.syncToGraph,
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
  async get(memorySpaceId: string, factId: string, options?: DomainReadOptions): Promise<FactRecord | null> {
    validateMemorySpaceId(memorySpaceId);
    validateRequiredString(factId, "factId");
    validateFactIdFormat(factId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.facts.get, {
          memorySpaceId,
          factId,
          tenantId: resolveDomainTenant(this.authContext?.tenantId, options?.tenantId), // Inject tenantId for tenant isolation
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

    const load = domainLoader(this.client, "facts", {
          memorySpaceId: filter.memorySpaceId,
          tenantId: resolveDomainTenant(this.authContext?.tenantId, filter.tenantId), // Tenant isolation
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
        });
    const rows = await collectDomain<FactRecord>(load);
    if (filter?.sortBy) {
      const field = filter.sortBy;
      rows.sort((a,b) => ((a[field] as number) - (b[field] as number)) * (filter.sortOrder === "asc" ? 1 : -1));
    }
    const offset = filter?.offset ?? 0, limit = filter?.limit ?? Infinity;
    return rows.slice(offset, offset + limit);
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
    const context = this.authContext?.tenantId;
    if (context !== undefined) validateTenantId(context);
    if (filter.tenantId !== undefined) validateTenantId(filter.tenantId);
    const tenantId = resolveFactScope(context, filter.tenantId);

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
          tenantId, // Tenant isolation
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

    const load = domainLoader(this.client, "facts", {
          memorySpaceId,
          tenantId: resolveDomainTenant(this.authContext?.tenantId, options?.tenantId), // Tenant isolation
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
        });
    const rows = await collectDomain<FactRecord>(load);
    if (options?.sortBy) {
      const field = options.sortBy;
      rows.sort((a,b) => ((a[field] as number) - (b[field] as number)) * (options.sortOrder === "asc" ? 1 : -1));
    }
    const offset = options?.offset ?? 0, limit = options?.limit ?? 20;
    return rows.slice(offset, offset + limit);
  }

  /**
   * Semantic search for facts using vector embeddings (v0.30.0+)
   *
   * Uses cosine similarity to find semantically related facts,
   * unlike text search which requires keyword matching.
   *
   * @param memorySpaceId - The memory space to search in
   * @param embedding - The query embedding vector
   * @param options - Search options (filters, limits, etc.)
   * @returns Array of matching fact records
   *
   * @example
   * ```typescript
   * const embedding = await generateEmbedding('user preferences');
   * const facts = await cortex.facts.semanticSearch('space-1', embedding, {
   *   minConfidence: 80,
   *   limit: 10,
   * });
   * ```
   */
  async semanticSearch(
    memorySpaceId: string,
    embedding: number[],
    options?: SemanticSearchFactsOptions,
  ): Promise<FactRecord[]> {
    validateMemorySpaceId(memorySpaceId);

    if (!embedding || embedding.length === 0) {
      throw new Error("Embedding vector is required for semantic search");
    }

    if (options) {
      if (options.minConfidence !== undefined) {
        validateConfidence(options.minConfidence, "minConfidence");
      }
      if (options.tags !== undefined) {
        validateStringArray(options.tags, "tags", true);
      }
      if (options.limit !== undefined) {
        validateNonNegativeInteger(options.limit, "limit");
      }
      if (options.createdBefore && options.createdAfter) {
        validateDateRange(
          options.createdAfter,
          options.createdBefore,
          "createdAfter",
          "createdBefore",
        );
      }
    }

    // Note: facts.semanticSearch is an action (not a query) because vector search
    // requires ctx.vectorSearch() which is only available in Convex actions
    const result = await this.executeWithResilience(
      () =>
        this.client.action(api.facts.semanticSearch, {
          memorySpaceId,
          embedding,
          tenantId: options?.tenantId ?? this.authContext?.tenantId,
          userId: options?.userId,
          minConfidence: options?.minConfidence,
          includeSuperseded: options?.includeSuperseded,
          minScore: options?.minScore,
          limit: options?.limit,
          tags: options?.tags,
          createdAfter: options?.createdAfter?.getTime(),
          createdBefore: options?.createdBefore?.getTime(),
        }),
      "facts:semanticSearch",
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

    if (_options?.expectedSourceFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(_options.expectedSourceFingerprint)) throw new Error("DOMAIN_INVALID_FINGERPRINT");
    const tenantId = resolveFactScope(
      this.authContext?.tenantId,
      _options?.tenantId,
    );
    const operationId = _options?.operationId ?? randomUUID();
    let result;
    try {
      const operation = () => this.mutateGraph(api.facts.update, {
            memorySpaceId,
            tenantId,
            operationId,
            expectedSourceFingerprint: _options?.expectedSourceFingerprint,
            expectedSourceFactId: _options?.expectedSourceFactId as
              | Id<"facts">
              | undefined,
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
            // Embedding for semantic search (v0.30.0+)
            embedding: updates.embedding,
          }, _options?.syncToGraph);
      result = _options?.expectedSourceFingerprint !== undefined ? await operation() : await this.executeGraphWrite(operation, "facts:update", _options?.syncToGraph);
    } catch (error) {
      if (error instanceof GraphCommittedPartial || error instanceof GraphJobUnresolved || error instanceof FactCommittedResultUnavailableError || error instanceof FactCommittedReceiptUnresolvedError) throw error;
      if (!(error instanceof ConvexError))
        throw new FactCommitOutcomeUnknownError(operationId, "update", error);
      if (error.data === "FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE") {
        let receipt;
        try {
          receipt = await this.historyService.getOperationReceipt(
            memorySpaceId,
            operationId,
            "update",
            tenantId,
          );
        } catch (receiptError) {
          throw new FactCommittedReceiptUnresolvedError(
            operationId,
            "update",
            { memorySpaceId, tenantId },
            "unavailable",
            error,
            receiptError,
          );
        }
        if (receipt)
          throw new FactCommittedResultUnavailableError(
            receipt,
            { memorySpaceId, tenantId },
            error,
          );
        throw new FactCommittedReceiptUnresolvedError(
          operationId,
          "update",
          { memorySpaceId, tenantId },
          "missing",
          error,
        );
      }
      if (_options?.expectedSourceFingerprint !== undefined) throw error;
      this.handleConvexError(error);
    }

    const factRecord = result as FactRecord;

    // Sync to graph automatically when graph adapter is configured
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    

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

    const tenantId = resolveFactScope(
      this.authContext?.tenantId,
      _options?.tenantId,
    );
    const operationId = _options?.operationId ?? randomUUID();
    let result;
    try {
      result = await this.executeGraphWrite(
        () =>
          this.mutateGraph(api.facts.deleteFact, {
            memorySpaceId,
            tenantId,
            operationId,
            factId,
          }, _options?.syncToGraph),
        "facts:delete", _options?.syncToGraph,
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Delete from graph automatically with Entity orphan cleanup
    // Graph sync is controlled by CORTEX_GRAPH_SYNC env var at Cortex initialization
    

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
  async deleteMany(params: DeleteManyFactsParams): Promise<DeleteManyFactsResult & {partial?: DomainPartial}> {
    validateMemorySpaceId(params.memorySpaceId);
    if (params.factType !== undefined) validateFactType(params.factType);
    const tenantId = resolveDomainTenant(this.authContext?.tenantId, params.tenantId);
    const load = domainLoader(this.client, "facts", {memorySpaceId: params.memorySpaceId, tenantId, userId: params.userId, factType: params.factType, includeSuperseded: params.includeSuperseded ?? true, deleteOperationPrefix: randomUUID()});
    const selected = await selectDomain<FactRecord>(load, params);
    if (!sameSelection(selected, await selectDomain<FactRecord>(load, params))) throw new Error("DOMAIN_SELECTION_CHANGED");
    const outcomes: DomainItemOutcome[] = selected.map(row => ({physicalId: row.physicalId, disposition: "unstarted"}));
    const intents = selected.map(row => {if (!row.deleteIntent) throw new Error("DOMAIN_INVALID_DELETE_INTENT"); return row.deleteIntent;});
    for (let i=0; i<selected.length; i++) {
      try { assertDomainActive(params); } catch (cause) {throw new DomainOperationPartialError("facts:deleteMany", partialFrom(outcomes, intents), cause);}
      try {
        const result = await waitDomainOperation(this.mutateGraph(api.facts.deleteMany, intents[i].request as Parameters<ConvexClient["mutation"]>[1]), params);
        outcomes[i].disposition = result.deleted ? "knownCommitted" : "alreadyAbsent";
        if ("graphIdentity" in result && isDomainGraphIdentity(result.graphIdentity)) outcomes[i].graphIdentity = result.graphIdentity;
      } catch (cause) {
        if (cause instanceof ConvexError) outcomes[i].disposition = "knownRolledBack";
        else {
          try {
            const receipt = await waitDomainOperation(this.historyService.getOperationReceipt(params.memorySpaceId, intents[i].operationId, "physical_delete", tenantId), params);
            outcomes[i].disposition = receipt && receipt.affectedFactIds.includes(selected[i].physicalId as Id<"facts">) && receipt.events.every(event => event.pending?.payload.requestDigest === intents[i].requestDigest) ? "knownCommitted" : "outcomeUnknown";
          } catch {outcomes[i].disposition = "outcomeUnknown";}
        }
        throw new DomainOperationPartialError("facts:deleteMany", partialFrom(outcomes, intents), cause);
      }
    }
    const partial = partialFrom(outcomes, intents);
    try {
      const remaining = await selectDomain<FactRecord>(load, params);
      if (remaining.length) throw new DomainOperationPartialError("facts:deleteMany", {...partial, remainingPhysicalIds: remaining.map(row => row.physicalId)}, new Error("DOMAIN_SELECTION_CHANGED"));
    } catch (cause) {if (cause instanceof DomainOperationPartialError) throw cause; throw new DomainOperationPartialError("facts:deleteMany", partial, cause);}
    return {deleted: partial.confirmedCount, memorySpaceId: params.memorySpaceId, partial};
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
    selector: Pick<HistorySelector, "tenantId"> = {},
  ): Promise<FactRecord[]> {
    validateMemorySpaceId(memorySpaceId);
    validateRequiredString(factId, "factId");
    validateFactIdFormat(factId);

    const tenantId = resolveFactScope(
      this.authContext?.tenantId,
      selector.tenantId,
    );
    const chain = await this.historyService.getSupersessionChain(factId, {
      memorySpaceId,
      tenantId,
    });
    const records: FactRecord[] = [];
    if (!chain.length) {
      const rows = await this.client.query(api.facts.getHistory, {
        memorySpaceId,
        tenantId,
        factId,
      });
      if (
        rows.some(
          (row) =>
            row.supersedes !== undefined || row.supersededBy !== undefined,
        )
      )
        throw new Error("FACT_HISTORY_RELATIONSHIP_UNRESOLVED");
      return rows as FactRecord[];
    }
    for (const node of chain) {
      let rows;
      try {
        rows = await this.client.query(api.facts.getHistory, {
          memorySpaceId,
          tenantId,
          factId: node.factId,
          sourceFactId: node.sourceFactId as Id<"facts">,
        });
      } catch (error) {
        if (
          error instanceof ConvexError &&
          (error.data === "FACT_HISTORY_SOURCE_REQUIRED" ||
            error.data === "FACT_HISTORY_SOURCE_MISMATCH")
        )
          throw new Error("FACT_HISTORY_ORIGINAL_RECORD_UNAVAILABLE");
        throw error;
      }
      if (rows.length !== 1 || rows[0]._id !== node.sourceFactId)
        throw new Error("FACT_HISTORY_ORIGINAL_RECORD_UNAVAILABLE");
      records.push(...(rows as FactRecord[]));
    }
    return records;
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
  async export(options: {memorySpaceId: string; format: "json" | "jsonld" | "csv"; factType?: ListFactsFilter["factType"]} & DomainReadOptions): Promise<{format: string; data: string; count: number; exportedAt: number}> {
    validateMemorySpaceId(options.memorySpaceId); validateExportFormat(options.format);
    if (options.factType !== undefined) validateFactType(options.factType);
    const tenantId = resolveDomainTenant(this.authContext?.tenantId, options.tenantId);
    const facts = await collectDomain<FactRecord>(domainLoader(this.client, "facts", {memorySpaceId: options.memorySpaceId, tenantId, factType: options.factType, includeSuperseded: false}), options);
    return factsExport(facts, options.format);
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
    tenantId?: string;
    operationId?: string;
    expectedFactIds?: Array<{ factId: string; factDocumentId: Id<"facts"> }>;
  }): Promise<{
    consolidated: boolean;
    keptFactId: string;
    mergedCount: number;
  }> {
    validateMemorySpaceId(params.memorySpaceId);
    validateStringArray(params.factIds, "factIds", false);
    validateRequiredString(params.keepFactId, "keepFactId");
    validateConsolidation(params.factIds, params.keepFactId);

    const tenantId = resolveFactScope(
      this.authContext?.tenantId,
      params.tenantId,
    );
    const operationId = params.operationId ?? randomUUID();
    const result = await this.executeGraphWrite(
      () =>
        this.mutateGraph(api.facts.consolidate, {
          memorySpaceId: params.memorySpaceId,
          tenantId,
          operationId,
          factIds: params.factIds,
          keepFactId: params.keepFactId,
          expectedFactIds: params.expectedFactIds,
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

    params = {
      ...params,
      tenantId: resolveFactScope(this.authContext?.tenantId, params.tenantId),
    };
    const result = await this.beliefRevisionService.revise(params);
    if (result.fact.historyReceipt) {
      try {
        await this.historyService.retryHistory(result.fact.historyReceipt);
      } catch (error) {
        throw new HistoryWriteAfterCommitError(
          result.fact.historyReceipt,
          { memorySpaceId: params.memorySpaceId, tenantId: params.tenantId },
          error,
        );
      }
    } else if (result.fact.factId) {
      try {
        await this.historyService.log({
          memorySpaceId: params.memorySpaceId,
          tenantId: params.tenantId,
          factId: result.fact.factId,
          sourceFactId: result.fact._id as Id<"facts">,
          action: "UPDATE",
          newValue: result.fact.fact,
          reason: result.reason,
          confidence: result.confidence,
          pipeline: {
            slotMatching: result.pipeline.slotMatching?.executed,
            semanticMatching: result.pipeline.semanticMatching?.executed,
            llmResolution: result.pipeline.llmResolution?.executed,
          },
          userId: params.userId,
          participantId: params.participantId,
          conversationId: params.sourceRef?.conversationId,
        });
      } catch (error) {
        throw new DecisionLogError(error);
      }
    }
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

    return this.beliefRevisionService.checkConflicts({
      ...params,
      tenantId: resolveFactScope(this.authContext?.tenantId, params.tenantId),
    });
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
    tenantId?: string;
    operationId?: string;
    expectedOldFactId?: Id<"facts">;
    expectedNewFactId?: Id<"facts">;
  }): Promise<{ superseded: boolean; oldFactId: string; newFactId: string }> {
    validateMemorySpaceId(params.memorySpaceId);
    validateRequiredString(params.oldFactId, "oldFactId");
    validateFactIdFormat(params.oldFactId);
    validateRequiredString(params.newFactId, "newFactId");
    validateFactIdFormat(params.newFactId);

    const tenantId = resolveFactScope(
      this.authContext?.tenantId,
      params.tenantId,
    );
    const operationId = params.operationId ?? randomUUID();
    const result = await this.executeGraphWrite(
      () =>
        this.mutateGraph(api.facts.supersede, {
          memorySpaceId: params.memorySpaceId,
          tenantId,
          oldFactId: params.oldFactId,
          newFactId: params.newFactId,
          expectedOldFactId: params.expectedOldFactId,
          expectedNewFactId: params.expectedNewFactId,
          reason: params.reason,
          operationId,
          historyIntent: {
            operationId,
            phase: "supersede",
            reason: params.reason ?? "Manual supersession",
            userId: this.authContext?.userId,
          },
        }),
      "facts:supersede",
    ).catch((error: unknown) => {
      if (error instanceof GraphCommittedPartial || error instanceof GraphJobUnresolved || error instanceof FactCommittedResultUnavailableError || error instanceof FactCommittedReceiptUnresolvedError) throw error;
      if (error instanceof ConvexError) throw error;
      throw new FactCommitOutcomeUnknownError(operationId, "supersede", error);
    });
    try {
      await this.historyService.retryHistory(result.historyReceipt);
    } catch (error) {
      throw new HistoryWriteAfterCommitError(
        result.historyReceipt,
        { memorySpaceId: params.memorySpaceId, tenantId },
        error,
      );
    }
    return result;
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
  retryHistory(receipt: HistoryReceipt) {
    return this.historyService.retryHistory(receipt);
  }
  getHistoryOperationReceipt(
    memorySpaceId: string,
    operationId: string,
    phase: string,
  ) {
    return this.historyService.getOperationReceipt(
      memorySpaceId,
      operationId,
      phase,
    );
  }

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
    selector?: HistorySelector,
  ): Promise<SupersessionChainEntry[]> {
    validateRequiredString(factId, "factId");
    validateFactIdFormat(factId);

    return this.historyService.getSupersessionChain(factId, selector);
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
