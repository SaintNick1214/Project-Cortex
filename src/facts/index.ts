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

export class FactsAPI {
  constructor(
    private client: ConvexClient,
    private graphAdapter?: GraphAdapter,
    private resilience?: ResilienceLayer,
  ) {}

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
    options?: StoreFactOptions,
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
        }),
      "facts:store",
    );

    // Sync to graph if requested
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        const nodeId = await syncFactToGraph(
          result as FactRecord,
          this.graphAdapter,
        );
        await syncFactRelationships(
          result as FactRecord,
          nodeId,
          this.graphAdapter,
        );
      } catch (error) {
        console.warn("Failed to sync fact to graph:", error);
      }
    }

    return result as FactRecord;
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
    options?: UpdateFactOptions,
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
          }),
        "facts:update",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Update in graph if requested
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        const nodes = await this.graphAdapter.findNodes("Fact", { factId }, 1);
        if (nodes.length > 0) {
          await this.graphAdapter.updateNode(
            nodes[0].id!,
            updates as unknown as Record<string, unknown>,
          );
        }
      } catch (error) {
        console.warn("Failed to update fact in graph:", error);
      }
    }

    return result as FactRecord;
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
    options?: DeleteFactOptions,
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

    // Delete from graph with Entity orphan cleanup
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        await deleteFactFromGraph(factId, this.graphAdapter, true);
      } catch (error) {
        console.warn("Failed to delete fact from graph:", error);
      }
    }

    return result as { deleted: boolean; factId: string };
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
}

// Export validation error for users who want to catch it specifically
export { FactsValidationError } from "./validators";
