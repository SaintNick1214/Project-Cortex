# User Operations API

> **Last Updated**: 2025-10-28

Complete API reference for user profile management.

## Overview

The User Operations API (`cortex.users.*`) exists for **ONE primary reason**: **GDPR-compliant cascade deletion** across all Cortex layers and stores.

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

| Feature | Free SDK | Cloud Mode |
|---------|----------|------------|
| **Cascade Deletion** | ✅ Full implementation | ✅ Same implementation |
| **Graph Support** | ✅ Works with DIY adapter | ✅ Managed, zero-config |
| **Verification** | ✅ Best-effort checks | ✅ Cryptographic proof |
| **Rollback** | ✅ Transaction-like rollback | ✅ Same + audit trail |
| **Legal Certificate** | ❌ None | ✅ Compliance document |
| **GDPR Liability** | ❌ User responsible | ✅ Cortex liable |
| **Support** | Community | Priority + SLA |

The free SDK provides the **technical capability**, Cloud Mode provides the **legal guarantees**.

**Implementation Details:**

The SDK implements cascade deletion using a three-phase approach:

1. **Collection Phase**: Gather all records to delete across all layers
2. **Backup Phase**: Create rollback snapshots of all records
3. **Deletion Phase**: Delete in reverse dependency order with automatic rollback on failure

```typescript
// Example: Full cascade deletion with verification
const result = await cortex.users.delete("user-123", {
  cascade: true,   // Enable cascade across all layers
  verify: true,    // Verify completeness after deletion (default)
  dryRun: false,   // Preview without deleting (optional)
});

// Result includes detailed breakdown
console.log(`Deleted ${result.totalDeleted} records across ${result.deletedLayers.length} layers`);
console.log(`Conversations: ${result.conversationsDeleted}`);
console.log(`Vector memories: ${result.vectorMemoriesDeleted}`);
console.log(`Facts: ${result.factsDeleted}`);
console.log(`Graph nodes: ${result.graphNodesDeleted || 'N/A (no adapter)'}`);
console.log(`Verification: ${result.verification.complete ? 'Complete' : 'Issues found'}`);
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
  data: { displayName: "Alex", email: "alex@example.com" },
});

// Cortex actually does:
await cortex.immutable.store({
  type: "user",
  id: "user-123",
  data: { displayName: "Alex", email: "alex@example.com" },
});
```

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
  // Identity (REQUIRED)
  id: string; // User ID

  // User Data (FLEXIBLE - structure is up to you!)
  data: Record<string, any>; // Any JSON-serializable data

  // System fields (automatic)
  version: number;
  createdAt: Date;
  updatedAt: Date;
  previousVersions?: UserVersion[];
}

interface UserVersion {
  version: number;
  data: Record<string, any>;
  timestamp: Date;
}
```

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

Create or update a user profile. This is an **upsert** operation.

**Signature:**

```typescript
cortex.users.update(
  userId: string,
  data: UserProfileUpdate,
  options?: UpdateOptions
): Promise<UserProfile>
```

**Parameters:**

```typescript
interface UserProfileUpdate {
  data: Record<string, any>; // Flexible user data (any structure)
}

interface UpdateOptions {
  skipVersioning?: boolean; // Don't create new version (default: false)
  versionReason?: string; // Why this update happened
  merge?: boolean; // Merge with existing data (default: true)
}
```

**Note:** Unlike `immutable.*` which requires `type` and `id`, `users.update()` only needs `userId` (the `type='user'` is implicit).

**Returns:**

- `UserProfile` - Updated profile with incremented version (if `skipVersioning: false`)

**Side Effects:**

- Creates new version (unless `skipVersioning: true`)
- Updates `updatedAt` timestamp
- Merges with existing profile (unless `merge: false`)

**Example 1: Create new profile (flexible structure)**

```typescript
const user = await cortex.users.update("user-123", {
  data: {
    displayName: "Alex Johnson",
    email: "alex@example.com",
    preferences: {
      theme: "dark",
      language: "en",
      timezone: "America/New_York",
    },
    tier: "free",
    signupDate: new Date(),
  },
});

console.log(user.version); // 1 (first version)
console.log(user.data.displayName); // "Alex Johnson"
```

**Example 2: Update existing profile (merge by default)**

```typescript
// Get current user
const user = await cortex.users.get("user-123");
// user.data = { displayName: 'Alex', email: 'alex@...', preferences: { theme: 'dark' } }

