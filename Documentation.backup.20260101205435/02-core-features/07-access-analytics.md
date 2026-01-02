# Access Analytics

> **Last Updated**: 2026-01-01

> 🚧 **PLANNED FEATURE**: The `cortex.analytics.*` API described in this document is planned for a future release. Currently, memory space statistics are available via `cortex.memorySpaces.getStats()`. See the [Memory Space Operations API](../03-api-reference/11-memory-space-operations.md) for available methods.

Track and analyze how agents use memory to optimize performance and understand patterns.

## Overview

Every time a memory is accessed, Cortex tracks it. This data provides valuable insights into what agents remember, what they forget, and how to optimize your memory system.

**Analytics operate on the Vector Memory layer** - tracking searches, retrievals, updates, and access patterns. ACID conversations are tracked separately (message counts, conversation metrics).

## Automatic Tracking

### What's Tracked

Cortex automatically tracks:

```typescript
interface MemoryAccessData {
  memoryId: string;
  memorySpaceId: string;
  accessCount: number; // Total times accessed
  lastAccessed: Date; // Most recent access
  createdAt: Date; // When memory was created
  firstAccessed?: Date; // First access (if different from creation)
  averageRetrievalTime: number; // Performance metric
}
```

Every `cortex.memory.get()` or `cortex.memory.search()` that returns a memory increments its access count.

### Viewing Access Data

```typescript
// Get a memory with access stats
const memory = await cortex.memory.get("agent-1", "mem_123");

console.log({
  content: memory.content,
  accessCount: memory.accessCount, // 45
  lastAccessed: memory.lastAccessed, // 2025-10-23T10:30:00Z
  daysSinceCreation: daysSince(memory.createdAt), // 30
});
```

## Agent Analytics

### Agent Memory Statistics

```typescript
// Get stats for an agent
const stats = await cortex.analytics.getAgentStats("support-agent");

console.log(stats);
// {
//   // Vector Memory Stats
//   totalMemories: 1543,
//   memoriesThisWeek: 89,
//   memoriesThisMonth: 345,
//   avgMemoriesPerDay: 12.3,
//
//   // Storage breakdown
//   byContentType: {
//     raw: 1234,        // 80%
//     summarized: 309   // 20%
//   },
//
//   bySourceType: {
//     conversation: 1100,  // User conversations
//     a2a: 234,           // Agent communications
//     system: 156,        // System-generated
//     tool: 53            // Tool executions
//   },
//
//   // Search stats
//   searchStats: {
//     totalSearches: 3421,
//     avgSearchTime: 23,  // ms
//     avgResultsPerSearch: 5.2,
//     semanticSearches: 2567,  // With embeddings
//     textSearches: 854        // Without embeddings
//   },
//
//   // Memory health
//   memoryHealth: {
//     withEmbeddings: 1450,     // 94%
//     withoutEmbeddings: 93,    // 6%
//     withConversationRef: 1234, // 80% linked to ACID
//     importanceDistribution: {
//       critical: 234,    // 90-100
//       high: 445,        // 70-89
//       medium: 654,      // 40-69
//       low: 210          // 0-39
//     }
//   },
//
//   // Access patterns
//   accessPatterns: {
//     mostAccessed: [
//       { id: 'mem_abc', count: 145, content: '...' },
//       { id: 'mem_def', count: 98, content: '...' }
//     ],
//     neverAccessed: 234,
//     lastAccessedRecently: 1200
//   },
//
//   // ACID Conversation Stats
//   conversationStats: {
//     totalConversations: 234,
//     userAgentConversations: 198,
//     a2aConversations: 36,
//     totalMessages: 4567,
//     avgMessagesPerConversation: 19.5
//   }
// }
```

### Tag Analysis

