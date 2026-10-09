import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { contextSourceWitness } from "./runtimeContextWitnessSchema";
import { artifactContextWitness } from "./runtimeArtifactContextSchema";
export const contentIntent = v.union(v.literal("title"), v.literal("text"), v.literal("code"), v.literal("sheet"), v.literal("suggestions"));
export const runtimeContentTables = {
  runtimeContentJobs: defineTable({ tenantId: v.string(), memorySpaceId: v.string(), ownerPrincipalId: v.string(), jobId: v.string(), requestId: v.string(), requestCanonical: v.string(), reference: runtimeAuthorityReference,
    intent: contentIntent, prompt: v.string(), conversationId: v.optional(v.string()), sourceMessageId: v.optional(v.string()), sourceMessagePin: v.optional(v.object({ revision: v.number(), contentHash: v.string() })), conversationEpoch: v.optional(v.number()), conversationRevision: v.optional(v.number()),
    parentRunId: v.optional(v.string()), artifactId: v.optional(v.string()), artifactVersion: v.optional(v.number()), artifactHash: v.optional(v.string()), sourceArtifactId: v.optional(v.string()),
    sourceWitnesses: v.array(contextSourceWitness), artifactWitnesses: v.array(artifactContextWitness), deliveryArtifactWitnesses: v.array(artifactContextWitness),
    runBudgetId: v.string(), runAccountId: v.id("runtimeBudgetAccounts"), parentOperationId: v.optional(v.id("runtimeModelOperations")),
    state: v.union(v.literal("pending"), v.literal("running"), v.literal("ready"), v.literal("failed"), v.literal("unknown"), v.literal("cancelled"), v.literal("expired")), revision: v.number(),
    workflowId: v.optional(v.string()), leaseToken: v.optional(v.string()), leaseExpiresAt: v.optional(v.number()), expiresAt: v.number(),
    stage: v.union(v.literal("primary"), v.literal("title")), primarySnapshot: v.optional(v.string()), titleSnapshot: v.optional(v.string()), primaryOperationId: v.optional(v.id("runtimeModelOperations")), titleOperationId: v.optional(v.id("runtimeModelOperations")),
    appliedSuggestionId: v.optional(v.string()), appliedArtifactVersion: v.optional(v.number()), primaryResult: v.optional(v.string()), generatedTitle: v.optional(v.string()), rejectedTitleResult: v.optional(v.string()), resultCanonical: v.optional(v.string()), failureCode: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number() })
    .index("by_job", ["jobId"]).index("by_request", ["tenantId", "memorySpaceId", "ownerPrincipalId", "requestId"]).index("by_account", ["runAccountId"])
    .index("by_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId", "createdAt"]).index("by_conversation", ["tenantId", "memorySpaceId", "conversationId", "createdAt"]),
};
