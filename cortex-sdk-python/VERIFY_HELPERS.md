# Test Helpers - Verification Instructions

## ✅ All Test Helpers Have Been Created

All test helper utilities are ready for verification. Run the tests to ensure they work correctly.

## Quick Start - Run Verification Tests

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python
source .venv/bin/activate
pytest tests/test_helpers_verification.py -v -s
```

## What Was Created

### Helper Modules (5 files)
- ✅ `tests/helpers/__init__.py` - Module exports
- ✅ `tests/helpers/cleanup.py` - TestCleanup class (335 lines)
- ✅ `tests/helpers/embeddings.py` - Embedding generation (120 lines)
- ✅ `tests/helpers/storage.py` - Storage validation (180 lines)
- ✅ `tests/helpers/generators.py` - Data generators (170 lines)

### Tests & Fixtures
- ✅ `tests/test_helpers_verification.py` - 25+ verification tests (450+ lines)
- ✅ `tests/conftest.py` - Added 4 new fixtures

### Total: ~1,500 lines of helper code

## Run All Verification Tests

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex/cortex-sdk-python
source .venv/bin/activate
pytest tests/test_helpers_verification.py -v -s
```

Expected: 20-25 tests pass (some may skip if dependencies missing)

## Run Individual Test Categories

### Test Cleanup Helpers
```bash
source .venv/bin/activate && pytest tests/test_helpers_verification.py -k "cleanup" -v
```

### Test Embeddings Helpers
```bash
source .venv/bin/activate && pytest tests/test_helpers_verification.py -k "embedding" -v
```

### Test Storage Validation
```bash
source .venv/bin/activate && pytest tests/test_helpers_verification.py -k "storage" -v
```

### Test Generators
```bash
source .venv/bin/activate && pytest tests/test_helpers_verification.py -k "generate" -v
```

### Test Summary
```bash
source .venv/bin/activate && pytest tests/test_helpers_verification.py::test_all_helpers_summary -v -s
```

## Expected Results

### Should Pass (20-23 tests)
- ✅ All cleanup tests (6 tests)
- ✅ All generator tests (6 tests)
- ✅ All storage validation tests (4 tests)
- ✅ Mock embedding tests (3 tests)
- ✅ Direct Convex client test
- ✅ Summary test

### May Skip (2-5 tests)
- ⏩ Real OpenAI embedding test (if no OPENAI_API_KEY)
- ⏩ Facts cleanup test (if facts API not fully implemented)

## Test Output Example

```
tests/test_helpers_verification.py::test_cleanup_conversations PASSED
tests/test_helpers_verification.py::test_cleanup_memories PASSED
tests/test_helpers_verification.py::test_cleanup_facts SKIPPED (Facts API not fully implemented)
tests/test_helpers_verification.py::test_cleanup_users PASSED
tests/test_helpers_verification.py::test_cleanup_memory_space PASSED
tests/test_helpers_verification.py::test_cleanup_all PASSED
tests/test_helpers_verification.py::test_embeddings_available PASSED
tests/test_helpers_verification.py::test_generate_embedding_with_mock PASSED
tests/test_helpers_verification.py::test_generate_embedding_consistency PASSED
tests/test_helpers_verification.py::test_generate_embedding_with_api_if_available SKIPPED (OPENAI_API_KEY not set)
tests/test_helpers_verification.py::test_validate_conversation_storage PASSED
tests/test_helpers_verification.py::test_validate_memory_storage PASSED
tests/test_helpers_verification.py::test_validate_user_storage PASSED
tests/test_helpers_verification.py::test_validate_storage_with_expected_data PASSED
tests/test_helpers_verification.py::test_generate_unique_user_ids PASSED
tests/test_helpers_verification.py::test_generate_unique_memory_space_ids PASSED
tests/test_helpers_verification.py::test_generate_unique_conversation_ids PASSED
tests/test_helpers_verification.py::test_create_test_memory_input PASSED
tests/test_helpers_verification.py::test_create_test_fact_input PASSED
tests/test_helpers_verification.py::test_test_ids_fixture PASSED
tests/test_helpers_verification.py::test_direct_convex_client_access PASSED
tests/test_helpers_verification.py::test_all_helpers_summary PASSED

===================== 22 passed, 3 skipped =====================
```

## Troubleshooting

### Issue: CONVEX_URL not set
```bash
# Check .env.local exists
ls ../.env.local

# Check CONVEX_URL is set
cat ../.env.local | grep CONVEX_URL
```

### Issue: Convex backend not running
```bash
# Start Convex in another terminal
cd /Users/SaintNick/Documents/Cortex/Project-Cortex
npm run dev:local
```

### Issue: Import errors
```bash
# Reinstall dependencies
source .venv/bin/activate
pip install -e ".[dev]"
```

## Quick Test - Single Helper

Test just the cleanup helper:
```bash
source .venv/bin/activate && pytest tests/test_helpers_verification.py::test_cleanup_conversations -v -s
```

Test just the generators:
```bash
source .venv/bin/activate && pytest tests/test_helpers_verification.py::test_generate_unique_user_ids -v -s
```

## Fixtures Available

After verification passes, these fixtures are available in all tests:

```python
@pytest.mark.asyncio
async def test_something(cortex_client, cleanup_helper, test_ids):
    # cleanup_helper - TestCleanup instance
    # test_ids - Dict with user_id, memory_space_id, conversation_id, agent_id
    pass
```

## Next Steps After Verification

Once tests pass:

1. ✅ Helpers are verified and working
2. Begin porting ~571 TypeScript tests to Python
3. Start with core API tests:
   - `test_vector.py` (30 tests)
   - `test_facts.py` (25 tests)
   - `test_immutable.py` (25 tests)
   - `test_mutable.py` (20 tests)

## Documentation

Full guides:
- `dev-docs/test-helpers-setup-complete.md` - Complete setup guide
- `dev-docs/test-helpers-implementation-summary.md` - Implementation details
- `dev-docs/HELPER_VERIFICATION_README.md` - Quick reference

---

**Action Required**: Run `source .venv/bin/activate && pytest tests/test_helpers_verification.py -v -s`

