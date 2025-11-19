# SDK Bug Fix: Facts Missing userId

## Issue Found

**Bug:** Facts extracted during `memory.remember()` were not getting `userId` field set, even though SDK v0.9.1 supports it.

**Impact:** Facts filtering by userId didn't work because userId was undefined.

**Scope:** Bug exists in BOTH TypeScript SDK and Python SDK

## Root Cause

### TypeScript SDK

In `src/memory/index.ts` line 337-358, when storing facts from `extractFacts` callback:

```typescript
// Before (BROKEN):
const storedFact = await this.facts.store({
  memorySpaceId: params.memorySpaceId,
  participantId: params.participantId,
  // userId: MISSING! ← Bug
  fact: factData.fact,
  // ...
});
```

### Python SDK

In `cortex-sdk-python/cortex/memory/__init__.py` line 228-253:

```python
# Before (BROKEN):
stored_fact = await self.facts.store(
    StoreFactParams(
        memory_space_id=params.memory_space_id,
        participant_id=params.participant_id,
        # user_id: MISSING! ← Bug
        fact=fact_data["fact"],
        # ...
    )
)
```

**Root Cause:** In both SDKs, `userId` from `params.userId` was NOT being passed to `facts.store()` during fact extraction.

## Fix Applied

### TypeScript SDK

**Fixed in 3 locations in `src/memory/index.ts`:**

1. **Line 341** - `remember()` method (fact extraction during conversation)
2. **Line 783** - `store()` method (fact extraction during memory storage)  
3. **Line 858** - `update()` method (fact re-extraction during memory update)

```typescript
// After (FIXED):
const storedFact = await this.facts.store({
  memorySpaceId: params.memorySpaceId,
  participantId: params.participantId,
  userId: params.userId, // ← FIX: Now included in all 3 places!
  fact: factData.fact,
  // ...
});
```

### Python SDK

**Fixed in 3 locations in `cortex-sdk-python/cortex/memory/__init__.py`:**

1. **Line 234** - `remember()` method (fact extraction during conversation)
2. **Line 658** - `store()` method (fact extraction during memory storage)
3. **Line 741** - `update()` method (fact re-extraction during memory update)

```python
# After (FIXED):
stored_fact = await self.facts.store(
    StoreFactParams(
        memory_space_id=params.memory_space_id,
        participant_id=params.participant_id,
        user_id=params.user_id,  # ← FIX: Now included in all 3 places!
        fact=fact_data["fact"],
        # ...
    )
)
```

**Note:** In the `update()` method, both `participantId` and `userId` were missing and have been added.

## Why Tests Didn't Catch This

### Gap in Test Coverage

**TypeScript Tests (`tests/memory-facts-integration.test.ts`):**
- ✅ Tested that facts were extracted
- ✅ Tested fact content, confidence, sourceRef
- ❌ **NEVER checked `fact.userId`**

**Python Tests (`cortex-sdk-python/tests/test_memory.py`):**
- ✅ Tested that facts were extracted  
- ✅ Tested fact content matches
- ❌ **NEVER checked `fact.user_id`**

### Why It Slipped Through

There are **two code paths** for fact storage:

1. **Direct API:** `cortex.facts.store({ userId: 'alice' })` ✅ Works (was tested)
2. **Integration path:** `cortex.memory.remember({ userId: 'alice', extractFacts })` → calls `facts.store()` internally ❌ Broken (incomplete assertions)

The universal filter tests (`facts-universal-filters.test.ts`) DO test `userId` filtering, but only for the direct `facts.store()` path, not the integration path through `memory.remember()`.

### Tests Added

**TypeScript:** Added comprehensive parameter propagation test in `tests/memory-facts-integration.test.ts`  
**Python:** Added comprehensive parameter propagation test in `cortex-sdk-python/tests/test_memory.py`

Both tests now verify:
- ✅ `userId` is properly propagated
- ✅ `participantId` is properly propagated  
- ✅ Filtering by `userId` works after extraction
- ✅ All sourceRef fields are present

## Version

**TypeScript SDK:**
- Fixed in: v0.9.2 (built, ready to publish)
- Previously broken: v0.9.1, v0.9.0

**Python SDK:**
- Fixed in: Next release (needs version bump)
- Currently broken: Latest version

## Testing

After updating to fixed SDK:

1. Clear old facts: `POST /api/clear-old-data`
2. Create conversation with fact extraction
3. Check fact in database - should have `userId` field
4. Filter works: `facts.list({ userId: 'nicholas' })` returns only Nicholas's facts

## Impact

✅ Facts now properly isolated by user  
✅ GDPR cascade delete works for facts  
✅ Multi-user demos work correctly  
✅ Hive Mode participant + user tracking works  

**This was a critical bug for multi-user scenarios!**

## Related Documentation Bugs Found

During investigation, found two additional documentation issues:

### Bug 1: Missing `observation` FactType in Documentation

**File**: `Documentation/03-api-reference/14-facts-operations.md`  
**Issue**: Documentation listed only 6 factTypes but code supports 7  
**Missing**: `"observation"` factType  
**Status**: ✅ Fixed

### Bug 2: Duplicate `minConfidence` Parameter  

**File**: `Documentation/03-api-reference/14-facts-operations.md`  
**Issue**: Same parameter listed twice in multiple interfaces:
```typescript
minConfidence?: number; // Minimum confidence threshold (0-100)
minConfidence?: number; // Confidence >= value  // DUPLICATE
```
**Status**: ✅ Fixed (removed duplicate)

## Lesson Learned

**Integration tests must verify field propagation**, not just that operations succeed. When parameters flow through multiple layers (Memory → Facts), tests must assert that ALL parameters reach the final destination, not just check that the operation completes.

**Documentation must stay in sync with code**. The `"observation"` factType was added to the code but never documented, causing confusion about what values are valid.

