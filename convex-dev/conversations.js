"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportConversations = exports.search = exports.getHistory = exports.count = exports.list = exports.get = exports.deleteConversation = exports.addMessage = exports.create = void 0;
const values_1 = require("convex/values");
const server_1 = require("./_generated/server");
exports.create = (0, server_1.mutation)({
    args: {
        conversationId: values_1.v.string(),
        type: values_1.v.union(values_1.v.literal("user-agent"), values_1.v.literal("agent-agent")),
        participants: values_1.v.object({
            userId: values_1.v.optional(values_1.v.string()),
            agentId: values_1.v.optional(values_1.v.string()),
            agentIds: values_1.v.optional(values_1.v.array(values_1.v.string())),
        }),
        metadata: values_1.v.optional(values_1.v.any()),
    },
    handler: async (ctx, args) => {
        if (args.type === "user-agent") {
            if (!args.participants.userId || !args.participants.agentId) {
                throw new Error("user-agent conversations require userId and agentId");
            }
        }
        else if (args.type === "agent-agent") {
            if (!args.participants.agentIds || args.participants.agentIds.length < 2) {
                throw new Error("agent-agent conversations require at least 2 agentIds");
            }
        }
        const existing = await ctx.db
            .query("conversations")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .first();
        if (existing) {
            throw new Error("CONVERSATION_ALREADY_EXISTS");
        }
        const now = Date.now();
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
exports.addMessage = (0, server_1.mutation)({
    args: {
        conversationId: values_1.v.string(),
        message: values_1.v.object({
            id: values_1.v.string(),
            role: values_1.v.union(values_1.v.literal("user"), values_1.v.literal("agent"), values_1.v.literal("system")),
            content: values_1.v.string(),
            agentId: values_1.v.optional(values_1.v.string()),
            metadata: values_1.v.optional(values_1.v.any()),
        }),
    },
    handler: async (ctx, args) => {
        const conversation = await ctx.db
            .query("conversations")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
            .first();
        if (!conversation) {
            throw new Error("CONVERSATION_NOT_FOUND");
        }
        const message = {
            ...args.message,
            timestamp: Date.now(),
        };
        await ctx.db.patch(conversation._id, {
            messages: [...conversation.messages, message],
            messageCount: conversation.messageCount + 1,
            updatedAt: Date.now(),
        });
        return await ctx.db.get(conversation._id);
    },
});
exports.deleteConversation = (0, server_1.mutation)({
    args: {
        conversationId: values_1.v.string(),
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
exports.get = (0, server_1.query)({
    args: {
        conversationId: values_1.v.string(),
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
exports.list = (0, server_1.query)({
    args: {
        type: values_1.v.optional(values_1.v.union(values_1.v.literal("user-agent"), values_1.v.literal("agent-agent"))),
        userId: values_1.v.optional(values_1.v.string()),
        agentId: values_1.v.optional(values_1.v.string()),
        limit: values_1.v.optional(values_1.v.number()),
    },
    handler: async (ctx, args) => {
        let conversations;
        if (args.userId && args.agentId) {
            conversations = await ctx.db
                .query("conversations")
                .withIndex("by_agent_user", (q) => q.eq("participants.agentId", args.agentId).eq("participants.userId", args.userId))
                .order("desc")
                .take(args.limit || 100);
        }
        else if (args.userId) {
            conversations = await ctx.db
                .query("conversations")
                .withIndex("by_user", (q) => q.eq("participants.userId", args.userId))
                .order("desc")
                .take(args.limit || 100);
        }
        else if (args.agentId) {
            const userAgentConvs = await ctx.db
                .query("conversations")
                .withIndex("by_agent", (q) => q.eq("participants.agentId", args.agentId))
                .order("desc")
                .take(args.limit || 100);
            const allConvs = await ctx.db
                .query("conversations")
                .filter((q) => q.eq(q.field("type"), "agent-agent"))
                .collect();
            const agentAgentConvs = allConvs.filter((c) => c.participants.agentIds?.includes(args.agentId));
            const combined = [...userAgentConvs, ...agentAgentConvs];
            const uniqueMap = new Map(combined.map((c) => [c._id, c]));
            conversations = Array.from(uniqueMap.values())
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, args.limit || 100);
        }
        else if (args.type) {
            conversations = await ctx.db
                .query("conversations")
                .withIndex("by_type", (q) => q.eq("type", args.type))
                .order("desc")
                .take(args.limit || 100);
        }
        else {
            conversations = await ctx.db
                .query("conversations")
                .order("desc")
                .take(args.limit || 100);
        }
        if (args.type) {
            return conversations.filter((c) => c.type === args.type);
        }
        return conversations;
    },
});
exports.count = (0, server_1.query)({
    args: {
        userId: values_1.v.optional(values_1.v.string()),
        agentId: values_1.v.optional(values_1.v.string()),
        type: values_1.v.optional(values_1.v.union(values_1.v.literal("user-agent"), values_1.v.literal("agent-agent"))),
    },
    handler: async (ctx, args) => {
        const conversations = await ctx.db.query("conversations").collect();
        let filtered = conversations;
        if (args.userId) {
            filtered = filtered.filter((c) => c.participants.userId === args.userId);
        }
        if (args.agentId) {
            filtered = filtered.filter((c) => c.participants.agentId === args.agentId ||
                c.participants.agentIds?.includes(args.agentId));
        }
        if (args.type) {
            filtered = filtered.filter((c) => c.type === args.type);
        }
        return filtered.length;
    },
});
exports.getHistory = (0, server_1.query)({
    args: {
        conversationId: values_1.v.string(),
        limit: values_1.v.optional(values_1.v.number()),
        offset: values_1.v.optional(values_1.v.number()),
        sortOrder: values_1.v.optional(values_1.v.union(values_1.v.literal("asc"), values_1.v.literal("desc"))),
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
        let messages = conversation.messages;
        if (sortOrder === "desc") {
            messages = [...messages].reverse();
        }
        const paginatedMessages = messages.slice(offset, offset + limit);
        return {
            messages: paginatedMessages,
            total: conversation.messageCount,
            hasMore: offset + limit < conversation.messageCount,
            conversationId: conversation.conversationId,
        };
    },
});
exports.search = (0, server_1.query)({
    args: {
        query: values_1.v.string(),
        type: values_1.v.optional(values_1.v.union(values_1.v.literal("user-agent"), values_1.v.literal("agent-agent"))),
        userId: values_1.v.optional(values_1.v.string()),
        agentId: values_1.v.optional(values_1.v.string()),
        dateStart: values_1.v.optional(values_1.v.number()),
        dateEnd: values_1.v.optional(values_1.v.number()),
        limit: values_1.v.optional(values_1.v.number()),
    },
    handler: async (ctx, args) => {
        const allConversations = await ctx.db.query("conversations").collect();
        const searchQuery = args.query.toLowerCase();
        const results = [];
        for (const conversation of allConversations) {
            if (args.type && conversation.type !== args.type)
                continue;
            if (args.userId && conversation.participants.userId !== args.userId)
                continue;
            if (args.agentId) {
                const hasAgent = conversation.participants.agentId === args.agentId ||
                    conversation.participants.agentIds?.includes(args.agentId);
                if (!hasAgent)
                    continue;
            }
            if (args.dateStart && conversation.createdAt < args.dateStart)
                continue;
            if (args.dateEnd && conversation.createdAt > args.dateEnd)
                continue;
            const matchedMessages = conversation.messages.filter((msg) => msg.content.toLowerCase().includes(searchQuery));
            if (matchedMessages.length > 0) {
                const score = matchedMessages.length / conversation.messageCount;
                const highlights = matchedMessages
                    .slice(0, 3)
                    .map((msg) => {
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
        results.sort((a, b) => b.score - a.score);
        const limited = results.slice(0, args.limit || 10);
        return limited;
    },
});
exports.exportConversations = (0, server_1.query)({
    args: {
        userId: values_1.v.optional(values_1.v.string()),
        agentId: values_1.v.optional(values_1.v.string()),
        conversationIds: values_1.v.optional(values_1.v.array(values_1.v.string())),
        type: values_1.v.optional(values_1.v.union(values_1.v.literal("user-agent"), values_1.v.literal("agent-agent"))),
        dateStart: values_1.v.optional(values_1.v.number()),
        dateEnd: values_1.v.optional(values_1.v.number()),
        format: values_1.v.union(values_1.v.literal("json"), values_1.v.literal("csv")),
        includeMetadata: values_1.v.optional(values_1.v.boolean()),
    },
    handler: async (ctx, args) => {
        let conversations = await ctx.db.query("conversations").collect();
        if (args.conversationIds && args.conversationIds.length > 0) {
            conversations = conversations.filter((c) => args.conversationIds.includes(c.conversationId));
        }
        if (args.userId) {
            conversations = conversations.filter((c) => c.participants.userId === args.userId);
        }
        if (args.agentId) {
            conversations = conversations.filter((c) => c.participants.agentId === args.agentId ||
                c.participants.agentIds?.includes(args.agentId));
        }
        if (args.type) {
            conversations = conversations.filter((c) => c.type === args.type);
        }
        if (args.dateStart) {
            conversations = conversations.filter((c) => c.createdAt >= args.dateStart);
        }
        if (args.dateEnd) {
            conversations = conversations.filter((c) => c.createdAt <= args.dateEnd);
        }
        if (args.format === "json") {
            const data = conversations.map((c) => {
                const exported = {
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
        }
        else {
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
//# sourceMappingURL=conversations.js.map