# Immutable Store API

> **Last Updated**: 2025-10-24

Complete API reference for shared immutable data storage with automatic versioning.

## Overview

The Immutable Store API (Layer 1b) provides methods for storing shared, immutable data across all agents. Unlike conversations (agent-private), immutable data is globally accessible and designed for knowledge bases, policies, audit logs, and reference data.

**Key Characteristics:**

- ✅ **Shared** - All agents can access
- ✅ **Immutable** - Can't edit once stored
- ✅ **Versioned** - Automatic version tracking
- ✅ **Append-only** - New versions append, old preserved
- ✅ **Purgeable** - Can delete by policy or manually
- ✅ **ACID** - All guarantees of Layer 1

**Comparison to Other Stores:**

| Feature    | Conversations (1a) | Immutable (1b) | Mutable (1c) | Vector (2)   |
| ---------- | ------------------ | -------------- | ------------ | ------------ |
| Privacy    | Private            | Shared         | Shared       | Private      |
| Mutability | Immutable          | Immutable      | Mutable      | Mutable      |
| Versioning | N/A (append)       | Auto           | No           | Auto         |
| Retention  | 7 years            | 20 versions    | N/A          | 10 versions  |
| Use Case   | Chats              | Knowledge      | Live data    | Search index |

---

## Core Operations

### store()

Store immutable data. Creates v1 or increments version if ID exists.

**Signature:**

```typescript
cortex.immutable.store(
  entry: ImmutableEntry
): Promise<ImmutableRecord>
```

**Parameters:**

```typescript
interface ImmutableEntry {
  type: string; // Entity type: 'kb-article', 'policy', 'audit-log', 'feedback'
  id: string; // Logical ID (versioned)
  data: Record<string, any>; // The actual data
  userId?: string; // OPTIONAL: Links to user (enables GDPR cascade)
  metadata?: {
    publishedBy?: string;
    tags?: string[];
    importance?: number; // 0-100
    [key: string]: any;
  };
}
```

**userId Field:**

- **Optional** - Only include if this record belongs to a specific user
- **Validated** - Must reference an existing user profile
- **GDPR-enabled** - Allows `cortex.users.delete(userId, { cascade: true })` to find and delete this record
- **Use cases**: User feedback, user-submitted content, user surveys, user audit logs

**Examples:**

```typescript
// With userId (user-generated content)
await cortex.immutable.store({
  type: "feedback",
  id: "feedback-456",
  userId: "user-123", // ← Links to user
  data: {
    rating: 5,
    comment: "Great service!",
    submittedAt: new Date(),
  },
});

// Without userId (system content)
await cortex.immutable.store({
  type: "kb-article",
  id: "refund-policy",
  // No userId - not user-specific
  data: {
    title: "Refund Policy",
    content: "...",
  },
});
```

**Returns:**

```typescript
interface ImmutableRecord {
  type: string;
  id: string; // Logical ID
  version: number; // Version number
  data: Record<string, any>;
  userId?: string; // OPTIONAL: User link (GDPR-enabled)
  metadata: any;
  createdAt: Date; // When this version created
  previousVersions: ImmutableVersion[]; // Subject to retention
}

interface ImmutableVersion {
  version: number;
  data: any;
  userId?: string; // User link (preserved in history)
  metadata: any;
  timestamp: Date;
}
```

**Side Effects:**

- If ID exists: Creates new version, preserves previous (subject to retention)
- If ID new: Creates version 1

**Example:**

```typescript
// Create v1
const v1 = await cortex.immutable.store({
  type: "kb-article",
  id: "refund-policy",
  data: {
    title: "Refund Policy",
    content: "Refunds available within 30 days...",
    author: "admin@company.com",
  },
  metadata: {
    publishedBy: "admin",
    tags: ["policy", "refunds", "customer-service"],
    importance: 90,
  },
});

console.log(v1.version); // 1
console.log(v1.id); // 'refund-policy'

// Update creates v2 (v1 preserved)
const v2 = await cortex.immutable.store({
  type: "kb-article",
  id: "refund-policy", // Same ID
  data: {
    title: "Refund Policy v2",
    content: "Refunds available within 60 days...", // Updated
    author: "admin@company.com",
  },
  metadata: {
    publishedBy: "admin",
    tags: ["policy", "refunds", "customer-service"],
    importance: 90,
  },
});

console.log(v2.version); // 2
console.log(v2.previousVersions.length); // 1 (contains v1)
```

