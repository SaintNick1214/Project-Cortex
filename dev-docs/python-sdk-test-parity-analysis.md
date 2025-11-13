# Python SDK - Test Parity Analysis

> **Development Documentation** - Comparison with TypeScript SDK test suite

## Overview

The TypeScript SDK has **~600 tests** across 24 test files. The Python SDK currently has **29 tests** across 4 files.

**Current Parity**: ~5% of TypeScript test coverage

## TypeScript SDK Test Suite (Baseline)

### Test Files (24 files)

| Test File                             | Estimated Tests | Purpose                    | Python Equivalent           |
| ------------------------------------- | --------------- | -------------------------- | --------------------------- |
| **Core API Tests**                    |                 |                            |                             |
| `conversations.test.ts`               | ~45             | Layer 1a CRUD + validation | `test_conversations.py` (6) |
| `immutable.test.ts`                   | ~25             | Layer 1b versioned data    | **MISSING**                 |
| `mutable.test.ts`                     | ~20             | Layer 1c live data         | **MISSING**                 |
| `vector.test.ts`                      | ~30             | Layer 2 vector operations  | **MISSING**                 |
| `facts.test.ts`                       | ~25             | Layer 3 fact extraction    | **MISSING**                 |
| `memory.test.ts`                      | ~50             | Layer 4 convenience API    | `test_memory.py` (10)       |
| `contexts.test.ts`                    | ~35             | Context chains             | **MISSING**                 |
| `users.test.ts`                       | ~30             | User profiles + GDPR       | `test_users.py` (9)         |
| `agents.test.ts`                      | ~25             | Agent registry             | **MISSING**                 |
| `memorySpaces.test.ts`                | ~25             | Memory spaces              | **MISSING**                 |
| **Integration Tests**                 |                 |                            |                             |
| `integration.test.ts`                 | ~40             | Cross-layer integration    | **MISSING**                 |
| `crossLayerIntegrity.test.ts`         | ~30             | Data consistency           | **MISSING**                 |
| `memory-facts-integration.test.ts`    | ~20             | Memory + facts             | **MISSING**                 |
| `memory-auto-conversation.test.ts`    | ~15             | Auto conversation          | **MISSING**                 |
| `parameterPropagation.test.ts`        | ~15             | Parameter passing          | **MISSING**                 |
| **Mode Tests**                        |                 |                            |                             |
| `hiveMode.test.ts`                    | ~30             | Shared memory spaces       | **MISSING**                 |
| `collaborationMode.test.ts`           | ~25             | Separate spaces            | **MISSING**                 |
| **GDPR & Cascade**                    |                 |                            |                             |
| `gdprCascade.test.ts`                 | ~35             | GDPR cascade deletion      | **MISSING**                 |
| **Edge Cases**                        |                 |                            |                             |
| `edgeCases.test.ts`                   | ~25             | Edge conditions            | **MISSING**                 |
| `edge-runtime.test.ts`                | ~10             | Runtime edge cases         | **MISSING**                 |
| **Graph Integration**                 |                 |                            |                             |
| `graph/graphAdapter.test.ts`          | ~20             | Adapter tests              | **MISSING**                 |
| `graph/graphSyncWorker.test.ts`       | ~25             | Sync worker                | **MISSING**                 |
| `graph/end-to-end-multilayer.test.ts` | ~30             | Full graph integration     | **MISSING**                 |
| `graph/proofs/*.proof.ts`             | ~40             | Graph proofs (7 files)     | **MISSING**                 |
| **Debug/Helpers**                     |                 |                            |                             |
| `conversations.debug.test.ts`         | Debug           | Debug utilities            | N/A                         |
| **Basic Tests**                       |                 |                            |                             |
| (none in TS)                          | 0               | Basic connectivity         | `test_00_basic.py` (5)      |
| **TOTAL**                             | **~600**        |                            | **29**                      |

## Python SDK Current Tests (29 tests)

### test_00_basic.py (5 tests) ✅

**New for Python** - Not in TypeScript suite

1. test_environment_variables
2. test_imports
3. test_convex_client_import
4. test_cortex_initialization
5. test_convex_connection

### test_conversations.py (6 tests) ✅

Covers ~13% of `conversations.test.ts` (45 tests)

1. test_create_conversation
2. test_add_message
3. test_get_conversation
4. test_list_conversations
5. test_count_conversations
6. test_get_or_create

**Missing from TS:**

