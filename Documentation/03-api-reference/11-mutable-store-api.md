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
  value: any,
  userId?: string
): Promise<MutableRecord>
```

**Parameters:**

- `namespace` (string) - Logical grouping (e.g., 'inventory', 'config', 'counters')
- `key` (string) - Unique key within namespace
- `value` (any) - JSON-serializable value
- `userId` (string, optional) - Link to user (enables GDPR cascade). Must reference existing user.

**Returns:**

```typescript
interface MutableRecord {
  namespace: string;
  key: string;
  value: any;
  userId?: string; // OPTIONAL: User link (GDPR-enabled)
  updatedAt: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessed?: Date;
}
```

**Example 1: System data (no userId)**

```typescript
// Set inventory quantity (system-wide)
const record = await cortex.mutable.set("inventory", "widget-qty", 100);

console.log(record.value); // 100
console.log(record.userId); // undefined (system data)

// Update (overwrites)
await cortex.mutable.set("inventory", "widget-qty", 95); // Now 95

// No version history - previous value (100) is gone!
```

**Example 2: User-specific data (with userId)**

```typescript
// Set user session data (GDPR-enabled)
const session = await cortex.mutable.set(
  "user-sessions",
  "session-abc123",
  {
    startedAt: new Date(),
    lastActivity: new Date(),
    pagesViewed: 5,
  },
  "user-123", // ← Links to user (enables GDPR cascade)
);

console.log(session.userId); // "user-123"

// When user requests deletion:
await cortex.users.delete("user-123", { cascade: true });
// This session is automatically deleted! ✅
```

**Errors:**

- `CortexError('INVALID_NAMESPACE')` - Namespace is empty or invalid
- `CortexError('INVALID_KEY')` - Key is empty or invalid
- `CortexError('VALUE_TOO_LARGE')` - Value exceeds size limit
- `CortexError('USER_NOT_FOUND')` - userId doesn't reference existing user
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

## Complex Data Types

The Mutable Store supports **any JSON-serializable value**, not just primitives. You can store:

### Storing Objects

```typescript
// Store complex configuration object
await cortex.mutable.set("config", "email-settings", {
  smtp: {
    host: "smtp.example.com",
    port: 587,
    secure: true,
  },
  from: "noreply@example.com",
  templates: {
    welcome: "templates/welcome.html",
    reset: "templates/reset.html",
  },
});

// Retrieve and use
const emailConfig = await cortex.mutable.get("config", "email-settings");
sendEmail(emailConfig.smtp, emailConfig.from);
```

### Storing Arrays

```typescript
// Store product catalog
await cortex.mutable.set("inventory", "featured-products", [
  { id: "prod-1", name: "Widget A", price: 19.99, stock: 150 },
  { id: "prod-2", name: "Widget B", price: 29.99, stock: 75 },
  { id: "prod-3", name: "Widget C", price: 39.99, stock: 200 },
]);

// Atomically update array
await cortex.mutable.update("inventory", "featured-products", (products) => {
  return products.map((p) =>
    p.id === "prod-1" ? { ...p, stock: p.stock - 1 } : p,
  );
});
```

### Storing Nested Structures

```typescript
// Store complete store configuration
await cortex.mutable.set("stores", "store-15", {
  id: "store-15",
  name: "Downtown Location",
  address: {
    street: "123 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
  },
  hours: {
    monday: { open: "09:00", close: "21:00" },
    tuesday: { open: "09:00", close: "21:00" },
    sunday: { open: "10:00", close: "18:00" },
  },
  departments: [
    { name: "Produce", manager: "Alice" },
    { name: "Dairy", manager: "Bob" },
    { name: "Bakery", manager: "Carol" },
  ],
  metrics: {
    revenue: 125000,
    customersToday: 450,
    averageTransaction: 67.5,
  },
});
```

### Size Considerations

```typescript
// ✅ Good: Reasonable size (< 100KB recommended)
await cortex.mutable.set("config", "app-settings", {
  theme: "dark",
  language: "en",
  notifications: true,
  // ... dozens of settings
});