```typescript
// Get tag distribution across Vector Memories
const tagStats = await cortex.analytics.getTagStats("support-agent");

console.log(tagStats);
// {
//   totalTags: 45,
//   topTags: [
//     { tag: 'troubleshooting', count: 423, avgImportance: 75 },
//     { tag: 'preferences', count: 301, avgImportance: 60 },
//     { tag: 'billing', count: 256, avgImportance: 80 },
//     { tag: 'a2a', count: 234, avgImportance: 70 }  // A2A communications
//   ],
//   averageTagsPerMemory: 2.8,
//   bySourceType: {
//     conversation: ['preferences', 'user-info', 'support'],
//     a2a: ['delegation', 'coordination', 'approval'],
//     system: ['config', 'status', 'alert']
//   }
// }
```

### Growth Trends

```typescript
// Analyze growth over time
const growth = await cortex.analytics.getGrowthTrends("support-agent", {
  period: "30d",
  interval: "daily",
});

growth.forEach((day) => {
  console.log(`${day.date}: ${day.memoriesAdded} memories added`);
});
```

## Memory Health Insights

### Finding Unused Memories

```typescript
// Memories that have never been accessed
const unused = await cortex.memory.search("agent-1", "*", {
  filter: {
    accessCount: 0,
    createdBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  sortBy: "createdAt",
  limit: 100,
});

console.log(`${unused.length} memories created 30+ days ago never accessed`);

// Analyze by importance and source type
const analysis = {
  byImportance: {
    critical: unused.filter((m) => m.metadata.importance >= 90).length,
    high: unused.filter(
      (m) => m.metadata.importance >= 70 && m.metadata.importance < 90,
    ).length,
    medium: unused.filter(
      (m) => m.metadata.importance >= 40 && m.metadata.importance < 70,
    ).length,
    low: unused.filter((m) => m.metadata.importance < 40).length,
  },
  bySourceType: {
    conversation: unused.filter((m) => m.source.type === "conversation").length,
    a2a: unused.filter((m) => m.source.type === "a2a").length,
    system: unused.filter((m) => m.source.type === "system").length,
  },
  withConversationRef: unused.filter((m) => m.conversationRef).length,
};

// Safe to delete: low importance, no conversation ref
const safeDeletion = unused.filter(
  (m) => m.metadata.importance < 30 && !m.conversationRef, // Not linked to ACID
);

for (const memory of safeDeletion) {
  await cortex.memory.delete("agent-1", memory.id);
}

// Keep if has conversationRef (can retrieve from ACID if needed later)
const keepForACID = unused.filter((m) => m.conversationRef);
console.log(`Keeping ${keepForACID.length} unused memories (have ACID source)`);
```

### Finding Hot Memories

```typescript
// Most frequently accessed memories
const hot = await cortex.memory.search("agent-1", "*", {
  sortBy: "accessCount",
  sortOrder: "desc",
  limit: 10,
});

console.log("Most accessed memories:");
hot.forEach((m) => {
  console.log(`  ${m.accessCount} accesses: ${m.content.substring(0, 50)}...`);
});
```

### Identifying Duplicates

```typescript
// Find similar memories (potential duplicates)
async function findDuplicateCandidates(memorySpaceId: string) {
  const all = await cortex.memory.search(memorySpaceId, "*", { limit: 1000 });

  const duplicates = [];

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const similarity = cosineSimilarity(all[i].embedding, all[j].embedding);

      if (similarity > 0.95) {
        duplicates.push({
          memory1: all[i],
          memory2: all[j],
          similarity,
        });
      }
    }
  }

  return duplicates;
}
```

## Performance Analytics

### Search Performance

```typescript
// Track search performance
const searchMetrics = await cortex.analytics.getSearchMetrics("agent-1", {
  period: "7d",
});

console.log({
  totalSearches: searchMetrics.count,
  avgSearchTime: searchMetrics.avgTime, // ms
  cacheHitRate: searchMetrics.cacheHitRate, // %
  strategyBreakdown: {
    semantic: searchMetrics.strategies.semantic, // %
    keyword: searchMetrics.strategies.keyword, // %
    recent: searchMetrics.strategies.recent, // %
  },
});
```

### Storage Metrics

