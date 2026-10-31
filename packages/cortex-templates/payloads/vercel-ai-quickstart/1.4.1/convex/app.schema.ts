/**
 * Convex schema for the quickstart demo
 *
 * This extends the Cortex SDK schema to add any demo-specific tables.
 * The actual memory tables (conversations, memories, facts) come from @cortexmemory/sdk.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  appAccounts: defineTable({
    accountId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
    passwordHash: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    tenantId: v.string(),
    allowedMemorySpaceIds: v.array(v.string()),
    disabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_username", ["username"]),
  appSessions: defineTable({
    sessionDigest: v.string(),
    accountId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_digest", ["sessionDigest"])
    .index("by_account", ["accountId"]),
  appAuthState: defineTable({
    key: v.literal("setup"),
    initialAdminAccountId: v.string(),
    tenantId: v.string(),
    bootstrapComplete: v.boolean(),
  }).index("by_key", ["key"]),
  // Demo session tracking (optional, for demo purposes)
  demoSessions: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    memorySpaceId: v.string(),
    startedAt: v.number(),
    messageCount: v.number(),
  }).index("by_session", ["sessionId"]),
});
