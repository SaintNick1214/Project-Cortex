# User Operations API

> **Last Updated**: 2026-01-01

Complete API reference for user profile management, including multi-tenancy and auth context integration.

## Overview

The User Operations API (`cortex.users.*`) provides user profile management with **GDPR-compliant cascade deletion** across all Cortex layers and stores.

**Key Features:**

- **GDPR Cascade Deletion** - One call deletes across all layers with userId
- **Multi-Tenancy** - Full tenant isolation via `tenantId`
- **Extensible Profiles** - Flexible data field for any developer needs
- **Validation Presets** - Strict, minimal, or custom validation
- **Version History** - Time-travel queries for user data

### Primary Feature: GDPR Cascade Deletion

### Primary Feature: GDPR Cascade Deletion

> **Available in SDK**: Full cascade deletion is implemented in the open-source SDK. Cloud Mode adds legal guarantees, certificates, and managed graph integration.

When a user requests data deletion (GDPR "right to be forgotten"), a single API call removes their data from **every store that contains an explicit `userId` reference**:

```typescript
// SDK (Free) & Cloud Mode: One call deletes from ALL stores with userId
await cortex.users.delete("user-123", { cascade: true });

// Automatically deletes from:
// ✅ User profile (immutable store, type='user')
// ✅ Layer 1a (conversations.*) - All conversations with userId
// ✅ Layer 1b (immutable.*) - All records with userId
// ✅ Layer 1c (mutable.*) - All keys with userId
// ✅ Layer 2 (vector.*) - All memories with userId (across ALL memory spaces)
// ✅ Layer 3 (facts.*) - All facts referencing userId
// ✅ Graph (if adapter configured) - All nodes with userId property
```

**No other API provides this cross-layer, cross-store cascade capability.**

**Key Principle: Same Code, Different Context**

- **Free SDK**: Full cascade implementation works when you provide graph adapter (DIY setup)
- **Cloud Mode**: Same code, but adds legal certificates, guarantees, managed graph, and liability

**What Cloud Mode Adds:**

- **Legal Certificate of Deletion** - Compliance audit document for legal teams
- **GDPR Liability Guarantee** - Cortex assumes legal responsibility
- **Managed Graph Adapter** - Zero configuration, always works (no DIY setup)
- **Compliance Audit Trail** - Immutable timestamped log of all deletions
- **Verification Report** - Cryptographically signed proof that nothing was missed
- **Insurance/Indemnification** - If deletion is incomplete, Cortex is liable
- **Priority Support** - Expert help if issues arise

**Free SDK vs Cloud Mode:**

| Feature               | Free SDK                     | Cloud Mode              |
| --------------------- | ---------------------------- | ----------------------- |
| **Cascade Deletion**  | ✅ Full implementation       | ✅ Same implementation  |
| **Graph Support**     | ✅ Works with DIY adapter    | ✅ Managed, zero-config |
| **Verification**      | ✅ Best-effort checks        | ✅ Cryptographic proof  |
| **Rollback**          | ✅ Transaction-like rollback | ✅ Same + audit trail   |
| **Legal Certificate** | ❌ None                      | ✅ Compliance document  |
| **GDPR Liability**    | ❌ User responsible          | ✅ Cortex liable        |
| **Support**           | Community                    | Priority + SLA          |

The free SDK provides the **technical capability**, Cloud Mode provides the **legal guarantees**.

**Implementation Details:**

The SDK implements cascade deletion using a three-phase approach:

1. **Collection Phase**: Gather all records to delete across all layers
2. **Backup Phase**: Create rollback snapshots of all records
3. **Deletion Phase**: Delete in reverse dependency order with automatic rollback on failure

```typescript
// Example: Full cascade deletion with verification
const result = await cortex.users.delete("user-123", {
  cascade: true, // Enable cascade across all layers
  verify: true, // Verify completeness after deletion (default)
  dryRun: false, // Preview without deleting (optional)
});

// Result includes detailed breakdown
console.log(
  `Deleted ${result.totalDeleted} records across ${result.deletedLayers.length} layers`,
);
console.log(`Conversations: ${result.conversationsDeleted}`);
console.log(`Vector memories: ${result.vectorMemoriesDeleted}`);
console.log(`Facts: ${result.factsDeleted}`);
console.log(`Graph nodes: ${result.graphNodesDeleted || "N/A (no adapter)"}`);
console.log(
  `Verification: ${result.verification.complete ? "Complete" : "Issues found"}`,
);
```

**Graph Integration:**

Cascade deletion includes graph nodes if you provide a graph adapter:

```typescript
import { CypherGraphAdapter } from "@cortex-platform/sdk/graph";

// Configure graph adapter (DIY in free SDK)
const graphAdapter = new CypherGraphAdapter({
  uri: process.env.NEO4J_URI,
  username: process.env.NEO4J_USER,
  password: process.env.NEO4J_PASSWORD,
});

// Initialize Cortex with graph
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  graph: {
    adapter: graphAdapter,
  },
});

// Now cascade deletion includes graph!
await cortex.users.delete("user-123", { cascade: true });
// Deletes from Convex (conversations, immutable, mutable, vector, facts) AND graph
```

In Cloud Mode, the graph adapter is provided and managed automatically.

### Secondary Feature: Semantic Convenience

Provides user-friendly syntax for user profile management:

```typescript
// Convenience
await cortex.users.get("user-123");

// vs Equivalent
await cortex.immutable.get("user", "user-123");
```

### Under the Hood

User profiles are stored in **`cortex.immutable.*`** with `type='user'`:

```typescript
// When you call:
await cortex.users.update("user-123", {
  displayName: "Alex",
  email: "alex@example.com",
});

// Cortex actually does:
await cortex.immutable.store({
  type: "user",
  id: "user-123",
  data: { displayName: "Alex", email: "alex@example.com" },
});
```

> **Note:** The `users.update()` method accepts data fields directly (not wrapped in a `data` object). The SDK handles the conversion to the immutable store format internally.

**Why the wrapper exists:**

1. **GDPR Cascade** - Deletes from ALL stores with `userId` across ALL layers
2. **Semantic clarity** - `users.get()` is clearer than `immutable.get('user', ...)`
3. **Specialized validation** - User-specific rules and constraints
4. **User-centric operations** - Operations optimized for user management

**Relationship to Layers:**

```
Layer 1: ACID Stores
├── conversations.* (userId: optional) ← GDPR cascade target
├── immutable.* (userId: optional) ← USER PROFILES + GDPR cascade target
└── mutable.* (userId: optional) ← GDPR cascade target

Layer 2: Vector Index
└── vector.* (userId: optional) ← GDPR cascade target

Convenience APIs:
├── memory.* (conversations + vector)
└── users.* (immutable type='user' + GDPR cascade) ← SPECIALIZED WRAPPER
```

**User Profiles vs Other Stores:**

| Feature          | cortex.users.\*         | cortex.immutable.\*         | cortex.mutable.\*          | cortex.vector.\*                    |
| ---------------- | ----------------------- | --------------------------- | -------------------------- | ----------------------------------- |
| **Storage**      | immutable (type='user') | immutable                   | mutable                    | vector index                        |
| **Shared**       | ✅ All agents           | ✅ All agents               | ✅ All agents              | ❌ Per-agent                        |
| **Versioning**   | ✅ Auto (unlimited)     | ✅ Auto (20 versions)       | ❌ None                    | ✅ Auto (10 versions)               |
| **userId**       | N/A (IS the user)       | ✅ Optional                 | ✅ Optional                | ✅ Optional                         |
| **GDPR Cascade** | ✅ **ALL stores**       | ❌ No                       | ❌ No                      | ❌ No                               |
| **API**          | `users.get(id)`         | `immutable.get('user', id)` | `mutable.get('users', id)` | `vector.search(memorySpaceId, ...)` |
| **Use Case**     | User profiles           | User feedback, submissions  | User sessions, cache       | Memory space memories               |

