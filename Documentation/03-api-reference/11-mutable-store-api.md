# Mutable Store API

> **Last Updated**: 2025-10-24

Complete API reference for shared mutable data with ACID transaction guarantees.

## Overview

The Mutable Store API (Layer 1c) provides methods for storing shared, mutable data across all agents. Designed for live, frequently-changing data like inventory, counters, live documentation, and shared state.

**Key Characteristics:**

- ✅ **Shared** - All agents can access
- ✅ **Mutable** - Designed to be updated
- ✅ **ACID** - Atomic transactions
- ✅ **Current-value** - No version history
- ✅ **Fast** - Optimized for frequent updates
- ✅ **Purgeable** - Can delete keys

**Comparison to Other Stores:**

| Feature    | Conversations (1a) | Immutable (1b) | Mutable (1c)  | Vector (2)   |
| ---------- | ------------------ | -------------- | ------------- | ------------ |
| Privacy    | Private            | Shared         | Shared        | Private      |
| Versioning | N/A (append)       | Auto           | **None**      | Auto         |
| Updates    | Append only        | New version    | **In-place**  | New version  |
| Use Case   | Chats              | Knowledge      | **Live data** | Search index |

---

## Core Operations

### set()

Set a key to a value (creates or overwrites).

**Signature:**

```typescript
cortex.mutable.set(
  namespace: string,
  key: string,
  value: any
): Promise<MutableRecord>
```

**Parameters:**

- `namespace` (string) - Logical grouping (e.g., 'inventory', 'config', 'counters')
- `key` (string) - Unique key within namespace
- `value` (any) - JSON-serializable value

**Returns:**

```typescript
interface MutableRecord {
  namespace: string;
  key: string;
  value: any;
  updatedAt: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessed?: Date;
}
```

**Example:**

```typescript
// Set inventory quantity
const record = await cortex.mutable.set("inventory", "widget-qty", 100);

console.log(record.value); // 100
console.log(record.updatedAt); // Current time

// Update (overwrites)
await cortex.mutable.set("inventory", "widget-qty", 95); // Now 95

// No version history - previous value (100) is gone!
```

**Errors:**

- `CortexError('INVALID_NAMESPACE')` - Namespace is empty or invalid
- `CortexError('INVALID_KEY')` - Key is empty or invalid
- `CortexError('VALUE_TOO_LARGE')` - Value exceeds size limit
- `CortexError('CONVEX_ERROR')` - Database error

---

### get()

Get current value for a key.

**Signature:**

```typescript
cortex.mutable.get(
  namespace: string,
  key: string
): Promise<any | null>
```

**Parameters:**

- `namespace` (string) - Namespace
- `key` (string) - Key

**Returns:**

- Value - Current value
- `null` - If key doesn't exist

**Side Effects:**

- Increments `accessCount`
- Updates `lastAccessed`

**Example:**

```typescript
const qty = await cortex.mutable.get("inventory", "widget-qty");

if (qty !== null) {
  console.log(`Current quantity: ${qty}`);

  if (qty > 0) {
    // Process order
  }
} else {
  console.log("Product not found");
}
```

---

### update()

Atomically update a value.

**Signature:**

```typescript
cortex.mutable.update(
  namespace: string,
  key: string,
  updater: (current: any) => any
): Promise<MutableRecord>
```

**Parameters:**

- `namespace` (string) - Namespace
- `key` (string) - Key
- `updater` (function) - Function that receives current value, returns new value

**Returns:**

- `MutableRecord` - Updated record

**Side Effects:**

- ACID: Read, compute, write atomically
- No race conditions (Convex handles locking)

**Example:**

```typescript
// Decrement inventory
await cortex.mutable.update("inventory", "widget-qty", (current) => {
  if (current === null || current <= 0) {
    throw new Error("Out of stock");
  }
  return current - 1;
});

// Increment counter
await cortex.mutable.update("counters", "total-refunds", (current) => {
  return (current || 0) + 1;
});

// Update object
await cortex.mutable.update("config", "api-settings", (current) => {
  return {
    ...current,
    endpoint: "https://api.example.com/v2",
    timeout: 30000,
  };
});
```

**Errors:**

- `CortexError('KEY_NOT_FOUND')` - Key doesn't exist
- `CortexError('UPDATE_FAILED')` - Updater function threw error
- `CortexError('CONVEX_ERROR')` - Database error

---

### delete()

Delete a key.

**Signature:**

```typescript
cortex.mutable.delete(
  namespace: string,
  key: string
): Promise<DeleteResult>
```

**Returns:**

```typescript
interface DeleteResult {
  deleted: boolean;
  namespace: string;
  key: string;
  deletedAt: Date;
}
```

**Example:**