// ⚠️ Be careful: Very large objects (> 1MB)
await cortex.mutable.set("cache", "entire-product-catalog", {
  // Thousands of products...
  // Consider breaking into multiple keys instead
});

// ✅ Better: Split large datasets
await cortex.mutable.set("catalog", "page-1", products.slice(0, 100));
await cortex.mutable.set("catalog", "page-2", products.slice(100, 200));
await cortex.mutable.set("catalog", "page-3", products.slice(200, 300));
```

---

## Hierarchical Data Patterns

For hierarchical/relational data like "Produce" → "Inventory" → "Grocery Store 15" → "Grocery Stores", Cortex provides several patterns:

### Pattern 1: Hierarchical Keys (Recommended for Queries)

Use delimiters in keys to create hierarchies:

```typescript
// Pattern: namespace:key-with:delimiters
await cortex.mutable.set(
  "grocery-stores",
  "store-15:inventory:produce:apples",
  {
    quantity: 150,
    unit: "lbs",
    price: 2.99,
    supplier: "Local Farms",
  },
);

await cortex.mutable.set(
  "grocery-stores",
  "store-15:inventory:produce:bananas",
  {
    quantity: 200,
    unit: "lbs",
    price: 1.49,
    supplier: "Tropical Import Co",
  },
);

await cortex.mutable.set("grocery-stores", "store-15:inventory:dairy:milk", {
  quantity: 50,
  unit: "gallons",
  price: 4.99,
  supplier: "Dairy Fresh",
});

// Query all produce for store 15
const produce = await cortex.mutable.list("grocery-stores", {
  keyPrefix: "store-15:inventory:produce:",
});

// Query all inventory for store 15
const allInventory = await cortex.mutable.list("grocery-stores", {
  keyPrefix: "store-15:inventory:",
});
```

**Benefits:**

- Easy prefix queries
- Flat structure (no deep nesting)
- Good performance
- Easy to add/remove items

### Pattern 2: Hierarchical Namespaces

Use delimiters in namespaces for organizational hierarchy:

```typescript
// Pattern: hierarchical:namespace with flat keys
await cortex.mutable.set(
  "grocery-stores:store-15:inventory",
  "produce-apples",
  {
    quantity: 150,
    price: 2.99,
  },
);

await cortex.mutable.set(
  "grocery-stores:store-15:inventory",
  "produce-bananas",
  {
    quantity: 200,
    price: 1.49,
  },
);

await cortex.mutable.set(
  "grocery-stores:store-15:metrics",
  "daily-revenue",
  12500,
);
await cortex.mutable.set(
  "grocery-stores:store-15:metrics",
  "customer-count",
  450,
);

// Query entire namespace
const storeInventory = await cortex.mutable.list(
  "grocery-stores:store-15:inventory",
);
const storeMetrics = await cortex.mutable.list(
  "grocery-stores:store-15:metrics",
);
```

**Benefits:**

- Logical namespace organization
- Clear separation of concerns
- Easy to list all keys in a category

### Pattern 3: Nested Object Values (Recommended for Related Data)

Store hierarchy as nested object in value:

```typescript
// Store entire store hierarchy in one key
await cortex.mutable.set("grocery-stores", "store-15", {
  id: "store-15",
  name: "Downtown Location",
  inventory: {
    produce: {
      apples: { quantity: 150, price: 2.99, unit: "lbs" },
      bananas: { quantity: 200, price: 1.49, unit: "lbs" },
      oranges: { quantity: 100, price: 3.49, unit: "lbs" },
    },
    dairy: {
      milk: { quantity: 50, price: 4.99, unit: "gallons" },
      cheese: { quantity: 75, price: 6.99, unit: "lbs" },
    },
    bakery: {
      bread: { quantity: 100, price: 3.99, unit: "loaves" },
      donuts: { quantity: 200, price: 1.99, unit: "each" },
    },
  },
  metrics: {
    revenue: 12500,
    customers: 450,
    avgTransaction: 27.78,
  },
});