```typescript
// Storage usage across both layers
const storage = await cortex.analytics.getStorageMetrics("agent-1");

console.log({
  // Vector Memory storage
  vectorMemories: {
    count: storage.vectorMemories,
    estimatedSize: storage.vectorSizeBytes,
    withEmbeddings: storage.memoriesWithEmbeddings,
    withoutEmbeddings: storage.memoriesWithoutEmbeddings,
    embeddingStorageSize: storage.embeddingBytes, // Can be large with 3072-dim
    textStorageSize: storage.textBytes,
    avgMemorySize: storage.avgVectorMemoryBytes,
  },

  // ACID Conversation storage
  acidConversations: {
    userAgentCount: storage.userAgentConversations,
    a2aCount: storage.a2aConversations,
    totalMessages: storage.totalAcidMessages,
    estimatedSize: storage.acidSizeBytes, // Much smaller (no embeddings)
    avgMessageSize: storage.avgAcidMessageBytes,
  },

  // Savings from hybrid approach
  savings: {
    vectorRetentionSavings: storage.deletedVersionsSize, // Space saved from retention
    acidPreservation: storage.acidPreservedMessages, // Messages still in ACID after vector cleanup
    estimatedMonthlyCost: storage.estimatedConvexCost, // Approx Convex storage cost
  },

  // Optimization opportunities
  recommendations: [
    `${storage.memoriesWithoutEmbeddings} memories could have embeddings added`,
    `${storage.rawContentCount} raw memories could be summarized (save ${storage.summarizationSavings} bytes)`,
    `Vector retention cleanup saved ${storage.vectorRetentionSavings} bytes this month`,
  ],
});
```

## Optimization Recommendations

### Based on Access Patterns

```typescript
const recommendations = await cortex.analytics.getRecommendations("agent-1");

console.log(recommendations);
// [
//   {
//     type: 'cleanup',
//     message: '234 memories never accessed in 30+ days',
//     action: 'Delete or archive low-importance unused memories',
//     potentialSavings: '1.2 MB',
//     details: {
//       lowImportance: 189,  // importance < 30
//       noConversationRef: 45,  // Safe to delete (no ACID link)
//       hasConversationRef: 189  // Keep for audit (can retrieve from ACID)
//     }
//   },
//   {
//     type: 'optimization',
//     message: '15% of searches use keyword fallback',
//     action: 'Add embeddings to 93 memories missing them',
//     expectedImprovement: '20% better search accuracy',
//     cloudModeOption: 'Enable autoEmbed to handle automatically'
//   },
//   {
//     type: 'storage',
//     message: '456 raw memories could be summarized',
//     action: 'Enable content summarization for high-volume memories',
//     potentialSavings: '2.3 MB',
//     cloudModeOption: 'Enable autoSummarize in Cortex Cloud',
//     details: {
//       conversationMemories: 380,  // Have conversationRef, can summarize
//       systemMemories: 76  // Generated content, summarization helpful
//     }
//   },
//   {
//     type: 'architecture',
//     message: 'Tag "support" appears in 40% of memories',
//     action: 'Consider creating specialized support-agent',
//     benefit: 'Better organization and faster searches'
//   },
//   {
//     type: 'retention',
//     message: 'Vector retention cleaned up 1200 old versions this month',
//     action: 'No action needed - working as designed',
//     benefit: 'Saved 8.4 MB while preserving ACID source',
//     preserved: '1200 messages still accessible via conversationRef'
//   }
// ]
```

## Cloud Mode Features

> **Cloud Mode Only**: Advanced analytics with Cortex Cloud

### Visual Analytics Dashboard

Interactive charts and graphs:

- Memory growth over time (Vector + ACID separately)
- Search performance trends (semantic vs text)
- Tag distribution pie charts
- Access heat maps
- Agent comparison views
- Conversation metrics (user-agent vs A2A)
- Storage breakdown (Vector embeddings vs ACID messages)

### Predictive Analytics

AI-powered predictions:

- "Based on current growth, you'll hit 10K memories in 45 days"
- "Search performance will degrade at 50K memories - consider optimization"
- "This agent's memory pattern suggests splitting into 2 specialized agents"
- "Vector retention will save 15 MB this month while preserving ACID history"
- "94% embedding coverage - semantic search working well"

