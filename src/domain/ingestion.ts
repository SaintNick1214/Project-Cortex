/** Durable memory work identities. Scope order is independent of transcript queue order. */
import type { RuntimeAuthorityReference } from "../auth/verified.js";
import type { SourceLineage } from "./contracts.js";
import type { EmbeddingProfile } from "./profile.js";
export const INGESTION_VERSION = "cortex-ingestion-v1";
export const BELIEF_POLICY_VERSION = "ordered-belief-v1";
export const MAX_INGESTION_ATTEMPTS = 3;
export const INGESTION_LEASE_MS = 120_000;
export const MAX_INGESTION_FACTS = 100;
export type IngestionStage = "extract" | "facts" | "vectors";
export type IngestionEligibility = "eligible" | "awaiting_approval" | "awaiting_tool" | "ineligible" | "superseded" | "tombstoned";
export type IngestionStageState = "pending" | "running" | "complete" | "failed" | "unknown" | "dead_letter" | "skipped";
export interface IngestionEventV1 {
  version: 1; eventId: string; tenantId: string; memorySpaceId: string; ownerPrincipalId: string;
  sequence: number; lineage: SourceLineage; contentHash: string; authorityReference: RuntimeAuthorityReference;
  eligibility: IngestionEligibility; factsState: IngestionStageState; vectorsState: IngestionStageState; extractionVersion: string; beliefVersion: string; profile: EmbeddingProfile;
  conversationId?: string; conversationSequence?: number; conversationEpoch?: number; nativeMessageId?: string;
  runId?: string; toolOperationId?: string; createdAt: number;
}
export interface IngestionStageSummary {
  stage: IngestionStage; state: IngestionStageState; attempt: number; leaseVersion: number;
  receiptId?: string; failureCode?: string; updatedAt: number;
}
export interface ScopeIngestionCutoff { tenantId: string; memorySpaceId: string; sequence: number }
export interface IngestionEventStatus { event: IngestionEventV1; stages: IngestionStageSummary[] }
export function skipsIngestion(eligibility: IngestionEligibility): boolean {
  return eligibility === "ineligible" || eligibility === "superseded" || eligibility === "tombstoned";
}
export function ingestionIdentity(event: Pick<IngestionEventV1, "tenantId" | "memorySpaceId" | "lineage" | "contentHash">): string {
  return JSON.stringify([INGESTION_VERSION, event.tenantId, event.memorySpaceId, event.lineage.sourceId,
    event.lineage.sourceEventId, event.lineage.sourceRevision, event.contentHash]);
}