// Update theme (merges with existing, creates v2)
await cortex.users.update("user-123", {
  data: {
    preferences: {
      theme: "light", // Only updates theme
    },
  },
});
// Result: { displayName: 'Alex', email: 'alex@...', preferences: { theme: 'light' } }

// Update last seen (skip versioning for routine stats)
await cortex.users.update(
  "user-123",
  {
    data: {
      lastSeen: new Date(),
      sessionCount: (user.data.sessionCount || 0) + 1,
    },
  },
  {
    skipVersioning: true, // Don't create version for stats
  },
);
```

**Example 3: Replace entire data (merge: false)**

```typescript
// Replace ALL data (not merge)
await cortex.users.update(
  "user-123",
  {
    data: {
      displayName: "Alex",
      preferences: {
        theme: "dark",
        language: "es",
      },
      // Old fields (email, tier, etc.) are GONE
    },
  },
  {
    merge: false, // Complete replacement
  },
);
```

**Errors:**

- `CortexError('INVALID_USER_ID')` - User ID is invalid
- `CortexError('INVALID_PROFILE_DATA')` - Profile data is malformed
- `CortexError('CONVEX_ERROR')` - Database error

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
  cascade?: boolean;  // Delete from ALL stores with userId (default: false)
  verify?: boolean;   // Verify deletion completeness (default: true)
  dryRun?: boolean;   // Preview what would be deleted without actually deleting (default: false)
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
  totalDeleted: number;        // Sum of all deleted records
  deletedLayers: string[];     // Which layers were affected
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
console.log(`  Messages in those conversations: ${result.conversationMessagesDeleted}`);
console.log(`Immutable records deleted: ${result.immutableRecordsDeleted}`);
console.log(`Mutable keys deleted: ${result.mutableKeysDeleted}`);
console.log(`Vector memories deleted: ${result.vectorMemoriesDeleted}`);
console.log(`Facts deleted: ${result.factsDeleted}`);
console.log(`Graph nodes deleted: ${result.graphNodesDeleted || 'N/A (no graph)'}`);

// Summary
console.log(`Total records deleted: ${result.totalDeleted}`);
console.log(`Layers affected: ${result.deletedLayers.join(", ")}`);

// Verification
if (result.verification.complete) {
  console.log("✅ Deletion verified - no orphaned records");
} else {
  console.warn("⚠️ Verification issues:");
  result.verification.issues.forEach(issue => console.warn(`  - ${issue}`));
}
```

**Example 3: Dry Run (Preview Without Deleting)**

```typescript
// Preview what would be deleted without actually deleting
const preview = await cortex.users.delete("user-123", {
  cascade: true,
  dryRun: true,  // Just preview, don't delete
});

console.log(`Would delete ${preview.totalDeleted} records across ${preview.deletedLayers.length} layers`);
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

**Example 4: Granular Control (Cortex Cloud)**

```typescript
// Cortex Cloud: Only delete mutable data (like sessions, cache)
const result = await cortex.users.delete("user-123", {
  cascade: true,
  deleteFromConversations: false, // Preserve
  deleteFromImmutable: false, // Preserve
  deleteFromMutable: true, // DELETE (live data only)
  deleteFromVector: false, // Preserve
  auditReason: "Session cleanup",
});

console.log(`Mutable records deleted: ${result.mutableRecordsDeleted}`);
console.log(`Everything else preserved`);
```

**Example 5: Direct Mode Alternative (Manual GDPR Compliance)**

```typescript
// Direct Mode: Manually delete from each store
async function deleteUserGDPR(userId: string) {
  const deletionLog = {
    userId,
    deletedAt: new Date(),
    stores: {},
  };

  // Layer 1a: Conversations
  const conversations = await cortex.conversations.list({ userId });
  for (const conv of conversations) {
    await cortex.conversations.delete(conv.id);
  }
  deletionLog.stores.conversations = conversations.length;

  // Layer 1b: Immutable
  const immutableRecords = await cortex.immutable.list({ userId });
  for (const record of immutableRecords) {
    await cortex.immutable.purge(record.type, record.id);
  }
  deletionLog.stores.immutable = immutableRecords.length;

  // Layer 1c: Mutable (must know namespaces)
  const mutableNamespaces = ["user-sessions", "user-cache", "user-preferences"];
  let mutableCount = 0;
  for (const ns of mutableNamespaces) {
    const result = await cortex.mutable.purgeMany(ns, { userId });
    mutableCount += result.deleted;
  }
  deletionLog.stores.mutable = mutableCount;

  // Layer 2: Vector
  const agents = await cortex.agents.list();
  let vectorCount = 0;
  for (const agent of agents) {
    const result = await cortex.memory.deleteMany(agent.id, { userId });
    vectorCount += result.deleted;
  }
  deletionLog.stores.vector = vectorCount;

  // Delete user profile
  await cortex.immutable.purge("user", userId);
  deletionLog.stores.profile = 1;

  return deletionLog;
}

