# Performance

> **Last Updated**: 2026-01-01

Optimization techniques, scaling strategies, resilience layer, and performance characteristics of Cortex on Convex.

## Overview

Cortex is designed for **high performance** at scale with **built-in resilience**. With proper indexing, query patterns, and the resilience layer, Cortex handles millions of memories, thousands of memory spaces, and hundreds of concurrent users efficiently.

**Performance Characteristics:**

- **Read operations:** < 100ms (p95)
- **Write operations:** < 50ms (p95)
- **Vector search:** < 100ms for millions of vectors
- **Facts search:** < 50ms for millions of facts
- **Concurrent operations:** 16 (Starter) / 256 (Professional)
- **Storage:** Unlimited (pay-per-GB)
- **Resilience:** Built-in rate limiting, circuit breaker, concurrency control

---

## Resilience Layer (v0.16.0+)

### Built-In Protection

Cortex includes a **resilience layer** that protects all operations from overload and failures:

```typescript
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  resilience: {
    // Token Bucket Rate Limiter
    rateLimit: {
      tokensPerSecond: 100,      // Default: 100 ops/sec
      maxBurst: 200,              // Allow bursts up to 200
    },
    
    // Concurrency Control (based on Convex plan)
    concurrency: {
      maxConcurrent: 16,          // Starter: 16, Professional: 256
      queueSize: 1000,            // Queue up to 1000 requests
    },
    
    // Circuit Breaker
    circuitBreaker: {
      failureThreshold: 5,        // Open after 5 failures
      timeout: 60000,             // 60s timeout
      resetTimeout: 300000,       // Try recovery after 5 minutes
    },
  },
});
```

### Token Bucket Rate Limiter

```typescript
// Prevents API rate limit exhaustion
// Example: 100 tokens/second with burst of 200

┌─────────────────────────────────────────────┐
│         Token Bucket Algorithm              │
├─────────────────────────────────────────────┤
│  Bucket Capacity: 200 tokens                │
│  Refill Rate: 100 tokens/second             │
│                                             │
│  Request arrives:                           │
│  1. Check if bucket has ≥1 token            │
│  2. If yes: Consume 1 token, allow request  │
│  3. If no: Reject with RATE_LIMIT_EXCEEDED  │
│  4. Refill continuously at 100/sec          │
└─────────────────────────────────────────────┘

// Protects against:
// - Sudden traffic spikes
// - Accidental infinite loops
// - Resource exhaustion
```

### Concurrency Control

```typescript
// Respects Convex plan limits
// Starter: 16 concurrent operations
// Professional: 256 concurrent operations

┌─────────────────────────────────────────────┐
│         Concurrency Semaphore               │
├─────────────────────────────────────────────┤
│  Active: 16/16 (at limit)                   │
│  Queued: 5 requests waiting                 │
│                                             │
│  New request arrives:                       │
│  1. Check if slot available                 │
│  2. If yes: Execute immediately             │
│  3. If no: Add to queue                     │
│  4. Execute when slot frees                 │
└─────────────────────────────────────────────┘

// Prevents:
// - Convex concurrent operation limit errors
// - Resource contention
// - Failed operations due to capacity
```

### Circuit Breaker

```typescript
// Protects against cascading failures

┌─────────────────────────────────────────────┐
│         Circuit Breaker States              │
├─────────────────────────────────────────────┤
│  CLOSED (normal operation)                  │
│    ↓ (5 failures)                           │
│  OPEN (reject all requests)                 │
│    ↓ (5 minute timeout)                     │
│  HALF_OPEN (allow 1 test request)           │
│    ↓ (success)                              │
│  CLOSED (recovery)                          │
└─────────────────────────────────────────────┘

// Prevents:
// - Cascading failures
// - Backend overload during incidents
// - Wasted retries
```

### Monitoring Resilience

```typescript
// Track resilience metrics
const metrics = await cortex.getResilienceMetrics();

console.log({
  rateLimitHits: metrics.rateLimit.rejected,
  queuedRequests: metrics.concurrency.queued,
  circuitBreakerState: metrics.circuitBreaker.state,  // CLOSED | OPEN | HALF_OPEN
  totalRequests: metrics.total.requests,
  failedRequests: metrics.total.failures,
});
```

---

## Query Performance

### Index Usage (Critical)

**Rule #1:** Always use indexes for queries.

