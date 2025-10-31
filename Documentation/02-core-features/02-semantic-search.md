# Semantic Search

> **Last Updated**: 2025-10-30

AI-powered memory retrieval with multi-strategy fallback for robust results.

## Overview

Semantic search goes beyond keyword matching - it understands **meaning**. When you search for "what's the user's favorite color?", it finds memories about color preferences even if they don't contain the exact words "favorite color".

**How it works with Cortex's hybrid architecture:**

- Searches the **Vector Memory Index** (Layer 2)
- Returns memories with `conversationRef` links to ACID (Layer 1)
- Can optionally retrieve full conversation from **ACID store** for complete context
- Embeddings are **optional** - falls back to text search if not provided

**API Note:** This guide uses `cortex.memory.search()` (Layer 3 convenience API) which searches the Vector index and can optionally enrich with ACID conversations. For direct control, use `cortex.vector.search()` (Layer 2).

## How It Works

### Vector Similarity

Cortex uses vector embeddings to find similar meanings:

```
Query: "what does the user like to eat?"
Embedding: [0.234, -0.891, 0.445, ...]

Memories:
1. "User loves Italian food"        → Similarity: 0.92 ✅
2. "User is vegetarian"              → Similarity: 0.85 ✅
3. "User mentioned work deadline"    → Similarity: 0.23 ❌

Returns: Memories 1 and 2
```

### Basic Semantic Search

```typescript
// User asks a question
const query = "what are the user's dietary preferences?";

// Generate embedding for the query (optional but preferred)
const queryEmbedding = await embed(query);

// Search agent's memories (Layer 3 - searches Vector, can enrich with ACID)
const memories = await cortex.memory.search("my-agent", query, {
  embedding: queryEmbedding, // Optional: enables semantic search
  userId: "user-123", // Only search this user's context
  limit: 5,
});

// Results ordered by relevance
memories.forEach((memory, i) => {
  console.log(`${i + 1}. ${memory.content} (score: ${memory.score})`);
  console.log(`   Type: ${memory.contentType} (raw or summarized)`);
  console.log(
    `   From: ${memory.source.userName} on ${memory.source.timestamp}`,
  );

  // Optionally get full conversation context from ACID
  if (memory.conversationRef) {
    console.log(
      `   Full context available: conv-${memory.conversationRef.conversationId}`,
    );
  }
});

// Or get with ACID enrichment automatically (Layer 3 option)
const enriched = await cortex.memory.search("my-agent", query, {
  embedding: queryEmbedding,
  userId: "user-123",
  enrichConversation: true, // Fetches ACID conversations too
});
```

## Multi-Strategy Retrieval

Cortex uses **three progressive strategies** to ensure you always get results:

### Strategy 1: Semantic Vector Search

Primary method using embeddings (when provided):

```typescript
// Try semantic search first (Layer 3 - searches Vector index)
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query), // Vector similarity
  strategy: "semantic",
});

// Or use Layer 2 directly for explicit control
const vectorResults = await cortex.vector.search(memorySpaceId, query, {
  embedding: await embed(query),
});
```

**When it works best:**

- Complex queries with natural language
- Finding related concepts ("car" matches "automobile")
- Broad topic searches
- When embeddings are available

**When it struggles:**

- Exact term matching (names, IDs, codes)
- Very specific technical terms
- Empty result set if no semantic match
- **Requires embeddings** - falls back to keyword if not provided

### Strategy 2: Keyword/Text Search

Fallback to text-based search (always available, no embeddings needed):

```typescript
// If semantic search returns nothing (or no embeddings), try keywords
// Layer 3 - automatically falls back to keyword search
if (memories.length === 0) {
  memories = await cortex.memory.search(memorySpaceId, query, {
    strategy: "keyword", // Text-based search (works without embeddings)
  });
}

// Or explicitly use text search (no embeddings required)
const memories = await cortex.memory.search(memorySpaceId, query, {
  // No embedding provided - Layer 3 uses text search on Vector index
  strategy: "keyword",
});
```

