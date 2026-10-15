import { artifactContextWitness } from "./runtimeArtifactContextSchema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { contextSourceWitness } from "./runtimeContextWitnessSchema";

export const agentAttempt = { reference: runtimeAuthorityReference, runId: v.string(), attemptNumber: v.number(), leaseVersion: v.number() };
export const sourceWitness = contextSourceWitness;
const scope = { tenantId: v.string(), memorySpaceId: v.string(), runId: v.string(), attemptNumber: v.number() };
export const runtimeAgentTables = {
  runtimeAgentExecutions: defineTable({ ...scope, workflowId: v.optional(v.string()), reference: runtimeAuthorityReference,
    executionMode: v.optional(v.union(v.literal("direct-v6"), v.literal("direct-v8"))), scheduledActionId: v.optional(v.id("_scheduled_functions")),
    directState: v.optional(v.union(v.literal("scheduled"), v.literal("started"), v.literal("continuation_pending"), v.literal("continuation"))),
    leaseVersion: v.number(), state: v.union(v.literal("ready"), v.literal("running"), v.literal("waiting_approval"),
      v.literal("finalizing"), v.literal("complete"), v.literal("failed"), v.literal("cancelled"), v.literal("unknown")),
    streaming: v.boolean(), nextOutputSequence: v.number(), nextModelStep: v.number(), toolCount: v.number(),
    modelInputHistoryIds: v.optional(v.array(v.string())),
    modelInputEntries: v.optional(v.array(v.object({ key: v.string(), kind: v.union(v.literal("memory"), v.literal("fact"), v.literal("pending"), v.literal("notice")), text: v.string(), relevance: v.number() }))),
    modelInputSelection: v.optional(v.object({ ordinal: v.number(), messageIds: v.array(v.string()), entryKeys: v.array(v.string()), policyHash: v.string(), hash: v.string() })),
    contextCanonical: v.optional(v.string()), contextState: v.optional(v.union(v.literal("started"), v.literal("complete"), v.literal("failed"))), sourceWitnesses: v.array(sourceWitness),
    contextCompleteness: v.optional(v.union(v.literal("complete"), v.literal("incomplete"))), contextFailureCode: v.optional(v.string()),
    barrierStartedAt: v.optional(v.number()),
    artifactContextWitnesses: v.optional(v.array(artifactContextWitness)),
    mediaJobReferences: v.optional(v.array(v.object({ type: v.literal("media-job"), version: v.literal(1), jobId: v.string(), artifactId: v.string(), kind: v.union(v.literal("image"), v.literal("video")) }))),
    savedMessageIds: v.array(v.string()), savedMessagePins: v.optional(v.array(v.object({ id: v.string(), order: v.number(), stepOrder: v.number(), canonicalContentHash: v.string() }))), finalMessageIds: v.optional(v.array(v.string())),
    ingestionReceiptId: v.optional(v.string()), failureCode: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_attempt", ["tenantId", "memorySpaceId", "runId", "attemptNumber"]),
  runtimeAgentOutput: defineTable({ ...scope, sequence: v.number(), partCanonical: v.string(), final: v.boolean(), createdAt: v.number() })
    .index("by_sequence", ["tenantId", "memorySpaceId", "runId", "attemptNumber", "sequence"])
    .index("by_delivery", ["tenantId", "memorySpaceId", "runId", "attemptNumber", "final", "sequence"]),
  runtimeAgentOperations: defineTable({ ...scope, operationId: v.string(), semanticId: v.string(), kind: v.union(v.literal("model"), v.literal("tool")),
    ordinal: v.number(), toolCallId: v.optional(v.string()), toolName: v.optional(v.string()), requestCanonical: v.string(),
    nativeRequestCanonical: v.optional(v.string()),
    state: v.union(v.literal("prepared"), v.literal("waiting_approval"), v.literal("approved"), v.literal("started"), v.literal("complete"), v.literal("unknown")),
    resultCanonical: v.optional(v.string()), nativeMessageIds: v.array(v.string()), nativeModelOperationId: v.optional(v.id("runtimeModelOperations")), approvalActor: v.optional(runtimeAuthorityReference),
    startedAt: v.optional(v.number()), endedAt: v.optional(v.number()), createdAt: v.number(),
  }).index("by_operation", ["tenantId", "memorySpaceId", "operationId"])
    .index("by_attempt", ["tenantId", "memorySpaceId", "runId", "attemptNumber", "kind", "ordinal"]),
  runtimeAgentIngestion: defineTable({ ...scope, receiptId: v.string(), identityCanonical: v.string(), outputMessageIds: v.array(v.string()),
    sourceEvents: v.array(v.object({ sourceEventId: v.string(), sourceRevision: v.number() })), state: v.literal("pending"), createdAt: v.number() })
    .index("by_run", ["tenantId", "memorySpaceId", "runId"]),
};
