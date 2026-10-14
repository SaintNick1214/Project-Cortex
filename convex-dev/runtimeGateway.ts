/** Backend-only governed native middleware with compiled interface qualifications.
 * Production composition supplies a durable terminal sink and current-authority ledger.
 * A new tool/stream envelope remains unavailable until actual evidence is installed. */
import { ConvexError } from "convex/values";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { traceRuntimePhase } from "./runtimeLatencyTrace";
import type { RuntimeLatencyMetadata } from "./runtimeLatencyTrace";
import { wrapEmbeddingModel, wrapLanguageModel } from "ai";
import type { EmbeddingModelV4, EmbeddingModelV4CallOptions, EmbeddingModelV4Result, LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart, LanguageModelV4Usage } from "@ai-sdk/provider";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { ModelMessage } from "ai";
import { createSha256 } from "../src/common/crypto";
import { canonicalModelJson, validateModelRequest, MEMORY_JSON_OBJECT_CONTRACT, memoryJsonObjectInputBound } from "../src/domain/model-policy";
import type { ModelCallRequest, ModelOperationKey, ModelPolicySnapshotV1 } from "../src/domain/model-policy";
import { assertEmbeddingVector, assertProfileMatches, assertSupportedEmbeddingProfile, DEFAULT_EMBEDDING_PROFILE, normalizeSourceText } from "../src/domain/profile";
import type { QualifiedDispatchEvidence } from "./runtimeModelPolicyBootstrap";
import { qualifiedTerminalModelId } from "./runtimeModelPolicyBootstrap";
import { FACTS_JSON_SCHEMA } from "../src/domain/extraction";
import { CONFLICT_DECISION_JSON_SCHEMA } from "../src/domain/conflicts";
import { AGENT_TOOL_REGISTRY_VERSION, AGENT_TOOL_REGISTRY_VERSION_V2, agentToolCatalog, agentToolsInputBoundV2, agentToolsInputBound } from "../src/domain/agent-tools";
import { parseAgentLanguageResult } from "../src/domain/agent-language";
import type { AgentLanguageResultV1 } from "../src/domain/agent-language";
import type { Id } from "./_generated/dataModel";

type AttemptId = Id<"runtimeModelAttempts">;
type OperationId = Id<"runtimeModelOperations">;
type Source = { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string };
type NativeLanguageParams = Omit<LanguageModelV4CallOptions, "reasoning">;
export interface GatewayBinding {
  reference: RuntimeAuthorityReference; operationKey: ModelOperationKey; runBudgetId: string;
  semanticId: string; ordinal: number; source?: Source; parentOperationId?: OperationId;
}
function traceGateway(binding: GatewayBinding, phase: string, metadata: RuntimeLatencyMetadata = {}): void {
  if (process.env.CORTEX_RUNTIME_LATENCY_TRACE !== "1" || !binding || typeof binding.semanticId !== "string" || typeof binding.runBudgetId !== "string") return;
  const match = binding.semanticId.match(/^cortex:(run:[a-f0-9]{64}):(\d+):\d+$/);
  traceRuntimePhase(match?.[1] ?? binding.runBudgetId, match ? Number(match[2]) : 0, phase,
    { ...metadata, runBudgetId: binding.runBudgetId, semanticId: binding.semanticId, operationKey: binding.operationKey });
}
export interface GatewayResolution {
  snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence;
  storageLimits: { canonicalBytes: number; privateResultBytes: number; embeddingValuesPerCall: 1 };
}
type Reserved = { status: "reserved"; operationId: OperationId; attemptId: AttemptId; snapshot: ModelPolicySnapshotV1; requestCanonical: string };
export type GatewayAdmission = Reserved | { status: "replay"; operationId: OperationId; resultCanonical: string }
  | { status: "inflight" | "uncertain"; operationId: OperationId; attemptId: AttemptId; replayAllowed?: false };
export type GatewayCheckpoint =
  { dispatchPermit: true; dispatchIdentity: string; snapshot: ModelPolicySnapshotV1; requestCanonical: string }
  | { dispatchPermit: false; state: string; replayAllowed: false };
export type GatewayAdmissionCheckpoint = { admission: Extract<GatewayAdmission, { status: "reserved" }>; permit: GatewayCheckpoint }
  | { admission: Exclude<GatewayAdmission, { status: "reserved" }> };
export interface GatewayLedgerPort {
  resolve(args: Pick<GatewayBinding, "reference" | "operationKey" | "runBudgetId" | "source" | "parentOperationId">): Promise<GatewayResolution>;
  admit(args: GatewayBinding & { requestCanonical: string }): Promise<GatewayAdmission>;
  checkpoint(args: { reference: RuntimeAuthorityReference; attemptId: AttemptId; requestCanonical: string }): Promise<GatewayCheckpoint>;
  /** Trusted Agent-only parent retains original admission, binding and checkpoint in one transaction. */
  admitAndCheckpoint?(args: GatewayBinding & { requestCanonical: string; snapshotCanonical: string }): Promise<GatewayAdmissionCheckpoint>;
  markVisible(args: { reference: RuntimeAuthorityReference; attemptId: AttemptId; outputVisible: boolean; toolInputVisible: boolean; toolResultVisible: boolean; toolEffectCommitted: boolean }): Promise<{ recorded: true }>;
  attachTerminalResult(args: { reference: RuntimeAuthorityReference; attemptId: AttemptId; evidenceId: string; privateResultCanonical: string }): Promise<TerminalAttachmentAcknowledgment>;
}
export interface TerminalAttachmentAcknowledgment { attached: boolean; resultWithheld: boolean }
export type TerminalCaptureAcknowledgment = { evidenceId: string } | { evidenceId: string; state: "settled" | "confirmed_rejected" | "uncertain"; settledCostUnits?: number; overrun: boolean };
/** Trusted server composition only. Capture atomically records charge-only
 * evidence and accounts known/uncertain liability independently of delivery rights. It never
 * carries private output. Required current attachment atomically fences private result/visibility.
 * A minimum evidenceId acknowledgment is structural compatibility, never accounting truth. */