**How it works:**

1. Extracts content words from query
2. Removes stop words (the, and, is, etc.)
3. Searches `content` field in Vector Memory Index

```
Query: "What did we discuss about the project deadline?"
Content words: "discuss", "project", "deadline"
Matches: Any memory.content containing these words
```

**When it works best:**

- Exact term matching
- Names, codes, specific identifiers
- When embeddings not available
- When semantic search finds nothing
- Cost-sensitive scenarios (no embedding generation)

### Strategy 3: Recent Memories

Final fallback - return recent context:

```typescript
// If both strategies fail, get recent memories
if (memories.length === 0) {
  memories = await cortex.memory.search(agentId, "*", {
    sortBy: "createdAt",
    sortOrder: "desc",
    limit: 20,
  });
}
```

**When it works:**

- User asking "what did we talk about?"
- Browsing recent conversation
- Finding context when nothing else works

### Automatic Multi-Strategy

Cortex (Layer 3) automatically tries strategies based on what you provide:

```typescript
// With embedding - tries semantic → keyword → recent
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query), // Enables semantic search on Vector index
});

// Without embedding - tries keyword → recent
const memories = await cortex.memory.search(agentId, query);
// No embedding - uses text search on Vector index

// Layer 3 (cortex.memory) internally does:
// 1. Try semantic search on Vector (if embedding provided)
// 2. If empty, try keyword search on Vector (always available)
// 3. If still empty, return recent memories from Vector
```

**Override automatic behavior:**

```typescript
// Force specific strategy
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  strategy: "semantic-only", // Don't fall back
  allowEmpty: true, // OK to return empty results
});

// Text-only search (no embeddings needed)
const memories = await cortex.memory.search(memorySpaceId, query, {
  strategy: "keyword", // Skip semantic even if embeddings exist
  allowEmpty: false, // Fall back to recent if empty
});
```

## Universal Filters in Search

> **Core Principle**: All filter options work the same across search, update, delete, and other operations. Learn once, use everywhere.

### Basic Options

```typescript
await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query), // Vector for semantic search
  limit: 10, // Max results (default: 20)
  offset: 0, // Pagination offset
});
```

### Filtering

All filters from Agent Memory work in search:

```typescript
await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),

  // Filter by user (critical for multi-user agents)
  userId: "user-123",

  // Filter by tags
  tags: ["preferences", "user-info"],
  tagMatch: "any", // 'any' or 'all'

  // Filter by importance (0-100 scale)
  importance: { $gte: 50 }, // Medium and above
  // or
  minImportance: 50, // Shorthand for $gte

  // Filter by date range
  createdAfter: new Date("2025-10-01"),
  createdBefore: new Date("2025-10-31"),

  // Filter by access patterns
  accessCount: { $gte: 5 }, // Frequently accessed
  lastAccessedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),

  // Filter by version
  version: { $gte: 2 }, // Only updated memories

  // Filter by source type
  "source.type": "conversation",

  // Filter by custom metadata
  metadata: {
    reviewed: true,
    priority: "high",
  },
});
```

### Scoring & Ranking

```typescript
await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),

  // Minimum similarity score (0-1)
  minScore: 0.75, // Only results with >75% similarity

  // Boost by importance (0-100 scale)
  boostImportance: true, // Adds (importance/100) * 0.2 to score

  // Boost by recency
  boostRecent: true, // Recent memories get small boost

  // Boost by access count
  boostPopular: true, // Frequently accessed get small boost

  // Custom sorting
  sortBy: "score", // or 'createdAt', 'accessCount', 'importance', 'updatedAt'
  sortOrder: "desc",
});
```

### Pagination

```typescript
// Get first page
const page1 = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  limit: 20,
  offset: 0,
});

// Get second page
const page2 = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  limit: 20,
  offset: 20,
});

// Total count available
console.log(`Found ${page1.total} total memories`);
```

## Search Result Format