```typescript
// ❌ SLOW: Table scan (no index)
const memories = await ctx.db
  .query("memories")
  .filter((q) => q.eq(q.field("memorySpaceId"), memorySpaceId))
  .collect();
// Scans ENTIRE table! O(n)

// ✅ FAST: Index query
const memories = await ctx.db
  .query("memories")
  .withIndex("by_memorySpace", (q) => q.eq("memorySpaceId", memorySpaceId))
  .collect();
// Index lookup! O(log n)
```

**Impact:**

- 1K memories: 10ms vs 100ms (10× faster)
- 1M memories: 15ms vs 10,000ms (666× faster!)

### Compound Indexes

```typescript
// ❌ Less efficient: Single index + filter
const memories = await ctx.db
  .query("memories")
  .withIndex("by_memorySpace", (q) => q.eq("memorySpaceId", memorySpaceId))
  .filter((q) => q.eq(q.field("userId"), userId))
  .collect();
// O(log n) + O(k) where k = space's memories

// ✅ More efficient: Compound index
const memories = await ctx.db
  .query("memories")
  .withIndex("by_memorySpace_userId", (q) =>
    q.eq("memorySpaceId", memorySpaceId).eq("userId", userId)
  )
  .collect();
// O(log n) directly to subset

// ✅ Multi-tenant compound index
const memories = await ctx.db
  .query("memories")
  .withIndex("by_tenant_space", (q) =>
    q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId)
  )
  .collect();
```

**Impact:**

- Memory space with 10K memories, 100 for user
- Single index: 10ms + filter 10K = 15ms
- Compound index: 10ms directly to 100 = 10ms

### Vector Search with filterFields

```typescript
// ❌ Without filterFields: Search all vectors
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
  // No filterFields
})

// Query searches ALL vectors (slow at scale)
const results = await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q.similar("embedding", vector, 10)
  )
  .filter((q) => q.eq(q.field("memorySpaceId"), memorySpaceId))  // ← Filter AFTER search
  .collect();

// ✅ With filterFields: Pre-filter before search
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,  // Default
  filterFields: ["memorySpaceId", "tenantId", "userId", "agentId", "participantId"],
})

// Query searches only relevant subset (fast!)
const results = await ctx.db
  .query("memories")
  .withIndex("by_embedding", (q) =>
    q.similar("embedding", vector, 10)
     .eq("memorySpaceId", memorySpaceId)  // ← Pre-filtered BEFORE search
     .eq("tenantId", tenantId)            // ← Multi-tenant isolation
  )
  .collect();
```

**Impact:**

- 1M total vectors across all spaces, 1K per memory space
- Without filterFields: Search 1M vectors = 200ms
- With filterFields: Search 1K vectors = 10ms
- **20× faster!**

**Multi-tenancy impact:**

- 10M vectors across all tenants, 100K per tenant
- With tenant filter: Search 100K vectors = 50ms
- With tenant + space filter: Search 1K vectors = 10ms
- **100× faster with compound filtering!**

---

## Pagination Strategies

### Cursor-Based Pagination (Best)

```typescript
export const listPaginated = query({
  args: {
    memorySpaceId: v.string(),
    cursor: v.optional(v.number()), // Timestamp cursor
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc");

    // Apply cursor
    if (args.cursor) {
      q = q.filter((q) => q.lt(q.field("createdAt"), args.cursor));
    }

    const results = await q.take(args.limit);

    return {
      memories: results,
      nextCursor:
        results.length > 0 ? results[results.length - 1].createdAt : null,
      hasMore: results.length === args.limit,
    };
  },
});

// Usage
let cursor = null;
let allMemories = [];

do {
  const page = await cortex.memory.list("agent-1", {
    cursor,
    limit: 100,
  });

  allMemories.push(...page.memories);
  cursor = page.nextCursor;
} while (cursor);
```

**Benefits:**

- Consistent performance (no offset skipping)
- Works with real-time updates
- Efficient for large datasets

### Offset-Based Pagination (Simple)

```typescript
// Simpler but slower for large offsets
export const listOffset = query({
  args: {
    memorySpaceId: v.string(),
    offset: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .skip(args.offset) // ← Skips documents
      .take(args.limit)
      .collect();

    return results;
  },
});
```

**Drawbacks:**

