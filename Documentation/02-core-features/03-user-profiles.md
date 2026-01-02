# User Profiles

> **Last Updated**: 2026-01-01

Rich user context and preferences that persist across all agents and conversations.

## Overview

User profiles exist for **ONE critical reason**: **GDPR-compliant cascade deletion**.

> **Cortex Cloud Feature**: Automatic cascade deletion is available in Cortex Cloud. Direct Mode can achieve GDPR compliance through manual deletion from each store.

**Cortex Cloud:** One API call removes user data from every store across all layers that contains an explicit `userId` reference - `cortex.users.delete(userId, { cascade: true })`.

**Direct Mode:** Achieves the same result through manual deletion loops (see Pattern 4 below for implementation).

**Secondary benefit:** Provides a semantic, user-friendly API for managing user data (`cortex.users.get()` instead of `cortex.immutable.get('user', ...)`).

**Under the hood:** User profiles are stored in `cortex.immutable.*` with `type='user'`. The `cortex.users.*` API is a specialized wrapper that adds cross-layer GDPR deletion capabilities (Cloud Mode) or convenience methods (Direct Mode).

## Core Concept: GDPR Cascade Deletion

> **Fully Implemented in SDK**: Cascade deletion with verification and rollback is available in the free SDK. Cloud Mode adds legal certificates and guarantees.

The SDK enables **one-click deletion** of all user data across the entire system:

```typescript
// SDK (Free) & Cloud Mode: GDPR "right to be forgotten" - ONE call
const result = await cortex.users.delete("user-123", { cascade: true });

// Automatically deletes from:
// ✅ User profile (immutable type='user')
// ✅ Layer 1a: All conversations with userId='user-123' (across ALL memory spaces)
// ✅ Layer 1b: All immutable records with userId='user-123'
// ✅ Layer 1c: All mutable keys with userId='user-123'
// ✅ Layer 2: All vector memories with userId='user-123' (across ALL memory spaces)
// ✅ Layer 3: All facts with userId='user-123' (across ALL memory spaces)
// ✅ Sessions: All sessions with userId='user-123'
// ✅ Graph: All nodes with userId property (if graph adapter configured)

console.log(`Total records deleted: ${result.totalDeleted}`);
console.log(`Layers affected: ${result.deletedLayers.join(", ")}`);
// Could be hundreds or thousands of records across all stores
```

**SDK vs Cloud Mode:**

| Feature               | SDK (Free)             | Cloud Mode (Planned)     |
| --------------------- | ---------------------- | ------------------------ |
| **Cascade Deletion**  | ✅ Full implementation | ✅ Same implementation   |
| **Verification**      | ✅ Automatic           | ✅ + Cryptographic proof |
| **Rollback**          | ✅ Automatic           | ✅ + Audit trail         |
| **Graph Support**     | ✅ DIY adapter         | ✅ Managed, zero-config  |
| **Legal Certificate** | ❌ Not included        | ✅ Compliance document   |

The SDK provides the **technical capability**, Cloud Mode provides the **legal guarantees**.

**Architecture:**

```
Layer 1: ACID Stores (all support optional userId)
├── conversations.* (userId: optional) ← GDPR cascade target
├── immutable.* (userId: optional) ← USER PROFILES stored here + cascade target
└── mutable.* (userId: optional) ← GDPR cascade target

Layer 2: Vector Index (supports optional userId)
└── vector.* (userId: optional) ← GDPR cascade target

Convenience API:
└── users.* (immutable wrapper + GDPR cascade engine)
```

**Secondary benefit - Semantic API:**

```typescript
// Convenience
await cortex.users.get("user-123");

// vs Equivalent
await cortex.immutable.get("user", "user-123");
```

## User Profile Structure

User profiles have a **flexible structure** - only `id` is required:

```typescript
interface UserProfile {
  // Identity (REQUIRED)
  id: string; // User ID
  tenantId?: string; // Multi-tenancy isolation (auto-injected from AuthContext)

  // User Data (FLEXIBLE - any structure you want!)
  data: Record<string, unknown>; // Completely customizable

  // System fields (automatic)
  version: number;
  createdAt: number; // Unix timestamp (milliseconds)
  updatedAt: number; // Unix timestamp (milliseconds)
}

interface UserVersion {
  version: number;
  data: Record<string, unknown>;
  timestamp: number; // Unix timestamp (milliseconds)
}
```

