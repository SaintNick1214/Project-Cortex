import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";

export const responseStatus = v.union(v.literal("queued"), v.literal("running"), v.literal("waiting_approval"),
  v.literal("complete"), v.literal("failed"), v.literal("cancelled"));
export const stageStatus = v.union(v.literal("pending"), v.literal("complete"), v.literal("failed"), v.literal("not_requested"));
export const messagePin = v.object({ nativeMessageId: v.string(), order: v.number(), stepOrder: v.number(),
  sourceEventId: v.string(), sourceRevision: v.number(), contentHash: v.string() });
const scope = { tenantId: v.string(), memorySpaceId: v.string(), ownerPrincipalId: v.string() };
export const runtimeTranscriptTables = {
  runtimeAgentDefinitions: defineTable({ ...scope, agentId: v.string(), version: v.number(),
    definitionCanonical: v.string(), definitionHash: v.string(), authorReference: runtimeAuthorityReference, createdAt: v.number(),
    publishPrincipalId: v.string(), publishIdentityCanonical: v.string(), publishIdentityHash: v.string(), publishRequestCanonical: v.string(),
    revokedAt: v.optional(v.number()), revocationActorReference: v.optional(runtimeAuthorityReference), revocationReason: v.optional(v.string()),
  }).index("by_scoped_version", ["tenantId", "memorySpaceId", "agentId", "version"])
    .index("by_scoped_publish", ["tenantId", "memorySpaceId", "publishPrincipalId", "publishIdentityHash"]),
  runtimeConversations: defineTable({ ...scope, conversationId: v.string(), threadId: v.string(),
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")), participants: v.array(v.string()),
    visibility: v.union(v.literal("private"), v.literal("space")), manualWriteLocked: v.boolean(),
    metadataCanonical: v.optional(v.string()), legacyConversationId: v.optional(v.string()), legacyAgentLabel: v.optional(v.string()),
    requireApproval: v.boolean(), retentionUntil: v.optional(v.number()), epoch: v.number(), historyRevision: v.number(), executionRevision: v.optional(v.number()),
    nextQueueSequence: v.number(), messageCount: v.number(), createdAt: v.number(), updatedAt: v.number(),
    forkedFrom: v.optional(v.string()), creationIdentity: v.string(), creationCanonical: v.string(), tombstonedAt: v.optional(v.number()), deletionActorReference: v.optional(runtimeAuthorityReference),
  }).index("by_scoped_id", ["tenantId", "memorySpaceId", "conversationId"])
    .index("by_scope", ["tenantId", "memorySpaceId"])
    .index("by_scoped_alias", ["tenantId", "memorySpaceId", "legacyConversationId"]),
  runtimeConversationShares: defineTable({ ...scope, shareId: v.string(), conversationId: v.string(),
    grantType: v.union(v.literal("user"), v.literal("space")), grantedTo: v.string(),
    permissions: v.object({ canView: v.boolean(), canViewFacts: v.boolean(), canViewMemories: v.boolean(), canContinue: v.boolean(), canFork: v.boolean(), canExport: v.boolean() }),
    state: v.union(v.literal("active"), v.literal("revoked")), actorReference: runtimeAuthorityReference, expiresAt: v.optional(v.number()), maxViews: v.optional(v.number()), viewCount: v.number(),
    createdAt: v.number(), revokedAt: v.optional(v.number()), revocationActor: v.optional(runtimeAuthorityReference),
  }).index("by_scoped_id", ["tenantId", "memorySpaceId", "shareId"])
    .index("by_conversation", ["tenantId", "memorySpaceId", "conversationId"])
    .index("by_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"])
    .index("by_conversation_state", ["tenantId", "memorySpaceId", "conversationId", "state"]),
  runtimeConversationSnapshots: defineTable({ ...scope, snapshotId: v.string(), conversationId: v.string(), conversationEpoch: v.number(),
    historyRevision: v.number(), pins: v.array(messagePin), redactPII: v.boolean(), redactBefore: v.optional(v.number()), actorReference: runtimeAuthorityReference, createdAt: v.number(),
    tombstonedAt: v.optional(v.number()),
  }).index("by_scoped_id", ["tenantId", "memorySpaceId", "snapshotId"])
    .index("by_conversation", ["tenantId", "memorySpaceId", "conversationId"])
    .index("by_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]),
  runtimeTranscriptMessages: defineTable({ ...scope, conversationId: v.string(), nativeMessageId: v.string(),
    order: v.number(), stepOrder: v.number(), role: v.union(v.literal("user"), v.literal("assistant"), v.literal("tool")),
    revision: v.number(), contentHash: v.string(), sourceEventId: v.string(), sourceId: v.string(),
    sourceContentHash: v.string(), actorReference: runtimeAuthorityReference, approved: v.boolean(),
    legacyMessageId: v.optional(v.string()), legacyRequestCanonical: v.optional(v.string()),
    runId: v.optional(v.string()), attemptNumber: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
    tombstonedAt: v.optional(v.number()),
  }).index("by_native", ["tenantId", "memorySpaceId", "nativeMessageId"])
    .index("by_conversation_position", ["tenantId", "memorySpaceId", "conversationId", "order", "stepOrder"])
    .index("by_legacy_id", ["tenantId", "memorySpaceId", "conversationId", "legacyMessageId"]),
  runtimeRuns: defineTable({ ...scope, runId: v.string(), conversationId: v.string(), conversationEpoch: v.number(),
    requestIdentityCanonical: v.string(), requestIdentityHash: v.string(), requestCanonical: v.string(),
    agentId: v.string(), agentVersion: v.number(), definitionHash: v.string(), authorityReference: runtimeAuthorityReference,
    inputMessageIds: v.array(v.string()), queueSequence: v.number(), historyRevision: v.number(),
    runBudgetId: v.string(), runAccountId: v.id("runtimeBudgetAccounts"), responseStatus,
    memoryStatus: stageStatus, graphStatus: stageStatus, attemptNumber: v.number(),
    outputMessageIds: v.array(v.string()), approvedAt: v.optional(v.number()), approvalActor: v.optional(runtimeAuthorityReference),
    cancellationRequestedAt: v.optional(v.number()), cancelledAt: v.optional(v.number()),
    failureCode: v.optional(v.string()), snapshotCanonical: v.optional(v.string()),
    createdAt: v.number(), updatedAt: v.number(), tombstonedAt: v.optional(v.number()),
  }).index("by_request", ["tenantId", "memorySpaceId", "ownerPrincipalId", "requestIdentityHash"])
    .index("by_scoped_id", ["tenantId", "memorySpaceId", "runId"])
    .index("by_conversation_queue", ["tenantId", "memorySpaceId", "conversationId", "queueSequence"])
    .index("by_conversation_status", ["tenantId", "memorySpaceId", "conversationId", "responseStatus", "queueSequence"]),
  runtimeRunOutbox: defineTable({ tenantId: v.string(), memorySpaceId: v.string(), conversationId: v.string(), runId: v.string(),
    sequence: v.number(), state: v.union(v.literal("pending"), v.literal("ready"), v.literal("claimed"), v.literal("complete")),
    leaseVersion: v.number(), leaseExpiresAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_run", ["tenantId", "memorySpaceId", "runId"])
    .index("by_conversation", ["tenantId", "memorySpaceId", "conversationId", "sequence"]),
  runtimeRunAttempts: defineTable({ tenantId: v.string(), memorySpaceId: v.string(), runId: v.string(),
    attemptNumber: v.number(), leaseVersion: v.number(), historyRevision: v.number(), status: responseStatus,
    startedAt: v.number(), endedAt: v.optional(v.number()), failureCode: v.optional(v.string()),
  }).index("by_run_attempt", ["tenantId", "memorySpaceId", "runId", "attemptNumber"]),
  runtimeTranscriptOutbox: defineTable({ tenantId: v.string(), memorySpaceId: v.string(), conversationId: v.string(),
    nativeMessageId: v.string(), sourceEventId: v.string(), sourceRevision: v.number(), canonicalIdentity: v.string(), identityHash: v.string(),
    state: v.union(v.literal("pending"), v.literal("registered"), v.literal("tombstoned")), createdAt: v.number(),
  }).index("by_identity", ["tenantId", "memorySpaceId", "identityHash"])
    .index("by_conversation", ["tenantId", "memorySpaceId", "conversationId"]),
};
