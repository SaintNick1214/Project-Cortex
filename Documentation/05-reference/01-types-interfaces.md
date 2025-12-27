# Types & Interfaces

> **Last Updated**: 2025-12-26

Complete TypeScript type definitions for all Cortex APIs.

## Overview

This document provides the complete TypeScript interfaces for Cortex. All types are exported from the main package:

```typescript
import type {
  // Layer 1: ACID Stores
  Conversation,
  Message,
  ImmutableRecord,
  MutableRecord,

  // Layer 2: Vector
  MemoryEntry,
  MemoryVersion,

  // Entities
  UserProfile,
  Context,
  AgentRegistration,

  // Sessions & Auth (NEW)
  Session,
  AuthContext,

  // Filters
  UniversalFilters,
  ConversationFilters,
  ContextFilters,
  UserFilters,
  SessionFilters,

  // Results
  RememberResult,
  DeleteResult,
  SearchResult,

  // And more...
} from "@cortex-platform/sdk";
```

---

## Layer 1: ACID Stores

### Layer 1a: Conversations

```typescript
interface Conversation {
  // Identity
  conversationId: string;
  type: "user-agent" | "agent-agent";

  // Participants
  participants: UserAgentParticipants | AgentAgentParticipants;

  // Messages
  messages: Message[];
  messageCount: number;

  // Metadata
  metadata: Record<string, any>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

interface UserAgentParticipants {
  userId: string;
  memorySpaceId: string;
}

interface AgentAgentParticipants {
  agent1: string;
  agent2: string;
}

interface Message {
  id: string;

  // User-agent messages
  role?: "user" | "agent" | "system";
  content?: string;
  userId?: string;
  memorySpaceId?: string;

  // Agent-agent messages (A2A)
  type?: "a2a";
  from?: string;
  to?: string;
  text?: string;

  // Common
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

### Layer 1b: Immutable Store

```typescript
interface ImmutableEntry {
  type: string; // Entity type
  id: string; // Logical ID (versioned)
  data: Record<string, any>; // The actual data
  userId?: string; // OPTIONAL: User link (GDPR-enabled)
  metadata?: {
    publishedBy?: string;
    tags?: string[];
    importance?: number; // 0-100
    [key: string]: any;
  };
}

interface ImmutableRecord {
  type: string;
  id: string;
  version: number;
  data: Record<string, any>;
  userId?: string;
  metadata: any;
  createdAt: Date;
  previousVersions: ImmutableVersion[];
}

interface ImmutableVersion {
  version: number;
  data: any;
  userId?: string;
  metadata: any;
  timestamp: Date;
}
```

### Layer 1c: Mutable Store

```typescript
interface MutableRecord {
  namespace: string;
  key: string;
  value: any;
  userId?: string; // OPTIONAL: User link (GDPR-enabled)
  updatedAt: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessed?: Date;
}
```

---

## Layer 2: Vector Index

### MemoryEntry (Core)

```typescript
interface MemoryEntry {
  // Identity
  id: string;
  memorySpaceId: string;
  userId?: string;

  // Content
  content: string;
  contentType: "raw" | "summarized";
  embedding?: number[];

  // Source
  source: MemorySource;

  // Layer 1 References (mutually exclusive)
  conversationRef?: ConversationRef;
  immutableRef?: ImmutableRef;
  mutableRef?: MutableRef;

  // Metadata
  metadata: MemoryMetadata;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  accessCount: number;

  // Versioning
  version: number;
  previousVersions?: MemoryVersion[];
}

interface MemorySource {
  type: "conversation" | "system" | "tool" | "a2a";
  userId?: string;
  userName?: string;
  fromAgent?: string; // For A2A
  toAgent?: string; // For A2A
  timestamp: Date;
}

interface ConversationRef {
  conversationId: string;
  messageIds: string[];
}

interface ImmutableRef {
  type: string;
  id: string;
  version?: number;
}

interface MutableRef {
  namespace: string;
  key: string;
  snapshotValue: any;
  snapshotAt: Date;
}

