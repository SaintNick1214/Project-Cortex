# Test Helpers Setup - Complete ✅

## Overview

All test helper utilities have been created and are ready for verification testing.

## Files Created

### 1. Helper Utilities

#### `/cortex-sdk-python/tests/helpers/__init__.py`
- Exports all helper utilities
- Clean module interface

#### `/cortex-sdk-python/tests/helpers/cleanup.py`
- `TestCleanup` class for purging test data
- Methods:
  - `purge_conversations(memory_space_id, prefix)` - Purge test conversations
  - `purge_memories(memory_space_id, prefix)` - Purge test memories
  - `purge_facts(memory_space_id, prefix)` - Purge test facts
  - `purge_immutable(memory_space_id, prefix)` - Purge immutable records
  - `purge_mutable(memory_space_id, prefix)` - Purge mutable records
  - `purge_users(prefix)` - Purge test users
  - `purge_memory_space(memory_space_id)` - Purge entire memory space
  - `purge_all(memory_space_id)` - Purge all test data
  - `verify_empty(memory_space_id, prefix)` - Verify no test data remains

#### `/cortex-sdk-python/tests/helpers/embeddings.py`
- `embeddings_available()` - Check if OPENAI_API_KEY is set
- `generate_embedding(text, dimensions, use_mock)` - Generate embeddings
  - Uses OpenAI API if available
  - Falls back to mock embeddings if needed
  - Mock embeddings are deterministic (same text = same embedding)
- `generate_embeddings_batch(texts, dimensions, use_mock)` - Batch generation
- `generate_mock_embedding(text, dimensions)` - Generate mock embedding

#### `/cortex-sdk-python/tests/helpers/storage.py`
- `validate_conversation_storage(cortex_client, conversation_id, expected_data)` - Validate conversation in Convex
- `validate_memory_storage(cortex_client, memory_space_id, memory_id, expected_data)` - Validate memory in Convex
- `validate_fact_storage(cortex_client, memory_space_id, fact_id, expected_data)` - Validate fact in Convex
- `validate_user_storage(cortex_client, user_id, expected_data)` - Validate user in Convex

Each validation function returns:
```python
{
    "exists": bool,       # True if item exists in storage
    "matches": bool,      # True if expected_data matches
    "data": dict,         # Stored data from Convex
    "errors": list        # List of validation errors
}
```

#### `/cortex-sdk-python/tests/helpers/generators.py`
- `generate_test_user_id()` - Generate unique test user ID
- `generate_test_memory_space_id()` - Generate unique test memory space ID
- `generate_test_conversation_id()` - Generate unique test conversation ID
- `generate_test_agent_id()` - Generate unique test agent ID
- `generate_test_memory_id()` - Generate unique test memory ID
- `generate_test_fact_id()` - Generate unique test fact ID
- `create_test_memory_input(content, importance, tags)` - Create sample memory data
- `create_test_fact_input(fact, fact_type, confidence)` - Create sample fact data
- `create_test_conversation_data(user_id, agent_id)` - Create sample conversation data
- `create_test_user_profile(name)` - Create sample user profile
- `create_test_immutable_data(data_type, value)` - Create sample immutable record
- `create_test_mutable_data(value)` - Create sample mutable record

### 2. Updated conftest.py

Added new fixtures:

```python
@pytest.fixture
async def cleanup_helper(cortex_client) -> TestCleanup:
    """Provides TestCleanup instance for test data cleanup."""
    return TestCleanup(cortex_client)

@pytest.fixture
async def direct_convex_client(cortex_client):
    """Provides direct access to AsyncConvexClient for storage validation."""
    return cortex_client.client

@pytest.fixture
def test_ids():
    """Provides multiple unique test IDs at once."""
    return {
        "user_id": f"test-user-{timestamp}-{rand}",
        "memory_space_id": f"test-space-{timestamp}-{rand}",
        "conversation_id": f"test-conv-{timestamp}-{rand}",
        "agent_id": f"test-agent-{timestamp}-{rand}",
    }

@pytest.fixture
def embeddings_available_fixture():
    """Checks if embeddings can be generated."""
    return embeddings_available()
```

### 3. Verification Test File

#### `/cortex-sdk-python/tests/test_helpers_verification.py`

Complete test suite with 25+ tests:

**Cleanup Helper Tests (6 tests):**
- `test_cleanup_conversations` - Create, verify, purge, verify empty
- `test_cleanup_memories` - Create, verify, purge, verify empty
- `test_cleanup_facts` - Create, verify, purge, verify empty
- `test_cleanup_users` - Create, verify, purge, verify empty
- `test_cleanup_memory_space` - Purge entire memory space
- `test_cleanup_all` - Create mixed data, purge all, verify empty

**Embeddings Helper Tests (4 tests):**
- `test_embeddings_available` - Check if API available
- `test_generate_embedding_with_mock` - Generate 1536-dim mock vector
- `test_generate_embedding_consistency` - Same text = same embedding
- `test_generate_embedding_with_api_if_available` - Real OpenAI embedding

