/** Additive private model-policy ledger. JSON fields are bounded canonical validated contracts. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { MODEL_OPERATION_KEYS } from "../src/domain/model-policy";

export const modelOperationKey = v.union(...MODEL_OPERATION_KEYS.map((key) => v.literal(key)));
export const modelSource = v.object({ sourceId: v.string(), sourceEventId: v.string(), sourceRevision: v.number(), contentHash: v.string() });
const fullRootProvenance = v.object({ manifestId: v.string(), revision: v.number(), canonical: v.string(), hash: v.string(),
  artifactRevision: v.string(), evidenceHash: v.string(), acceptanceHash: v.string() });
/** Legacy bytes remain valid; fresh installs may omit the trusted compiled body. */
export const rootProvenance = v.union(fullRootProvenance, v.object({ encoding: v.literal("compiled-root-v1"),
  manifestId: v.string(), revision: v.number(), hash: v.string(), artifactRevision: v.string(), evidenceHash: v.string(), acceptanceHash: v.string() }));
export type FullRootProvenance = Infer<typeof fullRootProvenance>;
export type RootProvenance = Infer<typeof rootProvenance>;
export type RootProvenanceEncodings = { full: string; compact: string };
export function fullRootProvenanceFor(manifest: { manifestId: string; revision: number; artifactRevision: string; evidenceHash: string; acceptanceHash: string }, canonical: string, hash: string): FullRootProvenance {
  return { manifestId: manifest.manifestId, revision: manifest.revision, canonical, hash,
    artifactRevision: manifest.artifactRevision, evidenceHash: manifest.evidenceHash, acceptanceHash: manifest.acceptanceHash };
}
export function compactRootProvenance(root: FullRootProvenance): Extract<RootProvenance, { encoding: string }> {
  return { encoding: "compiled-root-v1", manifestId: root.manifestId, revision: root.revision, hash: root.hash,
    artifactRevision: root.artifactRevision, evidenceHash: root.evidenceHash, acceptanceHash: root.acceptanceHash };
}
/** Callers keep their original canonical bounds/error boundary. Pure invocation-local data only. */
export function rootProvenanceEncodings(root: FullRootProvenance, encode: (value: unknown) => string): RootProvenanceEncodings {
  return { full: encode(root), compact: encode(compactRootProvenance(root)) };
}
export function rootProvenanceMatches(encoded: string, expected: RootProvenanceEncodings): boolean {
  return encoded === expected.full || encoded === expected.compact;
}
/** Only an exact compact proof is expanded; malformed/unknown bytes retain their identity. */
export function rootProvenanceEqual(left: string, right: string, expected: RootProvenanceEncodings): boolean {
  return (left === expected.compact ? expected.full : left) === (right === expected.compact ? expected.full : right);
}
export const policyState = v.union(v.literal("reserved"), v.literal("dispatch_pending"), v.literal("settled"),
  v.literal("not_dispatched"), v.literal("confirmed_rejected"), v.literal("uncertain"));
