# Error Handling

> **Last Updated**: 2025-10-28

Complete guide to error handling, debugging, and troubleshooting in Cortex.

## Overview

Cortex uses structured errors with specific error codes to make debugging easier. All errors extend `CortexError` with a `code` property for programmatic handling.

```typescript
try {
  await cortex.memory.store('agent-1', { ... });
} catch (error) {
  if (error instanceof CortexError) {
    console.log(`Error code: ${error.code}`);
    console.log(`Message: ${error.message}`);
    console.log(`Details:`, error.details);

    // Handle specific errors
    if (error.code === 'INVALID_IMPORTANCE') {
      // Fix and retry
    }
  }
}
```

---

## Error Categories

### General Errors

| Code            | Description               | Common Causes                              | Solution                                |
| --------------- | ------------------------- | ------------------------------------------ | --------------------------------------- |
| `CONVEX_ERROR`  | Database operation failed | Network issue, Convex down, quota exceeded | Check Convex status, retry with backoff |
| `INVALID_INPUT` | Generic input validation  | Malformed data                             | Check input structure                   |

---

### Memory Operation Errors

| Code                          | Description                  | Common Causes                     | Solution                         |
| ----------------------------- | ---------------------------- | --------------------------------- | -------------------------------- |
| `INVALID_MEMORYSPACE_ID`      | Memory space ID is invalid   | Empty string, null, wrong format  | Provide valid memorySpaceId      |
| `INVALID_CONTENT`             | Content is invalid           | Empty string, > 100KB             | Check content size and format    |
| `INVALID_IMPORTANCE`          | Importance out of range      | Not 0-100                         | Use value between 0-100          |
| `INVALID_EMBEDDING_DIMENSION` | Embedding dimension mismatch | Wrong vector size                 | Check embedding model dimensions |
| `MEMORY_NOT_FOUND`            | Memory doesn't exist         | Invalid memoryId, already deleted | Verify memoryId exists           |
| `VERSION_NOT_FOUND`           | Version doesn't exist        | Version purged by retention       | Check version retention settings |
| `PERMISSION_DENIED`           | Access denied                | Agent doesn't own memory          | Verify agent owns this memory    |
| `INVALID_FILTERS`             | Filters malformed            | Bad filter syntax                 | Check filter structure           |
| `NO_MEMORIES_MATCHED`         | No memories match filters    | Filters too restrictive           | Broaden filter criteria          |

**Example:**

```typescript
try {
  await cortex.memory.store("agent-1", {
    content: "Test",
    contentType: "raw",
    source: { type: "system", timestamp: new Date() },
    metadata: { importance: 150 }, // ❌ Out of range!
  });
} catch (error) {
  if (error.code === "INVALID_IMPORTANCE") {
    console.log("Importance must be 0-100");
    // Fix and retry
    await cortex.memory.store("agent-1", {
      ...data,
      metadata: { importance: 100 }, // ✅ Valid
    });
  }
}
```

---

### User Operation Errors

| Code                   | Description            | Common Causes                            | Solution                          |
| ---------------------- | ---------------------- | ---------------------------------------- | --------------------------------- |
| `INVALID_USER_ID`      | User ID is invalid     | Empty string, null                       | Provide valid userId              |
| `USER_NOT_FOUND`       | User doesn't exist     | Invalid userId, not created yet, deleted | Create user profile first         |
| `INVALID_PROFILE_DATA` | Profile data malformed | Bad data structure                       | Check UserProfileUpdate structure |
| `NO_USERS_MATCHED`     | No users match filters | Filters too restrictive                  | Broaden criteria                  |

**Example:**

```typescript
try {
  await cortex.users.update("user-123", {
    data: { displayName: "Alex" },
  });
} catch (error) {
  if (error.code === "USER_NOT_FOUND") {
    // User doesn't exist - this is an upsert, so this shouldn't happen
    // Unless userId validation is strict
    console.log("Unexpected: user not found on upsert");
  }
}
```

---

### Context Operation Errors

