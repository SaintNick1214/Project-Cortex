"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("convex/server");
const values_1 = require("convex/values");
exports.default = (0, server_1.defineSchema)({
    conversations: (0, server_1.defineTable)({
        conversationId: values_1.v.string(),
        type: values_1.v.union(values_1.v.literal("user-agent"), values_1.v.literal("agent-agent")),
        participants: values_1.v.object({
            userId: values_1.v.optional(values_1.v.string()),
            agentId: values_1.v.optional(values_1.v.string()),
            agentIds: values_1.v.optional(values_1.v.array(values_1.v.string())),
        }),
        messages: values_1.v.array(values_1.v.object({
            id: values_1.v.string(),
            role: values_1.v.union(values_1.v.literal("user"), values_1.v.literal("agent"), values_1.v.literal("system")),
            content: values_1.v.string(),
            timestamp: values_1.v.number(),
            agentId: values_1.v.optional(values_1.v.string()),
            metadata: values_1.v.optional(values_1.v.any()),
        })),
        messageCount: values_1.v.number(),
        metadata: values_1.v.optional(values_1.v.any()),
        createdAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_conversationId", ["conversationId"])
        .index("by_type", ["type"])
        .index("by_user", ["participants.userId"])
        .index("by_agent", ["participants.agentId"])
        .index("by_agent_user", ["participants.agentId", "participants.userId"])
        .index("by_created", ["createdAt"]),
});
//# sourceMappingURL=schema.js.map