**Suggested Convention** (but not enforced):

```typescript
// Common pattern for user data structure
// NOTE: users.update() accepts data fields DIRECTLY (not wrapped in 'data' object)
await cortex.users.update("user-123", {
  displayName: "Alex Johnson", // Display name
  email: "alex@example.com", // Contact

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
    signupDate: Date.now(), // Unix timestamp (milliseconds)
    company: "Acme Corp",
  },

  // Add ANY custom fields
  customField: "anything you want!",
});
```

> **Automatic Versioning**: Like `immutable.*` stores, user profiles automatically preserve previous versions when updated. Track how user preferences change over time.

> **Under the Hood**: `cortex.users.update()` calls `cortex.immutable.store()` with `type='user'`.

## Basic Operations

### Creating a Profile

```typescript
// Create or update user profile
// NOTE: users.update() accepts data fields directly
await cortex.users.update("user-123", {
  displayName: "Alex Johnson",
  email: "alex@example.com",
  preferences: {
    theme: "dark",
    language: "en",
    timezone: "America/Los_Angeles",
    communicationStyle: "friendly",
  },
  metadata: {
    tier: "pro",
    signupDate: Date.now(), // Unix timestamp (milliseconds)
  },
  company: "Acme Corp",
});
```

### Retrieving a Profile

```typescript
// Get user profile
const user = await cortex.users.get("user-123");

console.log(user.data.displayName); // "Alex Johnson"
console.log(user.data.preferences.theme); // "dark"
console.log(user.data.tier); // "pro"
console.log(user.version); // Version number
```

### Updating Profiles

Updates automatically preserve previous versions:

```typescript
// Original profile
await cortex.users.update("user-123", {
  displayName: "Alex",
  preferences: {
    theme: "dark",
    language: "en",
  },
});

// Update theme (creates v2, preserves v1 - automatic deep merge)
await cortex.users.update("user-123", {
  preferences: {
    theme: "light", // Only updates theme, merges with existing
  },
});

// Get current profile
const user = await cortex.users.get("user-123");
console.log(user.version); // 2
console.log(user.data.preferences.theme); // 'light'

// Access version history via getHistory()
const history = await cortex.users.getHistory("user-123");
console.log(history[0].data.preferences.theme); // 'dark' (previous version)

// Update last seen (creates version - skipVersioning not yet implemented)
await cortex.users.update("user-123", {
  metadata: {
    lastSeen: Date.now(), // Unix timestamp (milliseconds)
  },
});

// Note: Skip versioning option is planned for a future release
```

### Deleting Profiles

```typescript
// Delete user profile only
await cortex.users.delete("user-123");

// Delete with cascade (SDK implements full cascade)
const result = await cortex.users.delete("user-123", {
  cascade: true, // Delete from all layers
  verify: true, // Verify deletion completeness (default)
});

console.log(result);
// {
//   userId: "user-123",
//   deletedAt: 1735689600000, // Unix timestamp
//
//   // Per-layer deletion counts
//   conversationsDeleted: 15,
//   conversationMessagesDeleted: 234,
//   immutableRecordsDeleted: 5,
//   mutableKeysDeleted: 12,
//   vectorMemoriesDeleted: 145,
//   factsDeleted: 89,
//   graphNodesDeleted: 47,  // undefined if no graph adapter
//
//   // Verification
//   verification: {
//     complete: true,
//     issues: []
//   },
//
//   // Summary
//   totalDeleted: 547,
//   deletedLayers: ['conversations', 'immutable', 'mutable', 'vector', 'facts', 'graph', 'user-profile']
// }

// GDPR-compliant deletion with audit trail
async function handleGDPRDeletion(userId: string, requestedBy: string) {
  // Log the request
  await auditLog.record({
    action: "gdpr-deletion-request",
    userId,
    requestedBy,
    timestamp: Date.now(),
  });

  // Delete everything with verification
  const result = await cortex.users.delete(userId, {
    cascade: true,
    verify: true, // Verify nothing was missed
  });

  // Log completion
  await auditLog.record({
    action: "gdpr-deletion-complete",
    userId,
    totalDeleted: result.totalDeleted,
    layers: result.deletedLayers,
    verificationComplete: result.verification.complete,
    timestamp: Date.now(),
  });

  return result;
}
```