**Errors:**

- `CortexError('INVALID_TYPE')` - Type is empty or invalid
- `CortexError('INVALID_ID')` - ID is empty or invalid
- `CortexError('DATA_TOO_LARGE')` - Data exceeds size limit
- `CortexError('USER_NOT_FOUND')` - userId doesn't reference existing user
- `CortexError('CONVEX_ERROR')` - Database error

---

### get()

Get current version of immutable data.

**Signature:**

```typescript
cortex.immutable.get(
  type: string,
  id: string
): Promise<ImmutableRecord | null>
```

**Parameters:**

- `type` (string) - Entity type
- `id` (string) - Logical ID

**Returns:**

- `ImmutableRecord` - Current version with history (subject to retention)
- `null` - If doesn't exist

**Example:**

```typescript
const article = await cortex.immutable.get("kb-article", "refund-policy");

if (article) {
  console.log(`Current version: ${article.version}`);
  console.log(`Title: ${article.data.title}`);
  console.log(`Content: ${article.data.content}`);

  // View version history
  article.previousVersions.forEach((v) => {
    console.log(`v${v.version} (${v.timestamp}): ${v.data.title}`);
  });
}
```

**Errors:**

- `CortexError('INVALID_TYPE')` - Type is invalid
- `CortexError('NOT_FOUND')` - Record doesn't exist

---

### getVersion()

Get specific version of immutable data.

**Signature:**

```typescript
cortex.immutable.getVersion(
  type: string,
  id: string,
  version: number
): Promise<ImmutableVersion | null>
```

**Parameters:**

- `type` (string) - Entity type
- `id` (string) - Logical ID
- `version` (number) - Version number

**Returns:**

- `ImmutableVersion` - Specific version
- `null` - If version doesn't exist or purged by retention

**Example:**

```typescript
// Get version 1
const v1 = await cortex.immutable.getVersion("kb-article", "refund-policy", 1);

if (v1) {
  console.log(`v1 content: ${v1.data.content}`);
  console.log(`v1 created: ${v1.timestamp}`);
} else {
  console.log("Version 1 purged by retention policy");
}
```

---

### getHistory()

Get all versions of immutable data.

**Signature:**

```typescript
cortex.immutable.getHistory(
  type: string,
  id: string
): Promise<ImmutableVersion[]>
```

**Returns:**

- `ImmutableVersion[]` - All versions (subject to retention)

**Example:**

```typescript
const history = await cortex.immutable.getHistory("policy", "max-refund");

console.log(`Policy has ${history.length} versions:`);
history.forEach((v) => {
  console.log(`v${v.version} (${v.timestamp}): Value ${v.data.value}`);
  console.log(`  Changed by: ${v.metadata.publishedBy}`);
  console.log(`  Reason: ${v.data.reason}`);
});
```

---

### getAtTimestamp()

Get version that was current at specific time.

**Signature:**

```typescript
cortex.immutable.getAtTimestamp(
  type: string,
  id: string,
  timestamp: Date
): Promise<ImmutableVersion | null>
```

**Example:**

```typescript
// What was the refund policy on January 1st?
const policy = await cortex.immutable.getAtTimestamp(
  "policy",
  "max-refund",
  new Date("2025-01-01"),
);

if (policy) {
  console.log(`Policy on Jan 1: $${policy.data.value}`);
} else {
  console.log("Policy didn't exist yet or version purged");
}
```

---

### list()

List immutable records with filtering.

**Signature:**

```typescript
cortex.immutable.list(
  filters?: ImmutableFilters
): Promise<ImmutableListResult>
```

**Parameters:**

```typescript
interface ImmutableFilters {
  type?: string; // Filter by type
  types?: string[]; // Multiple types
  metadata?: Record<string, any>; // Metadata filters
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  minVersion?: number; // Only records with N+ versions
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "version" | "type";
  sortOrder?: "asc" | "desc";
}
```

**Returns:**

```typescript
interface ImmutableListResult {
  records: ImmutableRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

**Example:**

```typescript
// List all KB articles
const articles = await cortex.immutable.list({
  type: "kb-article",
  sortBy: "createdAt",
  sortOrder: "desc",
  limit: 50,
});

// List all policies
const policies = await cortex.immutable.list({
  type: "policy",
  metadata: { category: "refunds" },
});

