/**
 * Cortex SDK - Mutable Store API (Layer 1c)
 * 
 * ACID-compliant mutable storage for live, frequently-changing data
 * Namespaces: inventory, config, counters, sessions, state, etc.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Set a key to a value (creates or overwrites)
 */
export const set = mutation({
  args: {
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    userId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if entry exists
    const existing = await ctx.db
      .query("mutable")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        value: args.value,
        userId: args.userId !== undefined ? args.userId : existing.userId,
        metadata: args.metadata !== undefined ? args.metadata : existing.metadata,
        updatedAt: now,
      });

      return await ctx.db.get(existing._id);
    } else {
      // Create new
      const _id = await ctx.db.insert("mutable", {
        namespace: args.namespace,
        key: args.key,
        value: args.value,
        userId: args.userId,
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
        accessCount: 0,
        lastAccessed: undefined,
      });

      return await ctx.db.get(_id);
    }
  },
});

/**
 * Atomic update using updater function
 */
export const update = mutation({
  args: {
    namespace: v.string(),
    key: v.string(),
    // Note: updater function is passed as serialized code in the actual implementation
    // For now, we'll handle simple operations
    operation: v.union(
      v.literal("increment"),
      v.literal("decrement"),
      v.literal("append"),
      v.literal("custom")
    ),
    operand: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mutable")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key)
      )
      .first();

    if (!existing) {
      throw new Error("MUTABLE_KEY_NOT_FOUND");
    }

    let newValue = existing.value;

    // Apply operation
    switch (args.operation) {
      case "increment":
        newValue = (existing.value || 0) + (args.operand || 1);
        break;
      case "decrement":
        newValue = (existing.value || 0) - (args.operand || 1);
        break;
      case "append":
        if (Array.isArray(existing.value)) {
          newValue = [...existing.value, args.operand];
        } else {
          throw new Error("MUTABLE_VALUE_NOT_ARRAY");
        }
        break;
      case "custom":
        newValue = args.operand; // For custom updates via SDK
        break;
    }

    await ctx.db.patch(existing._id, {
      value: newValue,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(existing._id);
  },
});

/**
 * Delete a key
 */
export const deleteKey = mutation({
  args: {
    namespace: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("mutable")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key)
      )
      .first();

    if (!entry) {
      throw new Error("MUTABLE_KEY_NOT_FOUND");
    }

    await ctx.db.delete(entry._id);

    return {
      deleted: true,
      namespace: args.namespace,
      key: args.key,
    };
  },
});

/**
 * Purge all keys in a namespace
 */
export const purgeNamespace = mutation({
  args: {
    namespace: v.string(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("mutable")
      .withIndex("by_namespace", (q) => q.eq("namespace", args.namespace))
      .collect();

    let deleted = 0;
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
      deleted++;
    }

    return {
      deleted,
      namespace: args.namespace,
    };
  },
});

/**
 * Bulk delete keys matching filters
 */
export const purgeMany = mutation({
  args: {
    namespace: v.string(),
    keyPrefix: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let entries = await ctx.db
      .query("mutable")
      .withIndex("by_namespace", (q) => q.eq("namespace", args.namespace))
      .collect();

    // Apply filters
    if (args.keyPrefix) {
      entries = entries.filter((e) => e.key.startsWith(args.keyPrefix!));
    }

    if (args.userId) {
      entries = entries.filter((e) => e.userId === args.userId);
    }

    let deleted = 0;
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
      deleted++;
    }

    return {
      deleted,
      namespace: args.namespace,
      keys: entries.map((e) => e.key),
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get value for a key
 */
export const get = query({
  args: {
    namespace: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("mutable")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key)
      )
      .first();

    return entry || null;
  },
});

/**
 * Check if key exists
 */
export const exists = query({
  args: {
    namespace: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("mutable")
      .withIndex("by_namespace_key", (q) =>
        q.eq("namespace", args.namespace).eq("key", args.key)
      )
      .first();

    return entry !== null;
  },
});

/**
 * List keys in namespace
 */
export const list = query({
  args: {
    namespace: v.string(),
    keyPrefix: v.optional(v.string()),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let entries = await ctx.db
      .query("mutable")
      .withIndex("by_namespace", (q) => q.eq("namespace", args.namespace))
      .take(args.limit || 100);

    // Filter by key prefix if provided
    if (args.keyPrefix) {
      entries = entries.filter((e) => e.key.startsWith(args.keyPrefix!));
    }

    // Filter by userId if provided
    if (args.userId) {
      entries = entries.filter((e) => e.userId === args.userId);
    }

    return entries;
  },
});

/**
 * Count keys in namespace
 */
export const count = query({
  args: {
    namespace: v.string(),
    userId: v.optional(v.string()),
    keyPrefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let entries = await ctx.db
      .query("mutable")
      .withIndex("by_namespace", (q) => q.eq("namespace", args.namespace))
      .collect();

    // Filter by userId if provided
    if (args.userId) {
      entries = entries.filter((e) => e.userId === args.userId);
    }

    // Filter by key prefix if provided
    if (args.keyPrefix) {
      entries = entries.filter((e) => e.key.startsWith(args.keyPrefix!));
    }

    return entries.length;
  },
});

