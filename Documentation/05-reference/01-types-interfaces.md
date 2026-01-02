# Types & Interfaces Reference

> **Last Updated**: January 1, 2026
> **SDK Version**: 0.27.0
> **Source**: `src/types/index.ts`

## Overview

Complete TypeScript type reference for the Cortex SDK. All type definitions are extracted directly from the SDK source code and represent the authoritative type definitions.

**Import Types:**

```typescript
import type {
  // Core entities
  Conversation,
  Message,
  MemoryEntry,
  UserProfile,
  Context,
  Session,
  Agent,
  
  // Facts
  FactRecord,
  StoreFactParams,
  
  // Filters
  UniversalFilters,
  MemoryFilters,
  ConversationFilters,
  
  // Results
  RememberResult,
  SearchResult,
  RememberStreamResult,
  
  // Options
  RememberParams,
  SearchOptions,
  RecallParams,
  
  // And all other types...
} from '@cortexmemory/sdk';
```

---

## Table of Contents

### Core Entities
- [Conversation](#conversation) - ACID conversation records
- [Message](#message) - Individual messages within conversations
- [MemoryEntry](#memoryentry) - Vector memory entries
- [UserProfile](#userprofile) - User profile records
- [FactRecord](#factrecord) - Extracted facts
- [ImmutableRecord](#immutablerecord) - Immutable versioned entities
- [MutableRecord](#mutablerecord) - Mutable key-value storage
- [MemorySpace](#memoryspace) - Memory space registry
- [RegisteredAgent](#registeredagent) - Agent registry
- [Session](#session) - User session management

### Orchestration Types
- [RememberParams](#rememberparams) - remember() parameters
- [RememberResult](#rememberresult) - remember() result
- [RememberStreamParams](#rememberstreamparams) - rememberStream() parameters
- [RememberStreamResult](#rememberstreamresult) - rememberStream() result
- [RecallParams](#recallparams) - recall() parameters
- [RecallResult](#recallresult) - recall() result
- [ForgetOptions](#forgetoptions) - forget() options

### Filter Types
- [ListConversationsFilter](#listconversationsfilter)
- [ListMemoriesFilter](#listmemoriesfilter)
- [ListFactsFilter](#listfactsfilter)
- [SearchMemoriesOptions](#searchmemoriesoptions)
- [SearchFactsOptions](#searchfactsoptions)

### A2A Communication
- [A2ASendParams](#a2asendparams)
- [A2AMessage](#a2amessage)
- [A2ARequestParams](#a2arequestparams)
- [A2AResponse](#a2aresponse)
- [A2ABroadcastParams](#a2abroadcastparams)

### Governance & Policies
- [GovernancePolicy](#governancepolicy)
- [SessionPolicy](#sessionpolicy)
- [ComplianceMode](#compliancemode)

### Graph Integration
- [GraphSyncOption](#graphsyncoption)
- [RecallParams (with graph)](#recallparams)

### Observer Pattern
- [OrchestrationObserver](#orchestrationobserver)
- [LayerEvent](#layerevent)
- [OrchestrationSummary](#orchestrationsummary)

### Resilience Types
- [ResilienceConfig](#resilienceconfig)
- [Priority](#priority)
- [CircuitState](#circuitstate)

### Enums & Literals
- [ConversationType](#conversationtype)
- [SourceType](#sourcetype)
- [ContentType](#contenttype)
- [FactType](#facttype)
- [SkippableLayer](#skippablelayer)

---

## Detailed Type Definitions

### Conversation

**Layer 1a: ACID Conversations**

```typescript
interface Conversation {
  _id: string;
  conversationId: string;
  memorySpaceId: string; // Memory space isolation
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
  participantId?: string; // Hive Mode tracking
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
```

**Used in:**
- [Conversation Operations API](../03-api-reference/03-conversation-operations.md)
- [Conversation History](../02-core-features/06-conversation-history.md)

**Related types:**
- [Message](#message)
- [ConversationType](#conversationtype)

---

### Message

```typescript
interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: number;
  participantId?: string; // Hive Mode: which participant sent this
  metadata?: Record<string, unknown>;
}
```

**Used in:**
- [Conversation](#conversation)
- [Conversation Operations API](../03-api-reference/03-conversation-operations.md)

---

### MemoryEntry

**Layer 2: Vector Memory**

```typescript
interface MemoryEntry {
  _id: string;
  memoryId: string;
  memorySpaceId: string;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
  participantId?: string; // Hive Mode
  userId?: string; // For user-owned memories
  agentId?: string; // For agent-owned memories
  content: string;
  contentType: ContentType;
  embedding?: number[];
  sourceType: SourceType;
  sourceUserId?: string;
  sourceUserName?: string;
  sourceTimestamp: number;
  messageRole?: "user" | "agent" | "system"; // For semantic search weighting
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
```

**Used in:**
- [Memory Operations API](../03-api-reference/02-memory-operations.md)
- [Semantic Search](../02-core-features/02-semantic-search.md)

**Related types:**
- [ContentType](#contenttype)
- [SourceType](#sourcetype)
- [ConversationRef](#conversationref)
- [FactsRef](#factsref)

---

### FactRecord

**Layer 3: Facts Store**

```typescript
interface FactRecord {
  _id: string;
  factId: string;
  memorySpaceId: string;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
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
```

**Used in:**
- [Facts Operations API](../03-api-reference/12-facts-operations.md)
- [Fact Extraction](../02-core-features/08-fact-extraction.md)
- [Fact Integration](../02-core-features/11-fact-integration.md)

---

### UserProfile

```typescript
interface UserProfile {
  id: string;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
  data: Record<string, unknown>;
  version: number;
  createdAt: number;
  updatedAt: number;
}
```

**Used in:**
- [User Operations API](../03-api-reference/04-user-operations.md)
- [User Profiles](../02-core-features/03-user-profiles.md)

---

### ImmutableRecord

**Layer 1b: Immutable Store**

```typescript
interface ImmutableRecord {
  _id: string;
  type: string;
  id: string;
  data: Record<string, unknown>;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
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
```

**Used in:**
- [Immutable Store API](../03-api-reference/07-immutable-store-api.md)

**Related types:**
- [ImmutableVersion](#immutableversion)

---

### MutableRecord

**Layer 1c: Mutable Store**

```typescript
interface MutableRecord {
  _id: string;
  namespace: string;
  key: string;
  value: unknown;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
```

**Used in:**
- [Mutable Store API](../03-api-reference/08-mutable-store-api.md)

---

### MemorySpace

```typescript
interface MemorySpace {
  _id: string;
  memorySpaceId: string;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
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
```

**Used in:**
- [Memory Space Operations API](../03-api-reference/11-memory-space-operations.md)
- [Memory Spaces](../02-core-features/01-memory-spaces.md)

---

### RegisteredAgent

```typescript
interface RegisteredAgent {
  id: string;
  tenantId?: string; // Multi-tenancy: SaaS platform isolation
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
```

**Used in:**
- [Agent Management API](../03-api-reference/09-agent-management.md)

**Related types:**
- [AgentStats](#agentstats)

---

### Session

```typescript
type SessionStatus = "active" | "idle" | "ended";

interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  sessionName?: string;
  [key: string]: unknown;
}

interface Session {
  _id: string;
  sessionId: string;
  tenantId?: string;
  userId?: string;
  participantId?: string;
  memorySpaceId?: string;
  status: SessionStatus;
  startedAt: number;
  lastActivityAt: number;
  endedAt?: number;
  expiresAt?: number;
  metadata?: SessionMetadata;
  createdAt: number;
  updatedAt: number;
}
```

**Used in:**
- [Sessions Operations API](../03-api-reference/14-sessions-operations.md)
- [Sessions Management](../02-core-features/14-sessions-management.md)

---

## Orchestration Types

### RememberParams

**Parameters for memory.remember() - the primary orchestration API**

```typescript
interface RememberParams {
  /**
   * Memory space for isolation. If not provided, defaults to 'default'
   * with a warning. Auto-registers the memory space if it doesn't exist.
   */
  memorySpaceId?: string;

  /**
   * Multi-tenancy: SaaS platform isolation.
   * When provided, all data is scoped to this tenant.
   * Note: If using authContext, tenantId is auto-injected unless explicitly provided here.
   */
  tenantId?: string;

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

  /**
   * Observer for real-time orchestration monitoring.
   *
   * Provides callbacks for tracking layer-by-layer progress during
   * the remember() orchestration flow. Integration-agnostic.
   */
  observer?: OrchestrationObserver;
}
```

**Used in:**
- [Memory Operations API](../03-api-reference/02-memory-operations.md#remember)
- [Memory Orchestration](../02-core-features/00-memory-orchestration.md)

**Related types:**
- [SkippableLayer](#skippablelayer)
- [OrchestrationObserver](#orchestrationobserver)
- [RememberResult](#rememberresult)

---

### RememberResult

```typescript
interface RememberResult {
  conversation: {
    messageIds: string[];
    conversationId: string;
  };
  memories: MemoryEntry[];
  facts: FactRecord[];

  /**
   * Belief revision actions taken for each extracted fact (v0.24.0+)
   *
   * Only populated when belief revision is enabled (default when LLM configured).
   * Each entry describes what action was taken for a fact and why.
   */
  factRevisions?: Array<{
    /** Action taken: ADD (new), UPDATE (merged), SUPERSEDE (replaced), NONE (skipped) */
    action: "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";
    /** The resulting fact (or existing fact for NONE) */
    fact: FactRecord;
    /** Facts that were superseded by this action */
    superseded?: FactRecord[];
    /** Reason for the action from LLM or heuristics */
    reason?: string;
  }>;
}
```

**Used in:**
- [Memory Operations API](../03-api-reference/02-memory-operations.md#remember)

**Related types:**
- [MemoryEntry](#memoryentry)
- [FactRecord](#factrecord)

---

### RecallParams

**Parameters for memory.recall() - unified context retrieval**

```typescript
interface RecallParams {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REQUIRED - Just these two for basic usage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Memory space to search in */
  memorySpaceId: string;

  /** Natural language query */
  query: string;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OPTIONAL - All have sensible defaults for AI chatbot use cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Pre-computed embedding for semantic search (recommended for best results) */
  embedding?: number[];

  /** Filter by user ID (common in H2A chatbots) */
  userId?: string;

  /** Filter by tenant ID for multi-tenancy (SaaS platform isolation) */
  tenantId?: string;

  /**
   * Source selection - ALL ENABLED BY DEFAULT.
   * Only specify to DISABLE sources.
   */
  sources?: {
    /** Search vector memories (Layer 2). Default: true */
    vector?: boolean;
    /** Search facts directly (Layer 3). Default: true */
    facts?: boolean;
    /** Query graph for relationships. Default: true if graph configured */
    graph?: boolean;
  };

  /**
   * Graph expansion configuration - ENABLED BY DEFAULT if graph configured.
   * Graph is the key to relational context discovery.
   */
  graphExpansion?: {
    /** Enable graph expansion. Default: true if graph configured */
    enabled?: boolean;
    /** Maximum traversal depth. Default: 2 */
    maxDepth?: number;
    /** Relationship types to follow. Default: all types */
    relationshipTypes?: string[];
    /** Expand from discovered facts. Default: true */
    expandFromFacts?: boolean;
    /** Expand from discovered memories. Default: true */
    expandFromMemories?: boolean;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FILTERING (optional refinement)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Minimum importance score (0-100) */
  minImportance?: number;

  /** Minimum confidence for facts (0-100) */
  minConfidence?: number;

  /** Filter by tags */
  tags?: string[];

  /** Only include items created after this date */
  createdAfter?: Date;

  /** Only include items created before this date */
  createdBefore?: Date;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESULT OPTIONS - OPTIMIZED FOR LLM INJECTION BY DEFAULT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Maximum number of results. Default: 20 */
  limit?: number;

  /** Enrich with ACID conversation data. Default: true */
  includeConversation?: boolean;

  /** Generate LLM-ready context string. Default: true */
  formatForLLM?: boolean;
}
```

**Used in:**
- [Memory Operations API](../03-api-reference/02-memory-operations.md#recall)
- [Semantic Search](../02-core-features/02-semantic-search.md)
- [Graph Integration](../02-core-features/16-graph-integration.md)

**Related types:**
- [RecallResult](#recallresult)
- [RecallItem](#recallitem)

---

### RecallResult

```typescript
interface RecallResult {
  /** Unified results (merged, deduped, ranked) */
  items: RecallItem[];

  /** Breakdown by source */
  sources: RecallSourceBreakdown;

  /**
   * Formatted context for LLM injection.
   * Present when formatForLLM: true (default).
   */
  context?: string;

  /** Total number of results before limit */
  totalResults: number;

  /** Query execution time in milliseconds */
  queryTimeMs: number;

  /** Whether graph expansion was applied */
  graphExpansionApplied: boolean;
}
```

**Related types:**
- [RecallItem](#recallitem)
- [RecallSourceBreakdown](#recallsourcebreakdown)

---

## Observer Pattern Types

### OrchestrationObserver

**Integration-agnostic orchestration monitoring**

```typescript
interface OrchestrationObserver {
  /**
   * Called when orchestration starts
   */
  onOrchestrationStart?: (orchestrationId: string) => void | Promise<void>;

  /**
   * Called when a layer's status changes
   */
  onLayerUpdate?: (event: LayerEvent) => void | Promise<void>;

  /**
   * Called when orchestration completes (all layers done)
   */
  onOrchestrationComplete?: (
    summary: OrchestrationSummary,
  ) => void | Promise<void>;
}
```

**Used in:**
- [RememberParams](#rememberparams)
- [RememberStreamParams](#rememberstreamparams)
- [Memory Orchestration](../02-core-features/00-memory-orchestration.md)

**Related types:**
- [LayerEvent](#layerevent)
- [OrchestrationSummary](#orchestrationsummary)

---

### LayerEvent

```typescript
type MemoryLayer =
  | "memorySpace"
  | "user"
  | "agent"
  | "conversation"
  | "vector"
  | "facts"
  | "graph";

type LayerStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "error"
  | "skipped";

type RevisionAction = "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";

interface LayerEvent {
  /** Which layer this event is for */
  layer: MemoryLayer;

  /** Current status of the layer */
  status: LayerStatus;

  /** Timestamp when this status was set */
  timestamp: number;

  /** Time elapsed since orchestration started (ms) */
  latencyMs?: number;

  /** Data stored in this layer (if complete) */
  data?: {
    /** ID of the stored record */
    id?: string;
    /** Summary or preview of the data */
    preview?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
  };

  /** Error details (if error status) */
  error?: {
    message: string;
    code?: string;
  };

  /**
   * Revision action taken (for facts layer with belief revision enabled)
   */
  revisionAction?: RevisionAction;

  /**
   * Facts that were superseded by this action
   * Only present when revisionAction is "SUPERSEDE"
   */
  supersededFacts?: string[];
}
```

---

## Governance & Policy Types

### GovernancePolicy

```typescript
type ComplianceMode = "GDPR" | "HIPAA" | "SOC2" | "FINRA" | "Custom";

interface GovernancePolicy {
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

  // Sessions: Session lifecycle policies
  sessions?: SessionPolicy;

  // Cross-layer compliance
  compliance: {
    mode: ComplianceMode;
    dataRetentionYears: number;
    requireJustification: number[];
    auditLogging: boolean;
  };
}
```

**Used in:**
- [Governance Policies API](../03-api-reference/10-governance-policies-api.md)
- [Governance Policies](../02-core-features/15-governance-policies.md)

**Related types:**
- [SessionPolicy](#sessionpolicy)

---

### SessionPolicy

```typescript
interface SessionLifecyclePolicy {
  /**
   * Idle timeout before session becomes idle/expires.
   * Format: duration string ('30m', '1h', '24h')
   * @default '30m'
   */
  idleTimeout: string;

  /**
   * Maximum session duration regardless of activity.
   * Format: duration string ('12h', '24h', '7d')
   * @default '24h'
   */
  maxDuration: string;

  /**
   * Automatically extend session on activity.
   * @default true
   */
  autoExtend: boolean;

  /**
   * Warn user before session expires.
   * Format: duration string ('5m', '15m')
   */
  warnBeforeExpiry?: string;
}

interface SessionCleanupPolicy {
  /**
   * Automatically expire idle sessions.
   * @default true
   */
  autoExpireIdle: boolean;

  /**
   * Delete ended sessions after this duration.
   * Format: duration string ('7d', '30d', '90d')
   */
  deleteEndedAfter?: string;

  /**
   * Archive sessions before deletion.
   * Format: duration string
   */
  archiveAfter?: string;
}

interface SessionLimitsPolicy {
  /**
   * Maximum concurrent active sessions per user.
   */
  maxActiveSessions?: number;

  /**
   * Maximum sessions per device type.
   */
  maxSessionsPerDevice?: number;
}

interface SessionPolicy {
  lifecycle: SessionLifecyclePolicy;
  cleanup: SessionCleanupPolicy;
  limits?: SessionLimitsPolicy;
}
```

---

## Resilience Types

### Priority

```typescript
type Priority = "critical" | "high" | "normal" | "low" | "background";
```

**Priority order** (highest first):
1. `critical` - GDPR/security operations (never dropped)
2. `high` - Real-time conversation storage
3. `normal` - Standard reads/writes
4. `low` - Bulk operations, exports
5. `background` - Async sync, analytics

---

### CircuitState

```typescript
type CircuitState = "closed" | "open" | "half-open";
```

**Used in:**
- [Resilience Layer](../02-core-features/13-resilience-layer.md)

---

### ResilienceConfig

```typescript
interface ResilienceConfig {
  /** Enable/disable resilience layer - default: true */
  enabled?: boolean;

  /** Token bucket rate limiter settings */
  rateLimiter?: RateLimiterConfig;

  /** Semaphore concurrency limiter settings */
  concurrency?: ConcurrencyConfig;

  /** Circuit breaker settings */
  circuitBreaker?: CircuitBreakerConfig;

  /** Priority queue settings */
  queue?: QueueConfig;

  /** Retry settings for transient failures */
  retry?: RetryConfig;

  // Monitoring Hooks
  onCircuitOpen?: (failures: number) => void;
  onCircuitClose?: () => void;
  onCircuitHalfOpen?: () => void;
  onQueueFull?: (priority: Priority) => void;
  onThrottle?: (waitTimeMs: number) => void;
  onMetrics?: (metrics: ResilienceMetrics) => void;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}
```

**Used in:**
- [Resilience Layer](../02-core-features/13-resilience-layer.md)

---

## Enum & Literal Types

### ConversationType

```typescript
type ConversationType = "user-agent" | "agent-agent";
```

---

### SourceType

```typescript
type SourceType = "conversation" | "system" | "tool" | "a2a";
```

---

### ContentType

```typescript
type ContentType = "raw" | "summarized";
```

---

### FactType

```typescript
type FactType = 
  | "preference"
  | "identity"
  | "knowledge"
  | "relationship"
  | "event"
  | "observation"
  | "custom";
```

---

### SkippableLayer

```typescript
type SkippableLayer =
  | "users"
  | "agents"
  | "conversations"
  | "vector"
  | "facts"
  | "graph";
```

**Layers that can be explicitly skipped during remember() orchestration:**
- `users` - Don't auto-create user profile
- `agents` - Don't auto-register agent
- `conversations` - Don't store messages in ACID conversation layer
- `vector` - Don't store in vector memory layer
- `facts` - Don't auto-extract facts (even if LLM configured)
- `graph` - Don't sync to graph database (even if configured)

---

## Type Index

Quick alphabetical reference for all types:

### A
- [A2ABroadcastParams](#a2abroadcastparams)
- [A2AMessage](#a2amessage)
- [A2ARequestParams](#a2arequestparams)
- [A2AResponse](#a2aresponse)
- [A2ASendParams](#a2asendparams)
- [AgentStats](#agentstats)

### C
- [CircuitState](#circuitstate)
- [ComplianceMode](#compliancemode)
- [ContentType](#contenttype)
- [Conversation](#conversation)
- [ConversationType](#conversationtype)

### F
- [FactRecord](#factrecord)
- [FactType](#facttype)
- [ForgetOptions](#forgetoptions)

### G
- [GovernancePolicy](#governancepolicy)
- [GraphSyncOption](#graphsyncoption)

### I
- [ImmutableRecord](#immutablerecord)

### L
- [LayerEvent](#layerevent)
- [ListConversationsFilter](#listconversationsfilter)
- [ListFactsFilter](#listfactsfilter)
- [ListMemoriesFilter](#listmemoriesfilter)

### M
- [MemoryEntry](#memoryentry)
- [MemorySpace](#memoryspace)
- [Message](#message)
- [MutableRecord](#mutablerecord)

### O
- [OrchestrationObserver](#orchestrationobserver)
- [OrchestrationSummary](#orchestrationsummary)

### P
- [Priority](#priority)

### R
- [RecallParams](#recallparams)
- [RecallResult](#recallresult)
- [RegisteredAgent](#registeredagent)
- [RememberParams](#rememberparams)
- [RememberResult](#rememberresult)
- [RememberStreamParams](#rememberstreamparams)
- [RememberStreamResult](#rememberstreamresult)
- [ResilienceConfig](#resilienceconfig)

### S
- [SearchMemoriesOptions](#searchmemoriesoptions)
- [Session](#session)
- [SessionPolicy](#sessionpolicy)
- [SkippableLayer](#skippablelayer)
- [SourceType](#sourcetype)

### U
- [UserProfile](#userprofile)

---

## See Also

- [API Reference](../03-api-reference/01-overview.md) - Method signatures using these types
- [Error Handling](./02-error-handling.md) - Error types and codes
- [Core Concepts](../01-getting-started/04-core-concepts.md) - Understanding the type system
- [Data Models](../04-architecture/02-data-models.md) - Architectural overview of types
