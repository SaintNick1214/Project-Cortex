/**
 * Storage Inspector
 *
 * Utilities for inspecting Convex storage state during tests
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";

export class StorageInspector {
  constructor(private readonly client: ConvexClient) {}

  /**
   * Print a detailed view of a conversation
   */
  async inspectConversation(conversationId: string): Promise<void> {
    const conversation = await this.client.query(api.conversations.get, {
      conversationId,
    });

    if (!conversation) {
      console.log(`❌ Conversation ${conversationId} not found`);

      return;
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 CONVERSATION INSPECTION: ${conversationId}`);
    console.log("=".repeat(80));
    console.log(`Type:          ${conversation.type}`);
    console.log(
      `Created:       ${new Date(conversation.createdAt).toISOString()}`,
    );
    console.log(
      `Updated:       ${new Date(conversation.updatedAt).toISOString()}`,
    );
    console.log(`Message Count: ${conversation.messageCount}`);
    console.log(`\nParticipants:`);
    console.log(JSON.stringify(conversation.participants, null, 2));

    if (conversation.metadata) {
      console.log(`\nMetadata:`);
      console.log(JSON.stringify(conversation.metadata, null, 2));
    }

    console.log(`\nMessages (${conversation.messages.length}):`);
    conversation.messages.forEach((msg, idx) => {
      console.log(
        `  [${idx + 1}] ${msg.role} (${new Date(msg.timestamp).toISOString()})`,
      );
      console.log(`      ID: ${msg.id}`);
      console.log(
        `      Content: ${msg.content.substring(0, 60)}${msg.content.length > 60 ? "..." : ""}`,
      );
      if (msg.agentId) {
        console.log(`      Agent: ${msg.agentId}`);
      }
      if (msg.metadata) {
        console.log(`      Metadata: ${JSON.stringify(msg.metadata)}`);
      }
    });
    console.log(`${"=".repeat(80)}\n`);
  }

  /**
   * Print all conversations in the table
   */
  async inspectAllConversations(): Promise<void> {
    const conversations = await this.client.query(api.conversations.list, {});

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📊 ALL CONVERSATIONS (${conversations.length})`);
    console.log("=".repeat(80));

    if (conversations.length === 0) {
      console.log("(empty)");
    } else {
      conversations.forEach((conv, idx) => {
        console.log(`\n[${idx + 1}] ${conv.conversationId}`);
        console.log(`    Type: ${conv.type}`);
        console.log(`    Messages: ${conv.messageCount}`);
        console.log(`    Participants: ${JSON.stringify(conv.participants)}`);
        console.log(`    Created: ${new Date(conv.createdAt).toISOString()}`);
      });
    }
    console.log(`\n${"=".repeat(80)}\n`);
  }

  /**
   * Compare SDK result with storage
   */
  async compareWithStorage(
    conversationId: string,
    sdkResult: any,
  ): Promise<{
    matches: boolean;
    differences: string[];
  }> {
    const stored = await this.client.query(api.conversations.get, {
      conversationId,
    });

    const differences: string[] = [];

    if (!stored) {
      differences.push("Conversation not found in storage");

      return { matches: false, differences };
    }

    // Compare key fields
    if (sdkResult.conversationId !== stored.conversationId) {
      differences.push(
        `conversationId: SDK=${sdkResult.conversationId}, Storage=${stored.conversationId}`,
      );
    }

    if (sdkResult.type !== stored.type) {
      differences.push(`type: SDK=${sdkResult.type}, Storage=${stored.type}`);
    }

    if (sdkResult.messageCount !== stored.messageCount) {
      differences.push(
        `messageCount: SDK=${sdkResult.messageCount}, Storage=${stored.messageCount}`,
      );
    }

    if (sdkResult.messages.length !== stored.messages.length) {
      differences.push(
        `messages.length: SDK=${sdkResult.messages.length}, Storage=${stored.messages.length}`,
      );
    }

    const matches = differences.length === 0;

    if (matches) {
      console.log(`✅ SDK result matches storage for ${conversationId}`);
    } else {
      console.log(`❌ Differences found for ${conversationId}:`);
      differences.forEach((diff) => console.log(`   - ${diff}`));
    }

    return { matches, differences };
  }

  /**
   * Print storage statistics
   */
  async printStats(): Promise<void> {
    const total = await this.client.query(api.conversations.count, {});
    const userAgent = await this.client.query(api.conversations.count, {
      type: "user-agent",
    });
    const agentAgent = await this.client.query(api.conversations.count, {
      type: "agent-agent",
    });

    console.log(`\n${"=".repeat(80)}`);
    console.log("📊 STORAGE STATISTICS");
    console.log("=".repeat(80));
    console.log(`Total Conversations:      ${total}`);
    console.log(`User-Agent Conversations: ${userAgent}`);
    console.log(`Agent-Agent Conversations: ${agentAgent}`);
    console.log(`${"=".repeat(80)}\n`);
  }
}
