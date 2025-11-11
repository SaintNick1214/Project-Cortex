# Python SDK Test Scripts

## Dual-Deployment Testing

The Python SDK supports the same dual-testing strategy as the TypeScript SDK, allowing tests to run against LOCAL and/or MANAGED Convex deployments.

### Quick Start

```bash
# Auto-detect and run tests against available deployment(s)
python scripts/run-python-tests.py

# Test against LOCAL Convex only
python scripts/run-python-tests.py --mode=local

# Test against MANAGED Convex only  
python scripts/run-python-tests.py --mode=managed

# Explicitly test BOTH deployments
python scripts/run-python-tests.py --mode=both

# Pass additional pytest arguments
python scripts/run-python-tests.py --mode=local -v -k test_memory
```

### How It Works

**Environment Detection:**
- Reads `.env.local` from project root
- Detects `LOCAL_CONVEX_URL` (local deployment)
- Detects `CLOUD_CONVEX_URL` (managed deployment)
- Sets `CONVEX_URL` based on `CONVEX_TEST_MODE`

**Test Modes:**
1. **local**: Tests against LOCAL Convex (`http://127.0.0.1:3210`)
   - Fast iteration
   - No vector search support
   - No network latency

2. **managed**: Tests against MANAGED Convex (cloud URL)
   - Full vector search support
   - Production-like environment
   - Network latency present

3. **both**: Runs tests against BOTH deployments sequentially
   - Comprehensive validation
   - Ensures parity between environments
   - Doubles test execution time

4. **auto**: Auto-detects (default)
   - If only LOCAL configured → Tests LOCAL
   - If only MANAGED configured → Tests MANAGED
   - If BOTH configured → Tests LOCAL (use --mode=both for dual testing)

### Current Configuration

Based on your `.env.local`:

```bash
# LOCAL Configuration
LOCAL_CONVEX_URL=http://127.0.0.1:3210
LOCAL_CONVEX_DEPLOYMENT=local:local-nicholasgeil-local_convex_81fb7

# MANAGED Configuration  
CLOUD_CONVEX_URL=https://expert-buffalo-268.convex.cloud
CLOUD_CONVEX_DEPLOY_KEY=dev:expert-buffalo-268|...

# Active (set by dev-runner.mjs or manually)
CONVEX_URL=http://127.0.0.1:3210  # Currently: LOCAL
```

**You have BOTH configurations!** You can test against either or both.

### Examples

```bash
# Quick local iteration during development
cd cortex-sdk-python
source .venv/bin/activate
python ../scripts/run-python-tests.py --mode=local

# Test managed deployment before release
python ../scripts/run-python-tests.py --mode=managed

# Full validation against both environments
python ../scripts/run-python-tests.py --mode=both

# Run specific test file against both
python ../scripts/run-python-tests.py --mode=both tests/test_memory.py

# Verbose output with test names
python ../scripts/run-python-tests.py --mode=local -v

# Run tests matching pattern
python ../scripts/run-python-tests.py --mode=managed -k "conversation"
```

### Integration with Pytest Directly

You can also set the environment variable manually:

```bash
# Test LOCAL
export CONVEX_TEST_MODE=local
pytest -v

# Test MANAGED
export CONVEX_TEST_MODE=managed
pytest -v

# Or inline
CONVEX_TEST_MODE=local pytest -v
CONVEX_TEST_MODE=managed pytest -v
```

### Comparison with TypeScript SDK

| Feature | TypeScript SDK | Python SDK |
|---------|---------------|-----------|
| Dual testing support | ✅ Yes (test-runner.mjs) | ✅ Yes (run-python-tests.py) |
| Auto-detection | ✅ Yes | ✅ Yes |
| Test mode env var | `CONVEX_TEST_MODE` | `CONVEX_TEST_MODE` |
| Local config | `LOCAL_CONVEX_URL` | `LOCAL_CONVEX_URL` |
| Managed config | `CLOUD_CONVEX_URL` | `CLOUD_CONVEX_URL` |
| Dual suite execution | ✅ `npm test` | ✅ `--mode=both` |

Both SDKs now have **feature parity** for deployment testing! 🎉

### Why Dual Testing?

**LOCAL Benefits:**
- ⚡ Fast iteration (no network latency)
- 🔒 Privacy (no data leaves your machine)
- 💰 No cloud costs
- 🐛 Easy debugging with local Convex logs

**MANAGED Benefits:**
- ✅ Full vector search support (semantic similarity)
- 🌐 Production-like environment
- 📊 Real performance characteristics
- 🔍 Tests embeddings and advanced features

**Testing BOTH ensures:**
- Code works in both environments
- No environment-specific bugs
- Vector search features work correctly
- Backend schema is properly deployed everywhere

