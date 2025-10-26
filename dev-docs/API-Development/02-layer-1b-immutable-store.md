# Layer 1b: Immutable Store API

**Status**: ⏳ **PENDING**  
**Started**: TBD  
**Target Completion**: TBD

---

## 📦 Overview

Versioned immutable data storage for user profiles, knowledge base articles, and other data that changes infrequently but needs version history.

## 🎯 Planned Features

- ✅ Store immutable entries with automatic versioning
- ✅ Multiple entry types (user, kb-article, etc.)
- ✅ Previous version history (configurable retention)
- ✅ Query by type + id
- ✅ Search across entries
- ✅ GDPR cascade deletion support (via userId field)

## 📋 TODO

### Schema

- [ ] Define `immutable` table
- [ ] Add indexes: `by_type_id`, `by_userId`, `by_type`, `by_created`
- [ ] Define version retention policy

### Backend (Convex)

- [ ] `store` - Create/update entry with versioning
- [ ] `get` - Retrieve entry by type + id
- [ ] `getVersion` - Get specific version
- [ ] `list` - List entries with filters
- [ ] `count` - Count entries
- [ ] `delete` - Delete entry (GDPR)

### Types

- [ ] `ImmutableEntry` interface
- [ ] `ImmutableVersion` interface
- [ ] `StoreImmutableInput` interface
- [ ] `ListImmutableFilter` interface

### SDK

- [ ] `cortex.immutable.store(type, id, data)`
- [ ] `cortex.immutable.get(type, id)`
- [ ] `cortex.immutable.getVersion(type, id, version)`
- [ ] `cortex.immutable.list(filter)`
- [ ] `cortex.immutable.count(filter)`
- [ ] `cortex.immutable.delete(type, id)`

### Tests

- [ ] Store operations (create, update with versioning)
- [ ] Retrieval operations
- [ ] Version history validation
- [ ] List and count operations
- [ ] Delete operations
- [ ] GDPR cascade validation
- [ ] Storage validation

## 🗄️ Planned Schema

```typescript
immutable: defineTable({
  type: v.string(), // 'user', 'kb-article', etc.
  id: v.string(), // Type-specific ID
  data: v.any(), // Flexible data
  userId: v.optional(v.string()), // For GDPR cascade

  // Versioning
  version: v.number(),
  previousVersions: v.array(
    v.object({
      version: v.number(),
      data: v.any(),
      timestamp: v.number(),
    }),
  ),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_type_id", ["type", "id"])
  .index("by_userId", ["userId"])
  .index("by_type", ["type"])
  .index("by_created", ["createdAt"]);
```

## 🔧 Planned SDK API

```typescript
// Store (create or update with versioning)
await cortex.immutable.store("user", "user-123", {
  name: "Alex",
  email: "alex@example.com",
});

// Get current version
const entry = await cortex.immutable.get("user", "user-123");

// Get specific version
const v2 = await cortex.immutable.getVersion("user", "user-123", 2);

// List by type
const users = await cortex.immutable.list({ type: "user" });

// Delete (GDPR)
await cortex.immutable.delete("user", "user-123");
```

## 📚 Reference Documentation

- [Immutable Store API Docs](../../Documentation/03-api-reference/07-immutable-store-api.md)
- [Data Models Architecture](../../Documentation/04-architecture/02-data-models.md)

---

**Status**: ⏳ Waiting for Layer 1a completion  
**Depends On**: Conversations API (Layer 1a) ✅  
**Next**: Layer 1c (Mutable Store)
