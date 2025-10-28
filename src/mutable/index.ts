/**
 * Cortex SDK - Mutable Store API
 *
 * Layer 1c: ACID-compliant mutable storage for live data
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  CountMutableFilter,
  ListMutableFilter,
  MutableRecord,
} from "../types";

export class MutableAPI {
  constructor(private readonly client: ConvexClient) {}

  /**
   * Set a key to a value (creates or overwrites)
   *
   * @example
   * ```typescript
   * await cortex.mutable.set('inventory', 'widget-qty', 100);
   * ```
   */
  async set(
    namespace: string,
    key: string,
    value: unknown,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<MutableRecord> {
    const result = await this.client.mutation(api.mutable.set, {
      namespace,
      key,
      value,
      userId,
      metadata,
    });

    return result as MutableRecord;
  }

  /**
   * Get current value for a key
   *
   * @example
   * ```typescript
   * const qty = await cortex.mutable.get('inventory', 'widget-qty');
   * ```
   */
  async get(namespace: string, key: string): Promise<unknown | null> {
    const result = await this.client.query(api.mutable.get, {
      namespace,
      key,
    });

    return result ? (result as MutableRecord).value : null;
  }

  /**
   * Get full record (including metadata)
   *
   * @example
   * ```typescript
   * const record = await cortex.mutable.getRecord('inventory', 'widget-qty');
   * console.log(record.updatedAt, record.accessCount);
   * ```
   */
  async getRecord(
    namespace: string,
    key: string,
  ): Promise<MutableRecord | null> {
    const result = await this.client.query(api.mutable.get, {
      namespace,
      key,
    });

    return result as MutableRecord | null;
  }

  /**
   * Atomic update using updater function
   *
   * @example
   * ```typescript
   * await cortex.mutable.update('inventory', 'widget-qty', (qty) => qty - 10);
   * ```
   */
  async update(
    namespace: string,
    key: string,
    updater: (current: unknown) => unknown,
  ): Promise<MutableRecord> {
    // Get current value
    const current = await this.get(namespace, key);

    // Apply updater function
    const newValue = updater(current);

    // Set new value using custom operation
    const result = await this.client.mutation(api.mutable.update, {
      namespace,
      key,
      operation: "custom",
      operand: newValue,
    });

    return result as MutableRecord;
  }

  /**
   * Increment a numeric value
   *
   * @example
   * ```typescript
   * await cortex.mutable.increment('counters', 'total-sales', 1);
   * ```
   */
  async increment(
    namespace: string,
    key: string,
    amount = 1,
  ): Promise<MutableRecord> {
    const result = await this.client.mutation(api.mutable.update, {
      namespace,
      key,
      operation: "increment",
      operand: amount,
    });

    return result as MutableRecord;
  }

  /**
   * Decrement a numeric value
   *
   * @example
   * ```typescript
   * await cortex.mutable.decrement('inventory', 'widget-qty', 10);
   * ```
   */
  async decrement(
    namespace: string,
    key: string,
    amount = 1,
  ): Promise<MutableRecord> {
    const result = await this.client.mutation(api.mutable.update, {
      namespace,
      key,
      operation: "decrement",
      operand: amount,
    });

    return result as MutableRecord;
  }

  /**
   * Check if key exists
   *
   * @example
   * ```typescript
   * if (await cortex.mutable.exists('inventory', 'widget-qty')) { ... }
   * ```
   */
  async exists(namespace: string, key: string): Promise<boolean> {
    const result = await this.client.query(api.mutable.exists, {
      namespace,
      key,
    });

    return result;
  }

  /**
   * List keys in namespace
   *
   * @example
   * ```typescript
   * const items = await cortex.mutable.list({
   *   namespace: 'inventory',
   *   keyPrefix: 'widget-',
   * });
   * ```
   */
  async list(filter: ListMutableFilter): Promise<MutableRecord[]> {
    const result = await this.client.query(api.mutable.list, {
      namespace: filter.namespace,
      keyPrefix: filter.keyPrefix,
      userId: filter.userId,
      limit: filter.limit,
    });

    return result as MutableRecord[];
  }

  /**
   * Count keys in namespace
   *
   * @example
   * ```typescript
   * const count = await cortex.mutable.count({ namespace: 'inventory' });
   * ```
   */
  async count(filter: CountMutableFilter): Promise<number> {
    const result = await this.client.query(api.mutable.count, {
      namespace: filter.namespace,
      userId: filter.userId,
      keyPrefix: filter.keyPrefix,
    });

    return result;
  }

  /**
   * Delete a key
   *
   * @example
   * ```typescript
   * await cortex.mutable.delete('inventory', 'discontinued-item');
   * ```
   */
  async delete(
    namespace: string,
    key: string,
  ): Promise<{ deleted: boolean; namespace: string; key: string }> {
    const result = await this.client.mutation(api.mutable.deleteKey, {
      namespace,
      key,
    });

    return result as { deleted: boolean; namespace: string; key: string };
  }

  /**
   * Purge a key (alias for delete - for API consistency)
   *
   * @example
   * ```typescript
   * await cortex.mutable.purge('inventory', 'discontinued-item');
   * ```
   */
  async purge(
    namespace: string,
    key: string,
  ): Promise<{ deleted: boolean; namespace: string; key: string }> {
    return await this.delete(namespace, key);
  }

  /**
   * Purge all keys in a namespace
   *
   * @example
   * ```typescript
   * await cortex.mutable.purgeNamespace('temp-cache');
   * ```
   */
  async purgeNamespace(
    namespace: string,
  ): Promise<{ deleted: number; namespace: string }> {
    const result = await this.client.mutation(api.mutable.purgeNamespace, {
      namespace,
    });

    return result as { deleted: number; namespace: string };
  }

  /**
   * Execute multiple operations atomically
   *
   * @example
   * ```typescript
   * await cortex.mutable.transaction([
   *   { op: 'increment', namespace: 'counters', key: 'sales', amount: 1 },
   *   { op: 'decrement', namespace: 'inventory', key: 'widget-qty', amount: 1 },
   *   { op: 'set', namespace: 'state', key: 'last-sale', value: Date.now() },
   * ]);
   * ```
   */
  async transaction(
    operations: Array<{
      op: "set" | "update" | "delete" | "increment" | "decrement";
      namespace: string;
      key: string;
      value?: unknown;
      amount?: number;
    }>,
  ): Promise<{
    success: boolean;
    operationsExecuted: number;
    results: unknown[];
  }> {
    const result = await this.client.mutation(api.mutable.transaction, {
      operations,
    });

    return result as {
      success: boolean;
      operationsExecuted: number;
      results: unknown[];
    };
  }

  /**
   * Bulk delete keys matching filters
   *
   * @example
   * ```typescript
   * await cortex.mutable.purgeMany({
   *   namespace: 'cache',
   *   keyPrefix: 'temp-',
   * });
   * ```
   */
  async purgeMany(filter: {
    namespace: string;
    keyPrefix?: string;
    userId?: string;
  }): Promise<{
    deleted: number;
    namespace: string;
    keys: string[];
  }> {
    const result = await this.client.mutation(api.mutable.purgeMany, {
      namespace: filter.namespace,
      keyPrefix: filter.keyPrefix,
      userId: filter.userId,
    });

    return result as {
      deleted: number;
      namespace: string;
      keys: string[];
    };
  }
}
