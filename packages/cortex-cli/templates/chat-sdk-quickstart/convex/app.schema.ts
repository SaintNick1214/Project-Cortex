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
  chatUploads: defineTable({
    userId: v.string(),
    tenantId: v.string(),
    memorySpaceId: v.string(),
    attachmentId: v.string(),
    url: v.string(),
    filename: v.string(),
    mimeType: v.string(),
  }).index("by_url", ["url"]),
  documentVersions: defineTable({
    documentId: v.string(),
    userId: v.string(),
    tenantId: v.string(),
    memorySpaceId: v.string(),
    versions: v.array(v.number()),
    selectedVersion: v.optional(v.number()),
  }).index("by_document", ["documentId"]),
  // Current editable branch. SDK history remains a separate immutable audit.
  chatMessages: defineTable({
    messageId: v.string(),
    chatId: v.string(),
    userId: v.string(),
    tenantId: v.string(),
    memorySpaceId: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    parts: v.any(),
    attachments: v.array(v.any()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_message", ["messageId"])
    .index("by_chat", ["chatId"]),
  chatBranches: defineTable({
    chatId: v.string(),
    userId: v.string(),
    tenantId: v.string(),
    memorySpaceId: v.string(),
    edited: v.boolean(),
  }).index("by_chat", ["chatId"]),
  chatStreams: defineTable({
    streamId: v.string(),
    chatId: v.string(),
    userId: v.string(),
    tenantId: v.string(),
    memorySpaceId: v.string(),
    createdAt: v.number(),
  }).index("by_stream", ["streamId"]),
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
    tenantId: v.string(),
    memorySpaceId: v.string(),
    isUpvoted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_message", ["messageId"]),

  // Chat users - Auth.js user records synced to Convex
  chatUsers: defineTable({
    userId: v.string(),
    tenantId: v.string(),
    memorySpaceId: v.string(),
    email: v.string(),
    passwordHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_user", ["userId"]),

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
    suggestionId: v.string(),
    documentCreatedAt: v.number(),
    tenantId: v.string(),
    memorySpaceId: v.string(),
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
