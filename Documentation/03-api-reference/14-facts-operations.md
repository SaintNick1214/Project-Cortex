# Facts Operations API

> **Last Updated**: 2025-11-30
> **Version**: v0.7.0+

Complete API reference for the Facts layer (Layer 3) - structured knowledge extraction and storage.

## Overview

The Facts API (`cortex.facts.*`) provides structured knowledge storage with versioning, relationships, and temporal validity. Facts are memory-space scoped and can be automatically extracted from conversations or stored manually.

**Key Features:**

- ✅ Structured fact storage (subject-predicate-object triples)
- ✅ Confidence scoring (0-100)
- ✅ Temporal validity (validFrom/validUntil)
- ✅ Automatic versioning and supersession
- ✅ **Graph database integration (v0.7.0+)** - Optional syncToGraph
- ✅ **Universal filters (v0.9.1+)** - Same filters as Memory API
- ✅ sourceRef linking to memories and conversations
- ✅ Memory space isolation
- ✅ **userId support (v0.9.1+)** - GDPR cascade deletion
- ✅ **participantId support** - Hive Mode tracking
- ✅ **Enriched fact extraction (v0.15.0+)** - Search aliases, semantic context, entities, relations

**Relationship to Layers:**

```
Layer 1a: Conversations ← Facts can reference via sourceRef
Layer 2: Vector Memory ← Facts indexed as memories
Layer 3: Facts ← Structured knowledge store
Layer 4: Contexts ← Facts can be extracted from context workflows
Graph: Facts sync to graph with entity extraction
```

## Core Operations

### store()

Store a new fact with metadata and relationships.

**Signature:**

```typescript
cortex.facts.store(
  params: StoreFactParams,
  options?: StoreFactOptions
): Promise<FactRecord>
```

**New in v0.7.0**: `options` parameter with `syncToGraph` support for graph database integration.

**Parameters:**

```typescript
interface StoreFactParams {
  memorySpaceId: string;
  participantId?: string; // Hive Mode tracking
  userId?: string; // GDPR compliance - links to user
  fact: string; // Human-readable fact statement
  factType: FactType; // Category of fact
  subject?: string; // Primary entity
  predicate?: string; // Relationship type
  object?: string; // Secondary entity
  confidence: number; // 0-100 extraction confidence
  sourceType: "conversation" | "system" | "tool" | "manual" | "a2a";
  sourceRef?: {
    conversationId?: string;
    messageIds?: string[];
    memoryId?: string; // Link to memory
  };
  metadata?: any;
  tags?: string[];
  validFrom?: number; // Temporal validity start
  validUntil?: number; // Temporal validity end

  // Enrichment fields (v0.15.0+) - for bullet-proof retrieval
  category?: string; // Specific sub-category (e.g., "addressing_preference")
  searchAliases?: string[]; // Alternative search terms for retrieval
  semanticContext?: string; // Usage context sentence
  entities?: EnrichedEntity[]; // Extracted entities with types
  relations?: EnrichedRelation[]; // Subject-predicate-object triples for graph
}

// Enriched entity structure
interface EnrichedEntity {
  name: string; // Entity name (e.g., "Alex")
  type: string; // Entity type (e.g., "preferred_name", "full_name")
  fullValue?: string; // Full value if applicable (e.g., "Alexander Johnson")
}

// Enriched relation structure
interface EnrichedRelation {
  subject: string; // Subject entity (e.g., "user")
  predicate: string; // Relationship type (e.g., "prefers_to_be_called")
  object: string; // Object entity (e.g., "Alex")
}

interface StoreFactOptions {
  syncToGraph?: boolean; // Sync to graph DB (default: true if configured)
}
```

**Example:**

```typescript
// Store fact with userId for GDPR compliance
const fact = await cortex.facts.store({
  memorySpaceId: "agent-1",
  userId: "user-123", // GDPR compliance - enables cascade deletion
  fact: "User prefers dark mode",
  factType: "preference",
  subject: "user-123",
  predicate: "prefers",
  object: "dark mode",
  confidence: 95,
  sourceType: "conversation",
  sourceRef: {
    conversationId: "conv-123",
    messageIds: ["msg-1", "msg-2"],
    memoryId: "mem-456",
  },
  tags: ["ui", "settings"],
});

console.log(fact.factId); // "fact-1730123456789-abc123"

// Hive Mode - store with participantId
const hiveFact = await cortex.facts.store({
  memorySpaceId: "shared-space",
  participantId: "profile-agent", // Track which agent stored it
  userId: "user-456",
  fact: "User works at Acme Corp",
  factType: "identity",
  subject: "user-456",
  predicate: "works_at",
  object: "Acme Corp",
  confidence: 98,
  sourceType: "conversation",
  tags: ["employment"],
});

// Enriched fact (v0.15.0+) - bullet-proof retrieval
const enrichedFact = await cortex.facts.store({
  memorySpaceId: "agent-1",
  userId: "user-123",
  fact: "User prefers to be called Alex",
  factType: "identity",
  subject: "user",
  predicate: "prefers_to_be_called",
  object: "Alex",
  confidence: 95,
  sourceType: "conversation",
  tags: ["name", "preference"],

  // Enrichment fields for better semantic search
  category: "addressing_preference", // Specific sub-category
  searchAliases: [
    "name",
    "nickname",
    "what to call",
    "address as",
    "greet",
    "refer to",
    "how to address",
  ],
  semanticContext:
    "Use 'Alex' when addressing, greeting, or referring to this user",
  entities: [
    { name: "Alex", type: "preferred_name", fullValue: "Alexander Johnson" },
    { name: "Alexander Johnson", type: "full_name" },
  ],
  relations: [
    { subject: "user", predicate: "prefers_to_be_called", object: "Alex" },
    {
      subject: "user",
      predicate: "full_name_is",
      object: "Alexander Johnson",
    },
  ],
});
```

### `facts.storeWithDedup()`

> **New in v0.22.0**: Store a fact with automatic cross-session deduplication.

Store a fact, automatically checking for and handling duplicates. If a duplicate is found, either returns the existing fact or updates it if the new confidence is higher.

**Signature:**

```typescript
cortex.facts.storeWithDedup(
  params: StoreFactParams,
  options?: StoreFactWithDedupOptions
): Promise<StoreWithDedupResult>
```

**Parameters:**

