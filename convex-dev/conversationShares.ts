/**
 * Cortex SDK - Conversation Shares API
 *
 * Shareable Chats Phase 2: Sharing Grants
 * Manages share links and permissions for conversations
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a unique, unguessable share ID
 */
function generateShareId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `share-${timestamp}-${randomPart}${randomPart2}`;
}

/**
 * Check if a share has expired or exceeded view limits
 */
function isShareValid(share: {
  status: string;
  expiresAt?: number;
  maxViews?: number;
  viewCount: number;
}): { valid: boolean; reason?: string } {
  if (share.status !== "active") {
    return { valid: false, reason: `SHARE_${share.status.toUpperCase()}` };
  }

  if (share.expiresAt && Date.now() > share.expiresAt) {
    return { valid: false, reason: "SHARE_EXPIRED" };
  }

  if (share.maxViews && share.viewCount >= share.maxViews) {
    return { valid: false, reason: "MAX_VIEWS_REACHED" };
  }

  return { valid: true };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new share for a conversation
 */
export const create = mutation({
  args: {
    conversationId: v.string(),
    grantedBy: v.string(), // userId who is sharing
    sourceMemorySpaceId: v.optional(v.string()), // Deprecated: now derived from conversation
    grantType: v.union(
      v.literal("user"),
      v.literal("space"),
      v.literal("link"),
      v.literal("domain"),
    ),
    grantedTo: v.optional(v.string()),
    permissions: v.object({
      canView: v.boolean(),
      canViewFacts: v.boolean(),
      canViewMemories: v.boolean(),
      canContinue: v.boolean(),
      canFork: v.boolean(),
      canExport: v.boolean(),
    }),
    expiresAt: v.optional(v.number()),
    maxViews: v.optional(v.number()),
    redactBefore: v.optional(v.number()),
    redactSensitive: v.optional(v.boolean()),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the conversation exists
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    // Validate grantType requirements
    if (args.grantType === "user" && !args.grantedTo) {
      throw new ConvexError("GRANTEE_REQUIRED_FOR_USER_SHARE");
    }
    if (args.grantType === "space" && !args.grantedTo) {
      throw new ConvexError("SPACE_ID_REQUIRED_FOR_SPACE_SHARE");
    }
    if (args.grantType === "domain" && !args.grantedTo) {
      throw new ConvexError("DOMAIN_REQUIRED_FOR_DOMAIN_SHARE");
    }

    const now = Date.now();
    const shareId = generateShareId();

    const id = await ctx.db.insert("conversationShares", {
      shareId,
      conversationId: args.conversationId,
      grantedBy: args.grantedBy,
      // Use the conversation's actual memorySpaceId, not the client-provided value
      sourceMemorySpaceId: conversation.memorySpaceId,
      grantType: args.grantType,
      grantedTo: args.grantedTo,
      permissions: args.permissions,
      expiresAt: args.expiresAt,
      maxViews: args.maxViews,
      viewCount: 0,
      redactBefore: args.redactBefore,
      redactSensitive: args.redactSensitive ?? false,
      status: "active",
      tenantId: args.tenantId,
      createdAt: now,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Revoke an existing share
 */
export const revoke = mutation({
  args: {
    shareId: v.string(),
    // Optional: caller's userId for authorization
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("conversationShares")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!share) {
      throw new ConvexError("SHARE_NOT_FOUND");
    }

    if (share.status === "revoked") {
      throw new ConvexError("SHARE_ALREADY_REVOKED");
    }

    // Optional: verify the caller is the share owner
    if (args.userId && share.grantedBy !== args.userId) {
      throw new ConvexError("REVOKE_NOT_AUTHORIZED");
    }

    await ctx.db.patch(share._id, {
      status: "revoked",
      revokedAt: Date.now(),
    });

    return await ctx.db.get(share._id);
  },
});

/**
 * Increment view count when a share is accessed
 */
export const incrementViewCount = mutation({
  args: {
    shareId: v.string(),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("conversationShares")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!share) {
      throw new ConvexError("SHARE_NOT_FOUND");
    }

    const validity = isShareValid(share);
    if (!validity.valid) {
      // If share is expired due to views, update status
      if (validity.reason === "MAX_VIEWS_REACHED") {
        await ctx.db.patch(share._id, {
          status: "expired",
        });
      }
      throw new ConvexError(validity.reason || "SHARE_INVALID");
    }

    const newCount = share.viewCount + 1;
    const updates: { viewCount: number; status?: "expired" } = {
      viewCount: newCount,
    };

    // Check if this view reaches the max
    if (share.maxViews && newCount >= share.maxViews) {
      updates.status = "expired";
    }

    await ctx.db.patch(share._id, updates);

    return {
      viewCount: newCount,
      maxViews: share.maxViews,
      remaining: share.maxViews ? share.maxViews - newCount : null,
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get a share by ID (validates status and constraints)
 */
export const get = query({
  args: {
    shareId: v.string(),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("conversationShares")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!share) {
      return null;
    }

    // Check validity without modifying state
    const validity = isShareValid(share);

    return {
      ...share,
      isValid: validity.valid,
      invalidReason: validity.reason,
    };
  },
});

/**
 * List all shares for a conversation
 */
export const listByConversation = query({
  args: {
    conversationId: v.string(),
    status: v.optional(
      v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    ),
  },
  handler: async (ctx, args) => {
    let shares = await ctx.db
      .query("conversationShares")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    if (args.status) {
      shares = shares.filter((s) => s.status === args.status);
    }

    // Add validity info to each share
    return shares.map((share) => {
      const validity = isShareValid(share);
      return {
        ...share,
        isValid: validity.valid,
        invalidReason: validity.reason,
      };
    });
  },
});

/**
 * List shares granted by a user
 */
export const listByGranter = query({
  args: {
    grantedBy: v.string(),
    status: v.optional(
      v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    ),
  },
  handler: async (ctx, args) => {
    let shares = await ctx.db
      .query("conversationShares")
      .withIndex("by_grantedBy", (q) => q.eq("grantedBy", args.grantedBy))
      .collect();

    if (args.status) {
      shares = shares.filter((s) => s.status === args.status);
    }

    return shares.map((share) => {
      const validity = isShareValid(share);
      return {
        ...share,
        isValid: validity.valid,
        invalidReason: validity.reason,
      };
    });
  },
});

/**
 * Check if a user/space has access to a conversation via share
 * Returns the best matching share and its permissions
 */
export const checkAccess = query({
  args: {
    conversationId: v.string(),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    emailDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all active shares for this conversation
    const shares = await ctx.db
      .query("conversationShares")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    // Filter to active and valid shares
    const activeShares = shares.filter((share) => {
      const validity = isShareValid(share);
      return validity.valid;
    });

    // Find matching shares
    const matchingShares = activeShares.filter((share) => {
      switch (share.grantType) {
        case "user":
          return args.userId && share.grantedTo === args.userId;
        case "space":
          return args.memorySpaceId && share.grantedTo === args.memorySpaceId;
        case "link":
          // Link shares match anyone
          return true;
        case "domain":
          return args.emailDomain && share.grantedTo === args.emailDomain;
        default:
          return false;
      }
    });

    if (matchingShares.length === 0) {
      return {
        hasAccess: false,
        permissions: null,
        share: null,
        reason: "NO_MATCHING_SHARE",
      };
    }

    // Return the share with the most permissions
    // (For now, just return the first match; could implement permission merging later)
    const bestShare = matchingShares[0];

    return {
      hasAccess: true,
      permissions: bestShare.permissions,
      share: {
        shareId: bestShare.shareId,
        grantType: bestShare.grantType,
        expiresAt: bestShare.expiresAt,
        viewCount: bestShare.viewCount,
        maxViews: bestShare.maxViews,
        redactBefore: bestShare.redactBefore,
        redactSensitive: bestShare.redactSensitive,
      },
      reason: "SHARE_ACCESS",
    };
  },
});