```typescript
// Remove product from inventory
const result = await cortex.mutable.delete("inventory", "discontinued-widget");

console.log(`Deleted: ${result.deleted}`);
```

---

### transaction()

Execute multiple operations atomically.

**Signature:**

```typescript
cortex.mutable.transaction(
  callback: (tx: Transaction) => void | Promise<void>
): Promise<TransactionResult>
```

**Transaction Methods:**

```typescript
interface Transaction {
  set(namespace: string, key: string, value: any): void;
  get(namespace: string, key: string): any;
  update(namespace: string, key: string, updater: Function): void;
  delete(namespace: string, key: string): void;
}
```

**Example:**

```typescript
// Transfer inventory between products (atomic)
await cortex.mutable.transaction(async (tx) => {
  const qtyA = tx.get("inventory", "product-a");
  const qtyB = tx.get("inventory", "product-b");

  if (qtyA < 10) {
    throw new Error("Insufficient inventory for product-a");
  }

  tx.update("inventory", "product-a", (qty) => qty - 10);
  tx.update("inventory", "product-b", (qty) => qty + 10);

  // Both updates or neither (ACID)
});

// Record sale and update inventory (atomic)
await cortex.mutable.transaction(async (tx) => {
  tx.update("inventory", "widget-qty", (qty) => qty - 1);
  tx.update("counters", "total-sales", (count) => (count || 0) + 1);
  tx.update("counters", "revenue", (rev) => (rev || 0) + 49.99);
  // All or nothing
});
```

**Errors:**

- `CortexError('TRANSACTION_FAILED')` - Transaction rolled back
- `CortexError('TRANSACTION_TIMEOUT')` - Exceeded time limit

---

## Querying

### list()

List keys in a namespace.

**Signature:**

```typescript
cortex.mutable.list(
  namespace: string,
  filters?: MutableFilters
): Promise<MutableListResult>
```

**Parameters:**

```typescript
interface MutableFilters {
  keyPrefix?: string; // Keys starting with prefix
  updatedAfter?: Date;
  updatedBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: "key" | "updatedAt" | "accessCount";
  sortOrder?: "asc" | "desc";
}
```

**Example:**

```typescript
// List all inventory items
const items = await cortex.mutable.list("inventory", {
  sortBy: "key",
  limit: 100,
});

items.records.forEach((item) => {
  console.log(`${item.key}: ${item.value}`);
});

// List specific prefix
const widgets = await cortex.mutable.list("inventory", {
  keyPrefix: "widget-",
});
```

---

### count()

Count keys in namespace.

**Signature:**

```typescript
cortex.mutable.count(
  namespace: string,
  filters?: MutableFilters
): Promise<number>
```

**Example:**

```typescript
// Total inventory items
const total = await cortex.mutable.count("inventory");

// Items updated today
const updated = await cortex.mutable.count("inventory", {
  updatedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000),
});
```

---

### exists()

Check if key exists.

**Signature:**

```typescript
cortex.mutable.exists(
  namespace: string,
  key: string
): Promise<boolean>
```

**Example:**

```typescript
if (await cortex.mutable.exists("inventory", "widget-qty")) {
  const qty = await cortex.mutable.get("inventory", "widget-qty");
} else {
  // Initialize
  await cortex.mutable.set("inventory", "widget-qty", 100);
}
```

---

## Namespaces

### Common Namespaces

**inventory** - Product quantities

```typescript
await cortex.mutable.set("inventory", "product-x", 150);
await cortex.mutable.update("inventory", "product-x", (qty) => qty - 1);
```

**config** - Live configuration

```typescript
await cortex.mutable.set(
  "config",
  "api-endpoint",
  "https://api.example.com/v2",
);
await cortex.mutable.set("config", "max-retries", 3);
```

**counters** - Shared counters/metrics

```typescript
await cortex.mutable.update("counters", "total-requests", (n) => (n || 0) + 1);
await cortex.mutable.update("counters", "active-users", (n) => n + 1);
```

**docs** - Live documentation references

```typescript
await cortex.mutable.set("docs", "api-version", "v2.1.0");
await cortex.mutable.set(
  "docs",
  "changelog-url",
  "https://docs.example.com/changelog",
);
```

**state** - Agent collaboration state

```typescript
await cortex.mutable.set("state", "active-campaign-id", "camp-2025-q4");
await cortex.mutable.update("state", "agents-available", (list) => [
  ...list,
  "agent-5",
]);
```

---

## Best Practices

### 1. Use Descriptive Namespaces

```typescript
// ✅ Good namespaces
"inventory";
"config-production";
"counters-analytics";
"docs-api";

// ❌ Bad namespaces
"data";
"stuff";
"temp";
```

### 2. Atomic Operations Only