- Large offsets are slow (skip 10K documents = slow)
- Can miss items if data changes during pagination
- Use cursor-based for production

---

## Caching Strategies

### Query Result Caching

```typescript
// Convex caches query results automatically
// But you can add application-level caching

const cache = new Map<string, { data: any; timestamp: number }>();

export const cachedList = query({
  handler: async (ctx, args) => {
    const cacheKey = JSON.stringify(args);
    const cached = cache.get(cacheKey);

    // Cache for 60 seconds
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    // Execute query
    const data = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    // Cache result
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  },
});
```

### Embedding Caching

```typescript
// Cache embeddings for common queries
const embeddingCache = new Map<string, number[]>();

async function embedWithCache(text: string): Promise<number[]> {
  const normalized = text.trim().toLowerCase();

  if (embeddingCache.has(normalized)) {
    return embeddingCache.get(normalized)!;
  }

  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });

  const vector = embedding.data[0].embedding;
  embeddingCache.set(normalized, vector);

  return vector;
}

// Common queries benefit
await cortex.memory.search("agent-1", "user preferences", {
  embedding: await embedWithCache("user preferences"), // Cached!
});
```

---

## Batch Operations

### Batch Insertions

```typescript
// ❌ Slow: One at a time
for (const item of items) {
  await cortex.memory.store("agent-1", item);
}
// N round trips, N transactions

// ✅ Fast: Batch mutation
export const storeBatch = mutation({
  args: { memorySpaceId: v.string(), items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const ids = [];

    // All inserts in single transaction
    for (const item of args.items) {
      const id = await ctx.db.insert("memories", {
        memorySpaceId: args.agentId,
        ...item,
        version: 1,
        previousVersions: [],
        accessCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      ids.push(id);
    }

    return ids;
  },
});

// Usage
await cortex.memory.storeBatch("agent-1", items);
// 1 round trip, 1 transaction ✅
```

**Impact:**

- 100 items: 5000ms → 200ms (25× faster)

### Parallel Queries

```typescript
// ❌ Sequential: Slow
const memories = await cortex.memory.search("agent-1", query);
const contexts = await cortex.contexts.list({ memorySpaceId: "agent-1" });
const user = await cortex.users.get("user-123");
// 3× latency

// ✅ Parallel: Fast
const [memories, contexts, user] = await Promise.all([
  cortex.memory.search("agent-1", query),
  cortex.contexts.list({ memorySpaceId: "agent-1" }),
  cortex.users.get("user-123"),
]);
// 1× latency ✅
```

---

## Storage Optimization

### Version Retention

```typescript
// Aggressive retention saves storage
await cortex.agents.configure("temp-agent", {
  memoryVersionRetention: 1, // Only current version
});

// 100K memories × 10 versions = 1M documents
// 100K memories × 1 version = 100K documents
// 10× storage savings!
```

### Selective Embeddings

```typescript
// Only embed important memories
const shouldEmbed = importance >= 70;

await cortex.memory.store("agent-1", {
  content: text,
  embedding: shouldEmbed ? await embed(text) : undefined,
  metadata: { importance },
});

// Saves:
// - Embedding API costs
// - Storage (24KB per embedding)
// - Search time (fewer vectors)
```

### Content Summarization

```typescript
// Store summarized content (Cloud Mode or DIY)
const summary = await summarize(longContent);  // 1000 chars -> 100 chars

await cortex.memory.store('agent-1', {
  content: summary,  // ← 10× smaller
  contentType: 'summarized',
  embedding: await embed(summary),  // Smaller embedding input
  conversationRef: { ... },  // Full content in ACID
  ...
});

// Saves:
// - Storage in Vector layer
// - Embedding token costs
// - Search index size
```

---

## Scaling Characteristics

### Horizontal Scaling (Convex)

Convex automatically scales:

- **Reads:** Unlimited (cached queries, read replicas)
- **Writes:** High throughput (distributed writes)
- **Storage:** Unlimited (auto-sharding)

**Cortex benefits:**

- No manual sharding needed
- No capacity planning
- Auto-scales with load

### Agent Isolation

