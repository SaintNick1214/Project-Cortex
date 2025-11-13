# Streaming Support

> **Last Updated**: 2025-11-05
> **Version**: v0.9.0+

Native streaming support for LLM responses with automatic memory storage.

## Overview

Cortex v0.9.0 introduces first-class streaming support through `memory.rememberStream()`, enabling seamless integration with modern AI SDKs that deliver responses incrementally. This feature is essential for building real-time chat applications with memory.

### Key Features

- ✅ **Dual Stream Support** - ReadableStream (Web Streams API) and AsyncIterable (async generators)
- ✅ **Automatic Buffering** - No manual stream consumption required
- ✅ **Edge Runtime Compatible** - Works in Vercel Edge Functions, Cloudflare Workers
- ✅ **Full Feature Parity** - All `remember()` features supported (embeddings, facts, graph sync)
- ✅ **Type Safe** - Complete TypeScript support with proper type inference
- ✅ **Production Ready** - 28/28 tests passing on LOCAL and MANAGED Convex

## Why Streaming Matters

Modern LLMs deliver responses incrementally for better UX. Without native streaming support, you must manually buffer the stream before storing it:

### The Problem (Before v0.9.0)

```typescript
// ❌ Manual buffering required
let fullResponse = "";
const stream = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of stream) {
  fullResponse += chunk.choices[0]?.delta?.content || "";
  // Send to client UI...
}

// Now manually store (separate step)
await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "Hello!",
  agentResponse: fullResponse,
  userId: "user-1",
  userName: "User",
});
```

### The Solution (v0.9.0+)

```typescript
// ✅ Automatic buffering and storage
const result = await cortex.memory.rememberStream({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "Hello!",
  responseStream: stream,
  userId: "user-1",
  userName: "User",
});

console.log("Stored:", result.fullResponse);
// All layers updated automatically (conversations, vector, facts)
```

**Benefits:**

- Less code (no manual buffering loop)
- Better error handling (stream failures caught automatically)
- Type safety (proper TypeScript types)
- Works with any stream type (ReadableStream or AsyncIterable)

## Supported Stream Types

### 1. ReadableStream (Web Streams API)

Standard web streams - works in browsers, Node.js, and edge runtimes:

```typescript
// From Vercel AI SDK
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const response = await streamText({
  model: openai("gpt-4"),
  messages: [{ role: "user", content: "What is AI?" }],
});

// response.textStream is ReadableStream<string>
const result = await cortex.memory.rememberStream({
  memorySpaceId: "my-agent",
  conversationId: "conv-456",
  userMessage: "What is AI?",
  responseStream: response.textStream, // ReadableStream
  userId: "user-1",
  userName: "User",
});

console.log("Full response:", result.fullResponse);
```

### 2. AsyncIterable (Async Generators)

Standard JavaScript async iterables:

```typescript
// From OpenAI SDK
import OpenAI from "openai";

const openai = new OpenAI();
const stream = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

// OpenAI SDK returns AsyncIterable
const result = await cortex.memory.rememberStream({
  memorySpaceId: "my-agent",
  conversationId: "conv-789",
  userMessage: "Hello!",
  responseStream: stream, // AsyncIterable
  userId: "user-1",
  userName: "User",
});
```

### 3. Custom Async Generators

Create your own async generators:

```typescript
async function* generateResponse() {
  yield "Hello ";
  await new Promise((resolve) => setTimeout(resolve, 100));
  yield "from ";
  await new Promise((resolve) => setTimeout(resolve, 100));
  yield "custom generator!";
}

const result = await cortex.memory.rememberStream({
  memorySpaceId: "my-agent",
  conversationId: "conv-custom",
  userMessage: "Say hello",
  responseStream: generateResponse(),
  userId: "user-1",
  userName: "User",
});

console.log(result.fullResponse); // "Hello from custom generator!"
```

## Complete API Reference

### Method Signature

```typescript
async rememberStream(
  params: RememberStreamParams,
  options?: RememberOptions
): Promise<RememberStreamResult>
```

### RememberStreamParams

