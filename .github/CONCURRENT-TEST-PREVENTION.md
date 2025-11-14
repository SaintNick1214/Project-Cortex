# Concurrent Test Prevention Strategy

## Problem

The CI pipeline was experiencing test failures that only occurred when multiple workflows ran simultaneously. Specifically:

- **Python SDK tests** (`test-python.yml`) use a managed Convex deployment for integration testing
- **TypeScript SDK tests** (in `publish.yml`) use the **same** managed Convex deployment
- When both workflows triggered at the same time (e.g., during a PR that affects Python code), they would:
  - Write conflicting test data to the same Convex tables
  - Delete each other's test data during cleanup
  - Read inconsistent state during assertions
  - Experience race conditions in database operations

### When Did This Happen?

**Scenario 1: PR affecting Python code**
1. PR created → `test-python.yml` triggers (via pull_request event)
2. PR merged to main → Both workflows trigger simultaneously:
   - `test-python.yml` (via push event with path filter match)
   - `publish.yml` (via push event, no path filter)

**Scenario 2: Push to main with mixed changes**
1. Commit affects both Python and TypeScript code
2. Both workflows trigger and run tests in parallel
3. Both hit the same `CONVEX_URL` secret (managed deployment)

## Solution: GitHub Actions Concurrency Groups

Added `concurrency` configuration to both workflows to ensure they **never run simultaneously**:

```yaml
concurrency:
  group: cortex-tests-${{ github.ref }}
  cancel-in-progress: false
```

### How It Works

**Concurrency Group**: `cortex-tests-${{ github.ref }}`
- Groups workflows by the same identifier (`cortex-tests-` + branch ref)
- Any workflow with this group will wait for other workflows in the same group to complete
- Example: On `main` branch, group is `cortex-tests-refs/heads/main`

**Cancel-in-progress**: `false`
- When set to `false`, new workflows wait for existing ones to complete (sequential execution)
- When set to `true`, new workflows would cancel older ones (not desired for testing)

### Execution Flow

**Before fix (parallel - ❌ conflicts)**:
```
Time: 0s    30s   60s   90s   120s
      ├─────┴─────┴─────┴─────┤
      │ Python tests           │
      ├─────┴─────┴─────┴─────┤
      │ TypeScript tests       │
      └────────────────────────┘
      ⚠️  Both accessing same Convex deployment
```

**After fix (sequential - ✅ no conflicts)**:
```
Time: 0s    30s   60s   90s   120s  150s  180s
      ├─────┴─────┴─────┴─────┼─────┴─────┤
      │ Python tests           │ TS tests  │
      └────────────────────────┴───────────┘
      ✅ Each workflow gets exclusive Convex access
```

## Affected Workflows

### 1. test-python.yml
**Purpose**: Run Python SDK integration tests  
**Trigger**: PRs and pushes to `main` affecting `cortex-sdk-python/**`  
**Convex Usage**: Managed deployment via `CONVEX_URL` secret  
**Concurrency**: Added `cortex-tests-${{ github.ref }}`

### 2. publish.yml
**Purpose**: Publish SDK/wizard to npm (includes TypeScript tests)  
**Trigger**: Every push to `main` (no path filter)  
**Convex Usage**: Managed deployment via `CONVEX_URL` secret  
**Concurrency**: Added `cortex-tests-${{ github.ref }}`

## Benefits

✅ **Prevents test conflicts**: No simultaneous access to shared Convex deployment  
✅ **Maintains test integrity**: Each test suite sees consistent state  
✅ **Non-blocking**: Workflows queue rather than fail  
✅ **Branch-isolated**: Different branches don't block each other  
✅ **Minimal overhead**: Only adds wait time when conflicts would occur  

## Testing the Fix

### Local Testing
Tests should continue to pass locally as before (no changes to test code):

```bash
# Python tests
cd cortex-sdk-python
pytest tests/ -v

# TypeScript tests
npm test
```

### CI Testing

**Test 1: Python-only PR**
```bash
# Create PR that only changes Python code
# Expected: test-python.yml runs immediately, publish.yml doesn't trigger
```

