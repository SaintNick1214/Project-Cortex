# Configuration

> **Last Updated**: 2025-11-02

## Overview

Cortex is designed to work with minimal configuration, but offers extensive customization options when needed.

---

## Basic Configuration

### Minimal Setup

The absolute minimum to use Cortex:

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});
```

That's it! You're ready to store and search memories.

### Environment Variables

Configuration is managed through environment variables in `.env.local`:

```env
# Required
CONVEX_URL=http://127.0.0.1:3210

# Optional
CONVEX_DEPLOY_KEY=your-deploy-key-here
OPENAI_API_KEY=sk-your-key-here
```

---

## Convex Configuration

### Local Development

```env
# .env.local
CONVEX_URL=http://127.0.0.1:3210
```

```typescript
const cortex = new Cortex({
  convexUrl: "http://127.0.0.1:3210",
});
```

**Use for:**

- Rapid development
- Testing
- Learning
- No internet needed

**Limitations:**

- No vector search (`.similar()` not available)
- Data stored locally in `~/.convex/`
- Not for production

### Cloud Development

```env
# .env.local
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=dev:your-deployment|your-key
```

```typescript
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});
```

**Use for:**

- Production deployments
- Vector search features
- Team collaboration
- Scaling

---

## Graph Database Configuration

### Without Graph Database (Default)

No additional configuration needed. Cortex works great without a graph database.

### With Graph Database

Enable advanced relationship queries by adding a graph database:

```typescript
import { Cortex } from "@cortexmemory/sdk";
import {
  CypherGraphAdapter,
  initializeGraphSchema,
} from "@cortexmemory/sdk/graph";

// 1. Setup graph adapter
const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "password",
});

// 2. Initialize schema
await initializeGraphSchema(graphAdapter);

// 3. Initialize Cortex with graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    orphanCleanup: true, // Automatic cleanup
  },
});
```

**Environment variables:**

```env
# .env.local
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
```

**See:** [Graph Database Setup Guide](../07-advanced-topics/05-graph-database-setup.md)

---

## Full Configuration Options

### CortexConfig Interface

```typescript
interface CortexConfig {
  /** Convex deployment URL (required) */
  convexUrl: string;

  /** Optional graph database integration */
  graph?: {
    adapter: GraphAdapter; // Graph database adapter
    orphanCleanup?: boolean; // Auto-cleanup orphaned nodes
    autoSync?: boolean; // Auto-sync worker (coming soon)
  };
}
```

### Example: Full Configuration

```typescript
import { Cortex } from "@cortexmemory/sdk";
import {
  CypherGraphAdapter,
  initializeGraphSchema,
} from "@cortexmemory/sdk/graph";

// Setup graph (optional)
const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: process.env.NEO4J_URI!,
  username: process.env.NEO4J_USERNAME!,
  password: process.env.NEO4J_PASSWORD!,
});
await initializeGraphSchema(graphAdapter);

// Initialize Cortex with all options
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    orphanCleanup: true,
  },
});
```

---

## Environment-Specific Configuration

### Development

```env
# .env.local (development)
CONVEX_URL=http://127.0.0.1:3210
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=dev-password
OPENAI_API_KEY=sk-test-key
```

### Staging

```env
# .env.staging
CONVEX_URL=https://staging-deployment.convex.cloud
CONVEX_DEPLOY_KEY=dev:staging-deployment|key
NEO4J_URI=bolt://staging-neo4j.example.com:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=staging-password
OPENAI_API_KEY=sk-staging-key
```

### Production

```env
# .env.production
CONVEX_URL=https://prod-deployment.convex.cloud
CONVEX_DEPLOY_KEY=prod:prod-deployment|key
NEO4J_URI=bolt://prod-neo4j.example.com:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=strong-production-password
OPENAI_API_KEY=sk-prod-key
```

**Security:** Never commit `.env.*` files to git!

---

## Advanced Configuration

### Memory Space Defaults

Configure default behavior for memory operations:

```typescript
// In your code
const DEFAULT_MEMORY_SPACE = "my-agent";
const DEFAULT_IMPORTANCE = 50;

await cortex.memory.remember({
  memorySpaceId: DEFAULT_MEMORY_SPACE,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
  metadata: {
    importance: DEFAULT_IMPORTANCE,
  },
});
```

### Search Configuration

Customize search behavior:

```typescript
const results = await cortex.memory.search(memorySpaceId, query, {
  limit: 10, // Max results
  minImportance: 30, // Filter by importance
  includeContent: true, // Include full content
});
```

### Conversation Limits

Manage conversation size:

```typescript
await cortex.conversations.create({
  memorySpaceId,
  conversationId,
  type: "user-agent",
  participants: { userId, participantId: "my-agent" },
  metadata: {
    maxMessages: 1000, // Limit conversation size
    autoArchive: true, // Archive when limit reached
  },
});
```

---

## Embedding Provider Configuration

### OpenAI (Recommended)

```bash
npm install openai
```

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateEmbedding = async (text: string) => {
  const result = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 dimensions
    input: text,
  });
  return result.data[0].embedding;
};
```

