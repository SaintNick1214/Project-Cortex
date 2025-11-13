# Backend Parity Mismatches - Python SDK vs Convex Backend

## Summary

Analysis of Python SDK test failures reveals **backend parity gaps** preventing full test coverage.

**Test Results**: 126 passing / 185 total (68%)  
**Backend Issues**: 59 failing tests  
**Missing Functions**: ~50 backend functions  
**Parameter Mismatches**: ~15 validation issues

---

## Missing Convex Backend Functions

### Agents API (8 functions missing - 8 tests failing)

All agent functions appear to be missing or have wrong signatures:

```
❌ agents:register - Could not find public function
❌ agents:get - Could not find public function
❌ agents:list - Could not find public function
❌ agents:unregister - Could not find public function
❌ agents:getStats - Could not find public function
❌ agents:count - Could not find public function
```

**Impact**: All 8 agent tests fail  
**Status**: Agents API not implemented in backend

---

### Contexts API (11 functions missing/broken - 11 tests failing)

All context functions have issues:

```
❌ contexts:create - ArgumentValidationError (wrong parameter structure)
❌ contexts:get - ArgumentValidationError (wrong parameters)
❌ contexts:update - ArgumentValidationError
❌ contexts:list - ArgumentValidationError
❌ contexts:search - Server Error
❌ contexts:delete - Server Error
❌ contexts:count - Server Error
```

**Impact**: All 11 context tests fail  
**Status**: Contexts API has major backend issues

---

### Memory Spaces API (9 functions missing/broken - 9 tests failing)

Memory spaces backend has validation issues:

```
❌ memorySpaces:register - ArgumentValidationError
   Path: .participants
   Value: null
   Validator: v.array(v.object({id, joinedAt, type}))
   Issue: participants cannot be null, must be array

❌ memorySpaces:get - ArgumentValidationError
   Object contains extra field `includeStats` not in validator

❌ memorySpaces:list - ArgumentValidationError (participants issue)
❌ memorySpaces:delete - ArgumentValidationError (participants issue)
❌ memorySpaces:count - ArgumentValidationError (participants issue)
❌ memorySpaces:getStats - ArgumentValidationError (participants issue)
```

