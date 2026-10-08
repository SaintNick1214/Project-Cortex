import { graphMutation } from "./lib/graphSync";
import {validateDomainSelection} from "./lib/domainPaging";
import type { Doc } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { domainGraphIdentity, scopedConversation, conversationFilterFields, matchesConversation, domainFingerprint, checkFingerprint, domainBudget, domainPageOptions, domainInteger } from "./lib/domainPaging";
import { captureInsertedRow, reconcileRow, markDeletedRow } from "./lib/referenceLifecycle";
import { validateDomainScope } from "./lib/domainScope";
/**
 * Cortex SDK - Conversations API (Layer 1a)
 *
 * ACID-compliant immutable conversation storage
 * memorySpace-scoped with participantId tracking (Hive Mode)
 * Two types: user-agent, agent-agent (Collaboration Mode)
 */

import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Determine if a user is the owner of a conversation.
 * Handles both traditional single-user and collaborative multi-user conversations.
 * 
 * Ownership priority:
 * 1. collaborativeSettings.ownerUserId (explicit owner for collaborative)
 * 2. participants.userId (traditional single-user ownership)
 * 3. First user in participants.userIds (implicit owner for collaborative)
 */
/**
 * Get the owner userId for a conversation, following the ownership hierarchy:
 * 1. Explicit collaborativeSettings.ownerUserId
 * 2. Traditional single-user participants.userId
 * 3. First user in participants.userIds (implicit owner for collaborative)
 */
function getOwnerUserId(
  conversation: {
    participants: {
      userId?: string;
      userIds?: string[];
    };
    collaborativeSettings?: {
      ownerUserId?: string;
    };
  }
): string | undefined {
  // Check explicit collaborative owner first
  if (conversation.collaborativeSettings?.ownerUserId) {
    return conversation.collaborativeSettings.ownerUserId;
  }
  
  // Check traditional single-user ownership
  if (conversation.participants.userId) {
    return conversation.participants.userId;
  }
  
  // Check collaborative userIds (first user is implicit owner)
  if (conversation.participants.userIds && conversation.participants.userIds.length > 0) {
    return conversation.participants.userIds[0];
  }
  
  return undefined;
}

function isConversationOwner(
  conversation: {
    participants: {
      userId?: string;
      userIds?: string[];
    };
    collaborativeSettings?: {
      ownerUserId?: string;
    };
  },
  userId: string | undefined
): boolean {
  if (!userId) return false;
  return getOwnerUserId(conversation) === userId;
}

/**
 * Check if a user is a participant in a conversation (owner or collaborator)
 */
