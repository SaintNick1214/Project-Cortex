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
    sessionId: v.string(),
    title: v.optional(v.string()),
    userId: v.string(),
    memorySpaceId: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_visibility", ["visibility"]),

  // Chat votes - tracks user feedback on messages
  chatVotes: defineTable({
    sessionId: v.string(),
    messageId: v.string(),
    userId: v.string(),
    isUpvoted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_message", ["messageId"]),

  // Chat users - Auth.js user records synced to Convex
  chatUsers: defineTable({
    email: v.string(),
    passwordHash: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Documents/Artifacts - stores user-created documents
  documents: defineTable({
    documentId: v.string(),
    sessionId: v.string(),
    userId: v.string(),
    title: v.string(),
    kind: v.string(),
    content: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_session", ["sessionId"]),

  // Suggestions - AI-generated suggestions for documents
  suggestions: defineTable({
    documentId: v.string(),
    originalText: v.string(),
    suggestedText: v.string(),
    description: v.optional(v.string()),
    isResolved: v.boolean(),
    userId: v.string(),
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_resolved", ["documentId", "isResolved"]),
});