**Key Differences:**

- **ONLY `cortex.users.*` has GDPR cascade** - deletes from ALL stores with userId
- `cortex.users.*` is a wrapper over `cortex.immutable.*` with `type='user'`
- All stores (conversations, immutable, mutable, vector) support **optional** `userId` field
- `userId` links enable GDPR cascade deletion

---

## Multi-Tenancy Support

User profiles support full multi-tenant isolation via `tenantId`:

```typescript
// Create tenant-scoped user
await cortex.users.update("user-123", {
  tenantId: "customer-acme", // SaaS platform isolation
  data: {
    displayName: "Alex",
    email: "alex@acme.com",
    preferences: { theme: "dark" },
  },
});

// Query users within tenant
const users = await cortex.users.list({
  tenantId: "customer-acme", // Only returns this tenant's users
  limit: 100,
});

// GDPR cascade respects tenant isolation
await cortex.users.delete("user-123", {
  cascade: true,
  // Deletes all user data across ALL stores with userId
  // Graph nodes also include tenantId for proper isolation
});
```

### Tenant Isolation in GDPR Cascade

When cascade deleting a user with `tenantId`, all associated data across all stores includes tenant context:

```typescript
// Cascade deletion covers:
// ✅ User profile (with tenantId)
// ✅ Conversations (all with userId, filtered by tenantId)
// ✅ Immutable records (all with userId, filtered by tenantId)
// ✅ Mutable keys (all with userId, filtered by tenantId)
// ✅ Vector memories (all with userId, filtered by tenantId)
// ✅ Facts (all with userId, filtered by tenantId)
// ✅ Sessions (all with userId, filtered by tenantId)
// ✅ Graph nodes (with userId AND tenantId properties)
```

---

## Auth Context Integration

User operations integrate with the Auth Context system:

```typescript
import { Cortex, createAuthContext } from "@cortex-platform/sdk";

// Create auth context from your auth provider
const auth = createAuthContext({
  userId: "user-123",
  tenantId: "customer-acme",
  sessionId: "session-xyz",
  claims: { email: "alex@acme.com" },
});

// Initialize Cortex with auth
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth,
});

// User operations use auth context
const profile = await cortex.users.get("user-123");
// tenantId is automatically validated from auth context
```

See [Auth Integration](../08-integrations/auth-providers.md) for complete details.

---

## Core Operations

### get()

Retrieve a user profile by ID.

**Signature:**

```typescript
cortex.users.get(
  userId: string
): Promise<UserProfile | null>
```

**Parameters:**

- `userId` (string) - Unique user identifier

**Returns:**

```typescript
interface UserProfile {
  // Identity
  id: string; // User ID
  tenantId?: string; // Multi-tenancy: tenant this user belongs to

  // User Data (FLEXIBLE - structure is up to you!)
  data: Record<string, unknown>; // Any JSON-serializable data

  // System fields (automatic)
  version: number; // Current version number
  createdAt: number; // Unix timestamp (ms) when created
  updatedAt: number; // Unix timestamp (ms) when last updated
}
```

> **Note:** Version history is accessed via `getHistory()` and `getVersion()` methods, not returned in the profile object.

**Suggested Data Structure** (not enforced):

```typescript
// Common convention (but not required)
await cortex.users.update("user-123", {
  data: {
    displayName: "Alex Johnson", // Display name
    email: "alex@example.com", // Contact email

    // Preferences (your structure)
    preferences: {
      theme: "dark",
      language: "en",
      timezone: "America/New_York",
      communicationStyle: "friendly",
    },

    // Metadata (your structure)
    metadata: {
      tier: "pro",
      signupDate: new Date(),
      company: "Acme Corp",
    },

    // Add ANY custom fields
    customField1: "value",
    customField2: { nested: "object" },
  },
});
```

**ONLY `id` is required** - everything else is completely flexible!

**Side Effects:**

- None (read-only)

**Example:**

```typescript
const user = await cortex.users.get("user-123");

if (user) {
  console.log(`Welcome back, ${user.displayName}!`);
  console.log(`Theme: ${user.preferences.theme || "default"}`);
  console.log(`Member since: ${user.metadata.signupDate}`);
} else {
  console.log("User not found - creating default profile");
}
```

**Errors:**

- `CortexError('INVALID_USER_ID')` - User ID is empty or invalid

**See Also:**

