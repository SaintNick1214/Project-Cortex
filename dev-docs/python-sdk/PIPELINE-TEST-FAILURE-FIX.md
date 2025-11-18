# Pipeline Test Failure Analysis & Fix

## Issue Summary

The Python SDK test suite was experiencing failures in the CI/CD pipeline that did **NOT** occur when testing locally or in managed Convex. The failures were specific to OpenAI integration tests in `test_memory_openai.py`.

### Failing Tests

1. `test_openai_stores_multiple_facts_with_real_embeddings` - Embeddings were None
2. `test_openai_recalls_facts_using_semantic_search` - Wrong search results returned
3. `test_openai_validates_summarization_quality` - content_type was "raw" instead of "summarized"
4. `test_openai_similarity_scores_are_realistic` - No similarity scores present

## Root Cause Analysis

The root cause was **missing `openai` package in the pipeline environment**:

### The Core Issue

1. **Package Not Installed**: The `openai>=1.0` package was missing from `pyproject.toml` dev dependencies
2. **Silent Import Failure**: When importing `openai` failed, the code caught `ImportError` and returned `None` silently
3. **Pipeline Used pyproject.toml**: GitHub workflow runs `pip install -e ".[dev]"` which reads from `pyproject.toml`, not `requirements-dev.txt`
4. **Tests Only Checked API Key**: Tests verified `OPENAI_API_KEY` was set but didn't validate the package was installed

### Why It Worked Locally But Failed in Pipeline

- **Local environment**: Developers had manually installed `openai` via `pip install -r requirements-dev.txt` or `pip install openai`
- **Pipeline environment**: Only installed packages from `pyproject.toml` dev section, which was missing `openai`
- **TypeScript tests**: Worked fine because `package.json` properly declared all dependencies

### Evidence

**Discrepancy between dependency files:**
- ✅ `requirements-dev.txt` included `openai>=1.0` (line 24)
- ❌ `pyproject.toml` dev section was missing `openai`
- ✅ GitHub workflow used `pyproject.toml`: `pip install -e ".[dev]"`

**Why this explains all symptoms:**
- ❌ No embeddings generated → `ImportError` caught → returned `None`
- ❌ No summarization → `ImportError` caught → returned `None`  
- ❌ No vector search → No embeddings stored → search failed
- ❌ No similarity scores → No embeddings → no vector search results

## Changes Made

### 1. **CRITICAL FIX**: Added `openai` to dev dependencies (`pyproject.toml`)

```python
dev = [
    # ... other dependencies ...
    "openai>=1.0",  # Required for OpenAI integration tests
]
```

This ensures the package is installed when running `pip install -e ".[dev]"` in the pipeline.

### 2. Enhanced OpenAI Error Handling (`tests/helpers/embeddings.py`)

These changes provide **resilience** for when API calls actually fail (not just package missing):

#### `generate_embedding()` improvements:
- ✅ Added `max_retries` parameter (default: 3 attempts)
- ✅ Exponential backoff on retryable errors (1s, 2s, 4s)
- ✅ Better error logging with attempt numbers and error messages
- ✅ Explicit "openai package not installed" message on ImportError
- ✅ Detect retryable errors (rate limits, timeouts, 5xx errors)
- ✅ Increased timeout to 30 seconds
- ✅ Used async `asyncio.sleep()` instead of blocking `time.sleep()`

#### `summarize_conversation()` improvements:
- ✅ Added `max_retries` parameter (default: 3 attempts)
- ✅ Exponential backoff on retryable errors
- ✅ Better error logging with attempt numbers
- ✅ Explicit "openai package not installed" message on ImportError
- ✅ Increased timeout to 30 seconds
- ✅ Used async `asyncio.sleep()`

### 3. Enhanced Test Diagnostics (`tests/test_memory_openai.py`)

Added detailed error messages when assertions fail to help diagnose issues:

- ✅ Show WHY embeddings are None (OpenAI API call failed)
- ✅ Show WHY content_type is "raw" (summarization failed)
- ✅ Show WHY similarity scores are missing (vector search not working)
- ✅ Display actual values and expected values for easier debugging

## Expected Behavior After Fix

### With Package Installed (Primary Fix)
```
[openai package now installs correctly]
✅ All OpenAI integration tests pass
✅ Embeddings generated successfully
✅ Summarization works correctly
✅ Vector search returns proper results with scores
```

