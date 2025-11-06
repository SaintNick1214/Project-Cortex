# TypeScript to Python Migration Guide

## Overview

This guide helps you migrate from the TypeScript SDK to the Python SDK. The APIs are 100% compatible in functionality - the main differences are in syntax and Python conventions.

## Quick Reference

| Aspect | TypeScript | Python |
|--------|-----------|--------|
| **Case** | camelCase | snake_case |
| **Objects** | `{ key: value }` | `ClassName(key=value)` |
| **Types** | `interface` | `@dataclass` |
| **Null** | `null` / `undefined` | `None` |
| **Arrays** | `string[]` | `List[str]` |
| **Optional** | `string \| undefined` | `Optional[str]` |
| **Async** | `async/await` | `async/await` (same!) |
| **Imports** | `import { x } from "y"` | `from y import x` |

## Installation

**TypeScript:**
```bash
npm install @cortexmemory/sdk
```

**Python:**
```bash
pip install cortex-memory
```

## Initialization

**TypeScript:**
```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});
```

**Python:**
```python
from cortex import Cortex, CortexConfig

cortex = Cortex(
    CortexConfig(convex_url=os.getenv("CONVEX_URL"))
)
```

## Basic Operations

### Remember

**TypeScript:**
```typescript
const result = await cortex.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I prefer dark mode",
  agentResponse: "Got it!",
  userId: "user-123",
  userName: "Alex",
  importance: 70,
  tags: ["preferences"],
});
```

**Python:**
```python
result = await cortex.memory.remember(
    RememberParams(
        memory_space_id="agent-1",
        conversation_id="conv-123",
        user_message="I prefer dark mode",
        agent_response="Got it!",
        user_id="user-123",
        user_name="Alex",
        importance=70,
        tags=["preferences"]
    )
)
```

### Search

**TypeScript:**
```typescript
const results = await cortex.memory.search("agent-1", "preferences", {
  embedding: await embed("preferences"),
  userId: "user-123",
  minImportance: 50,
  limit: 10,
});
```

**Python:**
```python
results = await cortex.memory.search(
    "agent-1",
    "preferences",
    SearchOptions(
        embedding=await embed("preferences"),
        user_id="user-123",
        min_importance=50,
        limit=10
    )
)
```

### Update

**TypeScript:**
```typescript
await cortex.memory.update("agent-1", memoryId, {
  content: "Updated content",
  metadata: { importance: 80 },
});
```

**Python:**
```python
await cortex.memory.update(
    "agent-1",
    memory_id,
    {"content": "Updated content", "importance": 80}
)
```

## Conversations

**TypeScript:**
```typescript
const conversation = await cortex.conversations.create({
  type: "user-agent",
  memorySpaceId: "support-bot-space",
  participants: {
    userId: "user-123",
    participantId: "support-agent",
  },
});
```

**Python:**
```python
conversation = await cortex.conversations.create(
    CreateConversationInput(
        type="user-agent",
        memory_space_id="support-bot-space",
        participants=ConversationParticipants(
            user_id="user-123",
            participant_id="support-agent"
        )
    )
)
```

## User Operations

**TypeScript:**
```typescript
await cortex.users.update("user-123", {
  data: {
    displayName: "Alex",
    preferences: { theme: "dark" },
  },
});

const result = await cortex.users.delete("user-123", {
  cascade: true,
});
```

**Python:**
```python
await cortex.users.update(
    "user-123",
    {
        "displayName": "Alex",
        "preferences": {"theme": "dark"}
    }
)

result = await cortex.users.delete(
    "user-123",
    DeleteUserOptions(cascade=True)
)
```

## Context Operations

**TypeScript:**
```typescript
const context = await cortex.contexts.create({
  purpose: "Process refund",
  memorySpaceId: "supervisor-agent-space",
  userId: "user-123",
  data: { amount: 500 },
});
```

**Python:**
```python
context = await cortex.contexts.create(
    ContextInput(
        purpose="Process refund",
        memory_space_id="supervisor-agent-space",
        user_id="user-123",
        data={"amount": 500}
    )
)
```

## A2A Communication

**TypeScript:**
```typescript
await cortex.a2a.send({
  from: "agent-1",
  to: "agent-2",
  message: "Important update",
  importance: 85,
});
```

**Python:**
```python
await cortex.a2a.send(
    A2ASendParams(
        from_agent="agent-1",
        to_agent="agent-2",
        message="Important update",
        importance=85
    )
)
```

## Graph Integration