```typescript
interface StoreFactWithDedupOptions extends StoreFactOptions {
  /**
   * Deduplication configuration.
   *
   * - 'semantic': Embedding-based similarity (most accurate, requires generateEmbedding)
   * - 'structural': Subject + predicate + object match (fast, good accuracy)
   * - 'exact': Normalized text match (fastest, lowest accuracy)
   * - false: Disable deduplication
   *
   * @default undefined (no deduplication at facts.store level)
   */
  deduplication?: DeduplicationConfig | DeduplicationStrategy | false;
}

interface DeduplicationConfig {
  strategy: "none" | "exact" | "structural" | "semantic";
  similarityThreshold?: number; // 0-1, default 0.85
  generateEmbedding?: (text: string) => Promise<number[]>;
}
```

**Return Type:**

```typescript
interface StoreWithDedupResult {
  fact: FactRecord;
  wasUpdated: boolean; // true if existing fact was updated
  deduplication?: {
    strategy: DeduplicationStrategy;
    matchedExisting: boolean;
    similarityScore?: number; // For semantic matches
  };
}
```

**Example:**

```typescript
// Store with structural deduplication
const result = await cortex.facts.storeWithDedup(
  {
    memorySpaceId: "agent-1",
    fact: "User prefers dark mode",
    factType: "preference",
    subject: "user-123",
    predicate: "prefers",
    object: "dark-mode",
    confidence: 90,
    sourceType: "conversation",
  },
  {
    deduplication: { strategy: "structural" },
  },
);

if (result.deduplication?.matchedExisting) {
  console.log("Found duplicate:", result.fact.factId);
  console.log("Was updated:", result.wasUpdated);
} else {
  console.log("Created new fact:", result.fact.factId);
}

// Store with semantic deduplication
const semanticResult = await cortex.facts.storeWithDedup(
  {
    memorySpaceId: "agent-1",
    fact: "User likes dark themes", // Different wording
    factType: "preference",
    subject: "user-123",
    confidence: 85,
    sourceType: "conversation",
  },
  {
    deduplication: {
      strategy: "semantic",
      similarityThreshold: 0.8,
      generateEmbedding: async (text) => embed(text),
    },
  },
);

// Will match "User prefers dark mode" semantically
console.log(semanticResult.deduplication?.matchedExisting); // true
console.log(semanticResult.deduplication?.similarityScore); // ~0.92
```

## Belief Revision System (v0.23.0+)

> **New in v0.23.0**: Intelligent fact management that prevents duplicates and maintains knowledge consistency.

The Belief Revision System determines whether a new fact should:
- **CREATE**: Add as new fact (no conflicts)
- **UPDATE**: Merge with existing fact (refinement)
- **SUPERSEDE**: Replace existing fact (contradiction)
- **NONE**: Skip (duplicate)

### Pipeline Flow

```
NEW FACT → [Slot Match?] → YES → [LLM Decision]
               │                      │
               NO                 ┌───┴───┐
               ↓                  ↓   ↓   ↓
        [Semantic Match?]     UPDATE SUPERSEDE NONE
               │                      │
               NO                     ↓
               ↓                   Execute
            CREATE
```

### Configuration

```typescript
// Configure belief revision when creating Cortex instance
const cortex = new Cortex({
  url: process.env.CONVEX_URL!,
  beliefRevision: {
    slotMatching: {
      enabled: true,
      predicateClasses: {
        // Add custom slot types
        custom_slot: ["my predicate", "another pattern"],
      },
    },
    semanticMatching: {
      enabled: true,
      threshold: 0.7, // Lower than dedup (0.85)
      generateEmbedding: async (text) => embed(text),
    },
    llmResolution: {
      enabled: true,
      model: "gpt-4o",
    },
    history: {
      enabled: true,
      retentionDays: 90,
    },
  },
});

// Or configure later
cortex.facts.configureBeliefRevision(llmClient, {
  slotMatching: { enabled: true },
  llmResolution: { enabled: true },
});
```

### `facts.revise()`

> **New in v0.23.0**: Intelligently store a fact using the belief revision pipeline.

**Signature:**

```typescript
cortex.facts.revise(params: ReviseParams): Promise<ReviseResult>
```

**Parameters:**

```typescript
interface ReviseParams {
  memorySpaceId: string;
  fact: {
    fact: string;
    factType?: FactType;
    subject?: string;
    predicate?: string;
    object?: string;
    confidence: number;
    tags?: string[];
  };
  userId?: string;
  participantId?: string;
}
```

**Return Type:**

```typescript
interface ReviseResult {
  action: "CREATE" | "UPDATE" | "SUPERSEDE" | "NONE";
  fact: FactRecord;
  superseded: FactRecord[];
  reason: string;
  confidence: number;
  pipeline: {
    slotMatching?: { executed: boolean; matched: boolean; factIds?: string[] };
    semanticMatching?: { executed: boolean; matched: boolean; factIds?: string[] };
    llmResolution?: { executed: boolean; decision?: string };
  };
}
```

**Example:**

```typescript
// Intelligent fact storage with automatic conflict resolution
const result = await cortex.facts.revise({
  memorySpaceId: "agent-1",
  fact: {
    fact: "User prefers purple",
    factType: "preference",
    subject: "user-123",
    predicate: "favorite color",
    object: "purple",
    confidence: 90,
  },
  userId: "user-123",
});

console.log(`Action: ${result.action}`); // "SUPERSEDE"
console.log(`Reason: ${result.reason}`); // "Color preference has changed"
console.log(`Superseded: ${result.superseded.length} facts`);

// Check which pipeline stages ran
if (result.pipeline.slotMatching?.matched) {
  console.log("Found slot conflict");
}
if (result.pipeline.llmResolution?.executed) {
  console.log(`LLM decided: ${result.pipeline.llmResolution.decision}`);
}
```

### `facts.checkConflicts()`

> **New in v0.23.0**: Preview conflicts without executing - useful for user confirmation flows.

**Signature:**

```typescript
cortex.facts.checkConflicts(params: ReviseParams): Promise<ConflictCheckResult>
```

**Return Type:**

```typescript
interface ConflictCheckResult {
  hasConflicts: boolean;
  slotConflicts: FactRecord[];
  semanticConflicts: Array<{ fact: FactRecord; score: number }>;
  recommendedAction: "CREATE" | "UPDATE" | "SUPERSEDE" | "NONE";
  reason: string;
}
```

**Example:**

