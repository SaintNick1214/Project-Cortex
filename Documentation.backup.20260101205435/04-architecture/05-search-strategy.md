# Search Strategy

> **Last Updated**: 2026-01-01

Multi-strategy search implementation: semantic, keyword, facts, temporal, and hybrid approaches.

## Overview

Cortex provides **four primary search strategies** that can be used independently or combined:

1. **Semantic Search** - Vector similarity (meaning-based)
2. **Facts Search** - Structured knowledge from Layer 3 (most efficient)
3. **Keyword Search** - Full-text matching (exact words)
4. **Temporal Search** - Recent/time-based retrieval

The `recall()` method (v0.24.0+) automatically combines strategies for optimal results.

```
┌─────────────────────────────────────────────────────────────┐
│              Search Strategy Selection                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  recall() call ───────────────┐                             │
│                                │                             │
│  ┌────────────────────────────┼────────────────┐            │
│  │                            │                │            │
│  ↓                            ↓                ↓            │
│  Facts Search           Vector Search    Recent Search      │
│  (Layer 3)              (Layer 2)        (Layer 2)          │
│                                                             │
│  ↓                            ↓                ↓            │
│  └────────────────────────────┼────────────────┘            │
│                                │                             │
│  ┌────────────────────────────┼────────────────┐            │
│  │      Merge + Deduplicate + Rank              │            │
│  │  (Multi-signal scoring algorithm)            │            │
│  └──────────────────────────────────────────────┘            │
│                                                             │
│  Optional: Boost by recency, importance, access             │
└─────────────────────────────────────────────────────────────┘
```

---

## Strategy 1: Semantic Search

### How It Works

Uses vector embeddings and cosine similarity:

```typescript
// User query
const query = "What is the user's preferred communication method?";

// Generate query embedding
const queryEmbedding = await embed(query);

// Convex vector search
const results = await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q
      .similar("embedding", queryEmbedding, 20)
      .eq("memorySpaceId", memorySpaceId),
  )
  .collect();

// Returns:
// 1. "User prefers email over phone" (0.92 similarity)
// 2. "Email is best way to reach user" (0.88 similarity)
// 3. "User doesn't like phone calls" (0.85 similarity)
// Even though exact words don't match! ✅
```

**Strengths:**

- ✅ Finds meaning, not just words
- ✅ Handles synonyms ("car" matches "vehicle")
- ✅ Understands context
- ✅ Works across languages (with multilingual models)

**Weaknesses:**

- ❌ Requires embeddings (cost + latency)
- ❌ Can miss exact matches
- ❌ Less predictable than keywords

**Best for:**

- Natural language queries
- Conceptual matching
- Cross-language search
- Fuzzy matching

### Implementation

```typescript
export const semanticSearch = query({
  args: {
    memorySpaceId: v.string(),
    embedding: v.array(v.float64()),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("memories").withIndex("by_embedding", (q) => {
      let search = q
        .similar("embedding", args.embedding, args.filters.limit || 20)
        .eq("memorySpaceId", args.memorySpaceId);

      // Apply tenantId filter (pre-filtered via filterFields)
      if (args.filters.tenantId) {
        search = search.eq("tenantId", args.filters.tenantId);
      }

      return search;
    });

    // Apply additional filters
    if (args.filters.userId) {
      q = q.filter((q) => q.eq(q.field("userId"), args.filters.userId));
    }

    if (args.filters.participantId) {
      q = q.filter((q) =>
        q.eq(q.field("participantId"), args.filters.participantId),
      );
    }

    const results = await q.collect();

    // Calculate similarity scores
    return results.map((memory) => ({
      ...memory,
      score: cosineSimilarity(memory.embedding, args.embedding),
      strategy: "semantic",
    }));
  },
});
```

---

## Strategy 2: Facts Search (Layer 3) ✨

### How It Works

Searches structured facts from Layer 3 - the most token-efficient strategy:

```typescript
// User query
const query = "What is the user's communication preference?";

// Facts search
const results = await ctx.db
  .query("facts")
  .withSearchIndex("by_content", (q) =>
    q.search("fact", query).eq("memorySpaceId", memorySpaceId),
  )
  .collect();

// Returns:
// 1. "User prefers email for communication" (fact)
// 2. "User dislikes phone calls" (fact)
// 3. "User checks email twice daily" (fact)
// Each fact is ~8 tokens vs 50+ tokens for raw conversation
```

**Strengths:**

- ✅ Most token-efficient (60-90% savings)
- ✅ Structured knowledge (subject-predicate-object)
- ✅ High confidence (LLM-extracted)
- ✅ Deduplication via Belief Revision System
- ✅ Enables infinite context capability

**Weaknesses:**

- ❌ Requires LLM for extraction (initial cost)
- ❌ May miss nuance from raw conversation
- ❌ Confidence scoring needed

**Best for:**

- Long-running conversations (infinite context)
- Entity-centric queries (subject-based)
- Knowledge retrieval across sessions
- Token-constrained environments

### Implementation

```typescript
export const factsSearch = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("facts")
      .withSearchIndex("by_content", (q) =>
        q.search("fact", args.query).eq("memorySpaceId", args.memorySpaceId),
      )
      .take(args.filters.limit || 20);

    // Apply filters
    if (args.filters.userId) {
      results = results.filter((f) => f.userId === args.filters.userId);
    }

    if (args.filters.factType) {
      results = results.filter((f) => f.factType === args.filters.factType);
    }

    // Filter by confidence
    if (args.filters.minConfidence) {
      results = results.filter(
        (f) => f.confidence >= args.filters.minConfidence,
      );
    }

    return results.map((fact) => ({
      ...fact,
      score: fact.confidence / 100, // Confidence as score
      strategy: "facts",
    }));
  },
});
```

### Facts by Subject (Entity-Centric)

```typescript
// Query facts about a specific entity
export const factsAboutSubject = query({
  args: {
    memorySpaceId: v.string(),
    subject: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("facts")
      .withIndex("by_memorySpace_subject", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId).eq("subject", args.subject),
      )
      .collect();
  },
});

// Get all facts about user-123
const userFacts = await factsAboutSubject(memorySpaceId, "user-123");
// Returns: All preferences, identities, relationships for user-123
```

---

## Strategy 3: Keyword Search

### How It Works

Uses Convex full-text search indexes:

```typescript
// User query
const query = "password Blue";

// Convex keyword search
const results = await ctx.db
  .query("memories")
  .withSearchIndex("by_content", (q) =>
    q.search("content", query).eq("memorySpaceId", memorySpaceId),
  )
  .collect();

// Returns:
// 1. "The password is Blue" (exact match)
// 2. "User's password: Blue123" (contains words)
// 3. "Blue is the password color" (contains both)
// Only returns if words actually appear ✅
```

**Strengths:**

- ✅ Exact word matching
- ✅ Fast (no embedding needed)
- ✅ Predictable results
- ✅ No API costs

**Weaknesses:**

- ❌ Misses synonyms
- ❌ Order matters somewhat
- ❌ Doesn't understand meaning

**Best for:**

- Exact phrase lookup
- Technical terms
- IDs, codes, names
- When embeddings unavailable

### Implementation

```typescript
export const keywordSearch = query({
  args: {
    memorySpaceId: v.string(),
    keywords: v.string(),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("memories")
      .withSearchIndex("by_content", (q) =>
        q
          .search("content", args.keywords)
          .eq("memorySpaceId", args.memorySpaceId),
      )
      .take(args.filters.limit || 20);

    // Convex returns relevance-ranked results
    return results.map((memory, index) => ({
      ...memory,
      score: 1 - index / results.length, // Approximate relevance
      strategy: "keyword",
    }));
  },
});
```

---

## Strategy 4: Temporal Search

### How It Works

Prioritizes recent or time-relevant memories:

```typescript
// Get recent memories
const results = await ctx.db
  .query("memories")
  .withIndex("by_memorySpace_created", (q) =>
    q.eq("memorySpaceId", memorySpaceId),
  )
  .order("desc") // Most recent first
  .take(20)
  .collect();

// Returns most recent memories, regardless of content
```

