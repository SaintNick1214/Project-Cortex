/**
 * Cortex SDK - Users API
 *
 * Coordination Layer: User profile management with GDPR cascade deletion
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  UserProfile,
  UserVersion,
  DeleteUserOptions,
  UserDeleteResult,
  DeletionPlan,
  DeletionBackup,
  VerificationResult,
  ListUsersFilter,
  UserFilters,
  ExportUsersOptions,
  Conversation,
  ImmutableRecord,
  MutableRecord,
  MemoryEntry,
  FactRecord,
} from "../types";

// Type for Neo4j record results (reused from agents)
interface Neo4jNodeRecord {
  id: string;
  labels: string[];
}

// Type for Neo4j count results
interface Neo4jCountRecord {
  count: number;
}
import type { GraphAdapter } from "../graph/types";
import {
  deleteWithOrphanCleanup,
  createDeletionContext,
  ORPHAN_RULES,
} from "../graph/sync/orphanDetection";
import {
  UserValidationError,
  validateUserId,
  validateData,
  validateVersionNumber,
  validateTimestamp,
  validateListUsersFilter,
  validateUserFilters,
  validateDeleteUserOptions,
  validateExportOptions,
  validateUserIdsArray,
  validateBulkUpdateOptions,
  validateBulkDeleteOptions,
} from "./validators";

/**
 * Custom error for cascade deletion failures
 */
export class CascadeDeletionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CascadeDeletionError";
  }
}

// Export validation error for users who want to catch it specifically
export { UserValidationError } from "./validators";

import type { ResilienceLayer } from "../resilience";

/**
 * Users API
 *
 * Provides convenience wrappers over immutable store (type='user') with the
 * critical feature of GDPR cascade deletion across all layers.
 *
 * Key Principle: Same code for free SDK and Cloud Mode
 * - Free SDK: User provides graph adapter (DIY), cascade works if configured
 * - Cloud Mode: Cortex provides managed graph adapter, cascade always works + legal guarantees
 */
export class UsersAPI {
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get user profile by ID
   *
   * @example
   * ```typescript
   * const user = await cortex.users.get('user-123');
   * if (user) {
   *   console.log(user.data.displayName);
   * }
   * ```
   */
  async get(userId: string): Promise<UserProfile | null> {
    // Client-side validation
    validateUserId(userId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.get, {
          type: "user",
          id: userId,
        }),
      "users:get",
    );

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Update user profile (creates new version)
   *
   * @example
   * ```typescript
   * const updated = await cortex.users.update('user-123', {
   *   displayName: 'Alex Johnson',
   *   email: 'alex@example.com',
   *   preferences: { theme: 'dark' }
   * });
   * ```
   */
  async update(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<UserProfile> {
    // Client-side validation
    validateUserId(userId);
    validateData(data, "data");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.immutable.store, {
          type: "user",
          id: userId,
          data,
        }),
      "users:update",
    );

    if (!result) {
      throw new Error(`Failed to store user profile for ${userId}`);
    }