- Agent-agent conversations
- Message history pagination
- Conversation search
- Conversation export
- Delete operations
- Metadata validation
- participantId tracking
- Error handling tests
- ~39 more test cases

### test_memory.py (10 tests) ✅

Covers ~20% of `memory.test.ts` (50 tests)

1. test_remember_basic
2. test_remember_with_metadata
3. test_search
4. test_get_memory
5. test_get_with_enrichment
6. test_update_memory
7. test_delete_memory
8. test_forget_with_conversation
9. test_count_and_list
10. (streaming test removed)

**Missing from TS:**

- remember() with embeddings
- remember() with extraction
- remember() with fact extraction
- search() with embeddings (semantic)
- search() strategies (semantic/keyword/recent)
- Advanced filtering
- Versioning tests
- Archive operations
- Export operations
- updateMany/deleteMany
- ~40 more test cases

### test_users.py (9 tests) ✅

Covers ~30% of `users.test.ts` (30 tests)

1. test_create_user_profile
2. test_get_user_profile
3. test_update_user_profile
4. test_user_exists
5. test_get_or_create_user
6. test_merge_user_profile
7. test_delete_user_simple
8. test_delete_user_cascade_dry_run
9. test_count_users

**Missing from TS:**

- Full GDPR cascade deletion (all layers)
- Cascade verification
- Cascade rollback on failure
- Graph cascade deletion
- Search users
- List users (pagination)
- Update many users
- Delete many users
- Export users
- Version history
- Temporal queries (getAtTimestamp)
- ~21 more test cases

## Critical Test Gaps

### 1. Missing Test Files (20 files, ~571 tests)

**High Priority:**

- ❌ `test_immutable.py` - Layer 1b (25 tests needed)
- ❌ `test_mutable.py` - Layer 1c (20 tests needed)
- ❌ `test_vector.py` - Layer 2 (30 tests needed)
- ❌ `test_facts.py` - Layer 3 (25 tests needed)
- ❌ `test_contexts.py` - Context chains (35 tests needed)
- ❌ `test_agents.py` - Agent registry (25 tests needed)
- ❌ `test_memory_spaces.py` - Memory spaces (25 tests needed)

**Integration:**

- ❌ `test_integration.py` - Cross-layer (40 tests needed)
- ❌ `test_cross_layer_integrity.py` - Data consistency (30 tests needed)
- ❌ `test_memory_facts_integration.py` - Memory + facts (20 tests needed)
- ❌ `test_gdpr_cascade.py` - Full GDPR testing (35 tests needed)

**Modes:**

- ❌ `test_hive_mode.py` - Hive Mode (30 tests needed)
- ❌ `test_collaboration_mode.py` - Collaboration Mode (25 tests needed)

**Edge Cases:**

- ❌ `test_edge_cases.py` - Edge conditions (25 tests needed)
- ❌ `test_parameter_propagation.py` - Parameter passing (15 tests needed)

**Graph:**

- ❌ `test_graph/test_adapter.py` - Graph adapter (20 tests needed)
- ❌ `test_graph/test_sync_worker.py` - Sync worker (25 tests needed)
- ❌ `test_graph/test_end_to_end.py` - Full graph (30 tests needed)
- ❌ `test_graph/proofs/` - Graph proofs (40 tests needed)

### 2. Missing Test Coverage in Existing Files

**test_conversations.py** - Missing 39 tests:

- Agent-agent conversations (5 tests)
- Pagination (getHistory) (5 tests)
- Search conversations (5 tests)
- Export conversations (5 tests)
- Delete operations (5 tests)
- Error cases (5 tests)
- Metadata validation (5 tests)
- participantId tracking (4 tests)

**test_memory.py** - Missing 40 tests:

- Embedding generation (5 tests)
- Content extraction (5 tests)
- Fact extraction integration (5 tests)
- Semantic search (5 tests)
- Search strategies (5 tests)
- Versioning (5 tests)
- Archive/restore (3 tests)
- Export (3 tests)
- Bulk operations (4 tests)

**test_users.py** - Missing 21 tests:

- Full cascade deletion (5 tests)
- Cascade verification (3 tests)
- Cascade rollback (3 tests)
- Graph integration (3 tests)
- Bulk operations (3 tests)
- Version history (2 tests)
- Temporal queries (2 tests)

## Test Parity Roadmap

### Phase 1: Core API Coverage (Target: 200 tests)

**Priority 1 - Layer APIs (120 tests)**

1. Create `test_immutable.py` (25 tests)
   - store(), get(), get_version(), get_history()
   - get_at_timestamp(), list(), search(), count()
   - purge(), purge_many(), purge_versions()