## Using Profiles with Agents

### Access User Preferences

```typescript
async function respondToUser(
  memorySpaceId: string,
  userId: string,
  message: string,
) {
  // Get user profile
  const user = await cortex.users.get(userId);

  if (!user) {
    // Create default profile on first interaction
    await cortex.users.update(userId, {
      displayName: userId, // Temporary
      preferences: {
        language: detectLanguage(message),
        timezone: "UTC",
      },
      metadata: {
        tier: "free",
        signupDate: Date.now(), // Unix timestamp (milliseconds)
        firstMessage: message,
      },
    });

    user = await cortex.users.get(userId);
  }

  // Adapt response based on preferences
  let response = await generateResponse(message);

  // Apply communication style
  if (user.preferences.communicationStyle === "formal") {
    response = makeFormal(response);
  }

  // Localize if needed
  if (user.preferences.language !== "en") {
    response = await translate(response, user.preferences.language);
  }

  // Update last seen
  await cortex.users.update(userId, {
    metadata: {
      lastSeen: Date.now(), // Unix timestamp (milliseconds)
    },
  });
  // Note: Every update creates a version. skipVersioning is planned for future release.

  return response;
}
```

### Personalization

```typescript
async function personalizeExperience(userId: string) {
  const user = await cortex.users.get(userId);

  return {
    greeting: `Hello ${user.displayName}!`,
    theme: user.preferences.theme || "light",
    timezone: user.preferences.timezone || "UTC",
    isPro: user.metadata.tier === "pro",
  };
}
```

### Cross-Agent Context

All agents can access user profile:

```typescript
// Support agent uses profile
const user = await cortex.users.get(userId);
const greeting = `Good ${getTimeOfDay(user.preferences.timezone)}, ${user.displayName}!`;

// Sales agent uses same profile
const user = await cortex.users.get(userId);
if (user.metadata.tier === "free") {
  offerUpgrade();
}

// Billing agent uses same profile
const user = await cortex.users.get(userId);
sendInvoiceTo(user.email);
```

## Advanced Features

### Profile Schemas

Define custom profile schemas:

```typescript
// Define your user structure
interface CustomUserProfile extends UserProfile {
  preferences: {
    theme: "light" | "dark";
    language: "en" | "es" | "fr";
    emailFrequency: "daily" | "weekly" | "never";
    featuresEnabled: string[];
  };
  metadata: {
    tier: "free" | "pro" | "enterprise";
    credits: number;
    lastPurchase?: Date;
    referralCode?: string;
  };
}

// Use with type safety
const user = await cortex.users.get<CustomUserProfile>(userId);
console.log(user.preferences.emailFrequency); // Typed!
```

### Nested Preferences

Organize complex preferences:

```typescript
await cortex.users.update(userId, {
  preferences: {
    notifications: {
      email: true,
      push: false,
      sms: false,
      frequency: "weekly",
    },
    privacy: {
      shareData: false,
      analytics: true,
      marketing: false,
    },
    ui: {
      theme: "dark",
      density: "comfortable",
      animations: true,
    },
  },
});

// Access nested values
const user = await cortex.users.get(userId);
if (user.preferences.notifications.email) {
  sendEmail(user.email, notification);
}
```

### Profile Validation

Validate before updating:

```typescript
import { z } from "zod";

const UserProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  preferences: z
    .object({
      theme: z.enum(["light", "dark"]).optional(),
      language: z.string().length(2).optional(),
      timezone: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

async function safeUpdateProfile(userId: string, data: any) {
  // Validate
  const validated = UserProfileSchema.parse(data);

  // Update
  return await cortex.users.update(userId, validated);
}
```

## Real-World Patterns

### Pattern 1: Initialize on First Contact

```typescript
async function handleFirstMessage(userId: string, message: string) {
  // Check if profile exists
  let user = await cortex.users.get(userId);

  if (!user) {
    // Create default profile
    await cortex.users.update(userId, {
      displayName: userId, // Temporary until we know their name
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

    user = await cortex.users.get(userId);
  }

  return user;
}
```

### Pattern 2: Progressive Enhancement

Build user profiles over time:

