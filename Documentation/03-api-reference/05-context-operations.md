# Context Operations API

> **Last Updated**: 2025-10-24

Complete API reference for context chain management and multi-agent workflow coordination.

## Overview

The Context Operations API (`cortex.contexts.*`) provides methods for managing hierarchical workflows where agents collaborate on complex tasks. Context chains track task delegation, shared state, and workflow evolution across multiple agents.

**Key Characteristics:**

- ✅ **Hierarchical** - Parent-child relationships for task decomposition
- ✅ **Shared** - All agents in the workflow can access the chain
- ✅ **Versioned** - Automatic status/data change tracking
- ✅ **Conversation-linked** - Optional links to originating ACID conversations
- ✅ **GDPR-enabled** - Optional `userId` for cascade deletion

**Relationship to Layers:**

Context chains are a **separate coordination entity** that can reference all layers:

```
Layer 1: ACID Stores
├── conversations.* ← Contexts can reference via conversationRef
├── immutable.*
└── mutable.*

Layer 2: Vector Index
└── vector.* ← Memories can reference contexts via metadata.contextId

Coordination:
└── contexts.* ← Workflow/task hierarchy (links to conversations, used by memories)
```

**Use Cases:**

- Multi-agent task delegation
- Approval workflows
- Project/campaign coordination
- Hierarchical knowledge sharing
- Workflow state tracking
- Task decomposition

---

## Core Operations

### create()

Create a new context (root or child).

**Signature:**

```typescript
cortex.contexts.create(
  params: ContextInput
): Promise<Context>
```

**Parameters:**

```typescript
interface ContextInput {
  purpose: string; // What this context is for (REQUIRED)
  agentId: string; // Agent creating this context (REQUIRED)

  // Hierarchy
  parentId?: string; // Parent context (omit for root)

  // User association
  userId?: string; // User this relates to (GDPR-enabled)

  // Conversation link (optional)
  conversationRef?: {
    conversationId: string; // Originating conversation
    messageIds: string[]; // Triggering message(s)
  };

  // Data
  data?: {
    importance?: number; // 0-100
    tags?: string[];
    [key: string]: any; // Context-specific data
  };

  // Status
  status?: "active" | "completed" | "cancelled" | "blocked"; // Default: 'active'
  description?: string; // Detailed description
}
```

**Returns:**

```typescript
interface Context {
  // Identity
  id: string;
  parentId?: string;
  rootId: string; // Auto-computed (self if root)

  // Purpose
  purpose: string;
  description?: string;

  // Ownership
  agentId: string;
  userId?: string;

  // Hierarchy
  depth: number; // Auto-computed (0 = root)
  childIds: string[]; // Direct children
  participants: string[]; // All agents in this context

  // Conversation link
  conversationRef?: {
    conversationId: string;
    messageIds: string[];
  };

  // Data
  data: Record<string, any>;

  // Status
  status: "active" | "completed" | "cancelled" | "blocked";

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Versioning (automatic)
  version: number;
  previousVersions?: ContextVersion[];
}

interface ContextVersion {
  version: number;
  status: string;
  data: any;
  timestamp: Date;
  updatedBy: string; // Agent that made the change
}
```

**Side Effects:**

- If `parentId` provided: Updates parent's `childIds` array
- If `parentId` provided: Inherits `rootId` and increments `depth`
- Adds `agentId` to `participants` list

**Example 1: Create root context (linked to conversation)**

```typescript
// User makes request in conversation
const msg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  text: "I need a refund for $500",
  userId: "user-123",
});

// Create root context for the workflow
const root = await cortex.contexts.create({
  purpose: "Process customer refund request",
  agentId: "supervisor-agent",
  userId: "user-123", // GDPR-enabled
  conversationRef: {
    conversationId: "conv-456",
    messageIds: [msg.id], // Links back to triggering message
  },
  data: {
    importance: 85,
    tags: ["refund", "customer-service", "ticket-456"],
    amount: 500,
    reason: "defective product",
    ticketId: "TICKET-456",
  },
});

console.log(root.id); // 'ctx_abc123'
console.log(root.depth); // 0 (root)
console.log(root.rootId); // 'ctx_abc123' (self)
```

**Example 2: Create child context (delegation)**

