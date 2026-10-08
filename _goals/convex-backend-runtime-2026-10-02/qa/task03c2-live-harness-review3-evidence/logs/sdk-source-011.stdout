/**
 * Cortex SDK - Context Chains API
 *
 * Hierarchical workflow coordination
 * Multi-agent task delegation with shared context
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Backward Compatibility Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get version number with backward compatibility for legacy contexts
 */
function getContextVersion(context: any): number {
  return context.version ?? 1;
}

/**
 * Get previous versions array with backward compatibility for legacy contexts
 */
function getContextPreviousVersions(context: any): any[] {
  return context.previousVersions ?? [];
}

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
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    description: v.optional(v.string()),
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
        .withIndex("by_contextId", (q: any) =>
          q.eq("contextId", args.parentId!),
        )
        .first();

      if (!parentContext) {
        throw new ConvexError("PARENT_NOT_FOUND");
      }

      rootId = parentContext.rootId! || parentContext.contextId;
      depth = parentContext.depth + 1;
    } else {
      // Root context
      rootId = contextId;
      depth = 0;
    }

    // Create context - only include tenantId if it has a value
    const contextData: any = {
      contextId,
      memorySpaceId: args.memorySpaceId,
      purpose: args.purpose,
      description: args.description,
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
      version: 1, // Initialize versioning
      previousVersions: [],
      createdAt: now,
      updatedAt: now,
    };

    // Only add tenantId if it has a value (don't store undefined)
    if (args.tenantId) {
      contextData.tenantId = args.tenantId;
    }

    const _id = await ctx.db.insert("contexts", contextData);

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
 * Update a context (creates new version)
 */
