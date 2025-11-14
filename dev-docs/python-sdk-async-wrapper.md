# Python SDK - Async Wrapper for Convex Client

> **Development Documentation** - Technical implementation note

## Issue: Convex Python Client is Synchronous

The [convex PyPI package](https://pypi.org/project/convex/) provides a **synchronous** API:

```python
from convex import ConvexClient

client = ConvexClient('https://example.convex.cloud')
messages = client.query("messages:list")  # Synchronous call
client.mutation("messages:send", {...})   # Synchronous call
```

However, the TypeScript SDK (and our Python SDK design) uses **async/await** throughout.

## Solution: AsyncConvexClient Wrapper

Created `cortex/_convex_async.py` to wrap the synchronous client with an async API.

### Implementation

```python
import asyncio

class AsyncConvexClient:
    """Async wrapper around synchronous ConvexClient."""

    def __init__(self, sync_client):
        self._sync_client = sync_client

    async def query(self, name: str, args: dict) -> Any:
        """Run query in thread pool to avoid blocking event loop."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._sync_client.query(name, args)
        )

    async def mutation(self, name: str, args: dict) -> Any:
        """Run mutation in thread pool to avoid blocking event loop."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._sync_client.mutation(name, args)
        )
```

### Usage in Cortex

```python
# In cortex/client.py
from convex import ConvexClient
from ._convex_async import AsyncConvexClient

class Cortex:
    def __init__(self, config):
        # Create sync client
        sync_client = ConvexClient(config.convex_url)

        # Wrap for async API
        self.client = AsyncConvexClient(sync_client)

        # Rest of initialization...
```

### Why This Works

**Benefits:**

- ✅ Provides async/await API to match TypeScript SDK
- ✅ Doesn't block the event loop
- ✅ Runs Convex calls in thread pool
- ✅ Compatible with async Python code
- ✅ No changes needed to API modules

**Trade-offs:**

- ⚠️ Small overhead from thread pool execution
- ⚠️ Not true async I/O (but Python's convex client is sync anyway)

### Alternative Considered

We could have made the entire SDK synchronous, but that would:

- ❌ Break API parity with TypeScript SDK
- ❌ Not work well with async Python frameworks (FastAPI, etc.)
- ❌ Make the API feel un-Pythonic for modern async code

## Performance Considerations

The thread pool approach is efficient because:

1. **Thread Pool Size**: Python's default executor uses a reasonable pool
2. **I/O Bound**: Convex calls are I/O bound (network), not CPU bound
3. **No Blocking**: Main event loop stays responsive
4. **Batching**: `asyncio.gather()` still works for parallel operations

### Benchmark

```python
# Sequential (slow)
for i in range(100):
    await cortex.memory.remember(...)  # Each in thread pool

# Parallel (fast)
await asyncio.gather(*[
    cortex.memory.remember(...)  # All in thread pool concurrently
    for i in range(100)
])
```

Even though each individual call uses a thread, `asyncio.gather` can dispatch them all concurrently.

## Future: True Async Support

If Convex releases a true async Python client in the future:

```python
# Just swap the import
from convex import AsyncConvexClient  # If this exists someday

class Cortex:
    def __init__(self, config):
        self.client = AsyncConvexClient(config.convex_url)
        # No wrapper needed!
```

The rest of our SDK would work without changes.

---

**Implementation**: 2025-11-06  
**Status**: Working solution for sync→async wrapping  
**Performance**: Good for I/O-bound operations
