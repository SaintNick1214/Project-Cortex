# Enum-Based Filter Testing Guide

## Why Enum Filter Tests Are Critical

### The "observation" Bug

In January 2025, we discovered that the `"observation"` factType was missing from 5 Facts API query function validators, despite being present in:

- The schema definition
- The `store` mutation

**Impact**: Users could store facts with `factType="observation"` but received `ArgumentValidationError` when trying to filter/query by it.

**Root Cause**: When "observation" was added to the schema and `store` mutation, the 5 query functions were not updated in sync.

This bug demonstrated the need for **comprehensive enum filter testing**.

## Testing Strategy

### 1. Parametrized Tests for Complete Coverage

Test **every enum value** in **every filter operation**:

```python
# Python example
@pytest.mark.parametrize("fact_type", [
    "preference", "identity", "knowledge",
    "relationship", "event", "observation", "custom"
])
class TestFactsFilterParametrized:
    async def test_list_filters_by_fact_type(self, cortex, fact_type):
        # Store fact of this type
        # Filter by this type
        # Assert all results match
```

```typescript
// TypeScript example
describe.each(ALL_FACT_TYPES)("FactType: %s", (factType) => {
  it(`list() should filter by factType="${factType}"`, async () => {
    // Store fact of this type
    // Filter by this type
    // Assert all results match
  });
});
```

### 2. Edge Case Tests

In addition to parametrized tests, test:

- Empty results (filter with no matches)
- Multiple results
- Combining enum filter with other parameters
- New enum values specifically (regression tests)

### 3. Test Each Operation

For each API with enum filters, test ALL operations that accept the enum:

**Facts API Example**:

- `list()` with `factType` filter ✓
- `count()` with `factType` filter ✓
- `search()` with `factType` filter ✓
- `queryBySubject()` with `factType` filter ✓
- `exportFacts()` with `factType` filter ✓

**Conversations API Example**:

- `list()` with `type` filter ✓
- `count()` with `type` filter ✓
- `search()` with `type` filter ✓

**Contexts API Example**:

- `list()` with `status` filter ✓
- `count()` with `status` filter ✓

**Memory Spaces API Example**:

- `list()` with `type` filter ✓
- `list()` with `status` filter ✓

## Enum Consistency Checklist

When adding a new enum value, ensure it's added to ALL of these locations:

### 1. Schema Definition

```typescript
// convex-dev/schema.ts
facts: defineTable({
  factType: v.union(
    v.literal("preference"),
    // ... other values ...
    v.literal("NEW_VALUE"), // ← Add here
    v.literal("custom"),
  ),
});
```

### 2. Mutation Validators

```typescript
// convex-dev/facts.ts
export const store = mutation({
  args: {
    factType: v.union(
      v.literal("preference"),
      // ... other values ...
      v.literal("NEW_VALUE"), // ← Add here
      v.literal("custom"),
    ),
  },
});
```

### 3. ALL Query Function Validators

```typescript
// convex-dev/facts.ts
export const list = query({
  args: {
    factType: v.optional(
      v.union(
        v.literal("preference"),
        // ... other values ...
        v.literal("NEW_VALUE"), // ← Add here
        v.literal("custom"),
      ),
    ),
  },
});

// Repeat for: count, search, queryBySubject, exportFacts
```

### 4. SDK Type Definitions

```typescript
// TypeScript SDK
export type FactType =
  | "preference"
  // ... other values ...
  | "NEW_VALUE" // ← Add here
  | "custom";
```

```python
# Python SDK
FactType = Literal[
    "preference",
    # ... other values ...
    "NEW_VALUE",  # ← Add here
    "custom",
]
```

### 5. Test Arrays

```python
# Python tests
ALL_FACT_TYPES = [
    "preference",
    # ... other values ...
    "NEW_VALUE",  # ← Add here
    "custom",
]
```

```typescript
// TypeScript tests
const ALL_FACT_TYPES = [
  "preference",
  // ... other values ...
  "NEW_VALUE", // ← Add here
  "custom",
] as const;
```

## File Organization

### Python SDK Tests

```
cortex-sdk-python/tests/
├── test_facts_filters.py          # 43 tests (35 parametrized + 8 edge cases)
├── test_conversations_filters.py   # 15 tests (6 parametrized + 9 edge cases)
├── test_contexts_filters.py        # 16 tests (8 parametrized + 8 edge cases)
└── test_memory_spaces_filters.py   # 16 tests (6 parametrized + 10 edge cases)
```