```typescript
// Check for conflicts before storing
const conflicts = await cortex.facts.checkConflicts({
  memorySpaceId: "agent-1",
  fact: {
    fact: "User prefers purple",
    subject: "user-123",
    predicate: "favorite color",
    object: "purple",
    confidence: 90,
  },
});

if (conflicts.hasConflicts) {
  console.log(`Found ${conflicts.slotConflicts.length} slot conflicts`);
  console.log(`Recommended action: ${conflicts.recommendedAction}`);
  console.log(`Reason: ${conflicts.reason}`);

  // Show user the conflicts
  conflicts.slotConflicts.forEach((f) => {
    console.log(`  - ${f.fact} (${f.confidence}%)`);
  });

  // Let user confirm before proceeding
  if (await userConfirms()) {
    await cortex.facts.revise(params);
  }
}
```

### `facts.supersede()`

> **New in v0.23.0**: Manually supersede a fact with another.

**Signature:**

```typescript
cortex.facts.supersede(params: {
  memorySpaceId: string;
  oldFactId: string;
  newFactId: string;
  reason?: string;
}): Promise<{ superseded: boolean; oldFactId: string; newFactId: string }>
```

**Example:**

```typescript
// Manually supersede a fact
await cortex.facts.supersede({
  memorySpaceId: "agent-1",
  oldFactId: "fact-old-color",
  newFactId: "fact-new-color",
  reason: "User explicitly corrected this information",
});

// Old fact is now marked with validUntil
const oldFact = await cortex.facts.get("agent-1", "fact-old-color");
console.log(oldFact.validUntil); // Set to supersession time
```

### `facts.history()`

> **New in v0.23.0**: Get the change history for a fact.

**Signature:**

```typescript
cortex.facts.history(factId: string, limit?: number): Promise<FactChangeEvent[]>
```

**Return Type:**

```typescript
interface FactChangeEvent {
  eventId: string;
  factId: string;
  memorySpaceId: string;
  action: "CREATE" | "UPDATE" | "SUPERSEDE" | "DELETE";
  oldValue?: string;
  newValue?: string;
  supersededBy?: string;
  supersedes?: string;
  reason?: string;
  confidence?: number;
  pipeline?: {
    slotMatching?: boolean;
    semanticMatching?: boolean;
    llmResolution?: boolean;
  };
  userId?: string;
  participantId?: string;
  conversationId?: string;
  timestamp: number;
}
```

**Example:**

```typescript
// Get history for a fact
const history = await cortex.facts.history("fact-123");

history.forEach((event) => {
  console.log(`${event.action} at ${new Date(event.timestamp).toISOString()}`);
  console.log(`  Reason: ${event.reason}`);
  if (event.oldValue) {
    console.log(`  Old: ${event.oldValue}`);
  }
  if (event.newValue) {
    console.log(`  New: ${event.newValue}`);
  }
});
```

### `facts.getSupersessionChain()`

> **New in v0.23.0**: Get the evolution of a fact over time.

**Signature:**

```typescript
cortex.facts.getSupersessionChain(factId: string): Promise<SupersessionChainEntry[]>
```

**Example:**

```typescript
// Trace the evolution of knowledge
const chain = await cortex.facts.getSupersessionChain("fact-latest");

// Returns: [oldest] -> [older] -> [old] -> [current]
chain.forEach((entry, i) => {
  console.log(`${i + 1}. ${entry.factId}`);
  if (entry.supersededBy) {
    console.log(`   Superseded by: ${entry.supersededBy}`);
    console.log(`   Reason: ${entry.reason}`);
  }
});
```

### `facts.getActivitySummary()`

> **New in v0.23.0**: Get activity summary for a memory space.

**Signature:**

```typescript
cortex.facts.getActivitySummary(
  memorySpaceId: string,
  hours?: number
): Promise<ActivitySummary>
```

**Return Type:**

```typescript
interface ActivitySummary {
  timeRange: {
    hours: number;
    since: string;
    until: string;
  };
  totalEvents: number;
  actionCounts: {
    CREATE: number;
    UPDATE: number;
    SUPERSEDE: number;
    DELETE: number;
  };
  uniqueFactsModified: number;
  activeParticipants: number;
}
```

**Example:**

```typescript
// Get activity summary for last 24 hours
const summary = await cortex.facts.getActivitySummary("agent-1", 24);

console.log(`Total events: ${summary.totalEvents}`);
console.log(`Creates: ${summary.actionCounts.CREATE}`);
console.log(`Updates: ${summary.actionCounts.UPDATE}`);
console.log(`Supersessions: ${summary.actionCounts.SUPERSEDE}`);
console.log(`Unique facts modified: ${summary.uniqueFactsModified}`);
```

### Slot Matching

Slot matching is the fast-path conflict detection that classifies predicates into semantic slots. Facts in the same slot (same subject + predicate class) represent the same knowledge and should be updated rather than duplicated.

**Predicate Classes:**

```typescript
// Default predicate classes
const PREDICATE_CLASSES = {
  favorite_color: ["favorite color", "preferred color", "likes color", ...],
  location: ["lives in", "resides in", "based in", "moved to", ...],
  employment: ["works at", "employed by", "job at", ...],
  age: ["age is", "years old", "born in", ...],
  name: ["name is", "called", "named", "goes by", ...],
  relationship_status: ["married to", "engaged to", "dating", ...],
  education: ["studied at", "graduated from", "degree is", ...],
  food_preference: ["favorite food", "dietary restriction", ...],
  // ... and more
};
```

**Custom Predicate Classes:**

```typescript
// Add custom predicate classes
cortex.facts.configureBeliefRevision(llmClient, {
  slotMatching: {
    enabled: true,
    predicateClasses: {
      // Add your domain-specific slots
      programming_language: ["codes in", "writes in", "develops with"],
      communication_style: ["prefers to communicate", "responds best to"],
    },
  },
});
```

### LLM Conflict Resolution

When slot or semantic matching finds potential conflicts, the LLM makes nuanced decisions:

| Decision  | Meaning                                       | Example                                      |
| --------- | --------------------------------------------- | -------------------------------------------- |
| UPDATE    | Merge/refine existing fact                    | "User likes pizza" → "User's favorite pizza is pepperoni" |
| SUPERSEDE | Replace contradictory fact                    | "Lives in NYC" → "Moved to SF"               |
| NONE      | Skip - already captured                       | Duplicate or less specific                   |
| ADD       | Genuinely new information                     | Different aspect of same topic               |

### `facts.get()`

Retrieve a fact by ID.

**Signature:**

```typescript
async get(
  memorySpaceId: string,
  factId: string
): Promise<FactRecord | null>
```

**Example:**

