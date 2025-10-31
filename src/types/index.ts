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
  participantId?: string; // NEW: Hive Mode tracking
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
  fact: string; // The fact statement
  factType:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "custom";
  subject?: string; // Primary entity
  predicate?: string; // Relationship type
  object?: string; // Secondary entity
  confidence: number; // 0-100
  sourceType: "conversation" | "system" | "tool" | "manual";
  sourceRef?: {
    conversationId?: string;
    messageIds?: string[];
    memoryId?: string;
  };
  metadata?: any;
  tags: string[];
  validFrom?: number;
  validUntil?: number;
  version: number;
  supersededBy?: string; // factId of newer version
  supersedes?: string; // factId of previous version
  createdAt: number;
  updatedAt: number;
}

export interface StoreFactParams {
  memorySpaceId: string;
  participantId?: string;
  fact: string;
  factType:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "custom";
  subject?: string;
  predicate?: string;
  object?: string;
  confidence: number;
  sourceType: "conversation" | "system" | "tool" | "manual";
  sourceRef?: {
    conversationId?: string;
    messageIds?: string[];
    memoryId?: string;
  };
  metadata?: any;
  tags?: string[];
  validFrom?: number;
  validUntil?: number;
}

export interface ListFactsFilter {
  memorySpaceId: string;
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "custom";
  subject?: string;
  tags?: string[];
  includeSuperseded?: boolean;
  limit?: number;
}

export interface CountFactsFilter {
  memorySpaceId: string;
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "custom";
  includeSuperseded?: boolean;
}

export interface SearchFactsOptions {
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "custom";
  minConfidence?: number;
  tags?: string[];
  limit?: number;
}

export interface UpdateFactInput {
  fact?: string;
  confidence?: number;
  tags?: string[];
  validUntil?: number;
  metadata?: any;
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Graph Integration Options (syncToGraph pattern across all APIs)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Standard graph sync option
 * Follows existing SDK pattern (autoEmbed, deleteConversation, etc.)
 */
export interface GraphSyncOption {
  /** Sync this operation to graph database (if graph configured) */
  syncToGraph?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 1a: Conversations API Options
// ────────────────────────────────────────────────────────────────────────────

export interface CreateConversationOptions extends GraphSyncOption {}

export interface AddMessageOptions extends GraphSyncOption {}

export interface UpdateConversationOptions extends GraphSyncOption {}

export interface DeleteConversationOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Layer 1b: Immutable API Options
// ────────────────────────────────────────────────────────────────────────────

export interface StoreImmutableOptions extends GraphSyncOption {}

export interface UpdateImmutableOptions extends GraphSyncOption {}

export interface DeleteImmutableOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Layer 1c: Mutable API Options
// ────────────────────────────────────────────────────────────────────────────

export interface SetMutableOptions extends GraphSyncOption {}

export interface UpdateMutableOptions extends GraphSyncOption {}

export interface DeleteMutableOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Layer 2: Vector API Options
// ────────────────────────────────────────────────────────────────────────────

export interface StoreMemoryOptions extends GraphSyncOption {}

export interface UpdateMemoryOptions extends GraphSyncOption {}

export interface DeleteMemoryOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Layer 3: Facts API Options
// ────────────────────────────────────────────────────────────────────────────

export interface StoreFactOptions extends GraphSyncOption {}

export interface UpdateFactOptions extends GraphSyncOption {}

export interface DeleteFactOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Layer 4: Contexts API Options
// ────────────────────────────────────────────────────────────────────────────

export interface CreateContextOptions extends GraphSyncOption {}

export interface UpdateContextOptions extends GraphSyncOption {}

export interface DeleteContextOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Layer 4: Memory Spaces API Options
// ────────────────────────────────────────────────────────────────────────────

export interface RegisterMemorySpaceOptions extends GraphSyncOption {}

export interface UnregisterMemorySpaceOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Convenience: Memory API Options
// ────────────────────────────────────────────────────────────────────────────

/**
 * Options for memory.remember() convenience method
 * Defaults to syncToGraph: true if graph is configured
 */
export interface RememberOptions extends GraphSyncOption {
  /** Extract facts from conversation (default: false) */
  extractFacts?: boolean;

  /** Custom extraction function */
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;

  /** Custom embedding function */
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  /** Cloud Mode options */
  autoEmbed?: boolean;
  autoSummarize?: boolean;
}

/**
 * Extended forget options with graph sync
 * Defaults to syncToGraph: true if graph is configured
 */
export interface ExtendedForgetOptions extends ForgetOptions, GraphSyncOption {}

/**
 * Options for memory recall with graph enrichment
 */
export interface RecallOptions extends GraphSyncOption {
  /** Use graph for enrichment (default: true if graph configured) */
  enrichWithGraph?: boolean;

  /** Maximum depth for graph traversal enrichment */
  maxEnrichmentDepth?: number;

  /** Include full conversation history */
  includeConversation?: boolean;
}