### Cost Optimization

Real-time cost tracking with hybrid architecture insights:

- **Vector Memory costs**: Embeddings (largest), content, metadata
- **ACID Conversation costs**: Messages (smaller, no embeddings)
- **Total Convex costs**: Both layers combined
- Embedding generation costs (if using Cloud autoEmbed)
- Query costs
- **Savings from retention**: Space saved by Vector cleanup vs ACID preservation
- Optimization suggestions with ROI:
  - "Summarize 200 raw memories → save $5/month"
  - "Vector retention saved $12/month vs keeping all versions"
  - "Add embeddings to 50 memories → improve search 25%"

### Alerts and Notifications

Automated alerts:

- Memory growth exceeds threshold
- Search performance degrading
- Unusual access patterns detected
- Storage limit approaching
- Embedding coverage dropping (more text-only searches)
- ACID conversation growth (for audit capacity planning)
- Vector retention cleanup milestones

## Custom Analytics

### Build Your Own Metrics

```typescript
// Track custom business metrics
async function getCustomMetrics(memorySpaceId: string) {
  const memories = await cortex.memory.search(memorySpaceId, "*", {
    limit: 10000,
  });

  return {
    // Customer satisfaction related
    satisfactionMentions: memories.filter((m) =>
      m.metadata.tags.includes("satisfaction"),
    ).length,

    // Resolution efficiency
    avgResolutionTime: calculateAvg(
      memories
        .filter((m) => m.metadata.tags.includes("resolution"))
        .map((m) => m.metadata.resolutionTimeMinutes),
    ),

    // Topic distribution
    byTopic: groupBy(memories, (m) => m.metadata.primaryTopic),
  };
}
```

### Export Analytics Data

```typescript
// Export for external analysis
const data = await cortex.analytics.export("agent-1", {
  format: "csv", // or 'json'
  metrics: ["accessCount", "importance", "tags", "createdAt"],
  dateRange: {
    start: new Date("2025-10-01"),
    end: new Date("2025-10-31"),
  },
});

// Save or analyze
await fs.writeFile("agent-analytics.csv", data);
```

## Real-World Applications

### Optimizing Agent Performance

```typescript
async function optimizeAgent(memorySpaceId: string) {
  const stats = await cortex.memorySpaces.getStats(memorySpaceId);

  // Too many memories?
  if (stats.totalMemories > 10000) {
    console.log("Consider: Archive old, low-importance memories");
    await archiveOldMemories(agentId);
  }

  // Poor embedding coverage?
  if (stats.memoryHealth.withoutEmbeddings > 100) {
    console.log("Consider: Add embeddings to improve search");
    await addMissingEmbeddings(agentId);
  }

  // Slow searches?
  if (stats.searchStats.avgSearchTime > 100) {
    console.log("Consider: Use smaller embedding dimensions or add indexes");
  }
}
```

### ROI Tracking

```typescript
// Track return on investment for memory system (hybrid architecture)
async function calculateMemoryROI(memorySpaceId: string) {
  const stats = await cortex.memorySpaces.getStats(memorySpaceId);

  // Calculate costs (hybrid architecture)
  const vectorCost = {
    storage: stats.vectorMemories * 0.001, // $0.001 per memory
    embeddings: stats.memoryHealth.withEmbeddings * 0.0001, // $0.0001 per embedding/month
    searches: stats.searchStats.totalSearches * 0.0001, // $0.0001 per search
  };

  const acidCost = {
    storage: stats.conversationStats.totalMessages * 0.0001, // Much cheaper (no embeddings)
    queries: stats.conversationStats.totalConversations * 0.00001, // Occasional retrieval
  };

  const totalCosts =
    Object.values(vectorCost).reduce((a, b) => a + b, 0) +
    Object.values(acidCost).reduce((a, b) => a + b, 0);

  // Calculate value
  const timesSaved =
    stats.accessPatterns.mostAccessed.reduce((sum, m) => sum + m.count, 0) * 5; // 5 seconds saved per access

  const valueDollars = (timesSaved / 3600) * 50; // $50/hour value

  // Savings from hybrid architecture
  const retentionSavings = stats.deletedVersionsCount * 0.001; // Saved by retention
  const acidPreservation = stats.acidPreservedMessages * 0.0001; // Cost to keep in ACID

  return {
    costs: {
      vector: Object.values(vectorCost).reduce((a, b) => a + b, 0),
      acid: Object.values(acidCost).reduce((a, b) => a + b, 0),
      total: totalCosts,
    },
    value: valueDollars,
    roi: ((valueDollars - totalCosts) / totalCosts) * 100,
    hybridBenefits: {
      retentionSavings, // Saved by Vector cleanup
      acidPreservation, // Cost to keep ACID (worth it for compliance)
      netSavings: retentionSavings - acidPreservation, // Usually positive!
      compliance: "Full audit trail preserved despite Vector retention",
    },
  };
}
```