```typescript
const fact = await cortex.facts.get("agent-1", "fact-123");

if (fact) {
  console.log(fact.fact); // "User prefers dark mode"
  console.log(fact.confidence); // 95
  console.log(fact.version); // 1
}
```

### `facts.list()`

List facts with filters.

**Signature:**

```typescript
async list(filter: ListFactsFilter): Promise<FactRecord[]>
```

**Parameters:**

```typescript
interface ListFactsFilter {
  // Required
  memorySpaceId: string;

  // Fact-specific filters
  factType?: FactType; // Filter by type
  subject?: string; // Filter by subject entity
  predicate?: string; // Filter by relationship type
  object?: string; // Filter by object entity
  minConfidence?: number; // Minimum confidence threshold (0-100)
  confidence?: number; // Exact match

  // Universal filters (Cortex standard)
  userId?: string; // Filter by user
  participantId?: string; // Filter by participant (Hive Mode)
  tags?: string[]; // Filter by tags
  tagMatch?: "any" | "all"; // Tag match strategy (default: 'any')
  sourceType?: "conversation" | "system" | "tool" | "manual" | "a2a"; // Filter by source

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number; // Specific version
  includeSuperseded?: boolean; // Include old versions (default: false)

  // Temporal validity filters
  validAt?: Date; // Facts valid at this time

  // Metadata filters
  metadata?: Record<string, any>; // Custom metadata filters

  // Result options
  limit?: number; // Max results (default: 100)
  offset?: number; // Pagination offset (default: 0)
  sortBy?: "createdAt" | "updatedAt" | "confidence" | "version"; // Sort field
  sortOrder?: "asc" | "desc"; // Sort direction (default: 'desc')
}
```

**Example:**

```typescript
// All user preferences
const preferences = await cortex.facts.list({
  memorySpaceId: "agent-1",
  factType: "preference",
  subject: "user-123",
});

// Facts with specific tags
const uiFacts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  tags: ["ui", "settings"],
  limit: 50,
});

// Universal filters - filter by userId (GDPR-friendly)
const userFacts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  userId: "user-123", // All facts about this user
  minConfidence: 80,
  createdAfter: new Date("2025-01-01"),
});

// Hive Mode - filter by participant
const agentFacts = await cortex.facts.list({
  memorySpaceId: "shared-space",
  participantId: "email-agent", // Facts stored by email agent
  factType: "preference",
});

// Complex universal filters
const recentHighConfidence = await cortex.facts.list({
  memorySpaceId: "agent-1",
  userId: "user-123",
  minConfidence: 90, // Confidence >= 90
  createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  sourceType: "conversation", // Only from conversations
  tags: ["important"],
  tagMatch: "all", // Must have ALL tags
  sortBy: "confidence",
  sortOrder: "desc",
  limit: 20,
});
```

### `facts.search()`

Search facts with text matching.

**Signature:**

```typescript
async search(
  memorySpaceId: string,
  query: string,
  options?: SearchFactsOptions
): Promise<FactRecord[]>
```

**Parameters:**

```typescript
interface SearchFactsOptions {
  // Fact-specific filters
  factType?: FactType;
  subject?: string;
  predicate?: string;
  object?: string;
  minConfidence?: number; // Filter by confidence threshold (0-100)
  confidence?: number; // Exact match

  // Universal filters (Cortex standard)
  userId?: string;
  participantId?: string; // Hive Mode filtering
  tags?: string[];
  tagMatch?: "any" | "all"; // Tag match strategy (default: 'any')
  sourceType?: "conversation" | "system" | "tool" | "manual" | "a2a";

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number;
  includeSuperseded?: boolean; // Include old versions (default: false)

  // Temporal validity
  validAt?: Date; // Facts valid at this time

  // Metadata filters
  metadata?: Record<string, any>;

  // Result options
  limit?: number; // Max results (default: 10)
  offset?: number; // Pagination offset
  sortBy?: "confidence" | "createdAt" | "updatedAt"; // Sort field (note: search doesn't return scores)
  sortOrder?: "asc" | "desc"; // Sort direction (default: 'desc')
}
```

**Example:**

```typescript
// Basic search with universal filters
const foodFacts = await cortex.facts.search("agent-1", "food preferences", {
  factType: "preference",
  minConfidence: 80,
  userId: "user-123", // Filter by user
  limit: 10,
});

foodFacts.forEach((fact) => {
  console.log(`${fact.fact} (${fact.confidence}% confidence)`);
});

// Search with date filters
const recentFacts = await cortex.facts.search("agent-1", "user preferences", {
  userId: "user-123",
  createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  minConfidence: 70,
  sortBy: "confidence",
});

// Search by participant (Hive Mode)
const participantFacts = await cortex.facts.search(
  "shared-space",
  "user info",
  {
    participantId: "profile-agent",
    factType: "identity",
    validAt: new Date(), // Facts valid now
  },
);

// Complex search with metadata
const complexSearch = await cortex.facts.search("agent-1", "important facts", {
  userId: "user-123",
  minConfidence: 85,
  sourceType: "conversation",
  tags: ["verified", "critical"],
  tagMatch: "all",
  metadata: { category: "security" },
  createdAfter: new Date("2025-01-01"),
  sortBy: "confidence",
  sortOrder: "desc",
  limit: 20,
});
```

### `facts.update()`

Update a fact (creates new version).

**Signature:**

```typescript
async update(
  memorySpaceId: string,
  factId: string,
  updates: UpdateFactInput,
  options?: UpdateFactOptions
): Promise<FactRecord>
```

**Parameters:**

```typescript
interface UpdateFactInput {
  fact?: string; // New fact statement
  confidence?: number; // Updated confidence
  tags?: string[]; // Updated tags
  validUntil?: number; // Set expiration
  metadata?: any; // Updated metadata
}

interface UpdateFactOptions {
  syncToGraph?: boolean;
}
```

**Example:**

```typescript
// Update confidence based on validation
const updated = await cortex.facts.update("agent-1", "fact-123", {
  confidence: 99,
  tags: ["verified", "ui"],
});

// Mark fact as expiring
const expiring = await cortex.facts.update("agent-1", "fact-456", {
  validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

### `facts.delete()`

Delete a fact (soft delete - marks as superseded).

**Signature:**

```typescript
async delete(
  memorySpaceId: string,
  factId: string,
  options?: DeleteFactOptions
): Promise<{ deleted: boolean; factId: string }>
```

**Example:**

```typescript
await cortex.facts.delete("agent-1", "fact-123", {
  syncToGraph: true, // Remove from graph DB
});
```

### `facts.deleteMany()`

Delete multiple facts matching filters in a single operation.

**Signature:**

```typescript
async deleteMany(params: DeleteManyFactsParams): Promise<{ deleted: number; memorySpaceId: string }>
```

**Parameters:**

```typescript
interface DeleteManyFactsParams {
  // Required
  memorySpaceId: string;

