/** Browser-only v1 contracts. Selectors are verified by the backend, never authority. */
import type { MemoryEffortRequest, MemoryEffortTrace } from "../domain/memory-effort.js";
export type { MemoryEffort, MemoryEffortRequest, MemoryEffortTrace, MemoryEffortPolicyV1, EffectiveMemoryEffortPolicy, MemoryEffortStopReason } from "../domain/memory-effort.js";
export interface RuntimeScope { readonly tenantId: string; readonly memorySpaceId: string }
export interface RuntimeSession extends RuntimeScope { readonly version: 1; readonly principalId: string; readonly userId: string; readonly deliveryExpiresAt?: number }
export interface TextSubmitV1 {
  version: 1; agentId: string; agentVersion: number; conversationId?: string;
  clientRequestId: string; parts: { type: "text"; text: string }[]; memory?: MemoryEffortRequest;
}
export type RuntimeResponseStatus = "queued" | "waiting_approval" | "running" | "complete" | "failed" | "cancelled";
export type RuntimeStageStatus = "pending" | "complete" | "failed" | "not_requested";
export interface RuntimeRun {
  version: 1; runId: string; conversationId: string; agentId: string; agentVersion: number;
  scope: RuntimeScope; definitionHash: string; queueSequence: number; responseStatus: RuntimeResponseStatus;
  memoryStatus: RuntimeStageStatus; graphStatus: RuntimeStageStatus; attemptNumber: number;
  cancellationRequested: boolean; inputMessageIds: string[]; outputMessageIds: string[];
  failureCode: string | null; contextCompleteness: "complete" | "incomplete" | null; contextFailureCode: string | null;
  createdAt: number; updatedAt: number; memoryEffort?: MemoryEffortTrace;
}
/** Restorable server identity; possession of a handle grants no access. */
export interface RuntimeRunHandle extends RuntimeScope {
  readonly version: 1; readonly principalId: string; readonly runId: string; readonly conversationId: string;
  readonly agentId: string; readonly agentVersion: number; readonly definitionHash: string;
}
export interface RuntimeStartResult {
  runId: string; attemptNumber: number;
  state: "queued" | "ready" | "running" | "waiting_approval" | "finalizing" | "complete" | "failed" | "cancelled" | "unknown";
  failureCode?: string;
}
/** Admission and start metadata from one native transaction. The handle grants no authority. */
export interface RuntimeAdmissionResult { handle: RuntimeRunHandle; run: RuntimeRun; start: RuntimeStartResult }
export type RuntimePublicPart =
  | { type: "text"; text: string }
  | { type: "text-start" | "text-end"; id: string }
  | { type: "text-delta"; text: string; id?: string }
  | { type: "tool"; toolCallId: string; name: string; phase: "requested" | "approved" | "running" | "succeeded" | "failed" }
  | { type: "error"; code: "RUNTIME_OUTPUT_FAILED" }
  | { type: "artifact"; artifactId: string; kind: "memory-receipt" }
  | { type: "media-job"; version: 1; jobId: string; artifactId: string; kind: "image" | "video" }
  | { type: "status"; state: string };
