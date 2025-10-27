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

export interface GetHistoryOptions {
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

export interface SearchConversationsInput {
  query: string;
  filters?: {
    type?: ConversationType;
    userId?: string;
    agentId?: string;
    dateRange?: {
      start?: number;
      end?: number;
    };
    limit?: number;
  };
}

export interface ConversationSearchResult {
  conversation: Conversation;
  matchedMessages: Message[];
  highlights: string[];
  score: number;
}

export interface ExportConversationsOptions {
  filters?: {
    userId?: string;
    agentId?: string;
    conversationIds?: string[];
    type?: ConversationType;
    dateRange?: {
      start?: number;
      end?: number;
    };
  };
  format: "json" | "csv";
  includeMetadata?: boolean;
}

export interface ExportResult {
  format: "json" | "csv";
  data: string;
  count: number;
  exportedAt: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Immutable Store (Layer 1b)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ImmutableEntry {
  type: string;
  id: string;
  data: Record<string, any>;
  userId?: string;
  metadata?: {
    publishedBy?: string;
    tags?: string[];
    importance?: number;
    [key: string]: any;
  };
}

export interface ImmutableRecord {
  _id: string;
  type: string;
  id: string;
  data: Record<string, any>;
  userId?: string;
  version: number;
  previousVersions: ImmutableVersion[];
  metadata?: {
    publishedBy?: string;
    tags?: string[];
    importance?: number;
    [key: string]: any;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ImmutableVersion {
  version: number;
  data: Record<string, any>;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ImmutableVersionExpanded {
  type: string;
  id: string;
  version: number;
  data: Record<string, any>;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: number;
  createdAt: number;
}

export interface ListImmutableFilter {
  type?: string;
  userId?: string;
  limit?: number;
}

export interface SearchImmutableInput {
  query: string;
  type?: string;
  userId?: string;
  limit?: number;
}

export interface ImmutableSearchResult {
  entry: ImmutableRecord;
  score: number;
  highlights: string[];
}

export interface CountImmutableFilter {
  type?: string;
  userId?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutable Store (Layer 1c)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MutableRecord {
  _id: string;
  namespace: string;
  key: string;
  value: any;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessed?: number;
}

export interface SetMutableInput {
  namespace: string;
  key: string;
  value: any;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateMutableInput {
  namespace: string;
  key: string;
  updater: (current: any) => any;
}

export interface ListMutableFilter {
  namespace: string;
  keyPrefix?: string;
  userId?: string;
  limit?: number;
}

export interface CountMutableFilter {
  namespace: string;
  userId?: string;
  keyPrefix?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Vector Memory (Layer 2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SourceType = "conversation" | "system" | "tool" | "a2a";
export type ContentType = "raw" | "summarized";

export interface ConversationRef {
  conversationId: string;
  messageIds: string[];
}

export interface ImmutableRef {
  type: string;
  id: string;
  version?: number;
}

export interface MutableRef {
  namespace: string;
  key: string;
  snapshotValue: any;
  snapshotAt: number;
}

export interface MemoryMetadata {
  importance: number; // 0-100
  tags: string[];
  [key: string]: any;
}

export interface MemoryVersion {
  version: number;
  content: string;
  embedding?: number[];
  timestamp: number;
}

export interface MemoryEntry {
  _id: string;
  memoryId: string;
  agentId: string;
  userId?: string;
  content: string;
  contentType: ContentType;
  embedding?: number[];
  sourceType: SourceType;
  sourceUserId?: string;
  sourceUserName?: string;
  sourceTimestamp: number;
  conversationRef?: ConversationRef;
  immutableRef?: ImmutableRef;
  mutableRef?: MutableRef;
  importance: number;
  tags: string[];
  version: number;
  previousVersions: MemoryVersion[];
  createdAt: number;
  updatedAt: number;
  lastAccessed?: number;
  accessCount: number;
}

export interface StoreMemoryInput {
  content: string;
  contentType: ContentType;
  embedding?: number[];
  userId?: string;
  source: {
    type: SourceType;
    userId?: string;
    userName?: string;
    timestamp?: number;
  };
  conversationRef?: ConversationRef;
  immutableRef?: ImmutableRef;
  mutableRef?: MutableRef;
  metadata: MemoryMetadata;
}

export interface SearchMemoriesOptions {
  embedding?: number[];
  userId?: string;
  tags?: string[];
  sourceType?: SourceType;
  minImportance?: number;
  limit?: number;
  minScore?: number;
}

export interface ListMemoriesFilter {
  agentId: string;
  userId?: string;
  sourceType?: SourceType;
  limit?: number;
}

export interface CountMemoriesFilter {
  agentId: string;
  userId?: string;
  sourceType?: SourceType;
}