// Usage (Direct Mode)
const result = await deleteUserGDPR("user-123");
// Works! But requires ~40 lines of code vs 1 line with Cortex Cloud
```

**Comparison:**

| Feature              | Direct Mode     | Cortex Cloud            |
| -------------------- | --------------- | ----------------------- |
| **GDPR Compliant**   | ✅ Yes (manual) | ✅ Yes (automatic)      |
| **Code Required**    | ~40 lines       | 1 line                  |
| **Cascade Deletion** | Manual loops    | Automatic               |
| **Audit Trail**      | DIY             | Included                |
| **Verification**     | Manual          | Automatic               |
| **Cost**             | Free            | Included in Cloud tiers |

**Errors:**

- `CortexError('USER_NOT_FOUND')` - User profile doesn't exist
- `CortexError('DELETION_FAILED')` - Delete operation failed

**See Also:**

- [Deleting Profiles](../02-core-features/03-user-profiles.md#deleting-profiles)
- [GDPR Compliance](../02-core-features/03-user-profiles.md#pattern-4-gdpr-compliance)

---

### search()

Search user profiles with filters.

**Signature:**

```typescript
cortex.users.search(
  filters?: UserFilters,
  options?: SearchOptions
): Promise<UserProfile[]>
```

**Parameters:**

```typescript
interface UserFilters {
  // Identity
  email?: string;
  displayName?: string;

  // Preferences
  preferences?: Record<string, any>;

  // Metadata
  metadata?: Record<string, any>;

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number | RangeQuery;
}

interface SearchOptions {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  sortBy?: "createdAt" | "updatedAt" | "displayName" | "email";
  sortOrder?: "asc" | "desc";
}
```

**Returns:**

- `UserProfile[]` - Array of matching user profiles

**Example:**

```typescript
// Find pro users
const proUsers = await cortex.users.search({
  metadata: { tier: "pro" },
});

// Find users by company
const acmeUsers = await cortex.users.search({
  metadata: { company: "Acme Corp" },
});