**Strengths:**

- ✅ Always relevant (recent = relevant)
- ✅ Very fast (simple index)
- ✅ No embeddings needed
- ✅ Great for conversations

**Weaknesses:**

- ❌ Ignores content relevance
- ❌ May miss important old information

**Best for:**

- Conversation context (last N messages)
- Recent user interactions
- Time-sensitive information
- When recency matters more than content

### Implementation

```typescript
export const recentSearch = query({
  args: {
    memorySpaceId: v.string(),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("memories")
      .withIndex("by_memorySpace_created", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId),
      )
      .order("desc");

    // Filter by importance (flattened field)
    if (args.filters.minImportance) {
      q = q.filter((q) =>
        q.gte(q.field("importance"), args.filters.minImportance),
      );
    }

    // Filter by user
    if (args.filters.userId) {
      q = q.filter((q) => q.eq(q.field("userId"), args.filters.userId));
    }

    // Filter by participant (Hive Mode)
    if (args.filters.participantId) {
      q = q.filter((q) =>
        q.eq(q.field("participantId"), args.filters.participantId),
      );
    }

    const results = await q.take(args.filters.limit || 20);

    return results.map((memory, index) => ({
      ...memory,
      score: 1 - index / results.length, // Recency score
      strategy: "recent",
    }));
  },
});
```

---

## Strategy 4: Auto (Hybrid)

### Intelligent Strategy Selection

```typescript
export const autoSearch = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    embedding: v.optional(v.array(v.float64())),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    // Decision tree
    if (args.embedding) {
      // Has embedding: Use semantic
      return await ctx.runQuery("memories:semanticSearch", args);
    } else if (args.query && args.query.length > 0) {
      // Has query: Use keyword
      return await ctx.runQuery("memories:keywordSearch", {
        memorySpaceId: args.agentId,
        keywords: args.query,
        filters: args.filters,
      });
    } else {
      // No query: Use recent
      return await ctx.runQuery("memories:recentSearch", args);
    }
  },
});
```

### Hybrid Combination

Combine multiple strategies for best results:

```typescript
export const hybridSearch = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    embedding: v.array(v.float64()),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    // 1. Semantic search (top 20)
    const semantic = await ctx.runQuery("memories:semanticSearch", {
      memorySpaceId: args.agentId,
      embedding: args.embedding,
      filters: { limit: 20 },
    });

    // 2. Keyword search (top 20)
    const keyword = await ctx.runQuery("memories:keywordSearch", {
      memorySpaceId: args.agentId,
      keywords: args.query,
      filters: { limit: 20 },
    });

    // 3. Merge and re-rank
    const combined = mergeResults(semantic, keyword);

    // 4. Apply boosting (importance, recency, access)
    if (args.filters.boostImportance) {
      applyImportanceBoost(combined);
    }

    if (args.filters.boostRecent) {
      applyRecencyBoost(combined);
    }

    // 5. Sort by combined score
    combined.sort((a, b) => b.score - a.score);

    // 6. Return top N
    return combined.slice(0, args.filters.limit || 10);
  },
});

function mergeResults(semantic: any[], keyword: any[]) {
  const map = new Map();

  // Add semantic results
  semantic.forEach((r, i) => {
    map.set(r._id, {
      ...r,
      semanticScore: r.score,
      semanticRank: i,
      keywordScore: 0,
      keywordRank: Infinity,
    });
  });

  // Add keyword results
  keyword.forEach((r, i) => {
    if (map.has(r._id)) {
      const existing = map.get(r._id);
      existing.keywordScore = r.score;
      existing.keywordRank = i;
    } else {
      map.set(r._id, {
        ...r,
        semanticScore: 0,
        semanticRank: Infinity,
        keywordScore: r.score,
        keywordRank: i,
      });
    }
  });

  // Calculate combined score
  return Array.from(map.values()).map((r) => ({
    ...r,
    score: r.semanticScore * 0.7 + r.keywordScore * 0.3,
  }));
}
```

