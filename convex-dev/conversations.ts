/**
 * Cortex SDK - Conversations API (Layer 1a)
 * 
 * ACID-compliant immutable conversation storage
 * Two types: user-agent, agent-agent
 */

import { v } from "convex/values";
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
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.object({
      userId: v.optional(v.string()),
      agentId: v.optional(v.string()),
      agentIds: v.optional(v.array(v.string())),
    }),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Validate participants based on type
    if (args.type === "user-agent") {
      if (!args.participants.userId || !args.participants.agentId) {
        throw new Error("user-agent conversations require userId and agentId");
      }
    } else if (args.type === "agent-agent") {
      if (!args.participants.agentIds || args.participants.agentIds.length < 2) {
        throw new Error("agent-agent conversations require at least 2 agentIds");
      }
    }

    // Check if conversation already exists
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (existing) {
      throw new Error("CONVERSATION_ALREADY_EXISTS");
    }

    const now = Date.now();

    // Create conversation
    const id = await ctx.db.insert("conversations", {
      conversationId: args.conversationId,
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
      agentId: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    // Get conversation
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (!conversation) {
      throw new Error("CONVERSATION_NOT_FOUND");
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
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (!conversation) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    await ctx.db.delete(conversation._id);

    return { deleted: true };
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
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (!conversation) {
      return null;
    }

    return conversation;
  },
});

/**
 * List conversations with filters
 */
export const list = query({
  args: {
    type: v.optional(v.union(v.literal("user-agent"), v.literal("agent-agent"))),
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Apply filters using indexes
    let conversations;

    if (args.userId && args.agentId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_agent_user", (q) =>
          q.eq("participants.agentId", args.agentId!).eq("participants.userId", args.userId!)
        )
        .order("desc")
        .take(args.limit || 100);
    } else if (args.userId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("participants.userId", args.userId!))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.agentId) {
      // Get user-agent conversations (index lookup - fast)
      const userAgentConvs = await ctx.db
        .query("conversations")
        .withIndex("by_agent", (q) => q.eq("participants.agentId", args.agentId!))
        .order("desc")
        .take(args.limit || 100);

      // Get agent-agent conversations (scan - slower but necessary)
      const allConvs = await ctx.db
        .query("conversations")
        .filter((q) => q.eq(q.field("type"), "agent-agent"))
        .collect();
      
      const agentAgentConvs = allConvs.filter((c) =>
        c.participants.agentIds?.includes(args.agentId!)
      );

      // Combine and deduplicate (by _id), then sort and limit
      const combined = [...userAgentConvs, ...agentAgentConvs];
      const uniqueMap = new Map(combined.map((c) => [c._id, c]));
      conversations = Array.from(uniqueMap.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, args.limit || 100);
    } else if (args.type) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(args.limit || 100);
    } else {
      conversations = await ctx.db
        .query("conversations")
        .order("desc")
        .take(args.limit || 100);
    }

    // Post-filter by type if needed (when using participant indexes)
    if (args.type) {
      return conversations.filter((c) => c.type === args.type);
    }

    return conversations;
  },
});

/**
 * Count conversations
 */
export const count = query({
  args: {
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    type: v.optional(v.union(v.literal("user-agent"), v.literal("agent-agent"))),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db.query("conversations").collect();

    let filtered = conversations;

    if (args.userId) {
      filtered = filtered.filter((c) => c.participants.userId === args.userId);
    }

    if (args.agentId) {
      filtered = filtered.filter(
        (c) =>
          c.participants.agentId === args.agentId ||
          c.participants.agentIds?.includes(args.agentId!)
      );
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
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (!conversation) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const sortOrder = args.sortOrder || "asc";

    // Get messages (already sorted in storage as append-only)
    let messages = conversation.messages;

    // Reverse if descending (newest first)
    if (sortOrder === "desc") {
      messages = [...messages].reverse();
    }

    // Paginate
    const paginatedMessages = messages.slice(offset, offset + limit);

    return {
      messages: paginatedMessages,
      total: conversation.messageCount,
      hasMore: offset + limit < conversation.messageCount,
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
    type: v.optional(v.union(v.literal("user-agent"), v.literal("agent-agent"))),
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all conversations (we'll add search index later for better performance)
    const allConversations = await ctx.db.query("conversations").collect();

    const searchQuery = args.query.toLowerCase();
    const results: Array<{
      conversation: any;
      matchedMessages: any[];
      highlights: string[];
      score: number;
    }> = [];

    for (const conversation of allConversations) {
      // Apply filters
      if (args.type && conversation.type !== args.type) continue;
      if (args.userId && conversation.participants.userId !== args.userId) continue;
      if (args.agentId) {
        const hasAgent =
          conversation.participants.agentId === args.agentId ||
          conversation.participants.agentIds?.includes(args.agentId);
        if (!hasAgent) continue;
      }
      if (args.dateStart && conversation.createdAt < args.dateStart) continue;
      if (args.dateEnd && conversation.createdAt > args.dateEnd) continue;

      // Search in messages
      const matchedMessages = conversation.messages.filter((msg: any) =>
        msg.content.toLowerCase().includes(searchQuery)
      );

      if (matchedMessages.length > 0) {
        // Calculate score based on matches
        const score = matchedMessages.length / conversation.messageCount;

        // Extract highlights
        const highlights = matchedMessages
          .slice(0, 3)
          .map((msg: any) => {
            const content = msg.content;
            const index = content.toLowerCase().indexOf(searchQuery);
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
    agentId: v.optional(v.string()),
    conversationIds: v.optional(v.array(v.string())),
    type: v.optional(v.union(v.literal("user-agent"), v.literal("agent-agent"))),
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeMetadata: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let conversations = await ctx.db.query("conversations").collect();

    // Apply filters
    if (args.conversationIds && args.conversationIds.length > 0) {
      conversations = conversations.filter((c) =>
        args.conversationIds!.includes(c.conversationId)
      );
    }

    if (args.userId) {
      conversations = conversations.filter((c) => c.participants.userId === args.userId);
    }

    if (args.agentId) {
      conversations = conversations.filter(
        (c) =>
          c.participants.agentId === args.agentId ||
          c.participants.agentIds?.includes(args.agentId!)
      );
    }

    if (args.type) {
      conversations = conversations.filter((c) => c.type === args.type);
    }

    if (args.dateStart) {
      conversations = conversations.filter((c) => c.createdAt >= args.dateStart!);
    }

    if (args.dateEnd) {
      conversations = conversations.filter((c) => c.createdAt <= args.dateEnd!);
    }

    // Format data
    if (args.format === "json") {
      const data = conversations.map((c) => {
        const exported: any = {
          conversationId: c.conversationId,
          type: c.type,
          participants: c.participants,
          messages: c.messages,
          messageCount: c.messageCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };

        if (args.includeMetadata && c.metadata) {
          exported.metadata = c.metadata;
        }

        return exported;
      });

      return {
        format: "json",
        data: JSON.stringify(data, null, 2),
        count: conversations.length,
        exportedAt: Date.now(),
      };
    } else {
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
    }
  },
});

