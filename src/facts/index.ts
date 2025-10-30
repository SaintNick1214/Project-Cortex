/**
 * Cortex SDK - Facts API (Layer 3)
 *
 * Structured knowledge with versioning and relationships
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  FactRecord,
  StoreFactParams,
  ListFactsFilter,
  CountFactsFilter,
  SearchFactsOptions,
  UpdateFactInput,
} from "../types";

export class FactsAPI {
  constructor(private client: ConvexClient) {}

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
  async store(params: StoreFactParams): Promise<FactRecord> {
    const result = await this.client.mutation(api.facts.store, {
      memorySpaceId: params.memorySpaceId,
      participantId: params.participantId,
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
      tags: filter.tags,
      includeSuperseded: filter.includeSuperseded,
      limit: filter.limit,
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
      includeSuperseded: filter.includeSuperseded,
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
      minConfidence: options?.minConfidence,
      tags: options?.tags,
      limit: options?.limit,
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
  ): Promise<{ deleted: boolean; factId: string }> {
    const result = await this.client.mutation(api.facts.deleteFact, {
      memorySpaceId,
      factId,
    });

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
  async queryBySubject(filter: {
    memorySpaceId: string;
    subject: string;
    factType?:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "custom";
  }): Promise<FactRecord[]> {
    const result = await this.client.query(api.facts.queryBySubject, {
      memorySpaceId: filter.memorySpaceId,
      subject: filter.subject,
      factType: filter.factType,
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
  async queryByRelationship(filter: {
    memorySpaceId: string;
    subject: string;
    predicate: string;
  }): Promise<FactRecord[]> {
    const result = await this.client.query(api.facts.queryByRelationship, {
      memorySpaceId: filter.memorySpaceId,
      subject: filter.subject,
      predicate: filter.predicate,
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