2. Create `test_mutable.py` (20 tests)
   - set(), get(), update(), increment(), decrement()
   - get_record(), delete(), exists()
   - list(), count(), purge operations

3. Create `test_vector.py` (30 tests)
   - store(), get(), search(), update(), delete()
   - update_many(), delete_many(), count(), list()
   - archive(), get_version(), get_history(), get_at_timestamp()

4. Create `test_facts.py` (25 tests)
   - store(), get(), list(), search()
   - update(), delete(), count()
   - query_by_subject(), query_by_relationship()
   - get_history(), export(), consolidate()

5. Create `test_contexts.py` (20 tests)
   - create(), get(), update(), delete()
   - search(), list(), count()
   - get_chain(), get_root(), get_children()

**Priority 2 - Coordination APIs (80 tests)** 6. Create `test_agents.py` (20 tests) 7. Create `test_memory_spaces.py` (20 tests) 8. Expand `test_conversations.py` (+20 tests) 9. Expand `test_memory.py` (+20 tests)

### Phase 2: Integration Testing (Target: +150 tests)

**Cross-Layer (70 tests)**

1. Create `test_integration.py` (40 tests)
   - Remember → ACID + Vector linked
   - Forget → Both layers deleted
   - CRUD across layers
   - Reference integrity

2. Create `test_cross_layer_integrity.py` (30 tests)
   - conversationRef validation
   - Orphan detection
   - Data consistency

**Memory + Facts (40 tests)** 3. Create `test_memory_facts_integration.py` (20 tests) 4. Create `test_parameter_propagation.py` (15 tests) 5. Add auto-conversation tests (5 tests)

**GDPR & Cascade (40 tests)** 6. Create `test_gdpr_cascade.py` (35 tests)

- Cascade across all layers
- Verification
- Rollback on failure
- Graph integration

7. Expand `test_users.py` (+5 cascade tests)

### Phase 3: Modes & Edge Cases (Target: +100 tests)

**Modes (55 tests)**

1. Create `test_hive_mode.py` (30 tests)
   - participantId tracking
   - Multiple tools sharing space
   - Participant statistics

2. Create `test_collaboration_mode.py` (25 tests)
   - Separate memory spaces
   - Cross-space references
   - Context chains across spaces

**Edge Cases (45 tests)** 3. Create `test_edge_cases.py` (25 tests)

- Large payloads
- Empty values
- Unicode handling
- Concurrent operations
- Error conditions

4. Create `test_edge_runtime.py` (10 tests)
5. Add more edge cases to existing tests (10 tests)

### Phase 4: Graph Testing (Target: +115 tests)

**Graph Integration (115 tests)**

1. Create `test_graph/test_adapter.py` (20 tests)
   - connect(), disconnect()
   - create_node(), update_node(), delete_node()
   - create_edge(), delete_edge()
   - query(), find_nodes()
   - traverse(), find_path()

2. Create `test_graph/test_sync_worker.py` (25 tests)
   - Worker lifecycle
   - Reactive sync
   - Batch processing
   - Error handling

3. Create `test_graph/test_end_to_end.py` (30 tests)
   - Full sync workflow
   - Multi-hop queries
   - Orphan detection
   - Entity extraction

4. Create `test_graph/proofs/` (40 tests)
   - Basic CRUD proof
   - Sync workflow proof
   - Context chains proof
   - Agent network proof
   - Fact graph proof
   - Performance proof
   - Multi-layer retrieval proof

## Test Pattern Template

### TypeScript Pattern

```typescript
describe("API Module", () => {
  beforeAll(async () => {
    // Setup
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);
    await cleanup.purgeAll();
  });

  describe("method()", () => {
    it("should do something", async () => {
      // Arrange
      const input = {...};

      // Act
      const result = await cortex.api.method(input);

      // Assert - SDK response
      expect(result.field).toBe(expected);

      // Assert - Convex storage validation
      const stored = await client.query(api.table.get, {id: result.id});
      expect(stored).not.toBeNull();
      expect(stored.field).toBe(expected);
    });
  });
});
```

### Python Pattern

```python
@pytest.mark.asyncio
async def test_method_basic(cortex_client, test_ids):
    """Test basic method operation."""
    # Arrange
    input = {...}

    # Act
    result = await cortex_client.api.method(input)

    # Assert
    assert result.field == expected

    # TODO: Add Convex storage validation
    # (requires direct Convex client access)
```

## Key Differences to Port

