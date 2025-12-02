# Vector Dimension Strategies

> **Last Updated**: 2025-10-28

Strategic guidance for choosing embedding models and vector dimensions for optimal performance.

## Overview

Different embedding models produce vectors of different sizes (dimensions). This guide helps you choose the right model for your accuracy/performance/cost tradeoffs.

> **Note**: This is guidance for choosing external embedding providers. Cortex doesn't generate embeddings - you bring your own (or use Cortex Cloud's autoEmbed feature).

## Understanding Dimensions

### What are Dimensions?

Dimensions are the length of the vector array that represents text:

```typescript
// 384 dimensions (small, fast)
[0.234, -0.891, 0.445, ..., 0.123]  // 384 numbers

// 1536 dimensions (balanced)
[0.234, -0.891, ..., 0.123]  // 1,536 numbers

// 3072 dimensions (large, accurate)
[0.234, -0.891, ..., 0.123]  // 3,072 numbers
```

**More dimensions = More information = Better accuracy (but slower and more expensive)**

## Common Embedding Models

| Model                   | Provider | Dimensions | Speed     | Accuracy | Cost/1M tokens | Best For              |
| ----------------------- | -------- | ---------- | --------- | -------- | -------------- | --------------------- |
| text-embedding-3-small  | OpenAI   | 1536       | Fast      | Good     | $0.02          | General purpose       |
| text-embedding-3-large  | OpenAI   | 3072       | Medium    | Best     | $0.13          | When accuracy matters |
| text-embedding-ada-002  | OpenAI   | 1536       | Fast      | Good     | $0.10          | Legacy projects       |
| embed-english-v3.0      | Cohere   | 1024       | Fast      | Good     | $0.10          | English content       |
| embed-multilingual-v3.0 | Cohere   | 1024       | Fast      | Good     | $0.10          | Multiple languages    |
| all-MiniLM-L6-v2        | Local    | 384        | Very Fast | Fair     | Free           | High-volume/offline   |
| all-mpnet-base-v2       | Local    | 768        | Fast      | Good     | Free           | Quality + free        |

## Cortex Default Recommendation

**For most applications: OpenAI text-embedding-3-large (3072 dimensions)**

```typescript
import OpenAI from "openai";
const openai = new OpenAI();

async function embed(text: string): Promise<number[]> {
  const result = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    dimensions: 3072, // Full dimensions for best accuracy
  });

  return result.data[0].embedding;
}
```

**Why 3072?**