```typescript
interface RememberStreamParams {
  // Required parameters
  memorySpaceId: string;
  conversationId: string;
  userMessage: string;
  responseStream: ReadableStream<string> | AsyncIterable<string>;
  userId: string;
  userName: string;

  // Optional - Hive Mode
  participantId?: string;

  // Optional - Content processing
  extractContent?: (
    userMsg: string,
    agentResp: string,
  ) => Promise<string | null>;

  // Optional - Embeddings
  generateEmbedding?: (content: string) => Promise<number[] | null>;

  // Optional - Fact extraction
  extractFacts?: (
    userMsg: string,
    agentResp: string,
  ) => Promise<FactData[] | null>;

  // Optional - Cloud Mode
  autoEmbed?: boolean;
  autoSummarize?: boolean;

  // Optional - Metadata
  importance?: number;
  tags?: string[];
}
```

### RememberStreamResult

```typescript
interface RememberStreamResult {
  // Standard remember() result
  conversation: {
    messageIds: string[];
    conversationId: string;
  };
  memories: MemoryEntry[];
  facts: FactRecord[];

  // Streaming-specific
  fullResponse: string; // Complete text from stream
}
```

### RememberOptions

```typescript
interface RememberOptions {
  syncToGraph?: boolean; // Default: true if graph adapter configured
}
```

## Complete Examples

### Basic Chat with Vercel AI SDK

```typescript
import { Cortex } from "@cortexmemory/sdk";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

// Generate streaming response
const response = await streamText({
  model: openai("gpt-4"),
  messages: [{ role: "user", content: "What is the meaning of life?" }],
});

// Store with streaming
const result = await cortex.memory.rememberStream({
  memorySpaceId: "philosophy-bot",
  conversationId: "deep-questions-1",
  userMessage: "What is the meaning of life?",
  responseStream: response.textStream,
  userId: "user-42",
  userName: "Philosopher",
});

console.log("Stored response:", result.fullResponse);
console.log("Memories created:", result.memories.length);
```

### With Embeddings

```typescript
import { embed } from "@ai-sdk/openai";

const result = await cortex.memory.rememberStream({
  memorySpaceId: "smart-agent",
  conversationId: "conv-123",
  userMessage: "Capital of France?",
  responseStream: stream,
  userId: "user-1",
  userName: "User",
  generateEmbedding: async (text) => {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    });
    return embedding;
  },
});
```

### With Fact Extraction

```typescript
const result = await cortex.memory.rememberStream({
  memorySpaceId: "facts-bot",
  conversationId: "conv-456",
  userMessage: "My favorite color is blue and I love pizza",
  responseStream: stream,
  userId: "user-1",
  userName: "User",
  extractFacts: async (userMsg, agentResp) => {
    // Use LLM to extract facts
    const facts = await extractFactsWithLLM(userMsg + " " + agentResp);
    return facts.map((f) => ({
      fact: f.text,
      factType: f.type as "preference" | "identity" | "knowledge",
      confidence: f.confidence,
      subject: "user",
      predicate: f.predicate,
      object: f.object,
    }));
  },
});

console.log("Facts extracted:", result.facts);
// [
//   { fact: "User's favorite color is blue", factType: 'preference', ... },
//   { fact: "User loves pizza", factType: 'preference', ... }
// ]
```

### In Edge Functions

```typescript
// app/api/chat/route.ts
import { Cortex } from "@cortexmemory/sdk";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

// Enable Vercel Edge Runtime
export const runtime = "edge";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

export async function POST(req: Request) {
  const { message, userId } = await req.json();

  // Generate streaming response
  const response = await streamText({
    model: openai("gpt-4"),
    messages: [{ role: "user", content: message }],
  });

  // Store in background (don't await)
  cortex.memory
    .rememberStream({
      memorySpaceId: "edge-chat",
      conversationId: `conv-${userId}-${Date.now()}`,
      userMessage: message,
      responseStream: response.textStream,
      userId,
      userName: "User",
    })
    .catch((error) => {
      console.error("Memory storage failed:", error);
    });

  // Return streaming response to client
  return response.toAIStreamResponse();
}
```

### With Hive Mode

```typescript
const result = await cortex.memory.rememberStream({
  memorySpaceId: "team-workspace",
  conversationId: "multi-agent-conv",
  userMessage: "Analyze this data",
  responseStream: stream,
  userId: "user-1",
  userName: "DataScientist",
  participantId: "analyst-agent-a", // Track which agent responded
});

// Other agents in the same memory space can see this
const memories = await cortex.memory.search(
  "team-workspace",
  "data analysis",
  { participantId: "analyst-agent-a" }, // Filter by participant
);
```

