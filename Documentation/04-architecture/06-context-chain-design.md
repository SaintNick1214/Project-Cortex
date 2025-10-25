# Context Chain Design

> **Last Updated**: 2025-10-25

Architecture of hierarchical context chains for multi-agent workflow coordination.

## Overview

Context chains enable **hierarchical task delegation** where agents can share workflow state without repeatedly passing information. Each context in a chain has complete visibility into its parent, children, and root context.

```
Root Context (depth=0)
├── Purpose: "Process customer refund"
├── Data: { amount: 500, userId: "user-123" }
│
├─> Child 1 (depth=1)
│   ├── Purpose: "Approve refund"
│   ├── Can access: Root data ✅
│   └── Agent: finance-agent
│
├─> Child 2 (depth=1)
│   ├── Purpose: "Send apology email"
│   ├── Can access: Root data ✅
│   └── Agent: customer-relations-agent
│
└─> Child 3 (depth=1)
    ├── Purpose: "Update CRM"
    ├── Can access: Root data ✅
    └── Agent: crm-agent
```

**Key Insight:** Context chains are a **coordination layer** separate from conversations and memories - they track workflow structure, not message history.

---

## Data Structure

### Context Document

```typescript
{
  _id: "ctx_abc123",

  // Identity & hierarchy
  parentId: "ctx_parent",      // Null if root
  rootId: "ctx_root",          // Self if root, computed from parent chain
  depth: 2,                    // 0=root, auto-computed from parent

  // Purpose
  purpose: "Approve $500 refund",
  description: "Review and approve customer refund request",

  // Ownership
  agentId: "finance-agent",    // Agent working on this
  userId: "user-123",          // User this relates to (GDPR-enabled)

  // Children tracking
  childIds: ["ctx_child1", "ctx_child2"],
  participants: ["finance-agent", "legal-agent"],  // All agents in this context

  // Optional: Link to originating conversation
  conversationRef: {
    conversationId: "conv-456",
    messageIds: ["msg-089"],   // User's original request
  },

  // Workflow data (flexible)
  data: {
    importance: 85,
    tags: ["refund", "approval"],
    amount: 500,
    reason: "defective product",
    ticketId: "TICKET-456",
    approvalRequired: true,
    // Any custom fields...
  },

  // Status tracking
  status: "active",  // active | completed | cancelled | blocked

  // Timestamps
  createdAt: 1729900000000,
  updatedAt: 1729900500000,
  completedAt: null,

  // Versioning
  version: 2,
  previousVersions: [
    {
      version: 1,
      status: "active",
      data: { ... },
      timestamp: 1729900000000,
      updatedBy: "finance-agent",
    },
  ],
}
```

---

## Hierarchy Management

### Creating Root Context

```typescript
// Convex mutation
export const create = mutation({
  args: {
    purpose: v.string(),
    agentId: v.string(),
    userId: v.optional(v.string()),
    parentId: v.optional(v.id("contexts")),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    let rootId, depth;

    if (args.parentId) {
      // Child context - inherit from parent
      const parent = await ctx.db.get(args.parentId);

      if (!parent) {
        throw new Error("PARENT_NOT_FOUND");
      }

      rootId = parent.rootId;
      depth = parent.depth + 1;

      // Add to parent's childIds
      await ctx.db.patch(args.parentId, {
        childIds: [...parent.childIds /* will be set after insert */],
      });
    } else {
      // Root context
      rootId = null; // Will be set to self after insert
      depth = 0;
    }

    // Create context
    const contextId = await ctx.db.insert("contexts", {
      purpose: args.purpose,
      agentId: args.agentId,
      userId: args.userId,
      parentId: args.parentId,
      rootId: rootId || contextId, // Self if root
      depth,
      childIds: [],
      participants: [args.agentId],
      data: args.data || {},
      status: "active",
      version: 1,
      previousVersions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // If root, update rootId to self
    if (!args.parentId) {
      await ctx.db.patch(contextId, { rootId: contextId });
    }

    // Update parent's childIds
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      await ctx.db.patch(args.parentId, {
        childIds: [...parent.childIds, contextId],
      });
    }

    return await ctx.db.get(contextId);
  },
});
```