| Code                | Description                  | Common Causes                          | Solution                    |
| ------------------- | ---------------------------- | -------------------------------------- | --------------------------- |
| `INVALID_PURPOSE`   | Purpose is invalid           | Empty string                           | Provide descriptive purpose |
| `CONTEXT_NOT_FOUND` | Context doesn't exist        | Invalid contextId, deleted             | Verify contextId            |
| `PARENT_NOT_FOUND`  | Parent context doesn't exist | Invalid parentId                       | Check parent exists         |
| `HAS_CHILDREN`      | Context has children         | Deleting parent without cascade        | Use cascadeChildren: true   |
| `INVALID_STATUS`    | Status is invalid            | Not active/completed/cancelled/blocked | Use valid status            |

**Example:**

```typescript
try {
  await cortex.contexts.delete("ctx-parent");
} catch (error) {
  if (error.code === "HAS_CHILDREN") {
    // Can't delete parent with children
    await cortex.contexts.delete("ctx-parent", {
      cascadeChildren: true, // ✅ Delete children too
    });
  }
}
```

---

### Conversation Operation Errors

| Code                      | Description                | Common Causes                     | Solution                    |
| ------------------------- | -------------------------- | --------------------------------- | --------------------------- |
| `INVALID_CONVERSATION_ID` | Conversation ID invalid    | Empty, malformed                  | Provide valid ID            |
| `CONVERSATION_NOT_FOUND`  | Conversation doesn't exist | Invalid ID, deleted               | Verify conversation exists  |
| `INVALID_TYPE`            | Type is invalid            | Not 'user-agent' or 'agent-agent' | Use valid type              |
| `INVALID_PARTICIPANTS`    | Participants malformed     | Missing userId/memorySpaceId      | Check participant structure |
| `INVALID_MESSAGE`         | Message is malformed       | Missing required fields           | Check message structure     |
| `INVALID_QUERY`           | Query is invalid           | Empty query string                | Provide non-empty query     |

**Example:**

```typescript
try {
  await cortex.conversations.create({
    type: "user-to-agent", // ❌ Invalid type!
    participants: { userId: "user-123", memorySpaceId: "user-123-personal" },
  });
} catch (error) {
  if (error.code === "INVALID_TYPE") {
    // Fix type
    await cortex.conversations.create({
      type: "user-agent", // ✅ Correct
      participants: { userId: "user-123", memorySpaceId: "user-123-personal" },
    });
  }
}
```

---

### Immutable Store Errors

| Code              | Description            | Common Causes         | Solution                  |
| ----------------- | ---------------------- | --------------------- | ------------------------- |
| `INVALID_TYPE`    | Type is invalid        | Empty type            | Provide valid type        |
| `INVALID_ID`      | ID is invalid          | Empty id              | Provide valid logical ID  |
| `DATA_TOO_LARGE`  | Data exceeds limit     | Payload > 100KB       | Reduce data size or split |
| `NOT_FOUND`       | Record not found       | Invalid type/id combo | Verify record exists      |
| `PURGE_FAILED`    | Purge operation failed | Database error        | Check Convex, retry       |
| `PURGE_CANCELLED` | User cancelled purge   | Confirmation rejected | User action required      |

**Example:**

```typescript
try {
  await cortex.immutable.store({
    type: "kb-article",
    id: "huge-article",
    data: massiveObject, // > 100KB
  });
} catch (error) {
  if (error.code === "DATA_TOO_LARGE") {
    // Split into chunks
    await cortex.immutable.store({
      type: "kb-article",
      id: "article-part-1",
      data: chunk1,
    });
  }
}
```

---

### Mutable Store Errors

| Code                 | Description          | Common Causes                         | Solution                |
| -------------------- | -------------------- | ------------------------------------- | ----------------------- |
| `INVALID_NAMESPACE`  | Namespace is invalid | Empty namespace                       | Provide valid namespace |
| `INVALID_KEY`        | Key is invalid       | Empty key                             | Provide valid key       |
| `VALUE_TOO_LARGE`    | Value exceeds limit  | Payload > 1MB                         | Reduce value size       |
| `KEY_NOT_FOUND`      | Key doesn't exist    | Invalid namespace/key                 | Verify key exists       |
| `UPDATE_FAILED`      | Update failed        | Updater function threw                | Check updater logic     |
| `TRANSACTION_FAILED` | Transaction failed   | Optimistic locking, error in callback | Retry transaction       |

**Example:**

