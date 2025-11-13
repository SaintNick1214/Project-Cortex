# Python SDK - Test Porting Guide

> **Development Documentation** - Step-by-step guide for porting TypeScript tests to Python

## Current State

**TypeScript SDK**: ~600 tests across 24 files  
**Python SDK**: 29 tests across 4 files  
**Parity**: 5%  
**Goal**: 100% parity (600 tests)

## Test File Mapping

### ✅ Complete (29 tests ported)

| TypeScript              | Python                  | Tests | Coverage    |
| ----------------------- | ----------------------- | ----- | ----------- |
| (new)                   | `test_00_basic.py`      | 5     | Python-only |
| `conversations.test.ts` | `test_conversations.py` | 6/45  | 13%         |
| `memory.test.ts`        | `test_memory.py`        | 10/50 | 20%         |
| `users.test.ts`         | `test_users.py`         | 8/30  | 27%         |

### ⏳ Partial (Expand existing files)

| File                    | Current | TS Total | Gap      | Priority |
| ----------------------- | ------- | -------- | -------- | -------- |
| `test_conversations.py` | 6       | 45       | 39 tests | High     |
| `test_memory.py`        | 10      | 50       | 40 tests | High     |
| `test_users.py`         | 8       | 30       | 22 tests | Medium   |

### ❌ Missing (Create new files)

| TypeScript File                       | Python File Needed                 | Tests | Priority     |
| ------------------------------------- | ---------------------------------- | ----- | ------------ |
| **Core APIs**                         |                                    |       |              |
| `immutable.test.ts`                   | `test_immutable.py`                | 25    | **Critical** |
| `mutable.test.ts`                     | `test_mutable.py`                  | 20    | **Critical** |
| `vector.test.ts`                      | `test_vector.py`                   | 30    | **Critical** |
| `facts.test.ts`                       | `test_facts.py`                    | 25    | **Critical** |
| `contexts.test.ts`                    | `test_contexts.py`                 | 35    | High         |
| `agents.test.ts`                      | `test_agents.py`                   | 25    | High         |
| `memorySpaces.test.ts`                | `test_memory_spaces.py`            | 25    | High         |
| **Integration**                       |                                    |       |              |
| `integration.test.ts`                 | `test_integration.py`              | 40    | **Critical** |
| `crossLayerIntegrity.test.ts`         | `test_cross_layer_integrity.py`    | 30    | High         |
| `memory-facts-integration.test.ts`    | `test_memory_facts_integration.py` | 20    | High         |
| `memory-auto-conversation.test.ts`    | `test_memory_auto_conversation.py` | 15    | Medium       |
| `parameterPropagation.test.ts`        | `test_parameter_propagation.py`    | 15    | Medium       |
| **Modes**                             |                                    |       |              |
| `hiveMode.test.ts`                    | `test_hive_mode.py`                | 30    | High         |
| `collaborationMode.test.ts`           | `test_collaboration_mode.py`       | 25    | High         |
| **GDPR**                              |                                    |       |              |
| `gdprCascade.test.ts`                 | `test_gdpr_cascade.py`             | 35    | **Critical** |
| **Edge Cases**                        |                                    |       |              |
| `edgeCases.test.ts`                   | `test_edge_cases.py`               | 25    | Medium       |
| `edge-runtime.test.ts`                | `test_edge_runtime.py`             | 10    | Low          |
| **Graph**                             |                                    |       |              |
| `graph/graphAdapter.test.ts`          | `test_graph/test_adapter.py`       | 20    | High         |
| `graph/graphSyncWorker.test.ts`       | `test_graph/test_sync_worker.py`   | 25    | High         |
| `graph/end-to-end-multilayer.test.ts` | `test_graph/test_end_to_end.py`    | 30    | High         |
| `graph/proofs/*.proof.ts` (7 files)   | `test_graph/proofs/*.py` (7 files) | 40    | Medium       |

## Step-by-Step Porting Process

### Example: Porting vector.test.ts

#### Step 1: Read TypeScript Test

```typescript
// tests/vector.test.ts
describe("Vector API (Layer 2)", () => {
  describe("store()", () => {
    it("stores a basic memory", async () => {
      const memory = await cortex.vector.store("agent-1", {
        content: "Test memory",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["test"] },
      });

      expect(memory.memoryId).toMatch(/^mem-/);
      expect(memory.content).toBe("Test memory");
      expect(memory.version).toBe(1);
    });
  });
});
```

#### Step 2: Create Python Test

```python
# tests/test_vector.py
import pytest
from cortex import StoreMemoryInput, MemorySource, MemoryMetadata
import time

@pytest.mark.asyncio
async def test_store_basic_memory(cortex_client):
    """
    Test storing a basic memory.

    Port of: vector.test.ts - store() basic test
    """
    memory = await cortex_client.vector.store(
        "agent-1",
        StoreMemoryInput(
            content="Test memory",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["test"])
        )
    )

    assert memory.memory_id.startswith("mem-")
    assert memory.content == "Test memory"
    assert memory.version == 1
```

#### Step 3: Add Storage Validation

```python
@pytest.mark.asyncio
async def test_store_basic_memory_with_validation(cortex_client):
    """Test storing a memory with Convex storage validation."""
    # Store via SDK
    memory = await cortex_client.vector.store("agent-1", input)

    # Validate against Convex storage
    stored = await cortex_client.client.query(
        "memories:get",
        {"memorySpaceId": "agent-1", "memoryId": memory.memory_id}
    )

    assert stored is not None
    assert stored["content"] == "Test memory"
```

#### Step 4: Run and Verify

```bash
pytest tests/test_vector.py::test_store_basic_memory -v -s
```

## Translation Patterns