```typescript
interface SearchResult {
  // The memory (same as MemoryEntry)
  id: string;
  memorySpaceId: string;
  userId?: string;

  // Content
  content: string;
  contentType: "raw" | "summarized";
  embedding?: number[]; // Optional

  // Source
  source: {
    type: "conversation" | "system" | "tool" | "a2a";
    userId?: string;
    userName?: string;
    timestamp: Date;
  };

  // Conversation Reference (links to ACID source)
  conversationRef?: {
    conversationId: string;
    messageIds: string[];
  };

  // Metadata
  metadata: {
    importance: number; // 0-100
    tags: string[];
    [key: string]: any;
  };

  // Tracking
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  accessCount: number;
  version: number;
  previousVersions?: MemoryVersion[];

  // Search-specific metadata
  score: number; // Similarity score (0-1)
  strategy: "semantic" | "keyword" | "recent"; // Which strategy found it
  highlights?: string[]; // Matched text snippets
  explanation?: string; // Why this was matched (cloud mode)
}
```

> **Note**: Search returns complete `MemoryEntry` objects with additional search metadata (score, strategy, highlights).
>
> **ACID + Vector**: If `conversationRef` is present, you can retrieve the full original conversation from ACID storage using `cortex.conversations.get(conversationRef.conversationId)`.

## Advanced Search Patterns

### Pattern 1: User-Scoped Multi-Tag Search

Find memories with any of several tags for a specific user:

```typescript
// Find any issue-related memories for this user
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  userId: "user-123", // Scope to user
  tags: ["bug", "issue", "error"], // OR logic
  tagMatch: "any", // Match any tag (default)
});

// Or require ALL tags
const memories = await cortex.memory.search(memorySpaceId, query, {
  userId: "user-123",
  tags: ["preferences", "verified"],
  tagMatch: "all", // Must have both tags
});
```

### Pattern 2: Hybrid Search (Semantic + Keyword)

Combine both strategies for best results:

```typescript
// Generate query embedding
const queryEmbedding = await embed(query);

// Extract keywords from query
const keywords = extractKeywords(query); // ['deadline', 'project', 'Q4']

// Hybrid search
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: queryEmbedding,
  keywords: keywords,
  hybridWeight: 0.7, // 70% semantic, 30% keyword
});
```

### Pattern 3: Contextual Re-ranking

Re-rank results based on additional context:

```typescript
// Initial search
let memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  userId, // Scoped to user
  limit: 20, // Get more than needed
});

// Re-rank based on conversation context
const conversationTags = ["support", "billing"];
memories = memories
  .map((m) => ({
    ...m,
    // Combine semantic score with context relevance and importance
    contextScore:
      m.score * 0.5 + // Semantic similarity
      m.metadata.tags.filter((t) => conversationTags.includes(t)).length * 0.1 + // Tag match
      (m.metadata.importance / 100) * 0.2 + // Importance boost
      (m.accessCount > 5 ? 0.1 : 0) + // Popularity boost
      (isRecent(m.createdAt) ? 0.1 : 0), // Recency boost
  }))
  .sort((a, b) => b.contextScore - a.contextScore)
  .slice(0, 5); // Top 5 after re-ranking
```

### Pattern 4: Temporal Search

Find memories from specific time periods:

```typescript
// Memories from this week
const thisWeek = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  dateRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  },
});

// Memories before a specific date
const before = await cortex.memory.search(memorySpaceId, query, {
  dateRange: {
    end: new Date("2025-10-01"),
  },
});
```

### Pattern 5: Importance-Weighted Search

Combine semantic similarity with importance:

```typescript
// Critical information only
const critical = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  userId,
  importance: { $gte: 90 }, // Critical importance only
  minScore: 0.75, // Still require good semantic match
});

// High-confidence + high-importance
const highConfidence = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  userId,
  minScore: 0.85, // 85%+ similarity
  minImportance: 70, // High importance (70+)
  boostImportance: true, // Boost scores by importance
});

// Broad search across all importance levels
const broadSearch = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  userId,
  minScore: 0.5, // 50%+ similarity
  minImportance: 0, // Include everything
});
```

