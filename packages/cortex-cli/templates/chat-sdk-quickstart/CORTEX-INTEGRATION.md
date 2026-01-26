# Cortex Memory Integration Guide

This document provides detailed information about how Cortex Memory is integrated into the Chat SDK template.

## Overview

Cortex Memory transforms a stateless AI chatbot into one with persistent, intelligent memory. Every conversation is automatically stored, indexed, and made retrievable for future interactions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Message                             │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cortex Memory Provider                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Memory Orchestration                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │  │ Memory   │ │  User    │ │  Agent   │ │ Convers- │       │ │
│  │  │ Space    │ │ Profile  │ │ Context  │ │ ation    │       │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │ │
│  │  │ Vector   │ │  Facts   │ │  Graph   │                    │ │
│  │  │ Search   │ │  Store   │ │  (opt)   │                    │ │
│  │  └──────────┘ └──────────┘ └──────────┘                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LLM (with context)                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Post-Processing Pipeline                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────────┐ │
│  │ Store Response  │ │ Extract Facts   │ │ Update Beliefs     │ │
│  └─────────────────┘ └─────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Chat API Route

The main integration happens in `app/(chat)/api/chat/route.ts`:

```typescript
import { createCortexMemoryAsync } from "@cortexmemory/vercel-ai-provider";
import type { LayerObserver } from "@cortexmemory/vercel-ai-provider";
import { getCortexMemoryConfig, getMemorySpaceId } from "@/lib/cortex-memory-config";

export async function POST(request: Request) {
  const session = await auth();
  
  // Layer observer for UI visualization
  const layerObserver: LayerObserver = {
    onOrchestrationStart: (orchestrationId) => {
      dataStream.write({
        type: "data-orchestration-start",
        data: { orchestrationId },
        transient: true,
      });
    },
    onLayerUpdate: (event) => {
      dataStream.write({
        type: "data-layer-update",
        data: event,
        transient: true,
      });
    },
    onOrchestrationComplete: (summary) => {
      dataStream.write({
        type: "data-orchestration-complete",
        data: summary,
        transient: true,
      });
    },
  };

  // Create Cortex configuration
  const cortexConfig = getCortexMemoryConfig(
    getMemorySpaceId(),
    session.user.id,
    chatId,
    layerObserver,
  );

  // Create memory wrapper
  const cortexMemory = await createCortexMemoryAsync(cortexConfig);

  // Use with streamText
  const result = streamText({
    model: cortexMemory(getLanguageModel(selectedModel)),
    messages: modelMessages,
    // ... other options
  });
}
```

### 2. Memory Configuration Factory

Centralized configuration in `lib/cortex-memory-config.ts`:

```typescript
import type { CortexMemoryConfig, LayerObserver } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

export function getCortexMemoryConfig(
  memorySpaceId: string,
  userId: string,
  conversationId: string,
  layerObserver?: LayerObserver,
): CortexMemoryConfig {
  return {
    // Core identifiers
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId,
    userId,
    userName: "User",
    agentId: "chat-sdk-assistant",
    agentName: "Chat SDK Assistant",
    conversationId,

    // Fact extraction
    enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",

    // Belief revision for intelligent updates
    beliefRevision: {
      enabled: true,
      slotMatching: true,  // Fast subject-predicate matching
      llmResolution: true, // LLM resolves nuanced conflicts
    },

    // Embedding provider for semantic search
    embeddingProvider: {
      generate: async (text: string) => {
        const result = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: text,
        });
        return result.embedding;
      },
    },

    // Streaming options
    streamingOptions: {
      storePartialResponse: true,
      progressiveFactExtraction: true,
    },

    // Memory search settings
    memorySearchLimit: 20,

    // Layer observation for UI
    layerObserver,

    // Debug in development
    debug: process.env.NODE_ENV === "development",
  };
}
```

### 3. Memory Visualization UI

The Memory Retrieval Panel in `components/memory-retrieval-panel.tsx` provides real-time feedback:

```typescript
import type { LayerState, MemoryLayer } from "@cortexmemory/vercel-ai-provider/react";

interface MemoryRetrievalPanelProps {
  layers: Record<MemoryLayer, LayerState>;
  isOrchestrating: boolean;
}

// Shows 7 memory layers with real-time status:
// - memorySpace: Multi-tenant isolation
// - user: User profile
// - agent: AI agent context
// - conversation: Message history
// - vector: Semantic search results
// - facts: Extracted knowledge
// - graph: Entity relationships (optional)
```

### 4. Auth Integration

Auth context flows from Auth.js to Cortex in `lib/auth-cortex.ts`:

```typescript
import { auth } from "@/app/(auth)/auth";

export async function getCortexAuthContext() {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  return {
    userId: session.user.id,
    userName: session.user.name ?? "User",
    email: session.user.email,
  };
}
```

## Memory Layers Explained

### Memory Space Layer

Provides complete isolation between tenants:

```typescript
// Different memory spaces are completely separate
const configTenantA = {
  memorySpaceId: "tenant-a",
  // ... Tenant A's memories never visible to Tenant B
};

const configTenantB = {
  memorySpaceId: "tenant-b",
  // ... Tenant B's memories isolated
};
```

### User Layer

Stores user profile and cross-conversation context:

```typescript
// User information persists across all their conversations
{
  userId: session.user.id,
  userName: session.user.name,
  // User facts like "prefers dark mode" available in all chats
}
```

### Agent Layer

Defines the AI agent's identity:

```typescript
{
  agentId: "chat-sdk-assistant",
  agentName: "Chat SDK Assistant",
  // Agent personality and capabilities stored here
}
```

