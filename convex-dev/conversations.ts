/**
 * Cortex SDK - Conversations API (Layer 1a)
 *
 * ACID-compliant immutable conversation storage
 * memorySpace-scoped with participantId tracking (Hive Mode)
 * Two types: user-agent, agent-agent (Collaboration Mode)
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new conversation
 */
export const create = mutation({
  args: {
    conversationId: v.string(),
    memorySpaceId: v.string(), // NEW: Required - which memory space owns this
    participantId: v.optional(v.string()), // NEW: Hive Mode participant tracking
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.object({
      userId: v.optional(v.string()), // The human user in the conversation
      agentId: v.optional(v.string()), // The agent/assistant in the conversation
      participantId: v.optional(v.string()), // Hive Mode: who created this
      memorySpaceIds: v.optional(v.array(v.string())), // Collaboration Mode: cross-space
    }),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Validate participants based on type
    if (args.type === "user-agent") {
      if (!args.participants.userId) {
        throw new ConvexError("user-agent conversations require userId");
      }
      // v0.17.0: User-agent conversations require both userId AND agentId
      if (!args.participants.agentId) {
        throw new ConvexError(
          "agentId is required when userId is provided. User-agent conversations require both a user and an agent participant.",
        );
      }
    } else if (args.type === "agent-agent") {
      if (
        !args.participants.memorySpaceIds ||
        args.participants.memorySpaceIds.length < 2
      ) {
        throw new ConvexError(
          "agent-agent conversations require at least 2 memorySpaceIds",
        );
      }
    }

    // Check if conversation already exists - use UPSERT behavior to handle race conditions
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (existing) {
      // Race-safe: Return existing conversation instead of throwing
      // This handles parallel remember() calls gracefully
      return await ctx.db.get(existing._id);
    }

    const now = Date.now();

    // Create conversation
    const id = await ctx.db.insert("conversations", {
      conversationId: args.conversationId,
      memorySpaceId: args.memorySpaceId,
      participantId: args.participantId,
      type: args.type,
      participants: args.participants,
      messages: [],
      messageCount: 0,
      metadata: args.metadata || {},
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Add a message to an existing conversation (append-only)
 */
export const addMessage = mutation({
  args: {
    conversationId: v.string(),
    message: v.object({
      id: v.string(),
      role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
      content: v.string(),
      participantId: v.optional(v.string()), // Hive Mode: which participant sent this
      metadata: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    // Get conversation
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    // Create message with timestamp
    const message = {
      ...args.message,
      timestamp: Date.now(),
    };

    // Append message (immutable - never modify existing messages)
    await ctx.db.patch(conversation._id, {
      messages: [...conversation.messages, message],
      messageCount: conversation.messageCount + 1,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(conversation._id);
  },
});

/**
 * Delete a conversation (for GDPR/cleanup)
 */
export const deleteConversation = mutation({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    const messagesDeleted = conversation.messageCount;

    await ctx.db.delete(conversation._id);

    return {
      deleted: true,
      conversationId: args.conversationId,
      messagesDeleted,
      deletedAt: Date.now(),
      restorable: false, // Conversations are permanently deleted
    };
  },
});

/**
 * Delete many conversations matching filters
 */
export const deleteMany = mutation({
  args: {
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Filter by memory space
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    dryRun: v.optional(v.boolean()), // Preview what would be deleted
    confirmationThreshold: v.optional(v.number()), // Auto-confirm threshold (default: 10)
  },
  handler: async (ctx, args) => {
    let conversations;

    // Use index if memorySpaceId provided (fast)
    if (args.memorySpaceId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else {
      conversations = await ctx.db.query("conversations").collect();
    }

    // Apply additional filters
    if (args.userId) {
      conversations = conversations.filter(
        (c) => c.participants.userId === args.userId,
      );
    }

    if (args.type) {
      conversations = conversations.filter((c) => c.type === args.type);
    }

    // Calculate total messages that would be deleted
    const totalMessagesWouldDelete = conversations.reduce(
      (sum, c) => sum + c.messageCount,
      0,
    );

    // Dry run mode - just return what would be deleted
    if (args.dryRun) {
      return {
        deleted: 0,
        totalMessagesDeleted: 0,
        conversationIds: [],
        wouldDelete: conversations.length,
        wouldDeleteMessages: totalMessagesWouldDelete,
        dryRun: true,
      };
    }

    // Check confirmation threshold
    const threshold = args.confirmationThreshold ?? 10;
    if (conversations.length > threshold) {
      throw new ConvexError(
        `DELETE_MANY_THRESHOLD_EXCEEDED: Would delete ${conversations.length} conversations (threshold: ${threshold}). Use dryRun first or increase confirmationThreshold.`,
      );
    }

    let deleted = 0;
    let totalMessagesDeleted = 0;

    for (const conversation of conversations) {
      totalMessagesDeleted += conversation.messageCount;
      await ctx.db.delete(conversation._id);
      deleted++;
    }

    return {
      deleted,
      totalMessagesDeleted,
      conversationIds: conversations.map((c) => c.conversationId),
      dryRun: false,
    };
  },
});

/**
 * Delete multiple conversations by their IDs (batch delete for cascade operations)
 * Much faster than calling deleteConversation multiple times
 * Uses index lookups instead of full table scan to avoid memory issues with large tables
 */
export const deleteByIds = mutation({
  args: {
    conversationIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const deletedIds: string[] = [];
    let totalMessagesDeleted = 0;

    // Look up each conversation by index to avoid full table scan
    // This is O(n) index lookups vs O(entire table) memory usage
    for (const conversationId of args.conversationIds) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", conversationId),
        )
        .first();

      if (conversation) {
        totalMessagesDeleted += conversation.messageCount;
        await ctx.db.delete(conversation._id);
        deletedIds.push(conversationId);
      }
    }

    return {
      deleted: deletedIds.length,
      conversationIds: deletedIds,
      totalMessagesDeleted,
    };
  },
});

/**
 * Purge ALL conversations (development/testing only)
 */
export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db.query("conversations").collect();

    let deleted = 0;
    let totalMessagesDeleted = 0;

    for (const conversation of conversations) {
      totalMessagesDeleted += conversation.messageCount;
      await ctx.db.delete(conversation._id);
      deleted++;
    }

    return {
      deleted,
      totalMessagesDeleted,
    };
  },
});

/**
 * Get a specific message by ID from a conversation
 */
export const getMessage = query({
  args: {
    conversationId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      return null;
    }

    const message = conversation.messages.find((m) => m.id === args.messageId);

    return message || null;
  },
});

/**
 * Get multiple messages by their IDs
 */
export const getMessagesByIds = query({
  args: {
    conversationId: v.string(),
    messageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      return [];
    }

    const messages = conversation.messages.filter((m) =>
      args.messageIds.includes(m.id),
    );

    return messages;
  },
});

/**
 * Get or create a conversation (atomic)
 */
export const getOrCreate = mutation({
  args: {
    memorySpaceId: v.string(), // NEW: Required
    participantId: v.optional(v.string()), // NEW: Hive Mode
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.object({
      userId: v.optional(v.string()),
      agentId: v.optional(v.string()), // v0.17.0: Required for user-agent conversations
      participantId: v.optional(v.string()),
      memorySpaceIds: v.optional(v.array(v.string())),
    }),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Try to find existing
    let existing = null;

    if (args.type === "user-agent") {
      if (!args.participants.userId) {
        throw new ConvexError("user-agent conversations require userId");
      }
      // v0.17.0: User-agent conversations require both userId AND agentId
      if (!args.participants.agentId) {
        throw new ConvexError(
          "agentId is required when userId is provided. User-agent conversations require both a user and an agent participant.",
        );
      }

      // Look for existing in this memory space with this user AND agent
      // v0.17.0: Must match agentId to support multiple agents per user/space
      existing = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace_user", (q) =>
          q
            .eq("memorySpaceId", args.memorySpaceId!)
            .eq("participants.userId", args.participants.userId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), "user-agent"),
            q.eq(q.field("participants.agentId"), args.participants.agentId),
          ),
        )
        .first();
    } else {
      // agent-agent (Collaboration Mode)
      if (
        !args.participants.memorySpaceIds ||
        args.participants.memorySpaceIds.length < 2
      ) {
        throw new ConvexError(
          "agent-agent conversations require at least 2 memorySpaceIds",
        );
      }

      const conversations = await ctx.db
        .query("conversations")
        .filter((q) => q.eq(q.field("type"), "agent-agent"))
        .collect();

      const sortedInput = [...args.participants.memorySpaceIds].sort();

      existing =
        conversations.find((c) => {
          if (!c.participants.memorySpaceIds) {
            return false;
          }
          const sorted = [...c.participants.memorySpaceIds].sort();

          return (
            sorted.length === sortedInput.length &&
            sorted.every((id, i) => id === sortedInput[i])
          );
        }) || null;
    }

    if (existing) {
      return existing;
    }

    // Create new
    const now = Date.now();
    const conversationId = `conv-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await ctx.db.insert("conversations", {
      conversationId,
      memorySpaceId: args.memorySpaceId,
      participantId: args.participantId,
      type: args.type,
      participants: args.participants,
      messages: [],
      messageCount: 0,
      metadata: args.metadata || {},
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Find an existing conversation by participants
 */
export const findConversation = query({
  args: {
    memorySpaceId: v.string(), // NEW: Required
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    userId: v.optional(v.string()),
    memorySpaceIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.type === "user-agent") {
      if (!args.userId) {
        return null;
      }

      // Find user-agent conversation in this memory space
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace_user", (q) =>
          q
            .eq("memorySpaceId", args.memorySpaceId!)
            .eq("participants.userId", args.userId),
        )
        .filter((q) => q.eq(q.field("type"), "user-agent"))
        .first();

      return conversation || null;
    }
    // agent-agent conversation (Collaboration Mode)
    if (!args.memorySpaceIds || args.memorySpaceIds.length < 2) {
      return null;
    }

    // Find by matching memorySpaceIds array
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("type"), "agent-agent"))
      .collect();

    // Find conversation with exact same memory spaces (any order)
    const sortedInput = [...args.memorySpaceIds].sort();
    const found = conversations.find((c) => {
      if (!c.participants.memorySpaceIds) {
        return false;
      }
      const sorted = [...c.participants.memorySpaceIds].sort();

      return (
        sorted.length === sortedInput.length &&
        sorted.every((id, i) => id === sortedInput[i])
      );
    });

    return found || null;
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get a single conversation by ID
 */
export const get = query({
  args: {
    conversationId: v.string(),
    includeMessages: v.optional(v.boolean()), // Default: true
    messageLimit: v.optional(v.number()), // Limit messages returned
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      return null;
    }

    // Handle includeMessages option
    const includeMessages = args.includeMessages !== false; // Default: true

    if (!includeMessages) {
      // Return conversation without messages
      return {
        ...conversation,
        messages: [],
      };
    }

    // Handle messageLimit option
    if (args.messageLimit !== undefined && args.messageLimit > 0) {
      return {
        ...conversation,
        messages: conversation.messages.slice(-args.messageLimit),
      };
    }

    return conversation;
  },
});

/**
 * List conversations with filters and pagination metadata
 */
export const list = query({
  args: {
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Filter by memory space
    participantId: v.optional(v.string()), // Hive Mode tracking
    createdBefore: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    lastMessageBefore: v.optional(v.number()),
    lastMessageAfter: v.optional(v.number()),
    messageCountMin: v.optional(v.number()),
    messageCountMax: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("createdAt"),
        v.literal("updatedAt"),
        v.literal("lastMessageAt"),
        v.literal("messageCount"),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    includeMessages: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    // Apply filters using indexes
    let conversations;

    // Prioritize memorySpace + user (most common query pattern)
    if (args.memorySpaceId && args.userId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace_user", (q) =>
          q
            .eq("memorySpaceId", args.memorySpaceId!)
            .eq("participants.userId", args.userId),
        )
        .collect();
    } else if (args.memorySpaceId) {
      // Memory space only (Hive Mode: all conversations in space)
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else if (args.userId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("participants.userId", args.userId))
        .collect();
    } else if (args.type) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    } else {
      conversations = await ctx.db.query("conversations").collect();
    }

    // Post-filter by type if needed (when using other indexes)
    if (args.type && (args.memorySpaceId || args.userId)) {
      conversations = conversations.filter((c) => c.type === args.type);
    }

    // Apply additional filters
    if (args.participantId) {
      conversations = conversations.filter(
        (c) => c.participantId === args.participantId,
      );
    }
    if (args.createdBefore !== undefined) {
      conversations = conversations.filter(
        (c) => c.createdAt < args.createdBefore!,
      );
    }
    if (args.createdAfter !== undefined) {
      conversations = conversations.filter(
        (c) => c.createdAt > args.createdAfter!,
      );
    }
    if (args.updatedBefore !== undefined) {
      conversations = conversations.filter(
        (c) => c.updatedAt < args.updatedBefore!,
      );
    }
    if (args.updatedAfter !== undefined) {
      conversations = conversations.filter(
        (c) => c.updatedAt > args.updatedAfter!,
      );
    }
    if (args.lastMessageBefore !== undefined) {
      conversations = conversations.filter((c) => {
        const lastMsgTime =
          c.messages.length > 0
            ? c.messages[c.messages.length - 1].timestamp
            : c.createdAt;
        return lastMsgTime < args.lastMessageBefore!;
      });
    }
    if (args.lastMessageAfter !== undefined) {
      conversations = conversations.filter((c) => {
        const lastMsgTime =
          c.messages.length > 0
            ? c.messages[c.messages.length - 1].timestamp
            : c.createdAt;
        return lastMsgTime > args.lastMessageAfter!;
      });
    }
    if (args.messageCountMin !== undefined) {
      conversations = conversations.filter(
        (c) => c.messageCount >= args.messageCountMin!,
      );
    }
    if (args.messageCountMax !== undefined) {
      conversations = conversations.filter(
        (c) => c.messageCount <= args.messageCountMax!,
      );
    }

    // Get total before pagination
    const total = conversations.length;

    // Sort
    const sortBy = args.sortBy || "createdAt";
    const sortOrder = args.sortOrder || "desc";

    conversations.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case "updatedAt":
          aVal = a.updatedAt;
          bVal = b.updatedAt;
          break;
        case "lastMessageAt":
          aVal =
            a.messages.length > 0
              ? a.messages[a.messages.length - 1].timestamp
              : a.createdAt;
          bVal =
            b.messages.length > 0
              ? b.messages[b.messages.length - 1].timestamp
              : b.createdAt;
          break;
        case "messageCount":
          aVal = a.messageCount;
          bVal = b.messageCount;
          break;
        default: // createdAt
          aVal = a.createdAt;
          bVal = b.createdAt;
      }

      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    const paginatedConversations = conversations.slice(offset, offset + limit);

    // Optionally exclude messages
    const result =
      args.includeMessages === false
        ? paginatedConversations.map((c) => ({ ...c, messages: [] }))
        : paginatedConversations;

    return {
      conversations: result,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  },
});

/**
 * Count conversations
 */
export const count = query({
  args: {
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // NEW
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
  },
  handler: async (ctx, args) => {
    let conversations;

    // Use index if memorySpaceId provided
    if (args.memorySpaceId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else {
      conversations = await ctx.db.query("conversations").collect();
    }

    let filtered = conversations;

    if (args.userId) {
      filtered = filtered.filter((c) => c.participants.userId === args.userId);
    }

    if (args.type) {
      filtered = filtered.filter((c) => c.type === args.type);
    }

    return filtered.length;
  },
});

/**
 * Get paginated message history from a conversation
 */
export const getHistory = query({
  args: {
    conversationId: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    since: v.optional(v.number()), // Messages after timestamp
    until: v.optional(v.number()), // Messages before timestamp
    roles: v.optional(
      v.array(
        v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
      ),
    ), // Filter by role
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const sortOrder = args.sortOrder || "asc";

    // Get messages (already sorted in storage as append-only)
    let messages = [...conversation.messages];

    // Apply date filters
    if (args.since !== undefined) {
      messages = messages.filter((m) => m.timestamp >= args.since!);
    }
    if (args.until !== undefined) {
      messages = messages.filter((m) => m.timestamp <= args.until!);
    }

    // Apply role filter
    if (args.roles && args.roles.length > 0) {
      messages = messages.filter((m) => args.roles!.includes(m.role));
    }

    // Get total after filtering (for accurate pagination)
    const filteredTotal = messages.length;

    // Reverse if descending (newest first)
    if (sortOrder === "desc") {
      messages = messages.reverse();
    }

    // Paginate
    const paginatedMessages = messages.slice(offset, offset + limit);

    return {
      messages: paginatedMessages,
      total: filteredTotal,
      hasMore: offset + limit < filteredTotal,
      conversationId: conversation.conversationId,
    };
  },
});

/**
 * Search conversations by text query
 */
export const search = query({
  args: {
    query: v.string(),
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Filter by memory space
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    limit: v.optional(v.number()),
    searchIn: v.optional(
      v.union(v.literal("content"), v.literal("metadata"), v.literal("both")),
    ), // Default: "content"
    matchMode: v.optional(
      v.union(v.literal("contains"), v.literal("exact"), v.literal("fuzzy")),
    ), // Default: "contains"
  },
  handler: async (ctx, args) => {
    // Get conversations (use index if memorySpace provided)
    let allConversations;

    if (args.memorySpaceId) {
      allConversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else {
      allConversations = await ctx.db.query("conversations").collect();
    }

    const searchQuery = args.query.toLowerCase();
    const searchIn = args.searchIn || "content";
    const matchMode = args.matchMode || "contains";

    // Helper for matching based on mode
    const matchText = (text: string, query: string): boolean => {
      const lowerText = text.toLowerCase();
      switch (matchMode) {
        case "exact":
          return lowerText === query;
        case "fuzzy":
          // Simple fuzzy: all words in query must appear in text
          const words = query.split(/\s+/).filter((w) => w.length > 0);
          return words.every((word) => lowerText.includes(word));
        default: // contains
          return lowerText.includes(query);
      }
    };

    const results: Array<{
      conversation: unknown;
      matchedMessages: unknown[];
      highlights: string[];
      score: number;
    }> = [];

    for (const conversation of allConversations) {
      // Apply filters
      if (args.type && conversation.type !== args.type) {
        continue;
      }
      if (args.userId && conversation.participants.userId !== args.userId) {
        continue;
      }
      if (args.dateStart && conversation.createdAt < args.dateStart) {
        continue;
      }
      if (args.dateEnd && conversation.createdAt > args.dateEnd) {
        continue;
      }

      let matchedMessages: any[] = [];
      let metadataMatch = false;

      // Search in message content
      if (searchIn === "content" || searchIn === "both") {
        matchedMessages = conversation.messages.filter((msg: any) =>
          matchText(msg.content, searchQuery),
        );
      }

      // Search in metadata
      if (searchIn === "metadata" || searchIn === "both") {
        const metadataStr = JSON.stringify(conversation.metadata || {});
        metadataMatch = matchText(metadataStr, searchQuery);
      }

      if (matchedMessages.length > 0 || metadataMatch) {
        // Calculate score based on matches
        let score = 0;
        if (matchedMessages.length > 0 && conversation.messageCount > 0) {
          score = matchedMessages.length / conversation.messageCount;
        }
        if (metadataMatch) {
          score += 0.5; // Bonus for metadata match
        }

        // Extract highlights from matched messages
        const highlights = matchedMessages.slice(0, 3).map((msg: any) => {
          const { content } = msg;
          const index = content.toLowerCase().indexOf(searchQuery);
          if (index === -1) {
            // For fuzzy matches, return beginning of content
            return (
              content.substring(0, 60) + (content.length > 60 ? "..." : "")
            );
          }
          const start = Math.max(0, index - 30);
          const end = Math.min(content.length, index + searchQuery.length + 30);
          return content.substring(start, end);
        });

        results.push({
          conversation,
          matchedMessages,
          highlights,
          score,
        });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = results.slice(0, args.limit || 10);

    return limited;
  },
});

/**
 * Export conversations to JSON or CSV
 */
export const exportConversations = query({
  args: {
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // NEW: Filter by memory space
    conversationIds: v.optional(v.array(v.string())),
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeMetadata: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let conversations;

    // Use index if memorySpaceId provided
    if (args.memorySpaceId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else {
      conversations = await ctx.db.query("conversations").collect();
    }

    // Apply filters
    if (args.conversationIds && args.conversationIds.length > 0) {
      conversations = conversations.filter((c) =>
        args.conversationIds!.includes(c.conversationId),
      );
    }

    if (args.userId) {
      conversations = conversations.filter(
        (c) => c.participants.userId === args.userId,
      );
    }

    if (args.type) {
      conversations = conversations.filter((c) => c.type === args.type);
    }

    if (args.dateStart) {
      conversations = conversations.filter(
        (c) => c.createdAt >= args.dateStart!,
      );
    }

    if (args.dateEnd) {
      conversations = conversations.filter((c) => c.createdAt <= args.dateEnd!);
    }

    // Format data
    if (args.format === "json") {
      const data = conversations.map((c) => {
        const exported: unknown = {
          conversationId: c.conversationId,
          type: c.type,
          participants: c.participants,
          messages: c.messages,
          messageCount: c.messageCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };

        if (args.includeMetadata && c.metadata) {
          (exported as any).metadata = c.metadata;
        }

        return exported;
      });

      return {
        format: "json",
        data: JSON.stringify(data, null, 2),
        count: conversations.length,
        exportedAt: Date.now(),
      };
    }
    // CSV format
    const headers = [
      "conversationId",
      "type",
      "participants",
      "messageCount",
      "createdAt",
      "updatedAt",
    ];

    if (args.includeMetadata) {
      headers.push("metadata");
    }

    const rows = conversations.map((c) => {
      const row = [
        c.conversationId,
        c.type,
        JSON.stringify(c.participants),
        c.messageCount.toString(),
        new Date(c.createdAt).toISOString(),
        new Date(c.updatedAt).toISOString(),
      ];

      if (args.includeMetadata) {
        row.push(JSON.stringify(c.metadata || {}));
      }

      return row.join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    return {
      format: "csv",
      data: csv,
      count: conversations.length,
      exportedAt: Date.now(),
    };
  },
});
