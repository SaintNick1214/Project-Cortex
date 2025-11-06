# Test Helpers - Verification Instructions

## ✅ All Helper Utilities Created Successfully

All test helper utilities have been implemented and are ready for verification.

## What Was Created

### Helper Modules (5 files)

1. **`tests/helpers/__init__.py`** - Module exports
2. **`tests/helpers/cleanup.py`** - TestCleanup class (335 lines)
3. **`tests/helpers/embeddings.py`** - Embedding generation (120 lines)
4. **`tests/helpers/storage.py`** - Storage validation (180 lines)
5. **`tests/helpers/generators.py`** - Data generators (170 lines)

### Test Files

6. **`tests/test_helpers_verification.py`** - 25+ verification tests (450+ lines)

### Updated Files

7. **`tests/conftest.py`** - Added 4 new fixtures

### Scripts

8. **`run-helper-tests.sh`** - Quick test runner script

## How to Verify Helpers Work

### Option 1: Run the Script (Easiest)

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python
./run-helper-tests.sh
```

### Option 2: Manual Command

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python
source .venv/bin/activate
pytest tests/test_helpers_verification.py -v -s
```

### Option 3: Run in Background

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python
source .venv/bin/activate
pytest tests/test_helpers_verification.py -v > helper-test-results.txt 2>&1
cat helper-test-results.txt
```

## Expected Results

**Total Tests**: 25+ tests  
**Expected**: Most tests pass (some may skip if dependencies missing)

### Tests That Should Pass

✅ All cleanup helper tests (6 tests)  
✅ All generator tests (6 tests)  
✅ All storage validation tests (4 tests)  
✅ Mock embedding tests (3 tests)  
✅ Direct Convex client test (1 test)  
✅ Summary test (1 test)

### Tests That May Skip

⏩ `test_generate_embedding_with_api_if_available` - Skips if no OPENAI_API_KEY  
⏩ `test_cleanup_facts` - May skip if facts API not fully implemented

## Quick Functionality Check

### Test Individual Helpers

**Test cleanup helper:**
```bash
pytest tests/test_helpers_verification.py::test_cleanup_conversations -v -s
```

**Test embeddings helper:**
```bash
pytest tests/test_helpers_verification.py::test_generate_embedding_with_mock -v -s
```

**Test storage validation:**
```bash
pytest tests/test_helpers_verification.py::test_validate_conversation_storage -v -s
```

**Test generators:**
```bash
pytest tests/test_helpers_verification.py::test_generate_unique_user_ids -v
```

## What Each Helper Does

### 1. TestCleanup (`cleanup.py`)

**Purpose**: Clean up test data after tests run

**Key Methods:**
- `purge_conversations(memory_space_id)` - Remove test conversations
- `purge_memories(memory_space_id)` - Remove test memories
- `purge_facts(memory_space_id)` - Remove test facts
- `purge_users()` - Remove test users
- `purge_all()` - Remove all test data

**Usage:**
```python
async def test_something(cortex_client, cleanup_helper):
    # ... test code ...
    await cleanup_helper.purge_all()
```

### 2. Embeddings (`embeddings.py`)

**Purpose**: Generate embeddings for testing semantic search

**Key Functions:**
- `embeddings_available()` - Check if OpenAI API available
- `generate_embedding(text, use_mock=True)` - Generate embedding vector
- `generate_mock_embedding(text)` - Deterministic mock embeddings

**Usage:**
```python
async def test_with_embeddings():
    embedding = await generate_embedding("test", use_mock=True)
    # Returns 1536-dimensional vector
```

### 3. Storage Validation (`storage.py`)

**Purpose**: Verify SDK responses match Convex storage

**Key Functions:**
- `validate_conversation_storage(client, conv_id, expected_data)`
- `validate_memory_storage(client, space_id, mem_id, expected_data)`
- `validate_fact_storage(client, space_id, fact_id, expected_data)`
- `validate_user_storage(client, user_id, expected_data)`

**Usage:**
```python
async def test_create(cortex_client):
    conv = await cortex_client.conversations.create(...)
    
    validation = await validate_conversation_storage(
        cortex_client, conv.conversation_id
    )
    assert validation["exists"]
```

### 4. Generators (`generators.py`)

**Purpose**: Generate unique test IDs and sample data

**Key Functions:**
- `generate_test_user_id()` - Unique user ID
- `generate_test_memory_space_id()` - Unique space ID
- `generate_test_conversation_id()` - Unique conversation ID
- `create_test_memory_input()` - Sample memory data
- `create_test_fact_input()` - Sample fact data

**Usage:**
```python
def test_something(test_ids):
    user_id = test_ids["user_id"]  # From fixture
    # Or generate specific ID
    conv_id = generate_test_conversation_id()
```

## Fixtures Available in conftest.py

### cleanup_helper
```python
async def test_something(cortex_client, cleanup_helper):
    # cleanup_helper is TestCleanup instance
    await cleanup_helper.purge_all()
```

### direct_convex_client
```python
async def test_something(cortex_client, direct_convex_client):
    # Query Convex storage directly
    stored = await direct_convex_client.query("conversations:get", {...})
```

### test_ids
```python
def test_something(test_ids):
    # test_ids is dict with:
    # - user_id
    # - memory_space_id
    # - conversation_id
    # - agent_id
```

### embeddings_available_fixture
```python
def test_something(embeddings_available_fixture):
    if embeddings_available_fixture:
        # Use real OpenAI embeddings
    else:
        # Use mock embeddings
```

## Common Issues & Solutions

### Issue: Import errors for helpers

**Solution**: Make sure you're in the project directory and venv is activated
```bash
cd cortex-sdk-python
source .venv/bin/activate
```

### Issue: CONVEX_URL not set

**Solution**: Make sure `.env.local` exists in project root
```bash
ls ../../../.env.local  # From cortex-sdk-python directory
```

### Issue: Tests fail with connection errors

**Solution**: Make sure Convex backend is running
```bash
# In another terminal
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
npm run dev:local
```

### Issue: Some tests skip

**Solution**: This is expected if:
- OPENAI_API_KEY not set (embeddings tests skip)
- Facts API not fully implemented (facts cleanup skips)

## Next Steps After Verification

Once helpers are verified (tests pass):

1. **Begin Test Porting**
   - Start with core API tests (vector, facts, immutable, mutable)
   - Use helpers in all new tests
   - Follow the test porting guide

2. **Create Test Files**
   - `test_vector.py` (30 tests)
   - `test_facts.py` (25 tests)
   - `test_immutable.py` (25 tests)
   - `test_mutable.py` (20 tests)

3. **Port TypeScript Tests**
   - Translate assertions (expect → assert)
   - Use helper utilities for cleanup and validation
   - Add storage validation to all tests

## Files Location

All helper files are in:
```
/Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python/tests/helpers/
```

Verification tests:
```
/Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python/tests/test_helpers_verification.py
```

## Documentation

Full documentation:
- `/dev-docs/test-helpers-setup-complete.md` - Complete setup guide
- `/dev-docs/python-sdk-test-porting-guide.md` - Test porting instructions
- `/dev-docs/python-sdk-test-parity-analysis.md` - Test gap analysis

---

**Status**: ✅ **All Helpers Created - Ready for Verification**  
**Date**: 2025-11-06  
**Action**: Run `./run-helper-tests.sh` to verify helpers work  
**Next**: Begin porting ~571 tests from TypeScript to Python