// Update specific nested value atomically
await cortex.mutable.update("grocery-stores", "store-15", (store) => ({
  ...store,
  inventory: {
    ...store.inventory,
    produce: {
      ...store.inventory.produce,
      apples: {
        ...store.inventory.produce.apples,
        quantity: store.inventory.produce.apples.quantity - 10,
      },
    },
  },
}));

// Or use helper function
async function updateNestedInventory(
  storeId: string,
  department: string,
  item: string,
  updates: Partial<any>,
) {
  await cortex.mutable.update("grocery-stores", storeId, (store) => ({
    ...store,
    inventory: {
      ...store.inventory,
      [department]: {
        ...store.inventory[department],
        [item]: {
          ...store.inventory[department][item],
          ...updates,
        },
      },
    },
  }));
}

await updateNestedInventory("store-15", "produce", "apples", { quantity: 140 });
```

**Benefits:**

- Single atomic update for related data
- Natural data representation
- Smaller transaction scope
- Easy to retrieve entire hierarchy

**Trade-offs:**

- Large objects can be slow to update
- Need careful atomic updates
- Harder to query subsets

### Pattern 4: Hybrid (Recommended for Large Systems)

Combine approaches for optimal performance:

```typescript
// Store metadata in nested object
await cortex.mutable.set("grocery-stores", "store-15-meta", {
  id: "store-15",
  name: "Downtown Location",
  address: { street: "123 Main St", city: "Springfield" },
  departments: ["produce", "dairy", "bakery"],
});

// Store inventory items individually with hierarchical keys
await cortex.mutable.set("inventory", "store-15:produce:apples", {
  quantity: 150,
  price: 2.99,
  unit: "lbs",
});

await cortex.mutable.set("inventory", "store-15:produce:bananas", {
  quantity: 200,
  price: 1.49,
  unit: "lbs",
});

// Store aggregated metrics separately
await cortex.mutable.set("metrics", "store-15-daily", {
  revenue: 12500,
  customers: 450,
  date: new Date().toISOString(),
});
```

**Benefits:**

- Optimal for large datasets
- Fast queries and updates
- Good separation of concerns
- Scalable architecture

### Helper Functions for Hierarchical Data

```typescript
// Parse hierarchical keys
function parseKey(key: string): string[] {
  return key.split(":");
}

function buildKey(...parts: string[]): string {
  return parts.join(":");
}

// Example usage
const key = buildKey("store-15", "inventory", "produce", "apples");
await cortex.mutable.set("grocery-stores", key, { quantity: 150 });

const parts = parseKey(key); // ["store-15", "inventory", "produce", "apples"]
console.log(`Store: ${parts[0]}, Department: ${parts[2]}, Item: ${parts[3]}`);

// Query helpers
async function listByPrefix(namespace: string, ...prefixParts: string[]) {
  const prefix = buildKey(...prefixParts);
  return await cortex.mutable.list(namespace, {
    keyPrefix: prefix,
  });
}

// Get all produce for store 15
const produce = await listByPrefix(
  "grocery-stores",
  "store-15",
  "inventory",
  "produce",
);