- [User Profiles Guide](../02-core-features/03-user-profiles.md#retrieving-a-profile)

---

### update()

Create or update a user profile. This is an **upsert** operation with automatic versioning.

**Signature:**

```typescript
cortex.users.update(
  userId: string,
  data: Record<string, unknown>
): Promise<UserProfile>
```

**Parameters:**

- `userId` (string) - Unique user identifier
- `data` (Record<string, unknown>) - User profile data to merge with existing (any JSON-serializable structure)

**Note:** Unlike `immutable.*` which requires `type` and `id`, `users.update()` only needs `userId` (the `type='user'` is implicit). Updates are always merged with existing data by default (deep merge).

**Returns:**

- `UserProfile` - Updated profile with incremented version

**Side Effects:**

- Creates new version in immutable store
- Updates `updatedAt` timestamp
- Deep merges with existing profile data automatically

**Example 1: Create new profile**

```typescript
const user = await cortex.users.update("user-123", {
  displayName: "Alex Johnson",
  email: "alex@example.com",
  preferences: {
    theme: "dark",
    language: "en",
    timezone: "America/New_York",
  },
  tier: "free",
  signupDate: new Date().toISOString(),
});

console.log(user.version); // 1 (first version)
console.log(user.data.displayName); // "Alex Johnson"
```

**Example 2: Update existing profile (merge by default)**

```typescript
// Get current user
const user = await cortex.users.get("user-123");
// user.data = { displayName: 'Alex', email: 'alex@example.com', preferences: { theme: 'dark' } }

// Update theme (deep merges with existing, creates new version)
await cortex.users.update("user-123", {
  preferences: {
    theme: "light", // Only updates theme, keeps other preferences
  },
});
// Result: { displayName: 'Alex', email: 'alex@example.com', preferences: { theme: 'light' } }

// Update last seen
await cortex.users.update("user-123", {
  lastSeen: new Date().toISOString(),
});
```

**Example 3: Multiple field updates**

```typescript
// Update multiple fields at once
await cortex.users.update("user-123", {
  displayName: "Alex Johnson",
  preferences: {
    theme: "dark",
    language: "es",
  },
  metadata: {
    lastActivity: new Date().toISOString(),
  },
});
```

**Errors:**

- `UserValidationError('MISSING_USER_ID')` - User ID is required
- `UserValidationError('INVALID_USER_ID_FORMAT')` - User ID must be a non-empty string
- `UserValidationError('MISSING_DATA')` - Data is required
- `UserValidationError('INVALID_DATA_TYPE')` - Data must be an object

**See Also:**

- [Creating Profiles](../02-core-features/03-user-profiles.md#creating-a-profile)
- [Updating Profiles](../02-core-features/03-user-profiles.md#updating-profiles)

---

### delete()

Delete a user profile with optional cascade to delete all associated data across all layers.

> **Fully Implemented in SDK**: Cascade deletion with verification and rollback is available in the free SDK. Cloud Mode adds legal certificates and guarantees.

**Signature:**

```typescript
cortex.users.delete(
  userId: string,
  options?: DeleteOptions
): Promise<UserDeleteResult>
```

**Parameters:**

```typescript
interface DeleteOptions {
  cascade?: boolean; // Delete from ALL stores with userId (default: false)
  verify?: boolean; // Verify deletion completeness (default: true)
  dryRun?: boolean; // Preview what would be deleted without actually deleting (default: false)
}
```

**Returns:**

```typescript
interface UserDeleteResult {
  userId: string;
  deletedAt: number;

  // Per-layer deletion counts
  conversationsDeleted: number;
  conversationMessagesDeleted: number;
  immutableRecordsDeleted: number;
  mutableKeysDeleted: number;
  vectorMemoriesDeleted: number;
  factsDeleted: number;
  graphNodesDeleted?: number; // Undefined if no graph adapter

  // Verification results
  verification: {
    complete: boolean;
    issues: string[]; // Any problems found during verification
  };

  // Summary
  totalDeleted: number; // Sum of all deleted records
  deletedLayers: string[]; // Which layers were affected
}
```

**Implementation Details:**

The SDK uses a three-phase approach for cascade deletion:

1. **Collection Phase**: Gathers all records to delete across all layers (conversations, immutable, mutable, vector, facts, graph)
2. **Backup Phase**: Creates rollback snapshots of all records in case deletion fails
3. **Deletion Phase**: Deletes in reverse dependency order (facts → vector → mutable → immutable → conversations → graph → user profile)

If any deletion fails, the SDK automatically rolls back all changes using the backups.

**Example 1: Delete profile only (no cascade)**

```typescript
// Delete just the user profile (default behavior)
const result = await cortex.users.delete("user-123");

console.log(`Deleted at: ${new Date(result.deletedAt)}`);
console.log(`Total deleted: ${result.totalDeleted}`); // 1 (just the profile)
console.log(`Layers affected: ${result.deletedLayers}`); // ['user-profile']
```

**Example 2: GDPR Cascade Deletion (SDK & Cloud)**

```typescript
// Delete profile + ALL data with explicit userId references
const result = await cortex.users.delete("user-123", {
  cascade: true,
  verify: true, // Verify nothing was missed (default)
});

// Per-layer breakdown
console.log(`Conversations deleted: ${result.conversationsDeleted}`);
console.log(
  `  Messages in those conversations: ${result.conversationMessagesDeleted}`,
);
console.log(`Immutable records deleted: ${result.immutableRecordsDeleted}`);
console.log(`Mutable keys deleted: ${result.mutableKeysDeleted}`);
console.log(`Vector memories deleted: ${result.vectorMemoriesDeleted}`);
console.log(`Facts deleted: ${result.factsDeleted}`);
console.log(
  `Graph nodes deleted: ${result.graphNodesDeleted || "N/A (no graph)"}`,
);

// Summary
console.log(`Total records deleted: ${result.totalDeleted}`);
console.log(`Layers affected: ${result.deletedLayers.join(", ")}`);

// Verification
if (result.verification.complete) {
  console.log("✅ Deletion verified - no orphaned records");
} else {
  console.warn("⚠️ Verification issues:");
  result.verification.issues.forEach((issue) => console.warn(`  - ${issue}`));
}
```

**Example 3: Dry Run (Preview Without Deleting)**

```typescript
// Preview what would be deleted without actually deleting
const preview = await cortex.users.delete("user-123", {
  cascade: true,
  dryRun: true, // Just preview, don't delete
});

console.log(
  `Would delete ${preview.totalDeleted} records across ${preview.deletedLayers.length} layers`,
);
console.log(`Conversations: ${preview.conversationsDeleted}`);
console.log(`Vector memories: ${preview.vectorMemoriesDeleted}`);
console.log(`Facts: ${preview.factsDeleted}`);

// User still exists after dry run
const user = await cortex.users.get("user-123");
console.log(`User still exists: ${user !== null}`); // true
```

**Example 4: Automatic Rollback on Failure**

```typescript
try {
  // If any deletion fails, everything is rolled back automatically
  const result = await cortex.users.delete("user-123", {
    cascade: true,
  });
  console.log("Deletion successful!");
} catch (error) {
  if (error instanceof CascadeDeletionError) {
    console.error("Deletion failed and was rolled back:");
    console.error(error.message);
    // All deleted records have been restored
    const user = await cortex.users.get("user-123");
    console.log(`User restored: ${user !== null}`); // true
  }
}
```

**Example 4: Granular Control (🚧 Planned - Cloud Mode)**

> **Note:** Granular layer control is planned for Cortex Cloud. Currently, `cascade: true` deletes from ALL layers. The options below are not yet implemented.

```typescript
// 🚧 PLANNED - Cortex Cloud: Only delete mutable data (like sessions, cache)
const result = await cortex.users.delete("user-123", {
  cascade: true,
  // 🚧 PLANNED OPTIONS (not yet implemented):
  // deleteFromConversations: false,  // Preserve
  // deleteFromImmutable: false,      // Preserve
  // deleteFromMutable: true,         // DELETE (live data only)
  // deleteFromVector: false,         // Preserve
  // auditReason: "Session cleanup",
});

// Currently deletes from all layers when cascade: true
console.log(`Total deleted: ${result.totalDeleted}`);
```

**Example 5: Why Use Cascade (vs Manual Deletion)**

The SDK's cascade deletion handles all the complexity automatically:

```typescript
// ✅ Recommended: Use cascade deletion (SDK handles all layers)
const result = await cortex.users.delete("user-123", {
  cascade: true,
  verify: true, // Verify deletion completeness
});

console.log(`Deleted ${result.totalDeleted} records`);
console.log(`Layers affected: ${result.deletedLayers.join(", ")}`);

// ❌ Manual approach would require calling each API separately:
// - cortex.conversations.delete() for each conversation
// - cortex.immutable.purge() for each record
// - cortex.mutable.delete() for each key
// - cortex.vector.delete() for each memory
// - cortex.facts.delete() for each fact
// The cascade option handles all of this automatically!
```

**SDK Cascade vs Cloud Mode:**

| Feature               | SDK (Free)      | Cloud Mode (Planned)     |
| --------------------- | --------------- | ------------------------ |
| **Cascade Deletion**  | ✅ Automatic    | ✅ Automatic             |
| **Verification**      | ✅ Automatic    | ✅ + Cryptographic proof |
| **Rollback**          | ✅ Automatic    | ✅ + Audit trail         |
| **Legal Certificate** | ❌ Not included | ✅ Compliance document   |
| **Graph Support**     | ✅ DIY adapter  | ✅ Managed, zero-config  |

**Errors:**

- `CortexError('USER_NOT_FOUND')` - User profile doesn't exist
- `CortexError('DELETION_FAILED')` - Delete operation failed

**See Also:**

- [Deleting Profiles](../02-core-features/03-user-profiles.md#deleting-profiles)
- [GDPR Compliance](../02-core-features/03-user-profiles.md#pattern-4-gdpr-compliance)

---

### search()

Search user profiles with filters, sorting, and pagination.

**Signature:**

```typescript
cortex.users.search(
  filters: UserFilters
): Promise<UserProfile[]>
```

**Parameters:**

```typescript
interface UserFilters {
  // Pagination
  limit?: number; // Maximum results (default: 50, max: 1000)
  offset?: number; // Skip first N results (default: 0)

  // Date filters (timestamps in milliseconds)
  createdAfter?: number; // Filter by createdAt > timestamp
  createdBefore?: number; // Filter by createdAt < timestamp
  updatedAfter?: number; // Filter by updatedAt > timestamp
  updatedBefore?: number; // Filter by updatedAt < timestamp

  // Sorting
  sortBy?: "createdAt" | "updatedAt"; // Sort field (default: "createdAt")
  sortOrder?: "asc" | "desc"; // Sort direction (default: "desc")

  // Client-side filters (filter on nested data properties)
  displayName?: string; // Filter by data.displayName (contains match)
  email?: string; // Filter by data.email (contains match)
}
```

**Returns:**

- `UserProfile[]` - Array of matching user profiles

**Example 1: Basic search with limit**

```typescript
const users = await cortex.users.search({ limit: 10 });

for (const user of users) {
  console.log(`${user.id}: ${user.data.displayName || "No name"}`);
}
```

**Example 2: Search with date filters**

```typescript
// Find users created in the last 30 days
const recentUsers = await cortex.users.search({
  createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
  sortBy: "createdAt",
  sortOrder: "desc",
});
```

**Example 3: Search by displayName**

```typescript
// Find users with "alex" in their displayName
const alexUsers = await cortex.users.search({
  displayName: "alex",
  limit: 50,
});
```

**Errors:**

- `UserValidationError('INVALID_FILTER_STRUCTURE')` - Filters must be an object
- `UserValidationError('INVALID_SORT_BY')` - sortBy must be 'createdAt' or 'updatedAt'
- `UserValidationError('INVALID_SORT_ORDER')` - sortOrder must be 'asc' or 'desc'
- `UserValidationError('INVALID_DATE_RANGE')` - Date range is invalid

**See Also:**

- [Querying Profiles](../02-core-features/03-user-profiles.md#querying-user-profiles)

---

### list()

List user profiles with filtering, sorting, and pagination metadata.

**Signature:**

```typescript
cortex.users.list(
  filters?: ListUsersFilter
): Promise<ListUsersResult>
```

**Parameters:**

```typescript
interface ListUsersFilter {
  // Pagination
  limit?: number; // Maximum results (default: 50, max: 1000)
  offset?: number; // Skip first N results (default: 0)

  // Date filters (timestamps in milliseconds)
  createdAfter?: number; // Filter by createdAt > timestamp
  createdBefore?: number; // Filter by createdAt < timestamp
  updatedAfter?: number; // Filter by updatedAt > timestamp
  updatedBefore?: number; // Filter by updatedAt < timestamp

  // Sorting
  sortBy?: "createdAt" | "updatedAt"; // Sort field (default: "createdAt")
  sortOrder?: "asc" | "desc"; // Sort direction (default: "desc")

  // Client-side filters (filter on nested data properties)
  displayName?: string; // Filter by data.displayName (contains match)
  email?: string; // Filter by data.email (contains match)
}
```

**Returns:**

```typescript
interface ListUsersResult {
  users: UserProfile[]; // Array of user profiles
  total: number; // Total count before pagination
  limit: number; // Limit used for this query
  offset: number; // Offset used for this query
  hasMore: boolean; // Whether there are more results
}
```

**Example 1: Basic list with pagination**

```typescript
// List users with pagination metadata
const result = await cortex.users.list({ limit: 50 });

console.log(`Retrieved ${result.users.length} of ${result.total} users`);
console.log(`Has more: ${result.hasMore}`);

for (const user of result.users) {
  console.log(`- ${user.id}: ${user.data.displayName || "Unknown"}`);
}
```

**Example 2: Paginate through all users**

```typescript
const page1 = await cortex.users.list({ limit: 10, offset: 0 });
const page2 = await cortex.users.list({ limit: 10, offset: 10 });

console.log(`Page 1: ${page1.users.length} users`);
console.log(`Page 2: ${page2.users.length} users`);
console.log(`Total: ${page1.total}`);
```

**Example 3: List with date filters and sorting**

```typescript
// List recently updated users
const recent = await cortex.users.list({
  updatedAfter: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last week
  sortBy: "updatedAt",
  sortOrder: "desc",
  limit: 20,
});
```

**Errors:**

- `CortexError('INVALID_PAGINATION')` - Invalid limit/offset

**See Also:**

- [List Users](../02-core-features/03-user-profiles.md#list-users-paginated)

---

### count()

Count user profiles with optional date filters.

**Signature:**

```typescript
cortex.users.count(
  filters?: UserFilters
): Promise<number>
```

**Parameters:**

```typescript
interface UserFilters {
  // Date filters (timestamps in milliseconds)
  createdAfter?: number; // Count users created after timestamp
  createdBefore?: number; // Count users created before timestamp
  updatedAfter?: number; // Count users updated after timestamp
  updatedBefore?: number; // Count users updated before timestamp
}
```

**Returns:**

- `number` - Count of matching user profiles

**Example 1: Total count**

```typescript
const total = await cortex.users.count();
console.log(`Total users: ${total}`);
```

**Example 2: Count with date filters**

```typescript
// Count users created in the last 30 days
const recentSignups = await cortex.users.count({
  createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
});
console.log(`New users (30 days): ${recentSignups}`);

// Count users active this week
const activeThisWeek = await cortex.users.count({
  updatedAfter: Date.now() - 7 * 24 * 60 * 60 * 1000,
});
console.log(`Active users (7 days): ${activeThisWeek}`);
```

**Errors:**

- `UserValidationError('INVALID_DATE_RANGE')` - Date range is invalid

**See Also:**

- [Count Users](../02-core-features/03-user-profiles.md#count-users)

---

### updateMany()

Bulk update multiple user profiles by explicit IDs or filters.

**Signature:**

```typescript
// By explicit user IDs
cortex.users.updateMany(
  userIds: string[],
  updates: { data: Record<string, unknown> },
  options?: UpdateManyOptions
): Promise<UpdateManyResult>

// By filters (select users matching criteria)
cortex.users.updateMany(
  filters: UserFilters,
  updates: { data: Record<string, unknown> },
  options?: UpdateManyOptions
): Promise<UpdateManyResult>
```

**Parameters:**

- `userIdsOrFilters` (string[] | UserFilters) - Either:
  - Array of user IDs to update (1-100 items), OR
  - UserFilters object to select users dynamically
- `updates` (object) - Updates to apply
  - `data` (Record<string, unknown>) - Data to merge with existing profiles
- `options` (UpdateManyOptions, optional) - Update options

```typescript
interface UpdateManyOptions {
  skipVersioning?: boolean; // Don't create versions (default: false)
  dryRun?: boolean; // Preview without updating
}

interface UpdateManyResult {
  updated: number; // Number of users successfully updated
  userIds: string[]; // IDs of users that were updated
}
```

**Returns:**

- `UpdateManyResult` - Details about bulk update

**Example 1: Update by explicit IDs**

```typescript
const result = await cortex.users.updateMany(["user-1", "user-2", "user-3"], {
  data: { status: "active", lastUpdatedBy: "admin" },
});

console.log(`Updated ${result.updated} users`);
```

**Example 2: Update by filters**

```typescript
// Update all users created in the last 7 days
const result = await cortex.users.updateMany(
  { createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000 },
  { data: { welcomeEmailSent: true } },
);

console.log(`Sent welcome emails to ${result.updated} new users`);

// Update users by displayName
const alexResult = await cortex.users.updateMany(
  { displayName: "alex" },
  { data: { verified: true } },
);
```

**Example 3: Dry run preview**

```typescript
const preview = await cortex.users.updateMany(
  { updatedBefore: Date.now() - 90 * 24 * 60 * 60 * 1000 },
  { data: { inactive: true } },
  { dryRun: true },
);

console.log(`Would update ${preview.userIds.length} inactive users`);
```

**Errors:**

- `UserValidationError('EMPTY_USER_IDS_ARRAY')` - Empty userIds array
- `UserValidationError('USER_ID_ARRAY_TOO_LARGE')` - More than 100 userIds
- `UserValidationError('TOO_MANY_MATCHES')` - Filter matched >100 users
- `UserValidationError('MISSING_DATA')` - updates.data is required

---

### deleteMany()

Bulk delete multiple user profiles by explicit IDs or filters.

**Signature:**

```typescript
// By explicit user IDs
cortex.users.deleteMany(
  userIds: string[],
  options?: DeleteManyOptions
): Promise<DeleteManyResult>

// By filters (select users matching criteria)
cortex.users.deleteMany(
  filters: UserFilters,
  options?: DeleteManyOptions
): Promise<DeleteManyResult>
```

**Parameters:**

- `userIdsOrFilters` (string[] | UserFilters) - Either:
  - Array of user IDs to delete (1-100 items), OR
  - UserFilters object to select users dynamically
- `options` (DeleteManyOptions, optional) - Delete options

```typescript
interface DeleteManyOptions {
  cascade?: boolean; // Enable cascade deletion across all layers (default: false)
  dryRun?: boolean; // Preview without deleting
}

interface DeleteManyResult {
  deleted: number; // Number of users successfully deleted
  userIds: string[]; // IDs of users that were deleted
}
```

**Returns:**

- `DeleteManyResult` - Details about bulk deletion

**Example 1: Delete by explicit IDs**

```typescript
// Delete specific users
const result = await cortex.users.deleteMany(["user-1", "user-2", "user-3"]);

console.log(`Deleted ${result.deleted} users`);
console.log(`Deleted IDs: ${result.userIds.join(", ")}`);
```

**Example 2: Delete by filters**

```typescript
// Delete inactive users (not updated in 1 year)
const oldUsers = await cortex.users.deleteMany(
  { updatedBefore: Date.now() - 365 * 24 * 60 * 60 * 1000 },
  { cascade: true },
);

console.log(`Deleted ${oldUsers.deleted} inactive users`);

// Delete users by displayName pattern
const testUsers = await cortex.users.deleteMany(
  { displayName: "test-user" },
  { cascade: true },
);
```

**Example 3: Dry run preview**

```typescript
const preview = await cortex.users.deleteMany(
  { createdBefore: Date.now() - 180 * 24 * 60 * 60 * 1000 },
  { dryRun: true },
);

console.log(`Would delete ${preview.userIds.length} users`);
```

**Errors:**

- `UserValidationError('EMPTY_USER_IDS_ARRAY')` - Empty userIds array
- `UserValidationError('USER_ID_ARRAY_TOO_LARGE')` - More than 100 userIds
- `UserValidationError('TOO_MANY_MATCHES')` - Filter matched >100 users

---

### export()

Export user profiles to JSON or CSV format with optional related data.

**Signature:**

```typescript
cortex.users.export(
  options: ExportUsersOptions    // Required - format is mandatory
): Promise<string>
```

**Parameters:**

```typescript
interface ExportUsersOptions {
  format: "json" | "csv"; // Output format (REQUIRED)
  filters?: UserFilters; // Filter users to export
  includeVersionHistory?: boolean; // Include version history for each user
  includeConversations?: boolean; // Include user's conversations
  includeMemories?: boolean; // Include user's memories (from conversation memory spaces)
}
```

> **Note:** The `options` parameter is required and must include `format`.

**Returns:**

- `string` - Exported data as JSON or CSV string

**Example 1: Basic export**

```typescript
// Export all users as JSON
const jsonExport = await cortex.users.export({ format: "json" });
console.log(jsonExport);

// Export with limit as CSV
const csvExport = await cortex.users.export({
  format: "csv",
  filters: { limit: 100 },
});
```

**Example 2: Full GDPR export with related data**

```typescript
// Export user data with all associated content
const gdprExport = await cortex.users.export({
  format: "json",
  filters: { displayName: "alex" },
  includeVersionHistory: true,
  includeConversations: true,
  includeMemories: true,
});

// Save to file
import { writeFileSync } from "fs";
writeFileSync("exports/user-gdpr-data.json", gdprExport);
```

**Example 3: Export with date filters**

```typescript
// Export recently created users
const recentExport = await cortex.users.export({
  format: "json",
  filters: {
    createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
    sortBy: "createdAt",
    sortOrder: "desc",
  },
});
```

**CSV Format:**

```
id,version,createdAt,updatedAt,data,versionHistoryCount,conversationsCount,memoriesCount
user-123,1,2025-01-01T00:00:00.000Z,2025-01-01T00:00:00.000Z,"{""displayName"":""Alex""}",3,5,12
  },
  {
    format: "json",
    outputPath: "exports/users-2025.json",
  },
);
```

**Errors:**

- `CortexError('INVALID_FORMAT')` - Format not supported
- `CortexError('EXPORT_FAILED')` - File write error

**See Also:**

- [GDPR Compliance](../02-core-features/03-user-profiles.md#pattern-4-gdpr-compliance)

---

## Version Operations

### getVersion()

Get a specific version of a user profile.

**Signature:**

```typescript
cortex.users.getVersion(
  userId: string,
  version: number
): Promise<UserVersion | null>
```

**Parameters:**

- `userId` (string) - User ID
- `version` (number) - Version number to retrieve (must be >= 1)

**Returns:**

```typescript
interface UserVersion {
  version: number; // Version number
  data: Record<string, unknown>; // Profile data at this version
  timestamp: number; // Unix timestamp (ms) when version was created
}
```

- `UserVersion` - Specific version data
- `null` - If version doesn't exist

**Example:**

```typescript
// Get version 1 (original profile)
const v1 = await cortex.users.getVersion("user-123", 1);

if (v1) {
  console.log(`Version: ${v1.version}`);
  console.log(`Display name: ${v1.data.displayName}`);
  console.log(`Theme: ${v1.data.preferences?.theme}`);
  console.log(`Created: ${new Date(v1.timestamp).toISOString()}`);
}
```

**Errors:**

- `UserValidationError('MISSING_USER_ID')` - User ID is required
- `UserValidationError('INVALID_VERSION_NUMBER')` - Version must be a number
- `UserValidationError('INVALID_VERSION_RANGE')` - Version must be >= 1

---

### getHistory()

Get all versions of a user profile, sorted by version descending (newest first).

**Signature:**

```typescript
cortex.users.getHistory(
  userId: string
): Promise<UserVersion[]>
```

**Parameters:**

- `userId` (string) - User ID

**Returns:**

- `UserVersion[]` - Array of all profile versions (newest first)
- Empty array `[]` if user doesn't exist

```typescript
interface UserVersion {
  version: number; // Version number
  data: Record<string, unknown>; // Profile data at this version
  timestamp: number; // Unix timestamp (ms) when version was created
}
```

**Example:**

```typescript
const history = await cortex.users.getHistory("user-123");

console.log(`User has ${history.length} profile versions:`);
history.forEach((v) => {
  console.log(`v${v.version} (${new Date(v.timestamp).toISOString()}):`);
  console.log(`  Name: ${v.data.displayName}`);
  console.log(`  Theme: ${v.data.preferences?.theme}`);
});

// Analyze preference changes over time
const themeChanges = history.filter((v, i, arr) => {
  return (
    i > 0 && v.data.preferences?.theme !== arr[i - 1].data.preferences?.theme
  );
});

console.log(`Theme changed ${themeChanges.length} times`);
```

**Errors:**

- `UserValidationError('MISSING_USER_ID')` - User ID is required

**See Also:**

- [Profile Version History](../02-core-features/03-user-profiles.md#profile-version-history)

---

### getAtTimestamp()

Get user profile state at a specific point in time.

**Signature:**

```typescript
cortex.users.getAtTimestamp(
  userId: string,
  timestamp: Date
): Promise<UserVersion | null>
```

**Parameters:**

- `userId` (string) - User ID
- `timestamp` (Date) - Point in time to query

**Returns:**

- `UserVersion` - Profile version that was current at that time
- `null` - If user didn't exist at that time

```typescript
interface UserVersion {
  version: number; // Version number
  data: Record<string, unknown>; // Profile data at this version
  timestamp: number; // Unix timestamp (ms) when version was created
}
```

**Example:**

```typescript
// What was the user's theme on August 1st?
const augustProfile = await cortex.users.getAtTimestamp(
  "user-123",
  new Date("2025-08-01T00:00:00Z"),
);

if (augustProfile) {
  console.log(`Theme in August: ${augustProfile.data.preferences?.theme}`);
  console.log(`Tier in August: ${augustProfile.data.metadata?.tier}`);
}

// Track tier changes over time
const janProfile = await cortex.users.getAtTimestamp(
  "user-123",
  new Date("2025-01-01"),
);
const octProfile = await cortex.users.getAtTimestamp(
  "user-123",
  new Date("2025-10-01"),
);

const janTier = janProfile?.data.metadata?.tier;
const octTier = octProfile?.data.metadata?.tier;

if (janTier === "free" && octTier === "pro") {
  console.log("User upgraded from free to pro this year!");
}
```

**Errors:**

- `UserValidationError('MISSING_USER_ID')` - User ID is required
- `UserValidationError('INVALID_TIMESTAMP')` - Timestamp is invalid or negative

---

## Advanced Operations

### exists()

Check if a user profile exists without retrieving it.

**Signature:**

```typescript
cortex.users.exists(
  userId: string
): Promise<boolean>
```

**Example:**

```typescript
if (await cortex.users.exists("user-123")) {
  console.log("Profile exists");
} else {
  // Create default profile
  await cortex.users.update("user-123", {
    displayName: "New User",
    preferences: {},
    metadata: { signupDate: new Date() },
  });
}
```

---

### getOrCreate()

Get user profile or create with defaults if doesn't exist.

**Signature:**

```typescript
cortex.users.getOrCreate(
  userId: string,
  defaults?: Record<string, unknown>
): Promise<UserProfile>
```

**Parameters:**

- `userId` (string) - User ID
- `defaults` (Record<string, unknown>, optional) - Default profile data if user doesn't exist

**Returns:**

- `UserProfile` - Existing profile or newly created profile with defaults

**Example:**

```typescript
// Get or create with defaults
const user = await cortex.users.getOrCreate("user-123", {
  displayName: "Guest User",
  preferences: {
    theme: "light",
    language: "en",
  },
  metadata: {
    tier: "free",
  },
});

// Use immediately (guaranteed to exist)
console.log(`Hello, ${user.data.displayName}!`);
```

**Errors:**

- `UserValidationError('MISSING_USER_ID')` - User ID is required
- `UserValidationError('INVALID_DATA_TYPE')` - Defaults must be an object

---

### merge()

Merge partial updates with existing profile. This is an alias for `update()` with merge behavior.

**Signature:**

```typescript
cortex.users.merge(
  userId: string,
  updates: Record<string, unknown>
): Promise<UserProfile>
```

**Parameters:**

- `userId` (string) - User ID
- `updates` (Record<string, unknown>) - Partial updates to deep merge with existing data

**Returns:**

- `UserProfile` - Updated profile with merged data

**Example:**

```typescript
// Existing profile
const existing = await cortex.users.get("user-123");
// existing.data = { displayName: 'Alex', preferences: { theme: 'dark', language: 'en' } }

// Merge update (deep merges, only changes specified fields)
await cortex.users.merge("user-123", {
  preferences: {
    notifications: true, // Adds notifications, keeps theme and language
  },
});

// Result: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en', notifications: true } }
```

**Errors:**

- `UserValidationError('MISSING_USER_ID')` - User ID is required
- `UserValidationError('MISSING_DATA')` - Updates data is required

---

## User-Memory Integration

### Finding User's Memories

Use the `memory.recall()` orchestration API to get unified context for a user:

```typescript
// Get memories and facts for a user
const result = await cortex.memory.recall({
  memorySpaceId: "user-123-space",
  query: "user preferences",
  userId: "user-123",
  limit: 20,
});

console.log(`Found ${result.items.length} relevant items`);
console.log(`Context for LLM: ${result.context}`);
```

### Combining Profile + Memory Search

```typescript
async function getCompleteUserContext(
  userId: string,
  memorySpaceId: string,
  query: string,
) {
  // Get profile
  const profile = await cortex.users.get(userId);

  // Get memories using recall
  const memoryResult = await cortex.memory.recall({
    memorySpaceId,
    query,
    userId,
    limit: 10,
  });

  return {
    profile,
    memories: memoryResult.items,
    context: memoryResult.context,
  };
}

// Usage
const context = await getCompleteUserContext(
  "user-123",
  "user-123-space",
  "user preferences",
);
console.log(`User: ${context.profile?.data.displayName}`);
console.log(`Found ${context.memories.length} relevant memories`);
```

---

## Filters Reference

Filter options available for user operations:

```typescript
interface UserFilters {
  // Pagination
  limit?: number; // Max results (default: 50, max: 1000)
  offset?: number; // Skip first N results

  // Date filters (Unix timestamps in milliseconds)
  createdAfter?: number; // Filter by createdAt > timestamp
  createdBefore?: number; // Filter by createdAt < timestamp
  updatedAfter?: number; // Filter by updatedAt > timestamp
  updatedBefore?: number; // Filter by updatedAt < timestamp

  // Sorting
  sortBy?: "createdAt" | "updatedAt"; // Sort field
  sortOrder?: "asc" | "desc"; // Sort direction

  // Client-side filters (see note below)
  displayName?: string; // Filter by data.displayName (contains match)
  email?: string; // Filter by data.email (contains match)

  // Multi-tenancy
  tenantId?: string; // Filter by tenant ID
}
```

> **⚠️ Client-Side Filtering Note:** The `displayName` and `email` filters are applied client-side after fetching results from the database. This means:
>
> - Results are filtered AFTER pagination is applied
> - You may receive fewer results than your `limit` if many are filtered out
> - For large datasets, consider using database-level filters (date ranges) first

**Operations supporting filters:**

- `search()` - Returns `UserProfile[]`
- `list()` - Returns `ListUsersResult` with pagination metadata
- `count()` - Returns count (supports date filters only)
- `updateMany()` - Filter-based bulk updates
- `deleteMany()` - Filter-based bulk deletes
- `export()` - Filter users to export

**Example:**

```typescript
// Filter by date range
const recentUsers = await cortex.users.list({
  createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
  sortBy: "createdAt",
  sortOrder: "desc",
  limit: 50,
});

// Client-side displayName filter
const alexUsers = await cortex.users.search({
  displayName: "alex", // Case-insensitive contains match
  limit: 100,
});

// Bulk update with filters
await cortex.users.updateMany(
  { createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000 },
  { data: { welcomeEmailSent: true } },
);
```

### 🚧 Planned: Advanced Filters (Not Yet Implemented)

The following advanced filter capabilities are planned for a future release:

```typescript
// 🚧 PLANNED - NOT YET IMPLEMENTED:
interface AdvancedFilters {
  // Nested object filters (planned)
  "preferences.theme"?: "light" | "dark";
  "metadata.tier"?: "free" | "pro" | "enterprise";

  // Range query operators (planned)
  // { $gte, $lte, $eq, $ne, $gt, $lt }
}
```

---

## Real-World Patterns

### Pattern 1: Initialize on First Contact

```typescript
async function ensureUserProfile(userId: string, message: string) {
  // Get or create
  let user = await cortex.users.get(userId);

  if (!user) {
    user = await cortex.users.update(userId, {
      displayName: userId, // Temporary
      preferences: {
        language: detectLanguage(message),
        timezone: "UTC",
      },
      metadata: {
        tier: "free",
        signupDate: new Date(),
        firstMessage: message,
      },
    });
  }

  return user;
}
```

### Pattern 2: Progressive Enhancement

Build profiles over time from conversations:

```typescript
async function enhanceProfileFromConversation(
  userId: string,
  conversation: string,
) {
  const user = await cortex.users.get(userId);
  const existingData = user?.data || {};

  // Extract insights from conversation
  const insights = await extractUserInsights(conversation);

  // Update profile incrementally (automatically deep merges)
  await cortex.users.update(userId, {
    displayName: insights.name || existingData.displayName,
    email: insights.email || existingData.email,
    preferences: {
      ...(existingData.preferences || {}),
      ...insights.preferences, // Add new preferences
    },
    metadata: {
      ...(existingData.metadata || {}),
      lastSeen: new Date().toISOString(),
      conversationCount:
        ((existingData.metadata?.conversationCount as number) || 0) + 1,
    },
  });
}
```

> **Note:** Each `update()` call creates a new version automatically. For use cases requiring version control (like skip versioning for routine updates), this feature is planned for a future release.

### Pattern 3: Personalized Responses

Adapt agent behavior to user preferences:

```typescript
async function generatePersonalizedResponse(userId: string, message: string) {
  const user = await cortex.users.get(userId);

  // Generate response
  let response = await yourLLM.generate(message);

  // Apply communication style
  if (user.preferences.communicationStyle === "formal") {
    response = makeFormal(response);
  } else if (user.preferences.communicationStyle === "casual") {
    response = makeCasual(response);
  }

  // Translate if needed
  if (user.preferences.language && user.preferences.language !== "en") {
    response = await translate(response, user.preferences.language);
  }

  // Format for timezone
  if (user.preferences.timezone) {
    response = formatDatesForTimezone(response, user.preferences.timezone);
  }

  return response;
}
```

### Pattern 4: Multi-Tenant User Management

Use auth context for tenant isolation:

```typescript
import { Cortex, createAuthContext } from "@cortex-platform/sdk";

// Initialize Cortex with tenant-scoped auth
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth: createAuthContext({
    tenantId: "tenant-abc", // All operations scoped to this tenant
    userId: "admin-user",
  }),
});

// Create user (automatically tagged with tenantId)
await cortex.users.update("user-123", {
  displayName: "Alex Johnson",
  role: "admin",
  permissions: ["read", "write", "admin"],
});

// List users (automatically filtered by tenant from auth context)
const result = await cortex.users.list({ limit: 100 });
console.log(`Tenant has ${result.total} users`);

// Count users in tenant
const count = await cortex.users.count();

// Export tenant data (GDPR)
const tenantData = await cortex.users.export({
  format: "json",
  includeMemories: true,
  includeConversations: true,
});
```

### Pattern 5: Preference Sync UI

Sync user preferences from frontend:

```typescript
// User changes preferences in your app
async function handlePreferenceChange(
  userId: string,
  section: string,
  value: unknown,
) {
  // Update just that preference section (deep merges automatically)
  await cortex.users.update(userId, {
    preferences: {
      [section]: value,
    },
  });

  // All agents immediately see the change
  console.log("Preference updated across all agents");
}

// Example usage
await handlePreferenceChange("user-123", "theme", "dark");
await handlePreferenceChange("user-123", "notifications", {
  email: true,
  push: false,
});
```

### Pattern 6: User Analytics

Track user engagement and behavior:

```typescript
async function updateUserEngagement(userId: string, event: string) {
  const user = await cortex.users.get(userId);
  const existingMetadata = (user?.data.metadata || {}) as Record<
    string,
    unknown
  >;

  await cortex.users.update(userId, {
    metadata: {
      ...existingMetadata,
      lastSeen: new Date().toISOString(),
      totalSessions: ((existingMetadata.totalSessions as number) || 0) + 1,
      lastAction: event,
      engagementScore: calculateEngagement(user),
    },
  });
}

function calculateEngagement(
  user: { data: Record<string, unknown> } | null,
): number {
  if (!user) return 0;
  const metadata = (user.data.metadata as Record<string, unknown>) || {};
  const signupDate = metadata.signupDate as string;
  if (!signupDate) return 0;

  const daysSinceSignup =
    (Date.now() - new Date(signupDate).getTime()) / (24 * 60 * 60 * 1000);
  const sessions = (metadata.totalSessions as number) || 0;

  return Math.min((sessions / daysSinceSignup) * 10, 100);
}
```

---

## Multi-Tenant Patterns

### Tenant-Specific User Management

The SDK supports multi-tenancy through the `tenantId` field in auth context:

```typescript
import { Cortex, createAuthContext } from "@cortex-platform/sdk";

// Initialize with tenant-specific auth context
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth: createAuthContext({
    tenantId: "tenant-acme",
    userId: "admin-user",
  }),
});

// All operations are now scoped to tenant-acme
// Users can only see/modify data within their tenant

// Create user in tenant
await cortex.users.update("alex", {
  displayName: "Alex Johnson",
  role: "admin",
});

// List users (automatically filtered by tenantId from auth context)
const result = await cortex.users.list({ limit: 100 });
console.log(`Tenant has ${result.total} users`);

// Export tenant users
const exportData = await cortex.users.export({
  format: "json",
  includeConversations: true,
  includeMemories: true,
});
```

> **Note:** When using `authContext`, the `tenantId` is automatically injected into all operations. Users can only access data within their tenant.

---

## Configuration

### 🚧 Planned: Profile Validation (Not Yet Implemented)

The following configuration options are planned for a future release:

```typescript
// 🚧 PLANNED - NOT YET IMPLEMENTED
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  // userProfileValidation: {
  //   requiredFields: ["displayName"],
  //   maxDisplayNameLength: 100,
  //   emailRequired: false,
  //   validateEmail: true,
  // },
});
```

Currently, profile validation is handled through the SDK's built-in validators which check:

- User ID is a non-empty string
- Data is a valid object (not array, not null)

### 🚧 Planned: Version Retention (Not Yet Implemented)

Version retention configuration is planned for a future release:

```typescript
// 🚧 PLANNED - NOT YET IMPLEMENTED
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  // userProfileVersionRetention: 20,  // Keep last 20 versions
});
```

Currently, user profiles keep **all versions** indefinitely (no automatic cleanup). Version history can be retrieved via `getHistory()` and `getVersion()` methods.

---

## Best Practices

### 1. Minimal Required Fields

Only require essential information:

```typescript
// ✅ Start minimal
await cortex.users.update(userId, {
  displayName: name,
});

// Add more as you learn
await cortex.users.update(userId, {
  preferences: { theme: "dark" },
});
```

### 2. Use Defaults

Provide sensible defaults:

```typescript
const defaultPreferences = {
  theme: "light",
  language: "en",
  timezone: "UTC",
  notifications: true,
};

await cortex.users.update(userId, {
  displayName: name,
  preferences: { ...defaultPreferences, ...customPreferences },
});
```

### 3. Version Management Best Practices

Currently, every `update()` call creates a new version. Here are tips for managing version history:

```typescript
// Important changes - update normally (creates version)
await cortex.users.update(userId, {
  preferences: { emailNotifications: false }, // User opt-out
});

// Routine updates - still creates versions but that's OK
// Use getHistory() to review version history when needed
await cortex.users.update(userId, {
  metadata: {
    lastSeen: new Date().toISOString(),
    sessionCount: ((user?.data.metadata?.sessionCount as number) || 0) + 1,
  },
});

// Tip: Review version history periodically
const history = await cortex.users.getHistory(userId);
console.log(`User has ${history.length} profile versions`);
```

> **Note:** Skip versioning option is planned for a future release to optimize routine updates.

### 4. Privacy-First

Don't store unnecessary PII:

```typescript
// ❌ Don't store sensitive data
await cortex.users.update(userId, {
  metadata: {
    ssn: "123-45-6789", // Never!
    creditCard: "4111...", // Never!
  },
});

// ✅ Store references only
await cortex.users.update(userId, {
  metadata: {
    paymentMethodId: "pm_abc123", // Stripe reference
    hasPaymentMethod: true,
  },
});
```

### 5. Use TypeScript for Type Safety

Define custom interfaces for your profile data structure:

```typescript
// Define your custom data shape
interface MyUserData {
  displayName: string;
  email?: string;
  preferences: {
    theme: "light" | "dark";
    language: "en" | "es" | "fr";
    emailFrequency: "daily" | "weekly" | "never";
  };
  metadata: {
    tier: "free" | "pro" | "enterprise";
    credits: number;
    referralCode?: string;
  };
}

// Type-safe wrapper function
async function getTypedUser(userId: string): Promise<MyUserData | null> {
  const user = await cortex.users.get(userId);
  if (!user) return null;
  return user.data as MyUserData;
}

// Usage with type safety
const userData = await getTypedUser(userId);
if (userData) {
  console.log(userData.preferences.emailFrequency); // Typed!
}
```

### 6. Cascade Deletion for GDPR

Always use cascade for user deletions:

```typescript
// GDPR-compliant deletion
async function handleGDPRDeletion(userId: string) {
  // Export data first (GDPR requirement)
  const userData = await cortex.users.export({
    format: "json",
    includeMemories: true,
    includeConversations: true,
  });

  // Save export for records
  const fs = await import("fs/promises");
  await fs.writeFile(`gdpr-export-${userId}.json`, userData);

  // Delete profile + all data with cascade
  const result = await cortex.users.delete(userId, {
    cascade: true, // Delete from ALL layers
    verify: true, // Verify deletion completeness
  });

  console.log(`Deleted ${result.totalDeleted} records`);
  console.log(
    `Verification: ${result.verification.complete ? "Complete" : "Issues found"}`,
  );

  return result;
}
```

---

## Graph-Lite Capabilities

Users are universal graph nodes - everything in Cortex can link to a user via the `userId` field:

**User as Graph Hub:**

- Central node connecting all user-related data across the system
- Enables GDPR cascade deletion across all layers

**Incoming Edges (What Links To Users):**

- `userId` from Conversations (user's chat history)
- `userId` from Contexts (user's workflows)
- `userId` from Memories (user-specific knowledge)
- `userId` from Facts (facts about the user)
- `userId` from Immutable records (user feedback, submissions)
- `userId` from Mutable records (user sessions, preferences)
- `userId` in Graph nodes (if graph adapter configured)

**GDPR Cascade as Graph Operation:**

The `delete({ cascade: true })` operation traverses all layers and deletes entities with matching userId:

```
User-123 (delete this node)
  ↓ cascade follows all userId edges
  ├──> Conversations with userId='user-123' (delete)
  ├──> Memories with userId='user-123' (delete)
  ├──> Facts with userId='user-123' (delete)
  ├──> Immutable records with userId='user-123' (delete)
  ├──> Mutable records with userId='user-123' (delete)
  └──> Graph nodes with userId='user-123' (delete, if graph configured)
```

**Example Result:**

```typescript
const result = await cortex.users.delete("user-123", { cascade: true });

// Result shows per-layer deletion counts:
// {
//   conversationsDeleted: 15,
//   vectorMemoriesDeleted: 234,
//   factsDeleted: 89,
//   immutableRecordsDeleted: 5,
//   mutableKeysDeleted: 12,
//   graphNodesDeleted: 47,
//   totalDeleted: 403,
//   deletedLayers: ['conversations', 'vector', 'facts', 'immutable', 'mutable', 'graph', 'user-profile']
// }
```

**Learn more:** [Graph Capabilities](../07-advanced-topics/01-graph-capabilities.md)

---

## Error Reference

The Users API exports two error classes for granular error handling:

### UserValidationError

Thrown when client-side validation fails (before reaching the backend):

```typescript
import { UserValidationError } from "@cortex-platform/sdk";

try {
  await cortex.users.update("", { name: "Test" }); // Empty userId
} catch (error) {
  if (error instanceof UserValidationError) {
    console.log(error.code); // "MISSING_USER_ID"
    console.log(error.field); // "userId"
    console.log(error.message); // "userId is required"
  }
}
```

### CascadeDeletionError

Thrown when cascade deletion fails (automatically rolls back):

```typescript
import { CascadeDeletionError } from "@cortex-platform/sdk";

try {
  await cortex.users.delete("user-123", { cascade: true });
} catch (error) {
  if (error instanceof CascadeDeletionError) {
    console.log(error.message); // Cascade deletion failed for user...
    console.log(error.cause); // Original error that caused failure
    // Note: All deleted records have been automatically restored
  }
}
```

### Validation Error Codes (UserValidationError)

| Error Code                   | Description                          | Field               |
| ---------------------------- | ------------------------------------ | ------------------- |
| `MISSING_USER_ID`            | User ID is required                  | `userId`            |
| `INVALID_USER_ID_FORMAT`     | User ID must be non-empty string     | `userId`            |
| `MISSING_DATA`               | Data parameter is required           | `data`              |
| `INVALID_DATA_TYPE`          | Data must be an object (not array)   | `data`              |
| `INVALID_VERSION_NUMBER`     | Version must be a valid number       | `version`           |
| `INVALID_VERSION_RANGE`      | Version must be >= 1                 | `version`           |
| `INVALID_TIMESTAMP`          | Timestamp must be valid number >= 0  | `timestamp`         |
| `INVALID_LIMIT`              | Limit must be 1-1000                 | `filters.limit`     |
| `INVALID_OFFSET`             | Offset must be >= 0                  | `filters.offset`    |
| `INVALID_DATE_RANGE`         | createdAfter must be < createdBefore | `filters.*`         |
| `INVALID_SORT_BY`            | sortBy must be createdAt/updatedAt   | `filters.sortBy`    |
| `INVALID_SORT_ORDER`         | sortOrder must be asc/desc           | `filters.sortOrder` |
| `INVALID_FILTER_STRUCTURE`   | Filters must be an object            | `filters`           |
| `INVALID_DELETE_OPTIONS`     | Options must be an object            | `options`           |
| `EMPTY_USER_IDS_ARRAY`       | userIds array cannot be empty        | `userIds`           |
| `USER_ID_ARRAY_TOO_LARGE`    | userIds array cannot exceed 100      | `userIds`           |
| `TOO_MANY_MATCHES`           | Filter matched >100 users            | `filters`           |
| `MISSING_REQUIRED_PARAMETER` | Export options are required          | `options`           |
| `INVALID_EXPORT_FORMAT`      | Format must be json/csv              | `format`            |

**See Also:**

- [Error Handling Guide](../05-reference/02-error-handling.md)

---

## Next Steps

- **[Context Operations API](./05-context-operations.md)** - Context chain management
- **[A2A Communication API](./06-a2a-communication.md)** - Agent-to-agent messaging
- **[Conversation Operations API](./03-conversation-operations.md)** - ACID conversation management
- **[Types & Interfaces](../05-reference/01-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
