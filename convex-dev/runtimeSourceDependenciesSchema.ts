/** Minimal reverse custody links. No evidence text is stored in this graph. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contextSourceWitness } from "./runtimeContextWitnessSchema";
export const sourceDependencyKind = v.union(v.literal("execution"), v.literal("transcript"), v.literal("source"), v.literal("content"), v.literal("media"), v.literal("artifact"), v.literal("model"));
const scope = { tenantId: v.string(), memorySpaceId: v.string() };
export const runtimeSourceDependencyTables = {
  runtimeSourceDependencies: defineTable({ ...scope, identity: v.string(), upstreamSourceId: v.string(), upstreamRevision: v.number(), witness: contextSourceWitness,
    targetKind: sourceDependencyKind, targetId: v.string(), targetRevision: v.number(), createdAt: v.number(), erasedAt: v.optional(v.number()) })
    .index("by_identity", ["identity"])
    .index("by_upstream", ["tenantId", "memorySpaceId", "upstreamSourceId", "upstreamRevision"])
    .index("by_upstream_erasure", ["tenantId", "memorySpaceId", "upstreamSourceId", "erasedAt"])
    .index("by_target", ["tenantId", "memorySpaceId", "targetKind", "targetId", "targetRevision"]),
  runtimeSourceConsumerErasureJobs: defineTable({ ...scope, identity: v.string(), targetKind: sourceDependencyKind, targetId: v.string(), targetRevision: v.number(),
    phase: v.string(), position: v.number(), workflowCursor: v.optional(v.string()), complete: v.boolean(), createdAt: v.number(), updatedAt: v.number() })
    .index("by_identity", ["identity"]),
  runtimeSourceRevisionErasureFences: defineTable({ ...scope, sourceId: v.string(), sourceRevision: v.number(), erasedAt: v.number() })
    .index("by_revision", ["tenantId", "memorySpaceId", "sourceId", "sourceRevision"]),
};