### Conversation Layer

Manages current chat session:

```typescript
{
  conversationId: chatId, // UUID of current chat
  // Messages, context window, threading
}
```

### Vector Layer

Semantic similarity search across all memories:

```typescript
// When user asks about "travel preferences"
// Vector search finds related memories:
// - "User mentioned they prefer aisle seats"
// - "User traveled to Paris last summer"
// - "User likes budget-friendly options"
```

### Facts Layer

Structured knowledge extraction and retrieval:

```typescript
// Facts are subject-predicate-object triples
{
  subject: "user",
  predicate: "favorite_color",
  object: "blue",
  confidence: 0.95,
  source: "conversation-123",
}
```

### Graph Layer (Optional)

Entity relationships for complex reasoning:

```typescript
// When enabled with Neo4j/Memgraph:
// User → works_at → Company
// User → knows → Person
// Company → located_in → City
```

## Belief Revision System

Cortex intelligently handles conflicting information:

### How It Works

1. **New fact arrives**: User says "I prefer purple now"
2. **Slot matching**: Quick check for existing facts with same subject-predicate
3. **Conflict detection**: Found existing fact "user prefers blue"
4. **LLM resolution**: Determines appropriate action
5. **Action applied**: SUPERSEDE - old fact archived, new fact stored

### Revision Actions

| Action | When Used | Result |
|--------|-----------|--------|
| `CREATE` | No existing conflicts | New fact stored |
| `UPDATE` | Refinement of existing fact | Fact updated in place |
| `SUPERSEDE` | Contradicting information | Old fact archived, new stored |
| `NONE` | Duplicate or irrelevant | No changes made |

### Configuration

```typescript
beliefRevision: {
  enabled: true,        // Enable the system
  slotMatching: true,   // Fast first-pass detection
  llmResolution: true,  // LLM for nuanced conflicts
}
```

## Convex Schema

Cortex Memory tables are automatically created when you deploy. The app-specific tables are in `convex/schema.ts`:

```typescript
// App-specific tables only
// Cortex tables (conversations, memories, facts, etc.) are auto-managed

export default defineSchema({
  chatSessions: defineTable({
    sessionId: v.string(),
    title: v.optional(v.string()),
    userId: v.string(),
    memorySpaceId: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  
  chatVotes: defineTable({
    sessionId: v.string(),
    messageId: v.string(),
    userId: v.string(),
    isUpvoted: v.boolean(),
    createdAt: v.number(),
  }),
  
  // ... other app tables
});
```

## Debugging

### Enable Debug Mode

```typescript
// In cortex-memory-config.ts
debug: true, // or process.env.NODE_ENV === "development"
```

### Debug Output

When enabled, you'll see in the console:
- Layer orchestration timing
- Memory retrieval results
- Fact extraction output
- Belief revision decisions

### Layer Observer Events

```typescript
// Log all layer events
const layerObserver: LayerObserver = {
  onOrchestrationStart: (id) => console.log("Start:", id),
  onLayerUpdate: (event) => console.log("Layer:", event.layer, event.status),
  onOrchestrationComplete: (summary) => console.log("Complete:", summary),
};
```

## Performance Considerations

### Embedding Costs

Every unique text chunk requires an embedding. Optimize by:
- Setting appropriate `memorySearchLimit`
- Using efficient embedding models (`text-embedding-3-small`)
- Enabling caching in production

### Fact Extraction

LLM-powered extraction has latency. Optimize by:
- Using `gpt-4o-mini` for extraction (faster)
- Enabling `progressiveFactExtraction` for streaming
- Disabling for simple use cases if not needed

### Memory Search

Vector search scales with data. Optimize by:
- Setting reasonable `memorySearchLimit` (default: 20)
- Using memory space isolation for multi-tenant
- Archiving old conversations periodically

## Common Patterns

### Multi-Tenant SaaS

```typescript
// Each organization gets isolated memory
const cortexConfig = getCortexMemoryConfig(
  `org-${organization.id}`, // Memory space per org
  session.user.id,
  chatId,
);
```

### Personal Assistant

```typescript
// Single user, all conversations share context
const cortexConfig = getCortexMemoryConfig(
  `user-${session.user.id}`, // User-specific memory space
  session.user.id,
  chatId,
);
```

### Customer Support Bot

```typescript
// Shared knowledge base + per-customer context
const cortexConfig = getCortexMemoryConfig(
  `support-${customer.id}`, // Customer-specific
  "support-agent", // Shared agent
  ticketId,
);
```

## Troubleshooting

### "agentId is required"

Since SDK v0.17.0, all configurations require an agentId:

```typescript
{
  agentId: "your-agent-id", // Required!
  agentName: "Your Agent Name",
}
```

### Memories Not Appearing

1. Check `CONVEX_URL` is set correctly
2. Verify Convex deployment is running
3. Ensure memory space ID matches between frontend/backend
4. Check browser console for errors

### Duplicate Facts

Enable semantic deduplication with embedding provider:

```typescript
{
  embeddingProvider: {
    generate: async (text) => {
      // ... embedding generation
    },
  },
}
```

### Slow Response Times

1. Check network latency to Convex
2. Reduce `memorySearchLimit`
3. Use faster embedding model
4. Consider disabling fact extraction for simple queries

## Resources

- [Cortex Memory Documentation](https://cortexmemory.dev/docs)
- [Vercel AI Provider API Reference](https://cortexmemory.dev/docs/integrations/vercel-ai-sdk)
- [Convex Documentation](https://docs.convex.dev)
- [Example Implementations](https://github.com/cortexmemory/examples)