---

## Boosting Strategies

### Importance Boosting

```typescript
function applyImportanceBoost(results: any[]) {
  results.forEach((r) => {
    const importanceBoost = r.metadata.importance / 100; // 0-1
    r.score = r.score * 0.7 + importanceBoost * 0.3;
  });
}

// Critical information ranks higher
// importance=100: +0.30 to score
// importance=50: +0.15 to score
// importance=0: +0.00 to score
```

### Recency Boosting

```typescript
function applyRecencyBoost(results: any[]) {
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  results.forEach((r) => {
    const age = now - r.createdAt;
    const recencyBoost = Math.max(0, 1 - age / oneWeek); // 0-1

    r.score = r.score * 0.8 + recencyBoost * 0.2;
  });
}

// Recent memories rank higher
// < 1 day old: +0.20 to score
// 3 days old: +0.10 to score
// > 7 days old: +0.00 to score
```

### Access Frequency Boosting

```typescript
function applyPopularityBoost(results: any[]) {
  // Find max access count
  const maxAccess = Math.max(...results.map((r) => r.accessCount));

  results.forEach((r) => {
    const popularityBoost = maxAccess > 0 ? r.accessCount / maxAccess : 0;
    r.score = r.score * 0.9 + popularityBoost * 0.1;
  });
}

// Frequently accessed memories rank higher
```

### Combined Boosting

```typescript
export const search = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    embedding: v.optional(v.array(v.float64())),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    // Get base results
    const results = await getBaseResults(ctx, args);

    // Apply boosting (configurable)
    if (args.filters.boostImportance) {
      applyImportanceBoost(results);
    }

    if (args.filters.boostRecent) {
      applyRecencyBoost(results);
    }

    if (args.filters.boostPopular) {
      applyPopularityBoost(results);
    }

    // Re-sort by adjusted scores
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, args.filters.limit || 10);
  },
});
```

---

## Filter Application

### Pre-Filtering (Convex Index)

Applied BEFORE search for efficiency:

```typescript
// ✅ Pre-filtered (fast)
await ctx.db
  .query("memories")
  .withIndex(
    "by_embedding",
    (q) =>
      q
        .similar("embedding", vector, 20)
        .eq("agentId", agentId) // ← Pre-filter
        .eq("userId", userId), // ← Pre-filter
  )
  .collect();

// Only searches vectors for this agent+user
// filterFields: ["agentId", "userId"] enables this
```

### Post-Filtering (Application Logic)

Applied AFTER search for complex logic:

```typescript
// Post-filter (after vector search)
const results = await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q
      .similar("embedding", vector, 50) // Get more results
      .eq("agentId", agentId),
  )
  .collect();

// Complex filters in code
const filtered = results.filter((memory) => {
  // Importance range
  if (memory.metadata.importance < 50 || memory.metadata.importance > 90) {
    return false;
  }

  // Tag matching (AND logic)
  if (!memory.metadata.tags.includes("password")) {
    return false;
  }

  // Date range
  if (memory.createdAt < someDate) {
    return false;
  }

  // Custom logic
  if (memory.metadata.customField !== "value") {
    return false;
  }

  return true;
});

return filtered.slice(0, 10);
```

**Rule:** Use pre-filtering when possible, post-filtering for complex logic.

---

## Universal Filters Implementation

### Filter Processing Pipeline