### Traversing the Chain

```typescript
// Get complete chain from any context
export const getChain = query({
  args: { contextId: v.id("contexts") },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.contextId);

    if (!current) {
      throw new Error("CONTEXT_NOT_FOUND");
    }

    // Get root
    const root = await ctx.db.get(current.rootId);

    // Get parent
    const parent = current.parentId ? await ctx.db.get(current.parentId) : null;

    // Get children
    const children = await Promise.all(
      current.childIds.map((id) => ctx.db.get(id)),
    );

    // Get siblings
    const siblings = parent
      ? await Promise.all(
          parent.childIds
            .filter((id) => id !== current._id)
            .map((id) => ctx.db.get(id)),
        )
      : [];

    // Get all ancestors (walk up)
    const ancestors = [];
    let node = parent;
    while (node) {
      ancestors.unshift(node);
      node = node.parentId ? await ctx.db.get(node.parentId) : null;
    }

    // Get all descendants (recursive)
    const descendants = await getAllDescendants(ctx, current._id);

    return {
      current,
      root,
      parent,
      children,
      siblings,
      ancestors,
      descendants,
      depth: current.depth,
      totalNodes: 1 + ancestors.length + descendants.length,
    };
  },
});

async function getAllDescendants(
  ctx: any,
  contextId: string,
): Promise<Context[]> {
  const context = await ctx.db.get(contextId);
  const children = await Promise.all(
    context.childIds.map((id) => ctx.db.get(id)),
  );

  // Recursive
  const grandchildren = await Promise.all(
    children.map((child) => getAllDescendants(ctx, child._id)),
  );

  return [...children, ...grandchildren.flat()];
}
```

---

## Status Management

### Status Transitions

```typescript
// Valid transitions
const STATUS_TRANSITIONS = {
  active: ["completed", "cancelled", "blocked"],
  blocked: ["active", "cancelled"],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
};

export const updateStatus = mutation({
  args: {
    contextId: v.id("contexts"),
    newStatus: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("blocked"),
    ),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db.get(args.contextId);

    // Validate transition
    const validTransitions = STATUS_TRANSITIONS[context.status];
    if (!validTransitions.includes(args.newStatus)) {
      throw new Error(
        `Invalid transition: ${context.status} -> ${args.newStatus}`,
      );
    }

    // Create version snapshot
    const snapshot = {
      version: context.version,
      status: context.status,
      data: context.data,
      timestamp: context.updatedAt,
      updatedBy: "system", // Or from auth context
    };

    // Update
    await ctx.db.patch(args.contextId, {
      status: args.newStatus,
      data: { ...context.data, ...args.data },
      version: context.version + 1,
      previousVersions: [...context.previousVersions, snapshot],
      updatedAt: Date.now(),
      completedAt: args.newStatus === "completed" ? Date.now() : undefined,
    });

    return await ctx.db.get(args.contextId);
  },
});
```

### Auto-Complete Parent

```typescript
// When all children complete, complete parent
export const checkAndCompleteParent = mutation({
  args: { contextId: v.id("contexts") },
  handler: async (ctx, args) => {
    const context = await ctx.db.get(args.contextId);

    if (!context.parentId) {
      return; // No parent
    }

    const parent = await ctx.db.get(context.parentId);

    // Check if all siblings are completed
    const siblings = await Promise.all(
      parent.childIds.map((id) => ctx.db.get(id)),
    );

    const allComplete = siblings.every((s) => s.status === "completed");

    if (allComplete && parent.status !== "completed") {
      // Complete parent
      await ctx.runMutation("contexts:updateStatus", {
        contextId: parent._id,
        newStatus: "completed",
      });

      // Recursively check grandparent
      await ctx.runMutation("contexts:checkAndCompleteParent", {
        contextId: parent._id,
      });
    }
  },
});
```

