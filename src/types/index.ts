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
    userId?: string; // The human user in the conversation
    agentId?: string; // The agent/assistant in the conversation
    participantId?: string; // Hive Mode: who created this
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
    userId?: string; // The human user in the conversation
    agentId?: string; // The agent/assistant in the conversation
    participantId?: string; // Hive Mode: who created this
    memorySpaceIds?: string[]; // Collaboration Mode (agent-agent)
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
  participantId?: string; // Hive Mode tracking
  createdBefore?: number;
  createdAfter?: number;
  updatedBefore?: number;
  updatedAfter?: number;
  lastMessageBefore?: number;
  lastMessageAfter?: number;
  messageCount?: number | { min?: number; max?: number };
  metadata?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "lastMessageAt" | "messageCount";
  sortOrder?: "asc" | "desc";
  includeMessages?: boolean;
}

export interface ListConversationsResult {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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
  since?: number; // Messages after timestamp
  until?: number; // Messages before timestamp
  roles?: ("user" | "agent" | "system")[]; // Filter by role
}

export interface GetConversationOptions {
  includeMessages?: boolean; // Default: true
  messageLimit?: number; // Limit messages returned
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
  options?: SearchConversationsOptions;
}

export interface SearchConversationsOptions {
  searchIn?: "content" | "metadata" | "both"; // Default: "content"
  matchMode?: "contains" | "exact" | "fuzzy"; // Default: "contains"
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
    participantId?: string; // Hive Mode filter
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

export interface ConversationDeletionResult {
  deleted: boolean;
  conversationId: string;
  messagesDeleted: number;
  deletedAt: number;
  restorable: boolean; // Always false for conversations
}

export interface DeleteManyConversationsOptions {
  dryRun?: boolean; // Preview what would be deleted
  requireConfirmation?: boolean; // Require explicit confirmation
  confirmationThreshold?: number; // Threshold for auto-confirm (default: 10)
}

export interface DeleteManyConversationsResult {
  deleted: number;
  conversationIds: string[];
  totalMessagesDeleted: number;
  wouldDelete?: number; // For dryRun mode
  dryRun?: boolean;
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
  offset?: number;
  updatedAfter?: number;
  updatedBefore?: number;
  sortBy?: "key" | "updatedAt" | "accessCount";
  sortOrder?: "asc" | "desc";
}

export interface CountMutableFilter {
  namespace: string;
  userId?: string;
  keyPrefix?: string;
  updatedAfter?: number;
  updatedBefore?: number;
}

export interface PurgeNamespaceOptions {
  dryRun?: boolean;
}

/**
 * Filter options for purgeMany operation
 */
export interface PurgeManyFilter {
  /** Required namespace to purge from */
  namespace: string;
  /** Filter by key prefix */
  keyPrefix?: string;
  /** Filter by user ID */
  userId?: string;
  /** Delete keys updated before this timestamp (ms since epoch) */
  updatedBefore?: number;
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

export interface FactsRef {
  factId: string;
  version?: number;
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
  userId?: string; // For user-owned memories
  agentId?: string; // For agent-owned memories
  content: string;
  contentType: ContentType;
  embedding?: number[];
  sourceType: SourceType;
  sourceUserId?: string;
  sourceUserName?: string;
  sourceTimestamp: number;
  messageRole?: "user" | "agent" | "system"; // NEW: For semantic search weighting
  conversationRef?: ConversationRef;
  immutableRef?: ImmutableRef;
  mutableRef?: MutableRef;
  factsRef?: FactsRef; // Reference to Layer 3 fact
  importance: number;
  tags: string[];

  // Enrichment fields (for bullet-proof retrieval)
  enrichedContent?: string; // Concatenated searchable content for embedding
  factCategory?: string; // Category for filtering (e.g., "addressing_preference")

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
  userId?: string; // For user-owned memories
  agentId?: string; // For agent-owned memories
  messageRole?: "user" | "agent" | "system"; // NEW: For semantic search weighting

  // Enrichment fields (for bullet-proof retrieval)
  enrichedContent?: string; // Concatenated searchable content for embedding
  factCategory?: string; // Category for filtering (e.g., "addressing_preference")

