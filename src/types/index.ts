/**
 * Cortex SDK - TypeScript Types
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Conversations (Layer 1a)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ConversationType = "user-agent" | "agent-agent";

export interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: number;
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface Conversation {
  _id: string;
  conversationId: string;
  type: ConversationType;
  participants: {
    userId?: string;
    agentId?: string;
    agentIds?: string[];
  };
  messages: Message[];
  messageCount: number;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface CreateConversationInput {
  conversationId?: string; // Auto-generated if not provided
  type: ConversationType;
  participants: {
    userId?: string;
    agentId?: string;
    agentIds?: string[];
  };
  metadata?: Record<string, any>;
}

export interface AddMessageInput {
  conversationId: string;
  message: {
    id?: string; // Auto-generated if not provided
    role: "user" | "agent" | "system";
    content: string;
    agentId?: string;
    metadata?: Record<string, any>;
  };
}

export interface ListConversationsFilter {
  type?: ConversationType;
  userId?: string;
  agentId?: string;
  limit?: number;
}

export interface CountConversationsFilter {
  type?: ConversationType;
  userId?: string;
  agentId?: string;
}

