# Vercel AI SDK Integration

> **Package**: `@cortexmemory/vercel-ai-provider`  
> **Version**: 1.0.0  
> **SDK Compatibility**: Cortex SDK v0.21.0+  
> **Status**: Production Ready ✅

Complete integration with Vercel AI SDK for Next.js applications with full memory orchestration capabilities.

## Quick Links

- [Getting Started](./getting-started.md) - Step-by-step setup tutorial
- [API Reference](./api-reference.md) - Complete API documentation
- [Advanced Usage](./advanced-usage.md) - Graph memory, fact extraction, and custom configurations
- [Memory Spaces](./memory-spaces.md) - Multi-tenancy guide
- [Hive Mode](./hive-mode.md) - Cross-application memory sharing
- [Migration from mem0](./migration-from-mem0.md) - Switch from mem0
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## 🚀 Quickstart Demo

The best way to get started is with our **interactive quickstart demo**:

```bash
cd packages/vercel-ai-provider/quickstart
npm install
npm run dev
```

The quickstart demonstrates:

- 🔄 **Real-time Memory Orchestration** - Watch data flow through all Cortex layers
- 📊 **Layer Flow Visualization** - See Memory Space → User → Agent → Conversation → Vector → Facts → Graph
- 🔀 **Memory Space Switching** - Demonstrate multi-tenant isolation
- ⚡ **Streaming with Progressive Storage** - See how streaming works with memory