```typescript
// Agents are naturally isolated by agentId
// No cross-agent queries = better performance

// ✅ Fast: Single agent
await ctx.db
  .query("memories")
  .withIndex("by_agent", (q) => q.eq("agentId", agentId))
  .collect();

// ⚠️ Slower: All agents
const allAgents = await ctx.db.query("agents").collect();
const allMemories = [];

for (const agent of allAgents) {
  const memories = await ctx.db
    .query("memories")
    .withIndex("by_agent", (q) => q.eq("agentId", agent.agentId))
    .collect();

  allMemories.push(...memories);
}
// N queries (but parallelizable)
```

**Recommendation:** Stick to single-agent queries when possible.

---

## Benchmark Results

### Read Operations (1M memories)

| Operation         | Indexed      | Latency (p50) | Latency (p95) | Latency (p99) |
| ----------------- | ------------ | ------------- | ------------- | ------------- |
| get() by ID       | Yes          | 5ms           | 10ms          | 15ms          |
| search() semantic | Yes (vector) | 50ms          | 100ms         | 150ms         |
| search() keyword  | Yes (search) | 20ms          | 40ms          | 60ms          |
| list() paginated  | Yes          | 15ms          | 30ms          | 45ms          |
| count() filtered  | Yes          | 10ms          | 20ms          | 30ms          |

### Write Operations

| Operation           | Latency (p50) | Latency (p95) | Throughput  |
| ------------------- | ------------- | ------------- | ----------- |
| store() single      | 20ms          | 40ms          | 50 ops/sec  |
| store() batch (100) | 150ms         | 300ms         | 667 ops/sec |
| update()            | 25ms          | 50ms          | 40 ops/sec  |
| delete()            | 15ms          | 30ms          | 66 ops/sec  |

### Scaling Tests

| Dataset | Agents | Memories | Vector Search | Keyword Search |
| ------- | ------ | -------- | ------------- | -------------- |
| Small   | 10     | 10K      | 30ms          | 15ms           |
| Medium  | 100    | 1M       | 80ms          | 35ms           |
| Large   | 1K     | 10M      | 120ms         | 55ms           |
| XL      | 10K    | 100M     | 150ms         | 75ms           |

**Key Insight:** Performance degrades logarithmically (O(log n)), not linearly.

---

## Optimization Checklist

### Essential Optimizations

- ✅ Use compound indexes for common query patterns
- ✅ Add filterFields to vector indexes
- ✅ Paginate large result sets
- ✅ Limit query results (.take(n))
- ✅ Cache frequent queries
- ✅ Batch write operations
- ✅ Use parallel queries (Promise.all)

### Advanced Optimizations

- ✅ Aggressive version retention (1-5 versions)
- ✅ Selective embeddings (importance >= threshold)
- ✅ Content summarization
- ✅ Lazy load children/descendants
- ✅ Cursor-based pagination
- ✅ Cache embeddings for common queries

---

## Cost Optimization

### Storage Costs

**Convex pricing:** ~$0.50/GB/month

```typescript
// Calculate storage per memory
const storagePerMemory =
  contentSize + // ~1KB (raw) or ~100B (summarized)
  embeddingSize + // 0KB (none), 12KB (1536-dim), 24KB (3072-dim)
  metadataSize + // ~1KB
  versionsSize; // previousVersions × memory size

// Example with 3072-dim:
// Content: 1KB
// Embedding: 24KB
// Metadata: 1KB
// 10 versions: 26KB × 10 = 260KB
// Total: ~286KB per memory!

// 100K memories × 286KB = 28.6 GB = ~$14/month
```

**Optimizations:**

- Use 1536-dim instead of 3072-dim (50% savings)
- Reduce version retention (10→5 = 50% savings)
- Summarize content (90% savings on content)
- Selective embeddings (skip low-importance)

### Embedding API Costs

**OpenAI pricing:**

- text-embedding-3-large: $0.13/1M tokens
- text-embedding-3-small: $0.02/1M tokens

```typescript
// Calculate embedding costs
const avgTokensPerMemory = 100; // ~100 tokens average
const memoriesPerMonth = 10000;
const totalTokens = avgTokensPerMemory * memoriesPerMonth; // 1M tokens

// Cost comparison:
// 3072-dim: 1M tokens × $0.13 = $130/month
// 1536-dim: 1M tokens × $0.02 = $20/month
// 85% savings!
```

**Optimizations:**

- Use smaller model (3-small vs 3-large)
- Selective embedding (importance >= 70)
- Cache common queries
- Batch embedding generation (fewer API calls)

---