```typescript
// Delegate to finance agent
const child = await cortex.contexts.create({
  purpose: "Approve and process $500 refund",
  agentId: "finance-agent",
  parentId: root.id, // Links to parent
  userId: "user-123",
  conversationRef: root.conversationRef, // Inherit conversation link
  data: {
    importance: 85,
    tags: ["refund", "finance", "approval"],
    amount: 500,
    approvalRequired: true,
  },
});

console.log(child.depth); // 1 (child of root)
console.log(child.rootId); // 'ctx_abc123' (same as parent)
console.log(child.parentId); // root.id
```

**Errors:**

- `CortexError('INVALID_PURPOSE')` - Purpose is empty
- `CortexError('INVALID_AGENT_ID')` - Agent ID is invalid
- `CortexError('PARENT_NOT_FOUND')` - Parent context doesn't exist
- `CortexError('USER_NOT_FOUND')` - userId doesn't reference existing user
- `CortexError('CONVEX_ERROR')` - Database error

**See Also:**

- [Context Chains Guide](../02-core-features/04-context-chains.md#creating-a-root-context)

---

### get()

Retrieve a context by ID with optional chain traversal.

**Signature:**

```typescript
cortex.contexts.get(
  contextId: string,
  options?: GetOptions
): Promise<Context | ContextWithChain | null>
```

**Parameters:**

```typescript
interface GetOptions {
  includeChain?: boolean; // Include parent/children/siblings (default: false)
  includeConversation?: boolean; // Fetch ACID conversation (default: false)
}
```

**Returns:**

```typescript
// Default (includeChain: false)
Context | null;

// With includeChain: true
interface ContextWithChain {
  current: Context; // This context
  parent?: Context; // Parent context
  root: Context; // Root of the chain
  children: Context[]; // Direct children
  siblings: Context[]; // Other children of same parent
  ancestors: Context[]; // All ancestors up to root
  depth: number; // Current depth

  // If includeConversation: true
  conversation?: Conversation; // ACID conversation
  triggerMessages?: Message[]; // Messages that started this context
}
```

**Example 1: Get context only**

```typescript
const ctx = await cortex.contexts.get("ctx_abc123");

console.log(ctx.purpose);
console.log(ctx.status);
console.log(ctx.data);
```

**Example 2: Get with full chain**

```typescript
const chain = await cortex.contexts.get("ctx_child", {
  includeChain: true,
});

console.log("Current:", chain.current.purpose);
console.log("Parent:", chain.parent.purpose);
console.log("Root:", chain.root.purpose);
console.log(
  "Siblings:",
  chain.siblings.map((s) => s.purpose),
);
console.log("Depth:", chain.depth);
```

**Example 3: Get with conversation context**

```typescript
const enriched = await cortex.contexts.get("ctx_abc123", {
  includeChain: true,
  includeConversation: true,
});

// Context data
console.log("Workflow:", enriched.current.purpose);

// Original conversation that triggered this workflow
if (enriched.conversation) {
  console.log("Original request:", enriched.triggerMessages[0].text);
  console.log(
    "Full conversation:",
    enriched.conversation.messages.length,
    "messages",
  );
}
```

**Errors:**

- `CortexError('CONTEXT_NOT_FOUND')` - Context doesn't exist

---

### update()

Update a context (status, data, etc.). Creates new version automatically.

**Signature:**

```typescript
cortex.contexts.update(
  contextId: string,
  updates: ContextUpdate
): Promise<Context>
```

**Parameters:**

```typescript
interface ContextUpdate {
  status?: "active" | "completed" | "cancelled" | "blocked";
  data?: Partial<Record<string, any>>; // Merges with existing
  description?: string;
  completedAt?: Date; // Set when status='completed'
}
```

**Returns:**

- `Context` - Updated context with incremented version

**Side Effects:**

- Creates new version
- Updates `updatedAt` timestamp
- If status changes to 'completed', sets `completedAt` if not provided

**Example:**

```typescript
// Update status (creates v2)
await cortex.contexts.update("ctx_abc123", {
  status: "completed",
  data: {
    result: "success",
    completedBy: "finance-agent",
    confirmationNumber: "REF-789",
  },
});

// Update data only (creates v3)
await cortex.contexts.update("ctx_abc123", {
  data: {
    notes: "Customer satisfied with resolution",
  },
});

// View version history
const ctx = await cortex.contexts.get("ctx_abc123");
console.log(`Current status: ${ctx.status} (v${ctx.version})`);
ctx.previousVersions.forEach((v) => {
  console.log(`v${v.version}: status=${v.status}, timestamp=${v.timestamp}`);
});
```

**Errors:**

- `CortexError('CONTEXT_NOT_FOUND')` - Context doesn't exist
- `CortexError('INVALID_STATUS')` - Status is invalid
- `CortexError('INVALID_UPDATE')` - Update data is malformed

**See Also:**

- [Updating Context](../02-core-features/04-context-chains.md#updating-context)

---

### delete()

Delete a context and optionally its descendants.

**Signature:**

```typescript
cortex.contexts.delete(
  contextId: string,
  options?: DeleteOptions
): Promise<DeleteResult>
```

**Parameters:**

```typescript
interface DeleteOptions {
  cascadeChildren?: boolean; // Delete all descendants (default: false)
  orphanChildren?: boolean; // If false and has children, error (default: false)
}
```

**Returns:**

```typescript
interface DeleteResult {
  deleted: number; // 1 + descendants if cascade
  contextId: string;
  descendantsDeleted?: number;
  affectedAgents?: string[];
}
```

**Example:**

```typescript
// Delete single context (must have no children)
await cortex.contexts.delete("ctx_abc123");

// Delete context and all descendants
const result = await cortex.contexts.delete("ctx_root", {
  cascadeChildren: true,
});

console.log(`Deleted ${result.deleted} contexts`);
console.log(`Descendants: ${result.descendantsDeleted}`);

// Allow orphaning (remove parent, keep children)
await cortex.contexts.delete("ctx_parent", {
  orphanChildren: true,
});
```

**Errors:**

- `CortexError('CONTEXT_NOT_FOUND')` - Context doesn't exist
- `CortexError('HAS_CHILDREN')` - Context has children and cascadeChildren=false
- `CortexError('DELETION_FAILED')` - Delete operation failed

---

### search()

Search contexts with filters.

**Signature:**

```typescript
cortex.contexts.search(
  filters?: ContextFilters,
  options?: SearchOptions
): Promise<Context[]>
```

**Parameters:**

```typescript
interface ContextFilters {
  // Identity
  agentId?: string;
  userId?: string;

  // Hierarchy
  parentId?: string;
  rootId?: string;
  depth?: number | RangeQuery;

  // Status
  status?: "active" | "completed" | "cancelled" | "blocked";

  // Purpose (text search)
  purposeContains?: string;

  // Data
  data?: Record<string, any>;

  // Conversation link
  "conversationRef.conversationId"?: string;

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  completedBefore?: Date;
  completedAfter?: Date;

  // Version
  version?: number | RangeQuery;
}

interface SearchOptions {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  sortBy?: "createdAt" | "updatedAt" | "completedAt" | "importance" | "depth";
  sortOrder?: "asc" | "desc";
  includeChain?: boolean; // Return ContextWithChain instead of Context
}
```

**Returns:**

- `Context[]` - Array of matching contexts
- `ContextWithChain[]` - If `includeChain: true`

**Example:**

```typescript
// Find active contexts for an agent
const active = await cortex.contexts.search({
  agentId: "finance-agent",
  status: "active",
});

// Find contexts for a user
const userContexts = await cortex.contexts.search({
  userId: "user-123",
  sortBy: "createdAt",
  sortOrder: "desc",
});

// Find urgent contexts
const urgent = await cortex.contexts.search({
  data: { importance: { $gte: 90 } },
  status: { $in: ["active", "blocked"] },
});

// Find all root contexts
const roots = await cortex.contexts.search({
  depth: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
});

// Find contexts from a specific conversation
const convContexts = await cortex.contexts.search({
  "conversationRef.conversationId": "conv-456",
});
```

**Errors:**

- `CortexError('INVALID_FILTERS')` - Filters are malformed

**See Also:**

- [Querying Contexts](../02-core-features/04-context-chains.md#querying-contexts)

---

### list()

List contexts with pagination.

**Signature:**

```typescript
cortex.contexts.list(
  options?: ListOptions
): Promise<ListResult>
```

**Parameters:**

```typescript
interface ListOptions extends ContextFilters {
  limit?: number; // Default: 50
  offset?: number; // Default: 0
  sortBy?: "createdAt" | "updatedAt" | "completedAt" | "depth";
  sortOrder?: "asc" | "desc";
}

interface ListResult {
  contexts: Context[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

**Example:**

```typescript
// List all contexts (paginated)
const page1 = await cortex.contexts.list({
  limit: 50,
  offset: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
});

// List active workflows
const active = await cortex.contexts.list({
  status: "active",
  depth: 0, // Root contexts only
});
```

**Errors:**

- `CortexError('INVALID_PAGINATION')` - Invalid limit/offset

---

### count()

Count contexts matching filters.

**Signature:**

```typescript
cortex.contexts.count(
  filters?: ContextFilters
): Promise<number>
```

**Example:**

```typescript
// Total contexts
const total = await cortex.contexts.count();

// Count by status
const active = await cortex.contexts.count({ status: "active" });
const completed = await cortex.contexts.count({ status: "completed" });

// Count for agent
const agentContexts = await cortex.contexts.count({
  agentId: "finance-agent",
});

// Count urgent contexts
const urgent = await cortex.contexts.count({
  data: { importance: { $gte: 90 } },
  status: "active",
});
```

---

### updateMany()

Bulk update contexts matching filters.

**Signature:**

```typescript
cortex.contexts.updateMany(
  filters: ContextFilters,
  updates: ContextUpdate,
  options?: UpdateManyOptions
): Promise<UpdateManyResult>
```

**Parameters:**

```typescript
interface UpdateManyOptions {
  dryRun?: boolean;
}

interface UpdateManyResult {
  updated: number;
  contextIds: string[];
  wouldUpdate?: number; // For dryRun
}
```

**Example:**

```typescript
// Mark old completed contexts as archived
await cortex.contexts.updateMany(
  {
    status: "completed",
    completedBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    data: { archived: true },
  },
);

// Boost priority for blocked contexts
await cortex.contexts.updateMany(
  {
    status: "blocked",
  },
  {
    data: { importance: 95 },
  },
);
```

---

### deleteMany()

Bulk delete contexts matching filters.

**Signature:**

```typescript
cortex.contexts.deleteMany(
  filters: ContextFilters,
  options?: DeleteManyOptions
): Promise<DeleteManyResult>
```

**Parameters:**

```typescript
interface DeleteManyOptions {
  cascadeChildren?: boolean; // Delete descendants
  dryRun?: boolean;
  requireConfirmation?: boolean;
  confirmationThreshold?: number; // Default: 10
}

interface DeleteManyResult {
  deleted: number;
  contextIds: string[];
  descendantsDeleted?: number;
  wouldDelete?: number;
}
```

**Example:**

```typescript
// Delete old cancelled contexts
const result = await cortex.contexts.deleteMany({
  status: "cancelled",
  completedBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
});

console.log(`Deleted ${result.deleted} old contexts`);
```

---

### export()

Export contexts to JSON or CSV.

**Signature:**

```typescript
cortex.contexts.export(
  filters?: ContextFilters,
  options?: ExportOptions
): Promise<string | ExportData>
```

**Parameters:**

```typescript
interface ExportOptions {
  format: "json" | "csv";
  outputPath?: string;
  includeChain?: boolean; // Include full hierarchy
  includeConversations?: boolean; // Include ACID conversations
  includeVersionHistory?: boolean; // Include version history
}
```

**Example:**

```typescript
// Export user's workflows (GDPR)
await cortex.contexts.export(
  {
    userId: "user-123",
  },
  {
    format: "json",
    includeChain: true,
    includeConversations: true,
    outputPath: "exports/user-123-contexts.json",
  },
);
```

---

## Hierarchy Operations

### getChain()

Get the complete context chain from a context ID.

**Signature:**

```typescript
cortex.contexts.getChain(
  contextId: string
): Promise<ContextChain>
```

**Returns:**

```typescript
interface ContextChain {
  root: Context;
  current: Context;
  parent?: Context;
  ancestors: Context[]; // From root to parent
  children: Context[];
  siblings: Context[];
  descendants: Context[]; // All recursive children
  depth: number;
  totalNodes: number;
}
```

**Example:**

```typescript
const chain = await cortex.contexts.getChain("ctx_child");

console.log("Root:", chain.root.purpose);
console.log("Current:", chain.current.purpose);
console.log("Parent:", chain.parent.purpose);
console.log(
  "Siblings:",
  chain.siblings.map((s) => s.purpose),
);
console.log(
  "Children:",
  chain.children.map((c) => c.purpose),
);
console.log("Total workflow nodes:", chain.totalNodes);
```

---

### getRoot()

Get the root context of a chain.

**Signature:**

```typescript
cortex.contexts.getRoot(
  contextId: string
): Promise<Context>
```

**Example:**

```typescript
// From any context in the chain, get the root
const root = await cortex.contexts.getRoot("ctx_deeply_nested_child");

console.log("Original purpose:", root.purpose);
console.log("Started by:", root.agentId);
console.log("Conversation:", root.conversationRef?.conversationId);
```

---

### getChildren()

Get all direct children of a context.

**Signature:**

```typescript
cortex.contexts.getChildren(
  contextId: string,
  options?: ChildrenOptions
): Promise<Context[]>
```

**Parameters:**

```typescript
interface ChildrenOptions {
  status?: "active" | "completed" | "cancelled" | "blocked";
  recursive?: boolean; // Get all descendants (default: false)
}
```

**Example:**

```typescript
// Get direct children
const children = await cortex.contexts.getChildren("ctx_root");

// Get only active children
const activeChildren = await cortex.contexts.getChildren("ctx_root", {
  status: "active",
});

// Get all descendants recursively
const allDescendants = await cortex.contexts.getChildren("ctx_root", {
  recursive: true,
});
```

---

### findOrphaned()

Find contexts whose parent no longer exists.

**Signature:**

```typescript
cortex.contexts.findOrphaned(): Promise<Context[]>
```

**Example:**

```typescript
// Find orphaned contexts
const orphaned = await cortex.contexts.findOrphaned();

console.log(`Found ${orphaned.length} orphaned contexts`);

// Clean them up
for (const ctx of orphaned) {
  await cortex.contexts.delete(ctx.id);
}
```

---

## Advanced Operations

### addParticipant()

Add an agent to a context's participant list.

**Signature:**

```typescript
cortex.contexts.addParticipant(
  contextId: string,
  agentId: string
): Promise<Context>
```

**Example:**

```typescript
// Add agent to existing workflow
await cortex.contexts.addParticipant("ctx_abc123", "legal-agent");

const ctx = await cortex.contexts.get("ctx_abc123");
console.log("Participants:", ctx.participants);
// ['supervisor-agent', 'finance-agent', 'legal-agent']
```

---

### removeParticipant()

Remove an agent from a context's participant list.

**Signature:**

```typescript
cortex.contexts.removeParticipant(
  contextId: string,
  agentId: string
): Promise<Context>
```

---

### getByConversation()

Get all contexts originating from a specific conversation.

**Signature:**

```typescript
cortex.contexts.getByConversation(
  conversationId: string
): Promise<Context[]>
```

**Example:**

```typescript
// Find all workflows triggered by this conversation
const contexts = await cortex.contexts.getByConversation("conv-456");

console.log(`Conversation spawned ${contexts.length} workflows`);
contexts.forEach((ctx) => {
  console.log(`- ${ctx.purpose} (${ctx.status})`);
});
```

---

## Version Operations

### getVersion()

Get a specific version of a context.

**Signature:**

```typescript
cortex.contexts.getVersion(
  contextId: string,
  version: number
): Promise<ContextVersion | null>
```

**Example:**

```typescript
// Get version 1 (original state)
const v1 = await cortex.contexts.getVersion("ctx_abc123", 1);

console.log(`v1 status: ${v1.status}`);
console.log(`v1 data:`, v1.data);
```

---

### getHistory()

Get all versions of a context.

**Signature:**

```typescript
cortex.contexts.getHistory(
  contextId: string
): Promise<ContextVersion[]>
```

**Example:**

```typescript
const history = await cortex.contexts.getHistory("ctx_abc123");

console.log(`Context has ${history.length} versions:`);
history.forEach((v) => {
  console.log(`v${v.version} (${v.timestamp}): status=${v.status}`);
  console.log(`  Updated by: ${v.updatedBy}`);
});
```

---

### getAtTimestamp()

Get context state at a specific point in time.

**Signature:**

```typescript
cortex.contexts.getAtTimestamp(
  contextId: string,
  timestamp: Date
): Promise<ContextVersion | null>
```

**Example:**

```typescript
// What was the status on October 20th?
const historical = await cortex.contexts.getAtTimestamp(
  "ctx_abc123",
  new Date("2025-10-20T10:00:00Z"),
);

console.log(`Status on Oct 20: ${historical.status}`);
```

---

## Universal Filters Reference

All filter options that work across context operations:

```typescript
interface ContextFilters {
  // Identity
  agentId?: string;
  userId?: string;

  // Hierarchy
  parentId?: string;
  rootId?: string;
  depth?: number | RangeQuery;

  // Status
  status?: "active" | "completed" | "cancelled" | "blocked";

  // Purpose
  purposeContains?: string;

  // Data (supports nested field queries)
  "data.importance"?: number | RangeQuery;
  "data.tags"?: string[];
  data?: Record<string, any>;

  // Conversation
  "conversationRef.conversationId"?: string;

  // Dates
  createdBefore?: Date;
  createdAfter?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  completedBefore?: Date;
  completedAfter?: Date;

  // Version
  version?: number | RangeQuery;
}
```

**Operations supporting universal filters:**

- `search()`
- `list()`
- `count()`
- `updateMany()`
- `deleteMany()`
- `export()`

---

## Real-World Patterns

### Pattern 1: Task Decomposition with Conversation Links

```typescript
// User request in conversation
const msg = await cortex.conversations.addMessage("conv-789", {
  role: "user",
  text: "I need the Q4 financial report by Friday",
  userId: "user-cfo",
});

// Create root context linked to conversation
const root = await cortex.contexts.create({
  purpose: "Build quarterly financial report",
  agentId: "ceo-agent",
  userId: "user-cfo",
  conversationRef: {
    conversationId: "conv-789",
    messageIds: [msg.id],
  },
  data: {
    quarter: "Q4",
    year: 2025,
    deadline: new Date("2025-10-30"),
    importance: 90,
    tags: ["financial", "report", "q4"],
  },
});

// Decompose into subtasks (all inherit conversation link)
await cortex.contexts.create({
  purpose: "Gather revenue data",
  agentId: "finance-agent",
  parentId: root.id,
  userId: "user-cfo",
  conversationRef: root.conversationRef, // Same source
});

await cortex.contexts.create({
  purpose: "Compile expense reports",
  agentId: "accounting-agent",
  parentId: root.id,
  userId: "user-cfo",
  conversationRef: root.conversationRef,
});

// All agents can trace back to original user request
const chain = await cortex.contexts.get("ctx_finance_child", {
  includeChain: true,
  includeConversation: true,
});

console.log("Original request:", chain.triggerMessages[0].text);
```

### Pattern 2: Workflow Status Tracking

```typescript
// Check workflow completion
async function checkWorkflowComplete(rootContextId: string) {
  const chain = await cortex.contexts.getChain(rootContextId);

  // Check if all children completed
  const allComplete = chain.children.every((c) => c.status === "completed");

  if (allComplete && chain.current.status !== "completed") {
    // Mark root as complete
    await cortex.contexts.update(rootContextId, {
      status: "completed",
      completedAt: new Date(),
    });

    return true;
  }

  return false;
}
```

### Pattern 3: Context-Based Memory Storage

Link memories to contexts for workflow knowledge:

```typescript
// Agent stores memory linked to context
await cortex.vector.store("finance-agent", {
  content: "Approved $500 refund for defective product",
  contentType: "raw",
  userId: "user-123",
  source: { type: "tool", timestamp: new Date() },
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-089"],
  },
  metadata: {
    importance: 85,
    tags: ["refund", "approval", "finance"],
    contextId: "ctx_refund_workflow", // Link to context!
  },
});

// Later: Find all memories for a context
const contextMemories = await cortex.memory.search("finance-agent", "*", {
  metadata: { contextId: "ctx_refund_workflow" },
});
```

### Pattern 4: Multi-Agent Coordination

```typescript
// Supervisor creates workflow
const workflow = await cortex.contexts.create({
  purpose: "Launch marketing campaign",
  agentId: "supervisor-agent",
  data: {
    campaignName: "Q4 Sale",
    importance: 80,
    tags: ["marketing", "campaign", "q4"],
  },
});

// Marketing agent checks in
await cortex.contexts.addParticipant(workflow.id, "marketing-agent");

// Finance agent checks in
await cortex.contexts.addParticipant(workflow.id, "finance-agent");

// All agents can see who's involved
const ctx = await cortex.contexts.get(workflow.id);
console.log("Team:", ctx.participants);
// ['supervisor-agent', 'marketing-agent', 'finance-agent']
```

---

## Best Practices

### 1. Descriptive Purposes

```typescript
// ❌ Vague
await cortex.contexts.create({
  purpose: "Process request",
});

// ✅ Specific
await cortex.contexts.create({
  purpose: "Process $500 refund for defective product (ticket #456)",
  data: {
    amount: 500,
    ticketId: "TICKET-456",
  },
});
```

### 2. Link to Originating Conversations

```typescript
// ✅ Always link when context comes from user conversation
await cortex.contexts.create({
  purpose: "Handle support ticket",
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-initial-request"],
  },
});

// Benefits:
// - Audit trail back to user request
// - Can retrieve full conversation context
// - Compliance and debugging
```

### 3. Use Importance for Prioritization

```typescript
// Set importance (0-100)
await cortex.contexts.create({
  purpose: "Critical security issue",
  data: { importance: 100 }, // Maximum priority
});

// Find urgent work
const urgent = await cortex.contexts.search({
  data: { importance: { $gte: 90 } },
  status: "active",
});
```

### 4. Update Status Promptly

```typescript
// When work starts
await cortex.contexts.update(contextId, {
  status: "active",
  data: { startedAt: new Date() },
});

// When blocked
await cortex.contexts.update(contextId, {
  status: "blocked",
  data: { blockedReason: "Waiting for API access" },
});

// When complete
await cortex.contexts.update(contextId, {
  status: "completed",
  completedAt: new Date(),
});
```

### 5. Clean Up Old Contexts

```typescript
// Archive completed workflows after 90 days
await cortex.contexts.updateMany(
  {
    status: "completed",
    completedBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  },
  {
    data: { archived: true },
  },
);

// Delete cancelled after 180 days
await cortex.contexts.deleteMany({
  status: "cancelled",
  updatedBefore: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
});
```

---

## Error Reference

All context operation errors:

| Error Code           | Description                  | Cause                                          |
| -------------------- | ---------------------------- | ---------------------------------------------- |
| `INVALID_PURPOSE`    | Purpose is invalid           | Empty or malformed purpose                     |
| `INVALID_AGENT_ID`   | Agent ID is invalid          | Empty or malformed agentId                     |
| `CONTEXT_NOT_FOUND`  | Context doesn't exist        | Invalid contextId                              |
| `PARENT_NOT_FOUND`   | Parent context doesn't exist | Invalid parentId                               |
| `USER_NOT_FOUND`     | User doesn't exist           | userId doesn't reference existing user         |
| `HAS_CHILDREN`       | Context has children         | Can't delete parent without cascade            |
| `INVALID_STATUS`     | Status is invalid            | Not one of: active/completed/cancelled/blocked |
| `INVALID_FILTERS`    | Filters malformed            | Bad filter syntax                              |
| `INVALID_PAGINATION` | Pagination params bad        | Invalid limit/offset                           |
| `DELETION_FAILED`    | Delete failed                | Database error                                 |
| `CONVEX_ERROR`       | Database error               | Convex operation failed                        |

**See Also:**

- [Error Handling Guide](./09-error-handling.md)

---

## Next Steps

- **[A2A Communication API](./06-a2a-communication.md)** - Agent-to-agent messaging
- **[Conversation Operations API](./07-conversation-operations.md)** - ACID conversation management
- **[Types & Interfaces](./08-types-interfaces.md)** - Complete TypeScript definitions

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
