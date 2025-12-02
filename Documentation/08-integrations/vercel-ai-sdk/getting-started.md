# Getting Started with Cortex Memory for Vercel AI SDK

Complete guide to adding persistent memory to your Next.js application.

## Prerequisites

- Node.js 18+
- Next.js 14+ (App Router)
- Convex account (free tier available)
- OpenAI API key (or other LLM provider)

## Step 1: Install Dependencies

```bash
npm install @cortexmemory/vercel-ai-provider @cortexmemory/sdk ai convex
npm install @ai-sdk/openai  # or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

## Step 2: Set Up Convex Backend

### Option A: Use create-cortex-memories (Recommended)

```bash
npx create-cortex-memories
```

Follow the wizard to set up Convex with Cortex backend automatically.

### Option B: Manual Setup

1. Install Convex globally:

```bash
npm install -g convex
```

2. Initialize Convex in your project:

```bash
npx convex dev
```

3. Copy Cortex schema to your `convex/` folder:

- From `node_modules/@cortexmemory/sdk/convex-dev/`
- To your project's `convex/` folder

4. Deploy:

```bash
npx convex deploy
```

## Step 3: Configure Environment Variables

Create `.env.local`:

```env
# Convex
CONVEX_URL=https://your-deployment.convex.cloud

# OpenAI
OPENAI_API_KEY=sk-your-key-here

# Optional: Memory Space
MEMORY_SPACE_ID=my-chatbot
```

## Step 4: Create Memory-Enabled Chat API

```typescript
// app/api/chat/route.ts
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: process.env.MEMORY_SPACE_ID || "default-chat",
  userId: "demo-user", // Replace with real user ID
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: cortexMemory(openai("gpt-5-nano")),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## Step 5: Create Chat UI

```typescript
// app/page.tsx
'use client';
import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl mb-4">Chat with Memory</h1>

      <div className="space-y-4 mb-4">
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-blue-600' : 'text-gray-800'}>
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Send
        </button>
      </form>
    </div>
  );
}
```

## Step 6: Test Memory

1. Start your app:

```bash
npm run dev
```

2. Open http://localhost:3000

3. Test memory persistence:
   - Say: "Hi, my name is Alice"
   - Agent: "Nice to meet you, Alice!"
   - **Refresh the page**
   - Ask: "What's my name?"
   - Agent: "Your name is Alice!" ✨

## Step 7: Deploy to Vercel

```bash
vercel
```

Set environment variables in Vercel:

- `CONVEX_URL`
- `OPENAI_API_KEY`
- `MEMORY_SPACE_ID`

## Next Steps

### Add Embeddings for Better Search

```typescript
import { embed } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",

  embeddingProvider: {
    generate: async (text) => {
      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: text,
      });
      return embedding;
    },
  },
});
```

### Add Fact Extraction

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",

  enableFactExtraction: true,
  extractFacts: async (userMsg, agentResp) => {
    // Use LLM to extract facts
    // Returns structured facts for efficient storage
  },
});
```

### Multi-Tenant Setup

```typescript
// Different memory space per team
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: `team-${currentTeam.id}`,
  userId: currentUser.id,
});
```

## Common Patterns

### Pattern 1: Authentication-Based User ID

```typescript
import { auth } from "@clerk/nextjs";

export async function POST(req: Request) {
  const { userId } = await auth();

  const cortexMemory = createCortexMemory({
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId: "app",
    userId: userId!,
  });

  // ... use cortexMemory
}
```

### Pattern 2: Session-Based Conversations

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "chat",
  userId: currentUser.id,
  conversationId: () => req.headers.get("x-session-id") || "default",
});
```

### Pattern 3: Disable Memory for Specific Routes

```typescript
// app/api/chat-no-memory/route.ts
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "temp",
  userId: "anonymous",
  enableMemorySearch: false,
  enableMemoryStorage: false,
});
```

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues.

## Next Steps

- [Advanced Usage](./advanced-usage.md) - Custom configurations and patterns
- [Memory Spaces](./memory-spaces.md) - Multi-tenancy guide
- [Hive Mode](./hive-mode.md) - Cross-application memory
- [API Reference](./api-reference.md) - Complete API documentation

## Support

- [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)
- [Cortex Documentation](/) - Main documentation