```typescript
try {
  await cortex.mutable.update("inventory", "widget-qty", (qty) => {
    if (qty < 10) throw new Error("Insufficient stock");
    return qty - 10;
  });
} catch (error) {
  if (error.code === "UPDATE_FAILED") {
    console.log("Updater function threw error");
    console.log("Original error:", error.details);
  }
}
```

---

### A2A Operation Errors

| Code                    | Description      | Common Causes               | Solution                        |
| ----------------------- | ---------------- | --------------------------- | ------------------------------- |
| `PUBSUB_NOT_CONFIGURED` | Pub/sub required | request() without pub/sub   | Configure pub/sub or use send() |
| `EMPTY_RECIPIENTS`      | No recipients    | broadcast() with empty to[] | Provide recipient list          |
| `A2A_TIMEOUT_ERROR`     | Request timeout  | No response within timeout  | Increase timeout or use async   |

**Example:**

```typescript
try {
  const response = await cortex.a2a.request({
    from: 'agent-1',
    to: 'agent-2',
    message: 'Question?',
    timeout: 5000,
  });
} catch (error) {
  if (error instanceof A2ATimeoutError) {
    console.log(`No response within ${error.timeout}ms`);
    // Fallback to async
    await cortex.a2a.send({
      from: 'agent-1',
      to: 'agent-2',
      message: 'Question? (respond when ready)',
    });
  } else if (error.code === 'PUBSUB_NOT_CONFIGURED') {
    console.log('request() requires pub/sub configuration');
    // Use send() instead
    await cortex.a2a.send({ ... });
  }
}
```

---

### Cloud Mode Errors

| Code                  | Description                 | Common Causes                          | Solution                             |
| --------------------- | --------------------------- | -------------------------------------- | ------------------------------------ |
| `CLOUD_MODE_REQUIRED` | Feature requires Cloud      | autoEmbed/autoSummarize in Direct mode | Use Cloud Mode or implement yourself |
| `STRATEGY_FAILED`     | Smart store strategy failed | LLM error, network issue               | Retry or fall back to manual         |

**Example:**

```typescript
try {
  await cortex.memory.store('agent-1', {
    content: 'Test',
    autoEmbed: true,  // Cloud Mode only
    ...
  });
} catch (error) {
  if (error.code === 'CLOUD_MODE_REQUIRED') {
    console.log('autoEmbed requires Cortex Cloud');
    // Provide embedding manually
    await cortex.memory.store('agent-1', {
      content: 'Test',
      embedding: await embed('Test'),  // Manual
      ...
    });
  }
}
```

---

## Error Handling Patterns

### Pattern 1: Try-Catch with Retry

```typescript
async function storeWithRetry(
  memorySpaceId: string,
  entry: MemoryInput,
  maxRetries = 3,
): Promise<MemoryEntry> {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await cortex.memory.store(memorySpaceId, entry);
    } catch (error) {
      lastError = error;

      if (error.code === "CONVEX_ERROR") {
        // Transient error - retry with backoff
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }

      // Non-transient error - don't retry
      throw error;
    }
  }

  throw lastError;
}
```

### Pattern 2: Validation Before Operation

```typescript
async function safeStore(memorySpaceId: string, entry: MemoryInput) {
  // Validate before calling
  if (!entry.content || entry.content.length === 0) {
    throw new Error("Content cannot be empty");
  }

  if (entry.metadata.importance < 0 || entry.metadata.importance > 100) {
    throw new Error("Importance must be 0-100");
  }

  if (entry.embedding && entry.embedding.length !== 3072) {
    throw new Error("Embedding must be 3072 dimensions");
  }

  // Now safe to store
  return await cortex.memory.store(memorySpaceId, entry);
}
```

### Pattern 3: Fallback Strategies

```typescript
async function searchWithFallback(
  memorySpaceId: string,
  query: string,
  embedding?: number[],
) {
  try {
    // Try semantic search first
    return await cortex.memory.search(memorySpaceId, query, {
      embedding,
      strategy: "semantic",
      limit: 10,
    });
  } catch (error) {
    if (error.code === "INVALID_EMBEDDING_DIMENSION") {
      // Fall back to keyword search
      console.warn("Semantic search failed, using keyword");
      return await cortex.memory.search(memorySpaceId, query, {
        strategy: "keyword",
        limit: 10,
      });
    }
    throw error;
  }
}
```

