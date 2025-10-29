# Context Chains: Hierarchical Graph Traversal

> **Last Updated**: 2025-10-28

Hierarchical context sharing for multi-agent coordination via graph-like parent-child relationships.

## Overview

Context chains are Cortex's **hierarchical graph structure** for multi-agent workflows. Think of them as a tree graph where each node is a workflow task and edges represent parent-child delegation.

When a supervisor agent delegates to specialized agents, everyone can access the complete graph chain (ancestors, siblings, descendants) without repeatedly passing information back and forth.

**How Context Chains Fit in Cortex's Architecture:**

Cortex has four entity types accessed via four namespaces:

1. **ACID Conversations** - `cortex.conversations.*` - Immutable message history (user ↔ agent chats)
2. **Vector Memories** - `cortex.vector.*` - Searchable knowledge index (references conversations)
3. **Memory API** - `cortex.memory.*` - Convenience layer (ACID + Vector)
4. **User Profiles** - `cortex.users.*` - Shared user attributes (cross-agent state)
5. **Context Chains** - `cortex.contexts.*` - Workflow coordination (task hierarchies)

**Context Chains are separate from conversations** - they track multi-agent workflows and task delegation, not chat history.

## The Problem Context Chains Solve

### Traditional Approach (Fragile)

```
User: "Create a marketing campaign for Q4"
  └─> CEO Agent: "Let me delegate..."
      ├─> Marketing Agent (gets: "Create campaign")
      │   └─> Misses: Q4 timeframe, budget, target audience
      └─> Finance Agent (gets: "Review budget")
          └─> Misses: What the campaign is for
```

Information gets lost at each level.

### Context Chains Approach (Robust)

```
User: "Create a marketing campaign for Q4"
  └─> CEO Agent creates context: CTX-001
      ├─> Marketing Agent accesses CTX-001
      │   └─> Sees: Complete original request, budget, timeline
      └─> Finance Agent accesses CTX-001
          └─> Sees: Same complete context, can coordinate
```

Everyone has the full picture.

## Graph Structure

Context chains form a **directed acyclic graph (DAG)** where:

**Nodes:** Context entities (workflow tasks)  
**Edges:** Parent-child relationships (via `parentId` and `childIds`)  
**Traversal:** Walking the graph to access ancestors, descendants, siblings

```
Root Context (Node: ctx-001, depth=0)
  │
  ├──[PARENT_OF]──> Child Context (Node: ctx-002, depth=1)
  │                      │
  │                      └──[HANDLED_BY]──> Agent: finance-agent
  │
  ├──[PARENT_OF]──> Child Context (Node: ctx-003, depth=1)
  │                      │
  │                      └──[HANDLED_BY]──> Agent: customer-agent
  │
  └──[PARENT_OF]──> Child Context (Node: ctx-004, depth=1)
                         │
                         └──[HANDLED_BY]──> Agent: crm-agent
```

**Graph Operations:**

- `includeChain: true` - Traverse entire graph from any node
- `getChildren()` - Follow edges downward (1-hop or recursive)
- `getRoot()` - Walk edges upward to root (N-hops)

**Performance:** Context hierarchies typically 1-5 levels deep, queries complete in 50-200ms using Cortex's Graph-Lite capabilities.

**When to add graph DB:** If context hierarchies exceed 10 levels or need complex pattern matching, consider [Graph Database Integration](../07-advanced-topics/02-graph-database-integration.md).

## Core Concepts

### Context Structure