```typescript
async function learnFromConversation(userId: string, conversation: string) {
  const user = await cortex.users.get(userId);
  const existingData = user?.data || {};

  // Extract information from conversation
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
      lastSeen: Date.now(),
      conversationCount:
        ((existingData.metadata?.conversationCount as number) || 0) + 1,
    },
  });
}
```

### Pattern 3: User Preferences UI

Sync with user-facing preferences:

```typescript
// User updates preferences in your UI
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
```

### Pattern 4: GDPR Compliance

**SDK Implementation (Automatic Cascade):**

```typescript
async function handleDataDeletionRequest(userId: string) {
  // Export data first (GDPR requirement)
  const exportData = await cortex.users.export({
    format: "json",
    filters: { displayName: userId }, // or use other filter criteria
    includeVersionHistory: true,
    includeConversations: true,
    includeMemories: true,
  });

  // Save export
  await saveToFile(`gdpr-export-${userId}.json`, exportData);

  // SDK: One-click cascade deletion with verification
  const result = await cortex.users.delete(userId, {
    cascade: true,
    verify: true, // Verify nothing was missed
  });

  console.log(`GDPR deletion complete for user ${userId}`);
  console.log(`- Conversations deleted: ${result.conversationsDeleted}`);
  console.log(`- Vector memories deleted: ${result.vectorMemoriesDeleted}`);
  console.log(`- Facts deleted: ${result.factsDeleted}`);
  console.log(`- Graph nodes deleted: ${result.graphNodesDeleted || "N/A"}`);
  console.log(`- Total records: ${result.totalDeleted}`);
  console.log(
    `- Verification: ${result.verification.complete ? "Complete" : "Issues found"}`,
  );

  return result;
  // Done with SDK cascade! ✅
}
```

**With Dry Run (Preview Before Deletion):**

```typescript
// Preview what would be deleted
const preview = await cortex.users.delete(userId, {
  cascade: true,
  dryRun: true, // Just preview, don't delete
});

console.log(`Would delete ${preview.totalDeleted} records`);
console.log(`Conversations: ${preview.conversationsDeleted}`);
console.log(`Memories: ${preview.vectorMemoriesDeleted}`);

// If acceptable, execute actual deletion
if (preview.totalDeleted < 10000) {
  await cortex.users.delete(userId, { cascade: true });
}
```

## Querying User Profiles

### Search Users

Find users with supported filters:

```typescript
// Search by displayName (client-side contains match)
const alexUsers = await cortex.users.search({
  displayName: "alex",
  limit: 50,
});

// Search by email
const acmeUsers = await cortex.users.search({
  email: "acme.com",
});

// Search users created in the last 30 days
const recentUsers = await cortex.users.search({
  createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
  sortBy: "createdAt",
  sortOrder: "desc",
});

// Search users not updated in 90 days
const inactive = await cortex.users.search({
  updatedBefore: Date.now() - 90 * 24 * 60 * 60 * 1000,
});
```

> **Note:** The `displayName` and `email` filters are applied client-side. For filtering by custom fields like `metadata.tier`, retrieve users and filter in your application code.

### List Users (Paginated)

```typescript
// List all users with pagination
const page1 = await cortex.users.list({
  limit: 50,
  offset: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
});

console.log(`Retrieved ${page1.users.length} of ${page1.total} users`);
console.log(`Has more: ${page1.hasMore}`);

// List users created since October 2025
const recentUsers = await cortex.users.list({
  createdAfter: new Date("2025-10-01").getTime(),
  limit: 100,
});
```

### Count Users

```typescript
// Total user count
const total = await cortex.users.count();

// Count users created in the last 30 days
const recentSignups = await cortex.users.count({
  createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
});

// Count users active this week (based on updatedAt)
const activeThisWeek = await cortex.users.count({
  updatedAfter: Date.now() - 7 * 24 * 60 * 60 * 1000,
});

console.log(`New signups (30 days): ${recentSignups}`);
console.log(`Active users (7 days): ${activeThisWeek}`);
```

### Bulk Operations

```typescript
// Update multiple users by explicit IDs
const result = await cortex.users.updateMany(["user-1", "user-2", "user-3"], {
  data: { welcomeEmailSent: true },
});
console.log(`Updated ${result.updated} users`);

// Update users by date filter (users created in last 7 days)
await cortex.users.updateMany(
  { createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000 },
  { data: { welcomeEmailSent: true } },
);

// Delete users not updated in 1 year (use with caution!)
await cortex.users.deleteMany(
  { updatedBefore: Date.now() - 365 * 24 * 60 * 60 * 1000 },
  { cascade: true }, // Delete all associated data
);
```