## Performance Optimization

### Optimize Embedding Calls

Embeddings are expensive - cache and reuse:

```typescript
// ❌ Slow - generate embedding every time
for (const query of queries) {
  const embedding = await embed(query);
  await cortex.memory.search(memorySpaceId, query, { embedding });
}

// ✅ Fast - batch embeddings
const embeddings = await embedBatch(queries);
for (let i = 0; i < queries.length; i++) {
  await cortex.memory.search(agentId, queries[i], {
    embedding: embeddings[i],
  });
}
```

### Use Appropriate Limits

Don't retrieve more than you need:

```typescript
// ❌ Wasteful
const memories = await cortex.memory.search(memorySpaceId, query, {
  limit: 100, // Getting 100 results...
});
const top3 = memories.slice(0, 3); // ...but only using 3

// ✅ Efficient
const memories = await cortex.memory.search(memorySpaceId, query, {
  limit: 3, // Only get what you need
});
```

### Smart Filtering

Filter before searching when possible:

```typescript
// ❌ Search everything, then filter
const all = await cortex.memory.search(memorySpaceId, query, { limit: 100 });
const highPriority = all.filter((m) => m.metadata.importance === "high");

// ✅ Filter during search
const highPriority = await cortex.memory.search(memorySpaceId, query, {
  minImportance: "high",
  limit: 20,
});
```

## Embedding Models Comparison

Different models for different needs:

| Model                           | Dimensions | Speed     | Accuracy | Cost | Best For                    |
| ------------------------------- | ---------- | --------- | -------- | ---- | --------------------------- |
| text-embedding-3-small (OpenAI) | 1536       | Fast      | Good     | $    | General purpose             |
| text-embedding-3-large (OpenAI) | 3072       | Medium    | Best     | $$   | When accuracy critical      |
| embed-english-v3.0 (Cohere)     | 1024       | Fast      | Good     | $    | English content             |
| all-MiniLM-L6-v2 (local)        | 384        | Very Fast | Fair     | Free | High-volume, cost-sensitive |

### Choosing the Right Model

**High-accuracy use cases** (customer support, medical, legal):

```typescript
// Use large embeddings
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-large",
  input: text,
});
// 3072 dimensions - best accuracy
```

**High-volume use cases** (chat, social, gaming):

```typescript
// Use smaller embeddings
const embedding = await localModel.encode(text);
// 384 dimensions - fast and free
```

**Balanced use cases** (most applications):

```typescript
// Use standard embeddings
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});
// 1536 dimensions - good balance
```

## Search Quality Metrics

### Measuring Search Performance

```typescript
// Track search quality
async function evaluateSearch(memorySpaceId: string, testCases: TestCase[]) {
  const results = [];

  for (const test of testCases) {
    const memories = await cortex.memory.search(agentId, test.query, {
      embedding: await embed(test.query),
      limit: 5,
    });

    // Check if expected memory was found
    const found = memories.some((m) => m.id === test.expectedMemoryId);
    const rank = memories.findIndex((m) => m.id === test.expectedMemoryId) + 1;

    results.push({
      query: test.query,
      found,
      rank,
      topScore: memories[0]?.score,
    });
  }

  // Calculate metrics
  const precision = results.filter((r) => r.found).length / results.length;
  const avgRank =
    results.filter((r) => r.found).reduce((sum, r) => sum + r.rank, 0) /
    results.filter((r) => r.found).length;

  console.log({
    precision: `${(precision * 100).toFixed(1)}%`,
    avgRank: avgRank.toFixed(1),
    totalTests: results.length,
  });
}
```

## Cloud Mode Features

> **Cloud Mode Only**: Advanced search features available with Cortex Cloud subscription

### Search Analytics

Track search performance:

- Most common queries
- Success rate by query type
- Average result relevance
- Strategy distribution (semantic vs keyword vs recent)