See [`quickstart/README.md`](https://github.com/SaintNick1214/Project-Cortex/tree/main/packages/vercel-ai-provider/quickstart) for full setup instructions.

## Overview

The Cortex Memory Provider for Vercel AI SDK enables automatic persistent memory for AI applications built with Next.js and the Vercel AI SDK.

### Key Features

- 🧠 **Automatic Memory** - Search and store without manual steps
- 🤖 **agentId Support** - Required for user-agent conversations (SDK v0.17.0+)
- 🕸️ **Graph Memory** - Optional Neo4j/Memgraph integration (SDK v0.19.0+)
- 🧬 **Fact Extraction** - Automatic LLM-powered extraction (SDK v0.18.0+)
- 🚀 **Edge Compatible** - Works in Vercel Edge Functions
- 📦 **TypeScript Native** - Built for TypeScript from the ground up
- 🔒 **Self-Hosted** - Deploy Convex anywhere, no vendor lock-in
- 🎯 **Memory Spaces** - Multi-tenant isolation built-in
- 🐝 **Hive Mode** - Share memory across applications
- ⚡ **Enhanced Streaming** - Progressive storage, real-time hooks, and metrics
- 📊 **Layer Observation** - Real-time visualization of memory orchestration

## ⚠️ Breaking Change: agentId Required

Since SDK v0.17.0, all user-agent conversations **require an `agentId`**:

```typescript
// ❌ Old way (will throw error)
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123",
});

// ✅ New way (v0.17.0+)
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123",
  agentId: "my-assistant", // Required!
});
```

## Quick Start

```bash
npm install @cortexmemory/vercel-ai-provider @cortexmemory/sdk ai convex
```

```typescript
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123",
  userName: "User",

  // REQUIRED in SDK v0.17.0+
  agentId: "my-assistant",
  agentName: "My AI Assistant",

  // Optional: Enable graph memory (auto-configured via env vars)
  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",

  // Optional: Enable fact extraction (auto-configured via env vars)
  enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",

  // Optional: Enhanced streaming features
  streamingOptions: {
    storePartialResponse: true,
    progressiveFactExtraction: true,
    enableAdaptiveProcessing: true,
  },
});

const result = await streamText({
  model: cortexMemory(openai("gpt-4o-mini")),
  messages: [{ role: "user", content: "What did I tell you earlier?" }],
});
```

**That's it!** Memory is automatically orchestrated across all layers.

## What Gets Built

This integration provides:

1. **Memory-Augmented Models** - Wrap any AI SDK provider with memory
2. **Full Orchestration** - Automatic multi-layer memory storage:
   - Conversation storage (ACID-safe)
   - Vector embeddings (semantic search)
   - Fact extraction (structured knowledge)
   - Graph sync (entity relationships)
3. **Automatic Context Injection** - Relevant memories added to prompts
4. **Manual Control** - Search, remember, clear methods available
5. **Edge Runtime Support** - Works in serverless/edge environments
6. **Real-time Visualization** - Layer observer for UI integration

## SDK v0.21.0 Features

### Graph Memory (v0.19.0+)

Sync memories to Neo4j or Memgraph for relationship queries:

```typescript
const cortexMemory = createCortexMemory({
  // ... base config
  enableGraphMemory: true,

  // Auto-configured from env vars:
  // NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
  // or MEMGRAPH_URI, MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD
});
```

### Automatic Fact Extraction (v0.18.0+)

LLM-powered extraction of structured facts:

```typescript
const cortexMemory = createCortexMemory({
  // ... base config
  enableFactExtraction: true,

  // Auto-configured from env vars:
  // CORTEX_FACT_EXTRACTION=true
  // CORTEX_FACT_EXTRACTION_MODEL=gpt-4o-mini
});
```

### Layer Observation (for Visualization)

Watch data flow through all layers in real-time:

```typescript
const cortexMemory = createCortexMemory({
  // ... base config
  layerObserver: {
    onLayerUpdate: (event) => {
      // event.layer: 'memorySpace' | 'user' | 'agent' | 'conversation' | 'vector' | 'facts' | 'graph'
      // event.status: 'pending' | 'in_progress' | 'complete' | 'error'
      // event.latencyMs: number
      updateVisualization(event);
    },
    onOrchestrationComplete: (summary) => {
      console.log(`Total time: ${summary.totalLatencyMs}ms`);
    },
  },
});
```

### Enhanced Streaming

Progressive storage and real-time monitoring:

```typescript
const cortexMemory = createCortexMemory({
  // ... base config
  streamingOptions: {
    storePartialResponse: true,
    partialResponseInterval: 3000,
    progressiveFactExtraction: true,
    progressiveGraphSync: true,
    enableAdaptiveProcessing: true,
  },

  streamingHooks: {
    onChunk: (event) => console.log("Chunk:", event.chunk),
    onProgress: (event) => console.log("Progress:", event.bytesProcessed),
    onComplete: (event) => console.log("Done:", event.durationMs),
  },
});
```

## Environment Variables

Configure features via environment variables:

```bash
# Required
CONVEX_URL=https://your-project.convex.cloud
OPENAI_API_KEY=sk-...

# Fact Extraction (SDK v0.18.0+)
CORTEX_FACT_EXTRACTION=true
CORTEX_FACT_EXTRACTION_MODEL=gpt-4o-mini

# Graph Memory (SDK v0.19.0+)
CORTEX_GRAPH_SYNC=true
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
```

## Package Source

Package source code: [`packages/vercel-ai-provider/`](https://github.com/SaintNick1214/Project-Cortex/tree/main/packages/vercel-ai-provider)

Quickstart demo: [`packages/vercel-ai-provider/quickstart/`](https://github.com/SaintNick1214/Project-Cortex/tree/main/packages/vercel-ai-provider/quickstart)

## See Also

- [Cortex SDK Documentation](/) - Main Cortex documentation
- [Memory Operations](../../03-api-reference/02-memory-operations.md) - remember() and rememberStream() API
- [Graph Operations](../../03-api-reference/15-graph-operations.md) - Graph database integration
- [Facts Operations](../../03-api-reference/14-facts-operations.md) - Fact extraction API
- [Memory Spaces](../../02-core-features/01-memory-spaces.md) - Core memory space features
- [Hive Mode](../../02-core-features/10-hive-mode.md) - Core hive mode features
