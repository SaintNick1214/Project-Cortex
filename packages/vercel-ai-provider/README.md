# Cortex Memory Provider for Vercel AI SDK

> **Persistent memory for your AI applications powered by Cortex and Convex**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

Add long-term memory to any Vercel AI SDK application with a single import. Built on Cortex for TypeScript-native memory management with zero vendor lock-in.

## ✨ Features

- 🧠 **Automatic Memory** - Retrieves relevant context before each response, stores conversations after
- 🚀 **Zero Configuration** - Works out of the box with sensible defaults
- 📦 **TypeScript Native** - Built for TypeScript, not ported from Python
- 🔒 **Self-Hosted** - Deploy Convex anywhere, no API keys or vendor lock-in
- ⚡ **Edge Compatible** - Works in Vercel Edge Functions, Cloudflare Workers
- 🎯 **Memory Spaces** - Isolate memory by user, team, or project
- 🐝 **Hive Mode** - Share memory across multiple agents/applications
- 📊 **ACID Guarantees** - Never lose data with Convex transactions
- 🔍 **Semantic Search** - Find relevant memories with embeddings
- 🧬 **Fact Extraction** - LLM-powered fact extraction for 60-90% storage savings
- 🕸️ **Graph Memory** - Optional Neo4j/Memgraph integration for relationship queries

## 🚀 Quickstart Demo

The best way to get started is with our interactive quickstart demo:

```bash
cd packages/vercel-ai-provider/quickstart
npm install
npm run dev
```

See [`quickstart/README.md`](./quickstart/README.md) for full setup instructions.

The quickstart demonstrates:

- Real-time memory orchestration visualization
- Data flowing through all Cortex layers (Memory Space → User → Agent → Conversation → Vector → Facts → Graph)
- Multi-tenant memory space isolation
- Streaming with progressive fact extraction

## Quick Start

### Installation

```bash
npm install @cortexmemory/vercel-ai-provider @cortexmemory/sdk ai convex
```

### What's New in SDK v0.21.0

This provider now supports all SDK v0.21.0 capabilities:

- **agentId Required** (v0.17.0+) - All user-agent conversations now require an `agentId`
- **Automatic Graph Sync** (v0.19.0+) - Configure via `CORTEX_GRAPH_SYNC=true` env var
- **Automatic Fact Extraction** (v0.18.0+) - Configure via `CORTEX_FACT_EXTRACTION=true` env var
- **Enhanced Streaming** - Progressive storage, streaming hooks, and metrics
- **Parameter Standardization** (v0.21.0) - Unified `memorySpaceId` across all methods

### Setup

1. **Deploy Cortex Backend to Convex:**

```bash
npx create-cortex-memories
# Follow the wizard to set up Convex backend
```

2. **Create Memory-Enabled Chat:**

```typescript
// app/api/chat/route.ts
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123", // Get from session/auth in production
  userName: "User",

  // REQUIRED in SDK v0.17.0+
  agentId: "my-assistant",
  agentName: "My AI Assistant",

  // Optional: Enable graph memory (auto-configured via env vars)
  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",

  // Optional: Enable fact extraction (auto-configured via env vars)
  enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: cortexMemory(openai("gpt-4o-mini")),
    messages,
  });

  return result.toDataStreamResponse();
}
```

3. **Use in Your UI:**

```typescript
// app/page.tsx
'use client';
import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

That's it! Your AI now has **persistent memory** that works across sessions.

## ⚠️ Breaking Change: agentId Required

Since SDK v0.17.0, all user-agent conversations require an `agentId`. If you're upgrading from an earlier version:

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

## Enhanced Streaming Features

The provider includes powerful streaming enhancements powered by the `rememberStream()` API.

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
    progressiveFactExtraction: true,
    enableAdaptiveProcessing: true,
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
    },
    onProgress: (event) => {
      console.log(`Progress: ${event.bytesProcessed} bytes`);
    },
    onComplete: (event) => {
      console.log(`Completed in ${event.durationMs}ms`);
      console.log(`Facts extracted: ${event.factsExtracted}`);
    },
  },
});
```

