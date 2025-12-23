# Orchestration Observer API

Real-time monitoring of the memory orchestration pipeline for building responsive UIs.

## Overview

When you call `remember()` or `rememberStream()`, the Cortex SDK orchestrates data across multiple layers: memory spaces, users, agents, conversations, vectors, facts, and optionally graph databases. The **OrchestrationObserver** API provides real-time callbacks at each step, enabling you to build progress indicators, debugging tools, and responsive user experiences.

## Quick Start

```typescript
import { Cortex, OrchestrationObserver } from "@cortexmemory/sdk";

const cortex = new Cortex({ convexUrl: "..." });

// Create an observer
const observer: OrchestrationObserver = {
  onOrchestrationStart: (id) => {
    console.log(`Starting orchestration: ${id}`);
  },
  onLayerUpdate: (event) => {
    console.log(`${event.layer}: ${event.status} (${event.latencyMs}ms)`);
  },
  onOrchestrationComplete: (summary) => {
    console.log(`Completed in ${summary.totalLatencyMs}ms`);
    console.log(`Created: ${summary.createdIds.memoryIds?.length} memories`);
  },
};

// Pass observer to remember()
const result = await cortex.memory.remember({
  memorySpaceId: "space-1",
  conversationId: "conv-1",
  userMessage: "I prefer dark mode",
  agentResponse: "I'll remember that preference!",
  userId: "user-1",
  agentId: "agent-1",
  observer, // <-- Real-time events
});
```

## Types

### MemoryLayer

The seven layers in the orchestration pipeline:

```typescript
type MemoryLayer =
  | "memorySpace"   // Ensures memory space exists
  | "user"          // Registers/validates user
  | "agent"         // Registers/validates agent  
  | "conversation"  // Stores conversation messages
  | "vector"        // Creates vector embeddings
  | "facts"         // Extracts and stores facts (with belief revision)
  | "graph";        // Syncs to graph database (if configured)
```

### LayerStatus

Status of each layer during orchestration:

```typescript
type LayerStatus =
  | "pending"      // Layer queued but not started
  | "in_progress"  // Layer actively processing
  | "complete"     // Layer finished successfully
  | "error"        // Layer failed
  | "skipped";     // Layer not applicable (e.g., no graph configured)
```

### LayerEvent

Emitted for each layer status change:

```typescript
interface LayerEvent {
  /** Which layer this event is for */
  layer: MemoryLayer;

  /** Current status of the layer */
  status: LayerStatus;

  /** Unix timestamp when this status was set */
  timestamp: number;

  /** Milliseconds elapsed since orchestration started */
  latencyMs?: number;

  /** Data about created entities (on complete) */
  data?: {
    id?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  };

  /** Error details (on error status) */
  error?: {
    message: string;
    code?: string;
  };

  /** For facts layer: what action was taken */
  revisionAction?: "CREATE" | "UPDATE" | "SUPERSEDE" | "NONE";

  /** For facts layer: IDs of facts that were superseded */
  supersededFacts?: string[];
}
```

### OrchestrationSummary

Final summary when all layers complete:

```typescript
interface OrchestrationSummary {
  /** Unique ID for this orchestration run */
  orchestrationId: string;

  /** Total time in milliseconds */
  totalLatencyMs: number;

  /** Final status of each layer */
  layers: Record<MemoryLayer, LayerEvent>;

  /** IDs of all created records */
  createdIds: {
    conversationId?: string;
    memoryIds?: string[];
    factIds?: string[];
  };
}
```

### OrchestrationObserver

The observer interface - all callbacks are optional:

```typescript
interface OrchestrationObserver {
  /** Called when orchestration starts */
  onOrchestrationStart?: (orchestrationId: string) => void | Promise<void>;

  /** Called when any layer's status changes */
  onLayerUpdate?: (event: LayerEvent) => void | Promise<void>;

  /** Called when orchestration completes (all layers done) */
  onOrchestrationComplete?: (summary: OrchestrationSummary) => void | Promise<void>;
}
```

## Event Flow

A typical `remember()` call emits events in this order:

```
onOrchestrationStart("orch-abc123")

onLayerUpdate({ layer: "memorySpace", status: "in_progress" })
onLayerUpdate({ layer: "memorySpace", status: "complete", latencyMs: 5 })

onLayerUpdate({ layer: "user", status: "in_progress" })
onLayerUpdate({ layer: "user", status: "complete", latencyMs: 12 })

onLayerUpdate({ layer: "agent", status: "in_progress" })
onLayerUpdate({ layer: "agent", status: "complete", latencyMs: 18 })

onLayerUpdate({ layer: "conversation", status: "in_progress" })
onLayerUpdate({ layer: "conversation", status: "complete", latencyMs: 45 })

onLayerUpdate({ layer: "vector", status: "in_progress" })
onLayerUpdate({ layer: "vector", status: "complete", latencyMs: 120 })

onLayerUpdate({ layer: "facts", status: "in_progress" })
onLayerUpdate({ 
  layer: "facts", 
  status: "complete", 
  latencyMs: 200,
  revisionAction: "SUPERSEDE",
  supersededFacts: ["fact-old-123"]
})

onLayerUpdate({ layer: "graph", status: "skipped" })  // No graph configured

onOrchestrationComplete({
  orchestrationId: "orch-abc123",
  totalLatencyMs: 201,
  layers: { /* all final layer events */ },
  createdIds: {
    conversationId: "conv-1",
    memoryIds: ["mem-1", "mem-2"],
    factIds: ["fact-new-456"]
  }
})
```

