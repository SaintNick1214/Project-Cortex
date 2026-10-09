/**
 * Convex schema for Chat SDK quickstart
 *
 * Note: Cortex SDK tables (conversations, memories, facts, etc.)
 * are automatically available when you deploy with:
 * `npx cortex deploy`
 *
 * This file contains only app-specific tables.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Chat sessions table - tracks chat metadata
  chatSessions: defineTable({
    createdAt: v.number(),
    memorySpaceId: v.string(),
    sessionId: v.string(),
    title: v.optional(v.string()),
    updatedAt: v.number(),
    userId: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_visibility", ["visibility"]),

  // Chat users - Auth.js user records synced to Convex
  chatUsers: defineTable({
    createdAt: v.number(),
    email: v.string(),
    passwordHash: v.optional(v.string()),
  }).index("by_email", ["email"]),

  // Chat votes - tracks user feedback on messages
  chatVotes: defineTable({
    createdAt: v.number(),
    isUpvoted: v.boolean(),
    messageId: v.string(),
    sessionId: v.string(),
    userId: v.string(),
  })
    .index("by_session", ["sessionId"])
    .index("by_message", ["messageId"]),

  // Documents/Artifacts - stores user-created documents
  documents: defineTable({
    content: v.optional(v.string()),
    createdAt: v.number(),
    documentId: v.string(),
    kind: v.string(),
    sessionId: v.string(),
    title: v.string(),
    userId: v.string(),
  })
    .index("by_document", ["documentId"])
    .index("by_session", ["sessionId"]),

  // Suggestions - AI-generated suggestions for documents
  suggestions: defineTable({
    createdAt: v.number(),
    description: v.optional(v.string()),
    documentId: v.string(),
    isResolved: v.boolean(),
    originalText: v.string(),
    suggestedText: v.string(),
    userId: v.string(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_resolved", ["documentId", "isResolved"]),
});