// Find inactive users (last seen > 90 days ago)
const inactive = await cortex.users.search({
  metadata: {
    lastSeen: {
      $lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  },
});

// Find users with dark mode
const darkModeUsers = await cortex.users.search({
  preferences: { theme: "dark" },
});

// Complex query
const targetUsers = await cortex.users.search(
  {
    metadata: {
      tier: "free",
      signupDate: {
        $gte: new Date("2025-01-01"),
        $lte: new Date("2025-10-31"),
      },
    },
    preferences: {
      notifications: true,
    },
  },
  {
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc",
  },
);
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed

**See Also:**

- [Querying Profiles](../02-core-features/03-user-profiles.md#querying-user-profiles)

---

### list()

List user profiles with pagination.

**Signature:**

```typescript
cortex.users.list(
  options?: ListOptions
): Promise<ListResult>
```

**Parameters:**

```typescript
interface ListOptions extends UserFilters {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  sortBy?: "createdAt" | "updatedAt" | "displayName" | "email";
  sortOrder?: "asc" | "desc";
}

interface ListResult {
  users: UserProfile[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

**Returns:**

- `ListResult` - Paginated list of user profiles

**Example:**

```typescript
// List all users (paginated)
const page1 = await cortex.users.list({
  limit: 50,
  offset: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
});

console.log(`Showing ${page1.users.length} of ${page1.total} users`);
console.log(`Has more: ${page1.hasMore}`);

// List with filters
const recentUsers = await cortex.users.list({
  metadata: {
    signupDate: {
      $gte: new Date("2025-10-01"),
    },
  },
  limit: 100,
});

// List by tier
const proUsers = await cortex.users.list({
  metadata: { tier: "pro" },
  sortBy: "displayName",
  sortOrder: "asc",
});
```

**Errors:**

- `CortexError('INVALID_PAGINATION')` - Invalid limit/offset

**See Also:**

- [List Users](../02-core-features/03-user-profiles.md#list-users-paginated)

---

### count()

Count users matching filters without retrieving them.

**Signature:**

```typescript
cortex.users.count(
  filters?: UserFilters
): Promise<number>
```

**Parameters:**

- `filters` (UserFilters, optional) - Same filters as search()

**Returns:**

- `number` - Count of matching users

**Example:**

```typescript
// Total users
const total = await cortex.users.count();
console.log(`Total users: ${total}`);

// Count by tier
const proCount = await cortex.users.count({
  metadata: { tier: "pro" },
});
console.log(`Pro users: ${proCount}`);

// Count active users (last 30 days)
const activeCount = await cortex.users.count({
  metadata: {
    lastSeen: {
      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
});
console.log(`Active users (30d): ${activeCount}`);

// Count by signup date range
const q4Signups = await cortex.users.count({
  metadata: {
    signupDate: {
      $gte: new Date("2025-10-01"),
      $lte: new Date("2025-12-31"),
    },
  },
});
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed

**See Also:**

- [Count Users](../02-core-features/03-user-profiles.md#count-users)

---

### updateMany()

Bulk update user profiles matching filters.

**Signature:**

```typescript
cortex.users.updateMany(
  filters: UserFilters,
  updates: UserProfileUpdate,
  options?: UpdateManyOptions
): Promise<UpdateManyResult>
```

**Parameters:**

```typescript
interface UpdateManyOptions {
  skipVersioning?: boolean; // Don't create versions (default: false)
  dryRun?: boolean; // Preview without updating
}

interface UpdateManyResult {
  updated: number;
  userIds: string[];
  wouldUpdate?: number; // For dryRun
}
```

**Returns:**

- `UpdateManyResult` - Details about bulk update

**Example:**

```typescript
// Enable new feature for all pro users
const result = await cortex.users.updateMany(
  {
    metadata: { tier: "pro" },
  },
  {
    preferences: {
      newFeatureEnabled: true,
    },
  },
);

console.log(`Enabled feature for ${result.updated} pro users`);

// Update language for all users in a region
await cortex.users.updateMany(
  {
    metadata: { region: "EMEA" },
  },
  {
    preferences: {
      timezone: "Europe/London",
    },
  },
);

// Preview first
const preview = await cortex.users.updateMany(
  {
    metadata: { tier: "free" },
  },
  {
    metadata: { migrationReady: true },
  },
  {
    dryRun: true,
  },
);

console.log(`Would update ${preview.wouldUpdate} free users`);
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('NO_USERS_MATCHED')` - No users match filters

---

### deleteMany()

Bulk delete user profiles matching filters.

**Signature:**

```typescript
cortex.users.deleteMany(
  filters: UserFilters,
  options?: DeleteManyOptions
): Promise<DeleteManyResult>
```

**Parameters:**

```typescript
interface DeleteManyOptions {
  cascade?: boolean; // Delete user data from agents
  dryRun?: boolean; // Preview without deleting
  requireConfirmation?: boolean; // Prompt if > threshold
  confirmationThreshold?: number; // Default: 10
}

interface DeleteManyResult {
  deleted: number;
  userIds: string[];
  vectorMemoriesDeleted?: number; // If cascade: true
  agentsAffected?: string[];
  wouldDelete?: number; // For dryRun
}
```

**Returns:**

- `DeleteManyResult` - Details about bulk deletion

**Example:**

```typescript
// Delete inactive free users (preview first)
const preview = await cortex.users.deleteMany(
  {
    metadata: {
      tier: "free",
      lastSeen: {
        $lte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      },
    },
  },
  {
    cascade: true,
    dryRun: true,
  },
);

console.log(`Would delete ${preview.wouldDelete} inactive free users`);

// Execute after review
if (preview.wouldDelete < 100) {
  const result = await cortex.users.deleteMany(
    {
      metadata: {
        tier: "free",
        lastSeen: {
          $lte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
    {
      cascade: true,
    },
  );

  console.log(`Deleted ${result.deleted} users`);
  console.log(`Deleted ${result.vectorMemoriesDeleted} memories`);
}
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed
- `CortexError('DELETION_CANCELLED')` - User cancelled confirmation

---

### export()

Export user profiles to JSON or CSV.

**Signature:**

```typescript
cortex.users.export(
  filters?: UserFilters,
  options?: ExportOptions
): Promise<string | ExportData>
```

**Parameters:**

```typescript
interface ExportOptions {
  format: "json" | "csv";
  outputPath?: string; // File path (returns string if provided)
  includeMemories?: boolean; // Include memories from all agents
  includeConversations?: boolean; // Include ACID conversations
  includeVersionHistory?: boolean; // Include profile versions
}
```

**Returns:**

- `string` - File path if `outputPath` provided
- `ExportData` - Structured data if no `outputPath`

**Example:**

```typescript
// Export single user (GDPR data request)
const userData = await cortex.users.export(
  {
    email: "alex@example.com",
  },
  {
    format: "json",
    includeMemories: true, // Include all agent memories
    includeConversations: true, // Include ACID conversations
    includeVersionHistory: true, // Include profile history
  },
);

// Export all pro users
const proExport = await cortex.users.export(
  {
    metadata: { tier: "pro" },
  },
  {
    format: "csv",
    outputPath: "exports/pro-users.csv",
  },
);

console.log(`Exported to ${proExport}`);

// Export by date range
await cortex.users.export(
  {
    metadata: {
      signupDate: {
        $gte: new Date("2025-01-01"),
        $lte: new Date("2025-12-31"),
      },
    },
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
): Promise<ProfileVersion | null>
```

**Parameters:**

- `userId` (string) - User ID
- `version` (number) - Version number to retrieve

**Returns:**

- `ProfileVersion` - Specific version
- `null` - If version doesn't exist

**Example:**

```typescript
// Get version 1 (original profile)
const v1 = await cortex.users.getVersion("user-123", 1);

if (v1) {
  console.log(`Original display name: ${v1.displayName}`);
  console.log(`Original theme: ${v1.preferences.theme}`);
  console.log(`Created: ${v1.timestamp}`);
}
```

**Errors:**

- `CortexError('USER_NOT_FOUND')` - User doesn't exist
- `CortexError('VERSION_NOT_FOUND')` - Version doesn't exist

---

### getHistory()

Get all versions of a user profile.

**Signature:**

```typescript
cortex.users.getHistory(
  userId: string
): Promise<ProfileVersion[]>
```

**Parameters:**

- `userId` (string) - User ID

**Returns:**

- `ProfileVersion[]` - Array of all profile versions

**Example:**

```typescript
const history = await cortex.users.getHistory("user-123");

console.log(`User has ${history.length} profile versions:`);
history.forEach((v) => {
  console.log(`v${v.version} (${v.timestamp}):`);
  console.log(`  Name: ${v.displayName}`);
  console.log(`  Theme: ${v.preferences?.theme}`);
  console.log(`  Reason: ${v.updatedBy || "N/A"}`);
});

// Analyze preference changes
const themeChanges = history.filter((v, i, arr) => {
  return i > 0 && v.preferences?.theme !== arr[i - 1].preferences?.theme;
});

console.log(`Theme changed ${themeChanges.length} times`);
```

**Errors:**

- `CortexError('USER_NOT_FOUND')` - User doesn't exist

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
): Promise<ProfileVersion | null>
```

**Parameters:**

- `userId` (string) - User ID
- `timestamp` (Date) - Point in time to query

**Returns:**

- `ProfileVersion` - Profile version that was current at that time
- `null` - If user didn't exist at that time

**Example:**

```typescript
// What was the user's theme on August 1st?
const augustProfile = await cortex.users.getAtTimestamp(
  "user-123",
  new Date("2025-08-01T00:00:00Z"),
);

if (augustProfile) {
  console.log(`Theme in August: ${augustProfile.preferences.theme}`);
  console.log(`Tier in August: ${augustProfile.metadata.tier}`);
}

// Track tier changes over time
const janTier = (
  await cortex.users.getAtTimestamp("user-123", new Date("2025-01-01"))
)?.metadata.tier;
const octTier = (
  await cortex.users.getAtTimestamp("user-123", new Date("2025-10-01"))
)?.metadata.tier;

if (janTier === "free" && octTier === "pro") {
  console.log("User upgraded from free to pro this year!");
}
```

**Errors:**

- `CortexError('USER_NOT_FOUND')` - User doesn't exist
- `CortexError('INVALID_TIMESTAMP')` - Timestamp is invalid

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

Get user profile or create default if doesn't exist.

**Signature:**

```typescript
cortex.users.getOrCreate(
  userId: string,
  defaults?: Partial<UserProfileUpdate>
): Promise<UserProfile>
```

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
console.log(`Hello, ${user.displayName}!`);
```

---

### merge()

Merge partial updates with existing profile (default behavior of update).

**Signature:**

```typescript
cortex.users.merge(
  userId: string,
  updates: Partial<UserProfileUpdate>
): Promise<UserProfile>
```

**Example:**

```typescript
// Existing profile
const existing = await cortex.users.get("user-123");
// { displayName: 'Alex', preferences: { theme: 'dark', language: 'en' } }

// Merge update (only changes specified fields)
await cortex.users.merge("user-123", {
  preferences: {
    notifications: true, // Adds notifications, keeps theme and language
  },
});

// Result
// { displayName: 'Alex', preferences: { theme: 'dark', language: 'en', notifications: true } }
```

---

## User-Memory Integration

### Finding User's Memories Across Agents

```typescript
async function getUserMemoriesAcrossAgents(userId: string) {
  const agents = await cortex.agents.list();
  const allMemories = [];

  for (const agent of agents) {
    const memories = await cortex.memory.search(agent.id, "*", {
      userId: userId,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    if (memories.length > 0) {
      allMemories.push({
        memorySpaceId: agent.id, // Note: Old agent registry pattern
        agentName: agent.name,
        memories: memories,
      });
    }
  }

  return allMemories;
}

// Usage
const userMemories = await getUserMemoriesAcrossAgents("user-123");
console.log(`User has memories in ${userMemories.length} agents`);
```

### Combining Profile + Memory Search

```typescript
async function getCompleteUserContext(userId: string, query: string) {
  // Get profile
  const profile = await cortex.users.get(userId);

  // Search memories across all agents
  const agents = await cortex.agents.list();
  const memories = [];

  for (const agent of agents) {
    const agentMemories = await cortex.memory.search(agent.id, query, {
      embedding: await embed(query),
      userId: userId,
      limit: 3,
    });

    memories.push(...agentMemories);
  }

  return {
    profile,
    memories: memories.sort((a, b) => b.score - a.score),
  };
}

// Usage
const context = await getCompleteUserContext("user-123", "user preferences");
console.log(`User: ${context.profile.displayName}`);
console.log(`Found ${context.memories.length} relevant memories`);
```

---

## Universal Filters Reference

All filter options that work across user operations:

```typescript
interface UserFilters {
  // Identity
  email?: string;
  displayName?: string;

  // Preferences (nested object filters)
  "preferences.theme"?: "light" | "dark";
  "preferences.language"?: string;
  "preferences.notifications"?: boolean;
  preferences?: Record<string, any>; // Any preference field

  // Metadata (nested object filters)
  "metadata.tier"?: "free" | "pro" | "enterprise";
  "metadata.company"?: string;
  metadata?: Record<string, any>; // Any metadata field with operators

  // Date filters
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;

  // Version filters
  version?: number | RangeQuery;

  // Range query operators
  // { $gte: number, $lte: number, $eq: number, $ne: number, $gt: number, $lt: number }
}
```

**Operations supporting universal filters:**

- `search()`
- `list()`
- `count()`
- `updateMany()`
- `deleteMany()`
- `export()`

**Example:**

```typescript
// Same filters across all operations
const filters = {
  metadata: {
    tier: "pro",
    signupDate: {
      $gte: new Date("2025-01-01"),
    },
  },
  preferences: {
    theme: "dark",
  },
};

// Count
const count = await cortex.users.count(filters);

// List
const users = await cortex.users.list(filters);

// Update
await cortex.users.updateMany(filters, { metadata: { reviewed: true } });

// Export
await cortex.users.export(filters, { format: "json" });
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

  // Extract insights from conversation
  const insights = await extractUserInsights(conversation);

  // Update profile incrementally
  await cortex.users.update(
    userId,
    {
      displayName: insights.name || user.displayName,
      email: insights.email || user.email,
      preferences: {
        ...user.preferences,
        ...insights.preferences, // Add new preferences
      },
      metadata: {
        ...user.metadata,
        lastSeen: new Date(),
        conversationCount: (user.metadata.conversationCount || 0) + 1,
      },
    },
    {
      skipVersioning: true, // Don't version routine updates
    },
  );
}
```

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

Isolate users by tenant:

```typescript
// Create user with tenant
await cortex.users.update("user-123", {
  displayName: "Alex Johnson",
  metadata: {
    tenantId: "tenant-abc",
    role: "admin",
    permissions: ["read", "write", "admin"],
  },
});

// Query users by tenant
const tenantUsers = await cortex.users.search({
  metadata: { tenantId: "tenant-abc" },
});

// Count users per tenant
const count = await cortex.users.count({
  metadata: { tenantId: "tenant-abc" },
});

// Export tenant data (GDPR)
const tenantData = await cortex.users.export(
  {
    metadata: { tenantId: "tenant-abc" },
  },
  {
    format: "json",
    includeMemories: true,
    includeConversations: true,
  },
);
```

### Pattern 5: Preference Sync UI

Sync user preferences from frontend:

```typescript
// User changes preferences in your app
async function handlePreferenceChange(
  userId: string,
  section: string,
  value: any,
) {
  // Update just that preference section
  await cortex.users.update(
    userId,
    {
      preferences: {
        [section]: value,
      },
    },
    {
      versionReason: "user-preference-change",
    },
  );

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

  await cortex.users.update(
    userId,
    {
      metadata: {
        ...user.metadata,
        lastSeen: new Date(),
        totalSessions: (user.metadata.totalSessions || 0) + 1,
        lastAction: event,
        engagementScore: calculateEngagement(user),
      },
    },
    {
      skipVersioning: true, // Don't version analytics updates
    },
  );
}

function calculateEngagement(user: UserProfile): number {
  const daysSinceSignup =
    (Date.now() - user.metadata.signupDate.getTime()) / (24 * 60 * 60 * 1000);
  const sessions = user.metadata.totalSessions || 0;

  return Math.min((sessions / daysSinceSignup) * 10, 100);
}
```

---

## Multi-Tenant Patterns

### Tenant-Specific User Management

```typescript
// Helper class for multi-tenant user management
class TenantUserManager {
  constructor(private tenantId: string) {}

  async getUser(userLocalId: string): Promise<UserProfile | null> {
    const userId = `${this.tenantId}:${userLocalId}`;
    return await cortex.users.get(userId);
  }

  async updateUser(
    userLocalId: string,
    data: UserProfileUpdate,
  ): Promise<UserProfile> {
    const userId = `${this.tenantId}:${userLocalId}`;
    return await cortex.users.update(userId, {
      ...data,
      metadata: {
        ...data.metadata,
        tenantId: this.tenantId, // Ensure tenant is set
      },
    });
  }

  async listTenantUsers(options?: ListOptions): Promise<ListResult> {
    return await cortex.users.list({
      metadata: { tenantId: this.tenantId },
      ...options,
    });
  }

  async countTenantUsers(): Promise<number> {
    return await cortex.users.count({
      metadata: { tenantId: this.tenantId },
    });
  }

  async exportTenantData(): Promise<any> {
    return await cortex.users.export(
      {
        metadata: { tenantId: this.tenantId },
      },
      {
        format: "json",
        includeMemories: true,
        includeConversations: true,
      },
    );
  }
}

// Usage
const acmeTenant = new TenantUserManager("tenant-acme");

await acmeTenant.updateUser("alex", {
  displayName: "Alex Johnson",
  metadata: { role: "admin" },
});

const users = await acmeTenant.listTenantUsers();
console.log(`Acme has ${users.total} users`);
```

---

## Configuration

### Profile Validation

Configure profile validation rules:

```typescript
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  userProfileValidation: {
    requiredFields: ["displayName"],
    maxDisplayNameLength: 100,
    emailRequired: false,
    validateEmail: true,
    allowCustomPreferences: true,
    allowCustomMetadata: true,
  },
});
```

### Version Retention

Unlike Vector memories, user profiles have **no version retention limit** by default:

```typescript
// All versions kept forever (audit compliance)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  userProfileVersionRetention: -1, // Unlimited (default)
});

// Or limit versions per user
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  userProfileVersionRetention: 20, // Keep last 20 versions
});
```

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

### 3. Skip Versioning for Routine Updates

Don't create versions for analytics/stats:

```typescript
// Create version for important changes
await cortex.users.update(
  userId,
  {
    preferences: { emailNotifications: false }, // User opt-out
  },
  {
    skipVersioning: false, // Create version
    versionReason: "user-requested",
  },
);

// Skip versioning for routine stats
await cortex.users.update(
  userId,
  {
    metadata: {
      lastSeen: new Date(),
      sessionCount: user.metadata.sessionCount + 1,
    },
  },
  {
    skipVersioning: true, // Don't version stats
  },
);
```

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

Define custom profile interfaces:

```typescript
interface CustomUserProfile extends UserProfile {
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

// Type-safe operations
const user = await cortex.users.get<CustomUserProfile>(userId);
console.log(user.preferences.emailFrequency); // Typed!
```

### 6. Cascade Deletion for GDPR

Always use cascade for user deletions:

```typescript
// GDPR-compliant deletion
async function handleGDPRDeletion(userId: string) {
  // Export data first (GDPR requirement)
  const userData = await cortex.users.export(
    {
      email: userEmail,
    },
    {
      format: "json",
      includeMemories: true,
      includeConversations: true,
    },
  );

  await saveToFile(`gdpr-export-${userId}.json`, userData);

  // Delete profile + all data
  const result = await cortex.users.delete(userId, {
    cascade: true,
    deleteConversations: true, // Complete deletion
    auditReason: "GDPR right to be forgotten",
  });

  return result;
}
```

---

## Graph-Lite Capabilities

Users are universal graph nodes - everything in Cortex can link to a user:

**User as Graph Hub:**

- Central node connecting all user-related data across the system

**Incoming Edges (What Links To Users):**

- `userId` from Conversations (user's chat history)
- `userId` from Contexts (user's workflows)
- `userId` from Memories (user-specific knowledge across all agents)
- `userId` from Facts (facts about the user)
- `userId` from Immutable records (user feedback, submissions)
- `userId` from Mutable records (user sessions, preferences)

**Graph Query - Complete User Data:**

```typescript
// GDPR export = complete graph traversal from user node
async function getUserDataGraph(userId: string) {
  return {
    profile: await cortex.users.get(userId),
    conversations: await cortex.conversations.list({ userId }),
    contexts: await cortex.contexts.list({ userId }),
    immutableRecords: await cortex.immutable.list({ userId }),
    mutableRecords: await cortex.mutable.list("*", { userId }),
    memories: await getAllMemoriesForUser(userId), // Across all agents
    facts: await cortex.immutable.list({ type: "fact", userId }),
  };
}

// Result: Complete graph of all user data across all Cortex layers
```

**GDPR Cascade as Graph Operation:**

The `delete({ cascade: true })` operation traverses the entire graph from the user node and deletes all connected entities with userId:

```
User-123 (delete this node)
  ↓ cascade follows all userId edges
  ├──> Conversation-1, Conversation-2, ... (delete)
  ├──> Context-1, Context-2, ... (delete)
  ├──> Memory-1, Memory-2, ... (delete across ALL agents)
  ├──> Fact-1, Fact-2, ... (delete)
  └──> All other entities with userId='user-123' (delete)
```

**Performance:** GDPR cascade for typical user (100-1000 connected entities) completes in 1-3 seconds (Cloud Mode).

**Learn more:** [Graph-Lite Traversal](../07-advanced-topics/01-graph-lite-traversal.md)

---

## Error Reference

All user operation errors:

| Error Code             | Description            | Cause                                |
| ---------------------- | ---------------------- | ------------------------------------ |
| `INVALID_USER_ID`      | User ID is invalid     | Empty or malformed userId            |
| `USER_NOT_FOUND`       | User doesn't exist     | Invalid userId                       |
| `INVALID_PROFILE_DATA` | Profile data malformed | Bad data structure                   |
| `INVALID_FILTERS`      | Filters malformed      | Bad filter syntax                    |
| `INVALID_PAGINATION`   | Pagination params bad  | Invalid limit/offset                 |
| `DELETION_FAILED`      | Delete failed          | Database error                       |
| `DELETION_CANCELLED`   | User cancelled delete  | Confirmation rejected                |
| `EXPORT_FAILED`        | Export failed          | File write error                     |
| `CONVEX_ERROR`         | Database error         | Convex operation failed              |
| `VERSION_NOT_FOUND`    | Version doesn't exist  | Invalid version number               |
| `INVALID_TIMESTAMP`    | Timestamp invalid      | Malformed date                       |
| `NO_USERS_MATCHED`     | No users match filters | No results for updateMany/deleteMany |

**See Also:**

- [Error Handling Guide](./09-error-handling.md)

---

## Next Steps

- **[Context Operations API](./05-context-operations.md)** - Context chain management
- **[A2A Communication API](./06-a2a-communication.md)** - Agent-to-agent messaging
- **[Conversation Operations API](./07-conversation-operations.md)** - ACID conversation management
- **[Types & Interfaces](./08-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
