/** Backend-owned external projection contract. No graph credentials or query language. */
import type { SourceReference } from "./contracts.js";
import type { EmbeddingProfile } from "./profile.js";

export const GRAPH_PROJECTION_VERSION = 1 as const;
export const GRAPH_PROJECTION_LIMITS = Object.freeze({ leaseMs: 60_000, maximumAttempts: 3,
  maximumFacts: 100, maximumPayloadBytes: 32_768, maximumExpansion: 20 });
export interface GraphProjectionScope {
  tenantId: string; memorySpaceId: string; tenantEpoch: number; memorySpaceEpoch: number;
}
export interface GraphProjectionFact {
  factId: string; revision: number; text: string;
  entities: { name: string; type: string }[];
  relations: { subject: string; predicate: string; object: string }[];
}
/** Revision is a monotone backend projection sequence, not provider time or a lease. */
export interface GraphProjectionPayloadV1 {
  version: 1; scope: GraphProjectionScope; source: SourceReference & { contentHash: string; ownerPrincipalId: string };
  revision: number; operation: "replace" | "tombstone"; profile: EmbeddingProfile;
  facts: GraphProjectionFact[];
}
export interface GraphProjectionLeaseV1 {
  tenantId: string; memorySpaceId: string; connectorId: string;
  jobId: string; workerId: string; leaseVersion: number;
}
export interface GraphProjectionWorkV1 extends GraphProjectionLeaseV1 {
  version: 1; leaseExpiresAt: number; payload: GraphProjectionPayloadV1; payloadHash: string;
}
/** Trusted connector receipt; never accepted at a public user endpoint. */
export interface GraphProjectionReceiptV1 {
  version: 1; connectorId: string; jobId: string; payloadHash: string;
  tenantId: string; memorySpaceId: string; sourceId: string;
  tenantEpoch: number; memorySpaceEpoch: number; revision: number;
  state: "applied" | "duplicate" | "stale";
  currentRevision: number;
}
export interface GraphExpansionWorkV1 extends GraphProjectionLeaseV1 {
  version: 1; leaseExpiresAt: number; scope: GraphProjectionScope;
  sourceId: string; profileId: string; revision: number; limit: number;
}
export interface GraphExpansionResultV1 {
  version: 1; scope: GraphProjectionScope; sourceId: string; profileId: string; revision: number; factIds: string[];
}
/** Remote graph stores source fences/tombstones even when content is removed.
 * An atomic write first locks a scope fence and checks its epoch tuple, then
 * checks the source fence revision. Older epochs/revisions never apply. Equal
 * revisions require the exact payload hash. A tombstone keeps the fence and
 * removes only that source's facts/relations. New scope epochs hide all prior
 * epoch data. Receipts commit in the same remote transaction as the content.
 * Core acknowledgement additionally checks its current lease/source/grant;
 * any ambiguity keeps strict freshness blocked until exact reconciliation. */
export function compareGraphFence(a: Pick<GraphProjectionScope, "tenantEpoch" | "memorySpaceEpoch"> & { revision: number },
  b: Pick<GraphProjectionScope, "tenantEpoch" | "memorySpaceEpoch"> & { revision: number }): number {
  for (const field of ["tenantEpoch", "memorySpaceEpoch", "revision"] as const) {
    if (!Number.isSafeInteger(a[field]) || a[field] < 1 || !Number.isSafeInteger(b[field]) || b[field] < 1) throw new Error("INVALID_GRAPH_FENCE");
    if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
  }
  return 0;
}
