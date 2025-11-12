# Facts API "observation" factType Bug Fix

## Issue Summary

**Severity**: Medium  
**Impact**: Validation errors when filtering by `factType="observation"` in query operations  
**Fixed**: January 11, 2025

## Bugs Identified and Fixed

### Bug 1: `list` Query (Line 222-230)
**Problem**: Missing `v.literal("observation")` in factType union  
**Impact**: Could not filter facts by `factType="observation"` in list operation  
**Status**: ✅ Fixed

### Bug 2: `count` Query (Line 277-285)
**Problem**: Missing `v.literal("observation")` in factType union  
**Impact**: Could not count facts filtered by `factType="observation"`  
**Status**: ✅ Fixed

### Bug 3: `search` Query (Line 318-326)
**Problem**: Missing `v.literal("observation")` in factType union  
**Impact**: Could not search facts filtered by `factType="observation"`  
**Status**: ✅ Fixed

### Bug 4: `queryBySubject` Query (Line 429-437)
**Problem**: Missing `v.literal("observation")` in factType union  
**Impact**: Could not query by subject filtered by `factType="observation"`  
**Status**: ✅ Fixed

### Bug 5: `exportFacts` Query (Line 490-498)
**Problem**: Missing `v.literal("observation")` in factType union  
**Impact**: Could not export facts filtered by `factType="observation"`  
**Status**: ✅ Fixed

## Root Cause

The `store` mutation and schema were updated to include `"observation"` as a valid factType, but the 5 query functions that filter by factType were not updated in sync. This created an inconsistency where:

✅ **Could store** facts with `factType="observation"`  
❌ **Could NOT query/filter** facts by `factType="observation"`

## Why Tests Didn't Catch This

### 1. **Test Coverage Gap - No `factType` Filter Tests**

The existing tests create facts with `factType="observation"`, but **never test filtering/querying by factType**:

```python
# cortex-sdk-python/tests/test_facts.py
# Tests that store "observation" facts:
await cortex.facts.store({
    "factType": "observation",  # ✅ This works (store accepts it)
    # ...
})

# ❌ BUT no tests do this:
await cortex.facts.list({
    "memorySpaceId": space_id,
    "factType": "observation"  # Would fail with validation error
})
```

**Why this gap exists**:
- Tests focused on CRUD operations (create, read, update, delete)
- Tests verified facts could be **stored** with "observation"
- Tests did NOT verify facts could be **filtered** by "observation"

### 2. **Backend Validation Happens at Runtime**

Convex validation occurs when the function is **called**, not when it's deployed:

```typescript
// This validates ONLY when called:
export const list = query({
  args: {
    factType: v.optional(v.union(...))  // ← Validated at call time
  }
})
```

**What this means**:
- ✅ Backend deploys successfully (no syntax errors)
- ✅ Tests that don't use `factType` parameter pass
- ❌ First call with `factType="observation"` throws validation error

### 3. **Test Inheritance Pattern**

Many tests inherited from TypeScript SDK tests that were written **before** "observation" was added:

```typescript
// Original TypeScript test (pre-observation):
test('should filter by factType', async () => {
  await facts.list({
    factType: 'preference'  // ← Only tested existing types
  });
});
```

When ported to Python, these tests continued to use the old factTypes.

### 4. **Implicit Coverage Assumption**

There's an assumption that if:
1. ✅ Store works with "observation"
2. ✅ List works (without filter)
3. ✅ Schema includes "observation"

Then list with `factType="observation"` should work. But Convex validates each function's args independently.

### 5. **No Integration Tests for New factTypes**

When "observation" was added, there were no integration tests specifically for:

```python
# Missing test:
async def test_observation_factType_in_all_query_operations():
    # Store observation fact
    fact = await facts.store(factType="observation", ...)
    
    # Test ALL query operations with factType="observation" filter
    await facts.list(factType="observation")      # ← Would catch bug 1
    await facts.count(factType="observation")     # ← Would catch bug 2
    await facts.search(factType="observation")    # ← Would catch bug 3
    await facts.queryBySubject(factType="observation")  # ← Would catch bug 4
    await facts.exportFacts(factType="observation")     # ← Would catch bug 5
```

### 6. **Mutation vs Query Testing Asymmetry**

Tests heavily focus on **mutations** (write operations):
- ✅ Extensively test `store()` with all factTypes
- ✅ Verify data is persisted correctly
- ✅ Test validation errors on store

But less focus on **queries** (read operations) with all parameter combinations:
- ⚠️ Test queries work in general
- ❌ Don't exhaustively test all filter parameters
- ❌ Don't test new enum values in all query filters

## Impact Assessment

### Severity: Medium
**Why not High?**
- Workaround exists: Query all facts, filter client-side
- Only affects filtering, not core CRUD operations
- No data corruption or loss