// List frequently updated items
const volatile = await cortex.immutable.list({
  minVersion: 5, // At least 5 versions
  sortBy: "version",
  sortOrder: "desc",
});
```

---

### search()

Search immutable data by content.

**Signature:**

```typescript
cortex.immutable.search(
  query: string,
  filters?: ImmutableSearchFilters
): Promise<ImmutableSearchResult[]>
```

**Parameters:**

```typescript
interface ImmutableSearchFilters extends ImmutableFilters {
  searchIn?: "data" | "metadata" | "both"; // Where to search
}
```

**Returns:**

```typescript
interface ImmutableSearchResult {
  record: ImmutableRecord;
  score: number;
  matches: string[]; // Matched fields
}
```

**Example:**

```typescript
// Search across all KB articles
const results = await cortex.immutable.search("refund process", {
  type: "kb-article",
  searchIn: "both",
});

results.forEach((r) => {
  console.log(`${r.record.data.title} (score: ${r.score})`);
  console.log(`Matches: ${r.matches.join(", ")}`);
});
```

---

### count()

Count immutable records.

**Signature:**

```typescript
cortex.immutable.count(
  filters?: ImmutableFilters
): Promise<number>
```

**Example:**

```typescript
// Total KB articles
const total = await cortex.immutable.count({ type: "kb-article" });

// Policies updated this month
const recentPolicies = await cortex.immutable.count({
  type: "policy",
  createdAfter: new Date("2025-10-01"),
});
```

---

### purge()

Delete all versions of an immutable record.

**Signature:**

```typescript
cortex.immutable.purge(
  type: string,
  id: string
): Promise<PurgeResult>
```

**Returns:**

```typescript
interface PurgeResult {
  type: string;
  id: string;
  versionsDeleted: number;
  purgedAt: Date;
}
```

**Example:**

```typescript
// Delete all versions of an article
const result = await cortex.immutable.purge("kb-article", "old-article");

console.log(`Purged ${result.versionsDeleted} versions`);
```

**Warning:** This deletes ALL versions. Vector memories with `immutableRef` will have broken references.

---

### purgeMany()

Bulk delete immutable records.

**Signature:**

```typescript
cortex.immutable.purgeMany(
  filters: ImmutableFilters,
  options?: PurgeOptions
): Promise<PurgeResult>
```

**Parameters:**

```typescript
interface PurgeOptions {
  dryRun?: boolean;
  requireConfirmation?: boolean;
}
```

**Example:**

```typescript
// Preview purge
const preview = await cortex.immutable.purgeMany(
  {
    type: "audit-log",
    createdBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  },
  { dryRun: true },
);

console.log(`Would purge ${preview.recordsAffected} audit logs`);

// Execute
const result = await cortex.immutable.purgeMany({
  type: "audit-log",
  createdBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
});
```

---

### purgeVersions()

Delete old versions while keeping recent ones (retention enforcement).

**Signature:**

```typescript
cortex.immutable.purgeVersions(
  type: string,
  id: string,
  options: PurgeVersionOptions
): Promise<PurgeResult>
```

**Parameters:**

```typescript
interface PurgeVersionOptions {
  keepLatest?: number; // Keep N most recent versions
  olderThan?: Date; // Purge versions before date
}
```

**Example:**

```typescript
// Keep only last 20 versions
const result = await cortex.immutable.purgeVersions("kb-article", "guide-123", {
  keepLatest: 20,
});

console.log(`Purged ${result.versionsDeleted} old versions`);

// Delete versions older than 1 year
await cortex.immutable.purgeVersions("policy", "refund-policy", {
  olderThan: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
});
```

---

## Version Management

### Configuration

```typescript
// Global retention configuration
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
  immutableRetention: {
    defaultVersions: 20, // Keep last 20 versions per entity
    byType: {
      "audit-log": -1, // Unlimited for audit logs
      "kb-article": 50, // Keep 50 versions for KB
      policy: -1, // Unlimited for policies
      "agent-reasoning": 10, // Keep 10 for reasoning logs
    },
  },
});
```

### Automatic Version Creation

```typescript
// First store - creates v1
const v1 = await cortex.immutable.store({
  type: "kb-article",
  id: "guide-1",
  data: { content: "Version 1" },
});

// Same ID - creates v2 automatically
const v2 = await cortex.immutable.store({
  type: "kb-article",
  id: "guide-1", // Same ID
  data: { content: "Version 2" }, // Updated content
});

