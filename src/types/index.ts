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
  memorySpaceId: string;
  participantId?: string; // Hive Mode tracking
  conversationId: string;
  userMessage: string;
  responseStream: ReadableStream<string> | AsyncIterable<string>;
  userId: string;
  userName: string;

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

export interface AgentFilters {
  metadata?: Record<string, unknown>;
  name?: string;
  capabilities?: string[];
  status?: "active" | "inactive" | "archived";
  registeredAfter?: number;
  registeredBefore?: number;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "registeredAt" | "lastActive";
  sortOrder?: "asc" | "desc";
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
  limit?: number;
  offset?: number;
}

export interface UserFilters {
  limit?: number;
}

export interface ExportUsersOptions {
  filters?: UserFilters;
  format: "json" | "csv";
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