**Why not Low?**
- Affects 5 different functions (widespread)
- Breaks valid use case (filtering by observation)
- Confusing error message for developers

### Affected Operations
1. ❌ `facts.list({ factType: "observation" })` - ArgumentValidationError
2. ❌ `facts.count({ factType: "observation" })` - ArgumentValidationError
3. ❌ `facts.search({ factType: "observation" })` - ArgumentValidationError
4. ❌ `facts.queryBySubject({ factType: "observation" })` - ArgumentValidationError
5. ❌ `facts.exportFacts({ factType: "observation" })` - ArgumentValidationError

### User Experience
```bash
# User tries to filter by observation:
cortex.facts.list(factType="observation")

# Gets confusing error:
ArgumentValidationError: Value does not match validator.
Path: .factType
Value: "observation"
Validator: v.union(
  v.literal("preference"),
  v.literal("identity"),
  ...
  v.literal("custom")  # ← "observation" not in list!
)
```

## Fix Applied

Added `v.literal("observation")` to the factType union in all 5 query functions:

```typescript
factType: v.optional(
  v.union(
    v.literal("preference"),
    v.literal("identity"),
    v.literal("knowledge"),
    v.literal("relationship"),
    v.literal("event"),
    v.literal("observation"),  // ← Added
    v.literal("custom"),
  ),
),
```

## Prevention Strategy

### 1. Add Comprehensive Filter Tests

```python
# Test ALL query operations with ALL factTypes:
@pytest.mark.parametrize("fact_type", [
    "preference", "identity", "knowledge", 
    "relationship", "event", "observation", "custom"
])
async def test_query_operations_with_all_fact_types(fact_type):
    # Store fact of this type
    fact = await facts.store(factType=fact_type, ...)
    
    # Test ALL query operations
    results = await facts.list(factType=fact_type)
    assert len(results) >= 1
    
    count = await facts.count(factType=fact_type)
    assert count >= 1
    
    search_results = await facts.search(factType=fact_type)
    assert len(search_results) >= 1
    
    # etc...
```

### 2. Schema Consistency Validation

Add a test that validates all factType enums match:

```python
async def test_fact_type_enum_consistency():
    """Ensure all factType validators match across store/query functions"""
    schema_fact_types = get_schema_fact_types()
    
    store_fact_types = get_mutation_fact_types("store")
    list_fact_types = get_query_fact_types("list")
    count_fact_types = get_query_fact_types("count")
    search_fact_types = get_query_fact_types("search")
    # etc...
    
    assert schema_fact_types == store_fact_types
    assert schema_fact_types == list_fact_types
    assert schema_fact_types == count_fact_types
    # etc...
```

### 3. Integration Test Checklist

When adding new enum values, test checklist:
- [ ] Store mutation accepts new value
- [ ] Schema includes new value
- [ ] ALL query functions accept new value in filters
- [ ] Client SDKs (TypeScript, Python) include new value
- [ ] Documentation updated

### 4. Automated Enum Synchronization

Use a shared constant:

```typescript
// shared/factTypes.ts
export const FACT_TYPES = [
  "preference",
  "identity", 
  "knowledge",
  "relationship",
  "event",
  "observation",
  "custom"
] as const;

export const factTypeValidator = v.union(
  ...FACT_TYPES.map(t => v.literal(t))
);

// Then in facts.ts:
import { factTypeValidator } from "./shared/factTypes";

export const list = query({
  args: {
    factType: v.optional(factTypeValidator)  // ← Always in sync
  }
});
```

### 5. CI/CD Schema Validation

Add pre-deployment check:

```bash
# Check all enum definitions match
npm run validate:schema-consistency

# Fails if factType definitions differ across functions
```

## Lessons Learned

1. **Test filters, not just CRUD** - Coverage must include all parameter combinations
2. **Enum updates require checklist** - New values must be added everywhere
3. **Mutations ≠ Queries** - They have separate validators that must stay in sync
4. **Runtime validation is late** - Errors only surface when function is called
5. **Integration tests are crucial** - Unit tests alone miss cross-function consistency issues

## Related Issues

- Similar pattern may exist in other APIs with enum filters
- Recommend audit of all enum-based filters across codebase

## Testing Recommendation

Create parametrized tests for **every enum-based filter** in the system:

```python
# For each API with enum filters:
@pytest.mark.parametrize("enum_value", ALL_VALID_ENUM_VALUES)
async def test_all_operations_with_enum_value(enum_value):
    # Test EVERY operation that filters by this enum
    pass
```

## Status

✅ **All 5 bugs fixed**  
✅ **Backend updated**  
⏳ **Waiting for new tests to be added** (recommended)

---

**Fixed by**: AI Assistant  
**Date**: January 11, 2025  
**Files Modified**: `convex-dev/facts.ts` (5 functions)  
**Lines Changed**: 5 additions (one `v.literal("observation")` per function)

