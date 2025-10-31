# Facts Operations API

> **Last Updated**: 2025-10-30
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
- ✅ sourceRef linking to memories and conversations
- ✅ Memory space isolation

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
  participantId?: string;           // Hive Mode tracking
  fact: string;                     // Human-readable fact statement
  factType: FactType;               // Category of fact
  subject?: string;                 // Primary entity
  predicate?: string;               // Relationship type
  object?: string;                  // Secondary entity
  confidence: number;               // 0-100 extraction confidence
  sourceType: "conversation" | "system" | "tool" | "manual";
  sourceRef?: {
    conversationId?: string;
    messageIds?: string[];
    memoryId?: string;              // Link to memory
  };
  metadata?: any;
  tags?: string[];
  validFrom?: number;               // Temporal validity start
  validUntil?: number;              // Temporal validity end
}

interface StoreFactOptions {
  syncToGraph?: boolean;            // Sync to graph DB (default: true if configured)
}
```

**Example:**
```typescript
const fact = await cortex.facts.store({
  memorySpaceId: "agent-1",
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

console.log(fact.factId);  // "fact-1730123456789-abc123"
```

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
  console.log(fact.fact);        // "User prefers dark mode"
  console.log(fact.confidence);  // 95
  console.log(fact.version);     // 1
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
  memorySpaceId: string;
  factType?: FactType;              // Filter by type
  subject?: string;                 // Filter by subject entity
  tags?: string[];                  // Filter by tags
  includeSuperseded?: boolean;      // Include old versions (default: false)
  limit?: number;                   // Max results (default: 100)
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
  factType?: FactType;
  minConfidence?: number;           // Filter by confidence threshold
  tags?: string[];
  limit?: number;
}
```

**Example:**
```typescript
const foodFacts = await cortex.facts.search("agent-1", "food preferences", {
  factType: "preference",
  minConfidence: 80,
  limit: 10,
});

foodFacts.forEach(fact => {
  console.log(`${fact.fact} (${fact.confidence}% confidence)`);
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
  fact?: string;                    // New fact statement
  confidence?: number;              // Updated confidence
  tags?: string[];                  // Updated tags
  validUntil?: number;              // Set expiration
  metadata?: any;                   // Updated metadata
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
  validUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,  // 30 days
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
  syncToGraph: true,  // Remove from graph DB
});
```

### `facts.count()`

Count facts matching filters.

**Signature:**
```typescript
async count(filter: CountFactsFilter): Promise<number>
```

**Parameters:**
```typescript
interface CountFactsFilter {
  memorySpaceId: string;
  factType?: FactType;
  includeSuperseded?: boolean;
}
```

**Example:**
```typescript
const totalPreferences = await cortex.facts.count({
  memorySpaceId: "agent-1",
  factType: "preference",
});

console.log(`Found ${totalPreferences} user preferences`);
```

## Query Operations

### `facts.queryBySubject()`

Get all facts about a specific entity.

**Signature:**
```typescript
async queryBySubject(filter: {
  memorySpaceId: string;
  subject: string;
  factType?: FactType;
}): Promise<FactRecord[]>
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
```

### `facts.queryByRelationship()`

Get facts with specific relationship (graph traversal).

**Signature:**
```typescript
async queryByRelationship(filter: {
  memorySpaceId: string;
  subject: string;
  predicate: string;
}): Promise<FactRecord[]>
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

history.forEach(version => {
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
  keepFactId: "fact-1",  // Keep this one, merge others
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
  extractFacts: async (user, agent) => [{
    fact: "User is a developer",
    factType: "identity",
    confidence: 95,
  }],
});

console.log(result.facts);  // Extracted facts returned
```

### Automatic Enrichment

```typescript
// Facts included in search results
const memories = await cortex.memory.search("agent-1", "user info", {
  enrichConversation: true,  // Facts automatically included
});

memories.forEach(m => {
  console.log(`Memory: ${m.memory.content}`);
  m.facts?.forEach(f => {
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
  participantId?: string;
  fact: string;
  factType: FactType;
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
  tags: string[];
  validFrom?: number;
  validUntil?: number;
  version: number;
  supersededBy?: string;
  supersedes?: string;
  createdAt: number;
  updatedAt: number;
}
```

### FactType

```typescript
type FactType = 
  | "preference"      // User likes/dislikes
  | "identity"        // Who/what someone is
  | "knowledge"       // Information/skills  
  | "relationship"    // Connections between entities
  | "event"           // Time-based occurrences
  | "custom";         // Domain-specific
```

## Best Practices

### 1. Use Appropriate Fact Types

```typescript
// ✅ Good: Correct type classification
await cortex.facts.store({
  memorySpaceId: "agent-1",
  fact: "User prefers email notifications",
  factType: "preference",  // Correct
  confidence: 90,
});

// ❌ Bad: Wrong type
await cortex.facts.store({
  memorySpaceId: "agent-1",
  fact: "User prefers email",
  factType: "identity",  // Should be "preference"
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
    memoryId: "mem-456",  // Enables fact retrieval via memory
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
  confidence: 99,  // Direct quote
});

await cortex.facts.store({
  fact: "User might prefer dark themes",
  confidence: 55,  // Inference from behavior
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
  validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,  // 1 year
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
    identity: allFacts.filter(f => f.factType === "identity"),
    preferences: allFacts.filter(f => f.factType === "preference"),
    knowledge: allFacts.filter(f => f.factType === "knowledge"),
    relationships: allFacts.filter(f => f.factType === "relationship"),
  };
}
```

### Pattern 3: Fact-Enhanced Search

```typescript
async function searchWithFactContext(
  memorySpaceId: string,
  query: string,
  userId: string
) {
  // Search memories with fact enrichment
  const memories = await cortex.memory.search(memorySpaceId, query, {
    userId,
    enrichConversation: true,  // Includes facts
  });

  // Filter to high-confidence facts only
  return memories.map(m => ({
    memory: m.memory.content,
    facts: m.facts?.filter(f => f.confidence >= 80) || [],
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

  return allFacts.filter(fact => {
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
await Promise.all(
  facts.map(factData => cortex.facts.store(factData))
);
```

### 2. Use Filters Effectively

```typescript
// ❌ Inefficient: Get all, filter in memory
const all = await cortex.facts.list({ memorySpaceId: "agent-1", limit: 10000 });
const preferences = all.filter(f => f.factType === "preference");

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
  memories.map(m => cortex.facts.queryBySubject({ subject: m.userId }))
);

// ✅ Efficient: Single enriched query
const enriched = await cortex.memory.search("agent-1", query, {
  enrichConversation: true,  // Facts included automatically
});
```

## Next Steps

- **[Fact Integration Guide](../02-core-features/11-fact-integration.md)** - Extraction strategies and patterns
- **[Memory Operations API](./02-memory-operations.md)** - Memory API integration
- **[Semantic Search Guide](../02-core-features/02-semantic-search.md)** - Using facts in search
- **[Graph Database Integration](../07-advanced-topics/02-graph-database-integration.md)** - Advanced graph queries

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).

