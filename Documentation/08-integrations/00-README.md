# Integrations

Official integrations for Cortex Memory with popular AI frameworks and tools.

## Available Integrations

### Vercel AI SDK

**Status**: ✅ Complete (v0.2.0)  
**Package**: `@cortexmemory/vercel-ai-provider`  
**Documentation**: See [Getting Started](./vercel-ai-sdk/getting-started.md) guide

Add persistent memory to Next.js applications with Vercel AI SDK:

```typescript
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123",

  // NEW in v0.2.0: Enhanced streaming options
  streamingOptions: {
    storePartialResponse: true,
    progressiveFactExtraction: true,
  },

  streamingHooks: {
    onProgress: (event) => console.log("Stream progress:", event),
  },
});

const result = await streamText({
  model: cortexMemory(openai("gpt-5-nano")),
  messages,
});
```

**Features:**

- ✅ Automatic memory retrieval and storage
- ✅ Edge runtime compatible
- ✅ Works with all AI SDK providers (OpenAI, Anthropic, Google, etc.)
- ✅ Memory Spaces for multi-tenancy
- ✅ Hive Mode for cross-application memory
- ✅ **Enhanced streaming support** with real-time hooks and metrics
- ✅ **Progressive storage** during streaming for resumability
- ✅ **Streaming metrics** with automatic performance analysis
- ✅ **Error recovery** with partial failure handling

**Learn More:**

- [Getting Started](./vercel-ai-sdk/getting-started.md)
- [API Reference](./vercel-ai-sdk/api-reference.md)
- [Examples](https://github.com/SaintNick1214/Project-Cortex/tree/main/packages/vercel-ai-provider/examples)

---

## Planned Integrations

### LangChain.js (Planned)

**Status**: 🔄 Planned  
**Target**: Q1 2026

TypeScript/JavaScript LangChain integration for memory management.

### LlamaIndex.TS (Planned)

**Status**: 🔄 Planned  
**Target**: Q1 2026

LlamaIndex TypeScript integration for RAG with memory.

### MCP Servers (Planned)

**Status**: 🔄 Planned  
**Target**: Q4 2025

Model Context Protocol servers for cross-application memory sharing.

---

## Integration Requests

Want an integration with your favorite framework?

- [Open an issue](https://github.com/SaintNick1214/Project-Cortex/issues/new)
- [Start a discussion](https://github.com/SaintNick1214/Project-Cortex/discussions)
- [Contribute](/project/contributing)

---

## See Also

- [Memory Spaces](../02-core-features/01-memory-spaces.md)
- [API Reference](../03-api-reference/01-overview.md)
