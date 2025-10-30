/**
 * Cortex SDK - Context Chains API
 *
 * Hierarchical workflow coordination
 * Multi-agent task delegation with shared context
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new context (root or child)
 */
export const create = mutation({
  args: {
    purpose: v.string(),
    memorySpaceId: v.string(), // Memory space creating this context
    userId: v.optional(v.string()),
    parentId: v.optional(v.string()),
    conversationRef: v.optional(
      v.object({
        conversationId: v.string(),
        messageIds: v.optional(v.array(v.string())),
      }),
    ),
    data: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const contextId = `ctx-${now}-${Math.random().toString(36).substring(2, 11)}`;

    let rootId: string;
    let depth: number;
    let parentContext = null;

    if (args.parentId) {
      // Child context - find parent
      parentContext = await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) => q.eq("contextId", args.parentId!))
        .first();

      if (!parentContext) {
        throw new Error("PARENT_NOT_FOUND");
      }

      rootId = parentContext.rootId! || parentContext.contextId;
      depth = parentContext.depth + 1;
    } else {
      // Root context
      rootId = contextId;
      depth = 0;
    }

    // Create context
    const _id = await ctx.db.insert("contexts", {
      contextId,
      memorySpaceId: args.memorySpaceId,
      purpose: args.purpose,
      userId: args.userId,
      parentId: args.parentId,
      rootId,
      depth,
      childIds: [],
      status: args.status || "active",
      conversationRef: args.conversationRef,
      participants: [args.memorySpaceId], // Creator is first participant
      grantedAccess: [],
      data: args.data,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
    });

    // Update parent's childIds
    if (parentContext) {
      await ctx.db.patch(parentContext._id, {
        childIds: [...parentContext.childIds, contextId],
      });
    }

    return await ctx.db.get(_id);
  },
});

/**
 * Update a context (creates version in metadata)
 */
export const update = mutation({
  args: {
    contextId: v.string(),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
    data: v.optional(v.any()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      throw new Error("CONTEXT_NOT_FOUND");
    }

    const now = Date.now();

    // Merge data (don't replace)
    const newData = {
      ...context.data,
      ...args.data,
    };

    await ctx.db.patch(context._id, {
      status: args.status !== undefined ? args.status : context.status,
      data: newData,
      updatedAt: now,
      completedAt:
        args.completedAt !== undefined
          ? args.completedAt
          : args.status === "completed"
            ? now
            : context.completedAt,
    });

    return await ctx.db.get(context._id);
  },
});

/**
 * Delete a context
 */
export const deleteContext = mutation({
  args: {
    contextId: v.string(),
    cascadeChildren: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      throw new Error("CONTEXT_NOT_FOUND");
    }

    // Check for children
    if (context.childIds.length > 0 && !args.cascadeChildren) {
      throw new Error("HAS_CHILDREN");
    }

    let deletedCount = 0;

    // Delete children if cascade
    if (args.cascadeChildren) {
      for (const childId of context.childIds) {
        const result = await deleteContextRecursive(ctx, childId);
        deletedCount += result;
      }
    }

    // Delete this context
    await ctx.db.delete(context._id);
    deletedCount += 1;

    return {
      deleted: true,
      contextId: args.contextId,
      descendantsDeleted: deletedCount - 1,
    };
  },
});

/**
 * Helper: Recursive delete
 */
async function deleteContextRecursive(ctx: any, contextId: string): Promise<number> {
  const context = await ctx.db
    .query("contexts")
    .withIndex("by_contextId", (q: any) => q.eq("contextId", contextId))
    .first();

  if (!context) return 0;

  let count = 0;

  // Delete children first
  for (const childId of context.childIds) {
    count += await deleteContextRecursive(ctx, childId);
  }

  // Delete this one
  await ctx.db.delete(context._id);
  count += 1;

  return count;
}

/**
 * Add participant to context
 */