export interface DurableTerminalEvidenceSink {
  capture(evidence: { attemptId: AttemptId; dispatchIdentity: string; receiptCanonical: string }): Promise<TerminalCaptureAcknowledgment>;
}
/** Finite server-code composition bounds, independent of model price/token qualifications. */
export interface GatewayOwnedTiming { terminalObservationMs: number; terminalPersistenceMs: number; cleanupMs: number }
// Capture (including transaction retries) and attachment share one finite window.
export const DEFAULT_GATEWAY_OWNED_TIMING: Readonly<GatewayOwnedTiming> = Object.freeze({ terminalObservationMs: 100, terminalPersistenceMs: 5000, cleanupMs: 100 });
export interface GatewayComposition { ledger: GatewayLedgerPort; terminalSink: DurableTerminalEvidenceSink; now?: () => number; ownedTiming?: GatewayOwnedTiming }
export class GatewayDispatchError extends Error {
  constructor(readonly code: string) { super("Governed model call did not complete for delivery."); this.name = "GatewayDispatchError"; }
}
export interface GatewayLifecycle {
  readonly signal: AbortSignal;
  /** Already-issued noncancelable RPCs remain owned/observed; late results never enable delivery.
   * Pending is not proof of rollback, failed persistence, uncharged inference or completed RPC. */
  pendingWork(): Readonly<{ authority: number; capture: number; settlement: number; native: number; reader: number; cleanup: number }>;
  /** Observer unsubscribe alone never aborts the owned inference/drain. */
  cancel(): void;
  /** The execution owner MUST await this before completing its action. */
  complete(): Promise<void>;
  /** Server owner may retry only the retained idempotent capture; never inference or delivery.
   * This in-memory slot is not a durable outbox and does not survive action termination. */
  retryPendingTerminalEvidence(): Promise<boolean>;
  /** Only an already-issued exact attachment tuple may be retried/joined. Bookkeeping only:
   * no new private payload, inference, token lookup or revival of failed output. */
  retryPendingTerminalAttachment(): Promise<TerminalAttachmentAcknowledgment | undefined>;
  /** Explicit narrow authorized replay payload; never a fabricated native provider result. */
  consumeReplay(): Promise<{ text: string } | AgentLanguageResultV1 | { profile: typeof DEFAULT_EMBEDDING_PROFILE; vectors: number[][] } | undefined>;
}
function fail(code: string): never { throw new GatewayDispatchError(code); }
const utf8 = (text: string): number => {
  for (const point of text) { const n = point.codePointAt(0)!; if (n >= 0xd800 && n <= 0xdfff) fail("INVALID_UNICODE"); }
  return new TextEncoder().encode(text).length;
};
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
/** Capture descriptors before projection; optional undefined SDK fields are only allowed by name. */
function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("INVALID_NATIVE_REQUEST");
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_NATIVE_REQUEST");
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string" || !keys.includes(key)) fail("UNSUPPORTED_NATIVE_FIELD");
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!d.enumerable || !("value" in d)) fail("INVALID_NATIVE_REQUEST");
    if (d.value !== undefined) Object.defineProperty(result, key, { value: d.value, enumerable: true });
  }
  return result;
}
function arrayValues(input: unknown): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) fail("INVALID_NATIVE_REQUEST");
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).some((key) => typeof key !== "string" || (key !== "length" && !/^(0|[1-9]\d*)$/.test(key)))) fail("INVALID_NATIVE_REQUEST");
  const values: unknown[] = [];
  for (let i = 0; i < input.length; i++) { const d = descriptors[String(i)]; if (!d || !d.enumerable || !("value" in d)) fail("INVALID_NATIVE_REQUEST"); values.push(d.value); }
  if (Object.keys(descriptors).length !== values.length + 1) fail("INVALID_NATIVE_REQUEST");
  return values;
}
function stableId(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || value.trim() !== value) return false;
  utf8(value); return true;
}
/** Source is detached before any await; never normalized or inferred from prompt/model claims. */
function detachedBinding(input: GatewayBinding): GatewayBinding {
  const fields = record(input, ["reference", "operationKey", "runBudgetId", "semanticId", "ordinal", "source", "parentOperationId"]);
  if ("source" in fields) {
    const source = record(fields.source, ["sourceId", "sourceEventId", "sourceRevision", "contentHash"]);
    if (Object.keys(source).length !== 4 || !stableId(source.sourceId) || !stableId(source.sourceEventId)
      || !count(source.sourceRevision) || source.sourceRevision < 1 || typeof source.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(source.contentHash)) fail("INVALID_SOURCE");
  }
  return detached(fields) as unknown as GatewayBinding;
}
function checkedResolution(input: unknown): GatewayResolution {
  const fields = record(input, ["snapshot", "dispatchEvidence", "storageLimits"]);
  if (Object.keys(fields).length !== 3) fail("CAPABILITY_UNAVAILABLE");
  return detached(fields) as unknown as GatewayResolution;
}
function checkedAdmission(input: unknown): GatewayAdmission {
  const fields = record(input, ["status", "operationId", "attemptId", "snapshot", "requestCanonical", "resultCanonical", "replayAllowed"]);
  if (!stableId(fields.operationId)) fail("ADMITTED_REQUEST_MISMATCH");
  const keys = Reflect.ownKeys(input as object);
  const exact = (allowed: readonly string[], required: readonly string[]) => keys.every((key) => typeof key === "string" && allowed.includes(key)) && required.every((key) => key in fields);
  if (fields.status === "reserved" && exact(["status", "operationId", "attemptId", "snapshot", "requestCanonical"], ["attemptId", "snapshot", "requestCanonical"])
    && stableId(fields.attemptId) && typeof fields.requestCanonical === "string") return detached(fields) as unknown as GatewayAdmission;
  if (fields.status === "replay" && exact(["status", "operationId", "resultCanonical"], ["resultCanonical"]) && typeof fields.resultCanonical === "string") return detached(fields) as unknown as GatewayAdmission;
  if (["uncertain", "inflight"].includes(fields.status as string) && exact(["status", "operationId", "attemptId", "replayAllowed"], ["attemptId"])
    && stableId(fields.attemptId) && (!keys.includes("replayAllowed") || fields.replayAllowed === false)) return detached(fields) as unknown as GatewayAdmission;
  return fail("ADMITTED_REQUEST_MISMATCH");
}
/** Both the original action path and the Agent parent validate these same exact bytes before checkpoint. */
export function assertGatewayReservedRequest(admitted: Reserved, incoming: string, snapshotCanonical: string, canonicalBytes: number): void {
  const request = exactJSON(incoming, canonicalBytes) as unknown as ModelCallRequest;
  const flat = exactJSON(admitted.requestCanonical, canonicalBytes);
  const validated = validateModelRequest(admitted.snapshot, flat).request;
  const comparable = { ...validated, semanticId: request.semanticId, childCallId: request.childCallId };
  if (canonicalModelJson(comparable) !== canonicalModelJson(request) || canonicalModelJson(admitted.snapshot) !== snapshotCanonical) fail("ADMITTED_REQUEST_MISMATCH");
}
function checkedAdmissionCheckpoint(input: unknown): GatewayAdmissionCheckpoint {
  const fields = record(input, ["admission", "permit"]);
  const admission = checkedAdmission(fields.admission);
  if (admission.status === "reserved") {
    if (Object.keys(fields).length !== 2) fail("CHECKPOINT_MISMATCH");
    return { admission, permit: checkedPermit(fields.permit) };
  }
  if (Object.keys(fields).length !== 1) fail("CHECKPOINT_MISMATCH");
  return { admission };
}
function checkedPermit(input: unknown): Awaited<ReturnType<GatewayLedgerPort["checkpoint"]>> {
  const fields = record(input, ["dispatchPermit", "dispatchIdentity", "snapshot", "requestCanonical", "state", "replayAllowed"]);
  const keys = Reflect.ownKeys(input as object);
  if (fields.dispatchPermit === true && keys.length === 4 && ["dispatchPermit", "dispatchIdentity", "snapshot", "requestCanonical"].every((key) => key in fields)
    && stableId(fields.dispatchIdentity) && typeof fields.requestCanonical === "string") return detached(fields) as unknown as Awaited<ReturnType<GatewayLedgerPort["checkpoint"]>>;
  if (fields.dispatchPermit === false && keys.length === 3 && typeof fields.state === "string" && fields.replayAllowed === false) return { dispatchPermit: false, state: fields.state, replayAllowed: false };
  return fail("CHECKPOINT_MISMATCH");
}
function captureAcknowledgment(input: unknown): TerminalCaptureAcknowledgment {
  const ack = record(input, ["evidenceId", "state", "settledCostUnits", "overrun"]);
  if (!stableId(ack.evidenceId)) fail("TERMINAL_CAPTURE_PENDING");
  // Missing accounting fields are not projected to a fabricated settled state.
  if (Reflect.ownKeys(input as object).length === 1) return { evidenceId: ack.evidenceId };
  if (!["settled", "confirmed_rejected", "uncertain"].includes(ack.state as string) || typeof ack.overrun !== "boolean"
    || ("settledCostUnits" in ack && !count(ack.settledCostUnits))) fail("TERMINAL_CAPTURE_PENDING");
  // Explicit undefined is not a valid optional native accounting value.
  if (Object.getOwnPropertyDescriptor(input, "settledCostUnits") && !count(ack.settledCostUnits)) fail("TERMINAL_CAPTURE_PENDING");
  return ack as unknown as TerminalCaptureAcknowledgment;
}
function attachmentAcknowledgment(input: unknown): TerminalAttachmentAcknowledgment {
  const ack = record(input, ["attached", "resultWithheld"]);
  if (Reflect.ownKeys(input as object).length !== 2 || typeof ack.attached !== "boolean" || typeof ack.resultWithheld !== "boolean"
    || (!ack.attached && !ack.resultWithheld)) fail("TERMINAL_RECONCILIATION_PENDING");
  return { attached: ack.attached, resultWithheld: ack.resultWithheld };
}
/** Only the exact native structured conflict is definitive, never remote message text. */
function attachmentConflict(error: unknown): boolean {
  try {
    if (!(error instanceof ConvexError) || Object.getPrototypeOf(error) !== ConvexError.prototype) return false;
    const descriptor = Object.getOwnPropertyDescriptor(error, "data");
    if (!descriptor || !("value" in descriptor)) return false;
    const data = record(descriptor.value, ["version", "code", "message", "retryable", "outcome"]);
    return data.version === 1 && data.code === "IDEMPOTENCY_CONFLICT" && data.retryable === false;
  } catch { return false; }
}
function detached<T>(value: T): T { return JSON.parse(canonicalModelJson(value)) as T; }
function exactJSON(encoded: string, maximum: number): unknown {
  if (utf8(encoded) > maximum) fail("RESULT_BOUND_EXCEEDED");
  const value: unknown = JSON.parse(encoded);
  if (canonicalModelJson(value) !== encoded) fail("CANONICAL_MISMATCH");
  return value;
}
function json(encoded: unknown, maximum: number): string {
  const result = canonicalModelJson(encoded); if (utf8(result) > maximum) fail("RESULT_BOUND_EXCEEDED"); return result;
}
/** Outward microUSD decimal: exact decimal strings stay exact; IEEE numbers are rounded UP
 * from their upper adjacent representable value, then to integer microUSD. No exponent/NaN. */
export function conservativeUsdDecimal(value: unknown): string | undefined {
  if (typeof value === "string") return /^\d+(?:\.\d+)?$/.test(value) && value.length <= 80 ? value : undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || Object.is(value, -0)) return undefined;
  if (value === 0) return "0";
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  const bits = view.getBigUint64(0) + 1n; const exponent = Number((bits >> 52n) & 0x7ffn);
  if (exponent === 0x7ff) return undefined;
  const significand = (bits & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n);
  const power = (exponent || 1) - 1023 - 52;
  const numerator = significand * 1_000_000n * (power >= 0 ? 1n << BigInt(power) : 1n);
  const denominator = power < 0 ? 1n << BigInt(-power) : 1n;
  const units = (numerator + denominator - 1n) / denominator;
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return `${units / 1_000_000n}.${(units % 1_000_000n).toString().padStart(6, "0")}`;
}
function embeddingResultCeiling(proof: QualifiedDispatchEvidence): number {
  return proof.nativeInterface === "embedding" && proof.inputBound.featureEnvelope === "profile-embedding-v1"
    && proof.embeddingProfile?.modelId === "openai/text-embedding-3-large" ? 131_072 : 60_000;
}
function proofFor(resolution: GatewayResolution, now: number): void {
  const { snapshot: s, dispatchEvidence: p, storageLimits: limits } = resolution;
  if (qualifiedTerminalModelId(p) === undefined || p.receiptId !== s.qualificationReceiptId || p.modelId !== s.modelId || p.nativeInterface !== s.nativeInterface
    || p.providerVersion !== "0.2.1" || p.priceRevision !== s.pins.priceRevision || p.boundRevision !== s.pins.boundRevision
    || p.checkedAt > now || p.expiresAt <= now || p.terminalProof !== "provider-terminal-v1"
    || ![p.evidenceHash, p.inputBound.nativeTransformHash, p.inputBound.documentHash, p.inputBound.proofHash, p.resultBound.proofHash].every((h) => /^[a-f0-9]{64}$/.test(h))
    || p.inputBound.revision !== 1 || !count(p.resultBound.maximumOutputTokens) || !count(p.resultBound.maximumPrivateResultBytes)
    || p.resultBound.maximumPrivateResultBytes < 1 || p.resultBound.maximumPrivateResultBytes > embeddingResultCeiling(p)
    || !count(limits.canonicalBytes) || limits.canonicalBytes < 1 || !count(limits.privateResultBytes) || limits.privateResultBytes < 1 || limits.canonicalBytes > 180_000 || limits.privateResultBytes > embeddingResultCeiling(p) || limits.embeddingValuesPerCall !== 1 || p.resultBound.maximumEmbeddingValues !== 1) fail("CAPABILITY_UNAVAILABLE");
  if (p.inputBound.featureEnvelope === MEMORY_JSON_OBJECT_CONTRACT.featureEnvelope || p.inputBound.ruleId === MEMORY_JSON_OBJECT_CONTRACT.inputRule
    || s.pins.promptVersion === MEMORY_JSON_OBJECT_CONTRACT.promptVersion || s.pins.boundRevision === MEMORY_JSON_OBJECT_CONTRACT.boundRevision) {
    if (s.operationKey !== "memory.extract" || s.nativeInterface !== "chat" || s.modelId !== MEMORY_JSON_OBJECT_CONTRACT.modelId
      || p.inputBound.featureEnvelope !== MEMORY_JSON_OBJECT_CONTRACT.featureEnvelope || p.inputBound.ruleId !== MEMORY_JSON_OBJECT_CONTRACT.inputRule
      || s.pins.promptVersion !== MEMORY_JSON_OBJECT_CONTRACT.promptVersion || s.pins.boundRevision !== MEMORY_JSON_OBJECT_CONTRACT.boundRevision
      || s.pins.schemaVersion !== MEMORY_JSON_OBJECT_CONTRACT.schemaVersion || s.pins.toolRegistryVersion !== MEMORY_JSON_OBJECT_CONTRACT.toolRegistryVersion
      || s.allowedOptions.length || s.allowedTools.length || s.capabilities.includes("tools") || s.fallbackCandidates.length
      || s.limits.inputTokens > MEMORY_JSON_OBJECT_CONTRACT.maximumInputTokens || s.limits.contextTokens > MEMORY_JSON_OBJECT_CONTRACT.maximumContextTokens
      || s.limits.outputTokens > MEMORY_JSON_OBJECT_CONTRACT.maximumOutputTokens || s.limits.toolSteps
      || s.limits.timeoutMs > 60000
      || s.costBound.maximumCostUnits !== MEMORY_JSON_OBJECT_CONTRACT.maximumCostUnits
      || !p.resultBound.maximumOutputTokens || p.resultBound.maximumOutputTokens > MEMORY_JSON_OBJECT_CONTRACT.maximumOutputTokens || p.supportsStream || p.toolContract || p.embeddingProfile || p.mediaContract) fail("CAPABILITY_UNAVAILABLE");
    return;
  }
  if (s.nativeInterface === "chat" && p.inputBound.ruleId === "plain-chat-cookbook-utf8-v1" && p.inputBound.featureEnvelope === "plain-chat-v1" && !s.capabilities.includes("tools")) return;
  if (s.nativeInterface === "chat" && p.inputBound.ruleId === "agent-tools-chat-utf8-v1" && ["agent-tools-chat-v1", "agent-tools-chat-v2"].includes(p.inputBound.featureEnvelope)
    && s.operationKey === "agent.respond" && s.capabilities.includes("tools") && s.pins.toolRegistryVersion === p.toolContract?.registryVersion
    && !!p.toolContract && !!agentToolCatalog(p.toolContract.registryVersion) && p.toolContract.toolsCanonical === canonicalModelJson(agentToolCatalog(p.toolContract.registryVersion))
    && ((p.inputBound.featureEnvelope === "agent-tools-chat-v1") === (p.toolContract.registryVersion === AGENT_TOOL_REGISTRY_VERSION))
    && count(p.toolContract.maximumToolCalls) && p.toolContract.maximumToolCalls >= 1 && p.toolContract.maximumToolCalls <= 4
    && s.limits.toolSteps <= p.toolContract.maximumToolCalls) return;
  if (s.nativeInterface === "embedding" && p.inputBound.ruleId === "default-embedding-utf8-v1" && p.inputBound.featureEnvelope === "default-embedding-v1") {
    assertProfileMatches(s.semanticProfile!); return;
  }
  if (s.nativeInterface === "embedding" && p.inputBound.ruleId === "profile-embedding-utf8-v1" && p.inputBound.featureEnvelope === "profile-embedding-v1" && p.embeddingProfile) {
    assertSupportedEmbeddingProfile(p.embeddingProfile); assertProfileMatches(s.semanticProfile!, p.embeddingProfile); return;
  }
  fail("CAPABILITY_UNAVAILABLE");
}
function requestBase(s: ModelPolicySnapshotV1, binding: GatewayBinding): ModelCallRequest {
  return { semanticId: binding.semanticId, childCallId: "pending-server-identity", texts: [], inputTokens: 1, outputTokens: 0,
    toolSteps: 0, timeoutMs: s.limits.timeoutMs, reservationUnits: s.costBound.maximumCostUnits, tools: [], options: { maxRetries: 0 },
    promptVersion: s.pins.promptVersion, schemaVersion: s.pins.schemaVersion, extractionVersion: s.pins.extractionVersion, toolRegistryVersion: s.pins.toolRegistryVersion };
}
const standardKeys = ["prompt", "maxOutputTokens", "temperature", "topP", "seed", "stopSequences", "topK", "presencePenalty", "frequencyPenalty", "responseFormat", "tools", "toolChoice", "headers", "providerOptions", "reasoning", "includeRawChunks", "abortSignal"];
/** Trusted backend Agent composition only. Agent owns a DeltaStreamer controller;
 * the ledger wrapper owns inference/drain. Join cancellation without admitting a
 * caller-selected native controller into the governed provider itself. The owner
 * disposes this bridge after lifecycle.complete(), including its error paths. */
