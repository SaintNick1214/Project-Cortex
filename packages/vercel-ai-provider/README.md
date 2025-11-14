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
- 🧬 **Fact Extraction** - Optional LLM-powered fact extraction for 60-90% storage savings

## Quick Start

### Installation

```bash
npm install @cortexmemory/vercel-ai-provider @cortexmemory/sdk ai convex
```

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
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: cortexMemory(openai("gpt-4-turbo")),
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

## How It Works

### Automatic Memory Flow

Every time your AI generates a response:

1. **🔍 Search** - Cortex searches past conversations for relevant context
2. **💉 Inject** - Relevant memories are injected into the prompt
3. **🤖 Generate** - LLM generates response with full context
4. **💾 Store** - Conversation is automatically stored for future reference

```
User: "Hi, my name is Alice"
Agent: "Nice to meet you, Alice!"
                ↓
        [Stored in Cortex]
                ↓
[Refresh page / New session]
                ↓
User: "What's my name?"
                ↓
    [Cortex searches memories]
                ↓
    [Finds: "my name is Alice"]
                ↓
    [Injects context into prompt]
                ↓
Agent: "Your name is Alice!"
```

### What's Happening Behind the Scenes

```typescript
// When you call streamText with cortexMemory:
const result = await streamText({
  model: cortexMemory(openai("gpt-4")),
  messages: [{ role: "user", content: "What did I tell you earlier?" }],
});

// Cortex automatically:
// 1. Searches memories: "What did I tell you earlier?"
// 2. Finds relevant memories from past conversations
// 3. Injects them into the system prompt:
//    "Relevant context from past conversations:
//     1. User said their name is Alice
//     2. User prefers dark mode
//     ..."
// 4. Calls OpenAI with augmented prompt
// 5. Stores new conversation turn for future reference
```

## Configuration

### Basic Configuration

```typescript
const cortexMemory = createCortexMemory({
  // Required
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",

  // Optional
  userName: "Alice",
  conversationId: () => generateConversationId(),
});
```

### With Embeddings

```typescript
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",

  // Enable semantic search with embeddings
  embeddingProvider: {
    generate: async (text) => {
      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: text,
      });
      return embedding;
    },
  },

  // Fine-tune memory retrieval
  memorySearchLimit: 10,
  minMemoryRelevance: 0.75,
});
```

### With Fact Extraction

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "smart-agent",
  userId: "user-123",

  // Enable automatic fact extraction
  enableFactExtraction: true,
  extractFacts: async (userMsg, agentResp) => {
    // Use LLM to extract structured facts
    const facts = await extractFactsWithLLM(userMsg + " " + agentResp);
    return facts;
  },
});
```

### With Hive Mode (Cross-Application Memory)

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "shared-workspace", // Shared across apps
  userId: "user-123",

  hiveMode: {
    participantId: "web-assistant", // Track which agent/tool
  },
});

// Now this agent's memories are visible to other agents
// in the same memory space (e.g., Cursor MCP, Claude Desktop)
```

## API Reference

### createCortexMemory(config)

Creates a memory-augmented model factory.

**Parameters:**

| Parameter                  | Type                   | Required | Description                                      |
| -------------------------- | ---------------------- | -------- | ------------------------------------------------ |
| `convexUrl`                | string                 | ✅       | Convex deployment URL                            |
| `memorySpaceId`            | string                 | ✅       | Memory space for isolation                       |
| `userId`                   | string \| () => string | ✅       | User ID (static or function)                     |
| `userName`                 | string                 | ❌       | User name (default: 'User')                      |
| `conversationId`           | string \| () => string | ❌       | Conversation ID (auto-generated if not provided) |
| `embeddingProvider`        | object                 | ❌       | Custom embedding provider                        |
| `memorySearchLimit`        | number                 | ❌       | Max memories to retrieve (default: 5)            |
| `minMemoryRelevance`       | number                 | ❌       | Min score 0-1 (default: 0.7)                     |
| `contextInjectionStrategy` | 'system' \| 'user'     | ❌       | Where to inject context (default: 'system')      |
| `enableFactExtraction`     | boolean                | ❌       | Enable fact extraction (default: false)          |
| `enableGraphMemory`        | boolean                | ❌       | Sync to graph DB (default: false)                |
| `hiveMode`                 | object                 | ❌       | Enable cross-app memory                          |
| `defaultImportance`        | number                 | ❌       | Default importance 0-100 (default: 50)           |
| `debug`                    | boolean                | ❌       | Enable debug logging (default: false)            |