```typescript
// ❌ DON'T: Race condition
const current = await cortex.mutable.get("inventory", "widget-qty");
await cortex.mutable.set("inventory", "widget-qty", current - 1);
// Another agent could modify between get and set!

// ✅ DO: Atomic update
await cortex.mutable.update("inventory", "widget-qty", (qty) => qty - 1);
// ACID guarantees no race condition
```

### 3. Initialize Before Use

```typescript
// Safe initialization
async function getOrInitialize(
  namespace: string,
  key: string,
  defaultValue: any,
) {
  const value = await cortex.mutable.get(namespace, key);
  if (value === null) {
    await cortex.mutable.set(namespace, key, defaultValue);
    return defaultValue;
  }
  return value;
}

const qty = await getOrInitialize("inventory", "new-product", 0);
```

### 4. Use Transactions for Multi-Key Operations

```typescript
// ✅ Atomic multi-key update
await cortex.mutable.transaction(async (tx) => {
  tx.update("inventory", "product-a", (qty) => qty - 1);
  tx.update("counters", "total-sales", (n) => n + 1);
  // Both or neither
});

// ❌ Non-atomic (could fail partway)
await cortex.mutable.update("inventory", "product-a", (qty) => qty - 1);
await cortex.mutable.update("counters", "total-sales", (n) => n + 1);
// Second could fail, leaving inconsistent state
```

---

## Integration with Vector Layer

Mutable data CAN be referenced by Vector memories (as snapshots):

```typescript
// 1. Store mutable data
await cortex.mutable.set(
  "config",
  "api-endpoint",
  "https://api.example.com/v2",
);

// 2. Create Vector memory referencing it (snapshot)
await cortex.vector.store("config-agent", {
  content: "API endpoint changed to v2",
  contentType: "raw",
  source: { type: "system", timestamp: new Date() },
  mutableRef: {
    namespace: "config",
    key: "api-endpoint",
    snapshotValue: "https://api.example.com/v2", // Value at time of indexing
    snapshotAt: new Date(),
  },
  metadata: {
    importance: 80,
    tags: ["config", "api"],
  },
});

// 3. Later, mutable value changes
await cortex.mutable.set(
  "config",
  "api-endpoint",
  "https://api.example.com/v3",
);

// Vector memory still has snapshot of v2
// Current value is v3 (from mutable store)
```

**Note:** Vector's mutableRef is a snapshot, not live. Use for audit/history, not current values.

---

## Purging

### purge()

Delete a single key.

**Signature:**

```typescript
cortex.mutable.purge(
  namespace: string,
  key: string
): Promise<PurgeResult>
```

**Example:**

```typescript
const result = await cortex.mutable.purge("inventory", "discontinued-product");
console.log(`Deleted: ${result.deleted}`);
```

---

### purgeNamespace()

Delete entire namespace.

**Signature:**

```typescript
cortex.mutable.purgeNamespace(
  namespace: string,
  options?: PurgeOptions
): Promise<PurgeResult>
```

**Example:**

```typescript
// Delete all test data
const result = await cortex.mutable.purgeNamespace("test-data");
console.log(`Deleted ${result.keysDeleted} keys`);

// Preview first
const preview = await cortex.mutable.purgeNamespace("old-config", {
  dryRun: true,
});
console.log(`Would delete ${preview.keysDeleted} keys`);
```

---

### purgeMany()

Delete keys matching filters.

**Signature:**

```typescript
cortex.mutable.purgeMany(
  namespace: string,
  filters: MutableFilters
): Promise<PurgeResult>
```

**Example:**

```typescript
// Delete old keys
await cortex.mutable.purgeMany("cache", {
  updatedBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
});

// Delete inactive keys
await cortex.mutable.purgeMany("state", {
  lastAccessedBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
});
```

---

## Use Cases

### Use Case 1: Live Inventory

```typescript
// Initialize inventory
await cortex.mutable.set("inventory", "widget-blue", 100);
await cortex.mutable.set("inventory", "widget-red", 75);

// Customer orders (atomic decrement)
await cortex.mutable.update("inventory", "widget-blue", (qty) => {
  if (qty <= 0) throw new Error("Out of stock");
  return qty - 1;
});

// Check availability
const available = await cortex.mutable.get("inventory", "widget-blue");
console.log(`${available} widgets available`);

// Restock (atomic increment)
await cortex.mutable.update("inventory", "widget-blue", (qty) => qty + 50);
```

### Use Case 2: Live Configuration

```typescript
// Set configuration
await cortex.mutable.set("config", "max-concurrent-chats", 5);
await cortex.mutable.set(
  "config",
  "api-endpoint",
  "https://api.example.com/v1",
);

// Agents check config
const maxChats = await cortex.mutable.get("config", "max-concurrent-chats");
if (activeChats < maxChats) {
  // Accept new chat
}

// Update config (immediate effect for all agents)
await cortex.mutable.set("config", "max-concurrent-chats", 10);
```