// Get current (v2) with history
const current = await cortex.immutable.get("kb-article", "guide-1");
console.log(current.version); // 2
console.log(current.previousVersions[0].version); // 1
```

---

## Common Types

### KB Articles

```typescript
await cortex.immutable.store({
  type: "kb-article",
  id: "how-to-refund",
  data: {
    title: "How to Process Refunds",
    content: "1. Verify eligibility\n2. Process in system...",
    category: "customer-service",
    author: "training-team",
  },
  metadata: {
    publishedBy: "admin",
    tags: ["refunds", "how-to", "training"],
    importance: 85,
  },
});
```

### Policies

```typescript
await cortex.immutable.store({
  type: "policy",
  id: "max-refund-amount",
  data: {
    value: 5000,
    currency: "USD",
    effectiveDate: new Date(),
    approvedBy: "ceo-agent",
    reason: "Increased from $2000 for customer satisfaction",
  },
  metadata: {
    publishedBy: "ceo-agent",
    tags: ["policy", "financial", "refunds"],
    importance: 100,
  },
});
```

### Audit Logs

```typescript
await cortex.immutable.store({
  type: "audit-log",
  id: `audit-${Date.now()}`, // Unique ID per log entry
  data: {
    action: "REFUND_APPROVED",
    agentId: "finance-agent",
    userId: "user-123",
    amount: 500,
    reason: "Defective product",
    timestamp: new Date(),
  },
  metadata: {
    importance: 95,
    tags: ["audit", "refund", "financial"],
  },
});
```

### Agent Reasoning

```typescript
await cortex.immutable.store({
  type: "agent-reasoning",
  id: `reasoning-${agentId}-${Date.now()}`,
  data: {
    agentId: "support-agent",
    userId: "user-123",
    situation: "User seems frustrated",
    reasoning: "Detected negative sentiment in last 3 messages",
    decision: "Switch to empathetic tone",
    confidence: 0.87,
  },
  metadata: {
    importance: 70,
    tags: ["reasoning", "sentiment", "tone-adjustment"],
  },
});
```

---

## Integration with Vector Layer

### Indexing Immutable Data

```typescript
// 1. Store in immutable (Layer 1b)
const article = await cortex.immutable.store({
  type: "kb-article",
  id: "refund-guide",
  data: { title: "Refund Guide", content: "..." },
});

// 2. Index in Vector for searchability (Layer 2)
await cortex.vector.store("kb-agent", {
  content: `${article.data.title}: ${article.data.content}`,
  contentType: "raw", // or 'summarized'
  embedding: await embed(article.data.content),
  source: { type: "system", timestamp: new Date() },
  immutableRef: {
    // Link to immutable store
    type: article.type,
    id: article.id,
    version: article.version,
  },
  metadata: {
    importance: 85,
    tags: ["kb", "refunds"],
  },
});

// 3. All agents can search
const results = await cortex.memory.search("support-agent", "refund policy");

// 4. Retrieve full article via immutableRef
if (results[0].immutableRef) {
  const fullArticle = await cortex.immutable.get(
    results[0].immutableRef.type,
    results[0].immutableRef.id,
  );
  console.log("Full article:", fullArticle.data);
}
```

---

## Best Practices

### 1. Use Meaningful Types

```typescript
// ✅ Good types
"kb-article";
"policy-refund";
"audit-log-financial";
"agent-reasoning";

// ❌ Bad types
"data";
"item";
"thing";
```

### 2. Version-Aware IDs

```typescript
// ✅ Logical IDs that can be versioned
"refund-policy"; // Same ID, multiple versions
"guide-refunds";
"config-max-users";

// ❌ Timestamped IDs (defeats versioning)
"refund-policy-2025-10-24"; // Each is separate, no version tracking
```

### 3. Store Complete Data

```typescript
// ✅ Self-contained
await cortex.immutable.store({
  type: "kb-article",
  id: "guide-1",
  data: {
    title: "...",
    content: "...", // Full content
    author: "...",
    publishedDate: new Date(),
    category: "...",
  },
});

// ❌ Partial data requiring joins
await cortex.immutable.store({
  type: "kb-article",
  id: "guide-1",
  data: {
    authorId: "user-123", // Requires lookup elsewhere
  },
});
```

### 4. Index Important Data in Vector

```typescript
// Store in immutable for source of truth
const policy = await cortex.immutable.store({
  type: "policy",
  id: "refund-max",
  data: { value: 5000 },
});

