/**
 * Cortex SDK - Immutable Store API
 * 
 * Layer 1b: ACID-compliant versioned immutable storage for shared data
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  ImmutableEntry,
  ImmutableRecord,
  ImmutableVersionExpanded,
  ListImmutableFilter,
  SearchImmutableInput,
  ImmutableSearchResult,
  CountImmutableFilter,
} from "../types";

export class ImmutableAPI {
  constructor(private client: ConvexClient) {}

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
  async store(entry: ImmutableEntry): Promise<ImmutableRecord> {
    const result = await this.client.mutation(api.immutable.store, {
      type: entry.type,
      id: entry.id,
      data: entry.data,
      userId: entry.userId,
      metadata: entry.metadata,
    });

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
    version: number
  ): Promise<ImmutableVersionExpanded | null> {
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
  async getHistory(type: string, id: string): Promise<ImmutableVersionExpanded[]> {
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
    id: string
  ): Promise<{ deleted: boolean; type: string; id: string; versionsDeleted: number }> {
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
}

