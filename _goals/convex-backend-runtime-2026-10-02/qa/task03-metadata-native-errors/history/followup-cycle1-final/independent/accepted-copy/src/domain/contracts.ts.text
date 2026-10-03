import type { FactRecord } from "../types/index.js";
import type { ConflictCandidate, ConflictDecision } from "./conflicts.js";
import type { ExtractedFact, FACTS_JSON_SCHEMA } from "./extraction.js";
import type { DomainClock } from "./clock.js";
import type { EmbeddingProfile } from "./profile.js";

/** Constructed only after backend identity/grant verification; never caller authority. */
export interface TrustedMemoryScope {
  readonly tenantId: string;
  readonly tenantEpoch: number;
  readonly memorySpaceId: string;
  readonly memorySpaceEpoch: number;
  readonly principalId: string;
  readonly principalVersion: number;
  readonly membershipId: string;
  readonly membershipVersion: number;
  readonly grantId: string;
  readonly grantVersion: number;
}

/** Current backend lookup, after the authority adapter checks revocation/tombstones. */
export interface MemoryAuthoritySnapshot {
  scope: TrustedMemoryScope;
  principalActive: boolean;
  membershipActive: boolean;
  grantActive: boolean;
  tenantActive: boolean;
  memorySpaceActive: boolean;
}

export interface SourceReference {
  sourceId: string;
  sourceEventId: string;
  sourceRevision: number;
}

/** Attribution is assigned by the trusted transcript/tool adapter, never a model. */
export type SourceLineage = SourceReference & (
  | { role: "user"; trust: "user_assertion" }
  | { role: "tool"; trust: "verified_tool_evidence"; operationId: string }
  | { role: "assistant"; trust: "assistant_claim" }
);

export interface SourceContent {
  tenantId: string;
  memorySpaceId: string;
  ownerPrincipalId: string;
  lineage: SourceLineage;
  content: string;
  contentHash: string;
  createdAt: number;
  tombstonedAt?: number;
}

/** Logical chunk: content and lineage exist independently of the derived vector. */
export interface SourceChunk extends SourceReference {
  chunkId: string;
  tenantId: string;
  memorySpaceId: string;
  profileId: string;
  ordinal: number;
  start: number;
  end: number;
  text: string;
  textHash: string;
}

export interface DerivedVector extends SourceReference {
  vectorId: string;
  chunkId: string;
  tenantId: string;
  memorySpaceId: string;
  profile: EmbeddingProfile;
  embedding: readonly number[];
  processingReceiptId: string;
}

export interface AttributedFact extends ExtractedFact {
  lineage: SourceLineage;
}

export interface DerivedFact extends FactRecord {
  ownerPrincipalId: string;
  lineage: SourceLineage;
  extractionPolicyVersion: string;
}

export interface ProcessingIdentity extends SourceReference {
  stage: "extract" | "facts" | "vectors";
  semanticPolicyVersion: string;
}

export interface ProfiledQuery {
  text: string;
  profile: EmbeddingProfile;
  embedding: readonly number[];
}

export interface VectorMatch {
  vector: DerivedVector;
  chunk: SourceChunk;
  source: SourceContent;
  score: number;
}

/**
 * Scoped ctx implementation belongs to Task 02B. Every method rechecks the stored
 * authority (including revocation/deletion); writes atomically check current source
 * event/revision and tombstones. Source/receipt hash reuse requires canonical equality.
 * Search applies trusted tenant/space/profile filters AND post-search grant/currentness
 * checks. No unscoped Convex client or optional tenant filter is part of this contract.
 */
export interface MemoryRepository {
  readonly scope: TrustedMemoryScope;
  recheckAuthority(): Promise<void>;
  getSource(sourceId: string): Promise<SourceContent | null>;
  putSource(source: SourceContent): Promise<{ source: SourceContent; created: boolean }>;
  commitDerived(input: {
    source: SourceReference;
    identity: ProcessingIdentity;
    chunks?: readonly SourceChunk[];
    vectors?: readonly DerivedVector[];
    facts?: readonly DerivedFact[];
    /** Belief commits compare current versions atomically; stale resolution cannot win. */
    expectedFactVersions?: Readonly<Record<string, number>>;
  }): Promise<{ receiptId: string; created: boolean }>;
  searchVectors(query: ProfiledQuery, limit: number): Promise<readonly VectorMatch[]>;
  listFacts(query: { subject?: string; factType?: FactRecord["factType"]; limit: number }): Promise<readonly DerivedFact[]>;
}

export interface InternalModelOperation {
  operationId: string;
  policyVersion: string;
  attempt: number;
  source?: SourceReference;
}

/**
 * Internal Gateway seam only. These registered operations never call the public
 * chat/remember/recall wrappers, inject conversational context, or trigger ingestion.
 * Adapter owns policy admission, checkpoint/usage receipts and maxRetries:0; ambiguous
 * dispatched outcomes propagate without retry or direct-provider fallback.
 */
export interface MemoryModel {
  extract(request: InternalModelOperation & {
    purpose: "memory.extract";
    system: string;
    prompt: string;
    schema: typeof FACTS_JSON_SCHEMA;
  }): Promise<unknown>;
  resolve(request: InternalModelOperation & {
    purpose: "facts.resolve";
    system: string;
    prompt: string;
    candidate: ConflictCandidate;
  }): Promise<ConflictDecision>;
  embed(request: InternalModelOperation & {
    purpose: "embedding.memory" | "embedding.query";
    profile: EmbeddingProfile;
    texts: readonly string[];
  }): Promise<{ profile: EmbeddingProfile; vectors: readonly (readonly number[])[] }>;
}

export interface MemoryDomainAdapters {
  repository: MemoryRepository;
  model: MemoryModel;
  clock: DomainClock;
}
