# Getting Started with Cortex Memory for Vercel AI SDK

Complete guide to adding persistent memory to your Next.js application using Cortex Memory SDK v0.21.0+.

## Prerequisites

- Node.js 18+
- Next.js 14+ (App Router)
- Convex account (free tier available)
- OpenAI API key (or other LLM provider)

## Option 1: Run the Quickstart Demo (Recommended)

The fastest way to understand Cortex Memory is with our interactive quickstart demo:

```bash
cd packages/vercel-ai-provider/quickstart
npm install
```

Configure environment:

```bash
cp .env.local.example .env.local
# Edit .env.local with your Convex URL and OpenAI key
```

Start the demo:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and:

1. **Send a message** like "Hi, I'm Alex and I work at Acme Corp as an engineer"
2. **Watch the Layer Flow Diagram** show data flowing through all Cortex layers
3. **Ask a question** like "What do you remember about me?"
4. **Refresh the page** and see memory persists across sessions

## Option 2: Add to Existing Project

### Step 1: Install Dependencies

```bash
npm install @cortexmemory/vercel-ai-provider @cortexmemory/sdk ai convex
npm install @ai-sdk/openai  # or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

### Step 2: Set Up Convex Backend

```bash
npx create-cortex-memories
```

Follow the wizard to set up Convex with Cortex backend automatically.

### Step 3: Configure Environment Variables

Create `.env.local`:

```env
# Required
CONVEX_URL=https://your-deployment.convex.cloud
OPENAI_API_KEY=sk-your-key-here

# Optional: Memory Space
MEMORY_SPACE_ID=my-chatbot

# Optional: Enable fact extraction (SDK v0.18.0+)
CORTEX_FACT_EXTRACTION=true
CORTEX_FACT_EXTRACTION_MODEL=gpt-4o-mini

# Optional: Enable graph sync (SDK v0.19.0+)
# CORTEX_GRAPH_SYNC=true
# NEO4J_URI=bolt://localhost:7687
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=your-password
```

### Step 4: Create Memory-Enabled Chat API

```typescript
// app/api/chat/route.ts
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: process.env.MEMORY_SPACE_ID || "default-chat",

  // User identification
  userId: "demo-user", // Replace with real user ID
  userName: "User",

  // REQUIRED in SDK v0.17.0+
  agentId: "my-assistant",
  agentName: "My AI Assistant",

  // Optional: Enable enhanced features
  enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",
  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: cortexMemory(openai("gpt-4o-mini")),
    messages,
    system: `You are a helpful assistant with long-term memory.
You remember everything users tell you and can recall it naturally.`,
  });

  return result.toDataStreamResponse();
}
```

### Step 5: Create Chat UI

```typescript
// app/page.tsx
'use client';
import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl mb-4">Chat with Memory</h1>

      <div className="space-y-4 mb-4">
        {messages.map(m => (
          <div
            key={m.id}
            className={`p-3 rounded ${
              m.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong> {m.content}
          </div>
        ))}

        {isLoading && (
          <div className="p-3 rounded bg-gray-100 animate-pulse">
            Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          disabled={isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

### Step 6: Test Memory

1. Start your app:

```bash
npm run dev
```

2. Open http://localhost:3000

3. Test memory persistence:
   - Say: "Hi, my name is Alice and I work at Acme Corp"
   - Agent: "Nice to meet you, Alice! Acme Corp sounds great."
   - **Refresh the page**
   - Ask: "What do you know about me?"
   - Agent: "I remember you're Alice and you work at Acme Corp!" ✨

## Configuration Options

### Required Options

| Option          | Type   | Description                             |
| --------------- | ------ | --------------------------------------- |
| `convexUrl`     | string | Your Convex deployment URL              |
| `memorySpaceId` | string | Namespace for memory isolation          |
| `userId`        | string | User identifier                         |
| `agentId`       | string | Agent identifier (required in v0.17.0+) |

### Optional Options

| Option                 | Type    | Default | Description                |
| ---------------------- | ------- | ------- | -------------------------- |
| `userName`             | string  | "User"  | User display name          |
| `agentName`            | string  | agentId | Agent display name         |
| `enableFactExtraction` | boolean | false   | Enable LLM fact extraction |
| `enableGraphMemory`    | boolean | false   | Sync to graph database     |
| `memorySearchLimit`    | number  | 5       | Max memories to retrieve   |
| `minMemoryRelevance`   | number  | 0.7     | Min similarity score (0-1) |
| `debug`                | boolean | false   | Enable debug logging       |

## Dynamic User Resolution

For authentication systems:

```typescript
import { auth } from "@clerk/nextjs";

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cortexMemory = createCortexMemory({
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId: "app",
    userId,
    userName: "User",
    agentId: "app-assistant",
  });

  // ... use cortexMemory
}
```

## Multi-Tenant Setup

Different memory space per team/tenant:

```typescript
export async function POST(req: Request) {
  const { teamId, messages } = await req.json();

  const cortexMemory = createCortexMemory({
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId: `team-${teamId}`, // Isolated per team
    userId: currentUser.id,
    userName: currentUser.name,
    agentId: "team-assistant",
  });

  const result = await streamText({
    model: cortexMemory(openai("gpt-4o-mini")),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## Deploy to Vercel

```bash
vercel
```

Set environment variables in Vercel dashboard:

- `CONVEX_URL`
- `OPENAI_API_KEY`
- `MEMORY_SPACE_ID`
- `CORTEX_FACT_EXTRACTION` (optional)
- `CORTEX_GRAPH_SYNC` (optional)

## Troubleshooting

### "agentId is required"

Add `agentId` to your configuration (required in SDK v0.17.0+):

```typescript
const cortexMemory = createCortexMemory({
  // ... other config
  agentId: "my-assistant", // Add this!
});
```

### Memory not persisting

1. Check that Convex is running: `npx convex dev`
2. Verify `CONVEX_URL` is set correctly
3. Check browser console for errors

### Search returns no results

1. Make sure you've had at least one conversation first
2. If using semantic search, set up `embeddingProvider`
3. Check that `memorySpaceId` matches between requests

See [Troubleshooting Guide](./troubleshooting.md) for more solutions.

## Next Steps

- [Advanced Usage](./advanced-usage.md) - Graph memory, fact extraction, custom configurations
- [Memory Spaces](./memory-spaces.md) - Multi-tenancy guide
- [Hive Mode](./hive-mode.md) - Cross-application memory
- [API Reference](./api-reference.md) - Complete API documentation

## Support

- [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)
- [Cortex Documentation](/) - Main documentation
