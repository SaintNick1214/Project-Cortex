import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { contextSourceWitness } from "./runtimeContextWitnessSchema";
import { MEDIA_JOB_STATES } from "../src/domain/media-jobs";
export const mediaJobState = v.union(...MEDIA_JOB_STATES.map(state => v.literal(state)));
export const mediaInputBinding = v.object({ assetId: v.string(), assetVersion: v.number(), versionId: v.string(), contentHash: v.string(), sizeBytes: v.number(), mimeType: v.literal("image/png") });
export const runtimeMediaTables = {
  runtimeMediaJobs: defineTable({ tenantId: v.string(), memorySpaceId: v.string(), ownerPrincipalId: v.string(), jobId: v.string(), artifactId: v.string(), requestId: v.string(), requestCanonical: v.string(),
    kind: v.union(v.literal("image"), v.literal("video")), prompt: v.string(), reference: runtimeAuthorityReference, conversationId: v.optional(v.string()), input: v.optional(mediaInputBinding),
    contextSourceWitnesses: v.array(contextSourceWitness), runBudgetId: v.string(), runAccountId: v.id("runtimeBudgetAccounts"), parentOperationId: v.optional(v.id("runtimeModelOperations")),
    state: mediaJobState, revision: v.number(), leaseToken: v.optional(v.string()), leaseExpiresAt: v.optional(v.number()), expiresAt: v.number(), createdAt: v.number(), updatedAt: v.number(),
    snapshotCanonical: v.optional(v.string()), proofCanonical: v.optional(v.string()), envelopeCanonical: v.optional(v.string()), attemptId: v.optional(v.id("runtimeModelAttempts")), modelOperationId: v.optional(v.id("runtimeModelOperations")), dispatchIdentity: v.optional(v.string()),
    operation: v.optional(v.string()), inferenceId: v.optional(v.string()), webhookSecret: v.optional(v.string()), terminalStatus: v.optional(v.union(v.literal("completed"), v.literal("failed"), v.literal("cancelled"), v.literal("expired"))),
    resultCanonical: v.optional(v.string()), assetVersionId: v.optional(v.string()), failureCode: v.optional(v.string()), costStatus: v.union(v.literal("reserved"), v.literal("incurred_unknown"), v.literal("settled")),
    downloadAttempt: v.number(), pollCount: v.number(), cancelledAt: v.optional(v.number()) })
    .index("by_job", ["jobId"]).index("by_request", ["tenantId", "memorySpaceId", "ownerPrincipalId", "requestId"]).index("by_scope", ["tenantId", "memorySpaceId", "createdAt"]).index("by_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId", "createdAt"]).index("by_account", ["runAccountId", "jobId"]).index("by_operation", ["modelOperationId"]),
  runtimeMediaCallbacks: defineTable({ jobId: v.string(), inferenceId: v.string(), status: v.string(), bodyHash: v.string(), receivedAt: v.number() }).index("by_identity", ["jobId", "inferenceId", "status"]),
};