```typescript
interface Context {
  // Identity
  id: string; // Unique context ID
  parentId?: string; // Parent context (if child)
  rootId: string; // Root of the chain

  // Purpose
  purpose: string; // What this context is for
  description?: string; // Detailed description

  // Ownership
  memorySpaceId: string; // Which memory space // Agent that created this
  userId?: string; // User this relates to

  // Hierarchy
  depth: number; // How deep in the chain (0 = root)
  childIds: string[]; // Direct children
  participants: string[]; // All agents involved in this context

  // Optional: Link to originating conversation
  conversationRef?: {
    conversationId: string; // If context came from a user conversation
    messageIds: string[]; // Which message(s) triggered this context
  };

  // Data
  data: {
    importance?: number; // 0-100 (context priority)
    tags?: string[]; // Context categorization
    [key: string]: any; // Context-specific data
  };

  // Status
  status: "active" | "completed" | "cancelled" | "blocked";

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Version History (AUTOMATIC)
  version: number; // Current version
  previousVersions?: ContextVersion[]; // Status/data changes
}

interface ContextVersion {
  version: number;
  status: string;
  data: any;
  timestamp: Date;
  updatedBy: string; // Which agent made the change
}
```

> **Automatic Versioning**: Context updates (status changes, data modifications) are automatically versioned. Track the complete evolution of a workflow.
>
> **Optional conversationRef**: If a context originated from a user conversation, it can link back to the ACID conversation source for full audit trail.

## Basic Operations

### Creating a Root Context

```typescript
// Supervisor agent creates root context (optionally linked to conversation)
const context = await cortex.contexts.create({
  purpose: "Process customer refund request",
  memorySpaceId: "supervisor-agent-space",
  userId: "user-123",

  // Optional: Link to the conversation that triggered this workflow
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-089"], // User's refund request message
  },

  data: {
    importance: 85, // High priority
    tags: ["refund", "customer-service", "ticket-456"],
    ticketId: "TICKET-456",
    amount: 500,
    reason: "defective product",
    priority: "high",
    customerTier: "vip",
  },
});

console.log(context.id); // "ctx_abc123"
console.log(context.depth); // 0 (root level)
console.log(context.data.importance); // 85

// Can trace back to original user conversation
if (context.conversationRef) {
  const conversation = await cortex.conversations.get(
    context.conversationRef.conversationId,
  );
  const triggerMessage = conversation.messages.find((m) =>
    context.conversationRef.messageIds.includes(m.id),
  );
  console.log("Original request:", triggerMessage.text);
}
```

### Creating Child Contexts

```typescript
// Delegate to finance agent
const financeContext = await cortex.contexts.create({
  purpose: "Approve and process $500 refund",
  memorySpaceId: "finance-agent-space",
  userId: "user-123", // Same user as parent
  parentId: context.id, // Link to parent

  // Child inherits conversationRef from parent (optional)
  conversationRef: context.conversationRef,

  data: {
    importance: 85, // Inherits from parent
    tags: ["refund", "finance", "approval"],
    amount: 500,
    account: "refunds",
    approvalRequired: true,
  },
});

// Delegate to customer relations agent
const customerContext = await cortex.contexts.create({
  purpose: "Send apology email and offer discount",
  memorySpaceId: "customer-relations-agent-space",
  userId: "user-123",
  parentId: context.id,
  conversationRef: context.conversationRef, // Same source conversation
  data: {
    importance: 75, // Slightly lower than refund processing
    tags: ["communication", "customer-relations"],
    discountCode: "SORRY20",
    emailTemplate: "apology-refund",
  },
});

// All contexts in the chain reference the same originating conversation
```

### Accessing Full Context Chain

Any agent can access the complete chain:

```typescript
// Finance agent looks up full context
const fullContext = await cortex.contexts.get(financeContext.id, {
  includeChain: true,
});

console.log(fullContext);
// {
//   current: { purpose: 'Approve and process $500 refund', ... },
//   parent: { purpose: 'Process customer refund request', ... },
//   root: { purpose: 'Process customer refund request', ... },
//   siblings: [{ purpose: 'Send apology email...', ... }],
//   children: [],
//   depth: 1
// }
```

### Updating Context

Updates automatically create versions:

