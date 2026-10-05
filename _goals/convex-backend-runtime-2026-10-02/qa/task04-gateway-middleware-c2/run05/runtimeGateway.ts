/** Backend-only governed native middleware. No caller is wired and the actual trust root is empty.
 * Production composition MUST supply a private durable terminal sink; no missing RPC is invented.
 * Tools/schema/Responses and typed native replay remain later qualification gates. */
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { wrapEmbeddingModel, wrapLanguageModel } from "ai";
import type { EmbeddingModelV4, EmbeddingModelV4CallOptions, EmbeddingModelV4Result, LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart, LanguageModelV4Usage } from "@ai-sdk/provider";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { canonicalModelJson, validateModelRequest } from "../src/domain/model-policy";
import type { ModelCallRequest, ModelOperationKey, ModelPolicySnapshotV1 } from "../src/domain/model-policy";
import { assertEmbeddingVector, assertProfileMatches, DEFAULT_EMBEDDING_PROFILE, normalizeSourceText } from "../src/domain/profile";
import type { QualifiedDispatchEvidence } from "./runtimeModelPolicyBootstrap";
import type { Id } from "./_generated/dataModel";

type AttemptId = Id<"runtimeModelAttempts">;
type OperationId = Id<"runtimeModelOperations">;
type Source = { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string };
export interface GatewayBinding {
  reference: RuntimeAuthorityReference; operationKey: ModelOperationKey; runBudgetId: string;
  semanticId: string; ordinal: number; source?: Source; parentOperationId?: OperationId;
}
export interface GatewayResolution {
  snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence;
  storageLimits: { canonicalBytes: number; privateResultBytes: number; embeddingValuesPerCall: 1 };
}
type Reserved = { status: "reserved"; operationId: OperationId; attemptId: AttemptId; snapshot: ModelPolicySnapshotV1; requestCanonical: string };
export type GatewayAdmission = Reserved | { status: "replay"; operationId: OperationId; resultCanonical: string }
  | { status: "inflight" | "uncertain"; operationId: OperationId; attemptId: AttemptId; replayAllowed?: false };
export interface GatewayLedgerPort {
  resolve(args: Pick<GatewayBinding, "reference" | "operationKey" | "runBudgetId" | "source">): Promise<GatewayResolution>;
  admit(args: GatewayBinding & { requestCanonical: string }): Promise<GatewayAdmission>;
  checkpoint(args: { reference: RuntimeAuthorityReference; attemptId: AttemptId; requestCanonical: string }): Promise<
    { dispatchPermit: true; dispatchIdentity: string; snapshot: ModelPolicySnapshotV1; requestCanonical: string }
    | { dispatchPermit: false; state: string; replayAllowed: false }>;
  markVisible(args: { reference: RuntimeAuthorityReference; attemptId: AttemptId; outputVisible: boolean; toolInputVisible: boolean; toolResultVisible: boolean; toolEffectCommitted: boolean }): Promise<{ recorded: true }>;
  settle(args: { reference: RuntimeAuthorityReference; attemptId: AttemptId; receiptCanonical: string }): Promise<{
    state: string; resultWithheld?: boolean; settledCostUnits?: number; overrun?: boolean; replayAllowed?: false }>;
}
/** Server code composition only: never a public JSON argument, tenant capability or admin key.
 * FIRST-SLICE CAPTURE-ONLY CONTRACT: capture durably stores sanitized charge evidence
 * independently of delivery authority and deduplicates exact receipts. It MUST NOT settle
 * money, release the attempt slot, change visibility or attach results before returning.
 * No such native capture-only registration is installed; this required port is UNWIRED.
 * The proposed future atomic capture+accounting registration is INCOMPATIBLE with this
 * terminal order. Before wiring it, replace postcapture markVisible+settle with a separately
 * reviewed current-authority attachTerminalResult port. No nonexistent RPC is referenced.
 * Original-window no-delivery liability reconciliation is still a native follow-up. */