function isConversationParticipant(
  conversation: {
    participants: {
      userId?: string;
      userIds?: string[];
    };
    collaborativeSettings?: {
      ownerUserId?: string;
      approvedParticipants?: string[];
    };
  },
  userId: string | undefined
): boolean {
  if (!userId) return false;
  
  // Check if owner
  if (isConversationOwner(conversation, userId)) return true;
  
  // Check if in userIds array
  if (conversation.participants.userIds?.includes(userId)) return true;
  
  // Check if in approved participants
  if (conversation.collaborativeSettings?.approvedParticipants?.includes(userId)) return true;
  
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new conversation
 */
export const create = graphMutation({
  args: {
    conversationId: v.string(),
    memorySpaceId: v.string(), // NEW: Required - which memory space owns this
    participantId: v.optional(v.string()), // NEW: Hive Mode participant tracking
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.object({
      userId: v.optional(v.string()), // The human user in the conversation
      agentId: v.optional(v.string()), // The agent/assistant in the conversation
      userIds: v.optional(v.array(v.string())), // Collaborative: multiple human users (Phase 4)
      participantId: v.optional(v.string()), // Hive Mode: who created this
      memorySpaceIds: v.optional(v.array(v.string())), // Collaboration Mode: cross-space
    }),
    metadata: v.optional(v.any()),
    // Visibility for shareable chats (Phase 1)
    visibility: v.optional(
      v.union(v.literal("private"), v.literal("space"), v.literal("public")),
    ),
    // Collaborative settings (Phase 4)
    collaborativeSettings: v.optional(
      v.object({
        requireApproval: v.boolean(),
        ownerUserId: v.optional(v.string()),
        approvedParticipants: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Validate participants based on type
    if (args.type === "user-agent") {
      // Check for collaborative (userIds) OR single user (userId)
      const hasUsers = args.participants.userIds && args.participants.userIds.length > 0;
      const hasSingleUser = !!args.participants.userId;
      
      if (!hasUsers && !hasSingleUser) {
        throw new ConvexError("user-agent conversations require userId or userIds");
      }
      // v0.17.0: User-agent conversations require agentId
      if (!args.participants.agentId) {
        throw new ConvexError(
          "agentId is required. User-agent conversations require an agent participant.",
        );
      }
    } else if (args.type === "agent-agent") {
      if (
        !args.participants.memorySpaceIds ||
        args.participants.memorySpaceIds.length < 2
      ) {
        throw new ConvexError(
          "agent-agent conversations require at least 2 memorySpaceIds",
        );
      }
    }

    // The omitted tenant is an exact tenantless scope, not a wildcard.
    const candidates = await ctx.db.query("conversations")
      .withIndex("by_conversationId", q => q.eq("conversationId", args.conversationId))
      .filter(q => q.eq(q.field("tenantId"), args.tenantId)).take(2);
    if (candidates.length > 1) throw new ConvexError("CONVERSATION_SCOPE_AMBIGUOUS");
    if (candidates.length) throw new ConvexError("CONVERSATION_ALREADY_EXISTS");

    const now = Date.now();

    // Create conversation with tenantId, visibility, and collaborative settings
    const id = await captureInsertedRow(ctx, "conversations", {
      conversationId: args.conversationId,
      memorySpaceId: args.memorySpaceId,
      participantId: args.participantId,
      tenantId: args.tenantId, // Store tenantId
      type: args.type,
      participants: args.participants,
      messages: [],
      messageCount: 0,
      metadata: args.metadata || {},
      createdAt: now,
      updatedAt: now,
      visibility: args.visibility, // Default undefined = 'private'
      collaborativeSettings: args.collaborativeSettings, // Phase 4: Collaborative
    });

    return await ctx.db.get(id);
  },
});

/**
 * Set visibility for a conversation
 */
export const setVisibility = graphMutation({
  args: {
    conversationId: v.string(),
    visibility: v.union(
      v.literal("private"),
      v.literal("space"),
      v.literal("public"),
    ),
    // For authorization - caller must provide their userId to verify ownership
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    // Verify ownership: only the owner can change visibility
    // Handles both traditional (userId) and collaborative (userIds/ownerUserId) conversations
    if (args.userId && !isConversationOwner(conversation, args.userId)) {
      throw new ConvexError("VISIBILITY_CHANGE_NOT_AUTHORIZED");
    }

    await reconcileRow(ctx, conversation._id, {
      visibility: args.visibility,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(conversation._id);
  },
});

/**
 * Set or update metadata for a conversation
 * This is used for storing conversation title and other metadata
 */
export const setMetadata = graphMutation({
  args: {
    conversationId: v.string(),
    metadata: v.any(),
    // Required for authorization - must verify ownership before modifying metadata
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    // Verify ownership: only the owner can change metadata
    if (!isConversationOwner(conversation, args.userId)) {
      throw new ConvexError("METADATA_CHANGE_NOT_AUTHORIZED");
    }

    // Merge new metadata with existing metadata
    const updatedMetadata = {
      ...(conversation.metadata || {}),
      ...args.metadata,
    };

    await reconcileRow(ctx, conversation._id, {
      metadata: updatedMetadata,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(conversation._id);
  },
});

/**
 * Check access to a conversation based on visibility
 * Returns access info without returning the full conversation data
 */
export const checkAccess = query({
  args: {
    conversationId: v.string(),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      return {
        canView: false,
        canEdit: false,
        reason: "CONVERSATION_NOT_FOUND",
        visibility: null,
      };
    }

    const visibility = conversation.visibility || "private";
    // Use helper to properly determine ownership for both traditional and collaborative conversations
    const isOwner = isConversationOwner(conversation, args.userId);
    const isParticipant = isConversationParticipant(conversation, args.userId);
    const isInSpace = conversation.memorySpaceId === args.memorySpaceId;

    // Determine access based on visibility
    let canView = false;
    let canEdit = false;
    let reason = "";

    if (isOwner) {
      // Owner always has full access
      canView = true;
      canEdit = true;
      reason = "OWNER";
    } else if (isParticipant) {
      // Participants (collaborative members) can view and contribute
      canView = true;
      canEdit = true; // Participants can add messages (subject to approval workflow)
      reason = "PARTICIPANT";
    } else if (visibility === "public") {
      // Public conversations: anyone can view, only owner can edit
      canView = true;
      canEdit = false;
      reason = "PUBLIC_VISIBILITY";
    } else if (visibility === "space" && isInSpace) {
      // Space visibility: space members can view, only owner can edit
      canView = true;
      canEdit = false;
      reason = "SPACE_MEMBER";
    } else {
      // Private or not in space
      canView = false;
      canEdit = false;
      reason =
        visibility === "private"
          ? "PRIVATE_VISIBILITY"
          : "NOT_IN_MEMORY_SPACE";
    }

    return {
      canView,
      canEdit,
      reason,
      visibility,
    };
  },
});

/**
 * Add a message to an existing conversation (append-only)
 */
export const addMessage = graphMutation({
  args: {
    conversationId: v.string(),
    message: v.object({
      id: v.string(),
      role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
      content: v.string(),
      participantId: v.optional(v.string()), // Hive Mode/Collaborative: which participant sent this
      metadata: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    // Get conversation
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    // Determine approval status for collaborative conversations (Phase 4)
    let approvalStatus: "pending" | "approved" | undefined;
    const settings = conversation.collaborativeSettings;
    
    if (settings?.requireApproval && args.message.role === "user") {
      const participantId = args.message.participantId;
      const approvedParticipants = settings.approvedParticipants || [];
      
      // Check if participant is owner or pre-approved
      // Use isConversationOwner helper to guard against undefined === undefined
      const isOwner = isConversationOwner(conversation, participantId);
      const isApproved = approvedParticipants.includes(participantId || "");
      
      if (!isOwner && !isApproved) {
        approvalStatus = "pending";
      } else {
        approvalStatus = "approved";
      }
    }

    // Create message with timestamp and optional approval status
    const message = {
      ...args.message,
      timestamp: Date.now(),
      ...(approvalStatus && { approvalStatus }),
    };

    // Append message (immutable - never modify existing messages)
    await reconcileRow(ctx, conversation._id, {
      messages: [...conversation.messages, message],
      messageCount: conversation.messageCount + 1,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(conversation._id);
  },
});

/**
 * Approve a pending message in a collaborative conversation (Phase 4)
 */
export const approveMessage = graphMutation({
  args: {
    conversationId: v.string(),
    messageId: v.string(),
    approverId: v.string(), // userId of the approver
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    // Verify approver is the owner (use helper to handle userIds[0] as implicit owner)
    const ownerUserId = getOwnerUserId(conversation);
    
    if (args.approverId !== ownerUserId) {
      throw new ConvexError("APPROVE_NOT_AUTHORIZED");
    }

    // Find and update the message
    const messageIndex = conversation.messages.findIndex(
      (m) => m.id === args.messageId
    );
    
    if (messageIndex === -1) {
      throw new ConvexError("MESSAGE_NOT_FOUND");
    }

    const message = conversation.messages[messageIndex];
    if (message.approvalStatus !== "pending") {
      throw new ConvexError("MESSAGE_NOT_PENDING");
    }

    // Update message with approval
    const updatedMessages = [...conversation.messages];
    updatedMessages[messageIndex] = {
      ...message,
      approvalStatus: "approved",
      approvedBy: args.approverId,
      approvedAt: Date.now(),
    };

    await reconcileRow(ctx, conversation._id, {
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(conversation._id);
  },
});

/**
 * Reject a pending message in a collaborative conversation (Phase 4)
 */
export const rejectMessage = graphMutation({
  args: {
    conversationId: v.string(),
    messageId: v.string(),
    rejecterId: v.string(), // userId of the rejecter
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    // Verify rejecter is the owner (use helper to handle userIds[0] as implicit owner)
    const ownerUserId = getOwnerUserId(conversation);
    
    if (args.rejecterId !== ownerUserId) {
      throw new ConvexError("REJECT_NOT_AUTHORIZED");
    }

    // Find and update the message
    const messageIndex = conversation.messages.findIndex(
      (m) => m.id === args.messageId
    );
    
    if (messageIndex === -1) {
      throw new ConvexError("MESSAGE_NOT_FOUND");
    }

    const message = conversation.messages[messageIndex];
    if (message.approvalStatus !== "pending") {
      throw new ConvexError("MESSAGE_NOT_PENDING");
    }

    // Update message with rejection
    const updatedMessages = [...conversation.messages];
    updatedMessages[messageIndex] = {
      ...message,
      approvalStatus: "rejected",
      approvedBy: args.rejecterId,
      approvedAt: Date.now(),
    };

    await reconcileRow(ctx, conversation._id, {
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(conversation._id);
  },
});

/**
 * Delete a conversation (for GDPR/cleanup)
 */
export const deleteConversation = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await scopedConversation(ctx, args);

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    const messagesDeleted = conversation.messageCount;

    await markDeletedRow(ctx, conversation._id);

    return {
      deleted: true,
      conversationId: args.conversationId,
      messagesDeleted,
      deletedAt: Date.now(),
      restorable: false, // Conversations are permanently deleted
    };
  },
});

/**
 * Delete many conversations matching filters
 */
export const deleteMany = graphMutation({
  args: {...conversationFilterFields, dryRun: v.optional(v.boolean()), requireConfirmation: v.optional(v.boolean()), confirmationThreshold: v.optional(v.number())},
  handler: async () => { throw new ConvexError("DOMAIN_PREFLIGHT_REQUIRED: use SDK physical selection preflight"); },
});

/**
 * Delete multiple conversations by their IDs (batch delete for cascade operations)
 * Much faster than calling deleteConversation multiple times
 * Uses index lookups instead of full table scan to avoid memory issues with large tables
 */
export const deleteByIds = graphMutation({
  args: {
    conversationIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const deletedIds: string[] = [];
    let totalMessagesDeleted = 0;

    // Look up each conversation by index to avoid full table scan
    // This is O(n) index lookups vs O(entire table) memory usage
    for (const conversationId of args.conversationIds) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", conversationId),
        )
        .first();

      if (conversation) {
        totalMessagesDeleted += conversation.messageCount;
        await markDeletedRow(ctx, conversation._id);
        deletedIds.push(conversationId);
      }
    }

    return {
      deleted: deletedIds.length,
      conversationIds: deletedIds,
      totalMessagesDeleted,
    };
  },
});

/**
 * Purge ALL conversations (development/testing only)
 */
export const purgeAll = graphMutation({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db.query("conversations").collect();

    let deleted = 0;
    let totalMessagesDeleted = 0;

    for (const conversation of conversations) {
      totalMessagesDeleted += conversation.messageCount;
      await markDeletedRow(ctx, conversation._id);
      deleted++;
    }

    return {
      deleted,
      totalMessagesDeleted,
    };
  },
});

/**
 * Get a specific message by ID from a conversation
 */
export const getMessage = query({
  args: {
    conversationId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      return null;
    }

    const message = conversation.messages.find((m) => m.id === args.messageId);

    return message || null;
  },
});

/**
 * Get multiple messages by their IDs
 */
export const getMessagesByIds = query({
  args: {
    conversationId: v.string(),
    messageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .first();

    if (!conversation) {
      return [];
    }

    const messages = conversation.messages.filter((m) =>
      args.messageIds.includes(m.id),
    );

    return messages;
  },
});

/**
 * Get or create a conversation (atomic)
 */
export const getOrCreate = graphMutation({
  args: {
    memorySpaceId: v.string(), // NEW: Required
    participantId: v.optional(v.string()), // NEW: Hive Mode
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.object({
      userId: v.optional(v.string()), // The human user in the conversation
      agentId: v.optional(v.string()), // v0.17.0: Required for user-agent conversations
      userIds: v.optional(v.array(v.string())), // Collaborative: multiple human users (Phase 4)
      participantId: v.optional(v.string()), // Hive Mode: who created this
      memorySpaceIds: v.optional(v.array(v.string())), // Collaboration Mode: cross-space
    }),
    metadata: v.optional(v.any()),
    // Visibility for shareable chats (Phase 1)
    visibility: v.optional(
      v.union(v.literal("private"), v.literal("space"), v.literal("public")),
    ),
    // Collaborative settings (Phase 4)
    collaborativeSettings: v.optional(
      v.object({
        requireApproval: v.boolean(),
        ownerUserId: v.optional(v.string()),
        approvedParticipants: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Try to find existing
    let existing = null;

    if (args.type === "user-agent") {
      // Check for collaborative (userIds) OR single user (userId)
      const hasUsers = args.participants.userIds && args.participants.userIds.length > 0;
      const hasSingleUser = !!args.participants.userId;
      
      if (!hasUsers && !hasSingleUser) {
        throw new ConvexError("user-agent conversations require userId or userIds");
      }
      // v0.17.0: User-agent conversations require agentId
      if (!args.participants.agentId) {
        throw new ConvexError(
          "agentId is required. User-agent conversations require both a user and an agent participant.",
        );
      }

      // For collaborative conversations with userIds, use the first user for lookup
      const primaryUserId = args.participants.userId || args.participants.userIds?.[0];

      // Look for existing in this memory space with this user AND agent
      // v0.17.0: Must match agentId to support multiple agents per user/space
      const candidates = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace_user", (q) =>
          q
            .eq("memorySpaceId", args.memorySpaceId!)
            .eq("participants.userId", primaryUserId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("tenantId"), undefined),
            q.eq(q.field("type"), "user-agent"),
            q.eq(q.field("participants.agentId"), args.participants.agentId),
          ),
        )
        .take(2);
      if (candidates.length > 1) throw new ConvexError("CONVERSATION_SCOPE_AMBIGUOUS");
      existing = candidates[0] ?? null;
    } else {
      // agent-agent (Collaboration Mode)
      if (
        !args.participants.memorySpaceIds ||
        args.participants.memorySpaceIds.length < 2
      ) {
        throw new ConvexError(
          "agent-agent conversations require at least 2 memorySpaceIds",
        );
      }

      const conversations = await ctx.db
        .query("conversations")
        .filter((q) => q.and(q.eq(q.field("tenantId"), undefined), q.eq(q.field("type"), "agent-agent")))
        .collect();

      const sortedInput = [...args.participants.memorySpaceIds].sort();

      const matches = conversations.filter((c) => {
          if (!c.participants.memorySpaceIds) {
            return false;
          }
          const sorted = [...c.participants.memorySpaceIds].sort();

          return (
            sorted.length === sortedInput.length &&
            sorted.every((id, i) => id === sortedInput[i])
          );
        });
      if (matches.length > 1) throw new ConvexError("CONVERSATION_SCOPE_AMBIGUOUS");
      existing = matches[0] ?? null;
    }

    if (existing) {
      return existing;
    }

    // Create new
    const now = Date.now();
    const conversationId = `conv-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await captureInsertedRow(ctx, "conversations", {
      conversationId,
      memorySpaceId: args.memorySpaceId,
      participantId: args.participantId,
      type: args.type,
      participants: args.participants,
      messages: [],
      messageCount: 0,
      metadata: args.metadata || {},
      createdAt: now,
      updatedAt: now,
      visibility: args.visibility, // Default undefined = 'private'
      collaborativeSettings: args.collaborativeSettings, // Phase 4: collaborative conversations
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Find an existing conversation by participants
 */
export const findConversation = query({
  args: {
    memorySpaceId: v.string(), // NEW: Required
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    userId: v.optional(v.string()),
    memorySpaceIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.type === "user-agent") {
      if (!args.userId) {
        return null;
      }

      // Find user-agent conversation in this memory space
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace_user", (q) =>
          q
            .eq("memorySpaceId", args.memorySpaceId!)
            .eq("participants.userId", args.userId),
        )
        .filter((q) => q.eq(q.field("type"), "user-agent"))
        .first();

      return conversation || null;
    }
    // agent-agent conversation (Collaboration Mode)
    if (!args.memorySpaceIds || args.memorySpaceIds.length < 2) {
      return null;
    }

    // Find by matching memorySpaceIds array
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("type"), "agent-agent"))
      .collect();

    // Find conversation with exact same memory spaces (any order)
    const sortedInput = [...args.memorySpaceIds].sort();
    const found = conversations.find((c) => {
      if (!c.participants.memorySpaceIds) {
        return false;
      }
      const sorted = [...c.participants.memorySpaceIds].sort();

      return (
        sorted.length === sortedInput.length &&
        sorted.every((id, i) => id === sortedInput[i])
      );
    });

    return found || null;
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get a single conversation by ID
 */
export const get = query({
  args: {
    conversationId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy: filter by tenant
    includeMessages: v.optional(v.boolean()), // Default: true
    messageLimit: v.optional(v.number()), // Limit messages returned
  },
  handler: async (ctx, args) => {
    const conversation = await scopedConversation(ctx, args);

    if (!conversation) {
      return null;
    }

    // Tenant isolation: if tenantId provided, verify it matches
    if (args.tenantId && conversation.tenantId !== args.tenantId) {
      return null; // Return null if tenant doesn't match (access denied)
    }

    // Handle includeMessages option
    const includeMessages = args.includeMessages !== false; // Default: true

    if (!includeMessages) {
      // Return conversation without messages
      return {
        ...conversation,
        messages: [],
      };
    }

    // Handle messageLimit option
    if (args.messageLimit !== undefined) {
      return {
        ...conversation,
        messages: args.messageLimit === 0 ? [] : conversation.messages.slice(-domainInteger(args.messageLimit, 0)),
      };
    }

    return conversation;
  },
});

/**
 * List conversations with filters and pagination metadata
 */
export const list = query({
  args: {...conversationFilterFields, limit: v.optional(v.number()), offset: v.optional(v.number()), sortBy: v.optional(v.union(v.literal("createdAt"), v.literal("updatedAt"), v.literal("lastMessageAt"), v.literal("messageCount"))), sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))), includeMessages: v.optional(v.boolean())},
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    const scan = await ctx.db.query("conversations").withIndex("by_tenantId", q => q.eq("tenantId", args.tenantId)).take(257);
    await domainBudget(ctx, scan);
    const filtered = scan.filter(row => matchesConversation(row, args));
    const key = (c: Doc<"conversations">) => args.sortBy === "lastMessageAt" ? c.messages[c.messages.length - 1]?.timestamp ?? c.createdAt : args.sortBy === "updatedAt" ? c.updatedAt : args.sortBy === "messageCount" ? c.messageCount : c.createdAt;
    filtered.sort((a, b) => (key(a) - key(b)) * (args.sortOrder === "asc" ? 1 : -1));
    const offset = domainInteger(args.offset, 0), limit = domainInteger(args.limit, 50);
    const conversations = filtered.slice(offset, offset + limit).map(c => args.includeMessages ? c : {...c, messages: []});
    return {conversations, total: filtered.length, limit, offset, hasMore: offset + limit < filtered.length};
  },
});

/**
 * Count conversations
 */
export const count = query({
  args: {
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // NEW
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
  },
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId);
    const conversations = await ctx.db.query("conversations").withIndex("by_tenantId", q => q.eq("tenantId", args.tenantId)).collect();

    let filtered = conversations;
    if (args.memorySpaceId !== undefined) filtered = filtered.filter(c => c.memorySpaceId === args.memorySpaceId);

    if (args.userId) {
      filtered = filtered.filter((c) => c.participants.userId === args.userId);
    }

    if (args.type) {
      filtered = filtered.filter((c) => c.type === args.type);
    }

    return filtered.length;
  },
});

/**
 * Get paginated message history from a conversation
 */
export const getHistory = query({
  args: {
    tenantId: v.optional(v.string()),
    conversationId: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    since: v.optional(v.number()), // Messages after timestamp
    until: v.optional(v.number()), // Messages before timestamp
    roles: v.optional(
      v.array(
        v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
      ),
    ), // Filter by role
  },
  handler: async (ctx, args) => {
    validateDomainSelection(args);
    const conversation = await scopedConversation(ctx, args);

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    const limit = domainInteger(args.limit, 50);
    const offset = domainInteger(args.offset, 0);
    const sortOrder = args.sortOrder || "asc";

    // Get messages (already sorted in storage as append-only)
    let messages = [...conversation.messages];

    // Apply date filters
    if (args.since !== undefined) {
      messages = messages.filter((m) => m.timestamp >= args.since!);
    }
    if (args.until !== undefined) {
      messages = messages.filter((m) => m.timestamp <= args.until!);
    }

    // Apply role filter
    if (args.roles && args.roles.length > 0) {
      messages = messages.filter((m) => args.roles!.includes(m.role));
    }

    // Get total after filtering (for accurate pagination)
    const filteredTotal = messages.length;

    // Reverse if descending (newest first)
    if (sortOrder === "desc") {
      messages = messages.reverse();
    }

    // Paginate
    const paginatedMessages = messages.slice(offset, offset + limit);

    return {
      messages: paginatedMessages,
      total: filteredTotal,
      hasMore: offset + limit < filteredTotal,
      conversationId: conversation.conversationId,
    };
  },
});

/**
 * Search conversations by text query
 */
export const search = query({
  args: {
    query: v.string(),
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Filter by memory space
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    limit: v.optional(v.number()),
    searchIn: v.optional(
      v.union(v.literal("content"), v.literal("metadata"), v.literal("both")),
    ), // Default: "content"
    matchMode: v.optional(
      v.union(v.literal("contains"), v.literal("exact"), v.literal("fuzzy")),
    ), // Default: "contains"
  },
  handler: async (ctx, args) => {
    // Get conversations (use index if memorySpace provided)
    let allConversations;

    if (args.memorySpaceId) {
      allConversations = await ctx.db
        .query("conversations")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else {
      allConversations = await ctx.db.query("conversations").collect();
    }

    const searchQuery = args.query.toLowerCase();
    const searchIn = args.searchIn || "content";
    const matchMode = args.matchMode || "contains";

    // Helper for matching based on mode
    const matchText = (text: string, query: string): boolean => {
      const lowerText = text.toLowerCase();
      switch (matchMode) {
        case "exact":
          return lowerText === query;
        case "fuzzy":
          // Simple fuzzy: all words in query must appear in text
          const words = query.split(/\s+/).filter((w) => w.length > 0);
          return words.every((word) => lowerText.includes(word));
        default: // contains
          return lowerText.includes(query);
      }
    };

    const results: Array<{
      conversation: unknown;
      matchedMessages: unknown[];
      highlights: string[];
      score: number;
    }> = [];

    for (const conversation of allConversations) {
      // Apply filters
      if (args.type && conversation.type !== args.type) {
        continue;
      }
      if (args.userId && conversation.participants.userId !== args.userId) {
        continue;
      }
      if (args.dateStart && conversation.createdAt < args.dateStart) {
        continue;
      }
      if (args.dateEnd && conversation.createdAt > args.dateEnd) {
        continue;
      }

      let matchedMessages: any[] = [];
      let metadataMatch = false;

      // Search in message content
      if (searchIn === "content" || searchIn === "both") {
        matchedMessages = conversation.messages.filter((msg: any) =>
          matchText(msg.content, searchQuery),
        );
      }

      // Search in metadata
      if (searchIn === "metadata" || searchIn === "both") {
        const metadataStr = JSON.stringify(conversation.metadata || {});
        metadataMatch = matchText(metadataStr, searchQuery);
      }

      if (matchedMessages.length > 0 || metadataMatch) {
        // Calculate score based on matches
        let score = 0;
        if (matchedMessages.length > 0 && conversation.messageCount > 0) {
          score = matchedMessages.length / conversation.messageCount;
        }
        if (metadataMatch) {
          score += 0.5; // Bonus for metadata match
        }

        // Extract highlights from matched messages
        const highlights = matchedMessages.slice(0, 3).map((msg: any) => {
          const { content } = msg;
          const index = content.toLowerCase().indexOf(searchQuery);
          if (index === -1) {
            // For fuzzy matches, return beginning of content
            return (
              content.substring(0, 60) + (content.length > 60 ? "..." : "")
            );
          }
          const start = Math.max(0, index - 30);
          const end = Math.min(content.length, index + searchQuery.length + 30);
          return content.substring(start, end);
        });

        results.push({
          conversation,
          matchedMessages,
          highlights,
          score,
        });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = results.slice(0, args.limit || 10);

    return limited;
  },
});

/**
 * Export conversations to JSON or CSV
 */
export const exportConversations = query({
  args: {
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // NEW: Filter by memory space
    conversationIds: v.optional(v.array(v.string())),
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeMetadata: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    let conversations = await ctx.db.query("conversations").withIndex("by_tenantId", q => q.eq("tenantId", args.tenantId)).take(257);
    await domainBudget(ctx, conversations);

    // Apply filters
    if (args.conversationIds && args.conversationIds.length > 0) {
      conversations = conversations.filter((c) =>
        args.conversationIds!.includes(c.conversationId),
      );
    }

    if (args.userId) {
      conversations = conversations.filter(
        (c) => c.participants.userId === args.userId,
      );
    }

    if (args.type) {
      conversations = conversations.filter((c) => c.type === args.type);
    }

    if (args.dateStart) {
      conversations = conversations.filter(
        (c) => c.createdAt >= args.dateStart!,
      );
    }

    if (args.dateEnd) {
      conversations = conversations.filter((c) => c.createdAt <= args.dateEnd!);
    }

    // Format data
    if (args.format === "json") {
      const data = conversations.map((c) => {
        const exported: unknown = {
          conversationId: c.conversationId,
          type: c.type,
          participants: c.participants,
          messages: c.messages,
          messageCount: c.messageCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };

        if (args.includeMetadata && c.metadata) {
          (exported as any).metadata = c.metadata;
        }

        return exported;
      });

      return {
        format: "json",
        data: JSON.stringify(data, null, 2),
        count: conversations.length,
        exportedAt: Date.now(),
      };
    }
    // CSV format
    const headers = [
      "conversationId",
      "type",
      "participants",
      "messageCount",
      "createdAt",
      "updatedAt",
    ];

    if (args.includeMetadata) {
      headers.push("metadata");
    }

    const rows = conversations.map((c) => {
      const row = [
        c.conversationId,
        c.type,
        JSON.stringify(c.participants),
        c.messageCount.toString(),
        new Date(c.createdAt).toISOString(),
        new Date(c.updatedAt).toISOString(),
      ];

      if (args.includeMetadata) {
        row.push(JSON.stringify(c.metadata || {}));
      }

      return row.join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    return {
      format: "csv",
      data: csv,
      count: conversations.length,
      exportedAt: Date.now(),
    };
  },
});

export const domainPage = query({
  args: {...conversationFilterFields, paginationOpts: paginationOptsValidator},
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    const selected = args.memorySpaceId !== undefined
      ? ctx.db.query("conversations").withIndex("by_tenant_space", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId!))
      : ctx.db.query("conversations").withIndex("by_tenantId", q => q.eq("tenantId", args.tenantId));
    const scan = await selected.order("desc").paginate(domainPageOptions(args.paginationOpts));
    const page = scan.pageStatus === "SplitRequired" ? [] : scan.page.filter(row => matchesConversation(row, args));
    const result = {...scan, page, fingerprints: Object.fromEntries(page.map(row => [row._id, domainFingerprint(row)]))};
    await domainBudget(ctx, result); return result;
  },
});
export const eraseSelected = graphMutation({
  args: {tenantId: v.optional(v.string()), physicalId: v.id("conversations"), expectedFingerprint: v.string()},
  handler: async (ctx, args) => {
    validateDomainScope(args.tenantId); validateDomainSelection(args);
    const row = await ctx.db.get(args.physicalId);
    if (!row) return {deleted: false, alreadyAbsent: true, conversationId: "", physicalId: args.physicalId, messagesDeleted: 0};
    if (row.tenantId !== args.tenantId) throw new ConvexError("DOMAIN_SELECTION_CHANGED");
    checkFingerprint(row, args.expectedFingerprint); const graphIdentity = await domainGraphIdentity(ctx, "conversations", row); await markDeletedRow(ctx, row._id);
    return {deleted: true, conversationId: row.conversationId, physicalId: row._id, graphIdentity, messagesDeleted: row.messageCount, deletedAt: Date.now(), restorable: false};
  },
});