  // Optional filters
  userId?: string; // Filter by user (GDPR cleanup)
  factType?: FactType; // Filter by fact type
}
```

**Example:**

```typescript
// Delete all facts in a memory space
const result = await cortex.facts.deleteMany({
  memorySpaceId: "agent-1",
});
console.log(`Deleted ${result.deleted} facts`);

// Delete all facts for a specific user (GDPR compliance)
const gdprResult = await cortex.facts.deleteMany({
  memorySpaceId: "agent-1",
  userId: "user-to-delete",
});

// Delete all preference facts
const prefResult = await cortex.facts.deleteMany({
  memorySpaceId: "agent-1",
  factType: "preference",
});
```

> **Note:** This is a hard delete operation. For soft delete (marking as superseded), use `delete()` on individual facts.

### `facts.count()`

Count facts matching filters.

**Signature:**

```typescript
async count(filter: CountFactsFilter): Promise<number>
```

**Parameters:**

```typescript
interface CountFactsFilter {
  // Required
  memorySpaceId: string;

  // Fact-specific filters
  factType?: FactType;
  subject?: string;
  predicate?: string;
  object?: string;
  minConfidence?: number;
  confidence?: number | { $gte?: number; $lte?: number; $eq?: number };

  // Universal filters (Cortex standard)
  userId?: string;
  participantId?: string; // Hive Mode filtering
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual" | "a2a";

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number;
  includeSuperseded?: boolean; // Include old versions (default: false)

  // Temporal validity
  validAt?: Date; // Facts valid at this time

  // Metadata filters
  metadata?: Record<string, any>;
}
```

**Example:**

```typescript
// Count all preferences
const totalPreferences = await cortex.facts.count({
  memorySpaceId: "agent-1",
  factType: "preference",
});

console.log(`Found ${totalPreferences} user preferences`);

// Count by userId (GDPR-friendly)
const userFactCount = await cortex.facts.count({
  memorySpaceId: "agent-1",
  userId: "user-123",
});

console.log(`User has ${userFactCount} facts stored`);

// Count high-confidence recent facts
const recentHighConfidence = await cortex.facts.count({
  memorySpaceId: "agent-1",
  userId: "user-123",
  minConfidence: 90,
  createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  sourceType: "conversation",
});

console.log(`${recentHighConfidence} high-confidence facts from last 7 days`);

// Count by participant (Hive Mode)
const participantFactCount = await cortex.facts.count({
  memorySpaceId: "shared-space",
  participantId: "email-agent",
  factType: "preference",
});

console.log(`Email agent stored ${participantFactCount} preferences`);
```

## Universal Filters Support

> **Key Design Principle:** Facts API supports the same universal filters as Memory Operations for consistency.

The Facts API now supports **universal filters** across all query operations (`list()`, `search()`, `count()`, `queryBySubject()`, etc.), making it consistent with Cortex's core design philosophy.

### Supported Universal Filters

All fact query operations accept these standard Cortex filters:

```typescript
interface UniversalFactFilters {
  // Identity filters (GDPR compliance)
  userId?: string; // Filter by user
  participantId?: string; // Filter by participant (Hive Mode)

  // Fact-specific filters
  factType?: FactType;
  subject?: string;
  predicate?: string;
  object?: string;
  minConfidence?: number; // Confidence >= value
  confidence?: number; // Exact match

  // Source filters
  sourceType?: "conversation" | "system" | "tool" | "manual" | "a2a";

  // Tag filters
  tags?: string[];
  tagMatch?: "any" | "all"; // Default: 'any'

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number;
  includeSuperseded?: boolean; // Include old versions

  // Temporal validity
  validAt?: Date; // Facts valid at specific time
  validFrom?: Date;
  validUntil?: Date;

  // Metadata filters
  metadata?: Record<string, any>; // Custom metadata

  // Result options
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
```

### Why Universal Filters Matter

**1. Consistent API Experience**

```typescript
// Same filter patterns work across Cortex
const filters = {
  userId: "user-123",
  createdAfter: new Date("2025-01-01"),
  tags: ["important"],
};

// Use in Memory API
await cortex.memory.list("agent-1", filters);

// Use in Facts API
await cortex.facts.list({ memorySpaceId: "agent-1", ...filters });
```

**2. GDPR Compliance**

```typescript
// Filter facts by userId for data export
const userFacts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  userId: "user-123",
});

// Export for GDPR request
const exportData = await cortex.facts.export({
  memorySpaceId: "agent-1",
  userId: "user-123",
  format: "json",
});

// Delete for GDPR compliance (via users.delete cascade)
await cortex.users.delete("user-123", { cascade: true });
// Automatically deletes all facts with userId="user-123"
```

**3. Hive Mode Support**

```typescript
// Filter by participantId to see which agent stored what
const emailAgentFacts = await cortex.facts.list({
  memorySpaceId: "shared-space",
  participantId: "email-agent",
  factType: "preference",
});

const profileAgentFacts = await cortex.facts.list({
  memorySpaceId: "shared-space",
  participantId: "profile-agent",
  factType: "identity",
});

// Compare what different agents learned
console.log(`Email agent stored ${emailAgentFacts.length} preferences`);
console.log(`Profile agent stored ${profileAgentFacts.length} identity facts`);
```

**4. Complex Queries**

```typescript
// Combine multiple filters for precise queries
const criticalRecentFacts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  userId: "user-123",
  minConfidence: 90,
  factType: "preference",
  sourceType: "conversation",
  createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  tags: ["verified", "critical"],
  tagMatch: "all",
  metadata: { priority: "high" },
  sortBy: "confidence",
  sortOrder: "desc",
});
```

### Confidence Filtering

Facts API supports confidence filtering for quality thresholds:

```typescript
// Minimum confidence (most common pattern)
const highQuality = await cortex.facts.list({
  memorySpaceId: "agent-1",
  minConfidence: 85, // Confidence >= 85
});

// Exact match
const exactFacts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  confidence: 90, // Exactly 90
});