export const addParticipant = mutation({
  args: {
    contextId: v.string(),
    participantId: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      throw new Error("CONTEXT_NOT_FOUND");
    }

    if (context.participants.includes(args.participantId)) {
      return context; // Already exists
    }

    await ctx.db.patch(context._id, {
      participants: [...context.participants, args.participantId],
      updatedAt: Date.now(),
    });

    return await ctx.db.get(context._id);
  },
});

/**
 * Grant cross-space access
 */
export const grantAccess = mutation({
  args: {
    contextId: v.string(),
    targetMemorySpaceId: v.string(),
    scope: v.string(), // 'read-only', 'context-only', etc.
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      throw new Error("CONTEXT_NOT_FOUND");
    }

    const grant = {
      memorySpaceId: args.targetMemorySpaceId,
      scope: args.scope,
      grantedAt: Date.now(),
    };

    const existing = context.grantedAccess || [];
    const updated = existing.filter(
      (g) => g.memorySpaceId !== args.targetMemorySpaceId,
    );
    updated.push(grant);

    await ctx.db.patch(context._id, {
      grantedAccess: updated,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(context._id);
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get context by ID
 */
export const get = query({
  args: {
    contextId: v.string(),
    includeChain: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      return null;
    }

    if (!args.includeChain) {
      return context;
    }

    // Build complete chain
    const chain = await buildContextChain(ctx, context);

    return chain;
  },
});

/**
 * Helper: Build context chain
 */
async function buildContextChain(ctx: any, context: any) {
  // Get root
  const root = context.rootId
    ? await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) => q.eq("contextId", context.rootId))
        .first()
    : context;

  // Get parent
  const parent = context.parentId
    ? await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) => q.eq("contextId", context.parentId))
        .first()
    : null;

    // Get children
    const children = await Promise.all(
      context.childIds.map((id: string) =>
        ctx.db
          .query("contexts")
          .withIndex("by_contextId", (q: any) => q.eq("contextId", id))
          .first(),
      ),
    );

    // Get siblings
    const siblings = parent
      ? await Promise.all(
          parent.childIds
            .filter((id: string) => id !== context.contextId)
            .map((id: string) =>
              ctx.db
                .query("contexts")
                .withIndex("by_contextId", (q: any) => q.eq("contextId", id))
                .first(),
            ),
        )
      : [];

  // Get ancestors
  const ancestors: any[] = [];
  let node = parent;

  while (node) {
    ancestors.unshift(node);
    node = node.parentId
      ? await ctx.db
          .query("contexts")
          .withIndex("by_contextId", (q: any) => q.eq("contextId", node.parentId))
          .first()
      : null;
  }

  return {
    current: context,
    parent,
    root,
    children: children.filter((c) => c !== null),
    siblings: siblings.filter((s) => s !== null),
    ancestors,
    depth: context.depth,
  };
}

/**
 * List contexts with filters
 */
export const list = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    userId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
    parentId: v.optional(v.string()),
    rootId: v.optional(v.string()),
    depth: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let contexts;

    // Use best index
    if (args.memorySpaceId && args.status) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace_status", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!).eq("status", args.status!),
        )
        .take(args.limit || 100);
    } else if (args.memorySpaceId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace", (q) => q.eq("memorySpaceId", args.memorySpaceId!))
        .take(args.limit || 100);
    } else if (args.status) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .take(args.limit || 100);
    } else if (args.parentId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_parentId", (q) => q.eq("parentId", args.parentId!))
        .take(args.limit || 100);
    } else if (args.rootId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_rootId", (q) => q.eq("rootId", args.rootId!))
        .take(args.limit || 100);
    } else {
      contexts = await ctx.db
        .query("contexts")
        .order("desc")
        .take(args.limit || 100);
    }

    // Apply remaining filters
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
    }

    if (args.depth !== undefined) {
      contexts = contexts.filter((c) => c.depth === args.depth);
    }

    return contexts;
  },
});

