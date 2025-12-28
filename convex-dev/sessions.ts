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
    // Select the best index based on provided filters
    let sessions;

    if (args.tenantId && args.userId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_tenant_user", (q) =>
          q.eq("tenantId", args.tenantId!).eq("userId", args.userId!),
        )
        .collect();
    } else if (args.tenantId && args.status) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", args.tenantId!).eq("status", args.status!),
        )
        .collect();
    } else if (args.tenantId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!))
        .collect();
    } else if (args.userId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else if (args.memorySpaceId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else if (args.status) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      sessions = await ctx.db.query("sessions").collect();
    }

    // Apply any remaining filters not covered by the selected index
    // Note: userId is always covered when provided (by by_tenant_user or by_userId)
    // so no userId post-filter is needed in list

    // memorySpaceId needs filter when provided but by_memorySpace wasn't used
    // by_memorySpace is used only when !tenantId && !userId && memorySpaceId
    if (args.memorySpaceId && (args.tenantId || args.userId)) {
      sessions = sessions.filter((s) => s.memorySpaceId === args.memorySpaceId);
    }

    // status needs filter when provided but neither by_tenant_status nor by_status was used
    // by_tenant_status: tenantId && status && !userId
    // by_status: !tenantId && !userId && !memorySpaceId && status
    if (
      args.status &&
      (args.userId || (args.memorySpaceId && !args.tenantId))
    ) {
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
    // Select the best index based on provided filters
    let sessions;

    if (args.tenantId && args.status) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_tenant_status", (q) =>
          q.eq("tenantId", args.tenantId!).eq("status", args.status!),
        )
        .collect();
    } else if (args.tenantId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!))
        .collect();
    } else if (args.userId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else if (args.memorySpaceId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else if (args.status) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      sessions = await ctx.db.query("sessions").collect();
    }

    // Apply any remaining filters not covered by the selected index
    // In count, there's no by_tenant_user index branch, so userId is only covered by by_userId
    // by_userId is used when !tenantId && userId
    if (args.userId && args.tenantId) {
      sessions = sessions.filter((s) => s.userId === args.userId);
    }

    // memorySpaceId needs filter when provided but by_memorySpace wasn't used
    // by_memorySpace is used only when !tenantId && !userId && memorySpaceId
    if (args.memorySpaceId && (args.tenantId || args.userId)) {
      sessions = sessions.filter((s) => s.memorySpaceId === args.memorySpaceId);
    }

    // status needs filter when provided but neither by_tenant_status nor by_status was used
    // by_tenant_status: tenantId && status
    // by_status: !tenantId && !userId && !memorySpaceId && status
    if (args.status && !args.tenantId && (args.userId || args.memorySpaceId)) {
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

    // Get all active/idle sessions, optionally filtered by tenant
    let sessions;
    if (args.tenantId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!))
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "idle"),
          ),
        )
        .collect();
    } else {
      sessions = await ctx.db
        .query("sessions")
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "idle"),
          ),
        )
        .collect();
    }

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