export function createAgentGatewayCancellationBridge(model: LanguageModelV4, lifecycle: GatewayLifecycle): { model: LanguageModelV4; dispose(): void } {
  const listeners = new Map<AbortSignal, () => void>(); let disposed = false;
  const adapt = (params: LanguageModelV4CallOptions): LanguageModelV4CallOptions => {
    if (disposed) fail("RUN_CANCELLED");
    const native = { ...record(params, standardKeys) }; const signal = native.abortSignal;
    // AI SDK7 emits auto even when it advertises no tools. It carries no tool
    // capability or selection in that exact empty case; other choices stay gated.
    if (native.tools === undefined && native.toolChoice !== undefined
      && canonicalModelJson(native.toolChoice) === '{"type":"auto"}') delete native.toolChoice;
    // Pinned AI SDK7 generateText adds this transport-only default even when
    // the Agent supplied no headers. Strip only that exact descriptor here;
    // the governed model still rejects every caller header/provider option.
    if (native.headers !== undefined) {
      const headers = record(native.headers, ["user-agent"]);
      if (canonicalModelJson(headers) !== '{"user-agent":"ai/7.0.127"}') fail("UNSUPPORTED_NATIVE_FIELD");
      delete native.headers;
    }
    if (signal !== undefined && signal !== lifecycle.signal) {
      if (!(signal instanceof AbortSignal)) fail("UNTRUSTED_ABORT_SIGNAL");
      if (!listeners.has(signal)) { const abort = () => lifecycle.cancel(); listeners.set(signal, abort); signal.addEventListener("abort", abort, { once: true }); }
      if (signal.aborted) lifecycle.cancel();
    }
    return { ...native, abortSignal: lifecycle.signal } as unknown as LanguageModelV4CallOptions;
  };
  return { model: { specificationVersion: "v4", provider: model.provider, modelId: model.modelId, supportedUrls: model.supportedUrls,
    doGenerate: async params => await model.doGenerate(adapt(params)), doStream: async params => await model.doStream(adapt(params)) },
    dispose: () => { disposed = true; for (const [signal, listener] of listeners) signal.removeEventListener("abort", listener); listeners.clear(); } };
}
function agentToolEnvelope(value: string): boolean {
  return value === "agent-tools-chat-v1" || value === "agent-tools-chat-v2";
}
/** Scalar diagnostics at the original request validator, never policy inputs. */
function traceModelBounds(binding: GatewayBinding, snapshot: ModelPolicySnapshotV1, request: ModelCallRequest, stage: "native" | "preflight"): void {
  if (typeof process === "undefined" || process.env.CORTEX_RUNTIME_LATENCY_TRACE !== "1") return;
  const hash = (value: string) => createSha256().update(value).digestHex();
  const fields = ["inputTokens", "outputTokens", "toolSteps", "timeoutMs", "contextTokens"] as const;
  const dimensions = { inputTokens: request.inputTokens, outputTokens: request.outputTokens, toolSteps: request.toolSteps,
    timeoutMs: request.timeoutMs, contextTokens: request.inputTokens + request.outputTokens };
  console.log(JSON.stringify({ phase: "gateway.model.bounds", stage, semanticIdHash: hash(binding.semanticId), runBudgetIdHash: hash(binding.runBudgetId),
    ordinal: binding.ordinal, modelIdentityHash: hash(canonicalModelJson([snapshot.modelId, snapshot.nativeInterface, snapshot.pins])),
    dimensions: Object.fromEntries(fields.filter(key => count(dimensions[key])).map(key => [key, dimensions[key]])),
    limits: Object.fromEntries(fields.filter(key => count(snapshot.limits[key])).map(key => [key, snapshot.limits[key]])),
    exceeded: fields.filter(key => dimensions[key] > snapshot.limits[key]) }));
}
function languageParams(input: LanguageModelV4CallOptions, s: ModelPolicySnapshotV1, p: QualifiedDispatchEvidence, binding: GatewayBinding, signal: AbortSignal, stage: "native" | "preflight" = "native"): { params: NativeLanguageParams; request: ModelCallRequest } {
  const native = record(input, standardKeys);
  const agent = agentToolEnvelope(p.inputBound.featureEnvelope);
  const jsonObject = p.inputBound.featureEnvelope === MEMORY_JSON_OBJECT_CONTRACT.featureEnvelope;
  for (const key of ["topK", "presencePenalty", "frequencyPenalty", "headers", "providerOptions", "reasoning", ...agent ? [] : ["tools", "toolChoice"]]) if (key in native) fail("UNSUPPORTED_NATIVE_FIELD");
  // AI SDK7 always supplies false for ordinary streams. Only the governed
  // wrapper may turn raw observation on; provider chunks never enter public DTOs.
  if ("includeRawChunks" in native && native.includeRawChunks !== false) fail("UNSUPPORTED_NATIVE_FIELD");
  if (native.abortSignal !== undefined && native.abortSignal !== signal) fail("UNTRUSTED_ABORT_SIGNAL");
  if (jsonObject ? native.responseFormat === undefined || canonicalModelJson(native.responseFormat) !== '{"type":"json"}'
    : native.responseFormat !== undefined && canonicalModelJson(native.responseFormat) !== '{"type":"text"}') fail("CAPABILITY_UNAVAILABLE");
  if (jsonObject && ["temperature", "topP", "seed", "stopSequences"].some(key => native[key] !== undefined)) fail("UNSUPPORTED_NATIVE_FIELD");
  if (!Array.isArray(native.prompt)) fail("INVALID_NATIVE_REQUEST");
  // Canonical validation catches sparse/custom-iterator arrays BEFORE map/iteration.
  const messages: NonNullable<ModelCallRequest["messages"]> = arrayValues(native.prompt).map((message: unknown) => {
    const m = record(message, ["role", "content", "providerOptions"]); if ("providerOptions" in m) fail("UNSUPPORTED_NATIVE_FIELD");
    if (!["system", "user", "assistant", ...agent ? ["tool"] : []].includes(m.role as string)) fail("CAPABILITY_UNAVAILABLE");
    if (m.role === "system") {
      if (typeof m.content !== "string") fail("INVALID_NATIVE_REQUEST"); utf8(m.content);
      return { role: "system", parts: [{ type: "text", text: normalizeSourceText(m.content) }] };
    }
    const values = arrayValues(m.content); if (!values.length || (!agent && values.length !== 1)) fail("CAPABILITY_UNAVAILABLE");
    const parts = values.map((value): NonNullable<ModelCallRequest["messages"]>[number]["parts"][number] => {
      const part = record(value, ["type", "text", "toolCallId", "toolName", "input", "output", "providerExecuted", "providerOptions"]);
      if ("providerOptions" in part || (part.providerExecuted !== undefined && part.providerExecuted !== false)) fail("UNSUPPORTED_NATIVE_FIELD");
      if (part.type === "text") {
        if (Object.keys(part).some(key => !["type", "text"].includes(key)) || typeof part.text !== "string") fail("INVALID_NATIVE_REQUEST");
        utf8(part.text); return { type: "text", text: normalizeSourceText(part.text) };
      }
      if (!agent || !stableId(part.toolCallId) || typeof part.toolName !== "string") fail("CAPABILITY_UNAVAILABLE");
      if (part.type === "tool-call") {
        if (Object.keys(part).some(key => !["type", "toolCallId", "toolName", "input", "providerExecuted"].includes(key))) fail("INVALID_NATIVE_REQUEST");
        const input = detached(part.input); if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_NATIVE_REQUEST");
        return { type: "tool-call", toolCallId: part.toolCallId, toolName: part.toolName, input: input as Record<string, unknown> };
      }
      if (part.type === "tool-result") {
        if (Object.keys(part).some(key => !["type", "toolCallId", "toolName", "output"].includes(key))) fail("INVALID_NATIVE_REQUEST");
        const output = record(part.output, ["type", "value", "reason"]);
        if (output.type === "execution-denied") {
          if (Object.keys(output).some(key => !["type", "reason"].includes(key)) || (output.reason !== undefined && typeof output.reason !== "string")) fail("INVALID_NATIVE_REQUEST");
        } else if (!["text", "json", "error-text", "error-json"].includes(output.type as string) || !("value" in output) || "reason" in output
          || (["text", "error-text"].includes(output.type as string) && typeof output.value !== "string")) fail("CAPABILITY_UNAVAILABLE");
        return { type: "tool-result", toolCallId: part.toolCallId, toolName: part.toolName, output: detached(output) };
      }
      return fail("CAPABILITY_UNAVAILABLE");
    });
    return { role: m.role as "user" | "assistant" | "tool", parts };
  });
  if (!count(native.maxOutputTokens) || native.maxOutputTokens === 0 || native.maxOutputTokens > p.resultBound.maximumOutputTokens) fail("OUTPUT_BOUND_EXCEEDED");
  const request = requestBase(s, binding); request.messages = messages; request.texts = messages.flatMap(m => m.parts.flatMap(part => part.type === "text" ? [part.text] : []));
  if (agent) {
    request.tools = native.tools === undefined ? [] : arrayValues(native.tools).map(value => {
      const tool = record(value, ["type", "name", "description", "inputSchema", "strict", "inputExamples", "providerOptions"]);
      const expected = agentToolCatalog(s.pins.toolRegistryVersion)?.find(entry => entry.name === tool.name);
      if (!expected || canonicalModelJson(tool) !== canonicalModelJson(expected)) fail("UNQUALIFIED_TOOL_DEFINITION");
      return { name: expected.name, definition: detached({ description: expected.description, inputSchema: expected.inputSchema }) };
    });
    if (native.toolChoice !== undefined) request.toolChoice = detached(record(native.toolChoice, ["type", "toolName"])) as ModelCallRequest["toolChoice"];
    request.toolSteps = request.tools.length ? s.limits.toolSteps : 0;
    const calls = new Map<string, string>(), results = new Set<string>();
    for (const message of messages) for (const part of message.parts) {
      if (part.type === "tool-call") { if (calls.has(part.toolCallId)) fail("INVALID_TOOL_HISTORY"); calls.set(part.toolCallId, part.toolName); }
      if (part.type === "tool-result") { if (calls.get(part.toolCallId) !== part.toolName || results.has(part.toolCallId)) fail("INVALID_TOOL_HISTORY"); results.add(part.toolCallId); }
    }
    if (calls.size !== results.size) fail("INVALID_TOOL_HISTORY");
    request.inputTokens = (s.pins.toolRegistryVersion === AGENT_TOOL_REGISTRY_VERSION_V2 ? agentToolsInputBoundV2 : agentToolsInputBound)(canonicalModelJson({ messages, tools: request.tools, ...request.toolChoice ? { toolChoice: request.toolChoice } : {} }), messages.length, request.tools.length);
  } else request.inputTokens = 3 + messages.reduce((n, m, index) => n + 3 + utf8(m.role) + utf8(request.texts[index]!), 0);
  request.outputTokens = native.maxOutputTokens;
  if (jsonObject) {
    request.responseFormat = { type: "json" };
    request.inputTokens = memoryJsonObjectInputBound(messages, request.outputTokens);
  }
  // Semantic schemas come from the operation contract, never caller provider options.
  if (s.operationKey === "memory.extract") {
    if (s.pins.schemaVersion !== "facts-v1") fail("CAPABILITY_UNAVAILABLE");
    request.outputSchema = detached(FACTS_JSON_SCHEMA);
  } else if (s.operationKey === "facts.resolve") {
    if (s.pins.schemaVersion !== "conflicts-v1") fail("CAPABILITY_UNAVAILABLE");
    request.outputSchema = detached(CONFLICT_DECISION_JSON_SCHEMA);
  }
  for (const key of ["temperature", "topP", "seed", "stopSequences"] as const) if (native[key] !== undefined) Object.assign(request.options, { [key]: detached(native[key]) });
  traceModelBounds(binding, s, request, stage);
  let checked: Readonly<ModelCallRequest>;
  try { checked = validateModelRequest(s, request).request; }
  catch (error) {
    // A known pre-dispatch bounds refusal is typed on this new path only.
    // Other validation/product exceptions retain their original identity.
    if (stage === "preflight" && error instanceof Error && error.message === "POLICY_DENIED: request exceeds bounded limits") return fail("POLICY_DENIED");
    throw error;
  }
  return { request: detached(checked), params: nativeLanguage(checked, signal) };
}
/** Only the installed AI SDK's closed text/tool shapes are projected early.
 * Unrecognized shapes retain the original Agent/SDK/native validation path. */
