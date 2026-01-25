/**
 * Cortex SDK - Conversations API
 *
 * Layer 1a: ACID-compliant immutable conversation storage
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  AddMessageInput,
  AddMessageOptions,
  ApproveMessageInput,
  CheckAccessInput,
  CheckAccessResult,
  CheckShareAccessResult,
  Conversation,
  ConversationDeletionResult,
  ConversationSearchResult,
  ConversationShare,
  ConversationSnapshot,
  CountConversationsFilter,
  CreateConversationInput,
  CreateConversationOptions,
  CreateShareInput,
  CreateShareResult,
  CreateSnapshotInput,
  CreateSnapshotResult,
  DeleteConversationOptions,
  DeleteManyConversationsOptions,
  DeleteManyConversationsResult,
  ExportConversationsOptions,
  ExportResult,
  GetConversationOptions,
  GetHistoryOptions,
  ListConversationsFilter,
  ListConversationsResult,
  Message,
  RevokeShareResult,
  SearchConversationsInput,
  SetVisibilityInput,
  ShareStatus,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import {
  syncConversationToGraph,
  syncConversationRelationships,
  deleteConversationFromGraph,
} from "../graph";
import {
  ConversationValidationError,
  validateRequiredString,
  validateConversationType,
  validateMessageRole,
  validateIdFormat,
  validateExportFormat,
  validateSortOrder,
  validateSearchQuery,
  validateLimit,
  validateOffset,
  validateNonEmptyArray,
  validateDateRange,
  validateParticipants,
  validateNoDuplicates,
  validateVisibility,
  validateGrantType,
  validateShareStatus,
  validateGrantedTo,
} from "./validators";
import type { ResilienceLayer } from "../resilience";
import type { AuthContext } from "../auth/types";

export class ConversationsAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
    private readonly resilience?: ResilienceLayer,
    private readonly authContext?: AuthContext,
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
   * Handle ConvexError from direct Convex calls (queries that don't go through resilience)
   * Extracts error.data and includes it in the thrown error message
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
   * Create a new conversation
   *
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.create({
   *   memorySpaceId: 'user-123-personal',
   *   type: 'user-agent',
   *   participants: {
   *     userId: 'user-123',
   *     participantId: 'my-bot',
   *   },
   * });
   * ```
   */
  async create(
    input: CreateConversationInput,
    _options?: CreateConversationOptions,
  ): Promise<Conversation> {
    // Validate required fields
    validateRequiredString(input.memorySpaceId, "memorySpaceId");
    validateConversationType(input.type);

    // Validate optional conversationId format
    validateIdFormat(input.conversationId, "conversation", "conversationId");

    // Validate participants based on type
    validateParticipants(input.type, input.participants);

    // For agent-agent, validate no duplicate memorySpaceIds
    if (input.type === "agent-agent" && input.participants.memorySpaceIds) {
      validateNoDuplicates(
        input.participants.memorySpaceIds,
        "participants.memorySpaceIds",
      );
    }

    // Validate visibility if provided
    validateVisibility(input.visibility);

    // Auto-generate conversationId if not provided
    const conversationId =
      input.conversationId || this.generateConversationId();

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversations.create, {
          conversationId,
          memorySpaceId: input.memorySpaceId,
          participantId: input.participantId,
          tenantId: this.authContext?.tenantId, // Inject tenantId from auth context
          type: input.type,
          participants: input.participants,
          metadata: input.metadata,
          visibility: input.visibility, // Pass visibility (defaults to 'private' if undefined)
          collaborativeSettings: input.collaborativeSettings, // Phase 4: Collaborative
        }),
      "conversations:create",
    );

    // Sync to graph if requested
    if (this.graphAdapter) {
      try {
        const nodeId = await syncConversationToGraph(
          result as Conversation,
          this.graphAdapter,
        );
        await syncConversationRelationships(
          result as Conversation,
          nodeId,
          this.graphAdapter,
        );
      } catch (error) {
        console.warn("Failed to sync conversation to graph:", error);
      }
    }

    return result as Conversation;
  }

  /**
   * Get a conversation by ID
   *
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.get('conv-abc123');
   *
   * // With options
   * const convNoMessages = await cortex.conversations.get('conv-abc123', {
   *   includeMessages: false,
   * });
   *
   * // Limit messages returned
   * const convLimited = await cortex.conversations.get('conv-abc123', {
   *   messageLimit: 10,
   * });
   * ```
   */
  async get(
    conversationId: string,
    options?: GetConversationOptions,
  ): Promise<Conversation | null> {
    validateRequiredString(conversationId, "conversationId");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.get, {
          conversationId,
          tenantId: this.authContext?.tenantId, // Inject tenantId for isolation
          includeMessages: options?.includeMessages,
          messageLimit: options?.messageLimit,
        }),
      "conversations:get",
    );

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
  async addMessage(
    input: AddMessageInput,
    _options?: AddMessageOptions,
  ): Promise<Conversation> {
    validateRequiredString(input.conversationId, "conversationId");
    validateRequiredString(input.message.content, "message.content");
    validateMessageRole(input.message.role);

    // Validate optional message ID format
    validateIdFormat(input.message.id, "message", "message.id");

    // Auto-generate message ID if not provided
    const messageId = input.message.id || this.generateMessageId();

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.conversations.addMessage, {
            conversationId: input.conversationId,
            message: {
              id: messageId,
              role: input.message.role,
              content: input.message.content,
              participantId: input.message.participantId, // Updated for Hive Mode
              metadata: input.message.metadata,
            },
          }),
        "conversations:addMessage",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Update in graph if requested (conversation already synced, just update properties)
    if (this.graphAdapter) {
      try {
        const nodes = await this.graphAdapter.findNodes(
          "Conversation",
          { conversationId: input.conversationId },
          1,
        );
        if (nodes.length > 0) {
          await this.graphAdapter.updateNode(nodes[0].id!, {
            messageCount: (result as Conversation).messageCount,
            updatedAt: (result as Conversation).updatedAt,
          });
        }
      } catch (error) {
        console.warn("Failed to update conversation in graph:", error);
      }
    }

    return result as Conversation;
  }

  /**
   * List conversations with optional filters and pagination
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.list({
   *   userId: 'user-123',
   *   limit: 10,
   * });
   * console.log(`Found ${result.total} conversations`);
   *
   * // With pagination and sorting
   * const page2 = await cortex.conversations.list({
   *   memorySpaceId: 'space-123',
   *   offset: 10,
   *   limit: 10,
   *   sortBy: 'lastMessageAt',
   *   sortOrder: 'desc',
   * });
   *
   * // Filter by date range
   * const recent = await cortex.conversations.list({
   *   createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last week
   * });
   * ```
   */
  async list(
    filter?: ListConversationsFilter,
  ): Promise<ListConversationsResult> {
    // All fields optional, validate only if provided
    if (filter?.type) {
      validateConversationType(filter.type);
    }
    if (filter?.limit !== undefined) {
      validateLimit(filter.limit);
    }
    if (filter?.offset !== undefined) {
      validateOffset(filter.offset);
    }
    if (filter?.sortOrder) {
      validateSortOrder(filter.sortOrder);
    }

    // Handle messageCount filter
    let messageCountMin: number | undefined;
    let messageCountMax: number | undefined;
    if (filter?.messageCount !== undefined) {
      if (typeof filter.messageCount === "number") {
        messageCountMin = filter.messageCount;
        messageCountMax = filter.messageCount;
      } else {
        messageCountMin = filter.messageCount.min;
        messageCountMax = filter.messageCount.max;
      }
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.list, {
          type: filter?.type,
          userId: filter?.userId,
          memorySpaceId: filter?.memorySpaceId,
          tenantId: filter?.tenantId ?? this.authContext?.tenantId, // Support explicit or auth context
          participantId: filter?.participantId,
          createdBefore: filter?.createdBefore,
          createdAfter: filter?.createdAfter,
          updatedBefore: filter?.updatedBefore,
          updatedAfter: filter?.updatedAfter,
          lastMessageBefore: filter?.lastMessageBefore,
          lastMessageAfter: filter?.lastMessageAfter,
          messageCountMin,
          messageCountMax,
          limit: filter?.limit,
          offset: filter?.offset,
          sortBy: filter?.sortBy,
          sortOrder: filter?.sortOrder,
          includeMessages: filter?.includeMessages,
        }),
      "conversations:list",
    );

    return result as ListConversationsResult;
  }

  /**
   * Count conversations
   *
   * @example
   * ```typescript
   * const count = await cortex.conversations.count({
   *   memorySpaceId: 'user-123-personal',
   * });
   * ```
   */
  async count(filter?: CountConversationsFilter): Promise<number> {
    // Similar to list - validate type if provided
    if (filter?.type) {
      validateConversationType(filter.type);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.count, {
          type: filter?.type,
          userId: filter?.userId,
          memorySpaceId: filter?.memorySpaceId, // Updated
        }),
      "conversations:count",
    );

    return result;
  }

  /**
   * Delete a conversation (for GDPR/cleanup)
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.delete('conv-abc123');
   * console.log(`Deleted ${result.messagesDeleted} messages`);
   * console.log(`Restorable: ${result.restorable}`); // false - permanent!
   * ```
   */
  async delete(
    conversationId: string,
    _options?: DeleteConversationOptions,
  ): Promise<ConversationDeletionResult> {
    validateRequiredString(conversationId, "conversationId");

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.conversations.deleteConversation, {
            conversationId,
          }),
        "conversations:delete",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Delete from graph
    if (this.graphAdapter) {
      try {
        await deleteConversationFromGraph(
          conversationId,
          this.graphAdapter,
          true,
        );
      } catch (error) {
        console.warn("Failed to delete conversation from graph:", error);
      }
    }

    return result as ConversationDeletionResult;
  }

  /**
   * Delete many conversations matching filters
   *
   * @example
   * ```typescript
   * // Preview what would be deleted (dryRun)
   * const preview = await cortex.conversations.deleteMany(
   *   { userId: 'user-123' },
   *   { dryRun: true }
   * );
   * console.log(`Would delete ${preview.wouldDelete} conversations`);
   *
   * // Execute deletion
   * const result = await cortex.conversations.deleteMany({
   *   memorySpaceId: 'user-123-personal',
   *   userId: 'user-123',
   *   type: 'user-agent',
   * });
   * console.log(`Deleted ${result.deleted} conversations`);
   * ```
   */
  async deleteMany(
    filter: {
      userId?: string;
      memorySpaceId?: string;
      type?: "user-agent" | "agent-agent";
    },
    options?: DeleteManyConversationsOptions,
  ): Promise<DeleteManyConversationsResult> {
    // Validate type if provided
    if (filter.type) {
      validateConversationType(filter.type);
    }

    // Ensure at least one filter is provided
    if (!filter.userId && !filter.memorySpaceId && !filter.type) {
      throw new ConversationValidationError(
        "deleteMany requires at least one filter (userId, memorySpaceId, or type)",
        "MISSING_REQUIRED_FIELD",
      );
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversations.deleteMany, {
          userId: filter.userId,
          memorySpaceId: filter.memorySpaceId,
          type: filter.type,
          dryRun: options?.dryRun,
          confirmationThreshold: options?.confirmationThreshold,
        }),
      "conversations:deleteMany",
    );

    return result as DeleteManyConversationsResult;
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
    validateRequiredString(conversationId, "conversationId");
    validateRequiredString(messageId, "messageId");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.getMessage, {
          conversationId,
          messageId,
        }),
      "conversations:getMessage",
    );

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
    validateRequiredString(conversationId, "conversationId");
    validateNonEmptyArray(messageIds, "messageIds");

    // Validate no duplicates
    validateNoDuplicates(messageIds, "messageIds");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.getMessagesByIds, {
          conversationId,
          messageIds,
        }),
      "conversations:getMessagesByIds",
    );

    return result as Message[];
  }

  /**
   * Find an existing conversation by participants
   *
   * @example
   * ```typescript
   * const existing = await cortex.conversations.findConversation({
   *   memorySpaceId: 'user-123-personal',
   *   type: 'user-agent',
   *   userId: 'user-123',
   * });
   * ```
   */
  async findConversation(params: {
    memorySpaceId: string; // NEW: Required
    type: "user-agent" | "agent-agent";
    userId?: string;
    memorySpaceIds?: string[]; // For agent-agent (Collaboration Mode)
  }): Promise<Conversation | null> {
    validateRequiredString(params.memorySpaceId, "memorySpaceId");
    validateConversationType(params.type);

    // Validate based on type
    if (params.type === "user-agent" && !params.userId) {
      throw new ConversationValidationError(
        "userId is required for user-agent conversation search",
        "MISSING_REQUIRED_FIELD",
        "userId",
      );
    }

    if (params.type === "agent-agent") {
      if (!params.memorySpaceIds || params.memorySpaceIds.length < 2) {
        throw new ConversationValidationError(
          "agent-agent conversations require at least 2 memorySpaceIds",
          "INVALID_ARRAY_LENGTH",
          "memorySpaceIds",
        );
      }
      validateNoDuplicates(params.memorySpaceIds, "memorySpaceIds");
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.findConversation, {
          memorySpaceId: params.memorySpaceId,
          type: params.type,
          userId: params.userId,
          memorySpaceIds: params.memorySpaceIds,
        }),
      "conversations:findConversation",
    );

    return result as Conversation | null;
  }

  /**
   * Get or create a conversation (atomic)
   *
   * @example
   * ```typescript
   * const conversation = await cortex.conversations.getOrCreate({
   *   memorySpaceId: 'user-123-personal',
   *   type: 'user-agent',
   *   participants: { userId: 'user-123', participantId: 'my-bot' },
   * });
   * ```
   */
  async getOrCreate(input: CreateConversationInput): Promise<Conversation> {
    // Same validation as create()
    validateRequiredString(input.memorySpaceId, "memorySpaceId");
    validateConversationType(input.type);
    validateParticipants(input.type, input.participants);

    if (input.type === "agent-agent" && input.participants.memorySpaceIds) {
      validateNoDuplicates(
        input.participants.memorySpaceIds,
        "participants.memorySpaceIds",
      );
    }

    // Validate visibility if provided
    validateVisibility(input.visibility);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversations.getOrCreate, {
          memorySpaceId: input.memorySpaceId,
          participantId: input.participantId,
          type: input.type,
          participants: input.participants,
          metadata: input.metadata,
          visibility: input.visibility, // Pass visibility (defaults to 'private' if undefined)
        }),
      "conversations:getOrCreate",
    );

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
   *
   * // Filter by date range
   * const recent = await cortex.conversations.getHistory('conv-abc123', {
   *   since: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
   * });
   *
   * // Filter by roles
   * const userMessages = await cortex.conversations.getHistory('conv-abc123', {
   *   roles: ['user'],
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
    validateRequiredString(conversationId, "conversationId");

    if (options?.limit !== undefined) {
      validateLimit(options.limit);
    }
    if (options?.offset !== undefined) {
      validateOffset(options.offset);
    }
    if (options?.sortOrder) {
      validateSortOrder(options.sortOrder);
    }

    // Validate date range if provided
    if (options?.since !== undefined && options?.until !== undefined) {
      validateDateRange(options.since, options.until);
    }

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.query(api.conversations.getHistory, {
            conversationId,
            limit: options?.limit,
            offset: options?.offset,
            sortOrder: options?.sortOrder,
            since: options?.since,
            until: options?.until,
            roles: options?.roles,
          }),
        "conversations:getHistory",
      );

      return result as {
        messages: Message[];
        total: number;
        hasMore: boolean;
        conversationId: string;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
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
   *
   * // Search with options
   * const fuzzyResults = await cortex.conversations.search({
   *   query: 'account balance',
   *   options: {
   *     searchIn: 'both', // Search content and metadata
   *     matchMode: 'fuzzy',
   *   },
   * });
   * ```
   */
  async search(
    input: SearchConversationsInput,
  ): Promise<ConversationSearchResult[]> {
    validateSearchQuery(input.query);

    if (input.filters?.type) {
      validateConversationType(input.filters.type);
    }
    if (input.filters?.limit !== undefined) {
      validateLimit(input.filters.limit);
    }

    // Validate date range
    validateDateRange(
      input.filters?.dateRange?.start,
      input.filters?.dateRange?.end,
    );

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.search, {
          query: input.query,
          type: input.filters?.type,
          userId: input.filters?.userId,
          memorySpaceId: input.filters?.memorySpaceId,
          dateStart: input.filters?.dateRange?.start,
          dateEnd: input.filters?.dateRange?.end,
          limit: input.filters?.limit,
          searchIn: input.options?.searchIn,
          matchMode: input.options?.matchMode,
        }),
      "conversations:search",
    );

    return result as ConversationSearchResult[];
  }

  /**
   * Export conversations to JSON or CSV
   *
   * @example
   * ```typescript
   * const exported = await cortex.conversations.export({
   *   filters: { memorySpaceId: 'user-123-personal', userId: 'user-123' },
   *   format: 'json',
   *   includeMetadata: true,
   * });
   * ```
   */
  async export(options: ExportConversationsOptions): Promise<ExportResult> {
    validateExportFormat(options.format);

    if (options.filters?.type) {
      validateConversationType(options.filters.type);
    }
    if (options.filters?.conversationIds) {
      validateNonEmptyArray(
        options.filters.conversationIds,
        "filters.conversationIds",
      );
    }

    // Validate date range
    validateDateRange(
      options.filters?.dateRange?.start,
      options.filters?.dateRange?.end,
    );

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.exportConversations, {
          userId: options.filters?.userId,
          memorySpaceId: options.filters?.memorySpaceId, // Updated
          conversationIds: options.filters?.conversationIds,
          type: options.filters?.type,
          dateStart: options.filters?.dateRange?.start,
          dateEnd: options.filters?.dateRange?.end,
          format: options.format,
          includeMetadata: options.includeMetadata,
        }),
      "conversations:export",
    );

    return result as ExportResult;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Visibility & Access Control (Shareable Chats Phase 1)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Check if a user has access to a conversation based on visibility
   *
   * This is a quick, cheap method to check access rights without fetching
   * the full conversation data. Use this for access control checks.
   *
   * @example
   * ```typescript
   * const access = await cortex.conversations.checkAccess({
   *   conversationId: 'conv-abc123',
   *   userId: 'user-456',
   * });
   *
   * if (access.canView) {
   *   // User can access the conversation
   * }
   * ```
   */
  async checkAccess(input: CheckAccessInput): Promise<CheckAccessResult> {
    validateRequiredString(input.conversationId, "conversationId");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversations.checkAccess, {
          conversationId: input.conversationId,
          userId: input.userId,
          memorySpaceId: input.memorySpaceId,
        }),
      "conversations:checkAccess",
    );

    return result as CheckAccessResult;
  }

  /**
   * Set the visibility of a conversation
   *
   * Only the owner (participants.userId) can change visibility.
   *
   * @example
   * ```typescript
   * // Make a conversation public
   * const updated = await cortex.conversations.setVisibility({
   *   conversationId: 'conv-abc123',
   *   visibility: 'public',
   * });
   *
   * // Make it space-visible
   * await cortex.conversations.setVisibility({
   *   conversationId: 'conv-abc123',
   *   visibility: 'space',
   * });
   * ```
   */
  async setVisibility(input: SetVisibilityInput): Promise<Conversation> {
    validateRequiredString(input.conversationId, "conversationId");
    validateVisibility(input.visibility);

    // Ensure visibility is one of the valid values
    if (!["private", "space", "public"].includes(input.visibility)) {
      throw new ConversationValidationError(
        `Invalid visibility "${input.visibility}". Must be "private", "space", or "public"`,
        "INVALID_VISIBILITY",
        "visibility",
      );
    }

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.conversations.setVisibility, {
            conversationId: input.conversationId,
            visibility: input.visibility,
            userId: this.authContext?.userId, // Pass userId from auth context for ownership verification
          }),
        "conversations:setVisibility",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    return result as Conversation;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Sharing Grants (Shareable Chats Phase 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Create a share for a conversation
   *
   * Creates a shareable link or grant for accessing a conversation.
   * Returns the share ID which can be used with `buildShareUrl()` to create URLs.
   *
   * @example
   * ```typescript
   * import { buildShareUrl } from '@cortex/sdk';
   *
   * // Create a public link share
   * const result = await cortex.conversations.share({
   *   conversationId: 'conv-abc123',
   *   grantType: 'link',
   *   permissions: { canView: true, canFork: true },
   *   expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
   * });
   *
   * // Build the URL
   * const url = buildShareUrl(result.shareId, {
   *   baseUrl: 'https://myapp.com/shared'
   * });
   * ```
   */
  async share(input: CreateShareInput): Promise<CreateShareResult> {
    validateRequiredString(input.conversationId, "conversationId");
    validateGrantType(input.grantType);
    validateGrantedTo(input.grantType, input.grantedTo);

    // Default permissions
    const permissions = {
      canView: input.permissions?.canView ?? true,
      canViewFacts: input.permissions?.canViewFacts ?? false,
      canViewMemories: input.permissions?.canViewMemories ?? false,
      canContinue: input.permissions?.canContinue ?? false,
      canFork: input.permissions?.canFork ?? false,
      canExport: input.permissions?.canExport ?? false,
    };

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversationShares.create, {
          conversationId: input.conversationId,
          grantedBy: this.authContext?.userId || "anonymous",
          sourceMemorySpaceId: input.conversationId.split("-")[1] || "default", // Extract from conversation or default
          grantType: input.grantType,
          grantedTo: input.grantedTo,
          permissions,
          expiresAt: input.expiresAt,
          maxViews: input.maxViews,
          redactBefore: input.redactBefore,
          redactSensitive: input.redactSensitive,
          tenantId: this.authContext?.tenantId,
        }),
      "conversationShares:create",
    );

    const share = result as ConversationShare;

    return {
      shareId: share.shareId,
      expiresAt: share.expiresAt,
      share,
    };
  }

  /**
   * Revoke an existing share
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.revokeShare('share-abc123');
   * console.log(`Revoked at: ${result.revokedAt}`);
   * ```
   */
  async revokeShare(shareId: string): Promise<RevokeShareResult> {
    validateRequiredString(shareId, "shareId");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversationShares.revoke, {
          shareId,
          userId: this.authContext?.userId,
        }),
      "conversationShares:revoke",
    );

    const share = result as ConversationShare;

    return {
      revoked: true,
      revokedAt: share.revokedAt || Date.now(),
      share,
    };
  }

  /**
   * List shares for a conversation
   *
   * @example
   * ```typescript
   * // List all active shares
   * const shares = await cortex.conversations.listShares('conv-abc123', {
   *   status: 'active',
   * });
   * ```
   */
  async listShares(
    conversationId: string,
    filter?: { status?: ShareStatus },
  ): Promise<ConversationShare[]> {
    validateRequiredString(conversationId, "conversationId");

    if (filter?.status) {
      validateShareStatus(filter.status);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversationShares.listByConversation, {
          conversationId,
          status: filter?.status,
        }),
      "conversationShares:listByConversation",
    );

    return result as ConversationShare[];
  }

  /**
   * Get a share by its ID
   *
   * Also validates whether the share is still active and within limits.
   *
   * @example
   * ```typescript
   * const share = await cortex.conversations.getShare('share-abc123');
   * if (share?.isValid) {
   *   // Share is valid and can be used
   * }
   * ```
   */
  async getShare(shareId: string): Promise<ConversationShare | null> {
    validateRequiredString(shareId, "shareId");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversationShares.get, {
          shareId,
        }),
      "conversationShares:get",
    );

    return result as ConversationShare | null;
  }

  /**
   * Check if a user/space has access to a conversation via share
   *
   * @example
   * ```typescript
   * const access = await cortex.conversations.checkShareAccess({
   *   conversationId: 'conv-abc123',
   *   userId: 'user-456',
   * });
   *
   * if (access.hasAccess) {
   *   console.log('Permissions:', access.permissions);
   * }
   * ```
   */
  async checkShareAccess(input: {
    conversationId: string;
    userId?: string;
    memorySpaceId?: string;
    emailDomain?: string;
  }): Promise<CheckShareAccessResult> {
    validateRequiredString(input.conversationId, "conversationId");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversationShares.checkAccess, {
          conversationId: input.conversationId,
          userId: input.userId,
          memorySpaceId: input.memorySpaceId,
          emailDomain: input.emailDomain,
        }),
      "conversationShares:checkAccess",
    );

    return result as CheckShareAccessResult;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Snapshots (Shareable Chats Phase 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Create a snapshot of a conversation
   *
   * Creates an immutable point-in-time copy of a conversation with optional
   * PII redaction. Useful for sharing or archiving conversations.
   *
   * @example
   * ```typescript
   * const result = await cortex.conversations.snapshot({
   *   conversationId: 'conv-abc123',
   *   redactPII: true,
   * });
   * console.log(result.snapshotId);
   * ```
   */
  async snapshot(input: CreateSnapshotInput): Promise<CreateSnapshotResult> {
    validateRequiredString(input.conversationId, "conversationId");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversationSnapshots.create, {
          conversationId: input.conversationId,
          createdBy: this.authContext?.userId || "anonymous",
          redactPII: input.redactPII,
          redactBefore: input.redactBefore,
          customRedactions: input.customRedactions,
          includeFacts: input.includeFacts,
          includeMemories: input.includeMemories,
          tenantId: this.authContext?.tenantId,
        }),
      "conversationSnapshots:create",
    );

    const snapshot = result as ConversationSnapshot;

    return {
      snapshotId: snapshot.snapshotId,
      snapshot,
    };
  }

  /**
   * Get a snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<ConversationSnapshot | null> {
    validateRequiredString(snapshotId, "snapshotId");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversationSnapshots.get, {
          snapshotId,
        }),
      "conversationSnapshots:get",
    );

    return result as ConversationSnapshot | null;
  }

  /**
   * List snapshots for a conversation
   */
  async listSnapshots(
    conversationId: string,
    options?: { includeArchived?: boolean },
  ): Promise<ConversationSnapshot[]> {
    validateRequiredString(conversationId, "conversationId");

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.conversationSnapshots.listByConversation, {
          conversationId,
          includeArchived: options?.includeArchived,
        }),
      "conversationSnapshots:listByConversation",
    );

    return result as ConversationSnapshot[];
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<{ deleted: boolean }> {
    validateRequiredString(snapshotId, "snapshotId");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversationSnapshots.deleteSnapshot, {
          snapshotId,
          userId: this.authContext?.userId,
        }),
      "conversationSnapshots:deleteSnapshot",
    );

    return result as { deleted: boolean };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Collaborative Conversations (Shareable Chats Phase 4)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Approve a pending message in a collaborative conversation
   *
   * Only the conversation owner can approve messages.
   *
   * @example
   * ```typescript
   * await cortex.conversations.approveMessage({
   *   conversationId: 'conv-abc123',
   *   messageId: 'msg-456',
   * });
   * ```
   */
  async approveMessage(input: ApproveMessageInput): Promise<Conversation> {
    validateRequiredString(input.conversationId, "conversationId");
    validateRequiredString(input.messageId, "messageId");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversations.approveMessage, {
          conversationId: input.conversationId,
          messageId: input.messageId,
          approverId: this.authContext?.userId || "",
        }),
      "conversations:approveMessage",
    );

    return result as Conversation;
  }

  /**
   * Reject a pending message in a collaborative conversation
   *
   * Only the conversation owner can reject messages.
   *
   * @example
   * ```typescript
   * await cortex.conversations.rejectMessage({
   *   conversationId: 'conv-abc123',
   *   messageId: 'msg-456',
   * });
   * ```
   */
  async rejectMessage(input: ApproveMessageInput): Promise<Conversation> {
    validateRequiredString(input.conversationId, "conversationId");
    validateRequiredString(input.messageId, "messageId");

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.conversations.rejectMessage, {
          conversationId: input.conversationId,
          messageId: input.messageId,
          rejecterId: this.authContext?.userId || "",
        }),
      "conversations:rejectMessage",
    );

    return result as Conversation;
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

// Export validation error for users who want to catch it specifically
export { ConversationValidationError } from "./validators";
