# Cortex Python SDK - Developer Guide

## Overview

This guide covers Python-specific aspects of using the Cortex SDK. For complete API documentation, see the main [Documentation](../Documentation/) which covers both TypeScript and Python SDKs.

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
cd Project-Cortex/cortex-python
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

### Runtime Validation with Pydantic

For complex validations, the SDK uses Pydantic internally:

```python
from pydantic import BaseModel, Field, validator

class CustomMemoryMetadata(BaseModel):
    importance: int = Field(ge=0, le=100)
    tags: list[str] = Field(default_factory=list)
    
    @validator('importance')
    def validate_importance(cls, v):
        if not 0 <= v <= 100:
            raise ValueError("Importance must be 0-100")
        return v
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

### Error Type Guards

```python
from cortex import is_cortex_error, is_a2a_timeout_error

try:
    await operation()
except Exception as e:
    if is_cortex_error(e):
        print(f"Cortex error: {e.code}")
    elif is_a2a_timeout_error(e):
        print(f"A2A timeout: {e.timeout}ms")
    else:
        raise
```

## Testing Your Code

### Using Pytest

```python
import pytest
from cortex import Cortex, CortexConfig

@pytest.fixture
async def cortex_client():
    """Fixture for Cortex client."""
    config = CortexConfig(convex_url=os.getenv("CONVEX_URL"))
    client = Cortex(config)
    yield client
    await client.close()

@pytest.mark.asyncio
async def test_my_feature(cortex_client):
    """Test some feature."""
    result = await cortex_client.memory.remember(...)
    assert result is not None
```

### Environment Variables

```bash
# .env file
CONVEX_URL=http://localhost:3210
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

```python
# Load .env in tests
from dotenv import load_dotenv
load_dotenv()
```

## Integration Patterns

### FastAPI Integration

```python
from fastapi import FastAPI, Depends
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

### LangChain Integration

```python
from langchain.memory import BaseChatMessageHistory
from cortex import Cortex, CortexConfig

class CortexChatHistory(BaseChatMessageHistory):
    """LangChain memory backed by Cortex."""
    
    def __init__(self, cortex: Cortex, memory_space_id: str, user_id: str):
        self.cortex = cortex
        self.memory_space_id = memory_space_id
        self.user_id = user_id
    
    async def add_message(self, message):
        # Store in Cortex
        await self.cortex.memory.remember(...)
    
    async def get_messages(self):
        # Retrieve from Cortex
        return await self.cortex.memory.search(...)
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

### Memory Management

```python
# Use context managers for cleanup
from contextlib import asynccontextmanager

@asynccontextmanager
async def cortex_client(config):
    client = Cortex(config)
    try:
        yield client
    finally:
        await client.close()

# Usage
async with cortex_client(config) as cortex:
    await cortex.memory.remember(...)
```

## Common Patterns

### User Session Management

```python
async def handle_user_message(user_id: str, message: str, cortex: Cortex):
    """Handle incoming user message with context retrieval."""
    
    memory_space_id = f"user-{user_id}-personal"
    conversation_id = f"conv-{user_id}-session"
    
    # Search for relevant context
    context = await cortex.memory.search(
        memory_space_id,
        message,
        SearchOptions(user_id=user_id, limit=10, min_importance=50)
    )
    
    # Generate response with context
    # ... your LLM logic here ...
    
    # Remember the exchange
    await cortex.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message=message,
            agent_response=response,
            user_id=user_id,
            user_name=user_id
        )
    )
```

### GDPR Compliance

```python
async def handle_gdpr_deletion(user_id: str, cortex: Cortex):
    """Handle GDPR deletion request."""
    
    from cortex import DeleteUserOptions
    
    # Export user data first
    export = await cortex.users.export(
        filters={"id": user_id},
        format="json",
        include_memories=True,
        include_conversations=True
    )
    
    # Save export
    with open(f"gdpr-export-{user_id}.json", "w") as f:
        f.write(export["data"])
    
    # Delete with cascade
    result = await cortex.users.delete(
        user_id,
        DeleteUserOptions(cascade=True, verify=True)
    )
    
    return {
        "exported": True,
        "deleted": result.total_deleted,
        "layers": result.deleted_layers,
        "verified": result.verification.complete
    }
```

## Troubleshooting

### Common Issues

**Import Error: convex not found**

```bash
# The convex Python package is not yet published
# For now, you'll need to mock it or wait for official release
pip install convex  # When available
```

**Type Checking Errors**

```bash
# Run mypy for type checking
mypy cortex --strict

# Fix common issues
# - Add type hints to all function parameters
# - Use Optional[T] for nullable values
# - Import from typing for generics
```

**Async/Await Issues**

```python
# ❌ Forgot await
result = cortex.memory.remember(params)  # Returns coroutine!

# ✅ Correct
result = await cortex.memory.remember(params)

# ❌ Using sync code with async API
def my_function():
    result = cortex.memory.remember(params)  # Can't await in sync function!

# ✅ Make function async
async def my_function():
    result = await cortex.memory.remember(params)
```

## Best Practices

1. **Use Type Hints** - Enable IDE autocomplete and catch errors early
2. **Async All The Way** - Don't block the event loop
3. **Handle Errors** - Use try/except for all Cortex operations
4. **Close Connections** - Always call `await cortex.close()`
5. **Reuse Client** - Create one Cortex instance per application
6. **Test Thoroughly** - Write tests with pytest-asyncio

## Next Steps

- Read the [API Reference](../Documentation/03-api-reference/01-overview.md)
- Explore [Examples](./examples/)
- Check [TypeScript to Python Migration Guide](#migration-guide)
- Join [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)

## Support

For Python-specific questions:
- 🐛 [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- 💬 [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)
- 📧 support@cortexmemory.dev

