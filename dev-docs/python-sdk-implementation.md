# Python SDK Implementation - Technical Details

> **Development Documentation** - For contributors and maintainers

## Implementation Summary

### Completed Components

**47 Total Files | ~5,000 Lines of Code | 140+ API Methods**

1. ✅ **Core Infrastructure** (4 files)
   - `client.py` - Main Cortex class
   - `types.py` - 50+ dataclasses
   - `errors.py` - Error handling
   - `__init__.py` - Package exports

2. ✅ **Layer 1: ACID Stores** (3 modules, 34 methods)
   - `conversations/` - 13 methods
   - `immutable/` - 9 methods
   - `mutable/` - 12 methods

3. ✅ **Layer 2: Vector** (1 module, 13 methods)
   - `vector/` - Searchable memories

4. ✅ **Layer 3: Facts** (1 module, 10 methods)
   - `facts/` - Structured knowledge

5. ✅ **Layer 4: Convenience** (5 modules, 65 methods)
   - `memory/` - 14 methods (primary interface)
   - `contexts/` - 17 methods
   - `users/` - 11 methods (GDPR critical!)
   - `agents/` - 8 methods
   - `memory_spaces/` - 9 methods

6. ✅ **A2A Communication** (1 module, 4 methods)
   - `a2a/` - Agent-to-agent helpers

7. ✅ **Graph Integration** (10 files, ~20 methods)
   - `graph/adapters/` - CypherGraphAdapter
   - `graph/sync/` - Sync utilities + orphan detection
   - `graph/schema/` - Schema management
   - `graph/worker/` - GraphSyncWorker

## Type System Implementation

### Dataclasses vs TypeScript Interfaces

**TypeScript:**

```typescript
interface RememberParams {
  memorySpaceId: string;
  conversationId: string;
  userMessage: string;
  agentResponse: string;
  userId: string;
  userName: string;
  importance?: number;
  tags?: string[];
}
```

**Python:**

```python
@dataclass
class RememberParams:
    memory_space_id: str
    conversation_id: str
    user_message: str
    agent_response: str
    user_id: str
    user_name: str
    importance: Optional[int] = None
    tags: Optional[List[str]] = None
```

### Translation Pattern

1. **Case Conversion**: camelCase → snake_case
2. **Optional Fields**: `?:` → `Optional[T] = None`
3. **Arrays**: `T[]` → `List[T]`
4. **Objects**: `Record<K, V>` → `Dict[K, V]`
5. **Unions**: `A | B` → `Union[A, B]` or `A | B` (Python 3.10+)

## Async/Await Implementation

Both TypeScript and Python use native async/await:

**TypeScript:**

```typescript
async function remember(params: RememberParams): Promise<RememberResult> {
  const result = await this.client.mutation("memories:store", {...});
  return result;
}
```

**Python:**

```python
async def remember(self, params: RememberParams) -> RememberResult:
    result = await self.client.mutation("memories:store", {...})
    return result
```

## Convex Client Integration

The Python SDK uses the same pattern as TypeScript:

**Query (Read):**

```python
result = await self.client.query("memories:get", {"memoryId": memory_id})
```

**Mutation (Write):**

```python
result = await self.client.mutation("memories:store", {...})
```

## Graph Database Integration

### Neo4j Python Driver

Uses the official async Neo4j driver:

```python
from neo4j import AsyncGraphDatabase

class CypherGraphAdapter:
    async def connect(self, config: GraphConnectionConfig):
        self.driver = AsyncGraphDatabase.driver(
            config.uri,
            auth=(config.username, config.password)
        )

    async def query(self, cypher: str, params: dict) -> GraphQueryResult:
        async with self.driver.session() as session:
            result = await session.run(cypher, params)
            records = [record.data() async for record in result]
            return GraphQueryResult(records=records, count=len(records))
```

## GDPR Cascade Deletion Implementation

### Three-Phase Approach

Matching the TypeScript implementation:

