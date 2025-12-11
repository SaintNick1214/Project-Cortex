/**
 * Cortex SDK - Mutable Store API
 *
 * Layer 1c: ACID-compliant mutable storage for live data
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  CountMutableFilter,
  DeleteMutableOptions,
  ListMutableFilter,
  MutableRecord,
  SetMutableOptions,
  PurgeNamespaceOptions,
  PurgeManyFilter,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import { deleteMutableFromGraph } from "../graph";
import {
  validateNamespace,
  validateNamespaceFormat,
  validateKey,
  validateKeyFormat,
  validateValue,
  validateValueSize,
  validateUserId,
  validateUpdater,
  validateAmount,
  validateListFilter,
  validateCountFilter,
  validatePurgeFilter,
  validatePurgeNamespaceOptions,
  validateOperationsArray,
  validateTransactionOperations,
} from "./validators";
import type { ResilienceLayer } from "../resilience";

// Export validation error for users who want to catch it specifically
export { MutableValidationError } from "./validators";

export class MutableAPI {
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
    options?: SetMutableOptions,
  ): Promise<MutableRecord> {
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateValue(value);
    validateValueSize(value);

    if (userId !== undefined) {
      validateUserId(userId);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.mutable.set, {
          namespace,
          key,
          value,
          userId,
          metadata,
        }),
      "mutable:set",
    );

    // Sync to graph if requested (mutable data in graph is rare, but supported)
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        await this.graphAdapter.createNode({
          label: "Mutable",
          properties: { namespace, key, value, userId, metadata },
        });
      } catch (error) {
        console.warn("Failed to sync mutable to graph:", error);
      }
    }

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
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.mutable.get, {
          namespace,
          key,
        }),
      "mutable:get",
    );

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
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.mutable.get, {
          namespace,
          key,
        }),
      "mutable:getRecord",
    );

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
  async update<T = unknown>(
    namespace: string,
    key: string,
    updater: (current: T) => T,
  ): Promise<MutableRecord> {
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateUpdater(updater);

    // Get current value
    const current = await this.get(namespace, key);

    // Apply updater function
    const newValue = updater(current as T);

    // Set new value using custom operation
    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.mutable.update, {
            namespace,
            key,
            operation: "custom",
            operand: newValue,
          }),
        "mutable:update",
      );

      return result as MutableRecord;
    } catch (error) {
      this.handleConvexError(error);
    }
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
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateAmount(amount, "amount");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.mutable.update, {
          namespace,
          key,
          operation: "increment",
          operand: amount,
        }),
      "mutable:increment",
    );

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
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);
    validateAmount(amount, "amount");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.mutable.update, {
          namespace,
          key,
          operation: "decrement",
          operand: amount,
        }),
      "mutable:decrement",
    );

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
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.mutable.exists, {
          namespace,
          key,
        }),
      "mutable:exists",
    );

    return result;
  }

  /**
   * List keys in namespace
   *
   * @param filter - Filter options for listing keys
   * @param filter.namespace - Required namespace to list
   * @param filter.keyPrefix - Filter by key prefix
   * @param filter.userId - Filter by user
   * @param filter.limit - Max results (default: 100)
   * @param filter.offset - Pagination offset
   * @param filter.updatedAfter - Filter by updatedAt > timestamp
   * @param filter.updatedBefore - Filter by updatedAt < timestamp
   * @param filter.sortBy - Sort by "key" | "updatedAt" | "accessCount"
   * @param filter.sortOrder - Sort order "asc" | "desc"
   * @returns Array of matching MutableRecord objects
   *
   * @example
   * ```typescript
   * const items = await cortex.mutable.list({
   *   namespace: 'inventory',
   *   keyPrefix: 'widget-',
   *   sortBy: 'updatedAt',
   *   sortOrder: 'desc',
   *   limit: 50,
   * });
   * ```
   */
  async list(filter: ListMutableFilter): Promise<MutableRecord[]> {
    // Client-side validation
    validateListFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.mutable.list, {
          namespace: filter.namespace,
          keyPrefix: filter.keyPrefix,
          userId: filter.userId,
          limit: filter.limit,
          offset: filter.offset,
          updatedAfter: filter.updatedAfter,
          updatedBefore: filter.updatedBefore,
          sortBy: filter.sortBy,
          sortOrder: filter.sortOrder,
        }),
      "mutable:list",
    );

    return result as MutableRecord[];
  }

  /**
   * Count keys in namespace
   *
   * @param filter - Filter options for counting keys
   * @param filter.namespace - Required namespace to count
   * @param filter.userId - Filter by user
   * @param filter.keyPrefix - Filter by key prefix
   * @param filter.updatedAfter - Filter by updatedAt > timestamp
   * @param filter.updatedBefore - Filter by updatedAt < timestamp
   * @returns Count of matching keys
   *
   * @example
   * ```typescript
   * const count = await cortex.mutable.count({
   *   namespace: 'inventory',
   *   updatedAfter: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
   * });
   * ```
   */
  async count(filter: CountMutableFilter): Promise<number> {
    // Client-side validation
    validateCountFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.mutable.count, {
          namespace: filter.namespace,
          userId: filter.userId,
          keyPrefix: filter.keyPrefix,
          updatedAfter: filter.updatedAfter,
          updatedBefore: filter.updatedBefore,
        }),
      "mutable:count",
    );

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
    options?: DeleteMutableOptions,
  ): Promise<{ deleted: boolean; namespace: string; key: string }> {
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.mutable.deleteKey, {
            namespace,
            key,
          }),
        "mutable:delete",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Delete from graph
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        await deleteMutableFromGraph(namespace, key, this.graphAdapter);
      } catch (error) {
        console.warn("Failed to delete mutable from graph:", error);
      }
    }

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
    // Client-side validation (same as delete)
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validateKey(key);
    validateKeyFormat(key);

    return await this.delete(namespace, key);
  }

  /**
   * Purge all keys in a namespace
   *
   * @param namespace - Namespace to purge
   * @param options - Optional settings
   * @param options.dryRun - If true, returns what would be deleted without deleting
   * @returns Result with deleted count, namespace, and optionally keys (in dryRun mode)
   *
   * @example
   * ```typescript
   * // Preview what would be deleted
   * const preview = await cortex.mutable.purgeNamespace('temp-cache', { dryRun: true });
   * console.log(`Would delete ${preview.deleted} keys`);
   *
   * // Actually delete
   * const result = await cortex.mutable.purgeNamespace('temp-cache');
   * console.log(`Deleted ${result.deleted} keys`);
   * ```
   */
  async purgeNamespace(
    namespace: string,
    options?: PurgeNamespaceOptions,
  ): Promise<{
    deleted: number;
    namespace: string;
    keys?: string[];
    dryRun: boolean;
  }> {
    // Client-side validation
    validateNamespace(namespace);
    validateNamespaceFormat(namespace);
    validatePurgeNamespaceOptions(options);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.mutable.purgeNamespace, {
          namespace,
          dryRun: options?.dryRun,
        }),
      "mutable:purgeNamespace",
    );

    return result as {
      deleted: number;
      namespace: string;
      keys?: string[];
      dryRun: boolean;
    };
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
    // Client-side validation
    validateOperationsArray(operations);
    validateTransactionOperations(operations);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.mutable.transaction, {
            operations,
          }),
        "mutable:transaction",
      );

      return result as {
        success: boolean;
        operationsExecuted: number;
        results: unknown[];
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Bulk delete keys matching filters
   *
   * @param filter - Filter options for deleting keys
   * @param filter.namespace - Required namespace to purge from
   * @param filter.keyPrefix - Filter by key prefix
   * @param filter.userId - Filter by user
   * @param filter.updatedBefore - Delete keys updated before this timestamp
   * @param filter.lastAccessedBefore - Delete keys last accessed before this timestamp
   * @returns Result with deleted count, namespace, and deleted keys
   *
   * @example
   * ```typescript
   * // Delete keys with prefix
   * await cortex.mutable.purgeMany({
   *   namespace: 'cache',
   *   keyPrefix: 'temp-',
   * });
   *
   * // Delete old keys
   * await cortex.mutable.purgeMany({
   *   namespace: 'cache',
   *   updatedBefore: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
   * });
   *
   * // Delete inactive keys
   * await cortex.mutable.purgeMany({
   *   namespace: 'sessions',
   *   lastAccessedBefore: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
   * });
   * ```
   */
  async purgeMany(filter: PurgeManyFilter): Promise<{
    deleted: number;
    namespace: string;
    keys: string[];
  }> {
    // Client-side validation
    validatePurgeFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.mutable.purgeMany, {
          namespace: filter.namespace,
          keyPrefix: filter.keyPrefix,
          userId: filter.userId,
          updatedBefore: filter.updatedBefore,
          lastAccessedBefore: filter.lastAccessedBefore,
        }),
      "mutable:purgeMany",
    );

    return result as {
      deleted: number;
      namespace: string;
      keys: string[];
    };
  }
}
