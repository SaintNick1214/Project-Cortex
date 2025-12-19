# Cortex Memory + Vercel AI SDK Quickstart

This is the official quickstart demo for **Cortex Memory** with the **Vercel AI SDK**. It provides an interactive visualization of how data flows through the Cortex memory orchestration system in real-time.

## Features

- 🧠 **Real-time Memory Visualization** - Watch data flow through all Cortex layers (Memory Space → User → Agent → Conversation → Vector → Facts → Graph)
- 💬 **Interactive Chat** - Send messages and see them processed with automatic memory storage
- 📊 **Layer Flow Diagram** - Animated visualization showing latency and data at each layer
- 🔀 **Memory Space Switching** - Demonstrate multi-tenant isolation by switching between memory spaces
- ⚡ **Streaming Support** - Full streaming with progressive fact extraction

## Prerequisites

- Node.js 18+
- A Convex deployment ([get started](https://www.convex.dev/))
- An OpenAI API key ([get one](https://platform.openai.com/api-keys))

## Quick Start

### Local Development (within monorepo)

1. **Install dependencies**

```bash
cd packages/vercel-ai-provider/quickstart
npm install
```

> **Note**: The `package.json` uses `file:` references to link to the local SDK and provider packages. This allows you to test changes to the provider immediately.

### Using Published Packages

If you want to use the published npm packages instead, update `package.json`:

```json
{
  "dependencies": {
    "@cortexmemory/sdk": "^0.21.0",
    "@cortexmemory/vercel-ai-provider": "^1.0.0",
    // ... other deps
  }
}
```

2. **Set up environment variables**

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your credentials:

```env
CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
OPENAI_API_KEY=sk-...
```

3. **Deploy Convex schema**

```bash
npm run convex:dev
```

4. **Start the development server**

```bash
npm run dev
```

5. **Open the demo**

Visit [http://localhost:3000](http://localhost:3000) to see the demo in action.

## What This Demo Shows

### Memory Layer Orchestration

When you send a message, you'll see it flow through these layers:

| Layer | Description |
|-------|-------------|
| **Memory Space** | Isolated namespace for multi-tenancy |
| **User** | User profile and identity |
| **Agent** | AI agent participant (required in SDK v0.17.0+) |
| **Conversation** | Message storage with threading |
| **Vector** | Semantic embeddings for similarity search |
| **Facts** | Extracted structured information |
| **Graph** | Entity relationships (optional) |

### Key Features Demonstrated

1. **agentId Requirement** - SDK v0.17.0+ requires `agentId` for all user-agent conversations
2. **Automatic Fact Extraction** - LLM-powered extraction of preferences, identity, relationships
3. **Multi-tenant Isolation** - Switch memory spaces to see complete isolation
4. **Streaming with Memory** - Full streaming support with progressive storage

## Configuration

The chat API route at `/app/api/chat/route.ts` shows how to configure the Cortex Memory provider:

```typescript
import { createCortexMemory } from '@cortexmemory/vercel-ai-provider';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: 'quickstart-demo',
  
  // User identification
  userId: 'demo-user',
  userName: 'Demo User',
  
  // Agent identification (REQUIRED in SDK v0.17.0+)
  agentId: 'quickstart-assistant',
  agentName: 'Cortex Demo Assistant',
  
  // Optional features
  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === 'true',
  enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === 'true',
});

const result = await streamText({
  model: cortexMemory(openai('gpt-4o-mini')),
  messages,
});
```

## Architecture

```
quickstart/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Main chat endpoint with Cortex
│   │   ├── memories/route.ts  # Memory inspection endpoint
│   │   └── facts/route.ts     # Facts inspection endpoint
│   ├── layout.tsx
│   ├── page.tsx               # Main demo page
│   └── globals.css
├── components/
│   ├── ChatInterface.tsx      # Chat UI component
│   ├── LayerFlowDiagram.tsx   # Hero visualization component
│   ├── LayerCard.tsx          # Individual layer status card
│   ├── DataPreview.tsx        # Expandable data viewer
│   └── MemorySpaceSwitcher.tsx
├── lib/
│   ├── layer-tracking.ts      # Layer status management
│   └── animations.ts          # Framer Motion variants
└── convex/
    ├── schema.ts              # Convex schema
    ├── conversations.ts       # Conversation queries
    ├── memories.ts            # Memory queries
    ├── facts.ts               # Facts queries
    └── users.ts               # User queries
```

## Learn More

- [Cortex Memory Documentation](https://cortexmemory.dev/docs)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [API Reference](/Documentation/03-api-reference/02-memory-operations.md)

## Troubleshooting

### "agentId is required"

Since SDK v0.17.0, all user-agent conversations require an `agentId`. Add it to your configuration:

```typescript
const cortexMemory = createCortexMemory({
  // ... other config
  agentId: 'my-assistant', // Required!
});
```

### Memories not appearing

1. Check that your Convex deployment is running
2. Verify `CONVEX_URL` is set correctly
3. Ensure the memory space ID matches between frontend and backend

### Fact extraction not working

Enable fact extraction via environment variable:

```env
CORTEX_FACT_EXTRACTION=true
```

## License

Apache 2.0 - See LICENSE in the root of the repository.
