/**
 * Cortex SDK - Convex Sessions API
 *
 * Native session management with fully extensible metadata.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Core Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new session
 */
export const create = mutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    startedAt: v.number(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.startedAt;

    const session = {
      sessionId: args.sessionId,
      userId: args.userId,
      tenantId: args.tenantId,
      memorySpaceId: args.memorySpaceId,
      status: "active" as const,
      startedAt: now,
      lastActiveAt: now,
      expiresAt: args.expiresAt,
      metadata: args.metadata,
      messageCount: 0,
      memoryCount: 0,
    };

    const id = await ctx.db.insert("sessions", session);

    return {
      _id: id,
      ...session,
    };
  },
});

/**
 * Get a session by ID
 */
export const get = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    return session;
  },
});

/**
 * Update session activity (touch)
 */
export const touch = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Session not found: ${args.sessionId}`);
    }

    await ctx.db.patch(session._id, {
      lastActiveAt: Date.now(),
      status: "active",
    });
  },
});

/**
 * End a session
 */
export const end = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Session not found: ${args.sessionId}`);
    }

    await ctx.db.patch(session._id, {
      status: "ended",
      endedAt: Date.now(),
    });
  },
});

/**
 * End all sessions for a user
 */
export const endAll = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("status"), "ended"))
      .collect();

    const now = Date.now();
    const sessionIds: string[] = [];

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt: now,
      });
      sessionIds.push(session.sessionId);
    }

    return {
      ended: sessionIds.length,
      sessionIds,
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Query Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * List sessions with filters
 */
export const list = query({
  args: {
    userId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("idle"), v.literal("ended")),
    ),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("sessions");

    // Track which fields are covered by the selected index
    const indexedFields = new Set<string>();

    // Apply filters based on what's provided
    if (args.tenantId && args.userId) {
      q = q.withIndex("by_tenant_user", (q) =>
        q.eq("tenantId", args.tenantId!).eq("userId", args.userId!),
      );
      indexedFields.add("tenantId");
      indexedFields.add("userId");
    } else if (args.tenantId && args.status) {
      q = q.withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", args.tenantId!).eq("status", args.status!),
      );
      indexedFields.add("tenantId");
      indexedFields.add("status");
    } else if (args.tenantId) {
      q = q.withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!));
      indexedFields.add("tenantId");
    } else if (args.userId) {
      q = q.withIndex("by_userId", (q) => q.eq("userId", args.userId!));
      indexedFields.add("userId");
    } else if (args.memorySpaceId) {
      q = q.withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId!),
      );
      indexedFields.add("memorySpaceId");
    } else if (args.status) {
      q = q.withIndex("by_status", (q) => q.eq("status", args.status!));
      indexedFields.add("status");
    }

    // Collect with remaining filters applied
    let sessions = await q.collect();

    // Apply any remaining filters not covered by indexes
    if (args.userId && !indexedFields.has("userId")) {
      sessions = sessions.filter((s) => s.userId === args.userId);
    }

    if (args.memorySpaceId && !indexedFields.has("memorySpaceId")) {
      sessions = sessions.filter((s) => s.memorySpaceId === args.memorySpaceId);
    }

    if (args.status && !indexedFields.has("status")) {
      sessions = sessions.filter((s) => s.status === args.status);
    }

    // Apply pagination
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 50;
    sessions = sessions.slice(offset, offset + limit);

    return sessions;
  },
});

/**
 * Count sessions with filters
 */
export const count = query({
  args: {
    userId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("idle"), v.literal("ended")),
    ),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("sessions");

    // Track which fields are covered by the selected index
    const indexedFields = new Set<string>();

    // Apply filters based on what's provided
    if (args.tenantId && args.status) {
      q = q.withIndex("by_tenant_status", (q) =>
        q.eq("tenantId", args.tenantId!).eq("status", args.status!),
      );
      indexedFields.add("tenantId");
      indexedFields.add("status");
    } else if (args.tenantId) {
      q = q.withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!));
      indexedFields.add("tenantId");
    } else if (args.userId) {
      q = q.withIndex("by_userId", (q) => q.eq("userId", args.userId!));
      indexedFields.add("userId");
    } else if (args.memorySpaceId) {
      q = q.withIndex("by_memorySpace", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId!),
      );
      indexedFields.add("memorySpaceId");
    } else if (args.status) {
      q = q.withIndex("by_status", (q) => q.eq("status", args.status!));
      indexedFields.add("status");
    }

    // Collect and count with remaining filters
    let sessions = await q.collect();

    // Apply any remaining filters not covered by indexes
    if (args.userId && !indexedFields.has("userId")) {
      sessions = sessions.filter((s) => s.userId === args.userId);
    }
    if (args.memorySpaceId && !indexedFields.has("memorySpaceId")) {
      sessions = sessions.filter((s) => s.memorySpaceId === args.memorySpaceId);
    }
    if (args.status && !indexedFields.has("status")) {
      sessions = sessions.filter((s) => s.status === args.status);
    }

    return sessions.length;
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Maintenance Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Expire idle sessions
 */
export const expireIdle = mutation({
  args: {
    tenantId: v.optional(v.string()),
    idleTimeout: v.number(), // Timeout in milliseconds
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.idleTimeout;

    let q = ctx.db.query("sessions");

    // Filter by tenant if provided
    if (args.tenantId) {
      q = q.withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!));
    }

    // Get all active sessions
    let sessions = await q
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "idle"),
        ),
      )
      .collect();

    // Filter by idle timeout
    sessions = sessions.filter((s) => s.lastActiveAt < cutoff);

    const now = Date.now();
    let expired = 0;

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt: now,
      });
      expired++;
    }

    return { expired };
  },
});

/**
 * Increment message count for a session
 */
export const incrementMessageCount = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      return; // Session may not exist - silently ignore
    }

    await ctx.db.patch(session._id, {
      messageCount: (session.messageCount ?? 0) + 1,
      lastActiveAt: Date.now(),
    });
  },
});

/**
 * Increment memory count for a session
 */
export const incrementMemoryCount = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      return; // Session may not exist - silently ignore
    }

    await ctx.db.patch(session._id, {
      memoryCount: (session.memoryCount ?? 0) + 1,
      lastActiveAt: Date.now(),
    });
  },
});