interface MemoryMetadata {
  importance: number; // 0-100
  tags: string[];
  direction?: "inbound" | "outbound"; // For A2A
  messageId?: string; // For A2A
  contextId?: string; // Link to context
  [key: string]: any;
}

interface MemoryVersion {
  version: number;
  content: string;
  contentType: "raw" | "summarized";
  embedding?: number[];
  conversationRef?: ConversationRef;
  metadata: any;
  timestamp: Date;
  updatedBy?: string;
}
```

---

## Layer 3: Memory API

### Memory Operations

```typescript
interface MemoryInput {
  // Content
  content: string;
  contentType: "raw" | "summarized";

  // Embedding
  embedding?: number[];

  // Context
  userId?: string;

  // Source
  source: MemorySource;

  // Layer 1 References (optional, mutually exclusive)
  conversationRef?: ConversationRef;
  immutableRef?: ImmutableRef;
  mutableRef?: MutableRef;

  // Metadata
  metadata: MemoryMetadata;
}

interface RememberParams {
  memorySpaceId: string;
  conversationId: string;
  userMessage: string;
  agentResponse: string;
  userId: string;
  userName: string;

  // Optional
  extractContent?: (
    userMessage: string,
    agentResponse: string,
  ) => Promise<string | null>;
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Cloud Mode
  autoEmbed?: boolean;
  autoSummarize?: boolean;

  // Metadata
  importance?: number;
  tags?: string[];
}

interface RememberResult {
  conversation: {
    messageIds: string[];
    conversationId: string;
  };
  memories: MemoryEntry[];
}

interface MemoryUpdate {
  content?: string;
  contentType?: "raw" | "summarized";
  embedding?: number[];
  conversationRef?: ConversationRef;
  metadata?: Partial<MemoryMetadata>;
}
```

---

## Entity Types

### User Profile

```typescript
interface UserProfile {
  // Identity
  id: string;

  // User Data (flexible)
  data: Record<string, any>;

  // System fields
  version: number;
  createdAt: Date;
  updatedAt: Date;
  previousVersions?: UserVersion[];
}

interface UserVersion {
  version: number;
  data: Record<string, any>;
  timestamp: Date;
}

interface UserProfileUpdate {
  data: Record<string, any>;
}
```

### Session (NEW)

```typescript
interface Session {
  // Identity
  sessionId: string;
  userId: string;
  tenantId?: string;
  memorySpaceId?: string;

  // Session state
  status: "active" | "idle" | "ended";
  startedAt: number;
  lastActiveAt: number;
  endedAt?: number;
  expiresAt?: number;

  // Fully extensible metadata
  metadata?: Record<string, unknown>;

  // Stats
  messageCount: number;
  memoryCount: number;
}

interface CreateSessionParams {
  userId: string;
  tenantId?: string;
  memorySpaceId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: number;
}

interface SessionFilters {
  userId?: string;
  tenantId?: string;
  status?: "active" | "idle" | "ended";
  startedAfter?: number;
  startedBefore?: number;
  limit?: number;
  offset?: number;
}
```

### Auth Context (NEW)

```typescript
interface AuthContext {
  // Required
  userId: string;

  // Standard optional fields
  tenantId?: string;
  organizationId?: string;
  sessionId?: string;
  authProvider?: string;
  authMethod?: "oauth" | "api_key" | "jwt" | "session";
  authenticatedAt?: number;