### TypeScript SDK Tests

```
tests/
├── facts-filters.test.ts           # 43 tests (35 parametrized + 8 edge cases)
├── conversations-filters.test.ts   # 15 tests (6 parametrized + 9 edge cases)
├── contexts-filters.test.ts        # 16 tests (8 parametrized + 8 edge cases)
└── memory-spaces-filters.test.ts   # 16 tests (6 parametrized + 10 edge cases)
```

## How Parametrized Tests Work

### Python (`@pytest.mark.parametrize`)

```python
@pytest.mark.parametrize("fact_type", ["preference", "identity", "knowledge"])
async def test_example(cortex, fact_type):
    # This test runs 3 times:
    # 1. test_example[preference]
    # 2. test_example[identity]
    # 3. test_example[knowledge]
    assert fact_type in ["preference", "identity", "knowledge"]
```

### TypeScript (`describe.each` / `test.each`)

```typescript
describe.each(["preference", "identity", "knowledge"])(
  "Type: %s",
  (factType) => {
    it("should work", () => {
      // This test runs 3 times:
      // 1. Type: preference - should work
      // 2. Type: identity - should work
      // 3. Type: knowledge - should work
      expect(["preference", "identity", "knowledge"]).toContain(factType);
    });
  },
);
```

## Test Validation Pattern

Each filter test should validate:

1. **Operation succeeds** - No `ArgumentValidationError`
2. **Results match filter** - All returned items have the filtered enum value
3. **Target item found** - The specific test item is in results
4. **Noise filtered out** - Items with different enum values are excluded

```python
# Example validation
results = await cortex.facts.list(factType="observation")

# 1. No error (implicit - if error, test fails)

# 2. All results match filter
for fact in results:
    assert fact["fact_type"] == "observation"

# 3. Target item found
assert target_fact_id in [f["fact_id"] for f in results]

# 4. Noise filtered out (implicit - validated by assertion #2)
```

## Benefits of This Approach

### 1. Early Detection

Catches enum inconsistencies immediately when new values are added.

### 2. Comprehensive Coverage

Tests every enum value in every operation, not just one example.

### 3. Regression Protection

New enum values have automatic test coverage via parametrized tests.

### 4. Clear Failures

When a test fails, you know exactly which enum value and which operation has the problem:

```
FAILED test_facts_filters.py::TestFactsFilterParametrized::test_list_filters_by_fact_type[observation]
```

### 5. Low Maintenance

Adding a new enum value to the test array automatically creates tests for all operations.

## CI/CD Integration

### Pre-Commit Hook (Recommended)

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Run enum filter tests before committing
pytest cortex-sdk-python/tests/test_*_filters.py -v
npm test -- tests/*-filters.test.ts

if [ $? -ne 0 ]; then
  echo "Enum filter tests failed. Please fix before committing."
  exit 1
fi
```

### GitHub Actions

```yaml
# .github/workflows/test.yml
- name: Run Enum Filter Tests
  run: |
    pytest cortex-sdk-python/tests/test_*_filters.py -v
    npm test -- tests/*-filters.test.ts
```

## Common Pitfalls

### 1. Forgetting Query Functions

✗ Update schema and `store` mutation only  
✓ Update ALL query functions that accept the enum

### 2. Testing Only One Example

✗ Test `factType="preference"` only  
✓ Use parametrized tests to test ALL values

### 3. Not Testing New Values

✗ Add enum, assume it works  
✓ Add to test array, verify all operations work

### 4. Testing Backend Without SDKs

✗ Backend works, but SDK types not updated  
✓ Test both backend and SDK in sync

### 5. Manual Test Updates

✗ Manually add test for each new enum value  
✓ Add to test array, parametrized tests auto-generate

## Related Issues

- **Issue**: "observation" factType bug (January 2025)
- **Fix**: `dev-docs/FACTS-OBSERVATION-BUG-FIX.md`
- **Prevention**: This testing strategy

## Summary

**When adding a new enum value:**

1. ✓ Update schema
2. ✓ Update mutation validator
3. ✓ Update ALL query function validators
4. ✓ Update SDK types
5. ✓ Add to test array (parametrized tests auto-generate)
6. ✓ Run filter tests to verify

**Result**: No more enum consistency bugs!

---

**Created**: January 11, 2025  
**Author**: AI Assistant  
**Related**: `FACTS-OBSERVATION-BUG-FIX.md`, Test files in `tests/` and `cortex-sdk-python/tests/`