export const visibilityFields = { outputVisible: v.boolean(), toolInputVisible: v.boolean(), toolResultVisible: v.boolean(), toolEffectCommitted: v.boolean() };
export const runtimePolicyTables = {
  runtimeModelPolicies: defineTable({ policyId: v.string(), version: v.number(), scope: v.union(v.literal("deployment"), v.literal("tenant"), v.literal("agent")),
    tenantId: v.optional(v.string()), agentId: v.optional(v.string()), agentVersion: v.optional(v.number()), operationKey: v.optional(modelOperationKey), canonical: v.string(), root: rootProvenance,
    actorReference: v.optional(runtimeAuthorityReference), active: v.boolean(), revokedAt: v.optional(v.number()), createdAt: v.number(),
  }).index("by_policy_version", ["policyId", "version"]).index("by_scope_active", ["scope", "tenantId", "active"]),
  runtimeModelQualifications: defineTable({ receiptId: v.string(), version: v.number(), canonical: v.string(), root: rootProvenance,
    active: v.boolean(), revokedAt: v.optional(v.number()), createdAt: v.number(),
  }).index("by_receipt", ["receiptId", "version"]).index("by_active", ["active"]),
  runtimeBudgetAccounts: defineTable({ accountKey: v.string(), scopeKey: v.string(), kind: v.union(v.literal("tenant"), v.literal("run")),
    tenantId: v.string(), runBudgetId: v.optional(v.string()), reference: v.optional(runtimeAuthorityReference),
    requestCanonical: v.optional(v.string()), agentId: v.optional(v.string()), agentVersion: v.optional(v.number()), windowId: v.string(), windowStart: v.number(), windowEnd: v.number(),
    currency: v.literal("USD"), monetaryUnit: v.literal("micro-USD"), root: rootProvenance,
    limitUnits: v.number(), reservedUnits: v.number(), settledUnits: v.number(), uncertainUnits: v.number(),
    concurrencyLimit: v.number(), activeConcurrency: v.number(), overrun: v.boolean(), current: v.boolean(), cancelled: v.boolean(),
    predecessor: v.optional(v.id("runtimeBudgetAccounts")), version: v.number(), createdAt: v.number(),
  }).index("by_account_key", ["accountKey"]).index("by_scope_current", ["scopeKey", "current"]).index("by_run", ["runBudgetId"]),
  runtimeModelOperations: defineTable({ operationId: v.string(), reference: runtimeAuthorityReference, tenantId: v.string(),
    memorySpaceId: v.string(), principalId: v.string(), semanticId: v.string(), operationKey: modelOperationKey,
    runAccountId: v.id("runtimeBudgetAccounts"), parentOperationId: v.optional(v.id("runtimeModelOperations")), source: v.optional(modelSource),
    resolutionCanonical: v.string(), snapshotCanonical: v.string(), identityCanonical: v.string(), identityHash: v.string(),
    reservedUnits: v.number(), settledUnits: v.number(), uncertainUnits: v.number(), overrun: v.boolean(), cancelled: v.boolean(), createdAt: v.number(),
  }).index("by_identity", ["tenantId", "memorySpaceId", "principalId", "semanticId", "operationKey"]),
  runtimeModelAttempts: defineTable({ operationDocumentId: v.id("runtimeModelOperations"), childCallId: v.string(), ordinal: v.number(),
    attemptNumber: v.number(), fallbackModelId: v.optional(v.string()), priorAttemptId: v.optional(v.id("runtimeModelAttempts")), canonical: v.string(), hash: v.string(), resolutionCanonical: v.string(), snapshotCanonical: v.string(), inputProofCanonical: v.string(), measuredInputTokens: v.number(), maximumOutputTokens: v.number(),
    tenantAccountId: v.id("runtimeBudgetAccounts"), runAccountId: v.id("runtimeBudgetAccounts"), reservationUnits: v.number(),
    state: policyState, dispatchIdentity: v.string(), checkpointAt: v.optional(v.number()), slotReleased: v.boolean(),
    ...visibilityFields, receiptCanonical: v.optional(v.string()), receiptHash: v.optional(v.string()),
    settledCostUnits: v.optional(v.number()), costProvenance: v.optional(v.string()), actualModel: v.optional(v.string()),
    privateResultCanonical: v.optional(v.string()), resultWithheld: v.boolean(), terminalEvidenceCanonical: v.optional(v.string()), terminalEvidenceHash: v.optional(v.string()),
    resultAttachmentState: v.optional(v.union(v.literal("pending"), v.literal("attached"), v.literal("closed"))), createdAt: v.number(),
  }).index("by_child_attempt", ["operationDocumentId", "childCallId", "attemptNumber"])
    .index("by_operation", ["operationDocumentId"]).index("by_state_checkpoint", ["state", "checkpointAt"]),
};