/**
 * Count contexts
 */
export const count = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    userId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let contexts;

    if (args.memorySpaceId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace", (q) => q.eq("memorySpaceId", args.memorySpaceId!))
        .collect();
    } else {
      contexts = await ctx.db.query("contexts").collect();
    }

    // Apply filters
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
    }

    if (args.status) {
      contexts = contexts.filter((c) => c.status === args.status);
    }

    return contexts.length;
  },
});

/**
 * Get context chain (full hierarchy)
 */
export const getChain = query({
  args: {
    contextId: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      throw new Error("CONTEXT_NOT_FOUND");
    }

    return await buildContextChain(ctx, context);
  },
});

/**
 * Get root context of a chain
 */
export const getRoot = query({
  args: {
    contextId: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      throw new Error("CONTEXT_NOT_FOUND");
    }

    const rootId = context.rootId || context.contextId;
    const root = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", rootId))
      .first();

    return root;
  },
});

/**
 * Get children of a context
 */
export const getChildren = query({
  args: {
    contextId: v.string(),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
    recursive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      return [];
    }

    let children: any[] = [];

    if (args.recursive) {
      // Get all descendants recursively
      children = await getAllDescendants(ctx, context.contextId);
    } else {
      // Get direct children only
      children = await Promise.all(
        context.childIds.map((id: string) =>
          ctx.db
            .query("contexts")
            .withIndex("by_contextId", (q: any) => q.eq("contextId", id))
            .first(),
        ),
      );
      children = children.filter((c) => c !== null);
    }

    // Filter by status
    if (args.status) {
      children = children.filter((c) => c.status === args.status);
    }

    return children;
  },
});

/**
 * Helper: Get all descendants recursively
 */
async function getAllDescendants(ctx: any, contextId: string): Promise<any[]> {
  const context = await ctx.db
    .query("contexts")
    .withIndex("by_contextId", (q: any) => q.eq("contextId", contextId))
    .first();

  if (!context) return [];

  const children = await Promise.all(
    context.childIds.map((id: string) =>
      ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) => q.eq("contextId", id))
        .first(),
    ),
  );

  const validChildren = children.filter((c) => c !== null);

  // Recursively get grandchildren
  const grandchildren = await Promise.all(
    validChildren.map((child) => getAllDescendants(ctx, child.contextId)),
  );

  return [...validChildren, ...grandchildren.flat()];
}

/**
 * Search contexts (same as list)
 */
export const search = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    userId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Delegate to list
    let contexts;

    if (args.memorySpaceId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace", (q: any) => q.eq("memorySpaceId", args.memorySpaceId!))
        .take(args.limit || 100);
    } else {
      contexts = await ctx.db
        .query("contexts")
        .order("desc")
        .take(args.limit || 100);
    }

    // Apply filters
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
    }

    if (args.status) {
      contexts = contexts.filter((c) => c.status === args.status);
    }

    return contexts;
  },
});

/**
 * Purge all contexts (TEST/DEV ONLY)
 */
export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Safety check: Only allow in test/dev environments
    const siteUrl = process.env.CONVEX_SITE_URL || "";
    const isLocal =
      siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    const isDevDeployment =
      siteUrl.includes(".convex.site") ||
      siteUrl.includes("dev-") ||
      siteUrl.includes("convex.cloud");
    const isTestEnv =
      process.env.NODE_ENV === "test" ||
      process.env.CONVEX_ENVIRONMENT === "test";

    if (!isLocal && !isDevDeployment && !isTestEnv) {
      throw new Error(
        "PURGE_DISABLED_IN_PRODUCTION: purgeAll is only available in test/dev environments.",
      );
    }

    const allContexts = await ctx.db.query("contexts").collect();

    for (const context of allContexts) {
      await ctx.db.delete(context._id);
    }

    return { deleted: allContexts.length };
  },
});

