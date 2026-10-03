import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runs: defineTable({
    owner: v.string(), requestId: v.string(), scenario: v.string(), threadId: v.string(), promptMessageId: v.string(),
    status: v.string(), attempt: v.number(), errorCode: v.optional(v.string()), workflowId: v.optional(v.string()),
  }).index("by_request", ["owner", "requestId"]),
  receipts: defineTable({ runId: v.id("runs"), messageId: v.string(), revision: v.number(), stage: v.string() }).index("by_run", ["runId"]),
  tools: defineTable({ runId: v.id("runs"), operationId: v.string(), result: v.number() }).index("by_operation", ["operationId"]),
  operations: defineTable({ owner: v.string(), operationId: v.string(), state: v.string(), attempts: v.number(), effects: v.number() }).index("by_operation", ["operationId"]),
});
