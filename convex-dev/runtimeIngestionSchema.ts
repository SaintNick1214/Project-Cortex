import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { sourceLineage, embeddingProfile } from "./runtimeMemorySchema";
export const ingestionStage = v.union(v.literal("extract"), v.literal("facts"), v.literal("vectors"));
export const ingestionEligibility = v.union(v.literal("eligible"), v.literal("awaiting_approval"), v.literal("awaiting_tool"),
  v.literal("ineligible"), v.literal("superseded"), v.literal("tombstoned"));
export const ingestionStageState = v.union(v.literal("pending"), v.literal("running"), v.literal("complete"),
  v.literal("failed"), v.literal("unknown"), v.literal("dead_letter"), v.literal("skipped"));
const scope = { tenantId: v.string(), memorySpaceId: v.string() };
export const runtimeIngestionTables = {
  runtimeIngestionScopes: defineTable({ ...scope, sequence: v.number(), factsThrough: v.number(), vectorsThrough: v.number(),
    graphThrough: v.number(), vectorProfileThrough: v.optional(v.record(v.string(), v.number())), version: v.number(), updatedAt: v.number() }).index("by_scope", ["tenantId", "memorySpaceId"]),
  runtimeIngestionEvents: defineTable({ ...scope, version: v.literal(1), eventId: v.string(), identityCanonical: v.string(),
    ownerPrincipalId: v.string(), sequence: v.number(), lineage: sourceLineage, contentHash: v.string(),
    authorityReference: runtimeAuthorityReference, eligibility: ingestionEligibility, factsState: ingestionStageState, vectorsState: ingestionStageState, extractionVersion: v.string(), beliefVersion: v.string(), profile: embeddingProfile, vectorProfilesComplete: v.optional(v.array(v.string())),
    conversationId: v.optional(v.string()), conversationSequence: v.optional(v.number()), conversationEpoch: v.optional(v.number()),
    nativeMessageId: v.optional(v.string()), runId: v.optional(v.string()), toolOperationId: v.optional(v.string()),
    createdAt: v.number(), updatedAt: v.number() })
    .index("by_event", ["tenantId", "memorySpaceId", "eventId"])
    .index("by_scope_sequence", ["tenantId", "memorySpaceId", "sequence"])
    .index("by_owner_sequence", ["tenantId", "memorySpaceId", "ownerPrincipalId", "sequence"])
    .index("by_source", ["tenantId", "memorySpaceId", "lineage.sourceId", "lineage.sourceRevision"])
    .index("by_source_eligibility", ["tenantId", "memorySpaceId", "lineage.sourceId", "eligibility"])
    .index("by_conversation_sequence", ["tenantId", "memorySpaceId", "conversationId", "sequence"]),
  runtimeIngestionStages: defineTable({ ...scope, eventId: v.string(), stage: ingestionStage, state: ingestionStageState,
    attempt: v.number(), leaseVersion: v.number(), leaseExpiresAt: v.optional(v.number()),
    policyCanonical: v.optional(v.string()), receiptId: v.optional(v.string()), payloadCanonical: v.optional(v.string()),
    failureCode: v.optional(v.string()), updatedAt: v.number() })
    .index("by_event_stage", ["tenantId", "memorySpaceId", "eventId", "stage"]),
  runtimeIngestionJobs: defineTable({ ...scope, eventId: v.string(), runBudgetId: v.string(),
    runAccountId: v.id("runtimeBudgetAccounts"), requestCanonical: v.string(), createdAt: v.number() })
    .index("by_event", ["tenantId", "memorySpaceId", "eventId"]).index("by_budget", ["runBudgetId"]).index("by_account", ["runAccountId"]),
  runtimeBeliefHeads: defineTable({ ...scope, slotKey: v.string(), factId: v.string(), sequence: v.number(),
    eventId: v.string(), version: v.number(), updatedAt: v.number() }).index("by_slot", ["tenantId", "memorySpaceId", "slotKey"]),
  runtimeBeliefHistory: defineTable({ ...scope, historyId: v.string(), eventId: v.string(), sequence: v.number(),
    factId: v.string(), action: v.union(v.literal("ADD"), v.literal("UPDATE"), v.literal("SUPERSEDE"), v.literal("NONE")),
    beforeCanonical: v.optional(v.string()), afterCanonical: v.optional(v.string()), planCanonical: v.string(),
    actorReference: runtimeAuthorityReference, createdAt: v.number() }).index("by_fact", ["tenantId", "memorySpaceId", "factId", "sequence"])
    .index("by_event", ["tenantId", "memorySpaceId", "eventId"]),
  runtimeBeliefOutbox: defineTable({ ...scope, eventId: v.string(), receiptId: v.string(), sequence: v.number(),
    factIds: v.array(v.string()), state: v.union(v.literal("pending"), v.literal("complete")), createdAt: v.number() })
    .index("by_event", ["tenantId", "memorySpaceId", "eventId"]),
};
