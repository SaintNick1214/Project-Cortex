/**
 * Cortex SDK - Conversations API
 * 
 * Layer 1a: ACID-compliant immutable conversation storage
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  Conversation,
  CreateConversationInput,
  AddMessageInput,
  ListConversationsFilter,
  CountConversationsFilter,
} from "../types";

export class ConversationsAPI {
  constructor(private client: ConvexClient) {}

  /**
   * Create a new conversation
   * 
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.create({
   *   type: 'user-agent',
   *   participants: {
   *     userId: 'user-123',
   *     agentId: 'agent-456',
   *   },
   * });
   * ```
   */
  async create(input: CreateConversationInput): Promise<Conversation> {
    // Auto-generate conversationId if not provided
    const conversationId = input.conversationId || this.generateConversationId();

    const result = await this.client.mutation(api.conversations.create, {
      conversationId,
      type: input.type,
      participants: input.participants,
      metadata: input.metadata,
    });

    return result as Conversation;
  }

  /**
   * Get a conversation by ID
   * 
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.get('conv-abc123');
   * ```
   */
  async get(conversationId: string): Promise<Conversation | null> {
    const result = await this.client.query(api.conversations.get, {
      conversationId,
    });

    return result as Conversation | null;
  }

  /**
   * Add a message to a conversation
   * 
   * @example
   * ```typescript
   * await cortex.conversations.addMessage({
   *   conversationId: 'conv-abc123',
   *   message: {
   *     role: 'user',
   *     content: 'Hello!',
   *   },
   * });
   * ```
   */
  async addMessage(input: AddMessageInput): Promise<Conversation> {
    // Auto-generate message ID if not provided
    const messageId = input.message.id || this.generateMessageId();

    const result = await this.client.mutation(api.conversations.addMessage, {
      conversationId: input.conversationId,
      message: {
        id: messageId,
        role: input.message.role,
        content: input.message.content,
        agentId: input.message.agentId,
        metadata: input.message.metadata,
      },
    });

    return result as Conversation;
  }

  /**
   * List conversations with optional filters
   * 
   * @example
   * ```typescript
   * const conversations = await cortex.conversations.list({
   *   userId: 'user-123',
   *   limit: 10,
   * });
   * ```
   */
  async list(filter?: ListConversationsFilter): Promise<Conversation[]> {
    const result = await this.client.query(api.conversations.list, {
      type: filter?.type,
      userId: filter?.userId,
      agentId: filter?.agentId,
      limit: filter?.limit,
    });

    return result as Conversation[];
  }

  /**
   * Count conversations
   * 
   * @example
   * ```typescript
   * const count = await cortex.conversations.count({
   *   agentId: 'agent-456',
   * });
   * ```
   */
  async count(filter?: CountConversationsFilter): Promise<number> {
    const result = await this.client.query(api.conversations.count, {
      type: filter?.type,
      userId: filter?.userId,
      agentId: filter?.agentId,
    });

    return result;
  }

  /**
   * Delete a conversation (for GDPR/cleanup)
   * 
   * @example
   * ```typescript
   * await cortex.conversations.delete('conv-abc123');
   * ```
   */
  async delete(conversationId: string): Promise<{ deleted: boolean }> {
    const result = await this.client.mutation(api.conversations.deleteConversation, {
      conversationId,
    });

    return result as { deleted: boolean };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helper Methods
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private generateConversationId(): string {
    return `conv-${this.generateId()}`;
  }

  private generateMessageId(): string {
    return `msg-${this.generateId()}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