### TypeScript → Python Quick Reference

| TypeScript                         | Python                            | Example             |
| ---------------------------------- | --------------------------------- | ------------------- |
| `describe("Name", () => {})`       | File/class organization           | Group related tests |
| `it("does thing", async () => {})` | `async def test_does_thing():`    | Individual test     |
| `expect(x).toBe(y)`                | `assert x == y`                   | Assertion           |
| `expect(x).toEqual(y)`             | `assert x == y`                   | Deep equality       |
| `expect(x).toHaveLength(n)`        | `assert len(x) == n`              | Length check        |
| `expect(x).toBeNull()`             | `assert x is None`                | Null check          |
| `expect(x).not.toBeNull()`         | `assert x is not None`            | Not null            |
| `expect(x).toMatch(/regex/)`       | `assert re.match(pattern, x)`     | Regex match         |
| `expect(x).toBeGreaterThan(y)`     | `assert x > y`                    | Comparison          |
| `beforeAll(() => {})`              | `@pytest.fixture(scope="module")` | Setup once          |
| `afterAll(() => {})`               | Fixture cleanup                   | Teardown            |
| `beforeEach(() => {})`             | `@pytest.fixture`                 | Setup each          |

### Type Conversions

```python
# TypeScript                     # Python
{ key: value }                   {"key": value}
camelCase                        snake_case
string | undefined               Optional[str]
number                           int or float
boolean                          bool
Array<T>                         List[T]
Record<K, V>                     Dict[K, V]
```

## Test Utilities Needed

### 1. Test Cleanup Helper

**Create: `cortex-sdk-python/tests/helpers/cleanup.py`**

```python
"""Test cleanup utilities."""

class TestCleanup:
    """Helper for cleaning up test data."""

    def __init__(self, cortex_client):
        self.cortex = cortex_client

    async def purge_conversations(self, memory_space_id: str = None):
        """Purge test conversations."""
        if memory_space_id:
            convos = await self.cortex.conversations.list(
                memory_space_id=memory_space_id, limit=1000
            )
            for conv in convos:
                await self.cortex.conversations.delete(conv.conversation_id)

    async def purge_memories(self, memory_space_id: str):
        """Purge test memories."""
        # Implementation

    async def purge_facts(self, memory_space_id: str):
        """Purge test facts."""
        # Implementation

    async def purge_all(self):
        """Purge all test data."""
        # Implementation
```

### 2. Embeddings Helper

**Create: `cortex-sdk-python/tests/helpers/embeddings.py`**

```python
"""Embedding generation for tests."""

from typing import Optional
import os

try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
except:
    openai_client = None

async def generate_embedding(text: str) -> Optional[list[float]]:
    """Generate embedding using OpenAI."""
    if not openai_client:
        return None

    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=1536
    )

    return response.data[0].embedding
```

### 3. Direct Storage Access

**Add to conftest.py:**

```python
@pytest.fixture
async def direct_convex_client(cortex_client):
    """Direct access to Convex for storage validation."""
    return cortex_client.client  # AsyncConvexClient wrapper
```

## Contribution Workflow

### For Each Test File

1. **Create Issue**: "Port {filename}.test.ts to Python"
2. **Create Branch**: `test/port-{module}-tests`
3. **Port Tests**: Translate test by test
4. **Run Tests**: `pytest tests/test_{module}.py -v`
5. **Document**: Note any API differences discovered
6. **PR**: Submit for review

### Pull Request Template

```markdown
## Test Port: {module}

Ports {X} tests from `tests/{module}.test.ts` to `tests/test_{module}.py`

### Tests Ported

- [ ] test_create_basic
- [ ] test_get_by_id
- [ ] test_list_with_filters
      ... (list all)

### Coverage

- TypeScript: X tests
- Python: Y tests
- Parity: Y/X (Z%)

### Notes

- Any API differences discovered
- Any test modifications needed
- Any Python-specific considerations

### Checklist

- [ ] All tests passing
- [ ] Storage validation included
- [ ] Error cases covered
- [ ] Documentation updated
```

## Tracking Progress

### Create: `dev-docs/test-parity-progress.md`

Track porting progress:

```markdown
# Test Parity Progress

## Summary

- Total TS Tests: 600
- Total Python Tests: 29
- Parity: 5%

## By Module

- ✅ test_00_basic.py: 5/5 (100%) - New
- ⏳ test_conversations.py: 6/45 (13%)
- ⏳ test_memory.py: 10/50 (20%)
- ⏳ test_users.py: 8/30 (27%)
- ❌ test_vector.py: 0/30 (0%)
- ❌ test_facts.py: 0/25 (0%)
  ...

## This Week's Goal

- [ ] Create test_vector.py (30 tests)
- [ ] Create test_facts.py (25 tests)
- [ ] Expand test_memory.py (+10 tests)
      Target: 94 tests (16% parity)
```

## Resources

- **TypeScript Tests**: `/Users/SaintNick/Documents/Cortex/Project-Cortex/tests/`
- **Python Tests**: `/Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python/tests/`
- **Test Helpers (TS)**: `tests/helpers/`
- **Test Helpers (Python)**: `cortex-sdk-python/tests/helpers/` (to create)

## Next Steps

1. **Create test_vector.py** - 30 tests from vector.test.ts
2. **Create test_facts.py** - 25 tests from facts.test.ts
3. **Create test_immutable.py** - 25 tests from immutable.test.ts
4. **Create test_mutable.py** - 20 tests from mutable.test.ts

These 4 files would bring us to **129/600 tests (22% parity)**.

---

**Priority**: High - Core API test coverage critical for confidence  
**Effort**: ~2-3 hours per test file for experienced contributor  
**Timeline**: 4 core files = 8-12 hours work