**TypeScript:**
```typescript
import { CypherGraphAdapter, initializeGraphSchema } from "@cortexmemory/sdk/graph";

const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: process.env.NEO4J_URI,
  username: "neo4j",
  password: "password",
});

await initializeGraphSchema(graphAdapter);

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  graph: {
    adapter: graphAdapter,
  },
});
```

**Python:**
```python
from cortex import Cortex, CortexConfig, GraphConfig, GraphConnectionConfig
from cortex.graph import CypherGraphAdapter, initialize_graph_schema

graph_adapter = CypherGraphAdapter()
await graph_adapter.connect(
    GraphConnectionConfig(
        uri=os.getenv("NEO4J_URI"),
        username="neo4j",
        password="password"
    )
)

await initialize_graph_schema(graph_adapter)

cortex = Cortex(
    CortexConfig(
        convex_url=os.getenv("CONVEX_URL"),
        graph=GraphConfig(adapter=graph_adapter)
    )
)
```

## Error Handling

**TypeScript:**
```typescript
try {
  await cortex.memory.store("agent-1", data);
} catch (error) {
  if (error instanceof CortexError) {
    console.log(`Error: ${error.code}`);
  }
}
```

**Python:**
```python
from cortex import CortexError

try:
    await cortex.memory.store("agent-1", data)
except CortexError as error:
    print(f"Error: {error.code}")
```

## Type System

**TypeScript:**
```typescript
interface MemoryEntry {
  id: string;
  content: string;
  importance: number;
  tags: string[];
}
```

**Python:**
```python
from dataclasses import dataclass
from typing import List

@dataclass
class MemoryEntry:
    id: str
    content: str
    importance: int
    tags: List[str]
```

## Callbacks

**TypeScript:**
```typescript
await cortex.memory.remember({
  // ... params
  extractContent: async (user, agent) => {
    return summarize(user + agent);
  },
});
```

**Python:**
```python
async def extract_content(user_msg: str, agent_msg: str) -> str:
    return await summarize(user_msg + agent_msg)

await cortex.memory.remember(
    RememberParams(
        # ... params
        extract_content=extract_content
    )
)
```

## Complete API Mapping

| TypeScript Method | Python Method | Notes |
|------------------|---------------|-------|
| `cortex.memory.remember()` | `cortex.memory.remember()` | Same name |
| `cortex.memory.search()` | `cortex.memory.search()` | Same name |
| `cortex.users.delete()` | `cortex.users.delete()` | Same name |
| `cortex.conversations.create()` | `cortex.conversations.create()` | Same name |
| `cortex.contexts.getChain()` | `cortex.contexts.get_chain()` | snake_case |
| `cortex.a2a.send()` | `cortex.a2a.send()` | Same name |
| All ~140 methods | All ~140 methods | 100% coverage |

## Testing

**TypeScript:**
```typescript
import { describe, it, expect } from "@jest/globals";

describe("Memory", () => {
  it("should remember conversation", async () => {
    const result = await cortex.memory.remember({ ... });
    expect(result.memories).toHaveLength(2);
  });
});
```

**Python:**
```python
import pytest

@pytest.mark.asyncio
async def test_remember_conversation():
    """Test remembering a conversation."""
    result = await cortex.memory.remember(...)
    assert len(result.memories) == 2
```

## Tips for Python Developers

1. **Use dataclasses** for type safety instead of dicts
2. **Type hints** enable IDE autocomplete - use them!
3. **async/await** works the same in Python as TypeScript
4. **Context managers** (`async with`) for resource cleanup
5. **pytest-asyncio** for async test support
6. **mypy** for static type checking

## Common Pitfalls

### Forgetting await

```python
# ❌ Wrong - returns coroutine
result = cortex.memory.remember(params)

# ✅ Correct - awaits the coroutine
result = await cortex.memory.remember(params)
```

### Using sync code with async API

```python
# ❌ Wrong - can't await in sync function
def my_handler():
    result = await cortex.memory.remember(params)

# ✅ Correct - make function async
async def my_handler():
    result = await cortex.memory.remember(params)
```

### Not closing connections

```python
# ❌ Wrong - connections leak
cortex = Cortex(config)
# ... use cortex ...
# (never closes)

# ✅ Correct - always close
cortex = Cortex(config)
try:
    # ... use cortex ...
finally:
    await cortex.close()

# ✅ Even better - use context manager
async with create_cortex_client(config) as cortex:
    # ... use cortex ...
    pass  # Auto-closes
```

## Next Steps

- Read [Python SDK Guide](./PYTHON_SDK_GUIDE.md)
- Check [Examples](./examples/)
- Review [API Documentation](../Documentation/03-api-reference/)
- Join [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)

