# Local Pipeline Testing Scripts

These scripts simulate the GitHub Actions PR pipeline locally for faster iteration.

## Quick Start

```bash
# Simple test (auto-detects changes, runs affected tests)
./scripts/test-pipeline-local.sh

# Force run all tests
./scripts/test-pipeline-local.sh --all

# Simulate full CI matrix (5 parallel Python runs + TypeScript)
./scripts/test-pipeline-parallel.sh

# Run fewer parallel Python tests (default is 5)
./scripts/test-pipeline-parallel.sh 3
```

## Scripts Overview

### `test-pipeline-local.sh`

**Purpose:** Quick local testing with change detection

**Features:**
- Detects changed files (simulates `dorny/paths-filter`)
- Only runs tests for changed packages
- Runs against local Convex (much faster than managed)
- Shows detailed failure logs
- Single Python test run (your current Python version)

**When to use:** Quick verification before pushing

**Example output:**
```
╔════════════════════════════════════════════════════════════════╗
║                 LOCAL PIPELINE SIMULATOR                       ║
║          Tests run in parallel against local Convex            ║
╚════════════════════════════════════════════════════════════════╝

🔍 Configuration:
   Convex URL: http://127.0.0.1:3210
   
STAGE 1: Detect File Changes
   ✓ TypeScript SDK changed
   ✓ Python SDK changed
   
STAGE 2: Deploy & Purge Database
   ✓ Convex deployed
   🧹 Purging test database...
   
STAGE 3: Run Tests in Parallel
   ✓ TypeScript SDK
   ✓ Python SDK
   ✓ Code Quality
   
✅ ALL CHECKS PASSED (95s)
```

### `test-pipeline-parallel.sh`

**Purpose:** Stress test parallel execution (matches CI exactly)

**Features:**
- Runs N parallel Python test processes simultaneously
- Default: 5 parallel runs (matching CI matrix of 3.10, 3.11, 3.12, 3.13, 3.14)
- Runs TypeScript tests in parallel too
- Real-time progress monitoring
- Proves test isolation works under load

**When to use:** 
- Before pushing major changes
- To verify parallel test isolation
- To catch race conditions locally
- To verify no conflicts between parallel runs

**Example output:**
```
╔════════════════════════════════════════════════════════════════╗
║          ADVANCED LOCAL PIPELINE SIMULATOR                     ║
║   Runs 5 parallel Python test suites + TypeScript tests       ║
║             (Simulates full CI matrix locally)                 ║
╚════════════════════════════════════════════════════════════════╝

🔍 Configuration:
   Convex URL: http://127.0.0.1:3210
   Parallel Python runs: 5
   
STAGE 1: Purge Test Database
   🧹 Deleted 0 entities
   
STAGE 2: Launch 5 Parallel Test Processes
   📦 TypeScript SDK (PID: 12345)
   🐍 Python SDK (5 parallel runs)
      Run 1 (PID: 12346)
      Run 2 (PID: 12347)
      Run 3 (PID: 12348)
      Run 4 (PID: 12349)
      Run 5 (PID: 12350)
      
⏳ Monitoring 6 parallel jobs...
   Progress: ●●●●●● (6/6 complete)
   
✅ ALL PARALLEL TESTS PASSED

   🎉 Successfully ran 5 parallel Python test suites
      with zero conflicts in 98s!
      
   TypeScript: 1920 tests
   Python: 1206 tests (per run)
   Python Total: 6030 test executions
```

## Prerequisites

### Required Environment Variables

In `.env.local`:
```bash
LOCAL_CONVEX_URL=http://127.0.0.1:3210
CONVEX_URL=http://127.0.0.1:3210  # For tests
OPENAI_API_KEY=sk-...              # For vector search tests
```

### Local Convex Must Be Running

Start local Convex in a separate terminal:
```bash
npm run dev
```

Or in the background:
```bash
nohup npm run dev > convex-dev.log 2>&1 &
```

## How It Works

### Change Detection

The scripts use `git diff` to compare against `main` branch:

**TypeScript SDK:**
- `src/**`
- `tests/**`
- `package.json`
- `tsconfig.json`
- `jest.config.js`

**Python SDK:**
- `cortex-sdk-python/**`

**Convex Backend:**
- `convex-dev/**`

If files in these paths changed, the corresponding tests run.

### Parallel Execution

Both scripts use background processes (`&`) to run jobs in parallel:

```bash
# Start jobs in parallel
npm test > ts.log 2>&1 &
PID_TS=$!

pytest tests/ > py.log 2>&1 &
PID_PY=$!

# Wait for all
wait $PID_TS
wait $PID_PY
```

This matches how GitHub Actions runs the matrix strategy and parallel jobs.

### Test Isolation

All tests use `TestRunContext` to generate unique IDs:

```python
# Each test run gets unique prefix
ctx = TestRunContext(run_id="module_name-run-1234567890-abc123")

# All entities prefixed
memory_space_id = ctx.memory_space_id()  # → "module_name-run-1234567890-abc123-space-xyz"
user_id = ctx.user_id()                  # → "module_name-run-1234567890-abc123-user-abc"
```

When 5 parallel runs execute simultaneously, each has a different `run_id`, so:
- No ID collisions
- No data conflicts
- Each run's cleanup only affects its own data

## Troubleshooting

### Tests fail with "Convex not running"

**Problem:** Local Convex isn't running

**Solution:**
```bash
npm run dev
```

### Tests fail with "MEMORYSPACE_ALREADY_EXISTS"

**Problem:** Leftover data from previous failed run

**Solution:**
```bash
# Purge manually
npx tsx scripts/cleanup-test-data.ts

# Then rerun tests
./scripts/test-pipeline-parallel.sh
```

### Parallel tests show conflicts

**Problem:** Test isolation isn't working

**Solution:** 
- Check that tests use `ctx` fixture (not hardcoded IDs)
- Check that tests use `test_run_context` or standard fixtures
- Review test file for module-level constants

### Script hangs

**Problem:** One test process is stuck

**Solution:**
```bash
# Find hanging process
ps aux | grep pytest

# Kill it
kill <PID>

# Check logs
ls -lh /tmp/tmp.*  # Find recent temp dir
tail -100 /tmp/tmp.xyz/python-3.log
```

## Performance Comparison

### Local vs CI

| Metric | CI (Managed Convex) | Local (Local Convex) | Speedup |
|--------|---------------------|----------------------|---------|
| TypeScript Tests | ~60s | ~75s | 0.8x |
| Python Tests (1 run) | ~180s | ~45s | 4x |
| Python Tests (5 parallel) | ~180s | ~50s | 3.6x |
| Total Pipeline | ~5-8 min | ~2-3 min | 2-3x |

**Note:** Local is faster for Python (no network latency), slightly slower for TypeScript (local Convex overhead).

## CI Pipeline Equivalence

These scripts simulate the actual CI pipeline:

| CI Step | Local Equivalent |
|---------|------------------|
| `detect-changes` | `git diff main` + path filtering |
| `setup-and-purge` | `npx tsx scripts/cleanup-test-data.ts` |
| `test-typescript` | `CONVEX_TEST_MODE=local npm test &` |
| `test-python` matrix | `N x pytest tests/` in background |
| `code-quality` | `npm run lint && tsc --noEmit` |
| `all-checks-passed` | Wait for all PIDs, check exit codes |

## Tips

1. **Run parallel script before pushing** - Catches race conditions early
2. **Use `--all` flag sparingly** - Only when you want to run everything
3. **Check logs on failure** - Scripts show log paths for debugging
4. **Keep local Convex running** - Start it once, reuse for multiple test runs
5. **Watch for conflicts** - If parallel script fails but local script passes, it's a parallel conflict

## What's Next?

Once tests pass locally with `test-pipeline-parallel.sh`, you can be confident the CI will pass:

1. Commit and push
2. Create PR
3. Watch GitHub Actions run the real pipeline
4. Should see all checks pass ✅