## Monitoring and Metrics

### Query Performance Tracking

```typescript
// Track query latency
export const search = query({
  handler: async (ctx, args) => {
    const startTime = Date.now();

    const results = await ctx.db
      .query("memories")
      .withIndex("by_embedding", (q) =>
        q.similar("embedding", args.embedding, 10).eq("agentId", args.agentId),
      )
      .collect();

    const latency = Date.now() - startTime;

    // Log slow queries
    if (latency > 100) {
      console.warn(`Slow search: ${latency}ms`, {
        memorySpaceId: args.agentId,
        resultCount: results.length,
      });
    }

    return results;
  },
});
```

### Storage Monitoring

```typescript
// Track storage growth
export const getStorageStats = query({
  args: { memorySpaceId: v.string() },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const stats = {
      totalMemories: memories.length,
      totalBytes: 0,
      embeddingBytes: 0,
      contentBytes: 0,
      versionsBytes: 0,
    };

    for (const memory of memories) {
      const contentSize = (memory.content?.length || 0) * 2; // UTF-16
      const embeddingSize = (memory.embedding?.length || 0) * 8;
      const versionsSize =
        memory.previousVersions.length * (contentSize + embeddingSize);

      stats.contentBytes += contentSize;
      stats.embeddingBytes += embeddingSize;
      stats.versionsBytes += versionsSize;
      stats.totalBytes += contentSize + embeddingSize + versionsSize;
    }

    return stats;
  },
});
```

---

## Scaling Best Practices

### 1. Partition by Agent

```typescript
// ✅ Agent-specific queries (fast)
const memories = await cortex.memory.search("agent-1", query);

// ⚠️ Cross-agent queries (slower)
const allAgents = await cortex.agents.list();
const allMemories = await Promise.all(
  allAgents.map((a) => cortex.memory.search(a.id, query)),
);
```

### 2. Limit Result Sets

```typescript
// ✅ Always set reasonable limits
const results = await cortex.memory.search("agent-1", query, {
  limit: 20, // Don't return 1000s of results
});

// ❌ Don't load everything
const all = await cortex.memory.list("agent-1"); // Could be huge!
```

### 3. Index Common Filters

```typescript
// If you frequently query by importance
.index("by_agent_importance", ["agentId", "metadata.importance"])

// Fast importance queries
await ctx.db
  .query("memories")
  .withIndex("by_agent_importance", (q) =>
    q.eq("agentId", agentId).gte("metadata.importance", 80)
  )
  .collect();
```

### 4. Clean Up Old Data

```typescript
// Regularly clean trivial old data
export const cleanup = mutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days

    const oldMemories = await ctx.db
      .query("memories")
      .filter((q) =>
        q.and(
          q.lte(q.field("metadata.importance"), 30),
          q.lt(q.field("createdAt"), cutoff),
          q.lte(q.field("accessCount"), 1),
        ),
      )
      .collect();

    for (const memory of oldMemories) {
      await ctx.db.delete(memory._id);
    }

    return { deleted: oldMemories.length };
  },
});

// Run daily via cron
```

---

## Troubleshooting Slow Queries

### Identify Slow Queries

```typescript
// Add timing to all queries
const wrapQuery =
  (queryFn) =>
  async (...args) => {
    const start = Date.now();
    const result = await queryFn(...args);
    const duration = Date.now() - start;

    if (duration > 100) {
      console.warn("Slow query:", {
        function: queryFn.name,
        duration,
        args,
      });
    }

    return result;
  };
```

### Common Issues

**Issue:** Vector search is slow

**Solutions:**

- ✅ Add filterFields to vector index
- ✅ Reduce search limit
- ✅ Add userId filter (if applicable)
- ✅ Check embedding dimension (smaller = faster)

**Issue:** Pagination is slow

**Solutions:**

- ✅ Use cursor-based pagination
- ✅ Avoid large offsets
- ✅ Add index on sort field

**Issue:** Filter queries are slow

**Solutions:**

- ✅ Create compound index for filter combination
- ✅ Use .withIndex() instead of .filter()
- ✅ Limit result set with .take()

---

## Next Steps

- **[Security & Privacy](./09-security-privacy.md)** - Data protection
- **[Data Models](./02-data-models.md)** - Schema and indexes
- **[Convex Integration](./03-convex-integration.md)** - Convex features

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