## Multi-Tenancy Support

> **Recommended:** Use AuthContext for automatic tenant isolation in multi-tenant apps.

### Automatic Tenant Injection

```typescript
import { Cortex, createAuthContext } from "@cortexmemory/sdk";

// Initialize with tenant context
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  auth: createAuthContext({
    tenantId: "customer-acme", // Tenant isolation
    userId: "admin-user",
    sessionId: "session-xyz",
  }),
});

// All user operations automatically scoped to tenant
await cortex.users.update("user-123", {
  // tenantId: "customer-acme" ← Auto-injected
  displayName: "Alex Johnson",
  email: "alex@acme.com",
  role: "admin",
});

// Queries automatically filtered by tenant
const users = await cortex.users.list({ limit: 100 });
// Only returns users for tenant "customer-acme"

// Count users in tenant
const count = await cortex.users.count();
// Only counts users for tenant "customer-acme"

// GDPR cascade respects tenant boundaries
await cortex.users.delete("user-123", { cascade: true });
// Only deletes user-123 data within "customer-acme" tenant
```

### Per-Tenant User Management

```typescript
// List users for a tenant
const result = await cortex.users.list({
  tenantId: "customer-acme", // Optional explicit filter
  limit: 100,
});

console.log(`Tenant has ${result.total} users`);

// Export tenant users
const exportData = await cortex.users.export({
  format: "json",
  includeVersionHistory: true,
  includeConversations: true,
  includeMemories: true,
});
// Automatically filtered by tenant from auth context

// Bulk update for tenant users
await cortex.users.updateMany(
  { createdAfter: Date.now() - 7 * 24 * 60 * 60 * 1000 },
  { data: { welcomeEmailSent: true } },
);
// Automatically scoped to current tenant
```

See [Isolation Boundaries](./17-isolation-boundaries.md) for complete multi-tenancy documentation.

## Profile Version History

### Viewing Profile Changes

```typescript
// Get current profile
const user = await cortex.users.get("user-123");

console.log(`Current version: ${user.version}`);
console.log(`Display name: ${user.data.displayName}`);
console.log(`Theme: ${user.data.preferences?.theme}`);

// View all versions using getHistory()
const history = await cortex.users.getHistory("user-123");

console.log(`User has ${history.length} profile versions:`);
history.forEach((v) => {
  console.log(`v${v.version} (${new Date(v.timestamp).toISOString()}):`);
  console.log(`  Display name: ${v.data.displayName}`);
  console.log(`  Theme: ${v.data.preferences?.theme}`);
});
```

### Get Specific Version

```typescript
// What were user's preferences on a specific date?
const historicalProfile = await cortex.users.getAtTimestamp(
  "user-123",
  new Date("2025-08-01"),
);

console.log("Theme in August:", historicalProfile.preferences.theme);
```

### Track Preference Changes

```typescript
// Analyze how preferences evolved
async function analyzePreferenceChanges(userId: string) {
  const history = await cortex.users.getHistory(userId);

  const changes = [];

  for (let i = 1; i < history.length; i++) {
    const current = history[i];
    const previous = history[i - 1];

    // Detect theme changes
    if (current.data.preferences?.theme !== previous.data.preferences?.theme) {
      changes.push({
        field: "theme",
        from: previous.data.preferences?.theme,
        to: current.data.preferences?.theme,
        when: new Date(current.timestamp),
      });
    }
  }

  return changes;
}
```

## Profile Analytics

### Usage Tracking

```typescript
// Track profile access
const user = await cortex.users.get(userId);

// Automatically tracked:
console.log({
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  version: user.version,
  lastSeen: user.metadata.lastSeen,
});

// Log access for analytics
await analytics.track("profile-accessed", {
  userId,
  timestamp: new Date(),
  accessedBy: agentId,
});
```

### Profile Completeness

Measure how complete a profile is:

```typescript
function calculateCompleteness(user: UserProfile): number {
  const fields = [
    user.displayName,
    user.email,
    user.preferences.theme,
    user.preferences.language,
    user.preferences.timezone,
  ];

  const filled = fields.filter((f) => f !== undefined && f !== null).length;
  return (filled / fields.length) * 100;
}

const user = await cortex.users.get(userId);
const completeness = calculateCompleteness(user);

if (completeness < 50) {
  console.log("Profile incomplete - prompt user for more info");
}
```

## Cloud Mode Features

> **Cloud Mode Only**: Enhanced profile features with Cortex Cloud

### Profile Analytics Dashboard

- User engagement metrics
- Preference trends
- Profile completeness scores
- User segmentation

### Smart Defaults

AI-powered default suggestions:

- "Most users in this region prefer timezone X"
- "Users with similar usage patterns prefer Y"
- Auto-detect language from messages

### Profile Synchronization

Sync with external systems:

- Auth0, Clerk, Supabase Auth
- CRM systems (Salesforce, HubSpot)
- Identity providers (Okta, Azure AD)

## Supported Filters

User operations support the following filter parameters:

```typescript
interface UserFilters {
  // Pagination
  limit?: number; // Max results (default: 50, max: 1000)
  offset?: number; // Skip first N results

  // Date filters (Unix timestamps in milliseconds)
  createdAfter?: number; // Users created after this time
  createdBefore?: number; // Users created before this time
  updatedAfter?: number; // Users updated after this time
  updatedBefore?: number; // Users updated before this time

  // Sorting
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";

  // Client-side filters (applied after fetching)
  displayName?: string; // Contains match on data.displayName
  email?: string; // Contains match on data.email
}
```

**Example:**

```typescript
// Search with supported filters
const users = await cortex.users.search({
  createdAfter: Date.now() - 30 * 24 * 60 * 60 * 1000,
  displayName: "alex",
  sortBy: "createdAt",
  sortOrder: "desc",
  limit: 50,
});

// Export with filters
const exportData = await cortex.users.export({
  format: "json",
  filters: {
    createdAfter: Date.now() - 90 * 24 * 60 * 60 * 1000,
  },
});
```

> **Note:** For filtering by custom data fields (like `metadata.tier`), retrieve users with date filters and apply additional filtering in your application code.

## Best Practices

### 1. Minimal Required Fields

Only require what you truly need:

```typescript
// ✅ Start minimal
await cortex.users.update(userId, {
  displayName: "Alex", // That's it!
});

// Add more over time as you learn
```

### 2. Default Values

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

### 3. Update Timestamp

Track when user was last seen:

```typescript
async function recordUserActivity(userId: string) {
  await cortex.users.update(userId, {
    metadata: {
      lastSeen: new Date(),
    },
  });
}
```

### 4. Privacy-First

Don't store unnecessary PII:

```typescript
// ❌ Storing unnecessary data
await cortex.users.update(userId, {
  metadata: {
    ssn: "123-45-6789", // Don't store this!
    creditCard: "4111...", // Definitely not this!
  },
});

// ✅ Store only what's needed
await cortex.users.update(userId, {
  preferences: {
    paymentMethod: "card-ending-1234", // Reference only
  },
});
```

### 5. Automatic Version Tracking

> **Note:** Currently, every `update()` call creates a new version automatically. Skip versioning option is planned for a future release.

```typescript
// Important preference changes - creates version (automatic)
await cortex.users.update(userId, {
  preferences: {
    emailNotifications: false, // User opts out
  },
});

// Routine updates - also creates versions (automatic)
const user = await cortex.users.get(userId);
await cortex.users.update(userId, {
  metadata: {
    lastSeen: Date.now(), // Unix timestamp (milliseconds)
    sessionCount: ((user?.data.metadata?.sessionCount as number) || 0) + 1,
  },
});

// Use getHistory() to review version history
const history = await cortex.users.getHistory(userId);
console.log(`User has ${history.length} profile versions`);
```

## Next Steps

- **[User Operations API](../03-api-reference/04-user-operations.md)** - Complete API reference
- **[Isolation Boundaries](./17-isolation-boundaries.md)** - Multi-tenancy and isolation model
- **[Auth Integration](../08-integrations/auth-providers.md)** - AuthContext setup
- **[Context Chains](./04-context-chains.md)** - Multi-agent coordination
- **[Conversation History](./06-conversation-history.md)** - Message persistence
- **[Memory Spaces](./01-memory-spaces.md)** - Space isolation concepts

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
