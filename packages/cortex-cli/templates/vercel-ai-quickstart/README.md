# Cortex Memory + Vercel AI SDK Quickstart

This is the official quickstart demo for **Cortex Memory** with the **Vercel AI SDK**. It provides an interactive visualization of how data flows through the Cortex memory orchestration system in real-time.

> **SDK v0.24.0**: Now with **Belief Revision**! When users change their preferences (e.g., "I now prefer purple" after saying "I like blue"), Cortex intelligently updates or supersedes existing facts instead of creating duplicates.

## Features

- 🧠 **Real-time Memory Visualization** - Watch data flow through all Cortex layers (Memory Space → User → Agent → Conversation → Vector → Facts → Graph)
- 💬 **Interactive Chat** - Send messages and see them processed with automatic memory storage
- 📊 **Layer Flow Diagram** - Animated visualization showing latency and data at each layer
- 🔀 **Memory Space Switching** - Demonstrate multi-tenant isolation by switching between memory spaces
- ⚡ **Streaming Support** - Full streaming with progressive fact extraction
- 🧹 **Belief Revision** - Intelligent fact updates when information changes (v0.24.0)
- 🔄 **Smart Fact Deduplication** - Semantic matching prevents duplicate facts across sessions (v0.22.0)

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
    "@cortexmemory/sdk": "^0.24.0",
    "@cortexmemory/vercel-ai-provider": "^1.0.0"
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

| Layer            | Description                                     |
| ---------------- | ----------------------------------------------- |
| **Memory Space** | Isolated namespace for multi-tenancy            |
| **User**         | User profile and identity                       |
| **Agent**        | AI agent participant (required in SDK v0.17.0+) |
| **Conversation** | Message storage with threading                  |
| **Vector**       | Semantic embeddings for similarity search       |
| **Facts**        | Extracted structured information                |
| **Graph**        | Entity relationships (optional)                 |

### Key Features Demonstrated

1. **Belief Revision** - SDK v0.24.0 intelligently updates/supersedes facts when information changes
2. **Unified Retrieval (recall)** - SDK v0.23.0 retrieves from vector + facts + graph in one call
3. **agentId Requirement** - SDK v0.17.0+ requires `agentId` for all user-agent conversations
4. **Automatic Fact Extraction** - LLM-powered extraction of preferences, identity, relationships
5. **Semantic Fact Deduplication** - SDK v0.22.0 automatically prevents duplicate facts using embedding similarity
6. **Multi-tenant Isolation** - Switch memory spaces to see complete isolation
7. **Streaming with Memory** - Full streaming support with progressive storage

## Configuration

The chat API route at `/app/api/chat/route.ts` shows how to configure the Cortex Memory provider:

```typescript
import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { streamText, embed } from "ai";

const openaiClient = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "quickstart-demo",

  // User identification
  userId: "demo-user",
  userName: "Demo User",

  // Agent identification (REQUIRED in SDK v0.17.0+)
  agentId: "quickstart-assistant",
  agentName: "Cortex Demo Assistant",

  // Optional features
  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",
  enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",

  // Belief Revision (v0.24.0+)
  // Automatically handles fact updates when user changes their mind
  // e.g., "I like blue" → "I prefer purple" will UPDATE/SUPERSEDE the old fact
  beliefRevision: {
    enabled: true,
    slotMatching: true, // Fast slot-based conflict detection
    llmResolution: true, // LLM-based resolution for nuanced conflicts
  },

  // Embedding provider (required for semantic matching)
  embeddingProvider: {
    generate: async (text) => {
      const result = await embed({
        model: openaiClient.embedding("text-embedding-3-small"),
        value: text,
      });
      return result.embedding;
    },
  },
});

const result = await streamText({
  model: cortexMemory(openai("gpt-4o-mini")),
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
  agentId: "my-assistant", // Required!
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

### Duplicate facts being created

Ensure you have `embeddingProvider` configured for optimal semantic deduplication:

```typescript
const cortexMemory = createCortexMemory({
  // ... other config
  embeddingProvider: {
    generate: async (text) => {
      const result = await embed({
        model: openaiClient.embedding("text-embedding-3-small"),
        value: text,
      });
      return result.embedding;
    },
  },
});
```

Without `embeddingProvider`, deduplication falls back to `structural` matching (subject + predicate + object), which is less accurate for semantically similar facts.

To disable deduplication entirely (not recommended):

```typescript
const cortexMemory = createCortexMemory({
  // ... other config
  factDeduplication: false, // Uses pre-v0.22.0 behavior
});
```

### Facts not being updated when user changes preferences

If you say "I like blue" then later say "I prefer purple" and both facts remain, enable **Belief Revision** (v0.24.0+):

```typescript
const cortexMemory = createCortexMemory({
  // ... other config
  beliefRevision: {
    enabled: true,
    slotMatching: true, // Fast detection via subject-predicate matching
    llmResolution: true, // LLM resolves nuanced conflicts
  },
});
```

**Revision actions explained:**

| Action      | Description                                        | Example                               |
| ----------- | -------------------------------------------------- | ------------------------------------- |
| `CREATE`    | New fact with no conflicts                         | First time mentioning favorite color  |
| `UPDATE`    | Existing fact refined with new details             | "I like blue" → "I love dark blue"    |
| `SUPERSEDE` | Old fact replaced by contradicting new information | "I like blue" → "I prefer purple now" |
| `NONE`      | Duplicate or irrelevant, no storage needed         | Saying "I like blue" twice            |

The demo visualization shows these actions with colored badges on the Facts layer.

## License

FSL-1.1-Apache-2.0 - See LICENSE.md in the root of the repository.