```typescript
// Update status (creates version 2)
await cortex.contexts.update(financeContext.id, {
  status: "completed",
  data: {
    approved: true,
    approvedBy: "finance-agent",
    approvedAt: new Date(),
    confirmationNumber: "REF-789",
  },
});

// View version history
const ctx = await cortex.contexts.get(financeContext.id);
console.log(`Current status: ${ctx.status} (v${ctx.version})`);
console.log(`Previous status: ${ctx.previousVersions[0].status} (v1)`);

// Parent can check children status
const chain = await cortex.contexts.get(context.id, { includeChain: true });
const allComplete = chain.children.every((c) => c.status === "completed");

if (allComplete) {
  await cortex.contexts.update(context.id, {
    status: "completed",
    completedAt: new Date(),
  });
}
```

### Querying Contexts

Use universal filters to find contexts:

```typescript
// Find active contexts for an agent
const activeContexts = await cortex.contexts.search({
  memorySpaceId: "finance-agent-space",
  status: "active",
});

// Find contexts for a user
const userContexts = await cortex.contexts.search({
  userId: "user-123",
  sortBy: "createdAt",
  sortOrder: "desc",
});

// Find high-priority contexts
const urgent = await cortex.contexts.search({
  data: { importance: { $gte: 80 } },
  status: "active",
});

// Count contexts by status
const activeCount = await cortex.contexts.count({
  status: "active",
});

// List all root contexts (depth 0)
const roots = await cortex.contexts.list({
  depth: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
  limit: 50,
});
```

## Visualization

### Context Chain Tree

```
Root Context (ctx_001)
Purpose: "Process customer refund request"
Agent: supervisor-agent
Status: active
    │
    ├─> Child Context (ctx_002)
    │   Purpose: "Approve $500 refund"
    │   Agent: finance-agent
    │   Status: completed ✓
    │
    ├─> Child Context (ctx_003)
    │   Purpose: "Send apology email"
    │   Agent: customer-relations-agent
    │   Status: completed ✓
    │
    └─> Child Context (ctx_004)
        Purpose: "Update CRM with resolution"
        Agent: crm-agent
        Status: active ⚡
```

## Relationship to Other Data Layers

### Context Chains vs Memories vs Conversations

```typescript
// ACID Conversation (Layer 1: Immutable source)
const msg = await cortex.conversations.addMessage("conv-456", {
  role: "user",
  text: "I need to process a refund for $500",
  userId: "user-123",
});

// Context Chain (Layer 4: Workflow coordination)
const context = await cortex.contexts.create({
  purpose: "Process $500 refund",
  memorySpaceId: "supervisor-agent-space",
  userId: "user-123",
  conversationRef: {
    conversationId: "conv-456",
    messageIds: [msg.id], // Links to originating conversation
  },
});

// Vector Memory (Layer 2: Knowledge index) - explicit Layer 2
await cortex.vector.store("supervisor-agent", {
  content: "Created refund workflow for $500",
  contentType: "raw",
  userId: "user-123",
  source: { type: "system", timestamp: new Date() },
  conversationRef: {
    conversationId: "conv-456",
    messageIds: [msg.id], // Same source
  },
  metadata: {
    importance: 85,
    tags: ["workflow", "refund", "supervisor"],
    contextId: context.id, // Link to workflow context!
  },
});

// User Profile (Layer 3: User state)
const user = await cortex.users.get("user-123");
// No conversationRef - profiles aren't conversation-sourced
```

**The Relationships:**

- Conversations ← Memories reference via `conversationRef`
- Conversations ← Contexts optionally reference via `conversationRef`
- Contexts ← Memories can reference via `metadata.contextId`
- Users ← Everything references via `userId`

## Real-World Use Cases

### Use Case 1: Task Decomposition

Break complex tasks into subtasks:

```typescript
// User request from conversation
const userMsg = await cortex.conversations.addMessage("conv-789", {
  role: "user",
  text: "I need the Q4 financial report by Friday",
  userId: "user-cfo",
});

// Create root context linked to conversation
const rootContext = await cortex.contexts.create({
  purpose: "Build quarterly financial report",
  memorySpaceId: "ceo-agent-space",
  userId: "user-cfo",
  conversationRef: {
    conversationId: "conv-789",
    messageIds: [userMsg.id], // Links to originating message
  },
  data: {
    quarter: "Q4",
    year: 2025,
    importance: 90,
    tags: ["financial", "report", "q4"],
  },
});

// Break into pieces
const contexts = await Promise.all([
  cortex.contexts.create({
    purpose: "Gather revenue data",
    memorySpaceId: "finance-agent-space",
    parentId: rootContext.id,
  }),
  cortex.contexts.create({
    purpose: "Compile expense reports",
    memorySpaceId: "accounting-agent-space",
    parentId: rootContext.id,
  }),
  cortex.contexts.create({
    purpose: "Create visualizations",
    memorySpaceId: "analytics-agent-space",
    parentId: rootContext.id,
  }),
]);

// All agents see the full context
for (const ctx of contexts) {
  const chain = await cortex.contexts.get(ctx.id, { includeChain: true });
  console.log("Full context:", chain.root.purpose);
}
```

### Use Case 2: Approval Workflows

Multi-step approvals with context:

```typescript
// Request created
const request = await cortex.contexts.create({
  purpose: "Approve $10K budget increase",
  memorySpaceId: "requestor-agent-space",
  data: { amount: 10000, department: "engineering" },
});

// Manager reviews (with full context)
const managerReview = await cortex.contexts.create({
  purpose: "Manager review of budget request",
  memorySpaceId: "manager-agent-space",
  parentId: request.id,
  data: { approved: true, notes: "Looks reasonable" },
});

// Finance approves (sees full chain)
const financeApproval = await cortex.contexts.create({
  purpose: "Finance approval",
  memorySpaceId: "finance-agent-space",
  parentId: managerReview.id,
  data: { approved: true, allocated: true },
});

// Can trace full approval chain
const chain = await cortex.contexts.get(financeApproval.id, {
  includeChain: true,
});
console.log(
  "Approval chain:",
  chain.ancestors.map((c) => c.purpose),
);
```

### Use Case 3: Knowledge Sharing

Share knowledge within a context:

```typescript
// Create shared context
const projectContext = await cortex.contexts.create({
  purpose: 'Build new feature X',
  memorySpaceId: 'pm-agent-space',
  userId: 'pm-user-id',
  data: {
    importance: 85,  // High priority project
    tags: ['development', 'feature-x', 'q4-2025'],
    requirements: [...],
    deadline: '2025-12-31',
    team: ['dev-agent-1', 'dev-agent-2', 'qa-agent']
  }
});

// Any team member can add knowledge
await cortex.contexts.addKnowledge(projectContext.id, {
  type: 'decision',
  content: 'Using React for frontend',
  addedBy: 'dev-agent-1'
});

await cortex.contexts.addKnowledge(projectContext.id, {
  type: 'blocker',
  content: 'Waiting for API key from vendor',
  addedBy: 'dev-agent-2'
});

// Everyone sees all knowledge
const knowledge = await cortex.contexts.getKnowledge(projectContext.id);
```

## Universal Filters for Contexts

> **Core Principle**: Context operations support the same filter patterns as memory and user operations

```typescript
// The same filters work for:
const filters = {
  memorySpaceId: "finance-agent-space",
  status: "active",
  userId: "user-123",
  data: { importance: { $gte: 80 } },
  createdAfter: new Date("2025-10-01"),
};

// Search
await cortex.contexts.search(filters);

// Count
await cortex.contexts.count(filters);

// List
await cortex.contexts.list(filters);

// Update many
await cortex.contexts.updateMany(filters, {
  data: { reviewed: true },
});

// Delete many (with caution!)
await cortex.contexts.deleteMany(filters);

// Export
await cortex.contexts.export(filters);
```

