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
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_agent", (q) => q.eq("participants.agentId", args.agentId!))
        .order("desc")
        .take(args.limit || 100);
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