---

## Context Propagation

### Data Inheritance

```typescript
// Children can access parent data
export const getWithInheritedData = query({
  args: { contextId: v.id("contexts") },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.contextId);

    // Collect data from entire chain
    const inheritedData = {};

    // Walk up to root
    let node = current;
    const chain = [];

    while (node) {
      chain.unshift(node); // Add to front
      node = node.parentId ? await ctx.db.get(node.parentId) : null;
    }

    // Merge data (root -> parent -> current)
    for (const context of chain) {
      Object.assign(inheritedData, context.data);
    }

    return {
      context: current,
      inheritedData, // All data from root down
      chain,
    };
  },
});

// Usage
const { context, inheritedData } = await cortex.contexts.get(childContextId, {
  includeInheritedData: true,
});

console.log(inheritedData);
// {
//   amount: 500,           // From root
//   ticketId: "TICKET-456", // From root
//   approvedBy: "finance-agent",  // From parent
//   confirmationNumber: "REF-789",  // From current
// }
```

### Participant Propagation

```typescript
// Add participant to context and all ancestors
export const addParticipantToChain = mutation({
  args: {
    contextId: v.id("contexts"),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db.get(args.contextId);

    // Add to current
    if (!context.participants.includes(args.agentId)) {
      await ctx.db.patch(args.contextId, {
        participants: [...context.participants, args.agentId],
      });
    }

    // Propagate up to root
    let node = context;
    while (node.parentId) {
      const parent = await ctx.db.get(node.parentId);

      if (!parent.participants.includes(args.agentId)) {
        await ctx.db.patch(parent._id, {
          participants: [...parent.participants, args.agentId],
        });
      }

      node = parent;
    }
  },
});
```

---

## Conversation Linking

### Contexts Reference Conversations

```typescript
// Create context from user conversation
export const createFromConversation = mutation({
  args: {
    purpose: v.string(),
    agentId: v.string(),
    conversationId: v.id("conversations"),
    messageIds: v.array(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const contextId = await ctx.db.insert("contexts", {
      purpose: args.purpose,
      agentId: args.agentId,
      userId: args.userId,

      // Link to conversation
      conversationRef: {
        conversationId: args.conversationId,
        messageIds: args.messageIds,
      },

      rootId: null, // Will be set to self
      depth: 0,
      childIds: [],
      participants: [args.agentId],
      data: {},
      status: "active",
      version: 1,
      previousVersions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Set rootId to self
    await ctx.db.patch(contextId, { rootId: contextId });

    return await ctx.db.get(contextId);
  },
});
```

### Retrieve Original Conversation

```typescript
// Get context with conversation
export const getWithConversation = query({
  args: { contextId: v.id("contexts") },
  handler: async (ctx, args) => {
    const context = await ctx.db.get(args.contextId);

    if (!context.conversationRef) {
      return { context, conversation: null };
    }

    // Fetch conversation
    const conversation = await ctx.db.get(
      context.conversationRef.conversationId,
    );

    // Get specific trigger messages
    const triggerMessages = conversation.messages.filter((m) =>
      context.conversationRef.messageIds.includes(m.id),
    );

    return {
      context,
      conversation,
      triggerMessages,
    };
  },
});
```

---

## Memory Integration

### Linking Memories to Contexts

```typescript
// Store memory with context reference
export const storeWithContext = mutation({
  args: {
    agentId: v.string(),
    content: v.string(),
    contextId: v.id("contexts"),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db.get(args.contextId);

    // Store memory with contextId in metadata
    const memoryId = await ctx.db.insert("memories", {
      agentId: args.agentId,
      content: args.content,
      contentType: "raw",
      source: { type: "tool", timestamp: Date.now() },

      // Inherit conversationRef from context
      conversationRef: context.conversationRef,

      metadata: {
        ...args.metadata,
        contextId: context._id, // ← Link to context
        workflowPurpose: context.purpose,
      },

      version: 1,
      previousVersions: [],
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(memoryId);
  },
});
```