  // Fully extensible
  claims?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

### Context

```typescript
interface Context {
  // Identity
  id: string;
  parentId?: string;
  rootId: string;

  // Purpose
  purpose: string;
  description?: string;

  // Ownership
  memorySpaceId: string;
  userId?: string;

  // Hierarchy
  depth: number;
  childIds: string[];
  participants: string[];

  // Conversation link
  conversationRef?: ConversationRef;

  // Data
  data: Record<string, any>;

  // Status
  status: "active" | "completed" | "cancelled" | "blocked";

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Versioning
  version: number;
  previousVersions?: ContextVersion[];
}

interface ContextInput {
  purpose: string;
  memorySpaceId: string;
  parentId?: string;
  userId?: string;
  conversationRef?: ConversationRef;
  data?: Record<string, any>;
  status?: "active" | "completed" | "cancelled" | "blocked";
  description?: string;
}

interface ContextVersion {
  version: number;
  status: string;
  data: any;
  timestamp: Date;
  updatedBy: string;
}

interface ContextWithChain {
  current: Context;
  parent?: Context;
  root: Context;
  children: Context[];
  siblings: Context[];
  ancestors: Context[];
  depth: number;
  conversation?: Conversation;
  triggerMessages?: Message[];
}
```

### Agent Registration

```typescript
interface AgentRegistration {
  id: string;
  name: string;
  description?: string;

  capabilities?: string[];
  metadata: Record<string, any>;

  config: {
    memoryVersionRetention?: number;
    [key: string]: any;
  };

  stats: {
    totalMemories: number;
    totalConversations: number;
    lastActive?: Date;
  };

  registeredAt: Date;
  updatedAt: Date;
}
```

---

## Helper APIs

### A2A Communication

```typescript
interface A2ASendParams {
  from: string;
  to: string;
  message: string;
  userId?: string;
  contextId?: string;
  importance?: number;
  trackConversation?: boolean;
  autoEmbed?: boolean;
  metadata?: {
    tags?: string[];
    priority?: "low" | "normal" | "high" | "urgent";
    [key: string]: any;
  };
}

interface A2AMessage {
  messageId: string;
  sentAt: Date;
  conversationId?: string;
  acidMessageId?: string;
  senderMemoryId: string;
  receiverMemoryId: string;
}

interface A2ARequestParams {
  from: string;
  to: string;
  message: string;
  timeout?: number;
  retries?: number;
  userId?: string;
  contextId?: string;
  importance?: number;
}

interface A2AResponse {
  response: string;
  messageId: string;
  responseMessageId: string;
  respondedAt: Date;
  responseTime: number;
}

interface A2ABroadcastParams {
  from: string;
  to: string[];
  message: string;
  userId?: string;
  contextId?: string;
  importance?: number;
  trackConversation?: boolean;
  metadata?: Record<string, any>;
}

interface A2ABroadcastResult {
  messageId: string;
  sentAt: Date;
  recipients: string[];
  senderMemoryIds: string[];
  receiverMemoryIds: string[];
  memoriesCreated: number;
  conversationIds?: string[];
}

interface A2AConversation {
  participants: [string, string];
  conversationId?: string;
  messageCount: number;
  messages: A2AConversationMessage[];
  period: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  canRetrieveFullHistory: boolean;
}

interface A2AConversationMessage {
  from: string;
  to: string;
  message: string;
  importance: number;
  timestamp: Date;
  messageId: string;
  memoryId: string;
  acidMessageId?: string;
  tags?: string[];
}
```

---

## Universal Filters

### Memory Filters

```typescript
interface UniversalFilters {
  // Identity
  userId?: string;

  // Tags
  tags?: string[];
  tagMatch?: "any" | "all";

  // Importance (0-100)
  importance?: number | RangeQuery;
  minImportance?: number;

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastAccessedBefore?: Date;
  lastAccessedAfter?: Date;

  // Access patterns
  accessCount?: number | RangeQuery;
  version?: number | RangeQuery;

  // Source
  "source.type"?: "conversation" | "system" | "tool" | "a2a";

  // Content
  contentType?: "raw" | "summarized";

  // ACID link
  "conversationRef.conversationId"?: string;

  // Metadata
  metadata?: Record<string, any>;

  // Results
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface RangeQuery {
  $gte?: number;
  $lte?: number;
  $eq?: number;
  $ne?: number;
  $gt?: number;
  $lt?: number;
}
```

### Conversation Filters

```typescript
interface ConversationFilters {
  // Type
  type?: "user-agent" | "agent-agent";

  // Participants
  userId?: string;
  memorySpaceId?: string;
  "participants.agent1"?: string;
  "participants.agent2"?: string;

  // Metadata
  metadata?: Record<string, any>;

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastMessageBefore?: Date;
  lastMessageAfter?: Date;

  // Message count
  messageCount?: number | RangeQuery;
}
```

### Context Filters

```typescript
interface ContextFilters {
  // Identity
  memorySpaceId?: string;
  userId?: string;

  // Hierarchy
  parentId?: string;
  rootId?: string;
  depth?: number | RangeQuery;

  // Status
  status?: "active" | "completed" | "cancelled" | "blocked";

  // Purpose
  purposeContains?: string;

  // Data
  "data.importance"?: number | RangeQuery;
  "data.tags"?: string[];
  data?: Record<string, any>;

  // Conversation
  "conversationRef.conversationId"?: string;

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  completedBefore?: Date;
  completedAfter?: Date;

  // Version
  version?: number | RangeQuery;
}
```

### User Filters

```typescript
interface UserFilters {
  // Identity
  email?: string;
  displayName?: string;

  // Data (nested)
  "data.preferences.theme"?: "light" | "dark";
  "data.tier"?: "free" | "pro" | "enterprise";
  data?: Record<string, any>;

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version
  version?: number | RangeQuery;
}
```

### Immutable Filters

```typescript
interface ImmutableFilters {
  type?: string;
  id?: string;
  userId?: string;
  "data.field"?: any;
  "metadata.field"?: any;
  createdBefore?: Date;
  createdAfter?: Date;
  version?: number | RangeQuery;
}
```

### Mutable Filters

```typescript
interface MutableFilters {
  key?: string;
  keyPrefix?: string;
  userId?: string;
  "value.field"?: any;
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  lastAccessedBefore?: Date;
  lastAccessedAfter?: Date;
}
```

---

## Common Options

### Search Options

```typescript
interface SearchOptions {
  // Layer enrichment
  enrichConversation?: boolean;

  // Semantic search
  embedding?: number[];

  // Filtering (extends UniversalFilters)
  userId?: string;
  tags?: string[];
  importance?: number | RangeQuery;
  minImportance?: number;

  // Pagination
  limit?: number;
  offset?: number;
  minScore?: number;

  // Sorting
  sortBy?: "score" | "createdAt" | "updatedAt" | "accessCount" | "importance";
  sortOrder?: "asc" | "desc";

  // Strategy
  strategy?: "auto" | "semantic" | "keyword" | "recent";
  boostImportance?: boolean;
  boostRecent?: boolean;
  boostPopular?: boolean;
}
```

### List Options

```typescript
interface ListOptions extends UniversalFilters {
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "accessCount" | "importance";
  sortOrder?: "asc" | "desc";
}
```

### Update Options

```typescript
interface UpdateOptions {
  skipVersioning?: boolean;
  versionReason?: string;
  merge?: boolean;
}

interface UpdateManyOptions {
  skipVersioning?: boolean;
  dryRun?: boolean;
}
```

### Delete Options

```typescript
interface DeleteOptions {
  dryRun?: boolean;
  requireConfirmation?: boolean;
  confirmationThreshold?: number;
}

interface ForgetOptions {
  deleteConversation?: boolean;
  deleteEntireConversation?: boolean;
}
```

### Export Options

```typescript
interface ExportOptions extends UniversalFilters {
  format: "json" | "csv";
  outputPath?: string;
  includeVersionHistory?: boolean;
  includeConversationContext?: boolean;
}
```

---

## Result Types

### Deletion Results

```typescript
interface DeletionResult {
  deleted: number;
  memoryId?: string;
  memoryIds?: string[];
  deletedFrom?: "vector" | "both";
  restorable: boolean;
  affectedUsers?: string[];
  wouldDelete?: number;
  memories?: MemoryEntry[];
}

interface ForgetResult {
  memoryDeleted: boolean;
  conversationDeleted: boolean;
  messagesDeleted: number;
  restorable: boolean;
}

interface DeleteResult {
  profileDeleted?: boolean;
  userId?: string;
  deletedAt: Date;
  auditReason?: string;

  // Layer deletions
  conversationsDeleted?: number;
  totalMessagesDeleted?: number;
  immutableRecordsDeleted?: number;
  immutableTypes?: string[];
  mutableRecordsDeleted?: number;
  mutableNamespaces?: string[];
  vectorMemoriesDeleted?: number;
  agentsAffected?: string[];

  // Summary
  totalRecordsDeleted?: number;
  restorable: boolean;
}
```

### List Results

```typescript
interface ListResult {
  memories?: MemoryEntry[];
  conversations?: Conversation[];
  contexts?: Context[];
  users?: UserProfile[];
  records?: ImmutableRecord[] | MutableRecord[];

  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

### Update Results

```typescript
interface UpdateManyResult {
  updated: number;
  memoryIds?: string[];
  userIds?: string[];
  contextIds?: string[];
  newVersions?: number[];
  wouldUpdate?: number;
}
```

### Search Results

```typescript
interface SearchResult extends MemoryEntry {
  score: number;
  strategy: "semantic" | "keyword" | "recent";
  highlights?: string[];
  explanation?: string;
}

interface EnrichedMemory {
  memory: MemoryEntry;
  conversation?: Conversation;
  sourceMessages?: Message[];
}
```

---

## Governance Types

```typescript
interface GovernancePolicy {
  organizationId?: string;
  memorySpaceId?: string;