### Auto-Optimization

Cortex Cloud automatically optimizes:

- Suggests better embedding models
- Identifies poorly-tagged memories
- Recommends importance adjustments
- Detects duplicate or near-duplicate memories

### Search Explanations

Understand why results were returned:

```typescript
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  explainResults: true, // Cloud mode only
});

memories.forEach((m) => {
  console.log(m.explanation);
  // "Matched because: 85% semantic similarity to query,
  //  contains keywords 'user' and 'preference',
  //  tagged with 'user-info'"
});
```

## Best Practices

### 1. Provide Embeddings When Possible, Always Scope by User

```typescript
// ❌ No embedding, no user scope (fallback to keyword search, all users)
await cortex.memory.search(agentId, query);

// ⚠️ Text search only, no user scope
await cortex.memory.search(memorySpaceId, query, {
  userId: userId, // Good - scoped, but uses text search
});

// ⚠️ Semantic search but not scoped
await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query), // Good - semantic, but searches all users
});

// ✅ Full semantic search with user context
await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query), // Best: semantic search
  userId: userId, // Critical: scoped to user
});
```

**Progressive enhancement:**

- Start: Text search (no embeddings) - works immediately
- Add: Embeddings for semantic search - better results
- Optimize: Summarized content - reduce storage
- All while maintaining ACID source via conversationRef

### 2. Use Descriptive Queries

```typescript
// ❌ Vague
const memories = await cortex.memory.search(agentId, "user");

// ✅ Specific
const memories = await cortex.memory.search(
  agentId,
  "what are the user's dietary restrictions and food preferences?",
);
```

### 3. Set Reasonable Limits

```typescript
// For context building
const context = await cortex.memory.search(memorySpaceId, query, {
  limit: 5, // Just enough context, not overwhelming
});

// For comprehensive search
const all = await cortex.memory.search(memorySpaceId, query, {
  limit: 50, // When you need more coverage
});
```

### 4. Combine with Filters

```typescript
// Narrow search with filters (all filters work together)
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  userId, // User scope
  tags: ["high-priority"],
  minImportance: 80, // High importance (0-100)
  createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  limit: 10,
});
```

### 5. Handle Empty Results

```typescript
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  userId,
});

if (memories.length === 0) {
  // Fallback strategy - broaden the search
  console.log("No specific memories found. Checking broader context...");

  // Try without userId filter (general knowledge)
  let broader = await cortex.memory.search(memorySpaceId, query, {
    embedding: await embed(query),
    // No userId - search general knowledge
    limit: 5,
  });

  // Still nothing? Get recent context for this user
  if (broader.length === 0) {
    broader = await cortex.memory.search(agentId, "*", {
      userId,
      sortBy: "createdAt",
      sortOrder: "desc",
      limit: 10,
    });
  }

  // Use broader results as context
  memories = broader;
}
```

## Common Use Cases

### Use Case 1: Conversational Context

Build context for LLM prompts with optional ACID enrichment:

```typescript
async function buildPromptContext(
  memorySpaceId: string,
  userId: string,
  userMessage: string,
  enrichWithFullContext: boolean = false,
) {
  // Search vector memories for relevant knowledge
  const embedding = await embed(userMessage);
  const memories = await cortex.memory.search(agentId, userMessage, {
    embedding,
    userId, // Only this user's context
    minScore: 0.7,
    minImportance: 40, // Skip trivial info
    limit: 5,
  });

  // Optionally enrich with full ACID conversation context
  const enrichedMemories = enrichWithFullContext
    ? await Promise.all(
        memories.map(async (m) => {
          if (m.conversationRef) {
            const conversation = await cortex.conversations.get(
              m.conversationRef.conversationId,
            );
            const messages = conversation.messages.filter((msg) =>
              m.conversationRef.messageIds.includes(msg.id),
            );
            return {
              summary: m.content, // From vector index
              fullContext: messages.map((msg) => msg.text).join(" "), // From ACID
              when: m.createdAt,
            };
          }
          return {
            summary: m.content,
            fullContext: m.content,
            when: m.createdAt,
          };
        }),
      )
    : memories.map((m) => ({
        summary: m.content,
        fullContext: m.content,
        when: m.createdAt,
      }));

  // Format for LLM
  const context =
    enrichedMemories.length > 0
      ? `Relevant context from memory:\n${enrichedMemories
          .map((m) => `- ${m.summary} (${formatDate(m.when)})`)
          .join("\n")}`
      : "No specific prior context found.";

  return {
    systemPrompt: `You are a helpful assistant. ${context}`,
    userMessage,
    fullContextAvailable: enrichedMemories.some(
      (m) => m.summary !== m.fullContext,
    ),
  };
}
```