### With Graph Sync

```typescript
import { CypherGraphAdapter } from "@cortexmemory/sdk/graph";
import neo4j from "neo4j-driver";

// Initialize with graph
const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "password"),
);

const graphAdapter = new CypherGraphAdapter(driver, {
  databaseType: "neo4j",
});

await graphAdapter.connect();

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    autoSync: true,
  },
});

// Streaming with graph sync
const result = await cortex.memory.rememberStream(
  {
    memorySpaceId: "knowledge-graph",
    conversationId: "conv-789",
    userMessage: "Alice works at Acme Corp",
    responseStream: stream,
    userId: "user-1",
    userName: "User",
  },
  {
    syncToGraph: true, // Automatically sync to Neo4j
  },
);

// Memory now exists in both Convex and Neo4j
```

## Error Handling

### Stream Errors

```typescript
try {
  const result = await cortex.memory.rememberStream({
    memorySpaceId: "agent-1",
    conversationId: "conv-123",
    userMessage: "Test",
    responseStream: potentiallyFailingStream,
    userId: "user-1",
    userName: "User",
  });
} catch (error) {
  if (error.message.includes("Failed to consume response stream")) {
    // Stream reading failed
    console.error("Stream error:", error);
    // Maybe retry with a new stream
  } else if (error.message.includes("produced no content")) {
    // Stream was empty
    console.error("Empty response");
    // Handle empty case
  }
}
```

### Storage Errors

```typescript
try {
  const result = await cortex.memory.rememberStream({
    memorySpaceId: "nonexistent-space",
    conversationId: "conv-123",
    userMessage: "Test",
    responseStream: stream,
    userId: "user-1",
    userName: "User",
  });
} catch (error) {
  if (error.message.includes("memory space")) {
    // Memory space doesn't exist
    console.error("Invalid memory space:", error);
    // Create the space first
  }
}
```

### Graceful Degradation

```typescript
async function rememberWithFallback(
  params: RememberStreamParams,
): Promise<string> {
  try {
    const result = await cortex.memory.rememberStream(params);
    return result.fullResponse;
  } catch (error) {
    console.warn("Streaming memory failed, falling back to manual:", error);

    // Fallback: manually consume stream
    let fullResponse = "";
    const stream = params.responseStream;

    if ("getReader" in stream) {
      // ReadableStream
      const reader = (stream as ReadableStream<string>).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += value;
      }
    } else {
      // AsyncIterable
      for await (const chunk of stream as AsyncIterable<string>) {
        fullResponse += chunk;
      }
    }

    // Store with regular remember()
    await cortex.memory.remember({
      memorySpaceId: params.memorySpaceId,
      conversationId: params.conversationId,
      userMessage: params.userMessage,
      agentResponse: fullResponse,
      userId: params.userId,
      userName: params.userName,
    });

    return fullResponse;
  }
}
```

## Performance

### Benchmarks

**Stream Consumption:**

- Small response (100 chars): < 1ms overhead
- Medium response (1K chars): < 5ms overhead
- Large response (10K chars): < 20ms overhead
- Very large (100K chars): < 200ms overhead

**Storage Performance:**

- Same as `remember()` - no additional overhead
- Storage happens after stream completes
- Non-blocking relative to client response

**Memory Usage:**

- Chunks buffered in array (minimal overhead)
- ~16 bytes per character in memory
- 10K character response ≈ 160KB RAM

### Best Practices for Performance

1. **Don't await if not needed:**

```typescript
// If you don't need the result immediately, don't await
cortex.memory.rememberStream({...}).catch(console.error);

// Continue with other work...
```

2. **Use appropriate memory space size:**

```typescript
// Create dedicated spaces for high-volume use cases
await cortex.memorySpaces.register({
  memorySpaceId: "high-volume-chat",
  name: "High Volume Chat",
  type: "project",
});
```

3. **Batch process if needed:**

```typescript
// For very high throughput, consider batching
const queue = [];
queue.push(cortex.memory.rememberStream({...}));

if (queue.length >= 10) {
  await Promise.all(queue);
  queue.length = 0;
}
```

## Migration Guide

### From Manual Buffering

**Before:**

```typescript
let fullResponse = "";
for await (const chunk of stream) {
  fullResponse += chunk;
}
await cortex.memory.remember({
  userMessage: "Hello",
  agentResponse: fullResponse,
  // ...
});
```

