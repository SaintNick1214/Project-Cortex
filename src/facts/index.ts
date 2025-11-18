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

export class FactsAPI {
  constructor(
    private client: ConvexClient,
    private graphAdapter?: GraphAdapter,
  ) {}

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
    const result = await this.client.mutation(api.facts.store, {
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
    });

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
    const result = await this.client.query(api.facts.get, {
      memorySpaceId,
      factId,
    });

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
    const result = await this.client.query(api.facts.list, {
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
    });

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
    const result = await this.client.query(api.facts.count, {
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
    });

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
    const result = await this.client.query(api.facts.search, {
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
    });

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
    const result = await this.client.mutation(api.facts.update, {
      memorySpaceId,
      factId,
      fact: updates.fact,
      confidence: updates.confidence,
      tags: updates.tags,
      validUntil: updates.validUntil,
      metadata: updates.metadata,
    });

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
    const result = await this.client.mutation(api.facts.deleteFact, {
      memorySpaceId,
      factId,
    });

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
    const result = await this.client.query(api.facts.getHistory, {
      memorySpaceId,
      factId,
    });

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
    const result = await this.client.query(api.facts.queryBySubject, {
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
    });

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
    const result = await this.client.query(api.facts.queryByRelationship, {
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
    });

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
    const result = await this.client.query(api.facts.exportFacts, {
      memorySpaceId: options.memorySpaceId,
      format: options.format,
      factType: options.factType,
    });

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
    const result = await this.client.mutation(api.facts.consolidate, {
      memorySpaceId: params.memorySpaceId,
      factIds: params.factIds,
      keepFactId: params.keepFactId,
    });

    return result as {
      consolidated: boolean;
      keptFactId: string;
      mergedCount: number;
    };
  }
}