export interface DurableTerminalEvidenceSink {
  capture(evidence: { attemptId: AttemptId; dispatchIdentity: string; receiptCanonical: string }): Promise<{ evidenceId: string }>;
}
/** Finite server-code composition bounds, independent of model price/token qualifications. */
export interface GatewayOwnedTiming { terminalObservationMs: number; terminalPersistenceMs: number; cleanupMs: number }
export const DEFAULT_GATEWAY_OWNED_TIMING: Readonly<GatewayOwnedTiming> = Object.freeze({ terminalObservationMs: 100, terminalPersistenceMs: 1000, cleanupMs: 100 });
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
  /** Explicit narrow authorized replay payload; never a fabricated native provider result. */
  consumeReplay(): Promise<{ text: string } | { profile: typeof DEFAULT_EMBEDDING_PROFILE; vectors: number[][] } | undefined>;
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
function proofFor(resolution: GatewayResolution, now: number): void {
  const { snapshot: s, dispatchEvidence: p, storageLimits: limits } = resolution;
  if (p.receiptId !== s.qualificationReceiptId || p.modelId !== s.modelId || p.nativeInterface !== s.nativeInterface
    || p.providerVersion !== "0.2.1" || p.priceRevision !== s.pins.priceRevision || p.boundRevision !== s.pins.boundRevision
    || p.checkedAt > now || p.expiresAt <= now || p.terminalProof !== "provider-terminal-v1"
    || ![p.evidenceHash, p.inputBound.nativeTransformHash, p.inputBound.documentHash, p.inputBound.proofHash, p.resultBound.proofHash].every((h) => /^[a-f0-9]{64}$/.test(h))
    || p.inputBound.revision !== 1 || !count(p.resultBound.maximumOutputTokens) || !count(p.resultBound.maximumPrivateResultBytes)
    || p.resultBound.maximumPrivateResultBytes < 1 || p.resultBound.maximumPrivateResultBytes > 60_000
    || !count(limits.canonicalBytes) || limits.canonicalBytes < 1 || !count(limits.privateResultBytes) || limits.privateResultBytes < 1 || limits.canonicalBytes > 180_000 || limits.privateResultBytes > 60_000 || limits.embeddingValuesPerCall !== 1 || p.resultBound.maximumEmbeddingValues !== 1) fail("CAPABILITY_UNAVAILABLE");
  if (s.nativeInterface === "chat" && p.inputBound.ruleId === "plain-chat-cookbook-utf8-v1" && p.inputBound.featureEnvelope === "plain-chat-v1") return;
  if (s.nativeInterface === "embedding" && p.inputBound.ruleId === "default-embedding-utf8-v1" && p.inputBound.featureEnvelope === "default-embedding-v1") {
    assertProfileMatches(s.semanticProfile!); return;
  }
  fail("CAPABILITY_UNAVAILABLE");
}
function requestBase(s: ModelPolicySnapshotV1, binding: GatewayBinding): ModelCallRequest {
  return { semanticId: binding.semanticId, childCallId: "pending-server-identity", texts: [], inputTokens: 1, outputTokens: 0,
    toolSteps: 0, timeoutMs: s.limits.timeoutMs, reservationUnits: s.costBound.maximumCostUnits, tools: [], options: { maxRetries: 0 },
    promptVersion: s.pins.promptVersion, schemaVersion: s.pins.schemaVersion, extractionVersion: s.pins.extractionVersion, toolRegistryVersion: s.pins.toolRegistryVersion };
}
const standardKeys = ["prompt", "maxOutputTokens", "temperature", "topP", "seed", "stopSequences", "topK", "presencePenalty", "frequencyPenalty", "responseFormat", "tools", "toolChoice", "headers", "providerOptions", "reasoning", "includeRawChunks", "abortSignal"];
function languageParams(input: LanguageModelV4CallOptions, s: ModelPolicySnapshotV1, p: QualifiedDispatchEvidence, binding: GatewayBinding, signal: AbortSignal): { params: LanguageModelV4CallOptions; request: ModelCallRequest } {
  const native = record(input, standardKeys);
  for (const key of ["topK", "presencePenalty", "frequencyPenalty", "tools", "toolChoice", "headers", "providerOptions", "reasoning", "includeRawChunks"]) if (key in native) fail("UNSUPPORTED_NATIVE_FIELD");
  if (native.abortSignal !== undefined && native.abortSignal !== signal) fail("UNTRUSTED_ABORT_SIGNAL");
  if (native.responseFormat !== undefined && canonicalModelJson(native.responseFormat) !== '{"type":"text"}') fail("CAPABILITY_UNAVAILABLE");
  if (!Array.isArray(native.prompt)) fail("INVALID_NATIVE_REQUEST");
  // Canonical validation catches sparse/custom-iterator arrays BEFORE map/iteration.
  const messages: NonNullable<ModelCallRequest["messages"]> = arrayValues(native.prompt).map((message: unknown) => {
    const m = record(message, ["role", "content", "providerOptions"]); if ("providerOptions" in m) fail("UNSUPPORTED_NATIVE_FIELD");
    if (!["system", "user", "assistant"].includes(m.role as string)) fail("CAPABILITY_UNAVAILABLE");
    let text: unknown;
    if (m.role === "system") text = m.content;
    else {
      const parts = arrayValues(m.content); if (parts.length !== 1) fail("CAPABILITY_UNAVAILABLE");
      const part = record(parts[0], ["type", "text", "providerOptions"]);
      if (part.type !== "text" || "providerOptions" in part) fail("CAPABILITY_UNAVAILABLE"); text = part.text;
    }
    if (typeof text !== "string") fail("INVALID_NATIVE_REQUEST"); utf8(text);
    return { role: m.role as "system" | "user" | "assistant", parts: [{ type: "text", text: normalizeSourceText(text) }] };
  });
  if (!count(native.maxOutputTokens) || native.maxOutputTokens === 0 || native.maxOutputTokens > p.resultBound.maximumOutputTokens) fail("OUTPUT_BOUND_EXCEEDED");
  const request = requestBase(s, binding); request.messages = messages; request.texts = messages.map((m) => m.parts[0]!.type === "text" ? m.parts[0]!.text : "");
  request.inputTokens = 3 + messages.reduce((n, m, index) => n + 3 + utf8(m.role) + utf8(request.texts[index]!), 0);
  request.outputTokens = native.maxOutputTokens;
  for (const key of ["temperature", "topP", "seed", "stopSequences"] as const) if (native[key] !== undefined) Object.assign(request.options, { [key]: detached(native[key]) });
  const checked = validateModelRequest(s, request).request;
  return { request: detached(checked), params: nativeLanguage(checked, signal) };
}
function nativeLanguage(request: Readonly<ModelCallRequest>, signal: AbortSignal): LanguageModelV4CallOptions {
  return { prompt: request.messages!.map((m) => m.role === "system" ? { role: "system", content: (m.parts[0] as { text: string }).text }
    : { role: m.role as "user" | "assistant", content: [{ type: "text", text: (m.parts[0] as { text: string }).text }] }),
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
/** Generated provider bodies are untrusted, descriptor-safe detached JSON before observation. */
function providerJSON(input: unknown): Record<string, unknown> | undefined {
  try { const value: unknown = typeof input === "string" ? JSON.parse(input) : detached(input);
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined; return value as Record<string, unknown>;
  } catch { return undefined; }
}
export async function createGovernedGatewayModel(composition: GatewayComposition, inputBinding: GatewayBinding): Promise<{ model: LanguageModelV4 | EmbeddingModelV4; lifecycle: GatewayLifecycle }> {
  requireSink(composition);
  const binding = detached(inputBinding); const resolution = await composition.ledger.resolve(resolveArgs(binding)); proofFor(resolution, (composition.now ?? Date.now)());
  return resolution.snapshot.nativeInterface === "embedding"
    ? governGatewayEmbeddingModel(convexGateway.embeddingModel(resolution.snapshot.modelId), composition, binding, resolution)
    : governGatewayLanguageModel(convexGateway(resolution.snapshot.modelId), composition, binding, resolution);
}
function resolveArgs(binding: GatewayBinding): Pick<GatewayBinding, "reference" | "operationKey" | "runBudgetId" | "source"> {
  return { reference: binding.reference, operationKey: binding.operationKey, runBudgetId: binding.runBudgetId, ...(binding.source ? { source: binding.source } : {}) };
}
function requireSink(composition: GatewayComposition): void { if (!composition.terminalSink || typeof composition.terminalSink.capture !== "function") fail("DURABLE_TERMINAL_SINK_REQUIRED"); }
function stateFor(composition: GatewayComposition, inputBinding: GatewayBinding, inputResolution: GatewayResolution) {
  requireSink(composition); const binding = detached(inputBinding); const resolution = detached(inputResolution);
  proofFor(resolution, (composition.now ?? Date.now)());
  if (!count(binding.ordinal) || !binding.semanticId || binding.semanticId.length > 256) fail("INVALID_BINDING");
  const timing = detached(composition.ownedTiming ?? DEFAULT_GATEWAY_OWNED_TIMING);
  for (const value of [timing.terminalObservationMs, timing.terminalPersistenceMs, timing.cleanupMs]) if (!count(value) || value < 1 || value > 1000) fail("INVALID_OWNED_TIMING");
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
  async function persist<T>(kind: "capture" | "settlement", invoke: () => PromiseLike<T>, deadline: number, code: string): Promise<T> {
    if (Date.now() >= deadline) fail(code);
    try { return await wait(track(kind, invoke), () => deadline, code, "persistence"); }
    catch { return fail(code); }
  }
  async function cleanup(invoke: () => PromiseLike<unknown>): Promise<void> {
    try { await wait(track("cleanup", invoke), () => Date.now() + timing.cleanupMs, "CLEANUP_PENDING", "persistence"); }
    catch { /* Exposed pending RPC remains handled; no rollback/termination inference. */ }
  }
  const capture = composition.terminalSink.capture.bind(composition.terminalSink);
  let pendingEvidence: Parameters<DurableTerminalEvidenceSink["capture"]>[0] | undefined;
  let reconciliationPending = false;
  type CaptureOutcome = { confirmed: true; evidenceId: string } | { confirmed: false };
  let captureFlight: { evidenceCanonical: string; outcome: "pending" | "confirmed" | "failed"; promise: Promise<CaptureOutcome> } | undefined;
  async function capturePending(deadline = Date.now() + timing.terminalPersistenceMs): Promise<boolean> {
    if (!pendingEvidence) return false;
    const evidenceCanonical = canonicalModelJson(pendingEvidence);
    if (captureFlight && captureFlight.evidenceCanonical !== evidenceCanonical) fail("TERMINAL_EVIDENCE_CONFLICT");
    if (!captureFlight || captureFlight.outcome === "failed") {
      if (Date.now() >= deadline) fail("TERMINAL_CAPTURE_PENDING");
      const flight = { evidenceCanonical, outcome: "pending" as "pending" | "confirmed" | "failed", promise: Promise.resolve<CaptureOutcome>({ confirmed: false }) };
      // Keep one capture flight across timeout/retry. Rejected/invalid acknowledgments alone
      // permit an exact idempotent persistence retry; a merely slow flight never duplicates it.
      flight.promise = track("capture", () => capture(pendingEvidence!)).then((ack): CaptureOutcome => {
        if (typeof ack.evidenceId !== "string" || !ack.evidenceId || ack.evidenceId.length > 256) { flight.outcome = "failed"; return { confirmed: false }; }
        flight.outcome = "confirmed"; return { confirmed: true, evidenceId: ack.evidenceId };
      }, (): CaptureOutcome => { flight.outcome = "failed"; return { confirmed: false }; });
      captureFlight = flight;
    }
    let outcome: CaptureOutcome;
    try { outcome = await wait(captureFlight.promise, () => deadline, "TERMINAL_CAPTURE_PENDING", "persistence"); }
    catch { return fail("TERMINAL_CAPTURE_PENDING"); }
    if (!outcome.confirmed) fail("TERMINAL_CAPTURE_PENDING");
    pendingEvidence = undefined; return true;
  }
  const lifecycle: GatewayLifecycle = { signal: controller.signal, pendingWork: () => {
    const counts = { authority: 0, capture: 0, settlement: 0, native: 0, reader: 0, cleanup: 0 };
    pendingRPCs.forEach((slot) => { counts[slot.kind]++; }); return Object.freeze(counts);
  }, cancel: () => controller.abort(), complete: async () => { let joined = 0; while (joined < tasks.length) { const batch = tasks.slice(joined); joined = tasks.length; await Promise.all(batch); } if (pendingEvidence) fail("TERMINAL_CAPTURE_PENDING"); if (reconciliationPending) fail("TERMINAL_RECONCILIATION_PENDING"); },
  retryPendingTerminalEvidence: () => capturePending(), consumeReplay: async () => {
    if (!replay) return undefined; assertDelivery(); await authority(() => composition.ledger.resolve(resolveArgs(binding)));
    const result = providerJSON(exactJSON(replay, resolution.storageLimits.privateResultBytes));
    if (!result) fail("INVALID_REPLAY");
    if (resolution.snapshot.nativeInterface === "chat") { const item = record(result, ["text"]); if (typeof item.text !== "string" || !item.text) fail("INVALID_REPLAY"); assertDelivery(); return { text: item.text }; }
    const item = record(result, ["profile", "vectors"]); assertProfileMatches(item.profile as typeof DEFAULT_EMBEDDING_PROFILE);
    if (!Array.isArray(item.vectors) || item.vectors.length !== 1) fail("INVALID_REPLAY"); item.vectors.forEach((v: number[]) => assertEmbeddingVector(v));
    assertDelivery(); return { profile: DEFAULT_EMBEDDING_PROFILE, vectors: item.vectors as number[][] };
  } };
  async function admit(request: ModelCallRequest): Promise<Reserved & { dispatchIdentity: string }> {
    proofFor(resolution, (composition.now ?? Date.now)()); assertDelivery();
    const incoming = json(request, resolution.storageLimits.canonicalBytes);
    const admitted = await authority(() => composition.ledger.admit({ ...binding, requestCanonical: incoming }));
    if (admitted.status !== "reserved") { if (admitted.status === "replay") replay = admitted.resultCanonical; fail(admitted.status === "replay" ? "REPLAY_AVAILABLE" : "UNCERTAIN_OR_INFLIGHT"); }
    const flat = exactJSON(admitted.requestCanonical, resolution.storageLimits.canonicalBytes);
    const validated = validateModelRequest(admitted.snapshot, flat).request;
    const comparable = { ...validated, semanticId: request.semanticId, childCallId: request.childCallId };
    if (canonicalModelJson(comparable) !== canonicalModelJson(request) || canonicalModelJson(admitted.snapshot) !== canonicalModelJson(resolution.snapshot)) fail("ADMITTED_REQUEST_MISMATCH");
    const permit = await authority(() => composition.ledger.checkpoint({ reference: binding.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical }));
    if (!permit.dispatchPermit) fail("DISPATCH_NOT_PERMITTED");
    if (permit.requestCanonical !== admitted.requestCanonical || canonicalModelJson(permit.snapshot) !== canonicalModelJson(admitted.snapshot)) fail("CHECKPOINT_MISMATCH");
    assertDelivery(); return { ...admitted, dispatchIdentity: permit.dispatchIdentity };
  }
  const visible = async (attempt: Reserved, outputVisible = false, hardDeadline = Infinity) => {
    assertDelivery(); await authority(() => composition.ledger.markVisible({ reference: binding.reference, attemptId: attempt.attemptId, outputVisible, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false }), hardDeadline); assertDelivery();
  };
  async function terminal(attempt: Reserved & { dispatchIdentity: string }, raw: Record<string, unknown>, privateResult?: string): Promise<void> {
    const deadline = Date.now() + timing.terminalPersistenceMs;
    const id = raw.id; const actual = raw.model; const usage = providerJSON(raw.usage);
    if (typeof id !== "string" || !id || id.length > 256 || typeof actual !== "string" || !actual || actual.length > 256) fail("UNQUALIFIED_TERMINAL");
    utf8(id); utf8(actual);
    const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, resolution.storageLimits.canonicalBytes)).request;
    const observed = usage ? usageOf(usage) : {};
    const nativeBoundViolation = actual !== resolution.snapshot.modelId
      || (observed.inputTokens !== undefined && observed.inputTokens > admitted.inputTokens)
      || (observed.outputTokens !== undefined && observed.outputTokens > admitted.outputTokens);
    if (nativeBoundViolation || !canDeliver()) privateResult = undefined;
    const cost = resolution.dispatchEvidence.terminalCost === "gateway-aggregate-usd-v1" && usage ? conservativeUsdDecimal(usage.cost) : undefined;
    const receipt = { version: 1, dispatchIdentity: attempt.dispatchIdentity, receiptId: id, modelId: resolution.snapshot.modelId, nativeInterface: resolution.snapshot.nativeInterface,
      outcome: "confirmed", proof: "provider-terminal-v1", costSource: cost === undefined ? "unavailable" : "gateway-aggregate-usd-v1",
      ...(cost !== undefined ? { aggregateCostUsd: cost } : {}), ...(usage ? { usage: usageOf(usage) } : {}), actualModel: actual };
    const receiptCanonical = json(receipt, resolution.storageLimits.canonicalBytes);
    pendingEvidence = { attemptId: attempt.attemptId, dispatchIdentity: attempt.dispatchIdentity, receiptCanonical };
    await capturePending(deadline);
    // Capture-only port: B visibility still precedes settlement. Cancellation/expiry suppress
    // result work while known charge continues within its separate finite persistence budget.
    let deliveryRevoked = false;
    if (privateResult && canDeliver()) { try { await visible(attempt, resolution.snapshot.nativeInterface === "chat", deadline); } catch { deliveryRevoked = true; } }
    if (!canDeliver()) privateResult = undefined;
    let settled: Awaited<ReturnType<GatewayLedgerPort["settle"]>>;
    try {
      settled = await persist("settlement", () => {
        const rpc = composition.ledger.settle({ reference: binding.reference, attemptId: attempt.attemptId,
          receiptCanonical: json({ ...receipt, ...(privateResult && !deliveryRevoked ? { privateResultCanonical: privateResult } : {}) }, resolution.storageLimits.canonicalBytes) });
        rpc.then(() => { reconciliationPending = false; }, () => { reconciliationPending = true; }); return rpc;
      }, deadline, "TERMINAL_RECONCILIATION_PENDING");
    } catch { reconciliationPending = true; return fail("TERMINAL_RECONCILIATION_PENDING"); }
    if (deliveryRevoked) fail("DELIVERY_AUTHORITY_REVOKED");
    if (settled.overrun || nativeBoundViolation) fail("QUALIFICATION_OVERRUN");
    if (settled.state !== "settled" || settled.resultWithheld !== false) fail("TERMINAL_RESULT_WITHHELD");
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
      if (type === "stream") normalized.params.includeRawChunks = true; input.set(normalized.params, normalized.request); return normalized.params; },
    wrapGenerate: ({ params, doGenerate }) => state.own(async () => {
      const request = input.get(params)!; const attempt = await state.admit(request);
      const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
      if (nativeIdentity(params) !== nativeIdentity(nativeLanguage(admitted, state.controller.signal))) fail("ADMITTED_REQUEST_MISMATCH");
      let result: Awaited<ReturnType<LanguageModelV4["doGenerate"]>>;
      state.startLifetime(request.timeoutMs);
      try { result = await state.observe("native", doGenerate); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }
      try {
      const raw = providerJSON(result.response?.body); const choices = raw?.choices;
      if (!raw || !Array.isArray(choices) || choices.length !== 1 || !terminalReasons.includes((choices[0] as { finish_reason?: string }).finish_reason ?? "")) fail("UNQUALIFIED_TERMINAL");
      const text = result.content.filter((part) => part.type === "text").map((part) => part.text).join("");
      let privateResult: string | undefined;
      try { if (text && result.content.every((part) => ["text", "reasoning"].includes(part.type))) privateResult = json({ text }, Math.min(state.resolution.storageLimits.privateResultBytes, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes)); } catch { /* Capture observed charge even when output violated its bound. */ }
      try { await state.terminal(attempt, raw, state.canDeliver() ? privateResult : undefined); } finally { state.endLifetime(); }
      state.assertDelivery();
      if (!privateResult || state.controller.signal.aborted) fail("RESULT_BOUND_EXCEEDED");
      if (!text || result.content.some((part) => !["text", "reasoning"].includes(part.type))) fail("UNSUPPORTED_MODEL_OUTPUT");
      return { content: [{ type: "text", text }], finishReason: { unified: (choices[0] as { finish_reason: string }).finish_reason === "length" ? "length" : (choices[0] as { finish_reason: string }).finish_reason === "content_filter" ? "content-filter" : "stop", raw: (choices[0] as { finish_reason: string }).finish_reason }, usage: nativeUsage(providerJSON(raw.usage)), warnings: [] };
      } finally { state.endLifetime(); }
    }),
    wrapStream: ({ params, doStream }) => state.own(async () => {
      const attempt = await state.admit(input.get(params)!);
      const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
      if (nativeIdentity(params) !== nativeIdentity(nativeLanguage(admitted, state.controller.signal))) fail("ADMITTED_REQUEST_MISMATCH");
      let result: Awaited<ReturnType<LanguageModelV4["doStream"]>>;
      state.startLifetime(input.get(params)!.timeoutMs);
      try { result = await state.observe("native", doStream); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }
      const reader = result.stream.getReader();
      let observer: ReadableStreamDefaultController<LanguageModelV4StreamPart>; let observerClosed = false;
      const output = new ReadableStream<LanguageModelV4StreamPart>({ start(c) { observer = c; }, cancel() { observerClosed = true; } }, { highWaterMark: 64 });
      let text = ""; let deliveryError: GatewayDispatchError | undefined; let terminalReason: string | undefined; let rawTerminal: Record<string, unknown> | undefined; let id: string | undefined; let actualModel: string | undefined; let textStarted = false; let terminalAttempted = false;
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
              const choices = raw.choices; if (Array.isArray(choices) && choices.length === 1 && terminalReasons.includes((choices[0] as { finish_reason?: string }).finish_reason ?? "")) terminalReason = (choices[0] as { finish_reason: string }).finish_reason;
              if (providerJSON(raw.usage)) rawTerminal = { id, model: actualModel, usage: raw.usage };
              continue;
            }
            if (part.type === "error") fail("STREAM_INTERRUPTED");
            if (part.type === "text-delta") {
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
            } else if (part.type === "finish") { /* Native EOF flush is NOT terminal proof. */ }
            else if (!["reasoning-start", "reasoning-delta", "reasoning-end", "text-start", "text-end", "response-metadata", "stream-start"].includes(part.type)) {
              deliveryError = new GatewayDispatchError("UNSUPPORTED_MODEL_OUTPUT");
              if (!observerClosed) { observerClosed = true; observer!.error(deliveryError); }
            }
          }
          if (!terminalReason || !rawTerminal) fail("UNQUALIFIED_TERMINAL");
          terminalAttempted = true;
          await state.terminal(attempt, rawTerminal, text && !deliveryError && !state.controller.signal.aborted ? json({ text }, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes) : undefined);
          if (deliveryError) throw deliveryError;
          if (!state.canDeliver()) interrupted();
          if (!observerClosed && !deliveryError) { if (textStarted) emit({ type: "text-end", id: "governed-text" }); emit({ type: "finish", finishReason: { unified: terminalReason === "length" ? "length" : terminalReason === "content_filter" ? "content-filter" : "stop", raw: terminalReason }, usage: nativeUsage(providerJSON(rawTerminal.usage)) }); if (!observerClosed) { state.assertDelivery(); observer!.close(); observerClosed = true; } }
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
  if (resolution.snapshot.nativeInterface !== "embedding" || model.modelId !== DEFAULT_EMBEDDING_PROFILE.modelId || model.provider !== "convexGateway.embedding") fail("MODEL_IDENTITY_MISMATCH");
  const requests = new WeakMap<object, ModelCallRequest>();
  const wrapped = wrapEmbeddingModel({ model, middleware: { specificationVersion: "v4", overrideMaxEmbeddingsPerCall: () => 1,
    transformParams: async ({ params }) => {
      const n = record(params, ["values", "headers", "providerOptions", "abortSignal"]);
      if (n.headers !== undefined || n.providerOptions !== undefined || (n.abortSignal !== undefined && n.abortSignal !== state.controller.signal)) fail("UNSUPPORTED_NATIVE_FIELD");
      const values = arrayValues(n.values); if (values.length !== 1 || typeof values[0] !== "string") fail("EMBEDDING_VALUE_BOUND");
      const text = values[0]; utf8(text); const normalized = normalizeSourceText(text); const bytes = utf8(normalized); if (bytes > 8192) fail("INPUT_BOUND_EXCEEDED");
      const request = requestBase(state.resolution.snapshot, state.binding); request.texts = [normalized]; request.inputTokens = bytes; request.profile = DEFAULT_EMBEDDING_PROFILE;
      request.batch = { ordinal: state.binding.ordinal, start: state.binding.ordinal, end: state.binding.ordinal + 1 };
      const checked = validateModelRequest(state.resolution.snapshot, request).request;
      const transformed: EmbeddingModelV4CallOptions = { values: [...checked.texts], abortSignal: state.controller.signal }; requests.set(transformed, detached(checked)); return transformed;
    },
    wrapEmbed: ({ params, doEmbed }) => state.own(async () => {
      const request = requests.get(params)!; const attempt = await state.admit(request);
      const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
      if (canonicalModelJson(params.values) !== canonicalModelJson(admitted.texts)) fail("ADMITTED_REQUEST_MISMATCH");
      let result: EmbeddingModelV4Result; state.startLifetime(request.timeoutMs);
      try { result = await state.observe("native", doEmbed); } catch { state.endLifetime(); return fail("MODEL_INTERRUPTED"); }
      try {
      const raw = providerJSON(result.response?.body);
      if (!raw || !Array.isArray(raw.data) || raw.data.length !== 1 || result.embeddings.length !== 1) fail("UNQUALIFIED_TERMINAL");
      let payload: string | undefined;
      try { assertEmbeddingVector(result.embeddings[0]!); payload = json({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: result.embeddings }, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes); }
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