// Index in Vector for searchability
await cortex.vector.store("policy-agent", {
  content: `Maximum refund amount is $${policy.data.value}`,
  contentType: "raw",
  embedding: await embed("maximum refund amount"),
  immutableRef: { type: "policy", id: "refund-max", version: policy.version },
  metadata: { importance: 90, tags: ["policy", "refunds"] },
});
```

---

## Retention & Purging

### Automatic Retention

```typescript
// Configured per type
immutableRetention: {
  byType: {
    'kb-article': { versionsToKeep: 50 },
    'policy': { versionsToKeep: -1 },  // Unlimited
    'audit-log': { versionsToKeep: -1 },
    'agent-reasoning': { versionsToKeep: 10 }
  }
}

// Automatic cleanup runs periodically
// Old versions beyond retention are purged
```

### Manual Purging

```typescript
// Purge specific entity
await cortex.immutable.purge("kb-article", "outdated-guide");

// Purge by filter
await cortex.immutable.purgeMany({
  type: "agent-reasoning",
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
});

// Clean up old versions (keep latest 20)
await cortex.immutable.purgeVersions("kb-article", "guide-123", {
  keepLatest: 20,
});
```

---

## Use Cases

### Use Case 1: Knowledge Base

```typescript
// Publish article
await cortex.immutable.store({
  type: "kb-article",
  id: "troubleshooting-login",
  data: {
    title: "Troubleshooting Login Issues",
    content: "...",
    sections: ["Check credentials", "Clear cache", "Contact support"],
  },
});

// Update article (creates v2)
await cortex.immutable.store({
  type: "kb-article",
  id: "troubleshooting-login",
  data: {
    title: "Troubleshooting Login Issues",
    content: "... updated with new section ...",
    sections: [
      "Check credentials",
      "Clear cache",
      "Reset 2FA",
      "Contact support",
    ],
  },
});

// Agents access current version
const guide = await cortex.immutable.get("kb-article", "troubleshooting-login");
```

### Use Case 2: Policy Management

```typescript
// Set initial policy
await cortex.immutable.store({
  type: "policy",
  id: "refund-window",
  data: {
    days: 30,
    effectiveDate: new Date("2025-01-01"),
    approvedBy: "board",
  },
});

// Update policy (v2)
await cortex.immutable.store({
  type: "policy",
  id: "refund-window",
  data: {
    days: 60, // Extended
    effectiveDate: new Date("2025-06-01"),
    approvedBy: "board",
    reason: "Customer satisfaction initiative",
  },
});

// Agents check policy
const policy = await cortex.immutable.get("policy", "refund-window");
if (daysSincePurchase <= policy.data.days) {
  // Approve refund
}
```

### Use Case 3: Audit Trail

```typescript
// Log every significant action
async function logAction(action: string, agentId: string, data: any) {
  await cortex.immutable.store({
    type: "audit-log",
    id: `${action}-${Date.now()}`, // Unique per action
    data: {
      action,
      agentId,
      ...data,
      timestamp: new Date(),
    },
    metadata: {
      importance: 95,
      tags: ["audit", action.toLowerCase()],
    },
  });
}

// Query audit trail
const auditLogs = await cortex.immutable.list({
  type: "audit-log",
  metadata: { agentId: "finance-agent" },
  createdAfter: new Date("2025-10-01"),
  limit: 100,
});
```

---

## Summary

**Immutable Store provides:**

- ✅ Shared knowledge across all agents
- ✅ Automatic versioning (no data loss)
- ✅ Temporal queries (what was true when)
- ✅ ACID guarantees
- ✅ Configurable retention
- ✅ Full audit trail

**Use for:**

- Knowledge base articles
- Policies and rules
- Audit logs
- Agent reasoning traces
- Static reference data
- Anything that should be append-only with versions

**Don't use for:**

- Private conversations (use `cortex.conversations.*`)
- Live/frequently changing data (use `cortex.mutable.*`)
- Searchable memories (use `cortex.vector.*` referencing immutable)

---

## Next Steps

- **[Mutable Store API](./11-mutable-store-api.md)** - Live shared data
- **[Governance Policies API](./12-governance-policies-api.md)** - Multi-layer retention rules
- **[Memory Operations API](./02-memory-operations.md)** - Vector layer operations

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