### Finding Memories by Context

```typescript
// Get all memories for a workflow
export const getMemoriesForWorkflow = query({
  args: { rootId: v.id("contexts") },
  handler: async (ctx, args) => {
    // Get all contexts in workflow
    const contexts = await ctx.db
      .query("contexts")
      .withIndex("by_rootId", (q) => q.eq("rootId", args.rootId))
      .collect();

    // Get all agents in workflow
    const allAgents = new Set(contexts.flatMap((c) => c.participants));

    // Get memories from all agents with this contextId
    const allMemories = [];

    for (const agentId of allAgents) {
      const memories = await ctx.db
        .query("memories")
        .withIndex("by_agent", (q) => q.eq("agentId", agentId))
        .filter((q) => q.eq(q.field("metadata.contextId"), args.rootId))
        .collect();

      allMemories.push(...memories);
    }

    return allMemories.sort((a, b) => a.createdAt - b.createdAt);
  },
});
```

---

## Workflow Patterns

### Sequential Workflow

```typescript
// Step 1 -> Step 2 -> Step 3
async function createSequentialWorkflow(purpose: string, steps: any[]) {
  // Create root
  const root = await ctx.db.insert("contexts", {
    purpose,
    rootId: null,
    depth: 0,
    childIds: [],
    status: "active",
    ...
  });

  await ctx.db.patch(root, { rootId: root });

  // Create steps as siblings (all same parent)
  const stepIds = [];
  for (const step of steps) {
    const stepId = await ctx.db.insert("contexts", {
      purpose: step.purpose,
      agentId: step.agentId,
      parentId: root,
      rootId: root,
      depth: 1,
      childIds: [],
      status: "active",
      data: { stepNumber: stepIds.length + 1 },
      ...
    });

    stepIds.push(stepId);
  }

  // Update root with all children
  await ctx.db.patch(root, { childIds: stepIds });

  return root;
}
```

### Approval Chain

```typescript
// Request -> Manager -> Finance (nested)
async function createApprovalChain(request: any) {
  // Level 1: Request
  const requestCtx = await createContext({
    purpose: "Expense approval request",
    agentId: "employee-agent",
    data: { amount: request.amount },
  });

  // Level 2: Manager review
  const managerCtx = await createContext({
    purpose: "Manager review",
    agentId: "manager-agent",
    parentId: requestCtx, // ← Nested
    data: { approved: null }, // To be filled
  });

  // Level 3: Finance approval
  const financeCtx = await createContext({
    purpose: "Finance approval",
    agentId: "finance-agent",
    parentId: managerCtx, // ← Nested deeper
    data: { allocated: null },
  });

  return {
    depth: 3,
    chain: [requestCtx, managerCtx, financeCtx],
  };
}
```

### Parallel Workflow

```typescript
// Fork: One parent, multiple parallel children
async function createParallelWorkflow(purpose: string, tasks: any[]) {
  const root = await createContext({ purpose, depth: 0 });

  // Create all children in parallel
  const children = await Promise.all(
    tasks.map((task) =>
      createContext({
        purpose: task.purpose,
        agentId: task.agentId,
        parentId: root,
        data: task.data,
      }),
    ),
  );

  return { root, children };
}
```

---

## Query Patterns

### Finding Contexts by Status

```typescript
// Get all active workflows for an agent
export const getActiveWorkflows = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contexts")
      .withIndex("by_agent_status", (q) =>
        q.eq("agentId", args.agentId).eq("status", "active"),
      )
      .collect();
  },
});

// Get blocked workflows (needs attention)
export const getBlockedWorkflows = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("contexts")
      .withIndex("by_status", (q) => q.eq("status", "blocked"))
      .collect();
  },
});
```

### Finding by Depth

```typescript
// Get all root contexts
export const getRoots = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("contexts")
      .withIndex("by_depth", (q) => q.eq("depth", 0))
      .collect();
  },
});

// Get all leaf contexts (no children)
export const getLeaves = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("contexts").collect();
    return all.filter((c) => c.childIds.length === 0);
  },
});
```