  // Layer 1a: Conversations
  conversations: {
    retention: {
      deleteAfter: string; // e.g., '7y'
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
      byType: Record<string, { versionsToKeep: number }>;
    };
    purging: {
      autoCleanupVersions: boolean;
    };
  };

  // Layer 1c: Mutable
  mutable: {
    retention: {
      defaultTTL: string | null;
      purgeInactiveAfter?: string;
    };
    purging: {
      autoDelete: boolean;
    };
  };

  // Layer 2: Vector
  vector: {
    retention: {
      defaultVersions: number;
      byImportance: ImportanceRetentionRule[];
      bySourceType: Record<string, number>;
    };
    purging: {
      autoCleanupVersions: boolean;
      deleteOrphaned: boolean;
    };
  };

  // Cross-layer
  compliance: {
    mode: "GDPR" | "HIPAA" | "SOC2" | "Custom";
    dataRetentionYears: number;
    requireJustification: [number, number];
    auditLogging: boolean;
  };
}

interface ImportanceRetentionRule {
  range: [number, number];
  versions: number;
}
```

---

## Error Types

```typescript
class CortexError extends Error {
  code: CortexErrorCode;
  details?: any;

  constructor(code: CortexErrorCode, message?: string, details?: any);
}

type CortexErrorCode =
  // General
  | "CONVEX_ERROR"
  | "INVALID_INPUT"