export interface RuntimeToolApproval { operationId: string; toolName: string; requestHash: string }
export interface RuntimeOutputCursor { readonly attemptNumber: number; readonly sequence: number }
export interface RuntimeObservation {
  run: RuntimeRun; state: string; parts: { sequence: number; part: RuntimePublicPart }[];
  cursor: number; approvals: RuntimeToolApproval[]; deliveryExpiresAt?: number;
}
export interface RuntimeEmbeddingProfile {
  profileId: string; modelId: string; dimensions: number; normalization: string; chunking: string; indexName: string;
}
export type RuntimeMemoryStage = "facts" | "vectors" | "graph";
export interface RuntimeStageWatermark {
  readonly cutoff: number; readonly indexedThrough: number; readonly complete: boolean;
  readonly hole: Readonly<{ sequence: number; state: "pending" | "failed" | "missing" }> | null;
}
/** Point-in-time status of captured counters. It does not change an Agent's administrator-selected memory mode. */
export interface RuntimeMemoryReadiness {
  readonly version: 1; readonly cutoff: number; readonly graphCutoff: number; readonly profile: RuntimeEmbeddingProfile;
  readonly stages: Readonly<Partial<Record<RuntimeMemoryStage, RuntimeStageWatermark>>>;
  readonly strictStages: readonly RuntimeMemoryStage[];
}
export interface RuntimeMemoryReadinessOptions {
  cutoff?: number; graphCutoff?: number; expectedProfileId?: string; strictStages?: RuntimeMemoryStage[];
}
export interface RuntimeRecallItem {
  type: "memory" | "fact"; id: string; content: string; score: number; source: string;
  /** Additional attributed, public retrieval metadata; never a model request. */
  memory?: Readonly<Record<string, unknown>>; fact?: Readonly<Record<string, unknown>>;
  retrieval?: { depth: number; path: string[] };
  tenantId?: string; userId?: string;
  graphContext?: { connectedEntities: string[]; relationshipPath?: string };
}
export interface RuntimeRecallRequest { text: string; requestId: string; limit?: number; memory?: MemoryEffortRequest }
export interface RuntimeRecallResult { items: RuntimeRecallItem[]; context: string; profileId: string; deliveryExpiresAt?: number; memoryEffort?: MemoryEffortTrace }
/** Capture supplied text once; indexing runs asynchronously under backend policy. */
export interface RuntimeRememberInput {
  conversationId: string; requestId: string; userMessage: string; agentResponse: string;
  userId?: string; agentId?: string; participantId?: string; userName?: string;
  expectedRevision?: number; metadata?: Readonly<Record<string, unknown>>;
}
export interface RuntimeRememberResult {
  readonly version: 1; readonly receiptId: string; readonly requestId: string; readonly conversationId: string;
  readonly scope: RuntimeScope; readonly principalId: string; readonly messageIds: readonly [string, string];
  readonly sourceEventIds: readonly [string, string]; readonly historyRevision: number; readonly created: boolean;
  readonly memoryStatus: "pending" | "complete" | "failed"; readonly profile: RuntimeEmbeddingProfile;
  readonly stages: Readonly<{facts: readonly [string, string]; vectors: readonly [string, string]}>;
  readonly deliveryExpiresAt?: number;
}
export interface RuntimeTranscriptMessage {
  id: string; role: "user" | "assistant" | "tool";
  parts: Extract<RuntimePublicPart, { type: "text" | "tool" | "artifact" | "media-job" }>[];
  order: number; stepOrder: number; status: "pending" | "success" | "failed"; revision: number;
}
export interface RuntimeTranscriptPage { page: RuntimeTranscriptMessage[]; isDone: boolean; continueCursor: string | null }
export interface RuntimeDefinition { agentId: string; version: number; definitionHash: string; tools: { toolId: string; toolVersion: number }[]; memoryMode: string; inputSelectionVersion?: 2; memoryEffortPolicyVersion?: 1 }
export interface RuntimeConversation {
  conversationId: string; type: "user-agent" | "agent-agent"; visibility: "private" | "space";
  manualWriteLocked: boolean; requireApproval: boolean; historyRevision: number; epoch: number;
  messageCount: number; participants: string[]; retentionUntil: number | null; createdAt: number; updatedAt: number;
}

/** Immutable version selectors carry no authority or storage URL. */
export interface RuntimeAssetReference { assetId: string; version: number }
export interface RuntimeAssetVersion {
  readonly version: 1; readonly assetId: string; readonly versionId: string; readonly assetVersion: number;
  readonly contentHash: string; readonly sizeBytes: number; readonly mimeType: string; readonly deliveryExpiresAt?: number;
  readonly mediaKind: "image" | "video" | "audio" | "document" | "binary"; readonly filename?: string;
  readonly lineage: Readonly<{ kind: "upload"; requestId: string } | { kind: "generated"; operationId: string; modelId: string; sourceVersionIds?: readonly string[] }>;
}
export type RuntimeMediaJobState = "pending" | "submitting" | "submission_unknown" | "processing" | "downloading" | "ready" | "failed" | "cancelled" | "expired";
/** Public durable job metadata; no callback secrets, upstream URLs, encoded output or model overrides. */
export interface RuntimeMediaJob {
  readonly version: 1; readonly jobId: string; readonly artifactId: string; readonly kind: "image" | "video";
  readonly state: RuntimeMediaJobState; readonly revision: number; readonly createdAt: number; readonly updatedAt: number;
  readonly asset?: RuntimeAssetVersion; readonly failureCode?: string;
  readonly deliveryExpiresAt?: number;
  readonly costStatus: "reserved" | "incurred_unknown" | "settled";
  readonly upstreamCancellation: "not_requested" | "not_supported";
}
export interface RuntimeMediaSubmit {
  requestId: string; kind: "image" | "video"; prompt: string; inputAsset?: RuntimeAssetReference; conversationId?: string;
}
/** Browser projection of a retained artifact. Files remain immutable selectors served through authenticated HTTP. */
export interface RuntimeArtifact {
  readonly contractVersion: 1; readonly artifactId: string; readonly artifactVersion: number; readonly versionPointer: number;
  readonly kind: "text" | "code" | "sheet" | "image" | "video" | "diagram" | "html" | "custom";
  readonly title: string; readonly content?: string; readonly deliveryExpiresAt?: number; readonly streamingState: "draft" | "streaming" | "paused" | "final" | "error";
  readonly file?: Readonly<RuntimeAssetReference & { versionId: string; contentHash: string; sizeBytes: number; mimeType: string }>;
  readonly conversationId?: string; readonly createdAt: number; readonly updatedAt: number;
}