export const update = mutation({
  args: {
    contextId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy: scope lookup to tenant
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("blocked"),
      ),
    ),
    description: v.optional(v.string()),
    data: v.optional(v.any()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Tenant-aware lookup
    let context;
    if (args.tenantId) {
      // For multi-tenant: check within tenant's namespace
      context = await ctx.db
        .query("contexts")
        .withIndex("by_tenant_contextId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("contextId", args.contextId),
        )
        .first();
    } else {
      // For non-tenant: check globally but only match records without tenantId
      const candidate = await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) =>
          q.eq("contextId", args.contextId),
        )
        .first();
      // SECURITY: Only match truly global records (no tenantId set)
      // Check for undefined, null, or empty string to handle all falsy cases
      const candidateTenantId = candidate?.tenantId;
      const hasNoTenant =
        candidateTenantId === undefined ||
        candidateTenantId === null ||
        candidateTenantId === "";
      context = candidate && hasNoTenant ? candidate : null;
    }

    if (!context) {
      throw new ConvexError("CONTEXT_NOT_FOUND");
    }

    const now = Date.now();

    // Merge data (don't replace)
    const newData = {
      ...context.data,
      ...args.data,
    };

    // Create version snapshot (with backward compatibility)
    const currentVersion = getContextVersion(context);
    const previousVersions = getContextPreviousVersions(context);

    const newVersion = {
      version: currentVersion,
      status: context.status,
      data: context.data,
      timestamp: context.updatedAt,
      updatedBy: context.memorySpaceId, // Track which space made the update
    };

    const newStatus = args.status !== undefined ? args.status : context.status;

    await ctx.db.patch(context._id, {
      status: newStatus,
      description:
        args.description !== undefined ? args.description : context.description,
      data: newData,
      version: currentVersion + 1,
      previousVersions: [...previousVersions, newVersion],
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
    tenantId: v.optional(v.string()), // Multi-tenancy: scope lookup to tenant
    cascadeChildren: v.optional(v.boolean()),
    orphanChildren: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Tenant-aware lookup
    let context;
    if (args.tenantId) {
      context = await ctx.db
        .query("contexts")
        .withIndex("by_tenant_contextId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("contextId", args.contextId),
        )
        .first();
    } else {
      const candidate = await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) =>
          q.eq("contextId", args.contextId),
        )
        .first();
      // SECURITY: Only match truly global records (no tenantId set)
      // Check for undefined, null, or empty string to handle all falsy cases
      const candidateTenantId = candidate?.tenantId;
      const hasNoTenant =
        candidateTenantId === undefined ||
        candidateTenantId === null ||
        candidateTenantId === "";
      context = candidate && hasNoTenant ? candidate : null;
    }

    if (!context) {
      throw new ConvexError("CONTEXT_NOT_FOUND");
    }

    // Check for children - allow if cascadeChildren or orphanChildren is true
    if (
      context.childIds.length > 0 &&
      !args.cascadeChildren &&
      !args.orphanChildren
    ) {
      throw new ConvexError("HAS_CHILDREN");
    }

    let deletedCount = 0;
    const orphanedChildren: string[] = [];

    // Delete children if cascade
    if (args.cascadeChildren) {
      for (const childId of context.childIds) {
        const result = await deleteContextRecursive(ctx, childId);
        deletedCount += result;
      }
    }

    // Orphan children - promote them to new roots or attach to grandparent
    if (args.orphanChildren && context.childIds.length > 0) {
      for (const childId of context.childIds) {
        const child = await ctx.db
          .query("contexts")
          .withIndex("by_contextId", (q: any) => q.eq("contextId", childId))
          .first();

        if (child) {
          // If context has a parent, attach children to grandparent
          // Otherwise, make children new root contexts
          const newParentId = context.parentId || undefined;
          const newRootId = context.parentId ? context.rootId : child.contextId;
          const newDepth = context.parentId ? context.depth : 0;

          await ctx.db.patch(child._id, {
            parentId: newParentId,
            rootId: newRootId,
            depth: newDepth,
            updatedAt: Date.now(),
          });

          orphanedChildren.push(childId);

          // If attaching to grandparent, update grandparent's childIds
          if (context.parentId) {
            const grandparent = await ctx.db
              .query("contexts")
              .withIndex("by_contextId", (q: any) =>
                q.eq("contextId", context.parentId!),
              )
              .first();

            if (grandparent) {
              await ctx.db.patch(grandparent._id, {
                childIds: [...grandparent.childIds, childId],
                updatedAt: Date.now(),
              });
            }
          }
        }
      }
    }

    // Remove this context from parent's childIds if it has a parent
    if (context.parentId) {
      const parent = await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) =>
          q.eq("contextId", context.parentId!),
        )
        .first();

      if (parent) {
        await ctx.db.patch(parent._id, {
          childIds: parent.childIds.filter(
            (id: string) => id !== context.contextId,
          ),
          updatedAt: Date.now(),
        });
      }
    }

    // Delete this context
    await ctx.db.delete(context._id);
    deletedCount += 1;

    return {
      deleted: true,
      contextId: args.contextId,
      descendantsDeleted: deletedCount - 1,
      orphanedChildren:
        orphanedChildren.length > 0 ? orphanedChildren : undefined,
    };
  },
});

/**
 * Helper: Recursive delete
 */
