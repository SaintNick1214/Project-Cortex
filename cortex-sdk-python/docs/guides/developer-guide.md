# Cortex Python SDK - Developer Guide

## Overview

This guide covers Python-specific aspects of using the Cortex SDK. For complete API documentation, see the main [Documentation](../../../Documentation/) which covers both TypeScript and Python SDKs.

## Installation

### Basic Installation

```bash
pip install cortex-memory
```

### With Optional Dependencies

```bash
# Graph database support (Neo4j/Memgraph)
pip install cortex-memory[graph]

# A2A communication (Redis pub/sub)
pip install cortex-memory[a2a]

# All optional features
pip install cortex-memory[all]

# Development tools
pip install cortex-memory[dev]
```

### From Source

```bash
git clone https://github.com/SaintNick1214/Project-Cortex.git
cd Project-Cortex/cortex-sdk-python
pip install -e ".[dev]"
```

## Quick Start

### Async-First API

The Python SDK is async-first, matching the TypeScript SDK:

```python
import asyncio
import os
from cortex import Cortex, CortexConfig, RememberParams

async def main():
    # Initialize Cortex
    cortex = Cortex(CortexConfig(
        convex_url=os.getenv("CONVEX_URL")
    ))
    
    # Use the API
    result = await cortex.memory.remember(
        RememberParams(
            memory_space_id="my-agent",
            conversation_id="conv-1",
            user_message="Hello",
            agent_response="Hi!",
            user_id="user-1",
            user_name="User"
        )
    )
    
    # Clean up
    await cortex.close()

# Run async function
asyncio.run(main())
```

### Sync Wrapper (Optional)

If you need synchronous API for compatibility:

```python
import asyncio
from cortex import Cortex as AsyncCortex, CortexConfig

class SyncCortex:
    """Synchronous wrapper around async Cortex."""
    
    def __init__(self, config: CortexConfig):
        self._cortex = AsyncCortex(config)
        self._loop = asyncio.get_event_loop()
    
    def remember(self, params):
        return self._loop.run_until_complete(
            self._cortex.memory.remember(params)
        )
    
    def close(self):
        self._loop.run_until_complete(self._cortex.close())

# Usage
cortex = SyncCortex(CortexConfig(convex_url="..."))
result = cortex.remember(params)  # Synchronous!
cortex.close()
```

## Type System

The Python SDK uses dataclasses for type safety:

```python
from dataclasses import dataclass
from cortex import RememberParams, MemoryMetadata, MemorySource

# Type-safe parameter construction
params = RememberParams(
    memory_space_id="agent-1",
    conversation_id="conv-123",
    user_message="Test",
    agent_response="Response",
    user_id="user-1",
    user_name="User",
    importance=70,  # Type-checked!
    tags=["test"]
)

# IDE autocomplete and type checking work!
```

## Error Handling

### Structured Errors

```python
from cortex import CortexError, ErrorCode, is_cortex_error

try:
    await cortex.memory.store(memory_space_id, data)
except CortexError as e:
    print(f"Error code: {e.code}")
    print(f"Message: {e.message}")
    print(f"Details: {e.details}")
    
    # Handle specific errors
    if e.code == ErrorCode.INVALID_IMPORTANCE:
        # Fix and retry
        pass
```

## Integration Patterns

### FastAPI Integration

```python
from fastapi import FastAPI
from cortex import Cortex, CortexConfig
import os

app = FastAPI()

# Initialize Cortex once at startup
cortex = Cortex(CortexConfig(convex_url=os.getenv("CONVEX_URL")))

@app.on_event("shutdown")
async def shutdown():
    await cortex.close()

@app.post("/chat")
async def chat(message: str, user_id: str):
    result = await cortex.memory.remember(
        RememberParams(
            memory_space_id="chat-agent",
            conversation_id=f"conv-{user_id}",
            user_message=message,
            agent_response="...",  # Your LLM response
            user_id=user_id,
            user_name=user_id
        )
    )
    return {"success": True}
```

## Performance Tips

### Batch Operations

```python
# ❌ Slow: Sequential
for fact in facts:
    await cortex.facts.store(fact)

# ✅ Fast: Parallel
await asyncio.gather(*[
    cortex.facts.store(fact) for fact in facts
])
```

### Connection Pooling

```python
# Reuse one Cortex instance across your application
# Don't create a new instance for each request

# ✅ Good: Application-level singleton
cortex = Cortex(config)

# ❌ Bad: Per-request instance
async def handle_request():
    cortex = Cortex(config)  # Don't do this!
    await cortex.memory.remember(...)
    await cortex.close()
```

## Best Practices

1. **Use Type Hints** - Enable IDE autocomplete and catch errors early
2. **Async All The Way** - Don't block the event loop
3. **Handle Errors** - Use try/except for all Cortex operations
4. **Close Connections** - Always call `await cortex.close()`
5. **Reuse Client** - Create one Cortex instance per application
6. **Test Thoroughly** - Write tests with pytest-asyncio

## Next Steps

- Read the [API Reference](../../../Documentation/03-api-reference/01-overview.md)
- Explore [Examples](../../examples/)
- Check [Migration Guide](./migration-guide.md)
- Join [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)

## Support

For Python-specific questions:
- 🐛 [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- 💬 [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)
- 📧 support@cortexmemory.dev

