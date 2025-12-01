/**
 * Test Cleanup Helpers
 *
 * Utilities for purging tables and ensuring clean test state.
 *
 * Contains two cleanup strategies:
 * 1. TestCleanup - Legacy global cleanup (purges ALL data)
 * 2. ScopedCleanup - New parallel-safe cleanup (purges only data with matching prefix)
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type { TestRunContext } from "./isolation";

export class TestCleanup {
  constructor(protected client: ConvexClient) {}

  /**
   * Purge all conversations from the database
   */
  async purgeConversations(): Promise<{ deleted: number }> {
    console.log("🧹 Purging conversations table...");

    // Get all conversations
    const conversations = await this.client.query(api.conversations.list, {});

    // Delete each one (ignore errors if already deleted)
    let deleted = 0;

    for (const conversation of conversations) {
      try {
        await this.client.mutation(api.conversations.deleteConversation, {
          conversationId: conversation.conversationId,
        });
        deleted++;
      } catch (err: any) {
        // Ignore "CONVERSATION_NOT_FOUND" errors (already deleted)
        if (!err.message?.includes("CONVERSATION_NOT_FOUND")) {
          throw err;
        }
      }
    }

    console.log(`✅ Purged ${deleted} conversations`);

    return { deleted };
  }

  /**
   * Purge ALL memories from the database (no filtering)
   * Safe for test environments with no real data retention requirements
   */
  async purgeMemories(): Promise<{ deleted: number }> {
    console.log("🧹 Purging ALL memories from database...");

    try {
      const result = await this.client.mutation(api.memories.purgeAll, {});

      console.log(`✅ Purged ${result.deleted} total memories`);

      return { deleted: result.deleted };
    } catch (err: any) {
      console.error("❌ Failed to purge memories:", err.message);

      return { deleted: 0 };
    }
  }

  /**
   * Purge facts from the database
   */
  async purgeFacts(): Promise<{ deleted: number }> {
    console.log("🧹 Purging facts table...");

    try {
      const result = await this.client.mutation(api.facts.purgeAll, {});

      console.log(`✅ Purged ${result.deleted} facts`);

      return { deleted: result.deleted };
    } catch (err: any) {
      console.error("❌ Failed to purge facts:", err.message);

      return { deleted: 0 };
    }
  }

  /**
   * Purge contexts from the database
   */
  async purgeContexts(): Promise<{ deleted: number }> {
    console.log("🧹 Purging contexts table...");

    try {
      const result = await this.client.mutation(api.contexts.purgeAll, {});

      console.log(`✅ Purged ${result.deleted} contexts`);

      return { deleted: result.deleted };
    } catch (err: any) {
      console.error("❌ Failed to purge contexts:", err.message);

      return { deleted: 0 };
    }
  }

  /**
   * Purge memory spaces from the database
   */
  async purgeMemorySpaces(): Promise<{ deleted: number }> {
    console.log("🧹 Purging memorySpaces table...");

    try {
      const result = await this.client.mutation(api.memorySpaces.purgeAll, {});

      console.log(`✅ Purged ${result.deleted} memory spaces`);

      return { deleted: result.deleted };
    } catch (err: any) {
      console.error("❌ Failed to purge memory spaces:", err.message);

      return { deleted: 0 };
    }
  }

  /**
   * Purge all test data (all tables)
   */
  async purgeAll(): Promise<{
    conversations: number;
    memories: number;
    facts: number;
    contexts: number;
    memorySpaces: number;
  }> {
    // Order matters: delete in reverse dependency order
    const convResult = await this.purgeConversations();
    const memResult = await this.purgeMemories();
    const factsResult = await this.purgeFacts();
    const contextsResult = await this.purgeContexts();
    const spacesResult = await this.purgeMemorySpaces();

    return {
      conversations: convResult.deleted,
      memories: memResult.deleted,
      facts: factsResult.deleted,
      contexts: contextsResult.deleted,
      memorySpaces: spacesResult.deleted,
    };
  }

  /**
   * Verify conversations table is empty
   */
  async verifyConversationsEmpty(): Promise<boolean> {
    const count = await this.client.query(api.conversations.count, {});

    if (count > 0) {
      console.warn(`⚠️  Conversations table not empty: ${count} records found`);

      return false;
    }
    console.log("✅ Conversations table is empty");

    return true;
  }

  /**
   * Get current state of conversations table
   */
  async getConversationsState(): Promise<{
    count: number;
    conversations: unknown[];
  }> {
    const conversations = await this.client.query(api.conversations.list, {});

    return {
      count: conversations.length,
      conversations,
    };
  }
}