// Get all inventory for store 15
const inventory = await listByPrefix("grocery-stores", "store-15", "inventory");
```

### Choosing the Right Pattern

| Pattern                 | Best For                           | Query Performance | Update Performance | Complexity |
| ----------------------- | ---------------------------------- | ----------------- | ------------------ | ---------- |
| Hierarchical Keys       | Prefix queries, flat relationships | ⭐⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐         | Low        |
| Hierarchical Namespaces | Organizational structure           | ⭐⭐⭐⭐          | ⭐⭐⭐⭐⭐         | Low        |
| Nested Object Values    | Related data, small datasets       | ⭐⭐⭐            | ⭐⭐⭐             | Medium     |
| Hybrid                  | Large systems, mixed access        | ⭐⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐         | Medium     |

**Recommendations:**

- **Inventory systems**: Hierarchical Keys or Hybrid
- **Configuration**: Nested Object Values
- **Metrics/Analytics**: Hierarchical Keys
- **Multi-tenant data**: Hierarchical Namespaces
- **Small datasets (< 100 items)**: Nested Object Values
- **Large datasets (> 1000 items)**: Hierarchical Keys + Hybrid

### Complete Real-World Example: Grocery Store Chain

Here's a comprehensive example using the **Hybrid pattern** for a multi-store inventory system:

```typescript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Setup: Initialize grocery store chain
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Store chain metadata (nested object - small, related data)
await cortex.mutable.set("chain", "metadata", {
  name: "Fresh Foods Chain",
  totalStores: 25,
  headquarters: "Springfield, IL",
  storeIds: ["store-1", "store-15", "store-23"],
});