  source: {
    type: SourceType;
    userId?: string;
    userName?: string;
    timestamp?: number;
  };
  conversationRef?: ConversationRef;
  immutableRef?: ImmutableRef;
  mutableRef?: MutableRef;
  factsRef?: FactsRef; // Reference to Layer 3 fact
  metadata: MemoryMetadata;
  extractFacts?: (content: string) => Promise<Array<{
    fact: string;
    factType:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "observation"
      | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
  }> | null>;
}

export interface SearchMemoriesOptions {
  embedding?: number[];
  userId?: string;
  tags?: string[];
  sourceType?: SourceType;
  minImportance?: number;
  limit?: number;
  minScore?: number;
  /** Category to boost for bullet-proof retrieval (e.g., "addressing_preference") */
  queryCategory?: string;
}

export interface ListMemoriesFilter {
  memorySpaceId: string; // Updated
  userId?: string;
  participantId?: string; // NEW: Filter by participant (Hive Mode)
  sourceType?: SourceType;
  limit?: number;
  enrichFacts?: boolean; // NEW: Include facts in results
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

/**
 * Layers that can be explicitly skipped during remember() orchestration.
 *
 * - 'users': Don't auto-create user profile
 * - 'agents': Don't auto-register agent
 * - 'conversations': Don't store messages in ACID conversation layer
 * - 'vector': Don't store in vector memory layer
 * - 'facts': Don't auto-extract facts (even if LLM configured)
 * - 'graph': Don't sync to graph database (even if configured)
 */
export type SkippableLayer =
  | "users"
  | "agents"
  | "conversations"
  | "vector"
  | "facts"
  | "graph";

export interface RememberParams {
  /**
   * Memory space for isolation. If not provided, defaults to 'default'
   * with a warning. Auto-registers the memory space if it doesn't exist.
   */
  memorySpaceId?: string;

  /**
   * Conversation ID. Required.
   */
  conversationId: string;

  /**
   * The user's message content. Required.
   */
  userMessage: string;

  /**
   * The agent's response content. Required.
   */
  agentResponse: string;

  /**
   * User ID for user-owned memories. At least one of userId or agentId is required.
   * Auto-creates user profile if it doesn't exist (unless 'users' is in skipLayers).
   */
  userId?: string;

  /**
   * Agent ID for agent-owned memories. At least one of userId or agentId is required.
   * Auto-registers agent if it doesn't exist (unless 'agents' is in skipLayers).
   */
  agentId?: string;

  /**
   * Display name for the user (used in conversation tracking).
   * Required when userId is provided.
   */
  userName?: string;

  /**
   * Participant ID for Hive Mode tracking.
   * This tracks WHO stored the memory within a shared memory space,
   * distinct from userId/agentId which indicates ownership.
   */
  participantId?: string;

  /**
   * Layers to explicitly skip during orchestration.
   * By default, all configured layers are enabled.
   */
  skipLayers?: SkippableLayer[];

  // Optional extraction
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;

  // Optional embedding
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Optional fact extraction
  extractFacts?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<Array<{
    fact: string;
    factType:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "observation"
      | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
  }> | null>;

  // Cloud Mode options
  autoEmbed?: boolean;
  autoSummarize?: boolean;

  // Metadata
  importance?: number;
  tags?: string[];

  /**
   * Fact deduplication strategy. Defaults to 'semantic' for maximum effectiveness.
   *
   * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
   * - 'structural': Subject + predicate + object match (fast, good accuracy)
   * - 'exact': Normalized text match (fastest, lowest accuracy)
   * - false: Disable deduplication (previous behavior)
   *
   * The generateEmbedding function (if provided) is automatically reused for semantic matching.
   *
   * @default 'semantic' (with fallback to 'structural' if no generateEmbedding)
   */
  factDeduplication?: "semantic" | "structural" | "exact" | false;
}

export interface RememberResult {
  conversation: {
    messageIds: string[];
    conversationId: string;
  };
  memories: MemoryEntry[];
  facts: FactRecord[];
}

/**
 * Parameters for rememberStream()
 *
 * Similar to RememberParams but accepts streaming response instead of complete string
 */
export interface RememberStreamParams {
  /**
   * Memory space for isolation. If not provided, defaults to 'default'
   * with a warning. Auto-registers the memory space if it doesn't exist.
   */
  memorySpaceId?: string;

  /**
   * Conversation ID. Required.
   */
  conversationId: string;

  /**
   * The user's message content. Required.
   */
  userMessage: string;

  /**
   * The streaming response from the agent.
   */
  responseStream: ReadableStream<string> | AsyncIterable<string>;

  /**
   * User ID for user-owned memories. At least one of userId or agentId is required.
   * Auto-creates user profile if it doesn't exist (unless 'users' is in skipLayers).
   */
  userId?: string;

  /**
   * Agent ID for agent-owned memories. At least one of userId or agentId is required.
   * Auto-registers agent if it doesn't exist (unless 'agents' is in skipLayers).
   */
  agentId?: string;

  /**
   * Display name for the user (used in conversation tracking).
   * Required when userId is provided.
   */
  userName?: string;

  /**
   * Participant ID for Hive Mode tracking.
   * This tracks WHO stored the memory within a shared memory space,
   * distinct from userId/agentId which indicates ownership.
   */
  participantId?: string;

  /**
   * Layers to explicitly skip during orchestration.
   * By default, all configured layers are enabled.
   */
  skipLayers?: SkippableLayer[];

  // Optional extraction
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;