### Layer Observation (for Visualization)

Observe memory orchestration for real-time UI visualization:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "demo-chat",
  userId: "user-123",
  agentId: "my-assistant",

  layerObserver: {
    onLayerUpdate: (event) => {
      // Update your UI with layer status
      console.log(`${event.layer}: ${event.status} (${event.latencyMs}ms)`);
    },
    onOrchestrationComplete: (summary) => {
      console.log(`Total orchestration: ${summary.totalLatencyMs}ms`);
    },
  },
});
```

## How It Works

### Automatic Memory Flow

Every time your AI generates a response:

1. **🔍 Search** - Cortex searches past conversations for relevant context
2. **💉 Inject** - Relevant memories are injected into the prompt
3. **🤖 Generate** - LLM generates response with full context
4. **💾 Store** - Conversation is automatically stored across multiple layers:
   - **Conversation** - ACID-safe message storage
   - **Vector** - Semantic embeddings for similarity search
   - **Facts** - Extracted structured information
   - **Graph** - Entity relationships (if configured)

```
User: "Hi, my name is Alice and I work at Acme Corp"
Agent: "Nice to meet you, Alice!"
                ↓
        [Cortex Memory Orchestration]
                ↓
    ┌──────────────────────────────┐
    │ Conversation: Messages saved │
    │ Vector: Embeddings stored    │
    │ Facts: Name=Alice, Job=Acme  │
    │ Graph: Alice→WORKS_AT→Acme   │
    └──────────────────────────────┘
                ↓
[Later: New session]
                ↓
User: "What's my name?"
                ↓
    [Cortex searches memories]
                ↓
    [Finds: "name is Alice"]
                ↓
Agent: "Your name is Alice!"
```

## Configuration

### Basic Configuration

```typescript
const cortexMemory = createCortexMemory({
  // Required
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant", // Required in v0.17.0+

  // Optional
  userName: "Alice",
  agentName: "My AI Assistant",
  conversationId: () => generateConversationId(),
});
```

### With Graph Memory

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "smart-agent",
  userId: "user-123",
  agentId: "my-assistant",

  // Enable graph memory (uses env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD)
  enableGraphMemory: true,

  // Or with explicit configuration
  graphConfig: {
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "your-password",
    type: "neo4j", // or "memgraph"
  },
});
```

### With Fact Extraction

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "smart-agent",
  userId: "user-123",
  agentId: "my-assistant",

  // Enable automatic fact extraction
  enableFactExtraction: true,

  // Or with custom configuration
  factExtractionConfig: {
    model: "gpt-4o-mini",
    provider: "openai",
  },
});
```

## API Reference

### createCortexMemory(config)

Creates a memory-augmented model factory.

**Parameters:**

| Parameter              | Type                   | Required | Description                             |
| ---------------------- | ---------------------- | -------- | --------------------------------------- |
| `convexUrl`            | string                 | ✅       | Convex deployment URL                   |
| `memorySpaceId`        | string                 | ✅       | Memory space for isolation              |
| `userId`               | string \| () => string | ✅       | User ID (static or function)            |
| `agentId`              | string                 | ✅       | Agent ID (required in v0.17.0+)         |
| `userName`             | string                 | ❌       | User name (default: 'User')             |
| `agentName`            | string                 | ❌       | Agent name (default: agentId)           |
| `enableGraphMemory`    | boolean                | ❌       | Sync to graph DB (default: false)       |
| `enableFactExtraction` | boolean                | ❌       | Enable fact extraction (default: false) |
| `graphConfig`          | object                 | ❌       | Graph database configuration            |
| `factExtractionConfig` | object                 | ❌       | Fact extraction configuration           |
| `streamingOptions`     | object                 | ❌       | Streaming enhancement options           |
| `streamingHooks`       | object                 | ❌       | Real-time streaming callbacks           |
| `layerObserver`        | object                 | ❌       | Layer orchestration observer            |
| `debug`                | boolean                | ❌       | Enable debug logging (default: false)   |

**Returns:** `CortexMemoryModel` - Function to wrap models + manual memory methods

### createCortexMemoryAsync(config)

Async version for automatic graph configuration from environment variables.

```typescript
// Reads graph config from NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
const cortexMemory = await createCortexMemoryAsync({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "smart-agent",
  userId: "user-123",
  agentId: "my-assistant",
});
```

### Manual Memory Control

```typescript
// Search memories manually
const memories = await cortexMemory.search("user preferences", {
  limit: 10,
  minScore: 0.8,
});