**Test 2: Mixed changes to main**
```bash
# Push commit affecting both Python and TypeScript
# Expected: Both workflows trigger, but run sequentially
# Check GitHub Actions logs to verify staggered execution
```

**Test 3: Concurrent PRs**
```bash
# Create two PRs from different branches
# Expected: Each branch has its own concurrency group, can run in parallel
```

## Monitoring

### Check Workflow Order

In GitHub Actions UI, look for:
- ⏸️ "Waiting" status → Workflow is queued due to concurrency
- ▶️ "Running" status → Workflow is actively executing
- Staggered start times (second workflow starts after first completes)

### Verify No Conflicts

Python test logs should show:
```
✅ All tests passed
✅ No foreign key violations
✅ No "record not found" errors
✅ Consistent fact counts and conversation states
```

TypeScript test logs should show:
```
✅ All tests passed
✅ No race condition failures
✅ Consistent vector search results
✅ Proper fact embeddings
```

## Alternative Solutions Considered

### ❌ Option 1: Use separate Convex deployments
**Pros**: True isolation  
**Cons**: Requires managing multiple deployments, secrets, and keeping them in sync

### ❌ Option 2: Merge into single workflow
**Pros**: Explicit sequential execution  
**Cons**: Loses separation of concerns, harder to maintain, longer CI times for Python-only changes

### ❌ Option 3: Add workflow_run dependencies
**Pros**: Explicit dependencies  
**Cons**: Complex configuration, only works for push events (not PRs), harder to debug

### ✅ Option 4: Concurrency groups (implemented)
**Pros**: Simple, effective, works for all trigger types, maintains workflow separation  
**Cons**: None significant

## Edge Cases

### Multiple commits pushed rapidly
- Second commit's workflows wait for first commit's workflows
- All commits get tested, none are skipped

### Force push to branch
- Old workflows for overwritten commits are cancelled
- New workflows for updated HEAD start fresh

### Workflow re-run
- Re-runs respect concurrency groups
- Wait for any currently running workflows in same group

## Future Improvements

### If test isolation is needed in future
1. **Use test databases per workflow run**: 
   - Create ephemeral Convex dev deployments
   - Clean up after tests complete

2. **Implement test namespacing**:
   - Prefix all test data with workflow run ID
   - Query filters ensure isolation
   - Cleanup removes only own data

3. **Parallel execution with sharding**:
   - Split test suite into independent shards
   - Each shard gets dedicated deployment
   - Aggregate results at end

## Related Files

- `.github/workflows/test-python.yml` - Python test workflow
- `.github/workflows/publish.yml` - TypeScript test + publish workflow
- `cortex-sdk-python/PIPELINE-TEST-FAILURE-FIX.md` - Previous fix for OpenAI dependency issue

## Rollback Plan

If this causes issues, remove the `concurrency` blocks from both workflow files:

```bash
# Edit both files and remove these lines:
# concurrency:
#   group: cortex-tests-${{ github.ref }}
#   cancel-in-progress: false
```

Tests will return to parallel execution (with potential conflicts).

## Success Criteria

✅ Python tests pass consistently in CI  
✅ TypeScript tests pass consistently in CI  
✅ No "waiting for other workflows" longer than 5 minutes  
✅ Both test suites complete within expected time windows  
✅ No Convex-related race condition errors in logs  

## Questions & Troubleshooting

**Q: Why not `cancel-in-progress: true`?**  
A: We want all commits tested. Canceling would skip testing earlier commits.

**Q: Does this slow down CI?**  
A: Only when both workflows trigger simultaneously (rare). Typical Python-only or TypeScript-only changes see no impact.

**Q: Can we run tests in parallel safely?**  
A: Not with the current shared Convex deployment. Would need separate test environments or test data isolation.

**Q: What if a workflow hangs?**  
A: GitHub Actions has built-in timeouts (360 minutes default). Hung workflows automatically cancel and unblock others.

---

**Status**: ✅ Implemented and ready for testing  
**Last Updated**: 2025-11-14  
**Author**: AI Assistant (Claude) with SaintNick