## Analytics Across All Layers

### Unified View

```typescript
// Get complete analytics across all Cortex layers
const fullAnalytics = await cortex.analytics.getCompleteStats("agent-1");

console.log(fullAnalytics);
// {
//   agent: { id: 'agent-1', name: '...', registeredAgents: true/false },
//
//   vectorMemories: {
//     total: 1543,
//     bySourceType: { conversation: 1100, a2a: 234, system: 156, tool: 53 },
//     withEmbeddings: 1450,
//     withConversationRef: 1234  // Linked to ACID
//   },
//
//   acidConversations: {
//     userAgent: 198,  // User conversations
//     agentAgent: 36,  // A2A conversations
//     totalMessages: 4567,
//     oldestConversation: Date,
//     newestConversation: Date
//   },
//
//   contextChains: {
//     active: 12,
//     completed: 89,
//     totalContexts: 101
//   },
//
//   searchPerformance: {
//     avgSemanticSearchTime: 23,  // ms
//     avgTextSearchTime: 8,  // ms (faster without vectors)
//     cacheHitRate: 15  // %
//   },
//
//   storageEfficiency: {
//     vectorRetentionSavings: '8.4 MB/month',
//     acidPreservationCost: '1.2 MB/month',
//     netSavings: '7.2 MB/month',
//     complianceValue: 'Full audit trail maintained'
//   }
// }
```

### Cross-Layer Analytics

Track relationships between layers:

```typescript
// Memories linked to conversations
const linkedMemories = await cortex.analytics.getLinkedMemories("agent-1");
console.log(
  `${linkedMemories.percentage}% of memories link to ACID conversations`,
);

// Orphaned memories (no conversation ref)
const orphaned = await cortex.analytics.getOrphanedMemories("agent-1");
console.log(`${orphaned.count} memories without ACID source`);

// Conversation utilization
const convoUtilization =
  await cortex.analytics.getConversationUtilization("agent-1");
// How many conversations have been indexed into Vector Memories
console.log(
  `${convoUtilization.indexed}/${convoUtilization.total} conversations indexed`,
);
```

## Summary

**Access Analytics tracks:**

- ✅ Vector Memory usage (searches, access patterns, versions)
- ✅ ACID Conversation metrics (message counts, types)
- ✅ Storage efficiency (hybrid architecture savings)
- ✅ Search performance (semantic vs text)
- ✅ Importance distribution (0-100 scale)
- ✅ Content type breakdown (raw vs summarized)
- ✅ Source type distribution (conversation, a2a, system, tool)
- ✅ conversationRef coverage (how many memories link to ACID)

**Cloud Mode adds:**

- Visual dashboards
- Predictive analytics
- Automated optimization recommendations
- Cost tracking with ROI calculations

## Next Steps

- **[Agent Memory](./01-memory-spaces.md)** - Vector layer fundamentals
- **[Conversation History](./06-conversation-history.md)** - ACID layer details
- **[Vector Embeddings](../04-architecture/04-vector-embeddings.md)** - Choosing embedding dimensions
- **[Memory Operations API](../03-api-reference/02-memory-operations.md)** - Complete API reference

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