  // Memory
  | "INVALID_AGENT_ID"
  | "INVALID_CONTENT"
  | "INVALID_IMPORTANCE"
  | "INVALID_EMBEDDING_DIMENSION"
  | "MEMORY_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "PERMISSION_DENIED"

  // User
  | "INVALID_USER_ID"
  | "USER_NOT_FOUND"
  | "INVALID_PROFILE_DATA"

  // Context
  | "INVALID_PURPOSE"
  | "CONTEXT_NOT_FOUND"
  | "PARENT_NOT_FOUND"
  | "HAS_CHILDREN"
  | "INVALID_STATUS"

  // Conversation
  | "INVALID_CONVERSATION_ID"
  | "CONVERSATION_NOT_FOUND"
  | "INVALID_TYPE"
  | "INVALID_PARTICIPANTS"
  | "INVALID_MESSAGE"

  // Immutable
  | "INVALID_TYPE"
  | "INVALID_ID"
  | "DATA_TOO_LARGE"
  | "NOT_FOUND"

  // Mutable
  | "INVALID_NAMESPACE"
  | "INVALID_KEY"
  | "VALUE_TOO_LARGE"
  | "KEY_NOT_FOUND"
  | "UPDATE_FAILED"
  | "TRANSACTION_FAILED"

  // Operations
  | "INVALID_FILTERS"
  | "INVALID_PAGINATION"
  | "INVALID_QUERY"
  | "INVALID_OPTIONS"
  | "INVALID_UPDATE"
  | "INVALID_FORMAT"
  | "INVALID_TIMESTAMP"

