# Advanced Usage

Advanced patterns and configurations for Cortex Memory Provider with SDK v0.21.0+.

## Graph Memory Integration (SDK v0.19.0+)

Sync memories to Neo4j or Memgraph for complex relationship queries.

### Environment Variable Configuration

The simplest setup uses environment variables:

```bash
# .env.local
CORTEX_GRAPH_SYNC=true

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# Or Memgraph
# MEMGRAPH_URI=bolt://localhost:7687
# MEMGRAPH_USERNAME=
# MEMGRAPH_PASSWORD=
```

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant",
  
  // Auto-configured from env vars
  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === 'true',
});
```

### Explicit Configuration

For more control, pass graph configuration directly:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant",
  
  enableGraphMemory: true,
  graphConfig: {
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "your-password",
    type: "neo4j", // or "memgraph"
  },
});
```

### Async Initialization (Recommended)

For automatic graph database connection setup:

```typescript
import { createCortexMemoryAsync } from "@cortexmemory/vercel-ai-provider";

// Reads graph config from env vars and validates connection
const cortexMemory = await createCortexMemoryAsync({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant",
});
```

## Automatic Fact Extraction (SDK v0.18.0+)

LLM-powered extraction of structured facts from conversations.

### Environment Variable Configuration

```bash
# .env.local
CORTEX_FACT_EXTRACTION=true
CORTEX_FACT_EXTRACTION_MODEL=gpt-4o-mini
```

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant",
  
  // Auto-configured from env vars
  enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === 'true',
});
```

### Explicit Configuration

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant",
  
  enableFactExtraction: true,
  factExtractionConfig: {
    model: "gpt-4o-mini",
    provider: "openai",
  },
});
```

### Custom Fact Extraction

For full control over fact extraction logic:

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const factSchema = z.object({
  facts: z.array(
    z.object({
      fact: z.string(),
      factType: z.enum([
        "preference",
        "identity", 
        "knowledge",
        "relationship",
        "event",
        "observation",
      ]),
      subject: z.string().optional(),
      predicate: z.string().optional(),
      object: z.string().optional(),
      confidence: z.number(),
      tags: z.array(z.string()).optional(),
    }),
  ),
});

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "smart-agent",
  userId: "user-123",
  agentId: "my-assistant",

  enableFactExtraction: true,
  extractFacts: async (userMsg, agentResp) => {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: factSchema,
      prompt: `Extract structured facts from this conversation.

User: "${userMsg}"
Assistant: "${agentResp}"

Focus on:
- User preferences (favorite things, likes/dislikes)
- Identity facts (name, job, location)
- Knowledge (things user knows or learned)
- Relationships (people mentioned)
- Events (things that happened)`,
    });

    return object.facts.map((f) => ({
      fact: f.fact,
      factType: f.factType,
      subject: f.subject,
      predicate: f.predicate,
      object: f.object,
      confidence: f.confidence,
      tags: f.tags,
    }));
  },
});
```

## Layer Observation (for Visualization)

Watch memory orchestration in real-time for UI visualization.

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "demo-agent",
  userId: "user-123",
  agentId: "my-assistant",

  layerObserver: {
    onOrchestrationStart: (orchestrationId) => {
      console.log(`Starting orchestration: ${orchestrationId}`);
      setIsOrchestrating(true);
    },
    
    onLayerUpdate: (event) => {
      // event.layer: 'memorySpace' | 'user' | 'agent' | 'conversation' | 'vector' | 'facts' | 'graph'
      // event.status: 'pending' | 'in_progress' | 'complete' | 'error' | 'skipped'
      // event.latencyMs: number
      // event.data: { id?, preview?, metadata? }
      
      console.log(`${event.layer}: ${event.status} (${event.latencyMs}ms)`);
      updateLayerVisualization(event.layer, event);
    },
    
    onOrchestrationComplete: (summary) => {
      console.log(`Total orchestration: ${summary.totalLatencyMs}ms`);
      console.log(`Created IDs:`, summary.createdIds);
      setIsOrchestrating(false);
    },
  },
});
```

See the [quickstart demo](../../../packages/vercel-ai-provider/quickstart) for a full implementation of the LayerFlowDiagram component.

## Enhanced Streaming

### Progressive Storage