### Pattern 4: Graceful Degradation

```typescript
async function getMemoryWithFallback(
  memorySpaceId: string,
  memoryId: string,
): Promise<MemoryEntry | null> {
  try {
    return await cortex.memory.get(memorySpaceId, memoryId);
  } catch (error) {
    if (error.code === "MEMORY_NOT_FOUND") {
      // Memory was deleted - return null gracefully
      console.log("Memory no longer exists");
      return null;
    }

    if (error.code === "PERMISSION_DENIED") {
      // Agent doesn't own this memory
      console.log("Access denied to memory");
      return null;
    }

    // Unknown error - rethrow
    throw error;
  }
}
```

### Pattern 5: Error Aggregation

```typescript
async function bulkOperationWithErrors(
  memorySpaceId: string,
  items: MemoryInput[],
) {
  const results = {
    successful: [] as MemoryEntry[],
    failed: [] as { item: MemoryInput; error: CortexError }[],
  };

  for (const item of items) {
    try {
      const memory = await cortex.memory.store(memorySpaceId, item);
      results.successful.push(memory);
    } catch (error) {
      if (error instanceof CortexError) {
        results.failed.push({ item, error });
      } else {
        throw error; // Unexpected error
      }
    }
  }

  return results;
}
```

---

## Debugging Strategies

### Strategy 1: Enable Debug Logging

```typescript
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  debug: true, // Enable debug logging
});

// Logs all operations
// - Memory stores
// - Searches
// - Updates
// - Errors with full context
```

### Strategy 2: Inspect Error Details

```typescript
catch (error) {
  if (error instanceof CortexError) {
    console.log('Error Code:', error.code);
    console.log('Message:', error.message);
    console.log('Details:', JSON.stringify(error.details, null, 2));

    // Details might include:
    // - Invalid field names
    // - Actual vs expected values
    // - Stack trace
    // - Related entity IDs
  }
}
```

### Strategy 3: Verify Data Integrity

```typescript
async function debugMemory(memorySpaceId: string, memoryId: string) {
  try {
    const memory = await cortex.memory.get(memorySpaceId, memoryId);

    console.log("Memory found:", {
      id: memory.id,
      memorySpaceId: memory.memorySpaceId,
      version: memory.version,
      hasEmbedding: !!memory.embedding,
      embeddingDimension: memory.embedding?.length,
      hasConversationRef: !!memory.conversationRef,
      importance: memory.metadata.importance,
      tags: memory.metadata.tags,
    });

    // Verify conversationRef
    if (memory.conversationRef) {
      const conversation = await cortex.conversations.get(
        memory.conversationRef.conversationId,
      );

      if (!conversation) {
        console.warn("⚠️ Broken conversationRef!");
      } else {
        console.log("✅ ConversationRef valid");
      }
    }
  } catch (error) {
    console.error("Debug failed:", error);
  }
}
```

### Strategy 4: Test Filters Incrementally

```typescript
// Start broad, narrow down
async function debugSearch(memorySpaceId: string) {
  // 1. Get total count
  const total = await cortex.memory.count(memorySpaceId);
  console.log(`Total memories: ${total}`);

  // 2. Filter by source
  const conversations = await cortex.memory.count(memorySpaceId, {
    "source.type": "conversation",
  });
  console.log(`Conversation memories: ${conversations}`);

  // 3. Add user filter
  const userConversations = await cortex.memory.count(memorySpaceId, {
    "source.type": "conversation",
    userId: "user-123",
  });
  console.log(`User-123 conversations: ${userConversations}`);

  // 4. Add importance
  const important = await cortex.memory.count(memorySpaceId, {
    "source.type": "conversation",
    userId: "user-123",
    minImportance: 70,
  });
  console.log(`Important user-123 conversations: ${important}`);

  // Now you know where the breakdown is!
}
```

---

## Common Issues

### Issue 1: Embedding Dimension Mismatch

**Error:** `INVALID_EMBEDDING_DIMENSION`

**Cause:** Mixing different embedding models (e.g., 1536-dim + 3072-dim)

**Solution:**