### Use Case 3: Shared Counters

```typescript
// Initialize counters
await cortex.mutable.set("counters", "total-requests", 0);
await cortex.mutable.set("counters", "successful-requests", 0);
await cortex.mutable.set("counters", "failed-requests", 0);

// Each agent increments (atomic)
await cortex.mutable.update("counters", "total-requests", (n) => n + 1);

if (requestSucceeded) {
  await cortex.mutable.update("counters", "successful-requests", (n) => n + 1);
} else {
  await cortex.mutable.update("counters", "failed-requests", (n) => n + 1);
}

// Get stats
const total = await cortex.mutable.get("counters", "total-requests");
const success = await cortex.mutable.get("counters", "successful-requests");
console.log(`Success rate: ${((success / total) * 100).toFixed(1)}%`);
```

### Use Case 4: Agent Collaboration State

```typescript
// Track active campaign
await cortex.mutable.set('state', 'active-campaign', {
  id: 'camp-2025-q4',
  name: 'Q4 Promotion',
  startDate: '2025-10-01',
  endDate: '2025-12-31',
  participating agents: ['marketing-agent', 'sales-agent']
});

// Agents check current campaign
const campaign = await cortex.mutable.get('state', 'active-campaign');
if (campaign && Date.now() < new Date(campaign.endDate).getTime()) {
  // Apply campaign logic
}

// Update participating agents (atomic)
await cortex.mutable.update('state', 'active-campaign', (camp) => {
  return {
    ...camp,
    participatingAgents: [...camp.participatingAgents, 'support-agent']
  };
});
```

---

## Performance

### Optimized for Frequent Updates

```typescript
// Mutable store is designed for high-frequency updates
for (let i = 0; i < 1000; i++) {
  await cortex.mutable.update("counters", "page-views", (n) => n + 1);
}
// Fast! No versioning overhead
```

### Caching Recommendations

```typescript
// For frequently-read, rarely-updated values
class MutableCache {
  private cache = new Map<string, { value: any; cachedAt: Date }>();
  private ttl = 60000; // 60 second cache

  async get(namespace: string, key: string) {
    const cacheKey = `${namespace}:${key}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt.getTime() < this.ttl) {
      return cached.value;
    }

    const value = await cortex.mutable.get(namespace, key);
    this.cache.set(cacheKey, { value, cachedAt: new Date() });
    return value;
  }
}
```

---

## Limitations

### No Version History

```typescript
// Version 1
await cortex.mutable.set("config", "timeout", 30);

// Version 2 (v1 is GONE)
await cortex.mutable.set("config", "timeout", 60);

// Can't retrieve v1 - it's overwritten!
const current = await cortex.mutable.get("config", "timeout");
console.log(current); // 60 only

// If you need history, use immutable store instead!
```

### Backup Strategy

```typescript
// Snapshot mutable data for backups
async function backupMutableNamespace(namespace: string) {
  const all = await cortex.mutable.list(namespace);

  const backup = {
    namespace,
    timestamp: new Date(),
    data: all.records.reduce(
      (acc, record) => {
        acc[record.key] = record.value;
        return acc;
      },
      {} as Record<string, any>,
    ),
  };

  // Store backup (could use immutable store or external storage)
  await cortex.immutable.store({
    type: "mutable-backup",
    id: `${namespace}-backup-${Date.now()}`,
    data: backup,
  });

  return backup;
}

// Restore from backup
async function restoreMutableNamespace(backupId: string) {
  const backup = await cortex.immutable.get("mutable-backup", backupId);

  for (const [key, value] of Object.entries(backup.data.data)) {
    await cortex.mutable.set(backup.data.namespace, key, value);
  }
}
```

---

## Summary

**Mutable Store provides:**

- ✅ Shared live data across agents
- ✅ ACID transaction guarantees
- ✅ Current-value semantics (fast)
- ✅ No version overhead
- ✅ Atomic updates (no race conditions)

**Use for:**

- Real-time inventory
- Live configuration
- Shared counters/metrics
- Agent collaboration state
- Frequently-changing reference data

**Don't use for:**

- Data needing version history (use `cortex.immutable.*`)
- Private conversations (use `cortex.conversations.*`)
- Searchable knowledge (use `cortex.vector.*` + immutable)
- Audit trails (use `cortex.immutable.*` for versioning)

---

## Next Steps

- **[Immutable Store API](./10-immutable-store-api.md)** - Versioned shared data
- **[Conversation Operations API](./06-conversation-operations-api.md)** - Private conversations
- **[Governance Policies API](./12-governance-policies-api.md)** - Multi-layer retention rules

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
