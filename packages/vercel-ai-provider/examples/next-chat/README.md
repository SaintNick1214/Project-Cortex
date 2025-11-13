# Cortex Memory - Basic Chat Example

A simple Next.js chat application with persistent memory powered by Cortex and Vercel AI SDK.

## Features

- 💬 Real-time streaming chat interface
- 🧠 Automatic conversation memory storage
- 🔍 Semantic memory search before each response
- 🎯 Simple setup with zero configuration
- ⚡ Built with Next.js 15 App Router

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Convex

```bash
# Initialize Convex (if not already done)
npx convex dev

# Copy the deployment URL from Convex dashboard
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
CONVEX_URL=https://your-deployment.convex.cloud
OPENAI_API_KEY=sk-your-openai-key-here
MEMORY_SPACE_ID=basic-chat
```

### 4. Deploy Cortex Backend

Copy the Cortex schema to your Convex backend:

```bash
# Copy from @cortexmemory/sdk/convex-dev to your convex/ folder
# Or use create-cortex-memories to set up automatically
npx create-cortex-memories
```

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How It Works

### Memory Integration

The chat uses `@cortexmemory/vercel-ai-provider` to automatically:

1. **Search memories** before each response
2. **Inject context** into the prompt
3. **Store conversations** after each response

```typescript
// app/api/chat/route.ts
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: process.env.MEMORY_SPACE_ID!,
  userId: () => getUserId(request), // Dynamic user ID
});

// Automatic memory injection and storage
const result = await streamText({
  model: cortexMemory(openai("gpt-4-turbo")),
  messages,
});
```

### What Gets Stored

Every conversation turn stores:

- User message in ACID layer (immutable)
- Agent response in ACID layer (immutable)
- Both as vector memories (for semantic search)
- Conversation threading maintained

### What Gets Retrieved

Before each response:

- Searches past memories semantically
- Finds top 5 most relevant memories
- Injects context into system prompt
- LLM uses context to provide coherent responses

## Project Structure

```
next-chat/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts       # Chat API with memory
│   ├── page.tsx               # Main chat UI
│   └── layout.tsx             # Root layout
├── components/
│   └── Chat.tsx               # Chat component
├── lib/
│   └── cortex.ts              # Cortex configuration
├── .env.example               # Environment template
├── package.json
└── README.md
```

## Key Files

### `app/api/chat/route.ts`

Chat API endpoint with automatic memory:

```typescript
export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: cortexMemory(openai("gpt-4-turbo")),
    messages,
  });

  return result.toDataStreamResponse();
}
```

### `app/page.tsx`

Chat UI using Vercel AI SDK's `useChat` hook:

```typescript
'use client';
import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

## Try It Out

### Test Memory Persistence

1. Start a conversation: "Hi, my name is Alice"
2. Agent responds: "Nice to meet you, Alice!"
3. **Refresh the page** (new session)
4. Ask: "What's my name?"
5. Agent remembers: "Your name is Alice!"

### Check Stored Memories

```typescript
// In browser console or API route
const memories = await cortexMemory.search("name");
console.log(memories);
// Shows: [{ content: "Hi, my name is Alice", ... }]
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SaintNick1214/Project-Cortex/tree/main/packages/vercel-ai-provider/examples/next-chat)

1. Click "Deploy to Vercel"
2. Set environment variables:
   - `CONVEX_URL`
   - `OPENAI_API_KEY`
   - `MEMORY_SPACE_ID`
3. Deploy!

## Next Steps

- [Advanced Usage](../../docs/advanced-usage.md) - Custom embeddings, fact extraction
- [Memory Spaces](../../docs/memory-spaces.md) - Multi-tenant setups
- [Hive Mode](../../docs/hive-mode.md) - Cross-application memory

## License

Apache 2.0