- ✅ Best accuracy for semantic search
- ✅ Future-proof (can't increase dimensions later without re-embedding)
- ✅ Storage is cheap, accuracy is valuable
- ✅ Proven in production systems

**Or use Cortex Cloud autoEmbed (recommended):**

```typescript
// No embedding code needed! (Layer 3 for conversations)
await cortex.memory.remember({
  memorySpaceId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  autoEmbed: true, // Cortex Cloud handles embeddings automatically
});

// Or for system memories (Layer 2)
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  autoEmbed: true, // Cloud Mode
  metadata: { importance: 50 },
});
```

## Using Different Dimensions

### Storing Memories with Different Dimensions

Cortex automatically handles different dimensions:

```typescript
// 384-dimensional embedding (Layer 2 - explicit Vector storage)
await cortex.vector.store("agent-1", {
  content: "Small embedding memory",
  contentType: "raw",
  embedding: await embedSmall(text), // 384 dimensions
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 30, dimension: 384 },
});

// 1536-dimensional embedding (Layer 2)
await cortex.vector.store("agent-1", {
  content: "Standard embedding memory",
  contentType: "raw",
  embedding: await embedStandard(text), // 1536 dimensions
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50, dimension: 1536 },
});

// 3072-dimensional embedding (Layer 2)
await cortex.vector.store("agent-1", {
  content: "Large embedding memory",
  contentType: "raw",
  embedding: await embedLarge(text), // 3072 dimensions
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 70, dimension: 3072 },
});
```

### Searching Across Dimensions

```typescript
// Query uses its own dimension
const queryEmbedding = await embedLarge(query); // 3072 dimensions

// Cortex automatically:
// 1. Compares to memories with same dimension
// 2. Normalizes scores across dimensions
// 3. Returns best matches regardless of dimension

const memories = await cortex.memory.search("agent-1", query, {
  embedding: queryEmbedding,
});

// Results can have mixed dimensions
memories.forEach((m) => {
  console.log(`Dimension: ${m.metadata.dimension}, Score: ${m.score}`);
});
```

## Choosing the Right Dimension

### Decision Framework

```
High-volume, real-time?
  ↓
  Use 384-768 dimensions (fast, cheaper)

General purpose application?
  ↓
  Use 1536 dimensions (balanced)

Accuracy is critical?
  ↓
  Use 3072 dimensions (best results)

Running locally/offline?
  ↓
  Use local models (384-768 dimensions)

Don't want to manage embeddings?
  ↓
  Use Cortex Cloud autoEmbed (handles everything)
```

### Hybrid Approach

Use different dimensions for different types of memories:

```typescript
// Critical information: High accuracy
await cortex.memory.store("agent-1", {
  content: "Security protocol XYZ requires 2FA",
  contentType: "raw",
  embedding: await embedLarge(content), // 3072 dimensions
  metadata: {
    importance: 95, // High importance (0-100)
    dimension: 3072,
  },
});

// General information: Balanced
await cortex.memory.store("agent-1", {
  content: "User prefers dark mode",
  contentType: "raw",
  embedding: await embedStandard(content), // 1536 dimensions
  metadata: {
    importance: 50, // Medium importance
    dimension: 1536,
  },
});

// High-volume logs: Fast
await cortex.memory.store("agent-1", {
  content: "User visited pricing page",
  contentType: "raw",
  embedding: await embedSmall(content), // 384 dimensions
  metadata: {
    importance: 15, // Low importance
    dimension: 384,
  },
});
```

## Performance Impact

### Storage Size

```typescript
// Storage comparison for 10,000 memories

// 384 dimensions
const small = 10000 * 384 * 4 bytes = 15.36 MB

// 1536 dimensions
const medium = 10000 * 1536 * 4 bytes = 61.44 MB

// 3072 dimensions
const large = 10000 * 3072 * 4 bytes = 122.88 MB
```

### Search Speed

Benchmark results (approximate):

```
384 dimensions:  ~10ms per search (1000 memories)
1536 dimensions: ~25ms per search (1000 memories)
3072 dimensions: ~45ms per search (1000 memories)
```

_Note: Actual speed depends on Convex infrastructure and query complexity_

### Cost Comparison

```typescript
// Embedding generation cost for 1M tokens

// OpenAI text-embedding-3-small (1536)
$0.02 per 1M tokens

// OpenAI text-embedding-3-large (3072)
$0.13 per 1M tokens

// Local model (384-768)
$0 (but requires compute)

// Cortex Cloud autoEmbed
$0.02 per 1K tokens (we handle everything)
```

## Dimension Strategies

### Strategy 1: Single Dimension (Simplest)

Use one embedding model for everything:

```typescript
// Configure once
const EMBEDDING_MODEL = "text-embedding-3-large";
const DIMENSIONS = 3072;

async function embed(text: string): Promise<number[]> {
  const result = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return result.data[0].embedding;
}

// Use everywhere (Layer 2 for system memories)
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: await embed(text),
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50, dimension: DIMENSIONS },
});

// Or for conversations (Layer 3)
await cortex.memory.remember({
  memorySpaceId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  generateEmbedding: async (content) => await embed(content),
});
```

**Pros:** Simple, consistent, predictable  
**Cons:** One-size-fits-all may not be optimal

### Strategy 2: Importance-Based Dimensions

Match dimension to importance:

```typescript
async function embedByImportance(
  text: string,
  importance: number, // 0-100
): Promise<number[]> {
  if (importance >= 80) {
    return await embedLarge(text); // 3072 dimensions for high importance
  } else if (importance >= 40) {
    return await embedStandard(text); // 1536 dimensions for medium
  } else {
    return await embedSmall(text); // 384 dimensions for low importance
  }
}

// Layer 2 - explicit Vector storage with importance-based embedding
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: await embedByImportance(text, importance),
  source: { type: "system", timestamp: new Date() },
  metadata: { importance, dimension: getDimension(importance) },
});
```

**Pros:** Optimizes cost/accuracy tradeoff  
**Cons:** More complex, different models to manage

### Strategy 3: Progressive Enhancement

Start small, upgrade important memories:

```typescript
// Initially store with small embeddings (Layer 2)
const memory = await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: await embedSmall(text), // 384
  source: { type: "system", timestamp: new Date() },
  metadata: { importance: 50, dimension: 384 },
});

// If memory gets accessed frequently, upgrade (Layer 3 update)
if (memory.accessCount > 10) {
  await cortex.memory.update(agentId, memory.id, {
    embedding: await embedLarge(text), // 3072
    metadata: {
      dimension: 3072,
      importance: Math.min(memory.metadata.importance + 10, 100), // Boost importance
      upgraded: true,
    },
  });
}
```

**Pros:** Optimize for actual usage  
**Cons:** Requires monitoring and maintenance

### Strategy 4: Use Cortex Cloud (Easiest)

Let Cortex handle everything:

```typescript
// No embedding code at all! (Layer 3 for conversations)
await cortex.memory.remember({
  memorySpaceId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  autoEmbed: true, // Cloud Mode handles everything
});

// Or for system memories (Layer 2)
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  autoEmbed: true, // Cloud Mode handles model selection, dimensions, optimization
  metadata: { importance: 50 },
});

// Cortex Cloud automatically:
// - Chooses best model for your use case
// - Optimizes dimensions based on importance
// - Upgrades to better models when available
// - Handles all embedding infrastructure
```

**Pros:** Zero config, automatic optimization, automatic upgrades  
**Cons:** Requires Cortex Cloud subscription

## Dimension Compatibility

### Can You Mix Dimensions?

**Yes!** Cortex handles mixed dimensions automatically:

```typescript
// Agent has memories with various dimensions
Agent memories:
- Memory 1: 384 dimensions
- Memory 2: 1536 dimensions
- Memory 3: 3072 dimensions

// Search with 1536-dimensional query
const queryEmbedding = await embedStandard(query);  // 1536

// Cortex compares:
// - Directly to 1536-dim memories
// - Normalizes comparison with other dimensions
// - Returns best matches
```

### Dimension Normalization

Cortex normalizes scores across dimensions:

```
Raw similarity scores:
- 384-dim memory:  0.85
- 1536-dim memory: 0.92
- 3072-dim memory: 0.88

Normalized scores (considers dimension):
- 384-dim memory:  0.82
- 1536-dim memory: 0.92
- 3072-dim memory: 0.90
```

## Migration Between Dimensions

### Upgrading Dimensions

```typescript
// Re-embed existing memories with larger dimensions
async function upgradeDimensions(memorySpaceId: string) {
  const memories = await cortex.memory.search(memorySpaceId, "*", {
    metadata: { dimension: 384 },
    limit: 1000,
  });

  console.log(`Upgrading ${memories.length} memories to 3072 dimensions...`);

  for (const memory of memories) {
    const newEmbedding = await embedLarge(memory.content);

    await cortex.memory.update(memorySpaceId, memory.id, {
      embedding: newEmbedding,
      metadata: {
        ...memory.metadata,
        dimension: 3072,
        upgradedAt: new Date(),
      },
    });
  }

  console.log("Upgrade complete!");
}
```

### Downgrading Dimensions

```typescript
// Reduce dimensions for cost savings
async function downgradeDimensions(memorySpaceId: string) {
  const lowImportance = await cortex.memory.search(memorySpaceId, "*", {
    filter: {
      importance: { $lte: 30 }, // Low importance (0-30)
      dimension: 3072,
    },
  });

  for (const memory of lowImportance) {
    const smallerEmbedding = await embedSmall(memory.content);

    await cortex.memory.update(memorySpaceId, memory.id, {
      embedding: smallerEmbedding,
      metadata: {
        ...memory.metadata,
        dimension: 384,
        downgradedAt: new Date(),
      },
    });
  }
}
```

## Best Practices

### 1. Document Your Dimension Choice

```typescript
// Store dimension in metadata (Layer 2 - system memory)
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: await embed(text),
  source: { type: "system", timestamp: new Date() },
  metadata: {
    importance: 50,
    dimension: 3072,
    embeddingModel: "text-embedding-3-large",
    embeddingVersion: "v3", // Track model version
  },
});
```

### 2. Use Consistent Models

```typescript
// ❌ Mixing models unpredictably
const emb1 = await openai.embed(text); // 1536-dim
const emb2 = await cohere.embed(text); // 1024-dim
const emb3 = await local.embed(text); // 384-dim

// ✅ Consistent within agent or use case
const model = process.env.EMBEDDING_MODEL || "text-embedding-3-large";
const embedding = await embedWithModel(text, model);
```

### 3. Benchmark for Your Use Case

```typescript
// Test different dimensions
async function benchmarkDimensions(testQueries: string[]) {
  const models = [
    { name: "small", fn: embedSmall, dim: 384 },
    { name: "medium", fn: embedStandard, dim: 1536 },
    { name: "large", fn: embedLarge, dim: 3072 },
  ];

  for (const model of models) {
    console.log(`Testing ${model.name} (${model.dim} dimensions)...`);

    const start = Date.now();
    const accuracy = await testSearchAccuracy(testQueries, model.fn);
    const time = Date.now() - start;

    console.log({
      accuracy: `${(accuracy * 100).toFixed(1)}%`,
      avgTime: `${time / testQueries.length}ms`,
      dimension: model.dim,
    });
  }
}
```

## Advanced Techniques

### Dynamic Dimension Selection

```typescript
function selectDimension(
  content: string,
  importance: number,
  usage: "search" | "storage",
): number {
  // High importance: Use best accuracy
  if (importance >= 80) return 3072;

  // Long content: More dimensions help
  if (content.length > 1000) return 3072;

  // Frequent searches: Balance speed/accuracy
  if (usage === "search") return 1536;

  // Default: Small for efficiency
  return 768;
}

// Use dynamic selection
const dim = selectDimension(text, importance, "storage");
const embedding = await embedWithDimension(text, dim);
```

### Dimension Reduction

Reduce dimensions while preserving most information:

```typescript
import { PCA } from "ml-pca";

// Take 3072-dim embedding and reduce to 1536
function reduceDimensions(
  embedding: number[],
  targetDimensions: number,
): number[] {
  // Use PCA or other dimensionality reduction
  const pca = new PCA(embedding, { nComp: targetDimensions });
  return pca.predict([embedding])[0];
}

// Store with both (for flexibility) - Layer 2
await cortex.vector.store(memorySpaceId, {
  content: text,
  contentType: "raw",
  embedding: largeEmbedding, // 3072 for accuracy
  source: { type: "system", timestamp: new Date() },
  metadata: {
    importance: 70,
    dimension: 3072,
    reducedEmbedding: reduceDimensions(largeEmbedding, 768), // 768 for speed
  },
});
```

## Cost Optimization

### Calculate Embedding Costs

```typescript
function estimateEmbeddingCost(
  memories: number,
  avgTokensPerMemory: number,
  model: "small" | "large",
) {
  const totalTokens = memories * avgTokensPerMemory;
  const cost =
    model === "small"
      ? (totalTokens * 0.02) / 1_000_000 // $0.02 per 1M tokens
      : (totalTokens * 0.13) / 1_000_000; // $0.13 per 1M tokens

  return {
    totalTokens,
    cost: `$${cost.toFixed(2)}`,
    costPer1000Memories: `$${((cost / memories) * 1000).toFixed(2)}`,
  };
}

// Compare models
console.log("10,000 memories @ 100 tokens each:");
console.log("Small:", estimateEmbeddingCost(10000, 100, "small"));
console.log("Large:", estimateEmbeddingCost(10000, 100, "large"));
```

### Storage Cost Comparison

```typescript
// Convex storage costs (approximate)
function estimateStorageCost(memories: number, dimension: number) {
  const bytesPerMemory = dimension * 4; // 4 bytes per float
  const totalBytes = memories * bytesPerMemory;
  const totalMB = totalBytes / (1024 * 1024);

  // Convex charges per GB-month (approximate)
  const convexCostPerGBMonth = 0.25; // Example
  const totalGB = totalMB / 1024;
  const monthlyCost = totalGB * convexCostPerGBMonth;

  return {
    totalMB: totalMB.toFixed(2),
    monthlyCost: `$${monthlyCost.toFixed(2)}`,
  };
}

console.log("10,000 memories:");
console.log("384-dim:", estimateStorageCost(10000, 384));
console.log("1536-dim:", estimateStorageCost(10000, 1536));
console.log("3072-dim:", estimateStorageCost(10000, 3072));
```

## Cloud Mode Features

> **Cloud Mode Only**: Advanced dimension management

### Automatic Dimension Optimization

Cortex Cloud analyzes usage and suggests dimension changes:

```typescript
const recommendations =
  await cortex.analytics.getDimensionRecommendations("agent-1");

// Example recommendations:
// [
//   {
//     type: 'downgrade',
//     memoryIds: ['mem_123', 'mem_456'],
//     from: 3072,
//     to: 1536,
//     reason: 'Low importance, rarely accessed',
//     savings: '$2.50/month'
//   },
//   {
//     type: 'upgrade',
//     memoryIds: ['mem_789'],
//     from: 768,
//     to: 3072,
//     reason: 'High importance, frequently accessed with poor search results',
//     benefit: '+15% search accuracy'
//   }
// ]
```

### Dimension Analytics

Track dimension distribution and performance:

- Dimension breakdown by agent
- Search performance by dimension
- Cost analysis by dimension
- Accuracy metrics by dimension

### Batch Re-Embedding

Bulk dimension changes with progress tracking:

- Queue-based processing
- Progress notifications
- Automatic retry on failures
- Cost estimation before starting

## Best Practices Summary

### 1. Start with Recommended Dimensions

```typescript
// Use the Cortex default or Cloud autoEmbed
const RECOMMENDED_DIMENSION = 3072;
const RECOMMENDED_MODEL = "text-embedding-3-large";

// Or use Cloud Mode
autoEmbed: true; // Cortex handles everything
```

### 2. Track Model Versions

```typescript
// Store model info for future migrations
await cortex.memory.store(agentId, {
  content: text,
  contentType: "raw",
  embedding: await embed(text),
  metadata: {
    embeddingModel: "text-embedding-3-large",
    embeddingVersion: "v3",
    dimension: 3072,
    embeddedAt: new Date(),
  },
});
```

### 3. Test Before Migrating

```typescript
// Before changing dimensions project-wide, test with subset
const testMemories = await cortex.memory.search(agentId, "*", {
  limit: 100,
});

// Test search quality with new dimension
const results = await testSearchQuality(testMemories, newDimension);

if (results.accuracyLoss < 0.05) {
  // Less than 5% accuracy loss
  console.log("Safe to migrate to new dimension");
} else {
  console.log("Stick with current dimension");
}
```

### 4. Document Dimension Choices

```markdown
# Embedding Strategy

We use OpenAI text-embedding-3-large (3072 dimensions) for:

- User preferences and personal information
- Critical system knowledge
- Frequently searched content

We use all-MiniLM-L6-v2 (384 dimensions) for:

- Low-importance logs
- High-volume analytics data
- Temporary/ephemeral information

Rationale: Balances accuracy for important data with cost for high-volume data.
```

## Troubleshooting

### Dimension Mismatch Errors

```typescript
// If you see "Dimension mismatch" errors:

// Check what dimensions your memories use
const dimensions = await cortex.memory.search(agentId, "*", {
  limit: 10,
});
const dims = [...new Set(dimensions.map((m) => m.metadata.dimension))];
console.log("Dimensions in use:", dims);

// Ensure query matches
const queryDim = queryEmbedding.length;
console.log("Query dimension:", queryDim);
```

## Next Steps

- **[Agent Memory](../02-core-features/01-memory-spaces.md)** - Core storage features
- **[Semantic Search](../02-core-features/02-semantic-search.md)** - Search strategies

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
