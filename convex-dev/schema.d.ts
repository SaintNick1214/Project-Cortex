declare const _default: import("convex/server").SchemaDefinition<{
    conversations: import("convex/server").TableDefinition<import("convex/values").VObject<{
        metadata?: any;
        conversationId: string;
        type: "user-agent" | "agent-agent";
        participants: {
            userId?: string | undefined;
            agentId?: string | undefined;
            agentIds?: string[] | undefined;
        };
        messages: {
            agentId?: string | undefined;
            metadata?: any;
            id: string;
            role: "user" | "agent" | "system";
            content: string;
            timestamp: number;
        }[];
        messageCount: number;
        createdAt: number;
        updatedAt: number;
    }, {
        conversationId: import("convex/values").VString<string, "required">;
        type: import("convex/values").VUnion<"user-agent" | "agent-agent", [import("convex/values").VLiteral<"user-agent", "required">, import("convex/values").VLiteral<"agent-agent", "required">], "required", never>;
        participants: import("convex/values").VObject<{
            userId?: string | undefined;
            agentId?: string | undefined;
            agentIds?: string[] | undefined;
        }, {
            userId: import("convex/values").VString<string | undefined, "optional">;
            agentId: import("convex/values").VString<string | undefined, "optional">;
            agentIds: import("convex/values").VArray<string[] | undefined, import("convex/values").VString<string, "required">, "optional">;
        }, "required", "userId" | "agentId" | "agentIds">;
        messages: import("convex/values").VArray<{
            agentId?: string | undefined;
            metadata?: any;
            id: string;
            role: "user" | "agent" | "system";
            content: string;
            timestamp: number;
        }[], import("convex/values").VObject<{
            agentId?: string | undefined;
            metadata?: any;
            id: string;
            role: "user" | "agent" | "system";
            content: string;
            timestamp: number;
        }, {
            id: import("convex/values").VString<string, "required">;
            role: import("convex/values").VUnion<"user" | "agent" | "system", [import("convex/values").VLiteral<"user", "required">, import("convex/values").VLiteral<"agent", "required">, import("convex/values").VLiteral<"system", "required">], "required", never>;
            content: import("convex/values").VString<string, "required">;
            timestamp: import("convex/values").VFloat64<number, "required">;
            agentId: import("convex/values").VString<string | undefined, "optional">;
            metadata: import("convex/values").VAny<any, "optional", string>;
        }, "required", "id" | "agentId" | "role" | "content" | "timestamp" | "metadata" | `metadata.${string}`>, "required">;
        messageCount: import("convex/values").VFloat64<number, "required">;
        metadata: import("convex/values").VAny<any, "optional", string>;
        createdAt: import("convex/values").VFloat64<number, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "conversationId" | "type" | "participants" | "messages" | "metadata" | `metadata.${string}` | "messageCount" | "createdAt" | "updatedAt" | "participants.userId" | "participants.agentId" | "participants.agentIds">, {
        by_conversationId: ["conversationId", "_creationTime"];
        by_type: ["type", "_creationTime"];
        by_user: ["participants.userId", "_creationTime"];
        by_agent: ["participants.agentId", "_creationTime"];
        by_agent_user: ["participants.agentId", "participants.userId", "_creationTime"];
        by_created: ["createdAt", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map