### 1. Storage Validation

**TypeScript:**

```typescript
// Validates against Convex storage directly
const stored = await client.query(api.conversations.get, {
  conversationId: result.conversationId,
});
expect(stored._id).toBeDefined();
```

**Python Needed:**

```python
# Need direct Convex client access in tests
stored = await cortex_client.client.query("conversations:get", {
    "conversationId": result.conversation_id
})
assert stored["_id"] is not None
```

### 2. Test Cleanup

**TypeScript:**

```typescript
beforeAll(async () => {
  cleanup = new TestCleanup(client);
  await cleanup.purgeConversations();
  await cleanup.purgeMemories();
  await cleanup.purgeFacts();
});
```

**Python Needed:**

```python
@pytest.fixture
async def cleanup_helper(cortex_client):
    """Cleanup helper for tests."""
    # Before tests
    # Purge existing test data

    yield

    # After tests
    # Clean up created test data
```

### 3. Graph Testing

**TypeScript:**

```typescript
if (graphAdapter) {
  const nodes = await graphAdapter.find_nodes("Memory", {
    memoryId: result.memoryId,
  });
  expect(nodes).toHaveLength(1);
}
```

**Python Needed:**

```python
@pytest.mark.graph
@pytest.mark.asyncio
async def test_with_graph(cortex_with_graph):
    """Test with graph integration."""
    if cortex_with_graph.graph_adapter:
        nodes = await cortex_with_graph.graph_adapter.find_nodes(
            "Memory", {"memoryId": result.memory_id}
        )
        assert len(nodes) == 1
```

## Detailed Gap Analysis

### Layer 1a: Conversations

**TypeScript has 45 tests, Python has 6**

Missing tests (39):

- ✅ create() user-agent
- ✅ create() agent-agent
- ⏳ create() with metadata validation
- ⏳ create() error cases (invalid participants)
- ✅ get()
- ⏳ get() not found
- ✅ addMessage()
- ⏳ addMessage() with participantId
- ⏳ addMessage() validation
- ⏳ getHistory() basic
- ⏳ getHistory() pagination
- ⏳ getHistory() sorting
- ⏳ getMessage()
- ⏳ getMessagesByIds()
- ⏳ findConversation()
- ✅ getOrCreate()
- ✅ list()
- ⏳ list() with filters
- ✅ count()
- ⏳ count() with filters
- ⏳ search()
- ⏳ export() JSON
- ⏳ export() CSV
- ⏳ delete()
- ⏳ deleteMany()
- ⏳ Storage validation for each operation
- ⏳ ~14 more test cases

### Layer 2: Vector

**TypeScript has 30 tests, Python has 0**

Missing tests (30):

- ⏳ store() basic
- ⏳ store() with embedding
- ⏳ store() with conversationRef
- ⏳ store() with immutableRef
- ⏳ store() with mutableRef
- ⏳ get()
- ⏳ search() keyword
- ⏳ search() semantic (with embeddings)
- ⏳ search() with filters
- ⏳ update()
- ⏳ update() creates version
- ⏳ delete()
- ⏳ updateMany()
- ⏳ deleteMany()
- ⏳ count()
- ⏳ list()
- ⏳ export()
- ⏳ archive()
- ⏳ getVersion()
- ⏳ getHistory()
- ⏳ getAtTimestamp()
- ⏳ Versioning tests (5)
- ⏳ Storage validation
- ⏳ ~7 more test cases

### Layer 3: Facts

**TypeScript has 25 tests, Python has 0**

All missing - need to create complete test file.

### Layer 4: Contexts

**TypeScript has 35 tests, Python has 0**

All missing - need to create complete test file.

### Integration Tests

**TypeScript has ~90 tests, Python has 0**

Critical missing:

- ⏳ crossLayerIntegrity (30 tests)
- ⏳ integration (40 tests)
- ⏳ memory-facts-integration (20 tests)

### GDPR Cascade

**TypeScript has 35 tests, Python has 2**

Missing (33):

- ⏳ Full cascade all layers
- ⏳ Cascade verification
- ⏳ Cascade rollback
- ⏳ Graph cascade
- ⏳ Collection phase tests
- ⏳ Backup phase tests
- ⏳ Execution phase tests
- ⏳ ~26 more test cases

### Graph Tests

**TypeScript has ~115 tests, Python has 0**

All missing - need complete graph test suite.

## Test Creation Priority

### Immediate (Week 1) - Target: +150 tests

