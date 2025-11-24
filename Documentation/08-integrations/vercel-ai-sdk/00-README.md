# Vercel AI SDK Integration

> **Package**: `@cortexmemory/vercel-ai-provider`  
> **Version**: 0.1.0  
> **Status**: Production Ready ✅

Complete integration with Vercel AI SDK for Next.js applications.

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
- ⚡ **Streaming Support** - Native streaming with Cortex SDK v0.9.0+

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
});

const result = await streamText({
  model: cortexMemory(openai("gpt-5-nano")),
  messages: [{ role: "user", content: "What did I tell you earlier?" }],
});
```

**That's it!** Memory is automatically searched and stored.

## What Gets Built

This integration provides:

1. **Memory-Augmented Models** - Wrap any AI SDK provider with memory
2. **Automatic Context Injection** - Relevant memories added to prompts
3. **Automatic Storage** - Conversations stored after responses
4. **Manual Control** - Search, remember, clear methods available
5. **Edge Runtime Support** - Works in serverless/edge environments

## Examples

See [examples directory](../../../packages/vercel-ai-provider/examples/) for:

- **next-chat** - Basic chat with persistent memory
- **next-rag** - RAG pattern combining documents + conversation memory
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
