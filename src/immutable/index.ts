/**
 * Cortex SDK - Immutable Store API
 *
 * Layer 1b: ACID-compliant versioned immutable storage for shared data
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  CountImmutableFilter,
  ImmutableEntry,
  ImmutableRecord,
  ImmutableSearchResult,
  ImmutableVersionExpanded,
  ListImmutableFilter,
  SearchImmutableInput,
  StoreImmutableOptions,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import {
  validateImmutableEntry,
  validateType,
  validateId,
  validateVersion,
  validateTimestamp,
  validateListFilter,
  validateSearchInput,
  validateCountFilter,
  validatePurgeManyFilter,
  validateKeepLatest,
} from "./validators";
import type { ResilienceLayer } from "../resilience";

export class ImmutableAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
    private readonly resilience?: ResilienceLayer,
  ) {}

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
   * Store immutable data (creates v1 or increments version if exists)
   *
   * @example
   * ```typescript
   * const record = await cortex.immutable.store({
   *   type: 'kb-article',
   *   id: 'refund-policy',
   *   data: {
   *     title: 'Refund Policy',
   *     content: 'Refunds available within 30 days...',
   *   },
   * });
   * ```
   */
  async store(
    entry: ImmutableEntry,
    options?: StoreImmutableOptions,
  ): Promise<ImmutableRecord> {
    // CLIENT-SIDE VALIDATION
    validateImmutableEntry(entry);

    const result = await this.client.mutation(api.immutable.store, {
      type: entry.type,
      id: entry.id,
      data: entry.data,
      userId: entry.userId,
      metadata: entry.metadata,
    });

    // Sync to graph if requested (facts are handled specially in FactsAPI)
    if (options?.syncToGraph && this.graphAdapter && entry.type !== "fact") {
      try {
        await this.graphAdapter.createNode({
          label: "Immutable",
          properties: {
            immutableType: entry.type,
            immutableId: entry.id,
            ...(result as ImmutableRecord),
          },
        });
      } catch (error) {
        console.warn("Failed to sync immutable to graph:", error);
      }
    }

    return result as ImmutableRecord;
  }

  /**
   * Get current version of an immutable entry
   *
   * @example
   * ```typescript
   * const article = await cortex.immutable.get('kb-article', 'refund-policy');
   * ```
   */
  async get(type: string, id: string): Promise<ImmutableRecord | null> {
    // CLIENT-SIDE VALIDATION
    validateType(type, "type");
    validateId(id, "id");

    const result = await this.client.query(api.immutable.get, {
      type,
      id,
    });

    return result as ImmutableRecord | null;
  }

  /**
   * Get a specific version of an immutable entry
   *
   * @example
   * ```typescript
   * const v1 = await cortex.immutable.getVersion('kb-article', 'refund-policy', 1);
   * ```
   */
  async getVersion(
    type: string,
    id: string,
    version: number,
  ): Promise<ImmutableVersionExpanded | null> {
    // CLIENT-SIDE VALIDATION
    validateType(type, "type");
    validateId(id, "id");
    validateVersion(version, "version");

    const result = await this.client.query(api.immutable.getVersion, {
      type,
      id,
      version,
    });

    return result as ImmutableVersionExpanded | null;
  }

  /**
   * Get all versions of an immutable entry
   *
   * @example
   * ```typescript
   * const history = await cortex.immutable.getHistory('kb-article', 'refund-policy');
   * console.log(`${history.length} versions`);
   * ```
   */
  async getHistory(
    type: string,
    id: string,
  ): Promise<ImmutableVersionExpanded[]> {
    // CLIENT-SIDE VALIDATION
    validateType(type, "type");
    validateId(id, "id");

    const result = await this.client.query(api.immutable.getHistory, {
      type,
      id,
    });

    return result as ImmutableVersionExpanded[];
  }

  /**
   * List immutable entries with optional filters
   *
   * @example
   * ```typescript
   * const articles = await cortex.immutable.list({
   *   type: 'kb-article',
   *   limit: 10,
   * });
   * ```
   */
  async list(filter?: ListImmutableFilter): Promise<ImmutableRecord[]> {
    // CLIENT-SIDE VALIDATION
    if (filter) {
      validateListFilter(filter);
    }

    const result = await this.client.query(api.immutable.list, {
      type: filter?.type,
      userId: filter?.userId,
      limit: filter?.limit,
    });

    return result as ImmutableRecord[];
  }

  /**
   * Search immutable entries by text query
   *
   * @example
   * ```typescript
   * const results = await cortex.immutable.search({
   *   query: 'refund',
   *   type: 'kb-article',
   * });
   * ```
   */
  async search(input: SearchImmutableInput): Promise<ImmutableSearchResult[]> {
    // CLIENT-SIDE VALIDATION
    validateSearchInput(input);

    const result = await this.client.query(api.immutable.search, {
      query: input.query,
      type: input.type,
      userId: input.userId,
      limit: input.limit,
    });

    return result as ImmutableSearchResult[];
  }

  /**
   * Count immutable entries
   *
   * @example
   * ```typescript
   * const count = await cortex.immutable.count({
   *   type: 'kb-article',
   * });
   * ```
   */
  async count(filter?: CountImmutableFilter): Promise<number> {
    // CLIENT-SIDE VALIDATION
    if (filter) {
      validateCountFilter(filter);
    }

    const result = await this.client.query(api.immutable.count, {
      type: filter?.type,
      userId: filter?.userId,
    });

    return result;
  }

  /**
   * Delete (purge) an immutable entry and all its versions
   *
   * @example
   * ```typescript
   * await cortex.immutable.purge('feedback', 'feedback-123');
   * ```
   */
  async purge(
    type: string,
    id: string,
  ): Promise<{
    deleted: boolean;
    type: string;
    id: string;
    versionsDeleted: number;
  }> {
    // CLIENT-SIDE VALIDATION
    validateType(type, "type");
    validateId(id, "id");

    const result = await this.client.mutation(api.immutable.purge, {
      type,
      id,
    });

    return result as {
      deleted: boolean;
      type: string;
      id: string;
      versionsDeleted: number;
    };
  }

  /**
   * Get version that was current at specific timestamp
   *
   * @example
   * ```typescript
   * const policy = await cortex.immutable.getAtTimestamp(
   *   'policy',
   *   'refund-policy',
   *   Date.parse('2025-01-01')
   * );
   * ```
   */
  async getAtTimestamp(
    type: string,
    id: string,
    timestamp: number | Date,
  ): Promise<ImmutableVersionExpanded | null> {
    // CLIENT-SIDE VALIDATION
    validateType(type, "type");
    validateId(id, "id");
    validateTimestamp(timestamp, "timestamp");

    const ts = typeof timestamp === "number" ? timestamp : timestamp.getTime();

    const result = await this.client.query(api.immutable.getAtTimestamp, {
      type,
      id,
      timestamp: ts,
    });

    return result as ImmutableVersionExpanded | null;
  }

  /**
   * Bulk delete immutable entries matching filters
   *
   * @example
   * ```typescript
   * const result = await cortex.immutable.purgeMany({ type: 'old-data', userId: 'user-123' });
   * ```
   */
  async purgeMany(filter: { type?: string; userId?: string }): Promise<{
    deleted: number;
    totalVersionsDeleted: number;
    entries: Array<{ type: string; id: string }>;
  }> {
    // CLIENT-SIDE VALIDATION
    validatePurgeManyFilter(filter);

    const result = await this.client.mutation(api.immutable.purgeMany, {
      type: filter.type,
      userId: filter.userId,
    });

    return result as {
      deleted: number;
      totalVersionsDeleted: number;
      entries: Array<{ type: string; id: string }>;
    };
  }

  /**
   * Delete old versions while keeping recent ones
   *
   * @example
   * ```typescript
   * await cortex.immutable.purgeVersions('kb-article', 'guide-123', 20); // Keep latest 20
   * ```
   */
  async purgeVersions(
    type: string,
    id: string,
    keepLatest: number,
  ): Promise<{
    versionsPurged: number;
    versionsRemaining: number;
  }> {
    // CLIENT-SIDE VALIDATION
    validateType(type, "type");
    validateId(id, "id");
    validateKeepLatest(keepLatest, "keepLatest");

    const result = await this.client.mutation(api.immutable.purgeVersions, {
      type,
      id,
      keepLatest,
    });

    return result as {
      versionsPurged: number;
      versionsRemaining: number;
    };
  }
}

// Export validation error for users who want to catch it specifically
export { ImmutableValidationError } from "./validators";