async function deleteContextRecursive(
  ctx: any,
  contextId: string,
): Promise<number> {
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
      throw new ConvexError("CONTEXT_NOT_FOUND");
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
      throw new ConvexError("CONTEXT_NOT_FOUND");
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
    tenantId: v.optional(v.string()), // Multi-tenancy: scope lookup to tenant
    includeChain: v.optional(v.boolean()),
    includeConversation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Tenant-aware lookup
    let context;
    if (args.tenantId) {
      context = await ctx.db
        .query("contexts")
        .withIndex("by_tenant_contextId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("contextId", args.contextId),
        )
        .first();
    } else {
      const candidate = await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) =>
          q.eq("contextId", args.contextId),
        )
        .first();
      // SECURITY: Only match truly global records (no tenantId set)
      // Check for undefined, null, or empty string to handle all falsy cases
      const candidateTenantId = candidate?.tenantId;
      const hasNoTenant =
        candidateTenantId === undefined ||
        candidateTenantId === null ||
        candidateTenantId === "";
      context = candidate && hasNoTenant ? candidate : null;
    }

    if (!context) {
      return null;
    }

    if (!args.includeChain) {
      return context;
    }

    // Build complete chain
    const chain = await buildContextChain(ctx, context);

    // If includeConversation is requested, fetch the conversation
    if (args.includeConversation && context.conversationRef?.conversationId) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q: any) =>
          q.eq("conversationId", context.conversationRef!.conversationId),
        )
        .first();

      if (conversation) {
        // Filter trigger messages if messageIds are specified
        const triggerMessages = context.conversationRef.messageIds
          ? conversation.messages.filter((m: any) =>
              context.conversationRef!.messageIds!.includes(m.id),
            )
          : [];

        return {
          ...chain,
          conversation,
          triggerMessages,
        };
      }
    }

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
        .withIndex("by_contextId", (q: any) =>
          q.eq("contextId", context.rootId),
        )
        .first()
    : context;

  // Get parent
  const parent = context.parentId
    ? await ctx.db
        .query("contexts")
        .withIndex("by_contextId", (q: any) =>
          q.eq("contextId", context.parentId),
        )
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
          .withIndex("by_contextId", (q: any) =>
            q.eq("contextId", node.parentId),
          )
          .first()
      : null;
  }

  // Get all descendants recursively
  const descendants = await getAllDescendants(ctx, context.contextId);

  // Calculate total nodes in the chain
  // Total = 1 (current) + ancestors + children + siblings + descendants (excluding direct children to avoid double counting)
  const validChildren = children.filter((c) => c !== null);
  const validSiblings = siblings.filter((s) => s !== null);
  const totalNodes =
    1 +
    ancestors.length +
    validChildren.length +
    validSiblings.length +
    descendants.length;

  return {
    current: context,
    parent,
    root,
    children: validChildren,
    siblings: validSiblings,
    ancestors,
    descendants,
    depth: context.depth,
    totalNodes,
  };
}

/**
 * List contexts with filters
 */