Store partial responses during streaming for resumability:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "demo-chat",
  userId: "user-123",
  agentId: "my-assistant",

  streamingOptions: {
    storePartialResponse: true,
    partialResponseInterval: 3000, // Update every 3 seconds
  },
});
```

### Streaming Hooks

Monitor streaming progress in real-time:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "demo-chat",
  userId: "user-123",
  agentId: "my-assistant",

  streamingHooks: {
    onChunk: (event) => {
      console.log(`Chunk ${event.chunkNumber}: ${event.chunk}`);
      console.log(`Accumulated: ${event.accumulated.length} chars`);
      console.log(`Estimated tokens: ${event.estimatedTokens}`);
    },
    
    onProgress: (event) => {
      console.log(`Bytes processed: ${event.bytesProcessed}`);
      console.log(`Chunks: ${event.chunks}`);
      console.log(`Elapsed: ${event.elapsedMs}ms`);
      console.log(`Phase: ${event.currentPhase}`);
      
      updateProgressBar(event.bytesProcessed);
    },
    
    onError: (error) => {
      console.error("Stream error:", error.message);
      console.log(`Phase: ${error.phase}`);
      console.log(`Recoverable: ${error.recoverable}`);
      
      if (error.resumeToken) {
        saveResumeToken(error.resumeToken);
      }
    },
    
    onComplete: (event) => {
      console.log(`Response: ${event.fullResponse.length} chars`);
      console.log(`Duration: ${event.durationMs}ms`);
      console.log(`Total chunks: ${event.totalChunks}`);
      console.log(`Facts extracted: ${event.factsExtracted}`);
    },
  },
});
```

### Progressive Fact Extraction

Extract facts incrementally during streaming:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "demo-chat",
  userId: "user-123",
  agentId: "my-assistant",

  enableFactExtraction: true,
  streamingOptions: {
    progressiveFactExtraction: true,
    factExtractionThreshold: 500, // Extract every 500 characters
  },
});
```

### Error Recovery

Handle interrupted streams:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "demo-chat",
  userId: "user-123",
  agentId: "my-assistant",

  streamingOptions: {
    partialFailureHandling: 'store-partial', // or 'rollback', 'retry', 'best-effort'
    maxRetries: 3,
    generateResumeToken: true,
    streamTimeout: 30000, // 30 seconds
    maxResponseLength: 50000, // characters
  },
});
```

### Adaptive Processing

Auto-optimize based on stream characteristics:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "demo-chat",
  userId: "user-123",
  agentId: "my-assistant",

  streamingOptions: {
    enableAdaptiveProcessing: true, // Auto-adjust batch sizes, intervals
    storePartialResponse: true,
    progressiveFactExtraction: true,
    progressiveGraphSync: true,
  },
});
```

## Custom Embedding Providers

### OpenAI Embeddings

```typescript
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant",

  embeddingProvider: {
    generate: async (text) => {
      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-large"),
        value: text,
      });
      return embedding;
    },
  },
});
```

### Local Embeddings (Transformers.js)

```typescript
import { pipeline } from "@xenova/transformers";

const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
);

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "local-agent",
  userId: "user-123",
  agentId: "my-assistant",

  embeddingProvider: {
    generate: async (text) => {
      const output = await embedder(text, { pooling: "mean", normalize: true });
      return Array.from(output.data);
    },
  },
});
```

## Custom Context Injection

Control how memory context is added to prompts:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "custom-agent",
  userId: "user-123",
  agentId: "my-assistant",

  // Custom context builder
  customContextBuilder: (memories) => {
    const highImportance = memories.filter((m) => m.importance > 70);
    const recent = memories.slice(0, 3);
    
    return `## Critical Information
${highImportance.map((m) => `- ${m.content}`).join('\n')}

## Recent Context
${recent.map((m) => `- ${m.content}`).join('\n')}`;
  },
  
  // Or use injection strategy
  contextInjectionStrategy: 'system', // or 'user', 'custom'
});
```

## Performance Optimization

### Memory Search Tuning

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "fast-agent",
  userId: "user-123",
  agentId: "my-assistant",

  // Limit search results for faster responses
  memorySearchLimit: 3,
  
  // Higher threshold = more relevant results only
  minMemoryRelevance: 0.8,
  
  // Filter by importance
  defaultImportance: 50,
});
```

### Disable Features for Speed

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "minimal-agent",
  userId: "user-123",
  agentId: "my-assistant",

  // Disable search for write-only scenarios
  enableMemorySearch: false,
  
  // Or disable storage for read-only scenarios
  enableMemoryStorage: false,
  
  // Disable metrics collection
  enableStreamMetrics: false,
});
```

## See Also

- [API Reference](./api-reference.md) - Complete API documentation
- [Memory Operations](../../03-api-reference/02-memory-operations.md) - Core SDK memory operations
- [Graph Operations](../../03-api-reference/15-graph-operations.md) - Graph database integration
- [Facts Operations](../../03-api-reference/14-facts-operations.md) - Fact extraction API