```typescript
function applyUniversalFilters(
  results: MemoryEntry[],
  filters: UniversalFilters,
): MemoryEntry[] {
  let filtered = results;

  // userId (usually pre-filtered)
  if (filters.userId) {
    filtered = filtered.filter((m) => m.userId === filters.userId);
  }

  // Tags (any or all)
  if (filters.tags && filters.tags.length > 0) {
    if (filters.tagMatch === "all") {
      // Must have ALL tags
      filtered = filtered.filter((m) =>
        filters.tags.every((tag) => m.metadata.tags.includes(tag)),
      );
    } else {
      // Must have ANY tag (default)
      filtered = filtered.filter((m) =>
        filters.tags.some((tag) => m.metadata.tags.includes(tag)),
      );
    }
  }

  // Importance range
  if (filters.importance) {
    if (typeof filters.importance === "number") {
      filtered = filtered.filter(
        (m) => m.metadata.importance === filters.importance,
      );
    } else {
      // RangeQuery
      if (filters.importance.$gte !== undefined) {
        filtered = filtered.filter(
          (m) => m.metadata.importance >= filters.importance.$gte,
        );
      }
      if (filters.importance.$lte !== undefined) {
        filtered = filtered.filter(
          (m) => m.metadata.importance <= filters.importance.$lte,
        );
      }
    }
  }

  // Date ranges
  if (filters.createdAfter) {
    filtered = filtered.filter(
      (m) => m.createdAt >= filters.createdAfter.getTime(),
    );
  }

  if (filters.createdBefore) {
    filtered = filtered.filter(
      (m) => m.createdAt <= filters.createdBefore.getTime(),
    );
  }

  // Source type
  if (filters["source.type"]) {
    filtered = filtered.filter((m) => m.source.type === filters["source.type"]);
  }

  // Access patterns
  if (filters.accessCount) {
    filtered = applyRangeFilter(filtered, "accessCount", filters.accessCount);
  }

  return filtered;
}
```

---

## Ranking and Scoring