// Store individual store configs (nested object per store)
await cortex.mutable.set("stores", "store-15", {
  id: "store-15",
  name: "Downtown Location",
  address: "123 Main St, Springfield",
  manager: "Alice Johnson",
  departments: ["produce", "dairy", "bakery", "meat"],
  openHours: { open: "09:00", close: "21:00" },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inventory: Hierarchical keys (scalable, fast queries)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Set initial inventory (hierarchical keys: store:dept:item)
await cortex.mutable.set("inventory", "store-15:produce:apples", {
  quantity: 150,
  unit: "lbs",
  price: 2.99,
  supplier: "Local Farms",
  lastRestocked: new Date(),
});

await cortex.mutable.set("inventory", "store-15:produce:bananas", {
  quantity: 200,
  unit: "lbs",
  price: 1.49,
  supplier: "Tropical Import",
});

await cortex.mutable.set("inventory", "store-15:dairy:milk", {
  quantity: 50,
  unit: "gallons",
  price: 4.99,
  supplier: "Dairy Fresh",
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Operations: Customer purchases (atomic updates)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Customer buys 10 lbs of apples
await cortex.mutable.update("inventory", "store-15:produce:apples", (item) => {
  if (item.quantity < 10) {
    throw new Error("Insufficient stock");
  }
  return {
    ...item,
    quantity: item.quantity - 10,
  };
});

// Multi-item purchase (ACID transaction)
await cortex.mutable.transaction(async (tx) => {
  // Buy apples, bananas, and milk
  tx.update("inventory", "store-15:produce:apples", (item) => ({
    ...item,
    quantity: item.quantity - 5,
  }));

  tx.update("inventory", "store-15:produce:bananas", (item) => ({
    ...item,
    quantity: item.quantity - 3,
  }));

  tx.update("inventory", "store-15:dairy:milk", (item) => ({
    ...item,
    quantity: item.quantity - 2,
  }));

  // Update store metrics
  tx.update("metrics", "store-15-daily", (metrics) => ({
    ...metrics,
    sales: (metrics?.sales || 0) + 1,
    revenue: (metrics?.revenue || 0) + 24.43, // Total purchase
  }));

  // All updates succeed together or fail together
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries: Get inventory by hierarchy level
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get all produce for store 15
const produce = await cortex.mutable.list("inventory", {
  keyPrefix: "store-15:produce:",
});

console.log(`Store 15 produce items: ${produce.records.length}`);
produce.records.forEach((item) => {
  console.log(
    `- ${item.key.split(":")[2]}: ${item.value.quantity} ${item.value.unit}`,
  );
});

// Get ALL inventory for store 15
const allInventory = await cortex.mutable.list("inventory", {
  keyPrefix: "store-15:",
});

// Get specific item across all stores
const allApples = await cortex.mutable.list("inventory", {
  keyPrefix: "store-", // Gets all stores
});
const applesOnly = allApples.records.filter((r) => r.key.endsWith(":apples"));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Aggregation: Chain-wide reports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get total inventory across all stores
async function getChainwideInventory(department?: string) {
  const allStores = await cortex.mutable.get("chain", "metadata");

  const inventory: Record<string, number> = {};

  for (const storeId of allStores.storeIds) {
    const prefix = department ? `${storeId}:${department}:` : `${storeId}:`;

    const items = await cortex.mutable.list("inventory", {
      keyPrefix: prefix,
    });

    items.records.forEach((record) => {
      const itemName = record.key.split(":").pop()!;
      inventory[itemName] = (inventory[itemName] || 0) + record.value.quantity;
    });
  }

  return inventory;
}

// Total produce across all stores
const chainProduce = await getChainwideInventory("produce");
console.log("Chain-wide produce:", chainProduce);
// { apples: 3750, bananas: 5000, oranges: 2100 }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Restocking: Bulk updates
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Restock all produce for store 15
async function restockDepartment(
  storeId: string,
  department: string,
  items: Record<string, number>,
) {
  await cortex.mutable.transaction(async (tx) => {
    for (const [itemName, quantity] of Object.entries(items)) {
      const key = `${storeId}:${department}:${itemName}`;

      tx.update("inventory", key, (current) => ({
        ...current,
        quantity: current.quantity + quantity,
        lastRestocked: new Date(),
      }));
    }
  });
}

await restockDepartment("store-15", "produce", {
  apples: 100,
  bananas: 150,
  oranges: 75,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Low Stock Alerts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function checkLowStock(storeId: string, threshold: number = 20) {
  const inventory = await cortex.mutable.list("inventory", {
    keyPrefix: `${storeId}:`,
  });

  const lowStock = inventory.records.filter(
    (item) => item.value.quantity < threshold,
  );

  if (lowStock.length > 0) {
    console.log(`⚠️ Low stock alert for ${storeId}:`);
    lowStock.forEach((item) => {
      const [store, dept, product] = item.key.split(":");
      console.log(
        `  - ${dept}/${product}: ${item.value.quantity} ${item.value.unit} remaining`,
      );
    });
  }

  return lowStock;
}

await checkLowStock("store-15", 25);
```

**This example demonstrates:**

- ✅ Complex objects as values (store metadata, inventory items)
- ✅ Hierarchical keys for scalable queries (`store:dept:item`)
- ✅ Nested objects for related configuration
- ✅ Atomic transactions across multiple keys
- ✅ Prefix-based queries for hierarchy traversal
- ✅ Aggregation across hierarchies
- ✅ Real-world business logic (purchases, restocking, alerts)

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

### 5. Choose Appropriate Data Structure

**Use Complex Objects When:**

```typescript
// ✅ Related data that changes together
await cortex.mutable.set("stores", "store-15", {
  name: "Downtown",
  manager: "Alice",
  address: { street: "123 Main", city: "Springfield" },
  // All fields updated as a unit
});

// ✅ Small datasets (< 100 items)
await cortex.mutable.set("config", "app-settings", {
  theme: "dark",
  language: "en",
  features: { chat: true, voice: false },
});

// ✅ Configuration that's read together
await cortex.mutable.set("email", "settings", {
  smtp: { host: "...", port: 587 },
  templates: { welcome: "...", reset: "..." },
});
```

**Use Hierarchical Keys When:**

```typescript
// ✅ Large datasets (> 100 items)
await cortex.mutable.set("inventory", "store-15:produce:apples", {...});
await cortex.mutable.set("inventory", "store-15:produce:bananas", {...});
// Can have thousands of products

// ✅ Need prefix queries
const produce = await cortex.mutable.list("inventory", {
  keyPrefix: "store-15:produce:",
});

// ✅ Independent updates (no related data)
await cortex.mutable.update("inventory", "store-15:dairy:milk", ...);
// Doesn't affect produce or other items

// ✅ Different access patterns
const apples = await cortex.mutable.get("inventory", "store-15:produce:apples");
// Fast direct access to single item
```

**Decision Matrix:**

| Scenario                         | Recommended Pattern    | Why                           |
| -------------------------------- | ---------------------- | ----------------------------- |
| Store metadata (< 50 fields)     | Complex Object         | Related data, atomic updates  |
| Product catalog (1000s of items) | Hierarchical Keys      | Scalable, independent updates |
| App configuration                | Complex Object         | Read/updated together         |
| Multi-tenant inventory           | Hierarchical Keys      | Per-tenant prefix queries     |
| Workflow state                   | Complex Object         | State transitions are atomic  |
| Metrics/counters                 | Hierarchical Keys      | Independent increments        |
| Small lists (< 100 items)        | Complex Object (array) | Simple, atomic                |
| Large lists (> 1000 items)       | Hierarchical Keys      | Scalable queries              |

### 6. Use TypeScript for Type Safety

Define interfaces for complex objects:

```typescript
// Define your data structures
interface InventoryItem {
  quantity: number;
  unit: string;
  price: number;
  supplier: string;
  sku: string;
  lastRestocked: Date;
}

interface StoreConfig {
  id: string;
  name: string;
  manager: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  departments: string[];
  openHours: {
    open: string;
    close: string;
  };
}

// Type-safe operations
async function setInventoryItem(
  storeId: string,
  department: string,
  item: string,
  data: InventoryItem,
): Promise<void> {
  const key = `${storeId}:${department}:${item}`;
  await cortex.mutable.set("inventory", key, data);
}

async function getInventoryItem(
  storeId: string,
  department: string,
  item: string,
): Promise<InventoryItem | null> {
  const key = `${storeId}:${department}:${item}`;
  return await cortex.mutable.get("inventory", key);
}

// Usage is type-safe
await setInventoryItem("store-15", "produce", "apples", {
  quantity: 150,
  unit: "lbs",
  price: 2.99,
  supplier: "Local Farms",
  sku: "PROD-APL-001",
  lastRestocked: new Date(),
});

const apples = await getInventoryItem("store-15", "produce", "apples");
if (apples) {
  console.log(apples.quantity); // TypeScript knows this is a number
  // apples.invalidField // TypeScript error!
}
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

### Use Case 1: Live Inventory (Complex Hierarchical Data)

```typescript
// Initialize inventory with complex objects and hierarchical keys
await cortex.mutable.set("inventory", "store-15:produce:apples", {
  quantity: 150,
  unit: "lbs",
  price: 2.99,
  supplier: "Local Farms",
  sku: "PROD-APL-001",
  perishable: true,
  expiryDate: new Date("2025-10-30"),
});

// Customer orders 10 lbs (atomic decrement with complex object)
await cortex.mutable.update("inventory", "store-15:produce:apples", (item) => {
  if (item.quantity < 10) throw new Error("Out of stock");

  return {
    ...item,
    quantity: item.quantity - 10,
    lastSold: new Date(),
  };
});

// Check availability with full details
const apples = await cortex.mutable.get("inventory", "store-15:produce:apples");
console.log(`${apples.quantity} ${apples.unit} available at $${apples.price}`);

// Restock (atomic increment + update metadata)
await cortex.mutable.update("inventory", "store-15:produce:apples", (item) => ({
  ...item,
  quantity: item.quantity + 50,
  lastRestocked: new Date(),
  supplier: "Local Farms", // Confirm supplier
}));

// Query all produce for this store
const allProduce = await cortex.mutable.list("inventory", {
  keyPrefix: "store-15:produce:",
});

console.log(`Store 15 has ${allProduce.total} produce items`);
```

### Use Case 2: Live Configuration (Complex Nested Objects)

```typescript
// Set application configuration as nested object
await cortex.mutable.set("config", "app-settings", {
  api: {
    endpoint: "https://api.example.com/v1",
    timeout: 30000,
    retries: 3,
    rateLimits: {
      perMinute: 60,
      perHour: 1000,
    },
  },
  features: {
    enableChat: true,
    enableVoice: false,
    maxConcurrentChats: 5,
    enableFileUpload: true,
  },
  notifications: {
    email: true,
    sms: false,
    push: true,
    channels: ["email", "push"],
  },
  security: {
    sessionTimeout: 3600,
    requireMFA: false,
    allowedOrigins: ["https://app.example.com"],
  },
});

// Agents check config (type-safe access)
const config = await cortex.mutable.get("config", "app-settings");
if (
  config.features.enableChat &&
  activeChats < config.features.maxConcurrentChats
) {
  // Accept new chat
}

// Update specific nested value (atomic)
await cortex.mutable.update("config", "app-settings", (cfg) => ({
  ...cfg,
  features: {
    ...cfg.features,
    maxConcurrentChats: 10, // Immediate effect for all agents
  },
}));

// Or update API endpoint
await cortex.mutable.update("config", "app-settings", (cfg) => ({
  ...cfg,
  api: {
    ...cfg.api,
    endpoint: "https://api.example.com/v2",
    timeout: 60000, // Also increase timeout
  },
}));
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

### Use Case 4: Agent Collaboration State (Complex Workflow)

```typescript
// Track active workflow with complex state
await cortex.mutable.set("workflows", "refund-request-12345", {
  id: "refund-request-12345",
  type: "refund",
  status: "in-progress",
  createdAt: new Date(),
  customer: {
    id: "user-123",
    name: "Alex Johnson",
    email: "alex@example.com",
  },
  order: {
    orderId: "ORD-98765",
    amount: 299.99,
    items: ["Widget A", "Widget B"],
    purchaseDate: new Date("2025-10-15"),
  },
  workflow: {
    currentStep: "manager-approval",
    completedSteps: ["initiated", "customer-verified"],
    pendingSteps: ["manager-approval", "payment-processing", "complete"],
  },
  agents: {
    initiator: "support-agent-1",
    currentAssignee: "manager-agent",
    history: [
      {
        agentId: "support-agent-1",
        action: "initiated",
        timestamp: new Date(),
      },
      { agentId: "support-agent-1", action: "verified", timestamp: new Date() },
    ],
  },
  notes: ["Customer reports defective product", "Original packaging intact"],
});

// Manager approves (atomic state transition)
await cortex.mutable.update(
  "workflows",
  "refund-request-12345",
  (workflow) => ({
    ...workflow,
    status: "approved",
    workflow: {
      ...workflow.workflow,
      currentStep: "payment-processing",
      completedSteps: [...workflow.workflow.completedSteps, "manager-approval"],
      pendingSteps: workflow.workflow.pendingSteps.filter(
        (s) => s !== "manager-approval",
      ),
    },
    agents: {
      ...workflow.agents,
      currentAssignee: "finance-agent",
      history: [
        ...workflow.agents.history,
        { agentId: "manager-agent", action: "approved", timestamp: new Date() },
      ],
    },
    approvalDetails: {
      approvedBy: "manager-agent",
      approvedAt: new Date(),
      amount: 299.99,
    },
  }),
);

// Finance agent processes payment
await cortex.mutable.update("workflows", "refund-request-12345", (workflow) => {
  if (workflow.status !== "approved") {
    throw new Error("Workflow not approved");
  }

  return {
    ...workflow,
    status: "completed",
    workflow: {
      ...workflow.workflow,
      currentStep: "complete",
      completedSteps: [
        ...workflow.workflow.completedSteps,
        "payment-processing",
      ],
      pendingSteps: [],
    },
    completedAt: new Date(),
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
