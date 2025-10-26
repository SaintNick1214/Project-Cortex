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
  GetHistoryOptions,
  SearchConversationsInput,
  ConversationSearchResult,
  ExportConversationsOptions,
  ExportResult,
  Message,
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
    const conversationId =
      input.conversationId || this.generateConversationId();

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
    const result = await this.client.mutation(
      api.conversations.deleteConversation,
      {
        conversationId,
      },
    );

    return result as { deleted: boolean };
  }

  /**
   * Delete many conversations matching filters
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.deleteMany({
   *   userId: 'user-123',
   *   type: 'user-agent',
   * });
   * ```
   */
  async deleteMany(filter: {
    userId?: string;
    agentId?: string;
    type?: "user-agent" | "agent-agent";
  }): Promise<{
    deleted: number;
    totalMessagesDeleted: number;
    conversationIds: string[];
  }> {
    const result = await this.client.mutation(api.conversations.deleteMany, {
      userId: filter.userId,
      agentId: filter.agentId,
      type: filter.type,
    });

    return result as {
      deleted: number;
      totalMessagesDeleted: number;
      conversationIds: string[];
    };
  }

  /**
   * Get a specific message by ID
   *
   * @example
   * ```typescript
   * const message = await cortex.conversations.getMessage('conv-123', 'msg-456');
   * ```
   */
  async getMessage(
    conversationId: string,
    messageId: string,
  ): Promise<Message | null> {
    const result = await this.client.query(api.conversations.getMessage, {
      conversationId,
      messageId,
    });

    return result as Message | null;
  }

  /**
   * Get multiple messages by their IDs
   *
   * @example
   * ```typescript
   * const messages = await cortex.conversations.getMessagesByIds('conv-123', ['msg-1', 'msg-2']);
   * ```
   */
  async getMessagesByIds(
    conversationId: string,
    messageIds: string[],
  ): Promise<Message[]> {
    const result = await this.client.query(api.conversations.getMessagesByIds, {
      conversationId,
      messageIds,
    });

    return result as Message[];
  }

  /**
   * Find an existing conversation by participants
   *
   * @example
   * ```typescript
   * const existing = await cortex.conversations.findConversation({
   *   type: 'user-agent',
   *   userId: 'user-123',
   *   agentId: 'agent-456',
   * });
   * ```
   */
  async findConversation(params: {
    type: "user-agent" | "agent-agent";
    userId?: string;
    agentId?: string;
    agentIds?: string[];
  }): Promise<Conversation | null> {
    const result = await this.client.query(api.conversations.findConversation, {
      type: params.type,
      userId: params.userId,
      agentId: params.agentId,
      agentIds: params.agentIds,
    });

    return result as Conversation | null;
  }

  /**
   * Get or create a conversation (atomic)
   *
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.getOrCreate({
   *   type: 'user-agent',
   *   participants: { userId: 'user-123', agentId: 'agent-456' },
   * });
   * ```
   */
  async getOrCreate(input: CreateConversationInput): Promise<Conversation> {
    const result = await this.client.mutation(api.conversations.getOrCreate, {
      type: input.type,
      participants: input.participants,
      metadata: input.metadata,
    });

    return result as Conversation;
  }

  /**
   * Get paginated message history from a conversation
   *
   * @example
   * ```typescript
   * const history = await cortex.conversations.getHistory('conv-abc123', {
   *   limit: 20,
   *   offset: 0,
   *   sortOrder: 'desc',
   * });
   * ```
   */
  async getHistory(
    conversationId: string,
    options?: GetHistoryOptions,
  ): Promise<{
    messages: Message[];
    total: number;
    hasMore: boolean;
    conversationId: string;
  }> {
    const result = await this.client.query(api.conversations.getHistory, {
      conversationId,
      limit: options?.limit,
      offset: options?.offset,
      sortOrder: options?.sortOrder,
    });

    return result as {
      messages: Message[];
      total: number;
      hasMore: boolean;
      conversationId: string;
    };
  }

  /**
   * Search conversations by text query
   *
   * @example
   * ```typescript
   * const results = await cortex.conversations.search({
   *   query: 'password',
   *   filters: {
   *     userId: 'user-123',
   *     limit: 5,
   *   },
   * });
   * ```
   */
  async search(
    input: SearchConversationsInput,
  ): Promise<ConversationSearchResult[]> {
    const result = await this.client.query(api.conversations.search, {
      query: input.query,
      type: input.filters?.type,
      userId: input.filters?.userId,
      agentId: input.filters?.agentId,
      dateStart: input.filters?.dateRange?.start,
      dateEnd: input.filters?.dateRange?.end,
      limit: input.filters?.limit,
    });

    return result as ConversationSearchResult[];
  }

  /**
   * Export conversations to JSON or CSV
   *
   * @example
   * ```typescript
   * const exported = await cortex.conversations.export({
   *   filters: { userId: 'user-123' },
   *   format: 'json',
   *   includeMetadata: true,
   * });
   * ```
   */
  async export(options: ExportConversationsOptions): Promise<ExportResult> {
    const result = await this.client.query(
      api.conversations.exportConversations,
      {
        userId: options.filters?.userId,
        agentId: options.filters?.agentId,
        conversationIds: options.filters?.conversationIds,
        type: options.filters?.type,
        dateStart: options.filters?.dateRange?.start,
        dateEnd: options.filters?.dateRange?.end,
        format: options.format,
        includeMetadata: options.includeMetadata,
      },
    );

    return result as ExportResult;
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