### Base Similarity Score

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Returns 0-1 (1 = identical, 0 = opposite)
```

### Multi-Factor Ranking

```typescript
function calculateFinalScore(
  memory: MemoryEntry,
  baseScore: number,
  options: SearchOptions,
): number {
  let score = baseScore;

  // Factor 1: Importance (weight: 0.2)
  if (options.boostImportance) {
    const importanceFactor = memory.metadata.importance / 100;
    score = score * 0.8 + importanceFactor * 0.2;
  }

  // Factor 2: Recency (weight: 0.15)
  if (options.boostRecent) {
    const age = Date.now() - memory.createdAt;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const recencyFactor = Math.max(0, 1 - age / oneMonth);
    score = score * 0.85 + recencyFactor * 0.15;
  }

  // Factor 3: Access frequency (weight: 0.1)
  if (options.boostPopular) {
    const popularityFactor = Math.min(1, memory.accessCount / 100);
    score = score * 0.9 + popularityFactor * 0.1;
  }

  return score;
}
```

---

## Strategy Selection Logic

### Automatic Strategy

```typescript
export const search = query({
  args: {
    memorySpaceId: v.string(),
    query: v.string(),
    embedding: v.optional(v.array(v.float64())),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    // Auto-select strategy
    let strategy = args.filters.strategy || "auto";

    if (strategy === "auto") {
      // Decide based on available inputs
      if (args.embedding) {
        strategy = "semantic";
      } else if (args.query && args.query.length > 0) {
        strategy = "keyword";
      } else {
        strategy = "recent";
      }
    }

    // Execute chosen strategy
    switch (strategy) {
      case "semantic":
        return await semanticSearch(ctx, args);

      case "keyword":
        return await keywordSearch(ctx, args);

      case "recent":
        return await recentSearch(ctx, args);

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  },
});
```

---

## Search Optimization Techniques

### 1. Limit Before Filter

```typescript
// ❌ Slow: Filter all, then limit
const all = await ctx.db.query("memories").collect();
const filtered = all.filter((m) => m.metadata.importance >= 80);
const limited = filtered.slice(0, 10);

// ✅ Fast: Limit during query
const results = await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .filter((q) => q.gte(q.field("metadata.importance"), 80))
  .take(10); // ← Stop after 10 matches
```

### 2. Use Specific Indexes

```typescript
// ❌ Generic index
await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .filter((q) => q.eq(q.field("source.type"), "a2a"))
  .collect();

// ✅ Specific compound index
await ctx.db
  .query("memories")
  .withIndex("by_agent_source", (q) =>
    q.eq("agentId", agentId).eq("source.type", "a2a"),
  )
  .collect();
```

### 3. Cache Frequent Queries

```typescript
const searchCache = new Map<string, { results: any[]; timestamp: number }>();

export const cachedSearch = query({
  handler: async (ctx, args) => {
    const cacheKey = JSON.stringify(args);
    const cached = searchCache.get(cacheKey);

    // Cache for 60 seconds
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.results;
    }

    // Execute search
    const results = await doSearch(ctx, args);

    // Cache results
    searchCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    });

    return results;
  },
});
```

---

## Real-World Search Patterns

### Pattern 1: Conversational Context

```typescript
// Get recent relevant context for conversation
async function getConversationContext(
  memorySpaceId: string,
  userId: string,
  currentMessage: string,
) {
  const embedding = await embed(currentMessage);

  return await cortex.memory.search(agentId, currentMessage, {
    embedding,
    userId, // User-specific
    minImportance: 50, // Skip trivial
    limit: 5,
    boostRecent: true, // Prioritize recent
    strategy: "semantic",
  });
}
```

### Pattern 2: Knowledge Retrieval

```typescript
// Find best answer from knowledge base
async function findAnswer(query: string) {
  const embedding = await embed(query);

  return await cortex.memory.search("kb-agent", query, {
    embedding,
    minImportance: 70, // Only important articles
    tags: ["kb-article"],
    limit: 3,
    boostImportance: true, // Trust high-importance content
    strategy: "semantic",
  });
}
```

### Pattern 3: Multi-Criteria Search

```typescript
// Complex search with multiple criteria
async function advancedSearch(memorySpaceId: string, criteria: any) {
  const embedding = await embed(criteria.query);

  const results = await cortex.memory.search(agentId, criteria.query, {
    embedding,
    userId: criteria.userId,
    tags: criteria.tags,
    tagMatch: "all", // Must have all tags
    importance: { $gte: criteria.minImportance },
    createdAfter: criteria.since,
    "source.type": criteria.sourceType,
    limit: criteria.limit,
    boostImportance: true,
    boostRecent: true,
    strategy: "auto",
  });

  return results;
}
```

---

## Fallback Strategies

### Graceful Degradation

```typescript
async function searchWithFallback(
  memorySpaceId: string,
  query: string,
  embedding?: number[],
) {
  try {
    // Try semantic first
    if (embedding) {
      const semantic = await cortex.memory.search(agentId, query, {
        embedding,
        limit: 10,
        strategy: "semantic",
      });

      if (semantic.length > 0) {
        return semantic;
      }
    }

    // Fall back to keyword
    const keyword = await cortex.memory.search(agentId, query, {
      limit: 10,
      strategy: "keyword",
    });

    if (keyword.length > 0) {
      return keyword;
    }

    // Fall back to recent
    return await cortex.memory.search(agentId, "*", {
      limit: 10,
      strategy: "recent",
      minImportance: 50,
    });
  } catch (error) {
    console.error("All search strategies failed:", error);
    return [];
  }
}
```

---

## Performance Benchmarks

### Search Latency by Strategy

| Strategy | Index Used    | Typical Latency | Dataset Size Impact             |
| -------- | ------------- | --------------- | ------------------------------- |
| Semantic | Vector index  | 50-100ms        | Logarithmic (with filterFields) |
| Keyword  | Search index  | 20-50ms         | Logarithmic                     |
| Recent   | Regular index | 10-20ms         | Logarithmic                     |
| Hybrid   | Multiple      | 100-200ms       | Logarithmic (parallel)          |

### Throughput

**Queries per second (estimated):**

- Semantic: 50-100 QPS (embedding generation is bottleneck)
- Keyword: 200-500 QPS (no embedding needed)
- Recent: 500-1000 QPS (simple index lookup)

**Optimizations:**

- Cache query embeddings (5-10× faster)
- Batch embedding generation
- Use Convex reactive queries (cached by Convex)

---

## Next Steps

- **[Context Chain Design](./06-context-chain-design.md)** - Context propagation architecture
- **[Performance](./08-performance.md)** - Optimization techniques
- **[Semantic Search Guide](../02-core-features/02-semantic-search.md)** - Usage patterns

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
