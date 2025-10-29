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
  participantId?: string; // Hive Mode: which participant sent this
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  _id: string;
  conversationId: string;
  memorySpaceId: string; // NEW: Memory space isolation
  participantId?: string; // NEW: Hive Mode tracking
  type: ConversationType;
  participants: {
    userId?: string;
    participantId?: string; // Hive Mode
    memorySpaceIds?: string[]; // Collaboration Mode (agent-agent)
  };
  messages: Message[];
  messageCount: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface CreateConversationInput {
  conversationId?: string; // Auto-generated if not provided
  memorySpaceId: string; // NEW: Required
  participantId?: string; // NEW: Hive Mode
  type: ConversationType;
  participants: {
    userId?: string;
    participantId?: string;
    memorySpaceIds?: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface AddMessageInput {
  conversationId: string;
  message: {
    id?: string; // Auto-generated if not provided
    role: "user" | "agent" | "system";
    content: string;
    participantId?: string; // Updated for Hive Mode
    metadata?: Record<string, unknown>;
  };
}

export interface ListConversationsFilter {
  type?: ConversationType;
  userId?: string;
  memorySpaceId?: string; // Updated
  limit?: number;
}

export interface CountConversationsFilter {
  type?: ConversationType;
  userId?: string;
  memorySpaceId?: string; // Updated
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
    memorySpaceId?: string; // Updated
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
    memorySpaceId?: string; // Updated
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
  data: Record<string, unknown>;
  userId?: string;
  metadata?: {
    publishedBy?: string;
    tags?: string[];
    importance?: number;
    [key: string]: unknown;
  };
}

export interface ImmutableRecord {
  _id: string;
  type: string;
  id: string;
  data: Record<string, unknown>;
  userId?: string;
  version: number;
  previousVersions: ImmutableVersion[];
  metadata?: {
    publishedBy?: string;
    tags?: string[];
    importance?: number;
    [key: string]: unknown;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ImmutableVersion {
  version: number;
  data: Record<string, unknown>;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ImmutableVersionExpanded {
  type: string;
  id: string;
  version: number;
  data: Record<string, unknown>;
  userId?: string;
  metadata?: Record<string, unknown>;
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
  value: unknown;
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessed?: number;
}

export interface SetMutableInput {
  namespace: string;
  key: string;
  value: unknown;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMutableInput {
  namespace: string;
  key: string;
  updater: (current: unknown) => unknown;
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
  snapshotValue: unknown;
  snapshotAt: number;
}

export interface MemoryMetadata {
  importance: number; // 0-100
  tags: string[];
  [key: string]: unknown;
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
  memorySpaceId: string; // Updated
  participantId?: string; // NEW: Hive Mode
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
  memorySpaceId: string; // Updated
  userId?: string;
  participantId?: string; // NEW: Filter by participant (Hive Mode)
  sourceType?: SourceType;
  limit?: number;
}

export interface CountMemoriesFilter {
  memorySpaceId: string; // Updated
  userId?: string;
  participantId?: string; // NEW: Filter by participant (Hive Mode)
  sourceType?: SourceType;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 3: Memory Convenience API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RememberParams {
  memorySpaceId: string; // Updated
  participantId?: string; // NEW: Hive Mode tracking
  conversationId: string;
  userMessage: string;
  agentResponse: string;
  userId: string;
  userName: string;

  // Optional extraction
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;

  // Optional embedding
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Cloud Mode options
  autoEmbed?: boolean;
  autoSummarize?: boolean;

  // Metadata
  importance?: number;
  tags?: string[];
}

export interface RememberResult {
  conversation: {
    messageIds: string[];
    conversationId: string;
  };
  memories: MemoryEntry[];
}

export interface ForgetOptions {
  deleteConversation?: boolean; // Delete ACID conversation too
  deleteEntireConversation?: boolean; // Delete whole conversation vs just messages
}

export interface ForgetResult {
  memoryDeleted: boolean;
  conversationDeleted: boolean;
  messagesDeleted: number;
  restorable: boolean;
}

export interface GetMemoryOptions {
  includeConversation?: boolean; // Fetch ACID conversation
}

export interface EnrichedMemory {
  memory: MemoryEntry;
  conversation?: Conversation;
  sourceMessages?: Message[];
}

export interface SearchMemoryOptions extends SearchMemoriesOptions {
  enrichConversation?: boolean; // Fetch ACID for each result
}

export type EnrichedSearchResult = EnrichedMemory & {
  score?: number;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 3: Facts Store (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface FactRecord {
  _id: string;
  factId: string;
  memorySpaceId: string;
  participantId?: string;
  fact: string;
  category?: string;
  confidence?: number;
  entities?: string[];
  relations?: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence?: number;
  }>;
  conversationRef?: {
    conversationId: string;
    messageIds: string[];
  };
  userId?: string;
  metadata: {
    tags: string[];
    importance: number;
    extractedBy?: string;
    extractedAt?: number;
  };
  version: number;
  previousVersions: Array<{
    version: number;
    fact: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface StoreFactParams {
  memorySpaceId: string;
  participantId?: string;
  fact: string;
  category?: string;
  confidence?: number;
  entities?: string[];
  relations?: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence?: number;
  }>;
  conversationRef?: {
    conversationId: string;
    messageIds: string[];
  };
  userId?: string;
  metadata?: {
    tags?: string[];
    importance?: number;
    extractedBy?: string;
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory Spaces Registry (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MemorySpace {
  _id: string;
  memorySpaceId: string;
  name?: string;
  type: "personal" | "team" | "project" | "custom";
  participants: Array<{
    id: string;
    type: string;
    joinedAt: number;
  }>;
  metadata: Record<string, unknown>;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
}

export interface RegisterMemorySpaceParams {
  memorySpaceId: string;
  name?: string;
  type: "personal" | "team" | "project" | "custom";
  participants?: Array<{
    id: string;
    type: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface MemorySpaceStats {
  memorySpaceId: string;
  totalMemories: number;
  totalConversations: number;
  totalFacts: number;
  totalMessages: number;
  storage: {
    conversationsBytes: number;
    memoriesBytes: number;
    factsBytes: number;
    totalBytes: number;
  };
  avgSearchTime?: string;
  topTags: string[];
  importanceBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    trivial: number;
  };
  participants?: Array<{
    participantId: string;
    memoriesStored: number;
    conversationsStored: number;
    factsExtracted: number;
    firstActive: number;
    lastActive: number;
    avgImportance: number;
    topTags: string[];
  }>;
}
