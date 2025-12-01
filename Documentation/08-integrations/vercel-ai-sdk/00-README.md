# Vercel AI SDK Integration

> **Package**: `@cortexmemory/vercel-ai-provider`  
> **Version**: 0.2.0  
> **Status**: Production Ready ✅

Complete integration with Vercel AI SDK for Next.js applications with enhanced streaming capabilities.

## Quick Links

- [Getting Started](./getting-started.md) - Step-by-step setup tutorial
- [API Reference](./api-reference.md) - Complete API documentation
- [Advanced Usage](./advanced-usage.md) - Custom configurations and patterns
- [Memory Spaces](./memory-spaces.md) - Multi-tenancy guide
- [Hive Mode](./hive-mode.md) - Cross-application memory sharing
- [Migration from mem0](./migration-from-mem0.md) - Switch from mem0
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Overview

The Cortex Memory Provider for Vercel AI SDK enables automatic persistent memory for AI applications built with Next.js and the Vercel AI SDK.

### Key Features

- 🧠 **Automatic Memory** - Search and store without manual steps
- 🚀 **Edge Compatible** - Works in Vercel Edge Functions
- 📦 **TypeScript Native** - Built for TypeScript from the ground up
- 🔒 **Self-Hosted** - Deploy Convex anywhere, no vendor lock-in
- 🎯 **Memory Spaces** - Multi-tenant isolation built-in
- 🐝 **Hive Mode** - Share memory across applications
- ⚡ **Enhanced Streaming** - Progressive storage, real-time hooks, and metrics (v0.2.0+)
- 📊 **Streaming Metrics** - Automatic performance monitoring and analysis
- 🔄 **Error Recovery** - Resume interrupted streams with partial failure handling
- 🎯 **Adaptive Processing** - Auto-optimize based on stream characteristics

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

  // Optional: Enhanced streaming features (v0.2.0+)
  streamingOptions: {
    storePartialResponse: true, // Store during streaming
    progressiveFactExtraction: true, // Extract facts incrementally
    enableStreamMetrics: true, // Collect performance metrics
  },

  streamingHooks: {
    onProgress: (event) => {
      console.log(`Progress: ${event.progress}%`);
    },
    onComplete: (event) => {
      console.log("Metrics:", event.metrics);
    },
  },
});

const result = await streamText({
  model: cortexMemory(openai("gpt-5-nano")),
  messages: [{ role: "user", content: "What did I tell you earlier?" }],
});
```

**That's it!** Memory is automatically searched and stored with optional enhanced streaming features.

## What Gets Built

This integration provides:

1. **Memory-Augmented Models** - Wrap any AI SDK provider with memory
2. **Automatic Context Injection** - Relevant memories added to prompts
3. **Automatic Storage** - Conversations stored after responses (or progressively during streaming)
4. **Manual Control** - Search, remember, clear methods available
5. **Edge Runtime Support** - Works in serverless/edge environments
6. **Enhanced Streaming** (v0.2.0+):
   - Progressive storage during streaming for resumability
   - Real-time lifecycle hooks (onChunk, onProgress, onError, onComplete)
   - Comprehensive streaming metrics and performance analysis
   - Progressive fact extraction during streaming
   - Progressive graph sync to Neo4j/Memgraph
   - Error recovery with partial failure handling
   - Adaptive processing based on stream characteristics

## What's New in v0.2.0

### 🚀 Enhanced Streaming with rememberStream()

Version 0.2.0 introduces powerful streaming capabilities powered by Cortex SDK v0.11.0:

**Progressive Storage**: Store partial responses during streaming for resumability

```typescript
streamingOptions: {
  storePartialResponse: true,
  partialResponseInterval: 3000, // ms
}
```

**Streaming Hooks**: Real-time monitoring with lifecycle callbacks

```typescript
streamingHooks: {
  onChunk: (event) => console.log('Chunk:', event.chunk),
  onProgress: (event) => console.log('Progress:', event.progress),
  onError: (event) => console.error('Error:', event.error),
  onComplete: (event) => console.log('Complete:', event.metrics),
}
```

**Streaming Metrics**: Automatic performance monitoring

```typescript
streamingOptions: {
  enableStreamMetrics: true, // enabled by default
}
// Get metrics: firstChunkLatency, totalDuration, throughput, costs
```

**Progressive Fact Extraction**: Extract facts during streaming

```typescript
streamingOptions: {
  progressiveFactExtraction: true,
  factExtractionThreshold: 500, // characters
}
```

**Error Recovery**: Handle interrupted streams

```typescript
streamingOptions: {
  partialFailureHandling: 'store-partial', // or 'rollback', 'retry', 'best-effort'
  maxRetries: 3,
  generateResumeToken: true,
  streamTimeout: 30000, // ms
}
```

**Performance**: First chunk latency 6-10ms, <5% overhead, O(1) memory usage

All features are **backward compatible** and opt-in via configuration.

## Examples

See [examples directory](../../../packages/vercel-ai-provider/examples/) for:

- **next-chat** - Basic chat with persistent memory (updated for v0.2.0)
- **next-rag** - RAG pattern combining documents + conversation memory (updated for v0.2.0)
- **next-multimodal** - Multi-modal chat with memory (placeholder)
- **hive-mode** - Cross-application memory sharing (placeholder)
- **memory-spaces** - Multi-tenant SaaS (placeholder)

## Package Source

Package source code: [`packages/vercel-ai-provider/`](../../../packages/vercel-ai-provider/)

## See Also

- [Cortex SDK Documentation](../../00-README.md) - Main Cortex documentation
- [Streaming Support](../../02-core-features/12-streaming-support.md) - SDK streaming features
- [Memory Spaces](../../02-core-features/01-memory-spaces.md) - Core memory space features
- [Hive Mode](../../02-core-features/10-hive-mode.md) - Core hive mode features