```typescript
// ❌ Problem: Mixed dimensions
await cortex.memory.store('agent-1', {
  embedding: await embed('text', 'text-embedding-ada-002'),  // 1536-dim
  ...
});

await cortex.memory.store('agent-1', {
  embedding: await embed('text', 'text-embedding-3-large'),  // 3072-dim ❌
  ...
});

// ✅ Solution: Consistent dimensions
const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 3072;

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  embeddingDimensions: EMBEDDING_DIMENSIONS,  // Enforce consistency
});
```

### Issue 2: Memory Not Found After Deletion

**Error:** `MEMORY_NOT_FOUND`

**Cause:** Trying to access deleted memory

**Solution:**

```typescript
// Check before accessing
const exists = await cortex.memory.count("agent-1", {
  // Use filters to check existence
});

if (exists > 0) {
  const memory = await cortex.memory.get("agent-1", memoryId);
} else {
  console.log("Memory was deleted");
}

// Or use try-catch
try {
  const memory = await cortex.memory.get("agent-1", memoryId);
} catch (error) {
  if (error.code === "MEMORY_NOT_FOUND") {
    // Handle gracefully
    return null;
  }
}
```

### Issue 3: Version Not Found

**Error:** `VERSION_NOT_FOUND`

**Cause:** Version purged by retention policy

**Solution:**

```typescript
// Version might be purged, but ACID source still exists
try {
  const v1 = await cortex.memory.getVersion("agent-1", "mem-123", 1);
} catch (error) {
  if (error.code === "VERSION_NOT_FOUND") {
    console.log("Version 1 purged by retention");

    // But can still get from ACID!
    const current = await cortex.memory.get("agent-1", "mem-123");
    if (current.conversationRef) {
      const conversation = await cortex.conversations.get(
        current.conversationRef.conversationId,
      );
      console.log("Full history in ACID:", conversation.messages);
    }
  }
}
```

### Issue 4: Broken conversationRef

**Error:** `CONVERSATION_NOT_FOUND` when enriching

**Cause:** Conversation was deleted but Vector memory still references it

**Solution:**

```typescript
// Find orphaned memories
const memories = await cortex.memory.list("agent-1");

for (const memory of memories.memories) {
  if (memory.conversationRef) {
    const conversation = await cortex.conversations.get(
      memory.conversationRef.conversationId,
    );

    if (!conversation) {
      console.warn(`Orphaned memory: ${memory.id}`);
      // Clean up or fix
      await cortex.memory.update("agent-1", memory.id, {
        conversationRef: undefined, // Remove broken ref
      });
    }
  }
}
```

### Issue 5: GDPR Cascade Not Deleting Everything

**Error:** Records still exist after cascade deletion

**Cause:** Records don't have `userId` field

**Solution:**

```typescript
// Ensure all user-related data has userId
await cortex.immutable.store({
  type: 'feedback',
  id: 'feedback-123',
  userId: 'user-123',  // ← Required for GDPR cascade!
  data: { rating: 5 },
});

await cortex.mutable.set('sessions', 'sess-123', data, 'user-123');  // ← userId param

await cortex.vector.store('agent-1', {
  userId: 'user-123',  // ← Required for cascade
  ...
});

// Now GDPR cascade will find everything
await cortex.users.delete('user-123', { cascade: true });
```

---

## Best Practices

### 1. Always Catch Errors

```typescript
// ❌ Don't ignore errors
await cortex.memory.store("agent-1", data);

// ✅ Always handle
try {
  await cortex.memory.store("agent-1", data);
} catch (error) {
  console.error("Failed to store memory:", error);
  // Handle appropriately
}
```

### 2. Use Type Guards

```typescript
import { isCortexError, isA2ATimeoutError } from "@cortex-platform/sdk";

try {
  await operation();
} catch (error) {
  if (isCortexError(error)) {
    // Type-safe access to error.code
    console.log(error.code);
  } else if (isA2ATimeoutError(error)) {
    // A2A specific error
    console.log(error.messageId, error.timeout);
  } else {
    // Unknown error
    throw error;
  }
}
```

### 3. Log Error Context

```typescript
catch (error) {
  if (error instanceof CortexError) {
    logger.error('Cortex operation failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      operation: 'memory.store',
      memorySpaceId: 'user-123-personal',
      timestamp: new Date(),
    });
  }
}
```