// Note: maxConfidence (upper bound) will be added in v0.9.2
```

### Operations Supporting Universal Filters

All major query operations support universal filters:

- ✅ `facts.list()` - Full filter support
- ✅ `facts.search()` - Full filter support + text search
- ✅ `facts.count()` - Full filter support
- ✅ `facts.queryBySubject()` - Universal filters + subject focus
- ✅ `facts.queryByRelationship()` - Universal filters + relationship focus
- ✅ `facts.export()` - Universal filters for selective export
- ✅ `facts.consolidate()` - Can filter facts to consolidate

### Migration Note

**If you're using older code:**

```typescript
// Old (still works, but limited)
const facts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  factType: "preference",
});

// New (recommended - more powerful)
const facts = await cortex.facts.list({
  memorySpaceId: "agent-1",
  factType: "preference",
  userId: "user-123", // Filter by user
  minConfidence: 80, // Quality threshold
  createdAfter: new Date("2025-01-01"), // Recent only
  tags: ["verified"],
  sourceType: "conversation",
});
```

## Query Operations

### `facts.queryBySubject()`

Get all facts about a specific entity with full universal filter support.

**Signature:**

```typescript
async queryBySubject(filter: QueryBySubjectFilter): Promise<FactRecord[]>

interface QueryBySubjectFilter {
  // Required
  memorySpaceId: string;
  subject: string; // Entity to query

  // Fact-specific filters
  factType?: FactType;
  predicate?: string;
  object?: string;
  minConfidence?: number;
  confidence?: number | RangeQuery;

  // Universal filters (all supported)
  userId?: string;
  participantId?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual" | "a2a";
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  version?: number;
  includeSuperseded?: boolean;
  validAt?: Date;
  metadata?: Record<string, any>;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "confidence";
  sortOrder?: "asc" | "desc";
}
```

**Example:**

```typescript
// All facts about a user
const userFacts = await cortex.facts.queryBySubject({
  memorySpaceId: "agent-1",
  subject: "user-123",
});

// Just preferences
const preferences = await cortex.facts.queryBySubject({
  memorySpaceId: "agent-1",
  subject: "user-123",
  factType: "preference",
});

// With universal filters
const recentHighConfidence = await cortex.facts.queryBySubject({
  memorySpaceId: "agent-1",
  subject: "user-123",
  userId: "user-123", // GDPR-friendly
  factType: "preference",
  minConfidence: 85,
  createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  sourceType: "conversation",
  tags: ["verified"],
  sortBy: "confidence",
  sortOrder: "desc",
});

// Hive Mode - filter by participant
const participantFacts = await cortex.facts.queryBySubject({
  memorySpaceId: "shared-space",
  subject: "user-123",
  participantId: "profile-agent", // Facts stored by profile agent
  factType: "identity",
});
```

### `facts.queryByRelationship()`

Get facts with specific relationship (graph traversal) with full universal filter support.

**Signature:**

```typescript
async queryByRelationship(filter: QueryByRelationshipFilter): Promise<FactRecord[]>

interface QueryByRelationshipFilter {
  // Required
  memorySpaceId: string;
  subject: string; // Source entity
  predicate: string; // Relationship type

  // Fact-specific filters
  object?: string; // Target entity (optional)
  factType?: FactType;
  minConfidence?: number;
  confidence?: number | RangeQuery;

  // Universal filters (all supported)
  userId?: string;
  participantId?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  sourceType?: "conversation" | "system" | "tool" | "manual" | "a2a";
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  version?: number;
  includeSuperseded?: boolean;
  validAt?: Date;
  metadata?: Record<string, any>;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "confidence";
  sortOrder?: "asc" | "desc";
}
```

**Example:**

```typescript
// Where does user work?
const workPlaces = await cortex.facts.queryByRelationship({
  memorySpaceId: "agent-1",
  subject: "user-123",
  predicate: "works_at",
});

// What does user prefer?
const preferences = await cortex.facts.queryByRelationship({
  memorySpaceId: "agent-1",
  subject: "user-123",
  predicate: "prefers",
});

// With universal filters
const recentPreferences = await cortex.facts.queryByRelationship({
  memorySpaceId: "agent-1",
  subject: "user-123",
  predicate: "prefers",
  userId: "user-123", // GDPR-friendly
  minConfidence: 80,
  createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  sourceType: "conversation",
  tags: ["verified"],
  validAt: new Date(), // Only currently valid facts
  sortBy: "confidence",
  sortOrder: "desc",
});

// Hive Mode - filter by participant
const agentPreferences = await cortex.facts.queryByRelationship({
  memorySpaceId: "shared-space",
  subject: "user-123",
  predicate: "prefers",
  participantId: "preference-agent", // Facts stored by preference agent
});
```

## Version Management

### `facts.getHistory()`

Get complete version history for a fact.

**Signature:**

```typescript
async getHistory(
  memorySpaceId: string,
  factId: string
): Promise<FactRecord[]>
```

**Example:**

```typescript
const history = await cortex.facts.getHistory("agent-1", "fact-123");

history.forEach((version) => {
  console.log(`v${version.version}: ${version.fact} (${version.confidence}%)`);
  console.log(`  Updated: ${new Date(version.updatedAt).toISOString()}`);
});
```

## Data Operations

### `facts.export()`

Export facts in various formats.

**Signature:**

```typescript
async export(options: {
  memorySpaceId: string;
  format: "json" | "jsonld" | "csv";
  factType?: FactType;
}): Promise<{
  format: string;
  data: string;
  count: number;
  exportedAt: number;
}>
```

**Example:**

```typescript
// Export all facts as JSON
const jsonExport = await cortex.facts.export({
  memorySpaceId: "agent-1",
  format: "json",
});

// Export preferences as JSON-LD (linked data)
const linkedData = await cortex.facts.export({
  memorySpaceId: "agent-1",
  format: "jsonld",
  factType: "preference",
});

// Export as CSV
const csvExport = await cortex.facts.export({
  memorySpaceId: "agent-1",
  format: "csv",
});
```

### `facts.consolidate()`

Merge duplicate facts.

**Signature:**

```typescript
async consolidate(params: {
  memorySpaceId: string;
  factIds: string[];
  keepFactId: string;
}): Promise<{
  consolidated: boolean;
  keptFactId: string;
  mergedCount: number;
}>
```

**Example:**

```typescript
// Found duplicate facts about same preference
const result = await cortex.facts.consolidate({
  memorySpaceId: "agent-1",
  factIds: ["fact-1", "fact-2", "fact-3"],
  keepFactId: "fact-1", // Keep this one, merge others
});