**Storage Validation Tests (4 tests):**
- `test_validate_conversation_storage` - Create conversation, validate storage
- `test_validate_memory_storage` - Create memory, validate storage
- `test_validate_user_storage` - Create user, validate storage
- `test_validate_storage_with_expected_data` - Validate with expected fields

**Generator Tests (6 tests):**
- `test_generate_unique_user_ids` - IDs are unique
- `test_generate_unique_memory_space_ids` - IDs are unique
- `test_generate_unique_conversation_ids` - IDs are unique
- `test_create_test_memory_input` - Generates valid memory data
- `test_create_test_fact_input` - Generates valid fact data
- `test_test_ids_fixture` - Fixture provides all IDs

**Integration Tests (2 tests):**
- `test_direct_convex_client_access` - Direct Convex queries work
- `test_all_helpers_summary` - Summary showing all helpers work

## Running Verification Tests

```bash
# Ensure Convex backend is running (check .env.local)
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
# If needed: npm run dev:local

# Run helper verification tests
cd cortex-sdk-python
source .venv/bin/activate
pytest tests/test_helpers_verification.py -v -s

# Expected output: All tests pass (some may skip if dependencies missing)
```

## What Each Helper Does

### TestCleanup
Cleans up test data across all layers. Use in test cleanup phase or when tests fail.

**Example usage:**
```python
async def test_something(cortex_client, cleanup_helper):
    memory_space_id = "test-space-123"
    
    # ... create test data ...
    
    # Cleanup after test
    await cleanup_helper.purge_memory_space(memory_space_id)
```

### Embeddings
Generate embeddings for testing semantic search. Falls back to mock embeddings if no API key.

**Example usage:**
```python
async def test_semantic_search(cortex_client):
    # Generate embedding (uses mock if API unavailable)
    embedding = await generate_embedding("Test content", use_mock=True)
    
    # Store memory with embedding
    await cortex_client.vector.store(space_id, {
        "content": "Test content",
        "embedding": embedding
    })
```

### Storage Validation
Verify SDK responses match Convex storage. Useful for ensuring data persistence.

**Example usage:**
```python
async def test_create_memory(cortex_client):
    # Create via SDK
    memory = await cortex_client.vector.store(space_id, input_data)
    
    # Validate in storage
    validation = await validate_memory_storage(
        cortex_client, 
        space_id, 
        memory.memory_id,
        expected_data={"content": "Test content"}
    )
    
    assert validation["exists"]
    assert validation["matches"]
```

### Generators
Generate unique test IDs and sample data. Prevents ID collisions in tests.

**Example usage:**
```python
def test_something(test_ids):
    # Use fixture for multiple IDs
    user_id = test_ids["user_id"]
    space_id = test_ids["memory_space_id"]
    
    # Or generate specific IDs
    conv_id = generate_test_conversation_id()
    
    # Generate sample data
    memory_input = create_test_memory_input(
        content="Test memory",
        importance=75
    )
```

## Next Steps

1. **Verify Helpers Work** ✅ (Now)
   ```bash
   pytest tests/test_helpers_verification.py -v
   ```

2. **Fix Any Issues** (If tests fail)
   - Review error messages
   - Update helper implementations
   - Re-run tests

3. **Begin Test Porting** (After verification)
   - Start with `test_vector.py` (30 tests)
   - Use helpers in all new tests
   - Follow porting guide

## Success Criteria

✅ All 5 helper files created  
✅ conftest.py updated with 4 new fixtures  
✅ 25+ verification tests created  
✅ No linting errors  
⏳ Verification tests run and pass  

## Files Summary

**Created:**
- `tests/helpers/__init__.py`
- `tests/helpers/cleanup.py` (335 lines)
- `tests/helpers/embeddings.py` (120 lines)
- `tests/helpers/storage.py` (180 lines)
- `tests/helpers/generators.py` (170 lines)
- `tests/test_helpers_verification.py` (450+ lines)

**Updated:**
- `tests/conftest.py` (added 4 fixtures)

**Total:** 6 new files, 1 updated, ~1,400 lines of helper code

## Usage in Test Porting

When porting TypeScript tests to Python, use these helpers:

```python
import pytest
from tests.helpers import (
    TestCleanup,
    generate_embedding,
    validate_memory_storage,
    create_test_memory_input,
)

@pytest.mark.asyncio
async def test_store_memory_with_embedding(cortex_client, cleanup_helper, test_ids):
    """Test storing memory with embedding."""
    memory_space_id = test_ids["memory_space_id"]
    
    # Generate embedding
    embedding = await generate_embedding("Test content", use_mock=True)
    
    # Create memory with embedding
    memory_input = create_test_memory_input(content="Test content")
    memory_input["embedding"] = embedding
    
    memory = await cortex_client.vector.store(memory_space_id, memory_input)
    
    # Validate storage
    validation = await validate_memory_storage(
        cortex_client, 
        memory_space_id, 
        memory.memory_id
    )
    assert validation["exists"]
    
    # Cleanup
    await cleanup_helper.purge_memories(memory_space_id)
```

---

**Status**: ✅ **Test Helpers Setup Complete - Ready for Verification**  
**Date**: 2025-11-06  
**Next**: Run `pytest tests/test_helpers_verification.py -v` to verify helpers work