### 4. Validate Before Expensive Operations

```typescript
// Validate before bulk operation
const preview = await cortex.memory.deleteMany("agent-1", filters, {
  dryRun: true,
});

if (preview.wouldDelete > 1000) {
  throw new Error("Too many memories to delete - review filters");
}

// Proceed
await cortex.memory.deleteMany("agent-1", filters);
```

### 5. Handle Pagination Errors

```typescript
async function getAllMemories(memorySpaceId: string) {
  const allMemories = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    try {
      const page = await cortex.memory.list(memorySpaceId, {
        limit,
        offset,
      });

      allMemories.push(...page.memories);

      if (!page.hasMore) break;
      offset += limit;
    } catch (error) {
      if (error.code === "INVALID_PAGINATION") {
        console.log("Reached end of pagination");
        break;
      }
      throw error;
    }
  }

  return allMemories;
}
```

---

## Troubleshooting Guide

### Memories Not Appearing in Search

**Symptoms:**

- Memory stored successfully
- Not returned in search results

**Debug:**

```typescript
// 1. Verify memory exists
const memory = await cortex.memory.get("agent-1", memoryId);
console.log("Memory exists:", !!memory);

// 2. Check if embedding provided
console.log("Has embedding:", !!memory.embedding);

// 3. Try wildcard search
const all = await cortex.memory.search("agent-1", "*", { limit: 100 });
console.log("Total memories:", all.length);

// 4. Check filters
const withFilters = await cortex.memory.search("agent-1", query, {
  userId: "user-123",
  minImportance: 50,
});
console.log("With filters:", withFilters.length);

// 5. Remove filters one by one
```

### Search Returns Wrong Results

**Symptoms:**

- Search returns irrelevant memories
- Low similarity scores

**Debug:**

```typescript
// Check embedding quality
const embedding = await embed(query);
console.log("Embedding dimension:", embedding.length);
console.log("Embedding values:", embedding.slice(0, 5));

// Check stored embeddings
const memories = await cortex.memory.list("agent-1", { limit: 10 });
memories.memories.forEach((m) => {
  console.log(`Memory ${m.id}: embedding=${!!m.embedding}`);
  if (m.embedding) {
    console.log(`  Dimension: ${m.embedding.length}`);
  }
});

// Try different strategies
const semantic = await cortex.memory.search(memorySpaceId, query, {
  strategy: "semantic",
  embedding,
});

const keyword = await cortex.memory.search(memorySpaceId, query, {
  strategy: "keyword",
});

console.log("Semantic results:", semantic.length);
console.log("Keyword results:", keyword.length);
```

### GDPR Deletion Not Complete

**Symptoms:**

- Cascade deletion doesn't remove all data
- Records still exist after deletion

**Debug:**

```typescript
// Check what has userId
const allStores = {
  conversations: await cortex.conversations.count({ userId: "user-123" }),
  immutable: await cortex.immutable.count({ userId: "user-123" }),
  mutable: 0, // Check manually per namespace
  vector: 0, // Check per agent
};

console.log("Records with userId:", allStores);

// Find mutable records
const namespaces = ["sessions", "cache", "preferences"];
for (const ns of namespaces) {
  const count = await cortex.mutable.count(ns, { userId: "user-123" });
  console.log(`${ns}: ${count} records`);
}

// Find vector memories
const agents = await cortex.agents.list();
for (const agent of agents) {
  const count = await cortex.memory.count(agent.id, { userId: "user-123" });
  console.log(`${agent.id}: ${count} memories`);
}

// If counts > 0 after cascade, those records don't have userId set properly
```

---

## Error Reference Quick Lookup

### By Operation

**Memory Operations:**

- `INVALID_AGENT_ID`, `INVALID_CONTENT`, `INVALID_IMPORTANCE`, `INVALID_EMBEDDING_DIMENSION`
- `MEMORY_NOT_FOUND`, `VERSION_NOT_FOUND`, `PERMISSION_DENIED`
- `INVALID_FILTERS`, `NO_MEMORIES_MATCHED`

**User Operations:**

- `INVALID_USER_ID`, `USER_NOT_FOUND`, `INVALID_PROFILE_DATA`
- `NO_USERS_MATCHED`

