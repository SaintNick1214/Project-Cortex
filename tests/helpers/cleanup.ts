/**
 * Test Cleanup Helpers
 *
 * Utilities for purging tables and ensuring clean test state
 */

import { ConvexClient } from "convex/browser";
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
      } catch (error: any) {
        // Ignore "CONVERSATION_NOT_FOUND" errors (already deleted)
        if (!error.message?.includes("CONVERSATION_NOT_FOUND")) {
          throw error;
        }
      }
    }

    console.log(`✅ Purged ${deleted} conversations`);
    return { deleted };
  }

  /**
   * Purge all memories for test agents from the database
   * This uses the deleteMany mutation for efficient cleanup
   */
  async purgeMemories(): Promise<{ deleted: number }> {
    console.log("🧹 Purging memories for all test agents...");

    // Common test agent IDs used across all test files
    const testAgentIds = [
      "agent-test-l3",      // memory.test.ts
      "test-agent-1",       // various tests
      "test-agent-2",       // various tests  
      "test-agent-3",       // potential future tests
      "another-test-agent", // conversations tests
      "agent-vector-test",  // potential vector tests
      "agent-test",         // vector.test.ts
      "agent-test-2",       // vector.test.ts
      "agent-store",        // vector.test.ts
      "agent-search",       // vector.test.ts
    ];

    let totalDeleted = 0;
    for (const agentId of testAgentIds) {
      try {
        const result = await this.client.mutation(api.memories.deleteMany, {
          agentId,
        });
        if (result.deleted > 0) {
          console.log(`  - Deleted ${result.deleted} memories for ${agentId}`);
          totalDeleted += result.deleted;
        }
      } catch (error: any) {
        // Ignore errors (agent might not have memories)
        continue;
      }
    }

    console.log(`✅ Purged ${totalDeleted} total memories`);
    return { deleted: totalDeleted };
  }

  /**
   * Purge all test data (conversations + memories)
   */
  async purgeAll(): Promise<{ conversations: number; memories: number }> {
    const convResult = await this.purgeConversations();
    const memResult = await this.purgeMemories();
    
    return {
      conversations: convResult.deleted,
      memories: memResult.deleted,
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
    conversations: any[];
  }> {
    const conversations = await this.client.query(api.conversations.list, {});
    return {
      count: conversations.length,
      conversations,
    };
  }
}
