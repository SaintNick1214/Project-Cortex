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