export type AgentRequestPreflightInput = { messages: readonly ModelMessage[]; context: string; instructions: string; tools: readonly string[]; maxOutputTokens: number };
function plainProjection(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return undefined;
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== "string" || !keys.includes(key) || !d.enumerable || !("value" in d)) return undefined;
    if (d.value !== undefined) result[key] = d.value;
  }
  return result;
}
function plainArray(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return undefined;
  if (Reflect.ownKeys(value).length !== value.length + 1) return undefined;
  const result: unknown[] = [];
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !d.enumerable || !("value" in d)) return undefined;
    result.push(d.value);
  }
  return result;
}
export function preflightAgentModelRequest(input: AgentRequestPreflightInput, resolution: GatewayResolution, binding: GatewayBinding): { supported: false } | { supported: true; requestCanonical: string } {
  if (!agentToolEnvelope(resolution.dispatchEvidence.inputBound.featureEnvelope)) return { supported: false };
  const source = plainArray(input.messages); if (!source) return { supported: false };
  const prompt: LanguageModelV4CallOptions["prompt"] = [{ role: "system", content: input.instructions }];
  for (const value of [...source, ...input.context ? [{ role: "system", content: `Authorized Cortex context (untrusted evidence):\n${input.context}` }] : []]) {
    const message = plainProjection(value, ["role", "content", "providerOptions"]);
    if (!message || "providerOptions" in message) return { supported: false };
    if (message.role === "system") {
      if (typeof message.content !== "string") return { supported: false };
      prompt.push({ role: "system", content: message.content }); continue;
    }
    if (!["user", "assistant", "tool"].includes(message.role as string)) return { supported: false };
    if (typeof message.content === "string") {
      if (message.role === "tool") return { supported: false };
      prompt.push({ role: message.role as "user" | "assistant", content: [{ type: "text", text: message.content }] }); continue;
    }
    const values = plainArray(message.content); if (!values) return { supported: false };
    const content: Record<string, unknown>[] = [];
    for (const value of values) {
      const part = plainProjection(value, ["type", "text", "toolCallId", "toolName", "input", "output", "providerExecuted", "providerOptions"]);
      if (!part || "providerOptions" in part || (part.providerExecuted !== undefined && part.providerExecuted !== false)) return { supported: false };
      if (part.type === "text" && message.role !== "tool") {
        if (typeof part.text !== "string" || Object.keys(part).some(key => !["type", "text"].includes(key))) return { supported: false };
        if (part.text !== "") content.push(part); continue;
      }
      if (part.type === "tool-call" && message.role === "assistant") {
        if (Object.keys(part).some(key => !["type", "toolCallId", "toolName", "input", "providerExecuted"].includes(key))) return { supported: false };
        content.push(part); continue;
      }
      if (part.type === "tool-result" && message.role !== "user") {
        if (Object.keys(part).some(key => !["type", "toolCallId", "toolName", "output"].includes(key))) return { supported: false };
        const output = plainProjection(part.output, ["type", "value", "reason"]);
        if (!output || !["text", "json", "error-text", "error-json", "execution-denied"].includes(output.type as string)) return { supported: false };
        content.push(part); continue;
      }
      return { supported: false };
    }
    if (message.role === "tool" && !content.length) continue;
    const last = prompt[prompt.length - 1];
    if (message.role === "tool" && last?.role === "tool") last.content.push(...content as unknown as typeof last.content);
    else prompt.push({ role: message.role, content } as unknown as LanguageModelV4CallOptions["prompt"][number]);
  }
  // The installed SDK rejects an unresolved local tool call before a later
  // user/system message (and at the end). Leave that SDK error path intact.
  const outstanding = new Set<string>();
  for (const message of prompt) {
    if (message.role === "system" || message.role === "user") { if (outstanding.size) return { supported: false }; }
    if (message.role === "assistant") for (const part of message.content) if (part.type === "tool-call" && !part.providerExecuted) outstanding.add(part.toolCallId);
    if (message.role === "tool") for (const part of message.content) if (part.type === "tool-result") outstanding.delete(part.toolCallId);
  }
  if (outstanding.size) return { supported: false };
  const catalog = agentToolCatalog(resolution.snapshot.pins.toolRegistryVersion);
  if (!catalog || input.tools.some(name => !catalog.some(tool => tool.name === name))) return { supported: false };
  const tools = input.tools.map(name => detached(catalog.find(tool => tool.name === name)!)) as unknown as NonNullable<LanguageModelV4CallOptions["tools"]>;
  const signal = new AbortController().signal;
  const projected = languageParams({ prompt, maxOutputTokens: input.maxOutputTokens, ...(tools.length ? { tools, toolChoice: { type: "auto" as const } } : {}) },
    resolution.snapshot, resolution.dispatchEvidence, binding, signal, "preflight");
  return { supported: true, requestCanonical: canonicalModelJson(projected.request) };
}
function nativeLanguage(request: Readonly<ModelCallRequest>, signal: AbortSignal): NativeLanguageParams {
  // The closed catalogue and message validators establish these official V4 shapes.
  const prompt = request.messages!.map(m => m.role === "system" ? { role: "system", content: (m.parts[0] as { text: string }).text }
    : { role: m.role, content: m.parts.map(part => detached(part)) }) as LanguageModelV4CallOptions["prompt"];
  const tools = request.tools.map(tool => ({ type: "function", name: tool.name, ...detached(tool.definition) })) as NonNullable<LanguageModelV4CallOptions["tools"]>;
  return { prompt, ...tools.length ? { tools } : {}, ...request.toolChoice ? { toolChoice: detached(request.toolChoice) } : {},
  ...request.responseFormat ? { responseFormat: detached(request.responseFormat) } : {},
  maxOutputTokens: request.outputTokens, ...request.options.temperature !== undefined ? { temperature: request.options.temperature } : {},
  ...request.options.topP !== undefined ? { topP: request.options.topP } : {}, ...request.options.seed !== undefined ? { seed: request.options.seed } : {},
  ...request.options.stopSequences ? { stopSequences: [...request.options.stopSequences] } : {}, abortSignal: signal };
}
function nativeIdentity(params: LanguageModelV4CallOptions): string { const { abortSignal: _signal, includeRawChunks: _raw, ...data } = params; return canonicalModelJson(data); }
function usageOf(raw: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, field] of [["prompt_tokens", "inputTokens"], ["completion_tokens", "outputTokens"], ["total_tokens", "totalTokens"]]) if (count(raw[key!])) result[field!] = raw[key!] as number;
  const prompt = raw.prompt_tokens_details; const completion = raw.completion_tokens_details;
  if (prompt && typeof prompt === "object" && count((prompt as Record<string, unknown>).cached_tokens)) result.cachedInputTokens = (prompt as { cached_tokens: number }).cached_tokens;
  if (completion && typeof completion === "object" && count((completion as Record<string, unknown>).reasoning_tokens)) result.reasoningTokens = (completion as { reasoning_tokens: number }).reasoning_tokens;
  return result;
}
function nativeUsage(raw: Record<string, unknown> | undefined): LanguageModelV4Usage {
  const u = raw ? usageOf(raw) : {};
  return { inputTokens: { total: u.inputTokens, noCache: undefined, cacheRead: u.cachedInputTokens, cacheWrite: undefined }, outputTokens: { total: u.outputTokens, text: undefined, reasoning: u.reasoningTokens } };
}
const terminalReasons = ["stop", "length", "content_filter"];
function finishReason(reason: string): AgentLanguageResultV1["finishReason"] {
  return reason === "tool_calls" ? "tool-calls" : reason === "length" ? "length" : reason === "content_filter" ? "content-filter" : "stop";
}
function qualifiedReason(reason: unknown, resolution: GatewayResolution): reason is string {
  return typeof reason === "string" && (terminalReasons.includes(reason)
    || (reason === "tool_calls" && agentToolEnvelope(resolution.dispatchEvidence.inputBound.featureEnvelope)));
}
function languageOutput(content: unknown, reason: string, request: ModelCallRequest, resolution: GatewayResolution):
  { canonical: string; content: AgentLanguageResultV1["content"] } | undefined {
  try {
    const parts = arrayValues(content).flatMap((input): AgentLanguageResultV1["content"] => {
      const part = detached(input) as Record<string, unknown>;
      if (part.type === "reasoning") return [];
      if (part.type === "text" && typeof part.text === "string") { utf8(part.text); return part.text ? [{ type: "text", text: part.text }] : []; }
      if (part.type === "tool-call" && part.providerExecuted !== true && part.dynamic !== true
        && typeof part.toolCallId === "string" && typeof part.toolName === "string" && typeof part.input === "string") {
        return [{ type: "tool-call", toolCallId: part.toolCallId, toolName: part.toolName, input: part.input }];
      }
      fail("UNSUPPORTED_MODEL_OUTPUT");
    });
    const maximum = Math.min(resolution.storageLimits.privateResultBytes, resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes);
    if (!agentToolEnvelope(resolution.dispatchEvidence.inputBound.featureEnvelope)) {
      if (!parts.length || parts.some(part => part.type !== "text") || reason === "tool_calls") return undefined;
      const text = parts.map(part => part.type === "text" ? part.text : "").join("");
      return { canonical: json({ text }, maximum), content: [{ type: "text", text }] };
    }
    const choice = request.toolChoice;
    const allowed = choice?.type === "none" ? [] : request.tools.map(tool => tool.name);
    const parsed = parseAgentLanguageResult({ version: 1, kind: "language", content: parts, finishReason: finishReason(reason) }, allowed, request.toolSteps);
    if (!parsed || ((choice?.type === "required" || choice?.type === "tool") && parsed.finishReason !== "tool-calls")
      || (choice?.type === "tool" && parsed.content.some(part => part.type === "tool-call" && part.toolName !== choice.toolName))) return undefined;
    return { canonical: json(parsed, maximum), content: parsed.content };
  } catch { return undefined; }
}
function matchingNativeToolCalls(content: AgentLanguageResultV1["content"], choice: unknown): boolean {
  try {
    const expected = content.filter(part => part.type === "tool-call");
    const message = providerJSON(providerJSON(choice)?.message);
    const wire = message?.tool_calls === undefined ? [] : arrayValues(message.tool_calls);
    if (wire.length !== expected.length) return false;
    return wire.every((input, index) => {
      const call = providerJSON(input); const fn = providerJSON(call?.function); const part = expected[index]!;
      return call?.type === "function" && call.id === part.toolCallId && fn?.name === part.toolName && typeof fn.arguments === "string"
        && canonicalModelJson(JSON.parse(fn.arguments)) === part.input;
    });
  } catch { return false; }
}
/** Generated provider bodies are untrusted, descriptor-safe detached JSON before observation. */
function providerJSON(input: unknown): Record<string, unknown> | undefined {
  try { const value: unknown = typeof input === "string" ? JSON.parse(input) : detached(input);
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined; return value as Record<string, unknown>;
  } catch { return undefined; }
}
export async function createGovernedGatewayModel(composition: GatewayComposition, inputBinding: GatewayBinding): Promise<{ model: LanguageModelV4 | EmbeddingModelV4; lifecycle: GatewayLifecycle }> {
  requireSink(composition);
  const started = Date.now(); const binding = detachedBinding(inputBinding); traceGateway(binding, "gateway.construct.begin");
  const resolution = checkedResolution(await composition.ledger.resolve(resolveArgs(binding))); proofFor(resolution, (composition.now ?? Date.now)());
  traceGateway(binding, "gateway.construct.end", { durationMs: Date.now() - started });
  return resolution.snapshot.nativeInterface === "embedding"
    ? governGatewayEmbeddingModel(convexGateway.embeddingModel(resolution.snapshot.modelId), composition, binding, resolution)
    : governGatewayLanguageModel(convexGateway(resolution.snapshot.modelId), composition, binding, resolution);
}
function resolveArgs(binding: GatewayBinding): Pick<GatewayBinding, "reference" | "operationKey" | "runBudgetId" | "source" | "parentOperationId"> {
  return { reference: binding.reference, operationKey: binding.operationKey, runBudgetId: binding.runBudgetId,
    ...(binding.source ? { source: binding.source } : {}), ...(binding.parentOperationId ? { parentOperationId: binding.parentOperationId } : {}) };
}
function requireSink(composition: GatewayComposition): void {
  if (!composition.terminalSink || typeof composition.terminalSink.capture !== "function") fail("DURABLE_TERMINAL_SINK_REQUIRED");
  if (!composition.ledger || typeof composition.ledger.attachTerminalResult !== "function") fail("TERMINAL_ATTACHMENT_REQUIRED");
}
function stateFor(composition: GatewayComposition, inputBinding: GatewayBinding, inputResolution: GatewayResolution) {
  requireSink(composition); const binding = detachedBinding(inputBinding); const resolution = checkedResolution(inputResolution);
  proofFor(resolution, (composition.now ?? Date.now)());
  if (!count(binding.ordinal) || !stableId(binding.semanticId) || !stableId(binding.runBudgetId)) fail("INVALID_BINDING");
  const timing = detached(composition.ownedTiming ?? DEFAULT_GATEWAY_OWNED_TIMING);
  for (const [value, maximum] of [[timing.terminalObservationMs, 1000], [timing.terminalPersistenceMs, 10000], [timing.cleanupMs, 1000]] as const) {
    if (!count(value) || value < 1 || value > maximum) fail("INVALID_OWNED_TIMING");
  }
  const controller = new AbortController(); const tasks: Promise<unknown>[] = []; let replay: string | undefined;
  let deliveryDeadline = Infinity; let observationDeadline = Infinity; let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
  type WorkKind = "authority" | "capture" | "settlement" | "native" | "reader" | "cleanup";
  const pendingRPCs = new Set<{ kind: WorkKind; promise: Promise<unknown> }>();
  // Every issued operation has a retained promise and BOTH late completion handlers. A finite
  // wait does not cancel/rollback a Convex RPC; pendingWork exposes that unresolved boundary.
  // Handlers only retire observation slots: they cannot enqueue, settle again or attach output.
  function track<T>(kind: WorkKind, invoke: () => PromiseLike<T>): Promise<T> {
    let promise: Promise<T>; try { promise = Promise.resolve(invoke()); } catch (error) { promise = Promise.reject(error); }
    const slot = { kind, promise }; pendingRPCs.add(slot);
    promise.then(() => { pendingRPCs.delete(slot); }, () => { pendingRPCs.delete(slot); }); return promise;
  }
  function own<T>(invoke: () => Promise<T>): Promise<T> {
    const task = invoke(); const joined = task.then(() => undefined, () => undefined); tasks.push(joined); return task;
  }
  controller.signal.addEventListener("abort", () => { observationDeadline = Math.min(observationDeadline, Date.now() + timing.terminalObservationMs); });
  function startLifetime(timeoutMs: number): void {
    assertDelivery(); deliveryDeadline = Date.now() + timeoutMs; observationDeadline = deliveryDeadline + timing.terminalObservationMs;
    lifetimeTimer = setTimeout(() => controller.abort(), timeoutMs);
  }
  function endLifetime(): void { if (lifetimeTimer) clearTimeout(lifetimeTimer); }
  function canDeliver(): boolean {
    if (Date.now() >= deliveryDeadline && !controller.signal.aborted) controller.abort();
    return !controller.signal.aborted;
  }
  function assertDelivery(): void { if (!canDeliver()) fail("RUN_CANCELLED"); }
  /** Bounded wait with handled late outcome. Observation waits shorten their deadline on abort;
   * delivery waits fail on abort; persistence ignores delivery abort to retain known charges. */
  function wait<T>(promise: Promise<T>, deadline: () => number, code: string, mode: "delivery" | "observation" | "persistence"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let finished = false; let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (value?: T, error?: unknown) => {
        if (finished) return; finished = true; if (timer) clearTimeout(timer); controller.signal.removeEventListener("abort", aborted);
        if (error !== undefined) reject(error); else resolve(value!);
      };
      const schedule = () => {
        if (timer) clearTimeout(timer); const remaining = deadline() - Date.now();
        if (remaining <= 0) { if (mode === "delivery") controller.abort(); finish(undefined, new GatewayDispatchError(code)); }
        else timer = setTimeout(() => { if (mode === "delivery") controller.abort(); finish(undefined, new GatewayDispatchError(code)); }, remaining);
      };
      const aborted = () => { if (mode === "delivery") finish(undefined, new GatewayDispatchError(code)); else if (mode === "observation") schedule(); };
      promise.then((value) => finish(value), (error: unknown) => finish(undefined, error));
      if (mode !== "persistence") controller.signal.addEventListener("abort", aborted);
      if (mode === "delivery" && controller.signal.aborted) aborted(); else schedule();
    });
  }
  async function authority<T>(invoke: () => PromiseLike<T>, hardDeadline = Infinity): Promise<T> {
    assertDelivery(); const deadline = Math.min(hardDeadline, Number.isFinite(deliveryDeadline) ? deliveryDeadline : Date.now() + resolution.snapshot.limits.timeoutMs);
    const result = await wait(track("authority", invoke), () => deadline, "RUN_CANCELLED", "delivery"); assertDelivery(); return result;
  }
  async function observe<T>(kind: "native" | "reader", invoke: () => PromiseLike<T>): Promise<T> {
    if (Date.now() >= observationDeadline) fail("MODEL_INTERRUPTED");
    return await wait(track(kind, invoke), () => observationDeadline, "MODEL_INTERRUPTED", "observation");
  }
  async function cleanup(invoke: () => PromiseLike<unknown>): Promise<void> {
    try { await wait(track("cleanup", invoke), () => Date.now() + timing.cleanupMs, "CLEANUP_PENDING", "persistence"); }
    catch { /* Exposed pending RPC remains handled; no rollback/termination inference. */ }
  }
  const capture = composition.terminalSink.capture.bind(composition.terminalSink);
  let pendingEvidence: Parameters<DurableTerminalEvidenceSink["capture"]>[0] | undefined;
  let reconciliationPending = false;
  type CaptureOutcome = { confirmed: true; acknowledgment: TerminalCaptureAcknowledgment } | { confirmed: false };
  let capturedAcknowledgment: TerminalCaptureAcknowledgment | undefined;
  let captureFlight: { evidenceCanonical: string; outcome: "pending" | "confirmed" | "failed"; promise: Promise<CaptureOutcome> } | undefined;
  async function capturePending(deadline = Date.now() + timing.terminalPersistenceMs): Promise<boolean> {
    if (!pendingEvidence) return false;
    const evidenceCanonical = canonicalModelJson(pendingEvidence);
    if (captureFlight && captureFlight.evidenceCanonical !== evidenceCanonical) fail("TERMINAL_EVIDENCE_CONFLICT");
    if (!captureFlight || captureFlight.outcome === "failed") {
      if (Date.now() >= deadline) fail("TERMINAL_CAPTURE_PENDING");
      const evidence = pendingEvidence;
      const flight = { evidenceCanonical, outcome: "pending" as "pending" | "confirmed" | "failed", promise: Promise.resolve<CaptureOutcome>({ confirmed: false }) };
      // Both branches are total: hostile late acknowledgments never create an unobserved rejection.
      flight.promise = track("capture", () => capture(detached(evidence))).then((input): CaptureOutcome => {
        try {
          const acknowledgment = captureAcknowledgment(input); flight.outcome = "confirmed";
          capturedAcknowledgment = acknowledgment;
          if (pendingEvidence === evidence) pendingEvidence = undefined;
          return { confirmed: true, acknowledgment };
        } catch { flight.outcome = "failed"; return { confirmed: false }; }
      }, (): CaptureOutcome => { flight.outcome = "failed"; return { confirmed: false }; });
      captureFlight = flight;
    }
    let outcome: CaptureOutcome;
    try { outcome = await wait(captureFlight.promise, () => deadline, "TERMINAL_CAPTURE_PENDING", "persistence"); }
    catch { return fail("TERMINAL_CAPTURE_PENDING"); }
    if (!outcome.confirmed) fail("TERMINAL_CAPTURE_PENDING");
    return true;
  }
  type AttachmentTuple = Parameters<GatewayLedgerPort["attachTerminalResult"]>[0];
  type AttachmentOutcome = { acknowledgment: TerminalAttachmentAcknowledgment } | { failed: true; conflict: boolean };
  let pendingAttachment: AttachmentTuple | undefined;
  let attachmentFlight: { canonical: string; outcome: "pending" | "confirmed" | "failed"; promise: Promise<AttachmentOutcome> } | undefined;
  async function attachPending(deadline = Date.now() + timing.terminalPersistenceMs): Promise<TerminalAttachmentAcknowledgment | undefined> {
    if (!pendingAttachment) return undefined;
    const tuple = pendingAttachment; const canonical = canonicalModelJson(tuple);
    if (attachmentFlight && attachmentFlight.canonical !== canonical) fail("TERMINAL_RESULT_WITHHELD");
    if (!attachmentFlight || attachmentFlight.outcome === "failed") {
      if (Date.now() >= deadline) {
        // An unissued tuple cannot become an attachment retry after the output deadline.
        if (!attachmentFlight) { pendingAttachment = undefined; reconciliationPending = false; }
        fail("TERMINAL_RECONCILIATION_PENDING");
      }
      const flight = { canonical, outcome: "pending" as "pending" | "confirmed" | "failed", promise: Promise.resolve<AttachmentOutcome>({ failed: true, conflict: false }) };
      // Settlement counter now denotes atomic-lane attachment RPCs, not ordinary settlement.
      flight.promise = track("settlement", () => composition.ledger.attachTerminalResult(detached(tuple))).then((input): AttachmentOutcome => {
        try {
          const acknowledgment = attachmentAcknowledgment(input); flight.outcome = "confirmed";
          if (pendingAttachment === tuple) { pendingAttachment = undefined; reconciliationPending = false; }
          return { acknowledgment };
        } catch { flight.outcome = "failed"; reconciliationPending = true; return { failed: true, conflict: false }; }
      }, (error: unknown): AttachmentOutcome => {
        const conflict = attachmentConflict(error); flight.outcome = "failed";
        if (conflict && pendingAttachment === tuple) pendingAttachment = undefined;
        reconciliationPending = !conflict; return { failed: true, conflict };
      });
      attachmentFlight = flight;
    }
    let outcome: AttachmentOutcome;
    try { outcome = await wait(attachmentFlight.promise, () => deadline, "TERMINAL_RECONCILIATION_PENDING", "persistence"); }
    catch { reconciliationPending = pendingAttachment !== undefined; return fail("TERMINAL_RECONCILIATION_PENDING"); }
    if ("failed" in outcome) fail(outcome.conflict ? "TERMINAL_RESULT_WITHHELD" : "TERMINAL_RECONCILIATION_PENDING");
    return outcome.acknowledgment;
  }
  const lifecycle: GatewayLifecycle = { signal: controller.signal, pendingWork: () => {
    const counts = { authority: 0, capture: 0, settlement: 0, native: 0, reader: 0, cleanup: 0 };
    pendingRPCs.forEach((slot) => { counts[slot.kind]++; }); return Object.freeze(counts);
  }, cancel: () => controller.abort(), complete: async () => {
    let joined = 0, primary: unknown;
    while (joined < tasks.length) {
      const batch = tasks.slice(joined); joined = tasks.length;
      await Promise.all(batch.map(task => task.catch(error => { primary ??= error; })));
    }
    // Timed waits retain their issued RPC promises. Join those original calls
    // within one cleanup reserve; never retry a mutation or reopen delivery.
    const deadline = Date.now() + timing.cleanupMs;
    try {
      while (pendingRPCs.size) {
        const pending = [...pendingRPCs].map(slot => slot.promise.then(() => undefined, () => undefined));
        await wait(Promise.all(pending), () => deadline, "CLEANUP_PENDING", "persistence");
      }
    } catch (error) {
      if (primary !== undefined && error instanceof Error) Object.defineProperty(error, "cause", { value: primary });
      throw error;
    }
    if (primary !== undefined) throw primary;
    if (pendingEvidence) fail("TERMINAL_CAPTURE_PENDING");
    if (reconciliationPending) fail("TERMINAL_RECONCILIATION_PENDING");
  },
  retryPendingTerminalEvidence: () => own(() => capturePending()), retryPendingTerminalAttachment: () => own(() => attachPending()), consumeReplay: () => own(async () => {
    if (!replay) return undefined; assertDelivery(); proofFor(checkedResolution(await authority(() => composition.ledger.resolve(resolveArgs(binding)))), (composition.now ?? Date.now)());
    const result = providerJSON(exactJSON(replay, resolution.storageLimits.privateResultBytes));
    if (!result) fail("INVALID_REPLAY");
    if (resolution.snapshot.nativeInterface === "chat") {
      if (agentToolEnvelope(resolution.dispatchEvidence.inputBound.featureEnvelope)) {
        const item = parseAgentLanguageResult(result, resolution.snapshot.allowedTools, resolution.snapshot.limits.toolSteps);
        if (!item || canonicalModelJson(item) !== replay) fail("INVALID_REPLAY"); assertDelivery(); return item;
      }
      const item = record(result, ["text"]); if (typeof item.text !== "string" || !item.text) fail("INVALID_REPLAY"); utf8(item.text); assertDelivery(); return { text: item.text };
    }
    const item = record(result, ["profile", "vectors"]); assertProfileMatches(item.profile as typeof DEFAULT_EMBEDDING_PROFILE, resolution.snapshot.semanticProfile!);
    if (!Array.isArray(item.vectors) || item.vectors.length !== 1) fail("INVALID_REPLAY"); item.vectors.forEach((v: number[]) => assertEmbeddingVector(v, resolution.snapshot.semanticProfile!));
    assertDelivery(); return { profile: resolution.snapshot.semanticProfile!, vectors: item.vectors as number[][] };
  }) };
  async function admit(request: ModelCallRequest): Promise<Reserved & { dispatchIdentity: string }> {
    proofFor(resolution, (composition.now ?? Date.now)()); assertDelivery();
    const incoming = json(request, resolution.storageLimits.canonicalBytes);
    const combined = composition.ledger.admitAndCheckpoint ? checkedAdmissionCheckpoint(await authority(() => composition.ledger.admitAndCheckpoint!({
      ...binding, requestCanonical: incoming, snapshotCanonical: canonicalModelJson(resolution.snapshot),
    }))) : undefined;
    const admitted = combined?.admission ?? checkedAdmission(await authority(() => composition.ledger.admit({ ...binding, requestCanonical: incoming })));
    if (admitted.status !== "reserved") { if (admitted.status === "replay") replay = admitted.resultCanonical; fail(admitted.status === "replay" ? "REPLAY_AVAILABLE" : "UNCERTAIN_OR_INFLIGHT"); }
    assertGatewayReservedRequest(admitted, incoming, canonicalModelJson(resolution.snapshot), resolution.storageLimits.canonicalBytes);
    const permit = combined && "permit" in combined ? combined.permit : checkedPermit(await authority(() => composition.ledger.checkpoint({ reference: binding.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical })));
    if (!permit.dispatchPermit) fail("DISPATCH_NOT_PERMITTED");
    if (permit.requestCanonical !== admitted.requestCanonical || canonicalModelJson(permit.snapshot) !== canonicalModelJson(admitted.snapshot)) fail("CHECKPOINT_MISMATCH");
    assertDelivery(); return { ...admitted, dispatchIdentity: permit.dispatchIdentity };
  }
  const visible = async (attempt: Reserved, outputVisible = false, hardDeadline = Infinity, toolInputVisible = false) => {
    assertDelivery(); const acknowledgment = record(await authority(() => composition.ledger.markVisible({ reference: binding.reference, attemptId: attempt.attemptId, outputVisible, toolInputVisible, toolResultVisible: false, toolEffectCommitted: false }), hardDeadline), ["recorded"]);
    if (Object.keys(acknowledgment).length !== 1 || acknowledgment.recorded !== true) fail("DELIVERY_AUTHORITY_REVOKED"); assertDelivery();
  };
  async function terminal(attempt: Reserved & { dispatchIdentity: string }, raw: Record<string, unknown>, privateResult?: string): Promise<void> {
    const deadline = Date.now() + timing.terminalPersistenceMs;
    const id = raw.id; const actual = raw.model; const usage = providerJSON(raw.usage);
    if (typeof id !== "string" || !id || id.length > 256 || typeof actual !== "string" || !actual || actual.length > 256) fail("UNQUALIFIED_TERMINAL");
    utf8(id); utf8(actual);
    const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, resolution.storageLimits.canonicalBytes)).request;
    const observed = usage ? usageOf(usage) : {};
    const completeExtractionUsage = resolution.snapshot.operationKey !== "memory.extract"
      || (observed.inputTokens !== undefined && observed.outputTokens !== undefined);
    const nativeBoundViolation = actual !== qualifiedTerminalModelId(resolution.dispatchEvidence)
      || (observed.inputTokens !== undefined && observed.inputTokens > admitted.inputTokens)
      || (observed.outputTokens !== undefined && observed.outputTokens > admitted.outputTokens);
    if (nativeBoundViolation || !completeExtractionUsage || !canDeliver()) privateResult = undefined;
    const cost = resolution.dispatchEvidence.terminalCost === "gateway-aggregate-usd-v1" && usage ? conservativeUsdDecimal(usage.cost) : undefined;
    const receipt = { version: 1, dispatchIdentity: attempt.dispatchIdentity, receiptId: id, modelId: resolution.snapshot.modelId, nativeInterface: resolution.snapshot.nativeInterface,
      outcome: "confirmed", proof: "provider-terminal-v1", costSource: cost === undefined ? "unavailable" : "gateway-aggregate-usd-v1",
      ...(cost !== undefined ? { aggregateCostUsd: cost } : {}), ...(usage ? { usage: usageOf(usage) } : {}), actualModel: actual };
    const receiptCanonical = json(receipt, resolution.storageLimits.canonicalBytes);
    pendingEvidence = { attemptId: attempt.attemptId, dispatchIdentity: attempt.dispatchIdentity, receiptCanonical };
    await capturePending(deadline);
    const ack = capturedAcknowledgment!;
    if (nativeBoundViolation || ("overrun" in ack && ack.overrun)) fail("QUALIFICATION_OVERRUN");
    if (!canDeliver()) assertDelivery();
    // A complete matching result may be retained while its FULL qualified ceiling
    // stays uncertain. Native attachment independently validates the same proof,
    // usage, current grant/source and payload; it never settles or refunds money.
    const confirmedUnknown = resolution.dispatchEvidence.terminalCost === "unavailable"
      && observed.inputTokens !== undefined && (resolution.snapshot.nativeInterface === "embedding" || observed.outputTokens !== undefined);
    if (!privateResult || ("state" in ack && ack.state !== "settled" && !(ack.state === "uncertain" && confirmedUnknown))) fail("TERMINAL_RESULT_WITHHELD");
    // Retain private bytes only when attachment is actually issued within the ORIGINAL deadline.
    if (Date.now() >= deadline) fail("TERMINAL_RECONCILIATION_PENDING");
    pendingAttachment = detached({ reference: binding.reference, attemptId: attempt.attemptId, evidenceId: ack.evidenceId, privateResultCanonical: privateResult });
    reconciliationPending = true;
    const attached = await attachPending(deadline);
    if (!attached || !attached.attached || attached.resultWithheld) fail("TERMINAL_RESULT_WITHHELD");
    assertDelivery();
  }
  return { binding, resolution, controller, lifecycle, tasks, admit, visible, terminal, startLifetime, endLifetime, assertDelivery, canDeliver, observe, cleanup, own };
}
/** Native test seams accept ONLY the official Gateway provider identity, never alternate routing.
 * Production callers use createGovernedGatewayModel; injected-fetch models are offline fixtures. */
