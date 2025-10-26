export declare const create: import("convex/server").RegisteredMutation<"public", {
    metadata?: any;
    conversationId: string;
    type: "user-agent" | "agent-agent";
    participants: {
        userId?: string | undefined;
        agentId?: string | undefined;
        agentIds?: string[] | undefined;
    };
}, Promise<{
    _id: import("convex/values").GenericId<"conversations">;
    _creationTime: number;
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
} | null>>;
export declare const addMessage: import("convex/server").RegisteredMutation<"public", {
    conversationId: string;
    message: {
        agentId?: string | undefined;
        metadata?: any;
        id: string;
        role: "user" | "agent" | "system";
        content: string;
    };
}, Promise<{
    _id: import("convex/values").GenericId<"conversations">;
    _creationTime: number;
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
} | null>>;
export declare const deleteConversation: import("convex/server").RegisteredMutation<"public", {
    conversationId: string;
}, Promise<{
    deleted: boolean;
}>>;
export declare const get: import("convex/server").RegisteredQuery<"public", {
    conversationId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"conversations">;
    _creationTime: number;
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
} | null>>;
export declare const list: import("convex/server").RegisteredQuery<"public", {
    type?: "user-agent" | "agent-agent" | undefined;
    userId?: string | undefined;
    agentId?: string | undefined;
    limit?: number | undefined;
}, Promise<{
    _id: import("convex/values").GenericId<"conversations">;
    _creationTime: number;
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
}[]>>;
export declare const count: import("convex/server").RegisteredQuery<"public", {
    type?: "user-agent" | "agent-agent" | undefined;
    userId?: string | undefined;
    agentId?: string | undefined;
}, Promise<number>>;
export declare const getHistory: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    offset?: number | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    conversationId: string;
}, Promise<{
    messages: {
        agentId?: string | undefined;
        metadata?: any;
        id: string;
        role: "user" | "agent" | "system";
        content: string;
        timestamp: number;
    }[];
    total: number;
    hasMore: boolean;
    conversationId: string;
}>>;
export declare const search: import("convex/server").RegisteredQuery<"public", {
    type?: "user-agent" | "agent-agent" | undefined;
    userId?: string | undefined;
    agentId?: string | undefined;
    limit?: number | undefined;
    dateStart?: number | undefined;
    dateEnd?: number | undefined;
    query: string;
}, Promise<{
    conversation: any;
    matchedMessages: any[];
    highlights: string[];
    score: number;
}[]>>;
export declare const exportConversations: import("convex/server").RegisteredQuery<"public", {
    type?: "user-agent" | "agent-agent" | undefined;
    userId?: string | undefined;
    agentId?: string | undefined;
    dateStart?: number | undefined;
    dateEnd?: number | undefined;
    conversationIds?: string[] | undefined;
    includeMetadata?: boolean | undefined;
    format: "json" | "csv";
}, Promise<{
    format: string;
    data: string;
    count: number;
    exportedAt: number;
}>>;
//# sourceMappingURL=conversations.d.ts.map