  // Deletion
  | "DELETION_FAILED"
  | "DELETION_CANCELLED"
  | "PURGE_FAILED"
  | "PURGE_CANCELLED"

  // Export
  | "EXPORT_FAILED"

  // A2A
  | "PUBSUB_NOT_CONFIGURED"
  | "EMPTY_RECIPIENTS"

  // Matching
  | "NO_MEMORIES_MATCHED"
  | "NO_USERS_MATCHED"

  // Cloud Mode
  | "CLOUD_MODE_REQUIRED"
  | "STRATEGY_FAILED";

class A2ATimeoutError extends Error {
  messageId: string;
  timeout: number;

  constructor(message: string, messageId: string, timeout: number);
}
```

---

## Configuration Types

```typescript
interface CortexConfig {
  // Connection
  convexUrl: string;
  mode?: "direct" | "cloud";
  apiKey?: string; // Cloud Mode only

  // Versioning
  defaultVersionRetention?: number;

  // Validation
  userProfileValidation?: {
    requiredFields?: string[];
    maxDisplayNameLength?: number;
    emailRequired?: boolean;
    validateEmail?: boolean;
    allowCustomPreferences?: boolean;
    allowCustomMetadata?: boolean;
  };

  // Retention (Layer specific)
  immutableRetention?: {
    defaultVersions: number;
    byType: Record<string, number>;
  };

  mutableRetention?: {
    defaultTTL: string | null;
    purgeInactiveAfter?: string;
  };

  // Callbacks
  onBeforeStore?: (
    memorySpaceId: string,
    entry: MemoryInput,
  ) => Promise<StoreDecision>;
  onAfterRetrieve?: (memorySpaceId: string, memory: MemoryEntry) => void;
  onVersionCreated?: (
    memorySpaceId: string,
    memoryId: string,
    newVersion: MemoryVersion,
    oldVersion?: MemoryVersion,
  ) => void;
}

interface StoreDecision {
  action: "create" | "update";
  memoryId?: string;
}
```

---

## Utility Types

### Pagination

```typescript
interface PaginationOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

### Versioning

```typescript
interface Versioned {
  version: number;
  previousVersions?: VersionHistory[];
  createdAt: Date;
  updatedAt: Date;
}

interface VersionHistory {
  version: number;
  timestamp: Date;
  [key: string]: any;
}
```

### GDPR

```typescript
interface GDPRDeleteOptions {
  cascade?: boolean;
  deleteFromConversations?: boolean;
  deleteFromImmutable?: boolean;
  deleteFromMutable?: boolean;
  deleteFromVector?: boolean;
  auditReason?: string;
}

interface GDPRExportOptions {
  includeMemories?: boolean;
  includeConversations?: boolean;
  includeVersionHistory?: boolean;
  format: "json" | "csv";
  outputPath?: string;
}
```

---

## Type Guards

Cortex provides type guards for runtime type checking:

```typescript
function isMemoryEntry(obj: any): obj is MemoryEntry {
  return (
    typeof obj === "object" &&
    "id" in obj &&
    "memorySpaceId" in obj &&
    "content" in obj &&
    "source" in obj &&
    "metadata" in obj
  );
}

function isConversation(obj: any): obj is Conversation {
  return (
    typeof obj === "object" &&
    "conversationId" in obj &&
    "type" in obj &&
    "participants" in obj &&
    "messages" in obj
  );
}

function isUserProfile(obj: any): obj is UserProfile {
  return (
    typeof obj === "object" && "id" in obj && "data" in obj && "version" in obj
  );
}

function isContext(obj: any): obj is Context {
  return (
    typeof obj === "object" &&
    "id" in obj &&
    "purpose" in obj &&
    "memorySpaceId" in obj &&
    "status" in obj
  );
}

function isCortexError(error: any): error is CortexError {
  return error instanceof CortexError;
}

function isA2ATimeoutError(error: any): error is A2ATimeoutError {
  return error instanceof A2ATimeoutError;
}
```

---

## Generic Types

### Builders

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type Nullable<T> = T | null;

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };
```

### Promises

```typescript
type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