// Store memory manually
await cortexMemory.remember(
  "My favorite color is blue",
  "Noted, I will remember that!",
  { conversationId: "conv-123" },
);

// Get all memories
const all = await cortexMemory.getMemories({ limit: 100 });

// Clear memories (requires confirmation)
await cortexMemory.clearMemories({ confirm: true });

// Get current configuration
const config = cortexMemory.getConfig();
```

## Documentation

- [Quickstart Demo](./quickstart/README.md) - Interactive demo with visualization
- [Getting Started](../../Documentation/08-integrations/vercel-ai-sdk/getting-started.md) - Step-by-step tutorial
- [API Reference](../../Documentation/08-integrations/vercel-ai-sdk/api-reference.md) - Complete API documentation
- [Advanced Usage](../../Documentation/08-integrations/vercel-ai-sdk/advanced-usage.md) - Custom configurations
- [Memory Spaces](../../Documentation/08-integrations/vercel-ai-sdk/memory-spaces.md) - Multi-tenancy guide
- [Hive Mode](../../Documentation/08-integrations/vercel-ai-sdk/hive-mode.md) - Cross-application memory
- [Troubleshooting](../../Documentation/08-integrations/vercel-ai-sdk/troubleshooting.md) - Common issues

## FAQ

**Q: Does this work with other AI SDK providers (Anthropic, Google, etc.)?**
A: Yes! Wrap any Vercel AI SDK provider:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

const model1 = cortexMemory(anthropic("claude-3-opus"));
const model2 = cortexMemory(google("gemini-pro"));
```

**Q: Can I use this in Edge Functions?**
A: Yes! Cortex is fully edge-compatible:

```typescript
// app/api/chat/route.ts
export const runtime = "edge";

export async function POST(req: Request) {
  const result = await streamText({
    model: cortexMemory(openai("gpt-4o-mini")),
    messages,
  });

  return result.toDataStreamResponse();
}
```

**Q: Why do I need agentId now?**
A: Since SDK v0.17.0, Cortex properly tracks conversation participants. Every conversation needs both a user and an agent to enable features like agent-to-agent memory sharing and proper attribution.

## Troubleshooting

### "agentId is required"

Add `agentId` to your configuration:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123",
  agentId: "my-assistant", // Add this!
});
```

### "Failed to connect to Convex"

Make sure:

1. Convex is running: `npx convex dev`
2. `CONVEX_URL` is set correctly
3. Cortex backend is deployed to Convex

### "Memory search returns no results"

This is expected if:

- No prior conversations stored
- Using keyword search without embeddings (set up `embeddingProvider`)
- Running on local Convex (vector search not supported locally)

For more troubleshooting help, see [Troubleshooting Guide](../../Documentation/08-integrations/vercel-ai-sdk/troubleshooting.md).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

Apache 2.0 - See [LICENSE.md](./LICENSE.md)

## Links

- [GitHub](https://github.com/SaintNick1214/Project-Cortex)
- [Documentation](https://cortexmemory.dev/docs)
- [Cortex SDK](https://www.npmjs.com/package/@cortexmemory/sdk)
- [Quickstart Demo](./quickstart)

---

**Built with ❤️ by the Cortex team**
