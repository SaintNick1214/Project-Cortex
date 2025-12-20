/**
 * Convex schema for the quickstart demo
 *
 * This extends the Cortex SDK schema to add any demo-specific tables.
 * The actual memory tables (conversations, memories, facts) come from @cortexmemory/sdk.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Demo session tracking (optional, for demo purposes)
  demoSessions: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    memorySpaceId: v.string(),
    startedAt: v.number(),
    messageCount: v.number(),
  }).index("by_session", ["sessionId"]),
});
