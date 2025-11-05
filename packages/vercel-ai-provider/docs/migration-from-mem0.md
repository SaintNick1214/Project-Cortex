# Migration from mem0 to Cortex

Guide for migrating from mem0's Vercel AI SDK integration to Cortex.

## Why Migrate?

| Feature | Cortex | mem0 |
|---------|--------|------|
| **Self-Hosted** | ✅ Convex (your infrastructure) | ❌ mem0 Cloud only |
| **TypeScript** | ✅ Native | ⚠️ Python-first |
| **Edge Runtime** | ✅ Full support | ❌ Limited |
| **Memory Spaces** | ✅ Multi-tenancy built-in | ❌ user_id only |
| **ACID** | ✅ Guaranteed | ❌ Eventual consistency |
| **Versioning** | ✅ 10 versions auto | ❌ No versioning |
| **Real-time** | ✅ Reactive | ❌ Polling |
| **Hive Mode** | ✅ Cross-app memory | ❌ Not available |
| **Cost** | 💰 Convex only | 💰 mem0 API + Convex |

## Code Comparison

### Before (mem0)

```typescript
import { createMem0 } from '@mem0/vercel-ai-provider';

const mem0 = createMem0({
  provider: 'openai',
  mem0ApiKey: process.env.MEM0_API_KEY!,
  config: { apiKey: process.env.OPENAI_API_KEY! },
  mem0Config: {
    user_id: 'user-123',
    agent_id: 'assistant',
  },
});

const result = await streamText({
  model: mem0('gpt-4'),
  messages,
});
```

### After (Cortex)

```typescript
import { createCortexMemory } from '@cortexmemory/vercel-ai-provider';
import { openai } from '@ai-sdk/openai';

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!, // No mem0 API key needed
  memorySpaceId: 'assistant',
  userId: 'user-123',
});

const result = await streamText({
  model: cortexMemory(openai('gpt-4')),
  messages,
});
```

## Step-by-Step Migration

### 1. Set Up Convex

```bash
npx convex dev
npx create-cortex-memories
```

### 2. Install Cortex Provider

```bash
npm uninstall @mem0/vercel-ai-provider
npm install @cortexmemory/vercel-ai-provider
```

### 3. Update Imports

```typescript
// Before
import { createMem0 } from '@mem0/vercel-ai-provider';

// After
import { createCortexMemory } from '@cortexmemory/vercel-ai-provider';
import { openai } from '@ai-sdk/openai';
```

### 4. Update Configuration

```typescript
// Before
const mem0 = createMem0({
  provider: 'openai',
  mem0ApiKey: process.env.MEM0_API_KEY!,
  config: { apiKey: process.env.OPENAI_API_KEY! },
  mem0Config: {
    user_id: 'user-123',
    agent_id: 'assistant',
    run_id: 'session-456',
  },
});

// After
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: 'assistant',
  userId: 'user-123',
  conversationId: 'session-456', // Optional
});
```

### 5. Update Model Usage

```typescript
// Before
const result = await streamText({
  model: mem0('gpt-4'),
  messages,
});

// After
const result = await streamText({
  model: cortexMemory(openai('gpt-4')),
  messages,
});
```

### 6. Update Environment Variables

```env
# Before
MEM0_API_KEY=sk-mem0-...
OPENAI_API_KEY=sk-openai-...

# After
CONVEX_URL=https://your-deployment.convex.cloud
OPENAI_API_KEY=sk-openai-...
```

## Feature Mapping

### Basic Memory Operations

| mem0 | Cortex |
|------|--------|
| `mem0('model')` | `cortexMemory(provider('model'))` |
| `mem0.retrieveMemories()` | `cortexMemory.search()` |
| `mem0.addMemories()` | `cortexMemory.remember()` |
| `mem0.getMemories()` | `cortexMemory.getMemories()` |

### Advanced Features

| mem0 Feature | Cortex Equivalent |
|--------------|-------------------|
| `user_id` | `userId` |
| `agent_id` | `memorySpaceId` |
| `run_id` | `conversationId` |
| Graph memory | `enableGraphMemory: true` |
| N/A | Memory Spaces (multi-tenancy) |
| N/A | Hive Mode (cross-app sharing) |
| N/A | ACID guarantees |
| N/A | Version history |

## Data Migration

### Exporting from mem0

```python
# Python script to export from mem0
import mem0

client = mem0.Client(api_key="...")
memories = client.get_all_memories(user_id="user-123")

import json
with open('memories.json', 'w') as f:
    json.dump(memories, f)
```

### Importing to Cortex

```typescript
import { Cortex } from '@cortexmemory/sdk';
import fs from 'fs';

const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
const mem0Data = JSON.parse(fs.readFileSync('memories.json', 'utf-8'));

for (const mem of mem0Data) {
  await cortex.memory.remember({
    memorySpaceId: 'migrated',
    conversationId: mem.run_id || 'imported',
    userMessage: mem.user_message || '',
    agentResponse: mem.agent_message || '',
    userId: mem.user_id,
    userName: 'Migrated User',
  });
}

console.log(`Migrated ${mem0Data.length} memories`);
```

## Benefits After Migration

1. **No API Key** - One less secret to manage
2. **Self-Hosted** - Full control over your data
3. **Lower Latency** - Convex is fast (~50-100ms vs 100-200ms)
4. **Cost Savings** - No per-request fees
5. **Better Isolation** - Memory Spaces for multi-tenancy
6. **Data Guarantees** - ACID transactions
7. **Real-time** - Reactive queries with Convex
8. **Future-Proof** - Not locked into a vendor

## Support

Questions? Open an issue or discussion on GitHub!

