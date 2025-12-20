# API Reference

Complete API documentation for @cortexmemory/vercel-ai-provider (SDK v0.21.0+)

## createCortexMemory(config)

Creates a memory-augmented model factory with manual memory control methods.

### Signature

```typescript
function createCortexMemory(config: CortexMemoryConfig): CortexMemoryModel;
```

### Parameters

#### CortexMemoryConfig

| Property                   | Type                                    | Required | Default        | Description                      |
| -------------------------- | --------------------------------------- | -------- | -------------- | -------------------------------- |
| `convexUrl`                | string                                  | ✅       | -              | Convex deployment URL            |
| `memorySpaceId`            | string                                  | ✅       | -              | Memory space for isolation       |
| `userId`                   | string \| () => string\|Promise<string> | ✅       | -              | User ID (static or function)     |
| `agentId`                  | string                                  | ✅       | -              | Agent ID (required v0.17.0+)     |
| `userName`                 | string                                  | ❌       | 'User'         | Display name for user            |
| `agentName`                | string                                  | ❌       | agentId        | Display name for agent           |
| `conversationId`           | string \| () => string                  | ❌       | auto-generated | Conversation ID                  |
| `embeddingProvider`        | object                                  | ❌       | undefined      | Custom embedding provider        |
| `memorySearchLimit`        | number                                  | ❌       | 5              | Max memories to retrieve         |
| `minMemoryRelevance`       | number                                  | ❌       | 0.7            | Min relevance score (0-1)        |
| `enableMemorySearch`       | boolean                                 | ❌       | true           | Auto-search before generation    |
| `enableMemoryStorage`      | boolean                                 | ❌       | true           | Auto-store after generation      |
| `contextInjectionStrategy` | 'system'\|'user'                        | ❌       | 'system'       | Where to inject context          |
| `customContextBuilder`     | function                                | ❌       | undefined      | Custom context formatter         |
| `enableFactExtraction`     | boolean                                 | ❌       | false          | Extract facts from conversations |
| `factExtractionConfig`     | object                                  | ❌       | undefined      | Fact extraction configuration    |
| `extractFacts`             | function                                | ❌       | undefined      | Custom fact extraction           |
| `enableGraphMemory`        | boolean                                 | ❌       | false          | Sync to graph database           |
| `graphConfig`              | object                                  | ❌       | undefined      | Graph database configuration     |
| `hiveMode`                 | object                                  | ❌       | undefined      | Cross-app memory config          |
| `defaultImportance`        | number                                  | ❌       | 50             | Default importance (0-100)       |
| `defaultTags`              | string[]                                | ❌       | []             | Default tags                     |
| `streamingOptions`         | object                                  | ❌       | undefined      | Streaming enhancement options    |
| `streamingHooks`           | object                                  | ❌       | undefined      | Real-time streaming callbacks    |
| `layerObserver`            | object                                  | ❌       | undefined      | Layer orchestration observer     |
| `debug`                    | boolean                                 | ❌       | false          | Enable debug logging             |
| `logger`                   | object                                  | ❌       | console        | Custom logger                    |

#### factExtractionConfig

```typescript
factExtractionConfig?: {
  model?: string;      // Override fact extraction model (default: gpt-4o-mini)
  provider?: 'openai' | 'anthropic';  // Provider to use
}
```

#### graphConfig

```typescript
graphConfig?: {
  uri?: string;        // Graph database URI
  username?: string;   // Graph database username
  password?: string;   // Graph database password
  type?: 'neo4j' | 'memgraph';  // Database type
}
```

#### streamingOptions

```typescript
streamingOptions?: {
  storePartialResponse?: boolean;      // Store during streaming
  partialResponseInterval?: number;    // Update interval (ms)
  progressiveFactExtraction?: boolean; // Extract facts incrementally
  factExtractionThreshold?: number;    // Characters per extraction
  progressiveGraphSync?: boolean;      // Sync graph incrementally
  graphSyncInterval?: number;          // Graph sync interval (ms)
  partialFailureHandling?: 'store-partial' | 'rollback' | 'retry' | 'best-effort';
  maxRetries?: number;                 // Max retry attempts
  generateResumeToken?: boolean;       // Generate resume tokens
  streamTimeout?: number;              // Timeout (ms)
  maxResponseLength?: number;          // Max response length
  enableAdaptiveProcessing?: boolean;  // Auto-optimize processing
}
```

#### streamingHooks

```typescript
streamingHooks?: {
  onChunk?: (event: ChunkEvent) => void | Promise<void>;
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  onError?: (event: ErrorEvent) => void | Promise<void>;
  onComplete?: (event: CompleteEvent) => void | Promise<void>;
}
```

#### layerObserver

```typescript
layerObserver?: {
  onLayerUpdate?: (event: LayerEvent) => void | Promise<void>;
  onOrchestrationStart?: (orchestrationId: string) => void | Promise<void>;
  onOrchestrationComplete?: (summary: OrchestrationSummary) => void | Promise<void>;
}
```

### Returns

#### CortexMemoryModel

A function that wraps language models + manual memory methods:

```typescript
interface CortexMemoryModel {
  // Model wrapping
  (model: LanguageModelV1): LanguageModelV1;

  // Manual memory methods
  search(query: string, options?: SearchOptions): Promise<MemoryEntry[]>;
  remember(
    userMsg: string,
    agentResp: string,
    options?: RememberOptions,
  ): Promise<void>;
  getMemories(options?: { limit?: number }): Promise<MemoryEntry[]>;
  clearMemories(options?: ClearOptions): Promise<number>;
  getConfig(): Readonly<CortexMemoryConfig>;
}
```

