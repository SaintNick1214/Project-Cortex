/**
 * Cortex SDK - Conversation Snapshots API
 *
 * Shareable Chats Phase 3: Immutable Snapshots
 * Creates point-in-time copies of conversations with optional PII redaction
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a unique snapshot ID
 */
function generateSnapshotId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `snap-${timestamp}-${randomPart}`;
}

/**
 * PII patterns for redaction
 */
const PII_PATTERNS = [
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  // Phone numbers (various formats)
  { pattern: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: "[PHONE]" },
  // SSN
  { pattern: /\d{3}[-.\s]?\d{2}[-.\s]?\d{4}/g, replacement: "[SSN]" },
  // Credit card numbers
  { pattern: /\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}/g, replacement: "[CREDIT_CARD]" },
  // IP addresses
  { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, replacement: "[IP_ADDRESS]" },
];

/**
 * Redact PII from text
 */
function redactPII(text: string, customRedactions?: { pattern: string; replacement: string }[]): string {
  let result = text;
  
  // Apply standard PII patterns
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  
  // Apply custom redactions
  if (customRedactions) {
    for (const { pattern, replacement } of customRedactions) {
      try {
        const regex = new RegExp(pattern, "g");
        result = result.replace(regex, replacement);
      } catch {
        // Skip invalid patterns
      }
    }
  }
  
  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a snapshot of a conversation
 */
export const create = mutation({
  args: {
    conversationId: v.string(),
    createdBy: v.string(),
    
    // Redaction options
    redactPII: v.optional(v.boolean()),
    redactBefore: v.optional(v.number()),
    customRedactions: v.optional(v.array(v.object({
      pattern: v.string(),
      replacement: v.string(),
    }))),
    
    // Include options
    includeFacts: v.optional(v.boolean()),
    includeMemories: v.optional(v.boolean()),
    
    // Multi-tenancy
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the source conversation
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();

    if (!conversation) {
      throw new ConvexError("CONVERSATION_NOT_FOUND");
    }

    const now = Date.now();
    const snapshotId = generateSnapshotId();
    
    // Process messages with optional redaction
    let messages = conversation.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      participantId: msg.participantId,
    }));
    
    // Filter messages before timestamp
    if (args.redactBefore) {
      messages = messages.filter(m => m.timestamp >= args.redactBefore!);
    }
    
    // Apply PII redaction if requested
    if (args.redactPII) {
      messages = messages.map(msg => ({
        ...msg,
        content: redactPII(msg.content, args.customRedactions),
      }));
    }
    
    // Get facts if requested (placeholder - would need facts API integration)
    let facts: { factId: string; fact: string; factType: string; confidence: number }[] | undefined;
    if (args.includeFacts) {
      // This would integrate with the facts API
      facts = [];
    }

    const id = await ctx.db.insert("conversationSnapshots", {
      snapshotId,
      conversationId: args.conversationId,
      messages,
      conversationType: conversation.type,
      participants: conversation.participants,
      messageCount: messages.length,
      includedContent: {
        messages: true,
        facts: args.includeFacts ?? false,
        memories: args.includeMemories ?? false,
      },
      redaction: {
        piiRedacted: args.redactPII ?? false,
        messagesRedactedBefore: args.redactBefore,
        customRedactions: args.customRedactions,
      },
      facts,
      createdBy: args.createdBy,
      memorySpaceId: conversation.memorySpaceId,
      tenantId: args.tenantId,
      status: "active",
      createdAt: now,
      snapshotOf: conversation.updatedAt,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Delete a snapshot (soft delete)
 */
export const deleteSnapshot = mutation({
  args: {
    snapshotId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("conversationSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .first();

    if (!snapshot) {
      throw new ConvexError("SNAPSHOT_NOT_FOUND");
    }

    // Optional: verify ownership
    if (args.userId && snapshot.createdBy !== args.userId) {
      throw new ConvexError("DELETE_NOT_AUTHORIZED");
    }

    await ctx.db.patch(snapshot._id, {
      status: "deleted",
    });

    return { deleted: true, snapshotId: args.snapshotId };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get a snapshot by ID
 */
export const get = query({
  args: {
    snapshotId: v.string(),
  },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("conversationSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .first();

    if (!snapshot || snapshot.status === "deleted") {
      return null;
    }

    return snapshot;
  },
});

/**
 * List snapshots for a conversation
 */
export const listByConversation = query({
  args: {
    conversationId: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("conversationSnapshots")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    return snapshots.filter(s => {
      if (s.status === "deleted") return false;
      if (!args.includeArchived && s.status === "archived") return false;
      return true;
    });
  },
});

/**
 * List snapshots created by a user
 */
export const listByUser = query({
  args: {
    userId: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("conversationSnapshots")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", args.userId))
      .collect();

    return snapshots.filter(s => {
      if (s.status === "deleted") return false;
      if (!args.includeArchived && s.status === "archived") return false;
      return true;
    });
  },
});