### Use Case 2: Fact Retrieval

Find specific facts:

```typescript
async function retrieveFact(
  memorySpaceId: string,
  userId: string,
  question: string,
) {
  const memories = await cortex.memory.search(agentId, question, {
    embedding: await embed(question),
    userId, // User-specific facts
    limit: 1,
    minScore: 0.8, // High confidence threshold
    minImportance: 50, // Skip low-importance info
  });

  if (memories.length > 0 && memories[0].score > 0.8) {
    return {
      fact: memories[0].content,
      confidence: memories[0].score,
      source: memories[0].source,
      importance: memories[0].metadata.importance,
      when: memories[0].createdAt,
    };
  }

  return { fact: null, confidence: 0 };
}
```

### Use Case 3: Related Information

Find all related memories:

```typescript
async function findRelatedMemories(memorySpaceId: string, memoryId: string) {
  // Get the source memory
  const source = await cortex.memory.get(agentId, memoryId);

  // Search for similar memories
  const related = await cortex.memory.search(agentId, source.content, {
    embedding: source.embedding,
    minScore: 0.7,
    excludeIds: [memoryId], // Don't include source
  });

  return related;
}
```

### Use Case 4: Topic Exploration

Explore what agent knows about a topic:

```typescript
async function exploreTopicArea(
  memorySpaceId: string,
  userId: string | null, // null = all users
  topic: string,
) {
  // Broad search
  const memories = await cortex.memory.search(agentId, topic, {
    embedding: await embed(topic),
    ...(userId && { userId }), // Filter to user if provided
    limit: 50,
    minScore: 0.6, // Lower threshold for exploration
  });

  // Group by tags
  const byTag = {};
  memories.forEach((m) => {
    m.metadata.tags.forEach((tag) => {
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push(m);
    });
  });

  // Group by user
  const byUser = {};
  memories.forEach((m) => {
    const uid = m.userId || "system";
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(m);
  });

  // Group by importance range
  const byImportance = {
    critical: memories.filter((m) => m.metadata.importance >= 90),
    high: memories.filter(
      (m) => m.metadata.importance >= 70 && m.metadata.importance < 90,
    ),
    medium: memories.filter(
      (m) => m.metadata.importance >= 40 && m.metadata.importance < 70,
    ),
    low: memories.filter((m) => m.metadata.importance < 40),
  };

  // Return organized view
  return {
    total: memories.length,
    byTag,
    byUser,
    byImportance,
    topMemories: memories.slice(0, 10),
  };
}
```

## Troubleshooting

### Search Returns Irrelevant Results

**Causes:**

- Query embedding doesn't match content embeddings
- Different embedding models used
- Score threshold too low
- Not enough memories to search

**Solutions:**

```typescript
// 1. Increase score threshold
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  minScore: 0.75, // Raise from default 0.5
});

// 2. Add tag filters
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  tags: ["relevant-topic"], // Narrow scope
});

// 3. Use same embedding model consistently
// Make sure query and stored memories use same model/version
```

### Search is Too Slow

**Causes:**

- Too many memories to search
- Large embedding dimensions
- Complex filters
- Convex query performance

**Solutions:**