**Returns:** `CortexMemoryModel` - Function to wrap models + manual memory methods

### Model Wrapping

```typescript
const cortexMemory = createCortexMemory({
  /* config */
});

// Wrap any Vercel AI SDK provider
const model1 = cortexMemory(openai("gpt-4"));
const model2 = cortexMemory(anthropic("claude-3-opus"));
const model3 = cortexMemory(google("gemini-pro"));

// Use with streamText, generateText, generateObject, etc.
const result = await streamText({ model: model1, messages });
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

## Examples

### Basic Chat

See [`examples/next-chat`](./examples/next-chat) - Simple chat with memory (5 files, ~200 lines)

### RAG Pattern

See [`examples/next-rag`](./examples/next-rag) - Document search + conversation memory

### Multi-Modal

See [`examples/next-multimodal`](./examples/next-multimodal) - Images + text with memory

### Hive Mode

See [`examples/hive-mode`](./examples/hive-mode) - Cross-application memory sharing

### Multi-Tenant

See [`examples/memory-spaces`](./examples/memory-spaces) - SaaS with tenant isolation

## Comparison with mem0

| Feature               | Cortex                  | mem0                             |
| --------------------- | ----------------------- | -------------------------------- |
| **Hosting**           | ✅ Self-hosted (Convex) | ❌ Cloud only (API key required) |
| **TypeScript**        | ✅ Native               | ⚠️ Ported from Python            |
| **Edge Runtime**      | ✅ Full support         | ❌ Limited                       |
| **Memory Spaces**     | ✅ Built-in             | ❌ Not available                 |
| **ACID Guarantees**   | ✅ Full (Convex)        | ❌ Eventual consistency          |
| **Real-time Updates** | ✅ Reactive queries     | ❌ Polling/webhooks              |
| **Hive Mode**         | ✅ Cross-app sharing    | ❌ Not available                 |
| **Versioning**        | ✅ 10 versions auto     | ❌ No versioning                 |
| **Cost**              | 💰 Convex pricing       | 💰 mem0 API + LLM                |
| **Data Sovereignty**  | ✅ Your infrastructure  | ❌ mem0 cloud                    |

### Migration from mem0

**Before (mem0):**

```typescript
import { createMem0 } from "@mem0/vercel-ai-provider";

const mem0 = createMem0({
  provider: "openai",
  mem0ApiKey: process.env.MEM0_API_KEY!,
  config: { apiKey: process.env.OPENAI_API_KEY! },
  mem0Config: { user_id: "user-123" },
});

const result = await streamText({
  model: mem0("gpt-4"),
  messages,
});
```

**After (Cortex):**

```typescript
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!, // Self-hosted, no API key
  memorySpaceId: "my-chatbot",
  userId: "user-123",
});

const result = await streamText({
  model: cortexMemory(openai("gpt-4")),
  messages,
});
```

**Benefits of switching:**

- ✅ No mem0 API key needed (one less dependency)
- ✅ Self-hosted (full control over data)
- ✅ Memory Spaces (better isolation)
- ✅ Real-time updates (Convex reactive queries)
- ✅ ACID guarantees (no data loss)
- ✅ Versioning (track changes over time)

## Advanced Usage

### Custom Context Injection

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "custom-agent",
  userId: "user-123",

  // Custom context builder
  customContextBuilder: (memories) => {
    const important = memories.filter(
      (m) =>
        ("metadata" in m
          ? m.metadata?.importance
          : m.memory?.metadata?.importance) > 70,
    );
    return `Critical information:\n${important
      .map((m) => ("content" in m ? m.content : m.memory?.content))
      .join("\n")}`;
  },
});
```