**Supported Filters:**

- `agentId` - Agent that created the context
- `userId` - User the context relates to
- `parentId` - Parent context ID
- `rootId` - Root context ID
- `status` - Context status
- `depth` - Hierarchy depth
- `data.*` - Any data field with operators
- `createdBefore/After` - Date range
- `updatedBefore/After` - Update date range
- `completedBefore/After` - Completion date range

## Advanced Patterns

### Pattern: Multi-Criteria Context Search

Find contexts by purpose, data, and status:

```typescript
// Find all active refund contexts for a user
const refundContexts = await cortex.contexts.search({
  purposeContains: "refund",
  status: "active",
  userId: "user-123",
});

// Find contexts by agent and importance
const agentContexts = await cortex.contexts.search({
  memorySpaceId: "finance-agent-space",
  status: "active",
  data: { importance: { $gte: 70 } },
});

// Find urgent unresolved contexts
const urgentContexts = await cortex.contexts.search({
  data: {
    importance: { $gte: 90 },
    priority: "urgent",
  },
  status: { $in: ["active", "blocked"] },
});

// Find old stale contexts
const stale = await cortex.contexts.search({
  status: "active",
  updatedBefore: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // No update in 7 days
  sortBy: "updatedAt",
  sortOrder: "asc", // Oldest first
});
```

### Pattern: Context Templates

Reusable context patterns:

```typescript
// Define template
const REFUND_CONTEXT_TEMPLATE = {
  purpose: "Process customer refund",
  requiredData: ["amount", "reason", "customerId"],
  childrenTemplates: [
    { purpose: "Approve refund", memorySpaceId: "finance-agent-space" },
    { purpose: "Issue refund", memorySpaceId: "billing-agent-space" },
    { purpose: "Notify customer", memorySpaceId: "customer-agent-space" },
  ],
};

// Use template
async function createRefundWorkflow(data: any) {
  const root = await cortex.contexts.create({
    purpose: REFUND_CONTEXT_TEMPLATE.purpose,
    memorySpaceId: "supervisor-agent-space",
    data,
  });

  // Create child contexts from template
  for (const child of REFUND_CONTEXT_TEMPLATE.childrenTemplates) {
    await cortex.contexts.create({
      ...child,
      parentId: root.id,
    });
  }

  return root;
}
```

## Bulk Context Operations

### Update Many Contexts

```typescript
// Mark all completed contexts as archived
await cortex.contexts.updateMany(
  {
    status: "completed",
    completedBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    data: { archived: true },
  },
);

// Increase priority for blocked contexts
await cortex.contexts.updateMany(
  {
    status: "blocked",
  },
  {
    data: { importance: 95 }, // Bump to critical
  },
);

// Add review flag to old active contexts
await cortex.contexts.updateMany(
  {
    status: "active",
    updatedBefore: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    data: { needsReview: true },
  },
);
```

### Delete Many Contexts

```typescript
// Clean up cancelled contexts
const result = await cortex.contexts.deleteMany({
  status: "cancelled",
  completedBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
});

console.log(`Deleted ${result.deleted} old cancelled contexts`);

// Preview before deleting
const preview = await cortex.contexts.deleteMany(
  {
    status: "completed",
    completedBefore: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
  },
  { dryRun: true },
);

console.log(`Would delete ${preview.wouldDelete} contexts`);
```

### Context Analytics

```typescript
// Count contexts by status
const stats = {
  active: await cortex.contexts.count({ status: "active" }),
  completed: await cortex.contexts.count({ status: "completed" }),
  cancelled: await cortex.contexts.count({ status: "cancelled" }),
  blocked: await cortex.contexts.count({ status: "blocked" }),
};

// Count contexts per agent
const agentContextCount = await cortex.contexts.count({
  memorySpaceId: "finance-agent-space",
});

// Find bottlenecks (blocked contexts)
const blocked = await cortex.contexts.list({
  status: "blocked",
  sortBy: "createdAt",
  sortOrder: "asc", // Oldest blocked first
});
```