type PromiseOr<T> = T | Promise<T>;
```

---

## Usage Examples

### Type-Safe Operations

```typescript
import type { MemoryEntry, SearchOptions, UniversalFilters } from '@cortex-platform/sdk';

// Type-safe search
const options: SearchOptions = {
  embedding: [0.1, 0.2, ...],
  userId: 'user-123',
  minImportance: 50,
  limit: 10,
};

const results = await cortex.memory.search('agent-1', 'query', options);

// Type guard
results.forEach(memory => {
  if (isMemoryEntry(memory)) {
    console.log(memory.content);
    console.log(memory.metadata.importance);
  }
});
```

### Generic Helpers

```typescript
// Generic search function
async function searchEntity<T>(
  searchFn: (filters: any) => Promise<T[]>,
  filters: any,
): Promise<T[]> {
  return await searchFn(filters);
}

// Usage
const memories = await searchEntity<MemoryEntry>(
  (f) => cortex.memory.search("agent-1", "*", f),
  { userId: "user-123" },
);
```

### Custom Extensions

```typescript
// Extend UserProfile for your app
interface CustomUserProfile extends UserProfile {
  data: {
    displayName: string;
    email: string;
    preferences: {
      theme: "light" | "dark";
      language: "en" | "es" | "fr";
    };
    tier: "free" | "pro" | "enterprise";
  };
}

// Type-safe usage
const user = await cortex.users.get<CustomUserProfile>("user-123");
console.log(user.data.preferences.theme); // Typed!
```

---

## Namespace Organization

All Cortex types are organized by namespace:

```typescript
namespace Cortex {
  // Layer 1
  namespace Conversations {
    export type Conversation = ...;
    export type Message = ...;
    export type ConversationFilters = ...;
  }

  namespace Immutable {
    export type ImmutableRecord = ...;
    export type ImmutableVersion = ...;
    export type ImmutableFilters = ...;
  }

  namespace Mutable {
    export type MutableRecord = ...;
    export type MutableFilters = ...;
  }

  // Layer 2
  namespace Vector {
    export type MemoryEntry = ...;
    export type MemoryVersion = ...;
  }

  // Layer 3
  namespace Memory {
    export type RememberParams = ...;
    export type RememberResult = ...;
  }

  // Entities
  namespace Users {
    export type UserProfile = ...;
    export type UserVersion = ...;
  }

  namespace Contexts {
    export type Context = ...;
    export type ContextVersion = ...;
  }

  namespace Agents {
    export type AgentRegistration = ...;
  }

  // Helpers
  namespace A2A {
    export type A2AMessage = ...;
    export type A2AResponse = ...;
  }

  // Common
  export type UniversalFilters = ...;
  export type RangeQuery = ...;
  export type CortexError = ...;
}
```

---

## Import Patterns

### Named Imports (Recommended)

```typescript
import type {
  MemoryEntry,
  UserProfile,
  Context,
  UniversalFilters,
  SearchOptions,
} from "@cortex-platform/sdk";
```

### Namespace Import

```typescript
import type { Cortex } from '@cortex-platform/sdk';

const memory: Cortex.Memory.MemoryEntry = ...;
const user: Cortex.Users.UserProfile = ...;
```

### Type-Only Import

```typescript
import type * as CortexTypes from '@cortex-platform/sdk';

const filters: CortexTypes.UniversalFilters = { ... };
```

---

## Next Steps

- **[Error Handling](./02-error-handling.md)** - Error codes and debugging
- **[Memory Operations API](../03-api-reference/02-memory-operations.md)** - Using these types in practice

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