  // Optional embedding
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Optional fact extraction
  extractFacts?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<Array<{
    fact: string;
    factType:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "observation"
      | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
  }> | null>;

  // Cloud Mode options
  autoEmbed?: boolean;
  autoSummarize?: boolean;

  // Metadata
  importance?: number;
  tags?: string[];

  /**
   * Fact deduplication strategy. Defaults to 'semantic' for maximum effectiveness.
   *
   * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
   * - 'structural': Subject + predicate + object match (fast, good accuracy)
   * - 'exact': Normalized text match (fastest, lowest accuracy)
   * - false: Disable deduplication (previous behavior)
   *
   * The generateEmbedding function (if provided) is automatically reused for semantic matching.
   *
   * @default 'semantic' (with fallback to 'structural' if no generateEmbedding)
   */
  factDeduplication?: "semantic" | "structural" | "exact" | false;
}

/**
 * Result from rememberStream()
 *
 * Includes the standard RememberResult plus the complete response text
 */
export interface RememberStreamResult extends RememberResult {
  fullResponse: string; // The complete text from the stream
}

export interface ForgetOptions {
  deleteConversation?: boolean; // Delete ACID conversation too
  deleteEntireConversation?: boolean; // Delete whole conversation vs just messages
}

export interface ForgetResult {
  memoryDeleted: boolean;
  conversationDeleted: boolean;
  messagesDeleted: number;
  factsDeleted: number;
  factIds: string[];
  restorable: boolean;
}

export interface GetMemoryOptions {
  includeConversation?: boolean; // Fetch ACID conversation
}

export interface EnrichedMemory {
  memory: MemoryEntry;
  conversation?: Conversation;
  sourceMessages?: Message[];
  facts?: FactRecord[];
}

export interface SearchMemoryOptions extends SearchMemoriesOptions {
  enrichConversation?: boolean; // Fetch ACID for each result
}

export type EnrichedSearchResult = EnrichedMemory & {
  score?: number;
};

// Additional result types for memory operations with fact tracking
export interface DeleteMemoryResult {
  deleted: boolean;
  memoryId: string;
  factsDeleted: number;
  factIds: string[];
}

export interface DeleteManyResult {
  deleted: number;
  memoryIds: string[];
  factsDeleted: number;
  factIds: string[];
}

export interface ArchiveResult {
  archived: boolean;
  memoryId: string;
  restorable: boolean;
  factsArchived: number;
  factIds: string[];
}

export interface UpdateManyResult {
  updated: number;
  memoryIds: string[];
  factsAffected: number;
}

export interface StoreMemoryResult {
  memory: MemoryEntry;
  facts: FactRecord[];
}

export interface UpdateMemoryResult {
  memory: MemoryEntry;
  factsReextracted?: FactRecord[];
}

// Options interfaces for memory operations with fact integration
export interface DeleteMemoryOptions extends GraphSyncOption {
  cascadeDeleteFacts?: boolean; // Default: true
}

export interface UpdateMemoryOptions extends GraphSyncOption {
  reextractFacts?: boolean; // Default: false
  extractFacts?: (content: string) => Promise<Array<{
    fact: string;
    factType:
      | "preference"
      | "identity"
      | "knowledge"
      | "relationship"
      | "event"
      | "observation"
      | "custom";
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
  }> | null>;
}

export interface ExportMemoriesOptions {
  memorySpaceId: string;
  userId?: string;
  format: "json" | "csv";
  includeEmbeddings?: boolean;
  includeFacts?: boolean; // NEW: Include facts in export
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer 3: Facts Store (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Entity type for enriched fact extraction
export interface EnrichedEntity {
  name: string;
  type: string;
  fullValue?: string;
}

// Relation type for enriched fact extraction
export interface EnrichedRelation {
  subject: string;
  predicate: string;
  object: string;
}

export interface FactRecord {
  _id: string;
  factId: string;
  memorySpaceId: string;
  participantId?: string; // Hive Mode tracking
  userId?: string; // GDPR compliance - links to user
  fact: string; // The fact statement
  factType:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  subject?: string; // Primary entity
  predicate?: string; // Relationship type
  object?: string; // Secondary entity
  confidence: number; // 0-100
  sourceType: "conversation" | "system" | "tool" | "manual" | "a2a";
  sourceRef?: {
    conversationId?: string;
    messageIds?: string[];
    memoryId?: string;
  };
  metadata?: Record<string, unknown>;
  tags: string[];

  // Enrichment fields (for bullet-proof retrieval)
  category?: string; // Specific sub-category (e.g., "addressing_preference")
  searchAliases?: string[]; // Alternative search terms
  semanticContext?: string; // Usage context sentence
  entities?: EnrichedEntity[]; // Extracted entities with types
  relations?: EnrichedRelation[]; // Subject-predicate-object triples for graph

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
  participantId?: string; // Hive Mode tracking
  userId?: string; // GDPR compliance - links to user
  fact: string;
  factType:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  subject?: string;
  predicate?: string;
  object?: string;
  confidence: number;
  sourceType: "conversation" | "system" | "tool" | "manual" | "a2a";
  sourceRef?: {
    conversationId?: string;
    messageIds?: string[];
    memoryId?: string;
  };
  metadata?: Record<string, unknown>;
  tags?: string[];

  // Enrichment fields (for bullet-proof retrieval)
  category?: string; // Specific sub-category (e.g., "addressing_preference")
  searchAliases?: string[]; // Alternative search terms
  semanticContext?: string; // Usage context sentence
  entities?: EnrichedEntity[]; // Extracted entities with types
  relations?: EnrichedRelation[]; // Subject-predicate-object triples for graph

  validFrom?: number;
  validUntil?: number;
}

export interface ListFactsFilter {
  // Required
  memorySpaceId: string;

  // Fact-specific filters
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  subject?: string;
  predicate?: string;
  object?: string;
  minConfidence?: number;
  confidence?: number; // Exact match

  // Universal filters (Cortex standard)
  userId?: string;
  participantId?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual";

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number;
  includeSuperseded?: boolean;

  // Temporal validity filters
  validAt?: Date; // Facts valid at specific time

  // Metadata filters
  metadata?: Record<string, unknown>;

  // Result options
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "confidence" | "version";
  sortOrder?: "asc" | "desc";
}

export interface CountFactsFilter {
  // Required
  memorySpaceId: string;

  // Fact-specific filters
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  subject?: string;
  predicate?: string;
  object?: string;
  minConfidence?: number;
  confidence?: number; // Exact match

  // Universal filters (Cortex standard)
  userId?: string;
  participantId?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual";

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number;
  includeSuperseded?: boolean;

  // Temporal validity
  validAt?: Date;

  // Metadata filters
  metadata?: Record<string, unknown>;
}

export interface SearchFactsOptions {
  // Fact-specific filters
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  subject?: string;
  predicate?: string;
  object?: string;
  minConfidence?: number;
  confidence?: number; // Exact match

  // Universal filters (Cortex standard)
  userId?: string;
  participantId?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual";

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number;
  includeSuperseded?: boolean;

  // Temporal validity
  validAt?: Date;

  // Metadata filters
  metadata?: Record<string, unknown>;

  // Result options
  limit?: number;
  offset?: number;
  sortBy?: "confidence" | "createdAt" | "updatedAt"; // Note: search doesn't return scores
  sortOrder?: "asc" | "desc";
}

export interface QueryBySubjectFilter {
  // Required
  memorySpaceId: string;
  subject: string;

  // Fact-specific filters
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  predicate?: string;
  object?: string;
  minConfidence?: number;
  confidence?: number; // Exact match

  // Universal filters (Cortex standard)
  userId?: string;
  participantId?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual";
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  version?: number;
  includeSuperseded?: boolean;
  validAt?: Date;
  metadata?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "confidence";
  sortOrder?: "asc" | "desc";
}

export interface QueryByRelationshipFilter {
  // Required
  memorySpaceId: string;
  subject: string;
  predicate: string;

  // Fact-specific filters
  object?: string;
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
  minConfidence?: number;
  confidence?: number; // Exact match

  // Universal filters (Cortex standard)
  userId?: string;
  participantId?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual";
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  version?: number;
  includeSuperseded?: boolean;
  validAt?: Date;
  metadata?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "confidence";
  sortOrder?: "asc" | "desc";
}

export interface UpdateFactInput {
  fact?: string;
  confidence?: number;
  tags?: string[];
  validUntil?: number;
  metadata?: Record<string, unknown>;

  // Enrichment fields (for bullet-proof retrieval)
  category?: string; // Specific sub-category (e.g., "addressing_preference")
  searchAliases?: string[]; // Alternative search terms
  semanticContext?: string; // Usage context sentence
  entities?: EnrichedEntity[]; // Extracted entities with types
  relations?: EnrichedRelation[]; // Subject-predicate-object triples for graph
}

export interface DeleteManyFactsParams {
  // Required
  memorySpaceId: string;

  // Optional filters
  userId?: string; // Filter by user (GDPR cleanup)
  factType?:
    | "preference"
    | "identity"
    | "knowledge"
    | "relationship"
    | "event"
    | "observation"
    | "custom";
}

export interface DeleteManyFactsResult {
  deleted: number;
  memorySpaceId: string;
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
  // Time window info (when timeWindow option is used)
  memoriesThisWindow?: number;
  conversationsThisWindow?: number;
}

export interface ListMemorySpacesFilter {
  type?: "personal" | "team" | "project" | "custom";
  status?: "active" | "archived";
  participant?: string; // Filter by participant ID
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export interface ListMemorySpacesResult {
  spaces: MemorySpace[];
  total: number;
  hasMore: boolean;
  offset: number;
}

export interface DeleteMemorySpaceOptions {
  cascade: boolean; // Required: Must be true to proceed
  reason: string; // Required: Why deleting (audit trail)
  confirmId?: string; // Optional: Safety check (must match memorySpaceId)
  syncToGraph?: boolean; // Delete from graph database
}

export interface DeleteMemorySpaceResult {
  memorySpaceId: string;
  deleted: true;
  cascade: {
    conversationsDeleted: number;
    memoriesDeleted: number;
    factsDeleted: number;
    totalBytes: number;
  };
  reason: string;
  deletedAt: number;
}

export interface GetMemorySpaceStatsOptions {
  timeWindow?: "24h" | "7d" | "30d" | "90d" | "all";
  includeParticipants?: boolean;
}

export interface UpdateMemorySpaceOptions {
  syncToGraph?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Coordination: Agents Registry API (Optional Metadata)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AgentRegistration {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface RegisteredAgent {
  id: string;
  name: string;
  description?: string;
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
  status: "active" | "inactive" | "archived";
  registeredAt: number;
  updatedAt: number;
  lastActive?: number;
  stats?: AgentStats;
}

export interface AgentStats {
  totalMemories: number;
  totalConversations: number;
  totalFacts: number;
  memorySpacesActive: number;
  lastActive?: number;
}

/**
 * Filters for listing and searching agents.
 *
 * @remarks
 * **Pagination Limitation:** The `offset` and `limit` filters are applied at the database
 * level BEFORE the following client-side filters are applied:
 * - `metadata`
 * - `name`
 * - `capabilities`
 * - `lastActiveAfter`
 * - `lastActiveBefore`
 *
 * This means combining `offset` with any of the above filters may produce unexpected results.
 * For reliable pagination with these filters, either:
 * 1. Use `offset`/`limit` only with `status` (which is applied at the database level)
 * 2. Fetch all results without `offset` and paginate client-side
 */
export interface AgentFilters {
  /** Filter by metadata key-value pairs (client-side filter - see pagination limitation) */
  metadata?: Record<string, unknown>;
  /** Filter by agent name, case-insensitive partial match (client-side filter - see pagination limitation) */
  name?: string;
  /** Filter by capabilities (client-side filter - see pagination limitation) */
  capabilities?: string[];
  /** Match mode for capabilities: "any" (default) matches agents with at least one capability, "all" requires all capabilities */
  capabilitiesMatch?: "any" | "all";
  /** Filter by agent status (database-level filter - safe to use with offset/limit) */
  status?: "active" | "inactive" | "archived";
  registeredAfter?: number;
  registeredBefore?: number;
  /** Filter agents last active after this timestamp (client-side filter - see pagination limitation) */
  lastActiveAfter?: number;
  /** Filter agents last active before this timestamp (client-side filter - see pagination limitation) */
  lastActiveBefore?: number;
  /** Maximum number of results to return (applied at database level before client-side filters) */
  limit?: number;
  /**
   * Number of results to skip (applied at database level before client-side filters).
   * WARNING: Using offset with metadata, name, capabilities, or timestamp filters may
   * produce unexpected results. See AgentFilters documentation for details.
   */
  offset?: number;
  sortBy?: "name" | "registeredAt" | "lastActive";
  sortOrder?: "asc" | "desc";
}

export interface ExportAgentsOptions {
  filters?: AgentFilters;
  format: "json" | "csv";
  includeMetadata?: boolean;
  includeStats?: boolean;
}

export interface ExportAgentsResult {
  format: "json" | "csv";
  data: string;
  count: number;
  exportedAt: number;
}

export interface UnregisterAgentOptions {
  /** Enable cascade deletion by participantId across all memory spaces (default: false) */
  cascade?: boolean;
  /** Run verification after deletion (default: true) */
  verify?: boolean;
  /** Preview what would be deleted without actually deleting (default: false) */
  dryRun?: boolean;
}

export interface UnregisterAgentResult {
  agentId: string;
  unregisteredAt: number;

  // Per-layer counts
  conversationsDeleted: number;
  conversationMessagesDeleted: number;
  memoriesDeleted: number;
  factsDeleted: number;
  graphNodesDeleted?: number;

  // Verification
  verification: {
    complete: boolean;
    issues: string[];
  };

  // Summary
  totalDeleted: number;
  deletedLayers: string[];
  memorySpacesAffected: string[];
}

export interface AgentDeletionPlan {
  conversations: Conversation[];
  memories: MemoryEntry[];
  facts: FactRecord[];
  graph: Array<{ nodeId: string; labels: string[] }>;
  agentRegistration: RegisteredAgent | null;
  memorySpaces: string[]; // Which spaces were affected
}

export interface AgentDeletionBackup {
  conversations: Conversation[];
  memories: MemoryEntry[];
  facts: FactRecord[];
  agentRegistration: RegisteredAgent | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// A2A Communication API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parameters for sending an A2A message
 */
export interface A2ASendParams {
  /** Sender agent ID */
  from: string;
  /** Receiver agent ID */
  to: string;
  /** Message content */
  message: string;
  /** Optional user ID (enables GDPR cascade) */
  userId?: string;
  /** Optional context/workflow ID */
  contextId?: string;
  /** Importance level 0-100 (default: 60) */
  importance?: number;
  /** Store in ACID conversation (default: true) */
  trackConversation?: boolean;
  /** Auto-generate embeddings (Cloud Mode only) */
  autoEmbed?: boolean;
  /** Optional metadata */
  metadata?: {
    tags?: string[];
    priority?: "low" | "normal" | "high" | "urgent";
    [key: string]: unknown;
  };
}

/**
 * Result from A2A send operation
 */
export interface A2AMessage {
  /** Unique message ID */
  messageId: string;
  /** Timestamp when sent */
  sentAt: number;
  /** ACID conversation ID (if trackConversation=true) */
  conversationId?: string;
  /** Message ID in ACID conversation */
  acidMessageId?: string;
  /** Memory ID in sender's storage */
  senderMemoryId: string;
  /** Memory ID in receiver's storage */
  receiverMemoryId: string;
}

/**
 * Parameters for A2A request (synchronous request-response)
 */
export interface A2ARequestParams {
  /** Sender agent ID */
  from: string;
  /** Receiver agent ID */
  to: string;
  /** Request message */
  message: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 1) */
  retries?: number;
  /** Optional user ID (enables GDPR cascade) */
  userId?: string;
  /** Optional context/workflow ID */
  contextId?: string;
  /** Importance level 0-100 */
  importance?: number;
}

/**
 * Response from A2A request
 */
export interface A2AResponse {
  /** Response message content */
  response: string;
  /** Original request message ID */
  messageId: string;
  /** Response message ID */
  responseMessageId: string;
  /** Timestamp when responded */
  respondedAt: number;
  /** Response time in milliseconds */
  responseTime: number;
}

/**
 * Parameters for A2A broadcast (one-to-many)
 */
export interface A2ABroadcastParams {
  /** Sender agent ID */
  from: string;
  /** Array of recipient agent IDs */
  to: string[];
  /** Message content */
  message: string;
  /** Optional user ID (enables GDPR cascade) */
  userId?: string;
  /** Optional context/workflow ID */
  contextId?: string;
  /** Importance level 0-100 (default: 60) */
  importance?: number;
  /** Store in ACID conversation (default: true) */
  trackConversation?: boolean;
  /** Optional metadata */
  metadata?: {
    tags?: string[];
    [key: string]: unknown;
  };
}

/**
 * Result from A2A broadcast
 */
export interface A2ABroadcastResult {
  /** Broadcast message ID */
  messageId: string;
  /** Timestamp when sent */
  sentAt: number;
  /** Array of recipient agent IDs */
  recipients: string[];
  /** Memory IDs in sender's storage (one per recipient) */
  senderMemoryIds: string[];
  /** Memory IDs in receivers' storage (one per recipient) */
  receiverMemoryIds: string[];
  /** Total memories created (sender + receiver for each) */
  memoriesCreated: number;
  /** Conversation IDs (if trackConversation=true) */
  conversationIds?: string[];
}

/**
 * Filters for getConversation
 */
export interface A2AConversationFilters {
  /** Filter by start date */
  since?: Date;
  /** Filter by end date */
  until?: Date;
  /** Minimum importance filter (0-100) */
  minImportance?: number;
  /** Filter by tags */
  tags?: string[];
  /** Filter A2A about specific user */
  userId?: string;
  /** Maximum messages to return (default: 100) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Output format */
  format?: "chronological";
}

/**
 * A2A conversation result
 */
export interface A2AConversation {
  /** The two participants */
  participants: [string, string];
  /** ACID conversation ID (if exists) */
  conversationId?: string;
  /** Total message count (before pagination) */
  messageCount: number;
  /** Conversation messages */
  messages: A2AConversationMessage[];
  /** Time period covered */
  period: {
    start: number;
    end: number;
  };
  /** Tags found in messages */
  tags?: string[];
  /** True if ACID conversation exists for full history */
  canRetrieveFullHistory: boolean;
}

/**
 * Individual message in A2A conversation
 */
export interface A2AConversationMessage {
  /** Sender agent ID */
  from: string;
  /** Receiver agent ID */
  to: string;
  /** Message content */
  message: string;
  /** Importance level */
  importance: number;
  /** Timestamp */
  timestamp: number;
  /** Message ID */
  messageId: string;
  /** Vector memory ID */
  memoryId: string;
  /** ACID message ID (if tracked) */
  acidMessageId?: string;
  /** Tags */
  tags?: string[];
}

/**
 * A2A timeout error
 */
export class A2ATimeoutError extends Error {
  public readonly name = "A2ATimeoutError";

  constructor(
    message: string,
    public readonly messageId: string,
    public readonly timeout: number,
  ) {
    super(message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Coordination: User Operations API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface UserProfile {
  id: string;
  data: Record<string, unknown>;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserVersion {
  version: number;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface DeleteUserOptions {
  /** Enable cascade deletion across all layers (default: false) */
  cascade?: boolean;
  /** Run verification after deletion (default: true) */
  verify?: boolean;
  /** Preview what would be deleted without actually deleting (default: false) */
  dryRun?: boolean;
}

export interface UserDeleteResult {
  userId: string;
  deletedAt: number;

  // Per-layer counts
  conversationsDeleted: number;
  conversationMessagesDeleted: number;
  immutableRecordsDeleted: number;
  mutableKeysDeleted: number;
  vectorMemoriesDeleted: number;
  factsDeleted: number;
  graphNodesDeleted?: number; // Optional if graph not configured

  // Verification
  verification: {
    complete: boolean;
    issues: string[];
  };

  // Summary
  totalDeleted: number;
  deletedLayers: string[];
}

export interface DeletionPlan {
  conversations: Conversation[];
  immutable: ImmutableRecord[];
  mutable: MutableRecord[];
  vector: MemoryEntry[];
  facts: FactRecord[];
  graph: Array<{ nodeId: string; labels: string[] }>;
  userProfile: UserProfile | null;
}

export interface DeletionBackup {
  conversations: Conversation[];
  immutable: ImmutableRecord[];
  mutable: MutableRecord[];
  vector: MemoryEntry[];
  facts: FactRecord[];
  userProfile: UserProfile | null;
}

export interface VerificationResult {
  complete: boolean;
  issues: string[];
}

export interface ListUsersFilter {
  /** Maximum results to return (default: 50, max: 1000) */
  limit?: number;
  /** Skip first N results for pagination (default: 0) */
  offset?: number;
  /** Filter by createdAt > timestamp */
  createdAfter?: number;
  /** Filter by createdAt < timestamp */
  createdBefore?: number;
  /** Filter by updatedAt > timestamp */
  updatedAfter?: number;
  /** Filter by updatedAt < timestamp */
  updatedBefore?: number;
  /** Sort by field (default: "createdAt") */
  sortBy?: "createdAt" | "updatedAt";
  /** Sort order (default: "desc") */
  sortOrder?: "asc" | "desc";
  /** Filter by displayName (client-side, contains match) */
  displayName?: string;
  /** Filter by email (client-side, contains match) */
  email?: string;
}

export interface UserFilters extends ListUsersFilter {}

export interface ListUsersResult {
  /** Array of user profiles */
  users: UserProfile[];
  /** Total count before pagination */
  total: number;
  /** Limit used for this query */
  limit: number;
  /** Offset used for this query */
  offset: number;
  /** Whether there are more results beyond this page */
  hasMore: boolean;
}

export interface ExportUsersOptions {
  filters?: UserFilters;
  format: "json" | "csv";
  /** Include previousVersions array in export */
  includeVersionHistory?: boolean;
  /** Query and include user's conversations */
  includeConversations?: boolean;
  /** Query and include user's memories across all memory spaces */
  includeMemories?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Governance Policies API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ComplianceMode = "GDPR" | "HIPAA" | "SOC2" | "FINRA" | "Custom";
export type ComplianceTemplate = "GDPR" | "HIPAA" | "SOC2" | "FINRA";

export interface GovernancePolicy {
  organizationId?: string;
  memorySpaceId?: string;

  // Layer 1a: Conversations
  conversations: {
    retention: {
      deleteAfter: string; // '7y', '30d', etc.
      archiveAfter?: string;
      purgeOnUserRequest: boolean;
    };
    purging: {
      autoDelete: boolean;
      deleteInactiveAfter?: string;
    };
  };

  // Layer 1b: Immutable
  immutable: {
    retention: {
      defaultVersions: number;
      byType: Record<
        string,
        {
          versionsToKeep: number;
          deleteAfter?: string;
        }
      >;
    };
    purging: {
      autoCleanupVersions: boolean;
      purgeUnusedAfter?: string;
    };
  };

  // Layer 1c: Mutable
  mutable: {
    retention: {
      defaultTTL?: string;
      purgeInactiveAfter?: string;
    };
    purging: {
      autoDelete: boolean;
      deleteUnaccessedAfter?: string;
    };
  };

  // Layer 2: Vector
  vector: {
    retention: {
      defaultVersions: number;
      byImportance: Array<{
        range: [number, number];
        versions: number;
      }>;
      bySourceType?: Record<string, number>;
    };
    purging: {
      autoCleanupVersions: boolean;
      deleteOrphaned: boolean;
    };
  };

  // Cross-layer compliance
  compliance: {
    mode: ComplianceMode;
    dataRetentionYears: number;
    requireJustification: number[];
    auditLogging: boolean;
  };
}

export interface PolicyScope {
  organizationId?: string;
  memorySpaceId?: string;
}

export interface PolicyResult {
  policyId: string;
  appliedAt: number;
  scope: PolicyScope;
  success: boolean;
}

export interface EnforcementOptions {
  layers?: ("conversations" | "immutable" | "mutable" | "vector")[];
  rules?: ("retention" | "purging")[];
  scope?: PolicyScope;
}

export interface EnforcementResult {
  enforcedAt: number;
  versionsDeleted: number;
  recordsPurged: number;
  storageFreed: number; // MB
  affectedLayers: string[];
}

export interface SimulationOptions extends Partial<GovernancePolicy> {}

export interface SimulationResult {
  versionsAffected: number;
  recordsAffected: number;
  storageFreed: number; // MB
  costSavings: number; // USD per month
  breakdown: {
    conversations?: { affected: number; storageMB: number };
    immutable?: { affected: number; storageMB: number };
    mutable?: { affected: number; storageMB: number };
    vector?: { affected: number; storageMB: number };
  };
}

export interface ComplianceReportOptions {
  organizationId?: string;
  memorySpaceId?: string;
  period: {
    start: Date;
    end: Date;
  };
}

export interface ComplianceReport {
  organizationId?: string;
  memorySpaceId?: string;
  period: { start: number; end: number };
  generatedAt: number;

  conversations: {
    total: number;
    deleted: number;
    archived: number;
    complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "WARNING";
  };

  immutable: {
    entities: number;
    totalVersions: number;
    versionsDeleted: number;
    complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "WARNING";
  };

  vector: {
    memories: number;
    versionsDeleted: number;
    orphanedCleaned: number;
    complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "WARNING";
  };

  dataRetention: {
    oldestRecord: number;
    withinPolicy: boolean;
  };

  userRequests: {
    deletionRequests: number;
    fulfilled: number;
    avgFulfillmentTime: string;
  };
}

export interface EnforcementStatsOptions {
  period: string; // "7d", "30d", "90d", "1y"
  organizationId?: string;
  memorySpaceId?: string;
}

export interface EnforcementStats {
  period: { start: number; end: number };

  conversations: {
    purged: number;
    archived: number;
  };

  immutable: {
    versionsDeleted: number;
    entitiesPurged: number;
  };

  vector: {
    versionsDeleted: number;
    memoriesPurged: number;
  };

  mutable: {
    keysDeleted: number;
  };

  storageFreed: number; // MB
  costSavings: number; // USD
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
// Layer 4: Contexts API Types & Options
// ────────────────────────────────────────────────────────────────────────────

export interface ContextVersion {
  version: number;
  status: string;
  data?: Record<string, unknown>;
  timestamp: number;
  updatedBy?: string;
}

export interface CreateContextOptions extends GraphSyncOption {}

export interface UpdateContextOptions extends GraphSyncOption {}

export interface DeleteContextOptions extends GraphSyncOption {}

// ────────────────────────────────────────────────────────────────────────────
// Layer 4: Memory Spaces API Types & Options
// ────────────────────────────────────────────────────────────────────────────

export interface ParticipantUpdates {
  add?: Array<{ id: string; type: string; joinedAt: number }>;
  remove?: string[];
}

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Streaming Types (Enhanced RememberStream API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type {
  // Events & Hooks
  ChunkEvent,
  ProgressEvent,
  StreamCompleteEvent,
  StreamHooks,

  // Metrics
  StreamMetrics,

  // Progressive Storage
  PartialUpdate,
  ProgressiveFact,
  GraphSyncEvent,

  // Error Handling & Recovery
  FailureStrategy,
  ErrorContext,
  StreamError,
  RecoveryOptions,
  RecoveryResult,

  // Resume Capability
  ResumeContext,
  PartialMemoryResult,

  // Chunking
  ChunkStrategy,
  ChunkingConfig,
  ChunkMetadata,
  ContentChunk,

  // Adaptive Processing
  StreamType,
  ProcessingStrategy,

  // Memory Efficiency
  MemoryEfficiencyOptions,
  EmbeddingMergeStrategy,

  // Options & Parameters
  StreamingOptions,
  StreamContext,
  EnhancedRememberStreamParams,
  ProcessedChunk,

  // Enhanced Results
  PerformanceInsights,
  ProgressiveProcessing,
  EnhancedRememberStreamResult,
} from "./streaming";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fact Deduplication Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type {
  DeduplicationStrategy,
  DeduplicationConfig,
  FactCandidate,
  DuplicateResult,
  StoreWithDedupResult,
} from "../facts/deduplication";