### On Success
- Tests will pass as before
- No warning messages (package installed, API works)
- Occasional retries may be logged if API has transient issues

### On Transient API Failures (Secondary Protection)
```
Warning: OpenAI embedding generation failed (attempt 1/3): rate limit exceeded
  Retrying in 1s...
Warning: OpenAI embedding generation failed (attempt 2/3): rate limit exceeded
  Retrying in 2s...
[Success on attempt 3]
```

### On Persistent Failures
```
Warning: OpenAI embedding generation failed (attempt 1/3): invalid API key
Error: OpenAI embedding generation failed after 3 attempts

❌ ERROR: Embedding is None for fact 'user-name'
   Content: My name is Alexander Johnson and I prefer t...
   Content type: raw
   This suggests OpenAI API call failed during embedding generation
AssertionError: Embedding is None for fact 'user-name' - OpenAI API call likely failed
```

## Prevention Strategy

### For Future Tests
1. **Always validate external API success** before asserting on results
2. **Add retry logic** for any external API calls
3. **Use exponential backoff** to handle rate limiting
4. **Log detailed diagnostics** on failures
5. **Consider mock fallbacks** for critical tests

### For OpenAI Integration
- Use `max_retries` parameter in production code as well
- Consider caching embeddings to reduce API calls
- Monitor OpenAI API status in CI/CD
- Add circuit breaker pattern for repeated failures

## Testing the Fix

### Local Testing
```bash
cd cortex-sdk-python
pytest tests/test_memory_openai.py -v
```

### Pipeline Testing
The next pipeline run will show:
- Retry attempts in logs (if transient failures occur)
- Better error messages (if persistent failures occur)
- Successful completion (if OpenAI API is healthy)

## Monitoring

Watch for these patterns in pipeline logs:

**Good signs:**
- ✅ All tests pass without retries
- ✅ Occasional retries that succeed

**Warning signs:**
- ⚠️ Multiple retries across many tests (rate limiting)
- ⚠️ Retries on every test (network issues)

**Critical issues:**
- ❌ All retries exhausted (API down or credentials invalid)
- ❌ Consistent failures on specific operations

## Related Files

- `cortex-sdk-python/tests/helpers/embeddings.py` - OpenAI helper functions
- `cortex-sdk-python/tests/test_memory_openai.py` - OpenAI integration tests
- `.github/workflows/test-python.yml` - Pipeline configuration

## Additional Notes

### Why Not Use Mock Embeddings in Tests?

These are **integration tests** that validate:
1. Real OpenAI API integration works
2. Embeddings are properly stored in Convex
3. Vector search works with real embeddings
4. Summarization quality is acceptable

Using mocks would defeat the purpose of these tests. However, the `generate_mock_embedding()` function is available as a fallback for development environments without API access.

### Rate Limiting Considerations

If pipeline consistently hits rate limits, consider:
- Reducing number of test iterations
- Running tests sequentially instead of parallel
- Using OpenAI API tier with higher limits
- Caching embeddings between test runs

## Discovery Process

### How We Found the Real Issue

**Initial hypothesis:** Rate limiting or network issues in pipeline
- ❌ Ruled out: TypeScript SDK tests passed in same pipeline

**Second hypothesis:** Timing issues with managed Convex
- ❌ Ruled out: Managed tests worked fine locally

**Key insight:** Language-specific difference
- ✅ Python-specific issue in GitHub Actions environment
- ✅ Checked dependency installation process
- ✅ Found discrepancy: `pyproject.toml` vs `requirements-dev.txt`

**Root cause confirmed:**
```python
# requirements-dev.txt (not used by pipeline)
openai>=1.0  ✅

# pyproject.toml dev dependencies (used by pipeline)
# Missing openai!  ❌
```

### Lesson Learned

When debugging environment-specific failures:
1. Compare what works vs what doesn't (TypeScript vs Python)
2. Look for environment-specific differences (local vs pipeline)
3. Verify **all** dependencies are actually installed
4. Check which dependency file the environment actually uses

## Conclusion

The **critical fix** was adding `openai>=1.0` to `pyproject.toml` dev dependencies. This ensures the package is installed in the pipeline.

The **additional improvements** add resilience by:
1. Handling transient API failures gracefully with retries
2. Providing clear diagnostics when failures occur (especially "package not installed")
3. Maintaining test quality without compromising on validation

This resolves the pipeline failures while improving robustness for future edge cases.