**Context Operations:**

- `INVALID_PURPOSE`, `CONTEXT_NOT_FOUND`, `PARENT_NOT_FOUND`
- `HAS_CHILDREN`, `INVALID_STATUS`

**Conversation Operations:**

- `INVALID_CONVERSATION_ID`, `CONVERSATION_NOT_FOUND`, `INVALID_TYPE`
- `INVALID_PARTICIPANTS`, `INVALID_MESSAGE`, `INVALID_QUERY`

**Immutable Store:**

- `INVALID_TYPE`, `INVALID_ID`, `DATA_TOO_LARGE`
- `NOT_FOUND`, `PURGE_FAILED`, `PURGE_CANCELLED`

**Mutable Store:**

- `INVALID_NAMESPACE`, `INVALID_KEY`, `VALUE_TOO_LARGE`
- `KEY_NOT_FOUND`, `UPDATE_FAILED`, `TRANSACTION_FAILED`

**A2A:**

- `PUBSUB_NOT_CONFIGURED`, `EMPTY_RECIPIENTS`, `A2A_TIMEOUT_ERROR`

**Cloud Mode:**

- `CLOUD_MODE_REQUIRED`, `STRATEGY_FAILED`

### By Severity

**Critical (Data Loss Risk):**

- `DELETION_FAILED` - Deletion in progress but failed
- `TRANSACTION_FAILED` - Atomic operation partially complete
- `PURGE_FAILED` - Purge operation incomplete

**High (Operation Failure):**

- `CONVEX_ERROR` - Database unavailable
- `PERMISSION_DENIED` - Access control issue
- `USER_NOT_FOUND` - Missing dependency

**Medium (Validation):**

- `INVALID_*` - Input validation errors
- `*_NOT_FOUND` - Entity doesn't exist

**Low (Informational):**

- `NO_*_MATCHED` - Query returned no results
- `VERSION_NOT_FOUND` - Old version purged (expected)

---

## Production Error Handling

### Centralized Error Handler

```typescript
class CortexErrorHandler {
  async handle(error: unknown, context: any) {
    if (error instanceof CortexError) {
      // Log to monitoring service
      await this.logError(error, context);

      // Alert for critical errors
      if (this.isCritical(error.code)) {
        await this.sendAlert(error, context);
      }

      // Retry transient errors
      if (this.isRetryable(error.code)) {
        return { shouldRetry: true, delay: this.getRetryDelay(error) };
      }

      // Return user-friendly message
      return {
        shouldRetry: false,
        userMessage: this.getUserMessage(error.code),
      };
    }

    // Unknown error
    throw error;
  }

  private isCritical(code: string): boolean {
    return [
      'DELETION_FAILED',
      'TRANSACTION_FAILED',
      'CONVEX_ERROR',
    ].includes(code);
  }

  private isRetryable(code: string): boolean {
    return [
      'CONVEX_ERROR',
      'TRANSACTION_FAILED',
    ].includes(code);
  }

  private getRetryDelay(error: CortexError): number {
    // Exponential backoff
    return 1000 * Math.pow(2, error.details?.retryCount || 0);
  }

  private getUserMessage(code: string): string {
    const messages = {
      'MEMORY_NOT_FOUND': 'This information is no longer available',
      'PERMISSION_DENIED': 'You don't have access to this information',
      'INVALID_IMPORTANCE': 'Please provide a valid importance score (0-100)',
      'CONVEX_ERROR': 'Service temporarily unavailable, please try again',
    };

    return messages[code] || 'An error occurred';
  }
}
```

### Monitoring Integration

```typescript
import { Sentry } from "@sentry/node";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  onError: (error, operation, params) => {
    if (error instanceof CortexError) {
      Sentry.captureException(error, {
        tags: {
          cortex_operation: operation,
          error_code: error.code,
        },
        extra: {
          params,
          details: error.details,
        },
      });
    }
  },
});
```

---

## Next Steps

- **[Memory Operations API](./02-memory-operations.md)** - Using Cortex APIs
- **[Troubleshooting Guide](../../11-reference/02-troubleshooting.md)** - Common issues
- **[FAQ](../../11-reference/01-faq.md)** - Frequently asked questions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