### Dynamic User Resolution

```typescript
import { auth } from "@clerk/nextjs";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "saas-app",

  // Resolve from auth system
  userId: async () => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    return userId;
  },
});
```

### Per-Request Memory Spaces

```typescript
export async function POST(req: Request) {
  const { teamId } = await req.json();

  // Create memory provider per request
  const teamMemory = createCortexMemory({
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId: `team-${teamId}`, // Isolated per team
    userId: currentUser.id,
  });

  const result = await streamText({
    model: teamMemory(openai("gpt-4")),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## Documentation

- [Getting Started](../../Documentation/08-integrations/vercel-ai-sdk/getting-started.md) - Step-by-step tutorial
- [API Reference](../../Documentation/08-integrations/vercel-ai-sdk/api-reference.md) - Complete API documentation
- [Advanced Usage](../../Documentation/08-integrations/vercel-ai-sdk/advanced-usage.md) - Custom configurations
- [Memory Spaces](../../Documentation/08-integrations/vercel-ai-sdk/memory-spaces.md) - Multi-tenancy guide
- [Hive Mode](../../Documentation/08-integrations/vercel-ai-sdk/hive-mode.md) - Cross-application memory
- [Migration from mem0](../../Documentation/08-integrations/vercel-ai-sdk/migration-from-mem0.md) - Switching guide

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
    model: cortexMemory(openai("gpt-4")),
    messages,
  });

  return result.toDataStreamResponse();
}
```

**Q: Do I need to manually buffer streams?**
A: No! Cortex v0.9.0+ handles streaming automatically:

```typescript
// Cortex buffers the stream internally and stores after completion
const result = await streamText({
  model: cortexMemory(openai("gpt-4")),
  messages,
});

// No manual buffering needed
```

**Q: How much does it cost?**
A: Cortex uses Convex for storage:

- **Free tier**: 1GB storage, perfect for development
- **Pro**: $25/month for production apps
- **No per-request fees** - Unlike mem0, you only pay for storage

**Q: Can I disable automatic memory for specific requests?**
A: Yes! Configure per instance:

```typescript
const noMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "temp-space",
  userId: "user-123",
  enableMemorySearch: false,
  enableMemoryStorage: false,
});
```

**Q: How do I handle multiple users?**
A: Use dynamic user resolution:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "multi-user-chat",
  userId: () => req.user.id, // Resolved per request
});
```

**Q: Can I use this with LangChain?**
A: Not directly (LangChain has different interfaces), but Cortex SDK works standalone:

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });

// Search memories
const memories = await cortex.memory.search("user preferences");

// Store LangChain conversations
await cortex.memory.remember({
  memorySpaceId: "langchain-agent",
  conversationId: "conv-123",
  userMessage: input,
  agentResponse: output,
  userId: "user-123",
  userName: "User",
});
```

## Troubleshooting

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

### "Type errors with LanguageModelV1"

Make sure you're using compatible versions:
- `ai`: ^3.0.0
- `@cortexmemory/sdk`: ^0.9.0
- `@cortexmemory/vercel-ai-provider`: ^0.1.0

For more troubleshooting help, see [Troubleshooting Guide](../../Documentation/08-integrations/vercel-ai-sdk/troubleshooting.md).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

Apache 2.0 - See [LICENSE.md](./LICENSE.md)

## Complete Documentation

- [Cortex Documentation](../../Documentation/00-README.md) - Full Cortex documentation
- [Vercel AI SDK Integration](../../Documentation/08-integrations/vercel-ai-sdk/) - All integration docs

## Links

- [GitHub](https://github.com/SaintNick1214/Project-Cortex)
- [Documentation](https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation)
- [Cortex SDK](https://www.npmjs.com/package/@cortexmemory/sdk)
- [Examples](./examples)

---

**Built with ❤️ by the Cortex team**