1. **test_vector.py** (30 tests) - Core layer missing
2. **test_facts.py** (25 tests) - Core layer missing
3. **test_immutable.py** (25 tests) - Core layer missing
4. **test_mutable.py** (20 tests) - Core layer missing
5. **test_contexts.py** (25 tests) - Coordination layer
6. **test_agents.py** (25 tests) - Coordination layer

### Short-term (Week 2-3) - Target: +150 tests

7. **test_memory_spaces.py** (25 tests)
8. **Expand test_conversations.py** (+20 tests)
9. **Expand test_memory.py** (+20 tests)
10. **Expand test_users.py** (+10 tests)
11. **test_integration.py** (40 tests)
12. **test_cross_layer_integrity.py** (30 tests)
13. **test_memory_facts_integration.py** (20 tests)

### Medium-term (Week 4-6) - Target: +150 tests

14. **test_gdpr_cascade.py** (35 tests)
15. **test_hive_mode.py** (30 tests)
16. **test_collaboration_mode.py** (25 tests)
17. **test_edge_cases.py** (25 tests)
18. **test_parameter_propagation.py** (15 tests)
19. **test_a2a.py** (20 tests)

### Long-term (Week 7-8) - Target: +115 tests

20. **test_graph/** suite (115 tests)
    - test_adapter.py (20)
    - test_sync_worker.py (25)
    - test_end_to_end.py (30)
    - proofs/ (40)

## Test File Template

Create `cortex-sdk-python/tests/TEST_TEMPLATE.md`:

```python
"""
Tests for {Module} API

Port of {module}.test.ts from TypeScript SDK
"""

import pytest
from cortex import Cortex, CortexConfig, {Types}

# Test data
TEST_MEMSPACE_ID = "test-space-{module}"
TEST_USER_ID = "test-user-{module}"

@pytest.fixture
async def setup_{module}(cortex_client):
    """Setup for {module} tests."""
    # Pre-test setup
    yield cortex_client
    # Post-test cleanup

@pytest.mark.asyncio
async def test_{operation}_basic(cortex_client, test_ids):
    """
    Test basic {operation} operation.

    Port of: {module}.test.ts - line XXX
    """
    # Arrange
    input_data = {...}

    # Act
    result = await cortex_client.{module}.{operation}(input_data)

    # Assert
    assert result.field == expected

    # TODO: Add storage validation
```

## Resources for Porting

### TypeScript Test Utilities to Port

1. **TestCleanup** (`tests/helpers/cleanup.ts`)
   - purgeConversations()
   - purgeMemories()
   - purgeFacts()
   - purgeAll()
   - verifyEmpty() methods

2. **Debug Helpers** (`tests/helpers/debug.ts`)
   - inspectConversation()
   - inspectMemory()
   - inspectFact()

3. **Test Fixtures**
   - Standard test data generators
   - OpenAI integration for embeddings
   - Graph setup/teardown

### Coverage Target

| Phase    | Tests   | Coverage | Timeline    |
| -------- | ------- | -------- | ----------- |
| Current  | 29      | 5%       | ✅ Done     |
| Phase 1  | 179     | 30%      | Week 1      |
| Phase 2  | 329     | 55%      | Week 2-3    |
| Phase 3  | 479     | 80%      | Week 4-6    |
| Phase 4  | 594     | 99%      | Week 7-8    |
| **Goal** | **600** | **100%** | **8 weeks** |

## Quick Start for Contributors

### 1. Pick a Test File to Port

Start with: `tests/vector.test.ts` (30 tests, well-structured)

### 2. Create Python File

```bash
cd cortex-sdk-python/tests
cp test_memory.py test_vector.py  # Use as template
```

### 3. Port Tests One by One

For each `it("test name")` in TypeScript:

1. Create `async def test_name()` in Python
2. Translate assertions (expect → assert)
3. Convert types (camelCase → snake_case)
4. Run test: `pytest tests/test_vector.py::test_name -v`

### 4. Submit PR

Once file is complete with tests passing!

## Current Status

✅ **Infrastructure**: Complete  
✅ **Basic Tests**: 29/29 passing  
⏳ **Core API Tests**: 29/600 (5%)  
⏳ **Integration Tests**: 0/90 (0%)  
⏳ **Graph Tests**: 0/115 (0%)

**Next Priority**: Create `test_vector.py` with 30 tests (would bring us to 59/600 = 10%)

---

**Last Updated**: 2025-11-06  
**Status**: Test infrastructure complete, needs test porting  
**Estimated Effort**: 8 weeks for full parity (1 person)
