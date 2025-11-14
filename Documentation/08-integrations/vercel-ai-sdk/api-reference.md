# API Reference

Complete API documentation for @cortexmemory/vercel-ai-provider

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
| `userName`                 | string                                  | ❌       | 'User'         | Display name for user            |
| `conversationId`           | string \| () => string                  | ❌       | auto-generated | Conversation ID                  |
| `embeddingProvider`        | object                                  | ❌       | undefined      | Custom embedding provider        |
| `memorySearchLimit`        | number                                  | ❌       | 5              | Max memories to retrieve         |
| `minMemoryRelevance`       | number                                  | ❌       | 0.7            | Min relevance score (0-1)        |
| `enableMemorySearch`       | boolean                                 | ❌       | true           | Auto-search before generation    |
| `enableMemoryStorage`      | boolean                                 | ❌       | true           | Auto-store after generation      |
| `contextInjectionStrategy` | 'system'\|'user'                        | ❌       | 'system'       | Where to inject context          |
| `customContextBuilder`     | function                                | ❌       | undefined      | Custom context formatter         |
| `enableFactExtraction`     | boolean                                 | ❌       | false          | Extract facts from conversations |
| `extractFacts`             | function                                | ❌       | undefined      | Custom fact extraction           |
| `enableGraphMemory`        | boolean                                 | ❌       | false          | Sync to graph database           |
| `hiveMode`                 | object                                  | ❌       | undefined      | Cross-app memory config          |
| `defaultImportance`        | number                                  | ❌       | 50             | Default importance (0-100)       |
| `defaultTags`              | string[]                                | ❌       | []             | Default tags                     |
| `debug`                    | boolean                                 | ❌       | false          | Enable debug logging             |
| `logger`                   | object                                  | ❌       | console        | Custom logger                    |

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
  /* config */
});

// Wrap any AI SDK provider
const gpt4 = cortexMemory(openai("gpt-4"));
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
    generateEmbedding: async (text) => await embed(text),
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
console.log(`User: ${config.userId}`);
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

## See Also

- [Getting Started](./getting-started.md) - Setup tutorial
- [Advanced Usage](./advanced-usage.md) - Custom patterns
- [Memory Spaces](./memory-spaces.md) - Multi-tenancy
- [Hive Mode](./hive-mode.md) - Cross-app memory
- [Migration from mem0](./migration-from-mem0.md) - Switch guide
- [Cortex Core Documentation](../../00-README.md) - Main docs