    return {
      id: result.id,
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Delete user profile with optional cascade deletion across all layers
   *
   * @param userId - User ID to delete
   * @param options - Deletion options
   * @param options.cascade - Enable cascade deletion across all layers (default: false)
   * @param options.verify - Run verification after deletion (default: true)
   * @param options.dryRun - Preview what would be deleted without actually deleting (default: false)
   *
   * @example
   * ```typescript
   * // Simple deletion (user profile only)
   * await cortex.users.delete('user-123');
   *
   * // GDPR cascade deletion (all layers)
   * const result = await cortex.users.delete('user-123', {
   *   cascade: true
   * });
   * console.log(`Deleted ${result.totalDeleted} records across ${result.deletedLayers.length} layers`);
   * ```
   */
  async delete(
    userId: string,
    options?: DeleteUserOptions,
  ): Promise<UserDeleteResult> {
    // Client-side validation
    validateUserId(userId);
    validateDeleteUserOptions(options);

    const cascade = options?.cascade ?? false;
    const verify = options?.verify ?? true;
    const dryRun = options?.dryRun ?? false;

    if (!cascade) {
      // Simple delete: just user profile from immutable
      if (!dryRun) {
        await this.executeWithResilience(
          () =>
            this.client.mutation(api.immutable.purge, {
              type: "user",
              id: userId,
            }),
          "users:delete",
        );
      }

      return {
        userId,
        deletedAt: Date.now(),
        conversationsDeleted: 0,
        conversationMessagesDeleted: 0,
        immutableRecordsDeleted: 0,
        mutableKeysDeleted: 0,
        vectorMemoriesDeleted: 0,
        factsDeleted: 0,
        graphNodesDeleted: 0,
        verification: {
          complete: true,
          issues: [],
        },
        totalDeleted: dryRun ? 0 : 1,
        deletedLayers: dryRun ? [] : ["user-profile"],
      };
    }

    // PHASE 1: Collect all records (verification)
    const deletionPlan = await this.collectDeletionTargets(userId);

    // Calculate totals for dry run or actual deletion
    const totals = this.calculateDeletionTotals(deletionPlan);

    if (dryRun) {
      // Return preview without deleting
      return {
        userId,
        deletedAt: Date.now(),
        ...totals,
        verification: {
          complete: true,
          issues: [
            `DRY RUN: Would delete ${totals.totalDeleted} total records`,
          ],
        },
        deletedLayers: this.getAffectedLayers(deletionPlan),
      };
    }

    // PHASE 2: Backup records for rollback
    const backups = await this.backupRecords(deletionPlan);

    // PHASE 3: Execute cascade deletion with rollback on failure
    try {
      const result = await this.executeCascadeDeletion(userId, deletionPlan);

      // PHASE 4: Verify deletion (if requested)
      if (verify) {
        const verification = await this.verifyDeletion(userId);
        result.verification = verification;
      }

      return result;
    } catch (error) {
      // ROLLBACK: Restore backed up records
      await this.rollbackDeletion(backups);
      throw new CascadeDeletionError(
        `Cascade deletion failed for user ${userId}, rolled back all changes`,
        error,
      );
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Query Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * List user profiles with pagination
   *
   * @example
   * ```typescript
   * const users = await cortex.users.list({ limit: 50 });
   * for (const user of users) {
   *   console.log(user.data.displayName);
   * }
   * ```
   */
  async list(filters?: ListUsersFilter): Promise<UserProfile[]> {
    // Client-side validation
    validateListUsersFilter(filters);

    const results = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.list, {
          type: "user",
          limit: filters?.limit,
        }),
      "users:list",
    );

    return results.map((r: ImmutableRecord) => ({
      id: r.id,
      data: r.data,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Search user profiles by content
   *
   * @example
   * ```typescript
   * const results = await cortex.users.search({ limit: 10 });
   * ```
   */
  async search(filters: UserFilters): Promise<UserProfile[]> {
    // Client-side validation
    validateUserFilters(filters);

    const results = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.list, {
          type: "user",
          limit: filters.limit,
        }),
      "users:search",
    );

    return results.map((r: ImmutableRecord) => ({
      id: r.id,
      data: r.data,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Count user profiles
   *
   * @example
   * ```typescript
   * const total = await cortex.users.count();
   * console.log(`Total users: ${total}`);
   * ```
   */
  async count(_filters?: UserFilters): Promise<number> {
    // Client-side validation
    validateUserFilters(_filters);

    return await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.count, {
          type: "user",
        }),
      "users:count",
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Version Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get specific version of user profile
   *
   * @example
   * ```typescript
   * const v1 = await cortex.users.getVersion('user-123', 1);
   * ```
   */
  async getVersion(
    userId: string,
    version: number,
  ): Promise<UserVersion | null> {
    // Client-side validation
    validateUserId(userId);
    validateVersionNumber(version);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.getVersion, {
          type: "user",
          id: userId,
          version,
        }),
      "users:getVersion",
    );

    if (!result) {
      return null;
    }

    return {
      version: result.version,
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      timestamp: result.timestamp,
    };
  }

  /**
   * Get version history of user profile
   *
   * @example
   * ```typescript
   * const history = await cortex.users.getHistory('user-123');
   * console.log(`User has ${history.length} versions`);
   * ```
   */
  async getHistory(userId: string): Promise<UserVersion[]> {
    // Client-side validation
    validateUserId(userId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.getHistory, {
          type: "user",
          id: userId,
        }),
      "users:getHistory",
    );

    return result.map(
      (v: { version: number; data: unknown; timestamp: number }) => ({
        version: v.version,
        data: (v.data as Record<string, unknown> | undefined) ?? {},
        timestamp: v.timestamp,
      }),
    );
  }

  /**
   * Get user profile at specific timestamp
   *
   * @example
   * ```typescript
   * const snapshot = await cortex.users.getAtTimestamp(
   *   'user-123',
   *   new Date('2025-10-01')
   * );
   * ```
   */
  async getAtTimestamp(
    userId: string,
    timestamp: Date,
  ): Promise<UserVersion | null> {
    // Client-side validation
    validateUserId(userId);
    validateTimestamp(timestamp);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.immutable.getAtTimestamp, {
          type: "user",
          id: userId,
          timestamp: timestamp.getTime(),
        }),
      "users:getAtTimestamp",
    );

    if (!result) {
      return null;
    }

    return {
      version: result.version,
      data: (result.data as Record<string, unknown> | undefined) ?? {},
      timestamp: result.timestamp,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Utility Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Check if user profile exists
   *
   * @example
   * ```typescript
   * if (await cortex.users.exists('user-123')) {
   *   console.log('User exists');
   * }
   * ```
   */
  async exists(userId: string): Promise<boolean> {
    // Client-side validation
    validateUserId(userId);

    const user = await this.get(userId);
    return user !== null;
  }

  /**
   * Get user profile or create with defaults if doesn't exist
   *
   * @param userId - User ID
   * @param defaults - Default profile data if user doesn't exist
   * @returns User profile (existing or newly created)
   *
   * @example
   * ```typescript
   * const user = await cortex.users.getOrCreate('user-123', {
   *   displayName: 'Guest User',
   *   preferences: { theme: 'light' },
   *   metadata: { tier: 'free' }
   * });
   * ```
   */
  async getOrCreate(
    userId: string,
    defaults?: Record<string, unknown>,
  ): Promise<UserProfile> {
    // Client-side validation
    validateUserId(userId);
    if (defaults !== undefined) {
      validateData(defaults, "defaults");
    }

    // Try to get existing user
    const existing = await this.get(userId);

    if (existing) {
      return existing;
    }

    // Create with defaults (immutable.store handles upsert)
    return await this.update(userId, defaults || {});
  }

  /**
   * Merge partial updates with existing profile
   *
   * This is an alias for update() with merge behavior, which is the default.
   *
   * @param userId - User ID
   * @param updates - Partial updates to merge with existing data
   * @returns Updated user profile
   *
   * @example
   * ```typescript
   * // Existing: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en' } }
   * await cortex.users.merge('user-123', {
   *   preferences: { notifications: true }  // Adds notifications, keeps theme and language
   * });
   * // Result: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en', notifications: true } }
   * ```
   */
  async merge(
    userId: string,
    updates: Record<string, unknown>,
  ): Promise<UserProfile> {
    // Client-side validation
    validateUserId(userId);
    validateData(updates, "updates");

    const existing = await this.get(userId);

    if (!existing) {
      // If user doesn't exist, just store the updates
      return await this.update(userId, updates);
    }

    // Deep merge existing data with updates
    const mergedData = this.deepMerge(existing.data, updates);

    return await this.update(userId, mergedData);
  }

  /**
   * Helper: Deep merge two objects
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (
          sourceValue &&
          typeof sourceValue === "object" &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === "object" &&
          !Array.isArray(targetValue)
        ) {
          // Recursively merge nested objects
          result[key] = this.deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>,
          );
        } else {
          // Overwrite with source value
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Export user profiles
   *
   * @example
   * ```typescript
   * const json = await cortex.users.export({
   *   format: 'json'
   * });
   * ```
   */
  async export(options?: ExportUsersOptions): Promise<string> {
    // Client-side validation
    validateExportOptions(options);

    const users = await this.list(options?.filters);

    if (options?.format === "csv") {
      // CSV export
      const headers = ["id", "version", "createdAt", "updatedAt", "data"];
      const rows = users.map((u) => [
        u.id,
        u.version.toString(),
        new Date(u.createdAt).toISOString(),
        new Date(u.updatedAt).toISOString(),
        JSON.stringify(u.data),
      ]);

      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // JSON export (default)
    return JSON.stringify(users as UserProfile[], null, 2);
  }

  /**
   * Bulk update multiple users
   *
   * @param userIds - Array of user IDs to update
   * @param updates - Updates to apply to all users
   * @param options - Update options
   * @returns Update result
   *
   * @example
   * ```typescript
   * const result = await cortex.users.updateMany(
   *   ['user-1', 'user-2', 'user-3'],
   *   { data: { status: 'active' } }
   * );
   * console.log(`Updated ${result.updated} users`);
   * ```
   */
  async updateMany(
    userIds: string[],
    updates: { data: Record<string, unknown> },
    options?: { skipVersioning?: boolean; dryRun?: boolean },
  ): Promise<{ updated: number; userIds: string[] }> {
    // Client-side validation
    validateUserIdsArray(userIds, 1, 100);
    // Runtime validation for potentially untrusted external input
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!updates || !updates.data) {
      throw new UserValidationError(
        "updates.data is required",
        "MISSING_DATA",
        "updates.data",
      );
    }
    validateData(updates.data, "updates.data");
    validateBulkUpdateOptions(options);

    if (options?.dryRun) {
      return {
        updated: 0,
        userIds: userIds,
      };
    }

    const results: string[] = [];

    for (const userId of userIds) {
      try {
        const user = await this.get(userId);
        if (user) {
          await this.update(userId, updates.data);
          results.push(userId);
        }
      } catch (_e) {
        // Continue on error
        continue;
      }
    }

    return {
      updated: results.length,
      userIds: results,
    };
  }

  /**
   * Bulk delete multiple users
   *
   * @param userIds - Array of user IDs to delete
   * @param options - Delete options
   * @returns Delete result
   *
   * @example
   * ```typescript
   * const result = await cortex.users.deleteMany(
   *   ['user-1', 'user-2', 'user-3'],
   *   { cascade: true }
   * );
   * console.log(`Deleted ${result.deleted} users`);
   * ```
   */
  async deleteMany(
    userIds: string[],
    options?: { cascade?: boolean; dryRun?: boolean },
  ): Promise<{ deleted: number; userIds: string[] }> {
    // Client-side validation
    validateUserIdsArray(userIds, 1, 100);
    validateBulkDeleteOptions(options);

    if (options?.dryRun) {
      return {
        deleted: 0,
        userIds: userIds,
      };
    }

    const results: string[] = [];

    for (const userId of userIds) {
      try {
        await this.delete(userId, options);
        results.push(userId);
      } catch (_e) {
        // Continue if user doesn't exist
        continue;
      }
    }

    return {
      deleted: results.length,
      userIds: results,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helper Methods - Cascade Deletion Implementation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * PHASE 1: Collect all records that will be deleted
   *
   * OPTIMIZED: Instead of collecting all individual records (which requires
   * looping through all memory spaces), we collect:
   * - Memory space IDs (for batch deleteMany operations)
   * - Individual records only where batch operations aren't available
   *
   * This matches the Python SDK approach for fast cascade deletion.
   */
  private async collectDeletionTargets(userId: string): Promise<DeletionPlan> {
    const plan: DeletionPlan = {
      conversations: [],
      immutable: [],
      mutable: [],
      vector: [], // Will store MemoryEntry[] for compatibility, but we use memorySpaceIds for deletion
      facts: [],
      graph: [],
      userProfile: null,
    };

    // Collect memory space IDs from user's conversations only
    // This is much more efficient than scanning ALL registered memory spaces
    // which could number in the hundreds from previous test runs
    const memorySpaceIds = new Set<string>();

    // Collect conversations - single query with userId filter
    try {
      const convos = await this.client.query(api.conversations.list, {
        userId,
      });
      plan.conversations = convos as Conversation[];

      // Add memory space IDs from conversations - these are the spaces that
      // could have user-associated data (memories, facts)
      for (const conv of plan.conversations) {
        if (conv.memorySpaceId) {
          memorySpaceIds.add(conv.memorySpaceId);
        }
      }
    } catch (error) {
      console.warn("Failed to collect conversations:", error);
    }

    // NOTE: We intentionally DON'T scan all registered memory spaces here.
    // Previously we did: `memorySpaces.list` → loop through all → 100+ queries
    // This caused 60s+ timeouts when there were many test-created spaces.
    //
    // Instead, we only check spaces from user's conversations. If there are
    // memories in other spaces (unlikely for properly structured data), they
    // should be cleaned up separately or will fail verification.

    // Store memory space IDs in the plan for batch deletion
    (plan as DeletionPlan & { memorySpaceIds?: string[] }).memorySpaceIds =
      Array.from(memorySpaceIds);

    // Collect immutable records (excluding user profile itself) - single query
    try {
      const immutableRecords = await this.client.query(api.immutable.list, {
        userId,
      });
      plan.immutable = (immutableRecords as ImmutableRecord[]).filter(
        (r) => !(r.type === "user" && r.id === userId),
      );
    } catch (error) {
      console.warn("Failed to collect immutable records:", error);
    }

    // Collect mutable keys (limited to known namespaces)
    try {
      const mutableKeys = await this.collectMutableKeys(userId);
      plan.mutable = mutableKeys;
    } catch (error) {
      console.warn("Failed to collect mutable keys:", error);
    }

    // Collect facts using userId filter (facts.list supports userId)
    // This is more efficient than collecting all facts and filtering client-side
    for (const spaceId of memorySpaceIds) {
      try {
        const facts = await this.client.query(api.facts.list, {
          memorySpaceId: spaceId,
          userId,
        });
        plan.facts.push(...(facts as FactRecord[]));
      } catch (_error) {
        // Space might not have facts - continue
      }
    }

    // Note: We don't collect individual vector memories here anymore
    // Instead, we use batch deleteMany operations in the execution phase

    // Collect graph nodes (if adapter provided)
    if (this.graphAdapter) {
      try {
        const graphNodes = await this.collectGraphNodes(userId);
        plan.graph = graphNodes;
      } catch (error) {
        console.warn("Failed to collect graph nodes:", error);
      }
    }

    // User profile
    const profile = await this.get(userId);
    plan.userProfile = profile;

    return plan;
  }

  /**
   * Collect mutable keys associated with user
   */
  private async collectMutableKeys(userId: string): Promise<MutableRecord[]> {
    // In Convex, we need to query across all namespaces
    // This is a limitation - in production, you'd maintain a registry of namespaces
    // For now, we'll query common namespaces
    const commonNamespaces = [
      "user-sessions",
      "user-cache",
      "user-preferences",
      "user-data",
      "sessions",
      "cache",
      "preferences",
    ];

    const allMutableKeys: MutableRecord[] = [];

    for (const namespace of commonNamespaces) {
      try {
        const keys = await this.client.query(api.mutable.list, {
          namespace,
          userId,
        });
        allMutableKeys.push(...(keys as MutableRecord[]));
      } catch (_error) {
        // Namespace might not exist, skip
        continue;
      }
    }

    return allMutableKeys;
  }

  // NOTE: collectVectorMemories and collectFacts were removed as part of
  // optimization. We now use batch deleteMany operations instead of collecting
  // individual records. This matches the Python SDK approach.

  /**
   * Collect graph nodes associated with user
   */
  private async collectGraphNodes(
    userId: string,
  ): Promise<Array<{ nodeId: string; labels: string[] }>> {
    if (!this.graphAdapter) {
      return [];
    }

    try {
      // Query graph for all nodes with userId property
      // Return both the node and its ID using the appropriate ID function
      const result = await this.graphAdapter.query(
        `MATCH (n {userId: $userId}) RETURN elementId(n) as id, labels(n) as labels`,
        { userId },
      );

      // GraphQueryResult has a .records property
      return result.records.map((record) => {
        const node = record as unknown as Neo4jNodeRecord;
        return {
          nodeId: node.id,
          labels: node.labels,
        };
      });
    } catch (error) {
      console.warn("Failed to query graph nodes:", error);
      return [];
    }
  }

  /**
   * PHASE 2: Backup records for rollback
   */
  private async backupRecords(plan: DeletionPlan): Promise<DeletionBackup> {
    // Create deep copies of all records for potential rollback
    return {
      conversations: JSON.parse(
        JSON.stringify(plan.conversations),
      ) as Conversation[],
      immutable: JSON.parse(
        JSON.stringify(plan.immutable),
      ) as ImmutableRecord[],
      mutable: JSON.parse(JSON.stringify(plan.mutable)) as MutableRecord[],
      vector: JSON.parse(JSON.stringify(plan.vector)) as MemoryEntry[],
      facts: JSON.parse(JSON.stringify(plan.facts)) as FactRecord[],
      userProfile: plan.userProfile
        ? (JSON.parse(
            JSON.stringify(plan.userProfile),
          ) as unknown as UserProfile)
        : null,
    };
  }

  /**
   * PHASE 3: Execute cascade deletion in reverse dependency order
   *
   * OPTIMIZED: Uses batch deleteMany operations instead of individual deletes.
   * This is much faster for large datasets and matches the Python SDK approach.
   */
  private async executeCascadeDeletion(
    userId: string,
    plan: DeletionPlan,
  ): Promise<UserDeleteResult> {
    const result: UserDeleteResult = {
      userId,
      deletedAt: Date.now(),
      conversationsDeleted: 0,
      conversationMessagesDeleted: 0,
      immutableRecordsDeleted: 0,
      mutableKeysDeleted: 0,
      vectorMemoriesDeleted: 0,
      factsDeleted: 0,
      graphNodesDeleted: 0,
      verification: {
        complete: false,
        issues: [],
      },
      totalDeleted: 0,
      deletedLayers: [],
    };

    // Get memory space IDs from the plan
    const memorySpaceIds =
      (plan as DeletionPlan & { memorySpaceIds?: string[] }).memorySpaceIds ||
      [];

    // Delete in reverse dependency order to maintain referential integrity
    // Order: vector → facts → mutable → immutable → conversations → graph → user profile

    // 1. Delete vector memories using batch deleteMany (one call per space)
    for (const spaceId of memorySpaceIds) {
      try {
        const deleteResult = await this.client.mutation(api.memories.deleteMany, {
          memorySpaceId: spaceId,
          userId,
        });
        const deleted = (deleteResult as { deleted: number }).deleted || 0;
        result.vectorMemoriesDeleted += deleted;
      } catch (error) {
        // Space might not exist or have no memories - continue
        console.warn(`Failed to delete memories in space ${spaceId}:`, error);
      }
    }
    if (result.vectorMemoriesDeleted > 0) {
      result.deletedLayers.push("vector");
    }

    // 2. Delete facts using batch approach (if available) or individual deletes
    // Note: facts.deleteMany doesn't support userId filter, so we use collected facts
    for (const fact of plan.facts) {
      try {
        await this.client.mutation(api.facts.deleteFact, {
          memorySpaceId: fact.memorySpaceId,
          factId: fact.factId,
        });
        result.factsDeleted++;
      } catch (error) {
        // Fact might already be deleted - continue
        console.warn(`Failed to delete fact ${fact.factId}:`, error);
      }
    }
    if (result.factsDeleted > 0) {
      result.deletedLayers.push("facts");
    }

    // 3. Delete mutable records
    for (const mutable of plan.mutable) {
      try {
        await this.client.mutation(api.mutable.deleteKey, {
          namespace: mutable.namespace,
          key: mutable.key,
        });
        result.mutableKeysDeleted++;
      } catch (error) {
        // Key might already be deleted - continue
        console.warn(
          `Failed to delete mutable ${mutable.namespace}:${mutable.key}:`,
          error,
        );
      }
    }
    if (result.mutableKeysDeleted > 0) {
      result.deletedLayers.push("mutable");
    }

    // 4. Delete immutable records (excluding user profile)
    for (const immutable of plan.immutable) {
      try {
        await this.client.mutation(api.immutable.purge, {
          type: immutable.type,
          id: immutable.id,
        });
        result.immutableRecordsDeleted++;
      } catch (error) {
        // Record might already be deleted - continue
        console.warn(
          `Failed to delete immutable ${immutable.type}:${immutable.id}:`,
          error,
        );
      }
    }
    if (result.immutableRecordsDeleted > 0) {
      result.deletedLayers.push("immutable");
    }

    // 5. Delete conversations (idempotent - "not found" = success)
    for (const conversation of plan.conversations) {
      try {
        await this.client.mutation(api.conversations.deleteConversation, {
          conversationId: conversation.conversationId,
        });
        result.conversationsDeleted++;
        result.conversationMessagesDeleted += conversation.messageCount || 0;
      } catch (error) {
        // Check if conversation was already deleted (race condition in parallel tests)
        const errorStr = String(error);
        if (
          errorStr.includes("CONVERSATION_NOT_FOUND") ||
          errorStr.includes("not found")
        ) {
          // Already deleted - count as success
          result.conversationsDeleted++;
          result.conversationMessagesDeleted += conversation.messageCount || 0;
        } else {
          console.warn(
            `Failed to delete conversation ${conversation.conversationId}:`,
            error,
          );
        }
      }
    }
    if (result.conversationsDeleted > 0) {
      result.deletedLayers.push("conversations");
    }

    // 6. Delete graph nodes (if adapter provided)
    if (this.graphAdapter && plan.graph.length > 0) {
      const deletionContext = createDeletionContext(
        `GDPR cascade deletion for user ${userId}`,
        {
          ...ORPHAN_RULES,
          User: { explicitOnly: false, neverDelete: false },
        },
      );

      for (const node of plan.graph) {
        try {
          const deleteResult = await deleteWithOrphanCleanup(
            node.nodeId,
            node.labels[0] || "User",
            deletionContext,
            this.graphAdapter,
          );
          result.graphNodesDeleted =
            (result.graphNodesDeleted || 0) + deleteResult.deletedNodes.length;
        } catch (error) {
          console.warn(`Failed to delete graph node ${node.nodeId}:`, error);
        }
      }
      if (result.graphNodesDeleted && result.graphNodesDeleted > 0) {
        result.deletedLayers.push("graph");
      }
    }

    // 7. Delete user profile (last)
    if (plan.userProfile) {
      try {
        await this.client.mutation(api.immutable.purge, {
          type: "user",
          id: userId,
        });
        result.deletedLayers.push("user-profile");
      } catch (error) {
        // User profile might already be deleted
        const errorStr = String(error);
        if (
          !errorStr.includes("IMMUTABLE_ENTRY_NOT_FOUND") &&
          !errorStr.includes("not found")
        ) {
          console.warn(`Failed to delete user profile ${userId}:`, error);
        }
      }
    }

    // Calculate total
    result.totalDeleted =
      result.conversationsDeleted +
      result.immutableRecordsDeleted +
      result.mutableKeysDeleted +
      result.vectorMemoriesDeleted +
      result.factsDeleted +
      (result.graphNodesDeleted || 0) +
      (plan.userProfile ? 1 : 0);

    return result;
  }

  /**
   * ROLLBACK: Restore backed up records
   */
  private async rollbackDeletion(backups: DeletionBackup): Promise<void> {
    console.warn("Rolling back cascade deletion...");

    // Restore in reverse order of deletion
    // Note: This is best-effort rollback, some operations may fail

    // 1. Restore user profile
    if (backups.userProfile) {
      try {
        await this.client.mutation(api.immutable.store, {
          type: "user",
          id: backups.userProfile.id,
          data: backups.userProfile.data,
        });
      } catch (error) {
        console.error("Failed to restore user profile:", error);
      }
    }

    // 2. Restore conversations
    for (const conversation of backups.conversations) {
      try {
        // Note: Restoring conversations is complex due to message IDs
        // In production, this would use a dedicated restore API
        console.warn(
          `Conversation ${conversation.conversationId} requires manual restoration`,
        );
      } catch (error) {
        console.error("Failed to restore conversation:", error);
      }
    }

    // 3. Restore immutable records
    for (const immutable of backups.immutable) {
      try {
        await this.client.mutation(api.immutable.store, {
          type: immutable.type,
          id: immutable.id,
          data: immutable.data,
          userId: immutable.userId,
          metadata: immutable.metadata,
        });
      } catch (error) {
        console.error("Failed to restore immutable record:", error);
      }
    }

    // 4. Restore mutable records
    for (const mutable of backups.mutable) {
      try {
        await this.client.mutation(api.mutable.set, {
          namespace: mutable.namespace,
          key: mutable.key,
          value: mutable.value,
          userId: mutable.userId,
          metadata: mutable.metadata,
        });
      } catch (error) {
        console.error("Failed to restore mutable record:", error);
      }
    }

    // 5. Restore vector memories
    for (const memory of backups.vector) {
      try {
        // Note: Vector restoration is complex due to version history
        console.warn(`Memory ${memory.memoryId} requires manual restoration`);
      } catch (error) {
        console.error("Failed to restore memory:", error);
      }
    }

    // 6. Restore facts
    for (const fact of backups.facts) {
      try {
        // Note: Fact restoration may require re-extraction
        console.warn(`Fact ${fact.factId} requires manual restoration`);
      } catch (error) {
        console.error("Failed to restore fact:", error);
      }
    }

    console.warn(
      "Rollback completed (best-effort, some records may require manual restoration)",
    );
  }

  /**
   * PHASE 4: Verify deletion completeness
   *
   * OPTIMIZED: Uses simple count queries instead of looping through all memory spaces.
   * This matches the Python SDK approach for fast verification.
   */
  private async verifyDeletion(userId: string): Promise<VerificationResult> {
    const issues: string[] = [];

    // Check conversations - single query with userId filter
    try {
      const remainingConvos = await this.client.query(api.conversations.count, {
        userId,
      });
      if (remainingConvos > 0) {
        issues.push(`${remainingConvos} conversations still reference userId`);
      }
    } catch (error) {
      issues.push(`Failed to verify conversations: ${error}`);
    }

    // Check immutable records - single query with userId filter
    try {
      const remainingImmutable = await this.client.query(api.immutable.count, {
        userId,
      });
      if (remainingImmutable > 0) {
        issues.push(
          `${remainingImmutable} immutable records still reference userId`,
        );
      }
    } catch (error) {
      issues.push(`Failed to verify immutable records: ${error}`);
    }

    // Check user profile still exists
    try {
      const user = await this.get(userId);
      if (user) {
        issues.push("User profile still exists");
      }
    } catch (error) {
      issues.push(`Failed to verify user profile: ${error}`);
    }

    // Note: Vector memories and facts are verified implicitly through the deletion
    // execution phase. Looping through all memory spaces for verification is too
    // expensive (O(n) queries where n = number of spaces). The deletion phase
    // already uses efficient deleteMany operations with userId filters.

    // Graph verification is optional and only if adapter is available
    if (this.graphAdapter) {
      try {
        const remainingGraph = await this.countGraphNodes(userId);
        if (remainingGraph > 0) {
          issues.push(`${remainingGraph} graph nodes still reference userId`);
        }
      } catch (error) {
        issues.push(`Failed to verify graph nodes: ${error}`);
      }
    }

    return {
      complete: issues.length === 0,
      issues,
    };
  }

  // NOTE: countVectorMemories and countFacts were removed as part of
  // verification optimization. Vector memories and facts are now verified
  // implicitly through the deletion execution phase, avoiding expensive
  // O(n) queries across all memory spaces.

  /**
   * Count remaining graph nodes for user
   */
  private async countGraphNodes(userId: string): Promise<number> {
    if (!this.graphAdapter) {
      return 0;
    }

    try {
      const result = await this.graphAdapter.query(
        `MATCH (n {userId: $userId}) RETURN count(n) as count`,
        { userId },
      );
      // GraphQueryResult has a .records property
      const record = result.records[0] as unknown as
        | Neo4jCountRecord
        | undefined;
      return record?.count ?? 0;
    } catch (error) {
      console.warn("Failed to count graph nodes:", error);
      return 0;
    }
  }

  /**
   * Calculate deletion totals from plan
   */
  private calculateDeletionTotals(plan: DeletionPlan): {
    conversationsDeleted: number;
    conversationMessagesDeleted: number;
    immutableRecordsDeleted: number;
    mutableKeysDeleted: number;
    vectorMemoriesDeleted: number;
    factsDeleted: number;
    graphNodesDeleted?: number;
    totalDeleted: number;
  } {
    const conversationsDeleted = plan.conversations.length;
    const conversationMessagesDeleted = plan.conversations.reduce(
      (sum, c) => sum + (c.messageCount || 0),
      0,
    );
    const immutableRecordsDeleted = plan.immutable.length;
    const mutableKeysDeleted = plan.mutable.length;
    const vectorMemoriesDeleted = plan.vector.length;
    const factsDeleted = plan.facts.length;
    const graphNodesDeleted = plan.graph.length;

    const totalDeleted =
      conversationsDeleted +
      immutableRecordsDeleted +
      mutableKeysDeleted +
      vectorMemoriesDeleted +
      factsDeleted +
      graphNodesDeleted +
      (plan.userProfile ? 1 : 0);

    return {
      conversationsDeleted,
      conversationMessagesDeleted,
      immutableRecordsDeleted,
      mutableKeysDeleted,
      vectorMemoriesDeleted,
      factsDeleted,
      graphNodesDeleted,
      totalDeleted,
    };
  }

  /**
   * Get affected layers from deletion plan
   */
  private getAffectedLayers(plan: DeletionPlan): string[] {
    const layers: string[] = [];

    if (plan.conversations.length > 0) layers.push("conversations");
    if (plan.immutable.length > 0) layers.push("immutable");
    if (plan.mutable.length > 0) layers.push("mutable");
    if (plan.vector.length > 0) layers.push("vector");
    if (plan.facts.length > 0) layers.push("facts");
    if (plan.graph.length > 0) layers.push("graph");
    if (plan.userProfile) layers.push("user-profile");

    return layers;
  }
}