```typescript
// 1. Reduce search scope with filters
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  tags: ['recent'],  // Narrow to subset
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
  }
});

// 2. Use smaller embeddings (if accuracy allows)
const smallEmbedding = await embed(query, { dimensions: 768 });

// 3. Implement caching
const cacheKey = `search:${agentId}:${query}`;
const cached = cache.get(cacheKey);
if (cached) return cached;

const memories = await cortex.memory.search(memorySpaceId, query, {...});
cache.set(cacheKey, memories, { ttl: 60 }); // Cache for 60 seconds
```

### No Results Found

**Causes:**

- No matching memories exist
- Query too specific
- Score threshold too high
- Wrong agent ID

**Solutions:**

```typescript
// 1. Try broader query
if (memories.length === 0) {
  // Extract main concept
  const broader = simplifyQuery(query); // "user food preferences" → "food"
  memories = await cortex.memory.search(agentId, broader, {
    embedding: await embed(broader),
  });
}

// 2. Lower score threshold
const memories = await cortex.memory.search(memorySpaceId, query, {
  embedding: await embed(query),
  minScore: 0.5, // Lower threshold
});

// 3. Check if any memories exist
const total = await cortex.memory.count(agentId);
if (total === 0) {
  console.log("Agent has no memories yet");
}
```

## Testing Search Quality

### Creating Test Cases

```typescript
// Define expected behavior
const searchTests = [
  {
    query: "what is the user's favorite food?",
    expectedContent: "User loves pizza",
    minScore: 0.8,
  },
  {
    query: "user dietary restrictions",
    expectedContent: "User is vegetarian",
    minScore: 0.75,
  },
];

// Run tests
for (const test of searchTests) {
  const memories = await cortex.memory.search(agentId, test.query, {
    embedding: await embed(test.query),
    limit: 5,
  });

  const found = memories.some(
    (m) => m.content.includes(test.expectedContent) && m.score >= test.minScore,
  );

  console.log(`${test.query}: ${found ? "PASS" : "FAIL"}`);
}
```

## Integration with Facts Layer

Cortex automatically extracts and indexes structured facts during `memory.remember()`, making them available in search results:

```typescript
// Remember with automatic fact extraction
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I prefer dark mode and I'm from San Francisco",
  agentResponse: "Got it!",
  userId: "user-123",
  userName: "Alex",
  
  // Extract facts for structured knowledge
  extractFacts: async (userMsg, agentMsg) => {
    return [
      {
        fact: "User prefers dark mode",
        factType: "preference",
        confidence: 95,
        tags: ["ui"],
      },
      {
        fact: "User is from San Francisco",
        factType: "identity",
        confidence: 98,
        tags: ["location"],
      },
    ];
  },
});

// Search returns memories WITH extracted facts
const memories = await cortex.memory.search("agent-1", "user preferences", {
  embedding: await embed("user preferences"),
  enrichConversation: true,  // Facts automatically included
});

memories.forEach(memory => {
  console.log(`Memory: ${memory.memory.content}`);
  
  // Access extracted facts
  if (memory.facts) {
    memory.facts.forEach(fact => {
      console.log(`  Fact: ${fact.fact} (${fact.confidence}% confidence)`);
    });
  }
});
```

**Benefits of fact integration:**

- **Structured knowledge**: Facts are normalized and queryable
- **Higher precision**: Search "user preferences" finds preference-type facts
- **Confidence scoring**: Filter by extraction confidence (0-100)
- **Cross-referencing**: Facts link back to source conversations via `sourceRef`

See **[Fact Integration](./11-fact-integration.md)** for complete documentation on automatic fact extraction in Memory API.

## Next Steps

- **[User Profiles](./03-user-profiles.md)** - Manage user context across agents
- **[Context Chains](./04-context-chains.md)** - Hierarchical agent coordination
- **[Fact Integration](./11-fact-integration.md)** - Extract structured knowledge from conversations
- **[API Reference](../03-api-reference/06-search-operations.md)** - Complete search API

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
