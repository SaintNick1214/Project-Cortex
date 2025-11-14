# Test Execution Flow - Before & After Fix

## Before Fix: Parallel Execution (❌ Conflicts)

```
GitHub Event: Push to main (affects Python code)
│
├─────────────────────────────────┬─────────────────────────────────┐
│                                 │                                 │
▼                                 ▼                                 ▼
test-python.yml                   publish.yml                  (other workflows)
│                                 │
├─ Triggers (path match)          ├─ Triggers (always)
│                                 │
▼                                 ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  Python Test Suite          │   │  TypeScript Test Suite      │
│  ─────────────────────      │   │  ──────────────────────      │
│  Running in parallel... ⚡   │   │  Running in parallel... ⚡   │
│                             │   │                             │
│  ↓ Uses CONVEX_URL          │   │  ↓ Uses CONVEX_URL          │
│  ↓ Writes test data         │   │  ↓ Writes test data         │
│  ↓ Creates facts            │   │  ↓ Creates facts            │
└─────────────┬───────────────┘   └─────────────┬───────────────┘
              │                                 │
              └────────────┬────────────────────┘
                           ▼
                ┌────────────────────────┐
                │   Convex Deployment    │
                │   (Shared Resource)    │
                │                        │
                │  ❌ Data conflicts     │
                │  ❌ Race conditions    │
                │  ❌ Cleanup collisions │
                └────────────────────────┘
                           │
                           ▼
                   ❌ Random Test Failures
```

---

## After Fix: Sequential Execution (✅ No Conflicts)

```
GitHub Event: Push to main (affects Python code)
│
├─────────────────────────────────┬─────────────────────────────────┐
│                                 │                                 │
▼                                 ▼                                 ▼
test-python.yml                   publish.yml                  (other workflows)
│                                 │
├─ Triggers (path match)          ├─ Triggers (always)
│                                 │
├─ concurrency:                   ├─ concurrency:
│   group: cortex-tests-main      │   group: cortex-tests-main
│   cancel-in-progress: false     │   cancel-in-progress: false
│                                 │
▼                                 ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  Python Test Suite          │   │  ⏸️  Waiting in queue...     │
│  ─────────────────────      │   │                             │
│  Running first... ▶️          │   │  (Same concurrency group)   │
│                             │   │                             │
│  ↓ Uses CONVEX_URL          │   │  Cannot start until         │
│  ↓ Writes test data         │   │  Python tests complete      │
│  ↓ Creates facts            │   │                             │
│  ↓ Cleans up                │   │                             │
└─────────────┬───────────────┘   └─────────────────────────────┘
              │
              ▼
       ✅ Python tests pass
              │
              └─────────────────────────────┐
                                            ▼
                            ┌─────────────────────────────┐
                            │  TypeScript Test Suite      │
                            │  ──────────────────────      │
                            │  Now running... ▶️           │
                            │                             │
                            │  ↓ Uses CONVEX_URL          │
                            │  ↓ Writes test data         │
                            │  ↓ Creates facts            │
                            │  ↓ Cleans up                │
                            └─────────────┬───────────────┘
                                          │
                                          ▼
                                ✅ TypeScript tests pass

Final Result: ✅ All tests pass, no conflicts
```

---

## Concurrency Group Behavior

### Same Branch (Sequential)
```
Branch: main
├─ Workflow A: cortex-tests-refs/heads/main  ▶️ Running
└─ Workflow B: cortex-tests-refs/heads/main  ⏸️ Waiting → ▶️ Runs after A
```

### Different Branches (Parallel - OK)
```
Branch: main
└─ Workflow A: cortex-tests-refs/heads/main  ▶️ Running

Branch: feature-xyz
└─ Workflow B: cortex-tests-refs/heads/feature-xyz  ▶️ Running

✅ Different groups, can run in parallel (no conflicts if using different deployments)
```

### PR to main (Sequential with main's workflows)
```
PR #123 → main
├─ Workflow A (PR): cortex-tests-refs/pull/123/merge  ▶️ Running
│
main branch
└─ Workflow B (push): cortex-tests-refs/heads/main  ▶️ Running

✅ Different groups, but typically PRs use review deployments anyway
```

---

## Time Impact Analysis

### Scenario 1: Python-only changes
```
Before: Python tests (2 min) 
After:  Python tests (2 min)
Impact: ✅ No change (publish.yml doesn't run tests if no version change)
```

### Scenario 2: TypeScript-only version bump
```
Before: TypeScript tests (2 min)
After:  TypeScript tests (2 min)
Impact: ✅ No change (test-python.yml doesn't trigger)
```

### Scenario 3: Both triggered (rare)
```
Before: Max(Python 2 min, TypeScript 2 min) = ~2 min (parallel, but fails)
After:  Python 2 min + TypeScript 2 min = ~4 min (sequential, but passes)
Impact: ⏱️ +2 min wait, but tests actually pass ✅
```

---

## Key Benefits

✅ **Eliminates race conditions**: Only one workflow accesses Convex at a time  
✅ **Maintains test isolation**: Each suite sees clean, consistent state  
✅ **No test code changes**: Solution is pure CI configuration  
✅ **Preserves parallelism where safe**: Different branches can still run concurrently  
✅ **Fail-safe**: If a workflow hangs, GitHub's timeout prevents indefinite blocking  

---

## Configuration Details

### Concurrency Group Components

**Template**: `cortex-tests-${{ github.ref }}`

**Examples**:
- `main` branch: `cortex-tests-refs/heads/main`
- `dev` branch: `cortex-tests-refs/heads/dev`
- PR #42: `cortex-tests-refs/pull/42/merge`
- Tag v1.0.0: `cortex-tests-refs/tags/v1.0.0`

### Cancel-in-progress: false

**Why false**:
- Ensures all commits are tested
- Queues workflows instead of cancelling
- Prevents skipping important test runs

**If it were true**:
- Newer workflows would cancel older ones
- Some commits might never get tested
- Could miss regressions

---

## Monitoring Workflow Execution

### GitHub Actions UI Indicators

**Running**:
```
▶️  test-python.yml      Running (2m 15s)
⏸️   publish.yml         Waiting for other workflows
```

**Both Complete**:
```
✅  test-python.yml      Passed (2m 34s)
✅  publish.yml          Passed (2m 18s)
Total time: 4m 52s
```

### Log Messages

Look for these in workflow logs:

**Workflow starting**:
```
Run started by push event
Concurrency group: cortex-tests-refs/heads/main
```

**Workflow waiting**:
```
Waiting for other workflows in concurrency group 'cortex-tests-refs/heads/main'
```

**Workflow proceeding**:
```
No other workflows running in concurrency group
Proceeding with workflow execution
```

---

## Related Documentation

- [TEST-CONFLICT-FIX-SUMMARY.md](./TEST-CONFLICT-FIX-SUMMARY.md) - Quick summary
- [CONCURRENT-TEST-PREVENTION.md](./CONCURRENT-TEST-PREVENTION.md) - Full details
- [WORKFLOWS-README.md](./WORKFLOWS-README.md) - All workflows documentation
- [GitHub Actions Concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency)

---

**Last Updated**: 2025-11-14  
**Status**: ✅ Implemented