## Usage with rememberStream()

The observer works identically with streaming:

```typescript
const result = await cortex.memory.rememberStream(
  {
    memorySpaceId: "space-1",
    conversationId: "conv-1",
    userMessage: "Tell me about TypeScript",
    userId: "user-1",
    agentId: "agent-1",
    observer, // Same observer interface
  },
  {
    llmStream: myLLMStream,
    onChunk: (chunk) => console.log("Token:", chunk),
  }
);
```

## Building a Progress UI

### React Example

```typescript
import { useState, useCallback } from "react";
import type { LayerEvent, OrchestrationObserver } from "@cortexmemory/sdk";

function useOrchestrationProgress() {
  const [layers, setLayers] = useState<Record<string, LayerEvent>>({});
  const [isComplete, setIsComplete] = useState(false);

  const observer: OrchestrationObserver = {
    onLayerUpdate: useCallback((event: LayerEvent) => {
      setLayers((prev) => ({ ...prev, [event.layer]: event }));
    }, []),
    onOrchestrationComplete: useCallback(() => {
      setIsComplete(true);
    }, []),
  };

  return { layers, isComplete, observer };
}

// Usage in component
function MemoryProgress() {
  const { layers, isComplete, observer } = useOrchestrationProgress();

  const handleSend = async () => {
    await cortex.memory.remember({
      // ... params
      observer,
    });
  };

  return (
    <div>
      {Object.entries(layers).map(([layer, event]) => (
        <div key={layer}>
          {layer}: {event.status}
          {event.latencyMs && ` (${event.latencyMs}ms)`}
        </div>
      ))}
      {isComplete && <div>✓ Memory saved!</div>}
    </div>
  );
}
```

### Vercel AI SDK Integration

For Vercel AI SDK apps, bridge events to the client via data streams:

```typescript
// API Route
import { createDataStreamResponse, streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const observer: OrchestrationObserver = {
        onLayerUpdate: (event) => {
          dataStream.writeData({
            type: "layer-update",
            layer: event.layer,
            status: event.status,
            latencyMs: event.latencyMs,
          });
        },
        onOrchestrationComplete: (summary) => {
          dataStream.writeData({
            type: "orchestration-complete",
            totalLatencyMs: summary.totalLatencyMs,
          });
        },
      };

      // Your LLM streaming logic here
      const result = streamText({ model, messages });
      result.mergeIntoDataStream(dataStream);
    },
  });
}
```

```typescript
// Client Component
import { useChat } from "ai/react";

function Chat() {
  const { messages, data } = useChat();

  // Extract layer updates from data stream
  const layerUpdates = data?.filter((d) => d.type === "layer-update") ?? [];

  return (
    <div>
      <LayerProgress updates={layerUpdates} />
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
    </div>
  );
}
```

## Belief Revision Events

When the facts layer processes with belief revision enabled, you get additional information:

```typescript
const observer: OrchestrationObserver = {
  onLayerUpdate: (event) => {
    if (event.layer === "facts" && event.status === "complete") {
      switch (event.revisionAction) {
        case "CREATE":
          console.log("New fact created");
          break;
        case "UPDATE":
          console.log("Existing fact updated");
          break;
        case "SUPERSEDE":
          console.log(`Superseded: ${event.supersededFacts?.join(", ")}`);
          break;
        case "NONE":
          console.log("Duplicate fact skipped");
          break;
      }
    }
  },
};
```

## Error Handling

Errors in layer processing are captured in the event:

```typescript
const observer: OrchestrationObserver = {
  onLayerUpdate: (event) => {
    if (event.status === "error") {
      console.error(`${event.layer} failed: ${event.error?.message}`);
      // Show error UI, retry logic, etc.
    }
  },
};
```

Observer callback errors are caught internally and logged - they won't crash your application:

```typescript
// Safe - errors are caught
const observer: OrchestrationObserver = {
  onLayerUpdate: (event) => {
    throw new Error("Bug in my callback");
    // This won't crash - it's caught and logged
  },
};
```

## Best Practices

1. **Keep callbacks lightweight** - Heavy processing should be deferred
2. **Use async callbacks sparingly** - They're awaited, which adds latency
3. **Handle errors gracefully** - Check `event.status === "error"`
4. **Don't mutate events** - Treat them as read-only
5. **Use for observability, not control flow** - The pipeline runs regardless

## Integration Agnostic

The `OrchestrationObserver` API is designed to work with any integration:

- **Vercel AI SDK** - Via data streams (shown above)
- **LangChain** - Via custom callbacks
- **Direct SDK usage** - Via the observer parameter
- **Server-side logging** - Write to your observability stack
- **CLI tools** - Print progress to terminal

The SDK emits events; how you display or process them is up to you.