export const list = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    tenantId: v.optional(v.string()), // Multi-tenancy: scope to tenant
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

    // Use best index based on available filters
    if (args.tenantId && args.memorySpaceId) {
      // Tenant + space - use composite index
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_tenant_space", (q) =>
          q
            .eq("tenantId", args.tenantId!)
            .eq("memorySpaceId", args.memorySpaceId!),
        )
        .take(args.limit || 100);
    } else if (args.tenantId) {
      // Tenant only
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!))
        .take(args.limit || 100);
    } else if (args.memorySpaceId && args.status) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace_status", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!).eq("status", args.status!),
        )
        .take(args.limit || 100);
    } else if (args.memorySpaceId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
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

    // SECURITY: For non-tenant queries, filter out tenant-owned records
    if (!args.tenantId) {
      contexts = contexts.filter((c) => !c.tenantId);
    }

    // Apply remaining filters
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
    }

    if (args.depth !== undefined) {
      contexts = contexts.filter((c) => c.depth === args.depth);
    }

    // Apply status filter if not already indexed
    if (args.status && !(args.memorySpaceId && args.status)) {
      contexts = contexts.filter((c) => c.status === args.status);
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

    // Use best index based on available filters (matching list function behavior)
    if (args.memorySpaceId && args.status) {
      // Use composite index for memorySpace + status
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace_status", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!).eq("status", args.status!),
        )
        .collect();
    } else if (args.memorySpaceId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else if (args.status) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      contexts = await ctx.db.query("contexts").collect();
    }

    // Apply remaining filters (userId is not indexed)
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
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
      throw new ConvexError("CONTEXT_NOT_FOUND");
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
      throw new ConvexError("CONTEXT_NOT_FOUND");
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
        .withIndex("by_memorySpace", (q: any) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
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
 * Update many contexts matching filters
 */
/**
 * Update many contexts matching filters
 *
 * IMPORTANT: Uses indexed queries to avoid OCC conflicts with parallel workers.
 */
export const updateMany = mutation({
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
    updates: v.object({
      status: v.optional(
        v.union(
          v.literal("active"),
          v.literal("completed"),
          v.literal("cancelled"),
          v.literal("blocked"),
        ),
      ),
      data: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    let contexts;

    // CRITICAL: Use indexed query when memorySpaceId is provided to avoid
    // full table scan OCC conflicts.
    if (args.memorySpaceId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace", (q: any) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
    } else {
      // Fallback to full scan only when no memorySpaceId filter
      contexts = await ctx.db.query("contexts").collect();
    }

    // Apply remaining filters in-memory
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
    }
    if (args.status) {
      contexts = contexts.filter((c) => c.status === args.status);
    }
    if (args.parentId) {
      contexts = contexts.filter((c) => c.parentId === args.parentId);
    }
    if (args.rootId) {
      contexts = contexts.filter((c) => c.rootId === args.rootId);
    }

    const now = Date.now();
    const contextIds: string[] = [];

    // Update each context
    for (const context of contexts) {
      // Backward compatibility for version tracking
      const currentVersion = getContextVersion(context);
      const previousVersions = getContextPreviousVersions(context);

      const newVersion = {
        version: currentVersion,
        status: context.status,
        data: context.data,
        timestamp: context.updatedAt,
        updatedBy: context.memorySpaceId,
      };

      const newData = args.updates.data
        ? { ...context.data, ...args.updates.data }
        : context.data;

      await ctx.db.patch(context._id, {
        status:
          args.updates.status !== undefined
            ? args.updates.status
            : context.status,
        data: newData,
        version: currentVersion + 1,
        previousVersions: [...previousVersions, newVersion],
        updatedAt: now,
      });

      contextIds.push(context.contextId);
    }

    return {
      updated: contextIds.length,
      contextIds,
    };
  },
});

/**
 * Delete many contexts matching filters
 *
 * IMPORTANT: Uses indexed queries to avoid OCC conflicts with parallel workers.
 * Full table scans create read dependencies on the entire table, causing infinite
 * retry loops when other workers are creating/updating contexts simultaneously.
 */
export const deleteMany = mutation({
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
    completedBefore: v.optional(v.number()),
    cascadeChildren: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let contexts;

    // CRITICAL: Use indexed query when memorySpaceId is provided to avoid
    // full table scan OCC conflicts. This is the common case for test cleanup.
    if (args.memorySpaceId) {
      contexts = await ctx.db
        .query("contexts")
        .withIndex("by_memorySpace", (q: any) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
    } else {
      // Fallback to full scan only when no memorySpaceId filter
      // This should be rare and caller should be aware of OCC risks
      contexts = await ctx.db.query("contexts").collect();
    }

    // Apply remaining filters in-memory (these are less common)
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
    }
    if (args.status) {
      contexts = contexts.filter((c) => c.status === args.status);
    }
    if (args.completedBefore) {
      contexts = contexts.filter(
        (c) => c.completedAt && c.completedAt < args.completedBefore!,
      );
    }

    let totalDeleted = 0;
    const contextIds: string[] = [];

    // Delete each context
    for (const context of contexts) {
      if (context.childIds.length > 0 && !args.cascadeChildren) {
        continue; // Skip if has children and no cascade
      }

      if (args.cascadeChildren) {
        // Delete with cascade
        const count = await deleteContextRecursive(ctx, context.contextId);
        totalDeleted += count;
      } else {
        await ctx.db.delete(context._id);
        totalDeleted += 1;
      }

      contextIds.push(context.contextId);
    }

    return {
      deleted: totalDeleted,
      contextIds,
    };
  },
});

/**
 * Remove participant from context
 */
export const removeParticipant = mutation({
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
      throw new ConvexError("CONTEXT_NOT_FOUND");
    }

    await ctx.db.patch(context._id, {
      participants: context.participants.filter(
        (p) => p !== args.participantId,
      ),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(context._id);
  },
});

/**
 * Get contexts by conversation ID
 */
export const getByConversation = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const allContexts = await ctx.db.query("contexts").collect();

    return allContexts.filter(
      (c) =>
        c.conversationRef &&
        c.conversationRef.conversationId === args.conversationId,
    );
  },
});

/**
 * Find orphaned contexts (parent no longer exists)
 */
export const findOrphaned = query({
  args: {},
  handler: async (ctx) => {
    const allContexts = await ctx.db.query("contexts").collect();
    const orphaned: any[] = [];

    for (const context of allContexts) {
      if (context.parentId) {
        // Check if parent exists
        const parent = await ctx.db
          .query("contexts")
          .withIndex("by_contextId", (q: any) =>
            q.eq("contextId", context.parentId!),
          )
          .first();

        if (!parent) {
          orphaned.push(context);
        }
      }
    }

    return orphaned;
  },
});

/**
 * Get specific version of a context
 */