## createCortexMemoryAsync(config)

Async version for automatic graph database configuration from environment variables.

### Signature

```typescript
async function createCortexMemoryAsync(
  config: CortexMemoryConfig,
): Promise<CortexMemoryModel>;
```

### Example

```typescript
// Reads graph config from NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
const cortexMemory = await createCortexMemoryAsync({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "smart-agent",
  userId: "user-123",
  agentId: "my-assistant",
});
```

## Model Wrapping

### Syntax

```typescript
const wrappedModel = cortexMemory(underlyingModel);
```

### Examples

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "my-agent",
  userId: "user-123",
  agentId: "my-assistant", // Required!
});

// Wrap any AI SDK provider
const gpt4 = cortexMemory(openai("gpt-4o-mini"));
const claude = cortexMemory(anthropic("claude-3-opus"));
const gemini = cortexMemory(google("gemini-pro"));

// Use with AI SDK functions
await streamText({ model: gpt4, messages });
await generateText({ model: claude, messages });
await generateObject({ model: gemini, prompt, schema });
```

## Manual Memory Methods

### search(query, options?)

Search memories manually.

```typescript
async search(
  query: string,
  options?: {
    limit?: number;
    minScore?: number;
    tags?: string[];
    userId?: string;
    embedding?: number[];
    sourceType?: 'conversation' | 'system' | 'tool' | 'a2a';
    minImportance?: number;
  }
): Promise<MemoryEntry[]>
```

**Example:**

```typescript
const memories = await cortexMemory.search("user preferences", {
  limit: 10,
  minScore: 0.8,
  tags: ["important"],
});

console.log(memories);
// [{ content: '...', metadata: {...}, ... }]
```

### remember(userMessage, agentResponse, options?)

Store a conversation manually.

```typescript
async remember(
  userMessage: string,
  agentResponse: string,
  options?: {
    conversationId?: string;
    generateEmbedding?: (text: string) => Promise<number[]>;
    extractFacts?: (userMsg: string, agentResp: string) => Promise<Fact[]>;
    syncToGraph?: boolean;
  }
): Promise<void>
```

**Example:**

```typescript
await cortexMemory.remember(
  "My favorite color is blue",
  "I will remember that!",
  {
    conversationId: "conv-123",
    syncToGraph: true,
  },
);
```

### getMemories(options?)

Get all memories (paginated).

```typescript
async getMemories(
  options?: {
    limit?: number;
  }
): Promise<MemoryEntry[]>
```

**Example:**

```typescript
const all = await cortexMemory.getMemories({ limit: 100 });
console.log(`Total memories: ${all.length}`);
```

### clearMemories(options)

Clear memories (requires confirmation).

```typescript
async clearMemories(
  options: {
    confirm: boolean;
    userId?: string;
    sourceType?: 'conversation' | 'system' | 'tool' | 'a2a';
  }
): Promise<number>
```

**Example:**

```typescript
// Clear all memories
const deleted = await cortexMemory.clearMemories({ confirm: true });
console.log(`Deleted ${deleted} memories`);

// Clear specific user's memories
await cortexMemory.clearMemories({
  confirm: true,
  userId: "user-123",
});
```

### getConfig()

Get current configuration (read-only).

```typescript
getConfig(): Readonly<CortexMemoryConfig>
```

**Example:**

```typescript
const config = cortexMemory.getConfig();
console.log(`Memory Space: ${config.memorySpaceId}`);
console.log(`Agent: ${config.agentId}`);
```

## Types

### MemoryEntry

```typescript
interface MemoryEntry {
  memoryId: string;
  memorySpaceId: string;
  content: string;
  embedding?: number[];
  userId?: string;
  participantId?: string;
  sourceType: "conversation" | "system" | "tool" | "a2a";
  metadata: {
    importance: number; // 0-100
    tags: string[];
  };
  createdAt: number;
  updatedAt: number;
}
```

### LayerEvent

```typescript
interface LayerEvent {
  layer:
    | "memorySpace"
    | "user"
    | "agent"
    | "conversation"
    | "vector"
    | "facts"
    | "graph";
  status: "pending" | "in_progress" | "complete" | "error" | "skipped";
  timestamp: number;
  latencyMs?: number;
  data?: {
    id?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  };
  error?: {
    message: string;
    code?: string;
  };
}
```

### OrchestrationSummary

```typescript
interface OrchestrationSummary {
  orchestrationId: string;
  totalLatencyMs: number;
  layers: Record<MemoryLayer, LayerEvent>;
  createdIds: {
    conversationId?: string;
    memoryIds?: string[];
    factIds?: string[];
  };
}
```

## Exported Types

```typescript
export type {
  CortexMemoryConfig,
  CortexMemoryModel,
  ManualMemorySearchOptions,
  ManualRememberOptions,
  ManualClearOptions,
  ContextInjectionStrategy,
  SupportedProvider,
  LayerObserver,
  LayerEvent,
  LayerStatus,
  MemoryLayer,
  OrchestrationSummary,
} from "@cortexmemory/vercel-ai-provider";
```

## See Also

- [Getting Started](./getting-started.md) - Setup tutorial
- [Advanced Usage](./advanced-usage.md) - Custom patterns
- [Memory Spaces](./memory-spaces.md) - Multi-tenancy
- [Hive Mode](./hive-mode.md) - Cross-app memory
- [Troubleshooting](./troubleshooting.md) - Common issues
- [Memory Operations](../../03-api-reference/02-memory-operations.md) - Core SDK operations