**After:**

```typescript
const result = await cortex.memory.rememberStream({
  userMessage: "Hello",
  responseStream: stream,
  // ...
});
```

### From Other Memory Solutions

If you're using mem0 or similar:

**mem0:**

```python
# mem0 (Python)
response = ""
for chunk in stream:
    response += chunk

mem0.add(messages=[
    {"role": "user", "content": user_msg},
    {"role": "assistant", "content": response}
], user_id=user_id)
```

**Cortex:**

```typescript
// Cortex (TypeScript)
const result = await cortex.memory.rememberStream({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: user_msg,
  responseStream: stream,
  userId: user_id,
  userName: "User",
});
```

**Benefits of Cortex:**

- ✅ Native TypeScript (no Python bridge)
- ✅ Self-hosted (no API key required)
- ✅ Edge runtime support
- ✅ Memory Spaces (better isolation)
- ✅ ACID guarantees
- ✅ Real-time updates (Convex reactive queries)

## Testing

### Unit Testing with Mock Streams

```typescript
import { describe, it, expect } from "@jest/globals";
import { Cortex } from "@cortexmemory/sdk";

describe("Streaming Memory", () => {
  it("should store streamed response", async () => {
    const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });

    // Create mock stream
    const mockStream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("Hello ");
        controller.enqueue("World");
        controller.close();
      },
    });

    const result = await cortex.memory.rememberStream({
      memorySpaceId: "test-space",
      conversationId: "test-conv",
      userMessage: "Say hello",
      responseStream: mockStream,
      userId: "test-user",
      userName: "TestUser",
    });

    expect(result.fullResponse).toBe("Hello World");
    expect(result.memories).toHaveLength(2);
  });
});
```

### Integration Testing

```typescript
it("should work with Vercel AI SDK", async () => {
  const response = await streamText({
    model: openai("gpt-4"),
    messages: [{ role: "user", content: "Test" }],
  });

  const result = await cortex.memory.rememberStream({
    memorySpaceId: "integration-test",
    conversationId: "test-" + Date.now(),
    userMessage: "Test",
    responseStream: response.textStream,
    userId: "test-user",
    userName: "TestUser",
  });

  expect(result.fullResponse.length).toBeGreaterThan(0);
  expect(result.memories.length).toBe(2);
});
```

## FAQ

**Q: Does this work in the browser?**
A: Yes! ReadableStream is a web standard. However, you'll typically use streaming on the server and send results to the browser via SSE or WebSockets.

**Q: Can I pass through the stream while storing?**
A: Not directly with `rememberStream()` (it consumes the stream). For passthrough, use the stream utilities directly:

```typescript
import { createPassthroughStream } from '@cortexmemory/sdk/memory/streamUtils';

const observer = createPassthroughStream(
  (chunk) => console.log('Chunk:', chunk),
  (fullText) => {
    // Store when complete
    cortex.memory.remember({...});
  }
);

const observedStream = originalStream.pipeThrough(observer);
// Now send observedStream to client
```

**Q: What about token streaming (for token counting)?**
A: `rememberStream()` works with text streams. For token-level control, use your LLM SDK's token counting features.

**Q: Does this work with LangChain?**
A: Yes! LangChain streaming returns AsyncIterables:

```typescript
const stream = await chain.stream({ input: "Hello" });

const result = await cortex.memory.rememberStream({
  memorySpaceId: "langchain-agent",
  conversationId: "conv-123",
  userMessage: "Hello",
  responseStream: stream, // AsyncIterable
  userId: "user-1",
  userName: "User",
});
```

**Q: Can I use this with SSE (Server-Sent Events)?**
A: Yes! Store the stream while sending to client:

```typescript
const response = await streamText({...});

// Store (don't await)
cortex.memory.rememberStream({
  responseStream: response.textStream,
  // ...
}).catch(console.error);

// Return SSE response
return new Response(response.textStream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  },
});
```

## See Also

- [Conversation History](./06-conversation-history.md) - Full conversation management
- [Hive Mode](./10-hive-mode.md) - Cross-application memory sharing
- [Memory Spaces](./01-memory-spaces.md) - Multi-tenancy and isolation
- [Fact Extraction](./08-fact-extraction.md) - Automatic fact extraction from conversations