export const getVersion = query({
  args: {
    contextId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      return null;
    }

    // Backward compatibility for version tracking
    const currentVersion = getContextVersion(context);
    const previousVersions = getContextPreviousVersions(context);

    // Check if it's the current version
    if (currentVersion === args.version) {
      return {
        version: currentVersion,
        status: context.status,
        data: context.data,
        timestamp: context.updatedAt,
        updatedBy: context.memorySpaceId,
      };
    }

    // Check previous versions
    const versionRecord = previousVersions.find(
      (v: any) => v.version === args.version,
    );

    return versionRecord || null;
  },
});

/**
 * Get all versions of a context
 */
export const getHistory = query({
  args: {
    contextId: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      return [];
    }

    // Backward compatibility for version tracking
    const currentVersion = getContextVersion(context);
    const previousVersions = getContextPreviousVersions(context);

    // Return all previous versions + current version
    const versions = [
      ...previousVersions,
      {
        version: currentVersion,
        status: context.status,
        data: context.data,
        timestamp: context.updatedAt,
        updatedBy: context.memorySpaceId,
      },
    ];

    return versions;
  },
});

/**
 * Get context version at specific timestamp
 */
export const getAtTimestamp = query({
  args: {
    contextId: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.db
      .query("contexts")
      .withIndex("by_contextId", (q: any) => q.eq("contextId", args.contextId))
      .first();

    if (!context) {
      return null;
    }

    // Backward compatibility for version tracking
    const currentVersion = getContextVersion(context);
    const previousVersions = getContextPreviousVersions(context);

    // If timestamp is after current version, return current
    if (args.timestamp >= context.updatedAt) {
      return {
        version: currentVersion,
        status: context.status,
        data: context.data,
        timestamp: context.updatedAt,
        updatedBy: context.memorySpaceId,
      };
    }

    // Find the version that was current at the timestamp
    // Walk backwards through versions
    const allVersions = [
      ...previousVersions,
      {
        version: currentVersion,
        status: context.status,
        data: context.data,
        timestamp: context.updatedAt,
        updatedBy: context.memorySpaceId,
      },
    ].sort((a, b) => b.timestamp - a.timestamp);

    for (const version of allVersions) {
      if (args.timestamp >= version.timestamp) {
        return version;
      }
    }

    // If timestamp is before all versions, return null
    return null;
  },
});

/**
 * Export contexts to JSON or CSV
 */
export const exportContexts = query({
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
    format: v.union(v.literal("json"), v.literal("csv")),
    includeChain: v.optional(v.boolean()),
    includeVersionHistory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get all matching contexts
    let contexts = await ctx.db.query("contexts").collect();

    // Apply filters
    if (args.memorySpaceId) {
      contexts = contexts.filter((c) => c.memorySpaceId === args.memorySpaceId);
    }
    if (args.userId) {
      contexts = contexts.filter((c) => c.userId === args.userId);
    }
    if (args.status) {
      contexts = contexts.filter((c) => c.status === args.status);
    }

    let data: string;

    if (args.format === "json") {
      // Build JSON export
      const exportData = contexts.map((c) => {
        const base: any = {
          contextId: c.contextId,
          memorySpaceId: c.memorySpaceId,
          purpose: c.purpose,
          status: c.status,
          depth: c.depth,
          parentId: c.parentId,
          rootId: c.rootId,
          userId: c.userId,
          data: c.data,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };

        if (args.includeVersionHistory) {
          base.version = c.version;
          base.previousVersions = c.previousVersions;
        }

        return base;
      });

      data = JSON.stringify(exportData, null, 2);
    } else {
      // CSV export
      const headers = [
        "contextId",
        "memorySpaceId",
        "purpose",
        "status",
        "depth",
        "parentId",
        "userId",
        "createdAt",
        "updatedAt",
      ];

      const rows = contexts.map((c) => [
        c.contextId,
        c.memorySpaceId,
        c.purpose,
        c.status,
        c.depth.toString(),
        c.parentId || "",
        c.userId || "",
        new Date(c.createdAt).toISOString(),
        new Date(c.updatedAt).toISOString(),
      ]);

      data = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    return {
      format: args.format,
      data,
      count: contexts.length,
      exportedAt: Date.now(),
    };
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
