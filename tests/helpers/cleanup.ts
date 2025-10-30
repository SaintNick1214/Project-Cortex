/**
 * Test Cleanup Helpers
 *
 * Utilities for purging tables and ensuring clean test state
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";

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