### Finding by Conversation

```typescript
// Get all workflows from a conversation
export const getByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contexts")
      .withIndex("by_conversationRef", (q) =>
        q.eq("conversationRef.conversationId", args.conversationId),
      )
      .collect();
  },
});
```

---

## Orphan Detection

### Finding Orphaned Contexts

```typescript
export const findOrphaned = query({
  handler: async (ctx) => {
    const allContexts = await ctx.db.query("contexts").collect();
    const orphaned = [];

    for (const context of allContexts) {
      if (context.parentId) {
        // Check if parent exists
        const parent = await ctx.db.get(context.parentId);

        if (!parent) {
          orphaned.push(context);
        }
      }
    }

    return orphaned;
  },
});
```

### Cleanup Orphans

```typescript
export const cleanupOrphans = mutation({
  handler: async (ctx) => {
    const orphaned = await ctx.runQuery("contexts:findOrphaned");

    for (const context of orphaned) {
      // Option 1: Delete
      await ctx.db.delete(context._id);

      // Option 2: Promote to root
      // await ctx.db.patch(context._id, {
      //   parentId: null,
      //   rootId: context._id,
      //   depth: 0,
      // });
    }

    return { cleaned: orphaned.length };
  },
});
```

---

## GDPR Cascade

### Contexts Support userId

```typescript
// Create context for user
const context = await createContext({
  purpose: "Handle user request",
  agentId: "support-agent",
  userId: "user-123", // ← GDPR-enabled
});

// GDPR cascade (Cloud Mode)
await cortex.users.delete("user-123", { cascade: true });

// Contexts with userId are deleted
// Children without explicit userId are preserved (workflow metadata)
```

### Selective Deletion

```typescript
export const deleteUserContexts = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Find all contexts for user
    const userContexts = await ctx.db
      .query("contexts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const context of userContexts) {
      // Delete context and descendants
      await deleteWithDescendants(ctx, context._id);
    }

    return { deleted: userContexts.length };
  },
});

async function deleteWithDescendants(ctx: any, contextId: string) {
  const context = await ctx.db.get(contextId);

  // Delete all children first (recursive)
  for (const childId of context.childIds) {
    await deleteWithDescendants(ctx, childId);
  }

  // Delete this context
  await ctx.db.delete(contextId);
}
```

---

## Performance Considerations

### Index Strategy

**Required indexes:**

- `by_agent` - Find agent's contexts
- `by_userId` - GDPR cascade
- `by_status` - Filter by status
- `by_parentId` - Get children
- `by_rootId` - Get entire workflow

**Compound indexes:**

- `by_agent_status` - Agent's active workflows (common query)
- `by_conversationRef` - Find workflows from conversation

### Depth Limits

```typescript
// Enforce maximum depth
const MAX_DEPTH = 10;

export const create = mutation({
  handler: async (ctx, args) => {
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);

      if (parent.depth >= MAX_DEPTH) {
        throw new Error("Maximum context depth exceeded");
      }
    }

    // Proceed with creation...
  },
});
```

### Lazy Loading Children

```typescript
// Don't load all descendants by default
export const get = query({
  args: {
    contextId: v.id("contexts"),
    includeChildren: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db.get(args.contextId);

    if (!args.includeChildren) {
      return context;
    }

    // Load children only if requested
    const children = await Promise.all(
      context.childIds.map((id) => ctx.db.get(id)),
    );

    return { ...context, children };
  },
});
```

---

## Next Steps

- **[Agent Registry](./07-agent-registry.md)** - Optional registry architecture
- **[Performance](./08-performance.md)** - Optimization techniques
- **[Security & Privacy](./09-security-privacy.md)** - Data protection
- **[Context Operations API](../03-api-reference/05-context-operations.md)** - API usage

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions) or [Discord](https://discord.gg/cortex).