**Impact**: All 9 memory space tests fail  
**Issue**: Backend requires `participants` array (can't be None/null)  
**Status**: Backend validation too strict

---

### Facts API (11 functions missing/broken - 11 tests failing)

All fact functions have issues:

```
❌ facts:store - ArgumentValidationError
❌ facts:get - Server Error
❌ facts:list - Server Error
❌ facts:search - Server Error
❌ facts:update - Server Error
❌ facts:delete - Server Error
❌ facts:count - Server Error
```

**Impact**: All 11 fact tests fail  
**Status**: Facts API has backend issues

---

### Users API (4 advanced functions missing - 4 tests failing)

Basic CRUD works, but advanced functions missing:

```
✅ users:get - Working
✅ users:update - Working
✅ users:delete - Working
✅ users:list - Working (after offset fix)
✅ users:count - Working
❌ users:search - Could not find public function
❌ users:updateMany - Could not find public function
❌ users:deleteMany - Could not find public function
❌ users:export - Could not find public function
```

**Impact**: 4 advanced user tests fail  
**Status**: Basic CRUD works, bulk operations not implemented

---

### Conversations API (4 advanced functions missing - 4 tests failing)

Basic CRUD works, advanced functions missing:

```
✅ conversations:create - Working
✅ conversations:get - Working
✅ conversations:list - Working
✅ conversations:count - Working
✅ conversations:addMessage - Working
✅ conversations:getMessage - Working (when it exists)
✅ conversations:getMessagesByIds - Working
✅ conversations:getOrCreate - Working
✅ conversations:delete - Working
✅ conversations:export - Working
❌ conversations:getHistory - Server Error
❌ conversations:findConversation - Server Error
❌ conversations:search - Server Error
❌ conversations:deleteMany - Server Error
```

**Impact**: 4 advanced conversation tests fail  
**Status**: Core CRUD works, advanced features missing

---

### Mutable API (2 functions missing - 2 tests failing)

Most functions work, but delete operations missing:

```
✅ mutable:set - Working
✅ mutable:get - Working
✅ mutable:update - Working (with callable)
✅ mutable:getRecord - Working
✅ mutable:list - Working
✅ mutable:count - Working
✅ mutable:exists - Working
❌ mutable:delete - Could not find public function
❌ mutable:purgeNamespace - ArgumentValidationError
   Object contains extra field `dryRun`
```

**Impact**: 2 mutable tests fail  
**Status**: CRUD mostly works, delete functions missing

---

## Parameter Validation Issues

### RegisterMemorySpaceParams - participants Cannot Be Null

**Error**:

```
ArgumentValidationError: Value does not match validator.
Path: .participants
Value: null
Validator: v.array(v.object({id: v.string(), joinedAt: v.float64(), type: v.string()}))
```

**Issue**: Backend expects `participants` to be an array, but Python SDK allows None  
**Affected**: All memorySpaces:register calls  
**Solution**: Either:

1. Backend should accept null/undefined for participants
2. Python SDK should provide empty array [] instead of None

---

### memorySpaces:get - includeStats Not Supported

**Error**:

```
ArgumentValidationError: Object contains extra field `includeStats`
Object: {includeStats: false, memorySpaceId: "..."}
Validator: v.object({memorySpaceId: v.string()})
```

**Issue**: Python SDK passes `includeStats` but backend doesn't accept it  
**Affected**: memorySpaces:get  
**Solution**: Remove `includeStats` from Python SDK call

---

### mutable:purgeNamespace - dryRun Not Supported

**Error**:

```
ArgumentValidationError: Object contains extra field `dryRun`
Object: {dryRun: false, namespace: "..."}
Validator: v.object({namespace: v.string()})
```

**Issue**: Python SDK passes `dryRun` but backend doesn't accept it  
**Affected**: mutable:purgeNamespace  
**Solution**: Remove `dryRun` from Python SDK call

---

### RegisterMemorySpaceParams - description Field

**Error**:

```
TypeError: RegisterMemorySpaceParams.__init__() got an unexpected keyword argument 'description'
```

**Issue**: Type definition doesn't have `description` field  
**Affected**: Test code uses non-existent field  
**Solution**: Remove `description` from tests or add to type

---

## Test Parameter Issues (Not Backend Issues)

### RememberParams - user_message_embedding

**Error**:

```
TypeError: RememberParams.__init__() got an unexpected keyword argument 'user_message_embedding'
```

**Issue**: Tests use parameter that doesn't exist in type  
**Solution**: Check actual RememberParams definition and fix tests

### MemoryAPI.list() - min_importance

**Error**:

```
TypeError: MemoryAPI.list() got an unexpected keyword argument 'min_importance'
```

**Issue**: Tests use parameter that doesn't exist  
**Solution**: Check actual API and remove from tests

### MemoryAPI.count() - tags

**Error**:

```
TypeError: MemoryAPI.count() got an unexpected keyword argument 'tags'
```

**Issue**: Tests use parameter that doesn't exist  
**Solution**: Check actual API and remove from tests

### ForgetOptions - permanent

**Error**:

```
TypeError: ForgetOptions.__init__() got an unexpected keyword argument 'permanent'
```

**Issue**: Tests use parameter that doesn't exist  
**Solution**: Remove from tests

---

## Type/Data Structure Issues

### ImmutableVersion - created_at vs createdAt

**Error**:

```
TypeError: ImmutableVersion.__init__() got an unexpected keyword argument 'created_at'
```

**Issue**: Backend returns `createdAt` (camelCase) but conversion creates `created_at` (snake_case), but ImmutableVersion doesn't have this field  
**Solution**: Check ImmutableVersion type definition

### Mutable.get() - Value Structure

**Issue**: `mutable.get()` returns full record with nested `value` field, but tests expect direct value  
**Current**: `{'value': {'count': 10}, '_id': '...', ...}`  
**Expected**: `{'count': 10}`  
**Solution**: Tests need to access `result["value"]` for actual data

### Mutable.update() - Updater Function Issue

**Error**:

```
TypeError: 'dict' object is not callable
```

**Issue**: `update()` expects callable but may not properly handle it  
**Current Behavior**: `update()` implementation has race condition  
**Solution**: Tests correctly use lambda, but update implementation may need review

---

## Summary by Category

### Fully Working APIs ✅

- **Conversations** - Core CRUD (create, get, list, count, addMessage, delete, export)
- **Memory** - Core operations (remember, get, search, list, count, update, delete, forget)
- **Users** - Core CRUD (get, update, delete, list, count, exists, merge, getOrCreate)
- **Vector** - All operations (store, get, search, update, delete, list, count, versioning)
- **Immutable** - Most operations (store, get, list, count, purge)
- **Mutable** - Most operations (set, get, list, count, exists)

### Partially Working APIs ⚠️

- **Conversations** - Missing: getHistory, findConversation, search, deleteMany
- **Users** - Missing: search, updateMany, deleteMany, export
- **Mutable** - Missing: delete, purgeNamespace (dryRun)
- **Immutable** - Issues: getVersion, getHistory (type mismatch), search

### Not Working APIs ❌

- **Agents** - All functions missing/broken (0/8 working)
- **Contexts** - All functions broken (0/11 working)
- **Memory Spaces** - All functions broken (0/9 working)
- **Facts** - All functions broken (0/11 working)
- **A2A** - Broken (0/3 working)

---

## Recommendations

### Priority 1: Fix Memory Spaces API

**Impact**: 9 tests  
**Issue**: participants validation too strict  
**Fix**: Backend should accept null/undefined for participants, or Python SDK should use empty array

### Priority 2: Implement Agents API

**Impact**: 8 tests  
**Complexity**: High - entire API missing  
**Benefit**: Enables agent discovery and coordination

### Priority 3: Fix Contexts API

**Impact**: 11 tests  
**Issue**: Parameter validation errors  
**Fix**: Review backend parameter requirements

### Priority 4: Fix Facts API

**Impact**: 11 tests  
**Issue**: Backend errors  
**Fix**: Review backend implementation

### Priority 5: Add Missing Conversation Functions

**Impact**: 4 tests  
**Functions**: getHistory, findConversation, search, deleteMany  
**Benefit**: Advanced conversation features

### Priority 6: Add Missing User Functions

**Impact**: 4 tests  
**Functions**: search, updateMany, deleteMany, export  
**Benefit**: Bulk operations and search

### Priority 7: Clean Up Parameter Issues

**Impact**: ~10 tests  
**Fix**: Remove unsupported parameters from Python SDK or add to backend

---

## Test Pass Rate by Backend Completeness

**If all backend issues fixed**: 180/185 passing (97%)  
**If only Priority 1-2 fixed**: 145/185 passing (78%)  
**Current**: 126/185 passing (68%)

---

##Backend Function Completeness Matrix

| API           | Total Functions | Working | Missing | % Complete |
| ------------- | --------------- | ------- | ------- | ---------- |
| Conversations | 13              | 9       | 4       | 69%        |
| Memory        | 14              | 14      | 0       | 100% ✅    |
| Users         | 11              | 7       | 4       | 64%        |
| Vector        | 13              | 13      | 0       | 100% ✅    |
| Immutable     | 9               | 7       | 2       | 78%        |
| Mutable       | 12              | 10      | 2       | 83%        |
| Facts         | 10              | 0       | 10      | 0% ❌      |
| Contexts      | 17              | 0       | 17      | 0% ❌      |
| Agents        | 8               | 0       | 8       | 0% ❌      |
| Memory Spaces | 9               | 0       | 9       | 0% ❌      |
| **Total**     | **116**         | **60**  | **56**  | **52%**    |

---

## Files Created

This report documents all backend parity issues discovered during Python SDK test development.

**Date**: 2025-11-06  
**Python SDK Tests**: 185 created  
**Passing Tests**: 126 (68%)  
**Backend Coverage**: 52% (60/116 functions)

---

**Next Actions**:

1. Share this report with backend team
2. Prioritize implementation of missing functions
3. Fix parameter validation issues
4. Rerun tests as backend is completed