console.log(`Consolidated ${result.mergedCount} duplicate facts`);
```

## Integration with Memory API

Facts are automatically integrated into all Memory operations:

### Automatic Extraction

```typescript
// Facts extracted during remember()
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I'm a developer at Google",
  agentResponse: "Interesting!",
  userId: "user-123",
  userName: "Alex",
  extractFacts: async (user, agent) => [
    {
      fact: "User is a developer",
      factType: "identity",
      confidence: 95,
    },
  ],
});

console.log(result.facts); // Extracted facts returned
```

### Automatic Enrichment

```typescript
// Facts included in search results
const memories = await cortex.memory.search("agent-1", "user info", {
  enrichConversation: true, // Facts automatically included
});

memories.forEach((m) => {
  console.log(`Memory: ${m.memory.content}`);
  m.facts?.forEach((f) => {
    console.log(`  Fact: ${f.fact}`);
  });
});
```

### Cascade Delete

```typescript
// Facts deleted when memory is forgotten
const result = await cortex.memory.forget("agent-1", "mem-123");

console.log(`Deleted ${result.factsDeleted} facts`);
console.log(`Fact IDs: ${result.factIds.join(", ")}`);
```

## Types Reference

### FactRecord

```typescript
interface FactRecord {
  _id: string;
  factId: string;
  memorySpaceId: string;
  participantId?: string; // Hive Mode tracking
  userId?: string; // GDPR compliance - links to user
  fact: string;
  factType: FactType;
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
  metadata?: any;
  tags: string[];
  validFrom?: number;
  validUntil?: number;
  version: number;
  supersededBy?: string;
  supersedes?: string;
  createdAt: number;
  updatedAt: number;

  // Enrichment fields (v0.15.0+) - for bullet-proof retrieval
  category?: string; // Specific sub-category (e.g., "addressing_preference")
  searchAliases?: string[]; // Alternative search terms
  semanticContext?: string; // Usage context sentence
  entities?: EnrichedEntity[]; // Extracted entities with types
  relations?: EnrichedRelation[]; // Subject-predicate-object triples for graph
}
```

### FactType

```typescript
type FactType =
  | "preference" // User likes/dislikes
  | "identity" // Who/what someone is
  | "knowledge" // Information/skills
  | "relationship" // Connections between entities
  | "event" // Time-based occurrences
  | "observation" // Observed behaviors/actions
  | "custom"; // Domain-specific
```

## Enriched Fact Extraction (v0.15.0+)

> **New in v0.15.0**: Bullet-proof fact retrieval through enriched extraction.

Cortex v0.15.0 introduces **enriched fact extraction** - a system for extracting facts with rich metadata that dramatically improves semantic search accuracy.

### Why Enriched Facts?

Standard fact extraction stores simple statements like "User prefers to be called Alex". While correct, this can be outranked by unrelated content like "I've noted your email address" when searching for "what should I address the user as".

Enriched facts solve this by storing:

- **Search aliases**: Alternative terms that should match this fact
- **Semantic context**: When/how to use this information
- **Category**: Specific sub-category for filtering and boosting
- **Entities**: Named entities with types and full values
- **Relations**: Subject-predicate-object triples for graph integration

### Enrichment Data Flow

```
Input: "My name is Alexander Johnson, call me Alex"
                    ↓
    LLM Enriched Extraction
                    ↓
┌────────────────────────────────────────────────────┐
│ fact: "User prefers to be called Alex"             │
│ category: "addressing_preference"                   │
│ searchAliases: ["name", "nickname", "what to call",│
│                "address as", "greet", "refer to"]  │
│ semanticContext: "Use 'Alex' when addressing..."   │
│ entities: [{name: "Alex", type: "preferred_name",  │
│             fullValue: "Alexander Johnson"}, ...]   │
│ relations: [{subject: "user",                       │
│              predicate: "prefers_to_be_called",    │
│              object: "Alex"}, ...]                 │
└────────────────────────────────────────────────────┘
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
 L3: Facts     L2: Vector       Graph DB
(structured)  (enrichedContent) (entities +
                                relations)
                    ↓
Search: "what should I address the user as"
                    ↓
Result: "User prefers to be called Alex" → TOP RANK ✓
```

### Using Enriched Facts

**1. Store with enrichment fields:**

```typescript
await cortex.facts.store({
  memorySpaceId: "agent-1",
  fact: "User prefers to be called Alex",
  factType: "identity",
  confidence: 95,
  sourceType: "conversation",

  // Enrichment fields
  category: "addressing_preference",
  searchAliases: ["name", "nickname", "what to call", "address as"],
  semanticContext: "Use 'Alex' when addressing this user",
  entities: [
    { name: "Alex", type: "preferred_name", fullValue: "Alexander Johnson" },
  ],
  relations: [
    { subject: "user", predicate: "prefers_to_be_called", object: "Alex" },
  ],
});
```

**2. Search with category boosting:**

```typescript
// Enriched facts with matching category get 30% score boost
const results = await cortex.memory.search(memorySpaceId, query, {
  embedding: await generateEmbedding(query),
  queryCategory: "addressing_preference", // Boost matching facts
});
```

### Extracting Enriched Facts with LLM

Use this prompt template for LLM-based enriched extraction:

```typescript
const ENRICHED_FACT_EXTRACTION_PROMPT = `
You are a fact extraction assistant optimized for retrieval. 
Extract key facts from this conversation with rich metadata.

For each fact, provide:
1. fact: The core fact statement (clear, concise, third-person)
2. factType: Category (preference, identity, knowledge, relationship, event, observation)
3. category: Specific sub-category for search (e.g., "addressing_preference")
4. searchAliases: Array of alternative search terms that should find this fact
5. semanticContext: A sentence explaining when/how to use this information
6. entities: Array of extracted entities with {name, type, fullValue?}
7. relations: Array of {subject, predicate, object} triples
8. confidence: 0-100 confidence score

Return ONLY a valid JSON array.
`;
```

### Graph Integration

When `syncToGraph: true`, enriched facts automatically:

1. Create **Entity nodes** for each item in `entities[]`
2. Create **relationship edges** for each item in `relations[]`
3. Update existing Entity nodes with enriched metadata (fullValue, entityType)

```typescript
// Entities become graph nodes
{name: "Alex", type: "preferred_name", fullValue: "Alexander Johnson"}
// → Entity node: {name: "Alex", entityType: "preferred_name", fullValue: "Alexander Johnson"}

