# Helper Methods Explained

**Bonus features** not in documentation but included in SDK for better developer experience.

---

## 📊 Where Helper Methods Work

| Helper Method | Layer 1a (Conversations) | Layer 1b (Immutable) | Layer 1c (Mutable)            |
| ------------- | ------------------------ | -------------------- | ----------------------------- |
| `increment()` | ❌ No                    | ❌ No                | ✅ **Yes**                    |
| `decrement()` | ❌ No                    | ❌ No                | ✅ **Yes**                    |
| `getRecord()` | ❌ No                    | ❌ No                | ✅ **Yes**                    |
| `purge()`     | ❌ No                    | ✅ Yes (documented)  | ✅ **Yes** (alias for delete) |

**All 3 helper methods are Mutable-only features!**

---

## 🎯 Why Mutable-Only?

### increment() & decrement()

**Purpose**: Atomic numeric operations  
**Use case**: Counters, inventory, metrics

**Why Mutable only**:

- ✅ Mutable stores current values (perfect for counters)
- ❌ Conversations are append-only (no numeric updates)
- ❌ Immutable creates new versions (use store() instead)

**Example**:

```typescript
// Mutable - PERFECT for counters
await cortex.mutable.increment("counters", "page-views", 1);
await cortex.mutable.decrement("inventory", "widget-qty", 10);

// Conversations - N/A (append-only messages)
// Immutable - N/A (versioned, not counters)
```

---

### getRecord()

**Purpose**: Get full record with metadata, not just value  
**Use case**: Access createdAt, updatedAt, accessCount

**Why Mutable only**:

- ✅ Mutable has `get()` that returns just the value
- ✅ `getRecord()` returns the full record with timestamps
- ❌ Conversations `get()` already returns full conversation
- ❌ Immutable `get()` already returns full record with versions

**Example**:

```typescript
// Mutable - get() returns value only
const value = await cortex.mutable.get("config", "timeout");
console.log(value); // 30

// Mutable - getRecord() returns full record
const record = await cortex.mutable.getRecord("config", "timeout");
console.log(record.value); // 30
console.log(record.createdAt); // 1234567890
console.log(record.accessCount); // 15

// Conversations - get() already returns full conversation
const conv = await cortex.conversations.get("conv-123");
// Has: conversationId, messages, messageCount, createdAt, etc.

// Immutable - get() already returns full record
const entry = await cortex.immutable.get("kb-article", "guide");
// Has: type, id, version, previousVersions, data, createdAt, etc.
```

---

## 📋 Complete Mutable API List

### Documented Operations (10)

1. `set()` - Set/overwrite value ✅
2. `get()` - Get value only ✅
3. `update()` - Atomic update with function ✅
4. `delete()` - Delete key ✅
5. `transaction()` - ACID multi-key ⏳ v0.4.0
6. `list()` - List keys ✅
7. `count()` - Count keys ✅
8. `exists()` - Check existence ✅
9. `purgeNamespace()` - Delete all in namespace ✅
10. `purgeMany()` - Bulk delete with filters ✅

### Bonus Helper Methods (4)

11. `increment()` - Atomic increment ✅ **Bonus**
12. `decrement()` - Atomic decrement ✅ **Bonus**
13. `getRecord()` - Get full record ✅ **Bonus**
14. `purge()` - Alias for delete() ✅ **Bonus** (for API consistency)

**Total**: 13 methods (10 documented + 4 bonus)

---

## 🎯 Why These Helpers Matter

### Before (without helpers)

```typescript
// Increment counter - verbose
const current = await cortex.mutable.get("counters", "views");
await cortex.mutable.set("counters", "views", (current || 0) + 1);
// Race condition risk!

// Get metadata - need getRecord
const value = await cortex.mutable.get("config", "setting");
// Can't access createdAt, updatedAt, accessCount
```

### After (with helpers)

```typescript
// Increment counter - clean & atomic
await cortex.mutable.increment("counters", "views", 1);
// No race conditions!

// Get with metadata
const record = await cortex.mutable.getRecord("config", "setting");
console.log(record.value, record.createdAt, record.accessCount);
```

---

## 📊 Summary by Layer

### Layer 1a: Conversations

- **Operations**: 14 (all documented)
- **Helpers**: 0
- **Reason**: Append-only architecture doesn't need numeric helpers

### Layer 1b: Immutable

- **Operations**: 11 (all documented)
- **Helpers**: 0
- **Reason**: Versioning handles all update patterns

### Layer 1c: Mutable

- **Operations**: 10 documented + 4 bonus = 14 total
- **Helpers**: 4 (increment, decrement, getRecord, purge-alias)
- **Reason**: Live data benefits from convenience methods

---

## ✅ Current Status

**Total Operations Across All Layers**:

- Documented: 35 operations
- Implemented: 37 operations (35 + 3 bonus + 1 alias)
- Only deferred: `transaction()` (1 complex operation)

**Completion**: 97% of documented (37/38 if counting transaction)

---

**Helper methods are Mutable-only features that make working with live data easier!** 🎯