### Cohere

```bash
npm install cohere-ai
```

```typescript
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const generateEmbedding = async (text: string) => {
  const result = await cohere.embed({
    texts: [text],
    model: "embed-english-v3.0",
    inputType: "search_document",
  });
  return result.embeddings[0];
};
```

### Local Models

```bash
npm install @xenova/transformers
```

```typescript
import { pipeline } from "@xenova/transformers";

const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
);

const generateEmbedding = async (text: string) => {
  const result = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(result.data);
};
```

---

## Performance Configuration

### Connection Pooling

Convex client handles connection pooling automatically, but you can reuse the Cortex instance:

```typescript
// Good: Single instance (recommended)
const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });

// Use this instance throughout your app
export default cortex;

// Bad: Creating new instance for each operation
// This creates unnecessary connections
```

### Batch Operations

For bulk operations, use batch methods:

```typescript
// Store multiple memories efficiently
const memories = [...];  // Your memory data

for (const memory of memories) {
  await cortex.memory.remember(memory);
}
// Note: Convex batches these automatically
```

---

## Security Configuration

### Authentication

Cortex doesn't handle auth directly - integrate with your existing auth system:

```typescript
// Example with Clerk
import { auth } from "@clerk/nextjs";

export async function chatAction(message: string) {
  const { userId } = auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Use authenticated userId
  await cortex.memory.remember({
    memorySpaceId: `user-${userId}`,
    conversationId,
    userMessage: message,
    agentResponse: response,
    userId,
    userName: user.name,
  });
}
```

### Data Isolation

Ensure users can only access their own memories:

```typescript
// Good: User-specific memory space
const memorySpaceId = `user-${authenticatedUserId}`;

// Bad: Shared memory space (unless intentional)
const memorySpaceId = "global";
```

### Sensitive Data

Be careful with PII in memories:

```typescript
// Consider anonymization
await cortex.memory.remember({
  memorySpaceId,
  conversationId,
  userMessage: message,
  agentResponse: response,
  userId: hash(actualUserId), // Hash PII
  userName: "User", // Generic name
});
```

---

## Logging Configuration

### Development Logging

```typescript
// Enable verbose logging in development
if (process.env.NODE_ENV === "development") {
  console.log("Cortex initialized:", {
    convexUrl: process.env.CONVEX_URL,
    hasGraph: !!graphAdapter,
  });
}
```

### Production Logging

```typescript
// Use proper logging library
import { logger } from "./logger";

try {
  await cortex.memory.remember(data);
  logger.info("Memory stored", { memorySpaceId });
} catch (error) {
  logger.error("Failed to store memory", { error, memorySpaceId });
}
```

---

## Configuration Best Practices

### 1. Use Environment Variables

```typescript
// Good: Environment-based config
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

// Bad: Hardcoded values
const cortex = new Cortex({
  convexUrl: "https://my-deployment.convex.cloud", // Don't do this!
});
```

### 2. Validate Configuration

```typescript
function validateConfig() {
  if (!process.env.CONVEX_URL) {
    throw new Error("CONVEX_URL is required");
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.CONVEX_DEPLOY_KEY) {
      console.warn("CONVEX_DEPLOY_KEY not set");
    }
  }
}

validateConfig();
const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL });
```

### 3. Singleton Pattern

```typescript
// utils/cortex.ts
let cortexInstance: Cortex | null = null;

export function getCortex(): Cortex {
  if (!cortexInstance) {
    cortexInstance = new Cortex({
      convexUrl: process.env.CONVEX_URL!,
    });
  }
  return cortexInstance;
}

// Usage
import { getCortex } from './utils/cortex';

const cortex = getCortex();
await cortex.memory.remember(...);
```

### 4. Graceful Cleanup

```typescript
// Cleanup on app shutdown
process.on("SIGTERM", () => {
  cortex.close();
  graphAdapter?.disconnect();
  process.exit(0);
});
```

---

## Next Steps

- **[Memory Operations API](../03-api-reference/02-memory-operations.md)** - Start using the API
- **[Simple Chatbot Recipe](../06-recipes/01-simple-chatbot.md)** - Build a complete example
- **[Production Checklist](../08-deployment/01-production-checklist.md)** - Prepare for production

---

**Questions?** See [FAQ](../11-reference/01-faq.md) or ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).
