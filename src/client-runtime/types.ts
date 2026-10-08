/** Browser-only v1 contracts. Selectors are verified by the backend, never authority. */
export interface RuntimeScope { readonly tenantId: string; readonly memorySpaceId: string }
export interface RuntimeSession extends RuntimeScope { readonly version: 1; readonly principalId: string; readonly userId: string }
export interface TextSubmitV1 {
  version: 1; agentId: string; agentVersion: number; conversationId?: string;
  clientRequestId: string; parts: { type: "text"; text: string }[];
}
export type RuntimeResponseStatus = "queued" | "waiting_approval" | "running" | "complete" | "failed" | "cancelled";
export type RuntimeStageStatus = "pending" | "complete" | "failed" | "not_requested";
export interface RuntimeRun {
  version: 1; runId: string; conversationId: string; agentId: string; agentVersion: number;
  scope: RuntimeScope; definitionHash: string; queueSequence: number; responseStatus: RuntimeResponseStatus;
  memoryStatus: RuntimeStageStatus; graphStatus: RuntimeStageStatus; attemptNumber: number;
  cancellationRequested: boolean; inputMessageIds: string[]; outputMessageIds: string[];
  failureCode: string | null; contextCompleteness: "complete" | "incomplete" | null; contextFailureCode: string | null;
  createdAt: number; updatedAt: number;
}
/** Restorable server identity; possession of a handle grants no access. */
export interface RuntimeRunHandle extends RuntimeScope {
  readonly version: 1; readonly principalId: string; readonly runId: string; readonly conversationId: string;
  readonly agentId: string; readonly agentVersion: number; readonly definitionHash: string;
}
export type RuntimePublicPart =
  | { type: "text"; text: string }
  | { type: "text-start" | "text-end"; id: string }
  | { type: "text-delta"; text: string; id?: string }
  | { type: "tool"; toolCallId: string; name: string; phase: "requested" | "approved" | "running" | "succeeded" | "failed" }
  | { type: "error"; code: "RUNTIME_OUTPUT_FAILED" }
  | { type: "artifact"; artifactId: string; kind: "memory-receipt" }
  | { type: "status"; state: string };
export interface RuntimeToolApproval { operationId: string; toolName: string; requestHash: string }
export interface RuntimeOutputCursor { readonly attemptNumber: number; readonly sequence: number }
export interface RuntimeObservation {
  run: RuntimeRun; state: string; parts: { sequence: number; part: RuntimePublicPart }[];
  cursor: number; approvals: RuntimeToolApproval[];
}
export interface RuntimeEmbeddingProfile {
  profileId: string; modelId: string; dimensions: number; normalization: string; chunking: string; indexName: string;
}
export interface RuntimeRecallItem {
  type: "memory" | "fact"; id: string; content: string; score: number; source: string;
  /** Additional attributed, public retrieval metadata; never a model request. */
  memory?: Readonly<Record<string, unknown>>; fact?: Readonly<Record<string, unknown>>;
}
export interface RuntimeRecallResult { items: RuntimeRecallItem[]; context: string; profileId: string }
export interface RuntimeTranscriptMessage {
  id: string; role: "user" | "assistant" | "tool"; parts: { type: "text"; text: string }[];
  order: number; stepOrder: number; status: "pending" | "success" | "failed"; revision: number;
}
export interface RuntimeTranscriptPage { page: RuntimeTranscriptMessage[]; isDone: boolean; continueCursor: string | null }
export interface RuntimeDefinition { agentId: string; version: number; definitionHash: string; tools: { toolId: string; toolVersion: number }[]; memoryMode: string }
export interface RuntimeConversation {
  conversationId: string; type: "user-agent" | "agent-agent"; visibility: "private" | "space";
  manualWriteLocked: boolean; requireApproval: boolean; historyRevision: number; epoch: number;
  messageCount: number; participants: string[]; retentionUntil: number | null; createdAt: number; updatedAt: number;
}
