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

For complete migration examples, see the rest of this guide.