```python
async def delete(self, user_id: str, options: DeleteUserOptions) -> UserDeleteResult:
    if options.cascade:
        # Phase 1: Collection
        plan = await self._collect_deletion_plan(user_id)

        # Phase 2: Backup (for rollback)
        backup = await self._create_deletion_backup(plan)

        # Phase 3: Execute deletion with rollback on failure
        try:
            result = await self._execute_deletion(plan, user_id)

            # Verify if requested
            if options.verify:
                verification = await self._verify_deletion(user_id)
                result.verification = verification

            return result
        except Exception as e:
            # Rollback on failure
            await self._rollback_deletion(backup)
            raise CascadeDeletionError(f"Cascade deletion failed: {e}", cause=e)
```

## Error Handling Strategy

### Structured Errors

All errors use the same pattern as TypeScript:

```python
class CortexError(Exception):
    def __init__(self, code: str, message: str = "", details: Any = None):
        self.code = code
        self.details = details
        super().__init__(message or code)

# Usage
raise CortexError(
    ErrorCode.INVALID_IMPORTANCE,
    "Importance must be 0-100",
    details={"provided": 150}
)
```

## Testing Strategy

### Pytest with Async Support

```python
import pytest

@pytest.fixture
async def cortex_client():
    """Reusable Cortex client fixture."""
    config = CortexConfig(convex_url=os.getenv("CONVEX_URL"))
    client = Cortex(config)
    yield client
    await client.close()

@pytest.mark.asyncio
async def test_remember(cortex_client):
    """Test remember operation."""
    result = await cortex_client.memory.remember(params)
    assert len(result.memories) == 2
```

## Performance Considerations

### Parallel Operations

Python's asyncio.gather enables parallel operations:

```python
# Sequential (slow)
for fact in facts:
    await cortex.facts.store(fact)

# Parallel (fast)
await asyncio.gather(*[
    cortex.facts.store(fact) for fact in facts
])
```

### Connection Reuse

```python
# ✅ Application-level singleton
cortex = Cortex(config)

# ❌ Don't create per-request
async def handle_request():
    cortex = Cortex(config)  # Expensive!
    await cortex.memory.remember(...)
    await cortex.close()
```

## Dependencies

### Core

- `pydantic>=2.0` - Data validation
- `typing-extensions>=4.0` - Type hints backport

### Optional

- `neo4j>=5.0` - Graph database support
- `redis>=5.0` - A2A pub/sub support

### Development

- `pytest>=8.0` - Testing framework
- `pytest-asyncio>=0.23` - Async test support
- `pytest-cov>=4.0` - Coverage reporting
- `black>=24.0` - Code formatting
- `mypy>=1.0` - Type checking
- `ruff>=0.1` - Linting

## Code Quality Standards

### Type Checking

```bash
# Strict mypy checking
mypy cortex --strict

# All files must pass with no errors
```

### Linting

```bash
# Ruff linting
ruff check cortex

# Auto-fix
ruff check cortex --fix

# Black formatting
black cortex tests
```

### Coverage

```bash
# Minimum 90% coverage required
pytest --cov=cortex --cov-report=term-missing

# Critical paths must have 100% coverage:
# - GDPR cascade deletion
# - Memory remember/forget
# - Graph sync operations
```

## Implementation Notes

### Differences from TypeScript

1. **Type System**: Dataclasses instead of interfaces
2. **Null Values**: `None` instead of `null`/`undefined`
3. **Naming**: snake_case instead of camelCase
4. **Imports**: `from cortex import` instead of `import { } from`
5. **Everything else**: Identical!

### Future Enhancements

Planned for future versions:

- [ ] Connection pooling optimizations
- [ ] Bulk operation batching
- [ ] Async context managers
- [ ] Sync wrapper utility class
- [ ] LangChain integration package
- [ ] FastAPI middleware package

## Maintenance

### Version Synchronization

The Python SDK version tracks the TypeScript SDK version:

- TypeScript SDK: v0.8.2
- Python SDK: v0.8.2

Versions are synchronized to indicate API compatibility.

### Breaking Changes

Any breaking changes in TypeScript SDK should be reflected in Python SDK:

1. Update type definitions
2. Update method signatures
3. Update tests
4. Update documentation
5. Bump major/minor version together

## Resources

- TypeScript SDK source: `../src/`
- Shared documentation: `../Documentation/`
- Testing patterns: `../tests/`
- Convex schema: `../convex-dev/`

---

**Last Updated**: 2025-11-06