/**
 * Cleanup result summary for scoped cleanup operations
 */
export interface ScopedCleanupResult {
  conversations: number;
  memories: number;
  facts: number;
  contexts: number;
  memorySpaces: number;
  users: number;
  agents: number;
  immutable: number;
  mutable: number;
  total: number;
}

/**
 * Scoped cleanup helper for parallel test execution.
 *
 * Unlike TestCleanup which purges ALL data, ScopedCleanup only deletes
 * entities that match the test run's prefix. This enables safe parallel
 * test execution without interference between test runs.
 *
 * @example
 * ```typescript
 * describe("My Tests", () => {
 *   const ctx = createTestRunContext();
 *   let cleanup: ScopedCleanup;
 *
 *   beforeAll(() => {
 *     cleanup = new ScopedCleanup(client, ctx);
 *   });
 *
 *   afterAll(async () => {
 *     await cleanup.cleanupAll();
 *   });
 *
 *   it("creates data safely", async () => {
 *     const userId = ctx.userId("test");
 *     // ... test code
 *   });
 * });
 * ```
 */
export class ScopedCleanup {
  private runId: string;
  private verbose: boolean;

  /**
   * Create a scoped cleanup helper.
   *
   * @param client - Convex client for database operations
   * @param ctx - Test run context containing the run ID prefix
   * @param verbose - Whether to log cleanup operations (default: false)
   */
  constructor(
    protected client: ConvexClient,
    ctx: TestRunContext,
    verbose = false,
  ) {
    this.runId = ctx.runId;
    this.verbose = verbose;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  /**
   * Check if an ID belongs to this test run
   */
  private belongsToRun(id: string | undefined | null): boolean {
    return id !== undefined && id !== null && id.startsWith(this.runId);
  }

  /**
   * Cleanup conversations created by this test run
   */
  async cleanupConversations(): Promise<number> {
    this.log(`🧹 Cleaning up conversations for run ${this.runId}...`);

    try {
      const conversations = await this.client.query(api.conversations.list, {});
      let deleted = 0;

      for (const conv of conversations) {
        // Check if conversation belongs to this run (by memorySpaceId or conversationId)
        if (
          this.belongsToRun(conv.memorySpaceId) ||
          this.belongsToRun(conv.conversationId)
        ) {
          try {
            await this.client.mutation(api.conversations.deleteConversation, {
              conversationId: conv.conversationId,
            });
            deleted++;
          } catch {
            // Ignore already deleted
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} conversations`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup memory spaces created by this test run (and their contents)
   */
  async cleanupMemorySpaces(): Promise<number> {
    this.log(`🧹 Cleaning up memory spaces for run ${this.runId}...`);

    try {
      const spaces = await this.client.query(api.memorySpaces.list, {});
      let deleted = 0;

      for (const space of spaces) {
        if (this.belongsToRun(space.memorySpaceId)) {
          try {
            // Delete the memory space (this should cascade to memories, facts, etc.)
            await this.client.mutation(api.memorySpaces.deleteSpace, {
              memorySpaceId: space.memorySpaceId,
              cascade: true,
            });
            deleted++;
          } catch {
            // Ignore errors - space may have been deleted or have dependencies
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} memory spaces`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup memories in memory spaces belonging to this test run
   */
  async cleanupMemories(): Promise<number> {
    this.log(`🧹 Cleaning up memories for run ${this.runId}...`);

    try {
      // We need to find memories in our memory spaces
      const spaces = await this.client.query(api.memorySpaces.list, {});
      let deleted = 0;

      for (const space of spaces) {
        if (this.belongsToRun(space.memorySpaceId)) {
          try {
            // List memories in this space
            const memories = await this.client.query(api.memories.list, {
              memorySpaceId: space.memorySpaceId,
            });

            for (const mem of memories) {
              try {
                await this.client.mutation(api.memories.deleteMemory, {
                  memorySpaceId: space.memorySpaceId,
                  memoryId: mem.memoryId,
                });
                deleted++;
              } catch {
                // Ignore errors
              }
            }
          } catch {
            // Ignore errors listing memories
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} memories`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup facts in memory spaces belonging to this test run
   */
  async cleanupFacts(): Promise<number> {
    this.log(`🧹 Cleaning up facts for run ${this.runId}...`);

    try {
      const spaces = await this.client.query(api.memorySpaces.list, {});
      let deleted = 0;

      for (const space of spaces) {
        if (this.belongsToRun(space.memorySpaceId)) {
          try {
            const facts = await this.client.query(api.facts.list, {
              memorySpaceId: space.memorySpaceId,
            });

            for (const fact of facts) {
              try {
                await this.client.mutation(api.facts.deleteFact, {
                  memorySpaceId: space.memorySpaceId,
                  factId: fact.factId,
                });
                deleted++;
              } catch {
                // Ignore errors
              }
            }
          } catch {
            // Ignore errors listing facts
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} facts`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup contexts created by this test run
   */
  async cleanupContexts(): Promise<number> {
    this.log(`🧹 Cleaning up contexts for run ${this.runId}...`);

    try {
      const contexts = await this.client.query(api.contexts.list, {});
      let deleted = 0;

      for (const ctx of contexts) {
        // Check if context belongs to this run (by memorySpaceId or contextId)
        if (
          this.belongsToRun(ctx.memorySpaceId) ||
          this.belongsToRun(ctx.contextId)
        ) {
          try {
            await this.client.mutation(api.contexts.deleteContext, {
              contextId: ctx.contextId,
            });
            deleted++;
          } catch {
            // Ignore errors
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} contexts`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup users created by this test run
   */
  async cleanupUsers(): Promise<number> {
    this.log(`🧹 Cleaning up users for run ${this.runId}...`);

    try {
      const users = await this.client.query(api.immutable.list, {
        type: "user",
      });
      let deleted = 0;

      for (const user of users) {
        if (this.belongsToRun(user.id)) {
          try {
            await this.client.mutation(api.immutable.purge, {
              type: "user",
              id: user.id,
            });
            deleted++;
          } catch {
            // Ignore errors
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} users`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup agents created by this test run
   */
  async cleanupAgents(): Promise<number> {
    this.log(`🧹 Cleaning up agents for run ${this.runId}...`);

    try {
      const agents = await this.client.query(api.agents.list, {});
      let deleted = 0;

      for (const agent of agents) {
        if (this.belongsToRun(agent.agentId)) {
          try {
            await this.client.mutation(api.agents.unregister, {
              agentId: agent.agentId,
            });
            deleted++;
          } catch {
            // Ignore errors
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} agents`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup immutable records created by this test run
   * (excludes users which are handled separately)
   */
  async cleanupImmutable(): Promise<number> {
    this.log(`🧹 Cleaning up immutable records for run ${this.runId}...`);

    try {
      // Get all immutable records
      const records = await this.client.query(api.immutable.list, {});
      let deleted = 0;

      for (const record of records) {
        // Skip users (handled separately)
        if (record.type === "user") continue;

        // Check if type or id belongs to this run
        if (this.belongsToRun(record.type) || this.belongsToRun(record.id)) {
          try {
            await this.client.mutation(api.immutable.purge, {
              type: record.type,
              id: record.id,
            });
            deleted++;
          } catch {
            // Ignore errors
          }
        }
      }

      this.log(`✅ Cleaned up ${deleted} immutable records`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup mutable records created by this test run.
   * Note: mutable.list requires a namespace, so we use purgeNamespace
   * for namespaces that match our run prefix.
   */
  async cleanupMutable(): Promise<number> {
    this.log(`🧹 Cleaning up mutable records for run ${this.runId}...`);

    try {
      // Since mutable.list requires a namespace, we try to purge namespaces
      // that match our run prefix. We check a few potential namespaces.
      let deleted = 0;

      // Try to purge namespace that matches our runId pattern
      // The runId format is like "mutable-run-1234567890-abc123"
      try {
        const result = await this.client.mutation(api.mutable.purgeNamespace, {
          namespace: this.runId,
        });
        deleted += result.deleted;
      } catch {
        // Namespace may not exist
      }

      // Also try with common suffixes
      const suffixes = [
        "mutns",
        "user-sessions",
        "inventory",
        "config",
        "sessions",
      ];
      for (const suffix of suffixes) {
        const namespace = `${this.runId}-${suffix}`;
        try {
          const result = await this.client.mutation(
            api.mutable.purgeNamespace,
            {
              namespace,
            },
          );
          deleted += result.deleted;
        } catch {
          // Namespace may not exist
        }
      }

      this.log(`✅ Cleaned up ${deleted} mutable records`);
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup all entities created by this test run.
   * Order matters: delete dependent entities first.
   *
   * @returns Summary of deleted entities
   */
  async cleanupAll(): Promise<ScopedCleanupResult> {
    this.log(`\n🧹 Starting scoped cleanup for run ${this.runId}...\n`);

    // Delete in reverse dependency order
    const conversations = await this.cleanupConversations();
    const contexts = await this.cleanupContexts();
    const memories = await this.cleanupMemories();
    const facts = await this.cleanupFacts();
    const mutable = await this.cleanupMutable();
    const immutable = await this.cleanupImmutable();
    const users = await this.cleanupUsers();
    const agents = await this.cleanupAgents();
    const memorySpaces = await this.cleanupMemorySpaces();

    const total =
      conversations +
      contexts +
      memories +
      facts +
      mutable +
      immutable +
      users +
      agents +
      memorySpaces;

    this.log(`\n✅ Scoped cleanup complete. Total deleted: ${total}\n`);

    return {
      conversations,
      memories,
      facts,
      contexts,
      memorySpaces,
      users,
      agents,
      immutable,
      mutable,
      total,
    };
  }

  /**
   * Verify that no entities from this test run remain in the database.
   *
   * @returns true if cleanup was complete, false if orphaned entities found
   */
  async verifyCleanup(): Promise<boolean> {
    const remaining = await this.countRemaining();
    const total = Object.values(remaining).reduce((a, b) => a + b, 0);

    if (total > 0) {
      console.warn(
        `⚠️  Found ${total} orphaned entities for run ${this.runId}:`,
        remaining,
      );
      return false;
    }

    this.log(
      `✅ Cleanup verified - no orphaned entities for run ${this.runId}`,
    );
    return true;
  }

  /**
   * Count remaining entities that belong to this test run.
   */
  async countRemaining(): Promise<Record<string, number>> {
    const result: Record<string, number> = {
      conversations: 0,
      memorySpaces: 0,
      contexts: 0,
      users: 0,
      agents: 0,
      immutable: 0,
      mutable: 0,
    };

    try {
      // Count conversations
      const conversations = await this.client.query(api.conversations.list, {});
      result.conversations = conversations.filter(
        (c) =>
          this.belongsToRun(c.memorySpaceId) ||
          this.belongsToRun(c.conversationId),
      ).length;

      // Count memory spaces
      const spaces = await this.client.query(api.memorySpaces.list, {});
      result.memorySpaces = spaces.filter((s) =>
        this.belongsToRun(s.memorySpaceId),
      ).length;

      // Count contexts
      const contexts = await this.client.query(api.contexts.list, {});
      result.contexts = contexts.filter(
        (c) =>
          this.belongsToRun(c.memorySpaceId) || this.belongsToRun(c.contextId),
      ).length;

      // Count users
      const users = await this.client.query(api.immutable.list, {
        type: "user",
      });
      result.users = users.filter((u) => this.belongsToRun(u.id)).length;

      // Count agents
      const agents = await this.client.query(api.agents.list, {});
      result.agents = agents.filter((a) => this.belongsToRun(a.agentId)).length;

      // Count immutable (excluding users)
      const immutable = await this.client.query(api.immutable.list, {});
      result.immutable = immutable.filter(
        (r) =>
          r.type !== "user" &&
          (this.belongsToRun(r.type) || this.belongsToRun(r.id)),
      ).length;

      // Count mutable - requires namespace, so we skip this count
      // (mutable cleanup uses purgeNamespace which doesn't need listing)
      result.mutable = 0;
    } catch (error) {
      console.error("Error counting remaining entities:", error);
    }

    return result;
  }
}