export function governGatewayLanguageModel(model: LanguageModelV4, composition: GatewayComposition, binding: GatewayBinding, resolution: GatewayResolution): { model: LanguageModelV4; lifecycle: GatewayLifecycle } {
  const state = stateFor(composition, binding, resolution);
  if (resolution.snapshot.nativeInterface !== "chat" || model.modelId !== resolution.snapshot.modelId || model.provider !== "convexGateway.chat") fail("MODEL_IDENTITY_MISMATCH");
  const input = new WeakMap<object, ModelCallRequest>();
  const wrapped = wrapLanguageModel({ model, middleware: { specificationVersion: "v4",
    transformParams: async ({ params, type }) => { const normalized = languageParams(params, state.resolution.snapshot, state.resolution.dispatchEvidence, state.binding, state.controller.signal);
      if (type === "stream" && state.resolution.dispatchEvidence.inputBound.featureEnvelope === MEMORY_JSON_OBJECT_CONTRACT.featureEnvelope) fail("CAPABILITY_UNAVAILABLE");
      if (type === "stream") normalized.params.includeRawChunks = true; input.set(normalized.params, normalized.request); return normalized.params; },
    wrapGenerate: ({ params, doGenerate }) => state.own(async () => {
      const request = input.get(params)!; const attempt = await state.admit(request);
      const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
      if (nativeIdentity(params) !== nativeIdentity(nativeLanguage(admitted, state.controller.signal))) fail("ADMITTED_REQUEST_MISMATCH");
      let result: Awaited<ReturnType<LanguageModelV4["doGenerate"]>>;
      state.startLifetime(request.timeoutMs);
      const nativeStarted = Date.now(); traceGateway(binding, "gateway.native.generate.begin");
      try { result = await state.observe("native", doGenerate); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }
      traceGateway(binding, "gateway.native.generate.ready", { durationMs: Date.now() - nativeStarted });
      try {
      const raw = providerJSON(result.response?.body); const choices = raw?.choices;
      const reason = Array.isArray(choices) && choices.length === 1 ? (choices[0] as { finish_reason?: string }).finish_reason : undefined;
      if (!raw || !qualifiedReason(reason, state.resolution)) fail("UNQUALIFIED_TERMINAL");
      let output = languageOutput(result.content, reason, admitted, state.resolution);
      if (output && !matchingNativeToolCalls(output.content, (choices as unknown[])[0])) output = undefined;
      try { await state.terminal(attempt, raw, state.canDeliver() ? output?.canonical : undefined); } finally { state.endLifetime(); }
      state.assertDelivery();
      if (!output || state.controller.signal.aborted) fail("RESULT_BOUND_EXCEEDED");
      return { content: output.content, finishReason: { unified: finishReason(reason), raw: reason }, usage: nativeUsage(providerJSON(raw.usage)), warnings: [] };
      } finally { state.endLifetime(); }
    }),
    wrapStream: ({ params, doStream }) => state.own(async () => {
      if (state.resolution.dispatchEvidence.supportsStream !== true) fail("CAPABILITY_UNAVAILABLE");
      const attempt = await state.admit(input.get(params)!);
      const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
      if (nativeIdentity(params) !== nativeIdentity(nativeLanguage(admitted, state.controller.signal))) fail("ADMITTED_REQUEST_MISMATCH");
      let result: Awaited<ReturnType<LanguageModelV4["doStream"]>>;
      state.startLifetime(input.get(params)!.timeoutMs);
      const nativeStarted = Date.now(); traceGateway(binding, "gateway.native.stream.begin");
      try { result = await state.observe("native", doStream); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }
      // Official provider acquisition includes its service token, request and
      // response-header processing. Its internal HTTP stages remain opaque.
      traceGateway(binding, "gateway.native.stream.ready", { durationMs: Date.now() - nativeStarted });
      const reader = result.stream.getReader();
      let firstPart = true, firstText = true;
      let observer: ReadableStreamDefaultController<LanguageModelV4StreamPart>; let observerClosed = false;
      const output = new ReadableStream<LanguageModelV4StreamPart>({ start(c) { observer = c; }, cancel() { observerClosed = true; } }, { highWaterMark: 64 });
      let text = ""; let deliveryError: GatewayDispatchError | undefined; let terminalReason: string | undefined; let rawTerminal: Record<string, unknown> | undefined; let id: string | undefined; let actualModel: string | undefined; let textStarted = false; let terminalAttempted = false;
      const toolInputs = new Map<string, { name: string; input: string; ended: boolean; complete: boolean }>();
      const toolCalls: AgentLanguageResultV1["content"] = [];
      const drain = async (): Promise<void> => {
        const interrupted = () => { deliveryError ??= new GatewayDispatchError("STREAM_INTERRUPTED"); if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); } };
        const emit = (part: LanguageModelV4StreamPart) => {
          // EVERY enqueue is fenced, including start/end/finish, independently of provider abort.
          if (!state.canDeliver()) { interrupted(); return; } if (observerClosed || deliveryError) return;
          if ((observer!.desiredSize ?? 0) <= 0) { observerClosed = true; observer!.error(new GatewayDispatchError("OBSERVER_BUFFER_LIMIT")); return; }
          state.assertDelivery(); observer!.enqueue(part);
        };
        state.controller.signal.addEventListener("abort", interrupted);
        if (state.controller.signal.aborted) interrupted();
        try {
          while (true) {
            const item = await state.observe("reader", () => reader.read()); if (item.done) break; const part = item.value;
            if (firstPart) { firstPart = false; traceGateway(binding, "gateway.native.stream.first-part", { durationMs: Date.now() - nativeStarted }); }
            if (part.type === "raw") {
              const raw = providerJSON(part.rawValue); if (!raw || "error" in raw) continue;
              if (typeof raw.id === "string") { if (id && id !== raw.id) fail("UNQUALIFIED_TERMINAL"); id = raw.id; }
              if (typeof raw.model === "string") {
                if (actualModel && actualModel !== raw.model) fail("UNQUALIFIED_TERMINAL"); actualModel = raw.model;
                if (actualModel !== state.resolution.snapshot.modelId && !deliveryError) {
                  deliveryError = new GatewayDispatchError("QUALIFICATION_OVERRUN");
                  if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); }
                }
              }
              const choices = raw.choices; if (Array.isArray(choices) && choices.length === 1 && qualifiedReason((choices[0] as { finish_reason?: string }).finish_reason, state.resolution)) terminalReason = (choices[0] as { finish_reason: string }).finish_reason;
              if (terminalReason || providerJSON(raw.usage)) rawTerminal = { id, model: actualModel, ...(rawTerminal?.usage ? { usage: rawTerminal.usage } : {}), ...(providerJSON(raw.usage) ? { usage: raw.usage } : {}) };
              continue;
            }
            if (part.type === "error") fail("STREAM_INTERRUPTED");
            if (part.type === "text-delta") {
              if (firstText && part.delta.length) { firstText = false; traceGateway(binding, "gateway.native.stream.first-text", { durationMs: Date.now() - nativeStarted, bytes: new TextEncoder().encode(part.delta).byteLength }); }
              if (!deliveryError) {
                text += part.delta;
                if (utf8(text) > state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes / 6) {
                  deliveryError = new GatewayDispatchError("RESULT_BOUND_EXCEEDED"); text = "";
                  if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); }
                }
              }
              if (!deliveryError) {
                try { await state.visible(attempt, !observerClosed); }
                catch { deliveryError ??= new GatewayDispatchError(state.controller.signal.aborted ? "STREAM_INTERRUPTED" : "DELIVERY_AUTHORITY_REVOKED"); if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); } }
              }
              if (!state.canDeliver()) interrupted();
              if (!observerClosed && !deliveryError) { if (!textStarted) { emit({ type: "text-start", id: "governed-text" }); textStarted = true; } emit({ type: "text-delta", id: "governed-text", delta: part.delta }); }
            } else if (["tool-input-start", "tool-input-delta", "tool-input-end", "tool-call"].includes(part.type)) {
              if (deliveryError) continue;
              try {
                if (!agentToolEnvelope(state.resolution.dispatchEvidence.inputBound.featureEnvelope)) fail("UNSUPPORTED_MODEL_OUTPUT");
                const value = detached(part) as Record<string, unknown>;
                const callId = value.type === "tool-call" ? value.toolCallId : value.id;
                if (!stableId(callId) || value.providerExecuted === true || value.dynamic === true) fail("UNSUPPORTED_MODEL_OUTPUT");
                let safe: LanguageModelV4StreamPart;
                if (value.type === "tool-input-start") {
                  const name = value.toolName;
                  if (typeof name !== "string" || !admitted.tools.some(tool => tool.name === name) || admitted.toolChoice?.type === "none"
                    || (admitted.toolChoice?.type === "tool" && admitted.toolChoice.toolName !== name)
                    || toolInputs.has(callId) || toolInputs.size >= admitted.toolSteps) fail("UNSUPPORTED_MODEL_OUTPUT");
                  toolInputs.set(callId, { name, input: "", ended: false, complete: false });
                  safe = { type: "tool-input-start", id: callId, toolName: name };
                } else {
                  const pending = toolInputs.get(callId); if (!pending || pending.complete) fail("UNSUPPORTED_MODEL_OUTPUT");
                  if (value.type === "tool-input-delta") {
                    if (pending.ended || typeof value.delta !== "string") fail("UNSUPPORTED_MODEL_OUTPUT");
                    utf8(value.delta); pending.input += value.delta;
                    safe = { type: "tool-input-delta", id: callId, delta: value.delta };
                  } else if (value.type === "tool-input-end") {
                    if (pending.ended) fail("UNSUPPORTED_MODEL_OUTPUT"); pending.ended = true;
                    safe = { type: "tool-input-end", id: callId };
                  } else {
                    if (!pending.ended || value.toolName !== pending.name || typeof value.input !== "string") fail("UNSUPPORTED_MODEL_OUTPUT");
                    const parsed = parseAgentLanguageResult({ version: 1, kind: "language", content: [{ type: "tool-call", toolCallId: callId, toolName: pending.name, input: value.input }], finishReason: "tool-calls" }, [pending.name], 1);
                    if (!parsed || canonicalModelJson(JSON.parse(pending.input)) !== (parsed.content[0] as { input: string }).input) fail("UNSUPPORTED_MODEL_OUTPUT");
                    pending.complete = true; const call = parsed.content[0]!;
                    toolCalls.push(call); safe = call as LanguageModelV4StreamPart;
                  }
                }
                if (utf8(text) + [...toolInputs.values()].reduce((bytes, tool) => bytes + utf8(tool.input), 0)
                  > state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes / 6) fail("RESULT_BOUND_EXCEEDED");
                if (!deliveryError) { await state.visible(attempt, false, Infinity, !observerClosed); emit(safe); }
              } catch (error) {
                deliveryError ??= error instanceof GatewayDispatchError ? error : new GatewayDispatchError("DELIVERY_AUTHORITY_REVOKED");
                if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); }
              }
            } else if (part.type === "finish") { /* Native EOF flush is NOT terminal proof. */ }
            else if (!["reasoning-start", "reasoning-delta", "reasoning-end", "text-start", "text-end", "response-metadata", "stream-start"].includes(part.type)) {
              deliveryError = new GatewayDispatchError("UNSUPPORTED_MODEL_OUTPUT");
              if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); }
            }
          }
          if (!terminalReason || !rawTerminal) fail("UNQUALIFIED_TERMINAL");
          terminalAttempted = true;
          const content: AgentLanguageResultV1["content"] = [...text ? [{ type: "text" as const, text }] : [], ...toolCalls];
          const projected = languageOutput(content, terminalReason, admitted, state.resolution);
          const completeTools = [...toolInputs.values()].every(tool => tool.complete);
          await state.terminal(attempt, rawTerminal, projected && completeTools && !deliveryError && !state.controller.signal.aborted ? projected.canonical : undefined);
          if (deliveryError) throw deliveryError;
          if (!state.canDeliver()) interrupted();
          if (!observerClosed && !deliveryError) { if (textStarted) emit({ type: "text-end", id: "governed-text" }); emit({ type: "finish", finishReason: { unified: finishReason(terminalReason), raw: terminalReason }, usage: nativeUsage(providerJSON(rawTerminal.usage)) }); if (!observerClosed) { state.assertDelivery(); observer!.close(); observerClosed = true; } }
        } catch (error) {
          // Real terminal evidence may already be complete despite a later observer/authority failure.
          if (!terminalAttempted && terminalReason && rawTerminal) {
            try { await state.terminal(attempt, rawTerminal); } catch (terminalError) { error = terminalError; }
          }
          if (!observerClosed) { observerClosed = true; observer!.error(error instanceof GatewayDispatchError ? error : new GatewayDispatchError("STREAM_INTERRUPTED")); }
          throw error instanceof GatewayDispatchError ? error : new GatewayDispatchError("STREAM_INTERRUPTED");
        } finally { state.endLifetime(); state.controller.signal.removeEventListener("abort", interrupted); await state.cleanup(() => reader.cancel()); reader.releaseLock(); }
      };
      // Explicitly retained/joined task; never an unbounded tee. Attach rejection handler immediately
      // so delayed owner complete() cannot create an unhandled rejection; complete still rejects.
      const task = drain(); task.catch(() => undefined); state.tasks.push(task);
      return { stream: output };
    }),
  } });
  return { model: wrapped, lifecycle: state.lifecycle };
}
export function governGatewayEmbeddingModel(model: EmbeddingModelV4, composition: GatewayComposition, binding: GatewayBinding, resolution: GatewayResolution): { model: EmbeddingModelV4; lifecycle: GatewayLifecycle } {
  const state = stateFor(composition, binding, resolution);
  if (resolution.snapshot.nativeInterface !== "embedding" || model.modelId !== resolution.snapshot.semanticProfile?.modelId || model.provider !== "convexGateway.embedding") fail("MODEL_IDENTITY_MISMATCH");
  const requests = new WeakMap<object, ModelCallRequest>();
  const wrapped = wrapEmbeddingModel({ model, middleware: { specificationVersion: "v4", overrideMaxEmbeddingsPerCall: () => 1,
    transformParams: async ({ params }) => {
      const n = record(params, ["values", "headers", "providerOptions", "abortSignal"]);
      if (n.headers !== undefined || n.providerOptions !== undefined || (n.abortSignal !== undefined && n.abortSignal !== state.controller.signal)) fail("UNSUPPORTED_NATIVE_FIELD");
      const values = arrayValues(n.values); if (values.length !== 1 || typeof values[0] !== "string") fail("EMBEDDING_VALUE_BOUND");
      const text = values[0]; utf8(text); const normalized = normalizeSourceText(text); const bytes = utf8(normalized); if (bytes > 8192) fail("INPUT_BOUND_EXCEEDED");
      const request = requestBase(state.resolution.snapshot, state.binding); request.texts = [normalized]; request.inputTokens = bytes; request.profile = state.resolution.snapshot.semanticProfile!;
      request.batch = { ordinal: state.binding.ordinal, start: state.binding.ordinal, end: state.binding.ordinal + 1 };
      const checked = validateModelRequest(state.resolution.snapshot, request).request;
      const transformed: EmbeddingModelV4CallOptions = { values: [...checked.texts], abortSignal: state.controller.signal }; requests.set(transformed, detached(checked)); return transformed;
    },
    wrapEmbed: ({ params, doEmbed }) => state.own(async () => {
      const request = requests.get(params)!; const attempt = await state.admit(request);
      const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
      if (canonicalModelJson(params.values) !== canonicalModelJson(admitted.texts)) fail("ADMITTED_REQUEST_MISMATCH");
      let result: EmbeddingModelV4Result; state.startLifetime(request.timeoutMs);
      const nativeStarted = Date.now(); traceGateway(binding, "gateway.native.embed.begin");
      try { result = await state.observe("native", doEmbed); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }
      traceGateway(binding, "gateway.native.embed.ready", { durationMs: Date.now() - nativeStarted });
      try {
      const raw = providerJSON(result.response?.body);
      if (!raw || !Array.isArray(raw.data) || raw.data.length !== 1 || result.embeddings.length !== 1) fail("UNQUALIFIED_TERMINAL");
      let payload: string | undefined;
      try { const vectors = detached(result.embeddings); assertEmbeddingVector(vectors[0]!, state.resolution.snapshot.semanticProfile!); payload = json({ profile: state.resolution.snapshot.semanticProfile!, vectors }, Math.min(state.resolution.storageLimits.privateResultBytes, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes)); }
      catch { /* Invalid output never discards terminal charge. */ }
      try { await state.terminal(attempt, raw, state.canDeliver() ? payload : undefined); } finally { state.endLifetime(); }
      state.assertDelivery();
      if (!payload || state.controller.signal.aborted) fail("UNSUPPORTED_MODEL_OUTPUT");
      const usage = providerJSON(raw.usage); const tokens = usage && count(usage.prompt_tokens) ? usage.prompt_tokens : undefined;
      const safe: EmbeddingModelV4Result = { embeddings: detached(result.embeddings), warnings: [], ...(tokens !== undefined ? { usage: { tokens } } : {}) }; state.assertDelivery(); return safe;
      } finally { state.endLifetime(); }
    }),
  } });
  return { model: wrapped, lifecycle: state.lifecycle };
}