// Relations become graph edges
{subject: "user", predicate: "prefers_to_be_called", object: "Alex"}
// → Edge: (user)-[PREFERS_TO_BE_CALLED]->(Alex)
```

### Search Boosting Logic

When searching with enriched facts, the search engine applies boosts:

| Condition               | Boost |
| ----------------------- | ----- |
| User message role       | +20%  |
| Matching `factCategory` | +30%  |
| Has `enrichedContent`   | +10%  |

This ensures properly enriched facts rank highest for relevant queries.

## Best Practices

### 1. Use Appropriate Fact Types

```typescript
// ✅ Good: Correct type classification
await cortex.facts.store({
  memorySpaceId: "agent-1",
  fact: "User prefers email notifications",
  factType: "preference", // Correct
  confidence: 90,
});

// ❌ Bad: Wrong type
await cortex.facts.store({
  memorySpaceId: "agent-1",
  fact: "User prefers email",
  factType: "identity", // Should be "preference"
  confidence: 90,
});
```

### 2. Link Facts to Sources

```typescript
// ✅ Good: Complete sourceRef
await cortex.facts.store({
  memorySpaceId: "agent-1",
  fact: "User is from California",
  factType: "identity",
  confidence: 95,
  sourceType: "conversation",
  sourceRef: {
    conversationId: "conv-123",
    messageIds: ["msg-1"],
    memoryId: "mem-456", // Enables fact retrieval via memory
  },
});
```

### 3. Set Realistic Confidence

```typescript
// Confidence guidelines:
// 95-100: Direct quotes, explicit statements
// 80-94: Clear implications, strong context
// 60-79: Reasonable inferences
// 40-59: Weak signals, needs validation
// 0-39: Speculative guesses

await cortex.facts.store({
  fact: "User said their name is Alex",
  confidence: 99, // Direct quote
});

await cortex.facts.store({
  fact: "User might prefer dark themes",
  confidence: 55, // Inference from behavior
});
```

### 4. Use Temporal Validity

```typescript
// Fact with expiration
await cortex.facts.store({
  memorySpaceId: "agent-1",
  fact: "User has premium subscription",
  factType: "relationship",
  confidence: 100,
  validFrom: Date.now(),
  validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
  tags: ["subscription"],
});
```

## Common Patterns

### Pattern 1: Extract Facts from Conversation

```typescript
async function extractUserFacts(userMessage: string, agentResponse: string) {
  const facts = [];

  // Identity extraction
  if (userMessage.match(/my name is (\w+)/i)) {
    facts.push({
      fact: `User's name is ${RegExp.$1}`,
      factType: "identity",
      confidence: 99,
      tags: ["name"],
    });
  }

  // Preference extraction
  if (userMessage.match(/prefer (\w+)/i)) {
    facts.push({
      fact: `User prefers ${RegExp.$1}`,
      factType: "preference",
      confidence: 85,
      tags: ["preferences"],
    });
  }

  return facts;
}
```

### Pattern 2: Query User Profile via Facts

```typescript
async function getUserProfile(memorySpaceId: string, userId: string) {
  const allFacts = await cortex.facts.queryBySubject({
    memorySpaceId,
    subject: userId,
  });

  return {
    identity: allFacts.filter((f) => f.factType === "identity"),
    preferences: allFacts.filter((f) => f.factType === "preference"),
    knowledge: allFacts.filter((f) => f.factType === "knowledge"),
    relationships: allFacts.filter((f) => f.factType === "relationship"),
  };
}
```

### Pattern 3: Fact-Enhanced Search

```typescript
async function searchWithFactContext(
  memorySpaceId: string,
  query: string,
  userId: string,
) {
  // Search memories with fact enrichment
  const memories = await cortex.memory.search(memorySpaceId, query, {
    userId,
    enrichConversation: true, // Includes facts
  });

  // Filter to high-confidence facts only
  return memories.map((m) => ({
    memory: m.memory.content,
    facts: m.facts?.filter((f) => f.confidence >= 80) || [],
  }));
}
```

### Pattern 4: Temporal Fact Queries

```typescript
async function getActiveFacts(memorySpaceId: string, userId: string) {
  const allFacts = await cortex.facts.queryBySubject({
    memorySpaceId,
    subject: userId,
  });

  const now = Date.now();

  return allFacts.filter((fact) => {
    const isActive =
      (!fact.validFrom || fact.validFrom <= now) &&
      (!fact.validUntil || fact.validUntil > now) &&
      !fact.supersededBy;

    return isActive;
  });
}
```

## Error Handling

```typescript
try {
  const fact = await cortex.facts.store({
    memorySpaceId: "agent-1",
    fact: "Test fact",
    factType: "knowledge",
    confidence: 90,
    sourceType: "manual",
  });
} catch (error) {
  if (error.message === "INVALID_CONFIDENCE") {
    console.error("Confidence must be 0-100");
  } else if (error.message === "PERMISSION_DENIED") {
    console.error("Cannot access this memory space");
  }
}
```

## Performance Tips

### 1. Batch Fact Storage

```typescript
// ❌ Slow: Sequential storage
for (const factData of facts) {
  await cortex.facts.store(factData);
}

// ✅ Fast: Parallel storage
await Promise.all(facts.map((factData) => cortex.facts.store(factData)));
```

### 2. Use Filters Effectively

```typescript
// ❌ Inefficient: Get all, filter in memory
const all = await cortex.facts.list({ memorySpaceId: "agent-1", limit: 10000 });
const preferences = all.filter((f) => f.factType === "preference");

// ✅ Efficient: Filter in query
const preferences = await cortex.facts.list({
  memorySpaceId: "agent-1",
  factType: "preference",
});
```

### 3. Leverage Memory Enrichment

```typescript
// ❌ Inefficient: Separate queries
const memories = await cortex.memory.search("agent-1", query);
const facts = await Promise.all(
  memories.map((m) => cortex.facts.queryBySubject({ subject: m.userId })),
);

// ✅ Efficient: Single enriched query
const enriched = await cortex.memory.search("agent-1", query, {
  enrichConversation: true, // Facts included automatically
});
```

## Next Steps

- **[Fact Integration Guide](../02-core-features/11-fact-integration.md)** - Extraction strategies and patterns
- **[Memory Operations API](./02-memory-operations.md)** - Memory API integration
- **[Semantic Search Guide](../02-core-features/02-semantic-search.md)** - Using facts in search
- **[Graph Database Integration](../07-advanced-topics/02-graph-database-integration.md)** - Advanced graph queries

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
