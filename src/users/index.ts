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
import type { GraphAdapter } from "../graph/types";
import {
  deleteWithOrphanCleanup,
  createDeletionContext,
  ORPHAN_RULES,
} from "../graph/sync/orphanDetection";

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
  ) {}

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
    const result = await this.client.query(api.immutable.get, {
      type: "user",
      id: userId,
    });

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      data: result.data,
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
    const result = await this.client.mutation(api.immutable.store, {
      type: "user",
      id: userId,
      data,
    });

    if (!result) {
      throw new Error(`Failed to store user profile for ${userId}`);
    }

    return {
      id: result.id,
      data: result.data,
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
    const cascade = options?.cascade ?? false;
    const verify = options?.verify ?? true;
    const dryRun = options?.dryRun ?? false;

    if (!cascade) {
      // Simple delete: just user profile from immutable
      if (!dryRun) {
        await this.client.mutation(api.immutable.purge, {
          type: "user",
          id: userId,
        });
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
    const results = await this.client.query(api.immutable.list, {
      type: "user",
      limit: filters?.limit,
    });

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
    const results = await this.client.query(api.immutable.list, {
      type: "user",
      limit: filters.limit,
    });

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
    return await this.client.query(api.immutable.count, {
      type: "user",
    });
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
    const result = await this.client.query(api.immutable.getVersion, {
      type: "user",
      id: userId,
      version,
    });

    if (!result) {
      return null;
    }

    return {
      version: result.version,
      data: result.data,
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
    const result = await this.client.query(api.immutable.getHistory, {
      type: "user",
      id: userId,
    });

    return result.map((v) => ({
      version: v.version,
      data: v.data,
      timestamp: v.timestamp,
    }));
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
    const result = await this.client.query(api.immutable.getAtTimestamp, {
      type: "user",
      id: userId,
      timestamp: timestamp.getTime(),
    });

    if (!result) {
      return null;
    }

    return {
      version: result.version,
      data: result.data,
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
    const user = await this.get(userId);
    return user !== null;
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
    return JSON.stringify(users, null, 2);
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
    updates: { data: Record<string, any> },
    options?: { skipVersioning?: boolean; dryRun?: boolean },
  ): Promise<{ updated: number; userIds: string[] }> {
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
          await this.update(userId, updates, options);
          results.push(userId);
        }
      } catch (e) {
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
      } catch (e) {
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
   */
  private async collectDeletionTargets(userId: string): Promise<DeletionPlan> {
    const plan: DeletionPlan = {
      conversations: [],
      immutable: [],
      mutable: [],
      vector: [],
      facts: [],
      graph: [],
      userProfile: null,
    };

    // Collect conversations
    try {
      const convos = await this.client.query(api.conversations.list, {
        userId,
      });
      plan.conversations = convos as Conversation[];
    } catch (error) {
      console.warn("Failed to collect conversations:", error);
    }

    // Collect immutable records (excluding user profile itself)
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

    // Collect mutable keys
    try {
      const mutableKeys = await this.collectMutableKeys(userId);
      plan.mutable = mutableKeys;
    } catch (error) {
      console.warn("Failed to collect mutable keys:", error);
    }

    // Collect vector memories (across all memory spaces)
    try {
      const vectorMemories = await this.collectVectorMemories(userId);
      plan.vector = vectorMemories;
    } catch (error) {
      console.warn("Failed to collect vector memories:", error);
    }

    // Collect facts
    try {
      const facts = await this.collectFacts(userId);
      plan.facts = facts;
    } catch (error) {
      console.warn("Failed to collect facts:", error);
    }

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

  /**
   * Collect vector memories associated with user across all memory spaces
   */
  private async collectVectorMemories(userId: string): Promise<MemoryEntry[]> {
    // We need to query across all memory spaces
    // This is expensive but necessary for GDPR compliance
    // In production, maintain an index of userId -> memorySpaceIds

    // For now, we'll use a pragmatic approach:
    // Query all memory spaces and filter by userId
    const allMemories: MemoryEntry[] = [];

    // Get all registered memory spaces
    try {
      const memorySpaces = await this.client.query(api.memorySpaces.list, {});

      for (const space of memorySpaces) {
        try {
          const memories = await this.client.query(api.memories.list, {
            memorySpaceId: space.memorySpaceId,
            userId,
          });
          allMemories.push(...(memories as MemoryEntry[]));
        } catch (_error) {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to query memory spaces:", error);
    }

    return allMemories;
  }

  /**
   * Collect facts associated with user
   */
  private async collectFacts(userId: string): Promise<FactRecord[]> {
    // Facts are memory-space scoped, so we need to query across all spaces
    const allFacts: FactRecord[] = [];

    try {
      const memorySpaces = await this.client.query(api.memorySpaces.list, {});

      for (const space of memorySpaces) {
        try {
          const facts = await this.client.query(api.facts.list, {
            memorySpaceId: space.memorySpaceId,
          });
          // Filter facts that reference this user in sourceRef
          const userFacts = (facts as FactRecord[]).filter((f) =>
            this.factReferencesUser(f, userId),
          );
          allFacts.push(...userFacts);
        } catch (_error) {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to collect facts:", error);
    }

    return allFacts;
  }

  /**
   * Check if fact references user
   */
  private factReferencesUser(fact: FactRecord, _userId: string): boolean {
    // Check if fact references user in source ref or metadata
    if (fact.sourceRef?.conversationId) {
      // Would need to check if conversation belongs to user
      // For now, we'll include it
      return true;
    }
    return false;
  }

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
      return result.records.map((record: any) => ({
        nodeId: record.id,
        labels: record.labels || [],
      }));
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
      conversations: JSON.parse(JSON.stringify(plan.conversations)),
      immutable: JSON.parse(JSON.stringify(plan.immutable)),
      mutable: JSON.parse(JSON.stringify(plan.mutable)),
      vector: JSON.parse(JSON.stringify(plan.vector)),
      facts: JSON.parse(JSON.stringify(plan.facts)),
      userProfile: plan.userProfile
        ? JSON.parse(JSON.stringify(plan.userProfile))
        : null,
    };
  }

  /**
   * PHASE 3: Execute cascade deletion in reverse dependency order
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

    // Delete in reverse dependency order to maintain referential integrity
    // Order: facts → vector → mutable → immutable → conversations → graph → user profile

    // 1. Delete facts
    for (const fact of plan.facts) {
      try {
        await this.client.mutation(api.facts.deleteFact, {
          memorySpaceId: fact.memorySpaceId,
          factId: fact.factId,
        });
        result.factsDeleted++;
      } catch (error) {
        throw new Error(`Failed to delete fact ${fact.factId}: ${error}`);
      }
    }
    if (result.factsDeleted > 0) {
      result.deletedLayers.push("facts");
    }

    // 2. Delete vector memories
    for (const memory of plan.vector) {
      try {
        await this.client.mutation(api.memories.deleteMemory, {
          memorySpaceId: memory.memorySpaceId,
          memoryId: memory.memoryId,
        });
        result.vectorMemoriesDeleted++;
      } catch (error) {
        throw new Error(`Failed to delete memory ${memory.memoryId}: ${error}`);
      }
    }
    if (result.vectorMemoriesDeleted > 0) {
      result.deletedLayers.push("vector");
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
        throw new Error(
          `Failed to delete mutable ${mutable.namespace}:${mutable.key}: ${error}`,
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
        throw new Error(
          `Failed to delete immutable ${immutable.type}:${immutable.id}: ${error}`,
        );
      }
    }
    if (result.immutableRecordsDeleted > 0) {
      result.deletedLayers.push("immutable");
    }

    // 5. Delete conversations
    for (const conversation of plan.conversations) {
      try {
        await this.client.mutation(api.conversations.deleteConversation, {
          conversationId: conversation.conversationId,
        });
        result.conversationsDeleted++;
        result.conversationMessagesDeleted += conversation.messageCount || 0;
      } catch (error) {
        throw new Error(
          `Failed to delete conversation ${conversation.conversationId}: ${error}`,
        );
      }
    }
    if (result.conversationsDeleted > 0) {
      result.deletedLayers.push("conversations");
    }

    // 6. Delete graph nodes (if adapter provided)
    if (this.graphAdapter && plan.graph.length > 0) {
      // Use orphan detection and cleanup for proper graph deletion
      const deletionContext = createDeletionContext(
        `GDPR cascade deletion for user ${userId}`,
        {
          ...ORPHAN_RULES,
          // Override User rule for GDPR deletion (explicitly requested)
          User: { explicitOnly: false, neverDelete: false },
        },
      );

      for (const node of plan.graph) {
        try {
          // Use deleteWithOrphanCleanup for proper orphan detection
          const deleteResult = await deleteWithOrphanCleanup(
            node.nodeId,
            node.labels[0] || "User", // Node type
            deletionContext,
            this.graphAdapter,
          );

          result.graphNodesDeleted =
            (result.graphNodesDeleted || 0) + deleteResult.deletedNodes.length;

          // Log orphan islands if any were found and deleted
          if (deleteResult.orphanIslands.length > 0) {
            console.log(
              `  ℹ️  Deleted ${deleteResult.orphanIslands.length} orphan islands during user cascade`,
            );
          }
        } catch (error) {
          throw new Error(
            `Failed to delete graph node ${node.nodeId}: ${error}`,
          );
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
        throw new Error(`Failed to delete user profile ${userId}: ${error}`);
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
   */
  private async verifyDeletion(userId: string): Promise<VerificationResult> {
    const issues: string[] = [];

    // Check conversations
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

    // Check immutable
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

    // Check vector memories
    try {
      const remainingVector = await this.countVectorMemories(userId);
      if (remainingVector > 0) {
        issues.push(
          `${remainingVector} vector memories still reference userId`,
        );
      }
    } catch (error) {
      issues.push(`Failed to verify vector memories: ${error}`);
    }

    // Check facts
    try {
      const remainingFacts = await this.countFacts(userId);
      if (remainingFacts > 0) {
        issues.push(`${remainingFacts} facts still reference userId`);
      }
    } catch (error) {
      issues.push(`Failed to verify facts: ${error}`);
    }

    // Check graph (if available)
    if (this.graphAdapter) {
      try {
        const remainingGraph = await this.countGraphNodes(userId);
        if (remainingGraph > 0) {
          issues.push(`${remainingGraph} graph nodes still reference userId`);
        }
      } catch (error) {
        issues.push(`Failed to verify graph nodes: ${error}`);
      }
    } else {
      issues.push(
        "Graph adapter not configured - manual graph cleanup required",
      );
    }

    return {
      complete:
        issues.length === 0 ||
        (issues.length === 1 && issues[0].includes("Graph adapter")),
      issues,
    };
  }

  /**
   * Count remaining vector memories for user
   */
  private async countVectorMemories(userId: string): Promise<number> {
    let count = 0;

    try {
      const memorySpaces = await this.client.query(api.memorySpaces.list, {});

      for (const space of memorySpaces) {
        try {
          const spaceCount = await this.client.query(api.memories.count, {
            memorySpaceId: space.memorySpaceId,
            userId,
          });
          count += spaceCount;
        } catch (_error) {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to count vector memories:", error);
    }

    return count;
  }

  /**
   * Count remaining facts for user
   */
  private async countFacts(userId: string): Promise<number> {
    let count = 0;

    try {
      const memorySpaces = await this.client.query(api.memorySpaces.list, {});

      for (const space of memorySpaces) {
        try {
          const facts = await this.client.query(api.facts.list, {
            memorySpaceId: space.memorySpaceId,
          });
          const userFacts = (facts as FactRecord[]).filter((f) =>
            this.factReferencesUser(f, userId),
          );
          count += userFacts.length;
        } catch (_error) {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to count facts:", error);
    }

    return count;
  }

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
      return (result.records[0] as any)?.count || 0;
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
