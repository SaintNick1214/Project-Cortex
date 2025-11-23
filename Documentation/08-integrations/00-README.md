# Integrations

Official integrations for Cortex Memory with popular AI frameworks and tools.

## Available Integrations

### Vercel AI SDK

**Status**: ✅ Complete (v0.1.0)  
**Package**: `@cortexmemory/vercel-ai-provider`  
**Documentation**: [Vercel AI SDK Integration](./vercel-ai-sdk/)

Add persistent memory to Next.js applications with Vercel AI SDK:

```typescript
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-chatbot",
  userId: "user-123",
});

const result = await streamText({
  model: cortexMemory(openai("gpt-4-turbo")),
  messages,
});
```

**Features:**

- ✅ Automatic memory retrieval and storage
- ✅ Edge runtime compatible
- ✅ Works with all AI SDK providers (OpenAI, Anthropic, Google, etc.)
- ✅ Memory Spaces for multi-tenancy
- ✅ Hive Mode for cross-application memory
- ✅ Streaming support

**Learn More:**

- [Getting Started](./vercel-ai-sdk/getting-started.md)
- [API Reference](./vercel-ai-sdk/api-reference.md)
- [Examples](../../packages/vercel-ai-provider/examples/)

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
- [Contribute](../../CONTRIBUTING.md)

---

## See Also

- [Main Documentation](../00-README.md)
- [Core Features](../02-core-features/)
- [API Reference](../03-api-reference/)