## Best Practices

### 1. Descriptive Purposes and Conversation Links

```typescript
// ❌ Vague, no source tracking
await cortex.contexts.create({
  purpose: "Process request",
});

// ✅ Clear, specific, and linked to source
await cortex.contexts.create({
  purpose: "Process $500 refund for defective product (ticket #456)",
  userId: "user-123",
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-089"], // User's original request
  },
  data: {
    importance: 85,
    tags: ["refund", "defective-product"],
  },
});

// Benefits of conversationRef:
// - Trace workflow back to original user request
// - Audit trail for compliance
// - Understand context evolution
// - Link memories to contexts to conversations
```

### 2. Store Relevant Data and Link to Memories

```typescript
// Include context-specific information
const context = await cortex.contexts.create({
  purpose: "Approve expense report",
  memorySpaceId: "manager-agent-space",
  userId: "emp-123", // Employee who submitted
  conversationRef: {
    conversationId: "conv-expense-123",
    messageIds: ["msg-submitted"], // Submission message
  },
  data: {
    importance: 70, // 0-100 scale
    tags: ["expense", "travel", "pending-approval"],
    employeeId: "emp-123",
    totalAmount: 450.5,
    category: "travel",
    receiptCount: 5,
    submittedDate: new Date(),
  },
});

// Link agent memories to this context (Layer 2 - system memory)
await cortex.vector.store("manager-agent", {
  content: "Created approval workflow for $450.50 travel expense",
  contentType: "raw",
  userId: "emp-123",
  source: { type: "system", timestamp: new Date() },
  conversationRef: {
    conversationId: "conv-expense-123",
    messageIds: ["msg-submitted"],
  },
  metadata: {
    importance: 70,
    tags: ["workflow", "expense", "approval"],
    contextId: context.id, // Link memory to context!
  },
});

// Now you have:
// - ACID conversation (original request)
// - Context chain (workflow structure)
// - Vector memory (searchable knowledge)
// All linked together!
```

### 3. Update Status and Track Changes

Keep status current (automatically versioned):

```typescript
// Start work (creates v2)
await cortex.contexts.update(contextId, {
  status: "active",
  data: {
    startedAt: new Date(),
    startedBy: "agent-1",
  },
});

// Finish work (creates v3)
await cortex.contexts.update(contextId, {
  status: "completed",
  completedAt: new Date(),
  data: {
    result: "success",
    completedBy: "agent-1",
  },
});

// View status history
const ctx = await cortex.contexts.get(contextId);
console.log(`Current: ${ctx.status} (v${ctx.version})`);
ctx.previousVersions.forEach((v) => {
  console.log(`v${v.version}: ${v.status} at ${v.timestamp}`);
});
```

### 4. Clean Up Old Contexts

Use bulk operations for efficient cleanup:

```typescript
// Archive completed contexts after 90 days (using universal filters)
const result = await cortex.contexts.archive({
  status: "completed",
  completedBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
});

console.log(`Archived ${result.archived} old contexts`);

// Delete cancelled contexts after 180 days
await cortex.contexts.deleteMany({
  status: "cancelled",
  updatedBefore: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
});

// Clean up orphaned contexts (parent no longer exists)
const orphaned = await cortex.contexts.findOrphaned();
await cortex.contexts.deleteMany({
  id: { $in: orphaned.map((c) => c.id) },
});
```

## Next Steps

- **[A2A Communication](./05-a2a-communication.md)** - Agent-to-agent messaging
- **[API Reference](../03-api-reference/05-context-operations.md)** - Context API docs
- **[Hierarchical Agents Recipe](../06-recipes/05-hierarchical-agents.md)** - Real implementation

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
